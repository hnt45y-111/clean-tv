import { $, $$, esc, call, run, toast, modal, icon, actions, loading, fileUrl } from '../util.js';
import { S, setSetting } from '../state.js';
import { openPdf, renderPage, pdfToImages } from '../pdfjs.js';

const TOOLS = [
  ['merge', 'دمج ملفات PDF', 'merge'], ['split', 'تقسيم PDF', 'split'], ['extract', 'استخراج صفحات', 'doc'], ['reorder', 'إعادة ترتيب الصفحات', 'reorder'],
  ['rotate', 'تدوير الصفحات', 'rot'], ['compress', 'ضغط PDF', 'compress'], ['img2pdf', 'صور إلى PDF', 'img'], ['pdf2img', 'PDF إلى صور', 'img'],
  ['numbers', 'ترقيم الصفحات', 'hash'], ['watermark', 'علامة مائية', 'water'], ['preview', 'معاينة وتنظيم الملفات', 'eye'],
];
const base = (p) => p.split(/[\\/]/).pop();
const stem = (p) => base(p).replace(/\.[^.]+$/, '');

export async function mount(root) {
  let tool = 'merge', inputs = [], thumbs = [], order = [], opts = {};
  async function loadThumbs() {
    thumbs = []; order = []; if (!inputs[0] || !/\.pdf$/i.test(inputs[0])) return draw();
    const lo = loading('جارٍ تحميل صفحات الملف…');
    try { const doc = await openPdf(await call('readFile', inputs[0])); for (let i = 1; i <= Math.min(doc.numPages, 200); i++) { lo.set(`صفحة ${i}/${doc.numPages}`); thumbs.push((await renderPage(doc, i, 0.35, 'image/jpeg', 0.7)).url); order.push(i); } }
    catch (e) { toast('تعذّر قراءة الملف: ' + e.message, 'err'); inputs = []; } finally { lo.close(); } draw();
  }
  const needsPdf = !['img2pdf'].includes(tool);
  async function ensureDir() { if (S.settings.save.dir) return S.settings.save.dir; const d = await call('folderPick', true); if (!d) throw new Error('اختر مكان الحفظ أولاً'); await setSetting({}).catch(() => {}); return d; }
  function opsHtml() {
    const o = opts;
    switch (tool) {
      case 'merge': return '<p class="sub">اختر ملفين أو أكثر. يمكنك ترتيبها بالأسهم.</p>';
      case 'split': return `<div class="seg" id="sm"><button data-v="each" class="on">كل صفحة ملف مستقل</button><button data-v="ranges">حسب نطاقات</button></div><label class="f" id="sr" hidden>النطاقات (افصل الملفات بـ ;)<input type="text" id="rg" placeholder="1-3;4-6;7" style="direction:ltr"></label>`;
      case 'extract': return `<label class="f">الصفحات المطلوبة<input type="text" id="rg" placeholder="مثال: 1-3,5,8-" style="direction:ltr"></label>`;
      case 'reorder': return `<p class="sub">اسحب المصغّرات لإعادة ترتيب الصفحات ثم اضغط «تنفيذ».</p>`;
      case 'rotate': return `<div class="grid2"><label class="f">الزاوية<select id="dg"><option value="90">90° يمين</option><option value="-90">90° يسار</option><option value="180">180°</option></select></label><label class="f">الصفحات (فارغ = الكل)<input type="text" id="rg" style="direction:ltr"></label></div>`;
      case 'compress': return `<div class="seg" id="cm"><button data-v="lossless" class="on">تحسين بدون فقدان</button><button data-v="images">ضغط الصور (أصغر حجماً)</button></div><div id="cq" hidden><label class="f">الجودة <b id="cqv">60</b>%<input type="range" id="cqr" min="20" max="90" value="60"></label><p class="sub">تحذير: ضغط الصور يحوّل الصفحات إلى صور، فيفقد الملف النص القابل للتحديد والبحث.</p></div>`;
      case 'img2pdf': return `<div class="grid2"><label class="f">حجم الصفحة<select id="ps"><option>A4</option><option>A3</option><option>A5</option><option>Letter</option><option value="fit">بحجم الصورة</option></select></label><label class="f">الجودة %<input type="number" id="q" value="85" min="30" max="100"></label></div>`;
      case 'pdf2img': return `<div class="grid3"><label class="f">الصيغة<select id="fm"><option value="png">PNG</option><option value="jpg">JPG</option></select></label><label class="f">الدقة<select id="dpi"><option>100</option><option selected>150</option><option>200</option><option>300</option></select></label><label class="f">الصفحات (فارغ = الكل)<input type="text" id="rg" style="direction:ltr"></label></div>`;
      case 'numbers': return `<div class="grid3"><label class="f">الموضع<select id="pos"><option value="bottom-center">أسفل الوسط</option><option value="bottom-left">أسفل اليسار</option><option value="bottom-right">أسفل اليمين</option><option value="top-center">أعلى الوسط</option><option value="top-left">أعلى اليسار</option><option value="top-right">أعلى اليمين</option></select></label><label class="f">يبدأ من<input type="number" id="st" value="1" min="0"></label><label class="f">الصيغة<select id="fmt"><option value="{n}">1</option><option value="{n} / {t}">1 / 10</option><option value="- {n} -">- 1 -</option></select></label></div>`;
      case 'watermark': return `<div class="grid3"><label class="f">النص<input type="text" id="wt" value="سري" maxlength="40"></label><label class="f">الشفافية %<input type="number" id="wo" value="18" min="5" max="80"></label><label class="f">اللون<input type="color" id="wc" value="#cc0000" style="height:42px"></label></div>`;
      case 'preview': return '<p class="sub">يعرض صفحات الملف للمعاينة.</p>';
    }
  }
  function draw() {
    const multi = tool === 'merge'; const isImg = tool === 'img2pdf';
    root.innerHTML = `<div class="page-h"><span class="tag">PDF</span><h1>أدوات PDF والمستندات</h1></div>
    <div class="tool-grid" style="margin-bottom:16px">${TOOLS.map(([k, l, ic]) => `<button class="tool ${k === tool ? 'on' : ''}" data-act="tool" data-t="${k}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>
    <div class="card"><h2 style="margin-bottom:10px">${TOOLS.find((t) => t[0] === tool)[1]}</h2>
      <div class="row" style="margin-bottom:12px"><button class="btn" data-act="pick">${icon('folder')} ${isImg ? 'اختيار صور' : multi ? 'اختيار ملفات PDF' : 'اختيار ملف PDF'}</button>${inputs.length ? `<span class="pill">${inputs.length} ملف</span>` : ''}</div>
      ${inputs.length ? `<div class="col" style="margin-bottom:12px">${inputs.map((p, i) => `<div class="file-i"><span class="nm" style="direction:ltr;text-align:right">${esc(base(p))}</span>${(multi || isImg) ? `<button class="btn sm ghost" data-act="up" data-i="${i}">${icon('up')}</button><button class="btn sm ghost" data-act="down" data-i="${i}">${icon('down')}</button>` : ''}<button class="btn sm red" data-act="rmf" data-i="${i}">${icon('x')}</button></div>`).join('')}</div>` : ''}
      <div id="ops">${opsHtml()}</div>
      ${thumbs.length && tool !== 'merge' ? `<div class="pv-pages" id="tg" style="margin:12px 0">${order.map((n, k) => `<div class="col" style="align-items:center;gap:4px" draggable="${tool === 'reorder'}" data-k="${k}"><img src="${thumbs[n - 1]}" style="height:150px" alt=""><span class="pill">${n}</span></div>`).join('')}</div>` : ''}
      ${tool !== 'preview' ? `<div class="row" style="margin-top:12px"><label class="f grow">اسم الملف الناتج (اختياري)<input type="text" id="on" placeholder="${inputs[0] ? esc(stem(inputs[0])) : 'اسم الملف'}"></label><button class="btn green lg" data-act="go" style="margin-top:18px">${icon('check')} تنفيذ</button></div>` : ''}</div>`;
    const sm = $('#sm', root); if (sm) sm.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('button', sm).forEach((x) => x.classList.toggle('on', x === b)); $('#sr', root).hidden = b.dataset.v !== 'ranges'; };
    const cm = $('#cm', root); if (cm) cm.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('button', cm).forEach((x) => x.classList.toggle('on', x === b)); $('#cq', root).hidden = b.dataset.v !== 'images'; };
    const q = $('#cqr', root); if (q) q.oninput = () => ($('#cqv', root).textContent = q.value);
    const tg = $('#tg', root); if (tg && tool === 'reorder') { let from = null; $$('[data-k]', tg).forEach((el) => { el.ondragstart = () => (from = +el.dataset.k); el.ondragover = (e) => e.preventDefault(); el.ondrop = () => { const to = +el.dataset.k; if (from === null || from === to) return; const [m] = order.splice(from, 1); order.splice(to, 0, m); draw(); }; }); }
  }
  async function exec(btn) {
    const dir = await ensureDir(); const name = $('#on', root).value.trim() || undefined; const needFiles = tool === 'img2pdf' ? 'صورة' : 'ملف PDF';
    if (!inputs.length) throw new Error(`اختر ${needFiles} أولاً`);
    let r;
    if (tool === 'merge') r = await call('pdfTool', { op: 'merge', inputs, name, dir });
    else if (tool === 'split') r = await call('pdfTool', { op: 'split', inputs: [inputs[0]], name, dir, args: { mode: $('#sm .on', root).dataset.v, ranges: $('#rg', root)?.value || '' } });
    else if (tool === 'extract') r = await call('pdfTool', { op: 'extract', inputs: [inputs[0]], name: name || stem(inputs[0]) + '-مستخرج', dir, args: { ranges: $('#rg', root).value } });
    else if (tool === 'reorder') r = await call('pdfTool', { op: 'reorder', inputs: [inputs[0]], name: name || stem(inputs[0]) + '-مرتّب', dir, args: { order: order.join(',') } });
    else if (tool === 'rotate') r = await call('pdfTool', { op: 'rotate', inputs: [inputs[0]], name: name || stem(inputs[0]) + '-مدوّر', dir, args: { degrees: +$('#dg', root).value, ranges: $('#rg', root).value.trim() } });
    else if (tool === 'compress') {
      if ($('#cm .on', root).dataset.v === 'lossless') r = await call('pdfTool', { op: 'optimize', inputs: [inputs[0]], name: name || stem(inputs[0]) + '-مضغوط', dir });
      else { const lo = loading('جارٍ ضغط الصفحات…'); try { const imgs = await pdfToImages(await call('readFile', inputs[0]), { dpi: 130, type: 'image/jpeg', quality: +$('#cqr', root).value / 100, onProgress: (i, n) => lo.set(`صفحة ${i}/${n}`) }); r = await call('pdfBuild', { buffers: imgs.map((x) => x.buf), name: name || stem(inputs[0]) + '-مضغوط', dir, quality: +$('#cqr', root).value }); } finally { lo.close(); } }
    }
    else if (tool === 'img2pdf') r = await call('imagesToPdf', { files: inputs, name: name || 'صور', dir, args: { pageSize: $('#ps', root).value, quality: +$('#q', root).value } });
    else if (tool === 'pdf2img') {
      const lo = loading('جارٍ التحويل إلى صور…'); try { const fm = $('#fm', root).value; let imgs = await pdfToImages(await call('readFile', inputs[0]), { dpi: +$('#dpi', root).value, type: fm === 'jpg' ? 'image/jpeg' : 'image/png', quality: 0.92, onProgress: (i, n) => lo.set(`صفحة ${i}/${n}`) });
        const rg = $('#rg', root).value.trim(); if (rg) { const idx = parseRanges(rg, imgs.length); imgs = idx.map((i) => imgs[i]); }
        r = await call('imagesSave', { buffers: imgs.map((x) => x.buf), name: name || stem(inputs[0]), dir, format: fm }); } finally { lo.close(); }
    }
    else if (tool === 'numbers') r = await call('pdfTool', { op: 'numbers', inputs: [inputs[0]], name: name || stem(inputs[0]) + '-مرقّم', dir, args: { position: $('#pos', root).value, start: +$('#st', root).value, format: $('#fmt', root).value } });
    else if (tool === 'watermark') r = await call('pdfTool', { op: 'watermark', inputs: [inputs[0]], name: name || stem(inputs[0]) + '-علامة', dir, args: { text: $('#wt', root).value, opacity: +$('#wo', root).value / 100, color: $('#wc', root).value } });
    toast(`تم: ${r.files.length > 1 ? r.files.length + ' ملفات' : base(r.files[0])}`, 'ok', [{ label: 'فتح الملف', fn: () => call('openPath', r.files[0]).catch((e) => toast(e.message, 'err')) }, { label: 'فتح المجلد', fn: () => call('reveal', r.files[0]).catch((e) => toast(e.message, 'err')) }]);
  }
  function parseRanges(str, total) { const out = []; for (const part of str.split(/[,،\s]+/).filter(Boolean)) { const m = part.match(/^(\d*)-(\d*)$/); if (m) { const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : total; for (let i = a; i <= Math.min(b, total); i++) out.push(i - 1); } else if (/^\d+$/.test(part) && +part <= total) out.push(+part - 1); } if (!out.length) throw new Error('نطاق الصفحات غير صالح'); return out; }
  actions(root, {
    tool: (b) => { tool = b.dataset.t; inputs = []; thumbs = []; order = []; draw(); },
    pick: (b) => run(b, async () => { const p = tool === 'img2pdf' ? await call('pickImages') : await call('pickPdfs', tool === 'merge'); if (!p.length) return; inputs = tool === 'merge' || tool === 'img2pdf' ? [...inputs, ...p] : [p[0]]; if (tool === 'merge' || tool === 'img2pdf') draw(); else await loadThumbs(); }),
    rmf: (b) => { inputs.splice(+b.dataset.i, 1); if (!['merge', 'img2pdf'].includes(tool)) { thumbs = []; order = []; } draw(); },
    up: (b) => { const i = +b.dataset.i; if (i > 0) { [inputs[i - 1], inputs[i]] = [inputs[i], inputs[i - 1]]; draw(); } },
    down: (b) => { const i = +b.dataset.i; if (i < inputs.length - 1) { [inputs[i + 1], inputs[i]] = [inputs[i], inputs[i + 1]]; draw(); } },
    go: (b) => run(b, () => exec(b)),
  });
  draw(); void needsPdf; void fileUrl;
}
