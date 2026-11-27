/* The ten visual identities, shared by every app (launcher, Screen Manager, قنواتي on phone and screen, تواصل, هوائي, أوتو) and the site.
   One definition each: colours, fonts, corner radii. Brand.apply(id, family) pushes them into the CSS variables the app already uses,
   so everything in the app follows: colours, fonts, shapes. The chosen identity is kept in localStorage ('brand'). ES5 on purpose (old TV WebViews). */
(function (root) {
  'use strict';
  var Brand = { fontBase: 'fonts/', DEFAULT: 'rasheed', fam: 'launcher' };

  /* fonts: family key -> files (relative to Brand.fontBase) */
  var FONTS = {
    Alexandria: [['Alexandria.ttf', '100 900']], Plex: [['PlexArabic-Regular.ttf', '400'], ['PlexArabic-SemiBold.ttf', '600 800']],
    Reem: [['ReemKufi.ttf', '400 700']], Tajawal: [['Tajawal-Medium.ttf', '400 500'], ['Tajawal-Bold.ttf', '600 800']],
    Cairo: [['Cairo.ttf', '200 900']], Readex: [['Readex.ttf', '160 700']], Aref: [['ArefRuqaa-Bold.ttf', '400 700']],
    Naskh: [['NotoNaskh.ttf', '400 700']], Scheh: [['Scheherazade-Bold.ttf', '400 700']], Changa: [['Changa.ttf', '200 800']],
    Lalezar: [['Lalezar.ttf', '400 700']], Almarai: [['Almarai-Regular.ttf', '400 500'], ['Almarai-Bold.ttf', '600 800']],
    NotoKufi: [['NotoKufi.ttf', '100 900']], Markazi: [['Markazi.ttf', '400 700']], Mada: [['Mada.ttf', '200 900']]
  };

  /* tokens: bg s1 s2 (surfaces) · p primary · a second accent · t text · m muted · live (alerts, live badges) · rc card radius · rb button radius */
  var LIST = [
    { id: 'dijla', edge: 'soft', n: 1, name: 'دجلة', tag: 'ماء متدفق', h: 'Alexandria', b: 'Plex', rc: 34, rb: 999, shape: 'circle', pat: 'waves', nav: 'pill', hero: 'wide', top: 'outline', fx: 'glow',
      bg: '#061F33', s1: '#0B3250', s2: '#124266', p: '#14B8A6', a: '#7DF3E1', t: '#EAF6F4', m: '#8FB4BF', live: '#FF7A59' },
    { id: 'sumer', edge: 'frame', n: 2, name: 'سومر', tag: 'طين وعقيق ولازورد', h: 'Reem', b: 'Tajawal', rc: 8, rb: 6, shape: 'chamfer', pat: 'steps', nav: 'bar', hero: 'frame', top: 'badge', fx: 'gold',
      bg: '#1A110C', s1: '#2A1B13', s2: '#3A271B', p: '#C8553D', a: '#E3B24F', t: '#F5EAD3', m: '#B9A58B', live: '#3F7BD6' },
    { id: 'night', edge: 'glow', n: 3, name: 'ليل بغداد', tag: 'نيون وزجاج', h: 'Cairo', b: 'Readex', rc: 22, rb: 16, shape: 'squircle', pat: 'grid', nav: 'dock', hero: 'neon', top: 'neon', fx: 'scan',
      bg: '#0A0714', s1: '#150F26', s2: '#21183D', p: '#8B5CF6', a: '#22D3EE', t: '#F1EDFF', m: '#9A90C0', live: '#FF2E93' },
    { id: 'hibr', edge: 'hard', n: 4, name: 'حِبر', tag: 'ورق وحبر', h: 'Aref', b: 'Naskh', rc: 4, rb: 3, shape: 'square', pat: 'dots', nav: 'under', hero: 'frame', top: 'badge', fx: 'gold', light: 1,
      bg: '#F3EEE4', s1: '#FFFFFF', s2: '#E8E0D0', p: '#14110F', a: '#D7261E', t: '#14110F', m: '#6B645A', live: '#D7261E' },
    { id: 'zumurrud', edge: 'frame', n: 5, name: 'زُمُرّد', tag: 'زمرد وذهب', h: 'Scheh', b: 'Tajawal', rc: 26, rb: 14, shape: 'octagon', pat: 'star', nav: 'arch', hero: 'glass', top: 'none', fx: 'depth',
      bg: '#04211A', s1: '#0A3228', s2: '#10463A', p: '#10A07A', a: '#E0BC52', t: '#F7F2DF', m: '#9CC2B4', live: '#E0BC52' },
    { id: 'ishara', edge: 'bar', n: 6, name: 'إشارة', tag: 'شاشة اختبار البث', h: 'Changa', b: 'Tajawal', rc: 3, rb: 3, shape: 'square', pat: 'scan', nav: 'bar', hero: 'wide', top: 'badge', fx: 'scan',
      bg: '#1B1B1D', s1: '#272729', s2: '#343437', p: '#E8C547', a: '#3FA7A3', t: '#F2EEE3', m: '#A8A59B', live: '#C9402F' },
    { id: 'rasheed', edge: 'dash', n: 7, name: 'سينما الرشيد', tag: 'ملصق سينما مرسوم باليد', h: 'Lalezar', b: 'Almarai', rc: 6, rb: 6, shape: 'ticket', pat: 'halftone', nav: 'pill', hero: 'wide', top: 'fill', fx: 'glow',
      bg: '#2A1A14', s1: '#3A241B', s2: '#4A2E22', p: '#E4472C', a: '#F4B731', t: '#F8EBCB', m: '#C9B28C', live: '#E4472C' },
    { id: 'sadu', edge: 'weave', n: 8, name: 'سَدو', tag: 'نسيج الصوف البدوي', h: 'NotoKufi', b: 'Tajawal', rc: 2, rb: 2, shape: 'square', pat: 'weave', nav: 'under', hero: 'frame', top: 'fill', fx: 'gold', light: 1,
      bg: '#EBE1CB', s1: '#F6EFDD', s2: '#DDD0B3', p: '#A3261F', a: '#1E2A4A', t: '#2B2622', m: '#7A6E5C', live: '#A3261F' },
    { id: 'kashi', edge: 'grout', n: 9, name: 'كاشي', tag: 'الكاشي العراقي', h: 'Markazi', b: 'Almarai', rc: 0, rb: 0, shape: 'tile', pat: 'tiles', nav: 'bar', hero: 'frame', top: 'badge', fx: 'gold', light: 1,
      bg: '#F4F6F2', s1: '#FFFFFF', s2: '#DDE9EA', p: '#1B4F9C', a: '#1FA6B8', t: '#0F2A4D', m: '#5B6F85', live: '#E8A93B' },
    { id: 'tareeq', edge: 'sign', n: 10, name: 'لوحة الطريق', tag: 'لوحات الشوارع', h: 'Mada', b: 'Tajawal', rc: 10, rb: 8, shape: 'plate', pat: 'asphalt', nav: 'under', hero: 'wide', top: 'fill', fx: 'glow',
      bg: '#202122', s1: '#2B2D2E', s2: '#3A3C3D', p: '#F5C400', a: '#FFFFFF', t: '#FAFAF7', m: '#B5B7B5', live: '#E23B34' }
  ];
  /* where the same files live on the web (the site has no font folder of its own) */
  var CDN = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/', REMOTE = {
    'Alexandria.ttf': 'alexandria/Alexandria%5Bwght%5D.ttf', 'PlexArabic-Regular.ttf': 'ibmplexsansarabic/IBMPlexSansArabic-Regular.ttf', 'PlexArabic-SemiBold.ttf': 'ibmplexsansarabic/IBMPlexSansArabic-SemiBold.ttf',
    'ReemKufi.ttf': 'reemkufi/ReemKufi%5Bwght%5D.ttf', 'Tajawal-Medium.ttf': 'tajawal/Tajawal-Medium.ttf', 'Tajawal-Bold.ttf': 'tajawal/Tajawal-Bold.ttf', 'Cairo.ttf': 'cairo/Cairo%5Bslnt,wght%5D.ttf',
    'Readex.ttf': 'readexpro/ReadexPro%5BHEXP,wght%5D.ttf', 'ArefRuqaa-Bold.ttf': 'arefruqaa/ArefRuqaa-Bold.ttf', 'NotoNaskh.ttf': 'notonaskharabic/NotoNaskhArabic%5Bwght%5D.ttf',
    'Scheherazade-Bold.ttf': 'scheherazadenew/ScheherazadeNew-Bold.ttf', 'Changa.ttf': 'changa/Changa%5Bwght%5D.ttf', 'Lalezar.ttf': 'lalezar/Lalezar-Regular.ttf',
    'Almarai-Regular.ttf': 'almarai/Almarai-Regular.ttf', 'Almarai-Bold.ttf': 'almarai/Almarai-Bold.ttf', 'NotoKufi.ttf': 'notokufiarabic/NotoKufiArabic%5Bwght%5D.ttf',
    'Markazi.ttf': 'markazitext/MarkaziText%5Bwght%5D.ttf', 'Mada.ttf': 'mada/Mada%5Bwght%5D.ttf'
  };
  Brand.list = LIST;
  Brand.get = function (id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return null; };
  Brand.fromTheme = function (t) { return /^br:/.test(t || '') ? Brand.get(String(t).slice(3)) : null; };
  Brand.current = function () { var v = null; try { v = root.localStorage.getItem('brand'); } catch (e) {} return Brand.get(v) || Brand.get(Brand.DEFAULT); };

  /* ---- colour helpers ---- */
  function rgb(h) { h = String(h).replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function hex(c) { return '#' + c.map(function (x) { x = Math.max(0, Math.min(255, Math.round(x))); return (x + 256).toString(16).slice(1); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function rgba(h, al) { var c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + al + ')'; }
  function lum(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function on(h) { return lum(h) > .42 ? '#0B0B0B' : '#FFFFFF'; }
  Brand.mix = mix; Brand.rgba = rgba; Brand.on = on;
  function fam(key, fallback) { return "'BR-" + key + "'," + fallback; }
  var SHAPE_R = { circle: '50%', chamfer: '6px', squircle: '34%', square: '3px', octagon: '30%', ticket: '8px', tile: '0px', plate: '12px' };

  /* the CSS variables each family of apps already uses */
  Brand.vars = function (b, f) {
    var line = rgba(b.t, b.light ? .18 : .14), line2 = rgba(b.t, b.light ? .28 : .22), hf = fam(b.h, "'Tajawal',sans-serif"), bf = fam(b.b, "'Tajawal',system-ui,sans-serif");
    var common = { fd: hf, fb: bf };
    if (f === 'launcher') return { '--bg': b.bg, '--ink': b.t, '--ink-2': rgba(b.t, .8), '--ink-3': rgba(b.t, .56), '--gold': b.p, '--gold-2': b.a, '--green': b.light ? '#2E7D5B' : '#6FB59A', '--red': b.live,
      '--card': rgba(b.s1, .86), '--card-2': rgba(b.s1, .95), '--line': rgba(b.t, .22), '--accent-line': rgba(b.p, .55), '--rc': b.rc + 'px', '--rs': Math.round(b.rc * .75) + 'px', '--rg': Math.max(2, b.rc) + 'px',
      '--glass-bg': rgba(b.s1, .92), '--font': bf, '--kufi': hf, '--serif': hf, '--clockfont': hf };
    if (f === 'remote') return { '--bg': b.bg, '--panel': b.s1, '--panel2': b.s2, '--ink': b.t, '--ink-2': rgba(b.t, .8), '--ink-3': rgba(b.t, .56), '--cu': b.p, '--cu2': b.a, '--line': line2, '--green': b.light ? '#2E7D5B' : '#6FB59A', '--red': b.live,
      '--r1': b.rc + 'px', '--r2': Math.max(2, Math.round(b.rc * .6)) + 'px', '--r3': Math.max(2, Math.round(b.rc * .4)) + 'px' };
    if (f === 'auto') return { '--ac': b.p, '--ac2': b.a, '--ac3': mix(b.p, '#000000', .35), '--sig': b.a, '--ok': b.light ? '#1E8A57' : '#4CC38A', '--bad': b.live, '--bg': b.bg, '--panel': b.s1, '--panel2': b.s2, '--line': line, '--ink': b.t, '--mute': b.m,
      '--grad': b.p, '--r': Math.max(2, b.rc) + 'px', '--r2': Math.max(2, Math.round(b.rc * .6)) + 'px' };
    if (f === 'studio' || f === 'tawasul') { var o = { '--ac': b.p, '--ac2': b.a, '--ac3': mix(b.p, '#000000', .35), '--act': b.p, '--sig': b.a, '--live': b.live, '--bad': b.live, '--ok': b.light ? '#1E8A57' : '#4CC38A',
      '--bg': b.bg, '--bg2': mix(b.bg, b.s1, .5), '--panel': b.s1, '--panel2': b.s2, '--line': line, '--line2': line2, '--ink': b.t, '--mute': b.m, '--onac': on(b.p), '--grad': b.p,
      '--r1': Math.max(2, b.rc) + 'px', '--r2': Math.max(2, Math.round(b.rc * .7)) + 'px', '--r3': Math.max(2, Math.round(b.rc * .5)) + 'px', '--fd': hf, '--fb': bf, '--mine': mix(b.bg, b.p, b.light ? .2 : .25) }; return o; }
    if (f === 'mobile') return { '--rz': b.p, '--rzrgb': rgb(b.p).join(','), '--s1': b.s1, '--s2': b.s2, '--s3': mix(b.s2, b.t, .08), '--s4': mix(b.s2, b.t, .16), '--t2': b.m, '--bg': b.bg, '--fg': b.t, '--a2': b.a, '--on': on(b.p), '--rc': b.rc + 'px', '--rb': Math.min(b.rb, 999) + 'px', '--fd': hf, '--fb': bf };
    if (f === 'site') return { '--ink': b.bg, '--surf': b.s1, '--surf2': b.s2, '--line': line2, '--ivory': b.t, '--ivory2': mix(b.t, b.bg, .15), '--cu': b.p, '--cu2': b.a, '--chrome': b.m, '--teal': b.a, '--r1': b.rc + 'px', '--r2': Math.max(0, Math.round(b.rc * .5)) + 'px', '--r3': Math.max(0, Math.round(b.rc * .3)) + 'px', '--onp': on(b.p), '--fd': hf, '--fb': bf };
    return common;
  };

  /* @font-face for the identity's two families (the files are only fetched when the text uses them) */
  function fontCss(b) {
    var out = '', seen = {};
    [b.h, b.b].forEach(function (k) {
      if (seen[k] || !FONTS[k]) return; seen[k] = 1;
      FONTS[k].forEach(function (f) { out += "@font-face{font-family:'BR-" + k + "';src:url('" + (Brand.fontBase === 'cdn' ? CDN + REMOTE[f[0]] : Brand.fontBase + f[0]) + "');font-weight:" + f[1] + ";font-display:swap}"; });
    });
    return out;
  }
  var PAT = {
    waves: function (c) { return "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='40'><path d='M0 20c20-14 40-14 60 0s40 14 60 0 30-9 40-4' fill='none' stroke='" + c + "' stroke-opacity='.08' stroke-width='3'/></svg>"; },
    steps: function (c) { return "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><path d='M0 56h20v-12h20v-12h20v-12h20v12h20v12h20v12' fill='none' stroke='" + c + "' stroke-opacity='.10' stroke-width='3'/></svg>"; },
    grid: function (c) { return "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><path d='M48 0H0v48' fill='none' stroke='" + c + "' stroke-opacity='.09' stroke-width='1.5'/></svg>"; },
    dots: function () { return "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='3' cy='3' r='1.5' fill='#14110F' fill-opacity='.12'/></svg>"; },
    star: function (c) { return "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><path d='M40 6l7 15 16-7-7 16 15 7-15 7 7 16-16-7-7 15-7-15-16 7 7-16-15-7 15-7-7-16 16 7z' fill='none' stroke='" + c + "' stroke-opacity='.11' stroke-width='1.6'/></svg>"; },
    scan: function () { return "<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><rect width='6' height='1.5' fill='#fff' fill-opacity='.035'/></svg>"; },
    halftone: function (c) { return "<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><circle cx='3.5' cy='3.5' r='1.6' fill='" + c + "' fill-opacity='.07'/></svg>"; },
    weave: function () { return "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><path d='M0 13L13 0l13 13-13 13z' fill='none' stroke='#A3261F' stroke-opacity='.09' stroke-width='2'/></svg>"; },
    tiles: function () { return "<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><path d='M72 0H0v72' fill='none' stroke='#1B4F9C' stroke-opacity='.07' stroke-width='2'/></svg>"; },
    asphalt: function () { return "<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><circle cx='20' cy='30' r='1' fill='#fff' fill-opacity='.07'/><circle cx='64' cy='70' r='1.2' fill='#fff' fill-opacity='.06'/><circle cx='74' cy='14' r='.9' fill='#fff' fill-opacity='.06'/></svg>"; }
  };
  Brand.patUrl = function (b) { var f = PAT[b.pat]; return f ? 'url("data:image/svg+xml,' + encodeURIComponent(f(b.a)) + '")' : 'none'; };

  /* ---- shapes and effects: how each identity draws icons, tiles, cards and the top tools ---- */
  function clipPx(shape, c) {
    var r = Math.round(c * .7);
    if (shape === 'ticket') return 'polygon(0 0,100% 0,100% calc(50% - ' + c + 'px),calc(100% - ' + r + 'px) 50%,100% calc(50% + ' + c + 'px),100% 100%,0 100%,0 calc(50% + ' + c + 'px),' + r + 'px 50%,0 calc(50% - ' + c + 'px))';
    return 'polygon(' + c + 'px 0,calc(100% - ' + c + 'px) 0,100% ' + c + 'px,100% calc(100% - ' + c + 'px),calc(100% - ' + c + 'px) 100%,' + c + 'px 100%,0 calc(100% - ' + c + 'px),0 ' + c + 'px)';
  }
  var CLIPS = { chamfer: 1, octagon: 0, ticket: 1 };
  /* geometry of a big tile / poster (c = corner size in px) and of a small icon */
  function geoBig(b, c) {
    var s = b.shape;
    if (s === 'circle') return 'border-radius:' + Math.round(c * 2) + 'px;clip-path:none';
    if (s === 'chamfer') return 'border-radius:0;clip-path:' + clipPx('chamfer', c);
    if (s === 'squircle') return 'border-radius:' + Math.round(c * 1.6) + 'px;clip-path:none';
    if (s === 'square') return 'border-radius:3px;clip-path:none';
    if (s === 'octagon') return 'border-radius:46% 46% 14px 14px/30% 30% 14px 14px;clip-path:none';
    if (s === 'ticket') return 'border-radius:0;clip-path:' + clipPx('ticket', c);
    if (s === 'tile') return 'border-radius:0;clip-path:none';
    return 'border-radius:' + Math.round(c * 1.2) + 'px;clip-path:none';
  }
  function geoSmall(b) {
    var s = b.shape;
    if (s === 'circle') return 'border-radius:50%;clip-path:none';
    if (s === 'chamfer') return 'border-radius:0;clip-path:polygon(22% 0,78% 0,100% 22%,100% 78%,78% 100%,22% 100%,0 78%,0 22%)';
    if (s === 'squircle') return 'border-radius:34%;clip-path:none';
    if (s === 'square') return 'border-radius:4px;clip-path:none';
    if (s === 'octagon') return 'border-radius:0;clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)';
    if (s === 'ticket') return 'border-radius:0;clip-path:polygon(0 0,100% 0,100% 36%,92% 50%,100% 64%,100% 100%,0 100%,0 64%,8% 50%,0 36%)';
    if (s === 'tile') return 'border-radius:0;clip-path:none';
    return 'border-radius:12px;clip-path:none';
  }
  /* the edge of an identity: an inner frame/bar (drawn by ::before, so it also sits above pictures) and an outer shadow (only when the shape is not clipped) */
  function edgeOf(b) {
    var P = b.p, A = b.a, T = b.t, S1 = b.s1;
    return ({ soft: ['', '0 12px 28px rgba(0,0,0,.32)'], glow: ['inset 0 0 0 2px ' + P, '0 0 26px ' + rgba(P, .55)], hard: ['inset 0 0 0 4px ' + T, '6px 6px 0 ' + T], bar: ['inset 0 -9px 0 ' + P, ''], frame: ['inset 0 0 0 3px ' + A, ''],
      dash: ['inset 0 0 0 3px ' + A, ''], weave: ['inset 0 0 0 4px ' + S1 + ',inset 0 0 0 7px ' + P + ',inset 0 0 0 9px ' + T, ''], grout: ['inset 0 0 0 3px #fff', ''], sign: ['inset 0 0 0 5px #fff', ''] })[b.edge] || ['', ''];
  }
  function ringOf(b) {
    var P = b.p, A = b.a, T = b.t, BG = b.bg;
    return ({ soft: '0 0 0 5px ' + BG + ',0 0 0 10px ' + A, glow: '0 0 0 3px ' + A + ',0 0 44px ' + A, hard: '10px 10px 0 ' + P, bar: '0 0 0 5px ' + A, frame: '0 0 0 4px ' + BG + ',0 0 0 8px ' + A,
      dash: '0 0 0 5px ' + A, weave: '0 0 0 5px ' + BG + ',0 0 0 9px ' + P, grout: '0 0 0 6px ' + P, sign: '0 0 0 6px ' + P })[b.edge] || '0 0 0 6px ' + P;
  }
  function skinCss(b, f) {
    var big = geoBig(b, 16), small = geoSmall(b), clipped = !!(CLIPS[b.shape]), e = edgeOf(b), P = b.p, A = b.a, T = b.t, BG = b.bg, css = '';
    var outer = clipped || !e[1] ? 'box-shadow:none' : 'box-shadow:' + e[1];
    var toolBg = (b.id === 'rasheed' || b.id === 'sadu' || b.id === 'kashi') ? P : b.s2, toolFg = on(toolBg), edgeBefore = e[0] ? 'content:"";position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;border-radius:inherit;box-shadow:' + e[0] + ';z-index:3' : 'content:none';
    var iconFx = b.id === 'night' ? 'filter:drop-shadow(0 0 5px ' + A + ')' : b.id === 'rasheed' ? 'filter:drop-shadow(2px 2px 0 rgba(0,0,0,.45))' : b.id === 'hibr' || b.id === 'tareeq' ? 'filter:none' : 'filter:none';
    if (f === 'launcher') {
      css += ".app .tile{" + big + ";" + outer + "}.app .tile::before{" + edgeBefore + "}.app .tile.ic img{" + iconFx + "}" +
        ".app.focus .tile{" + (clipped ? "box-shadow:none;filter:brightness(1.2) saturate(1.15)" : "box-shadow:" + ringOf(b)) + "}" + (clipped ? ".app.focus .tile::before{box-shadow:inset 0 0 0 8px " + A + "}" : "") +
        "#topbar .glass,.glass{" + small + ";background:" + toolBg + "!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;border:0!important;box-shadow:" + (e[0] && !clipped ? e[0].split(',inset')[0] : 'none') + (b.edge === 'hard' ? ',4px 4px 0 ' + T : '') + "}" +
        ".glass svg{stroke:" + toolFg + "!important;" + iconFx + "}.glass.focus,#topbar .glass.focus{background:" + A + "!important;box-shadow:" + (clipped ? 'none' : ringOf(b)) + "!important;" + (clipped ? 'filter:brightness(1.12);' : '') + "}.glass.focus svg{stroke:" + on(A) + "!important}" +
        ".occ,.match{" + (clipped ? 'border-radius:0;clip-path:' + clipPx(b.shape, 12) : geoBig(b, 12)) + ";" + (b.edge === 'hard' ? 'box-shadow:5px 5px 0 ' + T + ';border:3px solid ' + T : b.edge === 'grout' || b.edge === 'sign' ? 'border:3px solid #fff' : b.edge === 'weave' ? 'border:3px solid ' + T : '') + "}" +
        ".occ.focus,.match.focus{box-shadow:" + (clipped ? 'none' : ringOf(b)) + "}";
    }
    if (f === 'mobile') {
      css += ".card .art,.tn .art,.dtp,.dpo{" + big.replace(/clip-path:none/, 'clip-path:none') + ";" + outer + "}.ch .art,.row>.art,.now .art,.av,.hav{" + small + "}" +
        ".card .art::before,.tn .art::before,.ch .art::before,.row>.art::before,.dtp::before{" + edgeBefore + "}" +
        ".ch .art,.row>.art{" + (clipped || !e[1] ? 'box-shadow:none' : 'box-shadow:' + e[1].replace(/6px 6px/, '3px 3px')) + "}" +
        ".row,.now,.panel{" + (b.edge === 'hard' ? 'box-shadow:4px 4px 0 ' + T + ';border:3px solid ' + T : b.edge === 'grout' || b.edge === 'sign' ? 'border:2px solid #fff' : b.edge === 'weave' ? 'border:3px solid ' + T : b.edge === 'glow' ? 'box-shadow:inset 0 0 0 1.5px ' + P : b.edge === 'bar' ? 'box-shadow:inset 0 -5px 0 ' + P : '') + "}" +
        ".chip{" + (b.edge === 'hard' || b.edge === 'weave' ? 'box-shadow:inset 0 0 0 2px ' + T : b.edge === 'glow' ? 'box-shadow:inset 0 0 0 1.5px ' + P : '') + "}" +
        (clipped ? ".chip,.btn,.hbt button{clip-path:" + (b.shape === 'ticket' ? 'polygon(0 0,100% 0,100% 30%,96% 50%,100% 70%,100% 100%,0 100%,0 70%,4% 50%,0 30%)' : 'polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)') + "}" : "") +
        "nav button svg{" + iconFx + "}";
    }
    if (f === 'tawasul' || f === 'studio') {
      css += ".av,.cb,.fab,.ib,.sw,.tile>button{" + small + "}.fab{" + (clipped ? '' : outer) + "}" +
        ".m,.ct,.me,.item,.panel,.opt,.gcard{" + (b.edge === 'hard' ? 'box-shadow:4px 4px 0 ' + T + ';border:3px solid ' + T : b.edge === 'grout' || b.edge === 'sign' ? 'border:2px solid #fff' : b.edge === 'weave' ? 'border:3px solid ' + T : b.edge === 'glow' ? 'box-shadow:inset 0 0 0 1.5px ' + P : '') + "}" +
        ".btn,.chip{" + (b.edge === 'hard' ? 'box-shadow:3px 3px 0 ' + T : '') + "}";
    }
    if (f === 'remote' || f === 'auto') {
      css += ".app,.rb,.rk,.ni,.pad,.dpad>*,.tpl,.mini-btn,.sw{" + small + "}.btn,.chip,.card,.panel,.pill,.item,.seg,.touch{" + (b.edge === 'hard' ? 'box-shadow:3px 3px 0 ' + T + ';border:2px solid ' + T : b.edge === 'grout' || b.edge === 'sign' ? 'border:2px solid #fff' : b.edge === 'glow' ? 'box-shadow:inset 0 0 0 1.5px ' + P : '') + "}";
    }
    if (f === 'site') {
      css += ".btn,.app,.shot,.hl,.card{" + (b.edge === 'hard' ? 'box-shadow:5px 5px 0 ' + T + ';border:3px solid ' + T : b.edge === 'grout' || b.edge === 'sign' ? 'border:3px solid #fff' : b.edge === 'weave' ? 'border:3px solid ' + T : b.edge === 'glow' ? 'box-shadow:0 0 0 2px ' + P + ',0 0 30px ' + rgba(P, .4) : '') + "}.shot,.mk{" + (clipped ? '' : '') + "}";
    }
    return css;
  }

  /* radius, font and surface overrides for the apps whose own CSS has the numbers written in (قنواتي on the phone) */
  function famCss(b, f) {
    var R = SHAPE_R[b.shape] || '12px', css = '';
    if (f === 'mobile') {
      css += "html,body{background:var(--bg)!important;color:var(--fg)!important;font-family:var(--fb),'Plex','Tajawal',sans-serif!important}" +
        "header h1,.sh,.hero h2,.dt h3,.sheet h3,.panel h2,.now h3,.tn .nm{font-family:var(--fd),'Plex',sans-serif!important}" +
        ".row,.panel,.now,.search,.chip,.btn,.tools button,.sheet>div,.ct,.hero,.hbt button,.eth,.ep{border-radius:var(--rc)!important}" +
        ".chip,.btn,.search,.tools button,.hbt button{border-radius:var(--rb)!important}" +
        "nav{background:var(--s1)!important}nav button.on{background:var(--rz)!important;color:var(--on)!important}nav button.on svg{stroke:var(--on)!important}" +
        ".btn,.hbt button.pri,.chip.on,.sv{background:var(--rz)!important;color:var(--on)!important}" +
        ".hbd{background:var(--rz)!important;color:var(--on)!important}";
      if (b.light) css += ".chip{color:var(--fg)}.chip.on{color:var(--on)!important}.row,.panel,.now,.sheet>div,#detail,#detail .dbody{background:var(--s1)!important;color:var(--fg)}.tx small,.empty,.sh a,.card b,.ch b{color:var(--fg)}.tx small{color:var(--t2)}.search,input,textarea,select{background:var(--s2)!important;color:var(--fg)!important}.btn.sec{background:var(--s2)!important;color:var(--fg)!important}.hero .hsh{background:linear-gradient(0deg,rgba(0,0,0,.65),rgba(0,0,0,.2))}.hero,.hero h2,.hero .hmeta{color:#fff}#detail{background:var(--bg)!important}.dsh{background:linear-gradient(0deg,var(--bg),rgba(0,0,0,.25))!important}.tn .nm{color:var(--bg)!important;-webkit-text-stroke:3px var(--fg)!important}";
    }
    if (f === 'launcher') {
      css += "#liveModal,#vodModal{--rz:" + b.p + ";--rz-s1:" + b.s1 + ";--rz-s2:" + b.s2 + ";--rz-s3:" + mix(b.s2, b.t, .08) + ";--rz-s4:" + mix(b.s2, b.t, .16) + ";--rz-t2:" + b.m + ";background:" + b.bg + "!important;color:" + b.t + "}" +
        "#liveModal .lv-art,#liveModal .lv-ch,#liveModal .lv-cat{border-radius:" + R + "}#homeModal,#chatModal{--hz:" + b.p + "}" +
        (b.light ? ".bgimg{display:none!important}.bgshade{background:transparent!important}#timeTint,#rainFx{display:none!important}.bgfallback{background:" + b.bg + "!important}#adhanbox{background:rgba(255,255,255,.7)!important}" : "");
    }
    if (f === 'auto' || f === 'remote') css += ".btn.pri,.pri{background:" + b.p + "!important;color:" + on(b.p) + "!important}";
    return css + skinCss(b, f);
  }

  /* apply an identity: variables on <html>, fonts, shapes, a faint pattern. `f` = the family of the app (see Brand.vars). */
  Brand.apply = function (id, f, opts) {
    var b = typeof id === 'string' ? Brand.get(id) : id; if (!b) return null;
    f = f || Brand.fam; Brand.fam = f; opts = opts || {};
    var d = root.document, de = d.documentElement, v = Brand.vars(b, f), k;
    for (k in v) de.style.setProperty(k, v[k]);
    de.setAttribute('data-brand', b.id); de.setAttribute('data-bshape', b.shape);
    if (d.body) { d.body.setAttribute('data-hero', b.hero); d.body.setAttribute('data-nav', b.nav); d.body.setAttribute('data-top', b.top); d.body.setAttribute('data-fx', b.fx); d.body.classList.toggle('brand-light', !!b.light); }
    var st = d.getElementById('brandCss');
    if (!st) { st = d.createElement('style'); st.id = 'brandCss'; (d.head || de).appendChild(st); }
    var pat = Brand.patUrl(b);
    st.textContent = fontCss(b) + famCss(b, f) + (opts.noPattern ? '' : "#brandPat{position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:1;background-image:" + pat + ";background-size:auto}");
    var pt = d.getElementById('brandPat');
    if (!pt && d.body && !opts.noPattern) { pt = d.createElement('div'); pt.id = 'brandPat'; d.body.appendChild(pt); }
    if (pt && opts.noPattern) pt.parentNode.removeChild(pt);
    if (!opts.preview) { try { root.localStorage.setItem('brand', b.id); } catch (e) {} }
    var m = d.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', b.bg);
    if (root.Android && root.Android.setIcon && !opts.preview) { try { root.Android.setIcon(b.id); } catch (e) {} }
    if (typeof opts.after === 'function') opts.after(b);
    return b;
  };
  /* leave the identity (the launcher goes back to one of its older themes) */
  Brand.clear = function (f) {
    var d = root.document, de = d.documentElement, v = Brand.vars(Brand.get(Brand.DEFAULT), f || Brand.fam), k;
    for (k in v) de.style.removeProperty(k);
    de.removeAttribute('data-brand'); de.removeAttribute('data-bshape');
    var st = d.getElementById('brandCss'); if (st) st.textContent = '';
    var pt = d.getElementById('brandPat'); if (pt && pt.parentNode) pt.parentNode.removeChild(pt);
  };

  /* a full-screen chooser for the web based apps: ten cards, tap to apply. onPick(b) after a choice */
  Brand.picker = function (onPick) {
    var d = root.document, cur = Brand.current(), box = d.getElementById('brandPick');
    if (box) box.parentNode.removeChild(box);
    box = d.createElement('div'); box.id = 'brandPick';
    box.setAttribute('style', 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:99999;background:rgba(0,0,0,.72);overflow-y:auto;direction:rtl;font-family:system-ui,sans-serif');
    var h = '<div style="max-width:620px;margin:0 auto;padding:20px 14px 40px"><div style="display:flex;align-items:center;margin-bottom:14px"><b style="flex:1;color:#fff;font-size:22px">الهوية البصرية</b><button id="brandX" style="border:0;border-radius:12px;padding:8px 16px;background:#fff;color:#000;font-size:16px;font-weight:700">إغلاق</button></div>';
    LIST.forEach(function (b) {
      var sw = [b.bg, b.p, b.a, b.live, b.t].map(function (c) { return '<i style="display:inline-block;width:26px;height:26px;margin-left:6px;background:' + c + ';border:1px solid rgba(128,128,128,.5);border-radius:' + (b.shape === 'circle' ? '50%' : b.shape === 'tile' || b.shape === 'square' ? '2px' : '7px') + '"></i>'; }).join('');
      h += '<div data-b="' + b.id + '" style="margin-bottom:10px;padding:14px;border-radius:14px;background:' + b.bg + ';color:' + b.t + ';border:3px solid ' + (b.id === cur.id ? b.p : 'rgba(128,128,128,.35)') + ';cursor:pointer"><div style="display:flex;align-items:center"><b style="font-size:22px;flex:1">' + b.n + ' · ' + b.name + '</b>' + (b.id === cur.id ? '<span style="background:' + b.p + ';color:' + on(b.p) + ';padding:2px 12px;border-radius:99px;font-size:14px">المختارة</span>' : '') + '</div><div style="opacity:.75;font-size:15px;margin:2px 0 8px">' + b.tag + '</div><div>' + sw + '</div></div>';
    });
    box.innerHTML = h + '</div>'; d.body.appendChild(box);
    box.onclick = function (e) {
      if (e.target.id === 'brandX' || e.target === box) { box.parentNode.removeChild(box); return; }
      var c = e.target.closest ? e.target.closest('[data-b]') : null; if (!c) return;
      var b = Brand.apply(c.getAttribute('data-b'), Brand.fam); box.parentNode.removeChild(box); if (onPick) onPick(b);
    };
  };

  /* start-up for a web app: apply the saved identity (or the default) */
  Brand.init = function (f, opts) { return Brand.apply(Brand.current().id, f, opts); };
  /* a small floating button that opens the chooser (for apps without a settings screen of their own) */
  Brand.button = function (f, opts) {
    var d = root.document; if (d.getElementById('brandBtn')) return;
    var x = d.createElement('button'); x.id = 'brandBtn'; x.type = 'button'; x.setAttribute('aria-label', 'الهوية البصرية'); x.textContent = '🎨';
    x.setAttribute('style', 'position:fixed;left:12px;bottom:14px;z-index:9999;width:46px;height:46px;border:0;border-radius:50%;font-size:22px;background:var(--cu,var(--ac,#888));color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.4)');
    x.onclick = function () { Brand.picker(function (b) { Brand.apply(b.id, f, opts); }); };
    d.body.appendChild(x);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Brand; else root.Brand = Brand;
})(typeof window !== 'undefined' ? window : globalThis);
