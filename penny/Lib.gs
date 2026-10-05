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
