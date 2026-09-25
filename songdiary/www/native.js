/* 노래일기 — platform layer: on-device storage (IndexedDB), zip backups, Android bridges */
(function () {
'use strict';

const Cap = window.Capacitor;
const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
const plug = name => (isNative && Cap.Plugins && Cap.Plugins[name]) || null;

/* ================= IndexedDB ================= */
const DB_NAME = 'songdiary', DB_VER = 1;
let dbp = null;
function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    let rq;
    try { rq = indexedDB.open(DB_NAME, DB_VER); } catch (e) { rej(e); return; }
    rq.onupgradeneeded = () => {
      const db = rq.result;
      for (const s of ['meta', 'days', 'audio']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    rq.onsuccess = () => {
      const db = rq.result;
      db.onversionchange = () => { db.close(); dbp = null; };
      db.onclose = () => { dbp = null; };
      res(db);
    };
    rq.onerror = () => rej(rq.error);
    rq.onblocked = () => rej(new Error('blocked'));
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}
const reqP = rq => new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
function done(t) { return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('abort')); }); }
/* a connection the system closed under us is reopened once */
async function withDB(fn) {
  try { return await fn(await openDB()); }
  catch (e) { if (e && e.name === 'InvalidStateError') { dbp = null; return fn(await openDB()); } throw e; }
}
const Store = {
  get(store, key) { return withDB(db => reqP(db.transaction(store).objectStore(store).get(key))); },
  all(store) {
    return withDB(async db => {
      const st = db.transaction(store).objectStore(store);
      const [keys, values] = await Promise.all([reqP(st.getAllKeys()), reqP(st.getAll())]);
      return keys.map((k, i) => [k, values[i]]);
    });
  },
  keys(store) { return withDB(db => reqP(db.transaction(store).objectStore(store).getAllKeys())); },
  /* entries: [[key, value|undefined]] — undefined deletes */
  write(store, entries) {
    if (!entries.length) return Promise.resolve();
    return withDB(db => {
      const t = db.transaction(store, 'readwrite');
      const st = t.objectStore(store);
      for (const [k, v] of entries) { if (v === undefined) st.delete(k); else st.put(v, k); }
      return done(t);
    });
  },
  put(store, key, val) { return this.write(store, [[key, val]]); },
  del(store, key) { return this.write(store, [[key, undefined]]); },
  clear(store) { return withDB(db => { const t = db.transaction(store, 'readwrite'); t.objectStore(store).clear(); return done(t); }); }
};

/* ================= zip (store; reads deflate too) ================= */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes, crc = 0) { crc = ~crc >>> 0; for (let i = 0; i < bytes.length; i++) crc = CRC_T[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8); return ~crc >>> 0; }
const te = new TextEncoder(), td = new TextDecoder();
function dosTime(d) { return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }
/* files: [{ name, data: Blob|Uint8Array|string }], onProgress(i, n) */
async function makeZip(files, onProgress) {
  const parts = [], central = [];
  let offset = 0;
  const { time, date } = dosTime(new Date());
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    let blob = f.data;
    if (typeof blob === 'string') blob = new Blob([te.encode(blob)]);
    else if (blob instanceof Uint8Array) blob = new Blob([blob]);
    let crc = 0;
    const CH = 4 * 1024 * 1024;
    for (let p = 0; p < blob.size; p += CH) crc = crc32(new Uint8Array(await blob.slice(p, p + CH).arrayBuffer()), crc);
    const name = te.encode(f.name);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, blob.size, true); lh.setUint32(22, blob.size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name, blob);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, blob.size, true); ch.setUint32(24, blob.size, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + blob.size;
    if (onProgress) onProgress(i + 1, files.length);
  }
  const cdSize = central.reduce((a, p) => a + (p.byteLength || p.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
/* returns Map name -> { size, read(): Promise<Blob> } */
async function readZip(file) {
  const tailLen = Math.min(file.size, 65557);
  const tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer());
  let e = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { e = i; break; }
  if (e < 0) throw new Error('notzip');
  const ev = new DataView(tail.buffer, e);
  const count = ev.getUint16(10, true), cdSize = ev.getUint32(12, true), cdOff = ev.getUint32(16, true);
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const out = new Map();
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break;
    const method = cd.getUint16(p + 10, true), csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true);
    const nlen = cd.getUint16(p + 28, true), xlen = cd.getUint16(p + 30, true), clen = cd.getUint16(p + 32, true), loff = cd.getUint32(p + 42, true);
    const name = td.decode(new Uint8Array(cd.buffer, p + 46, nlen));
    p += 46 + nlen + xlen + clen;
    out.set(name, {
      size: usize,
      async read() {
        const lh = new DataView(await file.slice(loff, loff + 30).arrayBuffer());
        const start = loff + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        const raw = file.slice(start, start + csize);
        if (method === 0) return raw;
        if (method === 8 && typeof DecompressionStream === 'function') return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
        throw new Error('method');
      }
    });
  }
  return out;
}

/* ================= files on the phone ================= */
function blobToB64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
const safeName = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || '파일';
/* Writes a blob in chunks (the bridge only carries text). Returns the file uri. */
async function writeBlob(path, directory, blob, onProgress) {
  const FS = plug('Filesystem');
  const CH = 3 * 1024 * 1024; /* multiple of 3 so base64 chunks join cleanly */
  /* written under a temporary name first, so a failed or interrupted write never leaves a broken file behind */
  const part = path + '.part';
  try {
    if (!blob.size) await FS.writeFile({ path: part, directory, data: '', recursive: true });
    for (let p = 0; p < blob.size; p += CH) {
      const data = await blobToB64(blob.slice(p, p + CH));
      if (p === 0) await FS.writeFile({ path: part, directory, data, recursive: true });
      else await FS.appendFile({ path: part, directory, data });
      if (onProgress) onProgress(Math.min(1, (p + CH) / blob.size));
    }
    try { await FS.deleteFile({ path, directory }); } catch (e) { /* nothing to replace */ }
    await FS.rename({ from: part, to: path, directory, toDirectory: directory });
  } catch (e) {
    try { await FS.deleteFile({ path: part, directory }); } catch (e2) { /* ignore */ }
    throw e;
  }
  const r = await FS.getUri({ path, directory });
  return r.uri;
}
const Files = {
  /* Share sheet (카카오톡, 드라이브, 메일 …) */
  async share({ title, text, files }) {
    const SH = plug('Share');
    if (SH) {
      const FS = plug('Filesystem');
      if (FS && files && files.length) { try { await FS.rmdir({ path: 'share', directory: 'CACHE', recursive: true }); } catch (e) { /* not there yet */ } }
      const uris = [];
      for (const f of files || []) uris.push(await writeBlob(`share/${safeName(f.name)}`, 'CACHE', f.blob));
      try { await SH.share({ title, text, files: uris.length ? uris : undefined, dialogTitle: title || '보내기' }); }
      catch (e) { if (/cancel/i.test(String(e && (e.message || e)))) return 'cancelled'; throw e; }
      return true;
    }
    if (navigator.share) {
      const fl = (files || []).map(f => new File([f.blob], safeName(f.name), { type: f.blob.type || 'application/octet-stream' }));
      const data = { title, text };
      if (fl.length && navigator.canShare && navigator.canShare({ files: fl })) data.files = fl;
      try { await navigator.share(data); return true; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    for (const f of files || []) this.download(f.name, f.blob);
    return false;
  },
  /* Saves into the phone's 문서(Documents)/노래일기 folder — kept even if the app is removed */
  async saveToDocuments(sub, name, blob, onProgress) {
    if (!plug('Filesystem')) { this.download(name, blob); return null; }
    const path = `노래일기/${sub ? sub + '/' : ''}${safeName(name)}`;
    await writeBlob(path, 'DOCUMENTS', blob, onProgress);
    return `내 파일 > 내장 저장공간 > Documents > ${path.split('/').join(' > ')}`;
  },
  /* the copy handed to the share sheet can be gigabytes; once the app starts again it is surely not needed */
  async clearShareCache() {
    const FS = plug('Filesystem');
    if (FS) { try { await FS.rmdir({ path: 'share', directory: 'CACHE', recursive: true }); } catch (e) { /* not there */ } }
  },
  /* a file name in 문서/노래일기/<sub> that doesn't replace an earlier export */
  async freeName(sub, name) {
    const have = new Set((await this.listDocuments(sub)).map(f => f.name));
    const safe = safeName(name);
    if (!have.has(safe)) return safe;
    const dot = safe.lastIndexOf('.'), base = dot > 0 ? safe.slice(0, dot) : safe, ext = dot > 0 ? safe.slice(dot) : '';
    for (let i = 2; i < 1000; i++) if (!have.has(`${base} (${i})${ext}`)) return `${base} (${i})${ext}`;
    return safe;
  },
  async listDocuments(sub) {
    const FS = plug('Filesystem');
    if (!FS) return [];
    try { const r = await FS.readdir({ path: `노래일기/${sub}`, directory: 'DOCUMENTS' }); return (r.files || []).map(f => (typeof f === 'string' ? { name: f } : f)); }
    catch (e) { return []; }
  },
  async deleteDocument(sub, name) {
    const FS = plug('Filesystem');
    if (FS) { try { await FS.deleteFile({ path: `노래일기/${sub}/${name}`, directory: 'DOCUMENTS' }); } catch (e) { /* ignore */ } }
  },
  download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = safeName(name);
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },
  /* A file another app shared to us (path in the app cache) */
  async readShared(f) {
    const res = await fetch(Cap.convertFileSrc(f.path));
    if (!res.ok) throw new Error('read');
    const blob = await res.blob();
    /* the copy in the app cache isn't needed once it has been read */
    const FS = plug('Filesystem');
    if (FS) FS.deleteFile({ path: f.path }).catch(() => {});
    return new File([blob], f.name || '녹음', { type: f.mime || blob.type || '' });
  }
};

/* ================= network (song search only — diary data never leaves the phone) ================= */
/* The page is served from https://localhost, so other sites are reached through Capacitor's native HTTP (no CORS). */
function httpErr(status) { const e = new Error('http ' + status); e.status = status; return e; }
const Net = {
  async getJson(url, timeoutMs = 8000) {
    if (navigator.onLine === false) { const e = new Error('offline'); e.offline = true; throw e; }
    if (isNative && typeof Cap.nativePromise === 'function' && !Net.noNative) {
      let timer = 0;
      try {
        const r = await Promise.race([
          Cap.nativePromise('CapacitorHttp', 'request', { url, method: 'GET', headers: { Accept: 'application/json' }, connectTimeout: timeoutMs, readTimeout: timeoutMs }),
          new Promise((res, rej) => { timer = setTimeout(() => rej(new Error('timeout')), timeoutMs + 1500); })
        ]);
        if (!r || r.status < 200 || r.status >= 300) throw httpErr(r ? r.status : 0);
        return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      } catch (e) {
        /* only if the native HTTP plugin itself is missing, fall back to the WebView's fetch */
        if (!(e && /UNIMPLEMENTED|UNAVAILABLE/.test(String(e.code || '')))) throw e;
        Net.noNative = true;
      } finally { clearTimeout(timer); }
    }
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, timeoutMs);
    try {
      const res = await fetch(url, { signal: ctl ? ctl.signal : undefined, credentials: 'omit' });
      if (!res.ok) throw httpErr(res.status);
      return JSON.parse(await res.text());
    } finally { clearTimeout(timer); }
  }
};

/* ================= Android pieces ================= */
const App = {
  isNative,
  plug,
  keepAwake(on) {
    const P = plug('SongDiary');
    if (P) { P.keepAwake({ on: !!on }).catch(() => {}); return; }
    try {
      if (on && navigator.wakeLock && !App._wl) navigator.wakeLock.request('screen').then(w => { App._wl = w; }).catch(() => {});
      if (!on && App._wl) { App._wl.release().catch(() => {}); App._wl = null; }
    } catch (e) { /* ignore */ }
  },
  openAppSettings() { const P = plug('SongDiary'); if (P) P.openAppSettings().catch(() => {}); },
  onShared(fn) {
    const P = plug('SongDiary');
    if (!P) return;
    const pull = () => P.takeSharedFiles().then(r => { if (r && r.files && r.files.length) fn(r.files); }).catch(() => {});
    P.addListener('sharedFiles', pull);
    pull();
  },
  onBack(fn) { const A = plug('App'); if (A) A.addListener('backButton', fn); },
  onPause(fn) { const A = plug('App'); if (A) A.addListener('pause', fn); },
  onResume(fn) { const A = plug('App'); if (A) A.addListener('resume', fn); },
  exit() { const A = plug('App'); if (A) A.exitApp(); },
  minimize() { const A = plug('App'); if (A && A.minimizeApp) A.minimizeApp().catch(() => A.exitApp()); },
  async version() { const A = plug('App'); if (!A) return null; try { return await A.getInfo(); } catch (e) { return null; } },
  setBars(dark) { const B = plug('SystemBars'); if (B) B.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {}); },
  /* YouTube, lyrics … open in their own app / the browser. Capacitor hands any navigation away from
     the app's own origin to Android as a VIEW intent, so a plain link click leaves this page untouched. */
  openUrl(url) {
    if (!/^https:\/\//.test(url)) return;
    if (!isNative) { window.open(url, '_blank', 'noopener'); return; }
    const a = document.createElement('a');
    a.href = url; a.rel = 'noopener';
    document.body.append(a); a.click(); a.remove();
  },
  /* at app start: keep an existing reminder scheduled without asking for anything */
  async ensureReminder(hour, minute, body) {
    const LN = plug('LocalNotifications');
    if (!LN) return 'unsupported';
    const p = await LN.checkPermissions();
    if (p.display !== 'granted') return 'denied';
    try { const pend = await LN.getPending(); if ((pend.notifications || []).some(n => +n.id === 1001)) return 'ok'; } catch (e) { /* schedule again below */ }
    return this.setReminder(true, hour, minute, body);
  },
  /* daily practice reminder */
  async setReminder(on, hour, minute, body) {
    const LN = plug('LocalNotifications');
    if (!LN) return on ? 'unsupported' : 'ok';
    if (!on) { try { await LN.cancel({ notifications: [{ id: 1001 }] }); } catch (e) { /* ignore */ } return 'ok'; }
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') return 'denied';
    try { await LN.cancel({ notifications: [{ id: 1001 }] }); } catch (e) { /* ignore */ }
    try { await LN.createChannel({ id: 'practice', name: '연습 알림', description: '매일 노래 연습할 시간을 알려줘요', importance: 4, vibration: true }); } catch (e) { /* ignore */ }
    await LN.schedule({ notifications: [{ id: 1001, title: '노래일기', body, channelId: 'practice', smallIcon: 'ic_stat_note', schedule: { on: { hour, minute }, allowWhileIdle: true } }] });
    return 'ok';
  }
};

window.SD = { Store, makeZip, readZip, Files, App, Net, safeName };
})();
