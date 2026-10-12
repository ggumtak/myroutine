/* 가사 노트 entry point on the home screen: quick action, picker, new song without a practice record. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../www');
const screenshots = process.env.SCREENSHOT_DIR || path.join(__dirname, 'screenshots');
fs.mkdirSync(screenshots, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.wav': 'audio/wav', '.flac': 'audio/flac' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404); res.end(); }
});
let browser;
const errors = [];
let checks = 0;
function check(ok, label) { assert.ok(ok, label); checks++; console.log('PASS ' + label); }
async function visible(page, selector) { await page.locator(selector).waitFor({ state: 'visible' }); }
async function noOverflow(page, label) { check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label); }
async function boot(page, url) { await page.goto(url); await visible(page, '[data-fk="quick-scale"]'); await page.evaluate(() => document.fonts.ready); }
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const custom = process.env.CHROMIUM_EXECUTABLE_PATH;
  browser = await chromium.launch({ headless: true, args: custom ? ['--no-sandbox', '--no-zygote', '--single-process', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [], ...(custom ? { executablePath: custom } : {}) });
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(url)) errors.push(`${r.status()} ${r.url()}`); });
  await boot(page, url);

  for (const [w, hgt] of [[320, 640], [360, 780], [390, 844]]) {
    await page.setViewportSize({ width: w, height: hgt });
    await visible(page, '[data-fk="quick-lyrics"]');
    await noOverflow(page, `${w}px home has no horizontal overflow`);
    const boxes = await page.locator('.quick-action').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width, h: r.height, over: e.scrollWidth > e.clientWidth + 1 }; }));
    check(boxes.length === 4 && boxes.every(b => b.w >= 44 && b.h >= 44 && b.l >= 0 && b.r <= w && !b.over), `${w}px: four quick actions fit with 44px targets`);
    await page.screenshot({ path: path.join(screenshots, `lyric-home-${w}.png`) });
  }

  // an already practiced song
  await page.evaluate(() => { const t = __sdTest; const d = Object.keys(t.S.days)[0] || new Date().toISOString().slice(0, 10); const e = t.S.days[d] || (t.S.days[d] = t.normDay({ date: d })); e.songs.push({ id: 'sx1', title: '연습한노래', artist: '가수A', tone: '', note: '' }); t.S.settings.updatedAt = Date.now(); });
  const dayRecords = () => page.evaluate(() => JSON.stringify(Object.values(__sdTest.S.days).map(d => d.songs.map(s => s.title))));
  const before = await dayRecords();

  await page.setViewportSize({ width: 360, height: 780 });
  await page.locator('[data-fk="quick-lyrics"]').click();
  const sheet = page.locator('.sheet.open[aria-label="가사 노트"]');
  await sheet.waitFor({ state: 'visible' });
  check((await sheet.innerText()).includes('새 노래로 시작'), 'picker opens with the new-song start');
  check((await sheet.innerText()).includes('부른 노래') && await sheet.locator('[data-fk="lyp-연습한노래"]').count() === 1, 'practiced song is listed under 부른 노래');
  await page.screenshot({ path: path.join(screenshots, 'lyric-picker-360.png') });
  await page.setViewportSize({ width: 320, height: 640 });
  await noOverflow(page, 'picker fits 320px');
  await page.screenshot({ path: path.join(screenshots, 'lyric-picker-320.png') });

  await sheet.locator('[data-fk="ly-new"]').fill('새로운 노래');
  await sheet.locator('[data-fk="ly-new"]').press('Enter');
  const note = page.locator('.sheet.open[aria-label^="가사 노트"]:has(textarea.ly-ta)');
  await note.locator('textarea.ly-ta').waitFor({ state: 'visible' });
  const meta = await page.evaluate(() => { const m = __sdTest.S.settings.songs.find(x => x.k === '새로운 노래'); return m && { title: m.title, ly: !!(m.ly && m.ly.text) }; });
  check(meta && meta.title === '새로운 노래' && !meta.ly, 'typed title creates a song meta with its title');
  check(await dayRecords() === before, 'no practice day received the new song');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.evaluate(() => { const m = __sdTest.S.settings.songs.find(x => x.k === '새로운 노래'); m.ly = { text: '사랑해요 오늘도', m: { '0.0': ['vib'], '0.1': ['h'] }, p: {}, n: {}, heard: [], at: Date.now() }; });
  await page.locator('[data-fk="quick-lyrics"]').click();
  const sheet2 = page.locator('.sheet.open[aria-label="가사 노트"]');
  await sheet2.waitFor({ state: 'visible' });
  const mineRow = sheet2.locator('[data-fk="lyp-새로운 노래"]');
  check(await mineRow.count() === 1 && (await mineRow.innerText()).includes('표시 2개'), 'note with lyrics appears under 내 가사 노트 with its mark count');
  check(await sheet2.locator('.ly-pick-row').evaluateAll(rs => rs[0].dataset.fk === 'lyp-새로운 노래'), 'my notes come first');
  await page.screenshot({ path: path.join(screenshots, 'lyric-picker-notes-320.png') });
  await mineRow.click();
  await page.locator('.sheet.open[aria-label^="가사 노트"] .ly-syl').first().waitFor({ state: 'visible' });
  check(true, 'tapping a note row opens it');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // a practiced song opens a note without touching its record
  await page.locator('[data-fk="quick-lyrics"]').click();
  await page.locator('.sheet.open[aria-label="가사 노트"] [data-fk="lyp-연습한노래"]').click();
  await page.locator('.sheet.open[aria-label^="가사 노트"] textarea.ly-ta').waitFor({ state: 'visible' });
  check(await dayRecords() === before, 'opening a practiced song keeps its records unchanged');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // songs/library views survive a note-only song
  await page.locator('.tab[data-tab="songs"]').click();
  await page.locator('[data-fk="seg-songs"]').click();
  await page.waitForTimeout(200);
  check((await page.locator('#view').innerText()).includes('연습한노래'), 'song list still renders with a note-only song around');
  check(errors.length === 0, 'no page errors or missing local assets: ' + errors.join('; '));
  console.log(`\n${checks} checks passed. Screenshots: ${screenshots}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
