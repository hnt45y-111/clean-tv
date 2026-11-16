/* تطبيق الأفلام والمسلسلات: movies, series, entertainment and cooking from FREE and LICENSED sources only:
   the Internet Archive's public-domain collections, the official links the user adds (YouTube, direct files), and the user's own IPTV account.
   Nothing here reads from pirate sites. The name of the app is the user's (settings.vodName). ES5 on purpose (old TV WebViews). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DEFAULTS = [
    { id: 'foreign', n: 'أفلام أجنبية', ia: 'collection:feature_films', hint: '' },
    { id: 'arabic', n: 'أفلام عربية', ia: '', hint: 'ماكو مصدر مجاني ومرخّص جاهز للأفلام العربية. أضف روابطك الرسمية من تطبيق مدير الشاشة ← تطبيق الأفلام والمسلسلات' },
    { id: 'series', n: 'مسلسلات', ia: 'collection:classic_tv', hint: '' },
    { id: 'fun', n: 'ترفيه', ia: 'collection:animationandcartoons', hint: '' },
    { id: 'cook', n: 'طبخ', ia: '', hint: 'أضف قوائم تشغيل رسمية لبرامج الطبخ من تطبيق مدير الشاشة ← تطبيق الأفلام والمسلسلات' }
  ];
  var COLS = 5, TTL = 12 * 3600000;
  var st = { f: 'sec', si: 0, gi: 0, secs: [], items: [], sub: null, msg: '', off: 0, busy: false };
  function S() { return (window.__getSettings && window.__getSettings()) || {}; }
  function appName() { return String(S().vodName || '').trim() || 'الأفلام والمسلسلات'; }
  function get(u) { return window.__fetchText ? window.__fetchText(u) : Promise.resolve('ERR:no'); }
  function cacheGet(k, ttl) { try { var c = JSON.parse(localStorage.getItem(k) || 'null'); if (c && Date.now() - c.t < (ttl || TTL)) return c.v; } catch (e) {} return null; }
  function cacheSet(k, v) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} }

  /* ---------------------------------------------------------------- the user's links: «اسم | رابط», one per line */
  function isYT(u) { return /(youtube\.com|youtu\.be)\//i.test(u); }
  function ytTitles() { try { return JSON.parse(localStorage.getItem('vodYt') || '{}') || {}; } catch (e) { return {}; } }
  function parseLinks(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (l) {
      l = l.trim(); if (!l) return;
      var nm = '', u = l, k = l.indexOf('|');
      if (k > 0 && /^https?:/i.test(l.slice(k + 1).trim())) { nm = l.slice(0, k).trim(); u = l.slice(k + 1).trim(); }
      if (!/^https?:\/\//i.test(u)) return;
      var ia = u.match(/archive\.org\/details\/([^\/?#]+)/i);
      if (ia) { out.push({ t: 'ia', id: ia[1], n: nm || ia[1] }); return; }
      if (isYT(u)) { out.push({ t: 'yt', u: u, n: nm || ytTitles()[u] || 'يوتيوب' }); return; }
      if (/\.(mp4|m3u8|mkv|webm|ts|mov|avi)(\?|$)/i.test(u)) { out.push({ t: 'url', u: u, n: nm || decodeURIComponent(u.replace(/[?#].*$/, '').split('/').pop()).replace(/\.[a-z0-9]+$/i, '') }); }
    });
    return out;
  }
  function fillYtTitles(items, done) {
    var T = ytTitles(), need = items.filter(function (i) { return i.t === 'yt' && !T[i.u] && i.n === 'يوتيوب'; }).slice(0, 12);
    if (!need.length) return done();
    var left = need.length;
    need.forEach(function (i) {
      get('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(i.u)).then(function (t) {
        try { var j = JSON.parse(t); if (j && j.title) { T[i.u] = j.title; i.n = j.title; } } catch (e) {}
      }, function () {}).then(function () { if (--left === 0) { try { localStorage.setItem('vodYt', JSON.stringify(T)); } catch (e) {} done(); } });
    });
  }

  /* ---------------------------------------------------------------- the Internet Archive: public-domain films, series and cartoons */
  function iaQuery(q) { return 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('(' + q + ') AND mediatype:movies') + '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&sort%5B%5D=downloads+desc&rows=60&page=1&output=json'; }
  function iaItems(q, cb) {
    var c = cacheGet('vodIa:' + q); if (c) return cb(c, '');
    get(iaQuery(q)).then(function (t) {
      var docs = null; try { docs = JSON.parse(t).response.docs; } catch (e) {}
      if (!docs) return cb([], 'تعذّر جلب القائمة، تأكد من الإنترنت');
      var items = docs.map(function (d) { return { t: 'ia', id: d.identifier, n: Array.isArray(d.title) ? d.title[0] : (d.title || d.identifier), y: d.year || '' }; });
      cacheSet('vodIa:' + q, items); cb(items, '');
    }, function () { cb([], 'تعذّر جلب القائمة، تأكد من الإنترنت'); });
  }
  /* the best file of an item: a plain MP4 the native player can stream */
  function pickFile(files) {
    var best = null, rank = function (f) { var n = String(f.name || '').toLowerCase(), fm = String(f.format || '').toLowerCase(); if (!/\.mp4$/.test(n)) return -1; return (fm === 'h.264' ? 3 : fm === 'mpeg4' ? 2 : 1) * 1e12 - (+f.size || 0); };
    (files || []).forEach(function (f) { var r = rank(f); if (r >= 0 && (!best || r > best.r)) best = { f: f, r: r }; });
    return best && best.f;
  }

  /* ---------------------------------------------------------------- the user's own IPTV account: its films and series */
  function xt() { var x = S().xtream; if (!x || !x.host || !x.user || !x.pass || x.vod === false) return null; var h = String(x.host).trim(); if (!/^https?:\/\//i.test(h)) h = 'http://' + h; h = h.replace(/^(https?:\/\/[^\/?#]+).*$/i, '$1'); try { var kb = localStorage.getItem('xtBase|' + h); if (kb) h = kb; } catch (e) {} return { host: h, host0: String(x.host).trim(), user: String(x.user).trim(), pass: String(x.pass).trim() }; }
  function xtApi(x, a, extra) { return x.host + '/player_api.php?username=' + encodeURIComponent(x.user) + '&password=' + encodeURIComponent(x.pass) + '&action=' + a + (extra || ''); }
  var xtErr = '';
  function xtJson(x, a, extra) { return (window.__xtFetch ? window.__xtFetch(x, xtApi(x, a, extra).slice(x.host.length)) : get(xtApi(x, a, extra))).then(function (t) { if (String(t).indexOf('ERR:') === 0) xtErr = String(t).slice(4); try { return JSON.parse(t); } catch (e) { return null; } }); }
  function xtUa(x) { try { return (window.Android && window.Android.getPref && window.Android.getPref('uaOk|' + x.host.replace(/^https?:\/\//i, '').replace(/[:\/].*$/, ''))) || ''; } catch (e) { return ''; } }
  function xtSections(cb) {
    var x = xt(); if (!x) return cb([]);
    var key = 'vodXt:' + x.host + '|' + x.user, c = cacheGet(key, 6 * 3600000); if (c) return cb(c);
    Promise.all([xtJson(x, 'get_vod_categories'), xtJson(x, 'get_vod_streams'), xtJson(x, 'get_series_categories'), xtJson(x, 'get_series')]).then(function (r) {
      var out = [];
      function build(cats, list, kind, label, mk) {
        var by = {}, names = {}; (cats || []).forEach(function (o) { names[o.category_id] = o.category_name; });
        (list || []).forEach(function (o) { (by[o.category_id] = by[o.category_id] || []).push(mk(o)); });
        Object.keys(by).slice(0, 40).forEach(function (id) { out.push({ id: kind + id, n: label + ' · ' + (names[id] || id), items: by[id].slice(0, 300), hint: '' }); });
      }
      build(r[0], r[1], 'xm', '🎬 حسابي', function (o) { return { t: 'xm', n: o.name, id: o.stream_id, ext: o.container_extension || 'mp4', img: o.stream_icon || '' }; });
      build(r[2], r[3], 'xs', '📺 حسابي', function (o) { return { t: 'xs', n: o.name, id: o.series_id, img: o.cover || '' }; });
      if (out.length) cacheSet(key, out);
      else out.push({ id: 'xerr', n: '⚠️ حسابي IPTV', items: null, ia: '', links: '', hint: 'تعذّر جلب أفلام ومسلسلات الحساب' + (xtErr ? ' (' + xtErr + ')' : '') + '. تأكد من الرابط والمنفذ والمستخدم وكلمة المرور وأن الاشتراك فعّال، ثم اضغط «تحديث القائمة»' });
      cb(out);
    }, function () { cb([]); });
  }

  /* ---------------------------------------------------------------- the sections */
  function baseSections() {
    var cu = S().vodSections;
    var l = (cu && cu.length ? cu : DEFAULTS).map(function (x) { return { id: x.id, n: x.n, ia: x.ia || '', links: x.links || '', hint: x.hint || '' }; });
    /* a section the user did not touch keeps its hint */
    return l;
  }
  function loadSection(sec, cb) {
    if (sec.items) return cb(sec.items, '');
    var items = parseLinks(sec.links), done = function (ia, err) {
      var all = items.concat(ia);
      fillYtTitles(all, function () { cb(all, all.length ? '' : (err || sec.hint || 'القسم فاضي. أضف روابطك الرسمية من تطبيق مدير الشاشة')); });
    };
    if (sec.ia) iaItems(sec.ia, done); else done([], '');
  }
  var REFRESH = { id: '__refresh', n: '🔄 تحديث القائمة', hint: 'اضغط OK لتحديث الأفلام والمسلسلات من المصادر ومن حساب IPTV' };
  function refresh() {
    try { var del = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && (k.indexOf('vodXt:') === 0 || k.indexOf('vodIa:') === 0)) del.push(k); } del.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    xtErr = ''; st.si = 0; if (window.toastMsg) window.toastMsg('جاري تحديث القائمة…'); load();
  }
  function load() {
    st.secs = baseSections().concat([REFRESH]); st.si = clampI(st.si, st.secs.length); st.items = []; st.msg = 'جاري التحميل…'; draw();
    xtSections(function (xs) { st.secs = baseSections().concat(xs, [REFRESH]); drawSecs(); });
    select(st.si);
  }
  function clampI(i, n) { return Math.max(0, Math.min(Math.max(0, n - 1), i)); }
  var tok = 0;
  function select(i) {
    st.si = i; st.gi = 0; st.off = 0; st.sub = null; st.items = []; st.msg = 'جاري التحميل…'; var mine = ++tok, sec = st.secs[i]; draw();
    if (!sec) return;
    if (sec.id === '__refresh') { st.msg = sec.hint; return draw(); }
    loadSection(sec, function (items, err) { if (mine !== tok) return; st.items = items; st.msg = items.length ? '' : (err || sec.hint || 'القسم فاضي'); draw(); });
  }

  /* ---------------------------------------------------------------- playing */
  function toPlayer(list, title) {
    if (!window.Android || !window.Android.playLive) { if (window.toastMsg) window.toastMsg('التشغيل يحتاج الشاشة نفسها'); return; }
    window.Android.playLive(JSON.stringify({ vod: 1, list: list, folders: [], fold: 0 }), 0);
  }
  function play(it) {
    if (it.t === 'yt') return toPlayer([{ n: it.n, u: it.u, yt: true }]);
    if (it.t === 'url') return toPlayer([{ n: it.n, u: it.u }]);
    var x = xt();
    if (it.t === 'xm' && x) return toPlayer([{ n: it.n, ua: xtUa(x), u: x.host + '/movie/' + encodeURIComponent(x.user) + '/' + encodeURIComponent(x.pass) + '/' + it.id + '.' + it.ext }]);
    if (it.t === 'xs' && x) {
      st.msg = 'جاري تحميل الحلقات…'; draw();
      return xtJson(x, 'get_series_info', '&series_id=' + it.id).then(function (j) {
        var eps = [], seasons = (j && j.episodes) || {};
        Object.keys(seasons).sort(function (a, b) { return a - b; }).forEach(function (sn) { (seasons[sn] || []).forEach(function (e) { eps.push({ t: 'xe', ua: xtUa(x), n: 'الموسم ' + sn + ' · الحلقة ' + (e.episode_num || '') + (e.title ? ' · ' + e.title : ''), u: x.host + '/series/' + encodeURIComponent(x.user) + '/' + encodeURIComponent(x.pass) + '/' + e.id + '.' + (e.container_extension || 'mp4') }); }); });
        st.msg = eps.length ? '' : 'ماكو حلقات لهذا المسلسل'; st.sub = { back: { items: st.items, gi: st.gi }, title: it.n }; st.items = eps; st.gi = 0; st.off = 0; draw();
      }, function () { st.msg = 'تعذّر جلب الحلقات'; draw(); });
    }
    if (it.t === 'xe') return toPlayer([{ n: it.n, u: it.u, ua: it.ua || '' }]);
    if (it.t === 'ia') {
      if (window.toastMsg) window.toastMsg('جاري تجهيز الفيلم…');
      return get('https://archive.org/metadata/' + encodeURIComponent(it.id)).then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        var f = j && pickFile(j.files);
        if (!f) { if (window.toastMsg) window.toastMsg('ما لقيت ملف يشتغل لهذا العنصر'); return; }
        toPlayer([{ n: it.n, u: 'https://archive.org/download/' + encodeURIComponent(it.id) + '/' + encodeURIComponent(f.name) }]);
      }, function () { if (window.toastMsg) window.toastMsg('تعذّر الاتصال بالإنترنت'); });
    }
  }

  /* ---------------------------------------------------------------- the screen */
  function poster(it) {
    var img = it.img || (it.t === 'ia' ? 'https://archive.org/services/img/' + encodeURIComponent(it.id) : '');
    return img ? '<img class="vd-img" loading="lazy" decoding="async" src="' + esc(img) + '" alt="" onerror="this.parentNode.removeChild(this)">' : '';
  }
  function drawSecs() {
    var h = '', from = Math.max(0, Math.min(st.si - 3, st.secs.length - 8));
    for (var i = from; i < Math.min(st.secs.length, from + 8); i++) h += '<div class="vd-sec' + (i === st.si ? ' on' : '') + (st.f === 'sec' && i === st.si ? ' focus' : '') + '">' + esc(st.secs[i].n) + '</div>';
    $('vdSecs').innerHTML = h;
  }
  function draw() {
    if (!$('vodModal')) return;
    $('vdTitle').textContent = appName();
    $('vdSub').textContent = st.sub ? st.sub.title : (st.secs[st.si] ? st.secs[st.si].n : '');
    drawSecs();
    var g = $('vdGrid');
    if (st.msg && !st.items.length) g.innerHTML = '<div class="vd-empty">' + esc(st.msg) + '</div>';
    else g.innerHTML = st.items.map(function (it, i) {
      return '<div class="vd-card' + (st.f === 'grid' && i === st.gi ? ' focus' : '') + '"><div class="vd-art"><b>' + esc(String(it.n).replace(/^ال/, '').slice(0, 2)) + '</b>' + poster(it) + '</div><div class="vd-n">' + esc(it.n) + '</div>' + (it.y ? '<div class="vd-y">' + esc(it.y) + '</div>' : '') + '</div>';
    }).join('');
    var f = g.querySelector('.focus'), wrap = $('vdGridWrap');
    if (f && wrap) { var H = wrap.clientHeight, t = f.offsetTop, h = f.offsetHeight, o = st.off; if (t - o < 12) o = Math.max(0, t - 12); else if (t + h - o > H - 12) o = t + h - H + 12; st.off = o; } else st.off = 0;
    g.style.transform = 'translateY(' + (-st.off) + 'px)';
    $('vdCount').textContent = st.items.length ? st.items.length + ' عنصر' : '';
  }
  function key(k) {
    if (k === 'back') {
      if (st.sub) { var b = st.sub.back; st.sub = null; st.items = b.items; st.gi = b.gi; st.msg = ''; st.off = 0; return draw(); }
      if (st.f === 'grid') { st.f = 'sec'; return draw(); }
      if (window.__closeVod) window.__closeVod(); return;
    }
    if (st.f === 'sec') {
      if (k === 'ArrowUp' && st.si > 0) select(st.si - 1);
      else if (k === 'ArrowDown' && st.si < st.secs.length - 1) select(st.si + 1);
      else if (k === 'ok' && st.secs[st.si] && st.secs[st.si].id === '__refresh') refresh();
      else if ((k === 'ArrowLeft' || k === 'ok') && st.items.length) { st.f = 'grid'; draw(); }
      return;
    }
    var n = st.items.length;
    if (k === 'ArrowRight') { if (st.gi % COLS === 0) st.f = 'sec'; else st.gi--; }
    else if (k === 'ArrowLeft') { if (st.gi + 1 < n && st.gi % COLS < COLS - 1) st.gi++; }
    else if (k === 'ArrowUp') { if (st.gi - COLS >= 0) st.gi -= COLS; }
    else if (k === 'ArrowDown') { if (st.gi + COLS < n) st.gi += COLS; else if (st.gi < n - 1) st.gi = n - 1; }
    else if (k === 'ok') { if (st.items[st.gi]) play(st.items[st.gi]); return; }
    draw();
  }
  window.Vod = {
    PKG: '__vod', name: appName,
    open: function () { st.f = 'sec'; if (!st.secs.length) st.si = 0; $('vodModal').classList.add('on'); if (window.__setLayer) window.__setLayer('vod'); load(); },
    key: key,
    _t: { parseLinks: parseLinks, pickFile: pickFile, iaQuery: iaQuery, state: st, DEFAULTS: DEFAULTS, baseSections: baseSections }
  };
})();
