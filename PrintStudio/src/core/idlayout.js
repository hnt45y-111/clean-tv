'use strict';
// تخطيط الهويات والباجات على ورقة: ترتيب تلقائي + تصدير PDF / صورة / Word (صور عائمة قابلة للتحريك).
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { sizeMm, mmToPt, mmToPx } = require('./pagesize');
const { buildIdDocx } = require('./export-docx');

const PRESETS = { 'CR80': [85.6, 54], 'بطاقة 90×60': [90, 60], 'صورة 35×45': [35, 45], 'صورة 3×4': [30, 40], 'باج 100×70': [100, 70], 'باج 74×105 (A7)': [74, 105] };

/**
 * ترتيب تلقائي. identities: [{id, front?, back?}] ← تُرسَل الأوجه المتوفرة.
 * يعيد عناصر {key, identity, side, x, y, w, h} بالملّيمتر مرتبة شبكياً ومتمركزة.
 */
function autoArrange(identities, { paper = 'A4', orientation = 'portrait', cardW = 85.6, cardH = 54, gap = 5, margin = 10, pairMode = 'side', frontSide = 'right' } = {}) {
  const P = sizeMm(paper, orientation);
  const units = identities.map((idn) => {
    const sides = ['front', 'back'].filter((s) => idn[s]);
    const both = sides.length === 2;
    const uw = both && pairMode === 'side' ? cardW * 2 + gap : cardW, uh = both && pairMode === 'stack' ? cardH * 2 + gap : cardH;
    return { idn, sides, uw, uh, both };
  });
  const items = []; let x = margin, y = margin, rowH = 0, usable = P.w - 2 * margin;
  const rows = [[]];
  for (const u of units) {
    const cur = rows[rows.length - 1]; const w = cur.reduce((a, q) => a + q.uw + gap, -gap);
    if (cur.length && w + gap + u.uw > usable) rows.push([u]); else cur.push(u);
  }
  for (const row of rows) {
    const rw = row.reduce((a, q) => a + q.uw + gap, -gap); x = margin + Math.max(0, (usable - rw) / 2); rowH = Math.max(...row.map((q) => q.uh));
    for (const u of row) {
      u.sides.forEach((side, i) => {
        const idx = frontSide === 'right' && side === 'front' ? 1 : frontSide === 'right' ? 0 : i; const dx = u.both && pairMode === 'side' ? idx * (cardW + gap) : 0, dy = u.both && pairMode === 'stack' ? i * (cardH + gap) : 0;
        items.push({ key: `${u.idn.id}:${side}`, identity: u.idn.id, side, x: round(x + dx), y: round(y + dy), w: cardW, h: cardH, rot: 0 });
      });
      x += u.uw + gap;
    }
    y += rowH + gap;
  }
  const overflow = items.some((it) => it.y + it.h > P.h - margin + 0.01);
  // وزّع على صفحات إن لزم: نُرجع كذلك عدد الصفحات بحسب ارتفاع الورقة
  const perPage = []; let page = 0, base = 0;
  for (const it of items) { if (it.y - base + it.h > P.h - margin + 0.01) { page++; base = it.y - margin; } perPage.push({ ...it, page, y: round(it.y - base) }); }
  return { items: perPage, pages: page + 1, overflow };
}
const round = (n) => Math.round(n * 100) / 100;

/** يجهّز صورة بطاقة بحجمها الفعلي (مع إطار اختياري) */
async function prepCard(file, it, { dpi = 300, border = true, borderMm = 0.3 }) {
  const w = Math.max(2, mmToPx(it.w, dpi)), h = Math.max(2, mmToPx(it.h, dpi));
  let img = sharp(file).resize({ width: w, height: h, fit: 'fill' }).flatten({ background: '#ffffff' });
  const buf = await img.png().toBuffer();
  if (!border) return buf;
  const bw = Math.max(1, Math.round(mmToPx(borderMm, dpi)));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${bw / 2}" y="${bw / 2}" width="${w - bw}" height="${h - bw}" fill="none" stroke="#444" stroke-width="${bw}"/></svg>`;
  return sharp(buf).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

async function prepAll(layout, dpi) {
  const out = [];
  for (const it of layout.items) { if (!it.file) continue; out.push({ ...it, data: await prepCard(it.file, it, { dpi, border: layout.border !== false, borderMm: layout.borderMm || 0.3 }) }); }
  return out;
}
function byPage(items) { const m = new Map(); for (const it of items) { const k = it.page || 0; if (!m.has(k)) m.set(k, []); m.get(k).push(it); } return [...m.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]); }

async function renderPageImage(P, items, dpi) {
  const W = mmToPx(P.w, dpi), H = mmToPx(P.h, dpi); const comps = [];
  for (const it of items) {
    let s = sharp(it.data); const rot = ((it.rot || 0) % 360 + 360) % 360;
    if (rot) s = s.rotate(rot, { background: { r: 255, g: 255, b: 255, alpha: 0 } });
    const buf = await s.png().toBuffer(); const m = await sharp(buf).metadata();
    const cx = mmToPx(it.x + it.w / 2, dpi), cy = mmToPx(it.y + it.h / 2, dpi);
    let left = Math.round(cx - m.width / 2), top = Math.round(cy - m.height / 2), input = buf;
    // اقتطع ما يخرج عن الورقة
    const cl = Math.max(0, -left), ct = Math.max(0, -top), cr = Math.max(0, left + m.width - W), cb = Math.max(0, top + m.height - H);
    if (cl || ct || cr || cb) { const nw = m.width - cl - cr, nh = m.height - ct - cb; if (nw < 1 || nh < 1) continue; input = await sharp(buf).extract({ left: cl, top: ct, width: nw, height: nh }).toBuffer(); left += cl; top += ct; }
    comps.push({ input, left, top });
  }
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite(comps).withMetadata({ density: dpi });
}

/** layout: {paper, orientation, border, items:[{file,x,y,w,h,rot,page?}]} → {format:'pdf'|'png'|'jpg'|'docx'} */
async function exportLayout(layout, format, { dpi = 300, quality = 92 } = {}) {
  const P = sizeMm(layout.paper || 'A4', layout.orientation || 'portrait');
  const items = await prepAll(layout, dpi); const pages = byPage(items); if (!pages.length) throw new Error('لا توجد هويات في الورقة');
  if (format === 'pdf') {
    const doc = await PDFDocument.create(); doc.setCreator('Print Studio');
    for (const pg of pages) {
      const page = doc.addPage([mmToPt(P.w), mmToPt(P.h)]);
      for (const it of pg) {
        const img = await doc.embedPng(it.data); const w = mmToPt(it.w), h = mmToPt(it.h), th = (-(it.rot || 0) * Math.PI) / 180;
        const cx = mmToPt(it.x + it.w / 2), cy = mmToPt(P.h) - mmToPt(it.y + it.h / 2);
        const x = cx + (-w / 2) * Math.cos(th) - (-h / 2) * Math.sin(th), y = cy + (-w / 2) * Math.sin(th) + (-h / 2) * Math.cos(th);
        page.drawImage(img, { x, y, width: w, height: h, rotate: { type: 'degrees', angle: (-(it.rot || 0)) } });
      }
    }
    return { buffer: Buffer.from(await doc.save({ useObjectStreams: true })), pages: pages.length };
  }
  if (format === 'docx') return { buffer: await buildIdDocx({ paper: layout.paper || 'A4', orientation: layout.orientation || 'portrait', items }), pages: 1, note: pages.length > 1 ? 'Word يضم الصفحة الأولى فقط؛ استخدم PDF للصفحات المتعددة' : '' };
  if (format === 'png' || format === 'jpg') {
    const bufs = [];
    for (const pg of pages) { const s = await renderPageImage(P, pg, dpi); bufs.push(await (format === 'png' ? s.png() : s.jpeg({ quality, mozjpeg: true })).toBuffer()); }
    return { buffers: bufs, buffer: bufs[0], pages: bufs.length };
  }
  throw new Error('صيغة غير مدعومة: ' + format);
}
module.exports = { PRESETS, autoArrange, exportLayout };
