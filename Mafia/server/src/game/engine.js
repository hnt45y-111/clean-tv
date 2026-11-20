// آلة حالات المباراة. لا شبكة ولا واجهة: حالة JSON قابلة للحفظ والاسترجاع.
// المراحل: roles → night → dawn → day → vote → voteResult → night … → ended
import { ROLES, buildRoleList, shuffle } from './roles.js';

export class GameError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (c) => { throw new GameError(c); };

export class Match {
  constructor(state) { this.s = state; }

  static create({ players, settings, rng = Math.random, now = Date.now() }) {
    const roles = shuffle(buildRoleList(settings, players.length), rng);
    const s = {
      v: 1, settings, startedAt: now, phase: 'roles', day: 0, nights: 0,
      players: players.map((p, i) => ({
        id: p.id, name: p.name, role: roles[i], alive: true, manualMute: false, seen: false,
        stats: { voted: false, saved: 0, sniperHit: false, caught: 0, diedBy: null },
      })),
      night: null, vote: null, speaker: null, timer: null,
      lastNight: null, lastVote: null, sniperUsed: false, lastSaved: null,
      winner: null, endReason: null, log: [], priv: {}, // priv[playerId] = [{type,…}]
    };
    return new Match(s);
  }
  static restore(json) { return new Match(typeof json === 'string' ? JSON.parse(json) : json); }
  toJSON() { return this.s; }

  // ---------- أدوات ----------
  p(id) { return this.s.players.find((x) => x.id === id); }
  alive() { return this.s.players.filter((x) => x.alive); }
  aliveRole(r) { return this.alive().filter((x) => x.role === r); }
  get phase() { return this.s.phase; }
  log(type, data = {}) { this.s.log.push({ type, day: this.s.day, t: Date.now(), ...data }); }
  need(...phases) { if (!phases.includes(this.s.phase)) fail('bad_phase'); }
  isMuted(id) {
    const x = this.p(id); if (!x) return false;
    const st = this.s.settings;
    return (st.narratorMute && x.manualMute) || (st.muteDead && !x.alive) || (st.muteNight && this.s.phase === 'night');
  }

  // ---------- المؤقت ----------
  startTimer(seconds, now = Date.now()) {
    this.s.timer = { total: seconds * 1000, endsAt: now + seconds * 1000, paused: false, remaining: seconds * 1000 };
  }
  timerPause(now = Date.now()) {
    const t = this.s.timer; if (!t || t.paused) return;
    t.remaining = Math.max(0, t.endsAt - now); t.paused = true;
  }
  timerResume(now = Date.now()) {
    const t = this.s.timer; if (!t || !t.paused) return;
    t.endsAt = now + t.remaining; t.paused = false;
  }
  timerReset(seconds, now = Date.now()) { this.startTimer(seconds ?? (this.s.timer?.total / 1000), now); }
  timerLeft(now = Date.now()) {
    const t = this.s.timer; if (!t) return 0;
    return t.paused ? t.remaining : Math.max(0, t.endsAt - now);
  }

  // ---------- الأدوار ----------
  ackRole(id) { this.need('roles'); const x = this.p(id) || fail('no_player'); x.seen = true; }

  // ---------- الليل ----------
  beginNight(now = Date.now()) {
    this.need('roles', 'voteResult', 'day', 'vote');
    this.s.nights += 1; this.s.phase = 'night'; this.s.speaker = null; this.s.vote = null;
    this.s.night = { kill: {}, save: null, investigate: null, shoot: undefined, done: {} };
    this.startTimer(this.s.settings.nightSeconds, now);
    this.log('night', { n: this.s.nights });
  }

  /** الأفعال المطلوبة هذه الليلة: لاعبون أحياء لم يرسلوا بعد */
  pendingNight() {
    const n = this.s.night; if (!n) return [];
    const need = [...this.aliveRole('mafia'), ...this.aliveRole('doctor'), ...this.aliveRole('detective')];
    if (!this.s.sniperUsed) need.push(...this.aliveRole('sniper'));
    return need.filter((x) => !n.done[x.id]).map((x) => x.id);
  }
  nightComplete() { return this.s.phase === 'night' && this.pendingNight().length === 0; }

  nightAction(id, { kind, target = null }) {
    this.need('night');
    const x = this.p(id) || fail('no_player');
    if (!x.alive) fail('dead');
    const n = this.s.night;
    if (n.done[id]) fail('already_acted');
    const tgt = target ? (this.p(target) || fail('bad_target')) : null;
    if (tgt && !tgt.alive) fail('bad_target');
    switch (kind) {
      case 'kill':
        if (x.role !== 'mafia') fail('forbidden');
        if (!tgt || tgt.role === 'mafia') fail('bad_target');
        n.kill[id] = target; break;
      case 'save':
        if (x.role !== 'doctor') fail('forbidden');
        if (!tgt) fail('bad_target');
        if (this.s.lastSaved === target) fail('same_save');
        n.save = target; break;
      case 'investigate':
        if (x.role !== 'detective') fail('forbidden');
        if (!tgt || tgt.id === id) fail('bad_target');
        n.investigate = target;
        (this.s.priv[id] ||= []).push({ type: 'investigation', night: this.s.nights, target, isMafia: tgt.role === 'mafia' });
        if (tgt.role === 'mafia') x.stats.caught += 1;
        break;
      case 'shoot':
        if (x.role !== 'sniper' || this.s.sniperUsed) fail('forbidden');
        if (tgt && tgt.id === id) fail('bad_target');
        n.shoot = target; break; // null = تمرير (لا تُستهلك الطلقة)
      default: fail('bad_kind');
    }
    n.done[id] = kind;
    return { pending: this.pendingNight().length };
  }

  resolveNight(rng = Math.random) {
    this.need('night');
    const n = this.s.night; const deaths = [];
    // هدف المافيا: الأعلى أصواتاً، وعند التعادل يُختار عشوائياً بين المتعادلين
    const counts = {};
    Object.values(n.kill).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
    let killTarget = null;
    const top = Math.max(0, ...Object.values(counts));
    if (top > 0) { const tied = Object.keys(counts).filter((k) => counts[k] === top); killTarget = tied[Math.floor(rng() * tied.length)]; }
    let saved = false;
    if (killTarget) {
      if (n.save === killTarget) { saved = true; const d = this.aliveRole('doctor')[0]; if (d) d.stats.saved += 1; }
      else deaths.push({ id: killTarget, cause: 'mafia' });
    }
    // القناص: إصابة مافيا تقتله؛ إصابة غيره تقتل القناص نفسه (الهدف ينجو)
    const sn = this.aliveRole('sniper')[0];
    if (sn && n.shoot) {
      this.s.sniperUsed = true;
      const t = this.p(n.shoot);
      if (t.role === 'mafia') { sn.stats.sniperHit = true; if (!deaths.some((d) => d.id === t.id)) deaths.push({ id: t.id, cause: 'sniper' }); }
      else if (!deaths.some((d) => d.id === sn.id)) deaths.push({ id: sn.id, cause: 'sniper_miss' });
    }
    this.s.lastSaved = n.save || null;
    deaths.forEach((d) => this.kill(d.id, d.cause));
    this.s.lastNight = { n: this.s.nights, deaths, saved };
    this.s.phase = 'dawn'; this.s.timer = null;
    this.log('dawn', { deaths, saved });
    this.checkWin();
    return this.s.lastNight;
  }

  kill(id, cause) {
    const x = this.p(id); if (!x || !x.alive) return;
    x.alive = false; x.stats.diedBy = cause; x.manualMute = false;
    if (this.s.speaker === id) this.s.speaker = null;
  }

  // ---------- النهار ----------
  beginDay() { this.need('dawn'); this.s.phase = 'day'; this.s.day += 1; this.s.timer = null; this.s.speaker = null; this.log('day'); }

  setSpeaker(id, seconds, now = Date.now()) {
    this.need('day');
    const x = this.p(id) || fail('no_player');
    if (!x.alive) fail('dead');
    this.s.speaker = id;
    this.startTimer(seconds || this.s.settings.talkSeconds, now);
    this.log('speaker', { id });
  }
  /** المتحدث التالي بحسب ترتيب الجلوس بين الأحياء */
  nextSpeakerId() {
    const al = this.alive(); if (!al.length) return null;
    const i = al.findIndex((x) => x.id === this.s.speaker);
    return al[(i + 1) % al.length].id;
  }
  clearSpeaker() { this.s.speaker = null; this.s.timer = null; }

  setMute(id, muted) {
    if (!this.s.settings.narratorMute) fail('mute_disabled');
    const x = this.p(id) || fail('no_player');
    if (!x.alive) fail('dead');
    x.manualMute = !!muted;
  }

  // ---------- التصويت ----------
  beginVote(now = Date.now()) {
    this.need('day');
    this.s.phase = 'vote'; this.s.speaker = null;
    this.s.vote = { votes: {} };
    this.startTimer(this.s.settings.voteSeconds, now);
    this.log('vote_start');
  }
  /** target = معرّف لاعب أو null للامتناع */
  castVote(id, target) {
    this.need('vote');
    const x = this.p(id) || fail('no_player');
    if (!x.alive) fail('dead');
    const v = this.s.vote;
    if (id in v.votes) fail('already_voted');
    if (target !== null) {
      const t = this.p(target) || fail('bad_target');
      if (!t.alive || target === id) fail('bad_target');
    }
    v.votes[id] = target; x.stats.voted = true;
    return { pending: this.alive().length - Object.keys(v.votes).length };
  }
  voteComplete() { return this.s.phase === 'vote' && this.alive().every((x) => x.id in this.s.vote.votes); }

  closeVote() {
    this.need('vote');
    const { votes } = this.s.vote; const tally = {};
    let abstain = 0;
    Object.values(votes).forEach((t) => { if (t === null) abstain++; else tally[t] = (tally[t] || 0) + 1; });
    const top = Math.max(0, ...Object.values(tally));
    const leaders = Object.keys(tally).filter((k) => tally[k] === top);
    // يُستبعد صاحب الأعلى أصواتاً فقط إن كان وحيداً وتفوّق على أصوات الامتناع
    const eliminated = top > 0 && leaders.length === 1 && top > abstain ? leaders[0] : null;
    this.s.lastVote = { day: this.s.day, votes: { ...votes }, tally, abstain, eliminated, tie: top > 0 && leaders.length > 1 };
    if (eliminated) this.kill(eliminated, 'vote');
    this.s.phase = 'voteResult'; this.s.timer = null;
    this.log('vote_result', { eliminated });
    this.checkWin();
    return this.s.lastVote;
  }

  // ---------- استبعاد وإنهاء ----------
  eliminate(id) {
    if (this.s.phase === 'ended' || this.s.phase === 'roles') fail('bad_phase');
    const x = this.p(id) || fail('no_player');
    if (!x.alive) fail('dead');
    this.kill(id, 'narrator'); this.log('eliminate', { id });
    this.checkWin();
  }
  /** انسحاب لاعب أثناء المباراة: يُعامَل كاستبعاد */
  playerLeft(id) { const x = this.p(id); if (x && x.alive && this.s.phase !== 'ended') { this.kill(id, 'left'); this.checkWin(); } }

  checkWin() {
    if (this.s.phase === 'ended') return this.s.winner;
    const m = this.aliveRole('mafia').length; const o = this.alive().length - m;
    let w = null;
    if (m === 0) w = 'town'; else if (m >= o) w = 'mafia';
    if (w) { this.s.winner = w; this.s.endReason = 'rules'; this.s.phase = 'ended'; this.s.timer = null; this.s.speaker = null; this.log('end', { winner: w }); }
    return w;
  }
  /** إنهاء يدوي من الراوي: لا فائز ⇒ مباراة ملغاة لا تُحتسب نقاطها */
  endMatch() { if (this.s.phase === 'ended') return; this.s.winner = null; this.s.endReason = 'cancelled'; this.s.phase = 'ended'; this.s.timer = null; this.log('end', { winner: null }); }

  results() {
    return this.s.players.map((x) => ({
      id: x.id, role: x.role, team: ROLES[x.role].team, survived: x.alive,
      won: this.s.winner ? ROLES[x.role].team === this.s.winner : false,
      stats: x.stats,
    }));
  }

  // ---------- العرض (حماية الأسرار) ----------
  /** viewer: معرّف لاعب أو 'narrator' */
  view(viewer, now = Date.now()) {
    const s = this.s; const isN = viewer === 'narrator';
    const me = isN ? null : this.p(viewer);
    const ended = s.phase === 'ended';
    const showRole = (x) => isN || ended || x.id === viewer || (!x.alive && s.settings.revealRoleOnDeath)
      || (me?.role === 'mafia' && x.role === 'mafia');
    const v = {
      phase: s.phase, day: s.day, nights: s.nights, speaker: s.speaker,
      timer: s.timer ? { total: s.timer.total, left: this.timerLeft(now), paused: s.timer.paused, endsAt: s.timer.paused ? null : s.timer.endsAt } : null,
      players: s.players.map((x) => ({
        id: x.id, name: x.name, alive: x.alive, muted: this.isMuted(x.id),
        role: showRole(x) ? x.role : null, seen: isN ? x.seen : undefined,
      })),
      lastNight: s.phase === 'dawn' || s.phase === 'day' ? { deaths: s.lastNight?.deaths.map((d) => ({ id: d.id })) || [] } : null,
      lastVote: ['voteResult', 'ended'].includes(s.phase) || s.phase === 'night' || s.phase === 'day' ? pubVote(s.lastVote) : null,
      winner: s.winner, endReason: s.endReason,
      sniperUsed: isN ? s.sniperUsed : undefined,
    };
    if (isN) {
      v.narrator = {
        night: s.night && s.phase === 'night' ? { kill: s.night.kill, save: s.night.save, investigate: s.night.investigate, shoot: s.night.shoot, done: s.night.done, pending: this.pendingNight() } : null,
        liveVotes: s.phase === 'vote' ? s.vote.votes : null,
        lastNight: s.lastNight, log: s.log.slice(-40),
      };
    } else if (me) {
      v.me = { id: me.id, role: me.role, alive: me.alive, team: ROLES[me.role].team };
      if (me.role === 'mafia') v.me.mates = s.players.filter((x) => x.role === 'mafia' && x.id !== me.id).map((x) => x.id);
      v.me.priv = s.priv[me.id] || [];
      if (s.phase === 'night' && me.alive) {
        v.me.acted = !!s.night.done[me.id];
        if (me.role === 'mafia') v.me.mafiaVotes = s.night.kill; // المافيا ترى اختيارات بعضها
        if (me.role === 'sniper') v.me.sniperUsed = s.sniperUsed;
        if (me.role === 'doctor') v.me.cannotSave = s.lastSaved;
      }
      if (s.phase === 'vote') v.me.voted = me.id in s.vote.votes;
      if (s.phase === 'vote') v.voteProgress = { done: Object.keys(s.vote.votes).length, total: this.alive().length };
    }
    return v;
  }
}

function pubVote(lv) {
  if (!lv) return null;
  // أصوات الأفراد علنية عند إعلان النتيجة (كما في اللعب الحضوري)
  return { day: lv.day, tally: lv.tally, abstain: lv.abstain, eliminated: lv.eliminated, tie: lv.tie, votes: lv.votes };
}
