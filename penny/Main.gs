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
 *  before the importer exists. Safe to run more than once. */
function bootstrapFeedSheets() {
  const ss = feedBook_();
  [CONFIG.SHEET_LIVE, CONFIG.SHEET_ARCHIVE].forEach(function (name) {
    const sh = ownSheet_(ss, name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, FEED_HEADERS.length).setValues([FEED_HEADERS])
        .setFontWeight('bold');
      sh.setFrozenRows(1);
      Logger.log('Created "%s" with %s headers', name, FEED_HEADERS.length);
    } else {
      Logger.log('"%s" already has data — left untouched', name);
    }
  });
}

/** ---------------- the run ---------------- */
function execute_(dry) {
  const now = new Date();
  const log = [];
  function say(s) { log.push(s); Logger.log(s); }

  // Monday to Friday only
  if (isWeekend_(now) && !dry) { say('Weekend — nothing sent.'); return log.join('\n'); }

  var feed, ss;
  try {
    feed = loadFeed_();
    ss = feed.ss;
  } catch (e) {
    return fail_(dry, 'Penny could not read the feed', e.message, log);
  }

  // Freshness gate — never run on stale data without saying so
  const stale = stalenessOfFeed_(feed.rows);
  if (stale) {
    const msg = 'No pending checks ran today. ' + stale + '.';
    say('FEED STALE: ' + msg);
    if (!dry) {
      sendTo_(CONFIG.RECIPIENTS.coo,
        CONFIG.AGENT + ': LogiSys feed not received',
        wrap_('<h2 style="margin:0 0 8px;font-size:17px;">LogiSys feed missing</h2>' +
              '<p>' + esc_(msg) + '</p><p>Penny sent nothing to anyone this morning.</p>',
              ''));
    }
    return log.join('\n');
  }

  const hmap = handlerMap_();
  const prev = previousEtas_(ss);
  const Q = buildQueues_(feed.rows, hmap, prev);
  Q.q3 = newJos_(feed.rows, prev);

  say('Feed rows: ' + feed.rows.length);
  say('Q1 arrived-not-delivered: ' + Q.q1.length +
      ' (red+ ' + Q.q1.filter(function (x) { return x.sev === 'red' || x.sev === 'critical'; }).length + ')');
  say('Q2 arriving soon: ' + Q.q2.length);
  say('Q3 new JOs: ' + Q.q3.length);
  say('Q4 stale status: ' + Q.q4.length);
  say('Q5a no ETA: ' + Q.q5a.length +
      ' | Q5b ETA changed: ' + Q.q5b.length + (prev.available ? '' : ' (no prior report — skipped)') +
      ' | Q5c ETA passed: ' + Q.q5c.length);
  say('Date defects: ' + Q.defects.length);

  // ---------- arrivals record (Penny's own sheet) ----------
  var arr = null, monthly = null;
  try {
    const ships = allShipmentsYtd_(ss, now.getFullYear());
    if (!dry) arr = updateArrivals_(ss, ships, now.getFullYear());
    else arr = { total: ships.length, note: 'dry run — not written' };
    say('Arrivals YTD: ' + ships.length + ' shipments');

    if (now.getDate() === CONFIG.MONTHLY_REPORT_DAY) {
      const m = now.getMonth();                       // report the month just ended
      const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const mn = m === 0 ? 12 : m;
      if (!dry) monthly = buildMonthlyReport_(ss, allShipmentsYtd_(ss, y), y, mn);
      say('Monthly report: ' + (monthly ? monthly.label + ' (' + monthly.total + ' rows)' : 'due today'));
    }
  } catch (e) {
    say('Arrivals step failed: ' + e.message);
  }

  // ---------- compose and send ----------
  const sent = dispatch_(Q, arr, monthly, dry, say);
  say('Emails ' + (dry ? 'that would be sent' : 'sent') + ': ' + sent);
  return log.join('\n');
}

function fail_(dry, subject, detail, log) {
  log.push('FAILURE: ' + subject + ' — ' + detail);
  Logger.log(log[log.length - 1]);
  if (!dry) {
    sendTo_(CONFIG.RECIPIENTS.coo, CONFIG.AGENT + ': ' + subject,
      wrap_('<h2 style="margin:0 0 8px;font-size:17px;">' + esc_(subject) + '</h2>' +
            '<pre style="white-space:pre-wrap;font-size:12px;">' + esc_(detail) + '</pre>' +
            '<p>Penny stopped and sent nothing else.</p>', ''));
  }
  return log.join('\n');
}

function sendTo_(to, subject, html) {
  if (!to) return false;
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html });
  return true;
}

/** One email per person. Nothing for a person with nothing to act on. */
function dispatch_(Q, arr, monthly, dry, say) {
  const R = CONFIG.RECIPIENTS;
  var count = 0;
  const unroutable = { q1: [], q2: [], q5b: [], q5c: [] };

  // ---- handlers: q1, q2, q5b, q5c (theirs only) ----
  const byHandler = {};
  function bucket(key, items) {
    items.forEach(function (s) {
      if (s.sev === 'green') return;
      const h = s.handler;
      const addr = h && R.handlers[h];
      if (!h || !addr) { unroutable[key].push(s); return; }
      byHandler[h] = byHandler[h] || { q1: [], q2: [], q5b: [], q5c: [] };
      byHandler[h][key].push(s);
    });
  }
  bucket('q1', Q.q1); bucket('q2', Q.q2); bucket('q5b', Q.q5b); bucket('q5c', Q.q5c);

  Object.keys(byHandler).forEach(function (h) {
    const b = byHandler[h];
    const n = b.q1.length + b.q2.length + b.q5b.length + b.q5c.length;
    if (!n) return;
    const worst = [b.q1, b.q2, b.q5b, b.q5c].reduce(function (acc, arr2) {
      arr2.forEach(function (s) {
        if (s.sev === 'critical') acc = 'critical';
        else if (s.sev === 'red' && acc !== 'critical') acc = 'red';
        else if (acc === 'green') acc = 'amber';
      });
      return acc;
    }, 'green');
    const crit = (worst === 'critical' || worst === 'red');
    const subject = (crit ? 'CRITICAL — ' : '') + CONFIG.AGENT + ': ' +
                    n + ' shipment' + (n === 1 ? '' : 's') + ' need action';
    const html = wrap_(
      '<h2 style="margin:0 0 2px;font-size:17px;">Good morning, ' + esc_(h.split(' ')[0]) + '</h2>' +
      '<div style="color:#5b6b60;font-size:12px;">' + fmtDateLong_(today_()) + '</div>' +
      section_('Arrived, not yet delivered',
        'Storage is free for ' + CONFIG.STORAGE_FREE_DAYS + ' days, demurrage for ' +
        CONFIG.DEMURRAGE_FREE_DAYS + '.', q1Html_(b.q1)) +
      section_('Arriving within ' + CONFIG.Q2_ETA_WINDOW + ' days', '', q2Html_(b.q2)) +
      section_('ETA changed', 'Your plan may need adjusting.', q5bHtml_(b.q5b)) +
      section_('ETA passed, no arrival recorded', '', q5cHtml_(b.q5c)),
      '');
    if (!dry) sendTo_(R.handlers[h], subject, html);
    say('  -> ' + h + ' (' + n + ' items) ' + (dry ? '[dry]' : 'sent'));
    count++;
  });

  // ---- Ariel: q4 stale, q5a no ETA ----
  const ariel = { q4: Q.q4, q5a: Q.q5a.filter(function (s) { return s.sev !== 'green'; }) };
  if (ariel.q4.length + ariel.q5a.length) {
    const n = ariel.q4.length + ariel.q5a.length;
    const subject = CONFIG.AGENT + ': ' + n + ' shipment' + (n === 1 ? '' : 's') + ' need encoding';
    const html = wrap_(
      '<h2 style="margin:0 0 2px;font-size:17px;">Good morning, Ariel</h2>' +
      '<div style="color:#5b6b60;font-size:12px;">' + fmtDateLong_(today_()) + '</div>' +
      section_('No ETA recorded yet', 'These cannot be planned until an ETA is in LogiSys.',
               q5aHtml_(ariel.q5a)) +
      section_('Status not updated in ' + CONFIG.Q4_STALE_RED + '+ days', '', q4Html_(ariel.q4)),
      '');
    const to = R.support || R.coo;
    if (!dry) sendTo_(to, subject + (R.support ? '' : ' [Ariel address not set]'), html);
    say('  -> Ariel (' + n + ' items) ' + (dry ? '[dry]' : 'sent to ' + to));
    count++;
  }

  // ---- COO: everything ----
  const cooCount = Q.q1.filter(function (s) { return s.sev !== 'green'; }).length +
                   Q.q2.length + Q.q3.length + Q.q4.length +
                   Q.q5a.length + Q.q5b.length + Q.q5c.length;
  const anyRed = Q.q1.some(function (s) { return s.sev === 'red' || s.sev === 'critical'; }) ||
                 Q.q5b.some(function (s) { return s.sev === 'red'; }) ||
                 Q.q5c.some(function (s) { return s.sev === 'red'; });
  if (cooCount || arr) {
    const inFree = Q.q1.filter(function (s) { return !s.storageRunning; }).length;
    const running = Q.q1.filter(function (s) { return s.storageRunning; }).length;
    var head = '<h2 style="margin:0 0 2px;font-size:17px;">Pending shipments — ' +
               fmtDateLong_(today_()) + '</h2>';
    var kpi = '<table role="presentation" style="border-collapse:collapse;margin:12px 0;font-size:13px;">' +
      '<tr><td style="padding:4px 18px 4px 0;">Arrived, not delivered</td><td><b>' + Q.q1.length + '</b></td></tr>' +
      '<tr><td style="padding:4px 18px 4px 0;">Inside free time</td><td><b>' + inFree + '</b></td></tr>' +
      '<tr><td style="padding:4px 18px 4px 0;color:#b91c1c;">Storage already running</td><td><b style="color:#b91c1c;">' + running + '</b></td></tr>' +
      (arr && arr.median !== '' && arr.median !== undefined ?
        '<tr><td style="padding:4px 18px 4px 0;">Median ATA to delivery</td><td><b>' + arr.median + ' days</b></td></tr>' : '') +
      (arr && arr.total ? '<tr><td style="padding:4px 18px 4px 0;">Shipments year to date</td><td><b>' + arr.total + '</b></td></tr>' : '') +
      '</table>';
    var body = head + kpi +
      section_('Arrived, not yet delivered', '', q1Html_(Q.q1.filter(function (s) { return s.sev !== 'green'; }))) +
      section_('Arriving within ' + CONFIG.Q2_ETA_WINDOW + ' days', '', q2Html_(Q.q2)) +
      section_('ETA changed', '', q5bHtml_(Q.q5b)) +
      section_('ETA passed, no arrival', '', q5cHtml_(Q.q5c)) +
      section_('No ETA recorded', '', q5aHtml_(Q.q5a)) +
      section_('Stale status', '', q4Html_(Q.q4));

    if (Q.q3.length) {
      body += section_('New job orders encoded', Q.q3.length + ' since the last report',
        table_(['JO','Client','Commodity','Mode','ETA'], Q.q3.map(function (r) {
          return ['<b>' + esc_(norm_(r['JO Number'])) + '</b>', esc_(norm_(r['Client'])),
                  esc_(norm_(r['Commodity'])), esc_(modeOf_(r)),
                  fmtDate_(validDate_(r['ETA'])) || 'no ETA'];
        })));
    }
    if (monthly) {
      body += section_('Monthly arrivals report generated', monthly.label,
        table_(['Register','Rows'], [['SEA FCL', monthly.fcl], ['SEA LCL', monthly.lcl],
                                     ['AIR', monthly.air], ['<b>Total</b>', '<b>' + monthly.total + '</b>']]));
    }
    // data gaps
    const gaps = [];
    Q.defects.forEach(function (d) {
      gaps.push([esc_(d.jo), esc_(d.client), esc_(d.field), esc_(d.value)]);
    });
    ['q1','q2','q5b','q5c'].forEach(function (k) {
      unroutable[k].forEach(function (s) {
        gaps.push([esc_(s.jo), esc_(s.client), 'Account Handler', 'not set — could not route']);
      });
    });
    if (gaps.length) body += section_('Data gaps', 'Not used in any calculation.',
      table_(['JO','Client','Field','Value'], gaps));

    const subject = (anyRed ? 'CRITICAL — ' : '') + CONFIG.AGENT +
                    ': ' + Q.q1.length + ' pending, ' + running + ' accruing charges';
    if (!dry) sendTo_(R.coo, subject, wrap_(body, ''));
    say('  -> COO ' + (dry ? '[dry]' : 'sent'));
    count++;
  }

  return count;
}
