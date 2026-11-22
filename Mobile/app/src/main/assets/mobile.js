/* «قنواتي موبايل»: the channels and the films of the TV app, for the phone. Touch, RTL, Arabic.
   Sources: the free channels that ship with the app, and what the user adds himself (an Xtream account, M3U links, direct links). */
(function () {
  'use strict';
  var A = window.Android, TTL = 6 * 3600000, PAGE = 150;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function J(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function W(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} if (k === 'mFav' || k === 'mRec') mirror(); }
  /* the home-screen widgets read these (they cannot open the page's storage): favourites, last channel, last film */
  function mirror() {
    try {
      var f = J('mFav', []), r = J('mRec', []), lc = r.filter(function (x) { return !x.t; })[0], lv = r.filter(function (x) { return !!x.t; })[0];
      A.setPref('w_fav', JSON.stringify(f.slice(0, 6).map(function (x) { return x.n; })));
      A.setPref('w_lastch', lc ? lc.n : ''); A.setPref('w_lastvod', lv ? lv.n : '');
    } catch (e) {}
  }
  function toast(t) { try { A.toast(t); } catch (e) {} }

  /* ---------------------------------------------------------------- settings (kept on the phone) */
  var S = {}; try { S = JSON.parse(A.getPref('settings') || '{}') || {}; } catch (e) {}
  function save() {
    try {
      A.setPref('settings', JSON.stringify(S)); A.setPref('quietOn', S.quietOn ? '1' : '0');
      A.setPref('quietHour', String(S.quietHour != null ? S.quietHour : 23)); A.setPref('quietEndHour', String(S.quietEndHour != null ? S.quietEndHour : 7));
    } catch (e) {}
  }

  /* ---------------------------------------------------------------- network + an honest connection light */
  var cbs = {}, cbN = 0, samples = [];
  window.__cb = function (id, t) { var f = cbs[id]; if (f) { delete cbs[id]; f(t); } };
  function note(ms, ok) {
    samples.push(ok ? ms : -1); if (samples.length > 6) samples.shift();
    var r = samples.slice(-3), f = r.filter(function (v) { return v < 0; }).length, o = r.filter(function (v) { return v >= 0; }), cls, tx;
    if (f === r.length) { cls = 'bad'; tx = 'تعذّر الاتصال'; } else { var av = o.reduce(function (a, b) { return a + b; }, 0) / o.length; if (av < 700 && !f) { cls = 'good'; tx = 'الاتصال ممتاز'; } else if (av < 2200 && f < 2) { cls = 'ok'; tx = 'الاتصال مقبول'; } else { cls = 'bad'; tx = 'الاتصال ضعيف'; } }
    $('netDot').className = 'dot show ' + cls; $('netLbl').textContent = tx;
  }
  function fetchText(url) {
    var t0 = Date.now();
    return new Promise(function (res) { var id = 'c' + (++cbN); cbs[id] = function (t) { note(Date.now() - t0, String(t).indexOf('ERR:') !== 0); res(t); }; A.fetchText(url, id); });
  }
  window.__direct = function (op, a) { return new Promise(function (res) { var id = 'c' + (++cbN); cbs[id] = res; A.probe(a.url, a.ua || '', id); }); };

  /* ---------------------------------------------------------------- parsing */
  function parseM3U(text) {
    var out = [], cur = null;
    String(text || '').replace(/^﻿/, '').split(/\r\n|\n|\r/).forEach(function (ln) {
      ln = ln.trim(); if (!ln) return;
      if (ln.indexOf('#EXTINF') === 0) cur = { n: (ln.match(/,(.*)$/) || [0, ''])[1].trim(), g: (ln.match(/group-title="([^"]*)"/) || [0, ''])[1].trim() || 'بدون تصنيف', l: (ln.match(/tvg-logo="([^"]*)"/) || [0, ''])[1] };
      else if (ln.indexOf('#EXTVLCOPT') === 0 && cur) { var m = ln.match(/http-(referrer|referer|user-agent)=(.*)/i); if (m) { if (/^refer/i.test(m[1])) cur.r = m[2]; else cur.ua = m[2]; } }
      else if (ln.charAt(0) !== '#' && /^https?:/i.test(ln) && cur) { cur.u = ln; out.push(cur); cur = null; }
    });
    return out;
  }
  function xt() {
    var x = S.xtream; if (!x || !x.host || !x.user || !x.pass) return null;
    var h = String(x.host).trim(); if (!/^https?:\/\//i.test(h)) h = 'http://' + h; h = h.replace(/^(https?:\/\/[^\/?#]+).*$/i, '$1');
    return { host: h, user: String(x.user).trim(), pass: String(x.pass).trim(), live: x.live !== false, vod: x.vod !== false };
  }
  function xapi(x, a, extra) { return x.host + '/player_api.php?username=' + encodeURIComponent(x.user) + '&password=' + encodeURIComponent(x.pass) + '&action=' + a + (extra || ''); }
  var lastErr = '';
  function xjson(x, a, extra) { return fetchText(xapi(x, a, extra)).then(function (t) { if (/^ERR:/.test(t)) { lastErr = t.slice(4); return null; } try { return JSON.parse(t); } catch (e) { return null; } }); }
  function cred(x) { return encodeURIComponent(x.user) + '/' + encodeURIComponent(x.pass) + '/'; }

  /* ---------------------------------------------------------------- data */
  var LIVE = { user: [], loaded: false }, VOD = { m: [], s: [], loaded: false };
  var CATS = [['all', 'كل القنوات'], ['news', 'أخبار'], ['sport', 'رياضة'], ['movies', 'أفلام ومسلسلات'], ['docs', 'وثائقية'], ['ent', 'منوعات'], ['mbc', 'MBC'], ['karbala', 'كربلاء'], ['kids', 'أطفال'], ['quran', 'قرآن']];

  function loadLive(force) {
    var x = xt(), lines = String(S.myM3u || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean), key = (x && x.live ? x.host + x.user : '') + '|' + lines.join(',').length;
    var c = !force && J('mLive', null); if (c && c.k === key && Date.now() - c.t < TTL) { LIVE.user = c.items; LIVE.loaded = true; return Promise.resolve(); }
    var jobs = [], items = [];
    if (x && x.live) jobs.push(Promise.all([xjson(x, 'get_live_categories'), xjson(x, 'get_live_streams')]).then(function (r) {
      var names = {}; (r[0] || []).forEach(function (o) { names[o.category_id] = o.category_name; });
      (r[1] || []).forEach(function (o) { items.push({ n: String(o.name || '').trim(), u: x.host + '/live/' + cred(x) + o.stream_id + '.ts', l: o.stream_icon || '', g: names[o.category_id] || 'بدون تصنيف' }); });
    }));
    var inline = []; lines.forEach(function (l) { if (/^https?:\/\/\S+$/.test(l)) jobs.push(fetchText(l).then(function (t) { if (String(t).indexOf('#EXT') >= 0) items = items.concat(parseM3U(t)).filter(Boolean); })); else inline.push(l); });
    if (inline.join('').indexOf('#EXT') >= 0) items = items.concat(parseM3U(inline.join('\n')));
    return Promise.all(jobs).then(function () { LIVE.user = items; LIVE.loaded = true; if (items.length) W('mLive', { k: key, t: Date.now(), items: items }); });
  }
  function loadVod(force) {
    var x = xt(), L = String(S.vodLinks || '').split(/\s+/).filter(function (l) { return /^https?:\/\//i.test(l); }), VI = S.vodItems || [], key = (x && x.vod ? x.host + x.user : '') + '|' + L.join(',').length + '|' + VI.length;
    var c = !force && J('mVod', null); if (c && c.k === key && Date.now() - c.t < TTL) { VOD.m = c.m; VOD.s = c.s; VOD.loaded = true; return Promise.resolve(); }
    var m = [], s = [], jobs = [];
    if (x && x.vod) jobs.push(Promise.all([xjson(x, 'get_vod_categories'), xjson(x, 'get_vod_streams'), xjson(x, 'get_series_categories'), xjson(x, 'get_series')]).then(function (r) {
      var cm = {}, cs = {}; (r[0] || []).forEach(function (o) { cm[o.category_id] = o.category_name; }); (r[2] || []).forEach(function (o) { cs[o.category_id] = o.category_name; });
      (r[1] || []).forEach(function (o) { m.push({ t: 'xm', n: String(o.name || '').trim(), u: x.host + '/movie/' + cred(x) + o.stream_id + '.' + (o.container_extension || 'mp4'), img: o.stream_icon || '', g: cm[o.category_id] || 'بدون تصنيف', rt: parseFloat(o.rating) || 0, add: +o.added || 0 }); });
      (r[3] || []).forEach(function (o) { s.push({ t: 'xs', n: String(o.name || '').trim(), id: o.series_id, img: o.cover || '', g: cs[o.category_id] || 'بدون تصنيف', rt: parseFloat(o.rating) || 0, add: +o.last_modified || 0, pl: String(o.plot || '').slice(0, 400) }); });
    }));
    L.forEach(function (u) { jobs.push(fetchText(u).then(function (t) {
      if (String(t).indexOf('#EXT') < 0) { lastErr = String(t).indexOf('ERR:') === 0 ? String(t).slice(4) : 'الرابط ما يرجّع قائمة M3U'; return; }
      parseM3U(t).forEach(function (it) { var o = { t: 'ml', n: it.n, u: it.u, img: it.l || '', g: it.g }; (/مسلسل|series|episode|season|حلقة|موسم|\bS\d{1,2}\s?E\d{1,3}\b/i.test(it.g + ' ' + it.n) ? s : m).push(o); });
    })); });
    VI.forEach(function (o) { if (o && /^https?:/i.test(o.u || '')) m.push({ t: 'ml', n: o.n || 'فيديو', u: o.u, img: '', g: 'روابط مباشرة' }); });
    return Promise.all(jobs).then(function () { VOD.m = m; VOD.s = s; VOD.loaded = true; if (m.length + s.length) W('mVod', { k: key, t: Date.now(), m: m, s: s }); });
  }

  /* ---------------------------------------------------------------- favourites + last watched (one list each, kept on the phone) */
  function favList() { return J('mFav', []); }
  function favKey(it) { return (it.t || 'ch') + ':' + (it.u || it.id); }
  function isFav(it) { var k = favKey(it); return favList().some(function (f) { return favKey(f) === k; }); }
  function toggleFav(it) { var k = favKey(it), l = favList(), had = l.some(function (f) { return favKey(f) === k; }); l = had ? l.filter(function (f) { return favKey(f) !== k; }) : [it].concat(l).slice(0, 200); W('mFav', l); return !had; }
  function pushRecent(it) { var k = favKey(it); W('mRec', [it].concat(J('mRec', []).filter(function (f) { return favKey(f) !== k; })).slice(0, 30)); }

  /* ---------------------------------------------------------------- playing */
  function playPack(list, i, vod) {
    /* live: the player gets every channel (with its group) and starts at the one you chose, so you can change channel inside the player */
    var src = list, k = i;
    if (!vod && list[i]) {
      var all = liveAll(), key = favKey(list[i]), f = -1;
      for (var z = 0; z < all.length; z++) if (favKey(all[z]) === key) { f = z; break; }
      if (f >= 0) { src = all; k = f; }
    }
    var lo = Math.max(0, k - 1500), sl = src.slice(lo, lo + 3000);
    A.play(JSON.stringify({ vod: vod ? 1 : 0, list: sl.map(function (c) { return { n: c.n, u: c.u, ua: c.ua || '', r: c.r || '', g: c.grp || (c.g && catName(c.g)) || '' }; }) }), k - lo);
    pushRecent(list[i]);
  }

  /* ---------------------------------------------------------------- views */
  var tab = 'live', st = { live: { cat: 'home', q: '', more: PAGE }, vod: { sub: 'h', cat: '*', q: '', more: PAGE } }, cur = [];
  function ini(n) { return esc(String(n).replace(/^ال/, '').replace(/\s/g, '').slice(0, 2)); }
  function logoOf(c) { return c.i ? 'logos/' + c.i + '.png' : (c.l || c.img || ''); }
  function art(c, poster) { var u = logoOf(c); return '<div class="art' + (poster ? ' poster' : '') + '">' + ini(c.n) + (u ? '<img loading="lazy" src="' + esc(u) + '" alt="" onerror="this.remove()">' : '') + '</div>'; }
  var PEN = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
  function chips(list, on, attr) { return '<div class="chips">' + list.map(function (c) { return '<div class="chip' + (c[0] === on ? ' on' : '') + '" data-' + attr + '="' + esc(c[0]) + '">' + esc(c[1]) + '</div>'; }).join('') + '</div>'; }
  function searchBox(q, ph) { return '<input class="search" id="q" type="search" placeholder="' + ph + '" value="' + esc(q) + '">'; }
  function bindSearch(o, redraw) { var q = $('q'); if (!q) return; q.oninput = function () { o.q = q.value.trim(); o.more = PAGE; var pos = q.selectionStart; redraw(true); var n = $('q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }; }

  function liveAll() {
    var base = (window.CHANNELS || []).map(function (c) { return c; });
    var mine = (S.myCh || []).map(function (c, i) { return { n: c.n, u: c.u, l: c.l, g: 'my', c: 'my', grp: MYG, mine: 1, ix: i, ua: c.ua, r: c.r }; });
    return base.concat(mine, LIVE.user.map(function (c) { return { n: c.n, u: c.u, l: c.l, g: 'my', c: 'my', grp: c.g, ua: c.ua, r: c.r }; }));
  }
  function liveCats() {
    var l = CATS.slice(), seen = {}, all = liveAll();
    all.forEach(function (c) { if (c.grp && !seen[c.grp]) { seen[c.grp] = 1; } });
    var pre = [['home', 'الرئيسية'], ['fav', 'المفضلة'], ['rec', 'آخر ما شاهدت']];
    var grps = Object.keys(seen).filter(function (g) { return g !== MYG; }).slice(0, 60).map(function (g) { return ['g:' + g, g]; });
    var mine = seen[MYG] ? [['g:' + MYG, MYG]] : [];          /* «قنواتي المضافة» comes first, right after the favourites */
    return pre.concat(mine).concat(l).concat(grps);
  }
  function liveFilter() {
    var s = st.live, all = liveAll(), l;
    if (s.cat === 'fav') l = favList().filter(function (f) { return !f.t; });
    else if (s.cat === 'rec') l = J('mRec', []).filter(function (f) { return !f.t; });
    else if (s.cat === 'all' || s.cat === 'home') l = all;
    else if (s.cat.indexOf('g:') === 0) l = all.filter(function (c) { return c.grp === s.cat.slice(2); });
    else if (s.cat === 'mbc' || s.cat === 'karbala') l = all.filter(function (c) { return c.p === s.cat; });
    else l = all.filter(function (c) { return c.g === s.cat; });
    if (s.q) { var w = s.q.toLowerCase(); l = (s.cat === 'all' || s.cat === 'home' ? all : l).filter(function (c) { return String(c.n).toLowerCase().indexOf(w) >= 0; }); }
    return l;
  }
  function drawLive(keepTop) {
    var s = st.live; if (s.cat === 'home' && !s.q) { drawLiveHome(keepTop); return; }
    cur = liveFilter();
    var rows = cur.slice(0, s.more).map(function (c, i) { return '<div class="row" data-i="' + i + '">' + art(c) + '<div class="tx"><b>' + esc(c.n) + '</b><small>' + esc(c.grp || c.g && catName(c.g) || '') + '</small></div><span class="star' + (isFav(c) ? ' on' : '') + '" data-s="' + i + '">' + STAR + '</span>' + (c.mine ? '<span class="ed" data-ed="' + c.ix + '">' + PEN + '</span>' : '') + '</div>'; }).join('');
    var more = cur.length > s.more ? '<button class="btn sec" id="more">عرض المزيد (' + (cur.length - s.more) + ')</button>' : '';
    var empty = !cur.length ? '<div class="empty">' + (s.cat === 'fav' ? 'ماكو مفضلة بعد. اضغط النجمة جنب أي قناة.' : s.cat === 'rec' ? 'ما شاهدت شي بعد.' : s.q ? 'ماكو قناة بهذا الاسم' : !LIVE.loaded ? 'جاري التحميل…' : 'ماكو قنوات بهذا القسم' + (lastErr ? '<br>' + esc(lastErr) : '')) + '</div>' : '';
    if (!keepTop) { $('top').innerHTML = searchBox(s.q, 'ابحث عن قناة…') + chips(liveCats(), s.cat, 'lc') + '<div class="tools"><button id="rnd">قناة عشوائية</button><button id="siteBtn">فتح موقع</button></div>'; bindSearch(s, drawLive); }
    $('main').innerHTML = rows + more + empty;
  }
  function catName(g) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === g) return CATS[i][1]; return ''; }

  function vodCats() { var l = VOD[st.vod.sub], seen = {}; l.forEach(function (c) { seen[c.g] = 1; }); return [['*', 'الكل (' + l.length + ')']].concat(Object.keys(seen).slice(0, 80).map(function (g) { return [g, g]; })); }
  function vodFilter() { var s = st.vod, l = VOD[s.sub]; if (s.cat !== '*') l = l.filter(function (c) { return c.g === s.cat; }); if (s.q) { var w = s.q.toLowerCase(); l = VOD[s.sub].filter(function (c) { return String(c.n).toLowerCase().indexOf(w) >= 0; }); } return l; }
  function drawVod(keepTop) {
    var s = st.vod; if (s.sub === 'w') { drawSites(); return; }
    if (s.sub === 'h') { drawCinema(); return; }
    if (s.sub === 'c') { drawCinemaCat(); return; }
    cur = vodFilter();
    var cards = cur.slice(0, s.more).map(function (c, i) { return '<div class="card" data-v="' + i + '" style="position:relative">' + art(c, true) + (isFav(c) ? '<span class="fv">' + STAR + '</span>' : '') + '<b>' + esc(c.n) + '</b></div>'; }).join('');
    var msg = !VOD.loaded ? 'جاري التحميل…' : (!xt() && !String(S.vodLinks || '').trim() && !(S.vodItems || []).length) ? 'أضف حساب IPTV أو رابط قائمة من الإعدادات (أو من «الربط الذكي»).' : lastErr ? 'تعذّر جلب المحتوى (' + esc(lastErr) + ')' : s.q ? 'ماكو نتيجة' : 'ماكو محتوى بهذا القسم';
    if (!keepTop) { $('top').innerHTML = searchBox(s.q, 'ابحث عن فيلم أو مسلسل…') + chips(VPILLS, s.sub, 'vs') + chips(vodCats(), s.cat, 'vc') + '<div class="tools"><button id="vrf">تحديث القائمة</button></div>'; bindSearch(s, drawVod); }
    $('main').innerHTML = (cur.length ? '<div class="grid">' + cards + '</div>' + (cur.length > s.more ? '<button class="btn sec" id="more" style="margin-top:10px">عرض المزيد</button>' : '') : '<div class="empty">' + msg + '</div>');
  }

  function drawFav() {
    $('top').innerHTML = '';
    var l = favList(); cur = l;
    $('main').innerHTML = l.length ? l.map(function (c, i) { return '<div class="row" data-f="' + i + '">' + art(c, !!c.t) + '<div class="tx"><b>' + esc(c.n) + '</b><small>' + (c.t ? (c.t === 'xs' ? 'مسلسل' : 'فيلم') : 'قناة') + '</small></div><span class="star on" data-fs="' + i + '">' + STAR + '</span></div>'; }).join('') : '<div class="empty">ماكو مفضلة بعد.<br>اضغط ★ جنب القنوات، أو اضغط مطوّلاً على فيلم.</div>';
  }

  function drawSet() {
    var x = S.xtream || {}, H = ''; for (var h = 0; h < 24; h++) H += '<option value="' + h + '">' + h + '</option>';
    $('top').innerHTML = '';
    $('main').innerHTML =
      '<div class="panel"><h2>الترحيب</h2><p>اسمك يطلع بتحية كل ما تفتح التطبيق.</p><input class="rtl" id="sName" maxlength="20" placeholder="مثلاً: أحمد" value="' + esc(S.ownerName || '') + '"><div class="tog' + (S.greetOn !== false ? ' on' : '') + '" id="tGreet"><span>تشغيل التحية</span><i></i></div></div>' +
      '<div class="panel"><h2>🔗 الربط الذكي</h2><p>الصق رابط من مزوّدك (قائمة M3U، رابط حساب IPTV، أو فيديو). الموبايل يفحصه ويعرف نوعه ويضيفه.</p><input id="smUrl" placeholder="https://…"><button class="btn" id="smGo">تعرّف على الرابط</button><button class="btn sec" id="smPaste">لصق من الحافظة</button><div id="smOut"></div></div>' +
      '<div class="panel"><h2>حساب IPTV (Xtream)</h2><p>قنواته تطلع بقنواتي، وأفلامه ومسلسلاته بالأفلام. البيانات تبقى على موبايلك.</p><input id="xH" placeholder="http://server.com:8080" value="' + esc(x.host || '') + '"><input id="xU" placeholder="اسم المستخدم" value="' + esc(x.user || '') + '"><input id="xP" placeholder="كلمة المرور" value="' + esc(x.pass || '') + '">' +
        '<div class="tog' + (x.live !== false ? ' on' : '') + '" id="tXL"><span>قنوات البث ← قنواتي</span><i></i></div><div class="tog' + (x.vod !== false ? ' on' : '') + '" id="tXV"><span>أفلام ومسلسلات</span><i></i></div><button class="btn" id="xSave">حفظ وتحديث</button></div>' +
      '<div class="panel"><h2>روابط قوائم M3U</h2><p>للقنوات (رابط بكل سطر):</p><textarea id="mLinks" rows="3" placeholder="https://…">' + esc(S.myM3u || '') + '</textarea><p>للأفلام والمسلسلات:</p><textarea id="vLinks" rows="3" placeholder="https://…">' + esc(S.vodLinks || '') + '</textarea><button class="btn" id="lSave">حفظ وتحديث</button></div>' +
      '<div class="panel"><h2>وضع الهدوء الليلي</h2><p>بعد الساعة المحددة الصوت ينزل والترجمة تكبر أثناء التشغيل.</p><div class="tog' + (S.quietOn ? ' on' : '') + '" id="tQ"><span>تشغيل</span><i></i></div><p>يبدأ الساعة</p><select id="qH" class="search" style="margin:0 0 8px;width:100%">' + H + '</select><p>ينتهي الساعة</p><select id="qE" class="search" style="margin:0 0 8px;width:100%">' + H + '</select><button class="btn" id="qSave">حفظ</button></div>' +
      '<div class="panel"><h2>اسم تبويب الأفلام</h2><input class="rtl" id="vName" maxlength="24" placeholder="الأفلام" value="' + esc(S.vodName || '') + '"><button class="btn" id="vSave">حفظ</button></div>';
    $('qH').value = S.quietHour != null ? S.quietHour : 23; $('qE').value = S.quietEndHour != null ? S.quietEndHour : 7;
    bindSettings();
  }
  function bindSettings() {
    function tog(id, fn) { $(id).onclick = function () { $(id).classList.toggle('on'); fn($(id).classList.contains('on')); }; }
    tog('tGreet', function (v) { S.greetOn = v; save(); }); tog('tQ', function (v) { S.quietOn = v; save(); });
    var xl = (S.xtream || {}).live !== false, xv = (S.xtream || {}).vod !== false; tog('tXL', function (v) { xl = v; }); tog('tXV', function (v) { xv = v; });
    $('sName').onchange = function () { var v = $('sName').value.trim(); if (v) S.ownerName = v; else delete S.ownerName; save(); toast('انحفظ الاسم'); };
    $('xSave').onclick = function () { var h = $('xH').value.trim(), u = $('xU').value.trim(), p = $('xP').value.trim(); if (h && u && p) S.xtream = { host: h, user: u, pass: p, live: xl, vod: xv }; else delete S.xtream; save(); refreshAll('انحفظ الحساب'); };
    $('lSave').onclick = function () { var m = $('mLinks').value.trim(), v = $('vLinks').value.split(/\s+/).filter(function (l) { return /^https?:\/\//i.test(l); }).join('\n'); if (m) S.myM3u = m; else delete S.myM3u; if (v) S.vodLinks = v; else delete S.vodLinks; save(); refreshAll('انحفظت الروابط'); };
    $('qSave').onclick = function () { S.quietHour = +$('qH').value; S.quietEndHour = +$('qE').value; save(); toast('انحفظ وضع الهدوء'); };
    $('vSave').onclick = function () { var v = $('vName').value.trim(); if (v) S.vodName = v; else delete S.vodName; save(); applyName(); toast('انحفظ'); };
    $('smPaste').onclick = function () { var t = (A.paste() || '').trim(); if (t) $('smUrl').value = t; else toast('الحافظة فاضية'); };
    $('smGo').onclick = function () { smartRun($('smUrl').value.trim(), $('smOut')); };
  }
  function refreshAll(msg) { lastErr = ''; LIVE.loaded = VOD.loaded = false; W('mLive', null); W('mVod', null); toast(msg + ' · جاري التحديث…'); loadLive(true).then(function () { if (tab === 'live') drawLive(); }); loadVod(true).then(function () { if (tab === 'vod') drawVod(); }); }

  /* ---------------------------------------------------------------- my own channels: a link is saved as a channel, edited, deleted */
  var MYG = 'قنواتي المضافة';
  function showSheet(html) { $('sheetIn').innerHTML = html; $('sheet').classList.add('on'); }
  function nameFromUrl(u) {
    try {
      var x = new URL(u), p = decodeURIComponent(x.pathname.split('/').filter(Boolean).pop() || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').trim();
      return p && !/^(index|playlist|master|live|stream|chunklist|manifest|video)$/i.test(p) && !/^\d+$/.test(p) ? p : x.hostname.replace(/^www\./, '');
    } catch (e) { return 'قناة جديدة'; }
  }
  function chSheet(o) {
    var ed = o.ix != null;
    showSheet('<h3>' + (ed ? 'تعديل القناة' : 'حفظ كقناة') + '</h3>' +
      '<label class="f">اسم القناة</label><input class="rtl" id="cN" maxlength="60" value="' + esc(o.n || '') + '">' +
      '<label class="f">رابط الشعار (اختياري)</label><input dir="ltr" id="cL" placeholder="https://…" value="' + esc(o.l || '') + '">' +
      '<label class="f">رابط البث</label><input dir="ltr" id="cU" value="' + esc(o.u || '') + '">' +
      '<button class="btn" id="cOk">' + (ed ? 'حفظ التعديل' : 'احفظها بقنواتي') + '</button>' + (ed ? '<button class="btn sec" id="cDel">حذف القناة</button>' : ''));
    $('cOk').onclick = function () {
      var u = $('cU').value.trim(), n = $('cN').value.trim() || nameFromUrl(u), l = $('cL').value.trim();
      if (!/^https?:\/\//i.test(u)) { toast('رابط البث لازم يبدأ بـ http'); return; }
      var a = (S.myCh = S.myCh || []), item = { n: n.slice(0, 60), u: u }; if (/^https?:\/\//i.test(l)) item.l = l;
      if (ed && a[o.ix]) { if (a[o.ix].ua) item.ua = a[o.ix].ua; if (a[o.ix].r) item.r = a[o.ix].r; }
      if (ed && a[o.ix]) a[o.ix] = item;
      else { var k = -1; for (var z = 0; z < a.length; z++) if (a[z].u === u) k = z; if (k >= 0) a[k] = item; else a.push(item); }
      S.myCh = a.slice(-300); save(); $('sheet').classList.remove('on');
      st.live.cat = 'g:' + MYG; st.live.more = PAGE; st.live.q = ''; show('live'); toast('انحفظت: ' + item.n);
    };
    if (ed) $('cDel').onclick = function () { S.myCh.splice(o.ix, 1); if (!S.myCh.length) delete S.myCh; save(); $('sheet').classList.remove('on'); st.live.cat = 'all'; show('live'); toast('انحذفت القناة'); };
  }
  /* look at a link and offer what fits: a channel, the TV list, movies… (shared by the settings page, the share button and the clipboard bar) */
  function smartRun(url, out) {
    if (!/^https?:\/\//i.test(url)) { out.innerHTML = '<div class="res">الصق رابط يبدأ بـ http</div>'; return; }
    out.innerHTML = '<div class="res">جاري الفحص…</div>';
    window.SmartLink.identify(url).then(function (r) {
      var ok = !!r.apply, T = { live: 'للقنوات', vod: 'للأفلام والمسلسلات', both: 'للاثنين' };
      var asCh = r.kind === 'file' || /\.(m3u8|ts)(\?|$)/i.test(url) || /\/live\//i.test(url);
      out.innerHTML = '<div class="res"><b>' + esc(r.label) + '</b><small>' + esc(r.detail) + '</small></div>' +
        (asCh ? '<button class="btn" data-ch="1">أضفه كقناة (قنواتي المضافة)</button>' : '') +
        (r.kind === 'm3u' ? '<button class="btn" data-pl="1">افتح القنوات اللي بالقائمة واختار منها</button>' : '') +
        (['bad', 'm3u', 'file', 'xtream', 'xtream-host'].indexOf(r.kind) < 0 ? '<button class="btn" data-site="1">افتح الموقع واختار القناة</button><button class="btn" data-sv="1">احفظه كموقع بواجهة قنواتي</button>' : '') +
        (r.kind === 'web' || r.kind === 'unknown' ? '<button class="btn sec" data-pg="1">دوّر على روابط بث بالصفحة</button>' : '') +
        (ok ? (r.targets || ['both']).map(function (t) { return '<button class="btn' + (asCh ? ' sec' : '') + '" data-t="' + t + '">أضفه ' + T[t] + '</button>'; }).join('') : '') + '<button class="btn sec" data-lg="1">نسخ التشخيص</button>';
      var ch = out.querySelector('[data-ch]'); if (ch) ch.onclick = function () { chSheet({ u: url, n: nameFromUrl(url) }); };
      var pl = out.querySelector('[data-pl]'); if (pl) pl.onclick = function () { openFound(url, false); };
      var sv = out.querySelector('[data-sv]'); if (sv) sv.onclick = function () { $('sheet').classList.remove('on'); toast('جاري قراءة الموقع…'); A.readSite(url); };
      var sb = out.querySelector('[data-site]'); if (sb) sb.onclick = function () { $('sheet').classList.remove('on'); A.openSite(url); };
      var pg = out.querySelector('[data-pg]'); if (pg) pg.onclick = function () { openFound(url, true); };
      [].forEach.call(out.querySelectorAll('[data-t]'), function (b) { b.onclick = function () { r.apply(S, b.getAttribute('data-t')); save(); $('sheet').classList.remove('on'); refreshAll('انضاف ' + T[b.getAttribute('data-t')]); }; });
      out.querySelector('[data-lg]').onclick = function () { A.copy(window.SmartLink.logText(r)); toast('انسخ التشخيص'); };
    });
  }
  /* open a playlist (or a web page) and show the channels found in it, each with its own «save» */
  function haveCh(u) { var a = S.myCh || []; for (var i = 0; i < a.length; i++) if (a[i].u === u) return true; return false; }
  function saveCh(c) {
    var a = (S.myCh = S.myCh || []), item = { n: String(c.n || nameFromUrl(c.u)).slice(0, 60), u: c.u }, k = -1;
    if (c.l && /^https?:\/\//i.test(c.l)) item.l = c.l; if (c.ua) item.ua = c.ua; if (c.r) item.r = c.r;
    for (var i = 0; i < a.length; i++) if (a[i].u === c.u) k = i;
    if (k >= 0) a[k] = item; else a.push(item);
    S.myCh = a.slice(-500);
  }
  function openFound(url, page) {
    showSheet('<h3>' + (page ? 'روابط البث بالصفحة' : 'قنوات القائمة') + '</h3><div class="res">جاري الفتح…</div>');
    fetchText(url).then(function (t) {
      if (/^ERR:/.test(t)) { showSheet('<h3>ما انفتح</h3><div class="res">' + esc(t.slice(4)) + '</div>'); return; }
      var items = [];
      if (!page) items = parseM3U(t);
      else {
        var seen = {}, ttl = (String(t).match(/<title[^>]*>([^<]*)/i) || [0, ''])[1].trim();
        (String(t).replace(/\\\//g, '/').match(/https?:\/\/[^\s"'<>\\)]+?\.(?:m3u8|mpd)[^\s"'<>\\)]*/gi) || []).forEach(function (u) { if (!seen[u]) { seen[u] = 1; items.push({ n: nameFromUrl(u) + (ttl ? ' · ' + ttl.slice(0, 24) : ''), u: u, g: 'روابط الصفحة' }); } });
      }
      if (!items.length) { showSheet('<h3>ما لگيت قنوات</h3><div class="res">' + (page ? 'الصفحة ما فيها روابط بث ظاهرة (m3u8). بعض المواقع تخفيها بالسكربت.' : 'القائمة فاضية أو مو M3U.') + '</div>'); return; }
      foundSheet(items, page);
    });
  }
  function foundSheet(items, page) {
    var q = '', more = 100, flt = items;
    showSheet('<h3>' + (page ? 'روابط البث بالصفحة' : 'قنوات القائمة') + ' (' + items.length + ')</h3>' +
      (items.length > 12 ? '<input class="rtl" id="fQ" type="search" placeholder="ابحث باسم القناة…">' : '') +
      '<button class="btn" id="fAll"></button><div id="fList"></div><button class="btn sec" id="fMore" style="display:none"></button><button class="btn sec" id="fMine">افتح قنواتي المضافة</button>');
    function draw() {
      var w = q.toLowerCase(); flt = w ? items.filter(function (c) { return String(c.n).toLowerCase().indexOf(w) >= 0 || String(c.g || '').toLowerCase().indexOf(w) >= 0; }) : items;
      var left = flt.filter(function (c) { return !haveCh(c.u); }).length;
      $('fAll').textContent = left ? 'احفظ الكل (' + left + ')' : 'كلها محفوظة ✓'; $('fAll').style.opacity = left ? 1 : .5;
      $('fList').innerHTML = flt.slice(0, more).map(function (c, i) { var has = haveCh(c.u); return '<div class="row" data-f="' + i + '">' + art(c) + '<div class="tx"><b>' + esc(c.n) + '</b><small>' + esc(c.g || '') + '</small></div><button class="sv' + (has ? ' on' : '') + '" data-sv="' + i + '">' + (has ? '✓ محفوظة' : 'حفظ') + '</button></div>'; }).join('');
      $('fMore').style.display = flt.length > more ? 'block' : 'none'; $('fMore').textContent = 'عرض المزيد (' + (flt.length - more) + ')';
    }
    draw();
    if ($('fQ')) $('fQ').oninput = function () { q = $('fQ').value.trim(); more = 100; draw(); };
    $('fMore').onclick = function () { more += 100; draw(); };
    $('fAll').onclick = function () { var n = 0; flt.forEach(function (c) { if (!haveCh(c.u)) { saveCh(c); n++; } }); if (n) { save(); toast('انحفظت ' + n + ' قناة'); } draw(); };
    $('fList').onclick = function (e) { var b = e.target.closest('[data-sv]'); if (!b) return; var c = flt[+b.getAttribute('data-sv')]; if (!c) return; if (haveCh(c.u)) { toast('محفوظة من قبل'); return; } saveCh(c); save(); b.classList.add('on'); b.textContent = '✓ محفوظة'; toast('انحفظت: ' + c.n); $('fAll').textContent = 'احفظ الكل (' + flt.filter(function (z) { return !haveCh(z.u); }).length + ')'; };
    $('fMine').onclick = function () { $('sheet').classList.remove('on'); st.live.cat = 'g:' + MYG; st.live.more = PAGE; st.live.q = ''; show('live'); };
  }
  /* «فتح موقع»: paste a website address; it opens inside the app and the channel you tap there can be played and saved */
  function siteSheet() {
    showSheet('<h3>فتح موقع</h3><div class="res">الصق رابط الموقع، افتح القناة بالصفحة، وإذا لقى البث يطلع لك شريط «شغّل» و«حفظ القناة».</div>' +
      '<input dir="ltr" id="sU" placeholder="https://…"><button class="btn sec" id="sP">لصق من الحافظة</button><button class="btn" id="sGo">افتح الموقع</button><button class="btn sec" id="sSv">احفظه كموقع بواجهة قنواتي</button>');
    $('sP').onclick = function () { var t = String(A.paste() || '').trim(), m = t.match(/https?:\/\/[^\s"'<>]+/); if (m) $('sU').value = m[0]; else toast('الحافظة ما فيها رابط'); };
    $('sSv').onclick = function () { var u = $('sU').value.trim(); if (!/^https?:\/\//i.test(u)) { toast('اكتب رابط يبدأ بـ http'); return; } $('sheet').classList.remove('on'); toast('جاري قراءة الموقع…'); A.readSite(u); };
    $('sGo').onclick = function () { var u = $('sU').value.trim(); if (!/^https?:\/\//i.test(u)) { toast('اكتب رابط يبدأ بـ http'); return; } $('sheet').classList.remove('on'); A.openSite(u); };
  }
  function linkSheet(url) { showSheet('<h3>رابط جديد</h3><div class="res" dir="ltr" style="word-break:break-all;font-size:12px">' + esc(url.length > 140 ? url.slice(0, 140) + '…' : url) + '</div><div id="lkOut"></div>'); smartRun(url, $('lkOut')); }
  /* the «share» button of any app: the page gets the text, finds the link and offers what to do with it */
  window.__incoming = function (text) {
    var m = String(text || '').match(/https?:\/\/[^\s"'<>]+/);
    if (!m) { toast('ما لگيت رابط بالنص'); return true; }
    if (typeof isActive === 'function' && !isActive()) { toast('فعّل التطبيق أول'); return true; }
    linkSheet(m[0]); return true;
  };
  /* a streaming/playlist-looking link on the clipboard when the app comes forward: a small bar offers to look at it (once per link) */
  var clipTimer = null;
  function checkClip() {
    try {
      if (!isActive() || $('greet').classList.contains('on') || $('sheet').classList.contains('on')) return;
      var t = String(A.paste() || '').trim(), m = t.match(/https?:\/\/[^\s"'<>]+/);
      if (!m) return;
      var u = m[0];
      if (!/\.(m3u8?|ts|mp4|mkv|php)(\?|$)|username=|player_api|get\.php|\/live\/|\/movie\/|\/series\//i.test(u)) return;
      if (A.getPref('clipSeen') === u) return;
      A.setPref('clipSeen', u);
      var bar = $('clipBar'); bar.innerHTML = '<div><b>لقيت رابط بالحافظة</b><small dir="ltr">' + esc(u.replace(/^https?:\/\//, '').slice(0, 46)) + '</small></div><button id="cbGo">تعرّف</button><button id="cbNo" class="x">✕</button>';
      bar.classList.add('on');
      var hide = function () { bar.classList.remove('on'); clearTimeout(clipTimer); };
      $('cbGo').onclick = function () { hide(); linkSheet(u); }; $('cbNo').onclick = hide;
      clipTimer = setTimeout(hide, 14000);
    } catch (e) {}
  }
  window.onFocused = function () { setTimeout(checkClip, 400); };
  /* coming back from the site browser (or the player): channels saved there live in the app's settings, read them again */
  window.onResumed = function () {
    try { var ns = JSON.parse(A.getPref('settings') || '{}'); if (ns && typeof ns === 'object') S = ns; } catch (e) {}
    try {
      var ow = A.getPref('w_openSite');
      if (ow) { A.setPref('w_openSite', ''); st.vod.sub = 'w'; siteView = ow; show('vod'); return; }
    } catch (e) {}
    try { if (tab === 'live' && !$('sheet').classList.contains('on')) drawLive(); } catch (e) {}
  };

  /* ---------------------------------------------------------------- «مواقعي»: a saved website shown in قنواتي's own look, rows as the site arranges them */
  var siteView = null, siteFlat = [];
  function siteById(id) { var a = S.sites || []; for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function siteCache(id) { try { return JSON.parse(A.getPref('site_' + id) || 'null'); } catch (e) { return null; } }
  function addSiteSheet() {
    showSheet('<h3>إضافة موقع</h3><div class="res">الصق رابط موقعك. ينفتح، ولما تطلع قوائم الأفلام والمسلسلات يحفظه التطبيق ويعرضها بواجهة قنواتي وبنفس ترتيب الموقع. إذا طلب الموقع تحقق أو تسجيل دخول سوّيه، وبعدين اضغط «▦ واجهة قنواتي» فوق.</div>' +
      '<input dir="ltr" id="aU" placeholder="https://…"><button class="btn sec" id="aP">لصق من الحافظة</button><button class="btn" id="aGo">احفظ الموقع</button>');
    $('aP').onclick = function () { var t = String(A.paste() || '').trim(), m = t.match(/https?:\/\/[^\s"'<>]+/); if (m) $('aU').value = m[0]; else toast('الحافظة ما فيها رابط'); };
    $('aGo').onclick = function () { var u = $('aU').value.trim(); if (!/^https?:\/\//i.test(u)) { toast('اكتب رابط يبدأ بـ http'); return; } $('sheet').classList.remove('on'); toast('جاري قراءة الموقع…'); A.readSite(u); };
  }
  function removeSite(id) {
    S.sites = (S.sites || []).filter(function (x) { return x.id !== id; }); if (!S.sites.length) delete S.sites;
    save(); try { A.setPref('site_' + id, ''); } catch (e) {} if (siteView === id) siteView = null; drawSites(); toast('انحذف الموقع');
  }
  function openSiteView(id) {
    var x = siteById(id); if (!x) return;
    if (!siteCache(id)) { toast('جاري قراءة الموقع…'); A.readSite(x.url); return; }
    siteView = id; drawSites();
  }
  function drawSites() {
    $('top').innerHTML = chips(VPILLS, 'w', 'vs') +
      '<div class="tools"><button id="siteAdd">إضافة موقع</button>' + (siteView ? '<button id="siteBack">‹ المواقع</button><button id="siteRef">تحديث</button>' : '') + '</div>';
    siteFlat = [];
    var list = S.sites || [], html = '';
    if (siteView) {
      var x = siteById(siteView), c = siteCache(siteView);
      if (!x || !c) { siteView = null; }
      else {
        html = '<div class="sh">' + esc(x.name) + '</div>' + (c.sections || []).map(function (sec) {
          return '<div class="sh">' + esc(sec.title) + '</div><div class="hs">' + (sec.items || []).map(function (it) {
            var i = siteFlat.push(it) - 1; return '<div class="card" data-sl="' + i + '">' + art({ n: it.n, img: it.img }, true) + '<b>' + esc(it.n) + '</b></div>';
          }).join('') + '</div>';
        }).join('') + '<div class="empty" style="padding:14px">اضغط أي عنوان: يجهّزه التطبيق ويشغّله بمشغّله. وإذا الصفحة تحتاج ضغطة منك، تطلع لك وتضغط التشغيل بنفسك.</div>';
      }
    }
    if (!siteView) {
      html = list.length ? list.map(function (x) {
        var has = !!siteCache(x.id);
        return '<div class="row" data-st="' + esc(x.id) + '">' + art({ n: x.name, l: x.icon }) + '<div class="tx"><b>' + esc(x.name) + '</b><small>' + esc((x.url || '').replace(/^https?:\/\//, '').slice(0, 40)) + (has ? '' : ' · ما انقرأ بعد') + '</small></div><span class="ed" data-sd="' + esc(x.id) + '">✕</span></div>';
      }).join('') : '<div class="empty">ماكو مواقع بعد. اضغط «إضافة موقع» والصق رابط موقعك المتفق معه.</div>';
    }
    $('main').innerHTML = html;
  }

  /* ---------------------------------------------------------------- the cinema look: hero, top 10, categories, rows (movies) and rows of channels */
  var VPILLS = [['h', 'الرئيسية'], ['m', 'أفلام'], ['s', 'مسلسلات'], ['w', 'مواقعي']];
  var cin = { flat: [], hero: 0, timer: null, io: null, cat: '', pool: [] }, chFlat = [];
  function hue(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }
  function ar0(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
  function topList() {
    var all = VOD.m.concat(VOD.s).filter(function (c) { return c.img; });
    var rated = all.filter(function (c) { return c.rt > 0; }), added = all.filter(function (c) { return c.add > 0; });
    if (rated.length >= 10) return rated.sort(function (a, b) { return b.rt - a.rt; }).slice(0, 10);
    if (added.length >= 10) return added.sort(function (a, b) { return b.add - a.add; }).slice(0, 10);
    return all.slice(0, 10);
  }
  function playItem(it) { if (!it) return; if (it.t === 'xs') openSeries(it); else playPack([it], 0, true); }
  function metaOf(it) { return (it.rt > 0 ? '<span class="rt">★ ' + ar0(it.rt.toFixed(1)) + '</span>' : '') + '<span>' + (it.t === 'xs' || /مسلسل/.test(it.g) ? 'مسلسل' : 'فيلم') + '</span>' + (it.g ? '<span>' + esc(it.g) + '</span>' : ''); }
  function detailSheet(it) {
    if (!it) return;
    var u = esc(logoOf(it));
    showSheet('<div class="dt"><div class="dtb" style="background-image:url(\'' + u + '\')"></div><div class="dti"><div class="art poster dtp">' + ini(it.n) + (u ? '<img src="' + u + '" alt="" onerror="this.remove()">' : '') + '</div><div class="dtx"><h3>' + esc(it.n) + '</h3><div class="hmeta">' + metaOf(it) + '</div></div></div>' +
      (it.pl ? '<p class="dpl">' + esc(it.pl) + '</p>' : '') + '<div class="dbtn"><button class="btn" id="dPlay">▶ شاهد الآن</button><button class="btn sec" id="dFav">' + (isFav(it) ? '✓ بقائمتي' : '＋ قائمتي') + '</button></div></div>');
    $('dPlay').onclick = function () { $('sheet').classList.remove('on'); playItem(it); };
    $('dFav').onclick = function () { var on = toggleFav(it); $('dFav').textContent = on ? '✓ بقائمتي' : '＋ قائمتي'; };
  }
  function heroAct(a) {
    var it = cin.pool[cin.hero]; if (!it) return;
    if (a === 'play') detailSheet(it);
    else if (a === 'list') { var on = toggleFav(it); toast(on ? 'انضاف لقائمتي' : 'انشال من قائمتي'); }
    else { var all = VOD.m.concat(VOD.s); if (all.length) detailSheet(all[Math.floor(Math.random() * all.length)]); }
  }
  function heroHtml(it) {
    var u = esc(logoOf(it));
    return '<div class="hbg" style="background-image:url(\'' + u + '\')"></div><div class="hsh"></div><div class="hin"><div class="hbd">الأكثر رواجاً ' + ar0(cin.hero + 1) + '</div><h2>' + esc(it.n) + '</h2><div class="hmeta">' + metaOf(it) + '</div>' +
      '<div class="hbt"><button class="pri" data-ha="play">▶ شاهد الآن</button><button data-ha="list">＋ قائمتي</button><button data-ha="rnd">⤮ عشوائي</button></div></div>' +
      '<div class="hdt">' + cin.pool.map(function (x, i) { return '<i' + (i === cin.hero ? ' class="on"' : '') + '></i>'; }).join('') + '</div>';
  }
  function observe() {
    try { if (cin.io) cin.io.disconnect(); } catch (e) {}
    var els = $('main').querySelectorAll('.rv');
    if (!window.IntersectionObserver) { [].forEach.call(els, function (e) { e.classList.add('in'); }); return; }
    cin.io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); cin.io.unobserve(x.target); } }); }, { root: $('main'), threshold: .08 });
    [].forEach.call(els, function (e) { cin.io.observe(e); });
  }
  /* the hero follows the scroll a little (parallax) */
  var rafP = 0;
  $('main').addEventListener('scroll', function () {
    if (rafP) return; rafP = requestAnimationFrame(function () { rafP = 0; var b = document.querySelector('.hero .hbg'); if (b) b.style.transform = 'translateY(' + Math.min(160, $('main').scrollTop * .35) + 'px) scale(1.12)'; });
  }, { passive: true });
  function skeleton(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="card sk"><div class="art poster"></div><b>&nbsp;</b></div>'; return '<div class="hs">' + h + '</div>'; }
  function drawCinema() {
    if (cin.timer) { clearInterval(cin.timer); cin.timer = null; }
    $('top').innerHTML = chips(VPILLS, 'h', 'vs');
    if (!VOD.loaded) { $('main').innerHTML = '<div class="hero sk"></div><div class="sh">جاري التحميل…</div>' + skeleton(6); return; }
    var all = VOD.m.concat(VOD.s);
    if (!all.length) { $('main').innerHTML = '<div class="empty">ماكو أفلام ومسلسلات بعد.<br>أضف حساب IPTV أو رابط قائمة من الإعدادات، أو افتح تبويب «مواقعي» وأضف موقعك.</div><div style="padding:0 16px"><button class="btn" id="goSet">فتح الإعدادات</button> <button class="btn sec" id="goSites">مواقعي</button></div>'; $('goSet').onclick = function () { show('set'); }; $('goSites').onclick = function () { st.vod.sub = 'w'; drawVod(); }; return; }
    cin.flat = []; var top = topList(); cin.pool = top.slice(0, 5); cin.hero = 0;
    function card(it) { var i = cin.flat.push(it) - 1; return '<div class="card" data-cm="' + i + '" style="animation-delay:' + Math.min(i % 12, 8) * 40 + 'ms">' + art(it, true) + '<b>' + esc(it.n) + '</b></div>'; }
    var html = cin.pool.length ? '<div class="hero" id="hero">' + heroHtml(cin.pool[0]) + '</div>' : '';
    if (top.length) html += '<div class="sh rv">الأكثر رواجاً · أعلى ١٠</div><div class="hs t10 rv">' + top.map(function (it, i) { var k = cin.flat.push(it) - 1; return '<div class="tn" data-cm="' + k + '"><span class="nm">' + ar0(i + 1) + '</span>' + art(it, true) + '</div>'; }).join('') + '</div>';
    var rec = J('mRec', []).filter(function (x) { return x.t; });
    if (rec.length) html += '<div class="sh rv">تابع المشاهدة</div><div class="hs rv">' + rec.slice(0, 14).map(card).join('') + '</div>';
    var by = {}; all.forEach(function (c) { var g = c.g || 'بدون تصنيف'; (by[g] = by[g] || []).push(c); });
    var gs = Object.keys(by).sort(function (a, b) { return by[b].length - by[a].length; });
    html += '<div class="sh rv">التصنيفات</div><div class="hs cats rv">' + gs.slice(0, 16).map(function (g) {
      var first = by[g].filter(function (c) { return c.img; })[0], hh = hue(g);
      return '<div class="ct" data-cc="' + esc(g) + '" style="background-image:linear-gradient(135deg,hsla(' + hh + ',75%,34%,.92),rgba(0,0,0,.85))' + (first ? ',url(\'' + esc(first.img) + '\')' : '') + '"><b>' + esc(g) + '</b><small>' + ar0(by[g].length) + '</small></div>';
    }).join('') + '</div>';
    gs.slice(0, 8).forEach(function (g) {
      var l = by[g].filter(function (c) { return c.img; }).slice(0, 24); if (l.length < 3) l = by[g].slice(0, 24);
      html += '<div class="sh rv"><span>' + esc(g) + '</span><a data-cc="' + esc(g) + '">المزيد ‹</a></div><div class="hs rv">' + l.map(card).join('') + '</div>';
    });
    $('main').innerHTML = html; $('main').scrollTop = 0; observe();
    if (cin.pool.length > 1) cin.timer = setInterval(function () {
      var h = $('hero'); if (!h || tab !== 'vod' || st.vod.sub !== 'h') { clearInterval(cin.timer); cin.timer = null; return; }
      cin.hero = (cin.hero + 1) % cin.pool.length; h.classList.remove('swap'); void h.offsetWidth; h.innerHTML = heroHtml(cin.pool[cin.hero]); h.classList.add('swap');
    }, 6500);
  }
  function drawCinemaCat() {
    $('top').innerHTML = chips(VPILLS, 'c', 'vs') + '<div class="tools"><button id="catBack">‹ الرئيسية</button></div>';
    var l = VOD.m.concat(VOD.s).filter(function (c) { return (c.g || 'بدون تصنيف') === cin.cat; }); cin.flat = [];
    $('main').innerHTML = '<div class="sh">' + esc(cin.cat) + ' · ' + ar0(l.length) + '</div><div class="grid">' + l.slice(0, 200).map(function (it, i) { var k = cin.flat.push(it) - 1; return '<div class="card" data-cm="' + k + '" style="animation-delay:' + Math.min(i, 12) * 30 + 'ms">' + art(it, true) + '<b>' + esc(it.n) + '</b></div>'; }).join('') + '</div>';
    $('main').scrollTop = 0;
    $('catBack').onclick = function () { st.vod.sub = 'h'; drawVod(); };
  }
  /* channels: «now playing» card, then rows of channel tiles by group */
  function drawLiveHome(keepTop) {
    var s = st.live;
    if (!keepTop) { $('top').innerHTML = searchBox(s.q, 'ابحث عن قناة…') + chips(liveCats(), s.cat, 'lc') + '<div class="tools"><button id="rnd">قناة عشوائية</button><button id="siteBtn">فتح موقع</button></div>'; bindSearch(s, drawLive); }
    var all = liveAll(); chFlat = [];
    if (!all.length) { $('main').innerHTML = '<div class="empty">جاري التحميل…</div>'; return; }
    function tile(c) { var i = chFlat.push(c) - 1; return '<div class="ch" data-ci="' + i + '" style="animation-delay:' + Math.min(i % 14, 10) * 30 + 'ms"><div class="art">' + ini(c.n) + (logoOf(c) ? '<img loading="lazy" src="' + esc(logoOf(c)) + '" alt="" onerror="this.remove()">' : '') + '<i class="lv"></i></div><b>' + esc(c.n) + '</b></div>'; }
    var recent = J('mRec', []).filter(function (x) { return !x.t; }), last = recent[0] || all[0], html = '';
    var ni = chFlat.push(last) - 1;
    html += '<div class="now rv in" data-now="' + ni + '"><div class="nb"></div><div class="art">' + ini(last.n) + (logoOf(last) ? '<img src="' + esc(logoOf(last)) + '" alt="" onerror="this.remove()">' : '') + '</div><div class="nt"><span class="live"><i></i>مباشر</span><h3>' + esc(last.n) + '</h3><small>' + (recent[0] ? 'كمّل من حيث وقفت' : 'ابدأ المشاهدة') + '</small></div><div class="np">▶</div></div>';
    var rows = [], mine = (S.myCh || []).length ? all.filter(function (c) { return c.mine; }) : [];
    if (mine.length) rows.push(['قنواتي المضافة', mine]);
    var fv = favList().filter(function (f) { return !f.t; }); if (fv.length) rows.push(['المفضلة', fv]);
    if (recent.length > 1) rows.push(['آخر ما شاهدت', recent.slice(0, 20)]);
    rows.push(['قنوات عراقية', all.filter(function (c) { return c.c === 'iq'; })]);
    [['movies', 'أفلام ومسلسلات'], ['ent', 'منوعات وترفيه'], ['news', 'أخبار'], ['sport', 'رياضة'], ['kids', 'أطفال'], ['docs', 'وثائقية'], ['quran', 'قرآن ومرجعيات']].forEach(function (r) { rows.push([r[1], all.filter(function (c) { return c.g === r[0] && !c.mine; })]); });
    rows.forEach(function (r) {
      if (r[1].length < 2) return;
      html += '<div class="sh rv">' + esc(r[0]) + '</div><div class="hs chs rv">' + r[1].slice(0, 40).map(tile).join('') + '</div>';
    });
    $('main').innerHTML = html; $('main').scrollTop = 0; observe();
  }

  /* ---------------------------------------------------------------- series sheet */
  function openSeries(it) {
    var x = xt(); if (!x) return;
    $('sheetIn').innerHTML = '<h3>' + esc(it.n) + '</h3><div class="empty">جاري تحميل الحلقات…</div>'; $('sheet').classList.add('on');
    xjson(x, 'get_series_info', '&series_id=' + it.id).then(function (j) {
      var eps = [], seasons = (j && j.episodes) || {};
      Object.keys(seasons).sort(function (a, b) { return a - b; }).forEach(function (sn) { (seasons[sn] || []).forEach(function (e) { eps.push({ t: 'xe', n: 'م' + sn + ' · ح' + (e.episode_num || '') + (e.title ? ' · ' + e.title : ''), u: x.host + '/series/' + cred(x) + e.id + '.' + (e.container_extension || 'mp4'), img: (e.info && e.info.movie_image) || it.img }); }); });
      $('sheetIn').innerHTML = '<h3>' + esc(it.n) + '</h3>' + (eps.length ? eps.map(function (e, i) { return '<div class="row" data-e="' + i + '"><div class="tx"><b>' + esc(e.n) + '</b></div></div>'; }).join('') : '<div class="empty">ماكو حلقات</div>');
      [].forEach.call($('sheetIn').querySelectorAll('[data-e]'), function (r) { r.onclick = function () { $('sheet').classList.remove('on'); var e = eps[+r.getAttribute('data-e')]; A.play(JSON.stringify({ vod: 1, list: [{ n: it.n + ' · ' + e.n, u: e.u }] }), 0); }; });
    });
  }

  /* ---------------------------------------------------------------- events */
  function show(t) {
    tab = t; [].forEach.call($('nav').children, function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
    if (t === 'live') drawLive(); else if (t === 'vod') drawVod(); else if (t === 'fav') drawFav(); else drawSet();
  }
  function applyName() { $('vodTab').textContent = String(S.vodName || '').trim() || 'الأفلام'; }
  $('nav').onclick = function (e) { var b = e.target.closest('button'); if (b) show(b.getAttribute('data-t')); };
  $('main').onclick = function (e) {
    var t = e.target;
    if (t.id === 'more') { (tab === 'live' ? st.live : st.vod).more += PAGE; tab === 'live' ? drawLive(true) : drawVod(true); return; }
    var cmk = t.closest('[data-cm]'); if (cmk) { detailSheet(cin.flat[+cmk.getAttribute('data-cm')]); return; }
    var cck = t.closest('[data-cc]'); if (cck) { cin.cat = cck.getAttribute('data-cc'); st.vod.sub = 'c'; drawVod(); return; }
    var hak = t.closest('[data-ha]'); if (hak) { heroAct(hak.getAttribute('data-ha')); return; }
    var cik = t.closest('[data-ci]'); if (cik) { var chn = chFlat[+cik.getAttribute('data-ci')]; if (chn) playPack([chn], 0, false); return; }
    var nwk = t.closest('[data-now]'); if (nwk) { var nc = chFlat[+nwk.getAttribute('data-now')]; if (nc) playPack([nc], 0, false); return; }
    var sd = t.closest('[data-sd]'); if (sd) { removeSite(sd.getAttribute('data-sd')); e.stopPropagation(); return; }
    var stc = t.closest('[data-st]'); if (stc) { openSiteView(stc.getAttribute('data-st')); return; }
    var sl = t.closest('[data-sl]'); if (sl) { var it0 = siteFlat[+sl.getAttribute('data-sl')]; if (it0) { toast('جاري تجهيز التشغيل…'); A.playSite(it0.u); } return; }
    var ed = t.closest('[data-ed]'); if (ed) { var c0 = (S.myCh || [])[+ed.getAttribute('data-ed')]; if (c0) chSheet({ ix: +ed.getAttribute('data-ed'), n: c0.n, u: c0.u, l: c0.l }); e.stopPropagation(); return; }
    var s = t.closest('[data-s]'); if (s) { var c = cur[+s.getAttribute('data-s')]; s.classList.toggle('on', toggleFav(c)); e.stopPropagation(); return; }
    var fs = t.closest('[data-fs]'); if (fs) { toggleFav(cur[+fs.getAttribute('data-fs')]); drawFav(); return; }
    var r = t.closest('[data-i]'); if (r) { playPack(cur, +r.getAttribute('data-i'), false); return; }
    var f = t.closest('[data-f]'); if (f) { var it = cur[+f.getAttribute('data-f')]; if (it.t === 'xs') openSeries(it); else if (it.t) playPack([it], 0, true); else playPack(cur.filter(function (z) { return !z.t; }), cur.filter(function (z) { return !z.t; }).indexOf(it), false); return; }
    var v = t.closest('[data-v]'); if (v) { var it2 = cur[+v.getAttribute('data-v')]; if (it2.t === 'xs') openSeries(it2); else playPack([it2], 0, true); }
  };
  var lp = null;
  $('main').addEventListener('touchstart', function (e) { var v = e.target.closest('[data-v]'); if (!v) return; lp = setTimeout(function () { var it = cur[+v.getAttribute('data-v')]; toast(toggleFav(it) ? 'انضاف للمفضلة' : 'انشال من المفضلة'); drawVod(true); lp = 'done'; }, 600); }, { passive: true });
  $('main').addEventListener('touchend', function (e) { if (lp === 'done') { e.preventDefault(); } clearTimeout(lp); lp = null; });
  $('main').addEventListener('touchmove', function () { clearTimeout(lp); lp = null; }, { passive: true });
  $('top').onclick = function (e) {
    var t = e.target.closest('[data-lc],[data-vs],[data-vc],#rnd,#vrf,#siteBtn,#siteAdd,#siteBack,#siteRef'); if (!t) return;
    if (t.id === 'siteAdd') { addSiteSheet(); return; }
    if (t.id === 'siteBack') { siteView = null; drawSites(); return; }
    if (t.id === 'siteRef') { var sx = siteById(siteView); if (sx) { toast('جاري قراءة الموقع…'); A.readSite(sx.url); } return; }
    if (t.id === 'siteBtn') { siteSheet(); return; }
    if (t.id === 'rnd') { var all = liveAll(); if (all.length) { var i = Math.floor(Math.random() * all.length); toast(all[i].n); playPack(all, i, false); } return; }
    if (t.id === 'vrf') { toast('جاري التحديث…'); lastErr = ''; loadVod(true).then(function () { drawVod(); }); return; }
    if (t.hasAttribute('data-lc')) { st.live.cat = t.getAttribute('data-lc'); st.live.more = PAGE; st.live.q = ''; drawLive(); }
    else if (t.hasAttribute('data-vs')) { st.vod.sub = t.getAttribute('data-vs'); st.vod.cat = '*'; st.vod.more = PAGE; st.vod.q = ''; drawVod(); }
    else { st.vod.cat = t.getAttribute('data-vc'); st.vod.more = PAGE; st.vod.q = ''; drawVod(); }
  };
  $('sheet').onclick = function (e) { if (e.target === $('sheet')) $('sheet').classList.remove('on'); };
  /* widgets and the app-icon menu open a place from outside; false = not ready yet, the app tries again */
  window.__route = function (r) {
    try {
      if (typeof isActive === 'function' && !isActive()) return true;
      if (r === 'live' || r === 'vod' || r === 'fav' || r === 'set') { show(r); return true; }
      if (r === 'search') { show('live'); setTimeout(function () { var q = document.querySelector('.search'); q && q.focus(); }, 300); return true; }
      if (r === 'quiet') { S.quietOn = !S.quietOn; save(); toast(S.quietOn ? 'وضع الهدوء شغّال' : 'وضع الهدوء متوقف'); return true; }
      if (r === 'random') { var all = liveAll(); if (all.length) { var i = Math.floor(Math.random() * all.length); toast(all[i].n); playPack(all, i, false); } return true; }
      if (r === 'resume' || r.indexOf('fav:') === 0) {
        var src = r === 'resume' ? J('mRec', []) : J('mFav', []), it = r === 'resume' ? src[0] : src[+r.split(':')[1]];
        if (!it) { show(r === 'resume' ? 'live' : 'fav'); return true; }
        if (it.t === 'xs') { openSeries(it); return true; }
        if (it.t) { playPack([it], 0, true); return true; }
        var live = liveAll(), k = -1; for (var z = 0; z < live.length; z++) if (favKey(live[z]) === favKey(it)) { k = z; break; }
        if (k >= 0) playPack(live, k, false); else playPack([it], 0, false);
        return true;
      }
    } catch (e) { return false; }
    return false;
  };
  mirror();
  window.onBack = function () { if ($('sheet').classList.contains('on')) { $('sheet').classList.remove('on'); return true; } if ($('greet').classList.contains('on')) { $('greet').classList.remove('on'); return true; } if (tab !== 'live') { show('live'); return true; } return false; };

  /* ---------------------------------------------------------------- the welcome, then go */
  function greet() {
    if (S.greetOn === false) return;
    var h = new Date().getHours(), g = h >= 4 && h < 11 ? 'صباح الخير' : h >= 11 && h < 17 ? 'طاب يومك' : h >= 17 && h < 20 ? 'مساء الخير' : 'ليلة طيبة', nm = String(S.ownerName || '').trim(), el = $('greet');
    el.innerHTML = '<div><span>' + esc(g) + '</span>' + (nm ? '<span class="nm">' + esc(nm) + '</span>' : '') + '<div class="rule"></div></div>'; el.classList.add('on');
    var close = function () { el.classList.add('out'); setTimeout(function () { el.classList.remove('on', 'out'); }, 500); };
    el.onclick = close; setTimeout(close, nm ? 3600 : 2900);
  }
  /* the app opens only on a phone that was activated: the code is made in «مدير الشاشة» from this phone's device code */
  function isActive() { try { return !!A.active(); } catch (e) { return false; } }
  function showLock() {
    var el = $('lock'), dev = '';
    try { dev = A.deviceCode(); } catch (e) {}
    el.innerHTML = '<div class="lk"><div class="mark"><svg viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="13" rx="3"/><path d="M8 3l4 4 4-4"/><circle cx="12" cy="13.5" r="1.6" fill="#fff" stroke="none"/><path d="M15.2 10.3a4.5 4.5 0 0 1 0 6.4M8.8 16.7a4.5 4.5 0 0 1 0-6.4"/></svg></div>' +
      '<h2>تفعيل قنواتي</h2><p>ابعث رمز جهازك هذا لمدير الشاشة، وهو يرجّعلك كود التفعيل. يشتغل على موبايلك بس.</p>' +
      '<div class="code">' + esc(dev) + '</div><button class="btn sec" id="lkShare">مشاركة رمز الجهاز</button>' +
      '<input id="lkIn" maxlength="11" placeholder="XXXXX-XXXXX" autocapitalize="characters" autocomplete="off"><div class="msg" id="lkMsg"></div><button class="btn" id="lkGo">تفعيل</button></div>';
    el.classList.add('on');
    $('lkShare').onclick = function () { A.share('رمز جهازي لتفعيل «قنواتي موبايل»:\n' + dev); };
    $('lkGo').onclick = function () {
      var ok = false; try { ok = A.activate($('lkIn').value); } catch (e) {}
      if (ok) { el.classList.remove('on'); begin(); }
      else { $('lkMsg').textContent = 'الكود غير صحيح، أو مخصّص لجهاز ثاني'; var b = el.querySelector('.lk'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    };
  }
  function begin() { applyName(); greet(); setTimeout(checkClip, 3800); drawLive(); loadLive(false).then(function () { if (tab === 'live') drawLive(); }); loadVod(false).then(function () { if (tab === 'vod') drawVod(); }); }
  if (isActive()) begin(); else showLock();
  window.__mobile = { S: S, parseM3U: parseM3U };
})();
