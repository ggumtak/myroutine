/**
 * 노래일기: receives each new APK from GitHub Actions and keeps it in your Google Drive (same idea as ReaderaPlus).
 * Runs in YOUR Google account (Apps Script), so everything stays in your own Drive. It only touches files in the
 * folder below, and reads 노래일기-1.0.0.apk (the Android part every build starts from) wherever it is in your Drive.
 *
 * Setup from a phone (Chrome, menu → "데스크톱 사이트" on):
 *  1. script.google.com → 새 프로젝트 (a NEW one, not the ReaderaPlus one). Replace everything in Code.gs with this file.
 *  2. Change KEY below to your own long password (letters and numbers). Save (disk icon).
 *  3. 배포 → 새 배포 → 유형 "웹 앱" → 실행: 나 / 액세스 권한: 모든 사용자 → 배포.
 *     Google asks for permission: 액세스 승인 → your account → 고급 → "(안전하지 않음)으로 이동" → 허용.
 *  4. Copy the 웹 앱 URL (ends with /exec).
 *  5. github.com/ggumtak/myroutine → Settings → Secrets and variables → Actions → New repository secret:
 *     SONGDIARY_DRIVE_URL = the URL from step 4, SONGDIARY_DRIVE_KEY = the KEY from step 2.
 *  6. Put 노래일기-1.0.0.apk anywhere in this Google Drive (once).
 * After that every push that changes the app puts 노래일기-<version>.apk into the Drive folder FOLDER and moves older
 * ones to the trash. The signing key is made on the first build and kept in FOLDER as songdiary-signing.json —
 * keep that file: every later APK must be signed with the same key to install over the app.
 */
const KEY = 'CHANGE-ME-to-a-long-password';
const FOLDER = '노래일기';
const BASE = '노래일기-1.0.0.apk';
const SIGN = 'songdiary-signing.json';
const APK = /^노래일기-\d+\.\d+\.\d+\.apk$/;

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (!KEY || KEY.indexOf('CHANGE-ME') === 0 || req.key !== KEY) return text('denied');
    const folder = getFolder();
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
    const blob = Utilities.newBlob(Utilities.base64Decode(req.data), 'application/vnd.android.package-archive', name);
    const file = folder.createFile(blob);
    // Older builds go to the trash (restorable for 30 days); the new one and the base APK stay.
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

function getFolder() {
  return first(DriveApp.getFoldersByName(FOLDER)) || DriveApp.createFolder(FOLDER);
}

function first(it) {
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return f; }
  return null;
}

function text(s) {
  return ContentService.createTextOutput(s);
}
