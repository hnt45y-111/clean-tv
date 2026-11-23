/* core: store, rng, audio, vibration, fx helpers */
window.G = window.G || {};
(function () {
  var KEY = 'calmnerves.v1';
  var def = { lang: 'ar', sound: true, music: true, vib: true, diff: 'normal', name: 'لاعب', avatar: 0, hat: 0,
    level: 1, stars: 30, best: 0, streak: 0, maxStreak: 0, seen: [], ach: {}, tutorialDone: false, lastDaily: '', lastWheel: '',
    weekly: { wk: '', scores: [] }, played: 0, fast: 0, wins: 0, bosses: 0, steelBest: 0, pu: { freeze: 1, fifty: 1, second: 1 } };
  G.S = JSON.parse(JSON.stringify(def));
  try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r) for (var k in r) G.S[k] = r[k]; } catch (e) {}
  G.save = function () { try { localStorage.setItem(KEY, JSON.stringify(G.S)); } catch (e) {} };

  // seeded RNG (mulberry32) so a shared link reproduces the same challenges
  G.rng = function (seed) {
    var a = seed >>> 0;
    var f = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.int = function (n) { return Math.floor(f() * n); };
    f.pick = function (arr) { return arr[f.int(arr.length)]; };
    f.shuffle = function (arr) { arr = arr.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = f.int(i + 1), x = arr[i]; arr[i] = arr[j]; arr[j] = x; } return arr; };
    return f;
  };
  G.hash = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  G.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  G.$ = function (s, r) { return (r || document).querySelector(s); };
  G.el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  G.today = function () { return new Date().toISOString().slice(0, 10); };
  G.week = function () { var d = new Date(); var o = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.ceil(((d - o) / 864e5 + o.getDay() + 1) / 7); };

  // ---------- audio (synthesised: no asset files, works offline) ----------
  var ac, musicGain, musicTimer, tempo = 1, step = 0;
  function ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function tone(f, d, type, vol, when, slide, dest) {
    var c = ctx(); if (!c) return; var t = c.currentTime + (when || 0);
    var o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + d);
    g.gain.setValueAtTime(vol || .2, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(dest || c.destination); o.start(t); o.stop(t + d + .02);
  }
  var SFX = {
    tap: function () { tone(660, .07, 'square', .12, 0, 880); },
    correct: function () { tone(523, .12, 'triangle', .25); tone(784, .18, 'triangle', .25, .1); },
    wrong: function () { tone(220, .3, 'sawtooth', .22, 0, 80); },
    combo: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, .1, 'square', .15, i * .06); }); },
    boss: function () { tone(70, .8, 'sawtooth', .35, 0, 40); tone(140, .8, 'square', .2, .1, 60); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, .22, 'triangle', .28, i * .1); }); },
    glitch: function () { for (var i = 0; i < 6; i++) tone(200 + Math.random() * 1500, .05, 'square', .12, i * .04); },
    tick: function () { tone(1000, .04, 'square', .08); },
    pop: function () { tone(400, .08, 'sine', .2, 0, 900); }
  };
  G.sfx = function (n) { if (G.S.sound && SFX[n]) SFX[n](); };
  G.vib = function (p) { if (G.S.vib && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
  var SCALES = [[0, 3, 7, 10], [0, 4, 7, 11], [0, 2, 7, 9], [0, 3, 5, 8], [0, 4, 7, 9]];
  G.musicTempo = function (t) { tempo = t; };
  G.musicStart = function (world) {
    G.musicStop(); if (!G.S.music) return; var c = ctx(); if (!c) return;
    var sc = SCALES[((world || 1) - 1) % SCALES.length], base = 110 * Math.pow(2, ((world || 1) * 2 % 12) / 12);
    musicGain = c.createGain(); musicGain.gain.value = .5; musicGain.connect(c.destination);
    (function loop() {
      var n = sc[step % 4] + (step % 8 > 3 ? 12 : 0);
      tone(base * Math.pow(2, n / 12), .2, 'triangle', .07, 0, null, musicGain);
      if (step % 4 === 0) tone(base / 2, .3, 'sine', .1, 0, null, musicGain);
      step++; musicTimer = setTimeout(loop, 260 / tempo);
    })();
  };
  G.musicStop = function () { clearTimeout(musicTimer); musicTimer = null; tempo = 1; };
  document.addEventListener('pointerdown', function () { ctx(); }, { once: true });

  // ---------- fx ----------
  G.shake = function (el, ms) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(function () { el.classList.remove('shake'); }, ms || 400); };
  G.ic = function (t) { return t.indexOf('img:') === 0 ? '<img class="ic" src="img/' + (t.slice(4).indexOf('_') > 0 ? t.slice(4) : 'ic_' + t.slice(4)) + '.png" alt="">' : t; };
  G.floatEmoji = function (host, ch, x, y) {
    var e = G.el('div', 'fl-emoji', G.ic(ch)); e.style.left = (x != null ? x : 10 + Math.random() * 80) + '%'; e.style.top = (y != null ? y : 60) + '%';
    host.appendChild(e); setTimeout(function () { e.remove(); }, 1500);
  };
  G.sparkle = function (host, x, y) {
    for (var i = 0; i < 6; i++) {
      var s = G.el('i', 'spark'); var a = Math.random() * 6.28, d = 20 + Math.random() * 30;
      s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      host.appendChild(s); setTimeout(function (n) { n.remove(); }.bind(null, s), 600);
    }
  };
  G.confetti = function (host, n) {
    var cols = ['#ff3b6b', '#ffd21f', '#34d52a', '#2a9bff', '#a63cff', '#ff8a14'];
    for (var i = 0; i < (n || 60); i++) {
      var c = G.el('i', 'confetti'); c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % cols.length];
      c.style.animationDuration = 2 + Math.random() * 2.5 + 's'; c.style.animationDelay = Math.random() * 1.5 + 's';
      c.style.transform = 'rotate(' + Math.random() * 360 + 'deg)'; host.appendChild(c);
    }
  };
  G.cracks = function (host) {
    var d = G.el('div', 'cracked'); d.innerHTML = '<svg viewBox="0 0 100 200" preserveAspectRatio="none"><g stroke="#fff" stroke-width=".6" fill="none" opacity=".9"><path d="M50 100 L20 30 L5 0 M50 100 L80 40 L95 0 M50 100 L10 120 L0 160 M50 100 L90 130 L100 190 M50 100 L48 160 L55 200 M20 30 L35 20 M80 40 L65 25 M10 120 L25 140"/></g></svg>';
    host.appendChild(d);
  };
  document.addEventListener('pointerdown', function (e) { var h = G.$('#app'); if (!h) return; var r = h.getBoundingClientRect(); G.sparkle(h, e.clientX - r.left, e.clientY - r.top); });
})();
