/** ============ LogiSys Importer — entry points ============
 *  setup()        install the trigger and import the most recent report
 *  dryRun()       parse and log every row, write nothing, email nothing
 *  runImporter()  the real run (what the trigger calls)
 */

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runImporter') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runImporter').timeBased()
    .everyMinutes(IMPORTER.TRIGGER_EVERY_MINUTES).create();
  Logger.log('Trigger installed: every %s minutes', IMPORTER.TRIGGER_EVERY_MINUTES);
  return runImporter();
}

function dryRun() { return importRun_(true); }
function runImporter() { return importRun_(false); }

/**
 * Setup-day reset: deletes LogiSys Live and LogiSys Archive, forgets which
 * emails were imported, and imports the reports still in the inbox again.
 * Refuses once the archive holds more than two report dates — after that the
 * archive is history and must not be thrown away.
 */
function rebuildFeed() {
  if (Session.getScriptTimeZone() !== IMPORTER.TZ) {
    throw new Error('Set Project Settings -> Time zone to (GMT+08:00) Manila first.');
  }
  const ss = SpreadsheetApp.openById(IMPORTER.FEED_SPREADSHEET_ID);
  const days = {};
  readOwned_(ss, IMPORTER.SHEET_ARCHIVE).forEach(function (o) {
    const d = asDay_(o['Source Report Date']);
    if (d) days[fmt_(d)] = true;
  });
  if (Object.keys(days).length > 2) {
    throw new Error('LogiSys Archive already holds ' + Object.keys(days).length +
                    ' report dates — rebuildFeed is only for setup day. Nothing was changed.');
  }
  [IMPORTER.SHEET_LIVE, IMPORTER.SHEET_ARCHIVE].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (sh) ss.deleteSheet(sh);
  });
  ss.setSpreadsheetTimeZone(IMPORTER.TZ);
  const props = PropertiesService.getScriptProperties();
  props.getKeys().forEach(function (k) {
    if (/^(done|missing|alert):/.test(k)) props.deleteProperty(k);
  });
  Logger.log('LogiSys Live and Archive cleared; re-importing the reports in the inbox.');
  return runImporter();
}

/** ---------------- the run ---------------- */
function importRun_(dry) {
  const log = [];
  function say(s) { log.push(s); Logger.log(s); }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { say('Another import is running — skipped.'); return log.join('\n'); }
  try {
    if (!IMPORTER.FEED_SPREADSHEET_ID) {
      return failLoud_(dry, 'FEED_SPREADSHEET_ID is not set in Config.gs', 'Nothing was imported.', log);
    }
    const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
    if (IMPORTER.INBOX && me && me !== IMPORTER.INBOX.toLowerCase()) {
      return failLoud_(dry, 'running as the wrong Google account',
        'The importer is running as ' + me + ' but LogiSys sends to ' + IMPORTER.INBOX +
        '. Install it signed in as ' + IMPORTER.INBOX + '.', log);
    }
    // Every day boundary is a Manila day. A project on another time zone would
    // stamp reports with the wrong date, so it stops instead.
    if (Session.getScriptTimeZone() !== IMPORTER.TZ) {
      return failLoud_(dry, 'project time zone is not Manila',
        'The importer project is set to ' + Session.getScriptTimeZone() + '. In the Apps Script editor open ' +
        'Project Settings (gear icon) and set Time zone to (GMT+08:00) Manila.', log);
    }
    const ss = SpreadsheetApp.openById(IMPORTER.FEED_SPREADSHEET_ID);

    const found = findReports_(dry);
    say('Unprocessed LogiSys reports: ' + found.length);

    // ---- parse every report in memory first; a bad one never half-writes
    const good = [], failed = [];
    found.forEach(function (m) {
      try {
        const regs = parseMessage_(m);
        good.push({ m: m, registers: regs });
        regs.forEach(function (g) {
          say('  ' + m.subject + ' [' + fmt_(m.reportDate) + '] ' + g.kind + ': ' +
              g.rows.length + ' rows, ' + g.issues.length + ' problem(s)');
        });
      } catch (e) {
        failed.push({ m: m, error: e.message });
        say('  FAILED ' + m.subject + ' [' + fmt_(m.reportDate) + ']: ' + e.message);
      }
    });

    var issues = [], changedJos = {};
    if (good.length) {
      const plan = planWrite_(ss, good);          // throws if LogiSys Live is not ours
      issues = plan.issues;
      changedJos = plan.changedJos;
      say('LogiSys Live: ' + plan.live.length + ' JOs (' + plan.changed + ' new or changed)' +
          ' | Archive rows to append: ' + plan.archive.length);
      if (dry) {
        plan.preview.forEach(function (l) { say('    ' + l); });
      } else {
        writePlan_(ss, plan);
        good.forEach(function (g) { markDone_(g.m, IMPORTER.LABEL_DONE); });
      }
    }
    if (!dry) failed.forEach(function (f) { markDone_(f.m, IMPORTER.LABEL_FAILED); });

    // ---- one report to the COO per run, and only when something is wrong
    const lines = [];
    failed.forEach(function (f) {
      lines.push('NOT IMPORTED — "' + f.m.subject + '" received ' + fmtTime_(f.m.date) + ': ' + f.error +
                 '. LogiSys Live was not changed by this report.');
    });
    // The register is year-to-date, so the same old row arrives every day.
    // A row's problem is reported when the row is new or changed — once,
    // not every morning.
    good.forEach(function (g) {
      g.registers.forEach(function (r) {
        r.issues.forEach(function (i) { if (!i.jo || changedJos[i.jo]) lines.push(i.text); });
      });
    });
    issues.forEach(function (i) { lines.push(i); });
    if (lines.length) {
      const subj = 'LogiSys importer: ' + (failed.length ? failed.length + ' report(s) not imported' :
                   'imported with ' + lines.length + ' problem(s)');
      sendCoo_(dry, subj, lines, say);
    }

    const today = dayOf_(new Date());
    const gotToday = good.some(function (g) { return g.m.reportDate.getTime() === today.getTime(); });
    checkMissing_(ss, dry, say, gotToday);
    return log.join('\n');
  } catch (e) {
    return failLoud_(dry, 'run failed', e.message, log);
  } finally {
    lock.releaseLock();
  }
}

/** ============ Gmail ============ */

/**
 * Reports not yet processed, oldest first. Processing is tracked by
 * MESSAGE id in script properties, not by thread label: Gmail threads
 * daily emails with the same subject together, and a thread label would
 * hide every later report in that thread.
 */
function findReports_() {
  const q = (IMPORTER.FEED_SENDER ? 'from:(' + IMPORTER.FEED_SENDER + ') ' : '') +
            'has:attachment newer_than:' + IMPORTER.SEARCH_DAYS + 'd';
  const props = PropertiesService.getScriptProperties();
  const out = [];
  GmailApp.search(q).forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      const subject = msg.getSubject() || '';
      const matches = IMPORTER.FEED_SUBJECTS.some(function (s) {
        return subject.toLowerCase().indexOf(s.toLowerCase()) !== -1;
      });
      if (!matches) return;
      if (props.getProperty('done:' + msg.getId())) return;
      out.push({ id: msg.getId(), msg: msg, thread: thread, subject: subject,
                 date: msg.getDate(), reportDate: dayOf_(msg.getDate()) });
    });
  });
  out.sort(function (a, b) { return a.date - b.date; });
  return out;
}

function markDone_(m, labelName) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('done:' + m.id, fmt_(m.reportDate));
  const label = GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
  m.thread.addLabel(label);
  // forget message ids older than the search window, so properties never fill up
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - IMPORTER.SEARCH_DAYS - 7);
  props.getKeys().forEach(function (k) {
    if (k.indexOf('done:') === 0) {
      const d = parseIso_(props.getProperty(k));
      if (d && d < cutoff) props.deleteProperty(k);
    } else if (k.indexOf('alert:') === 0 || k.indexOf('missing:') === 0) {
      const d = parseIso_(k.slice(k.lastIndexOf(':') + 1));
      if (d && d < cutoff) props.deleteProperty(k);
    }
  });
}

/** ============ Parsing ============ */

/** Every LogiSys register in a message. Throws if there is none usable. */
function parseMessage_(m) {
  const atts = m.msg.getAttachments().filter(function (a) {
    return /\.(csv|xlsx|xls)$/i.test(a.getName() || '');
  });
  if (!atts.length) throw new Error('no CSV or Excel attachment');
  const regs = [];
  atts.forEach(function (a) {
    var tables;
    try { tables = readAttachment_(a); }
    catch (e) { throw new Error('attachment "' + a.getName() + '" is unreadable: ' + e.message); }
    tables.forEach(function (t) {
      const r = parseRegister_(t, m.reportDate);
      if (r) regs.push(r);
    });
  });
  if (!regs.length) throw new Error('no LogiSys register found (no "Shipment No" header in the first ' +
                                    IMPORTER.HEADER_SEARCH_ROWS + ' rows)');
  return regs;
}

/** Attachment -> list of 2D tables (one per tab for Excel). */
function readAttachment_(blob) {
  if (/\.csv$/i.test(blob.getName())) return [Utilities.parseCsv(blob.getDataAsString('UTF-8'))];
  // Excel: convert to a temporary Google Sheet via the Drive advanced service,
  // read it, and trash it. The temp file is the importer's own.
  const meta = { name: 'LogiSys import (temporary)', title: 'LogiSys import (temporary)',
                 mimeType: 'application/vnd.google-apps.spreadsheet' };
  const file = Drive.Files.create ? Drive.Files.create(meta, blob) : Drive.Files.insert(meta, blob);
  try {
    const book = SpreadsheetApp.openById(file.id);
    // Read every date as a Manila day, whatever the account's default time zone
    // (otherwise a date can arrive carrying a false time of day, or the wrong day).
    book.setSpreadsheetTimeZone(IMPORTER.TZ);
    return book.getSheets().map(function (sh) {
      return sh.getDataRange().getValues();
    });
  } finally {
    DriveApp.getFileById(file.id).setTrashed(true);
  }
}

/**
 * One register table -> contract rows. Returns null when the table is not a
 * register at all; throws when it is one but a required header is missing.
 */
function parseRegister_(values, reportDate) {
  var h = -1;
  for (var i = 0; i < Math.min(values.length, IMPORTER.HEADER_SEARCH_ROWS); i++) {
    if (values[i].some(function (c) { return clean_(c) === 'Shipment No'; })) { h = i; break; }
  }
  if (h === -1) return null;

  const headers = values[h].map(clean_);
  const kind = headers.indexOf('BL NO') !== -1 ? 'SEA' : headers.indexOf('AWB NO') !== -1 ? 'AIR' : null;
  if (!kind) throw new Error('register has neither "BL NO" nor "AWB NO" — cannot tell SEA from AIR');
  const map = kind === 'SEA' ? SEA_MAP : AIR_MAP;
  const missing = REQUIRED_SOURCE.filter(function (x) { return headers.indexOf(x) === -1; });
  if (missing.length) throw new Error(kind + ' register is missing required header(s): ' + missing.join(', '));

  const col = {};
  headers.forEach(function (x, j) { if (map[x] && !(map[x] in col)) col[map[x]] = j; });

  const issues = [], byJo = {}, order = [];
  for (var r = h + 1; r < values.length; r++) {
    const raw = values[r];
    const rest = raw.filter(function (c, j) { return j !== col['JO Number'] && clean_(c) !== ''; });
    const jo = clean_(raw[col['JO Number']]);
    if (!jo) {
      if (rest.length > 1) issues.push({ jo: '', text: kind + ' row ' + (r + 1) + ': no Shipment No — row skipped' });
      continue;
    }
    if (!rest.length) continue;                         // title or footer line

    const o = {};
    FEED_HEADERS.forEach(function (f) { o[f] = ''; });
    Object.keys(col).forEach(function (f) { o[f] = asText_(raw[col[f]]); });   // dates and numbers re-read below
    o['JO Number'] = jo;
    o['Mode'] = kind === 'AIR' ? 'Air' : 'Sea';        // from the register, never from the goods

    if (kind === 'SEA') {
      const ct = clean_(o['Cargo Type']).toUpperCase();
      if (/\bFCL\b/.test(ct)) o['Cargo Type'] = 'FCL';
      else if (/\bLCL\b/.test(ct)) o['Cargo Type'] = 'LCL';
      else if (/^BREAK\s*BULK$/.test(ct)) o['Cargo Type'] = 'BREAK BULK';     // a real sea cargo type
      else if (ct) issues.push({ jo: jo, text: jo + ': Cargo Type "' + ct + '" is not FCL, LCL or BREAK BULK — kept as written' });
    } else o['Cargo Type'] = '';

    DATE_FIELDS.forEach(function (f) {
      const v = raw[col[f]];
      if (col[f] === undefined || v === '' || v === null) { o[f] = ''; return; }
      const d = normDate_(v);
      if (!d) { o[f] = ''; issues.push({ jo: jo, text: jo + ': ' + f + ' "' + showRaw_(v) + '" is not a valid date — left blank' }); }
      else o[f] = d;
    });
    NUMBER_FIELDS.forEach(function (f) {
      const v = raw[col[f]];
      if (col[f] === undefined || clean_(v) === '') { o[f] = ''; return; }
      const n = typeof v === 'number' ? v : Number(clean_(v).replace(/,/g, ''));
      if (isNaN(n) || n < 0) { o[f] = ''; issues.push({ jo: jo, text: jo + ': ' + f + ' "' + v + '" is not a number — left blank' }); }
      else o[f] = n;
    });

    o['Stage'] = stageOf_(o['Status']);
    o['Source Report Date'] = reportDate;

    if (byJo[jo]) issues.push({ jo: jo, text: jo + ': listed twice in the ' + kind + ' register — last row kept' });
    else order.push(jo);
    byJo[jo] = o;
  }
  return { kind: kind, rows: order.map(function (jo) { return byJo[jo]; }), issues: issues };
}

function stageOf_(status) {
  const s = clean_(status).toLowerCase();
  if (!s) return '';
  if (IMPORTER.STATUS_DELIVERED.some(function (x) { return s.indexOf(x) !== -1; })) return 'Delivered';
  const keys = Object.keys(IMPORTER.STATUS_STAGES);
  for (var i = 0; i < keys.length; i++) if (s.indexOf(keys[i]) !== -1) return IMPORTER.STATUS_STAGES[keys[i]];
  return '';
}

function isDeliveredStatus_(status) { return stageOf_(status) === 'Delivered'; }

/** ============ Merge and write ============ */

/**
 * Build the new LogiSys Live and the Archive rows entirely in memory.
 * Nothing is written here.
 */
function planWrite_(ss, good) {
  const existing = readOwned_(ss, IMPORTER.SHEET_LIVE);
  const live = {};
  existing.forEach(function (o) { live[o['JO Number']] = o; });

  const archive = [], issues = [], preview = [], changedJos = {};
  var changed = 0;
  good.forEach(function (g) {
    g.registers.forEach(function (reg) {
      reg.rows.forEach(function (o) {
        const jo = o['JO Number'];
        const prev = live[jo];
        const prevSrd = prev ? asDay_(prev['Source Report Date']) : null;
        if (prevSrd && prevSrd > o['Source Report Date']) return;      // an older report never wins

        // Last Updated: the report date on which the Status last changed
        o['Last Updated'] = (prev && clean_(prev['Status']) === clean_(o['Status']) && asDay_(prev['Last Updated']))
          ? asDay_(prev['Last Updated']) : o['Source Report Date'];
        // Delivered: the first report date that showed a delivered status
        o['Delivered'] = (prev && asDay_(prev['Delivered'])) ? asDay_(prev['Delivered'])
          : (isDeliveredStatus_(o['Status']) ? o['Source Report Date'] : '');

        if (!prev || !sameRow_(prev, o)) { archive.push(o); changed++; changedJos[jo] = true; }
        live[jo] = o;
        preview.push(jo + ' | ' + o['Mode'] + ' ' + o['Cargo Type'] + ' | ' + o['Client'] +
          ' | ETD ' + fmt_(o['ETD']) + ' | ETA ' + fmt_(o['ETA']) + ' | ATA ' + fmt_(o['ATA']) +
          ' | ' + o['Status'] + (o['Delivered'] ? ' | delivered ' + fmt_(o['Delivered']) : ''));
      });
    });
  });

  const rows = Object.keys(live).sort().map(function (jo) { return live[jo]; });
  rows.forEach(function (o) {
    if (!o['Source Report Date']) issues.push(o['JO Number'] + ': no Source Report Date');
  });
  return { live: rows, archive: archive, changed: changed, changedJos: changedJos, issues: issues, preview: preview };
}

/** Same shipment facts? (ignores the report date itself) */
function sameRow_(a, b) {
  return FEED_HEADERS.every(function (f) {
    if (f === 'Source Report Date') return true;
    return cellKey_(a[f]) === cellKey_(b[f]);
  });
}
function cellKey_(v) {
  if (isDate_(v)) return 'D' + v.getTime();
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Cell formats for each contract column. Text columns are forced to plain
 * text: otherwise Sheets turns an FSA number like "1294-07-26" into a date
 * and drops leading zeros from BL numbers.
 */
function formatsFor_(rows) {
  const row = FEED_HEADERS.map(function (f) {
    if (DATE_FIELDS.indexOf(f) !== -1 || f === 'Delivered' || f === 'Last Updated' || f === 'Source Report Date') return 'yyyy-mm-dd';
    if (NUMBER_FIELDS.indexOf(f) !== -1) return '0';
    return '@';
  });
  const out = [];
  for (var i = 0; i < rows; i++) out.push(row);
  return out;
}

/** Write LogiSys Live in ONE operation, then append the archive. */
function writePlan_(ss, plan) {
  // Dates are stored and shown as Manila days, for Penny and for people.
  if (ss.getSpreadsheetTimeZone() !== IMPORTER.TZ) ss.setSpreadsheetTimeZone(IMPORTER.TZ);
  const live = ownedSheet_(ss, IMPORTER.SHEET_LIVE);
  const out = [FEED_HEADERS].concat(plan.live.map(function (o) {
    return FEED_HEADERS.map(function (f) { return o[f] === undefined ? '' : o[f]; });
  }));
  out.forEach(function (r, i) {                          // validate before touching the sheet
    if (r.length !== FEED_HEADERS.length) throw new Error('row ' + (i + 1) + ' has the wrong width');
    if (i > 0 && !r[0]) throw new Error('row ' + (i + 1) + ' has no JO Number');
  });
  const oldRows = live.getLastRow();
  live.getRange(1, 1, out.length, FEED_HEADERS.length)
    .setNumberFormats(formatsFor_(out.length)).setValues(out);
  if (oldRows > out.length) {
    live.getRange(out.length + 1, 1, oldRows - out.length, FEED_HEADERS.length).clearContent();
  }

  if (plan.archive.length) {
    const arch = ownedSheet_(ss, IMPORTER.SHEET_ARCHIVE);
    const rows = plan.archive.map(function (o) {
      return FEED_HEADERS.map(function (f) { return o[f] === undefined ? '' : o[f]; });
    });
    arch.getRange(arch.getLastRow() + 1, 1, rows.length, FEED_HEADERS.length)
      .setNumberFormats(formatsFor_(rows.length)).setValues(rows);
  }
}

/**
 * The only door to a writable sheet: LogiSys Live or LogiSys Archive, in the
 * feed workbook. Creates it with the contract headers if absent. Refuses a
 * sheet whose headers are not the contract — never overwrite what we don't own.
 */
function ownedSheet_(ss, name) {
  if (name !== IMPORTER.SHEET_LIVE && name !== IMPORTER.SHEET_ARCHIVE) {
    throw new Error('The importer refused to write to "' + name + '" — it writes only LogiSys Live and LogiSys Archive.');
  }
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, FEED_HEADERS.length).setValues([FEED_HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  checkContract_(sh);
  return sh;
}

function checkContract_(sh) {
  if (sh.getLastRow() === 0) return;
  const hdr = sh.getDataRange().getValues()[0].map(clean_);
  const missing = FEED_HEADERS.filter(function (f) { return hdr.indexOf(f) === -1; });
  if (missing.length) {
    throw new Error('"' + sh.getName() + '" does not carry the LogiSys Live headers (missing ' +
                    missing.join(', ') + ') — refusing to overwrite it');
  }
}

/** Read Live or Archive into contract objects, by header text. Read only. */
function readOwned_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  checkContract_(sh);
  const v = sh.getDataRange().getValues();
  const hdr = v[0].map(clean_);
  return v.slice(1).filter(function (r) { return clean_(r[hdr.indexOf('JO Number')]); }).map(function (r) {
    const o = {};
    FEED_HEADERS.forEach(function (f) { o[f] = r[hdr.indexOf(f)]; });
    return o;
  });
}

/** ============ Failure reporting ============ */

/** No report dated today by the alert time on a working day -> tell the COO, once. */
function checkMissing_(ss, dry, say, gotToday) {
  if (gotToday) return;                       // this run found today's report (matters on a dry run)
  const now = new Date();
  const w = now.getDay();
  if (w === 0 || w === 6) return;
  if (now.getHours() * 60 + now.getMinutes() < IMPORTER.MISSING_ALERT_HOUR * 60 + IMPORTER.MISSING_ALERT_MINUTE) return;
  const today = dayOf_(now);
  const newest = readOwned_(ss, IMPORTER.SHEET_LIVE).reduce(function (m, o) {
    const d = asDay_(o['Source Report Date']);
    return d && (!m || d > m) ? d : m;
  }, null);
  if (newest && newest.getTime() === today.getTime()) return;
  const key = 'missing:' + fmt_(today);
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(key)) return;
  say('No LogiSys report for ' + fmt_(today));
  sendCoo_(dry, 'LogiSys report for ' + fmtLong_(today) + ' not received',
           ['LogiSys report for ' + fmtLong_(today) + ' not received.',
            'Nothing was written. Penny will not run her pending checks on old data.'], say);
  if (!dry) props.setProperty(key, '1');
}

function sendCoo_(dry, subject, lines, say) {
  say('  -> COO: ' + subject + (dry ? ' [dry]' : ''));
  lines.forEach(function (l) { say('       ' + l); });
  if (dry) return;
  MailApp.sendEmail({
    to: IMPORTER.COO, subject: subject,
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;max-width:640px;">' +
      lines.map(function (l) { return '<p style="margin:0 0 6px;">' + esc_(l) + '</p>'; }).join('') +
      '<p style="color:#888;font-size:11px;margin-top:16px;">LogiSys importer — writes LogiSys Live and ' +
      'LogiSys Archive only.</p></div>'
  });
}

function failLoud_(dry, what, detail, log) {
  log.push('FAILURE: ' + what + ' — ' + detail);
  Logger.log(log[log.length - 1]);
  // The trigger runs every 15 minutes: tell the COO once a day per problem, not 96 times.
  const props = PropertiesService.getScriptProperties();
  const key = 'alert:' + what + ':' + fmt_(dayOf_(new Date()));
  if (props.getProperty(key)) { log.push('(COO already told today)'); return log.join('\n'); }
  sendCoo_(dry, 'LogiSys importer: ' + what, [detail, 'LogiSys Live was not changed.'], function (s) { log.push(s); });
  if (!dry) props.setProperty(key, '1');
  return log.join('\n');
}

/** ============ Small helpers ============ */

function clean_(v) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim(); }
function esc_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function dayOf_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function asDay_(v) { return isDate_(v) ? dayOf_(v) : null; }
function fmt_(d) { return isDate_(d) ? Utilities.formatDate(d, IMPORTER.TZ, 'yyyy-MM-dd') : ''; }
function fmtLong_(d) { return Utilities.formatDate(d, IMPORTER.TZ, 'd MMM yyyy'); }
function fmtTime_(d) { return Utilities.formatDate(d, IMPORTER.TZ, 'd MMM yyyy HH:mm'); }
/**
 * A text column's value as text. If a spreadsheet already turned an FSA
 * number like "1294-07-26" into a date, this gives the original text back.
 */
function asText_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, IMPORTER.TZ, 'yyyy-MM-dd');
  return clean_(v);
}
function showRaw_(v) { return isDate_(v) ? Utilities.formatDate(v, IMPORTER.TZ, 'yyyy-MM-dd') : String(v); }
function parseIso_(s) {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return x ? new Date(+x[1], +x[2] - 1, +x[3]) : null;
}

const MONTHS_ = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

/**
 * A real date, or null. Keeps the time of day when LogiSys gives one (Penny
 * measures Unilab air in hours). Text is accepted only as yyyy-mm-dd or
 * dd-MMM-yyyy — "03/04/2026" is ambiguous and is reported, not guessed.
 * Anything outside 2024-01-01 .. 2027-12-31 is rejected.
 */
function normDate_(v) {
  var d = null;
  if (isDate_(v)) d = new Date(v.getTime());
  else if (typeof v === 'number' && v > 20000 && v < 60000) {                  // Excel serial
    const ms = Math.round((v - 25569) * 86400000);
    const u = new Date(ms);
    d = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes());
  } else if (typeof v === 'string') {
    const t = clean_(v);
    var x, y, m, day, hh = 0, mi = 0;
    if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(t))) {
      y = +x[1]; m = +x[2] - 1; day = +x[3]; hh = +(x[4] || 0); mi = +(x[5] || 0);
    } else if ((x = /^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/.exec(t)) &&
               (x[2].toLowerCase() in MONTHS_)) {
      y = +x[3]; m = MONTHS_[x[2].toLowerCase()]; day = +x[1]; hh = +(x[4] || 0); mi = +(x[5] || 0);
    } else return null;
    d = new Date(y, m, day, hh, mi);
    if (y < 100) d.setFullYear(y);
    if (d.getFullYear() !== y || d.getMonth() !== m || d.getDate() !== day) return null;   // 31 Feb
  }
  if (!d || isNaN(d.getTime())) return null;
  if (dayOf_(d) < IMPORTER.DATE_MIN || dayOf_(d) > IMPORTER.DATE_MAX) return null;
  return d;
}
