import { $, $$, esc, call, run, toast, modal, confirmBox, icon, actions, fileUrl, loading } from '../util.js';
import { S, refreshDevices } from '../state.js';
import { openPdf, renderPage } from '../pdfjs.js';
import { sizeLabel } from './common.js';

export async function mount(root) {
  let files = []; // {path,name,kind:'pdf'|'img', pages:[{url}], status}
  let opt = { copies: 1, paper: 'A4', landscape: false, color: true, duplex: 'simplex', ranges: '', fit: 'contain', scale: 100, printer: '' };
  const redraw = () => { head(); }; S.listeners.add(redraw);
  const PAPER = { A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };

  async function addFiles(paths) {
    const lo = loading('جارٍ تجهيز المعاينة…');
    try { for (const p of paths) {
      const name = p.split(/[\\/]/).pop(); const item = { path: p, name, kind: /\.pdf$/i.test(p) ? 'pdf' : 'img', pages: [], status: '' };
      if (item.kind === 'pdf') { const doc = await openPdf(await call('readFile', p)); item.doc = doc; for (let i = 1; i <= doc.numPages; i++) { lo.set(`${name} — صفحة ${i}/${doc.numPages}`); const r = await renderPage(doc, i, 0.8, 'image/jpeg', 0.8); item.pages.push({ url: r.url }); } }
      else item.pages.push({ url: fileUrl(p) });
      files.push(item);
    } } finally { lo.close(); } draw();
  }
  function head() { const el = $('#pr-sel', root); if (el) el.innerHTML = printerOptions(); }
  const printerOptions = () => { const l = (S.printers && S.printers.list) || []; const cur = opt.printer || S.settings.printer.name; return l.length ? l.map((p) => `<option value="${esc(p.name)}" ${p.name === cur ? 'selected' : ''}>${esc(p.name)} — ${esc(p.statusText)}</option>`).join('') : `<option value="">${esc(cur || 'لا توجد طابعات')}</option>`; };

  function draw() {
    const [pw, ph] = PAPER[opt.paper] || PAPER.A4; const w = opt.landscape ? ph : pw, h = opt.landscape ? pw : ph; const total = files.reduce((a, f) => a + f.pages.length, 0);
    root.innerHTML = `<div class="page-h"><span class="tag">🖨</span><h1>مركز الطباعة</h1><span class="grow"></span><button class="btn" data-act="add">${icon('plus')} إضافة ملفات (PDF / صور)</button></div>
    <div class="grid2" style="grid-template-columns:1.3fr 1fr;align-items:start">
      <div class="col"><div class="drop" id="drop">اسحب الملفات وأفلتها هنا، أو اضغط «إضافة ملفات»</div>
        ${files.length ? `<div class="col">${files.map((f, i) => `<div class="file-i"><span>${icon(f.kind === 'pdf' ? 'pdf' : 'img')}</span><span class="nm">${esc(f.name)}</span><span class="pill">${f.pages.length} صفحة</span><span class="pill ${f.status.startsWith('✔') ? 'ok' : f.status.startsWith('✖') ? 'bad' : ''}" ${f.status ? '' : 'hidden'}>${esc(f.status)}</span><button class="btn sm red" data-act="rm" data-i="${i}">${icon('x')}</button></div>`).join('')}</div>
        <div class="card"><h3 style="margin-bottom:8px">معاينة قبل الطباعة <span class="sub">(${sizeLabel(opt.paper, opt.landscape)})</span></h3><div class="pv-pages">${files.flatMap((f) => f.pages.map((p, k) => `<div class="col" style="align-items:center;gap:4px"><div style="width:${Math.round(200 * w / h)}px;height:200px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #000"><img src="${p.url}" style="${opt.fit === 'fill' ? 'width:100%;height:100%;object-fit:fill' : opt.fit === 'actual' ? `width:${opt.scale}%` : `max-width:${opt.scale}%;max-height:${opt.scale}%;object-fit:contain`};height:auto" alt=""></div><span class="pill">${k + 1}</span></div>`)).slice(0, 40).join('')}</div></div>` : ''}</div>
      <div class="card col"><h3>خيارات الطباعة</h3>
        <label class="f">الطابعة<select id="pr-sel">${printerOptions()}</select></label>
        <div class="grid2"><label class="f">عدد النسخ<input type="number" min="1" max="999" value="${opt.copies}" data-o="copies"></label>
        <label class="f">حجم الورق<select data-o="paper">${Object.keys(PAPER).map((k) => `<option ${k === opt.paper ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
        <div class="grid2"><label class="f">الاتجاه<select data-o="landscape"><option value="0" ${!opt.landscape ? 'selected' : ''}>طولي</option><option value="1" ${opt.landscape ? 'selected' : ''}>عرضي</option></select></label>
        <label class="f">اللون<select data-o="color"><option value="1" ${opt.color ? 'selected' : ''}>ملوّن</option><option value="0" ${!opt.color ? 'selected' : ''}>رمادي (إن دعمته الطابعة)</option></select></label></div>
        <label class="f">الطباعة على الوجهين<select data-o="duplex"><option value="simplex" ${opt.duplex === 'simplex' ? 'selected' : ''}>وجه واحد</option><option value="longEdge" ${opt.duplex === 'longEdge' ? 'selected' : ''}>وجهان (الحافة الطويلة)</option><option value="shortEdge" ${opt.duplex === 'shortEdge' ? 'selected' : ''}>وجهان (الحافة القصيرة)</option></select></label>
        <div class="sub" style="font-size:12px;margin-top:-6px">يعمل فقط إذا كانت الطابعة تدعم الطباعة على الوجهين.</div>
        <label class="f">نطاق الصفحات (اختياري)<input type="text" data-o="ranges" value="${esc(opt.ranges)}" placeholder="مثال: 1-3,5" style="direction:ltr"></label>
        <div class="grid2"><label class="f">ملاءمة المحتوى<select data-o="fit"><option value="contain" ${opt.fit === 'contain' ? 'selected' : ''}>ملاءمة للورقة</option><option value="fill" ${opt.fit === 'fill' ? 'selected' : ''}>ملء الورقة</option><option value="actual" ${opt.fit === 'actual' ? 'selected' : ''}>الحجم الفعلي</option></select></label>
        <label class="f">التحجيم ${opt.scale}%<input type="range" min="30" max="150" value="${opt.scale}" data-o="scale"></label></div>
        <button class="btn green lg" data-act="print" ${files.length ? '' : 'disabled'} style="font-size:18px">${icon('printer')} طباعة ${total ? `(${total} صفحة)` : ''}</button>
        <button class="btn ghost sm" data-act="queue">فتح قائمة انتظار الطابعة</button></div></div>`;
    const dz = $('#drop', root); dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('over'); toast('استخدم زر «إضافة ملفات» لاختيار الملفات (لأسباب أمان)', 'warn'); };
    $$('[data-o]', root).forEach((el) => (el.onchange = () => { const k = el.dataset.o, v = el.value; opt[k] = k === 'copies' || k === 'scale' ? +v : k === 'landscape' || k === 'color' ? v === '1' : v; draw(); }));
    const ps = $('#pr-sel', root); ps.onchange = () => (opt.printer = ps.value);
  }
  async function printAll(btn) {
    if (!files.length) return; const printer = opt.printer || S.settings.printer.name; if (!printer) throw new Error('اختر طابعة أولاً');
    const lo = loading('جارٍ إرسال المهام للطابعة…');
    try {
      for (const f of files) {
        f.status = '⏳ جارٍ…'; lo.set(f.name);
        try {
          let payload;
          if (f.kind === 'pdf') { const bufs = []; for (let i = 1; i <= f.doc.numPages; i++) { lo.set(`${f.name} — تجهيز صفحة ${i}`); bufs.push({ data: (await renderPage(f.doc, i, 200 / 72)).buf }); } payload = bufs; }
          else payload = [{ path: f.path }];
          await call('printRun', { printer, files: payload, copies: opt.copies, landscape: opt.landscape, color: opt.color, duplex: opt.duplex, paper: opt.paper, fit: opt.fit, scale: opt.scale, pageRanges: opt.ranges });
          f.status = '✔ أُرسلت';
        } catch (e) { f.status = '✖ ' + e.message; toast(`${f.name}: ${e.message}`, 'err'); }
      }
    } finally { lo.close(); draw(); }
    const ok = files.filter((f) => f.status.startsWith('✔')).length; if (ok) toast(`أُرسل ${ok} من ${files.length} ملف إلى الطابعة`, 'ok');
  }
  actions(root, {
    add: (b) => run(b, async () => { const p = await call('pickPrintable'); if (p.length) await addFiles(p); }),
    rm: (b) => { files.splice(+b.dataset.i, 1); draw(); },
    print: (b) => run(b, () => printAll(b)),
    queue: (b) => run(b, () => call('printerQueue', opt.printer || S.settings.printer.name)),
  });
  draw(); if (!S.printers) refreshDevices().then(head);
  const pre = sessionStorage.getItem('print-preload'); if (pre) { sessionStorage.removeItem('print-preload'); await run(null, () => addFiles([pre])); }
  return () => S.listeners.delete(redraw);
}
