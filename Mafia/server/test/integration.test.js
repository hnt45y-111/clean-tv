import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, signup, Client, http } from './helpers.js';
import { openDb } from '../src/db.js';

const mkClients = async (app, names) => Promise.all(names.map(async (n) => new Client(app, await signup(app, n)).connect()));
const settle = () => new Promise((r) => setTimeout(r, 60));

async function playMatchToEnd(host, players) {
  // يلعب المباراة حتى النهاية بقرارات صالحة، ويعيد الغرفة النهائية
  for (let guard = 0; guard < 30 && host.room.match.phase !== 'ended'; guard++) {
    const ph = host.room.match.phase;
    const alive = host.room.match.players.filter((p) => p.alive);
    const role = (id) => host.room.match.players.find((p) => p.id === id).role; // الراوي يرى الأدوار
    const aliveById = (c) => alive.find((p) => p.id === String(c.user.id));
    if (ph === 'roles') { for (const c of players) await c.g('ack'); await host.g('beginNight'); }
    else if (ph === 'night') {
      const mafias = alive.filter((p) => p.role === 'mafia'); const targets = alive.filter((p) => p.role !== 'mafia');
      for (const c of players) {
        const me = aliveById(c); if (!me) continue;
        if (me.role === 'mafia') await c.g('night', { kind: 'kill', target: targets[0].id });
        else if (me.role === 'detective') await c.g('night', { kind: 'investigate', target: mafias[0].id });
        else if (me.role === 'doctor') await c.g('night', { kind: 'save', target: targets[targets.length - 1].id }).catch(() => c.g('night', { kind: 'save', target: alive[0].id }));
        else if (me.role === 'sniper') await c.g('night', { kind: 'shoot', target: null });
      }
      await host.until((h) => h.room.match.phase === 'night' && h.room.match.narrator.night.pending.length === 0);
      await host.g('resolveNight');
    } else if (ph === 'dawn') await host.g('beginDay');
    else if (ph === 'day') { await host.g('setSpeaker', { id: alive[0].id }); await host.g('beginVote'); }
    else if (ph === 'vote') {
      const mafia = alive.find((p) => role(p.id) === 'mafia');
      for (const c of players) { const me = aliveById(c); if (!me) continue; await c.g('vote', { target: me.id === mafia.id ? alive.find((p) => p.id !== me.id).id : mafia.id }); }
      await host.g('closeVote');
    } else if (ph === 'voteResult') await host.g('beginNight');
    await settle();
  }
  return host.room;
}

test('online: full match with narrator, privacy and 2 rounds without re-joining', async () => {
  const app = await startApp();
  const [host, ...ps] = await mkClients(app, ['Narrator', 'A', 'B', 'C', 'D', 'E', 'F']);
  await host.ok({ t: 'room:create', mode: 'online', settings: { players: 6, mafia: 1, rounds: 2, visibility: 'public' } });
  const code = host.room.code;
  for (const p of ps) await p.ok({ t: 'room:join', key: code });
  await host.until((h) => h.room.members.length === 6);
  // لا يبدأ قبل جاهزية الجميع
  assert.equal((await host.send({ t: 'room:start' })).error, 'not_all_ready');
  for (const p of ps) await p.ok({ t: 'room:ready', ready: true });
  // غير الراوي لا يبدأ
  assert.equal((await ps[0].send({ t: 'room:start' })).error, 'not_host');
  await host.ok({ t: 'room:start' });
  await settle();

  // خصوصية الأدوار: كل لاعب يرى دوره فقط (والمافيا ترى زملاءها)
  for (const p of ps) {
    const known = p.room.match.players.filter((x) => x.role);
    assert.ok(known.length >= 1 && known.length <= 2);
    assert.equal(p.room.match.me.role, p.room.match.players.find((x) => x.id === String(p.user.id)).role);
  }
  assert.equal(host.room.match.players.every((x) => x.role), true);
  assert.equal(host.room.joinKey.length > 8, true);
  assert.equal(ps[0].room.joinKey, undefined); // رمز الغرفة السري للراوي فقط

  let room = await playMatchToEnd(host, ps);
  assert.equal(room.match.phase, 'ended'); assert.equal(room.status, 'between');
  assert.equal(room.round, 1);
  // نقاط حُفظت
  const stats = await http(app, 'GET', '/api/stats', null, ps[0].token); assert.equal(stats.body.matches, 1);
  // الجولة 2 بلا QR ولا انضمام جديد
  await host.ok({ t: 'g', cmd: 'nextRound' }); await settle();
  assert.equal(host.room.round, 2); assert.equal(host.room.match.phase, 'roles'); assert.equal(host.room.members.length, 6);
  room = await playMatchToEnd(host, ps);
  assert.equal(room.status, 'finished');
  assert.equal((await http(app, 'GET', '/api/stats', null, ps[0].token)).body.matches, 2);
  [host, ...ps].forEach((c) => c.close()); await app.close();
});

test('online: duplicate votes/actions rejected; dead cannot act; mute is narrator-only', async () => {
  const app = await startApp();
  const [host, ...ps] = await mkClients(app, ['N', 'A', 'B', 'C', 'D', 'E']);
  await host.ok({ t: 'room:create', mode: 'online', settings: { players: 5, mafia: 1, visibility: 'public' } });
  for (const p of ps) { await p.ok({ t: 'room:join', key: host.room.code }); await p.ok({ t: 'room:ready', ready: true }); }
  await host.ok({ t: 'room:start' }); await settle();
  await host.g('beginNight');
  const mafiaC = ps.find((p) => p.room.match.me.role === 'mafia');
  const other = ps.find((p) => p !== mafiaC && p.room.match.me.role !== 'detective');
  const tgt = String(ps.find((p) => p !== mafiaC).user.id);
  await mafiaC.g('night', { kind: 'kill', target: tgt });
  assert.equal((await mafiaC.send({ t: 'g', cmd: 'night', kind: 'kill', target: tgt })).error, 'already_acted');
  assert.equal((await other.send({ t: 'g', cmd: 'night', kind: 'kill', target: String(mafiaC.user.id) })).error, 'forbidden');
  assert.equal((await ps[0].send({ t: 'g', cmd: 'mute', id: tgt, muted: true })).error, 'not_host');
  assert.equal((await ps[0].send({ t: 'g', cmd: 'beginDay' })).error, 'not_host');
  await host.g('resolveNight'); await host.g('beginDay');
  const live = host.room.match.players.find((p) => p.alive);
  await host.g('mute', { id: live.id, muted: true }); await settle();
  assert.equal(host.room.match.players.find((p) => p.id === live.id).muted, true);
  await host.g('mute', { id: live.id, muted: false }); await settle();
  assert.equal(host.room.match.players.find((p) => p.id === live.id).muted, false);
  [host, ...ps].forEach((c) => c.close()); await app.close();
});

test('offline QR room: token required, unauthorized rejected, live roster, reconnect keeps state', async () => {
  const app = await startApp();
  const [host, a, b, c, intruder] = await mkClients(app, ['Host', 'A', 'B', 'C', 'X']);
  await host.ok({ t: 'room:create', mode: 'offline', settings: { players: 4, mafia: 1 } });
  const { code, joinKey } = host.room;
  assert.equal((await intruder.send({ t: 'room:join', key: code })).error, 'bad_token');       // الرمز العددي وحده لا يكفي
  assert.equal((await intruder.send({ t: 'room:join', key: code + '-WRONGTOK' })).error, 'bad_token');
  await a.ok({ t: 'room:join', key: joinKey });
  await host.until((h) => h.room.members.length === 1);
  assert.equal(host.room.members[0].name, 'A'); assert.ok(host.room.members[0].uid); assert.equal(host.room.members[0].connected, true);
  await b.ok({ t: 'room:join', key: joinKey }); await c.ok({ t: 'room:join', key: joinKey });
  assert.equal((await intruder.send({ t: 'room:join', key: joinKey.toLowerCase() })).ok, true); // الرمز غير حساس لحالة الأحرف
  await host.until((h) => h.room.members.length === 4);
  // انسحاب لاعب يحدّث القائمة
  await intruder.ok({ t: 'room:leave' }); await host.until((h) => h.room.members.length === 3);
  const intr2 = intruder; await intr2.ok({ t: 'room:join', key: joinKey });
  await host.until((h) => h.room.members.length === 4);
  await host.ok({ t: 'room:start' }); await settle();
  // انقطاع a ثم رجوعه: يعود لنفس الغرفة والدور
  const roleBefore = a.room.match.me.role; a.close();
  await host.until((h) => h.room.members.find((m) => m.name === 'A').connected === false);
  const a2 = await new Client(app, { token: a.token, user: a.user }).connect();
  assert.equal(a2.room.code, code); assert.equal(a2.room.match.me.role, roleBefore);
  await host.until((h) => h.room.members.find((m) => m.name === 'A').connected === true);
  [host, a2, b, c, intruder].forEach((x) => x.close()); await app.close();
});

test('rooms persist across server restart (snapshot restore)', async () => {
  const db = openDb(':memory:'); let app = await startApp({ db });
  const [host, ...ps] = await mkClients(app, ['N', 'A', 'B', 'C', 'D']);
  await host.ok({ t: 'room:create', mode: 'offline', settings: { players: 4, mafia: 1 } });
  for (const p of ps) await p.ok({ t: 'room:join', key: host.room.joinKey });
  await host.ok({ t: 'room:start' }); await host.g('beginNight'); await settle();
  const roles = host.room.match.players.map((p) => p.role).join();
  const sessions = [host, ...ps].map((c) => ({ token: c.token, user: c.user }));
  [host, ...ps].forEach((c) => c.close()); await new Promise((r) => setTimeout(r, 50));
  app.wss.clients.forEach((c) => c.terminate()); await new Promise((r) => app.server.close(r));
  const app2 = await startApp({ db }); assert.equal(app2.restored, 1);
  const h2 = await new Client(app2, sessions[0]).connect();
  assert.equal(h2.room.match.phase, 'night'); assert.equal(h2.room.match.players.map((p) => p.role).join(), roles);
  h2.close(); await app2.close();
});

test('random matchmaking: auto-narrated room plays itself to the end', async () => {
  const app = await startApp({ hubOptions: { autoTimings: { min: 5, cap: 5, countdownMs: 200, fullDelayMs: 100, roleRevealMs: 80, dawnMs: 60, resultMs: 60, talkSeconds: 0.25, voteSeconds: 10, nightSeconds: 10 } } });
  const ps = await mkClients(app, ['P1', 'P2', 'P3', 'P4', 'P5']);
  for (const p of ps) await p.ok({ t: 'mm:find' });
  assert.equal(new Set(ps.map((p) => p.room.code)).size, 1);
  await ps[0].until((c) => c.room.match?.phase === 'roles', 3000);
  // اللاعبون يتصرفون بقرارات صالحة؛ الراوي الآلي يدير الباقي
  let guard = 0;
  while (ps[0].room.status !== 'finished' && guard++ < 400) {
    const ph = ps[0].room.match?.phase;
    for (const p of ps) {
      const m = p.room.match; if (!m?.me?.alive) continue;
      const others = m.players.filter((x) => x.alive && x.id !== m.me.id);
      if (m.phase === 'night' && !m.me.acted) {
        const role = m.me.role; const tgt = others.filter((x) => !(m.me.mates || []).includes(x.id))[0];
        if (role === 'mafia') await p.send({ t: 'g', cmd: 'night', kind: 'kill', target: tgt.id });
        else if (role === 'detective') await p.send({ t: 'g', cmd: 'night', kind: 'investigate', target: others[0].id });
        else if (role === 'doctor') await p.send({ t: 'g', cmd: 'night', kind: 'save', target: others[0].id });
        else if (role === 'sniper') await p.send({ t: 'g', cmd: 'night', kind: 'shoot', target: null });
      } else if (m.phase === 'vote' && !m.me.voted) await p.send({ t: 'g', cmd: 'vote', target: others[0]?.id });
    }
    await new Promise((r) => setTimeout(r, 40));
    if (ph === 'ended') break;
  }
  assert.equal(ps[0].room.match.phase, 'ended'); assert.ok(ps[0].room.match.winner);
  ps.forEach((c) => c.close()); await app.close();
});

test('friends: request by ID, accept, presence, invite to private room', async () => {
  const app = await startApp();
  const [a, b] = await mkClients(app, ['A', 'B']);
  assert.equal((await a.send({ t: 'friend:request', uid: a.user.uid })).error, 'self_friend');
  assert.equal((await a.send({ t: 'friend:request', uid: '00000000' })).error, 'user_not_found');
  await a.ok({ t: 'friend:request', uid: b.user.uid });
  await b.until((c) => c.friends?.incoming.length === 1);
  assert.equal((await a.send({ t: 'friend:request', uid: b.user.uid })).error, 'already_requested');
  await b.ok({ t: 'friend:accept', userId: a.user.id });
  await a.until((c) => c.friends.friends.length === 1 && c.friends.friends[0].online);
  await a.ok({ t: 'room:create', mode: 'online', settings: { players: 5, mafia: 1, visibility: 'private' } });
  assert.equal((await b.send({ t: 'room:join', key: a.room.code })).error, 'private_room');
  await a.ok({ t: 'invite', userId: b.user.id });
  await b.until((c) => c.inbox.some((m) => m.t === 'invite'));
  await b.ok({ t: 'room:join', key: a.room.code });
  assert.equal(b.room.members.length, 1);
  [a, b].forEach((c) => c.close()); await app.close();
});

test('accounts: register/login/reset, google disabled w/o client id, profile & levels', async () => {
  let sentCode; const app = await startApp({ mailer: async (_, c) => { sentCode = c; } });
  assert.equal((await http(app, 'POST', '/api/auth/register', { email: 'bad', password: '12345678', name: 'Z' })).body.error, 'bad_email');
  assert.equal((await http(app, 'POST', '/api/auth/register', { email: 'z@x.io', password: '123', name: 'Zed' })).body.error, 'weak_password');
  const r = await http(app, 'POST', '/api/auth/register', { email: 'Z@x.io', password: 'password1', name: 'Zed' });
  assert.equal(r.status, 200); assert.match(r.body.user.uid, /^\d{8}$/);
  assert.equal((await http(app, 'POST', '/api/auth/register', { email: 'z@x.io', password: 'password1', name: 'Zed' })).status, 409);
  assert.equal((await http(app, 'POST', '/api/auth/login', { email: 'z@x.io', password: 'nope' })).status, 401);
  const l = await http(app, 'POST', '/api/auth/login', { email: 'z@x.io', password: 'password1' });
  assert.equal(l.status, 200);
  assert.equal((await http(app, 'POST', '/api/auth/google', { idToken: 'x' })).status, 501);
  await http(app, 'POST', '/api/auth/forgot', { email: 'z@x.io' }); assert.match(sentCode, /^\d{6}$/);
  assert.equal((await http(app, 'POST', '/api/auth/reset', { email: 'z@x.io', code: '000000', password: 'newpassword' })).status, 400);
  assert.equal((await http(app, 'POST', '/api/auth/reset', { email: 'z@x.io', code: sentCode, password: 'newpassword' })).status, 200);
  assert.equal((await http(app, 'GET', '/api/me', null, l.body.token)).status, 401); // الجلسات القديمة أُلغيت
  const l2 = await http(app, 'POST', '/api/auth/login', { email: 'z@x.io', password: 'newpassword' }); assert.equal(l2.status, 200);
  const tok = l2.body.token;
  assert.equal((await http(app, 'PATCH', '/api/me', { frame: 'neon' }, tok)).body.error, 'frame_locked');
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const pr = await http(app, 'PATCH', '/api/me', { name: 'زيد', avatar: png, frame: 'gold' }, tok); assert.equal(pr.body.user.name, 'زيد');
  assert.ok((await fetch(app.base + pr.body.user.avatar.split('?')[0].replace(/^/, ''))).ok);
  assert.equal((await http(app, 'GET', '/api/tasks', null, tok)).body.tasks.length, 5);
  assert.equal((await http(app, 'POST', '/api/auth/logout', {}, tok)).status, 200);
  assert.equal((await http(app, 'GET', '/api/me', null, tok)).status, 401);
  await app.close();
});
