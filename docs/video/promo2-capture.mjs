// Captures the three app screens for promo v2 from a local copy of the app running on the simulation database (never the live one).
// Sign-in passwords for the simulation accounts come from SIM_PW / SIM_ADMIN_PW; they are not kept here.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = new URL('../promo/v2/', import.meta.url).pathname, B = 'http://localhost:3000';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const meta = {};
async function signIn(email, pw) {
  const ctx = await browser.newContext({ viewport: { width: 1504, height: 904 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.goto(B + '/login'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', pw); await page.click('button[type=submit]');
  await Promise.race([page.waitForURL(/\/login\/code/, { timeout: 20000 }).catch(() => {}), page.waitForSelector('.o-welcome', { timeout: 20000 }).catch(() => {})]);
  if (page.url().includes('/login/code')) { await page.waitForSelector('.o-note b'); await page.fill('input[name=code]', (await page.locator('.o-note b').textContent()).trim()); await page.click('button[type=submit]'); }
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 40000 }); await page.waitForTimeout(4000);
  await page.evaluate(() => { document.querySelectorAll('.o-test, .o-testbar').forEach((e) => e.remove()); });
  return { ctx, page };
}
const clean = (p) => p.evaluate(() => { document.querySelectorAll('.o-test, .o-testbar, nextjs-portal, [data-tour-overlay]').forEach((e) => e.remove()); });
// 1. Cherry asks for a cash advance
{
  const { ctx, page } = await signIn('jasmin@philindo.test', process.env.SIM_PW);
  await page.goto(B + '/cash-advances/new', { waitUntil: 'networkidle' }); await page.waitForTimeout(800); await clean(page);
  await page.screenshot({ path: OUT + 'ca-empty.png', fullPage: true });
  const jo = page.locator('input[placeholder="IMP0926-1300"]');
  await jo.fill('IMP0926-1262'); await jo.blur(); await page.waitForTimeout(1500);
  const sel = page.locator('main select');
  await sel.nth(0).selectOption({ index: 1 }); await sel.nth(1).selectOption({ index: 1 });
  const money = page.locator('main input[placeholder="0.00"]');
  const vals = ['18,500', '12,350', '', '', '9,000', '3,500'];
  for (let i = 0; i < vals.length; i++) if (vals[i]) await money.nth(i).fill(vals[i]);
  await page.locator('main textarea').fill('Please release before Tuesday — vessel arrives early.');
  await page.waitForTimeout(500); await clean(page);
  await page.screenshot({ path: OUT + 'ca-filled.png', fullPage: true });
  const btn = page.locator('main button', { hasText: 'Send request' });
  const box = await btn.boundingBox(); const sy = await page.evaluate(() => window.scrollY);
  meta.send = { x: box.x, y: box.y + sy, w: box.width, h: box.height, label: await btn.innerText() };
  meta.filledH = await page.evaluate(() => document.documentElement.scrollHeight);
  await btn.click(); await page.waitForURL(/\/cash-advances\/IMP/, { timeout: 20000 }); await page.waitForTimeout(700); await clean(page);
  await page.screenshot({ path: OUT + 'ca-sent.png' });
  meta.sentUrl = page.url();
  await ctx.close();
}
// 2. Finance sees it
{
  const { ctx, page } = await signIn('vicky@philindo.test', process.env.SIM_PW);
  await clean(page); await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + 'finance-desk.png', fullPage: true });
  const row = page.locator('tr', { hasText: 'IMP0926-1262' }).first();
  if (await row.count()) { const b = await row.boundingBox(); const sy = await page.evaluate(() => window.scrollY); meta.financeRow = { x: b.x, y: b.y + sy, w: b.width, h: b.height, text: (await row.innerText()).replace(/\s+/g, ' ') }; }
  meta.financeH = await page.evaluate(() => document.documentElement.scrollHeight);
  meta.financeUrl = page.url();
  await ctx.close();
}
// 3. Pending shipments by account handler
{
  const { ctx, page } = await signIn('oliver@philindo.test', process.env.SIM_ADMIN_PW);
  await page.goto(B + '/dashboard/pending', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000); await clean(page);
  await page.screenshot({ path: OUT + 'pending.png', fullPage: true });
  meta.pendingH = await page.evaluate(() => document.documentElement.scrollHeight);
  await ctx.close();
}
fs.writeFileSync(OUT + 'meta.json', JSON.stringify(meta, null, 1));
console.log(JSON.stringify(meta));
await browser.close();
