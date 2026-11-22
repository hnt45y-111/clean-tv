#!/usr/bin/env python3
"""Puts tools/mobile/read_site.js into SiteActivity.java as the READ_JS string (run after editing the script)."""
import os, re
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
js = open(os.path.join(R, 'tools', 'mobile', 'read_site.js'), encoding='utf-8').read()
js = re.sub(r'/\*.*?\*/', '', js, flags=re.S)                      # block comments out
js = '\n'.join(l.strip() for l in js.split('\n') if l.strip())    # one statement per line, no indentation (keeps //-free code safe)
js = js.replace('\\', '\\\\').replace('"', '\\"')
lines = js.split('\n')
java = '    private static final String READ_JS = ""\n' + '\n'.join('        + "%s\\n"' % l for l in lines) + ';\n'
p = os.path.join(R, 'Mobile', 'app', 'src', 'main', 'java', 'com', 'cleantv', 'mobile', 'SiteActivity.java')
s = open(p, encoding='utf-8').read()
a = s.index('    /** reads the arrangement of the page'); b = s.index('    private boolean auto, reading;')
s = s[:a] + '    /** reads the arrangement of the page: generated from tools/mobile/read_site.js by tools/mobile/gen_readjs.py */\n' + java + '\n' + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('ok', len(lines), 'lines')
