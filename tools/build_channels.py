#!/usr/bin/env python3
"""Builds CleanTV/app/src/main/assets/channels.js from the public iptv-org stream lists.
Only channels from the broadcasters' own streams are listed (free to watch, no subscription); the table below says
which entry to take for each channel and which stream host must serve it. Run from the repo root with the lists in $LISTS."""
import re, os, sys, json
LISTS = os.environ.get('LISTS', '.')
def read(c):
    t = open(os.path.join(LISTS, c + '.m3u'), encoding='utf-8', errors='ignore').read().split('\n'); out = []
    for i, l in enumerate(t):
        if l.startswith('#EXTINF'):
            name = re.search(r',(.*)$', l).group(1).strip(); url = ''; opt = False
            for j in range(i + 1, min(i + 5, len(t))):
                if t[j].startswith('#EXTVLCOPT') or t[j].startswith('#EXTHTTP'): opt = True
                if t[j].startswith('http'): url = t[j].strip(); break
            out.append((name, url, opt))
    return out
# (arabic name, group, categories, list file, name regex, host regex)
T = [
 ('الجزيرة', 'qa', 'news', 'qa', r'^Al Jazeera Arabic \(1080p\)', r'getaj\.net'),
 ('الجزيرة مباشر', 'qa', 'news', 'qa', r'^Al Jazeera Mubasher \(1080p\)', r'getaj\.net'),
 ('العربية', 'ae', 'news', 'ae', r'^Al Arabiya \(1080p\)', r'alarabiya\.net'),
 ('الحدث', 'sa', 'news', 'sa', r'^Al Arabiya Al Hadath', r'alarabiya\.net'),
 ('الشرق للأخبار', 'sa', 'news', 'sa', r'^Asharq News', r'asharq\.com'),
 ('سكاي نيوز عربية', 'ae', 'news', 'ae', r'^Sky News Arabia \(1080p\)$', r'skynewsarabia\.com'),
 ('فرانس 24 بالعربية', 'int', 'news', 'fr', r'^France 24 Arabic \(1080p\)', r'france24\.com'),
 ('دويتشه فيله عربية', 'int', 'news', 'de', r'^DW Arabic', r'dwamdstream'),
 ('تي آر تي عربي', 'int', 'news', 'tr', r'^TRT Arabi', r'trt\.com\.tr'),
 ('الإخبارية السعودية', 'sa', 'news', 'sa', r'^Al Ekhbariya \(1080p\)', r'edgenextcdn\.net'),
 ('تلفزيون الكويت الإخباري', 'kw', 'news', 'kw', r'^KTV News \(1080p\)', r'mangomolo\.com'),
 ('العراقية', 'iq', 'general', 'iq', r'^Al Iraqia \(1080p\)', r'esite-lab\.com'),
 ('العراقية الإخبارية', 'iq', 'news', 'iq', r'^Al Iraqia News', r'esite-lab\.com'),
 ('العراقية الرياضية', 'iq', 'sport', 'iq', r'^Al Iraqia Sport', r'esite-lab\.com'),
 ('آي نيوز', 'iq', 'news', 'iq', r'^iNEWS TV', r'i-news\.tv'),
 ('قناة الإمام الحسين (ع)', 'iq', 'quran', 'iq', r'^Imam Hussein TV 1 \(1080p\)$', r'imamhossaintv\.com'),
 ('الكويت الرياضية', 'kw', 'sport', 'kw', r'^KTV Sport \(1080p\)', r'mangomolo\.com'),
 ('الكويت الرياضية بلس', 'kw', 'sport', 'kw', r'^KTV Sport Plus', r'mangomolo\.com'),
 ('عُمان الرياضية', 'om', 'sport', 'om', r'^Oman Sports TV', r'mgmlcdn\.com'),
 ('تلفزيون قطر', 'qa', 'general', 'qa', r'^Qatar Television \(1080p\)', r'qatartv\.akamaized\.net'),
 ('تلفزيون الكويت', 'kw', 'general', 'kw', r'^KTV 1 \(1080p\)', r'mangomolo\.com'),
 ('تلفزيون الكويت 2', 'kw', 'general', 'kw', r'^KTV 2 \(1080p\)', r'mangomolo\.com'),
 ('تلفزيون عُمان', 'om', 'general', 'om', r'^Oman TV \(1080p\)', r'mgmlcdn\.com'),
 ('عُمان مباشر', 'om', 'news', 'om', r'^Oman Mubashir', r'mgmlcdn\.com'),
 ('السعودية', 'sa', 'general', 'sa', r'^Al Saudiya \(1080p\)', r'edgenextcdn\.net'),
 ('القرآن الكريم (السعودية)', 'sa', 'quran', 'sa', r'^Al Quran Al Kareem TV \(720p\)', r'live\.net\.sa'),
 ('التلفزيون الأردني', 'jo', 'general', 'jo', r'^Jordan Satellite Channel', r'ercdn\.net'),
 ('فلسطين', 'ps', 'general', 'ps', r'^Palestine Satellite Channel \(1080p\)', r'furrera\.ps'),
 ('تلفزيون لبنان', 'lb', 'general', 'lb', r'^Tele Liban', r'catiacast'),
 ('ميدي 1 تيفي', 'ma', 'news', 'ma', r'^Medi 1 TV Arabic \(1080p\)$', r'easybroadcast'),
]
GROUPS = [('iq', 'العراق'), ('sa', 'السعودية'), ('ae', 'الإمارات'), ('qa', 'قطر'), ('kw', 'الكويت'), ('om', 'عُمان'), ('jo', 'الأردن'), ('ps', 'فلسطين'), ('lb', 'لبنان'), ('ma', 'المغرب'), ('int', 'دولية')]
cache = {}; out = []; miss = []
for ar, grp, cat, f, nre, hre in T:
    if f not in cache: cache[f] = read(f)
    pick = None
    for n, u, opt in cache[f]:
        if re.search(nre, n) and re.search(hre, u) and not opt: pick = u; break
    if pick: out.append({'n': ar, 'c': grp, 'g': cat, 'u': pick})
    else: miss.append(ar)
js = '/* free channels from the broadcasters\' own streams (built by tools/build_channels.py) */\nwindow.CH_GROUPS = ' + json.dumps(GROUPS, ensure_ascii=False) + ';\nwindow.CHANNELS = ' + json.dumps(out, ensure_ascii=False, indent=0).replace('\n', '') + ';\n'
dst = sys.argv[1] if len(sys.argv) > 1 else 'CleanTV/app/src/main/assets/channels.js'
open(dst, 'w', encoding='utf-8').write(js)
print(len(out), 'channels; missing:', miss)
