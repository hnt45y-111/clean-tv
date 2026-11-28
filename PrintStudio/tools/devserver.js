// خادم تطوير/اختبار: يقدّم الواجهة في متصفح عادي مع نفس واجهة الاستدعاءات، وأجهزة محاكاة (للاختبار فقط).
// لا يُستخدم في الإنتاج. المحاكاة معلنة صراحةً: طابعتان وسكانر يعيد صور اختبار.
const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');
const { App } = require('../src/core/app'); const { buildApi } = require('../src/main/api');
const fx = require('../tests/fixtures');

async function start({ port = 5179, dataDir } = {}) {
  dataDir = dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'ps-dev-'));
  const picks = { files: [], folder: path.join(dataDir, 'exports') }; const scanQueue = []; let scannerOnline = true;
  const hw = {
    listPrinters: async () => [{ name: 'HP LaserJet Pro MFP', driver: 'HP Universal Printing PCL 6', port: 'IP_192.168.1.20', isDefault: true, state: 'ready', statusText: 'جاهزة' }, { name: 'Canon LBP2900', driver: 'Canon LBP2900', port: 'USB001', isDefault: false, state: 'offline', statusText: 'غير متصلة' }],
    listScanners: async () => (scannerOnline ? [{ id: 'wia-1', name: 'HP LaserJet Pro MFP Scanner (محاكاة)', ready: true, error: '' }] : []),
    scan: async (o) => { if (!scannerOnline) throw new Error('السكانر غير متصل أو مغلق'); const kind = scanQueue.shift() || 'letter'; const b = kind === 'table' ? await fx.tablePng() : await fx.letterPng(); const f = o.outBase + '.png'; fs.writeFileSync(f, b); return [f]; },
    printerJobs: async () => [], cancelJob: async () => ({ ok: true }), openQueue: async () => ({ ok: true }), openProperties: async () => ({ ok: true }),
  };
  const core = await new App({ dataDir: path.join(dataDir, 'data'), docsDir: path.join(dataDir, 'docs'), hw }).init();
  const printed = [];
  const ui = { setStartup() {}, emit() {}, version: () => 'dev', fileUrl: (p) => p, openPath: async () => true, reveal: () => true, pickFolder: async () => picks.folder, pickFiles: async () => picks.files.splice(0), print: async (o) => { printed.push({ printer: o.printer, pages: o.files.length, copies: o.copies }); return { ok: true, pages: o.files.length }; } };
  const api = buildApi(core, ui);
  const R = path.join(__dirname, '..', 'src', 'renderer');
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };
  const shim = `window.PS_URL_BASE='/file/';window.ps={call:async(n,...a)=>{const r=await fetch('/rpc',{method:'POST',body:JSON.stringify({n,a},(k,v)=>v instanceof ArrayBuffer?{__b:(()=>{const u=new Uint8Array(v);let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)})()}:v)});const j=await r.json();if(j.e)throw new Error(j.e);return j.r&&j.r.__b!==undefined?Uint8Array.from(atob(j.r.__b),c=>c.charCodeAt(0)).buffer:j.r},on:()=>()=>{}};`;
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      if (u.pathname === '/__shim.js') { res.setHeader('content-type', 'text/javascript'); return res.end(shim); }
      if (u.pathname === '/__picks') { const body = JSON.parse(await readBody(req) || '{}'); if (body.files) picks.files = body.files; if (body.folder) picks.folder = body.folder; if (body.scan) scanQueue.push(...body.scan); if (body.scannerOnline !== undefined) scannerOnline = body.scannerOnline; return res.end(JSON.stringify({ printed })); }
      if (u.pathname === '/rpc') {
        const { n, a } = JSON.parse(await readBody(req), (k, v) => (v && v.__b !== undefined ? Buffer.from(v.__b, 'base64') : v));
        if (!Object.prototype.hasOwnProperty.call(api, n)) throw new Error('أمر غير معروف');
        let r = await api[n](...a); if (Buffer.isBuffer(r)) r = { __b: r.toString('base64') };
        return res.end(JSON.stringify({ r }));
      }
      if (u.pathname.startsWith('/file/')) { const p = Buffer.from(u.pathname.slice(6), 'base64url').toString(); if (!core.isAllowedPath(p) || !fs.existsSync(p)) { res.statusCode = 403; return res.end(); } res.setHeader('content-type', MIME[path.extname(p).toLowerCase()] || 'application/octet-stream'); return fs.createReadStream(p).pipe(res); }
      let rel = decodeURIComponent(u.pathname); if (rel === '/') rel = '/index.html'; const f = path.join(R, rel); if (!f.startsWith(R) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('nf'); }
      res.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream');
      if (rel === '/index.html') return res.end(fs.readFileSync(f, 'utf8').replace('<script type="module"', '<script src="/__shim.js"></script><script type="module"'));
      fs.createReadStream(f).pipe(res);
    } catch (e) { res.statusCode = 200; res.end(JSON.stringify({ e: e.message })); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${port}/`, core, dataDir, picks, close: async () => { server.close(); await core.close(); } };
}
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
module.exports = { start };
if (require.main === module) start({ port: +process.env.PORT || 5179 }).then((s) => console.log('dev server:', s.url));
