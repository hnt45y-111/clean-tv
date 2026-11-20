import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { openDb, one } from './db.js';
import * as A from './auth.js';
import * as P from './progress.js';
import { Hub, RoomError } from './rooms.js';
import { GameError } from './game/engine.js';

const here = dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

export function createApp({ db = openDb(), clientDir = join(here, '../../client'), googleClientId = process.env.GOOGLE_CLIENT_ID || '', mailer, hubOptions } = {}) {
  const hub = new Hub(db, hubOptions);
  const authLimit = A.rateLimiter(20, 10 * 60 * 1000);
  const mail = mailer || (async (to, code) => { console.log(`[mail] رمز استعادة كلمة المرور لـ ${to}: ${code} (اضبط SMTP لإرساله فعلياً)`); });

  const json = (res, status, body, headers = {}) => { const s = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); res.end(s); };
  const readBody = (req) => new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 300_000) { reject(new A.AuthError('too_large', 413)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch { reject(new A.AuthError('bad_json')); } });
  });
  const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const authed = (req) => A.userFromToken(db, bearer(req)) || (() => { throw new A.AuthError('unauthorized', 401); })();

  async function api(req, res, url) {
    const p = url.pathname; const m = req.method; const ip = req.socket.remoteAddress;
    if (m === 'GET' && p === '/api/config') return json(res, 200, { googleClientId, version: 1 });
    if (m === 'GET' && p === '/api/lan') return json(res, 200, { addresses: lanAddresses() });
    if (m === 'GET' && p === '/api/health') return json(res, 200, { ok: true, rooms: hub.rooms.size });
    if (m === 'GET' && p.startsWith('/api/avatar/')) {
      const u = one(db, 'SELECT avatar FROM users WHERE uid=?', p.slice(12));
      if (!u?.avatar) { res.writeHead(404); return res.end(); }
      const [head, b64] = u.avatar.split(','); const type = head.slice(5, head.indexOf(';'));
      res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' }); return res.end(Buffer.from(b64, 'base64'));
    }
    if (m === 'POST' && p.startsWith('/api/auth/')) {
      authLimit(ip); const b = await readBody(req); const act = p.slice(10);
      if (act === 'register') return json(res, 200, A.register(db, b));
      if (act === 'login') return json(res, 200, A.login(db, b));
      if (act === 'guest') return json(res, 200, A.guest(db, b));
      if (act === 'google') return json(res, 200, await A.googleLogin(db, b, { clientId: googleClientId }));
      if (act === 'forgot') return json(res, 200, await A.forgotPassword(db, b, mail));
      if (act === 'reset') return json(res, 200, A.resetPassword(db, b));
      if (act === 'logout') { A.logout(db, bearer(req)); return json(res, 200, { ok: true }); }
      return json(res, 404, { error: 'not_found' });
    }
    const user = authed(req); const uid = user.id;
    if (m === 'GET' && p === '/api/me') return json(res, 200, { user: A.publicUser(user), level: A.levelOf(user.xp), frames: A.FRAME_LEVELS });
    if (m === 'PATCH' && p === '/api/me') return json(res, 200, { user: A.updateProfile(db, user, await readBody(req)) });
    if (m === 'GET' && p === '/api/stats') return json(res, 200, P.statsFor(db, uid));
    if (m === 'GET' && p === '/api/leaderboard') return json(res, 200, { rows: P.leaderboard(db), me: uid });
    if (m === 'GET' && p === '/api/tasks') return json(res, 200, { tasks: P.ensureTasks(db, uid) });
    if (m === 'POST' && p === '/api/tasks/claim') {
      const got = P.claimTask(db, uid, (await readBody(req)).key); if (got === null) throw new A.AuthError('cannot_claim');
      return json(res, 200, { reward: got, user: A.publicUser(one(db, 'SELECT * FROM users WHERE id=?', uid)), tasks: P.ensureTasks(db, uid) });
    }
    if (m === 'GET' && p === '/api/rooms/public') return json(res, 200, { rooms: hub.listPublic() });
    if (m === 'GET' && p.startsWith('/api/user/')) {
      const u = one(db, 'SELECT * FROM users WHERE uid=?', p.slice(10)); if (!u) throw new A.AuthError('user_not_found', 404);
      return json(res, 200, { user: A.publicUser(u) });
    }
    return json(res, 404, { error: 'not_found' });
  }

  async function serveStatic(req, res, url) {
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (rel.includes('..')) { res.writeHead(400); return res.end(); }
    let file = join(clientDir, rel || 'index.html');
    try { const s = await stat(file); if (s.isDirectory()) file = join(file, 'index.html'); } catch { file = join(clientDir, 'index.html'); }
    try {
      const data = await readFile(file); const ext = extname(file);
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': file.endsWith('sw.js') || ext === '.html' ? 'no-cache' : 'public, max-age=3600',
        'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      return await serveStatic(req, res, url);
    } catch (e) {
      if (e instanceof A.AuthError) return json(res, e.status, { error: e.code });
      console.error(e); return json(res, 500, { error: 'server_error' });
    }
  });

  // ---------- WebSocket ----------
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('connection', (ws) => {
    let conn = null; ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
    const send = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
    const authTimer = setTimeout(() => ws.close(4001, 'auth_timeout'), 10000);
    let joinFails = 0;
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      if (!conn) {
        if (msg.t !== 'auth') return;
        const user = A.userFromToken(db, msg.token);
        if (!user) { send({ t: 'auth_failed' }); return ws.close(4003, 'unauthorized'); }
        clearTimeout(authTimer); conn = { ws, user, send }; hub.attach(conn); return;
      }
      const reply = (ok, extra = {}) => msg.rid !== undefined && send({ t: 'ack', rid: msg.rid, ok, ...extra });
      try {
        const fresh = one(db, 'SELECT * FROM users WHERE id=?', conn.user.id); if (!fresh || fresh.banned) return ws.close(4003, 'banned');
        conn.user = fresh; const u = fresh;
        switch (msg.t) {
          case 'ping': return send({ t: 'pong', serverTime: Date.now() });
          case 'room:create': hub.createRoom(u, msg); break;
          case 'room:join':
            try { hub.joinRoom(u, msg.key); } catch (e) { if (e instanceof RoomError && ['bad_token', 'room_not_found', 'private_room'].includes(e.code) && ++joinFails > 8) ws.close(4008, 'too_many_attempts'); throw e; }
            break;
          case 'room:ready': hub.setReady(u, msg.ready); break;
          case 'room:settings': hub.updateSettings(u, msg.settings || {}); break;
          case 'room:kick': hub.kick(u, msg.userId); break;
          case 'room:leave': hub.leave(u); break;
          case 'room:close': hub.close(u); break;
          case 'room:start': hub.startMatch(u); break;
          case 'g': hub.game(u, msg.cmd, msg); break;
          case 'mm:find': hub.findMatch(u); break;
          case 'mm:cancel': hub.cancelMatchmaking(u.id); break;
          case 'friend:request': hub.friendRequest(u, msg.uid); break;
          case 'friend:accept': hub.friendAccept(u, msg.userId); break;
          case 'friend:remove': case 'friend:decline': hub.friendRemove(u, msg.userId); break;
          case 'friends': send({ t: 'friends', ...hub.friendsView(u.id) }); break;
          case 'invite': hub.invite(u, msg.userId); break;
          case 'report': return reply(true, hub.report(u, msg.userId, msg.reason));
          default: return reply(false, { error: 'bad_message' });
        }
        reply(true);
      } catch (e) {
        if (e instanceof RoomError || e instanceof GameError || e instanceof A.AuthError) return reply(false, { error: e.code });
        console.error(e); reply(false, { error: 'server_error' });
      }
    });
    ws.on('close', () => { clearTimeout(authTimer); if (conn) hub.detach(conn); });
    ws.on('error', () => {});
  });
  const hb = setInterval(() => { wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }); }, 25000); hb.unref();

  const restored = hub.restore();
  return { server, hub, db, wss, restored, close: () => new Promise((r) => { clearInterval(hb); wss.clients.forEach((c) => c.terminate()); server.close(r); }) };
}

export function lanAddresses() {
  return Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +process.env.PORT || 3000;
  const app = createApp();
  app.server.listen(port, '0.0.0.0', () => {
    console.log(`Mafia server  →  http://localhost:${port}`);
    lanAddresses().forEach((a) => console.log(`  شبكة محلية (أوفلاين) →  http://${a}:${port}`));
    if (app.restored) console.log(`  استُرجعت ${app.restored} غرفة من اللقطات`);
  });
}
