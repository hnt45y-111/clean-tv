/* Generated question bank: built at load time from translated tables (deterministic).
   Add rows to the tables below to grow the bank. Order of every field: ar|en|tr|fr|es */
(function () {
  var L = 5, rng = G.rng(20260101);
  var P = function (s) { return s.split('|'); };
  var out = function (c, d, t, a) { G.Q.push({ c: c, d: d, t: t, a: a }); };
  var tpl = function (a) { return a; };
  // answers: pick `correct` + 3 distractors (same index in every language)
  function mk(c, d, t, pool, ci, extra) { // pool: array of [ar,en,tr,fr,es]
    var idx = [], k = 0, ids = pool.map(function (_, i) { return i; }).filter(function (i) { return i !== ci; });
    ids = rng.shuffle(ids).slice(0, 3); var all = [ci].concat(ids);
    var a = []; for (var l = 0; l < L; l++) a.push(all.map(function (i) { return pool[i][l]; })); out(c, d, t, a);
  }
  var rep = function (arr, k, v) { return arr.map(function (s) { return s.replace(k, v); }); };
  function T(arr, k, vals) { return arr.map(function (s, l) { return s.replace(k, typeof vals === 'string' ? vals : vals[l]); }); }

  // ---------- countries: iso|ar|en|tr|fr|es|capAr|capEn|capTr|capFr|capEs|continent
  var CONT = [P('آسيا|Asia|Asya|Asie|Asia'), P('أوروبا|Europe|Avrupa|Europe|Europa'), P('أفريقيا|Africa|Afrika|Afrique|África'), P('أمريكا الشمالية|North America|Kuzey Amerika|Amérique du Nord|América del Norte'), P('أمريكا الجنوبية|South America|Güney Amerika|Amérique du Sud|América del Sur'), P('أوقيانوسيا|Oceania|Okyanusya|Océanie|Oceanía')];
  var CT = ['IQ|العراق|Iraq|Irak|Irak|Irak|بغداد|Baghdad|Bağdat|Bagdad|Bagdad|0', 'SA|السعودية|Saudi Arabia|Suudi Arabistan|Arabie saoudite|Arabia Saudita|الرياض|Riyadh|Riyad|Riyad|Riad|0',
    'EG|مصر|Egypt|Mısır|Égypte|Egipto|القاهرة|Cairo|Kahire|Le Caire|El Cairo|2', 'FR|فرنسا|France|Fransa|France|Francia|باريس|Paris|Paris|Paris|París|1', 'TR|تركيا|Turkey|Türkiye|Turquie|Turquía|أنقرة|Ankara|Ankara|Ankara|Ankara|0',
    'ES|إسبانيا|Spain|İspanya|Espagne|España|مدريد|Madrid|Madrid|Madrid|Madrid|1', 'IT|إيطاليا|Italy|İtalya|Italie|Italia|روما|Rome|Roma|Rome|Roma|1', 'DE|ألمانيا|Germany|Almanya|Allemagne|Alemania|برلين|Berlin|Berlin|Berlin|Berlín|1',
    'US|أمريكا|United States|ABD|États-Unis|Estados Unidos|واشنطن|Washington D.C.|Washington|Washington|Washington D. C.|3', 'BR|البرازيل|Brazil|Brezilya|Brésil|Brasil|برازيليا|Brasília|Brasília|Brasília|Brasilia|4',
    'JP|اليابان|Japan|Japonya|Japon|Japón|طوكيو|Tokyo|Tokyo|Tokyo|Tokio|0', 'CN|الصين|China|Çin|Chine|China|بكين|Beijing|Pekin|Pékin|Pekín|0', 'RU|روسيا|Russia|Rusya|Russie|Rusia|موسكو|Moscow|Moskova|Moscou|Moscú|1', 'GB|بريطانيا|United Kingdom|Birleşik Krallık|Royaume-Uni|Reino Unido|لندن|London|Londra|Londres|Londres|1',
    'AR|الأرجنتين|Argentina|Arjantin|Argentine|Argentina|بوينس آيرس|Buenos Aires|Buenos Aires|Buenos Aires|Buenos Aires|4', 'IN|الهند|India|Hindistan|Inde|India|نيودلهي|New Delhi|Yeni Delhi|New Delhi|Nueva Delhi|0', 'CA|كندا|Canada|Kanada|Canada|Canadá|أوتاوا|Ottawa|Ottawa|Ottawa|Ottawa|3', 'AU|أستراليا|Australia|Avustralya|Australie|Australia|كانبرا|Canberra|Kanberra|Canberra|Canberra|5',
    'MA|المغرب|Morocco|Fas|Maroc|Marruecos|الرباط|Rabat|Rabat|Rabat|Rabat|2', 'JO|الأردن|Jordan|Ürdün|Jordanie|Jordania|عمّان|Amman|Amman|Amman|Amán|0',
    'SY|سوريا|Syria|Suriye|Syrie|Siria|دمشق|Damascus|Şam|Damas|Damasco|0', 'LB|لبنان|Lebanon|Lübnan|Liban|Líbano|بيروت|Beirut|Beyrut|Beyrouth|Beirut|0', 'KW|الكويت|Kuwait|Kuveyt|Koweït|Kuwait|مدينة الكويت|Kuwait City|Kuveyt|Koweït|Kuwait|0', 'QA|قطر|Qatar|Katar|Qatar|Catar|الدوحة|Doha|Doha|Doha|Doha|0',
    'AE|الإمارات|UAE|BAE|Émirats arabes unis|Emiratos Árabes Unidos|أبوظبي|Abu Dhabi|Abu Dabi|Abou Dhabi|Abu Dabi|0', 'OM|عُمان|Oman|Umman|Oman|Omán|مسقط|Muscat|Maskat|Mascate|Mascate|0', 'YE|اليمن|Yemen|Yemen|Yémen|Yemen|صنعاء|Sanaa|Sana|Sanaa|Saná|0', 'DZ|الجزائر|Algeria|Cezayir|Algérie|Argelia|الجزائر|Algiers|Cezayir|Alger|Argel|2',
    'TN|تونس|Tunisia|Tunus|Tunisie|Túnez|تونس|Tunis|Tunus|Tunis|Túnez|2', 'LY|ليبيا|Libya|Libya|Libye|Libia|طرابلس|Tripoli|Trablus|Tripoli|Trípoli|2', 'SD|السودان|Sudan|Sudan|Soudan|Sudán|الخرطوم|Khartoum|Hartum|Khartoum|Jartum|2', 'IR|إيران|Iran|İran|Iran|Irán|طهران|Tehran|Tahran|Téhéran|Teherán|0',
    'PT|البرتغال|Portugal|Portekiz|Portugal|Portugal|لشبونة|Lisbon|Lizbon|Lisbonne|Lisboa|1', 'NL|هولندا|Netherlands|Hollanda|Pays-Bas|Países Bajos|أمستردام|Amsterdam|Amsterdam|Amsterdam|Ámsterdam|1', 'BE|بلجيكا|Belgium|Belçika|Belgique|Bélgica|بروكسل|Brussels|Brüksel|Bruxelles|Bruselas|1', 'GR|اليونان|Greece|Yunanistan|Grèce|Grecia|أثينا|Athens|Atina|Athènes|Atenas|1',
    'SE|السويد|Sweden|İsveç|Suède|Suecia|ستوكهولم|Stockholm|Stockholm|Stockholm|Estocolmo|1', 'CH|سويسرا|Switzerland|İsviçre|Suisse|Suiza|برن|Bern|Bern|Berne|Berna|1', 'AT|النمسا|Austria|Avusturya|Autriche|Austria|فيينا|Vienna|Viyana|Vienne|Viena|1', 'PL|بولندا|Poland|Polonya|Pologne|Polonia|وارسو|Warsaw|Varşova|Varsovie|Varsovia|1', 'NO|النرويج|Norway|Norveç|Norvège|Noruega|أوسلو|Oslo|Oslo|Oslo|Oslo|1',
    'MX|المكسيك|Mexico|Meksika|Mexique|México|مكسيكو سيتي|Mexico City|Meksiko|Mexico|Ciudad de México|3', 'CU|كوبا|Cuba|Küba|Cuba|Cuba|هافانا|Havana|Havana|La Havane|La Habana|3', 'CL|تشيلي|Chile|Şili|Chili|Chile|سانتياغو|Santiago|Santiago|Santiago|Santiago|4', 'CO|كولومبيا|Colombia|Kolombiya|Colombie|Colombia|بوغوتا|Bogotá|Bogota|Bogota|Bogotá|4', 'PE|بيرو|Peru|Peru|Pérou|Perú|ليما|Lima|Lima|Lima|Lima|4', 'UY|أوروغواي|Uruguay|Uruguay|Uruguay|Uruguay|مونتيفيديو|Montevideo|Montevideo|Montevideo|Montevideo|4',
    'KR|كوريا الجنوبية|South Korea|Güney Kore|Corée du Sud|Corea del Sur|سيول|Seoul|Seul|Séoul|Seúl|0', 'PK|باكستان|Pakistan|Pakistan|Pakistan|Pakistán|إسلام آباد|Islamabad|İslamabad|Islamabad|Islamabad|0', 'ID|إندونيسيا|Indonesia|Endonezya|Indonésie|Indonesia|جاكرتا|Jakarta|Cakarta|Jakarta|Yakarta|0', 'NZ|نيوزيلندا|New Zealand|Yeni Zelanda|Nouvelle-Zélande|Nueva Zelanda|ويلينغتون|Wellington|Wellington|Wellington|Wellington|5',
    'NG|نيجيريا|Nigeria|Nijerya|Nigéria|Nigeria|أبوجا|Abuja|Abuja|Abuja|Abuya|2', 'ZA|جنوب أفريقيا|South Africa|Güney Afrika|Afrique du Sud|Sudáfrica|بريتوريا|Pretoria|Pretoria|Pretoria|Pretoria|2', 'KE|كينيا|Kenya|Kenya|Kenya|Kenia|نيروبي|Nairobi|Nairobi|Nairobi|Nairobi|2', 'ET|إثيوبيا|Ethiopia|Etiyopya|Éthiopie|Etiopía|أديس أبابا|Addis Ababa|Addis Ababa|Addis-Abeba|Adís Abeba|2', 'SN|السنغال|Senegal|Senegal|Sénégal|Senegal|داكار|Dakar|Dakar|Dakar|Dakar|2', 'GH|غانا|Ghana|Gana|Ghana|Ghana|أكرا|Accra|Akra|Accra|Acra|2'].map(function (r) { var f = r.split('|'); return { iso: f[0], n: f.slice(1, 6), c: f.slice(6, 11), k: +f[11] }; });
  var flag = function (iso) { return String.fromCodePoint(iso.charCodeAt(0) + 127397, iso.charCodeAt(1) + 127397); };
  var dOf = function (i) { return i < 20 ? 1 : i < 40 ? 2 : 3; };
  var names = CT.map(function (c) { return c.n; }), caps = CT.map(function (c) { return c.c; });
  var Qcap = P('ما هي عاصمة {x}؟|What is the capital of {x}?|{x} ülkesinin başkenti neresidir?|{x} : quelle est sa capitale ?|{x}: ¿cuál es su capital?');
  var Qrev = P('{x} هي عاصمة أي دولة؟|{x} is the capital of which country?|{x} hangi ülkenin başkentidir?|{x} est la capitale de quel pays ?|¿De qué país es capital {x}?');
  var Qflag = P('علم أي دولة هذا؟ {x}|Which country’s flag is this? {x}|Bu hangi ülkenin bayrağı? {x}|C’est le drapeau de quel pays ? {x}|¿De qué país es esta bandera? {x}');
  var Qcont = P('في أي قارة تقع {x}؟|Which continent is {x} in?|{x} hangi kıtadadır?|{x} : dans quel continent ?|¿En qué continente está {x}?');
  CT.forEach(function (c, i) {
    mk('geo', dOf(i), T(Qcap, '{x}', c.n), caps, i);
    mk('geo', Math.min(3, dOf(i) + 1), T(Qrev, '{x}', c.c), names, i);
    mk('geo', dOf(i), T(Qflag, '{x}', flag(c.iso)), names, i);
    var ci = c.k, cp = CONT.slice(); var ids = rng.shuffle([0, 1, 2, 3, 4, 5].filter(function (z) { return z !== ci; })).slice(0, 3), all = [ci].concat(ids), a = [];
    for (var l = 0; l < L; l++) a.push(all.map(function (z) { return CONT[z][l]; })); out('geo', dOf(i), T(Qcont, '{x}', c.n), a);
  });
  var iso = {}; CT.forEach(function (c, i) { iso[c.iso] = i; });
  var ctry = function (codes) { return codes.map(function (c) { return names[iso[c]]; }); };

  // ---------- football
  var Qwin = P('من فاز بكأس العالم عام {x}؟|Who won the {x} World Cup?|{x} Dünya Kupası’nı kim kazandı?|Qui a gagné la Coupe du monde {x} ?|¿Quién ganó el Mundial de {x}?');
  var Qhost = P('أي بلد استضاف كأس العالم عام {x}؟|Which country hosted the {x} World Cup?|{x} Dünya Kupası’na hangi ülke ev sahipliği yaptı?|Quel pays a organisé la Coupe du monde {x} ?|¿Qué país organizó el Mundial de {x}?');
  var pool = ['BR', 'DE', 'IT', 'FR', 'AR', 'ES', 'UY', 'NL', 'PT', 'GB', 'BE'];
  [[1930, 'UY'], [1934, 'IT'], [1938, 'IT'], [1950, 'UY'], [1954, 'DE'], [1958, 'BR'], [1962, 'BR'], [1970, 'BR'], [1974, 'DE'], [1978, 'AR'], [1982, 'IT'], [1986, 'AR'], [1990, 'DE'], [1994, 'BR'], [1998, 'FR'], [2002, 'BR'], [2006, 'IT'], [2010, 'ES'], [2014, 'DE'], [2018, 'FR'], [2022, 'AR']].forEach(function (w) {
    var p = pool.slice(); var ci = p.indexOf(w[1]); mk('football', w[0] >= 1994 ? 2 : 3, T(Qwin, '{x}', '' + w[0]), ctry(p), ci); });
  [[1974, 'DE'], [1978, 'AR'], [1982, 'ES'], [1986, 'MX'], [1990, 'IT'], [1994, 'US'], [1998, 'FR'], [2006, 'DE'], [2010, 'ZA'], [2014, 'BR'], [2018, 'RU'], [2022, 'QA']].forEach(function (w) {
    var p = ['DE', 'AR', 'ES', 'MX', 'IT', 'US', 'FR', 'ZA', 'BR', 'RU', 'QA', 'JP']; mk('football', 2, T(Qhost, '{x}', '' + w[0]), ctry(p), p.indexOf(w[1])); });
  var Qpl = P('{x} من أي بلد؟|Which country is {x} from?|{x} hangi ülkeden?|{x} vient de quel pays ?|¿De qué país es {x}?');
  var PL = { 'Messi': 'AR', 'Maradona': 'AR', 'Cristiano Ronaldo': 'PT', 'Eusébio': 'PT', 'Neymar': 'BR', 'Pelé': 'BR', 'Ronaldinho': 'BR', 'Kaká': 'BR', 'Mbappé': 'FR', 'Zidane': 'FR', 'Benzema': 'FR', 'Platini': 'FR', 'Henry': 'FR', 'Salah': 'EG', 'Haaland': 'NO', 'Mahrez': 'DZ', 'Hakimi': 'MA', 'Son Heung-min': 'KR', 'Pirlo': 'IT', 'Buffon': 'IT', 'Totti': 'IT', 'Iniesta': 'ES', 'Xavi': 'ES', 'Casillas': 'ES', 'Cruyff': 'NL', 'Suárez': 'UY', 'Forlán': 'UY', 'Lewandowski': 'PL', 'Ibrahimović': 'SE', 'Beckenbauer': 'DE', 'Müller': 'DE', 'Younis Mahmoud': 'IQ', 'Ahmed Radhi': 'IQ', 'Hussein Saeed': 'IQ', 'Falcao': 'CO', 'Sánchez': 'CL' };
  var pn = { 'Younis Mahmoud': 'يونس محمود', 'Ahmed Radhi': 'أحمد راضي', 'Hussein Saeed': 'حسين سعيد', 'Messi': 'ميسي', 'Maradona': 'مارادونا', 'Cristiano Ronaldo': 'كريستيانو رونالدو', 'Neymar': 'نيمار', 'Pelé': 'بيليه', 'Mbappé': 'مبابي', 'Zidane': 'زيدان', 'Salah': 'محمد صلاح', 'Haaland': 'هالاند', 'Mahrez': 'محرز', 'Hakimi': 'حكيمي', 'Son Heung-min': 'سون هيونغ مين' };
  Object.keys(PL).forEach(function (p, k) {
    var pool2 = ['AR', 'BR', 'FR', 'PT', 'EG', 'IT', 'ES', 'NL', 'DE', 'IQ', 'UY', 'MA']; if (pool2.indexOf(PL[p]) < 0) pool2.push(PL[p]);
    var nm = [pn[p] || p, p, p, p, p]; mk('football', PL[p] === 'IQ' ? 1 : 2, T(Qpl, '{x}', nm), ctry(pool2), pool2.indexOf(PL[p])); });

  // ---------- chemistry
  var Qel = P('ما الرمز الكيميائي لعنصر {x}؟|What is the chemical symbol for {x}?|{x} elementinin sembolü nedir?|{x} : quel est son symbole chimique ?|¿Cuál es el símbolo químico de {x}?');
  var EL = ['H|الهيدروجين|Hydrogen|Hidrojen|Hydrogène|Hidrógeno', 'O|الأكسجين|Oxygen|Oksijen|Oxygène|Oxígeno', 'Au|الذهب|Gold|Altın|Or|Oro', 'Ag|الفضة|Silver|Gümüş|Argent|Plata', 'Fe|الحديد|Iron|Demir|Fer|Hierro', 'C|الكربون|Carbon|Karbon|Carbone|Carbono', 'Na|الصوديوم|Sodium|Sodyum|Sodium|Sodio', 'He|الهيليوم|Helium|Helyum|Hélium|Helio', 'Ca|الكالسيوم|Calcium|Kalsiyum|Calcium|Calcio', 'K|البوتاسيوم|Potassium|Potasyum|Potassium|Potasio', 'Cu|النحاس|Copper|Bakır|Cuivre|Cobre', 'Pb|الرصاص|Lead|Kurşun|Plomb|Plomo', 'N|النيتروجين|Nitrogen|Azot|Azote|Nitrógeno', 'Zn|الزنك|Zinc|Çinko|Zinc|Zinc', 'Ne|النيون|Neon|Neon|Néon|Neón', 'S|الكبريت|Sulfur|Kükürt|Soufre|Azufre', 'Hg|الزئبق|Mercury|Cıva|Mercure|Mercurio'].map(function (r) { var f = r.split('|'); return { s: f[0], n: f.slice(1) }; });
  var syms = EL.map(function (e) { return [e.s, e.s, e.s, e.s, e.s]; });
  EL.forEach(function (e, i) { mk('gen', e.s.length > 1 && i > 9 ? 3 : 2, T(Qel, '{x}', e.n), syms, i); });

  // ---------- planets & months
  var PLN = ['عطارد|Mercury|Merkür|Mercure|Mercurio', 'الزهرة|Venus|Venüs|Vénus|Venus', 'الأرض|Earth|Dünya|Terre|Tierra', 'المريخ|Mars|Mars|Mars|Marte', 'المشتري|Jupiter|Jüpiter|Jupiter|Júpiter', 'زحل|Saturn|Satürn|Saturne|Saturno', 'أورانوس|Uranus|Uranüs|Uranus|Urano', 'نبتون|Neptune|Neptün|Neptune|Neptuno'].map(P);
  var Qpn = P('ما هو الكوكب رقم {x} بُعداً عن الشمس؟|Which planet is number {x} from the Sun?|Güneş’ten itibaren {x}. gezegen hangisidir?|Quelle est la planète n°{x} à partir du Soleil ?|¿Qué planeta es el n.º {x} desde el Sol?');
  PLN.forEach(function (p, i) { mk('gen', 2, T(Qpn, '{x}', '' + (i + 1)), PLN, i); });
  var MO = [P('كانون الثاني|January|Ocak|janvier|enero'), P('شباط|February|Şubat|février|febrero'), P('آذار|March|Mart|mars|marzo'), P('نيسان|April|Nisan|avril|abril'), P('أيار|May|Mayıs|mai|mayo'), P('حزيران|June|Haziran|juin|junio'), P('تموز|July|Temmuz|juillet|julio'), P('آب|August|Ağustos|août|agosto'), P('أيلول|September|Eylül|septembre|septiembre'), P('تشرين الأول|October|Ekim|octobre|octubre'), P('تشرين الثاني|November|Kasım|novembre|noviembre'), P('كانون الأول|December|Aralık|décembre|diciembre')];
  var Qma = P('ما الشهر الذي يأتي بعد {x}؟|Which month comes after {x}?|{x} ayından sonra hangi ay gelir?|Quel mois vient après {x} ?|¿Qué mes viene después de {x}?');
  var Qmn = P('ما هو الشهر رقم {x} في السنة؟|What is month number {x} of the year?|Yılın {x}. ayı hangisidir?|Quel est le mois n°{x} de l’année ?|¿Cuál es el mes n.º {x} del año?');
  MO.forEach(function (m, i) { mk('gen', 1, T(Qma, '{x}', m), MO, (i + 1) % 12); mk('gen', 1, T(Qmn, '{x}', '' + (i + 1)), MO, i); });

  // ---------- food origin
  var Qd = P('{x} مشهور في أي بلد؟|Which country is famous for {x}?|{x} hangi ülkeyle ünlüdür?|{x} : de quel pays est-ce une spécialité ?|¿De qué país es típico {x}?');
  var FD = [['بيتزا|Pizza', 'IT'], ['سوشي|Sushi', 'JP'], ['تاكو|Tacos', 'MX'], ['باييا|Paella', 'ES'], ['بقلاوة|Baklava', 'TR'], ['كرواسان|Croissant', 'FR'], ['كاري|Curry', 'IN'], ['كيمتشي|Kimchi', 'KR'], ['موساكا|Moussaka', 'GR'], ['كشري|Koshari', 'EG'], ['طاجين|Tajine', 'MA'], ['رامن|Ramen', 'JP'], ['تشورّوس|Churros', 'ES'], ['لازانيا|Lasagna', 'IT'], ['المسگوف|Masgouf', 'IQ'], ['فيجوادا|Feijoada', 'BR'], ['سيفيتشي|Ceviche', 'PE'], ['أسادو|Asado', 'AR'], ['بيروجي|Pierogi', 'PL'], ['دم سم|Dim sum', 'CN'], ['فيش آند تشيبس|Fish and chips', 'GB'], ['كبسة|Kabsa', 'SA'], ['منسف|Mansaf', 'JO'], ['كنافة|Kunafa', 'LB'], ['برغر|Burger', 'US']];
  FD.forEach(function (f) { var nm = f[0].split('|'); var pool3 = ['IT', 'JP', 'MX', 'ES', 'TR', 'FR', 'IN', 'KR', 'EG', 'MA', 'BR', 'CN', 'GB', 'US', 'IQ', 'SA', 'JO', 'LB', 'GR', 'PE', 'AR', 'PL']; mk('food', f[1] === 'IQ' ? 1 : 2, T(Qd, '{x}', [nm[0], nm[1], nm[1], nm[1], nm[1]]), ctry(pool3), pool3.indexOf(f[1])); });

  // ---------- numbers (language-neutral prompts)
  for (var a = 3; a <= 14; a++) for (var b = a + 1; b <= 15; b += 4) {
    var r = a * b, w = [r]; [r + a, r - b, r + 10, r - 10, r + 1, r - 1].forEach(function (v) { if (w.length < 4 && w.indexOf(v) < 0) w.push(v); }); var q = ['', '', '', '', ''].map(function () { return a + ' × ' + b + ' = ؟'; }); q[1] = q[2] = q[3] = q[4] = a + ' × ' + b + ' = ?';
    out('math', a * b > 100 ? 3 : 2, q, [0, 1, 2, 3, 4].map(function () { return w.map(String); }));
  }
  [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225].forEach(function (n) { var r = Math.sqrt(n), qn = '√' + n + ' = ?'; out('math', n > 100 ? 3 : 2, [qn, qn, qn, qn, qn], [0, 1, 2, 3, 4].map(function () { return [r, r + 1, r + 2, r - 1].map(String); })); });
})();
