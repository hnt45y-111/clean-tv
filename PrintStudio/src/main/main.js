'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { App } = require('../core/app');
const { buildApi } = require('./api');
const { printJob } = require('./printing');

protocol.registerSchemesAsPrivileged([
  { scheme: 'psfile', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  { scheme: 'psapp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null, core = null, api = null;
const RENDERER = path.resolve(__dirname, '..', 'renderer');

const ui = {
  emit: (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send('ps:' + ch, d); },
  version: () => app.getVersion(),
  fileUrl: (p) => 'psfile://f/' + Buffer.from(p).toString('base64url'),
  openPath: async (p) => { const e = await shell.openPath(p); if (e) throw new Error('تعذّر فتح الملف: ' + e); return true; },
  reveal: (p) => { shell.showItemInFolder(p); return true; },
  pickFolder: async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'اختر المجلد' }); return r.canceled ? '' : r.filePaths[0]; },
  pickFiles: async ({ images, pdf, multi = true }) => {
    const filters = []; const ext = [];
    if (images) ext.push('png', 'jpg', 'jpeg', 'bmp', 'tif', 'tiff', 'webp'); if (pdf) ext.push('pdf');
    filters.push({ name: 'الملفات المدعومة', extensions: ext });
    const r = await dialog.showOpenDialog(win, { properties: multi ? ['openFile', 'multiSelections'] : ['openFile'], filters, title: 'اختر الملفات' });
    return r.canceled ? [] : r.filePaths;
  },
  setStartup: (on) => { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: on }); },
  print: (o) => printJob(o, core.p('tmp')),
};

function trustedSender(e) { try { const u = new URL(e.senderFrame.url); return u.protocol === 'psapp:' && u.host === 'app'; } catch { return false; } }

async function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1024, minHeight: 680, backgroundColor: '#070b1a', title: 'Print Studio', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  await win.loadURL('psapp://app/index.html');
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  const data = path.join(app.getPath('userData'), 'data');
  const tess = app.isPackaged ? path.join(process.resourcesPath, 'tessdata') : path.join(__dirname, '..', '..', 'assets', 'tessdata');
  const testHw = !app.isPackaged && process.env.PS_TEST_HW ? require(process.env.PS_TEST_HW) : undefined; // خطاف اختبار (لا يعمل في النسخة المثبّتة)
  core = await new App({ dataDir: data, docsDir: app.getPath('documents'), ocrLangPath: tess, hw: testHw }).init();
  api = buildApi(core, ui);

  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
  protocol.handle('psapp', (req) => { // يخدم ملفات الواجهة فقط (بلا خروج من المجلد)
    try {
      let rel = decodeURIComponent(new URL(req.url).pathname); if (rel === '/' || !rel) rel = '/index.html';
      const f = path.resolve(RENDERER, '.' + rel); if (!f.startsWith(RENDERER + path.sep) || !fs.existsSync(f)) return new Response('not found', { status: 404 });
      return new Response(fs.readFileSync(f), { headers: { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' } });
    } catch { return new Response('bad request', { status: 400 }); }
  });
  protocol.handle('psfile', (req) => {
    try {
      const p = Buffer.from(new URL(req.url).pathname.slice(1), 'base64url').toString();
      if (!core.isAllowedPath(p) || !fs.existsSync(p)) return new Response('forbidden', { status: 403 });
      return net.fetch(pathToFileURL(p).toString());
    } catch { return new Response('bad request', { status: 400 }); }
  });
  ipcMain.handle('ps:call', async (e, name, ...args) => {
    if (!trustedSender(e)) throw new Error('مصدر غير موثوق');
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(api, name)) throw new Error('أمر غير معروف');
    try { return await api[name](...args); } catch (err) { core.log(name, String(err.message || err).slice(0, 200), false); throw err; }
  });
  await createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', async () => { try { await core.close(); } catch {} app.quit(); });
