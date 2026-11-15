#!/usr/bin/env python3
"""Builds CleanTV/app/src/main/assets/channels.js (+ tools/channel_logos.json) from the public iptv-org lists.
Only free channels served from the broadcasters' own stream hosts are listed; the table says which entry to take for each
channel (list file, name regex, host regex). Logos are looked up in the iptv-org database and downloaded at build time
by tools/fetch_logos.py. Run from the repo root:  LISTS=<folder with the .m3u files> LOGOS=<logos.csv> python3 tools/build_channels.py"""
import re, os, sys, json, csv
LISTS = os.environ.get('LISTS', '.'); LOGOS = os.environ.get('LOGOS', 'logos.csv')
def read(c):
    p = os.path.join(LISTS, c + '.m3u')
    if not os.path.exists(p): return []
    t = open(p, encoding='utf-8', errors='ignore').read().split('\n'); out = []
    for i, l in enumerate(t):
        if l.startswith('#EXTINF'):
            name = re.search(r',(.*)$', l).group(1).strip(); tid = (re.search(r'tvg-id="([^"]*)"', l) or [0, ''])[1]; url = ''; hd = {}
            for j in range(i + 1, min(i + 5, len(t))):
                m = re.match(r'#EXTVLCOPT:http-(referrer|referer|user-agent)=(.*)', t[j])
                if m: hd['r' if m.group(1).startswith('refer') else 'ua'] = m.group(2).strip()
                if t[j].startswith('http'): url = t[j].strip(); break
            out.append((name, url, hd, tid.split('@')[0]))
    return out
# categories: news · sport · movies (أفلام ومسلسلات) · ent (منوعات) · kids · quran      p = package (mbc)
T = [
 # news
 ('الجزيرة', 'qa', 'news', '', 'qa', r'^Al Jazeera Arabic \(1080p\)', r'getaj\.net'),
 ('الجزيرة مباشر', 'qa', 'news', '', 'qa', r'^Al Jazeera Mubasher \(1080p\)', r'getaj\.net'),
 ('العربية', 'ae', 'news', '', 'ae', r'^Al Arabiya \(1080p\)', r'alarabiya\.net'),
 ('الحدث', 'sa', 'news', '', 'sa', r'^Al Arabiya Al Hadath', r'alarabiya\.net'),
 ('الشرق للأخبار', 'sa', 'news', '', 'sa', r'^Asharq News', r'asharq\.com'),
 ('سكاي نيوز عربية', 'ae', 'news', '', 'ae', r'^Sky News Arabia \(1080p\)$', r'skynewsarabia\.com'),
 ('فرانس 24 بالعربية', 'int', 'news', '', 'fr', r'^France 24 Arabic \(1080p\)', r'france24\.com'),
 ('دويتشه فيله عربية', 'int', 'news', '', 'de', r'^DW Arabic', r'dwamdstream'),
 ('تي آر تي عربي', 'int', 'news', '', 'tr', r'^TRT Arabi', r'trt\.com\.tr'),
 ('الإخبارية السعودية', 'sa', 'news', '', 'sa', r'^Al Ekhbariya \(1080p\)', r'edgenextcdn\.net'),
 ('الميادين', 'lb', 'news', '', 'lb', r'^Al Mayadeen', r'octivid\.com'),
 ('الكويت الإخبارية', 'kw', 'news', '', 'kw', r'^KTV News \(1080p\)', r'mangomolo\.com'),
 ('عُمان مباشر', 'om', 'news', '', 'om', r'^Oman Mubashir', r'mgmlcdn\.com'),
 ('الجزائر 24 نيوز', 'dz', 'news', '', 'dz', r'^AL24 News', r'easybroadcast'),
 ('الوسط الليبية', 'ly', 'news', '', 'ly', r'^Wasat TV', r'hibridcdn\.net'),
 # Iraq
 ('العراقية', 'iq', 'ent', '', 'iq', r'^Al Iraqia \(1080p\)', r'esite-lab\.com'),
 ('العراقية الإخبارية', 'iq', 'news', '', 'iq', r'^Al Iraqia News', r'esite-lab\.com'),
 ('العراقية الرياضية', 'iq', 'sport', '', 'iq', r'^Al Iraqia Sport', r'esite-lab\.com'),
 ('آي نيوز', 'iq', 'news', '', 'iq', r'^iNEWS TV', r'i-news\.tv'),
 ('روداو', 'iq', 'news', '', 'iq', r'^Rudaw TV \(1080p\)', r'live\.rudaw\.net'),
 ('يو تي في العراقية', 'iq', 'ent', '', 'iq', r'^UTV', r'mncdn\.com'),
 ('الشمس', 'iq', 'ent', '', 'iq', r'^Shams TV', r'shams\.tv'),
 ('آفاق', 'iq', 'ent', '', 'iq', r'^Afaq TV', r'afaq\.iq'),
 ('سامراء', 'iq', 'ent', '', 'iq', r'^Samarra TV', r'samarra\.tv'),
 ('عشتار', 'iq', 'ent', '', 'iq', r'^Ishtar TV', r'ishtartv\.com'),
 ('الأولى', 'iq', 'ent', '', 'iq', r'^Alawla TV', r'alawla\.tv'),
 ('MBC العراق', 'iq', 'ent', 'mbc', 'iq', r'^MBC Iraq', r'edgenextcdn\.net'),
 # religious
 ('قناة الإمام الحسين (ع)', 'iq', 'quran', 'karbala', 'iq', r'^Imam Hussein TV 2 \(1080p\)$', r'ar\.imamhossaintv\.com'),
 ('قناة المرجعيات', 'iq', 'quran', '', 'iq', r'^Marjaeyat TV Arabic', r'marjaeyattv\.com'),
 ('الأئمة', 'iq', 'quran', '', 'iq', r'^Al-Aimma TV', r'alaimma\.tv'),
 ('العباسية', 'iq', 'quran', 'karbala', 'iq', r'^Alabbassia TV', r'alabbassia\.com'),
 ('بيت العباس', 'iq', 'quran', 'karbala', 'iq', r'^BeitolAbbas TV', r'beitolabbas\.tv'),
 ('القرآن الكريم (السعودية)', 'sa', 'quran', '', 'sa', r'^Al Quran Al Kareem TV \(720p\)', r'live\.net\.sa'),
 ('تلفزيون قطر القرآن', 'qa', 'quran', '', 'qa', r'^Qatar TV The Holy Quran', r'qatartv\.akamaized\.net'),
 ('اقرأ القرآن', 'sa', 'quran', '', 'sa', r'^Iqraa Quran', r'fasttvcdn\.com'),
 ('البحرين القرآن', 'bh', 'quran', '', 'bh', r'^Bahrain Quran', r'streamlock\.net'),
 # sport
 ('الكويت الرياضية', 'kw', 'sport', '', 'kw', r'^KTV Sport \(1080p\)', r'mangomolo\.com'),
 ('الكويت الرياضية بلس', 'kw', 'sport', '', 'kw', r'^KTV Sport Plus', r'mangomolo\.com'),
 ('عُمان الرياضية', 'om', 'sport', '', 'om', r'^Oman Sports TV', r'mgmlcdn\.com'),
 ('البحرين الرياضية 1', 'bh', 'sport', '', 'bh', r'^Bahrain Sports 1', r'streamlock\.net'),
 ('البحرين الرياضية 2', 'bh', 'sport', '', 'bh', r'^Bahrain Sports 2', r'streamlock\.net'),
 # MBC free package
 ('MBC 1', 'ae', 'ent', 'mbc', 'ae', r'^MBC 1 \(1080p\)', r'edgenextcdn\.net'),
 ('MBC 4', 'ae', 'ent', 'mbc', 'ae', r'^MBC 4 \(1080p\)', r'edgenextcdn\.net'),
 ('MBC 5', 'ae', 'ent', 'mbc', 'ae', r'^MBC 5 \(1080p\)', r'edgenextcdn\.net'),
 ('MBC دراما', 'ae', 'movies', 'mbc', 'ae', r'^MBC Drama \(1080p\)', r'edgenextcdn\.net'),
 ('MBC مود', 'ae', 'ent', 'mbc', 'ae', r'^MBC Mood', r'edgenextcdn\.net'),
 ('MBC مصر', 'eg', 'ent', 'mbc', 'eg', r'^MBC Masr \(1080p\)', r'edgenextcdn\.net'),
 ('MBC مصر 2', 'eg', 'ent', 'mbc', 'eg', r'^MBC Masr 2', r'edgenextcdn\.net'),
 ('MBC مصر دراما', 'eg', 'movies', 'mbc', 'sa', r'^MBC Masr Drama', r'edgenextcdn\.net'),
 # movies & series (free)
 ('أفلام', 'sa', 'movies', '', 'sa', r'^Aflam', r'edgenextcdn\.net'),
 ('أفلام أكشن', 'sa', 'movies', '', 'sa', r'^Movies Action', r'edgenextcdn\.net'),
 ('أفلام إثارة', 'sa', 'movies', '', 'sa', r'^Movies Thriller', r'edgenextcdn\.net'),
 ('مسلسلات أردنية', 'jo', 'movies', '', 'jo', r'^Jordan Drama', r'fasttvcdn\.com'),
 ('كوميديا أردنية', 'jo', 'movies', '', 'jo', r'^Jordan Comedy', r'fasttvcdn\.com'),
 ('سبيستون', 'ae', 'kids', '', 'ae', r'^Spacetoon Arabic', r'spacetoongo\.com'),
 ('أطفال ومواهب', 'sa', 'kids', '', 'sa', r'^Atfal & Mawaheb', r'streamlock\.net'),
 # kids from official broadcasters and free platforms (foreign too)
 ('تي آر تي تشوجوك', 'int', 'kids', '', 'tr', r'^TRT Cocuk', r'trt\.com\.tr'),
 ('تي آر تي ديانت تشوجوك', 'int', 'kids', '', 'tr', r'^TRT Diyanet', r'trt\.com\.tr'),
 ('بي بي إس كيدز', 'int', 'kids', '', 'us', r'^PBS Kids \(720p\)$', r'pbskids\.org'),
 ('كيكا الألمانية', 'int', 'kids', '', 'de', r'^KiKA \(1080p\) \[Not 24/7\]', r'kikahls\.akamaized\.net'),
 ('أو آر إف كيدز', 'int', 'kids', '', 'at', r'^ORF Kids', r'mdn\.ors\.at'),
 ('كاروسيل الروسية', 'int', 'kids', '', 'ru', r'^Carousel \(576p\)$', r'smotrim\.ru'),
 ('سنافر TV', 'int', 'kids', '', 'us', r'^Smurf TV', r'ottera\.tv'),
 ('تون غوغلز', 'int', 'kids', '', 'us', r'^ToonGoggles', r'cloudfront\.net'),
 ('بيبي فيرست', 'int', 'kids', '', 'us', r'^BabyFirst \(720p\)', r'jwp\.services'),
 ('كرتون كلاسيك', 'int', 'kids', '', 'us', r'^MeTV Toons', r'akamaized\.net'),
 # documentaries
 ('الجزيرة الوثائقية', 'qa', 'docs', '', 'qa', r'^Al Jazeera Documentary', r'getaj\.net'),
 # Karbala package (the shrines' own channels)
 ('كربلاء الوثائقية', 'iq', 'docs', 'karbala', 'iq', r'^Karbala Documentary', r'ktvlive\.online'),
 ('القرآن الكريم · كربلاء', 'iq', 'quran', 'karbala', 'iq', r'^Alquran', r'ktvlive\.online'),
 ('الإمام الحسين (ع) · فارسي', 'iq', 'quran', 'karbala', 'iq', r'^Imam Hussein TV 1 \(1080p\)$', r'fa\.imamhossaintv\.com'),
 ('الإمام الحسين (ع) · إنجليزي', 'iq', 'quran', 'karbala', 'iq', r'^Imam Hussein TV 3 \(1080p\)$', r'en\.imamhossaintv\.com'),
 ('الإمام الحسين (ع) · أردو', 'iq', 'quran', 'karbala', 'iq', r'^Imam Hussein TV 4 \(1080p\)$', r'ur\.imamhossaintv\.com'),
 # general by country
 ('تلفزيون قطر', 'qa', 'ent', '', 'qa', r'^Qatar Television \(1080p\)', r'qatartv\.akamaized\.net'),
 ('الريان', 'qa', 'ent', '', 'qa', r'^Al Rayyan \(1080p\)', r'vidgyor\.com'),
 ('تلفزيون الكويت', 'kw', 'ent', '', 'kw', r'^KTV 1 \(1080p\)', r'mangomolo\.com'),
 ('تلفزيون الكويت 2', 'kw', 'ent', '', 'kw', r'^KTV 2 \(1080p\)', r'mangomolo\.com'),
 ('تلفزيون عُمان', 'om', 'ent', '', 'om', r'^Oman TV \(1080p\)', r'mgmlcdn\.com'),
 ('عُمان الثقافية', 'om', 'ent', '', 'om', r'^Oman Althakafia', r'mgmlcdn\.com'),
 ('السعودية', 'sa', 'ent', '', 'sa', r'^Al Saudiya \(1080p\)', r'edgenextcdn\.net'),
 ('التلفزيون الأردني', 'jo', 'ent', '', 'jo', r'^Jordan Satellite Channel', r'ercdn\.net'),
 ('تلفزيون لبنان', 'lb', 'ent', '', 'lb', r'^Tele Liban', r'catiacast'),
 ('تلفزيون البحرين', 'bh', 'ent', '', 'bh', r'^Bahrain TV', r'streamlock\.net'),
 ('الوطنية 1 التونسية', 'tn', 'ent', '', 'tn', r'^El Watania 1', r'tanitweb\.net'),
 ('تلفزيون الحصاد', 'tn', 'ent', '', 'tn', r'^Elyssa TV', r'elyssatv\.com'),
 ('ميدي 1 تيفي', 'ma', 'news', '', 'ma', r'^Medi 1 TV Arabic \(1080p\)$', r'easybroadcast'),
 ('الهداف الجزائرية', 'dz', 'sport', '', 'dz', r'^El-Heddaf', r'elheddaftv\.com'),
]
GROUPS = [('iq', 'العراق'), ('sa', 'السعودية'), ('ae', 'الإمارات'), ('qa', 'قطر'), ('kw', 'الكويت'), ('om', 'عُمان'), ('bh', 'البحرين'), ('jo', 'الأردن'), ('lb', 'لبنان'), ('eg', 'مصر'), ('ma', 'المغرب'), ('dz', 'الجزائر'), ('tn', 'تونس'), ('ly', 'ليبيا'), ('int', 'دولية')]
logos = {}
if os.path.exists(LOGOS):
    for r in csv.DictReader(open(LOGOS, encoding='utf-8')):
        if r['format'] in ('PNG', 'JPEG', 'WebP') and not r['feed']:
            w = int(r['width'] or 0)
            if r['channel'] not in logos or (w <= 1200 and w > logos[r['channel']][0]): logos[r['channel']] = (w, r['url'])
cache = {}; out = []; miss = []; lg = {}
for ar, grp, cat, pk, f, nre, hre in T:
    if f not in cache: cache[f] = read(f)
    pick = None
    for n, u, hd, cid in cache[f]:
        if re.search(nre, n) and re.search(hre, u): pick = (u, cid, hd); break
    if not pick: miss.append(ar); continue
    o = {'n': ar, 'c': grp, 'g': cat, 'u': pick[0]}
    if pk: o['p'] = pk
    o.update(pick[2])
    cid = re.sub(r'[^A-Za-z0-9._-]', '', pick[1])
    if cid and cid in logos: o['i'] = cid; lg[cid] = logos[cid][1]
    out.append(o)
js = '/* free channels from the broadcasters\' own streams (built by tools/build_channels.py) */\nwindow.CH_GROUPS = ' + json.dumps(GROUPS, ensure_ascii=False) + ';\nwindow.CHANNELS = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('},{', '},\n{') + ';\n'
dst = sys.argv[1] if len(sys.argv) > 1 else 'CleanTV/app/src/main/assets/channels.js'
open(dst, 'w', encoding='utf-8').write(js)
json.dump(lg, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'channel_logos.json'), 'w'), indent=0)
print(len(out), 'channels,', len(lg), 'logos; missing:', miss)
