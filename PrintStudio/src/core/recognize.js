'use strict';
// خط المعالجة الكامل: صورة → (جداول + نص) → نموذج مستند قابل للتحرير والتصدير.
const sharp = require('sharp');
const { PSM } = require('./ocr');
const tables = require('./tables');
const { linesToBlocks, dirOf, arabicRatio, LOW_CONF } = require('./docmodel');
const imaging = require('./imaging');

async function inkRatio(buf) {
  const { data } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  let n = 0; for (const v of data) if (v < 140) n++; return n / data.length;
}

async function ocrCell(ocr, input, cell, W, H) {
  const inset = 5;
  const x0 = Math.max(0, cell.x0 + inset), y0 = Math.max(0, cell.y0 + inset);
  const x1 = Math.min(W, cell.x1 - inset), y1 = Math.min(H, cell.y1 - inset);
  if (x1 - x0 < 6 || y1 - y0 < 6) return { text: '', conf: 100 };
  let s = sharp(input).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).greyscale().normalise();
  if (y1 - y0 < 80) s = s.resize({ height: (y1 - y0) * 2, kernel: 'lanczos3' });
  const buf = await s.extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#ffffff' }).png().toBuffer();
  if ((await inkRatio(buf)) < 0.004) return { text: '', conf: 100 };
  let r = await ocr.recognize(buf, { psm: PSM.SINGLE_BLOCK });
  if (!r.lines.length) r = await ocr.recognize(buf, { psm: PSM.SINGLE_LINE });
  if (!r.lines.length) r = await ocr.recognize(buf, { psm: PSM.SPARSE_TEXT });
  if (!r.lines.length) return { text: '', conf: 0, minConf: 0, unread: true };
  const text = r.lines.map((l) => l.text).join('\n').trim();
  const words = r.lines.flatMap((l) => l.words);
  const conf = words.length ? Math.round(words.reduce((a, w) => a + w.conf, 0) / words.length) : r.confidence;
  return { text, conf, minConf: words.length ? Math.min(...words.map((w) => w.conf)) : conf };
}

/** يبني كتلة جدول من شبكة مكتشفة + OCR للخلايا. */
async function buildTable(ocr, input, t, W, H) {
  const cells = [];
  for (const c of t.cells) { const r = await ocrCell(ocr, input, c, W, H); cells.push({ ...c, text: r.text, conf: r.conf, low: !!r.unread || (!!r.text && (r.minConf ?? r.conf) < LOW_CONF) }); }
  const all = cells.map((c) => c.text).join(' ');
  const dir = dirOf(all, 'rtl');
  let outCells = cells.map((c) => ({ r: c.r, c: c.c, rs: c.rs, cs: c.cs, text: c.text, conf: c.conf, low: !!c.low }));
  const widths = []; for (let i = 0; i < t.cols; i++) widths.push(t.xs[i + 1] - t.xs[i]);
  const heights = []; for (let i = 0; i < t.rows; i++) heights.push(t.ys[i + 1] - t.ys[i]);
  let colWidths = widths;
  if (dir === 'rtl') { // العمود الأول = الأيمن، كما في الورقة
    outCells = outCells.map((c) => ({ ...c, c: t.cols - 1 - c.c - (c.cs - 1) }));
    colWidths = [...widths].reverse();
  }
  return { type: 'table', dir, rows: t.rows, cols: t.cols, cells: outCells, colWidths, rowHeights: heights, kind: t.kind, bbox: t.bbox, header: true };
}

/**
 * @param {Buffer|string} input  صورة الصفحة
 * @param {{ocr:Ocr, mode?:'auto'|'text'|'table', dpi?:number}} opts
 */
async function recognizePage(input, { ocr, mode = 'auto', dpi } = {}) {
  const meta = await sharp(input).metadata();
  const W = meta.width, H = meta.height;
  dpi = dpi || Math.round(W / 8.27);
  const warnings = [];
  let tabs = [];
  if (mode !== 'text') { try { tabs = await tables.detectBordered(input); } catch (e) { warnings.push('تعذّر كشف الجداول: ' + e.message); } }

  // اطمس مناطق الجداول قبل OCR الصفحة
  let pageBuf = await sharp(input).greyscale().normalise().png().toBuffer();
  if (tabs.length) {
    const rects = tabs.map((t) => ({ input: { create: { width: t.bbox.x1 - t.bbox.x0 + 12, height: t.bbox.y1 - t.bbox.y0 + 12, channels: 3, background: '#ffffff' } }, left: Math.max(0, t.bbox.x0 - 6), top: Math.max(0, t.bbox.y0 - 6) }));
    pageBuf = await sharp(pageBuf).composite(rects.map((r) => ({ ...r, input: r.input }))).png().toBuffer();
  }
  const scale = W < 1600 ? 1600 / W : 1;
  const ocrBuf = scale > 1 ? await sharp(pageBuf).resize({ width: 1600, kernel: 'lanczos3' }).png().toBuffer() : pageBuf;
  const res = await ocr.recognize(ocrBuf, { psm: PSM.AUTO });
  res.lines = await refineLines(ocr, ocrBuf, res.lines);
  let lines = res.lines.map((l) => ({ ...l, bbox: sc(l.bbox, 1 / scale), words: l.words.map((w) => ({ ...w, bbox: sc(w.bbox, 1 / scale) })) }));

  if (!tabs.length && mode !== 'text') {
    const bl = tables.detectBorderless(lines, W);
    if (bl.length) { tabs = bl; const used = new Set(bl.flatMap((t) => t.lineIdx)); lines = lines.filter((_, i) => !used.has(i)); warnings.push('جدول بلا حدود: تم تخمين الأعمدة من مواضع الكلمات — راجع النتيجة.'); }
  }

  const tBlocks = []; for (const t of tabs) tBlocks.push(await buildTable(ocr, input, t, W, H));
  const pBlocks = linesToBlocks(lines, { pageW: W, pageH: H, dpi });
  const blocks = [...pBlocks, ...tBlocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);

  const lowWords = pBlocks.reduce((s, b) => s + (b.lowConfCount || 0), 0) + tBlocks.reduce((s, t) => s + t.cells.filter((c) => c.low).length, 0);
  const confs = [...pBlocks.map((b) => b.conf), ...tBlocks.flatMap((t) => t.cells.filter((c) => c.text).map((c) => c.conf))];
  const confidence = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : 0;
  if (!blocks.length) warnings.push('لم يُعثر على نص في هذه الصفحة.');
  if (confidence && confidence < 75) warnings.push('جودة التعرف منخفضة — الصورة قد تكون غير واضحة. راجع النص قبل التصدير.');
  return { width: W, height: H, blocks, stats: { confidence, lowWords, tables: tBlocks.length, blocks: blocks.length }, warnings };
}
/** أسطر فيها كلمات بثقة شبه معدومة تُعاد قراءتها كسطر منفرد بدقة أعلى؛ يُعتمد الأفضل. */
async function refineLines(ocr, buf, lines) {
  const meta = await sharp(buf).metadata();
  const out = [];
  for (const l of lines) {
    const bad = l.words.some((w) => w.conf < 40);
    if (!bad) { out.push(l); continue; }
    const pad = 10, x0 = Math.max(0, l.bbox.x0 - pad), y0 = Math.max(0, l.bbox.y0 - pad);
    const x1 = Math.min(meta.width, l.bbox.x1 + pad), y1 = Math.min(meta.height, l.bbox.y1 + pad);
    try {
      const crop = await sharp(buf).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).resize({ height: Math.max(90, (y1 - y0) * 2), kernel: 'lanczos3' }).extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#ffffff' }).png().toBuffer();
      const r = await ocr.recognize(crop, { psm: PSM.SINGLE_LINE });
      const words = r.lines.flatMap((x) => x.words);
      if (!words.length) { out.push(l); continue; }
      const avg = (ws) => ws.reduce((a, w) => a + w.conf, 0) / (ws.length || 1);
      if (avg(words) > avg(l.words) + 3) {
        // أعد توزيع الإحداثيات تقريباً: الكلمات تأخذ صندوق السطر (الإحداثيات الدقيقة غير مطلوبة بعد الدمج)
        out.push({ ...l, text: r.lines.map((x) => x.text).join(' ').trim(), words: words.map((w) => ({ ...w, bbox: l.bbox })), conf: avg(words), refined: true });
        continue;
      }
    } catch {}
    out.push(l);
  }
  return out;
}
const sc = (b, k) => ({ x0: Math.round(b.x0 * k), y0: Math.round(b.y0 * k), x1: Math.round(b.x1 * k), y1: Math.round(b.y1 * k) });

/** مستند كامل من عدة صور. */
async function recognizeDocument(inputs, { ocr, mode = 'auto', dpi = 300, onProgress } = {}) {
  const pages = [];
  for (let i = 0; i < inputs.length; i++) {
    if (onProgress) onProgress({ page: i + 1, total: inputs.length });
    pages.push(await recognizePage(inputs[i], { ocr, mode, dpi }));
  }
  const confidence = pages.length ? Math.round(pages.reduce((a, p) => a + p.stats.confidence, 0) / pages.length) : 0;
  return { version: 1, pages, stats: { confidence, lowWords: pages.reduce((a, p) => a + p.stats.lowWords, 0), tables: pages.reduce((a, p) => a + p.stats.tables, 0) } };
}

module.exports = { recognizePage, recognizeDocument, arabicRatio, imaging };
