/**
 * importer_tests.js — runs the LogiSys importer under Node with Gmail,
 * Sheets, Drive and properties stubbed.
 *
 *   node importer_tests.js            (from the importer/ folder)
 */
process.env.TZ = 'Asia/Manila';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
const FILES = ['Config.gs', 'Importer.gs'];

// ------------------------------------------------------------------ clock
const RealDate = Date;
let NOW = new RealDate(2026, 8, 28, 7, 15).getTime();           // Mon 28 Sep 2026 07:15
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
function setNow(y, m, d, h, mi) { NOW = new RealDate(y, m - 1, d, h, mi || 0).getTime(); }

// ------------------------------------------------------------ fake sheets
class FakeSheet {
  constructor(book, name, rows) { this.book = book; this.name = name; this.rows = rows || []; this.writes = 0; }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getDataRange() {
    const w = this.rows.reduce((m, r) => Math.max(m, r.length), 0);
    return { getValues: () => this.rows.map(r => { const c = r.slice(); while (c.length < w) c.push(''); return c; }) };
  }
  getRange(r, c, nr, nc) {
    const self = this;
    return {
      setValues(v) { self.writes++; v.forEach((row, i) => { while (self.rows.length < r + i) self.rows.push([]); row.forEach((x, j) => { self.rows[r - 1 + i][c - 1 + j] = x; }); }); return this; },
      clearContent() { self.writes++; for (let i = 0; i < nr; i++) if (self.rows[r - 1 + i]) self.rows[r - 1 + i] = []; while (self.rows.length && !self.rows[self.rows.length - 1].length) self.rows.pop(); return this; }
    };
  }
  setFrozenRows() {}
}
class FakeBook {
  constructor(id) { this.id = id; this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  getSheets() { return Object.values(this.sheets); }
  insertSheet(n) { return (this.sheets[n] = new FakeSheet(this, n)); }
}

// ---------------------------------------------------------- fake LogiSys
const PRE = [['PHILINDO CONTAINER EXPRESS INC.'], ['Sea Import Shipment Register'], ['Date Range : From 01-Jan-2026 To 28-Sep-2026']];
const SEA_H = ['Shipment No', 'FSA Number (UDF)', 'BL NO', 'HBL No', 'Shipper', 'Consignee', 'Cargo Type', 'Loading Port',
  'Discharge Port', 'Place Of Receipt', 'Place Of Delivery', 'Shipment Date', 'ETD', 'ATD', 'ETA', 'ATA',
  '20 Feet Containers', '40 Feet Containers', '45 Feet Containers', 'Container Nos.', 'Total Packages', 'Unit', 'Good Desc', 'Status'];
const AIR_H = ['Shipment No', 'FSANumber (UDF)', 'AWB NO', 'HAWB No', 'Shipper', 'Consignee', 'Airline', 'Flight No', 'Loading Port',
  'Discharge Port', 'Place Of Delivery', 'Shipment Date', 'ETD', 'ATD', 'ETA', 'ATA', 'Total Packages', 'Unit', 'Good Desc', 'Status'];
function seaRow(o) { return SEA_H.map(h => (h in o ? o[h] : '')); }
function airRow(o) { return AIR_H.map(h => (h in o ? o[h] : '')); }
function csv(rows) { return rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : String(c)).join(',')).join('\n'); }
function parseCsv(text) {
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; } else cur += ch;
  }
  row.push(cur); out.push(row); return out;
}
let MSGID = 0;
function email(subject, date, attachments, thread) {
  const id = 'm' + (++MSGID);
  return { id, subject, date, attachments, thread };
}
function csvAtt(name, rows) { return { name, data: csv(rows) }; }
function xlsxAtt(name, tables) { return { name, tables }; }

// ---------------------------------------------------------------- the world
let W;
function world(messages, opts) {
  opts = opts || {};
  const feed = W && opts.keepFeed ? W.feed : new FakeBook('FEED');
  const props = W && opts.keepFeed ? W.props : {};
  const mail = [], logs = [], labels = {}, temp = {};
  const threads = {};
  messages.forEach(m => { const t = m.thread || m.id; (threads[t] = threads[t] || []).push(m); });
  const ctx = {
    Date: FakeDate, Math, JSON, Object, Array, String, Number, RegExp, Error, isNaN, console,
    Logger: { log: (...a) => logs.push(a.join(' ')) },
    MailApp: { sendEmail: m => mail.push(m) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; },
      getKeys: () => Object.keys(props), deleteProperty: k => { delete props[k]; } }) },
    GmailApp: {
      search: q => Object.keys(threads).map(tid => ({
        getMessages: () => threads[tid].map(m => ({
          getId: () => m.id, getSubject: () => m.subject, getDate: () => m.date,
          getAttachments: () => m.attachments.map(a => ({ getName: () => a.name, getDataAsString: () => a.data, _tables: a.tables }))
        })),
        addLabel: l => { (labels[l.name] = labels[l.name] || []).push(tid); }
      })),
      getUserLabelByName: n => null, createLabel: n => ({ name: n })
    },
    Drive: { Files: { create: (meta, blob) => { if (!blob._tables) throw new Error('corrupt file'); const id = 'tmp' + Object.keys(temp).length; temp[id] = blob._tables; return { id }; } } },
    DriveApp: { getFileById: id => ({ setTrashed: () => { delete temp[id]; } }) },
    SpreadsheetApp: { openById: id => {
      if (id === 'FEED') return feed;
      if (temp[id]) { const b = new FakeBook(id); temp[id].forEach((t, i) => b.sheets['t' + i] = new FakeSheet(b, 't' + i, t)); return b; }
      throw new Error('no access to ' + id);
    } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => { const c = { timeBased: () => c, everyMinutes: () => c, create: () => ({}) }; return c; } },
    Utilities: { formatDate: fmt, parseCsv }
  };
  vm.createContext(ctx);
  vm.runInContext(FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n;\n'), ctx);
  if (!opts.noId) vm.runInContext("IMPORTER.FEED_SPREADSHEET_ID = 'FEED'", ctx);
  W = { ctx, feed, mail, logs, labels, props, temp, run: s => vm.runInContext(s, ctx) };
  return W;
}
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmt(d, tz, p) {
  const pad = n => ('0' + n).slice(-2);
  return p.replace(/yyyy|MMM|MM|dd|d|HH|mm/g, t => ({ yyyy: String(d.getFullYear()).padStart(4, '0'), MMM: MON[d.getMonth()],
    MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), d: String(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()) })[t]);
}
function liveObjs() {
  const sh = W.feed.getSheetByName('LogiSys Live'); if (!sh) return null;
  const [h, ...rows] = sh.rows; return rows.map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
function snapshot() {
  return JSON.stringify(['LogiSys Live', 'LogiSys Archive'].map(n => W.feed.getSheetByName(n) && W.feed.getSheetByName(n).rows));
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

const TODAY_0700 = new FakeDate(2026, 8, 28, 7, 0);
const seaReport = () => csvAtt('sea.csv', PRE.concat([SEA_H,
  seaRow({ 'Shipment No': 'IMP0926-1274', 'BL NO': 'BL1', 'Consignee': 'UNILAB INC.', 'Cargo Type': 'FCL', 'ETD': '10-Sep-2026', 'ETA': '2026-09-20', 'ATA': '22-Sep-2026 14:30', '20 Feet Containers': '2', 'Status': 'DO Issued' }),
  seaRow({ 'Shipment No': 'IMP0926-1280', 'BL NO': 'BL2', 'Consignee': 'ACME', 'Cargo Type': 'LCL', 'ETD': '15-Sep-2026', 'ETA': '0026-09-30', 'ATA': '', 'Total Packages': '12', 'Status': 'Vessel One Departed' }),
  seaRow({ 'Shipment No': 'IMP0826-1100', 'BL NO': 'BL3', 'Consignee': 'ACME', 'Cargo Type': 'FCL', 'ETD': '01-Aug-2026', 'ETA': '10-Aug-2026', 'ATA': '11-Aug-2026', 'Status': 'Job Completed' }),
  ['Total: 3']
]));
const airReport = () => csvAtt('air.csv', [['PHILINDO'], ['Air Import Shipment Report'], ['range'], AIR_H,
  airRow({ 'Shipment No': 'AIMP0926-0501', 'AWB NO': 'AWB1', 'Consignee': 'Unilab Inc.', 'Airline': 'PR', 'ETD': '2026-09-26', 'ETA': '2026-09-27', 'ATA': '2026-09-27', 'Total Packages': '3', 'Status': 'Flight One Departed' })]);

// =================================================================== TESTS

test('dryRun parses both registers and writes nothing', () => {
  world([email('SEA Shipment Register', TODAY_0700, [seaReport()]), email('AIR Shipment Report', TODAY_0700, [airReport()])]);
  W.run('dryRun()');
  check('no sheet written', !W.feed.getSheetByName('LogiSys Live'));
  check('no email sent', W.mail.length === 0);
  check('every row printed with typed dates', W.logs.some(l => /IMP0926-1274 \| Sea FCL \| UNILAB INC\. \| ETD 2026-09-10 \| ETA 2026-09-20 \| ATA 2026-09-22/.test(l)),
    W.logs.filter(l => /IMP0926-1274/.test(l)).join(' / '));
  check('footer line "Total: 3" is not a row', !W.logs.some(l => /^\s+Total/.test(l)));
  check('message not marked processed on a dry run', Object.keys(W.props).length === 0);
});

test('Real run writes LogiSys Live to the contract', () => {
  world([email('SEA Shipment Register', TODAY_0700, [seaReport()]), email('AIR Shipment Report', TODAY_0700, [airReport()])]);
  W.run('runImporter()');
  const live = liveObjs();
  const penny = fs.readFileSync(path.join(DIR, '..', 'penny', 'Config.gs'), 'utf8');
  const pennyHeaders = vm.runInNewContext(penny.slice(penny.indexOf('const FEED_HEADERS')).replace('const FEED_HEADERS =', 'FEED_HEADERS =').split(';')[0] + '; FEED_HEADERS');
  check('headers are exactly Penny\'s FEED_HEADERS', JSON.stringify(W.feed.getSheetByName('LogiSys Live').rows[0]) === JSON.stringify(pennyHeaders));
  check('one row per JO (4)', live.length === 4, live.map(o => o['JO Number']).join(','));
  const u = live.find(o => o['JO Number'] === 'IMP0926-1274');
  check('dates are real dates', Object.prototype.toString.call(u['ETA']) === '[object Date]');
  check('ATA keeps its time of day (Unilab air is measured in hours)', u['ATA'].getHours() === 14 && u['ATA'].getMinutes() === 30);
  check('Mode from the register: Sea / Air', u['Mode'] === 'Sea' && live.find(o => o['JO Number'] === 'AIMP0926-0501')['Mode'] === 'Air');
  check('numbers are numbers', u['Containers 20ft'] === 2);
  check('every row carries Source Report Date', live.every(o => o['Source Report Date'] && o['Source Report Date'].getDate() === 28));
  check('delivered status -> Delivered = report date', live.find(o => o['JO Number'] === 'IMP0826-1100')['Delivered'].getDate() === 28);
  check('Stage derived from status', u['Stage'] === 'Released');
  check('ATA is never inferred: blank stays blank', live.find(o => o['JO Number'] === 'IMP0926-1280')['ATA'] === '');
  check('archive holds the first sighting of every JO', W.feed.getSheetByName('LogiSys Archive').rows.length === 5);
});

test('Corrupt date -> blank field plus a line in the run report', () => {
  world([email('SEA Shipment Register', TODAY_0700, [seaReport()])]);
  W.run('runImporter()');
  const r = liveObjs().find(o => o['JO Number'] === 'IMP0926-1280');
  check('year-0026 ETA written blank, not computed', r['ETA'] === '');
  check('the COO run report names it', W.mail.length >= 1 && /IMP0926-1280: ETA &quot;0026-09-30&quot;|IMP0926-1280: ETA "0026-09-30"/.test(W.mail[0].htmlBody), W.mail[0] && W.mail[0].htmlBody);
});

test('Idempotent — the same email twice gives the same sheets', () => {
  const m = [email('SEA Shipment Register', TODAY_0700, [seaReport()])];
  world(m); W.run('runImporter()');
  const first = snapshot();
  delete W.props['done:' + m[0].id];                    // someone clears the tracking and re-runs
  world(m, { keepFeed: true }); W.run('runImporter()');
  check('LogiSys Live and Archive unchanged by a second import', snapshot() === first);
  world(m, { keepFeed: true }); W.run('runImporter()');
  check('an already-processed message is not read again', !W.logs.some(l => /rows/.test(l)));
});

test('Daily reports in the same Gmail thread are all picked up', () => {
  const a = email('SEA Shipment Register', new FakeDate(2026, 8, 25, 7, 0), [seaReport()], 'T1');
  world([a]); W.run('runImporter()');
  const b = email('SEA Shipment Register', TODAY_0700, [seaReport()], 'T1');
  world([a, b], { keepFeed: true }); W.run('runImporter()');
  check('the newer message in a labelled thread is imported', liveObjs().every(o => o['JO Number'] === 'AIMP0926-0501' || o['Source Report Date'].getDate() === 28));
});

test('Last Updated tracks when the status last changed', () => {
  const day = (d, status) => email('SEA Shipment Register', new FakeDate(2026, 8, d, 7, 0), [csvAtt('s.csv', PRE.concat([SEA_H,
    seaRow({ 'Shipment No': 'IMP-LU', 'BL NO': 'B', 'Consignee': 'X', 'ETD': '2026-09-10', 'ETA': '2026-09-30', 'Status': status })]))]);
  setNow(2026, 9, 21, 7, 10); world([day(21, 'Vessel One Departed')]); W.run('runImporter()');
  setNow(2026, 9, 24, 7, 10); world([day(24, 'Vessel One Departed')], { keepFeed: true }); W.run('runImporter()');
  let r = liveObjs()[0];
  check('status unchanged -> Last Updated stays at the first report', r['Last Updated'].getDate() === 21 && r['Source Report Date'].getDate() === 24);
  check('unchanged row is not re-archived', W.feed.getSheetByName('LogiSys Archive').rows.length === 2);
  setNow(2026, 9, 25, 7, 10); world([day(25, 'Container Discharged')], { keepFeed: true }); W.run('runImporter()');
  r = liveObjs()[0];
  check('status changed -> Last Updated moves to that report', r['Last Updated'].getDate() === 25);
  check('changed row is archived', W.feed.getSheetByName('LogiSys Archive').rows.length === 3);
  setNow(2026, 9, 28, 7, 15);
});

test('Missing attachment leaves LogiSys Live completely untouched', () => {
  world([email('SEA Shipment Register', TODAY_0700, [seaReport()])]); W.run('runImporter()');
  const before = snapshot();
  world([email('SEA Shipment Register', new FakeDate(2026, 8, 28, 7, 5), [])], { keepFeed: true }); W.run('runImporter()');
  check('Live and Archive unchanged', snapshot() === before);
  check('COO told the report was not imported', W.mail.some(m => /not imported/.test(m.subject) && /no CSV or Excel attachment/.test(m.htmlBody)));
  world([email('SEA Shipment Register', new FakeDate(2026, 8, 28, 7, 6), [xlsxAtt('sea.xlsx', null)])], { keepFeed: true }); W.run('runImporter()');
  check('unreadable Excel: Live unchanged, COO told', snapshot() === before && W.mail.some(m => /unreadable/.test(m.htmlBody)));
});

test('Excel attachment is converted, read and the temp file trashed', () => {
  const tables = [PRE.concat([SEA_H, seaRow({ 'Shipment No': 'IMP-XL', 'BL NO': 'B', 'Consignee': 'X', 'ETD': new FakeDate(2026, 8, 20), 'ETA': new FakeDate(2026, 9, 2), 'Status': 'Vessel One Departed' })])];
  world([email('SEA Shipment Register', TODAY_0700, [xlsxAtt('sea.xlsx', tables)])]); W.run('runImporter()');
  check('row imported from Excel', liveObjs().some(o => o['JO Number'] === 'IMP-XL'));
  check('temporary converted file trashed', Object.keys(W.temp).length === 0);
});

test('Required header missing -> nothing written, COO told which header', () => {
  const bad = csvAtt('sea.csv', PRE.concat([SEA_H.filter(h => h !== 'ATA'), ['IMP-1', '', 'B']]));
  world([email('SEA Shipment Register', TODAY_0700, [bad])]); W.run('runImporter()');
  check('no LogiSys Live created', !W.feed.getSheetByName('LogiSys Live'));
  check('COO email names ATA', W.mail.length >= 1 && /missing required header\(s\): ATA/.test(W.mail[0].htmlBody));
});

test('An older report never overwrites a newer one', () => {
  const r = (d, eta) => email('SEA Shipment Register', new FakeDate(2026, 8, d, 7, 0), [csvAtt('s.csv', PRE.concat([SEA_H,
    seaRow({ 'Shipment No': 'IMP-ORD', 'BL NO': 'B', 'Consignee': 'X', 'ETD': '2026-09-10', 'ETA': eta, 'Status': 'Vessel One Departed' })]))]);
  world([r(28, '2026-10-05')]); W.run('runImporter()');
  world([r(25, '2026-10-01')], { keepFeed: true }); W.run('runImporter()');
  check('Live keeps the 28 Sep ETA', liveObjs()[0]['ETA'].getDate() === 5);
});

test('No report by 07:30 on a working day -> COO told once', () => {
  setNow(2026, 9, 28, 7, 20); world([]); W.run('runImporter()');
  check('07:20 — too early to alert', W.mail.length === 0);
  setNow(2026, 9, 28, 7, 35); world([], { keepFeed: true }); W.run('runImporter()');
  check('07:35 — "LogiSys report for 28 Sep 2026 not received."', W.mail.length === 1 && W.mail[0].subject === 'LogiSys report for 28 Sep 2026 not received');
  setNow(2026, 9, 28, 8, 35); world([], { keepFeed: true }); W.run('runImporter()');
  check('08:35 — not repeated', W.mail.length === 0);
  setNow(2026, 9, 26, 9, 0); world([]); W.run('runImporter()');
  check('Saturday — no alert', W.mail.length === 0);
  setNow(2026, 9, 28, 7, 15);
});

test('Write audit — only LogiSys Live and LogiSys Archive', () => {
  const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
  const WRITE = /\.(setValues?|appendRow|clear\w*|deleteRows?|deleteColumns?|deleteSheet|insertSheet|insertRows?\w*|setFormulas?)\s*\(/g;
  const allowed = ['ownedSheet_', 'writePlan_'];
  const offenders = [];
  let m;
  while ((m = WRITE.exec(src))) {
    const fn = ((src.slice(0, m.index).match(/\nfunction\s+(\w+)/g) || []).pop() || '').replace(/\nfunction\s+/, '');
    if (allowed.indexOf(fn) === -1) offenders.push(m[1] + ' in ' + fn);
  }
  check('write verbs appear only in ownedSheet_ and writePlan_', offenders.length === 0, offenders.join(', '));
  check('writePlan_ only writes sheets obtained from ownedSheet_',
    (src.match(/function writePlan_[\s\S]*?\n}\n/)[0].match(/getSheetByName|openById/g) || []).length === 0);
  world([]);
  let refused = false;
  try { W.run('ownedSheet_(SpreadsheetApp.openById("FEED"), "CA Tracker")'); } catch (e) { refused = true; }
  check('ownedSheet_ refuses any other sheet', refused);
  W.feed.sheets['LogiSys Live'] = new FakeSheet(W.feed, 'LogiSys Live', [['Somebody else\'s header'], ['data']]);
  world([email('SEA Shipment Register', TODAY_0700, [seaReport()])], { keepFeed: true }); W.run('runImporter()');
  check('a "LogiSys Live" that is not ours is never overwritten', W.feed.getSheetByName('LogiSys Live').rows[1][0] === 'data');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
