/* «قنواتي»: free live channels. The list comes from channels.js; playing is done by the native player (Android.playLive).
   ES5 on purpose (old TV WebViews). Keys: right/left switches between the groups column and the channel grid. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var COLS = 4, st = { f: 'grid', ci: 0, gi: 0, list: [] };
  var CATS = [['all', 'كل القنوات'], ['news', 'أخبار'], ['sport', 'رياضة'], ['quran', 'قرآن ومرجعيات'], ['iq', 'قنوات عراقية']];
  function cats() {
    var l = CATS.map(function (c) { return { id: c[0], n: c[1], kind: 'cat' }; });
    var seen = {};
    (window.CHANNELS || []).forEach(function (c) { seen[c.c] = 1; });
    (window.CH_GROUPS || []).forEach(function (g) { if (seen[g[0]] && g[0] !== 'iq') l.push({ id: g[0], n: 'قنوات ' + g[1], kind: 'grp' }); });
    return l;
  }
  function filter(cid) {
    var all = window.CHANNELS || [];
    if (cid === 'all') return all;
    if (cid === 'news' || cid === 'sport' || cid === 'quran') return all.filter(function (c) { return c.g === cid; });
    return all.filter(function (c) { return c.c === cid; });
  }
  function grpName(code) { var g = (window.CH_GROUPS || []).filter(function (x) { return x[0] === code; })[0]; return g ? g[1] : ''; }
  function hue(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function draw() {
    var cs = cats(), cid = cs[st.ci].id;
    st.list = filter(cid);
    if (st.gi >= st.list.length) st.gi = Math.max(0, st.list.length - 1);
    var from = Math.max(0, Math.min(st.ci - 3, cs.length - 8)), html = '';
    for (var q = from; q < Math.min(cs.length, from + 8); q++) html += '<div class="lv-cat' + (q === st.ci ? ' on' : '') + (st.f === 'cat' && q === st.ci ? ' focus' : '') + '">' + esc(cs[q].n) + '</div>';
    $('lvCats').innerHTML = html;
    $('lvGrid').innerHTML = st.list.length ? st.list.map(function (c, i) {
      var tint = 'hsl(' + hue(c.n) + ',28%,24%)';
      return '<div class="lv-ch' + (st.f === 'grid' && i === st.gi ? ' focus' : '') + '"><div class="lv-art" style="background:' + tint + '"><b>' + esc(c.n.charAt(0) === 'ا' && c.n.charAt(1) === 'ل' ? c.n.slice(2, 4) : c.n.slice(0, 2)) + '</b></div>' +
        '<div class="lv-tx"><div class="lv-n">' + esc(c.n) + '</div><div class="lv-s">' + esc(grpName(c.c)) + (c.g === 'news' ? ' · أخبار' : c.g === 'sport' ? ' · رياضة' : c.g === 'quran' ? ' · قرآن' : '') + '</div></div></div>';
    }).join('') : '<div class="lv-empty">ماكو قنوات بهذا القسم</div>';
    var f = document.querySelector('#lvGrid .focus');
    var g = $('lvGrid'); if (f) { var top = f.offsetTop - 120; g.style.transform = 'translateY(' + (-Math.max(0, top)) + 'px)'; } else g.style.transform = '';
    $('lvCount').textContent = st.list.length + ' قناة';
  }
  function play() {
    if (!st.list.length) return;
    var payload = JSON.stringify(st.list.map(function (c) { return { n: c.n, u: c.u }; }));
    if (window.Android && window.Android.playLive) window.Android.playLive(payload, st.gi);
    else if (window.toastMsg) window.toastMsg('التشغيل يحتاج الشاشة نفسها');
  }
  var Live = {
    open: function () {
      st.f = 'grid'; st.ci = 0; st.gi = 0;
      document.getElementById('liveModal').classList.add('on');
      if (window.__setLayer) window.__setLayer('live');
      draw();
    },
    key: function (k) {
      var cs = cats();
      if (k === 'back') { if (window.__closeLive) window.__closeLive(); return; }
      if (st.f === 'cat') {
        if (k === 'ArrowUp') { st.ci = Math.max(0, st.ci - 1); st.gi = 0; }
        else if (k === 'ArrowDown') { st.ci = Math.min(cs.length - 1, st.ci + 1); st.gi = 0; }
        else if (k === 'ArrowLeft' || k === 'ok') { if (st.list.length) st.f = 'grid'; }
      } else {
        if (k === 'ArrowRight') { if (st.gi % COLS === 0) st.f = 'cat'; else st.gi--; }
        else if (k === 'ArrowLeft') { if (st.gi + 1 < st.list.length && st.gi % COLS < COLS - 1) st.gi++; }
        else if (k === 'ArrowUp') { if (st.gi - COLS >= 0) st.gi -= COLS; else st.f = 'cat'; }
        else if (k === 'ArrowDown') { if (st.gi + COLS < st.list.length) st.gi += COLS; else if (st.gi < st.list.length - 1) st.gi = st.list.length - 1; }
        else if (k === 'ok') { play(); return; }
      }
      draw();
    }
  };
  window.Live = Live;
})();
