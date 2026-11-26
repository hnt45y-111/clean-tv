import { $, $$, esc, call, run, toast, confirmBox, icon, actions, fileUrl } from '../util.js';
import { S, setSetting, refreshState, refreshDevices, emit } from '../state.js';
import { PRESETS } from '../bg.js';

const TABS = [['printer', 'الطابعة'], ['scanner', 'السكانر'], ['save', 'الحفظ والتصدير'], ['general', 'عام'], ['bg', 'خلفية اللوحة الرئيسية']];
let tab = 'printer';

export async function mount(root) {
  const redraw = () => draw(); S.listeners.add(redraw);
  const opt = (arr, cur) => arr.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`).join('');
  const sel = (key, label, arr) => `<label class="f">${label}<select data-set="${key}">${opt(arr, key.split('.').reduce((o, k) => o[k], S.settings))}</select></label>`;
  const chk = (key, label) => `<label class="chk"><input type="checkbox" data-set="${key}" ${key.split('.').reduce((o, k) => o[k], S.settings) ? 'checked' : ''}> ${label}</label>`;
  const num = (key, label, min, max) => `<label class="f">${label}<input type="number" data-set="${key}" min="${min}" max="${max}" value="${key.split('.').reduce((o, k) => o[k], S.settings)}"></label>`;
  const paper = [['A4', 'A4'], ['A5', 'A5'], ['Letter', 'Letter'], ['Legal', 'Legal']];

  function printerTab() {
    const P = S.printers || { list: [] }; const sel0 = S.settings.printer.name;
    return `<div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="ref-dev">${icon('refresh')} تحديث قائمة الطابعات</button><span class="sub">الطابعة المفضّلة الحالية: <b>${esc(sel0 || 'لا شيء')}</b></span></div>
      ${P.error ? `<div class="card empty">${esc(P.error)}</div>` : !P.list.length ? '<div class="card empty">لا توجد طابعات مثبّتة في Windows.</div>' : `<div class="col">${P.list.map((p, i) => `<div class="printer-i ${p.name === sel0 ? 'on' : ''}" data-act="pick-printer" data-i="${i}">${icon('printer')}<div class="grow"><b>${esc(p.name)}</b><div class="sub" style="font-size:12px">${esc(p.driver)} · ${esc(p.port)}</div></div><span class="pill ${p.state === 'ready' || p.state === 'busy' ? 'ok' : p.state === 'offline' ? 'bad' : 'warn'}">${esc(p.statusText)}</span>${p.name === sel0 ? '<span class="pill ok">مفضّلة</span>' : ''}</div>`).join('')}</div>`}`;
  }
  function scannerTab() {
    const C = S.scanners || { list: [] }; const cur = S.settings.scanner.id;
    return `<div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="ref-dev">${icon('refresh')} تحديث قائمة الأجهزة</button></div>
      ${C.error ? `<div class="card empty">${esc(C.error)}</div>` : !C.list.length ? '<div class="card empty">لم يُعثر على سكانر متصل. تأكد من التشغيل والتعريف (WIA).</div>' : `<div class="col">${C.list.map((s, i) => `<div class="printer-i ${s.id === cur ? 'on' : ''}" data-act="pick-scanner" data-i="${i}">${icon('scan')}<div class="grow"><b>${esc(s.name || s.id)}</b></div><span class="pill ${s.ready ? 'ok' : 'bad'}">${s.ready ? 'جاهز' : esc(s.errorText || 'غير متصل')}</span></div>`).join('')}</div>`}
      <h3 style="margin:18px 0 10px">خيارات المسح الافتراضية</h3>
      <div class="set-grid">${num('scan.dpi', 'الدقة الافتراضية (DPI)', 75, 1200)}${sel('scan.color', 'وضع اللون', [['color', 'ألوان كاملة'], ['gray', 'تدرّج رمادي'], ['bw', 'أبيض وأسود']])}${sel('scan.paper', 'حجم الورقة', paper)}${sel('scan.orientation', 'اتجاه المسح', [['portrait', 'طولي'], ['landscape', 'عرضي']])}</div>
      <p class="sub" style="margin-top:10px">يتصل البرنامج بالسكانر عبر واجهة Windows القياسية (WIA). الأجهزة التي تعمل بتعريف TWAIN فقط قد لا تظهر هنا.</p>`;
  }
  function saveTab() {
    const s = S.settings;
    return `<div class="card" style="margin-bottom:14px"><h3 style="margin-bottom:10px">مكان الحفظ والصيغة الافتراضية</h3><div class="row"><div class="inp grow" style="direction:ltr;text-align:right">${esc(s.save.dir || 'لم يُحدَّد بعد — يُحدَّد عند أول تصدير')}</div><button class="btn sm" data-act="pick-dir">${s.save.dir ? 'تغيير مكان الحفظ' : 'اختيار مكان الحفظ'}</button></div>
      <div class="set-grid" style="margin-top:12px">${sel('save.format', 'صيغة التصدير الافتراضية', [['pdf', 'PDF'], ['docx', 'Word'], ['jpg', 'JPG'], ['png', 'PNG']])}</div></div>
      <div class="set-grid"><div class="card"><h3 style="margin-bottom:10px">الصور</h3><div class="col">${sel('image.format', 'الصيغة', [['jpg', 'JPG'], ['png', 'PNG']])}${sel('image.dpi', 'الدقة', [72, 150, 200, 300, 600].map((d) => [d, d + ' DPI']))}${num('image.quality', 'الجودة %', 10, 100)}${sel('image.color', 'اللون', [['color', 'ملوّن'], ['gray', 'رمادي'], ['bw', 'أبيض وأسود']])}</div></div>
      <div class="card"><h3 style="margin-bottom:10px">PDF</h3><div class="col">${sel('pdf.pageSize', 'حجم الصفحة', [['A4', 'A4'], ['A3', 'A3'], ['A5', 'A5'], ['Letter', 'Letter'], ['Legal', 'Legal'], ['fit', 'بحجم الصورة']])}${sel('pdf.orientation', 'الاتجاه', [['portrait', 'طولي'], ['landscape', 'عرضي']])}${num('pdf.quality', 'جودة الصور %', 10, 100)}${chk('pdf.multiPage', 'ملف واحد متعدد الصفحات')}</div></div>
      <div class="card"><h3 style="margin-bottom:10px">Word</h3><div class="col">${sel('word.pageSize', 'حجم الصفحة', [['A4', 'A4'], ['A3', 'A3'], ['A5', 'A5'], ['Letter', 'Letter'], ['Legal', 'Legal']])}${sel('word.orientation', 'الاتجاه', [['portrait', 'طولي'], ['landscape', 'عرضي']])}${chk('word.rtl', 'اتجاه عربي (يمين ← يسار) افتراضياً')}${sel('word.font', 'الخط الافتراضي', ['Arial', 'Tahoma', 'Times New Roman', 'Traditional Arabic', 'Simplified Arabic', 'Calibri'].map((f) => [f, f]))}${num('word.fontSize', 'حجم الخط', 6, 72)}${chk('word.editable', 'مستند قابل للتحرير (OCR)')}${chk('word.keepLayout', 'الحفاظ على التخطيط قدر الإمكان')}</div></div></div>
      <div class="card" style="margin-top:14px"><h3 style="margin-bottom:10px">الأرشيف</h3><div class="row"><div class="inp grow" style="direction:ltr;text-align:right">${esc(s.archive.dir || 'المستندات\\Print Studio\\Archive (افتراضي)')}</div><button class="btn sm" data-act="pick-arch">تغيير مكان الأرشيف</button></div></div>`;
  }
  function generalTab() {
    return `<div class="set-grid"><div class="card col">${sel('general.language', 'لغة الواجهة', [['ar', 'العربية']])}${sel('general.theme', 'المظهر', [['dark', 'داكن (افتراضي)'], ['darker', 'داكن جداً']])}${chk('general.animations', 'تفعيل الحركات والانتقالات')}${chk('general.startOnBoot', 'تشغيل البرنامج عند بدء Windows')}</div>
      <div class="card col"><h3>استعادة الإعدادات</h3><p class="sub">يعيد مظهر التطبيق (المظهر والحركات والخلفية) إلى الوضع الافتراضي دون المساس بالطابعة أو السكانر أو مكان الحفظ.</p><button class="btn red sm" data-act="reset-look">استعادة المظهر الافتراضي</button></div></div>`;
  }
  function bgTab() {
    const b = S.settings.background;
    return `<div class="card"><p class="sub" style="margin-top:0">تُطبَّق الخلفية على <b>اللوحة الرئيسية فقط</b>؛ باقي الصفحات تحتفظ بتصميمها الخاص.</p>
      <div class="row" style="margin-bottom:14px"><button class="btn" data-act="bg-img">${icon('img')} اختيار صورة من الجهاز</button><button class="btn ghost" data-act="bg-none" ${b.mode === 'default' ? 'disabled' : ''}>إزالة الخلفية والعودة للتصميم الافتراضي</button><span class="pill">${b.mode === 'image' ? 'صورة مخصّصة' : b.mode === 'preset' ? 'خلفية جاهزة' : 'الافتراضية'}</span></div>
      <h3 style="margin-bottom:8px">خلفيات جاهزة</h3><div class="bg-presets">${PRESETS.map((p) => `<div class="bg-p ${b.mode === 'preset' && b.preset === p.id ? 'on' : ''}" style="background:${p.css}" data-act="bg-preset" data-id="${p.id}" role="button" tabindex="0"><span>${esc(p.name)}</span></div>`).join('')}</div>
      <div class="grid2" style="margin-top:16px"><label class="f">السطوع <b id="bv">${b.brightness}%</b><input type="range" min="20" max="150" value="${b.brightness}" data-bg="brightness"></label><label class="f">الشفافية (الكثافة) <b id="ov">${b.opacity}%</b><input type="range" min="10" max="100" value="${b.opacity}" data-bg="opacity"></label></div>
      <div class="sub" style="margin-top:8px">يُضاف تعتيم تلقائي فوق الصور المخصّصة للحفاظ على وضوح النصوص.</div></div>`;
  }
  function draw() {
    const body = { printer: printerTab, scanner: scannerTab, save: saveTab, general: generalTab, bg: bgTab }[tab]();
    root.innerHTML = `<div class="page-h"><span class="tag">⚙</span><h1>الإعدادات</h1></div><div class="tabs">${TABS.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-act="tab" data-t="${k}">${l}</button>`).join('')}</div><div id="tb">${body}</div>`;
    $$('[data-set]', root).forEach((el) => (el.onchange = () => run(null, async () => { const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value; await setSetting({ [el.dataset.set]: v }); if (el.dataset.set === 'general.startOnBoot') await call('startupApply', v).catch(() => {}); toast('تم حفظ الإعداد', 'ok'); })));
    $$('[data-bg]', root).forEach((el) => { el.oninput = () => { $(el.dataset.bg === 'brightness' ? '#bv' : '#ov', root).textContent = el.value + '%'; }; el.onchange = () => run(null, () => setSetting({ ['background.' + el.dataset.bg]: +el.value })); });
  }
  actions(root, {
    tab: (b) => { tab = b.dataset.t; draw(); },
    'ref-dev': (b) => run(b, async () => { await refreshDevices(); toast('تم تحديث الأجهزة', 'ok'); }),
    'pick-printer': (b) => run(null, async () => { const p = S.printers.list[+b.dataset.i]; await call('printerSelect', p.name); await refreshState(); await refreshDevices(); toast('الطابعة المفضّلة: ' + p.name, 'ok'); }),
    'pick-scanner': (b) => run(null, async () => { const s = S.scanners.list[+b.dataset.i]; await call('scannerSelect', s.id, s.name); await refreshState(); await refreshDevices(); toast('السكانر المفضّل: ' + s.name, 'ok'); }),
    'pick-dir': (b) => run(b, async () => { const d = await call('folderPick', true); if (d) { await refreshState(); emit(); toast('مكان الحفظ الجديد محفوظ', 'ok'); } }),
    'pick-arch': (b) => run(b, async () => { const d = await call('archiveDirPick'); if (d) { await refreshState(); emit(); toast('تم تغيير مكان الأرشيف', 'ok'); } }),
    'bg-img': (b) => run(b, async () => { const r = await call('bgImport'); await refreshState(); emit(); if (r && r.mode === 'image') toast('تم تطبيق الخلفية على اللوحة الرئيسية', 'ok'); }),
    'bg-none': (b) => run(b, async () => { await call('bgClear'); await refreshState(); emit(); toast('عادت الخلفية الافتراضية', 'ok'); }),
    'bg-preset': (b) => run(null, async () => { await setSetting({ 'background.mode': 'preset', 'background.preset': b.dataset.id }); }),
    'reset-look': async () => { if (await confirmBox('استعادة المظهر الافتراضي؟', 'استعادة')) { await call('bgClear'); await call('settingsReset', 'general'); await refreshState(); emit(); toast('تمت استعادة المظهر الافتراضي', 'ok'); } },
  });
  draw(); if (!S.printers) refreshDevices();
  return () => S.listeners.delete(redraw);
}
