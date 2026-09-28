#!/usr/bin/env python3
"""Rebuild the 노래일기 APK with a new web bundle — no Android SDK needed.

Takes an already-built APK (the Capacitor shell: classes.dex, resources, the
native plugins), swaps its assets/public/ for songdiary/www, optionally bumps
the version, lays the zip out the way zipalign does (stored entries 4-byte
aligned, which Android 11+ requires for resources.arsc) and signs it with APK
Signature Scheme v2 (enough for minSdk 30).

    python3 build_apk.py --base 노래일기-1.0.0.apk --www ../www \
        --keystore songdiary-release.p12 --storepass ... \
        --version-name 1.1.0 --version-code 2 --out 노래일기-1.1.0.apk

A new keystore can be made with:
    keytool -genkeypair -alias songdiary -keyalg RSA -keysize 2048 -validity 36500 \
        -dname "CN=SongDiary, O=Personal, C=KR" -storetype PKCS12 \
        -keystore songdiary-release.p12

Android only installs an update over an existing app when both are signed with
the same key, so keep the keystore: losing it means uninstalling (and restoring
from a backup) before the next update.

Needs: Python 3.8+ and the `cryptography` package.
"""
import argparse
import hashlib
import os
import struct
import sys
import zlib
import zipfile

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import pkcs12

WEB_PREFIX = 'assets/public/'
# already-compressed formats are stored as-is, like aapt does
STORE_EXT = ('.png', '.jpg', '.jpeg', '.webp', '.woff2', '.woff', '.mp3', '.m4a', '.ogg', '.zip')
FIXED_TIME = (2026, 1, 1, 0, 0, 0)


# ---------------------------------------------------------------- manifest
def patch_manifest(data, version_name=None, version_code=None):
    """Edit versionName / versionCode in the binary AndroidManifest.xml in place."""
    buf = bytearray(data)
    # string pool: chunk right after the 8-byte file header
    sp = 8
    sp_type, sp_hsize, sp_size = struct.unpack_from('<HHI', buf, sp)
    assert sp_type == 0x0001, 'no string pool'
    count, _styles, flags, str_start, _style_start = struct.unpack_from('<IIIII', buf, sp + 8)
    utf8 = bool(flags & (1 << 8))
    offs = struct.unpack_from('<%dI' % count, buf, sp + sp_hsize)

    def read_str(i):
        p = sp + str_start + offs[i]
        if utf8:
            n = buf[p]; p += 1
            if n & 0x80: p += 1
            blen = buf[p]; p += 1
            if blen & 0x80:
                blen = ((blen & 0x7F) << 8) | buf[p]; p += 1
            return p, bytes(buf[p:p + blen]).decode('utf-8'), blen
        n = struct.unpack_from('<H', buf, p)[0]; p += 2
        if n & 0x8000:
            n = ((n & 0x7FFF) << 16) | struct.unpack_from('<H', buf, p)[0]; p += 2
        return p, bytes(buf[p:p + n * 2]).decode('utf-16-le'), n * 2

    # resource map: attribute resource ids by string index
    rm = sp + sp_size
    rm_type, rm_hsize, rm_size = struct.unpack_from('<HHI', buf, rm)
    assert rm_type == 0x0180, 'no resource map'
    res_ids = struct.unpack_from('<%dI' % ((rm_size - rm_hsize) // 4), buf, rm + rm_hsize)
    ATTR_VCODE, ATTR_VNAME = 0x0101021b, 0x0101021c

    # first START_TAG is <manifest>
    p = rm + rm_size
    while p < len(buf):
        ctype, chsize, csize = struct.unpack_from('<HHI', buf, p)
        if ctype == 0x0102:
            break
        p += csize
    else:
        raise ValueError('no start tag')
    attr_start, attr_size, attr_count = struct.unpack_from('<HHH', buf, p + 16 + 8)
    a0 = p + 16 + attr_start
    done = set()
    for k in range(attr_count):
        a = a0 + k * attr_size
        name_idx, raw_idx = struct.unpack_from('<Ii', buf, a + 4)
        dtype = buf[a + 15]
        rid = res_ids[name_idx] if name_idx < len(res_ids) else None
        if rid == ATTR_VCODE and version_code is not None:
            assert dtype == 0x10, 'versionCode is not an int'
            struct.pack_into('<I', buf, a + 16, int(version_code))
            done.add('code')
        elif rid == ATTR_VNAME and version_name is not None:
            assert raw_idx >= 0
            sp_pos, old, blen = read_str(raw_idx)
            new = version_name.encode('utf-8' if utf8 else 'utf-16-le')
            if len(new) != blen:
                raise ValueError('versionName must keep its length (%r -> %r)' % (old, version_name))
            buf[sp_pos:sp_pos + blen] = new
            done.add('name')
    want = {'code'} if version_code is not None else set()
    if version_name is not None:
        want.add('name')
    if want - done:
        raise ValueError('could not patch %s' % sorted(want - done))
    return bytes(buf)


# ---------------------------------------------------------------- zip writer
class AlignedZip:
    """Minimal zip writer that aligns STORED entry data like zipalign -p 4."""

    def __init__(self):
        self.out = bytearray()
        self.central = []

    def add(self, name, data, stored):
        name_b = name.encode('utf-8')
        crc = zlib.crc32(data) & 0xFFFFFFFF
        if stored:
            method, comp = 0, data
        else:
            co = zlib.compressobj(9, zlib.DEFLATED, -15)
            comp = co.compress(data) + co.flush()
            method = 8
        y, mo, d, h, mi, s = FIXED_TIME
        dtime = (h << 11) | (mi << 5) | (s // 2)
        ddate = ((y - 1980) << 9) | (mo << 5) | d
        flags = 0x0800  # names are UTF-8
        offset = len(self.out)
        extra = b''
        if stored:
            align = 4096 if name.endswith('.so') else 4
            data_at = offset + 30 + len(name_b)
            pad = (-data_at) % align
            extra = b'\x00' * pad
        self.out += struct.pack('<IHHHHHIIIHH', 0x04034b50, 20, flags, method, dtime, ddate,
                                crc, len(comp), len(data), len(name_b), len(extra))
        self.out += name_b + extra + comp
        self.central.append(struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20, flags, method, dtime, ddate,
                                        crc, len(comp), len(data), len(name_b), 0, 0, 0, 0, 0, offset) + name_b)

    def finish(self):
        cd_off = len(self.out)
        cd = b''.join(self.central)
        eocd = struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, len(self.central), len(self.central), len(cd), cd_off, 0)
        return bytes(self.out), cd, eocd


# ---------------------------------------------------------------- v2 signing
def lp(b):
    return struct.pack('<I', len(b)) + b


def chunked_digest(sections):
    chunk_digests = []
    for sec in sections:
        for i in range(0, len(sec), 1 << 20):
            chunk = sec[i:i + (1 << 20)]
            chunk_digests.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(chunk)) + chunk).digest())
    return hashlib.sha256(b'\x5a' + struct.pack('<I', len(chunk_digests)) + b''.join(chunk_digests)).digest()


def sign_v2(entries, cd, eocd, key, cert_der):
    SIG_RSA_PKCS1_SHA256 = 0x0103
    digest = chunked_digest([entries, cd, eocd])
    signed_data = (lp(lp(struct.pack('<I', SIG_RSA_PKCS1_SHA256) + lp(digest)))  # digests
                   + lp(lp(cert_der))                                              # certificates
                   + lp(b''))                                                      # additional attributes
    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = lp(signed_data) + lp(lp(struct.pack('<I', SIG_RSA_PKCS1_SHA256) + lp(signature))) + lp(pub)
    value = lp(lp(signer))
    pairs = struct.pack('<QI', len(value) + 4, 0x7109871a) + value
    size = len(pairs) + 8 + 16
    block = struct.pack('<Q', size) + pairs + struct.pack('<Q', size) + b'APK Sig Block 42'
    new_eocd = bytearray(eocd)
    struct.pack_into('<I', new_eocd, 16, len(entries) + len(block))
    return entries + block + cd + bytes(new_eocd)


# ---------------------------------------------------------------- main
def web_files(www):
    for root, dirs, files in os.walk(www):
        dirs[:] = sorted(d for d in dirs if not d.startswith('.'))
        for f in sorted(files):
            if f.startswith('.'):
                continue
            full = os.path.join(root, f)
            yield os.path.relpath(full, www).replace(os.sep, '/'), full


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--base', required=True, help='existing APK to take the Android shell from')
    ap.add_argument('--www', required=True, help='web app folder (songdiary/www)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--keystore', required=True, help='PKCS#12 keystore (.p12)')
    ap.add_argument('--storepass', default=os.environ.get('SONGDIARY_STOREPASS'), help='or env SONGDIARY_STOREPASS')
    ap.add_argument('--version-name')
    ap.add_argument('--version-code', type=int)
    a = ap.parse_args()
    if not a.storepass:
        sys.exit('keystore password missing (--storepass or SONGDIARY_STOREPASS)')

    with open(a.keystore, 'rb') as f:
        key, cert, _ = pkcs12.load_key_and_certificates(f.read(), a.storepass.encode())
    cert_der = cert.public_bytes(serialization.Encoding.DER)

    z = AlignedZip()
    with zipfile.ZipFile(a.base) as base:
        for info in base.infolist():
            n = info.filename
            if n.startswith(WEB_PREFIX) or n.startswith('META-INF/') and n.upper().endswith(('.SF', '.RSA', '.DSA', '.EC', 'MANIFEST.MF')):
                continue
            data = base.read(info)
            if n == 'AndroidManifest.xml' and (a.version_name or a.version_code is not None):
                data = patch_manifest(data, a.version_name, a.version_code)
            z.add(n, data, stored=info.compress_type == zipfile.ZIP_STORED)
    n_web = 0
    for rel, full in web_files(a.www):
        with open(full, 'rb') as f:
            data = f.read()
        z.add(WEB_PREFIX + rel, data, stored=rel.lower().endswith(STORE_EXT) or not data)
        n_web += 1
    entries, cd, eocd = z.finish()
    apk = sign_v2(entries, cd, eocd, key, cert_der)
    with open(a.out, 'wb') as f:
        f.write(apk)
    fp = hashlib.sha256(cert_der).hexdigest().upper()
    print('%s: %.1f MB, %d web files, signer SHA-256 %s' % (a.out, len(apk) / 1048576, n_web, ':'.join(fp[i:i + 2] for i in range(0, 64, 2))))


if __name__ == '__main__':
    main()
