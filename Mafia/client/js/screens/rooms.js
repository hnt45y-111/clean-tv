import { h, ic, avatar, toast, sheet, copyText, confirmBox, fmtTime } from '../dom.js';
import { t } from '../i18n.js';
import { S, notify, serverNow } from '../store.js';
import { api, send } from '../net.js';
import { go, screen, topbar, act, fail, cached, liveCfg } from './common.js';
import qrcode from '../../vendor/qrcode.mjs';
import { roleArt, ROLE_COLOR } from '../art.js';
import { sfx } from '../fx.js';

const MIN = 4, MAX = 20;
const maxMafia = (n) => Math.max(1, Math.floor((n - 1) / 2));
const suggest = (n) => Math.min(maxMafia(n), Math.max(1, Math.round(n / 4)));
export const defaultDraft = (mode) => ({ players: 8, mafia: 2, doctor: true, detective: true, sniper: true, talkSeconds: 120, voteSeconds: 60, nightSeconds: 45, rounds: 1,
  visibility: mode === 'offline' ? 'private' : 'private', narratorMute: true, muteDead: true, muteNight: true, revealRoleOnDeath: true });
let draft = null;

const stepper = (val, set, { min, max, step = 1, fmt = (v) => v }) => h('div', { class: 'stepper' },
  h('button', { type: 'button', onclick: () => set(Math.max(min, val - step)), 'aria-label': '-' }, '−'), h('div', { class: 'val num' }, fmt(val)), h('button', { type: 'button', onclick: () => set(Math.min(max, val + step)), 'aria-label': '+' }, '+'));
const sw = (on, set) => h('button', { type: 'button', class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), onclick: () => set(!on) });
const line = (label, ctl, hint) => h('div', { class: 'setrow' }, h('div', { class: 'grow' }, h('div', {}, label), hint && h('div', { class: 'tiny dim' }, hint)), ctl);
const secFmt = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`);

export function validateDraft(d) {
  const specials = d.mafia + +d.doctor + +d.detective + +d.sniper;
  if (d.players < MIN) return 'players_range';
  if (d.mafia * 2 >= d.players) return 'mafia_too_many';
  if (specials > d.players) return 'roles_exceed_players';
  return null;
}
export function rolePreview(d) {
  const cit = Math.max(0, d.players - d.mafia - +d.doctor - +d.detective - +d.sniper);
  const parts = [['mafia', d.mafia], ['doctor', +d.doctor], ['detective', +d.detective], ['sniper', +d.sniper], ['citizen', cit]].filter(([, n]) => n > 0);
  return h('div', { class: 'card' }, h('div', { class: 'small dim' }, t('role_split')),
    h('div', { style: { display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', margin: '8px 0' } }, parts.map(([r, n]) => h('div', { style: { flex: n, background: ROLE_COLOR[r] } }))),
    h('div', { class: 'row wrap gap6' }, parts.map(([r, n]) => h('span', { class: 'chip role', style: { '--role': ROLE_COLOR[r] } }, t('role_' + r), ' ', h('b', { class: 'num' }, n)))));
}

/** نموذج إعدادات المباراة (يُستخدم في الإنشاء وفي تعديل الغرفة) */
export function settingsForm(d, { mode, rerender }) {
  const upd = (k, v) => { d[k] = v; if (k === 'players') d.mafia = Math.min(d.mafia, maxMafia(d.players)); rerender(); };
  const err = validateDraft(d);
  return h('div', { class: 'col' },
    h('div', { class: 'card' }, h('h3', {}, t('set_players')),
      line(t('total_players'), stepper(d.players, (v) => upd('players', v), { min: MIN, max: MAX })),
      line(t('mafia_count'), stepper(d.mafia, (v) => upd('mafia', v), { min: 1, max: maxMafia(d.players) }), t('mafia_hint')),
      line(t('role_doctor'), sw(d.doctor, (v) => upd('doctor', v))), line(t('role_detective'), sw(d.detective, (v) => upd('detective', v))), line(t('role_sniper'), sw(d.sniper, (v) => upd('sniper', v))),
      h('div', { class: 'tiny dim' }, t('rules_note'))),
    rolePreview(d), err && h('div', { class: 'banner red' }, t('err.' + err)),
    h('div', { class: 'card' }, h('h3', {}, t('set_timing')),
      line(t('talk_time'), stepper(d.talkSeconds, (v) => upd('talkSeconds', v), { min: 15, max: 600, step: 15, fmt: secFmt }), mode === 'online' ? t('talk_default_online') : null),
      line(t('vote_time'), stepper(d.voteSeconds, (v) => upd('voteSeconds', v), { min: 10, max: 300, step: 10, fmt: secFmt })),
      line(t('night_time'), stepper(d.nightSeconds, (v) => upd('nightSeconds', v), { min: 10, max: 300, step: 5, fmt: secFmt })),
      line(t('rounds'), stepper(d.rounds, (v) => upd('rounds', v), { min: 1, max: 10 }), t('rounds_hint'))),
    h('div', { class: 'card' }, h('h3', {}, t('set_mute')),
      line(t('narrator_mute'), sw(d.narratorMute, (v) => upd('narratorMute', v)), t('narrator_mute_hint')), line(t('mute_dead'), sw(d.muteDead, (v) => upd('muteDead', v))),
      line(t('mute_night'), sw(d.muteNight, (v) => upd('muteNight', v))), line(t('reveal_on_death'), sw(d.revealRoleOnDeath, (v) => upd('revealRoleOnDeath', v)))),
    mode === 'online' ? h('div', { class: 'card' }, h('h3', {}, t('room_type')), h('div', { class: 'seg', style: { marginTop: '8px' } },
      ['private', 'public'].map((v) => h('button', { type: 'button', class: d.visibility === v ? 'on' : '', onclick: () => upd('visibility', v) }, ic(v === 'public' ? 'globe' : 'lock', 'sm'), ' ', t('vis_' + v)))), h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, t('vis_' + d.visibility + '_hint'))) : null);
}

// إنشاء غرفة (8)
export const create = () => {
  const mode = S.params.mode || 'online'; if (!draft || draft._m !== mode) { draft = defaultDraft(mode); draft._m = mode; }
  const btn = h('button', { class: 'btn primary lg block', disabled: !!validateDraft(draft), onclick: async (e) => { const { _m, ...settings } = draft; if (await act(e.currentTarget, { t: 'room:create', mode, settings })) draft = null; } }, ic('plus'), t('create_room_btn'));
  return [screen(topbar(mode === 'offline' ? t('create_offline') : t('create_room'), { back: () => go(S.cfg.local ? 'home' : 'mode', { m: mode }) }),
    h('div', { class: 'banner', style: { background: 'rgba(36,120,232,.14)', borderColor: 'rgba(36,120,232,.5)', color: '#8ab8ff' } }, ic('mic', 'sm'), t('narrator_you')),
    settingsForm(draft, { mode, rerender: notify }), btn)];
};

// ---- QR ----
let lanBase = null;
async function loadBase() {
  if (lanBase) return lanBase;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!local) return (lanBase = location.origin);
  try { const { addresses } = await (await fetch('/api/lan')).json(); if (addresses[0]) return (lanBase = `${location.protocol}//${addresses[0]}${location.port ? ':' + location.port : ''}`); } catch { /* بلا شبكة */ }
  return (lanBase = location.origin);
}
export const joinUrl = (base, key) => `${base}/#/join/${key}`;
export function qrSvg(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); const svg = q.createSvgTag({ scalable: true, margin: 0 }); return svg; }

// الانضمام (9)
let scanning = null;
const KEY_RE = /([0-9]{6}-[A-Z2-9]{8})/i;
export const parseKey = (s) => { const m = String(s).match(KEY_RE); return m ? m[1].toUpperCase() : null; };
export const join = () => {
  const mode = S.params.mode || 'online'; const offline = mode === 'offline';
  const keyIn = h('input', { class: 'input code', id: 'joinkey', placeholder: offline ? '123456-ABCD2345' : '123456', maxlength: offline ? 15 : 6, autocomplete: 'off', inputmode: offline ? 'text' : 'numeric' });
  const go_ = async (e) => { const k = offline ? (parseKey(keyIn.value) || keyIn.value.trim()) : keyIn.value.trim(); if (!k) return; await act(e.currentTarget, { t: 'room:join', key: k }); };
  const video = h('video', { playsinline: true, muted: true, style: { width: '100%', borderRadius: '18px', background: '#000', aspectRatio: '1', objectFit: 'cover' } });
  const camBox = h('div', { class: 'card col hide', id: 'cambox' }, video, h('button', { class: 'btn', onclick: () => stopScan() }, t('close')));
  const startScan = async () => {
    const secure = window.isSecureContext && navigator.mediaDevices?.getUserMedia;
    if (!secure || !('BarcodeDetector' in window)) return toast(t('scan_unsupported'), 'err');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); video.srcObject = stream; await video.play(); camBox.classList.remove('hide');
      const det = new BarcodeDetector({ formats: ['qr_code'] }); scanning = { stream };
      const loop = async () => { if (!scanning) return; try { const r = await det.detect(video); const k = r[0] && parseKey(r[0].rawValue); if (k) { stopScan(); return send({ t: 'room:join', key: k }).then((a) => !a.ok && fail(a.error)); } } catch { /* إطار غير جاهز */ } setTimeout(loop, 250); };
      loop();
    } catch { toast(t('camera_denied'), 'err'); }
  };
  function stopScan() { scanning?.stream.getTracks().forEach((x) => x.stop()); scanning = null; camBox.classList.add('hide'); }
  return [screen(topbar(offline ? t('join_qr') : t('join_room'), { back: S.cfg.local ? (S.cfg.isHost ? 'home' : null) : () => { stopScan(); go('mode', { m: mode }); } }),
    S.cfg.local && !S.cfg.isHost ? h('div', { class: 'card col' }, h('h3', {}, t('local_join_title')), h('p', { class: 'small dim' }, t('local_join_how'))) : null,
    offline ? h('div', { class: 'col' },
      h('div', { class: 'card accent', style: { '--role': 'var(--green)' } }, h('div', { class: 'center' }, h('div', { style: { color: 'var(--green)' } }, ic('qr', 'lg')), h('h3', {}, t('scan_title')), h('p', { class: 'small dim' }, t('scan_how')))),
      h('button', { class: 'btn green lg block', onclick: startScan }, ic('camera'), t('scan_now')), camBox, h('div', { class: 'center dim small' }, t('or_enter_key'))) : h('div', { class: 'card center dim small' }, t('join_online_desc')),
    h('div', { class: 'field' }, h('label', { for: 'joinkey' }, offline ? t('room_key') : t('room_code')), keyIn),
    h('button', { class: 'btn primary lg block', onclick: go_ }, t('join')))];
};

// ---- غرفة الانتظار (10) ----
const known = new Set(); let knownRoom = null;
export const lobby = () => {
  const R = S.room; const isHost = R.isHost; const offline = R.mode === 'offline';
  if (knownRoom !== R.code) { known.clear(); knownRoom = R.code; R.members.forEach((m) => known.add(m.id)); }
  const ready = R.members.filter((m) => m.ready).length; const me = R.members.find((m) => m.id === S.user.id);
  const base = cached('lan', loadBase, 60000);
  const guests = R.guests || []; const total = R.members.length + guests.length;
  const canStart = isHost && total >= MIN && (offline || R.members.every((m) => m.ready));
  const leave = async () => { if (await confirmBox(isHost ? t('close_room') : t('leave_room'), isHost ? t('close_room_confirm') : t('leave_confirm'), isHost ? t('close_room') : t('leave_room'))) send({ t: isHost ? 'room:close' : 'room:leave' }); };
  const cd = R.auto && R.startsAt ? h('div', { class: 'card center' }, h('div', { class: 'small dim' }, t('auto_starts_in')), h('div', { class: 'code-big', 'data-cd': R.startsAt }, '…')) : null;
  const rows = R.members.map((m) => { const fresh = !known.has(m.id); known.add(m.id);
    return h('div', { class: 'prow' + (fresh ? ' deal' : '') + (m.id === S.user.id ? ' me' : '') }, avatar({ ...m, online: m.connected }), h('div', { class: 'grow' }, h('div', { class: 'nm' }, m.name, m.guest ? h('span', { class: 'tiny dim' }, ' · ' + t('guest_tag')) : null), h('div', { class: 'tiny dim' }, h('span', { class: 'num' }, 'ID ' + m.uid), ' · ', m.connected ? t('connected') : t('disconnected'))),
      !offline && !R.auto ? h('span', { class: 'chip', style: m.ready ? { color: 'var(--green)', borderColor: 'var(--green)' } : {} }, m.ready ? t('ready') : t('not_ready')) : null,
      isHost ? h('button', { class: 'iconbtn', style: { width: '36px', height: '36px' }, 'aria-label': t('kick'), onclick: async () => { if (await confirmBox(t('kick'), m.name, t('kick'))) act(null, { t: 'room:kick', userId: m.id }); } }, ic('x', 'sm'))
        : m.id !== S.user.id && !S.cfg.local ? h('button', { class: 'iconbtn', style: { width: '36px', height: '36px' }, 'aria-label': t('report'), onclick: () => reportSheet(m) }, ic('flag', 'sm')) : null); });
  const st = R.settings;
  return [screen(topbar(offline ? t('offline_room') : t('lobby'), { back: leave, right: h('span', { class: 'chip' }, ic('users', 'sm'), h('span', { class: 'num' }, `${total}/${st.players}`)) }),
    isHost && offline && S.cfg.local ? wifiStep() : null,
    isHost && offline && (!S.cfg.local || qrStep === 2 || !S.cfg.wifi) ? h('div', { class: 'col' }, S.cfg.local && !S.cfg.wifi ? h('div', { class: 'banner red' }, ic('wifioff', 'sm'), t('hotspot_manual')) : null,
      S.cfg.local ? h('div', { class: 'small dim center' }, t('step2_hint')) : null,
      h('div', { class: 'qrbox' }, base ? raw(qrSvg(joinUrl(base, R.joinKey))) : h('div', { class: 'spinner', style: { margin: '80px auto' } })),
      h('div', { class: 'center' }, h('div', { class: 'small dim' }, t('room_number')), h('div', { class: 'code-big' }, R.code)),
      h('div', { class: 'row' }, h('button', { class: 'btn grow sm', onclick: () => base && copyText(joinUrl(base, R.joinKey)) }, ic('copy', 'sm'), t('copy_link')), h('button', { class: 'btn grow sm', onclick: () => copyText(R.joinKey) }, ic('lock', 'sm'), t('copy_key'))),
      h('div', { class: 'tiny dim center' }, base ? base.replace(/^https?:\/\//, '') : '')) : null,
    !offline || !isHost ? h('div', { class: 'card center' }, h('div', { class: 'small dim' }, t('room_code')), h('div', { class: 'code-big' }, R.code),
      !R.auto ? h('div', { class: 'row', style: { justifyContent: 'center' } }, h('button', { class: 'btn sm', onclick: () => copyText(R.code) }, ic('copy', 'sm'), t('copy')), isHost ? h('button', { class: 'btn sm blue', onclick: () => inviteSheet() }, ic('send', 'sm'), t('invite_friends')) : null) : null) : null,
    !isHost && R.hostInfo ? h('div', { class: 'prow', style: { '--role': 'var(--blue)' } }, avatar({ ...R.hostInfo, online: R.hostInfo.connected }), h('div', { class: 'grow' }, h('div', { class: 'tiny dim' }, t('narrator')), h('div', { class: 'nm' }, R.hostInfo.name)), ic('mic')) : null,
    cd,
    h('div', { class: 'card row between', style: { alignItems: 'flex-start' } }, h('div', { class: 'col', style: { gap: '4px' } }, h('div', { class: 'row wrap gap6' }, h('span', { class: 'chip role', style: { '--role': ROLE_COLOR.mafia } }, t('role_mafia'), ' ', h('b', { class: 'num' }, st.mafia)),
      st.doctor && h('span', { class: 'chip role', style: { '--role': ROLE_COLOR.doctor } }, t('role_doctor')), st.detective && h('span', { class: 'chip role', style: { '--role': ROLE_COLOR.detective } }, t('role_detective')), st.sniper && h('span', { class: 'chip role', style: { '--role': ROLE_COLOR.sniper } }, t('role_sniper'))),
      h('div', { class: 'tiny dim' }, `${t('talk_time')} ${secLabel(st.talkSeconds)} · ${t('vote_time')} ${secLabel(st.voteSeconds)} · ${t('rounds')} ${st.rounds}`)),
      isHost ? h('button', { class: 'iconbtn', onclick: () => settingsSheet(), 'aria-label': t('edit') }, ic('edit')) : null),
    isHost && S.cfg.local ? h('div', { class: 'col' }, h('div', { class: 'row between' }, h('h3', {}, t('nd_guests')), h('button', { class: 'btn sm', onclick: () => guestSheet() }, ic('plus', 'sm'), t('nd_add_guest'))),
      h('div', { class: 'tiny dim' }, t('nd_guests_hint')),
      guests.map((g) => h('div', { class: 'prow' }, avatar({ name: g.name }), h('div', { class: 'grow' }, h('div', { class: 'nm' }, g.name), h('div', { class: 'tiny dim' }, t('nd_no_phone'))),
        h('button', { class: 'iconbtn', style: { width: '36px', height: '36px' }, onclick: () => act(null, { t: 'room:removeGuest', id: g.id }) }, ic('x', 'sm'))))) : null,
    h('div', { class: 'col' }, h('div', { class: 'row between' }, h('h3', {}, t('players')), !offline && !R.auto ? h('span', { class: 'small dim num' }, `${ready}/${R.members.length} ${t('ready')}`) : null), rows.length ? rows : h('div', { class: 'card center dim small' }, t('waiting_players'))),
    h('div', { class: 'sp' }),
    isHost ? h('div', { class: 'col' }, !canStart && h('div', { class: 'small dim center' }, total < MIN ? t('need_min', { n: MIN }) : t('wait_ready')),
      h('button', { class: 'btn primary lg block', disabled: !canStart, onclick: (e) => act(e.currentTarget, { t: 'room:start' }) }, ic('play'), t('start_game')),
      h('button', { class: 'btn danger block', onclick: leave }, t('close_room')))
      : !offline && !R.auto && me ? h('button', { class: 'btn lg block ' + (me.ready ? '' : 'green'), onclick: (e) => act(e.currentTarget, { t: 'room:ready', ready: !me.ready }) }, ic('check'), me.ready ? t('cancel_ready') : t('im_ready'))
      : h('div', { class: 'small dim center' }, R.auto ? t('auto_wait') : t('wait_narrator')),
    !isHost ? h('button', { class: 'btn ghost block', onclick: leave }, ic('out'), t('leave_room')) : null,
  )];
};
const raw = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

// ---- الوضع المحلي: باركود الشبكة (الخطوة 1) ثم باركود الغرفة (الخطوة 2) ----
let qrStep = 1;
const wifiEsc = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
export const wifiQrText = (w) => `WIFI:T:${w.security === 'SAE' ? 'SAE' : w.security === 'nopass' ? 'nopass' : 'WPA'};S:${wifiEsc(w.ssid)};${w.pass ? 'P:' + wifiEsc(w.pass) + ';' : ''};`;
function wifiStep() {
  const cfg = liveCfg(); const w = cfg.wifi; if (!w) return null;
  const seg = h('div', { class: 'seg' }, [[1, t('step1')], [2, t('step2')]].map(([n, l]) => h('button', { class: qrStep === n ? 'on' : '', onclick: () => { qrStep = n; notify(); } }, l)));
  if (qrStep !== 1) return seg;
  return h('div', { class: 'col' }, seg, h('div', { class: 'small dim center' }, t('step1_hint')),
    h('div', { class: 'qrbox' }, raw(qrSvg(wifiQrText(w)))),
    h('div', { class: 'card col', style: { gap: '6px' } }, h('div', { class: 'row between' }, h('span', { class: 'small dim' }, t('wifi_name')), h('b', { class: 'num' }, w.ssid)),
      w.pass ? h('div', { class: 'row between' }, h('span', { class: 'small dim' }, t('wifi_pass')), h('b', { class: 'num' }, w.pass)) : null),
    h('button', { class: 'btn blue block', onclick: () => { qrStep = 2; notify(); } }, t('next_step')));
}
const secLabel = secFmt;

export function reportSheet(m) {
  return sheet((a) => { const ta = h('textarea', { class: 'input', id: 'rep', rows: 3, maxlength: 300, placeholder: t('report_reason'), style: { padding: '12px', minHeight: '90px' } });
    return [h('h2', {}, t('report') + ': ' + m.name), ta, h('div', { class: 'row' }, h('button', { class: 'btn primary grow', onclick: async () => { const r = await send({ t: 'report', userId: m.id, reason: ta.value }); if (r.ok) { toast(t('report_sent'), 'ok'); a.close(); } else fail(r.error); } }, t('send')), h('button', { class: 'btn grow', onclick: a.close }, t('cancel')))]; });
}
function inviteSheet() {
  sheet((a) => { const list = S.friends.friends.filter((f) => !f.inRoom);
    return [h('h2', {}, t('invite_friends')), list.length ? list.map((f) => h('div', { class: 'prow' }, avatar(f), h('div', { class: 'grow' }, h('div', { class: 'nm' }, f.name), h('div', { class: 'tiny dim' }, f.online ? t('online_now') : t('offline_now'))),
      h('button', { class: 'btn sm blue', disabled: !f.online, onclick: async (e) => { if (await act(e.currentTarget, { t: 'invite', userId: f.id })) toast(t('invite_sent'), 'ok'); } }, t('invite')))) : h('div', { class: 'card center dim' }, t('no_friends'))]; });
}
function settingsSheet() {
  const R = S.room; const d = { ...R.settings };
  sheet((a) => { const body = h('div', { class: 'col' }); const draw = () => { body.replaceChildren(settingsForm(d, { mode: R.mode, rerender: draw }), h('button', { class: 'btn primary lg block', disabled: !!validateDraft(d), onclick: async () => { if (await act(null, { t: 'room:settings', settings: d })) a.close(); } }, t('save'))); }; draw(); return [h('h2', {}, t('match_settings')), body]; });
}
export { settingsSheet };

function guestSheet() {
  sheet((a) => { const inp = h('input', { class: 'input', id: 'guestname', maxlength: 24, placeholder: t('player_name') });
    const add = async () => { if (!inp.value.trim()) return; if (await act(null, { t: 'room:addGuest', name: inp.value })) { inp.value = ''; toast(t('nd_guest_added'), 'ok'); } };
    setTimeout(() => inp.focus(), 50);
    return [h('h2', {}, t('nd_add_guest')), h('p', { class: 'small dim' }, t('nd_guests_hint')), inp, h('div', { class: 'row' }, h('button', { class: 'btn blue grow', onclick: add }, ic('plus'), t('add')), h('button', { class: 'btn grow', onclick: a.close }, t('close')))]; });
}
