/* 노래일기 — account and sync through the owner's own Supabase project (email code login, records, recordings).
   Only this file talks to the server; app.js decides what to send and how to merge. */
(function () {
'use strict';

/* The project this app uses (the owner's Supabase project, Seoul). Another one can be entered in 설정 > 계정·동기화
   (kept on that phone only). The publishable key is meant to be in apps: what each account may read or write is
   enforced by the database rules in cloud/setup.sql. */
const PROJECT = { url: 'https://tihkkibxulwdttqpqysr.supabase.co', key: 'sb_publishable_bxNL8TopRdgbGRleaLJv2A_QR75aFmb' };
const LS_AUTH = 'songdiary:v1:auth', LS_CFG = 'songdiary:v1:cloudcfg', LS_EMAIL = 'songdiary:v1:email';
const BUCKET = 'sd-audio';

const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const okUrl = u => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(u);

function err(kind, extra) { const e = new Error(kind); e.kind = kind; Object.assign(e, extra || {}); return e; }
const wait = ms => new Promise(r => setTimeout(r, ms));

/* The login stays until 로그아웃 (자동 로그인): Supabase refresh tokens don't expire, but each refresh replaces the
   token, and a token two replacements old ends the login. So the newest one must not be lost: it is kept in
   localStorage (read right away) and in IndexedDB, written with strict durability before it is used — the WebView
   puts localStorage on disk about a second later, and Android may end the app in between. Whichever copy is newer
   wins when the app starts (restore). */
const idb = () => (window.SD && window.SD.Store) || null;
function saveAuth(v) {
  const prev = lsGet(LS_AUTH, null);
  const rec = Object.assign({}, v, { at: Math.max(Date.now(), ((prev && prev.at) || 0) + 1) });
  lsSet(LS_AUTH, rec);
  const S = idb();
  return S ? S.put('meta', 'auth', rec, { durability: 'strict' }).catch(() => {}) : Promise.resolve();
}
/* the answers to a refresh that mean this login is over (always HTTP 400). Everything else — 401 (a wrong key, from
   the gateway), 409 (refreshes at the same moment), 429, 5xx, no connection — leaves it as it is and is tried later. */
const GONE = ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'user_not_found', 'user_banned', 'validation_failed'];

const Cloud = {
  BUCKET,
  config() {
    const c = lsGet(LS_CFG, null);
    if (c && okUrl(c.url) && c.key) return { url: c.url, key: c.key, custom: true };
    if (PROJECT.url && PROJECT.key) return { url: PROJECT.url, key: PROJECT.key, custom: false };
    return null;
  },
  builtIn() { return !!(PROJECT.url && PROJECT.key); },
  /* the address shown in Supabase > Project Settings > API ('https://xxxx.supabase.co') and its public key */
  async setConfig(url, key) {
    url = String(url || '').trim().replace(/\/+$/, '');
    key = String(key || '').trim();
    if (!okUrl(url)) throw err('bad-url');
    if (!key || key.length < 20) throw err('bad-key');
    /* a public endpoint: answers 200 only for a real project with a valid key */
    const r = await this.raw(url, key, '/auth/v1/settings', { auth: false, timeout: 10000 });
    if (!r.ok) throw err(r.status === 401 ? 'bad-key' : 'unreachable', { status: r.status });
    lsSet(LS_CFG, { url, key });
  },
  clearConfig() { lsSet(LS_CFG, null); },
  session() { const s = lsGet(LS_AUTH, null); return s && s.access_token && s.refresh_token && s.user && s.user.id ? s : null; },
  /* once when the app starts, before anything else here is used */
  async restore() {
    const S = idb();
    if (!S) return;
    let d = null;
    try { d = await S.get('meta', 'auth'); } catch (e) { return; }
    const l = lsGet(LS_AUTH, null);
    if (d && (!l || (d.at || 0) > (l.at || 0))) lsSet(LS_AUTH, d);
    else if (l && (!d || (l.at || 0) > (d.at || 0))) S.put('meta', 'auth', l).catch(() => {});
  },
  /* the address the code was last sent to, for logging in again */
  lastEmail() { const e = lsGet(LS_EMAIL, ''); return typeof e === 'string' ? e : ''; },
  user() { const s = this.session(); return s && s.user ? s.user : null; },
  signedIn() { return !!(this.config() && this.user()); },

  async raw(url, key, path, o = {}) {
    const headers = Object.assign({ apikey: key }, o.headers || {});
    if (o.json !== undefined) headers['content-type'] = 'application/json';
    if (o.token) headers.authorization = 'Bearer ' + o.token;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctl) ctl.abort(); }, o.timeout || 20000);
    try {
      return await fetch(url + path, { method: o.method || (o.json !== undefined || o.body ? 'POST' : 'GET'), headers, body: o.json !== undefined ? JSON.stringify(o.json) : o.body, credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    } catch (e) {
      throw err(navigator.onLine === false ? 'offline' : 'network', { cause: e });
    } finally { clearTimeout(t); }
  },
  async body(r) { const t = await r.text(); try { return t ? JSON.parse(t) : null; } catch (e) { return t; } },

  /* ---------- login: a 6-digit code sent by email ---------- */
  async sendCode(email) {
    const c = this.config();
    if (!c) throw err('no-config');
    const r = await this.raw(c.url, c.key, '/auth/v1/otp', { json: { email, create_user: true } });
    if (r.ok) { lsSet(LS_EMAIL, email); return; }
    const b = await this.body(r), code = b && typeof b === 'object' ? String(b.error_code || '') : '';
    throw err(r.status === 429 ? 'rate-limit' : code === 'validation_failed' ? 'bad-email'
      : code === 'email_address_not_authorized' ? 'not-authorized' : (code === 'otp_disabled' || code === 'signup_disabled') ? 'no-signup' : 'send-failed', { status: r.status, detail: b });
  },
  async verifyCode(email, code) {
    const c = this.config();
    if (!c) throw err('no-config');
    const r = await this.raw(c.url, c.key, '/auth/v1/verify', { json: { type: 'email', email, token: String(code).trim() } });
    const b = await this.body(r);
    if (!r.ok) throw err(r.status === 429 ? 'rate-limit' : 'bad-code', { status: r.status, detail: b });
    await this.keep(b);
    return this.user();
  },
  keep(b) {
    if (!b || !b.access_token || !b.refresh_token || !b.user || !b.user.id) throw err('bad-session');
    /* by this phone's clock (a phone whose clock runs ahead would otherwise refresh before every request) */
    const exp = b.expires_in ? Date.now() + b.expires_in * 1000 : b.expires_at ? b.expires_at * 1000 : Date.now() + 3600e3;
    return saveAuth({ access_token: b.access_token, refresh_token: b.refresh_token, expires_at: exp, user: { id: b.user.id, email: b.user.email } });
  },
  refreshing: null,
  /* one refresh at a time. Only an answer saying this login is over logs out; anything else keeps it. */
  refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const c = this.config(), s = this.session();
      if (!c || !s) throw err('signed-out');
      let r = null;
      /* a refresh whose answer got lost is sent again at once: the server still takes the same token for a few seconds */
      for (let i = 0; ; i++) {
        try { r = await this.raw(c.url, c.key, '/auth/v1/token?grant_type=refresh_token', { json: { refresh_token: s.refresh_token }, timeout: 7000 }); break; }
        catch (e) { if (i >= 2 || e.kind === 'offline') throw e; await wait(400); }
      }
      const b = await this.body(r);
      const now = this.session();
      /* logged out meanwhile, or replaced by a newer one (e.g. restored): this answer is not kept */
      if (!now) throw err('signed-out');
      if (now.refresh_token !== s.refresh_token) return;
      if (r.ok) { await this.keep(b); return; }
      const code = b && typeof b === 'object' ? String(b.error_code || (typeof b.code === 'string' ? b.code : '') || b.error || '') : '';
      const text = b && typeof b === 'object' ? String(b.msg || b.message || b.error_description || '') : String(b || '');
      if (r.status === 429) throw err('rate-limit', { status: r.status });
      if (r.status === 401) throw err('bad-key', { status: r.status });
      if (r.status === 400 && (GONE.includes(code) || code === 'invalid_grant' || /refresh token/i.test(text))) {
        await saveAuth({ out: true });
        throw err('signed-out', { status: r.status, detail: b });
      }
      throw err('server', { status: r.status, detail: b });
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  },
  async token() {
    const s = this.session();
    if (!s) throw err('signed-out');
    if (s.expires_at - Date.now() < 60000) await this.refresh();
    const n = this.session();
    if (!n) throw err('signed-out');
    return n.access_token;
  },
  /* an authorised request; retried once with a fresh token if the server says the old one expired */
  async call(path, o = {}) {
    const c = this.config();
    if (!c) throw err('no-config');
    let r = await this.raw(c.url, c.key, path, Object.assign({}, o, { token: await this.token() }));
    if (r.status === 401 || (r.status === 400 && /storage/.test(path) && /jwt|exp|Unauthorized/i.test(await r.clone().text()))) {
      await this.refresh();
      r = await this.raw(c.url, c.key, path, Object.assign({}, o, { token: await this.token() }));
    }
    return r;
  },
  async signOut() {
    /* the server ends the login only for a token that is still good */
    const s0 = this.session();
    if (s0 && s0.expires_at - Date.now() < 60000) await Promise.race([this.refresh().catch(() => {}), wait(5000)]);
    const c = this.config(), s = this.session();
    await saveAuth({ out: true });
    if (c && s) { try { await this.raw(c.url, c.key, '/auth/v1/logout?scope=local', { method: 'POST', token: s.access_token, timeout: 6000 }); } catch (e) { /* signed out here anyway */ } }
  },
  /* ends the login on every other phone (a lost phone keeps no access); this one stays logged in */
  async signOutOthers() {
    const r = await this.call('/auth/v1/logout?scope=others', { method: 'POST', timeout: 10000 });
    if (!r.ok && r.status !== 204) throw err('server', { status: r.status });
  },

  /* ---------- records ---------- */
  async select(table, query) {
    const r = await this.call(`/rest/v1/${table}?${query}`);
    const b = await this.body(r);
    if (!r.ok) throw err(r.status === 404 ? 'no-tables' : 'server', { status: r.status, detail: b });
    return Array.isArray(b) ? b : [];
  },
  async rpc(fn, args) {
    const r = await this.call(`/rest/v1/rpc/${fn}`, { json: args });
    const b = await this.body(r);
    if (!r.ok) throw err(r.status === 404 ? 'no-tables' : 'server', { status: r.status, detail: b });
    return Array.isArray(b) ? b[0] : b;
  },

  /* ---------- recordings (private bucket, one folder per account) ---------- */
  audioPath(aud) { return `${this.user().id}/${encodeURIComponent(aud)}`; },
  async upload(aud, blob, mime) {
    const r = await this.call(`/storage/v1/object/${BUCKET}/${this.audioPath(aud)}`, { method: 'POST', body: blob, headers: { 'content-type': mime || blob.type || 'application/octet-stream', 'x-upsert': 'true' }, timeout: 180000 });
    if (r.ok) return;
    const b = await this.body(r);
    throw err(r.status === 413 || (b && String(b.statusCode) === '413') ? 'too-big' : 'server', { status: r.status, detail: b });
  },
  async remove(aud) {
    const r = await this.call(`/storage/v1/object/${BUCKET}/${this.audioPath(aud)}`, { method: 'DELETE', timeout: 20000 });
    if (r.ok) return;
    const b = await this.body(r);
    if (b && String(b.statusCode) === '404') return; /* already gone */
    throw err('server', { status: r.status, detail: b });
  },
  async download(aud) {
    const r = await this.call(`/storage/v1/object/authenticated/${BUCKET}/${this.audioPath(aud)}`, { timeout: 180000 });
    if (r.ok) return r.blob();
    const b = await this.body(r);
    throw err(b && String(b.statusCode) === '404' ? 'not-found' : 'server', { status: r.status, detail: b });
  }
};

window.Cloud = Cloud;
})();
