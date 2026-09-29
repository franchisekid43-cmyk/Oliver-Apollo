/**
 * penny_tests.js — runs Penny's logic under Node with the Apps Script
 * services stubbed. Not needed in production; it exists so any change can
 * be re-verified before it goes live.
 *
 *   node penny_tests.js            (from the penny/ folder)
 *
 * Every test builds a fake LogiSys Live / Archive / CA Tracker, runs the real
 * .gs code, and checks what would have been emailed and written.
 */
process.env.TZ = 'Asia/Manila';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = process.argv[2] || __dirname;
const FILES = ['Config.gs', 'Lib.gs', 'Queues.gs', 'Arrivals.gs', 'Email.gs', 'Main.gs'];

// ------------------------------------------------------------------ clock
const RealDate = Date;
let NOW = new RealDate(2026, 8, 28, 7, 45).getTime();          // Mon 28 Sep 2026 07:45
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
function setNow(y, m, d, h, mi) { NOW = new RealDate(y, m - 1, d, h || 7, mi || 45).getTime(); }
function D(y, m, d, h, mi) { return new FakeDate(y, m - 1, d, h || 0, mi || 0); }
function daysAgo(n) {
  const t = new FakeDate(NOW); return new FakeDate(t.getFullYear(), t.getMonth(), t.getDate() - n);
}
function daysAhead(n) { return daysAgo(-n); }

// ------------------------------------------------------------ fake sheets
class FakeSheet {
  constructor(book, name, rows) { this.book = book; this.name = name; this.rows = rows || []; this.writes = 0; }
  getName() { return this.name; }
  getParent() { return this.book; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((w, r) => Math.max(w, r.length), 0); }
  getDataRange() {
    const w = this.getLastColumn();
    const self = this;
    return { getValues: () => self.rows.map(r => { const c = r.slice(); while (c.length < w) c.push(''); return c; }) };
  }
  getRange(r, c, nr, nc) {
    const self = this;
    const rng = {
      setValues(v) {
        self.writes++;
        for (let i = 0; i < v.length; i++) {
          while (self.rows.length < r + i) self.rows.push([]);
          const row = self.rows[r - 1 + i];
          for (let j = 0; j < v[i].length; j++) row[c - 1 + j] = v[i][j];
        }
        return rng;
      },
      setValue(x) { return rng.setValues([[x]]); },
      setFontWeight() { self.writes++; return rng; },
      getValues() { return self.getDataRange().getValues().slice(r - 1, r - 1 + (nr || 1)); }
    };
    return rng;
  }
  clear() { this.writes++; this.rows = []; }
  clearContents() { this.clear(); }
  setFrozenRows() { this.writes++; }
  appendRow(r) { this.writes++; this.rows.push(r); }
}
class FakeBook {
  constructor(name, id) { this.name = name; this.id = id; this.sheets = {}; }
  getName() { return this.name; }
  getId() { return this.id; }
  getSheetByName(n) { return this.sheets[n] || null; }
  getSheets() { return Object.values(this.sheets); }
  insertSheet(n) { this.sheets[n] = new FakeSheet(this, n); this.sheets[n].created = true; return this.sheets[n]; }
  add(n, rows) { this.sheets[n] = new FakeSheet(this, n, rows); return this.sheets[n]; }
}

const LIVE_HEADERS = [
  'JO Number', 'FSA Number', 'BL/AWB', 'House BL/AWB', 'Shipper', 'Client',
  'Mode', 'Cargo Type', 'Loading Port', 'Discharge Port', 'Place Of Receipt',
  'Place Of Delivery', 'Shipment Date', 'ETD', 'ATD', 'ETA', 'ATA',
  'Containers 20ft', 'Containers 40ft', 'Containers 45ft', 'Container Nos',
  'Total Packages', 'Unit', 'Goods Description', 'Airline', 'Flight No',
  'Status', 'Stage', 'Delivered', 'Account Handler', 'Last Updated', 'Source Report Date',
  'Completed Milestone Date', 'Job Completed On'
];
function toRow(o) { return LIVE_HEADERS.map(h => (h in o ? o[h] : '')); }

/** One shipment, with sensible defaults. Source Report Date = today. */
function ship(o) {
  return Object.assign({
    'JO Number': 'IMP0926-0001', 'Client': 'ACME TRADING', 'Mode': 'Sea',
    'Cargo Type': 'FCL', 'Status': 'Vessel One Departed', 'Account Handler': 'Kim Angelu Kong',
    'Last Updated': daysAgo(1), 'Source Report Date': daysAgo(0),
    'ETD': daysAgo(10), 'Loading Port': 'SHANGHAI'
  }, o);
}

// ---------------------------------------------------------------- the world
let W;
function world(opts) {
  opts = opts || {};
  const feed = new FakeBook('Philindo Feed', 'FEED');
  feed.add('LogiSys Live', [LIVE_HEADERS].concat((opts.live || []).map(toRow)));
  if (opts.archive !== null) {
    feed.add('LogiSys Archive', [LIVE_HEADERS].concat((opts.archive || []).map(toRow)));
  }
  (opts.sheets || []).forEach(n => feed.add(n, [['existing']]));
  const ca = new FakeBook('USE THIS FILE Philindo_CA_Tracker', '1YGG27KbsZUalEI-UekGk4nUnq3yttMM9w6kGo1-gSc8');
  const caHead = ['Job Order Number', 'Date', 'Requested By', 'Release Status', 'Balance Remaining to Release'];
  ca.add('CA Tracker', [['Philindo CA Tracker'], caHead].concat((opts.ca || []).map(c =>
    [c.jo, '', c.by || '', c.status || '', c.balance || ''])));

  const mail = [];
  const logs = [];
  const triggers = [];
  const ctx = {
    Date: FakeDate, Math, JSON, Object, Array, String, Number, RegExp, Error, TypeError, isNaN,
    console,
    Logger: { log: function () { logs.push(Array.prototype.slice.call(arguments).join(' ')); } },
    MailApp: { sendEmail: m => mail.push(m) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => feed,
      openById: id => {
        if (id === ca.id) { if (opts.caBroken) throw new Error('No access'); return ca; }
        if (id === 'FEED') return feed;
        throw new Error('unknown id ' + id);
      }
    },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: fn => {
        const t = { fn, getHandlerFunction: () => fn };
        const chain = { timeBased: () => chain, atHour: h => { t.h = h; return chain; },
          nearMinute: m => { t.m = m; return chain; }, everyDays: () => chain,
          inTimezone: z => { t.tz = z; return chain; }, create: () => { triggers.push(t); return t; } };
        return chain;
      }
    },
    Utilities: { formatDate: fmt },
    Session: { getEffectiveUser: () => ({ getEmail: () => opts.user || 'ops.philindo@gmail.com' }),
               getScriptTimeZone: () => opts.tz || 'Asia/Manila' }
  };
  vm.createContext(ctx);
  const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n;\n');
  vm.runInContext(src, ctx, { filename: 'penny.gs' });
  vm.runInContext('CONFIG.SHADOW_TO = ' + JSON.stringify(opts.shadow || ''), ctx);   // tests check real routing
  vm.runInContext('CONFIG.TEAM_EMAILS = ' + (opts.team === false ? 'false' : 'true'), ctx);
  vm.runInContext('CONFIG.ARIEL_REMINDER = ' + (opts.arielAt10 ? 'true' : 'false'), ctx);
  if (opts.config) opts.config(vm.runInContext('CONFIG', ctx));
  W = { ctx, feed, ca, mail, logs, triggers,
        run: fn => vm.runInContext(fn, ctx),
        CONFIG: vm.runInContext('CONFIG', ctx) };
  return W;
}

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function fmt(d, tz, p) {
  const pad = n => ('0' + n).slice(-2);
  return p.replace(/yyyy|MMMM|MMM|MM|dd|d|EEEE|EEE|HH|mm/g, t => ({
    yyyy: String(d.getFullYear()).padStart(4, '0'), MMMM: MONL[d.getMonth()], MMM: MON[d.getMonth()],
    MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), d: String(d.getDate()),
    EEEE: DAYL[d.getDay()], EEE: DAYL[d.getDay()].slice(0, 3), HH: pad(d.getHours()), mm: pad(d.getMinutes())
  })[t]);
}

// ------------------------------------------------------------ assertions
let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '\n         ' + detail : '')); }
}
function test(title, fn) {
  console.log('\n' + title);
  try { fn(); } catch (e) { failed++; console.log('  FAIL threw: ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n         ')); }
}
function runQueues(opts) {
  world(opts);
  return W.run(`(function(){
    const f = loadFeed_(); const prev = previousEtas_(f.ss);
    const Q = buildQueues_(f.rows, handlerMap_(), prev); Q.q3 = newJos_(f.rows, prev); return Q; })()`);
}
function sevOf(Q, key, jo) { const x = Q[key].find(s => s.jo === jo); return x ? x.sev : 'none'; }
const to = addr => W.mail.filter(m => m.to === addr);
const COO = 'transport@philindo.com.ph';
const KIM = 'kimkong@philindo.com.ph';
const ARIEL = 'arielcaingcoy@philindo.com.ph';

// =================================================================== TESTS

test('Queue 1 ladder — amber 2, red 4, critical 6 (storage free 5, demurrage free 7)', () => {
  const live = [1, 3, 4, 6, 8].map(n => ship({ 'JO Number': 'IMP-D' + n, 'ATA': daysAgo(n), 'ETA': daysAgo(n + 1), 'Status': 'Container Discharged' }));
  const Q = runQueues({ live });
  check('day 1 is silent (green)', ['green', 'none'].includes(sevOf(Q, 'q1', 'IMP-D1')), sevOf(Q, 'q1', 'IMP-D1'));
  check('day 3 is amber', sevOf(Q, 'q1', 'IMP-D3') === 'amber', sevOf(Q, 'q1', 'IMP-D3'));
  check('day 4 is red (2 days before storage)', sevOf(Q, 'q1', 'IMP-D4') === 'red', sevOf(Q, 'q1', 'IMP-D4'));
  check('day 6 is critical (storage running)', sevOf(Q, 'q1', 'IMP-D6') === 'critical', sevOf(Q, 'q1', 'IMP-D6'));
  check('day 8 is critical (demurrage running)', sevOf(Q, 'q1', 'IMP-D8') === 'critical', sevOf(Q, 'q1', 'IMP-D8'));
  const d4 = Q.q1.find(s => s.jo === 'IMP-D4');
  check('day 4 shows storage in 2 days, demurrage in 4', d4 && d4.daysToStorage === 2 && d4.daysToDemurrage === 4,
    d4 && JSON.stringify([d4.daysToStorage, d4.daysToDemurrage]));
});

test('Free-time constants drive the queue 1 thresholds', () => {
  world({ config: c => { c.STORAGE_FREE_DAYS = 3; } });
  const t = W.run('q1Thresholds_()');
  check('storage 3 days -> red on day 2, critical on day 4', t && t.red === 2 && t.critical === 4, JSON.stringify(t));
  world({});
  const t2 = W.run('q1Thresholds_()');
  check('red sits two days ahead of the first charge', t2.critical - t2.red === 2 && t2.critical === 6, JSON.stringify(t2));
});

test('Unilab air — red at 73 hours, not at 71', () => {
  const at = h => new FakeDate(NOW - h * 3600000);
  const live = [
    ship({ 'JO Number': 'AIMP-U73', 'Client': 'UNILAB INC. ', 'Mode': 'Air', 'ATA': at(73), 'ETA': daysAgo(5), 'Status': 'Container Discharged' }),
    ship({ 'JO Number': 'AIMP-U71', 'Client': 'Unilab Inc.', 'Mode': 'Air', 'ATA': at(71), 'ETA': daysAgo(5), 'Status': 'Container Discharged' })
  ];
  const Q = runQueues({ live });
  check('73h is red', ['red', 'critical'].includes(sevOf(Q, 'q1', 'AIMP-U73')), sevOf(Q, 'q1', 'AIMP-U73'));
  check('71h is not red', !['red', 'critical'].includes(sevOf(Q, 'q1', 'AIMP-U71')), sevOf(Q, 'q1', 'AIMP-U71'));
});

test('ETA watch 5b — earlier is worse than later', () => {
  const prevDay = daysAgo(1);
  const base = { 'Status': 'Vessel One Departed', 'ETD': daysAgo(3) };
  const prev = [
    ship(Object.assign({ 'JO Number': 'E-2EARLY', 'ETA': daysAhead(10), 'Source Report Date': prevDay }, base)),
    ship(Object.assign({ 'JO Number': 'E-2LATE', 'ETA': daysAhead(10), 'Source Report Date': prevDay }, base)),
    ship(Object.assign({ 'JO Number': 'E-5LATE', 'ETA': daysAhead(10), 'Source Report Date': prevDay }, base)),
    ship(Object.assign({ 'JO Number': 'E-1', 'ETA': daysAhead(10), 'Source Report Date': prevDay }, base)),
    ship(Object.assign({ 'JO Number': 'E-GONE', 'ETA': daysAhead(10), 'Source Report Date': prevDay }, base))
  ];
  const live = [
    ship(Object.assign({ 'JO Number': 'E-2EARLY', 'ETA': daysAhead(8) }, base)),
    ship(Object.assign({ 'JO Number': 'E-2LATE', 'ETA': daysAhead(12) }, base)),
    ship(Object.assign({ 'JO Number': 'E-5LATE', 'ETA': daysAhead(15) }, base)),
    ship(Object.assign({ 'JO Number': 'E-1', 'ETA': daysAhead(11) }, base)),
    ship(Object.assign({ 'JO Number': 'E-GONE', 'ETA': '' }, base))
  ];
  const Q = runQueues({ live, archive: prev });
  check('2 days earlier is red', sevOf(Q, 'q5b', 'E-2EARLY') === 'red', sevOf(Q, 'q5b', 'E-2EARLY'));
  check('2 days later is amber', sevOf(Q, 'q5b', 'E-2LATE') === 'amber', sevOf(Q, 'q5b', 'E-2LATE'));
  check('5 days later is red', sevOf(Q, 'q5b', 'E-5LATE') === 'red', sevOf(Q, 'q5b', 'E-5LATE'));
  check('1 day movement is silent', sevOf(Q, 'q5b', 'E-1') === 'none', sevOf(Q, 'q5b', 'E-1'));
  const gone = Q.q5b.find(s => s.jo === 'E-GONE');
  check('ETA removed is red and flagged removed', gone && gone.sev === 'red' && gone.removed === true);
  const in5 = jo => ['q5a', 'q5b', 'q5c'].filter(k => Q[k].some(s => s.jo === jo)).length;
  check('ETA removed appears in only one of 5a/5b/5c', in5('E-GONE') === 1, 'appears in ' + in5('E-GONE'));
});

test('Archive is a change log — an ETA last archived days ago still counts as "previous"', () => {
  const archive = [
    ship({ 'JO Number': 'CL-1', 'ETA': daysAhead(10), 'Source Report Date': daysAgo(4) }),   // unchanged since
    ship({ 'JO Number': 'CL-2', 'ETA': daysAhead(10), 'Source Report Date': daysAgo(4) }),
    ship({ 'JO Number': 'CL-2', 'ETA': daysAhead(12), 'Source Report Date': daysAgo(2) })    // later state wins
  ];
  const live = [ship({ 'JO Number': 'CL-1', 'ETA': daysAhead(7) }), ship({ 'JO Number': 'CL-2', 'ETA': daysAhead(12) })];
  const Q = runQueues({ live, archive });
  check('ETA 3 days earlier than the last archived state is red', sevOf(Q, 'q5b', 'CL-1') === 'red');
  check('compared against the JO\'s LATEST earlier state, not its first', sevOf(Q, 'q5b', 'CL-2') === 'none');
  check('neither is "new"', Q.q3.length === 0);
});

test('First run — no prior report means no 5b and no queue 3', () => {
  const live = [ship({ 'JO Number': 'F-1', 'ETA': daysAhead(9) }), ship({ 'JO Number': 'F-2', 'ETA': daysAhead(12) })];
  const Q = runQueues({ live, archive: [] });
  check('5b produces zero notices', Q.q5b.length === 0);
  check('queue 3 is empty rather than listing every JO as new', Q.q3.length === 0);
});

test('Queue 3 — new job orders since the previous report', () => {
  const prev = [ship({ 'JO Number': 'N-OLD', 'ETA': daysAhead(9), 'Source Report Date': daysAgo(1) })];
  const live = [ship({ 'JO Number': 'N-OLD', 'ETA': daysAhead(9) }), ship({ 'JO Number': 'N-NEW', 'ETA': daysAhead(9) })];
  const Q = runQueues({ live, archive: prev });
  check('only the new JO is listed', Q.q3.length === 1 && (Q.q3[0].jo || Q.q3[0]['JO Number']) === 'N-NEW');
});

test('Queue 4 — stale at 8 days, not at 7', () => {
  const live = [
    ship({ 'JO Number': 'S-7', 'Last Updated': daysAgo(7), 'ETA': daysAhead(9) }),
    ship({ 'JO Number': 'S-8', 'Last Updated': daysAgo(8), 'ETA': daysAhead(9) })
  ];
  const Q = runQueues({ live });
  check('7 days — no stale notice', !Q.q4.some(s => s.jo === 'S-7'));
  check('8 days — stale notice', Q.q4.some(s => s.jo === 'S-8'));
});

test('Queue 5a — no ETA recorded, severity from ETD', () => {
  const live = [
    ship({ 'JO Number': 'A-BLANK', 'ETA': '', 'ETD': '' }),
    ship({ 'JO Number': 'A-FUT', 'ETA': '', 'ETD': daysAhead(3) }),
    ship({ 'JO Number': 'A-2', 'ETA': '', 'ETD': daysAgo(2) }),
    ship({ 'JO Number': 'A-4', 'ETA': '', 'ETD': daysAgo(4) })
  ];
  const Q = runQueues({ live });
  check('ETA blank + ETD blank produces no notice (pre-booking)', !['q5a','q5b','q5c','q4','q1','q2'].some(k => Q[k].some(s => s.jo === 'A-BLANK')));
  check('ETD in the future is silent', sevOf(Q, 'q5a', 'A-FUT') === 'none');
  check('ETD passed 2 days is amber', sevOf(Q, 'q5a', 'A-2') === 'amber');
  check('ETD passed 4 days is red', sevOf(Q, 'q5a', 'A-4') === 'red');
});

test('Ariel is not copied on red 5c — the handler has it', () => {
  world({ live: [ship({ 'JO Number': 'C-RED', 'ETA': daysAgo(4) })] });
  W.run('runPenny()');
  check('handler receives it', to(KIM).some(m => /C-RED/.test(m.htmlBody)));
  check('Ariel receives nothing', to(ARIEL).length === 0);
});

test('Queue 5c — ETA passed, no arrival', () => {
  const live = [ship({ 'JO Number': 'C-1', 'ETA': daysAgo(1) }), ship({ 'JO Number': 'C-3', 'ETA': daysAgo(3) })];
  const Q = runQueues({ live });
  check('1 day past ETA is amber', sevOf(Q, 'q5c', 'C-1') === 'amber');
  check('3 days past ETA is red', sevOf(Q, 'q5c', 'C-3') === 'red');
});

test('Queue 2 — cash advance funding has three states', () => {
  const live = [
    ship({ 'JO Number': 'T-NOT', 'ETA': daysAhead(1) }),
    ship({ 'JO Number': 'T-PART', 'ETA': daysAhead(1) }),
    ship({ 'JO Number': 'T-FULL', 'ETA': daysAhead(1) }),
    ship({ 'JO Number': 'T-FAR', 'ETA': daysAhead(3) })
  ];
  const ca = [{ jo: 'T-NOT', status: 'Not Released' }, { jo: 'T-PART', status: 'Partially Released', balance: 15000 },
              { jo: 'T-FULL', status: 'Released' }, { jo: 'T-FAR', status: 'Not Released' }];
  const Q = runQueues({ live, ca });
  check('"Not Released" arriving tomorrow is red (not matched as "released")', sevOf(Q, 'q2', 'T-NOT') === 'red');
  check('partial release arriving tomorrow is amber, not red', sevOf(Q, 'q2', 'T-PART') === 'amber');
  check('unfunded but 3 days out is amber', sevOf(Q, 'q2', 'T-FAR') === 'amber');
});

test('A JO is in at most one of queues 1-2', () => {
  const live = [ship({ 'JO Number': 'X-1', 'ATA': daysAgo(3), 'ETA': daysAgo(4), 'Status': 'Container Discharged' })];
  const Q = runQueues({ live });
  check('arrived shipment is not also "arriving soon"', Q.q1.some(s => s.jo === 'X-1') && !Q.q2.some(s => s.jo === 'X-1'));
});

test('Delivered shipments appear nowhere (handoff to Nico)', () => {
  const live = [
    ship({ 'JO Number': 'DLV-STATUS', 'ATA': daysAgo(9), 'ETA': daysAgo(10), 'Status': 'Delivery Advised to Client' }),
    ship({ 'JO Number': 'DLV-FLAG', 'ATA': daysAgo(9), 'ETA': daysAgo(10), 'Status': 'Gatepass Released', 'Delivered': daysAgo(2) }),
    ship({ 'JO Number': 'DLV-NOATA', 'ETA': daysAgo(9), 'Status': 'Job Completed' }),
    ship({ 'JO Number': 'PEND-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })
  ];
  world({ live, archive: [ship({ 'JO Number': 'PEND-1', 'ETA': daysAgo(6), 'Source Report Date': daysAgo(1) })] });
  W.run('runPenny()');
  const all = W.mail.map(m => m.htmlBody).join('\n');
  check('some email was sent (PEND-1 is red)', W.mail.length > 0);
  check('no email mentions a delivered JO', !/DLV-/.test(all));
});

test('Stale feed — one email, to the COO only', () => {
  const live = [ship({ 'JO Number': 'OLD-1', 'ATA': daysAgo(9), 'ETA': daysAgo(10), 'Source Report Date': daysAgo(1), 'Status': 'DO Issued' })];
  world({ live });
  W.run('runPenny()');
  check('exactly one email', W.mail.length === 1, W.mail.map(m => m.to + ' ' + m.subject).join(' | '));
  check('it goes to the COO', W.mail[0] && W.mail[0].to === COO);
  check('subject is "Penny: LogiSys feed for [date] not received"',
    W.mail[0] && /^Penny: LogiSys feed for 28 Sep 2026 not received$/.test(W.mail[0].subject), W.mail[0] && W.mail[0].subject);
});

test('Weekends send nothing', () => {
  const live = [ship({ 'JO Number': 'W-1', 'ATA': daysAgo(9), 'ETA': daysAgo(10), 'Status': 'DO Issued' })];
  setNow(2026, 9, 26); world({ live: [ship({ 'JO Number': 'W-1', 'ATA': daysAgo(9), 'Status': 'DO Issued' })] }); W.run('runPenny()');
  check('Saturday: no email', W.mail.length === 0);
  setNow(2026, 9, 27); world({ live: [ship({ 'JO Number': 'W-1', 'ATA': daysAgo(9), 'Status': 'DO Issued' })] }); W.run('runPenny()');
  check('Sunday: no email', W.mail.length === 0);
  setNow(2026, 9, 28);
});

test('Silence is the reward', () => {
  const live = [
    ship({ 'JO Number': 'G-1', 'Account Handler': 'Jena Lucido', 'ATA': daysAgo(1), 'ETA': daysAgo(2), 'Status': 'Container Discharged' }),
    ship({ 'JO Number': 'G-2', 'Account Handler': 'Jena Lucido', 'ETA': daysAhead(9) })
  ];
  world({ live, sheets: ['Penny Monthly Aug 2026 — AIR'],     // August report already done
          archive: [ship({ 'JO Number': 'G-1', 'Source Report Date': daysAgo(1) }), ship({ 'JO Number': 'G-2', 'ETA': daysAhead(9), 'Source Report Date': daysAgo(1) })] });
  W.run('runPenny()');
  check('handler with only green shipments gets no email', to('jenalucido@philindo.com.ph').length === 0);
  check('COO gets nothing on an all-green morning', to(COO).length === 0, W.mail.map(m => m.to + ': ' + m.subject).join(' | '));
});

test('Routing, subjects and recipients', () => {
  const live = [
    ship({ 'JO Number': 'R-KIM', 'ATA': daysAgo(4), 'ETA': daysAgo(5), 'Status': 'DO Issued' }),
    ship({ 'JO Number': 'R-KIM2', 'ETA': daysAhead(2) }),
    ship({ 'JO Number': 'R-ANDREW', 'Account Handler': 'Andrew Mausig', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' }),
    ship({ 'JO Number': 'R-NONE', 'Account Handler': '', 'ATA': daysAgo(3), 'ETA': daysAgo(4), 'Status': 'DO Issued' }),
    ship({ 'JO Number': 'R-CA', 'Account Handler': '', 'ATA': daysAgo(3), 'ETA': daysAgo(4), 'Status': 'DO Issued' }),
    ship({ 'JO Number': 'R-STALE', 'Last Updated': daysAgo(12), 'ETA': daysAhead(9) })
  ];
  world({ live, ca: [{ jo: 'R-CA', by: 'JENA LUCIDO' }] });
  W.run('runPenny()');
  const people = W.mail.map(m => m.to);
  check('Kim receives exactly one email with both her shipments', to(KIM).length === 1 && /R-KIM\b/.test(to(KIM)[0].htmlBody) && /R-KIM2/.test(to(KIM)[0].htmlBody));
  check('Kim\'s email contains nobody else\'s shipments', to(KIM).length === 1 && !/R-ANDREW|R-NONE|R-CA|R-STALE/.test(to(KIM)[0].htmlBody));
  check('handler falls back to CA Tracker "Requested By" (case-insensitive)', to('jenalucido@philindo.com.ph').some(m => /R-CA/.test(m.htmlBody)));
  check('no handler anywhere -> COO, noted "No account handler set"', to(COO).length === 1 && /R-NONE/.test(to(COO)[0].htmlBody) && /No account handler set[^<]*R-NONE/.test(to(COO)[0].htmlBody));
  check('Ariel gets only shipment updates — never another account\'s shipments',
    to(ARIEL).length === 1 && /R-STALE/.test(to(ARIEL)[0].htmlBody) && !/R-NONE|R-KIM|R-ANDREW|R-CA/.test(to(ARIEL)[0].htmlBody));
  check('blank address (Andrew) -> COO email carries his shipment with a visible note',
    to(COO).length === 1 && /R-ANDREW/.test(to(COO)[0].htmlBody) && /Andrew Mausig/.test(to(COO)[0].htmlBody) && /no (email )?address/i.test(to(COO)[0].htmlBody));
  check('nobody receives two emails', new Set(people).size === people.length, people.join(', '));
  check('every subject starts with "Penny:" or "CRITICAL — Penny:"', W.mail.every(m => /^(CRITICAL — )?Penny: /.test(m.subject)), W.mail.map(m => m.subject).join(' | '));
  check('red shipment makes the handler subject CRITICAL', to(KIM)[0] && /^CRITICAL — Penny: 2 shipments need action$/.test(to(KIM)[0].subject), to(KIM)[0] && to(KIM)[0].subject);
});

test('Nobody outside the allowed list is ever contacted', () => {
  world({});
  const R = W.CONFIG.RECIPIENTS;
  const names = Object.keys(R.handlers).join(' ').toLowerCase();
  check('no Juan Carlos, billing, CFO or President in RECIPIENTS',
    !/juan carlos|raphael|billing|pablo|president|cfo/.test(names + ' ' + Object.keys(R).join(' ').toLowerCase()));
});

test('Invalid dates go to queue 4 and are never aged', () => {
  const bad = new FakeDate(26, 8, 20);                      // year 0026 typed for 2026
  const live = [
    ship({ 'JO Number': 'BAD-ATA', 'ATA': bad, 'ETA': daysAgo(3), 'Status': 'Container Discharged' }),
    ship({ 'JO Number': 'BAD-TXT', 'ETA': '31/02/2026' })
  ];
  const Q = runQueues({ live });
  check('year-0026 ATA is not in queue 1', !Q.q1.some(s => s.jo === 'BAD-ATA'));
  check('year-0026 ATA is not treated as "no arrival" in 5c', !Q.q5c.some(s => s.jo === 'BAD-ATA'));
  check('year-0026 ATA is listed in queue 4', Q.q4.some(s => s.jo === 'BAD-ATA'));
  check('unparseable text date is a defect, not a blank', Q.q4.some(s => s.jo === 'BAD-TXT'));
});

test('Prefixed duplicate JOs are reported once and flagged', () => {
  const live = [
    ship({ 'JO Number': 'IMP0826-1174', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' }),
    ship({ 'JO Number': 'AIMP0826-1174', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })
  ];
  const Q = runQueues({ live });
  check('only one of the pair is in queue 1', Q.q1.filter(s => /0826-1174/.test(s.jo)).length === 1);
  check('the duplicate is flagged in queue 4', Q.q4.some(s => /0826-1174/.test(s.jo) && /duplicate|also appears/i.test(JSON.stringify(s))));
});

test('Arrival trust — LogiSys ATA equal to ETA is not taken as arrival', () => {
  const live = [
    ship({ 'JO Number': 'TR-COPY', 'ATA': daysAgo(22), 'ETA': daysAgo(22), 'Status': 'Vessel One Departed' }),
    ship({ 'JO Number': 'TR-REAL', 'ATA': daysAgo(5), 'ETA': daysAgo(7), 'Status': 'Vessel One Departed' }),
    ship({ 'JO Number': 'TR-MILE', 'ATA': daysAgo(5), 'ETA': daysAgo(5), 'Status': 'Container Discharged' })
  ];
  const Q = runQueues({ live });
  check('ATA == ETA with no post-arrival milestone is not "22 days at port"', !Q.q1.some(s => s.jo === 'TR-COPY'));
  check('ATA different from ETA is trusted', Q.q1.some(s => s.jo === 'TR-REAL'));
  check('post-arrival milestone with ATA == ETA: arrived, date flagged for Ariel', !Q.q1.some(s => s.jo === 'TR-MILE') && Q.q4.some(s => s.jo === 'TR-MILE'));
  world({ live, config: c => { c.TRUST_LOGISYS_ATA = true; } });
  const Q2 = W.run(`(function(){ const f = loadFeed_(); return buildQueues_(f.rows, handlerMap_(), previousEtas_(f.ss)); })()`);
  check('one switch (TRUST_LOGISYS_ATA) restores the LogiSys ATA', Q2.q1.some(s => s.jo === 'TR-COPY'));
});

test('Scope cutoff — anything anchored before 1 Sep 2026 is out of scope', () => {
  const live = [ship({ 'JO Number': 'OLD-AUG', 'ATA': D(2026, 8, 20), 'ETA': D(2026, 8, 18), 'Status': 'DO Issued' })];
  const Q = runQueues({ live });
  check('August arrival is not chased', !Q.q1.some(s => s.jo === 'OLD-AUG'));
});

test('A row with no dates at all is scoped by its JO month', () => {
  const live = [ship({ 'JO Number': 'IMP0526-0941', 'ETD': '', 'Status': 'Gatepass Released' }),
                ship({ 'JO Number': 'IMP0926-0999', 'ETD': '', 'Status': 'Gatepass Released' })];
  const Q = runQueues({ live });
  check('May JO with no dates is out of scope', !Q.q4.some(s => s.jo === 'IMP0526-0941'));
  check('September JO with no dates is still checked', Q.q4.some(s => s.jo === 'IMP0926-0999'));
});

test('No release step is inferred from status text', () => {
  const live = [
    ship({ 'JO Number': 'REL-1', 'ATA': daysAgo(4), 'ETA': daysAgo(6), 'Status': 'Gatepass Released' }),
    ship({ 'JO Number': 'REL-2', 'ATA': daysAgo(4), 'ETA': daysAgo(6), 'Status': 'Container Discharged' })
  ];
  const Q = runQueues({ live });
  check('"Gatepass Released" is still queue 1, same severity as "Container Discharged"',
    sevOf(Q, 'q1', 'REL-1') === 'red' && sevOf(Q, 'q1', 'REL-2') === 'red');
});

test('Write audit — Penny writes only to sheets she creates', () => {
  const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
  const WRITE = /\.(setValues?|appendRow|clear\w*|deleteRows?|deleteColumns?|deleteSheet|insertSheet|insertRows?\w*|setFormulas?|setFontWeight|setFrozenRows|setNumberFormats?)\s*\(/g;
  const allowed = ['ownSheet_', 'updateArrivals_', 'buildMonthlyReport_', 'bootstrapFeedSheets', 'createFeedSheet_'];
  const offenders = [];
  let m;
  while ((m = WRITE.exec(src))) {
    const before = src.slice(0, m.index);
    const fn = (before.match(/function\s+(\w+)\s*\([^)]*\)\s*\{(?![\s\S]*\nfunction\s)/) || [])[1] ||
               ((before.match(/\nfunction\s+(\w+)/g) || []).pop() || '').replace(/\nfunction\s+/, '');
    if (allowed.indexOf(fn) === -1) offenders.push(m[1] + ' in ' + fn);
  }
  check('write verbs appear only in the owned-sheet functions', offenders.length === 0, offenders.join(', '));

  world({ live: [ship({ 'JO Number': 'WA-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })],
          archive: [ship({ 'JO Number': 'WA-1', 'Source Report Date': daysAgo(1) })] });
  W.run('runPenny()');
  check('full run: LogiSys Live untouched', W.feed.getSheetByName('LogiSys Live').writes === 0);
  check('full run: LogiSys Archive untouched', W.feed.getSheetByName('LogiSys Archive').writes === 0);
  check('full run: CA Tracker untouched', W.ca.getSheetByName('CA Tracker').writes === 0);
  check('full run: Penny Arrivals written', !!W.feed.getSheetByName('Penny Arrivals'));
  let refused = false;
  try { W.run('ownSheet_(feedBook_(), "LogiSys Live")'); } catch (e) { refused = true; }
  check('ownSheet_ refuses a sheet Penny does not own', refused);
});

test('Penny sends as ops.philindo@gmail.com, shown as "Penny"', () => {
  world({ live: [ship({ 'JO Number': 'SA-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })] });
  W.run('runPenny()');
  check('every email carries the sender name "Penny"', W.mail.length > 0 && W.mail.every(m => m.name === 'Penny'));
  world({ user: 'franchisekid43@gmail.com', live: [ship({ 'JO Number': 'SA-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })] });
  W.run('runPenny()');
  check('wrong account: nothing to handlers, one note to the COO naming the ops account',
    W.mail.length === 1 && W.mail[0].to === COO && /ops\.philindo@gmail\.com/.test(W.mail[0].htmlBody), W.mail.map(m => m.to).join(','));
});

test('Project not on Manila time -> Penny stops and says how to fix it', () => {
  world({ tz: 'America/New_York', live: [ship({ 'JO Number': 'TZ-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })] });
  W.run('runPenny()');
  check('nothing to handlers; one note to the COO naming the setting',
    W.mail.length === 1 && W.mail[0].to === COO && /\(GMT\+08:00\) Manila/.test(W.mail[0].htmlBody));
});

test('Shadow mode — every email goes to one address, marked with who it was for', () => {
  const live = [ship({ 'JO Number': 'SH-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' }),
                ship({ 'JO Number': 'SH-2', 'Last Updated': daysAgo(12), 'ETA': daysAhead(9) })];
  world({ live, shadow: 'me@example.com' });
  W.run('runPenny()');
  check('all emails go to the shadow address', W.mail.length >= 3 && W.mail.every(m => m.to === 'me@example.com'), W.mail.map(m => m.to).join(','));
  check('each is marked with its real recipient', W.mail.some(m => /this email was for <b>Kim Angelu Kong<\/b>/.test(m.htmlBody)) &&
    W.mail.some(m => /this email was for <b>Ariel<\/b>/.test(m.htmlBody)) && W.mail.some(m => /this email was for <b>COO<\/b>/.test(m.htmlBody)));
});

test('Team emails off — only the COO hears from Penny', () => {
  const live = [ship({ 'JO Number': 'TO-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' }),
                ship({ 'JO Number': 'TO-2', 'Last Updated': daysAgo(12), 'ETA': daysAhead(9) }),
                ship({ 'JO Number': 'TO-3', 'Account Handler': 'Andrew Mausig', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })];
  world({ live, team: false });
  W.run('runPenny()');
  check('exactly one email, to the COO', W.mail.length === 1 && W.mail[0].to === COO, W.mail.map(m => m.to).join(','));
  const h = W.mail[0] ? W.mail[0].htmlBody : '';
  check('it carries every pending shipment', /TO-1/.test(h) && /TO-2/.test(h) && /TO-3/.test(h));
  check('it says team emails are off', /Team emails are off/.test(h));
  check('each shipment shows its handler', /ACME TRADING — Kim Angelu Kong/.test(h) && /ACME TRADING — Andrew Mausig/.test(h));
  check('no "has no email address" noise while the team is off', !/has no email address set/.test(h));
  const cfg = fs.readFileSync(path.join(DIR, 'Config.gs'), 'utf8');
  check('shipped config: team emails off, sending for real to the COO', /TEAM_EMAILS: false/.test(cfg) && /SHADOW_TO: ''/.test(cfg));
});

test('Pre-arrival statuses are not "arrived" data gaps', () => {
  const live = [ship({ 'JO Number': 'PA-1', 'ETA': daysAhead(3), 'Status': 'Checking of Documents' }),
                ship({ 'JO Number': 'PA-2', 'ETA': daysAhead(3), 'Status': 'Lodgement of Shipment' })];
  const Q = runQueues({ live });
  check('"Checking of Documents" / "Lodgement" with no ATA are not flagged for Ariel', !Q.q4.some(s => /PA-/.test(s.jo)));
});

test('Ariel\'s 10:00 update list — his own email, even with team emails off', () => {
  const live = [ship({ 'JO Number': 'AR-STALE', 'Last Updated': daysAgo(12), 'ETA': daysAhead(9) }),
                ship({ 'JO Number': 'AR-NOETA', 'ETA': '', 'ETD': daysAgo(5) }),
                ship({ 'JO Number': 'AR-Q1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })];
  setNow(2026, 9, 28, 10, 0);
  world({ live, team: false, arielAt10: true });
  W.run('runArielReminder()');
  check('exactly one email, to Ariel', W.mail.length === 1 && W.mail[0].to === ARIEL, W.mail.map(m => m.to).join(','));
  const h = W.mail[0] ? W.mail[0].htmlBody : '';
  check('it lists his LogiSys updates', /AR-STALE/.test(h) && /AR-NOETA/.test(h));
  check('never another account\'s shipments', !/AR-Q1/.test(h));
  check('subject: "Penny: 2 shipments to update in LogiSys", not CRITICAL', W.mail[0] && W.mail[0].subject === 'Penny: 2 shipments to update in LogiSys', W.mail[0] && W.mail[0].subject);
  check('the 10:00 run writes nothing', !W.feed.getSheetByName('Penny Arrivals'));
  setNow(2026, 9, 28, 7, 45);
  world({ live, team: true, arielAt10: true });
  W.run('runPenny()');
  check('07:45 run no longer sends Ariel\'s email (it goes at 10:00)', !W.mail.some(m => m.to === ARIEL));
  world({ live: [ship({ 'JO Number': 'AR-OK', 'ETA': daysAhead(9) })], arielAt10: true });
  W.run('runArielReminder()');
  check('nothing to update -> no email at all', W.mail.length === 0);
  world({ live: [ship({ 'JO Number': 'AR-OLD', 'Last Updated': daysAgo(12), 'Source Report Date': daysAgo(1) })], arielAt10: true });
  W.run('runArielReminder()');
  check('stale feed at 10:00 -> nothing sent (the COO was told at 07:45)', W.mail.length === 0);
  setNow(2026, 9, 26, 10, 0); world({ live, arielAt10: true }); W.run('runArielReminder()');
  check('Saturday -> nothing', W.mail.length === 0);
  setNow(2026, 9, 28, 7, 45);
  world({ arielAt10: true }); W.run('setupArielReminder()');
  check('setupArielReminder installs one 10:00 trigger and sends nothing',
    W.triggers.length === 1 && W.triggers[0].fn === 'runArielReminder' && W.triggers[0].h === 10 && W.mail.length === 0);
  W.run('setupArielReminder()');
  check('running it twice still leaves one trigger', W.triggers.length === 1);
  const cfg = fs.readFileSync(path.join(DIR, 'Config.gs'), 'utf8');
  check('shipped config: Ariel reminder on at 10:00', /ARIEL_REMINDER: true/.test(cfg) && /ARIEL_HOUR: 10,/.test(cfg));
});

test('dryRun sends nothing and writes nothing', () => {
  world({ live: [ship({ 'JO Number': 'DR-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })] });
  W.run('dryRun()');
  check('no email', W.mail.length === 0);
  check('no Penny Arrivals sheet created', !W.feed.getSheetByName('Penny Arrivals'));
  check('the log shows the email it would have sent', W.logs.some(l => /CRITICAL — Penny: 1 shipment needs action/.test(l)), W.logs.filter(l => /->/.test(l)).join(' | '));
});

test('bootstrapFeedSheets creates the feed sheets and never overwrites data', () => {
  world({});
  delete W.feed.sheets['LogiSys Live']; delete W.feed.sheets['LogiSys Archive'];
  W.run('bootstrapFeedSheets()');
  check('LogiSys Live created with the schema headers', W.feed.getSheetByName('LogiSys Live') && W.feed.getSheetByName('LogiSys Live').rows[0][0] === 'JO Number');
  world({ live: [ship({ 'JO Number': 'KEEP-1' })] });
  W.run('bootstrapFeedSheets()');
  check('existing Live data untouched', W.feed.getSheetByName('LogiSys Live').writes === 0);
  W.run('dryRun()');
  check('Penny can read a bootstrapped feed (headers agree)', !W.logs.some(l => /Missing required header/.test(l)), W.logs.filter(l => /FAIL/.test(l)).join(' | '));
});

test('Arrivals record and monthly report', () => {
  const live = [
    ship({ 'JO Number': 'Y-1', 'Cargo Type': 'FCL', 'Containers 20ft': 2, 'Containers 40ft': 1, 'ETA': D(2026, 8, 3), 'ATA': D(2026, 8, 5), 'Delivered': D(2026, 8, 8), 'Status': 'Job Completed' }),
    ship({ 'JO Number': 'Y-2', 'Cargo Type': 'LCL', 'Total Packages': 10, 'ETA': D(2026, 9, 2), 'ATA': D(2026, 9, 4), 'Delivered': D(2026, 9, 6), 'Status': 'Job Completed' }),
    ship({ 'JO Number': 'AY-3', 'Mode': 'Air', 'Cargo Type': '', 'Total Packages': 3, 'ETA': D(2026, 9, 10), 'ATA': D(2026, 9, 11), 'Status': 'Gatepass Released' })
  ];
  setNow(2026, 10, 7);
  world({ live: live.map(r => Object.assign({}, r, { 'Source Report Date': daysAgo(0), 'Last Updated': daysAgo(0) })) });
  W.run('runPenny()');
  const arr = W.feed.getSheetByName('Penny Arrivals');
  const cell = label => { const r = arr && arr.rows.find(x => x[0] === label); return r ? r.slice(1) : null; };
  check('YTD: 3 shipments, 2 x 20ft, 1 x 40ft', cell('Year to date') && cell('Year to date')[0] === 3 && cell('Year to date')[1] === 2 && cell('Year to date')[2] === 1, JSON.stringify(cell('Year to date')));
  check('split 1 FCL / 1 LCL / 1 AIR', cell('SEA FCL')[0] === 1 && cell('SEA LCL')[0] === 1 && cell('AIR')[0] === 1);
  check('delivered counts from the Delivered column', cell('Delivered') && cell('Delivered')[0] === 2, JSON.stringify(cell('Delivered')));
  const fcl = W.feed.getSheetByName('Penny Monthly Sep 2026 — SEA FCL');
  check('monthly report generated on the 7th with three tabs', fcl && W.feed.getSheetByName('Penny Monthly Sep 2026 — SEA LCL') && W.feed.getSheetByName('Penny Monthly Sep 2026 — AIR'));
  check('date range line reads "From 01-Jan-2026 To 30-Sep-2026"', fcl && fcl.rows[2][0] === 'Date Range : From 01-Jan-2026 To 30-Sep-2026', fcl && fcl.rows[2][0]);
  setNow(2026, 10, 8);
  world({ live: live.map(r => Object.assign({}, r, { 'Source Report Date': daysAgo(0), 'Last Updated': daysAgo(0) })) });
  W.run('runPenny()');
  check('when the 7th is missed, the next working day generates it', !!W.feed.getSheetByName('Penny Monthly Sep 2026 — AIR'));
  setNow(2026, 9, 28);
});

test('Email renders on a phone', () => {
  world({ live: [ship({ 'JO Number': 'PH-1', 'ATA': daysAgo(5), 'ETA': daysAgo(6), 'Status': 'DO Issued' })] });
  W.run('runPenny()');
  const h = W.mail.map(m => m.htmlBody).join('');
  check('HTML only — no images or external stylesheets', !/<img|<link|@import|url\(/i.test(h));
  check('handler line names JO, client, days and both clocks', /PH-1/.test(h) && /ACME TRADING/.test(h) && /5d/.test(h) && /demurrage/i.test(h));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
