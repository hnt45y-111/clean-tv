import { WebSocket } from 'ws';
import { createApp } from '../src/server.js';
import { openDb } from '../src/db.js';

export async function startApp(opts = {}) {
  const app = createApp({ db: opts.db || openDb(':memory:'), clientDir: '/nonexistent', ...opts });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  app.port = app.server.address().port; app.base = `http://127.0.0.1:${app.port}`;
  return app;
}
export async function http(app, method, path, body, token) {
  const r = await fetch(app.base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}
export async function signup(app, name) {
  const r = await http(app, 'POST', '/api/auth/guest', { name }); return r.body; // {token,user}
}
export class Client {
  constructor(app, session) { this.app = app; this.token = session.token; this.user = session.user; this.room = null; this.events = []; this.inbox = []; this.id = 0; this.pending = new Map(); this.waiters = []; }
  connect() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.app.port}/ws`);
      this.ws.on('open', () => this.ws.send(JSON.stringify({ t: 'auth', token: this.token })));
      this.ws.on('message', (raw) => {
        const m = JSON.parse(raw);
        if (m.t === 'hello') { this.room = m.room; this.friends = m.friends; resolve(this); }
        else if (m.t === 'room') this.room = m.room;
        else if (m.t === 'friends') this.friends = m;
        else if (m.t === 'ack') { this.pending.get(m.rid)?.(m); this.pending.delete(m.rid); }
        else this.inbox.push(m);
        this.events.push(m); this.waiters = this.waiters.filter((w) => !w());
      });
    });
  }
  send(msg) { return new Promise((res) => { const rid = ++this.id; this.pending.set(rid, res); this.ws.send(JSON.stringify({ ...msg, rid })); }); }
  async ok(msg) { const a = await this.send(msg); if (!a.ok) throw new Error(`${msg.t}/${msg.cmd || ''} → ${a.error}`); return a; }
  g(cmd, p = {}) { return this.ok({ t: 'g', cmd, ...p }); }
  until(pred, ms = 4000) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout waiting; phase=' + this.room?.match?.phase + ' status=' + this.room?.status)), ms);
      const check = () => { if (pred(this)) { clearTimeout(t); res(this); return true; } return false; };
      if (!check()) this.waiters.push(check);
    });
  }
  close() { this.ws?.close(); }
}
