// Religion and sect: what the launcher (and its screensaver) shows. Runs after data.js, before app.js.
// settings.faith = { rel: 'muslim' | 'christian' | 'sabian' | 'none', sect: 'shia' | 'sunni' }
(function () {
  'use strict';
  var S = {};
  try {
    if (/[?&]preview=1/.test(location.search) && window.parent && window.parent.__PREVIEW_DATA && window.parent.__PREVIEW_DATA.cfg) S = window.parent.__PREVIEW_DATA.cfg.settings || {};
    else S = JSON.parse(localStorage.getItem('settings') || '{}') || {};
  } catch (e) { S = {}; }
  var f = S.faith || {}, rel = f.rel || 'muslim', sect = f.sect || 'shia';
  window.FAITH = { rel: rel, sect: sect, muslim: rel === 'muslim', shia: rel === 'muslim' && sect === 'shia' };
  window.GREG_OCC = [];

  var SAYINGS = [
    ['الصبر مفتاح الفرج', 'حكمة', 'saying'], ['من جدّ وجد، ومن زرع حصد', 'حكمة', 'saying'], ['خير الأمور أوسطها', 'حكمة', 'saying'],
    ['الوقت كالسيف إن لم تقطعه قطعك', 'حكمة', 'saying'], ['ربّ أخٍ لك لم تلده أمك', 'حكمة', 'saying'], ['العلم نور', 'حكمة', 'saying'],
    ['اللسان الطيب يكسب القلوب', 'حكمة', 'saying'], ['من سار على الدرب وصل', 'حكمة', 'saying']
  ];

  if (rel === 'muslim' && sect === 'sunni') {
    window.OCCASIONS = [
      [1, 1, 'رأس السنة الهجرية', 'eid'], [1, 10, 'يوم عاشوراء (صيام)', 'other'], [3, 12, 'المولد النبوي الشريف', 'birth'], [7, 27, 'الإسراء والمعراج', 'other'],
      [8, 15, 'ليلة النصف من شعبان', 'other'], [9, 1, 'بداية شهر رمضان المبارك', 'eid'], [9, 27, 'ليلة السابع والعشرين من رمضان', 'other'],
      [10, 1, 'عيد الفطر المبارك', 'eid'], [12, 9, 'يوم عرفة', 'other'], [12, 10, 'عيد الأضحى المبارك', 'eid']
    ];
    window.BIG_EVENTS = [[1, 1, 'رأس السنة الهجرية'], [3, 12, 'المولد النبوي الشريف'], [7, 27, 'الإسراء والمعراج'], [9, 1, 'شهر رمضان المبارك'], [10, 1, 'عيد الفطر'], [12, 9, 'يوم عرفة'], [12, 10, 'عيد الأضحى']];
    window.WISDOM = (window.WISDOM || []).filter(function (w) { return w[2] === 'ayah' || /النبي|رسول/.test(w[1] || ''); });
    window.ACTS_WEEKDAY = { 5: 'يوم الجمعة: سورة الكهف والإكثار من الصلاة على النبي ﷺ' };
    window.ACTS_HIJRI = { '1-10': 'صيام يوم عاشوراء', '12-9': 'صيام يوم عرفة' };
    window.ACTS_MONTH = { 9: 'شهر رمضان: الصيام والقيام وتلاوة القرآن' };
  } else if (rel === 'christian') {
    window.OCCASIONS = []; window.BIG_EVENTS = []; window.ACTS_WEEKDAY = {}; window.ACTS_HIJRI = {}; window.ACTS_MONTH = {};
    window.WISDOM = [
      ['اَلرَّبُّ رَاعِيَّ فَلاَ يُعْوِزُنِي شَيْءٌ', 'مزمور ٢٣: ١', 'verse'], ['اَللهُ مَحَبَّةٌ', 'رسالة يوحنا الأولى ٤: ٨', 'verse'],
      ['تَعَالَوْا إِلَيَّ يَا جَمِيعَ الْمُتْعَبِينَ وَالثَّقِيلِي الأَحْمَالِ، وَأَنَا أُرِيحُكُمْ', 'إنجيل متى ١١: ٢٨', 'verse'],
      ['طُوبَى لِصَانِعِي السَّلاَمِ، لأَنَّهُمْ أَبْنَاءَ اللهِ يُدْعَوْنَ', 'إنجيل متى ٥: ٩', 'verse'], ['أَنَا هُوَ الطَّرِيقُ وَالْحَقُّ وَالْحَيَاةُ', 'إنجيل يوحنا ١٤: ٦', 'verse'],
      ['أَسْتَطِيعُ كُلَّ شَيْءٍ فِي الْمَسِيحِ الَّذِي يُقَوِّينِي', 'رسالة فيلبي ٤: ١٣', 'verse'], ['الْمَحَبَّةُ تَتَأَنَّى وَتَرْفُقُ', 'كورنثوس الأولى ١٣: ٤', 'verse'],
      ['سَلاَمًا أَتْرُكُ لَكُمْ. سَلاَمِي أُعْطِيكُمْ', 'إنجيل يوحنا ١٤: ٢٧', 'verse'], ['أَنَا هُوَ نُورُ الْعَالَمِ', 'إنجيل يوحنا ٨: ١٢', 'verse'], ['أَحِبُّوا أَعْدَاءَكُمْ', 'إنجيل متى ٥: ٤٤', 'verse']
    ];
    // feasts on the Gregorian calendar (Easter by the Western computus, as most Iraqi churches keep it)
    var easter = function (y) {
      var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, g = Math.floor((8 * b + 13) / 25), h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 19 * l) / 433), mo = Math.floor((h + l - 7 * m + 90) / 25), da = (h + l - 7 * m + 33 * mo + 19) % 32;
      return Date.UTC(y, mo - 1, da, 9);
    };
    var y0 = new Date().getUTCFullYear(), out = [];
    [y0, y0 + 1].forEach(function (y) {
      var E = easter(y), D = 86400000;
      out.push([Date.UTC(y, 0, 1, 9), 'رأس السنة الميلادية', 'eid'], [Date.UTC(y, 0, 6, 9), 'عيد الدنح (الغطاس)', 'other'], [E - 7 * D, 'أحد الشعانين', 'other'],
        [E - 2 * D, 'الجمعة العظيمة', 'martyr'], [E, 'عيد القيامة المجيد', 'eid'], [E + 39 * D, 'عيد الصعود', 'other'], [E + 49 * D, 'عيد العنصرة', 'other'],
        [Date.UTC(y, 7, 15, 9), 'عيد انتقال العذراء', 'other'], [Date.UTC(y, 8, 14, 9), 'عيد الصليب', 'other'], [Date.UTC(y, 11, 25, 9), 'عيد الميلاد المجيد', 'eid']);
    });
    window.GREG_OCC = out.map(function (o) { return { date: new Date(o[0]), name: o[1], kind: o[2], big: o[2] === 'eid' }; });
  } else if (rel === 'sabian') {
    window.OCCASIONS = []; window.BIG_EVENTS = []; window.ACTS_WEEKDAY = {}; window.ACTS_HIJRI = {}; window.ACTS_MONTH = {};
    window.WISDOM = [['بشميهون اد هيي ربي', 'بأسماء الحي العظيم', 'verse']].concat(SAYINGS);
  } else if (rel === 'none') {
    window.WISDOM = SAYINGS.concat((window.WISDOM || []).filter(function (w) { return w[2] !== 'ayah'; }).slice(0, 0));
  }
})();
