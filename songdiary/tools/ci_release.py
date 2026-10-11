#!/usr/bin/env python3
"""Make each GitHub build an in-app update, so a new APK is only needed when the Android side changes.

Run by .github/workflows/songdiary-apk.yml before the APK is built:
  1. derives the update-signing key (ECDSA P-256) from the APK signing key kept in Google Drive, so there is
     nothing more to set up or keep safe,
  2. points www/update.js at the channel (the songdiary-ota branch) and that key's public half,
  3. writes www/release.json (this version: name, code, sha256 of every file),
  4. writes the channel: latest.json (signed) and files/<sha256> for this and the previous version.
The APK built afterwards carries the same www, so the installed app and the channel agree.

    python3 ci_release.py --www songdiary/www --p12 release.p12 --storepass-file storepass \\
        --version 1.5.12 --code 112 --min-apk 100 --out ota/ --note "…"
"""
import argparse
import base64
import datetime
import hashlib
import json
import re
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.serialization import pkcs12

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_apk import web_files  # noqa: E402

REPO_RAW = 'https://raw.githubusercontent.com/ggumtak/myroutine/songdiary-ota/'
P256_N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
OK_NAME = re.compile(r'^[A-Za-z0-9_.\-/]+$')  # what the app accepts (update.js okPath)


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def b64url(n: int) -> str:
    return base64.urlsafe_b64encode(n.to_bytes(32, 'big')).rstrip(b'=').decode()


def ota_key(p12: bytes, storepass: str):
    """The same P-256 key every time for the same APK key (a hash of it); a different APK key gives a different one."""
    key, _, _ = pkcs12.load_key_and_certificates(p12, storepass.encode())
    der = key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    d = int.from_bytes(hashlib.sha256(b'songdiary-ota-v1\0' + der).digest(), 'big') % (P256_N - 1) + 1
    return ec.derive_private_key(d, ec.SECP256R1())


def patch_update_js(path: Path, channel: str, pub) -> None:
    s = path.read_text(encoding='utf-8')
    n = pub.public_numbers()
    jwk = "{ kty: 'EC', crv: 'P-256', x: '%s', y: '%s' }" % (b64url(n.x), b64url(n.y))
    s, a = re.subn(r"^const CHANNEL = '[^']*';", f"const CHANNEL = '{channel}';", s, count=1, flags=re.M)
    s, b = re.subn(r"^const PUBKEY = \{[^}]*\};", f"const PUBKEY = {jwk};", s, count=1, flags=re.M)
    if not (a and b):
        sys.exit('update.js: CHANNEL / PUBKEY lines not found')
    path.write_text(s, encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--www', required=True)
    ap.add_argument('--p12', required=True)
    ap.add_argument('--storepass-file', required=True)
    ap.add_argument('--version', required=True)
    ap.add_argument('--code', type=int, required=True)
    ap.add_argument('--min-apk', type=int, required=True)
    ap.add_argument('--out', required=True, help='the channel folder (a checkout of the songdiary-ota branch)')
    ap.add_argument('--note', action='append', default=[])
    a = ap.parse_args()
    www, out = Path(a.www), Path(a.out)
    key = ota_key(Path(a.p12).read_bytes(), Path(a.storepass_file).read_text().strip())
    patch_update_js(www / 'update.js', REPO_RAW + 'latest.json', key.public_key())

    data = {rel: Path(full).read_bytes() for rel, full in web_files(str(www))
            if rel != 'release.json' and not rel.endswith('.part')}
    bad = [rel for rel in data if not (len(rel) < 200 and OK_NAME.match(rel))]
    if bad:
        sys.exit('rename these (the app takes only letters, digits, _ . - /): ' + ', '.join(bad))
    files = {rel: sha(b) for rel, b in data.items()}
    release = {'version': a.version, 'code': a.code, 'files': files}
    rel_bytes = (json.dumps(release, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n').encode()
    (www / 'release.json').write_bytes(rel_bytes)

    fdir = out / 'files'
    fdir.mkdir(parents=True, exist_ok=True)
    keep = set()
    latest = out / 'latest.json'
    if latest.exists():  # phones may still be on their way to the previous version
        try:
            old = json.loads(json.loads(latest.read_text(encoding='utf-8'))['body'])
            if old.get('code', 0) >= a.code:
                sys.exit(f'code {a.code} is not newer than the published {old.get("code")}')
            keep |= set(old.get('files', {}).values()) | {old.get('releaseJson')}
        except (ValueError, KeyError, TypeError):
            pass
    blobs = {h: data[rel] for rel, h in files.items()}
    blobs[sha(rel_bytes)] = rel_bytes
    for h, b in blobs.items():
        p = fdir / h
        if not p.exists():
            p.write_bytes(b)
    keep |= set(blobs)
    removed = 0
    for p in fdir.iterdir():
        if p.is_file() and p.name not in keep:
            p.unlink()
            removed += 1

    body = {
        'app': 'songdiary', 'version': a.version, 'code': a.code, 'minApk': a.min_apk,
        'date': datetime.date.today().isoformat(), 'notes': a.note, 'base': REPO_RAW + 'files/',
        'files': files, 'releaseJson': sha(rel_bytes),
    }
    body_s = json.dumps(body, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    r, s = decode_dss_signature(key.sign(body_s.encode(), ec.ECDSA(hashes.SHA256())))
    sig = base64.b64encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big')).decode()
    latest.write_text(json.dumps({'body': body_s, 'sig': sig}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    (out / 'README.md').write_text('노래일기 앱 안 업데이트 채널 (GitHub Actions가 만들어요. 손으로 고치지 마세요).\n', encoding='utf-8')
    print(f'{a.version} (code {a.code}): {len(files)} files, {len(blobs)} blobs, {removed} old removed')


if __name__ == '__main__':
    main()
