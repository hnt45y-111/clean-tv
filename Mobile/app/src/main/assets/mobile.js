/* «قنواتي موبايل»: the channels and the films of the TV app, for the phone. Touch, RTL, Arabic.
   Sources: the free channels that ship with the app, and what the user adds himself (an Xtream account, M3U links, direct links). */
(function () {
  'use strict';
  var A = window.Android, TTL = 6 * 3600000, PAGE = 150;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function J(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function W(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
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
      (r[1] || []).forEach(function (o) { m.push({ t: 'xm', n: String(o.name || '').trim(), u: x.host + '/movie/' + cred(x) + o.stream_id + '.' + (o.container_extension || 'mp4'), img: o.stream_icon || '', g: cm[o.category_id] || 'بدون تصنيف' }); });
      (r[3] || []).forEach(function (o) { s.push({ t: 'xs', n: String(o.name || '').trim(), id: o.series_id, img: o.cover || '', g: cs[o.category_id] || 'بدون تصنيف' }); });
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
    var lo = Math.max(0, i - 250), sl = list.slice(lo, lo + 500);
    A.play(JSON.stringify({ vod: vod ? 1 : 0, list: sl.map(function (c) { return { n: c.n, u: c.u, ua: c.ua || '', r: c.r || '' }; }) }), i - lo);
    pushRecent(list[i]);
  }

  /* ---------------------------------------------------------------- views */
  var tab = 'live', st = { live: { cat: 'all', q: '', more: PAGE }, vod: { sub: 'm', cat: '*', q: '', more: PAGE } }, cur = [];
  function ini(n) { return esc(String(n).replace(/^ال/, '').replace(/\s/g, '').slice(0, 2)); }
  function logoOf(c) { return c.i ? 'logos/' + c.i + '.png' : (c.l || c.img || ''); }
  function art(c, poster) { var u = logoOf(c); return '<div class="art' + (poster ? ' poster' : '') + '">' + ini(c.n) + (u ? '<img loading="lazy" src="' + esc(u) + '" alt="" onerror="this.remove()">' : '') + '</div>'; }
  var STAR = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
  function chips(list, on, attr) { return '<div class="chips">' + list.map(function (c) { return '<div class="chip' + (c[0] === on ? ' on' : '') + '" data-' + attr + '="' + esc(c[0]) + '">' + esc(c[1]) + '</div>'; }).join('') + '</div>'; }
  function searchBox(q, ph) { return '<input class="search" id="q" type="search" placeholder="' + ph + '" value="' + esc(q) + '">'; }
  function bindSearch(o, redraw) { var q = $('q'); if (!q) return; q.oninput = function () { o.q = q.value.trim(); o.more = PAGE; var pos = q.selectionStart; redraw(true); var n = $('q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }; }

  function liveAll() {
    var base = (window.CHANNELS || []).map(function (c) { return c; });
    return base.concat(LIVE.user.map(function (c) { return { n: c.n, u: c.u, l: c.l, g: 'my', c: 'my', grp: c.g, ua: c.ua, r: c.r }; }));
  }
  function liveCats() {
    var l = CATS.slice(), seen = {}, all = liveAll();
    all.forEach(function (c) { if (c.grp && !seen[c.grp]) { seen[c.grp] = 1; } });
    var pre = [['fav', 'المفضلة'], ['rec', 'آخر ما شاهدت']];
    var grps = Object.keys(seen).slice(0, 60).map(function (g) { return ['g:' + g, g]; });
    return pre.concat(l).concat(grps);
  }
  function liveFilter() {
    var s = st.live, all = liveAll(), l;
    if (s.cat === 'fav') l = favList().filter(function (f) { return !f.t; });
    else if (s.cat === 'rec') l = J('mRec', []).filter(function (f) { return !f.t; });
    else if (s.cat === 'all') l = all;
    else if (s.cat.indexOf('g:') === 0) l = all.filter(function (c) { return c.grp === s.cat.slice(2); });
    else if (s.cat === 'mbc' || s.cat === 'karbala') l = all.filter(function (c) { return c.p === s.cat; });
    else l = all.filter(function (c) { return c.g === s.cat; });
    if (s.q) { var w = s.q.toLowerCase(); l = (s.cat === 'all' ? all : l).filter(function (c) { return String(c.n).toLowerCase().indexOf(w) >= 0; }); }
    return l;
  }
  function drawLive(keepTop) {
    var s = st.live; cur = liveFilter();
    var rows = cur.slice(0, s.more).map(function (c, i) { return '<div class="row" data-i="' + i + '">' + art(c) + '<div class="tx"><b>' + esc(c.n) + '</b><small>' + esc(c.grp || c.g && catName(c.g) || '') + '</small></div><span class="star' + (isFav(c) ? ' on' : '') + '" data-s="' + i + '">' + STAR + '</span></div>'; }).join('');
    var more = cur.length > s.more ? '<button class="btn sec" id="more">عرض المزيد (' + (cur.length - s.more) + ')</button>' : '';
    var empty = !cur.length ? '<div class="empty">' + (s.cat === 'fav' ? 'ماكو مفضلة بعد. اضغط النجمة جنب أي قناة.' : s.cat === 'rec' ? 'ما شاهدت شي بعد.' : s.q ? 'ماكو قناة بهذا الاسم' : !LIVE.loaded ? 'جاري التحميل…' : 'ماكو قنوات بهذا القسم' + (lastErr ? '<br>' + esc(lastErr) : '')) + '</div>' : '';
    if (!keepTop) { $('top').innerHTML = searchBox(s.q, 'ابحث عن قناة…') + chips(liveCats(), s.cat, 'lc') + '<div class="tools"><button id="rnd">قناة عشوائية</button></div>'; bindSearch(s, drawLive); }
    $('main').innerHTML = rows + more + empty;
  }
  function catName(g) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === g) return CATS[i][1]; return ''; }

  function vodCats() { var l = VOD[st.vod.sub], seen = {}; l.forEach(function (c) { seen[c.g] = 1; }); return [['*', 'الكل (' + l.length + ')']].concat(Object.keys(seen).slice(0, 80).map(function (g) { return [g, g]; })); }
  function vodFilter() { var s = st.vod, l = VOD[s.sub]; if (s.cat !== '*') l = l.filter(function (c) { return c.g === s.cat; }); if (s.q) { var w = s.q.toLowerCase(); l = VOD[s.sub].filter(function (c) { return String(c.n).toLowerCase().indexOf(w) >= 0; }); } return l; }
  function drawVod(keepTop) {
    var s = st.vod; cur = vodFilter();
    var cards = cur.slice(0, s.more).map(function (c, i) { return '<div class="card" data-v="' + i + '" style="position:relative">' + art(c, true) + (isFav(c) ? '<span class="fv">' + STAR + '</span>' : '') + '<b>' + esc(c.n) + '</b></div>'; }).join('');
    var msg = !VOD.loaded ? 'جاري التحميل…' : (!xt() && !String(S.vodLinks || '').trim() && !(S.vodItems || []).length) ? 'أضف حساب IPTV أو رابط قائمة من الإعدادات (أو من «الربط الذكي»).' : lastErr ? 'تعذّر جلب المحتوى (' + esc(lastErr) + ')' : s.q ? 'ماكو نتيجة' : 'ماكو محتوى بهذا القسم';
    if (!keepTop) { $('top').innerHTML = searchBox(s.q, 'ابحث عن فيلم أو مسلسل…') + chips([['m', 'أفلام'], ['s', 'مسلسلات']], s.sub, 'vs') + chips(vodCats(), s.cat, 'vc') + '<div class="tools"><button id="vrf">تحديث القائمة</button></div>'; bindSearch(s, drawVod); }
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
    $('smGo').onclick = function () {
      var out = $('smOut'); out.innerHTML = '<div class="res">جاري الفحص…</div>';
      window.SmartLink.identify($('smUrl').value).then(function (r) {
        var ok = !!r.apply, T = { live: 'للقنوات', vod: 'للأفلام والمسلسلات', both: 'للاثنين' };
        out.innerHTML = '<div class="res"><b>' + esc(r.label) + '</b><small>' + esc(r.detail) + '</small></div>' + (ok ? (r.targets || ['both']).map(function (t) { return '<button class="btn" data-t="' + t + '">أضفه ' + T[t] + '</button>'; }).join('') : '') + '<button class="btn sec" id="smLog">نسخ التشخيص</button>';
        [].forEach.call(out.querySelectorAll('[data-t]'), function (b) { b.onclick = function () { r.apply(S, b.getAttribute('data-t')); save(); refreshAll('انضاف ' + T[b.getAttribute('data-t')]); }; });
        $('smLog').onclick = function () { A.copy(window.SmartLink.logText(r)); toast('انسخ التشخيص'); };
      });
    };
  }
  function refreshAll(msg) { lastErr = ''; LIVE.loaded = VOD.loaded = false; W('mLive', null); W('mVod', null); toast(msg + ' · جاري التحديث…'); loadLive(true).then(function () { if (tab === 'live') drawLive(); }); loadVod(true).then(function () { if (tab === 'vod') drawVod(); }); }

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
    var t = e.target.closest('[data-lc],[data-vs],[data-vc],#rnd,#vrf'); if (!t) return;
    if (t.id === 'rnd') { var all = liveAll(); if (all.length) { var i = Math.floor(Math.random() * all.length); toast(all[i].n); playPack(all, i, false); } return; }
    if (t.id === 'vrf') { toast('جاري التحديث…'); lastErr = ''; loadVod(true).then(function () { drawVod(); }); return; }
    if (t.hasAttribute('data-lc')) { st.live.cat = t.getAttribute('data-lc'); st.live.more = PAGE; st.live.q = ''; drawLive(); }
    else if (t.hasAttribute('data-vs')) { st.vod.sub = t.getAttribute('data-vs'); st.vod.cat = '*'; st.vod.more = PAGE; st.vod.q = ''; drawVod(); }
    else { st.vod.cat = t.getAttribute('data-vc'); st.vod.more = PAGE; st.vod.q = ''; drawVod(); }
  };
  $('sheet').onclick = function (e) { if (e.target === $('sheet')) $('sheet').classList.remove('on'); };
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
  function begin() { applyName(); greet(); drawLive(); loadLive(false).then(function () { if (tab === 'live') drawLive(); }); loadVod(false).then(function () { if (tab === 'vod') drawVod(); }); }
  if (isActive()) begin(); else showLock();
  window.__mobile = { S: S, parseM3U: parseM3U };
})();
