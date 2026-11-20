# Generates natural Iraqi-Arabic voice clips for every phrase in phrases.json
# and downloads the app fonts. Output: www/voices/*.mp3 + www/voices/index.js + www/fonts/
import asyncio, json, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'www', 'voices')
FONTS = os.path.join(HERE, 'www', 'fonts')
VOICE = os.environ.get('MOAMAL_VOICE', 'ar-IQ-RanaNeural')
RATE, PITCH = '-6%', '+6Hz'
os.makedirs(OUT, exist_ok=True)
os.makedirs(FONTS, exist_ok=True)


def hsh(t):
    h = 0x811c9dc5
    b = t.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h


def fonts():
    try:
        url = 'https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Baloo+Bhaijaan+2:wght@600;700;800&display=swap'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'})
        css = urllib.request.urlopen(req, timeout=30).read().decode('utf-8')
        n = 0
        for u in sorted(set(re.findall(r'url\((https://[^)]+)\)', css))):
            n += 1
            fn = 'f%d.woff2' % n
            urllib.request.urlretrieve(u, os.path.join(FONTS, fn))
            css = css.replace(u, fn)
        open(os.path.join(FONTS, 'fonts.css'), 'w', encoding='utf-8').write(css)
        print('fonts ok:', n, 'files', flush=True)
    except Exception as e:
        print('fonts skipped:', e, flush=True)


async def main():
    import edge_tts
    phrases = json.load(open(os.path.join(HERE, 'phrases.json'), encoding='utf-8'))
    todo = [p for p in phrases if not os.path.exists(os.path.join(OUT, hsh(p) + '.mp3'))]
    print('phrases:', len(phrases), 'to generate:', len(todo), 'voice:', VOICE, flush=True)
    sem = asyncio.Semaphore(6)
    done = [0]
    fails = []

    async def one(p):
        fn = os.path.join(OUT, hsh(p) + '.mp3')
        async with sem:
            for attempt in range(4):
                try:
                    c = edge_tts.Communicate(p, VOICE, rate=RATE, pitch=PITCH)
                    await c.save(fn + '.part')
                    if os.path.getsize(fn + '.part') > 500:
                        os.replace(fn + '.part', fn)
                        break
                except Exception as e:
                    err = e
                    await asyncio.sleep(1.5 * (attempt + 1))
            else:
                fails.append(p)
            done[0] += 1
            if done[0] % 50 == 0:
                print('  voices', done[0], '/', len(todo), flush=True)

    await asyncio.gather(*(one(p) for p in todo))
    have = [hsh(p) for p in phrases if os.path.exists(os.path.join(OUT, hsh(p) + '.mp3'))]
    open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8').write('window.VOICES="' + ','.join(have) + '";')
    print('VOICES READY:', len(have), 'of', len(phrases), 'failed:', len(fails), flush=True)


if __name__ == '__main__':
    fonts()
    asyncio.run(main())
