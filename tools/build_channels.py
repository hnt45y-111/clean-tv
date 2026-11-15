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
 # added on request (third-party hosted ones included: the owner chose them)
 ('الجزيرة 2', 'qa', 'news', '', 'qa', r'^Al Jazeera 2 \(1080p\)', r'thehlive\.com'),
 ('الجزيرة مباشر 24', 'qa', 'news', '', 'qa', r'^Al Jazeera Mubasher 24', r'getaj\.net'),
 ('الجزيرة مباشر 2', 'qa', 'news', '', 'qa', r'^Al Jazeera Mubasher Broadcast 2', r'getaj\.net'),
 ('المشهد', 'ae', 'news', '', 'ae', r'^Al Mashhad', r'amagi\.tv'),
 ('العربي', 'qa', 'news', '', 'qa', r'^Al Araby TV \(1080p\)', r'kwikmotion\.com'),
 ('العربي 2', 'qa', 'news', '', 'qa', r'^Al Araby TV 2', r'kwikmotion\.com'),
 ('الشرقية نيوز', 'iq', 'news', '', 'iq', r'^Al Sharqiya News', r'indexforce\.com'),
 ('الشرق ديسكفري', 'sa', 'docs', '', 'sa', r'^Asharq Discovery', r'itworkscdn\.net'),
 ('الشرق الوثائقية', 'sa', 'docs', '', 'sa', r'^Asharq Documentary', r'itworkscdn\.net'),
 ('السعودية الثقافية', 'sa', 'docs', '', 'sa', r'^Saudi Thaqafiya', r'edgenextcdn\.net'),
 ('فلسطين التعليمية', 'ps', 'docs', '', 'ps', r'^Palestine Edu', r'furrera\.ps'),
 ('كربلاء الوثائقية', 'iq', 'docs', 'karbala', 'iq', r'^Karbala Documentary', r'ktvlive\.online'),
 ('روتانا سينما', 'sa', 'movies', '', 'sa', r'^Rotana Cinema KSA', r'hibridcdn\.net'),
 ('روتانا كلاسيك', 'sa', 'ent', '', 'sa', r'^Rotana Classic', r'hibridcdn\.net'),
 ('روتانا كوميدي', 'sa', 'ent', '', 'sa', r'^Rotana Comedy', r'hibridcdn\.net'),
 ('روتانا دراما', 'sa', 'movies', '', 'sa', r'^Rotana Drama', r'hibridcdn\.net'),
 ('روتانا خليجية', 'sa', 'ent', '', 'sa', r'^Rotana Khalijia', r'hibridcdn\.net'),
 ('روتانا كليب', 'sa', 'ent', '', 'sa', r'^Rotana Clip', r'hibridcdn\.net'),
 ('روتانا موسيقى', 'sa', 'ent', '', 'sa', r'^Rotana Music', r'hibridcdn\.net'),
 ('باب الحارة', 'sa', 'movies', '', 'sa', r'^Bab Al Hara', r'edgenextcdn\.net'),
 ('مرايا', 'sa', 'movies', '', 'sa', r'^Maraya', r'edgenextcdn\.net'),
 ('فيروز', 'sa', 'ent', '', 'sa', r'^Fairuz', r'edgenextcdn\.net'),
 ('طرب', 'sa', 'ent', '', 'sa', r'^Tarab', r'edgenextcdn\.net'),
 ('بيغ تايم بلس', 'sa', 'ent', '', 'sa', r'^Big Time Plus', r'edgenextcdn\.net'),
 # all the rest of the requested Arab channels (own hosts and third-party hosts; no numeric-address restreams)
 ('العربية للأعمال', 'ae', 'news', '', 'ae', r'^Al Arabiya Business', r'alarabiya\.net'),
 ('العربية برامج', 'ae', 'ent', '', 'ae', r'^Al Arabiya Programs', r'alarabiya\.net'),
 ('CNBC عربية', 'ae', 'news', '', 'ae', r'^CNBC Arabiya', r'cnbc-live'),
 ('تلفزيون سوريا', 'sy', 'news', '', 'sy', r'^Syria TV', r'kwikmotion\.com'),
 ('سوريا الثانية', 'sy', 'ent', '', 'sy', r'^Althania', r'kwikmotion\.com'),
 ('سوريا', 'sy', 'ent', '', 'sy', r'^Al-Souriya TV', r'edgenextcdn\.net'),
 ('حلب اليوم', 'sy', 'news', '', 'sy', r'^Halab Today', r'mncdn\.com'),
 ('ليبيا الوطنية', 'ly', 'news', '', 'ly', r'^Libya Al Wataniya', r'akamaized\.net'),
 ('الأحرار الليبية', 'ly', 'news', '', 'qa', r'^Libya Al Ahrar', r'castr\.net'),
 ('المسار', 'ly', 'ent', '', 'ly', r'^Al Masar TV', r'starmenajo\.com'),
 ('المسيرة', 'ye', 'news', '', 'ye', r'^Al Masirah \(', r'cdnbridge\.tv'),
 ('المسيرة مباشر', 'ye', 'news', '', 'ye', r'^Al Masirah Mubacher', r'cdnbridge\.tv'),
 ('الساحات', 'ye', 'ent', '', 'ye', r'^Al-Sahat TV', r'assahat\.b-cdn\.net'),
 ('اليمن اليوم', 'ye', 'news', '', 'ye', r'^Yemen Today', r'yementdy\.tv'),
 ('صحراء 24', 'mr', 'news', '', 'mr', r'^Sahara 24', r'saharamedias\.net'),
 ('تلفزيون السودان', 'sd', 'ent', '', 'sd', r'^Sudan TV', r'akamaized\.net'),
 ('دبنقا', 'sd', 'news', '', 'sd', r'^Dabanga TV', r'dabangasudan\.org'),
 ('التلفزيون الصومالي', 'so', 'ent', '', 'so', r'^Somali National TV', r'iqplay\.tv'),
 ('السنة النبوية', 'sa', 'quran', '', 'sa', r'^Al Sunnah Al Nabawiyah', r'live\.net\.sa'),
 ('مكة', 'sa', 'quran', '', 'sa', r'^Makkah TV', r'streambrothers\.com'),
 ('اقرأ', 'sa', 'quran', '', 'sa', r'^Iqraa Arabic', r'fasttvcdn\.com'),
 ('اقرأ أفريقيا وأوروبا', 'sa', 'quran', '', 'sa', r'^Iqraa Africa', r'fasttvcdn\.com'),
 ('الرسالة', 'sa', 'quran', '', 'sa', r'^Al Resalah', r'hibridcdn\.net'),
 ('نور TV', 'ae', 'quran', '', 'ae', r'^Nour TV', r'bestream\.io'),
 ('نورسات', 'lb', 'quran', '', 'lb', r'^NourSAT', r'itworkscdn\.net'),
 ('نور الشرق', 'lb', 'quran', '', 'lb', r'^Nour Al Sharq', r'itworkscdn\.net'),
 ('نور الشباب', 'lb', 'quran', '', 'lb', r'^Nour El Shabeb', r'itworkscdn\.net'),
 ('نور مريم', 'lb', 'quran', '', 'lb', r'^Nour Mariam', r'itworkscdn\.net'),
 ('نور القداس', 'lb', 'quran', '', 'lb', r'^Nour Al Koddas', r'itworkscdn\.net'),
 ('الإيمان', 'lb', 'quran', '', 'lb', r'^Aliman TV', r'itworkscdn\.net'),
 ('الهدى', 'eg', 'quran', '', 'eg', r'^Huda TV', r'bestream\.io'),
 ('أغابي', 'eg', 'ent', '', 'eg', r'^Aghapy TV', r'streamlock\.net'),
 ('القبطية', 'eg', 'ent', '', 'eg', r'^Coptic TV', r'icopts\.app'),
 ('الإمام الحسين (ع) 5', 'iq', 'quran', 'karbala', 'iq', r'^Imam Hussein TV 5', r'al-zahratv\.com'),
 ('الإمام الحسين (ع) 6', 'iq', 'quran', 'karbala', 'iq', r'^Imam Hussein TV 6', r'imamhossaintv\.com'),
 ('المهدوية', 'iq', 'quran', '', 'iq', r'^MahdawiounTV', r'mahdawioun\.tv'),
 ('الغدير', 'iq', 'quran', '', 'iq', r'^Alghadeer TV', r'vodu\.store'),
 ('الجوادين', 'iq', 'quran', '', 'iq', r'^Al-Jawadain TV', r'aljawadain\.org'),
 ('دجلة', 'iq', 'ent', '', 'iq', r'^Dijlah TV', r'ghaasiflu\.online'),
 ('الجنوب', 'iq', 'ent', '', 'iq', r'^Al Janoub TV', r'alissahost\.net'),
 ('الرافدين', 'iq', 'ent', '', 'iq', r'^Al Rafidain', r'tvplayer\.online'),
 ('الرشيد', 'iq', 'ent', '', 'iq', r'^Al Rasheed TV', r'livaat\.com'),
 ('MBC مود', 'sa', 'ent', 'mbc', 'sa', r'^MBC Mood', r'edgenextcdn\.net'),
 ('MBC+ دراما', 'sa', 'movies', 'mbc', 'sa', r'^MBC\+ Drama', r'edgenextcdn\.net'),
 ('MTV لبنان', 'lb', 'ent', '', 'lb', r'^MTV Lebanon', r'edgenextcdn\.net'),
 ('OTV لبنان', 'lb', 'ent', '', 'lb', r'^OTV', r'hibridcdn\.net'),
 ('المستقبل', 'lb', 'ent', '', 'lb', r'^Future TV', r'kwikmotion\.com'),
 ('Red TV لبنان', 'lb', 'ent', '', 'lb', r'^Red TV Lebanon', r'kwikmotion\.com'),
 ('رويا', 'jo', 'ent', '', 'jo', r'^Roya TV', r'kwikmotion\.com'),
 ('عمان تي في', 'jo', 'ent', '', 'jo', r'^Amman TV', r'ercdn\.net'),
 ('التغيير', 'jo', 'ent', '', 'jo', r'^Altaghier TV', r'ercdn\.net'),
 ('الشارقة', 'ae', 'ent', '', 'ae', r'^Sharjah TV', r'kwikmotion\.com'),
 ('الشارقة 2', 'ae', 'ent', '', 'ae', r'^Sharjah 2', r'itworkscdn\.net'),
 ('عجمان', 'ae', 'ent', '', 'ae', r'^Ajman TV', r'logichost\.in'),
 ('الفجيرة', 'ae', 'ent', '', 'ae', r'^Fujairah TV', r'kwikmotion\.com'),
 ('KTV القرين', 'kw', 'ent', '', 'kw', r'^KTV Al Qurain', r'mangomolo\.com'),
 ('KTV عربي', 'kw', 'ent', '', 'kw', r'^KTV Arabe', r'mangomolo\.com'),
 ('KTV إثراء', 'kw', 'ent', '', 'kw', r'^KTV Ethraa', r'mangomolo\.com'),
 ('تلفزيون قطر 2', 'qa', 'ent', '', 'qa', r'^Qatar Television 2', r'kwikmotion\.com'),
 ('الريان القديم', 'qa', 'ent', '', 'qa', r'^Al Rayyan Al Qadeem', r'vidgyor\.com'),
 ('QBC', 'qa', 'ent', '', 'qa', r'^QBC', r'alkassdigital\.net'),
 ('شدى', 'ma', 'ent', '', 'ma', r'^Chada TV', r'infomaniak\.com'),
 ('ميدي 1 المغرب', 'ma', 'news', '', 'ma', r'^Medi 1 TV Maghreb', r'easybroadcast'),
 ('الوطنية 2 التونسية', 'tn', 'ent', '', 'tn', r'^El Watania 2', r'tanitweb\.net'),
 ('الغد', 'eg', 'news', '', 'eg', r'^Al Ghad TV', r'erbvr\.com'),
 ('الوطن', 'eg', 'ent', '', 'eg', r'^Watan TV', r'tactivemedia\.com'),
 ('كوجي', 'eg', 'ent', '', 'eg', r'^Koogi TV', r'streamlock\.net'),
 ('فلسطين الفضائية', 'ps', 'ent', '', 'ps', r'^Palestine Satellite Channel', r'furrera\.ps'),
 ('فلسطين مباشر', 'ps', 'news', '', 'ps', r'^Palestine Mubasher', r'furrera\.ps'),
 ('أجيال', 'ps', 'ent', '', 'ps', r'^Ajyal TV', r'mada\.ps'),
 ('معاً', 'ps', 'news', '', 'ps', r"^Ma'an TV", r'mada\.ps'),
 ('نابلس', 'ps', 'news', '', 'ps', r'^Nablus TV', r'mada\.ps'),
 ('سراج', 'ps', 'ent', '', 'ps', r'^Seraj TV', r'dvcloud\.tv'),
 ('وتر', 'ps', 'ent', '', 'ps', r'^Watar TV', r'mada\.ps'),
 ('الوطن الفلسطينية', 'ps', 'news', '', 'ps', r'^Wattan TV', r'mada\.ps'),
 ('كل الناس', 'ps', 'ent', '', 'ps', r'^Kolalnas TV', r'mada\.ps'),
 ('فلسطين اليوم', 'ps', 'news', '', 'ps', r'^Palestine Today', r'paltodaytv\.com'),
 ('راجين', 'ps', 'ent', '', 'ps', r'^Rajeen TV', r'mncdn\.com'),
 ('الكأس 1', 'qa', 'sport', '', 'ftv', r'^Alkass One', r'alkassdigital\.net'),
 ('الكأس 2', 'qa', 'sport', '', 'ftv', r'^Alkass Two', r'alkassdigital\.net'),
 ('الكأس 3', 'qa', 'sport', '', 'ftv', r'^Alkass Three', r'alkassdigital\.net'),
 ('الكأس 4', 'qa', 'sport', '', 'ftv', r'^Alkass Four', r'alkassdigital\.net'),
 ('دبي الرياضية 1', 'ae', 'sport', '', 'ftv', r'^Dubai Sports 1', r'mgmlcdn\.com'),
 ('دبي الرياضية 2', 'ae', 'sport', '', 'ftv', r'^Dubai Sports 2', r'mangomolo\.com'),
 ('دبي الرياضية 3', 'ae', 'sport', '', 'ftv', r'^Dubai Sports 3', r'mangomolo\.com'),
 ('أبوظبي الرياضية 1', 'ae', 'sport', '', 'ftv', r'^Abu Dhabi Sports 1', r'orange\.com'),
 ('أبوظبي الرياضية 2', 'ae', 'sport', '', 'ftv', r'^Abu Dhabi Sports 2', r'orange\.com'),
 ('الشارقة الرياضية', 'ae', 'sport', '', 'ae', r'^Sharjah Sports', r'itworkscdn\.net'),
 ('الأردن الرياضية', 'jo', 'sport', '', 'jo', r'^Jordan Sport', r'ercdn\.net'),
]
GROUPS = [('iq', 'العراق'), ('sa', 'السعودية'), ('ae', 'الإمارات'), ('qa', 'قطر'), ('kw', 'الكويت'), ('om', 'عُمان'), ('bh', 'البحرين'), ('jo', 'الأردن'), ('lb', 'لبنان'), ('ps', 'فلسطين'), ('sy', 'سوريا'), ('ye', 'اليمن'), ('sd', 'السودان'), ('mr', 'موريتانيا'), ('so', 'الصومال'), ('eg', 'مصر'), ('ma', 'المغرب'), ('dz', 'الجزائر'), ('tn', 'تونس'), ('ly', 'ليبيا'), ('int', 'دولية')]
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
