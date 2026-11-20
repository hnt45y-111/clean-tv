import { h, icon, n, nice, empty, field, opts, toast, modal, confirmBox, seal, ago, fmtDate, fmtTime, nail, spinner } from '../dom.js';
import { get, post, put, S, setToken, loadMe, loadMeta } from '../api.js';
import { page, tabbar, sectionTitle } from '../layout.js';
import { ticket } from './patient.js';

// ---------- التنبيهات ----------
export async function notificationsScreen() {
  const [nt, rem] = await Promise.all([get('/notifications'), S.user.role === 'patient' ? get('/reminders') : { reminders: [] }]);
  post('/notifications/read').then(() => { S.unread = 0; });
  const hm = new Date(Date.now() + 3 * 3600e3).toISOString().slice(11, 16);
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  return h('div', {}, page({ title: 'التنبيهات', back: true, bell: false },
    perm === 'default' ? h('div', { class: 'card col' }, h('b', {}, 'فعّل تنبيهات الدواء والمراجعة'), h('div', { class: 'small muted' }, 'التنبيه يوصلك وقت كل جرعة والتطبيق مفتوح أو بالخلفية.'), h('button', { class: 'btn block', onClick: async () => { await Notification.requestPermission(); location.reload(); } }, 'فعّل')) : null,
    rem.reminders.length ? [sectionTitle('تنبيهات اليوم'), h('div', { class: 'list' }, rem.reminders.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00')).map((r) => h('div', { class: 'card dr-line ' + (r.type === 'dose' ? 'brick' : '') + ((r.time && r.time < hm) ? ' muted' : '') },
      h('div', { class: 'row between' }, h('b', {}, r.title), r.time ? h('span', { class: 'badge brick' }, fmtTime(r.time)) : h('span', { class: 'badge lapis' }, fmtDate(r.date))), h('div', { class: 'small' }, nice(r.body)))))] : null,
    sectionTitle('الإشعارات'),
    nt.notifications.length ? h('div', { class: 'list' }, nt.notifications.map((x) => h('a', { class: 'card tap dr-line ' + ({ urgent: 'fired', request: 'brick', lab: 'teal', rx: 'palm', reward: 'brick' }[x.kind] || ''), href: x.link || '#/notifications', style: 'color:inherit;display:block' },
      h('div', { class: 'row between' }, h('b', {}, nice(x.title)), h('span', { class: 'small muted' }, ago(x.created))), x.body ? h('div', { class: 'small' }, nice(x.body)) : null))) : empty('ماكو إشعارات', 'كل شي هادي')));
}

// ---------- المكافآت والإحالة ----------
export async function rewardsScreen() {
  const r = await get('/rewards');
  const link = `${location.origin}/#/register?ref=${r.refcode}`;
  return h('div', {}, page({ title: 'مكافآتي', back: '#/home' },
    h('div', { class: 'card row' }, h('div', { style: 'font-family:var(--kufi-d);font-size:56px;color:var(--lapis);line-height:1' }, n(r.points)), h('div', {}, h('b', {}, 'نقطة'), h('div', { class: 'small muted' }, 'كل حجز +١٠ · كل ١٠٠٠ دينار دواء +١'))),
    sectionTitle('ادعُ صديق'),
    h('div', { class: 'card col' }, h('div', {}, 'كودك: ', h('b', { class: 'latin', style: 'font-size:20px;letter-spacing:2px' }, r.refcode)), h('div', { class: 'small muted' }, `انت تاخذ ١٠٠ نقطة، وصديقك ٥٠ نقطة. دعيت ${n(r.invited)} لحد الآن.`),
      h('button', { class: 'btn brick block', onClick: async () => { try { if (navigator.share) await navigator.share({ title: 'دكتورنا', text: `سجّل بدكتورنا بكودي ${r.refcode}`, url: link }); else { await navigator.clipboard.writeText(link); toast('اننسخ الرابط'); } } catch {} } }, icon('share', 20), 'شارك الرابط')),
    sectionTitle('استبدل نقاطك بكوبون'),
    h('div', { class: 'list' }, r.tiers.map((t) => h('div', { class: 'card row' }, h('div', { class: 'grow' }, h('b', {}, `خصم ${n(t.percent)}٪`), h('div', { class: 'small muted' }, `${n(t.cost)} نقطة · على مشتريات الأدوية`)), h('button', { class: 'btn small', disabled: r.points < t.cost, onClick: async () => { try { const c = await post('/rewards/redeem', { cost: t.cost }); toast('كوبونك: ' + c.code); location.reload(); } catch (e) { toast(e.message, true); } } }, 'استبدل')))),
    r.coupons.length ? [sectionTitle('كوبوناتي'), h('div', { class: 'list' }, r.coupons.map((c) => h('div', { class: 'card row between' }, h('b', { class: 'latin', style: 'letter-spacing:2px' }, c.code), h('span', { class: 'badge ' + (c.used ? '' : 'palm') }, c.used ? 'مستخدم' : `خصم ${n(c.percent)}٪`))))] : null,
    r.log.length ? [sectionTitle('سجل النقاط'), h('div', { class: 'card' }, h('table', { class: 'tbl' }, h('tbody', {}, r.log.map((l) => h('tr', {}, h('td', {}, l.reason), h('td', { class: 'latin' }, (l.delta > 0 ? '+' : '') + l.delta))))))] : null), tabbar('#/home'));
}

// ---------- المساعد الصوتي ----------
export function voiceScreen() {
  const log = h('div', { class: 'list' });
  const input = h('input', { placeholder: 'أو اكتب الأمر هنا', onKeydown: (e) => e.key === 'Enter' && run(input.value) });
  const say = (who, text) => log.prepend(h('div', { class: 'bubble ' + (who === 'me' ? 'me' : '') }, nice(text)));
  const speak = (t) => { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'ar'; speechSynthesis.speak(u); } catch {} };
  const run = async (text) => {
    text = text.trim(); if (!text) return; input.value = ''; say('me', text);
    try {
      const r = await post('/voice', { text });
      say('app', r.reply); speak(r.reply);
      if (r.needs_confirm) {
        const ok = h('button', { class: 'btn small palm', onClick: async () => { ok.parentNode.remove(); const x = await post('/voice', { text, execute: true }).catch((e) => ({ reply: e.message })); say('app', x.reply); speak(x.reply); } }, 'أكّد');
        log.prepend(h('div', { class: 'row' }, ok, h('button', { class: 'btn small ghost', onClick: (e) => e.currentTarget.parentNode.remove() }, 'لا')));
      }
    } catch (e) { say('app', e.message); }
  };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  const mic = h('button', { class: 'mic', 'aria-label': 'تحدّث', onClick: () => {
    if (!SR) return toast('متصفحك ما يدعم التعرف على الصوت، اكتب الأمر', true);
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'ar-IQ'; rec.interimResults = false;
    rec.onresult = (e) => run(e.results[0][0].transcript); rec.onend = () => { rec = null; mic.classList.remove('live'); }; rec.onerror = () => toast('ما سمعتك، جرّب مرة ثانية', true);
    mic.classList.add('live'); rec.start();
  } }, icon('mic', 48));
  const ex = ['احجزلي عند الدكتور سلام يوم الأحد الساعة ٥', 'ألغي حجزي', 'أجّل حجزي ليوم السبت', 'ضيفلي تنبيه حبة پنادول ٣ مرات باليوم ٥ أيام', 'شنو رقم دوري', 'متى موعد مراجعتي'];
  return h('div', {}, page({ title: 'المساعد الصوتي', sub: 'حچي وأنا أنفّذ', back: '#/home' },
    h('div', { class: 'card col', style: 'text-align:center' }, mic, h('div', { class: 'small muted' }, SR ? 'اضغط وحچي' : 'اكتب الأمر بالأسفل'), input),
    log,
    sectionTitle('جرّب تگول'), h('div', { class: 'list' }, ex.map((t) => h('button', { class: 'card tap', style: 'text-align:start;width:100%;cursor:pointer', onClick: () => run(t) }, '«' + t + '»'))),
    h('div', { class: 'card small muted' }, h('b', { style: 'color:var(--bitumen)' }, 'Siri ومساعد گوگل: '), 'أنشئ اختصارًا (Shortcuts أو Routines) يرسل نص الأمر إلى ', h('span', { class: 'latin' }, 'POST /api/voice'), ' برمز دخولك. الربط المباشر بصوت «يا گوگل» بدون فتح التطبيق يحتاج نسخة الأندرويد/آيفون الأصلية.')), tabbar('#/home'));
}

// ---------- ملفي / الإعدادات ----------
export async function meScreen() {
  const meta = await loadMeta();
  const u = S.user;
  const name = h('input', { value: u.name }), area = h('select', {}, opts(meta.areas, u.area, 'المنطقة'));
  const roleLabel = { patient: 'مريض', doctor: 'طبيب', pharmacy: 'صيدلية', lab: 'مختبر', secretary: 'سكرتير', admin: u.is_owner ? 'مالك التطبيق' : 'أدمن' }[u.role];
  const admins = u.role === 'patient' ? (await get('/admins')).admins : [];
  const PLAY = 'https://play.google.com/store/apps/details?id=iq.doctorna.app';
  return h('div', {}, page({ title: u.name, sub: roleLabel, back: false },
    h('div', { class: 'card form' }, field('الاسم', name), field('المنطقة', area),
      h('div', { class: 'small muted latin', style: 'text-align:start' }, u.phone),
      h('button', { class: 'btn block', onClick: async () => { try { await put('/me', { name: name.value, area: area.value }); await loadMe(); toast('انحفظ'); location.reload(); } catch (e) { toast(e.message, true); } } }, 'احفظ')),
    u.role === 'doctor' ? h('a', { class: 'btn brick block', href: '#/doctor/settings' }, icon('clock', 20), 'دوامي وإعدادات العيادة') : null,
    ['pharmacy', 'lab'].includes(u.role) ? h('a', { class: 'btn brick block', href: '#/pharmacy/settings' }, icon('edit', 20), 'ملف ' + (u.role === 'lab' ? 'المختبر' : 'الصيدلية')) : null,
    u.role === 'patient' ? [
      h('a', { class: 'card tap row', href: '#/rewards', style: 'color:inherit' }, icon('gift', 24), h('div', { class: 'grow' }, h('b', {}, 'مكافآتي'), h('div', { class: 'small muted' }, `${n(u.points)} نقطة`)), h('i', { class: 'chev' })),
      h('div', { class: 'card row' }, h('div', { class: 'grow' }, h('b', {}, 'الاشتراك'), h('div', { class: 'small muted' }, 'المشتركون ينشرون بالمنتدى بدون انتظار موافقة')), h('button', { class: 'btn small ' + (u.subscribed ? 'ghost' : ''), onClick: async () => { await post('/me/subscribe', { on: !u.subscribed }); await loadMe(); location.reload(); } }, u.subscribed ? 'مشترك ✓' : 'اشترك')),
      h('a', { class: 'card tap row', href: '#/voice', style: 'color:inherit' }, icon('mic', 24), h('div', { class: 'grow' }, h('b', {}, 'المساعد الصوتي')), h('i', { class: 'chev' })),
    ] : null,
    admins.length ? [sectionTitle('قيّم الإدارة'), h('div', { class: 'list' }, admins.map((a) => h('div', { class: 'card row between' }, h('b', {}, a.name), h('button', { class: 'btn small ghost', onClick: async () => { const { rateModal } = await import('./patient.js'); rateModal('admin', a.id, a.name); } }, 'قيّم'))))] : null,
    h('a', { class: 'btn ghost block', href: PLAY, target: '_blank', rel: 'noopener' }, icon('star', 20), 'قيّم التطبيق على گوگل پلي'),
    h('button', { class: 'btn fired block', onClick: async () => { try { await post('/logout'); } catch {} setToken(null); S.user = null; location.hash = '#/login'; } }, icon('logout', 20), 'تسجيل خروج')), tabbar('#/me'));
}
