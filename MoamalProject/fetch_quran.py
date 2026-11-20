# Downloads Juz Amma (+ Al-Fatiha) text and recitation audio for the app.
# Output: www/quran/quran.js + www/quran/*.mp3
import json, os, re, sys, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'www', 'quran')
os.makedirs(OUT, exist_ok=True)
SURAHS = [1] + list(range(78, 115))
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept': 'application/json'}


def log(*a):
    print(*a, flush=True)


def get(url, tries=4, raw=False):
    for t in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                d = r.read()
                return d if raw else json.loads(d.decode('utf-8'))
        except Exception as e:
            err = e
            time.sleep(1.5 * (t + 1))
    raise err


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return True
    try:
        d = get(url, raw=True)
        if len(d) < 1000:
            return False
        open(path + '.part', 'wb').write(d)
        os.replace(path + '.part', path)
        return True
    except Exception as e:
        log('   download failed', url, e)
        return False


DIAC = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')


def norm(t):
    t = DIAC.sub('', t)
    t = re.sub('[ٱأإآ]', 'ا', t)
    return re.sub(r'\s+', ' ', t).strip()


def strip_basmala(n, txt):
    if n in (1, 9):
        return txt
    w = txt.split(' ')
    if len(w) > 4 and norm(' '.join(w[:4])).replace('ة', 'ه') in ('بسم الله الرحمن الرحيم', 'بسم اللّه الرحمن الرحيم'):
        return ' '.join(w[4:])
    return txt


# ---------------- text ----------------
def fetch_text(n):
    try:
        d = get(f'https://api.alquran.cloud/v1/surah/{n}/editions/quran-uthmani,quran-simple')
        u = [strip_basmala(n, a['text']) for a in d['data'][0]['ayahs']]
        s = [strip_basmala(n, a['text']) for a in d['data'][1]['ayahs']]
        return u, s
    except Exception as e:
        log('   alquran.cloud failed', n, e)
    d = get(f'https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number={n}')
    u = [v['text_uthmani'] for v in d['verses']]
    d = get(f'https://api.quran.com/api/v4/quran/verses/imlaei?chapter_number={n}')
    s = [v['text_imlaei'] for v in d['verses']]
    return u, s


# ---------------- kids reciter (Minshawi with children) ----------------
def find_kids_reciter():
    cands = []
    for url in ['https://api.quran.com/api/v4/resources/chapter_reciters?language=ar',
                'https://api.quran.com/api/v4/resources/chapter_reciters?language=en']:
        try:
            for r in get(url).get('reciters', []):
                blob = json.dumps(r, ensure_ascii=False).lower()
                if 'minshawi' in blob or 'منشاوي' in blob or 'المنشاوى' in blob:
                    log('   reciter option:', r.get('id'), r.get('name'), (r.get('translated_name') or {}).get('name'), r.get('style'))
                    if any(k in blob for k in ['kid', 'child', 'أطفال', 'الاطفال', 'معلم', 'teacher', 'muallim', 'repeat', 'ترديد']):
                        cands.append(r['id'])
        except Exception as e:
            log('   reciter list failed', url, e)
    return cands[0] if cands else None


def kids_audio(rid, n):
    """returns (url, timings[[from,to],...] or None)"""
    for url in [f'https://api.qurancdn.com/api/qdc/audio/reciters/{rid}/audio_files?chapter={n}&segments=true',
                f'https://api.quran.com/api/v4/chapter_recitations/{rid}/{n}?segments=true']:
        try:
            d = get(url)
            af = d.get('audio_files', [d.get('audio_file')])[0]
            if not af or not af.get('audio_url'):
                continue
            au = af['audio_url']
            if au.startswith('//'):
                au = 'https:' + au
            elif not au.startswith('http'):
                au = 'https://download.quranicaudio.com/' + au.lstrip('/')
            tl = af.get('verse_timings') or af.get('timestamps') or []
            t = []
            for x in tl:
                if x.get('timestamp_from') is None or x.get('timestamp_to') is None:
                    continue
                vk = x.get('verse_key', '')
                t.append((int(vk.split(':')[1]) if ':' in vk else len(t) + 1, int(x['timestamp_from']), int(x['timestamp_to'])))
            t.sort()
            return au, ([[a, b] for _, a, b in t] if t else None)
        except Exception as e:
            log('   kids audio api failed', url, e)
    return None, None


def main():
    data = {'reciter': '', 'kids': False, 'bsm': None, 'surahs': {}}
    log('quran: text…')
    texts = {}
    for n in SURAHS:
        texts[n] = fetch_text(n)
    log('quran: text ok for', len(texts), 'surahs')

    rid = None if os.environ.get('MOAMAL_NO_KIDS') else find_kids_reciter()
    need_ayah_audio = set(SURAHS)
    if rid:
        log('quran: kids reciter id =', rid)
        data['reciter'] = 'الشيخ المنشاوي مع الأطفال'
        data['kids'] = True
        for n in SURAHS:
            au, t = kids_audio(rid, n)
            if not au:
                continue
            fn = f'k{n:03d}.mp3'
            if download(au, os.path.join(OUT, fn)):
                u, s = texts[n]
                if t and len(t) >= len(u):
                    data['surahs'][str(n)] = {'u': u, 's': s, 'f': 'quran/' + fn, 't': t[:len(u)]}
                    need_ayah_audio.discard(n)
                else:
                    data['surahs'][str(n)] = {'u': u, 's': s, 'f': 'quran/' + fn, 't': None}
            log('   kids', n, 'ok' if str(n) in data['surahs'] else 'missing', 'timings' if n not in need_ayah_audio else '')
    else:
        log('quran: kids reciter not found on quran.com, using Husary Muallim (teacher) per ayah')

    if need_ayah_audio:
        folder = 'Husary_Muallim_128kbps'
        if not data['reciter']:
            data['reciter'] = 'الشيخ الحصري (المصحف المعلّم)'
        download(f'https://everyayah.com/data/{folder}/001001.mp3', os.path.join(OUT, 'bsm.mp3'))
        data['bsm'] = 'quran/bsm.mp3'
        for n in sorted(need_ayah_audio):
            u, s = texts[n]
            from concurrent.futures import ThreadPoolExecutor
            names = [f'{n:03d}{i:03d}.mp3' for i in range(1, len(u) + 1)]
            with ThreadPoolExecutor(8) as ex:
                oks = list(ex.map(lambda fn: download(f'https://everyayah.com/data/{folder}/{fn}', os.path.join(OUT, fn)), names))
            files = ['quran/' + fn if ok else None for fn, ok in zip(names, oks)]
            entry = data['surahs'].get(str(n), {'u': u, 's': s})
            entry['a'] = files
            data['surahs'][str(n)] = entry
            log('   ayah audio', n, sum(1 for f in files if f), '/', len(files))

    for n in SURAHS:
        if str(n) not in data['surahs']:
            u, s = texts[n]
            data['surahs'][str(n)] = {'u': u, 's': s}
    open(os.path.join(OUT, 'quran.js'), 'w', encoding='utf-8').write('window.QURAN_DATA=' + json.dumps(data, ensure_ascii=False) + ';')
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) / 1e6
    log(f'QURAN READY: {len(data["surahs"])} surahs, reciter: {data["reciter"]}, size {size:.1f} MB')


if __name__ == '__main__':
    main()
