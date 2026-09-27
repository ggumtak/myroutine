/* 노래일기 — account and sync through the owner's own Supabase project (email code login, records, recordings).
   Only this file talks to the server; app.js decides what to send and how to merge. */
(function () {
'use strict';

/* The project this app uses. Filled in once the Supabase project exists; until then the address and the public
   key can be entered in 설정 > 계정·동기화 (kept on this phone only). The public (anon/publishable) key is meant
   to be in apps: what each account may read or write is enforced by the database rules in cloud/setup.sql. */
const PROJECT = { url: '', key: '' };
const LS_AUTH = 'songdiary:v1:auth', LS_CFG = 'songdiary:v1:cloudcfg';
const BUCKET = 'sd-audio';

const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const okUrl = u => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(u);

function err(kind, extra) { const e = new Error(kind); e.kind = kind; Object.assign(e, extra || {}); return e; }

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
  session() { return lsGet(LS_AUTH, null); },
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
    if (r.ok) return;
    const b = await this.body(r);
    throw err(r.status === 429 ? 'rate-limit' : (b && b.error_code) === 'validation_failed' ? 'bad-email' : 'send-failed', { status: r.status, detail: b });
  },
  async verifyCode(email, code) {
    const c = this.config();
    if (!c) throw err('no-config');
    const r = await this.raw(c.url, c.key, '/auth/v1/verify', { json: { type: 'email', email, token: String(code).trim() } });
    const b = await this.body(r);
    if (!r.ok) throw err(r.status === 429 ? 'rate-limit' : 'bad-code', { status: r.status, detail: b });
    this.keep(b);
    return this.user();
  },
  keep(b) {
    if (!b || !b.access_token || !b.refresh_token || !b.user) throw err('bad-session');
    const exp = b.expires_at ? b.expires_at * 1000 : Date.now() + (b.expires_in || 3600) * 1000;
    lsSet(LS_AUTH, { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: exp, user: { id: b.user.id, email: b.user.email } });
  },
  refreshing: null,
  /* one refresh at a time; a refresh token that the server no longer accepts means logging in again */
  refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const c = this.config(), s = this.session();
      if (!c || !s) throw err('signed-out');
      const r = await this.raw(c.url, c.key, '/auth/v1/token?grant_type=refresh_token', { json: { refresh_token: s.refresh_token } });
      const b = await this.body(r);
      if (!r.ok) {
        if (r.status >= 400 && r.status < 500) { lsSet(LS_AUTH, null); throw err('signed-out', { status: r.status, detail: b }); }
        throw err('server', { status: r.status });
      }
      this.keep(b);
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  },
  async token() {
    const s = this.session();
    if (!s) throw err('signed-out');
    if (s.expires_at - Date.now() < 60000) await this.refresh();
    return this.session().access_token;
  },
  /* an authorised request; retried once with a fresh token if the server says the old one expired */
  async call(path, o = {}) {
    const c = this.config();
    if (!c) throw err('no-config');
    let r = await this.raw(c.url, c.key, path, Object.assign({}, o, { token: await this.token() }));
    if (r.status === 401 || (r.status === 400 && /storage/.test(path) && /jwt|exp|Unauthorized/i.test(await r.clone().text()))) {
      await this.refresh();
      r = await this.raw(c.url, c.key, path, Object.assign({}, o, { token: this.session().access_token }));
    }
    return r;
  },
  async signOut() {
    const c = this.config(), s = this.session();
    lsSet(LS_AUTH, null);
    if (c && s) { try { await this.raw(c.url, c.key, '/auth/v1/logout?scope=local', { method: 'POST', token: s.access_token, timeout: 6000 }); } catch (e) { /* signed out here anyway */ } }
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
  async download(aud) {
    const r = await this.call(`/storage/v1/object/authenticated/${BUCKET}/${this.audioPath(aud)}`, { timeout: 180000 });
    if (r.ok) return r.blob();
    const b = await this.body(r);
    throw err(b && String(b.statusCode) === '404' ? 'not-found' : 'server', { status: r.status, detail: b });
  }
};

window.Cloud = Cloud;
})();
