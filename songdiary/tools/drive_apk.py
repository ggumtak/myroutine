#!/usr/bin/env python3
"""Talk to the 노래일기 Google Drive web app (tools/gdrive/upload.gs) — standard library only.

Used by .github/workflows/songdiary-apk.yml. Needs SONGDIARY_DRIVE_URL (the web app's /exec URL) and
SONGDIARY_DRIVE_KEY (the password in the script).

    python3 drive_apk.py base --out base.apk            # 노래일기-1.0.0.apk from your Drive
    python3 drive_apk.py key --out-dir DIR              # the signing key (made on the first build if there is none)
    python3 drive_apk.py upload --file 노래일기-1.5.0.apk
"""
import argparse
import base64
import datetime
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request


def env(name):
    v = os.environ.get(name, '').strip()
    if not v:
        sys.exit(f'{name} is not set')
    return v


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def where(url):
    u = urllib.parse.urlsplit(url)
    return f'{u.netloc}{u.path[:40]}…'


def http(req, what):
    """(status, headers, body) without following redirects; errors explained without printing secrets"""
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=300) as r:
            return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            return e.code, e.headers, b''
        body = e.read().decode('utf-8', 'replace')
        m = re.search(r'<title>(.*?)</title>', body, re.S)
        if e.code >= 500:
            raise Busy(f'{what} failed: HTTP {e.code} at {where(req.full_url)}')
        sys.exit(f'{what} failed: HTTP {e.code} at {where(req.full_url)} {(m.group(1).strip() if m else body[:200])!r}')
    except urllib.error.URLError as e:
        sys.exit(f'{what} failed: {e.reason}')


class Busy(Exception):
    pass


def call(action, what, **fields):
    """Google sometimes answers with a passing 'Error' page or a 5xx: try again up to 3 times"""
    import time
    for attempt in range(3):
        try:
            return call_once(action, what, **fields)
        except Busy as e:
            if attempt == 2:
                sys.exit(str(e))
            print(f'{what}: Google was busy ({e}), trying again in {15 * (attempt + 1)} s')
            time.sleep(15 * (attempt + 1))


def call_once(action, what, **fields):
    url = env('SONGDIARY_DRIVE_URL')
    if not os.environ.get('SONGDIARY_DRIVE_ANYURL') and not re.fullmatch(r'https://script\.google\.com/(a/macros/[^/]+|macros)/s/[A-Za-z0-9_-]+/exec', url):
        sys.exit(f'{what} failed: SONGDIARY_DRIVE_URL should look like https://script.google.com/macros/s/…/exec '
                 f'(it is {where(url)} — copy the 웹 앱 URL from 배포 → 배포 관리)')
    body = json.dumps({'key': env('SONGDIARY_DRIVE_KEY'), 'action': action, **fields}).encode()
    status, headers, data = http(urllib.request.Request(url, data=body, method='POST', headers={'Content-Type': 'application/json'}), what)
    # Apps Script answers a POST with a redirect to the result, fetched with a GET
    for _ in range(5):
        if status not in (301, 302, 303, 307, 308):
            break
        url = urllib.parse.urljoin(url, headers.get('Location', ''))
        status, headers, data = http(urllib.request.Request(url, method='GET'), what)
    answer = data.decode('utf-8', 'replace')
    if answer.startswith('ok'):
        return answer[3:]
    if action == 'getkey' and answer == 'none':
        return None
    if answer.lstrip().startswith('<'):
        m = re.search(r'<title>(.*?)</title>', answer, re.S)
        raise Busy(f'{what} failed: the web app sent a web page ({m.group(1).strip() if m else "no title"!r}) from {where(url)} — '
                   'if it keeps happening, check 배포: 실행 = 나, 액세스 = 모든 사용자, and that the code was saved before 배포')
    sys.exit(f'{what} failed: {answer[:300]}')


def new_key(storepass):
    """A signing key like `keytool -genkeypair -keyalg RSA -keysize 2048 -storetype PKCS12` makes."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.x509.oid import NameOID
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'SongDiary'), x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'Personal'), x509.NameAttribute(NameOID.COUNTRY_NAME, 'KR')])
    now = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now).not_valid_after(now + datetime.timedelta(days=36500))
            .sign(key, hashes.SHA256()))
    return pkcs12.serialize_key_and_certificates(b'songdiary', key, cert, None, serialization.BestAvailableEncryption(storepass.encode()))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('base').add_argument('--out', required=True)
    sub.add_parser('key').add_argument('--out-dir', required=True)
    sub.add_parser('upload').add_argument('--file', required=True)
    a = ap.parse_args()
    if a.cmd == 'base':
        data = base64.b64decode(call('base', 'base APK'))
        with open(a.out, 'wb') as f:
            f.write(data)
        print(f'{a.out}: {len(data) / 1048576:.1f} MB from Drive')
    elif a.cmd == 'key':
        got = call('getkey', 'signing key')
        if got:
            k = json.loads(got)
            p12, storepass = base64.b64decode(k['p12']), k['pass']
            print('signing key from Drive')
        else:
            storepass = secrets.token_hex(24)
            p12 = new_key(storepass)
            call('putkey', 'saving the new signing key', p12=base64.b64encode(p12).decode(), **{'pass': storepass})
            print('::warning::made a NEW signing key and saved it in Drive (songdiary-signing.json). An app signed with another key must be reinstalled once.')
        print(f'::add-mask::{storepass}')
        os.makedirs(a.out_dir, exist_ok=True)
        with open(os.path.join(a.out_dir, 'release.p12'), 'wb') as f:
            f.write(p12)
        with open(os.path.join(a.out_dir, 'storepass'), 'w') as f:
            f.write(storepass)
    else:
        name = os.path.basename(a.file)
        with open(a.file, 'rb') as f:
            data = base64.b64encode(f.read()).decode()
        print('Google Drive: ok', call('upload', 'upload', name=name, data=data))


if __name__ == '__main__':
    main()
