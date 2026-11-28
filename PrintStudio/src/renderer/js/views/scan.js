import { $, $$, esc, call, run, toast, modal, confirmBox, icon, actions, fileUrl, fmtDate, loading } from '../util.js';
import { S, refreshPages, refreshDevices, setSetting, refreshState, emit } from '../state.js';
import { scannerArt } from '../art.js';
import { applyBackground } from '../bg.js';
import { openExportDialog } from '../export-dialog.js';
import { pdfToImages } from '../pdfjs.js';
import { go } from '../main.js';

export async function mount(root) {
  let sel = null, scanning = false, cropMode = false, crop = null, dragId = null;
  let lastSig = '';
  const sig = () => JSON.stringify([S.pages.map((p) => p.id + ':' + p.v), S.settings, S.scanners && [S.scanners.selectedAvailable, S.scanners.error], S.printers && [S.printers.selectedAvailable, S.printers.error], scanning, sel, cropMode]);
  const redraw = () => { if (sig() === lastSig) return; draw(); };
  await refreshPages(); if (S.pages.length) sel = S.pages[0].id;

  const devInfo = () => {
    const sc = S.settings.scanner, pr = S.settings.printer; const scOk = S.scanners && !S.scanners.error && S.scanners.selectedAvailable;
    return { sc, pr, scOk, scErr: S.scanners && S.scanners.error, prOk: S.printers && !S.printers.error && S.printers.selectedAvailable };
  };
  const colorName = { color: 'ألوان كاملة', gray: 'تدرّج رمادي', bw: 'أبيض وأسود' };

  async function draw() {
    lastSig = sig();
    const st = S.settings, d = devInfo(), pages = S.pages;
    const hist = await call('history', 6).catch(() => []);
    root.innerHTML = `<div class="dash-wrap"><div class="dash-bg" id="bg"></div><div class="dash-scrim" id="scrim"></div><div class="dash-in">
      <div class="top-bar">
        ${pages.length ? `<button class="btn lg green" data-act="another" style="font-size:20px;padding:12px 28px" ${scanning ? 'disabled' : ''}>${icon('plus')} مسح صفحة أخرى +</button>
        <button class="btn lg" data-act="export" style="font-size:18px;padding:12px 24px">${icon('save')} حفظ وتصدير</button>
        <button class="btn purple" data-act="ocr">${icon('ocr')} التعرف الذكي</button>` : ''}
        <span class="grow"></span>
        ${pages.length ? `<span class="pill">${pages.length} صفحة</span><button class="btn ghost sm" data-act="clear">${icon('trash')} مسح الكل</button>` : ''}
        <button class="btn ghost sm" data-act="import">${icon('folder')} استيراد صور / PDF</button>
        <button class="btn ghost sm" data-act="scanner-pick">${icon('scan')} اختيار السكانر</button>
      </div>
      ${pages.length ? workspace() : hero(d, hist)}
    </div></div>`;
    applyBackground($('#bg', root), $('#scrim', root), st.background, (f) => fileUrl(f, st.background.file.length));
    if (pages.length) afterWorkspace();
    $$('[data-set]', root).forEach((x) => (x.onchange = () => setSetting({ [x.dataset.set]: isNaN(+x.value) ? x.value : +x.value })));
  }

  function hero(d, hist) {
    const st = S.settings;
    return `<div class="hero"><div class="col" style="gap:16px">
        <div><span class="pill warn" style="margin-bottom:8px">PRINT STUDIO</span><h1>حوّل أوراقك إلى <em>مستندات رقمية</em> قابلة للتحرير</h1>
        <p class="sub" style="font-size:16px">امسح صفحة أو عدة صفحات، ثم احفظها PDF أو Word أو صورة — أو حوّلها إلى Word وExcel قابلين للتعديل.</p></div>
        <div class="row"><button class="btn btn-start" data-act="start">${icon('scan')} ابدأ السكانر</button><button class="btn lg ghost" data-act="copy" title="مسح الورقة وطباعتها مباشرة">${icon('printer')} نسخ سريع</button></div>
        <div class="card halftone" style="padding:12px"><div class="row" style="gap:12px">
          <label class="f">دقة المسح<select data-set="scan.dpi">${[75, 100, 150, 200, 300, 600, 1200].map((d) => `<option ${d === st.scan.dpi ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label class="f">اللون<select data-set="scan.color">${Object.entries(colorName).map(([k, v]) => `<option value="${k}" ${k === st.scan.color ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="f">حجم الورقة<select data-set="scan.paper">${['A4', 'A5', 'Letter', 'Legal'].map((d) => `<option ${d === st.scan.paper ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label class="f">الاتجاه<select data-set="scan.orientation"><option value="portrait" ${st.scan.orientation === 'portrait' ? 'selected' : ''}>طولي</option><option value="landscape" ${st.scan.orientation === 'landscape' ? 'selected' : ''}>عرضي</option></select></label></div></div>
        ${!st.scanner.id ? `<div class="pill warn">لم يُحدَّد سكانر بعد — اضغط «اختيار السكانر»</div>` : d.scErr ? `<div class="pill bad">${esc(d.scErr)}</div>` : ''}
      </div><div>${scannerArt}</div></div>
      <div class="info-cards">
        <div class="card info halftone"><div class="ico">${icon('scan')}</div><div><small>السكانر</small><b>${esc(st.scanner.name || 'غير محدد')}</b><span class="pill ${d.scOk ? 'ok' : st.scanner.id ? 'bad' : 'warn'}">${d.scOk ? 'جاهز' : st.scanner.id ? (S.scanners ? 'غير متصل' : 'جارٍ الفحص…') : 'لم يُختر'}</span></div></div>
        <div class="card info halftone"><div class="ico">${icon('printer')}</div><div><small>الطابعة</small><b>${esc(st.printer.name || 'غير محددة')}</b><span class="pill ${d.prOk ? 'ok' : st.printer.name ? 'bad' : 'warn'}">${d.prOk ? 'متصلة' : st.printer.name ? 'غير متاحة' : 'لم تُختر'}</span></div></div>
        <div class="card info halftone"><div class="ico">${icon('eye')}</div><div><small>دقة المسح</small><b><bdi dir="ltr">${st.scan.dpi} DPI</bdi></b></div></div>
        <div class="card info halftone"><div class="ico">${icon('img')}</div><div><small>وضع اللون</small><b>${colorName[st.scan.color]}</b></div></div>
      </div>
      <div class="quick">
        <button class="q" data-go="ids">${icon('id')}<span>سكانر الهويات والباجات</span></button>
        <button class="q" data-go="ocr">${icon('ocr')}<span>التعرف الذكي على الملفات</span></button>
        <button class="q" data-go="pdf">${icon('pdf')}<span>أدوات PDF</span></button>
        <button class="q" data-go="print">${icon('printer')}<span>مركز الطباعة</span></button>
        <button class="q" data-go="archive">${icon('archive')}<span>الأرشيف</span></button>
        <button class="q" data-go="settings">${icon('gear')}<span>الإعدادات</span></button>
      </div>
      <div class="card halftone"><h3 style="margin-bottom:8px">آخر العمليات</h3>${hist.length ? `<table class="t"><tbody>${hist.map((h) => `<tr><td style="width:28px">${h.ok ? '✅' : '⚠️'}</td><td>${esc(histName(h.action))}</td><td class="sub" style="direction:ltr;text-align:start">${esc(h.detail)}</td><td class="sub" style="white-space:nowrap">${esc(fmtDate(h.created))}</td></tr>`).join('')}</tbody></table>` : '<div class="sub">لا توجد عمليات بعد.</div>'}</div>`;
  }
  const histName = (a) => ({ scan: 'مسح', export: 'تصدير', ocr: 'تعرّف ذكي', import: 'استيراد', printer: 'اختيار طابعة' }[a] || a);

  function workspace() {
    const st = S.settings, i = Math.max(0, S.pages.findIndex((p) => p.id === sel)), pg = S.pages[i] || S.pages[0];
    return `<div class="ws"><div class="thumbs card" id="thumbs">${S.pages.map((p, k) => `<div class="th ${p.id === sel ? 'sel' : ''}" draggable="true" data-id="${p.id}" title="اسحب لإعادة الترتيب"><span class="n">${k + 1}</span><img src="${fileUrl(p.thumb, p.v)}" alt="صفحة ${k + 1}"></div>`).join('')}</div>
      <div class="preview"><div class="canvas-box" id="cbox">
        ${cropMode ? `<div class="crop-wrap" id="cw"><img id="pimg" src="${fileUrl(pg.file, pg.v)}"><div class="crop-rect" id="cr"></div></div>` : `<img id="pimg" src="${fileUrl(pg.file, pg.v)}" alt="معاينة">`}
        ${scanning ? `<div class="scanning"><div class="beam"></div><div class="col" style="align-items:center"><div class="progress ind" style="width:260px"><i></i></div><b>جارٍ المسح…</b><span class="sub">لا تحرّك الورقة حتى يكتمل</span></div></div>` : ''}
      </div>
      <div class="row"><span class="pill">الصفحة ${i + 1} من ${S.pages.length}</span><span class="sub">${pg.width}×${pg.height} بكسل</span><span class="grow"></span>
        <button class="btn sm ghost" data-act="preview-all">${icon('eye')} معاينة المستند كاملاً</button></div></div>
      <div class="sidepanel"><div class="card"><h3 style="margin-bottom:10px">أدوات الصفحة</h3>
        <div class="tools"><button class="btn sm ghost" data-act="rot-l">${icon('rot')} يسار</button><button class="btn sm ghost" data-act="rot-r">${icon('rot')} يمين</button>
        <button class="btn sm ghost" data-act="rot-180">قلب 180°</button>
        ${cropMode ? `<button class="btn sm green" data-act="crop-ok">${icon('check')} تطبيق القص</button><button class="btn sm ghost" data-act="crop-cancel">إلغاء</button>` : `<button class="btn sm ghost" data-act="crop">${icon('crop')} قص</button>`}
        <button class="btn sm ghost" data-act="autocrop">${icon('wand')} حدود تلقائية</button><button class="btn sm ghost" data-act="deskew">تعديل الميلان</button></div>
        <div class="col" style="margin-top:12px"><label class="f">السطوع <span id="bv">0</span><input type="range" id="bri" min="-60" max="60" value="0"></label>
        <label class="f">التباين <span id="cv">0</span><input type="range" id="con" min="-60" max="60" value="0"></label>
        <button class="btn sm" data-act="adjust">تطبيق السطوع/التباين</button></div></div>
        <div class="card"><div class="row"><button class="btn sm purple" data-act="rescan">${icon('scan')} إعادة مسح هذه الصفحة</button><button class="btn sm red" data-act="delete">${icon('trash')} حذف الصفحة</button></div></div>
        <div class="card"><h3 style="margin-bottom:8px">خيارات المسح</h3><div class="col">
          <label class="f">الدقة<select data-set="scan.dpi">${[100, 150, 200, 300, 600, 1200].map((d) => `<option ${d === st.scan.dpi ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label class="f">اللون<select data-set="scan.color">${Object.entries(colorName).map(([k, v]) => `<option value="${k}" ${k === st.scan.color ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div></div></div></div>`;
  }

  function afterWorkspace() {
    const th = $('#thumbs', root);
    $$('.th', th).forEach((el) => {
      el.onclick = () => { sel = el.dataset.id; cropMode = false; draw(); };
      el.ondragstart = (e) => { dragId = el.dataset.id; el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); };
      el.ondragend = () => { el.classList.remove('drag'); $$('.th', th).forEach((x) => x.classList.remove('drop')); };
      el.ondragover = (e) => { e.preventDefault(); el.classList.add('drop'); };
      el.ondragleave = () => el.classList.remove('drop');
      el.ondrop = async (e) => { e.preventDefault(); const to = el.dataset.id; if (!dragId || dragId === to) return; const order = S.pages.map((p) => p.id); order.splice(order.indexOf(dragId), 1); order.splice(order.indexOf(to), 0, dragId); await run(null, async () => { S.pages = await call('pagesReorder', order); emit(); }); };
    });
    const b = $('#bri', root), c = $('#con', root); if (b) { b.oninput = () => ($('#bv', root).textContent = b.value); c.oninput = () => ($('#cv', root).textContent = c.value); }
    if (cropMode) initCrop();
  }

  function initCrop() {
    const img = $('#pimg', root), cw = $('#cw', root), cr = $('#cr', root); crop = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
    const place = () => { cr.style.left = crop.x * 100 + '%'; cr.style.top = crop.y * 100 + '%'; cr.style.width = crop.w * 100 + '%'; cr.style.height = crop.h * 100 + '%'; };
    ['nw', 'ne', 'sw', 'se'].forEach((k) => { const h = document.createElement('div'); h.className = 'crop-h'; h.dataset.k = k; h.style.cssText = `${k[0] === 'n' ? 'top' : 'bottom'}:-7px;${k[1] === 'w' ? 'left' : 'right'}:-7px;cursor:${k === 'nw' || k === 'se' ? 'nwse' : 'nesw'}-resize`; cr.append(h); });
    const start = (e, mode, k) => { e.preventDefault(); e.stopPropagation(); const r = cw.getBoundingClientRect(), o = { ...crop }, sx = e.clientX, sy = e.clientY;
      const mv = (ev) => { const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height; let { x, y, w, h } = o;
        if (mode === 'move') { x = Math.min(1 - w, Math.max(0, x + dx)); y = Math.min(1 - h, Math.max(0, y + dy)); }
        else { if (k[1] === 'w') { const nx = Math.min(x + w - 0.05, Math.max(0, x + dx)); w += x - nx; x = nx; } else w = Math.min(1 - x, Math.max(0.05, w + dx)); if (k[0] === 'n') { const ny = Math.min(y + h - 0.05, Math.max(0, y + dy)); h += y - ny; y = ny; } else h = Math.min(1 - y, Math.max(0.05, h + dy)); }
        crop = { x, y, w, h }; place(); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
    cr.onpointerdown = (e) => start(e, e.target.dataset.k ? 'resize' : 'move', e.target.dataset.k); place(); void img;
  }

  async function doScan(replaceId) {
    if (scanning) return; if (!S.settings.scanner.id) { await pickScanner(); if (!S.settings.scanner.id) return; }
    scanning = true; draw();
    try { const before = S.pages.length; S.pages = await call('scan', { replaceId }); if (!replaceId) sel = S.pages[S.pages.length - 1].id; toast(replaceId ? 'أُعيد مسح الصفحة' : `تم مسح الصفحة ${S.pages.length}`, 'ok'); void before; }
    catch (e) { toast(e.message, 'err', [{ label: 'إعادة المحاولة', fn: () => doScan(replaceId) }, { label: 'اختيار سكانر آخر', fn: pickScanner }]); }
    finally { scanning = false; emit(); refreshDevices(); }
  }

  async function pickScanner() {
    return new Promise((resolve) => {
      const m = modal(`<h2>🖨️ اختيار السكانر</h2><div id="sl" class="col"><div class="progress ind"><i></i></div></div><div class="foot"><button class="btn ghost" id="sr">${icon('refresh')} إعادة الفحص</button><button class="btn ghost" id="sc">إغلاق</button></div>`);
      const load = async () => { const box = $('#sl', m); box.innerHTML = '<div class="progress ind"><i></i></div>';
        try { const r = await call('scanners'); S.scanners = r; emit();
          box.innerHTML = r.list.length ? r.list.map((s, i) => `<div class="printer-i ${S.settings.scanner.id === s.id ? 'on' : ''}" data-i="${i}" role="button" tabindex="0">${icon('scan')}<div class="grow"><b>${esc(s.name || s.id)}</b></div><span class="pill ${s.ready ? 'ok' : 'bad'}">${s.ready ? 'جاهز' : esc(s.errorText || 'غير متصل')}</span></div>`).join('')
            : `<div class="card empty">لم يُعثر على أي سكانر متصل.<br><span class="sub">تأكد من تشغيل الجهاز وتوصيله وتثبيت تعريفه (WIA) ثم أعد الفحص.</span></div>`;
          $$('.printer-i', box).forEach((el) => (el.onclick = async () => { const s = r.list[+el.dataset.i]; await call('scannerSelect', s.id, s.name); await refreshState(); await refreshDevices(); m.close(); resolve(); toast('تم اختيار السكانر: ' + s.name, 'ok'); }));
        } catch (e) { box.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; } };
      $('#sr', m).onclick = load; $('#sc', m).onclick = () => { m.close(); resolve(); }; load();
    });
  }

  async function importFiles() {
    const files = await call('pickPrintable'); if (!files.length) return; const pdfs = files.filter((f) => /\.pdf$/i.test(f)), imgs = files.filter((f) => !/\.pdf$/i.test(f));
    const lo = loading('جارٍ الاستيراد…');
    try { if (imgs.length) await call('pagesImportPaths', imgs);
      for (const f of pdfs) { const bytes = await call('readFile', f); const out = await pdfToImages(bytes, { dpi: 200, onProgress: (i, n) => lo.set(`صفحة ${i} من ${n}`) }); S.pages = await call('pagesAddBuffers', out.map((o) => o.buf)); }
      S.pages = await call('pagesList'); sel = S.pages.at(-1)?.id; emit(); toast('تم الاستيراد', 'ok'); }
    finally { lo.close(); }
  }

  actions(root, {
    start: (b) => run(b, () => doScan()), another: (b) => run(b, () => doScan()), rescan: (b) => run(b, () => doScan(sel)),
    'scanner-pick': pickScanner,
    copy: (b) => run(b, async () => {
      if (!S.settings.scanner.id) { await pickScanner(); if (!S.settings.scanner.id) return; }
      if (!S.settings.printer.name) throw new Error('اختر طابعة أولاً من: إدارة الطابعات');
      const m = modal(`<h2>${icon('printer')} نسخ سريع</h2><label class="f">عدد النسخ<input type="number" id="cn" min="1" max="99" value="1"></label><p class="sub">ضع الورقة على السكانر ثم اضغط «ابدأ النسخ». الطابعة: ${esc(S.settings.printer.name)}</p><div class="foot"><button class="btn green" id="cg">ابدأ النسخ</button><button class="btn ghost" id="cx">إلغاء</button></div>`);
      $('#cx', m).onclick = () => m.close();
      $('#cg', m).onclick = (ev) => run(ev.currentTarget, async () => { const n = +$('#cn', m).value || 1; m.close(); const lo = loading('جارٍ المسح ثم الطباعة…'); try { await call('copyQuick', { copies: n }); toast('أُرسل النسخ إلى الطابعة', 'ok'); } finally { lo.close(); } });
    }),
    export: () => openExportDialog({ ids: S.pages.map((p) => p.id) }),
    ocr: () => { sessionStorage.setItem('ocr-from-pages', '1'); go('ocr'); },
    import: (b) => run(b, importFiles),
    clear: async () => { if (await confirmBox('حذف كل الصفحات الممسوحة؟', 'حذف الكل', true)) { S.pages = await call('pagesClear'); sel = null; emit(); } },
    'rot-l': (b) => run(b, async () => { await call('pageRotate', sel, -90); await refreshPages(); }), 'rot-r': (b) => run(b, async () => { await call('pageRotate', sel, 90); await refreshPages(); }), 'rot-180': (b) => run(b, async () => { await call('pageRotate', sel, 180); await refreshPages(); }),
    crop: () => { cropMode = true; draw(); }, 'crop-cancel': () => { cropMode = false; draw(); },
    'crop-ok': (b) => run(b, async () => { await call('pageCrop', sel, crop); cropMode = false; await refreshPages(); }),
    autocrop: (b) => run(b, async () => { const r = await call('pageAutoCrop', sel); await refreshPages(); toast(r.changed ? 'تم قص الحدود تلقائياً' : 'لم يُعثر على حدود واضحة للورقة', r.changed ? 'ok' : 'warn'); }),
    deskew: (b) => run(b, async () => { const r = await call('pageDeskew', sel); await refreshPages(); toast(r.angle ? `تم تعديل الميلان (${r.angle.toFixed(1)}°)` : 'الصفحة مستقيمة', 'ok'); }),
    adjust: (b) => run(b, async () => { await call('pageAdjust', sel, { brightness: +$('#bri', root).value, contrast: +$('#con', root).value }); await refreshPages(); }),
    delete: async () => { if (await confirmBox('حذف هذه الصفحة؟', 'حذف', true)) { const idx = S.pages.findIndex((p) => p.id === sel); S.pages = await call('pagesRemove', [sel]); sel = (S.pages[Math.min(idx, S.pages.length - 1)] || {}).id; emit(); } },
    'preview-all': () => { const m = modal(`<h2>${icon('eye')} معاينة المستند (${S.pages.length} صفحة)</h2><div class="pv-pages">${S.pages.map((p, k) => `<div class="col" style="align-items:center"><img src="${fileUrl(p.file, p.v)}" alt=""><span class="pill">${k + 1}</span></div>`).join('')}</div><div class="foot"><button class="btn ghost" id="c">إغلاق</button></div>`, { wide: true }); $('#c', m).onclick = () => m.close(); },
  });
  root.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });
  S.listeners.add(redraw);
  draw();
  if (S.scanners == null) refreshDevices();
  return () => S.listeners.delete(redraw);
}
