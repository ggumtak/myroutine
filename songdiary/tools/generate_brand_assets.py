#!/usr/bin/env python3
"""Export the hand-authored SVG brand to Android/PWA assets. Requires cairosvg and Pillow."""
from io import BytesIO
from pathlib import Path
import xml.etree.ElementTree as ET

import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
WWW = ROOT / 'www'
RES = ROOT / 'native/android/app/src/main/res'
SVG = (WWW / 'icon.svg').read_bytes()


def render(svg, size):
    return Image.open(BytesIO(cairosvg.svg2png(bytestring=svg, output_width=size, output_height=size))).convert('RGBA')


def main():
    for size in (192, 512):
        render(SVG, size).save(WWW / f'assets/icon-{size}.png')
    render(SVG, 180).save(WWW / 'assets/apple-touch-icon.png')
    tree = ET.fromstring(SVG)
    tree.remove(tree[0])  # the adaptive icon uses Android's separate background
    foreground = ET.tostring(tree)
    for density, scale in [('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)]:
        folder = RES / f'mipmap-{density}'
        size = int(48 * scale)
        render(SVG, size).save(folder / 'ic_launcher.png')
        round_icon = Image.new('RGBA', (size, size), '#69508C')
        round_icon.alpha_composite(render(foreground, size))
        mask = Image.new('L', (size, size))
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon.putalpha(mask)
        round_icon.save(folder / 'ic_launcher_round.png')
        render(foreground, int(108 * scale)).save(folder / 'ic_launcher_foreground.png')
    # Keep the established splash sizes/orientation qualifiers, replacing the template artwork.
    for path in RES.glob('drawable*/splash.png'):
        with Image.open(path) as old:
            width, height = old.size
        canvas = Image.new('RGB', (width, height), '#F4F2EF')
        size = max(48, int(min(width, height) * .23))
        logo = render(SVG, size)
        canvas.paste(logo, ((width - size) // 2, (height - size) // 2), logo)
        canvas.save(path)
    print('Exported PWA, legacy/adaptive Android icons and splash screens.')


if __name__ == '__main__':
    main()
