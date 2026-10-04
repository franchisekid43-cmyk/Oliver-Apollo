// Philindo One — explainer, built from the team launch slides (each slide split into its own layers).
import { readFileSync } from 'node:fs';

const M = JSON.parse(readFileSync('/home/user/vid/layers/manifest.json', 'utf8'));
const ALL = [['cover', 5.5], ['places', 6.5], ['onedoor', 5], ['pillars', 7], ['signin', 6.5], ['welcome', 5], ['dashboards', 6.5],
  ['div-handlers', 4], ['h-newjob', 6.5], ['h-viber', 6], ['h-dispatch', 6], ['h-ca', 6.5], ['div-dispatch', 4.5], ['d-board', 6],
  ['p-phone', 6], ['p-thanks', 5.5], ['div-billing', 3.5], ['b-desk', 5.5], ['div-finance', 3.5], ['f-desk', 5.5], ['div-mf', 4],
  ['m-board', 5.5], ['mgmt', 6], ['rollout', 7], ['close', 6.5]];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;   // e.g. ONLY=cover,places for a quick test
const PLAN = ONLY ? ALL.filter(([id]) => ONLY.includes(id)) : ALL;
const OVER = 0.6;                       // scenes overlap: the next one rises while this one leaves
const OUT = [0.16, 1, 0.3, 1];          // expo-out: fast start, long soft landing
const IO = [0.65, 0, 0.35, 1];
const POP = [0.34, 1.4, 0.64, 1];

const glow = (x, y, w, h, color, a, dx, dy, total) => (
  <rect x={x} y={y} width={w} height={h}
    fill={{ kind: 'radial', stops: [{ offset: 0, color, opacity: a }, { offset: 0.35, color, opacity: a * 0.55 }, { offset: 0.68, color, opacity: 0 }, { offset: 1, color, opacity: 0 }] }}
    animate={[
      { property: 'offsetX', keyframes: [{ at: 0, value: 0 }, { at: total / 2, value: dx }, { at: total, value: 0 }], easing: 'ease-in-out' },
      { property: 'offsetY', keyframes: [{ at: 0, value: 0 }, { at: total / 2, value: dy }, { at: total, value: 0 }], easing: 'ease-in-out' },
    ]} />
);

function layer(l, h, d0, dur) {
  const shot = l.kind === 'shot', row = l.kind === 'row', logo = l.kind === 'logo';
  const dy = shot ? 130 : row ? 22 : logo ? 10 : 40;
  const b = shot ? 22 : 12;
  const inT = shot ? 1.5 : 1.0;
  const anim = [
    { property: 'opacity', keyframes: [{ at: 0, value: 0 }, { at: d0, value: 0, easing: 'ease-out' }, { at: d0 + (shot ? 0.8 : 0.6), value: 1 }] },
    { property: 'offsetY', keyframes: [{ at: 0, value: dy }, { at: d0, value: dy, easing: OUT }, { at: d0 + inT, value: 0 }] },
    // blur never reaches exactly 0: the renderer's un-blurred path mishandles soft alpha (pale halos round shadows)
    { property: 'blur', keyframes: [{ at: 0, value: b }, { at: d0, value: b, easing: OUT }, { at: d0 + inT * 0.7, value: 0.001 }] },
  ];
  // while it holds, everything keeps drifting up a little (screens more than words): a slow parallax
  if (!shot) anim.push({ property: 'offsetY', from: 0, to: row ? -6 : -12, at: d0 + inT, duration: Math.max(0.5, dur - d0 - inT - 0.05), easing: 'linear' });
  if (shot) {
    anim.push({ property: 'scale', keyframes: [{ at: 0, value: 0.92 }, { at: d0, value: 0.92, easing: OUT }, { at: d0 + inT, value: 1 }] });
    anim.push({ property: 'offsetY', from: 0, to: -30, at: d0 + inT, duration: Math.max(0.5, dur - d0 - inT - 0.05), easing: 'linear' });
  }
  if (logo) anim.push({ property: 'scale', keyframes: [{ at: 0, value: 0.6 }, { at: d0, value: 0.6, easing: POP }, { at: d0 + 0.9, value: 1 }] });
  return <media file={h} x={l.x} y={l.y} width={l.w} height={l.h} fit="fill" animate={anim}
    motionBlur={shot ? { samples: 6, shutter: 0.5 } : undefined} />;
}

const greenBg = (dur) => (
  <frame name="green" x={0} y={0} width={1920} height={1080} layout="none" clip
    reveal={{ from: 'bottom', at: 0, duration: 0.9, easing: IO }}>
    <rect x={0} y={0} width={1920} height={1080}
      fill={{ kind: 'linear', angle: 135, stops: [{ offset: 0, color: '#34A853' }, { offset: 0.55, color: '#1E7A3A' }, { offset: 1, color: '#17602D' }] }} />
    <rect x={-700} y={-760} width={2000} height={1700}
      fill={{ kind: 'radial', stops: [{ offset: 0, color: '#8FD85F', opacity: 0.5 }, { offset: 0.35, color: '#8FD85F', opacity: 0.27 }, { offset: 0.68, color: '#8FD85F', opacity: 0 }, { offset: 1, color: '#8FD85F', opacity: 0 }] }}
      animate={[{ property: 'offsetX', from: 0, to: 180, duration: dur, easing: 'ease-in-out' }]} />
  </frame>
);

export default async ({ project }) => {
  const p = await project({ dir: '/home/user/vid/p60', size: '1920x1080', fps: Number(process.env.FPS || 60), background: '#F3F9EE' });
  let t = 0;
  const starts = PLAN.map(([, d]) => { const s = t; t += d - OVER; return s; });
  const total = starts[starts.length - 1] + PLAN[PLAN.length - 1][1];

  p.compose(
    <frame width={1920} height={1080} layout="none">
      <rect x={0} y={0} width={1920} height={1080}
        fill={{ kind: 'linear', angle: 180, stops: [{ offset: 0, color: '#F7FCF2' }, { offset: 1, color: '#EEF8E6' }] }} />
      {glow(-640, -620, 1700, 1500, '#B7EB8F', 0.62, 300, 160, total)}
      {glow(1240, -300, 1400, 1300, '#7FD69A', 0.32, -260, 200, total)}
      {glow(160, 620, 1900, 1200, '#D4F7AE', 0.72, 220, -150, total)}
      {glow(1400, 700, 1100, 1000, '#FFDEA8', 0.26, -160, -80, total)}
    </frame>,
    { at: 0, dur: total, name: 'Background' });

  for (const [i, [id, dur]] of PLAN.entries()) {
    const m = M[id];
    const handles = [];
    for (const l of m.layers) handles.push(await p.add('/home/user/vid/layers/' + l.file));
    const n = m.layers.length;
    const step = Math.min(0.12, 1.5 / Math.max(1, n));
    const first = m.green ? 0.45 : 0.3;
    const kids = m.layers.map((l, k) => layer(l, handles[k], first + k * step, dur));
    p.compose(
      <frame name={id} width={1920} height={1080} layout="none"
        motion={{ exit: { to: { opacity: 0, y: -26 }, duration: OVER, easing: IO } }}>
        {m.green ? greenBg(dur) : null}
        {kids}
      </frame>,
      { at: starts[i], dur, name: id });
  }
  console.log('TOTAL', total.toFixed(2), 'STARTS', JSON.stringify(Object.fromEntries(PLAN.map(([id], i) => [id, +starts[i].toFixed(2)]))));
  const times = (process.env.FRAMES || '').split(',').filter(Boolean).map(Number);
  for (const ft of times) await p.frame(ft, `renders/f-${ft}.png`);
};
