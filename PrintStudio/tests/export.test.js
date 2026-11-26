const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path'); const { execFileSync } = require('child_process');
const JSZip = require('jszip'); const ExcelJS = require('exceljs');
const { buildDocx } = require('../src/core/export-docx'); const { buildXlsx } = require('../src/core/export-xlsx');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ps-'));
const model = { pages: [{ blocks: [
  { type: 'heading', level: 1, dir: 'rtl', align: 'center', text: 'جمهورية العراق', sizePt: 20 },
  { type: 'paragraph', dir: 'rtl', align: 'right', text: 'نص عربي عادي مع English داخله.' },
  { type: 'list', dir: 'rtl', align: 'right', text: 'بند أول', marker: '1.' },
  { type: 'paragraph', dir: 'ltr', align: 'left', text: 'Hello world' },
  { type: 'table', dir: 'rtl', rows: 3, cols: 3, header: true, colWidths: [100, 100, 100], cells: [
    { r: 0, c: 0, rs: 1, cs: 2, text: 'عنوان مدموج' }, { r: 0, c: 2, rs: 1, cs: 1, text: 'ID' },
    { r: 1, c: 0, rs: 2, cs: 1, text: 'أ' }, { r: 1, c: 1, rs: 1, cs: 1, text: 'ب' }, { r: 1, c: 2, rs: 1, cs: 1, text: '12' },
    { r: 2, c: 1, rs: 1, cs: 1, text: 'ج' }, { r: 2, c: 2, rs: 1, cs: 1, text: '٣٤' } ] },
] }] };

test('docx: بنية حقيقية (فقرات bidi، جدول، دمج) وليست صورة', async () => {
  const buf = await buildDocx(model, { rtl: true });
  const zip = await JSZip.loadAsync(buf); const xml = await zip.file('word/document.xml').async('string');
  assert.ok(xml.includes('<w:bidi'), 'bidi'); assert.ok(xml.includes('<w:rtl'), 'rtl run');
  assert.ok(xml.includes('<w:tbl>') && xml.includes('w:gridSpan') && xml.includes('w:vMerge'), 'table+merge');
  assert.ok(xml.includes('w:bidiVisual'), 'table rtl');
  assert.ok(xml.includes('جمهورية العراق') && xml.includes('Hello world'));
  assert.ok(!xml.includes('<w:drawing>'), 'لا صور');
  const d = tmp(), f = path.join(d, 'a.docx'); fs.writeFileSync(f, buf);
  try { execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', d, f], { stdio: 'pipe', timeout: 120000 }); assert.ok(fs.existsSync(path.join(d, 'a.pdf')), 'LibreOffice فتح الملف'); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
});

test('xlsx: خلايا حقيقية، أرقام، دمج، RTL، تصفية', async () => {
  const buf = await buildXlsx([{ name: 'جدول', dir: 'rtl', rows: 3, cols: 3, header: true, autoFilter: true, colWidths: [100, 200, 100], cells: [
    { r: 0, c: 0, rs: 1, cs: 2, text: 'عنوان' }, { r: 0, c: 2, rs: 1, cs: 1, text: 'ID' },
    { r: 1, c: 0, rs: 2, cs: 1, text: 'أ' }, { r: 1, c: 1, rs: 1, cs: 1, text: 'ب' }, { r: 1, c: 2, rs: 1, cs: 1, text: '12' },
    { r: 2, c: 1, rs: 1, cs: 1, text: 'ج' }, { r: 2, c: 2, rs: 1, cs: 1, text: '٣٤' } ] }]);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); const ws = wb.worksheets[0];
  assert.equal(ws.getCell('C2').value, 12); assert.equal(ws.getCell('C3').value, 34); assert.equal(ws.getCell('A2').value, 'أ');
  assert.ok(ws.getCell('B1').isMerged); assert.ok(ws.getCell('A3').isMerged);
  assert.equal(ws.views[0].rightToLeft, true); assert.ok(ws.autoFilter);
  assert.ok(ws.getColumn(2).width > ws.getColumn(1).width);
});
