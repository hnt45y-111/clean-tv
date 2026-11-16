#!/usr/bin/env python3
"""Write the IPTV server address into assets/srv.dat (masked, not plain text).
Usage: python3 Studio/tools/set_server.py http://server.com:8080
       python3 Studio/tools/set_server.py --show      (prints what is stored)
The key must match Srv.java."""
import base64, os, sys

KEY = b"msm-srv-2026"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "src", "main", "assets", "srv.dat")

def mask(b):
    return bytes(c ^ KEY[i % len(KEY)] for i, c in enumerate(b))

if len(sys.argv) != 2:
    sys.exit(__doc__)
if sys.argv[1] == "--show":
    print(mask(base64.b64decode(open(OUT).read().strip())).decode())
else:
    url = sys.argv[1].strip().rstrip("/")
    if not url.lower().startswith(("http://", "https://")):
        url = "http://" + url
    open(OUT, "w").write(base64.b64encode(mask(url.encode())).decode())
    print("saved:", os.path.normpath(OUT))
