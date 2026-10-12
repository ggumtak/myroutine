/* 가사 노트 — paste lyrics, mark breaths / H-attacks / bends on each syllable, fix pronunciation,
   and listen for one technique at a time (most important first).
   Data lives in songMeta(key).ly = { text, m: {"li.ci": [ids]}, p: {"li.ci": "에"}, n: {"li": "memo"}, own: ["names"], heard: [ids], at };
   own = the song's own techniques (typed by the user), marked as `u:<name>` ids in m / heard.
   The pure helpers (norm / lines / remap / count / noteText) have no DOM; the sheet UI uses window.SDUI lazily. */
(function () {
'use strict';

const MAX_TEXT = 6000, MAX_LINES = 200, MAX_PRON = 4, MAX_MEMO = 120;
const MAX_OWN = 12, MAX_OWN_LEN = 8, MAX_OLD = 8; /* own techniques per song / characters per name / slack for converted old marks */

/* ordered by importance — most important first */
const TECHS = [
  { id: 'breath', sym: 'V', name: '숨', group: 'breath', desc: '숨을 들이마시는 자리예요.' },
  { id: 'h', sym: 'H', name: 'H 어택', group: 'onset', desc: '‘ㅎ’ 소리를 살짝 먼저 내며 부드럽게 시작해요.' },
  { id: 'scoop', sym: '↗', name: '밴딩', group: 'pitch', desc: '아래에서 미끄러지듯 올라가며 음을 잡아요.' },
  { id: 'vib', sym: '〰', name: '바이브레이션', group: 'ending', desc: '긴 음 끝을 잔잔하게 떨어 줘요.' },
  { id: 'release', sym: 'ㅎ↓', name: '끝 숨 빼기', group: 'ending', desc: '끝을 숨으로 흘려 보내며 힘을 빼요.' },
  { id: 'fall', sym: '↘', name: '음 떨어뜨리기', group: 'pitch', desc: '음 끝을 아래로 툭 떨어뜨려요.' },
  { id: 'flip', sym: '∧', name: '꺾기', group: 'pitch', desc: '한 음절 안에서 음을 위아래로 빠르게 꺾어요.' },
  { id: 'falsetto', sym: '가', name: '가성', group: 'tone', desc: '얇고 가볍게 가성으로 불러요.' },
  { id: 'legato', sym: '⌒', name: '이어 부르기', group: 'rhythm', desc: '음과 음을 끊지 않고 매끄럽게 이어 불러요.' },
  { id: 'stacc', sym: '·', name: '끊기', group: 'rhythm', desc: '음을 짧게 끊어 불러요.' },
  { id: 'long', sym: '—', name: '길게', group: 'ending', desc: '음을 끝까지 길게 끌어 줘요.' },
  { id: 'accent', sym: '>', name: '강세', group: 'dyn', desc: '이 글자에 힘을 실어 또렷하게 불러요.' },
  { id: 'loud', sym: 'f', name: '세게', group: 'dyn', desc: '이 부분은 세게 불러요.' },
  { id: 'soft', sym: 'p', name: '여리게', group: 'dyn', desc: '이 부분은 여리게 불러요.' },
  { id: 'laid', sym: '→', name: '박자 밀기', group: 'rhythm', desc: '박자보다 살짝 뒤로 밀어 여유 있게 불러요.' }
];
const BY = Object.create(null), ORD = Object.create(null);
TECHS.forEach((t, i) => { BY[t.id] = t; ORD[t.id] = i; });
/* techniques that used to exist: their old marks live on as the user's own text marks, so nothing is lost */
const OLD = Object.assign(Object.create(null), { airy: '숨소리 섞기', fry: '보컬 프라이', run: '런·애드립', nasal: '비음', rasp: '허스키', cry: '크라이', glottal: '성대 붙여 시작', mix: '믹스·두성' });
const OWN_DESC = '내가 적은 표시예요. 글자를 눌러 표시해요.';

/* ================= pure helpers ================= */
function emptyLy() { return { text: '', m: {}, p: {}, n: {}, own: [], heard: [], at: 0 }; }
const isStr = v => typeof v === 'string';
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
/* sort key: built-in techniques by importance, then the song's own ones in the order they were added */
const mkOrd = own => { const f = id => (id in ORD ? ORD[id] : 100 + own.indexOf(id.slice(2))); return (a, b) => f(a) - f(b); };
const isOwnId = id => isStr(id) && id.startsWith('u:');
/* a custom technique name: NFC, single spaces, trimmed, at most 8 characters ('' when nothing usable is left) */
function ownName(s) {
  if (!isStr(s)) return '';
  return clipChars(s.normalize('NFC').replace(/\s+/g, ' ').trim(), MAX_OWN_LEN).trim();
}
/* the technique behind a mark id: built-in, or a pseudo-technique for a custom `u:<name>` */
function techOf(id) {
  if (isStr(id) && id in BY) return BY[id];
  if (!isOwnId(id)) return null;
  const name = id.slice(2);
  return { id, sym: Array.from(name).slice(0, 2).join(''), name, group: 'own', desc: OWN_DESC };
}

/* split on line breaks, trim right, 3+ blank lines -> one blank, no leading/trailing blank, ≤ 200 lines */
function lines(text) {
  if (!isStr(text)) return [];
  const raw = text.normalize('NFC').split(/\r\n|\r|\n/).map(s => s.replace(/\s+$/, ''));
  const out = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] !== '') { out.push(raw[i++]); continue; }
    let j = i;
    while (j < raw.length && raw[j] === '') j++;
    const run = j - i;
    if (run >= 3) out.push('');
    else for (let k = 0; k < run; k++) out.push('');
    i = j;
  }
  while (out.length && out[0] === '') out.shift();
  if (out.length > MAX_LINES) out.length = MAX_LINES;
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}
function normText(text) {
  let t = lines(text).join('\n');
  if (t.length > MAX_TEXT) t = lines(t.slice(0, MAX_TEXT)).join('\n');
  return t;
}
function clipChars(s, n) { return Array.from(s).slice(0, n).join(''); }
/* a syllable key must point at a real, non-space character */
function charAtKey(L, k) {
  const m = /^(\d{1,3})\.(\d{1,4})$/.exec(k);
  if (!m) return null;
  const li = +m[1], ci = +m[2], line = L[li];
  if (line === undefined || ci >= line.length) return null;
  const c = line.charCodeAt(ci);
  if (c >= 0xDC00 && c <= 0xDFFF) return null; /* second half of a surrogate pair */
  const cp = line.codePointAt(ci), ch = String.fromCodePoint(cp);
  return /\s/.test(ch) ? null : { li, ci, ch };
}
function norm(ly) {
  try {
    if (!isObj(ly)) return emptyLy();
    const text = normText(ly.text);
    const out = emptyLy();
    out.text = text;
    out.at = typeof ly.at === 'number' && isFinite(ly.at) && ly.at > 0 ? Math.floor(ly.at) : 0;
    const own = [];
    const addOwn = n => { if (!n) return false; if (own.includes(n)) return true; if (own.length >= MAX_OWN + MAX_OLD) return false; own.push(n); return true; };
    if (Array.isArray(ly.own)) ly.own.forEach(n => addOwn(ownName(n)));
    /* a stored id -> a built-in id, or a custom one (a removed technique keeps its old name); null = garbage */
    const markId = id => {
      if (!isStr(id)) return null;
      if (id in BY) return id;
      const n = id in OLD ? OLD[id] : isOwnId(id) ? ownName(id.slice(2)) : '';
      return addOwn(n) ? 'u:' + n : null;
    };
    const raw = {};
    if (text) {
      const L = text.split('\n');
      if (isObj(ly.m)) for (const k of Object.keys(ly.m)) {
        const a = ly.m[k], c = charAtKey(L, k);
        if (!Array.isArray(a) || !c) continue;
        const t = `${c.li}.${c.ci}`; /* "01.2" and "1.2" are the same spot */
        raw[t] = Array.from(new Set(a.map(markId).filter(Boolean).concat(raw[t] || [])));
      }
      if (isObj(ly.p)) for (const k of Object.keys(ly.p)) {
        const c = charAtKey(L, k);
        if (!c || !isStr(ly.p[k])) continue;
        const v = clipChars(ly.p[k].trim(), MAX_PRON);
        if (v && v !== c.ch) out.p[`${c.li}.${c.ci}`] = v;
      }
      if (isObj(ly.n)) for (const k of Object.keys(ly.n)) {
        if (!/^\d{1,3}$/.test(k) || +k >= L.length || !L[+k] || !isStr(ly.n[k])) continue;
        const v = clipChars(ly.n[k].trim(), MAX_MEMO);
        if (v) out.n[+k] = v;
      }
    }
    const ord = mkOrd(own);
    for (const t of Object.keys(raw)) if (raw[t].length) out.m[t] = raw[t].sort(ord);
    out.own = own;
    if (Array.isArray(ly.heard)) out.heard = Array.from(new Set(ly.heard.map(id => {
      if (!isStr(id)) return null;
      if (id in BY) return id;
      const n = isOwnId(id) ? ownName(id.slice(2)) : '';
      return n && own.includes(n) ? 'u:' + n : null;
    }).filter(Boolean))).sort(ord);
    return out;
  } catch (e) { return emptyLy(); }
}
/* number of syllable marks (built-in and own) + pronunciation overrides */
function count(ly) {
  let n = 0;
  if (!isObj(ly)) return 0;
  if (isObj(ly.m)) for (const k of Object.keys(ly.m)) n += Array.isArray(ly.m[k]) ? ly.m[k].length : 0;
  if (isObj(ly.p)) n += Object.keys(ly.p).length;
  return n;
}
/* old char index -> new char index inside an edited line, or -1 when that spot no longer holds the same character */
function mapIndex(a, b, ci) {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  let ni = -1;
  if (ci < pre) ni = ci;
  else if (ci >= a.length - suf) ni = ci + (b.length - a.length);
  else if (ci < b.length - suf && a[ci] === b[ci]) ni = ci;
  return ni >= 0 && ni < b.length && a[ci] === b[ni] ? ni : -1;
}
/* move marks / pronunciations / memos to the edited text: unchanged lines by an LCS over lines,
   changed lines (between matched neighbours) keep only the spots whose character is still the same */
function remap(oldText, newText, ly) {
  try {
    const base = norm(Object.assign({}, isObj(ly) ? ly : {}, { text: isStr(oldText) ? oldText : '' }));
    const A = base.text ? base.text.split('\n') : [], B = lines(newText);
    const res = { text: B.join('\n'), m: {}, p: {}, n: {}, own: base.own, heard: base.heard, at: base.at };
    const ord = mkOrd(base.own);
    const n = A.length, mm = B.length, w = mm + 1;
    const dp = new Uint16Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) for (let j = mm - 1; j >= 0; j--)
      dp[i * w + j] = A[i] === B[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    const exact = new Map(); /* old line -> new line */
    for (let i = 0, j = 0; i < n && j < mm;) {
      if (A[i] === B[j]) { exact.set(i, j); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
      else j++;
    }
    const pair = new Map(exact); /* old line -> new line, incl. changed lines paired position by position */
    let pi = -1, pj = -1;
    const gap = (i1, j1) => { for (let k = 1; pi + k < i1 && pj + k < j1; k++) pair.set(pi + k, pj + k); };
    for (const [i, j] of exact) { gap(i, j); pi = i; pj = j; }
    gap(n, mm);
    const put = (li, ci, kind, val) => {
      const t = `${li}.${ci}`;
      if (kind === 'm') res.m[t] = Array.from(new Set((res.m[t] || []).concat(val))).sort(ord); /* two old spots never overwrite each other */
      else if (!res.p[t]) res.p[t] = val;
    };
    const move = (src, kind) => {
      for (const k of Object.keys(src)) {
        const c = charAtKey(A, k);
        if (!c || !pair.has(c.li)) continue;
        const nl = pair.get(c.li);
        const ci = exact.has(c.li) ? c.ci : mapIndex(A[c.li], B[nl], c.ci);
        if (ci >= 0) put(nl, ci, kind, src[k]);
      }
    };
    move(base.m, 'm');
    move(base.p, 'p');
    for (const k of Object.keys(base.n)) if (pair.has(+k)) res.n[pair.get(+k)] = base.n[k];
    return norm(res);
  } catch (e) { return norm({ text: newText }); }
}
/* plain-text version for copying: each line, then what is marked on it */
function noteText(ly, head) {
  ly = norm(ly);
  const L = ly.text ? ly.text.split('\n') : [];
  const out = head ? [head, ''] : [];
  L.forEach((line, li) => {
    out.push(line);
    const by = Object.create(null), parts = [];
    Object.keys(ly.m).forEach(k => {
      const c = charAtKey(L, k);
      if (!c || c.li !== li) return;
      ly.m[k].forEach(id => { (by[id] = by[id] || []).push(c); });
    });
    TECHS.map(t => t.id).concat(ly.own.map(n => 'u:' + n)).forEach(id => {
      if (by[id]) parts.push(`${techOf(id).name}: '${by[id].sort((a, b) => a.ci - b.ci).map(c => c.ch).join('')}'`);
    });
    const pr = Object.keys(ly.p).map(k => charAtKey(L, k)).filter(c => c && c.li === li).sort((a, b) => a.ci - b.ci).map(c => `${c.ch}→${ly.p[`${li}.${c.ci}`]}`);
    if (pr.length) parts.push(`발음: ${pr.join(', ')}`);
    if (ly.n[li]) parts.push(`메모: ${ly.n[li]}`);
    if (parts.length) out.push(`  └ ${parts.join(', ')}`);
  });
  return out.join('\n');
}

/* ================= UI ================= */
const TOOLS = [
  { id: 'view', label: '보기', desc: '' },
  { id: 'pron', label: '발음', desc: '발음을 고칠 글자를 눌러요. 예: ‘의’를 ‘에’로.' },
  { id: 'memo', label: '메모', desc: '메모를 달 줄을 눌러요.' },
  { id: 'erase', label: '지우개', desc: '글자를 누르면 그 글자의 표시와 발음이 모두 지워져요.' }
];
let restOpen = false; /* remembered until the app reloads */

function open({ key, title, artist }) {
  const U = window.SDUI;
  if (!U || !key) return;
  const { h, icon, openSheet, closeSheet, confirmSheet, toast, haptic, autoTA, field, segBtn, bindEnter, guardUnsaved } = U;
  title = title || '';
  let ly = norm(U.songMeta(key).ly);
  let tool = 'view', tab = 'note', editing = !ly.text, curTA = null, obj = null;
  let paper = null, panel = null, tools = null, techs = null, descEl = null, toolBtns = new Map(), held = false;
  const rov = new Map(); /* line -> char index of the one syllable that is tabbable in that line */

  /* a technique that can be marked right now: built-in, or one of this song's own */
  const known = id => (typeof id === 'string' && id in BY) || (isOwnId(id) && ly.own.includes(id.slice(2)));
  const curTech = () => (known(tool) ? techOf(tool) : null);

  /* ---- saving ---- */
  const commit = () => {
    ly.at = Date.now();
    U.songMeta(key).ly = ly; /* an emptied note stays as { text: '', at } so a merge with an older copy doesn't bring it back */
    U.save();
  };
  /* cloud sync can replace the song's note while this sheet is open: take the newer copy before changing anything */
  const fresh = () => {
    const cur = U.songMeta(key).ly;
    if (!cur || cur === ly || !((+cur.at || 0) > ly.at)) return false;
    ly = norm(cur);
    rov.clear();
    if (tool !== 'view' && !TOOLS.some(t => t.id === tool) && !known(tool)) tool = 'view';
    if (!editing) { if (!ly.text) editing = true; draw(); }
    return true;
  };
  const liOf = k => +String(k).split('.')[0];
  const valid = (k, ch) => { const c = ly.text && charAtKey(ly.text.split('\n'), k); return !!c && c.ch === ch; };

  const root = h('div', { class: 'ly' });
  const footEl = h('div', { class: 'ly-foot' });
  const techColor = id => 'lg-' + techOf(id).group;
  const symEl = (id, cls) => h('span', { class: `ly-sym ${techColor(id)}${cls ? ' ' + cls : ''}`, 'aria-hidden': 'true' }, techOf(id).sym);

  /* ---- no lyrics yet / editing the lyrics ---- */
  const drawEdit = () => {
    const first = !ly.text;
    const ta = autoTA({ class: 'input lined ly-ta', value: ly.text, maxlength: MAX_TEXT, placeholder: '가사를 붙여 넣어 주세요', 'aria-label': '가사', spellcheck: 'false', 'data-autofocus': '' }, 220);
    curTA = ta;
    const cnt = h('span', { class: 'hint ly-count' });
    const paintCnt = () => { cnt.textContent = `${lines(ta.value).length}줄 · ${ta.value.length}/${MAX_TEXT}자`; };
    ta.addEventListener('input', paintCnt);
    paintCnt();
    const hint = first ? '한 줄에 한 소절씩. 가사는 폰 안에만 저장되고 계정 동기화 시 내 계정에만 올라가요'
      : '그대로인 줄의 표시는 유지돼요. 글자를 고친 줄은 같은 자리의 같은 글자에만 표시가 남아요.';
    const find = h('button', { class: 'btn ghost sm', 'data-fk': 'ly-find', onclick: () => U.openUrl('https://www.google.com/search?q=' + encodeURIComponent([title, artist, '가사'].filter(Boolean).join(' '))) }, icon('search', 16), '가사 찾기');
    root.replaceChildren(...[field(first ? '가사' : '가사 고치기', ta, hint), h('div', { class: 'ly-edit-row' }, cnt, h('span', { class: 'sp' }), find),
      first ? null : h('button', { class: 'btn ghost sm danger', onclick: () => confirmSheet({ title: '가사를 지울까요?', text: '이 곡의 가사와 모든 표시, 발음, 메모가 지워져요.', ok: '지우기', danger: true, onOk: () => { fresh(); ly = emptyLy(); rov.clear(); commit(); editing = true; draw(); } }) }, icon('trash', 16), '가사 전체 지우기')].filter(Boolean));
    const save = () => {
      fresh();
      const nl = lines(ta.value);
      if (!nl.length) { toast('가사를 적어 주세요'); return; }
      const text = nl.join('\n');
      const cut = nl.length >= MAX_LINES && ta.value.split(/\r\n|\r|\n/).length > MAX_LINES;
      if (text === ly.text) { editing = false; draw(); return; }
      let msg = '';
      if (!ly.text) ly = norm({ text, own: ly.own, heard: ly.heard });
      else {
        const before = count(ly);
        const next = remap(ly.text, text, ly);
        const dropped = before - count(next);
        ly = next;
        if (dropped > 0) msg = `바뀐 줄의 표시 ${dropped}개를 지웠어요`;
      }
      commit();
      editing = false; tab = 'note';
      draw();
      if (msg) toast(msg);
      else if (cut) toast(`${MAX_LINES}줄까지만 담았어요`);
    };
    footEl.className = 'ly-foot';
    footEl.replaceChildren(...(first
      ? [h('button', { class: 'btn ink', 'data-fk': 'ly-show', onclick: save }, '노트에 띄우기')]
      : [h('button', { class: 'btn soft', onclick: () => { editing = false; draw(); } }, '취소'), h('button', { class: 'btn ink', 'data-fk': 'ly-save', onclick: save }, '저장')]));
  };

  /* ---- notebook: lyrics on top, the tools in a slim bar pinned at the bottom ---- */
  const paintDesc = () => {
    const t = curTech(), m = TOOLS.find(x => x.id === tool);
    const text = t ? `${t.name} — ${t.desc}` : (m && m.desc) || '';
    descEl.textContent = text;
    descEl.hidden = !text;
  };
  /* keep the selected chip fully inside the scrolling row */
  const reveal = b => {
    if (!techs || !b || !techs.contains(b)) return;
    const r = b.getBoundingClientRect(), q = techs.getBoundingClientRect();
    if (r.left < q.left + 20) techs.scrollLeft += r.left - q.left - 20;
    else if (r.right > q.right - 20) techs.scrollLeft += r.right - q.right + 20;
  };
  const paintBar = () => {
    toolBtns.forEach((b, id) => b.setAttribute('aria-pressed', String(id === tool)));
    paintDesc();
    reveal(toolBtns.get(tool));
  };
  const selectTool = id => { fresh(); tool = id; paintBar(); paintPaper(); };
  const drawBar = () => {
    toolBtns = new Map();
    const modes = TOOLS.map(t => {
      const b = h('button', { 'aria-pressed': String(t.id === tool), 'data-fk': 'ly-tool-' + t.id, onclick: () => selectTool(t.id) }, t.label);
      toolBtns.set(t.id, b);
      return b;
    });
    const chip = id => {
      const t = techOf(id), mine = isOwnId(id);
      const b = h('button', { class: 'chip sm ly-chip' + (mine ? ' ly-own' : ''), 'aria-pressed': String(id === tool), 'data-fk': 'ly-tool-' + id, title: mine ? '길게 누르면 지울 수 있어요' : null,
        onclick: () => { if (held) { held = false; return; } selectTool(id); } }, symEl(id), t.name);
      if (mine) holdOwn(b, t.name);
      toolBtns.set(id, b);
      return b;
    };
    const items = TECHS.map(t => chip(t.id)).concat(ly.own.map(n => chip('u:' + n)));
    items.push(h('button', { class: 'chip sm ly-chip ly-add', 'data-fk': 'ly-add', onclick: openAdd }, '+ 직접 적기'));
    techs = h('div', { class: 'ly-techs', role: 'group', 'aria-label': '기교' }, items);
    tools = h('div', { class: 'ly-tools', role: 'toolbar', 'aria-label': '표시 도구' },
      h('div', { class: 'seg ly-modes', role: 'group', 'aria-label': '표시 방식' }, modes), techs);
    descEl = h('p', { class: 'ly-desc', 'aria-live': 'polite' });
    footEl.className = 'ly-foot ly-bar';
    footEl.replaceChildren(descEl, tools);
    paintBar();
  };
  /* press and hold one of the song's own chips to remove it */
  const holdOwn = (b, name) => {
    let tm = 0;
    const stop = () => { clearTimeout(tm); tm = 0; };
    b.addEventListener('pointerdown', () => { stop(); held = false; tm = setTimeout(() => { tm = 0; held = true; haptic(12); removeOwn(name); }, 600); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
    b.addEventListener('contextmenu', ev => ev.preventDefault());
  };
  const openAdd = () => {
    let s = null;
    const inp = h('input', { class: 'input', maxlength: MAX_OWN_LEN, placeholder: '예: 가성 섞기', 'aria-label': '직접 적을 기교 이름', 'data-fk': 'ly-own-name', 'data-autofocus': '', autocomplete: 'off', spellcheck: 'false' });
    const done = () => {
      fresh();
      const v = ownName(inp.value);
      if (!v) { toast('이름을 적어 주세요'); return; }
      if (ly.own.includes(v) || TECHS.some(t => t.name === v)) { toast('이미 있는 기교예요'); return; }
      if (ly.own.length >= MAX_OWN) { toast(`직접 적은 기교는 ${MAX_OWN}개까지예요`); return; }
      closeSheet(s, true);
      ly.own = ly.own.concat(v);
      tool = 'u:' + v;
      commit();
      if (editing || tab !== 'note') { tab = 'note'; editing = false; }
      draw();
    };
    bindEnter(inp, done);
    s = openSheet({
      title: '직접 적기',
      body: h('div', null, field('기교 이름', inp, `1~${MAX_OWN_LEN}글자, 곡마다 ${MAX_OWN}개까지. 적으면 표시 도구로 쓸 수 있어요.`)),
      foot: [h('button', { class: 'btn soft', onclick: () => closeSheet(s, true) }, '취소'), h('button', { class: 'btn ink', 'data-fk': 'ly-own-add', onclick: done }, '추가')]
    });
  };
  /* drop one of the song's own techniques and every mark made with it */
  const removeOwn = (name, after) => {
    fresh();
    const id = 'u:' + name;
    if (!ly.own.includes(name)) return;
    const n = Object.keys(ly.m).filter(k => ly.m[k].includes(id)).length;
    confirmSheet({ title: `‘${name}’ 기교를 없앨까요?`, text: n ? `가사에 단 표시 ${n}곳도 함께 지워져요.` : '가사에 단 표시는 없어요.', ok: '없애기', danger: true, onOk: () => {
      fresh();
      ly.own = ly.own.filter(x => x !== name);
      Object.keys(ly.m).forEach(k => { const next = ly.m[k].filter(x => x !== id); if (next.length) ly.m[k] = next; else delete ly.m[k]; });
      ly.heard = ly.heard.filter(x => x !== id);
      if (tool === id) tool = 'view';
      commit();
      if (after) after();
      draw();
    } });
  };

  const sylBtn = (li, ci, ch) => {
    const k = `${li}.${ci}`, ms = ly.m[k] || [], pr = ly.p[k];
    const rest = ms.filter(id => id !== 'breath');
    const shown = rest.length > 3 ? rest.slice(0, 2) : rest;
    const top = h('span', { class: 'ly-top' },
      pr ? h('span', { class: 'ly-pr' }, pr) : null,
      shown.map(id => h('span', { class: `ly-mk ${techColor(id)}${id === tool ? ' cur' : ''}` }, techOf(id).sym)),
      rest.length > shown.length ? h('span', { class: 'ly-mk ly-n' }, `+${rest.length - shown.length}`) : null);
    const label = ch + (pr ? `, 발음 ${pr}` : '') + (ms.length ? ', ' + ms.map(id => techOf(id).name).join(', ') : '');
    return h('button', { class: 'ly-syl' + (ms.includes('breath') ? ' has-br' : '') + (curTech() && ms.includes(tool) ? ' on' : '') + (pr ? ' has-pr' : ''), 'data-k': k, tabindex: -1, 'aria-label': label },
      top, h('span', { class: 'ly-ch' }, ch),
      ms.includes('breath') ? h('span', { class: `ly-br ${techColor('breath')}${tool === 'breath' ? ' cur' : ''}`, 'aria-hidden': 'true' }, BY.breath.sym) : null);
  };
  const lineEl = (li, line) => {
    if (!line) return h('div', { class: 'ly-gap', 'aria-hidden': 'true' });
    const words = [];
    let w = null;
    for (let ci = 0; ci < line.length;) {
      const cp = line.codePointAt(ci), ch = String.fromCodePoint(cp);
      if (/\s/.test(ch)) w = null;
      else {
        if (!w) { w = h('span', { class: 'ly-w' }); words.push(w); }
        w.append(/[\p{L}\p{N}]/u.test(ch) ? sylBtn(li, ci, ch) : h('span', { class: 'ly-p' }, ch));
      }
      ci += ch.length;
    }
    const el = h('div', { class: 'ly-line', 'data-li': li }, h('div', { class: 'ly-wl' }, words),
      ly.n[li] ? h('div', { class: 'ly-memo' }, ly.n[li]) : null);
    const sy = el.querySelectorAll('.ly-syl');
    if (sy.length) (el.querySelector(`[data-k="${li}.${rov.get(li)}"]`) || sy[0]).tabIndex = 0; /* roving tabindex: one stop per line */
    return el;
  };
  const paintPaper = () => {
    const L = ly.text ? ly.text.split('\n') : [];
    paper.classList.toggle('focus', !!curTech());
    paper.replaceChildren(...L.map((line, li) => lineEl(li, line)));
  };
  /* a tap changes one line: rebuild only that one */
  const paintLine = li => {
    const L = ly.text ? ly.text.split('\n') : [], old = paper.children[li];
    if (!old || paper.children.length !== L.length || L[li] === undefined) { paintPaper(); return; }
    old.replaceWith(lineEl(li, L[li]));
  };
  const refocus = k => { const b = k && paper.querySelector(`[data-k="${k}"]`); if (b) b.focus({ preventScroll: true }); };
  const onPaperKey = ev => {
    const b = ev.target.closest && ev.target.closest('.ly-syl');
    if (!b || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(ev.key)) return;
    const ln = b.closest('.ly-line'), row = Array.from(ln.querySelectorAll('.ly-syl')), ix = row.indexOf(b);
    const sib = dir => { let e = ln; while ((e = dir < 0 ? e.previousElementSibling : e.nextElementSibling)) if (e.querySelector('.ly-syl')) return Array.from(e.querySelectorAll('.ly-syl')); return null; };
    let to = null, o;
    if (ev.key === 'ArrowRight') to = row[ix + 1] || ((o = sib(1)) && o[0]);
    else if (ev.key === 'ArrowLeft') to = row[ix - 1] || ((o = sib(-1)) && o[o.length - 1]);
    else if (ev.key === 'ArrowDown') to = (o = sib(1)) && o[Math.min(ix, o.length - 1)];
    else if (ev.key === 'ArrowUp') to = (o = sib(-1)) && o[Math.min(ix, o.length - 1)];
    else to = ev.key === 'Home' ? row[0] : row[row.length - 1];
    ev.preventDefault();
    if (to) to.focus();
  };
  const onPaperFocus = ev => {
    const b = ev.target.closest && ev.target.closest('.ly-syl');
    if (!b) return;
    const ln = b.closest('.ly-line'), cur = ln.querySelector('.ly-syl[tabindex="0"]');
    if (cur && cur !== b) cur.tabIndex = -1;
    b.tabIndex = 0;
    rov.set(+ln.dataset.li, +b.dataset.k.split('.')[1]);
  };

  const tapSyl = k => {
    fresh();
    const c = ly.text && charAtKey(ly.text.split('\n'), k);
    if (!c) return;
    if (curTech()) {
      const cur = (ly.m[k] || []).slice(), ix = cur.indexOf(tool);
      if (ix >= 0) cur.splice(ix, 1); else { cur.push(tool); cur.sort(mkOrd(ly.own)); }
      if (cur.length) ly.m[k] = cur; else delete ly.m[k];
      haptic(8); commit(); paintLine(c.li); refocus(k);
    } else if (tool === 'pron') openPron(k, c.ch);
    else if (tool === 'memo') openMemo(c.li);
    else if (tool === 'erase') {
      if (!ly.m[k] && !ly.p[k]) { toast('지울 표시가 없어요'); return; }
      delete ly.m[k]; delete ly.p[k];
      haptic(8); commit(); paintLine(c.li); refocus(k);
    } else openView(k, c.ch);
  };

  const openPron = (k, ch) => {
    let s = null;
    const inp = h('input', { class: 'input', value: ly.p[k] || ch, maxlength: MAX_PRON, 'aria-label': `‘${ch}’ 발음`, 'data-autofocus': '', autocomplete: 'off', spellcheck: 'false' });
    const done = v => {
      v = clipChars(v.trim(), MAX_PRON);
      fresh();
      closeSheet(s, true);
      if (!valid(k, ch)) { toast('가사가 바뀌어 저장하지 못했어요'); return; }
      if (!v || v === ch) delete ly.p[k]; else ly.p[k] = v;
      commit(); paintLine(liOf(k)); refocus(k);
    };
    bindEnter(inp, () => done(inp.value));
    s = openSheet({
      title: `발음 고치기 · ‘${ch}’`,
      body: h('div', null, field('이 글자를 이렇게 불러요', inp, `예: ‘의’를 ‘에’로, ‘을’을 ‘얼’로 (${MAX_PRON}글자까지)`)),
      foot: [h('button', { class: 'btn soft', onclick: () => done('') }, '원래대로'), h('button', { class: 'btn ink', onclick: () => done(inp.value) }, '저장')]
    });
  };
  const openMemo = li => {
    let s = null;
    const ta = autoTA({ class: 'input lined', value: ly.n[li] || '', maxlength: MAX_MEMO, placeholder: '예: 여기서 숨을 크게, 끝은 힘 빼기', 'aria-label': '줄 메모', 'data-autofocus': '' }, 94);
    const done = v => {
      v = clipChars(v.trim(), MAX_MEMO);
      fresh();
      closeSheet(s, true);
      if (!(ly.text && ly.text.split('\n')[li])) { toast('가사가 바뀌어 저장하지 못했어요'); return; }
      if (v) ly.n[li] = v; else delete ly.n[li];
      commit(); paintLine(li);
    };
    s = openSheet({
      title: `${li + 1}번째 줄 메모`,
      body: h('div', null, h('p', { class: 'hint ly-quote' }, ly.text.split('\n')[li]), field('이 줄에서 기억할 것', ta, `${MAX_MEMO}자까지`)),
      foot: [ly.n[li] ? h('button', { class: 'btn soft', onclick: () => done('') }, '메모 지우기') : null, h('button', { class: 'btn ink', onclick: () => done(ta.value) }, '저장')]
    });
  };
  const openView = (k, ch) => {
    let s = null;
    const list = h('div', { class: 'ly-vlist' });
    const draw1 = () => {
      const cur = ly.m[k] || [];
      list.replaceChildren(...(cur.length ? cur.map(id => { const t = techOf(id); return h('div', { class: 'ly-vrow' },
        symEl(id, 'big'),
        h('div', { class: 'ly-vt' }, h('b', null, t.name), h('span', { class: 'hint' }, t.desc),
          isOwnId(id) ? h('button', { class: 'ly-vdel', 'aria-label': `${t.name} 기교 삭제`, onclick: () => removeOwn(t.name, () => closeSheet(s, true)) }, icon('x', 12), '기교 삭제') : null),
        h('button', { class: 'icon-btn', 'aria-label': `${t.name} 표시 지우기`, onclick: () => {
          fresh();
          if (!valid(k, ch)) { closeSheet(s, true); return; }
          const next = (ly.m[k] || []).filter(x => x !== id);
          if (next.length) ly.m[k] = next; else delete ly.m[k];
          haptic(8); commit(); paintLine(liOf(k)); refocus(k); draw1();
        } }, icon('x', 18))); }) : [h('p', { class: 'hint' }, '붙어 있는 표시가 없어요. 아래에서 기교를 고르고 글자를 눌러 보세요.')]),
      ly.p[k] ? h('p', { class: 'ly-vp' }, `발음: ${ch} → `, h('b', null, ly.p[k])) : null);
    };
    draw1();
    s = openSheet({
      title: `‘${ch}’ 표시`,
      body: list,
      foot: [h('button', { class: 'btn soft', onclick: () => { closeSheet(s, true); selectTool('pron'); openPron(k, ch); } }, '발음 고치기'), h('button', { class: 'btn ink', onclick: () => closeSheet(s, true) }, '닫기')]
    });
  };

  /* ---- 들으며 체크하기 ---- */
  const gotoTool = id => {
    fresh();
    tab = 'note'; tool = known(id) ? id : 'view';
    draw();
    obj.sheet.querySelector('.sheet-body').scrollTop = 0;
  };
  const paintCheck = () => {
    const all = TECHS.map(t => t.id).concat(ly.own.map(n => 'u:' + n));
    const counts = {};
    Object.keys(ly.m).forEach(k => ly.m[k].forEach(id => { counts[id] = (counts[id] || 0) + 1; }));
    const used = all.filter(id => counts[id]), pool = used.length ? used : all;
    const heard = new Set(ly.heard.filter(id => pool.includes(id))), next = pool.find(id => !heard.has(id));
    const total = pool.length;
    const prog = h('div', { class: 'ly-prog' },
      h('div', { class: 'ly-prog-n' }, h('b', null, `다 들었어요 ${heard.size} / ${total}`), used.length ? h('span', { class: 'hint' }, ' · 이 곡에 쓴 기교 기준') : null),
      h('div', { class: 'ly-trk', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(heard.size), 'aria-label': '들어 본 기교' }, h('i', { style: `width:${Math.round(heard.size / total * 100)}%` })),
      h('p', { class: 'ly-prog-t' }, next ? `중요한 것부터 하나씩: 이번엔 ‘${techOf(next).name}’만 들어 보세요` : (used.length ? `이 곡에 쓴 ${total}가지를 모두 들어 봤어요. 다시 듣고 싶은 기교는 이름을 눌러 보세요.` : `${all.length}가지를 모두 들어 봤어요. 다시 듣고 싶은 기교는 이름을 눌러 보세요.`)),
      next ? h('button', { class: 'btn blue sm', 'data-fk': 'ly-go-next', onclick: () => gotoTool(next) }, `‘${techOf(next).name}’ 표시하러 가기`) : null,
      h('p', { class: 'hint' }, '체크 칸은 ‘이것만 들으며 한 번 들었어요’ 표시예요. 가사에 체크한 표시를 보면서 한 가지씩 집중해서 들어요.'));
    const rowOf = (id, i) => {
      const t = techOf(id), on = heard.has(id), fk = 'ly-heard-' + id;
      const ck = h('input', { type: 'checkbox', checked: on, 'aria-label': `${t.name} — 이것만 들으며 한 번 들었어요`, 'data-fk': fk, onchange: () => {
        const want = ck.checked;
        fresh();
        const s = new Set(ly.heard);
        if (want) s.add(id); else s.delete(id);
        ly.heard = Array.from(s).sort(mkOrd(ly.own));
        commit(); paintCheck();
        const again = Array.from(panel.querySelectorAll('[data-fk]')).find(e => e.dataset.fk === fk);
        if (again) again.focus({ preventScroll: true });
      } });
      return h('div', { class: 'ly-row' + (on ? ' done' : '') + (next === id ? ' next' : '') },
        h('label', { class: 'ly-ck', title: '이것만 들으며 한 번 들었어요' }, ck),
        h('button', { class: 'ly-rn', 'data-fk': 'ly-pick-' + id, onclick: () => gotoTool(id) },
          h('span', { class: 'ly-rt' }, h('span', { class: 'ly-rk' }, i + 1), symEl(id, 'big'), h('b', null, t.name),
            h('span', { class: 'ly-cnt' }, counts[id] ? `${counts[id]}곳` : '표시 없음'), next === id ? h('span', { class: 'ly-now' }, '지금 차례') : null),
          h('span', { class: 'ly-rd' }, t.desc)));
    };
    const restList = used.length ? all.filter(id => !counts[id]) : [];
    const restBox = restList.length ? h('details', { class: 'ly-rest', 'data-fk': 'ly-rest' }, h('summary', null, `나머지 기교 ${restList.length}가지`), ...restList.map(id => rowOf(id, all.indexOf(id)))) : null;
    if (restBox && restOpen) restBox.open = true;
    if (restBox) restBox.addEventListener('toggle', () => { restOpen = restBox.open; });
    const rows = pool.map(id => rowOf(id, all.indexOf(id)));
    panel.replaceChildren(prog, ...(used.length ? [h('p', { class: 'ly-sec' }, `이 곡에 쓴 기교 ${used.length}가지`)] : []), ...rows, restBox,
      h('div', { class: 'ly-reset' }, h('button', { class: 'btn ghost sm', disabled: !ly.heard.length, onclick: () => confirmSheet({ title: '체크를 초기화할까요?', text: '‘들었어요’ 체크만 모두 지워져요. 가사에 단 표시는 그대로예요.', ok: '초기화', danger: true, onOk: () => { ly.heard = []; commit(); paintCheck(); } }) }, icon('undo', 16), '체크 초기화')));
  };

  const copyText = () => {
    const text = noteText(ly, [title, artist].filter(Boolean).join(' - '));
    const done = ok => toast(ok ? '가사 노트를 복사했어요' : '복사하지 못했어요. 길게 눌러 직접 복사해 주세요');
    const fallback = () => {
      let ok = false;
      const ta = h('textarea', { readonly: '', style: 'position:fixed;left:-9999px;top:0;opacity:0' }, text);
      document.body.append(ta);
      try { ta.select(); ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      done(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback);
    else fallback();
  };

  const drawNote = () => {
    const sync = n => { fresh(); tab = n; draw(); obj.sheet.querySelector('.sheet-body').scrollTop = 0; };
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': '가사 노트 보기' },
      segBtn('노트', tab === 'note', () => { if (tab !== 'note') sync('note'); }, 'ly-tab-note'),
      segBtn('들으며 체크', tab === 'check', () => { if (tab !== 'check') sync('check'); }, 'ly-tab-check'));
    const acts = h('div', { class: 'ly-acts' },
      h('button', { class: 'icon-btn', 'data-fk': 'ly-edit', 'aria-label': '가사 고치기', title: '가사 고치기', onclick: () => { editing = true; draw(); obj.sheet.querySelector('.sheet-body').scrollTop = 0; } }, icon('edit', 19)),
      h('button', { class: 'icon-btn', 'data-fk': 'ly-copy', 'aria-label': '복사', title: '노트를 글로 복사', onclick: copyText }, icon('copy', 19)));
    const head = h('div', { class: 'ly-head' }, seg, acts);
    paper = null; panel = null; descEl = null; tools = null; techs = null;
    if (tab === 'note') {
      paper = h('div', { class: 'ly-paper' });
      paper.addEventListener('keydown', onPaperKey);
      paper.addEventListener('focusin', onPaperFocus);
      paper.addEventListener('click', ev => {
        const b = ev.target.closest('.ly-syl');
        if (b) { tapSyl(b.dataset.k); return; }
        const ln = ev.target.closest('.ly-line');
        if (ln && tool === 'memo') openMemo(+ln.dataset.li);
      });
      root.replaceChildren(head, paper);
      drawBar(); paintPaper();
    } else {
      panel = h('div', { class: 'ly-check' });
      root.replaceChildren(head, panel);
      paintCheck();
      footEl.className = 'ly-foot none';
      footEl.replaceChildren();
    }
  };

  const draw = () => { curTA = null; if (editing) drawEdit(); else drawNote(); };
  draw();
  obj = openSheet({
    title: `가사 노트 · ${title}`, full: true, body: root, foot: footEl,
    beforeClose: () => !(editing && curTA) || guardUnsaved(() => curTA.value.trim() !== ly.text.trim(), () => closeSheet(obj, true)),
    onClose: () => { if (U.flush) U.flush(); }
  });
  return obj;
}

window.LyricNote = { TECHS, norm, lines, remap, count, noteText, open };
})();
