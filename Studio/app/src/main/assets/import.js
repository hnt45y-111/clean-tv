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

/* CleanYourTV config.json → our TV design */
function cytToCfg(c, walls, name, meta) {
  c = c || {};
  const bg = hexc(c.background_color) || '#0b0d14', ac = hexc(c.accent_color) || '#ffffff';
  const glassy = c.dock_glass || c.cinematic_home || c.glass_style === 'rim';
  const S = { religious: false, theme: 'appletv', skin: c.dock_row === false || !glassy ? 'ribbon' : 'shelf', palette: { a: ac, b: '#ffffff', c: bg } };
  if (c.greeting_name) S.owner = String(c.greeting_name).slice(0, 30);
  if (walls.length && c.wallpaper !== false) {
    S.bgPack = walls.slice(0, 30);
    const m = +c.wallpaper_rotation_minutes;
    S.bgInterval = m > 0 ? Math.max(60, Math.round(m * 60)) : walls.length > 1 ? 3600 : 7 * 86400;
  } else S.bgMode = 'palette';
  return { v: 1, settings: S, layout: hide('weather', 'wisdom', 'bigcount', 'row-occasions', 'row-matches', 'adhanbox'), meta: Object.assign({ name }, meta || {}) };
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
    const walls = pics.filter(f => f !== shot);
    return { src: 'gh', path: d, name: d.split('/').pop() || g.r, config: raw(x.path), shot: shot ? raw(shot.path) : walls[0] ? raw(walls[0].path) : '', count: walls.length,
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
      <b>${esc(CYT_NAMES[t.name] || t.name)}</b><small>${t.count ? nfA(t.count) + ' خلفية' : 'بدون صور، لون فقط'}</small></button>`).join('')}</div>` : ''}
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
    unbusy();
    show('design');
    openDesign({ name: 'واجهة ' + (CYT_NAMES[t.name] || t.name), from: 'import', cfg: cytToCfg(c, walls, t.name, { src: res.home, path: t.path }) });
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
    unbusy();
    show('design');
    openDesign({ name: 'واجهة ' + (CYT_NAMES[t.name] || t.name), from: 'import', cfg: cytToCfg(c, walls, t.name, { src: 'zip' }) });
    toast('صور الواجهة تنرسل للشاشة من تضغط «طبّق على الشاشة»');
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
  { id: 'tizen', name: 'سامسونگ', sub: 'Tizen', note: 'شريط جانبي، بنر كبير، مقترحات وأيقونات مربعة', sw: ['#0b0f1c', '#ffffff'] },
  { id: 'oneui', name: 'سامسونگ One UI', sub: 'One UI', note: 'شريط عائم فوق، بنر عريض وأيقونات دائرية', sw: ['#06080c', '#9ec5ff'] },
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
  sheet(`<h2>واجهات حسب الشركة</h2><p class="sub">شكل واجهات الشاشات الذكية المعروفة، بالعربي ويّا تطبيقاتك. تشوفها بالمعاينة وتعدّل الألوان والخلفية قبل ما تطبّقها.</p>
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
