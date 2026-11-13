/* ============================================================ AI UI generator (Gemini)
   The words the user writes go to Gemini with a hidden system prompt that only allows a JSON design.
   The JSON is checked value by value (only known themes, shapes, positions in range) and then
   bound straight to the live preview, so a new interface appears on the screen in one step. */

const AI_EX_TV = ['واجهة ليلية فخمة بالأسود والذهبي، والساعة كبيرة على اليمين', 'واجهة هادئة للأطفال بألوان فاتحة وتطبيقات كبيرة', 'ستايل Apple TV نظيف بدون آيات ولا مناسبات',
  'واجهة كربلائية بصور العتبات والأذان واضح', 'شريط أخبار تحت وتطبيقات مربعة بالنص', 'ألوان نادي برشلونة الأزرق والأحمر'];
const AI_EX_CAR = ['واجهة سبورت حمرة بعدّاد كبير', 'شكل فخم أسود وذهبي مثل لكزس', 'واجهة بيضة نظيفة للنهار', 'مثل CarPlay بشريط جانبي يسار'];

function aiIds(list) { return list.map(x => x[0]); }

function aiSystem(mode) {
  if (mode === 'car') {
    return `You design Android car head-unit launchers (screen 1024x600) for an Arabic app.
Return ONLY one JSON object, no markdown, no explanation. Schema (all keys optional except name):
{"name": short Arabic name,
 "theme": one of ${JSON.stringify(aiIds(CAR_THEMES))},
 "layout": one of ${JSON.stringify(aiIds(CAR_LAYOUTS))},
 "dockPos": one of ["bottom","right","left","top"],
 "dockStyle": one of ["bar","line","float"],
 "icons": one of ${JSON.stringify(aiIds(ICON_STYLES))},
 "isize": one of ["s","m","l"],
 "cards": one of ["glass","solid"],
 "rad": number 0..4 (corner roundness),
 "cols": integer 3..6,
 "labels": "on" or "off",
 "widgets": array (1..4) of {"t": one of ${JSON.stringify(aiIds(CAR_WIDGETS))}, "style": optional one of ["ring","arc","needle","digital","cover","thin"], "c": optional accent "#RRGGBB"}}
Pick values that match the user's description (mood, colours, brand, day/night). Keep it readable while driving.
Example for "سبورت أحمر بعداد كبير": {"name":"سبورت","theme":"sport","layout":"cockpit","dockPos":"bottom","icons":"neon","widgets":[{"t":"speed","style":"needle","c":"#FF3B3B"},{"t":"media"}]}`;
  }
  return `You design TV launcher home screens (1920x1080) for an Arabic Android TV app.
Return ONLY one JSON object, no markdown, no explanation. Schema (all keys optional except name):
{"name": short Arabic name,
 "theme": one of ${JSON.stringify(aiIds(L_THEMES))},
 "skin": one of ["classic","ribbon","shelf"]  (classic = clock + info + round apps; ribbon = full photo with app strip at bottom; shelf = big soft app cards),
 "variant": "" or "light",
 "palette": {"a": accent "#RRGGBB", "b": text on accent "#RRGGBB", "c": deep base "#RRGGBB"} or null,
 "bgMode": "photos" or "palette" (palette = smooth gradient made from the palette, no photos),
 "bgSources": array, subset of ${JSON.stringify(aiIds(L_SOURCES).filter(x => x !== 'mine'))},
 "religious": boolean (show Quran verse, Adhan times and occasions),
 "news": {"on": boolean, "view": one of ["","big","ticker","headline"]},
 "apps": {"shape": one of ${JSON.stringify(L_APP_SHAPES.map(x => x[1]))}},
 "elements": object whose keys are some of ${JSON.stringify(aiIds(EDITABLES))} and values are
   {"x": integer -600..600, "y": integer -400..400 (pixels moved from the default place), "s": number 0.6..1.6 (scale),
    "hidden": boolean, "color": "" or "#RRGGBB" (text colour), "bg": one of ${JSON.stringify(L_BGS.map(x => x[1]))} (glass tint, "" = none),
    "font": one of ${JSON.stringify(L_FONTS.map(x => x[1]))}}}
Rules: glass/transparent panels, elegant spacing, nothing overlapping, text always readable on the background.
Hide what the user does not want. Use few strong colours. Only use the allowed values.
Follow the user's words exactly: colours they name become the palette, things they say "without" are hidden, and "big"/"small" change "s".
Example for "واجهة ليلية سودة وذهبية والساعة كبيرة بدون آيات":
{"name":"ليلي ذهبي","theme":"default","skin":"classic","palette":{"a":"#D6B47A","b":"#0B0C10","c":"#07080C"},"bgMode":"palette","religious":false,"apps":{"shape":"circle"},"elements":{"timeblock":{"s":1.35,"color":"#F0DDB2"},"wisdom":{"hidden":true}}}`;
}

const aiPick = (v, list, def) => list.includes(v) ? v : def;
const aiHex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : '';
const aiNum = (v, lo, hi, def) => { const n = +v; return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };

function aiParse(txt) {
  let t = String(txt || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('الرد ما بيه تصميم');
  return JSON.parse(t.slice(i, j + 1));
}

/* JSON from Gemini → a design the preview engine understands (only safe, known values pass) */
function aiTvCfg(j) {
  const s = { theme: aiPick(j.theme, aiIds(L_THEMES), 'default'), skin: aiPick(j.skin, ['classic', 'ribbon', 'shelf'], 'classic') };
  if (j.variant === 'light') s.variant = 'light';
  if (j.palette && aiHex(j.palette.a)) s.palette = { a: aiHex(j.palette.a), b: aiHex(j.palette.b) || '#ffffff', c: aiHex(j.palette.c) || '#08090f' };
  if (s.palette && j.bgMode === 'palette') s.bgMode = 'palette';
  const src = (Array.isArray(j.bgSources) ? j.bgSources : []).filter(x => aiIds(L_SOURCES).includes(x) && x !== 'mine');
  s.bgSources = src.length ? src : ['nature'];
  if (j.religious === false) s.religious = false;
  if (j.news && j.news.on) s.news = { on: true, src: 'auto' };
  const layout = {};
  const el = j.elements && typeof j.elements === 'object' ? j.elements : {};
  Object.keys(el).forEach(id => {
    if (!aiIds(EDITABLES).includes(id)) return;
    const e = el[id] || {}, L = {};
    if (e.hidden === true) L.hidden = true;
    const x = Math.round(aiNum(e.x, -600, 600, 0)), y = Math.round(aiNum(e.y, -400, 400, 0)), sc = aiNum(e.s, .6, 1.6, 1);
    if (x) L.x = x; if (y) L.y = y; if (sc !== 1) L.s = +sc.toFixed(2);
    if (aiHex(e.color)) L.color = aiHex(e.color);
    if (L_BGS.map(b => b[1]).includes(e.bg) && e.bg) L.bg = e.bg;
    if (L_FONTS.map(f => f[1]).includes(e.font) && e.font) L.font = e.font;
    if (Object.keys(L).length) layout[id] = L;
  });
  if (j.news && j.news.on && ['big', 'ticker', 'headline'].includes(j.news.view)) layout.newscard = Object.assign({}, layout.newscard, { view: j.news.view });
  if (j.apps && L_APP_SHAPES.map(x => x[1]).includes(j.apps.shape)) layout['row-apps'] = Object.assign({}, layout['row-apps'], { shape: j.apps.shape });
  if (s.religious === false) ['wisdom', 'adhanbox', 'row-occasions'].forEach(id => { layout[id] = Object.assign({}, layout[id], { hidden: true }); });
  return { name: String(j.name || 'تصميم ذكي').slice(0, 40), cfg: { v: 1, settings: s, layout } };
}

function aiCarCfg(j) {
  const c = {
    theme: aiPick(j.theme, aiIds(CAR_THEMES), 'signature'), layout: aiPick(j.layout, aiIds(CAR_LAYOUTS), 'carplay'),
    dockPos: aiPick(j.dockPos, ['bottom', 'right', 'left', 'top'], 'bottom'), dockStyle: aiPick(j.dockStyle, ['bar', 'line', 'float'], 'bar'),
    icons: aiPick(j.icons, aiIds(ICON_STYLES), 'squircle'), isize: aiPick(j.isize, ['s', 'm', 'l'], 'm'), cards: aiPick(j.cards, ['glass', 'solid'], 'glass'),
    rad: +aiNum(j.rad, 0, 4, 3).toFixed(1), cols: Math.round(aiNum(j.cols, 3, 6, 4)), labels: j.labels === 'off' ? 'off' : 'on', bt: ''
  };
  const w = (Array.isArray(j.widgets) ? j.widgets : []).filter(x => x && aiIds(CAR_WIDGETS).includes(x.t)).slice(0, 4)
    .map(x => { const o = { t: x.t }; if (['ring', 'arc', 'needle', 'digital', 'cover', 'thin'].includes(x.style)) o.style = x.style; if (aiHex(x.c)) o.c = aiHex(x.c); return o; });
  if (w.length) c.widgets = w;
  return { name: String(j.name || 'سيارة بالذكاء').slice(0, 40), c };
}

let AI_BUSY = false;
async function aiGenerate(mode, prompt) {
  if (AI_BUSY) return;
  if (typeof featureOn === 'function' && !featureOn('ai')) return featureLocked();
  AI_BUSY = true;
  busy('الذكاء الاصطناعي يصمم الواجهة…', 'ثواني بس…');
  const t1 = setTimeout(() => window.onProg && onProg('يرتب الألوان والأماكن…'), 6000), t2 = setTimeout(() => window.onProg && onProg('شوية بعد، الإنترنت بطيء…'), 15000);
  try {
    const txt = await run('ai', { system: aiSystem(mode), prompt: String(prompt).slice(0, 800), __local: true });
    const j = aiParse(txt);
    clearTimeout(t1); clearTimeout(t2); unbusy(); AI_BUSY = false;
    aiApply(mode, j, prompt);
  } catch (e) { clearTimeout(t1); clearTimeout(t2); unbusy(); AI_BUSY = false; toast(errText(e)); }
}

function aiApply(mode, j, prompt) {
  const inCar = typeof isCarD === 'function' && D && isCarD(), inTv = D && !inCar;
  if (mode === 'car') {
    const r = aiCarCfg(j);
    if (inCar) {
      const C = CC(), keep = { apps: C.apps, bgPack: C.bgPack, dock: C.dock, dockApps: C.dockApps, maint: C.maint, dial: C.dial, odoSet: C.odoSet, alert: C.alert, drive: C.drive, saver: C.saver, owner: C.owner, volBtns: C.volBtns, brand: C.brand };
      D.cfg.carcfg = Object.assign(CAR_DEF(), r.c, JSON.parse(JSON.stringify(keep)));
      D.wsel = null; changed(); carLive(); carEditorPanels();
    } else { show('design'); openDesign({ name: r.name, from: 'new', cfg: { v: 1, mode: 'car', carcfg: Object.assign(CAR_DEF(), r.c) } }); }
  } else {
    const r = aiTvCfg(j);
    if (inTv) {
      const S = D.cfg.settings, keep = { owner: S.owner, team: S.team, topTools: S.topTools, inputsBtn: S.inputsBtn, saver: S.saver, saverMin: S.saverMin, tvCtl: S.tvCtl, cityIdx: S.cityIdx };
      Object.keys(keep).forEach(k => keep[k] === undefined && delete keep[k]);
      D.cfg.settings = Object.assign({}, r.cfg.settings, keep);
      D.cfg.layout = r.cfg.layout; delete D.cfg.bgPinned;
      D.sel = null; changed(); designPanel();
      live({ settings: D.cfg.settings, layout: D.cfg.layout, bg: true });
    } else { show('design'); openDesign({ name: r.name, from: 'new', cfg: r.cfg }); }
  }
  aiLast = { mode, prompt };
  toast('✨ تصميم جديد: ' + (j.name || 'جاهز'));
}
let aiLast = null;

function aiSheet(mode) {
  if (typeof featureOn === 'function' && !featureOn('ai')) return featureLocked();
  mode = mode || (D && typeof isCarD === 'function' && isCarD() ? 'car' : 'tv');
  const ex = mode === 'car' ? AI_EX_CAR : AI_EX_TV;
  sheet(`<h2>✨ صمّم بالذكاء الاصطناعي</h2>
    <p class="sub">اوصف الواجهة اللي تريدها بكلامك، والذكاء الاصطناعي يصممها ${mode === 'car' ? 'لشاشة السيارة' : 'للتلفزيون'} وتطلع بالمعاينة فوراً. بعدها تگدر تعدّل أي شي بإيدك.</p>
    <div class="seg" id="aiMode" style="margin:6px 0 10px"><button data-m="tv" class="${mode === 'tv' ? 'on' : ''}">التلفزيون</button><button data-m="car" class="${mode === 'car' ? 'on' : ''}">السيارة</button></div>
    <textarea id="aiP" rows="4" maxlength="800" placeholder="مثلاً: ${esc(ex[0])}" style="width:100%;resize:vertical">${esc(aiLast && aiLast.mode === mode ? aiLast.prompt : '')}</textarea>
    <div class="chips" id="aiEx" style="margin:10px 0">${ex.map((t, i) => `<button class="chip" data-i="${i}">${esc(t)}</button>`).join('')}</div>
    <button class="btn pri full" id="aiGo">✨ صمّمها</button>
    ${aiLast ? `<button class="btn ghost full" id="aiAgain" style="margin-top:8px">${ic('refresh')} تصميم ثاني لنفس الوصف</button>` : ''}`);
  $('#aiMode').onclick = e => { const b = e.target.closest('[data-m]'); if (!b) return; closeSheet(); aiSheet(b.dataset.m); };
  $('#aiEx').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; $('#aiP').value = ex[+b.dataset.i]; };
  $('#aiGo').onclick = () => { const p = $('#aiP').value.trim(); if (p.length < 4) return toast('اكتب وصف أطول شوية'); closeSheet(); aiGenerate(mode, p); };
  const ag = $('#aiAgain'); if (ag) ag.onclick = () => { closeSheet(); aiGenerate(aiLast.mode, aiLast.prompt + ' (نسخة مختلفة)'); };
}

/* entry points: the new-design sheets and the top of both editors */
(function () {
  const btn = id => `<button class="btn pri full" id="${id}" style="margin-bottom:12px">✨ صمّم بالذكاء الاصطناعي</button>`;
  const allowed = () => typeof featureOn !== 'function' || featureOn('ai');
  const _dn = designNew;
  designNew = function () {
    _dn.apply(this, arguments);
    const b = $('#sheetBody'); if (!b || !allowed()) return;
    const h = b.querySelector('h2'); (h ? h : b.firstChild).insertAdjacentHTML(h ? 'afterend' : 'beforebegin', btn('aiNew'));
    $('#aiNew').onclick = () => { closeSheet(); aiSheet('tv'); };
  };
  if (typeof carNew === 'function') {
    const _cn = carNew;
    carNew = function () {
      const r = _cn.apply(this, arguments);
      const b = $('#sheetBody'); if (!b || !allowed() || b.querySelector('#aiNewC')) return r;
      const h = b.querySelector('h2'); if (h) { h.insertAdjacentHTML('afterend', btn('aiNewC')); $('#aiNewC').onclick = () => { closeSheet(); aiSheet('car'); }; }
      return r;
    };
  }
  const _od = openDesign;
  openDesign = function () {
    const r = _od.apply(this, arguments);
    setTimeout(() => {
      const seg = $('#dSeg'); if (!seg || !allowed() || $('#aiEd')) return;
      seg.insertAdjacentHTML('beforebegin', `<button class="btn sec full" id="aiEd" style="margin:0 0 10px">✨ غيّرها بالذكاء الاصطناعي</button>`);
      $('#aiEd').onclick = () => aiSheet();
    }, 0);
    return r;
  };
})();
