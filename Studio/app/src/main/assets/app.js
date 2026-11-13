'use strict';
/* ============================================================ bridge */
const HAS = typeof window.A !== 'undefined';
const B = HAS ? window.A : mockBridge();
const P = {}; let N = 0;
window.__cb = (id, ok, d) => { const p = P[id]; if (!p) return; delete P[id]; ok ? p.res(d) : p.rej(new Error(d)); };
const run = (op, a = {}) => (window.__direct && window.__direct(op, a)) || new Promise((res, rej) => { const id = 'c' + (++N); P[id] = { res, rej }; B.run(id, op, JSON.stringify(a)); });
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kv = (k, d) => { try { const v = B.kvGet(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const kvSet = (k, v) => B.kvSet(k, v == null ? null : JSON.stringify(v));
const sh = cmd => run('sh', { cmd });

/* ============================================================ icons */
const ICONS = {
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  devices: '<rect x="2" y="4" width="14" height="10" rx="2"/><path d="M6 18h6M9 14v4"/><rect x="17" y="8" width="5" height="12" rx="1.5"/>',
  broom: '<path d="M14 4l6 6M4 20l7-7M9 11l4 4M7 13l-3 7 7-3"/>',
  remote: '<rect x="7" y="2" width="10" height="20" rx="4"/><circle cx="12" cy="8" r="2"/><path d="M10 14h.01M14 14h.01M10 17h.01M14 17h.01"/>',
  screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><circle cx="12" cy="10.5" r="2.5"/><path d="M9 21h6"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  back: '<path d="M9 6l6 6-6 6"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  ret: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  power: '<path d="M12 3v9"/><path d="M6.3 7.5a8 8 0 1 0 11.4 0"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  mute: '<path d="M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>',
  kb: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 18v-6M9 15l3 3 3-3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5a8 8 0 1 1 16-3z"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  live: '<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  save: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  vol: '<path d="M11 5L6 9H2v6h4l5 4z"/>',
  ch: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 3l4 4 4-4"/>',
  tg: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l12-9"/>',
  ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

/* ============================================================ helpers */
let toastT;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); }
function busy(t, s) { $('#busyT').textContent = t || 'لحظة…'; $('#busyS').textContent = s || ''; $('#busy').classList.add('on'); }
function unbusy() { $('#busy').classList.remove('on'); }
window.onProg = t => { $('#busyS').textContent = t; };
function sheet(html) { $('#sheetBody').innerHTML = html; $('#mask').classList.add('on'); $('#sheet').classList.add('on'); }
function closeSheet() { $('#mask').classList.remove('on'); $('#sheet').classList.remove('on'); }
$('#mask').onclick = closeSheet;
const tap = () => { try { B.vibe(); } catch (e) {} };
const errText = e => {
  const m = (e && e.message) || String(e);
  if (m === 'NEEDADB') { setTimeout(() => window.needAdbSheet && needAdbSheet(), 50); return 'هذي تحتاج إذن التجهيز'; }
  if (m === 'DIRECTAUTH') return 'الربط بالواي فاي انتهى. اربط الشاشة مرة ثانية من «أجهزتي»';
  if (m === 'NOVOICE') return 'الموبايل ما بيه خدمة التعرف على الصوت';
  if (m === 'PAIR') return 'الشاشة تحتاج ربط أول مرة. افتح «ربط جهاز برمز الإقران» بالتلفزيون';
  if (/ECONNREFUSED|refused|failed to connect|Connection/i.test(m)) return 'الشاشة ما ترد. تأكد إنها شغالة وعلى نفس الواي فاي وتصحيح الأخطاء مفعّل';
  if (/timeout|Timeout|Interrupted/i.test(m)) return 'انتهى الوقت. وافق على رسالة السماح بالتلفزيون إذا طلعت وجرّب مرة ثانية';
  return m;
};
const fmtDate = ms => new Date(ms).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });

/* ============================================================ theme */
const ACCENTS = [['#D6B47A', 'شمباني'], ['#C9CED6', 'بلاتيني'], ['#C08B5C', 'برونزي'], ['#E07A8F', 'ياقوتي'], ['#5CC6A0', 'زمردي'], ['#6E9BFF', 'أزرق ليلي']];
function applyTheme() {
  if (!kv('themeV3', 0)) { const o = kv('theme', null); if (o) { o.ac = ACCENTS[0][0]; kvSet('theme', o); } kvSet('themeV3', 1); }
  const th = kv('theme', { dark: true, ac: ACCENTS[0][0] });
  document.body.classList.toggle('light', !th.dark);
  const R = document.documentElement.style;
  R.setProperty('--ac', th.ac); R.setProperty('--act', th.ac);
  /* mixed in JS: older phone WebViews drop color-mix(), which used to wipe the buttons and cards after changing the colour */
  R.setProperty('--grad', `linear-gradient(120deg,${mixHex(th.ac, '#000000', .62)},${th.ac} 55%,${mixHex(th.ac, '#ffffff', .55)})`);
  try { B.bars(th.dark, th.dark ? '#0B0C10' : '#F5F2EC'); } catch (e) {}
  cmFallback();
}
function hexRgb3(h) { h = String(h || '#888888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16) || 0; return [n >> 16, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, p) { const x = hexRgb3(a), y = hexRgb3(b); return 'rgb(' + x.map((v, i) => Math.round(v * p + y[i] * (1 - p))).join(',') + ')'; }
let CM_OK = null;
function cmFallback() {
  if (CM_OK === null) { try { CM_OK = !!(window.CSS && CSS.supports && CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')); } catch (e) { CM_OK = false; } }
  if (CM_OK || !document.body) return;
  const cs = getComputedStyle(document.body), probe = document.createElement('i'); document.body.appendChild(probe);
  ['ac', 'ac3', 'sig', 'bad', 'warn', 'panel', 'bg', 'line'].forEach(n => {
    const v = cs.getPropertyValue('--' + n).trim(); if (!v) return;
    probe.style.color = ''; probe.style.color = v; const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
    if (m) document.body.style.setProperty('--' + n + '-rgb', m.slice(0, 3).join(','));
  });
  probe.remove();
  if (document.getElementById('cmFb')) return;
  let css = '';
  document.querySelectorAll('style').forEach(st => { css += st.textContent; });
  const out = [];
  css.replace(/([^{}]+)\{([^{}]*color-mix[^{}]*)\}/g, (all, sel, body) => {
    const decl = body.split(';').filter(d => d.includes('color-mix')).map(d => d.replace(/color-mix\(in srgb,\s*var\((--[\w-]+)\)\s*(\d+)%\s*,\s*(transparent|var\((--[\w-]+)\))\s*\)/g,
      (m0, a, p, b, bv) => b === 'transparent' ? `rgba(var(${a}-rgb),${(+p / 100).toFixed(2)})` : (+p >= 50 ? `var(${a})` : `var(${bv})`)));
    if (decl.length && !sel.trim().startsWith('@')) out.push(sel.trim() + '{' + decl.join(';') + '}');
    return all;
  });
  const el = document.createElement('style'); el.id = 'cmFb'; el.textContent = out.join('\n'); document.head.appendChild(el);
}
applyTheme();

/* ============================================================ contact */
const CONTACT = {
  tg: () => B.open('https://t.me/KMK3993', 'org.telegram.messenger'),
  tgWeb: () => B.open('https://t.me/KMK3993', ''),
  ig: () => B.open('https://instagram.com/_u/HN_45Y', 'com.instagram.android'),
};
function contactSheet(title) {
  sheet(`<h2>${esc(title || 'تواصل معنا')}</h2>
  <p class="sub">اكتب مشكلتك أو طلبك، ودز ويّاها رمز جهازك: <b class="num">${esc(B.code())}</b></p>
  <div class="list">
    <div class="item tap" data-x="tg">${ic('tg')}<div class="t"><b>تيليگرام</b><small>@KMK3993</small></div></div>
    <div class="item tap" data-x="ig">${ic('ig')}<div class="t"><b>إنستغرام</b><small>@HN_45Y</small></div></div>
  </div>
  <button class="btn sec full" data-x="cp">${ic('copy')} نسخ رمز الجهاز</button>`);
  $('#sheetBody').onclick = e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'tg') { B.copy(B.code()); CONTACT.tg(); }
    if (x.dataset.x === 'ig') { B.copy(B.code()); CONTACT.ig(); }
    if (x.dataset.x === 'cp') { B.copy(B.code()); toast('انسخ الرمز'); }
  };
}

/* ============================================================ navigation */
const TABS = [['home', 'devices', 'أجهزتي'], ['clean', 'broom', 'التجهيز'], ['design', 'layers', 'الواجهة'], ['remote', 'remote', 'الريموت'], ['more', 'more', 'المزيد']];
let cur = 'login', stack = [];
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  cur = id;
  $('#tabs').classList.toggle('on', id !== 'login' && id !== 'page');
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === id));
  const r = RENDER[id]; if (r) r();
}
/* touch feedback: a soft ripple from where the finger lands */
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('.btn,.chip,.item.tap,.key,.iconbtn,nav.tabs button,.tile button,.tpl button,.acts button,.pcard,.quick button,.seg button');
  if (!t) return;
  const r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
  s.className = 'rip'; s.style.width = s.style.height = d + 'px'; s.style.left = (e.clientX - r.left - d / 2) + 'px'; s.style.top = (e.clientY - r.top - d / 2) + 'px';
  t.appendChild(s); setTimeout(() => s.remove(), 600);
}, { passive: true });
$('#tabs').innerHTML = TABS.map(([id, i, t]) => `<button data-t="${id}">${ic(i)}<span>${t}</span></button>`).join('');
$('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) { tap(); stack = []; show(b.dataset.t); } };
function page(title, html, after) {
  if (cur !== 'page') stack.push(cur);
  $('#pageTitle').textContent = title; $('#pageBody').innerHTML = html;
  show('page'); $('#pageBody').scrollTop = 0;
  if (after) after($('#pageBody'));
}
$('#pageBack').innerHTML = ic('back');
$('#pageBack').onclick = () => goBack();
window.goBack = () => {
  if ($('#sheet').classList.contains('on')) { closeSheet(); return true; }
  if ($('#busy').classList.contains('on')) return true;
  if (cur === 'page') { show(stack.pop() || 'home'); return true; }
  if (cur !== 'home' && cur !== 'login') { show('home'); return true; }
  return false;
};

/* ============================================================ login */
function initLogin() {
  $('#dcode').textContent = B.code();
  $('#lver').textContent = 'النسخة ' + B.version();
  $('#dcopy').innerHTML = ic('copy');
  $('#dcopy').onclick = () => { B.copy(B.code()); toast('انسخ رمز الجهاز'); };
  document.querySelector('#login .tg').innerHTML = ic('tg') + 'تيليگرام';
  document.querySelector('#login .ig').innerHTML = ic('ig') + 'إنستغرام';
  document.querySelector('#login .contact').onclick = e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    B.copy(B.code()); toast('انسخ رمز جهازك، دزّه بالرسالة');
    CONTACT[b.dataset.c]();
  };
  const go = () => {
    const u = $('#lu').value.trim(), p = $('#lp').value.trim();
    if (!u || !p) { $('#lerr').textContent = 'اكتب اسم المستخدم وكلمة المرور'; return; }
    const r = JSON.parse(B.login(u, p));
    if (!r.ok) { $('#lerr').textContent = r.msg || 'معلومات الدخول غير صحيحة'; return; }
    $('#lerr').textContent = ''; $('#lp').value = '';
    enter(r);
  };
  $('#lgo').onclick = go;
  $('#lp').onkeydown = e => { if (e.key === 'Enter') go(); };
}
let SESSION = null;
function enter(s) { SESSION = s; show('home'); autoReconnect(); }

/* ============================================================ devices */
let CONN = { connected: false }, INFO = null, FOUND = {};
const devices = () => kv('devices', []);
function saveDevice(d) {
  const list = devices().filter(x => x.host !== d.host);
  list.unshift(Object.assign({ at: Date.now() }, d));
  kvSet('devices', list.slice(0, 12));
}
window.onFound = o => {
  const k = o.kind + '|' + o.host + '|' + o.name;
  FOUND[k] = Object.assign(o, { t: Date.now() });
  if (cur === 'home') renderFound();
  if (window.__waitConnect) window.__waitConnect(o);
};
function foundBy(kind, host) { return Object.values(FOUND).filter(f => f.kind === kind && (!host || f.host === host)); }

async function connectTo(host, port, label) {
  busy('أتصل بالشاشة…', 'إذا طلعت رسالة «السماح بتصحيح الأخطاء» على التلفزيون، اختار سماح دائماً');
  try {
    CONN = await run('connect', { host, port: +port });
    INFO = await run('info');
    const name = label || INFO.name && INFO.name !== 'null' && INFO.name || (INFO.brand + ' ' + INFO.model).trim();
    saveDevice({ host, port: +port, name, model: INFO.model, brand: INFO.brand, android: INFO.android });
    unbusy(); toast('اتصلت بـ ' + name);
    RENDER[cur] && RENDER[cur]();
    return true;
  } catch (e) {
    unbusy();
    if (e.message === 'PAIR') { pairSheet(host); return false; }
    toast(errText(e)); return false;
  }
}
async function autoReconnect() {
  try { CONN = await run('status'); } catch (e) {}
  if (CONN.connected) { if (!INFO) try { INFO = await run('info'); } catch (e) {} ; RENDER[cur] && RENDER[cur](); return; }
  const last = devices()[0];
  B.discover(true);
  if (!last) return;
  // wireless-debugging ports change after a TV restart: prefer the freshly announced port
  setTimeout(async () => {
    const f = foundBy('connect', last.host)[0];
    const port = f ? f.port : last.port;
    try { CONN = await run('connect', { host: last.host, port }); INFO = await run('info'); if (f) saveDevice(Object.assign({}, last, { port })); RENDER[cur] && RENDER[cur](); } catch (e) {}
  }, 2500);
}
/* back from the background: the Java side has checked the ADB link for real (and reconnected if it could) */
window.onAdbResume = async st => {
  if (!st || window.__usbBusy) return;
  if (st.host === 'usb' || (CONN && CONN.usb)) {
    if (st.connected) return;
    if (CONN && CONN.usb) { CONN = { connected: false }; toast('انقطع الكيبل'); RENDER[cur] && RENDER[cur](); }
    return;
  }
  if (CONN && CONN.direct) {
    try { await dapi('info2'); } catch (e) { if (typeof directConnect === 'function') directConnect(CONN.host, '', true); }
    return;
  }
  const was = !!(CONN && CONN.connected);
  if (st.connected) {
    CONN = { connected: true, host: st.host, port: st.port };
    if (!was) { try { INFO = await run('info'); } catch (e) {} RENDER[cur] && RENDER[cur](); }
  } else if (was || (st.host && devices().length)) {
    CONN = { connected: false };
    RENDER[cur] && RENDER[cur]();
    autoReconnect();
  }
};
function need() {
  if (CONN.connected) return true;
  toast('اتصل بشاشة أول'); show('home'); return false;
}
const tvName = () => (devices().find(d => d.host === CONN.host) || {}).name || (INFO ? INFO.model : 'الشاشة');

function renderHome() {
  const b = $('#homeBody');
  $('#addTv').innerHTML = ic('plus');
  $('#addTv').onclick = () => addSheet();
  let h = '<div id="savedBox"></div>';
  if (CONN.connected && INFO) {
    const mem = parseMem(INFO.mem);
    h += `<div class="tv"><div class="row"><span class="dot on"></span><span class="sub">متصل الآن</span></div>
      <div class="name">${esc(tvName())}</div>
      <div class="sub">${esc(INFO.brand)} ${esc(INFO.model)} · أندرويد ${esc(INFO.android)} · <span class="num">${esc(CONN.host)}</span></div>
      <div style="margin-top:8px;position:relative"><span class="tag">${INFO.isTv ? 'شاشة تلفزيون' : 'بوكس أو ستيك'}</span></div>
      <div class="stats">
        <div class="stat"><b class="num">${mem ? mem.freePct + '%' : '—'}</b><small>ذاكرة فارغة</small></div>
        <div class="stat"><b class="num">${esc(INFO.pkgs)}</b><small>تطبيق</small></div>
        <div class="stat"><b class="num">${esc(INFO.disabled)}</b><small>موقوف</small></div>
      </div>
      <div class="row" style="margin-top:14px;position:relative">
        <button class="btn pri" data-go="clean">${ic('broom')} جهّز الشاشة</button>
        <button class="btn sec" data-go="design">${ic('layers')} صمّم الواجهة</button>
      </div>
      <div class="quick">
        <button data-q="live">${ic('live')}مشاهدة مباشرة</button>
        <button data-q="cast">${ic('screen')}${JSON.parse(B.castState()).on ? 'العرض شغّال' : 'موبايلي للشاشة'}</button>
        <button data-q="shot">${ic('cam')}صورة</button>
        <button data-q="files">${ic('file')}الملفات</button>
      </div></div>`;
  } else {
    h += `<div class="panel"><h2>ما متصل بأي جهاز</h2><p class="sub" style="margin:0 0 14px">شغّل «تصحيح الأخطاء اللاسلكي» بالتلفزيون وخلي الموبايل على نفس الواي فاي، والتطبيق يلگاها وحده.</p>
      <button class="btn pri full" id="addBig">${ic('plus')} إضافة جهاز</button>
      <button class="btn ghost full" id="howBtn">${ic('info')} شلون أفعّل تصحيح الأخطاء؟</button></div>`;
  }
  h += `<h2>أجهزة حواليك</h2><div class="list" id="foundList"></div>`;
  const saved = devices();
  b.innerHTML = h;
  renderSavedBox();
  renderFound();
  b.onclick = e => {
    const g = e.target.closest('[data-go]'); if (g) { tap(); show(g.dataset.go); return; }
    const q = e.target.closest('[data-q]'); if (q) { tap(); ({ live: openLive, cast: castToggle, shot: quickShot, fast: quickClean, files: () => openFiles('/sdcard/Download') })[q.dataset.q](); return; }
    if (e.target.closest('#addBig')) { addSheet(); return; }
    if (e.target.closest('#howBtn')) { howTo(); return; }
    const s = e.target.closest('[data-saved]');
    if (s) { const d = saved.find(x => x.host === s.dataset.saved); savedSheet(d); return; }
    const f = e.target.closest('[data-found]');
    if (f) { const o = FOUND[f.dataset.found]; if (o.kind === 'pair') pairSheet(o.host, o.port); else if (o.kind === 'launcher') toast('هذي شاشة عليها واجهة مدير الشاشات، اتصل بيها عن طريق تصحيح الأخطاء'); else connectTo(o.host, o.port); }
  };
  B.discover(true);
}
/* saved devices (screens, cars and phones) folded into one button at the top of «أجهزتي» */
let SAVED_OPEN = false;
function savedList() {
  const l = devices().map(d => ({ k: 'tv', d }));
  kv('phones', []).forEach(p => { if (!l.some(x => x.d.host === p.host)) l.push({ k: 'phone', d: p }); });
  return l;
}
function renderSavedBox() {
  const box = $('#savedBox'); if (!box) return;
  const l = savedList();
  if (!l.length) { box.innerHTML = ''; return; }
  const on = x => CONN.connected && CONN.host === x.d.host;
  box.innerHTML = `<button class="savedhd${SAVED_OPEN ? ' on' : ''}" id="savedTg" aria-expanded="${SAVED_OPEN}">${ic('layers')}<span class="st">الأجهزة المحفوظة</span><span class="tag">${l.length}</span>${ic('down')}</button>
    <div class="savedbody${SAVED_OPEN ? ' on' : ''}"><div class="list">${l.map((x, i) => `<div class="item tap" data-sv="${i}"><span class="dot ${on(x) ? 'on' : ''}"></span>${ic(x.k === 'phone' ? 'phone' : 'tv')}
      <div class="t"><b>${esc(x.d.name || x.d.host)}</b><small class="num">${x.d.host === '127.0.0.1' ? 'هذا الموبايل' : esc(x.d.host + ':' + x.d.port)}</small></div>
      ${on(x) ? '<span class="tag">متصل</span>' : ''}</div>`).join('')}</div></div>`;
  box.onclick = e => {
    e.stopPropagation();
    if (e.target.closest('#savedTg')) { tap(); SAVED_OPEN = !SAVED_OPEN; renderSavedBox(); return; }
    const s = e.target.closest('[data-sv]'); if (!s) return;
    const x = l[+s.dataset.sv]; tap();
    if (x.k === 'phone' && typeof phoneConnect === 'function') phoneConnect(x.d.host, x.d.port, x.d.name); else savedSheet(x.d);
  };
}
function renderFound() {
  const el = $('#foundList'); if (!el) return;
  const all = Object.entries(FOUND);
  const items = all.filter(([k, o]) => (o.kind !== 'launcher' || !all.some(([, x]) => x.kind === 'connect' && x.host === o.host))
    && (!/^scan-/.test(o.name || '') || !all.some(([k2, x]) => k2 !== k && x.kind === o.kind && x.host === o.host && !/^scan-/.test(x.name || ''))));
  if (!items.length) { el.innerHTML = `<div class="empty">${ic('wifi')}<div>أدوّر على أجهزة بالشبكة…</div><small style="display:block;margin-top:8px;opacity:.7;line-height:1.6">أفحص كل الأجهزة على الواي فاي والهوتسبوت. شاشات السيارة والبوكسات (أندرويد ٨ و٩) تطلع هنا إذا بيها «واجهة مدير الشاشات» أو منفذ تصحيح الأخطاء 5555 مفتوح.</small></div>`; return; }
  const kindTxt = { connect: 'جاهزة للاتصال', pair: 'تنتظر رمز الربط', tcp: 'جاهزة للاتصال', launcher: 'عليها واجهة مدير الشاشات' };
  el.innerHTML = items.map(([k, o]) => `<div class="item tap" data-found="${esc(k)}">${ic('tv')}
    <div class="t"><b>${esc(o.label || prettyName(o.name))}</b><small class="num">${esc(o.host)}:${esc(o.port)}</small></div>
    <span class="tag ${o.kind === 'pair' ? 'warn' : ''}">${kindTxt[o.kind]}</span></div>`).join('');
}
function prettyName(n) { const known = devices().find(d => n && n.includes(d.host)); return known ? known.name : (n || 'شاشة').replace(/^adb-/, 'شاشة ').replace(/-[A-Za-z0-9]{6}$/, ''); }
function parseMem(s) {
  const t = /MemTotal:\s+(\d+)/.exec(s || ''), a = /MemAvailable:\s+(\d+)/.exec(s || '');
  if (!t || !a) return null;
  return { total: +t[1], avail: +a[1], freePct: Math.round(+a[1] * 100 / +t[1]) };
}
function savedSheet(d) {
  const on = CONN.connected && CONN.host === d.host;
  sheet(`<h2>${esc(d.name)}</h2><p class="sub num">${esc(d.host)}:${esc(d.port)}</p>
    ${on ? `<button class="btn sec full" data-x="dis">قطع الاتصال</button>` : `<button class="btn pri full" data-x="con">اتصال</button>`}
    <div style="height:10px"></div><button class="btn bad full" data-x="del">${ic('trash')} حذف من القائمة</button>`);
  $('#sheetBody').onclick = async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    closeSheet();
    if (x.dataset.x === 'con') { const f = foundBy('connect', d.host)[0]; connectTo(d.host, f ? f.port : d.port, d.name); }
    if (x.dataset.x === 'dis') { CONN = await run('disconnect'); INFO = null; renderHome(); }
    if (x.dataset.x === 'del') { kvSet('devices', devices().filter(v => v.host !== d.host)); renderHome(); }
  };
}
function addSheet() {
  sheet(`<h2>إضافة شاشة</h2>
    <p class="sub">إذا الشاشة ما طلعت وحدها، اكتب الـ IP والمنفذ اللي يطلع بالتلفزيون بصفحة «تصحيح الأخطاء اللاسلكي».</p>
    <label class="f">عنوان الشاشة (IP)</label><input id="mHost" class="num" inputmode="decimal" placeholder="192.168.1.20">
    <label class="f">المنفذ</label><input id="mPort" class="num" inputmode="numeric" placeholder="5555">
    <p class="sub" style="margin-top:8px">أجهزة أندرويد ٩ و١٠ (مثل البوكسات القديمة) منفذها 5555 بالعادة.</p>
    <button class="btn pri full" id="mGo" style="margin-top:10px">اتصال</button>
    <button class="btn ghost full" id="mPair">عندي رمز ربط من ٦ أرقام</button>
    <button class="btn ghost full" id="mHow">${ic('info')} شلون أفعّل تصحيح الأخطاء؟</button>`);
  $('#mGo').onclick = () => { const h = $('#mHost').value.trim(), p = $('#mPort').value.trim() || '5555'; if (!h) return toast('اكتب عنوان الشاشة'); closeSheet(); connectTo(h, p); };
  $('#mPair').onclick = () => pairSheet($('#mHost').value.trim());
  $('#mHow').onclick = howTo;
}
function pairSheet(host, port) {
  sheet(`<h2>ربط الشاشة</h2>
    <p class="sub">بالتلفزيون: الإعدادات ← خيارات المطوّر ← تصحيح الأخطاء اللاسلكي ← «ربط جهاز برمز إقران». اكتب الرمز اللي يطلع.</p>
    ${host ? '' : `<label class="f">عنوان الشاشة (IP)</label><input id="pHost" class="num" inputmode="decimal" placeholder="192.168.1.20">`}
    ${port ? '' : `<label class="f">منفذ الربط</label><input id="pPort" class="num" inputmode="numeric" placeholder="37000">`}
    <label class="f">رمز الربط</label><input id="pCode" class="num code6" inputmode="numeric" maxlength="6" placeholder="••••••">
    <button class="btn pri full" id="pGo" style="margin-top:14px">ربط واتصال</button>`);
  if (!port) {
    const f = host && foundBy('pair', host)[0];
    if (f) { port = f.port; const pe = $('#pPort'); if (pe) pe.closest && pe.remove(); }
  }
  setTimeout(() => $('#pCode') && $('#pCode').focus(), 300);
  $('#pGo').onclick = async () => {
    const h = host || ($('#pHost') && $('#pHost').value.trim()), p = port || ($('#pPort') && $('#pPort').value.trim()), c = $('#pCode').value.trim();
    if (!h || !p || c.length < 6) return toast('اكتب كل المعلومات');
    closeSheet(); busy('أربط الشاشة…');
    try {
      await run('pair', { host: h, port: +p, code: c });
      window.onProg('تم الربط، أدوّر على منفذ الاتصال…');
      let cp = (foundBy('connect', h)[0] || {}).port;
      if (!cp) cp = await new Promise(res => {
        const t = setTimeout(() => { window.__waitConnect = null; res(null); }, 9000);
        window.__waitConnect = o => { if (o.kind === 'connect' && o.host === h) { clearTimeout(t); window.__waitConnect = null; res(o.port); } };
        B.discover(true);
      });
      unbusy();
      if (!cp) { toast('تم الربط. اكتب منفذ الاتصال اللي يطلع بالتلفزيون'); addSheet(); $('#mHost').value = h; return; }
      connectTo(h, cp);
    } catch (e) { unbusy(); toast(errText(e)); }
  };
}
function howTo() {
  page('تفعيل تصحيح الأخطاء', `
  <div class="panel"><h2>أندرويد ١١ وأحدث (أغلب الشاشات الذكية)</h2>
  <ol class="sub" style="padding-inline-start:20px;margin:0">
  <li>الإعدادات ← النظام ← حول ← اضغط على «إصدار نظام التشغيل» ٧ مرات لحد ما يگلك صرت مطوّر.</li>
  <li>ارجع للإعدادات ← النظام ← خيارات المطوّر.</li>
  <li>فعّل «تصحيح الأخطاء اللاسلكي».</li>
  <li>اضغط «ربط جهاز برمز إقران»، والشاشة راح تطلع بالتطبيق جاهزة، بس اكتب الرمز.</li></ol></div>
  <div class="panel"><h2>أندرويد ٩ و١٠ (البوكسات وشاشات السيارات)</h2>
  <ol class="sub" style="padding-inline-start:20px;margin:0">
  <li>فعّل خيارات المطوّر بنفس الطريقة، وشغّل «تصحيح أخطاء USB» أو «ADB عبر الشبكة».</li>
  <li>بالتطبيق اختار إضافة شاشة واكتب الـ IP والمنفذ 5555.</li>
  <li>على التلفزيون تطلع رسالة سماح، اختار «السماح دائماً من هذا الكمبيوتر».</li></ol></div>`);
}

/* ============================================================ clean wizard */
const DB = {
  // ads & tracking: recommended
  'com.google.android.tvrecommendations': ['توصيات وإعلانات الواجهة', 'ads'],
  'com.google.android.leanbacklauncher.recommendations': ['توصيات الواجهة', 'ads'],
  'com.google.android.adservices.api': ['خدمة الإعلانات من گوگل', 'ads'],
  'com.google.android.feedback': ['إرسال تقارير الاستخدام', 'ads'],
  'com.android.tv.feedbackconsent': ['موافقة جمع البيانات', 'ads'],
  'com.google.android.partnersetup': ['إعدادات الشركاء والترويج', 'ads'],
  'com.google.android.apps.tv.dreamx': ['شاشة التوقف بالإعلانات', 'ads'],
  'com.google.android.backdrop': ['شاشة التوقف «الوضع المحيط»', 'ads'],
  'com.amazon.tv.ads': ['إعلانات', 'ads'],
  'com.tcl.ad': ['إعلانات الشركة المصنعة', 'ads'],
  'com.tcl.tvweishi': ['تتبّع الشركة المصنعة', 'ads'],
  'com.hisense.adservice': ['إعلانات الشركة المصنعة', 'ads'],
  'com.xiaomi.mitv.advertise': ['إعلانات الشركة المصنعة', 'ads'],
  'com.miui.systemAdSolution': ['إعلانات الشركة المصنعة', 'ads'],
  // bloat: optional
  'com.google.android.play.games': ['ألعاب گوگل', 'bloat'],
  'com.google.android.marvin.talkback': ['القارئ الصوتي', 'bloat'],
  'com.android.printspooler': ['خدمة الطباعة', 'bloat'],
  'com.android.bips': ['الطباعة المدمجة', 'bloat'],
  'com.android.dreams.basic': ['شاشة توقف أساسية', 'bloat'],
  'com.android.dreams.phototable': ['شاشة توقف الصور', 'bloat'],
  'com.android.providers.partnerbookmarks': ['إشارات الشركاء', 'bloat'],
  'com.google.android.onetimeinitializer': ['إعداد أول مرة', 'bloat'],
  'com.google.android.youtube.tvkids': ['يوتيوب أطفال', 'bloat'],
  'com.google.android.youtube.tvmusic': ['يوتيوب ميوزك', 'bloat'],
  'com.google.android.videos': ['أفلام گوگل', 'bloat'],
  'com.google.android.tv.frameworkpackagestubs': ['حزم وهمية', 'bloat'],
  'com.sdmc.facTest': ['فحص المصنع', 'bloat'],
  'com.android.gallery3d': ['المعرض القديم', 'bloat'],
};
const PROTECT = /^(android|com\.android\.(systemui|settings|tv\.settings|shell|phone|providers\..*|packageinstaller|inputmethod.*|vending|externalstorage|bluetooth|nfc|keychain|location.*|server.*|networkstack.*|wifi.*|permissioncontroller|webview|media.*|se|cts.*|tv\.(?!feedback).*)|com\.google\.android\.(gms|gsf|packageinstaller|inputmethod.*|leanback\.ime|katniss|tts|tv\.remote.*|apps\.mediashell|webview|ext\..*|permissioncontroller|networkstack.*|modulemetadata|configupdater|syncadapters.*|apps\.tv\.launcherx|tvlauncher)|com\.cleantv\..*|com\.moamal\..*|.*(dvb|dtv|tvinput|livetv|tvcenter|starsat|echolink|geant|satellite).*|com\.mediatek\..*|com\.amlogic\..*|com\.droidlogic\..*|com\.realtek\..*)$/;
const TWEAKS = [
  ['anim', 'تسريع الحركة بالواجهة', 'يخلي الانتقالات أسرع بالنص', true],
  ['dns', 'حجب الإعلانات من الإنترنت', 'يستخدم DNS يحجب مواقع الإعلانات والتتبع', true],
  ['trim', 'تنظيف الملفات المؤقتة', 'يمسح الكاش ويحرر مساحة', true],
  ['kill', 'إيقاف التطبيقات الشغالة بالخلفية', 'يحرر ذاكرة فوراً', true],
];
let W = { step: 1, pkgs: null, sel: {}, tw: {}, before: null, after: null };
const log = () => kv('log', []);
async function fixHome() {
  if (!need()) return;
  busy('أصلّح زر الهوم…');
  try {
    const pk = 'com.cleantv.launcher', svc = pk + '/' + pk + '.PowerService';
    const [has, acc, en] = await run('shs', { cmds: ['pm path ' + pk, 'settings get secure enabled_accessibility_services', 'pm list packages -e'] });
    if (!/package:/.test(has)) { unbusy(); return toast('واجهة مدير الشاشات مو منصّبة، نصّبها من التجهيز'); }
    const a = acc.trim(), list = !a || a === 'null' ? svc : a.includes(svc) ? a : a + ':' + svc;
    const g = ['com.google.android.tvlauncher', 'com.google.android.apps.tv.launcherx', 'com.google.android.leanbacklauncher'].filter(x => en.includes('package:' + x));
    await run('shs', { cmds: ['cmd package set-home-activity ' + pk + '/.MainActivity', 'settings put secure enabled_accessibility_services ' + list, 'settings put secure accessibility_enabled 1']
      .concat(g.map(x => 'pm disable-user --user 0 ' + x)).concat(['am start -n ' + pk + '/.MainActivity']) });
    if (g.length) addLog('إيقاف واجهة گوگل القديمة حتى زر الهوم يفتح الجديدة', g.map(x => 'pm enable ' + x));
    unbusy(); toast('تم ✓ جرّب زر الهوم هسه');
  } catch (e) { unbusy(); toast(errText(e)); }
}
function afterLauncher(r) { if (r && r.disabled && r.disabled.length) addLog('إيقاف واجهة گوگل القديمة حتى زر الهوم يفتح الجديدة', r.disabled.map(p => 'pm enable ' + p)); }
function addLog(title, undo) { const l = log(); l.unshift({ t: Date.now(), title, undo }); kvSet('log', l.slice(0, 200)); }

function renderClean() {
  const b = $('#cleanBody');
  const bar = `<div class="steps">${[1, 2, 3].map(i => `<div class="${i === W.step ? 'on' : i < W.step ? 'done' : ''}"></div>`).join('')}</div>`;
  if (W.step === 1 || !CONN.connected) {
    W.step = 1;
    b.innerHTML = bar + `<div class="panel"><h2>الخطوة الأولى: الاتصال</h2>
      ${CONN.connected ? `<div class="row"><span class="dot on"></span><b>${esc(tvName())}</b></div><p class="sub">متصل وجاهز.</p>
        <button class="btn pri full" id="w1">التالي: التنظيف</button>`
        : `<p class="sub">اتصل بالشاشة أول من صفحة «أجهزتي».</p><button class="btn pri full" id="w1c">روح لشاشاتي</button>`}</div>`;
    const n = $('#w1'); if (n) n.onclick = () => { W.step = 2; renderClean(); };
    const c = $('#w1c'); if (c) c.onclick = () => show('home');
    return;
  }
  if (W.step === 2) return renderStep2(b, bar);
  renderStep3(b, bar);
}
async function scanPkgs() {
  busy('أفحص التطبيقات…');
  try {
    const [en, dis, sys] = await run('shs', { cmds: ['pm list packages -e', 'pm list packages -d', 'pm list packages -s'] });
    const list = t => t.split('\n').map(s => s.replace('package:', '').trim()).filter(Boolean);
    const sysSet = new Set(list(sys)), home = (INFO && INFO.home || '').split('/')[0];
    const pk = [];
    list(en).forEach(p => pk.push({ p, on: true, sys: sysSet.has(p) }));
    list(dis).forEach(p => pk.push({ p, on: false, sys: sysSet.has(p) }));
    W.pkgs = pk.filter(x => !PROTECT.test(x.p) && x.p !== home);
    W.sel = {};
    W.pkgs.forEach(x => { if (x.on && DB[x.p] && DB[x.p][1] === 'ads') W.sel[x.p] = true; });
    TWEAKS.forEach(t => W.tw[t[0]] = t[3]);
    unbusy();
  } catch (e) { unbusy(); toast(errText(e)); }
}
async function renderStep2(b, bar) {
  if (!W.pkgs) { b.innerHTML = bar; await scanPkgs(); if (!W.pkgs) return; }
  const group = (title, note, arr) => arr.length ? `<h2>${title}</h2><p class="sub" style="margin-top:-6px">${note}</p><div class="list">` + arr.map(x => `
    <div class="item tap" data-p="${esc(x.p)}"><div class="check ${W.sel[x.p] ? 'on' : ''}">${ic('check')}</div>
    <div class="t"><b>${esc(DB[x.p] ? DB[x.p][0] : x.p.split('.').slice(-2).join('.'))}</b><small class="num">${esc(x.p)}</small></div>
    ${x.on ? '' : '<span class="tag warn">موقوف</span>'}</div>`).join('') + `</div>` : '';
  const ads = W.pkgs.filter(x => DB[x.p] && DB[x.p][1] === 'ads');
  const bloat = W.pkgs.filter(x => DB[x.p] && DB[x.p][1] === 'bloat');
  const other = W.pkgs.filter(x => !DB[x.p] && x.sys);
  b.innerHTML = bar + `<div class="panel"><h2>الخطوة الثانية: التسريع وإزالة الإعلانات</h2>
    <p class="sub" style="margin:0">اخترنالك الأشياء الآمنة. كل شي ينگدر يرجع من «سجل العمليات».</p></div>
    <h2>تحسينات</h2><div class="list">${TWEAKS.map(t => `<div class="item tap" data-tw="${t[0]}"><div class="t"><b>${t[1]}</b><small>${t[2]}</small></div><div class="toggle ${W.tw[t[0]] ? 'on' : ''}"></div></div>`).join('')}</div>
    ${group('الإعلانات والتتبع', 'ننصح بإيقافها', ads)}
    ${group('تطبيقات زايدة', 'اختياري، وقّف اللي ما تحتاجه', bloat)}
    ${other.length ? `<details><summary class="sub" style="margin:8px 0 12px;cursor:pointer">تطبيقات نظام ثانية (${other.length}) — بس إذا تعرف شنو تسوي</summary>${group('تطبيقات النظام', 'إيقاف الغلط ممكن يخرب ميزة بالشاشة', other)}</details>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn sec" id="wBack">رجوع</button><button class="btn pri" id="wApply">${ic('shield')} طبّق</button></div>`;
  b.onclick = e => {
    const p = e.target.closest('[data-p]'); if (p) { tap(); W.sel[p.dataset.p] = !W.sel[p.dataset.p]; p.querySelector('.check').classList.toggle('on'); return; }
    const t = e.target.closest('[data-tw]'); if (t) { tap(); W.tw[t.dataset.tw] = !W.tw[t.dataset.tw]; t.querySelector('.toggle').classList.toggle('on'); return; }
    if (e.target.closest('#wBack')) { W.step = 1; renderClean(); }
    if (e.target.closest('#wApply')) applyClean();
  };
}
async function applyClean() {
  busy('أنظّف الشاشة…');
  try {
    W.before = await run('info');
    const cmds = [], undo = [];
    for (const x of W.pkgs) {
      if (W.sel[x.p] && x.on) { cmds.push('pm disable-user --user 0 ' + x.p); undo.push('pm enable ' + x.p); }
      if (!W.sel[x.p] && !x.on && DB[x.p]) { /* left as is */ }
    }
    if (W.tw.anim) {
      const old = await run('shs', { cmds: ['settings get global window_animation_scale', 'settings get global transition_animation_scale', 'settings get global animator_duration_scale'] });
      ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'].forEach((k, i) => {
        cmds.push(`settings put global ${k} 0.5`);
        const v = old[i].trim(); undo.push(v === 'null' ? `settings delete global ${k}` : `settings put global ${k} ${v}`);
      });
    }
    if (W.tw.dns) {
      const [m, s] = await run('shs', { cmds: ['settings get global private_dns_mode', 'settings get global private_dns_specifier'] });
      cmds.push('settings put global private_dns_mode hostname', 'settings put global private_dns_specifier dns.adguard-dns.com');
      undo.push(m.trim() === 'null' ? 'settings put global private_dns_mode opportunistic' : 'settings put global private_dns_mode ' + m.trim());
      if (s.trim() !== 'null') undo.push('settings put global private_dns_specifier ' + s.trim());
    }
    if (W.tw.trim) cmds.push('pm trim-caches 999G');
    if (W.tw.kill) cmds.push('am kill-all');
    await run('shs', { cmds, progress: true });
    if (undo.length) addLog('تنظيف ' + tvName() + ' (' + Object.values(W.sel).filter(Boolean).length + ' تطبيق)', undo);
    await new Promise(r => setTimeout(r, 1500));
    W.after = await run('info'); INFO = W.after;
    unbusy(); W.step = 3; W.pkgs = null; renderClean(); showReport();
  } catch (e) { unbusy(); toast(errText(e)); }
}
function showReport() {
  const a = parseMem(W.before && W.before.mem), c = parseMem(W.after && W.after.mem);
  if (!a || !c) return;
  const row = (n, x, y, better) => `<span>${n}</span><span class="num sub">${x}</span><span class="num ${better ? 'up' : ''}">${y}</span>`;
  sheet(`<h2>تمت العملية ✓</h2><p class="sub">قبل وبعد التنظيف</p>
  <div class="report"><span class="h"></span><span class="h">قبل</span><span class="h">بعد</span>
  ${row('الذاكرة الفارغة', Math.round(a.avail / 1024) + 'MB', Math.round(c.avail / 1024) + 'MB', c.avail > a.avail)}
  ${row('العمليات الشغالة', esc(W.before.procs), esc(W.after.procs), +W.after.procs < +W.before.procs)}
  ${row('التطبيقات الموقوفة', esc(W.before.disabled), esc(W.after.disabled), +W.after.disabled > +W.before.disabled)}
  </div><button class="btn pri full" style="margin-top:18px" onclick="closeSheet()">التالي: الواجهة</button>`);
}
function renderStep3(b, bar) {
  const home = INFO && INFO.home || '';
  const homePkg = home.split('/')[0];
  const ours = homePkg === 'com.cleantv.launcher';
  b.innerHTML = bar + `<div class="panel"><h2>الخطوة الثالثة: الواجهة</h2>
    <p class="sub" style="margin:0">الواجهة الحالية: <b class="num">${esc(homePkg || 'غير معروفة')}</b></p></div>
    <div class="list">
      <div class="item tap" data-l="ready">${ic('layers')}<div class="t"><b>واجهة مدير الشاشات الجاهزة</b><small>عربية، ساعة وتاريخ هجري، مواعيد الصلاة والمباريات، ثيمات</small></div>${ours ? '<span class="tag">مثبّتة</span>' : ''}</div>
      <div class="item tap" data-l="gallery">${ic('layers')}<div class="t"><b>اختار من معرض الواجهات</b><small>تشوف الشكل والتفاصيل وتعدّل قبل ما تصدّر</small></div>${ic('left')}</div>
      <div class="item tap" data-l="car">${ic('tv')}<div class="t"><b>واجهة شاشة سيارة</b><small>عدّاد سرعة، موسيقى، تطبيقات السيارة، ونوع سيارتك</small></div>${ic('left')}</div>
      <div class="item tap" data-l="scratch">${ic('plus')}<div class="t"><b>صمّم واجهة من الصفر</b><small>اختار قالب، وعدّل كل جزء وشوفه قدامك قبل التثبيت</small></div>${ic('left')}</div>
      <div class="item tap" data-l="edit">${ic('layers')}<div class="t"><b>عدّل الواجهة الحالية</b><small>يجيب شكل الشاشة الحالي وتعدل عليه</small></div>${ic('left')}</div>
    </div>
    ${ours && W.oldHome && W.oldHome !== homePkg ? `<div class="panel"><h2>الواجهة القديمة</h2><p class="sub">تگدر توقف الواجهة القديمة (<span class="num">${esc(W.oldHome)}</span>) حتى زر الهوم ما يرجعها. بأجهزة البث خليها إذا بيها أدوات تحتاجها.</p>
      <button class="btn sec full" id="disOld">إيقاف الواجهة القديمة</button></div>` : ''}
    <button class="btn sec full" id="w3b">رجوع للتنظيف</button>`;
  b.onclick = async e => {
    if (e.target.closest('#w3b')) { W.step = 2; renderClean(); return; }
    if (e.target.closest('[data-l="scratch"]')) { show('design'); designNew(); return; }
    if (e.target.closest('[data-l="gallery"]')) { show('design'); openGallery(); return; }
    if (e.target.closest('[data-l="car"]')) {
      if (typeof setDevType === 'function' && devType() !== 'car') { setDevType('car'); brandSheet(() => { show('design'); carNew(); }); return; }
      show('design'); carNew(); return;
    }
    if (e.target.closest('[data-l="edit"]')) { show('design'); designFromTv(); return; }
    if (e.target.closest('[data-l="ready"]')) {
      busy('أنصب واجهة مدير الشاشات…');
      try {
        const r = await run('launcher'); afterLauncher(r);
        W.oldHome = (r.oldHome || '').split('/')[0];
        if (W.oldHome && W.oldHome !== 'com.cleantv.launcher') addLog('تثبيت واجهة مدير الشاشات', ['cmd package set-home-activity ' + r.oldHome]);
        INFO = await run('info'); unbusy(); toast('تم تثبيت الواجهة ' + (r.tag || '')); renderClean();
      } catch (er) { unbusy(); toast(errText(er)); }
    }
    if (e.target.closest('#disOld')) {
      try { await sh('pm disable-user --user 0 ' + W.oldHome); addLog('إيقاف الواجهة القديمة', ['pm enable ' + W.oldHome]); toast('توقفت الواجهة القديمة'); W.oldHome = null; renderClean(); }
      catch (er) { toast(errText(er)); }
    }
  };
}

/* ============================================================ remote */
const K = { up: 19, down: 20, left: 21, right: 22, ok: 23, back: 4, home: 3, menu: 82, power: 26, play: 85, mute: 164, vup: 24, vdn: 25, chup: 166, chdn: 167, settings: 176, apps: 284 };
function key(n) { if (!CONN.connected) return need(); tap(); run('key', { code: K[n] }).catch(e => toast(errText(e))); }
function renderRemote() {
  $('#kbBtn').innerHTML = ic('kb');
  if (!$('#liveBtn')) { const lb = document.createElement('button'); lb.className = 'iconbtn'; lb.id = 'liveBtn'; lb.setAttribute('aria-label', 'مشاهدة الشاشة'); lb.innerHTML = ic('live'); lb.onclick = openLive; $('#kbBtn').before(lb); }
  $('#kbBtn').onclick = () => {
    if (!need()) return;
    sheet(`<h2>كتابة على الشاشة</h2><p class="sub">ينكتب بالمكان المحدد بالتلفزيون. (الأحرف الإنگليزية والأرقام)</p>
      <input id="kbT" dir="auto" placeholder="اكتب هنا"><div class="row" style="margin-top:12px"><button class="btn sec" id="kbE">إدخال ↵</button><button class="btn pri" id="kbS">إرسال</button></div>`);
    $('#kbS').onclick = () => { const t = $('#kbT').value; if (!t) return; run('text', { t }).then(() => { $('#kbT').value = ''; toast('انكتب'); }).catch(e => toast(errText(e))); };
    $('#kbE').onclick = () => run('key', { code: 66 });
    setTimeout(() => $('#kbT').focus(), 300);
  };
  $('#remoteBody').innerHTML = `
    <div class="dial">
      <button class="u" data-k="up" aria-label="فوق">${ic('up')}</button>
      <button class="d" data-k="down" aria-label="جوه">${ic('down')}</button>
      <button class="l" data-k="left" aria-label="يسار">${ic('left')}</button>
      <button class="r" data-k="right" aria-label="يمين">${ic('right')}</button>
      <button class="ok" data-k="ok">موافق</button>
    </div>
    <div class="keys">
      <button class="key" data-k="back">${ic('ret')}رجوع</button>
      <button class="key" data-k="home">${ic('home')}الرئيسية</button>
      <button class="key" data-k="menu">${ic('menu')}القائمة</button>
      <button class="key power" data-k="power">${ic('power')}تشغيل</button>
    </div>
    <div class="rockers">
      <div class="rocker"><button data-k="vup">${ic('plus')}</button><span>الصوت</span><button data-k="vdn">${ic('down')}</button></div>
      <div class="rocker"><button data-k="chup">${ic('up')}</button><span>القناة</span><button data-k="chdn">${ic('down')}</button></div>
      <div style="display:grid;gap:10px">
        <button class="key" data-k="play" style="height:auto">${ic('play')}تشغيل/إيقاف</button>
        <button class="key" data-k="mute" style="height:auto">${ic('mute')}كتم</button>
      </div>
    </div>
    ${CONN.connected ? `<p class="sub" style="margin:0">تتحكم بـ ${esc(tvName())}</p>` : `<p class="sub" style="margin:0">اتصل بشاشة حتى يشتغل الريموت</p>`}`;
  $('#remoteBody').onclick = e => { const k = e.target.closest('[data-k]'); if (k) key(k.dataset.k); };
}

/* ============================================================ screen tools */
function openLive() { if (!need()) return; B.live(); }
async function quickShot() {
  if (!need()) return;
  busy('آخذ صورة من الشاشة…');
  try {
    const img = await run('shot', { w: 1280, q: 85 });
    unbusy();
    sheet(`<h2>صورة الشاشة</h2><div class="bezel"><img src="${img}" alt="صورة شاشة التلفزيون"></div>
      <p class="sub" style="margin-top:10px">التطبيقات المحمية (مثل نتفلكس وشاهد) تطلع سودة، هذا من حماية التطبيق نفسه.</p>
      <div class="row" style="margin-top:12px"><button class="btn pri" id="shSave">${ic('save')} حفظ بالمعرض</button><button class="btn sec" id="shAgain">${ic('refresh')} صورة ثانية</button></div>`);
    $('#shSave').onclick = async () => { try { toast('انحفظت ← ' + await run('saveShot')); } catch (e) { toast(errText(e)); } };
    $('#shAgain').onclick = () => { closeSheet(); quickShot(); };
  } catch (e) { unbusy(); toast(errText(e)); }
}
let castPoll = null;
window.onCast = (ok, msg) => {
  if (!ok) { closeSheet(); if (msg) toast('ما بدأ العرض: ' + msg); return; }
  castStatus();
};
function castStatus() {
  sheet(`<h2>عرض موبايلك على الشاشة</h2><div class="row" style="margin:6px 0 14px"><span class="dot" id="csDot"></span><b id="csT">أبدي…</b></div>
    <p class="sub" id="csS"></p><button class="btn bad full" id="csStop">إيقاف العرض</button>`);
  $('#csStop').onclick = () => { B.cast(false); clearInterval(castPoll); closeSheet(); toast('وقف العرض'); };
  clearInterval(castPoll);
  let t0 = Date.now();
  castPoll = setInterval(() => {
    if (!$('#csT')) { clearInterval(castPoll); return; }
    const st = JSON.parse(B.castState());
    if (st.error) { clearInterval(castPoll); $('#csT').textContent = 'توقف العرض'; $('#csS').textContent = st.error; $('#csStop').textContent = 'إغلاق'; return; }
    if (!st.on) { if (Date.now() - t0 > 8000) { clearInterval(castPoll); $('#csT').textContent = 'ما اشتغل العرض'; $('#csS').textContent = 'جرّب مرة ثانية، واختار «الشاشة كاملة» إذا الموبايل سألك.'; } return; }
    if (st.stage === 'connecting') { $('#csT').textContent = 'أتصل بالشاشة…'; return; }
    $('#csDot').classList.add('on');
    $('#csT').textContent = 'شغّال الآن';
    $('#csS').textContent = st.frames > 0 ? `انرسلت ${st.frames} صورة للشاشة. اطلع من التطبيق وكل شي بموبايلك يبين على التلفزيون. للإيقاف: رجوع بريموت التلفزيون، أو من الإشعار.`
      : 'أنتظر أول صورة… حرّك شي بشاشة الموبايل.';
  }, 1000);
}
async function castToggle() {
  if (!need()) return;
  const st = JSON.parse(B.castState());
  if (st.on) { castStatus(); return; }
  busy('أجهّز الشاشة للعرض…');
  try { await run('castPrep'); unbusy(); }
  catch (e) {
    unbusy();
    if (e.message === 'OLD') return needLauncherSheet('عرض الموبايل يحتاج واجهة مدير الشاشات النسخة الجديدة على التلفزيون. نصّبها أو حدّثها وبعدين جرب مرة ثانية.', castToggle);
    if (e.message === 'NOPORT') return toast('الشاشة ما فتحت باب العرض. طفّي التلفزيون وشغله وجرب مرة ثانية');
    return toast(errText(e));
  }
  sheet(`<h2>عرض شاشة موبايلك على التلفزيون</h2>
    <p class="sub">الشاشة جاهزة ✓ كل شي بموبايلك راح يطلع على التلفزيون (بدون صوت).</p>
    <p class="sub">بعد ما تضغط «ابدأ» الموبايل يسألك، اختار <b>الشاشة كاملة</b> وبعدين <b>ابدأ</b>.</p>
    <button class="btn pri full" id="cGo">${ic('screen')} ابدأ العرض</button>`);
  $('#cGo').onclick = () => { closeSheet(); B.cast(true); };
}
async function quickClean() {
  if (!need()) return;
  busy('تنظيف سريع…');
  try {
    const before = parseMem((await run('info')).mem);
    await run('shs', { cmds: ['pm trim-caches 999G', 'am kill-all'] });
    await new Promise(r => setTimeout(r, 1200));
    INFO = await run('info'); const after = parseMem(INFO.mem);
    unbusy();
    toast(before && after ? `تحررت ${Math.max(0, Math.round((after.avail - before.avail) / 1024))} ميگا من الذاكرة` : 'تم التنظيف');
    RENDER[cur] && RENDER[cur]();
  } catch (e) { unbusy(); toast(errText(e)); }
}

/* ============================================================ more */
function renderMore() {
  const s = SESSION || {};
  const th = kv('theme', { dark: true, ac: ACCENTS[0][0] });
  $('#moreBody').innerHTML = `
    <div class="panel"><div class="row">${ic('user')}<div style="flex:1"><b>${esc(s.user)}</b>
      <div class="sub">${s.expAt ? 'ينتهي الاشتراك ' + fmtDate(s.expAt) : 'اشتراك دائم'}</div></div></div></div>
    ${s.admin ? `<div class="list"><div class="item tap" data-m="admin">${ic('key')}<div class="t"><b>إدارة الحسابات</b><small>توليد حسابات وإحصائيات</small></div>${ic('left')}</div></div>` : ''}
    <h2>الشاشة</h2><div class="list">
      <div class="item tap" data-m="apps">${ic('apps')}<div class="t"><b>تطبيقات الشاشة</b><small>فتح، إيقاف، حذف</small></div>${ic('left')}</div>
      <div class="item tap" data-m="install">${ic('plus')}<div class="t"><b>تثبيت تطبيق من الموبايل</b><small>اختار ملف APK</small></div>${ic('left')}</div>
      <div class="item tap" data-m="send">${ic('file')}<div class="t"><b>إرسال ملف للشاشة</b><small>يروح للتنزيلات وتگدر تفتحه على الشاشة مباشرة</small></div>${ic('left')}</div>
      <div class="item tap" data-m="files">${ic('file')}<div class="t"><b>مدير الملفات</b><small>ملفات الشاشة أو السيارة: افتح، أرسل، نزّل، غيّر الاسم، احذف</small></div>${ic('left')}</div>
      <div class="item tap" data-m="store">${ic('apps')}<div class="t"><b>متجر التطبيقات المختارة</b><small>تطبيقات موثوقة تنصبها بضغطة</small></div>${ic('left')}</div>
      <div class="item tap" data-m="health">${ic('chart')}<div class="t"><b>فحص الشاشة</b><small>الذاكرة، المساحة، الحرارة، قوة الواي فاي</small></div>${ic('left')}</div>
      <div class="item tap" data-m="backup">${ic('save')}<div class="t"><b>نسخة احتياطية واسترجاع</b><small>احفظ إعدادات الشاشة ورجّعها وقت ما تريد</small></div>${ic('left')}</div>
      <div class="item tap" data-m="home">${ic('home')}<div class="t"><b>تصليح زر الهوم</b><small>إذا الهوم يرجّع الواجهة القديمة</small></div>${ic('left')}</div>
      <div class="item tap" data-m="log">${ic('undo')}<div class="t"><b>سجل العمليات والتراجع</b><small>رجّع أي تغيير سويته</small></div>${ic('left')}</div>
    </div>
    <h2>التحديثات</h2><div class="list">
      <div class="item tap" data-m="updates">${ic('refresh')}<div class="t"><b>التحديثات المباشرة</b><small>تحديث التطبيق وواجهة الشاشة</small></div>${ic('left')}</div>
      <div class="item tap" data-m="news">${ic('info')}<div class="t"><b>شنو الجديد بالنسخة ${esc(B.version())}</b></div>${ic('left')}</div>
    </div>
    <h2>المظهر</h2><div class="panel">
      <div class="item tap" data-m="dark" style="padding:0 0 14px;min-height:0">${ic('sun')}<div class="t"><b>الوضع الداكن</b></div><div class="toggle ${th.dark ? 'on' : ''}"></div></div>
      <div class="sub" style="margin-bottom:10px">لون التطبيق</div>
      <div class="chips">${ACCENTS.map(([c, n]) => `<button class="sw ${th.ac === c ? 'on' : ''}" data-ac="${c}" style="background:${c}" aria-label="${n}"></button>`).join('')}</div>
    </div>
    <h2>الدعم</h2><div class="list">
      <div class="item tap" data-m="contact">${ic('chat')}<div class="t"><b>تواصل معنا أو بلّغ عن مشكلة</b><small>تيليگرام @KMK3993 · إنستغرام @HN_45Y</small></div>${ic('left')}</div>
      <div class="item tap" data-m="how">${ic('info')}<div class="t"><b>شلون أفعّل تصحيح الأخطاء؟</b></div>${ic('left')}</div>
    </div>
    <button class="btn bad full" data-m="logout">${ic('logout')} تسجيل خروج</button>
    <p class="sub" style="text-align:center;margin-top:14px">النسخة <span class="num">${esc(B.version())}</span></p>`;
  $('#moreBody').onclick = e => {
    const ac = e.target.closest('[data-ac]');
    if (ac) { const t = kv('theme', { dark: true }); t.ac = ac.dataset.ac; kvSet('theme', t); applyTheme(); renderMore(); return; }
    const m = e.target.closest('[data-m]'); if (!m) return; tap();
    const k = m.dataset.m;
    if (k === 'dark') { const t = kv('theme', { dark: true, ac: ACCENTS[0][0] }); t.dark = !t.dark; kvSet('theme', t); applyTheme(); renderMore(); }
    if (k === 'contact') contactSheet();
    if (k === 'how') howTo();
    if (k === 'log') openLog();
    if (k === 'apps') openApps();
    if (k === 'admin') openAdmin();
    if (k === 'files') openFiles('/sdcard/Download');
    if (k === 'home') fixHome();
    if (k === 'store') openStore();
    if (k === 'health') openHealth();
    if (k === 'backup') openBackup();
    if (k === 'updates') openUpdates();
    if (k === 'news') openNews();
    if (k === 'install' || k === 'send') {
      if (!need()) return;
      busy(k === 'install' ? 'أثبّت التطبيق…' : 'أرسل الملف…');
      run('pick', { mode: k === 'install' ? 'install' : 'push' })
        .then(r => { unbusy(); if (k === 'install') toast('تم تثبيت ' + r); else afterSend(r); })
        .catch(er => { unbusy(); if (er.message !== 'CANCEL') toast(errText(er)); });
    }
    if (k === 'logout') { B.logout(); SESSION = null; show('login'); }
  };
}
function openLog() {
  const l = log();
  page('سجل العمليات', l.length ? `<div class="list">` + l.map((x, i) => `<div class="item"><div class="t"><b>${esc(x.title)}</b><small>${fmtDate(x.t)}</small></div>
    ${x.done ? '<span class="tag">رجعت</span>' : `<button class="btn sec" style="min-height:38px" data-u="${i}">${ic('undo')} تراجع</button>`}</div>`).join('') + `</div>`
    : `<div class="empty">ما سويت أي تغيير بعد</div>`, el => {
    el.onclick = async e => {
      const u = e.target.closest('[data-u]'); if (!u || !need()) return;
      const all = log(), x = all[+u.dataset.u];
      busy('أرجّع التغيير…');
      try { await run('shs', { cmds: x.undo }); x.done = true; kvSet('log', all); unbusy(); toast('رجع مثل ما كان'); openLog(); }
      catch (er) { unbusy(); toast(errText(er)); }
    };
  });
}
async function openApps() {
  if (!need()) return;
  busy('أجيب التطبيقات…');
  let rows;
  try {
    const [u, d] = await run('shs', { cmds: ['pm list packages -3', 'pm list packages -d'] });
    const dis = new Set(d.split('\n').map(s => s.replace('package:', '').trim()));
    rows = u.split('\n').map(s => s.replace('package:', '').trim()).filter(Boolean).sort().map(p => ({ p, off: dis.has(p) }));
    unbusy();
  } catch (e) { unbusy(); return toast(errText(e)); }
  page('تطبيقات الشاشة', `<p class="sub">التطبيقات اللي منصّبة على الشاشة (${rows.length})</p><div class="list">` + rows.map(r => `
    <div class="item tap" data-a="${esc(r.p)}">${ic('apps')}<div class="t"><b>${esc(r.p.split('.').slice(-1)[0])}</b><small class="num">${esc(r.p)}</small></div>${r.off ? '<span class="tag warn">موقوف</span>' : ''}</div>`).join('') + `</div>`, el => {
    el.onclick = e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      const p = a.dataset.a, r = rows.find(x => x.p === p);
      sheet(`<h2 class="num" style="direction:ltr;text-align:right">${esc(p)}</h2>
        <button class="btn pri full" data-x="open">فتح على الشاشة</button><div style="height:10px"></div>
        <button class="btn sec full" data-x="tog">${r.off ? 'تشغيل التطبيق' : 'إيقاف التطبيق'}</button><div style="height:10px"></div>
        <button class="btn bad full" data-x="del">${ic('trash')} حذف التطبيق</button>`);
      $('#sheetBody').onclick = async ev => {
        const x = ev.target.closest('[data-x]'); if (!x) return;
        try {
          if (x.dataset.x === 'open') { await sh('monkey -p ' + p + ' -c android.intent.category.LEANBACK_LAUNCHER 1 || monkey -p ' + p + ' 1'); toast('انفتح'); closeSheet(); }
          if (x.dataset.x === 'tog') {
            if (r.off) { await sh('pm enable ' + p); r.off = false; addLog('تشغيل ' + p, ['pm disable-user --user 0 ' + p]); }
            else { await sh('pm disable-user --user 0 ' + p); r.off = true; addLog('إيقاف ' + p, ['pm enable ' + p]); }
            closeSheet(); toast('تم'); openApps();
          }
          if (x.dataset.x === 'del') {
            if (x.dataset.sure !== '1') { x.dataset.sure = '1'; x.innerHTML = 'متأكد؟ اضغط مرة ثانية للحذف'; return; }
            const out = await sh('pm uninstall ' + p); closeSheet(); toast(/Success/.test(out) ? 'انحذف' : out); openApps();
          }
        } catch (er) { toast(errText(er)); }
      };
    };
  });
}

/* ============================================================ admin */
const DURS = [[7, 'أسبوع'], [30, 'شهر'], [90, '٣ أشهر'], [180, '٦ أشهر'], [365, 'سنة'], [0, 'مدى الحياة']];
function openAdmin() {
  const acc = kv('issued', []);
  const now = Date.now();
  const active = acc.filter(a => !a.exp || a.exp > now).length;
  let dur = 30;
  page('إدارة الحسابات', `
    <div class="stats" style="margin:0 0 14px">
      <div class="stat"><b class="num">${acc.length}</b><small>كل الحسابات</small></div>
      <div class="stat"><b class="num">${active}</b><small>فعّالة</small></div>
      <div class="stat"><b class="num">${acc.length - active}</b><small>منتهية</small></div>
    </div>
    <div class="list"><div class="item tap" id="ghLink">${ic('layers')}<div class="t"><b>معرض الواجهات</b><small>${kv('ghToken', '') ? 'مربوط ✓ تگدر تنشر واجهات للمشتركين' : 'اربطه حتى تنشر واجهات للمشتركين'}</small></div>${ic('left')}</div></div>
    <div class="panel"><h2>حساب جديد</h2>
      <label class="f">رمز جهاز الشخص</label><input id="gCode" class="num" placeholder="XXXX-XXXX" autocapitalize="characters">
      <label class="f">اسم المستخدم</label><input id="gUser" autocapitalize="off" placeholder="مثلاً ali">
      <label class="f">المدة</label><div class="chips" id="gDur">${DURS.map(([d, n]) => `<button class="chip ${d === dur ? 'on' : ''}" data-d="${d}">${n}</button>`).join('')}</div>
      <button class="btn pri full" id="gGo" style="margin-top:16px">${ic('key')} سوّي الحساب</button>
      <div id="gRes"></div></div>
    <div class="panel" style="margin-top:14px"><h2 style="margin-top:0">🚗 تفعيل «مدير الشاشات أوتو»</h2>
      <p class="sub" style="margin-top:-4px">اشتراك مرة وحدة مدى الحياة. الصق رمز الجهاز اللي يطلع بتطبيق أوتو عند الشخص.</p>
      <input id="auCode" class="num" placeholder="XXXX-XXXX" autocapitalize="characters">
      <button class="btn pri full" id="auGo" style="margin-top:12px">${ic('key')} طلّع كود التفعيل</button><div id="auRes"></div></div>
    <h2>الحسابات اللي سويتها</h2>
    <div class="list">${acc.length ? acc.map(a => `<div class="item"><div class="t"><b>${esc(a.user)} <span class="sub num">${esc(a.code)}</span></b>
      <small>${a.exp ? (a.exp > now ? 'ينتهي ' : 'انتهى ') + fmtDate(a.exp) : 'مدى الحياة'}${a.note ? ' · ' + esc(a.note) : ''}</small></div>
      <span class="tag ${a.exp && a.exp <= now ? 'bad' : ''}">${a.exp && a.exp <= now ? 'منتهي' : 'فعّال'}</span></div>`).join('') : '<div class="empty">ما سويت حسابات بعد</div>'}</div>`, el => {
    $('#ghLink').onclick = () => ghTokenSheet(() => openAdmin());
    $('#auGo').onclick = () => {
      const code = $('#auCode').value.trim().toUpperCase();
      if (!/^[0-9A-Z]{4}-?[0-9A-Z]{4}$/.test(code)) return toast('رمز الجهاز لازم يكون ٨ أحرف');
      const k = B.genAuto ? B.genAuto(code) : '';
      if (!k) return toast('حدّث التطبيق أو سجّل كمدير');
      const list = kv('issuedAuto', []); list.unshift({ code, k, at: Date.now() }); kvSet('issuedAuto', list.slice(0, 200));
      const msg = `كود تفعيل «مدير الشاشات أوتو»\n${k}\nمدى الحياة، ويشتغل على موبايلك بس.`;
      $('#auRes').innerHTML = `<div class="genres"><div class="sub">كود التفعيل</div><b class="num">${esc(k)}</b>
        <div class="row" style="margin-top:12px"><button class="btn sec" id="auCp">${ic('copy')} نسخ</button><button class="btn pri" id="auSh">مشاركة</button></div></div>`;
      $('#auCp').onclick = () => { B.copy(msg); toast('انسخ'); };
      $('#auSh').onclick = () => B.share(msg);
    };
    $('#gDur').onclick = e => { const c = e.target.closest('[data-d]'); if (!c) return; dur = +c.dataset.d; $('#gDur').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); };
    $('#gGo').onclick = () => {
      const code = $('#gCode').value.trim().toUpperCase(), user = $('#gUser').value.trim();
      if (!/^[0-9A-Z]{4}-?[0-9A-Z]{4}$/.test(code)) return toast('رمز الجهاز لازم يكون ٨ أحرف');
      if (!user) return toast('اكتب اسم المستخدم');
      const pw = B.gen(code, user, dur);
      if (!pw) return toast('ما مسموح');
      const exp = dur ? Date.now() + dur * 86400000 : 0;
      const list = kv('issued', []); list.unshift({ user, code, pw, exp, at: Date.now(), dur }); kvSet('issued', list);
      const msg = `حسابك بتطبيق «مدير الشاشة»\nاسم المستخدم: ${user}\nكلمة المرور: ${pw}\nالمدة: ${DURS.find(d => d[0] === dur)[1]}\nالحساب يشتغل على موبايلك بس.`;
      $('#gRes').innerHTML = `<div class="genres"><div class="sub">اسم المستخدم</div><b>${esc(user)}</b><div class="sub" style="margin-top:6px">كلمة المرور</div><b class="num">${esc(pw)}</b>
        <div class="row" style="margin-top:12px"><button class="btn sec" id="gCp">${ic('copy')} نسخ</button><button class="btn pri" id="gSh">مشاركة</button></div></div>`;
      $('#gCp').onclick = () => { B.copy(msg); toast('انسخ'); };
      $('#gSh').onclick = () => B.share(msg);
    };
  });
}

/* ============================================================ boot */
const RENDER = { home: renderHome, clean: renderClean, remote: renderRemote, more: renderMore };
/* start once every script has loaded (the later files extend these screens) */
function boot() {
  initLogin();
  const s = JSON.parse(B.session());
  if (s.ok) enter(s);
  else { show('login'); if (s.msg) $('#lerr').textContent = s.msg; }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);

/* ============================================================ browser mock (for design preview only) */
function mockBridge() {
  const store = {};
  return {
    code: () => 'K7QM-2XRA', session: () => JSON.stringify(store.s || { ok: false }),
    login: (u) => { store.s = { ok: true, user: u, admin: u === 'demo-admin', expAt: Date.now() + 30 * 864e5 }; return JSON.stringify(store.s); },
    logout: () => { store.s = null; }, gen: () => 'ABCDE-FGHJK',
    kvGet: k => store[k] || null, kvSet: (k, v) => { store[k] = v; },
    open: () => {}, copy: () => {}, share: () => {}, toast: () => {}, vibe: () => {}, bars: () => {}, version: () => '2.0', exit: () => {},
    build: () => 3, live: () => {}, cast: () => {}, castState: () => '{"on":false}', assetList: () => '[]', asset: () => null,
    discover: () => setTimeout(() => window.onFound && onFound({ kind: 'pair', name: 'adb-GD1-x7Qz1a', host: '192.168.1.42', port: 37115 }), 400),
    run: (id, op, args) => setTimeout(() => {
      const R = { shareStart: { ips: [{ ip: "192.168.43.1", hot: true }, { ip: "10.0.0.5", hot: false }], port: 8080 },
        status: { connected: true, host: '192.168.1.42', port: 41233 }, connect: { connected: true, host: '192.168.1.42', port: 41233 },
        info: { brand: 'Dcolor', model: 'GD1 4K', android: '14', name: 'تلفاز الصالة', mem: 'MemTotal: 2000000 kB\nMemAvailable: 820000 kB', pkgs: '142', disabled: '9', procs: '210', home: 'com.google.android.tvlauncher/.MainActivity' },
        cfgGet: '{"settings":{"theme":"karbala"},"layout":{}}', release: { num: 5, tag: 'studio-5' },
        shs: ['package:com.google.android.tvrecommendations\npackage:com.google.android.feedback\npackage:com.android.printspooler\npackage:com.netflix.ninja', 'package:com.android.dreams.basic', 'package:com.google.android.tvrecommendations\npackage:com.google.android.feedback\npackage:com.android.printspooler\npackage:com.android.dreams.basic'],
      };
      if (op === 'gallery' && window.__MOCK_GAL) return window.__cb(id, true, window.__MOCK_GAL);
      if (op === 'dl' && window.__MOCK_DL) return window.__cb(id, true, window.__MOCK_DL(JSON.parse(args || '{}').url));
      window.__cb(id, true, R[op] !== undefined ? R[op] : true);
    }, 200),
  };
}
