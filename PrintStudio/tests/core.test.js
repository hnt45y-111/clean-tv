const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const naming = require('../src/core/naming'); const { DB } = require('../src/core/db'); const { Settings } = require('../src/core/settings');

test('naming: الامتداد يُضاف تلقائياً ولا يتكرر', () => {
  assert.equal(naming.fileName('تقرير التدريب', 'pdf'), 'تقرير التدريب.pdf');
  assert.equal(naming.fileName('تقرير.pdf', 'pdf'), 'تقرير.pdf');
  assert.equal(naming.fileName('تقرير.pdf.pdf', 'pdf'), 'تقرير.pdf');
  assert.equal(naming.fileName('صورة.JPG', 'jpg'), 'صورة.jpg');
  assert.equal(naming.fileName('a/b:c*?', 'docx'), 'a b c.docx');
  assert.equal(naming.fileName('', 'png'), 'مستند.png');
  assert.equal(naming.fileName('CON', 'png'), 'مستند.png');
  assert.equal(naming.fileName('تقرير.pdf', 'docx'), 'تقرير.pdf.docx'); // اسم مقصود: لا نحذف امتداداً مختلفاً
});
test('naming: مسار فريد', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-')); 
  const p1 = naming.uniquePath(d, 'x', 'pdf'); fs.writeFileSync(p1, '1');
  assert.equal(path.basename(naming.uniquePath(d, 'x', 'pdf')), 'x (2).pdf');
});
test('settings: حفظ دائم بعد إعادة الفتح + تحقق', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ps-')), 'a.db');
  let db = await DB.open(f); let s = new Settings(db);
  s.set({ 'scan.dpi': 600, 'save.dir': 'D:\\Scans', 'save.format': 'docx', 'printer.name': 'HP' }); db.close();
  db = await DB.open(f); s = new Settings(db);
  assert.equal(s.get('scan.dpi'), 600); assert.equal(s.get('save.dir'), 'D:\\Scans');
  assert.equal(s.get('save.format'), 'docx'); assert.equal(s.get('printer.name'), 'HP');
  assert.throws(() => s.set('save.format', 'exe')); assert.throws(() => s.set('nope.x', 1));
  assert.equal(s.set('scan.dpi', 99999).scan.dpi, 1200);
});
