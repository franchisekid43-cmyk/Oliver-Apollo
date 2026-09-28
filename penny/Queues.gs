/** ============ Load the feed and build the five queues ============ */

function loadFeed_() {
  const ss = feedBook_();
  const live = readTab_(ss, CONFIG.SHEET_LIVE, 1);
  requireHeaders_(live.headers, LIVE_REQUIRED, CONFIG.SHEET_LIVE);
  return { ss: ss, rows: live.rows, headers: live.headers };
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
    // an ETA that was never a valid date cannot be "removed" or "moved"
    out[jo] = { eta: validDate_(r['ETA']), badEta: isBadDate_(r['ETA']) };
  });
  return { map: out, available: true, asOf: prevDate };
}

/** JOs present today but not in the previous report = newly encoded. */
function newJos_(rows, prev) {
  if (!prev.available) return [];
  return currentRows_(rows).rows.filter(function (r) {
    const jo = norm_(r['JO Number']);
    return jo && !(jo in prev.map) && !isDelivered_(r);
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
    const anchor = arr.date || eta || etd || validDate_(r['Shipment Date']);
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
        flag(base, f + ' "' + shown + '" is not a valid date', 'amber');
      }
    });
    (cur.notes[jo] || []).forEach(function (n) { flag(base, n, 'amber', { duplicate: true }); });

    // ---- Queue 4: stale status (8+ days)
    if (upd) {
      const sdays = daysBetween_(upd, T);
      if (sdays >= CONFIG.Q4_STALE_RED) {
        flag(base, 'status unchanged since ' + fmtDate_(upd) + ' (' + sdays + ' days)', 'red', { age: sdays });
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
    if (!arr.arrived && !validDate_(r['ATA']) && containsAny_(status, CONFIG.STATUS_IMPLIES_ARRIVAL)) {
      flag(base, 'status says "' + status + '" but ATA is blank', 'red');
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
