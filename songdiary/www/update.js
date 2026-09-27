/* 노래일기 — in-app update. New versions of the app's screens are published on GitHub with a signed list of
   files; the app downloads what changed, checks every file, and switches to the new copy without reinstalling.
   Only the Android app shell (installed from the APK) stays the same; installing a newer APK always wins. */
(function () {
'use strict';

const Cap = window.Capacitor;
const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
/* the signed list of the newest version (the main branch of the app's public repository) */
const CHANNEL = 'https://raw.githubusercontent.com/ggumtak/myroutine/main/songdiary/release/latest.json';
/* only lists signed with the matching private key are accepted */
const PUBKEY = { kty: 'EC', crv: 'P-256', x: 'd_MR63hlKyluLJIGmEblfGDlzCSNpIuP3uGL7PcQM44', y: 't-1LMp5HV0PTWeAIigpf89HX72JiGDbMokSxB5aoFXc' };
const LS = 'songdiary:v1:ota';
/* tests point the channel and key elsewhere; nothing in the app sets this */
const cfg = () => Object.assign({ channel: CHANNEL, pubkey: PUBKEY, httpBase: false }, window.SD_OTA_TEST || {});

const load = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null') || {}; } catch (e) { return {}; } };
const save = s => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { /* ignore */ } };
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async buf => hex(await crypto.subtle.digest('SHA-256', buf));
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function b64e(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function native(plugin, method, opts) { return Cap.nativePromise(plugin, method, opts || {}); }
const FS = (method, opts) => native('Filesystem', method, opts);
/* a file path from the list: plain relative names only */
const okPath = p => typeof p === 'string' && p.length < 200 && /^[A-Za-z0-9_.\-/]+$/.test(p) && !p.split('/').some(s => !s || s === '.' || s === '..');
const enc = p => p.split('/').map(encodeURIComponent).join('/');

async function getBytes(url, timeoutMs = 20000) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => { if (ctl) ctl.abort(); }, timeoutMs);
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined });
    if (!r.ok) { const e = new Error('http ' + r.status); e.status = r.status; throw e; }
    return await r.arrayBuffer();
  } finally { clearTimeout(t); }
}

/* the version this copy of the app is (written by the publish tool) */
let curP = null;
function current() {
  if (!curP) curP = getBytes('release.json', 8000).then(b => JSON.parse(new TextDecoder().decode(b))).catch(() => null);
  return curP;
}

/* {body: '<json>', sig: '<base64 r||s>'} → the checked contents, or an error */
async function verify(text) {
  const c = cfg();
  let m;
  try { m = JSON.parse(text); } catch (e) { throw new Error('bad-json'); }
  if (!m || typeof m.body !== 'string' || typeof m.sig !== 'string') throw new Error('bad-format');
  const key = await crypto.subtle.importKey('jwk', c.pubkey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64d(m.sig), new TextEncoder().encode(m.body));
  if (!ok) throw new Error('bad-signature');
  const b = JSON.parse(m.body);
  const baseOk = typeof b.base === 'string' && (/^https:\/\//.test(b.base) || (c.httpBase && /^http:\/\/127\.0\.0\.1[:/]/.test(b.base)));
  if (b.app !== 'songdiary' || !Number.isInteger(b.code) || typeof b.version !== 'string' || !baseOk || !b.files || typeof b.files !== 'object' || !/^[0-9a-f]{64}$/.test(b.releaseJson || '')) throw new Error('bad-body');
  for (const p in b.files) if (!okPath(p) || p === 'release.json' || !/^[0-9a-f]{64}$/.test(b.files[p])) throw new Error('bad-file');
  if (!b.files['index.html'] || !b.files['app.js']) throw new Error('bad-body');
  return b;
}

const OTA = {
  isNative,
  current,
  /* the newest published version, if it is newer than this one and wasn't found broken here */
  async check() {
    const cur = await current();
    if (!cur) return { cur: null, latest: null };
    const text = new TextDecoder().decode(await getBytes(`${cfg().channel}?t=${Date.now()}`, 10000));
    const latest = await verify(text);
    const s = load();
    return { cur, latest: latest.code > cur.code && s.bad !== latest.code ? latest : null, published: latest };
  },
  /* downloads the changed files, copies the rest from this copy, checks all of them, then switches.
     onProgress(done, total, fetched) */
  async apply(latest, onProgress) {
    if (!isNative) throw new Error('unsupported');
    const cur = await current();
    const dir = `ota/v${latest.code}`;
    try { await FS('rmdir', { path: dir, directory: 'DATA', recursive: true }); } catch (e) { /* not there */ }
    const paths = Object.keys(latest.files);
    const jobs = paths.map(p => ({ p, hash: latest.files[p] })).concat([{ p: 'release.json', hash: latest.releaseJson }]);
    let done = 0, fetched = 0;
    const one = async ({ p, hash }) => {
      let buf = null;
      if (cur && cur.files && cur.files[p] === hash) {
        try { buf = await getBytes(enc(p)); if (await sha256(buf) !== hash) buf = null; } catch (e) { buf = null; }
      }
      if (!buf) {
        buf = await getBytes(latest.base + enc(p));
        fetched++;
        if (await sha256(buf) !== hash) throw new Error('bad-hash:' + p);
      }
      await FS('writeFile', { path: `${dir}/${p}`, directory: 'DATA', data: b64e(buf), recursive: true });
      done++;
      if (onProgress && !failed) onProgress(done, jobs.length, fetched);
    };
    /* a few at a time; the first failure stops all of them and removes what was written */
    let i = 0, failed = null;
    const worker = async () => { while (i < jobs.length && !failed) { try { await one(jobs[i++]); } catch (e) { failed = failed || e; } } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (failed) {
      try { await FS('rmdir', { path: dir, directory: 'DATA', recursive: true }); } catch (e) { /* ignore */ }
      throw failed;
    }
    const uri = (await FS('getUri', { path: dir, directory: 'DATA' })).uri;
    const path = decodeURI(String(uri).replace(/^file:\/\//, ''));
    const s = load();
    s.pending = latest.code;
    s.pendingPath = path;
    s.prev = s.active && s.activePath ? { type: 'file', path: s.activePath } : { type: 'asset' };
    save(s);
    /* the WebView reloads from the new copy; it is kept only after it starts up fine (confirmBoot) */
    await native('WebView', 'setServerBasePath', { path });
  },
  /* called once the app has started and drawn its first screen */
  async confirmBoot() {
    window.__sdBooted = true;
    if (!isNative) return;
    const cur = await current();
    if (!cur) return;
    const s = load();
    if (s.pending && s.pending === cur.code) {
      try { await native('WebView', 'persistServerBasePath'); } catch (e) { return; }
      s.active = s.pending; s.activePath = s.pendingPath;
      delete s.pending; delete s.pendingPath; delete s.prev;
      s.updatedTo = cur.version;
      save(s);
      this.cleanup(`v${s.active}`);
      return;
    }
    if (s.pending) { delete s.pending; delete s.pendingPath; delete s.prev; save(s); } /* the switch never happened (app closed first) */
    /* a newer APK was installed: Android serves its own copy again, so older downloads are not needed */
    if (s.active && cur.code !== s.active && !s.pending) {
      const apkNewer = cur.code > s.active;
      if (apkNewer) { delete s.active; delete s.activePath; save(s); this.cleanup(null); }
    }
  },
  async cleanup(keep) {
    try {
      const r = await FS('readdir', { path: 'ota', directory: 'DATA' });
      for (const f of r.files || []) {
        const name = typeof f === 'string' ? f : f.name;
        if (name !== keep) { try { await FS('rmdir', { path: `ota/${name}`, directory: 'DATA', recursive: true }); } catch (e) { /* ignore */ } }
      }
    } catch (e) { /* nothing downloaded yet */ }
  },
  state: load,
  /* the version just switched to, once (for a 'updated' note) */
  takeUpdated() { const s = load(); const v = s.updatedTo; if (v) { delete s.updatedTo; save(s); } return v || null; }
};

window.OTA = OTA;
})();
