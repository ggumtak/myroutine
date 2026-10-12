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
  await sheet.getByRole('button', { name: '가장 높은 음 반음 올리기', exact: true }).click();
  check(await sheet.locator('.sc-top').first().locator('.sc-top-n').innerText() === startBefore, 'changing ceiling does not change the start');
  await sheet.locator('.sc-play').click();
  await page.waitForFunction(() => document.querySelector('.sheet.open .sc-seq > .cur'));
  const epoch = await page.evaluate(() => __sdTest.Synth.seq);
  await sheet.getByRole('button', { name: '가장 높은 음 반음 올리기', exact: true }).click();
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
  {
    /* a 1½-octave exercise at phone width: the whole round is on screen and the view holds still while it plays */
    await sheet.locator('.sc-play').click();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 360, height: 780 });
    await page.evaluate(() => {
      const t = __sdTest;
      t.S.settings.scale = t.normSettings({ scale: { pat: 'b01', bpm: 130, tempoVersion: 2, root: 48, top: 72, chord: false, auto: false } }).scale;
      t.openScaleTrainer();
    });
    await visible(page, '.sheet.open .sc-play');
    const sh = page.locator('.sheet.open');
    await sh.locator('.sc-play').click();
    await page.waitForFunction(() => document.querySelectorAll('.sheet.open .sc-seq > span')[1]?.classList.contains('cur'));
    await page.waitForTimeout(450);
    const view = () => sh.locator('.kb-wrap').evaluate(w => {
      const b = w.getBoundingClientRect(), z = Array.from(w.querySelectorAll('.zone'));
      return { left: Math.round(w.scrollLeft), zone: z.length, fits: z.every(k => { const a = k.getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1; }) };
    });
    const first = await view(), samples = [];
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(250); samples.push(await view()); }
    check(first.zone >= 10 && first.fits, 'the whole round of a 1½-octave exercise is on screen at 360px');
    check(samples.every(v => v.left === first.left), 'the keyboard holds still while a round plays');
    await sh.locator('.sc-play').click();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const t = __sdTest;
      t.S.settings.scale = t.normSettings({ scale: { pat: 'five', bpm: 130, tempoVersion: 2, root: 49, top: 63, chord: false } }).scale;
      t.openScaleTrainer();
    });
    await visible(page, '.sheet.open .sc-play');
    await sheet.locator('.sc-play').click(); /* playing again, as the checks below expect */
    await page.waitForFunction(() => document.querySelector('.sheet.open .sc-seq > .cur'));
  }
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
  // 가사 노트: pure helpers first, then the notebook UI at 390 px and 320 px.
  const lyUnit = await page.evaluate(() => {
    const LN = window.LyricNote, r = {};
    r.techs = LN.TECHS.length === 15 && LN.TECHS[0].id === 'breath' && LN.TECHS[1].id === 'h' && new Set(LN.TECHS.map(t => t.id)).size === 15 && !LN.TECHS.some(t => ['airy', 'fry', 'run', 'nasal', 'rasp', 'cry', 'glottal', 'mix'].includes(t.id) || /·올려|·폴/.test(t.name));
    r.lines = JSON.stringify(LN.lines('가나  \r\n\r\n\r\n\r\n다라\n마\n\n')) === JSON.stringify(['가나', '', '다라', '마']) && LN.lines(Array(300).fill('가').join('\n')).length === 200 && LN.lines(null).length === 0;
    r.garbage = [null, undefined, 5, 'x', [], { text: 5 }, { text: '가나', m: 7, p: [], n: 'x', heard: 'y' }, { text: '가나', m: { '0.9': ['h'], '5.0': ['h'], 'a.b': ['h'], '0.0': ['nope', 7] }, p: { '0.1': 9 }, n: { '3': 'x' }, heard: ['zzz'] }]
      .every(g => { const n = LN.norm(g); return typeof n.text === 'string' && !Object.keys(n.m).length && !Object.keys(n.p).length && !Object.keys(n.n).length && !n.heard.length; });
    const ok = LN.norm({ text: '가나 다\n라', m: { '0.0': ['vib', 'h', 'h'], '0.2': [], '1.0': ['breath'], '0.3': ['h'] }, p: { '0.1': '에에에에에에', '0.0': '가' }, n: { '1': '  메모  ' }, heard: ['mix', 'breath', 'x'], at: 12.7 });
    r.norm = JSON.stringify(ok.m) === JSON.stringify({ '0.0': ['h', 'vib'], '1.0': ['breath'], '0.3': ['h'] }) && ok.p['0.1'] === '에에에에' && !ok.p['0.0'] && ok.n['1'] === '메모' && ok.heard.join() === 'breath' && ok.at === 12 && ok.own.length === 0;
    r.idem = JSON.stringify(LN.norm(ok)) === JSON.stringify(ok);
    const ly = { text: '사랑해요\n오늘도\n안녕', m: { '0.0': ['h'], '1.1': ['breath'], '2.0': ['vib'] }, p: { '0.2': '애' }, n: { '1': '숨' }, heard: ['h'], at: 5 };
    const a = LN.remap(ly.text, '새 줄\n' + ly.text, ly);
    r.insert = a.m['1.0'].join() === 'h' && a.m['2.1'].join() === 'breath' && a.m['3.0'].join() === 'vib' && a.p['1.2'] === '애' && a.n['2'] === '숨' && a.heard.join() === 'h' && a.at === 5;
    const b = LN.remap(ly.text, '사랑해요\n오날은\n안녕', ly);
    r.edit = b.m['0.0'].join() === 'h' && b.m['1.1'] === undefined && b.n['1'] === '숨' && LN.count(b) === LN.count(ly) - 1;
    const c = LN.remap(ly.text, '랑해요\n오늘도', ly);
    r.del = !c.m['0.0'] && c.m['1.1'].join() === 'breath' && !c.m['2.0'] && c.text === '랑해요\n오늘도';
    r.junk = LN.remap(null, 7, null).text === '' && LN.remap('가', '', { m: 1 }).text === '' && LN.remap('가나', '가나', { text: '다라', m: { '0.0': ['h'] } }).m['0.0'].join() === 'h';
    r.nfc = LN.lines('각'.normalize('NFD'))[0] === '각';
    const col = LN.remap('qXbab', 'qab', { text: 'qXbab', m: { '0.2': ['h'], '0.4': ['vib'] } });
    r.collide = Object.keys(col.m).length === 1 && col.m['0.2'].join() === 'vib';
    r.rekey = LN.norm({ text: '가나', m: { '00.01': ['h'], '0.1': ['vib'] }, p: { '000.0': '아' } }).m['0.1'].join() === 'h,vib' && Object.keys(LN.norm({ text: '가나', m: { '00.01': ['h'] } }).m).join() === '0.1';
    r.emptyMemo = Object.keys(LN.norm({ text: '가\n\n나', n: { '1': 'x', '2': 'y' } }).n).join() === '2' && Object.keys(LN.remap('가\n나', '가\n\n\n\n\n다', { text: '가\n나', n: { '1': 'y' } }).n).length === 0;
    r.copy = LN.noteText(ly, '곡').includes("  └ H 어택: '사', 발음: 해→애");
    const old = LN.norm({ text: '가나', m: { '0.0': ['cry', 'h', 'airy'], '0.1': ['mix', 'constructor', '__proto__'] }, heard: ['cry', 'h'] });
    r.removedIds = JSON.stringify(old.m) === JSON.stringify({ '0.0': ['h', 'u:크라이', 'u:숨소리 섞기'], '0.1': ['u:믹스·두성'] }) && old.own.join() === '크라이,숨소리 섞기,믹스·두성' && old.heard.join() === 'h' && JSON.stringify(LN.norm(old)) === JSON.stringify(old);
    const own = LN.norm({ text: '사랑해', own: ['  울림  ', '울림', 'x'.repeat(20), 5, '', null, ['a']], m: { '0.0': ['u:울림', 'u:', 'u:   ', 'u:' + '가'.repeat(20)], '0.1': ['u:다른'] }, heard: ['u:울림', 'u:없음', 'u:'] });
    r.own = own.own.join() === '울림,xxxxxxxx,가가가가가가가가,다른' && own.m['0.0'].join() === 'u:울림,u:가가가가가가가가' && own.m['0.1'].join() === 'u:다른' && own.heard.join() === 'u:울림' && JSON.stringify(LN.norm(own)) === JSON.stringify(own) && LN.count(own) === 3;
    r.ownCap = LN.norm({ text: '가', own: Array.from({ length: 40 }, (_, i) => '기교' + i) }).own.length <= 20;
    const keep = LN.remap('사랑해\n오늘', '새 줄\n사랑해\n오늘', { text: '사랑해\n오늘', own: ['울림'], m: { '0.1': ['u:울림', 'h'] }, heard: ['u:울림'] });
    r.ownRemap = keep.own.join() === '울림' && keep.m['1.1'].join() === 'h,u:울림' && keep.heard.join() === 'u:울림';
    r.ownCopy = LN.noteText({ text: '사랑해', own: ['울림'], m: { '0.0': ['u:울림'], '0.1': ['u:울림', 'h'] } }).includes("  └ H 어택: '랑', 울림: '사랑'");
    return r;
  });
  for (const [name, ok] of Object.entries(lyUnit)) check(ok, 'LyricNote.' + name + ' behaves');
  await page.locator('#tab-sing').click();
  await page.locator('[data-fk="song"]').fill('가사테스트곡');
  await page.locator('[data-fk="song"]').press('Enter');
  await page.locator('.tab[data-tab="songs"]').click();
  await page.locator('[data-fk="seg-songs"]').click();
  await page.locator('[data-fk="song-가사테스트곡"]').click();
  await page.locator('[data-fk="ly-open"]').click();
  const ly = page.locator('.sheet.open[aria-label^="가사 노트"]');
  await ly.locator('textarea.ly-ta').waitFor({ state: 'visible' });
  check((await ly.innerText()).includes('내 계정에만'), 'lyric note asks for lyrics first');
  await ly.locator('textarea.ly-ta').fill('사랑해요 오늘도\n\n안녕 하늘아 의사');
  await ly.getByRole('button', { name: '노트에 띄우기' }).click();
  await ly.locator('.ly-syl').first().waitFor({ state: 'visible' });
  check(await ly.locator('.ly-syl').count() === 14 && await ly.locator('.ly-gap').count() === 1, 'pasted lyrics become syllables with a stanza gap');
  check(await ly.locator('[role="toolbar"] .ly-chip').count() === 15 + 1 && (await ly.locator('[data-fk="ly-add"]').innerText()).includes('직접 적기') && await ly.locator('[data-fk="ly-more"]').count() === 0, 'tool bar has 15 technique chips + the own-technique chip and no "more" chip');
  const lyText = await ly.innerText();
  check(!lyText.includes('숨소리 섞기') && !lyText.includes('올려 잡기') && !lyText.includes('폴') && lyText.includes('밴딩') && lyText.includes('음 떨어뜨리기'), 'technique names are plain (no 숨소리 섞기, 밴딩·올려 잡기, 폴)');
  check(await ly.locator('.ly-techs').evaluate(el => el.scrollWidth > el.clientWidth + 20 && getComputedStyle(el).overflowX === 'auto'), 'the technique row is one scrolling row');
  const lay = await ly.evaluate(el => { const q = s => el.querySelector(s).getBoundingClientRect(); return { paper: q('.ly-paper').top, tools: q('.ly-tools').top, head: q('.ly-head').bottom, body: q('.sheet-body').height, bar: q('.ly-tools').height }; });
  check(lay.paper < lay.tools && lay.paper - lay.head < 20 && lay.bar < 100, 'lyrics start right under the tabs; the tool bar sits below them and is slim');
  check(await ly.locator('.ly-desc').isHidden(), 'no tool description while 보기 is selected');
  await ly.locator('[data-fk="ly-tool-h"]').click();
  check(await ly.locator('[data-fk="ly-tool-h"]').getAttribute('aria-pressed') === 'true', 'selected tool is aria-pressed');
  check((await ly.locator('.ly-desc').innerText()).includes('H 어택'), 'a selected technique shows its one-line description');
  await ly.locator('.ly-syl[data-k="0.2"]').click();
  await ly.locator('[data-fk="ly-tool-breath"]').click();
  await ly.locator('.ly-syl[data-k="0.3"]').click();
  check(await ly.locator('.ly-syl[data-k="0.2"] .ly-mk').first().innerText() === 'H' && await ly.locator('.ly-syl[data-k="0.3"] .ly-br').count() === 1, 'marks are drawn on the syllables (breath after it)');
  const lyMeta = () => page.evaluate(() => { const m = __sdTest.S.settings.songs.find(x => x.k === '가사테스트곡'); return m && m.ly; });
  await page.waitForTimeout(600);
  const m1 = await lyMeta();
  check(m1 && m1.m['0.2'].join() === 'h' && m1.m['0.3'].join() === 'breath' && m1.at > 0, 'marks are saved in the song settings');
  check((await ly.locator('.ly-syl[data-k="0.2"]').getAttribute('aria-label')).includes('H 어택'), 'syllable label names its marks');
  await noOverflow(page, 'lyric notebook fits 390px');
  await ly.getByRole('button', { name: '발음', exact: true }).click();
  await ly.locator('.ly-syl[data-k="2.3"]').click();
  const pron = page.locator('.sheet.open').last();
  await pron.locator('input').waitFor({ state: 'visible' });
  check(await pron.locator('input').inputValue() === '하', 'pronunciation sheet starts from the written syllable');
  await pron.locator('input').fill('아');
  await pron.getByRole('button', { name: '저장', exact: true }).click();
  await ly.locator('.ly-pr').first().waitFor({ state: 'visible' });
  check(await ly.locator('.ly-syl[data-k="2.3"] .ly-pr').innerText() === '아', 'pronunciation override is shown above the syllable');
  await ly.getByRole('button', { name: '메모', exact: true }).click();
  await ly.locator('.ly-syl[data-k="2.0"]').click();
  const memoSheet = page.locator('.sheet.open').last();
  await memoSheet.locator('textarea').fill('여기서 숨 크게');
  await memoSheet.getByRole('button', { name: '저장', exact: true }).click();
  check((await ly.locator('.ly-memo').innerText()).includes('여기서 숨 크게'), 'line memo shows under the line');
  await ly.getByRole('button', { name: '보기', exact: true }).click();
  await ly.locator('.ly-syl[data-k="0.2"]').click();
  const view = page.locator('.sheet.open').last();
  check((await view.innerText()).includes('H 어택'), 'view tool lists the marks with descriptions');
  await view.getByRole('button', { name: 'H 어택 표시 지우기' }).click();
  await view.locator('.btn', { hasText: '닫기' }).click();
  check(await ly.locator('.ly-syl[data-k="0.2"] .ly-mk').count() === 0, 'a mark can be removed from the view sheet');
  await ly.locator('[data-fk="ly-tool-h"]').click();
  await ly.locator('.ly-syl[data-k="0.2"]').click();
  await ly.getByRole('button', { name: '지우개', exact: true }).click();
  await ly.locator('.ly-syl[data-k="0.3"]').click();
  check(await ly.locator('.ly-br').count() === 0, 'eraser clears the marks of a syllable');
  await ly.locator('[data-fk="ly-tool-breath"]').click();
  await ly.locator('.ly-syl[data-k="0.3"]').click();
  await ly.locator('[data-fk="ly-tool-h"]').click();
  await ly.locator('.ly-syl[data-k="2.0"]').click();
  await ly.locator('[data-fk="ly-tab-check"]').click();
  await ly.locator('.ly-row').first().waitFor({ state: 'visible' });
  check(await ly.locator('.ly-row').count() === 15 && await ly.locator('.ly-rest .ly-row').count() === 13 && (await ly.locator('.ly-prog-t').innerText()).includes('‘숨’'), 'check tab lists the 2 used techniques first, 13 more folded, and points at the first one');
  check((await ly.locator('.ly-prog-n').innerText()).includes('0 / 2') && (await ly.locator('.ly-rest').evaluate(e => e.open)) === false, 'progress counts only the techniques this song uses; the rest are folded');
  check((await ly.locator('[data-fk="ly-pick-h"]').innerText()).includes('2곳'), 'each row counts its marks in this song');
  await ly.locator('[data-fk="ly-heard-breath"]').check();
  check((await ly.locator('.ly-prog-n').innerText()).includes('1 / 2') && (await ly.locator('.ly-prog-t').innerText()).includes('‘H 어택’'), 'ticking a technique moves the progress on to the next one');
  await noOverflow(page, 'listen-and-check tab fits 390px');
  await page.waitForTimeout(600);
  check((await lyMeta()).heard.join() === 'breath', 'heard techniques are saved');
  await ly.locator('[data-fk="ly-pick-h"]').click();
  check(await ly.locator('[data-fk="ly-tool-h"]').getAttribute('aria-pressed') === 'true', 'tapping a technique name returns to the notebook with that tool');
  await ly.getByRole('button', { name: '가사 고치기' }).click();
  await ly.locator('textarea.ly-ta').fill('새로 넣은 첫 줄\n사랑해요 오늘도\n\n안녕 하늘아 의사');
  await ly.getByRole('button', { name: '저장', exact: true }).click();
  await ly.locator('.ly-syl').first().waitFor({ state: 'visible' });
  const m2 = await lyMeta();
  check(m2.m['1.3'].join() === 'breath' && m2.m['3.0'].join() === 'h' && m2.p['3.3'] === '아' && m2.n['3'] === '여기서 숨 크게', 'editing the lyrics moves marks with their lines');
  check(await ly.locator('.ly-syl[data-k="1.3"] .ly-br').count() === 1, 'the moved mark is drawn on its new line');
  // own techniques: add, mark, listen-check, copy, remove
  await ly.locator('[data-fk="ly-add"]').click();
  const addSheet = page.locator('.sheet.open').last();
  await addSheet.locator('input').fill('  크라이  ');
  await addSheet.getByRole('button', { name: '추가', exact: true }).click();
  await ly.locator('[data-fk="ly-tool-u:크라이"]').waitFor({ state: 'visible' });
  check(await ly.locator('[data-fk="ly-tool-u:크라이"]').getAttribute('aria-pressed') === 'true' && (await ly.locator('[data-fk="ly-tool-u:크라이"]').innerText()).includes('크라'), 'a new own technique becomes a selected tool chip (symbol = first 2 characters)');
  await ly.locator('[data-fk="ly-add"]').click();
  await page.locator('.sheet.open').last().locator('input').fill('크라이');
  await page.locator('.sheet.open').last().getByRole('button', { name: '추가', exact: true }).click();
  check((await page.locator('#toast').innerText()).includes('이미 있는') && await ly.locator('[role="toolbar"] .ly-own').count() === 1, 'a duplicate own technique is refused');
  await page.locator('.sheet.open').last().getByRole('button', { name: '취소', exact: true }).click();
  await ly.locator('.ly-syl[data-k="1.0"]').click();
  await ly.locator('.ly-syl[data-k="1.1"]').click();
  check(await ly.locator('.ly-syl[data-k="1.0"] .ly-mk').first().innerText() === '크라' && (await ly.locator('.ly-syl[data-k="1.0"]').getAttribute('aria-label')).includes('크라이'), 'own marks are drawn above the syllable and named in its label');
  await page.waitForTimeout(600);
  const m4 = await lyMeta();
  check(m4.own.join() === '크라이' && m4.m['1.0'].join() === 'u:크라이' && m4.m['1.1'].join() === 'u:크라이', 'own technique and its marks are saved per song');
  check(await page.evaluate(() => { const m = __sdTest.S.settings.songs.find(x => x.k === '가사테스트곡'); return window.LyricNote.noteText(m.ly).includes("크라이: '사랑'"); }), 'own marks are in the copy text');
  await ly.locator('[data-fk="ly-tab-check"]').click();
  await ly.locator('.ly-row').first().waitFor({ state: 'visible' });
  check((await ly.locator('[data-fk="ly-pick-u:크라이"]').innerText()).includes('2곳') && await ly.locator('.ly-row').count() === 16, 'own techniques are listed in 들으며 체크 with their counts');
  await ly.locator('[data-fk="ly-heard-u:크라이"]').check();
  await page.waitForTimeout(600);
  check((await lyMeta()).heard.includes('u:크라이'), 'an own technique can be checked as heard');
  await ly.locator('[data-fk="ly-pick-u:크라이"]').click();
  await ly.locator('[data-fk="ly-tool-u:크라이"]').waitFor({ state: 'visible' });
  await ly.locator('[data-fk="ly-tool-u:크라이"]').hover();
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await page.waitForTimeout(450);
  const rmSheet = page.locator('.sheet.open').last();
  check((await rmSheet.innerText()).includes('2곳도 함께 지워져요'), 'long-pressing an own chip asks whether to remove it (and its marks)');
  await rmSheet.getByRole('button', { name: '취소', exact: true }).click();
  await ly.getByRole('button', { name: '보기', exact: true }).click();
  await ly.locator('.ly-syl[data-k="1.0"]').click();
  const ownView = page.locator('.sheet.open').last();
  check((await ownView.innerText()).includes('크라이'), 'the view sheet lists an own mark');
  await ownView.getByRole('button', { name: '크라이 기교 삭제' }).click();
  await page.locator('.sheet.open').last().getByRole('button', { name: '없애기', exact: true }).click();
  await ly.locator('[data-fk="ly-tool-u:크라이"]').waitFor({ state: 'detached' });
  await page.waitForTimeout(600);
  const m5 = await lyMeta();
  check(m5.own.length === 0 && !m5.m['1.0'] && !m5.m['1.1'] && !m5.heard.includes('u:크라이') && await ly.locator('.ly-syl[data-k="1.0"] .ly-mk').count() === 0, 'removing an own technique clears its chip, marks and heard flag');
  await page.setViewportSize({ width: 320, height: 640 });
  await noOverflow(page, 'lyric notebook fits 320px');
  check(await ly.locator('.ly-techs').evaluate(el => el.scrollWidth > el.clientWidth + 20), 'the technique chips scroll sideways inside their own row at 320px');
  const lay320 = await ly.evaluate(el => { const q = s => el.querySelector(s).getBoundingClientRect(); return { paper: q('.ly-paper').top, tools: q('.ly-tools').top, body: q('.sheet-body').height }; });
  check(lay320.paper < lay320.tools && lay320.body >= 640 * 0.5, 'at 320×640 the lyrics area still gets at least half the screen');
  await ly.locator('[data-fk="ly-tool-fall"]').click();
  const lay320b = await ly.evaluate(el => el.querySelector('.sheet-body').getBoundingClientRect().height);
  check(lay320b >= 640 * 0.5, 'with a technique description showing, the lyrics still get half of a 320×640 screen');
  await ly.locator('[data-fk="ly-tool-view"]').click();
  await page.screenshot({ path: path.join(screenshots, 'lyrics-320.png') });
  await ly.getByRole('button', { name: '가사 고치기' }).click();
  await ly.locator('textarea.ly-ta').fill((await lyMeta()).text + '\n' + '가나다라마바사아자차'.repeat(4));
  await ly.getByRole('button', { name: '저장', exact: true }).click();
  await ly.locator('.ly-syl[data-k="4.39"]').waitFor({ state: 'attached' });
  await noOverflow(page, 'a 40-character line without spaces fits 320px');
  check(await ly.locator('.ly-syl[tabindex="0"]').count() === 4, 'one syllable per line is a tab stop');
  await ly.locator('.ly-syl[data-k="1.0"]').focus();
  await page.keyboard.press('ArrowRight');
  const arrowRight = await page.evaluate(() => document.activeElement.dataset.k);
  await page.keyboard.press('ArrowDown');
  check(arrowRight === '1.1' && await page.evaluate(() => document.activeElement.dataset.k) === '3.1', 'arrow keys move between syllables and lines');
  await page.evaluate(() => { const m = __sdTest.S.settings.songs.find(x => x.k === '가사테스트곡'); const c = JSON.parse(JSON.stringify(m.ly)); c.m['0.0'] = ['vib']; c.at = Date.now() + 1000; m.ly = c; });
  await ly.locator('[data-fk="ly-tool-h"]').click();
  await ly.locator('.ly-syl[data-k="1.0"]').click();
  const m3 = await lyMeta();
  check(m3.m['0.0'].join() === 'vib' && m3.m['1.0'].join() === 'h' && await ly.locator('.ly-syl[data-k="0.0"] .ly-mk').count() === 1, 'a note changed by cloud sync is picked up before the next tap');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(screenshots, 'lyrics.png') });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.screenshot({ path: path.join(screenshots, 'lyrics-light.png') });
  await page.locator('[data-fk="ly-tab-check"]').click();
  await page.screenshot({ path: path.join(screenshots, 'lyrics-check.png') });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await ly.getByRole('button', { name: '복사' }).click();
  await visible(page, '#toast.show');
  await page.keyboard.press('Escape');
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
