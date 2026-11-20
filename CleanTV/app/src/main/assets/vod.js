/* تطبيق الأفلام والمسلسلات: the films and the series of the user's own IPTV account (Xtream), and nothing else.
   The account is typed in the phone app and stays on the TV. The name of the app is the user's (settings.vodName). ES5 on purpose (old TV WebViews). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var COLS = 6, PAGE = 60, TTL = 6 * 3600000;
  var TABS = [{ id: 'm', n: '🎬 أفلام' }, { id: 's', n: '📺 مسلسلات' }, { id: 'fav', n: '⭐ المفضلة' }, { id: 'search', n: '🔎 بحث', tool: 1 }, { id: 'favm', n: '➕ إضافة للمفضلة', tool: 1 }, { id: 'cinema', n: '🎭 وضع السينما', tool: 1 }, { id: 'refresh', n: '🔄 تحديث', tool: 1 }];
  var st = { f: 'tab', tab: 0, ti: 0, ci: 0, gi: 0, off: 0, q: '', favm: false, sub: null, msg: '', list: [], cats: [], key: '' };
  var D = { k: '', m: null, s: null, err: '', busy: false };
  function S() { return (window.__getSettings && window.__getSettings()) || {}; }
  function appName() { return String(S().vodName || '').trim() || 'الأفلام والمسلسلات'; }
  function toast(t) { if (window.toastMsg) window.toastMsg(t); }

  /* ---------------------------------------------------------------- the account */
  function xt() {
    var x = S().xtream; if (!x || !x.host || !x.user || !x.pass || x.vod === false) return null;
    var h = String(x.host).trim(); if (!/^https?:\/\//i.test(h)) h = 'http://' + h; h = h.replace(/^(https?:\/\/[^\/?#]+).*$/i, '$1');
    try { var kb = localStorage.getItem('xtBase|' + h); if (kb) h = kb; } catch (e) {}
    return { host: h, host0: String(x.host).trim(), user: String(x.user).trim(), pass: String(x.pass).trim() };
  }
  function xtUa(x) { try { return (window.Android && window.Android.getPref && window.Android.getPref('uaOk|' + x.host.replace(/^https?:\/\//i, '').replace(/[:\/].*$/, ''))) || ''; } catch (e) { return ''; } }
  function q(x, a, extra) { return '/player_api.php?username=' + encodeURIComponent(x.user) + '&password=' + encodeURIComponent(x.pass) + '&action=' + a + (extra || ''); }
  function xtJson(x, a, extra) {
    var p = window.__xtFetch ? window.__xtFetch(x, q(x, a, extra)) : (window.__fetchText ? window.__fetchText(x.host + q(x, a, extra)) : Promise.resolve('ERR:no'));
    return p.then(function (t) { if (String(t).indexOf('ERR:') === 0) D.err = String(t).slice(4); try { return JSON.parse(t); } catch (e) { return null; } }, function () { return null; });
  }
  function pack(cats, list, mk) {
    var names = {}, order = [], seen = {}, items = [];
    (cats || []).forEach(function (o) { names[o.category_id] = o.category_name; });
    (list || []).forEach(function (o) { var c = String(o.category_id == null ? '' : o.category_id); if (!seen[c]) { seen[c] = 1; order.push({ id: c, n: names[c] || 'بدون تصنيف' }); } var it = mk(o); it.c = c; items.push(it); });
    return { cats: order, items: items };
  }
  function pull(force) {
    var x = xt(); if (!x) { D.m = D.s = null; D.k = ''; draw(); return Promise.resolve(); }
    var key = x.host0 + '|' + x.user;
    if (!force && D.k === key && D.m) { draw(); return Promise.resolve(); }
    if (!force) { try { var c = JSON.parse(localStorage.getItem('vodXt2') || 'null'); if (c && c.k === key && Date.now() - c.t < TTL) { D.k = key; D.m = c.m; D.s = c.s; draw(); return Promise.resolve(); } } catch (e) {} }
    if (D.busy) return D.busyP || Promise.resolve(); D.busy = true; D.err = ''; st.msg = 'جاري تحميل الأفلام والمسلسلات من حسابك…'; draw();
    return D.busyP = Promise.all([xtJson(x, 'get_vod_categories'), xtJson(x, 'get_vod_streams'), xtJson(x, 'get_series_categories'), xtJson(x, 'get_series')]).then(function (r) {
      D.busy = false; D.k = key;
      D.m = pack(r[0], r[1], function (o) { return { t: 'xm', n: String(o.name || '').trim(), id: o.stream_id, ext: o.container_extension || 'mp4', img: o.stream_icon || '' }; });
      D.s = pack(r[2], r[3], function (o) { return { t: 'xs', n: String(o.name || '').trim(), id: o.series_id, img: o.cover || '' }; });
      var n = D.m.items.length + D.s.items.length;
      if (n) { try { localStorage.setItem('vodXt2', JSON.stringify({ k: key, t: Date.now(), m: D.m, s: D.s })); } catch (e) { try { localStorage.removeItem('vodXt2'); } catch (e2) {} } }
      if (force) toast(n ? 'تم التحديث: ' + D.m.items.length + ' فيلم · ' + D.s.items.length + ' مسلسل' : 'تعذّر التحديث' + (D.err ? ': ' + D.err : ''));
      st.msg = ''; st.key = ''; draw(); D.busyP = null;
    });
  }

  /* ---------------------------------------------------------------- favourites */
  function favs() { try { return JSON.parse(localStorage.getItem('vodFav') || '[]') || []; } catch (e) { return []; } }
  function fk(it) { return it.t + ':' + it.id; }
  function toggleFav(it) {
    var l = favs(), k = fk(it), had = l.some(function (f) { return fk(f) === k; });
    l = had ? l.filter(function (f) { return fk(f) !== k; }) : [{ t: it.t, n: it.n, id: it.id, ext: it.ext, img: it.img, c: it.c }].concat(l).slice(0, 300);
    try { localStorage.setItem('vodFav', JSON.stringify(l)); } catch (e) {}
    return !had;
  }

  /* ---------------------------------------------------------------- what is on the screen */
  function compute() {
    var tab = TABS[st.tab].id, src = tab === 'm' ? D.m : tab === 's' ? D.s : null;
    if (st.sub) { st.cats = []; return; }
    if (tab === 'fav') { st.cats = []; st.list = favs(); return; }
    st.cats = src ? [{ id: '*', n: 'الكل (' + src.items.length + ')' }].concat(src.cats) : [];
    if (st.ci >= st.cats.length) st.ci = 0;
    var cid = st.cats[st.ci] ? st.cats[st.ci].id : '*', all = src ? src.items : [];
    var l = cid === '*' ? all : all.filter(function (i) { return i.c === cid; });
    if (st.q) { var w = st.q.toLowerCase(); l = all.filter(function (i) { return i.n.toLowerCase().indexOf(w) >= 0; }); }
    st.list = l;
  }
  function emptyMsg() {
    if (st.msg) return st.msg;
    if (!xt()) return 'هذا التطبيق يعرض أفلام ومسلسلات حساب IPTV مالتك فقط.\nأضف الحساب من تطبيق مدير الشاشة ← قنواتي الخاصة ← حساب IPTV';
    if (TABS[st.tab].id === 'fav') return 'ماكو شي بالمفضلة. فعّل «➕ إضافة للمفضلة» واضغط OK على أي فيلم أو مسلسل';
    if (st.q) return 'ماكو نتيجة لـ «' + st.q + '»';
    if (D.err) return 'تعذّر جلب المحتوى من الحساب (' + D.err + ')\nتأكد من بيانات الحساب ثم اضغط «🔄 تحديث»';
    return 'الحساب ما بيه محتوى بهذا القسم';
  }
  function draw() {
    if (!$('vodModal')) return;
    compute();
    $('vdTitle').textContent = appName();
    var th = ''; TABS.forEach(function (t, i) { th += '<div class="vd-tab' + (t.tool ? ' tool' : '') + ((!t.tool && i === st.tab) || (t.id === 'favm' && st.favm) || (t.id === 'search' && st.q) || (t.id === 'cinema' && cinemaOn()) ? ' on' : '') + (st.f === 'tab' && i === st.ti ? ' focus' : '') + '">' + t.n + '</div>'; });
    $('vdTabs').innerHTML = th;
    var ch = '', from = Math.max(0, Math.min(st.ci - 4, st.cats.length - 10));
    for (var i = from; i < Math.min(st.cats.length, from + 10); i++) ch += '<div class="vd-sec' + (i === st.ci ? ' on' : '') + (st.f === 'cat' && i === st.ci ? ' focus' : '') + '">' + esc(st.cats[i].n) + '</div>';
    $('vdSecs').innerHTML = ch; $('vodModal').setAttribute('data-nocat', st.cats.length ? '0' : '1');
    var n = st.list.length; if (st.gi >= n) st.gi = Math.max(0, n - 1);
    var pg = Math.floor(st.gi / PAGE), a = pg * PAGE, slice = st.list.slice(a, a + PAGE), g = $('vdGrid');
    var key = st.tab + '|' + st.ci + '|' + st.q + '|' + (st.sub ? st.sub.title : '') + '|' + pg + '|' + n + '|' + (st.favm ? 1 : 0) + '|' + (slice[0] ? slice[0].n : '');
    if (key !== st.key) {
      st.key = key; var FK = {}; favs().forEach(function (f) { FK[fk(f)] = 1; });
      g.innerHTML = n ? slice.map(function (it) {
        var img = it.img ? '<img class="vd-img" loading="lazy" decoding="async" src="' + esc(it.img) + '" alt="" onerror="this.parentNode.removeChild(this)">' : '';
        return '<div class="vd-card' + (it.t === 'xe' ? ' ep' : '') + '"><div class="vd-art"><b>' + esc(String(it.n).replace(/^ال/, '').slice(0, 2)) + '</b>' + img + (FK[fk(it)] ? '<i class="vd-star">★</i>' : '') + (it.t === 'xs' ? '<i class="vd-tag">مسلسل</i>' : '') + '</div><div class="vd-n">' + esc(it.n) + '</div></div>';
      }).join('') : '<div class="vd-empty">' + esc(emptyMsg()).replace(/\n/g, '<br>') + '</div>';
    }
    var kids = g.children, pf = g.querySelector('.focus'), want = (st.f === 'grid' && n) ? kids[st.gi - a] : null;
    if (pf && pf !== want) pf.classList.remove('focus');
    if (want && want !== pf) want.classList.add('focus');
    var wrap = $('vdGridWrap');
    if (want && wrap) { var H = wrap.clientHeight, t = want.offsetTop, h = want.offsetHeight, o = st.off; if (t - o < 12) o = Math.max(0, t - 12); else if (t + h - o > H - 12) o = t + h - H + 12; st.off = o; } else if (!want) st.off = 0;
    g.style.transform = 'translateY(' + (-st.off) + 'px)';
    $('vdSub').textContent = st.sub ? st.sub.title : st.q ? 'نتائج البحث' : '';
    $('vdCount').textContent = n ? (st.gi + 1) + ' / ' + n : '';
    $('vdHint').textContent = st.favm ? 'وضع المفضلة: OK يضيف العنصر أو يشيله · اطفيه من «➕ إضافة للمفضلة»' : 'الأسهم للتنقل · OK تشغيل · داخل الفيلم: يمين/يسار تقديم وتأخير، OK إيقاف مؤقت · رجوع للخروج';
  }

  /* ---------------------------------------------------------------- playing */
  function cinemaOn() { try { return localStorage.getItem('vodCinema') === '1'; } catch (e) { return false; } }
  /* a one-button show before a film: curtains open over a countdown, then the film starts — purely visual, nothing is skipped */
  function playCinema(go) {
    var fx = $('cinemaFx'); if (!fx) return go();
    var n = 3;
    fx.innerHTML = '<div class="cn-l"></div><div class="cn-r"></div><div class="cn-n">' + n + '</div>';
    fx.classList.add('on');
    var t = setInterval(function () {
      n--;
      if (n > 0) fx.innerHTML = '<div class="cn-l"></div><div class="cn-r"></div><div class="cn-n">' + n + '</div>';
      else { clearInterval(t); fx.classList.add('open'); setTimeout(function () { fx.classList.remove('on', 'open'); fx.innerHTML = ''; go(); }, 900); }
    }, 700);
  }
  function toPlayer(item) {
    if (!window.Android || !window.Android.playLive) return toast('التشغيل يحتاج الشاشة نفسها');
    if (window.__logWatch) window.__logWatch('vod', item.n);
    var go = function () { window.Android.playLive(JSON.stringify({ vod: 1, list: [item], folders: [], fold: 0 }), 0); };
    if (cinemaOn()) playCinema(go); else go();
  }
  function play(it) {
    if (st.favm && it.t !== 'xe') { var on = toggleFav(it); st.key = ''; toast(on ? '⭐ انضاف للمفضلة: ' + it.n : 'انشال من المفضلة: ' + it.n); return draw(); }
    var x = xt(); if (!x) return toast('أضف حساب IPTV من مدير الشاشة');
    var base = x.host + '/', cred = encodeURIComponent(x.user) + '/' + encodeURIComponent(x.pass) + '/', ua = xtUa(x);
    if (it.t === 'xm') return toPlayer({ n: it.n, ua: ua, u: base + 'movie/' + cred + it.id + '.' + (it.ext || 'mp4') });
    if (it.t === 'xe') return toPlayer({ n: it.n, ua: ua, u: base + 'series/' + cred + it.id + '.' + (it.ext || 'mp4') });
    if (it.t === 'xs') {
      toast('جاري تحميل الحلقات…');
      xtJson(x, 'get_series_info', '&series_id=' + it.id).then(function (j) {
        var eps = [], seasons = (j && j.episodes) || {};
        Object.keys(seasons).sort(function (a, b) { return a - b; }).forEach(function (sn) { (seasons[sn] || []).forEach(function (e) { eps.push({ t: 'xe', id: e.id, ext: e.container_extension || 'mp4', img: (e.info && e.info.movie_image) || it.img, n: 'م' + sn + ' · ح' + (e.episode_num || '') + (e.title ? ' · ' + e.title : '') }); }); });
        if (!eps.length) return toast('ماكو حلقات لهذا المسلسل');
        st.sub = { title: it.n, back: { list: st.list, gi: st.gi, ci: st.ci } }; st.list = eps; st.gi = 0; st.off = 0; st.key = ''; st.f = 'grid'; draw();
      });
    }
  }

  /* ---------------------------------------------------------------- search box and keys */
  function box() { return $('vdSearch'); }
  function startSearch() { var b = box(); if (!b) return; b.classList.add('on'); b.value = st.q || ''; b.focus(); }
  function endSearch(clear) { var b = box(); if (!b) return; b.blur(); if (clear) { b.value = ''; st.q = ''; } b.classList.toggle('on', !!st.q); }
  document.addEventListener('DOMContentLoaded', function () { var b = box(); if (b) b.addEventListener('input', function () { st.q = b.value.replace(/^\s+|\s+$/g, ''); st.gi = 0; st.off = 0; st.sub = null; st.key = ''; if (TABS[st.tab].id === 'fav') st.tab = 0; draw(); }); });
  function reset() { st.gi = 0; st.off = 0; st.sub = null; st.key = ''; }
  function key(k) {
    if (k === 'back') {
      if (st.sub) { var b = st.sub.back; st.sub = null; st.gi = b.gi; st.ci = b.ci; st.off = 0; st.key = ''; return draw(); }
      if (st.q) { endSearch(true); reset(); return draw(); }
      if (st.f === 'grid') { st.f = st.cats.length ? 'cat' : 'tab'; return draw(); }
      if (st.f === 'cat') { st.f = 'tab'; return draw(); }
      if (window.__closeVod) window.__closeVod(); return;
    }
    var n = st.list.length;
    if (st.f === 'tab') {
      if (k === 'ArrowRight') st.ti = Math.max(0, st.ti - 1);
      else if (k === 'ArrowLeft') st.ti = Math.min(TABS.length - 1, st.ti + 1);
      else if (k === 'ArrowDown') st.f = st.cats.length ? 'cat' : (n ? 'grid' : 'tab');
      else if (k === 'ok') {
        var id = TABS[st.ti].id;
        if (id === 'search') return startSearch();
        if (id === 'favm') { st.favm = !st.favm; toast(st.favm ? 'اضغط OK على أي فيلم أو مسلسل حتى ينضاف للمفضلة' : 'انطفى وضع المفضلة'); }
        else if (id === 'cinema') { var on = !cinemaOn(); try { localStorage.setItem('vodCinema', on ? '1' : '0'); } catch (e) {} toast(on ? '🎭 وضع السينما شغّال: ستارة وعدّ تنازلي قبل كل فيلم' : 'وضع السينما انطفى'); }
          else if (id === 'refresh') { toast('جاري التحديث…'); reset(); return pull(true); }
        else { st.tab = st.ti; st.ci = 0; endSearch(true); reset(); }
      }
      return draw();
    }
    if (st.f === 'cat') {
      if (k === 'ArrowUp') { if (st.ci === 0) st.f = 'tab'; else { st.ci--; reset(); } }
      else if (k === 'ArrowDown') { if (st.ci < st.cats.length - 1) { st.ci++; reset(); } }
      else if ((k === 'ArrowLeft' || k === 'ok') && n) st.f = 'grid';
      return draw();
    }
    if (k === 'ArrowRight') { if (st.gi % COLS === 0) st.f = st.cats.length ? 'cat' : 'grid'; else st.gi--; }
    else if (k === 'ArrowLeft') { if (st.gi + 1 < n && st.gi % COLS < COLS - 1) st.gi++; }
    else if (k === 'ArrowUp') { if (st.gi - COLS >= 0) st.gi -= COLS; else st.f = 'tab'; }
    else if (k === 'ArrowDown') { if (st.gi + COLS < n) st.gi += COLS; else if (st.gi < n - 1) st.gi = n - 1; }
    else if (k === 'ok') { if (st.list[st.gi]) play(st.list[st.gi]); return; }
    draw();
  }
  /* a quiet signal on the app icon: did the account bring more films or episodes since the last time this app was opened? */
  function vodSig() { try { return D.m && D.s ? D.m.items.length + D.s.items.length : 0; } catch (e) { return 0; } }
  window.Vod = {
    PKG: '__vod', name: appName,
    prefetch: function () { try { pull(false); } catch (e) {} },
    hasNew: function () { try { return vodSig() > (+localStorage.getItem('vodSeenSig') || 0); } catch (e) { return false; } },
    open: function () { st.f = 'tab'; st.ti = st.tab; st.sub = null; st.key = ''; $('vodModal').classList.add('on'); if (window.__setLayer) window.__setLayer('vod'); try { localStorage.setItem('vodSeenSig', String(vodSig())); if (window.__refreshBadges) window.__refreshBadges(); } catch (e) {} pull(false); },
    /* jumps straight to one category of the account's films or series (used by «شنو أشوف الليلة؟») */
    openCategory: function (tabId, re) {
      Vod.open();
      var pick = function () {
        st.tab = tabId; st.ti = tabId; st.sub = null; st.q = ''; st.key = ''; compute();
        var i = 0; for (var k = 0; k < st.cats.length; k++) if (re.test(st.cats[k].n)) { i = k; break; }
        st.ci = i; compute(); st.f = st.list.length ? 'grid' : (st.cats.length ? 'cat' : 'tab'); draw();
      };
      if (D.m) pick(); else pull(false).then(pick);
    },
    key: key,
    _t: { state: st, data: D }
  };
})();
