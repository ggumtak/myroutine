const KEY = 'CHANGE-ME-to-a-long-password';
const FOLDER = '노래일기';
const BASE = '노래일기-1.0.0.apk';
const SIGN = 'songdiary-signing.json';
const APK = /^노래일기-\d+\.\d+\.\d+\.apk$/;

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (!KEY || KEY.indexOf('CHANGE-ME') === 0 || req.key !== KEY) return text('denied');
    const folder = first(DriveApp.getFoldersByName(FOLDER)) || DriveApp.createFolder(FOLDER);
    if (req.action === 'base') {
      const f = first(folder.getFilesByName(BASE)) || first(DriveApp.getFilesByName(BASE));
      return text(f ? 'ok ' + Utilities.base64Encode(f.getBlob().getBytes()) : 'missing ' + BASE);
    }
    if (req.action === 'getkey') {
      const f = first(folder.getFilesByName(SIGN));
      return text(f ? 'ok ' + f.getBlob().getDataAsString() : 'none');
    }
    if (req.action === 'putkey') {
      if (first(folder.getFilesByName(SIGN))) return text('exists');
      folder.createFile(SIGN, JSON.stringify({ p12: String(req.p12 || ''), pass: String(req.pass || '') }), 'application/json');
      return text('ok');
    }
    const name = String(req.name || '');
    if (!APK.test(name) || name === BASE) return text('bad name');
    const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(req.data), 'application/vnd.android.package-archive', name));
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (f.getId() !== file.getId() && APK.test(f.getName()) && f.getName() !== BASE) f.setTrashed(true);
    }
    return text('ok ' + name);
  } catch (err) {
    return text('error ' + err);
  }
}

function first(it) {
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}

function text(s) {
  return ContentService.createTextOutput(s);
}
