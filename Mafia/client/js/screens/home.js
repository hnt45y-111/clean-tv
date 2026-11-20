import { h, ic, avatar, toast, sheet, copyText, confirmBox } from '../dom.js';
import { t, err } from '../i18n.js';
import { S, saveToken, notify } from '../store.js';
import { api, send, dropSession, connect } from '../net.js';
import { go, screen, topbar, navbar, act, fail, xpBar, cached, liveCfg } from './common.js';
import { join as joinScreen } from './rooms.js';
import { logoArt } from '../art.js';

export const home = () => {
  if (S.cfg.local) return localHome();
  const u = S.user; const pend = S.friends.incoming.length;
  return [screen(
    h('div', { class: 'row' }, h('button', { class: 'row grow', style: { textAlign: 'start' }, onclick: () => go('profile') }, avatar(u, '', ''), h('div', { class: 'grow' }, h('div', { class: 'bold' }, u.name), h('div', { class: 'small dim' }, `${t('points')}: `, h('b', { class: 'num' }, u.points)))),
      h('button', { class: 'iconbtn', onclick: () => go('settings'), 'aria-label': t('settings') }, ic('gear'))),
    xpBar(u),
    h('button', { class: 'card accent modecard', style: { '--role': 'var(--blue)', textAlign: 'start' }, onclick: () => go('mode', { m: 'online' }) },
      h('div', { class: 'big' }, ic('globe', 'lg')), h('div', { class: 'grow' }, h('h2', {}, t('online')), h('div', { class: 'small dim' }, t('online_desc')))),
    h('button', { class: 'card accent modecard', style: { '--role': 'var(--red)', textAlign: 'start' }, onclick: () => go('mode', { m: 'offline' }) },
      h('div', { class: 'big' }, ic('qr', 'lg')), h('div', { class: 'grow' }, h('h2', {}, t('offline')), h('div', { class: 'small dim' }, t('offline_desc')))),
    h('div', { class: 'grid2' },
      tile('trophy', t('leaderboard'), 'leaderboard', 'var(--gold)'), tile('list', t('stats'), 'stats', 'var(--blue)'),
      tile('star', t('achievements'), 'achievements', 'var(--purple)'), tile('users', t('nav_friends'), 'friends', 'var(--green)', pend || null)),
  ), navbar('home')];
};
function localHome() {
  const cfg = liveCfg();
  if (!cfg.isHost) { S.params = { mode: 'offline' }; return joinScreen(); }
  const w = cfg.wifi;
  return [screen(
    h('div', { class: 'row' }, avatar(S.user), h('div', { class: 'grow' }, h('div', { class: 'small dim' }, t('narrator')), h('div', { class: 'bold' }, S.user.name)),
      h('button', { class: 'iconbtn', onclick: () => go('settings'), 'aria-label': t('settings') }, ic('gear'))),
    h('div', { class: 'hero' }, logoArt(), h('div', { class: 'logo' }, 'مافيا')),
    w ? h('div', { class: 'banner', style: { background: 'rgba(33,168,117,.14)', borderColor: 'rgba(33,168,117,.5)', color: '#5fe0ad' } }, ic('wifi', 'sm'), t('hotspot_on', { ssid: w.ssid }))
      : h('div', { class: 'banner red' }, ic('wifioff', 'sm'), cfg.hotspotError ? t('hotspot_err_' + cfg.hotspotError) : t('hotspot_starting')),
    h('button', { class: 'card accent modecard', style: { '--role': 'var(--red)', textAlign: 'start' }, onclick: () => go('create', { mode: 'offline' }) },
      h('div', { class: 'big' }, ic('plus', 'lg')), h('div', { class: 'grow' }, h('h2', {}, t('create_room')), h('div', { class: 'small dim' }, t('local_create_desc')))),
    h('div', { class: 'card col' }, h('h3', {}, t('local_how_title')), h('p', { class: 'small dim' }, t('local_how')))
  )];
}
const tile = (icon, label, route, color, badge) => h('button', { class: 'card row', style: { '--role': color, textAlign: 'start' }, onclick: () => go(route) },
  h('span', { style: { color } }, ic(icon, 'lg')), h('b', { class: 'grow' }, label), badge ? h('span', { class: 'chip role' }, badge) : null);

// شاشة اختيار أونلاين/أوفلاين (5)
export const mode = () => {
  const m = S.params.m;
  if (!m) return screen(topbar(t('choose_mode')), cardBtn('globe', t('online'), t('online_desc'), 'var(--blue)', () => go('mode', { m: 'online' })), cardBtn('qr', t('offline'), t('offline_desc'), 'var(--red)', () => go('mode', { m: 'offline' })));
  const body = m === 'online' ? [
    cardBtn('bolt', t('quick_match'), t('quick_match_desc'), 'var(--gold)', async (e) => { if (await act(e.currentTarget, { t: 'mm:find' })) { /* الغرفة تصل عبر البث */ } }),
    cardBtn('plus', t('create_room'), t('create_room_desc'), 'var(--blue)', () => go('create', { mode: 'online' })),
    cardBtn('door', t('join_room'), t('join_room_desc'), 'var(--green)', () => go('join', { mode: 'online' })),
    publicRooms(),
  ] : [
    cardBtn('qr', t('create_offline'), t('create_offline_desc'), 'var(--red)', () => go('create', { mode: 'offline' })),
    cardBtn('camera', t('join_qr'), t('join_qr_desc'), 'var(--green)', () => go('join', { mode: 'offline' })),
    h('div', { class: 'card' }, h('div', { class: 'row' }, ic('wifi'), h('h3', {}, t('offline_req_title'))), h('p', { class: 'small dim', style: { marginTop: '6px' } }, t('offline_req'))),
  ];
  return [screen(topbar(m === 'online' ? t('online') : t('offline'), { back: () => go('mode', {}) }), ...body), navbar('home')];
};
const cardBtn = (icon, title, desc, color, fn) => h('button', { class: 'card modecard', style: { '--role': color, textAlign: 'start' }, onclick: fn },
  h('div', { class: 'big' }, ic(icon, 'lg')), h('div', { class: 'grow' }, h('h3', {}, title), h('div', { class: 'small dim' }, desc)));

let pub = { rooms: null, at: 0 };
function publicRooms() {
  const box = h('div', { class: 'col' }, h('h3', {}, t('public_rooms')));
  const draw = () => {
    box.replaceChildren(h('div', { class: 'row between' }, h('h3', {}, t('public_rooms')), h('button', { class: 'iconbtn', onclick: refresh, 'aria-label': 'refresh' }, ic('reset'))));
    if (!pub.rooms) return box.append(h('div', { class: 'center' }, h('div', { class: 'spinner', style: { margin: '10px auto' } })));
    if (!pub.rooms.length) return box.append(h('div', { class: 'card center dim small' }, t('no_public_rooms')));
    pub.rooms.forEach((r) => box.append(h('button', { class: 'prow', style: { textAlign: 'start' }, onclick: async (e) => { await act(e.currentTarget, { t: 'room:join', key: r.code }); } },
      h('div', { class: 'grow' }, h('div', { class: 'bold num' }, '#' + r.code), h('div', { class: 'small dim' }, r.auto ? t('auto_room') : t('narrator') + ': ' + (r.host || '-'))),
      h('span', { class: 'chip' }, ic('users', 'sm'), h('span', { class: 'num' }, `${r.players}/${r.max}`)))));
  };
  const refresh = async () => { try { pub = { rooms: (await api('/api/rooms/public')).rooms, at: Date.now() }; } catch { pub.rooms = []; } draw(); };
  draw(); if (!pub.rooms || Date.now() - pub.at > 4000) refresh();
  return box;
}

// قائمة الأصدقاء (6)
export const friends = () => {
  const F = S.friends; const u = S.user;
  const addInput = h('input', { class: 'input code', id: 'addid', inputmode: 'numeric', maxlength: 8, placeholder: '12345678' });
  const add = async (e) => { const id = addInput.value.trim(); if (!id) return; const r = await act(e.currentTarget, { t: 'friend:request', uid: id }); if (r) { addInput.value = ''; toast(t('request_sent'), 'ok'); } };
  const row = (f, actions) => h('div', { class: 'prow' }, avatar(f), h('div', { class: 'grow' }, h('div', { class: 'nm' }, f.name), h('div', { class: 'tiny dim' }, h('span', { class: 'num' }, 'ID ' + f.uid), ' · ', f.inRoom ? t('in_room') : f.online ? t('online_now') : t('offline_now'))), actions);
  return [screen(topbar(t('nav_friends')),
    h('div', { class: 'card accent', style: { '--role': 'var(--blue)' } }, h('div', { class: 'small dim' }, t('my_id')),
      h('div', { class: 'row between' }, h('div', { class: 'code-big', style: { fontSize: '30px', letterSpacing: '4px' } }, u.uid),
        h('div', { class: 'row' }, h('button', { class: 'iconbtn', onclick: () => copyText(u.uid), 'aria-label': t('copy') }, ic('copy')), h('button', { class: 'iconbtn', onclick: () => shareId(u), 'aria-label': t('share') }, ic('share'))))),
    h('div', { class: 'card col' }, h('h3', {}, t('add_friend')), h('div', { class: 'row' }, h('div', { class: 'grow' }, addInput), h('button', { class: 'btn blue', onclick: add }, ic('plus'), t('add')))),
    F.incoming.length ? h('div', { class: 'col' }, h('h3', {}, t('requests'), ' ', h('span', { class: 'chip role', style: { '--role': 'var(--gold)' } }, F.incoming.length)),
      F.incoming.map((f) => row(f, h('div', { class: 'row gap6' }, h('button', { class: 'iconbtn', style: { color: 'var(--green)' }, onclick: (e) => act(e.currentTarget, { t: 'friend:accept', userId: f.id }), 'aria-label': t('accept') }, ic('check')),
        h('button', { class: 'iconbtn', style: { color: 'var(--red)' }, onclick: (e) => act(e.currentTarget, { t: 'friend:decline', userId: f.id }), 'aria-label': t('decline') }, ic('x')))))) : null,
    h('div', { class: 'col' }, h('h3', {}, t('my_friends'), ' ', h('span', { class: 'dim num' }, F.friends.length)),
      F.friends.length ? [...F.friends].sort((a, b) => b.online - a.online).map((f) => row(f, h('button', { class: 'iconbtn', onclick: async () => { if (await confirmBox(t('remove_friend'), f.name, t('remove'))) act(null, { t: 'friend:remove', userId: f.id }); } }, ic('x')))) : h('div', { class: 'card center dim small' }, t('no_friends'))),
    F.outgoing.length ? h('div', { class: 'col' }, h('h3', {}, t('sent_requests')), F.outgoing.map((f) => row(f, h('span', { class: 'chip' }, t('pending'))))) : null,
  ), navbar('friends')];
};
async function shareId(u) {
  const text = t('share_text', { id: u.uid });
  if (navigator.share) { try { await navigator.share({ text }); return; } catch { return; } }
  copyText(text);
}

// الملف الشخصي (7)
async function pickAvatar(file) {
  const bmp = await createImageBitmap(file); const s = Math.min(bmp.width, bmp.height); const c = document.createElement('canvas'); c.width = c.height = 256;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256);
  return c.toDataURL('image/jpeg', .82);
}
const FRAMES = { none: 1, gold: 1, crimson: 3, emerald: 5, royal: 8, neon: 12 };
export const profile = () => {
  const u = S.user; const L = xpBar(u);
  const file = h('input', { type: 'file', accept: 'image/*', class: 'hide', onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { const r = await api('/api/me', { method: 'PATCH', body: { avatar: await pickAvatar(f) } }); S.user = r.user; notify(); toast(t('saved'), 'ok'); } catch (x) { fail(x.message); } } });
  const nameIn = h('input', { class: 'input', id: 'pname', value: u.name, maxlength: 24 });
  const lvl = 1 + Math.floor(Math.sqrt(u.xp / 50));
  return [screen(topbar(t('nav_profile'), { right: h('button', { class: 'iconbtn', onclick: () => go('settings') }, ic('gear')) }),
    h('div', { class: 'col', style: { alignItems: 'center' } }, h('button', { onclick: () => file.click(), style: { position: 'relative' }, 'aria-label': t('change_photo') }, avatar(u, 'xl'), h('span', { class: 'iconbtn', style: { position: 'absolute', bottom: '-4px', insetInlineEnd: '-4px', width: '34px', height: '34px' } }, ic('camera', 'sm'))), file,
      h('div', { class: 'row', style: { width: '100%' } }, h('div', { class: 'grow' }, nameIn), h('button', { class: 'btn blue', onclick: async (e) => { try { const r = await api('/api/me', { method: 'PATCH', body: { name: nameIn.value } }); S.user = r.user; notify(); toast(t('saved'), 'ok'); } catch (x) { fail(x.message); } } }, t('save')))),
    L,
    h('div', { class: 'card row between' }, h('div', {}, h('div', { class: 'small dim' }, t('my_id')), h('div', { class: 'bold num', style: { fontSize: '22px', letterSpacing: '3px' } }, u.uid)),
      h('div', { class: 'row' }, h('button', { class: 'iconbtn', onclick: () => copyText(u.uid) }, ic('copy')), h('button', { class: 'iconbtn', onclick: () => shareId(u) }, ic('share')))),
    h('div', { class: 'grid3' }, [[u.points, 'points'], [u.matches, 'matches'], [u.wins, 'wins']].map(([n, k]) => h('div', { class: 'card stat' }, h('b', { class: 'num' }, n), h('span', {}, t(k))))),
    h('div', { class: 'card col' }, h('h3', {}, t('avatar_frame')), h('div', { class: 'row wrap' }, Object.entries(FRAMES).map(([f, need]) => {
      const locked = lvl < need; return h('button', { class: 'col', style: { alignItems: 'center', gap: '4px', opacity: locked ? .45 : 1 }, onclick: async () => { if (locked) return toast(t('frame_locked', { n: need }), 'err'); try { const r = await api('/api/me', { method: 'PATCH', body: { frame: f } }); S.user = r.user; notify(); } catch (x) { fail(x.message); } } },
        avatar({ ...u, frame: f }, 'sm'), h('span', { class: 'tiny ' + (u.frame === f ? 'bold' : 'dim') }, locked ? '🔒 ' + need : t('frame_' + f)));
    }))),
    h('div', { class: 'grid2' }, h('button', { class: 'btn', onclick: () => go('stats') }, ic('list'), t('stats')), h('button', { class: 'btn', onclick: () => go('achievements') }, ic('star'), t('achievements'))),
    h('button', { class: 'btn danger block', onclick: async () => { if (await confirmBox(t('logout'), t('logout_confirm'), t('logout'))) { try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* غير متصل */ } dropSession(); go('login'); } } }, ic('out'), t('logout')),
  ), navbar('profile')];
};

// قائمة أفضل اللاعبين
export const leaderboard = () => {
  const d = cached('lb', () => api('/api/leaderboard'), 8000);
  const medal = ['var(--gold)', 'var(--silver)', '#cd7f32'];
  return [screen(topbar(t('leaderboard')), !d ? h('div', { class: 'center' }, h('div', { class: 'spinner', style: { margin: '30px auto' } }))
    : d.rows.length ? d.rows.map((r, i) => h('div', { class: 'prow' + (r.id === S.user.id ? ' me' : '') },
      h('b', { class: 'num', style: { width: '28px', textAlign: 'center', color: i < 3 ? medal[i] : 'var(--dim)' } }, i + 1), avatar(r, 'sm'),
      h('div', { class: 'grow' }, h('div', { class: 'nm' }, r.name), h('div', { class: 'tiny dim' }, `${r.wins} ${t('wins')} · ${r.matches} ${t('matches')}`)), h('b', { class: 'num' }, r.points)))
      : h('div', { class: 'card center dim' }, t('no_data_yet'))), navbar('home')];
};
