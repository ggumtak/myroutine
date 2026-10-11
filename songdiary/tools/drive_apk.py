#!/usr/bin/env python3
"""Fetch the base APK from Google Drive and put a built APK into a Drive folder — standard library only.

Used by .github/workflows/songdiary-apk.yml; also works by hand:

    GDRIVE_CLIENT_ID=... GDRIVE_CLIENT_SECRET=... GDRIVE_REFRESH_TOKEN=... \\
        python3 drive_apk.py download --id <file id of 노래일기-1.0.0.apk> --out base.apk
    python3 drive_apk.py upload --file 노래일기-1.5.0.apk --folder <folder id>

Signs in as you with an OAuth refresh token (scope https://www.googleapis.com/auth/drive), because a service
account can't own files in a personal My Drive. Uploading a name that is already in the folder replaces that
file's content (a re-run doesn't make copies; Drive keeps the old one in the file's version history).
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

TOKEN_URL = os.environ.get('GDRIVE_TOKEN_URL', 'https://oauth2.googleapis.com/token')
API = os.environ.get('GDRIVE_API', 'https://www.googleapis.com')
APK_TYPE = 'application/vnd.android.package-archive'


def env(name):
    v = os.environ.get(name, '').strip()
    if not v:
        sys.exit(f'{name} is not set')
    return v


def call(req, what):
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.read(), r.headers
    except urllib.error.HTTPError as e:
        sys.exit(f'{what} failed: HTTP {e.code} {e.read().decode("utf-8", "replace")[:500]}')
    except urllib.error.URLError as e:
        sys.exit(f'{what} failed: {e.reason}')


def token():
    body = urllib.parse.urlencode({
        'client_id': env('GDRIVE_CLIENT_ID'), 'client_secret': env('GDRIVE_CLIENT_SECRET'),
        'refresh_token': env('GDRIVE_REFRESH_TOKEN'), 'grant_type': 'refresh_token'}).encode()
    data, _ = call(urllib.request.Request(TOKEN_URL, data=body, method='POST'), 'sign-in')
    return json.loads(data)['access_token']


def download(tok, file_id, out):
    url = f'{API}/drive/v3/files/{urllib.parse.quote(file_id)}?alt=media&supportsAllDrives=true'
    data, _ = call(urllib.request.Request(url, headers={'Authorization': f'Bearer {tok}'}), 'download')
    with open(out, 'wb') as f:
        f.write(data)
    print(f'{out}: {len(data) / 1048576:.1f} MB from Drive')


def find(tok, folder, name):
    q = "name = '%s' and '%s' in parents and trashed = false" % (name.replace("\\", "\\\\").replace("'", "\\'"), folder)
    url = f'{API}/drive/v3/files?' + urllib.parse.urlencode({'q': q, 'fields': 'files(id)', 'supportsAllDrives': 'true', 'includeItemsFromAllDrives': 'true'})
    data, _ = call(urllib.request.Request(url, headers={'Authorization': f'Bearer {tok}'}), 'search')
    files = json.loads(data).get('files', [])
    return files[0]['id'] if files else None


def upload(tok, path, folder, name):
    with open(path, 'rb') as f:
        blob = f.read()
    old = find(tok, folder, name)
    auth = {'Authorization': f'Bearer {tok}'}
    # resumable upload: works for any size (simple multipart is limited to 5 MB)
    if old:
        start = f'{API}/upload/drive/v3/files/{old}?uploadType=resumable&supportsAllDrives=true'
        meta, method = {}, 'PATCH'
    else:
        start = f'{API}/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true'
        meta, method = {'name': name, 'parents': [folder], 'mimeType': APK_TYPE}, 'POST'
    _, headers = call(urllib.request.Request(start, data=json.dumps(meta).encode(), method=method, headers={
        **auth, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': APK_TYPE,
        'X-Upload-Content-Length': str(len(blob))}), 'upload start')
    session = headers.get('Location')
    if not session:
        sys.exit('upload start failed: no upload URL')
    data, _ = call(urllib.request.Request(session, data=blob, method='PUT', headers={'Content-Type': APK_TYPE}), 'upload')
    fid = json.loads(data)['id']
    print(f'{"replaced" if old else "uploaded"} {name} ({len(blob) / 1048576:.1f} MB): https://drive.google.com/file/d/{fid}/view')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('download')
    d.add_argument('--id', required=True)
    d.add_argument('--out', required=True)
    u = sub.add_parser('upload')
    u.add_argument('--file', required=True)
    u.add_argument('--folder', required=True)
    u.add_argument('--name', help='name in Drive (default: the file name)')
    a = ap.parse_args()
    tok = token()
    if a.cmd == 'download':
        download(tok, a.id, a.out)
    else:
        upload(tok, a.file, a.folder, a.name or os.path.basename(a.file))


if __name__ == '__main__':
    main()
