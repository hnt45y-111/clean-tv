/* «قنواتي» home screen for the TV: top bar, hero, suggestions, top 10, categories and rows; six themes, a follow-the-launcher mode,
   and everything editable (name, profile, colours, background, nav bar, rows). ES5 on purpose (old TV WebViews).
   Opens in place of the channels grid; the grid (live.js) and the films browser (vod.js) are still reached from its top bar. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var L = window.Live, V = window.Vod;
  if (!L || !V || !$('homeModal')) return;
  L._open = L.open;

  var THEMES = [
    { id: 'cinema', n: 'سينمائي (الأساسي)', rz: '#FA0023', hero: 'wide', nav: 'pill', top: 'outline', fx: 'glow' },
    { id: 'royal', n: 'ذهبي ملكي', rz: '#D6B47A', hero: 'frame', nav: 'bar', top: 'badge', fx: 'gold' },
    { id: 'karbala', n: 'كربلائي', rz: '#C4001D', hero: 'side', nav: 'dock', top: 'fill', fx: 'embers' },
    { id: 'alawi', n: 'علوي أخضر', rz: '#12B76A', hero: 'split', nav: 'pill', top: 'badge', fx: 'aurora' },
    { id: 'apple', n: 'زجاجي', rz: '#0A84FF', hero: 'glass', nav: 'glass', top: 'none', fx: 'depth' },
    { id: 'neon', n: 'نيون', rz: '#00E5FF', hero: 'neon', nav: 'neonbar', top: 'neon', fx: 'scan' },
    { id: 'launcher', n: 'نفس ثيم الواجهة المثبّت', rz: '', hero: 'wide', nav: 'pill', top: 'outline', fx: 'glow' }
  ];
  var ACC = ['#FA0023', '#FF6A00', '#D6B47A', '#12B76A', '#00E5FF', '#0A84FF', '#B14AFF', '#FF3EA5'];
  var AVS = ['🦁', '🐯', '🦊', '🐼', '🦅', '🐺', '🌙', '⭐'];
  var NAVD = { home: 'الرئيسية', live: 'البث المباشر', movies: 'أفلام', series: 'مسلسلات', lib: 'مكتبتي', search: 'بحث' };
  var NAVORD = ['home', 'live', 'movies', 'series', 'lib', 'search'];
  var BGS = [['theme', 'حسب الثيم'], ['black', 'أسود'], ['grad', 'تدرّج']];
  var SIZES = [['s', 'صغير'], ['m', 'عادي'], ['l', 'كبير']];

  function ls(k, d) { try { var v = localStorage.getItem((window.__pk ? window.__pk(k) : k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lw(k, v) { try { localStorage.setItem((window.__pk ? window.__pk(k) : k), JSON.stringify(v)); } catch (e) {} }
  function U() {
    var u = ls('hmUi', null) || {};
    if (!u.theme) u.theme = 'cinema'; if (!u.nav || !u.nav.length) u.nav = ['home', 'live', 'movies', 'series', 'lib'];
    if (!u.size) u.size = 'm'; if (!u.rows) u.rows = { ord: [], hid: [] }; return u;
  }
  var ui = U();
  function saveUi() { lw('hmUi', ui); }
  function themeOf() { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === ui.theme) return THEMES[i]; return THEMES[0]; }
  function ar0(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
  function hue(s) { var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function toast(t) { if (window.toastMsg) window.toastMsg(t); }

  var st = { page: 'home', z: 'nav', n: 0, h: 0, s: 0, r: 0, c: 0, rows: [], pool: [], hero: 0, timer: null, from: false, sets: [], si: 0, input: null };

  /* ------------------------------------------------------------ data */
  function logoOf(c) { return c.i ? 'logos/' + c.i + '.png' : (c.l || c.img || ''); }
  function vodData() { var d = V.data(); return { m: (d && d.m && d.m.items) || [], s: (d && d.s && d.s.items) || [], mc: (d && d.m && d.m.cats) || [], sc: (d && d.s && d.s.cats) || [] }; }
  function vodAll() { var d = vodData(); return d.m.concat(d.s); }
  function art(it, wide) {
    var u = logoOf(it), ini = esc(String(it.n).replace(/^ال/, '').replace(/\s/g, '').slice(0, 2));
    return '<div class="hm-art' + (wide ? ' w' : '') + '" style="background:hsl(' + hue(it.n) + ',30%,22%)"><b>' + ini + '</b>' + (u ? '<img src="' + esc(u) + '" alt="" onerror="this.parentNode.removeChild(this)">' : '') + '</div>';
  }
  function kindOf(it) { return it.t === 'xs' ? 'مسلسل' : it.t ? 'فيلم' : 'قناة'; }
  function topList() {
    var v = vodAll().filter(function (c) { return c.img; });
    if (v.length >= 10) return v.slice(0, 10);
    var ch = L.channels().filter(function (c) { return c.c === 'iq' && (c.i || c.l); });
    return ch.length >= 5 ? ch.slice(0, 10) : L.channels().slice(0, 10);
  }
  function buildPool() {
    var v = vodAll().filter(function (c) { return c.img; });
    if (v.length >= 5) st.pool = v.slice(0, 9);
    else { var ch = L.channels(); var iq = ch.filter(function (c) { return c.c === 'iq'; }); st.pool = iq.concat(ch).slice(0, 9); }
    if (st.hero >= st.pool.length) st.hero = 0;
  }
  function buildRows() {
    var all = L.channels(), rows = [], by = {}, v = vodData();
    var tl = topList(); if (tl.length) rows.push({ id: 'top', n: 'الأكثر مشاهدة · أعلى ١٠', type: 'top', items: tl });
    var rec = L.recents(); if (rec.length) rows.push({ id: 'rec', n: 'تابع المشاهدة', type: 'ch', items: rec.slice(0, 20) });
    var fv = L.favs(); if (fv.length) rows.push({ id: 'fav', n: 'المفضلة', type: 'ch', items: fv.slice(0, 30) });
    var gs = {}; vodAll().forEach(function (c) { var g = c.c; (gs[g] = gs[g] || []).push(c); });
    var names = {}; v.mc.concat(v.sc).forEach(function (o) { names[o.id] = o.n; });
    var gk = Object.keys(gs).sort(function (a, b) { return gs[b].length - gs[a].length; });
    if (gk.length) rows.push({ id: 'cats', n: 'التصنيفات', type: 'tiles', items: gk.slice(0, 14).map(function (g) { return { n: names[g] || 'تصنيف', cnt: gs[g].length, img: (gs[g].filter(function (c) { return c.img; })[0] || {}).img, g: g }; }) });
    [['iq', 'قنوات عراقية'], ['news', 'أخبار'], ['sport', 'رياضة'], ['movies', 'أفلام ومسلسلات'], ['ent', 'منوعات وترفيه'], ['kids', 'أطفال'], ['docs', 'وثائقية'], ['quran', 'قرآن ومرجعيات']].forEach(function (g) {
      var l = all.filter(function (c) { return (g[0] === 'iq' ? c.c === 'iq' : c.g === g[0]); }); if (l.length >= 2) rows.push({ id: 'c:' + g[0], n: g[1], type: 'ch', items: l.slice(0, 40) });
    });
    gk.slice(0, 5).forEach(function (g) { var l = gs[g].filter(function (c) { return c.img; }).slice(0, 30); if (l.length >= 4) rows.push({ id: 'v:' + g, n: names[g] || 'تصنيف', type: 'vm', items: l }); });
    st.allRows = rows.map(function (r) { return { id: r.id, n: r.n }; });
    var ord = ui.rows.ord || [], ix = function (id) { var i = ord.indexOf(id); return i < 0 ? 1e6 : i; };
    st.rows = rows.filter(function (r) { return ui.rows.hid.indexOf(r.id) < 0; }).map(function (r, i) { return [r, i]; }).sort(function (a, b) { return ix(a[0].id) - ix(b[0].id) || a[1] - b[1]; }).map(function (p) { return p[0]; });
  }
  function libRows() {
    var rows = [], fv = L.favs(), vf = V.favs(), rec = L.recents();
    if (vf.length) rows.push({ id: 'lv', n: 'أفلامي ومسلسلاتي المفضلة', type: 'vm', items: vf });
    if (fv.length) rows.push({ id: 'lf', n: 'قنواتي المفضلة', type: 'ch', items: fv });
    if (rec.length) rows.push({ id: 'lr', n: 'آخر ما شاهدت', type: 'ch', items: rec });
    st.rows = rows;
  }

  /* ------------------------------------------------------------ drawing */
  function applyLook() {
    var t = themeOf(), m = $('homeModal'), a = ui.accent || t.rz;
    m.setAttribute('data-th', t.id); m.setAttribute('data-hero', t.hero); m.setAttribute('data-nav', t.nav); m.setAttribute('data-top', t.top); m.setAttribute('data-fx', t.fx);
    m.setAttribute('data-size', ui.size); m.setAttribute('data-anim', ui.anim === 'off' ? 'off' : 'on'); m.setAttribute('data-bg', ui.bg || 'theme');
    if (t.id === 'launcher' && !ui.accent) { m.style.removeProperty('--hz'); m.style.removeProperty('--hzrgb'); m.setAttribute('data-follow', '1'); return; }
    m.removeAttribute('data-follow');
    a = a || '#FA0023'; var h = a.replace('#', ''); m.style.setProperty('--hz', a); m.style.setProperty('--hzrgb', parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16));
  }
  function topBar() {
    var nav = ui.nav.map(function (id, i) { return '<div class="hm-pill' + (st.page === id ? ' on' : '') + '" data-z="nav" data-i="' + i + '">' + NAVD[id] + '</div>'; }).join('');
    var n = ui.nav.length;
    return '<div id="hmTop"><div class="hm-brand"><svg viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="13" rx="3"/><path d="M8 3l4 4 4-4"/><circle cx="12" cy="13.5" r="1.6" fill="#fff" stroke="none"/><path d="M15.2 10.3a4.5 4.5 0 0 1 0 6.4M8.8 10.3a4.5 4.5 0 0 0 0 6.4"/></svg><b>' + esc(ui.app || 'قنواتي') + '</b></div>' +
      '<div class="hm-nav">' + nav + '</div>' +
      '<div class="hm-tools"><div class="hm-ic" data-z="nav" data-i="' + n + '" title="تخصيص">⚙</div><div class="hm-hi"><span>' + esc(greetTxt()) + '</span><i class="hm-av">' + AVS[ui.av || 0] + '</i></div></div></div>';
  }
  function greetTxt() { var h = new Date().getHours(), g = h >= 4 && h < 12 ? 'صباح الخير' : h >= 12 && h < 17 ? 'طاب يومك' : h >= 17 && h < 20 ? 'مساء الخير' : 'ليلة طيبة'; return g + (ui.pname ? '، ' + ui.pname : ''); }
  function heroHtml() {
    var it = st.pool[st.hero];
    if (!it) return '<div class="hm-hero empty"><div class="hm-hin"><h2>جاري تجهيز المحتوى…</h2></div></div>';
    var u = esc(logoOf(it)), sug = [];
    for (var k = 1; k <= 4; k++) { var s = st.pool[(st.hero + k) % st.pool.length]; if (s && s !== it) sug.push(s); }
    return '<div class="hm-hero"><div class="hm-hbg" style="background-image:url(\'' + u + '\')"></div><div class="hm-hsh"></div>' +
      '<div class="hm-hin"><span class="hm-bd">الأكثر رواجاً ' + ar0(st.hero + 1) + '</span><h2>' + esc(it.n) + '</h2><div class="hm-meta"><span>' + kindOf(it) + '</span>' + (it.rt > 0 ? '<span class="rt">★ ' + ar0(Number(it.rt).toFixed(1)) + '</span>' : '') + (it.s ? '<span>' + esc(it.s) + '</span>' : '') + '</div>' +
      '<div class="hm-btns"><div class="hm-btn pri" data-z="hero" data-i="0">▶ شاهد الآن</div><div class="hm-btn" data-z="hero" data-i="1">＋ قائمتي</div><div class="hm-btn" data-z="hero" data-i="2">⤮ عشوائي</div></div></div>' +
      '<div class="hm-dots">' + st.pool.map(function (x, i) { return '<i' + (i === st.hero ? ' class="on"' : '') + '></i>'; }).join('') + '</div></div>' +
      '<div class="hm-sug"><h3>مقترح لك اليوم</h3>' + sug.map(function (s, i) { return '<div class="hm-sg" data-z="sug" data-i="' + i + '">' + art(s, true) + '<div><b>' + esc(s.n) + '</b><small>' + kindOf(s) + '</small></div></div>'; }).join('') + '</div>';
  }
  function cardHtml(r, it, i) {
    var d = ' data-z="row" data-r="' + r + '" data-c="' + i + '"';
    if (it.cnt != null) return '<div class="hm-tile"' + d + ' style="background-image:linear-gradient(135deg,hsla(' + hue(it.n) + ',70%,32%,.95),rgba(0,0,0,.85))' + (it.img ? ',url(\'' + esc(it.img) + '\')' : '') + '"><b>' + esc(it.n) + '</b><small>' + ar0(it.cnt) + '</small></div>';
    return '';
  }
  function rowsHtml() {
    var h = '';
    st.rows.forEach(function (rw, r) {
      var inner = rw.items.map(function (it, i) {
        var d = ' data-z="row" data-r="' + r + '" data-c="' + i + '"';
        if (rw.type === 'tiles') return cardHtml(r, it, i);
        if (rw.type === 'top') return '<div class="hm-t10"' + d + '><span class="nm">' + ar0(i + 1) + '</span>' + art(it, false) + '</div>';
        if (rw.type === 'vm') return '<div class="hm-card"' + d + '>' + art(it, false) + '<b>' + esc(it.n) + '</b></div>';
        return '<div class="hm-ch"' + d + '>' + art(it, true) + '<b>' + esc(it.n) + '</b></div>';
      }).join('');
      h += '<section class="hm-row" data-row="' + r + '"><h3>' + esc(rw.n) + '</h3><div class="hm-track ' + rw.type + '">' + inner + '</div></section>';
    });
    return h;
  }
  function draw() {
    var m = $('homeModal'); applyLook();
    if (st.page === 'set') return drawSet();
    if (st.page === 'lib') libRows(); else buildRows();
    var body = (st.page === 'home' ? heroHtml() : '<div class="hm-ph">' + (st.page === 'lib' ? 'مكتبتي' : '') + '</div>') + (st.rows.length ? rowsHtml() : '<div class="hm-empty">' + (st.page === 'lib' ? 'ماكو شي بمكتبتك بعد. افتح أي قناة وضيفها للمفضلة.' : 'جاري التحميل…') + '</div>');
    $('hmMain').innerHTML = topBar() + '<div id="hmBody">' + body + '</div>';
    restart(); focusFix(); paint();
  }
  function restart() { var b = $('hmBody'); if (!b) return; b.classList.remove('fresh'); void b.offsetWidth; b.classList.add('fresh'); }
  var SETS = [
    ['theme', 'الثيم', function () { return themeOf().n; }], ['accent', 'اللون الرئيسي', function () { return ui.accent || 'حسب الثيم'; }], ['bg', 'الخلفية', function () { return label(BGS, ui.bg || 'theme'); }],
    ['size', 'حجم البطاقات', function () { return label(SIZES, ui.size); }], ['anim', 'الحركات', function () { return ui.anim === 'off' ? 'أقل (للأجهزة الضعيفة)' : 'كاملة'; }],
    ['app', 'اسم التطبيق', function () { return ui.app || 'قنواتي'; }], ['pname', 'اسم الملف الشخصي', function () { return ui.pname || 'غير محدد'; }], ['av', 'صورة الملف الشخصي', function () { return AVS[ui.av || 0]; }]
  ];
  function label(l, v) { for (var i = 0; i < l.length; i++) if (l[i][0] === v) return l[i][1]; return v; }
  function setRows() {
    var rows = SETS.map(function (s) { return { k: s[0], n: s[1], v: s[2]() }; });
    NAVORD.forEach(function (id) { rows.push({ k: 'nav:' + id, n: 'شريط التنقل · ' + NAVD[id], v: ui.nav.indexOf(id) >= 0 ? 'ظاهر' : 'مخفي' }); });
    buildRows(); var ids = st.allRows || [];
    ids.forEach(function (r) { rows.push({ k: 'row:' + r.id, n: 'صف · ' + r.n, v: ui.rows.hid.indexOf(r.id) >= 0 ? 'مخفي' : 'ظاهر', mv: 1 }); });
    rows.push({ k: 'reset', n: 'إعادة ضبط كل التخصيصات', v: '' });
    st.sets = rows; return rows;
  }
  function drawSet() {
    var rows = setRows(), h = '<div class="hm-sets"><h2>تخصيص ' + esc(ui.app || 'قنواتي') + '</h2><p>فوق/تحت للتنقل · OK أو يمين/يسار لتغيير القيمة · على الصفوف: يمين/يسار يحرّك الصف</p>';
    h += rows.map(function (r, i) { return '<div class="hm-set" data-z="set" data-i="' + i + '"><b>' + esc(r.n) + '</b><span>' + esc(r.v) + '</span></div>'; }).join('') + '</div>';
    $('hmMain').innerHTML = topBar() + '<div id="hmBody">' + h + '</div><input id="hmIn" type="text" maxlength="24" autocomplete="off">';
    $('hmBody').scrollTop = 0; restart(); paint();
  }
  /* the focus ring and the scrolling are done here, without rebuilding the page */
  function el() {
    var q = '[data-z="' + st.z + '"]';
    if (st.z === 'nav') q += '[data-i="' + st.n + '"]'; else if (st.z === 'hero' || st.z === 'sug') q += '[data-i="' + (st.z === 'hero' ? st.h : st.s) + '"]'; else if (st.z === 'set') q += '[data-i="' + st.si + '"]'; else q += '[data-r="' + st.r + '"][data-c="' + st.c + '"]';
    return $('homeModal').querySelector(q);
  }
  function paint() {
    var o = $('homeModal').querySelector('.hm-f'); if (o) o.classList.remove('hm-f');
    var e = el(); if (!e) return; e.classList.add('hm-f');
    var body = $('hmBody');
    if (st.z === 'row' || st.z === 'set') {
      var sec = e.closest('.hm-row') || e, top = sec.offsetTop - 150; body.scrollTop = Math.max(0, top);
      var tr = e.parentNode; if (st.z === 'row' && tr) {
        var r = e.getBoundingClientRect(), w = tr.getBoundingClientRect();
        if (r.left < w.left + 40) tr.scrollLeft += r.left - (w.left + 40); else if (r.right > w.right - 40) tr.scrollLeft += r.right - (w.right - 40);
      }
    } else body.scrollTop = 0;
  }
  function focusFix() {
    if (st.z === 'row' && !st.rows[st.r]) st.z = st.page === 'home' ? 'hero' : 'nav';
    if (st.z === 'hero' && st.page !== 'home') st.z = 'nav';
  }

  /* ------------------------------------------------------------ actions */
  function playItem(it) {
    if (!it) return;
    if (it.t) { V.go(it); return; }
    var list = []; st.rows.forEach(function (r) { if (r.type === 'ch' || r.type === 'top') r.items.forEach(function (c) { if (!c.t && c.u) list.push(c); }); });
    var all = L.channels(), k = -1; for (var i = 0; i < all.length; i++) if (all[i].u === it.u && all[i].n === it.n) { k = i; break; }
    if (k >= 0) L.playList(all, k, 'كل القنوات'); else L.playList([it], 0, 'قناة');
  }
  function goPage(id) {
    if (id === 'live') { st.from = true; $('homeModal').classList.remove('on'); L._open(); return; }
    if (id === 'movies' || id === 'series') { st.from = true; $('homeModal').classList.remove('on'); V.openCategory(id === 'movies' ? 0 : 1, /^$/); return; }
    if (id === 'search') { st.from = true; $('homeModal').classList.remove('on'); L._open(); setTimeout(function () { L.search(''); }, 50); return; }
    st.page = id; st.z = 'nav'; st.r = 0; st.c = 0; draw();
  }
  function setAct(k, d) {
    var r = st.sets[st.si]; if (!r) return;
    var key = r.k, cyc = function (list, cur) { var i = 0; list.forEach(function (x, j) { if ((x[0] || x) === cur) i = j; }); return list[(i + d + list.length) % list.length]; };
    if (key === 'theme') { ui.theme = cyc(THEMES.map(function (t) { return [t.id]; }), ui.theme)[0]; delete ui.accent; }
    else if (key === 'accent') { var cur = ui.accent || ''; var arr = [''].concat(ACC); var i = arr.indexOf(cur); i = (i + d + arr.length) % arr.length; if (arr[i]) ui.accent = arr[i]; else delete ui.accent; }
    else if (key === 'bg') ui.bg = cyc(BGS, ui.bg || 'theme')[0];
    else if (key === 'size') ui.size = cyc(SIZES, ui.size)[0];
    else if (key === 'anim') ui.anim = ui.anim === 'off' ? 'on' : 'off';
    else if (key === 'av') ui.av = ((ui.av || 0) + d + AVS.length) % AVS.length;
    else if (key === 'app' || key === 'pname') { startInput(key); return; }
    else if (key.indexOf('nav:') === 0) {
      var id = key.slice(4), i2 = ui.nav.indexOf(id);
      if (i2 >= 0) { if (ui.nav.length <= 3) { toast('أقل شي ٣ أيقونات'); return; } ui.nav.splice(i2, 1); } else { if (ui.nav.length >= 5) { toast('أكثر شي ٥ أيقونات'); return; } ui.nav.push(id); ui.nav.sort(function (a, b) { return NAVORD.indexOf(a) - NAVORD.indexOf(b); }); }
    } else if (key.indexOf('row:') === 0) {
      var rid = key.slice(4);
      if (k === 'ok') { var hi = ui.rows.hid.indexOf(rid); if (hi >= 0) ui.rows.hid.splice(hi, 1); else ui.rows.hid.push(rid); }
      else { var ord = (ui.rows.ord || []).slice(); st.allRows.forEach(function (x) { if (ord.indexOf(x.id) < 0) ord.push(x.id); }); var p = ord.indexOf(rid), q = p + (d > 0 ? 1 : -1); if (q >= 0 && q < ord.length) { var t = ord[p]; ord[p] = ord[q]; ord[q] = t; ui.rows.ord = ord; st.si = Math.max(0, st.si + (d > 0 ? 1 : -1)); } }
    } else if (key === 'reset') { ui = { theme: 'cinema', nav: ['home', 'live', 'movies', 'series', 'lib'], size: 'm', rows: { ord: [], hid: [] } }; toast('انرجعت التخصيصات'); }
    saveUi(); applyLook(); drawSet();
  }
  function startInput(key) {
    var b = $('hmIn'); st.input = key; b.value = key === 'app' ? (ui.app || 'قنواتي') : (ui.pname || ''); b.classList.add('on'); b.focus();
  }
  function endInput(commit) {
    var b = $('hmIn'); if (!b) return; var key = st.input; st.input = null; b.blur(); b.classList.remove('on');
    if (commit) { var v = b.value.trim(); if (key === 'app') ui.app = v || 'قنواتي'; else ui.pname = v; saveUi(); }
    drawSet();
  }

  /* ------------------------------------------------------------ keys */
  function heroTimer() {
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(function () {
      if (!$('homeModal').classList.contains('on') || st.page !== 'home' || st.z === 'sug' || !st.pool.length) return;
      st.hero = (st.hero + 1) % st.pool.length; var keep = st.z; var b = $('hmBody'), top = b ? b.scrollTop : 0; draw(); if (keep === st.z) { var nb = $('hmBody'); if (nb) nb.scrollTop = top; }
    }, 9000);
  }
  function key(k) {
    if (st.input) { if (k === 'back') endInput(false); else if (k === 'ok' || k === 'Enter' || k === 'ArrowDown') endInput(true); return; }
    if (k === 'back') {
      if (st.page !== 'home') { st.page = 'home'; st.z = 'nav'; draw(); return; }
      close(); return;
    }
    var pages = ui.nav, nTools = 1, navN = pages.length + nTools;
    if (st.z === 'nav') {
      if (k === 'ArrowRight') st.n = Math.max(0, st.n - 1); else if (k === 'ArrowLeft') st.n = Math.min(navN - 1, st.n + 1);
      else if (k === 'ArrowDown') { st.z = st.page === 'home' ? 'hero' : st.page === 'set' ? 'set' : 'row'; st.r = 0; st.c = 0; st.h = 0; focusFix(); if (st.page === 'set') st.si = 0; }
      else if (k === 'ok') { if (st.n < pages.length) goPage(pages[st.n]); else goPage('set'); return; }
      paint(); return;
    }
    if (st.z === 'set') {
      var N = st.sets.length;
      if (k === 'ArrowDown') st.si = Math.min(N - 1, st.si + 1); else if (k === 'ArrowUp') { if (st.si === 0) st.z = 'nav'; else st.si--; }
      else if (k === 'ok') { setAct('ok', 1); return; } else if (k === 'ArrowLeft') { setAct('l', 1); return; } else if (k === 'ArrowRight') { setAct('r', -1); return; }
      paint(); return;
    }
    if (st.z === 'hero') {
      if (k === 'ArrowRight') st.h = Math.max(0, st.h - 1); else if (k === 'ArrowLeft') { if (st.h < 2) st.h++; else { st.z = 'sug'; st.s = 0; } }
      else if (k === 'ArrowUp') st.z = 'nav'; else if (k === 'ArrowDown') { if (st.rows.length) { st.z = 'row'; st.r = 0; st.c = 0; } }
      else if (k === 'ok') {
        var it = st.pool[st.hero];
        if (st.h === 0) playItem(it);
        else if (st.h === 1) { if (it) { var on = it.t ? V.toggleFav(it) : L.toggleFav(it); toast(on ? 'انضاف لقائمتك' : 'انشال من قائمتك'); } }
        else { var all = vodAll().length ? vodAll() : L.channels(); if (all.length) playItem(all[Math.floor(Math.random() * all.length)]); }
        return;
      }
      paint(); return;
    }
    if (st.z === 'sug') {
      if (k === 'ArrowDown') { if (st.s < 3 && st.pool.length > st.s + 2) st.s++; else if (st.rows.length) { st.z = 'row'; st.r = 0; st.c = 0; } }
      else if (k === 'ArrowUp') { if (st.s === 0) st.z = 'nav'; else st.s--; } else if (k === 'ArrowRight') { st.z = 'hero'; st.h = 2; }
      else if (k === 'ok') { var s2 = st.pool[(st.hero + st.s + 1) % st.pool.length]; playItem(s2); return; }
      paint(); return;
    }
    /* rows */
    var rw = st.rows[st.r]; if (!rw) { st.z = 'nav'; paint(); return; }
    if (k === 'ArrowRight') st.c = Math.max(0, st.c - 1); else if (k === 'ArrowLeft') st.c = Math.min(rw.items.length - 1, st.c + 1);
    else if (k === 'ArrowDown') { if (st.r < st.rows.length - 1) { st.r++; st.c = Math.min(st.c, st.rows[st.r].items.length - 1); } }
    else if (k === 'ArrowUp') { if (st.r > 0) { st.r--; st.c = Math.min(st.c, st.rows[st.r].items.length - 1); } else st.z = st.page === 'home' ? 'hero' : 'nav'; }
    else if (k === 'ok') {
      var item = rw.items[st.c];
      if (rw.type === 'tiles') { $('homeModal').classList.remove('on'); st.from = true; V.openCategory(vodData().m.some(function (x) { return x.c === item.g; }) ? 0 : 1, new RegExp('^' + String(item.n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')); return; }
      playItem(item); return;
    }
    paint();
  }

  /* ------------------------------------------------------------ open / close */
  function open() {
    ui = U(); st.page = 'home'; st.z = 'hero'; st.h = 0; st.r = 0; st.c = 0; st.n = 0; st.from = false; buildPool();
    $('homeModal').classList.add('on'); if (window.__setLayer) window.__setLayer('home');
    try { V.prefetch(); L.prefetch(); } catch (e) {}
    draw(); heroTimer();
    var tries = 0, sig = vodAll().length, w = setInterval(function () {
      if (!$('homeModal').classList.contains('on') || ++tries > 12) { clearInterval(w); return; }
      var n = vodAll().length; if (n !== sig && st.page === 'home' && st.z !== 'set') { sig = n; buildPool(); draw(); }
    }, 1500);
  }
  function close() { if (st.timer) { clearInterval(st.timer); st.timer = null; } $('homeModal').classList.remove('on'); if (window.__closeHome) window.__closeHome(); }
  /* the grid or the films browser was closed: come back here if that is where the user came from */
  function back() { if (st.from) { st.from = false; ui = U(); $('homeModal').classList.add('on'); if (window.__setLayer) window.__setLayer('home'); draw(); heroTimer(); } }

  window.__closeHome = function () { if (window.__setLayer) window.__setLayer('main'); if (window.__refreshBadges) window.__refreshBadges(); };
  window.Home = { open: open, key: key, back: back };
  L.open = open;
})();
