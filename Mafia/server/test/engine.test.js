import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, GameError } from '../src/game/engine.js';
import { validateSettings, buildRoleList } from '../src/game/roles.js';

const mk = (n = 8, over = {}) => {
  const { settings } = validateSettings({ players: n, mafia: 2, ...over });
  return Match.create({ players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i })), settings });
};
const byRole = (m, r) => m.s.players.filter((x) => x.role === r);
const throwsCode = (fn, code) => assert.throws(fn, (e) => e instanceof GameError && e.code === code);

test('settings validation', () => {
  assert.equal(validateSettings({ players: 3 }).ok, false);
  assert.equal(validateSettings({ players: 8, mafia: 4 }).errors.includes('mafia_too_many'), true);
  assert.equal(validateSettings({ players: 8, mafia: 2 }).ok, true);
  assert.equal(validateSettings({ players: 8, mafia: 2, talkSeconds: 5 }).ok, false);
});

test('role distribution counts and randomness', () => {
  const { settings } = validateSettings({ players: 10, mafia: 3 });
  const l = buildRoleList(settings);
  assert.equal(l.length, 10);
  assert.equal(l.filter((r) => r === 'mafia').length, 3);
  assert.equal(l.filter((r) => r === 'citizen').length, 4);
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add(mk(10, { mafia: 3 }).s.players.map((x) => x.role).join());
  assert.ok(seen.size > 1);
});

test('night: mafia kill, doctor save blocks it', () => {
  const m = mk(); m.beginNight();
  const [mf1, mf2] = byRole(m, 'mafia'); const doc = byRole(m, 'doctor')[0];
  const victim = byRole(m, 'citizen')[0];
  m.nightAction(mf1.id, { kind: 'kill', target: victim.id });
  m.nightAction(mf2.id, { kind: 'kill', target: victim.id });
  m.nightAction(doc.id, { kind: 'save', target: victim.id });
  m.nightAction(byRole(m, 'detective')[0].id, { kind: 'investigate', target: mf1.id });
  m.nightAction(byRole(m, 'sniper')[0].id, { kind: 'shoot', target: null });
  assert.equal(m.nightComplete(), true);
  const r = m.resolveNight();
  assert.equal(r.deaths.length, 0); assert.equal(r.saved, true);
  assert.equal(m.p(victim.id).alive, true);
  assert.equal(m.phase, 'dawn');
});

test('night: actions only once, only by right role, privacy of investigation', () => {
  const m = mk(); m.beginNight();
  const mf = byRole(m, 'mafia')[0]; const cit = byRole(m, 'citizen')[0]; const det = byRole(m, 'detective')[0];
  m.nightAction(mf.id, { kind: 'kill', target: cit.id });
  throwsCode(() => m.nightAction(mf.id, { kind: 'kill', target: cit.id }), 'already_acted');
  throwsCode(() => m.nightAction(cit.id, { kind: 'kill', target: mf.id }), 'forbidden');
  throwsCode(() => m.nightAction(byRole(m, 'mafia')[1].id, { kind: 'kill', target: mf.id }), 'bad_target');
  m.nightAction(det.id, { kind: 'investigate', target: mf.id });
  assert.deepEqual(m.view(det.id).me.priv[0], { type: 'investigation', night: 1, target: mf.id, isMafia: true });
  assert.equal(m.view(cit.id).me.priv.length, 0);
});

test('sniper: hit mafia kills it; miss kills the sniper; single shot', () => {
  let m = mk(); m.beginNight();
  const sn = byRole(m, 'sniper')[0]; const mf = byRole(m, 'mafia')[0];
  m.nightAction(sn.id, { kind: 'shoot', target: mf.id });
  const r = m.resolveNight();
  assert.deepEqual(r.deaths.map((d) => d.cause), ['sniper']);
  assert.equal(m.p(mf.id).alive, false); assert.equal(m.s.sniperUsed, true);

  m = mk(); m.beginNight();
  const sn2 = byRole(m, 'sniper')[0]; const cit = byRole(m, 'citizen')[0];
  m.nightAction(sn2.id, { kind: 'shoot', target: cit.id });
  m.resolveNight();
  assert.equal(m.p(cit.id).alive, true); assert.equal(m.p(sn2.id).alive, false);
});

test('doctor cannot save same player twice in a row', () => {
  const m = mk(); const doc = byRole(m, 'doctor')[0]; const t = byRole(m, 'citizen')[0];
  m.beginNight(); m.nightAction(doc.id, { kind: 'save', target: t.id }); m.resolveNight(); m.beginDay();
  m.beginVote(); m.closeVote(); m.beginNight();
  throwsCode(() => m.nightAction(doc.id, { kind: 'save', target: t.id }), 'same_save');
});

test('vote: once only, plurality eliminates, tie = nobody', () => {
  const m = mk(6, { mafia: 1 }); m.beginNight(); m.resolveNight(); m.beginDay(); m.beginVote();
  const ids = m.s.players.map((x) => x.id);
  m.castVote(ids[0], ids[5]);
  throwsCode(() => m.castVote(ids[0], ids[4]), 'already_voted');
  throwsCode(() => m.castVote(ids[1], ids[1]), 'bad_target');
  m.castVote(ids[1], ids[5]); m.castVote(ids[2], ids[4]);
  m.castVote(ids[3], ids[5]); m.castVote(ids[4], null);
  assert.equal(m.voteComplete(), false);
  m.castVote(ids[5], null);
  assert.equal(m.voteComplete(), true);
  const r = m.closeVote();
  assert.equal(r.eliminated, ids[5]); assert.equal(r.abstain, 2);

  const m2 = mk(6, { mafia: 1 }); m2.beginNight(); m2.resolveNight(); m2.beginDay(); m2.beginVote();
  const i2 = m2.s.players.map((x) => x.id);
  m2.castVote(i2[0], i2[3]); m2.castVote(i2[1], i2[4]);
  const r2 = m2.closeVote();
  assert.equal(r2.eliminated, null); assert.equal(r2.tie, true);
});

test('win conditions', () => {
  const m = mk(6, { mafia: 1, doctor: false, detective: false, sniper: false });
  m.beginNight(); m.resolveNight(); m.beginDay();
  m.eliminate(byRole(m, 'mafia')[0].id);
  assert.equal(m.phase, 'ended'); assert.equal(m.s.winner, 'town');

  const m2 = mk(5, { mafia: 2, doctor: false, detective: false, sniper: false });
  m2.beginNight(); m2.resolveNight(); m2.beginDay();
  const cits = byRole(m2, 'citizen'); m2.eliminate(cits[0].id);
  assert.equal(m2.s.winner, 'mafia'); // 2 مافيا مقابل 2 مواطنين = فوز المافيا
  assert.equal(m2.phase, 'ended');
});

test('views never leak other roles to players', () => {
  const m = mk(8); const cit = byRole(m, 'citizen')[0]; const mf = byRole(m, 'mafia')[0];
  const v = m.view(cit.id);
  assert.equal(v.players.filter((p) => p.role).length, 1);
  assert.equal(v.players.find((p) => p.role).id, cit.id);
  const vm = m.view(mf.id);
  assert.equal(vm.players.filter((p) => p.role).length, 2); // هو وزميله
  assert.equal(JSON.stringify(v).includes('"mates"'), false);
  assert.equal(m.view('narrator').players.every((p) => p.role), true);
});

test('timer pause/resume and mute rules', () => {
  const m = mk(); m.beginNight(0); m.resolveNight(); m.beginDay();
  m.setSpeaker('p0' in {} ? 'p0' : m.alive()[0].id, 120, 1000);
  assert.equal(m.timerLeft(61000), 60000);
  m.timerPause(61000); assert.equal(m.timerLeft(99999), 60000);
  m.timerResume(100000); assert.equal(m.timerLeft(130000), 30000);
  const id = m.alive()[1].id; m.setMute(id, true); assert.equal(m.isMuted(id), true);
  m.setMute(id, false); assert.equal(m.isMuted(id), false);
});

test('snapshot restore keeps state', () => {
  const m = mk(); m.beginNight();
  const r = Match.restore(JSON.stringify(m));
  assert.equal(r.phase, 'night'); assert.deepEqual(r.s.players.map((p) => p.role), m.s.players.map((p) => p.role));
});
