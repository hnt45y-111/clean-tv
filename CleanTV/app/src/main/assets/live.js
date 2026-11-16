/* «قنواتي»: free live channels. The list comes from channels.js; playing is done by the native player (Android.playLive).
   ES5 on purpose (old TV WebViews). Keys: right/left switches between the groups column and the channel grid. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var VIEWS = [['grid', 'شبكة', 4], ['list', 'قائمة', 1], ['big', 'بطاقات كبيرة', 3], ['logos', 'شعارات', 6]];
  var COLS = 4, st = { f: 'grid', ci: 0, gi: 0, list: [], off: 0, vi: 0 };
  try { var sv = localStorage.getItem('lvView'); VIEWS.forEach(function (v, i) { if (v[0] === sv) st.vi = i; }); } catch (e) {}
  function setView(i) { st.vi = i; COLS = VIEWS[i][2]; try { localStorage.setItem('lvView', VIEWS[i][0]); } catch (e) {} st.off = 0; }
  COLS = VIEWS[st.vi][2];
  st.hi = st.vi; st.ti = 0; st.edit = false; st.del = false; st.pick = null; st.q = ''; st.ver = 0;
  /* the user's own order of folders and channels (changed from the «ترتيب» chip) */
  function loadOrd() { try { var o = JSON.parse(localStorage.getItem('lvOrd') || '{}') || {}; o.cats = o.cats || []; o.ch = o.ch || {}; return o; } catch (e) { return { cats: [], ch: {} }; } }
  var ORD = loadOrd();
  function saveOrd() { try { localStorage.setItem('lvOrd', JSON.stringify(ORD)); } catch (e) {} st.ver++; st.key = null; }
  function keyOf(c) { return c.folder ? 'F:' + c.key : c.u + '|' + c.n; }
  function sortBy(list, keys, keyFn) {
    if (!keys || !keys.length || list.length < 2) return list;
    var pos = {}; keys.forEach(function (k, i) { pos[k] = i; });
    return list.map(function (x, i) { return [x, i]; }).sort(function (a, b) { var pa = pos[keyFn(a[0])], pb = pos[keyFn(b[0])]; pa = pa == null ? 1e6 + a[1] : pa; pb = pb == null ? 1e6 + b[1] : pb; return pa - pb; }).map(function (p) { return p[0]; });
  }
  var CATS = [['all', 'كل القنوات'], ['news', 'أخبار'], ['sport', 'رياضة'], ['movies', 'أفلام ومسلسلات'], ['docs', 'وثائقية'], ['ent', 'منوعات وترفيه'], ['mbc', 'باقة MBC المجانية'], ['karbala', 'باقة قنوات كربلاء'], ['kids', 'أطفال'], ['quran', 'قرآن ومرجعيات'], ['iq', 'قنوات عراقية']];
  function cats() {
    var l = CATS.map(function (c) { return { id: c[0], n: c[1], kind: 'cat' }; });
    if (sitesList().length) l.push({ id: 'sites', n: 'مواقع القنوات', kind: 'sites' });
    var seen = {};
    (window.CHANNELS || []).forEach(function (c) { seen[c.c] = 1; });
    (window.CH_GROUPS || []).forEach(function (g) { if (seen[g[0]] && g[0] !== 'iq') l.push({ id: g[0], n: 'قنوات ' + g[1], kind: 'grp' }); });
    /* the user's own channels live in one folder, always the last one */
    if (custom().lists.length) l.push({ id: 'my', n: '📁 قنواتي الخاصة', kind: 'my' });
    return sortBy(l, ORD.cats, function (c) { return c.id; });
  }
  /* the user's own channels (licensed streams he adds from the phone app: pasted M3U text or a link to a list) */
  var cust = { lists: [], list: [], groups: [], key: '' };
  function isYT(u) { return /(youtube\.com|youtu\.be)\//i.test(u); }
  function ytId(u) { var m = String(u).match(/(?:[?&]v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{6,})/); return m ? m[1] : ''; }
  function ytTitles() { try { return JSON.parse(localStorage.getItem('myChTitles') || '{}') || {}; } catch (e) { return {}; } }
  function ytTitle(u) { var t = ytTitles()[u]; return t || ('يوتيوب · ' + (ytId(u) || 'قناة')); }
  function parseM3U(text) {
    var out = [], lines = String(text || '').replace(/^\uFEFF/, '').split(/\r\n|\n|\r/), cur = null;
    lines.forEach(function (ln) {
      ln = ln.trim(); if (!ln) return;
      if (ln.indexOf('#EXTINF') === 0) {
        var nm = (ln.match(/,(.*)$/) || [0, ''])[1].trim(), gr = (ln.match(/group-title="([^"]*)"/) || [0, ''])[1], lg = (ln.match(/tvg-logo="([^"]*)"/) || [0, ''])[1];
        cur = { n: nm, grp: gr, l: lg };
      } else if (ln.indexOf('#EXTVLCOPT') === 0 && cur) {
        var m = ln.match(/http-(referrer|referer|user-agent)=(.*)/i); if (m) { if (/^refer/i.test(m[1])) cur.r = m[2]; else cur.ua = m[2]; }
      } else if (ln.charAt(0) !== '#' && /^https?:/i.test(ln)) {
        var c = cur || { n: ln, grp: '', l: '', bare: 1 }; c.u = ln; if (isYT(ln) && (c.bare || !c.n)) { c.n = ytTitle(ln); c.bare = 1; } c.c = 'my'; c.g = guessCat(c.n + ' ' + c.grp); out.push(c); cur = null;
      }
    });
    return out;
  }
  function guessCat(t) {
    t = String(t).toLowerCase();
    if (/sport|bein|رياض|كأس|مباري/.test(t)) return 'sport';
    if (/news|أخبار|اخبار|نيوز|إخبار/.test(t)) return 'news';
    if (/movie|film|drama|cinema|أفلام|افلام|مسلسل|دراما/.test(t)) return 'movies';
    if (/doc|وثائق/.test(t)) return 'docs';
    if (/kids|cartoon|أطفال|اطفال|كرتون|toon/.test(t)) return 'kids';
    return 'ent';
  }
  /* a line that is only a link to another list (…/sports.m3u) is a list to read, not a channel */
  function isListLink(u) { return /^https?:\/\/[^\s]+$/i.test(u) && (/\.m3u(\?[^\s]*)?$/i.test(u) || /get\.php\?|[?&]type=m3u/i.test(u)); }
  function listName(u) {
    var n = u.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || '';
    try { n = decodeURIComponent(n); } catch (e) {}
    n = n.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[-_]+/g, ' ').trim();
    if (!n || /^(get|playlist|index|list)$/i.test(n)) n = u.replace(/^https?:\/\//, '').split('/')[0];
    return n;
  }
  function readCache() { try { return JSON.parse(localStorage.getItem('myChLists') || '{}') || {}; } catch (e) { return {}; } }
  /* an IPTV account of the Xtream kind (server, user, password) that the user owns: its live channels come as one folder, one sub-folder per category */
  function xtOf(S) { var x = S && S.xtream; if (!x || !x.host || !x.user || !x.pass || x.live === false) return null; var h = String(x.host).trim().replace(/\/+$/, ''); if (!/^https?:\/\//i.test(h)) h = 'http://' + h; return { host: h, user: String(x.user).trim(), pass: String(x.pass).trim(), out: x.out === 'm3u8' ? 'm3u8' : 'ts', name: x.name || 'IPTV' }; }
  function xtApi(x, action) { return x.host + '/player_api.php?username=' + encodeURIComponent(x.user) + '&password=' + encodeURIComponent(x.pass) + (action ? '&action=' + action : ''); }
  function xtStreamUrl(x, id) { return x.host + '/live/' + encodeURIComponent(x.user) + '/' + encodeURIComponent(x.pass) + '/' + id + '.' + x.out; }
  function xtKey(x) { return x.host + '|' + x.user; }
  function xtRead() { try { return JSON.parse(localStorage.getItem('myXt') || 'null'); } catch (e) { return null; } }
  var xtState = '';     /* '' | 'loading' | 'fail:…' */
  function xtUa(x) { try { return (window.Android && window.Android.getPref && window.Android.getPref('uaOk|' + x.host.replace(/^https?:\/\//i, '').replace(/[:\/].*$/, ''))) || ''; } catch (e) { return ''; } }
  function xtPull(S, force) {
    var x = xtOf(S); if (!x || !window.__fetchText) return;
    var c = xtRead(); if (!force && c && c.k === xtKey(x) && Date.now() - c.t < 6 * 3600000) return;
    xtState = 'loading'; cust.key = '';
    window.__fetchText(xtApi(x, 'get_live_categories')).then(function (ct) {
      var cats = {}; try { (JSON.parse(ct) || []).forEach(function (o) { cats[o.category_id] = o.category_name; }); } catch (e) {}
      return window.__fetchText(xtApi(x, 'get_live_streams')).then(function (st) {
        var arr = null; try { arr = JSON.parse(st); } catch (e) {}
        if (!arr || !arr.length) { var er = String(st).indexOf('ERR:') === 0 ? String(st).slice(4) : 'الحساب ما رجّع قنوات (تأكد من الرابط والمستخدم)'; if (/403|401/.test(er)) er += ' · السيرفر رفض الطلب: تأكد من الرابط والمنفذ واسم المستخدم وكلمة المرور، وأن الاشتراك فعّال وما متجاوز عدد الأجهزة'; xtState = 'fail:' + er; if (force && window.toastMsg) window.toastMsg('تعذّر التحديث: ' + er); return; }
        var names = [], idx = {}, items = [];
        arr.forEach(function (o) { var cn = cats[o.category_id] || 'بدون مجموعة'; if (idx[cn] == null) { idx[cn] = names.length; names.push(cn); } items.push([String(o.name || '').trim(), o.stream_id, idx[cn], o.stream_icon || '']); });
        try { localStorage.setItem('myXt', JSON.stringify({ k: xtKey(x), t: Date.now(), cats: names, items: items })); xtState = ''; if (force && window.toastMsg) window.toastMsg('تم تحديث IPTV: ' + items.length + ' قناة'); } catch (e) { xtState = 'fail:القائمة كبيرة على ذاكرة التلفزيون'; }
      });
    }).then(function () { cust.key = ''; if (document.getElementById('liveModal').classList.contains('on')) draw(); }, function () { xtState = 'fail:تعذّر الاتصال بالسيرفر'; cust.key = ''; if (document.getElementById('liveModal').classList.contains('on')) draw(); });
  }
  function xtItems(x) {
    var c = xtRead(); if (!c || c.k !== xtKey(x)) return [];
    var ua = xtUa(x);
    return c.items.map(function (r) { return { n: r[0], u: xtStreamUrl(x, r[1]), ua: ua, grp: c.cats[r[2]], l: r[3], c: 'my', g: guessCat(r[0] + ' ' + c.cats[r[2]]) }; });
  }
  function linksOf(S) {
    var out = [];
    String(S.myM3u || '').split(/\r?\n/).forEach(function (l) { l = l.trim(); if (isListLink(l)) out.push(l); });
    String(S.channelsUrl || '').split(/[\s,]+/).forEach(function (l) { if (/^https?:\/\//i.test(l) && !isYT(l) && !/\.m3u8(\?[^\s]*)?$/i.test(l) && out.indexOf(l) < 0) out.push(l); });
    return out.filter(function (u, i) { return out.indexOf(u) === i; });
  }
  var loadState = {};   /* url -> 'loading' | 'fail' */
  function custom() {
    var S = (window.__getSettings && window.__getSettings()) || {}, cache = readCache(), links = linksOf(S);
    var xo = xtOf(S), xc = xo ? xtRead() : null, key = (xo ? xtKey(xo) + (xc ? xc.t : 0) + xtState : '') + '|' + (S.myM3u || '').length + '|' + (S.channelsUrl || '') + '|' + JSON.stringify(ytTitles()).length + '|' + links.join(',') + '|' + links.map(function (u) { return (cache[u] || '').length + (loadState[u] || ''); }).join(',');
    if (cust.key === key) return cust;
    var lists = [], mine = [];
    /* channels pasted straight into the box (text with #EXTINF, or single stream links) */
    var own = String(S.myM3u || '').split(/\r?\n/).filter(function (l) { return !isListLink(l.trim()); }).join('\n');
    String(S.channelsUrl || '').split(/[\s,]+/).forEach(function (l) { if (/^https?:\/\//i.test(l) && (isYT(l) || /\.m3u8(\?[^\s]*)?$/i.test(l))) own += '\n' + l; });
    mine = parseM3U(own);
    if (mine.length) lists.push({ key: 'own', name: 'قنواتي المضافة', items: mine, note: '' });
    if (xo) { var xi = xtItems(xo); lists.push({ key: 'xt', name: xo.name, items: xi, note: xi.length ? '' : /^fail/.test(xtState) ? 'تعذّر: ' + xtState.slice(5) : 'جاري تحميل قنوات الحساب…' }); }
    links.forEach(function (u) {
      var items = parseM3U(cache[u] || ''), nm = listName(u);
      lists.push({ key: u, name: nm, items: items, note: items.length ? '' : /^fail/.test(loadState[u] || '') ? 'تعذّر جلب القائمة' + (loadState[u].length > 5 ? ': ' + loadState[u].slice(5) : '') : cache[u] ? 'الرد مو قائمة M3U فيها قنوات' : 'جاري تحميل القائمة…' });
    });
    lists.forEach(function (L) { L.items.forEach(function (c) { c.lk = L.key; c.ln = L.name; }); });
    cust = { lists: lists, list: [], groups: [], key: key };
    return cust;
  }
  /* each list kept at a link is read when the page opens (and cached for when there is no internet) */
  function pullUrl() {
    var S = (window.__getSettings && window.__getSettings()) || {};
    if (!window.__fetchText) return;
    xtPull(S);
    /* names of YouTube links: asked once from YouTube and kept */
    var yts = [];
    (String(S.myM3u || '') + '\n' + String(S.channelsUrl || '').replace(/[\s,]+/g, '\n')).split(/\r?\n/).forEach(function (l) { l = l.trim(); if (/^https?:/i.test(l) && isYT(l) && !ytTitles()[l] && yts.indexOf(l) < 0) yts.push(l); });
    yts.slice(0, 12).forEach(function (u) {
      window.__fetchText('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u)).then(function (t) {
        try { var j = JSON.parse(t); if (j && j.title) { var T = ytTitles(); T[u] = j.title + (j.author_name ? ' · ' + j.author_name : ''); localStorage.setItem('myChTitles', JSON.stringify(T)); cust.key = ''; if (document.getElementById('liveModal').classList.contains('on')) draw(); } } catch (e) {}
      }, function () {});
    });
    linksOf(S).forEach(function (u) {
      loadState[u] = 'loading'; cust.key = '';
      window.__fetchText(u).then(function (t) {
        if (t && t.indexOf('ERR:') === 0) { loadState[u] = 'fail:' + t.slice(4); }
        else if (t && t.length > 20) {
          try { var c = readCache(); c[u] = t.slice(0, 600000); localStorage.setItem('myChLists', JSON.stringify(c)); } catch (e) {}
          delete loadState[u];
        } else loadState[u] = 'fail';
        cust.key = ''; if (document.getElementById('liveModal').classList.contains('on')) draw();
      }, function () { loadState[u] = 'fail'; cust.key = ''; if (document.getElementById('liveModal').classList.contains('on')) draw(); });
    });
  }
  /* websites that carry channels: opened in the in-app browser, the stream found there is saved as a normal channel */
  function sitesList() {
    var S = (window.__getSettings && window.__getSettings()) || {}, out = [];
    String(S.chSites || '').split(/[\s,]+/).forEach(function (l) { if (/^https?:\/\//i.test(l) && out.indexOf(l) < 0) out.push(l); });
    return out;
  }
  function siteHost(u) { return String(u).replace(/^https?:\/\//i, '').split('/')[0]; }
  var siteCache = null;
  function siteCh() {
    if (siteCache) return siteCache;
    var out = [];
    try { out = JSON.parse((window.Android && window.Android.siteChannels && window.Android.siteChannels()) || '[]') || []; } catch (e) { out = []; }
    siteCache = out.map(function (o) { return { n: o.n, u: o.u, g: o.g || 'ent', p: o.p || '', r: o.r || '', ua: o.ua || '', c: o.c || 'my', sc: 1, ln: 'من المواقع' }; });
    return siteCache;
  }
  function oidOf(cid) { return cid === 'my' ? (st.fold ? 'my:' + st.fold + (st.sub ? '§' + st.sub : '') : 'my') : cid; }
  function filter(cid) {
    var l = rawFilter(cid);
    if (l.length && !l[0].empty) l = sortBy(l, ORD.ch[oidOf(cid)], keyOf);
    return l;
  }
  /* search by name over every channel, the user's own lists included */
  function searchList(q) {
    q = String(q || '').toLowerCase().replace(/^\s+|\s+$/g, ''); if (!q) return [];
    var out = [], seen = {};
    (window.CHANNELS || []).concat(siteCh()).concat((custom().lists || []).reduce(function (a, L) { return a.concat(L.items); }, [])).forEach(function (c) {
      var k = c.u + '|' + c.n; if (seen[k]) return;
      if (String(c.n).toLowerCase().indexOf(q) >= 0 || String(c.ln || '').toLowerCase().indexOf(q) >= 0) { seen[k] = 1; out.push(c); }
    });
    return out;
  }
  /* a list with several groups (group-title, or an account's categories) opens as sub-folders, so no screen holds thousands of channels */
  function groupsOf(L) {
    if (L._gs !== undefined && L._gn === L.items.length) return L._gs;
    var gs = [], idx = {}; L._gn = L.items.length;
    L.items.forEach(function (c) { var g = c.grp || 'بدون مجموعة'; if (idx[g] == null) { idx[g] = gs.length; gs.push({ n: g, count: 0 }); } gs[idx[g]].count++; });
    L._gs = (L.items.length > 30 && gs.length > 1 && gs.length <= 600) ? gs : null; return L._gs;
  }
  function rawFilter(cid) {
    var all = (window.CHANNELS || []).concat(siteCh());
    if (cid === 'sites') return sitesList().map(function (u) { return { n: siteHost(u), sub: 'يفتح الموقع وتختار القناة منه', u: u, site: 1, c: 'my' }; });
    if (cid === 'my') {
      var Ls = custom().lists;
      if (st.fold) {
        var F = Ls.filter(function (L) { return L.key === st.fold; })[0];
        if (F) {
          var gs = groupsOf(F);
          if (gs && !st.sub) return gs.map(function (g) { return { folder: 1, sg: g.n, key: F.key + '§' + g.n, n: g.n, sub: g.count + ' قناة', u: '', c: 'my' }; });
          var its = st.sub ? F.items.filter(function (c) { return (c.grp || 'بدون مجموعة') === st.sub; }) : F.items;
          return its.length ? its : [{ n: F.note || 'القائمة فاضية', sub: '', empty: 1, u: '' }];
        }
        st.fold = null; st.sub = null;
      }
      return Ls.map(function (L) { return { folder: 1, key: L.key, n: L.name, sub: L.items.length ? L.items.length + ' قناة' : L.note, u: '', c: 'my' }; });
    }
    if (cid === 'all') return all;
    if (cid === 'mbc' || cid === 'karbala') return all.filter(function (c) { return c.p === cid; });
    if (cid === 'news' || cid === 'sport' || cid === 'quran' || cid === 'movies' || cid === 'docs' || cid === 'ent' || cid === 'kids') return all.filter(function (c) { return c.g === cid; });
    return all.filter(function (c) { return c.c === cid; });
  }
  function grpName(code) { var g = (window.CH_GROUPS || []).filter(function (x) { return x[0] === code; })[0]; return g ? g[1] : ''; }
  var GN = { news: 'أخبار', sport: 'رياضة', movies: 'أفلام', docs: 'وثائقية', ent: 'منوعات', kids: 'أطفال', quran: 'قرآن' };
  function subOf(c) { if (c.folder || c.empty || c.site) return c.sub || ''; return c.c === 'my' ? (c.grp || c.ln || 'قنواتي الخاصة') + (GN[c.g] ? ' · ' + GN[c.g] : '') : grpName(c.c) + (GN[c.g] ? ' · ' + GN[c.g] : ''); }
  function hue(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function draw() {
    var cs = cats(), cid = cs[st.ci].id;
    st.list = st.q ? searchList(st.q) : filter(cid);
    if (st.gi >= st.list.length) st.gi = Math.max(0, st.list.length - 1);
    var from = Math.max(0, Math.min(st.ci - 3, cs.length - 8)), html = '';
    for (var q = from; q < Math.min(cs.length, from + 8); q++) html += '<div class="lv-cat' + (q === st.ci ? ' on' : '') + (st.f === 'cat' && q === st.ci ? ' focus' : '') + (st.pick === 'cat' && q === st.ci ? ' moving' : '') + '">' + esc(cs[q].n) + '</div>';
    $('lvCats').innerHTML = html;
    var vh = ''; VIEWS.forEach(function (v, i) { vh += '<div class="lv-vw' + (i === st.vi ? ' on' : '') + (st.f === 'view' && i === st.hi ? ' focus' : '') + '">' + v[1] + '</div>'; });
    var tl = tools(), th = '';
    tl.forEach(function (t, i) { th += '<div class="lv-tl' + (t.on ? ' on' : '') + (st.f === 'tool' && i === st.ti ? ' focus' : '') + '">' + t.n + '</div>'; });
    $('lvTools').innerHTML = th;
    $('lvViews').innerHTML = vh; $('lvGrid').setAttribute('data-v', VIEWS[st.vi][0]);
    var key = st.ver + '|' + (st.q || '') + '|' + VIEWS[st.vi][0] + '|' + cid + '|' + (st.fold || '') + '|' + (st.sub || '') + '|' + st.list.length + '|' + (st.list[0] ? st.list[0].n + st.list[0].u + (st.list[0].sub || '') : '');
    var grid = $('lvGrid');
    if (st.key !== key) { st.key = key;
    grid.innerHTML = st.list.length ? st.list.map(function (c, i) {
      var tint = 'hsl(' + hue(c.n) + ',28%,24%)', ini = c.folder ? '📁' : c.n.replace(/^ال/, '').replace(/\s/g, '').slice(0, 2);
      var logo = c.i ? '<img class="lv-img" loading="lazy" decoding="async" src="logos/' + esc(c.i) + '.png" alt="" onerror="this.parentNode.removeChild(this)">' : c.l ? '<img class="lv-img" loading="lazy" decoding="async" src="' + esc(c.l) + '" alt="" onerror="this.parentNode.removeChild(this)">' : '';
      return '<div class="lv-ch' + (st.f === 'grid' && i === st.gi ? ' focus' : '') + '"><div class="lv-art" style="background:' + tint + '"><b>' + esc(ini) + '</b>' + logo + '</div>' +
        '<div class="lv-tx"><div class="lv-n">' + esc(c.n) + '</div><div class="lv-s">' + esc(subOf(c)) + '</div></div></div>';
    }).join('') : '<div class="lv-empty">' + (st.q ? 'ماكو قناة بهذا الاسم' : 'ماكو قنوات بهذا القسم') + '</div>';
    }
    /* only move the focus ring: rebuilding every card (and reloading its logo) on each key press made it slow */
    var kids = grid.children, pf = grid.querySelector('.focus'), want = (st.f === 'grid' && st.list.length) ? kids[st.gi] : null;
    if (pf && pf !== want) pf.classList.remove('focus');
    if (want && want !== pf) want.classList.add('focus');
    [].forEach.call(grid.querySelectorAll('.moving'), function (e) { if (e !== want) e.classList.remove('moving'); });
    if (want) want.classList.toggle('moving', st.pick === 'ch');
    var hint = $('lvHint'); if (hint) { if (!hint._d) hint._d = hint.textContent; hint.textContent = st.edit ? 'وضع الترتيب: OK يمسك الفولدر أو القناة · الأسهم تحرّكه · OK يثبّته · من «ترتيب القنوات» تطفّي الوضع' : st.del ? 'وضع الحذف: OK على قناة محفوظة من موقع يحذفها · من «حذف قناة محفوظة» تطفّي الوضع' : hint._d; }
    var f = grid.querySelector('.focus'), wrap = $('lvGridWrap');
    if (f && wrap) {
      var H = wrap.clientHeight, t = f.offsetTop, h = f.offsetHeight, o = st.off;
      if (t - o < 12) o = Math.max(0, t - 12); else if (t + h - o > H - 12) o = t + h - H + 12;
      st.off = o;
    } else st.off = 0;
    $('lvGrid').style.transform = 'translateY(' + (-st.off) + 'px)';
    $('lvCount').textContent = (st.q ? 'نتائج البحث · ' : '') + st.list.length + ' قناة';
  }
  /* everything the player needs: all channels once, and the folders (as lists of positions) so that OK inside a channel can show them */
  function packFor(cur) {
    var cs = cats(), chans = [], pos = {}, folders = [], fold = 0, curId = cs[st.ci] ? cs[st.ci].id : 'all';
    function add(c) {
      var k = c.u + '|' + c.n;
      if (pos[k] === undefined) { pos[k] = chans.length; chans.push({ n: c.n, u: c.u, i: c.i || '', s: subOf(c), r: c.r || '', ua: c.ua || '', l: c.l || '', yt: isYT(c.u) }); }
      return pos[k];
    }
    cs.forEach(function (ct) {
      if (ct.id === 'sites') return;
      if (ct.id === 'my') {
        custom().lists.forEach(function (L) {
          if (!L.items.length) return;
          var gs = groupsOf(L);
          if (gs) {      /* a big list: the player gets the group that is open (or the first), the others stay in the browser, so the hand-over stays small */
            var g0 = st.sub && curId === 'my' && st.fold === L.key ? st.sub : (cur.grp || gs[0].n);
            if (curId === 'my' && st.fold === L.key) fold = folders.length;
            folders.push({ n: '📁 ' + L.name + ' · ' + g0, idx: sortBy(L.items.filter(function (c) { return (c.grp || 'بدون مجموعة') === g0; }), ORD.ch['my:' + L.key + '§' + g0], keyOf).map(add) });
          } else { if (curId === 'my' && st.fold === L.key) fold = folders.length; folders.push({ n: '📁 ' + L.name, idx: sortBy(L.items, ORD.ch['my:' + L.key], keyOf).map(add) }); }
        });
      } else {
        var l = filter(ct.id); if (!l.length) return;
        if (ct.id === curId) fold = folders.length;
        folders.push({ n: ct.n, idx: l.map(add) });
      }
    });
    if (st.q) { folders.unshift({ n: 'نتائج البحث', idx: st.list.map(add) }); fold = 0; }
    return { list: chans, folders: folders, fold: fold, idx: pos[cur.u + '|' + cur.n] || 0 };
  }
  function play() {
    if (!st.list.length) return;
    var cur = st.list[st.gi];
    if (cur && cur.folder) { if (cur.sg) st.sub = cur.sg; else st.fold = cur.key; st.gi = 0; st.off = 0; st.key = null; draw(); return; }
    if (cur && cur.empty) return;
    if (cur && cur.site) { if (window.Android && window.Android.openSite) window.Android.openSite(cur.u); else if (window.toastMsg) window.toastMsg('المتصفح يحتاج الشاشة نفسها'); return; }
    if (st.del) {
      if (cur && cur.sc) { if (window.Android && window.Android.siteDelete) window.Android.siteDelete(cur.u + '|' + cur.n); siteCache = null; st.key = null; if (window.toastMsg) window.toastMsg('انحذفت: ' + cur.n); draw(); }
      else if (window.toastMsg) window.toastMsg('هذي مو قناة محفوظة من موقع');
      return;
    }
    var pk = packFor(cur);
    if (window.Android && window.Android.playLive) window.Android.playLive(JSON.stringify(pk), pk.idx);
    else if (window.toastMsg) window.toastMsg('التشغيل يحتاج الشاشة نفسها');
  }
  function moveCat(d) {
    var cs = cats(), i = st.ci, j = i + d; if (j < 0 || j >= cs.length) return;
    var ids = cs.map(function (c) { return c.id; }), t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    ORD.cats = ids; st.ci = j; saveOrd();
  }
  function moveItem(from, to) {
    var l = st.list.slice(), it = l.splice(from, 1)[0]; l.splice(to, 0, it);
    ORD.ch[oidOf(cats()[st.ci].id)] = l.map(keyOf); saveOrd();
  }
  /* the tools sit in their own row, apart from the four ways to show the channels */
  function tools() {
    var l = [{ id: 'search', n: 'بحث', on: !!st.q }, { id: 'edit', n: 'ترتيب القنوات', on: st.edit }];
    if (xtOf((window.__getSettings && window.__getSettings()) || {})) l.push({ id: 'xt', n: xtState === 'loading' ? 'جاري التحديث…' : 'تحديث IPTV', on: false });
    if (siteCh().length) l.push({ id: 'del', n: 'حذف قناة محفوظة', on: st.del });
    return l;
  }
  function searchBox() { return $('lvSearch'); }
  function startSearch() {
    var b = searchBox(); if (!b) return;
    b.classList.add('on'); b.value = st.q || ''; b.focus();
  }
  function endSearch(clear) {
    var b = searchBox(); if (!b) return;
    b.blur(); if (clear) { b.value = ''; st.q = ''; st.gi = 0; st.key = null; }
    b.classList.toggle('on', !!st.q);
  }
  function onSearchInput() { var b = searchBox(); st.q = b.value.replace(/^\s+|\s+$/g, ''); st.gi = 0; st.off = 0; st.key = null; draw(); }
  document.addEventListener('DOMContentLoaded', function () { var b = searchBox(); if (b) b.addEventListener('input', onSearchInput); });
  /* opens on the folder and the channel that were playing last (the player writes them whenever a channel starts) */
  function restoreLast() {
    var raw = ''; try { raw = (window.Android && window.Android.getPref && window.Android.getPref('liveLast')) || ''; } catch (e) {}
    if (!raw) return;
    var last; try { last = JSON.parse(raw); } catch (e) { return; }
    if (!last || !last.f) return;
    var cs = cats(), ci = -1, fold = null, sub = null, i;
    for (i = 0; i < cs.length; i++) if (cs[i].n === last.f) { ci = i; break; }
    if (ci < 0 && String(last.f).indexOf('📁 ') === 0) {
      var nm = String(last.f).slice(3), myi = -1;
      for (i = 0; i < cs.length; i++) if (cs[i].id === 'my') myi = i;
      if (myi >= 0) custom().lists.forEach(function (L) { if (nm === L.name) fold = L.key; else if (nm.indexOf(L.name + ' · ') === 0) { fold = L.key; sub = nm.slice(L.name.length + 3); } });
      if (fold) ci = myi;
    }
    if (ci < 0) return;
    st.ci = ci; st.fold = fold; st.sub = sub;
    var l = filter(cs[ci].id), gi = 0;
    for (i = 0; i < l.length; i++) if (l[i].u + '|' + l[i].n === last.k) { gi = i; break; }
    st.gi = gi; st.f = 'grid';
  }
  var Live = {
    restore: restoreLast,
    open: function () {
      st.f = 'grid'; st.ci = 0; st.gi = 0; st.off = 0; st.key = null; st.fold = null; st.pick = null; st.del = false; siteCache = null; st.hi = st.vi; st.ti = 0; COLS = VIEWS[st.vi][2];
      ORD = loadOrd(); endSearch(true);
      restoreLast();
      pullUrl();
      document.getElementById('liveModal').classList.add('on');
      if (window.__setLayer) window.__setLayer('live');
      draw();
    },
    refresh: function () { siteCache = null; st.key = null; if (document.getElementById('liveModal').classList.contains('on')) draw(); },
    /* text typed from the phone (or the TV keyboard) */
    search: function (v) { startSearch(); var b = searchBox(); if (b) { b.value = v || ''; onSearchInput(); } },
    key: function (k) {
      var cs = cats(), box = searchBox();
      if (box && document.activeElement === box) {
        if (k === 'back') { endSearch(true); draw(); return; }
        if (k === 'ok' || k === 'ArrowDown') { endSearch(false); st.f = st.list.length ? 'grid' : 'tool'; st.gi = 0; draw(); return; }
        return;
      }
      if (k === 'back') {
        if (st.pick) { st.pick = null; draw(); return; }
        if (st.q) { endSearch(true); draw(); return; }
        if (st.sub && cs[st.ci] && cs[st.ci].id === 'my') { st.sub = null; st.gi = 0; st.off = 0; st.key = null; st.f = 'grid'; draw(); return; }
        if (st.fold && cs[st.ci] && cs[st.ci].id === 'my') { st.fold = null; st.gi = 0; st.off = 0; st.key = null; st.f = 'grid'; draw(); return; }
        if (window.__closeLive) window.__closeLive(); return;
      }
      if (st.f === 'view') {
        var N = VIEWS.length;
        if (k === 'ArrowRight') { st.hi = Math.max(0, st.hi - 1); setView(st.hi); }
        else if (k === 'ArrowLeft') { st.hi = Math.min(N - 1, st.hi + 1); setView(st.hi); }
        else if (k === 'ArrowDown') st.f = 'tool';
        else if (k === 'ok') st.f = 'tool';
      } else if (st.f === 'tool') {
        var tl = tools(), TN = tl.length; if (st.ti >= TN) st.ti = TN - 1;
        if (k === 'ArrowRight') st.ti = Math.max(0, st.ti - 1);
        else if (k === 'ArrowLeft') st.ti = Math.min(TN - 1, st.ti + 1);
        else if (k === 'ArrowUp') st.f = 'view';
        else if (k === 'ArrowDown') st.f = st.list.length ? 'grid' : 'cat';
        else if (k === 'ok') {
          var id = tl[st.ti].id;
          if (id === 'search') { startSearch(); return; }
          if (id === 'xt') { if (xtState !== 'loading') { if (window.toastMsg) window.toastMsg('جاري تحديث قنوات IPTV…'); xtPull((window.__getSettings && window.__getSettings()) || {}, true); } }
          else if (id === 'edit') { st.edit = !st.edit; st.del = false; st.pick = null; if (window.toastMsg) window.toastMsg(st.edit ? 'وضع الترتيب شغّال' : 'وضع الترتيب انطفى'); }
          else if (id === 'del') { st.del = !st.del; st.edit = false; st.pick = null; if (window.toastMsg) window.toastMsg(st.del ? 'اضغط OK على القناة المحفوظة حتى تنحذف' : 'انطفى وضع الحذف'); }
        }
      } else if (st.f === 'cat') {
        if (st.edit && st.pick === 'cat') {
          if (k === 'ArrowUp') moveCat(-1); else if (k === 'ArrowDown') moveCat(1); else if (k === 'ok' || k === 'ArrowLeft' || k === 'ArrowRight') st.pick = null;
        } else if (st.edit && k === 'ok') { st.pick = 'cat'; }
        else if (k === 'ArrowUp') { if (st.ci === 0) st.f = 'tool'; else { st.ci--; st.gi = 0; st.off = 0; st.fold = null; st.sub = null; st.q = ''; endSearch(true); } }
        else if (k === 'ArrowDown') { st.ci = Math.min(cs.length - 1, st.ci + 1); st.gi = 0; st.off = 0; st.fold = null; st.sub = null; st.q = ''; endSearch(true); }
        else if (k === 'ArrowLeft' || k === 'ok') { if (st.list.length) st.f = 'grid'; }
      } else {
        if (st.edit && st.pick === 'ch') {
          var n = st.list.length, j = st.gi;
          if (k === 'ArrowRight') j = st.gi % COLS === 0 ? st.gi : st.gi - 1;
          else if (k === 'ArrowLeft') j = (st.gi % COLS < COLS - 1 && st.gi + 1 < n) ? st.gi + 1 : st.gi;
          else if (k === 'ArrowUp') j = st.gi - COLS >= 0 ? st.gi - COLS : st.gi;
          else if (k === 'ArrowDown') j = st.gi + COLS < n ? st.gi + COLS : st.gi;
          else if (k === 'ok') { st.pick = null; draw(); return; }
          if (j !== st.gi && !st.q) { moveItem(st.gi, j); st.gi = j; }
        } else if (st.edit && k === 'ok') { if (st.list.length && !st.list[st.gi].empty && !st.q) st.pick = 'ch'; }
        else if (k === 'ArrowRight') { if (st.gi % COLS === 0) st.f = 'cat'; else st.gi--; }
        else if (k === 'ArrowLeft') { if (st.gi + 1 < st.list.length && st.gi % COLS < COLS - 1) st.gi++; }
        else if (k === 'ArrowUp') { if (st.gi - COLS >= 0) st.gi -= COLS; else st.f = 'tool'; }
        else if (k === 'ArrowDown') { if (st.gi + COLS < st.list.length) st.gi += COLS; else if (st.gi < st.list.length - 1) st.gi = st.list.length - 1; }
        else if (k === 'ok') { play(); return; }
      }
      draw();
    }
  };
  window.Live = Live;
})();
