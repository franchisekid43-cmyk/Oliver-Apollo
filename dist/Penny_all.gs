/** PENNY — all six files in one. Paste into ONE file (Code.gs) in the Apps Script project bound to Philindo Shipments Feed. Generated from penny/*.gs — edit those, not this. */

// ======================= Config.gs =======================
/**
 * PENNY — Pending Shipments Agent
 * Philindo Container Express Inc.
 *
 * Owns ATA -> delivered. Nico owns delivered -> billed.
 * The delivery date is the handoff.
 *
 * READ-ONLY against every existing Philindo sheet.
 * Penny's ONLY writes are to sheets she creates herself:
 *   - Penny Arrivals    (her own summary)
 *   - Penny Monthly     (her own generated report)
 * LogiSys Live and LogiSys Archive are written by the importer; Penny
 * only reads them.
 * She never touches the CA Tracker, Billing Tracker, Manifest Control,
 * or any Philindo web app.
 */

const CONFIG = {

  // ---- Identity -------------------------------------------------------
  AGENT: 'Penny',
  // Penny's emails are sent from the Google account that runs her, so she
  // must be installed (setup()) signed in as this account. If she finds
  // herself running as anyone else she stops and tells the COO.
  SENDER_ACCOUNT: 'ops.philindo@gmail.com',

  // ---- Team emails — ONE switch ----------------------------------------
  // false: handlers and Ariel receive NOTHING; only the COO's email goes out,
  //        with every pending shipment and its handler in it.
  // true:  each handler and Ariel get their own email as well.
  // Off until the COO says so (28 Sep 2026).
  TEAM_EMAILS: false,

  // ---- Ariel's daily update list — its own email, its own time ----------
  // Ariel gets the shipments he needs to update in LogiSys (stale status, no
  // ETA, arrival date to confirm) in ONE email at this time, Monday to Friday.
  // Independent of TEAM_EMAILS: on even while the rest of the team is off.
  // COO's decision, 29 Sep 2026.
  ARIEL_REMINDER: true,
  ARIEL_HOUR: 10,
  ARIEL_MINUTE: 0,

  // ---- Shadow mode ------------------------------------------------------
  // While this holds an address, every email Penny sends goes to it instead,
  // with a line at the top naming who it was for. '' = send for real.
  SHADOW_TO: '',

  // ---- Schedule -------------------------------------------------------
  SEND_HOUR: 7,
  SEND_MINUTE: 45,            // Penny 07:45, Nico 08:00
  MONTHLY_REPORT_DAY: 7,      // arrivals report generated on the 7th
  TZ: 'Asia/Manila',

  // Feed intake (sender, subjects, label, column maps) lives in the
  // importer's own project — see importer/Importer.gs. Penny only reads.

  // ---- Scope cutoff ----------------------------------------------------
  // LogiSys is not updated as reliably as the CA Tracker. Anything anchored
  // before this date is treated as already delivered and is out of scope,
  // whatever its status says. COO's rule, 28 Sep 2026.
  SCOPE_FROM: new Date(2026, 8, 1),   // 1 September 2026

  // ---- Arrival source — ONE switch -------------------------------------
  // LogiSys writes its ETA into the ATA field, so while Ariel maintains the
  // tracker separately the LogiSys ATA is not trusted on its own
  // (28 Sep 2026: 33 of 87 arrival dates disagreed, all one direction).
  //   false -> arrival = post-arrival status milestone, then the LogiSys ATA
  //            only where it differs from that row's own ETA
  //   true  -> arrival = the LogiSys ATA as written
  // Flip to true once Ariel updates LogiSys directly. Nothing else changes.
  TRUST_LOGISYS_ATA: false,

  // ---- Where the shipments come from — ONE switch ------------------------
  //   'philindo-one' -> Philindo One's read-only Penny feed (/api/ops/penny-feed):
  //                     the jobs as the team keeps them there, handlers from the
  //                     client's assigned handler, and every ETA change.
  //   'sheet'        -> the LogiSys Live / LogiSys Archive sheets (the importer's).
  // If Philindo One can't be read, Penny uses the sheet that morning and says so
  // in the COO's email — she never skips a day because of it.
  // The token is NOT kept here: Project Settings -> Script Properties ->
  // PENNY_FEED_TOKEN, the same value as PENNY_FEED_TOKEN in Vercel.
  FEED_SOURCE: 'philindo-one',
  PHILINDO_ONE_URL: 'https://philindo-command-center-git-ops-system-philindo.vercel.app',

  // ---- Spreadsheets ---------------------------------------------------
  // The workbook holding LogiSys Live + LogiSys Archive (written by importer).
  // Leave blank to use the spreadsheet this script is bound to.
  FEED_SPREADSHEET_ID: '',
  SHEET_LIVE: 'LogiSys Live',
  SHEET_ARCHIVE: 'LogiSys Archive',

  // Penny's own output sheets (she creates these)
  SHEET_ARRIVALS: 'Penny Arrivals',
  SHEET_MONTHLY_PREFIX: 'Penny Monthly',

  // CA Tracker — READ ONLY
  CA_TRACKER_ID: '1YGG27KbsZUalEI-UekGk4nUnq3yttMM9w6kGo1-gSc8',
  CA_TAB: 'CA Tracker',
  CA_HEADER_ROW: 2,

  // ---- Recipients -----------------------------------------------------
  // Deliberately absent: Juan Carlos Uy (post-delivery = Nico's),
  // the billing team, the CFO and the President. Do not add them.
  RECIPIENTS: {
    coo: 'transport@philindo.com.ph',
    support: 'arielcaingcoy@philindo.com.ph',   // Ariel Caingcoy
    handlers: {
      'Kim Angelu Kong': 'kimkong@philindo.com.ph',
      'Jena Lucido': 'jenalucido@philindo.com.ph',
      'Cherry Alarcon': 'cherryalarcon@philindo.com.ph',
      'Jimmy Rapera': 'jimmyrapera@philindo.com.ph',
      'Andrew Mausig': '',             // FILL IN — copy from Nico
      'Jasmin Sawal': ''               // FILL IN — copy from Nico
    }
  },

  // ---- Free time (Philindo actual terms) ------------------------------
  STORAGE_FREE_DAYS: 5,      // port storage MAX free -> charges from day 6
  DEMURRAGE_FREE_DAYS: 7,    // line container MIN free -> charges from day 8

  // ---- Thresholds (calendar days) -------------------------------------
  // Queue 1 red and critical are NOT set here — they are derived from the
  // free time above by q1Thresholds_(): critical = first charge day,
  // red = RED_LEAD_DAYS before it. Change a free period and they move.
  Q1_AMBER: 2,               // arrived, not delivered
  RED_LEAD_DAYS: 2,          // red always sits this many days before the first charge

  Q2_ETA_WINDOW: 3,          // in transit, arriving within N days

  Q4_STALE_RED: 8,           // status not moved in 8+ days

  Q5A_AMBER_ETD_PAST: 1,     // no ETA, ETD passed 1-3 days
  Q5A_RED_ETD_PAST: 4,       // no ETA, ETD passed 4+ days
  Q5B_AMBER_LATER: 2,        // ETA moved 2-4 days later
  Q5B_RED_LATER: 5,          // ETA moved 5+ days later
  Q5B_RED_EARLIER: 2,        // ETA moved 2+ days EARLIER = red, always
  Q5C_AMBER: 1,              // ETA passed, no ATA
  Q5C_RED: 3,

  // ---- Client lead-time overrides (win over general thresholds) --------
  CLIENT_SLA: {
    'UNILAB': { Air: 3, Sea: 4 },      // air under 72h, sea under 4 days
    'DEFAULT': { Air: 4, Sea: 4 }
  },
  UNILAB_PHARMA_SLA_WORKING_DAYS: 7,

  // Unilab Indonesia pharma lane: Unilab + a loading port matching this
  UNILAB_PHARMA_PORTS: ['indonesia','jakarta','tanjung priok','surabaya','semarang','belawan','idjkt','idsub'],

  // ---- Date sanity -----------------------------------------------------
  DATE_MIN: new Date(2024, 0, 1),
  DATE_MAX: new Date(2027, 11, 31),

  // ---- Handlers on record ----------------------------------------------
  HANDLERS: ['Kim Angelu Kong','Jena Lucido','Cherry Alarcon',
             'Jimmy Rapera','Andrew Mausig','Jasmin Sawal'],

  // ---- Cash advance funding -------------------------------------------
  // CA Tracker "Release Status" is about MONEY leaving the company, not
  // about the shipment leaving the port. Three states matter:
  //   Released            -> funded
  //   Partially Released  -> partial. Shipments CAN be delivered on a
  //                          partial release, so this is not an alarm.
  //   Not Released        -> unfunded. This is the one to flag.

  // ---- Status ladder (real LogiSys milestone values) --------------------
  // There is NO Delivery Date column in the LogiSys feed, so delivery is
  // determined by status. Confirmed by the COO 28 Sep 2026: "Container
  // Delivery Date" and "Delivery Advised to Client" both mean delivered.
  STATUS_DELIVERED: [
    'job completed',
    'empty container received after delivery',
    'container delivery date',
    'delivery advised to client'
  ],
  // Everything else, roughly in order, for reporting the stage:
  STATUS_STAGES: {
    'vessel one departed': 'In transit',
    'flight one departed': 'In transit',
    'vessel one reached': 'Arrived',
    'container discharged': 'Arrived',
    'draft documents received': 'Clearing',
    'original docs received': 'Clearing',
    'checking of documents': 'Clearing',
    'lodgement of shipment': 'Clearing',
    'cdt approval': 'Clearing',
    'payment of duties and taxes': 'Clearing',
    'do issued': 'Released',
    'gatepass released': 'Released'
  },
  // Milestones that only happen AFTER arrival. With TRUST_LOGISYS_ATA off,
  // these are what say a shipment has arrived. ("Vessel One Reached" is
  // deliberately absent: vessel one can be a transhipment leg.)
  STATUS_POST_ARRIVAL: ['container discharged','do issued','gatepass released',
                        'payment of duties and taxes','final assesment','final assessment'],

  // ---- Never contacted — checked before every send ---------------------
  NEVER_CONTACT: ['juan carlos','raphael ramos','billing','pablo franco',
                  'oliver osias','cfo','president']
};

// Headers Penny cannot run without. Delivery is read from 'Delivered',
// 'Delivery Date' (if present) or a delivered status, so neither is required.
const LIVE_REQUIRED = ['JO Number','Client','Mode','ETD','ETA','ATA','Status',
                       'Account Handler','Last Updated','Source Report Date'];

// LogiSys Live schema contract. The importer writes these exact headers,
// normalised from the two LogiSys register exports (SEA and AIR).
// 'Delivered' holds the report date on which the JO was FIRST reported with
// a delivered status (LogiSys carries no delivery date); blank otherwise.
const FEED_HEADERS = [
  'JO Number','FSA Number','BL/AWB','House BL/AWB','Shipper','Client',
  'Mode','Cargo Type','Loading Port','Discharge Port','Place Of Receipt',
  'Place Of Delivery','Shipment Date','ETD','ATD','ETA','ATA',
  'Containers 20ft','Containers 40ft','Containers 45ft','Container Nos',
  'Total Packages','Unit','Goods Description','Airline','Flight No',
  'Status','Stage','Delivered','Account Handler','Last Updated','Source Report Date',
  'Completed Milestone Date','Job Completed On'
];

// ======================= Lib.gs =======================
/** ============ Helpers: dates, sheets, text ============ */

function tz_()  { return CONFIG.TZ; }
function today_() { return stripTime_(new Date()); }

function stripTime_(d) {
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** True for a Date from any realm (instanceof fails across contexts). */
function isDateObj_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

const MONTHS_ = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

/**
 * Parse a cell to a date, or null. Strict on text: only yyyy-mm-dd and
 * dd-MMM-yyyy are accepted, because "03/04/2026" means different days to
 * different people and a guessed date is worse than a blank one.
 */
function asDate_(v) {
  if (isDateObj_(v)) return stripTime_(v);
  if (typeof v === 'number' && v > 20000 && v < 60000) {          // excel serial
    const u = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  }
  if (typeof v === 'string' && v.trim()) {
    const t = v.trim();
    var y, m, d, x;
    if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(t))) { y = +x[1]; m = +x[2] - 1; d = +x[3]; }
    else if ((x = /^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{4})$/.exec(t)) && (x[2].toLowerCase() in MONTHS_)) {
      y = +x[3]; m = MONTHS_[x[2].toLowerCase()]; d = +x[1];
    } else return null;
    const out = new Date(y, m, d);
    if (y < 100) out.setFullYear(y);                                // keep 0026 as 0026
    if (out.getFullYear() !== y || out.getMonth() !== m || out.getDate() !== d) return null;  // 31 Feb
    return out;
  }
  return null;
}

/** A date we are willing to compute with. Anything else is a data defect. */
function validDate_(v) {
  const d = asDate_(v);
  if (!d) return null;
  if (d < CONFIG.DATE_MIN || d > CONFIG.DATE_MAX) return null;
  return d;
}

/** Non-blank and not a usable date — out of range OR unparseable. */
function isBadDate_(v) {
  if (v === '' || v === null || v === undefined) return false;   // blank is not bad
  if (typeof v === 'string' && !v.trim()) return false;
  return validDate_(v) === null;
}

/** Hours since a timestamp, or null when the cell carries no time of day. */
function hoursSince_(v, now) {
  if (!isDateObj_(v)) return null;
  if (v.getHours() === 0 && v.getMinutes() === 0) return null;
  return (now.getTime() - v.getTime()) / 3600000;
}

function sameDay_(a, b) { return !!a && !!b && stripTime_(a).getTime() === stripTime_(b).getTime(); }

function daysBetween_(a, b) {
  if (!a || !b) return null;
  return Math.round((stripTime_(b) - stripTime_(a)) / 86400000);
}

function workingDaysBetween_(a, b) {
  if (!a || !b) return null;
  let n = 0;
  const d = new Date(stripTime_(a));
  const end = stripTime_(b);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

function isWeekend_(d) { const w = (d || new Date()).getDay(); return w === 0 || w === 6; }

function fmtDate_(d) {
  if (!d) return '';
  return Utilities.formatDate(d, tz_(), 'd MMM');
}
function fmtDateLong_(d) {
  if (!d) return '';
  return Utilities.formatDate(d, tz_(), 'd MMM yyyy');
}
function money_(n) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '';
  return '₱' + Math.round(Number(n)).toLocaleString('en-US');
}
function num_(v) {
  if (typeof v === 'number' && !isNaN(v)) return v;
  const n = Number(String(v === null || v === undefined ? '' : v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Median and p75 only — never the mean. Linear interpolation. */
function percentile_(nums, p) {
  if (!nums.length) return '';
  const a = nums.slice().sort(function (x, y) { return x - y; });
  const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round((a[lo] + (a[hi] - a[lo]) * (i - lo)) * 10) / 10;
}

function norm_(s) { return String(s === null || s === undefined ? '' : s).trim(); }
function lc_(s) { return norm_(s).toLowerCase(); }

function containsAny_(hay, needles) {
  const h = lc_(hay);
  if (!h) return false;
  for (var i = 0; i < needles.length; i++) if (h.indexOf(needles[i]) !== -1) return true;
  return false;
}

/** ============ Shipment facts — one definition each ============ */

/**
 * Queue 1 thresholds, derived from the free time — not chosen.
 * critical = the first day any charge runs; red = RED_LEAD_DAYS before it.
 */
function q1Thresholds_() {
  const firstCharge = Math.min(CONFIG.STORAGE_FREE_DAYS, CONFIG.DEMURRAGE_FREE_DAYS) + 1;
  const red = Math.max(1, firstCharge - CONFIG.RED_LEAD_DAYS);
  return { amber: Math.min(CONFIG.Q1_AMBER, red), red: red, critical: firstCharge };
}

/**
 * Has this shipment arrived, and on what date? The single place the
 * TRUST_LOGISYS_ATA switch is read.
 *   { arrived: bool, date: Date|null, doubt: '' | why the date is not used }
 */
function arrivalOf_(r) {
  const ata = validDate_(r['ATA']);
  const eta = validDate_(r['ETA']);
  if (CONFIG.TRUST_LOGISYS_ATA) return { arrived: !!ata, date: ata, doubt: '' };

  const milestone = containsAny_(r['Status'], CONFIG.STATUS_POST_ARRIVAL);
  const copied = ata && eta && sameDay_(ata, eta);        // LogiSys wrote ETA into ATA
  if (ata && !copied) return { arrived: true, date: ata, doubt: '' };
  if (milestone) {
    return { arrived: true, date: null,
             doubt: ata ? 'ATA shows ' + fmtDate_(ata) + ', the same as the ETA — please confirm the actual arrival date'
                        : 'marked "' + norm_(r['Status']) + '" — ATA not entered yet' };
  }
  return { arrived: false, date: null,
           doubt: copied ? 'ATA equals ETA with no post-arrival milestone — not treated as arrived' : '' };
}

/**
 * Delivered = a delivery date, the Delivered column (a date, or yes), a
 * completed job, the Delivered or Closing stage (Philindo One's rule), or a
 * delivered status.
 */
function isDelivered_(r) {
  if (validDate_(r['Delivery Date']) || validDate_(r['Job Completed On'])) return true;
  const flag = r['Delivered'];
  if (isDateObj_(flag) || asDate_(flag) || /^(y|yes|true|delivered)$/i.test(norm_(flag))) return true;
  if (/^(delivered|closing)$/i.test(norm_(r['Stage']))) return true;
  return containsAny_(r['Status'], CONFIG.STATUS_DELIVERED);
}

/** The date a shipment was delivered, if known, for lead-time medians. */
function deliveredOn_(r) {
  // LogiSys's own completion date first; the importer's "first reported delivered" as fallback.
  return validDate_(r['Delivery Date']) || validDate_(r['Job Completed On']) || validDate_(r['Delivered']);
}

/** Match a free-typed name ("KIM KONG", "kim angelu kong") to a handler. */
function resolveHandler_(name) {
  const n = lc_(name).replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return '';
  const words = n.split(' ');
  for (var i = 0; i < CONFIG.HANDLERS.length; i++) {
    const h = CONFIG.HANDLERS[i];
    const hw = h.toLowerCase().split(' ');
    if (hw.join(' ') === n) return h;
    if (words.indexOf(hw[0]) !== -1 && words.indexOf(hw[hw.length - 1]) !== -1) return h;
  }
  // A first name alone ("Jimmy", as Philindo One writes some handlers), if only one handler has it.
  if (words.length === 1) {
    const hits = CONFIG.HANDLERS.filter(function (h) { return h.toLowerCase().split(' ')[0] === n; });
    if (hits.length === 1) return hits[0];
  }
  return '';
}

/** ============ Sheet access ============ */

function feedBook_() {
  return CONFIG.FEED_SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.FEED_SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Read a tab into objects, resolving columns by HEADER TEXT.
 * Never by column letter — columns get inserted and a letter-indexed
 * script fails silently and names the wrong owner.
 */
function readTab_(ss, tabName, headerRow) {
  const sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error('Sheet not found: "' + tabName + '" in "' + ss.getName() + '"');
  const values = sh.getDataRange().getValues();
  if (values.length < headerRow) return { headers: [], rows: [] };

  const hdr = values[headerRow - 1].map(norm_);
  const idx = {};
  hdr.forEach(function (h, i) { if (h && !(h in idx)) idx[h] = i; });

  const rows = [];
  for (var r = headerRow; r < values.length; r++) {
    const raw = values[r];
    if (!norm_(raw[0])) continue;                 // key column blank -> skip
    const o = { _row: r + 1, _raw: raw };
    Object.keys(idx).forEach(function (h) { o[h] = raw[idx[h]]; });
    rows.push(o);
  }
  return { headers: hdr, rows: rows, sheet: sh };
}

function requireHeaders_(headers, needed, where) {
  const missing = needed.filter(function (h) { return headers.indexOf(h) === -1; });
  if (missing.length) {
    throw new Error('Missing required header(s) in ' + where + ': ' + missing.join(', '));
  }
}

/** Is this a sheet Penny created and owns? */
function isPennyOwned_(name) {
  return name === CONFIG.SHEET_ARRIVALS || name.indexOf(CONFIG.SHEET_MONTHLY_PREFIX + ' ') === 0;
}

/**
 * Get or create one of Penny's OWN sheets. The only door to a writable
 * sheet in the whole script: anything else is refused, loudly.
 */
function ownSheet_(ss, name) {
  if (!isPennyOwned_(name) || ss.getId() === CONFIG.CA_TRACKER_ID) {
    throw new Error('Penny refused to write to "' + name + '" — she writes only to sheets she creates.');
  }
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

// ======================= Queues.gs =======================
/** ============ Load the feed and build the five queues ============ */

/**
 * This morning's shipments. From Philindo One when FEED_SOURCE says so; from
 * LogiSys Live otherwise, or when Philindo One can't be read — then
 * `fallback` says why, and the COO's email carries it.
 */
function loadFeed_() {
  const ss = feedBook_();
  var fallback = '';
  if (CONFIG.FEED_SOURCE === 'philindo-one') {
    try {
      const p = fetchPhilindoOne_();
      return { ss: ss, rows: p.rows, headers: p.headers, source: 'philindo-one', etaHistory: p.etaHistory, fallback: '' };
    } catch (e) {
      fallback = 'Philindo One could not be read (' + e.message + ') — today\'s checks used the LogiSys sheet instead.';
      Logger.log(fallback);
    }
  }
  const live = readTab_(ss, CONFIG.SHEET_LIVE, 1);
  requireHeaders_(live.headers, LIVE_REQUIRED, CONFIG.SHEET_LIVE);
  return { ss: ss, rows: live.rows, headers: live.headers, source: 'sheet', fallback: fallback };
}

/**
 * Philindo One's read-only Penny feed: this year's jobs in the LogiSys Live
 * shape (same headers), plus every ETA change. Read only; Penny never writes
 * to Philindo One. Throws on anything unexpected, so the caller falls back.
 */
function fetchPhilindoOne_() {
  const token = PropertiesService.getScriptProperties().getProperty('PENNY_FEED_TOKEN');
  if (!token) throw new Error('PENNY_FEED_TOKEN is not set in Script Properties');
  const url = CONFIG.PHILINDO_ONE_URL.replace(/\/+$/, '') + '/api/ops/penny-feed';
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true, followRedirects: false
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('HTTP ' + code + (code === 401 ? ', the token does not match Vercel\'s PENNY_FEED_TOKEN' :
                     code === 503 ? ', PENNY_FEED_TOKEN is not set in Vercel' : ''));
  }
  var body;
  try { body = JSON.parse(res.getContentText()); } catch (e) { throw new Error('the feed did not return JSON'); }
  const headers = (body.headers || []).map(norm_);
  requireHeaders_(headers, LIVE_REQUIRED, 'the Philindo One feed');
  const rows = [];
  (body.rows || []).forEach(function (raw, i) {
    if (!norm_(raw[0])) return;
    const o = { _row: i + 2, _raw: raw };
    headers.forEach(function (h, j) { if (h && !(h in o)) o[h] = raw[j] === null ? '' : raw[j]; });
    rows.push(o);
  });
  if (!rows.length) throw new Error('the feed has no jobs');
  return { rows: rows, headers: headers, etaHistory: body.etaHistory || [] };
}

var caReadError_ = '';

/**
 * Handler and cash-advance state per JO, from the CA Tracker (read only).
 * A JO can carry more than one cash advance; their funding is combined.
 */
function handlerMap_() {
  const map = {};
  caReadError_ = '';
  try {
    const ca = SpreadsheetApp.openById(CONFIG.CA_TRACKER_ID);
    const t = readTab_(ca, CONFIG.CA_TAB, CONFIG.CA_HEADER_ROW);
    requireHeaders_(t.headers, ['Job Order Number','Requested By','Release Status',
                                'Balance Remaining to Release'], 'CA Tracker');
    t.rows.forEach(function (r) {
      const jo = norm_(r['Job Order Number']).toUpperCase();
      if (!jo) return;
      const m = map[jo] = map[jo] || { handler: '', statuses: [], fundings: [], balanceToRelease: 0 };
      if (!m.handler) m.handler = norm_(r['Requested By']);
      m.statuses.push(norm_(r['Release Status']));
      m.fundings.push(caFunding_(r['Release Status']));
      m.balanceToRelease += num_(r['Balance Remaining to Release']);
    });
    Object.keys(map).forEach(function (jo) {
      const m = map[jo];
      m.releaseStatus = m.statuses.filter(function (x) { return x; }).join('; ');
      const f = m.fundings;
      m.funding = f.every(function (x) { return x === 'funded'; }) ? 'funded'
                : f.every(function (x) { return x === 'unfunded'; }) ? 'unfunded' : 'partial';
    });
  } catch (e) {
    // Not fatal — Penny degrades to feed-only handlers — but never silent:
    // the COO's email says so.
    caReadError_ = e.message;
    Logger.log('CA Tracker read failed: ' + e.message);
  }
  return map;
}

/** Newest valid Source Report Date in the feed, or null. */
function feedDate_(rows) {
  var newest = null;
  rows.forEach(function (r) {
    const d = validDate_(r['Source Report Date']);
    if (d && (!newest || d > newest)) newest = d;
  });
  return newest;
}

/** Freshness gate. Returns null when fresh, otherwise a reason string. */
function stalenessOfFeed_(rows) {
  if (!rows.length) return 'LogiSys Live is empty';
  const newest = feedDate_(rows);
  if (!newest) return 'no valid Source Report Date in the feed';
  const gap = daysBetween_(newest, today_());
  if (gap > 0) {
    return 'latest LogiSys report is dated ' + fmtDateLong_(newest) +
           ' (' + gap + ' day' + (gap === 1 ? '' : 's') + ' old)';
  }
  return null;
}

/**
 * The rows from this morning's report, one per JO. LogiSys Live is a
 * mirror, so a JO that dropped out of the report keeps its old row with an
 * older Source Report Date — Penny does not chase those.
 * Prefixed duplicates (IMP0826-1174 / AIMP0826-1174) are reported once.
 */
function currentRows_(rows) {
  const newest = feedDate_(rows);
  const byJo = {}, order = [], notes = {};
  rows.forEach(function (r) {
    const d = validDate_(r['Source Report Date']);
    if (!newest || !d || d.getTime() !== newest.getTime()) return;
    const jo = norm_(r['JO Number']);
    if (!jo) return;
    if (byJo[jo]) (notes[jo] = notes[jo] || []).push('listed twice in LogiSys Live — latest row used');
    else order.push(jo);
    byJo[jo] = r;                                            // latest wins
  });
  const skip = {};
  order.forEach(function (jo) {
    const core = jo.slice(1);
    if (/^[A-Za-z]/.test(jo) && core.length > 3 && byJo[core]) {
      skip[jo] = true;
      (notes[core] = notes[core] || []).push('duplicate — also appears as ' + jo + ', reported once');
    }
  });
  return {
    rows: order.filter(function (jo) { return !skip[jo]; }).map(function (jo) { return byJo[jo]; }),
    notes: notes
  };
}

/**
 * Each JO's state as of the most recent EARLIER report, from the archive.
 * The importer archives a row whenever a JO is new or changed, so a JO's
 * latest archive row dated before today IS its state in yesterday's report.
 */
function previousEtas_(ss) {
  const out = {};
  const sh = ss.getSheetByName(CONFIG.SHEET_ARCHIVE);
  if (!sh) return { map: out, available: false };

  const t = readTab_(ss, CONFIG.SHEET_ARCHIVE, 1);
  const T = today_();
  var asOf = null;
  t.rows.forEach(function (r) {
    const d = validDate_(r['Source Report Date']);
    if (!d || d >= T) return;
    const jo = norm_(r['JO Number']);
    if (!jo) return;
    if (!asOf || d > asOf) asOf = d;
    if (out[jo] && out[jo]._d > d) return;             // keep the latest earlier state
    // an ETA that was never a valid date cannot be "removed" or "moved"
    out[jo] = { eta: validDate_(r['ETA']), badEta: isBadDate_(r['ETA']), _d: d };
  });
  if (!asOf) return { map: {}, available: false };
  return { map: out, available: true, asOf: asOf };
}

/**
 * The same, from Philindo One. There is no archive there, so:
 *   - a JO's earlier ETA is the "old" value of its first ETA change since
 *     Penny's last morning run (no change since = the ETA it has now);
 *   - the JOs Penny had already seen are the list she kept at that run.
 * Before the first run with Philindo One, "since" is the start of today and
 * new-JO detection waits a day (known = null).
 */
function previousFromPhilindoOne_(rows, etaHistory) {
  const props = PropertiesService.getScriptProperties();
  const last = props.getProperty(PENNY_LAST_RUN_);
  var since = last ? new Date(last) : null;
  if (!since || isNaN(since.getTime())) since = today_();
  const out = {};
  rows.forEach(function (r) {
    const jo = norm_(r['JO Number']);
    if (jo) out[jo] = { eta: validDate_(r['ETA']), badEta: isBadDate_(r['ETA']) };
  });
  const first = {};
  (etaHistory || []).slice().sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : 1; })
    .forEach(function (e) {
      const jo = norm_(e.jo), at = new Date(e.at);
      if (!jo || !(jo in out) || first[jo] || isNaN(at.getTime()) || at < since) return;
      first[jo] = true;
      out[jo] = { eta: validDate_(e.old), badEta: isBadDate_(e.old) };
    });
  return { map: out, available: true, asOf: since, known: readSeenJos_() };
}

const PENNY_LAST_RUN_ = 'penny:lastRun';
const PENNY_SEEN_ = 'penny:seenJos.';            // + 0, 1, 2 … (a property holds about 9 KB)

/** The JO numbers Penny saw at her last morning run, or null if she has none. */
function readSeenJos_() {
  const props = PropertiesService.getScriptProperties();
  var s = '', i = 0, part;
  while ((part = props.getProperty(PENNY_SEEN_ + i)) !== null) { s += part; i++; }
  if (!i) return null;
  const set = {};
  s.split(',').forEach(function (jo) { if (jo) set[jo] = true; });
  return set;
}

/** After a real morning run on Philindo One: remember the time and the JOs seen. */
function rememberRun_(rows, at) {
  const props = PropertiesService.getScriptProperties();
  const s = rows.map(function (r) { return norm_(r['JO Number']); }).filter(function (x) { return x; }).join(',');
  const parts = [];
  for (var i = 0; i < s.length; i += 8000) parts.push(s.slice(i, i + 8000));
  props.getKeys().forEach(function (k) { if (k.indexOf(PENNY_SEEN_) === 0) props.deleteProperty(k); });
  parts.forEach(function (p, j) { props.setProperty(PENNY_SEEN_ + j, p); });
  props.setProperty(PENNY_LAST_RUN_, at.toISOString());
}

/**
 * Philindo One brings in LogiSys's morning report only when someone opens it,
 * so at 07:45 or 10:00 it can still hold yesterday's state. This reads this
 * morning's LogiSys report (LogiSys Live) and says which JOs it carries and
 * which of them it would still ask Ariel about. Null when there is no report
 * from today to compare with.
 */
function logisysToday_(ss, hmap) {
  try {
    const live = readTab_(ss, CONFIG.SHEET_LIVE, 1);
    const newest = feedDate_(live.rows);
    if (!newest || daysBetween_(newest, today_()) !== 0) return null;
    const q = buildQueues_(live.rows, hmap, { map: {}, available: false });
    const present = {}, asks = {};
    currentRows_(live.rows).rows.forEach(function (r) { present[norm_(r['JO Number'])] = true; });
    q.q4.concat(q.q5a.filter(function (s) { return s.sev !== 'green'; }))
      .forEach(function (s) { asks[s.jo] = true; });
    return { present: present, asks: asks };
  } catch (e) {
    Logger.log('LogiSys Live could not be compared: ' + e.message);
    return null;
  }
}

/** JOs in today's report never seen in an earlier one = newly encoded. */
function newJos_(rows, prev) {
  if (!prev.available) return [];
  const known = prev.known !== undefined ? prev.known : prev.map;
  if (!known) return [];
  return currentRows_(rows).rows.filter(function (r) {
    const jo = norm_(r['JO Number']);
    return jo && !(jo in known) && !isDelivered_(r);
  }).map(function (r) {
    return { jo: norm_(r['JO Number']), client: norm_(r['Client']),
             commodity: norm_(r['Commodity']) || norm_(r['Goods Description']),
             mode: modeOf_(r), eta: validDate_(r['ETA']) };
  });
}

function clientSla_(client, mode) {
  const c = lc_(client);
  const keys = Object.keys(CONFIG.CLIENT_SLA);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === 'DEFAULT') continue;
    if (c.indexOf(lc_(keys[i])) !== -1) {
      const s = CONFIG.CLIENT_SLA[keys[i]];
      return (mode === 'Air' ? s.Air : s.Sea);
    }
  }
  const d = CONFIG.CLIENT_SLA.DEFAULT;
  return (mode === 'Air' ? d.Air : d.Sea);
}

/**
 * CA Tracker "Release Status" is about MONEY, not about port release.
 * It says whether the cash advance has been paid out to the handler.
 *
 * Three states, because two is wrong:
 *   funded   — fully released
 *   partial  — part of the CA released. A shipment CAN still be delivered
 *              on a partial release, so this is information, NOT an alarm.
 *   unfunded — not released at all. This is the one worth flagging.
 *
 * Careful with substring matching: "Not Released" contains "released",
 * which would report the exact opposite of the truth.
 */
function caFunding_(status) {
  const t = lc_(status);
  if (!t) return 'unfunded';
  if (t.indexOf('not released') !== -1 || t.indexOf('unreleased') !== -1) return 'unfunded';
  if (t.indexOf('pending') !== -1) return 'unfunded';
  if (t.indexOf('partial') !== -1) return 'partial';
  if (t.indexOf('released') !== -1) return 'funded';
  return 'unfunded';
}

function modeOf_(r) {
  const m = lc_(r['Mode']);
  if (m.indexOf('air') !== -1) return 'Air';
  if (m.indexOf('sea') !== -1) return 'Sea';
  const jo = norm_(r['JO Number']);
  return jo.charAt(0).toUpperCase() === 'A' ? 'Air' : 'Sea';   // AIMP... = air
}

/**
 * The month a JO was opened, from its number (IMP0526-0941 -> May 2026).
 * Used ONLY to apply the scope cutoff to a row that carries no date at all —
 * never shown, never aged.
 */
function joMonth_(jo) {
  const x = /^[A-Za-z]+(\d{2})(\d{2})-/.exec(jo);
  if (!x || +x[1] < 1 || +x[1] > 12) return null;
  return new Date(2000 + +x[2], +x[1] - 1, 1);
}

/** ============ The five queues ============ */

const SEV_RANK_ = { green: 0, amber: 1, red: 2, critical: 3 };
function worse_(a, b) { return SEV_RANK_[b] > SEV_RANK_[a] ? b : a; }

const DATE_FIELDS_ = ['ETD','ETA','ATA','Delivery Date','Last Updated','Shipment Date'];

function buildQueues_(rows, hmap, prev) {
  const T = today_();
  const NOW = new Date();
  const th = q1Thresholds_();
  const Q = { q1: [], q2: [], q3: [], q4: [], q5a: [], q5b: [], q5c: [], defects: [],
              untrusted: [], outOfScope: 0 };
  const cur = currentRows_(rows);
  const q4 = {};                       // one queue-4 item per JO, reasons merged

  function flag(base, reason, sev, extra) {
    const it = q4[base.jo] || (q4[base.jo] = Object.assign({}, base, { reasons: [], sev: 'amber' }));
    it.reasons.push(reason);
    it.sev = worse_(it.sev, sev);
    if (extra) Object.assign(it, extra);
  }

  cur.rows.forEach(function (r) {
    const jo = norm_(r['JO Number']);

    // ===== HANDOFF: delivered belongs to Nico. Skip entirely. =====
    if (isDelivered_(r)) return;

    const etd = validDate_(r['ETD']);
    const eta = validDate_(r['ETA']);
    const upd = validDate_(r['Last Updated']);
    const arr = arrivalOf_(r);
    const status = norm_(r['Status']);
    const mode = modeOf_(r);
    const client = norm_(r['Client']);
    const ca = hmap[jo.toUpperCase()] || {};
    const rawHandler = norm_(r['Account Handler']) || ca.handler || '';

    // ---- scope cutoff (COO's rule): anchored before SCOPE_FROM = done
    const anchor = arr.date || eta || etd || validDate_(r['Shipment Date']) || joMonth_(jo);
    if (anchor && anchor < CONFIG.SCOPE_FROM) { Q.outOfScope++; return; }

    const base = {
      jo: jo, client: client, mode: mode,
      handler: resolveHandler_(rawHandler), rawHandler: rawHandler,
      eta: eta, ata: arr.date, etd: etd, status: status,
      releaseStatus: ca.releaseStatus || '',
      funding: ca.funding || caFunding_(''),               // funded | partial | unfunded
      balanceToRelease: ca.balanceToRelease || 0,
      lastUpdated: upd
    };
    base.handlerKnown = !!base.handler;

    // ---- date defects: never compute with them
    const bad = {};
    DATE_FIELDS_.forEach(function (f) {
      if (isBadDate_(r[f])) {
        bad[f] = true;
        const shown = isDateObj_(r[f]) ? Utilities.formatDate(r[f], tz_(), 'yyyy-MM-dd') : String(r[f]);
        Q.defects.push({ jo: jo, client: client, field: f, value: shown });
        flag(base, f + ' "' + shown + '" doesn\'t look like a real date', 'amber');
      }
    });
    (cur.notes[jo] || []).forEach(function (n) { flag(base, n, 'amber', { duplicate: true }); });

    // ---- Queue 4: stale status (8+ days) — only where an update is due.
    // Not while the vessel or flight is still on its way (ETA today or later:
    // the next update is the arrival), and not for a job with nothing recorded
    // yet (no status and no dates: before booking, like a blank ETD in 5a).
    if (upd) {
      const sdays = daysBetween_(upd, T);
      const sailing = !arr.arrived && eta && eta >= T;
      const nothingYet = !status && !etd && !eta && !validDate_(r['ATA']);
      if (sdays >= CONFIG.Q4_STALE_RED && !sailing && !nothingYet) {
        flag(base, !arr.arrived && eta
          ? 'ETA was ' + fmtDate_(eta) + ', arrival not recorded yet (last update ' + fmtDate_(upd) + ')'
          : 'no status update since ' + fmtDate_(upd) + ' (' + sdays + ' days)', 'red', { age: sdays });
      }
    }

    // Without a trustworthy ATA or delivery state nothing else can be aged.
    if (bad['ATA'] || bad['Delivery Date']) return;

    // ---- arrival that the ATA column does not support
    if (arr.arrived && !arr.date) {
      flag(base, arr.doubt, 'red');
      return;                                          // arrived: not queue 2 or 5
    }
    if (!arr.arrived && arr.doubt) Q.untrusted.push(Object.assign({}, base, { doubt: arr.doubt }));
    // Only the COO's post-arrival milestones count: documents can be checked and
    // lodged before the vessel arrives. (With TRUST_LOGISYS_ATA off, these rows
    // were already flagged above as "arrived, date not confirmed".)
    if (!arr.arrived && !validDate_(r['ATA']) && containsAny_(status, CONFIG.STATUS_POST_ARRIVAL)) {
      flag(base, 'marked "' + status + '" — ATA not entered yet', 'red');
    }

    // ---- Queue 1: arrived, not delivered
    if (arr.date) {
      const age = daysBetween_(arr.date, T);
      const sla = clientSla_(client, mode);
      const hrs = hoursSince_(r['ATA'], NOW);
      const slaBreach = hrs !== null ? hrs > sla * 24 : age > sla;
      const pharma = /unilab/i.test(client) && containsAny_(r['Loading Port'], CONFIG.UNILAB_PHARMA_PORTS);
      const wd = pharma ? workingDaysBetween_(arr.date, T) : null;
      const pharmaBreach = pharma && wd > CONFIG.UNILAB_PHARMA_SLA_WORKING_DAYS;

      var sev = 'green';
      if (age >= th.critical) sev = 'critical';
      else if (age >= th.red) sev = 'red';
      else if (age >= th.amber) sev = 'amber';
      if (slaBreach || pharmaBreach) sev = worse_(sev, 'red');   // client standard wins

      Q.q1.push(Object.assign({}, base, {
        age: age, hours: hrs, sev: sev, sla: sla,
        daysToStorage: CONFIG.STORAGE_FREE_DAYS + 1 - age,
        daysToDemurrage: CONFIG.DEMURRAGE_FREE_DAYS + 1 - age,
        storageRunning: age > CONFIG.STORAGE_FREE_DAYS,
        demurrageRunning: age > CONFIG.DEMURRAGE_FREE_DAYS,
        slaBreach: slaBreach, pharma: pharma, workingDays: wd, pharmaBreach: pharmaBreach
      }));
      return;                                          // arrived: not queue 2 or 5
    }

    if (bad['ETA']) return;                            // cannot plan on a corrupt ETA

    // ---- Queue 2: in transit, ETA approaching
    if (eta) {
      const dTo = daysBetween_(T, eta);
      if (dTo >= 0 && dTo <= CONFIG.Q2_ETA_WINDOW) {
        // Red only when arriving within a day with NO cash advance released.
        // A partial release is often enough to deliver on, so it is not an alarm.
        Q.q2.push(Object.assign({}, base, {
          daysToEta: dTo, age: dTo,
          sev: (dTo <= 1 && base.funding === 'unfunded') ? 'red' : 'amber'
        }));
      }
    }

    // ---- Queue 5: ETA watch. A JO lands in at most one of 5b, 5c, 5a.
    const p = prev.available ? prev.map[jo] : null;
    if (p && p.eta && !p.badEta) {
      if (!eta) {
        Q.q5b.push(Object.assign({}, base, {
          sev: 'red', oldEta: p.eta, newEta: null, moved: null, removed: true, age: 0
        }));
        return;
      }
      const moved = daysBetween_(p.eta, eta);          // + = later, - = earlier
      var s5b = 'green';
      if (moved <= -CONFIG.Q5B_RED_EARLIER) s5b = 'red';             // EARLIER = red
      else if (moved >= CONFIG.Q5B_RED_LATER) s5b = 'red';
      else if (moved >= CONFIG.Q5B_AMBER_LATER) s5b = 'amber';
      if (s5b !== 'green') {
        Q.q5b.push(Object.assign({}, base, {
          sev: s5b, oldEta: p.eta, newEta: eta, moved: moved, removed: false, age: Math.abs(moved)
        }));
        return;
      }
    }

    if (eta) {                                         // 5c: ETA passed, no arrival
      const pastEta = daysBetween_(eta, T);
      if (pastEta >= CONFIG.Q5C_AMBER) {
        Q.q5c.push(Object.assign({}, base, {
          age: pastEta, sev: pastEta >= CONFIG.Q5C_RED ? 'red' : 'amber'
        }));
      }
      return;
    }

    // 5a: no ETA recorded. ETD blank or future is a normal pre-booking state.
    if (etd && !bad['ETD']) {
      const past = daysBetween_(etd, T);
      var s5 = 'green';
      if (past >= CONFIG.Q5A_RED_ETD_PAST) s5 = 'red';
      else if (past >= CONFIG.Q5A_AMBER_ETD_PAST) s5 = 'amber';
      if (s5 !== 'green') Q.q5a.push(Object.assign({}, base, { sev: s5, etdPast: past, age: past }));
    }
  });

  Q.q4 = Object.keys(q4).map(function (k) { return q4[k]; });

  // Queue 3 (new JOs) is filled by the caller from previousEtas_.
  // Worst first, then oldest first.
  ['q1','q2','q4','q5a','q5b','q5c'].forEach(function (k) {
    Q[k].sort(function (a, b) {
      return (SEV_RANK_[b.sev] - SEV_RANK_[a.sev]) || ((b.age || 0) - (a.age || 0));
    });
  });
  return Q;
}

// ======================= Arrivals.gs =======================
/** ============ Arrivals record + monthly report ============
 *  Penny maintains her OWN sheets here. She never writes to the
 *  CA Tracker, the Billing Tracker, the Manifest Control, or any
 *  Philindo web app. The Command Center READS these sheets.
 */

/**
 * Every shipment ever seen, from the archive, deduplicated latest-wins.
 * With `rows` (Philindo One's jobs), those are the whole record instead.
 */
function allShipmentsYtd_(ss, year, rows) {
  const seen = {};
  function take(rows) {
    rows.forEach(function (r) {
      const jo = norm_(r['JO Number']);
      if (!jo) return;
      const src = validDate_(r['Source Report Date']);
      const prev = seen[jo];
      if (!prev || !prev._src || (src && src >= prev._src)) {
        const o = Object.assign({}, r); o._src = src; seen[jo] = o;
      }
    });
  }
  if (rows) take(rows);
  else {
    if (ss.getSheetByName(CONFIG.SHEET_ARCHIVE)) take(readTab_(ss, CONFIG.SHEET_ARCHIVE, 1).rows);
    take(readTab_(ss, CONFIG.SHEET_LIVE, 1).rows);          // live wins
  }

  const out = [];
  Object.keys(seen).forEach(function (jo) {
    const r = seen[jo];
    const arrival = arrivalOf_(r).date;           // same arrival rule as the queues
    const anchor = arrival || validDate_(r['ETA']) ||
                   validDate_(r['Shipment Date']) || validDate_(r['ETD']);
    if (!anchor) return;
    if (anchor.getFullYear() !== year) return;
    out.push({
      jo: jo,
      bl: norm_(r['BL/AWB']),
      shipper: norm_(r['Shipper']),
      client: norm_(r['Client']),
      mode: modeOf_(r),
      cargoType: norm_(r['Cargo Type']) || (modeOf_(r) === 'Air' ? 'AIR' : ''),
      loadingPort: norm_(r['Loading Port']),
      dischargePort: norm_(r['Discharge Port']),
      placeOfDelivery: norm_(r['Place Of Delivery']),
      shipmentDate: validDate_(r['Shipment Date']),
      etd: validDate_(r['ETD']),
      atd: validDate_(r['ATD']),
      eta: validDate_(r['ETA']),
      ata: validDate_(r['ATA']),                  // as LogiSys wrote it, for the registers
      arrivedOn: arrival,                         // trusted arrival, for counts and lead times
      arrived: arrivalOf_(r).arrived,
      delivered: isDelivered_(r),
      deliveredOn: deliveredOn_(r),
      c20: num_(r['Containers 20ft']),
      c40: num_(r['Containers 40ft']),
      packages: num_(r['Total Packages']),
      unit: norm_(r['Unit']),
      airline: norm_(r['Airline']),
      status: norm_(r['Status']),
      handler: norm_(r['Account Handler']),
      anchor: anchor,
      month: anchor.getMonth() + 1
    });
  });
  out.sort(function (a, b) { return a.jo < b.jo ? -1 : a.jo > b.jo ? 1 : 0; });
  return out;
}

function classify_(s) {
  const ct = lc_(s.cargoType);
  if (s.mode === 'Air') return 'AIR';
  if (ct.indexOf('lcl') !== -1) return 'SEA LCL';
  return 'SEA FCL';
}

/** Write / refresh Penny's arrivals summary. Her own sheet. */
function updateArrivals_(ss, ships, year) {
  const sh = ownSheet_(ss, CONFIG.SHEET_ARRIVALS);
  sh.clear();

  const groups = { 'SEA FCL': [], 'SEA LCL': [], 'AIR': [] };
  ships.forEach(function (s) { groups[classify_(s)].push(s); });

  const c20 = ships.reduce(function (a, s) { return a + s.c20; }, 0);
  const c40 = ships.reduce(function (a, s) { return a + s.c40; }, 0);
  const delivered = ships.filter(function (s) { return !!s.delivered; }).length;
  const arrived = ships.filter(function (s) { return s.arrived; }).length;

  // lead times on delivered shipments: trusted arrival -> first reported delivered
  const leads = ships.filter(function (s) { return s.arrivedOn && s.deliveredOn; })
                     .map(function (s) { return daysBetween_(s.arrivedOn, s.deliveredOn); })
                     .filter(function (n) { return n !== null && n >= 0; });
  const median = percentile_(leads, 0.5);
  const p75 = percentile_(leads, 0.75);

  const rows = [];
  rows.push(['PHILINDO CONTAINER EXPRESS INC.']);
  rows.push(['Arrivals Summary — Year to Date ' + year]);
  rows.push(['Maintained by Penny. Do not type in this sheet.',
             'Last updated', Utilities.formatDate(new Date(), tz_(), 'd MMM yyyy HH:mm')]);
  rows.push([]);
  rows.push(['TOTALS','Shipments','20ft','40ft','Packages']);
  rows.push(['Year to date', ships.length, c20, c40,
             ships.reduce(function (a, s) { return a + s.packages; }, 0)]);
  ['SEA FCL','SEA LCL','AIR'].forEach(function (k) {
    const g = groups[k];
    rows.push([k, g.length,
      g.reduce(function (a, s) { return a + s.c20; }, 0),
      g.reduce(function (a, s) { return a + s.c40; }, 0),
      g.reduce(function (a, s) { return a + s.packages; }, 0)]);
  });
  rows.push([]);
  rows.push(['Arrived', arrived]);
  rows.push(['Delivered', delivered]);
  rows.push(['Still pending', ships.length - delivered]);
  rows.push(['Median ATA to delivery (days)', median]);
  rows.push(['p75 ATA to delivery (days)', p75]);
  rows.push(['Lead times measured on', leads.length]);
  rows.push([]);

  // monthly breakdown
  rows.push(['MONTHLY BREAKDOWN','Shipments','SEA FCL','SEA LCL','AIR','20ft','40ft']);
  const names = MONTH_NAMES_;
  for (var m = 1; m <= 12; m++) {
    const mm = ships.filter(function (s) { return s.month === m; });
    if (!mm.length) continue;
    rows.push([names[m - 1] + ' ' + year, mm.length,
      mm.filter(function (s) { return classify_(s) === 'SEA FCL'; }).length,
      mm.filter(function (s) { return classify_(s) === 'SEA LCL'; }).length,
      mm.filter(function (s) { return classify_(s) === 'AIR'; }).length,
      mm.reduce(function (a, s) { return a + s.c20; }, 0),
      mm.reduce(function (a, s) { return a + s.c40; }, 0)]);
  }
  rows.push([]);

  // by client
  rows.push(['BY CLIENT','Shipments','SEA FCL','SEA LCL','AIR']);
  const byClient = {};
  ships.forEach(function (s) {
    const k = s.client || '(no client)';
    byClient[k] = byClient[k] || { n: 0, f: 0, l: 0, a: 0 };
    byClient[k].n++;
    const c = classify_(s);
    if (c === 'SEA FCL') byClient[k].f++; else if (c === 'SEA LCL') byClient[k].l++; else byClient[k].a++;
  });
  Object.keys(byClient).sort(function (a, b) { return byClient[b].n - byClient[a].n; })
    .forEach(function (k) {
      const v = byClient[k];
      rows.push([k, v.n, v.f, v.l, v.a]);
    });

  const width = rows.reduce(function (w, r) { return Math.max(w, r.length); }, 1);
  const padded = rows.map(function (r) {
    const c = r.slice(); while (c.length < width) c.push('');
    return c;
  });
  sh.getRange(1, 1, padded.length, width).setValues(padded);
  sh.getRange(1, 1, 3, 1).setFontWeight('bold');
  sh.setFrozenRows(3);

  return {
    total: ships.length, fcl: groups['SEA FCL'].length, lcl: groups['SEA LCL'].length,
    air: groups['AIR'].length, c20: c20, c40: c40, delivered: delivered,
    pending: ships.length - delivered, median: median, p75: p75, leads: leads.length
  };
}

const MONTH_NAMES_ = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * The monthly report due as of `now`, or null. Due from the 7th for the
 * month just ended, until it exists — so a 7th that falls on a weekend is
 * picked up on the next working day. The AIR tab is written last, so its
 * presence means the report is complete.
 */
function monthlyDue_(ss, now) {
  if (now.getDate() < CONFIG.MONTHLY_REPORT_DAY) return null;
  const m = now.getMonth();
  const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const mn = m === 0 ? 12 : m;
  const name = CONFIG.SHEET_MONTHLY_PREFIX + ' ' + MONTH_NAMES_[mn - 1] + ' ' + y;
  if (ss.getSheetByName(name + ' — AIR')) return null;          // already generated
  return { year: y, month: mn, name: name };
}

/** Monthly arrivals report — three tabs, matching the existing format. */
function buildMonthlyReport_(ss, ships, year, monthNum) {
  const label = MONTH_NAMES_[monthNum - 1] + ' ' + year;
  const name = CONFIG.SHEET_MONTHLY_PREFIX + ' ' + label;

  const upto = ships.filter(function (s) { return s.month <= monthNum; });
  const head = ['Philindo Container Express Inc.'];
  const range = 'Date Range : From 01-Jan-' + year + ' To ' +
                Utilities.formatDate(new Date(year, monthNum, 0), tz_(), 'dd-MMM-yyyy');

  function tab(title, register, cols, pick, rowsIn) {
    const sh = ownSheet_(ss, title);
    sh.clear();
    const out = [head, [register], [range], cols];
    rowsIn.forEach(function (s) { out.push(pick(s)); });
    const w = cols.length;
    const padded = out.map(function (r) {
      const c = r.slice(); while (c.length < w) c.push(''); return c.slice(0, w);
    });
    sh.getRange(1, 1, padded.length, w).setValues(padded);
    sh.getRange(4, 1, 1, w).setFontWeight('bold');
    sh.setFrozenRows(4);
    return rowsIn.length;
  }

  const fcl = upto.filter(function (s) { return classify_(s) === 'SEA FCL'; });
  const lcl = upto.filter(function (s) { return classify_(s) === 'SEA LCL'; });
  const air = upto.filter(function (s) { return classify_(s) === 'AIR'; });

  const nF = tab(name + ' — SEA FCL', 'Sea Import Shipment Register',
    ['Shipment No','Shipper','Consignee','Loading Port','Discharge Port','ETA','ATA',
     'Cargo Type','20 Feet Containers','40 Feet Containers','Place Of Delivery','Status'],
    function (s) { return [s.jo, s.shipper, s.client, s.loadingPort, s.dischargePort,
      s.eta, s.ata, s.cargoType || 'FCL', s.c20, s.c40, s.placeOfDelivery, s.status]; }, fcl);

  const nL = tab(name + ' — SEA LCL', 'Sea Import Shipment Register',
    ['Shipment No','Shipper','Consignee','Loading Port','Discharge Port','ETD','ETA','ATA',
     'Cargo Type','Total Packages','Unit','Place Of Delivery','Status'],
    function (s) { return [s.jo, s.shipper, s.client, s.loadingPort, s.dischargePort,
      s.etd, s.eta, s.ata, s.cargoType || 'LCL', s.packages, s.unit,
      s.placeOfDelivery, s.status]; }, lcl);

  const nA = tab(name + ' — AIR', 'Air Import Shipment Register',
    ['Shipment No','Shipment Date','Shipper','Consignee','Loading Port','Discharge Port',
     'Airline','Total Packages','Unit','Place Of Delivery','ETD','ATD','ETA','ATA','Status'],
    function (s) { return [s.jo, s.shipmentDate, s.shipper, s.client, s.loadingPort,
      s.dischargePort, s.airline, s.packages, s.unit, s.placeOfDelivery,
      s.etd, s.atd, s.eta, s.ata, s.status]; }, air);

  return { label: label, fcl: nF, lcl: nL, air: nA, total: nF + nL + nA };
}

// ======================= Email.gs =======================
/** ============ Email composition ============
 *  One email per person per morning. Silence is the reward.
 *  Subjects are name-first so a handler can tell Penny from Nico at a glance.
 */

const CSS = 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
            'font-size:14px;line-height:1.5;color:#1a2b1f;';

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function sevChip_(sev) {
  const c = { critical:'#7f1d1d', red:'#b91c1c', amber:'#b45309', green:'#166534' }[sev] || '#555';
  const t = { critical:'CRITICAL', red:'RED', amber:'ATTENTION' }[sev] || '';
  if (!t) return '';
  return '<span style="background:' + c + ';color:#fff;font-size:11px;font-weight:600;' +
         'padding:2px 6px;border-radius:3px;">' + t + '</span>';
}

function table_(cols, rows) {
  if (!rows.length) return '';
  var h = '<table role="presentation" style="border-collapse:collapse;width:100%;' +
          'margin:8px 0 16px;font-size:13px;">';
  h += '<tr>' + cols.map(function (c) {
    return '<th align="left" style="border-bottom:2px solid #d9e5dc;padding:6px 8px 6px 0;' +
           'font-weight:600;white-space:nowrap;">' + esc_(c) + '</th>';
  }).join('') + '</tr>';
  rows.forEach(function (r) {
    h += '<tr>' + r.map(function (c) {
      return '<td style="border-bottom:1px solid #eef3ef;padding:6px 8px 6px 0;' +
             'vertical-align:top;">' + c + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

function section_(title, note, html) {
  if (!html) return '';
  return '<h3 style="margin:20px 0 4px;font-size:15px;">' + esc_(title) + '</h3>' +
         (note ? '<div style="color:#5b6b60;font-size:12px;margin-bottom:2px;">' +
                 esc_(note) + '</div>' : '') + html;
}

function wrap_(bodyHtml, footNote) {
  return '<div style="' + CSS + 'max-width:640px;">' + bodyHtml +
    '<p style="margin-top:24px;padding-top:10px;border-top:1px solid #e3ebe5;' +
    'color:#7a8a80;font-size:11px;">Penny — pending shipments, Philindo Container Express Inc.<br>' +
    'Arrival to delivery. Billing is Nico\'s. ' + esc_(footNote || '') + '</p></div>';
}

/** ---- Queue renderers ---- */

function q1Html_(items) {
  if (!items.length) return '';
  const rows = items.map(function (s) {
    var clock;
    if (s.demurrageRunning) clock = '<b>storage + demurrage running</b>';
    else if (s.storageRunning) clock = '<b>storage running</b>, demurrage in ' + s.daysToDemurrage + 'd';
    else clock = 'storage in ' + s.daysToStorage + 'd, demurrage in ' + s.daysToDemurrage + 'd';
    return [
      '<b>' + esc_(s.jo) + '</b>',
      esc_(s.client),
      fmtDate_(s.ata),
      '<b>' + s.age + 'd</b>',
      clock + (s.slaBreach ? '<br><span style="color:#b91c1c;">past the ' +
        (s.hours !== null && s.hours !== undefined ? (s.sla * 24) + '-hour' : s.sla + '-day') +
        ' client standard</span>' : '') +
      (s.pharmaBreach ? '<br><span style="color:#b91c1c;">' + s.workingDays + ' working days — Indonesia pharma SLA is ' +
        CONFIG.UNILAB_PHARMA_SLA_WORKING_DAYS + '</span>' : ''),
      sevChip_(s.sev)
    ];
  });
  return table_(['JO','Client','Arrived','Days','Free time','' ], rows);
}

function q2Html_(items) {
  if (!items.length) return '';
  const rows = items.map(function (s) {
    return ['<b>' + esc_(s.jo) + '</b>', esc_(s.client),
      Utilities.formatDate(s.eta, tz_(), 'EEE d MMM') +
        (s.daysToEta === 0 ? ' (today)' : ' (' + s.daysToEta + 'd)') + ' — documents complete?',
      fundingCell_(s), sevChip_(s.sev)];
  });
  return table_(['JO','Client','Arriving','Cash advance',''], rows);
}

/** Cash advance funding, in the team's own words. Money, not port release. */
function fundingCell_(s) {
  if (s.funding === 'funded') return 'Released';
  if (s.funding === 'partial') {
    return 'Partially released' +
      (s.balanceToRelease > 0 ? ' \u2014 ' + money_(s.balanceToRelease) + ' still to release' : '');
  }
  const raw = norm_(s.releaseStatus);
  return '<b>Not released</b>' +
    (!raw ? ' (no CA on file)' : lc_(raw) !== 'not released' ? ' (' + esc_(raw) + ')' : '');
}

function q4Html_(items) {
  if (!items.length) return '';
  const rows = items.map(function (s) {
    return ['<b>' + esc_(s.jo) + '</b>', esc_(s.client),
      s.reasons.map(esc_).join('<br>'), esc_(s.status)];
  });
  return table_(['JO','Client','What\'s needed','Status now'], rows);
}

function q5aHtml_(items, o) {
  if (!items.length) return '';
  const plain = o && o.plain;                        // Ariel's list: no warning chips
  const rows = items.map(function (s) {
    const r = ['<b>' + esc_(s.jo) + '</b>', esc_(s.client),
      s.etd ? fmtDate_(s.etd) + ' (' + s.etdPast + 'd ago)' : 'no ETD'];
    if (!plain) r.push(sevChip_(s.sev));
    return r;
  });
  return table_(plain ? ['JO','Client','Departed'] : ['JO','Client','Departed',''], rows);
}

function q5bHtml_(items) {
  if (!items.length) return '';
  const rows = items.map(function (s) {
    var m;
    if (s.removed) m = '<b>ETA removed</b> (was ' + fmtDate_(s.oldEta) + ')';
    else if (s.moved < 0) m = '<b>' + Math.abs(s.moved) + ' days EARLIER</b> — less prep time';
    else m = s.moved + ' days later';
    return ['<b>' + esc_(s.jo) + '</b>', esc_(s.client),
      fmtDate_(s.oldEta) + ' → ' + (s.newEta ? fmtDate_(s.newEta) : 'blank'),
      m, sevChip_(s.sev)];
  });
  return table_(['JO','Client','ETA change','Movement','' ], rows);
}

function q5cHtml_(items) {
  if (!items.length) return '';
  const rows = items.map(function (s) {
    return ['<b>' + esc_(s.jo) + '</b>', esc_(s.client), fmtDate_(s.eta),
      '<b>' + s.age + 'd past ETA</b>, no arrival recorded', sevChip_(s.sev)];
  });
  return table_(['JO','Client','ETA was','Status','' ], rows);
}

/** One plain line per item, for the dry-run log. */
function textLine_(key, s) {
  const bits = [s.jo, s.client || '(no client)', key.toUpperCase(), s.sev];
  if (key === 'q1') bits.push('arrived ' + fmtDate_(s.ata) + ', ' + s.age + 'd, ' +
    (s.demurrageRunning ? 'storage + demurrage running' :
     s.storageRunning ? 'storage running, demurrage in ' + s.daysToDemurrage + 'd' :
     'storage in ' + s.daysToStorage + 'd, demurrage in ' + s.daysToDemurrage + 'd') +
    ', status "' + s.status + '"');
  if (key === 'q2') bits.push('ETA ' + fmtDate_(s.eta) + ', CA ' + s.funding);
  if (key === 'q4') bits.push(s.reasons.join('; '));
  if (key === 'q5a') bits.push('ETD ' + fmtDate_(s.etd) + ', ' + s.etdPast + 'd ago, no ETA');
  if (key === 'q5b') bits.push(s.removed ? 'ETA removed' : 'ETA ' + fmtDate_(s.oldEta) + ' -> ' + fmtDate_(s.newEta));
  if (key === 'q5c') bits.push(s.age + 'd past ETA, status "' + s.status + '"');
  return bits.join(' | ');
}

const RENDER_ = { q1: q1Html_, q2: q2Html_, q4: q4Html_, q5a: q5aHtml_, q5b: q5bHtml_, q5c: q5cHtml_ };

/**
 * Render sections worst-first. Each section: {key, title, note, items}.
 * Red before amber; ties keep the order given.
 */
function sectionsHtml_(sections) {
  const rank = function (sec) {
    return sec.items.reduce(function (m, s) { return Math.max(m, SEV_RANK_[s.sev] || 0); }, 0);
  };
  return sections.filter(function (sec) { return sec.items.length; })
    .map(function (sec, i) { return { sec: sec, i: i, r: rank(sec) }; })
    .sort(function (a, b) { return (b.r - a.r) || (a.i - b.i); })
    .map(function (x) { return section_(x.sec.title, x.sec.note, RENDER_[x.sec.key](x.sec.items, x.sec.opts || {})); })
    .join('');
}

// ======================= Main.gs =======================
/** ============ Penny — entry points ============
 *  setup()               install both triggers (07:45 and Ariel's 10:00) and run the 07:45 pass once now
 *  setupArielReminder()  install ONLY Ariel's 10:00 trigger — sends nothing now
 *  dryRun()              log everything, send nothing, write nothing
 *  dryRunAriel()         log Ariel's 10:00 email, send nothing
 *  runPenny()            the 07:45 run
 *  runArielReminder()    the 10:00 run: Ariel's LogiSys update list only
 */

function setup() {
  installTrigger_('runPenny', CONFIG.SEND_HOUR, CONFIG.SEND_MINUTE);
  if (CONFIG.ARIEL_REMINDER) installTrigger_('runArielReminder', CONFIG.ARIEL_HOUR, CONFIG.ARIEL_MINUTE);
  runPenny();
}

function setupArielReminder() {
  installTrigger_('runArielReminder', CONFIG.ARIEL_HOUR, CONFIG.ARIEL_MINUTE);
}

/** One daily trigger per function: an existing one is replaced, never doubled. */
function installTrigger_(fn, hour, minute) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(fn).timeBased()
    .atHour(hour).nearMinute(minute).everyDays(1)
    .inTimezone(CONFIG.TZ).create();
  Logger.log('Trigger installed: %s daily at %s:%s %s', fn, hour, ('0' + minute).slice(-2), CONFIG.TZ);
}

function dryRun() { return execute_(true, 'morning'); }
function runPenny() { return execute_(false, 'morning'); }
function dryRunAriel() { return execute_(true, 'ariel'); }
function runArielReminder() { return execute_(false, 'ariel'); }

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
function execute_(dry, mode) {
  mode = mode || 'morning';
  const ariel = mode === 'ariel';                   // 10:00: Ariel's list only, nothing written
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
  if (stale && ariel) {                              // the COO was already told at 07:45
    say('FEED STALE: no LogiSys report today (' + stale + ') — no list for Ariel.');
    return log.join('\n');
  }
  if (stale) {
    const day = fmtDateLong_(today_());
    const msg = 'LogiSys feed for ' + day + ' has not arrived. No pending checks run today.';
    say('FEED STALE: ' + msg + ' (' + stale + ')');
    const e = { person: 'COO', to: CONFIG.RECIPIENTS.coo, jos: [], lines: [stale].concat(feed.fallback ? [feed.fallback] : []),
      subject: CONFIG.AGENT + ': LogiSys feed for ' + day + ' not received',
      html: wrap_('<h2 style="margin:0 0 8px;font-size:17px;">LogiSys feed missing</h2>' +
                  '<p>' + esc_(msg) + '</p><p style="color:#5b6b60;">' + esc_(stale) + '.</p>' +
                  (feed.fallback ? '<p>' + esc_(feed.fallback) + '</p>' : '') +
                  '<p>Penny sent nothing to anyone else this morning.</p>', '') };
    sendAll_([e], dry, say);
    return log.join('\n');
  }

  var Q, deliveredJos = {};
  try {
    const hmap = handlerMap_();
    const prev = feed.source === 'philindo-one' ? previousFromPhilindoOne_(feed.rows, feed.etaHistory)
                                                : previousEtas_(ss);
    Q = buildQueues_(feed.rows, hmap, prev);
    Q.q3 = newJos_(feed.rows, prev);
    Q.prevAvailable = prev.available;
    Q.source = feed.source;
    Q.newJosChecked = prev.available && (prev.known !== undefined ? !!prev.known : true);
    currentRows_(feed.rows).rows.forEach(function (r) {
      if (isDelivered_(r)) deliveredJos[norm_(r['JO Number'])] = true;
    });
    // Ariel's list: never ask about a job this morning's LogiSys report already
    // shows as updated, even if Philindo One has not brought that report in yet.
    Q.alreadyUpdated = [];
    if (feed.source === 'philindo-one') {
      const lt = logisysToday_(ss, hmap);
      if (lt) {
        const done = function (s) { return lt.present[s.jo] && !lt.asks[s.jo]; };
        Q.alreadyUpdated = Q.q4.concat(Q.q5a).filter(done).map(function (s) { return s.jo; });
        Q.q4 = Q.q4.filter(function (s) { return !done(s); });
        Q.q5a = Q.q5a.filter(function (s) { return !done(s); });
      }
    }
  } catch (e) {
    return fail_(dry, 'could not build the queues', e.message, log);
  }

  const notes = [];
  if (feed.fallback) notes.push(feed.fallback);
  if (caReadError_) notes.push('CA Tracker could not be read (' + caReadError_ +
    ') — handlers come from LogiSys only and cash-advance state is unknown today.');
  if (!Q.prevAvailable) notes.push('No earlier report in LogiSys Archive — ETA-change and new-JO checks skipped today.');
  else if (!Q.newJosChecked) notes.push('First morning on Philindo One — new job orders are listed from tomorrow.');
  say('Data: ' + (feed.source === 'philindo-one' ? 'Philindo One (' + CONFIG.PHILINDO_ONE_URL + ')' : 'LogiSys Live sheet'));

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
  if (Q.alreadyUpdated.length) say('Already updated in this morning\'s LogiSys report, left off Ariel\'s list: ' +
      Q.alreadyUpdated.length + ' (' + Q.alreadyUpdated.join(', ') + ')');
  say('Date defects: ' + Q.defects.length + ' | LogiSys ATA not used: ' + Q.untrusted.length);

  // ---------- arrivals record (Penny's own sheets) ----------
  const arr = { summary: null, monthly: null };
  if (!ariel) try {
    const p1 = feed.source === 'philindo-one' ? feed.rows : null;   // Philindo One holds the year's jobs
    const ships = allShipmentsYtd_(ss, now.getFullYear(), p1);
    if (!dry) arr.summary = updateArrivals_(ss, ships, now.getFullYear());
    say('Arrivals YTD: ' + ships.length + ' shipments' + (dry ? ' (dry run — not written)' : ''));

    const due = monthlyDue_(ss, now);
    if (due) {
      if (!dry) arr.monthly = buildMonthlyReport_(ss, allShipmentsYtd_(ss, due.year, due.year === now.getFullYear() ? p1 : null), due.year, due.month);
      say('Monthly report: ' + due.name + (dry ? ' is due (dry run — not written)' : ' (' + arr.monthly.total + ' rows)'));
    }
  } catch (e) {
    say('Arrivals step failed: ' + e.message);
    notes.push('Penny Arrivals was not refreshed: ' + e.message);
  }

  // ---------- plan, self-check, send ----------
  const emails = planEmails_(Q, arr, notes, mode);
  const problems = selfCheck_(emails, deliveredJos);
  if (problems.length) {
    return fail_(dry, 'self-check failed, nothing sent', problems.join('\n'), log);
  }
  const sent = sendAll_(emails, dry, say);
  say('Emails ' + (dry ? 'that would be sent' : 'sent') + ': ' + sent);
  // The next morning's ETA-change and new-JO checks count from this run.
  if (!dry && !ariel && feed.source === 'philindo-one') rememberRun_(feed.rows, now);
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

function planEmails_(Q, arr, notes, mode) {
  mode = mode || 'morning';
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
  const dataNote = Q.source === 'philindo-one' ? 'Data from Philindo One.' : '';

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
  // Ariel's list goes out at 10:00 on its own (ARIEL_REMINDER), else with the team at 07:45.
  const arielNow = mode === 'ariel' || (team && !CONFIG.ARIEL_REMINDER);
  if (arielNow && arielJos.length) {
    if (!R.support) {
      cooNotes.push('Ariel has no email address set — his ' + arielJos.length +
                    ' shipment(s) are in this email: ' + arielJos.join(', ') + '.');
    } else {
      emails.push({
        person: 'Ariel', to: R.support, jos: arielJos, lines: linesOf(ariel),
        // Friendly and short: a colleague's list, never a scorecard. Data work is never CRITICAL.
        subject: CONFIG.AGENT + ': your LogiSys update list for today (' + arielJos.length +
                 (arielJos.length === 1 ? ' shipment)' : ' shipments)'),
        html: wrap_(
          '<h2 style="margin:0 0 2px;font-size:17px;">Good morning, Ariel!</h2>' +
          '<div style="color:#5b6b60;font-size:12px;">' + fmtDateLong_(today_()) + '</div>' +
          '<p style="margin:12px 0 4px;">Here\'s today\'s short list of shipments that need a quick update in LogiSys. ' +
          'Thank you for keeping our records up to date — the whole team relies on them.</p>' +
          sectionsHtml_([
            { key: 'q4', title: 'Quick updates in LogiSys', items: ariel.q4,
              note: 'One line each. The last column is what LogiSys shows now.' },
            { key: 'q5a', title: 'Waiting for an ETA — ' + ariel.q5a.length + ' shipment' + (ariel.q5a.length === 1 ? '' : 's'),
              items: ariel.q5a, opts: { plain: true },
              note: 'Once the ETA is in, the team can plan trucking and the cash advance.' }
          ]) +
          '<p style="margin:18px 0 0;">That\'s all for today. Thank you, Ariel!<br>— Penny</p>', dataNote)
      });
    }
  }

  if (mode === 'ariel') return emails;               // 10:00 run: Ariel's email and nothing else

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
    return s.reasons.some(function (r) { return /ATA not entered yet|confirm the actual arrival date/.test(r); });
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
                lines: linesOf(coo).concat(cooNotes), html: wrap_(body, dataNote) });
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
