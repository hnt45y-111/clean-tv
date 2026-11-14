#!/bin/bash
set -e
cd /home/claude/CleanTV
T=/tmp/claude-0/-home-claude/28324407-b6fe-5e3c-a1ed-af3ffa6a7f49/scratchpad/tv.tgz
tar czf $T --exclude='./app/build' --exclude='./app/src/main/assets/bg' --exclude='./app/src/main/assets/fonts' --exclude='./tools/pack.sh' .
base64 -w0 $T > $T.b64
python3 - "$T.b64" <<'PY'
import sys,re
p='/mnt/user-data/outputs/build.yml'
s=open(p).read()
s,n=re.subn(r'run: echo "[^"]*" \| base64', 'run: echo "'+open(sys.argv[1]).read()+'" | base64', s)
print('replaced',n)
open(p,'w').write(s)
PY
md5sum /mnt/user-data/outputs/build.yml
