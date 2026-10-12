#!/usr/bin/env python3
"""Rebuild offline Yamaha C5 samples from pinned, lossless Salamander sources (CC BY 3.0).
Requires ffmpeg. Downloads stay in --cache; only the lossless stereo FLAC exports belong in git.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import quote
from urllib.request import urlopen

REV = '3382bf9496bba2486f5ab0de55a264d1dfc38404'
BASE = f'https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/{REV}/Samples/'
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--cache', required=True)
    ap.add_argument('--out', default=str(Path(__file__).resolve().parents[1] / 'www/piano'))
    a = ap.parse_args()
    cache, out = Path(a.cache), Path(a.out)
    cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)

    def export(job):
        midi, layer = job
        name = f'{NAMES[midi % 12]}{midi // 12 - 1}v{layer}.flac'
        source = cache / name
        if not source.exists():
            with urlopen(BASE + quote(name), timeout=45) as r:
                data = r.read()
            if not data.startswith(b'fLaC'):
                raise ValueError(f'Not a FLAC file: {name}')
            source.write_bytes(data)
        target = out / f'p{midi}v{layer}.flac'
        subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                        '-af', 'silenceremove=start_periods=1:start_threshold=-65dB:window=0.003,atrim=duration=8,afade=t=out:st=7.8:d=0.2,aresample=osf=s16:dither_method=triangular',
                        '-ar', '48000', '-ac', '2', '-c:a', 'flac', '-sample_fmt', 's16', '-compression_level', '8', str(target)], check=True)
        return {'midi': midi, 'layer': layer, 'source': name,
                'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'file': target.name, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}

    with ThreadPoolExecutor(max_workers=6) as pool:
        records = list(pool.map(export, [(m, layer) for m in range(33, 97, 3) for layer in (8, 12)]))
    (out / 'samples.json').write_text(json.dumps({'instrument': 'Yamaha C5', 'library': 'Salamander Grand Piano V3',
        'author': 'Alexander Holm', 'license': 'CC BY 3.0', 'revision': REV,
        'encoding': '48 kHz 16-bit stereo FLAC (lossless at CD resolution, triangular dither from the 24-bit source), max 8 seconds; leading silence trimmed; final 200 ms faded; no per-note normalization',
        'samples': records}, indent=2) + '\n')
    print(f'Exported {len(records)} stereo samples, {sum((out / x["file"]).stat().st_size for x in records) / 1048576:.1f} MiB')


if __name__ == '__main__':
    main()
