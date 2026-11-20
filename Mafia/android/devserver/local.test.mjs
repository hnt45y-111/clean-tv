// اختبارات تكامل لخادم هاتف الراوي (Java) بنفس عميل WebSocket المستخدم مع خادم Node.
// التشغيل: bash run-tests.sh   (يترجم الكود ثم يشغّل هذه الاختبارات)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { Client } from '../../server/test/helpers.js';

const CP = process.env.JCP || '/tmp/claude-0/jbuild';
const CLIENT = new URL('../../client', import.meta.url).pathname;
let nextPort = 3400;
async function startJava(snap = `/tmp/mafia-local-${process.pid}-${nextPort}.json`, fresh = true) {
  const port = nextPort++; if (fresh) rmSync(snap, { force: true });
  const proc = spawn('java', ['-cp', CP, 'DevMain', CLIENT, String(port), snap], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LOBBY_GRACE_MS: '500' } });
  await new Promise((res, rej) => { proc.stdout.on('data', (d) => { if (String(d).includes('local server on')) res(); }); proc.on('exit', () => rej(new Error('java exited'))); setTimeout(() => rej(new Error('java start timeout')), 15000); });
  return { port, base: `http://127.0.0.1:${port}`, proc, snap, close: () => new Promise((r) => { proc.once('exit', r); proc.kill('SIGKILL'); }) };
}
const guest = async (app, name) => (await fetch(app.base + '/api/auth/guest', { method: 'POST', body: JSON.stringify({ name }) })).json();
const mk = async (app, names) => Promise.all(names.map(async (n) => new Client(app, await guest(app, n)).connect()));
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

async function playToEnd(host, players) {
  for (let guard = 0; guard < 40 && host.room.match.phase !== 'ended'; guard++) {
    const ph = host.room.match.phase; const alive = host.room.match.players.filter((p) => p.alive);
    const me = (c) => alive.find((p) => p.id === String(c.user.id));
    if (ph === 'roles') { for (const c of players) await c.g('ack'); await host.g('beginNight'); }
    else if (ph === 'night') {
      const mafias = alive.filter((p) => p.role === 'mafia'); const targets = alive.filter((p) => p.role !== 'mafia');
      for (const c of players) { const x = me(c); if (!x) continue;
        if (x.role === 'mafia') await c.g('night', { kind: 'kill', target: targets[0].id });
        else if (x.role === 'detective') await c.g('night', { kind: 'investigate', target: mafias[0].id });
        else if (x.role === 'doctor') await c.g('night', { kind: 'save', target: targets[targets.length - 1].id }).catch(() => c.g('night', { kind: 'save', target: alive[0].id }));
        else if (x.role === 'sniper') await c.g('night', { kind: 'shoot', target: null }); }
      await host.until((h) => h.room.match.narrator.night.pending.length === 0);
      await host.g('resolveNight');
    } else if (ph === 'dawn') await host.g('beginDay');
    else if (ph === 'day') { await host.g('setSpeaker', { id: alive[0].id }); await host.g('beginVote'); }
    else if (ph === 'vote') { const maf = alive.find((p) => p.role === 'mafia');
      for (const c of players) { const x = me(c); if (!x) continue; await c.g('vote', { target: x.id === maf.id ? alive.find((p) => p.id !== x.id).id : maf.id }); }
      await host.g('closeVote'); }
    else if (ph === 'voteResult') await host.g('beginNight');
    await settle(60);
  }
  return host.room;
}

test('local: full offline match, secrets protected, 2 rounds without re-joining', async () => {
  const app = await startJava();
  const [host, ...ps] = await mk(app, ['الراوي', 'A', 'B', 'C', 'D', 'E', 'F']);
  await host.ok({ t: 'room:create', mode: 'offline', settings: { players: 6, mafia: 1, rounds: 2 } });
  const key = host.room.joinKey; assert.match(key, /^\d{6}-[A-Z2-9]{8}$/);
  for (const p of ps) await p.ok({ t: 'room:join', key });
  await host.until((h) => h.room.members.length === 6);
  assert.equal((await ps[0].send({ t: 'room:start' })).error, 'not_host');
  await host.ok({ t: 'room:start' }); await settle();
  for (const p of ps) {
    const known = p.room.match.players.filter((x) => x.role);
    assert.ok(known.length >= 1 && known.length <= 2, 'player sees only own role (+mafia mates)');
    assert.equal(p.room.joinKey, undefined);
  }
  assert.ok(host.room.match.players.every((x) => x.role));
  let room = await playToEnd(host, ps);
  assert.equal(room.match.phase, 'ended'); assert.equal(room.status, 'between'); assert.ok(room.match.winner);
  await host.g('nextRound'); await settle();
  assert.equal(host.room.round, 2); assert.equal(host.room.match.phase, 'roles'); assert.equal(host.room.members.length, 6);
  room = await playToEnd(host, ps);
  assert.equal(room.status, 'finished');
  [host, ...ps].forEach((c) => c.close()); await app.close();
});

test('local: only the host device may create rooms; token required; duplicates rejected', async () => {
  const app = await startJava();
  const [host, a, b, c, d] = await mk(app, ['N', 'A', 'B', 'C', 'D']);
  await host.ok({ t: 'room:create', mode: 'offline', settings: { players: 4, mafia: 1 } });
  const { code, joinKey } = host.room;
  assert.equal((await a.send({ t: 'room:join', key: code })).error, 'bad_token');
  assert.equal((await a.send({ t: 'room:join', key: code + '-WRONGTOK' })).error, 'bad_token');
  assert.equal((await a.send({ t: 'room:create', mode: 'online' })).error, 'bad_mode');
  for (const p of [a, b, c, d]) await p.ok({ t: 'room:join', key: joinKey.toLowerCase() });
  await host.ok({ t: 'room:start' }); await host.g('beginNight'); await settle();
  const ps = [a, b, c, d]; const maf = ps.find((p) => p.room.match.me.role === 'mafia');
  const tgt = String(ps.find((p) => p !== maf).user.id);
  await maf.g('night', { kind: 'kill', target: tgt });
  assert.equal((await maf.send({ t: 'g', cmd: 'night', kind: 'kill', target: tgt })).error, 'already_acted');
  const cit = ps.find((p) => p.room.match.me.role === 'citizen');
  if (cit) assert.equal((await cit.send({ t: 'g', cmd: 'night', kind: 'kill', target: String(maf.user.id) })).error, 'forbidden');
  assert.equal((await a.send({ t: 'g', cmd: 'beginDay' })).error, 'not_host');
  // المحقق يرى نتيجة تحقيقه وحده
  const det = ps.find((p) => p.room.match.me.role === 'detective');
  await det.g('night', { kind: 'investigate', target: String(maf.user.id) }); await settle();
  assert.deepEqual(det.room.match.me.priv.at(-1), { type: 'investigation', night: 1, target: String(maf.user.id), isMafia: true });
  for (const p of ps.filter((x) => x !== det)) assert.equal(p.room.match.me.priv.length, 0);
  await host.g('resolveNight'); await settle();
  if (host.room.match.phase === 'dawn') {
    await host.g('beginDay'); const live = host.room.match.players.find((p) => p.alive);
    await host.g('mute', { id: live.id, muted: true }); await settle();
    assert.equal(host.room.match.players.find((p) => p.id === live.id).manual, true);
    await host.g('beginVote'); await settle();
    const voter = ps.find((p) => p.room.match.me.alive); const other = host.room.match.players.find((p) => p.alive && p.id !== String(voter.user.id));
    await voter.g('vote', { target: other.id });
    assert.equal((await voter.send({ t: 'g', cmd: 'vote', target: other.id })).error, 'already_voted');
  }
  [host, a, b, c, d].forEach((x) => x.close()); await app.close();
});

test('local: live roster, leave updates list, reconnect restores same room and role', async () => {
  const app = await startJava();
  const [host, a, b, c, d] = await mk(app, ['N', 'A', 'B', 'C', 'D']);
  await host.ok({ t: 'room:create', mode: 'offline', settings: { players: 4, mafia: 1 } });
  const key = host.room.joinKey;
  await a.ok({ t: 'room:join', key }); await host.until((h) => h.room.members.length === 1);
  assert.equal(host.room.members[0].name, 'A'); assert.equal(host.room.members[0].connected, true); assert.match(host.room.members[0].uid, /^\d{8}$/);
  for (const p of [b, c, d]) await p.ok({ t: 'room:join', key });
  await d.ok({ t: 'room:leave' }); await host.until((h) => h.room.members.length === 3);
  await d.ok({ t: 'room:join', key }); await host.until((h) => h.room.members.length === 4);
  await host.ok({ t: 'room:start' }); await settle();
  const role = a.room.match.me.role; a.close();
  await host.until((h) => h.room.members.find((m) => m.name === 'A').connected === false);
  const a2 = await new Client(app, { token: a.token, user: a.user }).connect();
  assert.equal(a2.room.match.me.role, role);
  await host.until((h) => h.room.members.find((m) => m.name === 'A').connected === true);
  // الراوي ينقطع ويعود
  host.close(); const h2 = await new Client(app, { token: host.token, user: host.user }).connect();
  assert.equal(h2.room.isHost, true); assert.ok(h2.room.match.players.every((p) => p.role));
  [h2, a2, b, c, d].forEach((x) => x.close()); await app.close();
});

test('local: lobby member who disconnects is removed after grace; kicked player cannot return', async () => {
  const app = await startJava();
  const [host, a, b] = await mk(app, ['N', 'A', 'B']);
  await host.ok({ t: 'room:create', mode: 'offline', settings: { players: 4, mafia: 1 } });
  await a.ok({ t: 'room:join', key: host.room.joinKey }); await b.ok({ t: 'room:join', key: host.room.joinKey });
  a.close(); await host.until((h) => h.room.members.length === 1, 4000); // مهلة 500ms في الاختبار
  await host.ok({ t: 'room:kick', userId: b.user.id }); await host.until((h) => h.room.members.length === 0);
  assert.equal((await b.send({ t: 'room:join', key: host.room.joinKey })).error, 'banned_from_room');
  [host, b].forEach((x) => x.close()); await app.close();
});

test('local: room survives a crash of the host app (snapshot restore)', async () => {
  const snap = `/tmp/mafia-local-restore-${process.pid}.json`;
  let app = await startJava(snap);
  const [host, ...ps] = await mk(app, ['N', 'A', 'B', 'C', 'D']);
  await host.ok({ t: 'room:create', mode: 'offline', settings: { players: 4, mafia: 1 } });
  for (const p of ps) await p.ok({ t: 'room:join', key: host.room.joinKey });
  await host.ok({ t: 'room:start' }); await host.g('beginNight'); await settle(600); // انتظار الحفظ المؤجل (300ms)
  const roles = host.room.match.players.map((p) => p.role).join();
  const sessions = [host, ...ps].map((c) => ({ token: c.token, user: c.user }));
  [host, ...ps].forEach((c) => c.close()); await app.close();
  app = await startJava(snap, false);
  const h2 = await new Client(app, sessions[0]).connect();
  assert.equal(h2.room.match.phase, 'night'); assert.equal(h2.room.match.players.map((p) => p.role).join(), roles);
  const p2 = await new Client(app, sessions[1]).connect(); assert.ok(p2.room.match.me.role);
  [h2, p2].forEach((x) => x.close()); await app.close(); rmSync(snap, { force: true });
});

test('local: REST — guest names, rename, local-only endpoints, config only reveals Wi-Fi to the host', async () => {
  const app = await startJava();
  const g = await guest(app, '  سالم   الكبير ');
  assert.equal(g.user.name, 'سالم الكبير'); assert.match(g.user.uid, /^\d{8}$/);
  const H = { authorization: 'Bearer ' + g.token };
  const me = await (await fetch(app.base + '/api/me', { headers: H })).json(); assert.equal(me.user.id, g.user.id);
  const r = await (await fetch(app.base + '/api/me', { method: 'PATCH', headers: H, body: JSON.stringify({ name: 'زيد' }) })).json(); assert.equal(r.user.name, 'زيد');
  assert.equal((await fetch(app.base + '/api/me', { method: 'PATCH', headers: H, body: JSON.stringify({ name: 'ز' }) })).status, 400);
  assert.equal((await fetch(app.base + '/api/me')).status, 401);
  assert.equal((await (await fetch(app.base + '/api/auth/login', { method: 'POST', body: '{}' })).json()).error, 'local_only');
  const cfg = await (await fetch(app.base + '/api/config')).json();
  assert.equal(cfg.local, true); assert.equal(cfg.isHost, true); assert.equal(cfg.wifi.ssid, 'DIRECT-Mafia-TEST'); // الاختبار من نفس الجهاز
  assert.equal((await fetch(app.base + '/js/main.js')).headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal((await fetch(app.base + '/../../etc/passwd')).status, 200); // يعيد index.html، لا يخرج من مجلد الواجهة
  assert.ok((await (await fetch(app.base + '/../../etc/passwd')).text()).includes('<!doctype html>'));
  await fetch(app.base + '/api/auth/logout', { method: 'POST', headers: H });
  assert.equal((await fetch(app.base + '/api/me', { headers: H })).status, 401);
  await app.close();
});

test('local: another device on the network cannot create rooms or read the Wi-Fi password', async (t) => {
  const { networkInterfaces } = await import('node:os');
  const ip = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  if (!ip) return t.skip('no non-loopback interface');
  const app = await startJava(); const base = `http://${ip}:${app.port}`;
  const cfg = await (await fetch(base + '/api/config')).json();
  assert.equal(cfg.isHost, false); assert.equal(cfg.wifi, null);
  const g = await (await fetch(base + '/api/auth/guest', { method: 'POST', body: '{"name":"remote"}' })).json();
  const ack = await new Promise((res) => { const ws = new WebSocket(`ws://${ip}:${app.port}/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: g.token }));
    ws.onmessage = (e) => { const x = JSON.parse(e.data); if (x.t === 'hello') ws.send(JSON.stringify({ t: 'room:create', mode: 'offline', settings: { players: 4, mafia: 1 }, rid: 1 })); if (x.t === 'ack') { ws.close(); res(x); } }; });
  assert.equal(ack.error, 'not_host');
  await app.close();
});
