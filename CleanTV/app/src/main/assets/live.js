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
  var CATS = [['all', 'كل القنوات'], ['news', 'أخبار'], ['sport', 'رياضة'], ['movies', 'أفلام ومسلسلات'], ['docs', 'وثائقية'], ['ent', 'منوعات وترفيه'], ['mbc', 'باقة MBC المجانية'], ['karbala', 'باقة قنوات كربلاء'], ['kids', 'أطفال'], ['quran', 'قرآن ومرجعيات'], ['iq', 'قنوات عراقية']];
  function cats() {
    var l = CATS.map(function (c) { return { id: c[0], n: c[1], kind: 'cat' }; });
    var seen = {};
    (window.CHANNELS || []).forEach(function (c) { seen[c.c] = 1; });
    (window.CH_GROUPS || []).forEach(function (g) { if (seen[g[0]] && g[0] !== 'iq') l.push({ id: g[0], n: 'قنوات ' + g[1], kind: 'grp' }); });
    /* the user's own channels live in one folder, always the last one */
    if (custom().lists.length) l.push({ id: 'my', n: '📁 قنواتي الخاصة', kind: 'my' });
    return l;
  }
  /* the user's own channels (licensed streams he adds from the phone app: pasted M3U text or a link to a list) */
  var cust = { lists: [], list: [], groups: [], key: '' };
  function isYT(u) { return /(youtube\.com|youtu\.be)\//i.test(u); }
  function ytId(u) { var m = String(u).match(/(?:[?&]v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{6,})/); return m ? m[1] : ''; }
  function ytTitles() { try { return JSON.parse(localStorage.getItem('myChTitles') || '{}') || {}; } catch (e) { return {}; } }
  function ytTitle(u) { var t = ytTitles()[u]; return t || ('يوتيوب · ' + (ytId(u) || 'قناة')); }
  function parseM3U(text) {
    var out = [], lines = String(text || '').split(/\r?\n/), cur = null;
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
  function linksOf(S) {
    var out = [];
    String(S.myM3u || '').split(/\r?\n/).forEach(function (l) { l = l.trim(); if (isListLink(l)) out.push(l); });
    String(S.channelsUrl || '').split(/[\s,]+/).forEach(function (l) { if (/^https?:\/\//i.test(l) && !isYT(l) && !/\.m3u8(\?[^\s]*)?$/i.test(l) && out.indexOf(l) < 0) out.push(l); });
    return out.filter(function (u, i) { return out.indexOf(u) === i; });
  }
  var loadState = {};   /* url -> 'loading' | 'fail' */
  function custom() {
    var S = (window.__getSettings && window.__getSettings()) || {}, cache = readCache(), links = linksOf(S);
    var key = (S.myM3u || '').length + '|' + (S.channelsUrl || '') + '|' + JSON.stringify(ytTitles()).length + '|' + links.join(',') + '|' + links.map(function (u) { return (cache[u] || '').length + (loadState[u] || ''); }).join(',');
    if (cust.key === key) return cust;
    var lists = [], mine = [];
    /* channels pasted straight into the box (text with #EXTINF, or single stream links) */
    var own = String(S.myM3u || '').split(/\r?\n/).filter(function (l) { return !isListLink(l.trim()); }).join('\n');
    String(S.channelsUrl || '').split(/[\s,]+/).forEach(function (l) { if (/^https?:\/\//i.test(l) && (isYT(l) || /\.m3u8(\?[^\s]*)?$/i.test(l))) own += '\n' + l; });
    mine = parseM3U(own);
    if (mine.length) lists.push({ key: 'own', name: 'قنواتي المضافة', items: mine, note: '' });
    links.forEach(function (u) {
      var items = parseM3U(cache[u] || ''), nm = listName(u);
      lists.push({ key: u, name: nm, items: items, note: items.length ? '' : loadState[u] === 'fail' ? 'تعذّر جلب القائمة' : cache[u] ? 'ما لگيت قنوات بالقائمة' : 'جاري تحميل القائمة…' });
    });
    lists.forEach(function (L) { L.items.forEach(function (c) { c.lk = L.key; c.ln = L.name; }); });
    cust = { lists: lists, list: [], groups: [], key: key };
    return cust;
  }
  /* each list kept at a link is read when the page opens (and cached for when there is no internet) */
  function pullUrl() {
    var S = (window.__getSettings && window.__getSettings()) || {};
    if (!window.__fetchText) return;
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
        if (t && t.length > 20) {
          try { var c = readCache(); c[u] = t.slice(0, 600000); localStorage.setItem('myChLists', JSON.stringify(c)); } catch (e) {}
          delete loadState[u];
        } else loadState[u] = 'fail';
        cust.key = ''; if (document.getElementById('liveModal').classList.contains('on')) draw();
      }, function () { loadState[u] = 'fail'; cust.key = ''; if (document.getElementById('liveModal').classList.contains('on')) draw(); });
    });
  }
  function filter(cid) {
    var all = window.CHANNELS || [];
    if (cid === 'my') {
      var Ls = custom().lists;
      if (st.fold) { var F = Ls.filter(function (L) { return L.key === st.fold; })[0]; if (F) return F.items.length ? F.items : [{ n: F.note || 'القائمة فاضية', sub: '', empty: 1, u: '' }]; st.fold = null; }
      return Ls.map(function (L) { return { folder: 1, key: L.key, n: L.name, sub: L.items.length ? L.items.length + ' قناة' : L.note, u: '', c: 'my' }; });
    }
    if (cid === 'all') return all;
    if (cid === 'mbc' || cid === 'karbala') return all.filter(function (c) { return c.p === cid; });
    if (cid === 'news' || cid === 'sport' || cid === 'quran' || cid === 'movies' || cid === 'docs' || cid === 'ent' || cid === 'kids') return all.filter(function (c) { return c.g === cid; });
    return all.filter(function (c) { return c.c === cid; });
  }
  function grpName(code) { var g = (window.CH_GROUPS || []).filter(function (x) { return x[0] === code; })[0]; return g ? g[1] : ''; }
  var GN = { news: 'أخبار', sport: 'رياضة', movies: 'أفلام', docs: 'وثائقية', ent: 'منوعات', kids: 'أطفال', quran: 'قرآن' };
  function subOf(c) { if (c.folder || c.empty) return c.sub || ''; return c.c === 'my' ? (c.grp || c.ln || 'قنواتي الخاصة') + (GN[c.g] ? ' · ' + GN[c.g] : '') : grpName(c.c) + (GN[c.g] ? ' · ' + GN[c.g] : ''); }
  function hue(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function draw() {
    var cs = cats(), cid = cs[st.ci].id;
    st.list = filter(cid);
    if (st.gi >= st.list.length) st.gi = Math.max(0, st.list.length - 1);
    var from = Math.max(0, Math.min(st.ci - 3, cs.length - 8)), html = '';
    for (var q = from; q < Math.min(cs.length, from + 8); q++) html += '<div class="lv-cat' + (q === st.ci ? ' on' : '') + (st.f === 'cat' && q === st.ci ? ' focus' : '') + '">' + esc(cs[q].n) + '</div>';
    $('lvCats').innerHTML = html;
    var vh = ''; VIEWS.forEach(function (v, i) { vh += '<div class="lv-vw' + (i === st.vi ? ' on' : '') + (st.f === 'view' && i === st.vi ? ' focus' : '') + '">' + v[1] + '</div>'; });
    $('lvViews').innerHTML = vh; $('lvGrid').setAttribute('data-v', VIEWS[st.vi][0]);
    var key = VIEWS[st.vi][0] + '|' + cid + '|' + (st.fold || '') + '|' + st.list.length + '|' + (st.list[0] ? st.list[0].n + st.list[0].u + (st.list[0].sub || '') : '');
    var grid = $('lvGrid');
    if (st.key !== key) { st.key = key;
    grid.innerHTML = st.list.length ? st.list.map(function (c, i) {
      var tint = 'hsl(' + hue(c.n) + ',28%,24%)', ini = c.folder ? '📁' : c.n.replace(/^ال/, '').replace(/\s/g, '').slice(0, 2);
      var logo = c.i ? '<img class="lv-img" src="logos/' + esc(c.i) + '.png" alt="" onerror="this.parentNode.removeChild(this)">' : c.l ? '<img class="lv-img" src="' + esc(c.l) + '" alt="" onerror="this.parentNode.removeChild(this)">' : '';
      return '<div class="lv-ch' + (st.f === 'grid' && i === st.gi ? ' focus' : '') + '"><div class="lv-art" style="background:' + tint + '"><b>' + esc(ini) + '</b>' + logo + '</div>' +
        '<div class="lv-tx"><div class="lv-n">' + esc(c.n) + '</div><div class="lv-s">' + esc(subOf(c)) + '</div></div></div>';
    }).join('') : '<div class="lv-empty">ماكو قنوات بهذا القسم</div>';
    }
    /* only move the focus ring: rebuilding every card (and reloading its logo) on each key press made it slow */
    var kids = grid.children, pf = grid.querySelector('.focus'), want = (st.f === 'grid' && st.list.length) ? kids[st.gi] : null;
    if (pf && pf !== want) pf.classList.remove('focus');
    if (want && want !== pf) want.classList.add('focus');
    var f = grid.querySelector('.focus'), wrap = $('lvGridWrap');
    if (f && wrap) {
      var H = wrap.clientHeight, t = f.offsetTop, h = f.offsetHeight, o = st.off;
      if (t - o < 12) o = Math.max(0, t - 12); else if (t + h - o > H - 12) o = t + h - H + 12;
      st.off = o;
    } else st.off = 0;
    $('lvGrid').style.transform = 'translateY(' + (-st.off) + 'px)';
    $('lvCount').textContent = st.list.length + ' قناة';
  }
  function play() {
    if (!st.list.length) return;
    var cur = st.list[st.gi];
    if (cur && cur.folder) { st.fold = cur.key; st.gi = 0; st.off = 0; st.key = null; draw(); return; }
    if (cur && cur.empty) return;
    /* a YouTube link can't be played by the player: it opens in the YouTube app */
    if (cur && /(youtube\.com|youtu\.be)\//i.test(cur.u)) { if (window.Android && window.Android.openLink) window.Android.openLink(cur.u); return; }
    var payload = JSON.stringify(st.list.filter(function (c) { return !/(youtube\.com|youtu\.be)\//i.test(c.u); }).map(function (c) { return { n: c.n, u: c.u, i: c.i || '', s: subOf(c), r: c.r || '', ua: c.ua || '', l: c.l || '' }; }));
    var gi = Math.max(0, st.list.filter(function (c) { return !/(youtube\.com|youtu\.be)\//i.test(c.u); }).indexOf(cur));
    if (window.Android && window.Android.playLive) window.Android.playLive(payload, gi);
    else if (window.toastMsg) window.toastMsg('التشغيل يحتاج الشاشة نفسها');
  }
  var Live = {
    open: function () {
      st.f = 'grid'; st.ci = 0; st.gi = 0; st.off = 0; st.key = null; st.fold = null; COLS = VIEWS[st.vi][2];
      pullUrl();
      document.getElementById('liveModal').classList.add('on');
      if (window.__setLayer) window.__setLayer('live');
      draw();
    },
    key: function (k) {
      var cs = cats();
      if (k === 'back') { if (st.fold && cs[st.ci] && cs[st.ci].id === 'my') { st.fold = null; st.gi = 0; st.off = 0; st.key = null; st.f = 'grid'; draw(); return; } if (window.__closeLive) window.__closeLive(); return; }
      if (st.f === 'view') {
        if (k === 'ArrowRight') setView(Math.max(0, st.vi - 1));
        else if (k === 'ArrowLeft') setView(Math.min(VIEWS.length - 1, st.vi + 1));
        else if (k === 'ArrowDown' || k === 'ok') st.f = 'cat';
      } else if (st.f === 'cat') {
        if (k === 'ArrowUp') { if (st.ci === 0) st.f = 'view'; else { st.ci--; st.gi = 0; st.off = 0; st.fold = null; } }
        else if (k === 'ArrowDown') { st.ci = Math.min(cs.length - 1, st.ci + 1); st.gi = 0; st.off = 0; st.fold = null; }
        else if (k === 'ArrowLeft' || k === 'ok') { if (st.list.length) st.f = 'grid'; }
      } else {
        if (k === 'ArrowRight') { if (st.gi % COLS === 0) st.f = 'cat'; else st.gi--; }
        else if (k === 'ArrowLeft') { if (st.gi + 1 < st.list.length && st.gi % COLS < COLS - 1) st.gi++; }
        else if (k === 'ArrowUp') { if (st.gi - COLS >= 0) st.gi -= COLS; else st.f = st.ci === 0 ? 'view' : 'cat'; }
        else if (k === 'ArrowDown') { if (st.gi + COLS < st.list.length) st.gi += COLS; else if (st.gi < st.list.length - 1) st.gi = st.list.length - 1; }
        else if (k === 'ok') { play(); return; }
      }
      draw();
    }
  };
  window.Live = Live;
})();
