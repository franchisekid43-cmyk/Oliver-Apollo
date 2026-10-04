// Philindo One — 61-second promo, v2: voice-over scenes built on the app's own screens (cash advance sent, Finance desk, pending by handler).
const A = '/home/user/promo/';
const INK = '#1D1D1F', DEEP = '#1E7A3A', CREAM = '#F7FCF2', MUTED = '#6E6E73';
const OUT = [0.16, 1, 0.3, 1], IO = [0.65, 0, 0.35, 1], INQ = [0.64, 0, 0.78, 0];
const G = [{ offset: 0, color: '#17602D' }, { offset: 0.45, color: '#34A853' }, { offset: 1, color: '#8FD85F' }];
const GL = [{ offset: 0, color: '#E6F4E4' }, { offset: 0.5, color: '#CFF5B0' }, { offset: 1, color: '#8FD85F' }];
const est = (s, size) => s.length * size * 0.46;
let uid = 0;
const tm = (at, size, by = 'word', dur = 0.8) => ({ by, at, from: { opacity: 0, y: size * 0.45 }, duration: dur, overlap: 0.55, easing: 'house' });
const ptext = (str, { y, size = 104, weight = 700, at = 0, color = INK, by = 'word', dur }) => (
  <text x={0} y={y} width={1920} align="center" fontFamily="Inter" fontWeight={weight} fontSize={size} letterSpacing={-size * 0.035}
    lineHeight={1.15} color={color} motion={tm(at, size, by, dur)}>{str}</text>);
const gtext = (str, { y, size = 104, weight = 700, at = 0, stops = G, by = 'word', dur }) => {
  const n = 'm' + uid++, w = est(str, size) + 160;
  return [<group name={n}>{ptext(str, { y, size, weight, at, color: '#000000', by, dur })}</group>,
    <rect x={960 - w / 2} y={y - size * 0.2} width={w} height={size * 1.65} matte={n} fill={{ kind: 'linear', angle: 90, stops }} />];
};
// a gentle bob for as long as the thing is on screen (a loop needs 2+ cycles; otherwise one slow bob)
const floatY = (life, amp, period) => {
  const n = Math.floor((life - 0.1) / period), P = n >= 2 ? period : Math.max(0.6, life - 0.1);
  const k = { property: 'offsetY', keyframes: [{ at: 0, value: 0, easing: 'ease-in-out' }, { at: P / 2, value: -amp, easing: 'ease-in-out' }, { at: P, value: 0 }] };
  return n >= 2 ? { ...k, repeat: n } : k;
};
const pop = { enter: { from: { scale: 0.2 }, duration: 0.75, easing: { kind: 'overshoot', amount: 1.8 } } };
function tile(ic, x, y, s, at, life, { amp = 10, period = 3.2, blur = 0, op = 1 } = {}) {
  const anim = [{ property: 'opacity', from: 0, to: op, duration: 0.25 }, floatY(life - at, amp, period)];
  if (blur) anim.push({ property: 'blur', from: blur, to: blur, duration: life - at - 0.05 });
  return <frame x={x} y={y} width={s} height={s} layout="none" origin="center" at={at} motion={pop} animate={anim}>
    <rect x={0} y={0} width={s} height={s} radius={s * 0.28} fill="#FFFFFF" shadow={{ x: 0, y: s * 0.16, blur: s * 0.4, color: 'rgba(30,90,45,0.24)' }} />
    {icon(ic, { x: s * 0.24, y: s * 0.24, size: s * 0.52, color: DEEP, strokeWidth: 1.8 })}
  </frame>;
}
let icon;
function chip(label, ic, cx, cy, at, life, lead) {
  const w = Math.round(label.length * 30 * 0.55 + 116), h = 84, x = cx - w / 2, y = cy - h / 2;
  return <frame x={x} y={y} width={w} height={h} layout="none" origin="center" at={at}
    motion={{ exit: { to: { x: 960 - cx, y: 560 - cy, scale: 0.15, opacity: 0 }, duration: 0.6, easing: INQ, at: lead } }}>
    <frame x={0} y={0} width={w} height={h} layout="none" origin="center" motion={pop}
      animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.25 }, floatY(life - at - lead - 0.7, 8, 2.8 + (cx % 7) / 10)]}>
      <rect x={0} y={0} width={w} height={h} radius={42} fill="#FFFFFF" shadow={{ x: 0, y: 14, blur: 34, color: 'rgba(30,90,45,0.22)' }} />
      {icon(ic, { x: 26, y: 20, size: 44, color: DEEP, strokeWidth: 1.8 })}
      <text x={84} y={23} width={w - 96} align="left" fontFamily="Inter" fontWeight={600} fontSize={30} letterSpacing={-0.6} color={INK}>{label}</text>
    </frame>
  </frame>;
}
function phone(file, x, y, w, at, extra = []) {
  const h = Math.round(w * 2.035), pad = Math.round(w * 0.03);
  return <frame x={x} y={y} width={w} height={h} layout="none" origin="center" at={at}
    animate={[{ property: 'opacity', from: 0, to: 1, at: 0, duration: 0.5 },
      { property: 'offsetY', keyframes: [{ at: 0, value: 620, easing: OUT }, { at: 1.5, value: 0, easing: 'linear' }, { at: 4.2, value: -36 }] },
      { property: 'rotation', keyframes: [{ at: 0, value: -7, easing: OUT }, { at: 1.6, value: 0 }] }, ...extra]}>
    <rect x={0} y={0} width={w} height={h} radius={w * 0.13} fill="#121513" shadow={{ x: 0, y: 46, blur: 100, color: 'rgba(20,60,30,0.36)' }} />
    <media file={file} x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad} fit="cover" radius={w * 0.105} />
  </frame>;
}
function note(ic, title, sub, x, y, at, life) {
  return <frame x={x} y={y} width={480} height={108} layout="none" origin="center" at={at} motion={pop}
    animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.25 }, floatY(life - at, 7, 3.4)]}>
    <rect x={0} y={0} width={480} height={108} radius={28} fill="#FFFFFF" shadow={{ x: 0, y: 18, blur: 44, color: 'rgba(30,90,45,0.22)' }} />
    <rect x={22} y={22} width={64} height={64} radius={32} fill="#E6F4E4" />
    {icon(ic, { x: 37, y: 37, size: 34, color: DEEP, strokeWidth: 2 })}
    <text x={106} y={22} width={360} align="left" fontFamily="Inter" fontWeight={700} fontSize={28} letterSpacing={-0.6} color={INK}>{title}</text>
    <text x={106} y={60} width={360} align="left" fontFamily="Inter" fontWeight={400} fontSize={22} color={MUTED}>{sub}</text>
  </frame>;
}
const RING = 'M 0 -100 C 55 -100 100 -55 100 0 C 100 55 55 100 0 100 C -55 100 -100 55 -100 0 C -100 -55 -55 -100 0 -100 Z';
const ring = (at, dur, to, width, color) => <path x={960} y={540} width={200} height={200} d={RING} at={at} duration={dur}
  stroke={{ width, color, cap: 'round' }} animate={[{ property: 'scale', from: 0.5, to, duration: dur, easing: OUT },
    { property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: 0.12, value: 1 }, { at: dur, value: 0 }] }]} />;
function logoTile(logo, x, y, s, at) {
  return <frame x={x} y={y} width={s} height={s} layout="none" origin="center" at={at} motion={pop} animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.25 }]}>
    <rect x={0} y={0} width={s} height={s} radius={s * 0.26} fill="#FFFFFF" shadow={{ x: 0, y: s * 0.14, blur: s * 0.45, color: 'rgba(10,50,20,0.30)' }} />
    <media file={logo} x={s * 0.14} y={s * 0.2} width={s * 0.72} height={s * 0.6} fit="contain" />
  </frame>;
}
const radial = (x, y, w, h, color, a) => <rect x={x} y={y} width={w} height={h}
  fill={{ kind: 'radial', stops: [{ offset: 0, color, opacity: a }, { offset: 0.35, color, opacity: a * 0.55 }, { offset: 0.68, color, opacity: 0 }, { offset: 1, color, opacity: 0 }] }} />;
const drift = (node, dx, total) => <group animate={[{ property: 'offsetX', keyframes: [{ at: 0, value: 0, easing: 'ease-in-out' }, { at: total / 2, value: dx, easing: 'ease-in-out' }, { at: total, value: 0 }] }]}>{node}</group>;
const beat = (name, kids, extra = {}) => <frame name={name} width={1920} height={1080} layout="none" origin="center"
  motion={{ exit: { to: { opacity: 0, y: -34 }, duration: 0.45, easing: IO }, ...extra }}>{kids}</frame>;

// v2 (4 Oct 2026): no AI footage; a cash advance sent for real, a peek at Finance's desk, pending shipments by handler.
// Scene starts are shared with the sound mix (mix.py): keep them in step.
const S = { intro: [0, 5.6], p1: [5.1, 3.5], p2: [8.2, 4.2], p3: [12.0, 5.4], ring: [17.0, 1.9], name: [18.4, 3.2], mon: [21.2, 6.8],
  ca: [27.6, 7.8], fin: [35.0, 5.8], pend: [40.4, 5.6], ph: [45.6, 4.6], k5: [49.8, 3.8], cta: [53.2, 3.6], end: [56.4, 5.0] };
const at = (k) => ({ at: S[k][0], dur: S[k][1], name: k });
// a browser window: white card, top bar with three dots and an address pill; content clipped below the bar
const WX = 330, WY = 170, WW = 1260, WH = 800, BAR = 46;
function win(url, content, enterAt = 0) {
  return <frame x={WX} y={WY} width={WW} height={WH} layout="none" origin="center"
    animate={[{ property: 'opacity', from: 0, to: 1, at: enterAt, duration: 0.45 }, { property: 'offsetY', from: 220, to: 0, at: enterAt, duration: 1.2, easing: OUT },
      { property: 'scale', from: 0.94, to: 1, at: enterAt, duration: 1.2, easing: OUT }]}>
    <rect x={0} y={0} width={WW} height={WH} radius={22} fill="#FFFFFF" shadow={{ x: 0, y: 40, blur: 100, color: 'rgba(20,60,30,0.30)' }} />
    <rect x={0} y={0} width={WW} height={BAR + 22} radius={22} fill="#F3F6F1" />
    <rect x={0} y={22} width={WW} height={BAR - 22} fill="#F3F6F1" />
    <rect x={22} y={16} width={14} height={14} radius={7} fill="#D5DED1" /><rect x={44} y={16} width={14} height={14} radius={7} fill="#D5DED1" /><rect x={66} y={16} width={14} height={14} radius={7} fill="#D5DED1" />
    <rect x={WW / 2 - 230} y={9} width={460} height={28} radius={14} fill="#FFFFFF" />
    <text x={WW / 2 - 230} y={14} width={460} align="center" fontFamily="Inter" fontWeight={400} fontSize={15} color="#8E8E93">{url}</text>
    <frame x={0} y={BAR} width={WW} height={WH - BAR} layout="none" clip>{content}</frame>
  </frame>;
}
const shotH = (h) => Math.round(h.height * WW / h.width);
const panY = (keys) => ({ property: 'offsetY', keyframes: keys.map(([t, v, e]) => ({ at: t, value: v, ...(e ? { easing: e } : {}) })) });
// a small label above the window, like a chapter tab
const tab = (label, ic, delay = 0.3) => <frame x={WX} y={WY - 78} width={label.length * 13.6 + 92} height={52} layout="none" origin="center" at={delay} motion={pop}
  animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.25 }]}>
  <rect x={0} y={0} width={label.length * 13.6 + 92} height={52} radius={26} fill="#E6F4E4" />
  {icon(ic, { x: 18, y: 13, size: 26, color: DEEP, strokeWidth: 2 })}
  <text x={54} y={13} width={label.length * 13.6 + 30} align="left" fontFamily="Inter" fontWeight={600} fontSize={22} letterSpacing={-0.3} color={DEEP}>{label}</text>
</frame>;
const CURSOR = 'M 0 0 L 0 34 L 9 26 L 15 40 L 21 37 L 15 24 L 27 24 Z';

export default async ({ project, icon: ic }) => {
  icon = ic;
  const p = await project({ dir: '/home/user/promo/q' + (process.env.FPS || 60), size: '1920x1080', fps: Number(process.env.FPS || 60), background: '#FFFFFF' });
  const F = {};
  for (const k of ['phone-home', 'my-job-phone', 'main-dashboard', 'board', 'logo']) F[k] = await p.add(A + 'assets/' + k + '.png');
  for (const k of ['ca-filled', 'ca-sent', 'finance-desk', 'pending']) F[k] = await p.add(A + 'v2/' + k + '.png');
  const T = S.end[0] + S.end[1];
  p.compose(<frame width={1920} height={1080} layout="none">
    <rect x={0} y={0} width={1920} height={1080} fill={{ kind: 'linear', angle: 180, stops: [{ offset: 0, color: '#FFFFFF' }, { offset: 1, color: '#EFF8E8' }] }} />
    {drift(radial(-500, 560, 1700, 1000, '#B7EB8F', 0.7), 260, T)}
    {drift(radial(500, 640, 1500, 900, '#D4F7AE', 0.85), -220, T)}
    {drift(radial(1100, 560, 1500, 1000, '#7FD69A', 0.45), -300, T)}
    {drift(radial(-300, -500, 1300, 1000, '#D4F7AE', 0.45), 200, T)}
  </frame>, { at: 0, dur: T, name: 'page' });

  // INTRO
  p.compose(beat('intro', [
    ...gtext('Philindo One.', { y: 110, size: 236, weight: 900, at: 0.15, by: 'character', dur: 1.0 }),
    phone(F['phone-home'], 740, 330, 440, 0.45),
    tile('ship', 470, 400, 124, 1.15, 5.6), tile('truck', 1320, 360, 132, 1.3, 5.6), tile('banknote', 380, 720, 104, 1.45, 5.6),
    tile('clock', 1440, 700, 112, 1.6, 5.6), tile('file-check', 560, 900, 92, 1.75, 5.6), tile('plane', 1250, 910, 92, 1.9, 5.6),
  ], { exit: { to: { opacity: 0, scale: 1.06 }, duration: 0.5, easing: IO } }), at('intro'));

  // PROBLEM
  p.compose(beat('p1', [ptext('Every day, there’s', { y: 400, at: 0.15 }), ...gtext('a shipment to clear.', { y: 525, at: 0.6 }),
    tile('file-check', 392, 392, 104, 1.0, S.p1[1]), tile('ship', 1474, 528, 104, 1.25, S.p1[1])]), at('p1'));
  p.compose(beat('p2', [ptext('a cash advance to chase,', { y: 400, at: 0.15 }), ...gtext('a deadline to catch.', { y: 525, at: 0.9 }),
    tile('banknote', 1566, 392, 104, 1.0, S.p2[1]), tile('alarm-clock', 344, 528, 104, 1.6, S.p2[1])]), at('p2'));
  const C = [['LogiSys', 'database', 330, 190], ['CA Tracker', 'wallet', 1590, 200], ['Email', 'mail', 960, 160], ['Viber', 'message-circle', 190, 520],
    ['Excel', 'sheet', 1730, 520], ['Manifest Control', 'clipboard-list', 330, 850], ['Paper', 'files', 960, 920], ['Command Center', 'layout-dashboard', 1580, 850]];
  p.compose(beat('p3', [ptext('And it all lives in', { y: 400, at: 0.15 }), ...gtext('four different places.', { y: 525, at: 0.6 }),
    ...C.map(([l, ic2, cx, cy], i) => chip(l, ic2, cx, cy, 0.9 + i * 0.13, S.p3[1], 0.45))]), at('p3'));

  // ONE PLACE — the ring, then the name on the page
  p.compose(<frame width={1920} height={1080} layout="none">
    {ring(0, 1.5, 6, 6, '#34A853')}{ring(0.22, 1.5, 4.5, 4, '#8FD85F')}
    {logoTile(F.logo, 870, 450, 180, 0.05)}
  </frame>, at('ring'));
  p.compose(beat('name', [
    logoTile(F.logo, 885, 230, 150, 0.4),
    ...gtext('Philindo One', { y: 420, size: 168, weight: 900, at: 0.55, by: 'character', dur: 0.9 }),
    ptext('One place for the whole team.', { y: 640, size: 46, weight: 600, at: 1.2, color: '#3A3A3C' }),
  ]), at('name'));

  // SEARCH — the dashboard on a monitor, found in a search
  p.compose(beat('mon', [
    <frame x={510} y={110} width={900} height={96} layout="none" animate={[{ property: 'opacity', from: 0, to: 1, at: 0.2, duration: 0.4 }, { property: 'offsetY', from: 40, to: 0, at: 0.2, duration: 0.9, easing: OUT }]}>
      <rect x={0} y={0} width={900} height={96} radius={48} fill="#FFFFFF" shadow={{ x: 0, y: 16, blur: 40, color: 'rgba(30,90,45,0.2)' }} />
      {icon('search', { x: 34, y: 26, size: 44, color: MUTED, strokeWidth: 2 })}
      <text x={100} y={26} width={760} align="left" fontFamily="Inter" fontWeight={400} fontSize={38} color="#9A9FA3" duration={0.9}
        animate={[{ property: 'opacity', keyframes: [{ at: 0, value: 1 }, { at: 0.7, value: 1 }, { at: 0.85, value: 0 }] }]}>Search JO, client, BL or container</text>
      <text x={100} y={26} width={760} align="left" fontFamily="Inter" fontWeight={600} fontSize={38} color={INK} at={0.9}
        motion={{ by: 'character', at: 0, from: { opacity: 0 }, duration: 1.1, overlap: 0, easing: 'linear' }}>BL MEDUEZ579057</text>
    </frame>,
    <frame x={340} y={300} width={1240} height={860} layout="none" origin="center"
      animate={[{ property: 'opacity', from: 0, to: 1, at: 0.3, duration: 0.5 }, { property: 'offsetY', from: 300, to: 0, at: 0.3, duration: 1.4, easing: OUT },
        { property: 'scale', from: 1, to: 1.06, at: 1.7, duration: S.mon[1] - 1.8, easing: 'linear' }]}>
      <rect x={0} y={0} width={1240} height={760} radius={28} fill="#141714" shadow={{ x: 0, y: 40, blur: 100, color: 'rgba(20,60,30,0.32)' }} />
      <media file={F['main-dashboard']} x={18} y={18} width={1204} height={724} fit="cover" radius={12} />
      <media file={F.board} x={18} y={18} width={1204} height={724} fit="cover" radius={12} at={2.3}
        animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.5 }, { property: 'scale', from: 1.04, to: 1, duration: 0.8, easing: OUT }]} />
    </frame>,
    tile('truck', 120, 470, 100, 1.0, S.mon[1]), tile('ship', 1700, 420, 100, 1.15, S.mon[1]),
  ]), at('mon'));

  // CASH ADVANCE — the form scrolls, the cursor clicks Send, it is sent
  {
    const fh = shotH(F['ca-filled']), pan = -(fh - (WH - BAR));
    const k = WW / F['ca-filled'].width, bx = 868.36 * 1.5 * k + 244 * 1.5 * k / 2, by = 1090.72 * 1.5 * k + 44 * 1.5 * k / 2 + pan;
    const cx = WX + bx, cy = WY + BAR + by, sx = 1560, sy = 1000, tc = 3.85;
    p.compose(beat('ca', [
      tab('Cash advances · New request', 'banknote'),
      win('philindo-one › cash-advances › new', [
        <media file={F['ca-filled']} x={0} y={0} width={WW} height={fh} fit="fill" duration={4.15}
          animate={[panY([[0, 0], [1.0, 0, IO], [3.0, pan]]), { property: 'opacity', keyframes: [{ at: 0, value: 1 }, { at: 3.95, value: 1 }, { at: 4.15, value: 0 }] }]} />,
        <media file={F['ca-sent']} x={0} y={0} width={WW} height={shotH(F['ca-sent'])} fit="fill" at={3.95}
          animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.3 }, { property: 'scale', from: 1.03, to: 1, duration: 0.9, easing: OUT }]} />,
      ]),
      <path x={cx} y={cy} width={200} height={200} d={RING} at={tc} duration={0.6} stroke={{ width: 5, color: '#34A853' }}
        animate={[{ property: 'scale', from: 0.08, to: 0.45, duration: 0.6, easing: OUT }, { property: 'opacity', keyframes: [{ at: 0, value: 0.9 }, { at: 0.6, value: 0 }] }]} />,
      <path x={sx} y={sy} width={28} height={42} d={CURSOR} fill="#FFFFFF" stroke={{ width: 2, color: '#1D1D1F' }} at={2.5} duration={2.0}
        shadow={{ x: 0, y: 4, blur: 10, color: 'rgba(0,0,0,0.25)' }}
        animate={[{ property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: 0.2, value: 1 }, { at: 1.7, value: 1 }, { at: 2.0, value: 0 }] },
          { property: 'offsetX', keyframes: [{ at: 0, value: 0, easing: [0.45, 0, 0.2, 1] }, { at: 1.15, value: cx - sx }] },
          { property: 'offsetY', keyframes: [{ at: 0, value: 0, easing: [0.45, 0, 0.2, 1] }, { at: 1.15, value: cy - sy }] },
          { property: 'scale', keyframes: [{ at: 0, value: 1 }, { at: tc - 2.5 - 0.06, value: 1 }, { at: tc - 2.5, value: 0.82 }, { at: tc - 2.5 + 0.14, value: 1 }] }]} />,
      <frame x={1270} y={WY - 40} width={330} height={84} layout="none" origin="center" at={4.25} motion={pop} animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.2 }]}>
        <rect x={0} y={0} width={330} height={84} radius={42} fill="#1E7A3A" shadow={{ x: 0, y: 16, blur: 40, color: 'rgba(30,122,58,0.35)' }} />
        {icon('circle-check', { x: 24, y: 20, size: 44, color: '#FFFFFF', strokeWidth: 2 })}
        <text x={82} y={24} width={240} align="left" fontFamily="Inter" fontWeight={700} fontSize={30} letterSpacing={-0.5} color="#FFFFFF">Sent to Finance</text>
      </frame>,
    ]), at('ca'));
  }

  // SNEAK PEEK — Finance's desk, the queue it lands in
  {
    const fh = shotH(F['finance-desk']), k = WW / F['finance-desk'].width;
    const rx = 284 * 1.5 * k - 8, ry = 138 * 1.5 * k - 8, rw = 158.8 * 1.5 * k + 16, rh = 135 * 1.5 * k + 16; // the 'Requests to approve' tile, measured in the shot
    const pan = panY([[0, 0], [2.6, 0, IO], [5.2, -170]]), panR = panY([[0, 0], [1.3, 0, IO], [3.9, -170]]); // panR: the same scroll, for marks that start at 1.3s
    p.compose(beat('fin', [
      tab('Sneak peek · Finance desk', 'eye'),
      win('philindo-one › finance desk', [
        <media file={F['finance-desk']} x={0} y={0} width={WW} height={fh} fit="fill" animate={[pan]} />,
        <rect x={rx} y={ry} width={rw} height={rh} radius={20} fill="#34A853" at={1.3}
          animate={[panR, { property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: 0.3, value: 0.12 }] }]} />,
        <rect x={rx} y={ry} width={rw} height={rh} radius={20} strokeColor="#34A853" strokeWidth={5} fill="rgba(52,168,83,0)" at={1.3}
          shadow={{ x: 0, y: 0, blur: 24, color: 'rgba(52,168,83,0.6)' }}
          animate={[panR, { property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: 0.3, value: 1 }] }]} />,
      ], 0.1),
      <frame x={WX + rx + rw + 26} y={WY + BAR + ry + rh + 10} width={300} height={64} layout="none" origin="center" at={1.6} motion={pop}
        animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.2 }, { property: 'offsetY', keyframes: [{ at: 0, value: 0 }, { at: 1.0, value: 0, easing: IO }, { at: 3.6, value: -170 }] }]}>
        <rect x={0} y={0} width={300} height={64} radius={32} fill="#FFFFFF" shadow={{ x: 0, y: 12, blur: 30, color: 'rgba(30,90,45,0.25)' }} />
        <rect x={14} y={14} width={36} height={36} radius={18} fill="#E6F4E4" />
        {icon('arrow-up-left', { x: 21, y: 21, size: 22, color: DEEP, strokeWidth: 2.4 })}
        <text x={62} y={17} width={230} align="left" fontFamily="Inter" fontWeight={700} fontSize={24} letterSpacing={-0.4} color={INK}>Your request is in</text>
      </frame>,
    ]), at('fin'));
  }

  // PENDING — every handler's pending shipments, scrolling past
  {
    // scroll from one account handler's group to the next (header near the top at each stop); the side menu stays put
    const fh = shotH(F.pending), f = WW / F.pending.width * 1.5, stop = (y) => -Math.round(y * f - 24), SBW = Math.round(260 * f);
    const flick = [0.6, 0, 0.2, 1];
    p.compose(beat('pend', [
      tab('Pending shipments · by account handler', 'users'),
      win('philindo-one › dashboard › pending', [
        <media file={F.pending} x={0} y={0} width={WW} height={fh} fit="fill" motionBlur={{ samples: 8, shutter: 0.5 }}
          animate={[panY([[0, 0], [1.3, 0, flick], [1.95, stop(3195.2)], [2.55, stop(3195.2), flick], [3.1, stop(4178)], [3.7, stop(4178), flick], [4.25, stop(5109.3)]])]} />,
        <frame x={0} y={0} width={SBW} height={WH - BAR} layout="none" clip>
          <media file={F.pending} x={0} y={0} width={WW} height={fh} fit="fill" />
        </frame>,
      ], 0.1),
    ]), at('pend'));
  }

  // the processors' phone, with updates popping round it
  p.compose(beat('ph', [
    tile('ship', 640, 120, 72, 0.6, S.ph[1], { blur: 3, op: 0.85 }), tile('package', 1600, 190, 76, 0.7, S.ph[1], { blur: 3, op: 0.85 }), tile('plane', 1180, 960, 70, 0.8, S.ph[1], { blur: 3, op: 0.85 }),
    phone(F['my-job-phone'], 750, 130, 420, 0.1),
    note('truck', 'On my way', 'EA · Pick up DO', 170, 220, 1.0, S.ph[1]), note('map-pin', 'Arrived', 'MSC Manila, Port Area', 1270, 300, 1.35, S.ph[1]),
    note('circle-check', 'Done', 'The next job is up', 120, 560, 1.7, S.ph[1]), note('message-circle', 'Viber update ready', 'Copy it to the client', 1310, 640, 2.05, S.ph[1]),
    note('banknote', 'Cash advance released', 'Finance · just now', 230, 880, 2.4, S.ph[1]),
  ]), at('ph'));
  p.compose(beat('k5', [ptext('From the port to the office,', { y: 400, size: 100, at: 0.15 }), ...gtext('everyone sees the same thing.', { y: 520, size: 100, at: 1.0 })]), at('k5'));

  // CALL TO ACTION
  p.compose(beat('cta', [
    <path x={960} y={300} width={200} height={200} d={RING} at={0.3} duration={S.cta[1] - 0.35} stroke={{ width: 5, color: '#34A853', cap: 'round' }}
      animate={[{ property: 'scale', from: 0.6, to: 1.2, duration: 1.4, easing: OUT }, { property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: 0.2, value: 0.8 }, { at: 3.2, value: 0.5 }] }]} />,
    logoTile(F.logo, 890, 230, 140, 0.35),
    ptext('One place.', { y: 450, size: 150, weight: 900, at: 0.5 }),
    ...gtext('One team.', { y: 610, size: 150, weight: 900, at: 1.0 }),
  ]), at('cta'));
  p.compose(<frame width={1920} height={1080} layout="none">
    <frame x={0} y={0} width={1920} height={1080} layout="none" clip reveal={{ from: 'bottom', duration: 0.8, easing: IO }}>
      <rect x={0} y={0} width={1920} height={1080} fill={{ kind: 'linear', angle: 135, stops: [{ offset: 0, color: '#34A853' }, { offset: 0.55, color: '#1E7A3A' }, { offset: 1, color: '#17602D' }] }} />
      {drift(radial(-800, -800, 2200, 1900, '#8FD85F', 0.5), 200, S.end[1])}
    </frame>
    {logoTile(F.logo, 875, 170, 170, 0.5)}
    {ptext('Philindo One.', { y: 400, size: 180, weight: 900, at: 0.7, color: CREAM, by: 'character', dur: 0.9 })}
    {gtext('Always delivering.', { y: 625, size: 78, weight: 700, at: 1.3, stops: GL })}
    <frame x={640} y={790} width={640} height={84} layout="none" origin="center" at={1.8} motion={pop} animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.25 }]}>
      <rect x={0} y={0} width={640} height={84} radius={42} fill={CREAM} shadow={{ x: 0, y: 14, blur: 34, color: 'rgba(5,40,15,0.35)' }} />
      <text x={0} y={22} width={640} align="center" fontFamily="Inter" fontWeight={600} fontSize={32} letterSpacing={-0.5} color={DEEP}>Team launch · Monday, 5 October</text>
    </frame>
  </frame>, at('end'));

  const times = (process.env.FRAMES || '').split(',').filter(Boolean).map(Number);
  for (const t of times) await p.frame(t, `renders/f-${t}.png`);
};
