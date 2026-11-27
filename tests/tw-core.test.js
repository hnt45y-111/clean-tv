// Logic tests for «تواصل» (CleanTV/app/src/main/assets/tw-core.js): run with `node --test tests/`
// The relay is replaced by an in-memory fake, so nothing touches the network. TW_E2E=1 runs the same flow against the real function (not in CI).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SRC = path.join(__dirname, '../CleanTV/app/src/main/assets/tw-core.js');
function fresh() { delete require.cache[require.resolve(SRC)]; const TW = require(SRC); const mem = {}; TW.store = { get: k => mem[k] || null, set: (k, v) => { mem[k] = v; } }; TW.ls = {}; return TW; }

// a tiny stand-in for the edge function
function fakeServer() {
  const devs = {}, msgs = []; let n = 0;
  const http = (route, b, ms, cb) => setImmediate(() => {
    const ok = d => cb(null, d), no = (error, status = 400) => cb({ error, status }, { error });
    if (route === 'register') { const d = devs[b.code]; if (d && d.token !== b.token) return no('code_taken', 409); devs[b.code] = { token: b.token, name: b.name, kind: b.kind }; return ok({ ok: true }); }
    const me = devs[b.code]; if (!me || me.token !== b.token) return no('unauthorized', 401);
    if (route === 'lookup') { const o = devs[b.other]; return o ? ok({ ok: true, user: { code: b.other, name: o.name, kind: o.kind } }) : no('no_such_user', 404); }
    if (route === 'send') { if (!devs[b.to]) return no('no_such_user', 404); const id = 'm' + (++n); const ts = new Date(Date.now() + n).toISOString(); msgs.push({ id, from: b.code, fromName: me.name, to: b.to, kind: b.kind, text: b.text || '', name: b.name || '', mime: b.mime || '', size: b.size || 0, url: b.path ? 'https://x/' + b.path : '', ts }); return ok({ ok: true, id, ts }); }
    if (route === 'upload') return ok({ ok: true, path: b.code + '/f' + (++n), url: 'https://up/' + n, token: 't' });
    if (route === 'inbox') return ok({ ok: true, msgs: msgs.filter(m => m.to === b.code && (!b.since || Date.parse(m.ts) > Date.parse(b.since))), now: new Date().toISOString() });
    return no('not_found', 404);
  });
  return { http, devs, msgs };
}

test('codes are 10 symbols the server accepts, and clean up what people type', () => {
  const TW = fresh();
  for (let i = 0; i < 200; i++) assert.ok(TW.validCode(TW.newCode()));
  assert.strictEqual(TW.fmtCode('ABCDEFGHJK'), 'ABCDE-FGHJK');
  assert.strictEqual(TW.cleanCode(' abcde-fghjk '), 'ABCDEFGHJK');
  assert.ok(!TW.validCode('ABCDEFGHIK'), 'I is not in the alphabet');
});

test('two devices: add by code, send both ways, nothing is shown twice', async () => {
  const srv = fakeServer();
  const A = fresh(), B = fresh(); A.http = B.http = srv.http; A.load(); B.load();
  await new Promise(r => A.init('phone', 'علي', r)); await new Promise(r => B.init('tv', 'الصالة', r));
  assert.ok(A.S.registered && B.S.registered);
  // A adds the TV by its code (the code as people type it: lower case, with a dash)
  const c = await new Promise(r => A.addContact(A.fmtCode(B.S.code).toLowerCase(), (e, x) => r(e || x)));
  assert.strictEqual(c.code, B.S.code); assert.strictEqual(c.name, 'الصالة');
  assert.strictEqual((await new Promise(r => A.addContact(A.S.code, e => r(e)))).error, 'self');
  assert.strictEqual((await new Promise(r => A.addContact('ZZZZZZZZZZ', e => r(e)))).error, 'no_such_user');
  await new Promise(r => A.sendText(B.S.code, 'السلام عليكم', r));
  assert.strictEqual(A.convo(B.S.code)[0].st, 'sent');
  // the TV never added the phone: the first message adds it
  let heard = 0; B.on('msg', () => heard++);
  await new Promise(r => B.pollOnce(0, r)); await new Promise(r => B.pollOnce(0, r));
  assert.strictEqual(heard, 1, 'second poll must not repeat it');
  assert.strictEqual(B.S.unread[A.S.code], 1);
  assert.strictEqual(B.contactName(A.S.code), 'علي');
  B.markRead(A.S.code); assert.strictEqual(B.unreadTotal(), 0);
  await new Promise(r => B.sendText(A.S.code, 'وعليكم السلام', r));
  await new Promise(r => A.pollOnce(0, r));
  assert.strictEqual(A.convo(B.S.code).length, 2);
});

test('files go through upload then send, and a failure is kept as failed', async () => {
  const srv = fakeServer();
  const A = fresh(), B = fresh(); A.http = B.http = srv.http; A.load(); B.load();
  await new Promise(r => A.init('phone', 'a', r)); await new Promise(r => B.init('tv', 'b', r));
  A.putFile = (url, blob, cb) => cb(null);
  await new Promise(r => A.sendFile(B.S.code, { size: 1000 }, 'image', 'p.jpg', 'image/jpeg', 'blob:x', r));
  assert.strictEqual(A.convo(B.S.code)[0].st, 'sent');
  assert.strictEqual(srv.msgs[0].kind, 'image');
  A.putFile = (url, blob, cb) => cb({ error: 'network' });
  const e = await new Promise(r => A.sendFile(B.S.code, { size: 10 }, 'audio', 'v.m4a', 'audio/mp4', '', r));
  assert.strictEqual(e.error, 'network'); assert.strictEqual(A.convo(B.S.code).find(m => m.kind === 'audio').st, 'failed');
  assert.strictEqual((await new Promise(r => A.sendFile(B.S.code, { size: 99e6 }, 'file', 'big', '', '', r))).error, 'too_big');
});

test('messages older than 24 hours are dropped, contacts stay', () => {
  const TW = fresh(); TW.load();
  TW.S.contacts.push({ code: 'ABCDEFGHJK', name: 'x' });
  TW.S.msgs.ABCDEFGHJK = [{ id: '1', ts: new Date(Date.now() - 25 * 3600e3).toISOString() }, { id: '2', ts: new Date(Date.now() - 23 * 3600e3).toISOString() }];
  assert.strictEqual(TW.purgeLocal(true), 1);
  assert.deepStrictEqual(TW.S.msgs.ABCDEFGHJK.map(m => m.id), ['2']);
  assert.strictEqual(TW.S.contacts.length, 1);
});

test('a code that is already taken is replaced before anything was shared', async () => {
  const srv = fakeServer(); const A = fresh(); A.http = srv.http; A.load();
  const first = A.newCode(); let calls = 0; const orig = A.newCode; A.newCode = () => (calls++ === 0 ? first : orig());
  srv.devs[first] = { token: 'someone-elses-token-0123456789', name: '', kind: 'phone' };
  await new Promise(r => A.init('phone', 'a', r));
  assert.notStrictEqual(A.S.code, first); assert.ok(A.S.registered);
});

test('E2E against the real function (TW_E2E=1)', { skip: !process.env.TW_E2E }, async () => {
  const A = fresh(), B = fresh();
  const http = (route, body, ms, cb) => fetch(A.BASE + '/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => { const j = await r.json().catch(() => ({})); r.ok ? cb(null, j) : cb({ status: r.status, error: j.error }, j); }, e => cb({ error: 'network', detail: String(e) }));
  A.http = B.http = http;
  A.putFile = B.putFile = (url, blob, cb) => { const f = new FormData(); f.append('cacheControl', '3600'); f.append('', blob); fetch(url, { method: 'PUT', body: f }).then(r => r.ok ? cb(null) : r.text().then(t => cb({ error: 'upload_' + r.status + t }))); };
  A.load(); B.load();
  await new Promise(r => A.init('phone', 'اختبار-أ', r)); await new Promise(r => B.init('tv', 'اختبار-ب', r));
  try {
    assert.ok(A.S.registered && B.S.registered);
    await new Promise((res, rej) => A.addContact(B.S.code, (e) => e ? rej(new Error(JSON.stringify(e))) : res()));
    await new Promise((res, rej) => A.sendText(B.S.code, 'مرحبا من الاختبار', e => e ? rej(new Error(JSON.stringify(e))) : res()));
    const blob = new Blob([new Uint8Array(5000).fill(7)], { type: 'application/octet-stream' });
    await new Promise((res, rej) => A.sendFile(B.S.code, blob, 'file', 'test.bin', 'application/octet-stream', '', e => e ? rej(new Error(JSON.stringify(e))) : res()));
    const got = await new Promise((res, rej) => B.pollOnce(5, (e, g) => e ? rej(new Error(JSON.stringify(e))) : res(g)));
    assert.strictEqual(got.length, 2);
    const file = got.map(g => g.msg).find(m => m.kind === 'file');
    assert.ok(file.url, 'signed download link');
    const dl = await fetch(file.url); assert.strictEqual((await dl.arrayBuffer()).byteLength, 5000);
    const w = await new Promise(r => { const t0 = Date.now(); A.pollOnce(2, () => r(Date.now() - t0)); });
    assert.ok(w >= 1500, 'an empty long poll waits');
  } finally {
    await new Promise(r => A.leave(r)); await new Promise(r => B.leave(r));
  }
});
