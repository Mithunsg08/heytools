#!/usr/bin/env python3
"""Makes og/<tool>.jpg share cards (1200x630) from app/tools.js. Needs Pillow and DejaVu fonts:  python3 scripts/make-og.py"""
import re, os, json
from PIL import Image, ImageDraw, ImageFont
root = os.path.join(os.path.dirname(__file__), '..')
src = open(os.path.join(root, 'app/tools.js'), encoding='utf8').read()
tools = re.findall(r"\{ id: '([a-z0-9-]+)', name: '([^']+)', cat: '([a-z]+)'.*?desc: '((?:[^'\\]|\\.)*)'", src)
os.makedirs(os.path.join(root, 'og'), exist_ok=True)
B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; R = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
PAL = {'media': ('#6D28D9', '#2563EB'), 'image': ('#DB2777', '#7C3AED'), 'daily': ('#059669', '#0EA5E9'), 'utility': ('#2563EB', '#0891B2'),
       'dev': ('#334155', '#6D28D9'), 'games': ('#F59E0B', '#DC2626'), 'business': ('#0F766E', '#1D4ED8')}
def wrap(d, text, font, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines[:3]
for tid, name, cat, desc in tools:
    a, b = PAL.get(cat, PAL['utility'])
    im = Image.new('RGB', (1200, 630), a); px = im.load()
    c1 = tuple(int(a[i:i+2], 16) for i in (1, 3, 5)); c2 = tuple(int(b[i:i+2], 16) for i in (1, 3, 5))
    for y in range(630):
        for x in range(0, 1200):
            t = (x / 1200 * 0.6 + y / 630 * 0.4)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    d = ImageDraw.Draw(im)
    d.text((70, 64), 'HeyTools', font=ImageFont.truetype(B, 40), fill=(255, 255, 255))
    d.text((70, 112), 'Free. Private. Works offline.', font=ImageFont.truetype(R, 28), fill=(255, 255, 255, 200))
    f = ImageFont.truetype(B, 92 if len(name) < 16 else 72)
    d.text((70, 250), name, font=f, fill=(255, 255, 255))
    y = 380
    for line in wrap(d, desc.replace("\\'", "'"), ImageFont.truetype(R, 38), 1060):
        d.text((70, y), line, font=ImageFont.truetype(R, 38), fill=(255, 255, 255)); y += 52
    d.text((70, 560), 'mithunsg08.github.io/heytools', font=ImageFont.truetype(R, 28), fill=(255, 255, 255))
    im.save(os.path.join(root, 'og', tid + '.jpg'), quality=80, optimize=True, progressive=True)
print('made', len(tools), 'cards')
