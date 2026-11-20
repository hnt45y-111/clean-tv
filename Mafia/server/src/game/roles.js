// الأدوار وإعدادات المباراة — منطق خالص بلا أي اعتماد على الشبكة أو الواجهة.
export const ROLES = {
  mafia:     { id: 'mafia',     team: 'mafia', color: '#D9233C' },
  doctor:    { id: 'doctor',    team: 'town',  color: '#21A875' },
  detective: { id: 'detective', team: 'town',  color: '#2478E8' },
  sniper:    { id: 'sniper',    team: 'town',  color: '#A45BE7' },
  citizen:   { id: 'citizen',   team: 'town',  color: '#E8AE42' },
};

export const LIMITS = { minPlayers: 4, maxPlayers: 20, maxRounds: 10 };

export const DEFAULT_SETTINGS = {
  players: 8,
  mafia: 2,
  doctor: true,
  detective: true,
  sniper: true,
  talkSeconds: 120,
  voteSeconds: 60,
  nightSeconds: 45,
  rounds: 1,
  visibility: 'private',     // public | private
  narratorMute: true,        // يسمح للراوي بإسكات لاعب
  muteDead: true,            // إسكات المستبعدين تلقائياً
  muteNight: true,           // إسكات الجميع أثناء الليل
  revealRoleOnDeath: true,   // كشف دور المستبعد
};

const int = (v, d) => (Number.isFinite(+v) ? Math.trunc(+v) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : v === undefined ? d : !!v);

/** يطبّع الإعدادات ويتحقق منها. يعيد { ok, errors[], settings } */
export function validateSettings(input = {}) {
  const s = { ...DEFAULT_SETTINGS, ...input };
  const out = {
    players: int(s.players, 8), mafia: int(s.mafia, 2),
    doctor: bool(s.doctor, true), detective: bool(s.detective, true), sniper: bool(s.sniper, true),
    talkSeconds: int(s.talkSeconds, 120), voteSeconds: int(s.voteSeconds, 60), nightSeconds: int(s.nightSeconds, 45),
    rounds: int(s.rounds, 1),
    visibility: s.visibility === 'public' ? 'public' : 'private',
    narratorMute: bool(s.narratorMute, true), muteDead: bool(s.muteDead, true),
    muteNight: bool(s.muteNight, true), revealRoleOnDeath: bool(s.revealRoleOnDeath, true),
  };
  const errors = [];
  if (out.players < LIMITS.minPlayers || out.players > LIMITS.maxPlayers) errors.push('players_range');
  if (out.mafia < 1) errors.push('mafia_min');
  if (out.mafia * 2 >= out.players) errors.push('mafia_too_many');
  const specials = out.mafia + +out.doctor + +out.detective + +out.sniper;
  if (specials > out.players) errors.push('roles_exceed_players');
  if (out.talkSeconds < 15 || out.talkSeconds > 600) errors.push('talk_range');
  if (out.voteSeconds < 10 || out.voteSeconds > 300) errors.push('vote_range');
  if (out.nightSeconds < 10 || out.nightSeconds > 300) errors.push('night_range');
  if (out.rounds < 1 || out.rounds > LIMITS.maxRounds) errors.push('rounds_range');
  return { ok: errors.length === 0, errors, settings: out };
}

/** أكبر عدد مافيا مسموح لعدد لاعبين معيّن */
export const maxMafia = (players) => Math.max(1, Math.floor((players - 1) / 2));

/** عدد المافيا المقترح تلقائياً (≈ ثلث اللاعبين) */
export const suggestMafia = (players) => Math.min(maxMafia(players), Math.max(1, Math.round(players / 4)));

/** قائمة الأدوار للعدد الفعلي من اللاعبين؛ المواطنون يملؤون الباقي. */
export function buildRoleList(settings, playerCount = settings.players) {
  const list = Array(settings.mafia).fill('mafia');
  if (settings.doctor) list.push('doctor');
  if (settings.detective) list.push('detective');
  if (settings.sniper) list.push('sniper');
  if (list.length > playerCount) throw new Error('roles_exceed_players');
  while (list.length < playerCount) list.push('citizen');
  return list;
}

/** Fisher–Yates بمولّد عشوائي قابل للحقن (للاختبار) */
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
