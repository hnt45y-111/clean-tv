const test = require('node:test'); const assert = require('node:assert');
const sharp = require('sharp'); const fs = require('fs'); const os = require('os'); const path = require('path');
const P = require('../src/core/pdfkit'); const { PDFDocument } = require('pdf-lib');
const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-'));
const mk = async (i, col) => { const f = path.join(d, `p${i}.png`); await sharp({ create: { width: 800, height: 1100, channels: 3, background: col } }).png().toFile(f); return f; };

test('pdf: صور→PDF متعدد الصفحات بالترتيب وبحجم A4', async () => {
  const files = [await mk(1, '#f00'), await mk(2, '#0f0'), await mk(3, '#00f')];
  const buf = await P.imagesToPdf(files, { pageSize: 'A4' });
  const doc = await PDFDocument.load(buf); assert.equal(doc.getPageCount(), 3);
  const s = doc.getPage(0).getSize(); assert.ok(Math.abs(s.width - 595.28) < 1 && Math.abs(s.height - 841.89) < 1);
  global.__pdf = buf;
});
test('pdf: دمج، تقسيم، استخراج، ترتيب، تدوير، ترقيم، علامة مائية', async () => {
  const buf = global.__pdf; assert.equal(await P.pageCount(await P.merge([buf, buf])), 6);
  assert.deepEqual(P.parseRanges('1-2,3', 3), [0, 1, 2]); assert.throws(() => P.parseRanges('9', 3)); assert.throws(() => P.parseRanges('x', 3));
  assert.equal((await P.split(buf, { mode: 'each' })).length, 3);
  assert.equal((await P.split(buf, { mode: 'ranges', ranges: '1-2;3' })).length, 2);
  const re = await P.pick(buf, [2, 0, 1]); assert.equal(await P.pageCount(re), 3);
  const rot = await PDFDocument.load(await P.rotate(buf, 90, [0])); assert.equal(rot.getPage(0).getRotation().angle, 90); assert.equal(rot.getPage(1).getRotation().angle, 0);
  assert.equal(await P.pageCount(await P.addPageNumbers(buf, { format: '{n} / {t}' })), 3);
  assert.equal(await P.pageCount(await P.addWatermark(buf, { text: 'سري للغاية' })), 3);
  assert.ok((await P.optimize(buf)).length > 0);
});
test('pdf: طبقة نص غير مرئية (قابل للبحث)', async () => {
  const f = await mk(9, '#fff'); const buf = await P.imagesToPdf([f], { searchable: [{ width: 800, height: 1100, lines: [{ text: 'مرحبا بالعالم Hello', bbox: { x0: 100, y0: 100, x1: 500, y1: 160 } }] }] });
  assert.ok(buf.length > 1000);
});
