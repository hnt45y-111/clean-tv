// خادم دكتورنا: REST + ملفات الواجهة الثابتة، بلا اعتماديات خارجية
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { handle } from './api.js';
import { one, run, now } from './db.js';
import { HttpError, hashPass, refCode } from './util.js';
import { ensureBootstrap } from './seed.js';

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT = resolve(here, '../../client');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'x-frame-options': 'DENY', 'permissions-policy': 'camera=(self), microphone=(self), geolocation=(self)' };

async function readBody(req, limit = 3_000_000) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw new HttpError(413, 'الطلب كبير'); chunks.push(c); }
  if (!n) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'JSON غير صالح'); }
}

export function createApp() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname.startsWith('/api/')) {
        const auth = req.headers.authorization || '';
        const tokenValue = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
        const user = tokenValue && one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?', tokenValue);
        const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
        const out = await handle(req.method, url.pathname, { user: user || null, tokenValue, body, query: Object.fromEntries(url.searchParams), ip: req.socket.remoteAddress });
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEC });
        return res.end(JSON.stringify(out));
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'غير مسموح');
      let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      let file = join(CLIENT, rel);
      if (!file.startsWith(CLIENT)) throw new HttpError(403, 'ممنوع');
      let data;
      try { data = await readFile(file); } catch { file = join(CLIENT, 'index.html'); data = await readFile(file); }
      const ext = extname(file);
      res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': ext === '.woff2' || ext === '.png' ? 'public, max-age=86400' : 'no-cache', ...SEC });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...SEC });
      res.end(JSON.stringify({ error: status === 500 ? 'حدث خطأ غير متوقع (٥٠٠)' : e.message }));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureBootstrap();
  const port = Number(process.env.PORT) || 3100;
  createApp().listen(port, '0.0.0.0', () => {
    console.log(`دكتورنا يشتغل على  http://localhost:${port}`);
    for (const list of Object.values(networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log(`   على الشبكة:      http://${i.address}:${port}`);
  });
}
