#!/usr/bin/env python3
"""Publish a new version of 노래일기's screens for the in-app update.

Writes
  songdiary/www/release.json        – this copy's version and the sha256 of every file (read by the app)
  songdiary/release/latest.json     – the same list, signed (ECDSA P-256, SHA-256); the app checks the signature
  songdiary/release/files/<sha256>  – every file of the version, named by its sha256

The app reads latest.json from the repository's main branch and downloads the files it doesn't have from
release/files/ by their sha256. A file there never changes, so later changes to songdiary/www on main (or a
stale CDN copy) can't break a published version. Files that neither this nor the previous version use are
removed. A version goes out when these files are merged into main.

  SONGDIARY_OTA_KEY=ota-key.pem python3 songdiary/tools/publish_update.py \
      --version 1.4.1 --code 7 --note "무엇이 바뀌었는지 한 줄" [--note ...] [--min-apk 6]

--code must grow with every release (the APK's versionCode uses the same numbers).
--min-apk: the oldest installed APK (versionCode) this version works with; raise it only when
a release needs something new from the Android side.
The version holds the same files build_apk.py puts in the APK (no dot-names), minus files git ignores.
Keep the key file out of the repository.
"""
import argparse, base64, datetime, hashlib, json, os, re, shutil, subprocess, sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_apk import web_files  # noqa: E402  (the APK's file list; the release must match it)

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / 'www'
OUT = ROOT / 'release' / 'latest.json'
FILES = ROOT / 'release' / 'files'
BASE = 'https://raw.githubusercontent.com/ggumtak/myroutine/main/songdiary/release/files/'
OK_NAME = re.compile(r'^[A-Za-z0-9_.\-/]+$')  # what the app accepts (update.js okPath)


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def ok_path(p: str) -> bool:
    return len(p) < 200 and bool(OK_NAME.match(p)) and all(s not in ('', '.', '..') for s in p.split('/'))


def git_ignored(www: Path, rels):
    """Files git ignores never reach main, so they can't be part of a version."""
    if not rels:
        return set()
    try:  # NUL-separated: names with Korean letters come back as they are, not quoted
        r = subprocess.run(['git', '-C', str(www), 'check-ignore', '-z', '--stdin'], input='\0'.join(rels).encode(),
                           capture_output=True)
    except FileNotFoundError:
        return set()
    if r.returncode not in (0, 1):  # not inside a git repository
        return set()
    return {p for p in r.stdout.decode('utf-8', 'surrogateescape').split('\0') if p}


def main_needs(out: Path):
    """The files the version on main (what phones see now) needs, read from git: kept even when this code is
    published again before merging."""
    for ref in ('origin/main', 'main'):
        try:
            r = subprocess.run(['git', '-C', str(out.parent), 'show', f'{ref}:./{out.name}'], capture_output=True)
        except FileNotFoundError:
            return set()
        if r.returncode == 0:
            try:
                body = json.loads(json.loads(r.stdout.decode())['body'])
                return set(body.get('files', {}).values()) | {body.get('releaseJson')}
            except (ValueError, KeyError, TypeError):
                return set()
    return set()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--version', required=True)
    ap.add_argument('--code', type=int, required=True)
    ap.add_argument('--note', action='append', default=[])
    ap.add_argument('--min-apk', type=int, default=6)
    ap.add_argument('--base', default=BASE, help='URL of the files folder as the app will fetch it')
    ap.add_argument('--www', default=str(WWW))
    ap.add_argument('--out', default=str(OUT))
    ap.add_argument('--files', default=str(FILES))
    ap.add_argument('--key', default=os.environ.get('SONGDIARY_OTA_KEY'))
    a = ap.parse_args()
    if not a.key:
        sys.exit('signing key: set SONGDIARY_OTA_KEY or --key')
    if not a.base.endswith('/'):
        sys.exit('--base must end with /')
    www, out, fdir = Path(a.www), Path(a.out), Path(a.files)

    items = [(rel, Path(full)) for rel, full in web_files(str(www)) if rel != 'release.json' and not rel.endswith('.part')]
    skip = git_ignored(www, [rel for rel, _ in items])
    if skip:
        print('left out (ignored by git):', ', '.join(sorted(skip)))
    items = [(rel, full) for rel, full in items if rel not in skip]
    bad = [rel for rel, _ in items if not ok_path(rel)]
    if bad:
        sys.exit('rename these (the app takes only letters, digits, _ . - /): ' + ', '.join(bad))
    data = {rel: full.read_bytes() for rel, full in items}
    files = {rel: sha(b) for rel, b in data.items()}
    if 'index.html' not in files or 'app.js' not in files:
        sys.exit(f'{www} does not look like the app (index.html and app.js are needed)')

    release = {'version': a.version, 'code': a.code, 'files': files}
    rel_bytes = (json.dumps(release, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n').encode()
    rel_hash = sha(rel_bytes)

    prev_need = set()
    if out.exists():
        try:
            old = json.loads(json.loads(out.read_text(encoding='utf-8'))['body'])
            if old.get('code', 0) > a.code:
                sys.exit(f'--code {a.code} is lower than the published {old.get("code")}')
            if old.get('code') == a.code:
                print(f'replacing the list of code {a.code} (fine only while it is not merged into main yet)')
            else:  # phones may still be on their way to the previous version for a few minutes
                prev_need = set(old.get('files', {}).values()) | {old.get('releaseJson')}
        except (ValueError, KeyError, TypeError):
            pass

    (www / 'release.json').write_bytes(rel_bytes)
    fdir.mkdir(parents=True, exist_ok=True)
    blobs = dict((h, data[rel]) for rel, h in files.items())
    blobs[rel_hash] = rel_bytes
    for h, b in blobs.items():
        p = fdir / h
        if not p.exists() or sha(p.read_bytes()) != h:
            tmp = p.with_suffix('.part')
            tmp.write_bytes(b)
            tmp.replace(p)
    keep = set(blobs) | prev_need | main_needs(out)
    removed = 0
    for p in fdir.iterdir():
        if p.is_file() and p.name not in keep:
            p.unlink()
            removed += 1

    body = {
        'app': 'songdiary', 'version': a.version, 'code': a.code, 'minApk': a.min_apk,
        'date': datetime.date.today().isoformat(), 'notes': a.note, 'base': a.base,
        'files': files, 'releaseJson': rel_hash,
    }
    body_s = json.dumps(body, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    key = serialization.load_pem_private_key(Path(a.key).read_bytes(), None)
    der = key.sign(body_s.encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    sig = base64.b64encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big')).decode()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({'body': body_s, 'sig': sig}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{a.version} (code {a.code}): {len(files)} files, {len(blobs)} in {fdir} ({removed} old removed), signed → {out}')


if __name__ == '__main__':
    main()
