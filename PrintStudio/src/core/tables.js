'use strict';
// كشف الجداول وبنيتها (صفوف/أعمدة/خلايا مدموجة) من خطوط الجدول في الصورة، ثم OCR لكل خلية.
const sharp = require('sharp');

async function loadBinary(input, maxSide = 2600) {
  let s = sharp(input).greyscale();
  const m = await sharp(input).metadata();
  const scale = Math.min(1, maxSide / Math.max(m.width, m.height));
  if (scale < 1) s = s.resize({ width: Math.round(m.width * scale) });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  // عتبة Otsu
  const hist = new Uint32Array(256); for (const v of data) hist[v]++;
  const total = data.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
  thr = Math.min(thr, 200);
  const bin = new Uint8Array(total); for (let i = 0; i < total; i++) bin[i] = data[i] <= thr ? 1 : 0;
  return { bin, w: info.width, h: info.height, scale };
}

/** أقنعة الخطوط الأفقية/العمودية بتحمّل فجوات صغيرة. */
function lineMasks(bin, w, h) {
  const minH = Math.max(30, Math.round(w * 0.03)), minV = Math.max(30, Math.round(h * 0.03)), gap = 3;
  const H = new Uint8Array(w * h), V = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let start = -1, last = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && bin[y * w + x];
      if (on) { if (start < 0) start = x; last = x; }
      else if (start >= 0 && (x === w || x - last > gap)) { if (last - start + 1 >= minH) for (let k = start; k <= last; k++) H[y * w + k] = 1; start = -1; }
    }
  }
  for (let x = 0; x < w; x++) {
    let start = -1, last = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && bin[y * w + x];
      if (on) { if (start < 0) start = y; last = y; }
      else if (start >= 0 && (y === h || y - last > gap)) { if (last - start + 1 >= minV) for (let k = start; k <= last; k++) V[k * w + x] = 1; start = -1; }
    }
  }
  return { H, V };
}

/** مكوّنات متصلة لاتحاد الخطوط (على شبكة مصغّرة ومنفوخة). */
function components(H, V, w, h) {
  const B = 4, gw = Math.ceil(w / B), gh = Math.ceil(h / B), g = new Uint8Array(gw * gh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (H[y * w + x] || V[y * w + x]) g[((y / B) | 0) * gw + ((x / B) | 0)] = 1;
  const lab = new Int32Array(gw * gh).fill(-1); const comps = [];
  for (let i = 0; i < g.length; i++) {
    if (!g[i] || lab[i] >= 0) continue;
    const id = comps.length, st = [i]; lab[i] = id; let x0 = gw, y0 = gh, x1 = 0, y1 = 0;
    while (st.length) {
      const p = st.pop(), px = p % gw, py = (p / gw) | 0;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const q = ny * gw + nx; if (g[q] && lab[q] < 0) { lab[q] = id; st.push(q); }
      }
    }
    comps.push({ x0: x0 * B, y0: y0 * B, x1: Math.min(w - 1, x1 * B + B - 1), y1: Math.min(h - 1, y1 * B + B - 1) });
  }
  return comps;
}

function cluster1D(vals, tol = 4) {
  const out = []; let cur = [];
  for (const v of vals) { if (cur.length && v - cur[cur.length - 1] > tol) { out.push(cur); cur = []; } cur.push(v); }
  if (cur.length) out.push(cur);
  return out.map((c) => Math.round(c.reduce((a, b) => a + b, 0) / c.length));
}

function coverage(mask, w, x0, y0, x1, y1) { // نسبة البكسلات المفعّلة في المستطيل
  let on = 0, n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { n++; if (mask[y * w + x]) on++; }
  return n ? on / n : 0;
}

/** يستخرج شبكة الجدول داخل مكوّن واحد. */
function gridFromComponent(c, H, V, w) {
  const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
  const rowCov = [], colCov = [];
  for (let y = c.y0; y <= c.y1; y++) { let n = 0; for (let x = c.x0; x <= c.x1; x++) n += H[y * w + x]; if (n >= bw * 0.18) rowCov.push(y); }
  for (let x = c.x0; x <= c.x1; x++) { let n = 0; for (let y = c.y0; y <= c.y1; y++) n += V[y * w + x]; if (n >= bh * 0.18) colCov.push(x); }
  let ys = cluster1D(rowCov), xs = cluster1D(colCov);
  const edge = Math.max(6, Math.round(Math.min(bw, bh) * 0.01));
  if (!ys.length || ys[0] - c.y0 > edge) ys.unshift(c.y0); if (ys[ys.length - 1] < c.y1 - edge) ys.push(c.y1);
  if (!xs.length || xs[0] - c.x0 > edge) xs.unshift(c.x0); if (xs[xs.length - 1] < c.x1 - edge) xs.push(c.x1);
  // أزل خطوطاً قريبة جداً
  const dedupe = (a, m) => a.filter((v, i) => i === 0 || v - a[i - 1] > m);
  ys = dedupe(ys, 12); xs = dedupe(xs, 12);
  if (ys.length < 2 || xs.length < 2) return null;
  const rows = ys.length - 1, cols = xs.length - 1;
  const band = 4;
  const hasRight = (r, cI) => cI >= cols - 1 ? true : coverage(V, w, xs[cI + 1] - band, ys[r] + band, xs[cI + 1] + band, ys[r + 1] - band) >= 0.35;
  const hasBottom = (r, cI) => r >= rows - 1 ? true : coverage(H, w, xs[cI] + band, ys[r + 1] - band, xs[cI + 1] - band, ys[r + 1] + band) >= 0.35;
  // دمج الخلايا: مستطيلات متجاورة بلا خط فاصل
  const owner = Array.from({ length: rows }, () => new Array(cols).fill(-1)); const cells = [];
  for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
    if (owner[r][cI] >= 0) continue;
    let cs = 1, rs = 1;
    while (cI + cs < cols && owner[r][cI + cs] < 0 && !hasRight(r, cI + cs - 1)) cs++;
    let ok = true;
    while (ok && r + rs < rows) {
      for (let k = 0; k < cs; k++) if (hasBottom(r + rs - 1, cI + k) || owner[r + rs][cI + k] >= 0) { ok = false; break; }
      if (ok) rs++;
    }
    const id = cells.length;
    for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) owner[r + a][cI + b] = id;
    cells.push({ r, c: cI, rs, cs, x0: xs[cI], y0: ys[r], x1: xs[cI + cs], y1: ys[r + rs] });
  }
  return { bbox: { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }, xs, ys, rows, cols, cells };
}

/** يكشف كل الجداول ذات الحدود. الإحداثيات بمقياس الصورة الأصلية. */
async function detectBordered(input) {
  const { bin, w, h, scale } = await loadBinary(input);
  const { H, V } = lineMasks(bin, w, h);
  const out = [];
  for (const c of components(H, V, w, h)) {
    if ((c.x1 - c.x0) < w * 0.08 || (c.y1 - c.y0) < h * 0.04) continue;
    const g = gridFromComponent(c, H, V, w);
    if (!g || g.rows * g.cols < 2 || (g.rows < 2 && g.cols < 2)) continue;
    const up = (v) => Math.round(v / scale);
    out.push({
      kind: 'bordered', rows: g.rows, cols: g.cols,
      bbox: { x0: up(g.bbox.x0), y0: up(g.bbox.y0), x1: up(g.bbox.x1), y1: up(g.bbox.y1) },
      xs: g.xs.map(up), ys: g.ys.map(up),
      cells: g.cells.map((k) => ({ r: k.r, c: k.c, rs: k.rs, cs: k.cs, x0: up(k.x0), y0: up(k.y0), x1: up(k.x1), y1: up(k.y1) })),
    });
  }
  return out.sort((a, b) => a.bbox.y0 - b.bbox.y0);
}

/** جدول بلا حدود: من مواضع الكلمات في أسطر OCR (فجوات رأسية متسقة). */
function detectBorderless(lines, pageW) {
  const heights = lines.map((l) => l.bbox.y1 - l.bbox.y0).sort((a, b) => a - b);
  const mh = heights[Math.floor(heights.length / 2)] || 20;
  const gapMin = mh * 1.8;
  const multi = lines.map((l) => {
    const ws = [...l.words].sort((a, b) => a.bbox.x0 - b.bbox.x0), segs = []; let cur = [ws[0]];
    for (let i = 1; i < ws.length; i++) { if (ws[i].bbox.x0 - ws[i - 1].bbox.x1 > gapMin) { segs.push(cur); cur = []; } cur.push(ws[i]); }
    segs.push(cur); return segs;
  });
  // مجموعات متتالية من أسطر فيها ≥3 مقاطع
  const groups = []; let g = [];
  multi.forEach((segs, i) => { if (segs.length >= 3) g.push(i); else { if (g.length >= 3) groups.push(g); g = []; } });
  if (g.length >= 3) groups.push(g);
  const tables = [];
  for (const idxs of groups) {
    const ls = idxs.map((i) => lines[i]);
    const iv = ls.flatMap((l) => l.words.map((w) => [w.bbox.x0, w.bbox.x1]));
    iv.sort((a, b) => a[0] - b[0]);
    // حدود الأعمدة = فجوات تشترك فيها كل الأسطر تقريباً
    const bounds = []; let reach = iv[0][1];
    for (let i = 1; i < iv.length; i++) { if (iv[i][0] - reach > gapMin * 0.8) bounds.push(Math.round((reach + iv[i][0]) / 2)); reach = Math.max(reach, iv[i][1]); }
    if (bounds.length < 2) continue;
    const xs = [Math.min(...iv.map((v) => v[0])) - 4, ...bounds, Math.max(...iv.map((v) => v[1])) + 4];
    const ys = [ls[0].bbox.y0 - 4]; for (let i = 1; i < ls.length; i++) ys.push(Math.round((ls[i - 1].bbox.y1 + ls[i].bbox.y0) / 2)); ys.push(ls[ls.length - 1].bbox.y1 + 4);
    const cells = []; for (let r = 0; r < ys.length - 1; r++) for (let c = 0; c < xs.length - 1; c++) cells.push({ r, c, rs: 1, cs: 1, x0: xs[c], y0: ys[r], x1: xs[c + 1], y1: ys[r + 1] });
    tables.push({ kind: 'borderless', rows: ys.length - 1, cols: xs.length - 1, bbox: { x0: xs[0], y0: ys[0], x1: xs[xs.length - 1], y1: ys[ys.length - 1] }, xs, ys, cells, lineIdx: idxs });
  }
  void pageW; return tables;
}

module.exports = { detectBordered, detectBorderless, loadBinary, _i: { lineMasks, components, gridFromComponent } };
