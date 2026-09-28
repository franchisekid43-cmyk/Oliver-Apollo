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
  return table_(['JO','Client','What to check','Status'], rows);
}

function q5aHtml_(items) {
  if (!items.length) return '';
  const rows = items.map(function (s) {
    return ['<b>' + esc_(s.jo) + '</b>', esc_(s.client),
      s.etd ? fmtDate_(s.etd) + ' (' + s.etdPast + 'd ago)' : 'no ETD',
      sevChip_(s.sev)];
  });
  return table_(['JO','Client','Departed','' ], rows);
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
    .map(function (x) { return section_(x.sec.title, x.sec.note, RENDER_[x.sec.key](x.sec.items)); })
    .join('');
}
