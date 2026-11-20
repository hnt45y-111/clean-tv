cd /home/claude/v3 && python3 patch.py >/dev/null && python3 -c "
import json
s=open('/home/claude/v3/template.html',encoding='utf-8').read()
imgs=json.load(open('/tmp/claude-0/-home-claude/2a2ab002-a205-5d59-bd44-577a495caab0/scratchpad/imgs.json'))
open('/home/claude/v3/index.html','w',encoding='utf-8').write(s.replace('/*IMG*/[]',json.dumps(imgs)))"
