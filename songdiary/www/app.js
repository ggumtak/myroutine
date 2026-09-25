(function () {
'use strict';

/* ================= utilities ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let val;
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') val = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'disabled' || k === 'hidden' || k === 'checked' || k === 'readOnly' || k === 'multiple') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false || kid === true) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  if (val !== undefined) el.value = val;
  return el;
}
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const isDateKey = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const fmtMD = s => { const d = parseYmd(s); const y = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}년 ` : ''; return `${y}${d.getMonth() + 1}월 ${d.getDate()}일`; };
const fmtMDW = s => `${fmtMD(s)} ${WD[parseYmd(s).getDay()]}요일`;
const dowClass = s => { const w = parseYmd(s).getDay(); return w === 0 ? ' sun' : w === 6 ? ' sat' : ''; };
const fmtDur = sec => { sec = Math.max(0, Math.round(sec || 0)); return `${Math.floor(sec / 60)}:${pad(sec % 60)}`; };
const fmtMin = m => { m = Math.round(m || 0); return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ' ' + (m % 60) + '분' : ''}` : `${m}분`; };
const fmtSec = s => `${(+s).toFixed(1)}초`;
const fmtMB = b => b >= 1073741824 ? (b / 1073741824).toFixed(1) + 'GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round((b || 0) / 1024)) + 'KB';
const fmtHM = ts => { const d = new Date(ts); const hh = d.getHours(); return `${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${pad(d.getMinutes())}`; };
const fmtClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`; };
const normKey = t => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
const uid = p => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clampInt = (v, lo, hi, d) => { v = parseInt(v, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); };
function debounce(fn, ms) { let t = 0; const f = () => { clearTimeout(t); t = setTimeout(fn, ms); }; f.flush = () => { if (t) { clearTimeout(t); t = 0; fn(); } }; return f; }
const vibrate = p => { if (S.settings && S.settings.haptic === false) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* not supported */ } };
const haptic = vibrate;
function lsGet(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

const IC = {
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3"/>',
  upload: '<path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M5 15v4.5h14V15"/>',
  play: '<path d="M8.5 5.8v12.4a.6.6 0 00.9.5l9.8-6.2a.6.6 0 000-1l-9.8-6.2a.6.6 0 00-.9.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.8-5 2.8 1-5.6-4.1-3.9 5.6-.7z"/>',
  more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  pin: '<path d="M9.5 4h5l-.8 5.2 2.8 2.8V14h-9v-2l2.8-2.8z"/><path d="M12 14v6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V10M10 3h4M18.3 6.7l1.4-1.4"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
  mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 10l4 4M20 10l-4 4"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  down: '<path d="M12 4.5V15M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0014 4.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  dn: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  flag: '<path d="M6 21V4.5M6 5h10.5l-2 3.8 2 3.7H6"/>',
  back5: '<path d="M4.5 12a7.5 7.5 0 107.5-7.5H8.5"/><path d="M10.5 2l-2.5 2.5L10.5 7"/>',
  fwd5: '<path d="M19.5 12A7.5 7.5 0 1112 4.5h3.5"/><path d="M13.5 2l2.5 2.5L13.5 7"/>',
  repeat: '<path d="M4.5 11V9a3 3 0 013-3h11M15.5 3l3 3-3 3M19.5 13v2a3 3 0 01-3 3h-11M8.5 21l-3-3 3-3"/>',
  share: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2 2 0 004 0"/>',
  vibe: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 8.5v7M19.5 8.5v7"/>',
  save: '<path d="M5 4.5h11l3 3v12H5z"/><path d="M8.5 4.5v5h6v-5M8.5 19.5v-5h7v5"/>',
  expand: '<path d="M14.5 4.5h5v5M9.5 19.5h-5v-5M19.5 4.5l-6 6M4.5 19.5l6-6"/>',
  send: '<path d="M20.5 3.5L10 14M20.5 3.5l-6.5 17-4-6.5-6.5-4z"/>',
  chevd: '<path d="M6 9l6 6 6-6"/>',
  chevu: '<path d="M6 15l6-6 6 6"/>',
  undo: '<path d="M9 7.5L4.5 12 9 16.5"/><path d="M4.5 12h10a5 5 0 010 10h-2"/>',
  book: '<path d="M5 5.5a2 2 0 012-2h12v14H7a2 2 0 00-2 2z"/><path d="M5 19.5a2 2 0 002 2h12v-4"/><path d="M9 8h6"/>',
  video: '<rect x="3" y="5.5" width="18" height="13" rx="3.5"/><path d="M10.3 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none"/>',
  lyrics: '<path d="M4.5 6h15M4.5 10.5h15M4.5 15h7.5"/><path d="M17.5 13.5v6"/><circle cx="16" cy="19.5" r="1.6"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'
};
function icon(name, size = 22) {
  const s = document.createElement('span');
  s.className = 'ic';
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name]}</svg>`;
  return s;
}
const MARKS = {
  good: '<path d="M12.3 4.6c4.3.1 7.4 3.2 7.2 7.3-.2 4.2-3.7 7.3-7.9 7.1-4-.2-6.9-3.4-6.7-7.4.2-3.3 2.4-5.8 5.6-6.6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>',
  bad: '<path d="M12 4.8l7.6 13.4H4.6L11.2 6.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  fb: '<path d="M5 6.2h14v9.4h-7.6L7.4 19v-3.4H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 10.9h.01M12 10.9h.01M15 10.9h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'
};
function mark(kind) { return h('span', { class: 'mk mk-' + kind, 'aria-hidden': 'true', html: `<svg width="20" height="20" viewBox="0 0 24 24">${MARKS[kind]}</svg>` }); }
const NOTE_SVG = '<svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true"><ellipse cx="9" cy="23" rx="6.2" ry="4.5" transform="rotate(-20 9 23)" fill="currentColor"/><path d="M14.6 22.2V4.5c3.6 1.5 7.2 3.8 7.6 8.6" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>';
function rateDots(n) { const s = h('span', { class: 'rate-dots', 'aria-label': `만족도 ${n}점` }); for (let i = 1; i <= 5; i++) s.append(h('span', { class: i <= n ? '' : 'off', html: '<svg width="10" height="12" viewBox="0 0 26 30" aria-hidden="true"><ellipse cx="9" cy="23" rx="6.2" ry="4.5" transform="rotate(-20 9 23)" fill="currentColor"/><path d="M14.6 22.2V4.5c3.6 1.5 7.2 3.8 7.6 8.6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>' })); return s; }
const CUP_SVG = '<svg width="18" height="24" viewBox="0 0 18 24" aria-hidden="true"><path class="w" d="M4.1 10.5h9.8l-.95 9.6a1.5 1.5 0 01-1.5 1.35H6.55a1.5 1.5 0 01-1.5-1.35z"/><path d="M2.5 3.5h13l-1.9 16.8a1.5 1.5 0 01-1.5 1.3H5.9a1.5 1.5 0 01-1.5-1.3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

/* ================= constants ================= */
const DEFAULT_DRILLS = [
  { id: 'dr_hiss', name: '히싱', target: 5, timed: true, memo: '' },
  { id: 'dr_scale', name: '스케일', target: 5, timed: false, memo: '' },
  { id: 'dr_diction', name: '발음 연습', target: 5, timed: false, memo: '' },
  { id: 'dr_pant', name: '개호흡', target: 5, timed: true, memo: '' }
];
const DEFAULT_TAGS = ['호흡', '발성', '음정', '박자', '발음', '고음', '저음', '비브라토', '감정', '자세'];
const THROAT = ['맑음', '건조함', '잠김', '가래', '쉰 소리', '따가움', '코막힘'];
const COND_LABELS = ['나쁨', '별로', '보통', '좋음', '최상'];
const RATE_LABELS = ['아쉬움', '그럭저럭', '괜찮음', '좋았음', '최고'];
const FROM = ['선생님', '녹음 듣고', '친구', '기타'];
const KIND = {
  good: { label: '잘 된 점', ph: '예: 후렴 고음이 편하게 올라갔다' },
  bad: { label: '아쉬웠던 점', ph: '예: 브릿지에서 숨이 모자랐다' },
  fb: { label: '받은 피드백', ph: '예: 입을 세로로 더 열어 보기' }
};
const PATTERN = [0, 1, 2, 3, 4, 3, 2, 1];
const SCALE_MIDI = [60, 62, 64, 65, 67];
const NOTE_KO = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];
const NOTE_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = m => `${Math.floor(m / 12) - 3}옥 ${NOTE_KO[m % 12]}`;
const noteSci = m => NOTE_EN[m % 12] + (Math.floor(m / 12) - 1);
const HIGH_MIN = 48, HIGH_MAX = 91;
const LS_TIMER = 'songdiary:v1:timer', LS_UI = 'songdiary:v1:ui';
const SONG_STATUS = ['연습 중', '거의 완성', '완성', '쉬는 중'];
const THEMES = [['auto', '폰 설정 따라'], ['light', '밝게'], ['dark', '어둡게']];
const { Store, makeZip, readZip, Files, App: Native, Net, safeName } = window.SD;
const SS = window.SongSearch;

/* ================= state ================= */
const S = {
  mode: 'loading', loadErr: null,
  settings: null, days: {},
  tab: 'today', date: todayStr(), follow: true,
  cal: { y: new Date().getFullYear(), m: new Date().getMonth(), sel: todayStr(), q: '' },
  fb: { status: 'open', kinds: ['bad', 'fb'], tag: null, pinned: false },
  lib: { seg: 'songs', best: false, status: null, jq: '', jall: false, jn: 20 },
  compose: { good: { tag: null }, bad: { tag: null }, fb: { tag: null, from: '선생님' } },
  saveErr: null, openDrills: new Set(),
  popNote: null, justDone: null, sheetOpen: false
};

function defaultSettings() {
  return { v: 2, title: '껌딱의 노래일기', drills: DEFAULT_DRILLS.map(d => ({ ...d })), tags: DEFAULT_TAGS.slice(), sound: true, haptic: true, theme: 'auto', reminder: { on: false, h: 20, m: 0 }, autoBackup: true, songSearch: true, songs: [], updatedAt: 0 };
}
/* a link to a real song from the catalog (album art, 30-second preview) */
function normCat(c) {
  if (!c || typeof c !== 'object') return null;
  const str = (v, n) => String(v || '').slice(0, n);
  const https = v => (/^https:\/\//.test(String(v || '')) ? String(v).slice(0, 400) : '');
  return { src: str(c.src, 12) || 'itunes', id: +c.id || 0, title: str(c.title, 80), artist: str(c.artist, 60), album: str(c.album, 80), art: https(c.art), prev: https(c.prev), year: +c.year || null, ms: +c.ms || null, genre: str(c.genre, 30) };
}
function normSettings(s) {
  const d = defaultSettings();
  if (!s || typeof s !== 'object') return d;
  const rm = s.reminder && typeof s.reminder === 'object' ? s.reminder : {};
  return {
    v: 2,
    title: typeof s.title === 'string' && s.title.trim() ? s.title.trim().slice(0, 30) : d.title,
    drills: Array.isArray(s.drills) ? s.drills.filter(x => x && x.id).map(x => ({ id: String(x.id), name: String(x.name || '연습').slice(0, 20), target: clampInt(x.target, 1, 99, 5), timed: !!x.timed, memo: String(x.memo || '').slice(0, 60) })) : d.drills,
    tags: Array.isArray(s.tags) ? s.tags.filter(t => typeof t === 'string' && t.trim()).slice(0, 30) : d.tags,
    sound: s.sound !== false,
    haptic: s.haptic !== false,
    theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
    reminder: { on: !!rm.on, h: clampInt(rm.h, 0, 23, 20), m: clampInt(rm.m, 0, 59, 0) },
    autoBackup: s.autoBackup !== false,
    songSearch: s.songSearch !== false,
    songs: Array.isArray(s.songs) ? s.songs.filter(x => x && typeof x.k === 'string').map(x => ({ k: x.k, artist: String(x.artist || ''), memo: String(x.memo || ''), status: SONG_STATUS.includes(x.status) ? x.status : '', cat: normCat(x.cat) })) : [],
    updatedAt: +s.updatedAt || 0
  };
}
function blankDay(date) {
  const now = Date.now();
  return { date, v: 1, createdAt: now, updatedAt: now, cond: null, throat: [], sleep: null, water: 0, goal: '', drills: {}, songs: [], recs: [], good: [], bad: [], fb: [], memo: '', next: '', rating: null, minutes: 0, high: null };
}
function normDay(date, e) {
  const b = blankDay(date);
  if (!e || typeof e !== 'object') return b;
  const arr = x => (Array.isArray(x) ? x.filter(i => i && typeof i === 'object' && i.id) : []);
  const drills = {};
  if (e.drills && typeof e.drills === 'object') for (const id in e.drills) { const s = e.drills[id]; if (s && typeof s === 'object') drills[id] = { name: String(s.name || '연습'), target: clampInt(s.target, 1, 99, 5), done: clampInt(s.done, 0, 99, 0), times: Array.isArray(s.times) ? s.times.filter(n => typeof n === 'number') : [] }; }
  return {
    ...b, ...e, date,
    cond: e.cond >= 1 && e.cond <= 5 ? e.cond : null,
    throat: Array.isArray(e.throat) ? e.throat.filter(x => typeof x === 'string') : [],
    sleep: typeof e.sleep === 'number' ? e.sleep : null,
    water: +e.water || 0, minutes: +e.minutes || 0,
    goal: String(e.goal || ''), memo: String(e.memo || ''), next: String(e.next || ''),
    rating: e.rating >= 1 && e.rating <= 5 ? e.rating : null,
    high: typeof e.high === 'number' ? e.high : null,
    drills, songs: arr(e.songs), recs: arr(e.recs), good: arr(e.good), bad: arr(e.bad), fb: arr(e.fb),
    createdAt: +e.createdAt || b.createdAt, updatedAt: +e.updatedAt || 0
  };
}
function hasContent(e) {
  if (!e) return false;
  return !!(e.cond || (e.throat && e.throat.length) || e.sleep != null || e.water > 0 || (e.goal && e.goal.trim()) ||
    Object.values(e.drills || {}).some(d => d.done > 0) || e.songs.length || e.recs.length || e.good.length || e.bad.length || e.fb.length ||
    (e.memo && e.memo.trim()) || (e.next && e.next.trim()) || e.rating || e.minutes > 0 || e.high != null);
}
const ensureDay = date => S.days[date] || (S.days[date] = blankDay(date));
function touch(date) { const e = S.days[date]; if (!e) return; e.updatedAt = Date.now(); queueWrite(date); }
function touchSettings() { S.settings.updatedAt = Date.now(); queueWrite('@s', 500); }
function entryDates() { return Object.keys(S.days).filter(d => hasContent(S.days[d])).sort(); }

/* ================= persistence (everything stays on this phone) ================= */
const WQ = { keys: new Set(), timer: 0, busy: false, again: false, warned: 0 };
function queueWrite(key, delay = 400) {
  WQ.keys.add(key);
  clearTimeout(WQ.timer);
  WQ.timer = setTimeout(runWrites, delay);
  updateSave();
}
function flushWrites() { clearTimeout(WQ.timer); return runWrites(); }
async function runWrites() {
  if (WQ.busy) { WQ.again = true; return; }
  if (!WQ.keys.size || S.mode !== 'ready') { updateSave(); return; }
  const keys = Array.from(WQ.keys);
  WQ.keys.clear();
  WQ.busy = true;
  updateSave();
  try {
    const days = [];
    let meta = null;
    for (const k of keys) {
      if (k === '@s') meta = [['settings', S.settings]];
      else { const e = S.days[k]; days.push([k, e && hasContent(e) ? e : undefined]); }
    }
    if (meta) await Store.write('meta', meta);
    if (days.length) await Store.write('days', days);
    S.saveErr = null;
  } catch (err) {
    keys.forEach(k => WQ.keys.add(k));
    S.saveErr = (err && err.name) || 'error';
    if (Date.now() - WQ.warned > 15000) {
      WQ.warned = Date.now();
      toast(S.saveErr === 'QuotaExceededError' ? '폰 저장 공간이 부족해서 저장하지 못했어요. 공간을 비우면 다시 저장해요.' : '저장하지 못했어요. 잠시 뒤에 다시 시도해요.');
    }
    clearTimeout(WQ.timer);
    WQ.timer = setTimeout(runWrites, 4000);
  } finally {
    WQ.busy = false;
  }
  if (WQ.again) { WQ.again = false; runWrites(); return; }
  updateSave();
}
function retrySaves() { if (S.saveErr) flushWrites(); }
function updateSave() {
  const el = $('#save-state');
  if (!el) return;
  let text = '', err = false;
  if (S.mode === 'loading') text = '';
  else if (S.saveErr) { text = '저장 안 됨'; err = true; }
  else if (WQ.keys.size || WQ.busy) text = '저장 중…';
  else text = '저장됨';
  el.textContent = text;
  el.classList.toggle('err', err);
  el.disabled = !err;
}
async function loadAll() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    const [meta, days] = await Promise.all([Store.get('meta', 'settings'), Store.all('days')]);
    S.settings = normSettings(meta);
    S.days = {};
    for (const [k, v] of days) if (isDateKey(k)) S.days[k] = normDay(k, v);
    S.mode = 'ready';
    if (!meta) { queueWrite('@s', 50); S.firstRun = true; }
  } catch (err) {
    console.error(err);
    S.mode = 'error'; S.loadErr = err;
    if (!S.settings) S.settings = normSettings(null);
  }
  applyTheme();
  updateSave();
  render();
  afterLoad();
}
function isDark() {
  const t = S.settings ? S.settings.theme : 'auto';
  return t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}
function applyTheme() {
  const t = S.settings ? S.settings.theme : 'auto';
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  const dark = isDark();
  const m = $('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#11141B' : '#ECEFF3');
  Native.setBars(dark);
}

/* ================= sound (check tones) ================= */
const Sound = {
  ctx: null,
  get() {
    try {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ctx = new AC(); }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch (e) { return null; }
  },
  note(midi, when = 0, dur = 0.55, vol = 0.14) {
    const ctx = this.get(); if (!ctx) return;
    const t = ctx.currentTime + when + 0.01;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    o2.type = 'sine'; o2.frequency.value = f * 2; g2.gain.value = 0.22;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  },
  on() { return !S.settings || S.settings.sound !== false; },
  rep(i) { if (this.on()) this.note(SCALE_MIDI[PATTERN[i % 8]]); },
  done(i) { if (!this.on()) return; this.note(SCALE_MIDI[PATTERN[i % 8]]); this.note(72, 0.16, 0.8, 0.1); },
  fanfare() { if (!this.on()) return; [60, 64, 67, 72].forEach((m, k) => this.note(m, k * 0.09, 1.1, 0.1)); this.note(76, 0.42, 1.2, 0.07); },
  rate(i) { if (this.on()) this.note(SCALE_MIDI[i - 1], 0, 0.45, 0.1); }
};

/* ================= audio storage (blobs kept in this phone's app storage) ================= */
const MAX_AUDIO = 300 * 1024 * 1024;
async function sniff(blob) {
  try {
    const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'mp4';
    if (b.length >= 4 && b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'webm';
  } catch (e) { /* ignore */ }
  return 'other';
}
const EXT_MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', amr: 'audio/amr', '3gp': 'audio/3gpp', webm: 'audio/webm', weba: 'audio/webm' };
function audioMime(type, name) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  if (type && /^(audio|video)\//.test(type)) return type.split(';')[0].replace(/^video\//, 'audio/');
  return EXT_MIME[ext] || 'audio/mpeg';
}
function extFor(mime) {
  const m = String(mime || '');
  if (/mp4|m4a|aac/.test(m)) return m.includes('aac') ? 'aac' : 'm4a';
  if (/webm/.test(m)) return 'webm';
  if (/ogg/.test(m)) return 'ogg';
  if (/wav/.test(m)) return 'wav';
  if (/flac/.test(m)) return 'flac';
  if (/amr/.test(m)) return 'amr';
  if (/3gpp/.test(m)) return '3gp';
  return 'mp3';
}
async function storeAudio(blob, name) {
  if (blob.size > MAX_AUDIO) throw { code: 'too_large' };
  if (!blob.size) throw { code: 'empty' };
  let mime = audioMime(blob.type, name);
  const kind = await sniff(blob);
  if (kind === 'mp4' && !/mp4|m4a|aac|3gpp/.test(mime)) mime = 'audio/mp4';
  if (kind === 'webm') mime = 'audio/webm';
  const id = uid('a');
  const b = new Blob([blob], { type: mime });
  await Store.put('audio', id, { blob: b, mime, size: b.size, name: String(name || ''), at: Date.now() });
  return { aud: id, mime, size: b.size };
}
async function audioBlob(r) {
  if (!r || !r.aud) return null;
  const a = await Store.get('audio', r.aud);
  return a && a.blob ? a.blob : null;
}
function assetErrMsg(err) {
  const c = err && (err.code || err.name);
  return ({
    too_large: '300MB보다 큰 파일은 넣을 수 없어요. 녹음을 나눠서 넣어 주세요.',
    empty: '빈 파일이에요. 다른 파일을 골라 주세요.',
    QuotaExceededError: '폰 저장 공간이 부족해요. 공간을 비운 뒤 다시 시도해 주세요.'
  })[c] || '저장하지 못했어요. 다시 시도해 주세요.';
}
async function mp4Duration(file) {
  const buf = new Uint8Array(await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer());
  for (let i = 4; i < buf.length - 36; i++) {
    if (buf[i] === 0x6d && buf[i + 1] === 0x76 && buf[i + 2] === 0x68 && buf[i + 3] === 0x64) {
      const dv = new DataView(buf.buffer, buf.byteOffset + i + 4, 32);
      const ver = dv.getUint8(0);
      const ts = ver === 1 ? dv.getUint32(20) : dv.getUint32(12);
      const du = ver === 1 ? dv.getUint32(24) * 4294967296 + dv.getUint32(28) : dv.getUint32(16);
      return ts > 0 && du > 0 && du < 0xFFFFFFFF ? Math.round(du / ts * 10) / 10 : null;
    }
  }
  return null;
}
function probeDuration(file, kind) {
  return new Promise(resolve => {
    let done = false, url = null;
    const fin = v => { if (done) return; done = true; if (url) URL.revokeObjectURL(url); resolve(v); };
    const fallback = async () => { if (done) return; if (kind === 'mp4') { try { const d = await mp4Duration(file); if (d) return fin(d); } catch (e) { /* ignore */ } } fin(null); };
    try {
      const a = document.createElement('audio');
      a.preload = 'metadata';
      url = URL.createObjectURL(file);
      a.onloadedmetadata = () => { const d = a.duration; if (isFinite(d) && d > 0) fin(Math.round(d * 10) / 10); else fallback(); };
      a.onerror = fallback;
      a.src = url;
    } catch (e) { fallback(); }
    setTimeout(fallback, 4000);
  });
}

/* ================= player ================= */
/* <audio> first; if the phone can't play a file through it, decode with Web Audio instead. */
class BufferEngine {
  constructor(ctx, buffer, onchange) { this.ctx = ctx; this.buffer = buffer; this.onchange = onchange; this.src = null; this.startAt = 0; this.offset = 0; this.paused = true; this.timer = 0; }
  get duration() { return this.buffer.duration; }
  get currentTime() { return this.paused ? this.offset : Math.min(this.duration, this.ctx.currentTime - this.startAt); }
  set currentTime(t) { const was = !this.paused; this.halt(); this.offset = Math.max(0, Math.min(this.duration, t)); if (was) this.play(); else this.onchange(); }
  play() {
    if (!this.paused) return Promise.resolve();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.offset >= this.duration - 0.05) this.offset = 0;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer; s.connect(this.ctx.destination);
    s.onended = () => { if (this.src === s) { this.src = null; this.paused = true; this.offset = 0; clearInterval(this.timer); this.onchange(); } };
    this.startAt = this.ctx.currentTime - this.offset;
    s.start(0, this.offset);
    this.src = s; this.paused = false;
    clearInterval(this.timer); this.timer = setInterval(() => this.onchange(), 200);
    this.onchange();
    return Promise.resolve();
  }
  pause() { if (this.paused) return; this.offset = this.currentTime; this.halt(); this.onchange(); }
  halt() { clearInterval(this.timer); if (this.src) { const s = this.src; this.src = null; try { s.onended = null; s.stop(); } catch (e) { /* ignore */ } } this.paused = true; }
}
const Player = {
  el: null, cur: null, urls: new Map(), rate: 1, loading: null, wa: null, waFor: null, loop: null, raf: 0,
  init() {
    const a = this.el = new Audio();
    a.preload = 'auto';
    ['play', 'pause', 'loadedmetadata', 'durationchange', 'playing', 'waiting', 'seeked'].forEach(ev => a.addEventListener(ev, () => this.sync()));
    a.addEventListener('play', () => this.watch());
    /* backup for when animation frames are paused (screen dimmed etc.) */
    a.addEventListener('timeupdate', () => {
      const L = this.loop;
      if (L && this.cur && L.id === this.cur.id && L.b > L.a && a.currentTime >= L.b) { try { a.currentTime = L.a; } catch (e) { /* ignore */ } }
      this.syncCur();
    });
    a.addEventListener('ended', () => {
      if (this.loop && this.cur && this.loop.id === this.cur.id) { try { a.currentTime = this.loop.a; } catch (e) { /* ignore */ } a.play().catch(() => {}); return; }
      try { a.currentTime = 0; } catch (e) { /* ignore */ }
      this.sync();
    });
    a.addEventListener('error', () => {
      if (!this.cur || !a.getAttribute('src')) return;
      if (this.waFor !== this.cur.id) { this.fallbackWA(this.cur); return; }
      toast('이 녹음을 재생하지 못했어요. 폰에서 지원하지 않는 형식일 수 있어요.');
      this.loading = null; this.sync();
    });
  },
  eng() { return this.wa && this.cur && this.waFor === this.cur.id ? this.wa : this.el; },
  playing() { return !!this.cur && !this.eng().paused; },
  stopAll() { try { this.el.pause(); } catch (e) { /* ignore */ } if (this.wa) this.wa.pause(); Preview.stop(); },
  watch() {
    cancelAnimationFrame(this.raf);
    const step = () => {
      const e = this.eng();
      if (!this.cur || e.paused) { this.sync(); return; }
      const L = this.loop;
      if (L && L.id === this.cur.id && L.b > L.a && e.currentTime >= L.b) { try { e.currentTime = L.a; } catch (x) { /* ignore */ } }
      this.syncCur();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  },
  async toggle(r, opts = {}) {
    Preview.stop();
    if (this.cur && this.cur.id === r.id && (this.el.getAttribute('src') || this.waFor === r.id)) {
      const e = this.eng();
      if (e.paused) { e.play().catch(() => {}); this.watch(); } else e.pause();
      this.sync();
      return;
    }
    this.stopAll();
    if (this.loop && this.loop.id !== r.id) this.loop = null;
    this.cur = { id: r.id, dur: r.dur || 0, aud: r.aud, mime: r.mime };
    if (this.wa && this.waFor === r.id) {
      if (opts.at != null) this.wa.currentTime = opts.at;
      if (!opts.noplay) { await this.wa.play(); this.watch(); }
      this.sync();
      return;
    }
    this.loading = r.id;
    this.sync();
    try {
      const src = await this.srcFor(r);
      if (!this.cur || this.cur.id !== r.id) return;
      if (!src) { this.loading = null; this.cur = null; this.sync(); toast('녹음 파일을 찾지 못했어요. 이전 버전에서 옮겨 온 기록이라면 파일이 없어요.'); return; }
      this.el.src = src;
      this.el.playbackRate = this.rate;
      try { this.el.preservesPitch = true; } catch (e) { /* ignore */ }
      if (opts.at != null) { await this.ready(); try { this.el.currentTime = opts.at; } catch (e) { /* ignore */ } }
      this.loading = null;
      if (!opts.noplay) await this.el.play();
      this.watch();
    } catch (err) {
      this.loading = null;
      if (err && err.name === 'NotAllowedError') toast('한 번 더 누르면 재생돼요');
      else if (err && err.name !== 'AbortError' && err.name !== 'NotSupportedError') toast('녹음을 불러오지 못했어요. 다시 눌러 주세요.');
    }
    this.sync();
  },
  ready() {
    const a = this.el;
    return new Promise(res => {
      let settled = false, back = null;
      const fin = () => {
        if (settled) return; settled = true;
        a.removeEventListener('loadedmetadata', fixInf);
        if (back) a.removeEventListener('durationchange', back);
        res();
      };
      /* recorded webm files report an endless duration until the end has been seeked once */
      const fixInf = () => {
        if (a.duration === Infinity) {
          back = () => { a.removeEventListener('durationchange', back); try { a.currentTime = 0; } catch (e) { /* ignore */ } fin(); };
          a.addEventListener('durationchange', back);
          try { a.currentTime = 1e101; } catch (e) { fin(); }
          setTimeout(fin, 1500);
        } else fin();
      };
      if (a.readyState >= 1) fixInf(); else { a.addEventListener('loadedmetadata', fixInf); setTimeout(fin, 3000); }
    });
  },
  async srcFor(r) {
    if (!r.aud) return null;
    if (this.urls.has(r.aud)) return this.urls.get(r.aud);
    const blob = await audioBlob(r);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this.urls.set(r.aud, url);
    return url;
  },
  async fallbackWA(cur) {
    try {
      const ctx = Sound.get();
      if (!ctx) throw new Error('no audio');
      this.loading = cur.id; this.sync();
      const blob = await audioBlob(cur);
      if (!blob) throw new Error('missing');
      const data = await blob.arrayBuffer();
      const buf = await new Promise((res, rej) => { const p = ctx.decodeAudioData(data, res, rej); if (p && p.then) p.then(res, rej); });
      if (!this.cur || this.cur.id !== cur.id) return;
      try { this.el.pause(); this.el.removeAttribute('src'); } catch (e) { /* ignore */ }
      if (this.wa) this.wa.halt();
      this.wa = new BufferEngine(ctx, buf, () => this.sync());
      this.waFor = cur.id; this.loading = null;
      await this.wa.play();
      this.watch();
    } catch (e) {
      this.loading = null;
      toast('이 녹음을 재생하지 못했어요. 폰에서 지원하지 않는 형식일 수 있어요.');
    }
    this.sync();
  },
  dur() { const d = this.eng().duration; return isFinite(d) && d > 0 ? d : (this.cur && this.cur.dur) || 0; },
  time() { return this.cur ? this.eng().currentTime || 0 : 0; },
  isCur(id) { return !!this.cur && this.cur.id === id; },
  seek(r, ratio) {
    if (!this.cur || this.cur.id !== r.id) {
      this.toggle(r, { at: ratio * (r.dur || 0) });
      return;
    }
    const d = this.dur();
    if (d) { try { this.eng().currentTime = Math.max(0, Math.min(d - 0.05, ratio * d)); } catch (e) { /* ignore */ } }
    this.sync();
  },
  seekTo(r, sec, play = true) {
    if (!this.cur || this.cur.id !== r.id) { this.toggle(r, { at: sec, noplay: !play }); return; }
    try { this.eng().currentTime = Math.max(0, sec); } catch (e) { /* ignore */ }
    if (play && this.eng().paused) { this.eng().play().catch(() => {}); this.watch(); }
    this.sync();
  },
  nudge(r, sec) { if (this.cur && this.cur.id === r.id) { const e = this.eng(), d = this.dur(); try { e.currentTime = Math.max(0, Math.min(d || 1e9, e.currentTime + sec)); } catch (x) { /* ignore */ } this.sync(); } },
  setRate(v) {
    if (this.eng() !== this.el && this.cur) { toast('이 파일은 원래 속도로만 들을 수 있어요'); return; }
    this.rate = v; this.el.playbackRate = v; this.sync();
  },
  cycleRate() {
    const rates = [1, 0.75, 0.5, 1.25];
    this.setRate(rates[(rates.indexOf(this.rate) + 1) % rates.length]);
    toast(this.rate === 1 ? '원래 속도로 들어요' : `${this.rate}배 속도로 들어요 (음 높이는 그대로)`);
  },
  release(id, aud) {
    if (this.waFor === id && this.wa) { this.wa.halt(); this.wa = null; this.waFor = null; }
    if (this.cur && this.cur.id === id) { this.el.pause(); this.el.removeAttribute('src'); try { this.el.load(); } catch (e) { /* ignore */ } this.cur = null; this.sync(); }
    if (aud && this.urls.has(aud)) { URL.revokeObjectURL(this.urls.get(aud)); this.urls.delete(aud); }
    if (this.loop && this.loop.id === id) this.loop = null;
  },
  paintRow(row, on, e) {
    const id = row.dataset.rec;
    row.classList.toggle('cur', on);
    const btn = row.querySelector('.play');
    const playing = on && !e.paused;
    if (btn) {
      const st = playing ? 'pause' : 'play';
      if (btn.dataset.state !== st) { btn.dataset.state = st; btn.replaceChildren(icon(st, 22)); btn.setAttribute('aria-label', playing ? '일시정지' : '재생'); }
      btn.classList.toggle('busy', on && this.loading === id);
    }
    const d = on ? this.dur() : (+row.dataset.dur || 0);
    const t = on ? (e.currentTime || 0) : 0;
    const pct = d ? Math.min(100, (t / d) * 100) : 0;
    const prog = row.querySelector('.prog'), knob = row.querySelector('.knob'), time = row.querySelector('.rec-time'), track = row.querySelector('.track');
    if (prog) prog.style.width = pct + '%';
    if (knob) knob.style.left = pct + '%';
    if (track) track.setAttribute('aria-valuenow', String(Math.round(pct)));
    if (time) time.textContent = on ? `${fmtDur(t)} / ${d ? fmtDur(d) : '-:--'}` : (d ? fmtDur(d) : '');
    const sp = row.querySelector('.speed');
    if (sp) { sp.hidden = !on || e !== this.el; sp.textContent = this.rate + '×'; }
    const lp = row.querySelector('.loop-band');
    if (lp) {
      const L = this.loop;
      const show = L && L.id === id && d && L.b > L.a;
      lp.hidden = !show;
      if (show) { lp.style.left = (L.a / d * 100) + '%'; lp.style.width = ((L.b - L.a) / d * 100) + '%'; }
    }
  },
  syncCur() {
    if (!this.cur) return;
    const e = this.eng();
    $$(`[data-rec="${this.cur.id}"]`).forEach(row => this.paintRow(row, true, e));
    const ev = new CustomEvent('player-tick');
    document.dispatchEvent(ev);
  },
  sync() {
    const cur = this.cur ? this.cur.id : null;
    const e = this.eng();
    $$('[data-rec]').forEach(row => this.paintRow(row, row.dataset.rec === cur, e));
    document.dispatchEvent(new CustomEvent('player-tick'));
    const mini = $('#now-playing');
    if (mini) mini.hidden = !(this.cur && !e.paused);
  }
};

/* 30-second preview of the original song (streamed; needs the internet) */
const Preview = {
  a: null, btn: null,
  paint() {
    const b = this.btn, a = this.a;
    if (!b || !b.isConnected) return;
    const on = !!(a && !a.paused);
    b.classList.toggle('on', on);
    b.replaceChildren(icon(on ? 'pause' : 'play', 16), on ? '멈추기' : '원곡 미리듣기');
  },
  toggle(url, btn) {
    if (this.a && this.btn === btn) { if (this.a.paused) this.a.play().catch(() => {}); else this.a.pause(); return; }
    Player.stopAll();
    const a = this.a = new Audio();
    this.btn = btn;
    a.preload = 'auto';
    ['play', 'pause', 'ended'].forEach(ev => a.addEventListener(ev, () => this.paint()));
    a.addEventListener('error', () => { if (this.a !== a) return; toast('미리듣기를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); this.stop(); });
    a.src = url;
    btn.replaceChildren(icon('play', 16), '불러오는 중…');
    a.play().catch(err => { if (this.a === a && err && err.name !== 'AbortError') { toast('미리듣기를 재생하지 못했어요.'); this.stop(); } });
  },
  stop() {
    const a = this.a;
    if (!a) return;
    this.a = null;
    try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* ignore */ }
    this.paint();
    this.btn = null;
  }
};

/* ================= toast & sheets ================= */
let toastTimer = 0;
function toast(msg, opt = {}) {
  const t = $('#toast');
  t.replaceChildren(...[h('span', null, msg), opt.action ? h('button', { onclick: () => { t.classList.remove('show'); opt.onAction(); } }, opt.action) : null].filter(Boolean));
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), opt.action ? 5500 : 2600);
}
const Sheets = [];
function openSheet({ title, body, foot, onClose, beforeClose, full }) {
  const depth = Sheets.length;
  const bd = h('div', { class: 'backdrop', style: `z-index:${50 + depth * 2}` });
  const closeBtn = h('button', { class: 'icon-btn', 'aria-label': '닫기' }, icon('x', 22));
  const grab = h('div', { class: 'sheet-grab-area' }, h('div', { class: 'sheet-grab' }));
  const headEl = h('div', { class: 'sheet-head' }, h('h3', null, title), closeBtn);
  const sheet = h('div', { class: 'sheet' + (full ? ' full' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: `z-index:${51 + depth * 2}` },
    grab, headEl,
    h('div', { class: 'sheet-body' }, body),
    foot ? h('div', { class: 'sheet-foot' }, foot) : null);
  const obj = { bd, sheet, onClose, beforeClose, prevFocus: document.activeElement };
  bd.addEventListener('click', () => closeSheet(obj));
  closeBtn.addEventListener('click', () => closeSheet(obj));
  /* drag the top of the sheet down to close it */
  [grab, headEl].forEach(el => el.addEventListener('pointerdown', ev => {
    if (ev.target.closest('button')) return;
    const y0 = ev.clientY; let dy = 0;
    sheet.style.transition = 'none';
    const mv = e2 => { dy = Math.max(0, e2.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 110) closeSheet(obj);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }));
  document.body.append(bd, sheet);
  Sheets.push(obj);
  S.sheetOpen = true;
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => requestAnimationFrame(() => { bd.classList.add('open'); sheet.classList.add('open'); }));
  setTimeout(() => { const f = sheet.querySelector('[data-autofocus]'); if (f) f.focus({ preventScroll: true }); }, 320);
  return obj;
}
function closeSheet(obj, force) {
  obj = obj || Sheets[Sheets.length - 1];
  if (!obj || obj.closed) return;
  if (!force && obj.beforeClose && obj.beforeClose() === false) return;
  obj.closed = true;
  const i = Sheets.indexOf(obj);
  if (i >= 0) Sheets.splice(i, 1);
  obj.bd.classList.remove('open'); obj.sheet.classList.remove('open');
  setTimeout(() => { obj.bd.remove(); obj.sheet.remove(); }, 300);
  if (!Sheets.length) { S.sheetOpen = false; document.body.classList.remove('noscroll'); }
  try { if (obj.onClose) obj.onClose(); } catch (e) { console.error(e); }
  if (deferred && !Sheets.length) setTimeout(() => softRender(), 320);
}
function confirmSheet({ title, text, ok, danger, onOk }) {
  let s = null;
  const yes = h('button', { class: 'btn ' + (danger ? 'redb' : 'ink'), onclick: () => { closeSheet(s, true); onOk(); } }, ok || '확인');
  const no = h('button', { class: 'btn soft', onclick: () => closeSheet(s, true) }, '취소');
  s = openSheet({ title, body: h('p', { class: 'confirm-text' }, text || ''), foot: [no, yes] });
}
function field(label, control, hint) {
  return h('div', { class: 'field' }, h('span', { class: 'lbl' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}
function ToggleRow(label, value, onChange, hint, iconName) {
  const btn = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!value), 'aria-label': label });
  btn.addEventListener('click', () => { const v = btn.getAttribute('aria-checked') !== 'true'; btn.setAttribute('aria-checked', String(v)); onChange(v); });
  return h('div', { class: 'toggle-row' }, h('div', { class: 'tr-l' }, h('span', { class: 'tr-t' }, iconName ? icon(iconName, 17) : null, label), hint ? h('span', { class: 'hint' }, hint) : null), btn);
}
function segBtn(label, on, fn) { return h('button', { 'aria-pressed': String(!!on), onclick: fn }, label); }
function autoTA(attrs, minH) {
  const ta = h('textarea', attrs);
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.max(minH || 0, ta.scrollHeight + 2) + 'px'; };
  ta.addEventListener('input', fit);
  ta.addEventListener('focus', fit);
  requestAnimationFrame(fit);
  return ta;
}
/* Enter adds an item — safe with Korean IME composition (Chrome / Safari differ) */
function bindEnter(input, fn) {
  let pending = false;
  input.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.shiftKey) return;
    ev.preventDefault();
    if (ev.isComposing) { pending = true; return; }
    fn();
  });
  input.addEventListener('compositionend', () => { if (pending) { pending = false; setTimeout(fn, 0); } });
}

/* ================= render core ================= */
let deferred = false;
function isTyping() {
  const a = document.activeElement;
  if (!a) return false;
  return a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'file', 'range'].includes(a.type)) || a.isContentEditable;
}
function softRender() {
  if (isTyping() || S.sheetOpen) { deferred = true; return; }
  deferred = false;
  render();
}
document.addEventListener('focusout', () => setTimeout(() => { if (deferred && !isTyping() && !S.sheetOpen) { deferred = false; render(); } }, 80));

function render(opts = {}) {
  const main = $('#view');
  const y = window.scrollY;
  const title = S.settings ? S.settings.title : '노래일기';
  $('#tb-title').textContent = title;
  document.title = title;
  $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  let node;
  try {
    if (S.mode === 'loading') node = LoadingView();
    else if (S.mode === 'error') node = ErrorView();
    else node = ({ today: TodayView, calendar: CalendarView, feedback: FeedbackView, songs: SongsView })[S.tab]();
  } catch (err) {
    console.error(err);
    node = h('div', { class: 'page' }, h('p', { class: 'empty' }, '화면을 그리다가 문제가 생겼어요. 다른 탭을 눌렀다가 돌아와 주세요.'));
  }
  document.body.dataset.tab = S.tab;
  main.replaceChildren(node);
  window.scrollTo(0, opts.top ? 0 : y);
  if (opts.focus) { const el = main.querySelector(`[data-fk="${opts.focus}"]`); if (el) el.focus({ preventScroll: true }); }
  Player.sync();
  tickTimer();
  updateSave();
  S.popNote = null; S.justDone = null;
}
function go(tab) { S.tab = tab; render({ top: true }); }
function goDate(d) {
  if (d > todayStr()) return;
  S.date = d; S.follow = d === todayStr(); S.tab = 'today';
  render({ top: true });
}
function Banner() { return null; }
/* gentle reminder to keep a full backup somewhere other than this phone */
function BackupNudge() {
  const u = lsGet(LS_UI, {});
  const n = entryDates().length;
  if (n < 7) return null;
  const last = u.lastFull || 0, snooze = u.nudgeSnooze || 0;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  if ((days != null && days < 30) || Date.now() < snooze) return null;
  const box = h('div', { class: 'banner nudge' },
    h('span', null, days == null ? `기록이 ${n}일치 모였어요. 폰을 잃어버려도 괜찮게 전체 백업을 한 번 해 둘까요?` : `마지막 전체 백업이 ${days}일 전이에요. 녹음까지 한 번 더 백업해 둘까요?`),
    h('div', { class: 'btn-row', style: 'margin-top:8px' },
      h('button', { class: 'btn ink sm', onclick: () => { box.remove(); exportBackup(true, 'share'); } }, icon('share', 16), '백업 보내기'),
      h('button', { class: 'btn ghost sm', onclick: () => { const v = lsGet(LS_UI, {}); v.nudgeSnooze = Date.now() + 7 * 86400000; lsSet(LS_UI, v); box.remove(); } }, '나중에')));
  return box;
}
/* one-time note about what this version added */
function WhatsNew() {
  const u = lsGet(LS_UI, {});
  if (u.seen11 || S.firstRun || !entryDates().length) return null;
  const close = () => { const v = lsGet(LS_UI, {}); v.seen11 = 1; lsSet(LS_UI, v); };
  const box = h('div', { class: 'banner news' },
    h('b', null, '새로워졌어요'),
    h('ul', null,
      h('li', null, '노래 제목을 몇 글자만 쳐도 실제 노래를 찾아 줘요. 초성(ㅂㅇㄱ)이나 가수 이름으로도 돼요.'),
      h('li', null, '‘모아보기’ 탭에서 그동안 쓴 일지를 한곳에 모아 읽을 수 있어요.')),
    h('div', { class: 'btn-row', style: 'margin-top:8px' },
      h('button', { class: 'btn ink sm', onclick: () => { close(); S.lib.seg = 'journal'; go('songs'); } }, icon('book', 16), '일지 보러 가기'),
      h('button', { class: 'btn ghost sm', onclick: () => { close(); box.remove(); } }, '닫기')));
  return box;
}
function LoadingView() {
  return h('div', { class: 'loading' },
    h('div', { class: 'ld-staff', html: staffSVG(5, 0, false, false) }),
    h('p', { class: 'hand' }, '일기장을 펴는 중…'));
}
function ErrorView() {
  return h('div', { class: 'loading' },
    h('p', { class: 'hand' }, '일기장을 여는 데 문제가 생겼어요'),
    h('p', { class: 'hint mt' }, '기록은 지워지지 않았어요. 앱을 완전히 닫았다가 다시 열어 주세요.'),
    h('button', { class: 'btn ink mt', onclick: () => { S.mode = 'loading'; render(); loadAll(); } }, '다시 시도'));
}
/* horizontal swipe (for days and months) that leaves vertical scrolling alone */
function swipe(el, onLeft, onRight) {
  let x0 = 0, y0 = 0, t0 = 0, on = false;
  el.addEventListener('touchstart', ev => { if (ev.touches.length !== 1) { on = false; return; } const t = ev.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); on = true; }, { passive: true });
  el.addEventListener('touchend', ev => {
    if (!on) return; on = false;
    const t = ev.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    if (Date.now() - t0 > 600 || Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (x0 < 24 || x0 > window.innerWidth - 24) return; /* leave the system back gesture alone */
    if (dx < 0) onLeft(); else onRight();
  }, { passive: true });
}

/* ================= practice timer ================= */
function startTimer(date) { lsSet(LS_TIMER, { date, start: Date.now() }); render(); toast('연습 시간을 재기 시작했어요'); }
function stopTimer() {
  const tm = lsGet(LS_TIMER, null);
  if (!tm) return;
  lsSet(LS_TIMER, null);
  const add = Math.round((Date.now() - tm.start) / 60000);
  if (add > 240) { render(); editMinutes(tm.date, ((S.days[tm.date] || {}).minutes || 0) + add, '4시간 넘게 켜져 있었어요. 이 날 연습한 시간을 모두 합쳐서 확인해 주세요.'); return; }
  if (add >= 1) { const e = ensureDay(tm.date); e.minutes = (e.minutes || 0) + add; touch(tm.date); toast(`${fmtMin(add)}을 기록했어요`); }
  else toast('1분이 안 돼서 기록하지 않았어요');
  render();
}
function tickTimer() {
  const tm = lsGet(LS_TIMER, null);
  const pill = $('#tb-timer');
  if (!tm) { if (pill) pill.hidden = true; return; }
  const t = fmtClock(Date.now() - tm.start);
  if (pill) { pill.hidden = false; $('#tb-timer-t').textContent = t; }
  const v = $('#timer-val');
  if (v) v.textContent = t;
}
function editMinutes(date, suggested, note) {
  const e = S.days[date];
  let val = suggested != null ? suggested : (e ? e.minutes : 0);
  const out = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 0, max: 1440, value: val, 'aria-label': '연습 시간(분)', 'data-autofocus': '' });
  const quick = h('div', { class: 'btn-row' }, [-10, -5, 5, 10, 30].map(n => h('button', { class: 'btn soft sm', onclick: () => { out.value = Math.max(0, (parseInt(out.value, 10) || 0) + n); } }, (n > 0 ? '+' : '−') + Math.abs(n) + '분')));
  let s = null;
  const save = h('button', { class: 'btn ink', onclick: () => { const v = clampInt(out.value, 0, 1440, 0); const d = ensureDay(date); d.minutes = v; touch(date); closeSheet(s, true); render(); toast(`연습 시간을 ${fmtMin(v)}으로 적었어요`); } }, '저장');
  s = openSheet({ title: `${fmtMD(date)} 연습 시간`, body: h('div', null, note ? h('p', { class: 'banner' }, note) : null, field('모두 몇 분 연습했나요?', out), quick), foot: [save] });
}

/* ================= data helpers ================= */
function snapshotDrills(e) {
  if (e.drills && Object.keys(e.drills).length) return;
  e.drills = {};
  S.settings.drills.forEach(t => { e.drills[t.id] = { name: t.name, target: t.target, done: 0, times: [] }; });
}
function drillList(date) {
  const e = S.days[date];
  const snap = (e && e.drills) || {};
  const list = S.settings.drills.map(t => {
    const s = snap[t.id];
    const target = s ? s.target : t.target;
    return { id: t.id, name: t.name, memo: t.memo, timed: t.timed, target, done: s ? Math.min(s.done || 0, target) : 0, times: (s && s.times) || [] };
  });
  for (const id in snap) {
    const s = snap[id];
    if (!list.some(x => x.id === id) && (s.done || 0) > 0) list.push({ id, name: s.name || '연습', memo: '', timed: (s.times || []).length > 0, target: s.target, done: Math.min(s.done, s.target), times: s.times || [], orphan: true });
  }
  return list;
}
function drillsAllDone(date) {
  if (date === todayStr()) { const l = drillList(date); return l.length > 0 && l.every(d => d.done >= d.target); }
  const e = S.days[date];
  if (!e || !e.drills) return false;
  const v = Object.values(e.drills);
  return v.length > 0 && v.every(d => (d.done || 0) >= (d.target || 1));
}
function bestTime(id) {
  let best = null;
  for (const d in S.days) { const s = S.days[d].drills && S.days[d].drills[id]; if (s && s.times) for (const t of s.times) if (!best || t > best.sec) best = { sec: t, date: d }; }
  return best;
}
function bestHigh() {
  let best = null;
  for (const d in S.days) { const m = S.days[d].high; if (m != null && (!best || m > best.m)) best = { m, date: d }; }
  return best;
}
function streak() {
  let d = todayStr();
  if (!hasContent(S.days[d])) d = addDays(d, -1);
  let n = 0;
  while (hasContent(S.days[d])) { n++; d = addDays(d, -1); }
  return n;
}
function prevEntryDate(date) {
  const ds = entryDates().filter(d => d < date);
  return ds.length ? ds[ds.length - 1] : null;
}
function allItems() {
  const out = [];
  for (const d of Object.keys(S.days).sort().reverse()) {
    const e = S.days[d];
    for (const kind of ['bad', 'fb', 'good']) for (const it of e[kind]) out.push({ date: d, kind, it });
  }
  return out;
}
function findItem(date, kind, id) { const e = S.days[date]; return e ? e[kind].find(x => x.id === id) : null; }
function mutItem(date, kind, id, fn) { const it = findItem(date, kind, id); if (!it) return; fn(it); touch(date); }
function findRec(date, id) { const e = S.days[date]; return e ? e.recs.find(x => x.id === id) : null; }
function songLib() {
  const map = new Map();
  const get = (k, title, d) => { let L = map.get(k); if (!L) { L = { key: k, title, artist: '', tone: '', memo: '', dates: [], recs: [], notes: [], first: d, last: d }; map.set(k, L); } return L; };
  for (const d of Object.keys(S.days).sort()) {
    const e = S.days[d];
    for (const s of e.songs) {
      const k = normKey(s.title); if (!k) continue;
      const L = get(k, s.title, d);
      if (!L.dates.includes(d)) L.dates.push(d);
      L.title = s.title; L.last = d;
      if (s.artist) L.artist = s.artist;
      if (s.tone) L.tone = s.tone;
      if (s.note || s.tone) L.notes.push({ d, note: s.note || '', tone: s.tone || '' });
    }
    for (const r of e.recs) {
      if (!r.song) continue;
      const L = get(r.song, r.songTitle || r.song, d);
      L.recs.push({ d, r });
      if (d > L.last) L.last = d;
      if (d < L.first) L.first = d;
    }
  }
  for (const m of (S.settings.songs || [])) { const L = map.get(m.k); if (L) { if (m.artist) L.artist = m.artist; L.memo = m.memo || ''; L.status = m.status || ''; L.cat = m.cat || null; } }
  return map;
}
function defaultSongKey(date) { const e = S.days[date]; return e && e.songs.length ? normKey(e.songs[e.songs.length - 1].title) : ''; }
function songTitleFor(date, key) {
  if (!key) return '';
  const e = S.days[date];
  const s = e && e.songs.find(x => normKey(x.title) === key);
  if (s) return s.title;
  const L = songLib().get(key);
  return L ? L.title : '';
}
function songSelect(date, current) {
  const sel = h('select', { class: 'input', 'aria-label': '어떤 노래의 녹음인지' });
  sel.append(h('option', { value: '' }, '노래 지정 안 함'));
  const e = S.days[date];
  const todayKeys = new Set();
  if (e && e.songs.length) {
    const g = h('optgroup', { label: '이 날 부른 노래' });
    e.songs.forEach(s => { const k = normKey(s.title); todayKeys.add(k); g.append(h('option', { value: k }, s.title)); });
    sel.append(g);
  }
  const others = Array.from(songLib().values()).filter(L => !todayKeys.has(L.key)).sort((a, b) => b.last.localeCompare(a.last));
  if (others.length) { const g = h('optgroup', { label: '다른 노래' }); others.forEach(L => g.append(h('option', { value: L.key }, L.title))); sel.append(g); }
  sel.value = current || '';
  return sel;
}

/* ================= song search: a few letters, 초성 or the singer — like a karaoke remote ================= */
function linkSong(key, cat, artist, forceArtist) {
  let m = S.settings.songs.find(x => x.k === key);
  if (!m) { m = { k: key, artist: '', memo: '', status: '', cat: null }; S.settings.songs.push(m); }
  m.cat = cat ? normCat(cat) : null;
  if (artist && (forceArtist || !m.artist)) m.artist = artist;
  touchSettings();
}
const catOf = it => normCat({ src: it.src, id: it.id, title: it.title, artist: it.artist, album: it.album, art: it.art, prev: it.prev, year: it.year, ms: it.ms, genre: it.genre });
function libMatches(q, skip) {
  const out = [];
  for (const L of songLib().values()) {
    if (skip && skip.has(L.key)) continue;
    const s = Math.max(SS.match(q, L.title), SS.match(q, L.artist || '') * 0.8);
    if (s > 0) out.push({ L, s });
  }
  return out.sort((a, b) => b.s - a.s || b.L.dates.length - a.L.dates.length || b.L.last.localeCompare(a.L.last)).slice(0, 4).map(x => x.L);
}
function artThumb(url, size = 40) {
  const box = h('span', { class: 'sg-art', style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' }, icon('music', Math.round(size * 0.46)));
  if (url) {
    const img = h('img', { alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', width: size, height: size });
    img.addEventListener('load', () => box.classList.add('has'));
    img.addEventListener('error', () => img.remove());
    img.src = url;
    box.append(img);
  }
  return box;
}
/* Suggestions under a song-title input.
   opts: onPick({ title, artist, key?, cat? }), free (offer adding the typed text), onFree(text),
         skip() → keys to leave out, local (default true), online (default true), always (show without focus) */
function SongSuggest(inp, opts) {
  const box = h('div', { class: 'sg', hidden: true, role: 'listbox', id: uid('sg'), 'aria-label': '노래 찾기 결과' });
  inp.setAttribute('role', 'combobox');
  inp.setAttribute('aria-autocomplete', 'list');
  inp.setAttribute('aria-expanded', 'false');
  inp.setAttribute('aria-controls', box.id);
  let seq = 0, timer = 0, net = { q: '', state: 'idle', items: [] }, active = -1, picks = [], dirty = !!opts.always, shown = false;
  const keep = ev => ev.preventDefault(); /* tapping a suggestion keeps the keyboard up */
  const online = () => opts.online !== false && S.settings.songSearch !== false;
  const hide = () => { box.hidden = true; shown = false; active = -1; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); };
  const pick = p => {
    clearTimeout(timer); seq++;
    hide();
    if (p.free != null) opts.onFree(p.free); else opts.onPick(p);
  };
  /* keep the list in sight above the keyboard */
  const reveal = () => {
    const vv = window.visualViewport, vh = vv ? vv.height : window.innerHeight;
    const r = inp.getBoundingClientRect();
    if (r.top < vh * 0.42) return;
    const sb = inp.closest('.sheet-body');
    if (sb) sb.scrollBy({ top: r.top - sb.getBoundingClientRect().top - 8, behavior: 'smooth' });
    else window.scrollBy({ top: r.top - 72, behavior: 'smooth' });
  };
  const draw = () => {
    const q = inp.value.trim();
    if (!q || !dirty || (!opts.always && document.activeElement !== inp)) { hide(); return; }
    const rows = [];
    picks = [];
    const option = (content, p, cls) => {
      const i = picks.length;
      picks.push(p);
      return h('button', { type: 'button', class: 'sg-item' + (cls ? ' ' + cls : ''), role: 'option', id: `${box.id}-${i}`, 'aria-selected': String(i === active), tabindex: -1, onpointerdown: keep, onmousedown: keep, onclick: () => pick(p) }, content);
    };
    const local = opts.local === false ? [] : libMatches(q, opts.skip && opts.skip());
    if (local.length) {
      rows.push(h('div', { class: 'sg-h' }, '내가 부른 노래'));
      local.forEach(L => rows.push(option([artThumb(L.cat && L.cat.art, 40), h('span', { class: 'sg-t' }, h('b', null, L.title), h('small', null, [L.artist, `${L.dates.length}일 연습`].filter(Boolean).join(' · ')))], { title: L.title, artist: L.artist, key: L.key })));
    }
    const term = SS.onlineTerm(q);
    if (online() && term) {
      const mine = new Set(local.map(L => L.key));
      const items = net.q === term ? net.items.filter(it => !mine.has(normKey(SS.cleanTitle(it.title)))).slice(0, 6) : [];
      if (items.length) {
        rows.push(h('div', { class: 'sg-h' }, '노래 찾기'));
        items.forEach(it => rows.push(option([artThumb(it.art, 40), h('span', { class: 'sg-t' }, h('b', null, it.title), h('small', null, [it.artist, it.album && it.album !== it.title ? it.album.replace(/ - (Single|EP)$/, '') : '', it.year].filter(Boolean).join(' · ')))], { title: SS.cleanTitle(it.title), artist: it.artist, cat: catOf(it) })));
      }
      const busy = net.q !== term || net.state === 'loading';
      const st = busy ? '노래 찾는 중…'
        : net.state === 'offline' ? '인터넷에 연결되지 않아서 내가 부른 노래에서만 찾았어요.'
        : net.state === 'busy' ? '검색이 잠깐 몰렸어요. 1분쯤 뒤에 다시 찾아요.'
        : net.state === 'error' ? '노래를 찾지 못했어요. 인터넷 연결을 확인해 주세요.'
        : !items.length && !local.length ? `‘${term}’에 맞는 노래를 찾지 못했어요.` : '';
      if (st) rows.push(h('div', { class: 'sg-status' + (busy ? ' busy' : ''), role: 'status' }, st));
    }
    if (opts.free) rows.push(option([h('span', { class: 'sg-art plus', 'aria-hidden': 'true' }, icon('plus', 18)), h('span', { class: 'sg-t' }, h('b', null, `‘${q}’ 그대로 추가`))], { free: q }, 'free'));
    if (online() && term && net.q === term && net.items.length) rows.push(h('div', { class: 'sg-src' }, 'Apple Music 곡 정보'));
    box.replaceChildren(...rows);
    const was = shown;
    box.hidden = !rows.length;
    shown = !box.hidden;
    inp.setAttribute('aria-expanded', String(shown));
    if (shown && !was && !opts.always) setTimeout(reveal, 60);
  };
  const search = async () => {
    const term = SS.onlineTerm(inp.value.trim());
    if (!term || !online() || (net.q === term && (net.state === 'done' || net.state === 'loading'))) return;
    const my = ++seq;
    net = { q: term, state: 'loading', items: [] };
    draw();
    try {
      const items = await SS.Catalog.search(term, url => Net.getJson(url));
      if (my !== seq) return;
      net = { q: term, state: 'done', items };
    } catch (e) {
      if (my !== seq) return;
      net = { q: term, state: e && e.offline ? 'offline' : e && e.busy ? 'busy' : 'error', items: [] };
    }
    if (inp.isConnected) draw();
  };
  inp.addEventListener('input', () => {
    dirty = true; active = -1;
    draw();
    clearTimeout(timer);
    timer = setTimeout(search, 380);
  });
  inp.addEventListener('focus', () => { if (dirty && inp.value.trim()) { draw(); clearTimeout(timer); timer = setTimeout(search, 60); } });
  inp.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== inp && !opts.always) hide(); }, 160));
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !box.hidden && !opts.always) { ev.stopPropagation(); hide(); return; }
    if (box.hidden || !picks.length || (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp')) return;
    ev.preventDefault();
    active = (active + (ev.key === 'ArrowDown' ? 1 : -1) + picks.length) % picks.length;
    draw();
    inp.setAttribute('aria-activedescendant', `${box.id}-${active}`);
  });
  /* Enter while a suggestion is highlighted picks it */
  box.takeActive = () => { if (!box.hidden && active >= 0 && picks[active]) { pick(picks[active]); return true; } return false; };
  box.search = () => { dirty = true; draw(); search(); };
  return box;
}
/* album art, singer, and quick ways to hear the original / find an MR / read the lyrics */
function SongHero(L, key, onChange) {
  const c = L.cat;
  const q = [L.title, L.artist].filter(Boolean).join(' ');
  const enc = encodeURIComponent;
  const sub = [L.artist, c && c.album && c.album !== L.title ? c.album.replace(/ - (Single|EP)$/, '') : '', c && c.year].filter(Boolean).join(' · ');
  return h('div', { class: 'hero' },
    h('div', { class: 'hero-top' },
      artThumb(c && c.art ? c.art.replace(/\/100x100bb\./, '/200x200bb.') : '', 64),
      h('div', { class: 'hero-t' },
        h('b', null, L.title),
        h('span', { class: sub ? '' : 'hint' }, sub || '가수는 아래에 적거나 실제 노래와 연결하면 채워져요'),
        h('button', { class: 'link', onclick: () => openSongLink(key, onChange) }, icon('link', 15), c ? '다른 노래로 연결' : '실제 노래와 연결하기'))),
    h('div', { class: 'hero-links' },
      c && c.prev ? h('button', { class: 'btn soft sm', onclick: ev => Preview.toggle(c.prev, ev.currentTarget) }, icon('play', 16), '원곡 미리듣기') : null,
      h('button', { class: 'btn soft sm', onclick: () => Native.openUrl(`https://www.youtube.com/results?search_query=${enc(q)}`) }, icon('video', 17), '유튜브'),
      h('button', { class: 'btn soft sm', onclick: () => Native.openUrl(`https://www.youtube.com/results?search_query=${enc(q + ' MR')}`) }, icon('music', 16), 'MR 찾기'),
      h('button', { class: 'btn soft sm', onclick: () => Native.openUrl(`https://m.search.naver.com/search.naver?query=${enc(q + ' 가사')}`) }, icon('lyrics', 16), '가사')));
}
function openSongLink(key, onDone) {
  const L = songLib().get(key);
  if (!L) return;
  const inp = h('input', { class: 'input', type: 'search', value: [L.title, L.artist].filter(Boolean).join(' '), enterkeyhint: 'search', autocomplete: 'off', spellcheck: 'false', 'aria-label': '연결할 노래 찾기' });
  let s = null;
  const done = msg => { closeSheet(s, true); if (onDone) onDone(); toast(msg); };
  const sugg = SongSuggest(inp, { local: false, always: true, onPick: p => { linkSong(key, p.cat, p.artist, true); done(`연결했어요: ${p.title}${p.artist ? ` - ${p.artist}` : ''}`); } });
  s = openSheet({
    title: '실제 노래와 연결',
    body: h('div', null,
      h('p', { class: 'hint', style: 'margin-bottom:10px' }, `‘${L.title}’에 맞는 곡을 고르면 앨범 사진, 가수, 원곡 미리듣기가 붙어요. 일기에 적은 제목은 그대로예요.`),
      S.settings.songSearch === false ? h('p', { class: 'banner' }, '설정에서 ‘실제 노래 검색’이 꺼져 있어요.') : null,
      inp, sugg,
      L.cat ? h('button', { class: 'btn ghost danger wide', style: 'margin-top:14px', onclick: () => { linkSong(key, null); done('연결을 풀었어요'); } }, icon('x', 17), '연결 풀기') : null)
  });
  sugg.search();
}

/* ================= staff & stamp ================= */
function staffSVG(target, done, complete, pop) {
  const rows = Math.max(1, Math.ceil(target / 10));
  const base = Math.floor(target / rows), extra = target % rows;
  const W = 320, H = 62, x0 = 16, x1 = W - 16;
  let out = '', idx = 0;
  for (let r = 0; r < rows; r++) {
    const n = base + (r < extra ? 1 : 0);
    const step = (x1 - x0) / n;
    let s = `<svg class="staff" viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
    for (let k = 0; k < 5; k++) s += `<line class="sl" x1="4" x2="${W - 4}" y1="${10 + k * 8}" y2="${10 + k * 8}"/>`;
    s += `<line class="sl" x1="4.5" x2="4.5" y1="10" y2="42"/>`;
    for (let j = 0; j < n; j++, idx++) {
      const deg = PATTERN[idx % 8];
      const y = 50 - deg * 4;
      const x = +(x0 + step * j + step / 2).toFixed(1);
      if (deg === 0) s += `<line class="sl" x1="${x - 9}" x2="${x + 9}" y1="50" y2="50"/>`;
      if (idx < done) s += `<g class="nt${pop && idx === done - 1 ? ' pop' : ''}"><ellipse class="nh" cx="${x}" cy="${y}" rx="5.4" ry="3.9" transform="rotate(-20 ${x} ${y})"/><line class="stem" x1="${x + 4.9}" x2="${x + 4.9}" y1="${y - 1.2}" y2="${y - 24}"/></g>`;
      else s += `<ellipse class="gh${idx === done ? ' next' : ''}" cx="${x}" cy="${y}" rx="5.4" ry="3.9" transform="rotate(-20 ${x} ${y})"/>`;
    }
    if (r === rows - 1 && complete) s += `<line class="finl" x1="${W - 11}" x2="${W - 11}" y1="10" y2="42"/><rect class="fin" x="${W - 8}" y="10" width="3.6" height="32"/>`;
    else s += `<line class="sl" x1="${W - 4.5}" x2="${W - 4.5}" y1="10" y2="42"/>`;
    out += s + '</svg>';
  }
  return out;
}
function Stamp(anim) {
  return h('div', { class: 'stamp' + (anim ? ' anim' : ''), 'aria-hidden': 'true', html:
    '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="3.4" stroke-dasharray="120 5 60 4 55 6"/>' +
    '<circle cx="50" cy="50" r="39.5" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M50 15.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" fill="currentColor"/>' +
    '<text x="50" y="49" text-anchor="middle" font-size="22">참</text><text x="50" y="70" text-anchor="middle" font-size="18">잘했어요</text></svg>' });
}

/* ================= today ================= */
function TodayView() {
  const date = S.date, today = todayStr(), isToday = date === today;
  const e = S.days[date] || null;
  const st = streak();
  const d = parseYmd(date);
  const head = h('div', { class: 'day-head' },
    h('button', { class: 'navbtn', 'aria-label': '하루 전', onclick: () => goDate(addDays(date, -1)) }, icon('left', 24)),
    h('div', { class: 'day-mid' },
      h('button', { class: 'day-date', 'aria-label': `${fmtMDW(date)}, 달력에서 다른 날 고르기`, onclick: () => { S.cal.y = d.getFullYear(); S.cal.m = d.getMonth(); S.cal.sel = date; go('calendar'); } }, fmtMD(date)),
      h('div', { class: 'day-sub' },
        h('span', { class: 'wd' + dowClass(date) }, WD[d.getDay()] + '요일'),
        isToday && st >= 2 ? h('span', { class: 'pill blue' }, `연속 ${st}일째`) : null,
        !isToday ? h('span', { class: 'pill' }, '지난 기록') : null,
        !isToday ? h('button', { class: 'pill blue', onclick: () => goDate(today) }, '오늘로') : null)),
    h('button', { class: 'navbtn', 'aria-label': '하루 뒤', disabled: isToday, onclick: () => goDate(addDays(date, 1)) }, icon('right', 24)));
  swipe(head, () => { if (!isToday) goDate(addDays(date, 1)); }, () => goDate(addDays(date, -1)));
  const jumps = [['sec-cond', '컨디션'], ['sec-drills', '기초 연습'], ['sec-songs', '노래'], ['sec-recs', '녹음'], ['sec-reflect', '돌아보기']];
  const jump = h('div', { class: 'chips scroll jump' }, jumps.map(([id, l]) => h('button', { class: 'chip sm', onclick: () => { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' }); } }, l)));
  const page = h('div', { class: 'page' },
    TimerSec(date, e, isToday),
    isToday && !entryDates().length ? h('div', { class: 'sec welcome' }, h('p', { class: 'hand' }, '첫 장이에요. 노래할 때마다 여기에 적어 두세요.'), h('p', { class: 'hint', style: 'margin-top:6px' }, '기초 연습 항목과 횟수는 ‘기초 연습’ 옆 편집에서 바꿀 수 있어요. 적는 내용은 모두 이 폰에 자동으로 저장돼요.')) : null,
    isToday ? PinsSec() : null,
    isToday ? LastSec(date) : null,
    isToday ? MemorySec(date) : null,
    CondSec(date, e), GoalSec(date, e), DrillSec(date), SongSec(date, e), RecSec(date, e), ReflectSec(date, e));
  return h('div', { class: 'v-today' }, isToday ? (WhatsNew() || BackupNudge()) : null, head, jump, page,
    h('div', { class: 'today-foot' },
      h('button', { class: 'btn soft sm', onclick: () => copySummary(date) }, icon('copy', 18), '요약 복사'),
      h('button', { class: 'btn soft sm', onclick: () => shareSummary(date) }, icon('send', 18), '요약 보내기'),
      h('span', { class: 'hint' }, '선생님께 카톡으로 보내거나 메모장에 붙여 넣을 수 있어요')));
}
/* "한 달 전 오늘" — a look back at the same day a week / month / year ago */
function MemorySec(date) {
  const cands = [[365, '1년 전 오늘'], [180, '반년 전 오늘'], [90, '3달 전 오늘'], [30, '한 달 전 오늘'], [7, '일주일 전 오늘']];
  let hit = null;
  for (const [n, label] of cands) { const d = addDays(date, -n); if (hasContent(S.days[d])) { hit = { d, label }; break; } }
  if (!hit) return null;
  const e = S.days[hit.d];
  const bits = [];
  if (e.songs.length) bits.push('♪ ' + e.songs.map(s => s.title).join(', '));
  const first = e.bad[0] || e.fb[0] || e.good[0];
  if (first) bits.push(first.text);
  else if (e.memo.trim()) bits.push(e.memo.trim().split('\n')[0]);
  if (e.high != null) bits.push(`최고음 ${noteName(e.high)}`);
  return h('div', { class: 'sec' },
    h('button', { class: 'memory', onclick: () => goDate(hit.d) },
      h('span', { class: 'mem-l' }, hit.label, h('span', { class: 'hint' }, ` · ${fmtMD(hit.d)}`)),
      bits.length ? h('span', { class: 'mem-t clip' }, bits.join('  ·  ')) : h('span', { class: 'mem-t' }, '이 날 기록 펼쳐 보기'),
      e.recs.length ? h('span', { class: 'mem-r' }, icon('mic', 15), `녹음 ${e.recs.length}개 — 그때 목소리 들어 보기`) : null));
}
function TimerSec(date, e, isToday) {
  const tm = lsGet(LS_TIMER, null);
  const running = !!(tm && tm.date === date);
  const mins = e ? e.minutes : 0;
  return h('div', { class: 'sec timer-row' + (running ? ' run' : '') },
    (isToday && !tm) || running ? h('button', { class: 'btn ' + (running ? 'redb' : 'ink'), onclick: () => (running ? stopTimer() : startTimer(date)) }, running ? icon('stop', 18) : h('span', { class: 'dot white' }), running ? '연습 끝' : '연습 시작') : null,
    h('div', { class: 't-main' },
      running ? h('div', { class: 't-val', id: 'timer-val' }, fmtClock(Date.now() - tm.start)) : h('div', { class: 't-val' }, fmtMin(mins)),
      h('div', { class: 't-sub' }, running ? (mins ? `이 날 이미 ${fmtMin(mins)} 기록됨` : '연습하는 동안 시간을 재고 있어요') : (isToday ? '오늘 연습한 시간' : '이 날 연습한 시간'))),
    h('button', { class: 'icon-btn', 'aria-label': '연습 시간 직접 고치기', onclick: () => editMinutes(date) }, icon('edit', 20)));
}
function PinsSec() {
  const pins = allItems().filter(x => x.it.pinned && !x.it.resolved);
  if (!pins.length) return null;
  return h('div', { class: 'sec' },
    h('div', { class: 'sec-h' }, h('h2', null, '잊지 말 것'), h('span', { class: 'sec-note' }, `${pins.length}개`)),
    h('ul', { class: 'pin-list' },
      pins.slice(0, 5).map(x => h('li', null, h('button', { class: 'pin-item', onclick: () => openItem(x.date, x.kind, x.it.id) }, icon('pin', 16), h('span', { style: 'flex:1;min-width:0' }, h('span', { class: 'hl' }, x.it.text)), x.it.tag ? h('span', { class: 'tag' }, x.it.tag) : null))),
      pins.length > 5 ? h('li', null, h('button', { class: 'link', onclick: () => { Object.assign(S.fb, { pinned: true, status: 'open', kinds: ['bad', 'fb', 'good'], tag: null }); go('feedback'); } }, `${pins.length - 5}개 더 보기`)) : null));
}
function LastSec(date) {
  const prev = prevEntryDate(date);
  if (!prev) return null;
  const pe = S.days[prev];
  const items = [...pe.bad.map(it => ({ kind: 'bad', it })), ...pe.fb.map(it => ({ kind: 'fb', it }))].filter(x => !x.it.resolved && !x.it.pinned).slice(0, 3);
  const gap = daysBetween(prev, date);
  if (!pe.next.trim() && !items.length && gap < 3) return null;
  return h('div', { class: 'sec' },
    h('div', { class: 'sec-h' }, h('h2', null, `${fmtMD(prev)}의 나에게서`), h('span', { class: 'sp' }), gap >= 2 ? h('span', { class: 'sec-note' }, `${gap}일 전`) : null),
    pe.next.trim() ? h('div', { class: 'slip' }, h('p', { class: 'hand' }, pe.next.trim())) : (gap >= 3 ? h('p', { class: 'hint' }, `마지막 기록이 ${gap}일 전이에요. 오늘은 가볍게 풀어 봐요.`) : null),
    items.length ? h('div', { style: 'margin-top:14px' },
      h('div', { class: 'lbl' }, '지난번에 아쉬웠던 것, 오늘은 어땠나요?'),
      items.map(x => h('div', { class: 'last-item' }, mark(x.kind), h('span', { class: 't' }, x.it.text),
        h('button', { class: 'mini ok', onclick: () => {
          mutItem(prev, x.kind, x.it.id, it => { it.resolved = true; it.resolvedOn = todayStr(); });
          render();
          toast('해결한 것으로 옮겼어요', { action: '되돌리기', onAction: () => { mutItem(prev, x.kind, x.it.id, it => { it.resolved = false; delete it.resolvedOn; }); render(); } });
        } }, icon('check', 15), '해결했어요')))) : null);
}
function CondSec(date, e) {
  const c = e ? e.cond : null;
  const setDay = fn => { const d = ensureDay(date); fn(d); touch(date); render(); };
  const bars = h('div', { class: 'bars', role: 'radiogroup', 'aria-label': '목 상태' });
  for (let i = 1; i <= 5; i++) bars.append(h('button', { class: 'bar' + (c && i <= c ? ' on' : ''), role: 'radio', 'aria-checked': String(c === i), 'aria-label': `목 상태 ${COND_LABELS[i - 1]}`, onclick: () => setDay(d => { d.cond = d.cond === i ? null : i; }) }, h('i', { style: `height:${8 + i * 5}px` })));
  const sl = e && e.sleep != null ? e.sleep : null;
  const w = e ? e.water : 0;
  const cups = h('div', { class: 'cups' });
  for (let i = 1; i <= 8; i++) cups.append(h('button', { class: 'cup' + (i <= w ? ' on' : ''), 'aria-label': `물 ${i}잔`, 'aria-pressed': String(i <= w), html: CUP_SVG, onclick: () => setDay(d => { d.water = d.water === i ? i - 1 : i; }) }));
  return h('div', { class: 'sec', id: 'sec-cond' },
    h('div', { class: 'sec-h' }, h('h2', null, '컨디션')),
    h('div', { class: 'cond-line' }, h('span', { class: 'lbl' }, '목 상태'), bars, h('span', { class: 'val' }, c ? COND_LABELS[c - 1] : '')),
    h('div', { class: 'cond-chips chips' }, THROAT.map(t => {
      const on = !!(e && e.throat.includes(t));
      return h('button', { class: 'chip sm', 'aria-pressed': String(on), onclick: () => setDay(d => { const i = d.throat.indexOf(t); if (i >= 0) d.throat.splice(i, 1); else d.throat.push(t); }) }, t);
    })),
    h('div', { class: 'cond-line' }, h('span', { class: 'lbl' }, '잠'),
      h('div', { class: 'stepper' },
        h('button', { 'aria-label': '잠 30분 줄이기', onclick: () => setDay(d => { d.sleep = d.sleep == null ? 7 : Math.max(0, d.sleep - 0.5); }) }, '−'),
        h('span', { class: 'sv' + (sl == null ? ' none' : '') }, sl == null ? '안 적음' : `${sl}시간`),
        h('button', { 'aria-label': '잠 30분 늘리기', onclick: () => setDay(d => { d.sleep = d.sleep == null ? 7 : Math.min(14, d.sleep + 0.5); }) }, '+'))),
    h('div', { class: 'cond-line' }, h('span', { class: 'lbl' }, '물'), cups, h('span', { class: 'val' }, `${w}잔`)));
}
function GoalSec(date, e) {
  return h('div', { class: 'sec' },
    h('div', { class: 'sec-h' }, h('h2', null, '오늘의 목표')),
    autoTA({ class: 'input', rows: 1, placeholder: '예: 히싱 20초 넘기기, 후렴 음정 정확하게', value: e ? e.goal : '', 'data-fk': 'goal', 'aria-label': '오늘의 목표', oninput: ev => { ensureDay(date).goal = ev.target.value; touch(date); } }, 46));
}
function DrillSec(date) {
  const list = drillList(date);
  const doneN = list.filter(d => d.done >= d.target).length;
  const all = list.length > 0 && doneN === list.length;
  const reps = list.reduce((a, d) => a + Math.min(d.done, d.target), 0), total = list.reduce((a, d) => a + d.target, 0);
  const ordered = list.filter(d => d.done < d.target).concat(list.filter(d => d.done >= d.target));
  return h('div', { class: 'sec drills' + (all ? ' all' : ''), id: 'sec-drills' },
    h('div', { class: 'sec-h' }, h('h2', null, '기초 연습'), list.length ? h('span', { class: 'sec-note' }, all ? '모두 완료!' : `${list.length}개 중 ${doneN}개 완료`) : null, h('span', { class: 'sp' }),
      h('button', { class: 'icon-btn', 'aria-label': S.settings.sound ? '체크 소리 끄기' : '체크 소리 켜기', onclick: () => { S.settings.sound = !S.settings.sound; touchSettings(); render(); toast(S.settings.sound ? '체크할 때 음이 울려요' : '체크 소리를 껐어요'); } }, icon(S.settings.sound ? 'sound' : 'mute', 20)),
      h('button', { class: 'btn ghost sm', onclick: openDrillEditor }, '편집')),
    list.length ? h('div', { class: 'drill-prog', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': reps, 'aria-label': `기초 연습 ${reps}/${total}회` }, h('i', { style: `width:${total ? (reps / total * 100).toFixed(1) : 0}%` })) : null,
    all ? Stamp(S.justDone === date) : null,
    list.length ? ordered.map(d => DrillRow(date, d)) : h('p', { class: 'empty' }, '연습 항목이 없어요. 편집을 눌러 히싱, 스케일 같은 항목을 추가해 보세요.'));
}
function DrillRow(date, d) {
  const complete = d.done >= d.target;
  const best = d.timed ? bestTime(d.id) : null;
  const todayBest = d.times.length ? Math.max.apply(null, d.times) : null;
  if (complete && !S.openDrills.has(d.id) && S.popNote !== d.id) {
    return h('div', { class: 'drill done folded' },
      h('button', { class: 'drill-fold', 'aria-expanded': 'false', 'aria-label': `${d.name} ${d.target}회 완료, 펼치기`, onclick: () => { S.openDrills.add(d.id); render(); } },
        h('span', { class: 'fold-ck' }, icon('check', 16)),
        h('span', { class: 'drill-name' }, d.name),
        h('span', { class: 'fold-n' }, `${d.target}회 완료`),
        todayBest != null ? h('span', { class: 'fold-n' }, `최고 ${fmtSec(todayBest)}`) : null,
        h('span', { class: 'sp' }), icon('chevd', 18)));
  }
  return h('div', { class: 'drill' + (complete ? ' done' : '') },
    complete ? h('button', { class: 'drill-unfold', 'aria-label': '접기', onclick: () => { S.openDrills.delete(d.id); render(); } }, icon('chevu', 18)) : null,
    h('div', { class: 'drill-top' },
      h('span', { class: 'drill-name' }, d.name),
      d.memo ? h('span', { class: 'drill-memo' }, d.memo) : h('span', { class: 'sp' }),
      h('span', { class: 'drill-count' }, complete ? '완료' : [h('b', null, d.done), ` / ${d.target}회`])),
    h('button', { class: 'staff-btn', disabled: complete, 'aria-label': complete ? `${d.name} 완료` : `${d.name} 1회 체크, 지금 ${d.done}회`, html: staffSVG(d.target, d.done, complete, S.popNote === d.id), onclick: () => bump(date, d.id, 1) }),
    h('div', { class: 'drill-bottom' },
      h('span', { class: 'drill-rec' }, todayBest != null ? h('span', null, `오늘 최고 ${fmtSec(todayBest)}`) : null, best ? h('span', null, `최고 기록 ${fmtSec(best.sec)}`) : null),
      h('div', { class: 'drill-acts' },
        h('button', { class: 'btn soft sm sq', 'aria-label': `${d.name} 체크 하나 지우기`, disabled: d.done === 0, onclick: () => bump(date, d.id, -1) }, icon('minus', 18)),
        d.timed ? h('button', { class: 'btn soft sm', onclick: () => openStopwatch(date, d.id) }, icon('timer', 18), '재기') : null,
        h('button', { class: 'btn blue sm btn-check', disabled: complete, onclick: () => bump(date, d.id, 1) }, complete ? [icon('check', 18), '다 했어요'] : [icon('plus', 18), '1회']))));
}
function bump(date, id, delta, sec) {
  const t = S.settings.drills.find(x => x.id === id);
  const e = ensureDay(date);
  snapshotDrills(e);
  let s = e.drills[id];
  if (!s) { if (!t) return; s = e.drills[id] = { name: t.name, target: t.target, done: 0, times: [] }; }
  if (t) s.name = t.name;
  const before = Math.min(s.done || 0, s.target);
  const next = Math.max(0, Math.min(s.target, before + delta));
  if (next === before && sec == null) return;
  s.done = next;
  if (sec != null) s.times = (s.times || []).concat(Math.round(sec * 10) / 10);
  touch(date);
  if (next > before) {
    S.popNote = id;
    const all = drillsAllDone(date);
    if (next >= s.target) {
      S.openDrills.delete(id);
      if (all) { S.justDone = date; Sound.fanfare(); vibrate([16, 60, 16, 60, 34]); toast('기초 연습을 모두 끝냈어요! 참 잘했어요'); }
      else { Sound.done(next - 1); vibrate([12, 50, 22]); toast(`${s.name} ${s.target}회 완료`); }
      setTimeout(() => { if (S.tab === 'today' && S.date === date) softRender(); }, 1600);
    } else { Sound.rep(next - 1); vibrate(10); }
  } else if (next < before) vibrate(6);
  render();
}
function SongSec(date, e) {
  const lib = songLib();
  const songs = e ? e.songs : [];
  const inp = h('input', { class: 'input', placeholder: '제목이나 가수, 초성(ㅂㅇㄱ)도 돼요', 'data-fk': 'song', enterkeyhint: 'done', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': '부른 노래 찾아서 추가' });
  const sugg = SongSuggest(inp, {
    free: true,
    skip: () => new Set(((S.days[date] || {}).songs || []).map(s => normKey(s.title))),
    onPick: p => addSong(date, p.title, p),
    onFree: t => addSong(date, t)
  });
  const add = () => { if (!inp.isConnected || sugg.takeActive()) return; addSong(date, inp.value); };
  bindEnter(inp, add);
  const recent = Array.from(lib.values()).filter(L => !songs.some(s => normKey(s.title) === L.key)).sort((a, b) => b.last.localeCompare(a.last)).slice(0, 8);
  const best = bestHigh();
  const sel = h('select', { class: 'input', 'aria-label': '오늘 낸 최고음', onchange: ev => { const v = ev.target.value; ensureDay(date).high = v ? +v : null; touch(date); render(); } });
  sel.append(h('option', { value: '' }, '기록 안 함'));
  for (let oct = 1; oct <= 4; oct++) {
    const g = h('optgroup', { label: `${oct}옥타브` });
    for (let pc = 0; pc < 12; pc++) { const m = (oct + 3) * 12 + pc; if (m >= HIGH_MIN && m <= HIGH_MAX) g.append(h('option', { value: m }, `${noteName(m)} (${noteSci(m)})`)); }
    sel.append(g);
  }
  sel.value = e && e.high != null ? String(e.high) : '';
  return h('div', { class: 'sec', id: 'sec-songs' },
    h('div', { class: 'sec-h' }, h('h2', null, '노래'), songs.length ? h('span', { class: 'sec-note' }, `${songs.length}곡`) : null),
    songs.length ? h('ul', { class: 'songs' }, songs.map(s => {
      const L = lib.get(normKey(s.title));
      const nth = L ? L.dates.filter(x => x <= date).length : 1;
      const sub = [s.artist, s.tone].filter(Boolean).join('  ');
      const art = L && L.cat && L.cat.art;
      return h('li', { class: 'song' },
        art ? artThumb(art, 40) : null,
        h('button', { class: 'song-btn', onclick: () => openSongEntry(date, s.id) },
          h('span', { class: 'song-t' }, s.title),
          sub ? h('span', { class: 'song-a' }, sub) : null,
          s.note ? h('span', { class: 'song-n' }, s.note) : null),
        h('span', { class: 'nth' }, nth === 1 ? '처음' : `${nth}번째`));
    })) : null,
    h('div', { class: 'composer' }, inp, h('button', { class: 'btn ink', onpointerdown: ev => ev.preventDefault(), onclick: add }, '추가')),
    sugg,
    recent.length ? h('div', { class: 'chips scroll quick' }, h('span', { class: 'hint' }, '다시 부르기'), recent.map(L => h('button', { class: 'chip sm', onclick: () => addSong(date, L.title) }, L.title))) : null,
    h('div', { class: 'high-row' }, h('span', { class: 'lbl' }, '오늘 낸 최고음'), sel, best ? h('span', { class: 'hint' }, `지금까지 최고 ${noteName(best.m)}`) : null));
}
/* pick: a suggestion ({ artist, cat } when it came from the song catalog) */
function addSong(date, raw, pick) {
  const title = String(raw || '').trim().slice(0, 60);
  if (!title) return;
  const e = ensureDay(date);
  const k = normKey(title);
  if (e.songs.some(s => normKey(s.title) === k)) { toast('이미 추가한 노래예요'); return; }
  const L = songLib().get(k);
  const artist = (L && L.artist) || (pick && pick.artist) || '';
  e.songs.push({ id: uid('s'), title: L ? L.title : title, artist, tone: L ? L.tone : '', note: '' });
  if (pick && pick.cat && !(L && L.cat)) linkSong(k, pick.cat, artist);
  touch(date);
  render({ focus: 'song' });
}
function RecSec(date, e) {
  const recs = e ? e.recs : [];
  const note = recs.length ? null : '바로 녹음하거나, 폰에 있는 녹음 파일(삼성 음성 녹음 m4a, mp3 등)을 불러오세요. 여러 개를 한 번에 골라도 돼요. 녹음 앱에서 ‘공유 > 노래일기’로 보내도 들어와요.';
  return h('div', { class: 'sec', id: 'sec-recs' },
    h('div', { class: 'sec-h' }, h('h2', null, '녹음'), recs.length ? h('span', { class: 'sec-note' }, `${recs.length}개`) : null),
    h('div', { class: 'rec-actions' },
      h('button', { class: 'btn redb', onclick: () => openRecorder(date) }, h('span', { class: 'dot white' }), '녹음하기'),
      h('button', { class: 'btn', onclick: () => pickAudio(date) }, icon('upload', 18), '파일 불러오기')),
    note ? h('p', { class: 'hint', style: 'margin-top:6px' }, note) : null,
    recs.length ? h('div', { class: 'recs' }, recs.map(r => RecRow(r, date))) : null);
}
function ReflectSec(date, e) {
  return h('div', { class: 'sec', id: 'sec-reflect' },
    h('div', { class: 'sec-h' }, h('h2', null, '돌아보기')),
    ['good', 'bad', 'fb'].map(k => ItemList(date, e, k)),
    h('div', { class: 'field memo-block' },
      h('div', { class: 'lbl-row' }, h('label', { class: 'lbl', for: 'ta-memo' }, '메모'), h('span', { class: 'sp' }),
        h('button', { class: 'btn ghost sm', onclick: () => openWriter(date, 'memo', '메모') }, icon('expand', 16), '크게 쓰기')),
      autoTA({ id: 'ta-memo', class: 'input lined', placeholder: '오늘 연습하며 느낀 것을 자유롭게 적어 보세요. 레슨에서 들은 말, 몸 상태, 떠오른 생각 무엇이든요.', value: e ? e.memo : '', 'data-fk': 'memo', oninput: ev => { ensureDay(date).memo = ev.target.value; touch(date); } }, 122)),
    h('div', { class: 'field' }, h('label', { class: 'lbl', for: 'ta-next' }, '다음 연습 때 할 것'),
      autoTA({ id: 'ta-next', class: 'input lined', placeholder: '예: 히싱 20초 넘기기, 2절 브릿지 숨 위치 바꾸기', value: e ? e.next : '', 'data-fk': 'next', oninput: ev => { ensureDay(date).next = ev.target.value; touch(date); } }, 66),
      h('span', { class: 'hint' }, '다음에 일기를 열면 맨 위에 보여 줘요.')),
    RatingRow(date, e));
}
function ItemList(date, e, kind) {
  const items = e ? e[kind] : [];
  return h('div', { class: 'ilist k-' + kind },
    h('div', { class: 'ilist-h' }, mark(kind), h('h3', null, KIND[kind].label), items.length ? h('span', { class: 'cnt' }, items.length) : null),
    items.length ? h('ul', { class: 'items' }, items.map(it => h('li', { class: (it.pinned ? 'pinned' : '') + (it.resolved ? ' resolved' : '') },
      h('button', { class: 'item-btn', onclick: () => openItem(date, kind, it.id) },
        h('span', { class: 'item-text' }, it.pinned ? h('span', { class: 'hl' }, it.text) : it.text),
        it.tag ? h('span', { class: 'tag' }, it.tag) : null,
        kind === 'fb' && it.from ? h('span', { class: 'from' }, it.from) : null,
        it.resolved ? h('span', { class: 'ok-mark' }, '해결') : null)))) : null,
    Composer(date, kind));
}
function Composer(date, kind) {
  const C = S.compose[kind];
  const inp = h('input', { class: 'input', placeholder: KIND[kind].ph, 'data-fk': 'c-' + kind, enterkeyhint: 'enter', autocomplete: 'off', 'aria-label': KIND[kind].label + ' 적기' });
  const extra = h('div', { class: 'c-extra' });
  const wrap = h('div', { class: 'composer-wrap' });
  let lastTap = 0;
  const add = () => {
    if (!inp.isConnected) return;
    const text = inp.value.trim();
    if (!text) { inp.focus(); return; }
    const d = ensureDay(date);
    const it = { id: uid('i'), text, tag: C.tag || null, pinned: false, resolved: false, at: Date.now() };
    if (kind === 'fb') it.from = C.from || '선생님';
    d[kind].push(it);
    C.tag = null;
    touch(date);
    render({ focus: 'c-' + kind });
  };
  bindEnter(inp, add);
  const keep = ev => { lastTap = Date.now(); ev.preventDefault(); };
  const again = kind !== 'fb' ? frequentItems(kind, date) : [];
  const drawExtra = () => {
    extra.replaceChildren(...[
      again.length ? h('div', { class: 'chips scroll' }, h('span', { class: 'hint' }, '자주 적은 것'), again.map(x => h('button', { class: 'chip sm again', type: 'button', onpointerdown: keep, onmousedown: keep, onclick: () => { inp.value = x.text; C.tag = x.tag || C.tag; add(); } }, x.text))) : null,
      h('div', { class: 'chips scroll' }, h('span', { class: 'hint' }, '주제'), S.settings.tags.map(t => h('button', { class: 'chip sm', type: 'button', 'aria-pressed': String(C.tag === t), onpointerdown: keep, onmousedown: keep, onclick: () => { C.tag = C.tag === t ? null : t; drawExtra(); inp.focus({ preventScroll: true }); } }, t))),
      kind === 'fb' ? h('div', { class: 'chips from-chips' }, h('span', { class: 'hint' }, '누가?'), FROM.map(f => h('button', { class: 'chip sm', type: 'button', 'aria-pressed': String(C.from === f), onpointerdown: keep, onmousedown: keep, onclick: () => { C.from = f; drawExtra(); inp.focus({ preventScroll: true }); } }, f))) : null].filter(Boolean));
  };
  drawExtra();
  inp.addEventListener('focus', () => wrap.classList.add('open'));
  wrap.addEventListener('focusout', () => setTimeout(() => {
    if (!wrap.isConnected) return;
    if (wrap.contains(document.activeElement) || inp.value.trim() || Date.now() - lastTap < 600 || C.tag) return;
    wrap.classList.remove('open');
  }, 250));
  wrap.append(h('div', { class: 'composer' }, inp, h('button', { class: 'btn soft sq', type: 'button', 'aria-label': KIND[kind].label + ' 추가', onpointerdown: keep, onmousedown: keep, onclick: add }, icon('plus', 20))), extra);
  if (C.tag) wrap.classList.add('open');
  return wrap;
}
/* texts written two or more times before (not on this day) — one tap to write them again */
function frequentItems(kind, date) {
  const cnt = new Map();
  const today = new Set(((S.days[date] || {})[kind] || []).map(it => normKey(it.text)));
  for (const d of Object.keys(S.days)) {
    if (d === date) continue;
    for (const it of S.days[d][kind]) {
      const k = normKey(it.text);
      if (!k || k.length > 40 || today.has(k)) continue;
      const c = cnt.get(k) || { text: it.text.trim(), tag: it.tag, n: 0, last: '' };
      c.n++; if (d > c.last) { c.last = d; c.text = it.text.trim(); c.tag = it.tag; }
      cnt.set(k, c);
    }
  }
  return Array.from(cnt.values()).filter(c => c.n >= 2).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 6);
}
/* full-screen writing for long notes */
function openWriter(date, key, label) {
  const e = S.days[date];
  const ta = h('textarea', { class: 'input lined writer', value: e ? e[key] : '', placeholder: '천천히 적어 보세요. 적는 대로 저장돼요.', 'aria-label': label, 'data-autofocus': '' });
  ta.addEventListener('input', () => { ensureDay(date)[key] = ta.value; touch(date); });
  const cnt = h('span', { class: 'hint' });
  const upd = () => { cnt.textContent = `${ta.value.length}자`; };
  ta.addEventListener('input', upd); upd();
  openSheet({ title: `${fmtMD(date)} ${label}`, body: h('div', { class: 'writer-wrap' }, ta, h('div', { class: 'writer-foot' }, cnt, h('span', { class: 'hint' }, '자동 저장'))), full: true, onClose: () => render() });
  setTimeout(() => { try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (x) { /* ignore */ } }, 330);
}
function RatingRow(date, e) {
  const r = e ? e.rating : null;
  const notes = h('div', { class: 'rating', role: 'radiogroup', 'aria-label': '오늘 연습 만족도' });
  for (let i = 1; i <= 5; i++) notes.append(h('button', { class: 'rnote' + (r && i <= r ? ' on' : ''), role: 'radio', 'aria-checked': String(r === i), 'aria-label': `${i}점, ${RATE_LABELS[i - 1]}`, html: NOTE_SVG, onclick: () => { const d = ensureDay(date); d.rating = d.rating === i ? null : i; touch(date); if (d.rating) Sound.rate(i); render(); } }));
  return h('div', { class: 'rating-wrap' }, h('span', { class: 'lbl' }, '오늘 연습은 어땠나요?'), h('div', { class: 'rating-line' }, notes, h('span', { class: 'rating-val' }, r ? RATE_LABELS[r - 1] : '')));
}
function deleteItem(date, kind, id) {
  const e = S.days[date];
  if (!e) return;
  const idx = e[kind].findIndex(x => x.id === id);
  if (idx < 0) return;
  const [item] = e[kind].splice(idx, 1);
  touch(date); render();
  toast('지웠어요', { action: '되돌리기', onAction: () => { const d = ensureDay(date); d[kind].splice(Math.min(idx, d[kind].length), 0, item); touch(date); render(); } });
}
function summaryText(date) {
  const e = S.days[date];
  if (!hasContent(e)) return '';
  const L = [`[노래일기] ${fmtMDW(date)}`];
  const cond = [];
  if (e.cond) cond.push(`목 ${COND_LABELS[e.cond - 1]}`);
  if (e.throat.length) cond.push(e.throat.join('/'));
  if (e.sleep != null) cond.push(`잠 ${e.sleep}시간`);
  if (e.water) cond.push(`물 ${e.water}잔`);
  if (cond.length) L.push(`컨디션: ${cond.join(', ')}`);
  if (e.goal.trim()) L.push(`오늘의 목표: ${e.goal.trim()}`);
  const dl = drillList(date).filter(d => d.done > 0 || date === todayStr());
  if (dl.length && Object.keys(e.drills).length) L.push(`기초 연습: ${dl.map(d => `${d.name} ${d.done}/${d.target}`).join(', ')}`);
  if (e.songs.length) L.push(`노래: ${e.songs.map(s => s.title + ([s.artist, s.tone].filter(Boolean).length ? ` (${[s.artist, s.tone].filter(Boolean).join(', ')})` : '') + (s.note ? ` - ${s.note}` : '')).join(' / ')}`);
  if (e.high != null) L.push(`오늘 낸 최고음: ${noteName(e.high)} (${noteSci(e.high)})`);
  for (const k of ['good', 'bad', 'fb']) if (e[k].length) { L.push(''); L.push(KIND[k].label); e[k].forEach(it => L.push(`- ${it.text}${it.tag ? ` [${it.tag}]` : ''}${k === 'fb' && it.from ? ` (${it.from})` : ''}`)); }
  if (e.memo.trim()) { L.push(''); L.push(`메모: ${e.memo.trim()}`); }
  if (e.next.trim()) L.push(`다음 연습 때 할 것: ${e.next.trim()}`);
  const tail = [];
  if (e.minutes) tail.push(`연습 ${fmtMin(e.minutes)}`);
  if (e.rating) tail.push(`만족도 ${e.rating}/5 (${RATE_LABELS[e.rating - 1]})`);
  if (e.recs.length) tail.push(`녹음 ${e.recs.length}개`);
  if (tail.length) { L.push(''); L.push(tail.join(', ')); }
  return L.join('\n');
}
async function copySummary(date) {
  const text = summaryText(date);
  if (!text) { toast('아직 적은 내용이 없어요'); return; }
  try { await navigator.clipboard.writeText(text); toast('요약을 복사했어요. 메신저에 붙여 넣으면 돼요.'); }
  catch (e) {
    const ta = h('textarea', { class: 'input', readOnly: true, rows: 12, value: text, style: 'min-height:240px' });
    openSheet({ title: '요약', body: h('div', null, h('p', { class: 'hint', style: 'margin-bottom:10px' }, '아래 글을 길게 눌러 전체 선택한 뒤 복사하세요.'), ta) });
    setTimeout(() => { try { ta.focus(); ta.select(); } catch (err) { /* ignore */ } }, 350);
  }
}
async function shareSummary(date) {
  const text = summaryText(date);
  if (!text) { toast('아직 적은 내용이 없어요'); return; }
  try { if (!(await Files.share({ title: `노래일기 ${fmtMD(date)}`, text }))) copySummary(date); } catch (e) { copySummary(date); }
}

/* ================= recordings UI ================= */
function RecRow(r, date, opts = {}) {
  const marks = (r.marks || []).filter(m => r.dur && m.t <= r.dur);
  const track = h('div', { class: 'track', role: 'slider', tabindex: 0, 'aria-label': '재생 위치', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 },
    h('div', { class: 'loop-band', hidden: true }),
    h('div', { class: 'prog' }),
    marks.map(m => h('i', { class: 'tick', style: `left:${(m.t / r.dur * 100).toFixed(2)}%` })),
    h('div', { class: 'knob' }));
  bindTrack(track, r);
  const sub = opts.label || (opts.showDate ? fmtMD(date) : (r.songTitle || ''));
  return h('div', { class: 'rec' + (r.aud ? '' : ' missing'), 'data-rec': r.id, 'data-dur': r.dur || 0 },
    h('button', { class: 'play', 'aria-label': '재생', 'data-state': 'play', onclick: () => Player.toggle(r) }, icon('play', 22)),
    h('div', { class: 'rec-top' }, h('span', { class: 'rec-title' }, r.title || '녹음'), sub ? h('span', { class: 'rec-song' }, sub) : null,
      marks.length ? h('span', { class: 'rec-marks', 'aria-label': `구간 메모 ${marks.length}개` }, icon('flag', 13), marks.length) : null),
    h('button', { class: 'icon-btn star' + (r.fav ? ' on' : ''), 'aria-label': r.fav ? '베스트 표시 빼기' : '베스트로 표시', 'aria-pressed': String(!!r.fav), onclick: ev => {
      const cur = findRec(date, r.id); if (!cur) return;
      cur.fav = !cur.fav; touch(date);
      $$(`[data-rec="${r.id}"] .star`).forEach(b => { b.classList.toggle('on', cur.fav); b.setAttribute('aria-pressed', String(cur.fav)); });
      haptic(8);
      toast(cur.fav ? '베스트 녹음으로 표시했어요' : '베스트 표시를 뺐어요');
      softRender();
    } }, icon('star', 20)),
    h('div', { class: 'rec-bar' }, track, h('span', { class: 'rec-time' }, r.dur ? fmtDur(r.dur) : ''), h('button', { class: 'speed', hidden: true, 'aria-label': '재생 속도 바꾸기', onclick: () => Player.cycleRate() }, '1×')),
    h('button', { class: 'icon-btn more', 'aria-label': '녹음 자세히 보기', onclick: () => openRecDetail(date, r.id) }, icon('more', 20)));
}
function bindTrack(track, r) {
  const ratio = ev => { const b = track.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - b.left) / (b.width || 1))); };
  track.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    try { track.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    Player.seek(r, ratio(ev));
    const move = e2 => { if (Player.isCur(r.id)) Player.seek(r, ratio(e2)); };
    const up = () => { track.removeEventListener('pointermove', move); track.removeEventListener('pointerup', up); track.removeEventListener('pointercancel', up); };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
  });
  track.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight') { ev.preventDefault(); Player.nudge(r, 5); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); Player.nudge(r, -5); }
    else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); Player.toggle(r); }
  });
}
const fmtT = s => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`; };
function openRecDetail(date, id) {
  let r = findRec(date, id);
  if (!r) return;
  let curDate = date;
  const live = () => findRec(curDate, id);
  const titleInp = h('input', { class: 'input', value: r.title || '', maxlength: 60, 'aria-label': '녹음 이름' });
  titleInp.addEventListener('input', debounce(() => { const c = live(); if (!c) return; c.title = titleInp.value.trim() || '녹음'; touch(curDate); }, 400));
  const songSel = songSelect(date, r.song || '');
  songSel.addEventListener('change', () => { const c = live(); if (!c) return; c.song = songSel.value || null; c.songTitle = songTitleFor(curDate, c.song); touch(curDate); });
  const dateInp = h('input', { class: 'input', type: 'date', max: todayStr(), value: date, 'aria-label': '녹음한 날짜' });
  dateInp.addEventListener('change', () => {
    const nd = dateInp.value;
    if (!isDateKey(nd) || nd > todayStr() || nd === curDate) { dateInp.value = curDate; return; }
    const from = S.days[curDate]; const c = live(); if (!from || !c) return;
    from.recs = from.recs.filter(x => x.id !== id); touch(curDate);
    const to = ensureDay(nd); to.recs.push(c); touch(nd);
    toast(`${fmtMD(nd)} 기록으로 옮겼어요`);
    curDate = nd;
    refreshRow();
  });

  /* player block */
  const rowBox = h('div', { class: 'recs detail-row' }, RecRow(r, date, { label: fmtMD(date) }));
  const speedSeg = h('div', { class: 'seg speed-seg', role: 'group', 'aria-label': '재생 속도' });
  const drawSpeed = () => speedSeg.replaceChildren(...[0.5, 0.75, 1, 1.25].map(v => segBtn(v === 1 ? '보통' : v + '×', Player.rate === v, () => { Player.setRate(v); drawSpeed(); })));
  drawSpeed();
  const ctrl = h('div', { class: 'det-ctrl' },
    h('button', { class: 'btn soft sm', 'aria-label': '5초 뒤로', onclick: () => { if (!Player.isCur(id)) Player.toggle(live()); else Player.nudge(live(), -5); } }, icon('back5', 18), '5초'),
    speedSeg,
    h('button', { class: 'btn soft sm', 'aria-label': '5초 앞으로', onclick: () => { if (!Player.isCur(id)) Player.toggle(live()); else Player.nudge(live(), 5); } }, '5초', icon('fwd5', 18)));

  /* A-B loop */
  const loopBox = h('div', { class: 'loop-box' });
  const drawLoop = () => {
    const L = Player.loop && Player.loop.id === id ? Player.loop : null;
    const setA = () => { const t = Player.isCur(id) ? Player.time() : 0; Player.loop = { id, a: t, b: L && L.b > t ? L.b : Math.min((live().dur || t + 10), t + 10) }; drawLoop(); Player.sync(); };
    const setB = () => { if (!Player.isCur(id)) { toast('먼저 재생하면서 끝낼 지점에서 눌러 주세요'); return; } const t = Player.time(); const a = L ? L.a : 0; if (t <= a + 0.3) { toast('시작 지점보다 뒤에서 눌러 주세요'); return; } Player.loop = { id, a, b: t }; drawLoop(); Player.sync(); Player.seekTo(live(), a); };
    loopBox.replaceChildren(
      h('div', { class: 'loop-top' }, icon('repeat', 18), h('span', { class: 'lbl' }, '구간 반복'), h('span', { class: 'sp' }),
        L ? h('span', { class: 'loop-val' }, `${fmtT(L.a)} → ${fmtT(L.b)}`) : h('span', { class: 'hint' }, '어려운 부분만 계속 들어요')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn soft sm', onclick: setA }, '여기서부터'),
        h('button', { class: 'btn soft sm', onclick: setB }, '여기까지'),
        L ? h('button', { class: 'btn ghost sm', onclick: () => { Player.loop = null; drawLoop(); Player.sync(); } }, '반복 끄기') : null));
  };
  drawLoop();

  /* time-stamped notes */
  const markBox = h('div', { class: 'marks' });
  const drawMarks = focusId => {
    const c = live(); if (!c) return;
    const list = (c.marks || []).slice().sort((a, b) => a.t - b.t);
    markBox.replaceChildren(
      h('div', { class: 'marks-h' }, icon('flag', 17), h('span', { class: 'lbl' }, '구간 메모'), list.length ? h('span', { class: 'hint' }, `${list.length}개`) : null, h('span', { class: 'sp' }),
        h('button', { class: 'btn ink sm', onclick: () => {
          const cc = live(); if (!cc) return;
          const t = Player.isCur(id) ? Math.round(Player.time() * 10) / 10 : 0;
          const m = { id: uid('m'), t, text: '' };
          cc.marks = (cc.marks || []).concat(m); touch(curDate);
          if (Player.isCur(id) && Player.playing()) Player.eng().pause();
          drawMarks(m.id); refreshRow();
        } }, icon('plus', 16), '지금 위치에 메모')),
      list.length ? h('div', { class: 'mark-list' }, list.map((m, i) => {
        const inp = h('input', { class: 'input small', value: m.text, placeholder: `예: 여기 음정 떨어짐, 숨 부족`, maxlength: 80, 'aria-label': `${fmtT(m.t)} 메모` });
        inp.addEventListener('input', debounce(() => { const cc = live(); const mm = cc && (cc.marks || []).find(x => x.id === m.id); if (mm) { mm.text = inp.value.trim(); touch(curDate); } }, 350));
        if (focusId === m.id) setTimeout(() => inp.focus(), 60);
        return h('div', { class: 'mark' },
          h('button', { class: 'mark-t', 'aria-label': `${fmtT(m.t)}부터 듣기`, onclick: () => Player.seekTo(live(), Math.max(0, m.t - 1.5)) }, icon('play', 12), fmtT(m.t)),
          inp,
          h('button', { class: 'icon-btn', 'aria-label': '메모 지우기', onclick: () => { const cc = live(); if (!cc) return; cc.marks = (cc.marks || []).filter(x => x.id !== m.id); touch(curDate); drawMarks(); refreshRow(); } }, icon('x', 17)));
      })) : h('p', { class: 'hint' }, '들으면서 신경 쓰이는 곳에서 누르면 그 시간에 메모가 붙어요. 누르면 그 부분부터 다시 들어요.'));
  };
  const refreshRow = () => { const c = live(); if (c) { rowBox.replaceChildren(RecRow(c, curDate, { label: fmtMD(curDate) })); Player.sync(); } };
  drawMarks();

  const info = [r.at ? fmtHM(r.at) : '', r.src === 'mic' ? '바로 녹음' : r.src === 'share' ? '다른 앱에서 받음' : '파일에서 불러옴', [r.dur ? fmtDur(r.dur) : '', r.size ? fmtMB(r.size) : ''].filter(Boolean).join(', ')].filter(Boolean);
  let s = null;
  s = openSheet({
    title: r.title || '녹음',
    body: h('div', null,
      rowBox, ctrl, loopBox, markBox,
      h('div', { class: 'det-fields' },
        field('이름', titleInp), field('어떤 노래의 녹음인가요?', songSel), field('녹음한 날짜', dateInp, '다른 날에 녹음한 파일이면 날짜를 바꿔서 그날 기록으로 옮겨요.')),
      h('div', { class: 'kv' }, info.map(t => h('span', null, t))),
      h('div', { class: 'btn-row' },
        r.aud ? h('button', { class: 'btn soft', onclick: () => shareRec(curDate, live()) }, icon('share', 18), '보내기') : null,
        r.aud && Native.isNative ? h('button', { class: 'btn soft', onclick: () => saveRecToPhone(curDate, live()) }, icon('down', 18), '폰에 저장') : null,
        h('button', { class: 'btn ghost danger', onclick: () => { closeSheet(s, true); confirmDeleteRec(curDate, id); } }, icon('trash', 18), '삭제'))),
    onClose: () => { document.removeEventListener('player-tick', onTick); render(); }
  });
  const onTick = () => { if (!s.closed) { const L = Player.loop; const lv = loopBox.querySelector('.loop-val'); if (lv && L && L.id === id) lv.textContent = `${fmtT(L.a)} → ${fmtT(L.b)}`; } };
  document.addEventListener('player-tick', onTick);
}
function confirmDeleteRec(date, id) {
  const r = findRec(date, id);
  if (!r) return;
  confirmSheet({ title: '이 녹음을 지울까요?', text: `‘${r.title || '녹음'}’을(를) 지우면 되돌릴 수 없어요. 필요하면 먼저 ‘보내기’나 ‘폰에 저장’으로 파일을 남겨 두세요.`, ok: '지우기', danger: true, onOk: async () => {
    Player.release(id, r.aud);
    const e = S.days[date];
    if (!e) return;
    e.recs = e.recs.filter(x => x.id !== id);
    touch(date); render();
    try { if (r.aud && !usedAudioIds().has(r.aud)) await Store.del('audio', r.aud); } catch (err) { /* cleaned up later in settings */ }
    toast('녹음을 지웠어요');
  } });
}
function recFileName(date, r, blob) { return `${date} ${r.title || '녹음'}.${extFor(r.mime || (blob && blob.type))}`; }
async function shareRec(date, r) {
  if (!r) return;
  try {
    const blob = await audioBlob(r);
    if (!blob) { toast('녹음 파일을 찾지 못했어요'); return; }
    await Files.share({ title: r.title || '녹음', text: `[노래일기] ${fmtMD(date)} ${r.title || '녹음'}${r.songTitle ? ` (${r.songTitle})` : ''}`, files: [{ name: recFileName(date, r, blob), blob }] });
  } catch (err) { console.error(err); toast('보내지 못했어요. 다시 시도해 주세요.'); }
}
async function saveRecToPhone(date, r) {
  if (!r) return;
  try {
    const blob = await audioBlob(r);
    if (!blob) { toast('녹음 파일을 찾지 못했어요'); return; }
    const where = await Files.saveToDocuments('녹음', recFileName(date, r, blob), blob);
    toast(where ? `${where}에 저장했어요` : '파일로 저장했어요');
  } catch (err) { console.error(err); toast('저장하지 못했어요.'); }
}
function pickAudio(date) {
  const inp = $('#file-audio');
  inp.value = '';
  inp.onchange = () => { const fl = Array.from(inp.files || []); if (fl.length) openImport(date, fl, 'file'); };
  inp.click();
}
/* Import one or many audio files (from the file picker or shared from another app) */
async function openImport(date, files, src) {
  files = files.filter(f => f && f.size > 0);
  if (!files.length) { toast('불러올 파일이 없어요'); return; }
  const big = files.filter(f => f.size > MAX_AUDIO);
  if (big.length) { toast(`300MB보다 큰 파일 ${big.length}개는 빼고 넣어요`); files = files.filter(f => f.size <= MAX_AUDIO); if (!files.length) return; }
  const now = Date.now();
  const fileDate = f => (f.lastModified && now - f.lastModified > 90000 ? ymd(new Date(f.lastModified)) : null);
  const hasOwnDates = files.some(f => { const d = fileDate(f); return d && d !== date && d <= todayStr(); });
  let mode = hasOwnDates ? 'own' : 'here';
  const items = files.map(f => ({ f, title: f.name.replace(/\.[^.]+$/, '').slice(0, 60) || '녹음', dur: null }));
  items.forEach(it => { sniff(it.f).then(k => probeDuration(it.f, k)).then(d => { it.dur = d; if (it.hint) it.hint.textContent = hintOf(it); }); });
  const hintOf = it => [fmtMB(it.f.size), it.dur ? fmtDur(it.dur) : '', mode === 'own' || items.length > 1 ? `${fmtMD(dateOf(it))} 기록` : ''].filter(Boolean).join(' · ');
  const songSel = songSelect(date, defaultSongKey(date));
  const list = h('div', { class: 'imp-list' });
  const modeBox = h('div');
  const drawMode = () => {
    if (!hasOwnDates) return;
    modeBox.replaceChildren(h('div', { class: 'field' }, h('span', { class: 'lbl' }, '어느 날 기록에 넣을까요?'),
      h('div', { class: 'seg' },
        segBtn(`${fmtMD(date)}`, mode === 'here', () => { mode = 'here'; drawMode(); drawList(); }),
        segBtn('파일을 녹음한 날', mode === 'own', () => { mode = 'own'; drawMode(); drawList(); }))));
  };
  const dateOf = it => (mode === 'own' ? (fileDate(it.f) && fileDate(it.f) <= todayStr() ? fileDate(it.f) : date) : date);
  const drawList = () => {
    list.replaceChildren(...items.map((it, i) => {
      const inp = h('input', { class: 'input small', value: it.title, maxlength: 60, 'aria-label': `${i + 1}번째 녹음 이름`, oninput: ev => { it.title = ev.target.value; } });
      return h('div', { class: 'file-card' }, icon('music', 22),
        h('div', { class: 'fc-b' }, inp, it.hint = h('span', { class: 'hint' }, hintOf(it))),
        items.length > 1 ? h('button', { class: 'icon-btn', 'aria-label': '이 파일 빼기', onclick: () => { items.splice(i, 1); if (!items.length) closeSheet(s, true); else drawList(); } }, icon('x', 18)) : null);
    }));
    saveBtn.textContent = items.length > 1 ? `${items.length}개 넣기` : '넣기';
  };
  let s = null;
  const saveBtn = h('button', { class: 'btn ink' }, '넣기');
  drawMode(); drawList();
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    let ok = 0;
    const touched = new Set();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      saveBtn.textContent = items.length > 1 ? `넣는 중… ${i + 1}/${items.length}` : '넣는 중…';
      try {
        const [info, dur] = await Promise.all([storeAudio(it.f, it.f.name), it.dur != null ? it.dur : sniff(it.f).then(k => probeDuration(it.f, k))]);
        const d = dateOf(it);
        const song = songSel.value || null;
        const e = ensureDay(d);
        e.recs.push({ id: uid('r'), aud: info.aud, mime: info.mime, size: info.size, title: String(it.title || '').trim() || '녹음', song, songTitle: songTitleFor(date, song), dur: dur || 0, fav: false, at: it.f.lastModified && now - it.f.lastModified > 90000 ? it.f.lastModified : Date.now(), src: src || 'file', marks: [] });
        touch(d); touched.add(d); ok++;
      } catch (err) { console.error(err); toast(assetErrMsg(err)); }
    }
    closeSheet(s, true);
    render();
    if (ok) {
      const ds = Array.from(touched);
      toast(ok > 1 ? `녹음 ${ok}개를 넣었어요` : '녹음을 넣었어요', ds.length === 1 && ds[0] !== S.date ? { action: `${fmtMD(ds[0])} 보기`, onAction: () => goDate(ds[0]) } : {});
    }
  };
  s = openSheet({
    title: src === 'share' ? '받은 녹음 넣기' : (items.length > 1 ? `녹음 ${items.length}개 불러오기` : '녹음 불러오기'),
    body: h('div', null, list, modeBox, field('어떤 노래의 녹음인가요?', songSel, items.length > 1 ? '모든 파일에 똑같이 붙어요. 나중에 하나씩 바꿀 수 있어요.' : null),
      !hasOwnDates ? h('p', { class: 'hint' }, `${fmtMDW(date)} 기록에 넣어요.`) : null),
    foot: [saveBtn]
  });
}
function micFallback(date, reason) {
  const denied = reason === 'NotAllowedError' || reason === 'SecurityError';
  const msg = denied ? '마이크 권한이 꺼져 있어요.' : reason === 'NotFoundError' ? '마이크를 찾지 못했어요.' : '지금은 바로 녹음을 쓸 수 없어요.';
  let s = null;
  s = openSheet({ title: '녹음', body: h('div', null,
    h('p', { style: 'font-weight:600;margin-bottom:6px' }, msg),
    h('p', { class: 'hint', style: 'margin-bottom:16px' }, denied && Native.isNative ? '앱 설정 > 권한 > 마이크에서 ‘앱 사용 중에만 허용’을 켜 주세요. 삼성 음성 녹음 앱으로 녹음한 다음 불러와도 똑같이 저장돼요.' : '폰의 음성 녹음 앱으로 녹음한 다음 불러오면 똑같이 저장돼요.'),
    denied && Native.isNative ? h('button', { class: 'btn ink wide', onclick: () => { closeSheet(s, true); Native.openAppSettings(); } }, icon('gear', 18), '앱 설정 열기') : null,
    h('button', { class: 'btn soft wide', style: 'margin-top:8px', onclick: () => { closeSheet(s, true); pickAudio(date); } }, icon('upload', 18), '녹음 파일 고르기')) });
}
function pickMime() {
  const c = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const m of c) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* ignore */ } }
  return '';
}
async function openRecorder(date) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { micFallback(date, 'unsupported'); return; }
  Player.stopAll();
  let actx = null;
  try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); } catch (e) { actx = null; }
  let stream = null, rec = null, chunks = [], mime = '', tick = 0, raf = 0, blob = null, durSec = 0, previewUrl = null, stage = 'init', warned = 0;
  let acc = 0, segStart = 0, marks = [];
  const elapsed = () => acc + (stage === 'recording' ? (performance.now() - segStart) / 1000 : 0);
  const barsN = 30;
  const status = h('p', { class: 'hint' }, '마이크를 준비하고 있어요…');
  const timeEl = h('div', { class: 'rc-time' }, '0:00');
  const meter = h('div', { class: 'rc-meter', 'aria-hidden': 'true' });
  for (let i = 0; i < barsN; i++) meter.append(h('i'));
  const markInfo = h('p', { class: 'rc-marks hint' });
  const acts = h('div', { class: 'rc-acts' });
  /* backing track (MR) played inside the app — leaving the app would cut the microphone */
  let mr = null, lastMr = null;
  const mrBox = h('div', { class: 'mr-box' });
  const mrStop = () => { if (mr) { mr.audio.pause(); } };
  const loadMr = (blob, name, save) => {
    if (mr) { mr.audio.pause(); URL.revokeObjectURL(mr.url); }
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.preload = 'auto';
    a.addEventListener('ended', () => drawMr());
    mr = { audio: a, url, name };
    if (save) { lastMr = { blob, name }; Store.put('meta', 'mr', { blob, name }).catch(() => {}); }
    drawMr();
  };
  const pickMr = () => {
    const inp = h('input', { type: 'file', accept: 'audio/*' });
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f) loadMr(f, f.name.replace(/\.[^.]+$/, '') || '반주', true); });
    inp.click();
  };
  const drawMr = () => {
    if (stage === 'review' || stage === 'saved') { mrBox.replaceChildren(); return; }
    if (!mr) {
      mrBox.replaceChildren(h('div', { class: 'mr-row' }, icon('music', 18), h('span', { class: 'mr-name' }, '반주(MR) 틀고 녹음하기'), h('span', { class: 'sp' }),
        lastMr ? h('button', { class: 'btn soft sm', onclick: () => loadMr(lastMr.blob, lastMr.name) }, '지난 반주') : null,
        h('button', { class: 'btn soft sm', onclick: pickMr }, '불러오기')));
      return;
    }
    const playing = !mr.audio.paused;
    mrBox.replaceChildren(h('div', { class: 'mr-row on' }, icon('music', 18), h('span', { class: 'mr-name clip' }, mr.name), h('span', { class: 'sp' }),
      h('button', { class: 'btn soft sm', onclick: () => { if (mr.audio.paused) mr.audio.play().catch(() => {}); else mr.audio.pause(); setTimeout(drawMr, 50); } }, icon(playing ? 'pause' : 'play', 16), playing ? '멈춤' : '듣기'),
      h('button', { class: 'icon-btn', 'aria-label': '반주 빼기', onclick: () => { mr.audio.pause(); URL.revokeObjectURL(mr.url); mr = null; drawMr(); } }, icon('x', 18))),
      h('p', { class: 'hint', style: 'margin-top:4px;text-align:left' }, stage === 'ready' ? '녹음 시작을 누르면 반주도 처음부터 같이 나와요. 이어폰을 끼면 목소리만 녹음돼요.' : ''));
  };
  Store.get('meta', 'mr').then(v => { if (v && v.blob) { lastMr = v; drawMr(); } }).catch(() => {});
  let leftAt = 0;
  const onVis = () => {
    if (document.visibilityState === 'hidden' && (stage === 'recording')) leftAt = Date.now();
    else if (document.visibilityState === 'visible' && leftAt) { leftAt = 0; status.textContent = '앱을 나갔다 오면 그동안은 녹음이 안 될 수 있어요. 반주는 여기 ‘반주 틀고 녹음하기’로 틀어 주세요.'; status.style.color = 'var(--red)'; }
  };
  document.addEventListener('visibilitychange', onVis);
  const box = h('div', { class: 'recorder' }, status, timeEl, meter, markInfo, mrBox, acts);
  const cleanup = () => {
    cancelAnimationFrame(raf); clearInterval(tick);
    document.removeEventListener('visibilitychange', onVis);
    if (mr) { mr.audio.pause(); URL.revokeObjectURL(mr.url); mr = null; }
    try { if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); } } catch (e) { /* ignore */ }
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (actx) actx.close().catch(() => {});
    Native.keepAwake(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  };
  const sheet = openSheet({ title: '녹음', body: box, onClose: cleanup, beforeClose: () => {
    if (stage === 'recording' || stage === 'paused') { status.textContent = '먼저 ‘끝내기’를 눌러 녹음을 마쳐 주세요.'; status.style.color = 'var(--red)'; return false; }
    if (stage === 'review' && Date.now() - warned > 3000) { warned = Date.now(); status.textContent = '저장하지 않은 녹음이 있어요. 그래도 닫으려면 한 번 더 누르세요.'; status.style.color = 'var(--red)'; return false; }
    return true;
  } });
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (err) { closeSheet(sheet, true); micFallback(date, err && err.name); return; }
  if (sheet.closed) { stream.getTracks().forEach(t => t.stop()); return; }
  try {
    if (actx) {
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      const an = actx.createAnalyser(); an.fftSize = 1024;
      actx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize), bars = $$('i', meter), hist = new Array(barsN).fill(0);
      let last = 0, hotUntil = 0;
      const loop = ts => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > peak) peak = v; }
        if (peak > 0.98) hotUntil = ts + 1200;
        if (ts - last > 50) { last = ts; hist.shift(); hist.push(stage === 'paused' ? 0 : peak); bars.forEach((b, i) => { b.style.transform = `scaleY(${Math.max(0.06, Math.min(1, hist[i] * 1.5)).toFixed(3)})`; }); meter.classList.toggle('hot', ts < hotUntil); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
  } catch (e) { /* meter is optional */ }
  const drawMarks = () => { markInfo.textContent = marks.length ? `표시 ${marks.length}개: ${marks.map(m => fmtT(m.t)).join(', ')}` : ''; };
  const idle = () => {
    stage = 'ready';
    status.style.color = '';
    status.textContent = actx ? '소리를 내 보며 막대가 움직이는지 확인하고 시작하세요. 막대가 노랗게 되면 폰을 조금 멀리 두세요.' : '준비됐어요.';
    timeEl.textContent = '0:00';
    acc = 0; marks = []; drawMarks();
    box.classList.remove('on', 'paused');
    drawMr();
    acts.replaceChildren(h('button', { class: 'btn redb big wide', onclick: begin }, h('span', { class: 'dot white' }), '녹음 시작'));
  };
  const recActs = () => {
    const paused = stage === 'paused';
    acts.replaceChildren(
      h('div', { class: 'rc-row' },
        rec && typeof rec.pause === 'function' ? h('button', { class: 'btn soft big', onclick: () => {
          if (stage === 'recording') { try { rec.pause(); } catch (e) { return; } acc = elapsed(); stage = 'paused'; box.classList.add('paused'); mrStop(); status.textContent = '잠깐 멈췄어요. 이어서 녹음하거나 끝내세요.'; }
          else { try { rec.resume(); } catch (e) { return; } segStart = performance.now(); stage = 'recording'; box.classList.remove('paused'); if (mr) mr.audio.play().catch(() => {}); status.textContent = '녹음 중이에요.'; }
          haptic(10); recActs(); drawMr();
        } }, icon(paused ? 'mic' : 'pause', 20), paused ? '이어서' : '잠깐 멈춤') : null,
        h('button', { class: 'btn soft big', disabled: paused, onclick: () => { const t = Math.round(elapsed() * 10) / 10; marks.push({ id: uid('m'), t, text: '' }); drawMarks(); haptic(14); toast(`${fmtT(t)}에 표시했어요`); } }, icon('flag', 20), '여기 표시')),
      h('button', { class: 'btn ink big wide', onclick: () => { clearInterval(tick); durSec = elapsed(); stage = 'stopping'; mrStop(); try { rec.stop(); } catch (e) { /* ignore */ } } }, icon('stop', 20), '끝내기'));
  };
  const begin = () => {
    mime = pickMime(); chunks = [];
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 160000 } : undefined); }
    catch (e) { try { rec = new MediaRecorder(stream); } catch (e2) { toast('녹음을 시작하지 못했어요.'); return; } }
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => { blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] }); review(); };
    rec.start(1000);
    segStart = performance.now(); acc = 0;
    stage = 'recording';
    tick = setInterval(() => { timeEl.textContent = fmtDur(elapsed()); }, 250);
    status.style.color = '';
    status.textContent = '녹음 중이에요. 화면은 켜진 채로 둘게요.';
    box.classList.add('on');
    Native.keepAwake(true);
    if (mr) { try { mr.audio.currentTime = 0; } catch (e) { /* ignore */ } mr.audio.play().catch(() => {}); }
    haptic(12);
    recActs(); drawMr();
  };
  const review = () => {
    stage = 'review';
    drawMr();
    box.classList.remove('on', 'paused');
    Native.keepAwake(false);
    timeEl.textContent = fmtDur(durSec);
    status.style.color = '';
    status.textContent = durSec < 1 ? '너무 짧게 녹음됐어요. 다시 녹음해 보세요.' : '들어 보고 저장하세요.';
    const e = S.days[date];
    const key = defaultSongKey(date);
    const sTitle = songTitleFor(date, key);
    const sameCount = e ? e.recs.filter(x => (x.song || '') === key).length : 0;
    const titleInp = h('input', { class: 'input', value: `${sTitle || '녹음'} ${sameCount + 1}`, maxlength: 60, 'aria-label': '녹음 이름' });
    const songSel = songSelect(date, key);
    songSel.addEventListener('change', () => { const t = songTitleFor(date, songSel.value); const n = (S.days[date] ? S.days[date].recs.filter(x => (x.song || '') === songSel.value).length : 0) + 1; titleInp.value = `${t || '녹음'} ${n}`; });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    let preview = null;
    try { previewUrl = URL.createObjectURL(blob); preview = h('audio', { controls: true, src: previewUrl, preload: 'metadata' }); preview.addEventListener('error', () => { preview.hidden = true; }); } catch (e2) { preview = null; }
    const saveBtn = h('button', { class: 'btn ink big wide' }, '저장하기');
    saveBtn.onclick = async () => {
      saveBtn.disabled = true; saveBtn.textContent = '저장하는 중…';
      try {
        const info = await storeAudio(blob, 'recording.' + extFor(blob.type));
        const song = songSel.value || null;
        const d = ensureDay(date);
        d.recs.push({ id: uid('r'), aud: info.aud, mime: info.mime, size: info.size, title: titleInp.value.trim() || '녹음', song, songTitle: songTitleFor(date, song), dur: Math.round(durSec * 10) / 10, fav: false, at: Date.now(), src: 'mic', marks: marks.slice() });
        touch(date);
        stage = 'saved';
        closeSheet(sheet, true); render(); toast(marks.length ? `녹음을 저장했어요. 표시한 곳에 메모를 달아 보세요.` : '녹음을 저장했어요');
      } catch (err) { saveBtn.disabled = false; saveBtn.textContent = '저장하기'; toast(assetErrMsg(err)); }
    };
    acts.replaceChildren(h('div', { class: 'rc-review' }, preview, field('이름', titleInp), field('어떤 노래의 녹음인가요?', songSel)), saveBtn,
      h('button', { class: 'btn soft wide', onclick: () => { if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; } blob = null; idle(); } }, '버리고 다시 녹음'));
  };
  idle();
}

/* ================= item / song / drill sheets ================= */
function openItem(date, kind, id) {
  const it = findItem(date, kind, id);
  if (!it) return;
  const ta = autoTA({ class: 'input', value: it.text, 'aria-label': '내용' }, 70);
  let tag = it.tag || null, from = it.from || '선생님', pinned = !!it.pinned, resolved = !!it.resolved;
  const tagChips = h('div', { class: 'chips' }), fromChips = h('div', { class: 'chips' });
  const draw = () => {
    tagChips.replaceChildren(...S.settings.tags.map(t => h('button', { class: 'chip sm', 'aria-pressed': String(tag === t), onclick: () => { tag = tag === t ? null : t; draw(); } }, t)));
    fromChips.replaceChildren(...FROM.map(f => h('button', { class: 'chip sm', 'aria-pressed': String(from === f), onclick: () => { from = f; draw(); } }, f)));
  };
  draw();
  let s = null;
  const save = h('button', { class: 'btn ink', onclick: () => {
    const text = ta.value.trim();
    if (!text) { toast('내용을 적어 주세요'); return; }
    mutItem(date, kind, id, cur => {
      cur.text = text; cur.tag = tag;
      if (kind === 'fb') cur.from = from;
      cur.pinned = pinned;
      if (kind !== 'good') { if (resolved && !cur.resolved) cur.resolvedOn = todayStr(); if (!resolved) delete cur.resolvedOn; cur.resolved = resolved; }
    });
    closeSheet(s, true); render();
  } }, '저장');
  s = openSheet({
    title: KIND[kind].label,
    body: h('div', null,
      h('div', { class: 'kind-line' }, mark(kind), h('button', { class: 'date-link', onclick: () => { closeSheet(s, true); goDate(date); } }, `${fmtMDW(date)} 기록`)),
      field('내용', ta),
      field('주제', tagChips),
      kind === 'fb' ? field('누가 말해 줬나요?', fromChips) : null,
      ToggleRow('잊지 말 것으로 고정', pinned, v => { pinned = v; }, '오늘 화면 맨 위에 계속 보여 줘요', 'pin'),
      kind !== 'good' ? ToggleRow('해결했어요', resolved, v => { resolved = v; }, '피드백 모아보기에서 ‘해결함’으로 옮겨요', 'check') : null,
      h('button', { class: 'btn ghost danger wide', style: 'margin-top:10px', onclick: () => { closeSheet(s, true); deleteItem(date, kind, id); } }, icon('trash', 18), '지우기')),
    foot: [save]
  });
}
function openSongEntry(date, sid) {
  const e = S.days[date];
  const so = e && e.songs.find(x => x.id === sid);
  if (!so) return;
  const tInp = h('input', { class: 'input', value: so.title, maxlength: 60, 'aria-label': '노래 제목' });
  const aInp = h('input', { class: 'input', value: so.artist || '', maxlength: 40, placeholder: '예: 아이유', 'aria-label': '가수' });
  let picked = null;
  const tSugg = SongSuggest(tInp, { onPick: p => { tInp.value = p.title; if (p.artist) aInp.value = p.artist; picked = p; } });
  tInp.addEventListener('input', () => { picked = null; });
  const kInp = h('input', { class: 'input', value: so.tone || '', maxlength: 20, placeholder: '예: 원키, -2키', 'aria-label': '키' });
  const quickKeys = h('div', { class: 'chips', style: 'margin-top:8px' }, ['원키', '+1키', '-1키', '-2키', '-3키'].map(k => h('button', { class: 'chip sm', onclick: () => { kInp.value = k; } }, k)));
  const nInp = autoTA({ class: 'input lined', value: so.note || '', placeholder: '예: 2절 브릿지 숨 위치 바꿔 봄', 'aria-label': '오늘 이 노래 메모' }, 66);
  let s = null;
  const save = h('button', { class: 'btn ink', onclick: () => {
    const d = S.days[date]; const cur = d && d.songs.find(x => x.id === sid);
    if (!cur) { closeSheet(s, true); return; }
    const t = tInp.value.trim();
    if (!t) { toast('제목을 적어 주세요'); return; }
    const oldKey = normKey(cur.title), newKey = normKey(t);
    Object.assign(cur, { title: t, artist: aInp.value.trim(), tone: kInp.value.trim(), note: nInp.value.trim() });
    if (picked && picked.cat && normKey(picked.title) === newKey) linkSong(newKey, picked.cat, cur.artist);
    if (oldKey !== newKey) d.recs.forEach(r => { if (r.song === oldKey) { r.song = newKey; r.songTitle = t; } });
    touch(date); closeSheet(s, true); render();
  } }, '저장');
  s = openSheet({
    title: so.title,
    body: h('div', null,
      field('제목', h('div', null, tInp, tSugg)), field('가수', aInp),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, '키'), kInp, quickKeys),
      field('오늘 이 노래 메모', nInp),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn soft', onclick: () => { closeSheet(s, true); openSongDetail(normKey(so.title)); } }, icon('music', 18), '이 노래 기록 모아보기'),
        h('button', { class: 'btn ghost danger', onclick: () => { closeSheet(s, true); deleteItem(date, 'songs', sid); } }, icon('trash', 18), '오늘 목록에서 빼기'))),
    foot: [save]
  });
}
function openStopwatch(date, id) {
  const t = S.settings.drills.find(x => x.id === id);
  if (!t) return;
  let start = 0, raf = 0, elapsed = 0, state = 'idle';
  const prog = h('div', { class: 'sw-prog' });
  const big = h('div', { class: 'sw-big', 'aria-live': 'off' }, '0.0', h('small', null, '초'));
  const info = h('div', { class: 'sw-info' });
  const acts = h('div', { class: 'sw-acts' });
  const box = h('div', { class: 'sw' }, prog, big, info, acts);
  const cur = () => drillList(date).find(x => x.id === id) || { times: [], done: 0, target: t.target, name: t.name };
  const setBig = sec => { big.firstChild.textContent = sec.toFixed(1); };
  const refresh = () => {
    const d = cur();
    const best = bestTime(id);
    prog.textContent = d.done >= d.target ? `${d.name} ${d.target}회 모두 했어요` : `${d.name} ${d.done} / ${d.target}회`;
    info.replaceChildren(...[
      h('div', null, h('span', { class: 'lbl' }, '오늘 기록  '), d.times.length ? d.times.map(fmtSec).join(', ') : '아직 없어요'),
      best ? h('div', null, h('span', { class: 'lbl' }, '최고 기록  '), `${fmtSec(best.sec)} (${fmtMD(best.date)})`) : null].filter(Boolean));
  };
  const frame = () => { setBig((performance.now() - start) / 1000); raf = requestAnimationFrame(frame); };
  const draw = () => {
    const d = cur();
    const full = d.done >= d.target;
    box.classList.toggle('run', state === 'run');
    if (state === 'idle') acts.replaceChildren(h('button', { class: 'btn ink big wide', onclick: go1 }, '시작'));
    else if (state === 'run') acts.replaceChildren(h('button', { class: 'btn redb big wide', onclick: stop1 }, '멈추기'));
    else acts.replaceChildren(
      h('button', { class: 'btn blue big wide', onclick: () => { const sec = elapsed; bump(date, id, full ? 0 : 1, sec); toast(`${fmtSec(sec)} 기록했어요`); state = 'idle'; elapsed = 0; setBig(0); refresh(); draw(); } }, full ? '기록만 저장' : '기록하고 1회 체크'),
      h('button', { class: 'btn soft wide', onclick: () => { state = 'idle'; elapsed = 0; setBig(0); draw(); } }, '버리고 다시 재기'));
  };
  function go1() { start = performance.now(); state = 'run'; raf = requestAnimationFrame(frame); vibrate(10); Native.keepAwake(true); draw(); }
  function stop1() { cancelAnimationFrame(raf); elapsed = (performance.now() - start) / 1000; setBig(elapsed); state = 'stopped'; vibrate(10); Native.keepAwake(false); draw(); }
  const onKey = ev => { if (ev.code === 'Space' && !isTyping()) { ev.preventDefault(); if (state === 'idle') go1(); else if (state === 'run') stop1(); } };
  document.addEventListener('keydown', onKey);
  refresh(); draw();
  openSheet({ title: `${t.name} 시간 재기`, body: box, onClose: () => { cancelAnimationFrame(raf); Native.keepAwake(false); document.removeEventListener('keydown', onKey); } });
}
function applyTargetToday(id, target) {
  const today = todayStr();
  const e = S.days[today];
  if (e && e.drills && e.drills[id]) { e.drills[id].target = target; e.drills[id].done = Math.min(e.drills[id].done || 0, target); touch(today); }
}
function DrillEditor() {
  const box = h('div', { class: 'dedit' });
  const draw = () => {
    box.replaceChildren();
    S.settings.drills.forEach((d, i) => {
      const num = h('input', { class: 'sv', type: 'number', inputmode: 'numeric', min: 1, max: 99, value: d.target, 'aria-label': `${d.name} 목표 횟수` });
      const setT = v => { d.target = clampInt(v, 1, 99, d.target); num.value = d.target; applyTargetToday(d.id, d.target); touchSettings(); };
      num.addEventListener('change', () => setT(num.value));
      box.append(h('div', { class: 'drow' },
        h('div', { class: 'drow-1' },
          h('input', { class: 'input', value: d.name, maxlength: 20, 'aria-label': '연습 이름', oninput: ev => { d.name = ev.target.value.trim() || '연습'; touchSettings(); } }),
          h('div', { class: 'stepper' }, h('button', { 'aria-label': '횟수 줄이기', onclick: () => setT(d.target - 1) }, '−'), num, h('button', { 'aria-label': '횟수 늘리기', onclick: () => setT(d.target + 1) }, '+'))),
        h('input', { class: 'input small', value: d.memo || '', maxlength: 60, placeholder: '방법 메모 (선택)  예: ‘스—’ 소리로 20초', 'aria-label': `${d.name} 방법 메모`, oninput: ev => { d.memo = ev.target.value; touchSettings(); } }),
        h('div', { class: 'drow-2' },
          h('button', { class: 'chip sm', 'aria-pressed': String(!!d.timed), onclick: ev => { d.timed = !d.timed; ev.currentTarget.setAttribute('aria-pressed', String(d.timed)); touchSettings(); } }, icon('timer', 15), '시간 재기 버튼'),
          h('span', { class: 'sp' }),
          h('button', { class: 'icon-btn', 'aria-label': '위로', disabled: i === 0, onclick: () => { const a = S.settings.drills; [a[i - 1], a[i]] = [a[i], a[i - 1]]; touchSettings(); draw(); } }, icon('up', 19)),
          h('button', { class: 'icon-btn', 'aria-label': '아래로', disabled: i === S.settings.drills.length - 1, onclick: () => { const a = S.settings.drills; [a[i + 1], a[i]] = [a[i], a[i + 1]]; touchSettings(); draw(); } }, icon('dn', 19)),
          h('button', { class: 'icon-btn', 'aria-label': `${d.name} 항목 지우기`, onclick: () => {
            const a = S.settings.drills; const [gone] = a.splice(i, 1);
            const te = S.days[todayStr()];
            let snap = null;
            if (te && te.drills && te.drills[gone.id] && !(te.drills[gone.id].done > 0)) { snap = te.drills[gone.id]; delete te.drills[gone.id]; touch(todayStr()); }
            touchSettings(); draw(); render();
            toast(`‘${gone.name}’ 항목을 지웠어요`, { action: '되돌리기', onAction: () => { S.settings.drills.splice(Math.min(i, S.settings.drills.length), 0, gone); if (snap) { const t2 = S.days[todayStr()]; if (t2) { t2.drills[gone.id] = snap; touch(todayStr()); } } touchSettings(); draw(); render(); } });
          } }, icon('trash', 19)))));
    });
    box.append(h('button', { class: 'btn soft wide', style: 'margin-top:12px', onclick: () => {
      const id = uid('dr');
      S.settings.drills.push({ id, name: '새 연습', target: 5, timed: false, memo: '' });
      const te = S.days[todayStr()];
      if (te && te.drills && Object.keys(te.drills).length) { te.drills[id] = { name: '새 연습', target: 5, done: 0, times: [] }; touch(todayStr()); }
      touchSettings(); draw(); render();
      const names = $$('.drow-1 .input', box); const last = names[names.length - 1];
      if (last) { last.focus(); last.select(); }
    } }, icon('plus', 18), '연습 항목 추가'));
  };
  draw();
  return box;
}
function openDrillEditor() {
  openSheet({ title: '기초 연습 항목', body: h('div', null, h('p', { class: 'hint', style: 'margin-bottom:4px' }, '횟수를 바꾸면 오늘 기록부터 적용돼요. 지난 기록은 그날 정한 횟수 그대로 남아요.'), DrillEditor()), onClose: () => render() });
}

/* ================= calendar ================= */
function CalendarView() {
  const body = h('div', { class: 'cal-body' });
  const search = h('div', { class: 'search' }, icon('search', 20),
    h('input', { class: 'input', type: 'search', placeholder: '노래, 피드백, 메모에서 찾기', value: S.cal.q, 'data-fk': 'cal-q', enterkeyhint: 'search', 'aria-label': '기록 검색', oninput: ev => { S.cal.q = ev.target.value; drawCalBody(body); } }));
  drawCalBody(body);
  return h('div', { class: 'v-cal' }, Banner(), search, body);
}
function drawCalBody(body) {
  const q = S.cal.q.trim();
  if (q) { body.replaceChildren(SearchResults(q)); return; }
  body.replaceChildren(...[MonthPanel(), DayPreview(S.cal.sel), MonthList(), WeeksStrip()].filter(Boolean));
}
function moveMonth(delta) {
  let { y, m } = S.cal;
  m += delta;
  if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
  S.cal.y = y; S.cal.m = m;
  const prefix = `${y}-${pad(m + 1)}-`;
  const today = todayStr();
  if (today.startsWith(prefix)) S.cal.sel = today;
  else { const ds = entryDates().filter(d => d.startsWith(prefix)); S.cal.sel = ds.length ? ds[ds.length - 1] : `${prefix}01`; }
  render();
}
function MonthPanel() {
  const { y, m } = S.cal;
  const now = new Date();
  const isCur = y === now.getFullYear() && m === now.getMonth();
  const startDow = new Date(y, m, 1).getDay(), daysIn = new Date(y, m + 1, 0).getDate();
  const today = todayStr(), prefix = `${y}-${pad(m + 1)}-`;
  const ds = entryDates().filter(d => d.startsWith(prefix));
  const mins = ds.reduce((a, d) => a + (S.days[d].minutes || 0), 0);
  const stamps = ds.filter(d => drillsAllDone(d)).length;
  const st = streak();
  const sum = h('p', { class: 'cal-sum' });
  if (ds.length) {
    sum.append(`${isCur ? '이번 달' : `${m + 1}월에`} `, h('b', null, `${ds.length}일`), ' 기록했어요');
    if (mins) sum.append(', 연습 시간은 모두 ', h('b', null, fmtMin(mins)));
    sum.append('.');
    if (stamps) sum.append(' 기초 연습을 다 한 날은 ', h('b', null, `${stamps}일`), '이에요.');
    if (isCur && st >= 2) sum.append(' 지금 ', h('b', null, `연속 ${st}일째`), '예요.');
  } else sum.append(isCur ? '이번 달 첫 기록을 남겨 보세요.' : '이 달에는 기록이 없어요.');
  const grid = h('div', { class: 'cal-grid' });
  WD.forEach((w, i) => grid.append(h('div', { class: 'dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') }, w)));
  for (let i = 0; i < startDow; i++) grid.append(h('div', { class: 'cell out', 'aria-hidden': 'true' }));
  for (let d = 1; d <= daysIn; d++) {
    const key = prefix + pad(d), e = S.days[key], has = hasContent(e), dow = (startDow + d - 1) % 7;
    const cls = ['cell', dow === 0 ? 'sun' : '', dow === 6 ? 'sat' : '', has ? 'has' : '', key === today ? 'today' : '', key === S.cal.sel ? 'sel' : ''].filter(Boolean).join(' ');
    grid.append(h('button', { class: cls, 'data-r': has && e.rating ? e.rating : null, disabled: key > today, 'aria-pressed': String(key === S.cal.sel), 'aria-label': `${m + 1}월 ${d}일${has ? ', 기록 있음' : ''}`, onclick: () => { S.cal.sel = key; drawCalBody($('.cal-body')); } },
      h('span', { class: 'n' }, d),
      h('span', { class: 'ind' },
        has && (e.bad.length || e.fb.length) ? h('i', { class: 'i-tri' }) : null,
        has && drillsAllDone(key) ? h('i', { class: 'i-stamp' }) : null,
        has && e.recs.length ? h('i', { class: 'i-mic' }) : null)));
  }
  swipe(grid, () => { if (!isCur) moveMonth(1); }, () => moveMonth(-1));
  return h('div', { class: 'page' },
    h('div', { class: 'cal-top' },
      h('button', { class: 'navbtn', 'aria-label': '이전 달', onclick: () => moveMonth(-1) }, icon('left', 24)),
      h('div', { class: 'cal-title' }, `${y}년 ${m + 1}월`),
      h('button', { class: 'navbtn', 'aria-label': '다음 달', disabled: isCur, onclick: () => moveMonth(1) }, icon('right', 24))),
    sum, grid,
    h('div', { class: 'legend' },
      h('span', null, h('i', { class: 'i-rate' }), '만족도가 높을수록 진하게'),
      h('span', null, h('i', { class: 'i-tri' }), '아쉬운 점, 피드백'),
      h('span', null, h('i', { class: 'i-stamp' }), '기초 연습 완료'),
      h('span', null, h('i', { class: 'i-mic' }), '녹음')),
    !isCur ? h('div', { style: 'text-align:center;padding-bottom:12px' }, h('button', { class: 'link', onclick: () => { const n = new Date(); S.cal.y = n.getFullYear(); S.cal.m = n.getMonth(); S.cal.sel = todayStr(); render(); } }, '이번 달로 돌아가기')) : null,
    MonthStats(prefix));
}
/* what this month looked like: drill completion, songs, recurring issues */
function MonthStats(prefix) {
  const ds = entryDates().filter(d => d.startsWith(prefix));
  if (ds.length < 2) return null;
  const drillDays = new Map();
  const songs = new Map(), tags = new Map();
  let resolved = 0, rated = 0, rsum = 0;
  for (const d of ds) {
    const e = S.days[d];
    for (const id in e.drills) { const s = e.drills[id]; const c = drillDays.get(s.name) || { n: 0, full: 0 }; if (s.done > 0) c.n++; if (s.done >= s.target) c.full++; drillDays.set(s.name, c); }
    e.songs.forEach(s => songs.set(s.title, (songs.get(s.title) || 0) + 1));
    e.bad.concat(e.fb).forEach(it => { if (it.tag) tags.set(it.tag, (tags.get(it.tag) || 0) + 1); if (it.resolved) resolved++; });
    if (e.rating) { rated++; rsum += e.rating; }
  }
  const topSongs = Array.from(songs.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topTags = Array.from(tags.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const lines = [];
  if (drillDays.size) lines.push(pvLine('기초 연습', h('span', null, Array.from(drillDays.entries()).filter(([, c]) => c.n).map(([n, c]) => `${n} ${c.full}일 완료`).join(', ') || '아직 없어요')));
  if (topSongs.length) lines.push(pvLine('많이 부른 곡', h('span', null, topSongs.map(([t, n]) => `${t} ${n}일`).join(', '))));
  if (topTags.length) lines.push(pvLine('자주 나온 주제', h('span', null, topTags.map(([t, n]) => `${t} ${n}번`).join(', '))));
  if (resolved) lines.push(pvLine('해결한 것', h('span', null, `${resolved}개`)));
  if (rated) lines.push(pvLine('평균 만족도', h('span', null, rateDots(Math.round(rsum / rated)), ` ${(rsum / rated).toFixed(1)}`)));
  if (!lines.length) return null;
  return h('div', { class: 'month-stats' }, h('div', { class: 'lbl', style: 'margin-bottom:8px' }, '이 달 돌아보기'), h('div', { class: 'pv-lines' }, lines));
}
/* the last 20 weeks at a glance — darker means more practice */
function WeeksStrip() {
  if (entryDates().length < 3) return null;
  const today = todayStr();
  const start = addDays(today, -(7 * 19 + parseYmd(today).getDay()));
  const grid = h('div', { class: 'weeks' });
  let d = start, n = 0;
  while (d <= today) {
    const e = S.days[d], has = hasContent(e);
    const lvl = !has ? 0 : e.minutes >= 60 ? 4 : e.minutes >= 30 ? 3 : e.minutes > 0 || drillsAllDone(d) ? 2 : 1;
    const dd = d;
    grid.append(h('button', { class: 'wk', 'data-l': lvl, 'aria-label': `${fmtMD(dd)}${has ? ', 기록 있음' : ''}`, onclick: () => { const p = parseYmd(dd); S.cal.y = p.getFullYear(); S.cal.m = p.getMonth(); S.cal.sel = dd; render(); } }));
    if (has) n++;
    d = addDays(d, 1);
  }
  return h('div', { class: 'page weeks-page' },
    h('div', { class: 'sec-h', style: 'margin:14px 0 8px' }, h('h2', null, '지난 20주'), h('span', { class: 'sec-note' }, `${n}일 노래했어요`)),
    grid,
    h('div', { class: 'legend' }, h('span', null, '적게'), [1, 2, 3, 4].map(l => h('i', { class: 'wk', 'data-l': l })), h('span', null, '많이 (연습 시간 기준)')));
}
function pvLine(label, content) { return h('div', { class: 'pv-line' }, h('span', null, label), content); }
function DayPreview(date) {
  if (!date) return null;
  const e = S.days[date];
  const has = hasContent(e);
  const box = h('div', { class: 'page' },
    h('div', { class: 'pv-head' },
      h('div', null, h('div', { class: 'pv-date' }, fmtMD(date)), h('div', { class: 'hint wd' + dowClass(date) }, WD[parseYmd(date).getDay()] + '요일')),
      h('span', { class: 'sp' }),
      date <= todayStr() ? h('button', { class: 'btn ink sm', onclick: () => goDate(date) }, has ? '이 날 펼쳐 보기' : '이 날 기록 쓰기') : null));
  if (!has) { box.append(h('p', { class: 'hint', style: 'padding-bottom:16px' }, '이 날은 기록이 없어요.')); return box; }
  const meta = [];
  if (e.rating) meta.push(h('span', null, rateDots(e.rating), ' ', RATE_LABELS[e.rating - 1]));
  if (e.cond) meta.push(h('span', null, `목 상태 ${COND_LABELS[e.cond - 1]}`));
  if (e.minutes) meta.push(h('span', null, `연습 ${fmtMin(e.minutes)}`));
  if (drillsAllDone(date)) meta.push(h('span', { class: 'mini-stamp' }, '참 잘했어요'));
  const drills = Object.values(e.drills || {});
  const lines = h('div', { class: 'pv-lines' },
    meta.length ? h('div', { class: 'pv-meta' }, meta) : null,
    e.goal.trim() ? pvLine('목표', h('span', { class: 'pre' }, e.goal.trim())) : null,
    drills.length && drills.some(d => d.done > 0) ? pvLine('기초 연습', h('span', null, drills.map(d => `${d.name} ${Math.min(d.done, d.target)}/${d.target}`).join(', '))) : null,
    e.songs.length ? pvLine('노래', h('span', null, e.songs.map(s => s.title + (s.tone ? ` (${s.tone})` : '')).join(', '))) : null,
    e.high != null ? pvLine('최고음', h('span', null, `${noteName(e.high)} (${noteSci(e.high)})`)) : null,
    ['good', 'bad', 'fb'].map(k => e[k].length ? pvLine(KIND[k].label, h('ul', null, e[k].map(it => h('li', { class: it.resolved ? 'resolved' : '' }, it.pinned ? h('span', { class: 'hl' }, it.text) : it.text)))) : null),
    e.memo.trim() ? pvLine('메모', h('span', { class: 'pre' }, e.memo.trim())) : null,
    e.next.trim() ? pvLine('다음에 할 것', h('span', { class: 'pre' }, e.next.trim())) : null);
  box.append(lines);
  if (e.recs.length) box.append(h('div', { class: 'recs', style: 'padding-bottom:6px' }, e.recs.map(r => RecRow(r, date))));
  return box;
}
function MonthList() {
  const prefix = `${S.cal.y}-${pad(S.cal.m + 1)}-`;
  const ds = entryDates().filter(d => d.startsWith(prefix)).reverse();
  if (!ds.length) return null;
  return h('div', { class: 'page' },
    h('div', { class: 'sec-h', style: 'margin:16px 0 4px' }, h('h2', null, `${S.cal.m + 1}월 기록 모아보기`), h('span', { class: 'sec-note' }, `${ds.length}일`)),
    ds.map(EntryCard));
}
function EntryCard(d) {
  const e = S.days[d], dt = parseYmd(d);
  const issues = e.bad.length + e.fb.length;
  const first = e.bad[0] || e.fb[0];
  return h('button', { class: 'ecard', onclick: () => goDate(d) },
    h('div', { class: 'ec-d' + dowClass(d) }, h('b', null, dt.getDate()), h('span', null, WD[dt.getDay()])),
    h('div', { class: 'ec-b' },
      h('div', { class: 'ec-top' },
        e.rating ? rateDots(e.rating) : null,
        drillsAllDone(d) ? h('span', { class: 'mini-stamp' }, '참 잘했어요') : null,
        e.minutes ? h('span', null, fmtMin(e.minutes)) : null,
        e.recs.length ? h('span', null, `녹음 ${e.recs.length}`) : null),
      e.goal.trim() ? h('div', { class: 'clip ec-goal' }, e.goal.trim()) : null,
      e.songs.length ? h('div', { class: 'clip' }, '♪ ' + e.songs.map(s => s.title).join(', ')) : null,
      first ? h('div', { class: 'clip ec-bad' }, first.text + (issues > 1 ? ` 외 ${issues - 1}개` : '')) : null,
      !e.goal.trim() && !e.songs.length && !first && e.memo.trim() ? h('div', { class: 'clip' }, e.memo.trim()) : null));
}
function snippet(t, ql) {
  const i = t.toLowerCase().indexOf(ql);
  const s = Math.max(0, i - 18), end = i + ql.length + 40;
  return (s > 0 ? '…' : '') + t.slice(s, end) + (end < t.length ? '…' : '');
}
function highlight(text, q) {
  const span = h('span');
  const tl = text.toLowerCase(), ql = q.toLowerCase();
  let i = 0, j;
  while ((j = tl.indexOf(ql, i)) >= 0) { span.append(text.slice(i, j), h('mark', null, text.slice(j, j + q.length))); i = j + q.length; }
  span.append(text.slice(i));
  return span;
}
function SearchResults(q) {
  const ql = q.toLowerCase();
  const hits = [];
  for (const d of entryDates().reverse()) {
    const e = S.days[d];
    const fields = [['목표', e.goal], ['메모', e.memo], ['다음에 할 것', e.next],
      ...e.songs.map(s => ['노래', [s.title, s.artist, s.tone, s.note].filter(Boolean).join(', ')]),
      ...e.good.map(i => ['잘 된 점', i.text]), ...e.bad.map(i => ['아쉬웠던 점', i.text]), ...e.fb.map(i => ['받은 피드백', i.text]),
      ...e.recs.map(r => ['녹음', r.title || '']), ...e.bad.concat(e.fb, e.good).filter(i => i.tag).map(i => ['주제', `${i.tag}: ${i.text}`])];
    const found = fields.filter(([, t]) => t && t.toLowerCase().includes(ql));
    if (found.length) hits.push({ d, found });
  }
  return h('div', { class: 'page' },
    h('div', { class: 'sec-h', style: 'margin:16px 0 4px' }, h('h2', null, '찾은 기록'), h('span', { class: 'sec-note' }, `${hits.length}일`)),
    hits.length ? hits.map(({ d, found }) => h('button', { class: 'hit', onclick: () => goDate(d) },
      h('div', { class: 'hit-d' }, fmtMDW(d)),
      found.slice(0, 3).map(([label, t]) => h('div', { class: 'hit-l' }, h('span', { class: 'hit-k' }, label), highlight(snippet(t, ql), q)))))
      : h('p', { class: 'empty' }, '찾는 내용이 없어요. 다른 낱말로 찾아보세요.'));
}

/* ================= feedback ================= */
function FeedbackView() {
  const F = S.fb;
  const all = allItems();
  const fix = all.filter(x => x.kind !== 'good');
  const openN = fix.filter(x => !x.it.resolved).length, doneN = fix.length - openN;
  const head = h('div', { class: 'view-head' }, h('h1', { class: 'view-title' }, '피드백'), h('span', { class: 'sp' }), h('button', { class: 'btn ink sm', onclick: openAddFeedback }, icon('plus', 18), '추가'));
  if (!all.length) return h('div', { class: 'v-fb' }, Banner(), head, h('div', { class: 'page' }, h('div', { class: 'empty' }, h('span', { class: 'hand' }, '아직 모인 피드백이 없어요'), '오늘 화면의 ‘아쉬웠던 점’, ‘받은 피드백’, ‘잘 된 점’에 적으면 여기에 날짜별로 모여요. 레슨에서 들은 말은 위의 추가 버튼으로 바로 적어도 돼요.')));
  const counts = new Map();
  fix.forEach(x => { if (x.it.tag) counts.set(x.it.tag, (counts.get(x.it.tag) || 0) + 1); });
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top.length ? top[0][1] : 1;
  const list = all.filter(x => F.kinds.includes(x.kind)
    && (F.status === 'all' || (F.status === 'open' ? (x.kind === 'good' || !x.it.resolved) : (x.kind !== 'good' && x.it.resolved)))
    && (!F.tag || x.it.tag === F.tag) && (!F.pinned || x.it.pinned));
  const page = h('div', { class: 'page' },
    h('div', { class: 'seg', role: 'group', 'aria-label': '해결 여부' },
      segBtn(`해결 전 ${openN}`, F.status === 'open', () => { F.status = 'open'; render(); }),
      segBtn(`해결함 ${doneN}`, F.status === 'done', () => { F.status = 'done'; render(); }),
      segBtn('전체', F.status === 'all', () => { F.status = 'all'; render(); })),
    h('div', { class: 'chips mt' },
      ['bad', 'fb', 'good'].map(k => h('button', { class: 'chip', 'aria-pressed': String(F.kinds.includes(k)), onclick: () => { const on = F.kinds.includes(k); if (on && F.kinds.length === 1) return; F.kinds = on ? F.kinds.filter(x => x !== k) : F.kinds.concat(k); render(); } }, KIND[k].label)),
      h('button', { class: 'chip', 'aria-pressed': String(F.pinned), onclick: () => { F.pinned = !F.pinned; render(); } }, icon('pin', 15), '고정한 것')),
    top.length ? h('div', { class: 'sec', style: 'padding-bottom:6px' },
      h('div', { class: 'sec-h' }, h('h2', null, '자주 나온 주제'), h('span', { class: 'sec-note' }, '아쉬운 점과 피드백 기준'), h('span', { class: 'sp' }), F.tag ? h('button', { class: 'link', onclick: () => { F.tag = null; render(); } }, '주제 풀기') : null),
      h('div', { class: 'tagbars' }, top.map(([tag, n]) => h('button', { class: 'tagbar', 'aria-pressed': String(F.tag === tag), onclick: () => { F.tag = F.tag === tag ? null : tag; render(); } },
        h('span', { class: 'tb-l' }, tag), h('span', { class: 'tb-t' }, h('span', { class: 'tb-f', style: `display:block;width:${Math.max(6, (n / max) * 100)}%` })), h('span', { class: 'tb-n' }, n))))) : null);
  const listBox = h('div', { class: 'sec' });
  if (!list.length) listBox.append(h('div', { class: 'empty' }, '고른 조건에 맞는 기록이 없어요.', h('br'), h('button', { class: 'link', onclick: () => { Object.assign(S.fb, { status: 'all', kinds: ['bad', 'fb', 'good'], tag: null, pinned: false }); render(); } }, '조건 모두 풀기')));
  else {
    let lastDate = '';
    list.forEach(x => {
      if (x.date !== lastDate) { lastDate = x.date; listBox.append(h('div', { class: 'group-h' }, h('button', { onclick: () => goDate(x.date) }, fmtMD(x.date)), h('span', { class: 'hint wd' + dowClass(x.date) }, WD[parseYmd(x.date).getDay()] + '요일'))); }
      listBox.append(FbItem(x));
    });
  }
  page.append(listBox);
  return h('div', { class: 'v-fb' }, Banner(), head, page);
}
function FbItem({ date, kind, it }) {
  return h('div', { class: `fbi k-${kind}` + (it.resolved ? ' resolved' : '') },
    h('span', { class: 'fbi-bar' }),
    h('div', { style: 'min-width:0' },
      h('button', { class: 'fbi-text', onclick: () => openItem(date, kind, it.id) }, it.pinned ? h('span', { class: 'hl' }, it.text) : it.text),
      h('div', { class: 'fbi-meta' }, h('span', null, KIND[kind].label), it.tag ? h('span', { class: 'tag' }, it.tag) : null, kind === 'fb' && it.from ? h('span', null, it.from) : null, it.resolved && it.resolvedOn ? h('span', { class: 'ok-mark' }, `${fmtMD(it.resolvedOn)} 해결`) : null),
      h('div', { class: 'fbi-acts' },
        h('button', { class: 'mini pin', 'aria-pressed': String(!!it.pinned), onclick: () => { mutItem(date, kind, it.id, c => { c.pinned = !c.pinned; }); render(); } }, icon('pin', 15), it.pinned ? '고정됨' : '고정'),
        kind !== 'good' ? h('button', { class: 'mini ok', 'aria-pressed': String(!!it.resolved), onclick: () => {
          const wasOpen = !it.resolved;
          mutItem(date, kind, it.id, c => { c.resolved = !c.resolved; if (c.resolved) c.resolvedOn = todayStr(); else delete c.resolvedOn; });
          render();
          if (wasOpen) toast('해결한 것으로 옮겼어요', { action: '되돌리기', onAction: () => { mutItem(date, kind, it.id, c => { c.resolved = false; delete c.resolvedOn; }); render(); } });
        } }, icon('check', 15), it.resolved ? '해결함' : '해결했어요') : null)));
}
function openAddFeedback() {
  let kind = 'fb', tag = null, from = '선생님';
  const kindSeg = h('div', { class: 'seg' });
  const tagChips = h('div', { class: 'chips' }), fromChips = h('div', { class: 'chips' });
  const fromField = field('누가 말해 줬나요?', fromChips);
  const ta = autoTA({ class: 'input', placeholder: KIND.fb.ph, 'data-autofocus': '', 'aria-label': '내용' }, 70);
  const dateInp = h('input', { class: 'input', type: 'date', max: todayStr(), value: todayStr(), 'aria-label': '날짜' });
  const draw = () => {
    kindSeg.replaceChildren(...['bad', 'fb', 'good'].map(k => segBtn(KIND[k].label, kind === k, () => { kind = k; ta.placeholder = KIND[k].ph; draw(); })));
    tagChips.replaceChildren(...S.settings.tags.map(t => h('button', { class: 'chip sm', 'aria-pressed': String(tag === t), onclick: () => { tag = tag === t ? null : t; draw(); } }, t)));
    fromChips.replaceChildren(...FROM.map(f => h('button', { class: 'chip sm', 'aria-pressed': String(from === f), onclick: () => { from = f; draw(); } }, f)));
    fromField.hidden = kind !== 'fb';
  };
  draw();
  let s = null;
  const save = h('button', { class: 'btn ink', onclick: () => {
    const text = ta.value.trim();
    if (!text) { toast('내용을 적어 주세요'); return; }
    let d = dateInp.value;
    if (!isDateKey(d) || d > todayStr()) d = todayStr();
    const e = ensureDay(d);
    const it = { id: uid('i'), text, tag, pinned: false, resolved: false, at: Date.now() };
    if (kind === 'fb') it.from = from;
    e[kind].push(it);
    touch(d); closeSheet(s, true); render();
    toast(`${fmtMD(d)} 기록에 넣었어요`);
  } }, '추가');
  s = openSheet({ title: '피드백 추가', body: h('div', null, h('div', { class: 'field' }, kindSeg), field('내용', ta), field('주제', tagChips), fromField, field('날짜', dateInp)), foot: [save] });
}

/* ================= songs ================= */
function SongsView() {
  const seg = S.lib.seg;
  let content;
  if (seg === 'songs') content = SongListPanel();
  else if (seg === 'recs') content = AllRecsPanel();
  else if (seg === 'journal') content = JournalPanel();
  else content = RangePanel();
  const pickSeg = v => { if (S.lib.seg === v) return; S.lib.seg = v; render({ top: true }); };
  return h('div', { class: 'v-songs' }, Banner(),
    h('div', { class: 'view-head' }, h('h1', { class: 'view-title' }, '모아보기')),
    h('div', { class: 'seg', style: 'margin-bottom:12px', role: 'group', 'aria-label': '보기' },
      segBtn('곡별', seg === 'songs', () => pickSeg('songs')),
      segBtn('녹음', seg === 'recs', () => pickSeg('recs')),
      segBtn('일지', seg === 'journal', () => pickSeg('journal')),
      segBtn('음역', seg === 'range', () => pickSeg('range'))),
    content);
}
function SongListPanel() {
  const all = Array.from(songLib().values()).sort((a, b) => b.last.localeCompare(a.last) || b.dates.length - a.dates.length);
  if (!all.length) return h('div', { class: 'page' }, h('div', { class: 'empty' }, h('span', { class: 'hand' }, '아직 부른 노래가 없어요'), '오늘 화면의 ‘노래’에 부른 곡을 적으면 곡마다 연습한 날과 녹음이 모여요.'));
  const used = SONG_STATUS.filter(st => all.some(L => L.status === st));
  const lib = S.lib.status ? all.filter(L => L.status === S.lib.status) : all;
  return h('div', { class: 'page' },
    used.length ? h('div', { class: 'chips scroll', style: 'padding-top:14px;padding-bottom:4px' },
      h('button', { class: 'chip sm', 'aria-pressed': String(!S.lib.status), onclick: () => { S.lib.status = null; render(); } }, `전체 ${all.length}`),
      used.map(st => h('button', { class: 'chip sm', 'aria-pressed': String(S.lib.status === st), onclick: () => { S.lib.status = S.lib.status === st ? null : st; render(); } }, `${st} ${all.filter(L => L.status === st).length}`))) : null,
    lib.map(L => h('button', { class: 'song-card' + (L.cat && L.cat.art ? ' has-art' : ''), onclick: () => openSongDetail(L.key) },
      L.cat && L.cat.art ? artThumb(L.cat.art, 48) : null,
      h('span', { class: 'sc-t' }, L.title, L.status ? h('span', { class: 'st-pill', 'data-st': SONG_STATUS.indexOf(L.status) }, L.status) : null),
      h('span', { class: 'sc-days' }, L.dates.length, h('small', null, '일 연습')),
      L.artist ? h('span', { class: 'sc-a' }, L.artist) : null,
      h('span', { class: 'sc-s' }, h('span', null, `최근 ${fmtMD(L.last)}`), L.recs.length ? h('span', null, `녹음 ${L.recs.length}개`) : null, L.recs.some(x => x.r.fav) ? h('span', null, '베스트 있음') : null))));
}
function openSongDetail(key) {
  const L = songLib().get(key);
  if (!L) { toast('이 노래의 기록을 찾지 못했어요'); return; }
  const metaOf = () => { let m = S.settings.songs.find(x => x.k === key); if (!m) { m = { k: key, artist: '', memo: '', status: '', cat: null }; S.settings.songs.push(m); } return m; };
  const stChips = h('div', { class: 'chips' });
  const drawSt = () => stChips.replaceChildren(...SONG_STATUS.map(st => h('button', { class: 'chip sm', 'aria-pressed': String(L.status === st), onclick: () => { L.status = L.status === st ? '' : st; const m = metaOf(); m.status = L.status; touchSettings(); drawSt(); } }, st)));
  drawSt();
  const aInp = h('input', { class: 'input', value: L.artist || '', maxlength: 40, placeholder: '가수', 'aria-label': '가수' });
  const memo = autoTA({ class: 'input lined', value: L.memo || '', placeholder: '이 노래를 부를 때 늘 기억할 것  예: 브릿지 전에 숨 크게, 2절 후렴은 힘 빼기', 'aria-label': '곡 메모' }, 94);
  const saveMeta = debounce(() => { const m = metaOf(); m.artist = aInp.value.trim(); m.memo = memo.value; touchSettings(); }, 500);
  aInp.addEventListener('input', saveMeta);
  memo.addEventListener('input', saveMeta);
  const recsSorted = L.recs.slice().sort((a, b) => a.d.localeCompare(b.d) || (a.r.at || 0) - (b.r.at || 0));
  const firstRec = recsSorted[0], lastRec = recsSorted[recsSorted.length - 1];
  const favs = recsSorted.filter(x => x.r.fav);
  const story = h('p', { class: 'story' }, h('b', null, fmtMD(L.first)), '에 처음 불렀고, 지금까지 ', h('b', null, `${L.dates.length}일`), ' 연습했어요.', L.recs.length ? [' 녹음은 ', h('b', null, `${L.recs.length}개`), '예요.'] : ' 아직 녹음은 없어요.');
  const byDate = new Map();
  L.dates.forEach(d => byDate.set(d, { notes: [], recs: [] }));
  L.notes.forEach(n => { if (!byDate.has(n.d)) byDate.set(n.d, { notes: [], recs: [] }); byDate.get(n.d).notes.push(n); });
  L.recs.forEach(x => { if (!byDate.has(x.d)) byDate.set(x.d, { notes: [], recs: [] }); byDate.get(x.d).recs.push(x.r); });
  const timeline = Array.from(byDate.keys()).sort().reverse().map(d => {
    const v = byDate.get(d);
    return h('div', null,
      h('div', { class: 'tl-d' }, h('button', { onclick: () => { closeSheet(null, true); goDate(d); } }, fmtMD(d)), h('span', { class: 'hint wd' + dowClass(d) }, WD[parseYmd(d).getDay()] + '요일')),
      v.notes.map(n => h('p', { class: 'tl-n' }, [n.tone ? `[${n.tone}] ` : '', n.note].join(''))),
      DayJournal(d, { compact: true }),
      v.recs.length ? h('div', { class: 'recs' }, v.recs.map(r => RecRow(r, d))) : null);
  });
  let hero = null;
  const drawHero = () => {
    const LL = songLib().get(key) || L;
    const nh = SongHero(LL, key, () => { drawHero(); if (LL.artist && !aInp.value.trim()) aInp.value = LL.artist; });
    if (hero) hero.replaceWith(nh);
    hero = nh;
  };
  drawHero();
  openSheet({
    title: L.title,
    body: h('div', null, hero, story,
      field('지금 이 곡은', stChips), field('가수', aInp), field('곡 메모', memo),
      recsSorted.length >= 2 ? h('div', { class: 'field' }, h('span', { class: 'lbl' }, '처음과 지금 비교해 듣기'),
        h('div', { class: 'cmp' },
          h('span', { class: 'cmp-l' }, '처음 녹음'), RecRow(firstRec.r, firstRec.d, { label: fmtMD(firstRec.d) }),
          favs.length && favs[favs.length - 1] !== lastRec ? [h('span', { class: 'cmp-l' }, '베스트'), RecRow(favs[favs.length - 1].r, favs[favs.length - 1].d, { label: fmtMD(favs[favs.length - 1].d) })] : null,
          h('span', { class: 'cmp-l' }, '가장 최근 녹음'), RecRow(lastRec.r, lastRec.d, { label: fmtMD(lastRec.d) }))) : null,
      h('div', { class: 'lbl', style: 'margin-top:6px' }, '연습 기록'), timeline),
    onClose: () => { saveMeta.flush(); Preview.stop(); render(); }
  });
}
function AllRecsPanel() {
  const rows = [];
  for (const d of Object.keys(S.days).sort().reverse()) S.days[d].recs.slice().reverse().forEach(r => { if (!S.lib.best || r.fav) rows.push({ d, r }); });
  const total = Object.values(S.days).reduce((a, e) => a + e.recs.length, 0);
  const page = h('div', { class: 'page' },
    h('div', { class: 'sec-h', style: 'margin:16px 0 6px' }, h('h2', null, '모든 녹음'), h('span', { class: 'sec-note' }, `${total}개`), h('span', { class: 'sp' }),
      h('button', { class: 'chip sm', 'aria-pressed': String(S.lib.best), onclick: () => { S.lib.best = !S.lib.best; render(); } }, icon('star', 15), '베스트만')));
  if (!rows.length) { page.append(h('div', { class: 'empty' }, S.lib.best ? '별표를 누른 베스트 녹음이 아직 없어요.' : '아직 녹음이 없어요. 오늘 화면의 ‘녹음’에서 바로 녹음하거나 파일을 불러오세요.')); return page; }
  let last = '';
  const box = h('div', { class: 'recs' });
  rows.forEach(({ d, r }) => {
    if (d !== last) { last = d; box.append(h('div', { class: 'tl-d' }, h('button', { onclick: () => goDate(d) }, fmtMD(d)), h('span', { class: 'hint wd' + dowClass(d) }, WD[parseYmd(d).getDay()] + '요일'))); }
    box.append(RecRow(r, d));
  });
  page.append(box);
  return page;
}
function RangePanel() {
  const pts = entryDates().filter(d => S.days[d].high != null).map(d => ({ d, m: S.days[d].high }));
  if (!pts.length) return h('div', { class: 'page' }, h('div', { class: 'empty' }, h('span', { class: 'hand' }, '음역 기록이 아직 없어요'), '오늘 화면 ‘노래’ 아래 ‘오늘 낸 최고음’을 골라 두면 여기에 그래프가 그려져요.'));
  const shown = pts.slice(-40);
  const best = pts.reduce((a, b) => (b.m > a.m ? b : a));
  const latest = pts[pts.length - 1];
  const lo = Math.min(...shown.map(p => p.m)) - 2, hi = Math.max(...shown.map(p => p.m)) + 2;
  const W = 340, H = 200, L = 58, R = 12, T = 12, B = 26;
  const x = i => (shown.length === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (shown.length - 1));
  const y = m => T + ((hi - m) * (H - T - B)) / Math.max(1, hi - lo);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="날짜별 최고음 그래프">`;
  for (let m = Math.ceil(lo); m <= hi; m++) {
    if (m % 12 === 0 || m % 12 === 7 || (hi - lo) <= 8) {
      svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(m).toFixed(1)}" y2="${y(m).toFixed(1)}"/><text class="axis" x="${L - 6}" y="${(y(m) + 4).toFixed(1)}" text-anchor="end">${noteName(m)}</text>`;
    }
  }
  svg += `<text class="axis" x="${L}" y="${H - 6}">${fmtMD(shown[0].d)}</text><text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtMD(shown[shown.length - 1].d)}</text>`;
  if (shown.length > 1) svg += `<polyline class="line" points="${shown.map((p, i) => `${x(i).toFixed(1)},${y(p.m).toFixed(1)}`).join(' ')}"/>`;
  shown.forEach((p, i) => { svg += `<circle class="pt${p.d === best.d && p.m === best.m ? ' best' : ''}" cx="${x(i).toFixed(1)}" cy="${y(p.m).toFixed(1)}" r="4"/>`; });
  svg += '</svg>';
  return h('div', { class: 'page' },
    h('div', { class: 'range-top' },
      h('div', null, h('b', null, noteName(best.m)), h('span', null, `최고 기록 ${noteSci(best.m)}, ${fmtMD(best.d)}`)),
      h('div', null, h('b', null, noteName(latest.m)), h('span', null, `최근 ${noteSci(latest.m)}, ${fmtMD(latest.d)}`))),
    h('div', { html: svg, style: 'padding:6px 0 4px' }),
    h('p', { class: 'hint', style: 'padding-bottom:14px' }, `빨간 점이 가장 높이 낸 날이에요. 최근 ${shown.length}번의 기록을 보여 줘요.`));
}

/* ================= journal: every day's writing in one place ================= */
function journalText(e) {
  return [e.goal, e.memo, e.next, ...e.songs.map(s => s.note), ...e.good.map(i => i.text), ...e.bad.map(i => i.text), ...e.fb.map(i => i.text)]
    .filter(t => t && String(t).trim()).join('\n');
}
/* the written part of one day; compact = inside a song's timeline */
function DayJournal(d, o = {}) {
  const e = S.days[d];
  if (!e) return null;
  const q = o.q || '';
  const hl = t => (q ? highlight(t, q) : t);
  const box = h('div', { class: 'jbody' + (o.compact ? ' compact' : '') });
  if (!o.compact && e.songs.length) box.append(h('p', { class: 'j-songs' }, '♪ ', hl(e.songs.map(s => s.title + (s.tone ? ` (${s.tone})` : '')).join(', '))));
  if (e.goal.trim()) box.append(h('p', { class: 'j-line' }, h('span', { class: 'j-k' }, '목표'), h('span', null, hl(e.goal.trim()))));
  if (e.memo.trim()) {
    const t = e.memo.trim();
    const memo = h('p', { class: 'j-memo' + (o.compact ? ' c3' : ' c6') }, hl(t));
    box.append(memo);
    if (t.length > (o.compact ? 110 : 220) || t.split('\n').length > (o.compact ? 3 : 6)) {
      const more = h('button', { class: 'link j-more', 'aria-expanded': 'false', onclick: () => { const open = memo.classList.toggle('open'); more.textContent = open ? '접기' : '더 보기'; more.setAttribute('aria-expanded', String(open)); } }, '더 보기');
      box.append(more);
    }
  }
  if (!o.compact) e.songs.filter(s => s.note && s.note.trim()).forEach(s => box.append(h('p', { class: 'j-line' }, h('span', { class: 'j-k clip' }, s.title), h('span', null, hl(s.note.trim())))));
  const items = ['good', 'bad', 'fb'].flatMap(k => e[k].map(it => ({ k, it })));
  if (items.length) box.append(h('ul', { class: 'j-items' }, items.map(({ k, it }) => h('li', { class: it.resolved ? 'resolved' : '' }, mark(k), h('span', { class: 'j-it' }, hl(it.text)), k === 'fb' && it.from ? h('span', { class: 'from' }, it.from) : null))));
  if (!o.compact && e.next.trim()) box.append(h('p', { class: 'j-line' }, h('span', { class: 'j-k' }, '다음에'), h('span', null, hl(e.next.trim()))));
  if (!box.childNodes.length) {
    if (o.compact) return null;
    box.append(h('p', { class: 'hint' }, '적은 글 없이 연습만 기록한 날이에요.'));
  }
  return box;
}
function JournalCard(d, q) {
  const e = S.days[d], dt = parseYmd(d);
  const meta = [
    e.rating ? rateDots(e.rating) : null,
    e.minutes ? h('span', null, fmtMin(e.minutes)) : null,
    e.cond ? h('span', null, `목 ${COND_LABELS[e.cond - 1]}`) : null,
    e.recs.length ? h('span', null, `녹음 ${e.recs.length}`) : null,
    drillsAllDone(d) ? h('span', { class: 'mini-stamp' }, '참 잘했어요') : null].filter(Boolean);
  return h('article', { class: 'jcard' },
    h('button', { class: 'j-head', 'aria-label': `${fmtMDW(d)} 기록 펼쳐 보기`, onclick: () => goDate(d) },
      h('span', { class: 'j-date' + dowClass(d) }, h('b', null, dt.getDate()), h('span', null, WD[dt.getDay()])),
      h('span', { class: 'j-meta' }, meta),
      icon('right', 18)),
    DayJournal(d, { q }));
}
function journalDays() {
  const J = S.lib, ql = (J.jq || '').trim().toLowerCase();
  return entryDates().reverse().filter(d => {
    const e = S.days[d], t = journalText(e);
    if (!J.jall && !t) return false;
    return !ql || (t + '\n' + e.songs.map(s => s.title).join('\n')).toLowerCase().includes(ql);
  });
}
function drawJournal(body) {
  const J = S.lib, q = (J.jq || '').trim();
  const days = journalDays();
  if (!entryDates().length) { body.replaceChildren(h('div', { class: 'empty' }, h('span', { class: 'hand' }, '아직 쓴 일지가 없어요'), '오늘 화면의 목표, 메모, 돌아보기에 적은 글이 날짜별로 여기에 모여요.')); return; }
  if (!days.length) { body.replaceChildren(h('div', { class: 'empty' }, q ? '찾는 내용이 없어요. 다른 낱말로 찾아보세요.' : '글을 적은 날이 아직 없어요. ‘연습만 한 날도’를 누르면 모든 기록을 보여 줘요.')); return; }
  const shown = days.slice(0, J.jn);
  const nodes = [h('div', { class: 'j-top' }, h('span', { class: 'sec-note' }, `${days.length}일`), h('span', { class: 'sp' }),
    h('button', { class: 'btn ghost sm', onclick: () => shareJournal(days) }, icon('send', 16), '글로 모아 보내기'))];
  let month = '';
  for (const d of shown) {
    const m = d.slice(0, 7);
    if (m !== month) { month = m; nodes.push(h('h3', { class: 'j-month' }, `${+m.slice(0, 4)}년 ${+m.slice(5)}월`)); }
    nodes.push(JournalCard(d, q));
  }
  if (days.length > shown.length) nodes.push(h('button', { class: 'btn soft wide j-next', onclick: () => { J.jn += 20; drawJournal(body); } }, `이전 일지 ${Math.min(20, days.length - shown.length)}일 더 보기`));
  body.replaceChildren(...nodes);
}
function JournalPanel() {
  const J = S.lib;
  const body = h('div', { class: 'jlist' });
  const search = h('div', { class: 'search' }, icon('search', 20),
    h('input', { class: 'input', type: 'search', placeholder: '일지에서 찾기 (메모, 피드백, 노래)', value: J.jq, 'data-fk': 'j-q', enterkeyhint: 'search', 'aria-label': '일지 검색', oninput: ev => { J.jq = ev.target.value; J.jn = 20; drawJournal(body); } }));
  drawJournal(body);
  return [search, h('div', { class: 'page' },
    h('div', { class: 'chips j-chips' },
      h('button', { class: 'chip sm', 'aria-pressed': String(!J.jall), onclick: () => { J.jall = false; J.jn = 20; render(); } }, '글 쓴 날'),
      h('button', { class: 'chip sm', 'aria-pressed': String(!!J.jall), onclick: () => { J.jall = true; J.jn = 20; render(); } }, '연습만 한 날도')),
    body)];
}
async function shareJournal(days) {
  const text = ['[노래일기] 일지 모음', ...days.slice().reverse().map(summaryText)].join('\n\n────────\n\n');
  try { if (!(await Files.share({ title: '노래일기 일지 모음', text }))) throw new Error('no share'); }
  catch (e) {
    const ta = h('textarea', { class: 'input', readOnly: true, rows: 12, value: text, style: 'min-height:260px' });
    openSheet({ title: '일지 모음', body: h('div', null, h('p', { class: 'hint', style: 'margin-bottom:10px' }, '아래 글을 길게 눌러 전체 선택한 뒤 복사하세요.'), ta) });
  }
}

/* ================= settings & backup ================= */
function TagEditor() {
  const box = h('div');
  const draw = () => {
    const inp = h('input', { class: 'input small', placeholder: '새 주제  예: 믹스보이스', maxlength: 12, 'aria-label': '새 주제' });
    const add = () => { const v = inp.value.trim(); if (!v || !inp.isConnected) return; if (!S.settings.tags.includes(v)) { S.settings.tags.push(v); touchSettings(); } draw(); const n = box.querySelector('input'); if (n) n.focus(); };
    bindEnter(inp, add);
    box.replaceChildren(
      h('div', { class: 'chips tag-edit' }, S.settings.tags.map((t, i) => h('span', { class: 'chip sm' }, t, h('button', { class: 'x', style: 'border:0;background:none;padding:0', 'aria-label': `${t} 주제 지우기`, onclick: () => { S.settings.tags.splice(i, 1); touchSettings(); draw(); } }, icon('x', 14))))),
      h('div', { class: 'composer', style: 'margin-top:10px' }, inp, h('button', { class: 'btn soft sm', onclick: add }, '추가')));
  };
  draw();
  return box;
}
function usedAudioIds() {
  const used = new Set();
  for (const d in S.days) S.days[d].recs.forEach(r => { if (r.aud) used.add(r.aud); });
  return used;
}
function StorageBlock() {
  const info = h('p', { class: 'hint' }, '저장 공간을 확인하고 있어요…');
  const btn = h('button', { class: 'btn soft sm', hidden: true, style: 'margin-top:10px' }, '');
  (async () => {
    try {
      const all = await Store.all('audio');
      const bytes = all.reduce((a, [, v]) => a + ((v && v.size) || 0), 0);
      const used = usedAudioIds();
      const orphans = all.filter(([k]) => !used.has(k));
      let txt = `녹음 ${all.length - orphans.length}개, ${fmtMB(bytes)}`;
      if (navigator.storage && navigator.storage.estimate) { try { const est = await navigator.storage.estimate(); if (est && est.quota) txt += ` (쓸 수 있는 공간 약 ${fmtMB(Math.max(0, est.quota - est.usage))})`; } catch (e) { /* ignore */ } }
      info.textContent = txt;
      if (orphans.length) {
        btn.hidden = false;
        btn.textContent = `기록에서 빠진 녹음 파일 ${orphans.length}개 정리`;
        btn.onclick = async () => {
          btn.disabled = true;
          const live = usedAudioIds();
          const gone = (await Store.keys('audio')).filter(k => !live.has(k));
          await Store.write('audio', gone.map(k => [k, undefined]));
          btn.hidden = true; toast(`${gone.length}개를 정리했어요`);
        };
      }
    } catch (e) { info.textContent = '저장 공간 정보를 불러오지 못했어요.'; }
  })();
  return h('div', null, info, btn);
}
function backupJSON(extra) { return JSON.stringify({ app: 'songdiary', v: 2, exportedAt: new Date().toISOString(), settings: S.settings, days: S.days, ...(extra || {}) }); }
function backupStamp() { const d = new Date(); return `${todayStr()}_${pad(d.getHours())}${pad(d.getMinutes())}`; }
function lastBackupInfo() { const u = lsGet(LS_UI, {}); return u.lastFull ? `마지막 전체 백업: ${fmtMD(ymd(new Date(u.lastFull)))} ${fmtHM(u.lastFull)}` : '아직 전체 백업을 한 적이 없어요.'; }
async function exportBackup(withAudio, how) {
  await flushWrites();
  const t = toastProgress('백업 파일을 만드는 중…');
  try {
    let blob, name;
    if (withAudio) {
      const files = [];
      const audio = {};
      const used = usedAudioIds();
      const all = await Store.all('audio');
      for (const [k, v] of all) {
        if (!used.has(k) || !v || !v.blob) continue;
        const fn = `audio/${k}.${extFor(v.mime)}`;
        audio[k] = { file: fn, mime: v.mime, size: v.size, name: v.name || '' };
        files.push({ name: fn, data: v.blob });
      }
      files.unshift({ name: 'songdiary.json', data: backupJSON({ audio }) });
      const total = files.reduce((a, f) => a + (f.data.size || f.data.length || 0), 0);
      if (total > 3.9 * 1024 * 1024 * 1024) { t.done('녹음이 4GB를 넘어서 한 파일로 백업할 수 없어요. 오래된 녹음을 ‘폰에 저장’으로 옮긴 뒤 지우고 다시 해 주세요.'); return; }
      blob = await makeZip(files, (i, n) => t.set(`백업 파일을 만드는 중… ${Math.round(i / n * 100)}%`));
      name = `노래일기-전체백업-${backupStamp()}.zip`;
    } else {
      blob = new Blob([backupJSON()], { type: 'application/json' });
      name = `노래일기-글백업-${backupStamp()}.json`;
    }
    if (how === 'share') {
      t.set('보낼 준비를 하는 중…');
      await Files.share({ title: name, text: '노래일기 백업', files: [{ name, blob }] });
      t.done();
    } else {
      const where = await Files.saveToDocuments('백업', name, blob, p => t.set(`폰에 저장하는 중… ${Math.round(p * 100)}%`));
      t.done(where ? `${where}에 저장했어요 (${fmtMB(blob.size)})` : `백업 파일을 저장했어요 (${fmtMB(blob.size)})`);
    }
    if (withAudio) { const u = lsGet(LS_UI, {}); u.lastFull = Date.now(); lsSet(LS_UI, u); }
  } catch (err) { console.error(err); t.done('백업 파일을 만들지 못했어요. 폰 저장 공간을 확인해 주세요.'); }
}
/* A quiet daily copy of the written records in 문서/노래일기/자동백업 (keeps the latest 14) */
async function autoBackup(force) {
  if (!Native.isNative || S.mode !== 'ready' || !S.settings.autoBackup || !entryDates().length) return;
  const u = lsGet(LS_UI, {});
  if (!force && u.lastAuto && Date.now() - u.lastAuto < 20 * 60 * 1000) return;
  u.lastAuto = Date.now(); lsSet(LS_UI, u);
  try {
    await Files.saveToDocuments('자동백업', `노래일기-자동백업-${todayStr()}.json`, new Blob([backupJSON()], { type: 'application/json' }));
    const files = (await Files.listDocuments('자동백업')).map(f => f.name).filter(n => /^노래일기-자동백업-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    for (const n of files.slice(0, Math.max(0, files.length - 14))) await Files.deleteDocument('자동백업', n);
  } catch (e) { console.warn('auto backup', e); }
}
/* Joins two versions of the same day without dropping anything either one has */
function mergeDay(cur, inc) {
  if (!cur || !hasContent(cur)) return inc;
  const newer = (inc.updatedAt || 0) > (cur.updatedAt || 0) ? inc : cur;
  const older = newer === inc ? cur : inc;
  const out = clone(newer);
  for (const k of ['recs', 'songs', 'good', 'bad', 'fb']) {
    const ids = new Set(out[k].map(x => x.id));
    older[k].forEach(x => { if (!ids.has(x.id)) out[k].push(clone(x)); });
  }
  for (const k of ['memo', 'goal', 'next']) {
    const a = (out[k] || '').trim(), b = (older[k] || '').trim();
    if (b && !a) out[k] = older[k];
    else if (b && a !== b && !a.includes(b)) out[k] = `${out[k]}
${older[k]}`;
  }
  for (const k of ['cond', 'sleep', 'rating', 'high']) if (out[k] == null && older[k] != null) out[k] = older[k];
  out.minutes = Math.max(out.minutes || 0, older.minutes || 0);
  out.water = Math.max(out.water || 0, older.water || 0);
  older.throat.forEach(x => { if (!out.throat.includes(x)) out.throat.push(x); });
  for (const id in older.drills) {
    const o = older.drills[id], n = out.drills[id];
    if (!n) out.drills[id] = clone(o);
    else { n.done = Math.max(n.done || 0, o.done || 0); (o.times || []).forEach(x => { if (!(n.times || []).includes(x)) n.times = (n.times || []).concat(x); }); }
  }
  return out;
}
function mergeSettings(cur, inc) {
  if (!cur.updatedAt) { const o = clone(inc); o.updatedAt = Date.now(); return normSettings(o); }
  if ( (inc.updatedAt || 0) > cur.updatedAt) { cur = { ...inc, reminder: cur.updatedAt ? cur.reminder : inc.reminder }; inc = S.settings; }
  const out = clone(cur);
  inc.drills.forEach(d => { if (!out.drills.some(x => x.id === d.id)) out.drills.push(clone(d)); });
  inc.tags.forEach(tg => { if (!out.tags.includes(tg)) out.tags.push(tg); });
  inc.songs.forEach(m => {
    const o = out.songs.find(x => x.k === m.k);
    if (!o) out.songs.push(clone(m));
    else { if (!o.artist) o.artist = m.artist; if (!o.memo) o.memo = m.memo; if (!o.status) o.status = m.status; if (!o.cat && m.cat) o.cat = m.cat; }
  });
  out.updatedAt = Date.now();
  return normSettings(out);
}
function importBackup() {
  const inp = $('#file-json');
  inp.value = '';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    let data = null, zip = null;
    try {
      const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      if (head[0] === 0x50 && head[1] === 0x4b) {
        zip = await readZip(f);
        const ent = zip.get('songdiary.json');
        if (ent) data = JSON.parse(await (await ent.read()).text());
      } else data = JSON.parse(await f.text());
    } catch (e) { data = null; }
    if (!data || data.app !== 'songdiary' || !data.days || typeof data.days !== 'object') { toast('노래일기 백업 파일이 아니에요.'); return; }
    const dates = Object.keys(data.days).filter(isDateKey);
    const audioMap = data.audio || {};
    const nAudio = zip ? Object.keys(audioMap).length : 0;
    confirmSheet({ title: '백업을 불러올까요?', text: `${dates.length}일치 기록${nAudio ? `과 녹음 ${nAudio}개` : ''}가 들어 있어요. 지금 기록은 지우지 않고 합쳐요. 같은 날짜는 더 나중에 고친 내용을 기준으로 합쳐요.`, ok: '불러오기', onOk: async () => {
      const t = toastProgress('불러오는 중…');
      try {
        let n = 0, na = 0;
        if (zip && nAudio) {
          const have = new Set(await Store.keys('audio'));
          const keys = Object.keys(audioMap);
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i], meta = audioMap[k];
            if (have.has(k)) continue;
            const ent = zip.get(meta.file);
            if (!ent) continue;
            const raw = await ent.read();
            const blob = new Blob([raw], { type: meta.mime || 'audio/mpeg' });
            await Store.put('audio', k, { blob, mime: meta.mime || blob.type, size: blob.size, name: meta.name || '', at: Date.now() });
            na++;
            t.set(`녹음 불러오는 중… ${i + 1}/${keys.length}`);
          }
        }
        const recHome = new Map();
        for (const d in S.days) S.days[d].recs.forEach(r => recHome.set(r.id, d));
        for (const d of dates) {
          const inc = normDay(d, clone(data.days[d]));
          /* a recording moved to another date here already — keep only that copy */
          inc.recs = inc.recs.filter(r => !recHome.has(r.id) || recHome.get(r.id) === d);
          if (!hasContent(inc)) continue;
          const cur = S.days[d];
          const merged = mergeDay(cur, inc);
          if (merged !== cur && (!cur || JSON.stringify(merged) !== JSON.stringify(cur))) { S.days[d] = normDay(d, merged); S.days[d].updatedAt = Math.max(S.days[d].updatedAt || 0, (cur && cur.updatedAt) || 0); queueWrite(d, 100); n++; }
        }
        if (data.settings && typeof data.settings === 'object') {
          S.settings = mergeSettings(S.settings, normSettings(data.settings));
          queueWrite('@s', 100); applyTheme();
          const Rm = S.settings.reminder;
          if (Rm.on) Native.setReminder(true, Rm.h, Rm.m, REMIND_TEXT).catch(() => {});
        }
        await flushWrites();
        while (Sheets.length) closeSheet(null, true);
        render();
        t.done(n || na ? `${n}일치 기록${na ? `, 녹음 ${na}개` : ''}를 불러왔어요` : '새로 불러올 기록이 없었어요');
      } catch (err) { console.error(err); t.done('불러오다가 문제가 생겼어요. 파일을 확인해 주세요.'); }
    } });
  };
  inp.click();
}
function toastProgress(msg) {
  const tt = $('#toast');
  tt.replaceChildren(h('span', null, msg));
  tt.classList.add('show');
  clearTimeout(toastTimer);
  return {
    set(m) { tt.firstChild.textContent = m; },
    done(m) { if (m) toast(m); else tt.classList.remove('show'); }
  };
}
const REMIND_TEXT = '오늘도 목 풀고 노래해 볼까요? 연습하고 나서 일기 한 줄 남겨요.';
function ReminderBlock() {
  const R = S.settings.reminder;
  const time = h('input', { class: 'input small', type: 'time', value: `${pad(R.h)}:${pad(R.m)}`, 'aria-label': '알림 시간', style: 'width:auto;min-width:130px' });
  const apply = async () => {
    let res;
    try { res = await Native.setReminder(R.on, R.h, R.m, REMIND_TEXT); }
    catch (e) { console.error(e); R.on = false; touchSettings(); draw(); toast('알림을 맞추지 못했어요. 다시 시도해 주세요.'); return; }
    if (res === 'denied') { R.on = false; touchSettings(); draw(); toast('알림 권한이 꺼져 있어요. 폰 설정에서 노래일기 알림을 허용해 주세요.'); }
    else if (res === 'unsupported' && R.on) toast('알림은 설치한 앱에서만 쓸 수 있어요');
    else if (R.on) toast(`매일 ${fmtHM(new Date(2000, 0, 1, R.h, R.m).getTime())}에 알려 드릴게요`);
  };
  time.addEventListener('change', () => { const [hh, mm] = time.value.split(':').map(Number); if (isNaN(hh)) return; R.h = hh; R.m = mm || 0; touchSettings(); if (R.on) apply(); });
  const box = h('div');
  const draw = () => box.replaceChildren(...[
    ToggleRow('매일 연습 알림', R.on, v => { R.on = v; touchSettings(); draw(); apply(); }, '정한 시간에 노래할 시간이라고 알려 줘요', 'bell'),
    R.on ? h('div', { class: 'cond-line' }, h('span', { class: 'lbl', style: 'width:auto' }, '알림 시간'), time) : null].filter(Boolean));
  draw();
  return box;
}
function openSettings() {
  if (S.mode !== 'ready') return;
  const titleInp = h('input', { class: 'input', value: S.settings.title, maxlength: 30, 'aria-label': '일기 이름' });
  titleInp.addEventListener('input', debounce(() => { S.settings.title = titleInp.value.trim() || defaultSettings().title; touchSettings(); $('#tb-title').textContent = S.settings.title; }, 400));
  const themeSeg = h('div', { class: 'seg' });
  const drawTheme = () => themeSeg.replaceChildren(...THEMES.map(([k, l]) => segBtn(l, S.settings.theme === k, () => { S.settings.theme = k; touchSettings(); applyTheme(); drawTheme(); })));
  drawTheme();
  const backupNote = h('p', { class: 'hint', style: 'margin-bottom:10px' }, lastBackupInfo());
  const verLine = h('p', { class: 'hint' }, '노래일기');
  Native.version().then(v => { if (v) verLine.textContent = `노래일기 ${v.version} (${v.build})`; });
  openSheet({
    title: '설정',
    body: h('div', null,
      h('div', { class: 'set-block' }, field('일기 이름', titleInp), h('div', { class: 'field', style: 'margin-bottom:0' }, h('span', { class: 'lbl' }, '화면'), themeSeg)),
      h('div', { class: 'set-block' }, h('div', { class: 'set-h' }, h('h4', null, '기초 연습 항목'), h('span', { class: 'hint' }, '횟수를 바꾸면 오늘 기록부터 적용돼요')), DrillEditor()),
      h('div', { class: 'set-block' }, h('div', { class: 'set-h' }, h('h4', null, '피드백 주제'), h('span', { class: 'hint' }, '아쉬운 점과 피드백에 붙이는 이름표예요')), TagEditor()),
      h('div', { class: 'set-block' },
        ToggleRow('체크할 때 음 소리', S.settings.sound, v => { S.settings.sound = v; touchSettings(); }, '횟수를 채울 때마다 도레미파솔 음이 울려요', 'sound'),
        ToggleRow('진동', S.settings.haptic, v => { S.settings.haptic = v; touchSettings(); if (v) vibrate(12); }, '체크하거나 표시할 때 살짝 떨려요', 'vibe')),
      h('div', { class: 'set-block' }, h('div', { class: 'set-h' }, h('h4', null, '노래 찾기')),
        ToggleRow('실제 노래 검색', S.settings.songSearch, v => { S.settings.songSearch = v; touchSettings(); }, '노래 제목을 몇 글자 치면 Apple Music 곡 목록에서 찾아 줘요. 입력한 검색어만 보내고 일기 내용은 보내지 않아요. 끄면 내가 부른 노래에서만 찾아요.', 'search')),
      h('div', { class: 'set-block' }, h('div', { class: 'set-h' }, h('h4', null, '알림')), ReminderBlock()),
      h('div', { class: 'set-block' }, h('div', { class: 'set-h' }, h('h4', null, '백업')),
        h('p', { class: 'hint', style: 'margin-bottom:6px' }, '모든 기록과 녹음은 이 폰 안에만 저장돼요. 폰을 바꾸거나 앱을 지우기 전에 꼭 전체 백업을 해 두세요.'),
        backupNote,
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn ink sm', onclick: () => exportBackup(true, 'save') }, icon('down', 17), '전체 백업 (녹음 포함)'),
          h('button', { class: 'btn soft sm', onclick: () => exportBackup(true, 'share') }, icon('share', 17), '백업 보내기'),
          h('button', { class: 'btn soft sm', onclick: () => exportBackup(false, 'save') }, '글만 백업'),
          h('button', { class: 'btn soft sm', onclick: importBackup }, icon('upload', 17), '백업 불러오기')),
        Native.isNative ? h('p', { class: 'hint', style: 'margin-top:8px' }, '저장 위치: 내 파일 > 문서 > 노래일기 > 백업. ‘백업 보내기’로 구글 드라이브나 카카오톡 나에게 보내 두면 더 안전해요.') : null,
        Native.isNative ? ToggleRow('매일 자동 백업 (글만)', S.settings.autoBackup, v => { S.settings.autoBackup = v; touchSettings(); if (v) autoBackup(true); }, '앱을 닫을 때 문서 > 노래일기 > 자동백업에 최근 14일치를 남겨요', 'save') : null),
      h('div', { class: 'set-block' }, h('div', { class: 'set-h' }, h('h4', null, '저장 공간')), StorageBlock()),
      h('div', { class: 'set-block' }, verLine, h('p', { class: 'hint' }, '이전 노래일기(웹)에서 ‘백업 파일 저장’으로 받은 파일도 ‘백업 불러오기’로 옮길 수 있어요. 그때 녹음은 파일이 옮겨지지 않아서 ‘보내기’로 받은 파일을 따로 불러와야 해요.'))),
    onClose: () => render()
  });
}

/* ================= boot ================= */
function bindViewport() {
  const vv = window.visualViewport;
  let base = window.innerHeight, lastW = window.innerWidth;
  const upd = () => {
    if (window.innerWidth !== lastW) { lastW = window.innerWidth; base = window.innerHeight; }
    const vh = vv ? vv.height : window.innerHeight;
    base = Math.max(base, window.innerHeight);
    const overlay = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    const root = document.documentElement;
    root.style.setProperty('--kb', (overlay > 80 ? overlay : 0) + 'px');
    root.style.setProperty('--vvh', vh + 'px');
    document.body.classList.toggle('kb', base - vh > 150);
  };
  if (vv) { vv.addEventListener('resize', upd); vv.addEventListener('scroll', upd); }
  window.addEventListener('resize', upd);
  upd();
  /* keep what you're typing above the keyboard */
  document.addEventListener('focusin', ev => {
    const el = ev.target;
    if (!isTyping() || !el || !el.getBoundingClientRect) return;
    setTimeout(() => {
      if (document.activeElement !== el) return;
      const vh = vv ? vv.height : window.innerHeight;
      const r = el.getBoundingClientRect();
      if (r.bottom > vh - 24 || r.top < 60) el.scrollIntoView({ block: el.tagName === 'TEXTAREA' && r.height > vh * 0.5 ? 'start' : 'center', behavior: 'smooth' });
    }, 320);
  });
}
function followToday() {
  if (S.follow && S.mode === 'ready' && S.date !== todayStr()) { S.date = todayStr(); softRender(); }
}
function bindGlobal() {
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.tab;
    haptic(5);
    if (S.tab === t) {
      if (t === 'today' && S.date !== todayStr()) { goDate(todayStr()); return; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (t === 'today' && S.date !== todayStr() && S.follow) S.date = todayStr();
    go(t);
  }));
  $('#btn-settings').addEventListener('click', openSettings);
  $('#save-state').addEventListener('click', retrySaves);
  $('#tb-timer').addEventListener('click', () => { const tm = lsGet(LS_TIMER, null); if (tm) goDate(tm.date); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && Sheets.length) closeSheet(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { flushWrites(); autoBackup(); }
    else followToday();
  });
  window.addEventListener('pagehide', () => { flushWrites(); });
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) { /* old webview */ } }
  bindViewport();
  let ticks = 0;
  setInterval(() => { tickTimer(); if (++ticks % 30 === 0) followToday(); }, 1000);
  /* Android back button: sheet → keyboard → tab → today → leave */
  let lastBack = 0;
  Native.onBack(() => {
    if (Sheets.length) { closeSheet(); return; }
    if (isTyping()) { document.activeElement.blur(); return; }
    if (S.tab !== 'today') { go('today'); return; }
    if (S.date !== todayStr()) { goDate(todayStr()); return; }
    if (Date.now() - lastBack < 2000) { flushWrites(); Native.minimize(); return; }
    lastBack = Date.now();
    toast('한 번 더 누르면 앱을 닫아요');
  });
  Native.onPause(() => { flushWrites(); autoBackup(); });
  Native.onResume(followToday);
}
async function takeShared(list) {
  const files = [];
  for (const f of list) { try { files.push(await Files.readShared(f)); } catch (e) { console.warn(e); } }
  if (!files.length) { toast('받은 파일을 읽지 못했어요'); return; }
  if (S.mode !== 'ready') return;
  const date = S.tab === 'today' ? S.date : todayStr();
  openImport(date, files, 'share');
}
let booted = false;
function afterLoad() {
  if (booted || S.mode !== 'ready') return;
  booted = true;
  Native.onShared(takeShared);
  if (!Native.isNative) window.__sdTest = { openImport, openRecDetail, exportBackup, S };
  const R = S.settings.reminder;
  if (R.on) Native.setReminder(true, R.h, R.m, REMIND_TEXT).catch(() => {});
  setTimeout(() => autoBackup(), 4000);
}
async function init() {
  Player.init();
  bindGlobal();
  render();
  await loadAll();
}
init();
})();
