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
    if (custom().list.length) l.push({ id: 'my', n: '📁 قنواتي الخاصة', kind: 'my' });
    return l;
  }
  /* the user's own channels (licensed streams he adds from the phone app: pasted M3U text or a link to a list) */
  var cust = { list: [], groups: [], key: '' };
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
        var c = cur || { n: ln, grp: '', l: '' }; c.u = ln; c.c = 'my'; c.g = guessCat(c.n + ' ' + c.grp); out.push(c); cur = null;
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
  function custom() {
    var S = (window.__getSettings && window.__getSettings()) || {}, key = (S.myM3u || '').length + '|' + (S.channelsUrl || '') + '|' + (localStorage.getItem('myChUrlCache') || '').length;
    if (cust.key === key) return cust;
    var list = parseM3U(S.myM3u || '');
    if (S.channelsUrl) { try { list = list.concat(parseM3U(localStorage.getItem('myChUrlCache') || '')); } catch (e) {} }
    var seen = {}, groups = []; list.forEach(function (c) { var g = c.grp || 'قنواتي الخاصة'; c.grp = g; if (!seen[g]) { seen[g] = 1; groups.push(g); } });
    cust = { list: list, groups: groups, key: key };
    return cust;
  }
  /* a list kept at a link is read each time the page opens (and cached for when there is no internet) */
  function pullUrl() {
    var S = (window.__getSettings && window.__getSettings()) || {};
    if (!S.channelsUrl || !window.__fetchText) return;
    window.__fetchText(S.channelsUrl).then(function (t) { if (t && t.length > 20) { try { localStorage.setItem('myChUrlCache', t.slice(0, 400000)); } catch (e) {} cust.key = ''; if (document.getElementById('liveModal').classList.contains('on')) draw(); } });
  }
  function filter(cid) {
    var all = window.CHANNELS || [];
    if (cid === 'my') return custom().list;
    if (cid === 'mbc' || cid === 'karbala') return all.filter(function (c) { return c.p === cid; });
    if (cid === 'news' || cid === 'sport' || cid === 'quran' || cid === 'movies' || cid === 'docs' || cid === 'ent' || cid === 'kids') return all.filter(function (c) { return c.g === cid; });
    return all.filter(function (c) { return c.c === cid; });
  }
  function grpName(code) { var g = (window.CH_GROUPS || []).filter(function (x) { return x[0] === code; })[0]; return g ? g[1] : ''; }
  var GN = { news: 'أخبار', sport: 'رياضة', movies: 'أفلام', docs: 'وثائقية', ent: 'منوعات', kids: 'أطفال', quran: 'قرآن' };
  function subOf(c) { return c.c === 'my' ? (c.grp || 'قنواتي الخاصة') + (GN[c.g] ? ' · ' + GN[c.g] : '') : grpName(c.c) + (GN[c.g] ? ' · ' + GN[c.g] : ''); }
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
    var key = VIEWS[st.vi][0] + '|' + cid + '|' + st.list.length + '|' + (st.list[0] ? st.list[0].u : '');
    var grid = $('lvGrid');
    if (st.key !== key) { st.key = key;
    grid.innerHTML = st.list.length ? st.list.map(function (c, i) {
      var tint = 'hsl(' + hue(c.n) + ',28%,24%)', ini = c.n.replace(/^ال/, '').replace(/\s/g, '').slice(0, 2);
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
    /* a YouTube link can't be played by the player: it opens in the YouTube app */
    if (cur && /(youtube\.com|youtu\.be)\//i.test(cur.u)) { if (window.Android && window.Android.openLink) window.Android.openLink(cur.u); return; }
    var payload = JSON.stringify(st.list.filter(function (c) { return !/(youtube\.com|youtu\.be)\//i.test(c.u); }).map(function (c) { return { n: c.n, u: c.u, i: c.i || '', s: subOf(c), r: c.r || '', ua: c.ua || '', l: c.l || '' }; }));
    var gi = Math.max(0, st.list.filter(function (c) { return !/(youtube\.com|youtu\.be)\//i.test(c.u); }).indexOf(cur));
    if (window.Android && window.Android.playLive) window.Android.playLive(payload, gi);
    else if (window.toastMsg) window.toastMsg('التشغيل يحتاج الشاشة نفسها');
  }
  var Live = {
    open: function () {
      st.f = 'grid'; st.ci = 0; st.gi = 0; st.off = 0; st.key = null; COLS = VIEWS[st.vi][2];
      pullUrl();
      document.getElementById('liveModal').classList.add('on');
      if (window.__setLayer) window.__setLayer('live');
      draw();
    },
    key: function (k) {
      var cs = cats();
      if (k === 'back') { if (window.__closeLive) window.__closeLive(); return; }
      if (st.f === 'view') {
        if (k === 'ArrowRight') setView(Math.max(0, st.vi - 1));
        else if (k === 'ArrowLeft') setView(Math.min(VIEWS.length - 1, st.vi + 1));
        else if (k === 'ArrowDown' || k === 'ok') st.f = 'cat';
      } else if (st.f === 'cat') {
        if (k === 'ArrowUp') { if (st.ci === 0) st.f = 'view'; else { st.ci--; st.gi = 0; st.off = 0; } }
        else if (k === 'ArrowDown') { st.ci = Math.min(cs.length - 1, st.ci + 1); st.gi = 0; st.off = 0; }
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
