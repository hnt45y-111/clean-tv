/* Challenge registry. To add a type: push a new entry to G.CH (see README).
   def = { id, weight, minLevel, time(ctx)->seconds, survive?:bool, mount(ctx)->cleanup? }
   ctx  = { root, rng, level, d (0..3), say(), prompt(), win(), fail(), react(state), wrongBtns[] } */
window.G = window.G || {};
G.CH = [];
var BTN = ['blue', 'green', 'orange', 'purple'];

G.pickQuestion = function (rng, maxD, cats) {
  var pool = [];
  G.Q.forEach(function (q, i) { if ((!cats || cats.indexOf(q.c) > -1) && q.d <= maxD && G.S.seen.indexOf(i) < 0) pool.push(i); });
  if (!pool.length) { // bank exhausted for this filter: reset only the seen entries of this filter
    G.S.seen = G.S.seen.filter(function (i) { var q = G.Q[i]; return (cats && cats.indexOf(q.c) < 0) || q.d > maxD; });
    G.Q.forEach(function (q, i) { if ((!cats || cats.indexOf(q.c) > -1) && q.d <= maxD) pool.push(i); });
  }
  var i = rng.pick(pool); G.S.seen.push(i); return i;
};
// builds the 4 glossy answer buttons (labels[0] is correct); glide=true makes them swap places slowly
G.answerButtons = function (ctx, labels, opt) {
  opt = opt || {}; var n = labels.length, box = G.el('div', 'answers'); box.style.height = n * 23 + '%';
  var order = ctx.rng.shuffle(labels.map(function (_, i) { return i; })), btns = [], slots = order.slice(), done = false;
  var place = function (b, slot) { b.style.top = slot * (100 / n) + '%'; b.style.height = (100 / n - 3) + '%'; };
  labels.forEach(function (l, i) {
    var b = G.el('button', 'gbtn ' + BTN[i % 4], '<span>' + l + '</span>'); b.dataset.i = i; place(b, slots.indexOf(i));
    b.onclick = function () { if (done) return; G.sfx('tap'); if (i === 0) { done = true; b.classList.add('ok'); ctx.win(); } else { done = true; b.classList.add('bad'); ctx.fail(); } };
    if (i) ctx.wrongBtns.push(b); box.appendChild(b); btns.push(b);
  });
  var timer = null;
  if (opt.glide) timer = setInterval(function () {
    var a = ctx.rng.int(n), c = (a + 1 + ctx.rng.int(n - 1)) % n, t = slots[a]; slots[a] = slots[c]; slots[c] = t;
    btns.forEach(function (b, i) { place(b, slots[i]); });
  }, 1600 - ctx.d * 250);
  ctx.root.appendChild(box); return function () { clearInterval(timer); };
};
G.timerSec = function (base, ctx) { return Math.max(4, Math.round(base - ctx.d * 1.5 - Math.min(ctx.level, 100) * .03)); };
G.qForCtx = function (ctx, cats) { var q = G.Q[G.pickQuestion(ctx.rng, Math.min(3, 1 + Math.floor((ctx.level + ctx.d * 8) / 25)), cats)], L = ['ar', 'en', 'tr', 'fr', 'es'].indexOf(G.lang); return { q: q.t[L], a: q.a[L] }; };

// 1. Don't Press
G.CH.push({ id: 'dontpress', weight: 3, minLevel: 1, survive: true, time: function (c) { return 6 + c.d * 2 + (c.ownTime ? 0 : 2); },
  mount: function (ctx) {
    var box = G.el('div', 'dp'); box.innerHTML = '<button class="bigred"><span>' + G.t('dontPress') + '</span></button>'; ctx.root.appendChild(box);
    ctx.prompt(G.t('sure'), true);
    var alive = true, tmr = [], big = G.$('.bigred', box);
    big.onclick = function () { if (!alive) return; G.sfx('wrong'); ctx.fail(); };
    var dialog = function () {
      if (!alive) return; var d = G.el('div', 'fake'), prize = ctx.rng() < .5;
      var yes = '<button class="gbtn green" data-bad="1"><span>' + G.t('yes') + '</span></button>', no = '<button class="gbtn orange"><span>' + G.t('no') + '</span></button>';
      d.innerHTML = '<div class="fake-box"><p>' + (prize ? G.t('prize') : G.t('sure')) + '</p><div class="row">' + (ctx.rng() < .5 ? yes + no : no + yes) + '</div></div>'; ctx.root.appendChild(d);
      d.querySelectorAll('button').forEach(function (b) { b.onclick = function () { G.sfx('tap'); if (b.dataset.bad) { alive = false; ctx.fail(); } d.remove(); }; });
      tmr.push(setTimeout(function () { d.remove(); }, 2600));
    };
    tmr.push(setInterval(dialog, 2400 - ctx.d * 250)); tmr.push(setTimeout(dialog, 900));
    if (ctx.ownTime) tmr.push(setTimeout(function () { if (alive) ctx.win(); }, ctx.ownTime * 1000));
    return function () { alive = false; tmr.forEach(function (t) { clearInterval(t); clearTimeout(t); }); };
  } });

// 2. Riddle / trivia with gliding answers
G.CH.push({ id: 'riddle', weight: 4, minLevel: 1, time: function (c) { return G.timerSec(15, c); },
  mount: function (ctx) { var r = G.qForCtx(ctx); ctx.prompt(r.q); ctx.react('think'); return G.answerButtons(ctx, r.a, { glide: true }); } });

// 3. Shell game (Mheibes)
G.CH.push({ id: 'shell', weight: 2, minLevel: 3, time: function (c) { return G.timerSec(20, c); },
  mount: function (ctx) {
    var box = G.el('div', 'shell'), cups = [], pos = [0, 1, 2], ring = ctx.rng.int(3), busy = true, dead = false;
    for (var i = 0; i < 3; i++) { var c = G.el('button', 'cup', '<b>🥤</b>' + (i === ring ? '<em>💍</em>' : '')); c.dataset.i = i; c.style.left = i * 33 + '%'; box.appendChild(c); cups.push(c); }
    ctx.root.appendChild(box); ctx.prompt(G.t('shell'));
    cups.forEach(function (c, i) { c.onclick = function () { if (busy || dead) return; G.sfx('tap'); c.classList.add('lift'); i === ring ? (c.querySelector('em').style.opacity = 1, ctx.win()) : (cups[ring].classList.add('lift'), cups[ring].querySelector('em').style.opacity = 1, ctx.fail()); }; });
    (async function () {
      cups[ring].classList.add('lift'); cups[ring].querySelector('em').style.opacity = 1; await G.sleep(900); cups[ring].classList.remove('lift');
      var n = 4 + ctx.d * 2, speed = 520 - ctx.d * 70;
      for (var s = 0; s < n && !dead; s++) {
        var a = ctx.rng.int(3), b = (a + 1 + ctx.rng.int(2)) % 3, t = pos[a]; pos[a] = pos[b]; pos[b] = t;
        cups.forEach(function (c, i) { c.style.transition = 'left ' + speed + 'ms cubic-bezier(.5,-.4,.5,1.4)'; c.style.left = pos[i] * 33 + '%'; });
        G.sfx('tick'); await G.sleep(speed + 60);
      }
      busy = false; ctx.prompt(G.t('shell'));
    })();
    return function () { dead = true; };
  } });

// 4. Nerve gauge
G.CH.push({ id: 'gauge', weight: 3, minLevel: 4, time: function (c) { return G.timerSec(18, c); },
  mount: function (ctx) {
    var box = G.el('div', 'gauge'); box.innerHTML = '<div class="track"><div class="zone"></div><div class="needle"></div></div><div class="dots"><i></i><i></i><i></i></div><div class="row"><button class="gbtn green stopb"><span>' + G.t('stop') + '</span></button></div>';
    ctx.root.appendChild(box); ctx.prompt(G.t('gauge'));
    var zone = G.$('.zone', box), needle = G.$('.needle', box), dots = box.querySelectorAll('.dots i'), hits = 0, w = 30 - ctx.d * 3, c = 50, p = 0, dir = 1, alive = true, raf, last = performance.now();
    var setZone = function () { c = 15 + ctx.rng() * 70; zone.style.left = (c - w / 2) + '%'; zone.style.width = w + '%'; }; setZone();
    var spd = 60 + ctx.d * 18 + hits * 10;
    (function loop(t) { if (!alive) return; var dt = (t - last) / 1000; last = t; p += dir * (spd + hits * 14) * dt; if (p > 100) { p = 100; dir = -1; } if (p < 0) { p = 0; dir = 1; } needle.style.left = p + '%'; raf = requestAnimationFrame(loop); })(last);
    G.$('.stopb', box).onclick = function () {
      if (!alive) return; G.sfx('tap');
      if (Math.abs(p - c) <= w / 2) { dots[hits].classList.add('on'); hits++; G.sfx('correct'); if (hits >= 3) { alive = false; ctx.win(); } else { w = Math.max(8, w - 6); setZone(); } }
      else { alive = false; ctx.fail(); }
    };
    // red decoy that tries to trick you
    var decoy = G.el('button', 'gbtn red decoy', '<span>' + G.t('safeBtn') + '</span>'); decoy.style.left = (ctx.rng() < .5 ? 5 : 55) + '%'; box.appendChild(decoy);
    decoy.onclick = function () { if (alive) { alive = false; G.sfx('wrong'); ctx.fail(); } };
    return function () { alive = false; cancelAnimationFrame(raf); };
  } });

// 5. Memory sequence
G.ICONS = ['⚽', '🚗', '⭐', '🎁', '👑', '🍕', '🐱', '🌙', '🔥', '💎', '🎈', '🍉'];
G.CH.push({ id: 'memory', weight: 3, minLevel: 3, time: function (c) { return G.timerSec(18, c); },
  mount: function (ctx) {
    var n = 3 + Math.min(2, ctx.d), seq = ctx.rng.shuffle(G.ICONS).slice(0, n + 1), nth = 1 + ctx.rng.int(n), box = G.el('div', 'memory'), dead = false;
    ctx.root.appendChild(box); ctx.prompt(G.t('memorize'));
    var grid = G.el('div', 'mgrid'); box.appendChild(grid);
    seq.slice(0, n).forEach(function (ic) { grid.appendChild(G.el('div', 'mcell', ic)); });
    var show = 2600 - ctx.d * 350; var left = show / 1000;
    var tick = setInterval(function () { G.floatEmoji(ctx.root, ['😎', '😍', '🤪', '😜'][ctx.rng.int(4)]); }, 700);
    setTimeout(function () {
      if (dead) return; grid.innerHTML = ''; ctx.prompt(G.t('whichWasNth', { n: nth }));
      var opts = seq.slice(0, n).slice(); // the Nth shown icon is correct; wrong = others (+distractor)
      var correct = seq[nth - 1], wrong = ctx.rng.shuffle(opts.filter(function (x) { return x !== correct; }).concat([seq[n]])).slice(0, 3);
      var labels = [correct].concat(wrong), order = ctx.rng.shuffle(labels.map(function (_, i) { return i; }));
      var done = false; order.forEach(function (i) {
        var b = G.el('button', 'mcell pick', labels[i]); if (i) ctx.wrongBtns.push(b);
        b.onclick = function () { if (done) return; done = true; G.sfx('tap'); i === 0 ? ctx.win() : ctx.fail(); }; grid.appendChild(b);
      });
    }, show);
    return function () { dead = true; clearInterval(tick); };
  } });

// 6. Quick math
G.CH.push({ id: 'math', weight: 3, minLevel: 2, time: function (c) { return G.timerSec(10, c); },
  mount: function (ctx) {
    var m = 10 + ctx.d * 10 + Math.floor(ctx.level / 5), a = 2 + ctx.rng.int(m), b = 2 + ctx.rng.int(m), op = ctx.rng.pick(ctx.d > 1 ? ['+', '-', '×'] : ['+', '-']), r;
    if (op === '-' && b > a) { var t = a; a = b; b = t; } if (op === '×') { a = 2 + ctx.rng.int(9); b = 2 + ctx.rng.int(9); }
    r = op === '+' ? a + b : op === '-' ? a - b : a * b;
    var labels = [r], k = 0; while (labels.length < 4 && k++ < 50) { var w = r + ctx.rng.pick([-3, -2, -1, 1, 2, 3, 10, -10]); if (w >= 0 && labels.indexOf(w) < 0) labels.push(w); }
    ctx.prompt('<span class="big">' + a + ' ' + op + ' ' + b + ' = ?</span>'); return G.answerButtons(ctx, labels, { glide: ctx.d > 1 });
  } });

// 7. Odd one out
G.CH.push({ id: 'odd', weight: 2, minLevel: 2, time: function (c) { return G.timerSec(12, c); },
  mount: function (ctx) {
    var sets = [['🍎', '🍅'], ['😀', '😃'], ['🐶', '🐕'], ['🌕', '🌝'], ['🔵', '🟦'], ['⭐', '🌟'], ['🍊', '🟠']], pair = ctx.rng.pick(sets), n = 3 + Math.min(2, ctx.d + (ctx.level > 20 ? 1 : 0)), odd = ctx.rng.int(n * n), g = G.el('div', 'ogrid'); g.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    for (var i = 0; i < n * n; i++) { var b = G.el('button', 'mcell pick', i === odd ? pair[1] : pair[0]); b.onclick = function (ii) { return function () { G.sfx('tap'); ii === odd ? ctx.win() : ctx.fail(); }; }(i); g.appendChild(b); }
    ctx.prompt(G.t('odd')); ctx.root.appendChild(g);
  } });

// 8. Color trap
G.CH.push({ id: 'colortrap', weight: 2, minLevel: 3, time: function (c) { return G.timerSec(10, c); },
  mount: function (ctx) {
    var wi = ctx.rng.int(6), ci = (wi + 1 + ctx.rng.int(5)) % 6, names = G.COLORS[G.lang];
    ctx.prompt('<span class="big" style="color:' + G.COLOR_HEX[ci] + '">' + names[wi] + '</span>'); var hint = G.el('p', 'hint', G.t('colortrap')); ctx.root.appendChild(hint);
    var box = G.el('div', 'cgrid'), idx = ctx.rng.shuffle([0, 1, 2, 3, 4, 5]).filter(function (x) { return x !== ci && x !== wi; }).slice(0, 3).concat([ci]); idx = ctx.rng.shuffle(idx);
    idx.forEach(function (i) { var b = G.el('button', 'swatch'); b.style.background = G.COLOR_HEX[i]; b.onclick = function () { G.sfx('tap'); i === ci ? ctx.win() : ctx.fail(); }; if (i !== ci) ctx.wrongBtns.push(b); box.appendChild(b); });
    ctx.root.appendChild(box);
  } });

// 9. Tap rhythm
G.CH.push({ id: 'rhythm', weight: 2, minLevel: 5, time: function (c) { return G.timerSec(14, c); },
  mount: function (ctx) {
    var box = G.el('div', 'rhythm'); box.innerHTML = '<div class="ring"></div><button class="gbtn orange"><span>' + G.t('tap') + '</span></button><div class="dots"><i></i><i></i><i></i><i></i></div>'; ctx.root.appendChild(box); ctx.prompt(G.t('rhythm'));
    var per = 800 - ctx.d * 80, start = performance.now() + 1200, hits = 0, taps = 0, alive = true, ring = G.$('.ring', box), dots = box.querySelectorAll('.dots i'), beatT;
    var beat = function () { if (!alive) return; ring.classList.remove('pulse'); void ring.offsetWidth; ring.classList.add('pulse'); G.sfx('tick'); beatT = setTimeout(beat, per); }; setTimeout(beat, 1200);
    G.$('button', box).onclick = function () {
      if (!alive) return; G.sfx('tap'); var el = (performance.now() - start) % per, off = Math.min(el, per - el);
      taps++; if (off < 170 - ctx.d * 15) { dots[hits].classList.add('on'); hits++; G.sfx('correct'); if (hits >= 4) { alive = false; ctx.win(); } } else { alive = false; ctx.fail(); }
    };
    return function () { alive = false; clearTimeout(beatT); };
  } });

// 10. Reverse mode: mirrored text + inverted order
G.CH.push({ id: 'reverse', weight: 2, minLevel: 6, time: function (c) { return G.timerSec(16, c); },
  mount: function (ctx) { var r = G.qForCtx(ctx); ctx.root.classList.add('mirror'); ctx.prompt(G.t('reverse') + '<br>' + r.q); var c = G.answerButtons(ctx, r.a, { glide: true }); return function () { c(); ctx.root.classList.remove('mirror'); }; } });

// 11. Spot the difference
G.CH.push({ id: 'spot', weight: 2, minLevel: 7, time: function (c) { return G.timerSec(16, c); },
  mount: function (ctx) {
    var n = 9, base = ctx.rng.shuffle(G.ICONS).slice(0, n), diff = ctx.rng.int(n), repl = ctx.rng.pick(G.ICONS.filter(function (x) { return base.indexOf(x) < 0; }));
    var w = G.el('div', 'spot'); [0, 1].forEach(function (side) {
      var g = G.el('div', 'sgrid'); base.forEach(function (ic, i) { var b = G.el('button', 'mcell pick', side && i === diff ? repl : ic);
        if (side) b.onclick = function () { G.sfx('tap'); i === diff ? ctx.win() : ctx.fail(); }; else b.disabled = true; g.appendChild(b); }); w.appendChild(g);
    }); ctx.prompt(G.t('spot')); ctx.root.appendChild(w);
  } });

// BOSS: Nerve Explosion — three mechanics chained, extreme VFX
G.BOSS = { id: 'boss', time: function (c) { return 28 - c.d * 2; },
  mount: function (ctx) {
    var stop = null, step = 0, root = ctx.root, dead = false;
    var run = function () {
      if (dead) return; if (stop) stop(); root.innerHTML = '';
      if (step === 0) { // rapid math, three taunting buttons
        var a = 3 + ctx.rng.int(12), b = 3 + ctx.rng.int(12), r = a + b, labels = [r, r + 1, r - 2], order = ctx.rng.shuffle([0, 1, 2]), taunts = [G.t('hurry'), G.t('chooseNow'), G.t('dontThink')];
        ctx.prompt('<span class="big">' + a + ' + ' + b + ' = ?</span>'); var bx = G.el('div', 'bossbtns'); var cols = ['purple', 'green', 'orange'];
        order.forEach(function (i, k) { var bt = G.el('button', 'gbtn ' + cols[k] + ' bb' + k, '<small>' + taunts[k] + '</small><span>' + labels[i] + '</span>');
          bt.onclick = function () { G.sfx('tap'); if (i === 0) { step++; ctx.sub(); run(); } else ctx.fail(); }; if (i) ctx.wrongBtns.push(bt); bx.appendChild(bt); }); root.appendChild(bx);
      } else if (step === 1) {
        var sub = Object.assign({}, ctx, { win: function () { step++; ctx.sub(); run(); } }); stop = G.CH.filter(function (c) { return c.id === 'gauge'; })[0].mount(sub);
      } else {
        ctx.react('furious'); var sub2 = Object.assign({}, ctx, { ownTime: 3, win: function () { ctx.win(); } }); stop = G.CH.filter(function (c) { return c.id === 'dontpress'; })[0].mount(sub2);
      }
    };
    G.sfx('boss'); run(); return function () { dead = true; if (stop) stop(); };
  } };
