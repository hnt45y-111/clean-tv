#!/bin/bash
# Rebuild /mnt/user-data/outputs/studio.yml from the project (plus the launcher page for the preview).
set -e
cd /home/claude/Studio
rm -rf launcher_src launcher_src_tools
cp -r /home/claude/CleanTV/app/src/main/assets launcher_src
rm -rf launcher_src/bg launcher_src/fonts
mkdir -p launcher_src_tools && cp /home/claude/CleanTV/tools/fetch_assets.py launcher_src_tools/
T=/tmp/claude-0/-home-claude/28324407-b6fe-5e3c-a1ed-af3ffa6a7f49/scratchpad/studio.tgz
tar czf $T --exclude='./app/build' --exclude='./app/src/main/assets/fonts' --exclude='./app/src/main/assets/launcher' .
base64 -w0 $T > $T.b64
python3 - "$T.b64" <<'PY'
import sys,re
p='/mnt/user-data/outputs/studio.yml'
s=open(p).read()
s=re.sub(r'run: echo "[^"]*" \| base64', 'run: echo "'+open(sys.argv[1]).read()+'" | base64', s)
s=s.replace('''      - name: Fonts
        run: python3 tools/fonts.py''','''      - name: Install ImageMagick
        timeout-minutes: 6
        continue-on-error: true
        run: command -v convert || sudo timeout 150 apt-get install -y --no-install-recommends imagemagick || (sudo timeout 180 apt-get update && sudo timeout 150 apt-get install -y --no-install-recommends imagemagick)
      - name: Launcher preview files
        run: python3 tools/launcher_assets.py''')
open(p,'w').write(s)
PY
md5sum /mnt/user-data/outputs/studio.yml; ls -la /mnt/user-data/outputs/studio.yml
