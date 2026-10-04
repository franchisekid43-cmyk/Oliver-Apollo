// Philindo One — 40-second promo in the "Intro → Problem → Use case → Call to action" structure.
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

export default async ({ project, icon: ic }) => {
  icon = ic;
  const p = await project({ dir: '/home/user/promo/p' + (process.env.FPS || 60), size: '1920x1080', fps: Number(process.env.FPS || 60), background: '#FFFFFF' });
  const F = {}; for (const k of ['phone-home', 'my-job-phone', 'main-dashboard', 'board', 'logo']) F[k] = await p.add(A + 'assets/' + k + '.png');
  const port = await p.add(A + 'port.mp4'), sea = await p.add(A + 'sea.mp4');
  const T = 43.2;
  // the page: white into pale green, a soft green "cloud" glow along the bottom that keeps drifting
  p.compose(<frame width={1920} height={1080} layout="none">
    <rect x={0} y={0} width={1920} height={1080} fill={{ kind: 'linear', angle: 180, stops: [{ offset: 0, color: '#FFFFFF' }, { offset: 1, color: '#EFF8E8' }] }} />
    {drift(radial(-500, 560, 1700, 1000, '#B7EB8F', 0.7), 260, T)}
    {drift(radial(500, 640, 1500, 900, '#D4F7AE', 0.85), -220, T)}
    {drift(radial(1100, 560, 1500, 1000, '#7FD69A', 0.45), -300, T)}
    {drift(radial(-300, -500, 1300, 1000, '#D4F7AE', 0.45), 200, T)}
  </frame>, { at: 0, dur: T, name: 'page' });

  // INTRO — the name, the phone rising in front of it, tiles popping round it
  p.compose(beat('intro', [
    ...gtext('Philindo One.', { y: 110, size: 236, weight: 900, at: 0.15, by: 'character', dur: 1.0 }),
    phone(F['phone-home'], 740, 330, 440, 0.45),
    tile('ship', 470, 400, 124, 1.15, 6.0), tile('truck', 1320, 360, 132, 1.3, 6.0), tile('banknote', 380, 720, 104, 1.45, 6.0),
    tile('clock', 1440, 700, 112, 1.6, 6.0), tile('file-check', 560, 900, 92, 1.75, 6.0), tile('plane', 1250, 910, 92, 1.9, 6.0),
  ], { exit: { to: { opacity: 0, scale: 1.06 }, duration: 0.5, easing: IO } }), { at: 0, dur: 6.0, name: 'intro' });

  // PROBLEM
  p.compose(beat('p1', [ptext('Every day, there’s', { y: 400, at: 0.15 }), ...gtext('a shipment to clear.', { y: 525, at: 0.6 }),
    tile('file-check', 392, 392, 104, 1.0, 3.6), tile('ship', 1474, 528, 104, 1.25, 3.6)]), { at: 5.6, dur: 3.6, name: 'p1' });
  p.compose(beat('p2', [ptext('a cash advance to chase,', { y: 400, at: 0.15 }), ...gtext('a deadline to catch.', { y: 525, at: 0.6 }),
    tile('banknote', 1566, 392, 104, 1.0, 3.6), tile('alarm-clock', 344, 528, 104, 1.25, 3.6)]), { at: 8.8, dur: 3.6, name: 'p2' });
  const C = [['LogiSys', 'database', 330, 190], ['CA Tracker', 'wallet', 1590, 200], ['Email', 'mail', 960, 160], ['Viber', 'message-circle', 190, 520],
    ['Excel', 'sheet', 1730, 520], ['Manifest Control', 'clipboard-list', 330, 850], ['Paper', 'files', 960, 920], ['Command Center', 'layout-dashboard', 1580, 850]];
  p.compose(beat('p3', [ptext('And it all lives in', { y: 400, at: 0.15 }), ...gtext('four different places.', { y: 525, at: 0.6 }),
    ...C.map(([l, ic2, cx, cy], i) => chip(l, ic2, cx, cy, 0.9 + i * 0.13, 5.6, 0.45))]), { at: 12.0, dur: 5.6, name: 'p3' });

  // USE CASE — a ring, then the port with the name
  p.compose(<frame width={1920} height={1080} layout="none">
    {ring(0, 1.5, 6, 6, '#34A853')}{ring(0.22, 1.5, 4.5, 4, '#8FD85F')}
    {logoTile(F.logo, 870, 450, 180, 0.05)}
  </frame>, { at: 17.0, dur: 1.9, name: 'ring' });
  p.compose(<frame name="port" width={1920} height={1080} layout="none" motion={{ enter: { from: { opacity: 0 }, duration: 0.5 }, exit: { to: { opacity: 0 }, duration: 0.45 } }}>
    <media file={port} x={0} y={0} width={1920} height={1080} fit="cover" trimStart={0.1} animate={[{ property: 'scale', from: 1.0, to: 1.1, duration: 4.4, easing: 'linear' }]} />
    <rect x={0} y={0} width={1920} height={1080} fill={{ kind: 'linear', angle: 180, stops: [{ offset: 0, color: '#000000', opacity: 0.3 }, { offset: 0.5, color: '#000000', opacity: 0.12 }, { offset: 1, color: '#000000', opacity: 0.5 }] }} />
    {logoTile(F.logo, 885, 250, 150, 0.45)}
    {ptext('Philindo One', { y: 430, size: 156, weight: 900, at: 0.6, color: '#FFFFFF', by: 'character', dur: 0.9 })}
    {ptext('One place for the whole team.', { y: 640, size: 46, weight: 600, at: 1.3, color: '#F2F7EE' })}
  </frame>, { at: 18.4, dur: 4.4, name: 'port' });

  // the dashboard on a monitor, found in a search
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
        { property: 'scale', from: 1, to: 1.05, at: 1.7, duration: 3.6, easing: 'linear' }]}>
      <rect x={0} y={0} width={1240} height={760} radius={28} fill="#141714" shadow={{ x: 0, y: 40, blur: 100, color: 'rgba(20,60,30,0.32)' }} />
      <media file={F['main-dashboard']} x={18} y={18} width={1204} height={724} fit="cover" radius={12} />
      <media file={F.board} x={18} y={18} width={1204} height={724} fit="cover" radius={12} at={2.3}
        animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.5 }, { property: 'scale', from: 1.04, to: 1, duration: 0.8, easing: OUT }]} />
    </frame>,
    tile('truck', 120, 470, 100, 1.0, 5.4), tile('ship', 1700, 420, 100, 1.15, 5.4),
  ]), { at: 22.4, dur: 5.4, name: 'mon' });

  // the processors' phone, with updates popping round it
  p.compose(beat('ph', [
    tile('ship', 640, 120, 72, 0.6, 4.8, { blur: 3, op: 0.85 }), tile('package', 1600, 190, 76, 0.7, 4.8, { blur: 3, op: 0.85 }), tile('plane', 1180, 960, 70, 0.8, 4.8, { blur: 3, op: 0.85 }),
    phone(F['my-job-phone'], 750, 130, 420, 0.1),
    note('truck', 'On my way', 'EA · Pick up DO', 170, 220, 1.0, 4.8), note('map-pin', 'Arrived', 'MSC Manila, Port Area', 1270, 300, 1.35, 4.8),
    note('circle-check', 'Done', 'The next job is up', 120, 560, 1.7, 4.8), note('message-circle', 'Viber update ready', 'Copy it to the client', 1310, 640, 2.05, 4.8),
    note('banknote', 'Cash advance released', 'Finance · just now', 230, 880, 2.4, 4.8),
  ]), { at: 27.4, dur: 4.8, name: 'ph' });
  p.compose(beat('k5', [ptext('From the port to the office,', { y: 400, size: 100, at: 0.15 }), ...gtext('everyone sees the same thing.', { y: 520, size: 100, at: 0.7 })]),
    { at: 31.8, dur: 3.6, name: 'k5' });

  // CALL TO ACTION
  p.compose(<frame name="sea" width={1920} height={1080} layout="none" motion={{ enter: { from: { opacity: 0 }, duration: 0.5 }, exit: { to: { opacity: 0 }, duration: 0.45 } }}>
    <media file={sea} x={0} y={0} width={1920} height={1080} fit="cover" trimStart={0.4} animate={[{ property: 'scale', from: 1.0, to: 1.07, duration: 4.2, easing: 'linear' }]} />
    <rect x={0} y={0} width={1920} height={1080} fill={{ kind: 'linear', angle: 180, stops: [{ offset: 0, color: '#0B2A14', opacity: 0.45 }, { offset: 0.6, color: '#0B2A14', opacity: 0.18 }, { offset: 1, color: '#0B2A14', opacity: 0.35 }] }} />
    <path x={960} y={330} width={200} height={200} d={RING} at={0.35} duration={3.8} stroke={{ width: 5, color: '#FFFFFF', cap: 'round' }}
      animate={[{ property: 'scale', from: 0.6, to: 1.25, duration: 1.4, easing: OUT }, { property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: 0.2, value: 0.9 }, { at: 3.8, value: 0.6 }] }]} />
    {logoTile(F.logo, 890, 260, 140, 0.4)}
    {ptext('One place. One team.', { y: 560, size: 128, weight: 700, at: 0.9, color: '#FFFFFF', dur: 1.0 })}
  </frame>, { at: 35.0, dur: 4.2, name: 'sea' });
  p.compose(<frame width={1920} height={1080} layout="none">
    <frame x={0} y={0} width={1920} height={1080} layout="none" clip reveal={{ from: 'bottom', duration: 0.8, easing: IO }}>
      <rect x={0} y={0} width={1920} height={1080} fill={{ kind: 'linear', angle: 135, stops: [{ offset: 0, color: '#34A853' }, { offset: 0.55, color: '#1E7A3A' }, { offset: 1, color: '#17602D' }] }} />
      {drift(radial(-800, -800, 2200, 1900, '#8FD85F', 0.5), 200, 4.4)}
    </frame>
    {logoTile(F.logo, 875, 170, 170, 0.5)}
    {ptext('Philindo One.', { y: 400, size: 180, weight: 900, at: 0.7, color: CREAM, by: 'character', dur: 0.9 })}
    {gtext('Always delivering.', { y: 625, size: 78, weight: 700, at: 1.3, stops: GL })}
    <frame x={640} y={790} width={640} height={84} layout="none" origin="center" at={1.8} motion={pop} animate={[{ property: 'opacity', from: 0, to: 1, duration: 0.25 }]}>
      <rect x={0} y={0} width={640} height={84} radius={42} fill={CREAM} shadow={{ x: 0, y: 14, blur: 34, color: 'rgba(5,40,15,0.35)' }} />
      <text x={0} y={22} width={640} align="center" fontFamily="Inter" fontWeight={600} fontSize={32} letterSpacing={-0.5} color={DEEP}>Team launch · Monday, 5 October</text>
    </frame>
  </frame>, { at: 38.8, dur: 4.4, name: 'end' });

  const times = (process.env.FRAMES || '').split(',').filter(Boolean).map(Number);
  for (const t of times) await p.frame(t, `renders/f-${t}.png`);
};
