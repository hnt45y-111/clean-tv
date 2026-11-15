#!/usr/bin/env python3
"""Downloads the channel logos named in tools/channel_logos.json into app/src/main/assets/logos/<id>.png (200x200, transparent).
Runs at build time (the build machine has the internet); a logo that can't be fetched is skipped and the app shows a letter tile.
Run from the CleanTV folder."""
import json, os, subprocess, sys, tempfile, urllib.request
from concurrent.futures import ThreadPoolExecutor
SRC = os.path.join('..', 'tools', 'channel_logos.json'); DST = 'app/src/main/assets/logos'
os.makedirs(DST, exist_ok=True)
logos = json.load(open(SRC))
def one(item):
    cid, url = item; out = os.path.join(DST, cid + '.png')
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'})
        data = urllib.request.urlopen(req, timeout=20).read()
        if len(data) < 200 or len(data) > 6_000_000: return 0
        with tempfile.NamedTemporaryFile(delete=False, suffix='.img') as t: t.write(data); p = t.name
        r = subprocess.run(['convert', p + '[0]', '-background', 'none', '-trim', '+repage', '-resize', '176x176', '-gravity', 'center', '-extent', '200x200', out], capture_output=True, timeout=40)
        os.unlink(p)
        return 1 if r.returncode == 0 and os.path.exists(out) else 0
    except Exception as e:
        return 0
with ThreadPoolExecutor(8) as ex: ok = sum(ex.map(one, logos.items()))
print('logos', ok, 'of', len(logos))
