const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path'); const sharp = require('sharp');
const ExcelJS = require('exceljs'); const JSZip = require('jszip'); const { PDFDocument } = require('pdf-lib');
const { App } = require('../src/core/app'); const fx = require('./fixtures');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psapp-'));
let queue = []; const calls = [];
const hw = {
  listPrinters: async () => [{ name: 'HP LaserJet', driver: 'HP', state: 'ready', isDefault: true }, { name: 'Canon', driver: 'C', state: 'offline' }],
  listScanners: async () => [{ id: 'S1', name: 'Epson', ready: true }],
  scan: async (o) => { calls.push(o); if (!queue.length) throw new Error('السكانر غير متصل'); const f = o.outBase + '.png'; fs.writeFileSync(f, queue.shift()); return [f]; },
};
const mkApp = async () => new App({ dataDir: path.join(root, 'data'), docsDir: path.join(root, 'docs'), hw }).init();
const solid = (c) => sharp({ create: { width: 900, height: 1200, channels: 3, background: c } }).png().toBuffer();
let app; const outDir = path.join(root, 'out');

test('TEST 1: الطابعة تُحفظ وتُسترجع بعد إعادة التشغيل', async () => {
  app = await mkApp(); assert.equal(app.state().firstRun, true);
  const pr = await app.printers(); assert.equal(pr.list.length, 2);
  await assert.rejects(() => app.selectPrinter('NoSuch'), /غير موجودة/);
  await app.selectPrinter('HP LaserJet'); await app.close();
  app = await mkApp(); assert.equal(app.state().firstRun, false); assert.equal(app.settings.get('printer.name'), 'HP LaserJet');
});
test('TEST 2: مسح متعدد، إعادة ترتيب، حذف، تدوير', async () => {
  await assert.rejects(() => app.scan(), /لم يتم اختيار سكانر/);
  app.selectScanner('S1', 'Epson'); queue = [await solid('#f00'), await solid('#0f0'), await solid('#00f')];
  await app.scan(); await app.scan(); const l = await app.scan(); assert.equal(l.length, 3);
  await assert.rejects(() => app.scan(), /غير متصل/); // لا مسح وهمي
  const [a, b, c] = l.map((p) => p.id); app.reorderPages([c, a, b]); assert.deepEqual(app.listPages().map((p) => p.id), [c, a, b]);
  assert.throws(() => app.reorderPages([a, a, b])); app.removePages([b]); assert.equal(app.listPages().length, 2);
  const r = await app.rotatePage(a, 90); assert.equal(r.width, 1200); assert.equal(r.height, 900);
  queue = [await solid('#ff0')]; const l2 = await app.scan(); assert.equal(l2.length, 3);
});
test('TEST 3+4: التصدير بالاسم الصحيح والمجلد المحفوظ', async () => {
  assert.equal(app.defaultSaveDir(), '');
  await assert.rejects(() => app.exportPages({ name: 'x', format: 'pdf' }), /مكان الحفظ/);
  const r = await app.exportPages({ name: 'تقرير التدريب', format: 'pdf', dir: outDir });
  assert.equal(path.basename(r.files[0]), 'تقرير التدريب.pdf'); assert.equal((await PDFDocument.load(fs.readFileSync(r.files[0]))).getPageCount(), 3);
  assert.equal(app.defaultSaveDir(), outDir);
  const r2 = await app.exportPages({ name: 'تقرير التدريب.pdf', format: 'pdf' }); // بدون dir → المحفوظ، ولا امتداد مكرر
  assert.equal(path.basename(r2.files[0]), 'تقرير التدريب (2).pdf');
  const j = await app.exportPages({ name: 'صورة', format: 'jpg', options: { dpi: 200, quality: 80 } }); assert.equal(j.files.length, 3); assert.ok(j.files[0].endsWith('صورة-1.jpg'));
  assert.equal((await sharp(j.files[0]).metadata()).format, 'jpeg');
  const p = await app.exportPages({ name: 'one', format: 'png', ids: [app.listPages()[0].id] }); assert.ok(p.files[0].endsWith('one.png'));
  const w = await app.exportPages({ name: 'ملف', format: 'docx' }); assert.ok((await (await JSZip.loadAsync(fs.readFileSync(w.files[0]))).file('word/document.xml').async('string')).includes('<w:drawing>'));
  await app.close(); app = await mkApp(); assert.equal(app.defaultSaveDir(), outDir); // TEST 4 بعد إعادة التشغيل
});
test('TEST 5: جدول مطبوع → Excel حقيقي قابل للتحرير', { timeout: 180000 }, async () => {
  const f = path.join(root, 'table.png'); fs.writeFileSync(f, await fx.tablePng()); await app.importImages([f]);
  const { model } = await app.startRecognition({ ids: [app.listPages().at(-1).id], mode: 'table' });
  const t = model.pages[0].blocks.find((b) => b.type === 'table'); assert.ok(t, 'اكتُشف جدول'); assert.equal(t.rows, 4); assert.equal(t.cols, 4);
  const cell = (r, c) => t.cells.find((x) => x.r === r && x.c === c).text;
  assert.equal(cell(0, 0), 'الاسم'); assert.equal(cell(0, 1), 'القسم'); assert.equal(cell(0, 2), 'الراتب'); assert.equal(cell(0, 3), 'ID');
  assert.equal(cell(1, 2), '750000'); assert.equal(cell(3, 2), '820000'); assert.equal(cell(2, 0), 'Sara Ahmed'); assert.equal(cell(2, 1), 'IT');
  assert.equal(cell(3, 0), 'محمد كريم'); assert.equal(cell(3, 1), 'المبيعات');
  cell(1, 0); // الخلية الصعبة قد تُقرأ خطأ لكنها تُعلَّم منخفضة الثقة عندئذٍ
  const weak = t.cells.find((x) => x.r === 1 && x.c === 0); if (weak.text !== 'علي حسن') assert.ok(weak.low, 'الخطأ يجب أن يُعلَّم للمراجعة');
  const out = await app.exportModel({ name: 'جدول', format: 'xlsx', model }); const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(out.files[0]);
  const ws = wb.worksheets[0]; assert.equal(ws.getCell('A1').value, 'الاسم'); assert.equal(ws.getCell('C2').value, 750000); assert.equal(ws.views[0].rightToLeft, true);
});
test('TEST 6: خطاب رسمي → Word قابل للتحرير RTL', { timeout: 180000 }, async () => {
  const f = path.join(root, 'letter.png'); fs.writeFileSync(f, await fx.letterPng()); await app.importImages([f]);
  const { model } = await app.startRecognition({ ids: [app.listPages().at(-1).id] }); const bl = model.pages[0].blocks;
  assert.ok(bl.some((b) => b.type === 'heading' && /جمهورية/.test(b.text)), 'عنوان'); assert.ok(bl.some((b) => b.type === 'list' && b.marker === '1.'), 'قائمة');
  assert.ok(bl.some((b) => b.dir === 'ltr' && /Please find/.test(b.text)), 'إنجليزي LTR'); assert.ok(bl.some((b) => b.dir === 'rtl' && /الموظف المذكور/.test(b.text)), 'عربي RTL');
  const out = await app.exportModel({ name: 'خطاب', format: 'docx', model, options: { content: 'text' } });
  const xml = await (await JSZip.loadAsync(fs.readFileSync(out.files[0]))).file('word/document.xml').async('string');
  assert.ok(xml.includes('<w:bidi') && xml.includes('Please find') && xml.includes('الموظف المذكور') && !xml.includes('<w:drawing>'));
  const pdf = await app.exportModel({ name: 'خطاب-قابل-للبحث', format: 'pdf', model }); assert.ok(fs.statSync(pdf.files[0]).size > 5000);
  const txt = await app.exportModel({ name: 'خطاب', format: 'txt', model }); assert.ok(fs.readFileSync(txt.files[0], 'utf8').includes('جمهورية العراق'));
  assert.ok(app.archiveList({ q: 'الموظف المذكور' }).length >= 1, 'بحث نصي في الأرشيف');
});
test('TEST 7: هويات أمامي/خلفي على ورقة واحدة', async () => {
  const mk = async (c) => { const f = path.join(root, 'c' + c + '.png'); await sharp({ create: { width: 856, height: 540, channels: 3, background: c } }).png().toFile(f); return app.addCard(f); };
  const a = await mk('#c00'), b = await mk('#0a0'), c = await mk('#00c');
  const ar = app.arrangeIds([{ id: 'i1', front: a.id, back: b.id }, { id: 'i2', front: c.id }], { cardW: 85.6, cardH: 54 });
  assert.equal(ar.items.length, 3);
  const layout = { paper: 'A4', orientation: 'portrait', border: true, items: ar.items.map((it) => ({ ...it, cardId: it.side === 'front' && it.identity === 'i1' ? a.id : it.identity === 'i1' ? b.id : c.id })) };
  for (const fmt of ['pdf', 'docx', 'png']) { const r = await app.exportIds({ name: 'هويات', format: fmt, layout, dpi: 150 }); assert.ok(r.files[0].endsWith('.' + fmt)); }
});
test('TEST 8: خلفية اللوحة تُحفظ وتُسترجع وتُزال', async () => {
  const f = path.join(root, 'bg.png'); await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#036' } }).png().toFile(f);
  const bg = await app.importBackground(f); assert.equal(bg.mode, 'image'); assert.ok(fs.existsSync(bg.file)); assert.ok((await sharp(bg.file).metadata()).width <= 2560);
  app.settings.set({ 'background.brightness': 70, 'background.opacity': 80 }); await app.close(); app = await mkApp();
  assert.equal(app.settings.get('background.mode'), 'image'); assert.equal(app.settings.get('background.brightness'), 70); assert.ok(fs.existsSync(app.settings.get('background.file')));
  assert.equal(app.clearBackground().mode, 'default');
  await assert.rejects(() => app.importBackground(path.join(root, 'x.exe')), /صورة/);
});
test('TEST 9: الإعدادات تبقى بعد إعادة التشغيل', async () => {
  app.settings.set({ 'scan.dpi': 600, 'save.format': 'docx', 'save.dir': path.join(root, 'newdir'), 'scanner.id': 'S2' }); await app.close(); app = await mkApp();
  assert.equal(app.settings.get('scan.dpi'), 600); assert.equal(app.settings.get('save.format'), 'docx'); assert.equal(app.settings.get('scanner.id'), 'S2');
});
test('أدوات PDF + الأرشيف', async () => {
  app.settings.set('save.dir', outDir); const dir = outDir;
  const f1 = path.join(root, 'a.png'), f2 = path.join(root, 'b.png'); await sharp({ create: { width: 500, height: 700, channels: 3, background: '#aaa' } }).png().toFile(f1); fs.copyFileSync(f1, f2);
  const pdf = (await app.imagesToPdfTool({ files: [f1, f2, f1], name: 'src', dir })).files[0];
  const m = (await app.pdfTool('merge', { inputs: [pdf, pdf], name: 'merged', dir })).files[0]; assert.equal((await PDFDocument.load(fs.readFileSync(m))).getPageCount(), 6);
  assert.equal((await app.pdfTool('split', { inputs: [pdf], dir, args: { mode: 'each' } })).files.length, 3);
  const e = (await app.pdfTool('extract', { inputs: [pdf], dir, name: 'ex', args: { ranges: '2-3' } })).files[0]; assert.equal((await PDFDocument.load(fs.readFileSync(e))).getPageCount(), 2);
  await assert.rejects(() => app.pdfTool('extract', { inputs: [pdf], dir, args: { ranges: '9' } }), /خارج النطاق/);
  await assert.rejects(() => app.pdfTool('merge', { inputs: [f1], dir }), /ليس PDF/);
  assert.ok(app.archiveList({ type: 'pdf' }).length >= 4); assert.ok(app.archiveList({ q: 'merged' }).length === 1);
  assert.equal(app.archiveList({ from: Date.now() + 1e6 }).length, 0);
  const it = app.archiveList({ q: 'merged' })[0]; assert.ok(app.isAllowedPath(it.path)); assert.ok(!app.isAllowedPath('/etc/passwd'));
  await app.close();
});
