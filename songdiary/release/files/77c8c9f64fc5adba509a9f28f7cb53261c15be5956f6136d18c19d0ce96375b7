/* 노래일기 — finding songs the way a karaoke remote does: a few letters, 초성, or the singer's name.
   Two sources: songs already in the diary (instant, offline) and a real song catalog (Apple Music, KR store). */
(function () {
'use strict';

/* ---------- Hangul ---------- */
const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
/* vowels and final consonants spelled as the keys you press, so a half-typed syllable still matches:
   '괘' → ㄱㅗㅐ is a prefix of '괜' → ㄱㅗㅐㄴ, and '살' → ㅅㅏㄹ is a prefix of '사랑' → ㅅㅏㄹㅏㅇ */
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const COMPAT = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ', 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };
const isSyl = c => c >= 0xAC00 && c <= 0xD7A3;
/* lower case, no spaces or punctuation: '사건의지평선' finds '사건의 지평선', 'lovewins' finds 'Love wins all' */
const fold = s => String(s || '').normalize('NFC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
function jamo(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (isSyl(c)) { const i = c - 0xAC00; out += CHO[Math.floor(i / 588)] + JUNG[Math.floor(i % 588 / 28)] + JONG[i % 28]; }
    else out += COMPAT[ch] || ch;
  }
  return out;
}
function initials(s) {
  let out = '';
  for (const ch of s) { const c = ch.charCodeAt(0); out += isSyl(c) ? CHO[Math.floor((c - 0xAC00) / 588)] : ch; }
  return out;
}
const isChoQuery = q => /^[ㄱ-ㅎ]+$/.test(q);

/* 0 = no match; higher is better */
function match(query, text) {
  const q = fold(query), t = fold(text);
  if (!q || !t) return 0;
  if (isChoQuery(q)) { const i = initials(t).indexOf(q); return i === 0 ? 70 : i > 0 ? 45 : 0; }
  if (t === q) return 100;
  const qj = jamo(q), tj = jamo(t);
  if (tj.startsWith(qj)) return 85;
  return tj.includes(qj) ? 60 : 0;
}

/* What is worth sending to the catalog: no 초성-only queries, and no half-typed last letter */
function onlineTerm(q) {
  const t = String(q || '').normalize('NFC').replace(/[ㄱ-ㆎ]+$/u, '').trim().replace(/\s+/g, ' ');
  if (!t || isChoQuery(fold(t))) return '';
  const syl = (t.match(/[가-힣]/g) || []).length, lat = (t.match(/[a-z0-9]/gi) || []).length;
  return syl >= 1 || lat >= 2 ? t : '';
}

/* '사랑은 늘 도망가 (feat. X)' → '사랑은 늘 도망가' — the diary keys songs by title */
function cleanTitle(t) {
  return String(t || '').replace(/\s*[([](?:feat|ft|with|prod)\.?\s[^)\]]*[)\]]\s*$/i, '').trim() || String(t || '').trim();
}

/* ---------- catalog: iTunes Search API (no key; KR store has Korean titles and names) ---------- */
const ART_OK = /^https:\/\/[a-z0-9.-]+\.mzstatic\.com\//i;
const PREV_OK = /^https:\/\/[a-z0-9.-]+\.(?:apple\.com|mzstatic\.com)\//i;
function parseItunes(data) {
  const out = [], seen = new Set();
  for (const r of (data && Array.isArray(data.results) ? data.results : [])) {
    if (!r || typeof r !== 'object' || (r.kind && r.kind !== 'song') || !r.trackName) continue;
    const title = String(r.trackName).trim().slice(0, 80), artist = String(r.artistName || '').trim().slice(0, 60);
    const k = fold(cleanTitle(title)) + '|' + fold(artist);
    if (seen.has(k)) continue;
    seen.add(k);
    const art = String(r.artworkUrl100 || r.artworkUrl60 || '');
    const prev = String(r.previewUrl || '');
    out.push({
      src: 'itunes', id: +r.trackId || 0, title, artist,
      album: String(r.collectionName || '').trim().slice(0, 80),
      art: ART_OK.test(art) ? art : '',
      prev: PREV_OK.test(prev) ? prev : '',
      year: /^\d{4}/.test(String(r.releaseDate || '')) ? +String(r.releaseDate).slice(0, 4) : null,
      ms: +r.trackTimeMillis || null,
      genre: String(r.primaryGenreName || '').slice(0, 30)
    });
  }
  return out;
}
const Catalog = {
  cache: new Map(), coolUntil: 0,
  url(term) { return `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=KR&media=music&entity=song&limit=25`; },
  /* getJson(url) → parsed JSON; throws on network trouble */
  async search(term, getJson) {
    const key = term.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.items;
    if (Date.now() < this.coolUntil) { const e = new Error('busy'); e.busy = true; throw e; }
    let data;
    try { data = await getJson(this.url(term)); }
    catch (e) { if (e && (e.status === 403 || e.status === 429)) { this.coolUntil = Date.now() + 60 * 1000; e.busy = true; } throw e; }
    const items = parseItunes(data);
    /* titles that start with what was typed first; otherwise keep the catalog's own order */
    const ranked = items.map((it, i) => ({ it, i, s: match(term, cleanTitle(it.title)) })).sort((a, b) => (b.s >= 85) - (a.s >= 85) || a.i - b.i).map(x => x.it);
    this.cache.set(key, { at: Date.now(), items: ranked });
    if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value);
    return ranked;
  }
};

window.SongSearch = { fold, jamo, initials, match, onlineTerm, cleanTitle, parseItunes, Catalog };
})();
