/** ============ Penny — entry points ============
 *  setup()   install the 07:45 trigger and run once now
 *  dryRun()  log everything, send nothing, write nothing
 *  runPenny() the real run
 */

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runPenny') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runPenny').timeBased()
    .atHour(CONFIG.SEND_HOUR).nearMinute(CONFIG.SEND_MINUTE).everyDays(1)
    .inTimezone(CONFIG.TZ).create();
  Logger.log('Trigger installed for %s:%s %s',
    CONFIG.SEND_HOUR, ('0' + CONFIG.SEND_MINUTE).slice(-2), CONFIG.TZ);
  runPenny();
}

function dryRun() { return execute_(true); }
function runPenny() { return execute_(false); }

/** Creates LogiSys Live + Archive with the correct headers, for testing
 *  before the importer exists. Safe to run more than once: a sheet that
 *  already exists is never touched, empty or not. */
function bootstrapFeedSheets() {
  const ss = feedBook_();
  [CONFIG.SHEET_LIVE, CONFIG.SHEET_ARCHIVE].forEach(function (name) {
    if (ss.getSheetByName(name)) {
      Logger.log('"%s" already exists — left untouched', name);
      return;
    }
    createFeedSheet_(ss, name);
    Logger.log('Created "%s" with %s headers', name, FEED_HEADERS.length);
  });
}

/** The one place Penny's code may create a feed sheet: brand new, headers only. */
function createFeedSheet_(ss, name) {
  if (name !== CONFIG.SHEET_LIVE && name !== CONFIG.SHEET_ARCHIVE) throw new Error('not a feed sheet: ' + name);
  if (ss.getSheetByName(name)) throw new Error('"' + name + '" already exists — refusing to touch it');
  const sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, FEED_HEADERS.length).setValues([FEED_HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

/** ---------------- the run ---------------- */
function execute_(dry) {
  const now = new Date();
  const log = [];
  function say(s) { log.push(s); Logger.log(s); }

  // Every age is counted in Manila calendar days; any other project time zone
  // would make this morning's feed look a day old.
  if (Session.getScriptTimeZone() !== CONFIG.TZ) {
    return fail_(dry, 'project time zone is not Manila',
      'Penny\'s Apps Script project is set to ' + Session.getScriptTimeZone() + '. Open Project Settings ' +
      '(gear icon) and set Time zone to (GMT+08:00) Manila.', log);
  }

  // Monday to Friday only
  if (isWeekend_(now) && !dry) { say('Weekend — nothing sent.'); return log.join('\n'); }

  // Handlers must see Penny's mail come from the ops account, never a personal one
  const me = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (CONFIG.SENDER_ACCOUNT && me && me !== CONFIG.SENDER_ACCOUNT.toLowerCase()) {
    return fail_(dry, 'running as the wrong Google account',
      'Penny is running as ' + me + ', so her emails would come from that address. ' +
      'Run setup() signed in as ' + CONFIG.SENDER_ACCOUNT + ' (and remove the trigger from ' + me + ').', log);
  }

  var feed, ss;
  try {
    feed = loadFeed_();
    ss = feed.ss;
  } catch (e) {
    return fail_(dry, 'could not read the feed', e.message, log);
  }

  // Freshness gate — never run on stale data without saying so
  const stale = stalenessOfFeed_(feed.rows);
  if (stale) {
    const day = fmtDateLong_(today_());
    const msg = 'LogiSys feed for ' + day + ' has not arrived. No pending checks run today.';
    say('FEED STALE: ' + msg + ' (' + stale + ')');
    const e = { person: 'COO', to: CONFIG.RECIPIENTS.coo, jos: [], lines: [stale],
      subject: CONFIG.AGENT + ': LogiSys feed for ' + day + ' not received',
      html: wrap_('<h2 style="margin:0 0 8px;font-size:17px;">LogiSys feed missing</h2>' +
                  '<p>' + esc_(msg) + '</p><p style="color:#5b6b60;">' + esc_(stale) + '.</p>' +
                  '<p>Penny sent nothing to anyone else this morning.</p>', '') };
    sendAll_([e], dry, say);
    return log.join('\n');
  }

  var Q, deliveredJos = {};
  try {
    const hmap = handlerMap_();
    const prev = previousEtas_(ss);
    Q = buildQueues_(feed.rows, hmap, prev);
    Q.q3 = newJos_(feed.rows, prev);
    Q.prevAvailable = prev.available;
    currentRows_(feed.rows).rows.forEach(function (r) {
      if (isDelivered_(r)) deliveredJos[norm_(r['JO Number'])] = true;
    });
  } catch (e) {
    return fail_(dry, 'could not build the queues', e.message, log);
  }

  const notes = [];
  if (caReadError_) notes.push('CA Tracker could not be read (' + caReadError_ +
    ') — handlers come from LogiSys only and cash-advance state is unknown today.');
  if (!Q.prevAvailable) notes.push('No earlier report in LogiSys Archive — ETA-change and new-JO checks skipped today.');

  say('Feed rows: ' + feed.rows.length + ' (this morning\'s report: ' + currentRows_(feed.rows).rows.length +
      ', out of scope before ' + fmtDateLong_(CONFIG.SCOPE_FROM) + ': ' + Q.outOfScope + ')');
  say('Q1 arrived-not-delivered: ' + Q.q1.length +
      ' (red+ ' + Q.q1.filter(function (x) { return x.sev === 'red' || x.sev === 'critical'; }).length + ')');
  say('Q2 arriving soon: ' + Q.q2.length);
  say('Q3 new JOs: ' + Q.q3.length);
  say('Q4 status to check: ' + Q.q4.length);
  say('Q5a no ETA: ' + Q.q5a.length +
      ' | Q5b ETA changed: ' + Q.q5b.length + (Q.prevAvailable ? '' : ' (no prior report — skipped)') +
      ' | Q5c ETA passed: ' + Q.q5c.length);
  say('Date defects: ' + Q.defects.length + ' | LogiSys ATA not used: ' + Q.untrusted.length);

  // ---------- arrivals record (Penny's own sheets) ----------
  const arr = { summary: null, monthly: null };
  try {
    const ships = allShipmentsYtd_(ss, now.getFullYear());
    if (!dry) arr.summary = updateArrivals_(ss, ships, now.getFullYear());
    say('Arrivals YTD: ' + ships.length + ' shipments' + (dry ? ' (dry run — not written)' : ''));

    const due = monthlyDue_(ss, now);
    if (due) {
      if (!dry) arr.monthly = buildMonthlyReport_(ss, allShipmentsYtd_(ss, due.year), due.year, due.month);
      say('Monthly report: ' + due.name + (dry ? ' is due (dry run — not written)' : ' (' + arr.monthly.total + ' rows)'));
    }
  } catch (e) {
    say('Arrivals step failed: ' + e.message);
    notes.push('Penny Arrivals was not refreshed: ' + e.message);
  }

  // ---------- plan, self-check, send ----------
  const emails = planEmails_(Q, arr, notes);
  const problems = selfCheck_(emails, deliveredJos);
  if (problems.length) {
    return fail_(dry, 'self-check failed, nothing sent', problems.join('\n'), log);
  }
  const sent = sendAll_(emails, dry, say);
  say('Emails ' + (dry ? 'that would be sent' : 'sent') + ': ' + sent);
  return log.join('\n');
}

function fail_(dry, subject, detail, log) {
  log.push('FAILURE: ' + subject + ' — ' + detail);
  Logger.log(log[log.length - 1]);
  if (!dry) {
    sendTo_(CONFIG.RECIPIENTS.coo, CONFIG.AGENT + ': run stopped — ' + subject,
      wrap_('<h2 style="margin:0 0 8px;font-size:17px;">' + esc_(subject) + '</h2>' +
            '<pre style="white-space:pre-wrap;font-size:12px;">' + esc_(detail) + '</pre>' +
            '<p>Penny stopped and sent nothing else.</p>', ''));
  }
  return log.join('\n');
}

function sendTo_(to, subject, html, person) {
  if (!to) return false;
  if (CONFIG.SHADOW_TO) {                            // shadow mode: nobody else receives anything
    html = '<div style="background:#eef3ff;border-left:3px solid #3355cc;padding:8px 10px;margin:0 0 12px;' +
           'font-family:Arial,sans-serif;font-size:13px;">Shadow mode — this email was for <b>' +
           esc_(person || to) + '</b> &lt;' + esc_(to) + '&gt;. Nobody else received it.</div>' + html;
    to = CONFIG.SHADOW_TO;
  }
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: CONFIG.AGENT });   // shows as "Penny"
  return true;
}

/** ============ Plan the morning's emails ============
 *  One email per person. Nothing for a person with nothing to act on.
 *  Returns [{person, to, subject, html, jos, lines}] — nothing is sent here.
 */
const SHIPMENT_RISK_ = ['q1','q2','q5b','q5c'];       // may make a subject CRITICAL
const TITLES_ = {
  q1: 'Arrived, not yet delivered', q2: 'Arriving within ' + CONFIG.Q2_ETA_WINDOW + ' days',
  q5b: 'ETA changed', q5c: 'ETA passed, no arrival recorded',
  q4: 'Status to check in LogiSys', q5a: 'No ETA recorded'
};

function planEmails_(Q, arr, notes) {
  const R = CONFIG.RECIPIENTS;
  const nonGreen = function (s) { return s.sev !== 'green'; };
  const emails = [];
  const cooNotes = notes.slice();

  // ---- route shipment-risk items to their handler ----
  // Ariel receives ONLY shipment-update work (stale status, no ETA) — never
  // another account's shipments. COO's decision, 28 Sep 2026.
  const byHandler = {}, ariel = { q4: Q.q4, q5a: Q.q5a.filter(nonGreen) };
  const rerouted = {}, unassigned = [];
  SHIPMENT_RISK_.forEach(function (k) {
    Q[k].filter(nonGreen).forEach(function (s) {
      if (!s.rawHandler) { unassigned.push(s.jo); return; }     // handler not set -> COO note
      if (!s.handler || !R.handlers[s.handler]) {              // no address -> COO note
        const who = s.handler || s.rawHandler;
        (rerouted[who] = rerouted[who] || { known: !!s.handler, jos: [] }).jos.push(s.jo);
        return;
      }
      const b = byHandler[s.handler] = byHandler[s.handler] || { q1: [], q2: [], q5b: [], q5c: [] };
      b[k].push(s);
    });
  });

  function subjectFor(n, critical) {
    return (critical ? 'CRITICAL — ' : '') + CONFIG.AGENT + ': ' + n +
           (n === 1 ? ' shipment needs action' : ' shipments need action');
  }
  function josOf(lists) {
    const set = {};
    lists.forEach(function (l) { l.forEach(function (s) { set[s.jo] = true; }); });
    return Object.keys(set);
  }
  function anyRed(lists) {
    return lists.some(function (l) {
      return l.some(function (s) { return s.sev === 'red' || s.sev === 'critical'; });
    });
  }
  function linesOf(map) {
    const out = [];
    Object.keys(map).forEach(function (k) {
      map[k].forEach(function (s) { out.push(textLine_(k, s)); });
    });
    return out;
  }
  function greet(name) {
    return '<h2 style="margin:0 0 2px;font-size:17px;">Good morning, ' + esc_(name) + '</h2>' +
           '<div style="color:#5b6b60;font-size:12px;">' + fmtDateLong_(today_()) + '</div>';
  }

  const team = CONFIG.TEAM_EMAILS === true;           // off: the COO's email only

  // ---- handlers ----
  if (team) Object.keys(byHandler).forEach(function (h) {
    const b = byHandler[h];
    const lists = [b.q1, b.q2, b.q5b, b.q5c];
    const jos = josOf(lists);
    emails.push({
      person: h, to: R.handlers[h], jos: jos, lines: linesOf(b),
      subject: subjectFor(jos.length, anyRed(lists)),
      html: wrap_(greet(h.split(' ')[0]) + sectionsHtml_([
        { key: 'q1', title: TITLES_.q1, items: b.q1,
          note: 'Storage is free for ' + CONFIG.STORAGE_FREE_DAYS + ' days, demurrage for ' +
                CONFIG.DEMURRAGE_FREE_DAYS + '.' },
        { key: 'q2', title: TITLES_.q2, items: b.q2, note: '' },
        { key: 'q5b', title: TITLES_.q5b, items: b.q5b, note: 'Your plan may need adjusting.' },
        { key: 'q5c', title: TITLES_.q5c, items: b.q5c, note: '' }
      ]), '')
    });
  });

  // ---- Ariel: stale status and no ETA — data he maintains in LogiSys ----
  const arielJos = josOf([ariel.q4, ariel.q5a]);
  if (team && arielJos.length) {
    if (!R.support) {
      cooNotes.push('Ariel has no email address set — his ' + arielJos.length +
                    ' shipment(s) are in this email: ' + arielJos.join(', ') + '.');
    } else {
      emails.push({
        person: 'Ariel', to: R.support, jos: arielJos, lines: linesOf(ariel),
        subject: subjectFor(arielJos.length, false),         // data work is never CRITICAL
        html: wrap_(greet('Ariel') + sectionsHtml_([
          { key: 'q5a', title: 'No ETA recorded — ' + ariel.q5a.length + ' shipment' + (ariel.q5a.length === 1 ? '' : 's'),
            items: ariel.q5a, note: 'These cannot be planned until an ETA is in LogiSys.' },
          { key: 'q4', title: TITLES_.q4, items: ariel.q4, note: '' }
        ]), '')
      });
    }
  }

  // ---- COO: everything ----
  if (unassigned.length) {
    cooNotes.push('No account handler set in LogiSys or the CA Tracker for ' + unassigned.length +
                  ' shipment(s) — they are in this email only: ' + unassigned.join(', ') + '.');
  }
  if (team) Object.keys(rerouted).forEach(function (who) {
    const x = rerouted[who];
    cooNotes.push((x.known ? who + ' has no email address set' :
                   'Account handler "' + who + '" is not in Penny\'s recipient list, so has no address') +
                  ' — ' + x.jos.length + ' shipment(s) for them are in this email: ' + x.jos.join(', ') + '.');
  });
  // The COO sees who owns each shipment, next to the client.
  const owned = function (list) {
    return list.map(function (s) {
      return Object.assign({}, s, { client: s.client + ' — ' + (s.handler || s.rawHandler || 'no handler') });
    });
  };
  const coo = { q1: owned(Q.q1.filter(nonGreen)), q2: owned(Q.q2), q5b: owned(Q.q5b), q5c: owned(Q.q5c),
                q4: owned(Q.q4), q5a: owned(Q.q5a.filter(nonGreen)) };
  const cooLists = [coo.q1, coo.q2, coo.q5b, coo.q5c, coo.q4, coo.q5a];
  const cooJos = josOf(cooLists);
  if (!cooJos.length && !Q.q3.length && !cooNotes.length && !arr.monthly) return emails;
  if (!team && cooJos.length) {
    cooNotes.unshift('Team emails are off — handlers and Ariel received nothing today. ' +
                     'Every pending shipment is in this email, with its handler next to the client.');
  }

  const inFree = Q.q1.filter(function (s) { return !s.storageRunning; }).length;
  const storage = Q.q1.filter(function (s) { return s.storageRunning && !s.demurrageRunning; }).length;
  const demurrage = Q.q1.filter(function (s) { return s.demurrageRunning; }).length;
  const unconfirmed = Q.q4.filter(function (s) {
    return s.reasons.some(function (r) { return /arrived per status|ATA is blank/.test(r); });
  }).length;
  function kv(k, v, red) {
    return '<tr><td style="padding:4px 18px 4px 0;' + (red ? 'color:#b91c1c;' : '') + '">' + k +
           '</td><td><b' + (red ? ' style="color:#b91c1c;"' : '') + '>' + v + '</b></td></tr>';
  }
  var body = '<h2 style="margin:0 0 2px;font-size:17px;">Pending shipments — ' + fmtDateLong_(today_()) + '</h2>' +
    '<table role="presentation" style="border-collapse:collapse;margin:12px 0;font-size:13px;">' +
    kv('Arrived, not delivered', Q.q1.length) +
    kv('Inside free time', inFree) +
    kv('Storage running', storage, storage > 0) +
    kv('Storage + demurrage running', demurrage, demurrage > 0) +
    (unconfirmed ? kv('Arrived per status, date not confirmed', unconfirmed) : '') +
    (arr.summary && arr.summary.median !== '' ?
      kv('Median ATA to delivery', arr.summary.median + ' days (p75 ' + arr.summary.p75 + ')') : '') +
    (arr.summary && arr.summary.total ? kv('Shipments year to date', arr.summary.total) : '') +
    '</table>';
  if (cooNotes.length) {
    body += '<div style="background:#fff7e6;border-left:3px solid #b45309;padding:8px 10px;margin:8px 0;font-size:13px;">' +
            cooNotes.map(esc_).join('<br>') + '</div>';
  }
  body += sectionsHtml_([
    { key: 'q1', title: TITLES_.q1, items: coo.q1, note: '' },
    { key: 'q2', title: TITLES_.q2, items: coo.q2, note: '' },
    { key: 'q5b', title: TITLES_.q5b, items: coo.q5b, note: '' },
    { key: 'q5c', title: TITLES_.q5c, items: coo.q5c, note: '' },
    { key: 'q5a', title: TITLES_.q5a, items: coo.q5a, note: '' },
    { key: 'q4', title: TITLES_.q4, items: coo.q4, note: 'Ariel has these.' }
  ]);
  if (Q.q3.length) {
    body += section_('New job orders encoded', Q.q3.length + ' since the last report',
      table_(['JO','Client','Commodity','Mode','ETA'], Q.q3.map(function (r) {
        return ['<b>' + esc_(r.jo) + '</b>', esc_(r.client), esc_(r.commodity), esc_(r.mode),
                fmtDate_(r.eta) || 'no ETA'];
      })));
  }
  if (Q.untrusted.length) {
    body += section_('LogiSys ATA not used', 'ATA equals ETA and no post-arrival milestone — treated as not yet arrived.',
      table_(['JO','Client','ATA = ETA','Status'], Q.untrusted.map(function (s) {
        return ['<b>' + esc_(s.jo) + '</b>', esc_(s.client), fmtDate_(s.eta), esc_(s.status)];
      })));
  }
  if (arr.monthly) {
    const m = arr.monthly;
    body += section_('Monthly arrivals report generated', m.label,
      table_(['Register','Rows'], [['SEA FCL', m.fcl], ['SEA LCL', m.lcl],
                                   ['AIR', m.air], ['<b>Total</b>', '<b>' + m.total + '</b>']]));
  }

  var subject;
  if (cooJos.length) subject = subjectFor(cooJos.length, anyRed([coo.q1, coo.q2, coo.q5b, coo.q5c]));
  else if (Q.q3.length) subject = CONFIG.AGENT + ': ' + Q.q3.length + ' new job order' + (Q.q3.length === 1 ? '' : 's') + ' encoded';
  else if (arr.monthly) subject = CONFIG.AGENT + ': monthly arrivals report ready';
  else subject = CONFIG.AGENT + ': run notes';

  emails.push({ person: 'COO', to: R.coo, subject: subject, jos: cooJos,
                lines: linesOf(coo).concat(cooNotes), html: wrap_(body, '') });
  return emails;
}

/**
 * soul.md's self-check, as code. Returns a list of problems; any problem
 * means nothing is sent to anyone and the COO is told instead.
 */
function selfCheck_(emails, deliveredJos) {
  const R = CONFIG.RECIPIENTS;
  const allowed = [R.coo, R.support].concat(Object.keys(R.handlers).map(function (h) { return R.handlers[h]; }))
                    .filter(function (a) { return a; });
  const problems = [], seen = {};
  const forbidden = function (s) { return containsAny_(s, CONFIG.NEVER_CONTACT); };
  Object.keys(R.handlers).forEach(function (h) {
    if (forbidden(h)) problems.push('RECIPIENTS contains a person Penny never contacts: ' + h);
  });
  emails.forEach(function (e) {
    if (!/^(CRITICAL — )?Penny: /.test(e.subject)) problems.push('subject does not start with "Penny:" — ' + e.subject);
    if (seen[e.person]) problems.push(e.person + ' would receive two emails');
    seen[e.person] = true;
    if (!e.to || allowed.indexOf(e.to) === -1) problems.push('address not in RECIPIENTS: ' + e.to);
    if (forbidden(e.person)) problems.push('never-contact recipient: ' + e.person);
    e.jos.forEach(function (jo) {
      if (deliveredJos[jo]) problems.push(jo + ' is delivered (Nico\'s) but is in ' + e.person + '\'s email');
    });
  });
  return problems;
}

function sendAll_(emails, dry, say) {
  emails.forEach(function (e) {
    say('  -> ' + e.person + ' <' + e.to + '> ' + e.subject +
        (CONFIG.SHADOW_TO ? ' [shadow: goes to ' + CONFIG.SHADOW_TO + ']' : '') + (dry ? ' [dry]' : ''));
    if (dry) e.lines.forEach(function (l) { say('       ' + l); });
    else sendTo_(e.to, e.subject, e.html, e.person);
  });
  return emails.length;
}
