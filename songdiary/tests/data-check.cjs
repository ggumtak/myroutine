/* Browser checks that nothing is lost: files shared to the app are read before the share folder is tidied, the
 * write queue's flush waits for a write already running, a saved take lets go of its draft only once the day is on
 * disk, the in-app update watchdog sees the error screen as started, and day records keep only sane values.
 * npm ci && npx playwright install chromium && node data-check.cjs
 * Optionally: CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node data-check.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../www');
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

async function newPage(url, init) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  return page;
}

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const custom = process.env.CHROMIUM_EXECUTABLE_PATH;
  browser = await chromium.launch({ headless: true, ...(custom ? { executablePath: custom, args: ['--no-sandbox', '--no-zygote', '--single-process'] } : {}) });

  // ---------- files shared while the app was closed: read first, then the share folder is tidied ----------
  {
    const page = await newPage(url, () => {
      window.SD_TEST = true;
      const log = window.__log = [];
      const now = Date.now();
      const wait = ms => new Promise(r => setTimeout(r, ms));
      window.Capacitor = {
        isNativePlatform: () => true,
        convertFileSrc: p => p,
        Plugins: {
          SongDiary: {
            /* the plugin answers slowly, as a copy of a big file would */
            takeSharedFiles: async () => { await wait(400); log.push('take'); return { files: [{ name: '받은 녹음.svg', mime: 'image/svg+xml', size: 100, path: '/icon.svg' }] }; },
            addListener: async () => ({ remove() {} }), keepAwake: async () => ({}), lastCrash: async () => ({}), getWindowState: async () => ({ multiWindow: false, width: 390, height: 844 }), openAppSettings: async () => ({})
          },
          Filesystem: {
            readdir: async ({ path: p }) => { log.push('readdir:' + p); return { files: [{ name: 'old.zip', type: 'file', mtime: now - 3600e3 }, { name: 'new.m4a', type: 'file', mtime: now - 2000 }, { name: 'nodate.m4a', type: 'file' }] }; },
            deleteFile: async ({ path: p }) => { log.push('del:' + p); },
            rmdir: async ({ path: p }) => { log.push('rmdir:' + p); }
          }
        }
      };
    });
    await page.waitForFunction(() => window.__log.includes('readdir:share'), null, { timeout: 15000 });
    await page.waitForTimeout(200);
    const log = await page.evaluate(() => window.__log.slice());
    const i = k => log.indexOf(k);
    check(i('take') >= 0 && i('del:/icon.svg') > i('take') && i('readdir:share') > i('del:/icon.svg'), 'the share folder is tidied only after the shared file was read: ' + log.join(', '));
    check(!log.includes('rmdir:share'), 'the share folder is never removed as a whole at start');
    check(log.includes('del:share/old.zip') && !log.includes('del:share/new.m4a') && !log.includes('del:share/nodate.m4a'), 'only copies from an earlier visit are deleted (a recent one may be an older APK’s incoming file)');
    check(await page.evaluate(() => !!document.querySelector('.sheet.open')), 'the shared file is offered for import');
    await page.context().close();
  }

  // ---------- the update watchdog: the error screen counts as started ----------
  {
    const page = await newPage(url, () => { indexedDB.open = () => { throw new Error('broken'); }; });
    await page.waitForFunction(() => document.querySelector('#view .loading button'), null, { timeout: 15000 });
    check(await page.evaluate(() => window.__sdBooted === true), 'a failed data load still marks the app as started (no rollback of a good update)');
    await page.context().close();
  }

  const page = await newPage(url, () => { window.SD_TEST = true; });
  await page.locator('[data-fk="quick-scale"]').waitFor({ state: 'visible' });
  check(await page.evaluate(() => window.__sdBooted === true), 'a normal start marks the app as started');
  await page.evaluate(() => {
    window.ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  });

  // ---------- flushWrites waits for a write already running ----------
  const flush = await page.evaluate(async () => {
    const t = __sdTest, a = ymd(-30), b = ymd(-31);
    t.S.days[a] = t.normDay(a, { memo: 'a' }); t.S.days[b] = t.normDay(b, { memo: 'b' });
    t.queueWrite(a);
    const p1 = t.flushWrites();
    t.queueWrite(b); /* changed while the first write runs */
    const p2 = t.flushWrites();
    const first = p1 instanceof Promise && p2 instanceof Promise;
    await p2;
    const onDisk = await SD.Store.get('days', b);
    await p1;
    const idle = await t.flushWrites();
    return { first, b: onDisk && onDisk.memo, idle: idle === undefined };
  });
  check(flush.first, 'flushWrites always returns a promise');
  check(flush.b === 'b', 'flushWrites called during a write resolves only after what changed meanwhile is on disk');
  check(flush.idle, 'flushWrites with nothing queued resolves');

  // ---------- 5: day records keep only a sane 최고음 ----------
  const high = await page.evaluate(() => {
    const n = (v) => __sdTest.normDay('2026-01-01', { high: v }).high;
    return [n(60), n(1e9), n(60.5), n(200), n(-5), n('60'), n(null)];
  });
  check(JSON.stringify(high) === JSON.stringify([60, null, null, null, null, null, null]), '최고음 is kept only as a whole MIDI note in range: ' + JSON.stringify(high));

  // ---------- 9: a cue typed by hand is taken back by its chip ----------
  const cue = await page.evaluate(() => {
    const t = __sdTest, d = ymd(0);
    t.S.date = d; t.render();
    const ta = document.querySelector('[data-fk="goal"]'), chip = document.querySelector('[data-fk="cue-0"]');
    if (!ta || !chip) return null;
    const line = chip.getAttribute('aria-label').split(',')[0];
    ta.value = line + '\n후렴 음정'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    chip.click(); /* chips were drawn before the typing */
    return { goal: t.S.days[d].goal, line };
  });
  check(cue && cue.goal === '후렴 음정', 'a cue chip judges from the goal as it is now: ' + JSON.stringify(cue));

  // ---------- 12: undoing 노래 전 루틴 넣기 keeps reps checked since ----------
  const undo = await page.evaluate(() => {
    const t = __sdTest, d = ymd(0);
    t.S.settings = t.normSettings(null);
    const own = t.S.settings.drills[0].id;
    t.S.days[d] = t.normDay(d, { drills: { [own]: { name: 'x', target: 5, done: 1 } } });
    const back = t.insertRoutine({});
    const e = t.S.days[d];
    e.drills[own].done = 3; /* own drill, after the insert */
    e.drills.rs_ready.done = 1; /* a routine item, after the insert */
    const unused = Object.keys(e.drills).filter(id => id.startsWith('rs_') && id !== 'rs_ready');
    back();
    const e2 = t.S.days[d];
    return { own: e2.drills[own] && e2.drills[own].done, ownT: e2.drills[own] && e2.drills[own].target, ready: e2.drills.rs_ready, unusedLeft: unused.filter(id => e2.drills[id]) };
  });
  check(undo.own === 3 && undo.ownT === 5, 'undo keeps reps of the user’s own drill checked after the insert');
  check(undo.ready && undo.ready.done === 1 && undo.ready.target === 1, 'a routine item already done stays counted as finished');
  check(undo.unusedLeft.length === 0, 'routine items the insert added and never used are taken out: ' + undo.unusedLeft);

  // ---------- 14: taking back a ④ check after '이제 잘 돼요' lowers the exercise it counted ----------
  await page.evaluate(() => {
    const t = __sdTest, d = ymd(0);
    t.S.settings = t.normSettings(null);
    delete t.S.days[d];
    t.insertRoutine({});
    t.S.settings.book.cur = 20; t.S.settings.rounds = {};
    t.S.openGroups.set('r4', true);
    t.render();
  });
  const tp = page.locator('#tab-practice');
  if (await tp.count()) await tp.click();
  await page.locator('[data-fk="dr-rs_book-plus"]').click();
  const r14 = await page.evaluate(() => {
    const t = __sdTest, d = ymd(0), R = t.S.settings.rounds;
    const after1 = { n20: R[20] && R[20].n, bk: (t.S.days[d].drills.rs_book.bk || []).slice() };
    t.S.settings.book.cur = 21; /* 이제 잘 돼요 */
    t.render();
    return after1;
  });
  check(r14.n20 === 1 && JSON.stringify(r14.bk) === '[20]', 'a ④ check notes the exercise it counted');
  await page.locator('[data-fk="dr-rs_book-minus"]').click();
  const r14b = await page.evaluate(() => { const R = __sdTest.S.settings.rounds; return { n20: R[20].n, n21: R[21] ? R[21].n : null, bk: __sdTest.S.days[ymd(0)].drills.rs_book.bk }; });
  check(r14b.n20 === 0 && !r14b.n21 && r14b.bk.length === 0, 'taking it back after moving on lowers 20번, not the new 21번: ' + JSON.stringify(r14b));
  check(JSON.stringify(await page.evaluate(() => __sdTest.normDay('2026-01-01', { drills: { rs_book: { target: 3, done: 2, bk: [20, 'x', 1e9] } } }).drills.rs_book.bk)) === '[20,0,0]', 'normDay keeps the noted exercises, unknown ones as 0');
  await page.context().close();

  // ---------- 3: a saved draft goes only once the day record holding it is on disk ----------
  {
    const p2 = await newPage(url, () => {
      window.SD_TEST = true;
      let sd;
      Object.defineProperty(window, 'SD', { configurable: true, get: () => sd, set: v => {
        sd = v;
        const del = v.Store.del;
        v.Store.del = async function (store, key) {
          if (key === 'recDraft') { const all = await v.Store.all('days'); window.__atDrop = all.reduce((a, [, e]) => a + ((e && e.recs) || []).length, 0); }
          return del.call(this, store, key);
        };
      } });
    });
    await p2.locator('[data-fk="quick-scale"]').waitFor({ state: 'visible' });
    await p2.evaluate(async () => {
      const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await SD.Store.put('meta', 'recDraft', { blob: new Blob([new Uint8Array(4000)], { type: 'audio/webm' }), date: k, durSec: 3, marks: [], at: Date.now(), partial: true });
    });
    await p2.reload();
    const sheet = p2.locator('.sheet.open');
    await sheet.waitFor({ state: 'visible', timeout: 15000 });
    check((await sheet.innerText()).includes('녹음하다가 앱이 닫혔어요'), 'a draft cut off while recording is offered as such');
    await sheet.getByRole('button', { name: '저장하기' }).click();
    await p2.waitForFunction(() => window.__atDrop != null, null, { timeout: 10000 });
    check(await p2.evaluate(() => window.__atDrop) === 1, 'when the draft is dropped the day record with the take is already on disk');
    check(await p2.evaluate(async () => !(await SD.Store.get('meta', 'recDraft'))), 'the draft is gone after saving');
    await p2.context().close();
  }

  check(errors.length === 0, 'no page errors: ' + errors.join('; '));
  console.log(`\n${checks} checks passed.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
