// Saves every <section class="frame"> of a page as a JPG in ./out (1080 wide, ready to post).
// Use: node render.mjs samples.html      (needs Node and Playwright; set CHROMIUM to a Chromium path if Playwright has none)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const page_ = new URL(process.argv[2] ?? 'samples.html', `file://${process.cwd()}/`);
const out = new URL('out/', `file://${process.cwd()}/`).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 2000 } });
await page.goto(page_.href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
for (const id of await page.evaluate(() => [...document.querySelectorAll('section.frame')].map((s) => s.id))) {
  await page.locator('#' + id).screenshot({ path: `${out}${id}.jpg`, type: 'jpeg', quality: 92 });
  console.log('saved', `out/${id}.jpg`);
}
await browser.close();
