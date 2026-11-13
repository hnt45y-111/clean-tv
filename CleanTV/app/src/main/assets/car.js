// واجهة السيارة: لمس، ويدجتات، تطبيقات السيارة، واجهات الشركات، الرحلات والصيانة، شاشة توقف.
// ES5 only: car head units (Android 8/9) often have an old WebView.
(function () {
  'use strict';
  var A = window.Android, HAS = !!A;
  var PREVIEW = /[?&]preview=1/.test(location.search);
  var PD = {}; if (PREVIEW) { try { PD = window.parent.__PREVIEW_DATA || {}; } catch (e) {} }
  var $ = function (id) { return document.getElementById(id); };
  var TZ = 'Asia/Baghdad', nf = new Intl.NumberFormat('ar-IQ-u-nu-arab'), nf1 = new Intl.NumberFormat('ar-IQ-u-nu-arab', { maximumFractionDigits: 1 });
  if (PD.cfg) PD.cfg = JSON.parse(JSON.stringify(PD.cfg));
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function load(k, d) {
    if (PREVIEW && PD.cfg && (has(PD.cfg, k) || k === 'carcfg')) { var x = PD.cfg[k]; return x == null ? d : JSON.parse(JSON.stringify(x)); }
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  }
  function save(k, v) { if (PREVIEW) { if (PD.cfg) PD.cfg[k] = v; return; } try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} if (k === 'carcfg') pushConfig(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad2(s) { s = String(s); return s.length < 2 ? '٠' + s : s; }
  var toastT; function toast(t) { var e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { e.classList.remove('on'); }, 2800); }
  function assign(t) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s) for (var k in s) if (has(s, k)) t[k] = s[k]; } return t; }

  var DEF = {
    theme: 'signature', bt: '', side: 'right', wlayout: 'split', cols: 4, owner: 'مدير الشاشات', night: 'auto', layout: 'carplay',
    icons: 'squircle', isize: 'm', labels: 'on', tilebg: 'off', cards: 'glass', cop: 8, rad: 3, fs: 100, dockStyle: 'bar', apphd: 'on',
    widgets: [{ t: 'speed', l: true, style: 'ring' }, { t: 'media', l: true }],
    apps: [], dock: ['home', 'maps', 'music', 'phone', 'mirror', 'apps'], volBtns: true, volPos: 'left', brand: null,
    alert: { on: true, city: 60, hw: 120, sound: true }, drive: { on: true, kmh: 20 }, maint: [], dial: [],
    saver: { on: true, min: 5, speed: true, music: true, overApps: true }, bgPack: [], bgDim: 45
  };
  var raw = load('carcfg', {}) || {};
  var cfg = assign({}, DEF, raw);
  if (cfg.owner && cfg.owner.indexOf('مؤمل') >= 0) cfg.owner = 'مدير الشاشات';
  if (raw.speedLimit && !raw.alert) cfg.alert = { on: true, city: 60, hw: raw.speedLimit, sound: true };
  if (raw.tiles === 'round' && !raw.icons) cfg.icons = 'circle';
  var settings = load('settings', {}) || {};
  if (!PREVIEW) try { localStorage.setItem('isCar', 'true'); } catch (e) {}

  // ---------- log kept on the car (trips, odometer, parking, maintenance done) ----------
  var LOG = load('carlog', null) || { odo: 0, odoBase: 0, trips: [], park: null, done: {} };
  if (PREVIEW) LOG = PD.carlog || { odo: 1234, odoBase: 84000, trips: [{ s: Date.now() - 3 * 3600000, e: Date.now() - 2.4 * 3600000, km: 23.4, max: 118, avg: 54 }, { s: Date.now() - 26 * 3600000, e: Date.now() - 25.5 * 3600000, km: 11.2, max: 92, avg: 41 }], park: { lat: 33.31, lng: 44.37, at: Date.now() - 50 * 60000 }, done: {} };
  var logDirty = false;
  function saveLog(now) { if (PREVIEW || (!logDirty && !now)) return; logDirty = false; try { localStorage.setItem('carlog', JSON.stringify(LOG)); } catch (e) {} pushConfig(); }
  if (cfg.odoSet && cfg.odoSet.stamp && LOG.odoStamp !== cfg.odoSet.stamp) { LOG.odoBase = (+cfg.odoSet.km || 0) - (LOG.odo || 0); LOG.odoStamp = cfg.odoSet.stamp; logDirty = true; saveLog(); }
  function odometer() { return Math.max(0, (LOG.odo || 0) + (LOG.odoBase || 0)); }
  var localDock = load('carDockApps', {}) || {};

  // ---------- config exchange with the phone app ----------
  function exportConfig() {
    return { v: 1, mode: 'car', carcfg: load('carcfg', {}), settings: load('settings', {}), cityIdx: load('cityIdx', 0), hijriOffset: load('hijriOffset', 0), stamp: load('cfgStamp', undefined),
      carlog: { odo: odometer(), trips: (LOG.trips || []).slice(-60), park: LOG.park, done: LOG.done || {}, cur: CUR ? { km: CUR.km, s: CUR.s } : null } };
  }
  function pushConfig() { if (HAS && A.writeConfig) try { A.writeConfig(JSON.stringify(exportConfig())); } catch (e) {} }
  window.exportConfig = exportConfig;
  window.importConfig = function (o) {
    if (!o) return;
    if (o.stamp) try { localStorage.setItem('cfgStamp', JSON.stringify(o.stamp)); } catch (e) {}
    ['carcfg', 'settings', 'cityIdx', 'hijriOffset'].forEach(function (k) {
      if (o[k] !== undefined) try { localStorage.setItem(k, JSON.stringify(o[k])); } catch (e) {}
    });
    if (o.carDone) { LOG.done = assign(LOG.done || {}, o.carDone); logDirty = true; saveLog(); }
    pushConfig();
    if (o.mode && o.mode !== 'car' && HAS && A.setMode) { try { localStorage.removeItem('isCar'); } catch (e) {} A.setMode(o.mode); return; }
    setTimeout(function () { location.reload(); }, 150);
  };
  if (HAS && A.pendingConfig) { try { var pend = A.pendingConfig(); if (pend) { window.importConfig(JSON.parse(pend)); return; } } catch (e) {} }
  function syncPrefs() {
    if (!HAS || !A.setPref) return;
    var s = cfg.saver || {};
    A.setPref('saverApps', s.on !== false && s.overApps !== false ? '1' : '0');
    A.setPref('saverMin', String(s.min || 5));
  }

  // ---------- icons ----------
  var I = {
    home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>', maps: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    bt: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    mirror: '<rect x="2" y="4" width="14" height="10" rx="2"/><rect x="17" y="8" width="5" height="12" rx="1.5"/><path d="M6 18h6"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    radio: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M6 3l12 4"/><circle cx="16" cy="14" r="3"/><path d="M5 12h5M5 16h5"/>',
    camera: '<path d="M23 7l-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>', eq: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    video: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 9l5 3-5 3z"/>', file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    park: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>', trip: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    vdown: '<path d="M3 9.5h3.5L11 6v12l-4.5-3.5H3z"/><path d="M15.5 12h5"/>', vup: '<path d="M3 9.5h3.5L11 6v12l-4.5-3.5H3z"/><path d="M15.5 12h5M18 9.5v5"/>',
    vmute: '<path d="M3 9.5h3.5L11 6v12l-4.5-3.5H3z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>'
  };
  var ic = function (n) { return '<svg viewBox="0 0 24 24">' + (I[n] || I.apps) + '</svg>'; };
  var P = { prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zM9.5 12l8.5 6V6z"/></svg>', next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' };

  // ---------- car apps ----------
  var CAR_APPS = [
    ['maps', 'خرائط گوگل', 'com.google.android.apps.maps', '#1a73e8'], ['maps', 'ويز', 'com.waze', '#33ccff'], ['maps', 'ساجك', 'com.sygic.aura', '#e53935'],
    ['maps', 'هير ويگو', 'com.here.app.maps', '#00afaa'], ['maps', 'ياندكس', 'ru.yandex.yandexnavi', '#ffcc00'],
    ['music', 'سبوتيفاي', 'com.spotify.music', '#1db954'], ['music', 'أنغامي', 'com.anghami', '#7b2ff7'], ['music', 'يوتيوب ميوزك', 'com.google.android.apps.youtube.music', '#ff0033'],
    ['music', 'ساوند كلاود', 'com.soundcloud.android', '#ff5500'], ['music', 'الموسيقى', 'com.syu.music', '#ff3b3b'], ['music', 'الموسيقى', 'com.microntek.music', '#ff3b3b'],
    ['music', 'الموسيقى', 'com.ts.music', '#ff3b3b'], ['music', 'الموسيقى', 'com.fyt.music', '#ff3b3b'],
    ['radio', 'الراديو', 'com.syu.radio', '#f59e0b'], ['radio', 'الراديو', 'com.microntek.radio', '#f59e0b'], ['radio', 'الراديو', 'com.ts.radio', '#f59e0b'], ['radio', 'الراديو', 'com.android.fmradio', '#f59e0b'],
    ['phone', 'البلوتوث والاتصال', 'com.syu.bt', '#22c55e'], ['phone', 'البلوتوث والاتصال', 'com.microntek.bluetooth', '#22c55e'], ['phone', 'البلوتوث والاتصال', 'com.ts.bt', '#22c55e'], ['phone', 'البلوتوث والاتصال', 'com.fyt.bt', '#22c55e'],
    ['mirror', 'زي لينك', 'com.zjinnova.zlink', '#0ea5e9'], ['mirror', 'أوتو كيت', 'cn.manstep.phonemirrorBox', '#2563eb'], ['mirror', 'كار لينك', 'com.ts.carlink', '#2563eb'],
    ['mirror', 'تي لينك', 'com.suding.speedplay', '#2563eb'], ['mirror', 'إيزي كونكشن', 'net.easyconn', '#2563eb'], ['mirror', 'أندرويد أوتو', 'com.google.android.projection.gearhead', '#3ddc84'],
    ['camera', 'الكاميرا', 'com.syu.camera', '#64748b'], ['camera', 'الكاميرا', 'com.microntek.avin', '#64748b'], ['camera', 'الكاميرا', 'com.ts.avin', '#64748b'],
    ['eq', 'المعادل الصوتي', 'com.syu.eq', '#a855f7'], ['eq', 'المعادل الصوتي', 'com.microntek.eq', '#a855f7'],
    ['video', 'يوتيوب', 'com.google.android.youtube', '#ff0000'], ['video', 'شاهد', 'net.mbc.shahid', '#1fb36a'], ['file', 'الملفات', 'com.android.documentsui', '#5b6b8c'],
    ['settings', 'الإعدادات', 'com.syu.settings', '#607d8b'], ['settings', 'الإعدادات', 'com.android.settings', '#607d8b']
  ];
  var AR = { 'com.android.chrome': 'كروم', 'com.whatsapp': 'واتساب', 'org.telegram.messenger': 'تيليگرام', 'com.android.vending': 'المتجر', 'com.google.android.gm': 'جيميل' };
  var BTM = /(\bbt\b|blue ?tooth|بلوتوث|蓝牙).{0,14}(music|موسيق|音乐|audio|اغان|أغان|av)|(music|موسيق|音乐|audio).{0,14}(\bbt\b|blue ?tooth|بلوتوث|蓝牙)|btmusic|bt_music|musicbt|a2dp|btav|btaudio|actbtav|bluetoothmusic/i;
  var apps = [], appsBy = {};
  function basePkg(p) { return String(p || '').split('/')[0]; }
  function kindOf(p) { p = basePkg(p); for (var i = 0; i < CAR_APPS.length; i++) if (CAR_APPS[i][2] === p) return CAR_APPS[i]; return null; }
  function guessKind(a) {
    var p = (a.pkg + ' ' + (a.cls || '') + ' ' + (a.label || '')).toLowerCase();
    if (BTM.test(p)) return 'btmusic';
    if (/radio|\bfm\b/.test(p)) return 'radio'; if (/\.bt\b|bluetooth|dialer|phone|بلوتوث|btphone|bt_phone|hands.?free|蓝牙|\bbt\b/.test(p)) return 'phone';
    if (/file|explorer|documents|manager|ملفات/.test(p)) return 'file';
    if (/avin|camera|dvr/.test(p)) return 'camera'; if (/zlink|carlink|carplay|autokit|mirror|easyconn|speedplay/.test(p)) return 'mirror';
    if (/music|audio|player/.test(p)) return 'music'; if (/navi|maps/.test(p)) return 'maps'; return null;
  }
  function setApps(list) {
    apps = (list || []).map(function (a) {
      var k = kindOf(a.pkg), g = guessKind(a);
      a.kind = g === 'btmusic' ? 'btmusic' : k ? k[0] : g;
      if (k && !a.cls) a.label = k[1]; else if (AR[a.pkg]) a.label = AR[a.pkg];
      if (a.kind === 'btmusic' && !/[؀-ۿ]/.test(a.label || '')) a.label = 'موسيقى البلوتوث';
      a.color = (k && k[3]) || a.color || (a.kind === 'btmusic' ? '#2f7dff' : '');
      return a;
    });
    appsBy = {}; apps.forEach(function (a) { appsBy[a.pkg] = a; });
    renderApps(); renderDock();
  }
  function loadApps() {
    if (PD.apps) return setApps(PD.apps.slice());
    if (!HAS) return setApps(window.__DEMO_APPS || []);
    var id = 'k' + Date.now(), old = window.__cb;
    window.__cb = function (cid, t) { if (cid !== id) { if (old) old(cid, t); return; } var l = []; try { l = JSON.parse(t) || []; } catch (e) {} window.__cb = old; setApps(l); };
    try { A.getAppsAsync(id); } catch (e) {}
  }
  function carApps() {
    if (cfg.apps && cfg.apps.length) { var ch = cfg.apps.map(function (p) { return appsBy[p]; }).filter(Boolean); if (ch.length) return ch; }
    var order = ['maps', 'btmusic', 'music', 'mirror', 'phone', 'radio', 'camera', 'video', 'eq', 'file', 'settings'], out = [], seen = {};
    order.forEach(function (k) { apps.forEach(function (a) { if (a.kind === k && !seen[a.kind + a.label] && out.length < 12) { seen[a.kind + a.label] = 1; out.push(a); } }); });
    if (out.length < 8) apps.forEach(function (a) { if (out.indexOf(a) < 0 && out.length < 8) out.push(a); });
    return out;
  }
  var GLY = { maps: 'maps', music: 'music', btmusic: 'bt', phone: 'phone', mirror: 'mirror', radio: 'radio', camera: 'camera', video: 'video', eq: 'eq', file: 'file', settings: 'settings' };
  function tile(a) {
    var g = GLY[a.kind] || 'apps';
    var inner = a.icon && cfg.icons !== 'neon' && cfg.icons !== 'outline' ? '<img src="' + esc(a.icon) + '" alt="">' : ic(g);
    return '<div class="app" data-pkg="' + esc(a.pkg) + '" style="--c:' + esc(a.color || 'var(--ac)') + '"><div class="pl">' + inner + '</div><b>' + esc(a.label) + '</b></div>';
  }
  function maxApps() {
    var lay = cfg.layout || 'carplay', cols = +cfg.cols || 4;
    if (lay === 'atv' || lay === 'mbux') return 12;
    if (lay === 'cockpit' || lay === 'hero') return 6;
    if (lay === 'trio') return 7;
    if (lay === 'gauge' || lay === 'split' || lay === 'cards') return 0;
    if (cfg.wlayout === 'top') return cols * 2;
    return cols * (lay === 'carplay' ? 2 : 3);
  }
  function renderApps() {
    var l = carApps();
    $('grid').innerHTML = l.slice(0, maxApps()).map(tile).join('') || '<div class="app"><b>ما لگيت تطبيقات</b></div>';
    $('all').innerHTML = apps.slice().sort(function (a, b) { return String(a.label).localeCompare(String(b.label), 'ar'); }).map(tile).join('');    if (cfg.scene && document.querySelector('#scb .s-apps')) renderScene();
  }
  function launch(pkg) {
    if (PREVIEW) return;
    if (HAS) { try { if (!A.launch(pkg)) toast('ما گدرت أفتح التطبيق'); } catch (e) {} }
  }
  function firstOf(kind) { for (var i = 0; i < apps.length; i++) if (apps[i].kind === kind) return apps[i]; return null; }
  /* the app whose song is shown in the music card. Bluetooth music from the phone is played by the system's Bluetooth
     service (no icon of its own), so it maps to the head unit's Bluetooth app */
  function btSys(p) { return /^com\.android\.bluetooth|bluetooth\.avrcp|a2dpsink/i.test(String(p || '')); }
  function playingApp() {
    if (!MED || !MED.ok || !MED.pkg || MED.pkg === 'com.cleantv.launcher') return null;
    if (btSys(MED.pkg)) { var b = firstOf('btmusic') || firstOf('phone'); return b ? b.pkg : null; }
    for (var i = 0; i < apps.length; i++) if (basePkg(apps[i].pkg) === MED.pkg) return apps[i].pkg;
    return null;
  }
  var DOCK = { home: ['الرئيسية', 'home'], maps: ['الخرائط', 'maps'], music: ['الموسيقى', 'music'], phone: ['الاتصال', 'phone'], mirror: ['ربط الموبايل', 'mirror'],
    radio: ['الراديو', 'radio'], camera: ['الكاميرا', 'camera'], apps: ['التطبيقات', 'apps'], settings: ['الإعدادات', 'settings'], trips: ['رحلاتي', 'trip'], park: ['سيارتي', 'park'] };
  function renderDock() {
    $('dock').innerHTML = (cfg.dock || DEF.dock).filter(function (k) { return DOCK[k]; }).map(function (k) {
      return '<button data-dock="' + k + '" class="' + (k === 'home' ? 'home' : '') + '">' + ic(DOCK[k][1]) + '<span>' + DOCK[k][0] + '</span></button>';
    }).join('');
  }
  function dockTarget(k) {
    var p = localDock[k] || (cfg.dockApps && cfg.dockApps[k]);
    if (p && (appsBy[p] || !apps.length)) return p;
    if (k === 'music') { var pl = playingApp(); if (pl) return pl; var b = firstOf('btmusic') || firstOf('phone') || firstOf('music'); return b && b.pkg; }
    var a = firstOf(k); return a && a.pkg;
  }
  function dockAct(k) {
    if (PREVIEW) return;
    if (k === 'home') { closeAll(); return; }
    if (k === 'apps') { if (document.body.classList.contains('driving')) { toast('القائمة تتسكر وكت السياقة'); return; } $('drawer').classList.add('on'); return; }
    if (k === 'trips') { openTrips(); return; }
    if (k === 'park') { openPark(); return; }
    if (k === 'settings') { var s = dockTarget('settings'); if (s) launch(s); else if (HAS) A.openSettings(); return; }
    var p = dockTarget(k); if (p) launch(p); else toast(k === 'mirror' ? 'نصّب تطبيق ربط الموبايل (مثل زي لينك) من «مدير الشاشة»' : 'ما لگيت تطبيق لهذا. اضغط مطوّل حتى تختاره');
  }
  function closeAll() { $('drawer').classList.remove('on'); $('ov').classList.remove('on'); }

  // choose which app a dock button opens (long-press on the car itself)
  function chooseFor(k) {
    var cur = dockTarget(k);
    openOv('اختار التطبيق لـ «' + (DOCK[k] ? DOCK[k][0] : k) + '»', '<div class="rows"><div class="r" data-pick=""><b>تلقائي</b><i>' + (k === 'music' ? 'موسيقى البلوتوث أول شي' : '') + '</i></div>' +
      apps.slice().sort(function (a, b) { return (b.kind === 'btmusic') - (a.kind === 'btmusic') || String(a.label).localeCompare(String(b.label), 'ar'); }).map(function (a) {
        return '<div class="r' + (a.pkg === cur ? ' sel' : '') + '" data-pick="' + esc(a.pkg) + '">' + (a.icon ? '<img src="' + esc(a.icon) + '" alt="">' : '') + '<b>' + esc(a.label) + '</b><i>' + esc(a.cls ? a.cls.split('.').pop() : '') + '</i></div>';
      }).join('') + '</div>');
    $('ovb').onclick = function (e) {
      var r = e.target.closest('[data-pick]'); if (!r) return;
      var p = r.getAttribute('data-pick');
      if (p) localDock[k] = p; else delete localDock[k];
      save('carDockApps', localDock); closeAll(); toast(p ? 'انحفظ: ' + ((appsBy[p] || {}).label || p) : 'رجع تلقائي');
    };
  }

  // ---------- live data ----------
  var LOC = { ok: false, kmh: 0 }, MED = { ok: false };
  window.onLoc = function (l) { LOC = l || LOC; };
  function poll() {
    if (PREVIEW) {
      LOC = PD.loc || { ok: true, kmh: 87, bearing: 40, alt: 34, lat: 33.31, lng: 44.37 };
      MED = PD.media || { ok: true, title: 'اسم الأغنية', artist: 'اسم الفنان', app: 'موسيقى البلوتوث', playing: true, pos: 62000, dur: 200000 };
      speedAlert(+LOC.kmh || 0);
      return paintLive();
    }
    if (HAS) {
      try { LOC = JSON.parse(A.loc()); } catch (e) {}
      try { MED = JSON.parse(A.media()); } catch (e) {}
    } else { LOC = window.__DEMO_LOC || LOC; MED = window.__DEMO_MEDIA || MED; }
    tick();
    paintLive();
  }
  var fT = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
  var fD = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  var fDs = new Intl.DateTimeFormat('ar-IQ-u-nu-arab', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ });
  var cal = 'islamic-umalqura'; try { new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura'); } catch (e) { cal = 'islamic'; }
  var fH = new Intl.DateTimeFormat('ar-u-ca-' + cal + '-nu-arab', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
  function hm(d) { var h = '', m = '', ap = ''; try { fT.formatToParts(d).forEach(function (x) { if (x.type === 'hour') h = x.value; if (x.type === 'minute') m = x.value; if (x.type === 'dayPeriod') ap = x.value; }); } catch (e) { var b = new Date(d.getTime() + 3 * 3600000); h = nf.format(b.getUTCHours() % 12 || 12); m = pad2(nf.format(b.getUTCMinutes())); ap = b.getUTCHours() < 12 ? 'ص' : 'م'; } return { t: h + ':' + m, h: h, m: m, ap: ap }; }
  var DIRS = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
  function ago(t) { var m = Math.round((Date.now() - t) / 60000); if (m < 1) return 'هسه'; if (m < 60) return 'قبل ' + nf.format(m) + ' دقيقة'; var h = Math.round(m / 60); if (h < 24) return 'قبل ' + nf.format(h) + ' ساعة'; return 'قبل ' + nf.format(Math.round(h / 24)) + ' يوم'; }

  // ---------- trips, odometer, parking ----------
  var CUR = LOG.cur || null, lastTick = Date.now(), stopSince = 0, lastSave = Date.now();
  function tick() {
    var now = Date.now(), dt = Math.min(5000, now - lastTick); lastTick = now;
    var kmh = LOC && LOC.ok ? (+LOC.kmh || 0) : 0;
    if (kmh >= 5) {
      if (!CUR) CUR = { s: now, km: 0, max: 0, sum: 0, n: 0 };
      var d = kmh * dt / 3600000;
      CUR.km += d; LOG.odo = (LOG.odo || 0) + d; CUR.max = Math.max(CUR.max, kmh); CUR.sum += kmh; CUR.n++; CUR.last = now; CUR.parked = false;
      stopSince = 0; logDirty = true;
    } else if (CUR) {
      if (!stopSince) stopSince = now;
      if (!CUR.parked && now - stopSince > 60000 && LOC && LOC.lat) { LOG.park = { lat: LOC.lat, lng: LOC.lng, at: now }; CUR.parked = true; logDirty = true; }
      if (now - stopSince > 5 * 60000) endTrip(now);
    }
    LOG.cur = CUR;
    if (now - lastSave > 20000) { lastSave = now; saveLog(); }
    driveMode(kmh);
    speedAlert(kmh);
  }
  function endTrip(now) {
    if (!CUR) return;
    if (CUR.km >= 0.3) {
      LOG.trips = (LOG.trips || []).concat({ s: CUR.s, e: CUR.last || now, km: Math.round(CUR.km * 10) / 10, max: Math.round(CUR.max), avg: Math.round(CUR.sum / Math.max(1, CUR.n)) }).slice(-120);
      if (LOC && LOC.lat && !CUR.parked) LOG.park = { lat: LOC.lat, lng: LOC.lng, at: CUR.last || now };
    }
    CUR = null; LOG.cur = null; stopSince = 0; logDirty = true; saveLog(true);
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveLog(true); });

  // ---------- driving mode ----------
  var driving = false, slowSince = 0;
  function driveMode(kmh) {
    var d = cfg.drive || {}, on = d.on !== false, lim = +d.kmh || 20;
    if (!on) { if (driving) { driving = false; document.body.classList.remove('driving'); $('drvPill').classList.remove('on'); } return; }
    if (!driving && kmh >= lim) { driving = true; slowSince = 0; document.body.classList.add('driving'); $('drvPill').classList.add('on'); $('drawer').classList.remove('on'); renderWidgets(); }
    else if (driving && kmh < Math.max(3, lim - 8)) {
      if (!slowSince) slowSince = Date.now();
      if (Date.now() - slowSince > 10000) { driving = false; document.body.classList.remove('driving'); $('drvPill').classList.remove('on'); renderWidgets(); }
    } else slowSince = 0;
  }

  // ---------- speed alert ----------
  var prof = load('carProf', 'hw'), lastBeep = 0, AC = null;
  function limitNow() { var a = cfg.alert || {}; if (a.on === false) return 0; return prof === 'city' ? (+a.city || 60) : (+a.hw || 120); }
  function beep() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      [0, .22].forEach(function (t0) {
        var o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = 1320;
        g.gain.setValueAtTime(0.0001, AC.currentTime + t0); g.gain.exponentialRampToValueAtTime(0.5, AC.currentTime + t0 + .02); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + t0 + .18);
        o.connect(g); g.connect(AC.destination); o.start(AC.currentTime + t0); o.stop(AC.currentTime + t0 + .2);
      });
    } catch (e) {}
  }
  function speedAlert(kmh) {
    var lim = limitNow(), over = lim > 0 && kmh > lim;
    $('alertFx').classList.toggle('on', !!over && (!PREVIEW || PD.over));
    if (over && (cfg.alert || {}).sound !== false && Date.now() - lastBeep > 8000) { lastBeep = Date.now(); if (!PREVIEW) beep(); }
    var pl = $('limPill'); pl.classList.toggle('on', lim > 0);
    txt('limPill', (prof === 'city' ? 'مدينة ' : 'خط سريع ') + nf.format(lim));
  }
  function toggleProf() { prof = prof === 'city' ? 'hw' : 'city'; save('carProf', prof); toast('حد السرعة: ' + (prof === 'city' ? 'داخل المدينة ' : 'الخط السريع ') + nf.format(limitNow()) + ' كم/ساعة'); paintLive(); }

  // ---------- maintenance ----------
  function maintState(it) {
    var dn = (LOG.done || {})[it.id], last = { km: +it.lastKm || 0, at: +it.lastAt || 0 };
    if (dn && dn.at > last.at) last = dn;
    var odo = odometer(), kmLeft = it.km ? (+it.km - (odo - last.km)) : null, dLeft = it.days && last.at ? (+it.days - (Date.now() - last.at) / 86400000) : null;
    var pk = it.km ? Math.min(1, Math.max(0, (odo - last.km) / it.km)) : 0, pd = it.days && last.at ? Math.min(1, Math.max(0, (Date.now() - last.at) / (it.days * 86400000))) : 0;
    var p = Math.max(pk, pd);
    return { p: p, due: p >= 1, soon: p >= .9, kmLeft: kmLeft, dLeft: dLeft };
  }
  function maintText(s) {
    if (s.due) return 'حان وقته';
    var a = [];
    if (s.kmLeft != null) a.push('باقي ' + nf.format(Math.max(0, Math.round(s.kmLeft))) + ' كم');
    if (s.dLeft != null) a.push(nf.format(Math.max(0, Math.round(s.dLeft))) + ' يوم');
    return a.join(' أو ') || '—';
  }
  var bannerItem = null;
  function checkBanner() {
    var b = $('banner'), snooze = load('carSnooze', {}) || {}, today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
    bannerItem = null;
    (cfg.maint || []).forEach(function (it) { if (!bannerItem && it.id && maintState(it).due && snooze[it.id] !== today) bannerItem = it; });
    if (!bannerItem || driving) { b.classList.remove('on'); return; }
    b.innerHTML = ic('wrench').replace('<svg', '<svg style="width:3.4vh;height:3.4vh;stroke:#ffbe50;fill:none;stroke-width:2;margin-left:1vw"') + '<b>تذكير الصيانة:</b><span>' + esc(bannerItem.n) + '</span><button data-bn="done">سويته ✓</button><button class="x" data-bn="later">بعدين</button>';
    b.classList.add('on');
  }

  // ---------- night by sunset ----------
  function isNight() {
    if (cfg.night === 'on') return true;
    if (cfg.night === 'off' || PREVIEW) return false;
    var b = new Date(Date.now() + 3 * 3600000), h = b.getUTCHours() + b.getUTCMinutes() / 60;
    try {
      var c = window.CITIES[load('cityIdx', 0)] || window.CITIES[0], t = window.PRAY.compute({ y: b.getUTCFullYear(), m: b.getUTCMonth() + 1, d: b.getUTCDate() }, c[1], c[2], 3);
      return h < t.sunrise || h >= t.maghrib + 0.25;
    } catch (e) { return h >= 19 || h < 6; }
  }

  // ---------- widgets ----------
  var WX = null;
  function wxLoad() {
    var c = (window.CITIES || [])[load('cityIdx', 0)] || [0, 33.31, 44.37];
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c[1] + '&longitude=' + c[2] + '&current=temperature_2m,weather_code&timezone=Asia%2FBaghdad';
    var done = function (j) { if (j && j.current) { WX = { t: Math.round(j.current.temperature_2m), c: j.current.weather_code }; paintLive(); } };
    if (HAS && A.fetchAsync) { var id = 'w' + Date.now(); var old = window.__cb; window.__cb = function (cid, t) { if (cid === id) { try { done(JSON.parse(t)); } catch (e) {} window.__cb = old; } else if (old) old(cid, t); }; A.fetchAsync(url, id); }
    else if (window.fetch) fetch(url).then(function (r) { return r.json(); }).then(done).catch(function () {});
  }
  function wxText(c) { return c == null ? '' : c === 0 ? 'صحو' : c < 4 ? 'غيوم خفيفة' : c < 50 ? 'ضباب' : c < 70 ? 'مطر' : c < 80 ? 'ثلج' : 'عواصف'; }
  function nextPrayer() {
    if (!window.PRAY || !window.CITIES) return null;
    var c = window.CITIES[load('cityIdx', 0)] || window.CITIES[0], d = new Date(Date.now() + 3 * 3600000);
    var t = window.PRAY.compute({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }, c[1], c[2], 3);
    var now = d.getUTCHours() + d.getUTCMinutes() / 60, names = [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['maghrib', 'المغرب']];
    for (var i = 0; i < names.length; i++) if (t[names[i][0]] > now) return { n: names[i][1], h: t[names[i][0]] };
    return { n: 'الفجر', h: t.fajr + 24 };
  }
  function fmtH(h) { h = ((h % 24) + 24) % 24; var hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } var ap = hh < 12 ? 'ص' : 'م', h12 = hh % 12 || 12; return nf.format(h12) + ':' + pad2(nf.format(mm)) + ' ' + ap; }

  // gauges (viewBox 200x200). 270° scale from bottom-left, clockwise over the top.
  function pol(a, r) { var t = a * Math.PI / 180; return [100 + r * Math.cos(t), 100 + r * Math.sin(t)]; }
  function arcPath(r) { var s = pol(135, r), e = pol(45, r); return 'M' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 1 1 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2); }
  function ticks(max, r1, r2, r3, labels) {
    var o = '';
    for (var v = 0; v <= max; v += 10) {
      var a = 135 + 270 * v / max, mj = v % 20 === 0, p1 = pol(a, mj ? r1 - 4 : r1), p2 = pol(a, r2);
      o += '<line class="tk' + (mj ? ' mj' : '') + '" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '" stroke-width="' + (mj ? 2.4 : 1.2) + '"/>';
      if (labels && mj && (max <= 200 || v % 40 === 0)) { var p3 = pol(a, r3); o += '<text class="lbn" x="' + p3[0].toFixed(1) + '" y="' + (p3[1] + 4).toFixed(1) + '" text-anchor="middle">' + v + '</text>'; }
    }
    return o;
  }
  function gaugeHtml(w) {
    var st = w.style || 'ring', max = +w.max || 200;
    if (st === 'digital') return '<div class="dg" data-g="digital"><b data-n>٠</b><span>كم/ساعة</span></div>';
    if (st === 'bar') { var s = ''; for (var i = 0; i < 24; i++) s += '<i class="' + (i >= 18 ? 'hot' : '') + '"></i>'; return '<div class="sbar" data-g="bar" data-max="' + max + '"><div class="row"><b data-n>٠</b><span class="sub">كم/ساعة</span></div><div class="segs">' + s + '</div></div>'; }
    var svg = '<svg class="g" viewBox="0 0 200 200" data-g="' + st + '" data-max="' + max + '">';
    if (st === 'ring') {
      var C = 2 * Math.PI * 80;
      var tk = ''; for (var j = 0; j < 60; j++) { var a = j * 6 - 90, p1 = pol(a, 92), p2 = pol(a, j % 5 ? 95 : 98); tk += '<line class="tk' + (j % 5 ? '' : ' mj') + '" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '" stroke-width="' + (j % 5 ? 1 : 2) + '"/>'; }
      svg += tk + '<circle class="trk" cx="100" cy="100" r="80" stroke-width="11"/>' +
        '<circle class="val" cx="100" cy="100" r="80" stroke-width="22" opacity=".22" transform="rotate(-90 100 100)" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-len="' + C.toFixed(1) + '"/>' +
        '<circle class="val" cx="100" cy="100" r="80" stroke-width="11" transform="rotate(-90 100 100)" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-len="' + C.toFixed(1) + '"/>' +
        '<text class="num" data-n x="100" y="116" text-anchor="middle" font-size="58">٠</text><text class="unit" x="100" y="142" text-anchor="middle" font-size="14">كم/ساعة</text>' +
        '<text class="unit" data-lim x="100" y="68" text-anchor="middle" font-size="12"></text>';
    } else if (st === 'needle' || st === 'classic') {
      svg += '<circle cx="100" cy="100" r="96" fill="rgba(0,0,0,.25)" stroke="rgba(255,255,255,.12)" stroke-width="2"/>' + ticks(max, 86, 92, 70, true) +
        '<path class="trk" d="' + arcPath(92) + '" stroke-width="3"/>' +
        '<g class="ndl" data-ndl style="transform-origin:100px 100px;-webkit-transform-origin:100px 100px"><path d="M100 22 L104 100 L96 100 Z" fill="var(--wc, var(--ac))"/><path d="M100 22 L104 100 L96 100 Z" fill="var(--wc, var(--ac))" opacity=".35" transform="translate(0 2)"/></g>' +
        '<circle cx="100" cy="100" r="9" fill="#222" stroke="var(--wc, var(--ac))" stroke-width="3"/>' +
        '<text class="num" data-n x="100" y="150" text-anchor="middle" font-size="30">٠</text><text class="unit" x="100" y="168" text-anchor="middle" font-size="11">كم/ساعة</text>';
    } else if (st === 'dots') {
      for (var k = 0; k < 30; k++) { var pp = pol(135 + 270 * k / 29, 82); svg += '<circle class="dot" cx="' + pp[0].toFixed(1) + '" cy="' + pp[1].toFixed(1) + '" r="5.2"/>'; }
      svg += '<text class="num" data-n x="100" y="114" text-anchor="middle" font-size="56">٠</text><text class="unit" x="100" y="140" text-anchor="middle" font-size="14">كم/ساعة</text>';
    } else {
      var L = 2 * Math.PI * 82 * .75;
      svg += ticks(max, 96, 100, 0, false) + '<path class="trk" d="' + arcPath(82) + '" stroke-width="13" stroke-linecap="round"/>' +
        '<path class="val" d="' + arcPath(82) + '" stroke-width="13" stroke-dasharray="' + L.toFixed(1) + '" stroke-dashoffset="' + L.toFixed(1) + '" data-len="' + L.toFixed(1) + '"/>' +
        '<text class="num" data-n x="100" y="112" text-anchor="middle" font-size="56">٠</text><text class="unit" x="100" y="138" text-anchor="middle" font-size="14">كم/ساعة</text>';
    }
    return svg + '</svg>';
  }
  function paintGauges(kmh) {
    var els = document.querySelectorAll('[data-g]');
    for (var i = 0; i < els.length; i++) {
      var g = els[i], st = g.getAttribute('data-g'), max = +g.getAttribute('data-max') || 200, p = Math.min(1, kmh / max);
      var n = g.querySelector('[data-n]'), nv = g.closest && g.closest('.sc') ? String(Math.round(kmh)) : nf.format(kmh); if (n && n.textContent !== nv) n.textContent = nv;
      if (st === 'ring' || st === 'arc') { var v = g.querySelectorAll('.val'); for (var j = 0; j < v.length; j++) v[j].setAttribute('stroke-dashoffset', (+v[j].getAttribute('data-len') * (1 - p)).toFixed(1)); }
      else if (st === 'pro') {
        var pv = g.querySelectorAll('.val'); for (var q = 0; q < pv.length; q++) pv[q].setAttribute('stroke-dashoffset', (+pv[q].getAttribute('data-len') * (1 - p)).toFixed(1));
        var pn = g.querySelector('[data-ndl]'); if (pn) { var pd = (-135 + 270 * p).toFixed(1); pn.style.transform = 'rotate(' + pd + 'deg)'; pn.style.webkitTransform = pn.style.transform; }
      } else if (st === 'line') { var ln = g.querySelector('[data-ndl]'); if (ln) { var ld = (-62 + 124 * p).toFixed(1); ln.style.transform = 'rotate(' + ld + 'deg)'; ln.style.webkitTransform = ln.style.transform; } }
      else if (st === 'needle' || st === 'classic') { var nd = g.querySelector('[data-ndl]'); if (nd) { var deg = (-135 + 270 * p).toFixed(1); nd.style.transform = 'rotate(' + deg + 'deg)'; nd.style.webkitTransform = 'rotate(' + deg + 'deg)'; } }
      else if (st === 'dots') { var d = g.querySelectorAll('.dot'), on = Math.round(p * d.length); for (var k = 0; k < d.length; k++) d[k].classList.toggle('on', k < on); }
      else if (st === 'bar') { var sg = g.querySelectorAll('.segs i'), on2 = Math.round(p * sg.length); for (var m = 0; m < sg.length; m++) sg[m].classList.toggle('on', m < on2); }
      var lm = g.querySelector('[data-lim]'); if (lm) { var l = limitNow(); lm.textContent = l ? 'الحد ' + nf.format(l) : ''; }
    }
  }
  function analogSvg() {
    var t = ''; for (var i = 0; i < 12; i++) { var a = i * 30 * Math.PI / 180; t += '<line x1="' + (50 + 40 * Math.sin(a)) + '" y1="' + (50 - 40 * Math.cos(a)) + '" x2="' + (50 + 45 * Math.sin(a)) + '" y2="' + (50 - 45 * Math.cos(a)) + '" stroke="var(--mute)" stroke-width="' + (i % 3 ? 1.2 : 2.6) + '"/>'; }
    return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="var(--line)" stroke-width="2"/>' + t +
      '<line id="aH" x1="50" y1="50" x2="50" y2="26" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/><line id="aM" x1="50" y1="50" x2="50" y2="14" stroke="var(--wc, var(--ac))" stroke-width="2.6" stroke-linecap="round"/><circle cx="50" cy="50" r="3" fill="var(--wc, var(--ac))"/></svg>';
  }
  function compassSvg() {
    return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" stroke-width="2"/><g id="cmpN"><path d="M50 10 L58 50 L50 44 L42 50 Z" fill="var(--wc, var(--ac))"/><path d="M50 90 L58 50 L50 56 L42 50 Z" fill="var(--mute)"/></g>' +
      '<text x="50" y="8" font-size="7" text-anchor="middle" fill="var(--ink)">ش</text></svg>';
  }
  var DCOL = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6'];
  function initials(n) { n = String(n || '?').trim(); var p = n.split(/\s+/); return (p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : ''); }
  function widgetHtml(w, i) {
    var t = w.t, h = '', lb = function (s) { return '<div class="lb">' + s + '</div>'; };
    if (t === 'speed') h = '<div class="spd" id="wSpd' + i + '" data-spd>' + gaugeHtml(w) + (w.l && (cfg.layout !== 'carplay') && w.style !== 'bar' ? '<div class="meta" data-spdmeta></div>' : '') + '</div>';
    else if (t === 'clock') { var cs = w.style || 'big'; h = '<div class="clk ' + cs + '"><b data-clock="' + cs + '"></b><span data-clocks></span></div>'; }
    else if (t === 'analog') h = '<div class="anal">' + analogSvg() + '</div>';
    else if (t === 'date') h = '<div>' + lb('التاريخ') + '<div class="big" style="font-size:4.6vh" data-date></div><div class="sub" data-hijri></div></div>';
    else if (t === 'media') h = (w.style === 'cover' ? '<div class="medbg" data-medbg></div>' : '') + '<div class="med" data-med>' + (w.style === 'compact' ? '' : '<div class="art" data-art></div>') + '<div class="tx">' + lb('الموسيقى') + '<div class="t" data-mt>ماكو شي شغّال</div><div class="a" data-ma>شغّل موسيقى من البلوتوث أو أي تطبيق</div>' +
      '<div class="pg"><i data-mpg></i></div><div class="mctl"><button data-mc="prev">' + P.prev + '</button><button data-mc="toggle" class="pp" data-mpp>' + P.play + '</button><button data-mc="next">' + P.next + '</button></div>' +
      '<button class="na" data-na>فعّل قراءة الأغاني</button></div></div>';
    else if (t === 'map') h = '<div class="map" data-map><div class="tiles" data-tiles></div><div class="me"><svg viewBox="0 0 24 24"><path d="M12 2l7 19-7-4-7 4z"/></svg></div><div class="lbx">خريطة مباشرة</div><div class="msg" data-mapmsg>الخريطة تحتاج الموقع والإنترنت</div><div class="osm">© OpenStreetMap</div></div>';
    else if (t === 'weather') h = '<div>' + lb('الطقس') + '<div class="big" data-temp>—</div><div class="sub" data-wx></div></div>';
    else if (t === 'compass') h = '<div class="ctr cmp">' + compassSvg() + '<div><div class="big" style="font-size:4vh" data-dir>—</div><div class="sub">الاتجاه</div></div></div>';
    else if (t === 'trip') h = '<div data-trip>' + lb('الرحلة') + '<div class="big" data-tkm>٠ كم</div><div class="sub" data-tsub></div></div>';
    else if (t === 'prayer') h = '<div>' + lb('الصلاة الجاية') + '<div class="big" style="font-size:5vh" data-pr>—</div><div class="sub" data-prt></div></div>';
    else if (t === 'altitude') h = '<div>' + lb('الارتفاع') + '<div class="big" data-alt>—</div><div class="sub">متر فوق البحر</div></div>';
    else if (t === 'park') h = '<div data-park>' + lb('وين وگفت سيارتي') + '<div class="big" style="font-size:4.4vh" data-pk>—</div><div class="sub" data-pks>اضغط حتى تشوفه على الخريطة</div></div>';
    else if (t === 'dial') h = lb('اتصال سريع') + '<div class="dial">' + ((cfg.dial || []).slice(0, 4).map(function (d, k) { return '<button data-dial="' + k + '" style="--dc:' + esc(d.c || DCOL[k % DCOL.length]) + '"><i>' + esc(initials(d.n)) + '</i><span>' + esc(d.n) + '</span></button>'; }).join('') || '<div class="sub">أضف الأرقام من التطبيق بالموبايل</div>') + '</div>';
    else if (t === 'call') h = w.l ? '<div class="call">' + lb('الاتصال') + '<div class="disp" data-cdisp></div><div class="pad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(function (k) { return '<button data-ckey="' + k + '">' + k + '</button>'; }).join('') + '</div>' +
      '<div class="acts"><button data-cdel aria-label="مسح">⌫</button><button class="go" data-ccall>' + ic('phone') + '</button><button data-copen>جهات الاتصال</button></div></div>'
      : '<div class="call small"><button class="big-call" data-copen>' + ic('phone') + '</button><span>الاتصال</span></div>';
    else if (t === 'maint') h = '<div class="mnt">' + lb('الصيانة') + ((cfg.maint || []).slice(0, w.l ? 4 : 2).map(function (it) { var s = maintState(it); return '<div class="it' + (s.due ? ' due' : '') + '"><span>' + esc(it.n) + '</span><i>' + maintText(s) + '</i></div><div class="bar"><b style="width:' + Math.round(s.p * 100) + '%"></b></div>'; }).join('') || '<div class="sub">أضف مواعيد الصيانة من التطبيق</div>') + '</div>';
    var attrs = ' data-t="' + t + '"' + (w.bg && w.bg !== 'auto' ? ' data-bg="' + esc(w.bg) + '"' : '') + (w.lb === false ? ' data-nolb' : '') + (w.tsz ? ' data-tsz="' + esc(w.tsz) + '"' : '') + (w.c ? ' style="--wc:' + esc(w.c) + '"' : '');
    return '<div class="w' + (w.l ? ' l' : '') + (t === 'media' && w.style === 'cover' ? ' cover' : '') + '" data-w="' + i + '" data-cedit="w' + i + '"' + attrs + '>' + h + '</div>';
  }
  function visibleWidgets() {
    var lay = cfg.layout || 'carplay', all = (cfg.widgets || []).map(function (w, i) { return { w: w, i: i }; });
    if (driving) all = all.filter(function (x) { return x.w.t === 'speed' || x.w.t === 'media' || x.w.t === 'clock' || x.w.t === 'dial' || x.w.t === 'trip' || x.w.t === 'compass' || x.w.t === 'weather' || x.w.t === 'call' || x.w.t === 'map'; });
    var max = lay === 'atv' ? 4 : lay === 'mbux' ? 4 : lay === 'carplay' ? 3 : lay === 'cockpit' ? 5 : lay === 'gauge' ? 5 : lay === 'trio' ? 3 : lay === 'split' ? 2 : lay === 'cards' ? 5 : lay === 'hero' ? 3 : cfg.wlayout === 'top' ? 4 : 6;
    return all.slice(0, max);
  }
  function renderWidgets() {
    $('widgets').innerHTML = visibleWidgets().map(function (x) { return widgetHtml(x.w, x.i); }).join('');
    paintLive();
  }
  function txt(id, v) { var e = $(id); if (e && e.textContent !== v) e.textContent = v; }
  function each(sel, fn) { var l = document.querySelectorAll(sel); for (var i = 0; i < l.length; i++) fn(l[i]); }
  function setT(sel, v) { each(sel, function (e) { if (e.textContent !== v) e.textContent = v; }); }
  function paintLive() {
    var now = new Date(), c = hm(now);
    txt('tm', c.t + ' ' + c.ap); txt('date', fD.format(now));
    each('[data-clock]', function (e) { var st = e.getAttribute('data-clock'), v = st === 'stack' ? esc(c.h) + '<i>' + esc(c.m) + '</i>' : esc(c.t); if (e.innerHTML !== v) e.innerHTML = v; });
    setT('[data-clocks]', c.ap + ' · ' + fD.format(now));
    setT('[data-date]', fD.format(now)); setT('[data-hijri]', fH.format(new Date(now.getTime() + load('hijriOffset', 0) * 86400000)));
    var hH = $('aH'), hM = $('aM');
    if (hH) { var b = new Date(now.getTime() + 3 * 3600000), h = b.getUTCHours() % 12, m = b.getUTCMinutes(); hH.setAttribute('transform', 'rotate(' + (h * 30 + m / 2) + ' 50 50)'); hM.setAttribute('transform', 'rotate(' + (m * 6) + ' 50 50)'); }
    var kmh = LOC && LOC.ok ? (+LOC.kmh || 0) : 0, lim = limitNow(), over = lim && kmh > lim;
    paintGauges(kmh); setT('[data-spdn]', String(Math.round(kmh)));
    var sb = new Date(now.getTime() + 3 * 3600000); setT('[data-sclock]', sb.getUTCHours() + ':' + (sb.getUTCMinutes() < 10 ? '0' : '') + sb.getUTCMinutes());
    each('[data-spd]', function (e) { e.classList.toggle('over', !!over); });
    var meta = LOC && LOC.ok ? '<b>' + (over ? 'خفّف السرعة' : (prof === 'city' ? 'داخل المدينة' : 'خط سريع')) + '</b>الحد ' + nf.format(lim || 0) + (CUR ? '<br>الرحلة ' + nf1.format(CUR.km) + ' كم' : '') : (HAS && A.hasLocation && !A.hasLocation() ? 'اسمح بالموقع حتى تشتغل السرعة' : 'أنتظر إشارة GPS…');
    each('[data-spdmeta]', function (e) { if (e.innerHTML !== meta) e.innerHTML = meta; });
    var dir = LOC && LOC.bearing >= 0 ? DIRS[Math.round(LOC.bearing / 45) % 8] : '—'; setT('[data-dir]', dir);
    var n = $('cmpN'); if (n && LOC && LOC.bearing >= 0) n.setAttribute('transform', 'rotate(' + (-LOC.bearing) + ' 50 50)');
    setT('[data-tkm]', nf1.format(CUR ? CUR.km : 0) + ' كم');
    var tsub = CUR ? 'من ' + nf.format(Math.round((Date.now() - CUR.s) / 60000)) + ' دقيقة · معدل ' + nf.format(Math.round(CUR.sum / Math.max(1, CUR.n))) : 'ماكو رحلة هسه';
    if (cfg.odoSet) tsub += ' · العداد ' + nf.format(Math.round(odometer()));
    setT('[data-tsub]', tsub);
    setT('[data-alt]', LOC && LOC.alt > -9000 ? nf.format(LOC.alt) : '—');
    setT('[data-pk]', LOG.park ? ago(LOG.park.at) : 'ما محفوظ بعد');
    if (WX) { setT('[data-temp]', nf.format(WX.t) + '°'); setT('[data-wx]', wxText(WX.c)); txt('wx', nf.format(WX.t) + '° ' + wxText(WX.c)); }
    var np = nextPrayer(); if (np) { setT('[data-pr]', np.n); setT('[data-prt]', fmtH(np.h)); }
    var okm = MED && MED.ok && MED.title;
    setT('[data-mt]', okm ? MED.title : 'ماكو شي شغّال');
    var mapp = okm && (btSys(MED.pkg) || (appsBy[MED.pkg] && /btmusic|phone/.test(appsBy[MED.pkg].kind || ''))) ? 'البلوتوث' : MED && MED.app;
    setT('[data-ma]', okm ? [MED.artist, mapp].filter(Boolean).join(' · ') : 'شغّل موسيقى من البلوتوث أو أي تطبيق');
    paintMap();
    var art = okm && MED.art ? 'url("' + MED.art + '")' : '';
    each('[data-art]', function (e) { if (e.style.backgroundImage !== art) e.style.backgroundImage = art; });
    each('[data-medbg]', function (e) { if (e.style.backgroundImage !== art) e.style.backgroundImage = art; });
    each('[data-mpp]', function (e) { var v = okm && MED.playing ? P.pause : P.play; if (e.innerHTML !== v) e.innerHTML = v; });
    each('[data-mpg]', function (e) { e.style.width = okm && MED.dur > 0 ? Math.min(100, Math.round((MED.pos || 0) * 100 / MED.dur)) + '%' : '0'; });
    var noacc = !okm && HAS && A.notifAllowed && !A.notifAllowed();
    each('[data-med]', function (e) { e.classList.toggle('noacc', !!noacc); });
    paintSaver(c, now, kmh);
  }


  // ---------- live map card (OpenStreetMap tiles around the car) ----------
  var mapKey = '';
  function paintMap() {
    var boxes = document.querySelectorAll('[data-map]'); if (!boxes.length) return;
    var ok = LOC && LOC.ok && LOC.lat, z = 16;
    for (var b = 0; b < boxes.length; b++) {
      var box = boxes[b], msg = box.querySelector('[data-mapmsg]'), tl = box.querySelector('[data-tiles]');
      msg.style.display = ok ? 'none' : '';
      if (!ok) continue;
      var n = Math.pow(2, z), lat = LOC.lat * Math.PI / 180;
      var px = (LOC.lng + 180) / 360 * n * 256, py = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n * 256;
      var W = box.clientWidth, H = box.clientHeight, x0 = Math.floor((px - W / 2) / 256), x1 = Math.floor((px + W / 2) / 256), y0 = Math.floor((py - H / 2) / 256), y1 = Math.floor((py + H / 2) / 256);
      var key = [x0, x1, y0, y1, W, H].join(',');
      if (box.getAttribute('data-k') !== key) {
        var h = '';
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++)
          h += '<img alt="" onerror="this.style.visibility=\'hidden\'" src="https://tile.openstreetmap.org/' + z + '/' + ((x % n) + n) % n + '/' + y + '.png" style="left:' + (x - x0) * 256 + 'px;top:' + (y - y0) * 256 + 'px">';
        tl.innerHTML = h; box.setAttribute('data-k', key);
      }
      var ox = Math.round(W / 2 - (px - x0 * 256)), oy = Math.round(H / 2 - (py - y0 * 256));
      tl.style.transform = 'translate(' + ox + 'px,' + oy + 'px)'; tl.style.webkitTransform = tl.style.transform;
      var me = box.querySelector('.me svg'); if (me && LOC.bearing >= 0) { me.style.transform = 'rotate(' + LOC.bearing + 'deg)'; me.style.webkitTransform = me.style.transform; }
    }
  }

  // ---------- ready-made screens drawn after the user's pictures («تصاميم من الصور») ----------
  /* A scene is a fixed 1600×900 board scaled to the screen, made of live parts (speed, map, music, weather, apps).
     cfg.scene picks it; cfg.accent, cfg.dock, cfg.sceneBg (photos) and cfg.css still change it. */
  var SI = {
    fan: '<path d="M12 12c0-3 1-7 4-7 2 0 3 2 2 4-1 2-4 3-6 3zM12 12c3 0 7 1 7 4 0 2-2 3-4 2-2-1-3-4-3-6zM12 12c0 3-1 7-4 7-2 0-3-2-2-4 1-2 4-3 6-3zM12 12c-3 0-7-1-7-4 0-2 2-3 4-2 2 1 3 4 3 6z"/><circle cx="12" cy="12" r="1.4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>', turn: '<path d="M6 20v-7a4 4 0 0 1 4-4h8M14 5l4 4-4 4"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>', gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
  };
  var sic = function (n) { return '<svg viewBox="0 0 24 24">' + (SI[n] || I[n] || I.apps) + '</svg>'; };
  var SDOCK = { maps: ['الملاحة', 'maps'], music: ['الوسائط', 'music'], phone: ['الهاتف', 'phone'], apps: ['التطبيقات', 'apps'], park: ['السيارة', 'park'], settings: ['الإعدادات', 'settings'],
    radio: ['الراديو', 'radio'], bt: ['البلوتوث', 'bt'], camera: ['الكاميرا', 'camera'], file: ['الملفات', 'file'], mirror: ['ربط الموبايل', 'mirror'], home: ['الرئيسية', 'home'],
    climate: ['المناخ', 'fan'], profile: ['الملف', 'person'], browser: ['المتصفح', 'globe'] };
  function sDockAct(k) { if (k === 'climate') return toast('درجة الحرارة برا: ' + (WX ? nf.format(WX.t) + '°' : '—')); if (k === 'profile') return dockAct('settings'); if (k === 'browser') { var b = null; for (var i = 0; i < apps.length; i++) if (/chrome|browser|webview/i.test(apps[i].pkg)) b = apps[i]; if (b) return launch(b.pkg); return toast('ما لگيت متصفح'); } if (k === 'file') { var f = firstOf('file'); if (f) return launch(f.pkg); } dockAct(k); }
  function sGauge(o) {
    var st = o.st || 'pro', max = +o.max || 240;
    if (st !== 'pro' && st !== 'neon' && st !== 'line' && st !== 'rpm') return gaugeHtml({ style: st, max: max });
    if (st === 'line') {
      var t = ''; for (var v = 0; v <= max; v += 10) { var x = 40 + 1120 * v / max, mj = v % 20 === 0; t += '<line x1="' + x + '" y1="' + (mj ? 70 : 82) + '" x2="' + x + '" y2="100" stroke="currentColor" stroke-width="' + (mj ? 3 : 1.5) + '"/>' + (mj ? '<text x="' + x + '" y="58" text-anchor="middle" font-size="26" fill="currentColor">' + v + '</text>' : ''); }
      return '<svg class="g sg-line" viewBox="0 0 1200 140" data-g="line" data-max="' + max + '"><path d="M20 120 Q600 -10 1180 120" fill="none" stroke="var(--ac)" stroke-width="10" opacity=".9"/>' + t + '<g data-ndl style="transform-origin:600px 135px;-webkit-transform-origin:600px 135px"><line x1="600" y1="135" x2="600" y2="40" stroke="var(--ndl, #5a3a1a)" stroke-width="6" stroke-linecap="round"/></g><circle cx="600" cy="132" r="9" fill="var(--ndl, #5a3a1a)"/><text x="600" y="128" class="unit" text-anchor="middle" font-size="22" dx="70">كم/ساعة</text><text data-n x="0" y="0" opacity="0">٠</text></svg>';
    }
    var lbl = st === 'rpm' ? function (v) { return v / 30; } : function (v) { return v; };
    var o2 = '<svg class="g sg-' + st + '" viewBox="0 0 200 200" data-g="pro" data-max="' + max + '">';
    o2 += '<circle cx="100" cy="100" r="97" class="bz"/><circle cx="100" cy="100" r="90" class="face"/>';
    for (var w = 0; w <= max; w += 5) {
      var a = 135 + 270 * w / max, mj2 = w % 20 === 0, md = w % 10 === 0, p1 = pol(a, mj2 ? 76 : md ? 80 : 82), p2 = pol(a, 86);
      o2 += '<line class="tk' + (mj2 ? ' mj' : '') + (st === 'rpm' && w > max * .74 ? ' hot' : '') + '" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>';
      if (mj2 && (st !== 'rpm' || w % 30 === 0) && (max <= 240 || w % 40 === 0)) { var p3 = pol(a, 64); o2 += '<text class="lbn" x="' + p3[0].toFixed(1) + '" y="' + (p3[1] + 4).toFixed(1) + '" text-anchor="middle">' + lbl(w) + '</text>'; }
    }
    var L = 2 * Math.PI * 88 * .75;
    o2 += '<path class="val" d="' + arcPath(88) + '" stroke-dasharray="' + L.toFixed(1) + '" stroke-dashoffset="' + L.toFixed(1) + '" data-len="' + L.toFixed(1) + '"/>';
    if (st !== 'neon') o2 += '<g class="ndl" data-ndl style="transform-origin:100px 100px;-webkit-transform-origin:100px 100px"><path d="M99 30 L101 30 L103 100 L97 100 Z"/></g><circle class="hub" cx="100" cy="100" r="' + (o.hub || 5) + '"/>';
    o2 += '<text class="num" data-n x="100" y="' + (o.ny || 112) + '" text-anchor="middle" font-size="' + (o.nf || 40) + '">٠</text><text class="unit" x="100" y="' + ((o.ny || 112) + 18) + '" text-anchor="middle" font-size="10">كم/ساعة</text></svg>';
    return o2;
  }
  var MAPH = '<div class="map" data-map><div class="tiles" data-tiles></div><div class="me"><svg viewBox="0 0 24 24"><path d="M12 2l7 19-7-4-7 4z"/></svg></div><div class="msg" data-mapmsg>الخريطة تحتاج الموقع والإنترنت</div><div class="osm">© OpenStreetMap</div></div>';
  function sPart(p) {
    var k = p[0], o = p[5] || {}, h = '';
    if (k === 'gauge') h = sGauge(o);
    else if (k === 'speed') h = '<div class="sp-n"><b data-spdn>٠</b><span>كم/ساعة</span></div>';
    else if (k === 'clock') h = o.st === 'analog' ? '<div class="anl">' + analogSvg() + '</div>' : '<div class="ck"><b data-sclock></b><span data-date></span></div>';
    else if (k === 'date') h = '<span data-date></span><i>|</i><span data-sclock></span>';
    else if (k === 'nav') h = MAPH + '<div class="nv"><span class="nva">' + sic('turn') + '</span><div><b data-dir>—</b><small>الاتجاه الحالي</small></div></div>' + (o.eta === false ? '' : '<div class="eta"><span data-sclock></span> · <span data-tkm>٠ كم</span></div>');
    else if (k === 'music') h = '<div class="mu" data-med><div class="art" data-art></div><div class="tx"><b data-mt>ماكو شي شغّال</b><span data-ma></span><div class="pg"><i data-mpg></i></div>' +
      '<div class="ctl"><button data-mc="prev">' + P.prev + '</button><button class="pp" data-mc="toggle" data-mpp>' + P.play + '</button><button data-mc="next">' + P.next + '</button></div></div></div>';
    else if (k === 'climate') h = '<div class="cl"><div><b data-temp>—</b><small data-wx>الطقس</small></div><i></i><div class="fan">' + sic('fan') + '<b>' + (o.fan || '٢') + '</b><small>تلقائي</small></div>' + (o.car ? '<div class="carimg">' + sic('park') + '</div>' : '') + '</div>';
    else if (k === 'dock' || k === 'rail' || k === 'grid') { var mainDock = !sPart.dockDone; sPart.dockDone = true;
      h = (mainDock && cfg.sceneDock && cfg.sceneDock.length ? cfg.sceneDock : o.keys || ['maps', 'music', 'phone', 'apps', 'park']).map(function (d) { var x = SDOCK[d] || DOCK[d] || [d, 'apps']; return '<button data-sdock="' + d + '">' + '<i>' + sic(x[1]) + '</i>' + (o.nolabel ? '' : '<span>' + x[0] + '</span>') + '</button>'; }).join(''); }
    else if (k === 'apps') h = carApps().slice(0, o.n || 6).map(function (a) { return '<button data-pkg="' + esc(a.pkg) + '">' + (a.icon ? '<img src="' + esc(a.icon) + '" alt="">' : '<i>' + sic(a.kind === 'maps' ? 'maps' : a.kind === 'music' ? 'music' : 'apps') + '</i>') + '</button>'; }).join('');
    else if (k === 'set') h = '<button data-sdock="settings">' + sic('settings') + (o.label ? '<span>' + o.label + '</span>' : '') + '</button>';
    else if (k === 'stats') h = (o.rows || ['trip', 'alt', 'wx', 'pr']).map(function (r) {
      return r === 'trip' ? '<div>' + sic('flag') + '<b>الرحلة</b><span data-tkm>٠ كم</span></div>' : r === 'alt' ? '<div>' + sic('gauge') + '<b>الارتفاع</b><span><i data-alt>—</i> م</span></div>'
        : r === 'wx' ? '<div>' + sic('thermo') + '<b>الطقس</b><span data-temp>—</span></div>' : r === 'dir' ? '<div>' + sic('maps') + '<b>الاتجاه</b><span data-dir>—</span></div>' : '<div>' + sic('moon') + '<b data-pr>الصلاة</b><span data-prt>—</span></div>';
    }).join('');
    else if (k === 'text') h = o.html;
    else if (k === 'card') h = o.t === 'prayer' ? '<div class="cd-h">الصلاة القادمة ' + sic('moon') + '</div><b data-pr>—</b><span data-prt></span>'
      : o.t === 'trip' ? '<div class="cd-h">رحلتي ' + sic('flag') + '</div><b data-tkm>٠ كم</b><span data-tsub></span>' : o.t === 'climate' ? '<div class="cd-h">الطقس ' + sic('fan') + '</div><b data-temp>—</b><span data-wx></span>'
      : '<div class="cd-h">' + (o.title || '') + '</div>';
    else if (k === 'vehicle') h = '<div class="vh-t">سيارتي</div><div class="vh-img" data-sdock="park">' + sic('park') + '<small>رحلاتي وسيارتي</small></div><div class="vh-sp"><div><small>' + sic('gauge') + ' السرعة</small><b data-spdn>٠</b><span>كم/ساعة</span></div><div><small>الاتجاه</small><b data-dir>—</b></div></div>';
    else if (k === 'mirror') h = '<button data-sdock="mirror" class="on">' + sic('maps') + '<div><b>أندرويد أوتو</b><small>اضغط حتى تفتح</small></div></button><button data-sdock="mirror">' + sic('phone') + '<div><b>كاربلي</b><small>الشاشة أو الوصلة</small></div></button>';
    else if (k === 'weather') h = sic('fan').replace('fan', '') + '<b data-temp>—</b><span data-wx></span>';
    else if (k === 'greet') h = '<span data-temp>—</span><span class="gr">' + (cfg.owner ? 'أهلاً ' + esc(cfg.owner) : 'أهلاً بيك') + '</span><button data-sdock="settings">' + sic('settings') + '</button>';
    return '<div class="sb s-' + k + (o.cls ? ' ' + o.cls : '') + '" style="left:' + p[1] + 'px;top:' + p[2] + 'px;width:' + p[3] + 'px;height:' + p[4] + 'px">' + h + '</div>';
  }
  var D5 = ['maps', 'music', 'phone', 'apps', 'park'], D7 = ['maps', 'music', 'phone', 'park', 'apps', 'climate', 'settings'];
  var SCENES = {
    teal: [['date', 50, 40, 700, 40], ['gauge', 50, 90, 680, 680, { st: 'pro', max: 240, nf: 46, ny: 116 }], ['nav', 780, 70, 770, 300], ['music', 780, 400, 770, 330],
      ['dock', 40, 760, 990, 120, { keys: D5 }], ['climate', 1060, 760, 330, 120], ['set', 1410, 760, 150, 120, { label: 'الإعدادات' }]],
    sage: [['speed', 520, 30, 560, 230], ['date', 520, 270, 560, 40, { cls: 'ctr' }], ['climate', 1060, 60, 330, 160], ['set', 1430, 60, 120, 150, { label: 'الإعدادات' }], ['nav', 60, 330, 700, 360], ['music', 800, 330, 740, 360],
      ['dock', 110, 730, 1380, 150, { keys: ['maps', 'music', 'phone', 'apps', 'park', 'profile'] }]],
    glass: [['clock', 40, 40, 200, 140], ['nav', 240, 40, 1320, 400, { eta: false }], ['music', 40, 470, 570, 250], ['stats', 40, 740, 570, 120, { rows: ['wx', 'trip', 'alt'] }], ['gauge', 640, 460, 380, 380, { st: 'arc', max: 200 }],
      ['set', 1040, 740, 90, 90], ['grid', 1170, 520, 390, 320, { keys: ['maps', 'music', 'phone', 'apps', 'park', 'profile'] }]],
    redline: [['date', 40, 30, 600, 40], ['gauge', 40, 80, 700, 700, { st: 'pro', max: 260, hub: 14, nf: 44, ny: 140 }], ['nav', 780, 40, 790, 240], ['music', 780, 300, 790, 290], ['climate', 780, 610, 790, 170, { car: 1 }],
      ['dock', 450, 800, 680, 90, { keys: D5, nolabel: 1 }], ['set', 1440, 790, 110, 110, { label: 'الإعدادات', cls: 'knob' }]],
    neon: [['set', 50, 40, 70, 70], ['date', 520, 40, 600, 40, { cls: 'ctr' }], ['gauge', 20, 300, 640, 560, { st: 'neon', max: 240, nf: 64, ny: 125 }], ['nav', 700, 90, 690, 270], ['music', 640, 380, 720, 310], ['climate', 760, 710, 630, 170],
      ['rail', 1470, 60, 100, 760, { keys: D5, nolabel: 1 }]],
    silver: [['set', 40, 40, 110, 110, { label: 'الإعدادات' }], ['clock', 690, 10, 220, 220, { st: 'analog' }], ['gauge', 540, 200, 520, 520, { st: 'pro', max: 240 }], ['music', 380, 570, 840, 180, { cls: 'flat' }],
      ['dock', 80, 740, 1440, 150, { keys: D7 }]],
    speed: [['text', 50, 60, 420, 220, { html: '<b>مصمّمة</b><b class="r">للسرعة</b><i></i>' }], ['music', 40, 340, 470, 330, { cls: 'vert' }], ['gauge', 500, 20, 600, 600, { st: 'rpm', max: 240, nf: 64, ny: 125 }],
      ['stats', 1140, 180, 420, 450, { rows: ['dir', 'trip', 'wx', 'alt'] }], ['clock', 690, 520, 220, 120], ['set', 1430, 40, 120, 120], ['dock', 160, 760, 1300, 130, { keys: D7 }]],
    violet: [['rail', 30, 40, 160, 760, { keys: ['maps', 'music', 'phone', 'park', 'apps'] }], ['clock', 230, 50, 470, 210, { cls: 'card' }], ['music', 220, 290, 500, 390, { cls: 'vert' }], ['speed', 760, 50, 620, 630, { cls: 'card' }],
      ['stats', 210, 710, 820, 120, { rows: ['trip', 'alt', 'wx'] }], ['set', 1060, 710, 320, 120, { label: 'الإعدادات' }]],
    vintage: [['clock', 70, 60, 320, 320, { st: 'analog' }], ['music', 420, 60, 680, 300, { cls: 'flat' }], ['set', 1180, 60, 340, 300, { label: 'الإعدادات', cls: 'knob' }], ['gauge', 60, 400, 1480, 320, { st: 'line', max: 240 }],
      ['dock', 60, 740, 1480, 150, { keys: D7 }]],
    cyan: [['set', 40, 30, 90, 90], ['clock', 1260, 30, 300, 90, { cls: 'line' }], ['gauge', 470, 10, 660, 660, { st: 'pro', max: 240, nf: 40, ny: 160 }], ['music', 360, 590, 880, 170, { cls: 'flat' }],
      ['dock', 120, 770, 1360, 120, { keys: ['maps', 'phone', 'music', 'climate', 'apps'] }]],
    arabic: [['clock', 40, 20, 400, 80, { cls: 'line' }], ['greet', 1100, 20, 460, 80], ['card', 80, 220, 400, 160, { t: 'climate' }], ['card', 80, 410, 400, 160, { t: 'trip' }], ['gauge', 560, 120, 520, 520, { st: 'arc', max: 180 }],
      ['card', 1120, 220, 400, 160, { t: 'prayer' }], ['stats', 1120, 410, 400, 160, { rows: ['dir'] }], ['dock', 80, 690, 760, 170, { keys: ['maps', 'phone', 'music', 'settings'], nolabel: 1 }], ['music', 900, 690, 620, 170, { cls: 'flat' }]],
    auto: [['clock', 60, 40, 600, 160, { cls: 'big' }], ['weather', 1360, 50, 200, 80], ['card', 40, 480, 360, 300, { t: 'climate' }], ['music', 420, 480, 450, 300, { cls: 'vert' }], ['card', 890, 480, 330, 300, { t: 'prayer' }],
      ['card', 1240, 480, 330, 300, { t: 'trip' }], ['set', 30, 810, 70, 70, { cls: 'home' }], ['apps', 600, 805, 420, 80, { n: 6 }], ['dock', 1260, 805, 300, 80, { keys: ['bt', 'climate', 'apps'], nolabel: 1 }]],
    split: [['nav', 30, 30, 780, 740, { eta: false }], ['speed', 70, 330, 110, 110, { cls: 'mini' }], ['dock', 70, 560, 700, 90, { keys: ['music', 'home', 'apps'], nolabel: 1, cls: 'chips' }], ['card', 70, 670, 700, 90, { t: 'climate' }],
      ['music', 840, 30, 730, 740, { cls: 'big' }], ['apps', 40, 795, 1150, 95, { n: 8 }], ['clock', 1220, 795, 340, 95, { cls: 'line' }]],
    mine: [['clock', 70, 20, 760, 100, { cls: 'line' }], ['greet', 960, 25, 600, 90], ['vehicle', 40, 140, 420, 540], ['nav', 480, 140, 800, 540, { eta: false }], ['mirror', 495, 545, 770, 120],
      ['music', 1300, 140, 280, 540, { cls: 'vert' }], ['dock', 40, 720, 1520, 170, { keys: ['radio', 'bt', 'camera', 'browser', 'file', 'settings', 'apps'] }]]
  };
  function renderScene() {
    var sc = cfg.scene && SCENES[cfg.scene], box = $('scene');
    document.body.setAttribute('data-scene', sc ? cfg.scene : '');
    if (!box) return;
    if (!sc) { box.innerHTML = ''; return; }
    sPart.dockDone = false;
    box.innerHTML = '<div class="sc" id="scb">' + sc.map(sPart).join('') + '</div>';
    document.body.classList.toggle('scbg', !!cfg.sceneBg && (cfg.bgPack || []).length > 0);
    fitScene(); paintLive();
  }
  function fitScene() {
    var b = $('scb'); if (!b) return;
    var k = Math.min(innerWidth / 1600, innerHeight / 900), x = (innerWidth - 1600 * k) / 2, y = (innerHeight - 900 * k) / 2;
    b.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')'; b.style.webkitTransform = b.style.transform;
  }
  window.addEventListener('resize', fitScene);
  document.addEventListener('click', function (e) {
    var d = e.target.closest && e.target.closest('[data-sdock]'); if (!d || !cfg.scene) return;
    e.stopPropagation(); if (touch()) return; sDockAct(d.getAttribute('data-sdock'));
  }, true);

  // ---------- look ----------
  var SIZES = { s: 9, m: 11, l: 13.5, xl: 16 };
  function applyLook() {
    var b = document.body, lay = cfg.layout || 'carplay';
    if (cfg.bt) { b.setAttribute('data-bt', cfg.bt); b.setAttribute('data-ct', 'brand'); } else { b.removeAttribute('data-bt'); b.setAttribute('data-ct', cfg.theme || 'signature'); }
    b.setAttribute('data-dockpos', cfg.dockPos || (lay === 'carplay' ? (cfg.side === 'left' ? 'left' : 'right') : 'bottom'));
    b.setAttribute('data-side', cfg.side || 'right');
    b.setAttribute('data-wlayout', lay === 'classic' ? (cfg.wlayout || 'split') : 'split');
    b.setAttribute('data-lay', lay);
    b.setAttribute('data-icons', cfg.icons || 'squircle');
    b.setAttribute('data-labels', cfg.labels || 'on');
    b.setAttribute('data-tilebg', cfg.tilebg || 'off');
    b.setAttribute('data-cards', cfg.cards || 'glass');
    b.setAttribute('data-dock', cfg.dockStyle || 'bar');
    b.setAttribute('data-apphd', cfg.apphd || 'on');
    b.setAttribute('data-volpos', cfg.volPos || 'left');
    var st = b.style;
    if (cfg.accent) { st.setProperty('--ac', cfg.accent); st.setProperty('--ac2', cfg.accent2 || cfg.accent); } else { st.removeProperty('--ac'); st.removeProperty('--ac2'); }
    st.setProperty('--cols', String(lay === 'cockpit' ? 2 : (+cfg.cols || 4)));
    if (cfg.isize && SIZES[cfg.isize] && lay !== 'carplay') st.setProperty('--ic', SIZES[cfg.isize] * (lay === 'atv' ? 1.25 : 1) + 'vh'); else if (cfg.isize && SIZES[cfg.isize]) st.setProperty('--ic', SIZES[cfg.isize] * 1.35 + 'vh'); else st.removeProperty('--ic');
    st.setProperty('--cop', String((+cfg.cop || 8) / 100));
    if (cfg.rad != null) st.setProperty('--r', (+cfg.rad) + 'vh'); else st.removeProperty('--r');
    st.setProperty('--fs', String((+cfg.fs || 100) / 100));
    st.setProperty('--bgo', String(1 - (+cfg.bgDim || 45) / 100));
    txt('own', cfg.owner || 'مدير الشاشات');
    /* the design's own CSS (imported or written in the phone app) goes last, so it can change anything */
    var uc = document.getElementById('userCss'), css = typeof cfg.css === 'string' ? cfg.css.slice(0, 60000) : '';
    if (uc && uc.textContent !== css) uc.textContent = css;
    renderBrand();
    renderScene();
    b.classList.toggle('hasvol', !!cfg.volBtns);
    b.classList.toggle('night', isNight());
    showBg();
    checkBanner();
  }
  function brandHtml(br) {
    var lg = br.logo ? '<img class="lg" src="' + esc(br.logo) + '" alt="">' : '<span class="lg">' + esc((br.en || br.name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, br.mono || 1).toUpperCase() || (br.name || '?').charAt(0)) + '</span>';
    return lg + '<span class="bn">' + esc((br.en || br.name || '').toUpperCase()) + '</span>' + (br.model ? '<span class="md">' + esc(br.model) + '</span>' : '');
  }
  var brandKey = '';
  function renderBrand() {
    var br = cfg.brand, b = document.body, k = JSON.stringify(br || null);
    b.classList.toggle('hasbrand', !!(br && (br.en || br.name)));
    if (k === brandKey) return; brandKey = k;
    if (br && br.color) b.style.setProperty('--bc', br.color); else b.style.removeProperty('--bc');
    $('brand').innerHTML = br ? brandHtml(br) : '';
    var sb = $('sbrand'); if (sb) { sb.innerHTML = br ? brandHtml({ logo: br.logo, en: br.en, name: br.name, mono: br.mono }) : ''; }
    $('vol').innerHTML = '<button data-vol="-1" aria-label="خفض الصوت">' + ic('vdown') + '</button><button data-vol="0" aria-label="كتم">' + ic('vmute') + '</button><button data-vol="1" aria-label="رفع الصوت">' + ic('vup') + '</button>';
  }
  var bgCur = '';
  function bgList() {
    var pin = load('carBgPin', null), l = (cfg.bgPack || []).slice();
    if (pin) return [pin];
    return l;
  }
  function showBg() {
    var e = $('bgimg'), list = bgList();
    if (!list.length) { e.classList.remove('on'); bgCur = ''; return; }
    var u = list[Math.floor(Date.now() / ((cfg.bgInterval || 120) * 1000)) % list.length];
    if (u === bgCur) return;
    var img = new Image(); img.onload = function () { bgCur = u; e.style.backgroundImage = 'url("' + u + '")'; e.classList.add('on'); }; img.onerror = function () { bgCur = u; }; img.src = u;
  }

  // ---------- overlays: trips, parking ----------
  function openOv(title, html) { $('ovT').textContent = title; $('ovb').innerHTML = html; $('ovb').onclick = null; $('ov').classList.add('on'); }
  function openTrips() {
    var tr = (LOG.trips || []).slice().reverse(), wk = Date.now() - 7 * 86400000, w = tr.filter(function (t) { return t.s > wk; });
    var km = 0, mins = 0, mx = 0; w.forEach(function (t) { km += t.km; mins += (t.e - t.s) / 60000; mx = Math.max(mx, t.max); });
    openOv('رحلاتي', '<div class="stats"><div><b>' + nf1.format(km) + '</b><span>كم هالأسبوع</span></div><div><b>' + nf.format(w.length) + '</b><span>رحلة</span></div><div><b>' + nf.format(Math.round(mins / 60 * 10) / 10) + '</b><span>ساعة سياقة</span></div><div><b>' + nf.format(mx) + '</b><span>أعلى سرعة</span></div></div>' +
      (cfg.odoSet ? '<div class="sub" style="margin:-.6vh 0 1.6vh">العداد تقريباً: ' + nf.format(Math.round(odometer())) + ' كم</div>' : '') +
      '<div class="rows">' + (tr.slice(0, 30).map(function (t) { return '<div class="r"><b>' + fDs.format(new Date(t.s)) + '</b><i>' + nf1.format(t.km) + ' كم</i><i>' + nf.format(Math.round((t.e - t.s) / 60000)) + ' دقيقة</i><i>أعلى ' + nf.format(t.max) + '</i></div>'; }).join('') || '<div class="sub">لسه ماكو رحلات. تنحفظ وحدها من تسوق.</div>') + '</div>');
  }
  function openPark() {
    var p = LOG.park;
    if (!p) { toast('لسه ما محفوظ مكان. ينحفظ وحده من توگف السيارة'); return; }
    var q = 'geo:' + p.lat + ',' + p.lng + '?q=' + p.lat + ',' + p.lng + '(' + encodeURIComponent('سيارتي') + ')';
    if (HAS && A.openGeo && A.openGeo(q)) return;
    toast('سيارتك وگفت ' + ago(p.at));
  }

  // ---------- screensaver ----------
  var lastInput = Date.now(), saving = false;
  var svWis = null, svPic = -1;
  function hijNum(d) { var m = 0, dd = 0; try { new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { month: 'numeric', day: 'numeric', timeZone: TZ }).formatToParts(d).forEach(function (x) { if (x.type === 'month') m = +x.value; if (x.type === 'day') dd = +x.value; }); } catch (e) {} return { m: m, d: dd }; }
  function nextOcc() {
    var L = window.OCCASIONS || [], h = hijNum(new Date(Date.now() + load('hijriOffset', 0) * 86400000)), best = null, bd = 1e9;
    L.forEach(function (o) { var diff = (o[0] - h.m) * 29.5 + (o[1] - h.d); if (diff < 0) diff += 354; if (diff < bd) { bd = diff; best = o; } });
    return best ? { n: best[2], d: Math.round(bd) } : null;
  }
  function paintSaver(c, now, kmh) {
    if (!saving) return;
    var s = cfg.saver || {}, sv = $('saver');
    sv.classList.toggle('analog', !!s.analog); sv.classList.toggle('noclock', s.clock === false);
    sv.classList.toggle('occ', !!s.occ); sv.classList.toggle('wis', !!s.wisdom);
    var pack = (s.pack && s.pack.length ? s.pack : cfg.bgPack) || [];
    sv.classList.toggle('photos', !!s.photos && pack.length > 0);
    if (s.photos && pack.length) { var pi = Math.floor(Date.now() / 60000) % pack.length; if (pi !== svPic) { svPic = pi; $('sbg').style.backgroundImage = 'url("' + pack[pi] + '")'; } }
    if (s.analog) { var b = new Date(now.getTime() + 3 * 3600000), hh = b.getUTCHours() % 12, mi = b.getUTCMinutes(); if (!$('saH')) $('sanl').innerHTML = analogSvg().replace('id="aH"', 'id="saH"').replace('id="aM"', 'id="saM"');
      $('saH').setAttribute('transform', 'rotate(' + (hh * 30 + mi / 2) + ' 50 50)'); $('saM').setAttribute('transform', 'rotate(' + (mi * 6) + ' 50 50)'); }
    if (s.occ) { var oc = nextOcc(); $('socc').innerHTML = oc ? (oc.d === 0 ? 'اليوم: <b>' + esc(oc.n) + '</b>' : 'باقي ' + nf.format(oc.d) + ' يوم على <b>' + esc(oc.n) + '</b>') : ''; }
    if (s.wisdom) { var W = window.WISDOM || [], wi = W.length ? Math.floor(Date.now() / 600000) % W.length : -1; if (wi >= 0 && wi !== svWis) { svWis = wi; $('swis').innerHTML = esc(W[wi][0]) + '<small>' + esc(W[wi][1]) + '</small>'; } }
    txt('sct', c.t); txt('scd', fD.format(now));
    $('ssp').style.display = s.speed === false || !(LOC && LOC.ok) ? 'none' : ''; txt('skmh', nf.format(kmh));
    var show = s.music !== false && MED && MED.ok && MED.title;
    $('smu').style.display = show ? '' : 'none';
    if (show) { txt('stt', MED.title); txt('sar', [MED.artist, MED.app].filter(Boolean).join(' · ')); var im = $('sart'); if (MED.art) { im.src = MED.art; im.style.display = ''; } else im.style.display = 'none'; }
  }
  function startSaver() { saving = true; $('saver').classList.add('on'); paintLive(); }
  function stopSaver() { saving = false; $('saver').classList.remove('on'); }
  function touch() { lastInput = Date.now(); if (saving) { stopSaver(); return true; } return false; }
  window.__saverPreview = function (on) { if (on) startSaver(); else stopSaver(); };

  // ---------- events ----------
  var pressT = null, pressed = null, longFired = false, dialNum = '';
  function startPress(e) {
    var d = e.target.closest && e.target.closest('[data-dock]'); if (!d || PREVIEW) return;
    var k = d.getAttribute('data-dock'); if (k === 'home' || k === 'apps' || k === 'trips' || k === 'park') return;
    pressed = k; longFired = false; clearTimeout(pressT);
    pressT = setTimeout(function () { longFired = true; chooseFor(pressed); }, 900);
  }
  function endPress() { clearTimeout(pressT); }
  document.addEventListener('touchstart', startPress, true); document.addEventListener('mousedown', startPress, true);
  document.addEventListener('touchend', endPress, true); document.addEventListener('mouseup', endPress, true); document.addEventListener('touchmove', endPress, true);
  document.addEventListener('click', function (e) {
    if (PREVIEW) {
      var ed = e.target.closest('[data-cedit]');
      try { if (window.parent.__previewSelect) window.parent.__previewSelect(ed ? ed.getAttribute('data-cedit') : null); } catch (er) {}
      return;
    }
    if (touch()) return;
    if (longFired) { longFired = false; return; }
    var bn = e.target.closest('[data-bn]');
    if (bn && bannerItem) {
      if (bn.getAttribute('data-bn') === 'done') { LOG.done = LOG.done || {}; LOG.done[bannerItem.id] = { km: Math.round(odometer()), at: Date.now() }; logDirty = true; saveLog(true); toast('انحفظ ✓ ' + bannerItem.n); renderWidgets(); }
      else { var sn = load('carSnooze', {}) || {}; sn[bannerItem.id] = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10); save('carSnooze', sn); }
      checkBanner(); return;
    }
    var a = e.target.closest('[data-pkg]'); if (a) { closeAll(); launch(a.getAttribute('data-pkg')); return; }
    var d = e.target.closest('[data-dock]'); if (d) { dockAct(d.getAttribute('data-dock')); return; }
    var v = e.target.closest('[data-vol]'); if (v) { if (HAS && A.volume) A.volume(+v.getAttribute('data-vol')); return; }
    var m = e.target.closest('[data-mc]'); if (m) { if (HAS) A.mediaCmd(m.getAttribute('data-mc')); setTimeout(poll, 400); return; }
    if (e.target.closest('[data-na]')) { if (HAS && A.openNotifAccess) { A.openNotifAccess(); toast('فعّل «واجهة مدير الشاشات» بالقائمة وارجع'); } return; }
    var dl = e.target.closest('[data-dial]'); if (dl) { var x = (cfg.dial || [])[+dl.getAttribute('data-dial')]; if (x && HAS && A.dial) { if (!A.dial(x.num)) toast('ما گدرت أفتح الاتصال'); } return; }
    var ck = e.target.closest('[data-ckey]'); if (ck) { dialNum = (dialNum + ck.getAttribute('data-ckey')).slice(0, 18); setT('[data-cdisp]', dialNum); return; }
    if (e.target.closest('[data-cdel]')) { dialNum = dialNum.slice(0, -1); setT('[data-cdisp]', dialNum); return; }
    if (e.target.closest('[data-ccall]')) { if (!dialNum) { toast('اكتب الرقم أول'); return; } if (HAS && A.dial && !A.dial(dialNum)) toast('ما گدرت أفتح الاتصال'); return; }
    if (e.target.closest('[data-copen]')) { var ph = dockTarget('phone'); if (ph) launch(ph); else toast('ما لگيت تطبيق الاتصال'); return; }
    if (e.target.closest('[data-park]')) { openPark(); return; }
    if (e.target.closest('[data-map]')) { dockAct('maps'); return; }
    if (e.target.closest('[data-trip]')) { openTrips(); return; }
    if (e.target.closest('[data-spd]') || e.target.closest('#limPill')) { toggleProf(); return; }
    var med = e.target.closest('[data-med]'); if (med) { var p = dockTarget('music'); if (p) launch(p); return; }
    if (e.target.closest('#allBtn')) { $('drawer').classList.add('on'); return; }
    if (e.target.closest('#drClose') || e.target.closest('#ovClose')) closeAll();
  }, true);
  ['touchstart', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { lastInput = Date.now(); if (saving && ev === 'keydown') stopSaver(); }, true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.keyCode === 4) closeAll(); });
  window.onBackKey = function () { var open = $('drawer').classList.contains('on') || $('ov').classList.contains('on'); closeAll(); return open; };

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
    box.style.left = (r.left - 6) + 'px'; box.style.top = (r.top - 6) + 'px'; box.style.width = (r.width + 12) + 'px'; box.style.height = (r.height + 12) + 'px';
    var nm = 'هذا الجزء'; (list || []).forEach(function (e) { if (e[0] === selId) nm = e[1]; });
    box.firstChild.textContent = '✎ ' + nm;
  }
  var WN = { speed: 'السرعة', clock: 'الساعة', analog: 'ساعة عقارب', date: 'التاريخ', media: 'الموسيقى', weather: 'الطقس', compass: 'الاتجاه', trip: 'الرحلة', prayer: 'الصلاة', altitude: 'الارتفاع', park: 'مكان السيارة', dial: 'اتصال سريع', maint: 'الصيانة', call: 'الاتصال' };
  window.__live = function (o) {
    if (o.carcfg) { cfg = assign({}, DEF, o.carcfg); applyLook(); renderWidgets(); renderApps(); renderDock(); }
    if (o.saver !== undefined) window.__saverPreview(o.saver);
    if (o.drive !== undefined) { driving = !!o.drive; document.body.classList.toggle('driving', driving); $('drvPill').classList.toggle('on', driving); renderWidgets(); }
    if (o.over !== undefined) { PD.over = !!o.over; PD.loc = assign({}, PD.loc || { ok: true, bearing: 40, alt: 34, lat: 33.31, lng: 44.37 }, { kmh: o.over ? (limitNow() || 120) + 14 : 87 }); poll(); }
    var CE = [['bar', 'الشريط العلوي'], ['widgets', 'الويدجتات'], ['apps', 'التطبيقات'], ['dock', 'الشريط السفلي'], ['vol', 'أزرار الصوت']];
    (cfg.widgets || []).forEach(function (w, i) { CE.push(['w' + i, WN[w.t] || ('ويدجت ' + (i + 1))]); });
    var selFn = function (i) { return '[data-cedit="' + i + '"]'; };
    showSel(o.select, CE, selFn);
    setTimeout(function () { showSel(undefined, CE, selFn); }, 350);
  };

  // ---------- pairing with the phone ----------
  var pairT;
  function ensurePair() {
    var b = $('pairBox'); if (b) return b;
    b = document.createElement('div'); b.id = 'pairBox';
    b.innerHTML = '<div class="p-t">ربط الموبايل بشاشة السيارة</div><div class="p-code" id="pairCode"></div><div class="p-s" id="pairSub"></div><button id="pairX">إغلاق</button>';
    document.body.appendChild(b);
    $('pairX').onclick = function () { window.hidePair(); };
    return b;
  }
  window.showPair = function (code, url) {
    var b = ensurePair();
    var pc = $('pairCode'); pc.textContent = code;
    /* the code always fits the box, whatever the screen size or the code length */
    var vw = Math.max(window.innerWidth || 1024, 320), vh = Math.max(window.innerHeight || 600, 240), len = String(code || '').length || 1;
    pc.style.fontSize = Math.round(Math.min(vh * 0.1, (vw * 0.78) / (len * 0.78))) + 'px';
    pc.style.letterSpacing = len > 8 ? '0' : Math.round(vh * 0.012) + 'px';
    $('pairSub').innerHTML = 'اكتب الرمز بتطبيق «مدير الشاشة»<br>إذا ما لگه الشاشة، اكتب العنوان يدوي: <b dir="ltr">' + esc((url || '').replace(/^http:\/\//, '').replace(/:\d+$/, '') || 'ماكو واي فاي') + '</b>';
    b.classList.add('on'); clearTimeout(pairT); pairT = setTimeout(window.hidePair, 3 * 60000);
  };
  window.hidePair = function () { clearTimeout(pairT); var b = $('pairBox'); if (b) b.classList.remove('on'); };
  window.toastMsg = function (t) { toast(String(t || '')); };
  window.remoteCmd = function (c) {
    lastInput = Date.now(); if (saving) stopSaver();
    try {
      if (c.type === 'toast') toast(String(c.value || ''));
      else if (c.type === 'image') { if (c.pin) save('carBgPin', c.path); else { cfg.bgPack = [c.path].concat(cfg.bgPack || []).slice(0, 15); var cc = load('carcfg', {}) || {}; cc.bgPack = cfg.bgPack; save('carcfg', cc); save('carBgPin', null); } bgCur = ''; showBg(); toast('وصلت صورة جديدة من الموبايل 📱'); }
      else if (c.type === 'bgNext' || c.type === 'bgClear') { save('carBgPin', null); bgCur = ''; showBg(); }
      else if (c.type === 'update') {
        var done = function (j) {
          var n = parseInt(String(j.tag_name || '').replace(/\D/g, ''), 10) || 0, mine = HAS && A.buildNumber ? A.buildNumber() : 0;
          var a = (j.assets || []).filter(function (x) { return /\.apk$/.test(x.name); })[0];
          if (/^build-/.test(j.tag_name) && n > mine && a && A.installUpdate) { toast('أنزّل التحديث…'); A.installUpdate(a.browser_download_url); } else toast('عندك آخر نسخة ✅');
        };
        var url = 'https://api.github.com/repos/hnt45y-111/clean-tv/releases?per_page=20';
        var pick = function (l) { l = l || []; for (var i = 0; i < l.length; i++) if (/^build-/.test(l[i].tag_name)) return done(l[i]); toast('عندك آخر نسخة ✅'); };
        if (HAS && A.fetchAsync) { var id = 'u' + Date.now(), old = window.__cb; window.__cb = function (cid, t) { if (cid === id) { window.__cb = old; try { pick(JSON.parse(t)); } catch (e) { toast('ما گدرت أفحص التحديث'); } } else if (old) old(cid, t); }; A.fetchAsync(url, id); }
      }
    } catch (e) {}
  };
  // long-press the top bar to show the pairing code on the car screen itself
  (function () {
    var bar = $('bar'), t0;
    if (!bar) return;
    var start = function () { t0 = setTimeout(function () { if (HAS && A.remoteStartPairing) A.remoteStartPairing(); else window.showPair('123456', 'http://192.168.43.20:8686'); }, 1200); };
    var stop = function () { clearTimeout(t0); };
    bar.addEventListener('touchstart', start, { passive: true }); bar.addEventListener('touchend', stop); bar.addEventListener('touchmove', stop, { passive: true });
    bar.addEventListener('mousedown', start); bar.addEventListener('mouseup', stop); bar.addEventListener('mouseleave', stop);
  })();

  applyLook(); renderWidgets(); renderDock(); loadApps(); syncPrefs(); wxLoad(); poll();
  if (!PREVIEW && HAS && A.hasLocation && !A.hasLocation() && A.askLocation) setTimeout(function () { A.askLocation(); }, 2500);
  setInterval(poll, PREVIEW ? 5000 : 1000);
  setInterval(function () {
    applyLook();
    var s = cfg.saver || {};
    if (!PREVIEW && s.on !== false && !saving && !driving && Date.now() - lastInput > (s.min || 5) * 60000 && document.visibilityState !== 'hidden') startSaver();
  }, 15000);
  setInterval(wxLoad, 30 * 60000);
  setTimeout(pushConfig, 2000);
})();
