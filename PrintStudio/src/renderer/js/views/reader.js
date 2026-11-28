import { $, $$, esc, call, run, toast, modal, icon, actions, loading } from '../util.js';
import { S } from '../state.js';
import { openPdf, getLib } from '../pdfjs.js';
import { openSimpleExport } from '../export-dialog.js';
import { go } from '../main.js';

// أدوات الرسم: select (تحديد النص) | pen | hl | text
const norm = (s) => String(s).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

export async function mount(root) {
  const R = { path: '', name: '', doc: null, n: 0, scale: 1, fit: 'width', rot: 0, two: false, night: false, side: 'thumbs', cur: 1, tool: 'select', color: '#e11d48', ann: {}, pages: [], hits: [], hitI: -1, tasks: new Map(), rendered: new Set(), texts: {}, query: '' };
  const lib = await getLib();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let io = null, scrollT = null;

  root.innerHTML = `<div class="rd">
    <div class="rd-bar" id="bar">
      <button class="btn sm" data-act="open">${icon('folder')} فتح PDF</button><span class="sep"></span>
      <button class="btn sm ghost" data-act="prev" title="الصفحة السابقة">${icon('up')}</button><input type="number" id="pn" min="1" value="1" title="رقم الصفحة"><span class="sub" id="pt">/ 0</span><button class="btn sm ghost" data-act="next" title="الصفحة التالية">${icon('down')}</button><span class="sep"></span>
      <button class="btn sm ghost" data-act="zout" title="تصغير">−</button><span class="pill" id="zv" style="min-width:56px;justify-content:center">100%</span><button class="btn sm ghost" data-act="zin" title="تكبير">+</button>
      <button class="btn sm ghost" data-act="fitw" title="ملاءمة العرض">↔</button><button class="btn sm ghost" data-act="fitp" title="ملاءمة الصفحة">⬚</button>
      <button class="btn sm ghost" data-act="rot" title="تدوير العرض">${icon('rot')}</button><button class="btn sm ghost tg" id="b-two" data-act="two" title="صفحتان">▯▯</button><button class="btn sm ghost tg" id="b-night" data-act="night" title="الوضع الليلي">☾</button><button class="btn sm ghost" data-act="full" title="ملء الشاشة">⛶</button><span class="sep"></span>
      <input type="text" id="q" placeholder="بحث في النص…"><button class="btn sm ghost" data-act="sprev">‹</button><button class="btn sm ghost" data-act="snext">›</button><span class="sub" id="sc"></span><span class="sep"></span>
      <button class="btn sm ghost tg on" data-tool="select" title="تحديد ونسخ النص">${icon('txt')} تحديد</button><button class="btn sm ghost tg" data-tool="pen">✎ قلم</button><button class="btn sm ghost tg" data-tool="hl">▭ تظليل</button><button class="btn sm ghost tg" data-tool="text">T نص</button>
      <input type="color" id="col" value="#e11d48" style="width:34px;height:30px;border:2px solid var(--edge2);border-radius:6px;background:none;padding:0"><button class="btn sm ghost" data-act="undo">↶ تراجع</button><button class="btn sm green" data-act="saveann">${icon('save')} حفظ نسخة بالتعليقات</button><span class="sep"></span>
      <button class="btn sm purple" data-act="ocr">${icon('ocr')} تعرّف على الصفحة</button><button class="btn sm ghost" data-act="pimg">${icon('img')} حفظ الصفحة صورة</button><button class="btn sm ghost" data-act="pextract">استخراج الصفحة PDF</button><button class="btn sm ghost" data-act="print">${icon('printer')} طباعة</button>
    </div>
    <div class="rd-body"><div class="rd-side" id="side" hidden></div><div class="rd-main sel" id="main"><div class="rd-empty" id="empty"><div style="font-size:60px">📄</div><h2>قارئ PDF</h2><p>افتح ملف PDF لقراءته مع بحث وتكبير وتعليقات وأدوات متقدمة.</p><button class="btn lg" data-act="open">${icon('folder')} فتح ملف PDF</button></div></div></div>
    <div class="rd-hint" id="hint" hidden></div></div>`;
  const main = $('#main', root), side = $('#side', root);
  const hint = (t) => { const h = $('#hint', root); h.textContent = t; h.hidden = !t; };

  const pageDims = (i) => { const p = R.pages[i - 1]; const rot = R.rot % 360; const w = rot % 180 ? p.h : p.w, h = rot % 180 ? p.w : p.h; return { w, h, rot }; };
  function computeScale() {
    if (!R.doc) return; const d = pageDims(R.cur), W = main.clientWidth - 50 - (R.two ? 30 : 0), H = main.clientHeight - 36;
    if (R.fit === 'width') R.scale = Math.min(4, Math.max(0.2, (R.two ? W / 2 : W) / d.w)); else if (R.fit === 'page') R.scale = Math.min(4, Math.max(0.2, Math.min((R.two ? W / 2 : W) / d.w, H / d.h)));
    $('#zv', root).textContent = Math.round(R.scale * 100) + '%';
  }

  async function load(path) {
    const lo = loading('جارٍ فتح الملف…');
    try {
      const doc = await openPdf(await call('readFile', path)); R.doc = doc; R.path = path; R.name = path.split(/[\\/]/).pop(); R.n = doc.numPages; R.ann = {}; R.hits = []; R.query = ''; R.cur = 1; R.rot = 0; R.texts = {}; $('#q', root).value = ''; $('#sc', root).textContent = '';
      R.pages = []; for (let i = 1; i <= R.n; i++) { const pg = await doc.getPage(i); const v = pg.getViewport({ scale: 1 }); R.pages.push({ w: v.width, h: v.height, rotate: pg.rotate }); }
      $('#pt', root).textContent = '/ ' + R.n; $('#pn', root).max = R.n; $('#pn', root).value = 1; side.hidden = false; await buildSide(); build();
    } finally { lo.close(); }
  }

  function build() {
    if (!R.doc) return; computeScale();
    for (const t of R.tasks.values()) try { t.cancel(); } catch {} R.tasks.clear(); R.rendered.clear(); if (io) io.disconnect();
    main.innerHTML = ''; main.classList.toggle('two', R.two);
    io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) renderPageN(+e.target.dataset.n); }, { root: main, rootMargin: '600px 0px' });
    for (let i = 1; i <= R.n; i++) { const d = pageDims(i); const w = document.createElement('div'); w.className = 'pgw' + (R.night ? ' night' : ''); w.dataset.n = i; w.style.width = Math.round(d.w * R.scale) + 'px'; w.style.height = Math.round(d.h * R.scale) + 'px'; main.append(w); io.observe(w); }
    scrollToPage(R.cur, false);
  }

  async function renderPageN(n) {
    if (R.rendered.has(n)) return; R.rendered.add(n); const w = main.querySelector(`.pgw[data-n="${n}"]`); if (!w) return;
    try {
      const page = await R.doc.getPage(n); const vp = page.getViewport({ scale: R.scale, rotation: (page.rotate + R.rot) % 360 });
      const cv = document.createElement('canvas'); cv.className = 'pg'; cv.width = Math.floor(vp.width * dpr); cv.height = Math.floor(vp.height * dpr); cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px';
      w.style.width = Math.round(vp.width) + 'px'; w.style.height = Math.round(vp.height) + 'px'; w.prepend(cv);
      const task = page.render({ canvasContext: cv.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null, background: '#ffffff' }); R.tasks.set(n, task); await task.promise;
      const tl = document.createElement('div'); tl.className = 'textLayer'; tl.style.setProperty('--total-scale-factor', vp.scale); tl.style.setProperty('--scale-factor', vp.scale); w.append(tl);
      try { await new lib.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp }).render(); } catch {}
      const an = document.createElement('canvas'); an.className = 'an'; an.width = Math.floor(vp.width); an.height = Math.floor(vp.height); an.style.width = vp.width + 'px'; an.style.height = vp.height + 'px'; w.append(an); wireAnn(an, n); drawAnn(n);
      markHits(n);
    } catch (e) { if (!/cancel/i.test(String(e && e.name) + String(e && e.message))) { R.rendered.delete(n); } }
  }

  // ---------- التعليقات ----------
  function wireAnn(an, n) {
    an.style.pointerEvents = R.tool === 'select' ? 'none' : 'auto'; an.style.cursor = R.tool === 'text' ? 'text' : 'crosshair';
    an.onpointerdown = (e) => {
      if (R.rot % 360) return toast('أعد التدوير إلى 0° لإضافة تعليقات', 'warn'); const r = an.getBoundingClientRect(); const pt = (ev) => [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height];
      const list = (R.ann[n] = R.ann[n] || []); const p0 = pt(e);
      if (R.tool === 'text') { const m = modal(`<h2>إضافة نص</h2><input type="text" id="tt" style="width:100%" placeholder="اكتب النص…" maxlength="200"><div class="foot"><button class="btn green" id="ok">إضافة</button><button class="btn ghost" id="no">إلغاء</button></div>`); $('#no', m).onclick = () => m.close(); const add = () => { const t = $('#tt', m).value.trim(); if (t) { list.push({ type: 'text', page: n - 1, x: p0[0], y: p0[1], text: t, color: R.color, size: 14 }); drawAnn(n); } m.close(); }; $('#ok', m).onclick = add; $('#tt', m).onkeydown = (k) => { if (k.key === 'Enter') add(); }; setTimeout(() => $('#tt', m).focus(), 50); return; }
      e.preventDefault(); an.setPointerCapture(e.pointerId); const it = R.tool === 'pen' ? { type: 'ink', page: n - 1, points: [p0], color: R.color, width: 0.003 } : { type: 'highlight', page: n - 1, rect: { x: p0[0], y: p0[1], w: 0, h: 0 }, color: R.color === '#e11d48' ? '#ffe600' : R.color, opacity: 0.35 }; list.push(it);
      an.onpointermove = (ev) => { const q = pt(ev); if (it.type === 'ink') it.points.push(q); else it.rect = { x: Math.min(p0[0], q[0]), y: Math.min(p0[1], q[1]), w: Math.abs(q[0] - p0[0]), h: Math.abs(q[1] - p0[1]) }; drawAnn(n); };
      an.onpointerup = () => { an.onpointermove = null; an.onpointerup = null; if ((it.type === 'ink' && it.points.length < 2) || (it.type === 'highlight' && (it.rect.w < 0.004 || it.rect.h < 0.004))) list.splice(list.indexOf(it), 1); drawAnn(n); hint(`${totalAnn()} تعليق — اضغط «حفظ نسخة بالتعليقات» لتثبيتها في ملف جديد`); };
    };
  }
  const totalAnn = () => Object.values(R.ann).reduce((a, l) => a + l.length, 0);
  function drawAnn(n) {
    const an = main.querySelector(`.pgw[data-n="${n}"] canvas.an`); if (!an) return; const c = an.getContext('2d'), W = an.width, H = an.height; c.clearRect(0, 0, W, H);
    for (const it of R.ann[n] || []) {
      if (it.type === 'ink') { c.strokeStyle = it.color; c.lineWidth = Math.max(1, it.width * W); c.lineCap = c.lineJoin = 'round'; c.beginPath(); it.points.forEach(([x, y], i) => (i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H))); c.stroke(); }
      else if (it.type === 'highlight') { c.globalAlpha = it.opacity; c.fillStyle = it.color; c.fillRect(it.rect.x * W, it.rect.y * H, it.rect.w * W, it.rect.h * H); c.globalAlpha = 1; }
      else if (it.type === 'text') { c.fillStyle = it.color; c.font = `${Math.round(it.size * (W / 595))}px "PS Arabic", Arial, sans-serif`; c.textBaseline = 'top'; c.fillText(it.text, it.x * W, it.y * H); }
    }
  }

  // ---------- البحث ----------
  async function pageText(n) { if (R.texts[n] != null) return R.texts[n]; const pg = await R.doc.getPage(n); const tc = await pg.getTextContent(); return (R.texts[n] = tc.items.map((x) => x.str).join(' ')); }
  async function search(q) {
    R.query = q.trim(); R.hits = []; R.hitI = -1; $$('.textLayer span.hl', main).forEach((s) => s.classList.remove('hl', 'cur'));
    if (!R.query || !R.doc) return ($('#sc', root).textContent = ''); const lo = loading('جارٍ البحث…'); const nq = norm(R.query);
    try { for (let i = 1; i <= R.n; i++) { lo.set(`صفحة ${i}/${R.n}`); const t = norm(await pageText(i)); let k = -1, c = 0; while ((k = t.indexOf(nq, k + 1)) >= 0) { R.hits.push({ page: i, k: c++ }); } } } finally { lo.close(); }
    $('#sc', root).textContent = R.hits.length ? `${R.hits.length} نتيجة` : 'لا نتائج'; R.rendered.forEach(markHits); if (R.hits.length) step(1);
  }
  function markHits(n) {
    if (!R.query) return; const nq = norm(R.query); const tl = main.querySelector(`.pgw[data-n="${n}"] .textLayer`); if (!tl) return;
    $$('span', tl).forEach((s) => { const has = norm(s.textContent).includes(nq); s.classList.toggle('hl', has); });
  }
  function step(d) {
    if (!R.hits.length) return; R.hitI = (R.hitI + d + R.hits.length) % R.hits.length; const h = R.hits[R.hitI]; $('#sc', root).textContent = `${R.hitI + 1} / ${R.hits.length}`;
    scrollToPage(h.page, true); setTimeout(() => { $$('.textLayer span.cur', main).forEach((s) => s.classList.remove('cur')); const tl = main.querySelector(`.pgw[data-n="${h.page}"] .textLayer`); const spans = tl ? $$('span.hl', tl) : []; const s = spans[Math.min(h.k, spans.length - 1)]; if (s) { s.classList.add('cur'); s.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 450);
  }

  // ---------- تنقل ----------
  function scrollToPage(n, smooth) { R.cur = Math.min(Math.max(1, n), R.n || 1); const w = main.querySelector(`.pgw[data-n="${R.cur}"]`); if (w) main.scrollTo({ top: w.offsetTop - 12, behavior: smooth ? 'smooth' : 'auto' }); $('#pn', root).value = R.cur; markCur(); }
  function markCur() { $$('#side .tn', root).forEach((t) => t.classList.toggle('cur', +t.dataset.n === R.cur)); const c = $(`#side .tn[data-n="${R.cur}"]`, root); if (c && R.side === 'thumbs') c.scrollIntoView({ block: 'nearest' }); }
  main.addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(() => { if (!R.doc) return; const top = main.scrollTop + main.clientHeight / 3; let best = 1; for (const w of main.children) { if (w.offsetTop <= top) best = +w.dataset.n; else break; } if (best !== R.cur) { R.cur = best; $('#pn', root).value = best; markCur(); } }, 80); });
  main.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });

  async function buildSide() {
    side.innerHTML = `<div class="seg" style="align-self:center"><button class="${R.side === 'thumbs' ? 'on' : ''}" data-side="thumbs">الصفحات</button><button class="${R.side === 'outline' ? 'on' : ''}" data-side="outline">الفهرس</button></div><div id="sl" class="col"></div>`;
    $$('[data-side]', side).forEach((b) => (b.onclick = () => { R.side = b.dataset.side; buildSide(); }));
    const sl = $('#sl', side);
    if (R.side === 'outline') {
      const ol = await R.doc.getOutline().catch(() => null); if (!ol || !ol.length) { sl.innerHTML = '<div class="sub" style="padding:8px">لا يوجد فهرس في هذا الملف.</div>'; return; }
      const walk = (items, lvl) => items.forEach((it) => { const d = document.createElement('div'); d.className = 'ol'; d.style.paddingInlineStart = 6 + lvl * 12 + 'px'; d.textContent = it.title; d.onclick = async () => { try { let dest = it.dest; if (typeof dest === 'string') dest = await R.doc.getDestination(dest); const idx = await R.doc.getPageIndex(dest[0]); scrollToPage(idx + 1, true); } catch {} }; sl.append(d); if (it.items && it.items.length) walk(it.items, lvl + 1); }); walk(ol, 0); return;
    }
    const ob = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { ob.unobserve(e.target); thumb(+e.target.dataset.n, e.target); } }, { root: side });
    for (let i = 1; i <= R.n; i++) { const t = document.createElement('div'); t.className = 'tn' + (i === R.cur ? ' cur' : ''); t.dataset.n = i; t.innerHTML = `<b>${i}</b>`; const d = R.pages[i - 1]; t.style.aspectRatio = d.w + '/' + d.h; t.onclick = () => scrollToPage(i, true); sl.append(t); ob.observe(t); }
  }
  async function thumb(n, el) { try { const pg = await R.doc.getPage(n); const vp = pg.getViewport({ scale: 150 / pg.getViewport({ scale: 1 }).width }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp, background: '#fff' }).promise; el.prepend(cv); } catch {} }

  function zoom(f) { if (!R.doc) return; R.fit = 'free'; R.scale = Math.min(5, Math.max(0.2, R.scale * f)); $('#zv', root).textContent = Math.round(R.scale * 100) + '%'; const keep = R.cur; build(); scrollToPage(keep, false); }
  function setTool(t) { R.tool = t; $$('[data-tool]', root).forEach((b) => b.classList.toggle('on', b.dataset.tool === t)); main.classList.toggle('sel', t === 'select'); $$('canvas.an', main).forEach((a) => { a.style.pointerEvents = t === 'select' ? 'none' : 'auto'; a.style.cursor = t === 'text' ? 'text' : 'crosshair'; }); hint(t === 'select' ? '' : t === 'pen' ? 'ارسم بالفأرة على الصفحة' : t === 'hl' ? 'اسحب لتظليل منطقة' : 'اضغط على الصفحة لإضافة نص'); }
  $$('[data-tool]', root).forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  $('#col', root).onchange = (e) => (R.color = e.target.value);
  $('#pn', root).onchange = (e) => scrollToPage(+e.target.value, true);
  $('#q', root).onkeydown = (e) => { if (e.key === 'Enter') { if (R.query === e.target.value.trim() && R.hits.length) step(e.shiftKey ? -1 : 1); else search(e.target.value); } };
  const keyH = (e) => { if (!R.doc || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { if (e.ctrlKey && e.key === 'f') { e.preventDefault(); $('#q', root).focus(); } return; }
    if (e.key === 'PageDown' || e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); scrollToPage(R.cur + 1, true); } else if (e.key === 'PageUp') { e.preventDefault(); scrollToPage(R.cur - 1, true); } else if (e.key === '+' || e.key === '=') zoom(1.15); else if (e.key === '-') zoom(1 / 1.15); else if (e.ctrlKey && e.key === 'f') { e.preventDefault(); $('#q', root).focus(); } else if (e.key === 'Home') scrollToPage(1, true); else if (e.key === 'End') scrollToPage(R.n, true); };
  document.addEventListener('keydown', keyH);
  const ro = new ResizeObserver(() => { if (R.doc && R.fit !== 'free') { const k = R.cur; build(); scrollToPage(k, false); } }); ro.observe(main);

  const need = () => { if (!R.doc) throw new Error('افتح ملف PDF أولاً'); };
  async function pageBlob(n, type) { const pg = await R.doc.getPage(n); const vp = pg.getViewport({ scale: 3 }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: x, viewport: vp }).promise; return new Promise((r) => c.toBlob(async (b) => r(await b.arrayBuffer()), type, 0.92)); }
  const stem = () => R.name.replace(/\.pdf$/i, '');

  actions(root, {
    open: (b) => run(b, async () => { const p = await call('pickPdfs', false); if (p[0]) await load(p[0]); }),
    prev: () => scrollToPage(R.cur - 1, true), next: () => scrollToPage(R.cur + 1, true),
    zin: () => zoom(1.15), zout: () => zoom(1 / 1.15), fitw: () => { R.fit = 'width'; build(); }, fitp: () => { R.fit = 'page'; build(); },
    rot: () => { need(); R.rot = (R.rot + 90) % 360; build(); },
    two: (b) => { R.two = !R.two; b.classList.toggle('on', R.two); build(); }, night: (b) => { R.night = !R.night; b.classList.toggle('on', R.night); $$('.pgw', main).forEach((w) => w.classList.toggle('night', R.night)); },
    full: () => { if (document.fullscreenElement) document.exitFullscreen(); else root.firstElementChild.requestFullscreen().catch(() => toast('تعذّر ملء الشاشة', 'warn')); },
    sprev: () => step(-1), snext: () => step(1),
    undo: () => { const l = R.ann[R.cur]; if (l && l.length) { l.pop(); drawAnn(R.cur); } else { for (const k of Object.keys(R.ann).reverse()) if (R.ann[k].length) { R.ann[k].pop(); drawAnn(+k); break; } } },
    saveann: () => { need(); const items = Object.values(R.ann).flat(); if (!items.length) return toast('لا توجد تعليقات بعد — استخدم القلم أو التظليل أو النص', 'warn');
      openSimpleExport({ title: 'حفظ نسخة بالتعليقات', formats: [['pdf', 'PDF']], defaultName: stem() + '-معلّق', onExport: async ({ name, dir }) => call('pdfAnnotate', { input: R.path, items, name, dir }) }); },
    ocr: (b) => run(b, async () => { need(); const lo = loading('جارٍ تجهيز الصفحة…'); try { const buf = await pageBlob(R.cur, 'image/png'); await call('pagesAddBuffers', [buf]); } finally { lo.close(); } sessionStorage.setItem('ocr-from-pages', '1'); toast('أُضيفت الصفحة إلى التعرف الذكي', 'ok'); go('ocr'); }),
    pimg: (b) => run(b, async () => { need(); const dir = S.settings.save.dir || await call('folderPick', true); if (!dir) return; const buf = await pageBlob(R.cur, 'image/png'); const r = await call('imagesSave', { buffers: [buf], name: `${stem()}-صفحة${R.cur}`, dir, format: 'png' }); toast('تم الحفظ: ' + r.files[0].split(/[\\/]/).pop(), 'ok', [{ label: 'فتح المجلد', fn: () => call('reveal', r.files[0]) }]); }),
    pextract: (b) => run(b, async () => { need(); const dir = S.settings.save.dir || await call('folderPick', true); if (!dir) return; const r = await call('pdfTool', { op: 'extract', inputs: [R.path], name: `${stem()}-صفحة${R.cur}`, dir, args: { ranges: String(R.cur) } }); toast('تم الحفظ: ' + r.files[0].split(/[\\/]/).pop(), 'ok', [{ label: 'فتح المجلد', fn: () => call('reveal', r.files[0]) }]); }),
    print: () => { need(); sessionStorage.setItem('print-preload', R.path); go('print'); },
  });

  const pre = sessionStorage.getItem('reader-preload'); if (pre) { sessionStorage.removeItem('reader-preload'); await run(null, () => load(pre)); }
  return () => { document.removeEventListener('keydown', keyH); ro.disconnect(); if (io) io.disconnect(); for (const t of R.tasks.values()) try { t.cancel(); } catch {} if (document.fullscreenElement) document.exitFullscreen(); };
}
