import { h, ic, toast, raw } from '../dom.js';
import { t, err } from '../i18n.js';
import { S, saveToken, notify } from '../store.js';
import { api, connect } from '../net.js';
import { go, screen } from './common.js';
import { logoArt } from '../art.js';

async function done(r) { saveToken(r.token); S.user = r.user; connect(); go('home'); }
function form(fields, submitLabel, onSubmit, extra) {
  const msg = h('div', { class: 'err', id: 'formerr' });
  const inputs = Object.fromEntries(fields.map((f) => [f.name, h('input', { class: 'input' + (f.cls ? ' ' + f.cls : ''), id: 'f_' + f.name, type: f.type || 'text', autocomplete: f.ac, placeholder: f.ph || '', maxlength: f.max, inputmode: f.mode })]));
  const btn = h('button', { class: 'btn primary lg block', type: 'submit' }, submitLabel);
  const el = h('form', { class: 'col', onsubmit: async (e) => { e.preventDefault(); msg.textContent = ''; btn.disabled = true;
    try { await onSubmit(Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value]))); } catch (x) { msg.textContent = err(x.message); } btn.disabled = false; } },
    fields.map((f) => h('div', { class: 'field' }, h('label', { for: 'f_' + f.name }, f.label), inputs[f.name])), msg, btn, extra);
  return el;
}
const hero = (sub) => h('div', { class: 'hero' }, logoArt(), h('div', { class: 'logo' }, 'مافيا'), h('div', { class: 'dim' }, sub));

function googleBtn() {
  if (!S.cfg.googleClientId) return null;
  const box = h('div', { class: 'center', style: { minHeight: '44px' } });
  const init = () => { window.google.accounts.id.initialize({ client_id: S.cfg.googleClientId, callback: async (resp) => { try { done(await api('/api/auth/google', { method: 'POST', body: { idToken: resp.credential } })); } catch (x) { toast(err(x.message), 'err'); } } });
    window.google.accounts.id.renderButton(box, { theme: 'filled_black', size: 'large', shape: 'pill', width: 280, locale: 'ar' }); };
  if (window.google?.accounts) setTimeout(init); else { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = init; s.onerror = () => box.remove(); document.head.append(s); }
  return box;
}
const divider = () => h('div', { class: 'row dim small' }, h('div', { class: 'grow', style: { height: '1px', background: 'var(--faint)' } }), t('or'), h('div', { class: 'grow', style: { height: '1px', background: 'var(--faint)' } }));

// الوضع المحلي (هاتف الراوي خادم): الاسم فقط
const localLogin = () => [screen(hero(S.cfg.isHost ? t('local_host_tagline') : t('local_tagline')),
  h('div', { class: 'card small dim center' }, S.cfg.isHost ? t('local_host_note') : t('local_player_note')),
  form([{ name: 'name', label: t('your_name'), max: 24, ac: 'nickname' }], t('continue'), async (v) => done(await api('/api/auth/guest', { method: 'POST', body: v }))))];

// تسجيل الدخول (2)
export const login = () => S.cfg.local ? localLogin() : [screen(hero(t('tagline')),
  form([{ name: 'email', label: t('email'), type: 'email', ac: 'email', cls: 'ltr' }, { name: 'password', label: t('password'), type: 'password', ac: 'current-password', cls: 'ltr' }], t('login'),
    async (v) => done(await api('/api/auth/login', { method: 'POST', body: v })),
    h('button', { type: 'button', class: 'btn ghost sm', onclick: () => go('forgot') }, t('forgot_password'))),
  googleBtn(), divider(),
  h('div', { class: 'grid2' }, h('button', { class: 'btn', onclick: () => go('register') }, t('create_account')), h('button', { class: 'btn', onclick: () => go('guest') }, ic('user'), t('guest'))))];

// إنشاء حساب (3)
export const register = () => [screen(h('div', { class: 'top' }, h('button', { class: 'iconbtn', onclick: () => go('login') }, ic('chev')), h('h2', {}, t('create_account'))),
  form([{ name: 'name', label: t('player_name'), max: 24, ac: 'nickname' }, { name: 'email', label: t('email'), type: 'email', ac: 'email', cls: 'ltr' }, { name: 'password', label: t('password_hint'), type: 'password', ac: 'new-password', cls: 'ltr' }], t('create_account'),
    async (v) => done(await api('/api/auth/register', { method: 'POST', body: v }))), googleBtn())];

export const guest = () => [screen(h('div', { class: 'top' }, h('button', { class: 'iconbtn', onclick: () => go('login') }, ic('chev')), h('h2', {}, t('guest'))),
  h('div', { class: 'card small dim' }, t('guest_note')),
  form([{ name: 'name', label: t('player_name'), max: 24 }], t('continue'), async (v) => done(await api('/api/auth/guest', { method: 'POST', body: v })))) ];

// استعادة كلمة المرور
export const forgot = () => {
  const stage = S.params.stage || 'ask';
  const head = h('div', { class: 'top' }, h('button', { class: 'iconbtn', onclick: () => go('login') }, ic('chev')), h('h2', {}, t('forgot_password')));
  if (stage === 'ask') return [screen(head, h('p', { class: 'dim' }, t('forgot_desc')),
    form([{ name: 'email', label: t('email'), type: 'email', cls: 'ltr' }], t('send_code'), async (v) => { await api('/api/auth/forgot', { method: 'POST', body: v }); toast(t('code_sent'), 'ok'); go('forgot', { stage: 'reset', email: v.email }); }))];
  return [screen(head, h('p', { class: 'dim' }, t('reset_desc', { email: S.params.email })),
    form([{ name: 'code', label: t('reset_code'), cls: 'code', max: 6, mode: 'numeric' }, { name: 'password', label: t('new_password'), type: 'password', cls: 'ltr', ac: 'new-password' }], t('reset_password'),
      async (v) => { await api('/api/auth/reset', { method: 'POST', body: { email: S.params.email, ...v } }); toast(t('password_changed'), 'ok'); go('login'); }))];
};
