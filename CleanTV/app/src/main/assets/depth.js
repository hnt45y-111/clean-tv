/* «واجهة العمق»: the clock sits between the picture and its standout subject (the iPhone lock-screen look).
   A self-contained skin: it draws its own screen when settings.skin === 'depth' and takes the remote keys while the launcher is on the main layer.
   Every part (clock, date, prayer, top buttons, dock, matches strip, news strip) is a widget the user can move, resize and hide in edit mode.
   ES5 on purpose (old TV WebViews). What it needs from the launcher comes through window.__depthApi (see app.js). */
(function () {
  'use strict';
  /* ---------------------------------------------------------------- data */
  var PLACES = [
    { id: 'snow', n: 'قمة ثلجية', c: 'صورة حقيقية', dy: 0, user: { src: 'depth/snow.jpg', blur: 'depth/snow_b.jpg', ok: true, sky: [0.786, 0.802, 0.801, 0.792, 0.781, 0.778, 0.77, 0.764, 0.749, 0.739, 0.729, 0.718, 0.707, 0.7, 0.694, 0.688, 0.685, 0.68, 0.679, 0.676, 0.674, 0.672, 0.669, 0.663, 0.657, 0.647, 0.632, 0.625, 0.618, 0.611, 0.607, 0.601, 0.599, 0.599, 0.597, 0.594, 0.583, 0.573, 0.571, 0.569, 0.562, 0.558, 0.551, 0.542, 0.531, 0.519, 0.507, 0.499, 0.491, 0.484, 0.476, 0.468, 0.457, 0.45, 0.443, 0.435, 0.42, 0.41, 0.406, 0.401, 0.397, 0.393, 0.388, 0.383, 0.379, 0.374, 0.369, 0.365, 0.36, 0.355, 0.35, 0.344, 0.34, 0.334, 0.33, 0.324, 0.319, 0.314, 0.308, 0.302, 0.295, 0.289, 0.281, 0.275, 0.269, 0.261, 0.255, 0.25, 0.245, 0.241, 0.236, 0.233, 0.234, 0.236, 0.238, 0.241, 0.246, 0.256, 0.268, 0.279, 0.289, 0.3, 0.311, 0.322, 0.333, 0.344, 0.356, 0.368, 0.377, 0.386, 0.395, 0.405, 0.422, 0.456, 0.468, 0.486, 0.494, 0.497, 0.497, 0.497, 0.498, 0.506, 0.515, 0.525, 0.531, 0.531, 0.529, 0.52, 0.517, 0.516, 0.509, 0.496, 0.49, 0.485, 0.48, 0.479, 0.476, 0.47, 0.465, 0.464, 0.466, 0.47, 0.475, 0.481, 0.485, 0.49, 0.492, 0.493, 0.493, 0.491, 0.486, 0.484, 0.485, 0.49, 0.497, 0.506, 0.516, 0.529, 0.543, 0.552, 0.566, 0.579, 0.591, 0.606, 0.623, 0.632, 0.632, 0.632, 0.64, 0.65, 0.668, 0.681, 0.699, 0.717, 0.727, 0.737, 0.747, 0.76, 0.769, 0.779, 0.785, 0.792, 0.795, 0.8, 0.806, 0.811, 0.818, 0.834, 0.856, 0.866, 0.881, 0.886] } },
    { id: 'haibat', n: 'هيبت سلطان', c: 'العراق · كويسنجق', dy: 40 },
    { id: 'rawanduz', n: 'رواندوز', c: 'العراق · أربيل', dy: 20 },
    { id: 'halgurd', n: 'جبل حلگورد', c: 'العراق · أربيل', dy: 40 },
    { id: 'dukan', n: 'سد دوكان', c: 'العراق · السليمانية', dy: 40 },
    { id: 'amadiya', n: 'دهوك وعمادية', c: 'العراق · دهوك', dy: 40 },
    { id: 'shatt', n: 'شط العرب', c: 'العراق · البصرة', dy: 40 },
    { id: 'ahwar', n: 'أهوار ذي قار', c: 'العراق · ذي قار', dy: 10 },
    { id: 'tassili', n: 'طاسيلي', c: 'الجزائر · الأهقار', dy: 0 },
    { id: 'taghit', n: 'تاغيت', c: 'الجزائر · بشار', dy: 40 },
    { id: 'djurdjura', n: 'جرجرة', c: 'الجزائر · القبائل', dy: 40 },
    { id: 'timimoun', n: 'تيميمون', c: 'الجزائر · أدرار', dy: 30 },
    { id: 'ghardaia', n: 'غرداية', c: 'الجزائر · وادي ميزاب', dy: 50 },
    { id: 'constantine', n: 'قسنطينة', c: 'الجزائر · مدينة الجسور', dy: 40 }
  ];
  var OLD_ORDER = ['tassili', 'taghit', 'djurdjura', 'timimoun', 'ghardaia', 'constantine'];   /* the first release saved a number */
  /* the governors' seats (prayer times and the day of the Hijri date follow them); time zone is always Asia/Baghdad */
  var PROVS = [['بغداد', 33.3152, 44.3661], ['البصرة', 30.5085, 47.7804], ['نينوى', 36.3350, 43.1189], ['الأنبار', 33.4206, 43.3078], ['ديالى', 33.7466, 44.6437],
    ['صلاح الدين', 34.6071, 43.6782], ['كركوك', 35.4681, 44.3922], ['أربيل', 36.1911, 44.0092], ['السليمانية', 35.5613, 45.4374], ['دهوك', 36.8669, 42.9503],
    ['واسط', 32.5128, 45.8182], ['ميسان', 31.8356, 47.1440], ['ذي قار', 31.0439, 46.2573], ['المثنى', 31.3099, 45.2803], ['القادسية', 31.9929, 44.9255],
    ['بابل', 32.4637, 44.4196], ['كربلاء', 32.6160, 44.0249], ['النجف', 32.0259, 44.3462]];
  var CSTY = [['glass', 'زجاجية'], ['normal', 'عادية'], ['bold', 'عريض'], ['thin', 'رفيع'], ['round', 'مدوّر'], ['ital', 'مائل']];
  var RSS = [['https://feeds.bbci.co.uk/arabic/rss.xml', 'بي بي سي عربي'], ['https://news.google.com/rss?hl=ar&gl=IQ&ceid=IQ:ar', 'أخبار العراق (Google News)'],
    ['https://www.skynewsarabia.com/web/rss', 'سكاي نيوز عربية'], ['https://www.alarabiya.net/feed/rss2/ar.xml', 'العربية']];
  var WIDGETS = [['clock', 'الساعة'], ['date', 'التاريخ والمكان'], ['pray', 'الصلاة القادمة'], ['top', 'أزرار الأعلى'], ['dock', 'شريط التطبيقات'], ['matches', 'شريط المباريات'], ['news', 'شريط الأخبار']];
  var DEF = { clock: { x: 480, y: 120, w: 960, h: 310 }, date: { x: 410, y: 40, w: 1100, h: 150 }, pray: { x: 70, y: 54, w: 330, h: 130 }, top: { x: 1498, y: 54, w: 352, h: 126 },
    dock: { x: 354, y: 880, w: 1212, h: 150 }, matches: { x: 360, y: 770, w: 1200, h: 60 }, news: { x: 210, y: 836, w: 1500, h: 60 } };
  var DOCK_MAX = 10, COLS = 10, AMP_BG = 25, AMP_FG = 33, KEY = 'depthCfg', TZ = 'Asia/Baghdad';

  var root = null, mounted = false, built = false;
  var D = {
    bg: 'haibat', effect: true, reduce: false, dock: null, hidden: [], prov: 0, cs: 'glass', w: {}, bgo: {}, users: [], dbgs: [], order: null, off: [], nsp: 3, pspd: 450, pamt: 1, mist: 1, sig: '', pvSel: null, rss: [RSS[0][0]], f: 'dock', di: 0, ti: 0, gi: 0, drawer: false,
    menu: null, pick: null, mv: false, ask: null, edit: null, waitPick: false
  };
  var timers = {}, scenes = {}, lpT = null, lpFired = false, news = [], games = [], gameI = 0, lastKeyAt = 0, heldN = 0;
  function api() { return window.__depthApi || null; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function weak() { try { return (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 1); } catch (e) { return false; } }
  function toast(m) { var A = api(); if (A) A.toast(m); }
  /* every picture, in the user's order, without the ones switched off: the built-in ones, the ones sent from the phone with the design, and the ones picked on the TV */
  function allPlaces() {
    var l = PLACES.map(function (p) { return p; });
    (D.dbgs || []).forEach(function (u, i) { l.push({ id: u.id, n: u.n || 'صورة ' + (i + 1), c: 'من التلفون', dy: u.dy || 0, user: u }); });
    D.users.forEach(function (u, i) { l.push({ id: u.id, n: u.n || 'صورتي ' + (i + 1), c: 'من جهازي', dy: u.dy || 0, user: u }); });
    if (D.order && D.order.length) {
      var pos = {}; D.order.forEach(function (id, i) { pos[id] = i; });
      l = l.map(function (p, i) { return [p, i]; }).sort(function (a, b) { var x = pos[a[0].id], y = pos[b[0].id]; x = x == null ? 1e4 + a[1] : x; y = y == null ? 1e4 + b[1] : y; return x - y; }).map(function (z) { return z[0]; });
    }
    return l;
  }
  function placeList() { var l = allPlaces().filter(function (p) { return D.off.indexOf(p.id) < 0 || p.id === D.bg; }); return l.length ? l : [PLACES[0]]; }
  function placeBy(id) { var l = allPlaces(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return l[0]; }
  function placeIdx(id) { var l = placeList(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return i; return 0; }
  function bgo(id) { return D.bgo[id] || (D.bgo[id] = {}); }
  function motionOn(id) { return !D.reduce && bgo(id).motion !== false; }
  function depthOn(p) { return D.effect && bgo(p.id).depth !== false && (!p.user || !!(p.user.sky && p.user.ok !== false)); }
  function wState(id) { return D.w[id] || (D.w[id] = { x: 0, y: 0, sx: 1, sy: 1, h: false }); }

  /* ---------------------------------------------------------------- saved choices (kept on the TV; a design can carry defaults in settings.depth) */
  function loadCfg() {
    var A = api(), def = (A && A.settings().depth) || {}, st = {}, sig = JSON.stringify(def).length + ':' + hashStr(JSON.stringify(def));
    if (!(A && A.preview)) { try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { st = {}; } }
    /* a design sent from the phone replaces what was chosen on the TV before it (otherwise the phone's choices would never show) */
    if (st.sig !== sig) { st = { users: st.users }; }
    function pick(k, d) { return st[k] != null ? st[k] : def[k] != null ? def[k] : d; }
    D.sig = sig;
    D.dbgs = (def.bgs || []).slice(0, 15);
    D.users = (st.users || []).slice(0, 6);
    D.order = pick('order', null); D.off = pick('off', []);
    var bg = pick('bg', PLACES[0].id);
    if (typeof bg === 'number') bg = OLD_ORDER[bg] || PLACES[0].id;
    D.bg = allPlaces().some(function (p) { return p.id === bg; }) ? bg : PLACES[0].id;
    D.effect = pick('effect', true) !== false;
    D.reduce = st.reduce != null ? !!st.reduce : def.reduce != null ? !!def.reduce : weak();
    D.dock = st.dock || def.dock || null; D.hidden = pick('hidden', []);
    D.prov = clamp(+pick('prov', 0) || 0, 0, PROVS.length - 1);
    var cs = pick('cs', 'glass'); D.cs = CSTY.some(function (c) { return c[0] === cs; }) ? cs : 'glass';
    D.w = pick('w', {}); D.bgo = pick('bgo', {});
    D.rss = pick('rss', [RSS[0][0]]);
    D.nsp = clamp(+pick('nsp', 3) || 3, 1, 10); D.pspd = clamp(+pick('pspd', 450) || 450, 120, 1400); D.pamt = clamp(+pick('pamt', 1), 0, 2.5); D.mist = clamp(+pick('mist', 1), 0, 3);
    if (isNaN(D.pamt)) D.pamt = 1; if (isNaN(D.mist)) D.mist = 1;
  }
  function hashStr(t) { var h = 5381, i; for (i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return String(h >>> 0); }
  function saveCfg() {
    var A = api(); if (A && A.preview) return;
    try { localStorage.setItem(KEY, JSON.stringify({ sig: D.sig, bg: D.bg, effect: D.effect, reduce: D.reduce, dock: D.dock, hidden: D.hidden, prov: D.prov, cs: D.cs, w: D.w, bgo: D.bgo, users: D.users, rss: D.rss, order: D.order, off: D.off, nsp: D.nsp, pspd: D.pspd, pamt: D.pamt, mist: D.mist })); } catch (e) {}
  }

  /* ---------------------------------------------------------------- apps and the dock */
  function allApps() { var A = api(); if (!A) return []; return A.apps().filter(function (a) { return a && a.pkg && D.hidden.indexOf(a.pkg) < 0; }); }
  function byPkg(p) { var l = allApps(); for (var i = 0; i < l.length; i++) if (l[i].pkg === p) return l[i]; return null; }
  function dockApps() {
    var l = allApps(), out = [];
    if (!D.dock && l.length) { D.dock = l.slice(0, 9).map(function (a) { return a.pkg; }); }
    if (!D.dock) return out;
    D.dock.forEach(function (p) { var a = byPkg(p); if (a && out.indexOf(a) < 0) out.push(a); });
    return out.slice(0, DOCK_MAX);
  }
  function inDock(pkg) { return dockApps().some(function (a) { return a.pkg === pkg; }); }
  function addDock(pkg) {
    var cur = dockApps().map(function (a) { return a.pkg; });
    if (cur.indexOf(pkg) >= 0) return true;
    if (cur.length >= DOCK_MAX) { toast('الشريط ممتلئ (' + DOCK_MAX + ' تطبيقات). شيل واحد أول'); return false; }
    cur.push(pkg); D.dock = cur; saveCfg(); return true;
  }
  function removeDock(pkg) { D.dock = dockApps().map(function (a) { return a.pkg; }).filter(function (p) { return p !== pkg; }); saveCfg(); }
  function hideApp(pkg) { if (D.hidden.indexOf(pkg) < 0) D.hidden.push(pkg); D.dock = dockApps().map(function (a) { return a.pkg; }).filter(function (p) { return p !== pkg; }); saveCfg(); }
  function iconHtml(a, size) {
    var A = api(), src = A.icon(a), col = a.color || '#5b6b8c';
    var inner = src ? '<img src="' + esc(src) + '" alt="" onerror="this.style.display=\'none\'">' : '';
    return '<div class="dp-ic" style="width:' + size + 'px;height:' + size + 'px;border-radius:' + Math.round(size * .26) + 'px;background:' + (src ? 'rgba(255,255,255,.12)' : col) + '">' + inner + (src ? '' : '<b>' + esc(String(A.label(a)).replace(/^ال/, '').slice(0, 1)) + '</b>') + '</div>';
  }
  var domCache = {};
  function dominant(a, cb) {
    if (domCache[a.pkg]) return cb(domCache[a.pkg]);
    var A = api(), src = A.icon(a), fb = a.color || '#7a6cff';
    if (!src || !document.createElement('canvas').getContext) { domCache[a.pkg] = fb; return cb(fb); }
    var im = new Image();
    im.onload = function () {
      var c = '';
      try {
        var cv = document.createElement('canvas'); cv.width = cv.height = 12; var x = cv.getContext('2d'); x.drawImage(im, 0, 0, 12, 12);
        var d = x.getImageData(0, 0, 12, 12).data, r = 0, g = 0, b = 0, w = 0;
        for (var i = 0; i < d.length; i += 4) { var al = d[i + 3] / 255, mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), sat = mx ? (mx - mn) / mx : 0, wt = al * (.15 + sat); r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt; }
        if (w > 0) c = 'rgb(' + Math.round(r / w) + ',' + Math.round(g / w) + ',' + Math.round(b / w) + ')';
      } catch (e) {}
      domCache[a.pkg] = c || fb; cb(domCache[a.pkg]);
    };
    im.onerror = function () { domCache[a.pkg] = fb; cb(fb); };
    im.src = src;
  }

  /* ---------------------------------------------------------------- picking the front layer of a picture from the device:
     the sky is found from the top of every column, and what lies below the skyline is the standout subject (mountains, buildings, palms) */
  function skylineFrom(d, w, h, sens) {
    var sky = [], x, y, T1 = 70 / (sens || 1), T2 = 40 / (sens || 1);
    function px(xx, yy) { var i = (yy * w + xx) * 4; return [d[i], d[i + 1], d[i + 2]]; }
    for (x = 0; x < w; x++) {
      var ref = px(x, 0), prev = ref, run = 0, stop = Math.floor(h * .9);
      for (y = 1; y < stop; y++) {
        var p = px(x, y), dist = Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]), grad = Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1]) + Math.abs(p[2] - prev[2]);
        if (dist > T1 || grad > T2) { run++; if (run >= 3) break; } else { run = 0; ref = [ref[0] * .8 + p[0] * .2, ref[1] * .8 + p[1] * .2, ref[2] * .8 + p[2] * .2]; }
        prev = p;
      }
      sky.push(Math.max(0, y - run) / h);
    }
    /* median over 7 columns so a cloud or a bird does not cut the skyline */
    var out = [];
    for (x = 0; x < w; x++) { var win = []; for (var k = -3; k <= 3; k++) win.push(sky[clamp(x + k, 0, w - 1)]); win.sort(function (a, b) { return a - b; }); out.push(win[3]); }
    var mean = 0; out.forEach(function (v) { mean += v; }); mean /= w;
    if (mean < .08 || mean > .93) return null;      /* no sky at the top, or nothing but sky */
    return out;
  }
  /* how much of the digits the subject covers (0..1): both masks are the same size, 1 = covered / ink */
  function coverageOf(alpha, ink) { var tot = 0, cov = 0, i; for (i = 0; i < ink.length; i++) if (ink[i]) { tot++; if (alpha[i]) cov++; } return tot ? cov / tot : 0; }
  function alphaFromSky(sky, w, h) { var a = new Uint8Array(w * h), x, y; for (x = 0; x < w; x++) for (y = Math.floor(sky[Math.floor(x * sky.length / w)] * h); y < h; y++) a[y * w + x] = 1; return a; }
  /* picks the clock height that lets the subject cover about a seventh of the digits; null when it cannot stay under 30% */
  function bestDy(covAt) {
    var best = null, minC = 9, dy;
    for (dy = -40; dy <= 80; dy += 10) {
      var c = covAt(dy); minC = Math.min(minC, c);
      if (c >= .05 && c <= .28 && (!best || Math.abs(c - .14) < Math.abs(best.c - .14))) best = { dy: dy, c: c };
    }
    if (best) return { dy: best.dy, ok: true, cov: best.c };
    return { dy: 40, ok: minC <= .3, cov: minC };
  }
  /* works out the front layer of a picture (the sky is found from the top; the subject is what rises into it) and the best clock height.
     opts: sens (0.6 .. 1.6: higher finds more of the subject), off (-0.2 .. 0.2: moves the skyline up or down) */
  function analyzeImage(src, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; } opts = opts || {};
    var im = new Image();
    im.onload = function () {
      try {
        var W = 192, H = 108, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
        var ar = im.width / im.height, sw = ar > 16 / 9 ? im.height * 16 / 9 : im.width, sh = ar > 16 / 9 ? im.height : im.width * 9 / 16;
        x.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, W, H);
        var blur = ''; try { var bc = document.createElement('canvas'); bc.width = 96; bc.height = 54; bc.getContext('2d').drawImage(cv, 0, 0, 96, 54); blur = bc.toDataURL('image/jpeg', .75); } catch (e0) {}
        var sky = skylineFrom(x.getImageData(0, 0, W, H).data, W, H, opts.sens);
        if (!sky) return cb({ sky: null, dy: 0, ok: false, cov: 0, blur: blur });
        if (opts.off) sky = sky.map(function (v) { return clamp(v + opts.off, 0, .95); });
        var A = api(), alpha = alphaFromSky(sky, W, H), samples = [(A && A.clock()) || '٥:١٩', '١٠:٠٨', '١٢:٣٤'];
        var mc = document.createElement('canvas'); mc.width = 480; mc.height = 270; var mx = mc.getContext('2d');
        var res = bestDy(function (dy) {
          var worst = 0;
          samples.forEach(function (t) {
            mx.clearRect(0, 0, 480, 270); mx.font = '800 75px Tajawal, Plex, sans-serif'; mx.textAlign = 'center'; mx.fillStyle = '#fff'; mx.fillText(t, 240, (376 + dy) / 4);
            var d = mx.getImageData(0, 0, 480, 270).data, cnt = 0, cov = 0, j;
            for (j = 0; j < 480 * 270; j++) if (d[j * 4 + 3] > 128) { cnt++; var xx = Math.floor((j % 480) * W / 480), yy = Math.floor(Math.floor(j / 480) * H / 270); if (alpha[yy * W + xx]) cov++; }
            worst = Math.max(worst, cnt ? cov / cnt : 0);
          });
          return worst;
        });
        cb({ sky: sky.filter(function (v, i) { return i % 2 === 0; }).map(function (v) { return Math.round(v * 1000) / 1000; }), dy: res.dy, ok: res.ok, cov: res.cov, blur: blur });
      } catch (e) { cb(null); }
    };
    im.onerror = function () { cb(null); };
    im.src = src;
  }
  function clipPoly(sky) {
    var n = sky.length, pts = ['0% 100%'], i;
    for (i = 0; i < n; i++) pts.push((i * 100 / (n - 1)).toFixed(2) + '% ' + (sky[i] * 100).toFixed(2) + '%');
    pts.push('100% 100%'); return 'polygon(' + pts.join(',') + ')';
  }

  /* ---------------------------------------------------------------- the scene: picture, clock, subject */
  function clockText() { var A = api(); try { return A ? A.clock() : ''; } catch (e) { return ''; } }
  function clockXf(p, dy) {
    var w = wState('clock'), cy = 376 + dy - 100, t = 'translate(' + w.x + ',' + w.y + ') translate(960,' + cy + ') scale(' + w.sx + ',' + w.sy + ')';
    if (D.cs === 'ital') t += ' skewX(-10)';
    return t + ' translate(-960,' + (-cy) + ')';
  }
  /* the blurred copy of a picture that shows through the glass digits (a small file, so it costs nothing to draw) */
  var blurCache = {};
  function blurSrc(p, cb) {
    if (!p.user) return cb('depth/' + p.id + '_b.jpg');
    if (p.user.blur) return cb(p.user.blur);
    if (blurCache[p.id]) return cb(blurCache[p.id]);
    var im = new Image();
    im.onload = function () {
      try { var c = document.createElement('canvas'); c.width = 96; c.height = 54; c.getContext('2d').drawImage(im, 0, 0, 96, 54); blurCache[p.id] = c.toDataURL('image/jpeg', .8); } catch (e) { blurCache[p.id] = ''; }
      cb(blurCache[p.id]);
    };
    im.onerror = function () { cb(''); };
    im.src = p.user.src;
  }
  function sceneEl(p) {
    var el = document.createElement('div'), moving = motionOn(p.id), dy = p.dy, src = p.user ? p.user.src : 'depth/' + p.id + '.jpg', fgSrc = p.user ? p.user.src : 'depth/' + p.id + '_fg.png';
    el.className = 'dp-sc' + (moving ? ' mot' : '') + (depthOn(p) ? '' : ' nofx');
    var fg = p.user ? (p.user.sky ? '<div class="dp-lyr dp-fgw"><img class="dp-fg" src="' + esc(fgSrc) + '" alt="" style="clip-path:' + clipPoly(p.user.sky) + ';-webkit-clip-path:' + clipPoly(p.user.sky) + '"></div>' : '') : '<div class="dp-lyr dp-fgw"><img class="dp-fg" src="' + fgSrc + '" alt=""></div>';
    var i = 'k' + Math.floor(Math.random() * 1e6), tf = clockXf(p, dy), tx = esc(clockText());
    el.innerHTML = '<div class="dp-lyr dp-bgw"><img class="dp-bg" src="' + esc(src) + '" alt=""></div>' +
      '<div class="dp-mist"><i class="m1"></i><i class="m2"></i></div>' +
      '<svg class="dp-clk" data-cs="' + D.cs + '" viewBox="0 0 1920 1080" aria-hidden="true"><defs><filter id="sh' + i + '" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000" flood-opacity=".5"/></filter>' +
      '<clipPath id="cp' + i + '"><text class="dp-ckc" x="960" y="' + (376 + dy) + '" text-anchor="middle" transform="' + tf + '">' + tx + '</text></clipPath>' +
      '<linearGradient id="gl' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".55" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity=".22"/></linearGradient></defs>' +
      '<g class="dp-fog" clip-path="url(#cp' + i + ')"><image class="dp-fogimg" width="1920" height="1080" preserveAspectRatio="xMidYMid slice" opacity=".96"/><rect width="1920" height="1080" fill="url(#gl' + i + ')" opacity=".75"/></g>' +
      '<text class="dp-ck" x="960" y="' + (376 + dy) + '" text-anchor="middle" filter="url(#sh' + i + ')" style="--gl:url(#gl' + i + ')" transform="' + tf + '">' + tx + '</text></svg>' + fg +
      '';
    blurSrc(p, function (u) { var im = el.querySelector('.dp-fogimg'); if (im && u) im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', u); });
    el._p = p; return el;
  }
  function paintClocks() { var t = clockText(), l = document.querySelectorAll('#depth .dp-ck, #depth .dp-ckc'); for (var i = 0; i < l.length; i++) l[i].textContent = t; }
  function styleClocks() {
    var l = document.querySelectorAll('#depth .dp-sc'), i;
    for (i = 0; i < l.length; i++) {
      var sv = l[i].querySelector('.dp-clk'), tx = l[i].querySelector('.dp-ck'), tc = l[i].querySelector('.dp-ckc'), p = l[i]._p;
      if (sv && tx && p) { sv.setAttribute('data-cs', D.cs); tx.setAttribute('transform', clockXf(p, p.dy)); if (tc) tc.setAttribute('transform', clockXf(p, p.dy)); sv.style.opacity = wState('clock').h && !D.edit ? 0 : ''; }
    }
  }
  function classesOf(el) {
    var p = el._p; if (!p) return;
    el.classList.toggle('mot', motionOn(p.id)); el.classList.toggle('nofx', !depthOn(p));
  }
  function refreshScenes() { for (var k in scenes) if (scenes[k] && scenes[k].el) classesOf(scenes[k].el); }
  function showScene(id, host, key) {
    var old = scenes[key]; if (old && old.id === id) return;
    var el = sceneEl(placeBy(id));
    host.appendChild(el);
    void el.offsetWidth;
    el.classList.add('on');
    scenes[key] = { id: id, el: el };
    if (old) { old.el.classList.remove('on'); (function (o) { setTimeout(function () { if (o.el.parentNode) o.el.parentNode.removeChild(o.el); }, 450); })(old); }
    if (key === 'home') parallax();
  }
  function setPar(sc, pos) {
    if (!sc) return;
    var amp = D.reduce ? 0 : D.pamt, bg = sc.el.querySelector('.dp-bgw'), fg = sc.el.querySelector('.dp-fgw'), ms = D.reduce ? 120 : D.pspd, ml = sc.el.querySelector('.dp-mist');
    if (bg) { bg.style.transitionDuration = ms + 'ms'; bg.style.transform = 'translate3d(' + (pos * AMP_BG * amp).toFixed(1) + 'px,0,0)'; }
    if (fg) { fg.style.transitionDuration = ms + 'ms'; fg.style.transform = 'translate3d(' + (pos * AMP_FG * amp).toFixed(1) + 'px,0,0)'; }
    if (ml) { ml.style.transitionDuration = (ms * 1.3) + 'ms'; ml.style.transform = 'translate3d(' + (pos * AMP_FG * 1.6 * amp).toFixed(1) + 'px,0,0)'; ml.style.opacity = D.reduce ? 0 : String(Math.min(1, D.mist / 2)); }
  }
  function selPos() {
    var n, i;
    if (D.drawer) { n = COLS; i = D.gi % COLS; } else { n = Math.max(1, dockApps().length); i = D.di; }
    if (n < 2) return 0;
    return ((n - 1) / 2 - i) / ((n - 1) / 2);
  }
  function parallax() { setPar(scenes.home, selPos()); }

  /* ---------------------------------------------------------------- widgets: a box per part, placed from DEF + what the user changed */
  function ticker() { var t = $('liveTicker'); return t && t.offsetHeight > 0 ? t.offsetHeight + 22 : 22; }
  function rectOf(id) {
    var r = {}, d = DEF[id]; for (var k in d) r[k] = d[k];
    var dockY = 1080 - (ticker() + 34) - DEF.dock.h;
    if (id === 'dock') r.y = dockY; else if (id === 'matches') r.y = dockY - 136; else if (id === 'news') r.y = dockY - 70;
    return r;
  }
  function visible(id) { return !wState(id).h || !!D.edit; }
  function applyWidgets() {
    WIDGETS.forEach(function (w) {
      var id = w[0]; if (id === 'clock') return;
      var el = $('dpw-' + id); if (!el) return;
      var r = rectOf(id), s = wState(id), extra = id === 'dock' && D.drawer ? -(r.y - 56) : 0;
      el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px';
      el.style.transform = 'translate3d(' + s.x + 'px,' + (s.y + extra) + 'px,0) scale(' + s.sx + ',' + s.sy + ')';
      el.className = 'dpw' + (s.h ? (D.edit || D.pvSel ? ' ghost' : ' dp-gone') : '') + (D.edit || D.pvSel ? ' ed' : '') + ((D.edit || D.pvSel) && curW() === id ? ' sel' : '');
    });
    styleClocks();
    var fr = $('dpClockFrame');
    if (fr) {
      var cs = wState('clock'), r2 = DEF.clock, cy = r2.y + r2.h / 2;
      fr.style.left = (960 - r2.w / 2 * cs.sx + cs.x) + 'px'; fr.style.top = (cy - r2.h / 2 * cs.sy + cs.y) + 'px'; fr.style.width = (r2.w * cs.sx) + 'px'; fr.style.height = (r2.h * cs.sy) + 'px';
      fr.className = D.edit || D.pvSel ? 'ed' + (curW() === 'clock' ? ' sel' : '') + (cs.h ? ' ghost' : '') : '';
    }
  }
  function curW() { return D.edit ? WIDGETS[D.edit.i][0] : D.pvSel; }

  /* ---------------------------------------------------------------- building the screen */
  function build() {
    if (built) return;
    built = true;
    root = document.createElement('div'); root.id = 'depth';
    root.innerHTML =
      '<div id="dpScenes"></div><div id="dpGlowA" class="dp-glow"></div><div id="dpGlowB" class="dp-glow"></div><div id="dpClockFrame"></div>' +
      '<div class="dpw" id="dpw-date"><div id="dpDate"></div><div id="dpPlace" class="dp-chip"></div></div>' +
      '<div class="dpw" id="dpw-pray"><div id="dpPray" class="dp-glass"></div></div>' +
      '<div class="dpw" id="dpw-top"><div id="dpTop"></div></div>' +
      '<div id="dpDrawer"><div id="dpDrawerGrid"></div><div id="dpDrawerName"></div></div>' +
      '<div class="dpw" id="dpw-dock"><div id="dpDock" class="dp-glass"></div><div id="dpName"></div></div>' +
      '<div class="dpw" id="dpw-matches"><div id="dpMatches" class="dp-strip dp-glass"></div></div>' +
      '<div class="dpw" id="dpw-news"><div id="dpNews" class="dp-strip dp-glass"></div></div>' +
      '<div id="dpMenu" class="dp-glass"></div><div id="dpAsk" class="dp-glass"></div><div id="dpEditBar"></div>' +
      '<div id="dpPick"><div id="dpPickBox"></div><div id="dpPickWrap"><div id="dpPickBtns"></div></div><div id="dpPickOpts"></div><div id="dpPickHint">يمين ويسار للتنقل · OK لتطبيق الخلفية · تحت: ثابتة/متحركة والعمق · رجوع للإلغاء</div></div>';
    var st = $('stage') || document.body; st.appendChild(root);
  }
  function mount() {
    build(); loadCfg();
    root.style.display = 'block'; mounted = true;
    root.className = D.reduce ? 'dp-reduce' : '';
    D.f = 'dock'; D.di = clamp(D.di, 0, Math.max(0, dockApps().length - 1));
    scenes = {}; $('dpScenes').innerHTML = '';
    showScene(D.bg, $('dpScenes'), 'home');
    renderAll();
    if (!timers.t) timers.t = setInterval(function () { if (mounted) { paintClocks(); renderMeta(); renderMatches(); } }, 10000);
    if (!timers.n) timers.n = setInterval(function () { if (mounted) { loadMatches(); loadNews(); } }, 20 * 60000);
    timers.tsig = JSON.stringify((api().settings().tickerTeams) || []) + '|' + JSON.stringify((api().settings().tickerLeagues) || []); timers.nsig = JSON.stringify(D.rss);
    loadMatches(); loadNews();
    var A0 = api(); if (A0 && A0.preview && !timers.pv) { timers.pv = 1; root.addEventListener('click', previewTap); }
    document.body.classList.add('dp-on');
  }
  function unmount() {
    if (!mounted) return;
    mounted = false; if (root) root.style.display = 'none';
    document.body.classList.remove('dp-on');
    clearInterval(timers.t); timers.t = null; clearInterval(timers.n); timers.n = null;
    scenes = {}; if ($('dpScenes')) $('dpScenes').innerHTML = '';
  }

  /* ---------------------------------------------------------------- date, place, prayer, top buttons */
  function prov() { return PROVS[D.prov] || PROVS[0]; }
  function prayerNow() { var A = api(), p = prov(); try { return A && A.prayerAt ? A.prayerAt(p[1], p[2]) : null; } catch (e) { return null; } }
  function dateText(pr) {
    try {
      var d = new Date(), g = new Intl.DateTimeFormat('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(d);
      var h = api().hijri(pr && pr.maghribPassed ? 1 : 0); return g + (h ? ' · ' + h : '');
    } catch (e) { return ''; }
  }
  function focusOn(f) { return D.f === f && !D.drawer && !D.pick && !D.menu && !D.edit && !D.ask; }
  function renderMeta() {
    var A = api(); if (!A) return;
    var pr = prayerNow(), p = placeBy(D.bg);
    $('dpDate').textContent = dateText(pr);
    $('dpPlace').innerHTML = '<i></i>' + esc(p.n) + ' <small>· ' + esc(p.c) + '</small> <small class="pv">· ' + esc(prov()[0]) + '</small>';
    $('dpPlace').className = 'dp-chip' + (focusOn('chip') ? ' focus' : '');
    $('dpPray').innerHTML = pr ? '<div class="pk">الصلاة القادمة · ' + esc(prov()[0]) + '</div><div class="pn">' + esc(pr.name) + ' <b>' + esc(pr.time) + '</b></div><div class="ps">' + esc(pr.left) + '</div>' : '<div class="pk">أوقات الصلاة غير متوفرة</div>';
  }
  var TOPS = [['notif', 'الإشعارات', 'M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0'], ['wifi', 'الواي فاي', 'M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01'], ['net', 'حالة الاتصال', 'M4 18v-2M9 18v-6M14 18V9M19 18V5'], ['set', 'الإعدادات', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-2a7.5 7.5 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 3.6h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z']];
  function renderTop() {
    var on = navigator.onLine !== false, h = '';
    TOPS.forEach(function (t, i) {
      var f = focusOn('top') && D.ti === i;
      h += '<div class="dp-circ' + (f ? ' focus' : '') + (t[0] === 'net' && !on ? ' off' : '') + '"><svg viewBox="0 0 24 24"><path d="' + t[2] + '"/></svg>' + (f ? '<span>' + t[1] + '</span>' : '') + '</div>';
    });
    $('dpTop').innerHTML = h;
  }
  function renderDock() {
    var A = api(), l = dockApps(), h = '', fo = focusOn('dock');
    if (D.di >= l.length) D.di = Math.max(0, l.length - 1);
    l.forEach(function (a, i) {
      var sel = i === D.di;
      h += '<div class="dp-it' + (sel ? ' sel' : '') + (sel && fo ? ' focus' : '') + (D.mv && sel ? ' mv' : '') + '">' + iconHtml(a, 92) + '</div>';
    });
    $('dpDock').innerHTML = h || '<div class="dp-empty">ماكو تطبيقات بالشريط</div>';
    $('dpDock').className = 'dp-glass';
    var nm = $('dpName'), cur = l[D.di];
    nm.textContent = cur && !D.drawer ? A.label(cur) : '';
    nm.className = cur && !D.drawer && !(wState('dock').h && !D.edit) ? 'on' : '';
    if (cur) { var token = ++timers.g; dominant(cur, function (c) { if (token === timers.g) setGlow(c); }); }
  }
  timers.g = 0;
  var glowFlip = false;
  function setGlow(c) {
    var a = $('dpGlowA'), b = $('dpGlowB'), on = glowFlip ? a : b, off = glowFlip ? b : a; glowFlip = !glowFlip;
    on.style.background = 'radial-gradient(70% 90% at 50% 105%, ' + c + ' 0%, rgba(0,0,0,0) 70%)'; on.style.opacity = '.55'; off.style.opacity = '0';
  }
  function renderDrawer() {
    var A = api(), l = allApps(), g = $('dpDrawerGrid'), h = '';
    if (D.gi >= l.length) D.gi = Math.max(0, l.length - 1);
    l.forEach(function (a, i) { h += '<div class="dp-gi' + (i === D.gi && D.drawer && !D.menu ? ' focus' : '') + '">' + iconHtml(a, 104) + '</div>'; });
    g.innerHTML = h;
    var row = Math.floor(D.gi / COLS), rows = Math.ceil(l.length / COLS), vis = 4, off = Math.max(0, Math.min(row - 1, rows - vis)) * 190;
    g.style.transform = 'translateY(' + (-off) + 'px)';
    $('dpDrawerName').textContent = l[D.gi] ? A.label(l[D.gi]) : '';
    $('dpDrawerName').style.bottom = (ticker() + 24) + 'px';
    $('dpDrawer').className = D.drawer ? 'on' : '';
  }

  /* ---------------------------------------------------------------- matches and news strips */
  function dayName(t) {
    try { return new Intl.DateTimeFormat('ar-IQ', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(t)); } catch (e) { return ''; }
  }
  var gamesAny = false, gamesState = 'loading', newsState = 'loading';
  function loadMatches() {
    var A = api(); if (!A || !A.upcoming) return;
    gamesState = 'loading'; renderMatches();
    A.upcoming().then(function (r) { games = (r && r.list) || []; gamesAny = !!(r && r.any); gamesState = 'done'; renderMatches(); }, function () { games = []; gamesState = 'fail'; renderMatches(); });
  }
  function renderMatches() {
    var el = $('dpMatches'); if (!el) return;
    el.className = 'dp-strip dp-glass';
    if (!games.length) {
      var t = gamesState === 'loading' ? 'جاري تحميل المباريات…' : gamesState === 'fail' ? 'تعذّر جلب المباريات، تأكد من الإنترنت' : !gamesAny ? 'شريط المباريات: اختر فرقك من الإعدادات ← الفرق' : 'ماكو مباريات قادمة لفرقك خلال أسبوعين';
      el.innerHTML = '<span class="mi dim">' + t + '</span>'; return;
    }
    var g = games[gameI % games.length];
    el.innerHTML = '<span class="mi"><b>' + esc(g.h) + '</b> × <b>' + esc(g.a) + '</b><em>' + esc(dayName(g.at)) + '</em><small>' + esc(g.lg || '') + '</small></span>';
    gameI++;
  }
  function parseRss(x) {
    var out = [];
    try {
      var doc = new DOMParser().parseFromString(x, 'text/xml');
      Array.prototype.forEach.call(doc.getElementsByTagName('item'), function (it) {
        var t = ((it.getElementsByTagName('title')[0] || {}).textContent || '').replace(/\s+-\s+[^-]{2,30}$/, '').trim();
        if (t && out.indexOf(t) < 0) out.push(t);
      });
    } catch (e) {}
    return out.slice(0, 8);
  }
  function loadNews() {
    var A = api(); if (!A || !A.getText) return;
    var urls = D.rss.slice(0, 4), got = [], left = urls.length;
    if (!left) { news = []; newsState = 'none'; newsSig = ''; renderNews(); return; }
    newsState = 'loading'; newsSig = ''; renderNews();
    urls.forEach(function (u) {
      A.getText(u).then(function (t) { got = got.concat(parseRss(t || '')); }, function () {}).then(function () { if (--left === 0) { news = got.slice(0, 24); newsState = news.length ? 'done' : 'fail'; newsSig = ''; renderNews(); } });
    });
  }
  var newsSig = '';
  /* the speed: D.nsp 1 (very slow) .. 10 (fast), in letters per second; the default is a pace a person can read */
  function newsCps() { return 1.2 + D.nsp * .9; }
  function renderNews() {
    var el = $('dpNews'); if (!el) return;
    var sig = news.join('|') + '|' + newsState + '|' + D.nsp; if (sig === newsSig) return; newsSig = sig;
    el.className = 'dp-strip dp-glass';
    if (!news.length) { el.innerHTML = '<span class="mi dim">' + (newsState === 'loading' ? 'جاري تحميل الأخبار…' : newsState === 'none' ? 'شريط الأخبار: اختر مصادر RSS من الإعدادات ← مصادر الأخبار' : 'تعذّر جلب الأخبار، تأكد من الإنترنت') + '</span>'; return; }
    var txt = news.map(function (t) { return '<span class="ni">' + esc(t) + '</span>'; }).join('<i class="sp">◆</i>'), chars = news.join('').length + news.length * 4, dur = Math.max(40, (chars + 40) / newsCps());
    el.innerHTML = '<div class="mq"><div class="mqi" style="animation-duration:' + dur.toFixed(0) + 's">' + txt + '<i class="sp">◆</i>' + txt + '</div></div>';
  }
  function renderAll() { renderMeta(); renderTop(); renderDock(); renderDrawer(); renderMatches(); applyWidgets(); parallax(); }

  /* ---------------------------------------------------------------- one menu component: lists, settings, app options, choices */
  function openMenu(title, build, i, back) { D.menu = { title: title, build: build, i: i || 0, back: back || null }; if (D.edit && $('dpEditBar')) $('dpEditBar').className = ''; drawMenu(); }
  function closeMenu() { D.menu = null; drawMenu(); }
  function drawMenu() {
    var m = $('dpMenu');
    if (!D.menu) { m.className = 'dp-glass'; m.innerHTML = ''; return renderAll(); }
    var rows = D.menu.build(), n = rows.length, win = 9, from = clamp(D.menu.i - 4, 0, Math.max(0, n - win)), h = '<div class="mt">' + esc(D.menu.title) + '</div>';
    if (D.menu.i >= n) D.menu.i = Math.max(0, n - 1);
    for (var i = from; i < Math.min(n, from + win); i++) h += '<div class="mo' + (i === D.menu.i ? ' focus' : '') + (rows[i].on ? ' on' : '') + '"><span>' + esc(rows[i].t) + '</span>' + (rows[i].v != null ? '<em>' + esc(rows[i].v) + '</em>' : '') + '</div>';
    if (n > win) h += '<div class="mm">' + (D.menu.i + 1) + ' / ' + n + '</div>';
    m.innerHTML = h; m.className = 'dp-glass on';
    renderDock(); renderTop(); renderMeta();
  }
  function menuKey(k) {
    var M = D.menu, rows = M.build(), n = rows.length;
    if (k === 'ArrowUp') M.i = (M.i + n - 1) % n;
    else if (k === 'ArrowDown') M.i = (M.i + 1) % n;
    else if (k === 'back') { var b = M.back; D.menu = null; drawMenu(); if (b) b(); return; }
    else if (k === 'ok') {
      var r = rows[M.i]; if (!r || !r.act) return;
      var keep = r.act();
      if (keep === 'close') { var bk = M.back; D.menu = null; drawMenu(); if (bk) bk(); return; }
      if (D.menu === M) return drawMenu();
      return;
    }
    drawMenu();
  }
  function askText(title, hint, cb) {
    var a = $('dpAsk'); D.ask = { cb: cb };
    a.innerHTML = '<div class="mt">' + esc(title) + '</div><input id="dpInput" dir="ltr" placeholder="' + esc(hint) + '" autocomplete="off"><div class="mm">اكتب ثم OK · رجوع للإلغاء</div>';
    a.className = 'dp-glass on'; var i = $('dpInput'); i.focus();
  }
  function askKey(k) {
    var a = $('dpAsk'), v = ($('dpInput').value || '').trim(), cb = D.ask.cb;
    if (k === 'ok' || k === 'back') { D.ask = null; a.className = 'dp-glass'; a.innerHTML = ''; try { $('dpInput') && $('dpInput').blur(); } catch (e) {} if (k === 'ok' && v) cb(v); }
  }

  /* app options (hold OK on an icon) */
  function curApp() { return D.drawer ? allApps()[D.gi] : dockApps()[D.di]; }
  function openAppMenu() {
    var a = curApp(); if (!a) return;
    openMenu(api().label(a), function () {
      var o = [];
      if (inDock(a.pkg)) {
        o.push({ t: 'إزالة من الشريط', act: function () { removeDock(a.pkg); toast('انشالت من الشريط'); return 'close'; } });
        o.push({ t: 'نقل داخل الشريط', act: function () { D.mv = true; D.drawer = false; D.f = 'dock'; D.di = Math.max(0, dockApps().map(function (x) { return x.pkg; }).indexOf(a.pkg)); toast('حرّك بالأسهم، OK للتثبيت'); return 'close'; } });
      } else o.push({ t: 'إضافة إلى الشريط', act: function () { if (addDock(a.pkg)) toast('انضافت للشريط'); return 'close'; } });
      o.push({ t: 'إخفاء التطبيق', act: function () { hideApp(a.pkg); toast('انخفى «' + api().label(a) + '». ترجعه من الإعدادات'); if (D.gi > 0 && D.drawer) D.gi--; return 'close'; } });
      o.push({ t: 'تعديل الواجهة', act: function () { D.drawer = false; enterEdit(); return 'close'; } });
      return o;
    }, 0);
  }

  /* ---------------------------------------------------------------- settings, choices */
  function provRows(after) { return PROVS.map(function (p, i) { return { t: p[0], on: i === D.prov, act: function () { D.prov = i; saveCfg(); renderMeta(); toast('المحافظة: ' + p[0]); return 'close'; } }; }); }
  function pickProv(back) { openMenu('المحافظة', function () { return provRows(); }, D.prov, back); }
  function pickStyle(back) {
    openMenu('شكل الساعة', function () { return CSTY.map(function (c) { return { t: c[1], on: D.cs === c[0], act: function () { D.cs = c[0]; saveCfg(); styleClocks(); } }; }); }, CSTY.map(function (c) { return c[0]; }).indexOf(D.cs), back);
  }
  function pickRss(back) {
    openMenu('مصادر الأخبار', function () {
      var rows = RSS.map(function (r) { var on = D.rss.indexOf(r[0]) >= 0; return { t: r[1], v: on ? '✓' : '', on: on, act: function () { toggleRss(r[0]); } }; });
      D.rss.forEach(function (u) { if (!RSS.some(function (r) { return r[0] === u; })) rows.push({ t: u.replace(/^https?:\/\//, '').slice(0, 44), v: '✓ (احذف)', on: true, act: function () { toggleRss(u); } }); });
      rows.push({ t: 'إضافة رابط RSS…', act: function () { D.menu = null; drawMenu(); askText('رابط RSS', 'https://…/rss', function (v) { if (/^https?:\/\//i.test(v) && D.rss.indexOf(v) < 0) { D.rss.push(v); saveCfg(); loadNews(); toast('انضاف المصدر'); } pickRss(back); }); } });
      return rows;
    }, 0, back);
  }
  function toggleRss(u) { var i = D.rss.indexOf(u); if (i >= 0) D.rss.splice(i, 1); else D.rss.push(u); saveCfg(); newsSig = ''; loadNews(); }
  function pickTeams(back) {
    var A = api();
    openMenu('فرق شريط المباريات', function () {
      var rows = ((A.teams && A.teams()) || []).map(function (n) { return { t: n, v: 'احذف', act: function () { A.removeTeam(n); loadMatches(); } }; });
      rows.push({ t: 'إضافة فريق بالاسم…', act: function () { D.menu = null; drawMenu(); askText('اسم الفريق (بالإنگليزي أدق)', 'Real Madrid', function (v) { A.addTeam(v); loadMatches(); toast('انضاف الفريق'); pickTeams(back); }); } });
      rows.push({ t: 'اختيار دوريات وكؤوس: من تطبيق مدير الشاشة', v: '' });
      return rows;
    }, 0, back);
  }
  function openSettings() {
    openMenu('الإعدادات', function () {
      var hid = D.hidden.length;
      return [
        { t: 'تعديل الواجهة', v: 'تحريك · حجم · إخفاء', act: function () { enterEdit(); return 'close'; } },
        { t: 'المحافظة', v: prov()[0], act: function () { D.menu = null; pickProv(openSettings); } },
        { t: 'شكل الساعة', v: (CSTY.filter(function (c) { return c[0] === D.cs; })[0] || [])[1], act: function () { D.menu = null; pickStyle(openSettings); } },
        { t: 'تأثير العمق', v: D.effect ? 'شغّال' : 'مطفي', act: function () { D.effect = !D.effect; saveCfg(); refreshScenes(); } },
        { t: 'تقليل الحركة', v: D.reduce ? 'شغّال' : 'مطفي', act: function () { D.reduce = !D.reduce; saveCfg(); root.className = D.reduce ? 'dp-reduce' : ''; refreshScenes(); parallax(); } },
        { t: 'تغيير الخلفية', v: placeBy(D.bg).n, act: function () { D.menu = null; drawMenu(); openPick(); } },
        { t: 'الفرق (شريط المباريات)', v: '', act: function () { D.menu = null; pickTeams(openSettings); } },
        { t: 'مصادر الأخبار', v: D.rss.length + ' مصدر', act: function () { D.menu = null; pickRss(openSettings); } },
        { t: 'سرعة شريط الأخبار', v: D.nsp + ' / 10', act: function () { D.nsp = D.nsp >= 10 ? 1 : D.nsp + 1; saveCfg(); newsSig = ''; renderNews(); } },
        { t: 'سرعة حركة الخلفية عند التنقل', v: D.pspd + ' م.ث', act: function () { var o = [200, 300, 450, 650, 900, 1200], i = o.indexOf(D.pspd); D.pspd = o[(i + 1) % o.length]; saveCfg(); parallax(); } },
        { t: 'شدة حركة الخلفية', v: Math.round(D.pamt * 100) + '٪', act: function () { var o = [0, .5, 1, 1.5, 2], i = o.indexOf(D.pamt); D.pamt = o[(i + 1) % o.length]; saveCfg(); parallax(); } },
        { t: 'الضباب المتحرك', v: ['مطفي', 'خفيف', 'متوسط', 'كثيف'][D.mist | 0], act: function () { D.mist = ((D.mist | 0) + 1) % 4; saveCfg(); parallax(); } },
        { t: 'إظهار التطبيقات المخفية', v: hid ? hid + ' مخفي' : 'ماكو', act: function () { D.hidden = []; saveCfg(); toast('رجعت كل التطبيقات'); } },
        { t: 'إعدادات الواجهة الأصلية', v: '', act: function () { D.menu = null; drawMenu(); var A = api(); if (A) A.openSettings(); } },
        { t: 'إعدادات الجهاز', v: '', act: function () { D.menu = null; drawMenu(); var B = api(); if (B) B.sysSettings(); } }
      ];
    }, 0);
  }

  /* ---------------------------------------------------------------- the picture picker */
  function openPick() {
    D.pick = { i: placeIdx(D.bg), row: 'places', o: 0 };
    $('dpPick').className = 'on';
    scenes.pick = null; $('dpPickBox').innerHTML = '';
    drawPick(); showScene(placeList()[D.pick.i].id, $('dpPickBox'), 'pick');
  }
  function drawPick() {
    var P = D.pick, l = placeList(), h = '', id = l[Math.min(P.i, l.length - 1)] ? l[Math.min(P.i, l.length - 1)].id : l[0].id;
    l.forEach(function (p, i) { h += '<div class="dp-pb' + (i === P.i && P.row === 'places' ? ' focus' : '') + (i === P.i ? ' cur' : '') + '">' + esc(p.n) + '</div>'; });
    h += '<div class="dp-pb add' + (P.i === l.length && P.row === 'places' ? ' focus' : '') + (P.i === l.length ? ' cur' : '') + '">＋ من جهازي</div>';
    $('dpPickBtns').innerHTML = h;
    var btns = $('dpPickBtns').children, c = btns[P.i], off = 0;
    if (c) { off = c.offsetLeft + c.offsetWidth / 2 - 960; }
    $('dpPickBtns').style.transform = 'translateX(' + (-off) + 'px)';
    var o = P.i < l.length ? bgo(id) : {}, mo = o.motion !== false, dp = o.depth !== false;
    $('dpPickOpts').innerHTML = P.i < l.length ? '<div class="dp-po' + (P.row === 'opts' && P.o === 0 ? ' focus' : '') + '">الخلفية: <b>' + (mo ? 'متحركة' : 'ثابتة') + '</b></div><div class="dp-po' + (P.row === 'opts' && P.o === 1 ? ' focus' : '') + '">تأثير العمق: <b>' + (dp ? 'شغّال' : 'مطفي') + '</b></div>' : '';
  }
  function pickKey(k) {
    var P = D.pick, l = placeList(), n = l.length + 1;
    if (k === 'back') { D.pick = null; $('dpPick').className = ''; scenes.pick = null; return renderAll(); }
    if (P.row === 'opts') {
      var id = l[P.i].id;
      if (k === 'ArrowUp') P.row = 'places';
      else if (k === 'ArrowRight' || k === 'ArrowLeft') P.o = P.o ? 0 : 1;
      else if (k === 'ok') { var o = bgo(id); if (P.o === 0) o.motion = o.motion === false; else o.depth = o.depth === false; saveCfg(); if (scenes.pick) classesOf(scenes.pick.el); if (scenes.home && D.bg === id) refreshScenes(); }
      return drawPick();
    }
    if (k === 'ArrowRight') P.i = (P.i + n - 1) % n;          /* RTL: right is the first place */
    else if (k === 'ArrowLeft') P.i = (P.i + 1) % n;
    else if (k === 'ArrowDown') { if (P.i < l.length) { P.row = 'opts'; P.o = 0; } }
    else if (k === 'ok') {
      if (P.i === l.length) { return pickFromDevice(); }
      D.bg = l[P.i].id; saveCfg(); D.pick = null; $('dpPick').className = ''; scenes.pick = null;
      showScene(D.bg, $('dpScenes'), 'home'); return renderAll();
    }
    drawPick();
    if (P.i < l.length) showScene(l[P.i].id, $('dpPickBox'), 'pick');
  }
  /* «اختيار خلفية من جهازي»: the launcher's own picture picker (memory or USB); then the front layer is worked out on the TV */
  function pickFromDevice() {
    var A = api();
    if (A && A.pickImage && A.pickImage()) { D.waitPick = true; toast('اختار الصورة من الذاكرة أو الفلاش'); }
    else toast('اختيار صورة من الجهاز يحتاج الشاشة نفسها');
  }
  function picked(path) {
    if (!D.waitPick) return false;
    D.waitPick = false;
    if (!path) { toast('ما تم اختيار صورة'); return true; }
    var src = /^\//.test(path) ? 'file://' + path : path;
    toast('أجهّز الصورة وأفصل العنصر البارز…');
    analyzeImage(src, function (res) {
      if (D.users.length >= 6) D.users.shift();
      var u = { id: 'u' + Date.now(), n: 'صورتي ' + (D.users.length + 1), src: src, sky: res ? res.sky : null, dy: res ? res.dy : 0, ok: res ? res.ok : false, blur: res ? res.blur : '' };
      D.users.push(u); D.bg = u.id; saveCfg();
      if (D.pick) { D.pick = null; $('dpPick').className = ''; scenes.pick = null; }
      scenes.home = null; $('dpScenes').innerHTML = ''; showScene(D.bg, $('dpScenes'), 'home'); renderAll();
      toast(res && res.ok ? 'تم فصل العنصر البارز: الساعة صارت خلفه' : 'ما گدرت أفصل العنصر البارز: الساعة فوق الصورة');
    });
    return true;
  }

  /* ---------------------------------------------------------------- edit mode: every part can be moved, resized and hidden */
  function enterEdit() {
    D.edit = { i: 0, mode: 'sel' }; D.drawer = false; D.f = 'dock';
    renderEdit();
  }
  function exitEdit() { D.edit = null; saveCfg(); renderEdit(); }
  function renderEdit() {
    var bar = $('dpEditBar');
    if (!D.edit || D.menu) { if (D.edit) { bar.className = ''; return renderAll(); } bar.className = ''; bar.innerHTML = ''; return renderAll(); }
    var E = D.edit, id = WIDGETS[E.i][0], name = WIDGETS[E.i][1], s = wState(id), msg;
    if (E.mode === 'move') msg = 'تحريك «' + name + '»: الأسهم تحرّكه · OK للتثبيت';
    else if (E.mode === 'size') msg = id === 'clock' ? 'حجم «' + name + '»: ◄► العرض ' + Math.round(s.sx * 100) + '٪ · ▲▼ الارتفاع ' + Math.round(s.sy * 100) + '٪ · OK للتثبيت' : 'حجم «' + name + '»: الأسهم تكبّر وتصغّر ' + Math.round(s.sx * 100) + '٪ · OK للتثبيت';
    else msg = 'تعديل الواجهة · ◄► اختر الجزء: «' + name + '»' + (s.h ? ' (مخفي)' : '') + ' · OK للخيارات · رجوع للحفظ والخروج';
    bar.innerHTML = msg; bar.className = 'on';
    renderAll();
  }
  function editMenu() {
    var E = D.edit, id = WIDGETS[E.i][0], name = WIDGETS[E.i][1];
    openMenu(name, function () {
      var s = wState(id), rows = [];
      if (id === 'clock') { rows.push({ t: 'المحافظة', v: prov()[0], act: function () { D.menu = null; pickProv(editMenu); } }); rows.push({ t: 'شكل الساعة', v: (CSTY.filter(function (c) { return c[0] === D.cs; })[0] || [])[1], act: function () { D.menu = null; pickStyle(editMenu); } }); }
      if (id === 'date' || id === 'pray') rows.push({ t: 'المحافظة', v: prov()[0], act: function () { D.menu = null; pickProv(editMenu); } });
      if (id === 'matches') rows.push({ t: 'الفرق', v: '', act: function () { D.menu = null; pickTeams(editMenu); } });
      if (id === 'news') { rows.push({ t: 'مصادر الأخبار', v: '', act: function () { D.menu = null; pickRss(editMenu); } }); rows.push({ t: 'سرعة الأخبار', v: D.nsp + ' / 10', act: function () { D.nsp = D.nsp >= 10 ? 1 : D.nsp + 1; saveCfg(); newsSig = ''; renderNews(); } }); }
      if (id === 'dock') rows.push({ t: 'ترتيب التطبيقات', v: 'نقل · إضافة · إزالة · إخفاء', act: function () { exitEdit(); D.f = 'dock'; toast('اختر تطبيق واضغط OK مطولاً'); return 'close'; } });
      rows.push({ t: 'تحريك', act: function () { E.mode = 'move'; renderEdit(); return 'close'; } });
      rows.push({ t: 'الحجم', v: id === 'clock' ? 'عرض وارتفاع' : '', act: function () { E.mode = 'size'; renderEdit(); return 'close'; } });
      rows.push({ t: s.h ? 'إظهار' : 'إخفاء', act: function () { s.h = !s.h; saveCfg(); applyWidgets(); renderEdit(); } });
      rows.push({ t: 'إعادة الوضع الأصلي', act: function () { D.w[id] = { x: 0, y: 0, sx: 1, sy: 1, h: false }; saveCfg(); applyWidgets(); renderEdit(); } });
      return rows;
    }, 0, function () { renderEdit(); });
  }
  function editKey(k) {
    var E = D.edit, id = WIDGETS[E.i][0], s = wState(id), now = Date.now(), fast = now - lastKeyAt < 220; lastKeyAt = now; heldN = fast ? heldN + 1 : 0;
    var step = 12 + Math.min(heldN, 12) * 6;
    if (E.mode === 'move') {
      if (k === 'ArrowRight') s.x += step; else if (k === 'ArrowLeft') s.x -= step; else if (k === 'ArrowUp') s.y -= step; else if (k === 'ArrowDown') s.y += step;
      else if (k === 'ok' || k === 'back') { E.mode = 'sel'; saveCfg(); }
      s.x = clamp(s.x, -1500, 1500); s.y = clamp(s.y, -1000, 1000);
    } else if (E.mode === 'size') {
      var d = .05;
      if (id === 'clock') { if (k === 'ArrowRight') s.sx += d; else if (k === 'ArrowLeft') s.sx -= d; else if (k === 'ArrowUp') s.sy += d; else if (k === 'ArrowDown') s.sy -= d; }
      else { if (k === 'ArrowRight' || k === 'ArrowUp') { s.sx += d; s.sy += d; } else if (k === 'ArrowLeft' || k === 'ArrowDown') { s.sx -= d; s.sy -= d; } }
      if (k === 'ok' || k === 'back') { E.mode = 'sel'; saveCfg(); }
      s.sx = Math.round(clamp(s.sx, .5, 1.8) * 100) / 100; s.sy = Math.round(clamp(s.sy, .5, 1.8) * 100) / 100;
    } else {
      if (k === 'ArrowRight') E.i = (E.i + WIDGETS.length - 1) % WIDGETS.length; else if (k === 'ArrowLeft') E.i = (E.i + 1) % WIDGETS.length;
      else if (k === 'ok') return editMenu();
      else if (k === 'back') return exitEdit();
    }
    renderEdit();
  }

  /* the phone's preview: a tap on a part selects it there (its sliders open in the phone's panel) */
  function previewTap(e) {
    var r = root.getBoundingClientRect(), k = r.width / 1920, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k, t = e.target, id = null;
    while (t && t !== root) { if (t.id && t.id.indexOf('dpw-') === 0) { id = t.id.slice(4); break; } t = t.parentNode; }
    if (!id) { var c = wState('clock'), d = DEF.clock, cx = 960 + c.x, cy = d.y + d.h / 2 + c.y; if (Math.abs(x - cx) < d.w / 2 * c.sx && Math.abs(y - cy) < d.h / 2 * c.sy) id = 'clock'; }
    if (id) { D.pvSel = id; applyWidgets(); try { window.parent.postMessage({ __dsel: id }, '*'); } catch (e2) {} }
  }

  /* ---------------------------------------------------------------- keys */
  function launch(a) { var A = api(); if (A && a) A.launch(a.pkg); }
  function order() { var o = ['dock']; if (visible('date')) o.push('chip'); if (visible('top')) o.push('top'); return o; }
  function homeKey(k) {
    var l = dockApps();
    if (D.f === 'dock') {
      if (D.mv) {
        var from = D.di, to = from;
        if (k === 'ArrowRight') to = Math.max(0, from - 1); else if (k === 'ArrowLeft') to = Math.min(l.length - 1, from + 1);
        else if (k === 'ok' || k === 'back') { D.mv = false; saveCfg(); return renderAll(); }
        if (to !== from) { var pk = l.map(function (a) { return a.pkg; }), it = pk.splice(from, 1)[0]; pk.splice(to, 0, it); D.dock = pk; D.di = to; saveCfg(); }
        return renderAll();
      }
      var hiddenDock = wState('dock').h;
      if (k === 'ArrowRight' && !hiddenDock) D.di = Math.max(0, D.di - 1);
      else if (k === 'ArrowLeft' && !hiddenDock) D.di = Math.min(l.length - 1, D.di + 1);
      else if (k === 'ArrowUp') { var o = order(); D.f = o[1] || 'dock'; }
      else if (k === 'ArrowDown') { D.drawer = true; D.gi = Math.max(0, allApps().map(function (a) { return a.pkg; }).indexOf((l[D.di] || {}).pkg)); }
      else if (k === 'ok') { if (hiddenDock) { D.drawer = true; D.gi = 0; } else launch(l[D.di]); }
    } else if (D.f === 'chip') {
      var o2 = order();
      if (k === 'ArrowDown') D.f = 'dock'; else if (k === 'ArrowUp') D.f = o2.indexOf('top') >= 0 ? 'top' : 'chip'; else if (k === 'ok') return openPick();
    } else if (D.f === 'top') {
      if (k === 'ArrowRight') D.ti = Math.max(0, D.ti - 1); else if (k === 'ArrowLeft') D.ti = Math.min(TOPS.length - 1, D.ti + 1);
      else if (k === 'ArrowDown') D.f = order().indexOf('chip') >= 0 ? 'chip' : 'dock'; else if (k === 'ok') topAct(TOPS[D.ti][0]);
    }
    renderAll();
  }
  function topAct(id) {
    var B = (window.Android || {});
    if (id === 'set') return openSettings();
    if (id === 'wifi') { if (B.openWifi) B.openWifi(); else toast('الواي فاي: يحتاج الشاشة نفسها'); return; }
    if (id === 'net') { if (B.openNetwork) B.openNetwork(); else toast(navigator.onLine === false ? 'ماكو اتصال بالإنترنت' : 'متصل بالإنترنت'); return; }
    if (id === 'notif') {
      var m = ''; try { var j = B.media ? JSON.parse(B.media() || '{}') : {}; m = j && (j.title || j.text) ? (j.title || '') + (j.artist ? ' · ' + j.artist : '') : ''; } catch (e) {}
      toast(m ? 'يشتغل الآن: ' + m : 'ماكو إشعارات جديدة');
    }
  }
  function drawerKey(k) {
    var l = allApps(), n = l.length;
    if (k === 'back') { D.drawer = false; D.f = 'dock'; return renderAll(); }
    if (k === 'ArrowRight') D.gi = Math.max(0, D.gi - 1);
    else if (k === 'ArrowLeft') D.gi = Math.min(n - 1, D.gi + 1);
    else if (k === 'ArrowDown') D.gi = Math.min(n - 1, D.gi + COLS);
    else if (k === 'ArrowUp') { if (D.gi - COLS >= 0) D.gi -= COLS; else { D.drawer = false; D.f = 'dock'; } }
    else if (k === 'ok') launch(l[D.gi]);
    renderAll();
  }
  function key(k) {
    if (D.ask) return askKey(k);
    if (D.pick) return pickKey(k);
    if (D.menu) return menuKey(k);
    if (D.edit) return editKey(k);
    if (D.drawer) return drawerKey(k);
    homeKey(k);
  }

  /* hold OK on an app icon: its options open; on the date or the top buttons: edit mode. A short press does the usual thing.
     Capture phase, so the launcher's own OK handling does not also run. */
  function isOk(e) { return e.key === 'Enter' || e.key === ' ' || e.keyCode === 23 || e.keyCode === 13; }
  function holdable() { return mounted && !D.pick && !D.menu && !D.ask && !D.edit && !D.mv; }
  window.addEventListener('keydown', function (e) {
    var A = api(); if (!holdable() || !A || A.layer() !== 'main' || !isOk(e)) return;
    var ae = document.activeElement; if (ae && ae.tagName === 'INPUT') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat || lpT) return;
    lpFired = false;
    lpT = setTimeout(function () { lpT = null; lpFired = true; if (D.drawer || D.f === 'dock') openAppMenu(); else enterEdit(); }, 600);
  }, true);
  window.addEventListener('keyup', function (e) {
    if (!mounted || !isOk(e) || !(lpT || lpFired)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (lpT) { clearTimeout(lpT); lpT = null; var A = api(); if (A) A.press(); key('ok'); }
    lpFired = false;
  }, true);

  /* the phone's editor asks this page to work out a picture's front layer (it has the fonts and the clock) and gets the answer back */
  window.addEventListener('message', function (e) {
    var d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } }
    if (!d || !d.__depthAnalyze) return;
    var q = d.__depthAnalyze, src = e.source;
    analyzeImage(q.src, q.opts || {}, function (res) { try { src.postMessage(JSON.stringify({ __depthResult: { id: q.id, res: res } }), '*'); } catch (x) {} });
  });

  window.Depth = {
    on: function () { var A = api(); return mounted && !!A && A.settings().skin === 'depth'; },
    sync: function () {
      var A = api(); if (!A) return;
      if (A.settings().skin === 'depth') {
        if (!mounted) mount();
        else {
          loadCfg(); root.className = D.reduce ? 'dp-reduce' : ''; styleClocks();
          var tsig = JSON.stringify(A.settings().tickerTeams || []) + '|' + JSON.stringify(A.settings().tickerLeagues || []), nsig = JSON.stringify(D.rss);
          if (tsig !== timers.tsig) { timers.tsig = tsig; loadMatches(); }
          if (nsig !== timers.nsig) { timers.nsig = nsig; loadNews(); }
          var cur = scenes.home; if (cur && cur.id !== D.bg) { showScene(D.bg, $('dpScenes'), 'home'); } else refreshScenes();
          renderAll();
        }
      } else unmount();
    },
    previewSelect: function (id) { D.pvSel = id || null; if (mounted) applyWidgets(); },
    analyze: analyzeImage,
    key: key,
    apps: function () { if (mounted) renderAll(); },
    paint: function () { if (mounted) { paintClocks(); renderMeta(); } },
    picked: picked,
    home: function () { D.drawer = false; D.menu = null; D.mv = false; D.ask = null; D.f = 'dock'; if (D.edit) exitEdit(); if (D.pick) { D.pick = null; $('dpPick').className = ''; } if (mounted) { drawMenu(); renderAll(); } },
    places: PLACES, provinces: PROVS, clockStyles: CSTY, widgets: WIDGETS,
    _t: { newsCps: newsCps, setMatches: function (g, any, st) { games = g; gamesAny = any; gamesState = st; gameI = 0; renderMatches(); }, setNewsState: function (st) { newsState = st; newsSig = ''; renderNews(); }, allPlaces: allPlaces, setNews: function (l) { news = l; newsSig = ''; renderNews(); }, analyzeImage: analyzeImage, state: D, loadCfg: loadCfg, saveCfg: saveCfg, dockApps: dockApps, selPos: selPos, addDock: addDock, hideApp: hideApp, removeDock: removeDock, skylineFrom: skylineFrom, coverageOf: coverageOf, alphaFromSky: alphaFromSky, bestDy: bestDy, clipPoly: clipPoly, wState: wState, rectOf: rectOf, placeList: placeList, depthOn: depthOn, motionOn: motionOn, parseRss: parseRss, editKey: editKey, enterEdit: enterEdit, exitEdit: exitEdit, DEF: DEF }
  };
})();
