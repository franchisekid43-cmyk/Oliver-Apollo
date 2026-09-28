/** ============ Helpers: dates, sheets, text ============ */

function tz_()  { return CONFIG.TZ; }
function today_() { return stripTime_(new Date()); }

function stripTime_(d) {
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function asDate_(v) {
  if (v instanceof Date && !isNaN(v)) return stripTime_(v);
  if (typeof v === 'number' && v > 20000 && v < 60000) {          // excel serial
    return stripTime_(new Date(Date.UTC(1899, 11, 30) + v * 86400000));
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.trim());
    if (!isNaN(d)) return stripTime_(d);
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

function isBadDate_(v) {
  if (v === '' || v === null || v === undefined) return false;   // blank is not bad
  return asDate_(v) !== null && validDate_(v) === null;
}

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
function num_(v) { return (typeof v === 'number' && !isNaN(v)) ? v : 0; }

function norm_(s) { return String(s === null || s === undefined ? '' : s).trim(); }
function lc_(s) { return norm_(s).toLowerCase(); }

function containsAny_(hay, needles) {
  const h = lc_(hay);
  if (!h) return false;
  for (var i = 0; i < needles.length; i++) if (h.indexOf(needles[i]) !== -1) return true;
  return false;
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

/** Get or create one of Penny's OWN sheets. Never used on existing sheets. */
function ownSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}
