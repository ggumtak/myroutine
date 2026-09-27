#!/usr/bin/env python3
"""Publish a new version of 노래일기's screens for the in-app update.

Writes
  songdiary/www/release.json      – this copy's version and the sha256 of every file (read by the app)
  songdiary/release/latest.json   – the same list, signed (ECDSA P-256, SHA-256); the app checks the signature

The app reads latest.json from the repository's main branch and downloads changed files from
BASE (also main), so a version goes out when these files are merged into main.

  SONGDIARY_OTA_KEY=ota-key.pem python3 songdiary/tools/publish_update.py \
      --version 1.4.1 --code 7 --note "무엇이 바뀌었는지 한 줄" [--note ...] [--min-apk 6]

--code must grow with every release (the APK's versionCode uses the same numbers).
--min-apk: the oldest installed APK (versionCode) this version works with; raise it only when
a release needs something new from the Android side.
Keep the key file out of the repository.
"""
import argparse, base64, datetime, hashlib, json, os, sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / 'www'
OUT = ROOT / 'release' / 'latest.json'
BASE = 'https://raw.githubusercontent.com/ggumtak/myroutine/main/songdiary/www/'
SKIP = {'release.json'}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--version', required=True)
    ap.add_argument('--code', type=int, required=True)
    ap.add_argument('--note', action='append', default=[])
    ap.add_argument('--min-apk', type=int, default=6)
    ap.add_argument('--base', default=BASE)
    ap.add_argument('--www', default=str(WWW))
    ap.add_argument('--out', default=str(OUT))
    ap.add_argument('--key', default=os.environ.get('SONGDIARY_OTA_KEY'))
    a = ap.parse_args()
    if not a.key:
        sys.exit('signing key: set SONGDIARY_OTA_KEY or --key')
    www = Path(a.www)
    files = {}
    for p in sorted(www.rglob('*')):
        if p.is_file():
            rel = p.relative_to(www).as_posix()
            if rel in SKIP or rel.endswith('.part'):
                continue
            files[rel] = sha(p)
    release = {'version': a.version, 'code': a.code, 'files': files}
    rel_bytes = (json.dumps(release, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n').encode()
    (www / 'release.json').write_bytes(rel_bytes)
    body = {
        'app': 'songdiary', 'version': a.version, 'code': a.code, 'minApk': a.min_apk,
        'date': datetime.date.today().isoformat(), 'notes': a.note, 'base': a.base,
        'files': files, 'releaseJson': hashlib.sha256(rel_bytes).hexdigest(),
    }
    body_s = json.dumps(body, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    key = serialization.load_pem_private_key(Path(a.key).read_bytes(), None)
    der = key.sign(body_s.encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    sig = base64.b64encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big')).decode()
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({'body': body_s, 'sig': sig}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{a.version} (code {a.code}): {len(files)} files, signed → {out}')


if __name__ == '__main__':
    main()
