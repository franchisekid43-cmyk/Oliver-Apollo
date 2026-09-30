/**
 * agos_tests.js — runs the Agos sign-up Apps Script under Node with Sheets,
 * Mail, Lock and ContentService stubbed.
 *
 *   node agos-site/agos_tests.js
 */
process.env.TZ = 'Asia/Manila';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, 'apps-script.gs'), 'utf8');

// ------------------------------------------------------------ fake sheets
class FakeSheet {
  constructor(book, name) { this.book = book; this.name = name; this.rows = []; this.formats = {}; this.checkboxes = {}; this.frozen = 0; }
  getName() { return this.name; }
  setName(n) { delete this.book.sheets[this.name]; this.name = n; this.book.sheets[n] = this; return this; }
  getSheetId() { return 7; }
  getParent() { return this.book; }
  getLastRow() { let n = this.rows.length; while (n && !(this.rows[n - 1] || []).some(v => v !== '' && v != null)) n--; return n; }
  setFrozenRows(n) { this.frozen = n; }
  cell(r, c) { return (this.rows[r - 1] || [])[c - 1]; }
  put(r, c, v) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getRange(r, c, nr, nc) {
    const self = this; nr = nr || 1; nc = nc || 1;
    const each = f => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) f(r + i, c + j, i, j); };
    return {
      getSheet: () => self, getRow: () => r, getColumn: () => c, getLastRow: () => r + nr - 1, getLastColumn: () => c + nc - 1,
      setNumberFormat(f) { each((ri, ci) => { self.formats[ri + ':' + ci] = f; }); return this; },
      setValues(v) {
        each((ri, ci, i, j) => {
          let x = v[i][j];
          // Sheets turns "09171234567" into a number unless the cell is plain text; model that.
          if (self.formats[ri + ':' + ci] !== '@' && typeof x === 'string' && /^\d+$/.test(x)) x = Number(x);
          self.put(ri, ci, x);
        });
        return this;
      },
      setValue(x) { return this.setValues([[x]]); },
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const x = self.cell(r + i, c + j); row.push(x == null ? '' : x); } out.push(row); } return out; },
      insertCheckboxes() { each((ri, ci) => { self.checkboxes[ri + ':' + ci] = true; self.put(ri, ci, false); }); return this; },
      setFontWeight() { return this; }, setBackground() { return this; }, setNote(n) { self.note = self.note || {}; self.note[c] = n; return this; }
    };
  }
}
class FakeBook {
  constructor() { this.sheets = {}; this.toasts = []; this.tz = 'America/New_York'; }
  getId() { return 'AGOS'; }
  getName() { return 'Agos Sign-ups'; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/AGOS/edit'; }
  getSheetByName(n) { return this.sheets[n] || null; }
  getSheets() { return Object.values(this.sheets); }
  insertSheet(n) { return (this.sheets[n] = new FakeSheet(this, n)); }
  setSpreadsheetTimeZone(z) { this.tz = z; }
  toast(msg, title) { this.toasts.push(title + ': ' + msg); }
}

// ---------------------------------------------------------------- the world
let W;
function world(opts) {
  opts = opts || {};
  const book = new FakeBook();
  book.insertSheet('Sheet1');
  const mail = [], errors = [], props = {};
  const ctx = {
    Date, Math, JSON, Object, Array, String, Number, RegExp, Error,
    console: { log() {}, error: m => errors.push(String(m)) },
    // W.webRequest: like a real web-app call, where there may be no active spreadsheet.
    SpreadsheetApp: { getActiveSpreadsheet: () => (W && W.webRequest ? null : book),
                      openById: id => { if (id !== 'AGOS') throw new Error('no access to ' + id); return book; }, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    // opts.mailFails(m) -> true makes that one send throw, like a Gmail quota or a bad address.
    MailApp: { sendEmail: m => { if (opts.mailFails && opts.mailFails(m)) throw new Error('quota'); mail.push(m); } },
    // The account the script runs as. opts.account === null: Google won't say.
    Session: { getEffectiveUser: () => ({ getEmail: () => {
      if (opts.account === null) throw new Error('no permission');
      return opts.account || 'helloagos.ph@gmail.com'; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { if (opts.lockBusy) throw new Error('timeout'); }, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; }, getContent() { return this.s; } }) },
    Utilities: { formatDate: fmt }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  W = { ctx, book, mail, errors, run: s => vm.runInContext(s, ctx) };
  return W;
}
function fmt(d, tz, p) {
  const pad = n => ('0' + n).slice(-2);
  return p.replace(/yyyy|MM|dd|HH|mm|ss/g, t => ({ yyyy: String(d.getFullYear()), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()),
    HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()) })[t]);
}
function good(over) {
  return Object.assign({
    name: 'Maria Santos', business: 'Bayside Customs Brokerage', type: 'Customs broker', location: 'Pasay',
    years: '3 to 5 years', billings: '₱2M to ₱10M', amount: '₱500K to ₱2M', when: 'Within a month',
    mobile: '0917 123 4567', email: 'maria@bayside.ph', consent: true, website: '', elapsedMs: 42000,
    sourcePage: 'https://agos.vercel.app/?utm_source=fb'
  }, over || {});
}
function post(data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  W.ctx.__e = { postData: { contents: body } };
  return JSON.parse(W.run('doPost(__e)').getContent());
}
function sheet() { return W.book.getSheetByName('Sign-ups'); }
// Simulates a person editing one cell: the value changes, then the onEdit simple trigger runs.
function edit(row, col, value) {
  sheet().put(row, col, value);
  W.ctx.__e = { range: sheet().getRange(row, col), source: W.book, value: String(value) };
  W.run('onEdit(__e)');
}

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '\n         ' + detail : '')); }
}
function test(title, fn) {
  console.log('\n' + title);
  try { fn(); } catch (e) { failed++; console.log('  FAIL threw: ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n         ')); }
}

const VERIFIED = 14, VERIFIED_ON = 15, FORWARDED = 16, FORWARDED_ON = 17;

// -------------------------------------------------------------------- tests

test('setup makes the Sign-ups tab from the blank Sheet1, in Manila time', () => {
  world(); W.run('setup()');
  const sh = sheet();
  check('Sheet1 renamed, no stray tab', sh && W.book.getSheets().length === 1);
  check('13 brief columns then the Agos Verified columns', JSON.stringify(sh.rows[0]) === JSON.stringify([
    'Timestamp (Asia/Manila)', 'Name', 'Business', 'Type', 'Location', 'Years', 'Monthly billings', 'Amount needed',
    'How soon', 'Mobile', 'Email', 'Consent', 'Source page',
    'Agos Verified', 'Verified on', 'Forwarded to lenders', 'Forwarded on', 'Notes', 'Welcome sent']), JSON.stringify(sh.rows[0]));
  check('header frozen', sh.frozen === 1);
  check('spreadsheet time zone is Asia/Manila', W.book.tz === 'Asia/Manila');
  check('setup twice is harmless', (W.run('setup()'), W.book.getSheets().length === 1 && sheet().getLastRow() === 1));
});

test('A good sign-up is saved as one row and emailed, not yet Agos Verified', () => {
  world(); W.run('setup()');
  const res = post(good());
  const row = sheet().rows[1];
  check('replies ok', res.ok === true, JSON.stringify(res));
  check('timestamp is Manila wall time', /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(row[0]), row[0]);
  check('fields land in their columns', row.slice(1, 13).join('|') ===
    'Maria Santos|Bayside Customs Brokerage|Customs broker|Pasay|3 to 5 years|₱2M to ₱10M|₱500K to ₱2M|Within a month|09171234567|maria@bayside.ph|Yes|https://agos.vercel.app/?utm_source=fb', row.join('|'));
  check('mobile keeps its leading 0 (stored as text)', row[9] === '09171234567', typeof row[9] + ' ' + row[9]);
  check('Agos Verified and Forwarded arrive as unticked checkboxes',
    row[VERIFIED - 1] === false && row[FORWARDED - 1] === false && sheet().checkboxes['2:14'] && sheet().checkboxes['2:16']);
  check('notification to helloagos.ph@gmail.com, then the welcome', W.mail.length === 2 && W.mail[0].to === 'helloagos.ph@gmail.com' && W.mail[1].to === 'maria@bayside.ph');
  check('subject names business, type, location, amount',
    W.mail[0].subject === 'New Agos sign-up: Bayside Customs Brokerage, Customs broker, Pasay, ₱500K to ₱2M', W.mail[0].subject);
  check('email says NOT YET AGOS VERIFIED and links the row',
    /NOT YET AGOS VERIFIED/.test(W.mail[0].body) && /#gid=7&range=A2$/.test(W.mail[0].body));
  post(good({ name: 'Second' }));
  check('the next sign-up goes on the next row', sheet().rows[2][1] === 'Second' && sheet().getLastRow() === 3);
});

test('A web request with no active spreadsheet still finds the Sheet setup saw', () => {
  world(); W.run('setup()');
  W.webRequest = true;
  check('replies ok', post(good()).ok === true);
  check('row written', sheet().getLastRow() === 2);
});

test('Works even if setup was never run', () => {
  world();
  check('replies ok', post(good()).ok === true);
  check('row written to a Sign-ups tab', sheet() && sheet().rows[0][1] === 'Maria Santos');
});

test('Bad requests are rejected and nothing is saved', () => {
  world(); W.run('setup()');
  const cases = [
    ['not JSON', 'name=x', 'bad_request'],
    ['honeypot filled', good({ website: 'http://spam.example' }), 'rejected'],
    ['sent under 3 seconds', good({ elapsedMs: 1200 }), 'rejected'],
    ['no timing at all', good({ elapsedMs: undefined }), 'rejected'],
    ['consent not ticked', good({ consent: false }), 'consent_required'],
    ['consent as a string', good({ consent: 'true' }), 'consent_required'],
    ['business missing', good({ business: '  ' }), 'missing_business'],
    ['how soon missing', good({ when: undefined }), 'missing_when'],
    ['bad mobile', good({ mobile: '12345' }), 'invalid_mobile'],
    ['bad email', good({ email: 'maria@' }), 'invalid_email']
  ];
  cases.forEach(([name, data, want]) => {
    const res = post(data);
    check(name + ' -> ' + want, res.ok === false && res.error === want, JSON.stringify(res));
  });
  check('no rows written', sheet().getLastRow() === 1);
  check('no emails sent', W.mail.length === 0);
});

test('Hostile text is stored as text and trimmed', () => {
  world(); W.run('setup()');
  post(good({ business: '=IMPORTXML("http://evil","//a")', name: '  Maria \n  Santos  ', location: 'x'.repeat(500) }));
  const row = sheet().rows[1];
  check('formula-looking text is stored in a plain-text cell', row[2] === '=IMPORTXML("http://evil","//a")' && sheet().formats['2:3'] === '@');
  check('whitespace collapsed', row[1] === 'Maria Santos', JSON.stringify(row[1]));
  check('long field cut to 200', row[4].length === 200);
});

test('A failed notification email still saves the sign-up', () => {
  world({ mailFails: m => m.to === 'helloagos.ph@gmail.com' }); W.run('setup()');
  const res = post(good());
  check('replies ok', res.ok === true);
  check('row saved', sheet().getLastRow() === 2);
  check('failure logged', W.errors.some(e => /notification email failed/.test(e)));
  check('the welcome still goes out', W.mail.length === 1 && W.mail[0].to === 'maria@bayside.ph' && sheet().rows[1][18] === 'Yes');
});

test('Busy lock -> friendly error, nothing half-written', () => {
  world({ lockBusy: true }); W.run('setup()');
  const res = post(good());
  check('replies busy', res.ok === false && res.error === 'busy');
  check('no row, no email', sheet().getLastRow() === 1 && W.mail.length === 0);
});

test('doGet answers so the deployment can be checked in a browser', () => {
  world();
  check('ok', JSON.parse(W.run('doGet()').getContent()).ok === true);
});

test('Agos Verified gate: nothing is forwarded to lenders before verification', () => {
  world(); W.run('setup()');
  post(good()); post(good({ name: 'Second' }));

  edit(2, FORWARDED, true);
  check('Forwarded tick on an unverified row is undone', sheet().cell(2, FORWARDED) === false);
  check('no Forwarded on date', sheet().cell(2, FORWARDED_ON) === '');
  check('team is told why', W.book.toasts.length === 1 && /Agos Verified/.test(W.book.toasts[0]), W.book.toasts.join());

  edit(2, VERIFIED, true);
  check('Verified tick stamps Verified on', /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(sheet().cell(2, VERIFIED_ON)), sheet().cell(2, VERIFIED_ON));
  const stamped = sheet().cell(2, VERIFIED_ON);

  edit(2, FORWARDED, true);
  check('Forwarded tick on a verified row stays', sheet().cell(2, FORWARDED) === true);
  check('and stamps Forwarded on', /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(sheet().cell(2, FORWARDED_ON)));
  check('no new warning', W.book.toasts.length === 1);
  check('Verified on is not restamped', sheet().cell(2, VERIFIED_ON) === stamped);

  check('the other row is untouched', sheet().cell(3, VERIFIED) === false && sheet().cell(3, FORWARDED) === false);

  edit(2, VERIFIED, false);
  check('unticking Verified clears Verified on', sheet().cell(2, VERIFIED_ON) === '');
  check('but does not rewrite that it was already forwarded', sheet().cell(2, FORWARDED) === true);

  edit(2, FORWARDED, false);
  check('unticking Forwarded clears Forwarded on', sheet().cell(2, FORWARDED_ON) === '');
});

test('Agos Verified gate: pasting ticks over several rows', () => {
  world(); W.run('setup()');
  post(good({ name: 'A' })); post(good({ name: 'B' })); post(good({ name: 'C' }));
  edit(3, VERIFIED, true);
  [2, 3, 4].forEach(r => sheet().put(r, FORWARDED, true));
  W.ctx.__e = { range: sheet().getRange(2, FORWARDED, 3, 1), source: W.book };
  W.run('onEdit(__e)');
  check('only the verified row keeps its Forwarded tick',
    [2, 3, 4].map(r => sheet().cell(r, FORWARDED)).join() === 'false,true,false',
    [2, 3, 4].map(r => sheet().cell(r, FORWARDED)).join());
  check('one warning for the paste', W.book.toasts.length === 1);
});

test('Edits elsewhere are ignored', () => {
  world(); W.run('setup()');
  post(good());
  const before = JSON.stringify(sheet().getRange(1, 1, 2, 17).getValues());
  edit(2, 18, 'called, sending docs Friday');
  check('Notes edit changes nothing else', JSON.stringify(sheet().getRange(1, 1, 2, 17).getValues()) === before &&
    sheet().cell(2, 18) === 'called, sending docs Friday');
  W.book.insertSheet('Lenders').put(2, FORWARDED, true);
  W.ctx.__e = { range: W.book.getSheetByName('Lenders').getRange(2, FORWARDED), source: W.book };
  W.run('onEdit(__e)');
  check('other tabs are left alone', W.book.getSheetByName('Lenders').cell(2, FORWARDED) === true && W.book.toasts.length === 0);
  edit(1, FORWARDED, 'Forwarded to lenders');
  check('header row is left alone', sheet().cell(1, FORWARDED) === 'Forwarded to lenders');
});


// ------------------------------------------------------------- welcome email

const BRIEF = fs.readFileSync(path.join(__dirname, 'BRIEF-welcome-email.md'), 'utf8');
const BRIEF_TEXT = BRIEF.split('## The welcome email (plain-text version)')[1].split('```')[1].replace(/^\n/, '').replace(/\n$/, '');
function welcomes() { return W.mail.filter(m => m.to !== 'helloagos.ph@gmail.com'); }
const WELCOME = 19;

test('Welcome email: from Agos, only to the applicant, word for word from the brief', () => {
  world(); W.run('setup()');
  post(good({ name: 'Maria Clara Santos', business: 'Bayside Customs Brokerage' }));
  const w = welcomes();
  check('exactly one welcome', w.length === 1);
  check('sent to the typed address only, no cc or bcc', w[0].to === 'maria@bayside.ph' && !w[0].cc && !w[0].bcc, JSON.stringify(Object.keys(w[0])));
  check('shows as "Agos", replies go to helloagos', w[0].name === 'Agos' && w[0].replyTo === 'helloagos.ph@gmail.com');
  check('subject uses the first name', w[0].subject === 'Welcome to Agos, Maria', w[0].subject);
  const want = BRIEF_TEXT.replace(/\{FirstName\}/g, 'Maria').replace(/\{Business\}/g, 'Bayside Customs Brokerage');
  check('plain text matches the brief exactly', w[0].body === want,
    (() => { const a = w[0].body.split('\n'), b = want.split('\n'); const i = a.findIndex((l, k) => l !== b[k]); return 'line ' + (i + 1) + ': ' + JSON.stringify(a[i]) + ' vs ' + JSON.stringify(b[i]); })());
  check('brief text was found (sanity)', /Salamat,/.test(BRIEF_TEXT) && /\{Business\}/.test(BRIEF_TEXT));
  check('Welcome sent = Yes', sheet().rows[1][WELCOME - 1] === 'Yes');
  check('header row ends with Welcome sent', sheet().rows[0][WELCOME - 1] === 'Welcome sent' && sheet().rows[0].length === WELCOME);
  check('notification went first', W.mail[0].to === 'helloagos.ph@gmail.com');
});

test('Welcome email HTML: simple, readable, links, and every form value escaped', () => {
  world(); W.run('setup()');
  post(good({ name: '<b>Juan</b> & Co', business: 'Bayside "Customs" <script>alert(1)</script> & Sons' }));
  const h = welcomes()[0].htmlBody;
  check('white background, system font at 16px, max-width 560px',
    /background:#ffffff/.test(h) && /font-size:16px/.test(h) && /max-width:560px/.test(h) && /-apple-system/.test(h));
  check('clickable website link', /<a href="https:\/\/agosph\.netlify\.app"/.test(h));
  check('clickable email link', /<a href="mailto:helloagos\.ph@gmail\.com"/.test(h));
  check('no raw tags from the form', !/<script>|<b>Juan/.test(h));
  check('values escaped', h.includes('&lt;b&gt;Juan&lt;/b&gt;') && h.includes('Bayside &quot;Customs&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; Sons'));
  check('same wording as the text version', ['We review your details.', 'We never share your information with a lender without your approval.',
    'BIR-stamped ITR, 6 months of bank statements, and a valid ID.', 'Just reply to this email.', 'The lender makes the final decision.']
    .every(t => h.includes(t)));
});

test('Test sign-ups get no welcome; real names that merely contain "test" do', () => {
  world(); W.run('setup()');
  [['TEST Juan', 'Bayside'], ['Maria', 'test delete me'], ['Maria', 'Testing Co'], ['Juan-Test', 'Bayside']].forEach(([n, b]) => post(good({ name: n, business: b })));
  check('four rows, all "No (test)"', [1, 2, 3, 4].map(r => sheet().rows[r][WELCOME - 1]).join() === 'No (test),No (test),No (test),No (test)',
    [1, 2, 3, 4].map(r => sheet().rows[r][WELCOME - 1]).join());
  check('no welcome emails', welcomes().length === 0);
  check('the team is still notified of each', W.mail.length === 4);
  post(good({ business: 'Fastest Cargo Movers' })); post(good({ business: 'Contest Freight' })); post(good({ name: 'Celeste' }));
  check('"Fastest", "Contest", "Celeste" are welcomed', [5, 6, 7].map(r => sheet().rows[r][WELCOME - 1]).join() === 'Yes,Yes,Yes' && welcomes().length === 3);
  W.run('testSignup()');
  check('testSignup() in the editor never emails anyone but the team', welcomes().length === 3 && sheet().rows[8][WELCOME - 1] === 'No (test)');
});

test('Wrong account: the welcome is never sent from anything but helloagos', () => {
  world({ account: 'ops.philindo@gmail.com' }); W.run('setup()');
  const res = post(good());
  check('sign-up still saved and ok', res.ok === true && sheet().getLastRow() === 2);
  check('no email to the applicant', welcomes().length === 0);
  check('Welcome sent = Not sent (wrong account)', sheet().rows[1][WELCOME - 1] === 'Not sent (wrong account)');
  world({ account: 'HelloAgos.PH@gmail.com' }); W.run('setup()'); post(good());
  check('account check ignores capital letters', sheet().rows[1][WELCOME - 1] === 'Yes');
  world({ account: null }); W.run('setup()'); post(good());
  check('account unknown -> not sent', sheet().rows[1][WELCOME - 1] === 'Not sent (wrong account)' && welcomes().length === 0);
});

test('A failed welcome never costs the row or the notification', () => {
  world({ mailFails: m => m.to !== 'helloagos.ph@gmail.com' }); W.run('setup()');
  const res = post(good());
  check('replies ok', res.ok === true);
  check('row saved and team notified', sheet().getLastRow() === 2 && W.mail.length === 1 && W.mail[0].to === 'helloagos.ph@gmail.com');
  check('Welcome sent = Failed', sheet().rows[1][WELCOME - 1] === 'Failed');
  check('failure logged', W.errors.some(e => /welcome email failed/.test(e)));
});

test('An address that could reach a second person is never used', () => {
  world(); W.run('setup()');
  post(good({ email: 'maria@bayside.ph;x' }));
  check('saved (it passed the form check), but no welcome', sheet().getLastRow() === 2 && welcomes().length === 0);
  check('Welcome sent = No (invalid email)', sheet().rows[1][WELCOME - 1] === 'No (invalid email)');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
