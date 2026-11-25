import { h, ic, avatar, toast, sheet, confirmBox, fmtTime, raw } from '../dom.js';
import { t } from '../i18n.js';
import { S, notify, serverNow } from '../store.js';
import { send, game } from '../net.js';
import { go, screen, fail, act } from './common.js';
import { roleArt, roleCard, roleAvatar, ROLE_COLOR, ROLE_ICON } from '../art.js';
import { sfx, buzz } from '../fx.js';
import { reportSheet, settingsSheet } from './rooms.js';

const C = 2 * Math.PI * 45;
/** مؤقت دائري: تحدّثه حلقة واحدة في main.js عبر data-* (لا يُعاد إنشاؤه كل ثانية) */
export function timerRing(tm, { size = 150, label } = {}) {
  if (!tm) return null;
  return h('div', { class: 'timer', style: { '--sz': size + 'px' }, 'data-ends': tm.endsAt ?? '', 'data-total': tm.total, 'data-left': tm.left, 'data-paused': tm.paused ? '1' : '' },
    raw(`<svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="45"/><circle class="fg" cx="50" cy="50" r="45" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>`),
    h('div', { class: 't' }, fmtTime(tm.left)), label ? h('div', { class: 'sub' }, label) : null);
}
export function tickTimers() {
  const now = serverNow();
  document.querySelectorAll('.timer[data-total]').forEach((el) => {
    const total = +el.dataset.total; const paused = el.dataset.paused === '1';
    const left = paused || !el.dataset.ends ? +el.dataset.left : Math.max(0, +el.dataset.ends - now);
    const txt = fmtTime(left); const tEl = el.querySelector('.t'); if (tEl.textContent !== txt) tEl.textContent = txt;
    el.querySelector('.fg').style.strokeDashoffset = String(C * (1 - (total ? left / total : 0)));
    const low = left <= 10000 && left > 0 && !paused; el.classList.toggle('low', low);
  });
  document.querySelectorAll('[data-cd]').forEach((el) => { el.textContent = fmtTime(+el.dataset.cd - now); });
}

const memberById = () => new Map((S.room?.members || []).map((m) => [String(m.id), m]));
const roleChip = (r, extra = '') => h('span', { class: 'chip role ' + extra, style: { '--role': ROLE_COLOR[r] } }, ic(ROLE_ICON[r], 'sm'), t('role_' + r));
const pAvatar = (members, p, size = '') => { const m = members.get(p.id); return avatar({ ...(m || {}), name: p.name, ...(m ? { online: m.connected } : {}) }, size); };

function playerRow(p, members, { me, speaker, onPick, selected, showRole, extra, role }) {
  const el = h('div', { class: 'prow' + (p.alive ? '' : ' dead') + (p.id === me ? ' me' : '') + (speaker === p.id ? ' speaking' : '') + (onPick ? ' pick' : '') + (selected ? ' sel' : ''), style: role ? { '--role': ROLE_COLOR[role] } : {}, onclick: onPick ? () => onPick(p) : null },
    pAvatar(members, p), h('div', { class: 'grow' }, h('div', { class: 'nm' }, p.name, p.id === me ? h('span', { class: 'tiny dim' }, ' · ' + t('you')) : null),
      h('div', { class: 'row gap6', style: { gap: '6px', flexWrap: 'wrap' } }, !p.alive ? h('span', { class: 'tiny dim' }, ic('skull', 'sm'), ' ', t('dead')) : null, showRole && p.role ? roleChip(p.role) : null)),
    p.manual ? h('span', { class: 'mic', title: t('muted') }, ic('micoff')) : null, speaker === p.id ? h('span', { style: { color: 'var(--gold)' } }, ic('mic')) : null, extra);
  return el;
}

// ========== واجهة اللاعب ==========
let flipped = null, acked = null, sel = null, selKey = '';
const roundKey = () => `${S.room.code}:${S.room.round}`;
const keyFor = (m) => `${roundKey()}:${m.phase}:${m.nights}:${m.day}`;
const resetSel = (m) => { const k = keyFor(m); if (k !== selKey) { selKey = k; sel = null; } };

function header(R, m, right) {
  return h('div', { class: 'top' }, m.me && m.phase !== 'roles' ? roleChip(m.me.role) : null, h('span', { class: 'chip' }, t('round'), ' ', h('b', { class: 'num' }, `${R.round}/${R.settings.rounds}`)),
    h('span', { class: 'chip' }, ic(m.phase === 'night' ? 'moon' : 'sun', 'sm'), t('phase_' + m.phase)), h('div', { class: 'sp' }), right,
    h('button', { class: 'iconbtn', onclick: leaveMatch, 'aria-label': t('leave_room') }, ic('out')));
}
async function leaveMatch() { const R = S.room; if (await confirmBox(t('leave_room'), t('leave_match_confirm'), t('leave_room'))) send({ t: 'room:leave' }); }

export const play = () => {
  const R = S.room; const m = R.match; const me = m.me; const members = memberById();
  resetSel(m); if (flipped?.round !== roundKey()) flipped = { round: roundKey(), v: false }; if (acked !== roundKey() && m.phase !== 'roles') acked = roundKey();
  document.body.dataset.role = me?.role || '';
  const passive = m.narratorDriven && !['roles', 'ended'].includes(m.phase);
  const body = passive ? () => passiveView(R, m, members) : {
    roles: () => roleReveal(R, m, members), night: () => nightView(R, m, members), dawn: () => dawnView(R, m, members), day: () => dayView(R, m, members),
    vote: () => voteView(R, m, members), voteResult: () => resultView(R, m, members), ended: () => endView(R, m, members, false),
  }[m.phase];
  const bodyEl = body();
  const roleColor = me ? ROLE_COLOR[me.role] : 'var(--silver)';
  return [h('div', { class: 'screen enter-less', style: { '--role': roleColor } }, header(R, m), !me?.alive && m.phase !== 'ended' && m.phase !== 'roles' ? h('div', { class: 'banner red' }, ic('skull', 'sm'), t('you_are_out')) : null,
    me && me.alive && m.players.find((p) => p.id === me.id)?.manual && m.phase !== 'ended' ? h('div', { class: 'banner red' }, ic('micoff', 'sm'), t('you_are_muted')) : null, bodyEl)];
};

// وضع الراوي (أوفلاين): هاتف اللاعب يُظهر الدور عند الضغط فقط، والراوي يدير كل شيء
let peek = false, peekTimer = null;
function passiveView(R, m, members) {
  const me = m.me; const night = m.phase === 'night';
  const mates = (me.mates || []).map((id) => m.players.find((p) => p.id === id)).filter(Boolean);
  const toggle = () => { peek = !peek; clearTimeout(peekTimer); if (peek) { buzz(20); peekTimer = setTimeout(() => { peek = false; notify(); }, 4000); } notify(); };
  const dead = m.phase === 'dawn' ? (m.lastNight?.deaths || []).map((d) => m.players.find((p) => p.id === d.id)).filter(Boolean) : [];
  const out = m.phase === 'voteResult' && m.lastVote?.eliminated ? m.players.find((p) => p.id === m.lastVote.eliminated) : null;
  return h('div', { class: 'col', style: { flex: 1, justifyContent: 'center', gap: '16px' } },
    h('div', { class: 'center' }, h('div', { style: { color: night ? 'var(--purple)' : 'var(--gold)' } }, ic(night ? 'moon' : 'sun', 'lg')),
      h('h2', {}, t('phase_' + m.phase)), h('p', { class: 'dim small' }, t(night ? 'nd_night_hint' : 'nd_day_hint'))),
    dead.length ? h('div', { class: 'card center reveal' }, h('div', { class: 'small dim' }, t('was_killed')), dead.map((p) => h('div', { class: 'bold' }, p.name, p.role ? [' ', roleChip(p.role)] : null))) : null,
    m.phase === 'dawn' && !dead.length ? h('div', { class: 'card center' }, t('quiet_night')) : null,
    out ? h('div', { class: 'card center reveal' }, h('div', { class: 'small dim' }, t('was_eliminated')), h('div', { class: 'bold' }, out.name, out.role ? [' ', roleChip(out.role)] : null)) : null,
    h('button', { class: 'card center', style: { '--role': ROLE_COLOR[me.role], minHeight: '150px' }, onclick: toggle },
      peek ? h('div', { class: 'col', style: { alignItems: 'center', gap: '6px' } }, roleArt(me.role, 'art'), h('h2', { style: { color: ROLE_COLOR[me.role] } }, t('role_' + me.role)),
        mates.length ? h('div', { class: 'small' }, t('your_mates'), ': ', mates.map((p) => p.name).join('، ')) : null)
        : h('div', { class: 'col', style: { alignItems: 'center', gap: '6px' } }, ic('eye', 'lg'), h('b', {}, t('nd_peek')), h('div', { class: 'tiny dim' }, t('nd_peek_hint')))),
    h('p', { class: 'center tiny dim' }, t('nd_offline_ok')));
}

// بطاقة الدور السرية (12 + 13)
function roleReveal(R, m, members) {
  const me = m.me; const f = flipped;
  const mates = (me.mates || []).map((id) => m.players.find((p) => p.id === id)).filter(Boolean);
  const card = h('div', { class: 'flip deal' + (f.v ? ' on instant' : ''), role: 'button', tabindex: 0, onclick: (e) => { if (f.v) return; f.v = true; sfx('flip'); buzz(40); e.currentTarget.classList.add('on'); e.currentTarget.classList.remove('instant'); setTimeout(() => notify(), 900); } },
    h('div', { class: 'in' }, h('div', { class: 'face back' }, h('div', { class: 'dim' }, t('tap_to_reveal'))),
      h('div', { class: 'face front card-face' }, roleCard(me.role), h('span', { class: 'chip role team-chip' }, t('team_' + me.team)))));
  return h('div', { class: 'col', style: { flex: 1, justifyContent: 'center', gap: '16px' } },
    h('div', { class: 'center' }, h('h2', {}, t('your_role')), h('div', { class: 'small dim' }, f.v ? t('keep_secret') : t('dealing_hint'))), card,
    f.v ? h('p', { class: 'center small dim reveal', style: { margin: '0 12px' } }, t('role_desc_' + me.role)) : null,
    f.v && mates.length ? h('div', { class: 'card accent reveal', style: { '--role': ROLE_COLOR.mafia } }, h('div', { class: 'small dim' }, t('your_mates')), h('div', { class: 'row wrap' }, mates.map((p) => h('div', { class: 'row gap6' }, pAvatar(members, p, 'sm'), h('b', {}, p.name))))) : null,
    f.v ? (acked === roundKey() + ':sent' ? h('div', { class: 'center dim' }, h('div', { class: 'spinner', style: { margin: '0 auto 8px' } }), t('wait_narrator_start')) : h('button', { class: 'btn primary lg block', onclick: async () => { acked = roundKey() + ':sent'; await send({ t: 'g', cmd: 'ack' }); notify(); } }, ic('check'), t('got_it'))) : null);
}

// الليل (14) + التحقيق (18)
function nightView(R, m, members) {
  const me = m.me; const role = me.role; const acted = me.acted; const mk = (k) => k;
  const alive = m.players.filter((p) => p.alive);
  const mates = new Set(me.mates || []);
  const rules = { mafia: { kind: 'kill', ok: (p) => p.id !== me.id && !mates.has(p.id), btn: 'act_kill', color: 'primary' }, doctor: { kind: 'save', ok: (p) => p.id !== me.cannotSave, btn: 'act_save', color: 'green' },
    detective: { kind: 'investigate', ok: (p) => p.id !== me.id, btn: 'act_investigate', color: 'blue' }, sniper: { kind: 'shoot', ok: (p) => p.id !== me.id, btn: 'act_shoot', color: 'primary' } }[role];
  const canAct = me.alive && rules && !(role === 'sniper' && me.sniperUsed);
  const sleeping = () => h('div', { class: 'col center', style: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: '12px' } }, h('div', { style: { color: 'var(--purple)', animation: 'float 4s ease-in-out infinite' } }, ic('moon', 'lg')), h('style', {}, '.sleepmoon{}'),
    h('h2', {}, me.alive ? t('close_eyes') : t('you_are_out')), h('p', { class: 'dim' }, me.alive ? t('sleep_hint') : t('spectating')), timerRing(m.timer, { size: 120 }));
  if (!canAct) return sleeping();
  if (acted) {
    const last = (me.priv || []).filter((x) => x.type === 'investigation').at(-1);
    return h('div', { class: 'col', style: { flex: 1, justifyContent: 'center', gap: '14px' } }, h('div', { class: 'center' }, h('div', { style: { color: 'var(--green)' } }, ic('check', 'lg')), h('h2', {}, t('action_done'))),
      role === 'detective' && last && last.night === m.nights ? investigationCard(last, m, members) : h('p', { class: 'center dim' }, t('wait_dawn')), timerRing(m.timer, { size: 110 }));
  }
  const pickable = alive.filter(rules.ok);
  const mafiaPicks = me.mafiaVotes || {};
  const list = pickable.map((p) => playerRow(p, members, { me: me.id, selected: sel === p.id, role, onPick: (pp) => { sel = pp.id; sfx('tick'); buzz(15); notify(); },
    extra: role === 'mafia' && Object.values(mafiaPicks).includes(p.id) ? h('span', { class: 'chip role', style: { '--role': ROLE_COLOR.mafia } }, ic('target', 'sm'), Object.values(mafiaPicks).filter((x) => x === p.id).length) : null }));
  const send_ = (target) => act(null, { t: 'g', cmd: 'night', kind: rules.kind, target });
  return h('div', { class: 'col' }, h('div', { class: 'card accent center' }, h('h2', {}, t('night_prompt_' + role)), h('div', { class: 'small dim' }, t('night_hint_' + role)), timerRing(m.timer, { size: 96 })),
    role === 'detective' ? pastInvestigations(me, m, members) : null,
    h('div', { class: 'col' }, list),
    h('div', { class: 'row' }, h('button', { class: `btn lg grow ${rules.color}`, disabled: !sel, onclick: async (e) => { e.currentTarget.disabled = true; await send_(sel); } }, ic(role === 'doctor' ? 'med' : role === 'detective' ? 'search' : 'target'), t(rules.btn)),
      role === 'sniper' ? h('button', { class: 'btn lg', onclick: () => send_(null) }, t('act_pass')) : null));
}
function investigationCard(r, m, members) {
  const p = m.players.find((x) => x.id === r.target);
  return h('div', { class: 'card accent reveal center', style: { '--role': r.isMafia ? ROLE_COLOR.mafia : ROLE_COLOR.doctor } }, h('div', { class: 'small dim' }, t('investigation_result')), h('div', { class: 'row', style: { justifyContent: 'center' } }, pAvatar(members, p || { name: '?' }), h('b', {}, p?.name)),
    h('h2', { style: { color: r.isMafia ? 'var(--red)' : 'var(--green)' } }, r.isMafia ? t('is_mafia') : t('not_mafia')));
}
function pastInvestigations(me, m, members) {
  const list = (me.priv || []).filter((x) => x.type === 'investigation'); if (!list.length) return null;
  return h('div', { class: 'card col' }, h('h3', {}, t('investigation_log')), list.map((r) => { const p = m.players.find((x) => x.id === r.target); return h('div', { class: 'row between' }, h('span', {}, p?.name, p && !p.alive ? ' 💀' : ''), h('span', { class: 'chip role', style: { '--role': r.isMafia ? ROLE_COLOR.mafia : ROLE_COLOR.doctor } }, r.isMafia ? t('is_mafia') : t('not_mafia'))); }));
}

// الفجر: إعلان الضحايا
function dawnView(R, m, members) {
  const ids = (m.lastNight?.deaths || []).map((d) => d.id); const dead = ids.map((id) => m.players.find((p) => p.id === id)).filter(Boolean);
  return h('div', { class: 'col', style: { flex: 1, justifyContent: 'center', gap: '14px' } }, h('div', { class: 'center', style: { color: 'var(--gold)' } }, ic('sun', 'lg')), h('h2', { class: 'center' }, t('dawn_title')),
    dead.length ? dead.map((p) => h('div', { class: 'card accent reveal center', style: { '--role': ROLE_COLOR[p.role] || 'var(--red)' } }, pAvatar(members, p, 'lg'), h('h2', {}, p.name), h('div', { class: 'dim' }, t('was_killed')), p.role ? roleChip(p.role) : null))
      : h('div', { class: 'card reveal center' }, h('h2', {}, t('quiet_night')), h('p', { class: 'dim' }, t('no_one_died'))),
    h('p', { class: 'center dim small' }, t('wait_narrator_day')), myInvestigations(m, members));
}
const myInvestigations = (m, members) => (m.me?.role === 'detective' ? pastInvestigations(m.me, m, members) : null);

// النهار + المتحدث + المؤقت (15 / 17)
function dayView(R, m, members) {
  const spk = m.players.find((p) => p.id === m.speaker); const meSpk = spk && spk.id === m.me.id;
  return h('div', { class: 'col' }, h('div', { class: 'card accent center', style: { '--role': 'var(--gold)' } }, h('div', { class: 'small dim' }, t('day_n', { n: m.day })),
    spk ? h('div', { class: 'col', style: { alignItems: 'center', gap: '8px' } }, pAvatar(members, spk, 'lg'), h('h2', {}, meSpk ? t('your_turn_talk') : t('speaker_is', { name: spk.name })), timerRing(m.timer, { size: 160, label: m.timer?.paused ? t('paused') : '' }))
      : h('div', { style: { padding: '14px 0' } }, h('h3', {}, t('open_discussion')), h('p', { class: 'dim small' }, t('no_speaker'))), ),
    myInvestigations(m, members),
    h('h3', {}, t('players')), m.players.map((p) => playerRow(p, members, { me: m.me.id, speaker: m.speaker, showRole: true })), reportRow(m, members));
}
const reportRow = (m, members) => S.cfg.local ? null : h('button', { class: 'btn ghost sm', onclick: () => sheet((a) => [h('h2', {}, t('report')), m.players.filter((p) => p.id !== m.me?.id).map((p) => h('button', { class: 'prow', onclick: () => { a.close(); reportSheet({ id: +p.id, name: p.name }); } }, pAvatar(members, p, 'sm'), h('b', {}, p.name)))]) }, ic('flag', 'sm'), t('report'));

// التصويت (19)
function voteView(R, m, members) {
  const me = m.me; const vp = m.voteProgress;
  const cands = m.players.filter((p) => p.alive && p.id !== me.id);
  if (!me.alive) return h('div', { class: 'col' }, h('div', { class: 'card center' }, h('h2', {}, t('vote_time')), timerRing(m.timer, { size: 130 }), h('div', { class: 'dim small num' }, vp ? `${vp.done}/${vp.total}` : '')), m.players.map((p) => playerRow(p, members, { me: me.id, showRole: true })));
  if (me.voted) return h('div', { class: 'col center', style: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: '12px' } }, h('div', { style: { color: 'var(--green)' } }, ic('check', 'lg')), h('h2', {}, t('vote_cast')), h('p', { class: 'dim' }, t('vote_cast_hint')),
    timerRing(m.timer, { size: 120 }), vp ? h('div', { class: 'chip num' }, `${vp.done}/${vp.total}`) : null);
  return h('div', { class: 'col' }, h('div', { class: 'card accent center', style: { '--role': 'var(--gold)' } }, h('h2', {}, t('vote_title')), h('div', { class: 'small dim' }, t('vote_hint')), timerRing(m.timer, { size: 110 })),
    cands.map((p) => playerRow(p, members, { me: me.id, selected: sel === p.id, role: 'citizen', onPick: (pp) => { sel = pp.id; sfx('tick'); buzz(15); notify(); } })),
    h('div', { class: 'row' }, h('button', { class: 'btn gold lg grow', disabled: !sel, onclick: async (e) => { e.currentTarget.disabled = true; const v = sel; if (await act(null, { t: 'g', cmd: 'vote', target: v })) { sfx('vote'); buzz(60); } } }, ic('vote'), t('confirm_vote')),
      h('button', { class: 'btn lg', onclick: async () => { if (await confirmBox(t('abstain'), t('abstain_confirm'), t('abstain'), { danger: false })) act(null, { t: 'g', cmd: 'vote', target: null }); } }, t('abstain'))));
}

// نتائج التصويت (20)
export function tallyView(m, members, big = true) {
  const lv = m.lastVote; if (!lv) return null; const maxv = Math.max(1, ...Object.values(lv.tally), lv.abstain);
  const entries = Object.entries(lv.tally).sort((a, b) => b[1] - a[1]); const nameOf = (id) => m.players.find((p) => p.id === id)?.name || '?';
  const elim = lv.eliminated ? m.players.find((p) => p.id === lv.eliminated) : null;
  return h('div', { class: 'col' }, lv.manual ? null : h('div', { class: 'card col' }, h('h3', {}, t('vote_tally')),
    entries.map(([id, n]) => h('div', { class: 'vbar' + (id === lv.eliminated ? ' out' : '') }, h('div', { style: { width: '88px' }, class: 'small bold' }, nameOf(id)), h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: (n / maxv) * 100 + '%' } })), h('b', { class: 'num' }, n))),
    lv.abstain ? h('div', { class: 'vbar' }, h('div', { style: { width: '88px' }, class: 'small dim' }, t('abstain')), h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: (lv.abstain / maxv) * 100 + '%', background: '#6b7390' } })), h('b', { class: 'num' }, lv.abstain)) : null),
    elim ? h('div', { class: 'card accent reveal center', style: { '--role': ROLE_COLOR[elim.role] || 'var(--red)' } }, pAvatar(members, elim, 'lg'), h('h2', {}, elim.name), h('div', { class: 'dim' }, t('was_eliminated')), elim.role ? roleChip(elim.role) : null)
      : h('div', { class: 'card reveal center' }, h('h2', {}, lv.tie ? t('vote_tie') : t('vote_none')), h('p', { class: 'dim' }, t('nobody_eliminated'))));
}
function resultView(R, m, members) { return h('div', { class: 'col' }, h('h2', { class: 'center' }, t('vote_results')), tallyView(m, members), h('p', { class: 'center dim small' }, t('wait_narrator_night'))); }

// نهاية المباراة (21) + الإحصائيات
export function endView(R, m, members, isNarrator) {
  const winner = m.winner; const mafiaWin = winner === 'mafia'; const myTeam = m.me?.team; const won = winner && myTeam === winner;
  const gain = S.lastGain; const finished = R.status === 'finished'; const cancelled = m.endReason === 'cancelled';
  const best = [...R.history].length;
  return h('div', { class: 'col' }, h('div', { class: 'card win ' + (mafiaWin ? 'mafia' : 'town') + ' reveal' }, h('div', { style: { color: 'var(--role)' } }, ic(cancelled ? 'flag' : mafiaWin ? 'skull' : 'crown', 'lg')),
    h('h1', {}, cancelled ? t('match_cancelled') : mafiaWin ? t('mafia_wins') : t('town_wins')), !isNarrator && !cancelled ? h('div', { class: 'bold', style: { color: won ? 'var(--green)' : 'var(--red)' } }, won ? t('you_won') : t('you_lost')) : null,
    h('div', { class: 'small dim' }, t('round'), ' ', R.round, '/', R.settings.rounds, ' · ', t('days_n', { n: Math.max(m.day, m.nights) }))),
    !isNarrator && gain && !cancelled ? h('div', { class: 'card accent reveal row between', style: { '--role': 'var(--gold)' } }, h('div', {}, h('div', { class: 'small dim' }, t('points_earned')), h('b', { style: { fontSize: '26px', color: 'var(--gold)' } }, '+', h('span', { class: 'num' }, gain.points))),
      gain.newAchievements?.length ? h('span', { class: 'chip role', style: { '--role': 'var(--purple)' } }, ic('star', 'sm'), t('new_achievements', { n: gain.newAchievements.length })) : null) : null,
    h('h3', {}, t('roles_revealed')), m.players.map((p) => playerRow({ ...p, alive: true }, members, { me: m.me?.id, showRole: true, role: p.role, extra: p.alive ? null : h('span', { class: 'tiny dim' }, ic('skull', 'sm')) })),
    Object.keys(R.scores || {}).length && R.settings.rounds > 1 ? h('div', { class: 'card col' }, h('h3', {}, t('room_scores')), m.players.filter((p) => R.scores[p.id]).sort((a, b) => R.scores[b.id] - R.scores[a.id]).map((p) => h('div', { class: 'row between' }, h('span', {}, p.name), h('b', { class: 'num' }, R.scores[p.id], ' ', t('wins'))))) : null,
    isNarrator ? null : h('div', { class: 'center dim small' }, finished ? t('match_over_room') : t('wait_next_round')),
    !isNarrator ? h('div', { class: 'row' }, S.cfg.local ? null : h('button', { class: 'btn grow', onclick: () => go('stats') }, ic('list'), t('stats')), h('button', { class: 'btn grow danger', onclick: () => send({ t: 'room:leave' }) }, ic('out'), t('leave_room'))) : null);
}

// ========== لوحة الراوي (11) + اختيار المتحدث (16) + المؤقت (17) ==========
let talkSecs = null;
export const narrator = () => {
  const R = S.room; const m = R.match; const members = memberById(); const st = R.activeSettings || R.settings; const N = m.narrator;
  if (talkSecs === null || talkSecs.round !== roundKey()) talkSecs = { round: roundKey(), v: st.talkSeconds };
  const g = (cmd, p) => (e) => act(e?.currentTarget, { t: 'g', cmd, ...p });
  const aliveN = m.players.filter((p) => p.alive).length; const mafiaN = m.players.filter((p) => p.alive && p.role === 'mafia').length;
  let panel;
  if (m.narratorDriven && m.phase === 'roles') panel = ndRoles(m, g);
  else if (m.narratorDriven && m.phase === 'night') panel = ndNight(m, N, g);
  else switch (m.phase) {
    case 'roles': { const seen = m.players.filter((p) => p.seen).length;
      panel = [h('div', { class: 'card accent center' }, h('h3', {}, t('roles_dealt')), h('p', { class: 'dim small' }, t('roles_dealt_hint')), h('div', { class: 'bar', style: { margin: '10px 0' } }, h('i', { style: { width: (seen / m.players.length) * 100 + '%' } })), h('b', { class: 'num' }, `${seen}/${m.players.length}`, ' ', t('saw_roles'))),
        h('button', { class: 'btn primary lg block', onclick: g('beginNight') }, ic('moon'), t('begin_night'))]; break; }
    case 'night': { const pend = N.night?.pending || []; const nm = (id) => m.players.find((p) => p.id === id)?.name || '?';
      const act_ = (k) => (N.night ? N.night[k] : null);
      panel = [h('div', { class: 'card accent', style: { '--role': 'var(--purple)' } }, h('div', { class: 'row between' }, h('h3', {}, t('night_n', { n: m.nights })), h('span', { class: 'chip' }, h('b', { class: 'num' }, pend.length), ' ', t('pending'))), timerRing(m.timer, { size: 100 }),
        h('div', { class: 'col', style: { gap: '6px', marginTop: '8px' } }, m.players.filter((p) => p.alive && ['mafia', 'doctor', 'detective', 'sniper'].includes(p.role)).map((p) => {
          const done = N.night?.done[p.id]; let what = '';
          if (done === 'kill') what = '→ ' + nm(N.night.kill[p.id]); if (done === 'save') what = '→ ' + nm(N.night.save); if (done === 'investigate') what = '→ ' + nm(N.night.investigate); if (done === 'shoot') what = N.night.shoot ? '→ ' + nm(N.night.shoot) : t('act_pass');
          return h('div', { class: 'row between small' }, h('span', { class: 'rolechip' }, roleChip(p.role), p.name), done ? h('span', { style: { color: 'var(--green)' } }, ic('check', 'sm'), ' ', what) : h('span', { class: 'dim' }, t('waiting'))); }))),
        h('button', { class: 'btn primary lg block', onclick: async (e) => { if (pend.length && !(await confirmBox(t('end_night'), t('end_night_pending', { n: pend.length }), t('end_night')))) return; g('resolveNight')(e); } }, ic('sun'), t('end_night'))]; break; }
    case 'dawn': { const dead = (N.lastNight?.deaths || []).map((d) => m.players.find((p) => p.id === d.id)); 
      panel = [h('div', { class: 'card accent reveal center', style: { '--role': 'var(--gold)' } }, h('h3', {}, t('dawn_title')), dead.length ? dead.map((p) => h('div', {}, h('b', {}, p.name), ' ', roleChip(p.role), ' ', h('span', { class: 'tiny dim' }, t('cause_' + N.lastNight.deaths.find((d) => d.id === p.id).cause)))) : h('div', {}, t('quiet_night')),
        N.lastNight?.saved ? h('div', { class: 'small', style: { color: 'var(--green)' } }, ic('med', 'sm'), ' ', t('doctor_saved')) : null),
        h('button', { class: 'btn gold lg block', onclick: g('beginDay') }, ic('sun'), t('begin_day'))]; break; }
    case 'day': { const tm = m.timer;
      panel = [h('div', { class: 'card accent', style: { '--role': 'var(--gold)' } }, h('div', { class: 'row between' }, h('h3', {}, t('day_n', { n: m.day })), m.speaker ? h('span', { class: 'chip role', style: { '--role': 'var(--gold)' } }, ic('mic', 'sm'), m.players.find((p) => p.id === m.speaker)?.name) : h('span', { class: 'chip' }, t('no_speaker'))),
        tm ? [timerRing(tm, { size: 150, label: tm.paused ? t('paused') : '' }), h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn sm', onclick: g('timer', { op: tm.paused ? 'resume' : 'pause' }) }, ic(tm.paused ? 'play' : 'pause', 'sm'), tm.paused ? t('resume') : t('pause')),
          h('button', { class: 'btn sm', onclick: g('timer', { op: 'reset', seconds: talkSecs.v }) }, ic('reset', 'sm'), t('restart')),
          h('button', { class: 'btn sm', onclick: g('timer', { op: 'reset', seconds: Math.round(tm.left / 1000) + 30 }) }, '+30s'))] : null,
        h('div', { class: 'setrow' }, h('div', { class: 'grow small' }, t('talk_time')), h('div', { class: 'stepper' }, h('button', { onclick: () => { talkSecs.v = Math.max(15, talkSecs.v - 15); notify(); } }, '−'), h('div', { class: 'val num' }, fmtTime(talkSecs.v * 1000)), h('button', { onclick: () => { talkSecs.v = Math.min(600, talkSecs.v + 15); notify(); } }, '+')))),
        h('div', { class: 'row' }, h('button', { class: 'btn blue grow', onclick: g('nextSpeaker', { seconds: talkSecs.v }) }, ic('mic', 'sm'), t('next_speaker')), m.speaker ? h('button', { class: 'btn', onclick: g('clearSpeaker') }, t('stop_speaker')) : null),
        h('div', { class: 'small dim' }, t('pick_speaker_hint')),
        m.narratorDriven ? h('button', { class: 'btn primary lg block', onclick: () => voteSheet(m) }, ic('vote'), t('nd_vote_btn'))
          : h('button', { class: 'btn primary lg block', onclick: async (e) => { if (await confirmBox(t('begin_vote'), t('begin_vote_confirm'), t('begin_vote'), { danger: false })) g('beginVote')(e); } }, ic('vote'), t('begin_vote'))]; break; }
    case 'vote': { const lv = N.liveVotes || {}; const done = Object.keys(lv).length;
      panel = [h('div', { class: 'card accent center', style: { '--role': 'var(--gold)' } }, h('h3', {}, t('vote_time')), timerRing(m.timer, { size: 110 }), h('div', { class: 'chip num', style: { marginTop: '6px' } }, `${done}/${aliveN}`)),
        h('div', { class: 'card col' }, m.players.filter((p) => p.alive).map((p) => h('div', { class: 'row between small' }, h('span', {}, p.name), p.id in lv ? h('span', { style: { color: 'var(--green)' } }, ic('check', 'sm'), ' ', lv[p.id] ? t('voted_for', { name: m.players.find((x) => x.id === lv[p.id])?.name }) : t('abstain')) : h('span', { class: 'dim' }, t('waiting'))))),
        h('button', { class: 'btn primary lg block', onclick: g('closeVote') }, ic('check'), t('close_vote'))]; break; }
    case 'voteResult':
      panel = [tallyView(m, members), m.lastVote?.manual ? null : h('div', { class: 'card small col' }, h('h3', {}, t('who_voted_whom')), Object.entries(m.lastVote?.votes || {}).map(([a, b]) => h('div', { class: 'row between' }, h('span', {}, m.players.find((p) => p.id === a)?.name), h('span', { class: 'dim' }, b ? '→ ' + m.players.find((p) => p.id === b)?.name : t('abstain'))))),
        h('button', { class: 'btn primary lg block', onclick: g('beginNight') }, ic('moon'), t('begin_night'))]; break;
    case 'ended': panel = [endView(R, m, members, true),
      R.status === 'between' ? h('button', { class: 'btn primary lg block', onclick: (e) => act(e.currentTarget, { t: 'g', cmd: 'nextRound' }) }, ic('play'), t('next_round', { n: R.round + 1 })) : null,
      h('button', { class: 'btn danger block', onclick: async () => { if (await confirmBox(t('close_room'), t('close_room_confirm'), t('close_room'))) send({ t: 'room:close' }); } }, t('close_room'))]; break;
  }
  const showBoard = m.phase !== 'ended';
  const board = showBoard ? h('div', { class: 'col' }, h('div', { class: 'row between' }, h('h3', {}, t('players_board')), h('span', { class: 'small dim' }, h('b', { class: 'num', style: { color: 'var(--red)' } }, mafiaN), ' ', t('role_mafia'), ' · ', h('b', { class: 'num' }, aliveN - mafiaN), ' ', t('others'))),
    m.players.map((p) => playerRow(p, members, { speaker: m.speaker, showRole: true, role: p.role, onPick: m.phase === 'day' && p.alive ? (pp) => act(null, { t: 'g', cmd: 'setSpeaker', id: pp.id, seconds: talkSecs.v }) : null,
      extra: h('div', { class: 'row gap6', style: { gap: '4px' } }, st.narratorMute && p.alive && m.phase !== 'roles' ? h('button', { class: 'iconbtn', style: { width: '36px', height: '36px', color: p.manual ? 'var(--red)' : 'var(--dim)' }, 'aria-label': t('mute'), onclick: (e) => { e.stopPropagation(); act(null, { t: 'g', cmd: 'mute', id: p.id, muted: !p.manual }); } }, ic(p.manual ? 'micoff' : 'mic', 'sm')) : null,
        p.alive && m.phase !== 'roles' ? h('button', { class: 'iconbtn', style: { width: '36px', height: '36px' }, 'aria-label': t('eliminate'), onclick: async (e) => { e.stopPropagation(); if (await confirmBox(t('eliminate'), p.name, t('eliminate'))) act(null, { t: 'g', cmd: 'eliminate', id: p.id }); } }, ic('skull', 'sm')) : null) }))) : null;
  return [h('div', { class: 'screen', style: { '--role': 'var(--gold)' } },
    h('div', { class: 'top' }, h('span', { class: 'chip role', style: { '--role': 'var(--blue)' } }, ic('mic', 'sm'), t('narrator')), h('span', { class: 'chip' }, t('round'), ' ', h('b', { class: 'num' }, `${R.round}/${R.settings.rounds}`)), h('span', { class: 'chip num' }, '#' + R.code), h('div', { class: 'sp' }),
      h('button', { class: 'iconbtn', 'aria-label': t('match_settings'), onclick: () => m.phase === 'ended' ? settingsSheet() : toast(t('settings_between'), '') }, ic('gear'))),
    panel, board,
    m.phase !== 'ended' ? h('button', { class: 'btn danger block', onclick: async () => { if (await confirmBox(t('end_match'), t('end_match_confirm'), t('end_match'))) act(null, { t: 'g', cmd: 'endMatch' }); } }, ic('flag'), t('end_match')) : null)];
};

// ===== وضع الراوي (أوفلاين) =====
function ndRoles(m, g) {
  const seen = m.players.filter((p) => p.seen).length;
  return [h('div', { class: 'card accent center' }, h('h3', {}, t('roles_dealt')), h('p', { class: 'dim small' }, t('nd_roles_hint')),
      h('div', { class: 'bar', style: { margin: '10px 0' } }, h('i', { style: { width: (seen / m.players.length) * 100 + '%' } })), h('b', { class: 'num' }, `${seen}/${m.players.length}`, ' ', t('saw_roles'))),
    h('div', { class: 'col' }, m.players.map((p) => h('div', { class: 'prow' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, p.name), h('div', { class: 'tiny', style: { color: p.seen ? 'var(--green)' : 'var(--dim)' } }, p.seen ? t('nd_seen') : t('nd_not_seen'))),
      h('button', { class: 'btn sm' + (p.seen ? '' : ' blue'), onclick: () => revealSheet(p, m) }, ic('eye', 'sm'), t('nd_show_here'))))),
    h('button', { class: 'btn primary lg block', onclick: async (e) => { const left = m.players.length - seen; if (left && !(await confirmBox(t('begin_night'), t('nd_not_all_seen', { n: left }), t('begin_night'), { danger: false }))) return; g('beginNight')(e); } }, ic('moon'), t('begin_night'))];
}
/** عرض دور لاعب على هاتف الراوي: تسليم ← كشف ← إخفاء */
function revealSheet(p, m) {
  sheet((a) => {
    // كل خطوة تعيد محتواها؛ الانتقال بينها عبر a.set
    const s1 = () => [h('div', { class: 'center col', style: { alignItems: 'center', gap: '12px', padding: '20px 0' } }, ic('users', 'lg'), h('h2', {}, t('nd_hand_to', { name: p.name })), h('p', { class: 'dim small' }, t('nd_hand_hint'))),
      h('button', { class: 'btn blue lg block', onclick: () => { sfx('flip'); a.set(...s2()); } }, t('nd_i_am', { name: p.name })), h('button', { class: 'btn block', onclick: a.close }, t('cancel'))];
    const s2 = () => { const mates = p.role === 'mafia' ? m.players.filter((x) => x.role === 'mafia' && x.id !== p.id) : [];
      return [h('div', { class: 'card center col', style: { '--role': ROLE_COLOR[p.role], alignItems: 'center', gap: '8px', borderColor: ROLE_COLOR[p.role] } }, roleCard(p.role, 'sheet-card'),
        h('div', { class: 'small dim' }, t('role_desc_' + p.role)), mates.length ? h('div', { class: 'small' }, t('your_mates'), ': ', mates.map((x) => x.name).join('، ')) : null),
        h('button', { class: 'btn primary lg block', onclick: async () => { await act(null, { t: 'g', cmd: 'reveal', id: p.id }); a.close(); } }, t('nd_hide_return'))]; };
    return s1();
  });
}
const ND_STEPS = { mafia: ['kill', 'nd_step_mafia', 'nd_hint_mafia'], doctor: ['save', 'nd_step_doctor', 'nd_hint_doctor'], detective: ['investigate', 'nd_step_detective', 'nd_hint_detective'], sniper: ['shoot', 'nd_step_sniper', 'nd_hint_sniper'] };
function ndNight(m, N, g) {
  const n = N.night || { roles: [], pending: [], done: {} }; const alive = m.players.filter((p) => p.alive);
  const holder = (r) => alive.find((p) => p.role === r);
  const chosen = { mafia: n.kill, doctor: n.save, detective: n.investigate, sniper: n.shoot };
  const ok = { mafia: (p) => p.role !== 'mafia', doctor: (p) => p.id !== n.cannotSave, detective: (p) => p.id !== holder('detective')?.id, sniper: (p) => p.id !== holder('sniper')?.id };
  const cards = n.roles.map((r, i) => { const [kind, title, hint] = ND_STEPS[r]; const done = r in n.done; const cur = chosen[r];
    return h('div', { class: 'card col accent', style: { '--role': ROLE_COLOR[r], gap: '8px' } },
      h('div', { class: 'row between' }, h('h3', {}, `${i + 1}. `, t(title)), done ? h('span', { class: 'chip', style: { color: 'var(--green)' } }, ic('check', 'sm'), t('nd_recorded')) : h('span', { class: 'chip' }, t('waiting'))),
      h('div', { class: 'tiny dim' }, t(hint)),
      h('div', { class: 'row wrap gap6' }, alive.filter(ok[r]).map((p) => h('button', { class: 'chip role', style: { '--role': cur === p.id ? ROLE_COLOR[r] : 'var(--silver)', padding: '8px 12px', fontSize: '14px', ...(cur === p.id ? { background: 'color-mix(in srgb, ' + ROLE_COLOR[r] + ' 30%, transparent)' } : {}) },
        onclick: (e) => { sfx('tick'); act(e.currentTarget, { t: 'g', cmd: 'record', kind, target: p.id }); } }, p.name)),
        r === 'sniper' ? h('button', { class: 'chip', style: done && !cur ? { borderColor: 'var(--purple)', color: 'var(--purple)' } : {}, onclick: (e) => act(e.currentTarget, { t: 'g', cmd: 'record', kind: 'shoot', target: null }) }, t('nd_no_shot')) : null),
      r === 'detective' && n.investigate ? h('div', { class: 'banner reveal', style: n.investigateIsMafia ? {} : { background: 'rgba(33,168,117,.14)', borderColor: 'rgba(33,168,117,.5)', color: '#5fe0ad' } },
        n.investigateIsMafia ? '👍 ' + t('nd_detective_yes') : '👎 ' + t('nd_detective_no')) : null);
  });
  return [h('div', { class: 'card accent center', style: { '--role': 'var(--purple)' } }, h('h3', {}, t('night_n', { n: m.nights })), h('p', { class: 'small dim' }, t('nd_night_narrator'))), ...cards,
    h('button', { class: 'btn primary lg block', onclick: async (e) => { const pend = n.pending.length; if (pend && !(await confirmBox(t('end_night'), t('nd_pending_roles', { n: pend }), t('end_night')))) return; g('resolveNight')(e); } }, ic('sun'), t('end_night'))];
}
/** التصويت باليد: الراوي يسجّل من خرج */
function voteSheet(m) {
  sheet((a) => [h('h2', {}, t('nd_vote_title')), h('p', { class: 'small dim' }, t('nd_vote_hint')),
    h('div', { class: 'col' }, m.players.filter((p) => p.alive).map((p) => h('button', { class: 'prow', onclick: async () => { if (await confirmBox(t('nd_vote_confirm', { name: p.name }), null, t('nd_eliminate'))) { a.close(); act(null, { t: 'g', cmd: 'voteResult', target: p.id }); } } },
      h('b', { class: 'grow', style: { textAlign: 'start' } }, p.name), p.role ? roleChip(p.role) : null))),
    h('button', { class: 'btn block', onclick: async () => { a.close(); act(null, { t: 'g', cmd: 'voteResult', target: null }); } }, t('nd_nobody'))]);
}
