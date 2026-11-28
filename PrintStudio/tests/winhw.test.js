const test = require('node:test'); const assert = require('node:assert');
const { WinHW, mapWiaError, decodePrinter } = require('../src/core/winhw');

test('winhw: خارج Windows يُرفض بوضوح (لا حالة وهمية)', async () => {
  const h = new WinHW({ platform: 'linux' });
  await assert.rejects(() => h.listPrinters(), /Windows/); await assert.rejects(() => h.listScanners(), /Windows/);
});
test('winhw: تحليل الطابعات وحالاتها', async () => {
  const raw = JSON.stringify([
    { name: 'HP LaserJet', driver: 'HP Universal', port: 'IP_1', isDefault: true, network: true, shared: false, offline: false, status: 3, errorState: 2, location: '' },
    { name: 'Canon', driver: 'Canon D', port: 'USB001', isDefault: false, network: false, shared: false, offline: true, status: 7, errorState: 9, location: '' },
    { name: 'Epson', driver: 'E', port: 'USB002', isDefault: false, network: false, shared: false, offline: false, status: 3, errorState: 8, location: '' },
  ]);
  const h = new WinHW({ platform: 'win32', run: async () => raw });
  const ps = await h.listPrinters();
  assert.equal(ps[0].state, 'ready'); assert.equal(ps[1].state, 'offline'); assert.equal(ps[2].state, 'error'); assert.match(ps[2].statusText, /انحشار/);
  const one = new WinHW({ platform: 'win32', run: async () => JSON.stringify({ name: 'X', status: 3, errorState: 2 }) });
  assert.equal((await one.listPrinters()).length, 1);
});
test('winhw: ترجمة أخطاء WIA', async () => {
  assert.match(mapWiaError('Exception 0x80210005'), /غير متصل/); assert.match(mapWiaError('HResult -2145320954'), /مشغول|تسخين|تدخّل|تحقق|مقفول|تعريف|غير متصل/);
  assert.match(mapWiaError('SCANNER_NOT_FOUND'), /لم يعد متصلاً/); assert.match(mapWiaError('boom'), /فشل المسح/);
  const h = new WinHW({ platform: 'win32', run: async () => { throw new Error('0x80210015'); } });
  return assert.rejects(() => h.listScanners(), /لم يُعثر على سكانر/);
});
test('winhw: scan يمرّر المعاملات ويعيد الملفات', async () => {
  let seen; const h = new WinHW({ platform: 'win32', run: async (s, a) => { seen = a; return JSON.stringify({ files: ['C:\\t\\p.png'] }); } });
  const f = await h.scan({ id: 'X', dpi: 600, outBase: 'C:\\t\\p' }); assert.deepEqual(f, ['C:\\t\\p.png']); assert.equal(seen.dpi, 600);
});

test('winhw: استخراج JSON رغم BOM وأسطر قبله', async () => {
  const { extractJson } = require('../src/core/winhw');
  assert.equal(extractJson('\uFEFF[{"a":1}]'), '[{"a":1}]'); assert.equal(extractJson('WARNING: x\r\n{"a":1}\r\n'), '{"a":1}'); assert.equal(extractJson(''), ''); assert.equal(extractJson('نص بلا json'), '');
  const h = new WinHW({ platform: 'win32', run: async () => '\uFEFF[{"name":"Brother DCP-T310","status":3,"errorState":2}]' }); assert.equal((await h.listPrinters())[0].name, 'Brother DCP-T310');
  const c = new WinHW({ platform: 'win32', run: async () => '\uFEFF{"name":"Canon G3020","class":"Image"}' }); assert.equal((await c.connectedDevices()).length, 1);
});
