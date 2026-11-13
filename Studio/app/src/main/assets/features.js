'use strict';
/* ============================================================ general additions
   1 sleep/wake schedule + kids watch time · 2 app lock · 3 export to every screen · 4 phone notifications on the TV
   5 voice search · 6 automatic occasion themes · 7 usage report · 8 search the internet for backgrounds */

const pinHash = p => { let h = 2166136261; String(p || '').split('').forEach(c => { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }); return 'h' + h.toString(36); };
async function tvDev() { try { const c = JSON.parse(await run('cfgGet')); return c.dev || {}; } catch (e) { if (e.message === 'NOCFG') return null; throw e; } }
async function sendDev(dev) { await run('cfgSet', { cfg: JSON.stringify({ v: 1, dev }) }); }
function appPicker(title, apps, sel, max, done) {
  const draw = () => {
    sheet(`<h2>${esc(title)}</h2><p class="sub">اخترت ${sel.length}${max ? ' من ' + max : ''}</p><div class="list">${apps.map(a => `<div class="item tap" data-ap="${esc(a.pkg)}"><div class="check ${sel.includes(a.pkg) ? 'on' : ''}">${ic('check')}</div><div class="t"><b>${esc(a.label)}</b><small class="num" style="direction:ltr;text-align:right">${esc(a.pkg)}</small></div></div>`).join('') || '<div class="empty">ما لگيت تطبيقات</div>'}</div>
      <button class="btn pri full" id="apDone" style="position:sticky;bottom:0">${ic('check')} تمام</button>`);
    $('#sheetBody').onclick = e => {
      if (e.target.closest('#apDone')) { closeSheet(); done(sel); return; }
      const r = e.target.closest('[data-ap]'); if (!r) return;
      const i = sel.indexOf(r.dataset.ap); if (i >= 0) sel.splice(i, 1); else if (!max || sel.length < max) sel.push(r.dataset.ap);
      const sc = $('#sheet').scrollTop; draw(); $('#sheet').scrollTop = sc;
    };
  };
  draw();
}

/* ---------- 1 + 2: schedule, kids time, app lock ---------- */
async function openDevSettings() {
  if (!need()) return;
  busy('أجيب إعدادات الشاشة…');
  let dev = null, apps = [];
  try { dev = await tvDev(); apps = await tvAppList(); } catch (e) { unbusy(); return toast(errText(e)); }
  unbusy();
  if (dev === null) return needLauncherSheet('هذي الإعدادات تحتاج «واجهة مدير الشاشات» النسخة الجديدة على الشاشة.', openDevSettings);
  const st = { sleep: (dev.sched || {}).sleep || '', wake: (dev.sched || {}).wake || '', limit: dev.kidsLimit == null ? 120 : dev.kidsLimit, kidsApps: (dev.kidsApps || []).slice(),
    locks: ((dev.locks || {}).pkgs || []).slice(), hasPin: !!(dev.locks || {}).hasPin, pin: '' };
  const name = p => (apps.find(a => a.pkg === p) || { label: p }).label;
  const draw = () => page('إعدادات الشاشة', `
    <div class="panel"><h2>${ic('sun')} جدول التشغيل</h2><p class="sub" style="margin-top:-4px">الشاشة تنبهك وتنطفي وحدها بالوقت اللي تحدده كل يوم. التشغيل الصبح يشتغل بالشاشات اللي تسمح بيه.</p>
      <div class="row" style="gap:10px"><div style="flex:1"><label class="f">تنطفي الساعة</label><input type="time" id="dvSleep" value="${esc(st.sleep)}"></div>
        <div style="flex:1"><label class="f">تشتغل الساعة</label><input type="time" id="dvWake" value="${esc(st.wake)}"></div></div>
      <p class="sub" style="font-size:12px">خلي الخانة فارغة حتى تلغيها.</p></div>
    <div class="panel"><h2>${ic('user')} وقت الأطفال</h2><p class="sub" style="margin-top:-4px">بوضع الأطفال، من يخلص الوقت باليوم تتقفل التطبيقات لحد باچر.</p>
      ${chips([['٣٠ دقيقة', 30], ['ساعة', 60], ['ساعة ونص', 90], ['ساعتين', 120], ['٣ ساعات', 180], ['بدون حد', 0]], st.limit, 'kl')}
      <button class="btn sec full" id="dvKids" style="margin-top:12px">${ic('apps')} تطبيقات الأطفال (${st.kidsApps.length})</button></div>
    <div class="panel"><h2>${ic('key')} قفل التطبيقات</h2><p class="sub" style="margin-top:-4px">التطبيقات المقفولة تطلب رمز قبل ما تنفتح على الشاشة.</p>
      <label class="f">${st.hasPin ? 'الرمز محفوظ. اكتب رمز جديد إذا تريد تغيّره' : 'رمز القفل (٤ أرقام أو أكثر)'}</label><input id="dvPin" type="password" inputmode="numeric" maxlength="8" class="num" placeholder="••••">
      <div class="chips" style="margin-top:10px">${st.locks.map(p => `<span class="chip on">${ic('key')}${esc(name(p))}</span>`).join('') || '<span class="sub">ماكو تطبيقات مقفولة</span>'}</div>
      <button class="btn sec full" id="dvLock" style="margin-top:10px">${ic('apps')} اختار التطبيقات المقفولة</button></div>
    <button class="btn pri full" id="dvSave">${ic('check')} احفظ على الشاشة</button>`, el => {
    el.onclick = e => {
      const k = e.target.closest('[data-kl]'); if (k) { read(); st.limit = +k.dataset.kl; draw(); return; }
      if (e.target.closest('#dvKids')) { read(); appPicker('تطبيقات الأطفال', apps, st.kidsApps, 0, l => { st.kidsApps = l; draw(); }); return; }
      if (e.target.closest('#dvLock')) { read(); appPicker('التطبيقات المقفولة', apps, st.locks, 0, l => { st.locks = l; draw(); }); return; }
      if (e.target.closest('#dvSave')) save();
    };
  });
  const read = () => { st.sleep = ($('#dvSleep') || {}).value || ''; st.wake = ($('#dvWake') || {}).value || ''; const p = ($('#dvPin') || {}).value || ''; if (p) st.pin = p; };
  const save = async () => {
    read();
    if (st.pin && st.pin.length < 4) return toast('الرمز لازم يكون ٤ أرقام أو أكثر');
    if (st.locks.length && !st.hasPin && !st.pin) return toast('اكتب رمز القفل أول');
    const d = { sched: { sleep: st.sleep, wake: st.wake }, kidsLimit: st.limit, kidsApps: st.kidsApps, locks: { pkgs: st.locks } };
    if (st.pin) { d.locks.pin = pinHash(st.pin); d.kidsPin = st.pin; }
    busy('أحفظ على الشاشة…');
    try { await sendDev(d); unbusy(); toast('انحفظت على ' + tvName() + ' ✓'); addLog('إعدادات الشاشة (جدول، أطفال، قفل)', []); goBack(); }
    catch (e) { unbusy(); toast(errText(e)); }
  };
  draw();
}

/* ---------- 7: usage report ---------- */
async function openUsage() {
  if (!need()) return;
  if (!(await ensureDirectToken())) return;
  busy('أجيب تقرير الاستخدام…');
  let r; try { r = await dapi('usage'); } catch (e) { unbusy(); return toast(errText(e)); }
  unbusy();
  const U = r.usage || {}, names = {}; (r.apps || []).forEach(a => { names[a.pkg] = a.label; });
  const label = p => names[p] || (KNOWN_APPS[p] || [])[0] || p.split('.').pop();
  const days = Object.keys(U).sort().slice(-7), week = {};
  days.forEach(d => Object.entries(U[d]).forEach(([p, ms]) => { if (p !== 'com.cleantv.launcher') week[p] = (week[p] || 0) + ms; }));
  const tot = d => Object.entries(U[d] || {}).filter(([p]) => p !== 'com.cleantv.launcher').reduce((s, [, v]) => s + v, 0);
  const fm = ms => { const m = Math.round(ms / 60000); return m >= 60 ? Math.floor(m / 60) + ' س ' + (m % 60 ? m % 60 + ' د' : '') : m + ' دقيقة'; };
  const max = Math.max(1, ...days.map(tot)), top = Object.entries(week).sort((a, b) => b[1] - a[1]).slice(0, 10), tmax = Math.max(1, ...top.map(x => x[1]));
  const wd = d => new Intl.DateTimeFormat('ar-IQ', { weekday: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
  page('تقرير الاستخدام', days.length ? `
    <div class="panel"><h2>آخر ${days.length} أيام</h2><p class="sub" style="margin-top:-4px">مجموع المشاهدة بالتطبيقات · اليوم: <b>${fm(tot(days[days.length - 1]))}</b></p>
      <div style="display:flex;align-items:flex-end;gap:8px;height:140px;margin-top:10px">${days.map(d => `<div style="flex:1;text-align:center"><div style="height:${Math.max(4, Math.round(tot(d) * 110 / max))}px;background:var(--ac);border-radius:8px 8px 3px 3px"></div><small class="sub" style="font-size:11px">${wd(d)}</small></div>`).join('')}</div></div>
    <div class="panel"><h2>أكثر التطبيقات هالأسبوع</h2>${top.map(([p, ms]) => `<div style="margin:10px 0"><div class="row" style="justify-content:space-between"><b style="font-size:14px">${esc(label(p))}</b><span class="sub num">${fm(ms)}</span></div><div class="bar"><i style="width:${Math.max(3, Math.round(ms * 100 / tmax))}%;background:var(--ac)"></i></div></div>`).join('') || '<div class="sub">ماكو استخدام لحد هسه</div>'}</div>
    <p class="sub" style="font-size:12px">يحسب من يكون «واجهة مدير الشاشات» مفعّلة بإمكانية الوصول بالتلفزيون.</p>` :
    `<div class="empty">ماكو بيانات لحد هسه.<br>التقرير يبدي يتجمع من تفعّل «واجهة مدير الشاشات» بإعدادات إمكانية الوصول بالتلفزيون.<br><br><button class="btn pri" id="usA11y">${ic('tv')} افتح الإعدادات على التلفزيون</button></div>`, el => {
    const b = el.querySelector('#usA11y'); if (b) b.onclick = () => dapi('open', { what: 'a11y' }).then(() => toast('فعّل «واجهة مدير الشاشات» بالريموت')).catch(e => toast(errText(e)));
  });
}

/* ---------- 4: phone notifications on the TV ---------- */
const N_APPS = [['com.whatsapp', 'واتساب'], ['org.telegram', 'تيليگرام'], ['com.android.dialer|com.google.android.dialer|com.samsung.android.incallui|com.android.server.telecom', 'المكالمات'],
  ['com.google.android.apps.messaging|com.samsung.android.messaging|com.android.mms', 'الرسائل'], ['com.instagram.android', 'إنستغرام'], ['com.facebook.orca', 'ماسنجر'], ['com.viber.voip', 'فايبر']];
/* ---------- 5: voice search ---------- */
async function voiceToTv() {
  if (!need()) return;
  let t; try { t = await run('voice', { lang: 'ar-IQ' }); } catch (e) { if (e.message !== 'CANCEL') toast(errText(e)); return; }
  if (!t) return;
  /* the spoken words go to the screen's own Google Assistant / Google search, which runs the search or command */
  try {
    let ok = false;
    if (isDirect()) { const r = await dapi('assist', { q: t }); ok = !!(r && r.ok); }
    else {
      const q = "'" + String(t).replace(/'/g, "'\\''") + "'";
      const tries = [
        `am start -a android.search.action.GLOBAL_SEARCH --es query ${q}`,
        `am start -a android.intent.action.WEB_SEARCH --es query ${q}`,
        `am start -a android.intent.action.VOICE_COMMAND`,
      ];
      for (const c of tries) { const out = String(await sh(c) || ''); if (!/Error|unable to resolve|not started/i.test(out)) { ok = true; break; } }
    }
    if (!ok) { if (dTok(CONN.host)) await dapi('text', { text: t, submit: true }); else await run('text', { t }); }
    toast('🎤 ' + t);
  } catch (e) {
    if (isDirect() && /HTTP 404/.test(e.message)) { try { await dapi('text', { text: t, submit: true }); toast('🎤 ' + t); return; } catch (er) {} }
    toast(errText(e));
  }
}
const _renderRemote2 = renderRemote;
renderRemote = function () {
  _renderRemote2();
  if (!$('#micBtn') && $('#kbBtn')) {
    const b = document.createElement('button'); b.className = 'iconbtn'; b.id = 'micBtn'; b.setAttribute('aria-label', 'بحث بالصوت');
    b.innerHTML = '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>';
    b.onclick = () => { tap(); voiceToTv(); };
    $('#kbBtn').before(b);
  }
};
RENDER.remote = renderRemote;

/* ---------- 3: export to every screen ---------- */
async function applyToAll(cfg) {
  const list = devices().filter(d => dTok(d.host));
  if (!list.length) return toast('ماكو شاشات مربوطة على الواي فاي. اربط كل شاشة مرة وحدة من «أجهزتي»');
  busy('أجهّز التصميم…');
  let ok = 0; const fail = [];
  for (const d of list) {
    $('#busyT').textContent = 'أرسل لـ ' + d.name + '…';
    try {
      const c = deepCopy(cfg); if (!c.mode) c.mode = 'tv';
      const send = async arr => { for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].startsWith('data:')) { const r = await dapi('file?name=' + encodeURIComponent('m' + Date.now().toString(36) + i + '.jpg'), dataBytes(arr[i]), { host: d.host, bin: true, timeout: 60000 }); arr[i] = 'file://' + r.path; } };
      if (c.settings && c.settings.bgPack) await send(c.settings.bgPack);
      if (c.carcfg && c.carcfg.bgPack) await send(c.carcfg.bgPack);
      Object.values(c.layout || {}).forEach(() => {});
      for (const k of Object.keys(c.layout || {})) if (c.layout[k] && c.layout[k].bgImg && c.layout[k].bgImg.startsWith('data:')) { const a = [c.layout[k].bgImg]; await send(a); c.layout[k].bgImg = a[0]; }
      await dapi('config/set', JSON.stringify(c), { host: d.host });
      ok++;
    } catch (e) { fail.push(d.name); }
  }
  unbusy();
  toast(ok ? 'انطبق على ' + ok + ' شاشة' + (fail.length ? ' · ما وصل لـ: ' + fail.join('، ') : ' ✓') : 'ما وصل لأي شاشة. تأكد إنها شغالة');
}
const _confirmApply = confirmApply;
confirmApply = function () {
  _confirmApply();
  const yes = $('#caYes'); if (!yes) return;
  const n = devices().filter(d => dTok(d.host)).length;
  if (n > 1) {
    yes.insertAdjacentHTML('afterend', `<div style="height:8px"></div><button class="btn sec full" id="caAll">${ic('tv')} صدّر لكل شاشاتي (${n})</button>`);
    $('#caAll').onclick = () => { closeSheet(); applyToAll(D.cfg); };
  }
};

/* ---------- 6: occasion themes (a design setting) ---------- */
const _designPanel3 = designPanel;
designPanel = function () {
  const r = _designPanel3();
  if (!D || D.tab !== 'set' || (typeof isCarD === 'function' && isCarD())) return r;
  const S = D.cfg.settings, p = $('#dPanel');
  if (!p || $('#occPanel')) return r;
  p.insertAdjacentHTML('afterbegin', `<div class="panel" id="occPanel"><div class="item tap" id="occTg" style="padding:0;min-height:0"><div class="t"><b>ثيمات المناسبات التلقائية</b>
    <small>بمحرم والأربعين ورمضان والعيدين والغدير تتبدل الألوان وحدها وترجع بعدها</small></div><div class="toggle ${S.autoOccasion ? 'on' : ''}"></div></div></div>`);
  $('#occTg').onclick = () => { tap(); S.autoOccasion = !S.autoOccasion; changed(); live({ settings: S }); designPanel(); };
  return r;
};

/* ---------- 8: search the internet for backgrounds ---------- */
const NET_WORDS = { 'بحر': 'sea coast', 'ساحل': 'coast aerial', 'جبال': 'mountains', 'جبل': 'mountain', 'غروب': 'sunset', 'شروق': 'sunrise', 'مكة': 'Mecca Kaaba', 'كعبة': 'Kaaba', 'المدينة': 'Medina mosque',
  'كربلاء': 'Karbala shrine', 'النجف': 'Najaf shrine', 'مسجد': 'mosque', 'ثلج': 'snow landscape', 'غابة': 'forest', 'صحراء': 'desert dunes', 'ليل': 'night sky', 'نجوم': 'stars milky way', 'قمر': 'moon',
  'زهور': 'flowers', 'ورد': 'roses', 'شلال': 'waterfall', 'بحيرة': 'lake', 'نهر': 'river', 'مدينة': 'city skyline', 'بغداد': 'Baghdad', 'العراق': 'Iraq landscape', 'خريف': 'autumn forest', 'ربيع': 'spring meadow',
  'سماء': 'sky clouds', 'غيوم': 'clouds', 'جزيرة': 'island beach', 'شاطئ': 'beach', 'نخيل': 'palm trees', 'أهوار': 'Mesopotamian Marshes', 'سيارات': 'sports car', 'فضاء': 'nebula space', 'طيور': 'birds' };
const NET_SUGGEST = ['بحر', 'جبال', 'غروب', 'غابة', 'صحراء', 'شلال', 'ثلج', 'نجوم', 'مكة', 'كربلاء', 'أهوار', 'زهور'];
async function netSearch(q) {
  const term = q.split(/\s+/).map(w => NET_WORDS[w] || w).join(' ');
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=40&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + term) +
    '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1920';
  const j = JSON.parse(await run('fetchText', { url }));
  return Object.values((j.query || {}).pages || {}).map(p => (p.imageinfo || [])[0]).filter(i => i && /jpe?g|png/i.test(i.mime || '') && i.width >= 1400 && i.width > i.height * 1.2)
    .map(i => ({ big: i.thumburl || i.url, small: (i.thumburl || i.url).replace(/\/\d+px-/, '/480px-') }));
}
function openNetSearch() {
  let res = [], sel = [], q = '';
  const draw = () => page('دوّر بالإنترنت', `
    <div class="row" style="gap:8px"><input id="nsQ" value="${esc(q)}" placeholder="مثلاً: بحر، جبال، غروب، مكة" style="flex:1"><button class="btn pri" id="nsGo">${ic('info')} دوّر</button></div>
    <div class="chips" style="margin:10px 0">${NET_SUGGEST.map(w => `<button class="chip ${q === w ? 'on' : ''}" data-ns="${w}">${w}</button>`).join('')}</div>
    <p class="sub" style="font-size:12px">صور مجانية من ويكيميديا كومنز. اختار لحد ١٥ صورة وتصير خلفيات واجهة جديدة تعدّلها وتشوفها قبل التصدير.</p>
    <div class="tpl" id="nsG">${res.map((x, i) => `<button data-ni="${i}" style="position:relative;${sel.includes(i) ? 'outline:3px solid var(--ac);outline-offset:-3px' : ''}"><div class="sw2" style="background:#111 url('${esc(x.small)}') center/cover;height:96px"></div>${sel.includes(i) ? `<small style="padding:6px 10px">${ic('check')} ${sel.indexOf(i) + 1}</small>` : ''}</button>`).join('')}</div>
    ${sel.length ? `<div class="dock" style="position:sticky;bottom:10px;left:auto;right:auto;margin-top:12px"><button class="btn pri" id="nsMake" style="flex:1">${ic('layers')} سوّي واجهة من ${sel.length} صورة</button></div>` : ''}`, el => {
    const inp = el.querySelector('#nsQ');
    inp.onkeydown = e => { if (e.key === 'Enter') { q = inp.value.trim(); go(); } };
    el.onclick = e => {
      const s = e.target.closest('[data-ns]'); if (s) { q = s.dataset.ns; go(); return; }
      if (e.target.closest('#nsGo')) { q = inp.value.trim(); go(); return; }
      const t = e.target.closest('[data-ni]'); if (t) { const i = +t.dataset.ni, k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else if (sel.length < 15) sel.push(i); else toast('١٥ صورة كحد أعلى'); const sc = $('#pageBody').scrollTop; draw(); $('#pageBody').scrollTop = sc; return; }
      if (e.target.closest('#nsMake')) make();
    };
  });
  const go = async () => {
    if (!q) return toast('اكتب شنو تدوّر');
    busy('أدوّر على صور «' + q + '»…');
    try { res = await netSearch(q); sel = []; unbusy(); draw(); if (!res.length) toast('ما لگيت صور عريضة. جرب كلمة ثانية'); }
    catch (e) { unbusy(); toast('ما گدرت أدوّر. تأكد من الإنترنت'); }
  };
  const make = () => {
    const pack = sel.map(i => res[i].big);
    sheet(`<h2>شكل الواجهة</h2><div class="list">${[['amb', 'الساحل الهادئ (مثل الفيديو)', 'ساعة كبيرة وحديث اليوم والصلاة والمباريات'], ['classic', 'الكلاسيكي', 'كل الأقسام'], ['smart', 'الشاشة الذكية', 'شريط تطبيقات بالأسفل'], ['shelf', 'الرف الأنيق', 'تطبيقات كبيرة']]
      .map(([k, n, d]) => `<div class="item tap" data-mk="${k}"><div class="t"><b>${n}</b><small>${d}</small></div>${ic('left')}</div>`).join('')}</div>`);
    $('#sheetBody').onclick = e => {
      const b = e.target.closest('[data-mk]'); if (!b) return;
      closeSheet();
      const t = TEMPLATES.find(x => x.id === b.dataset.mk) || TEMPLATES.find(x => x.id === 'classic');
      const cfg = { v: 1, settings: Object.assign({ theme: t.theme }, deepCopy(t.s || {}), { bgPack: pack, bgInterval: 300 }), layout: deepCopy(t.layout || {}) };
      show('design'); openDesign({ name: 'واجهة ' + q, from: 'new', cfg });
      toast('شوفها بالمعاينة وعدّل، وبعدين «صدّر للشاشة»');
    };
  };
  draw();
}
const _renderGallery = renderGallery;
renderGallery = function () {
  _renderGallery();
  const body = $('#pageBody'); if (!body || $('#gNet')) return;
  body.insertAdjacentHTML('afterbegin', `<button class="btn sec full" id="gNet" style="margin-bottom:12px">${ic('info')} دوّر بالإنترنت على خلفيات وسوّي واجهة</button>`);
  $('#gNet').onclick = e => { e.stopPropagation(); tap(); openNetSearch(); };
};

/* ---------- the interface from the video, as ready templates ---------- */
const AMB_LAYOUT = { 'row-apps': { hidden: true }, 'row-occasions': { hidden: true }, 'row-tools': { hidden: true }, timeblock: { font: "'Amiri'", s: 1.12, y: 50 }, adhanbox: { y: 110 },
  wisdom: { s: 0.85, y: 110, x: -20, bgMode: 'color', bg: '0,0,0', alpha: 35 }, bigcount: { x: -10, y: 100 }, weather: { y: 60 }, 'row-matches': { y: -205, s: 0.85 } };
const ambPack = (k, n) => Array.from({ length: n }, (_, i) => GAL_URL + 'bg-amb-' + k + '-' + String(i + 1).padStart(2, '0') + '.jpg');
TEMPLATES.unshift(
  { id: 'amb', name: 'الساحل الهادئ', note: 'مثل الفيديو: ساعة كبيرة وحديث وصلاة ومباريات', theme: 'appletv', s: { religious: false, bgPack: ambPack('coast', 10), saverStyle: 'photos' }, layout: AMB_LAYOUT },
  { id: 'ambsun', name: 'غروب الجبال', note: 'نفس الترتيب بسماء غروب', theme: 'royal', s: { religious: false, bgPack: ambPack('sunset', 10) }, layout: AMB_LAYOUT },
  { id: 'ambapps', name: 'الساحل مع التطبيقات', note: 'نفس الشكل وصف التطبيقات تحت', theme: 'appletv', s: { religious: false, bgPack: ambPack('coast', 10) }, layout: Object.assign({}, AMB_LAYOUT, { 'row-apps': { view: 'names', y: 175, s: 0.85 }, 'row-matches': { hidden: true } }) });

/* ---------- menu entries ---------- */
const _renderMore = renderMore;
renderMore = function () {
  _renderMore();
  const first = document.querySelector('#moreBody [data-m="apps"]'); if (!first || $('#mDev')) return;
  first.insertAdjacentHTML('beforebegin', `
    <div class="item tap" id="mDev" data-m="dev">${ic('sun')}<div class="t"><b>إعدادات الشاشة</b><small>جدول التشغيل والإطفاء، وقت الأطفال، قفل التطبيقات</small></div>${ic('left')}</div>
    <div class="item tap" data-m="usage">${ic('chart')}<div class="t"><b>تقرير الاستخدام</b><small>شنو انشاف أكثر وكم ساعة بالأسبوع</small></div>${ic('left')}</div>
    <div class="item tap" data-m="voice"><svg class="i" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg><div class="t"><b>بحث بالصوت</b><small>احجي بالموبايل وينكتب على الشاشة</small></div>${ic('left')}</div>`);
  const body = $('#moreBody'), old = body.onclick;
  body.onclick = e => {
    const m = e.target.closest('[data-m]');
    if (m && ['dev', 'usage', 'voice'].includes(m.dataset.m)) { tap(); ({ dev: openDevSettings, usage: openUsage, voice: voiceToTv })[m.dataset.m](); return; }
    old && old(e);
  };
};
RENDER.more = renderMore;
