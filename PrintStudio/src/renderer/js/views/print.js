import { $, $$, esc, call, run, toast, icon, actions, fileUrl, loading } from '../util.js';
import { S, refreshDevices, setSetting } from '../state.js';
import { openPdf, renderPage } from '../pdfjs.js';

const PAPER = { A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };

const loadImg = (url) => new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight, ok: true }); i.onerror = () => res({ w: 0, h: 0, ok: false }); i.src = url; });

export async function mount(root) {
  const files = []; // {path,name,kind,pages:[{url,w,h}],doc,status}
  const P = S.settings.print;
  const opt = { copies: 1, paper: 'A4', orientation: P.orientation, color: P.color, duplex: 'simplex', ranges: '', fit: P.fit, scale: 100, dpi: P.dpi, printer: '' };
  const redraw = () => head(); S.listeners.add(redraw);

  async function addFiles(paths) {
    const lo = loading('جارٍ تجهيز المعاينة…');
    try {
      for (const p of paths) {
        const name = p.split(/[\\/]/).pop(); const item = { path: p, name, kind: /\.pdf$/i.test(p) ? 'pdf' : 'img', pages: [], status: '' };
        try {
          if (item.kind === 'pdf') {
            const doc = await openPdf(await call('readFile', p)); item.doc = doc;
            for (let i = 1; i <= doc.numPages; i++) { lo.set(`${name} — صفحة ${i}/${doc.numPages}`); const r = await renderPage(doc, i, 0.9, 'image/jpeg', 0.85); item.pages.push({ url: r.url, w: r.w, h: r.h }); }
          } else {
            const url = fileUrl(p); const m = await loadImg(url);
            if (!m.ok) throw new Error('تعذّر قراءة الصورة (الملف تالف أو غير مدعوم)');
            item.pages.push({ url, w: m.w, h: m.h });
          }
          files.push(item);
        } catch (e) { toast(`${name}: ${e.message}`, 'err'); }
      }
    } finally { lo.close(); }
    draw();
  }
  const printerOptions = () => {
    const l = (S.printers && S.printers.list) || []; const cur = opt.printer || S.settings.printer.name;
    return l.length ? l.map((p) => `<option value="${esc(p.name)}" ${p.name === cur ? 'selected' : ''}>${esc(p.name)} — ${esc(p.statusText)}</option>`).join('') : `<option value="">${esc(cur || 'لا توجد طابعات')}</option>`;
  };
  function head() { const el = $('#pr-sel', root); if (el) el.innerHTML = printerOptions(); }

  /** اتجاه الصفحة في المعاينة: تلقائي = حسب أبعاد الصفحة نفسها */
  const landscapeOf = (pg) => (opt.orientation === 'auto' ? pg.w > pg.h : opt.orientation === 'landscape');

  function previewBox(pg, k) {
    const [pw, ph] = PAPER[opt.paper] || PAPER.A4; const land = landscapeOf(pg); const w = land ? ph : pw, h = land ? pw : ph; const H = 230;
    const imgStyle = opt.fit === 'fill' ? 'width:100%;height:100%;object-fit:fill' : opt.fit === 'actual' ? `width:${opt.scale}%;height:auto` : `max-width:${opt.scale}%;max-height:${opt.scale}%;object-fit:contain`;
    return `<div class="col" style="align-items:center;gap:4px"><div style="width:${Math.round(H * w / h)}px;height:${H}px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #000;box-shadow:4px 4px 0 #000a"><img src="${pg.url}" style="${imgStyle}" alt=""></div><span class="pill">${k + 1} · ${land ? 'عرضي' : 'طولي'}</span></div>`;
  }

  function draw() {
    const total = files.reduce((a, f) => a + f.pages.length, 0);
    const land = files.flatMap((f) => f.pages).filter(landscapeOf).length;
    root.innerHTML = `<div class="page-h"><span class="tag">🖨</span><h1>مركز الطباعة</h1><span class="grow"></span><button class="btn" data-act="add">${icon('plus')} إضافة ملفات (PDF / صور)</button></div>
    <div class="grid2" style="grid-template-columns:1.3fr 1fr;align-items:start">
      <div class="col"><div class="drop" id="drop">اختر ملفات PDF أو صور للطباعة — يمكنك إضافة عدة ملفات وطباعتها دفعة واحدة</div>
        ${files.length ? `<div class="col">${files.map((f, i) => `<div class="file-i"><span>${icon(f.kind === 'pdf' ? 'pdf' : 'img')}</span><span class="nm">${esc(f.name)}</span><span class="pill">${f.pages.length} صفحة</span><span class="pill ${f.status.startsWith('✔') ? 'ok' : f.status.startsWith('✖') ? 'bad' : ''}" ${f.status ? '' : 'hidden'}>${esc(f.status)}</span><button class="btn sm red" data-act="rm" data-i="${i}" title="إزالة">${icon('x')}</button></div>`).join('')}</div>
        <div class="card"><h3 style="margin-bottom:8px">المعاينة <span class="sub">(${esc(opt.paper)} · ${opt.orientation === 'auto' ? `تلقائي: ${total - land} طولي، ${land} عرضي` : opt.orientation === 'landscape' ? 'عرضي' : 'طولي'})</span></h3><div class="pv-pages">${files.flatMap((f) => f.pages.map((p, k) => previewBox(p, k))).slice(0, 60).join('')}</div></div>` : ''}</div>
      <div class="card col"><h3>خيارات الطباعة</h3>
        <label class="f">الطابعة<select id="pr-sel">${printerOptions()}</select></label>
        <div class="grid2"><label class="f">عدد النسخ<input type="number" min="1" max="999" value="${opt.copies}" data-o="copies"></label>
        <label class="f">حجم الورق<select data-o="paper">${Object.keys(PAPER).map((k) => `<option ${k === opt.paper ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
        <div class="grid2"><label class="f">اتجاه الطباعة<select data-o="orientation"><option value="auto" ${opt.orientation === 'auto' ? 'selected' : ''}>تلقائي حسب الملف</option><option value="portrait" ${opt.orientation === 'portrait' ? 'selected' : ''}>طولي</option><option value="landscape" ${opt.orientation === 'landscape' ? 'selected' : ''}>عرضي</option></select></label>
        <label class="f">اللون<select data-o="color"><option value="1" ${opt.color ? 'selected' : ''}>ملوّن</option><option value="0" ${!opt.color ? 'selected' : ''}>رمادي (إن دعمته الطابعة)</option></select></label></div>
        <label class="f">دقة الطباعة<select data-o="dpi"><option value="0" ${opt.dpi === 0 ? 'selected' : ''}>افتراضي الطابعة</option>${[150, 300, 600, 1200].map((d) => `<option value="${d}" ${opt.dpi === d ? 'selected' : ''}>${d} DPI${d === 150 ? ' (مسودة)' : d === 300 ? ' (عادي)' : d === 600 ? ' (عالٍ)' : ' (أعلى جودة)'}</option>`).join('')}</select></label>
        <div class="sub" style="font-size:12px;margin-top:-6px">تُرسل الدقة للطابعة، وتلتزم بها بحسب ما يدعمه تعريفها.</div>
        <label class="f">الطباعة على الوجهين<select data-o="duplex"><option value="simplex" ${opt.duplex === 'simplex' ? 'selected' : ''}>وجه واحد</option><option value="longEdge" ${opt.duplex === 'longEdge' ? 'selected' : ''}>وجهان (الحافة الطويلة)</option><option value="shortEdge" ${opt.duplex === 'shortEdge' ? 'selected' : ''}>وجهان (الحافة القصيرة)</option></select></label>
        <label class="f">نطاق الصفحات (اختياري)<input type="text" data-o="ranges" value="${esc(opt.ranges)}" placeholder="مثال: 1-3,5" style="direction:ltr"></label>
        <div class="grid2"><label class="f">ملاءمة المحتوى<select data-o="fit"><option value="contain" ${opt.fit === 'contain' ? 'selected' : ''}>ملاءمة للورقة</option><option value="fill" ${opt.fit === 'fill' ? 'selected' : ''}>ملء الورقة</option><option value="actual" ${opt.fit === 'actual' ? 'selected' : ''}>الحجم الفعلي</option></select></label>
        <label class="f">التحجيم ${opt.scale}%<input type="range" min="30" max="150" value="${opt.scale}" data-o="scale"></label></div>
        <button class="btn green lg" data-act="print" ${files.length ? '' : 'disabled'} style="font-size:18px">${icon('printer')} طباعة ${total ? `(${total} صفحة)` : ''}</button>
        <button class="btn ghost sm" data-act="queue">فتح قائمة انتظار الطابعة</button></div></div>`;
    $$('[data-o]', root).forEach((el) => (el.onchange = () => { const k = el.dataset.o, v = el.value; opt[k] = ['copies', 'scale', 'dpi'].includes(k) ? +v : k === 'color' ? v === '1' : v; if (k === 'orientation' || k === 'fit' || k === 'dpi' || k === 'color') setSetting({ ['print.' + k]: k === 'color' ? opt.color : opt[k] }).catch(() => {}); draw(); }));
    const ps = $('#pr-sel', root); ps.onchange = () => (opt.printer = ps.value);
  }

  async function printAll() {
    if (!files.length) return; const printer = opt.printer || S.settings.printer.name; if (!printer) throw new Error('اختر طابعة أولاً');
    const lo = loading('جارٍ إرسال المهام للطابعة…'); const scale = Math.min(300, opt.dpi || 300) / 72;
    try {
      for (const f of files) {
        f.status = '⏳ جارٍ…'; lo.set(f.name);
        try {
          let payload;
          if (f.kind === 'pdf') { payload = []; for (let i = 1; i <= f.doc.numPages; i++) { lo.set(`${f.name} — تجهيز صفحة ${i}/${f.doc.numPages}`); payload.push({ data: (await renderPage(f.doc, i, scale)).buf }); } }
          else payload = [{ path: f.path }];
          await call('printRun', { printer, files: payload, copies: opt.copies, orientation: opt.orientation, color: opt.color, duplex: opt.duplex, paper: opt.paper, fit: opt.fit, scale: opt.scale, pageRanges: opt.ranges, dpi: opt.dpi });
          f.status = '✔ أُرسلت';
        } catch (e) { f.status = '✖ ' + e.message; toast(`${f.name}: ${e.message}`, 'err'); }
      }
    } finally { lo.close(); draw(); }
    const ok = files.filter((f) => f.status.startsWith('✔')).length; if (ok) toast(`أُرسل ${ok} من ${files.length} ملف إلى الطابعة`, 'ok');
  }
  actions(root, {
    add: (b) => run(b, async () => { const p = await call('pickPrintable'); if (p.length) await addFiles(p); }),
    rm: (b) => { files.splice(+b.dataset.i, 1); draw(); },
    print: (b) => run(b, printAll),
    queue: (b) => run(b, () => call('printerQueue', opt.printer || S.settings.printer.name)),
  });
  draw(); if (!S.printers) refreshDevices().then(head);
  const pre = sessionStorage.getItem('print-preload'); if (pre) { sessionStorage.removeItem('print-preload'); await run(null, () => addFiles([pre])); }
  return () => S.listeners.delete(redraw);
}
