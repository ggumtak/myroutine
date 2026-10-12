/* Browser smoke checks for navigation, the diary shortcuts, persisted drafts and responsive layouts.
 * npm ci && npx playwright install chromium && npm test
 * Optionally: CHROMIUM_EXECUTABLE_PATH=/path/to/chromium SCREENSHOT_DIR=/path npm test
 */
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
  browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', ...(custom ? ['--no-sandbox', '--no-zygote', '--single-process', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])], ...(custom ? { executablePath: custom } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', permissions: ['microphone'] });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(url)) errors.push(`${r.status()} ${r.url()}`); });
  await boot(page, url);
  check(await page.locator('#tb-title').innerText() === '소리일기', 'new brand is visible');
  await noOverflow(page, '390px home has no horizontal overflow');
  await page.screenshot({ path: path.join(screenshots, 'home.png') });
  await page.locator('[data-fk="goal"]').fill('오늘은 턱을 편하게');
  await page.locator('#tab-practice').click();
  await page.locator('#tab-before').click();
  check(await page.locator('[data-fk="goal"]').inputValue() === '오늘은 턱을 편하게', 'goal survives part switches');
  await page.locator('#tab-before').focus();
  await page.keyboard.press('ArrowRight');
  check(await page.locator('#tab-practice').getAttribute('aria-selected') === 'true', 'part tabs support arrow keys');
  await page.locator('[data-fk="next-sing"]').click();
  await visible(page, '#g-sing');
  await page.locator('[data-fk="prev-practice"]').click();
  await visible(page, '#g-practice');
  check(true, 'both previous and next navigate parts');
  await page.locator('[data-fk="quick-scale"]').click();
  await visible(page, '.sheet.open');
  check((await page.locator('.sheet.open').innerText()).includes('스케일'), 'scale shortcut opens the trainer');
  await page.keyboard.press('Escape');
  await page.locator('[data-fk="quick-record"]').click();
  await visible(page, '.sheet.open');
  check((await page.locator('.sheet.open').innerText()).includes('녹음'), 'record shortcut opens the recorder');
  await page.getByRole('button', { name: '녹음 시작', exact: true }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('[data-fk="quick-note"]').click();
  await visible(page, '#ta-memo');
  check(await page.locator('#ta-memo').evaluate(el => el === document.activeElement), 'one-line shortcut focuses the diary');
  await page.locator('#ta-memo').fill('후렴에서 힘을 덜 주니 편했다.');
  await page.locator('#ta-memo').blur();
  await page.waitForTimeout(800);
  await page.reload();
  await visible(page, '#ta-memo');
  check(await page.locator('#ta-memo').inputValue() === '후렴에서 힘을 덜 주니 편했다.', 'diary persists after reload');
  await page.locator('.tab[data-tab="songs"]').click();
  check(await page.locator('[data-fk="seg-journal"]').getAttribute('aria-pressed') === 'true', 'records opens on the diary first');
  check((await page.locator('.jlist').innerText()).includes('후렴에서 힘을 덜 주니 편했다.'), 'saved diary appears in records');
  await page.screenshot({ path: path.join(screenshots, 'journal.png') });
  for (const seg of ['songs', 'recs', 'range', 'journal']) {
    await page.locator(`[data-fk="seg-${seg}"]`).click();
    await noOverflow(page, 'records/' + seg + ' fits mobile');
  }
  for (const tab of ['calendar', 'feedback', 'today']) {
    await page.locator(`.tab[data-tab="${tab}"]`).click();
    await noOverflow(page, tab + ' fits mobile');
  }
  await page.locator('.tab[data-tab="today"]').focus();
  await page.keyboard.press('ArrowRight');
  check(await page.locator('.tab[data-tab="calendar"]').getAttribute('aria-selected') === 'true', 'main tabs support arrow keys');
  await page.locator('.tab[data-tab="today"]').click();
  await page.locator('[data-fk="tm-main"]').click();
  check(await page.locator('#tb-timer').isVisible(), 'timer starts and remains visible across the app');
  await page.locator('[data-fk="tm-rest"]').click();
  await page.locator('[data-fk="tm-water"]').click();
  check((await page.locator('[data-fk="tm-water"]').innerText()).includes('1잔'), 'rest and water remain functional');
  for (const width of [320, 360, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const part of ['before', 'practice', 'sing', 'after']) {
      await page.locator(`#tab-${part}`).click();
      await noOverflow(page, `${width}px ${part} fits`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.locator('#tab-sing').click();
  await page.screenshot({ path: path.join(screenshots, 'dark.png') });
  await noOverflow(page, 'dark theme fits');
  // Existing custom diary names and old storage keys remain readable after rebranding.
  await page.evaluate(async () => {
    const settings = await SD.Store.get('meta', 'settings');
    settings.title = '내 무대 준비';
    await SD.Store.put('meta', 'settings', settings);
  });
  await page.reload();
  await visible(page, '[data-fk="quick-scale"]');
  check(await page.locator('#tb-subtitle').innerText() === '내 무대 준비', 'custom diary names are preserved');
  await page.evaluate(async () => { __sdTest.S.mode = 'error'; await __sdTest.onAppResume(); });
  check(await page.evaluate(() => __sdTest.S.mode === 'ready'), 'resume retries a failed local boot');
  check(await page.evaluate(() => Object.values(__sdTest.S.days).some(d => d.memo.includes('후렴에서 힘을 덜 주니 편했다.'))), 'recovery preserves the diary');
  check(await page.evaluate(() => __sdTest.normSettings({ scale: { bpm: 100 } }).scale.bpm === 80), 'old normal tempo migrates to the requested 80 BPM');
  const seqs = await page.evaluate(() => [ScaleKit.roundSequence(48, 51), ScaleKit.roundSequence(48, 51, 'down'), ScaleKit.roundSequence(48, 52, 'updown', 50), ScaleKit.roundSequence(49, 53, 'updown', 51, true)]);
  check(JSON.stringify(seqs) === JSON.stringify([[48,49,50,51,50,49,48],[51,50,49,48],[50,51,52,51,50,49,48],[51,50,49]]), 'ascending, descending-only and live replans preserve semitone continuity');
  await page.evaluate(() => {
    const t = __sdTest;
    t.S.settings.scale = t.normSettings({ scale: { pat: 'five', bpm: 130, tempoVersion: 2, root: 48, top: 62, chord: false } }).scale;
    t.openScaleTrainer();
  });
  await visible(page, '.sheet.open .sc-play');
  const sheet = page.locator('.sheet.open');
  const topBefore = await sheet.locator('.sc-top').nth(1).locator('.sc-top-n').innerText();
  await sheet.locator('.sc-top').first().getByRole('button', { name: '시작 음 반음 올리기', exact: true }).click();
  check(await sheet.locator('.sc-seq > span').first().innerText() === '도#', 'solfa follows the actual transposed root');
  check(await sheet.locator('.sc-top').nth(1).locator('.sc-top-n').innerText() === topBefore, 'changing start does not change the ceiling');
  const startBefore = await sheet.locator('.sc-top').first().locator('.sc-top-n').innerText();
  await sheet.getByRole('button', { name: '꼭대기 음 반음 올리기', exact: true }).click();
  check(await sheet.locator('.sc-top').first().locator('.sc-top-n').innerText() === startBefore, 'changing ceiling does not change the start');
  await sheet.locator('.sc-play').click();
  await page.waitForFunction(() => document.querySelector('.sheet.open .sc-seq > .cur'));
  const epoch = await page.evaluate(() => __sdTest.Synth.seq);
  await sheet.getByRole('button', { name: '꼭대기 음 반음 올리기', exact: true }).click();
  await sheet.locator('.sc-top').first().getByRole('button', { name: '시작 음 반음 올리기', exact: true }).click();
  check(await page.evaluate(() => __sdTest.Synth.seq) === epoch, 'live start/ceiling edits do not interrupt or restart the current round');
  let visibleSteps = 0;
  const until = Date.now() + 2600;
  while (Date.now() < until) {
    check(await sheet.locator('.kb-wrap').evaluate(w => { const k = w.querySelector('.on'); if (!k) return true; const a = k.getBoundingClientRect(), b = w.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; }), 'playing key remains inside the horizontal keyboard viewport');
    visibleSteps++;
    await page.waitForTimeout(400);
  }
  check(visibleSteps > 3, 'multiple scale steps were observed');
  await sheet.locator('.sc-play').click();
  await sheet.locator('[data-fk="direction-down"]').click();
  await sheet.locator('.sc-play').click();
  await page.waitForFunction(() => document.querySelector('.sheet.open .sc-seq > .cur'));
  check((await sheet.locator('.sc-now').innerText()).includes('하행'), 'descending-only playback starts with a descending indicator');
  await sheet.locator('.sc-play').click();
  for (const size of [{width:320,height:460},{width:600,height:380}]) {
    await page.setViewportSize(size);
    await noOverflow(page, `scale supports a ${size.width}×${size.height} multiwindow viewport`);
    check(await sheet.locator('.sheet-body').evaluate(el => el.scrollHeight > el.clientHeight), 'short windows scroll the controls');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await sheet.screenshot({ path: path.join(screenshots, 'scale.png') });
  await page.keyboard.press('Escape');
  const audio = await page.evaluate(async () => {
    const { Sound, Synth, Piano } = __sdTest;
    const original = Sound.get, ctx = new OfflineAudioContext(2, 48000 * 5, 48000);
    Synth.stop(); Synth.master = null; Piano.clear();
    Sound.get = () => ctx;
    try {
      await Synth.play(60, [0,4,7,0], { bpm:80, chord:false });
      const rendered = await ctx.startRendering(), a = rendered.getChannelData(0), b = rendered.getChannelData(1);
      let peak = 0, stereo = 0, tail = 0, hold = 0;
      for (let i=0;i<a.length;i++) { peak = Math.max(peak, Math.abs(a[i]), Math.abs(b[i])); stereo += Math.abs(a[i]-b[i]); if (i>48000*2.9 && i<48000*3.1) hold += a[i]*a[i]+b[i]*b[i]; if (i>48000*3.6) tail += a[i]*a[i]+b[i]*b[i]; }
      return { peak, stereo, tail, hold, channels: rendered.numberOfChannels, rate: rendered.sampleRate, decoded: Piano.buf.size };
    } finally { Synth.stop(); Synth.master = null; Sound.get = original; Piano.clear(); }
  });
  check(audio.channels === 2 && audio.rate === 48000 && audio.stereo > 1 && audio.peak > .01 && audio.peak < 1, 'real 48kHz stereo grand piano renders without clipping');
  check(audio.hold > .001, 'the final note is held about 0.4 s past its written length');
  check(audio.tail < .00001, 'the final note ends quickly rather than ringing for seconds');
  check(audio.decoded <= 20, 'decoded sample memory is bounded');
  // Use a separate context for a genuine first-run empty state.
  const clean = await browser.newContext({ viewport: { width: 320, height: 740 }, timezoneId: 'Asia/Seoul', permissions: ['microphone'] });
  const empty = await clean.newPage();
  empty.on('pageerror', e => errors.push(e.message));
  await boot(empty, url);
  await empty.evaluate(async () => { await SD.Store.clear('days'); localStorage.clear(); });
  await empty.reload();
  await visible(empty, '[data-fk="quick-scale"]');
  await empty.locator('.tab[data-tab="songs"]').click();
  await empty.getByRole('button', { name: '첫 일기 쓰기' }).click();
  await visible(empty, '#ta-memo');
  check(true, 'empty diary offers a working write action');
  check(errors.length === 0, 'no page errors or missing local assets: ' + errors.join('; '));
  console.log(`\n${checks} checks passed. Screenshots: ${screenshots}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
