import { $, $$, esc, call, run, toast, modal, confirmBox, icon, actions, fileUrl, loading } from '../util.js';
import { S, refreshPages, refreshDevices, emit } from '../state.js';
import { gridEditor } from './grid.js';
import { openSimpleExport } from '../export-dialog.js';
import { pdfToImages } from '../pdfjs.js';

const FONTS = ['Arial', 'Tahoma', 'Times New Roman', 'Traditional Arabic', 'Simplified Arabic', 'Calibri', 'Courier New'];
const st = window.__ocrState || (window.__ocrState = { step: 1, model: null, tab: 'docx', pageIdx: 0, selBlock: null, mode: 'auto', docSet: { pageSize: 'A4', orientation: 'portrait', marginMm: 20, content: 'text' }, tableIdx: 0, text: null });

export async function mount(root) {
  await refreshPages();
  if (sessionStorage.getItem('ocr-from-pages')) { sessionStorage.removeItem('ocr-from-pages'); st.step = 1; st.model = null; }
  const steps = () => `<div class="steps">${[['1', 'المصدر'], ['2', 'التحليل'], ['3', 'المراجعة والتحرير'], ['4', 'التصدير']].map(([n, l]) => `<div class="step ${+n === Math.min(st.step, 3) ? 'on' : +n < st.step ? 'done' : ''}">${n}. ${l}</div>`).join('')}</div>`;

  function draw() { st.step === 1 || !st.model ? source() : review(); }

  function source() {
    const pgs = S.pages;
    root.innerHTML = `<div class="page-h"><span class="tag">OCR</span><h1>التعرف الذكي على الملفات</h1></div>${steps()}
    <div class="card" style="margin-bottom:14px"><p style="margin-top:0">حوّل الورق المطبوع إلى مستند <b>قابل للتحرير فعلاً</b>: نص عربي وإنجليزي، عناوين، قوائم، وجداول إلى Excel بخلايا حقيقية. يعمل بالكامل على جهازك دون إنترنت.</p>
      <div class="row"><button class="btn" data-act="scan">${icon('scan')} مسح ورقة جديدة</button><button class="btn ghost" data-act="imp">${icon('folder')} استيراد صورة / PDF</button>${pgs.length ? `<button class="btn ghost red" data-act="clear">${icon('trash')} تفريغ</button>` : ''}</div></div>
    <div class="card"><h3 style="margin-bottom:10px">الصفحات الجاهزة للتحليل (${pgs.length})</h3>${pgs.length ? `<div class="pv-pages">${pgs.map((p, i) => `<div class="col" style="align-items:center"><img src="${fileUrl(p.thumb, p.v)}" style="height:170px" alt=""><span class="pill">${i + 1}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:14px"><div class="f">نوع المحتوى<div class="seg" id="mode"><button data-m="auto" class="${st.mode === 'auto' ? 'on' : ''}">تلقائي (نص + جداول)</button><button data-m="table" class="${st.mode === 'table' ? 'on' : ''}">جدول</button><button data-m="text" class="${st.mode === 'text' ? 'on' : ''}">نص فقط</button></div></div><span class="grow"></span>
      <button class="btn lg purple" data-act="analyze">${icon('ocr')} تحليل المستند</button></div>` : '<div class="empty">لا توجد صفحات بعد. امسح ورقة أو استورد صورة / PDF للبدء.</div>'}</div>`;
    $('#mode', root)?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.mode = b.dataset.m; $$('#mode button', root).forEach((x) => x.classList.toggle('on', x === b)); });
  }

  async function analyze() {
    const lo = loading('جارٍ تحليل المستند…'); const off = window.ps.on('progress', (d) => { if (d.ch === 'ocr') lo.set(`صفحة ${d.page} من ${d.total}`); });
    try { const r = await call('recognize', { ids: S.pages.map((p) => p.id), mode: st.mode }); st.model = r.model; st.modelId = r.id; st.step = 3; st.pageIdx = 0; st.selBlock = null; st.tableIdx = 0; st.tab = st.model.stats.tables && st.mode === 'table' ? 'xlsx' : 'docx'; st.text = null; }
    finally { off(); lo.close(); }
    draw();
    const m = st.model; if (m.stats.confidence < 75) toast('جودة التعرف منخفضة — راجع النتيجة بعناية قبل التصدير', 'warn'); else if (m.stats.lowWords) toast(`${m.stats.lowWords} عنصر بثقة منخفضة معلَّم باللون الأصفر للمراجعة`, 'warn');
  }

  const blocksOf = (pg) => pg.blocks;
  const allTables = () => st.model.pages.flatMap((p, pi) => p.blocks.filter((b) => b.type === 'table').map((b) => ({ b, pi })));

  function review() {
    const m = st.model, pg = m.pages[st.pageIdx];
    root.innerHTML = `<div class="page-h"><span class="tag">OCR</span><h1>مراجعة وتحرير النتيجة</h1><span class="grow"></span><button class="btn ghost sm" data-act="back">← تحليل جديد</button></div>${steps()}
    <div class="row" style="margin-bottom:12px"><span class="pill ${m.stats.confidence >= 85 ? 'ok' : m.stats.confidence >= 70 ? 'warn' : 'bad'}">متوسط الثقة ${m.stats.confidence}%</span>${m.stats.lowWords ? `<span class="pill warn">${m.stats.lowWords} عنصر للمراجعة</span>` : '<span class="pill ok">لا عناصر منخفضة الثقة</span>'}<span class="pill">${m.stats.tables} جدول</span>
      ${pg.warnings && pg.warnings.length ? pg.warnings.map((w) => `<span class="pill warn">${esc(w)}</span>`).join('') : ''}
      <span class="sub" style="font-size:12px">التعرف الآلي ليس معصوماً: راجع الأرقام والأسماء خصوصاً. المظلَّل بالأصفر = ثقة منخفضة.</span></div>
    <div class="tabs">${[['docx', 'Word'], ['xlsx', 'Excel'], ['pdf', 'PDF قابل للبحث'], ['txt', 'نص عادي']].map(([k, l]) => `<button class="tab ${k === st.tab ? 'on' : ''}" data-act="tab" data-t="${k}">${l}</button>`).join('')}<span class="grow"></span>${m.pages.length > 1 ? `<label class="f" style="flex-direction:row;align-items:center;gap:6px">الصفحة<select id="pgsel">${m.pages.map((_, i) => `<option value="${i}" ${i === st.pageIdx ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>` : ''}<button class="btn green" data-act="export">${icon('save')} تصدير</button></div>
    <div class="review"><div class="src-img"><img src="${fileUrl(pg.image)}" alt="الأصل"></div><div id="ed"></div></div>`;
    $('#pgsel', root)?.addEventListener('change', (e) => { st.pageIdx = +e.target.value; st.selBlock = null; review(); });
    editor();
  }

  function editor() {
    const ed = $('#ed', root), m = st.model;
    if (st.tab === 'docx') return wordEditor(ed);
    if (st.tab === 'xlsx') return excelEditor(ed);
    if (st.tab === 'pdf') { ed.innerHTML = `<div class="card"><h3>PDF قابل للبحث</h3><p>يُحفظ الملف بصور الصفحات الأصلية مع طبقة نص غير مرئية يمكن البحث فيها وتحديدها، دون تغيير مظهر الأصل.</p><p class="sub">الطبقة النصية مبنية من النص المعروض في تبويب Word بعد تصحيحك. جودة الاستخراج مثل بقية التبويبات.</p><div class="pill">${m.pages.length} صفحة</div></div>`; return; }
    if (st.text === null) st.text = m.pages.map((p) => p.blocks.map((b) => (b.type === 'table' ? b.cells.map((c) => c.text).join('\t') : b.type === 'list' ? `${b.marker} ${b.text}` : b.text)).join('\n')).join('\n\n');
    ed.innerHTML = `<textarea id="tx" style="width:100%;min-height:420px;direction:rtl;font-size:15px;line-height:1.7">${esc(st.text)}</textarea>`; $('#tx', ed).oninput = (e) => (st.text = e.target.value);
  }

  // ---------------- محرر Word ----------------
  function wordEditor(ed) {
    const pg = st.model.pages[st.pageIdx]; const D = st.docSet;
    ed.innerHTML = `<div class="fmt-bar" id="fb">
        <select id="f-font" title="الخط">${FONTS.map((f) => `<option>${f}</option>`).join('')}</select><input type="number" id="f-size" min="6" max="72" style="width:62px" title="الحجم (نقطة)"><input type="color" id="f-color" value="#000000" title="لون النص">
        <button class="btn sm ghost" data-f="bold"><b>B</b></button><button class="btn sm ghost" data-f="italic"><i>I</i></button>
        <button class="btn sm ghost" data-f="right">يمين</button><button class="btn sm ghost" data-f="center">وسط</button><button class="btn sm ghost" data-f="left">يسار</button><button class="btn sm ghost" data-f="justify">ضبط</button>
        <button class="btn sm ghost" data-f="dir">⇄ الاتجاه</button>
        <select id="f-type" title="نوع الفقرة"><option value="paragraph">فقرة</option><option value="heading">عنوان</option><option value="list">بند قائمة</option></select>
        <button class="btn sm ghost" data-f="up">${icon('up')}</button><button class="btn sm ghost" data-f="down">${icon('down')}</button><button class="btn sm red" data-f="del">${icon('trash')}</button>
        <button class="btn sm" data-f="add">+ فقرة</button><button class="btn sm ghost" data-f="addimg">${icon('img')} صورة</button></div>
      <div class="fmt-bar"><label class="sub">الصفحة<select id="d-ps">${['A4', 'A3', 'A5', 'Letter', 'Legal'].map((x) => `<option ${x === D.pageSize ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label class="sub">الاتجاه<select id="d-or"><option value="portrait" ${D.orientation === 'portrait' ? 'selected' : ''}>طولي</option><option value="landscape" ${D.orientation === 'landscape' ? 'selected' : ''}>عرضي</option></select></label>
        <label class="sub">الهوامش (مم)<input type="number" id="d-mg" min="5" max="50" value="${D.marginMm}" style="width:62px"></label>
        <label class="sub">المحتوى<select id="d-ct"><option value="text" ${D.content === 'text' ? 'selected' : ''}>نص قابل للتحرير فقط</option><option value="both" ${D.content === 'both' ? 'selected' : ''}>نص + صورة الأصل بعده</option><option value="image" ${D.content === 'image' ? 'selected' : ''}>صورة الأصل فقط</option></select></label></div>
      <div class="doc-ed" id="doc"></div>`;
    paintDoc(); wireBar(); $('#d-ps', ed).onchange = (e) => (D.pageSize = e.target.value); $('#d-or', ed).onchange = (e) => (D.orientation = e.target.value); $('#d-mg', ed).onchange = (e) => (D.marginMm = +e.target.value); $('#d-ct', ed).onchange = (e) => (D.content = e.target.value);
    void pg;
  }
  function paintDoc() {
    const doc = $('#doc', root), pg = st.model.pages[st.pageIdx];
    doc.innerHTML = pg.blocks.length ? '' : '<div class="empty" style="color:#555">لا يوجد محتوى. أضف فقرة بالزر «+ فقرة».</div>';
    pg.blocks.forEach((b, i) => {
      const w = document.createElement('div'); w.className = 'blk'; w.dataset.i = i;
      if (b.type === 'table') { const holder = document.createElement('div'); holder.style.color = '#111'; w.append(holder); gridEditor(holder, b, {}); holder.addEventListener('focusin', () => select(i)); }
      else if (b.type === 'image') { w.innerHTML = `<div style="text-align:center"><img src="${fileUrl(b.file)}" style="max-width:${b.widthMm || 60}mm" alt=""></div>`; }
      else {
        const e = document.createElement('div'); e.contentEditable = 'plaintext-only'; e.dir = b.dir; e.spellcheck = false;
        const size = b.sizePt || (b.type === 'heading' ? (b.level === 1 ? 20 : 16) : 12);
        e.style.cssText = `text-align:${b.align || 'right'};font-size:${size * 1.25}px;font-family:${b.font || 'Arial'},sans-serif;color:${b.color || '#000'};font-weight:${b.bold || b.type === 'heading' ? 700 : 400};font-style:${b.italic ? 'italic' : 'normal'};${b.type === 'list' ? 'padding-inline-start:1.4em;text-indent:-1.4em;' : ''}line-height:1.6`;
        const mark = b.type === 'list' ? `<span contenteditable="false" class="mk">${esc(b.marker || '•')} </span>` : '';
        if (b.words && b.words.some((x) => x.low) && !b.edited) e.innerHTML = mark + b.words.map((x) => (x.low ? `<span class="low" title="ثقة ${Math.round(x.conf)}%">${esc(x.text)}</span>` : esc(x.text))).join(' ');
        else e.innerHTML = mark + esc(b.text);
        e.oninput = () => { b.text = e.innerText.replace(/^[^\S\n]*(?:\d{1,3}\.|•)\s/, (m) => (b.type === 'list' ? '' : m)).replace(/\n+$/, ''); if (b.type === 'list') b.text = e.innerText.replace(b.marker + ' ', '').trim(); b.edited = true; };
        e.onfocus = () => select(i); w.append(e);
      }
      w.onclick = () => select(i); if (st.selBlock === i) w.style.borderColor = '#2f7bff'; doc.append(w);
    });
  }
  function select(i) { if (st.selBlock === i) return; st.selBlock = i; $$('.blk', root).forEach((w) => (w.style.borderColor = +w.dataset.i === i ? '#2f7bff' : '')); const b = st.model.pages[st.pageIdx].blocks[i]; if (!b || b.type === 'table' || b.type === 'image') return;
    $('#f-font', root).value = b.font || 'Arial'; $('#f-size', root).value = b.sizePt || (b.type === 'heading' ? (b.level === 1 ? 20 : 16) : 12); $('#f-color', root).value = b.color || '#000000'; $('#f-type', root).value = b.type; }
  function wireBar() {
    const cur = () => { const bl = st.model.pages[st.pageIdx].blocks; const i = st.selBlock; if (i == null || !bl[i]) throw new Error('اختر فقرة أولاً بالضغط عليها'); return [bl, i, bl[i]]; };
    const T = (fn) => () => { try { fn(); } catch (e) { toast(e.message, 'err'); } };
    $('#f-font', root).onchange = T(() => { const [, , b] = cur(); b.font = $('#f-font', root).value; paintDoc(); });
    $('#f-size', root).onchange = T(() => { const [, , b] = cur(); b.sizePt = +$('#f-size', root).value; paintDoc(); });
    $('#f-color', root).onchange = T(() => { const [, , b] = cur(); b.color = $('#f-color', root).value; paintDoc(); });
    $('#f-type', root).onchange = T(() => { const [, , b] = cur(); const t = $('#f-type', root).value; b.type = t; if (t === 'heading') b.level = b.level || 2; if (t === 'list') { b.marker = b.marker || '•'; } paintDoc(); });
    $$('[data-f]', root).forEach((btn) => (btn.onclick = T(() => {
      const k = btn.dataset.f;
      if (k === 'add') { const bl = st.model.pages[st.pageIdx].blocks; const i = st.selBlock != null ? st.selBlock + 1 : bl.length; bl.splice(i, 0, { type: 'paragraph', dir: 'rtl', align: 'right', text: 'فقرة جديدة', words: [], sizePt: 12, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 }, edited: true }); st.selBlock = i; paintDoc(); return; }
      if (k === 'addimg') { call('pickImages').then((p) => { if (!p[0]) return; const bl = st.model.pages[st.pageIdx].blocks; bl.splice(st.selBlock != null ? st.selBlock + 1 : bl.length, 0, { type: 'image', file: p[0], widthMm: 60, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } }); paintDoc(); }).catch((e) => toast(e.message, 'err')); return; }
      const [bl, i, b] = cur();
      if (k === 'del') { bl.splice(i, 1); st.selBlock = null; } else if (k === 'up' && i > 0) { [bl[i - 1], bl[i]] = [bl[i], bl[i - 1]]; st.selBlock = i - 1; } else if (k === 'down' && i < bl.length - 1) { [bl[i + 1], bl[i]] = [bl[i], bl[i + 1]]; st.selBlock = i + 1; }
      else if (k === 'bold') b.bold = !b.bold; else if (k === 'italic') b.italic = !b.italic; else if (k === 'dir') { b.dir = b.dir === 'rtl' ? 'ltr' : 'rtl'; b.align = b.dir === 'rtl' ? 'right' : 'left'; }
      else if (['right', 'center', 'left', 'justify'].includes(k)) b.align = k;
      paintDoc();
    })));
  }

  // ---------------- محرر Excel ----------------
  function excelEditor(ed) {
    const tabs = allTables();
    if (!tabs.length) { ed.innerHTML = `<div class="card empty"><h3>لم يُكتشف جدول</h3><p class="sub">جرّب إعادة التحليل بوضع «جدول»، وتأكد أن الجدول واضح الخطوط وغير مائل. يمكنك أيضاً إنشاء جدول يدوياً.</p><button class="btn" data-act="newtable">+ إنشاء جدول فارغ</button></div>`; return; }
    st.tableIdx = Math.min(st.tableIdx, tabs.length - 1); const cur = tabs[st.tableIdx].b;
    ed.innerHTML = `<div class="row" style="margin-bottom:8px">${tabs.length > 1 ? `<label class="f" style="flex-direction:row;align-items:center;gap:6px">الجدول<select id="tsel">${tabs.map((t, i) => `<option value="${i}" ${i === st.tableIdx ? 'selected' : ''}>جدول ${i + 1} (صفحة ${t.pi + 1})</option>`).join('')}</select></label>` : ''}<span class="pill">${cur.rows} × ${cur.cols}</span><span class="pill">${cur.kind === 'borderless' ? 'جدول بلا حدود (تخمين)' : 'جدول بحدود'}</span><span class="grow"></span><label class="chk"><input type="checkbox" id="af" ${cur.autoFilter ? 'checked' : ''}> تفعيل التصفية في Excel</label></div><div id="gr"></div>`;
    $('#tsel', ed)?.addEventListener('change', (e) => { st.tableIdx = +e.target.value; excelEditor(ed); }); $('#af', ed).onchange = (e) => (cur.autoFilter = e.target.checked);
    gridEditor($('#gr', ed), cur, { letters: true });
  }

  async function exportNow() {
    const m = st.model, fmtOf = { docx: [['docx', 'Word (.docx)']], xlsx: [['xlsx', 'Excel (.xlsx)']], pdf: [['pdf', 'PDF قابل للبحث']], txt: [['txt', 'نص عادي (.txt)']] }[st.tab];
    if (st.tab === 'xlsx' && !allTables().length) return toast('لا يوجد جدول لتصديره', 'warn');
    openSimpleExport({ title: 'تصدير المستند المعالَج', formats: fmtOf, defaultName: 'مستند',
      onExport: async ({ name, format, dir }) => {
        let model = m, options = {};
        if (format === 'docx') options = { ...st.docSet, content: st.docSet.content };
        if (format === 'txt') model = { pages: [{ blocks: [{ type: 'paragraph', text: st.text ?? '' }] }] };
        if (format === 'xlsx') options = { autoFilter: allTables().some((t) => t.b.autoFilter) };
        return call('exportModel', { name, format, dir, model: strip(model), options });
      } });
  }
  const strip = (m) => ({ ...m, pages: m.pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b, words: undefined })) })) });

  actions(root, {
    scan: (b) => run(b, async () => { if (!S.settings.scanner.id) throw new Error('اختر السكانر أولاً من الصفحة الرئيسية أو الإعدادات'); await call('scan', {}); await refreshPages(); draw(); toast('تم مسح الصفحة', 'ok'); }),
    imp: (b) => run(b, async () => { const files = await call('pickPrintable'); if (!files.length) return; const lo = loading('جارٍ الاستيراد…'); try { const imgs = files.filter((f) => !/\.pdf$/i.test(f)); if (imgs.length) await call('pagesImportPaths', imgs); for (const f of files.filter((x) => /\.pdf$/i.test(x))) { const out = await pdfToImages(await call('readFile', f), { dpi: 200, onProgress: (i, n) => lo.set(`صفحة ${i}/${n}`) }); await call('pagesAddBuffers', out.map((o) => o.buf)); } } finally { lo.close(); } await refreshPages(); draw(); }),
    clear: async () => { if (await confirmBox('تفريغ كل الصفحات؟', 'تفريغ', true)) { await call('pagesClear'); await refreshPages(); st.model = null; draw(); } },
    analyze: (b) => run(b, analyze),
    back: () => { st.step = 1; draw(); },
    tab: (b) => { st.tab = b.dataset.t; review(); },
    export: () => exportNow(),
    newtable: () => { const pg = st.model.pages[st.pageIdx]; pg.blocks.push({ type: 'table', dir: 'rtl', rows: 3, cols: 3, header: true, colWidths: [100, 100, 100], rowHeights: [40, 40, 40], cells: Array.from({ length: 9 }, (_, i) => ({ r: Math.floor(i / 3), c: i % 3, rs: 1, cs: 1, text: '', conf: 100, low: false })), bbox: { x0: 0, y0: 1e9, x1: 0, y1: 1e9 } }); review(); },
  });
  draw();
}
