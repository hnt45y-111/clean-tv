'use strict';
/* ============================================================ design studio
   The TV launcher's own page runs inside an iframe, so every change is shown exactly as the TV will show it. */
const CFG_KEYS = ['settings', 'layout', 'appOrder', 'appHidden', 'customIcons', 'cityIdx', 'hijriOffset', 'bgSource', 'bgPinned'];
const EDITABLES = [['timeblock', 'الساعة والتاريخ'], ['adhanbox', 'موعد الأذان'], ['weather', 'الطقس'], ['wisdom', 'الآية والحديث'], ['bigcount', 'العد التنازلي'], ['clubcard', 'لوحة النادي'], ['newscard', 'ويدجت الأخبار'],
  ['row-apps', 'صف التطبيقات'], ['row-occasions', 'صف المناسبات'], ['row-matches', 'صف المباريات'], ['row-tools', 'صف الأدوات'], ['topbar', 'أيقونات التحكم']];
const L_FONTS = [['الافتراضي', ''], ['تجوال', "'Tajawal'"], ['أميري', "'Amiri'"], ['كوفي', "'Kufi'"], ['نسخ', "'Noto Naskh Arabic'"]];
const L_COLORS = [['الافتراضي', ''], ['أبيض', '#ffffff'], ['ذهبي', '#f6dc9b'], ['أخضر', '#5fd39a'], ['سماوي', '#7dd3fc'], ['وردي', '#f9a8d4'], ['أحمر', '#ff8b8b']];
const L_BGS = [['بدون', ''], ['أسود', '0,0,0'], ['ذهبي', '160,120,30'], ['أخضر', '20,90,60'], ['أزرق', '20,50,120'], ['بنفسجي', '70,30,110'], ['أبيض', '255,255,255']];
const L_SHAPES = [['الافتراضي', ''], ['مربع', 'square'], ['حواف دائرية', 'rounded'], ['دائري', 'circle'], ['مستطيل', 'rect']];
const L_APP_SHAPES = [['دائري', 'circle'], ['مربع', 'square'], ['آيفون', 'squircle'], ['سداسي', 'hexagon'], ['ورقة', 'leaf'], ['معيّن', 'diamond'], ['بيضوي', 'oval'], ['قطرة', 'drop'], ['ثماني', 'octagon'], ['بطاقة', 'rounded'], ['مستطيل', 'rect'], ['كبسولة', 'pill']];
const L_THEMES = [['default', 'الذهبي الليلي', '#1a1408', '#d4a64a'], ['appletv', 'الأسود الأنيق', '#1c1c1e', '#ffffff'], ['royal', 'الذهبي الملكي', '#20150a', '#f1c96b'], ['karbala', 'الكربلائي', '#2a0808', '#e0574f'],
  ['alawi', 'العلوي', '#06200f', '#4fc07a'], ['midnight', 'الأزرق الليلي', '#081226', '#5b8cff'], ['turquoise', 'الفيروزي', '#05201f', '#3fd1c3'], ['violet', 'البنفسجي', '#160b26', '#a77bff'],
  ['rose', 'الوردي', '#260b18', '#ff8fc0'], ['desert', 'الصحراوي', '#261a0c', '#e8b36a'], ['silver', 'الفضي', '#16181c', '#d6dbe3'], ['glass', 'الزجاجي', '#0d1620', '#bfe4ff'],
  ['minimal', 'البسيط', '#111', '#eee'], ['onyx', 'الأسود الفخم', '#000', '#c9a86a'], ['neon', 'النيون', '#060312', '#00f0ff']];
const L_SOURCES = [['shrines', 'العتبات المقدسة'], ['ahlulbayt', 'أهل البيت (ع)'], ['nabawi', 'المسجد النبوي'], ['nature', 'طبيعة'], ['paintings', 'لوحات فنية'], ['calligraphy', 'خط عربي'], ['mine', 'صور من موبايلي']];
const L_INTERVALS = [[30, '٣٠ ثانية'], [60, 'دقيقة'], [120, 'دقيقتين'], [180, '٣ دقايق'], [300, '٥ دقايق'], [600, '١٠ دقايق']];
const viewsFor = id => id === 'row-apps' ? [['الافتراضي', ''], ['الأسماء ظاهرة', 'names'], ['بدون عنوان', 'notitle']]
  : id.startsWith('row-') ? [['الافتراضي', ''], ['مضغوط', 'compact'], ['بدون عنوان', 'notitle']]
  : id === 'wisdom' ? [['الافتراضي', ''], ['النص فقط', 'textonly']]
  : id === 'adhanbox' ? [['الافتراضي', ''], ['الأذان الجاي فقط', 'nextonly']]
  : id === 'newscard' ? [['زجاجي مع صورة', ''], ['بطاقة كبيرة', 'big'], ['شريط أخبار', 'ticker'], ['عنوان فقط', 'headline']] : null;

const hide = (...ids) => Object.fromEntries(ids.map(i => [i, { hidden: true }]));
const CLUBS = [{"id": "real-madrid", "name": "ريال مدريد", "nick": "الملكي", "ids": [86], "a": "#1d3f8f", "b": "#FEBE10", "c": "#050a18", "t": "#ffffff", "lg": "إسبانيا", "nat": false}, {"id": "barcelona", "name": "برشلونة", "nick": "البلوغرانا", "ids": [83], "a": "#A50044", "b": "#EDBB00", "c": "#071a3d", "t": "#ffffff", "lg": "إسبانيا", "nat": false}, {"id": "atletico", "name": "أتلتيكو مدريد", "nick": "الروخيبلانكوس", "ids": [1068], "a": "#CB3524", "b": "#ffffff", "c": "#141a3d", "t": "#ffffff", "lg": "إسبانيا", "nat": false}, {"id": "liverpool", "name": "ليفربول", "nick": "الريدز", "ids": [364], "a": "#C8102E", "b": "#F6EB61", "c": "#1a0306", "t": "#ffffff", "lg": "إنگلترا", "nat": false}, {"id": "man-city", "name": "مانشستر سيتي", "nick": "السيتيزنز", "ids": [382], "a": "#6CABDD", "b": "#1C2C5B", "c": "#0b1730", "t": "#0b1730", "lg": "إنگلترا", "nat": false}, {"id": "man-united", "name": "مانشستر يونايتد", "nick": "الشياطين الحمر", "ids": [360], "a": "#DA291C", "b": "#FBE122", "c": "#0b0b0b", "t": "#ffffff", "lg": "إنگلترا", "nat": false}, {"id": "arsenal", "name": "آرسنال", "nick": "المدفعجية", "ids": [359], "a": "#EF0107", "b": "#ffffff", "c": "#14060a", "t": "#ffffff", "lg": "إنگلترا", "nat": false}, {"id": "chelsea", "name": "تشيلسي", "nick": "البلوز", "ids": [363], "a": "#034694", "b": "#DBA111", "c": "#04102a", "t": "#ffffff", "lg": "إنگلترا", "nat": false}, {"id": "tottenham", "name": "توتنهام", "nick": "السبيرز", "ids": [367], "a": "#132257", "b": "#ffffff", "c": "#050916", "t": "#ffffff", "lg": "إنگلترا", "nat": false}, {"id": "bayern", "name": "بايرن ميونخ", "nick": "البافاري", "ids": [132], "a": "#DC052D", "b": "#0066B2", "c": "#12050a", "t": "#ffffff", "lg": "ألمانيا", "nat": false}, {"id": "dortmund", "name": "بوروسيا دورتموند", "nick": "أسود الفيستفاليا", "ids": [124], "a": "#FDE100", "b": "#111111", "c": "#0c0c0c", "t": "#111111", "lg": "ألمانيا", "nat": false}, {"id": "psg", "name": "باريس سان جيرمان", "nick": "الفريق الباريسي", "ids": [160], "a": "#004170", "b": "#DA291C", "c": "#020b1a", "t": "#ffffff", "lg": "فرنسا", "nat": false}, {"id": "juventus", "name": "يوفنتوس", "nick": "السيدة العجوز", "ids": [111], "a": "#1e1e1e", "b": "#ffffff", "c": "#000000", "t": "#ffffff", "lg": "إيطاليا", "nat": false}, {"id": "inter", "name": "إنتر ميلان", "nick": "النيراتزوري", "ids": [110], "a": "#0068A8", "b": "#0a0a0a", "c": "#010e2a", "t": "#ffffff", "lg": "إيطاليا", "nat": false}, {"id": "milan", "name": "ميلان", "nick": "الروسونيري", "ids": [103], "a": "#FB090B", "b": "#111111", "c": "#0a0000", "t": "#ffffff", "lg": "إيطاليا", "nat": false}, {"id": "napoli", "name": "نابولي", "nick": "البارتينوبي", "ids": [114], "a": "#12A0D7", "b": "#ffffff", "c": "#04162c", "t": "#ffffff", "lg": "إيطاليا", "nat": false}, {"id": "al-shorta", "name": "الشرطة", "nick": "القيثارة الخضراء", "ids": [9655], "a": "#0f7a3a", "b": "#ffffff", "c": "#03140a", "t": "#ffffff", "lg": "العراق", "nat": false}, {"id": "al-zawraa", "name": "الزوراء", "nick": "النوارس", "ids": [4375], "a": "#e9eef2", "b": "#0a0a0a", "c": "#101418", "t": "#0b0b0b", "lg": "العراق", "nat": true}, {"id": "al-quwa", "name": "القوة الجوية", "nick": "الصقور", "ids": [20912], "a": "#3d9fd8", "b": "#ffffff", "c": "#04121e", "t": "#ffffff", "lg": "العراق", "nat": false}, {"id": "al-talaba", "name": "الطلاب", "nick": "الأنيق", "ids": [4375], "a": "#1a1a1a", "b": "#2f7de1", "c": "#05070c", "t": "#ffffff", "lg": "العراق", "nat": true}, {"id": "erbil", "name": "أربيل", "nick": "دوري نجوم العراق", "ids": [4375], "a": "#f4c400", "b": "#111111", "c": "#0d0d05", "t": "#111111", "lg": "العراق", "nat": true}];
const SKINS = [['classic', 'الكلاسيكي', 'الساعة والأقسام فوق والتطبيقات تحت'], ['ribbon', 'الشاشة الذكية', 'شريط تطبيقات بالأسفل فوق الخلفية'],
  ['shelf', 'الرف الأنيق', 'الخلفية بالنص وتطبيقات كبيرة ناعمة'], ['club', 'هوية النادي', 'لوحة النادي ومبارياته']];
const PALETTES = [[null, 'بدون'], [{ a: '#e8364f', b: '#ffffff', c: '#08090f' }, 'أحمر'], [{ a: '#1f4fd8', b: '#ffffff', c: '#06091a' }, 'أزرق'],
  [{ a: '#16a34a', b: '#ffffff', c: '#04140b' }, 'أخضر'], [{ a: '#d4a64a', b: '#ffffff', c: '#050403' }, 'ذهبي'], [{ a: '#a77bff', b: '#ffffff', c: '#0d0718' }, 'بنفسجي'],
  [{ a: '#ff6fb5', b: '#ffd166', c: '#1a0612' }, 'وردي'], [{ a: '#12A0D7', b: '#ffffff', c: '#04162c' }, 'سماوي'], [{ a: '#f4c400', b: '#111111', c: '#0d0d05', t: '#111111' }, 'أصفر']];
const clubTeam = c => Object.assign({ ids: c.ids, name: c.name, nick: c.nick, logo: c.nat ? '' : 'https://a.espncdn.com/i/teamlogos/soccer/500/' + c.ids[0] + '.png' }, c.nat ? { matchLabel: 'المنتخب العراقي', nextLabel: 'مباراة المنتخب الجاية' } : {});
const GAL_URL = 'https://github.com/hnt45y-111/clean-tv/releases/download/gallery/';
const clubPack = c => Array.from({ length: 15 }, (_, i) => GAL_URL + 'bg-' + c.id + '-' + String(i + 1).padStart(2, '0') + '.jpg');
const clubCfg = c => ({ settings: { skin: 'club', religious: false, palette: { a: c.a, b: c.b, c: c.c, t: c.t }, team: clubTeam(c), bgPack: clubPack(c), bgInterval: 60 }, layout: { adhanbox: { hidden: true }, weather: { hidden: true }, 'row-apps': { view: 'names' } } });
const TEMPLATES = [
  { id: 'smart', name: 'الشاشة الذكية', note: 'شريط تطبيقات بالأسفل', theme: 'midnight', s: { skin: 'ribbon', religious: false, palette: PALETTES[1][0] }, bg: ['nature'] },
  { id: 'smartl', name: 'الشاشة الذكية الفاتحة', note: 'شريط فاتح وبطاقات عريضة', theme: 'silver', s: { skin: 'ribbon', variant: 'light', religious: false, palette: PALETTES[2][0] }, bg: ['nature'] },
  { id: 'shelf', name: 'الرف الأنيق', note: 'تطبيقات كبيرة ناعمة', theme: 'appletv', s: { skin: 'shelf', religious: false }, bg: ['nature'] },
  { id: 'club', name: 'نادي كرة قدم', note: 'اختار ناديك بعدين', theme: 'default', club: true },
  { id: 'classic', name: 'الكلاسيكي', note: 'كل الأقسام، ذهبي ليلي', theme: 'default', layout: {} },
  { id: 'simple', name: 'البسيط', note: 'ساعة وتطبيقات بس', theme: 'minimal', s: { religious: false }, layout: hide('weather', 'wisdom', 'bigcount', 'row-occasions', 'row-matches', 'adhanbox') },
  { id: 'faith', name: 'الإيماني', note: 'العتبات والأذان والمناسبات', theme: 'karbala', bg: ['shrines', 'ahlulbayt'], layout: hide('row-matches') },
];

let D = null; // { name, from, cfg, sel, tab, dirty, pid }
const deepCopy = o => JSON.parse(JSON.stringify(o || {}));
const projects = () => kv('projects', []);

function renderDesign() {
  $('#dMenu').innerHTML = ic('more');
  $('#dMenu').style.visibility = D ? 'visible' : 'hidden';
  $('#dMenu').onclick = designMenu;
  if (!D) return designStart();
  designEditor();
}

function designStart() {
  $('#dTitle').textContent = 'الواجهة';
  removeDock();
  const pr = projects();
  $('#designBody').innerHTML = `
    <p class="sub" style="margin:0 2px 14px">صمّم شكل شاشة التلفزيون من موبايلك. كل تعديل تشوفه بالمعاينة قبل ما ينطبق.</p>
    <div class="tile">
      <button data-s="tv">${ic('tv')}<b>عدّل الواجهة الحالية</b><small>يجيب شكل الشاشة المتصلة وتعدل عليه</small></button>
      <button data-s="new">${ic('plus')}<b>صمّم من الصفر</b><small>اختار قالب وابدأ</small></button>
      <button data-s="import">${ic('file')}<b>استيراد مشروع</b><small>ملف وصلك أو حفظته قبل</small></button>
      <button data-s="ready">${ic('layers')}<b>معرض الواجهات</b><small>واجهات جاهزة تنزلها وتثبتها بضغطة</small></button>
    </div>
    <h2>مشاريعي</h2>
    <div class="list">${pr.length ? pr.map(p => `<div class="item tap" data-p="${esc(p.id)}">${ic('layers')}<div class="t"><b>${esc(p.name)}</b><small>${fmtDate(p.at)}</small></div>${ic('left')}</div>`).join('')
      : `<div class="empty">ما عندك مشاريع محفوظة. ابدأ تصميم واحفظه حتى يطلع هنا.</div>`}</div>`;
  $('#designBody').onclick = e => {
    const b = e.target.closest('[data-s]');
    if (b) { tap(); ({ tv: designFromTv, new: designNew, import: designImport, ready: openGallery })[b.dataset.s](); return; }
    const p = e.target.closest('[data-p]');
    if (p) { const x = projects().find(q => q.id === p.dataset.p); if (x) projectSheet(x); }
  };
}

function projectSheet(p) {
  sheet(`<h2>${esc(p.name)}</h2><p class="sub">${fmtDate(p.at)}</p>
    <button class="btn pri full" data-x="open">${ic('layers')} فتح وتعديل</button><div style="height:10px"></div>
    <button class="btn sec full" data-x="apply">${ic('tv')} تطبيق على الشاشة مباشرة</button><div style="height:10px"></div>
    <button class="btn sec full" data-x="share">مشاركة المشروع</button><div style="height:10px"></div>
    <button class="btn bad full" data-x="del">${ic('trash')} حذف</button>`);
  $('#sheetBody').onclick = async e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    if (x.dataset.x === 'open') { closeSheet(); openDesign({ name: p.name, from: 'project', cfg: deepCopy(p.cfg), pid: p.id }); }
    if (x.dataset.x === 'apply') { closeSheet(); applyToTv(p.cfg); }
    if (x.dataset.x === 'share') { closeSheet(); exportDesign(p.name, p.cfg); }
    if (x.dataset.x === 'del') {
      if (x.dataset.sure !== '1') { x.dataset.sure = '1'; x.textContent = 'متأكد؟ اضغط مرة ثانية'; return; }
      kvSet('projects', projects().filter(q => q.id !== p.id)); closeSheet(); designStart();
    }
  };
}

function designNew() {
  sheet(`<h2>اختار قالب تبدي منه</h2><p class="sub">كل قالب تگدر تغيّر بيه كل شي بعدين.</p>
    <div class="tpl">${TEMPLATES.map(t => { const th = L_THEMES.find(x => x[0] === t.theme) || L_THEMES[0];
      return `<button data-t="${t.id}"><div class="sw2" style="background:linear-gradient(135deg,${th[2]},${th[3]}55)"><i style="background:${th[3]}"></i><i></i></div><b>${esc(t.name)}</b><small>${esc(t.note)}</small></button>`; }).join('')}</div>`);
  $('#sheetBody').onclick = e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const t = TEMPLATES.find(x => x.id === b.dataset.t);
    closeSheet();
    if (t.club) { clubPicker(c => openDesign({ name: 'واجهة ' + c.name, from: 'new', cfg: Object.assign({ v: 1 }, deepCopy(clubCfg(c))) })); return; }
    const cfg = { v: 1, settings: Object.assign({ theme: t.theme }, deepCopy(t.s || {})), layout: deepCopy(t.layout || {}) };
    if (t.bg) cfg.settings.bgSources = t.bg;
    openDesign({ name: 'تصميم ' + t.name, from: 'new', cfg });
  };
}

async function designFromTv() {
  if (!need()) return;
  busy('أجيب شكل الشاشة الحالي…');
  try {
    const cfg = JSON.parse(await run('cfgGet'));
    unbusy();
    openDesign({ name: 'واجهة ' + tvName(), from: 'tv', cfg });
  } catch (e) {
    unbusy();
    if (e.message === 'NOCFG') needLauncherSheet('حتى نعدل الواجهة الحالية لازم تكون «واجهة مدير الشاشات» النسخة الجديدة منصّبة على الشاشة.', designFromTv);
    else toast(errText(e));
  }
}

function needLauncherSheet(text, then) {
  sheet(`<h2>نحتاج واجهة مدير الشاشات</h2><p class="sub">${esc(text)}</p>
    <button class="btn pri full" id="nlGo">${ic('layers')} نصّب أو حدّث واجهة مدير الشاشات</button>
    <button class="btn ghost full" id="nlNew">صمّم من الصفر بدلها</button>`);
  $('#nlGo').onclick = async () => {
    closeSheet(); busy('أنصب واجهة مدير الشاشات…');
    try { afterLauncher(await run('launcher')); unbusy(); toast('تم تنصيب الواجهة'); await new Promise(r => setTimeout(r, 4000)); then && then(); }
    catch (e) { unbusy(); toast(errText(e)); }
  };
  $('#nlNew').onclick = () => { closeSheet(); designNew(); };
}

function designImport() {
  sheet(`<h2>استيراد مشروع</h2>
    <button class="btn pri full" id="imFile">${ic('file')} من ملف بالموبايل</button><div style="height:10px"></div>
    <label class="f">أو من رابط بالإنترنت</label><input id="imUrl" class="num" placeholder="https://…/design.json" inputmode="url">
    <button class="btn sec full" id="imGo" style="margin-top:10px">${ic('save')} نزّل من الرابط</button>`);
  $('#imFile').onclick = () => { closeSheet(); importFile(); };
  $('#imGo').onclick = async () => {
    const u = $('#imUrl').value.trim(); if (!/^https?:\/\//.test(u)) return toast('اكتب رابط صحيح');
    closeSheet(); busy('أنزل المشروع…');
    try { const t = await run('fetchText', { url: u }); unbusy(); openImported(t); } catch (e) { unbusy(); toast(errText(e)); }
  };
}
function openImported(t) {
  let o; try { o = JSON.parse(t); } catch (e) { return toast('الملف مو مشروع واجهة'); }
  const cfg = o.type === 'moamal-design' ? o.cfg : (o.settings || o.layout ? o : null);
  if (!cfg) return toast('الملف مو مشروع واجهة');
  show('design'); openDesign({ name: o.name || 'مشروع مستورد', from: 'file', cfg });
}
function importFile() {
  busy('اختار ملف المشروع…');
  run('pick', { mode: 'backup' }).then(t => {
    unbusy();
    let o; try { o = JSON.parse(t); } catch (e) { return toast('الملف مو مشروع واجهة'); }
    const cfg = o.type === 'moamal-design' ? o.cfg : (o.settings || o.layout ? o : null);
    if (!cfg) return toast('الملف مو مشروع واجهة');
    openDesign({ name: o.name || 'مشروع مستورد', from: 'file', cfg });
  }).catch(e => { unbusy(); if (e.message !== 'CANCEL') toast(errText(e)); });
}

function openDesign(d) {
  if (d && d.cfg) { delete d.cfg.dev; delete d.cfg.stamp; if (d.cfg.settings) { delete d.cfg.settings.sat; if (d.cfg.settings.skin === 'iptv') d.cfg.settings.skin = 'classic'; } if (d.cfg.layout) delete d.cfg.layout['row-sat']; }
  D = Object.assign({ sel: null, tab: 'el', dirty: false }, d);
  D.cfg.settings = D.cfg.settings || {};
  D.cfg.layout = D.cfg.layout || {};
  renderDesign();
}

function clubPicker(done, allowNone) {
  const groups = {}; CLUBS.forEach(c => (groups[c.lg] = groups[c.lg] || []).push(c));
  sheet(`<h2>اختار النادي</h2>${allowNone ? `<button class="btn sec full" data-c="__none" style="margin-bottom:12px">الفرق المشهورة (الافتراضي)</button>` : ''}
    ${Object.entries(groups).map(([lg, l]) => `<div class="sub" style="margin:8px 2px">${esc(lg === 'العراق' ? 'أندية العراق' : 'أندية ' + lg)}</div><div class="chips">${l.map(c => `<button class="chip" data-c="${c.id}"><span class="cdot" style="background:linear-gradient(135deg,${c.a} 50%,${c.b} 50%);width:20px;height:20px"></span>${esc(c.name)}</button>`).join('')}</div>`).join('')}`);
  $('#sheetBody').onclick = e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    closeSheet(); tap();
    done(b.dataset.c === '__none' ? null : CLUBS.find(c => c.id === b.dataset.c));
  };
}

/* ---------- preview frame ---------- */
let pvApps = null;
const KNOWN_APPS = {
  'com.google.android.youtube.tv': ['يوتيوب', '#ff0000'], 'com.netflix.ninja': ['نتفلكس', '#e50914'], 'net.mbc.shahid': ['شاهد', '#1fb36a'],
  'com.android.vending': ['المتجر', '#01875f'], 'com.android.tv.settings': ['الإعدادات', '#607d8b'], 'org.videolan.vlc': ['VLC', '#ff8800'],
  'com.google.android.apps.youtube.music': ['يوتيوب ميوزك', '#ff0033'], 'com.spotify.tv.android': ['سبوتيفاي', '#1db954'],
  'org.xbmc.kodi': ['كودي', '#17b2e7'], 'com.amazon.amazonvideo.livingroom': ['برايم', '#00a8e1'], 'tv.twitch.android.app': ['تويتش', '#9146ff'],
};
const PV_DEMO = () => [['يوتيوب', '#ff0000'], ['نتفلكس', '#e50914'], ['شاهد', '#1fb36a'], ['المتجر', '#01875f'], ['الإعدادات', '#607d8b'], ['VLC', '#ff8800'], ['كودي', '#17b2e7'], ['الملفات', '#5b6b8c']]
  .map(([label, color], i) => ({ pkg: 'demo.' + i, label, color }));
async function previewApps() {
  if (pvApps) return pvApps;
  const demo = PV_DEMO();
  if (!CONN.connected) return demo;
  try {
    const out = await sh('cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER');
    const pk = [...new Set(out.split('\n').map(l => l.trim().split('/')[0]).filter(p => /^[a-z][\w.]+$/i.test(p) && p.includes('.')))];
    if (!pk.length) return demo;
    pvApps = pk.slice(0, 16).map(p => {
      const k = KNOWN_APPS[p], last = p.split('.').filter(x => !/^(com|android|tv|app|google|org|net)$/.test(x)).pop() || p;
      return { pkg: p, label: k ? k[0] : last.charAt(0).toUpperCase() + last.slice(1), color: k ? k[1] : '#' + ((Math.abs([...p].reduce((h, c) => h * 31 + c.charCodeAt(0) | 0, 7)) % 0xaaaaaa) + 0x222222).toString(16).slice(0, 6) };
    });
    return pvApps;
  } catch (e) { return demo; }
}
async function loadPreview(frame) {
  CFG_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  CFG_KEYS.forEach(k => { if (D.cfg[k] !== undefined && D.cfg[k] !== null) try { localStorage.setItem(k, JSON.stringify(D.cfg[k])); } catch (e) {} });
  let bg = [];
  try { bg = JSON.parse(B.assetList('launcher/bg')).filter(n => /\.(jpe?g|png|webp)$/i.test(n)).map(n => 'bg/' + n); } catch (e) {}
  /* a stuck connection must never hold the preview: after 3 s the sample apps are shown and the real ones come next time */
  const apps = pvApps || await Promise.race([previewApps().catch(() => null), new Promise(r => setTimeout(() => r(null), 3000))]) || PV_DEMO();
  if (!D) return;
  window.__PREVIEW_DATA = { apps, bg, tv: !!(INFO && INFO.isTv), cfg: deepCopy(D.cfg) };
  frame.src = 'launcher/index.html?preview=1&t=' + Date.now();
}
window.__previewSelect = id => {
  if (!D || !id || id === D.sel) return;
  tap(); D.sel = id; D.tab = 'el'; designPanel(); live({ select: id });
};
/* The TV page is drawn at the size a TV gives it (960×540 CSS px) and shrunk to the box, so sizes, positions and
   text look exactly like on the TV (a 360px-wide frame pushed moved widgets off-screen and squeezed text). */
const TV_W = 960, TV_H = 540;
function fitFrame(f, box, w, h) {
  if (!f || !box) return;
  const k = Math.min(box.clientWidth / w, box.clientHeight / h) || 0;
  f.style.width = w + 'px'; f.style.height = h + 'px';
  f.style.transform = 'scale(' + k + ')'; f.style.webkitTransform = 'scale(' + k + ')';
}
function fitFrames() {
  fitFrame($('#tvPv #pvf'), $('#tvPv'), TV_W, TV_H);
  const full = $('#pvFull');
  if (full && full.classList.contains('on')) fitFrame($('#pvFullF'), full.querySelector('.rot'), TV_W, TV_H);
}
window.addEventListener('resize', () => fitFrames());
function frameWin() { const f = $('#pvf'); return f && f.contentWindow; }
let pvReloadT = null;
/* Every change shows in the preview: quick changes go straight to the page, and the page is then
   rebuilt from the full design so nothing is left behind (club, theme, widgets, backgrounds…). */
const TOP_TOOLS_ST = [['saver', 'شاشة التوقف'], ['search', 'البحث'], ['settings', 'إعدادات الجهاز'], ['wifi', 'الواي فاي'], ['net', 'الشبكة'], ['bt', 'البلوتوث'],
  ['mem', 'تنظيف الذاكرة'], ['mute', 'كتم الصوت'], ['sleep', 'مؤقت النوم'], ['edit', 'تعديل الشاشة'], ['power', 'الطاقة'], ['tvpic', 'الصورة'], ['tvsound', 'الصوت'], ['tvdim', 'تعتيم']];
function topTools() {
  const S = D.cfg.settings;
  if (S.topTools && S.topTools.length) return S.topTools;
  const l = ['saver', 'search', 'settings', 'wifi', 'edit', 'power'];
  return INFO && INFO.isTv && S.tvCtl !== 'off' ? ['tvpic', 'tvsound', 'sleep', 'tvdim'].concat(l) : l;
}
function live(o) {
  /* the page in the frame reads the design from here, so it always gets the latest one (no stale template after a quick change) */
  try { if (D && window.__PREVIEW_DATA && !(typeof isCarD === 'function' && isCarD())) window.__PREVIEW_DATA.cfg = deepCopy(D.cfg); } catch (e) {}
  if (o && D && o.settings === D.cfg.settings) o = Object.assign({}, o, { full: true });
  try { const w = frameWin(); if (w && w.__live) w.__live(o); } catch (e) {}
  const keys = Object.keys(o || {}).filter(k => k !== 'select');
  if (!keys.length) return;
  const quick = keys.every(k => k === 'layout');
  clearTimeout(pvReloadT);
  pvReloadT = setTimeout(() => {
    const f = $('#pvf'); if (!f || !D) return;
    f.style.transition = 'opacity .2s'; f.style.opacity = '.6';
    f.onload = () => { f.style.opacity = '1'; if (D && D.sel) try { frameWin().__live({ select: D.sel }); } catch (e) {} };
    if (typeof isCarD === 'function' && isCarD()) carLoadPreview(f); else loadPreview(f);
  }, quick ? 900 : 300);
}
function designEditor() {
  $('#dTitle').textContent = D.name;
  $('#designBody').innerHTML = `
    <div class="pv" id="tvPv"><iframe id="pvf" class="virt" title="معاينة الواجهة"></iframe><button class="full" id="pvBig" aria-label="معاينة كاملة">${ic('screen')}</button></div>
    <div class="hint">${ic('info')} اضغط على أي جزء بالمعاينة حتى تعدّله</div>
    <div class="seg" id="dSeg">
      <button data-tab="el">العناصر</button><button data-tab="theme">الثيم</button><button data-tab="bg">الخلفيات</button><button data-tab="set">الإعدادات</button>
    </div>
    <div id="dPanel"></div><div style="height:70px"></div>`;
  const f = $('#pvf');
  f.onload = () => { if (D.sel) live({ select: D.sel }); };
  loadPreview(f);
  fitFrames(); setTimeout(fitFrames, 250);
  $('#pvBig').onclick = () => {
    CFG_KEYS.forEach(k => { try { localStorage.removeItem(k); if (D.cfg[k] !== undefined && D.cfg[k] !== null) localStorage.setItem(k, JSON.stringify(D.cfg[k])); } catch (e) {} });
    if (window.__PREVIEW_DATA) window.__PREVIEW_DATA.cfg = deepCopy(D.cfg);
    const ff = $('#pvFullF'); ff.src = 'launcher/index.html?preview=1&t=' + Date.now();
    $('#pvFull').classList.add('on'); fitFrames();
  };
  $('#pvFullX').onclick = () => { $('#pvFull').classList.remove('on'); $('#pvFullF').src = 'about:blank'; };
  $('#dSeg').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; tap(); D.tab = b.dataset.tab; designPanel(); };
  designPanel();
  addDock();
}

function addDock() {
  removeDock();
  const top = $('#dMenu').parentNode;
  const d = document.createElement('div');
  d.className = 'dacts'; d.id = 'dock';
  d.innerHTML = `<button class="iconbtn" data-d="save" aria-label="حفظ بمشاريعي">${ic('save')}</button><button class="btn pri sm" data-d="apply">${ic('tv')} صدّر للشاشة</button>`;
  top.insertBefore(d, $('#dMenu'));
  const fin = document.createElement('div');
  fin.className = 'panel'; fin.id = 'dFin';
  fin.innerHTML = `<h2>خلصت التعديل؟</h2><p class="sub" style="margin-top:-4px">كل تعديل يبقى بالمعاينة هنا بس. الشاشة ما تتغير إلا من تضغط «صدّر للشاشة» وتأكد.</p>
    <div style="display:flex;gap:8px"><button class="btn sec" style="flex:1" data-d="save">${ic('save')} حفظ</button><button class="btn pri" style="flex:1.4" data-d="apply">${ic('tv')} صدّر للشاشة</button></div>`;
  const sp = $('#dPanel') && $('#dPanel').nextElementSibling;
  if (sp) sp.before(fin); else $('#designBody').appendChild(fin);
  const go = e => { const b = e.target.closest('[data-d]'); if (!b) return; tap(); b.dataset.d === 'save' ? saveProject() : confirmApply(); };
  d.onclick = go; fin.onclick = go;
}
function confirmApply() {
  if (!need()) return;
  sheet(`<h2>تصدير للشاشة</h2><p class="sub">راح ينطبق «${esc(D.name)}» على ${esc(tvName() || 'الشاشة')} ويبدل الواجهة اللي عليها هسه.</p>
    <button class="btn pri full" id="caYes">${ic('tv')} إي، صدّر هسه</button><div style="height:8px"></div><button class="btn ghost full" id="caNo">لا، أكمّل تعديل</button>`);
  $('#caYes').onclick = () => { closeSheet(); applyToTv(D.cfg); };
  $('#caNo').onclick = closeSheet;
}
function removeDock() { ['#dock', '#dFin'].forEach(q => { const d = $(q); if (d) d.remove(); }); }
const _show = show;
show = function (id) { if (id !== 'design') removeDock(); _show(id); };

function chips(list, cur, attr, colorFn) {
  /* lists are [label, value]; a few old ones were written [value, label] and their buttons sent the label as the value */
  list = list.map(x => (typeof x[0] === 'number' && typeof x[1] === 'string') ? [x[1], x[0]] : x);
  return `<div class="chips">${list.map(([n, v]) => `<button class="chip ${String(v) === String(cur ?? '') ? 'on' : ''}" data-${attr}="${esc(v)}">${colorFn ? colorFn(v) : ''}${esc(n)}</button>`).join('')}</div>`;
}
function slider(label, key, min, max, step, val, fmt) {
  return `<div class="ctl"><div class="lb"><span>${label}</span><b id="v_${key}">${fmt(val)}</b></div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-r="${key}"></div>`;
}

function designPanel() {
  document.querySelectorAll('#dSeg button').forEach(b => b.classList.toggle('on', b.dataset.tab === D.tab));
  const p = $('#dPanel'), S = D.cfg.settings;
  if (D.tab === 'el') {
    const opts = chips(EDITABLES.map(([id, n]) => [n, id]), D.sel, 'sel');
    if (!D.sel) { p.innerHTML = `<div class="sub" style="margin-bottom:10px">أو اختار جزء من هنا:</div>${opts}`; }
    else {
      const id = D.sel, name = (EDITABLES.find(x => x[0] === id) || [, id])[1], L = D.cfg.layout[id] || {};
      const views = viewsFor(id);
      p.innerHTML = `<div class="panel" style="padding:16px">
        <div class="row" style="margin-bottom:14px"><h2 style="margin:0;flex:1">${esc(name)}</h2>
          <button class="chip ${L.hidden ? '' : 'on'}" data-hide="1">${L.hidden ? 'مخفي' : 'ظاهر'}</button></div>
        ${slider('الحجم', 's', 50, 200, 5, Math.round((L.s || 1) * 100), v => v + '%')}
        ${slider('يمين ويسار', 'x', -600, 600, 10, L.x || 0, v => v)}
        ${slider('فوق وجوه', 'y', -400, 400, 10, L.y || 0, v => v)}
        <div class="ctl"><div class="lb"><span>الخط</span></div>${chips(L_FONTS, L.font, 'font')}</div>
        <div class="ctl"><div class="lb"><span>لون النص</span></div>${chips(L_COLORS, L.color, 'color', v => v ? `<span class="cdot" style="background:${v};width:18px;height:18px"></span>` : '')}</div>
        <div class="ctl"><div class="lb"><span>خلفية المربع</span></div>${chips([['الافتراضية', ''], ['شفافة', 'clear'], ['لون', 'color'], ['صورة من موبايلي', 'img']], L.bgMode || (L.bg ? 'color' : ''), 'bgm')}</div>
        ${(L.bgMode || (L.bg ? 'color' : '')) === 'color' ? `<div class="ctl"><div class="lb"><span>اللون</span></div>${chips(L_BGS.filter(x => x[1]), L.bg, 'bg', v => `<span class="cdot" style="background:rgb(${v});width:18px;height:18px"></span>`)}</div>
          ${slider('قوة اللون', 'alpha', 0, 100, 5, L.alpha == null ? 50 : L.alpha, v => v + '%')}` : ''}
        ${L.bgMode === 'img' ? `<div class="row" style="gap:10px;align-items:center;margin:6px 0 10px">${L.bgImg ? `<div style="width:90px;height:56px;border-radius:10px;background:#000 url('${esc(L.bgImg)}') center/cover;flex:none"></div>` : ''}<button class="btn sec" style="flex:1" data-bgimg="1">${ic('plus')} ${L.bgImg ? 'غيّر الصورة' : 'اختار صورة'}</button></div>
          ${slider('تعتيم الصورة (حتى يبين النص)', 'alpha', 0, 90, 5, L.alpha == null ? 35 : L.alpha, v => v + '%')}` : ''}
        <div class="ctl"><div class="lb"><span>${id === 'row-apps' ? 'شكل الأيقونات' : 'الشكل'}</span></div>${chips(id === 'row-apps' ? L_APP_SHAPES : L_SHAPES, id === 'row-apps' ? (L.shape || 'circle') : L.shape, 'shape')}</div>
        ${views ? `<div class="ctl"><div class="lb"><span>طريقة العرض</span></div>${chips(views, L.view, 'view')}</div>` : ''}
        <button class="btn ghost full" data-reset="1">${ic('undo')} رجّع هذا الجزء لأصله</button>
      </div><div class="sub" style="margin:4px 2px 10px">أجزاء ثانية:</div>${opts}`;
    }
  } else if (D.tab === 'theme') {
    const curPal = JSON.stringify(S.palette || null);
    p.innerHTML = `<div class="panel"><h2>شكل الواجهة</h2><div class="list" style="margin:0">${SKINS.map(([id, n, d]) => `<div class="item tap" data-skin="${id}"><div class="t"><b>${esc(n)}</b><small>${esc(d)}</small></div>${(S.skin || 'classic') === id ? '<span class="tag">المختار</span>' : ''}</div>`).join('')}</div>
      ${S.skin === 'ribbon' ? `<div class="item tap" data-tg="__light" style="padding:12px 0 0;min-height:0"><div class="t"><b>شريط فاتح</b></div><div class="toggle ${S.variant === 'light' ? 'on' : ''}"></div></div>` : ''}
      ${S.skin === 'club' ? `<button class="btn sec full" id="pickClub" style="margin-top:12px">${ic('layers')} ${S.team ? 'النادي: ' + esc(S.team.name) : 'اختار النادي'}</button>
        <div class="lb" style="margin:12px 0 6px"><span class="sub">خلفية الواجهة</span></div>${chips([['شعار النادي', 'logo'], ['صور النادي', 'photos']], S.clubBg === 'photos' ? 'photos' : 'logo', 'clubbg')}` : ''}</div>
      <div class="panel"><h2>ألوان الهوية</h2><div class="chips">${PALETTES.map(([pl, n], i) => `<button class="chip ${JSON.stringify(pl) === curPal ? 'on' : ''}" data-pal="${i}">${pl ? `<span class="cdot" style="background:linear-gradient(135deg,${pl.a},${pl.b});width:18px;height:18px"></span>` : ''}${esc(n)}</button>`).join('')}</div>
      ${S.palette ? `<div class="item tap" data-tg="__palbg" style="padding:12px 0 0;min-height:0"><div class="t"><b>خلفية بألوان الهوية بدل الصور</b></div><div class="toggle ${S.bgMode === 'palette' ? 'on' : ''}"></div></div>` : ''}</div>
      <h2>الثيم</h2><div class="tpl">${L_THEMES.map(([id, n, a, b]) => `<button data-theme="${id}" style="${(S.theme || 'default') === id ? 'outline:3px solid var(--ac);outline-offset:-3px' : ''}">
      <div class="sw2" style="background:linear-gradient(135deg,${a},${b}66)"><i style="background:${b}"></i><i></i></div><b>${esc(n)}</b><small>${(S.theme || 'default') === id ? 'المختار' : 'اضغط للمعاينة'}</small></button>`).join('')}</div>`;
  } else if (D.tab === 'bg') {
    const src = S.bgSources || ['shrines'];
    p.innerHTML = `<div class="panel"><h2>مصادر الخلفيات</h2><p class="sub">تگدر تختار أكثر من مصدر، والصور تتجدد كل يوم.</p>
      <div class="chips">${L_SOURCES.map(([id, n]) => `<button class="chip ${src.includes(id) ? 'on' : ''}" data-src="${id}">${esc(n)}</button>`).join('')}</div></div>
      <div class="panel"><h2>تتغير الخلفية كل</h2>${chips(L_INTERVALS, S.bgInterval || 300, 'iv')}</div>
      <div class="panel"><h2>خلفيات خاصة بهالتصميم</h2><p class="sub" style="margin-top:-4px">صور تختارها إنت (حتى ١٥)، وتصير هي خلفيات الواجهة بدل المصادر فوق. تنرسل للشاشة ويّا التصميم.</p>
        <div class="tpl" id="packG">${(S.bgPack || []).map((u, i) => `<button data-pk="${i}" style="position:relative"><div class="sw2" style="background:#000 url('${esc(u)}') center/cover;height:84px"></div><small style="padding:6px 10px">${ic('trash')} شيل</small></button>`).join('')}</div>
        ${(S.bgPack || []).length < 15 ? `<button class="btn sec full" id="packAdd" style="margin-top:10px">${ic('plus')} أضف صورة من الموبايل</button>` : ''}
        ${(S.bgPack || []).length ? `<button class="btn ghost full" id="packClr">شيل كل الخلفيات الخاصة</button>` : ''}</div>`;
  } else {
    const city = (() => { try { return frameWin().CITIES || []; } catch (e) { return []; } })();
    p.innerHTML = `
      <div class="panel"><h2>اختصارات الشاشة</h2><p class="sub" style="margin-top:-4px">للتلفزيونات بس (مو البوكسات): المصدر، الصورة، الصوت، مؤقت النوم، والتعتيم. تطلع فوق بالواجهة، وبالبوكس والستيك تنشال وحدها.</p>
        ${chips([['تلقائي حسب الجهاز', 'auto'], ['مخفية', 'off']], S.tvCtl || 'auto', 'tvctl')}</div>
      <div class="panel" id="topToolsP"><h2>شريط المهام</h2><p class="sub" style="margin-top:-4px">اختار الأدوات اللي تطلع فوق بالواجهة. اضغط على أداة حتى تضيفها أو تشيلها، وتنضاف بآخر الشريط.</p>
        <div class="chips">${TOP_TOOLS_ST.map(([id, l]) => `<button class="chip${topTools().includes(id) ? ' on' : ''}" data-ttool="${id}">${topTools().includes(id) ? (topTools().indexOf(id) + 1) + ' · ' : ''}${esc(l)}</button>`).join('')}</div>
        <button class="btn ghost full" id="ttReset" style="margin-top:8px">${ic('refresh')} رجّع الافتراضي</button>
        <div class="lb" style="margin:12px 0 6px"><span class="sub">زر «المداخل» (HDMI والمصادر) بنص الشريط</span></div>
        ${chips([['تلقائي للتلفزيونات', 'auto'], ['يطلع دايماً', 'on'], ['مخفي', 'off']], S.inputsBtn || 'auto', 'inbtn')}</div>
      <div class="panel"><h2>اسم الشاشة</h2><input id="ownerI" value="${esc(S.owner || 'مدير الشاشات')}" maxlength="24"></div>
      <div class="panel"><h2>مباريات أي فريق؟</h2><button class="btn sec full" id="teamBtn">${ic('layers')} ${S.team ? esc(S.team.name) : 'الفرق المشهورة (الافتراضي)'}</button></div>
      <div class="panel"><h2>شاشة التوقف</h2>
        <div class="item tap" data-tg="saverOn" style="padding:0 0 12px;min-height:0"><div class="t"><b>تشغيل شاشة التوقف</b></div><div class="toggle ${S.saverOn !== false ? 'on' : ''}"></div></div>
        ${S.saverOn !== false ? `${chips([['صور مع الساعة', 'photos'], ['ساعة على أسود', 'clock'], ['أسود بالكامل', 'black']], S.saverStyle || 'photos', 'svs')}
        <div class="item tap" data-tg="saverAyah" style="padding:12px 0 0;min-height:0"><div class="t"><b>آية تحت الساعة</b></div><div class="toggle ${S.saverAyah !== false ? 'on' : ''}"></div></div>` : ''}</div>
      <div class="panel"><h2>شاشة التوقف تشتغل بعد</h2>${chips([[5, '٥ دقايق'], [10, '١٠ دقايق'], [15, '١٥ دقيقة'], [30, 'نص ساعة'], [60, 'ساعة']], S.saverMin || 10, 'saver')}</div>
      <div class="panel"><h2>تنبيه الأذان</h2>${chips([['صوت وتنبيه', 'sound'], ['تنبيه بدون صوت', 'banner'], ['متوقف', 'off']], S.adhanMode || 'sound', 'adhan')}</div>
      ${city.length ? `<div class="panel"><h2>المدينة (للأذان والطقس)</h2>${chips(city.map((c, i) => [c[0], i]), D.cfg.cityIdx || 0, 'city')}</div>` : ''}
      <div class="panel"><h2>تعديل التاريخ الهجري</h2>${chips([['-٢', -2], ['-١', -1], ['بدون', 0], ['+١', 1], ['+٢', 2]], D.cfg.hijriOffset || 0, 'hijri')}</div>
      <div class="list">
        <div class="item tap" data-tg="religious"><div class="t"><b>المحتوى الديني</b><small>المناسبات والأعمال اليومية تحت الساعة</small></div><div class="toggle ${S.religious !== false ? 'on' : ''}"></div></div>
        <div class="item tap" data-tg="matchAlerts"><div class="t"><b>تنبيهات المباريات</b></div><div class="toggle ${S.matchAlerts !== false ? 'on' : ''}"></div></div>
        <div class="item tap" data-tg="clickSound"><div class="t"><b>صوت عند التنقل</b></div><div class="toggle ${S.clickSound ? 'on' : ''}"></div></div>
        <div class="item tap" data-tg="saverApps"><div class="t"><b>شاشة التوقف فوق التطبيقات</b></div><div class="toggle ${S.saverApps !== false ? 'on' : ''}"></div></div>
      </div>`;
  }
  p.onclick = panelClick;
  p.oninput = panelInput;
  const pa = $('#packAdd');
  if (pa) pa.onclick = addPhonePhotos;
  const pcl = $('#packClr'); if (pcl) pcl.onclick = () => { S.bgPack = []; changed(); live({ settings: S, bg: true }); designPanel(); };
  const ow = $('#ownerI'); if (ow) ow.onchange = () => { S.owner = ow.value.trim() || 'مدير الشاشات'; changed(); live({ settings: S }); };
  const pc = $('#pickClub'); if (pc) pc.onclick = () => clubPicker(c => { Object.assign(S, deepCopy(clubCfg(c).settings)); changed(); live({ settings: S }); designPanel(); });
  const tb = $('#teamBtn'); if (tb) tb.onclick = () => clubPicker(c => { if (c) S.team = clubTeam(c); else delete S.team; changed(); live({ settings: S }); designPanel(); }, true);
}

function addPhonePhotos() {
  const S = D.cfg.settings;
  busy('اختار صور من موبايلك (حتى ١٥)…');
  run('pick', { mode: 'bgimages' }).then(list => {
    unbusy();
    S.bgPack = list.concat(S.bgPack || []).slice(0, 15);
    if (S.bgMode === 'palette') S.bgMode = '';
    D.tab = 'bg'; changed(); live({ settings: S, bg: true }); designPanel();
    toast('انضافت ' + list.length + ' صورة، وصارت هي خلفيات الواجهة');
  }).catch(e => { unbusy(); if (e.message !== 'CANCEL') toast(errText(e)); });
}
function L() { return D.cfg.layout[D.sel] || (D.cfg.layout[D.sel] = {}); }
function pickWidgetBg() {
  busy('اختار صورة لخلفية المربع…');
  run('pick', { mode: 'image' }).then(u => { unbusy(); const l = L(); l.bgMode = 'img'; l.bgImg = u; if (l.alpha == null || l.alpha > 90) l.alpha = 35; changed(); live({ layout: D.cfg.layout, select: D.sel }); designPanel(); toast('انضافت الصورة'); })
    .catch(e => { unbusy(); if (e.message !== 'CANCEL') toast(errText(e)); });
}
function changed() { D.dirty = true; }
function panelInput(e) {
  const r = e.target.closest('[data-r]'); if (!r || !D.sel) return;
  const k = r.dataset.r, v = +r.value, l = L();
  if (k === 's') { l.s = v / 100; $('#v_s').textContent = v + '%'; }
  else { l[k] = v; $('#v_' + k).textContent = k === 'alpha' ? v + '%' : v; }
  changed(); live({ layout: D.cfg.layout, select: D.sel });
}
function panelClick(e) {
  const t = e.target.closest('button,[data-tg],[data-skin]'); if (!t) return;
  const ds = t.dataset, S = D.cfg.settings;
  if (ds.sel !== undefined) { tap(); D.sel = ds.sel; designPanel(); live({ select: D.sel }); window.scrollTo(0, 0); $('#designBody').scrollTop = 0; return; }
  if (ds.hide) { const l = L(); l.hidden = !l.hidden; }
  else if (ds.font !== undefined) L().font = ds.font;
  else if (ds.color !== undefined) L().color = ds.color;
  else if (ds.bg !== undefined) { const l = L(); l.bg = ds.bg; if (l.bg && l.alpha == null) l.alpha = 50; }
  else if (ds.bgm !== undefined) {
    const l = L(); l.bgMode = ds.bgm;
    if (ds.bgm === 'color' && !l.bg) { l.bg = '0,0,0'; l.alpha = 50; }
    if (ds.bgm !== 'color') delete l.bg;
    if (ds.bgm === 'img' && !l.bgImg) { tap(); changed(); designPanel(); pickWidgetBg(); return; }
  }
  else if (ds.bgimg) { pickWidgetBg(); return; }
  else if (ds.shape !== undefined) L().shape = ds.shape;
  else if (ds.view !== undefined) L().view = ds.view;
  else if (ds.reset) delete D.cfg.layout[D.sel];
  else if (ds.theme) { S.theme = ds.theme; changed(); tap(); live({ settings: { theme: ds.theme } }); designPanel(); return; }
  else if (ds.src === 'mine') { addPhonePhotos(); return; }
  else if (ds.src) { let s = (S.bgSources || ['shrines']).slice(); s = s.includes(ds.src) ? s.filter(x => x !== ds.src) : s.concat(ds.src); if (!s.length) s = ['shrines']; S.bgSources = s;
    if (S.bgPack && S.bgPack.length) { delete S.bgPack; toast('صارت الخلفيات من المصادر اللي اخترتها'); }
    delete D.cfg.bgPinned; if (S.skin === 'club') S.clubBg = 'photos';
    changed(); live({ settings: S, bg: true }); designPanel(); return; }
  else if (ds.pk !== undefined) { S.bgPack.splice(+ds.pk, 1); changed(); live({ settings: S, bg: true }); designPanel(); return; }
  else if (ds.iv) S.bgInterval = +ds.iv;
  else if (ds.saver) S.saverMin = +ds.saver;
  else if (ds.adhan) S.adhanMode = ds.adhan;
  else if (ds.city !== undefined) { D.cfg.cityIdx = +ds.city; changed(); designPanel(); loadPreview($('#pvf')); return; }
  else if (ds.hijri !== undefined) { D.cfg.hijriOffset = +ds.hijri; changed(); designPanel(); loadPreview($('#pvf')); return; }
  else if (ds.tg === '__light') S.variant = S.variant === 'light' ? '' : 'light';
  else if (ds.tg === '__palbg') S.bgMode = S.bgMode === 'palette' ? '' : 'palette';
  else if (ds.tg) { S[ds.tg] = !(ds.tg === 'clickSound' ? !!S[ds.tg] : S[ds.tg] !== false); }
  else if (ds.skin) {
    S.skin = ds.skin;
    if (ds.skin === 'club' && !S.team) { changed(); designPanel(); clubPicker(c => { Object.assign(S, deepCopy(clubCfg(c).settings)); changed(); live({ settings: S, layout: D.cfg.layout }); designPanel(); }); return; }
  }
  else if (ds.pal !== undefined) { S.palette = deepCopy(PALETTES[+ds.pal][0]); if (!S.palette) delete S.bgMode; }
  else if (ds.tvctl) S.tvCtl = ds.tvctl;
  else if (ds.inbtn) S.inputsBtn = ds.inbtn;
  else if (ds.ttool) { const l = topTools().slice(), i = l.indexOf(ds.ttool); if (i >= 0) l.splice(i, 1); else l.push(ds.ttool); S.topTools = l; tap(); changed(); live({ settings: S }); designPanel(); return; }
  else if (e.target.closest('#ttReset')) { delete S.topTools; tap(); changed(); live({ settings: S }); designPanel(); return; }
  else if (ds.clubbg) S.clubBg = ds.clubbg;
  else if (ds.svs) S.saverStyle = ds.svs;
  else return;
  tap(); changed();
  live({ layout: D.cfg.layout, settings: S, select: D.sel, bg: !!(ds.pal !== undefined || ds.skin || ds.tg === '__palbg') });
  designPanel();
}

function designMenu() {
  if (!D) return;
  sheet(`<h2>${esc(D.name)}</h2>
    <div class="list">
      <div class="item tap" data-x="rename">${ic('kb')}<div class="t"><b>تغيير الاسم</b></div></div>
      <div class="item tap" data-x="save">${ic('save')}<div class="t"><b>حفظ بمشاريعي</b></div></div>
      <div class="item tap" data-x="export">${ic('file')}<div class="t"><b>تصدير ومشاركة</b><small>ملف تگدر تدزه لأي أحد</small></div></div>
      ${SESSION && SESSION.admin ? `<div class="item tap" data-x="publish">${ic('layers')}<div class="t"><b>نشر بالمعرض للمشتركين</b><small>يطلع عند الكل وينزّلونه مباشرة</small></div></div>`
        : `<div class="item tap" data-x="submit">${ic('chat')}<div class="t"><b>أرسل تصميمك للمعرض</b><small>إذا عجبنا ننشره للكل باسمك</small></div></div>`}
      <div class="item tap" data-x="reset">${ic('undo')}<div class="t"><b>رجّع كل الأجزاء لأصلها</b></div></div>
      <div class="item tap" data-x="close">${ic('logout')}<div class="t"><b>إغلاق التصميم</b></div></div>
    </div>`);
  $('#sheetBody').onclick = e => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    const k = x.dataset.x; closeSheet();
    if (k === 'rename') nameSheet(n => { D.name = n; $('#dTitle').textContent = n; });
    if (k === 'save') saveProject();
    if (k === 'export') exportDesign(D.name, D.cfg);
    if (k === 'submit') submitDesign();
    if (k === 'publish') publishSheet();
    if (k === 'reset') { D.cfg.layout = {}; live({ layout: D.cfg.layout, select: D.sel }); designPanel(); }
    if (k === 'close') { D = null; renderDesign(); }
  };
}
function nameSheet(done) {
  sheet(`<h2>اسم التصميم</h2><input id="nmI" value="${esc(D.name)}"><button class="btn pri full" id="nmOk" style="margin-top:12px">حفظ الاسم</button>`);
  $('#nmOk').onclick = () => { const n = $('#nmI').value.trim(); if (!n) return; closeSheet(); done(n); };
}
function saveProject() {
  const list = projects();
  const id = D.pid || 'p' + Date.now();
  const item = { id, name: D.name, at: Date.now(), cfg: deepCopy(D.cfg) };
  const i = list.findIndex(p => p.id === id);
  if (i >= 0) list[i] = item; else list.unshift(item);
  kvSet('projects', list.slice(0, 40));
  D.pid = id; D.dirty = false;
  toast('انحفظ بمشاريعي');
}
async function exportDesign(name, cfg) {
  const text = JSON.stringify({ type: 'moamal-design', name, at: Date.now(), cfg }, null, 1);
  try {
    const where = await run('saveText', { name: name.replace(/[\\/:*?"<>|]/g, '_') + '.json', text });
    sheet(`<h2>انحفظ الملف</h2><p class="sub">${esc(where)}</p><p class="sub">تگدر تدز الملف لأي أحد، وهو يفتحه من «استيراد مشروع».</p>
      <button class="btn pri full" id="exSh">مشاركة كنص</button>`);
    $('#exSh').onclick = () => B.share(text);
  } catch (e) { toast(errText(e)); }
}
async function sendPhotos(list, tag) {
  const stamp = Date.now().toString(36), total = list.filter(u => u && u.startsWith('data:')).length;
  let k = 0;
  for (let i = 0; i < list.length; i++) {
    if (!list[i] || !list[i].startsWith('data:')) continue;
    window.onProg('أرسل الصورة ' + (++k) + ' من ' + total + '…');
    list[i] = await run('pushData', { name: tag + stamp + '_' + String(i + 1).padStart(2, '0') + (list[i].startsWith('data:image/png') ? '.png' : '.jpg'), data: list[i] });
  }
  return list;
}
async function localPackToTv(cfg) {
  const S = (cfg = deepCopy(cfg)).settings || {};
  if (S.bgPack && S.bgPack.some(u => u.startsWith('data:'))) await sendPhotos(S.bgPack, 'd');
  return cfg;
}
async function cfgStamp() { try { const c = JSON.parse(await run('cfgGet')); return c.stamp || null; } catch (e) { return null; } }
async function applyToTv(cfg) {
  if (!need()) return;
  busy('أجهّز التصميم…');
  try {
    cfg = await localPackToTv(cfg);
    cfg = deepCopy(cfg);
    if (!cfg.mode) cfg.mode = 'tv';
    const L = cfg.layout || {};
    const imgs = Object.keys(L).filter(k => L[k] && L[k].bgImg && L[k].bgImg.startsWith('data:'));
    if (imgs.length) { const l = imgs.map(k => L[k].bgImg); await sendPhotos(l, 'w'); imgs.forEach((k, i) => { L[k].bgImg = l[i]; }); }
    cfg.stamp = 's' + Date.now().toString(36);
    window.onProg('أرسل التصميم للشاشة…');
    await run('cfgSet', { cfg: JSON.stringify(cfg) });
    try { await sh('am start -n com.cleantv.launcher/.MainActivity'); } catch (e) {}
    window.onProg('أتأكد إن الشاشة طبّقته…');
    let ok = false;
    for (let i = 0; i < 8 && !ok; i++) { await new Promise(r => setTimeout(r, 1200)); ok = (await cfgStamp()) === cfg.stamp; }
    unbusy();
    if (ok) { toast('انطبق على الشاشة ✓'); addLog('تطبيق تصميم على ' + tvName(), []); if (D) { D.dirty = false; } return true; }
    needLauncherSheet('الشاشة استلمت التصميم بس واجهة مدير الشاشات اللي عليها قديمة وما طبّقته. حدّثها هسه وأعيد التطبيق وحدي.', () => applyToTv(cfg));
    return false;
  } catch (e) {
    unbusy();
    if (e.message === 'NOCFG') needLauncherSheet('حتى ينطبق التصميم لازم «واجهة مدير الشاشات» النسخة الجديدة تكون منصّبة على الشاشة. نصّبها وبعدين يتطبق تصميمك وحده.', () => applyToTv(cfg));
    else toast(errText(e));
    return false;
  }
}

/* ============================================================ TV files */
async function openFiles(path) {
  if (!need()) return;
  busy('أفتح المجلد…');
  let rows = [];
  try {
    const out = await sh(`ls -la "${path}" 2>/dev/null`);
    rows = out.split('\n').map(l => {
      const m = /^([dl\-])[rwxst\-]{9}\S*\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+\s+\S+)\s+(.+)$/.exec(l.trim());
      if (!m) return null;
      let name = m[4]; if (m[1] === 'l') name = name.split(' -> ')[0];
      if (name === '.' || name === '..') return null;
      return { dir: m[1] !== '-', size: +m[2], date: m[3], name };
    }).filter(Boolean).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
    unbusy();
  } catch (e) { unbusy(); return toast(errText(e)); }
  const size = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' ميگا' : n > 1024 ? Math.round(n / 1024) + ' كيلو' : n + ' بايت';
  const up = path.split('/').slice(0, -1).join('/') || '/';
  const html = `<p class="sub num" style="direction:ltr;text-align:right">${esc(path)}</p>
    <div class="row" style="margin-bottom:12px"><button class="btn sec" id="fUp">${ic('right')} المجلد الأعلى</button><button class="btn pri" id="fSend">${ic('plus')} أرسل ملف هنا</button></div>
    <div class="list">${rows.length ? rows.map((r, i) => `<div class="item tap" data-f="${i}"><div class="fileic">${ic(r.dir ? 'layers' : 'file')}</div>
      <div class="t"><b style="direction:ltr;text-align:right">${esc(r.name)}</b><small>${r.dir ? 'مجلد' : size(r.size)} · <span class="num">${esc(r.date)}</span></small></div></div>`).join('') : '<div class="empty">المجلد فارغ</div>'}</div>`;
  const inPage = cur === 'page';
  const after = el => {
    $('#fUp').onclick = () => { openFiles(up); };
    $('#fSend').onclick = () => { busy('أرسل الملف…'); run('pick', { mode: 'push', dir: path }).then(r => { unbusy(); toast('وصل: ' + r); openFiles(path); }).catch(er => { unbusy(); if (er.message !== 'CANCEL') toast(errText(er)); }); };
    el.onclick = e => {
      const f = e.target.closest('[data-f]'); if (!f) return;
      const r = rows[+f.dataset.f], full = (path === '/' ? '' : path) + '/' + r.name;
      if (r.dir) { openFiles(full); return; }
      sheet(`<h2 style="direction:ltr;text-align:right">${esc(r.name)}</h2><p class="sub">${size(r.size)}</p>
        <button class="btn pri full" data-x="get">${ic('save')} نزّله للموبايل</button><div style="height:10px"></div>
        ${/\.apk$/i.test(r.name) ? `<button class="btn sec full" data-x="inst">تثبيت على الشاشة</button><div style="height:10px"></div>` : ''}
        <button class="btn bad full" data-x="del">${ic('trash')} حذف من الشاشة</button>`);
      $('#sheetBody').onclick = async ev => {
        const x = ev.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'del' && x.dataset.sure !== '1') { x.dataset.sure = '1'; x.textContent = 'متأكد؟ الحذف نهائي، اضغط مرة ثانية'; return; }
        closeSheet();
        try {
          if (x.dataset.x === 'get') { busy('أنزل الملف…'); toast('انحفظ ← ' + await run('pull', { path: full })); unbusy(); }
          if (x.dataset.x === 'inst') { busy('أثبّت…'); const o = await sh(`pm install -r "${full}"`); unbusy(); toast(/Success/.test(o) ? 'تم التثبيت' : o); }
          if (x.dataset.x === 'del') { await sh(`rm -f "${full}"`); toast('انحذف'); openFiles(path); }
        } catch (er) { unbusy(); toast(errText(er)); }
      };
    };
  };
  page('ملفات الشاشة', html, after);
}

/* ============================================================ trusted app store */
const STORE = [
  ['يوتيوب', 'YouTube for Android TV', 'الفيديوهات والقنوات'], ['شاهد', 'Shahid', 'مسلسلات وأفلام عربية'], ['نتفلكس', 'Netflix', 'أفلام ومسلسلات'],
  ['VLC', 'VLC for Android', 'مشغل كل أنواع الفيديو'], ['Kodi', 'Kodi', 'مركز وسائط متكامل'], ['LocalSend', 'LocalSend', 'نقل الملفات بين الموبايل والشاشة بدون إنترنت', 'org.localsend.localsend_app'],
  ['Downloader', 'Downloader by AFTVnews', 'تنزيل ملفات بالرابط'], ['TOD', 'TOD', 'مباريات وقنوات بي إن'], ['OSN+', 'OSN+', 'أفلام ومسلسلات'],
  ['Spotify', 'Spotify', 'موسيقى وبودكاست'], ['سبيستون غو', 'Spacetoon Go', 'كرتون للأطفال'], ['Prime Video', 'Prime Video', 'أفلام ومسلسلات'],
  ['X-plore', 'X-plore File Manager', 'مدير ملفات للشاشة'], ['Button Mapper', 'Button Mapper', 'تغيير أزرار الريموت'],
];
function openStore() {
  page('متجر التطبيقات المختارة', `<p class="sub">يفتح التطبيق بمتجر گوگل على الشاشة، وتنصبه من هناك بالريموت.</p>
    <div class="list">${STORE.map((a, i) => `<div class="item"><div class="fileic">${ic('apps')}</div><div class="t"><b>${esc(a[0])}</b><small>${esc(a[2])}</small></div>
      <button class="btn sec" style="min-height:38px" data-s="${i}">افتح بالشاشة</button></div>`).join('')}</div>`, el => {
    el.onclick = async e => {
      const b = e.target.closest('[data-s]'); if (!b || !need()) return;
      const it = STORE[+b.dataset.s], q = encodeURIComponent(it[1]);
      const url = it[3] ? `market://details?id=${it[3]}` : `market://search?q=${q}&c=apps`;
      try { await sh(`am start -a android.intent.action.VIEW -d '${url}'`); toast('انفتح المتجر على الشاشة'); }
      catch (er) { toast(errText(er)); }
    };
  });
}

/* ============================================================ health check */
async function openHealth() {
  if (!need()) return;
  busy('أفحص الشاشة…');
  try {
    let info, more;
    if (typeof isDirect === 'function' && isDirect()) {
      /* connected over Wi-Fi (no ADB): the launcher measures the same things itself */
      info = await run('info');
      let h = null; try { h = await dapi('health'); } catch (e) { h = null; }
      if (!h) { unbusy(); return needLauncherSheet('فحص الشاشة على الواي فاي يحتاج «واجهة مدير الشاشات» النسخة الجديدة على الشاشة.', () => openHealth()); }
      info = Object.assign({}, info, { mem: h.mem || '', procs: h.procs || '—' });
      more = [h.temps || '', h.uptime || '0', h.rssi || '', h.df || '', '', h.abi || ''];
    } else {
      [info, more] = await Promise.all([run('info'), run('shs', { cmds: [
        'cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -3', 'cat /proc/uptime', "dumpsys wifi | grep -m1 -E 'RSSI|rssi'", 'df /data | tail -1', 'cat /proc/loadavg', 'getprop ro.product.cpu.abi'] })]);
    }
    INFO = info; unbusy();
    const mem = parseMem(info.mem);
    const temps = more[0].split('\n').map(Number).filter(n => n > 0).map(n => n > 1000 ? n / 1000 : n);
    const up = Math.floor(parseFloat(more[1]) / 3600);
    const rssi = (/(?:RSSI|rssi)[:=]\s*(-?\d+)/.exec(more[2]) || [])[1];
    const df = more[3].trim().split(/\s+/), used = +df[2], total = +df[1];
    const bar = (pct, ok) => `<div class="bar"><i style="width:${Math.max(3, Math.min(100, pct))}%;background:${ok ? 'var(--ok)' : pct > 85 ? 'var(--bad)' : 'var(--warn)'}"></i></div>`;
    const memUsed = mem ? 100 - mem.freePct : 0, diskPct = total ? Math.round(used * 100 / total) : 0;
    const tmax = temps.length ? Math.max(...temps) : null;
    page('فحص الشاشة', `
      <div class="panel"><h2>${esc(tvName())}</h2><p class="sub" style="margin:0">${esc(info.brand)} ${esc(info.model)} · أندرويد ${esc(info.android)} · <span class="num">${esc(info.chip || more[5].trim())}</span></p></div>
      <div class="list">
        <div class="item"><div class="t"><b>الذاكرة المستخدمة <span class="num">${memUsed}%</span></b>${bar(memUsed, memUsed < 70)}<small>${mem ? Math.round(mem.avail / 1024) + ' ميگا فارغة من ' + Math.round(mem.total / 1024) : ''}</small></div></div>
        <div class="item"><div class="t"><b>المساحة المستخدمة <span class="num">${diskPct}%</span></b>${bar(diskPct, diskPct < 70)}<small>${total ? Math.round((total - used) / 1048576 * 10) / 10 + ' گيگا فارغة' : ''}</small></div></div>
        <div class="item"><div class="t"><b>الحرارة</b><small>${tmax ? `<span class="num">${tmax.toFixed(0)}°</span> ${tmax > 75 ? '— حارة، خليها بمكان بيه هوا' : '— طبيعية'}` : 'ما متوفرة بهالشاشة'}</small></div></div>
        <div class="item"><div class="t"><b>قوة الواي فاي</b><small>${rssi ? `<span class="num">${rssi} dBm</span> — ${+rssi > -60 ? 'ممتازة' : +rssi > -72 ? 'جيدة' : 'ضعيفة، قرّب الراوتر'}` : 'ما متوفرة'}</small></div></div>
        <div class="item"><div class="t"><b>شغالة من</b><small>${up >= 24 ? Math.floor(up / 24) + ' يوم' : up + ' ساعة'} ${up > 24 * 7 ? '— طفّيها وشغلها حتى ترتاح' : ''}</small></div></div>
        <div class="item"><div class="t"><b>العمليات الشغالة</b><small class="num">${esc(info.procs)}</small></div></div>
      </div>
      ${typeof isDirect === 'function' && isDirect() ? '' : `<button class="btn pri full" id="hFast">${ic('refresh')} تنظيف سريع</button>`}`, () => { const hf = $('#hFast'); if (hf) hf.onclick = async () => { await quickClean(); openHealth(); }; });
  } catch (e) { unbusy(); toast(errText(e)); }
}

/* ============================================================ backup / restore */
function openBackup() {
  page('نسخة احتياطية', `
    <div class="panel"><h2>احفظ نسخة من الشاشة</h2><p class="sub">تنحفظ التطبيقات الموقوفة، وإعدادات السرعة وحجب الإعلانات، وشكل واجهة مدير الشاشات.</p>
      <button class="btn pri full" id="bkSave">${ic('save')} سوّي نسخة احتياطية</button></div>
    <div class="panel"><h2>رجّع نسخة</h2><p class="sub">اختار ملف نسخة احتياطية، وينطبق على الشاشة المتصلة. تگدر تستخدمه لشاشة ثانية هم.</p>
      <button class="btn sec full" id="bkLoad">${ic('file')} اختار ملف النسخة</button></div>`, () => {
    $('#bkSave').onclick = backupNow;
    $('#bkLoad').onclick = restoreBackup;
  });
}
async function backupNow() {
  if (!need()) return;
  busy('أسوّي النسخة…');
  try {
    const keys = ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale', 'private_dns_mode', 'private_dns_specifier'];
    const out = await run('shs', { cmds: ['pm list packages -d'].concat(keys.map(k => 'settings get global ' + k)) });
    const disabled = out[0].split('\n').map(s => s.replace('package:', '').trim()).filter(Boolean);
    const glob = {}; keys.forEach((k, i) => { const v = out[i + 1].trim(); if (v && v !== 'null') glob[k] = v; });
    let cfg = null; try { cfg = JSON.parse(await run('cfgGet')); } catch (e) {}
    const name = 'backup-' + (tvName() || 'tv').replace(/[^\w؀-ۿ-]+/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.json';
    const where = await run('saveText', { name, text: JSON.stringify({ type: 'moamal-backup', at: Date.now(), tv: tvName(), model: INFO && INFO.model, disabled, global: glob, cfg }, null, 1) });
    unbusy(); toast('انحفظت ← ' + where);
  } catch (e) { unbusy(); toast(errText(e)); }
}
function restoreBackup() {
  if (!need()) return;
  busy('اختار ملف النسخة…');
  run('pick', { mode: 'backup' }).then(async t => {
    let o; try { o = JSON.parse(t); } catch (e) { unbusy(); return toast('الملف مو نسخة احتياطية'); }
    if (o.type !== 'moamal-backup') { unbusy(); return toast('الملف مو نسخة احتياطية'); }
    $('#busyT').textContent = 'أرجّع النسخة…';
    const cmds = (o.disabled || []).filter(p => !PROTECT.test(p)).map(p => 'pm disable-user --user 0 ' + p)
      .concat(Object.entries(o.global || {}).map(([k, v]) => `settings put global ${k} ${v}`));
    await run('shs', { cmds, progress: true });
    if (o.cfg && Object.keys(o.cfg).length > 1) { try { await run('cfgSet', { cfg: JSON.stringify(o.cfg) }); } catch (e) {} }
    addLog('استرجاع نسخة احتياطية', (o.disabled || []).map(p => 'pm enable ' + p));
    unbusy(); toast('رجعت النسخة ✓');
  }).catch(e => { unbusy(); if (e.message !== 'CANCEL') toast(errText(e)); });
}

/* ============================================================ live updates */
async function openUpdates() {
  page('التحديثات المباشرة', `<div id="upBody"><div class="empty"><div class="spin"></div>أتأكد من التحديثات…</div></div>`);
  const body = () => $('#upBody');
  let app = null, tv = null, tvVer = null;
  try { app = await run('release', { prefix: 'studio-' }); } catch (e) {}
  try { tv = await run('release', { prefix: 'build-' }); } catch (e) {}
  if (CONN.connected) {
    try { const o = await sh("dumpsys package com.cleantv.launcher | grep -m2 -E 'versionCode|versionName'"); const m = /versionCode=(\d+)/.exec(o); if (m) tvVer = +m[1]; } catch (e) {}
  }
  if (!body()) return;
  const mine = B.build();
  const appNew = app && app.num > mine;
  body().innerHTML = `
    <div class="panel"><div class="row"><div style="flex:1"><h2 style="margin:0">مدير الشاشة</h2><p class="sub" style="margin:4px 0 0">عندك النسخة <span class="num">${esc(B.version())}</span></p></div>${appNew ? '<span class="tag">تحديث جديد</span>' : '<span class="tag">آخر نسخة</span>'}</div>
      ${appNew ? `<button class="btn pri full" id="upApp" style="margin-top:14px">${ic('save')} حدّث التطبيق</button>` : ''}</div>
    <div class="panel"><div class="row"><div style="flex:1"><h2 style="margin:0">واجهة مدير الشاشات على الشاشة</h2>
      <p class="sub" style="margin:4px 0 0">${!CONN.connected ? 'اتصل بالشاشة حتى نشوف نسختها' : tvVer ? 'منصّبة: بناء <span class="num">' + tvVer + '</span>' : 'مو منصّبة على هالشاشة'}${tv ? ' · الأحدث: <span class="num">' + tv.num + '</span>' : ''}</p></div>
      ${tv && tvVer && tv.num > tvVer ? '<span class="tag">تحديث جديد</span>' : ''}</div>
      ${CONN.connected && tv ? `<button class="btn ${tvVer && tv.num <= tvVer ? 'sec' : 'pri'} full" id="upTv" style="margin-top:14px">${ic('layers')} ${tvVer ? (tv.num > tvVer ? 'حدّث الواجهة' : 'إعادة تنصيب الواجهة') : 'نصّب الواجهة'}</button>` : ''}</div>
    <p class="sub">التحديثات تنزل من صفحة المشروع على GitHub. الواجهة تحافظ على تصميمك وإعداداتك بعد التحديث.</p>`;
  const a = $('#upApp'); if (a) a.onclick = async () => { busy('أنزل التحديث…'); try { await run('selfUpdate'); unbusy(); toast('وافق على التثبيت'); } catch (e) { unbusy(); toast(errText(e)); } };
  const t = $('#upTv'); if (t) t.onclick = async () => { busy('أحدّث واجهة الشاشة…'); try { const r = await run('launcherUpdate'); unbusy(); toast('تم ' + (r.tag || '')); openUpdates(); } catch (e) { unbusy(); toast(errText(e)); } };
}
async function autoCheckUpdate() {
  try {
    const app = await run('release', { prefix: 'studio-' });
    if (app.num > B.build() && kv('updSeen', 0) !== app.num) {
      kvSet('updSeen', app.num);
      sheet(`<h2>نسخة جديدة من التطبيق</h2><p class="sub">نزلت نسخة أحدث من مدير الشاشة. تريد تحدّث هسه؟</p>
        <button class="btn pri full" id="auGo">${ic('save')} حدّث هسه</button><button class="btn ghost full" onclick="closeSheet()">بعدين</button>`);
      $('#auGo').onclick = async () => { closeSheet(); busy('أنزل التحديث…'); try { await run('selfUpdate'); unbusy(); } catch (e) { unbusy(); toast(errText(e)); } };
    }
  } catch (e) {}
}
setTimeout(() => { if (SESSION) autoCheckUpdate(); }, 6000);

/* ============================================================ what's new */
const NEWS = [
  'شاشة التوقف بالكامل من الموبايل: الخلفية والحركة والتعتيم وشكل الساعة وحجمها ومكانها، ومعاينة مباشرة بمربع على اللي تعدّله',
  'الساعة والتاريخ ثابتين أسفل اليسار بكل الواجهات، وبطاقة صغيرة: أخبار النادي وآخر مباراة والمسجلين والصانعين، أو صور وآيات، أو أخبار',
  'الدين والمذهب: مسلم شيعي أو سني، مسيحي، صابئي مندائي، أو عام، والواجهة تتغير حسبه',
  'ويدجت أخبار بالواجهة الرئيسية',
  'يشتغل بدون إذن التجهيز: الشاشة اللي عليها «واجهة مدير الشاشات» تتصل بيها على الواي فاي برمز يطلع على التلفزيون، والتجهيز بس يحتاج الإذن',
  'إعدادات الشاشة: جدول إطفاء وتشغيل، وقت الأطفال، وقفل التطبيقات برمز',
  'تقرير الاستخدام، والبحث بالصوت',
  'صدّر واجهتك لكل شاشاتك مرة وحدة، وثيمات المناسبات التلقائية',
  'دوّر بالإنترنت على خلفيات وسوّي منها واجهة، وواجهات الفيديو صارت قوالب جاهزة بالتطبيق',
  'المعاينة تنبني من التصميم مباشرة فكل تغيير يبين، ومربع واضح حول الجزء اللي تعدّله',
  'إذا الجهاز مسجّل سيارة وتريد ترجعه تلفزيون (أو بالعكس) التطبيق يسألك ويحوّله ويطبّق، بدون ما يوكف',
  'المعاينة تنبني من جديد ويّا كل تغيير، حتى كل شي يبين مو بس جزء واحد',
  'التصدير للشاشة صار مضمون: التطبيق يتأكد إن الشاشة طبّقت التصميم، وإذا لا يگلك ويحدّث الواجهة',
  'كل تغيير تسويه (النادي، الثيم، الخلفيات، الإعدادات) يبين بالمعاينة بنفس اللحظة',
  'المعرض: الواجهة تنفتح بالمعاينة وتعدّل عليها، وبعدين تصدّرها',
  'مربع الآية والحديث ولوحة النادي وكل جزء: خلفية شفافة أو لون أو صورة من موبايلك',
  'مدير ملفات كامل للشاشة والسيارة: تفتح الملف على الشاشة، ترسل، تنزّل، تغيّر الاسم، تدوّر، تحذف',
  'خطوة الواجهة بالتجهيز بيها هسه المعرض وواجهة شاشة السيارة',
  'الصور من موبايلك صارت توصل للشاشة بطريقة جديدة تشتغل بأندرويد الحديث (انحلت رسالة secure_mkdirs)',
  'التعديل يبقى بالمعاينة بس، والشاشة ما تتغير إلا من تضغط «صدّر للشاشة» وتأكد',
  'شاشة السيارة: تختار شركة سيارتك وتظهر فوق ثابتة، وتگدر تضيف شعارها من صورك',
  'ترتيبات سيارة جديدة: مثل Apple TV، مثل CarPlay، وقمرة القيادة، و٤ واجهات جاهزة بالمعرض',
  'أزرار الصوت صارت اختيارية، دائرية فوق باليسار',
  'متجر السيارة: كاربلي وأندرويد أوتو، خرائط، موسيقى، وفحص السيارة',
  'أشكال واجهات جديدة: الشاشة الذكية بشريط سفلي، الرف الأنيق، بوابة القنوات، وهوية الأندية',
  'واجهات أندية كرة القدم: أشهر أندية أوروبا وأكبر أندية العراق، كل نادي بألوانه ومبارياته',
  'اختصارات خاصة بالتلفزيونات: المصدر، الصورة، الصوت، مؤقت النوم، والتعتيم، وتنشال وحدها بالبوكسات',
  'المدير ينشر واجهات جديدة للمعرض من التطبيق وتطلع عند كل المشتركين',
  'استيراد واجهة من رابط بالإنترنت، وكل أسماء التطبيقات بالعربي',
  'المشاهدة المباشرة صارت بث فيديو سريع، مع تسجيل فيديو وصورة من نفس الشاشة، والتحكم بالسحب على الصورة',
  'عرض شاشة موبايلك على التلفزيون',
  'استوديو تصميم الواجهة: عدّل الحالية، أو صمّم من الصفر بقوالب جاهزة، وكل تعديل يبين بالمعاينة فوراً',
  'حفظ المشاريع وتصديرها واستيرادها ومشاركتها',
  'معرض الواجهات: واجهات جاهزة تشوف صورتها وتفاصيلها، تنزلها وتنثبت على الشاشة مباشرة، وتعدل عليها بعدين',
  'تصليح عرض الموبايل على الشاشة، مع فحص الشاشة قبل البدء وحالة العرض مباشرة',
  'تصليح بطء قراءة التطبيقات وفحص الشاشة',
  'ملفات الشاشة، متجر مختار، فحص الشاشة، نسخة احتياطية واسترجاع',
  'التحديثات المباشرة للتطبيق ولواجهة الشاشة',
];
function openNews() {
  page('شنو الجديد', `<div class="panel"><h2>النسخة <span class="num">${esc(B.version())}</span></h2>
    <ul class="sub" style="padding-inline-start:20px;margin:0;line-height:1.9">${NEWS.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`);
}

/* ============================================================ design gallery (online) */
let GAL = null, galTag = 'الكل', galSort = 'top';
const THEME_NAME = id => (L_THEMES.find(t => t[0] === id) || [, 'الذهبي الليلي'])[1];
const SRC_NAME = id => (L_SOURCES.find(t => t[0] === id) || [, id])[1];
const SHAPE_NAME = id => (L_APP_SHAPES.find(t => t[1] === id) || ['دائري'])[0];
const fmtCount = n => n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + ' ألف' : String(n);

async function openGallery(force) {
  if (!GAL || force) {
    page('معرض الواجهات', `<div class="empty"><div class="spin"></div>أجيب الواجهات…</div>`);
    try {
      const r = await run('gallery');
      GAL = (r.index.items || []).map(it => {
        const f = r.files[it.file] || {}, im = r.files[it.image] || {};
        return Object.assign({}, it, { fileUrl: f.url, img: im.url, count: f.count || 0 });
      }).filter(x => x.fileUrl && !/^sat-/.test(x.id || '') && !(x.tags || []).some(t => /IPTV|ستلايت|رسيفر/.test(t)) && !/IPTV|ستلايت|رسيفر/.test(x.name || ''));
    } catch (e) {
      $('#pageBody').innerHTML = `<div class="empty">ما گدرت أجيب المعرض. تأكد من الإنترنت وجرب مرة ثانية.<br><br><button class="btn pri" id="gRe">${ic('refresh')} إعادة المحاولة</button></div>`;
      $('#gRe').onclick = () => openGallery(true);
      return;
    }
  }
  renderGallery();
}
function renderGallery() {
  const tags = ['الكل', ...new Set(GAL.flatMap(x => x.tags || []))];
  let list = GAL.filter(x => galTag === 'الكل' || (x.tags || []).includes(galTag));
  list = list.slice().sort((a, b) => galSort === 'top' ? b.count - a.count || a.order - b.order : (b.added || '').localeCompare(a.added || '') || a.order - b.order);
  const html = `
    <p class="sub" style="margin:0 2px 12px">${GAL.length} واجهة جاهزة. اختار وحدة، نزّلها وتنثبت على الشاشة مباشرة، وبعدين عدّل عليها مثل ما تريد.</p>
    <div class="chips" style="margin-bottom:10px" id="gTags">${tags.map(t => `<button class="chip ${t === galTag ? 'on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="seg" id="gSort" style="position:static"><button data-sort="top" class="${galSort === 'top' ? 'on' : ''}">الأكثر تنزيلاً</button><button data-sort="new" class="${galSort === 'new' ? 'on' : ''}">الأحدث</button></div>
    ${list.map(x => `<button class="gcard" data-g="${esc(x.id)}"><img loading="lazy" src="${esc(x.img || '')}" alt="${esc(x.name)}">
      <div class="gi"><b>${esc(x.name)}</b><small>${esc(x.desc)}</small>
      <div class="gmeta">${(x.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}<span class="sub" style="margin-inline-start:auto;font-size:12px">${ic('save').replace('class="i"', 'class="i" style="width:14px;height:14px;vertical-align:-2px"')} ${fmtCount(x.count)} تنزيل</span></div></div></button>`).join('') || '<div class="empty">ماكو واجهات بهالتصنيف</div>'}
    ${SESSION && SESSION.admin ? `<button class="btn pri full" id="gAdd">${ic('plus')} إضافة واجهة جديدة للمعرض</button>` : `<button class="btn ghost full" id="gSend">${ic('chat')} عندك تصميم حلو؟ أرسله للمعرض</button>`}`;
  const after = el => {
    el.onclick = e => {
      const tg = e.target.closest('[data-tag]'); if (tg) { tap(); galTag = tg.dataset.tag; renderGallery(); return; }
      const so = e.target.closest('[data-sort]'); if (so) { tap(); galSort = so.dataset.sort; renderGallery(); return; }
      if (e.target.closest('#gSend')) { submitInfo(); return; }
      if (e.target.closest('#gAdd')) { adminAddSheet(); return; }
      const g = e.target.closest('[data-g]'); if (g) { tap(); galleryDetails(GAL.find(x => x.id === g.dataset.g)); }
    };
  };
  if (cur === 'page' && $('#pageTitle').textContent === 'معرض الواجهات') { $('#pageBody').innerHTML = html; after($('#pageBody')); }
  else page('معرض الواجهات', html, after);
}

async function fetchDesign(x, from, to) {
  const t = await run('dl', { url: x.fileUrl, from, to });
  const o = JSON.parse(t);
  return o.cfg || o;
}
function describe(cfg) {
  const S = cfg.settings || {}, L = cfg.layout || {};
  const hidden = EDITABLES.filter(([id]) => L[id] && L[id].hidden).map(x => x[1]);
  const shown = EDITABLES.filter(([id]) => !(L[id] && L[id].hidden)).map(x => x[1]);
  return { theme: THEME_NAME(S.theme || 'default'), bg: (S.bgSources || ['shrines']).map(SRC_NAME).join('، '),
    shape: SHAPE_NAME((L['row-apps'] || {}).shape || 'circle'), shown, hidden };
}
async function galleryDetails(x) {
  sheet(`<img class="gimg" src="${esc(x.img || '')}" alt="${esc(x.name)}">
    <h2 style="margin-top:14px">${esc(x.name)}</h2>
    <div class="gmeta" style="margin-top:-4px">${(x.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}<span class="sub" style="font-size:12.5px">${fmtCount(x.count)} تنزيل · ${esc(x.author || '')}</span></div>
    <p class="sub" style="margin:10px 0 0">${esc(x.desc)}</p>
    <div id="gDet"><div class="sub" style="margin:12px 0">أجيب التفاصيل…</div></div>
    <p class="sub" style="font-size:12px">الصورة توضيحية، والخلفيات على التلفزيون تتغير حسب مصدرها.</p>
    <button class="btn pri full" id="gEdit">${ic('layers')} افتحه وشوفه وعدّل عليه</button><div style="height:10px"></div>
    ${SESSION && SESSION.admin ? `<button class="btn bad full" id="gDel" style="margin-bottom:10px">${ic('trash')} حذف من المعرض</button>` : ''}
    <div class="row"><button class="btn sec" id="gInst">${ic('tv')} ثبّته مباشرة</button><button class="btn sec" id="gSave">${ic('save')} احفظه</button></div>`);
  let cfg = null;
  try {
    const t = await run('dl', { url: x.fileUrl, from: 0, to: 0 });
    const o = JSON.parse(t); cfg = o.cfg || o;
    const d = describe(cfg);
    const det = $('#gDet'); if (det) det.innerHTML = `<div class="kv"><span>الثيم</span><b>${esc(d.theme)}</b><span>الخلفيات</span><b>${esc(d.bg)}</b><span>الأيقونات</span><b>${esc(d.shape)}</b>
      <span>الظاهر</span><b style="font-weight:500">${esc(d.shown.join('، '))}</b>${d.hidden.length ? `<span>المخفي</span><b style="font-weight:500;color:var(--mute)">${esc(d.hidden.join('، '))}</b>` : ''}</div>`;
  } catch (e) { const det = $('#gDet'); if (det) det.innerHTML = ''; }
  $('#gInst').onclick = () => { closeSheet(); installFromGallery(x); };
  const gd = $('#gDel');
  if (gd) gd.onclick = async () => {
    if (gd.dataset.sure !== '1') { gd.dataset.sure = '1'; gd.textContent = 'متأكد؟ تنشال عند كل المشتركين، اضغط مرة ثانية'; return; }
    const tok = kv('ghToken', ''); if (!tok) { closeSheet(); return ghTokenSheet(); }
    closeSheet(); busy('أحذف من المعرض…');
    try { await run('ghDelete', { token: tok, id: x.id }); unbusy(); toast('انحذفت من المعرض'); GAL = null; openGallery(true); }
    catch (e) { unbusy(); toast(errText(e)); }
  };
  $('#gEdit').onclick = async () => { closeSheet(); try { const c = cfg || await fetchDesign(x, 0, 0); show('design'); openDesign({ name: x.name, from: 'gallery', cfg: deepCopy(c) }); toast('عدّل براحتك، وكل تغيير يبين بالمعاينة. من تخلص اضغط «صدّر للشاشة»'); } catch (e) { toast(errText(e)); } };
  $('#gSave').onclick = async () => {
    try { const c = cfg || await fetchDesign(x, 0, 0); const l = projects(); l.unshift({ id: 'p' + Date.now(), name: x.name, at: Date.now(), cfg: c }); kvSet('projects', l.slice(0, 40)); toast('انحفظت بمشاريعي'); }
    catch (e) { toast(errText(e)); }
  };
}

/* ---------- big 0..100 progress ---------- */
let dlShown = 0, dlTarget = 0, dlTimer = null;
function dlOpen(title) {
  dlShown = 0; dlTarget = 0;
  $('#dlT').textContent = title; $('#dlS').textContent = ''; $('#dlDone').style.display = 'none'; $('#dlDone').innerHTML = '';
  document.querySelector('#dlx .ring').style.display = '';
  dlPaint(0); $('#dlx').classList.add('on');
  clearInterval(dlTimer);
  dlTimer = setInterval(() => { if (dlShown < dlTarget) { dlShown = Math.min(dlTarget, dlShown + Math.max(1, Math.round((dlTarget - dlShown) / 6))); dlPaint(dlShown); } }, 40);
}
function dlPaint(p) {
  $('#dlPct').textContent = p; $('#dlBar').style.width = p + '%';
  $('#dlRing').style.strokeDashoffset = 326.7 * (1 - p / 100);
}
function dlSet(p, step) { dlTarget = Math.max(dlTarget, Math.min(100, Math.round(p))); if (step) $('#dlS').textContent = step; }
window.onPct = p => { if ($('#dlx').classList.contains('on')) dlSet(p); };
function dlClose() { clearInterval(dlTimer); $('#dlx').classList.remove('on'); }
function dlFinish(html) {
  dlSet(100);
  setTimeout(() => { clearInterval(dlTimer); dlPaint(100); $('#dlDone').innerHTML = html; $('#dlDone').style.display = 'block'; }, 450);
}

async function launcherReady() {
  try {
    const v = await sh("dumpsys package com.cleantv.launcher | grep -m1 versionCode");
    const m = /versionCode=(\d+)/.exec(v); return m && +m[1] >= 11;
  } catch (e) { return false; }
}
async function installFromGallery(x) {
  if (!need()) return;
  dlOpen('أثبّت «' + x.name + '»');
  try {
    dlSet(3, 'أنزل الواجهة من المعرض…');
    const cfg = await fetchDesign(x, 3, 25);
    dlSet(25, 'أتأكد من الشاشة…');
    if (!(await launcherReady())) {
      dlSet(28, 'أنزل واجهة مدير الشاشات وأنصبها على الشاشة…');
      afterLauncher(await run('launcher', { from: 28, to: 80 }));
      dlSet(82, 'أنتظر الواجهة تشتغل…');
      await new Promise(r => setTimeout(r, 3500));
    } else dlSet(70, 'الشاشة جاهزة');
    dlSet(86, 'أطبّق التصميم على الشاشة…');
    const c2 = deepCopy(await localPackToTv(cfg)); if (!c2.mode) c2.mode = 'tv'; c2.stamp = 's' + Date.now().toString(36);
    await run('cfgSet', { cfg: JSON.stringify(c2) });
    try { await sh('am start -n com.cleantv.launcher/.MainActivity'); } catch (e) {}
    let ok = false;
    for (let i = 0; i < 8 && !ok; i++) { dlSet(88 + i, 'أتأكد إن الشاشة طبّقته…'); await new Promise(r => setTimeout(r, 1200)); ok = (await cfgStamp()) === c2.stamp; }
    if (!ok) throw new Error('الشاشة ما طبّقت التصميم. حدّث «واجهة مدير الشاشات» من التحديثات وجرب مرة ثانية');
    addLog('تثبيت «' + x.name + '» من المعرض', []);
    $('#dlT').textContent = 'تم التثبيت ✓'; $('#dlS').textContent = '«' + x.name + '» صارت واجهة ' + tvName();
    dlFinish(`<button class="btn pri full" id="dlEdit">${ic('layers')} عدّل عليها</button><div style="height:8px"></div><button class="btn ghost full" id="dlOk">تمام</button>`);
    setTimeout(() => {
      const e1 = $('#dlEdit'), e2 = $('#dlOk');
      if (e1) e1.onclick = () => { dlClose(); show('design'); openDesign({ name: x.name, from: 'tv', cfg: deepCopy(cfg) }); };
      if (e2) e2.onclick = dlClose;
    }, 500);
  } catch (e) {
    $('#dlT').textContent = 'ما تم التثبيت'; $('#dlS').textContent = errText(e);
    document.querySelector('#dlx .ring').style.display = 'none';
    dlFinish(`<button class="btn sec full" id="dlOk">إغلاق</button>`);
    setTimeout(() => { const b = $('#dlOk'); if (b) b.onclick = dlClose; }, 500);
  }
}

function submitInfo() {
  sheet(`<h2>أرسل تصميمك للمعرض</h2><p class="sub">صمّم واجهتك من «الواجهة»، وبعدين من قائمة التصميم (⋯) اختار «أرسل تصميمك للمعرض». نشوفه وإذا عجبنا ننشره للكل باسمك.</p>
    <button class="btn pri full" id="siGo">${ic('plus')} صمّم واجهة</button>`);
  $('#siGo').onclick = () => { closeSheet(); show('design'); if (!D) designNew(); };
}
async function submitDesign() {
  const text = JSON.stringify({ type: 'moamal-design', name: D.name, by: (SESSION || {}).user, at: Date.now(), cfg: D.cfg }, null, 1);
  try { await run('saveText', { name: D.name.replace(/[\\/:*?"<>|]/g, '_') + '.json', text }); } catch (e) {}
  sheet(`<h2>أرسل تصميمك</h2><p class="sub">انحفظ ملف التصميم بالتنزيلات ← MoamalStudio. دزّه إلنا على تيليگرام، واكتب الاسم اللي تريده يطلع بالمعرض.</p>
    <button class="btn pri full" id="sdTg">${ic('tg')} افتح تيليگرام</button><div style="height:10px"></div>
    <button class="btn sec full" id="sdSh">مشاركة الملف كنص</button>`);
  $('#sdTg').onclick = () => { closeSheet(); B.open('https://t.me/KMK3993', 'org.telegram.messenger'); };
  $('#sdSh').onclick = () => B.share(text);
}

/* ============================================================ admin: publish designs */
function ghTokenSheet(then) {
  const NEW_TOKEN = 'https://github.com/settings/tokens/new?scopes=repo&description=' + encodeURIComponent('Moamal Studio gallery');
  sheet(`<h2>ربط المعرض بحسابك</h2>
    <p class="sub">حتى تنشر واجهات للمشتركين، التطبيق يحتاج رمز من حسابك بـ GitHub. يتسوى مرة وحدة وينحفظ بموبايلك بس.</p>
    <ol class="sub" style="padding-inline-start:20px;margin:0 0 10px;line-height:1.9">
      <li>اضغط الزر تحت. تنفتح صفحة الرمز وهي معبّاة جاهزة (سجّل دخول إذا طلب).</li>
      <li>بـ Expiration اختار المدة اللي تريدها، مثلاً No expiration.</li>
      <li>انزل لآخر الصفحة واضغط <b dir="ltr">Generate token</b>.</li>
      <li>انسخ الرمز اللي يبدي بـ <b dir="ltr">ghp_</b> وارجع الصقه هنا.</li></ol>
    <button class="btn sec full" id="ghNew">${ic('key')} افتح صفحة الرمز جاهزة</button>
    <input id="ghT" class="num" placeholder="ghp_… أو github_pat_…" autocapitalize="off" spellcheck="false" style="margin-top:12px;direction:ltr">
    <button class="btn pri full" id="ghOk" style="margin-top:12px">${ic('check')} تأكد واحفظ</button>
    ${kv('ghToken', '') ? `<button class="btn ghost full" id="ghRm">إلغاء الربط</button>` : ''}`);
  $('#ghNew').onclick = () => B.open(NEW_TOKEN, '');
  $('#ghOk').onclick = async () => {
    const t = $('#ghT').value.replace(/\s+/g, ''); if (t.length < 20) return toast('الصق الرمز كامل');
    closeSheet(); busy('أتأكد من الرمز…');
    try { await run('ghCheck', { token: t }); kvSet('ghToken', t); unbusy(); toast('انربط المعرض ✓'); then && then(); }
    catch (e) { unbusy(); toast(errText(e)); }
  };
  const rm = $('#ghRm'); if (rm) rm.onclick = () => { kvSet('ghToken', null); closeSheet(); toast('انلغى الربط'); };
}
function adminAddSheet() {
  sheet(`<h2>إضافة واجهة للمعرض</h2><p class="sub">افتح الواجهة بالمصمم، عدّل عليها إذا تريد، وبعدين من ⋯ اختار «نشر بالمعرض للمشتركين».</p>
    <div class="list">
      <div class="item tap" data-a="new">${ic('plus')}<div class="t"><b>تصميم جديد</b></div></div>
      <div class="item tap" data-a="proj">${ic('layers')}<div class="t"><b>من مشاريعي</b></div></div>
      <div class="item tap" data-a="imp">${ic('file')}<div class="t"><b>من ملف أو رابط بالإنترنت</b></div></div>
      <div class="item tap" data-a="tv">${ic('tv')}<div class="t"><b>الواجهة اللي على الشاشة المتصلة</b></div></div>
    </div>`);
  $('#sheetBody').onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return; closeSheet();
    const k = b.dataset.a;
    show('design');
    if (k === 'new') designNew();
    if (k === 'proj') { D = null; renderDesign(); toast('اختار مشروع من مشاريعي'); }
    if (k === 'imp') designImport();
    if (k === 'tv') designFromTv();
  };
}
const GAL_TAGS = ['شاشات ذكية', 'فخم', 'كرة القدم', 'رياضي', 'أطفال', 'عام', 'هادئ', 'ديني'];
function publishSheet() {
  if (!D) return;
  const tok = kv('ghToken', '');
  if (!tok) return ghTokenSheet(publishSheet);
  const sel = new Set();
  sheet(`<h2>نشر بالمعرض</h2><p class="sub">تطلع عند كل المشتركين بمعرض الواجهات، وينزّلونها ويثبتونها مباشرة.</p>
    <label class="f">الاسم</label><input id="puN" value="${esc(D.name)}" maxlength="40">
    <label class="f">الوصف</label><input id="puD" maxlength="160" placeholder="جملة وحدة توصف الواجهة">
    <label class="f">التصنيف</label><div class="chips" id="puT">${GAL_TAGS.map(t => `<button class="chip" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <label class="f">الصورة</label>
    <div class="row"><button class="btn sec" id="puCap">${ic('cam')} صورة المعاينة</button><button class="btn sec" id="puPick">${ic('file')} من المعرض</button></div>
    <img id="puImg" class="gimg" style="margin-top:10px;display:none" alt="صورة الواجهة">
    <button class="btn pri full" id="puGo" style="margin-top:14px">${ic('layers')} انشر للمشتركين</button>`);
  let img = '';
  const setImg = d => { img = d; const el = $('#puImg'); if (el) { el.src = d; el.style.display = 'block'; } };
  $('#puT').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; const t = b.dataset.t; sel.has(t) ? sel.delete(t) : sel.add(t); b.classList.toggle('on'); };
  const capture = async () => {
    const f = $('#pvf'); if (!f) return toast('افتح المعاينة أول');
    const r = f.getBoundingClientRect();
    try { setImg(await run('capture', { x: r.left, y: r.top, w: r.width, h: r.height })); } catch (e) { toast(errText(e)); }
  };
  $('#puCap').onclick = async () => { $('#mask').classList.remove('on'); $('#sheet').classList.remove('on'); await new Promise(r => setTimeout(r, 450)); await capture(); $('#mask').classList.add('on'); $('#sheet').classList.add('on'); };
  $('#puPick').onclick = () => run('pick', { mode: 'image' }).then(setImg).catch(e => { if (e.message !== 'CANCEL') toast(errText(e)); });
  $('#puGo').onclick = async () => {
    const name = $('#puN').value.trim(), desc = $('#puD').value.trim();
    if (!name) return toast('اكتب اسم');
    if (!img) return toast('اختار صورة للواجهة');
    const id = 'u' + Date.now().toString(36);
    closeSheet();
    dlOpen('أنشر «' + name + '»');
    try {
      const cfg = deepCopy(D.cfg), extra = [];
      (cfg.settings.bgPack || []).forEach((u, i) => {
        if (!u.startsWith('data:')) return;
        const nm = id + '-bg' + String(i + 1).padStart(2, '0') + '.jpg';
        extra.push({ name: nm, data: u }); cfg.settings.bgPack[i] = GAL_URL + nm;
      });
      await run('ghPublish', { token: tok, image: img, extra, design: JSON.stringify({ type: 'moamal-design', name, cfg }),
        item: { id, name, desc: desc || name, tags: sel.size ? [...sel] : ['عام'], author: 'فريق مدير الشاشة', added: new Date().toISOString().slice(0, 10) } });
      GAL = null;
      $('#dlT').textContent = 'انتشرت ✓'; $('#dlS').textContent = 'هسه تطلع عند كل المشتركين بمعرض الواجهات';
      dlFinish(`<button class="btn pri full" id="dlOk">تمام</button>`);
      setTimeout(() => { const b = $('#dlOk'); if (b) b.onclick = dlClose; }, 500);
    } catch (e) {
      $('#dlT').textContent = 'ما انتشرت'; $('#dlS').textContent = errText(e);
      document.querySelector('#dlx .ring').style.display = 'none';
      dlFinish(`<button class="btn sec full" id="dlOk">إغلاق</button>`);
      setTimeout(() => { const b = $('#dlOk'); if (b) b.onclick = dlClose; }, 500);
    }
  };
}

RENDER.design = renderDesign;
