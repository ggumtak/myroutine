/* Browser checks for the 노래 전 루틴: the book's start notes and directions, sounds taking turns, 오늘의 강도,
 * 골고루 review picks, settings that sync between phones, and small-screen layouts.
 * npm ci && npx playwright install chromium && node routine-check.cjs
 * Optionally: CHROMIUM_EXECUTABLE_PATH=/path/to/chromium SCREENSHOT_DIR=/path node routine-check.cjs
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

/* every book exercise's automatic rounds from its book start with the default 꼭대기 음 (72), recorded before 12·25 went down */
const BEFORE = {"b01":"[48,49,50,51,52,53,52,51,50,49,48]","b02":"[48,49,50,51,52,53,52,51,50,49,48]","b03":"[48,49,50,51,52,53,54,55,56,57,58,59,60,59,58,57,56,55,54,53,52,51,50,49,48]","b04":"[48,49,50,51,52,53,54,55,56,57,58,59,60,59,58,57,56,55,54,53,52,51,50,49,48]","b05":"[55,56,57,58,59,60,59,58,57,56,55]","b06":"[48,49,50,51,52,53,52,51,50,49,48]","b07":"[55,56,57,58,59,60,59,58,57,56,55]","b08":"[48,49,50,51,52,53,52,51,50,49,48]","b09":"[48,49,50,51,52,53,52,51,50,49,48]","b10":"[55,56,57,58,59,60,59,58,57,56,55]","b11":"[55,56,57,58,59,60,59,58,57,56,55]","b13":"[48,49,50,51,52,53,52,51,50,49,48]","b14":"[60,61,62,63,64,65,64,63,62,61,60]","b15":"[48,49,50,51,52,53,52,51,50,49,48]","b16":"[48,49,50,51,52,53,52,51,50,49,48]","b17":"[48,49,50,51,52,53,52,51,50,49,48]","b18":"[48,49,50,51,52,53,52,51,50,49,48]","b19":"[55,56,57,58,59,60,59,58,57,56,55]","b20":"[55,56,57,58,59,60,59,58,57,56,55]","b21":"[56,57,58,59,60,59,58,57,56]","b22":"[55,56,57,58,59,60,59,58,57,56,55]","b23":"[55,56,57,58,59,60,59,58,57,56,55]","b24":"[55,56,57,58,59,60,59,58,57,56,55]","b26":"[48,49,50,51,52,53,52,51,50,49,48]"};

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
  /* a clean slate with the routine in, and date helpers in the page */
  await page.evaluate(async () => {
    const t = __sdTest;
    window.ymd = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    for (const k of Object.keys(t.S.days)) delete t.S.days[k];
    t.S.settings = t.normSettings(null);
    t.insertRoutine({});
    t.render();
  });

  // ---------- renamed routine items: 립트릴 · 텅트릴 · 오늘의 스케일 ----------
  const renamed = await page.evaluate(() => {
    const t = __sdTest, ds = t.S.settings.drills, saved = JSON.stringify(ds);
    const set = (id, name) => { const d = ds.find(x => x.id === id); if (d) d.name = name; };
    set('rs_lip', '입술 떨기 (립롤)'); set('rs_trill', '혀 굴리기 (트릴)'); set('rs_book', '오늘의 단계 연습');
    t.render();
    const names = ['rs_lip', 'rs_trill', 'rs_book'].map(id => (ds.find(x => x.id === id) || {}).name);
    const custom = ds.find(x => x.id === 'rs_lip'); if (custom) custom.name = '내 립롤 연습'; t.render();
    const kept = (ds.find(x => x.id === 'rs_lip') || {}).name;
    t.S.settings.drills = JSON.parse(saved); t.render();
    return { names, kept };
  });
  check(JSON.stringify(renamed.names) === JSON.stringify(['립트릴', '텅트릴', '오늘의 스케일']), 'stored routine names move to 립트릴 · 텅트릴 · 오늘의 스케일');
  check(renamed.kept === '내 립롤 연습', 'a name the user wrote is kept');

  // ---------- the book's start notes and directions ----------
  const book = await page.evaluate(() => ({ t12: ScaleKit.BOOK[11].t, d12: ScaleKit.BOOK[11].dir, d25: ScaleKit.BOOK[24].dir, s12: ScaleKit.downSequence(61, 36), s25: ScaleKit.downSequence(ScaleKit.BOOK[24].t, 36), low: ScaleKit.downSequence(38, 36), how9: ScaleKit.BOOK[8].how }));
  check(book.t12 === 61, '12번 starts on the book’s tenor C♯ (MIDI 61)');
  check(book.d12 === 'down' && book.d25 === 'down', '12번 and 25번 go down as in the book');
  check(JSON.stringify(book.s12) === '[61,60,59,58,57]', '12번 auto rounds go down a semitone for 5 rounds from 61');
  check(JSON.stringify(book.s25) === '[67,66,65,64,63]', '25번 auto rounds go down from its start');
  check(JSON.stringify(book.low) === '[38,37,36]', 'going down stops at the lowest key');
  check(/울먹/.test(book.how9) && !/하품/.test(book.how9), '9번 uses the small cry of 7번, not a yawn');
  const seqs = await page.evaluate(() => {
    const out = {};
    for (const b of ScaleKit.BOOK) if (!b.dir) out[b.id] = JSON.stringify(ScaleKit.roundSequence(b.t, Math.min(72, 72 - Math.max(...b.steps)), 'updown'));
    return out;
  });
  check(JSON.stringify(seqs) === JSON.stringify(BEFORE), 'every other exercise keeps its up-and-back rounds');
  const rs = await page.evaluate(() => [ScaleKit.roundSequence(48, 51), ScaleKit.roundSequence(48, 51, 'down'), ScaleKit.roundSequence(48, 52, 'updown', 50), ScaleKit.roundSequence(49, 53, 'updown', 51, true)]);
  check(JSON.stringify(rs) === JSON.stringify([[48,49,50,51,50,49,48],[51,50,49,48],[50,51,52,51,50,49,48],[51,50,49]]), 'roundSequence semantics are unchanged');
  // a saved start for 12번 stays the user's own
  check(await page.evaluate(() => __sdTest.normSettings({ scale: { starts: { b12: 56 } } }).scale.starts.b12 === 56), 'a saved 12번 start is kept');

  // the trainer plays 12번 down from 61 (5 rounds) and shows the descending indicator
  await page.evaluate(() => { const T = __sdTest.S.settings.scale; T.auto = true; T.direction = 'updown'; delete T.starts.b12; __sdTest.openScaleTrainer({ pat: 'b12' }); });
  await visible(page, '.sheet.open .sc-play');
  let sheet = page.locator('.sheet.open');
  check((await sheet.locator('.sc-now').innerText()).includes('반음씩 내려가요 (5번)'), '12번 shows 5 rounds going down before playing');
  check(await sheet.locator('.sc-top').nth(1).isHidden(), '12번 hides the 가장 높은 음, which it ignores');
  await sheet.locator('.sc-play').click();
  await page.waitForFunction(() => document.querySelector('.sheet.open .sc-seq > .cur'));
  const now12 = await sheet.locator('.sc-now').innerText();
  check(now12.includes('하행') && now12.includes('1/5'), '12번 playback starts with the descending indicator: ' + now12.replace(/\s+/g, ' '));
  await sheet.locator('.sc-play').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sheet.open'));

  // ---------- settings: plan and the 골고루 log ----------
  const norm = await page.evaluate(() => {
    const n = __sdTest.normSettings;
    const a = n({ plan: { level: 'push', at: 5, extra: 1 }, book: { cur: 20, log: { 20: { s: '2026-01-01', a: '2026-02-01', last: '2026-03-01', n: 7 }, 23: 'x' } },
      rounds: { 21: { last: 'bad', n: -3 }, 22: { n: '12' }, 99: { last: '2026-03-01' }, 2: { n: 3 }, 24: { last: '2026-03-01', prev: '2026-03-05', n: 2 }, 25: { last: '2026-03-08', prev: '2026-03-02' } } });
    const b = n(JSON.parse(JSON.stringify(a)));
    const proto = n({ rounds: Object.create({ 20: { n: 5 } }) }).rounds;
    return {
      a, same: JSON.stringify(a.plan) === JSON.stringify(b.plan) && JSON.stringify(a.book) === JSON.stringify(b.book) && JSON.stringify(a.rounds) === JSON.stringify(b.rounds),
      def: n(null).plan, g1: n({ plan: 'x' }).plan, g2: n({ plan: { level: 'zzz', at: 'abc' } }).plan, g3: n({ plan: [1, 2] }).plan, g4: n({ plan: { level: 'light', at: Infinity } }).plan,
      g5: n({ plan: { level: 'constructor' } }).plan.level, g6: n({ plan: { level: 'toString' } }).plan.level, g7: n({ rounds: 'x' }).rounds, g8: n({ rounds: [1] }).rounds, proto,
      big: n({ rounds: { 20: { n: 1e9 } } }).rounds[20].n
    };
  });
  check(norm.a.plan.level === 'push' && norm.a.plan.at === 5 && norm.a.plan.extra === 1, 'plan keeps its level, time and unknown keys');
  check(norm.same, 'plan, book log and rounds round-trip through normSettings');
  check(JSON.stringify(norm.a.book.log[20]) === JSON.stringify({ s: '2026-01-01', a: '2026-02-01' }) && JSON.stringify(norm.a.rounds[20]) === JSON.stringify({ last: '2026-03-01', n: 7 }), 'last/n kept in book.log move once to settings.rounds');
  check(!norm.a.book.log[23] && !norm.a.rounds[21] && norm.a.rounds[22].n === 12 && !norm.a.rounds[99] && !norm.a.rounds[2], 'bad round entries are dropped, numeric strings kept');
  check(JSON.stringify(norm.a.rounds[24]) === JSON.stringify({ last: '2026-03-05', prev: '2026-03-01', n: 2 }) && JSON.stringify(norm.a.rounds[25]) === JSON.stringify({ last: '2026-03-08', prev: '2026-03-02' }), 'prev is always the day before last');
  check(norm.def.level === 'base' && norm.g1.level === 'base' && norm.g2.level === 'base' && norm.g2.at === 0 && norm.g3.level === 'base' && norm.g4.at === 0, 'garbage plans fall back to 기본');
  check(norm.g5 === 'base' && norm.g6 === 'base', 'object built-ins are not levels');
  check(JSON.stringify(norm.g7) === '{}' && JSON.stringify(norm.g8) === '{}' && JSON.stringify(norm.proto) === '{}', 'garbage rounds become empty (own keys only)');
  check(norm.big === 9999, 'round counts are capped');
  const merged = await page.evaluate(() => {
    const t = __sdTest;
    const cur = t.normSettings({ updatedAt: 200, plan: { level: 'light', at: 10 }, book: { cur: 21, log: { 20: { s: '2026-01-05', a: '2026-02-01' } } }, rounds: { 20: { last: '2026-03-01', prev: '2026-02-01', n: 4 }, 22: { last: '2026-03-03', n: 1 } } });
    const inc = t.normSettings({ updatedAt: 100, plan: { level: 'push', at: 20 }, book: { cur: 20, log: { 20: { s: '2026-01-01' } } }, rounds: { 20: { last: '2026-03-09', prev: '2026-02-20', n: 2 }, 21: { last: '2026-03-02', n: 5 } } });
    const m = t.mergeSettings(t.normSettings(cur), t.normSettings(inc));
    const old = t.normSettings({ updatedAt: 300, book: { cur: 21, log: {} } });
    delete old.plan; /* an older app that never knew the setting */
    const m2 = t.mergeSettings(t.normSettings({ updatedAt: 400, plan: { level: 'push', at: 50 } }), old);
    const m3 = t.mergeSet3(cur, inc, null);
    return { log: m.book.log, r: m.rounds, cur: m.book.cur, plan: m.plan, plan2: m2.plan, plan3: m3.plan, r3: m3.rounds };
  });
  check(merged.log[20].s === '2026-01-01' && merged.log[20].a === '2026-02-01' && JSON.stringify(merged.r[20]) === JSON.stringify({ last: '2026-03-09', prev: '2026-03-01', n: 4 }), 'mergeSettings keeps the earlier start, the later last, the latest day before it and the most rounds');
  check(merged.r[21].last === '2026-03-02' && merged.r[21].n === 5 && merged.r[22].n === 1, 'rounds from either phone are kept');
  check(merged.cur === 21, 'the newer phone’s exercise stays current');
  check(merged.plan.level === 'push' && merged.plan2.level === 'push' && merged.plan3.level === 'push', 'the latest picked 강도 wins, also against an older app: ' + JSON.stringify([merged.plan, merged.plan2, merged.plan3]));
  check(merged.r3[20].last === '2026-03-09' && merged.r3[20].n === 4, 'the 3-way settings merge also joins the rounds');
  /* phone A marked 8번 잘 돼요 today (8 → 9); phone B saved later but still on 8 */
  const back = await page.evaluate(() => {
    const t = __sdTest, keep = t.S.settings;
    const A = t.normSettings({ updatedAt: 100, book: { cur: 9, log: { 7: { a: '2026-09-01' }, 8: { s: '2026-09-02', a: ymd(0) } } } });
    const B = t.normSettings({ updatedAt: 200, book: { cur: 8, log: { 7: { a: '2026-09-01' }, 8: { s: '2026-09-02' } } } });
    const r1 = t.mergeSettings(t.normSettings(B), t.normSettings(A)).book.cur;
    t.S.settings = A;
    const r2 = t.mergeSet3(A, B, null).book.cur;
    t.S.settings = keep;
    const C = t.normSettings({ updatedAt: 300, book: { cur: 12, log: { 11: { a: '2026-09-05' } } } }), D = t.normSettings({ updatedAt: 100, book: { cur: 10, log: { 9: { a: '2026-09-05' } } } });
    return { r1, r2, tie: t.mergeSettings(C, D).book.cur };
  });
  check(back.r1 === 9 && back.r2 === 9, 'a sync never moves the current exercise back past a newer 잘 돼요');
  check(back.tie === 12, 'with the same newest 잘 돼요 the newer phone decides');

  const lyMerge = await page.evaluate(() => {
    const t = __sdTest;
    const song = (status, ly) => ({ k: 'x', artist: '', memo: '', status, cat: null, ...(ly ? { ly } : {}) });
    const base = t.normSettings({ updatedAt: 50, songs: [song('', { text: '가', m: {}, at: 1 })] });
    /* this phone marked the lyrics (older settings time), the other changed only the status (newer) */
    const local = t.normSettings({ updatedAt: 100, songs: [song('', { text: '가', m: { '0.0': ['h'] }, at: 90 })] });
    const remote = t.normSettings({ updatedAt: 200, songs: [song('완성', { text: '가', m: {}, at: 1 })] });
    const m = t.mergeSet3(local, remote, t.setBase(base));
    const s = m.songs.find(x => x.k === 'x');
    const emptied = t.mergeSet3(t.normSettings({ updatedAt: 300, songs: [song('', { text: '', at: 95 })] }), remote, t.setBase(base)).songs[0];
    return { status: s.status, marks: s.ly && s.ly.m['0.0'], emptied: emptied.ly && emptied.ly.text };
  });
  check(lyMerge.marks && lyMerge.marks[0] === 'h', 'a song changed on both phones keeps the newer 가사 노트');
  check(lyMerge.status === '완성', 'the rest of that song still comes from the newer phone');
  check(lyMerge.emptied === '', 'an emptied 가사 노트 stays empty against an older copy');

  // ---------- 골고루: review picks and 유지 ----------
  const picks = await page.evaluate(() => {
    const P = Practice, d = '2026-10-12';
    const log = { 5: { a: '2026-10-05' }, 6: { a: '2026-09-01' }, 14: { a: '2026-09-10' }, 15: { a: '2026-09-15' }, 16: { a: '2026-09-20' }, 17: { s: '2026-10-01' } };
    const rounds = { 14: { last: '2026-10-01' }, 15: { last: '2026-09-20' }, 16: { last: '2026-10-05' } };
    const early = { 5: { a: '2026-10-05' }, 6: { a: '2026-10-01' }, 7: { a: '2026-10-08' } }, earlyR = { 5: { last: '2026-10-10' }, 6: { last: '2026-10-09' }, 7: { last: '2026-10-09' } };
    const keepLog = { 26: { a: '2026-10-01' } }, keepR = {};
    for (let no = 17; no <= 26; no++) keepR[no] = { last: no === 19 ? '2026-09-01' : '2026-10-0' + (no % 9 + 1) };
    const keepR2 = JSON.parse(JSON.stringify(keepR));
    keepR2[19] = { last: d, prev: '2026-09-01' }; /* today's 유지 exercise, sung already */
    return {
      two: P.reviewPicks(log, rounds, 17, d, 2), one: P.reviewPicks(log, rounds, 17, d, 1), none: P.reviewPicks(log, rounds, 17, d, 0),
      noMain: P.reviewPicks(log, rounds, 15, d, 3),
      early: P.reviewPicks(early, earlyR, 8, d, 2),
      today: P.reviewPicks({ 14: { a: '2026-09-01' }, 15: { a: '2026-09-05' } }, { 14: { last: d, prev: '2026-10-11' }, 15: { last: '2026-10-05' } }, 17, d, 1),
      fresh: P.reviewPicks({ 14: { a: d }, 15: { a: '2026-09-05' } }, {}, 17, d, 2),
      tie: P.reviewPicks({ 18: { a: '2026-09-01' }, 15: { a: '2026-09-01' } }, null, 20, d, 2),
      keep: P.keeping({ cur: 26, log: keepLog }), notKeep: P.keeping({ cur: 26, log: {} }), keepPick: P.keepPick(keepLog, keepR, d), keepPick2: P.keepPick(keepLog, keepR2, d)
    };
  });
  check(JSON.stringify(picks.two) === '[6,15]', '5~13 come back only after two weeks away; then the least recently sung');
  check(JSON.stringify(picks.one) === '[6]' && picks.none.length === 0, 'the level decides how many reviews');
  check(!picks.noMain.includes(15), 'today’s own exercise is never a review');
  check(JSON.stringify(picks.early) === '[6,7]', 'before 14번 is mastered, 5~13 rotate by least recent');
  check(JSON.stringify(picks.today) === '[15]', 'an exercise sung today is ordered by the day before (prev)');
  check(JSON.stringify(picks.fresh) === '[15]', 'an exercise mastered today is not reviewed the same day');
  check(JSON.stringify(picks.tie) === '[15,18]', 'ties go to the lower number');
  check(picks.keep && !picks.notKeep && picks.keepPick === 19 && picks.keepPick2 === 19, '유지 mode rotates to the least recently sung of 17~26 and keeps it all day');

  // ---------- 오늘의 강도 on today's screen ----------
  await page.evaluate(() => {
    const t = __sdTest, B = t.S.settings.book, y = ymd(-40);
    B.cur = 20; B.log = { 14: { a: y }, 15: { a: y }, 16: { a: y }, 20: { s: ymd(-2) } };
    t.S.settings.rounds = { 14: { last: ymd(-3) }, 15: { last: ymd(-9) }, 16: { last: ymd(-5) } };
    t.render();
  });
  await page.locator('#tab-practice').click();
  await visible(page, '[data-fk="lv-base"]');
  const tgt = () => page.evaluate(() => { const d = __sdTest.drillList(ymd(0)).find(x => x.id === 'rs_book'); return d.target; });
  check(await page.locator('[data-fk="lv-base"]').getAttribute('aria-pressed') === 'true', '기본 is the default 강도');
  check(await tgt() === 4, '기본: ④ is 3 + 1 review');
  await page.locator('[data-fk="lv-push"]').click();
  check(await tgt() === 6 && await page.evaluate(() => __sdTest.S.settings.plan.level === 'push' && __sdTest.S.settings.plan.at > 0), '도전: ④ is 4 + 2 reviews, and the pick is saved with its time');
  await page.locator('[data-fk="lv-light"]').click();
  check(await tgt() === 2, '가볍게: ④ is 2 with no review');
  await page.locator('[data-fk="lv-base"]').click();
  // a record already made today follows a change of 강도
  await page.evaluate(() => { const t = __sdTest; const e = t.S.days[ymd(0)] || (t.S.days[ymd(0)] = t.normDay(ymd(0), {})); e.drills = { rs_book: { name: '오늘의 단계 연습', target: 4, done: 0, times: [] } }; });
  await page.locator('[data-fk="lv-push"]').click();
  check(await page.evaluate(() => __sdTest.S.days[ymd(0)].drills.rs_book.target === 6), 'changing 강도 updates the count already in today’s record');
  await page.locator('[data-fk="lv-base"]').click();
  const plan = await page.evaluate(() => { const p = __sdTest.bookPlan(ymd(0)); return { main: p.main, reviews: p.reviews, pats: [0, 1, 2, 3].map(i => { const e = __sdTest.S.days[ymd(0)]; if (e && e.drills.rs_book) e.drills.rs_book.done = i; return __sdTest.drillPat(ymd(0), 'rs_book'); }) }; });
  check(plan.main === 20 && JSON.stringify(plan.reviews) === '[15]', 'the review is the least recently sung mastered exercise');
  // free practice of mastered exercises mid-day doesn't change today's pick
  const stable = await page.evaluate(() => {
    const t = __sdTest, R = t.S.settings.rounds, keep = JSON.parse(JSON.stringify(R));
    t.bookRound(14, ymd(0)); t.bookRound(15, ymd(0)); t.bookRound(16, ymd(0));
    const after = t.bookPlan(ymd(0)).reviews, r15 = JSON.parse(JSON.stringify(R[15]));
    t.S.settings.rounds = keep;
    return { after, r15 };
  });
  check(JSON.stringify(stable.after) === '[15]', 'rounds sung mid-day leave today’s review where it was');
  check(stable.r15.last === await page.evaluate(() => ymd(0)) && stable.r15.prev === await page.evaluate(() => ymd(-9)) && stable.r15.n === 1, 'a round today moves the earlier last day to prev');
  check(JSON.stringify(plan.pats) === JSON.stringify(['b20', 'b20', 'b20', 'b15']), 'the piano plays today’s exercise three times, then the review');
  await page.evaluate(() => { const e = __sdTest.S.days[ymd(0)]; if (e && e.drills.rs_book) e.drills.rs_book.done = 0; __sdTest.render(); });
  await page.locator('[data-fk="grp-r4"]').click();
  const row = await page.locator('#sec-drills').innerText();
  check(row.includes('20번') && row.includes('×3') && /복습 .*\(15번\) ×1/.test(row), '④ row shows today’s exercise and the review');

  // ---------- sounds take turns ----------
  await page.evaluate(() => { __sdTest.S.settings.rounds[20] = { n: 0 }; __sdTest.render(); });
  await page.locator('[data-fk="dr-rs_book-keys"]').click();
  await visible(page, '.sheet.open .sc-play');
  sheet = page.locator('.sheet.open');
  const pressed = () => page.evaluate(() => { const b = document.querySelector('.sheet.open .sc-vs button[aria-pressed="true"]'); return b ? b.textContent.trim() : ''; });
  const first = await pressed();
  check(first.startsWith('(a)'), 'the first check of the day starts on (a): ' + first);
  await sheet.locator('[data-fk="sc-drill"]').click();
  check((await pressed()).startsWith('(b)'), 'after a check the next round takes (b)');
  await sheet.locator('[data-fk="sc-drill"]').click();
  check((await pressed()).startsWith('(c)'), 'then (c)');
  check(await page.evaluate(() => { const R = __sdTest.S.settings.rounds[20]; return R.n === 2 && R.last === ymd(0); }), 'each check notes the exercise’s last day and round count');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sheet.open'));
  // the next day carries on: (c) is where the next session starts
  await page.locator('[data-fk="dr-rs_book-keys"]').click();
  await visible(page, '.sheet.open .sc-play');
  sheet = page.locator('.sheet.open');
  check((await pressed()).startsWith('(c)'), 'opening again carries on from the next sound');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sheet.open'));
  // taking a check back takes its round back too (the day stays); checking again adds it
  await page.locator('[data-fk="dr-rs_book-minus"]').click();
  check(await page.evaluate(() => { const R = __sdTest.S.settings.rounds[20]; return R.n === 1 && R.last === ymd(0); }), 'a check taken back lowers the round count only');
  await page.locator('[data-fk="dr-rs_book-plus"]').click();
  check(await page.evaluate(() => __sdTest.S.settings.rounds[20].n === 2), 'checking again counts the round again');
  await page.locator('[data-fk="dr-rs_book-keys"]').click();
  await visible(page, '.sheet.open .sc-play');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sheet.open'));

  // ---------- the session: plan lines and the sound ----------
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('.tab[data-tab="today"]').click();
  await page.locator('#tab-practice').click();
  await noOverflow(page, '320px today screen with 강도 fits');
  await page.screenshot({ path: path.join(screenshots, 'routine-today.png') });
  await page.locator('[data-fk="ses-start"]').click();
  await visible(page, '.sheet.open .ses');
  sheet = page.locator('.sheet.open');
  await sheet.locator('.ses-dot').first().click();
  const intro = await sheet.locator('.ses-card').innerText();
  check(intro.includes('오늘의 강도') && /\(20번\) \(c\) 음 → 어 ×3/.test(intro) && /복습 .*\(15번\) ×1/.test(intro), 'session intro shows the 강도 and ④ in detail');
  check(/\(1번\) ×1 → .*\(3번\) ×1/.test(intro) && /가장 높은 음/.test(intro), 'session intro shows ③ with reps, direction and top note');
  const steps = await sheet.locator('.ses-dot').count();
  for (let k = 0; k < steps; k++) {
    await sheet.locator('.ses-dot').nth(k).click();
    check(await page.evaluate(() => { const b = document.querySelector('.sheet.open .sheet-body'); return document.documentElement.scrollWidth <= innerWidth + 1 && (!b || b.scrollWidth <= b.clientWidth + 1); }), `320px session step ${k + 1} fits`);
    if (k === 6) {
      const card = await sheet.locator('.ses-card').innerText();
      check(card.includes('부를 소리') && card.includes('(c)') && card.includes('④'), 'the ④ step shows its plan line and the sound to sing');
      await sheet.screenshot({ path: path.join(screenshots, 'routine-session.png') });
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sheet.open'));

  // ---------- rest day: 가볍게 by itself ----------
  await page.evaluate(() => {
    const t = __sdTest, y = ymd(-1);
    t.S.days[y] = t.normDay(y, { after: 3 });
    delete t.S.days[ymd(0)];
    t.S.settings.plan.level = 'push';
    t.render();
  });
  const rest = await page.evaluate(() => ({ rest: __sdTest.restDay(ymd(0)), lv: __sdTest.bookPlan(ymd(0)).lv.k, target: __sdTest.drillList(ymd(0)).find(x => x.id === 'rs_book').target, saved: __sdTest.S.settings.plan.level }));
  check(rest.rest && rest.lv === 'light' && rest.target === 2 && rest.saved === 'push', 'a rest day is 가볍게 without changing the setting');
  check((await page.locator('#sec-drills').innerText()).includes('저절로 가볍게'), 'the rest day says so');
  await noOverflow(page, '320px rest day fits');

  // ---------- nudge after 10 days on 5~11 ----------
  await page.evaluate(() => {
    const t = __sdTest, B = t.S.settings.book;
    delete t.S.days[ymd(-1)];
    t.S.settings.plan.level = 'base';
    B.cur = 7; B.log = { 5: { s: ymd(-20), a: ymd(-15) }, 6: { s: ymd(-15), a: ymd(-12) }, 7: { s: ymd(-12) } };
    for (let i = 1; i <= 10; i++) t.S.days[ymd(-i)] = t.normDay(ymd(-i), { drills: { rs_book: { name: '오늘의 단계 연습', target: 3, done: 3 } } });
    t.S.openGroups.set('r4', true);
    t.render();
  });
  check(await page.locator('[data-fk="dr-skip14"]').isVisible(), 'after 10 days on 5~11 the ④ row suggests the “끼익” stage');
  await page.locator('[data-fk="dr-skip14"]').click();
  check(await page.evaluate(() => __sdTest.S.settings.book.cur === 14), 'the suggestion moves on to 14번');
  await noOverflow(page, '320px ④ row fits');

  // 잘 돼요 → 되돌리기 puts back only the exercise and its 해낸 날; rounds sung in between stay
  await page.evaluate(() => { __sdTest.openScaleTrainer({ pat: 'b14' }); });
  await visible(page, '.sheet.open .sc-play');
  await page.evaluate(() => document.querySelector('.sheet.open [data-fk="sc-bookdone"]').click());
  check(await page.evaluate(() => __sdTest.S.settings.book.cur === 15 && !!__sdTest.S.settings.book.log[14].a), '잘 돼요 moves on to 15번');
  await page.evaluate(() => __sdTest.bookRound(16, ymd(0)));
  await page.getByRole('button', { name: '되돌리기' }).first().click();
  check(await page.evaluate(() => { const S = __sdTest.S.settings; return S.book.cur === 14 && !(S.book.log[14] && S.book.log[14].a) && S.rounds[16] && S.rounds[16].n >= 1 && !!S.book.log[5].a; }), '되돌리기 restores the exercise and keeps rounds sung since');
  await page.keyboard.press('Escape');

  check(errors.length === 0, 'no page errors or missing local assets: ' + errors.join('; '));
  console.log(`\n${checks} checks passed. Screenshots: ${screenshots}`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.close(); });
