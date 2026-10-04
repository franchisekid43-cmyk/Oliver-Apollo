// Splits each chosen deck slide into transparent PNG layers (pixel-identical to the slide) + a manifest for Higgsedit.
import { chromium } from 'playwright';
import fs from 'node:fs';
const S = new URL('../', import.meta.url).pathname;
const SL = S + 'deck/project/slides/', SHOTS = S + 'deckshots/', OUT = S + 'video/layers/';
const font = S + 'poster/inter-latin.woff2';
const BLOB = { '59520700b3cc145fe995846bec20d759': 'logo', '7aca144bf204baa0dde15c6961422dee': 'newjob', '910da77141a1cb5574400b0ad8f72415': 'milestones',
  '533695d01b305d94f183bd3924ad0809': 'ca-request', '4f3b923bb2f8c98901d33e4fe36e2a87': 'liq-bottom', '0fddf77109affa800b2545919ee997f7': 'offset',
  '1f10d367256f4aa416ae4a918da54b05': 'ca-status', '2f94a3eb4c247c0ace965f98f1dd7115': 'board', 'b23a8be5f0350fcd7f8d50dfd1e4ca53': 'billing-home',
  '7041877bd73905874aa52a480c4c9171': 'billing-form', 'e7e9b2d9d0866d0a5053c31fc9043f40': 'finance-home', 'd2fc5b0fa9b7473a682c9787f0d27678': 'manifest-board',
  'a7115d5874d8cfc551fddb79869e816b': 'manifest-form', '2bccf5e439d4ead8b2b36183ea53adbe': 'main-dashboard', '8eba3b570c91507fe66302f8523a9f5c': 'help',
  'd07eca2e7fed864ccd1d250dd22be88d': 'viber', 'e4eaafba38e45bebae34aeab4d424dfa': 'handler-home', 'f416de4cf952834c264a0259303982c4': 'login',
  '97307ad1fd1c13932a0dae02fe0ed742': 'welcome', '0cca7a6a84db3f04b594b9214696839b': 'tour-step', '448702914e44570346705f24872989c6': 'phone-home',
  '4464803e8f5c2dae6afca6eb72e56f86': 'dispatch-board', '72ebd591c898545c5a4214c730cbfc3f': 'dispatch-ask', 'f4ec111ef30cc2be4e3cd56dce7e8a61': 'my-job-phone',
  'd023e28c6526540bda43bf845bd29d4b': 'my-sheet-phone', 'a578dc6ac5e83460f12b3d6fdf0b08f2': 'my-thanks-phone' };
const ICON = {
  Globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  Chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  Book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  Home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  CheckCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
};
// Placeholders the deck still carries: a video shows neutral words instead.
const FIX = [[/Go to <b style="color:#1D1D1F">\[portal address\]<\/b> and sign in/g, 'Open <b style="color:#1D1D1F">Philindo One</b> and sign in'], [/Philindo One · \[portal address\]/g, 'Philindo One · Team launch, 5 October 2026'],
  [/Starting \[start date\]/g, 'From launch day']];
const ids = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const manifest = {};
for (const id of ids) {
  let html = fs.readFileSync(SL + id + '.html', 'utf8').replace(/<aside>[\s\S]*?<\/aside>/g, '');
  html = html.replace(/\/_blob\/([0-9a-f]{32})/g, (m, k) => `file://${SHOTS}${BLOB[k]}.png`);
  html = html.replace(/<x-icon name="(\w+)" style="([^"]*)"><\/x-icon>/g, (m, n, st) =>
    `<svg viewBox="0 0 24 24" style="${st};fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none">${ICON[n]}</svg>`);
  for (const [a, b] of FIX) html = html.replace(a, b);
  if (/\[[a-z ]+\]/.test(html)) console.log('PLACEHOLDER LEFT in', id, html.match(/\[[a-z ]+\]/g));
  fs.writeFileSync(S + 'video/slide.html', `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Inter'; src: url('file://${font}') format('woff2'); font-weight: 100 900; }
    * { box-sizing: border-box; margin: 0; } html, body { margin: 0; background: transparent; }
    section { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
    section > :not([style*="position:absolute"]) { position: relative; }
    /* gradient words paint only inside their line box: give tails (g, y, p) room without moving anything */
    [style*="background-clip:text"] { padding-bottom: 0.12em; margin-bottom: -0.12em; }
    .lv-hide * { visibility: hidden; } .lv-hide .lv-show, .lv-hide .lv-show * { visibility: visible; } .lv-hide .lv-show.lv-shell > * , .lv-hide .lv-show.lv-shell > * * { visibility: hidden; }
  </style></head><body>${html}</body></html>`);
  await page.goto('file://' + S + 'video/slide.html', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}${id}__full.png` });
  const info = await page.evaluate(() => {
    const sec = document.querySelector('section');
    const green = /135deg/.test(sec.getAttribute('style'));
    const isGlow = (e) => e.parentElement === sec && /width:1920px;height:1080px/.test(e.getAttribute('style') || '') && !e.querySelector('img');
    const plain = (e) => { const c = getComputedStyle(e); return (c.backgroundColor === 'rgba(0, 0, 0, 0)' || c.backgroundColor === 'transparent') && c.backgroundImage === 'none'
      && c.boxShadow === 'none' && parseFloat(c.borderTopWidth) === 0 && !e.matches('img,svg,h1,h2,h3,p'); };
    const hasText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const leaves = [];
    const walk = (e, d) => {
      const kids = [...e.children].filter((k) => !isGlow(k) && k.tagName !== 'ASIDE' && k.getBoundingClientRect().width > 0);
      const empty = plain(e) && !hasText(e) && !e.querySelector('img,svg,p,h1,h2,h3,b,span') && !e.innerText.trim();
      if (e !== sec && empty) return;
      if (e !== sec && !plain(e) && kids.length >= 4 && !e.querySelector(':scope > img') && d <= 3) { e.setAttribute('data-shell', '1'); leaves.push(e); for (const k of kids) leaves.push(k); return; }
      if (e !== sec && (!plain(e) || hasText(e) || kids.length < 2 || d > 3)) { leaves.push(e); return; }
      for (const k of kids) walk(k, d + 1);
    };
    walk(sec, 0);
    return { green, leaves: leaves.map((e, i) => { e.setAttribute('data-lv', i); const shell = e.hasAttribute('data-shell'); const b = e.getBoundingClientRect(); const c = getComputedStyle(e);
      return { i, x: b.x, y: b.y, w: b.width, h: b.height, shot: !!e.querySelector('img') && b.width > 400, logo: e.tagName === 'IMG' || (!!e.querySelector('img') && b.width <= 400),
        shadow: c.boxShadow !== 'none', shell, parent: e.parentElement.hasAttribute('data-shell') ? +e.parentElement.getAttribute('data-lv') : null, tag: e.tagName, text: (e.innerText || '').slice(0, 40).replace(/\s+/g, ' ') }; }) };
  });
  const layers = [];
  await page.evaluate(() => { document.querySelector('section').classList.add('lv-hide'); });
  await page.evaluate(() => { const s = document.querySelector('section'); s.style.background = 'transparent'; });
  for (const L of info.leaves) {
    const m = L.shadow ? 130 : L.parent !== null ? 4 : 24;
    const x0 = Math.max(0, Math.floor(L.x - m)), y0 = Math.max(0, Math.floor(L.y - m));
    const x1 = Math.min(1920, Math.ceil(L.x + L.w + m)), y1 = Math.min(1080, Math.ceil(L.y + L.h + m));
    if (x1 - x0 < 2 || y1 - y0 < 2) continue;
    await page.evaluate((i) => { document.querySelectorAll('.lv-show').forEach((e) => e.classList.remove('lv-show', 'lv-shell')); const el = document.querySelector(`[data-lv="${i}"]`); el.classList.add('lv-show'); if (el.hasAttribute('data-shell')) el.classList.add('lv-shell'); }, L.i);
    const file = `${id}__${String(L.i).padStart(2, '0')}.png`;
    await page.screenshot({ path: OUT + file, omitBackground: true, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
    layers.push({ file, x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind: L.shell ? 'shell' : L.parent !== null ? 'row' : L.shot ? 'shot' : L.logo ? 'logo' : 'text', tag: L.tag, text: L.text });
  }
  manifest[id] = { green: info.green, layers };
  console.log(id.padEnd(13), info.green ? 'green' : 'light', layers.map((l) => `${l.kind[0]}:${l.text.slice(0, 18)}`).join(' | '));
}
fs.writeFileSync(OUT + 'manifest.json', JSON.stringify(manifest, null, 1));
await browser.close();
