/** ============ Load the feed and build the five queues ============ */

function loadFeed_() {
  const ss = feedBook_();
  const live = readTab_(ss, CONFIG.SHEET_LIVE, 1);
  requireHeaders_(live.headers,
    ['JO Number','Client','Mode','ETD','ETA','ATA','Delivery Date',
     'Status','Account Handler','Source Report Date'],
    CONFIG.SHEET_LIVE);
  return { ss: ss, rows: live.rows, headers: live.headers };
}

/** Handler for a JO: feed -> CA Tracker -> Ariel with a flag. */
function handlerMap_() {
  const map = {};
  try {
    const ca = SpreadsheetApp.openById(CONFIG.CA_TRACKER_ID);
    const t = readTab_(ca, CONFIG.CA_TAB, CONFIG.CA_HEADER_ROW);
    t.rows.forEach(function (r) {
      const jo = norm_(r['Job Order Number']);
      if (!jo) return;
      map[jo] = {
        handler: norm_(r['Requested By']),
        releaseStatus: norm_(r['Release Status']),
        balanceToRelease: num_(r['Balance Remaining to Release'])
      };
    });
  } catch (e) {
    // CA Tracker unreachable is not fatal — Penny degrades to feed-only handlers
    Logger.log('CA Tracker read failed: ' + e.message);
  }
  return map;
}

/** Freshness gate. Returns null when fresh, otherwise a reason string. */
function stalenessOfFeed_(rows) {
  if (!rows.length) return 'LogiSys Live is empty';
  var newest = null;
  rows.forEach(function (r) {
    const d = validDate_(r['Source Report Date']);
    if (d && (!newest || d > newest)) newest = d;
  });
  if (!newest) return 'no valid Source Report Date in the feed';
  const gap = daysBetween_(newest, today_());
  if (gap > 0) {
    return 'latest LogiSys report is dated ' + fmtDateLong_(newest) +
           ' (' + gap + ' day' + (gap === 1 ? '' : 's') + ' old)';
  }
  return null;
}

/** Previous ETA per JO, from the archive's most recent EARLIER report. */
function previousEtas_(ss) {
  const out = {};
  const sh = ss.getSheetByName(CONFIG.SHEET_ARCHIVE);
  if (!sh) return { map: out, available: false };

  const t = readTab_(ss, CONFIG.SHEET_ARCHIVE, 1);
  if (!t.rows.length) return { map: out, available: false };

  // find the newest report date strictly before today
  var prevDate = null;
  t.rows.forEach(function (r) {
    const d = validDate_(r['Source Report Date']);
    if (!d) return;
    if (d < today_() && (!prevDate || d > prevDate)) prevDate = d;
  });
  if (!prevDate) return { map: out, available: false };

  t.rows.forEach(function (r) {
    const d = validDate_(r['Source Report Date']);
    if (!d || d.getTime() !== prevDate.getTime()) return;
    const jo = norm_(r['JO Number']);
    if (!jo) return;
    out[jo] = { eta: validDate_(r['ETA']), hadEta: norm_(r['ETA']) !== '' };
  });
  return { map: out, available: true, asOf: prevDate };
}

/** JOs present today but not in the previous report = newly encoded. */
function newJos_(rows, prev) {
  if (!prev.available) return [];
  return rows.filter(function (r) {
    const jo = norm_(r['JO Number']);
    return jo && !(jo in prev.map);
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

/** ============ The five queues ============ */
function buildQueues_(rows, hmap, prev) {
  const T = today_();
  const Q = { q1: [], q2: [], q3: [], q4: [], q5a: [], q5b: [], q5c: [], defects: [] };

  rows.forEach(function (r) {
    const jo = norm_(r['JO Number']);
    if (!jo) return;

    // ---- date defects: never compute with them
    ['ETD','ETA','ATA','Delivery Date','Last Updated','Shipment Date'].forEach(function (f) {
      if (isBadDate_(r[f])) {
        Q.defects.push({ jo: jo, client: norm_(r['Client']), field: f, value: String(r[f]) });
      }
    });

    const etd = validDate_(r['ETD']);
    const eta = validDate_(r['ETA']);
    const ata = validDate_(r['ATA']);
    const del = validDate_(r['Delivery Date']);
    const upd = validDate_(r['Last Updated']);
    const status = norm_(r['Status']);
    const mode = modeOf_(r);
    const client = norm_(r['Client']);
    const ca = hmap[jo] || {};
    const handler = norm_(r['Account Handler']) || ca.handler || '';

    const funding = caFunding_(ca.releaseStatus);
    const base = {
      jo: jo, client: client, mode: mode, handler: handler,
      handlerKnown: !!handler, eta: eta, ata: ata, etd: etd,
      status: status,
      releaseStatus: ca.releaseStatus || '',
      funding: funding,                                  // funded | partial | unfunded
      balanceToRelease: ca.balanceToRelease || 0
    };

    // ===== HANDOFF: delivered belongs to Nico. Skip entirely. =====
    if (del) return;
    if (!ata && containsAny_(status, CONFIG.STATUS_IMPLIES_DELIVERED)) return;

    // ---- Queue 1: arrived, not delivered
    if (ata) {
      const age = daysBetween_(ata, T);
      const sla = clientSla_(client, mode);
      var sev = 'green';
      if (age >= CONFIG.Q1_CRITICAL) sev = 'critical';
      else if (age >= CONFIG.Q1_RED) sev = 'red';
      else if (age >= CONFIG.Q1_AMBER) sev = 'amber';
      if (age > sla && sev === 'green') sev = 'amber';       // client SLA override
      if (age > sla && sev === 'amber' && age >= sla + 2) sev = 'red';

      Q.q1.push(Object.assign({}, base, {
        age: age, sev: sev, sla: sla,
        daysToStorage: CONFIG.STORAGE_FREE_DAYS - age + 1,
        daysToDemurrage: CONFIG.DEMURRAGE_FREE_DAYS - age + 1,
        storageRunning: age > CONFIG.STORAGE_FREE_DAYS,
        demurrageRunning: age > CONFIG.DEMURRAGE_FREE_DAYS,
        slaBreach: age > sla
      }));
    }

    // ---- Queue 2: in transit, ETA approaching
    if (!ata && eta) {
      const dTo = daysBetween_(T, eta);
      if (dTo !== null && dTo >= 0 && dTo <= CONFIG.Q2_ETA_WINDOW) {
        // Red only when arriving within a day with NO cash advance released.
        // A partial release is often enough to deliver on, so it is not an alarm.
        Q.q2.push(Object.assign({}, base, {
          daysToEta: dTo,
          sev: (dTo <= 1 && funding === 'unfunded') ? 'red' : 'amber'
        }));
      }
    }

    // ---- Queue 4: stale status  (8+ days)
    if (upd) {
      const sdays = daysBetween_(upd, T);
      if (sdays >= CONFIG.Q4_STALE_RED) {
        Q.q4.push(Object.assign({}, base, { age: sdays, sev: 'red', lastUpdated: upd }));
      }
    }
    if (!ata && containsAny_(status, CONFIG.STATUS_IMPLIES_ARRIVAL)) {
      Q.q4.push(Object.assign({}, base, {
        sev: 'red', gap: 'Status says "' + status + '" but ATA is blank'
      }));
    }

    // ---- Queue 5a: no ETA recorded
    if (!eta && !ata) {
      const past = etd ? daysBetween_(etd, T) : null;
      var s5 = 'green';
      if (past !== null && past >= CONFIG.Q5A_RED_ETD_PAST) s5 = 'red';
      else if (past !== null && past >= CONFIG.Q5A_AMBER_ETD_PAST) s5 = 'amber';
      if (s5 !== 'green') {
        Q.q5a.push(Object.assign({}, base, { sev: s5, etdPast: past }));
      }
    }

    // ---- Queue 5b: ETA changed  (needs the archive)
    if (prev.available && (jo in prev.map)) {
      const p = prev.map[jo];
      const had = p.hadEta, was = p.eta;
      if (had && !eta) {
        Q.q5b.push(Object.assign({}, base, {
          sev: 'red', oldEta: was, newEta: null, moved: null, removed: true
        }));
      } else if (was && eta) {
        const moved = daysBetween_(was, eta);       // + = later, - = earlier
        if (moved !== null && Math.abs(moved) >= 1) {
          var s5b = 'green';
          if (moved <= -CONFIG.Q5B_RED_EARLIER) s5b = 'red';           // EARLIER = red
          else if (moved >= CONFIG.Q5B_RED_LATER) s5b = 'red';
          else if (moved >= CONFIG.Q5B_AMBER_LATER) s5b = 'amber';
          if (s5b !== 'green') {
            Q.q5b.push(Object.assign({}, base, {
              sev: s5b, oldEta: was, newEta: eta, moved: moved, removed: false
            }));
          }
        }
      }
    }

    // ---- Queue 5c: ETA passed, no arrival
    if (!ata && eta) {
      const pastEta = daysBetween_(eta, T);
      if (pastEta !== null && pastEta >= CONFIG.Q5C_AMBER) {
        Q.q5c.push(Object.assign({}, base, {
          age: pastEta,
          sev: pastEta >= CONFIG.Q5C_RED ? 'red' : 'amber'
        }));
      }
    }
  });

  // Queue 3 (new JOs) is filled by the caller from previousEtas_
  // sort worst first
  ['q1','q2','q4','q5a','q5b','q5c'].forEach(function (k) {
    Q[k].sort(function (a, b) { return (b.age || 0) - (a.age || 0); });
  });
  return Q;
}
