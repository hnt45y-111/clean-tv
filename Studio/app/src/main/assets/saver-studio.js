'use strict';
/* ============================================================ screensaver editor, religion, news widget */
window.__pvFetch = url => run('fetchText', { url }).catch(() => '');

const SV_DEF = { bg: 'design', fx: 'kenburns', every: 60, dim: 40, clock: 'big', csize: 100, cpos: 'bl', h24: false, latin: false, date: true, hijri: true, card: 'auto', kpos: 'br', ksize: 100, pack: [] };
const SV_BG = [['خلفيات الواجهة', 'design'], ['صور خاصة', 'pack'], ['ضبابية ناعمة', 'blur'], ['تدرج ألوان', 'gradient'], ['أسود', 'black']];
const SV_FX = [['تقريب بطيء', 'kenburns'], ['تلاشي', 'fade'], ['انزلاق', 'slide'], ['زوم', 'zoom'], ['بدون حركة', 'none']];
const SV_EVERY = [['٣٠ ثانية', 30], ['دقيقة', 60], ['دقيقتين', 120], ['٥ دقايق', 300]];
const SV_CLOCK = [['كبيرة رفيعة', 'big'], ['عريضة', 'bold'], ['أميري', 'serif'], ['كوفي', 'kufi'], ['زجاجية', 'glass'], ['عقارب', 'analog'], ['صغيرة', 'minimal']];
const SV_POS = [['أسفل اليسار', 'bl'], ['أسفل اليمين', 'br'], ['فوق اليسار', 'tl'], ['فوق اليمين', 'tr'], ['بالنص', 'center']];
const SV_CARD = [['تلقائي حسب الواجهة', 'auto'], ['أخبار النادي', 'club'], ['ديني', 'faith'], ['أخبار عربية', 'news'], ['بدون بطاقة', 'none']];
const SV_KTYPES = SV_CARD.filter(x => x[1] !== 'none');
const SV_KPOS = [['فوق اليمين', 'tr'], ['فوق النص', 'tc'], ['فوق اليسار', 'tl'], ['يمين النص', 'mr'], ['يسار النص', 'ml'], ['تحت اليمين', 'br'], ['تحت النص', 'bc'], ['تحت اليسار', 'bl']];
const SV_KEVERY = [['١٠ ثواني', 10], ['٣٠ ثانية', 30], ['دقيقة', 60], ['دقيقتين', 120], ['٥ دقايق', 300]];
/* the cards list: old designs kept one card in sv.card / sv.kpos */
function svCards() {
  const s = SV();
  if (!Array.isArray(s.cards)) s.cards = svv('card') === 'none' ? [] : [{ k: svv('card'), pos: svv('kpos') === svv('cpos') ? (svv('cpos') === 'br' ? 'bl' : 'br') : svv('kpos') }];
  return s.cards;
}
const FAITHS = [['muslim', 'مسلم'], ['christian', 'مسيحي'], ['sabian', 'صابئي مندائي'], ['none', 'عام (بدون محتوى ديني)']];
const FAITH_BG = { 'muslim-shia': ['shrines', 'ahlulbayt'], 'muslim-sunni': ['mecca', 'nabawi'], christian: ['churches', 'nature'], sabian: ['mandaean', 'nature'], none: ['nature'] };

function SV() { const S = D.cfg.settings; return S.saver || (S.saver = deepCopy(SV_DEF)); }
const svv = k => { const s = SV(); return s[k] === undefined ? SV_DEF[k] : s[k]; };

/* the preview shows the screensaver while its tab is open */
const _loadPreview2 = loadPreview;
loadPreview = async function (frame) {
  await _loadPreview2(frame);
  if (D && D.tab === 'saver' && !(typeof isCarD === 'function' && isCarD())) frame.src = 'launcher/saver.html?preview=1&t=' + Date.now();
};
const _designEditor2 = designEditor;
designEditor = function () {
  _designEditor2();
  if (typeof isCarD === 'function' && isCarD()) return;
  const seg = $('#dSeg'); if (!seg || seg.querySelector('[data-tab="saver"]')) return;
  seg.insertAdjacentHTML('beforeend', '<button data-tab="saver">التوقف</button>');
  seg.onclick = e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tap(); const was = D.tab; D.tab = b.dataset.tab;
    if (was === 'saver' || D.tab === 'saver') { D.sel = D.tab === 'saver' ? 'sclock' : null; loadPreview($('#pvf')); }
    designPanel();
  };
};
const _prevSel2 = window.__previewSelect;
window.__previewSelect = id => {
  if (!D || D.tab !== 'saver') return _prevSel2(id);
  tap(); D.sel = id || 'sbg'; live({ select: D.sel });
  const t = $('#sv_' + D.sel); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function saverPanel() {
  const S = D.cfg.settings, p = $('#dPanel');
  document.querySelectorAll('#dSeg button').forEach(b => b.classList.toggle('on', b.dataset.tab === D.tab));
  const rng = (k, min, max, step, fmt) => `<div class="ctl"><div class="lb"><span>${fmt[0]}</span><b id="svv_${k}">${fmt[1](svv(k))}</b></div><input type="range" min="${min}" max="${max}" step="${step}" value="${svv(k)}" data-svr="${k}"></div>`;
  const tg = (k, n, sub) => `<div class="item tap" data-svt="${k}" style="padding:10px 0;min-height:0"><div class="t"><b>${n}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="toggle ${svv(k) ? 'on' : ''}"></div></div>`;
  const pack = svv('pack') || [];
  p.innerHTML = `
    <div class="panel"><div class="item tap" data-svon="1" style="padding:0 0 10px;min-height:0"><div class="t"><b>شاشة التوقف</b><small>تطلع على الواجهة وفوق التطبيقات من ما تلمس الريموت</small></div><div class="toggle ${S.saverOn !== false ? 'on' : ''}"></div></div>
      <div class="lb" style="margin:6px 0"><span class="sub">تطلع بعد</span></div>${chips([['٥ دقايق', 5], ['١٠ دقايق', 10], ['١٥ دقيقة', 15], ['نص ساعة', 30], ['ساعة', 60]], S.saverMin || 10, 'svmin')}</div>
    <div class="panel" id="sv_sbg"><h2>الخلفية</h2>${chips(SV_BG, svv('bg'), 'svbg')}
      ${svv('bg') === 'pack' ? `<div class="tpl" style="margin-top:10px">${pack.map((u, i) => `<button data-svpk="${i}"><div class="sw2" style="background:#000 url('${esc(u)}') center/cover;height:76px"></div><small style="padding:6px 10px">${ic('trash')} شيل</small></button>`).join('')}</div>
        <button class="btn sec full" id="svAdd" style="margin-top:8px">${ic('plus')} أضف صور من موبايلي</button>` : ''}
      <div class="lb" style="margin:12px 0 6px"><span class="sub">الحركة والمؤثر</span></div>${chips(SV_FX, svv('fx'), 'svfx')}
      <div class="lb" style="margin:12px 0 6px"><span class="sub">تتبدل الصورة كل</span></div>${chips(SV_EVERY, svv('every'), 'svev')}
      ${rng('dim', 0, 80, 5, ['التعتيم', v => v + '%'])}</div>
    <div class="panel" id="sv_sclock"><h2>الساعة والتاريخ</h2><p class="sub" style="margin-top:-4px">ثابتة بمكانها وما تتحرك.</p>
      ${chips(SV_CLOCK, svv('clock'), 'svck')}
      ${rng('csize', 60, 160, 5, ['الحجم', v => v + '%'])}
      <div class="lb" style="margin:6px 0"><span class="sub">المكان</span></div>${chips(SV_POS, svv('cpos'), 'svcp')}
      <div class="list" style="margin:8px 0 0">${tg('date', 'التاريخ الميلادي')}${tg('hijri', 'التاريخ الهجري')}${tg('h24', 'نظام ٢٤ ساعة')}${tg('latin', 'أرقام إنگليزية (4:38)')}</div></div>
    <div class="panel" id="sv_scard"><h2>البطاقات</h2><p class="sub" style="margin-top:-4px">تگدر تحط لحد ٣ بطاقات، كل وحدة بمكانها. محتواها يتقلب وحده: بالأندية أخبار النادي والمباريات، وبالواجهات الدينية صور وآيات، وغيرها آخر الأخبار.</p>
      ${svCards().map((c, i) => `<div class="panel soft" style="margin:10px 0 0;padding:12px"><div class="lb" style="margin:0 0 8px"><b>البطاقة ${['الأولى', 'الثانية', 'الثالثة'][i]}</b><button class="btn ghost" data-svkdel="${i}" style="min-height:34px;padding:0 12px">${ic('trash')} شيل</button></div>
        ${chips(SV_KTYPES, c.k || 'auto', 'svkk' + i)}
        <div class="lb" style="margin:10px 0 6px"><span class="sub">مكانها</span></div>${chips(SV_KPOS, c.pos || 'br', 'svkp' + i)}
        <div class="ctl"><div class="lb"><span>يمين ويسار</span><b id="svkxv${i}">${c.x || 0}</b></div><input type="range" min="-600" max="600" step="10" value="${c.x || 0}" data-svkx="${i}"></div>
        <div class="ctl"><div class="lb"><span>فوق وجوه</span><b id="svkyv${i}">${c.y || 0}</b></div><input type="range" min="-400" max="400" step="10" value="${c.y || 0}" data-svky="${i}"></div></div>`).join('')}
      ${svCards().length < 3 ? `<button class="btn sec full" id="svkAdd" style="margin-top:10px">${ic('plus')} أضف بطاقة</button>` : ''}
      ${svCards().length ? `<div class="lb" style="margin:12px 0 6px"><span class="sub">يتقلب محتوى البطاقة كل</span></div>${chips(SV_KEVERY, svv('kevery') || 10, 'svke')}${rng('ksize', 70, 130, 5, ['حجم البطاقات', v => v + '%'])}` : ''}</div>
    <button class="btn ghost full" id="svPv">${ic('screen')} شوفها بالشاشة الكاملة</button>`;
  p.oninput = e => {
    const kx = e.target.closest('[data-svkx],[data-svky]');
    if (kx) { const ax = kx.dataset.svkx !== undefined ? 'x' : 'y', i = +(kx.dataset.svkx !== undefined ? kx.dataset.svkx : kx.dataset.svky), c = svCards()[i]; if (!c) return; c[ax] = +kx.value; const v = $('#svk' + ax + 'v' + i); if (v) v.textContent = kx.value; D.sel = 'scard'; changed(); live({ settings: S, select: 'scard' }); return; }
    const r = e.target.closest('[data-svr]'); if (!r) return; SV()[r.dataset.svr] = +r.value; const v = $('#svv_' + r.dataset.svr); if (v) v.textContent = r.value + '%'; changed(); live({ settings: S, select: D.sel }); };
  p.onclick = e => {
    const t = e.target.closest('button,[data-svt],[data-svon]'); if (!t) return;
    const ds = t.dataset, s = SV();
    if (ds.svon) S.saverOn = S.saverOn === false;
    else if (ds.svmin) S.saverMin = +ds.svmin;
    else if (ds.svbg) { s.bg = ds.svbg; D.sel = 'sbg'; if (ds.svbg === 'pack' && !(s.pack || []).length) { addSaverPhotos(); return; } }
    else if (ds.svfx) s.fx = ds.svfx;
    else if (ds.svev) s.every = +ds.svev;
    else if (ds.svck) { s.clock = ds.svck; D.sel = 'sclock'; }
    else if (ds.svcp) { s.cpos = ds.svcp; D.sel = 'sclock'; }
    else if (t.id === 'svkAdd') { const l = svCards(), used = l.map(c => c.pos); l.push({ k: l.length ? 'news' : 'auto', pos: (['br', 'tr', 'tl', 'bl', 'mr', 'ml'].find(p => !used.includes(p) && p !== svv('cpos')) || 'tr') }); D.sel = 'scard'; }
    else if (ds.svkdel !== undefined) { svCards().splice(+ds.svkdel, 1); D.sel = 'scard'; }
    else if (ds.svke) s.kevery = +ds.svke;
    else if (Object.keys(ds).some(k => /^svk[kp]\d$/.test(k))) {
      const key = Object.keys(ds).find(k => /^svk[kp]\d$/.test(k)), i = +key.slice(-1), c = svCards()[i];
      if (c) { if (key[3] === 'k') c.k = ds[key]; else c.pos = ds[key]; } D.sel = 'scard';
    }
    else if (ds.svt) { s[ds.svt] = !svv(ds.svt); D.sel = 'sclock'; }
    else if (ds.svpk !== undefined) s.pack.splice(+ds.svpk, 1);
    else if (t.id === 'svAdd') { addSaverPhotos(); return; }
    else if (t.id === 'svPv') { window.__PREVIEW_DATA && (window.__PREVIEW_DATA.cfg = deepCopy(D.cfg)); const ff = $('#pvFullF'); ff.src = 'launcher/saver.html?preview=1&t=' + Date.now(); $('#pvFull').classList.add('on'); fitFrames(); return; }
    else return;
    tap(); changed(); live({ settings: S, select: D.sel }); saverPanel();
  };
}
function addSaverPhotos() {
  busy('اختار صور لشاشة التوقف…');
  run('pick', { mode: 'bgimages' }).then(l => { unbusy(); const s = SV(); s.bg = 'pack'; s.pack = l.concat(s.pack || []).slice(0, 15); changed(); live({ settings: D.cfg.settings, select: 'sbg' }); saverPanel(); })
    .catch(e => { unbusy(); if (e.message !== 'CANCEL') toast(errText(e)); });
}

const _designPanel4 = designPanel;
designPanel = function () {
  if (D && D.tab === 'saver' && !(typeof isCarD === 'function' && isCarD())) return saverPanel();
  const r = _designPanel4();
  if (!D || D.tab !== 'set' || (typeof isCarD === 'function' && isCarD())) return r;
  const S = D.cfg.settings, p = $('#dPanel'); if (!p || $('#faithPanel')) return r;
  const f = S.faith || { rel: S.religious === false ? 'none' : 'muslim', sect: 'shia' }, n = S.news || {};
  p.insertAdjacentHTML('afterbegin', `
    <div class="panel" id="faithPanel"><h2>الدين والمذهب</h2><p class="sub" style="margin-top:-4px">الواجهة وشاشة التوقف تعرض اللي يخص دينك: المناسبات، الآيات أو الكلمات، الصور، والأذان.</p>
      ${chips(FAITHS.map(x => [x[1], x[0]]), f.rel, 'frel')}
      ${f.rel === 'muslim' ? `<div class="lb" style="margin:10px 0 6px"><span class="sub">المذهب</span></div>${chips([['شيعي', 'shia'], ['سني', 'sunni']], f.sect || 'shia', 'fsect')}` : ''}</div>
    <div class="panel" id="newsPanel"><div class="item tap" id="nwTg" style="padding:0;min-height:0"><div class="t"><b>ويدجت الأخبار</b><small>بطاقة صغيرة بالواجهة الرئيسية تتقلب بالأخبار والصور</small></div><div class="toggle ${n.on ? 'on' : ''}"></div></div>
      ${n.on ? `<div style="margin-top:10px">${chips([['حسب الواجهة', 'auto'], ['أخبار النادي', 'club'], ['أخبار عربية', 'arabic']], n.src || 'auto', 'nws')}</div>
        <div class="lb" style="margin:12px 0 6px"><span class="sub">الشكل</span></div>${chips(viewsFor('newscard'), (D.cfg.layout.newscard || {}).view || '', 'nwv')}
        <div class="lb" style="margin:12px 0 6px"><span class="sub">يتقلب الخبر كل</span></div>${chips([['١٠ ثواني', 10], ['٢٠ ثانية', 20], ['٣٠ ثانية', 30], ['دقيقة', 60]], n.every || 12, 'nwe')}
        <button class="btn sec full" id="nwMove" style="margin-top:12px">${ic('layers')} حرّكه وغيّر حجمه وخلفيته</button>` : ''}</div>`);
  const fp = $('#faithPanel'), np = $('#newsPanel');
  fp.onclick = e => {
    const b = e.target.closest('[data-frel],[data-fsect]'); if (!b) return;
    tap();
    const nf = Object.assign({ rel: 'muslim', sect: 'shia' }, S.faith || {});
    if (b.dataset.frel) nf.rel = b.dataset.frel; if (b.dataset.fsect) nf.sect = b.dataset.fsect;
    S.faith = nf; S.religious = nf.rel !== 'none';
    const key = nf.rel === 'muslim' ? 'muslim-' + nf.sect : nf.rel;
    if (!(S.bgPack && S.bgPack.length)) S.bgSources = FAITH_BG[key];
    if (nf.rel !== 'muslim') S.adhanMode = 'off'; else if (S.adhanMode === 'off') delete S.adhanMode;
    changed(); live({ settings: S }); designPanel();
    toast('صارت الواجهة حسب: ' + (FAITHS.find(x => x[0] === nf.rel) || [, ''])[1] + (nf.rel === 'muslim' ? ' · ' + (nf.sect === 'sunni' ? 'سني' : 'شيعي') : ''));
  };
  np.onclick = e => {
    if (e.target.closest('#nwTg')) { S.news = Object.assign({}, S.news, { on: !(S.news && S.news.on) }); if (S.news.on) { D.sel = 'newscard'; } }
    else if (e.target.closest('#nwMove')) { tap(); D.tab = 'el'; D.sel = 'newscard'; designPanel(); live({ select: 'newscard' }); return; }
    else if (e.target.closest('[data-nwv]')) { const v = e.target.closest('[data-nwv]').dataset.nwv; D.cfg.layout.newscard = Object.assign({}, D.cfg.layout.newscard, { view: v }); if (!v) delete D.cfg.layout.newscard.view; D.sel = 'newscard'; tap(); changed(); live({ layout: D.cfg.layout, select: 'newscard' }); designPanel(); return; }
    else if (e.target.closest('[data-nwe]')) S.news = Object.assign({}, S.news, { every: +e.target.closest('[data-nwe]').dataset.nwe });
    else { const b = e.target.closest('[data-nws]'); if (!b) return; S.news = Object.assign({}, S.news, { src: b.dataset.nws }); }
    tap(); changed(); live({ settings: S, select: D.sel }); designPanel();
  };
  return r;
};

/* exporting: the screensaver's own photos go to the TV with the design */
const _localPack3 = localPackToTv;
localPackToTv = async function (cfg) {
  cfg = await _localPack3(cfg);
  const P = cfg && cfg.settings && cfg.settings.saver && cfg.settings.saver.pack;
  if (P && P.some(u => u && u.startsWith('data:'))) { cfg = deepCopy(cfg); await sendPhotos(cfg.settings.saver.pack, 's'); }
  return cfg;
};
