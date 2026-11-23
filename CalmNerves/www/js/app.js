/* app: screen manager, game engine, all screens */
(function () {
  var app, scr, cur = { name: 'menu', args: {} }, tutorialText = null;
  var $ = G.$, el = G.el, t = G.t;
  var DIFFS = ['easy', 'normal', 'hard', 'insane'];
  var dIndex = function () { return DIFFS.indexOf(G.S.diff); };
  G.titleIdx = function () { return Math.min(G.STR.en.titles.length - 1, Math.floor((G.S.level - 1) / 15)); };
  var seasonIdx = function () { var m = new Date().getMonth(); return [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][m]; };

  function btn(cls, html, fn) { var b = el('button', 'gbtn ' + cls, '<span>' + html + '</span>'); b.onclick = function () { G.sfx('tap'); G.vib(10); fn && fn(); }; return b; }
  function round(cls, icon, label, fn) { var b = el('button', 'round ' + cls, '<i>' + icon + '</i>' + (label ? '<small>' + label + '</small>' : '')); b.onclick = function () { G.sfx('tap'); G.vib(10); fn(); }; return b; }
  function back(fn) { var b = el('button', 'back', '←'); b.onclick = function () { G.sfx('tap'); fn ? fn() : go('menu'); }; return b; }
  function banner(txt, crown) { return el('div', 'banner' + (crown ? ' crowned' : ''), (crown ? G.crownSVG : '') + '<span>' + txt + '</span>'); }
  function speak(txt) { if (!G.S.sound || !window.speechSynthesis) return; try { var u = new SpeechSynthesisUtterance(txt); u.lang = { ar: 'ar', en: 'en-US', tr: 'tr-TR', fr: 'fr-FR', es: 'es-ES' }[G.lang]; u.pitch = 1.9; u.rate = 1.2; u.volume = .6; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }

  function go(name, args) {
    cur = { name: name, args: args || {} }; var next = el('div', 'screen ' + name); scr.classList.add('out');
    var old = scr; setTimeout(function () { old.remove(); }, 220);
    scr = next; app.appendChild(scr); (S[name] || S.menu)(scr, cur.args); scr.classList.add('in');
    if (name !== 'game') { G.musicStop(); }
  }
  G.go = go;
  G.goBack = function () { if (cur.name === 'menu') return false; go(cur.name === 'game' ? 'map' : 'menu'); return true; };

  // ================= screens =================
  var S = {};
  S.menu = function (s) {
    var logo = el('div', 'logo', '<img src="img/logo.png" alt="">' + (G.lang === 'ar' ? '' : '<small>' + t('title1') + ' ' + t('title2') + '</small>'));
    var cw = el('div', 'charwrap', G.charSVG('calm')); var ledge = el('div', 'ledge');
    var start = btn('start', t('start'), function () { go('map'); });
    var row = el('div', 'row2'); row.appendChild(round('gear', '', t('settings'), function () { go('settings'); })); row.appendChild(round('rtrophy', '', t('achievements'), function () { go('ach'); }));
    var prof = el('button', 'prof', G.charSVG('calm', { avatar: G.S.avatar }) + '<span>' + G.S.name + '</span>'); prof.onclick = function () { G.sfx('tap'); go('profile'); };
    var modes = el('div', 'modes'); [['🎁', t('daily'), 'daily'], ['♾️', t('endless'), 'steel'], ['🧘', t('practice'), 'practice'], ['⚔️', t('duel'), 'duel']].forEach(function (m) {
      var b = el('button', 'mode', '<i>' + m[0] + '</i><small>' + m[1] + '</small>'); b.onclick = function () { G.sfx('tap'); startMode(m[2]); }; modes.appendChild(b); });
    s.append(prof, logo, cw, ledge, start, row, modes, el('div', 'season', t('season', { s: t('seasons')[seasonIdx()] })));
  };

  S.map = function (s) {
    var top = el('div', 'topbar'); top.append(back(), banner(t('titles')[G.titleIdx()], true), (function () { var b = el('button', 'trophy', ''); b.onclick = function () { go('ach'); }; return b; })()); s.appendChild(top);
    var sc = el('div', 'mapscroll'), H = 96, N = 500, tot = N * H + 260, inner = el('div', 'mapinner'); inner.style.height = tot + 'px';
    var xs = function (i) { return 50 + 26 * Math.sin(i * .9); }, ys = function (i) { return tot - 130 - (i - 1) * H; }, d = '';
    for (var i = 1; i <= N; i++) { var px = xs(i) * 4.2, py = ys(i); d += (i === 1 ? 'M' : 'L') + px.toFixed(0) + ' ' + py; }
    inner.innerHTML = '<svg class="trail" viewBox="0 0 420 ' + tot + '" preserveAspectRatio="none" style="height:' + tot + 'px"><path d="' + d + '" fill="none" stroke="#ff8a14" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity=".35"/><path d="' + d + '" fill="none" stroke="#ffd27a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    for (var n = 1; n <= N; n++) (function (n) {
      var boss = n % 10 === 0, st = n < G.S.level ? 'done' : n === G.S.level ? 'cur' : 'lock';
      var nd = el('button', 'node ' + st + (boss ? ' boss' : '') + (n === N ? ' final' : ''), (boss ? '<img class="face" src="img/' + (n === N ? 'flame2' : 'flame') + '.png" alt="">' : '') + '<em>' + n + '</em>' + (n === N ? '<small>' + t('finalStage') + '</small>' : ''));
      nd.style.left = xs(n) + '%'; nd.style.top = ys(n) + 'px';
      if (st === 'cur') nd.insertAdjacentHTML('beforeend', '<u class="flag">🚩</u>');
      nd.onclick = function () { if (n > G.S.level) { G.sfx('wrong'); G.shake(nd); return; } G.sfx('tap'); startLevel(n); }; inner.appendChild(nd);
    })(n);
    sc.appendChild(inner); s.appendChild(sc); setTimeout(function () { sc.scrollTop = ys(Math.min(N, G.S.level)) - sc.clientHeight / 2; }, 30);
  };

  S.settings = function (s) {
    var top = el('div', 'topbar'); top.append(back(), banner(t('settings'), true)); s.appendChild(top);
    var p = el('div', 'panel scroll'); s.appendChild(p);
    p.appendChild(el('h3', '', t('language'))); var lg = el('div', 'chips');
    Object.keys(G.LANGS).forEach(function (k) { var c = el('button', 'chip' + (k === G.lang ? ' sel' : ''), G.LANGS[k].name); c.onclick = function () { G.sfx('tap'); G.S.lang = k; G.setLang(k); G.save(); go('settings'); }; lg.appendChild(c); }); p.appendChild(lg);
    p.appendChild(el('small', 'hint', t('settingsHint')));
    [['sound', 'sound'], ['music', 'music'], ['vib', 'vibration']].forEach(function (x) {
      var r = el('div', 'trow', '<span>' + t(x[1]) + '</span>'), sw = el('button', 'switch' + (G.S[x[0]] ? ' on' : ''), '<i></i>');
      sw.onclick = function () { G.S[x[0]] = !G.S[x[0]]; sw.classList.toggle('on', G.S[x[0]]); G.save(); G.sfx('tap'); G.vib(30); }; r.appendChild(sw); p.appendChild(r); });
    p.appendChild(el('h3', '', t('difficulty'))); var df = el('div', 'chips');
    DIFFS.forEach(function (k) { var c = el('button', 'chip' + (k === G.S.diff ? ' sel' : ''), t(k)); c.onclick = function () { G.sfx('tap'); G.S.diff = k; G.save(); go('settings'); }; df.appendChild(c); }); p.appendChild(df);
  };

  S.diff = function (s, a) {
    s.appendChild(banner(t('pickDiff'), true)); s.appendChild(el('div', 'charwrap small', G.charSVG('calm')));
    var box = el('div', 'diffs'); DIFFS.forEach(function (k, i) { box.appendChild(btn(['green', 'blue', 'orange', 'red'][i], t(k), function () { G.S.diff = k; G.S.tutorialDone = true; G.save(); go('map'); })); }); s.appendChild(box);
  };

  S.ach = function (s) {
    var top = el('div', 'topbar'); top.append(back(), banner(t('achievements'), true)); s.appendChild(top);
    var g = el('div', 'panel scroll agrid'); Object.keys(G.STR.en.achNames).forEach(function (k) { var on = G.S.ach[k];
      g.appendChild(el('div', 'ach' + (on ? ' on' : ''), '<i>' + (on ? '🏅' : '🔒') + '</i><b>' + t('achNames')[k] + '</b><small>' + t('achDesc')[k] + '</small>')); });
    s.appendChild(g);
  };

  S.profile = function (s) {
    var top = el('div', 'topbar'); top.append(back(), banner(t('profileTitle'), true)); s.appendChild(top);
    var p = el('div', 'panel scroll'); s.appendChild(p);
    var pv = el('div', 'pv', G.charSVG('calm')); p.appendChild(pv);
    var nm = el('input', 'name'); nm.value = G.S.name; nm.maxLength = 14; nm.onchange = function () { G.S.name = nm.value.trim() || G.S.name; G.save(); }; p.append(el('h3', '', t('name')), nm);
    p.appendChild(el('h3', '', t('avatar'))); var av = el('div', 'agrid2');
    G.AVATARS.forEach(function (a, i) { var ok = G.avatarUnlocked(i), b = el('button', 'av' + (G.S.avatar === i ? ' sel' : '') + (ok ? '' : ' lock'), ok ? G.charSVG('calm', { avatar: i, hat: 0 }) : '🔒<small>' + t('unlock', { n: a[2] }) + '</small>');
      b.onclick = function () { if (!ok) { G.sfx('wrong'); return; } G.sfx('tap'); G.S.avatar = i; G.save(); go('profile'); }; av.appendChild(b); }); p.appendChild(av);
    var hs = el('div', 'agrid2 hats'); G.HATS.forEach(function (h, i) { var ok = G.hatUnlocked(i), b = el('button', 'av hat' + (G.S.hat === i ? ' sel' : '') + (ok ? '' : ' lock'), ok ? (h || '∅') : '🔒<small>' + G.HAT_UNLOCK[i] + '</small>');
      b.onclick = function () { if (!ok) { G.sfx('wrong'); return; } G.sfx('tap'); G.S.hat = i; G.save(); go('profile'); }; hs.appendChild(b); }); p.appendChild(hs);
    var n = Object.keys(G.S.ach).length; p.appendChild(el('div', 'stats', '<div><b>' + G.S.level + '</b>' + t('level') + '</div><div><b>' + G.S.best + '</b>' + t('best') + '</div><div><b>' + n + '/10</b>' + t('ach') + '</div><div><b>' + t('titles')[G.titleIdx()] + '</b>' + t('stage') + '</div>'));
  };

  S.daily = function (s) {
    var top = el('div', 'topbar'); top.append(back(), banner(t('daily'), true)); s.appendChild(top);
    var p = el('div', 'panel scroll'); s.appendChild(p); var tdy = G.today();
    var done = G.S.lastDaily === tdy, c1 = el('div', 'card', '<i class="big">🎁</i><h3>' + t('chest') + '</h3>'); p.appendChild(c1);
    c1.appendChild(done ? el('small', '', t('come')) : btn('green', t('play'), function () { startMode('dailyrun'); }));
    var wd = G.S.lastWheel === tdy, c2 = el('div', 'card', '<h3>' + t('wheel') + '</h3>'), prizes = [5, 10, 15, 25, 5, 50, 10, 20];
    var wheel = el('div', 'wheel'); wheel.innerHTML = prizes.map(function (v, i) { return '<b style="transform:rotate(' + (i * 45 + 22) + 'deg) translateY(-62px)">' + v + '</b>'; }).join('') + '<u>▼</u>'; c2.appendChild(wheel);
    var spinBtn; c2.appendChild(wd ? el('small', '', t('come')) : btn('orange', t('spin'), function () {
      spinBtn.disabled = true; var k = Math.floor(Math.random() * 8); wheel.style.transform = 'rotate(' + (1440 - k * 45) + 'deg)'; G.S.lastWheel = tdy; G.sfx('combo');
      setTimeout(function () { G.S.stars += prizes[k]; G.save(); G.sfx('win'); G.confetti(s, 40); speak(t('correct')); setTimeout(function () { go('daily'); }, 1500); }, 3200); }));
    spinBtn = c2.querySelector('.gbtn'); p.appendChild(c2);
  };

  S.story = function (s, a) {
    s.appendChild(banner(t('storyTitle') + ' · ' + t('worldWord') + ' ' + a.world, true)); s.appendChild(el('div', 'charwrap small', G.charSVG('worried')));
    s.appendChild(el('div', 'bubble big', t('story')[(a.world - 1) % 3]));
    var ps = G.S.fast / Math.max(1, G.S.wins) > .5 ? 1 : G.S.maxStreak >= 8 ? 2 : G.S.wins > 20 ? 0 : 3;
    s.appendChild(el('div', 'bubble', '🏷️ ' + t('playstyles')[ps]));
    var row = el('div', 'col'); row.appendChild(btn('blue', t('share'), function () { shareCard(t('playstyles')[ps], a.world); })); row.appendChild(btn('green', t('continue'), function () { go('map'); })); s.appendChild(row);
  };

  S.result = function (s, r) {
    s.appendChild(back());
    s.appendChild(banner(r.win ? t('winLines')[Math.floor(Math.random() * 4)] : t('loseLines')[Math.floor(Math.random() * 4)], true));
    s.appendChild(el('div', 'charwrap res', G.charSVG(r.win ? 'win' : 'furious')));
    s.appendChild(el('div', 'scorepanel', '<small>' + t('score') + '</small><b><i>★</i>' + r.score + '</b>' + (r.combo > 1 ? '<em>' + t('combo') + ' ×' + r.combo.toFixed(1) + '</em>' : '')));
    s.appendChild(btn('challenge wide', t('challengeFriends'), function () { friendLink(r); }));
    var row = el('div', 'row3'); row.appendChild(round('home', '', '', function () { go('menu'); }));
    row.appendChild(btn('share grow', t('share'), function () { shareCard(r.win ? t('winLines')[0] : t('loseLines')[0], r.level, r.score); }));
    row.appendChild(round(r.win ? 'green' : 'orange', r.win ? '▶' : '↻', '', function () { r.next(); })); s.appendChild(row);
    if (r.win) { G.confetti(s, 80); G.sfx('win'); speak(t('correct')); } else { G.cracks(s); G.sfx('wrong'); speak(t('wrong')); G.shake(app, 600); }
  };

  // ================= sharing =================
  function friendLink(r) {
    var url = location.href.split('#')[0] + '#seed=' + r.seed + '&lvl=' + r.level, msg = t('friendMsg', { s: r.score });
    if (window.Android && Android.share) Android.share(msg + ' ' + url);
    else if (navigator.share) navigator.share({ title: t('title1') + ' ' + t('title2'), text: msg, url: url }).catch(function () {});
    else { try { navigator.clipboard.writeText(msg + ' ' + url); } catch (e) {} toast(t('challengeLink')); }
  }
  function shareCard(title, lvl, score) {
    if (window.Android && Android.share) { Android.share(title + ' — ' + t('title1') + ' ' + t('title2') + ' ' + t('stage') + ' ' + (lvl || '') + (score ? ' ★ ' + score : '')); return; }
    var c = document.createElement('canvas'); c.width = 720; c.height = 720; var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, '#2a1860'); g.addColorStop(1, '#0c0830'); x.fillStyle = g; x.fillRect(0, 0, 720, 720);
    x.textAlign = 'center'; x.fillStyle = '#ffd21f'; x.font = '900 70px Cairo, sans-serif'; x.fillText(t('title1') + ' ' + t('title2'), 360, 140);
    x.fillStyle = '#ff9a2a'; x.beginPath(); x.arc(360, 380, 150, 0, 7); x.fill(); x.lineWidth = 10; x.strokeStyle = '#2a0f3e'; x.stroke();
    x.fillStyle = '#fff'; [300, 420].forEach(function (cx) { x.beginPath(); x.ellipse(cx, 350, 40, 46, 0, 0, 7); x.fill(); x.stroke(); }); x.fillStyle = '#10061f'; [305, 415].forEach(function (cx) { x.beginPath(); x.arc(cx, 358, 18, 0, 7); x.fill(); });
    x.fillStyle = '#fff'; x.font = '900 52px Cairo, sans-serif'; x.fillText(title, 360, 600); x.font = '700 38px Cairo, sans-serif'; x.fillStyle = '#9fe870'; x.fillText(t('stage') + ' ' + (lvl || '') + (score ? ' · ★ ' + score : ''), 360, 660);
    c.toBlob(function (b) { var f = new File([b], 'calm-nerves.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: title }).catch(function () {});
      else { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'calm-nerves.png'; a.click(); } });
  }
  function toast(m) { var d = el('div', 'toast', m); app.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }

  // ================= engine =================
  G.pickType = function (level, rng, last, boss) {
    if (boss) return G.BOSS;
    var pool = G.CH.filter(function (c) { return c.minLevel <= level && c.id !== last; }), tot = pool.reduce(function (a, c) { return a + c.weight; }, 0), r = rng() * tot;
    for (var i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) return pool[i]; } return pool[0];
  };
  var lastType = '';
  var TUT = ['dontpress', 'riddle', 'memory', 'gauge', 'boss'];

  // plays ONE challenge; resolves {win, left, secs}
  function challenge(o) {
    return new Promise(function (resolve) {
      var s = el('div', 'screen game'); scr.classList.add('out'); var old = scr; setTimeout(function () { old.remove(); }, 200); scr = s; app.appendChild(s); s.classList.add('in'); cur = { name: 'game' };
      var rng = G.rng(o.seed), def = o.boss ? G.BOSS : (o.type ? G.CH.filter(function (c) { return c.id === o.type; })[0] : G.pickType(o.level, rng, lastType));
      lastType = def.id; var d = Math.max(0, dIndex()), ctx = { rng: rng, level: o.level, d: d, wrongBtns: [], level_: o.level }, total = def.time(ctx), left = total, frozen = 0, armed = false, over = false, cleanup, twistT = [];
      if (o.practice) total = left = 99; if (o.shrink) { total = left = Math.max(4, total - o.shrink); }
      var surv = def.survive || def.id === 'boss';
      var top = el('div', 'topbar'); top.append(back(function () { finish(false, true); }), banner(o.title || (t('stage') + ' ' + o.level)));
      var hud = el('div', 'hud ' + (surv ? 'plate' : 'ringhud')), pu = el('div', 'pus');
      hud.innerHTML = surv ? '<img class="sw" src="img/stopwatch.png" alt=""><b class="digits">00:00</b>' : '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="bgc"/><circle cx="50" cy="50" r="44" class="fg" pathLength="100"/></svg><b class="digits">0</b>';
      var cw = el('div', 'charwrap game', def.id === 'boss' ? G.bossSVG() : G.charSVG('calm')), prompt = el('div', 'prompt'), area = el('div', 'play'), taunt = el('div', 'taunt', '');
      var ph = el('div', 'phold'); ph.appendChild(prompt); ctx.root = area;
      ctx.prompt = function (h, sub) { if (!sub) prompt.innerHTML = h; else taunt.textContent = h; }; ctx.say = function (h) { taunt.textContent = h; }; ctx.promptCls = function (c) { prompt.className = 'prompt ' + (c || ''); };
      ctx.react = function (st) { if (def.id === 'boss' && st !== 'furious') return; if (def.id === 'boss') return; cw.innerHTML = G.charSVG(st); };
      ctx.sub = function () { G.sfx('correct'); G.shake(app, 300); };
      ctx.win = function () { finish(true); }; ctx.fail = function () { finish(false); };
      ctx.removeTwo = function () { ctx.wrongBtns.slice(0, 2).forEach(function (b) { b.style.opacity = .15; b.style.pointerEvents = 'none'; }); };
      if (!surv) hud.classList.add('ringhud');
      s.append(top, hud, cw, ph, area, taunt, pu);
      var bossLoop; if (def.id === 'boss') { s.classList.add('bossmode'); G.confetti; }
      // power-ups
      if (!o.noPU) [['freeze', '❄️', 20], ['fifty', '✂️', 25], ['second', '🛡️', 30]].forEach(function (p) {
        var b = el('button', 'pu', '<i>' + p[1] + '</i><small>' + (G.S.pu[p[0]] || ('★' + p[2])) + '</small>');
        b.onclick = function () { if (over) return; G.sfx('tap');
          if (!G.S.pu[p[0]]) { if (G.S.stars < p[2]) { G.sfx('wrong'); return; } G.S.stars -= p[2]; G.S.pu[p[0]] = 1; } G.S.pu[p[0]]--; G.save();
          if (p[0] === 'freeze') { frozen = 5; G.sfx('combo'); s.classList.add('frozen'); setTimeout(function () { s.classList.remove('frozen'); }, 5000); } else if (p[0] === 'fifty') ctx.removeTwo(); else { armed = true; b.classList.add('armed'); }
          b.querySelector('small').textContent = G.S.pu[p[0]] || ('★' + p[2]); }; pu.appendChild(b); });
      // tutorial bubble
      if (o.tutorial) { var bub = el('div', 'bubble tut', o.tutorial); s.appendChild(bub); area.classList.add('hl'); setTimeout(function () { bub.classList.add('fade'); }, 6000); speak(o.tutorial); }
      G.musicStart(Math.ceil(o.level / 10)); cleanup = def.mount(ctx) || function () {};
            var tick = setInterval(function () {
        if (over) return; if (!o.practice) { if (frozen > 0) frozen -= .1; else left -= .1; }
        var pct = left / total, ring = $('.fg', hud), dg = $('.digits', hud);
        if (ring) { ring.style.strokeDashoffset = (100 - pct * 100); ring.style.stroke = pct > .5 ? '#34d52a' : pct > .25 ? '#ff9a14' : '#ff2a2a'; }
        var sec = Math.max(0, Math.ceil(left)); if (dg) { dg.textContent = surv ? '00:' + (sec < 10 ? '0' : '') + sec : sec; dg.classList.toggle('low', pct < .3); }
        if (pct < .3 && !o.practice) { hud.classList.add('glitch'); G.musicTempo(1.6); if (Math.round(left * 10) % 10 === 0) G.sfx('tick'); } else { hud.classList.remove('glitch'); }
        if (pct < .6 && def.id !== 'boss' && !cw.dataset.s) { cw.dataset.s = 1; cw.innerHTML = G.charSVG('worried'); } if (pct < .3 && cw.dataset.s !== '2' && def.id !== 'boss') { cw.dataset.s = 2; cw.innerHTML = G.charSVG('sweat'); }
        if (!o.practice && Math.round(left * 10) % 25 === 0 && pct > .1) taunt.textContent = t('taunts')[Math.floor(Math.random() * 6)];
        if (left <= 0) { if (def.survive) finish(true); else finish(false); }
      }, 100);
      // surprise twists after level 10
      if (o.level > 10 && !o.tutorial && !o.practice && Math.random() < .35) twistT.push(setTimeout(function () {
        if (over) return; var k = Math.floor(Math.random() * 3);
        if (k === 0) { area.classList.add('flip'); ctx.say(t('twistFlip')); setTimeout(function () { area.classList.remove('flip'); }, 2500); }
        else if (k === 1) { area.classList.add('revtwist'); ctx.say(t('twistRev')); }
        else { G.sfx('glitch'); G.vib([50, 30, 50]); hud.classList.add('glitch'); ctx.say(t('twistGlitch')); }
      }, 2000 + Math.random() * 3000));
      function finish(win, quit) {
        if (over) return;
        if (!win && armed && !quit) { armed = false; $('.pu.armed', s) && $('.pu.armed', s).classList.remove('armed'); cleanup(); area.innerHTML = ''; left = Math.max(left, total * .5); cleanup = def.mount(ctx) || function () {}; G.sfx('combo'); return; }
        if (!win && (o.tutorial) && !quit) { cleanup(); area.innerHTML = ''; ctx.wrongBtns.length = 0; cleanup = def.mount(ctx) || function () {}; ctx.say('👍'); G.shake(area); return; }
        over = true; clearInterval(tick); twistT.forEach(clearTimeout); cleanup(); G.musicStop();
        if (quit) { resolve({ quit: true }); return; }
        var secs = total - left; cw.innerHTML = win ? G.charSVG('win') : G.charSVG('furious'); G.floatEmoji(s, win ? '🎉' : '💥', 50, 50);
        if (win) { G.sfx('correct'); G.vib(40); } else { G.sfx('wrong'); G.vib([120, 60, 120]); G.shake(app, 500); }
        setTimeout(function () { resolve({ win: win, left: Math.max(0, left), secs: secs, boss: def.id === 'boss' }); }, 800);
      }
    });
  }

  function scoreFor(r, streak) { var mult = 1 + Math.min(streak, 10) * .1; return { mult: mult, score: Math.round((100 + r.left * 10) * mult) }; }
  function afterWin(r, level, campaign) {
    G.S.streak++; G.S.maxStreak = Math.max(G.S.maxStreak, G.S.streak); G.S.wins++; if (r.secs < 4) G.S.fast++; if (r.boss) G.S.bosses++;
    var sc = scoreFor(r, G.S.streak); G.S.best = Math.max(G.S.best, sc.score); G.S.stars += 5 + (r.boss ? 25 : 0) + Math.min(10, G.S.streak);
    if (campaign && level === G.S.level && level < 500) G.S.level++; if (G.S.streak >= 3) G.sfx('combo'); checkAch(); G.save(); return sc;
  }
  function checkAch() {
    var c = { first: G.S.wins >= 1, ten: G.S.level > 10, fifty: G.S.level > 50, streak5: G.S.maxStreak >= 5, streak10: G.S.maxStreak >= 10, boss1: G.S.bosses >= 1, stars100: G.S.stars >= 100, rich: G.S.stars >= 500, daily: !!G.S.lastDaily, steel: G.S.steelBest > 0 };
    Object.keys(c).forEach(function (k) { if (c[k] && !G.S.ach[k]) { G.S.ach[k] = 1; toast('🏅 ' + t('achNames')[k]); } });
  }

  // campaign level
  async function startLevel(level, seedOverride) {
    var tut = !G.S.tutorialDone && level <= 5, boss = (level % 10 === 0) || (tut && level === 5), seed = seedOverride || G.hash('lvl' + level + (G.S.name.length > 100 ? '' : '') + 'x');
    var o = { level: level, seed: seed, boss: boss, type: tut ? (level === 5 ? null : TUT[level - 1]) : null, tutorial: tut ? t('tutorial')[level - 1] : null, noPU: false };
    var r = await challenge(o); if (r.quit) { go('map'); return; }
    var res = { win: r.win, level: level, seed: seed, score: 0, combo: 1, next: function () { r.win ? (tut && level === 5 ? go('diff') : startLevel(level + 1)) : startLevel(level); } };
    if (r.win) { var sc = afterWin(r, level, true); res.score = sc.score; res.combo = sc.mult; if (boss && !tut) { res.next = function () { go('story', { world: level / 10 }); }; } }
    else { G.S.streak = 0; G.save(); }
    go('result', res);
  }
  // seeded run of n challenges (friend / daily / duel). returns {wins, score}
  async function runSet(seedBase, n, level, title) {
    var wins = 0, score = 0;
    for (var i = 0; i < n; i++) { var r = await challenge({ level: level, seed: seedBase + i * 7919, title: title + ' ' + (i + 1) + '/' + n, noPU: true }); if (r.quit) return null; if (r.win) { wins++; score += scoreFor(r, wins).score; } }
    return { wins: wins, score: score };
  }
  async function startMode(m) {
    if (m === 'daily') { go('daily'); return; }
    if (m === 'dailyrun') { var d = G.hash(G.today()), rr = await runSet(d, 3, Math.max(5, G.S.level), t('daily')); if (!rr) { go('daily'); return; } if (rr.wins === 3) { G.S.stars += 40; G.S.lastDaily = G.today(); checkAch(); G.save(); G.confetti(scr, 50); }
      go('result', { win: rr.wins === 3, level: G.S.level, seed: d, score: rr.score, combo: 1, next: function () { go('daily'); } }); return; }
    if (m === 'practice') { (async function loop() { var r = await challenge({ level: Math.max(1, G.S.level), seed: Math.floor(Math.random() * 1e9), practice: true, noPU: true, title: t('practice') }); if (r.quit) { go('menu'); return; } loop(); })(); return; }
    if (m === 'steel') { var wins = 0, score = 0, lv = Math.max(10, G.S.level); G.S.steelBest = G.S.steelBest || 0;
      while (true) { var r = await challenge({ level: lv + wins, seed: Math.floor(Math.random() * 1e9), shrink: Math.floor(wins / 3), title: t('endless') + ' · ' + wins }); if (r.quit) { go('menu'); return; } if (!r.win) break; wins++; score += scoreFor(r, wins).score; }
      var wk = G.week(); if (G.S.weekly.wk !== wk) G.S.weekly = { wk: wk, scores: [] }; G.S.weekly.scores.push(score); G.S.weekly.scores.sort(function (a, b) { return b - a; }); G.S.weekly.scores = G.S.weekly.scores.slice(0, 5);
      G.S.steelBest = Math.max(G.S.steelBest, score || 1); checkAch(); G.save();
      go('result', { win: wins >= 3, level: wins, seed: 0, score: score, combo: 1, next: function () { startMode('steel'); } }); toast(t('weekly') + ': ' + G.S.weekly.scores.join(' · ')); return; }
    if (m === 'duel') { var seed = Math.floor(Math.random() * 1e9), res = [];
      for (var p = 1; p <= 2; p++) { toast(t('player') + ' ' + p); var rr2 = await runSet(seed, 3, Math.max(5, G.S.level), t('player') + ' ' + p); if (!rr2) { go('menu'); return; } res.push(rr2.score); }
      var w = res[0] === res[1] ? t('draw') : t('winner') + ': ' + t('player') + ' ' + (res[0] > res[1] ? 1 : 2);
      go('result', { win: true, level: 0, seed: seed, score: Math.max(res[0], res[1]), combo: 1, next: function () { go('menu'); } }); toast(w + '  (' + res.join(' - ') + ')'); return; }
  }
  async function startFriend(seed, lvl) { var rr = await runSet(seed, 3, lvl || 10, t('challengeFriends')); if (!rr) { go('menu'); return; }
    go('result', { win: rr.wins >= 2, level: lvl, seed: seed, score: rr.score, combo: 1, next: function () { go('menu'); } }); }

  // ================= boot =================
  G.boot = function () {
    G.setLang(G.S.lang); app = $('#app'); scr = el('div', 'screen'); app.appendChild(scr);
    go('menu');
    var m = location.hash.match(/seed=(\d+)&lvl=(\d+)/); if (m) { var b = btn('green', t('play'), function () { ov.remove(); startFriend(+m[1], +m[2]); }), ov = el('div', 'overlay'); ov.append(el('h2', '', t('challengeFriends')), b); app.appendChild(ov); }
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
  };
  window.addEventListener('load', G.boot);
  G._test = { challenge: challenge, startLevel: startLevel };
})();
