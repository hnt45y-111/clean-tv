const test = require('node:test'); const assert = require('node:assert');
const sharp = require('sharp'); const fs = require('fs'); const os = require('os'); const path = require('path'); const JSZip = require('jszip');
const { autoArrange, exportLayout } = require('../src/core/idlayout'); const { PDFDocument } = require('pdf-lib');
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-'));
const card = async (n, col) => { const f = path.join(d, n + '.png'); await sharp({ create: { width: 856, height: 540, channels: 3, background: col } }).png().toFile(f); return f; };

test('idlayout: ترتيب تلقائي ضمن الورقة بدون تداخل', () => {
  const ids = [1, 2, 3, 4, 5].map((i) => ({ id: 'i' + i, front: 'f', back: 'b' }));
  const r = autoArrange(ids, { cardW: 85.6, cardH: 54, gap: 5, margin: 10 });
  assert.equal(r.items.length, 10);
  for (const it of r.items) { assert.ok(it.x >= 10 - 0.01 && it.x + it.w <= 200.01, 'ضمن العرض'); assert.ok(it.y + it.h <= 287.01); }
  for (let i = 0; i < r.items.length; i++) for (let j = i + 1; j < r.items.length; j++) { const a = r.items[i], b = r.items[j]; if (a.page !== b.page) continue; assert.ok(a.x + a.w <= b.x + 0.01 || b.x + b.w <= a.x + 0.01 || a.y + a.h <= b.y + 0.01 || b.y + b.h <= a.y + 0.01, 'تداخل'); }
});
test('idlayout: PDF/PNG/DOCX (صور عائمة بمواضع مستقلة)', async () => {
  const f1 = await card('a', '#c00'), f2 = await card('b', '#0a0');
  const layout = { paper: 'A4', orientation: 'portrait', border: true, items: [{ file: f1, x: 20, y: 20, w: 85.6, h: 54, rot: 0 }, { file: f2, x: 110, y: 100, w: 50, h: 40, rot: 15 }] };
  const pdf = await exportLayout(layout, 'pdf'); const doc = await PDFDocument.load(pdf.buffer); assert.equal(doc.getPageCount(), 1);
  const png = await exportLayout(layout, 'png', { dpi: 150 }); const m = await sharp(png.buffer).metadata(); assert.equal(m.width, Math.round(210 / 25.4 * 150));
  const px = await sharp(png.buffer).raw().toBuffer({ resolveWithObject: true }); const at = (xmm, ymm) => { const i = (Math.round(ymm / 25.4 * 150) * px.info.width + Math.round(xmm / 25.4 * 150)) * px.info.channels; return [px.data[i], px.data[i + 1], px.data[i + 2]]; };
  assert.ok(at(60, 45)[0] > 150 && at(60, 45)[1] < 80, 'البطاقة الحمراء في مكانها'); assert.deepEqual(at(5, 5), [255, 255, 255]);
  const dx = await exportLayout(layout, 'docx'); const xml = await (await JSZip.loadAsync(dx.buffer)).file('word/document.xml').async('string');
  assert.equal((xml.match(/<wp:anchor/g) || []).length, 2, 'صورتان عائمتان'); assert.ok(xml.includes('rot="'), 'تدوير');
});
