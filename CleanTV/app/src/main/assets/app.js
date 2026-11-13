(function () {
  'use strict';

  var TZ = 'Asia/Baghdad';
  var A = window.Android;
  var HAS_ANDROID = typeof A !== 'undefined';
  var DAY = 86400000;

  // In the phone app's live preview the design comes straight from the editor (never from shared storage), so every change shows.
  function pvCfg() { return PREVIEW && typeof PD === 'object' && PD && PD.cfg ? PD.cfg : null; }
  function load(k, d) {
    var c = pvCfg();
    if (c && (k in c || CONFIG_KEYS.indexOf(k) >= 0 || k === 'carcfg')) { var x = c[k]; return x == null ? d : JSON.parse(JSON.stringify(x)); }
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  var PREVIEW = /[?&]preview=1/.test(location.search);
  if (PREVIEW) { try { var PD = window.parent.__PREVIEW_DATA || {}; if (PD.cfg) PD = Object.assign({}, PD, { cfg: JSON.parse(JSON.stringify(PD.cfg)) }); if (PD.apps) window.__DEMO_APPS = PD.apps; if (PD.bg) window.__DEMO_BG = PD.bg; if (PD.tv) window.__DEMO_TV = true; } catch (e) {} }
  var CONFIG_KEYS = ['settings', 'layout', 'appOrder', 'appHidden', 'customIcons', 'cityIdx', 'hijriOffset', 'bgSource', 'bgPinned'];
  var cfgT = null;
  function save(k, v) {
    var pc = pvCfg(); if (pc && (k in pc || CONFIG_KEYS.indexOf(k) >= 0)) { pc[k] = v; return; }
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    if (CONFIG_KEYS.indexOf(k) >= 0) { clearTimeout(cfgT); cfgT = setTimeout(pushConfig, 800); }
  }
  // The phone app ("مدير الشاشة") reads and replaces the look through these.
  function exportConfig() {
    var o = { v: 1, mode: 'tv' };
    CONFIG_KEYS.forEach(function (k) { var x = load(k, undefined); if (x !== undefined) o[k] = x; });
    var cc = load('carcfg', undefined); if (cc !== undefined) o.carcfg = cc;
    var st = load('cfgStamp', undefined); if (st) o.stamp = st;
    var lk = load('locks', {}) || {}, kd = load('kids', {}) || {};
    o.dev = { locks: { pkgs: lk.pkgs || [], hasPin: !!lk.pin }, sched: load('sched', {}) || {}, kidsLimit: kd.limit == null ? 120 : kd.limit, kidsOn: !!kd.on, kidsApps: kd.apps || [] };
    return o;
  }
  function pushConfig() { if (HAS_ANDROID && A.writeConfig) try { A.writeConfig(JSON.stringify(exportConfig())); } catch (e) {} }
  window.exportConfig = exportConfig;
  window.importConfig = function (o) {
    if (!o || typeof o !== 'object') return;
    CONFIG_KEYS.forEach(function (k) {
      if (o[k] === undefined) return;
      try { if (o[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(o[k])); } catch (e) {}
    });
    if (o.carcfg !== undefined) try { localStorage.setItem('carcfg', JSON.stringify(o.carcfg)); } catch (e) {}
    if (o.stamp) try { localStorage.setItem('cfgStamp', JSON.stringify(o.stamp)); } catch (e) {}
    if (o.dev) applyDev(o.dev);
    pushConfig();
    if (o.mode && HAS_ANDROID && A.setMode && o.mode !== A.getMode()) { A.setMode(o.mode); return; }
    setTimeout(function () { location.reload(); }, 150);
  };
  // device settings sent from the phone: app lock, sleep / wake times, kids watch time
  function applyDev(d) {
    try {
      if (d.locks) {
        var lk = load('locks', {}) || {};
        if (d.locks.pkgs) lk.pkgs = d.locks.pkgs;
        if (d.locks.pin !== undefined) lk.pin = d.locks.pin;
        localStorage.setItem('locks', JSON.stringify(lk));
        if (HAS_ANDROID && A.setLocks) A.setLocks(lk.pin ? (lk.pkgs || []).join(',') : '');
      }
      if (d.sched) {
        localStorage.setItem('sched', JSON.stringify(d.sched));
        if (HAS_ANDROID && A.schedule) { A.schedule('sleep', d.sched.sleep || ''); A.schedule('wake', d.sched.wake || ''); }
      }
      if (d.kidsLimit !== undefined || d.kidsApps) {
        var kd = load('kids', { on: false, pin: '', apps: [], limit: 120, used: {}, launchAt: 0 }) || {};
        if (d.kidsLimit !== undefined) kd.limit = +d.kidsLimit || 0;
        if (d.kidsApps) kd.apps = d.kidsApps;
        if (d.kidsPin) kd.pin = d.kidsPin;
        localStorage.setItem('kids', JSON.stringify(kd));
      }
    } catch (e) {}
  }
  if (HAS_ANDROID && A.pendingConfig) {
    try { var pend = A.pendingConfig(); if (pend) { window.importConfig(JSON.parse(pend)); return; } } catch (e) {}
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ---------- Stage ----------
  var stage = $('stage');
  var baseW = window.innerWidth, baseH = window.innerHeight;
  function fit() {
    // ignore height changes from the on-screen keyboard; only react to real screen changes
    if (Math.abs(window.innerWidth - baseW) > 2 || window.innerHeight > baseH) { baseW = window.innerWidth; baseH = window.innerHeight; }
    var s = Math.min(baseW / 1920, baseH / 1080);
    stage.style.transform = 'scale(' + s + ')';
    stage.style.left = ((baseW - 1920 * s) / 2) + 'px';
    stage.style.top = ((window.innerHeight - 1080 * s) / 2) + 'px';
  }
  window.addEventListener('resize', fit); fit();

  var toastEl = $('toast'), toastT;
  function toast(msg, ms) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 3000); }

  // ---------- Bridge ----------
  var cbs = {}, cbN = 0;
  window.__cb = function (id, text) { var f = cbs[id]; delete cbs[id]; if (f) f(text); };
  function bridgeAsync(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve) {
      var id = 'c' + (++cbN); cbs[id] = resolve;
      A[method].apply(A, args.concat([id]));
    });
  }
  function getJSON(url) {
    if (HAS_ANDROID) return bridgeAsync('fetchAsync', url).then(function (t) { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } });
    return fetch(url).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  // ---------- Formats ----------
  var nf = new Intl.NumberFormat('ar-IQ-u-nu-arab');
  var fmtTime = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
  var fmtGreg = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
  var fmtGregShort = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  var fmtDay = fmtGregShort;
  var fmtHour = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
  var fmtKey = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
  var HCAL = 'islamic-umalqura';
  try { new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura'); } catch (e) { HCAL = 'islamic'; }
  var fmtHijri = new Intl.DateTimeFormat('ar-u-ca-' + HCAL + '-nu-arab', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
  var fmtHijriDM = new Intl.DateTimeFormat('ar-u-ca-' + HCAL + '-nu-arab', { day: 'numeric', month: 'long', timeZone: TZ });
  var fmtHijriNum = new Intl.DateTimeFormat('en-u-ca-' + HCAL + '-nu-latn', { day: 'numeric', month: 'numeric', timeZone: TZ });
  var hijriOffset = load('hijriOffset', 0);

  function hijriText(d) { return fmtHijri.format(new Date(d.getTime() + hijriOffset * DAY)).replace(/\s*هـ\s*$/, ''); }
  function hijriNum(d) {
    var p = fmtHijriNum.formatToParts(new Date(d.getTime() + hijriOffset * DAY)), m = 0, day = 0;
    p.forEach(function (x) { if (x.type === 'month') m = parseInt(x.value, 10); if (x.type === 'day') day = parseInt(x.value, 10); });
    return { m: m, d: day };
  }
  function dayKey(d) { return fmtKey.format(d); }
  function daysBetween(a, b) { return Math.round((Date.parse(dayKey(b)) - Date.parse(dayKey(a))) / DAY); }
  function relDay(d) { var x = daysBetween(new Date(), d); return x === 0 ? 'اليوم' : x === 1 ? 'غداً' : ''; }
  function daysLeftText(n) {
    if (n === 0) return 'اليوم'; if (n === 1) return 'غداً'; if (n === 2) return 'باقي يومين';
    if (n <= 10) return 'باقي ' + nf.format(n) + ' أيام';
    return 'باقي ' + nf.format(n) + ' يوم';
  }
  function clockParts(d) {
    var h = '', m = '', p = '';
    fmtTime.formatToParts(d).forEach(function (x) { if (x.type === 'hour') h = x.value; else if (x.type === 'minute') m = x.value; else if (x.type === 'dayPeriod') p = x.value; });
    return { hm: h + ':' + m, p: p === 'ص' ? 'صباحاً' : (p === 'م' ? 'مساءً' : p) };
  }

  // ---------- Clock ----------
  function tick() {
    var now = new Date(), c = clockParts(now);
    $('hm').textContent = c.hm; $('ampm').textContent = c.p;
    $('greg').textContent = fmtGreg.format(now);
    $('hijri').textContent = hijriText(now);

  }

  // ---------- Prayer times ----------
  var cityIdx = load('cityIdx', 0);
  function hoursToText(h) {
    h = ((h % 24) + 24) % 24;
    var H = Math.floor(h), M = Math.round((h - H) * 60);
    if (M === 60) { H = (H + 1) % 24; M = 0; }
    var ap = H < 12 ? 'ص' : 'م', h12 = H % 12 === 0 ? 12 : H % 12;
    return nf.format(h12) + ':' + (M < 10 ? '٠' : '') + nf.format(M) + ' ' + ap;
  }
  function baghdadYMD(d) { var p = dayKey(d).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function prayerFor(d) { var c = window.CITIES[cityIdx] || window.CITIES[0]; return window.PRAY.compute(baghdadYMD(d), c[1], c[2], 3); }
  function nowHoursBaghdad() { var d = new Date(Date.now() + 3 * 3600000); return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600; }
  function renderAdhan() {
    if (!window.PRAY) return;
    var now = new Date(), t = prayerFor(now), h = nowHoursBaghdad();
    var list = [['الفجر', t.fajr], ['الظهر', t.dhuhr], ['المغرب', t.maghrib]];
    var next = null, recent = null;
    list.forEach(function (p) { if (!next && p[1] > h) next = p; if (h >= p[1] && h - p[1] < 10 / 60) recent = p; });
    var left;
    if (!next) { var tm = prayerFor(new Date(now.getTime() + DAY)); next = ['الفجر', tm.fajr]; left = tm.fajr + 24 - h; }
    else left = next[1] - h;
    var mins = Math.max(0, Math.round(left * 60)), lh = Math.floor(mins / 60), lm = mins % 60;
    var leftTxt = lh > 0 ? nf.format(lh) + ' ساعة' + (lm ? ' و' + nf.format(lm) + ' دقيقة' : '') : nf.format(lm) + ' دقيقة';
    var city = (window.CITIES[cityIdx] || window.CITIES[0])[0];
    $('adhanbox').innerHTML =
      '<div class="a-main"><span class="a-name">' + (recent ? 'حان أذان ' + recent[0] : next[0]) + '</span><span class="a-time t">' + hoursToText(recent ? recent[1] : next[1]) + '</span></div>' +
      '<div class="a-sub">موعد الأذان · ' + (recent ? 'الآن' : 'باقي <b>' + leftTxt + '</b>') + ' · ' + city + '</div>' +
      '<div class="a-all">الفجر <span class="t">' + hoursToText(t.fajr) + '</span> · الشروق <span class="t">' + hoursToText(t.sunrise) + '</span> · الظهر <span class="t">' + hoursToText(t.dhuhr) + '</span> · المغرب <span class="t">' + hoursToText(t.maghrib) + '</span></div>';
    if (((typeof layout !== 'undefined' && layout.adhanbox) || {}).view === 'nextonly') { var al = document.querySelector('#adhanbox .a-all'); if (al) al.style.display = 'none'; }
  }

  // ---------- Wisdom (every 15 minutes) ----------
  var Q_MS = 5 * 60000, lastWisdom = -1;
  function renderWisdom() {
    var list = window.WISDOM || []; if (!list.length) return;
    var i = Math.floor(Date.now() / Q_MS) % list.length;
    if (i === lastWisdom) return; lastWisdom = i;
    var w = list[i], el = $('wText');
    $('wKind').textContent = w[2] === 'ayah' ? 'آية قرآنية' : w[2] === 'verse' ? (window.FAITH && FAITH.rel === 'christian' ? 'من الكتاب المقدس' : 'من الكتاب') : w[2] === 'saying' ? 'حكمة اليوم' : 'حديث شريف';
    el.textContent = w[2] === 'ayah' ? '﴿ ' + w[0] + ' ﴾' : '« ' + w[0] + ' »';
    el.classList.toggle('long', w[0].length > 70);
    $('wSrc').textContent = w[1];
  }

  // ---------- Occasions ----------
  var occCache = { key: '', list: [] };
  function computeOccasions() {
    var today = new Date(), key = dayKey(today) + '|' + hijriOffset;
    if (occCache.key === key) return occCache.list;
    var map = hijriMap();
    var out = [];
    (window.OCCASIONS || []).forEach(function (o) {
      var hit = map[o[0] + '-' + o[1]]; if (!hit && o[1] === 30) hit = map[o[0] + '-29']; if (!hit) return;
      out.push({ name: o[2], kind: o[3], date: hit.date, left: hit.i });
    });
    var t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    (window.GREG_OCC || []).forEach(function (o) {
      var d = o.date, left = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - t0) / DAY);
      if (left >= 0 && left < 390) out.push({ name: o.name, kind: o.kind, date: d, left: left, greg: true, big: o.big });
    });
    out.sort(function (a, b) { return a.left - b.left; });
    occCache = { key: key, list: out }; return out;
  }
  function renderOccasions() {
    var list = computeOccasions(), n = list[0];
    if (n) $('nextOcc').innerHTML = '<span class="dot ' + n.kind + '"></span><span>' + (n.left === 0 ? 'اليوم: ' : daysLeftText(n.left) + ' على ') + '<b>' + esc(n.name) + '</b></span>';
    $('occasions').innerHTML = list.slice(0, 14).map(function (o) {
      var hd = fmtHijriDM.format(new Date(o.date.getTime() + hijriOffset * DAY));
      return '<div class="item occ ' + o.kind + (o.left === 0 ? ' today' : '') + '" data-kind="occ"><div class="o-name">' + esc(o.name) + '</div>' +
        '<div class="o-dates">' + (o.greg ? '<div class="h">' + fmtGregShort.format(o.date) + '</div>' : '<div class="h">' + hd + ' هـ</div><div>يصادف ' + fmtGregShort.format(o.date) + '</div>') + '</div>' +
        '<div class="o-left">' + daysLeftText(o.left) + '</div></div>';
    }).join('') || '<div class="item empty-card" data-kind="none">ماكو مناسبات</div>';
    nav.refresh();
  }

  // ---------- Backgrounds ----------
  var BG_SOURCES = [
    ['shrines', 'العتبات المقدسة', ['Imam_Husayn_Shrine', 'Imam_Husayn_Shrine_in_2015', 'Imam_Husayn_Shrine_in_2017', 'Imam_Husayn_Shrine_in_2018', 'Imam_Husayn_Shrine_in_2019',
      'Al_Abbas_Mosque', 'Al_Abbas_Mosque_in_2016', 'Al_Abbas_Mosque_in_2017', 'Al_Abbas_Mosque_in_2020', 'Imam_Ali_Mosque', 'Imam_Ali_Mosque_in_2013',
      'Imam_Ali_Mosque_in_2018', 'Imam_Ali_Mosque_in_2023', 'Al-Kadhimiya_Mosque_in_2011', 'Al-Kadhimiya_Mosque_in_2014', 'Al-Kadhimiya_Mosque_in_2015',
      'Al-Askari_Shrine', 'Imam_Reza_Shrine', 'Fatima_Masumeh_Shrine', 'Bayn_al-Haramayn', 'Sayyidah_Zaynab_Mosque']],
    ['ahlulbayt', 'أهل البيت (ع) - لوحات فنية', ['Ali_in_art', 'Hussein_ibn_Ali_in_art', 'A_large_painting_depicting_the_Battle_of_Karbala', 'Assassination_of_Ali']],
    ['nabawi', 'المسجد النبوي الشريف', ['Al-Masjid_an-Nabawi', 'Al-Masjid_an-Nabawi_in_2011', 'Al-Masjid_an-Nabawi_in_2015', 'Green_Dome']],
    ['nature', 'مناظر طبيعية', ['Featured_pictures_of_landscapes', 'Featured_pictures_of_mountains', 'Quality_images_of_landscapes', 'Featured_pictures_of_twilights', 'Featured_pictures_of_nature']],
    ['mecca', 'مكة المكرمة', ['Masjid_al-Haram', 'Kaaba']],
    ['churches', 'الكنائس', ['Churches_in_Iraq', 'Church_interiors']],
    ['mandaean', 'المندائية', ['Mandaeism', 'Mandaeans']],
    ['paintings', 'لوحات فنية', ['Landscape_paintings']],
    ['calligraphy', 'الخط العربي', ['Islamic_calligraphy']],
    ['mine', 'صوري (من الجهاز أو الموبايل)', null]
  ];
  var BG_INTERVALS = [30, 60, 120, 180, 300, 600];
  function bgMs() { return ((settings && settings.bgInterval) || 300) * 1000; }
  function bgSources() {
    var s = settings && settings.bgSources;
    if (!s || !s.length) {
      var old = load('bgSource', 'religious');
      s = old === 'mine' ? ['mine'] : old === 'all' ? ['shrines', 'mine'] : ['shrines'];
    }
    return s;
  }
  function srcName(id) { for (var i = 0; i < BG_SOURCES.length; i++) if (BG_SOURCES[i][0] === id) return BG_SOURCES[i][1]; return id; }
  var bgPinned = load('bgPinned', null);
  var bundled = [], daily = {}, mine = [], bgList = [], bgCur = '', bgFlip = false, bgManual = 0;
  function seededShuffle(arr, seed) {
    var a = arr.slice(), s = seed % 2147483647; if (s <= 0) s += 2147483646;
    for (var i = a.length - 1; i > 0; i--) { s = s * 16807 % 2147483647; var j = s % (i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function dayNumber() { return Math.floor((Date.now() + 3 * 3600000) / DAY); }
  function allDaily() { var out = []; Object.keys(daily).forEach(function (k) { out = out.concat(daily[k] || []); }); return out; }
  function religiousPool() { return (daily.shrines || []).concat(bundled); }
  function buildBgList() {
    var fresh = [], rest = [];
    if (settings.bgPack && settings.bgPack.length && settings.bgMode !== 'palette') {
      bgList = seededShuffle(settings.bgPack.slice(), dayNumber() + 5);
      return;
    }
    bgSources().forEach(function (id) {
      if (id === 'mine') rest = rest.concat(mine);
      else if (id === 'shrines') { fresh = fresh.concat(daily.shrines || []); rest = rest.concat(bundled); }
      else fresh = fresh.concat(daily[id] || []);
    });
    if (!fresh.length && !rest.length) rest = bundled.length ? bundled : mine;
    bgList = seededShuffle(fresh, dayNumber() + 3).concat(seededShuffle(rest, dayNumber() + 7));
    try { save('bgListCache', bgList.slice(0, 80)); } catch (e) {}
  }
  function setBg(url) {
    if (!url || url === bgCur) return;
    var img = new Image();
    img.onload = function () {
      bgCur = url;
      var a = $('bgA'), b = $('bgB'), show = bgFlip ? a : b, hide = bgFlip ? b : a; bgFlip = !bgFlip;
      show.style.backgroundImage = 'url("' + url + '")'; show.classList.add('on'); hide.classList.remove('on');
      paintHero();
      $('credit').textContent = (url.indexOf('bg/') === 0 || url.indexOf('/daily/') >= 0) ? 'الصور: ويكيميديا كومنز' : '';
    };
    img.onerror = function () {
      bgBad[url] = 1;
      if (bgPinned === url) { bgPinned = null; save('bgPinned', null); }
      if (!bgPinned && bgList.length > 1 && bgSkips++ < bgList.length) { bgManual++; showBg(); }
    };
    img.src = url;
  }
  var bgBad = {}, bgSkips = 0;
  function showBg() {
    if (bgPinned) { setBg(bgPinned); return; }
    if (!bgList.length) return;
    var idx = (Math.floor(Date.now() / bgMs()) + bgManual) % bgList.length, tries = 0;
    while (bgBad[bgList[idx]] && tries++ < bgList.length) { bgManual++; idx = (idx + 1) % bgList.length; }
    if (bgList[idx] === bgCur) bgSkips = 0;
    setBg(bgList[idx]);
    var nxt = bgList[(idx + 1) % bgList.length]; if (nxt) { var p = new Image(); p.src = nxt; }
  }
  function loadMine() {
    mine = [];
    if (!HAS_ANDROID) { mine = window.__DEMO_MINE || []; return; }
    try { mine = JSON.parse(A.listSavedImages()) || []; } catch (e) {}
    if (A.hasImagesPermission()) { try { mine = mine.concat(JSON.parse(A.listMyImages()) || []); } catch (e) {} }
  }
  function loadBackgrounds() {
    if (HAS_ANDROID) { try { bundled = JSON.parse(A.listBgAssets()) || []; } catch (e) { bundled = []; } }
    else bundled = window.__DEMO_BG || [];
    var saved = load('dailyBg2', null);
    if (saved && saved.src) daily = saved.src;
    else { var old = load('dailyBg', null); daily = old && old.files ? { shrines: old.files } : {}; }
    loadMine(); buildBgList(); showBg();
    refreshDaily();
  }

  // New photos every day from Wikimedia Commons, for each chosen source
  var dailyBusy = false, dailyAgain = false;
  function refreshDaily() {
    if (!HAS_ANDROID) return;
    if (dailyBusy) { dailyAgain = true; return; }
    var day = dayNumber(), saved = load('dailyBg2', { day: 0, src: {} });
    if (saved.day !== day) saved = { day: day, src: {} };
    var todo = bgSources().filter(function (id) { return id !== 'mine' && !(saved.src[id] && saved.src[id].length >= 4); });
    if (!todo.length) return;
    dailyBusy = true;
    var chain = Promise.resolve();
    todo.forEach(function (id, si) {
      var src = BG_SOURCES.filter(function (x) { return x[0] === id; })[0]; if (!src || !src[2]) return;
      var cats = seededShuffle(src[2], day + si).slice(0, 4), art = id === 'ahlulbayt' || id === 'paintings' || id === 'calligraphy';
      chain = chain.then(function () {
        return Promise.all(cats.map(function (c) {
          return getJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtype=file&gcmlimit=150&gcmtitle=Category:' + encodeURIComponent(c) + '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1920');
        })).then(function (res) {
          var cand = [];
          res.forEach(function (j) {
            var pages = j && j.query && j.query.pages; if (!pages) return;
            Object.keys(pages).forEach(function (k) {
              var i = pages[k].imageinfo && pages[k].imageinfo[0]; if (!i || i.mime !== 'image/jpeg' || !i.thumburl) return;
              var r = i.width / i.height;
              if (art ? (i.width >= 1200 && r > 1.15 && r < 2.2) : (i.width >= 1800 && r > 1.3 && r < 1.95)) cand.push(i.thumburl);
            });
          });
          var pick = seededShuffle(cand, day * 13 + si + 1).slice(0, 8), files = [], prefix = 'd' + day + '_' + id + '_';
          var c2 = Promise.resolve();
          pick.forEach(function (u, i) { c2 = c2.then(function () { return bridgeAsync('downloadAsync', u, prefix + i + '.jpg').then(function (p) { if (p) files.push(p); }); }); });
          return c2.then(function () { if (files.length) { saved.src[id] = files; save('dailyBg2', saved); daily = saved.src; buildBgList(); showBg(); } });
        });
      });
    });
    var done = function () { dailyBusy = false; if (dailyAgain) { dailyAgain = false; setTimeout(refreshDaily, 500); } };
    chain.then(function () { done(); A.cleanDaily('d' + day + '_'); }, done);
  }

  // Sources & interval chooser
  function openBgSources() {
    openList('مصادر الخلفيات', 'OK حتى تختار أو تلغي · تگدر تختار أكثر من مصدر · رجوع للحفظ', function () {
      var cur = bgSources(), rows = [{ head: true, label: 'المصادر' }];
      BG_SOURCES.forEach(function (src) {
        rows.push({ label: src[1], value: cur.indexOf(src[0]) >= 0 ? '✅ مختار' : '—', act: function () {
          var list = bgSources().slice(), k = list.indexOf(src[0]);
          if (k >= 0) { if (list.length > 1) list.splice(k, 1); else toast('لازم يبقى مصدر واحد على الأقل'); } else list.push(src[0]);
          settings.bgSources = list; saveSettings(); bgPinned = null; save('bgPinned', null);
          if (src[0] === 'mine') loadMine();
          buildBgList(); bgCur = ''; showBg(); refreshDaily();
        } });
      });
      rows.push({ head: true, label: 'التبديل' });
      rows.push({ label: 'وقت تبديل الصورة', value: intervalText(settings.bgInterval || 300), act: function (k) {
        settings.bgInterval = cycle(BG_INTERVALS, settings.bgInterval || 300, k === 'ArrowRight' ? -1 : 1); saveSettings(); } });
      return rows;
    });
  }
  function intervalText(sec) { return sec < 60 ? nf.format(sec) + ' ثانية' : sec === 60 ? 'دقيقة' : sec === 120 ? 'دقيقتين' : nf.format(sec / 60) + ' دقايق'; }

  // Background picker
  var picker = { items: [], idx: 0, target: null };
  function openPicker(target) {
    picker.target = target || null;
    loadMine();
    var names = bgSources().map(srcName).join('، ');
    var opts = [
      { kind: 'auto', html: 'تلقائي حسب المصادر<small>' + esc(names) + ' · كل ' + intervalText(settings.bgInterval || 300) + '</small>' },
      { kind: 'sources', html: '⚙ مصادر الخلفيات ووقت التبديل<small>اختار مصدر واحد أو أكثر</small>' },
      { kind: 'add', html: '＋ إضافة من الجهاز<small>اختار صورة من التلفزيون</small>' }
    ];
    if (picker.target) opts = [{ kind: 'add', html: '＋ إضافة من الجهاز<small>اختار صورة من التلفزيون</small>' }, { kind: 'reset', html: 'الأيقونة الأصلية<small>رجّع أيقونة التطبيق</small>' }];
    var imgs = (picker.target ? mine.concat(allDaily(), bundled) : allDaily().concat(mine, bundled)).map(function (u) { return { kind: 'img', url: u }; });
    picker.items = opts.concat(imgs.slice(0, 60));
    $('bgModal').querySelector('.m-title').textContent = picker.target ? 'اختار صورة للأيقونة' : 'الخلفيات';
    $('bgGridInner').innerHTML = picker.items.map(function (it, i) {
      var sel = (it.kind === 'auto' && !bgPinned) || (it.kind === 'img' && bgPinned === it.url);
      if (it.kind === 'img') return '<div class="mitem' + (sel ? ' sel' : '') + '" data-i="' + i + '"><div class="thumb" data-src="' + esc(it.url) + '"></div></div>';
      return '<div class="mitem' + (sel && !picker.target ? ' sel' : '') + '" data-i="' + i + '"><div class="thumb opt' + (it.kind === 'add' ? ' add' : '') + '">' + it.html.replace('<small>', '<span><small>').replace('</small>', '</small></span>') + '</div></div>';
    }).join('');
    picker.idx = 0; layer = 'bg'; $('bgModal').classList.add('on'); pickerFocus();
  }
  function pickerFocus() {
    var els = qa('#bgGridInner .mitem');
    els.forEach(function (e, i) { e.classList.toggle('focus', i === picker.idx); });
    var rowN = Math.floor(picker.idx / 5), shift = Math.max(0, rowN - 2) * 206;
    $('bgGridInner').style.transform = 'translateY(' + (-shift) + 'px)';
    // lazy-load thumbnails near the focus
    els.forEach(function (e, i) {
      if (Math.abs(i - picker.idx) > 20) return;
      var t = e.querySelector('.thumb[data-src]'); if (t && !t.style.backgroundImage) t.style.backgroundImage = 'url("' + t.getAttribute('data-src') + '")';
    });
  }
  function pickerKey(k) {
    var n = picker.items.length;
    if (k === 'ArrowRight') picker.idx = Math.max(0, picker.idx - 1);
    else if (k === 'ArrowLeft') picker.idx = Math.min(n - 1, picker.idx + 1);
    else if (k === 'ArrowUp') picker.idx = Math.max(0, picker.idx - 5);
    else if (k === 'ArrowDown') picker.idx = Math.min(n - 1, picker.idx + 5);
    else if (k === 'ok') {
      var it = picker.items[picker.idx];
      if (it.kind === 'auto') {
        bgPinned = null; save('bgPinned', null);
        buildBgList(); bgCur = ''; showBg(); closeModal(); toast('الخلفيات صارت تلقائية'); return;
      }
      if (it.kind === 'sources') { closeModal(); openBgSources(); return; }
      if (it.kind === 'add') { addFromDevice(); return; }
      if (picker.target) {
        if (it.kind === 'reset') delete customIcons[picker.target]; else customIcons[picker.target] = it.url;
        save('customIcons', customIcons); closeModal(); renderApps(); toast('تم تغيير الأيقونة'); return;
      }
      bgPinned = it.url; save('bgPinned', bgPinned); setBg(bgPinned); closeModal(); toast('تم تثبيت الخلفية'); return;
    } else if (k === 'back') { closeModal(); return; }
    pickerFocus();
  }
  function addFromDevice() {
    if (!HAS_ANDROID) { toast('إضافة من الجهاز'); return; }
    if (A.pickImage()) return; // result arrives in onImagePicked
    if (!A.hasImagesPermission()) { A.requestImagesPermission(); toast('وافق على إذن الصور، وبعدها اضغط مرة ثانية', 4500); return; }
    loadMine();
    if (mine.length) { toast('لگيت ' + nf.format(mine.length) + ' صورة بالجهاز', 3000); openPicker(); }
    else toast('دز صورك للتلفزيون بتطبيق LocalSend، وبعدها ارجع هنا', 5000);
  }
  window.onImagePicked = function (path) {
    if (!path) { toast('ما تم اختيار صورة'); return; }
    if (picker.target) { customIcons[picker.target] = path; save('customIcons', customIcons); loadMine(); closeModal(); renderApps(); toast('تم تغيير الأيقونة'); return; }
    loadMine(); bgPinned = path; save('bgPinned', path); setBg(path); closeModal(); toast('تمت إضافة الصورة وتثبيتها خلفية');
  };

  // ---------- Matches ----------
  var TEAMS = [86, 367, 83, 364, 360, 4375];
  var NAMES = {
    'Real Madrid':'ريال مدريد','Barcelona':'برشلونة','Tottenham Hotspur':'توتنهام','Liverpool':'ليفربول','Manchester United':'مانشستر يونايتد','Iraq':'العراق',
    'Valencia':'فالنسيا','Atlético Madrid':'أتلتيكو مدريد','Atletico Madrid':'أتلتيكو مدريد','Villarreal':'فياريال','Celta Vigo':'سيلتا فيغو','Alavés':'ألافيس',
    'Deportivo':'ديبورتيفو','Deportivo La Coruña':'ديبورتيفو','Sevilla':'إشبيلية','Real Betis':'ريال بيتيس','Athletic Club':'أتلتيك بلباو','Real Sociedad':'ريال سوسيداد',
    'Girona':'جيرونا','Getafe':'خيتافي','Osasuna':'أوساسونا','Mallorca':'مايوركا','Rayo Vallecano':'رايو فاليكانو','Espanyol':'إسبانيول','Levante':'ليفانتي','Elche':'إلتشي',
    'Real Oviedo':'ريال أوفييدو','Racing Santander':'راسينغ سانتاندير','Las Palmas':'لاس بالماس','Leganés':'ليغانيس','Valladolid':'بلد الوليد',
    'Crystal Palace':'كريستال بالاس','Everton':'إيفرتون','Aston Villa':'أستون فيلا','Brentford':'برينتفورد','Leeds United':'ليدز يونايتد','Ipswich Town':'إيبسويتش',
    'Sunderland':'سندرلاند','Fulham':'فولهام','Arsenal':'آرسنال','Chelsea':'تشيلسي','Manchester City':'مانشستر سيتي','Newcastle United':'نيوكاسل','West Ham United':'وست هام',
    'Brighton & Hove Albion':'برايتون','Wolverhampton Wanderers':'وولفرهامبتون','Nottingham Forest':'نوتنغهام فورست','AFC Bournemouth':'بورنموث','Burnley':'بيرنلي',
    'Leicester City':'ليستر سيتي','Southampton':'ساوثهامبتون','Bayern Munich':'بايرن ميونخ','Paris Saint-Germain':'باريس سان جيرمان','Juventus':'يوفنتوس',
    'Internazionale':'إنتر ميلان','AC Milan':'ميلان','Napoli':'نابولي','Borussia Dortmund':'دورتموند','Bayer Leverkusen':'ليفركوزن','RB Leipzig':'لايبزيغ',
    'PSV Eindhoven':'آيندهوفن','Club Brugge':'كلوب بروج','Sporting CP':'سبورتينغ لشبونة','Benfica':'بنفيكا','FC Porto':'بورتو','Ajax':'أياكس','Galatasaray':'غلطة سراي',
    'Fenerbahce':'فنربخشة','Celtic':'سلتيك','Atalanta':'أتالانتا','AS Roma':'روما','Sabah FK':'صباح الأذربيجاني','Monaco':'موناكو','Marseille':'مارسيليا','Olympiacos':'أولمبياكوس',
    'Australia':'أستراليا','Tajikistan':'طاجيكستان','Singapore':'سنغافورة','Saudi Arabia':'السعودية','Jordan':'الأردن','Iran':'إيران','Japan':'اليابان','South Korea':'كوريا الجنوبية',
    'Qatar':'قطر','United Arab Emirates':'الإمارات','Kuwait':'الكويت','Bahrain':'البحرين','Oman':'عُمان','Syria':'سوريا','Palestine':'فلسطين','Lebanon':'لبنان',
    'Uzbekistan':'أوزبكستان','Egypt':'مصر','Morocco':'المغرب','Tunisia':'تونس','Algeria':'الجزائر','China PR':'الصين','Thailand':'تايلاند','Vietnam':'فيتنام',
    'Indonesia':'إندونيسيا','Kyrgyzstan':'قيرغيزستان','India':'الهند','North Korea':'كوريا الشمالية','Yemen':'اليمن','Libya':'ليبيا','Sudan':'السودان',
    'Lazio':'لاتسيو','Fiorentina':'فيورنتينا','Bologna':'بولونيا','Torino':'تورينو','Genoa':'جنوى','Udinese':'أودينيزي','Cagliari':'كالياري','Lecce':'ليتشي','Parma':'بارما',
    'Como':'كومو','Verona':'فيرونا','Hellas Verona':'فيرونا','Sassuolo':'ساسولو','Cremonese':'كريمونيزي','Pisa':'بيزا','Empoli':'إمبولي','Monza':'مونزا','Venezia':'فينيسيا',
    'VfB Stuttgart':'شتوتغارت','Eintracht Frankfurt':'آينتراخت فرانكفورت','VfL Wolfsburg':'فولفسبورغ','Borussia Mönchengladbach':'مونشنغلادباخ','SC Freiburg':'فرايبورغ',
    'TSG Hoffenheim':'هوفنهايم','1. FC Union Berlin':'يونيون برلين','Werder Bremen':'فيردر بريمن','FC Augsburg':'أوغسبورغ','Mainz':'ماينز','1. FC Heidenheim 1846':'هايدنهايم',
    'FC St. Pauli':'سانت باولي','Hamburg SV':'هامبورغ','1. FC Köln':'كولن','Lyon':'ليون','Lille':'ليل','Nice':'نيس','Lens':'لانس','Rennes':'رين','Stade Rennais':'رين',
    'Nantes':'نانت','Strasbourg':'ستراسبورغ','Toulouse':'تولوز','Brest':'بريست','Stade Brestois 29':'بريست','Auxerre':'أوكسير','Angers':'أنجيه','Le Havre AC':'لوهافر',
    'Paris FC':'باريس إف سي','Lorient':'لوريان','Metz':'ميتز','Real Sociedad B':'ريال سوسيداد ب','Al-Shorta SC':'الشرطة','Al-Quwa Al-Jawiya':'القوة الجوية',
    'Al-Zawraa':'الزوراء','Al-Talaba':'الطلاب','Erbil':'أربيل','Duhok':'دهوك','Al Hilal':'الهلال','Al Nassr':'النصر','Al Ittihad':'الاتحاد','Al Ahli':'الأهلي',
    'Persepolis':'بيرسبوليس','Esteghlal':'استقلال','Sepahan':'سباهان','Al Sadd':'السد','Al Duhail':'الدحيل','Al Wahda':'الوحدة','Al Ain':'العين','Shabab Al Ahli':'شباب الأهلي'
  };
  var LEAGUES = {
    'esp.1':'الدوري الإسباني','eng.1':'الدوري الإنگليزي','uefa.champions':'دوري أبطال أوروبا','uefa.europa':'الدوري الأوروبي','uefa.europa.conf':'دوري المؤتمر الأوروبي',
    'esp.copa_del_rey':'كأس ملك إسبانيا','esp.super_cup':'كأس السوبر الإسباني','eng.fa':'كأس الاتحاد الإنگليزي','eng.league_cup':'كأس الرابطة الإنگليزية',
    'fifa.cwc':'كأس العالم للأندية','fifa.world':'كأس العالم','fifa.worldq.afc':'تصفيات كأس العالم - آسيا','afc.asian.cup':'كأس آسيا','afc.cupq':'تصفيات كأس آسيا',
    'fifa.friendly':'مباراة ودية','club.friendly':'مباراة ودية','uefa.super_cup':'كأس السوبر الأوروبي','fifa.arab':'كأس العرب',
    'ita.1':'الدوري الإيطالي','ger.1':'الدوري الألماني','fra.1':'الدوري الفرنسي','ita.coppa_italia':'كأس إيطاليا','ger.dfb_pokal':'كأس ألمانيا','fra.coupe_de_france':'كأس فرنسا',
    'ita.super_cup':'كأس السوبر الإيطالي','ger.super_cup':'كأس السوبر الألماني','fra.super_cup':'كأس الأبطال الفرنسي','afc.champions':'دوري أبطال آسيا للنخبة',
    'afc.cup':'دوري أبطال آسيا ٢','irq.1':'دوري نجوم العراق'
  };
  var matches = (load('matchesCache', { t: 0, list: [] }).list) || [];
  function parseEvents(json) {
    var out = [];
    if (!json || !json.events) return out;
    json.events.forEach(function (e) {
      var c = e.competitions && e.competitions[0]; if (!c || !c.competitors) return;
      var st = (c.status && c.status.type) || {};
      if (st.completed || st.state === 'post') return;
      var home = c.competitors.filter(function (x) { return x.homeAway === 'home'; })[0] || c.competitors[0];
      var away = c.competitors.filter(function (x) { return x.homeAway === 'away'; })[0] || c.competitors[1];
      if (!home || !away) return;
      function team(x) {
        var t = x.team || {};
        var sc = x.score && (x.score.displayValue != null ? x.score.displayValue : x.score);
        return { name: NAMES[t.displayName] || t.displayName || '', logo: (t.logos && t.logos[0] && t.logos[0].href) || t.logo || '', score: (typeof sc === 'string' || typeof sc === 'number') ? String(sc) : '' };
      }
      out.push({ id: e.id, date: e.date, slug: e.league ? e.league.slug : '', league: e.league ? (LEAGUES[e.league.slug] || (/[\u0600-\u06FF]/.test(e.league.name || '') ? e.league.name : 'مباراة رسمية')) : '', state: st.state || 'pre', clock: (c.status && c.status.displayClock) || '', home: team(home), away: team(away) });
    });
    return out;
  }
  function teamIds() { return settings.team && settings.team.ids && settings.team.ids.length ? settings.team.ids : TEAMS; }
  function matchKey() { return settings.team && settings.team.ids ? 'matchesCache_' + settings.team.ids.join('_') : 'matchesCache'; }
  function refreshMatches(force) {
    var cache = load(matchKey(), { t: 0, list: [] });
    if (!force && cache.list && cache.list.length && Date.now() - cache.t < 20 * 60000) { matches = cache.list; renderMatches(); return; }
    Promise.all(teamIds().map(function (id) { return getJSON('https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/' + id + '/schedule?fixture=true'); }))
      .then(function (res) {
        var all = {}, any = false;
        res.forEach(function (j) { if (j) any = true; parseEvents(j).forEach(function (m) { all[m.id] = m; }); });
        var list = Object.keys(all).map(function (k) { return all[k]; })
          .filter(function (m) { return Date.parse(m.date) > Date.now() - 3 * 3600000; })
          .sort(function (a, b) { return Date.parse(a.date) - Date.parse(b.date); }).slice(0, 14);
        if (any) { matches = list; save(matchKey(), { t: Date.now(), list: list }); scheduleAll(); }
        else if (force) toast('ما گدرت أحدّث المباريات، تأكد من الإنترنت');
        renderMatches();
      });
  }
  function renderMatches() {
    var tr = document.getElementById('matches');
    var list = matches.filter(function (m) { return Date.parse(m.date) > Date.now() - 3 * 3600000; });
    tr.innerHTML = list.length ? list.map(function (m) {
      var d = new Date(m.date), live = m.state === 'in', rd = relDay(d);
      var mid = live ? '<span class="m-mid score">' + nf.format(+m.home.score || 0) + '-' + nf.format(+m.away.score || 0) + '</span>' : '<span class="m-mid">ضد</span>';
      return '<div class="item match" data-kind="match"><div class="m-comp">' + esc(m.league) + '</div><div class="m-teams">' +
        '<div class="m-team">' + (m.home.logo ? '<img src="' + esc(m.home.logo) + '" alt="">' : '') + '<span>' + esc(m.home.name) + '</span></div>' + mid +
        '<div class="m-team away">' + (m.away.logo ? '<img src="' + esc(m.away.logo) + '" alt="">' : '') + '<span>' + esc(m.away.name) + '</span></div></div>' +
        '<div class="m-when">' + (live ? '<span class="live">مباشر ' + esc(m.clock) + '</span>' : '<span>' + (rd || fmtDay.format(d)) + '</span><span class="rel t">' + fmtHour.format(d) + '</span>') + '</div></div>';
    }).join('') : '<div class="item empty-card" data-kind="none">ماكو مباريات قادمة، أو الإنترنت مفصول</div>';
    nav.refresh();
    renderClub();
  }
  // the club look: the club's own logo becomes the background (unless photos are chosen)
  function clubLogo(t) {
    if (!t) return '';
    if (t.logo !== undefined) return t.logo || '';
    return t.matchLabel || !(t.ids && t.ids[0]) ? '' : 'https://a.espncdn.com/i/teamlogos/soccer/500/' + t.ids[0] + '.png';
  }
  var clubBgKey = '';
  function renderClubBg() {
    var t = settings.team, on = settings.skin === 'club' && !!t && settings.clubBg !== 'photos', b = document.body, box = $('clubBg');
    b.classList.toggle('clubbg', on);
    if (!box) return;
    var lg = on ? clubLogo(t) : '', key = on ? lg + '|' + (t.name || '') : '';
    if (key === clubBgKey) return; clubBgKey = key;
    if (!on) { box.innerHTML = ''; return; }
    var nm = esc((t.name || '').split(' ')[0]);
    box.innerHTML = '<div class="cl-wm">' + nm + '</div>' + (lg ? '<img class="cl-amb" src="' + esc(lg) + '" alt=""><img class="cl-logo" src="' + esc(lg) + '" alt="" onerror="this.style.display=\'none\';this.previousSibling.style.display=\'none\'">' : '');
  }
  function renderClub() {
    var el = document.getElementById('clubcard'), t = settings.team;
    renderClubBg();
    if (!el) return;
    if (settings.skin !== 'club' || !t) { el.innerHTML = ''; return; }
    var next = matches.filter(function (m) { return Date.parse(m.date) > Date.now() - 2 * 3600000; })[0], h = '';
    var nm = t.name || '', fs = nm.length > 13 ? 92 : nm.length > 9 ? 112 : 132;
    h += '<div class="cc-nick">' + esc(t.nick || '') + '</div><div class="cc-name" style="font-size:' + fs + 'px">' + esc(nm) + '</div><div class="cc-bar"></div>';
    if (next) {
      var d = new Date(next.date), ms = d - Date.now(), left;
      if (next.state === 'in') left = 'مباشر الآن ' + nf.format(+next.home.score || 0) + '-' + nf.format(+next.away.score || 0);
      else if (ms < 3600000) left = 'باقي ' + nf.format(Math.max(1, Math.round(ms / 60000))) + ' دقيقة';
      else if (ms < 86400000) left = 'باقي ' + nf.format(Math.round(ms / 3600000)) + ' ساعة';
      else left = 'باقي ' + nf.format(Math.round(ms / 86400000)) + ' يوم';
      h += '<div class="cc-next"><span>' + esc(t.nextLabel || 'المباراة الجاية') + '</span><span class="vs">' + esc(next.home.name) + ' ضد ' + esc(next.away.name) + '</span><span class="cd">' + left + '</span></div>' +
        '<div class="cc-sub">' + esc(next.league) + ' · ' + (relDay(d) || fmtDay.format(d)) + ' · ' + fmtHour.format(d) + '</div>';
    } else h += '<div class="cc-sub">' + esc(t.motto || 'المباريات تطلع هنا أول ما تنعلن') + '</div>';
    el.innerHTML = h;
  }


  // ---------- Apps ----------
  var DEFAULT_ORDER = ['com.google.android.youtube.tv','com.netflix.ninja','net.mbc.shahid.tv','com.disney.disneyplus','com.vodu.tv','tv.app1001.androidtv','com.todtv.tod','com.spotify.tv.android','com.google.android.youtube.tvmusic','iq.qicard.tv.prod','com.android.vending'];
  var apps = [], order = load('appOrder', null), hidden = load('appHidden', []), mode = 'normal';
  function sortApps(list) {
    var ord = order || DEFAULT_ORDER;
    function rank(p) { var i = ord.indexOf(p); return i < 0 ? 999 : i; }
    return list.sort(function (a, b) { return rank(a.pkg) - rank(b.pkg) || a.label.localeCompare(b.label, 'ar'); });
  }
  function loadApps(force) {
    if (HAS_ANDROID) {
      if (!force && apps.length && !A.appsChanged()) return;
      bridgeAsync('getAppsAsync').then(function (t) { var l = []; try { l = JSON.parse(t) || []; } catch (e) {} l.forEach(arLabel); apps = sortApps(l); renderApps(); });
    } else if (window.__DEMO_APPS) { apps = sortApps(window.__DEMO_APPS.slice().map(arLabel)); renderApps(); }
  }
  var AR_PKG = {
    'com.google.android.youtube.tv': 'يوتيوب', 'com.google.android.youtube.tvkids': 'يوتيوب أطفال', 'com.google.android.youtube.tvmusic': 'يوتيوب ميوزك',
    'com.netflix.ninja': 'نتفلكس', 'net.mbc.shahid.tv': 'شاهد', 'net.mbc.shahidTV': 'شاهد', 'com.disney.disneyplus': 'ديزني بلس', 'com.vodu.tv': 'فودو',
    'com.todtv.tod': 'تود', 'com.spotify.tv.android': 'سبوتيفاي', 'com.android.vending': 'المتجر', 'com.android.tv.settings': 'الإعدادات',
    'com.google.android.tvlauncher': 'الواجهة القديمة', 'com.google.android.apps.tv.launcherx': 'الواجهة القديمة', 'org.videolan.vlc': 'في إل سي',
    'org.xbmc.kodi': 'كودي', 'com.amazon.amazonvideo.livingroom': 'برايم فيديو', 'com.osn.go': 'أو إس إن', 'com.osn.osnplus': 'أو إس إن بلس',
    'com.google.android.videos': 'أفلام گوگل', 'com.google.android.play.games': 'ألعاب گوگل', 'com.android.chrome': 'كروم', 'com.google.android.apps.mediashell': 'البث',
    'com.google.android.katniss': 'المساعد', 'com.google.android.tv': 'التلفزيون المباشر', 'com.android.tv': 'التلفزيون المباشر', 'com.mediatek.wwtv.tvcenter': 'التلفزيون',
    'com.cleantv.remote': 'ريموت مدير الشاشات', 'com.estrongs.android.pop': 'مدير الملفات', 'com.lonelycatgames.Xplore': 'مدير الملفات', 'com.android.documentsui': 'الملفات',
    'com.spacetoon.go': 'سبيستون غو', 'com.anghami': 'أنغامي', 'com.starzplay.app': 'ستارز بلاي', 'com.wbd.watchit': 'واتش إت', 'com.weyyak.tv': 'وياك',
    'com.android.gallery3d': 'الصور', 'com.google.android.apps.photos': 'الصور', 'com.facebook.katana': 'فيسبوك', 'com.instagram.android': 'إنستغرام',
    'org.telegram.messenger': 'تيليگرام', 'com.whatsapp': 'واتساب', 'com.twitter.android': 'إكس', 'com.zhiliaoapp.musically': 'تيك توك', 'tv.twitch.android.app': 'تويتش',
    'com.apple.atve.androidtv.appletv': 'أبل تي في بلس', 'com.hbo.hbonow': 'إتش بي أو', 'com.wbd.stream': 'ماكس', 'tv.pluto.android': 'بلوتو',
    'com.liskovsoft.smarttubetv.beta': 'سمارت تيوب', 'com.teamsmart.videomanager.tv': 'سمارت تيوب', 'com.ss.android.ugc.trill': 'تيك توك'
  };
  var AR_WORDS = { 'Settings': 'الإعدادات', 'Files': 'الملفات', 'File Manager': 'مدير الملفات', 'Browser': 'المتصفح', 'Live TV': 'التلفزيون المباشر', 'Media Center': 'الوسائط',
    'Music': 'الموسيقى', 'Photos': 'الصور', 'Gallery': 'الصور', 'Videos': 'الفيديوهات', 'Movies': 'الأفلام', 'Play Store': 'المتجر', 'Google Play Store': 'المتجر', 'YouTube': 'يوتيوب',
    'Netflix': 'نتفلكس', 'Shahid': 'شاهد', 'Calculator': 'الحاسبة', 'Clock': 'الساعة', 'Camera': 'الكاميرا', 'Store': 'المتجر', 'Weather': 'الطقس', 'Games': 'الألعاب', 'IPTV': 'القنوات' };
  function arLabel(a) {
    if (!a) return a;
    if (AR_PKG[a.pkg]) a.label = AR_PKG[a.pkg];
    else if (a.label && AR_WORDS[a.label.trim()]) a.label = AR_WORDS[a.label.trim()];
    return a;
  }
  var customIcons = load('customIcons', {});
  function visibleApps() {
    if (mode === 'hide' || mode === 'kidsel') return apps;
    if (kids.on) return apps.filter(function (a) { return kids.apps.indexOf(a.pkg) >= 0; });
    return apps.filter(function (a) { return hidden.indexOf(a.pkg) < 0; });
  }
  function pinHash(p) { var h = 2166136261; String(p || '').split('').forEach(function (c) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }); return 'h' + h.toString(36); }
  function lockedApp(pkg) { var lk = load('locks', {}) || {}; return !!(lk.pin && (lk.pkgs || []).indexOf(pkg) >= 0); }
  function unlockThen(pkg, then) {
    var lk = load('locks', {}) || {};
    askPin('التطبيق مقفول · اكتب الرمز', function (p) {
      if (p && pinHash(p) === lk.pin) { if (HAS_ANDROID && A.unlockApp) A.unlockApp(pkg, 30); then(); }
      else if (p) toast('الرمز غلط');
    });
  }
  window.onLockedApp = function (pkg) { unlockThen(pkg, function () { if (HAS_ANDROID) A.launch(pkg); }); };
  window.toastMsg = function (t) { toast(t, 6000); };
  function launchApp(pkg) {
    if (lockedApp(pkg)) { unlockThen(pkg, function () { launchApp2(pkg); }); return; }
    launchApp2(pkg);
  }
  function launchApp2(pkg) {
    if (!kidsBeforeLaunch()) return;
    pushRecent(pkg);
    if (HAS_ANDROID) { if (!A.launch(pkg)) toast('ما گدرت أفتح هذا التطبيق'); } else toast('فتح: ' + pkg);
  }
  function shade(hex, f) {
    var n = parseInt((hex || '#3a4256').slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return Math.max(0, Math.min(255, Math.round(v * f))); }
    return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
  }
  function renderApps() {
    var shp = (layout['row-apps'] || {}).shape || 'circle', iconShape = ['rounded', 'rect', 'pill', 'wide'].indexOf(shp) < 0;
    /* imported CleanYourTV looks show the apps' TV banners (or, with uniform_tiles, the icon on a tinted card) */
    if (settings.skin === 'cyt') iconShape = !!cytCfg().uniform_tiles;
    else if (osSkin() && osCfg().shape) iconShape = osCfg().shape !== 'banner';
    $('apps').innerHTML = visibleApps().map(function (a) {
      var isHidden = mode === 'kidsel' ? kids.apps.indexOf(a.pkg) < 0 : hidden.indexOf(a.pkg) >= 0, inner;
      if (customIcons[a.pkg]) inner = '<div class="tile"><img class="custom" src="' + esc(customIcons[a.pkg]) + '" alt=""></div>';
      else if (a.banner && !(iconShape && a.icon)) inner = '<div class="tile"><img class="banner" src="' + a.banner + '" alt=""></div>';
      else inner = '<div class="tile ic" style="background:linear-gradient(145deg,' + shade(a.color, 1.05) + ',' + shade(a.color, .45) + ')">' + (a.icon ? '<img src="' + a.icon + '" alt="">' : '') + '</div>';
      return '<div class="item app' + (isHidden ? ' hidden-app' : '') + '" data-kind="app" data-pkg="' + esc(a.pkg) + '">' + inner + '<span class="badge">' + (mode === 'kidsel' ? 'غير مسموح' : 'مخفي') + '</span><div class="name">' + esc(appName(a)) + '</div></div>';
    }).join('') || '<div class="item empty-card" data-kind="none">جاري تحميل التطبيقات…</div>';
    $('apps-hint').textContent = mode === 'move' ? 'وضع الترتيب: OK على التطبيق، حرّكه بالأسهم، وOK للتثبيت' : mode === 'hide' ? 'وضع الإخفاء: OK على التطبيق حتى تخفيه أو ترجعه'
      : mode === 'kidsel' ? 'تطبيقات الأطفال: OK حتى تسمح أو تمنع · رجوع للحفظ' : mode === 'icon' ? 'تغيير الأيقونة: اختار التطبيق واضغط OK · رجوع للخروج'
      : kids.on ? (kids.limit ? 'باقي ' + nf.format(kidsRemaining()) + ' دقيقة مشاهدة اليوم' : '') : '';
    renderOs();
    nav.refresh();
  }
  function saveOrder() { order = apps.map(function (a) { return a.pkg; }); save('appOrder', order); }

  // ---------- Smart-TV system looks («واجهات حسب الشركة») and imported launchers (CleanYourTV) ----------
  /* Each look replaces the whole home: the old top bar is hidden and the maker's own bar takes its place (a side rail on
     Samsung Tizen and Roku, a floating bar on One UI, tabs on Google TV, VIDAA, Fire TV and PatchWall). Every button in it
     works. Layout runs left-to-right like the makers' screens; names stay Arabic. Text only, no logos.
     settings.os lets the phone app change any part: hidden buttons, labels, colours, icon shape, rows. */
  var OSI = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    apps: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    petal: '<svg viewBox="0 0 24 24"><path d="M12 12C9.5 7 4 6.5 4 10.5S9 14 12 12zM12 12c5-2.5 5.5-8 1.5-8S10 9 12 12zM12 12c2.5 5 8 5.5 8 1.5S15 10 12 12zM12 12c-5 2.5-5.5 8-1.5 8S14 15 12 12z"/></svg>',
    live: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 3l4 4 4-4"/></svg>',
    onair: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"/><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>',
    ambient: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M7.5 14.5c1.8-3.2 7.2-3.2 9 0M12 3v5"/></svg>',
    multi: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/></svg>',
    game: '<svg viewBox="0 0 24 24"><path d="M6.5 8h11A4.5 4.5 0 0 1 22 12.5v1a3 3 0 0 1-5.4 1.8L15 13.5H9l-1.6 1.8A3 3 0 0 1 2 13.5v-1A4.5 4.5 0 0 1 6.5 8z"/><path d="M7 10.5v3M5.5 12h3"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.6-3.4 8.1-8 9-4.6-.9-8-4.4-8-9V6z"/><path d="M12 9v4"/><circle cx="12" cy="16" r=".4"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    media: '<svg viewBox="0 0 24 24"><path d="M3 6.5h6l2 2h10V19H3z"/></svg>',
    movie: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.5h18M8 5v4.5M16 5v4.5"/></svg>',
    kids: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>',
    music: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
    hub: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><rect x="7" y="12" width="10" height="8" rx="1.5"/><path d="M10 16h4"/></svg>'
  };
  /* item kinds: ic = round icon (its name shows when focused), tab = text, pill = icon and text, av = profile, sp = space,
     clk = clock. on = the page the screen is on. Each bar is a list of groups placed by the look's CSS. */
  function I(id, ic, l, on) { return { t: 'ic', id: id, ic: ic, l: l, on: on }; }
  function T(id, l, on, ic) { return { t: 'tab', id: id, l: l, on: on, ic: ic }; }
  function P(id, ic, l, on) { return { t: 'pill', id: id, ic: ic, l: l, on: on }; }
  var AV = { t: 'av', id: 'profile', l: 'الملف الشخصي' }, CLK = { t: 'clk' };
  var OS = {
    tizen: { rail: 1, bar: [[AV, I('search', 'search', 'البحث'), I('ambient', 'ambient', 'وضع الجمال'), I('apps', 'petal', 'التطبيقات'), I('home', 'home', 'الرئيسية', 1)], [I('menu', 'menu', 'القائمة'), I('shield', 'shield', 'حماية الأطفال')]],
      tabs: [T('live', 'مباشر', 0, 'onair'), T('apps', 'التطبيقات')], secs: [['الأخيرة', 1], ['مقترحة لك', 99]], kick: 'logo', btn: 'شاهد الآن', deco: 'متابعة المشاهدة' },
    oneui: { bar: [[AV, I('search', 'search', 'البحث'), I('multi', 'multi', 'عرض متعدد'), I('settings', 'settings', 'الإعدادات')],
        [I('ai', 'spark', 'المساعد'), P('home', 'home', 'لك', 1), I('live', 'live', 'التلفزيون المباشر'), I('games', 'game', 'الألعاب'), I('ambient', 'ambient', 'وضع الجمال'), I('apps', 'apps', 'التطبيقات')], [I('shield', 'shield', 'حماية الأطفال')]],
      secs: [['يُعرض الآن', 1], ['مقترح لك', 99]], kick: 'logo', btn: 'شاهد الآن', dots: 1 },
    webos: { bar: [[AV, I('search', 'search', 'البحث'), I('home', 'home', 'الرئيسية', 1), I('inputs', 'hub', 'لوحة المنزل')], [I('settings', 'settings', 'الإعدادات'), I('menu', 'menu', 'القائمة'), CLK]],
      secs: [['بطاقاتي', 99]], kick: 'greet', btn: 'افتح', cards: 'tall' },
    vidaa: { bar: [[T('home', 'الرئيسية', 1), T('apps', 'التطبيقات'), T('inputs', 'المداخل'), T('media', 'الوسائط')], [I('search', 'search', 'البحث'), I('wifi', 'wifi', 'الشبكة'), I('settings', 'settings', 'الإعدادات'), I('menu', 'menu', 'القائمة'), CLK]],
      secs: [['المفضلة', 99]], kick: 'مختار لك', btn: 'افتح' },
    googletv: { bar: [[I('search', 'search', 'البحث'), T('home', 'لك', 1), T('movies', 'أفلام'), T('shows', 'مسلسلات'), T('apps', 'تطبيقات'), T('library', 'مكتبة')], [I('bell', 'bell', 'الإشعارات'), AV, I('settings', 'settings', 'الإعدادات'), I('menu', 'menu', 'القائمة'), CLK]],
      nofeat: 1, apps: 'تطبيقاتك', kick: 'مقترح', btn: 'افتح' },
    androidtv: { bar: [[I('search', 'mic', 'البحث')], [CLK, I('inputs', 'input', 'المداخل'), I('wifi', 'wifi', 'الشبكة'), I('settings', 'settings', 'الإعدادات'), I('menu', 'menu', 'القائمة')]],
      secs: [['القنوات', 99]], apps: 'التطبيقات المفضلة', nohero: 1 },
    firetv: { bar: [[AV, I('home', 'home', 'الرئيسية', 1), I('search', 'search', 'البحث'), I('live', 'live', 'مباشر'), I('apps', 'apps', 'تطبيقاتي'), I('settings', 'settings', 'الإعدادات'), I('menu', 'menu', 'القائمة')], [CLK]],
      nofeat: 1, apps: 'تطبيقاتك وقنواتك', kick: 'مميّز', btn: 'افتح' },
    roku: { rail: 1, bar: [[T('home', 'الرئيسية', 1), T('watch', 'ماذا يُعرض'), T('search', 'البحث'), T('live', 'البث المباشر'), T('apps', 'متجر القنوات'), T('settings', 'الإعدادات')], [T('menu', 'خيارات ✱')]],
      grid: 4, nohero: 1, nofeat: 1, clock: 1 },
    patchwall: { bar: [[T('home', 'الرئيسية', 1), T('movies', 'أفلام'), T('shows', 'مسلسلات'), T('kids', 'أطفال'), T('apps', 'تطبيقات')], [I('search', 'search', 'البحث'), I('inputs', 'input', 'المداخل'), I('settings', 'settings', 'الإعدادات'), I('menu', 'menu', 'القائمة'), CLK]],
      secs: [['مختارات', 99]], kick: 'الأكثر مشاهدة', btn: 'افتح', cards: 'poster' },
    cyt: { cyt: 1, nohero: 1, nofeat: 1 }
  };
  var heroI = 0;
  function osSkin() { return OS[settings.skin] ? settings.skin : null; }
  function osCfg() { return settings.os || {}; }
  function cytCfg() { return settings.cyt || {}; }
  function osLtr() { var k = osSkin(); return !!k && osCfg().rtl !== true; }
  function osGrid() {
    var k = osSkin(); if (!k) return 0;
    if (k === 'cyt') { var c = cytCfg(); return c.single_row ? 0 : Math.max(1, Math.min(8, +c.columns || 4)); }
    return +osCfg().grid || OS[k].grid || 0;
  }
  function appName(a) { return (settings.appLabels && settings.appLabels[a.pkg]) || a.label; }
  function greetWord() { var h = new Date(Date.now() + 3 * 3600000).getUTCHours(); return h < 5 ? 'مساء الخير' : h < 12 ? 'صباح الخير' : h < 17 ? 'نهارك سعيد' : 'مساء الخير'; }
  function recentApps() { return load('recentApps', []) || []; }
  function pushRecent(pkg) { var l = recentApps().filter(function (p) { return p !== pkg; }); l.unshift(pkg); try { localStorage.setItem('recentApps', JSON.stringify(l.slice(0, 12))); } catch (e) {} }
  function cardHtml(a, cls, sec) {
    var art = customIcons[a.pkg] ? '<img class="oc-ic" src="' + esc(customIcons[a.pkg]) + '" alt="">'
      : a.banner ? '<img class="oc-bn" src="' + a.banner + '" alt="">' : a.icon ? '<img class="oc-ic" src="' + a.icon + '" alt="">' : '<span class="oc-lt">' + esc(appName(a)) + '</span>';
    return '<div class="item app ' + cls + '" data-kind="app" data-pkg="' + esc(a.pkg) + '">' + (sec ? '<div class="oc-sec">' + esc(sec) + '</div>' : '') +
      '<div class="oc-img" style="background:linear-gradient(145deg,' + shade(a.color, 1.12) + ',' + shade(a.color, .42) + ')">' + art + '</div><div class="oc-t">' + esc(appName(a)) + '</div></div>';
  }
  function osItem(it) {
    var oc = osCfg(), lab = (oc.labels && oc.labels[it.id]) || it.l || '';
    if (it.t === 'clk') return '<span class="osb-clk" data-oclk></span>';
    if (it.id && (oc.barOff || []).indexOf(it.id) >= 0) return '';
    var on = oc.page ? oc.page === it.id : it.on;
    var inner = it.t === 'av' ? (oc.avatar ? '<span class="osb-av"><img src="' + esc(oc.avatar) + '" alt=""></span>' : '<span class="osb-av">' + esc((settings.owner || 'م').trim().charAt(0)) + '</span>') : it.t === 'tab' ? '' : (OSI[it.ic] || ICONS[it.ic] || '');
    if (it.t === 'tab') inner = '<span class="osb-l">' + esc(lab) + '</span>' + (it.ic ? '<i class="osb-ti">' + (OSI[it.ic] || '') + '</i>' : '');
    else if (it.t === 'pill') inner += '<span class="osb-l">' + esc(lab) + '</span>';
    else inner += '<span class="osb-tip">' + esc(lab) + '</span>';
    return '<div class="item osb osb-' + it.t + (on ? ' on' : '') + '" data-kind="osb" data-id="' + it.id + '"' + (it.id === 'live' ? ' data-lp="1"' : '') + '>' + inner + '</div>';
  }
  function cytBar() {
    var c = cytCfg(), g = [], io = c.icon_only_buttons, online = navigator.onLine !== false;
    (c.top_bar_apps || []).forEach(function (p) {
      var a = null; for (var i = 0; i < apps.length; i++) if (apps[i].pkg === p) a = apps[i];
      if (a) g.push('<div class="item app osb osb-ic osb-app" data-kind="app" data-pkg="' + esc(a.pkg) + '">' + (customIcons[a.pkg] || a.icon ? '<img src="' + esc(customIcons[a.pkg] || a.icon) + '" alt="">' : '') + '<span class="osb-tip">' + esc(appName(a)) + '</span></div>');
    });
    var it = function (id, ic, l, round) { return osItem(round ? I(id, ic, l) : P(id, ic, l)); };
    if (c.show_inputs_pill !== false && (IS_TV || PREVIEW)) g.push(it('inputs', 'input', 'المداخل', c.icon_only_inputs));
    if (c.show_network_pill !== false) g.push(it('wifi', 'wifi', online ? 'متصل' : 'غير متصل', io).replace('osb ', 'osb' + (c.wifi_status_color ? online ? ' wok' : ' woff' : '') + ' '));
    if (c.app_library && c.library_button) g.push(it('library', 'apps', 'مكتبة التطبيقات', true));
    if (c.top_menu) g.push(it('menu', 'settings', 'القائمة', true));
    else g.push(it('settings', 'settings', 'الإعدادات', io));
    g.push(it('menu', 'menu', 'القائمة', true));
    return '<div class="osb-g osb-g2">' + g.join('') + '</div>';
  }
  function renderOs() {
    var k = osSkin(), o = k ? OS[k] : null, b = document.body, oc = osCfg(), bar = $('row-osbar');
    b.classList.toggle('os', !!k);
    b.classList.toggle('ltr', osLtr());
    if (o && o.rail) bar.classList.add('vrow'); else bar.classList.remove('vrow');
    var gr = osGrid(); if (gr) b.setAttribute('data-grid', String(gr)); else b.removeAttribute('data-grid');
    b.setAttribute('data-osshape', oc.shape || '');
    var st = b.style;
    if (oc.accent) st.setProperty('--osac', oc.accent); else st.removeProperty('--osac');
    if (!k) { b.removeAttribute('data-osw'); b.classList.remove('osmatch'); ['row-osbar', 'osHero', 'osTabs', 'osFeat', 'osHead', 'osTitle', 'osDeco'].forEach(function (id) { $(id).innerHTML = ''; }); $('osGlow').style.background = ''; $('osArt').style.backgroundImage = ''; cytLook(null); return; }
    var vis = visibleApps().filter(function (a) { return a.pkg; });
    if (o.cyt) { ['row-hero', 'row-ostabs', 'row-feat'].forEach(function (id) { $(id).style.display = 'none'; }); bar.innerHTML = cytBar(); cytLook(cytCfg()); renderCytHead(); $('osHero').innerHTML = ''; $('osFeat').innerHTML = ''; $('osTabs').innerHTML = ''; $('osDeco').innerHTML = ''; }
    else {
      cytLook(null); $('osHead').innerHTML = ''; $('osTitle').innerHTML = '';
      bar.innerHTML = o.bar.map(function (g, i) { return '<div class="osb-g osb-g' + (i + 1) + '">' + g.map(osItem).join('') + '</div>'; }).join('');
      $('osTabs').innerHTML = (o.tabs || []).map(osItem).join('');
      /* the top area shows a widget the user picks (news, hadith/ayah, weather, clock…), not a rotating app */
      var hero = null, hw = oc.heroW || (settings.religious === false ? 'news' : 'wisdom');
      if (hw === 'news' && !(settings.news && settings.news.on)) hw = 'clock';
      b.setAttribute('data-osw', oc.hero === false ? 'none' : hw);
      b.classList.toggle('osmatch', !!o.deco && oc.matches !== false);
      $('row-hero').style.display = hero ? '' : 'none';
      $('row-ostabs').style.display = o.tabs ? '' : 'none';
      $('row-feat').style.display = o.nofeat || oc.feat === false || !vis.length ? 'none' : '';
      if (hero) {
        var n = Math.min(5, vis.length), dots = '', kick = o.kick === 'greet' ? greetWord() : o.kick === 'logo' ? '' : o.kick || '';
        for (var i = 0; i < n; i++) dots += '<i' + (i === heroI % n ? ' class="on"' : '') + '></i>';
        var logo = o.kick === 'logo' ? (customIcons[hero.pkg] || hero.icon ? '<img class="oh-lg" src="' + esc(customIcons[hero.pkg] || hero.icon) + '" alt="">' : '') : '';
        $('osHero').innerHTML = '<div class="item app ohero" data-kind="app" data-pkg="' + esc(hero.pkg) + '">' + (kick ? '<div class="oh-k">' + esc(kick) + '</div>' : '') +
          '<div class="oh-t">' + esc(appName(hero)) + '</div>' + logo + '<div class="oh-b"><svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>' + esc((oc.labels && oc.labels.watch) || o.btn || 'افتح') + '</div>' + (o.dots ? '<div class="oh-dots">' + dots + '</div>' : '') + '</div>';
      } else $('osHero').innerHTML = '';
      /* cards: the apps opened last first («الأخيرة»), then the rest */
      var rec = recentApps(), byPkg = {}; vis.forEach(function (a) { byPkg[a.pkg] = a; });
      var cards = rec.map(function (p) { return byPkg[p]; }).filter(Boolean); vis.forEach(function (a) { if (cards.indexOf(a) < 0) cards.push(a); });
      var secs = oc.featTitle ? [[oc.featTitle, 99]] : o.secs || [['', 99]], si = 0, left = secs[0][1];
      $('osFeat').innerHTML = cards.slice(0, 9).map(function (a, i) {
        var lab = ''; if (i === 0) lab = secs[0][0]; else if (left <= 0 && si + 1 < secs.length) { si++; left = secs[si][1]; lab = secs[si][0]; }
        left--; return cardHtml(a, 'ocard' + (o.cards ? ' oc-' + o.cards : ''), lab);
      }).join('');
      $('osDeco').innerHTML = false ? '<div class="od-t">' + esc(o.deco) + '</div><div class="od-r">' + cards.slice(2, 8).map(function (a) { return '<i style="background:linear-gradient(145deg,' + shade(a.color, 1.1) + ',' + shade(a.color, .4) + ')"></i>'; }).join('') + '</div>' : '';
    }
    var at = document.querySelector('#row-apps .row-title');
    if (at && at.firstChild) at.firstChild.nodeValue = (oc.appsTitle || o.apps || 'التطبيقات') + ' ';
    paintHero(); osClock();
    if (!bar.dataset.ri || bar.dataset.k !== k) { bar.dataset.k = k; bar.dataset.ri = '1'; if (typeof nav !== 'undefined') nav.railHome(); }
  }
  function paintHero() {
    var h = document.querySelector('#osHero .ohero'); if (!h) return;
    h.style.backgroundImage = bgCur ? 'url("' + bgCur + '")' : '';
  }
  function osClock() {
    var hm = $('hm') ? $('hm').textContent : '', ap = $('ampm') ? $('ampm').textContent : '';
    qa('[data-oclk]').forEach(function (e) { e.textContent = hm + (ap ? ' ' + ap : ''); });
    var ch = $('cytClock'); if (ch) renderCytHead();
  }
  setInterval(function () { if (osSkin()) osClock(); }, 15000);

  /* ---- CleanYourTV look: greeting and clock, pills on the right, the dock band and the app grid under it ---- */
  function renderCytHead() {
    var c = cytCfg(), now = new Date(Date.now() + 3 * 3600000);
    var h = now.getUTCHours(), m = now.getUTCMinutes(), f12 = c.clock_format === '12' || (c.clock_format !== '24' && settings.clock24 !== true);
    var hh = f12 ? (h % 12 || 12) : h, t = hh + ':' + (m < 10 ? '0' : '') + m, ap = f12 ? (h < 12 ? 'ص' : 'م') : '';
    var days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'], mons = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
    var nm = c.greeting_name || '', gw = (c.greeting || greetWord()) + (nm ? '، ' + nm : '');
    $('osHead').innerHTML = (c.show_greeting === false ? '' : '<div class="cy-g">' + esc(gw) + '</div>') +
      '<div class="cy-row' + (c.date_below_clock ? ' below' : '') + '"><div class="cy-clk" id="cytClock">' + t + (ap ? '<small>' + ap + '</small>' : '') + '</div><i class="cy-div"></i>' +
      '<div class="cy-date"><span>' + days[now.getUTCDay()] + '</span><span>' + now.getUTCDate() + ' ' + mons[now.getUTCMonth()] + '</span></div></div>';
  }
  function skyColor() {
    var h = new Date(Date.now() + 3 * 3600000).getUTCHours();
    return h < 5 ? '#0b1640' : h < 7 ? '#6b4a8a' : h < 10 ? '#3f86c8' : h < 16 ? '#2b78c2' : h < 18 ? '#d9824a' : h < 20 ? '#5a3a7a' : '#0b1640';
  }
  function cytLook(c) {
    var b = document.body, st = b.style, on = !!c;
    ['cy-band', 'cy-glass', 'cy-names', 'cy-glow', 'cy-cine', 'cy-calm', 'cy-white', 'cy-fade', 'cy-single', 'cy-rim', 'cy-halo', 'cy-notitle', 'cy-nobg'].forEach(function (x) { b.classList.remove(x); });
    if (!on) { ['--cy-cols', '--cy-bg', '--cy-dim', '--cy-op', '--cy-sky'].forEach(function (x) { st.removeProperty(x); }); return; }
    var cols = c.single_row ? 0 : Math.max(1, Math.min(8, +c.columns || 4));
    st.setProperty('--cy-cols', String(cols || 5));
    st.setProperty('--cy-bg', /^#[0-9a-f]{6}$/i.test(c.background_color || '') ? c.background_color : '#000000');
    st.setProperty('--cy-dim', String(Math.max(0, Math.min(90, +c.wallpaper_dim || 0)) / 100));
    st.setProperty('--cy-op', String(Math.max(30, Math.min(100, c.dock_opacity == null ? 100 : +c.dock_opacity)) / 100));
    var sky = Math.max(0, Math.min(100, +c.sky_intensity || 0)) / 100;
    st.setProperty('--cy-sky', sky ? 'linear-gradient(180deg,' + hexA(skyColor(), sky) + ' 0%,' + hexA(skyColor(), sky * .35) + ' 55%, rgba(0,0,0,0) 100%)' : 'none');
    b.classList.toggle('cy-band', c.dock_band !== false && c.dock_row !== false);
    b.classList.toggle('cy-glass', !!c.dock_glass);
    b.classList.toggle('cy-names', !!c.always_show_names);
    b.classList.toggle('cy-glow', c.ambient_glow !== false && !c.cinematic_home);
    b.classList.toggle('cy-cine', !!c.cinematic_home);
    b.classList.toggle('cy-calm', !!c.reduced_motion || c.focus_overshoot === false);
    b.classList.toggle('cy-white', !!c.header_white);
    b.classList.toggle('cy-fade', !!c.fade_rows);
    b.classList.toggle('cy-single', !cols);
    b.classList.toggle('cy-rim', c.glass_style === 'rim');
    b.classList.toggle('cy-halo', c.glass_style === 'halo');
    b.classList.toggle('cy-notitle', c.dock_title === false && !c.cinematic_home);
    b.classList.toggle('cy-nobg', c.wallpaper === false);
    var tw = cols ? Math.floor((1680 - 36 * (cols - 1)) / cols) : 330;
    st.setProperty('--cy-tw', tw + 'px'); st.setProperty('--cy-th', Math.round(tw * (cols >= 6 ? .6 : .5625)) + 'px');
    var band = $('apps').querySelector('.cy-band-el');
    if (!band) $('apps').insertAdjacentHTML('afterbegin', '<div class="cy-band-el"></div>');
  }
  function hexA(h, a) { var c = hexRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  /* the focused app colours the glow, the big name above the dock and the cinematic shelf */
  function osFocus(el) {
    if (!el || settings.skin !== 'cyt') return;
    var c = cytCfg(), pkg = el.getAttribute('data-pkg'), a = null;
    for (var i = 0; i < apps.length; i++) if (apps[i].pkg === pkg) a = apps[i];
    var inDock = el.parentNode === $('apps') && (osGrid() ? qa('.item', $('apps')).indexOf(el) < osGrid() : true);
    $('osTitle').innerHTML = a && inDock ? '<div class="cy-t">' + esc(appName(a)) + '</div>' + (c.cinematic_home ? '<div class="cy-last">آخر ما فتحته</div>' : '') +
      ((c.cinematic_home && c.cinematic_dots !== false) || c.dock_title !== false ? '<div class="cy-dots">' + qa('.item', $('apps')).slice(0, Math.min(osGrid() || 6, 8)).map(function (x) { return '<i' + (x === el ? ' class="on"' : '') + '></i>'; }).join('') + '</div>' : '') : '';
    var col = a && a.color ? a.color : '#3a4256';
    if (c.ambient_glow !== false && !c.cinematic_home) $('osGlow').style.background = c.glow_style === 'horizon' ? 'linear-gradient(180deg,' + hexA(col, .75) + ' 0%,' + hexA(col, .25) + ' 35%,rgba(0,0,0,0) 70%)'
      : 'radial-gradient(42% 55% at 36% 30%,' + hexA(col, .85) + ' 0%,' + hexA(col, .3) + ' 45%,rgba(0,0,0,0) 75%)';
    else $('osGlow').style.background = '';
    var art = $('osArt');
    if (c.cinematic_home && a) { art.style.backgroundImage = a.banner || customIcons[a.pkg] || a.icon ? 'url("' + (customIcons[a.pkg] || a.banner || a.icon) + '")' : ''; art.style.backgroundColor = col; art.style.opacity = String((c.cinematic_art == null ? 50 : +c.cinematic_art) / 100); }
    else { art.style.backgroundImage = ''; art.style.opacity = '0'; }
    if (c.app_glow) el.style.setProperty('--cy-glowc', hexA(col, .9)); else el.style.removeProperty('--cy-glowc');
  }

  /* ---- what each button in the makers' bars does ---- */
  var RE_VIDEO = /netflix|shahid|prime|amazon|disney|osn|youtube|vodu|starz|weyyak|watchit|tod|hbo|wbd|pluto|apple|kodi|vlc|iptv|smarttube|tv\.|video|movie|film/i;
  function openAppsList(title, re) {
    var all = visibleApps().filter(function (a) { return a.pkg; }), l = re ? all.filter(function (a) { return re.test(a.pkg + ' ' + a.label); }) : all;
    if (!l.length) l = all;
    openList(title, 'اختار التطبيق واضغط OK · رجوع للإغلاق', function () {
      return l.map(function (a) { return { label: appName(a), value: '', act: function (k) { if (k !== 'ok') return; closeModal(); launchApp(a.pkg); return false; } }; });
    });
  }
  function liveApp() { for (var i = 0; i < apps.length; i++) if (/tvcenter|\.android\.tv$|livetv|live\.tv|tvplayer|\.tv\.tuner|iptv|channels/i.test(apps[i].pkg)) return apps[i].pkg; return null; }
  function openOsMenu() {
    var rows = [
      ['خلفية الشاشة', function () { openPicker(); }], ['الثيمات والألوان', function () { openThemes(); }], ['إعدادات الواجهة', function () { openSettings(); }],
      ['تعديل الشاشة', function () { openEdit(); }], ['ترتيب التطبيقات', function () { setMode('move'); nav.goId('row-apps'); }], ['إخفاء التطبيقات', function () { setMode('hide'); nav.goId('row-apps'); }],
      ['تغيير أيقونة تطبيق', function () { setMode('icon'); nav.goId('row-apps'); }], ['وضع الأطفال', function () { toggleKids(); }],
      ['شاشة التوقف', function () { if (!PREVIEW) startSaver(); }], ['الطاقة', function () { openPower(); }], ['إعدادات الجهاز', function () { if (HAS_ANDROID) A.openSettings(); }],
      ['تحديث', function () { toast('جاري التحديث…'); loadApps(true); showBg(); }]
    ];
    rows.splice(1, 0, ['تطبيق زر «مباشر»', function () { pickLiveApp(false); }], ['شريط النتائج المباشرة: ' + (settings.ticker === false ? 'متوقف' : 'شغّال'), function () { settings.ticker = settings.ticker === false; saveSettings(); renderTicker(); toast(settings.ticker === false ? 'وقف شريط النتائج' : 'اشتغل شريط النتائج'); }]);
    if (settings.religious !== false) rows.splice(7, 0, ['القرآن الكريم', function () { openQuran(); }]);
    openList('القائمة', 'اختار واضغط OK · رجوع للإغلاق', function () {
      return rows.map(function (r) { return { label: r[0], value: '', act: function (k) { if (k !== 'ok') return; closeModal(); r[1](); return false; } }; });
    });
  }
  function pickLiveApp(open) {
    var all = visibleApps().filter(function (a) { return a.pkg; }), cur = load('osLiveApp', null);
    openList('تطبيق زر «مباشر»', 'اختار التطبيق مرة وحدة ويبقى محفوظ · اضغط مطوّل على الزر حتى تغيّره', function () {
      return all.map(function (a) { return { label: appName(a), value: a.pkg === cur ? '✅' : '', act: function (k) { if (k !== 'ok') return; try { localStorage.setItem('osLiveApp', JSON.stringify(a.pkg)); } catch (e) {} closeModal(); toast('صار زر «مباشر» يفتح ' + appName(a)); if (open) launchApp(a.pkg); return false; } }; });
    });
  }
  function osLong(el) {
    if (el && el.getAttribute('data-id') === 'live') pickLiveApp(false);
  }
  function osAct(id) {
    if (id === 'home') { nav.home(); return; }
    if (id === 'search' || id === 'ai') return openSearch();
    if (id === 'settings') { if (HAS_ANDROID) A.openSettings(); else toast('إعدادات الجهاز'); return; }
    if (id === 'profile') return openSettings();
    if (id === 'menu') return openOsMenu();
    if (id === 'apps' || id === 'library') return openAppsList('كل التطبيقات', null);
    if (id === 'games') return openAppsList('الألعاب', /game|xbox|geforce|boosteroid|steam|moonlight|luna|play\.games|pubg|fifa|emulat/i);
    if (id === 'movies' || id === 'shows' || id === 'watch') return openAppsList(id === 'shows' ? 'المسلسلات' : id === 'watch' ? 'ماذا يُعرض' : 'الأفلام', RE_VIDEO);
    if (id === 'kids') return openAppsList('الأطفال', /kids|spacetoon|cartoon|baby|junior|toon|disney/i);
    if (id === 'media') return openAppsList('الوسائط', /file|gallery|photo|music|player|vlc|kodi|media|explorer|documents/i);
    if (id === 'music') return openAppsList('الموسيقى', /music|spotify|anghami|deezer|audio|radio|sound/i);
    if (id === 'live') {
      /* «مباشر» opens the app the user picked once (saved on this screen); hold OK on it to pick another */
      var lv = load('osLiveApp', null);
      if (lv && apps.some(function (a) { return a.pkg === lv; })) return launchApp(lv);
      return pickLiveApp(true);
    }
    if (id === 'inputs') {
      if (HAS_ANDROID && IS_TV && id === 'inputs') return tvAction('tvinput');
      var lp = liveApp(); if (lp) return launchApp(lp);
      if (HAS_ANDROID && IS_TV) return tvAction('tvinput');
      return toast('ماكو تلفزيون مباشر بهالجهاز');
    }
    if (id === 'ambient') { if (!PREVIEW) startSaver(); else toast('شاشة التوقف'); return; }
    if (id === 'multi') return openPicker();
    if (id === 'wifi') { if (HAS_ANDROID) A.openWifi(); else toast('الواي فاي'); return; }
    if (id === 'shield') return toggleKids();
    if (id === 'bell') return toast(settings.owner ? 'أهلاً ' + settings.owner + '، ماكو إشعارات جديدة' : 'ماكو إشعارات جديدة');
    if (id === 'power') return openPower();
  }

  // ---------- Icons ----------
  var ICONS = {
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    wifi: '<svg viewBox="0 0 24 24"><path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M5 12.6a10 10 0 0 1 14 0"/><path d="M8.5 16.3a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/></svg>',
    power: '<svg viewBox="0 0 24 24"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>',
    input: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4M9 10.5h6M12 8v5"/></svg>',
    picture: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
    bt: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10-5 4V3l5 4L7 17"/></svg>',
    net: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    broom: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 6V3M12 6V3M16 6V3M8 21v-3M12 21v-3M16 21v-3M9 10h6v4H9z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
    dim: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    restart: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    move: '<svg viewBox="0 0 24 24"><path d="M5 9l-3 3 3 3M19 9l3 3-3 3M2 12h20"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 10c0-3.9-4.5-7-10-7z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V4.5"/><path d="M9 7h7M9 11h5"/></svg>',
    child: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3"/><path d="M6 21v-6l-2-4h16l-2 4v6"/><path d="M10 21v-5h4v5"/></svg>',
    sliders: '<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/></svg>'
  };

  // ---------- Top glass bar ----------
  /* the top bar is customisable: settings.topTools is the user's ordered list, settings.inputsBtn shows «المداخل» in the exact centre */
  var TOP_TOOLS = {
    saver: ['شاشة التوقف', 'moon', 1], search: ['البحث', 'search'], settings: ['إعدادات الجهاز', 'settings'], wifi: ['الواي فاي', 'wifi'],
    net: ['الشبكة', 'net'], bt: ['البلوتوث', 'bt'], mem: ['تنظيف الذاكرة', 'broom'], mute: ['كتم الصوت', 'mute'], sleep: ['مؤقت النوم', 'timer'],
    edit: ['تعديل الشاشة', 'edit'], power: ['الطاقة', 'power'], tvpic: ['الصورة', 'picture', 1], tvsound: ['الصوت', 'sound', 1], tvdim: ['تعتيم', 'dim', 1]
  };
  function topToolList() {
    var l = settings.topTools && settings.topTools.length ? settings.topTools.slice() : null;
    if (!l) { l = ['saver', 'search', 'settings', 'wifi', 'edit', 'power']; if (tvShortcutsOn()) l = ['tvpic', 'tvsound', 'sleep', 'tvdim'].concat(l); }
    return l.filter(function (id) { return TOP_TOOLS[id] && !(id === 'saver' && settings.saverOn === false); });
  }
  function inputsOn() { var m = settings.inputsBtn || 'auto'; return m === 'on' || (m === 'auto' && tvShortcutsOn()); }
  function topItem(id) {
    var t = TOP_TOOLS[id], lbl = t[0], ic = t[1];
    if (id === 'sleep') lbl = tvSleepLabel();
    if (id === 'tvdim' && tvDim) lbl = 'تعتيم ' + nf.format(tvDim) + '٪';
    if (id === 'mute') { var m = false; try { m = HAS_ANDROID && A.isMuted ? A.isMuted() : false; } catch (e) {} lbl = m ? 'شغّل الصوت' : 'كتم الصوت'; ic = m ? 'mute' : 'sound'; }
    var pill = t[2] || id === 'sleep' && tvSleepLabel() !== 'مؤقت النوم';
    return '<div class="item glass' + (pill ? ' tvb' : '') + (id === 'saver' ? ' saverb' : '') + '" data-kind="top" data-id="' + id + '">' + (ICONS[ic] || ICONS.settings) + '<span class="lbl">' + lbl + '</span></div>';
  }
  function renderTopbar() {
    var l = topToolList(), tb = $('topbar');
    if (inputsOn()) {
      var half = Math.ceil(l.length / 2);
      tb.classList.add('split');
      tb.innerHTML = '<div class="tg tg1">' + l.slice(0, half).map(topItem).join('') + '</div>' +
        '<div class="item glass tvb inb" data-kind="top" data-id="tvinput">' + ICONS.input + '<span class="lbl">المداخل</span></div>' +
        '<div class="tg tg2">' + l.slice(half).map(topItem).join('') + '</div>';
    } else { tb.classList.remove('split'); tb.innerHTML = l.map(topItem).join(''); }
    fitTopbar();
  }
  /* many tools: the bar shrinks step by step so it never covers the clock or the other widgets */
  function fitTopbar() {
    var tb = $('topbar'); if (!tb) return;
    tb.classList.remove('c1', 'c2', 'c3');
    var hit = function () {
      var r = tb.getBoundingClientRect(), ids = ['timeblock', 'adhanbox', 'weather', 'wisdom'];
      var its = tb.querySelectorAll('.item'); if (!its.length) return false;
      var a = its[0].getBoundingClientRect(), z = its[its.length - 1].getBoundingClientRect();
      var L = Math.min(a.left, z.left), R = Math.max(a.right, z.right), T = r.top, Bm = r.bottom;
      for (var i = 0; i < ids.length; i++) {
        var e = document.getElementById(ids[i]); if (!e || !e.offsetWidth) continue;
        var q = e.getBoundingClientRect();
        if (q.left < R && q.right > L && q.top < Bm && q.bottom > T) return true;
      }
      return false;
    };
    var steps = ['c1', 'c2', 'c3'];
    for (var k = 0; k < steps.length && hit(); k++) tb.classList.add(steps[k]);
  }
  // ---------- TV-only shortcuts (picture source, picture, sound, sleep, dim) ----------
  var IS_TV = (function () { try { return HAS_ANDROID && A.isTv ? !!A.isTv() : !!window.__DEMO_TV; } catch (e) { return false; } })();
  var tvDim = 0;
  function tvShortcutsOn() { var m = settings.tvCtl || 'auto'; return IS_TV && m !== 'off'; }
  function tvSleepLabel() { var ms = 0; try { ms = HAS_ANDROID && A.tvSleepLeft ? A.tvSleepLeft() : 0; } catch (e) {} return ms > 0 ? 'نوم بعد ' + nf.format(Math.ceil(ms / 60000)) + ' د' : 'مؤقت النوم'; }
  function tvAction(id) {
    if (id === 'tvinput') {
      var list = []; try { list = JSON.parse(A.tvInputs()) || []; } catch (e) {}
      if (!list.length) { toast('ما لگيت مداخل بهالشاشة'); return; }
      openList('اختيار المصدر', 'اختار المدخل واضغط OK · رجوع للإغلاق', function () {
        return list.map(function (x) { return { label: x.label, value: x.kind === 'hdmi' ? '🔌' : x.kind === 'tuner' ? '📡' : '', act: function () { closeModal(); if (!A.tvOpenInput(x.id, !!x.pass)) toast('ما گدرت أفتح هذا المدخل'); return false; } }; });
      });
    } else if (id === 'tvpic') { if (!A.tvPicture()) toast('ما گدرت أفتح إعدادات الصورة'); }
    else if (id === 'tvsound') { if (!A.tvSound()) toast('ما گدرت أفتح إعدادات الصوت'); }
    else if (id === 'tvsleep') {
      openList('مؤقت النوم', 'الشاشة تنطفي وحدها بعد الوقت اللي تختاره', function () {
        return [[0, 'إلغاء المؤقت'], [15, '١٥ دقيقة'], [30, '٣٠ دقيقة'], [60, 'ساعة'], [90, 'ساعة ونص'], [120, 'ساعتين']].map(function (x) {
          return { label: x[1], value: '', act: function () { A.tvSleep(x[0]); closeModal(); renderTopbar(); nav.refresh(); toast(x[0] ? 'الشاشة تنطفي بعد ' + x[1] : 'انلغى مؤقت النوم'); return false; } };
        });
      });
    } else if (id === 'tvdim') {
      var steps = [0, 20, 40, 60]; tvDim = steps[(steps.indexOf(tvDim) + 1) % steps.length];
      A.tvDim(tvDim); renderTopbar(); nav.refresh(); toast(tvDim ? 'تعتيم الشاشة ' + nf.format(tvDim) + '٪' : 'رجعت الإضاءة طبيعية');
    }
  }

  // ---------- News widget (club news, or Arabic headlines) ----------
  var NEWS_LG = { 86: 'esp.1', 83: 'esp.1', 1068: 'esp.1', 364: 'eng.1', 382: 'eng.1', 360: 'eng.1', 359: 'eng.1', 363: 'eng.1', 367: 'eng.1', 132: 'ger.1', 124: 'ger.1', 160: 'fra.1', 111: 'ita.1', 110: 'ita.1', 103: 'ita.1', 114: 'ita.1' };
  var newsItems = [], newsIdx = 0, newsLabel = '';
  function getTextAny(url) {
    try { if (PREVIEW && window.parent.__pvFetch) return window.parent.__pvFetch(url); } catch (e) {}
    return window.__saverFetch(url);
  }
  function newsSrc() { var n = settings.news || {}, s = n.src || 'auto'; if (s === 'auto') s = settings.team && settings.team.ids ? 'club' : 'arabic'; if (s === 'club' && !(settings.team && settings.team.ids)) s = 'arabic'; return s; }
  function renderNews() {
    var el = $('newscard'), n = settings.news || {}; newsTimer();
    if (!n.on || !newsItems.length) { el.classList.remove('on'); el.innerHTML = ''; return; }
    var it = newsItems[newsIdx % newsItems.length];
    el.classList.add('on');
    el.innerHTML = (it.img ? '<div class="ni" style="background-image:url(&quot;' + esc(it.img) + '&quot;)"></div>' : '') +
      '<div class="nt"><small><span class="nsrc">' + esc(newsLabel) + '</span>' + (it.d ? '<span class="nd">' + esc(it.d) + '</span>' : '') + '</small><b>' + esc(it.t) + '</b></div><div class="bar"></div>';
    clampLayout(); try { fitTopbar(); } catch (e) {}
  }
  function refreshNews(force) {
    var n = settings.news || {};
    if (!n.on) { newsItems = []; renderNews(); return; }
    var src = newsSrc(), id = settings.team && settings.team.ids && settings.team.ids[0], key = 'newsCache_' + src + (src === 'club' ? '_' + id : '');
    newsLabel = src === 'club' ? 'أخبار ' + (settings.team.name || 'النادي') : 'بي بي سي عربي';
    var c = load(key, null);
    if (c && c.items && c.items.length) { newsItems = c.items; renderNews(); }
    if (!force && c && Date.now() - c.t < 30 * 60000) return;
    var dfmt = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: TZ });
    var job = src === 'club'
      ? getTextAny('https://site.api.espn.com/apis/site/v2/sports/soccer/' + (NEWS_LG[id] || 'all') + '/news?team=' + id + '&limit=10').then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          return ((j && j.articles) || []).map(function (a) { return { t: a.headline, img: a.images && a.images[0] ? a.images[0].url : '', d: a.published ? dfmt.format(new Date(a.published)) : '' }; });
        })
      : getTextAny('https://feeds.bbci.co.uk/arabic/rss.xml').then(function (x) {
          if (!x) return [];
          var doc = new DOMParser().parseFromString(x, 'text/xml'), out = [];
          Array.prototype.forEach.call(doc.getElementsByTagName('item'), function (it) {
            var th = it.getElementsByTagName('media:thumbnail')[0] || it.getElementsByTagName('thumbnail')[0], d = (it.getElementsByTagName('pubDate')[0] || {}).textContent;
            out.push({ t: ((it.getElementsByTagName('title')[0] || {}).textContent || '').trim(), img: th ? (th.getAttribute('url') || '').replace(/\/\d+\//, '/480/') : '', d: d ? dfmt.format(new Date(d)) : '' });
          });
          return out;
        });
    job.then(function (items) { items = (items || []).filter(function (x) { return x.t; }).slice(0, 10); if (items.length) { newsItems = items; save(key, { t: Date.now(), items: items }); renderNews(); } }).catch(function () {});
  }
  var newsT = null, newsEvery = 0;
  function newsTimer() {
    var ms = Math.max(5, +(((typeof settings !== 'undefined' && settings && settings.news) || {}).every) || 12) * 1000; if (ms === newsEvery) return; newsEvery = ms;
    clearInterval(newsT); newsT = setInterval(function () { if (newsItems.length > 1) { newsIdx++; renderNews(); } }, ms);
    try { document.documentElement.style.setProperty('--nbar', (ms / 1000) + 's'); } catch (e) {}
  }

  // ---------- Tools row ----------
  function renderTools() {
    var tools = kids.on ? [{ id: 'kids', label: 'الخروج من وضع الأطفال', icon: 'child' }, { id: 'quran', label: 'القرآن الكريم', icon: 'book' }] : [
      { id: 'quran', label: 'القرآن الكريم', icon: 'book' },
      { id: 'bg', label: 'الخلفيات', icon: 'image' },
      { id: 'themes', label: 'الثيمات', icon: 'palette' },
      { id: 'bgnext', label: 'الصورة التالية', icon: 'next' },
      { id: 'move', label: 'ترتيب التطبيقات', icon: 'move', active: mode === 'move' },
      { id: 'hide', label: 'إخفاء وإظهار', icon: 'eye', active: mode === 'hide' },
      { id: 'kids', label: 'وضع الأطفال', icon: 'child' },
      { id: 'prefs', label: 'إعدادات الواجهة', icon: 'sliders' },
      { id: 'refresh', label: 'تحديث', icon: 'refresh' }
    ];
    tools = tools.filter(function (t) { return t.id !== 'quran' || !window.FAITH || FAITH.muslim; });
    $('tools').innerHTML = tools.map(function (t) { return '<div class="item tool' + (t.active ? ' active' : '') + '" data-kind="tool" data-id="' + t.id + '">' + ICONS[t.icon] + '<span>' + t.label + '</span></div>'; }).join('');
    nav.refresh();
  }
  function setMode(m) {
    mode = m; renderApps(); renderTools();
    if (m === 'move') { nav.goRow(nav.appsRow(), 0); toast('اختار التطبيق واضغط OK، بعدها حرّكه بالأسهم'); }
    if (m === 'hide') { nav.goRow(nav.appsRow(), 0); toast('اضغط OK على أي تطبيق حتى تخفيه أو ترجعه'); }
    if (m === 'kidsel') { nav.goRow(nav.appsRow(), 0); toast('اضغط OK على التطبيقات المسموحة للأطفال'); }
    if (m === 'icon') { nav.goRow(nav.appsRow(), 0); toast('اختار التطبيق اللي تريد تغيّر أيقونته واضغط OK'); }
  }

  // ---------- Power dialog ----------
  var power = { idx: 0 };
  var POWER_BTNS = [['off', 'إيقاف التشغيل', 'power', 'يطفي الشاشة'], ['restart', 'إعادة التشغيل', 'restart', 'تفتح قائمة الطاقة'], ['cancel', 'إلغاء', 'close', '']];
  function openPower() {
    $('powerBox').innerHTML = POWER_BTNS.map(function (b) { return '<div class="pbtn">' + ICONS[b[2]] + '<span>' + b[1] + '</span>' + (b[3] ? '<small>' + b[3] + '</small>' : '') + '</div>'; }).join('');
    power.idx = 0; layer = 'power'; $('powerModal').classList.add('on'); powerFocus();
  }
  function powerFocus() { qa('#powerBox .pbtn').forEach(function (e, i) { e.classList.toggle('focus', i === power.idx); }); }
  function powerKey(k) {
    if (k === 'ArrowRight') power.idx = Math.max(0, power.idx - 1);
    else if (k === 'ArrowLeft') power.idx = Math.min(POWER_BTNS.length - 1, power.idx + 1);
    else if (k === 'back') { closeModal(); return; }
    else if (k === 'ok') {
      var id = POWER_BTNS[power.idx][0]; closeModal();
      if (id === 'cancel' || !HAS_ANDROID) return;
      var ok = id === 'off' ? A.powerSleep() : A.powerMenu();
      if (!ok) { toast('لازم تفعّل خدمة «Clean TV Power» من إعدادات إمكانية الوصول', 5000); A.openAccessibility(); }
      return;
    }
    powerFocus();
  }
  function closeModal() { qa('.modal').forEach(function (m) { m.classList.remove('on'); }); layer = 'main'; }

  // ---------- Layout editor ----------
  var EDITABLES = [
    ['topbar', 'أيقونات التحكم'], ['timeblock', 'الساعة والتاريخ'], ['adhanbox', 'موعد الأذان'], ['weather', 'الطقس'], ['wisdom', 'مربع الآية والحديث'], ['bigcount', 'العد التنازلي'], ['clubcard', 'لوحة النادي'], ['newscard', 'ويدجت الأخبار'],
    ['row-apps', 'صف التطبيقات'], ['row-occasions', 'صف المناسبات'], ['row-matches', 'صف المباريات'], ['row-tools', 'صف الأدوات'], ['__reset', 'إرجاع الشكل الأصلي']
  ];
  var layout = load('layout', {});
  var edit = { idx: 0, stage: 'select' };
  function editEl(id) { return document.querySelector('[data-edit="' + id + '"]'); }
  function applyLayout() {
    EDITABLES.forEach(function (e) {
      var el = editEl(e[0]); if (!el) return;
      var L = layout[e[0]] || {};
      el.style.transform = (L.x || L.y || (L.s && L.s !== 1)) ? 'translate(' + (L.x || 0) + 'px,' + (L.y || 0) + 'px) scale(' + (L.s || 1) + ')' : '';
      function attr(n, v) { if (v) el.setAttribute(n, v); else el.removeAttribute(n); }
      attr('data-font', L.font ? '1' : ''); el.style.setProperty('--ef', L.font || '');
      attr('data-color', L.color ? '1' : ''); el.style.setProperty('--ec', L.color || '');
      var bg = L.bg && L.bgMode !== 'clear' && L.bgMode !== 'img' ? 'rgba(' + L.bg + ',' + ((L.alpha == null ? 50 : L.alpha) / 100) + ')' : '';
      attr('data-clear', L.bgMode === 'clear' ? '1' : '');
      var bi = L.bgMode === 'img' && L.bgImg ? L.bgImg : '';
      attr('data-bgimg', bi ? '1' : ''); el.style.setProperty('--ebi', bi ? 'url("' + bi + '")' : ''); el.style.setProperty('--eo', String((L.alpha == null ? 35 : L.alpha) / 100));
      attr('data-bg', bg ? '1' : ''); el.style.setProperty('--eb', bg);
      attr('data-hidden', L.hidden ? '1' : '');
      attr('data-view', L.view || '');
      if (e[0] === 'row-apps') { el.setAttribute('data-shape', L.shape || 'circle'); attr('data-shapeset', L.shape ? '1' : ''); attr('data-radius', ''); }
      else { attr('data-radius', L.shape && RADIUS[L.shape] ? '1' : ''); el.style.setProperty('--er', RADIUS[L.shape] || ''); }
    });
    clampLayout(); try { fitTopbar(); } catch (e) {}
    var wv = (layout.wisdom || {}).view === 'textonly';
    $('wKind').style.display = wv ? 'none' : ''; $('wSrc').style.display = wv ? 'none' : '';
    var av = (layout.adhanbox || {}).view === 'nextonly', all = document.querySelector('#adhanbox .a-all');
    if (all) all.style.display = av ? 'none' : '';
  }
  // a widget moved with x/y is kept inside the 1920x1080 screen, so it never vanishes off an edge
  function clampLayout() {
    var stg = $('stage'); if (!stg) return;
    var sr = stg.getBoundingClientRect(), k = sr.width / 1920 || 1;
    EDITABLES.forEach(function (e) {
      var L = layout[e[0]]; if (!L || (!L.x && !L.y)) return;
      var el = editEl(e[0]); if (!el) return;
      var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      var l = (r.left - sr.left) / k, t = (r.top - sr.top) / k, w = r.width / k, h = r.height / k, dx = 0, dy = 0;
      if (w < 1920) { if (l < 0) dx = -l; else if (l + w > 1920) dx = 1920 - (l + w); }
      if (h < 1080) { if (t < 0) dy = -t; else if (t + h > 1080) dy = 1080 - (t + h); }
      if (dx || dy) el.style.transform = 'translate(' + Math.round((L.x || 0) + dx) + 'px,' + Math.round((L.y || 0) + dy) + 'px) scale(' + (L.s || 1) + ')';
    });
  }
  function openEdit() { document.body.classList.add('editing-mode'); layer = 'edit'; edit.idx = 0; edit.stage = 'select'; $('editHud').classList.add('on'); editRender(); }
  function closeEdit() {
    qa('.editing').forEach(function (e) { e.classList.remove('editing', 'stage-move', 'stage-size'); });
    document.body.classList.remove('editing-mode'); $('editHud').classList.remove('on'); layer = 'main'; save('layout', layout); toast('تم حفظ الشكل'); nav.refresh();
  }
  function editRender() {
    qa('.editing').forEach(function (e) { e.classList.remove('editing', 'stage-move', 'stage-size'); });
    var cur = EDITABLES[edit.idx], el = editEl(cur[0]);
    if (el) { el.classList.add('editing'); if (edit.stage !== 'select') el.classList.add('stage-' + edit.stage); }
    var isRow = cur[0].indexOf('row-') === 0 && cur[0] !== 'row-apps';
    $('content').style.transform = 'translateY(' + (isRow ? -300 : 0) + 'px)';
    $('eName').textContent = (edit.stage === 'select' ? 'اختار العنصر: ' : edit.stage === 'move' ? 'تحريك: ' : 'الحجم: ') + cur[1];
    $('eHelp').textContent = cur[0] === '__reset' ? 'OK حتى ترجع كلشي مثل الأصل · رجوع للخروج'
      : edit.stage === 'select' ? 'الأسهم: العنصر التالي/السابق · OK: تنسيق العنصر (تحريك، حجم، خط، لون، شكل…) · رجوع: حفظ وخروج'
      : edit.stage === 'move' ? 'الأسهم: حرّك العنصر · OK: تم'
      : '↑ أو ←: أكبر · ↓ أو →: أصغر · OK: تم · رجوع: رجوع للاختيار';
  }
  function editKey(k) {
    var cur = EDITABLES[edit.idx][0], L = layout[cur] || (layout[cur] = { x: 0, y: 0, s: 1 });
    if (edit.stage === 'select') {
      if (k === 'ArrowDown' || k === 'ArrowLeft') edit.idx = (edit.idx + 1) % EDITABLES.length;
      else if (k === 'ArrowUp' || k === 'ArrowRight') edit.idx = (edit.idx - 1 + EDITABLES.length) % EDITABLES.length;
      else if (k === 'ok') {
        if (cur === '__reset') { layout = {}; applyLayout(); save('layout', layout); toast('رجع الشكل الأصلي'); }
        else { openElementStyle(cur, EDITABLES[edit.idx][1]); return; }
      } else if (k === 'back') { if (layout.__reset) delete layout.__reset; closeEdit(); return; }
    } else if (edit.stage === 'move') {
      var st = 20;
      if (k === 'ArrowUp') L.y -= st; else if (k === 'ArrowDown') L.y += st;
      else if (k === 'ArrowRight') L.x += st; else if (k === 'ArrowLeft') L.x -= st;
      else if (k === 'ok' || k === 'back') { edit.stage = 'select'; applyLayout(); editRender(); openElementStyle(cur, EDITABLES[edit.idx][1]); return; }
      applyLayout();
    } else {
      if (k === 'ArrowUp' || k === 'ArrowLeft') L.s = Math.min(2, (L.s || 1) * 1.05);
      else if (k === 'ArrowDown' || k === 'ArrowRight') L.s = Math.max(.5, (L.s || 1) / 1.05);
      else if (k === 'ok' || k === 'back') edit.stage = 'select';
      applyLayout();
    }
    if (layout.__reset) delete layout.__reset;
    editRender();
  }

  // ---------- Screensaver ----------
  var SAVER_MS = 10 * 60000, lastInput = Date.now(), saverOn = false, saverMove = 0;
  var AYAT = (window.WISDOM || []).filter(function (w) { return w[2] === 'ayah'; });
  function renderSaver() {
    var now = new Date(), c = clockParts(now);
    $('sClock').textContent = c.hm;
    $('sDate').textContent = fmtGreg.format(now) + ' م';
    $('sHijri').textContent = hijriText(now) + ' هـ';
    if (AYAT.length) { var a = AYAT[Math.floor(Date.now() / Q_MS) % AYAT.length]; $('sAyah').textContent = '﴿ ' + a[0] + ' ﴾'; $('sSrc').textContent = a[1]; }
    var m = Math.floor(Date.now() / 60000);
    if (m !== saverMove) {
      saverMove = m;
      var x = -Math.round(Math.random() * 700), y = Math.round(60 + Math.random() * 430);
      $('saverBox').style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }
  }
  // the screensaver is the same page the TV shows over other apps (saver.html), placed on top of the launcher
  window.__saverFetch = function (url) { return HAS_ANDROID ? bridgeAsync('fetchAsync', url).then(function (t) { return t || ''; }) : fetch(url).then(function (r) { return r.text(); }).catch(function () { return ''; }); };
  function startSaver() {
    if (saverOn) return; saverOn = true; document.body.classList.add('saving');
    try { save('teamAr', NAMES); } catch (e) {}
    var sv = $('saver'); sv.innerHTML = '<iframe src="saver.html?inline=1" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;background:#000" tabindex="-1"></iframe>';
    sv.removeAttribute('data-style'); sv.classList.add('on');
    try { if (HAS_ANDROID && A.saverDim) A.saverDim(true); } catch (e) {}
  }
  function stopSaver() {
    saverOn = false; document.body.classList.remove('saving'); var sv = $('saver'); sv.classList.remove('on'); sv.innerHTML = '';
    try { if (HAS_ANDROID && A.saverDim) A.saverDim(false); } catch (e) {}
    try { window.focus(); } catch (e) {}
  }

  // ================= v4 modules =================

  // ---------- Hijri day map (shared) ----------
  var hmapCache = { key: '', map: {} };
  function hijriMap() {
    var today = new Date(), key = dayKey(today) + '|' + hijriOffset;
    if (hmapCache.key === key) return hmapCache.map;
    var map = {};
    for (var i = 0; i < 390; i++) { var d = new Date(today.getTime() + i * DAY), h = hijriNum(d), k = h.m + '-' + h.d; if (!(k in map)) map[k] = { date: d, i: i }; }
    hmapCache = { key: key, map: map }; return map;
  }

  // ---------- Big countdown ----------
  function renderBigCount() {
    var map = hijriMap(), best = null;
    (window.BIG_EVENTS || []).forEach(function (e) {
      var hit = map[e[0] + '-' + e[1]]; if (!hit) return;
      if (!best || hit.i < best.i) best = { i: hit.i, name: e[2] };
    });
    computeOccasions().forEach(function (o) { if (o.greg && o.big && (!best || o.left < best.i)) best = { i: o.left, name: o.name }; });
    var el = $('bigcount');
    if (!best) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = best.i === 0 ? '🌙 اليوم <b>' + esc(best.name) + '</b>' : '🌙 باقي <b>' + nf.format(best.i) + '</b> ' + (best.i === 1 ? 'يوم' : best.i <= 10 ? 'أيام' : 'يوم') + ' على <b>' + esc(best.name) + '</b>';
  }

  // ---------- Acts reminders ----------
  function renderActs() {
    var now = new Date(), h = hijriNum(now), out = [];
    var wd = new Date(now.getTime() + 3 * 3600000).getUTCDay();
    if (window.ACTS_HIJRI && window.ACTS_HIJRI[h.m + '-' + h.d]) out.push(window.ACTS_HIJRI[h.m + '-' + h.d]);
    var wtxt = window.ACTS_WEEKDAY && window.ACTS_WEEKDAY[wd];
    if (wtxt && wtxt.indexOf('ليلة') === 0 && window.PRAY) { var pt = prayerFor(now); if (nowHoursBaghdad() < pt.maghrib) wtxt = ''; }
    if (wtxt) out.push(wtxt);
    if (!out.length && window.ACTS_MONTH && window.ACTS_MONTH[h.m]) out.push(window.ACTS_MONTH[h.m]);
    $('acts').textContent = out.slice(0, 2).join('   ·   ');
  }

  // ---------- Weather (Open-Meteo) ----------
  var WX = { 0: ['☀️', 'صافي'], 1: ['🌤', 'صافي غالباً'], 2: ['⛅', 'غائم جزئياً'], 3: ['☁️', 'غائم'], 45: ['🌫', 'ضباب'], 48: ['🌫', 'ضباب'],
    51: ['🌦', 'رذاذ'], 53: ['🌦', 'رذاذ'], 55: ['🌦', 'رذاذ'], 61: ['🌧', 'مطر خفيف'], 63: ['🌧', 'مطر'], 65: ['🌧', 'مطر غزير'], 66: ['🌧', 'مطر بارد'], 67: ['🌧', 'مطر بارد'],
    71: ['🌨', 'ثلج'], 73: ['🌨', 'ثلج'], 75: ['🌨', 'ثلج'], 80: ['🌦', 'زخات مطر'], 81: ['🌧', 'زخات مطر'], 82: ['⛈', 'زخات غزيرة'], 95: ['⛈', 'عاصفة رعدية'], 96: ['⛈', 'عاصفة رعدية'], 99: ['⛈', 'عاصفة رعدية'] };
  var fmtWd = new Intl.DateTimeFormat('ar-IQ', { weekday: 'long', timeZone: TZ });
  function wx(code) { return WX[code] || ['🌡', '']; }
  function refreshWeather(force) {
    var c = window.CITIES[cityIdx] || window.CITIES[0];
    var cache = load('wxCache', null);
    if (!force && cache && cache.city === cityIdx && Date.now() - cache.t < 30 * 60000) { renderWeather(cache.d); return; }
    getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + c[1] + '&longitude=' + c[2] + '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FBaghdad&forecast_days=4')
      .then(function (j) { if (j && j.current) { save('wxCache', { t: Date.now(), city: cityIdx, d: j }); renderWeather(j); } else if (cache) renderWeather(cache.d); });
  }
  function renderWeather(j) {
    if (!j || !j.current) return;
    var c = window.CITIES[cityIdx] || window.CITIES[0], w = wx(j.current.weather_code), days = '';
    if (j.daily && j.daily.time) {
      for (var i = 1; i < Math.min(4, j.daily.time.length); i++) {
        var d = new Date(j.daily.time[i] + 'T12:00:00+03:00');
        days += '<div>' + fmtWd.format(d) + '<br>' + wx(j.daily.weather_code[i])[0] + ' <span dir="ltr"><b>' + nf.format(Math.round(j.daily.temperature_2m_max[i])) + '°</b> / ' + nf.format(Math.round(j.daily.temperature_2m_min[i])) + '°</span></div>';
      }
    }
    $('weather').innerHTML = '<div class="wx-now"><span class="wx-ic">' + w[0] + '</span><span class="wx-t" dir="ltr">' + nf.format(Math.round(j.current.temperature_2m)) + '°</span>' +
      '<span class="wx-d">' + esc(c[0]) + '<br>' + w[1] + '</span></div><div class="wx-days">' + days + '</div>';
  }

  // ---------- Alarms (adhan + match alerts) ----------
  var SETTINGS_DEFAULT = { adhanMode: 'sound', adhanFocus: 'pause', adhanFile: '', matchAlerts: true, reciter: 0, autoNext: true,
    theme: 'default', clickSound: false, saverApps: true, saverMin: 10, bgSources: null, bgInterval: 300 };
  var settings = load('settings', {});
  Object.keys(SETTINGS_DEFAULT).forEach(function (k) { if (settings[k] === undefined) settings[k] = SETTINGS_DEFAULT[k]; });
  function saveSettings() {
    save('settings', settings);
    if (HAS_ANDROID) {
      A.setPref('adhanMode', settings.adhanMode); A.setPref('adhanFocus', settings.adhanFocus); A.setPref('adhanFile', settings.adhanFile || '');
      A.setPref('saverApps', settings.saverApps && settings.saverOn !== false ? '1' : '0'); A.setPref('saverMin', String(settings.saverMin || 10));
    }
    applyTheme(); publishState();
  }

  // ---------- Themes ----------
  var THEMES = [['default', 'الافتراضي (الذهبي الليلي)'], ['appletv', 'Apple TV'], ['royal', 'الذهبي الملكي'], ['karbala', 'الكربلائي (أحمر)'], ['alawi', 'العلوي (أخضر)'],
    ['midnight', 'الأزرق الليلي'], ['turquoise', 'الفيروزي'], ['violet', 'البنفسجي'], ['rose', 'الوردي'], ['desert', 'الصحراوي'], ['silver', 'الفضي'],
    ['glass', 'الزجاجي الشفاف'], ['minimal', 'البسيط'], ['onyx', 'الأسود الفخم'], ['neon', 'النيون']];
  function themeName(id) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i][0] === id) return THEMES[i][1]; return THEMES[0][1]; }
  // automatic occasion themes (Muharram, Arbaeen, Ramadan, the two Eids, Ghadir)
  function occasionTheme() {
    if (!settings.autoOccasion) return null;
    var h = hijriNum(new Date()), m = h.m, d = h.d;
    if (m === 1 && d <= 13) return ['karbala', 'محرم الحرام'];
    if (m === 2 && d >= 17 && d <= 21) return ['karbala', 'زيارة الأربعين'];
    if (m === 9) return ['royal', 'رمضان كريم'];
    if (m === 10 && d <= 3) return ['turquoise', 'عيد الفطر مبارك'];
    if (m === 12 && d >= 10 && d <= 13) return ['alawi', 'عيد الأضحى مبارك'];
    if (m === 12 && d === 18) return ['alawi', 'عيد الغدير الأغر'];
    return null;
  }
  var occShown = '';
  function applyTheme() {
    var oc = occasionTheme(), th = oc ? oc[0] : settings.theme;
    if (th && th !== 'default') document.body.setAttribute('data-theme', th); else document.body.removeAttribute('data-theme');
    if (oc && occShown !== oc[1] && !PREVIEW) { occShown = oc[1]; setTimeout(function () { toast('🌙 ' + oc[1], 5000); }, 3000); }
    applySkin();
  }
  function hexRgb(h) { var n = parseInt(String(h || '#888888').replace('#', '').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function darken(c, f) { return 'rgb(' + Math.round(c[0] * f) + ',' + Math.round(c[1] * f) + ',' + Math.round(c[2] * f) + ')'; }
  var lastTeamKey = null;
  function applySkin() {
    var b = document.body, sk = settings.skin || 'classic', st = b.style;
    if (sk === 'classic') b.removeAttribute('data-skin'); else b.setAttribute('data-skin', sk);
    if (typeof customIcons !== 'undefined') renderOs();
    /* a design can carry its own CSS (imported launchers, or written in the phone app) and it is applied last */
    var uc = $('userCss'), css = typeof settings.css === 'string' ? settings.css.slice(0, 60000) : '';
    if (uc && uc.textContent !== css) uc.textContent = css;
    if (settings.variant) b.setAttribute('data-variant', settings.variant); else b.removeAttribute('data-variant');
    var p = settings.palette;
    b.classList.toggle('pal', !!p);
    if (p) {
      var a = hexRgb(p.a), c2 = hexRgb(p.b || '#ffffff');
      st.setProperty('--pa', p.a); st.setProperty('--pb', p.b || '#ffffff'); st.setProperty('--pc', p.c || '#0b0d14'); st.setProperty('--pt', p.t || '#ffffff');
      st.setProperty('--pa-55', rgba(a, .55)); st.setProperty('--pa-75', rgba(a, .75)); st.setProperty('--pa-d1', darken(a, .88)); st.setProperty('--pa-d2', darken(a, .4));
      st.setProperty('--pb-45', rgba(c2, .45)); st.setProperty('--pb-60', rgba(c2, .6)); st.setProperty('--pb-14', rgba(c2, .14));
    } else ['--pa', '--pb', '--pc'].forEach(function (k) { st.removeProperty(k); });
    b.classList.toggle('bgpal', settings.bgMode === 'palette' && !!p);
    b.classList.toggle('noreli', settings.religious === false);
    var F = window.FAITH || { rel: 'muslim', sect: 'shia' };
    b.setAttribute('data-faith', F.rel + (F.rel === 'muslim' ? '-' + F.sect : ''));
    var ot = document.querySelector('#row-occasions .row-title');
    if (ot) ot.innerHTML = F.rel === 'christian' ? 'الأعياد والمناسبات المسيحية <small>حسب التقويم الميلادي</small>' : F.rel === 'muslim' && F.sect === 'sunni' ? 'المناسبات الإسلامية <small>حسب التقويم الهجري</small>' : F.rel === 'muslim' ? 'مناسبات أهل البيت (ع) <small>المواليد والوفيات والمناسبات الدينية</small>' : 'المناسبات';
    var ow = document.querySelector('#timeblock .owner'); if (ow) ow.textContent = (settings.owner && settings.owner.indexOf('مؤمل') < 0 ? settings.owner : '') || 'مدير الشاشات';

    var mt = document.querySelector('#row-matches .row-title');
    if (mt && mt.firstChild) mt.firstChild.nodeValue = settings.team ? 'مباريات ' + (settings.team.matchLabel || settings.team.name || '') + ' ' : 'المباريات القادمة ';
    var key = settings.team && settings.team.ids ? settings.team.ids.join('_') : '';
    if (lastTeamKey != null && key !== lastTeamKey && typeof refreshMatches === 'function') { matches = []; refreshMatches(true); }
    lastTeamKey = key;
    if (typeof renderClub === 'function') renderClub();
    if (typeof renderTopbar === 'function' && document.getElementById('topbar').children.length) { renderTopbar(); if (typeof nav !== 'undefined') nav.refresh(); }
  }
  function openThemes() {
    var saved = settings.theme;
    function preview(id) { if (id && id !== 'default') document.body.setAttribute('data-theme', id); else document.body.removeAttribute('data-theme'); }
    openList('الثيمات', 'تحرّك بين الثيمات وتشوفها مباشرة · OK للاختيار · رجوع بدون تغيير', function () {
      return THEMES.map(function (t) {
        return { label: t[1], value: saved === t[0] ? '✅ المختار' : '', focus: function () { preview(t[0]); },
          act: function (k) { if (k !== 'ok') { preview(t[0]); return; } settings.theme = t[0]; saved = t[0]; saveSettings(); closeModal(); toast('تم تغيير الثيم: ' + t[1]); return false; } };
      });
    }, function () { settings.theme = saved; applyTheme(); });
    var i = 0; THEMES.forEach(function (t, k) { if (t[0] === saved) i = k; }); lm.idx = i; renderList();
  }

  // ---------- Interaction feedback ----------
  var audioCtx = null;
  function clickSound() {
    if (!settings.clickSound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(900, t + .04);
      g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + .07);
    } catch (e) {}
  }
  function pressFx() { var el = document.querySelector('.item.focus, .lrow.focus, .qitem.focus, .mitem.focus, .pbtn.focus'); if (!el) return; el.classList.add('press'); setTimeout(function () { el.classList.remove('press'); }, 130); }

  // ---------- Remote control (phone app / browser) ----------
  var lastAlerts = [];
  function publishState() {
    if (!HAS_ANDROID || !A.publishState) return;
    try {
      A.publishState(JSON.stringify({
        theme: settings.theme, themes: THEMES, bgSources: bgSources(), sources: BG_SOURCES.map(function (x) { return [x[0], x[1]]; }),
        bgInterval: settings.bgInterval || 300, intervals: BG_INTERVALS, clickSound: !!settings.clickSound, saverApps: !!settings.saverApps,
        surahs: window.SURAHS || [], reciter: settings.reciter || 0, reciters: (window.RECITERS || []).map(function (r) { return r[0]; }),
        kids: { on: !!kids.on, limit: kids.limit || 0, remaining: kids.on && kids.limit ? kidsRemaining() : null, endAt: kids.on && kids.limit && kids.launchAt ? kids.launchAt + kidsRemaining() * 60000 : 0 },
        alerts: lastAlerts,
        adhan: $('adhanbox') ? $('adhanbox').innerText.split('\n')[0] : ''
      }));
    } catch (e) {}
  }
  window.remoteCmd = function (c) {
    lastInput = Date.now(); if (saverOn) stopSaver();
    try {
      if (c.type === 'theme') { settings.theme = c.value; saveSettings(); toast('الثيم: ' + themeName(c.value)); }
      else if (c.type === 'bgSources') { if (c.value && c.value.length) { settings.bgSources = c.value; saveSettings(); bgPinned = null; save('bgPinned', null); loadMine(); buildBgList(); bgCur = ''; showBg(); refreshDaily(); } }
      else if (c.type === 'bgInterval') { settings.bgInterval = +c.value || 300; saveSettings(); }
      else if (c.type === 'bgNext') { if (bgPinned) { bgPinned = null; save('bgPinned', null); } bgManual++; showBg(); }
      else if (c.type === 'image') {
        /* photos from the phone live in the app's own folder («صوري») and join the wallpaper sources automatically */
        var srcs = bgSources().slice(); if (srcs.indexOf('mine') < 0) { srcs.push('mine'); settings.bgSources = srcs; saveSettings(); }
        loadMine(); buildBgList(); bgCur = '';
        if (c.pin) { bgPinned = c.path; save('bgPinned', c.path); setBg(c.path); } else showBg();
        toast('وصلت صورة جديدة من الموبايل وصارت خلفية 📱');
      }
      else if (c.type === 'search') { openSearch(); $('searchInput').value = c.value || ''; doSearch(); }
      else if (c.type === 'surah') playSurah(+c.value || 0);
      else if (c.type === 'quran') { if (c.value === 'stop') { A.quranStop(); qm.playing = -1; } else A.quranToggle(); renderNowPlaying(); }
      else if (c.type === 'clickSound') { settings.clickSound = !!c.value; saveSettings(); }
      else if (c.type === 'saverApps') { settings.saverApps = !!c.value; saveSettings(); }
      else if (c.type === 'paired') toast('تم ربط الموبايل ✅', 4000);
      else if (c.type === 'update') checkUpdate(true);
      else if (c.type === 'toast') toast(String(c.value || ''), 6000);
    } catch (e) {}
    publishState();
  };
  var pairTimer = null;
  window.showPair = function (code, url) {
    $('pairCode').textContent = code; $('pairSub').textContent = 'صوّر الباركود بكاميرا الموبايل، أو افتح ' + (url || '') + ' واكتب الرمز · أي زر للإغلاق';
    var q = $('pairQr'); q.innerHTML = '';
    clearTimeout(pairTimer); pairTimer = setTimeout(window.hidePair, 3 * 60000);
    try { if (url && window.qrcode) { var qr = qrcode(0, 'M'); qr.addData(url + '/?code=' + code); qr.make(); q.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 1 }); q.classList.add('on'); } else q.classList.remove('on'); } catch (e) { q.classList.remove('on'); }
    $('pairBox').classList.add('on');
  };
  window.hidePair = function () { clearTimeout(pairTimer); $('pairBox').classList.remove('on'); };
  function epochFor(ymd, hours) { return Date.UTC(ymd.y, ymd.m - 1, ymd.d) + Math.round((hours - 3) * 3600000); }
  function scheduleAll() {
    if (!HAS_ANDROID) return;
    var list = [], city = (window.CITIES[cityIdx] || window.CITIES[0])[0];
    if (settings.adhanMode !== 'off' && (!window.FAITH || FAITH.muslim)) {
      for (var k = 0; k < 2; k++) {
        var d = new Date(Date.now() + k * DAY), ymd = baghdadYMD(d), t = prayerFor(d);
        [['الفجر', t.fajr], ['الظهر', t.dhuhr], ['المغرب', t.maghrib]].forEach(function (p) {
          list.push({ at: epochFor(ymd, p[1]), type: 'adhan', title: 'حان الآن موعد أذان ' + p[0], sub: city + ' · ' + hoursToText(p[1]) });
        });
      }
    }
    if (settings.matchAlerts) {
      matches.forEach(function (m) {
        var at = Date.parse(m.date); if (at - Date.now() > 3 * DAY) return;
        var title = m.home.name + ' × ' + m.away.name;
        list.push({ at: at - 15 * 60000, type: 'match_pre', title: '⚽ بعد ١٥ دقيقة: ' + title, sub: m.league + ' · ' + fmtHour.format(new Date(at)) });
        if (m.slug) list.push({ at: at + 60000, type: 'match_live', title: title, slug: m.slug, id: m.id });
      });
    }
    list.sort(function (a, b) { return a.at - b.at; });
    lastAlerts = list.filter(function (a) { return a.type !== 'match_live'; }).slice(0, 30).map(function (a) { return { at: a.at, type: a.type, title: a.title, sub: a.sub }; });
    publishState();
    try { A.scheduleAlarms(JSON.stringify(list)); } catch (e) {}
  }

  // ---------- Live scores ticker: shows only while matches are being played, with the score of every live match ----------
  var LIVE_LG = ['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'ksa.1', 'irq.1', 'egy.1', 'qat.1', 'uae.1',
    'afc.champions', 'fifa.world', 'fifa.worldq.afc', 'uefa.nations', 'fifa.friendly', 'por.1', 'ned.1', 'tur.1', 'bra.1', 'arg.1', 'all'];
  var LG_AR = { 'English Premier League': 'الدوري الإنجليزي', 'Premier League': 'الدوري الإنجليزي', 'Spanish LALIGA': 'الدوري الإسباني', 'LALIGA': 'الدوري الإسباني', 'Italian Serie A': 'الدوري الإيطالي',
    'German Bundesliga': 'الدوري الألماني', 'French Ligue 1': 'الدوري الفرنسي', 'UEFA Champions League': 'دوري أبطال أوروبا', 'UEFA Europa League': 'الدوري الأوروبي',
    'Saudi Pro League': 'الدوري السعودي', 'Iraqi Premier League': 'الدوري العراقي', 'Egyptian Premier League': 'الدوري المصري', 'AFC Champions League Elite': 'أبطال آسيا', 'FIFA World Cup': 'كأس العالم' };
  var liveList = [];
  function refreshLive() {
    if (settings.ticker === false) { liveList = []; renderTicker(); return; }
    if (PREVIEW) { liveList = [{ lg: 'الدوري الإنجليزي', h: 'ليفربول', hs: '2', a: 'تشيلسي', as: '1', clk: "67'" }, { lg: 'الدوري الإسباني', h: 'ريال مدريد', hs: '0', a: 'برشلونة', as: '0', clk: "12'" }]; renderTicker(); return; }
    Promise.all(LIVE_LG.map(function (l) { return getJSON('https://site.api.espn.com/apis/site/v2/sports/soccer/' + l + '/scoreboard'); })).then(function (res) {
      var seen = {}, out = [];
      res.forEach(function (j) {
        if (!j || !j.events) return;
        var lgName = (j.leagues && j.leagues[0] && j.leagues[0].name) || '';
        j.events.forEach(function (e) {
          var c = e.competitions && e.competitions[0], st = (e.status && e.status.type) || {};
          if (!c || !c.competitors || st.state !== 'in' || seen[e.id]) return;
          seen[e.id] = 1;
          var h = c.competitors.filter(function (x) { return x.homeAway === 'home'; })[0] || c.competitors[0], a = c.competitors.filter(function (x) { return x.homeAway === 'away'; })[0] || c.competitors[1];
          if (!h || !a) return;
          var nm = function (x) { var t = x.team || {}; return NAMES[t.displayName] || t.shortDisplayName || t.displayName || ''; };
          var sc = function (x) { var v = x.score && (x.score.displayValue != null ? x.score.displayValue : x.score); return v == null ? '0' : String(v); };
          out.push({ lg: LG_AR[lgName] || (lgName === 'All' ? '' : lgName), h: nm(h), hs: sc(h), a: nm(a), as: sc(a), clk: (e.status && e.status.displayClock) || st.shortDetail || '' });
        });
      });
      liveList = out; renderTicker();
    });
  }
  function renderTicker() {
    var t = $('liveTicker'); if (!t) return;
    var on = settings.ticker !== false && liveList.length > 0;
    t.classList.toggle('on', on); document.body.classList.toggle('tickeron', on);
    if (!on) { t.innerHTML = ''; return; }
    var one = liveList.map(function (m) {
      return '<span class="lt-m">' + (m.lg ? '<b class="lt-lg">' + esc(m.lg) + '</b>' : '') + '<span>' + esc(m.h) + '</span><span class="lt-s">' + esc(m.hs) + ' - ' + esc(m.as) + '</span><span>' + esc(m.a) + '</span><i>' + esc(m.clk) + '</i></span>';
    }).join('<span class="lt-sep">•</span>') + '<span class="lt-sep">•</span>';
    t.setAttribute('data-dir', settings.tickerDir === 'ltr' ? 'ltr' : 'rtl');
    t.innerHTML = '<div class="lt-badge"><i></i>مباشر</div><div class="lt-win"><div class="lt-run" style="animation-duration:' + Math.max(22, liveList.length * 14) + 's">' + one + one + '</div></div>';
  }
  setTimeout(refreshLive, 3000);
  setInterval(function () { if (!PREVIEW) refreshLive(); }, 90000);

  // ---------- Generic list modal ----------
  var lm = { rows: [], idx: 0, onBack: null };
  function openList(title, sub, rowsFn, onBack) {
    lm.rowsFn = rowsFn; lm.onBack = onBack || null; lm.idx = 0;
    $('lmTitle').textContent = title; $('lmSub').textContent = sub || '';
    layer = 'list'; $('listModal').classList.add('on'); renderList();
  }
  function renderList() {
    lm.rows = lm.rowsFn();
    while (lm.rows[lm.idx] && lm.rows[lm.idx].head) lm.idx++;
    if (lm.idx >= lm.rows.length) lm.idx = lm.rows.length - 1;
    $('lmInner').innerHTML = lm.rows.map(function (r, i) {
      if (r.head) return '<div class="lrow head">' + esc(r.label) + '</div>';
      return '<div class="lrow' + (i === lm.idx ? ' focus' : '') + '"><span>' + esc(r.label) + '</span><span class="v">' + esc(r.value == null ? '' : r.value) + '</span></div>';
    }).join('');
    var el = qa('#lmInner .lrow')[lm.idx], shift = el ? Math.max(0, el.offsetTop - 520) : 0;
    $('lmInner').style.transform = 'translateY(' + (-shift) + 'px)';
  }
  function listKey(k) {
    var n = lm.rows.length;
    function step(d) { var i = lm.idx; do { i += d; } while (i >= 0 && i < n && lm.rows[i].head); if (i >= 0 && i < n) lm.idx = i; }
    if (k === 'ArrowDown') { step(1); if (lm.rows[lm.idx] && lm.rows[lm.idx].focus) lm.rows[lm.idx].focus(); }
    else if (k === 'ArrowUp') { step(-1); if (lm.rows[lm.idx] && lm.rows[lm.idx].focus) lm.rows[lm.idx].focus(); }
    else if (k === 'ok' || k === 'ArrowLeft' || k === 'ArrowRight') {
      var r = lm.rows[lm.idx]; if (!r) return;
      if (r.act) { var keep = r.act(k); if (keep === false) return; }
      else return;
    } else if (k === 'back') { closeModal(); if (lm.onBack) lm.onBack(); return; }
    if (layer === 'list') renderList();
  }
  function cycle(arr, cur, dir) { var i = arr.indexOf(cur); i = (i + (dir || 1) + arr.length) % arr.length; return arr[i < 0 ? 0 : i]; }

  // ---------- Settings modal ----------
  var LIMITS = [30, 60, 90, 120, 180, 240, 0];
  function openSettings() {
    var audios = [];
    if (HAS_ANDROID) { try { audios = JSON.parse(A.listAudio()) || []; } catch (e) {} }
    openList('إعدادات الواجهة', 'OK أو ← → للتغيير · رجوع للإغلاق', function () {
      var c = (window.CITIES[cityIdx] || window.CITIES[0])[0];
      var fileName = settings.adhanFile ? settings.adhanFile.split('/').pop() : 'الافتراضي';
      var bn = HAS_ANDROID ? A.buildNumber() : 0;
      return [
        { head: true, label: 'الشكل والتفاعل' },
        { label: 'الثيم', value: themeName(settings.theme), act: function (k) { if (k === 'ok') { closeModal(); openThemes(); return false; } var ids = THEMES.map(function (t) { return t[0]; }); settings.theme = cycle(ids, settings.theme, k === 'ArrowRight' ? -1 : 1); saveSettings(); } },
        { label: 'صوت النقر عند التنقل', value: settings.clickSound ? 'شغّال' : 'متوقف', act: function () { settings.clickSound = !settings.clickSound; saveSettings(); clickSound(); } },
        { label: 'شريط النتائج المباشرة', value: settings.ticker === false ? 'متوقف' : 'شغّال', act: function () { settings.ticker = settings.ticker === false; saveSettings(); refreshLive(); } },
        { label: 'اتجاه شريط النتائج', value: settings.tickerDir === 'ltr' ? 'من اليسار لليمين' : 'من اليمين لليسار', act: function () { settings.tickerDir = settings.tickerDir === 'ltr' ? 'rtl' : 'ltr'; saveSettings(); renderTicker(); } },
        { label: 'مصادر الخلفيات ووقت التبديل', value: intervalText(settings.bgInterval || 300), act: function () { closeModal(); openBgSources(); return false; } },
        { label: 'شاشة التوقف بعد', value: nf.format(settings.saverMin || 10) + ' دقايق', act: function (k) { settings.saverMin = cycle([5, 10, 15, 20, 30], settings.saverMin || 10, k === 'ArrowRight' ? -1 : 1); saveSettings(); } },
        { label: 'شاشة التوقف فوق التطبيقات الثانية', value: settings.saverApps ? 'شغّالة' : 'متوقفة', act: function () { settings.saverApps = !settings.saverApps; saveSettings(); } },
        { head: true, label: 'الأذان' },
        { label: 'تنبيه الأذان', value: { sound: 'صوت وتنبيه', banner: 'تنبيه بدون صوت', off: 'متوقف' }[settings.adhanMode], act: function (k) { settings.adhanMode = cycle(['sound', 'banner', 'off'], settings.adhanMode, k === 'ArrowRight' ? -1 : 1); saveSettings(); scheduleAll(); } },
        { label: 'عند الأذان', value: settings.adhanFocus === 'duck' ? 'يخفّض صوت الفيديو' : 'يوقف الفيديو مؤقتاً', act: function () { settings.adhanFocus = settings.adhanFocus === 'duck' ? 'pause' : 'duck'; saveSettings(); } },
        { label: 'صوت الأذان', value: fileName, act: function (k) {
            var opts = [''].concat(audios.map(function (a) { return a.path; }));
            if (opts.length === 1) toast('حط ملف أذان (mp3) بمجلد Download بالتلفزيون عن طريق LocalSend، وبعدها اختاره هنا', 5000);
            settings.adhanFile = cycle(opts, settings.adhanFile || '', k === 'ArrowRight' ? -1 : 1); saveSettings(); } },
        { label: 'تجربة صوت الأذان', value: '▶', act: function () { if (HAS_ANDROID) { if (A.adhanPlaying()) A.stopAdhan(); else A.testAdhan('تجربة الأذان'); } } },
        { label: 'مدينة الأذان والطقس', value: c, act: function (k) { cityIdx = (cityIdx + (k === 'ArrowRight' ? -1 : 1) + window.CITIES.length) % window.CITIES.length; save('cityIdx', cityIdx); renderAdhan(); refreshWeather(true); scheduleAll(); } },
        { label: 'تعديل التاريخ الهجري', value: (hijriOffset > 0 ? '+' : '') + nf.format(hijriOffset) + ' يوم', act: function (k) { hijriOffset = k === 'ArrowRight' ? Math.max(-2, hijriOffset - 1) : (hijriOffset >= 2 ? -2 : hijriOffset + 1); save('hijriOffset', hijriOffset); tick(); renderOccasions(); renderBigCount(); renderActs(); } },
        { head: true, label: 'الرياضة والقرآن' },
        { label: 'تنبيهات المباريات والنتيجة المباشرة', value: settings.matchAlerts ? 'شغّالة' : 'متوقفة', act: function () { settings.matchAlerts = !settings.matchAlerts; saveSettings(); scheduleAll(); } },
        { label: 'قارئ القرآن', value: window.RECITERS[settings.reciter || 0][0], act: function (k) { settings.reciter = (settings.reciter + (k === 'ArrowRight' ? -1 : 1) + window.RECITERS.length) % window.RECITERS.length; saveSettings(); } },
        { label: 'تشغيل السورة التالية تلقائياً', value: settings.autoNext ? 'نعم' : 'لا', act: function () { settings.autoNext = !settings.autoNext; saveSettings(); } },
        { head: true, label: 'وضع الأطفال' },
        { label: 'رمز القفل', value: kids.pin ? '••••' : 'غير محدد', act: function () { askPin('اكتب رمز جديد (٤ أرقام)', function (p) { if (p && p.length >= 4) { kids.pin = p; saveKids(); toast('تم حفظ الرمز'); } else toast('الرمز لازم يكون ٤ أرقام'); openSettings(); }); return false; } },
        { label: 'وقت المشاهدة اليومي', value: kids.limit ? nf.format(kids.limit) + ' دقيقة' : 'بدون حد', act: function (k) { kids.limit = cycle(LIMITS, kids.limit, k === 'ArrowRight' ? -1 : 1); saveKids(); } },
        { label: 'اختيار تطبيقات الأطفال', value: nf.format(kids.apps.length) + ' تطبيق', act: function () { closeModal(); setMode('kidsel'); return false; } },
        { head: true, label: 'الموبايل' },
        { label: 'ربط موبايل جديد', value: '📱', act: function () { closeModal(); if (HAS_ANDROID && A.remoteStartPairing) A.remoteStartPairing(); return false; } },
        { label: 'عنوان التحكم بالمتصفح', value: HAS_ANDROID && A.remoteUrl ? A.remoteUrl() : '', act: function () {} },
        { head: true, label: 'النظام' },
        { label: 'الظهور فوق التطبيقات (للأذان والتنبيهات)', value: HAS_ANDROID && A.hasOverlay() ? 'مفعّل' : 'غير مفعّل', act: function () { if (HAS_ANDROID && !A.hasOverlay()) A.openOverlaySettings(); } },
        { label: 'تحديث التطبيق', value: update.available ? 'نسخة جديدة متوفرة!' : 'النسخة ' + nf.format(bn), act: function () { if (update.available) startUpdate(); else { toast('جاري الفحص…'); checkUpdate(true); } } }
      ];
    });
  }

  // ---------- Update ----------
  var update = { available: false, n: 0, url: '' };
  function checkUpdate(manual) {
    if (!HAS_ANDROID) return;
    getJSON('https://api.github.com/repos/hnt45y-111/clean-tv/releases/latest').then(function (j) {
      if (!j || !j.tag_name) { if (manual) toast('ما گدرت أفحص التحديث، تأكد من الإنترنت'); return; }
      if (!/^build-/.test(String(j.tag_name))) { if (manual) toast('عندك آخر نسخة ✅'); return; }
      var n = parseInt(String(j.tag_name).replace(/\D/g, ''), 10) || 0, mine = A.buildNumber();
      var asset = (j.assets || []).filter(function (a) { return /\.apk$/.test(a.name); })[0];
      if (n > mine && asset) {
        update = { available: true, n: n, url: asset.browser_download_url };
        if (manual || load('updPrompted', 0) !== n) {
          save('updPrompted', n);
          openList('تحديث جديد متوفر ✨', 'النسخة ' + nf.format(n) + ' جاهزة للتثبيت', function () {
            return [{ label: 'تحديث الآن', value: '⬇', act: function () { closeModal(); startUpdate(); return false; } }, { label: 'لاحقاً', value: '', act: function () { closeModal(); return false; } }];
          });
        }
      } else if (manual) toast('عندك آخر نسخة ✅');
      if (layer === 'list') renderList();
    });
  }
  function startUpdate() { toast('جاري تنزيل التحديث… لا تطفي التلفزيون', 8000); A.installUpdate(update.url); }
  window.onUpdateStatus = function (s) {
    if (s === 'installing') toast('اضغط «تثبيت» بالنافذة اللي راح تطلع', 8000);
    else if (s === 'fail') toast('فشل التحديث، نجرّب مرة ثانية بعدين', 5000);
  };

  // ---------- Search ----------
  var srch = { results: [], idx: -1 };
  function openSearch() {
    layer = 'search'; $('searchModal').classList.add('on'); $('searchInput').value = ''; srch.results = []; srch.idx = -1; renderSearch();
    setTimeout(function () { $('searchInput').focus(); $('searchInput').classList.add('focus'); }, 50);
  }
  function doSearch() {
    var q = $('searchInput').value.trim(), out = [];
    function has(s) { return String(s || '').toLowerCase().indexOf(q.toLowerCase()) >= 0; }
    if (q) {
      apps.forEach(function (a) { if (has(a.label) || has(a.pkg)) out.push({ label: '📺 ' + a.label, value: 'فتح التطبيق', run: function () { launchApp(a.pkg); } }); });
      (window.SURAHS || []).forEach(function (s, i) { if (has(s)) out.push({ label: '📖 سورة ' + s, value: 'تشغيل', run: function () { playSurah(i); } }); });
      computeOccasions().forEach(function (o) { if (has(o.name)) out.push({ label: '🕌 ' + o.name, value: daysLeftText(o.left), run: function () { nav.goId('row-occasions'); } }); });
      matches.forEach(function (m) { if (has(m.home.name) || has(m.away.name) || has(m.league)) out.push({ label: '⚽ ' + m.home.name + ' × ' + m.away.name, value: fmtDay.format(new Date(m.date)), run: function () { nav.goId('row-matches'); } }); });
      (window.WISDOM || []).forEach(function (w) { if (has(w[0]) || has(w[1])) out.push({ label: (w[2] === 'ayah' ? '۞ ' : '« ') + w[0].slice(0, 60), value: w[1], run: function () { toast(w[0], 8000); } }); });
      [['الخلفيات', openPicker], ['الثيمات', openThemes], ['مصادر الخلفيات', openBgSources], ['إعدادات الواجهة', openSettings], ['القرآن الكريم', openQuran], ['تعديل الشاشة', openEdit], ['الطاقة', openPower], ['الواي فاي', function () { if (HAS_ANDROID) A.openWifi(); }], ['إعدادات الجهاز', function () { if (HAS_ANDROID) A.openSettings(); }]]
        .forEach(function (t) { if (has(t[0])) out.push({ label: '⚙ ' + t[0], value: 'فتح', run: t[1] }); });
      out.push({ label: '🛒 ابحث في متجر Google Play عن «' + q + '»', value: 'المتجر', run: function () { if (HAS_ANDROID) A.openMarketSearch(q); } });
    }
    srch.results = out.slice(0, 40); srch.idx = out.length ? 0 : -1;
    $('searchInput').blur(); $('searchInput').classList.remove('focus');
    renderSearch();
  }
  function renderSearch() {
    $('srInner').innerHTML = srch.results.map(function (r, i) { return '<div class="lrow' + (i === srch.idx ? ' focus' : '') + '"><span>' + esc(r.label) + '</span><span class="v">' + esc(r.value) + '</span></div>'; }).join('');
    var el = qa('#srInner .lrow')[srch.idx], shift = el ? Math.max(0, el.offsetTop - 420) : 0;
    $('srInner').style.transform = 'translateY(' + (-shift) + 'px)';
  }
  function searchKey(k) {
    var inInput = document.activeElement === $('searchInput');
    if (k === 'back') { $('searchInput').blur(); closeModal(); return; }
    if (inInput) { if (k === 'ok') doSearch(); else if (k === 'ArrowDown' && srch.results.length) { $('searchInput').blur(); $('searchInput').classList.remove('focus'); srch.idx = 0; renderSearch(); } return; }
    if (k === 'ArrowDown') srch.idx = Math.min(srch.results.length - 1, srch.idx + 1);
    else if (k === 'ArrowUp') { if (srch.idx <= 0) { srch.idx = -1; $('searchInput').focus(); $('searchInput').classList.add('focus'); } else srch.idx--; }
    else if (k === 'ok') { var r = srch.results[srch.idx]; if (r) { closeModal(); r.run(); } return; }
    renderSearch();
  }

  // ---------- Quran ----------
  var qm = { idx: 0, items: [], playing: -1 };
  function pad3(n) { return ('00' + n).slice(-3); }
  function playSurah(i) {
    if (!HAS_ANDROID) { toast('تشغيل سورة ' + window.SURAHS[i]); return; }
    var r = window.RECITERS[settings.reciter || 0];
    qm.playing = i; save('lastSurah', i);
    A.quranPlay(r[1] + pad3(i + 1) + '.mp3', 'سورة ' + window.SURAHS[i] + ' · ' + r[0].split(' - ')[0]);
    toast('جاري تشغيل سورة ' + window.SURAHS[i]); setTimeout(renderNowPlaying, 1500);
  }
  window.onQuranEnded = function () { if (settings.autoNext && qm.playing >= 0 && qm.playing < 113) playSurah(qm.playing + 1); else renderNowPlaying(); };
  function openQuran() {
    var ctrls = [{ c: 'toggle', html: '⏯ إيقاف / تشغيل' }, { c: 'stop', html: '⏹ إيقاف' }, { c: 'next', html: '⏭ السورة التالية' }, { c: 'reciter', html: '🎙 القارئ<small>' + esc(window.RECITERS[settings.reciter || 0][0]) + '</small>' }];
    qm.items = ctrls.concat((window.SURAHS || []).map(function (s, i) { return { s: i, html: esc(s) + '<small>' + nf.format(i + 1) + '</small>' }; }));
    $('qmInner').innerHTML = qm.items.map(function (it) { return '<div class="qitem' + (it.c ? ' ctrl' : '') + '">' + it.html + '</div>'; }).join('');
    $('qmSub').textContent = 'اختار سورة · القارئ: ' + window.RECITERS[settings.reciter || 0][0];
    qm.idx = qm.playing >= 0 ? qm.playing + 4 : 4; layer = 'quran'; $('quranModal').classList.add('on'); quranFocus();
  }
  function quranFocus() {
    var els = qa('#qmInner .qitem'); els.forEach(function (e, i) { e.classList.toggle('focus', i === qm.idx); });
    var el = els[qm.idx], shift = el ? Math.max(0, el.offsetTop - 420) : 0;
    $('qmInner').style.transform = 'translateY(' + (-shift) + 'px)';
  }
  function quranKey(k) {
    var n = qm.items.length;
    if (k === 'ArrowRight') qm.idx = Math.max(0, qm.idx - 1);
    else if (k === 'ArrowLeft') qm.idx = Math.min(n - 1, qm.idx + 1);
    else if (k === 'ArrowUp') qm.idx = Math.max(0, qm.idx - 6);
    else if (k === 'ArrowDown') qm.idx = Math.min(n - 1, qm.idx + 6);
    else if (k === 'back') { closeModal(); return; }
    else if (k === 'ok') {
      var it = qm.items[qm.idx];
      if (it.c === 'toggle') { if (HAS_ANDROID) { var st = JSON.parse(A.quranStatus()); if (st.state === 'stopped' || st.state === 'ended' || st.state === 'error') playSurah(qm.playing >= 0 ? qm.playing : load('lastSurah', 0)); else A.quranToggle(); } }
      else if (it.c === 'stop') { if (HAS_ANDROID) A.quranStop(); qm.playing = -1; }
      else if (it.c === 'next') playSurah(Math.min(113, (qm.playing >= 0 ? qm.playing : -1) + 1));
      else if (it.c === 'reciter') { settings.reciter = (settings.reciter + 1) % window.RECITERS.length; saveSettings(); openQuran(); return; }
      else playSurah(it.s);
      setTimeout(renderNowPlaying, 800);
    }
    quranFocus();
  }
  function renderNowPlaying() {
    var el = $('nowPlaying'); if (!HAS_ANDROID) return;
    var st = {}; try { st = JSON.parse(A.quranStatus()); } catch (e) {}
    var on = st.state === 'playing' || st.state === 'paused' || st.state === 'loading';
    el.classList.toggle('on', on);
    if (on) el.textContent = (st.state === 'paused' ? '⏸ ' : st.state === 'loading' ? '⏳ ' : '▶ ') + st.title;
  }

  // ---------- Kids mode ----------
  var kids = load('kids', { on: false, pin: '', apps: [], limit: 120, used: {}, launchAt: 0 });
  function saveKids() { save('kids', kids); }
  function kidsUsedToday() { return kids.used[dayKey(new Date())] || 0; }
  function kidsRemaining() { return kids.limit ? Math.max(0, kids.limit - kidsUsedToday()) : 9999; }
  function applyKids() { document.body.classList.toggle('kids', !!kids.on); renderApps(); renderTools(); if (kids.on && nav.row() === 0) nav.goRow(nav.appsRow(), 0); }
  function toggleKids() {
    if (!kids.on) {
      if (!kids.pin) { askPin('حدد رمز قفل لوضع الأطفال (٤ أرقام)', function (p) { if (p && p.length >= 4) { kids.pin = p; kids.on = true; saveKids(); applyKids(); toast('تم تشغيل وضع الأطفال'); } else toast('الرمز لازم يكون ٤ أرقام'); }); return; }
      if (!kids.apps.length) { toast('اختار تطبيقات الأطفال أول من إعدادات الواجهة', 4500); return; }
      kids.on = true; saveKids(); applyKids(); toast('تم تشغيل وضع الأطفال');
    } else {
      askPin('اكتب الرمز حتى تطلع من وضع الأطفال', function (p) { if (p === kids.pin) { kids.on = false; saveKids(); applyKids(); toast('رجعت الواجهة الكاملة'); } else if (p) toast('الرمز غلط'); });
    }
  }
  function kidsBeforeLaunch() {
    if (!kids.on) return true;
    var rem = kidsRemaining();
    if (rem <= 0) { toast('خلص وقت المشاهدة اليوم 🌙', 4000); return false; }
    kids.launchAt = Date.now(); saveKids(); setTimeout(publishState, 50);
    if (HAS_ANDROID && kids.limit) A.kidsAlarm(Date.now() + rem * 60000, 'انتهى وقت المشاهدة', 'وقت الراحة يا بطل 🌙');
    return true;
  }
  function kidsOnResume() {
    if (!kids.launchAt) return;
    var mins = Math.round((Date.now() - kids.launchAt) / 60000), k = dayKey(new Date());
    kids.used[k] = (kids.used[k] || 0) + mins; kids.launchAt = 0;
    Object.keys(kids.used).forEach(function (d) { if (d !== k) delete kids.used[d]; });
    saveKids(); if (HAS_ANDROID) A.kidsCancel();
  }
  window.onKidsTimeUp = function () { kidsOnResume(); toast('انتهى وقت المشاهدة لليوم 🌙', 8000); };

  // ---------- PIN prompt ----------
  var pinCb = null;
  function askPin(title, cb) {
    qa('.modal').forEach(function (m) { m.classList.remove('on'); });
    pinCb = cb; $('pinTitle').textContent = title; $('pinInput').value = '';
    layer = 'pin'; $('pinModal').classList.add('on'); setTimeout(function () { $('pinInput').focus(); }, 50);
  }
  function pinKey(k) {
    if (k === 'ok') { var v = $('pinInput').value.trim(), cb = pinCb; $('pinInput').blur(); closeModal(); pinCb = null; if (cb) cb(v); }
    else if (k === 'back') { $('pinInput').blur(); closeModal(); pinCb = null; }
  }

  // ---------- Element style editor ----------
  var FONTS = [['الافتراضي', ''], ['تجوال', "'Tajawal'"], ['أميري', "'Amiri'"], ['كوفي', "'Kufi'"], ['نسخ', "'Noto Naskh Arabic'"]];
  var COLORS = [['الافتراضي', ''], ['أبيض', '#ffffff'], ['ذهبي', '#f6dc9b'], ['أخضر', '#5fd39a'], ['سماوي', '#7dd3fc'], ['وردي', '#f9a8d4'], ['أحمر', '#ff8b8b']];
  var BGS = [['بدون', ''], ['أسود', '0,0,0'], ['ذهبي', '160,120,30'], ['أخضر', '20,90,60'], ['أزرق', '20,50,120'], ['بنفسجي', '70,30,110'], ['أبيض', '255,255,255']];
  var SHAPES = [['الافتراضي', ''], ['مربع', 'square'], ['دائري الحواف', 'rounded'], ['دائري', 'circle'], ['مستطيل', 'rect']];
  var APP_SHAPES = [['دائري', 'circle'], ['مربع', 'square'], ['مربع ناعم (آيفون)', 'squircle'], ['سداسي', 'hexagon'], ['ورقة', 'leaf'], ['معيّن', 'diamond'], ['بيضوي', 'oval'], ['قطرة', 'drop'], ['ثماني', 'octagon'], ['بطاقة بحواف دائرية', 'rounded'], ['بطاقة مستطيلة', 'rect'], ['كبسولة', 'pill']];
  var RADIUS = { square: '6px', rounded: '30px', circle: '999px', rect: '0px' };
  function viewsFor(id) {
    if (id === 'row-apps') return [['الافتراضي', ''], ['الأسماء ظاهرة', 'names'], ['بدون عنوان', 'notitle']];
    if (id.indexOf('row-') === 0) return [['الافتراضي', ''], ['مضغوط', 'compact'], ['بدون عنوان', 'notitle']];
    if (id === 'wisdom') return [['الافتراضي', ''], ['النص فقط', 'textonly']];
    if (id === 'adhanbox') return [['الافتراضي', ''], ['الأذان الجاي فقط', 'nextonly']];
    return [['الافتراضي', '']];
  }
  function nameOf(list, v) { for (var i = 0; i < list.length; i++) if (list[i][1] === (v || '')) return list[i][0]; return list[0][0]; }
  function nextOf(list, v, dir) { var i = 0; for (var j = 0; j < list.length; j++) if (list[j][1] === (v || '')) i = j; return list[(i + (dir || 1) + list.length) % list.length][1]; }
  function openElementStyle(id, name) {
    function L() { return layout[id] || (layout[id] = { x: 0, y: 0, s: 1 }); }
    function d(k) { return k === 'ArrowRight' ? -1 : 1; }
    openList('تنسيق: ' + name, 'OK أو ← → للتغيير · رجوع للرجوع', function () {
      var l = L(), rows = [
        { label: 'تحريك بالأسهم', value: '✥', act: function () { closeModal(); layer = 'edit'; edit.stage = 'move'; editRender(); return false; } },
        { label: 'الحجم', value: nf.format(Math.round((l.s || 1) * 100)) + '٪', act: function (k) { l.s = Math.max(.5, Math.min(2, (l.s || 1) * (d(k) > 0 ? 1.05 : 1 / 1.05))); applyLayout(); } },
        { label: 'الخط', value: nameOf(FONTS, l.font), act: function (k) { l.font = nextOf(FONTS, l.font, d(k)); applyLayout(); } },
        { label: 'لون النص', value: nameOf(COLORS, l.color), act: function (k) { l.color = nextOf(COLORS, l.color, d(k)); applyLayout(); } },
        { label: 'لون الخلفية', value: nameOf(BGS, l.bg), act: function (k) { l.bg = nextOf(BGS, l.bg, d(k)); if (l.bg && l.alpha == null) l.alpha = 50; applyLayout(); } },
        { label: 'شفافية الخلفية', value: nf.format(l.alpha == null ? 50 : l.alpha) + '٪', act: function (k) { var a = l.alpha == null ? 50 : l.alpha; l.alpha = Math.max(0, Math.min(100, a + (d(k) > 0 ? 10 : -10))); if (!l.bg) l.bg = '0,0,0'; applyLayout(); } },
        { label: id === 'row-apps' ? 'شكل الأيقونات' : 'الشكل', value: id === 'row-apps' ? nameOf(APP_SHAPES, l.shape || 'circle') : nameOf(SHAPES, l.shape), act: function (k) { if (id === 'row-apps') { l.shape = nextOf(APP_SHAPES, l.shape || 'circle', d(k)); applyLayout(); renderApps(); } else { l.shape = nextOf(SHAPES, l.shape, d(k)); applyLayout(); } } },
        { label: 'طريقة العرض', value: nameOf(viewsFor(id), l.view), act: function (k) { l.view = nextOf(viewsFor(id), l.view, d(k)); applyLayout(); nav.refresh(); } },
        { label: l.hidden ? 'إظهار العنصر' : 'إخفاء العنصر', value: l.hidden ? 'مخفي' : 'ظاهر', act: function () { l.hidden = !l.hidden; applyLayout(); } }
      ];
      if (id === 'row-apps') rows.push({ label: 'تغيير أيقونة تطبيق بصورة', value: '🖼', act: function () { closeModal(); closeEdit(); setMode('icon'); return false; } });
      rows.push({ label: 'إرجاع هذا العنصر للأصل', value: '↺', act: function () { delete layout[id]; applyLayout(); } });
      return rows;
    }, function () { layer = 'edit'; editRender(); });
  }

  // ---------- Main focus navigation ----------
  var layer = 'main';
  var nav = (function () {
    var rowEls = qa('#content .row');
    var AR = rowEls.indexOf(document.getElementById('row-apps'));
    var r = AR, idx = rowEls.map(function () { return 0; }), moving = null;
    function homeRow() { return AR; }
    function goId(id) { var i = rowEls.indexOf(document.getElementById(id)); if (i >= 0) goRow(i); }
    function items(row) { return qa('.item', rowEls[row]); }
    function cur() { return items(r)[idx[r]]; }
    function apply() {
      qa('.item.focus').forEach(function (e) { e.classList.remove('focus'); });
      qa('.item.moving').forEach(function (e) { e.classList.remove('moving'); });
      var list = items(r); if (!list.length) return;
      if (idx[r] >= list.length) idx[r] = list.length - 1; if (idx[r] < 0) idx[r] = 0;
      var el = list[idx[r]]; el.classList.add('focus');
      rowEls.forEach(function (re, i) { re.classList.toggle('row-active', i === r); });
      if (moving && el.dataset.pkg === moving) el.classList.add('moving');
      if (r > 0) scrollTrack(r);
      osFocus(el);
      scrollPage();
    }
    function scrollTrack(row) {
      var track = rowEls[row].querySelector('.track'); if (!track) return;
      var list = items(row); if (!list.length) return;
      if (row === AR && osGrid()) {
        var ge = list[idx[row]], gy;
        if (settings.skin === 'cyt') { var rh = ge.offsetHeight + 40, ri = Math.floor(idx[row] / osGrid()); gy = ri * rh; }
        else gy = Math.max(0, ge.offsetTop - 210);
        track.style.transform = 'translateY(' + -gy + 'px)'; return;
      }
      var el = list[idx[row]];
      if (osLtr()) {
        var room = 1920 - rowEls[row].offsetLeft - 90, over = el.offsetLeft + el.offsetWidth - room;
        track.style.transform = 'translateX(' + -Math.max(0, over) + 'px)'; return;
      }
      var maxVisible = 1920 - 96 * 2 - 60, far = track.offsetWidth - el.offsetLeft;
      track.style.transform = 'translateX(' + (far > maxVisible ? far - maxVisible : 0) + 'px)';
    }
    function scrollPage() {
      if (layer === 'edit') return;
      if (settings.skin === 'ribbon' || osSkin()) { $('content').style.transform = ''; return; }
      var y = r <= Math.max(1, AR) ? 0 : -(rowEls[Math.min(r, rowEls.length - 2)].offsetTop - 300);
      $('content').style.transform = 'translateY(' + Math.min(0, y) + 'px)';
    }
    function centerX(el) { var b = el.getBoundingClientRect(); return b.left + b.width / 2; }
    function rowVisible(i) { var e = rowEls[i]; return e && e.offsetParent !== null && !e.hasAttribute('data-hidden'); }
    /* a maker's side rail (Samsung Tizen, Roku) is reached sideways, never by up and down */
    function isRail(i) { return !!rowEls[i] && rowEls[i].classList.contains('vrow') && rowVisible(i); }
    function railRow() { for (var i = 0; i < rowEls.length; i++) if (isRail(i)) return i; return -1; }
    var lastR = null;
    function toRail() { var R = railRow(); if (R < 0) return; lastR = r; r = R; apply(); }
    function leaveRail() {
      var t = lastR != null && rowVisible(lastR) && !isRail(lastR) ? lastR : AR;
      if (!rowVisible(t)) { for (var i = 0; i < rowEls.length; i++) if (rowVisible(i) && !isRail(i)) { t = i; break; } }
      goRow(t);
    }
    function railHome() { var R = rowEls.indexOf($('row-osbar')); if (R < 0) return; var l = items(R); for (var i = 0; i < l.length; i++) if (l[i].classList.contains('on')) idx[R] = i; }
    function arrow(k) {
      var ltr = osLtr(), fwd = ltr ? 'ArrowRight' : 'ArrowLeft';
      if (isRail(r)) {
        if (k === 'ArrowUp') moveH(-1); else if (k === 'ArrowDown') moveH(1); else if (k === fwd) leaveRail();
        return;
      }
      if (k === 'ArrowUp') { if (!moving && !gridMove(-1)) goRow(r - 1); return; }
      if (k === 'ArrowDown') { if (!moving && !gridMove(1)) goRow(r + 1); return; }
      var dir = k === fwd ? 1 : -1;
      if (dir < 0 && !moving && railRow() >= 0 && (idx[r] === 0 || (osGrid() && r === AR && idx[r] % osGrid() === 0))) { toRail(); return; }
      moveH(dir);
    }
    function goRow(newR, forceIdx) {
      var dir = newR < r ? -1 : 1;
      while (newR >= 0 && newR < rowEls.length && (!rowVisible(newR) || isRail(newR) || (osSkin() && !items(newR).length))) newR += dir;
      if (newR < 0 || newR >= rowEls.length) return;
      var from = cur(), list = items(newR); if (!list.length) return;
      if (forceIdx != null) idx[newR] = forceIdx;
      else if (from) { var x = centerX(from), best = 0, bd = 1e9; list.forEach(function (e, i) { var d = Math.abs(centerX(e) - x); if (d < bd) { bd = d; best = i; } }); idx[newR] = best; }
      r = newR; apply();
    }
    function moveH(dir) {
      var list = items(r); if (!list.length) return;
      if (moving && r === AR) {
        var vis = visibleApps(), i = idx[AR], j = i + dir; if (j < 0 || j >= vis.length) return;
        var ai = apps.indexOf(vis[i]), aj = apps.indexOf(vis[j]), tmp = apps[ai]; apps[ai] = apps[aj]; apps[aj] = tmp;
        idx[AR] = j; saveOrder(); renderApps(); return;
      }
      var n = idx[r] + dir; if (n < 0 || n >= list.length) return; idx[r] = n; apply();
    }
    function ok() {
      var el = cur(); if (!el) return;
      var kind = el.dataset.kind, id = el.dataset.id;
      if (kind === 'app') {
        var pkg = el.dataset.pkg;
        if (mode === 'move') { moving = moving ? null : pkg; if (!moving) toast('تم الحفظ'); apply(); return; }
        if (mode === 'hide') { var k = hidden.indexOf(pkg); if (k >= 0) hidden.splice(k, 1); else hidden.push(pkg); save('appHidden', hidden); renderApps(); return; }
        if (mode === 'kidsel') { var q = kids.apps.indexOf(pkg); if (q >= 0) kids.apps.splice(q, 1); else kids.apps.push(pkg); saveKids(); renderApps(); return; }
        if (mode === 'icon') { openPicker(pkg); return; }
        launchApp(pkg);
      } else if (kind === 'osb') { osAct(id);
      } else if (kind === 'top') {
        if (id === 'search') openSearch();
        else if (id === 'settings') { if (HAS_ANDROID) A.openSettings(); }
        else if (id === 'wifi') { if (HAS_ANDROID) A.openWifi(); }
        else if (id === 'edit') openEdit();
        else if (id === 'power') openPower();
        else if (id === 'saver') { if (!PREVIEW) startSaver(); }
        else if (id === 'bt') { if (HAS_ANDROID && A.openBluetooth) A.openBluetooth(); }
        else if (id === 'net') { if (HAS_ANDROID && A.openNetwork) A.openNetwork(); }
        else if (id === 'sleep') { if (HAS_ANDROID) tvAction('tvsleep'); }
        else if (id === 'mute') { if (HAS_ANDROID) { A.volume(0); setTimeout(function () { renderTopbar(); nav.refresh(); }, 350); } }
        else if (id === 'mem') {
          if (!HAS_ANDROID || !A.memClean) return;
          toast('أنظف الذاكرة…');
          setTimeout(function () { var n = A.memClean(); toast(n < 0 ? 'ما گدرت أنظف الذاكرة' : n > 0 ? 'نظّفنا الذاكرة · صار فاضي ' + nf.format(n) + ' ميگا زيادة' : 'الذاكرة نظيفة ✓'); }, 60);
        }
        else if (id.indexOf('tv') === 0 && HAS_ANDROID) tvAction(id);
      } else if (kind === 'tool') {
        if (id === 'bg') openPicker();
        else if (id === 'quran') openQuran();
        else if (id === 'themes') openThemes();
        else if (id === 'kids') toggleKids();
        else if (id === 'prefs') openSettings();
        else if (id === 'bgnext') { if (bgPinned) { bgPinned = null; save('bgPinned', null); } bgManual++; showBg(); }
        else if (id === 'move') { moving = null; setMode(mode === 'move' ? 'normal' : 'move'); if (mode === 'normal') goRow(rowEls.length - 1); }
        else if (id === 'hide') { setMode(mode === 'hide' ? 'normal' : 'hide'); if (mode === 'normal') goRow(rowEls.length - 1); }
        else if (id === 'city') { cityIdx = (cityIdx + 1) % window.CITIES.length; save('cityIdx', cityIdx); renderAdhan(); renderTools(); }
        else if (id === 'hijri') { hijriOffset = hijriOffset >= 1 ? -1 : hijriOffset + 1; save('hijriOffset', hijriOffset); tick(); renderOccasions(); renderTools(); toast('التاريخ الهجري: ' + $('hijri').textContent); }
        else if (id === 'refresh') { toast('جاري التحديث…'); loadApps(true); refreshMatches(true); refreshWeather(true); loadMine(); buildBgList(); showBg(); refreshDaily(); checkUpdate(false); }
      }
    }
    function gridMove(dir) {
      var c = osGrid(); if (!c || r !== AR || moving) return false;
      var list = items(AR), n = idx[AR] + dir * c; if (n < 0 || n >= list.length) return false;
      idx[AR] = n; apply(); return true;
    }
    function back() {
      if (moving) { moving = null; apply(); return; }
      if (mode !== 'normal') { var wasKidsel = mode === 'kidsel'; setMode('normal'); if (wasKidsel) toast('تم حفظ تطبيقات الأطفال (' + nf.format(kids.apps.length) + ')'); return; }
      r = homeRow(); idx[r] = 0; apply();
    }
    return { refresh: apply, goRow: goRow, back: back, moveH: moveH, ok: ok, row: function () { return r; }, moving: function () { return moving; },
      appsRow: function () { return AR; }, goId: goId, gridMove: gridMove, arrow: arrow, railHome: railHome, home: function () { moving = null; if (mode !== 'normal') setMode('normal'); r = homeRow(); idx[r] = 0; apply(); } };
  })();

  function keyName(e) {
    var k = e.key;
    if (k === 'Enter' || k === ' ' || e.keyCode === 23 || e.keyCode === 13) return 'ok';
    if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || k === 'BrowserBack') return 'back';
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') return k;
    return null;
  }
  function handleKey(k) {
    lastInput = Date.now();
    if (saverOn) { stopSaver(); return; }
    if ($('pairBox').classList.contains('on')) { window.hidePair(); return; }
    clickSound(); if (k === 'ok') pressFx();
    if (layer === 'bg') return pickerKey(k);
    if (layer === 'power') return powerKey(k);
    if (layer === 'edit') return editKey(k);
    if (layer === 'list') return listKey(k);
    if (layer === 'search') return searchKey(k);
    if (layer === 'quran') return quranKey(k);
    if (layer === 'pin') return pinKey(k);
    if (k.indexOf('Arrow') === 0) nav.arrow(k);
    else if (k === 'ok') nav.ok();
    else if (k === 'back') nav.back();
  }
  /* hold OK on a button that has a second job (e.g. «مباشر»): a short press does the usual thing, a long press the other */
  var lpT = null, lpDone = false;
  document.addEventListener('keyup', function (e) {
    if (keyName(e) !== 'ok' || !lpT) return;
    clearTimeout(lpT); lpT = null; e.preventDefault(); handleKey('ok');
  });
  document.addEventListener('keydown', function (e) {
    if (keyName(e) === 'ok' && layer === 'main' && !saverOn) {
      var lpEl = document.querySelector('.item.focus[data-lp]');
      if (lpEl) {
        e.preventDefault();
        if (e.repeat || lpT) return;
        lpT = setTimeout(function () { lpT = null; lastInput = Date.now(); osLong(lpEl); }, 650);
        return;
      }
    }
    var k = keyName(e);
    var ae = document.activeElement, typing = ae && ae.tagName === 'INPUT';
    if (typing && k !== 'ok' && k !== 'back' && k !== 'ArrowDown' && k !== 'ArrowUp') { lastInput = Date.now(); return; }
    if (typing && k === 'back' && e.key === 'Backspace') { lastInput = Date.now(); return; }
    if (!k) { lastInput = Date.now(); if (saverOn) stopSaver(); return; }
    e.preventDefault(); handleKey(k);
  });

  window.remoteKey = function (k) { handleKey(k); };
  window.onBackKey = function () { handleKey('back'); };
  window.onHomePressed = function () {
    lastInput = Date.now(); if (saverOn) stopSaver();
    if (layer === 'edit') closeEdit(); else if (layer !== 'main') closeModal();
    nav.home();
  };
  window.onAppResume = function () {
    lastInput = Date.now(); if (saverOn) stopSaver();
    kidsOnResume(); renderApps();
    tick(); renderAdhan(); renderWisdom(); loadApps(false); refreshMatches(false); refreshDaily(); refreshWeather(false); renderNowPlaying();
  };

  // ---------- Start ----------
  try { if (!PREVIEW) save('teamAr', NAMES); } catch (e) {}
  renderTopbar(); applyLayout(); applyTheme(); saveSettings();
  tick(); renderAdhan(); renderWisdom(); renderTools(); renderApps(); renderOccasions(); renderMatches();
  renderBigCount(); renderActs(); applyKids(); refreshNews(false); applyLayout();
  loadBackgrounds(); loadApps(true); refreshMatches(false); refreshWeather(false); scheduleAll();
  if (!PREVIEW) setTimeout(function () { checkUpdate(false); }, 20000);
  setTimeout(pushConfig, 3000);
  setInterval(function () { checkUpdate(false); }, 6 * 3600000);
  setInterval(function () { refreshWeather(false); renderNowPlaying(); renderBigCount(); renderActs(); }, 60000);
  var lastDay = dayKey(new Date());
  setInterval(function () {
    tick(); renderAdhan(); renderWisdom(); showBg();
    if (!PREVIEW && settings.saverOn !== false && !saverOn && layer === 'main' && Date.now() - lastInput > (settings.saverMin || 10) * 60000 && document.visibilityState !== 'hidden') startSaver();
    var dk = dayKey(new Date());
    if (dk !== lastDay) { lastDay = dk; applyTheme(); renderOccasions(); renderBigCount(); renderActs(); buildBgList(); refreshDaily(); scheduleAll(); }
  }, 10000);
  setInterval(function () { refreshMatches(false); renderMatches(); refreshNews(false); }, 10 * 60000);


  // the frame around the part being edited in the phone's preview
  var selId = null;
  function showSel(id, list, sel) {
    if (id !== undefined) selId = id || null;
    var box = document.getElementById('pvSel');
    if (!box) { box = document.createElement('div'); box.id = 'pvSel'; box.appendChild(document.createElement('span')); document.body.appendChild(box); }
    var el = selId && document.querySelector(sel(selId));
    var r = el && el.getBoundingClientRect();
    if (!r || (!r.width && !r.height)) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.style.left = (r.left - 8) + 'px'; box.style.top = (r.top - 8) + 'px'; box.style.width = (r.width + 16) + 'px'; box.style.height = (r.height + 16) + 'px';
    var nm = 'هذا الجزء'; (list || []).forEach(function (e) { if (e[0] === selId) nm = e[1]; });
    box.firstChild.textContent = '✎ ' + nm;
  }
  // ---------- Live preview inside the phone app ----------
  window.__live = function (o) {
    if (o.layout) { layout = o.layout; applyLayout(); renderApps(); }
    if (o.settings) {
      if (o.full) { Object.keys(settings).forEach(function (k) { if (!(k in o.settings) && !(k in SETTINGS_DEFAULT)) delete settings[k]; }); }
      Object.keys(o.settings).forEach(function (k) { settings[k] = o.settings[k]; });
      applyTheme(); refreshNews(true); renderClub(); renderTopbar(); applyLayout(); renderApps(); refreshLive();
    }
    if (o.bg || o.settings) { buildBgList(); bgCur = ''; showBg(); }
    if (o.select !== undefined) {
      qa('.editing').forEach(function (e) { e.classList.remove('editing'); });
      var el = o.select && editEl(o.select); if (el) el.classList.add('editing');
    }
    var selFn = function (i) { return '[data-edit="' + i + '"]'; };
    showSel(o.select, EDITABLES, selFn);
    setTimeout(function () { showSel(undefined, EDITABLES, selFn); }, 380);
  };
  if (PREVIEW) window.addEventListener('resize', function () { showSel(undefined, EDITABLES, function (i) { return '[data-edit="' + i + '"]'; }); });
  window.__editables = EDITABLES;
  if (PREVIEW) {
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-edit]');
      try { if (window.parent && window.parent.__previewSelect) window.parent.__previewSelect(el ? el.getAttribute('data-edit') : null); } catch (er) {}
    }, true);
  }
  window.__test = { startSaver: startSaver, openPicker: openPicker, openPower: openPower, openEdit: openEdit, openSettings: openSettings, openSearch: openSearch, openQuran: openQuran, openStyle: function () { openElementStyle('row-apps', 'صف التطبيقات'); } };
})();
