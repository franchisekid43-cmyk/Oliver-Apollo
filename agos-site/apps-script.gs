/**
 * Agos sign-ups: Google Apps Script bound to the "Agos Sign-ups" Google Sheet.
 *
 * The landing page POSTs each sign-up here (text/plain body, JSON inside).
 * doPost checks it, saves one row, and emails helloagos.ph@gmail.com.
 *
 * Agos Verified rule: every sign-up arrives NOT verified. The team ticks
 * "Agos Verified" only after checking the business and its documents, and
 * forwards requirements to lenders only after that. The sheet refuses a
 * "Forwarded to lenders" tick on a row that is not Agos Verified.
 *
 * Welcome email: each applicant gets one, from helloagos.ph@gmail.com as
 * "Agos", sent only to the address they typed. It is sent only when the
 * script runs as the Agos account, so no other address can ever reach an
 * applicant. The result goes in the "Welcome sent" column.
 *
 * Install and deploy: agos-site/README.md, step 1.
 */

var AGOS_ACCOUNT = 'helloagos.ph@gmail.com';   // the only account allowed to email applicants
var NOTIFY_TO = AGOS_ACCOUNT;
var SITE_URL = 'https://agosph.netlify.app';
var SHEET_TAB = 'Sign-ups';
var TZ = 'Asia/Manila';
var MIN_FILL_MS = 3000;   // faster than this after page load = a bot
var MAX_LEN = 200;        // per field; the source page gets 500

var HEADERS = [
  'Timestamp (Asia/Manila)', 'Name', 'Business', 'Type', 'Location', 'Years', 'Monthly billings',
  'Amount needed', 'How soon', 'Mobile', 'Email', 'Consent', 'Source page',
  // Agos Verified workflow, filled in by the team
  'Agos Verified', 'Verified on', 'Forwarded to lenders', 'Forwarded on', 'Notes',
  'Welcome sent'
];
var COL_VERIFIED = HEADERS.indexOf('Agos Verified') + 1;           // 14; 'Verified on' is next
var COL_FORWARDED = HEADERS.indexOf('Forwarded to lenders') + 1;   // 16; 'Forwarded on' is next
var COL_WELCOME = HEADERS.indexOf('Welcome sent') + 1;             // 19

// Form fields, in sheet order after the timestamp. All required.
var FIELDS = ['name', 'business', 'type', 'location', 'years', 'billings', 'amount', 'when', 'mobile', 'email'];

// A test sign-up: a word in the Name or Business starting with "test", any case ("TEST", "Test Co",
// "Testing"). "Fastest Cargo" and "Contest Freight" are real businesses and still get their welcome.
var TEST_WORD = /\btest/i;
// One plain address: exactly one @, no commas, semicolons or brackets that could add another recipient.
var ONE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

// ------------------------------------------------------------------ web app

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return reply_({ ok: false, error: 'bad_request' });
  }
  var problem = problem_(data);
  if (problem) return reply_({ ok: false, error: problem });

  var s = clean_(data);
  var received = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
  var values = [received].concat(FIELDS.map(function (f) { return s[f]; }), ['Yes', s.sourcePage]);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return reply_({ ok: false, error: 'busy' });
  }
  var sheet, row;
  try {
    sheet = signupSheet_();
    row = sheet.getLastRow() + 1;
    // Plain text keeps the 0 in 09xx numbers and stores anything starting with = as text, not a formula.
    sheet.getRange(row, 1, 1, values.length).setNumberFormat('@').setValues([values]);
    sheet.getRange(row, COL_VERIFIED).insertCheckboxes();
    sheet.getRange(row, COL_FORWARDED).insertCheckboxes();
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  try {
    MailApp.sendEmail({
      to: NOTIFY_TO,
      subject: 'New Agos sign-up: ' + [s.business, s.type, s.location, s.amount].join(', '),
      body: notification_(s, received, sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + row)
    });
  } catch (err) {
    // The row is saved; a failed email must not turn the sign-up into an error.
    console.error('Agos notification email failed: ' + err);
  }

  try {
    sheet.getRange(row, COL_WELCOME).setValue(sendWelcome_(s));
  } catch (err) {
    console.error('Agos welcome status not written: ' + err);
  }
  return reply_({ ok: true });
}

// Opening the Web App URL in a browser shows this: a quick check that the deployment is live.
function doGet() {
  return reply_({ ok: true, service: 'agos-signups' });
}

// ------------------------------------------------------------ welcome email

/**
 * Emails the applicant, and returns what goes in "Welcome sent": Yes, No (test),
 * Not sent (wrong account), No (invalid email) or Failed. Never throws.
 */
function sendWelcome_(s) {
  if (TEST_WORD.test(s.name) || TEST_WORD.test(s.business)) return 'No (test)';
  var sender = '';
  try {
    sender = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  } catch (err) {
    console.error('Agos welcome: could not read the sending account: ' + err);
  }
  if (sender !== AGOS_ACCOUNT) return 'Not sent (wrong account)';
  if (!ONE_ADDRESS.test(s.email)) return 'No (invalid email)';

  var first = s.name.split(' ')[0];
  try {
    MailApp.sendEmail({
      to: s.email,
      name: 'Agos',
      replyTo: AGOS_ACCOUNT,
      subject: 'Welcome to Agos, ' + first,
      body: welcomeText_(first, s.business),
      htmlBody: welcomeHtml_(first, s.business)
    });
    return 'Yes';
  } catch (err) {
    console.error('Agos welcome email failed: ' + err);
    return 'Failed';
  }
}

function welcomeText_(first, business) {
  return [
    'Hi ' + first + ',',
    '',
    'Thanks for signing up ' + business + ' to Agos. We\'ve received your details.',
    '',
    'Here\'s what happens next:',
    '1. We review your details.',
    '2. When there\'s a lender that fits your business, the Agos team will reach out to you first. ' +
      'We never share your information with a lender without your approval.',
    '',
    'You don\'t need to send any documents yet. If you\'d like to get ready, lenders usually ask for your ' +
      'SEC or DTI registration, mayor\'s permit, BIR-stamped ITR, 6 months of bank statements, and a valid ID.',
    '',
    'Agos is free for businesses. We will never ask you for payment. If anyone asks you to pay to ' +
      '"get approved" in the name of Agos, please tell us.',
    '',
    'Need to update your details or have a question? Just reply to this email.',
    '',
    'Salamat,',
    'The Agos Team',
    AGOS_ACCOUNT,
    SITE_URL,
    '',
    'Agos is not a lender. We help logistics businesses connect with SEC-registered financing and ' +
      'lending companies. The lender makes the final decision.'
  ].join('\n');
}

// The same text as welcomeText_, as simple HTML. Every form value goes through esc_.
function welcomeHtml_(first, business) {
  var p = '<p style="margin:0 0 16px">';
  var link = 'color:#0A5BD3;text-decoration:underline';
  return '<!doctype html><html><body style="margin:0;padding:0;background:#ffffff">' +
    '<div style="max-width:560px;margin:0 auto;padding:24px 20px;background:#ffffff;color:#16161A;' +
    'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;' +
    'font-size:16px;line-height:1.55">' +
    p + 'Hi ' + esc_(first) + ',</p>' +
    p + 'Thanks for signing up ' + esc_(business) + ' to Agos. We&#39;ve received your details.</p>' +
    '<p style="margin:0 0 8px">Here&#39;s what happens next:</p>' +
    '<ol style="margin:0 0 16px;padding-left:24px">' +
    '<li style="margin:0 0 6px">We review your details.</li>' +
    '<li>When there&#39;s a lender that fits your business, the Agos team will reach out to you first. ' +
    'We never share your information with a lender without your approval.</li></ol>' +
    p + 'You don&#39;t need to send any documents yet. If you&#39;d like to get ready, lenders usually ask for ' +
    'your SEC or DTI registration, mayor&#39;s permit, BIR-stamped ITR, 6 months of bank statements, and a valid ID.</p>' +
    p + 'Agos is free for businesses. We will never ask you for payment. If anyone asks you to pay to ' +
    '&quot;get approved&quot; in the name of Agos, please tell us.</p>' +
    p + 'Need to update your details or have a question? Just reply to this email.</p>' +
    p + 'Salamat,<br>The Agos Team<br>' +
    '<a href="mailto:' + AGOS_ACCOUNT + '" style="' + link + '">' + AGOS_ACCOUNT + '</a><br>' +
    '<a href="' + SITE_URL + '" style="' + link + '">' + SITE_URL.replace('https://', '') + '</a></p>' +
    '<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #E2E4EA;color:#696972">' +
    'Agos is not a lender. We help logistics businesses connect with SEC-registered financing and ' +
    'lending companies. The lender makes the final decision.</p>' +
    '</div></body></html>';
}

function esc_(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --------------------------------------------------------- Agos Verified gate

/**
 * Simple trigger: runs on every manual edit. Stamps "Verified on" and
 * "Forwarded on", and undoes a "Forwarded to lenders" tick on any row that
 * is not Agos Verified.
 */
function onEdit(e) {
  var range = e && e.range;
  if (!range) return;
  var sheet = range.getSheet();
  if (sheet.getName() !== SHEET_TAB) return;

  var c1 = range.getColumn(), c2 = range.getLastColumn();
  var hitVerified = c1 <= COL_VERIFIED && COL_VERIFIED <= c2;
  var hitForwarded = c1 <= COL_FORWARDED && COL_FORWARDED <= c2;
  if (!hitVerified && !hitForwarded) return;
  var r1 = Math.max(range.getRow(), 2), r2 = range.getLastRow();
  if (r2 < r1) return;

  var n = r2 - r1 + 1;
  var block = sheet.getRange(r1, COL_VERIFIED, n, 4).getValues();   // verified, verified on, forwarded, forwarded on
  var now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  var refused = 0;
  for (var i = 0; i < n; i++) {
    var verified = block[i][0] === true, forwarded = block[i][2] === true;
    if (hitForwarded && forwarded && !verified) { block[i][2] = false; forwarded = false; refused++; }
    if (hitVerified) block[i][1] = verified ? (block[i][1] || now) : '';
    if (hitForwarded) block[i][3] = forwarded ? (block[i][3] || now) : '';
  }
  sheet.getRange(r1, COL_VERIFIED, n, 4).setValues(block);
  if (refused) {
    e.source.toast('Tick "Agos Verified" first. Requirements go to lenders only after the customer is Agos Verified.',
      'Not Agos Verified yet', 10);
  }
}

// ------------------------------------------------------------------- set up

/** Run once from the Apps Script editor: creates the Sign-ups tab and its headers. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // The web app opens the Sheet by this ID: in a web request there may be no "active" spreadsheet.
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  ss.setSpreadsheetTimeZone(TZ);
  var sheet = signupSheet_();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange(1, COL_VERIFIED, 1, 4).setBackground('#EAF1FD');
  sheet.getRange(1, COL_VERIFIED).setNote(
    'Tick only after checking the business and every document in its file: complete, current and consistent. ' +
    'Nothing goes to lenders before this.');
  sheet.getRange(1, COL_FORWARDED).setNote(
    'Tick when the requirements are sent to lenders, with the customer\'s approval. ' +
    'The sheet refuses this tick until "Agos Verified" is ticked.');
  sheet.getRange(1, COL_WELCOME).setNote(
    'Filled in by the script: Yes, No (test), Not sent (wrong account), No (invalid email) or Failed.');
  return 'Ready: ' + ss.getName() + ' / ' + SHEET_TAB;
}

/** Optional: run from the editor to check the row and the email before going live. Delete the TEST row after. */
function testSignup() {
  var res = doPost({ postData: { contents: JSON.stringify({
    name: 'TEST Juan dela Cruz', business: 'TEST Bayside Customs Brokerage', type: 'Customs broker',
    location: 'Pasay', years: '3 to 5 years', billings: '₱500K to ₱2M', amount: '₱500K to ₱2M',
    when: 'Within a month', mobile: '0917 123 4567', email: 'test@example.com', consent: true,
    website: '', elapsedMs: 60000, sourcePage: 'apps-script testSignup'
  }) } });
  return res.getContent();
}

// ------------------------------------------------------------------ helpers

function book_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function signupSheet_() {
  var ss = book_();
  var sheet = ss.getSheetByName(SHEET_TAB);
  if (sheet) return sheet;
  var sheets = ss.getSheets();
  // A brand-new spreadsheet has one empty "Sheet1": reuse it rather than leave it lying around.
  if (sheets.length === 1 && sheets[0].getLastRow() === 0) return sheets[0].setName(SHEET_TAB);
  return ss.insertSheet(SHEET_TAB);
}

function problem_(d) {
  if (!d || typeof d !== 'object') return 'bad_request';
  if (d.website) return 'rejected';                                   // honeypot filled
  if (!(Number(d.elapsedMs) >= MIN_FILL_MS)) return 'rejected';       // too fast, or no timing at all
  if (d.consent !== true) return 'consent_required';
  for (var i = 0; i < FIELDS.length; i++) {
    var v = d[FIELDS[i]];
    if (typeof v !== 'string' || !v.trim()) return 'missing_' + FIELDS[i];
  }
  if (!/^09\d{9}$/.test(d.mobile.replace(/[\s-]/g, ''))) return 'invalid_mobile';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'invalid_email';
  return '';
}

function clean_(d) {
  var s = {};
  FIELDS.forEach(function (f) { s[f] = String(d[f]).replace(/\s+/g, ' ').trim().slice(0, MAX_LEN); });
  s.mobile = s.mobile.replace(/[\s-]/g, '');
  s.sourcePage = String(d.sourcePage || '').trim().slice(0, 500);
  return s;
}

function notification_(s, received, rowUrl) {
  return [
    'New sign-up on the Agos website.',
    '',
    'Name: ' + s.name,
    'Business: ' + s.business,
    'Type: ' + s.type,
    'Location: ' + s.location,
    'Years operating: ' + s.years,
    'Monthly billings: ' + s.billings,
    'Financing needed: ' + s.amount,
    'How soon: ' + s.when,
    'Mobile: ' + s.mobile,
    'Email: ' + s.email,
    'Consent: Yes',
    'Source page: ' + s.sourcePage,
    'Received: ' + received + ' (Manila)',
    '',
    'Status: NOT YET AGOS VERIFIED.',
    'Check the business and its documents, then tick "Agos Verified" in the sheet.',
    'Do not forward anything to lenders before that.',
    '',
    'Sheet: ' + rowUrl
  ].join('\n');
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
