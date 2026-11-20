# يستقبل مجلد mp3 مولّدة من ElevenLabs (كل ملف بترتيب أسطر voice_texts/elevenlabs_full.txt)
# ويسمّيها www/voices/<hash>.mp3 ويكتب www/voices/index.js
# الاستعمال:  python import_voices.py <مجلد_الملفات>
# الترتيب: بالاسم (001.mp3, 002.mp3 ...) أو بالرقم الموجود بأول اسم الملف.
import os, re, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'www', 'voices'); os.makedirs(OUT, exist_ok=True)

def hsh(t):
    h = 0x811c9dc5
    b = t.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

lines = [x for x in open(os.path.join(HERE, 'voice_texts', 'elevenlabs_full.txt'), encoding='utf-8').read().split('\n') if x]
src = sys.argv[1]
files = [f for f in os.listdir(src) if f.lower().endswith('.mp3')]
key = lambda f: (int(re.match(r'\d+', f).group()) if re.match(r'\d+', f) else 10**9, f)
files.sort(key=key)
if len(files) != len(lines):
    sys.exit('عدد الملفات %d لا يساوي عدد الأسطر %d، ما سوّيت شي' % (len(files), len(lines)))
for f, t in zip(files, lines):
    shutil.copyfile(os.path.join(src, f), os.path.join(OUT, hsh(t) + '.mp3'))
have = [hsh(t) for t in lines]
open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8').write('window.VOICES="' + ','.join(have) + '";')
print('تم:', len(have), 'صوت')
