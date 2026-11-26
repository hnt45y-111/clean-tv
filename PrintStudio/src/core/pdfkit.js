'use strict';
// عمليات PDF (pdf-lib): صور→PDF، PDF قابل للبحث، دمج/تقسيم/استخراج/ترتيب/تدوير/ترقيم/علامة مائية.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument, StandardFonts, degrees, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { sizeMm, mmToPt } = require('./pagesize');

const FONT_FILE = path.join(path.dirname(require.resolve('@fontsource/noto-sans-arabic/package.json')), 'files', 'noto-sans-arabic-arabic-400-normal.woff');

async function embedArabicFont(doc) { doc.registerFontkit(fontkit); return doc.embedFont(fs.readFileSync(FONT_FILE), { subset: true }); }

async function prepImage(file, { quality = 85, maxPx = 0 } = {}) {
  let s = sharp(file); const m = await sharp(file).metadata();
  if (maxPx && Math.max(m.width, m.height) > maxPx) s = s.resize({ width: m.width >= m.height ? maxPx : undefined, height: m.height > m.width ? maxPx : undefined });
  const hasAlpha = m.hasAlpha;
  if (m.format === 'png' && !hasAlpha && quality >= 100) return { buf: await s.png().toBuffer(), kind: 'png' };
  return { buf: await s.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer(), kind: 'jpg' };
}

/** pageSize: 'A4'|... أو 'fit' (حجم الصورة عند dpi). الصورة تُوضع وسط الصفحة بنسبتها. */
async function imagesToPdf(files, { pageSize = 'A4', orientation = 'portrait', quality = 85, dpi = 300, marginMm = 0, searchable = null } = {}) {
  const doc = await PDFDocument.create(); doc.setCreator('Print Studio'); doc.setProducer('Print Studio');
  let font = null;
  for (let i = 0; i < files.length; i++) {
    const { buf, kind } = await prepImage(files[i], { quality });
    const img = kind === 'png' ? await doc.embedPng(buf) : await doc.embedJpg(buf);
    let pw, ph;
    if (pageSize === 'fit') { pw = (img.width / dpi) * 72; ph = (img.height / dpi) * 72; }
    else { let o = orientation; const sz = sizeMm(pageSize, o); pw = mmToPt(sz.w); ph = mmToPt(sz.h); if (orientation === 'auto') { /* غير مستخدم */ } }
    const page = doc.addPage([pw, ph]);
    const mg = mmToPt(marginMm), aw = pw - 2 * mg, ah = ph - 2 * mg;
    const k = Math.min(aw / img.width, ah / img.height);
    const w = img.width * k, h = img.height * k, x = (pw - w) / 2, y = (ph - h) / 2;
    page.drawImage(img, { x, y, width: w, height: h });
    const layer = searchable && searchable[i];
    if (layer && layer.lines && layer.lines.length) {
      if (!font) font = await embedArabicFont(doc);
      for (const ln of layer.lines) {
        const txt = String(ln.text || '').replace(/[‎‏‪-‮]/g, '').replace(/[^\S\n]+/g, ' ').trim();
        if (!txt) continue;
        const lx = x + (ln.bbox.x0 / layer.width) * w, lh = ((ln.bbox.y1 - ln.bbox.y0) / layer.height) * h;
        const ly = y + h - (ln.bbox.y1 / layer.height) * h;
        const safe = [...txt].filter((ch) => { try { return font.getCharacterSet().includes(ch.codePointAt(0)); } catch { return true; } }).join('');
        if (!safe.trim()) continue;
        try { page.drawText(safe, { x: lx, y: ly, size: Math.max(4, lh * 0.8), font, opacity: 0, color: rgb(0, 0, 0) }); } catch {}
      }
    }
  }
  return Buffer.from(await doc.save({ useObjectStreams: true }));
}

const load = async (buf) => PDFDocument.load(buf, { ignoreEncryption: false, updateMetadata: false });

/** ranges: "1-3,5,8-" → [0,1,2,4,7...] (0-based) */
function parseRanges(str, total) {
  const out = [];
  for (const part of String(str).split(/[,،\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
    if (m) { const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : total; if (a < 1 || b > total || a > b) throw new Error('نطاق صفحات غير صالح: ' + part); for (let i = a; i <= b; i++) out.push(i - 1); }
    else if (/^\d+$/.test(part)) { const n = +part; if (n < 1 || n > total) throw new Error('رقم صفحة خارج النطاق: ' + part); out.push(n - 1); }
    else throw new Error('صيغة نطاق غير صالحة: ' + part);
  }
  if (!out.length) throw new Error('لم تحدد أي صفحات');
  return out;
}

async function pageCount(buf) { return (await load(buf)).getPageCount(); }

async function merge(bufs) {
  const out = await PDFDocument.create();
  for (const b of bufs) { const d = await load(b); const pgs = await out.copyPages(d, d.getPageIndices()); pgs.forEach((p) => out.addPage(p)); }
  return Buffer.from(await out.save({ useObjectStreams: true }));
}
/** يستخرج الصفحات (بالترتيب المعطى — يخدم الاستخراج وإعادة الترتيب معاً). */
async function pick(buf, indices) {
  const d = await load(buf), out = await PDFDocument.create();
  const pgs = await out.copyPages(d, indices); pgs.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save({ useObjectStreams: true }));
}
async function split(buf, { mode = 'each', ranges = '' } = {}) {
  const total = await pageCount(buf); const parts = [];
  if (mode === 'each') for (let i = 0; i < total; i++) parts.push({ label: String(i + 1), buf: await pick(buf, [i]) });
  else for (const r of String(ranges).split(/[;؛\n]+/).map((s) => s.trim()).filter(Boolean)) parts.push({ label: r.replace(/[^\d\-,]/g, '_'), buf: await pick(buf, parseRanges(r, total)) });
  if (!parts.length) throw new Error('لا توجد أجزاء للتقسيم');
  return parts;
}
async function rotate(buf, deltaDeg, indices) {
  const d = await load(buf); const all = d.getPageIndices();
  for (const i of indices || all) { const p = d.getPage(i); p.setRotation(degrees(((p.getRotation().angle + deltaDeg) % 360 + 360) % 360)); }
  return Buffer.from(await d.save({ useObjectStreams: true }));
}
/** تحسين بلا فقدان: object streams + حذف البيانات الوصفية. */
async function optimize(buf) {
  const d = await load(buf); d.setTitle(''); d.setAuthor(''); d.setSubject(''); d.setKeywords([]); d.setProducer('Print Studio'); d.setCreator('Print Studio');
  return Buffer.from(await d.save({ useObjectStreams: true, addDefaultPage: false }));
}

async function addPageNumbers(buf, { position = 'bottom-center', start = 1, format = '{n}', marginMm = 10, size = 11, arabicDigits = false } = {}) {
  const d = await load(buf); const font = await d.embedFont(StandardFonts.Helvetica); const total = d.getPageCount();
  d.getPages().forEach((p, i) => {
    let n = String(start + i), t = String(total + start - 1);
    if (arabicDigits) { const map = (s) => s.replace(/\d/g, (x) => '٠١٢٣٤٥٦٧٨٩'[x]); n = map(n); t = map(t); }
    // صيغة بأرقام فقط (الأرقام والفواصل تُرسم بخط Helvetica؛ النص العربي لا يُرسم هنا لتفادي كسر الوصل)
    const txt = format.replace('{n}', n).replace('{t}', t).replace(/[^\x20-\x7E٠-٩]/g, '');
    const safe = arabicDigits ? txt.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))) : txt; // Helvetica لا يملك الأرقام الهندية؛ تُرسم لاتينية
    const { width, height } = p.getSize(); const mg = mmToPt(marginMm), w = font.widthOfTextAtSize(safe, size);
    const [v, h] = position.split('-');
    const x = h === 'left' ? mg : h === 'right' ? width - mg - w : (width - w) / 2, y = v === 'top' ? height - mg - size : mg;
    p.drawText(safe, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
  });
  return Buffer.from(await d.save({ useObjectStreams: true }));
}

/** علامة مائية نصية تُرسم كصورة PNG (لتشكيل العربية بشكل صحيح عبر librsvg). */
async function addWatermark(buf, { text = 'سري', opacity = 0.18, angle = 45, color = '#cc0000', sizeRatio = 0.14 } = {}) {
  const d = await load(buf);
  const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 80);
  const S = 1600, fs = 220;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><g transform="rotate(${-angle} ${S / 2} ${S / 2})"><text x="${S / 2}" y="${S / 2 + fs / 3}" font-size="${fs}" font-family="Noto Sans Arabic, DejaVu Sans, Arial" font-weight="bold" text-anchor="middle" fill="${color}">${esc}</text></g></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const img = await d.embedPng(png);
  for (const p of d.getPages()) {
    const { width, height } = p.getSize(); const side = Math.min(width, height) * (0.5 + sizeRatio * 3);
    p.drawImage(img, { x: (width - side) / 2, y: (height - side) / 2, width: side, height: side, opacity });
  }
  return Buffer.from(await d.save({ useObjectStreams: true }));
}

module.exports = { imagesToPdf, parseRanges, pageCount, merge, pick, split, rotate, optimize, addPageNumbers, addWatermark };
