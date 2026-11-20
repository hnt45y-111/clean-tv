# يولّد أصوات ElevenLabs مباشرة (صوت امرأة عربي) لكل سطر في voice_texts/elevenlabs_full.txt
# الاستعمال:  set ELEVEN_API_KEY=...   ثم   python gen_elevenlabs.py
# يحتاج حساب مدفوع إذا الصوت من مكتبة الأصوات. الصوت الافتراضي: Wiam (R5kMoWNNTn84ezIJA53m)
import json, os, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
KEY = os.environ.get('ELEVEN_API_KEY') or sys.exit('ضع ELEVEN_API_KEY')
VOICE = os.environ.get('ELEVEN_VOICE', 'R5kMoWNNTn84ezIJA53m')
MODEL = os.environ.get('ELEVEN_MODEL', 'eleven_multilingual_v2')
OUT = os.path.join(HERE, 'www', 'voices'); os.makedirs(OUT, exist_ok=True)

def hsh(t):
    h = 0x811c9dc5
    b = t.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8); h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

lines = [x for x in open(os.path.join(HERE, 'voice_texts', 'elevenlabs_full.txt'), encoding='utf-8').read().split('\n') if x]
for i, t in enumerate(lines):
    fn = os.path.join(OUT, hsh(t) + '.mp3')
    if os.path.exists(fn): continue
    req = urllib.request.Request('https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_64' % VOICE,
        data=json.dumps({'text': t, 'model_id': MODEL, 'language_code': 'ar',
                         'voice_settings': {'stability': .55, 'similarity_boost': .8, 'speed': .92}}).encode(),
        headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
    for a in range(3):
        try:
            open(fn, 'wb').write(urllib.request.urlopen(req, timeout=60).read()); break
        except Exception as e:
            print('retry', i, e); time.sleep(2 * (a + 1))
    if i % 25 == 0: print(i, '/', len(lines), flush=True)
have = [hsh(t) for t in lines if os.path.exists(os.path.join(OUT, hsh(t) + '.mp3'))]
open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8').write('window.VOICES="' + ','.join(have) + '";')
print('VOICES READY', len(have), 'of', len(lines))
