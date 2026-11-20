import { h, ic, avatar, toast, confirmBox } from '../dom.js';
import { t, LANGS, applyLang } from '../i18n.js';
import { S, prefs, setPref, notify } from '../store.js';
import { api, dropSession } from '../net.js';
import { go, screen, topbar, navbar, cached, bust, fail } from './common.js';
import { ROLE_COLOR, ROLE_ICON } from '../art.js';
import { sfx, buzz } from '../fx.js';

const spin = () => h('div', { class: 'center' }, h('div', { class: 'spinner', style: { margin: '40px auto' } }));
const sw = (on, set) => h('button', { type: 'button', class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), onclick: () => set(!on) });
const fmtDate = (ms) => new Date(ms).toLocaleDateString(prefs.lang === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' });

// الإحصائيات (22) + سجل المباريات
export const stats = () => {
  const d = cached('stats', () => api('/api/stats'), 3000);
  if (!d) return [screen(topbar(t('stats'), { back: S.room ? () => go('home') : 'profile' }), spin()), navbar('profile')];
  const roles = ['mafia', 'doctor', 'detective', 'sniper', 'citizen'];
  return [screen(topbar(t('stats'), { back: 'profile' }),
    h('div', { class: 'grid3' }, [[d.matches, 'matches'], [d.wins, 'wins'], [d.losses, 'losses']].map(([n, k]) => h('div', { class: 'card stat' }, h('b', { class: 'num' }, n), h('span', {}, t(k))))),
    h('div', { class: 'card col' }, h('div', { class: 'row between' }, h('h3', {}, t('win_rate')), h('b', { class: 'num' }, d.winRate + '%')), h('div', { class: 'bar' }, h('i', { style: { width: d.winRate + '%' } })),
      h('div', { class: 'row between small dim' }, h('span', {}, t('points'), ': ', h('b', { class: 'num' }, d.points)), h('span', {}, 'XP: ', h('b', { class: 'num' }, d.xp)))),
    h('div', { class: 'card col' }, h('h3', {}, t('by_role')), roles.map((r) => { const x = d.byRole.find((b) => b.role === r) || { n: 0, w: 0 };
      return h('div', { class: 'row', style: { '--role': ROLE_COLOR[r] } }, h('span', { class: 'chip role', style: { width: '96px', justifyContent: 'center' } }, ic(ROLE_ICON[r], 'sm'), t('role_' + r)),
        h('div', { class: 'bar grow' }, h('i', { style: { width: x.n ? (x.w / x.n) * 100 + '%' : '0', background: ROLE_COLOR[r] } })), h('span', { class: 'small num dim', style: { width: '56px', textAlign: 'end' } }, `${x.w || 0}/${x.n}`)); })),
    h('h3', {}, t('history')), d.history.length ? d.history.map((m) => h('div', { class: 'prow', style: { '--role': ROLE_COLOR[m.role] } },
      h('span', { style: { color: m.won ? 'var(--green)' : 'var(--red)' } }, ic(m.won ? 'trophy' : 'skull')), h('div', { class: 'grow' }, h('div', { class: 'nm' }, m.won ? t('won') : t('lost'), ' · ', t('role_' + m.role)),
        h('div', { class: 'tiny dim' }, fmtDate(m.ended_at), ' · ', t(m.mode), ' · ', m.players, ' ', t('players'))), h('b', { class: 'num' }, '+' + m.points))) : h('div', { class: 'card center dim' }, t('no_data_yet'))), navbar('profile')];
};

// المهام اليومية (23)
export const tasks = () => {
  const d = cached('tasks', () => api('/api/tasks'), 3000);
  const claim = async (k) => { try { const r = await api('/api/tasks/claim', { method: 'POST', body: { key: k } }); S.user = r.user; bust('tasks'); sfx('win'); buzz(60); toast(t('reward_got', { n: r.reward }), 'ok'); notify(); } catch (e) { fail(e.message); } };
  const done = d ? d.tasks.filter((x) => x.claimed).length : 0;
  return [screen(topbar(t('daily_tasks'), { back: 'home' }),
    h('div', { class: 'card accent row between', style: { '--role': 'var(--gold)' } }, h('div', {}, h('div', { class: 'small dim' }, t('tasks_renew')), h('b', { style: { fontSize: '22px' } }, t('tasks_done', { a: done, b: d?.tasks.length ?? 5 }))), h('span', { style: { color: 'var(--gold)' } }, ic('gift', 'lg'))),
    !d ? spin() : d.tasks.map((k) => h('div', { class: 'card col', style: { '--role': k.claimed ? 'var(--green)' : 'var(--blue)' } }, h('div', { class: 'row between' }, h('b', {}, t('task_' + k.key)), h('span', { class: 'chip role', style: { '--role': 'var(--gold)' } }, '+', k.reward)),
      h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, (k.progress / k.target) * 100) + '%' } })), h('div', { class: 'row between' }, h('span', { class: 'small dim num' }, `${Math.min(k.progress, k.target)}/${k.target}`),
        k.claimed ? h('span', { class: 'chip', style: { color: 'var(--green)' } }, ic('check', 'sm'), t('claimed')) : h('button', { class: 'btn sm gold', disabled: !k.done, onclick: () => claim(k.key) }, t('claim'))))),
    h('div', { class: 'tiny dim center' }, t('tasks_fair'))), navbar('tasks')];
};

// الإنجازات (24)
const ACH_ICON = { first_match: 'play', matches_10: 'list', first_win: 'trophy', wins_5: 'star', wins_25: 'crown', all_roles: 'mask', mafia_win: 'skull', doctor_save: 'med', sniper_hit: 'target', detective_hit: 'search', level_5: 'bolt' };
const ACH_COLOR = { mafia_win: 'var(--red)', doctor_save: 'var(--green)', sniper_hit: 'var(--purple)', detective_hit: 'var(--blue)' };
export const achievements = () => {
  const d = cached('stats', () => api('/api/stats'), 3000);
  if (!d) return [screen(topbar(t('achievements'), { back: 'profile' }), spin()), navbar('profile')];
  const got = new Set(d.achievements.map((a) => a.key));
  return [screen(topbar(t('achievements'), { back: 'profile' }), h('div', { class: 'card center' }, h('b', { style: { fontSize: '26px' } }, h('span', { class: 'num' }, `${got.size}/${d.allAchievements.length}`)), h('div', { class: 'small dim' }, t('unlocked'))),
    h('div', { class: 'grid2' }, d.allAchievements.map((k) => h('div', { class: 'card ach' + (got.has(k) ? '' : ' locked'), style: { '--role': ACH_COLOR[k] || 'var(--gold)' } }, h('div', { class: 'ico' }, ic(ACH_ICON[k] || 'star', 'lg')), h('b', {}, t('ach_' + k)), h('div', { class: 'tiny dim' }, t('ach_' + k + '_d')))))), navbar('profile')];
};

// الإعدادات (25)
export const settings = () => {
  const row = (icon, label, ctl, hint) => h('div', { class: 'setrow' }, ic(icon), h('div', { class: 'grow' }, h('div', {}, label), hint && h('div', { class: 'tiny dim' }, hint)), ctl);
  return [screen(topbar(t('settings'), { back: S.user ? 'home' : 'login' }),
    h('div', { class: 'card' }, row('sound', t('sound_fx'), sw(prefs.sound, (v) => { setPref('sound', v); if (v) sfx('notify'); })),
      row('bell', t('quiet_mode'), sw(prefs.quiet, (v) => setPref('quiet', v)), t('quiet_hint')), row('vib', t('haptics'), sw(prefs.haptics, (v) => { setPref('haptics', v); if (v) buzz(40); })),
      row('bolt', t('lite_mode'), sw(prefs.lite, (v) => setPref('lite', v)), t('lite_hint'))),
    Object.keys(LANGS).length > 1 ? h('div', { class: 'card col' }, h('div', { class: 'row' }, ic('globe'), h('b', {}, t('language'))), h('div', { class: 'seg' }, Object.entries(LANGS).map(([k, L]) => h('button', { class: prefs.lang === k ? 'on' : '', onclick: () => { setPref('lang', k); applyLang(); } }, L.name)))) : null,
    h('div', { class: 'card col' }, h('div', { class: 'row' }, ic('info'), h('b', {}, t('about'))), h('p', { class: 'small dim' }, t('about_text')), h('div', { class: 'tiny dim' }, t('server'), ': ', h('span', { class: 'num' }, location.host))),
    window.Android?.changeServer ? h('button', { class: 'btn block', onclick: () => window.Android.changeServer() }, ic('globe'), t('change_server')) : null,
    S.user ? h('button', { class: 'btn danger block', onclick: async () => { if (await confirmBox(t('logout'), t('logout_confirm'), t('logout'))) { try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* غير متصل */ } dropSession(); go('login'); } } }, ic('out'), t('logout')) : null), S.user ? navbar('profile') : null].filter(Boolean);
};
