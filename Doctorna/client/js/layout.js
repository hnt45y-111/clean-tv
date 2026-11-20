import { h, icon, nail } from './dom.js';
import { S } from './api.js';

export const TABS = {
  patient: [['#/home', 'الرئيسية', 'home'], ['#/bookings', 'حجوزاتي', 'cal'], ['#/forum', 'المنتدى', 'forum'], ['#/me', 'ملفي', 'user']],
  doctor: [['#/doctor', 'اليوم', 'cal'], ['#/messages', 'الرسائل', 'chat'], ['#/forum', 'المنتدى', 'forum'], ['#/me', 'ملفي', 'user']],
  secretary: [['#/doctor', 'اليوم', 'cal'], ['#/me', 'ملفي', 'user']],
  pharmacy: [['#/pharmacy', 'الطلبات', 'pharm'], ['#/pharmacy/sell', 'بيع', 'pill'], ['#/forum', 'المنتدى', 'forum'], ['#/me', 'ملفي', 'user']],
  lab: [['#/lab', 'الطلبات', 'lab'], ['#/forum', 'المنتدى', 'forum'], ['#/me', 'ملفي', 'user']],
  admin: [['#/admin', 'الإدارة', 'shield'], ['#/forum', 'المنتدى', 'forum'], ['#/me', 'ملفي', 'user']],
};

// ترويسة لازورد بحافة مائلة ٩° + جسم الصفحة
export function page({ title, sub, back, actions = [], bell = true }, ...content) {
  const hdr = h('header', { class: 'hdr' },
    h('div', { class: 'row' },
      back ? h('button', { class: 'back', 'aria-label': 'رجوع', onClick: () => (typeof back === 'string' ? (location.hash = back) : history.back()) }, icon('back')) : null,
      h('div', { class: 'grow' }, h('h1', {}, title), sub ? h('div', { class: 'sub' }, sub) : null),
      ...actions,
      bell && S.user ? h('a', { class: 'ico-btn', href: '#/notifications', 'aria-label': 'التنبيهات', style: 'color:var(--clay)' }, icon('bell'), S.unread ? h('span', { class: 'dot' }, String(S.unread > 9 ? '٩+' : S.unread).replace(/\d/, (d) => '٠١٢٣٤٥٦٧٨٩'[d])) : null) : null));
  const body = h('main', { class: 'page' }, ...content);
  return h('div', { class: 'view' }, hdr, body);
}

export function tabbar(current) {
  const tabs = TABS[S.user?.role] || [];
  return h('nav', { class: 'tabbar' }, tabs.map(([href, label, ic]) => h('a', { href, class: current === href || (href !== '#/home' && current.startsWith(href) && href.length > 7) ? 'on' : '' }, icon(ic, 24), label)));
}

export const sectionTitle = (text, link) => h('div', { class: 'sec-title' }, nail(), h('span', { class: 'grow' }, text), link ? h('a', { href: link[0] }, link[1]) : null);
