'use strict';
// معالجة الصور: تدوير، قص، سطوع/تباين، كشف حدود الورقة، تحسين للـ OCR.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function info(file) { const m = await sharp(file).metadata(); return { width: m.width, height: m.height, format: m.format }; }

async function rotate(inFile, outFile, deg) {
  await sharp(inFile).rotate(((deg % 360) + 360) % 360).png().toFile(outFile);
}

/** crop بإحداثيات نسبية 0..1 {x,y,w,h} */
async function crop(inFile, outFile, r) {
  const { width, height } = await info(inFile);
  const left = Math.max(0, Math.round(r.x * width)), top = Math.max(0, Math.round(r.y * height));
  const w = Math.min(width - left, Math.max(1, Math.round(r.w * width)));
  const h = Math.min(height - top, Math.max(1, Math.round(r.h * height)));
  await sharp(inFile).extract({ left, top, width: w, height: h }).png().toFile(outFile);
}

/** سطوع (-100..100) وتباين (-100..100) */
async function adjust(inFile, outFile, { brightness = 0, contrast = 0 } = {}) {
  const c = 1 + contrast / 100; // ميل
  const a = c, b = 128 * (1 - c) + brightness * 2.55;
  await sharp(inFile).linear(a, b).png().toFile(outFile);
}

/** كشف حدود الورقة: يبحث عن أصغر مستطيل يحوي كل ما يختلف عن لون الخلفية عند الحواف. */
async function detectBounds(file, threshold = 40) {
  const { data, info: i } = await sharp(file).greyscale().resize({ width: 600, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = i;
  const edge = [];
  for (let x = 0; x < w; x++) { edge.push(data[x], data[(h - 1) * w + x]); }
  for (let y = 0; y < h; y++) { edge.push(data[y * w], data[y * w + w - 1]); }
  edge.sort((p, q) => p - q);
  const bg = edge[Math.floor(edge.length / 2)];
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const rowHits = new Uint32Array(h), colHits = new Uint32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.abs(data[y * w + x] - bg) > threshold) { rowHits[y]++; colHits[x]++; }
  }
  const minRow = Math.max(2, w * 0.01), minCol = Math.max(2, h * 0.01);
  for (let y = 0; y < h; y++) if (rowHits[y] > minRow) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let x = 0; x < w; x++) if (colHits[x] > minCol) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  if (x1 < 0 || x1 - x0 < w * 0.1 || y1 - y0 < h * 0.1) return null;
  const pad = 0.005;
  const r = { x: Math.max(0, x0 / w - pad), y: Math.max(0, y0 / h - pad), w: 0, h: 0 };
  r.w = Math.min(1 - r.x, (x1 - x0 + 1) / w + 2 * pad); r.h = Math.min(1 - r.y, (y1 - y0 + 1) / h + 2 * pad);
  // إن كانت الحدود تغطي الصفحة كاملة تقريباً فلا فائدة
  if (r.w > 0.98 && r.h > 0.98) return null;
  return r;
}

/** يقدّر زاوية الميل (-10..10 درجة) بإسقاط أفقي ويعيد الزاوية بالدرجات. */
async function estimateSkew(file) {
  const { data, info: i } = await sharp(file).greyscale().resize({ width: 700, withoutEnlargement: true }).threshold(160).negate().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = i;
  const pts = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[y * w + x] > 128) pts.push([x - w / 2, y - h / 2]);
  if (pts.length < 200) return 0;
  let best = 0, bestScore = -1;
  for (let a = -10; a <= 10; a += 0.5) {
    const t = (a * Math.PI) / 180, s = Math.sin(t), c = Math.cos(t), bins = new Float32Array(h * 2);
    for (const [x, y] of pts) { const yy = Math.round(-x * s + y * c + h); if (yy >= 0 && yy < bins.length) bins[yy]++; }
    let sc = 0; for (const v of bins) sc += v * v;
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return best;
}

/** تحسين للـ OCR: تدرج رمادي، تطبيع، رفع الدقة إن كانت الصورة صغيرة، حدة خفيفة. */
async function preprocessForOcr(input, { minWidth = 1600 } = {}) {
  let img = sharp(input).greyscale().normalise();
  const m = await sharp(input).metadata();
  if (m.width < minWidth) img = img.resize({ width: minWidth, kernel: 'lanczos3' });
  return img.sharpen({ sigma: 0.8 }).png().toBuffer();
}

async function thumbnail(inFile, outFile, w = 240) {
  await sharp(inFile).resize({ width: w, height: Math.round(w * 1.5), fit: 'inside' }).jpeg({ quality: 70 }).toFile(outFile);
}

/** تحويل لون: color | gray | bw */
async function colorMode(inFile, outFile, mode) {
  let s = sharp(inFile);
  if (mode === 'gray') s = s.greyscale();
  else if (mode === 'bw') s = s.greyscale().threshold(150);
  await s.png().toFile(outFile);
}

/** يخرج صورة JPG/PNG بدقة (يكتب وصف DPI) وجودة. */
async function exportImage(inFile, outFile, { format = 'jpg', dpi = 300, quality = 90, color = 'color' } = {}) {
  let s = sharp(inFile);
  if (color === 'gray') s = s.greyscale(); else if (color === 'bw') s = s.greyscale().threshold(150);
  s = s.withMetadata({ density: dpi });
  if (format === 'png') s = s.png({ compressionLevel: 9 }); else s = s.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true });
  await s.toFile(outFile);
}

module.exports = { info, rotate, crop, adjust, detectBounds, estimateSkew, preprocessForOcr, thumbnail, colorMode, exportImage };
