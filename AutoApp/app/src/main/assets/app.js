/* مدير الشاشات أوتو — phone side */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* outside the app (browser test) a stand-in bridge */
const B = window.B || (() => {
  const m = {};
  return {
    code: () => 'K7QD-M2XP', active: () => m.act === 1, activate: c => (c.replace(/[^0-9A-Z]/gi, '').length === 10 ? (m.act = 1, true) : false),
    cfg: () => m.cfg || '{}', cfgSet: j => { m.cfg = j; }, kvGet: k => m[k] || null, kvSet: (k, v) => { m[k] = v; }, car: () => '', version: () => '1.0',
    apps: () => JSON.stringify([{ pkg: 'com.spotify.music', label: 'Spotify', icon: '' }, { pkg: 'com.anghami', label: 'Anghami', icon: '' }, { pkg: 'com.google.android.apps.youtube.music', label: 'YouTube Music', icon: '' }]),
    now: () => '{}', perms: () => JSON.stringify({ media: false, loc: true, call: false, aa: true }),
    askMedia() { }, askLoc() { }, askCall() { }, openAA() { }, pickWall(id) { setTimeout(() => __cb(id, false, 'CANCEL'), 10); }, wall: () => '',
    ai(id) { setTimeout(() => __cb(id, true, JSON.stringify({ name: 'تجربة', theme: { ac: '#7FD1FF', bg: '#06101a', ink: '#EAF6FF', mute: '#93A9BC' }, wall: { type: 'grad', a: '#0b2a44', b: '#04080d', c: '#1d5d8a', angle: 160 }, clock: 'minimal' })), 900); },
    open() { }, copy() { }, toast() { }, vibe() { }
  };
})();

const LOGO = `<svg viewBox="0 0 64 64" class="logo"><defs><linearGradient id="lgx" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9C7A44"/><stop offset=".5" stop-color="#D6B47A"/><stop offset="1" stop-color="#F0DDB2"/></linearGradient></defs><path d="M40,8H22A14,14 0,0 0,8 22v20a14,14 0,0 0,14 14h20a14,14 0,0 0,14 -14V30" fill="none" stroke="url(#lgx)" stroke-width="4.5" stroke-linecap="round"/><circle cx="31" cy="34" r="11" fill="none" stroke="#D6B47A" stroke-width="4"/><path d="M20.5,32.5h7M34.5,32.5h7M31,37v8" stroke="#D6B47A" stroke-width="4" stroke-linecap="round"/><circle cx="31" cy="34" r="2.8" fill="#E9CF98"/><circle cx="50" cy="14" r="5" fill="#E9CF98"/></svg>`;
const IC = {
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  tg: '<path d="m22 3-20 8 7 2 2 7 4-5 5 4z"/>', ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  pin: '<path d="M12 22s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  full: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', ok: '<path d="m5 12 5 5 9-10"/>'
};
const ic = k => `<svg class="i" viewBox="0 0 24 24">${IC[k] || ''}</svg>`;

function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2400); }
function busy(t, s) { $('#busyT').textContent = t; $('#busyS').textContent = s || ''; $('#busy').classList.add('on'); }
function unbusy() { $('#busy').classList.remove('on'); }
function sheet(h) { $('#sheetBody').innerHTML = h; $('#mask').classList.add('on'); $('#sheet').classList.add('on'); }
function closeSheet() { $('#mask').classList.remove('on'); $('#sheet').classList.remove('on'); }
$('#mask').onclick = closeSheet;
window.goBack = () => {
  if ($('#full').classList.contains('on')) { $('#full').classList.remove('on'); return true; }
  if ($('#sheet').classList.contains('on')) { closeSheet(); return true; }
  return false;
};

const CBS = {}; let cbn = 0;
window.__cb = (id, ok, res) => { const f = CBS[id]; delete CBS[id]; if (f) f(ok, res); };
const call = (fn, ...a) => new Promise((res, rej) => { const id = 'c' + (++cbn); CBS[id] = (ok, r) => ok ? res(r) : rej(new Error(r)); B[fn](id, ...a); });

function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); scrollTo(0, 0); }

/* ============================================================ activation */
function renderAct() {
  $('#act').innerHTML = `<div class="brand">${LOGO}<h1>مدير الشاشات أوتو</h1><div class="en">SCREEN MANAGER · AUTO</div>
      <p class="sub" style="max-width:320px">واجهة خاصة بيك على شاشة سيارتك بالأندرويد أوتو. تصمّمها من موبايلك، وبالذكاء الاصطناعي.</p></div>
    <div class="panel">
      <b>تفعيل التطبيق</b><p class="sub" style="margin:4px 0 0">الاشتراك مرة وحدة ومدى الحياة. دز رمز جهازك إلنا، ونرجعلك كود التفعيل.</p>
      <div class="devcode"><b class="num" id="dcode">${esc(B.code())}</b><button class="mini-btn" id="dcopy" aria-label="نسخ">${ic('copy')}</button></div>
      <div class="contact"><button data-c="tg">${ic('tg')} تيليگرام</button><button data-c="ig">${ic('ig')} إنستغرام</button></div>
      <label class="sub" style="display:block;margin:16px 2px 6px">كود التفعيل</label>
      <input id="acode" class="num" placeholder="XXXXX-XXXXX" autocapitalize="characters" spellcheck="false" style="text-align:center;letter-spacing:2px;font-family:Mono">
      <div class="err" id="aerr"></div>
      <button class="btn pri full" id="ago">فعّل</button>
    </div>
    <p class="sub" style="text-align:center;margin-top:18px">النسخة <span class="num">${esc(B.version())}</span></p>`;
  $('#dcopy').onclick = () => { B.copy(B.code()); toast('انسخ رمز الجهاز'); };
  $('#act .contact').onclick = e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    B.copy(B.code()); toast('انسخ رمز جهازك، دزّه بالرسالة');
    if (b.dataset.c === 'tg') B.open('https://t.me/KMK3993', 'org.telegram.messenger'); else B.open('https://instagram.com/_u/HN_45Y', 'com.instagram.android');
  };
  $('#ago').onclick = () => {
    const c = $('#acode').value.trim();
    if (!c) { $('#aerr').textContent = 'اكتب كود التفعيل'; return; }
    if (!B.activate(c)) { $('#aerr').textContent = 'الكود غير صحيح، أو مسوّي لجهاز ثاني'; return; }
    toast('تفعّل ✓ مدى الحياة'); start();
  };
}

/* ============================================================ design state */
let CFG = cleanCfg((() => { try { return JSON.parse(B.cfg() || '{}'); } catch (e) { return null; } })());
let PHOTO = '';
let saveT;
function save() { B.cfgSet(JSON.stringify(CFG)); pushPreview(); clearTimeout(saveT); saveT = setTimeout(() => toast('انحفظ ✓ يطلع بالسيارة فوراً'), 500); }

/* ============================================================ preview */
const SIZES = [['wide', 'عريضة', 1280, 480], ['std', 'عادية', 800, 480], ['hd', 'متوسطة', 1024, 600], ['tall', 'طولية', 600, 800]];
function carSize() {
  try { const c = JSON.parse(B.car() || ''); const k = Math.max(1, (c.dpi || 160) / 160); return [Math.round(c.w / k), Math.round(c.h / k)]; } catch (e) { return null; }
}
let SZ = B.kvGet('size') || (carSize() ? 'mine' : 'wide');
function sizeWH() { if (SZ === 'mine' && carSize()) return carSize(); const s = SIZES.find(x => x[0] === SZ) || SIZES[0]; return [s[2], s[3]]; }
function samples() {
  let now = {}; try { now = JSON.parse(B.now()); } catch (e) { }
  if (!now.title) now = { perm: true, title: 'أغنية تجريبية', artist: 'اسم الفنان', app: 'Spotify', playing: true, pos: 80, dur: 210 };
  return { now, info: { speed: 64, bat: 82, loc: true, weather: { t: 24, c: 1, day: 1 } } };
}
function pushTo(f) { if (!f || !f.contentWindow) return; const s = samples(); f.contentWindow.postMessage({ type: 'cfg', cfg: CFG, photo: PHOTO, now: s.now, info: s.info }, '*'); }
function pushPreview() { pushTo($('#pvF')); if ($('#full').classList.contains('on')) pushTo($('#fullF')); }
addEventListener('message', e => { if (e.data && e.data.type === 'ready') { pushPreview(); } });
function layoutPreview() {
  const wrap = $('#pvW'); if (!wrap) return;
  const [w, h] = sizeWH(), W = wrap.parentElement.clientWidth, k = W / w;
  wrap.style.height = Math.round(h * k) + 'px';
  const f = $('#pvF'); f.style.width = w + 'px'; f.style.height = h + 'px'; f.style.transform = `scale(${k})`;
}
function openFull() {
  const [w, h] = sizeWH(), vw = innerWidth, vh = innerHeight, rot = w > h && vh > vw;
  const k = rot ? Math.min(vh / w, vw / h) : Math.min(vw / w, vh / h);
  const r = $('#full .rot'); r.style.width = w + 'px'; r.style.height = h + 'px';
  r.style.transform = `translate(-50%,-50%) rotate(${rot ? 90 : 0}deg) scale(${k})`;
  const f = $('#fullF'); f.onload = () => pushTo(f); f.src = 'car.html?full=' + Date.now();
  $('#full').classList.add('on');
}
$('#fullX').onclick = () => $('#full').classList.remove('on');

/* ============================================================ main page */
function tplMini(t) {
  const w = wallCSS(t.wall, '');
  return `<div class="mini" style="background:${w}"><div class="a" style="background:${t.theme.panel};color:${t.theme.ink};font-weight:${t.clock === 'minimal' ? 200 : 800};font-family:${t.clock === 'digital' ? 'Mono' : 'Alx'}">٩:٤١</div>
    <div class="b" style="background:${t.theme.panel}"><i style="background:${t.theme.ac};width:70%"></i><i style="background:${t.theme.ink};opacity:.35"></i><i style="background:${t.theme.ink};opacity:.2;width:55%"></i></div></div>`;
}
const ACCENTS = ['#D6B47A', '#F0A04B', '#FF4D4D', '#FF6FAE', '#B48CFF', '#9DBBFF', '#3CCFC4', '#4CC38A', '#FFFFFF'];

function renderMain() {
  const P = (() => { try { return JSON.parse(B.perms()); } catch (e) { return {}; } })();
  const ready = P.media && P.loc && P.aa;
  $('#main').innerHTML = `
    <div class="head">${LOGO}<div style="flex:1"><h1>مدير الشاشات أوتو</h1><div class="en">SCREEN MANAGER · AUTO</div></div>
      <span class="pill ${ready ? '' : 'warn'}"><i></i>${ready ? 'جاهز' : 'يحتاج إعداد'}</span></div>

    <h2>واجهتك على السيارة</h2>
    <div><div class="pvwrap" id="pvW"><iframe id="pvF" src="car.html" title="معاينة"></iframe></div></div>
    <div class="row" style="margin-top:10px;align-items:center">
      <div class="chips hs" id="szC" style="flex:3;flex-wrap:nowrap;padding:0">${carSize() ? `<button class="chip ${SZ === 'mine' ? 'on' : ''}" data-s="mine">سيارتي</button>` : ''}${SIZES.map(s => `<button class="chip ${SZ === s[0] ? 'on' : ''}" data-s="${s[0]}">${s[1]}</button>`).join('')}</div>
      <button class="btn sec sm" id="fullB" style="flex:none">${ic('full')} كاملة</button></div>
    <p class="note" style="padding-top:6px">الواجهة تترتب لحالها حسب شكل شاشة سيارتك: عريضة، عادية، أو طولية.${carSize() ? '' : ' أول ما تربط بالسيارة، يطلع خيار «سيارتي» بمقاسها الحقيقي.'}</p>

    <button class="aibtn" id="aiB"><span class="st">✨</span><span style="flex:1"><b>صمّم بالذكاء الاصطناعي</b><span class="sub">اوصف الواجهة اللي تريدها بكلامك، ويصممها إلك</span></span></button>

    <h2>اختار واجهة</h2>
    <div class="hs" id="tplL">${TEMPLATES.map(t => `<button class="tpl ${CFG.tpl === t.id ? 'on' : ''}" data-t="${t.id}">${tplMini(t)}<b>${t.name}</b></button>`).join('')}</div>

    <h2>خصّص</h2>
    <div class="panel">
      <div class="field" style="margin-top:0"><label>اللون الأساسي</label><div class="chips" id="acC">${ACCENTS.map(c => `<button class="sw ${CFG.theme.ac.toLowerCase() === c.toLowerCase() ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div></div>
      <div class="field"><label>الخلفية</label><div class="hs" id="wlC" style="padding-bottom:4px">
        <button class="wl add ${CFG.wall.type === 'photo' ? 'on' : ''}" id="wlPhoto" ${PHOTO ? `style="background-image:url('${PHOTO}')"` : ''}>${PHOTO ? '' : '🖼'}</button>
        ${Object.keys(WALLS).map(k => `<button class="wl ${CFG.wall.type === 'preset' && CFG.wall.id === k ? 'on' : ''}" data-w="${k}" style="background:${WALLS[k]}" aria-label="${WALL_NAMES[k]}"></button>`).join('')}</div>
        ${CFG.wall.type === 'photo' ? `<div class="row" style="margin-top:8px;align-items:center"><span class="sub" style="flex:none">تعتيم الصورة</span><input type="range" id="shR" min="0" max="80" value="${Math.round(CFG.shade * 100)}" style="padding:0;border:0;background:none;accent-color:var(--ac)"></div>` : ''}</div>
      <div class="field"><label>شكل الساعة</label><div class="chips" id="clC">${[['big', 'عريضة'], ['minimal', 'رفيعة'], ['digital', 'رقمية']].map(([k, n]) => `<button class="chip ${CFG.clock === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}
        <button class="chip ${CFG.h24 ? 'on' : ''}" id="h24">٢٤ ساعة</button><button class="chip ${CFG.digits === 'en' ? 'on' : ''}" id="dgB">أرقام 123</button></div></div>
      <div class="field"><label>الخط</label><div class="chips" id="fnC">${[['Alx', 'إسكندرية'], ['Plex', 'بلكس'], ['Tj', 'تجوال']].map(([k, n]) => `<button class="chip ${CFG.theme.font === k ? 'on' : ''}" data-f="${k}" style="font-family:${k === 'Tj' ? 'Plex' : k}">${n}</button>`).join('')}</div></div>
      <div class="field"><label>الحواف</label><div class="chips" id="rdC">${[[1.2, 'حادة'], [3.2, 'ناعمة'], [5.5, 'دائرية']].map(([k, n]) => `<button class="chip ${Math.abs(CFG.theme.radius - k) < .6 ? 'on' : ''}" data-r="${k}">${n}</button>`).join('')}
        <button class="chip ${CFG.flip ? 'on' : ''}" id="flipB">اعكس الترتيب</button></div></div>
      <div class="field"><label>كلمة الترحيب</label><input id="grI" maxlength="40" placeholder="مثلاً: أهلاً محمد" value="${esc(CFG.greet)}"></div>
      <div class="field"><label>اسم السيارة (يطلع تحت الساعة)</label><input id="brI" maxlength="24" placeholder="مثلاً: Mercedes-Benz" value="${esc(CFG.brand)}"></div>
      <div class="field"><label>شنو يطلع بالواجهة</label><div id="shC">${[['media', 'الموسيقى'], ['speed', 'السرعة'], ['weather', 'الطقس'], ['battery', 'بطارية الموبايل'], ['date', 'التاريخ']].map(([k, n]) =>
        `<div class="tg" data-sh="${k}"><span>${n}</span><span class="toggle ${CFG.show[k] ? 'on' : ''}"></span></div>`).join('')}</div></div>
    </div>

    <h2>التطبيقات والاختصارات</h2>
    <div class="list" id="tlL">${CFG.tiles.length ? CFG.tiles.map((t, i) => `<div class="item"><div class="ic" style="${t.icon ? `background-image:url('${t.icon}');background-color:transparent` : ''}">${t.icon ? '' : ic(t.t === 'nav' ? 'pin' : t.t === 'call' ? 'phone' : 'music')}</div>
      <div class="t"><b>${esc(t.label)}</b><small>${t.t === 'media' ? 'تطبيق موسيقى' : t.t === 'nav' ? 'ملاحة: ' + esc(t.q) : 'اتصال: ' + esc(t.tel)}</small></div>
      <button class="mini-btn" data-mv="${i}:-1" aria-label="فوگ">${ic('up')}</button><button class="mini-btn" data-mv="${i}:1" aria-label="جوه">${ic('down')}</button><button class="mini-btn" data-rm="${i}" aria-label="حذف">${ic('x')}</button></div>`).join('')
      : '<div class="item"><div class="t"><small>ما ضفت اختصارات بعد</small></div></div>'}</div>
    <div class="row" style="margin-top:10px"><button class="btn sec" id="addM">${ic('music')} تطبيق</button><button class="btn sec" id="addN">${ic('pin')} وجهة</button><button class="btn sec" id="addC">${ic('phone')} رقم</button></div>
    <p class="note">• تطبيق الموسيقى: من تضغطه بالسيارة يبلش يشتغل، وتتحكم بيه من بطاقة الموسيقى أو من شاشة الموسيقى مال أندرويد أوتو.<br>• الوجهة: تفتح الملاحة عليها بخرائط گوگل أو ويز.<br>• الرقم: يتصل بيه مباشرة.<br>أندرويد أوتو ما يسمح يفتح باقي التطبيقات (مثل الواتساب) من جوه واجهة ثانية، فهاي هي الاختصارات الممكنة.</p>

    <h2>التشغيل على السيارة</h2>
    <div class="panel" id="stepsP">
      ${step(P.media, 'اسمح بالوصول للموسيقى', 'حتى تطلع الأغنية وتتحكم بيها من السيارة', 'askMedia', 'اسمح')}
      ${step(P.loc, 'اسمح بالموقع', 'للسرعة والطقس', 'askLoc', 'اسمح')}
      ${step(P.call, 'اسمح بالاتصال', 'إذا ضفت أرقام بالاختصارات', 'askCall', 'اسمح')}
      ${step(P.aa, 'أندرويد أوتو مثبت', P.aa ? 'موجود ✓' : 'نزّله من المتجر', 'openAA', 'افتح')}
      ${step(B.kvGet('aaDev') === '1', 'فعّل «مصادر غير معروفة» بأندرويد أوتو', 'خطوة وحدة ضرورية، لأن التطبيق مو من المتجر', 'guide', 'الشرح')}
      ${step(!!carSize(), 'اربط الموبايل بالسيارة', carSize() ? 'اشتغل على سيارتك ✓' : 'وافتح أيقونة «مدير الشاشات أوتو» من قائمة تطبيقات أندرويد أوتو', 'guide2', 'شلون؟')}
    </div>

    <h2>تواصل ويانا</h2>
    <div class="contact" style="margin-top:0"><button data-c="tg">${ic('tg')} تيليگرام</button><button data-c="ig">${ic('ig')} إنستغرام</button></div>
    <p class="sub" style="text-align:center;margin-top:18px">مفعّل مدى الحياة ✓ · النسخة <span class="num">${esc(B.version())}</span></p>`;
  bindMain();
  layoutPreview();
}
let stepN = 0;
function step(ok, t, s, act, btn) {
  stepN = stepN % 6 + 1;
  return `<div class="step ${ok ? 'ok' : ''}" style="padding:10px 0;border-bottom:1px solid var(--line)"><span class="n">${ok ? ic('ok') : stepN}</span>
    <div style="flex:1;min-width:0"><b style="font-size:14.5px">${t}</b><div class="sub">${s}</div></div>
    ${ok && act !== 'guide' ? '' : `<button class="btn sec sm" data-st="${act}">${btn}</button>`}</div>`;
}

function bindMain() {
  $('#szC').onclick = e => { const c = e.target.closest('[data-s]'); if (!c) return; SZ = c.dataset.s; B.kvSet('size', SZ); document.querySelectorAll('#szC .chip').forEach(x => x.classList.toggle('on', x === c)); layoutPreview(); };
  $('#fullB').onclick = openFull;
  $('#aiB').onclick = aiSheet;
  $('#tplL').onclick = e => {
    const c = e.target.closest('[data-t]'); if (!c) return;
    const t = TEMPLATES.find(x => x.id === c.dataset.t);
    Object.assign(CFG, { tpl: t.id, name: t.name, theme: Object.assign({}, t.theme), wall: Object.assign({}, t.wall), clock: t.clock, shade: t.shade });
    save(); renderMain();
  };
  $('#acC').onclick = e => { const c = e.target.closest('[data-c]'); if (!c) return; CFG.theme.ac = c.dataset.c; CFG.tpl = ''; save(); renderMain(); };
  $('#wlC').onclick = async e => {
    if (e.target.closest('#wlPhoto')) {
      try { busy('أجهّز الصورة…'); PHOTO = await call('pickWall'); unbusy(); CFG.wall = { type: 'photo' }; CFG.shade = Math.max(CFG.shade, .3); save(); renderMain(); }
      catch (er) { unbusy(); if (er.message !== 'CANCEL') toast(er.message); }
      return;
    }
    const c = e.target.closest('[data-w]'); if (!c) return; CFG.wall = { type: 'preset', id: c.dataset.w }; save(); renderMain();
  };
  const sh = $('#shR'); if (sh) sh.oninput = () => { CFG.shade = sh.value / 100; save(); };
  $('#clC').onclick = e => {
    if (e.target.closest('#h24')) { CFG.h24 = !CFG.h24; save(); return renderMain(); }
    if (e.target.closest('#dgB')) { CFG.digits = CFG.digits === 'en' ? 'ar' : 'en'; save(); return renderMain(); }
    const c = e.target.closest('[data-k]'); if (!c) return; CFG.clock = c.dataset.k; save(); renderMain();
  };
  $('#fnC').onclick = e => { const c = e.target.closest('[data-f]'); if (!c) return; CFG.theme.font = c.dataset.f; save(); renderMain(); };
  $('#rdC').onclick = e => {
    if (e.target.closest('#flipB')) { CFG.flip = !CFG.flip; save(); return renderMain(); }
    const c = e.target.closest('[data-r]'); if (!c) return; CFG.theme.radius = +c.dataset.r; save(); renderMain();
  };
  $('#grI').onchange = () => { CFG.greet = $('#grI').value.trim(); save(); };
  $('#brI').onchange = () => { CFG.brand = $('#brI').value.trim(); save(); };
  $('#shC').onclick = e => { const r = e.target.closest('[data-sh]'); if (!r) return; CFG.show[r.dataset.sh] = !CFG.show[r.dataset.sh]; r.querySelector('.toggle').classList.toggle('on'); save(); };
  $('#tlL').onclick = e => {
    const m = e.target.closest('[data-mv]'), r = e.target.closest('[data-rm]');
    if (m) { const [i, d] = m.dataset.mv.split(':').map(Number), j = i + d; if (j < 0 || j >= CFG.tiles.length) return; [CFG.tiles[i], CFG.tiles[j]] = [CFG.tiles[j], CFG.tiles[i]]; save(); renderMain(); }
    if (r) { CFG.tiles.splice(+r.dataset.rm, 1); save(); renderMain(); }
  };
  $('#addM').onclick = addMedia; $('#addN').onclick = addNav; $('#addC').onclick = addCall;
  $('#stepsP').onclick = e => {
    const b = e.target.closest('[data-st]'); if (!b) return; const k = b.dataset.st;
    if (k === 'guide') return devGuide();
    if (k === 'guide2') return connectGuide();
    B[k]();
  };
  $('#main .contact').onclick = e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    if (b.dataset.c === 'tg') B.open('https://t.me/KMK3993', 'org.telegram.messenger'); else B.open('https://instagram.com/_u/HN_45Y', 'com.instagram.android');
  };
}

/* ============================================================ shortcuts */
function addMedia() {
  let apps = []; try { apps = JSON.parse(B.apps()); } catch (e) { }
  const have = new Set(CFG.tiles.filter(t => t.t === 'media').map(t => t.pkg));
  sheet(`<h3>تطبيقات الموسيقى بموبايلك</h3><p class="sub" style="margin:0 0 10px">اختار اللي تريده يطلع بالواجهة</p>
    <div class="list">${apps.length ? apps.map((a, i) => `<div class="item" data-i="${i}"><div class="ic" style="${a.icon ? `background-image:url('${a.icon}');background-color:transparent` : ''}">${a.icon ? '' : ic('music')}</div>
      <div class="t"><b>${esc(a.label)}</b></div>${have.has(a.pkg) ? '<span class="sub">مضاف ✓</span>' : `<button class="btn pri sm">ضيف</button>`}</div>`).join('')
      : '<div class="item"><div class="t"><small>ما لگيت تطبيقات موسيقى بموبايلك</small></div></div>'}</div>`);
  $('#sheetBody .list').onclick = e => {
    const it = e.target.closest('[data-i]'); if (!it || !e.target.closest('.btn')) return;
    const a = apps[+it.dataset.i]; CFG.tiles.push({ t: 'media', pkg: a.pkg, label: a.label, icon: a.icon || '' });
    save(); closeSheet(); renderMain();
  };
}
function addNav() {
  sheet(`<h3>وجهة جديدة</h3><p class="sub" style="margin:0 0 6px">من تضغطها بالسيارة تفتح الملاحة عليها</p>
    <label class="sub" style="display:block;margin:12px 2px 6px">الاسم</label><input id="nL" placeholder="مثلاً: البيت" maxlength="20">
    <label class="sub" style="display:block;margin:12px 2px 6px">العنوان أو اسم المكان</label><input id="nQ" placeholder="مثلاً: شارع فلسطين، بغداد">
    <button class="btn pri full" id="nGo" style="margin-top:16px">ضيف</button>`);
  $('#nGo').onclick = () => {
    const l = $('#nL').value.trim(), q = $('#nQ').value.trim(); if (!l || !q) return toast('اكتب الاسم والعنوان');
    CFG.tiles.push({ t: 'nav', label: l, q }); save(); closeSheet(); renderMain();
  };
}
function addCall() {
  sheet(`<h3>رقم للاتصال السريع</h3>
    <label class="sub" style="display:block;margin:12px 2px 6px">الاسم</label><input id="cL" placeholder="مثلاً: أبو علي" maxlength="20">
    <label class="sub" style="display:block;margin:12px 2px 6px">الرقم</label><input id="cT" class="num" type="tel" placeholder="07xx xxx xxxx">
    <button class="btn pri full" id="cGo" style="margin-top:16px">ضيف</button>`);
  $('#cGo').onclick = () => {
    const l = $('#cL').value.trim(), t = $('#cT').value.replace(/[^0-9+]/g, ''); if (!l || t.length < 4) return toast('اكتب الاسم والرقم');
    CFG.tiles.push({ t: 'call', label: l, tel: t }); save(); closeSheet(); renderMain();
    try { if (!JSON.parse(B.perms()).call) B.askCall(); } catch (e) { }
  };
}

/* ============================================================ guides */
function devGuide() {
  sheet(`<h3>تفعيل «مصادر غير معروفة»</h3>
    <p class="sub" style="margin:0 0 12px">أندرويد أوتو يخفي التطبيقات اللي مو من متجر گوگل، فلازم تفعّل هالخيار مرة وحدة بس.</p>
    <div class="panel" style="line-height:2">
      ١. اضغط <b>«افتح إعدادات أندرويد أوتو»</b> جوه، وادخل <b>إعدادات إضافية بالتطبيق</b> (أو افتح تطبيق أندرويد أوتو نفسه).<br>
      ٢. انزل لآخر الصفحة، واضغط على <b>«النسخة» (Version)</b> عشر مرات متتالية، ووافق على الرسالة. هيج تنفتح إعدادات المطوّر.<br>
      ٣. من القائمة (⋮) فوگ، اختار <b>إعدادات المطوّر</b> (Developer settings).<br>
      ٤. فعّل <b>مصادر غير معروفة</b> (Unknown sources).<br>
      ٥. افصل الموبايل عن السيارة وارجع اربطه.</div>
    <p class="note">إذا ما طلع التطبيق بعدها، طفّي أندرويد أوتو من إعدادات الموبايل وشغّله مرة ثانية. بعض التحديثات من گوگل ممكن تغيّر هالخطوات.</p>
    <div class="row" style="margin-top:12px"><button class="btn sec" id="gAA">افتح إعدادات أندرويد أوتو</button><button class="btn pri" id="gOk">سويتها ✓</button></div>`);
  $('#gAA').onclick = () => B.openAA();
  $('#gOk').onclick = () => { B.kvSet('aaDev', '1'); closeSheet(); renderMain(); };
}
function connectGuide() {
  sheet(`<h3>شلون أشغّله بالسيارة؟</h3>
    <div class="panel" style="line-height:2">
      ١. اربط الموبايل بالسيارة (كيبل أو لاسلكي) وخلي أندرويد أوتو يشتغل.<br>
      ٢. بشاشة السيارة افتح قائمة التطبيقات، ودوّر على أيقونة <b>مدير الشاشات أوتو</b> (الستيرنگ الذهبي).<br>
      ٣. اضغطها، وتطلع واجهتك كاملة. كل تعديل تسويه هنا يطلع بالسيارة فوراً.<br>
      ٤. حتى ترجع لواجهة أندرويد أوتو، اضغط زر الرئيسية بالشريط مال أوتو.</div>
    <p class="note">أندرويد أوتو ما يسمح لأي تطبيق يفتح لحاله أول ما تربط، بس عادة يرجع يفتح آخر تطبيق كنت عليه. فإذا خليت واجهتنا مفتوحة، غالباً ترجعلك بالمرة الجاية.<br>
      زر <b>↻</b> بالزاوية يحدّث الواجهة إذا احتجت.</p>
    <button class="btn pri full" style="margin-top:12px" onclick="closeSheet()">تمام</button>`);
}

/* ============================================================ AI designer */
const AI_SYSTEM = `You design a car dashboard theme for an Android Auto screen app. The user writes in Arabic (often Iraqi dialect).
Answer ONLY with one JSON object, no markdown, using exactly this schema:
{"name": short Arabic name (max 3 words),
 "theme": {"ac": accent "#RRGGBB", "bg": base background "#RRGGBB", "ink": main text "#RRGGBB", "mute": secondary text "#RRGGBB",
           "panel": card fill as "rgba(r,g,b,a)" with a between 0.04 and 0.7, "font": "Alx" | "Plex" | "Tj", "radius": number 0.5-6 (corner roundness)},
 "wall": either {"type":"grad","a":"#RRGGBB","b":"#RRGGBB","c":"#RRGGBB" (glow color),"angle":0-360}
         or {"type":"preset","id": one of "gold","aurora","carbon","desert","mint","pearl","night","rose"},
 "clock": "big" | "minimal" | "digital",
 "shade": 0-0.5,
 "greet": optional short Arabic greeting if the user mentions a name or greeting, else "",
 "show": {"media":bool,"speed":bool,"weather":bool,"battery":bool,"date":bool}}
Rules: text must stay readable — strong contrast between ink and bg/wall. Dark themes suit night driving; use light only if asked.
Match colors to what the user describes (brands, cars, teams, moods). Never include anything except the JSON.`;
const AI_EX = ['واجهة سودة وذهبية فخمة مثل المرسيدس', 'ألوان ريال مدريد، أبيض وبنفسجي', 'رياضية حمرة وسودة بساعة رقمية', 'هادئة زرقة للسياقة بالليل', 'بسيطة بيضة ونظيفة', 'ألوان البحر والغروب'];
function aiSheet() {
  sheet(`<h3>✨ صمّم بالذكاء الاصطناعي</h3><p class="sub" style="margin:0 0 10px">اكتب شلون تريد الواجهة، بكلامك العادي</p>
    <input id="aiP" placeholder="مثلاً: سودة وذهبية فخمة وساعة كبيرة" maxlength="300">
    <div class="ex" id="aiEx">${AI_EX.map(x => `<button>${x}</button>`).join('')}</div>
    <p class="note">يحتفظ باختصاراتك، ويغيّر الألوان والخلفية والساعة بس.</p>
    <button class="btn pri full" id="aiGo" style="margin-top:12px">صمّمها ✨</button>`);
  $('#aiEx').onclick = e => { const b = e.target.closest('button'); if (b) $('#aiP').value = b.textContent; };
  $('#aiGo').onclick = async () => {
    const p = $('#aiP').value.trim(); if (p.length < 3) return toast('اكتب وصف للواجهة');
    closeSheet(); busy('أصمّم واجهتك…', 'ثواني بس');
    const t2 = setTimeout(() => $('#busyS').textContent = 'أختار الألوان والخلفية…', 4000);
    try {
      const raw = await call('ai', AI_SYSTEM, p);
      const m = String(raw).match(/\{[\s\S]*\}/); if (!m) throw new Error('الرد ما بيه تصميم، جرّب وصف ثاني');
      const j = JSON.parse(m[0]);
      const keep = { tiles: CFG.tiles, brand: CFG.brand, h24: CFG.h24, digits: CFG.digits, flip: CFG.flip, greet: j.greet || CFG.greet };
      CFG = cleanCfg(Object.assign({}, CFG, j, keep, { tpl: '', show: Object.assign({}, CFG.show, j.show || {}) }));
      save(); clearTimeout(t2); unbusy(); renderMain(); toast('صمّمتلك «' + (CFG.name || 'واجهة جديدة') + '» ✓');
    } catch (er) { clearTimeout(t2); unbusy(); toast(er.message || 'صار خطأ، جرّب مرة ثانية'); }
  };
}

/* ============================================================ start */
function start() {
  if (!B.active()) { renderAct(); show('act'); return; }
  if (CFG.wall.type === 'photo') PHOTO = B.wall();
  B.cfgSet(JSON.stringify(CFG));
  renderMain(); show('main');
}
window.onResumeApp = () => { if ($('#main').classList.contains('on') && !$('#sheet').classList.contains('on')) { const y = scrollY; renderMain(); scrollTo(0, y); } };
addEventListener('resize', layoutPreview);
start();
