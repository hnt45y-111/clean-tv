'use strict';
/* ============================================================ importing other launchers' themes
   From a GitHub link or a ZIP file: CleanYourTV-style theme folders (config.json + wallpapers) are turned into our
   design format, and our own design files open as they are. Plus «واجهات حسب الشركة» (smart-TV looks). */

const CYT_REPO = 'https://github.com/Gathin23/cleanyourtv/tree/main/themes';
const CYT_NAMES = {
  aerial: 'صور الفضاء', 'ambient-glass': 'الزجاج والطبيعة', aurora: 'الشفق', blocky: 'عالم البكسل', christmas: 'ليلة الميلاد', cinematic: 'السينمائي',
  default: 'الأصلي', diwali: 'ديوالي', 'dock-glass': 'الشريط الزجاجي', dussehra: 'دوسيهرا', family: 'العائلة', glass: 'الزجاجي الليلي',
  'glass-gallery': 'معرض الزجاج', halloween: 'الهالوين', istanbul: 'إسطنبول المرسومة', istanbul_v2: 'إسطنبول ٢', minimal: 'البسيط',
  'nature-calm': 'طبيعة هادئة', 'red-rain': 'المطر الأحمر', retro: 'الريترو', ruska: 'خريف فنلندا', scenes: 'مناظر مرسومة',
  'six-columns': 'ست أعمدة', stockholm: 'ستوكهولم', storm: 'العاصفة', sweden: 'السويد', twilight: 'الغسق', weeb: 'الأنمي'
};
const hexc = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : null;

/* CleanYourTV config.json → our TV design. The whole look comes over, not only the pictures: the launcher has a
   «cyt» skin that draws CleanYourTV's home (greeting and clock, pills, the dock band, the grid, the focus glow, the
   cinematic shelf…) from these same keys, and every one of them can be changed afterwards in «الثيم». */
const CYT_KEYS = ['columns', 'rows_below_dock', 'dock_title', 'dock_row', 'single_row', 'dock_band', 'dock_band_all', 'dock_glass', 'dock_opacity', 'dock_even_padding',
  'always_show_names', 'uniform_tiles', 'show_greeting', 'greeting_name', 'greeting', 'header_white', 'date_below_clock', 'icon_only_buttons', 'icon_only_inputs',
  'show_inputs_pill', 'show_network_pill', 'wifi_status_color', 'ambient_glow', 'app_glow', 'glow_style', 'glass_style', 'cinematic_home', 'cinematic_dots', 'cinematic_art',
  'cinematic_scrim', 'wallpaper', 'wallpaper_dim', 'sky_intensity', 'background_color', 'clock_format', 'reduced_motion', 'focus_overshoot', 'top_bar_apps',
  'app_library', 'library_button', 'top_menu', 'fade_rows', 'festival', 'seasonal_skin', 'accent_color'];
function cytToCfg(c, walls, name, meta, extra) {
  c = c || {}; extra = extra || {};
  const bg = hexc(c.background_color) || '#000000', ac = hexc(c.accent_color) || '#ffffff';
  const cy = {}; CYT_KEYS.forEach(k => { if (c[k] !== undefined) cy[k] = c[k]; });
  const S = { religious: false, theme: 'appletv', skin: 'cyt', cyt: cy, palette: { a: ac, b: '#ffffff', c: bg } };
  if (c.greeting_name) S.owner = String(c.greeting_name).slice(0, 30);
  if (walls.length && c.wallpaper !== false) {
    S.bgPack = walls.slice(0, 30);
    const m = +c.wallpaper_rotation_minutes;
    S.bgInterval = m > 0 ? Math.max(60, Math.round(m * 60)) : walls.length > 1 ? 3600 : 7 * 86400;
  } else S.bgMode = 'palette';
  const labels = {}; (Array.isArray(c.app_labels) ? c.app_labels : []).forEach(x => { const i = String(x).indexOf('='); if (i > 0) labels[String(x).slice(0, i).trim()] = String(x).slice(i + 1).trim(); });
  if (Object.keys(labels).length) S.appLabels = labels;
  if (extra.css) S.css = String(extra.css).slice(0, 60000);
  const out = { v: 1, settings: S, layout: hide('weather', 'wisdom', 'bigcount', 'row-occasions', 'row-matches', 'adhanbox'), meta: Object.assign({ name }, meta || {}) };
  if (Array.isArray(c.dock_apps) && c.dock_apps.length) out.appOrder = c.dock_apps.filter(p => typeof p === 'string');
  if (Array.isArray(c.hidden_apps) && c.hidden_apps.length) out.appHidden = c.hidden_apps.filter(p => typeof p === 'string');
  if (extra.icons && Object.keys(extra.icons).length) out.customIcons = extra.icons;
  return out;
}
/* the order CleanYourTV shows its wallpapers in: by time of day when it has moods, else by file name */
function cytOrder(c, files) {
  const moods = c && c.wallpaper_moods, out = [];
  if (moods && typeof moods === 'object') ['morning', 'afternoon', 'evening', 'night'].concat(Object.keys(moods)).forEach(k => (moods[k] || []).forEach(f => { if (out.indexOf(f) < 0) out.push(f); }));
  files.slice().sort().forEach(f => { const b = f.split('/').pop(); if (out.indexOf(b) < 0 && out.indexOf(f) < 0) out.push(b); });
  return out;
}

/* ---------------- GitHub ---------------- */
function ghParse(u) {
  const m = String(u || '').trim().match(/github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/(?:tree|blob)\/([^/\s]+)(?:\/([^\s#?]*))?)?/i);
  if (!m) return null;
  return { o: m[1], r: m[2].replace(/\.git$/, ''), br: m[3] || '', path: (m[4] || '').replace(/\/+$/, '') };
}
async function ghJson(url) {
  const t = await run('fetchText', { url });
  let j; try { j = JSON.parse(t); } catch (e) { throw new Error('رد GitHub مو مفهوم'); }
  if (j && j.message && !j.tree && !j.default_branch) throw new Error(/rate limit/i.test(j.message) ? 'GitHub وگّف الطلبات شوية (حد الاستخدام). جرّب بعد ساعة' : /not found/i.test(j.message) ? 'ما لگيت المستودع. تأكد من الرابط وإنه عام' : 'GitHub: ' + j.message);
  return j;
}
async function ghScan(link) {
  const g = ghParse(link); if (!g) throw new Error('الرابط لازم يكون من github.com');
  if (!g.br) g.br = (await ghJson(`https://api.github.com/repos/${g.o}/${g.r}`)).default_branch || 'main';
  const tree = (await ghJson(`https://api.github.com/repos/${g.o}/${g.r}/git/trees/${encodeURIComponent(g.br)}?recursive=1`)).tree || [];
  const raw = p => `https://raw.githubusercontent.com/${g.o}/${g.r}/${g.br}/${p.split('/').map(encodeURIComponent).join('/')}`;
  const pre = g.path ? g.path + '/' : '';
  const files = tree.filter(x => x.type === 'blob' && x.path.startsWith(pre) && !/(^|\/)(docs|tests|addons|\.github|node_modules)\//.test(x.path));
  const dirOf = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
  const themeDir = p => { let d = dirOf(p); if (/(^|\/)wallpapers$/.test(d)) d = dirOf(d); return d; };
  const themes = files.filter(x => /(^|\/)config\.json$/i.test(x.path)).map(x => {
    const d = dirOf(x.path), pics = files.filter(f => /\.(jpe?g|png|webp)$/i.test(f.path) && themeDir(f.path) === d);
    const shot = pics.find(f => /(^|\/)screenshot\.[a-z]+$/i.test(f.path));
    const walls = pics.filter(f => f !== shot && !/(^|\/)(icons|app_icons|icon-pack|iconpack)\//i.test(f.path));
    const own = f => { let fd = dirOf(f.path); if (/(^|\/)(icons|app_icons|icon-pack|iconpack|css|styles)$/i.test(fd)) fd = dirOf(fd); return fd === d; };
    const icons = files.filter(f => own(f) && /(^|\/)(icons|app_icons|icon-pack|iconpack)\/[a-z][\w]*(\.[\w]+)+\.(png|webp|jpe?g)$/i.test(f.path))
      .map(f => ({ pkg: f.path.split('/').pop().replace(/\.[a-z]+$/i, ''), url: raw(f.path) }));
    const css = files.filter(f => own(f) && /\.css$/i.test(f.path)).map(f => raw(f.path));
    return { src: 'gh', path: d, name: d.split('/').pop() || g.r, config: raw(x.path), shot: shot ? raw(shot.path) : walls[0] ? raw(walls[0].path) : '', count: walls.length, icons, css,
      walls: walls.map(f => ({ file: f.path.split('/').pop(), url: raw(f.path) })), credits: files.find(f => f.path === (d ? d + '/' : '') + 'CREDITS.md') ? raw((d ? d + '/' : '') + 'CREDITS.md') : '' };
  });
  const designs = themes.length ? [] : files.filter(x => /\.json$/i.test(x.path)).slice(0, 20).map(x => ({ src: 'gh', name: x.path.split('/').pop(), url: raw(x.path) }));
  return { repo: `${g.o}/${g.r}`, themes, designs, home: `https://github.com/${g.o}/${g.r}` };
}

/* ---------------- the list of found themes ---------------- */
function themesSheet(title, res, open) {
  const T = res.themes || [], Dz = res.designs || [];
  if (!T.length && !Dz.length) return toast('ما لگيت واجهات بهذا المصدر');
  sheet(`<h2>${esc(title)}</h2><p class="sub">${T.length ? `لگيت ${nfA(T.length)} واجهة. اختار وحدة تشوفها بالمعاينة وتعدّل عليها قبل ما تطبّقها.` : 'لگيت ملفات تصاميم:'}</p>
    ${T.length ? `<div class="tpl">${T.map((t, i) => `<button data-it="${i}"><div class="sw2" style="${t.shot ? `background:#111 url('${esc(t.shot)}') center/cover` : 'background:linear-gradient(135deg,#1a1d26,#0b0c10)'}"></div>
      <b>${esc(CYT_NAMES[t.name] || t.name)}</b><small>${[t.count ? nfA(t.count) + ' خلفية' : 'لون فقط', (t.icons && (t.icons.length || t.icons)) ? 'أيقونات' : '', t.css && t.css.length ? 'تصميم CSS' : '', 'الواجهة كاملة'].filter(Boolean).join(' · ')}</small></button>`).join('')}</div>` : ''}
    ${Dz.length ? `<div class="list">${Dz.map((d, i) => `<div class="item tap" data-id="${i}">${ic('file')}<div class="t"><b>${esc(d.name)}</b></div>${ic('left')}</div>`).join('')}</div>` : ''}
    ${res.home ? `<p class="sub" style="margin-top:12px">المصدر: ${esc(res.repo || res.home)}. حقوق الصور حسب ملف CREDITS بكل واجهة.</p>` : ''}`);
  $('#sheetBody').onclick = e => {
    const b = e.target.closest('[data-it]'); if (b) { tap(); open(T[+b.dataset.it], res); return; }
    const d = e.target.closest('[data-id]'); if (d) { tap(); openDesignRef(Dz[+d.dataset.id]); }
  };
}
async function openDesignRef(d) {
  closeSheet();
  if (d.text) return openImported(d.text);
  busy('أنزل الملف…');
  try { const t = await run('fetchText', { url: d.url }); unbusy(); openImported(t); } catch (e) { unbusy(); toast(errText(e)); }
}
async function openGhTheme(t, res) {
  closeSheet(); busy('أجيب الواجهة «' + (CYT_NAMES[t.name] || t.name) + '»…');
  try {
    let c = {}; try { c = JSON.parse(await run('fetchText', { url: t.config })); } catch (e) { }
    const byFile = {}; t.walls.forEach(w => { byFile[w.file] = w.url; });
    const walls = cytOrder(c, t.walls.map(w => w.file)).map(f => byFile[f] || byFile[f.split('/').pop()]).filter(Boolean);
    let css = ''; for (const u of (t.css || []).slice(0, 4)) { try { css += await run('fetchText', { url: u }) + '\n'; } catch (e) { } }
    const icons = {}; (t.icons || []).slice(0, 150).forEach(x => { icons[x.pkg] = x.url; });
    unbusy();
    show('design');
    openDesign({ name: 'واجهة ' + (CYT_NAMES[t.name] || t.name), from: 'import', cfg: cytToCfg(c, walls, t.name, { src: res.home, path: t.path }, { css, icons }) });
    toast('هاي الواجهة مستوردة من ' + res.repo + '. عدّل براحتك وبعدين «طبّق على الشاشة»');
  } catch (e) { unbusy(); toast(errText(e)); }
}
async function openZipTheme(t, res) {
  closeSheet(); busy('أجهّز صور الواجهة…');
  try {
    let c = {}; try { c = JSON.parse(t.config || '{}'); } catch (e) { }
    const pics = t.count ? await run('zipTheme', { path: t.path, max: 20, __local: 1 }) : [];
    const by = {}; pics.forEach(p => { by[p.name] = p.data; });
    const walls = cytOrder(c, pics.map(p => p.name)).map(f => by[f] || by[f.split('/').pop()]).filter(Boolean);
    const icons = t.icons ? await run('zipIcons', { path: t.path, max: 150, __local: 1 }) : {};
    unbusy();
    show('design');
    openDesign({ name: 'واجهة ' + (CYT_NAMES[t.name] || t.name), from: 'import', cfg: cytToCfg(c, walls, t.name, { src: 'zip' }, { css: t.css || '', icons }) });
    toast('الواجهة كاملة بالمعاينة. غيّر أي شي من «الثيم» وبعدين «صدّر للشاشة»');
  } catch (e) { unbusy(); toast(errText(e)); }
}
async function importFromGithub(link) {
  busy('أدوّر على الواجهات بالمستودع…');
  try { const r = await ghScan(link); unbusy(); themesSheet(r.repo, r, openGhTheme); }
  catch (e) { unbusy(); toast(errText(e)); }
}
async function importFromZip() {
  busy('اختار ملف الـ ZIP…');
  try { const r = await run('pick', { mode: 'zip', __local: 1 }); unbusy(); themesSheet('من ملف ZIP', r, openZipTheme); }
  catch (e) { unbusy(); if (e.message !== 'CANCEL') toast(errText(e)); }
}

/* the import sheet: old choices kept, three new ones added */
designImport = function () {
  sheet(`<h2>استيراد</h2>
    <button class="btn pri full" id="imFile">${ic('file')} مشروع من ملف بالموبايل</button><div style="height:10px"></div>
    <button class="btn sec full" id="imZip">${ic('layers')} واجهات من ملف ZIP</button><div style="height:10px"></div>
    <label class="f">رابط GitHub لمشروع واجهات، أو رابط ملف مشروع</label><input id="imUrl" class="num" placeholder="https://github.com/…" inputmode="url">
    <button class="btn sec full" id="imGo" style="margin-top:10px">${ic('save')} جيب من الرابط</button>
    <button class="btn ghost full" id="imCyt" style="margin-top:10px">واجهات مشروع CleanYourTV (٢٨ واجهة)</button>`);
  $('#imFile').onclick = () => { closeSheet(); importFile(); };
  $('#imZip').onclick = () => { closeSheet(); importFromZip(); };
  $('#imCyt').onclick = () => { closeSheet(); importFromGithub(CYT_REPO); };
  $('#imGo').onclick = async () => {
    const u = $('#imUrl').value.trim(); if (!/^https?:\/\//.test(u)) return toast('اكتب رابط صحيح');
    closeSheet();
    if (/github\.com\//i.test(u) && !/\/blob\/.*\.json$/i.test(u)) return importFromGithub(u);
    busy('أنزل المشروع…');
    try { const t = await run('fetchText', { url: u.replace(/github\.com\/([^/]+)\/([^/]+)\/blob\//, 'raw.githubusercontent.com/$1/$2/') }); unbusy(); openImported(t); } catch (e) { unbusy(); toast(errText(e)); }
  };
};

/* ---------------- «واجهات حسب الشركة» for TVs ---------------- */
const TV_OS = [
  { id: 'tizen', name: 'سامسونگ', sub: 'Tizen', note: 'شريط سامسونگ الجانبي بدل الشريط القديم، اكتشف/مباشر/التطبيقات، الأخيرة والمقترحة', sw: ['#0b0f1c', '#ffffff'] },
  { id: 'oneui', name: 'سامسونگ One UI', sub: 'One UI', note: 'شريط سامسونگ العائم بالنص، البحث والإعدادات يسار، بطاقات كبيرة وأيقونات دائرية', sw: ['#06080c', '#9ec5ff'] },
  { id: 'webos', name: 'إل جي', sub: 'webOS', note: 'بطاقات طويلة ملوّنة فوق الخلفية', sw: ['#140b14', '#ff3d7f'] },
  { id: 'vidaa', name: 'هايسنس', sub: 'VIDAA', note: 'قوائم فوق، بنر داخل إطار وتطبيقات بيضاء', sw: ['#09111f', '#18a0fb'] },
  { id: 'googletv', name: 'گوگل TV', sub: 'Google TV', note: 'تبويبات فوق، بنر كبير وتطبيقاتك تحته', sw: ['#101216', '#8ab4f8'] },
  { id: 'androidtv', name: 'أندرويد TV', sub: 'Android TV', note: 'الشكل الكلاسيكي: صفوف بطاقات عريضة', sw: ['#1c2026', '#4285f4'] },
  { id: 'firetv', name: 'أمازون Fire TV', sub: 'Fire TV', note: 'قائمة فوق وبنر عريض وصف تطبيقات', sw: ['#0e121a', '#ff9900'] },
  { id: 'roku', name: 'روكو', sub: 'Roku', note: 'بنفسجي، قائمة جانبية وشبكة تطبيقات', sw: ['#4b1f74', '#ffffff'] },
  { id: 'patchwall', name: 'شاومي', sub: 'PatchWall', note: 'بطاقات طولية وأيقونات صغيرة، لون برتقالي', sw: ['#0c0c0c', '#ff6900'] },
  { id: 'appletv', name: 'أبل TV', sub: 'tvOS', note: 'الرف الأنيق: تطبيقات كبيرة ناعمة', sw: ['#1c1c1e', '#ffffff'] }
];
function tvOsCfg(o) {
  const S = o.id === 'appletv' ? { skin: 'shelf', theme: 'appletv', religious: false } : { skin: o.id, theme: 'appletv', religious: false };
  S.bgSources = ['nature'];
  return { v: 1, settings: S, layout: hide('weather', 'wisdom', 'bigcount', 'row-occasions', 'row-matches', 'adhanbox') };
}
function tvOsSheet() {
  sheet(`<h2>واجهات حسب الشركة</h2><p class="sub">كل واجهة تجي بشريط الشركة نفسه (يختفي الشريط القديم) وكل زر بيه يشتغل. تشوفها بالمعاينة، وتغيّر أي تفصيل من «الثيم» قبل ما تصدّرها.</p>
    <div class="tpl">${TV_OS.map(o => `<button data-os="${o.id}"><div class="sw2" style="background:linear-gradient(135deg,${o.sw[0]} 45%,${o.sw[1]}66);display:flex;align-items:center;justify-content:center"><span style="color:#fff;font-weight:800;letter-spacing:.12em;font-size:13px;direction:ltr">${esc(o.sub.toUpperCase())}</span></div><b>${esc(o.name)}</b><small>${esc(o.note)}</small></button>`).join('')}</div>`);
  $('#sheetBody').onclick = e => {
    const b = e.target.closest('[data-os]'); if (!b) return;
    tap(); const o = TV_OS.find(x => x.id === b.dataset.os); closeSheet();
    show('design'); openDesign({ name: 'واجهة ' + o.name, from: 'new', cfg: tvOsCfg(o) });
  };
}
/* the new looks in the editor's «شكل الواجهة» list too */
TV_OS.forEach(o => { if (o.id !== 'appletv' && !SKINS.some(s => s[0] === o.id)) SKINS.push([o.id, 'مثل ' + o.name, o.note]); });

/* two new tiles on the design start page */
(function () {
  const _ds = designStart;
  designStart = function () {
    _ds.apply(this, arguments);
    const t = document.querySelector('#designBody .tile'); if (!t || t.querySelector('[data-s2]')) return;
    const car = typeof devType === 'function' && devType() === 'car';
    t.insertAdjacentHTML('beforeend', (car ? '' : `<button data-s2="os">${ic('tv')}<b>واجهات حسب الشركة</b><small>سامسونگ، إل جي، هايسنس، گوگل TV وغيرها</small></button>`) +
      `<button data-s2="gh">${ic('save')}<b>من GitHub أو ZIP</b><small>واجهات مشاريع ثانية، وواجهات CleanYourTV</small></button>`);
    t.addEventListener('click', e => {
      const b = e.target.closest('[data-s2]'); if (!b) return;
      e.stopPropagation(); tap();
      if (b.dataset.s2 === 'os') tvOsSheet(); else designImport();
    }, true);
  };
})();

/* ================= every part of a look can be changed («عالم مفتوح») ================= */
SKINS.push(['cyt', 'مثل CleanYourTV', 'تحية وساعة كبيرة، أزرار فوق، شريط تطبيقات كبير وشبكة تحته']);
const BTN_NAMES = { profile: 'الملف الشخصي', search: 'البحث', ambient: 'وضع الجمال', apps: 'التطبيقات', home: 'الرئيسية / لك / اكتشف', menu: 'القائمة', shield: 'حماية الأطفال',
  live: 'مباشر', multi: 'عرض متعدد', settings: 'الإعدادات', ai: 'المساعد', games: 'الألعاب', inputs: 'المداخل', media: 'الوسائط', wifi: 'الشبكة', movies: 'أفلام',
  shows: 'مسلسلات', library: 'مكتبة', bell: 'الإشعارات', watch: 'ماذا يُعرض / زر «شاهد الآن»', kids: 'أطفال' };
const OS_BTNS = {
  tizen: ['profile', 'search', 'ambient', 'apps', 'home', 'live', 'menu', 'shield', 'watch'],
  oneui: ['profile', 'search', 'multi', 'settings', 'ai', 'home', 'live', 'games', 'ambient', 'apps', 'shield', 'watch'],
  webos: ['profile', 'search', 'home', 'inputs', 'settings', 'menu', 'watch'],
  vidaa: ['home', 'apps', 'inputs', 'media', 'search', 'wifi', 'settings', 'menu', 'watch'],
  googletv: ['search', 'home', 'movies', 'shows', 'apps', 'library', 'bell', 'profile', 'settings', 'menu', 'watch'],
  androidtv: ['search', 'inputs', 'wifi', 'settings', 'menu'],
  firetv: ['profile', 'home', 'search', 'live', 'apps', 'settings', 'menu', 'watch'],
  roku: ['home', 'watch', 'search', 'live', 'apps', 'settings', 'menu'],
  patchwall: ['home', 'movies', 'shows', 'kids', 'apps', 'search', 'inputs', 'settings', 'menu', 'watch']
};
const OS_COLORS = [['الأصلي', ''], ['أبيض', '#ffffff'], ['سماوي', '#33d6f5'], ['أزرق', '#18a0fb'], ['وردي', '#ff3d7f'], ['برتقالي', '#ff6900'], ['ذهبي', '#e8b84a'], ['أخضر', '#3ddc84'], ['بنفسجي', '#a855f7'], ['أحمر', '#ff3b3b']];
const tg = (k, label, on, sub) => `<div class="item tap" data-ok="${k}" style="padding:10px 0;min-height:0"><div class="t"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div><div class="toggle ${on ? 'on' : ''}"></div></div>`;
const ch = (list, cur, key) => `<div class="chips">${list.map(([n, v]) => `<button class="chip ${String(v) === String(cur ?? '') ? 'on' : ''}" data-oc="${key}" data-v="${esc(v)}">${v && /^#/.test(v) ? `<span class="cdot" style="background:${v};width:16px;height:16px"></span>` : ''}${esc(n)}</button>`).join('')}</div>`;
const rg = (key, label, min, max, step, val, unit) => `<div class="ctl"><div class="lb"><span>${esc(label)}</span><b data-ov="${key}">${val}${unit || ''}</b></div><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-or="${key}" data-u="${unit || ''}"></div>`;

function osDetailsHtml(S) {
  const o = S.os || {}, btns = OS_BTNS[S.skin] || [], off = o.barOff || [], lb = o.labels || {};
  return `<div class="panel" id="osDet"><h2>تفاصيل واجهة الشركة</h2><p class="sub" style="margin-top:-4px">غيّر أي شي بالواجهة: أزرار الشريط وأسماؤها، شكل الأيقونات، الألوان والصفوف. كل تغيير يبين بالمعاينة فوق.</p>
    <div class="lb" style="margin:6px 0"><span class="sub">أزرار الشريط (اضغط حتى تشيل الزر أو ترجعه)</span></div>
    <div class="chips">${btns.map(b => `<button class="chip ${off.includes(b) ? '' : 'on'}" data-ob="${b}">${esc(BTN_NAMES[b] || b)}</button>`).join('')}</div>
    <details style="margin:12px 0 4px"${Object.keys(lb).length ? ' open' : ''}><summary class="sub" style="cursor:pointer;padding:6px 0">أسماء الأزرار (اضغط حتى تغيّرها)</summary>
    ${btns.map(b => `<label class="f">${esc(BTN_NAMES[b] || b)}</label><input data-ol="${b}" value="${esc(lb[b] || '')}" maxlength="24" placeholder="الاسم الأصلي">`).join('')}</details>
    <div class="lb" style="margin:12px 0 6px"><span class="sub">شكل أيقونات التطبيقات</span></div>
    ${ch([['حسب الشركة', ''], ['دائرية', 'circle'], ['مربعة ناعمة', 'rounded'], ['مربعة', 'square'], ['عريضة', 'wide'], ['بنر التطبيق', 'banner']], o.shape || '', 'shape')}
    <div class="lb" style="margin:12px 0 6px"><span class="sub">لون التحديد</span></div>${ch(OS_COLORS, o.accent || '', 'accent')}
    <div class="list" style="margin:10px 0 0">${tg('hero', 'البنر الكبير فوق', o.hero !== false)}${tg('feat', 'صف البطاقات الكبيرة', o.feat !== false)}${S.skin === 'tizen' ? tg('deco', 'صف «متابعة المشاهدة» تحت', o.deco !== false) : ''}</div>
    <label class="f" style="margin-top:10px">عنوان صف البطاقات</label><input data-ot="featTitle" value="${esc(o.featTitle || '')}" maxlength="30" placeholder="حسب الشركة">
    <label class="f">عنوان صف التطبيقات</label><input data-ot="appsTitle" value="${esc(o.appsTitle || '')}" maxlength="30" placeholder="حسب الشركة">
    ${S.skin === 'roku' ? `<div class="lb" style="margin:12px 0 6px"><span class="sub">عدد التطبيقات بالصف</span></div>${ch([['٣', 3], ['٤', 4], ['٥', 5]], o.grid || 4, 'grid')}` : ''}
    <button class="btn ghost full" data-oreset="1" style="margin-top:12px">${ic('undo')} رجّع واجهة الشركة لأصلها</button></div>`;
}
function cytDetailsHtml(S) {
  const c = S.cyt || {};
  return `<div class="panel" id="osDet"><h2>تفاصيل واجهة CleanYourTV</h2><p class="sub" style="margin-top:-4px">نفس مفاتيح ملف config.json بالمشروع الأصلي، تغيّرها من هنا وتشوفها بالمعاينة.</p>
    ${rg('columns', 'عدد التطبيقات بالصف', 1, 8, 1, c.columns || 4)}
    <div class="list" style="margin:0">${tg('dock_band', 'شريط خلف أول صف (Dock)', c.dock_band !== false)}${tg('dock_glass', 'الشريط زجاجي', !!c.dock_glass)}${tg('single_row', 'كل التطبيقات بصف واحد', !!c.single_row)}
      ${tg('dock_title', 'اسم التطبيق كبير فوق الشريط', c.dock_title !== false)}${tg('cinematic_home', 'الرف السينمائي (صورة التطبيق فوق)', !!c.cinematic_home)}
      ${tg('ambient_glow', 'توهج بلون التطبيق خلف الشاشة', c.ambient_glow !== false)}${tg('app_glow', 'توهج حول التطبيق المختار', !!c.app_glow)}
      ${tg('always_show_names', 'أسماء تحت كل التطبيقات', !!c.always_show_names)}${tg('uniform_tiles', 'أيقونة على بطاقة ملوّنة بدل البنر', !!c.uniform_tiles)}
      ${tg('show_greeting', 'التحية فوق الساعة', c.show_greeting !== false)}${tg('header_white', 'التاريخ أبيض واضح', !!c.header_white)}${tg('date_below_clock', 'التاريخ تحت الساعة', !!c.date_below_clock)}
      ${tg('icon_only_buttons', 'أزرار الشبكة والإعدادات دائرية', !!c.icon_only_buttons)}${tg('icon_only_inputs', 'زر المداخل دائري', !!c.icon_only_inputs)}${tg('wifi_status_color', 'لون الواي فاي حسب الاتصال', !!c.wifi_status_color)}
      ${tg('fade_rows', 'الصفوف تختفي بنعومة لفوق', !!c.fade_rows)}${tg('reduced_motion', 'حركة هادئة (للشاشات الضعيفة)', !!c.reduced_motion)}${tg('wallpaper', 'صور الخلفية', c.wallpaper !== false)}</div>
    <div class="lb" style="margin:12px 0 6px"><span class="sub">شكل التحديد</span></div>${ch([['زجاج', 'glass'], ['إطار بس', 'rim'], ['هالة', 'halo']], c.glass_style || 'glass', 'glass_style')}
    <div class="lb" style="margin:12px 0 6px"><span class="sub">شكل التوهج</span></div>${ch([['دائري', 'radial'], ['من فوق', 'horizon']], c.glow_style || 'radial', 'glow_style')}
    <div class="lb" style="margin:12px 0 6px"><span class="sub">لون الخلفية</span></div>${ch([['أسود', '#000000'], ['ليلي', '#090C14'], ['فحمي', '#0E0F12'], ['كحلي', '#05070C'], ['بنفسجي', '#1a0b2e'], ['أخضر', '#06140f']], c.background_color || '#000000', 'background_color')}
    ${rg('wallpaper_dim', 'تعتيم الخلفية', 0, 90, 5, c.wallpaper_dim || 0, '%')}${rg('dock_opacity', 'وضوح الشريط', 30, 100, 5, c.dock_opacity == null ? 100 : c.dock_opacity, '%')}${rg('sky_intensity', 'سماء حسب الوقت', 0, 100, 5, c.sky_intensity || 0, '%')}
    ${c.cinematic_home ? rg('cinematic_art', 'وضوح صورة الرف السينمائي', 0, 100, 5, c.cinematic_art == null ? 50 : c.cinematic_art, '%') : ''}
    <label class="f" style="margin-top:6px">الاسم بعد التحية</label><input data-oy="greeting_name" value="${esc(c.greeting_name || '')}" maxlength="30">
    <div class="lb" style="margin:12px 0 6px"><span class="sub">الساعة</span></div>${ch([['١٢ ساعة', '12'], ['٢٤ ساعة', '24']], c.clock_format || '12', 'clock_format')}</div>`;
}
function cssHtml(css, car) {
  return `<div class="panel" id="cssDet"><h2>تصميم خاص (CSS)</h2><p class="sub" style="margin-top:-4px">للمتقدمين: أي CSS تكتبه هنا ينضاف آخر شي على ${car ? 'شاشة السيارة' : 'الواجهة'}، فيگدر يغيّر أي لون أو حجم أو مكان أو شكل. الواجهات المستوردة اللي بيها ملف CSS يجي هنا وحده.</p>
    <textarea id="cssBox" dir="ltr" spellcheck="false" style="width:100%;min-height:150px;font:13px/1.5 monospace;border-radius:12px;padding:10px;background:rgba(0,0,0,.25);color:inherit;border:1px solid rgba(255,255,255,.15)" placeholder="${car ? '.w { border-radius: 4vh; }' : '#row-apps .app .tile { border-radius: 50%; }'}">${esc(css || '')}</textarea>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn sec" style="flex:1" data-css="apply">${ic('save')} جرّب بالمعاينة</button><button class="btn ghost" style="flex:1" data-css="clear">امسح</button></div></div>`;
}

function osPanelWire(box, S) {
  const redo = () => { changed(); live({ settings: S }); designPanel(); };
  const soft = () => { changed(); live({ settings: S }); };
  box.addEventListener('click', e => {
    const t = e.target.closest('[data-ob],[data-ok],[data-oc],[data-oreset],[data-css]'); if (!t) return;
    e.stopPropagation(); tap();
    const isCyt = S.skin === 'cyt', O = isCyt ? (S.cyt = S.cyt || {}) : (S.os = S.os || {});
    if (t.dataset.css) {
      const v = $('#cssBox').value;
      if (t.dataset.css === 'clear') { delete S.css; $('#cssBox').value = ''; } else if (v.trim()) S.css = v.slice(0, 60000); else delete S.css;
      soft(); toast(t.dataset.css === 'clear' ? 'انمسح التصميم الخاص' : 'انطبق بالمعاينة'); return;
    }
    if (t.dataset.oreset) { delete S.os; redo(); return; }
    if (t.dataset.ob) { const off = O.barOff = O.barOff || [], i = off.indexOf(t.dataset.ob); if (i >= 0) off.splice(i, 1); else off.push(t.dataset.ob); redo(); return; }
    if (t.dataset.ok) {
      const k = t.dataset.ok, defOn = isCyt ? !['dock_glass', 'single_row', 'cinematic_home', 'app_glow', 'always_show_names', 'uniform_tiles', 'header_white', 'date_below_clock', 'icon_only_buttons', 'icon_only_inputs', 'wifi_status_color', 'fade_rows', 'reduced_motion'].includes(k) : true;
      const cur = O[k] === undefined ? defOn : !!O[k]; O[k] = !cur;
      if (isCyt && k === 'wallpaper') { if (O[k] && (S.bgPack || []).length) delete S.bgMode; else if (!O[k]) S.bgMode = 'palette'; }
      redo(); return;
    }
    if (t.dataset.oc) { const k = t.dataset.oc, v = t.dataset.v; if (v === '') delete O[k]; else O[k] = /^\d+$/.test(v) && k !== 'clock_format' ? +v : v; redo(); }
  });
  box.addEventListener('input', e => {
    const t = e.target; e.stopPropagation();
    const O = S.skin === 'cyt' ? (S.cyt = S.cyt || {}) : (S.os = S.os || {});
    if (t.dataset.or) { O[t.dataset.or] = +t.value; const b = box.querySelector(`[data-ov="${t.dataset.or}"]`); if (b) b.textContent = t.value + (t.dataset.u || ''); }
  });
  box.addEventListener('change', e => {
    const t = e.target; e.stopPropagation();
    const O = S.skin === 'cyt' ? (S.cyt = S.cyt || {}) : (S.os = S.os || {});
    if (t.dataset.or) { soft(); return; }
    if (t.dataset.ol) { O.labels = O.labels || {}; if (t.value.trim()) O.labels[t.dataset.ol] = t.value.trim(); else delete O.labels[t.dataset.ol]; soft(); return; }
    if (t.dataset.ot) { if (t.value.trim()) O[t.dataset.ot] = t.value.trim(); else delete O[t.dataset.ot]; soft(); return; }
    if (t.dataset.oy) { if (t.value.trim()) O[t.dataset.oy] = t.value.trim(); else delete O[t.dataset.oy]; soft(); }
  });
}
(function () {
  const _dp = designPanel;
  designPanel = function () {
    _dp.apply(this, arguments);
    if (!D || D.tab !== 'theme' || (typeof isCarD === 'function' && isCarD())) return;
    const S = D.cfg.settings, p = $('#dPanel'); if (!p) return;
    const box = document.createElement('div');
    box.innerHTML = (OS_BTNS[S.skin] ? osDetailsHtml(S) : S.skin === 'cyt' ? cytDetailsHtml(S) : '') + cssHtml(S.css, false);
    p.insertBefore(box, p.children[1] || null);
    osPanelWire(box, S);
  };
  if (typeof carEditorPanels === 'function') {
    const _cp = carEditorPanels;
    carEditorPanels = function () {
      _cp.apply(this, arguments);
      if (!D || D.tab !== 'theme') return;
      const C = CC(), p = $('#dPanel'); if (!p) return;
      const box = document.createElement('div'); box.innerHTML = cssHtml(C.css, true); p.appendChild(box);
      box.addEventListener('click', e => {
        const t = e.target.closest('[data-css]'); if (!t) return;
        e.stopPropagation(); tap();
        const v = $('#cssBox').value;
        if (t.dataset.css === 'clear') { delete C.css; $('#cssBox').value = ''; } else if (v.trim()) C.css = v.slice(0, 60000); else delete C.css;
        changed(); carLive(); toast(t.dataset.css === 'clear' ? 'انمسح التصميم الخاص' : 'انطبق بالمعاينة');
      });
      box.addEventListener('input', e => e.stopPropagation());
    };
  }
})();
