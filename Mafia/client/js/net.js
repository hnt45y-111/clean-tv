// الاتصال بالخادم: REST للحسابات + WebSocket للحالة اللحظية مع إعادة اتصال تلقائية.
import { S, saveToken, notify, emit } from './store.js';

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, { method, headers: { 'content-type': 'application/json', ...(S.token ? { authorization: 'Bearer ' + S.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('network'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { if (res.status === 401 && S.token && !path.startsWith('/api/auth/')) { dropSession(); } throw new Error(data.error || 'server_error'); }
  return data;
}

let ws = null, retry = 0, hb = null, rid = 0, wantOpen = false; const pending = new Map();

export function connect() {
  if (!S.token) return; wantOpen = true;
  if (ws && ws.readyState <= 1) return;
  S.conn = S.conn === 'ok' ? 'ok' : 'connecting'; notify();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: S.token }));
  ws.onmessage = (e) => handle(JSON.parse(e.data));
  ws.onclose = () => {
    clearInterval(hb); pending.forEach((r) => r({ ok: false, error: 'network' })); pending.clear();
    if (S.conn !== 'idle') { S.conn = 'down'; notify(); }
    if (wantOpen) setTimeout(connect, Math.min(8000, 700 * 2 ** retry++));
  };
  ws.onerror = () => {};
}
export function disconnect() { wantOpen = false; S.conn = 'idle'; S.room = null; clearInterval(hb); ws?.close(); ws = null; }
export function dropSession() { disconnect(); saveToken(null); S.user = null; notify(); }

function handle(m) {
  switch (m.t) {
    case 'hello':
      retry = 0; S.conn = 'ok'; S.user = m.user; S.room = m.room; S.friends = m.friends; S.offset = m.serverTime - Date.now();
      clearInterval(hb); hb = setInterval(() => send({ t: 'ping' }), 20000); emit('hello'); break;
    case 'pong': S.offset = m.serverTime - Date.now(); return;
    case 'room': S.room = m.room; if (m.room == null) emit('left', m.reason); break;
    case 'friends': S.friends = { friends: m.friends, incoming: m.incoming, outgoing: m.outgoing }; break;
    case 'event': emit('event', m); return;
    case 'notif': emit('notif', m); return;
    case 'invite': S.invite = m; emit('invite', m); break;
    case 'progress': S.user = m.user; S.lastGain = m.gained; emit('progress', m); break;
    case 'ack': { const r = pending.get(m.rid); if (r) { pending.delete(m.rid); r(m); } return; }
    case 'auth_failed': dropSession(); return;
  }
  notify();
}
export function send(msg) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== 1) return resolve({ ok: false, error: 'network' });
    const id = ++rid; pending.set(id, resolve); ws.send(JSON.stringify({ ...msg, rid: id }));
    setTimeout(() => { if (pending.delete(id)) resolve({ ok: false, error: 'timeout' }); }, 8000);
  });
}
// أوامر اللعب
export const game = (cmd, p = {}) => send({ t: 'g', cmd, ...p });
