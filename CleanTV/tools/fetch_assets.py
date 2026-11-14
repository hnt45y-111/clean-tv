import json, os, subprocess, time, urllib.request, urllib.parse

UA = {'User-Agent': 'CleanTV-launcher-build/2.0 (personal TV launcher; GitHub Actions)'}
ROOT = 'app/src/main/assets'
os.makedirs(ROOT + '/bg', exist_ok=True)
os.makedirs(ROOT + '/fonts', exist_ok=True)

def get(url, tries=4):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            print('retry', t, url[:90], e)
            time.sleep(3 + t * 4)
    return None

# Fonts (Google Fonts repo, OFL)
fonts = {
  'Tajawal-Light.ttf': 'ofl/tajawal/Tajawal-Light.ttf',
  'Tajawal-Regular.ttf': 'ofl/tajawal/Tajawal-Regular.ttf',
  'Tajawal-Medium.ttf': 'ofl/tajawal/Tajawal-Medium.ttf',
  'Tajawal-Bold.ttf': 'ofl/tajawal/Tajawal-Bold.ttf',
  'Tajawal-ExtraBold.ttf': 'ofl/tajawal/Tajawal-ExtraBold.ttf',
  'Amiri-Regular.ttf': 'ofl/amiri/Amiri-Regular.ttf',
  'Amiri-Bold.ttf': 'ofl/amiri/Amiri-Bold.ttf',
  # brand faces (مدير الشاشة identity)
  'Alexandria.ttf': 'ofl/alexandria/Alexandria%5Bwght%5D.ttf',
  'PlexArabic-Regular.ttf': 'ofl/ibmplexsansarabic/IBMPlexSansArabic-Regular.ttf',
  'PlexArabic-Medium.ttf': 'ofl/ibmplexsansarabic/IBMPlexSansArabic-Medium.ttf',
  'PlexArabic-SemiBold.ttf': 'ofl/ibmplexsansarabic/IBMPlexSansArabic-SemiBold.ttf',
  'PlexArabic-Bold.ttf': 'ofl/ibmplexsansarabic/IBMPlexSansArabic-Bold.ttf',
  'PlexMono-Medium.ttf': 'ofl/ibmplexmono/IBMPlexMono-Medium.ttf',
}
kufi = get('https://raw.githubusercontent.com/google/fonts/main/ofl/reemkufi/ReemKufi%5Bwght%5D.ttf') or \
       get('https://raw.githubusercontent.com/google/fonts/main/ofl/reemkufi/ReemKufi-Regular.ttf')
if kufi:
    open(f'{ROOT}/fonts/ReemKufi.ttf', 'wb').write(kufi)
    print('font ok ReemKufi', len(kufi))
for name, path in fonts.items():
    data = get('https://raw.githubusercontent.com/google/fonts/main/' + path)
    if data:
        open(f'{ROOT}/fonts/{name}', 'wb').write(data)
        print('font ok', name, len(data))

# Background photos from Wikimedia Commons (holy shrines)
ids = [39453686,40321171,40321172,44066259,57515026,57515036,57515052,57515081,57515089,57519068,
       60240633,60241070,60242163,62348082,62564743,62564746,62564774,64601431,64601441,72780904,
       73007702,73142697,74182247,82776840,94687398,107048780,107049913,113289108,132386482,132386553,
       140920334,194257167]
api = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo'
       '&iiprop=url|extmetadata&iiurlwidth=1920&pageids=' + '|'.join(map(str, ids)))
meta = json.loads(get(api) or b'{}')
credits = []
n = 0
for pid, page in (meta.get('query', {}).get('pages', {}) or {}).items():
    info = (page.get('imageinfo') or [{}])[0]
    url = info.get('thumburl') or info.get('url')
    if not url:
        continue
    data = get(url)
    time.sleep(1)
    if not data:
        continue
    n += 1
    raw = f'/tmp/bg_{n}.jpg'
    out = f'{ROOT}/bg/{n:02d}.jpg'
    open(raw, 'wb').write(data)
    r = subprocess.run(['convert', raw, '-auto-orient', '-resize', '1920x1080^', '-gravity', 'center',
                        '-extent', '1920x1080', '-strip', '-quality', '80', out])
    if r.returncode != 0:
        os.replace(raw, out)
    em = info.get('extmetadata', {})
    credits.append({'file': out, 'title': page.get('title'),
                    'artist': em.get('Artist', {}).get('value', ''),
                    'license': em.get('LicenseShortName', {}).get('value', '')})
    print('bg ok', out)
json.dump(credits, open(f'{ROOT}/bg/credits.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('backgrounds:', n)
