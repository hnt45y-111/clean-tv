/* «واجهة العمق»: the clock sits between the picture and its standout subject (the iPhone lock-screen look).
   A self-contained skin: it draws its own screen when settings.skin === 'depth' and takes the remote keys while the launcher is on the main layer.
   ES5 on purpose (old TV WebViews). Everything it needs from the launcher comes through window.__depthApi (see app.js). */
(function () {
  'use strict';
  var PLACES = [
    { id: 'tassili', n: 'طاسيلي', c: 'الجزائر · الأهقار', dy: 0 },
    { id: 'taghit', n: 'تاغيت', c: 'الجزائر · بشار', dy: 40 },
    { id: 'djurdjura', n: 'جرجرة', c: 'الجزائر · القبائل', dy: 40 },
    { id: 'timimoun', n: 'تيميمون', c: 'الجزائر · أدرار', dy: 30 },
    { id: 'ghardaia', n: 'غرداية', c: 'الجزائر · وادي ميزاب', dy: 50 },
    { id: 'constantine', n: 'قسنطينة', c: 'الجزائر · مدينة الجسور', dy: 40 }
  ];
  var DOCK_MAX = 10, COLS = 10, AMP_BG = 25, AMP_FG = 33, KEY = 'depthCfg';
  var root = null, mounted = false, built = false;
  var D = { bg: 0, effect: true, reduce: false, dock: null, hidden: [], f: 'dock', di: 0, ti: 0, gi: 0, drawer: false, menu: null, panel: null, pick: null, mv: false, from: null };
  var timers = {}, scenes = {}, lpT = null, lpFired = false;
  function api() { return window.__depthApi || null; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function weak() { try { return (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 1); } catch (e) { return false; } }

  /* ---------------------------------------------------------------- saved choices (kept on the TV; a design can carry defaults in settings.depth) */
  function loadCfg() {
    var A = api(), def = (A && A.settings().depth) || {}, st = {};
    if (!(A && A.preview)) { try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { st = {}; } }
    D.bg = clamp(+(st.bg != null ? st.bg : def.bg) || 0, 0, PLACES.length - 1);
    D.effect = st.effect != null ? st.effect !== false : def.effect !== false;
    D.reduce = st.reduce != null ? !!st.reduce : def.reduce != null ? !!def.reduce : weak();
    D.dock = st.dock || null;
    D.hidden = st.hidden || [];
  }
  function saveCfg() {
    var A = api(); if (A && A.preview) return;
    try { localStorage.setItem(KEY, JSON.stringify({ bg: D.bg, effect: D.effect, reduce: D.reduce, dock: D.dock, hidden: D.hidden })); } catch (e) {}
  }

  /* ---------------------------------------------------------------- apps and the dock */
  function allApps() {
    var A = api(); if (!A) return [];
    return A.apps().filter(function (a) { return a && a.pkg && D.hidden.indexOf(a.pkg) < 0; });
  }
  function byPkg(p) { var l = allApps(); for (var i = 0; i < l.length; i++) if (l[i].pkg === p) return l[i]; return null; }
  function dockApps() {
    var l = allApps(), out = [];
    if (!D.dock && l.length) { D.dock = l.slice(0, 9).map(function (a) { return a.pkg; }); }
    if (!D.dock) return out;
    D.dock.forEach(function (p) { var a = byPkg(p); if (a && out.indexOf(a) < 0) out.push(a); });
    return out.slice(0, DOCK_MAX);
  }
  function inDock(pkg) { return dockApps().some(function (a) { return a.pkg === pkg; }); }
  function addDock(pkg) {
    var cur = dockApps().map(function (a) { return a.pkg; });
    if (cur.indexOf(pkg) >= 0) return true;
    if (cur.length >= DOCK_MAX) { toast('الشريط ممتلئ (' + DOCK_MAX + ' تطبيقات). شيل واحد أول'); return false; }
    cur.push(pkg); D.dock = cur; saveCfg(); return true;
  }
  function removeDock(pkg) {
    D.dock = dockApps().map(function (a) { return a.pkg; }).filter(function (p) { return p !== pkg; }); saveCfg();
  }
  function hideApp(pkg) { if (D.hidden.indexOf(pkg) < 0) D.hidden.push(pkg); D.dock = dockApps().map(function (a) { return a.pkg; }).filter(function (p) { return p !== pkg; }); saveCfg(); }
  function toast(m) { var A = api(); if (A) A.toast(m); }

  function iconHtml(a, size) {
    var A = api(), src = A.icon(a), col = a.color || '#5b6b8c';
    var inner = src ? '<img src="' + esc(src) + '" alt="" onerror="this.style.display=\'none\'">' : '';
    return '<div class="dp-ic" style="width:' + size + 'px;height:' + size + 'px;border-radius:' + Math.round(size * .26) + 'px;background:' + (src ? 'rgba(255,255,255,.12)' : col) + '">' + inner + (src ? '' : '<b>' + esc(String(A.label(a)).replace(/^ال/, '').slice(0, 1)) + '</b>') + '</div>';
  }

  /* the colour that dominates an icon (for the glow under the dock); cached */
  var domCache = {};
  function dominant(a, cb) {
    if (domCache[a.pkg]) return cb(domCache[a.pkg]);
    var A = api(), src = A.icon(a), fb = a.color || '#7a6cff';
    if (!src || !document.createElement('canvas').getContext) { domCache[a.pkg] = fb; return cb(fb); }
    var im = new Image();
    im.onload = function () {
      var c = '';
      try {
        var cv = document.createElement('canvas'); cv.width = cv.height = 12; var x = cv.getContext('2d'); x.drawImage(im, 0, 0, 12, 12);
        var d = x.getImageData(0, 0, 12, 12).data, r = 0, g = 0, b = 0, w = 0;
        for (var i = 0; i < d.length; i += 4) { var al = d[i + 3] / 255, mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), sat = mx ? (mx - mn) / mx : 0, wt = al * (.15 + sat); r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt; }
        if (w > 0) c = 'rgb(' + Math.round(r / w) + ',' + Math.round(g / w) + ',' + Math.round(b / w) + ')';
      } catch (e) {}
      domCache[a.pkg] = c || fb; cb(domCache[a.pkg]);
    };
    im.onerror = function () { domCache[a.pkg] = fb; cb(fb); };
    im.src = src;
  }

  /* ---------------------------------------------------------------- the scene: picture, clock, subject */
  function clockText() { var A = api(); try { return A ? A.clock() : ''; } catch (e) { return ''; } }
  function sceneEl(i, reduceMotion) {
    var p = PLACES[i], el = document.createElement('div');
    el.className = 'dp-sc';
    el.innerHTML = '<div class="dp-lyr dp-bgw"><img class="dp-bg" src="depth/' + p.id + '.jpg" alt=""></div>' +
      '<svg class="dp-clk" viewBox="0 0 1920 1080" aria-hidden="true"><defs><filter id="dpsh' + i + '" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000" flood-opacity=".38"/></filter></defs>' +
      '<text class="dp-ck" x="960" y="' + (376 + p.dy) + '" text-anchor="middle" filter="url(#dpsh' + i + ')">' + esc(clockText()) + '</text></svg>' +
      '<div class="dp-lyr dp-fgw"><img class="dp-fg" src="depth/' + p.id + '_fg.png" alt=""></div>';
    return el;
  }
  function paintClocks() { var t = clockText(), l = document.querySelectorAll('#depth .dp-ck'); for (var i = 0; i < l.length; i++) l[i].textContent = t; }
  function showScene(i, host, key) {
    var old = scenes[key]; if (old && old.i === i) return;
    var el = sceneEl(i);
    host.appendChild(el);
    void el.offsetWidth;
    el.classList.add('on');
    scenes[key] = { i: i, el: el };
    if (old) { old.el.classList.remove('on'); (function (o) { setTimeout(function () { if (o.el.parentNode) o.el.parentNode.removeChild(o.el); }, D.reduce ? 200 : 700); })(old); }
    if (key === 'home') parallax();
  }
  function setPar(sc, pos) {
    if (!sc) return;
    var amp = D.reduce ? 0 : 1, bg = sc.el.querySelector('.dp-bgw'), fg = sc.el.querySelector('.dp-fgw');
    if (bg) bg.style.transform = 'translate3d(' + (pos * AMP_BG * amp).toFixed(1) + 'px,0,0)';
    if (fg) fg.style.transform = 'translate3d(' + (pos * AMP_FG * amp).toFixed(1) + 'px,0,0)';
  }
  /* where the selection is on screen (-1 right edge … +1 left edge, RTL): the picture follows it */
  function selPos() {
    var n, i;
    if (D.drawer) { n = COLS; i = D.gi % COLS; } else { n = Math.max(1, dockApps().length); i = D.di; }
    if (n < 2) return 0;
    return ((n - 1) / 2 - i) / ((n - 1) / 2);
  }
  function parallax() { setPar(scenes.home, selPos()); }

  /* ---------------------------------------------------------------- building the screen */
  function build() {
    if (built) return;
    built = true;
    root = document.createElement('div'); root.id = 'depth';
    root.innerHTML =
      '<div id="dpScenes"></div><div id="dpGlowA" class="dp-glow"></div><div id="dpGlowB" class="dp-glow"></div>' +
      '<div id="dpDate"></div><div id="dpPlace" class="dp-chip"></div>' +
      '<div id="dpPray" class="dp-glass"></div><div id="dpTop"></div>' +
      '<div id="dpDock" class="dp-glass"></div><div id="dpName"></div>' +
      '<div id="dpDrawer"><div id="dpDrawerGrid"></div><div id="dpDrawerName"></div></div>' +
      '<div id="dpMenu" class="dp-glass"></div><div id="dpPanel" class="dp-glass"></div>' +
      '<div id="dpPick"><div id="dpPickBox"></div><div id="dpPickBtns"></div><div id="dpPickHint">يمين ويسار للتنقل · OK لتطبيق الخلفية · رجوع للإلغاء</div></div>';
    var st = $('stage') || document.body; st.appendChild(root);
  }
  function mount() {
    build(); loadCfg();
    root.style.display = 'block'; mounted = true;
    root.className = (D.reduce ? 'dp-reduce ' : '') + (D.effect ? '' : 'dp-nofx');
    D.f = 'dock'; D.di = clamp(D.di, 0, Math.max(0, dockApps().length - 1));
    showScene(D.bg, $('dpScenes'), 'home');
    renderAll();
    if (!timers.t) timers.t = setInterval(function () { if (mounted) { paintClocks(); renderMeta(); } }, 10000);
    document.body.classList.add('dp-on');
  }
  function unmount() {
    if (!mounted) return;
    mounted = false; if (root) root.style.display = 'none';
    document.body.classList.remove('dp-on');
    clearInterval(timers.t); timers.t = null;
    scenes = {}; if ($('dpScenes')) $('dpScenes').innerHTML = '';
  }

  function dateText() {
    try {
      var d = new Date(), g = new Intl.DateTimeFormat('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baghdad' }).format(d);
      var h = api().hijri(); return g + (h ? ' · ' + h : '');
    } catch (e) { return ''; }
  }
  function renderMeta() {
    var A = api(); if (!A) return;
    $('dpDate').textContent = dateText();
    var p = PLACES[D.bg];
    $('dpPlace').innerHTML = '<i></i>' + esc(p.n) + ' <small>· ' + esc(p.c) + '</small>';
    $('dpPlace').className = 'dp-chip' + (D.f === 'chip' && !D.drawer && !D.pick && !D.panel && !D.menu ? ' focus' : '');
    var pr = A.prayer();
    $('dpPray').innerHTML = pr ? '<div class="pk">الصلاة القادمة</div><div class="pn">' + esc(pr.name) + ' <b>' + esc(pr.time) + '</b></div><div class="ps">' + esc(pr.left) + '</div>' : '';
    $('dpPray').style.display = pr ? '' : 'none';
  }
  var TOPS = [['notif', 'الإشعارات', 'M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0'], ['wifi', 'الواي فاي', 'M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01'], ['net', 'حالة الاتصال', 'M4 18v-2M9 18v-6M14 18V9M19 18V5'], ['set', 'الإعدادات', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-2a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 3.6h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z']];
  function renderTop() {
    var on = navigator.onLine !== false, h = '';
    TOPS.forEach(function (t, i) {
      var cls = 'dp-circ' + (D.f === 'top' && D.ti === i && !D.panel && !D.menu && !D.pick && !D.drawer ? ' focus' : '') + (t[0] === 'net' && !on ? ' off' : '');
      h += '<div class="' + cls + '" title="' + t[1] + '"><svg viewBox="0 0 24 24"><path d="' + t[2] + '"/></svg>' + (D.f === 'top' && D.ti === i ? '<span>' + t[1] + '</span>' : '') + '</div>';
    });
    $('dpTop').innerHTML = h;
  }
  function dockBottom() {
    var t = $('liveTicker'); return (t && t.offsetHeight > 0 ? t.offsetHeight + 22 : 22) + 34;
  }
  function renderDock() {
    var A = api(), l = dockApps(), h = '', focusOn = D.f === 'dock' && !D.drawer && !D.panel && !D.pick && !D.menu;
    if (D.di >= l.length) D.di = Math.max(0, l.length - 1);
    l.forEach(function (a, i) {
      var sel = i === D.di;
      h += '<div class="dp-it' + (sel ? ' sel' : '') + (sel && focusOn ? ' focus' : '') + (D.mv && sel ? ' mv' : '') + '">' + iconHtml(a, 92) + '</div>';
    });
    var dk = $('dpDock'); dk.innerHTML = h || '<div class="dp-empty">ماكو تطبيقات بالشريط</div>';
    dk.style.bottom = dockBottom() + 'px';
    dk.className = 'dp-glass' + (D.drawer ? ' up' : '');
    var nm = $('dpName'), cur = l[D.di];
    nm.textContent = cur && !D.drawer ? A.label(cur) : '';
    nm.style.bottom = (dockBottom() - 30) + 'px';
    nm.className = cur && !D.drawer ? 'on' : '';
    if (cur) { var token = ++timers.g; dominant(cur, function (c) { if (token === timers.g) setGlow(c); }); }
  }
  timers.g = 0;
  var glowFlip = false;
  function setGlow(c) {
    var a = $('dpGlowA'), b = $('dpGlowB'), on = glowFlip ? a : b, off = glowFlip ? b : a; glowFlip = !glowFlip;
    on.style.background = 'radial-gradient(70% 90% at 50% 105%, ' + c + ' 0%, rgba(0,0,0,0) 70%)'; on.style.opacity = '.55'; off.style.opacity = '0';
  }
  function renderDrawer() {
    var A = api(), l = allApps(), g = $('dpDrawerGrid'), h = '';
    if (D.gi >= l.length) D.gi = Math.max(0, l.length - 1);
    l.forEach(function (a, i) { h += '<div class="dp-gi' + (i === D.gi && D.drawer && !D.menu ? ' focus' : '') + '">' + iconHtml(a, 104) + '</div>'; });
    g.innerHTML = h;
    var row = Math.floor(D.gi / COLS), rows = Math.ceil(l.length / COLS), vis = 4, off = Math.max(0, Math.min(row - 1, rows - vis)) * 190;
    g.style.transform = 'translateY(' + (-off) + 'px)';
    $('dpDrawerName').textContent = l[D.gi] ? A.label(l[D.gi]) : '';
    $('dpDrawerName').style.bottom = (dockBottom() - 10) + 'px';
    $('dpDrawer').className = D.drawer ? 'on' : '';
  }
  function renderAll() { renderMeta(); renderTop(); renderDock(); renderDrawer(); parallax(); }

  /* ---------------------------------------------------------------- the pop-up menu (hold OK on an icon) */
  function curApp() { return D.drawer ? allApps()[D.gi] : dockApps()[D.di]; }
  function openMenu() {
    var a = curApp(); if (!a) return;
    var opts = [];
    if (inDock(a.pkg)) { opts.push(['rm', 'إزالة من الشريط']); opts.push(['mv', 'نقل داخل الشريط']); } else opts.push(['add', 'إضافة إلى الشريط']);
    opts.push(['hide', 'إخفاء التطبيق']);
    D.menu = { app: a, opts: opts, i: 0 };
    drawMenu();
  }
  function drawMenu() {
    var m = $('dpMenu');
    if (!D.menu) { m.className = 'dp-glass'; m.innerHTML = ''; return renderAll(); }
    m.innerHTML = '<div class="mt">' + esc(api().label(D.menu.app)) + '</div>' + D.menu.opts.map(function (o, i) { return '<div class="mo' + (i === D.menu.i ? ' focus' : '') + '">' + o[1] + '</div>'; }).join('');
    m.className = 'dp-glass on';
  }
  function menuKey(k) {
    var m = D.menu;
    if (k === 'ArrowUp') m.i = (m.i + m.opts.length - 1) % m.opts.length;
    else if (k === 'ArrowDown') m.i = (m.i + 1) % m.opts.length;
    else if (k === 'back') { D.menu = null; return drawMenu(); }
    else if (k === 'ok') {
      var id = m.opts[m.i][0], a = m.app; D.menu = null;
      if (id === 'add') { if (addDock(a.pkg)) toast('انضافت للشريط'); }
      else if (id === 'rm') { removeDock(a.pkg); toast('انشالت من الشريط'); }
      else if (id === 'hide') { hideApp(a.pkg); toast('انخفى «' + api().label(a) + '». ترجعه من الإعدادات'); if (D.gi > 0 && D.drawer) D.gi--; }
      else if (id === 'mv') { D.mv = true; D.drawer = false; D.f = 'dock'; D.di = Math.max(0, dockApps().map(function (x) { return x.pkg; }).indexOf(a.pkg)); toast('حرّك بالأسهم، OK للتثبيت'); }
      return drawMenu();
    }
    drawMenu();
  }

  /* ---------------------------------------------------------------- settings panel and the picture picker */
  function openPanel() { D.panel = { i: 0 }; drawPanel(); }
  function panelRows() {
    var hid = D.hidden.length;
    return [['effect', 'تأثير العمق', D.effect ? 'شغّال' : 'مطفي'], ['reduce', 'تقليل الحركة', D.reduce ? 'شغّال' : 'مطفي'], ['bg', 'تغيير الخلفية', PLACES[D.bg].n],
      ['unhide', 'إظهار التطبيقات المخفية', hid ? hid + ' مخفي' : 'ماكو'], ['ui', 'إعدادات الواجهة', ''], ['sys', 'إعدادات الجهاز', '']];
  }
  function drawPanel() {
    var p = $('dpPanel');
    if (!D.panel) { p.className = 'dp-glass'; p.innerHTML = ''; return renderAll(); }
    p.innerHTML = '<div class="mt">الإعدادات</div>' + panelRows().map(function (r, i) { return '<div class="mo' + (i === D.panel.i ? ' focus' : '') + '"><span>' + r[1] + '</span><em>' + esc(r[2]) + '</em></div>'; }).join('');
    p.className = 'dp-glass on';
    root.className = (D.reduce ? 'dp-reduce ' : '') + (D.effect ? '' : 'dp-nofx');
    parallax(); renderDock();
  }
  function panelKey(k) {
    var rows = panelRows(), P = D.panel;
    if (k === 'ArrowUp') P.i = (P.i + rows.length - 1) % rows.length;
    else if (k === 'ArrowDown') P.i = (P.i + 1) % rows.length;
    else if (k === 'back') { D.panel = null; return drawPanel(); }
    else if (k === 'ok') {
      var id = rows[P.i][0];
      if (id === 'effect') { D.effect = !D.effect; saveCfg(); }
      else if (id === 'reduce') { D.reduce = !D.reduce; saveCfg(); }
      else if (id === 'bg') { D.panel = null; drawPanel(); return openPick(); }
      else if (id === 'unhide') { D.hidden = []; saveCfg(); toast('رجعت كل التطبيقات'); }
      else if (id === 'ui') { D.panel = null; drawPanel(); var A = api(); if (A) A.openSettings(); return; }
      else if (id === 'sys') { D.panel = null; drawPanel(); var B = api(); if (B) B.sysSettings(); return; }
    }
    drawPanel();
  }
  function openPick() {
    D.pick = { i: D.bg, from: D.bg };
    $('dpPick').className = 'on';
    var h = ''; PLACES.forEach(function (p, i) { h += '<div class="dp-pb' + (i === D.pick.i ? ' focus' : '') + '">' + esc(p.n) + '</div>'; });
    $('dpPickBtns').innerHTML = h;
    scenes.pick = null; $('dpPickBox').innerHTML = '';
    showScene(D.pick.i, $('dpPickBox'), 'pick');
  }
  function pickKey(k) {
    var P = D.pick, n = PLACES.length;
    if (k === 'back') { D.pick = null; $('dpPick').className = ''; scenes.pick = null; return renderAll(); }
    if (k === 'ArrowRight') P.i = (P.i + n - 1) % n;          // RTL: right is the first place
    else if (k === 'ArrowLeft') P.i = (P.i + 1) % n;
    else if (k === 'ok') {
      D.bg = P.i; saveCfg(); D.pick = null; $('dpPick').className = ''; scenes.pick = null;
      showScene(D.bg, $('dpScenes'), 'home'); return renderAll();
    }
    var btns = $('dpPickBtns').children; for (var i = 0; i < btns.length; i++) btns[i].className = 'dp-pb' + (i === P.i ? ' focus' : '');
    showScene(P.i, $('dpPickBox'), 'pick');
  }

  /* ---------------------------------------------------------------- the top buttons */
  function topAct(id) {
    var A = api(), B = (window.Android || {});
    if (id === 'set') return openPanel();
    if (id === 'wifi') { if (B.openWifi) B.openWifi(); else toast('الواي فاي: يحتاج الشاشة نفسها'); return; }
    if (id === 'net') { if (B.openNetwork) B.openNetwork(); else toast(navigator.onLine === false ? 'ماكو اتصال بالإنترنت' : 'متصل بالإنترنت'); return; }
    if (id === 'notif') {
      var m = ''; try { var j = B.media ? JSON.parse(B.media() || '{}') : {}; m = j && (j.title || j.text) ? (j.title || '') + (j.artist ? ' · ' + j.artist : '') : ''; } catch (e) {}
      toast(m ? 'يشتغل الآن: ' + m : 'ماكو إشعارات جديدة');
    }
  }

  /* ---------------------------------------------------------------- keys */
  function launch(a) { var A = api(); if (A && a) A.launch(a.pkg); }
  function homeKey(k) {
    var l = dockApps();
    if (D.f === 'dock') {
      if (D.mv) {
        var from = D.di, to = from;
        if (k === 'ArrowRight') to = Math.max(0, from - 1); else if (k === 'ArrowLeft') to = Math.min(l.length - 1, from + 1);
        else if (k === 'ok' || k === 'back') { D.mv = false; saveCfg(); return renderAll(); }
        if (to !== from) { var pk = l.map(function (a) { return a.pkg; }), it = pk.splice(from, 1)[0]; pk.splice(to, 0, it); D.dock = pk; D.di = to; saveCfg(); }
        return renderAll();
      }
      if (k === 'ArrowRight') D.di = Math.max(0, D.di - 1);
      else if (k === 'ArrowLeft') D.di = Math.min(l.length - 1, D.di + 1);
      else if (k === 'ArrowUp') D.f = 'chip';
      else if (k === 'ArrowDown') { D.drawer = true; D.gi = Math.max(0, allApps().map(function (a) { return a.pkg; }).indexOf((l[D.di] || {}).pkg)); }
      else if (k === 'ok') launch(l[D.di]);
    } else if (D.f === 'chip') {
      if (k === 'ArrowDown') D.f = 'dock'; else if (k === 'ArrowUp') { D.f = 'top'; } else if (k === 'ok') return openPick();
    } else if (D.f === 'top') {
      if (k === 'ArrowRight') D.ti = Math.max(0, D.ti - 1); else if (k === 'ArrowLeft') D.ti = Math.min(TOPS.length - 1, D.ti + 1);
      else if (k === 'ArrowDown') D.f = 'chip'; else if (k === 'ok') topAct(TOPS[D.ti][0]);
    }
    renderAll();
  }
  function drawerKey(k) {
    var l = allApps(), n = l.length;
    if (k === 'back') { D.drawer = false; D.f = 'dock'; return renderAll(); }
    if (k === 'ArrowRight') D.gi = Math.max(0, D.gi - 1);
    else if (k === 'ArrowLeft') D.gi = Math.min(n - 1, D.gi + 1);
    else if (k === 'ArrowDown') D.gi = Math.min(n - 1, D.gi + COLS);
    else if (k === 'ArrowUp') { if (D.gi - COLS >= 0) D.gi -= COLS; else { D.drawer = false; D.f = 'dock'; } }
    else if (k === 'ok') launch(l[D.gi]);
    renderAll();
  }
  function key(k) {
    if (D.pick) return pickKey(k);
    if (D.panel) return panelKey(k);
    if (D.menu) return menuKey(k);
    if (D.drawer) return drawerKey(k);
    homeKey(k);
  }

  /* hold OK on an app icon: its menu opens; a short press launches it. Capture phase, so the launcher's own OK handling does not also run. */
  function isOk(e) { return e.key === 'Enter' || e.key === ' ' || e.keyCode === 23 || e.keyCode === 13; }
  function onApp() { return mounted && !D.pick && !D.panel && !D.menu && !D.mv && (D.drawer || D.f === 'dock'); }
  window.addEventListener('keydown', function (e) {
    var A = api(); if (!mounted || !A || A.layer() !== 'main' || !isOk(e) || !onApp()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat || lpT) return;
    lpFired = false;
    lpT = setTimeout(function () { lpT = null; lpFired = true; openMenu(); }, 600);
  }, true);
  window.addEventListener('keyup', function (e) {
    if (!mounted || !isOk(e) || !(lpT || lpFired)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (lpT) { clearTimeout(lpT); lpT = null; var A = api(); if (A) A.press(); key('ok'); }
    lpFired = false;
  }, true);

  window.Depth = {
    on: function () { var A = api(); return mounted && !!A && A.settings().skin === 'depth'; },
    sync: function () { var A = api(); if (!A) return; if (A.settings().skin === 'depth') { if (!mounted) mount(); else { loadCfg(); renderAll(); } } else unmount(); },
    key: key,
    apps: function () { if (mounted) renderAll(); },
    paint: function () { if (mounted) { paintClocks(); renderMeta(); } },
    home: function () { D.drawer = false; D.panel = null; D.menu = null; D.mv = false; D.f = 'dock'; if (D.pick) { D.pick = null; $('dpPick').className = ''; } if (mounted) renderAll(); },
    places: PLACES,
    _t: { state: D, loadCfg: loadCfg, saveCfg: saveCfg, dockApps: dockApps, selPos: selPos, addDock: addDock, hideApp: hideApp, removeDock: removeDock, menuKey: menuKey }
  };
})();
