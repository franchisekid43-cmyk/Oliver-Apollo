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
