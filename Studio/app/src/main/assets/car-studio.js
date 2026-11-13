'use strict';
/* ============================================================ device type (TV / box / car) */
const DEV_TYPES = [['tv', 'شاشة تلفزيون'], ['box', 'بوكس أو ستيك'], ['car', 'شاشة سيارة']];
function devType() {
  const k = kv('devType_' + (CONN.host || 'none'), null); if (k) return k === 'sat' ? 'box' : k;
  const d = devices().find(x => x.host === CONN.host);
  if (d && d.type) return d.type === 'sat' ? 'box' : d.type;
  if (INFO && INFO.isCar) return 'car';
  return INFO && INFO.isTv ? 'tv' : 'box';
}
const devTypeName = () => (DEV_TYPES.find(x => x[0] === devType()) || DEV_TYPES[1])[1];
function setDevType(t) {
  const l = devices(), d = l.find(x => x.host === CONN.host);
  if (d) { d.type = t; kvSet('devices', l); }
  kvSet('devType_' + (CONN.host || 'none'), t);
  RENDER[cur] && RENDER[cur]();
}
function devRec() { return devices().find(x => x.host === CONN.host); }
function devBrand() { const b = kv('carBrand_' + (CONN.host || 'none'), null); return b ? deepCopy(b) : null; }
function saveDevBrand(br) { kvSet('carBrand_' + (CONN.host || 'none'), br); }
function brandSheet(done) {
  sheet(`<h2>شنو نوع سيارتك؟</h2><p class="sub">اسم الشركة يبقى ثابت فوق بواجهة السيارة وبشاشة التوقف. إذا عندك صورة لشعار سيارتك تگدر تختارها من موبايلك بعدين.</p>
    <div class="chips">${CAR_BRANDS.map(([k, n]) => `<button class="chip" data-br="${k}">${esc(n)}</button>`).join('')}</div>
    <div id="brOtherW" style="display:none"><label class="f" style="margin-top:14px">اسم الشركة</label><input id="brOther" maxlength="20" placeholder="مثلاً: BYD"></div>
    <label class="f" style="margin-top:14px">الموديل (اختياري)</label><input id="brModel" placeholder="مثلاً: كامري ٢٠٢٢" maxlength="24">
    <button class="btn ghost full" id="brSkip" style="margin-top:10px">بعدين</button>`);
  let pick = null;
  $('#sheetBody').onclick = e => {
    if (e.target.closest('#brSkip')) { closeSheet(); done && done(null); return; }
    const b = e.target.closest('[data-br]'); if (!b) return;
    tap(); pick = CAR_BRANDS.find(x => x[0] === b.dataset.br);
    if (pick[0] === 'other') {
      const n = ($('#brOther').value || '').trim();
      if (!n) { $('#brOtherW').style.display = ''; $('#brOther').focus(); return toast('اكتب اسم الشركة وبعدين اضغط «شركة ثانية» مرة ثانية'); }
      pick = ['other', n, /[A-Za-z]/.test(n) ? n : '', '#64748b'];
    }
    const model = ($('#brModel').value || '').trim();
    const br = { id: pick[0], name: pick[1], en: pick[2], color: pick[3], model };
    const old = devBrand(); if (old && old.id === br.id && old.logo) br.logo = old.logo;
    saveDevBrand(br); closeSheet(); toast('انحفظت: ' + br.name + (model ? ' ' + model : ''));
    done && done(br);
  };
}
function devTypeSheet() {
  sheet(`<h2>نوع الجهاز</h2><p class="sub">التطبيق يعرفه وحده، بس إذا غلط اختار الصحيح. الواجهات والاختصارات تتغير حسب النوع.</p>
    <div class="list">${DEV_TYPES.map(([k, n]) => `<div class="item tap" data-t="${k}"><div class="t"><b>${n}</b></div>${devType() === k ? '<span class="tag">المختار</span>' : ''}</div>`).join('')}</div>
    <button class="btn ghost full" id="dtCar">${ic('info')} شلون أربط شاشة السيارة؟</button>`);
  $('#sheetBody').onclick = e => {
    if (e.target.closest('#dtCar')) { closeSheet(); howToCar(); return; }
    const b = e.target.closest('[data-t]'); if (!b) return; closeSheet(); setDevType(b.dataset.t);
    if (b.dataset.t === 'car') brandSheet(() => toast('صارت شاشة سيارة. روح «الواجهة» حتى تختار أو تصمم واجهة سيارة'));
  };
}
function howToCar() {
  page('ربط شاشة السيارة', `
  <div class="panel"><h2>شنو الشاشات اللي تنفع؟</h2>
  <p class="sub" style="margin:0">الشاشات الصينية اللي بيها أندرويد (اللي تنركّب بدل المسجّل). الشاشات الأصلية من شركة السيارة، وCarPlay وAndroid Auto نفسهم، مقفولين وما ينفعون.</p></div>
  <div class="panel"><h2>١. شغّل خيارات المطوّر</h2>
  <ol class="sub" style="padding-inline-start:20px;margin:0;line-height:1.9">
    <li>بالشاشة: الإعدادات ← حول الجهاز (أو معلومات النظام).</li>
    <li>اضغط على «رقم الإصدار» أو «Build number» ٧ مرات لحد ما يگلك صرت مطوّر.</li>
    <li>بعض الشاشات تطلب رمز «إعدادات المصنع». الرموز الشائعة: ٣٣٦٨، ٨٨٨٨، ١٦١٧، ١٢٣٤. إذا ما مشى، الرمز مكتوب بدليل الشاشة.</li></ol></div>
  <div class="panel"><h2>٢. شغّل تصحيح الأخطاء</h2>
  <ol class="sub" style="padding-inline-start:20px;margin:0;line-height:1.9">
    <li>الإعدادات ← خيارات المطوّر ← فعّل «تصحيح أخطاء USB».</li>
    <li>إذا أندرويد ١١ أو أحدث: فعّل «تصحيح الأخطاء اللاسلكي» واضغط «ربط جهاز برمز إقران».</li>
    <li>إذا أقدم: دوّر على «ADB عبر الشبكة» وفعّله. إذا ما موجود، وصّل الشاشة مرة وحدة بالحاسبة وشغّل ملف الاتصال بالحاسبة.</li></ol></div>
  <div class="panel"><h2>٣. نفس الشبكة</h2>
  <ol class="sub" style="padding-inline-start:20px;margin:0;line-height:1.9">
    <li>شغّل نقطة الاتصال (الهوتسبوت) بموبايلك.</li>
    <li>وصّل شاشة السيارة على الهوتسبوت من إعدادات الواي فاي بالشاشة.</li>
    <li>ارجع للتطبيق ← «أجهزتي» ← الشاشة تطلع وحدها، أو اضغط + واكتب الـ IP اللي يطلع بتفاصيل الواي فاي بالشاشة والمنفذ (5555 للقديمة).</li></ol></div>
  <div class="panel"><h2>٤. بعد الاتصال</h2>
  <ol class="sub" style="padding-inline-start:20px;margin:0;line-height:1.9">
    <li>تأكد إن نوع الجهاز «شاشة سيارة» (يطلع على كارت الشاشة).</li>
    <li>روح «الواجهة» واختار واجهة سيارة من المعرض أو صمّم وحدة.</li>
    <li>اضغط «طبّق على الشاشة». التطبيق يعطي الواجهة صلاحية الموقع (للسرعة) وصلاحية الإشعارات (لمعلومات الأغنية) وحده.</li></ol></div>`);
}

/* ============================================================ car designs */
const CAR_THEMES = [['signature', 'توقيع مدير الشاشة', '#0B0C10', '#D6B47A'], ['sport', 'السبورت الأحمر', '#0b0b0e', '#ff3b3b'], ['carbon', 'الكاربون', '#0e1013', '#2ee6d6'], ['neon', 'النيون', '#07051a', '#8b5cff'],
  ['luxury', 'الفخامة الذهبية', '#070605', '#d4a64a'], ['ocean', 'المحيط', '#03101c', '#22c3ee'], ['forest', 'الغابة', '#04110b', '#34d399'], ['white', 'الأبيض النظيف', '#eef1f6', '#2563eb'],
  ['teal', 'الفيروزي', '#03090f', '#19d3c5'], ['redline', 'الأحمر الرياضي', '#050505', '#ff1f3d'], ['frost', 'الزجاج الأبيض', '#e6ebf1', '#3b82f6'], ['leather', 'الجلد الأحمر', '#140d0b', '#e0242f'],
  ['aurora', 'الشفق النيون', '#07051f', '#22d3ee'], ['sage', 'الكريمي الأخضر', '#efede4', '#5f8f5a'], ['violet', 'البنفسجي', '#1c0a33', '#c084fc'], ['blush', 'الوردي', '#3a1d3f', '#ffb4c6'], ['graphite', 'الرمادي الداكن', '#121317', '#8b5cf6']];
const CAR_WIDGETS = [['speed', 'عدّاد السرعة'], ['media', 'الموسيقى'], ['clock', 'الساعة'], ['analog', 'ساعة عقارب'], ['date', 'التاريخ'], ['weather', 'الطقس'],
  ['call', 'الاتصال'], ['compass', 'الاتجاه'], ['trip', 'الرحلة والعداد'], ['park', 'وين وگفت سيارتي'], ['dial', 'اتصال سريع'], ['maint', 'الصيانة'], ['prayer', 'الصلاة الجاية'], ['altitude', 'الارتفاع'], ['map', 'الخريطة المباشرة']];
const CAR_DOCK = [['home', 'الرئيسية'], ['maps', 'الخرائط'], ['music', 'الموسيقى'], ['phone', 'الاتصال'], ['mirror', 'ربط الموبايل'], ['radio', 'الراديو'],
  ['camera', 'الكاميرا'], ['apps', 'التطبيقات'], ['trips', 'رحلاتي'], ['park', 'سيارتي'], ['settings', 'الإعدادات']];
const CAR_LAYOUTS = [['carplay', 'مثل CarPlay', 'شريط جانبي وأيقونات كبيرة'], ['mbux', 'مثل مرسيدس MBUX', 'بطاقات عريضة فوق وصف تطبيقات وشريط عائم'],
  ['classic', 'الكلاسيكي', 'ويدجتات جنب التطبيقات'], ['atv', 'مثل Apple TV', 'لوحات زجاجية وتطبيقات كبيرة'], ['cockpit', 'قمرة القيادة', 'عدّاد كبير وويدجتات صغيرة'],
  ['gauge', 'العدّاد بالنص', 'عدّاد كبير بالوسط وبطاقتين كل جهة'], ['hero', 'الخريطة والعدّاد', 'خريطة وموسيقى وعدّاد دائري وتطبيقات'], ['trio', 'الثلاث بطاقات', 'ثلاث بطاقات طويلة وصف تطبيقات'],
  ['split', 'الشاشة المقسومة', 'نصين كبار: خريطة وموسيقى'], ['cards', 'البطاقات', 'ساعة كبيرة فوق الخلفية وصف بطاقات']];
const W_STYLES = {
  speed: [['ring', 'دائري مضيء'], ['arc', 'قوس رياضي'], ['needle', 'عقرب كلاسيكي'], ['dots', 'نقاط'], ['bar', 'شريط'], ['digital', 'رقم كبير']],
  clock: [['big', 'كبير'], ['thin', 'رفيع'], ['stack', 'فوق بعض'], ['seg', 'رقمي مضيء']],
  media: [['card', 'عادي'], ['cover', 'خلفية الألبوم'], ['compact', 'مختصر']]
};
const DOCK_POS = [['تحت', 'bottom'], ['يمين', 'right'], ['يسار', 'left'], ['فوق', 'top']];
const carDockPos = C => C.dockPos || ((C.layout || 'carplay') === 'carplay' ? (C.side === 'left' ? 'left' : 'right') : 'bottom');
const W_BG = [['auto', 'حسب الواجهة'], ['glass', 'زجاج'], ['solid', 'صلب'], ['clear', 'شفاف'], ['accent', 'ملوّن'], ['gradient', 'تدرّج']];
const COLORS = [[null, 'لون الثيم'], ['#ff3b3b', 'أحمر'], ['#2563eb', 'أزرق'], ['#00b5ff', 'سماوي'], ['#16a34a', 'أخضر'], ['#d4a64a', 'ذهبي'], ['#a855f7', 'بنفسجي'], ['#f97316', 'برتقالي'], ['#ec4899', 'وردي'], ['#ffffff', 'أبيض']];
const ICON_STYLES = [['squircle', 'مربع ناعم (CarPlay)'], ['circle', 'دائري'], ['square', 'مربع حاد'], ['glass', 'زجاجي'], ['neon', 'نيون'], ['white', 'أبيض'], ['mono', 'رمادي'], ['outline', 'خطوط'], ['flat', 'بدون إطار']];
const CAR_BRANDS = [['toyota', 'تويوتا', 'Toyota', '#eb0a1e'], ['hyundai', 'هيونداي', 'Hyundai', '#002c5f'], ['kia', 'كيا', 'Kia', '#bb162b'], ['nissan', 'نيسان', 'Nissan', '#c3002f'],
  ['mitsubishi', 'ميتسوبيشي', 'Mitsubishi', '#e60012'], ['chevrolet', 'شيفروليه', 'Chevrolet', '#d1a33c'], ['ford', 'فورد', 'Ford', '#1f4e9c'], ['honda', 'هوندا', 'Honda', '#cc0000'],
  ['lexus', 'لكزس', 'Lexus', '#6b7280'], ['mercedes', 'مرسيدس', 'Mercedes-Benz', '#9aa0a6'], ['bmw', 'بي إم دبليو', 'BMW', '#1c69d4'], ['gmc', 'جي إم سي', 'GMC', '#c8102e'],
  ['landrover', 'لاند روفر', 'Land Rover', '#1f6f43'], ['jeep', 'جيب', 'Jeep', '#4b5d34'], ['dodge', 'دودج', 'Dodge', '#c8102e'], ['volkswagen', 'فولكس واگن', 'Volkswagen', '#1e40af'],
  ['audi', 'أودي', 'Audi', '#bb0a30'], ['mazda', 'مازدا', 'Mazda', '#910a2d'], ['peugeot', 'بيجو', 'Peugeot', '#334155'], ['renault', 'رينو', 'Renault', '#e5b100'],
  ['changan', 'شانگان', 'Changan', '#0a3d91'], ['chery', 'شيري', 'Chery', '#c8102e'], ['geely', 'جيلي', 'Geely', '#1b4b9b'], ['mg', 'إم جي', 'MG', '#a6192e'],
  ['haval', 'هافال', 'Haval', '#b7282e'], ['jetour', 'جيتور', 'Jetour', '#0f766e'], ['isuzu', 'إيسوزو', 'Isuzu', '#cc0000'], ['suzuki', 'سوزوكي', 'Suzuki', '#e30613'],
  ['other', 'شركة ثانية', '', '#64748b']];
/* Full interfaces in the spirit of each maker's screen: colors, layout, gauge, icons, cards and bar.
   Names are text only; a logo comes only from the user's own photo. */
const BRAND_UI = [
  { id: 'mercedes', note: 'بطاقات عريضة، إضاءة سماوي وبنفسجي، عدّاد دائري مضيء', sw: ['#03040a', '#00b5ff'],
    c: { bt: 'mercedes', dockPos: 'bottom', layout: 'mbux', icons: 'glass', cards: 'glass', dockStyle: 'bar', rad: 2.2, widgets: [{ t: 'speed', style: 'ring' }, { t: 'media', style: 'cover' }, { t: 'clock', style: 'thin' }, { t: 'weather' }] } },
  { id: 'bmw', note: 'أزرق BMW، بطاقات حادة، عدّاد قوس', sw: ['#040507', '#1c69d4'],
    c: { bt: 'bmw', dockPos: 'bottom', layout: 'atv', icons: 'square', cards: 'solid', dockStyle: 'line', rad: 1.4, widgets: [{ t: 'speed', style: 'arc' }, { t: 'media', l: true }, { t: 'trip' }] } },
  { id: 'audi', note: 'أسود وأحمر، شبكة خفيفة، عدّاد عقرب مثل الكوكبت الرقمي', sw: ['#020202', '#f50537'],
    c: { bt: 'audi', dockPos: 'top', layout: 'cockpit', icons: 'outline', cards: 'outline', dockStyle: 'line', rad: .6, widgets: [{ t: 'speed', style: 'needle' }, { t: 'media', style: 'compact' }, { t: 'clock', style: 'seg' }, { t: 'trip' }, { t: 'weather' }] } },
  { id: 'toyota', note: 'رمادي غامق وأحمر تويوتا، ترتيب واضح', sw: ['#08090b', '#eb0a1e'],
    c: { bt: 'toyota', dockPos: 'bottom', layout: 'classic', icons: 'squircle', cards: 'solid', dockStyle: 'bar', rad: 2.6, widgets: [{ t: 'speed', l: true, style: 'arc' }, { t: 'clock' }, { t: 'weather' }, { t: 'media', l: true }] } },
  { id: 'lexus', note: 'أسود وذهبي فاخر، خطوط ناعمة', sw: ['#050505', '#c9a96e'],
    c: { bt: 'lexus', dockPos: 'bottom', layout: 'atv', icons: 'glass', cards: 'glass', dockStyle: 'line', rad: 1.6, widgets: [{ t: 'clock', style: 'thin' }, { t: 'speed', style: 'dots' }, { t: 'media', l: true }] } },
  { id: 'hyundai', note: 'كحلي وسماوي، شريط جانبي', sw: ['#020a16', '#00aad2'],
    c: { bt: 'hyundai', dockPos: 'left', layout: 'carplay', icons: 'circle', cards: 'glass', dockStyle: 'bar', rad: 2, widgets: [{ t: 'speed', style: 'ring' }, { t: 'media' }, { t: 'weather' }] } },
  { id: 'kia', note: 'أسود وأبيض بسيط، خطوط رفيعة', sw: ['#05141f', '#ffffff'],
    c: { bt: 'kia', dockPos: 'top', layout: 'classic', wlayout: 'top', icons: 'mono', cards: 'outline', dockStyle: 'icons', rad: 1, widgets: [{ t: 'speed', style: 'bar' }, { t: 'clock', style: 'thin' }, { t: 'media' }, { t: 'weather' }] } },
  { id: 'nissan', note: 'أحمر نيسان، عدّاد عقرب كبير', sw: ['#060607', '#c3002f'],
    c: { bt: 'nissan', dockPos: 'bottom', layout: 'cockpit', icons: 'circle', cards: 'solid', dockStyle: 'bar', rad: 2, widgets: [{ t: 'speed', style: 'needle' }, { t: 'media', style: 'compact' }, { t: 'clock' }, { t: 'compass' }, { t: 'trip' }] } },
  { id: 'honda', note: 'أزرق هوندا، رقم سرعة كبير', sw: ['#04060a', '#2f8cff'],
    c: { bt: 'honda', dockPos: 'right', layout: 'carplay', icons: 'squircle', cards: 'solid', dockStyle: 'bar', rad: 2.4, widgets: [{ t: 'speed', style: 'digital' }, { t: 'media' }, { t: 'clock' }] } },
  { id: 'chevrolet', note: 'ذهبي شيفروليه وأسود', sw: ['#050607', '#d1a33c'],
    c: { bt: 'chevrolet', dockPos: 'bottom', layout: 'classic', icons: 'square', cards: 'solid', dockStyle: 'bar', rad: 1.8, widgets: [{ t: 'speed', l: true, style: 'arc' }, { t: 'clock' }, { t: 'trip' }, { t: 'media', l: true }] } },
  { id: 'ford', note: 'أزرق فورد مثل SYNC', sw: ['#03060c', '#2a6bd1'],
    c: { bt: 'ford', dockPos: 'left', layout: 'carplay', icons: 'squircle', cards: 'glass', dockStyle: 'bar', rad: 2.2, widgets: [{ t: 'speed', style: 'ring' }, { t: 'media', style: 'cover' }, { t: 'weather' }] } },
  { id: 'landrover', note: 'أخضر هادئ ورمادي، فخم وبسيط', sw: ['#050706', '#64a87c'],
    c: { bt: 'landrover', dockPos: 'bottom', layout: 'mbux', icons: 'outline', cards: 'glass', dockStyle: 'line', rad: 1.2, widgets: [{ t: 'speed', style: 'needle' }, { t: 'media' }, { t: 'compass' }, { t: 'weather' }] } }
];
const CAR_DEF = () => ({ theme: 'signature', bt: '', side: 'right', wlayout: 'split', cols: 4, owner: 'مدير الشاشات', night: 'auto', layout: 'carplay',
  icons: 'squircle', isize: 'm', labels: 'on', tilebg: 'off', cards: 'glass', cop: 8, rad: 3, fs: 100, dockStyle: 'bar', apphd: 'on',
  widgets: [{ t: 'speed', l: true, style: 'ring' }, { t: 'media', l: true }], apps: [], dock: ['home', 'maps', 'music', 'phone', 'mirror', 'apps'],
  volBtns: true, volPos: 'left', brand: devBrand(), alert: { on: true, city: 60, hw: 120, sound: true }, drive: { on: true, kmh: 20 }, maint: [], dial: [],
  saver: { on: true, min: 5, speed: true, music: true, overApps: true }, bgPack: [], bgDim: 45 });
const CAR_TEMPLATES = [
  { id: 'signature', name: 'توقيع مدير الشاشة', note: 'أسود عميق وذهبي شمباني', c: { theme: 'signature', layout: 'carplay', icons: 'glass', widgets: [{ t: 'speed', style: 'ring', c: '#D6B47A' }, { t: 'media', style: 'cover' }, { t: 'clock', style: 'thin' }] } },
  { id: 'carplay', name: 'مثل CarPlay', note: 'شريط جانبي وأيقونات كبيرة', c: { theme: 'ocean', layout: 'carplay' } },
  { id: 'mbux', name: 'مثل MBUX', note: 'بطاقات عريضة وإضاءة', c: { theme: 'neon', layout: 'mbux', icons: 'glass', widgets: [{ t: 'speed', style: 'ring' }, { t: 'media', style: 'cover' }, { t: 'clock', style: 'thin' }] } },
  { id: 'sport', name: 'السبورت الأحمر', note: 'عدّاد كبير وساعة وموسيقى', c: { theme: 'sport', layout: 'classic', widgets: [{ t: 'speed', l: true, style: 'arc' }, { t: 'clock' }, { t: 'weather' }, { t: 'media', l: true }] } },
  { id: 'luxury', name: 'الفخامة الذهبية', note: 'أسود وذهبي', c: { theme: 'luxury', layout: 'atv', icons: 'glass', widgets: [{ t: 'speed', style: 'dots' }, { t: 'clock', style: 'thin' }, { t: 'media', l: true }] } },
  { id: 'white', name: 'الأبيض النظيف', note: 'فاتح للنهار', c: { theme: 'white', layout: 'classic', night: 'off', icons: 'squircle', cards: 'solid', widgets: [{ t: 'speed', l: true }, { t: 'media', l: true }] } },
  { id: 'cockpit', name: 'قمرة القيادة', note: 'عدّاد سرعة عملاق', c: { theme: 'sport', layout: 'cockpit', widgets: [{ t: 'speed', style: 'needle' }, { t: 'media', style: 'compact' }, { t: 'compass' }, { t: 'trip' }, { t: 'clock' }] } },
  { id: 'apps', name: 'التطبيقات بس', note: 'بدون ويدجتات، تطبيقات كبيرة', c: { theme: 'ocean', layout: 'classic', wlayout: 'none', cols: 5, isize: 'l' } }
];
/* designs made from the user's pictures */
const CAR_PIC = [
  { id: 'p_gauge', name: 'العدّاد الفيروزي', note: 'عدّاد بالنص وبطاقات على الجهتين', c: { theme: 'teal', layout: 'gauge', icons: 'glass', cards: 'glass', widgets: [{ t: 'speed', style: 'ring' }, { t: 'trip' }, { t: 'altitude' }, { t: 'weather' }, { t: 'media', style: 'compact' }], dock: ['maps', 'phone', 'music', 'apps', 'settings'] } },
  { id: 'p_neon', name: 'النيون الأزرق', note: 'عدّاد عقرب أزرق وموسيقى', c: { theme: 'teal', layout: 'gauge', icons: 'outline', cards: 'outline', widgets: [{ t: 'speed', style: 'needle', c: '#22c3ee' }, { t: 'clock', style: 'thin' }, { t: 'compass' }, { t: 'media', style: 'compact' }, { t: 'weather' }], dock: ['maps', 'phone', 'music', 'apps', 'settings'] } },
  { id: 'p_redline', name: 'صُنع للسرعة', note: 'أحمر وأسود رياضي بعدّاد قوس', c: { theme: 'redline', layout: 'gauge', icons: 'square', cards: 'solid', rad: 1, widgets: [{ t: 'speed', style: 'arc' }, { t: 'media', style: 'compact' }, { t: 'trip' }, { t: 'compass' }, { t: 'clock', style: 'seg' }], dock: ['maps', 'music', 'phone', 'apps', 'settings'] } },
  { id: 'p_frost', name: 'الزجاج الأبيض', note: 'فاتح وناعم مثل الزجاج', c: { theme: 'frost', night: 'off', layout: 'gauge', icons: 'white', cards: 'glass', widgets: [{ t: 'speed', style: 'needle' }, { t: 'clock', style: 'thin' }, { t: 'weather' }, { t: 'media', style: 'compact' }, { t: 'trip' }], dock: ['maps', 'music', 'phone', 'apps', 'settings'] } },
  { id: 'p_frosthero', name: 'الأبيض الحديث', note: 'خريطة وموسيقى ورقم سرعة دائري', c: { theme: 'frost', night: 'off', layout: 'hero', icons: 'white', cards: 'glass', widgets: [{ t: 'map' }, { t: 'media' }, { t: 'speed', style: 'ring' }] } },
  { id: 'p_leather', name: 'الجلد الأحمر', note: 'داكن فخم بخطوط حمراء', c: { theme: 'leather', layout: 'hero', icons: 'circle', cards: 'solid', widgets: [{ t: 'map' }, { t: 'media', style: 'cover' }, { t: 'speed', style: 'needle', c: '#e0242f' }] } },
  { id: 'p_aurora', name: 'الشفق النيون', note: 'بنفسجي وفيروزي ورقم سرعة عملاق', c: { theme: 'aurora', layout: 'hero', icons: 'neon', cards: 'glass', widgets: [{ t: 'map' }, { t: 'media', style: 'cover' }, { t: 'speed', style: 'digital' }] } },
  { id: 'p_sage', name: 'الكريمي الهادئ', note: 'كريمي وأخضر بسيط', c: { theme: 'sage', night: 'off', layout: 'hero', icons: 'squircle', cards: 'solid', widgets: [{ t: 'map' }, { t: 'media' }, { t: 'speed', style: 'digital' }] } },
  { id: 'p_tealdash', name: 'لوحة القيادة الفيروزية', note: 'عدّاد وخريطة وموسيقى وشريط سفلي', c: { theme: 'teal', layout: 'hero', icons: 'glass', cards: 'glass', widgets: [{ t: 'map' }, { t: 'media' }, { t: 'speed', style: 'ring' }] } },
  { id: 'p_trio', name: 'الداكن الثلاثي', note: 'ثلاث بطاقات: السرعة والخريطة والموسيقى', c: { theme: 'graphite', layout: 'trio', icons: 'circle', cards: 'solid', widgets: [{ t: 'speed', style: 'digital' }, { t: 'map' }, { t: 'media' }] } },
  { id: 'p_split', name: 'الشاشة المقسومة', note: 'خريطة ونص موسيقى بخلفية بنفسجية', c: { theme: 'violet', layout: 'split', icons: 'squircle', cards: 'glass', widgets: [{ t: 'map' }, { t: 'media', style: 'cover' }] } },
  { id: 'p_cards', name: 'البطاقات الوردية', note: 'ساعة كبيرة فوق وبطاقات تحت', c: { theme: 'blush', layout: 'cards', icons: 'circle', cards: 'solid', widgets: [{ t: 'clock', style: 'big', l: true }, { t: 'weather' }, { t: 'media' }, { t: 'dial' }, { t: 'trip' }] } }
];
function brandOf(id) { const b = CAR_BRANDS.find(x => x[0] === id); return b ? { id: b[0], name: b[1], en: b[2], color: b[3] } : null; }
function brandCfg(u) {
  const br = brandOf(u.id), old = devBrand();
  if (old && old.id === u.id) Object.assign(br, { logo: old.logo, model: old.model });
  return Object.assign(CAR_DEF(), deepCopy(u.c), { brand: br });
}
function brandCards(cur) {
  return `<div class="tpl">${BRAND_UI.map(u => { const br = brandOf(u.id);
    return `<button data-bui="${u.id}" style="${cur === u.id ? 'outline:3px solid var(--ac);outline-offset:-3px' : ''}"><div class="sw2" style="background:linear-gradient(135deg,${u.sw[0]} 40%,${u.sw[1]}55);display:flex;align-items:center;justify-content:center"><span style="color:#fff;font-weight:800;letter-spacing:.18em;font-size:13px;direction:ltr">${esc(br.en.toUpperCase())}</span></div><b>واجهة ${esc(br.name)}</b><small>${esc(u.note)}</small></button>`; }).join('')}</div>`;
}
/* ready-made screens drawn after the user's pictures (the car page draws them: cfg.scene) */
const CAR_SCENES = [['teal', 'التيل الليلي', '#090b0d', '#22c3c9'], ['sage', 'المريمية الفاتحة', '#efebe2', '#6f8f63'], ['glass', 'الأبيض الأزرق', '#eef2f6', '#4aa3df'], ['redline', 'الأحمر الرياضي', '#0b0b0c', '#e3202c'],
  ['neon', 'النيون', '#05061a', '#29e0d5'], ['silver', 'الفضي', '#dfe4ea', '#4f84b8'], ['speed', 'مصمّمة للسرعة', '#0c0c0d', '#e11b22'], ['violet', 'البنفسجي الزجاجي', '#0d0b24', '#a855f7'],
  ['vintage', 'الكلاسيكي العتيق', '#e8dcbc', '#1f3d2c'], ['cyan', 'العدّاد السماوي', '#06090c', '#19c6e6'], ['arabic', 'العربي', '#070b0e', '#2fe0d0'], ['auto', 'مثل أندرويد أوتو', '#d97a8b', '#e98d35'],
  ['split', 'خريطة وموسيقى', '#1a1a22', '#8b5cf6'], ['mine', 'لوحة سيارتي', '#17191e', '#8b5cf6']];
const sceneCards = cur => `<div class="tpl">${CAR_SCENES.map(([id, n, a, b]) => `<button data-csc="${id}" style="${cur === id ? 'outline:3px solid var(--ac);outline-offset:-3px' : ''}"><div class="sw2" style="background:linear-gradient(135deg,${a} 55%,${b})"><i style="background:${b}"></i><i></i></div><b>${esc(n)}</b><small>${cur === id ? 'المختار' : 'نفس الصورة'}</small></button>`).join('')}</div>`;
function carNew() {
  if (CONN.connected && !devBrand() && !carNew.asked) { carNew.asked = true; return brandSheet(() => carNew()); }
  sheet(`<h2>واجهة سيارة جديدة</h2><p class="sub">اختار واجهة شركة أو قالب، وبعدين غيّر أي شي: الويدجتات والعدّاد والأيقونات والألوان.</p>
    <h2 style="font-size:15px">واجهات الشركات</h2>${brandCards('')}
    <h2 style="font-size:15px;margin-top:16px">تصاميم من صورك</h2>${sceneCards('')}
    <h2 style="font-size:15px;margin-top:16px">واجهات حديثة</h2>
    <div class="tpl">${CAR_PIC.map(t => { const th = CAR_THEMES.find(x => x[0] === t.c.theme) || CAR_THEMES[0];
      return `<button data-cp="${t.id}"><div class="sw2" style="background:linear-gradient(135deg,${th[2]},${th[3]}88)"><i style="background:${th[3]}"></i><i></i></div><b>${esc(t.name)}</b><small>${esc(t.note)}</small></button>`; }).join('')}</div>
    <h2 style="font-size:15px;margin-top:16px">قوالب عامة</h2>
    <div class="tpl">${CAR_TEMPLATES.map(t => { const th = CAR_THEMES.find(x => x[0] === t.c.theme) || CAR_THEMES[0];
      return `<button data-ct="${t.id}"><div class="sw2" style="background:linear-gradient(135deg,${th[2]},${th[3]}66)"><i style="background:${th[3]}"></i><i></i></div><b>${esc(t.name)}</b><small>${esc(t.note)}</small></button>`; }).join('')}</div>`);
  $('#sheetBody').onclick = e => {
    const u = e.target.closest('[data-bui]');
    if (u) { const x = BRAND_UI.find(v => v.id === u.dataset.bui); closeSheet(); show('design'); openDesign({ name: 'واجهة ' + brandOf(x.id).name, from: 'new', cfg: { v: 1, mode: 'car', carcfg: brandCfg(x) } }); return; }
    const sc = e.target.closest('[data-csc]');
    if (sc) { const x = CAR_SCENES.find(v => v[0] === sc.dataset.csc); closeSheet(); show('design'); openDesign({ name: 'سيارة ' + x[1], from: 'new', cfg: { v: 1, mode: 'car', carcfg: Object.assign(CAR_DEF(), { scene: x[0] }) } }); return; }
    const cp = e.target.closest('[data-cp]');
    if (cp) { const t = CAR_PIC.find(x => x.id === cp.dataset.cp); closeSheet(); show('design'); openDesign({ name: 'سيارة ' + t.name, from: 'new', cfg: { v: 1, mode: 'car', carcfg: Object.assign(CAR_DEF(), deepCopy(t.c), { tpl: t.id }) } }); return; }
    const b = e.target.closest('[data-ct]'); if (!b) return;
    const t = CAR_TEMPLATES.find(x => x.id === b.dataset.ct); closeSheet();
    show('design'); openDesign({ name: 'سيارة ' + t.name, from: 'new', cfg: { v: 1, mode: 'car', carcfg: Object.assign(CAR_DEF(), deepCopy(t.c), { tpl: t.id }) } });
  };
}

/* ---------- editor ---------- */
const isCarD = () => D && (D.cfg.mode === 'car' || D.kind === 'car');
function CC() { if (!D.cfg.carcfg) D.cfg.carcfg = CAR_DEF(); return D.cfg.carcfg; }
function carLive() {
  /* the car page redraws itself from the design, so no reload (no flicker, no lost taps) */
  const c = deepCopy(CC());
  try { if (window.__PREVIEW_DATA && window.__PREVIEW_DATA.cfg) window.__PREVIEW_DATA.cfg.carcfg = deepCopy(c); } catch (e) {}
  pvDirect({ carcfg: c });
  if (D && D.sel) setTimeout(() => pvDirect({ select: D.sel }), 60);
}
function pvDirect(o) { try { const w = frameWin(); if (w && w.__live) w.__live(o); } catch (e) {} }
async function carPreviewApps() {
  if (!CONN.connected) return null;
  try { const l = await tvAppList(); return l && l.length ? l : null; } catch (e) { return null; }
}
let carAppsCache = null, carLogCache = null;
let carPvGen = 0;
async function carLoadPreview(frame) {
  /* never wait on the device here: a slow or stale connection used to hold the old page (and an old template) on screen */
  const gen = ++carPvGen;
  if (!carAppsCache && CONN.connected && !carLoadPreview.busy) {
    carLoadPreview.busy = true;
    Promise.race([carPreviewApps(), new Promise(r => setTimeout(() => r(null), 4000))]).then(l => {
      carLoadPreview.busy = false;
      if (l && !carAppsCache) { carAppsCache = l; if (gen === carPvGen && isCarD()) { const f = $('#pvf'); if (f) carLoadPreview(f); } }
    });
  }
  const demo = [['com.google.android.apps.maps', 'خرائط گوگل'], ['com.waze', 'ويز'], ['com.syu.bt/.BtMusic', 'BT Music'], ['com.spotify.music', 'سبوتيفاي'], ['com.syu.radio', 'راديو'], ['com.syu.bt', 'اتصال'], ['com.zjinnova.zlink', 'زي لينك'], ['com.syu.camera', 'كاميرا'], ['com.google.android.youtube', 'يوتيوب'], ['com.android.settings', 'إعدادات']].map(([pkg, label]) => ({ pkg, label, cls: pkg.includes('/') ? pkg.split('/')[1] : undefined }));
  window.__PREVIEW_DATA = { cfg: { carcfg: deepCopy(CC()) }, apps: carAppsCache || demo, carlog: carLogCache ? Object.assign({ odoBase: 0, done: {} }, carLogCache, { odo: carLogCache.odo || 0 }) : undefined };
  frame.src = 'launcher/car.html?preview=1&t=' + Date.now();
}
/* the car page is drawn at a real head-unit size (1024x600) and shrunk, so text and boxes look exactly like on the car */
function carFitPreview() {
  const pv = $('#carPv'), f = $('#pvf'); if (!pv || !f) return;
  const k = pv.clientWidth / 1024; f.style.transform = 'scale(' + k + ')'; f.style.webkitTransform = 'scale(' + k + ')';
}
window.addEventListener('resize', () => carFitPreview());
async function carLog() {
  if (!CONN.connected) return null;
  try { const c = JSON.parse(await run('cfgGet')); carLogCache = c.carlog || null; } catch (e) {}
  return carLogCache;
}
const CAR_EDIT = { bar: 'الشريط العلوي', widgets: 'الويدجتات', apps: 'تطبيقات السيارة', dock: 'الشريط السفلي', vol: 'أزرار الصوت' };
const nfA = n => Number(n || 0).toLocaleString('ar-IQ');
function swatches(cur, attr) {
  return `<div class="chips">${COLORS.map(([c, n]) => `<button class="chip ${(cur || null) === c ? 'on' : ''}" data-${attr}="${c || ''}">${c ? `<span class="cdot" style="background:${c};width:18px;height:18px"></span>` : ''}${n}</button>`).join('')}</div>`;
}
function toggleRow(attr, label, on, sub) { return `<div class="item tap" data-${attr}="1"><div class="t"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="toggle ${on ? 'on' : ''}"></div></div>`; }
function widgetDetail(w, i) {
  const st = W_STYLES[w.t];
  return `<div class="panel" style="border:2px solid var(--ac);margin-top:10px"><h2>${esc((CAR_WIDGETS.find(x => x[0] === w.t) || [, w.t])[1])}: التفاصيل</h2>
    <label class="f">الحجم</label>${chips([['صغير', 0], ['كبير (مربعين)', 1]], w.l ? 1 : 0, 'wsz')}
    ${st ? `<label class="f" style="margin-top:10px">الشكل</label>${chips(st.map(([k, n]) => [n, k]), w.style || st[0][0], 'wst')}` : ''}
    ${w.t === 'speed' ? `<label class="f" style="margin-top:10px">أعلى رقم بالعدّاد</label>${chips([['١٦٠', 160], ['٢٠٠', 200], ['٢٤٠', 240], ['٢٨٠', 280]], w.max || 200, 'wmx')}` : ''}
    <label class="f" style="margin-top:10px">الخلفية</label>${chips(W_BG.map(([k, n]) => [n, k]), w.bg || 'auto', 'wbg')}
    <label class="f" style="margin-top:10px">لون الويدجت</label>${swatches(w.c, 'wcl')}
    <label class="f" style="margin-top:10px">حجم الكتابة</label>${chips([['صغير', 's'], ['عادي', ''], ['كبير', 'l']], w.tsz || '', 'wts')}
    <div class="list" style="margin:10px 0 0">${toggleRow('wlb', 'اسم الويدجت فوق', w.lb !== false)}</div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn sec" style="flex:1" data-wi="${i}" data-wa="up">↑ لفوق</button><button class="btn sec" style="flex:1" data-wi="${i}" data-wa="down">↓ لجوه</button><button class="btn bad" style="flex:1" data-wi="${i}" data-wa="del">${ic('trash')} شيل</button></div></div>`;
}
function carEditorPanels() {
  document.querySelectorAll('#dSeg button').forEach(b => b.classList.toggle('on', b.dataset.tab === D.tab));
  const p = $('#dPanel'), C = CC();
  if (D.tab === 'brand') {
    p.innerHTML = `<div class="panel"><h2>تصاميم من صورك</h2><p class="sub" style="margin-top:-4px">نفس الصور، وكل جزء بيها شغّال: السرعة والخريطة والموسيقى والأزرار. غيّر اللون والأزرار والخلفية من «الشكل».</p>${sceneCards(C.scene)}
        ${C.scene ? `<button class="btn ghost full" id="cScOff" style="margin-top:8px">رجوع للتصميم العادي بالويدجتات</button>` : ''}</div>
      <div class="panel"><h2>واجهات الشركات</h2><p class="sub" style="margin-top:-4px">كل واجهة بألوانها وترتيبها وعدّادها وشكل أيقوناتها. تبدّل الشكل وتخلي تطبيقاتك وصورك وإعداداتك.</p>${brandCards(C.bt)}</div>
      <div class="panel"><h2>القوالب</h2><p class="sub" style="margin-top:-4px">قوالب عامة بدون ألوان شركة. تتطبق بالمعاينة فوراً.</p>
        <div class="tpl">${CAR_TEMPLATES.map(t => { const th = CAR_THEMES.find(x => x[0] === t.c.theme) || CAR_THEMES[0], on = !C.bt && C.tpl === t.id;
          return `<button data-ctpl="${t.id}" style="${on ? 'outline:3px solid var(--ac);outline-offset:-3px' : ''}"><div class="sw2" style="background:linear-gradient(135deg,${th[2]},${th[3]}66)"><i style="background:${th[3]}"></i><i></i></div><b>${esc(t.name)}</b><small>${on ? 'المختار' : esc(t.note)}</small></button>`; }).join('')}</div></div>
      <div class="panel"><h2>شركة سيارتك</h2><p class="sub" style="margin-top:-4px">${C.brand ? esc(C.brand.name + (C.brand.model ? ' · ' + C.brand.model : '')) + (C.brand.logo ? ' · بشعار من صورك' : '') : 'ما مختارة. اسمها يبقى ثابت فوق وبشاشة التوقف.'}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec" id="cBrand" style="flex:1">${ic('layers')} ${C.brand ? 'غيّر' : 'اختار'} الشركة</button>${C.brand ? `<button class="btn sec" id="cLogo" style="flex:1">${ic('cam')} ${C.brand.logo ? 'غيّر' : 'أضف'} الشعار من صوري</button>` : ''}</div>
        ${C.brand ? `<button class="btn ghost full" id="cBrandOff">${C.brand.logo ? 'شيل الشعار' : 'شيل الشركة من الواجهة'}</button>` : ''}
        ${C.bt ? `<button class="btn ghost full" id="cBtOff">رجّع ألوان الثيم العادي بدل ألوان الشركة</button>` : ''}</div>`;
  } else if (D.tab === 'el') {
    const ws = C.widgets || [];
    p.innerHTML = `<div class="panel"><h2>الويدجتات</h2><p class="sub" style="margin-top:-4px">اضغط على أي ويدجت (هنا أو بالمعاينة) حتى تعدّل شكله ولونه وخلفيته وحجمه.</p>
      <div class="list" style="margin:0">${ws.map((w, i) => `<div class="item tap" data-wsel="${i}" style="${D.wsel === i ? 'outline:2px solid var(--ac)' : ''}"><div class="t"><b>${esc((CAR_WIDGETS.find(x => x[0] === w.t) || [, w.t])[1])}</b>
        <small>${w.l ? 'كبير' : 'صغير'}${W_STYLES[w.t] ? ' · ' + ((W_STYLES[w.t].find(x => x[0] === (w.style || W_STYLES[w.t][0][0])) || [, ''])[1]) : ''}${w.bg && w.bg !== 'auto' ? ' · ' + (W_BG.find(x => x[0] === w.bg) || [, ''])[1] : ''}</small></div>${ic('left')}</div>
        ${D.wsel === i ? widgetDetail(w, i) : ''}`).join('') || '<div class="empty">ماكو ويدجتات</div>'}</div>
      <button class="btn sec full" id="wAdd" style="margin-top:12px">${ic('plus')} أضف ويدجت</button></div>
      ${(C.layout || 'carplay') === 'classic' ? `<div class="panel"><h2>مكان الويدجتات</h2>${chips([['جنب التطبيقات', 'split'], ['فوق التطبيقات', 'top'], ['بدون ويدجتات', 'none']], C.wlayout, 'cw')}</div>` : ''}
      <div class="panel"><h2>جهة الويدجتات</h2><p class="sub" style="margin-top:-4px">الويدجتات يمين أو يسار التطبيقات.</p>${chips([['يمين', 'right'], ['يسار', 'left']], C.side || 'right', 'cs')}</div>
      <div class="panel"><h2>مكان شريط التطبيقات</h2>${chips(DOCK_POS, carDockPos(C), 'cdp')}</div>`;
  } else if (D.tab === 'theme') {
    const scP = C.scene ? `<div class="panel"><h2>هذا التصميم: ${esc((CAR_SCENES.find(x => x[0] === C.scene) || [, ''])[1])}</h2>
        <label class="f">لون التمييز</label>${swatches(C.accent, 'cac')}
        <label class="f" style="margin-top:10px">أزرار الشريط</label><div class="chips">${[['maps', 'الملاحة'], ['music', 'الوسائط'], ['phone', 'الهاتف'], ['apps', 'التطبيقات'], ['park', 'السيارة'], ['settings', 'الإعدادات'], ['radio', 'الراديو'], ['bt', 'البلوتوث'], ['camera', 'الكاميرا'], ['mirror', 'ربط الموبايل'], ['climate', 'المناخ'], ['file', 'الملفات']].map(([k, n]) => `<button class="chip ${(C.sceneDock || []).includes(k) ? 'on' : ''}" data-csd="${k}">${n}</button>`).join('')}</div>
        <p class="sub">${(C.sceneDock || []).length ? 'الأزرار المختارة تطلع بالترتيب اللي اخترته.' : 'ما مختار شي: تطلع أزرار التصميم الأصلية.'}</p>
        <div class="list" style="margin:6px 0 0">${toggleRow('csbg', 'صوري كخلفية للتصميم', !!C.sceneBg, (C.bgPack || []).length ? '' : 'أضف صور من تبويب «الخلفية» أول')}</div></div>
      <p class="sub" style="margin:0 4px 10px">الإعدادات تحت تخص التصميم العادي بالويدجتات.</p>` : '';
    p.innerHTML = scP + `<div class="panel"><h2>ترتيب الواجهة</h2><div class="list" style="margin:0">${CAR_LAYOUTS.map(([k, n, d]) => `<div class="item tap" data-clay="${k}"><div class="t"><b>${n}</b><small>${d}</small></div>${(C.layout || 'carplay') === k ? '<span class="tag">المختار</span>' : ''}</div>`).join('')}</div></div>
      <div class="panel"><h2>شكل الأيقونات</h2>${chips(ICON_STYLES.map(([k, n]) => [n, k]), C.icons || 'squircle', 'cic')}
        <label class="f" style="margin-top:10px">الحجم</label>${chips([['صغير', 's'], ['وسط', 'm'], ['كبير', 'l'], ['كبير جداً', 'xl']], C.isize || 'm', 'cis')}
        <label class="f" style="margin-top:10px">بالصف</label>${chips([['٣', 3], ['٤', 4], ['٥', 5], ['٦', 6]], C.cols || 4, 'ccol')}
        <div class="list" style="margin:10px 0 0">${toggleRow('clbl', 'أسماء التطبيقات تحت الأيقونات', (C.labels || 'on') === 'on')}${toggleRow('ctbg', 'مربع خلف كل تطبيق', C.tilebg === 'on')}${toggleRow('chd', 'عنوان «تطبيقات السيارة» وزر كل التطبيقات', (C.apphd || 'on') === 'on')}</div></div>
      <div class="panel"><h2>البطاقات</h2>${chips([['زجاج', 'glass'], ['صلبة', 'solid'], ['إطار بس', 'outline'], ['شفافة', 'clear']], C.cards || 'glass', 'ccd')}
        <label class="f" style="margin-top:10px">وضوح الزجاج</label>${chips([['خفيف', 5], ['وسط', 8], ['واضح', 14], ['قوي', 22]], C.cop || 8, 'ccop')}
        <label class="f" style="margin-top:10px">تدوير الزوايا</label>${chips([['حادة', 0.6], ['قليل', 1.4], ['وسط', 2.2], ['ناعم', 3], ['كثير', 4.2]], C.rad != null ? C.rad : 3, 'crad')}
        <label class="f" style="margin-top:10px">حجم الكتابة</label>${chips([['صغير', 90], ['عادي', 100], ['كبير', 112], ['كبير جداً', 125]], C.fs || 100, 'cfs')}</div>
      <div class="panel"><h2>شريط التطبيقات</h2><label class="f">مكانه</label>${chips(DOCK_POS, carDockPos(C), 'cdp')}
        <label class="f" style="margin-top:10px">شكله</label>${chips([['شريط واحد', 'bar'], ['أزرار منفصلة', 'boxes'], ['خط تحت المختار', 'line'], ['أيقونات بس', 'icons']], C.dockStyle || 'bar', 'cdk')}</div>
      <div class="panel"><h2>أزرار الصوت</h2><p class="sub" style="margin-top:-4px">ثلاث أزرار دائرية: خفض وكتم ورفع.</p>
        <div class="list" style="margin:0 0 10px">${toggleRow('cvb', 'أظهر أزرار الصوت', !!C.volBtns)}</div>${C.volBtns ? chips([['فوق اليسار', 'left'], ['فوق اليمين', 'right']], C.volPos || 'left', 'cvp') : ''}</div>
      <div class="panel"><h2>ألوان عامة</h2><p class="sub" style="margin-top:-4px">${C.bt ? 'هسه مختار ألوان واجهة شركة. اختيار ثيم هنا يرجعك للألوان العادية.' : ''}</p></div>
      <div class="tpl">${CAR_THEMES.map(([id, n, a, b]) => `<button data-cth="${id}" style="${!C.bt && C.theme === id ? 'outline:3px solid var(--ac);outline-offset:-3px' : ''}"><div class="sw2" style="background:linear-gradient(135deg,${a},${b}66)"><i style="background:${b}"></i><i></i></div><b>${esc(n)}</b><small>${!C.bt && C.theme === id ? 'المختار' : 'اضغط للمعاينة'}</small></button>`).join('')}</div>
      <div class="panel" style="margin-top:14px"><h2>لون التمييز</h2>${swatches(C.accent, 'cac')}</div>
      <div class="panel"><h2>الوضع الليلي</h2><p class="sub" style="margin-top:-4px">يغمّق الشاشة من الغروب للشروق حسب مدينتك.</p>${chips([['تلقائي (الغروب)', 'auto'], ['دائماً', 'on'], ['متوقف', 'off']], C.night || 'auto', 'cn')}</div>
      <div class="panel"><h2>اسم السيارة</h2><input id="carOwn" value="${esc(C.owner || '')}" maxlength="22"></div>`;
  } else if (D.tab === 'bg') {
    p.innerHTML = `<div class="panel"><h2>خلفيات من موبايلك</h2><p class="sub" style="margin-top:-4px">حتى ١٥ صورة تتبدل وحدها. بالليل تغمق أكثر.</p>
      <div class="tpl">${(C.bgPack || []).map((u, i) => `<button data-cpk="${i}"><div class="sw2" style="background:#000 url('${esc(u)}') center/cover;height:84px"></div><small style="padding:6px 10px">${ic('trash')} شيل</small></button>`).join('')}</div>
      <button class="btn sec full" id="cPackAdd" style="margin-top:10px">${ic('plus')} اختار صور من موبايلي</button></div>
      <div class="panel"><h2>تغميق الصورة</h2>${chips([['بدون', 10], ['خفيف', 30], ['وسط', 45], ['غامق', 65], ['غامق جداً', 80]], C.bgDim || 45, 'cbd')}</div>
      <div class="panel"><h2>تتغير كل</h2>${chips([['دقيقة', 60], ['دقيقتين', 120], ['٥ دقايق', 300], ['١٠ دقايق', 600]], C.bgInterval || 120, 'cbi')}</div>`;
  } else if (D.tab === 'car') {
    const A = C.alert || (C.alert = { on: true, city: 60, hw: 120, sound: true }), Dr = C.drive || (C.drive = { on: true, kmh: 20 });
    const odo = carLogCache && carLogCache.odo;
    p.innerHTML = `<div class="panel"><h2>وضع القيادة</h2><p class="sub" style="margin-top:-4px">من تمشي، تكبر الأزرار وتختفي التفاصيل وتتسكر قائمة التطبيقات حتى ما تتلهى.</p>
        <div class="list" style="margin:0 0 10px">${toggleRow('cdr', 'وضع القيادة التلقائي', Dr.on !== false)}</div>
        ${Dr.on !== false ? `<label class="f">يشتغل من سرعة</label>${chips([['١٠', 10], ['٢٠', 20], ['٣٠', 30], ['٥٠', 50]], Dr.kmh || 20, 'cdk2')}` : ''}
        <button class="btn sec full" id="cDrPv" style="margin-top:10px">${ic('screen')} شوف شكله بالمعاينة</button></div>
      <div class="panel"><h2>تنبيه تجاوز السرعة</h2><p class="sub" style="margin-top:-4px">إطار أحمر وصوت تنبيه. بالشاشة اضغط على العدّاد حتى تبدّل بين المدينة والخط السريع.</p>
        <div class="list" style="margin:0 0 10px">${toggleRow('cal', 'التنبيه', A.on !== false)}${A.on !== false ? toggleRow('cas', 'صوت التنبيه', A.sound !== false) : ''}</div>
        ${A.on !== false ? `<label class="f">داخل المدينة</label>${chips([['٤٠', 40], ['٥٠', 50], ['٦٠', 60], ['٨٠', 80]], A.city || 60, 'calc')}
        <label class="f" style="margin-top:10px">الخط السريع</label>${chips([['١٠٠', 100], ['١٢٠', 120], ['١٤٠', 140], ['١٦٠', 160]], A.hw || 120, 'calh')}
        <button class="btn sec full" id="cOvPv" style="margin-top:10px">${ic('screen')} جرّب التنبيه بالمعاينة</button>` : ''}</div>
      <div class="panel"><h2>رحلاتي ومكان السيارة</h2><p class="sub" style="margin-top:-4px">الشاشة تحفظ كل رحلة وآخر مكان وگفت بي، وتشوفهن هنا.</p>
        <button class="btn pri full" id="cTrips">${ic('layers')} شوف الرحلات ووين وگفت السيارة</button></div>
      <div class="panel"><h2>عداد الكيلومترات</h2><p class="sub" style="margin-top:-4px">اكتب الرقم اللي بعداد سيارتك هسه، والشاشة تكمّل تحسب وحدها من الـ GPS.${odo ? ' آخر قراءة من الشاشة: ' + nfA(Math.round(odo)) + ' كم' : ''}</p>
        <div style="display:flex;gap:8px"><input id="cOdo" class="num" inputmode="numeric" placeholder="مثلاً 84500" value="${C.odoSet ? esc(C.odoSet.km) : ''}" style="flex:1"><button class="btn sec" id="cOdoOk">حفظ</button></div></div>
      <div class="panel"><h2>تذكير الصيانة</h2><p class="sub" style="margin-top:-4px">يطلع تنبيه بالشاشة من يجي الوقت، وتضغط «سويته».</p>
        <div class="list" style="margin:0">${(C.maint || []).map((m, i) => `<div class="item"><div class="t"><b>${esc(m.n)}</b><small>${[m.km ? 'كل ' + nfA(m.km) + ' كم' : '', m.days ? 'كل ' + nfA(m.days) + ' يوم' : ''].filter(Boolean).join(' أو ')}${m.lastAt ? ' · آخر مرة ' + new Date(m.lastAt).toLocaleDateString('ar-IQ') : ''}</small></div>
          <button class="chip" data-mdone="${i}">سويته هسه</button><button class="chip" data-mdel="${i}" aria-label="شيل">${ic('trash')}</button></div>`).join('') || '<div class="empty">ماكو مواعيد</div>'}</div>
        <button class="btn sec full" id="cMAdd" style="margin-top:10px">${ic('plus')} أضف موعد صيانة</button></div>
      <div class="panel"><h2>اتصال سريع</h2><p class="sub" style="margin-top:-4px">٤ أسماء تتصل بيهم بلمسة (يفتح الاتصال بالبلوتوث إذا شاشتك تدعمه).</p>
        <div class="list" style="margin:0">${(C.dial || []).map((d, i) => `<div class="item"><div class="t"><b>${esc(d.n)}</b><small class="num" style="direction:ltr;text-align:right">${esc(d.num)}</small></div><button class="chip" data-ddel="${i}" aria-label="شيل">${ic('trash')}</button></div>`).join('') || '<div class="empty">ماكو أسماء</div>'}</div>
        ${(C.dial || []).length < 4 ? `<div style="display:flex;gap:8px;margin-top:10px"><input id="dN" placeholder="الاسم" maxlength="14" style="flex:1"><input id="dP" class="num" inputmode="tel" placeholder="الرقم" style="flex:1"></div><button class="btn sec full" id="cDAdd" style="margin-top:8px">${ic('plus')} أضف</button>` : ''}</div>`;
  } else {
    const S = C.saver || (C.saver = {}), DA = C.dockApps || {};
    p.innerHTML = `<div class="panel"><h2>تطبيقات السيارة</h2><p class="sub" style="margin-top:-4px">${(C.apps || []).length ? 'اخترت ' + C.apps.length + ' تطبيق' : 'تلقائي: الخرائط وموسيقى البلوتوث والربط والاتصال والراديو والكاميرا'}</p>
        <button class="btn sec full" id="cApps">${ic('apps')} اختار التطبيقات بنفسك</button><button class="btn ghost full" id="cStore">${ic('plus')} نصّب تطبيقات سيارة من المتجر</button>${(C.apps || []).length ? `<button class="btn ghost full" id="cAppsAuto">رجّعها تلقائي</button>` : ''}</div>
      <div class="panel"><h2>أزرار شريط التطبيقات</h2><label class="f">مكانه</label>${chips(DOCK_POS, carDockPos(C), 'cdp')}<label class="f" style="margin-top:10px">الأزرار</label><div class="chips">${CAR_DOCK.map(([k, n]) => `<button class="chip ${(C.dock || []).includes(k) ? 'on' : ''}" data-cd="${k}">${n}</button>`).join('')}</div></div>
      <div class="panel"><h2>شنو يفتح كل زر</h2><p class="sub" style="margin-top:-4px">زر الموسيقى يفتح موسيقى البلوتوث تلقائياً. تگدر تختار غيره هنا، أو بالشاشة نفسها: اضغط مطوّل على الزر.</p>
        <div class="list" style="margin:0">${['music', 'maps', 'phone', 'mirror', 'radio'].map(k => `<div class="item tap" data-dap="${k}"><div class="t"><b>${(CAR_DOCK.find(x => x[0] === k) || [, k])[1]}</b><small class="num" style="direction:ltr;text-align:right">${esc(DA[k] || (k === 'music' ? 'تلقائي: موسيقى البلوتوث' : 'تلقائي'))}</small></div>${ic('left')}</div>`).join('')}</div></div>
      <div class="panel"><h2>شاشة التوقف</h2><p class="sub" style="margin-top:-4px">شاشة سودة بيها الوقت والسرعة والأغنية. ما تشتغل وكت السياقة.</p>
        <div class="list" style="margin:0 0 10px">
          <div class="item tap" data-cv="on"><div class="t"><b>شاشة التوقف</b></div><div class="toggle ${S.on !== false ? 'on' : ''}"></div></div>
          <div class="item tap" data-cv="speed"><div class="t"><b>تبين السرعة</b></div><div class="toggle ${S.speed !== false ? 'on' : ''}"></div></div>
          <div class="item tap" data-cv="music"><div class="t"><b>تبين الأغنية الشغالة</b></div><div class="toggle ${S.music !== false ? 'on' : ''}"></div></div>
          <div class="item tap" data-cv="overApps"><div class="t"><b>تشتغل فوق التطبيقات الثانية</b></div><div class="toggle ${S.overApps !== false ? 'on' : ''}"></div></div>
          <div class="item tap" data-cv="clock"><div class="t"><b>الساعة</b></div><div class="toggle ${S.clock !== false ? 'on' : ''}"></div></div>
          <div class="item tap" data-cv2="analog"><div class="t"><b>ساعة بعقارب بدل الأرقام</b></div><div class="toggle ${S.analog ? 'on' : ''}"></div></div>
          <div class="item tap" data-cv2="occ"><div class="t"><b>ويدجت المناسبة القادمة</b></div><div class="toggle ${S.occ ? 'on' : ''}"></div></div>
          <div class="item tap" data-cv2="wisdom"><div class="t"><b>ويدجت آية وحديث</b></div><div class="toggle ${S.wisdom ? 'on' : ''}"></div></div>
          <div class="item tap" data-cv2="photos"><div class="t"><b>خلفية صور بدل الأسود</b><small>${(S.pack || []).length ? (S.pack.length + ' صورة') : 'تستعمل صور الخلفية، أو اختار صور خاصة تحت'}</small></div><div class="toggle ${S.photos ? 'on' : ''}"></div></div></div>
        <button class="btn sec full" id="cSvPk">${ic('plus')} صور خاصة لشاشة التوقف</button>${(S.pack || []).length ? '<button class="btn ghost full" id="cSvPkClr">شيل صور شاشة التوقف</button>' : ''}
        ${chips([['دقيقة', 1], ['٣ دقايق', 3], ['٥ دقايق', 5], ['١٠ دقايق', 10], ['نص ساعة', 30]], S.min || 5, 'cvm')}
        <button class="btn sec full" id="cSaverPv" style="margin-top:12px">${ic('screen')} معاينة شاشة التوقف</button></div>`;
  }
  p.onclick = carPanelClick;
  const own = $('#carOwn'); if (own) own.onchange = () => { CC().owner = own.value.trim(); changed(); carLive(); };
}
const MAINT_PRESETS = [['تبديل الدهن', 5000, 180], ['فلتر الهواء', 15000, 365], ['فلتر المكيف', 15000, 365], ['البريكات', 30000, 0], ['الإطارات', 40000, 0], ['ماي الرديتر', 40000, 730], ['البطارية', 0, 730], ['الفحص السنوي', 0, 365]];
async function carTripsPage() {
  if (!CONN.connected) return need();
  busy('أجيب الرحلات من الشاشة…'); const L = await carLog(); unbusy();
  if (!L) return toast('ما گدرت أقرا من الشاشة. حدّث «واجهة مدير الشاشات» بالسيارة');
  const tr = (L.trips || []).slice().reverse(), wk = Date.now() - 7 * 864e5, w = tr.filter(t => t.s > wk);
  const km = w.reduce((a, t) => a + t.km, 0), mins = w.reduce((a, t) => a + (t.e - t.s) / 6e4, 0), mx = w.reduce((a, t) => Math.max(a, t.max), 0);
  const f = d => new Date(d).toLocaleString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  page('رحلاتي', `<div class="panel"><h2>هالأسبوع</h2><div class="stats" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      <div class="stat"><b>${nfA(Math.round(km * 10) / 10)}</b><small>كم</small></div><div class="stat"><b>${nfA(w.length)}</b><small>رحلة</small></div>
      <div class="stat"><b>${nfA(Math.round(mins / 6) / 10)}</b><small>ساعة سياقة</small></div><div class="stat"><b>${nfA(mx)}</b><small>أعلى سرعة</small></div></div>
      ${L.odo ? `<p class="sub" style="margin:10px 0 0">العداد تقريباً: ${nfA(Math.round(L.odo))} كم</p>` : ''}</div>
    <div class="panel"><h2>وين وگفت سيارتي</h2>${L.park ? `<p class="sub" style="margin-top:-4px">${f(L.park.at)}</p><button class="btn pri full" id="tpMap">${ic('layers')} افتحه بالخريطة</button>` : '<p class="sub" style="margin:0">لسه ما محفوظ. ينحفظ وحده من توگف السيارة دقيقة.</p>'}</div>
    <h2>كل الرحلات</h2><div class="list">${tr.slice(0, 60).map(t => `<div class="item"><div class="t"><b>${f(t.s)}</b><small>${nfA(t.km)} كم · ${nfA(Math.round((t.e - t.s) / 6e4))} دقيقة · معدل ${nfA(t.avg)} · أعلى ${nfA(t.max)}</small></div></div>`).join('') || '<div class="empty">لسه ماكو رحلات</div>'}</div>`, el => {
    const m = el.querySelector('#tpMap'); if (m) m.onclick = () => B.open('https://www.google.com/maps/search/?api=1&query=' + L.park.lat + ',' + L.park.lng, '');
  });
}
async function carPickApp(title, done) {
  if (!CONN.connected) return toast('اتصل بشاشة السيارة حتى تختار من تطبيقاتها');
  busy('أجيب تطبيقات الشاشة…');
  const l = carAppsCache || await carPreviewApps(); unbusy();
  if (!l) return toast('ما گدرت أجيب التطبيقات');
  carAppsCache = l;
  sheet(`<h2>${esc(title)}</h2><div class="list"><div class="item tap" data-pa=""><div class="t"><b>تلقائي</b></div></div>${l.map(a => `<div class="item tap" data-pa="${esc(a.pkg)}"><div class="t"><b>${esc(a.label || a.pkg)}</b><small class="num" style="direction:ltr;text-align:right">${esc(a.pkg)}</small></div></div>`).join('')}</div>`);
  $('#sheetBody').onclick = e => { const r = e.target.closest('[data-pa]'); if (!r) return; closeSheet(); done(r.dataset.pa); };
}
function carPanelClick(e) {
  const C = CC(), t = e.target.closest('button,[data-cv],[data-clay],[data-wsel],[data-dap],.item.tap'); if (!t) return;
  const ds = t.dataset;
  const w = D.wsel != null ? (C.widgets || [])[D.wsel] : null;
  if (t.id === 'wAdd') {
    sheet(`<h2>أضف ويدجت</h2><div class="chips">${CAR_WIDGETS.map(([k, n]) => `<button class="chip" data-nw="${k}">${n}</button>`).join('')}</div>`);
    $('#sheetBody').onclick = ev => { const b = ev.target.closest('[data-nw]'); if (!b) return; closeSheet(); C.widgets = (C.widgets || []).concat({ t: b.dataset.nw, l: b.dataset.nw === 'media' || b.dataset.nw === 'dial' || b.dataset.nw === 'call' }); D.wsel = C.widgets.length - 1; changed(); carLive(); carEditorPanels(); };
    return;
  }
  if (t.id === 'cPackAdd') {
    busy('اختار صور من موبايلك…');
    run('pick', { mode: 'bgimages' }).then(l => { unbusy(); C.bgPack = l.concat(C.bgPack || []).slice(0, 15); changed(); carLive(); carEditorPanels(); }).catch(er => { unbusy(); if (er.message !== 'CANCEL') toast(errText(er)); });
    return;
  }
  if (t.id === 'cScOff') { delete C.scene; changed(); carLive(); carEditorPanels(); return; }
  if (t.id === 'cSvPkClr') { C.saver.pack = []; changed(); carLive(); carEditorPanels(); return; }
  if (t.id === 'cSvPk') {
    busy('اختار صور لشاشة التوقف…');
    run('pick', { mode: 'bgimages' }).then(l => { unbusy(); C.saver = C.saver || {}; C.saver.pack = l.concat(C.saver.pack || []).slice(0, 10); C.saver.photos = true; changed(); carLive(); carEditorPanels(); }).catch(er => { unbusy(); if (er.message !== 'CANCEL') toast(errText(er)); });
    return;
  }
  if (t.id === 'cSaverPv') { pvDirect({ saver: true }); setTimeout(() => pvDirect({ saver: false }), 5000); toast('معاينة ٥ ثواني'); return; }
  if (t.id === 'cDrPv') { pvDirect({ drive: true }); setTimeout(() => pvDirect({ drive: false }), 5000); toast('معاينة وضع القيادة ٥ ثواني'); return; }
  if (t.id === 'cOvPv') { pvDirect({ over: true }); setTimeout(() => pvDirect({ over: false }), 5000); toast('معاينة التنبيه ٥ ثواني'); return; }
  if (t.id === 'cTrips') { carTripsPage(); return; }
  if (t.id === 'cApps') { carAppsPicker(); return; }
  if (t.id === 'cStore') { openCarStore(); return; }
  if (t.id === 'cBrand') { brandSheet(br => { if (br) { C.brand = br; changed(); carLive(); carEditorPanels(); } }); return; }
  if (t.id === 'cBrandOff') { if (C.brand && C.brand.logo) delete C.brand.logo; else C.brand = null; changed(); carLive(); carEditorPanels(); return; }
  if (t.id === 'cBtOff') { C.bt = ''; changed(); carLive(); carEditorPanels(); return; }
  if (t.id === 'cLogo') {
    busy('اختار صورة الشعار…');
    run('pick', { mode: 'logo' }).then(u => { unbusy(); C.brand.logo = u; const d = devBrand(); if (d && d.id === C.brand.id) { d.logo = u; saveDevBrand(d); } changed(); carLive(); carEditorPanels(); toast('انضاف الشعار'); })
      .catch(er => { unbusy(); if (er.message !== 'CANCEL') toast(errText(er)); });
    return;
  }
  if (t.id === 'cAppsAuto') { C.apps = []; changed(); carLive(); carEditorPanels(); return; }
  if (t.id === 'cOdoOk') { const v = parseInt(($('#cOdo').value || '').replace(/[^\d]/g, ''), 10); if (!v) return toast('اكتب رقم العداد'); C.odoSet = { km: v, stamp: Date.now().toString(36) }; changed(); carLive(); toast('ينحفظ بالشاشة من تطبّق'); return; }
  if (t.id === 'cMAdd') {
    sheet(`<h2>موعد صيانة</h2><div class="list">${MAINT_PRESETS.map(([n, km, d], i) => `<div class="item tap" data-mp="${i}"><div class="t"><b>${n}</b><small>${[km ? 'كل ' + nfA(km) + ' كم' : '', d ? 'كل ' + nfA(d) + ' يوم' : ''].filter(Boolean).join(' أو ')}</small></div>${ic('plus')}</div>`).join('')}</div>
      <label class="f">أو اكتب واحد</label><input id="mN" placeholder="مثلاً: سير المكينة" maxlength="22"><div style="display:flex;gap:8px;margin-top:8px"><input id="mK" class="num" inputmode="numeric" placeholder="كل كم كيلو" style="flex:1"><input id="mD" class="num" inputmode="numeric" placeholder="أو كل كم يوم" style="flex:1"></div>
      <button class="btn pri full" id="mOk" style="margin-top:10px">أضف</button>`);
    const add = (n, km, d) => { C.maint = (C.maint || []).concat({ id: 'm' + Date.now().toString(36), n, km: +km || 0, days: +d || 0, lastAt: Date.now(), lastKm: (carLogCache && Math.round(carLogCache.odo)) || (C.odoSet && C.odoSet.km) || 0 }); closeSheet(); changed(); carLive(); carEditorPanels(); };
    $('#sheetBody').onclick = ev => {
      const r = ev.target.closest('[data-mp]'); if (r) { const x = MAINT_PRESETS[+r.dataset.mp]; add(x[0], x[1], x[2]); return; }
      if (ev.target.closest('#mOk')) { const n = $('#mN').value.trim(); if (!n) return toast('اكتب الاسم'); add(n, $('#mK').value, $('#mD').value); }
    };
    return;
  }
  if (t.id === 'cDAdd') { const n = $('#dN').value.trim(), num = $('#dP').value.trim(); if (!n || !num) return toast('اكتب الاسم والرقم'); C.dial = (C.dial || []).concat({ n, num }); if (!(C.widgets || []).some(x => x.t === 'dial')) C.widgets = (C.widgets || []).concat({ t: 'dial', l: true }); changed(); carLive(); carEditorPanels(); return; }
  if (ds.dap) { const k = ds.dap; carPickApp('زر «' + (CAR_DOCK.find(x => x[0] === k) || [, k])[1] + '» يفتح', p => { C.dockApps = Object.assign({}, C.dockApps); if (p) C.dockApps[k] = p; else delete C.dockApps[k]; changed(); carLive(); carEditorPanels(); }); return; }
  if (ds.ctpl) { const tp = CAR_TEMPLATES.find(x => x.id === ds.ctpl); if (!tp) return;
    const keep = { apps: C.apps, bgPack: C.bgPack, dock: C.dock, dockApps: C.dockApps, maint: C.maint, dial: C.dial, odoSet: C.odoSet, alert: C.alert, drive: C.drive, saver: C.saver, owner: C.owner, volBtns: C.volBtns, brand: C.brand };
    D.cfg.carcfg = Object.assign(CAR_DEF(), deepCopy(tp.c), JSON.parse(JSON.stringify(keep)), { bt: '', tpl: tp.id }); D.wsel = null; tap(); changed(); carLive(); carEditorPanels(); toast('قالب ' + tp.name); return; }
  if (ds.bui) { const u = BRAND_UI.find(x => x.id === ds.bui); const keep = { apps: C.apps, bgPack: C.bgPack, dock: C.dock, dockApps: C.dockApps, maint: C.maint, dial: C.dial, odoSet: C.odoSet, alert: C.alert, drive: C.drive, saver: C.saver, owner: C.owner, volBtns: C.volBtns };
    D.cfg.carcfg = Object.assign(brandCfg(u), JSON.parse(JSON.stringify(keep))); D.wsel = null; tap(); changed(); carLive(); carEditorPanels(); toast('واجهة ' + brandOf(u.id).name); return; }
  if (ds.wsel !== undefined) { D.wsel = D.wsel === +ds.wsel ? null : +ds.wsel; tap(); carEditorPanels(); pvDirect({ select: 'w' + ds.wsel }); D.sel = 'w' + ds.wsel; return; }
  if (ds.wi !== undefined) {
    const i = +ds.wi, x = C.widgets[i];
    if (ds.wa === 'up' && i > 0) { C.widgets.splice(i, 1); C.widgets.splice(i - 1, 0, x); D.wsel = i - 1; }
    if (ds.wa === 'down' && i < C.widgets.length - 1) { C.widgets.splice(i, 1); C.widgets.splice(i + 1, 0, x); D.wsel = i + 1; }
    if (ds.wa === 'del') { C.widgets.splice(i, 1); D.wsel = null; }
  }
  else if (w && ds.wsz !== undefined) w.l = ds.wsz === '1';
  else if (w && ds.wst) w.style = ds.wst;
  else if (w && ds.wmx) w.max = +ds.wmx;
  else if (w && ds.wbg) w.bg = ds.wbg;
  else if (w && ds.wcl !== undefined) w.c = ds.wcl || undefined;
  else if (w && ds.wts !== undefined) w.tsz = ds.wts || undefined;
  else if (w && ds.wlb) w.lb = w.lb === false;
  else if (ds.cw) C.wlayout = ds.cw;
  else if (ds.cs) C.side = ds.cs;
  else if (ds.cth) { C.theme = ds.cth; C.bt = ''; }
  else if (ds.cac !== undefined) { C.accent = ds.cac || null; C.accent2 = ds.cac || null; }
  else if (ds.cic) C.icons = ds.cic;
  else if (ds.cis) C.isize = ds.cis;
  else if (ds.ccol) C.cols = +ds.ccol;
  else if (ds.clbl) C.labels = (C.labels || 'on') === 'on' ? 'off' : 'on';
  else if (ds.ctbg) C.tilebg = C.tilebg === 'on' ? 'off' : 'on';
  else if (ds.chd) C.apphd = (C.apphd || 'on') === 'on' ? 'off' : 'on';
  else if (ds.ccd) C.cards = ds.ccd;
  else if (ds.ccop) C.cop = +ds.ccop;
  else if (ds.crad) C.rad = +ds.crad;
  else if (ds.cfs) C.fs = +ds.cfs;
  else if (ds.cdk) C.dockStyle = ds.cdk;
  else if (ds.cdp) C.dockPos = ds.cdp;
  else if (ds.cvp) C.volPos = ds.cvp;
  else if (ds.cn) C.night = ds.cn;
  else if (ds.cbi) C.bgInterval = +ds.cbi;
  else if (ds.cbd) C.bgDim = +ds.cbd;
  else if (ds.cpk !== undefined) C.bgPack.splice(+ds.cpk, 1);
  else if (ds.cd) { const d = C.dock || []; C.dock = d.includes(ds.cd) ? d.filter(x => x !== ds.cd) : CAR_DOCK.map(x => x[0]).filter(k => d.includes(k) || k === ds.cd); }
  else if (ds.clay) C.layout = ds.clay;
  else if (ds.cvb) C.volBtns = !C.volBtns;
  else if (ds.cdr) C.drive = Object.assign({ kmh: 20 }, C.drive, { on: !(C.drive && C.drive.on !== false) });
  else if (ds.cdk2) C.drive = Object.assign({}, C.drive, { kmh: +ds.cdk2 });
  else if (ds.cal) C.alert = Object.assign({ city: 60, hw: 120, sound: true }, C.alert, { on: !(C.alert && C.alert.on !== false) });
  else if (ds.cas) C.alert = Object.assign({}, C.alert, { sound: !(C.alert && C.alert.sound !== false) });
  else if (ds.calc) C.alert = Object.assign({}, C.alert, { city: +ds.calc });
  else if (ds.calh) C.alert = Object.assign({}, C.alert, { hw: +ds.calh });
  else if (ds.mdone !== undefined) { const m = C.maint[+ds.mdone]; m.lastAt = Date.now(); m.lastKm = (carLogCache && Math.round(carLogCache.odo)) || m.lastKm || 0; toast('انحفظ: ' + m.n); }
  else if (ds.mdel !== undefined) C.maint.splice(+ds.mdel, 1);
  else if (ds.ddel !== undefined) C.dial.splice(+ds.ddel, 1);
  else if (ds.cv) { C.saver = C.saver || {}; C.saver[ds.cv] = C.saver[ds.cv] === false; }
  else if (ds.cv2) { C.saver = C.saver || {}; C.saver[ds.cv2] = !C.saver[ds.cv2]; }
  else if (ds.csc) { C.scene = ds.csc; }
  else if (ds.csd) { const l = C.sceneDock = C.sceneDock || [], i = l.indexOf(ds.csd); if (i >= 0) l.splice(i, 1); else l.push(ds.csd); }
  else if (ds.csbg) { C.sceneBg = !C.sceneBg; }
  else if (ds.cvm) { C.saver = C.saver || {}; C.saver.min = +ds.cvm; }
  else return;
  tap(); changed(); carLive(); carEditorPanels();
}
async function carAppsPicker() {
  if (!CONN.connected) return toast('اتصل بشاشة السيارة حتى تختار من تطبيقاتها');
  busy('أجيب تطبيقات الشاشة…');
  const l = carAppsCache || await carPreviewApps(); unbusy();
  if (!l) return toast('ما گدرت أجيب التطبيقات');
  carAppsCache = l;
  const C = CC(), sel = (C.apps || []).slice();
  const draw = () => {
    sheet(`<h2>تطبيقات السيارة (حتى ١٢)</h2><p class="sub">بالترتيب اللي تختاره.</p><div class="list">${l.map(a => `<div class="item tap" data-ap="${esc(a.pkg)}"><div class="check ${sel.includes(a.pkg) ? 'on' : ''}">${ic('check')}</div><div class="t"><b>${esc(a.label || a.pkg)}</b><small class="num" style="direction:ltr;text-align:right">${esc(a.pkg)}</small></div>${sel.includes(a.pkg) ? `<span class="tag">${sel.indexOf(a.pkg) + 1}</span>` : ''}</div>`).join('')}</div>
      <button class="btn pri full" id="apOk" style="position:sticky;bottom:0">${ic('check')} تمام</button>`);
    $('#sheetBody').onclick = e => {
      if (e.target.closest('#apOk')) { closeSheet(); C.apps = sel; changed(); carLive(); carEditorPanels(); return; }
      const r = e.target.closest('[data-ap]'); if (!r) return;
      const p = r.dataset.ap, i = sel.indexOf(p);
      if (i >= 0) sel.splice(i, 1); else if (sel.length < 12) sel.push(p);
      const sc = $('#sheet').scrollTop; draw(); $('#sheet').scrollTop = sc;
    };
  };
  draw();
}

/* ---------- hooks into the design studio ---------- */
const _designEditor = designEditor;
designEditor = function () {
  if (!isCarD()) return _designEditor();
  D.kind = 'car';
  if (!['brand', 'el', 'theme', 'bg', 'set', 'car'].includes(D.tab)) D.tab = 'el';
  carLog().then(() => {});
  $('#dTitle').textContent = D.name;
  $('#designBody').innerHTML = `
    <div class="pv" id="carPv" style="aspect-ratio:1024/600"><iframe id="pvf" title="معاينة واجهة السيارة" style="width:1024px;height:600px;left:0;top:0;right:auto;bottom:auto;transform-origin:0 0;-webkit-transform-origin:0 0"></iframe></div>
    <div class="hint">${ic('info')} معاينة شاشة السيارة. الأرقام تجريبية لحد ما تتطبق.</div>
    <div class="seg" id="dSeg" style="overflow-x:auto"><button data-tab="brand">الشركات</button><button data-tab="el">الويدجتات</button><button data-tab="theme">الشكل</button><button data-tab="bg">الخلفية</button><button data-tab="set">التطبيقات</button><button data-tab="car">السيارة</button></div>
    <div id="dPanel"></div><div style="height:70px"></div>`;
  carLoadPreview($('#pvf'));
  carFitPreview(); setTimeout(carFitPreview, 300);
  $('#dSeg').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; tap(); D.tab = b.dataset.tab; carEditorPanels(); };
  carEditorPanels();
  addDock();
};
const _designPanel = designPanel;
designPanel = function () { if (isCarD()) return carEditorPanels(); return _designPanel(); };
const _prevSel = window.__previewSelect;
window.__previewSelect = id => {
  if (!isCarD()) return _prevSel(id);
  if (!id) return;
  tap(); D.sel = id; pvDirect({ select: id });
  const m = /^w(\d+)$/.exec(id);
  if (m) D.wsel = +m[1];
  D.tab = /^w\d|widgets/.test(id) ? 'el' : id === 'dock' || id === 'apps' ? 'set' : id === 'bar' || id === 'vol' ? 'theme' : D.tab;
  carEditorPanels();
  toast((CAR_EDIT[id] || 'ويدجت') + ': عدّله من تحت');
};
const _designStart = designStart;
designStart = function () {
  _designStart();
  const t = document.querySelector('#designBody .tile');
  if (!t) return;
  const b = document.createElement('button');
  b.innerHTML = `${ic('tv')}<b>واجهة سيارة</b><small>ويدجتات وسرعة وتطبيقات السيارة</small>`;
  b.onclick = () => { tap(); carNew(); };
  if (CONN.connected && devType() === 'car') t.prepend(b); else t.append(b);
};

/* applying: grant what the car page needs, and send phone photos */
const _localPack = localPackToTv;
localPackToTv = async function (cfg) {
  cfg = await _localPack(cfg);
  if (cfg.mode !== 'car' || !cfg.carcfg) return cfg;
  cfg = deepCopy(cfg);
  const P = cfg.carcfg.bgPack || [];
  if (P.some(u => u && u.startsWith('data:'))) await sendPhotos(P, 'c');
  return cfg;
};
async function carGrants() {
  const pk = 'com.cleantv.launcher';
  try {
    await run('shs', { cmds: ['pm grant ' + pk + ' android.permission.ACCESS_FINE_LOCATION', 'pm grant ' + pk + ' android.permission.ACCESS_COARSE_LOCATION',
      'cmd notification allow_listener ' + pk + '/' + pk + '.MediaListener', 'appops set ' + pk + ' SYSTEM_ALERT_WINDOW allow'] });
  } catch (e) {}
}
const _applyToTv = applyToTv;
applyToTv = async function (cfg) {
  if (cfg && cfg.mode === 'car') {
    if (!need()) return;
    const br = devBrand(); if (br && cfg.carcfg && !cfg.carcfg.brand) { cfg = deepCopy(cfg); cfg.carcfg.brand = br; }
    busy('أجهّز شاشة السيارة…'); await carGrants(); unbusy();
  }
  return _applyToTv(cfg);
};
const _installFromGallery = installFromGallery;
installFromGallery = async function (x) {
  if ((x.tags || []).includes('السيارة') && CONN.connected) await carGrants();
  return _installFromGallery(x);
};

/* ============================================================ car remote */
let remoteMode = null, medTimer = null;
const _renderRemote = renderRemote;
const CAR_KEYS = { prev: 88, play: 85, next: 87, stop: 86, vdn: 25, vup: 24, mute: 164, back: 4, home: 3, search: 84, menu: 82 };
const CAR_QUICK = [['maps', 'الخرائط', ['com.google.android.apps.maps', 'com.waze']], ['music', 'الموسيقى', ['com.spotify.music', 'com.anghami', 'com.syu.music', 'com.microntek.music', 'com.google.android.apps.youtube.music']],
  ['phone', 'الاتصال', ['com.syu.bt', 'com.microntek.bluetooth', 'com.ts.bt', 'com.fyt.bt']], ['mirror', 'ربط الموبايل', ['com.zjinnova.zlink', 'cn.manstep.phonemirrorBox', 'com.ts.carlink', 'com.suding.speedplay', 'net.easyconn']],
  ['radio', 'الراديو', ['com.syu.radio', 'com.microntek.radio', 'com.ts.radio', 'com.android.fmradio']], ['camera', 'الكاميرا', ['com.syu.camera', 'com.microntek.avin', 'com.ts.avin']]];
renderRemote = function () {
  if (remoteMode === null) remoteMode = CONN.connected && devType() === 'car' ? 'car' : 'tv';
  clearInterval(medTimer);
  if (remoteMode === 'tv') {
    _renderRemote();
    $('#remoteBody').insertAdjacentHTML('afterbegin', `<div class="seg" style="width:100%;position:static" id="rmSeg"><button data-rm="tv" class="on">التلفزيون</button><button data-rm="car">السيارة</button></div>`);
  } else {
    $('#remoteBody').innerHTML = `<div class="seg" style="width:100%;position:static" id="rmSeg"><button data-rm="tv">التلفزيون</button><button data-rm="car" class="on">السيارة</button></div>
      <div class="panel" style="width:100%;margin:0"><div class="sub">شنو شغّال هسه</div><b id="rmT" style="font-size:18px;display:block;margin-top:4px">—</b><div class="sub" id="rmA"></div></div>
      <div class="keys" style="grid-template-columns:repeat(4,1fr)">
        <button class="key" data-ck="prev">${ic('right')}السابق</button><button class="key" data-ck="play" style="background:var(--ac);color:var(--onac)">${ic('play')}تشغيل/إيقاف</button>
        <button class="key" data-ck="next">${ic('left')}التالي</button><button class="key" data-ck="stop">${ic('power')}إيقاف</button></div>
      <div class="keys" style="grid-template-columns:repeat(3,1fr)"><button class="key" data-ck="vdn">${ic('down')}خفض الصوت</button><button class="key" data-ck="mute">${ic('mute')}كتم</button><button class="key" data-ck="vup">${ic('up')}رفع الصوت</button></div>
      <div class="keys"><button class="key" data-ck="back">${ic('ret')}رجوع</button><button class="key" data-ck="home">${ic('home')}الرئيسية</button><button class="key" data-ck="search">${ic('info')}بحث</button><button class="key" data-ck="menu">${ic('menu')}القائمة</button></div>
      <div class="keys" style="grid-template-columns:repeat(3,1fr)">${CAR_QUICK.map(([k, n]) => `<button class="key" data-cq="${k}">${ic(k === 'maps' ? 'layers' : k === 'music' ? 'play' : k === 'phone' ? 'chat' : k === 'mirror' ? 'screen' : k === 'camera' ? 'cam' : 'wifi')}${n}</button>`).join('')}</div>
      <button class="btn pri full" id="rmTouch">${ic('live')} شاشة السيارة باللمس</button>
      <button class="btn sec full" id="rmText">${ic('kb')} اكتب بالشاشة (للبحث)</button>`;
    pollMedia(); medTimer = setInterval(() => { if (cur === 'remote' && remoteMode === 'car') pollMedia(); else clearInterval(medTimer); }, 4000);
  }
  $('#remoteBody').onclick = carRemoteClick;
};
async function pollMedia() {
  if (!CONN.connected) return;
  if (typeof isDirect === 'function' && isDirect()) {
    try {
      const m = await dapi('media'), t = $('#rmT'), a = $('#rmA'); if (!t) return;
      if (m && m.ok && m.title) { t.textContent = m.title; a.textContent = [m.artist, m.app].filter(Boolean).join(' · ') + (m.playing ? ' · شغّال' : ' · متوقف'); }
      else { t.textContent = 'ماكو شي شغّال'; a.textContent = ''; }
    } catch (e) {}
    return;
  }
  try {
    const o = await sh("dumpsys media_session | grep -E 'package=|state=PlaybackState|description=' | head -40");
    let best = null, pkg = '', st = 0;
    o.split('\n').forEach(l => {
      const p = /package=([\w.]+)/.exec(l); if (p) pkg = p[1];
      const s = /state=PlaybackState \{state=(\d+)/.exec(l); if (s) st = +s[1];
      const d = /description=(.*)$/.exec(l); if (d && d[1].trim() && d[1].trim() !== 'null, null, null' && (!best || st === 3)) best = { pkg, st, d: d[1].split(',').map(x => x.trim()).filter(x => x && x !== 'null') };
    });
    const t = $('#rmT'), a = $('#rmA'); if (!t) return;
    if (best) { t.textContent = best.d[0] || '—'; a.textContent = (best.d[1] || '') + (best.st === 3 ? ' · شغّال' : ' · متوقف'); }
    else { t.textContent = 'ماكو شي شغّال'; a.textContent = ''; }
  } catch (e) {}
}
async function carRemoteClick(e) {
  const m = e.target.closest('[data-rm]'); if (m) { tap(); remoteMode = m.dataset.rm; renderRemote(); return; }
  if (remoteMode !== 'car') { const k = e.target.closest('[data-k]'); if (k) key(k.dataset.k); return; }
  if (!CONN.connected) return need();
  const k = e.target.closest('[data-ck]');
  if (k) { tap(); run('key', { code: CAR_KEYS[k.dataset.ck] }).then(() => setTimeout(pollMedia, 700)).catch(er => toast(errText(er))); return; }
  const q = e.target.closest('[data-cq]');
  if (q) {
    tap();
    const list = CAR_QUICK.find(x => x[0] === q.dataset.cq)[2];
    if (typeof isDirect === 'function' && isDirect()) {
      try {
        const apps = await tvAppList(), kind = q.dataset.cq;
        const re = kind === 'music' ? /(bt|bluetooth|بلوتوث).{0,14}(music|موسيق)|btmusic|a2dp/i : null;
        const hit = (re && apps.find(a => re.test(a.pkg + ' ' + a.label))) || apps.find(a => list.includes(a.pkg.split('/')[0]));
        if (!hit) return toast('ما لگيت التطبيق بالشاشة');
        const r = await dapi('launch', { pkg: hit.pkg }); toast(r && r.ok ? 'انفتح' : 'ما انفتح');
      } catch (er) { toast(errText(er)); }
      return;
    }
    try {
      const en = await sh('pm list packages -e'), p = list.find(x => en.includes('package:' + x));
      if (!p) return toast('ما لگيت التطبيق بالشاشة');
      await sh('monkey -p ' + p + ' -c android.intent.category.LAUNCHER 1'); toast('انفتح');
    } catch (er) { toast(errText(er)); }
    return;
  }
  if (e.target.closest('#rmTouch')) { B.live(true); return; }
  if (e.target.closest('#rmText')) { $('#kbBtn').onclick && $('#kbBtn').onclick(); }
}

/* live view: touch control on car screens */
openLive = function () { if (!need()) return; B.live(devType() === 'car'); };

/* ============================================================ home card + store */
const _renderHome = renderHome;
renderHome = function () {
  _renderHome();
  const tag = document.querySelector('#homeBody .tv .tag');
  if (tag) { tag.textContent = devTypeName() + ' ▾'; tag.style.cursor = 'pointer'; tag.onclick = ev => { ev.stopPropagation(); devTypeSheet(); }; }
  const add = $('#howBtn');
  if (add && !$('#carHow')) add.insertAdjacentHTML('afterend', `<button class="btn ghost full" id="carHow">${ic('info')} شلون أربط شاشة السيارة؟</button>`);
  const ch = $('#carHow'); if (ch) ch.onclick = howToCar;
  if (add && !$('#carStoreB')) $('#carHow').insertAdjacentHTML('afterend', `<button class="btn ghost full" id="carStoreB">${ic('apps')} متجر السيارة</button>`);
  const qk = document.querySelector('#homeBody .tv .quick');
  if (qk && devType() === 'car' && !$('#carStoreB')) {
    const br = devBrand();
    qk.insertAdjacentHTML('afterend', `<div class="row" style="margin-top:10px;position:relative"><button class="btn sec" id="carStoreB">${ic('apps')} متجر السيارة</button><button class="btn sec" id="carBrandB">${ic('layers')} ${br ? esc(br.name) : 'نوع السيارة'}</button></div>`);
    $('#carBrandB').onclick = ev => { ev.stopPropagation(); tap(); brandSheet(() => renderHome()); };
  }
  const cs = $('#carStoreB'); if (cs) cs.onclick = ev => { ev.stopPropagation(); tap(); openCarStore(); };
};
const CAR_STORE = [
  ['كاربلي وأندرويد أوتو وربط الموبايل', [
    ['زي لينك', 'ZLink', 'com.zjinnova.zlink', 'كاربلي وأندرويد أوتو (سلكي ولاسلكي) للشاشات اللي تدعمه'],
    ['هيد يونت ريلودد', 'Headunit Reloaded', 'gb.xxy.hr', 'يحوّل الشاشة الصينية لشاشة أندرويد أوتو حقيقية (مدفوع)'],
    ['أوتو كيت', 'AutoKit Carlinkit', '', 'ويّا دونگل كارلينكت: كاربلي وأندرويد أوتو لاسلكي'],
    ['إيزي كونكشن', 'EasyConnection', 'net.easyconn', 'يعرض شاشة الموبايل على الشاشة ويتحكم بيها'],
    ['تي لينك', 'TLink', '', 'عرض الموبايل على شاشة السيارة'],
    ['كاربت لينك', 'CarbitLink', '', 'عرض الموبايل بالواي فاي']]],
  ['الخرائط والطريق', [
    ['ويز', 'Waze', 'com.waze', 'خرائط وتنبيهات الزحمة والكاميرات'],
    ['خرائط گوگل', 'Google Maps', 'com.google.android.apps.maps', 'الملاحة والأماكن'],
    ['ساجك', 'Sygic GPS Navigation', 'com.sygic.aura', 'خرائط تشتغل بدون إنترنت'],
    ['هير وي گو', 'HERE WeGo', 'com.here.app.maps', 'خرائط مجانية تنزل للجهاز']]],
  ['الموسيقى والصوت', [
    ['سبوتيفاي', 'Spotify', 'com.spotify.music', 'موسيقى وبودكاست'],
    ['أنغامي', 'Anghami', 'com.anghami', 'موسيقى عربية'],
    ['يوتيوب ميوزك', 'YouTube Music', 'com.google.android.apps.youtube.music', 'أغاني يوتيوب بدون فيديو'],
    ['القرآن الكريم', 'Quran for Android', 'com.quran.labs.androidquran', 'مصحف وتلاوات'],
    ['راديو گاردن', 'Radio Garden', 'com.jonathanpuckey.radiogarden', 'إذاعات العالم مباشرة']]],
  ['فحص السيارة', [
    ['كار سكانر', 'Car Scanner ELM OBD2', 'com.ovz.carscanner', 'يقرا أعطال المحرك والحرارة ويّا قطعة OBD2'],
    ['تورك لايت', 'Torque Lite', 'org.prowl.torquefree', 'عدادات وأعطال المحرك ويّا قطعة OBD2']]]];
async function openCarStore() {
  let inst = '';
  if (CONN.connected) { busy('أشوف شنو منصّب بالشاشة…'); try { inst = await sh('pm list packages'); } catch (e) {} unbusy(); }
  const has = pk => pk && inst.includes('package:' + pk + '\n');
  inst += '\n';
  let n = 0; const flat = [];
  page('متجر السيارة', `<div class="panel"><h2>كاربلي وأندرويد أوتو بالشاشة الصينية</h2><p class="sub" style="margin:0">تشتغل بثلاث طرق: «زي لينك» إذا الشاشة تدعمه، أو «هيد يونت ريلودد» لأندرويد أوتو، أو دونگل «كارلينكت» صغير ويّا «أوتو كيت». جرّب الأول، وإذا ما مشى الدونگل هو الأضمن.</p></div>
    ${CAR_STORE.map(([cat, list]) => `<h2>${esc(cat)}</h2><div class="list">${list.map(x => { flat.push(x); const i = n++; return `<div class="item"><div class="fileic">${ic('apps')}</div><div class="t"><b>${esc(x[0])}</b><small>${esc(x[3])}</small></div>
      ${has(x[2]) ? `<button class="btn sec" style="min-height:38px" data-so="${i}">${ic('check')} افتح</button>` : `<button class="btn pri" style="min-height:38px" data-s="${i}">نصّب</button>`}</div>`; }).join('')}</div>`).join('')}
    <div class="panel"><h2>الشاشة ما بيها متجر گوگل؟</h2><p class="sub" style="margin:0">نزّل ملف التطبيق (APK) من موقعه الرسمي على موبايلك، وبعدين من «المزيد» ← «تثبيت تطبيق من الموبايل» يتنصّب على الشاشة.</p></div>`, el => {
    el.onclick = async e => {
      const o = e.target.closest('[data-so]');
      if (o) { const x = flat[+o.dataset.so]; tap(); try { await sh('monkey -p ' + x[2] + ' -c android.intent.category.LAUNCHER 1'); toast('انفتح بالشاشة'); } catch (er) { toast(errText(er)); } return; }
      const b = e.target.closest('[data-s]'); if (!b) return;
      const x = flat[+b.dataset.s]; tap();
      const q = encodeURIComponent(x[1]);
      if (!CONN.connected) { B.open(x[2] ? 'https://play.google.com/store/apps/details?id=' + x[2] : 'https://play.google.com/store/search?q=' + q + '&c=apps', ''); return; }
      try {
        const r = await sh(`am start -a android.intent.action.VIEW -d '${x[2] ? 'market://details?id=' + x[2] : 'market://search?q=' + q + '&c=apps'}' 2>&1`);
        if (/Error|unable|No Activity/i.test(r)) throw new Error('nomarket');
        toast('انفتح المتجر على الشاشة، نصّبه من هناك');
      } catch (er) {
        sheet(`<h2>الشاشة ما بيها متجر</h2><p class="sub">نزّل «${esc(x[0])}» على موبايلك من موقعه الرسمي كملف APK، وبعدين نصّبه على الشاشة من «تثبيت تطبيق من الموبايل».</p>
          <button class="btn pri full" id="csPh">افتح صفحته بموبايلي</button>`);
        $('#csPh').onclick = () => { closeSheet(); B.open('https://play.google.com/store/' + (x[2] ? 'apps/details?id=' + x[2] : 'search?q=' + q + '&c=apps'), ''); };
      }
    };
  });
}
const _openStore = openStore;
openStore = function () { if (CONN.connected && devType() === 'car') return openCarStore(); return _openStore(); };

/* keep the tab renderers pointing at the new versions */
RENDER.home = renderHome;
RENDER.remote = renderRemote;
/* A design of the other kind: ask, switch the device type, then carry on (never a dead end). */
function typeMismatch(isCarDesign, retry) {
  if (!CONN.connected) return false;
  const car = devType() === 'car';
  if (!!isCarDesign === car) return false;
  sheet(`<h2>${isCarDesign ? 'هذي واجهة سيارة' : 'هذي واجهة تلفزيون'}</h2>
    <p class="sub">${esc(tvName())} مسجّل هسه «${esc(devTypeName())}». ${isCarDesign ? 'إذا هو فعلاً شاشة سيارة حوّله وأطبّقها.' : 'إذا هو تلفزيون أو بوكس حوّله وأطبّق الواجهة، والشاشة ترجع لواجهة التلفزيون.'}</p>
    <button class="btn pri full" id="tmGo">${ic('tv')} ${isCarDesign ? 'إي، شاشة سيارة. طبّقها' : 'إي، هذا تلفزيون. طبّقها'}</button><div style="height:8px"></div>
    ${isCarDesign ? '' : `<button class="btn sec full" id="tmBox">هذا بوكس أو ستيك. طبّقها</button><div style="height:8px"></div>`}
    <button class="btn ghost full" id="tmNo">إلغاء</button>`);
  const go = t => { closeSheet(); kvSet('devType_' + (CONN.host || 'none'), t); const l = devices(), d = l.find(x => x.host === CONN.host); if (d) { d.type = t; kvSet('devices', l); } retry && retry(); };
  $('#tmGo').onclick = () => go(isCarDesign ? 'car' : (INFO && INFO.isTv ? 'tv' : 'tv'));
  const bx = $('#tmBox'); if (bx) bx.onclick = () => go('box');
  $('#tmNo').onclick = closeSheet;
  return true;
}
const _applyToTv2 = applyToTv;
applyToTv = async function (cfg) { if (typeMismatch(cfg && cfg.mode === 'car', () => applyToTv(cfg))) return; return _applyToTv2(cfg); };
const _installFromGallery2 = installFromGallery;
installFromGallery = async function (x) { if (typeMismatch((x.tags || []).includes('السيارة'), () => installFromGallery(x))) return; return _installFromGallery2(x); };
const _openGallery = openGallery;
openGallery = function (force) { if (CONN.connected && devType() === 'car' && galTag === 'الكل') galTag = 'السيارة'; return _openGallery(force); };
