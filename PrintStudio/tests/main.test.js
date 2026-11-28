// اختبار دخاني لعملية Electron الرئيسية بواسطة electron وهمي: التسجيل، البروتوكولات، حدود الأمان.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path'); const Module = require('module');

test('main: IPC موثوق فقط + بروتوكولات آمنة', async () => {
  const user = fs.mkdtempSync(path.join(os.tmpdir(), 'psmain-')); const handlers = {}, protos = {}; let loaded = null, wopts = null; let readyCb;
  const fake = {
    app: { requestSingleInstanceLock: () => true, quit() {}, on() {}, whenReady: () => ({ then: (cb) => { readyCb = cb; } }), getPath: (k) => path.join(user, k), isPackaged: false, getVersion: () => '1.0.0', setLoginItemSettings() {} },
    BrowserWindow: class { constructor(o) { wopts = o; this.webContents = { setWindowOpenHandler() {}, on() {}, send() {} }; } once() {} on() {} loadURL(u) { loaded = u; return Promise.resolve(); } static getAllWindows() { return [1]; } isDestroyed() { return false; } },
    ipcMain: { handle: (n, f) => { handlers[n] = f; } }, dialog: {}, shell: {}, Menu: { setApplicationMenu() {} },
    protocol: { registerSchemesAsPrivileged() {}, handle: (n, f) => { protos[n] = f; } }, net: { fetch: async (u) => new Response('x') }, session: { defaultSession: { setPermissionRequestHandler() {} } },
  };
  const orig = Module._load; Module._load = function (req, ...a) { return req === 'electron' ? fake : orig.call(this, req, ...a); };
  try { require('../src/main/main.js'); await readyCb(); } finally { Module._load = orig; }
  assert.equal(loaded, 'psapp://app/index.html'); assert.equal(wopts.webPreferences.contextIsolation, true); assert.equal(wopts.webPreferences.nodeIntegration, false); assert.equal(wopts.webPreferences.sandbox, true);
  const good = { senderFrame: { url: 'psapp://app/index.html' } }, bad = { senderFrame: { url: 'https://evil.example/' } };
  const st = await handlers['ps:call'](good, 'state'); assert.equal(st.firstRun, true);
  await assert.rejects(() => handlers['ps:call'](bad, 'state'), /غير موثوق/);
  await assert.rejects(() => handlers['ps:call'](good, 'constructor'), /غير معروف/); await assert.rejects(() => handlers['ps:call'](good, '__proto__'), /غير معروف/);
  await assert.rejects(() => handlers['ps:call'](good, 'readFile', '/etc/passwd'), /غير مسموح/);
  await assert.rejects(() => handlers['ps:call'](good, 'settingsSet', { 'save.format': 'exe' }), /غير مسموح/);
  const ok = await protos.psapp({ url: 'psapp://app/index.html' }); assert.equal(ok.status, 200); assert.match(await ok.text(), /Print Studio/);
  assert.equal((await protos.psapp({ url: 'psapp://app/js/main.js' })).status, 200);
  assert.equal((await protos.psapp({ url: 'psapp://app/..%2f..%2fpackage.json' })).status, 404); assert.equal((await protos.psapp({ url: 'psapp://app/../../package.json' })).status, 404);
  const b64 = (p) => Buffer.from(p).toString('base64url'); assert.equal((await protos.psfile({ url: 'psfile://f/' + b64('/etc/passwd') })).status, 403);
});

test('printing: اتجاه تلقائي لكل صفحة + نطاقات الصفحات', () => {
  const Module = require('module'); const orig = Module._load; Module._load = function (r, ...a) { return r === 'electron' ? { BrowserWindow: class {} } : orig.call(this, r, ...a); };
  let P; try { P = require('../src/main/printing.js'); } finally { Module._load = orig; }
  const pages = [{ w: 800, h: 1100 }, { w: 800, h: 1100 }, { w: 1200, h: 800 }, { w: 800, h: 1100 }];
  const g = P.groupByOrientation(pages, 'auto'); assert.deepEqual(g.map((x) => [x.landscape, x.pages.length]), [[false, 2], [true, 1], [false, 1]]);
  assert.deepEqual(P.groupByOrientation(pages, 'landscape').map((x) => x.landscape), [true]); assert.equal(P.groupByOrientation(pages, 'portrait')[0].pages.length, 4);
  assert.deepEqual([...P.rangeSet('1-2,4', 4)], [0, 1, 3]); assert.equal(P.rangeSet('', 4), null); assert.throws(() => P.rangeSet('x', 4), /غير صالح/); assert.throws(() => P.rangeSet('9', 4), /غير صالح/);
});
