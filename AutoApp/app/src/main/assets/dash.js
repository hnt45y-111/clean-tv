/* The car dashboard. On the car it talks to the phone through CarB; inside the phone app's preview it gets its data by postMessage. */
const CAR = typeof window.CarB !== 'undefined';
const $ = s => document.querySelector(s);
let CFG = cleanCfg(null), PHOTO = '', NOW = {}, INFO = {}, PAGE = 0, PREVIEW_ACTIVE = true;

const AR = '٠١٢٣٤٥٦٧٨٩';
const dg = s => CFG.digits === 'ar' ? String(s).replace(/\d/g, d => AR[d]) : String(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  prev: '<path d="M19 20 9 12l10-8v16zM5 19V5"/>', next: '<path d="m5 4 10 8-10 8V4zM19 5v14"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>', pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor"/>',
  pin: '<path d="M12 22s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  bat: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/>', bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z"/>',
  rain: '<path d="M16 13v8M8 13v8M12 15v8M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 4 15.3"/>', storm: '<path d="M19 16.9A5 5 0 0 0 18 7h-1.3a8 8 0 1 0-11.7 9M13 11l-4 6h6l-4 6"/>',
  snow: '<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>', fog: '<path d="M3 10h18M5 14h14M7 18h10M4 6h16"/>'
};
const svg = (k, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24">${P[k] || ''}</svg>`;

function wIcon(w) {
  const c = w.c, day = w.day !== 0;
  if (c === 0 || c === 1) return day ? 'sun' : 'moon';
  if (c <= 3) return 'cloud'; if (c <= 48) return 'fog'; if (c <= 67 || (c >= 80 && c <= 82)) return 'rain';
  if (c <= 77 || c === 85 || c === 86) return 'snow'; return 'storm';
}

/* ------------------------------------------------------------ data */
function load() {
  if (CAR) {
    try { CFG = cleanCfg(JSON.parse(CarB.cfg() || '{}')); } catch (e) { CFG = cleanCfg(null); }
    PHOTO = CFG.wall.type === 'photo' ? CarB.wall() : '';
    $('#lock').classList.toggle('on', !CarB.active());
  } else $('#lock').classList.toggle('on', !PREVIEW_ACTIVE);
}
function poll() {
  if (!CAR) return;
  try { NOW = JSON.parse(CarB.now()); } catch (e) { NOW = {}; }
  try { INFO = JSON.parse(CarB.info()); } catch (e) { INFO = {}; }
}

/* ------------------------------------------------------------ layout */
function shape() {
  const r = innerWidth / Math.max(1, innerHeight);
  document.body.className = (r >= 1.9 ? 'wide' : r >= 1.2 ? 'land' : 'port') + ' st-' + CFG.clock;
}
function theme() {
  const t = CFG.theme, s = document.documentElement.style;
  s.setProperty('--ac', t.ac); s.setProperty('--bg', t.bg); s.setProperty('--ink', t.ink); s.setProperty('--mute', t.mute);
  s.setProperty('--panel', t.panel); s.setProperty('--r', t.radius + 'vmin');
  s.setProperty('--fd', t.font === 'Tj' ? 'Tj' : t.font === 'Plex' ? 'Plex' : 'Alx');
  s.setProperty('--shade', CFG.wall.type === 'photo' ? Math.max(.25, CFG.shade) : CFG.shade);
  const light = parseInt(t.bg.slice(1, 3), 16) + parseInt(t.bg.slice(3, 5), 16) + parseInt(t.bg.slice(5, 7), 16) > 400;
  s.setProperty('--line', light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.1)');
  $('#wall').style.background = wallCSS(CFG.wall, PHOTO);
  $('#wall').style.backgroundSize = 'cover'; $('#wall').style.backgroundPosition = 'center';
  $('#app').classList.toggle('flip', !!CFG.flip);
  $('#media').style.display = CFG.show.media ? '' : 'none';
}

/* ------------------------------------------------------------ clock card */
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
function renderClock() {
  const d = new Date();
  let hh = d.getHours(), ap = '';
  if (!CFG.h24) { ap = hh < 12 ? 'ص' : 'م'; hh = hh % 12 || 12; }
  const mm = String(d.getMinutes()).padStart(2, '0');
  const chips = [];
  if (CFG.show.weather && INFO.weather) chips.push(`<div class="chip">${svg(wIcon(INFO.weather))}<b>${dg(INFO.weather.t)}°</b></div>`);
  if (CFG.show.battery && INFO.bat >= 0) chips.push(`<div class="chip">${svg(INFO.charging ? 'bolt' : 'bat')}<b>${dg(INFO.bat)}%</b></div>`);
  const spd = CFG.show.speed && INFO.loc !== false ? `<div class="spd"><b>${dg(Math.max(0, INFO.speed || 0))}</b><span>كم/س</span></div>` : '';
  $('#clock').innerHTML = `<div>
      ${CFG.greet ? `<div class="greet">${esc(CFG.greet)}</div>` : ''}
      <div class="time">${dg(hh)}:${dg(mm)}${ap ? `<small>${ap}</small>` : ''}</div>
      ${CFG.show.date ? `<div class="date">${DAYS[d.getDay()]} ${dg(d.getDate())} ${MONTHS[d.getMonth()]}</div>` : ''}
    </div>
    <div>${spd}${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
      ${CFG.brand ? `<div class="brand" style="margin-top:2vmin">${esc(CFG.brand)}</div>` : ''}</div>`;
}

/* ------------------------------------------------------------ music card */
let lastMediaKey = '';
function renderMedia() {
  if (!CFG.show.media) return;
  let key, html;
  if (NOW.perm === false) {
    key = 'perm'; html = `<div class="art">${svg('music')}</div><div class="mi"><div class="mt">الموسيقى</div><div class="hint">اسمح للتطبيق يشوف الموسيقى من الموبايل، من صفحة «التشغيل على السيارة».</div></div>`;
  } else if (!NOW.title) {
    key = 'none'; html = `<div class="art">${svg('music')}</div><div class="mi"><div class="mt">ماكو شي يشتغل</div><div class="hint">شغّل موسيقى، أو اضغط تطبيق من الاختصارات.</div></div>`;
  } else {
    key = [NOW.pkg, NOW.title, NOW.artist, NOW.playing, NOW.art ? 1 : 0].join('|');
    html = `<div class="art" style="${NOW.art ? `background-image:url('${NOW.art}')` : ''}">${NOW.art ? '' : svg('music')}</div>
      <div class="mi"><div class="mapp">${esc(NOW.app || '')}</div><div class="mt">${esc(NOW.title)}</div><div class="ma">${esc(NOW.artist || '')}</div>
        <div class="bar"><i id="mbar"></i></div>
        <div class="ctl"><button data-act="media:prev">${svg('prev')}</button><button class="pp" data-act="media:toggle">${svg(NOW.playing ? 'pause' : 'play')}</button><button data-act="media:next">${svg('next')}</button></div></div>`;
  }
  if (key !== lastMediaKey) { $('#media').innerHTML = html; lastMediaKey = key; }
  const b = $('#mbar'); if (b && NOW.dur > 0) b.style.width = Math.min(100, NOW.pos / NOW.dur * 100) + '%';
}

/* ------------------------------------------------------------ shortcuts card */
function per() {
  const el = $('#tiles'), u = Math.min(innerWidth, innerHeight) / 100;
  const w = el.clientWidth - 5 * u, h = el.clientHeight - 13 * u, size = 21 * u;
  const cols = Math.max(1, Math.floor(w / size)), rows = Math.max(1, Math.floor(h / size));
  return { cols, rows, n: cols * rows };
}
function renderTiles() {
  const t = CFG.tiles, el = $('#tiles');
  if (!t.length) {
    el.innerHTML = `<div class="th"><b>اختصاراتك</b></div><div class="empty"><div class="hint">ضيف تطبيقات موسيقى ووجهات وأرقام<br>من تطبيق «مدير الشاشات أوتو» بالموبايل</div></div>`;
    return;
  }
  el.innerHTML = `<div class="th"><b>اختصاراتك</b><div class="pg" id="pg"></div></div><div class="grid" id="tg"></div>`;
  const { cols, rows, n } = per(), pages = Math.ceil(t.length / n);
  PAGE = Math.min(PAGE, pages - 1);
  const g = $('#tg'); g.style.gridTemplateColumns = `repeat(${cols},1fr)`; g.style.gridTemplateRows = `repeat(${rows},1fr)`;
  g.innerHTML = t.slice(PAGE * n, PAGE * n + n).map((x, k) => {
    const i = PAGE * n + k, ic = x.t === 'media' && x.icon ? `<div class="ic" style="background-image:url('${x.icon}');background-color:transparent"></div>`
      : `<div class="ic">${svg(x.t === 'nav' ? 'pin' : x.t === 'call' ? 'phone' : 'music')}</div>`;
    return `<div class="tile" data-act="tile:${i}">${ic}<span>${esc(x.label)}</span></div>`;
  }).join('');
  $('#pg').innerHTML = pages > 1 ? `<button data-act="page:-1">‹</button><button data-act="page:1">›</button>` : '';
}

function renderAll() { load(); shape(); theme(); renderClock(); lastMediaKey = ''; renderMedia(); renderTiles(); }

/* ------------------------------------------------------------ touches (from the car, or mouse in the preview) */
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2200); }
function act(el, x, y) {
  const r = $('#ripple'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.remove('go'); void r.offsetWidth; r.classList.add('go');
  const a = el && el.closest('[data-act]'); if (!a) return;
  const [k, v] = a.dataset.act.split(':');
  a.classList.add('down'); setTimeout(() => a.classList.remove('down'), 160);
  if (k === 'page') { const pages = Math.ceil(CFG.tiles.length / per().n); PAGE = (PAGE + +v + pages) % pages; renderTiles(); }
  if (k === 'tile') {
    if (CAR) CarB.tile(+v); else { const t = CFG.tiles[+v]; toast(t.t === 'media' ? 'يشتغل ' + t.label : t.t === 'nav' ? 'ملاحة إلى ' + t.label : 'اتصال بـ ' + t.label); }
  }
  if (k === 'media') {
    if (CAR) { CarB.media(v); setTimeout(() => { poll(); renderMedia(); }, 450); }
    else if (v === 'toggle') { NOW.playing = !NOW.playing; lastMediaKey = ''; renderMedia(); }
  }
}
window.__tap = (fx, fy) => { const x = fx * innerWidth, y = fy * innerHeight; act(document.elementFromPoint(x, y), x, y); };
window.__scroll = () => { };
window.__fling = (vx) => { if (Math.abs(vx) > .5 && CFG.tiles.length) act({ closest: () => ({ dataset: { act: 'page:' + (vx < 0 ? 1 : -1) }, classList: { add() { }, remove() { } } }) }, -99, -99); };
window.__area = (l, t, r, b) => {
  const s = document.documentElement.style;
  s.setProperty('--pl', l * innerWidth + 'px'); s.setProperty('--pt', t * innerHeight + 'px');
  s.setProperty('--pr', r * innerWidth + 'px'); s.setProperty('--pb', b * innerHeight + 'px');
  setTimeout(renderTiles, 50);
};
window.__reload = () => renderAll();
document.addEventListener('click', e => act(e.target, e.clientX, e.clientY));
addEventListener('resize', () => { shape(); renderTiles(); });

/* preview mode: the phone app sends the design and sample data */
addEventListener('message', e => {
  const m = e.data || {};
  if (m.type !== 'cfg') return;
  CFG = cleanCfg(m.cfg); PHOTO = m.photo || ''; NOW = m.now || {}; INFO = m.info || {}; PREVIEW_ACTIVE = m.active !== false;
  shape(); theme(); renderClock(); lastMediaKey = ''; renderMedia(); renderTiles();
  $('#lock').classList.toggle('on', !PREVIEW_ACTIVE);
});

if (CAR) { renderAll(); poll(); renderClock(); renderMedia(); }
else {
  NOW = { perm: true, title: 'أغنية تجريبية', artist: 'اسم الفنان', app: 'Spotify', playing: true, pos: 70, dur: 200 };
  INFO = { speed: 64, bat: 82, loc: true, weather: { t: 24, c: 1, day: 1 } };
  shape(); theme(); renderClock(); renderMedia(); renderTiles();
  try { parent.postMessage({ type: 'ready' }, '*'); } catch (e) { }
}
setInterval(renderClock, 1000);
setInterval(() => { if (CAR) { poll(); renderMedia(); } }, 1500);
