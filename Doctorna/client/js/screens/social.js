import { h, icon, n, empty, field, opts, toast, modal, seal, ago, arch, nail, spinner, fmtDate } from '../dom.js';
import { get, post, S, loadMeta } from '../api.js';
import { page, tabbar, sectionTitle } from '../layout.js';

const KINDS = [['forum', 'المنتدى'], ['blog', 'المدونة'], ['chronic', 'مزمنة'], ['support', 'دعم']];
const homeTab = () => ({ patient: '#/forum', doctor: '#/forum', pharmacy: '#/forum', lab: '#/forum', admin: '#/forum' }[S.user.role] || '#/forum');

export async function forumScreen() {
  const meta = await loadMeta();
  const qs = new URLSearchParams(location.hash.split('?')[1] || '');
  let kind = qs.get('kind') || 'forum', topic = '';
  const body = h('div', { class: 'col' });
  const canExpert = S.user.role === 'admin' || (S.user.role === 'doctor' && S.user.verified);
  const draw = async () => {
    body.replaceChildren(spinner());
    const r = await get(`/posts?kind=${kind}${topic ? '&topic=' + encodeURIComponent(topic) : ''}`);
    const canWrite = kind === 'forum' || kind === 'support' || canExpert;
    body.replaceChildren(...[
      kind === 'chronic' ? h('div', { class: 'chips' }, [['', 'الكل'], ...meta.topics.map((t) => [t, t])].map(([v, l]) => h('button', { class: 'chip' + (topic === v ? ' on' : ''), onClick: () => { topic = v; draw(); } }, l))) : null,
      kind === 'support' ? h('div', { class: 'okmsg small' }, 'هنا المرضى يدعمون بعض. تذكّر: لا تبدّل رأي الطبيب.') : null,
      canWrite ? h('button', { class: 'btn block', onClick: () => compose(kind, meta, draw) }, icon('plus', 20), kind === 'blog' ? 'اكتب مقال' : kind === 'chronic' ? 'انشر نصيحة' : 'اكتب منشور') : (kind === 'blog' || kind === 'chronic' ? h('div', { class: 'hint' }, 'النشر هنا للأطباء الموثّقين.') : null),
      ...(r.posts.length ? r.posts.map((p) => h('a', { class: 'card tap col', href: '#/post/' + p.id, style: 'color:inherit' },
        h('div', { class: 'row', style: 'gap:6px' }, h('b', { style: 'font-family:var(--kufi);font-weight:600' }, p.title), p.topic ? h('span', { class: 'badge teal' }, p.topic) : null),
        h('div', { class: kind === 'blog' || kind === 'chronic' ? 'naskh' : '', style: 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;font-size:' + (kind === 'blog' || kind === 'chronic' ? '16px' : '15px') }, p.body),
        h('div', { class: 'row small muted' }, p.author, p.author_verified && p.author_role === 'doctor' ? seal(16) : null, '·', ago(p.created), '·', `${n(p.comments)} تعليق`))) : [empty('ماكو منشورات هنا بعد', 'كون أول واحد ينشر')]),
    ].filter(Boolean));
  };
  draw();
  return h('div', {}, page({ title: 'المنتدى والمدونة', back: false },
    h('div', { class: 'seg', style: 'flex-wrap:wrap' }, KINDS.map(([k, l]) => h('button', { class: kind === k ? 'on' : '', onClick: (e) => { kind = k; topic = ''; [...e.currentTarget.parentNode.children].forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); draw(); } }, l))), body), tabbar('#/forum'));
}

function compose(kind, meta, done) {
  const title = h('input', { placeholder: 'العنوان' }), text = h('textarea', { placeholder: 'اكتب هنا…', style: 'min-height:140px' });
  const topic = h('select', {}, opts(meta.topics, '', 'اختار المرض'));
  modal((close) => [h('h3', {}, 'منشور جديد'), h('div', { class: 'form' }, field('العنوان', title), kind === 'chronic' ? field('المرض', topic) : null, field('النص', text),
    !S.user.subscribed && !['admin', 'doctor'].includes(S.user.role) ? h('div', { class: 'hint' }, 'منشوراتك تنزل بعد موافقة الأدمن. المشتركون ينشرون مباشرة.') : null,
    h('button', { class: 'btn block', onClick: async () => { try { const r = await post('/posts', { kind, title: title.value, body: text.value, topic: topic.value }); close(); toast(r.post_status === 'pending' ? 'انرسل للأدمن، ينزل بعد الموافقة' : 'انتشر المنشور'); done(); } catch (e) { toast(e.message, true); } } }, 'انشر'))]);
}

export async function postScreen(id) {
  const r = await get('/posts/' + id), p = r.post;
  const list = h('div', { class: 'list' }, r.comments.map(commentEl));
  const t = h('input', { placeholder: 'اكتب تعليق' });
  return h('div', {}, page({ title: p.title, back: true },
    h('div', { class: 'card col' }, h('div', { class: 'row small muted' }, p.author, p.author_verified && p.author_role === 'doctor' ? [seal(16), 'طبيب موثّق'] : null, '·', ago(p.created)),
      h('div', { class: ['blog', 'chronic'].includes(p.kind) ? 'naskh' : '', style: 'white-space:pre-wrap' }, p.body)),
    sectionTitle('التعليقات'), list,
    h('div', { class: 'row' }, t, h('button', { class: 'btn', onClick: async () => { try { await post(`/posts/${p.id}/comments`, { body: t.value }); location.reload(); } catch (e) { toast(e.message, true); } } }, 'أرسل'))), tabbar('#/forum'));
}
const commentEl = (c) => h('div', { class: 'card' }, h('div', { class: 'row small muted' }, h('b', { style: 'color:var(--bitumen)' }, c.author), c.author_verified && c.author_role === 'doctor' ? seal(16) : null, '·', ago(c.created)), h('div', {}, c.body));

// ---------- المراسلة ----------
export async function messagesScreen() {
  const { chats } = await get('/chats');
  const isDoc = S.user.role === 'doctor';
  const label = { pending: ['بانتظار الموافقة', 'brick'], accepted: ['مفتوحة', 'palm'], declined: ['مرفوضة', 'fired'] };
  return h('div', {}, page({ title: 'الرسائل', sub: 'مراسلة خاصة مع الطبيب' },
    chats.length ? h('div', { class: 'list' }, chats.map((c) => h('a', { class: 'card tap row', href: '#/chat/' + c.id, style: 'color:inherit' }, arch(isDoc ? c.patient_name : c.doctor_name, 40, isDoc ? 'teal' : ''),
      h('div', { class: 'grow' }, h('b', {}, isDoc ? c.patient_name : c.doctor_name), h('div', { class: 'small muted', style: 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis' }, c.last_body || 'ما بعد رسائل')), h('span', { class: 'badge ' + label[c.status][1] }, label[c.status][0])))) : empty('ماكو محادثات', isDoc ? 'طلبات المراسلة من المرضى تطلع هنا' : 'افتح ملف أي طبيب واضغط «راسل الدكتور»')), tabbar('#/messages'));
}

export async function chatScreen(id) {
  const isDoc = S.user.role === 'doctor';
  const box = h('div', { class: 'chat' });
  let chat, img = null;
  const load = async () => {
    const r = await get(`/chats/${id}/messages`); chat = r.chat;
    box.replaceChildren(...r.messages.map((m) => h('div', { class: 'bubble ' + (m.sender_id === S.user.id ? 'me' : '') + (m.kind === 'diagnosis' ? ' dx' : '') },
      m.kind === 'diagnosis' ? h('div', { class: 'small', style: 'color:var(--teal);font-weight:700' }, 'تشخيص مبدئي') : null, m.body, m.image ? h('img', { src: m.image, alt: 'صورة مرفقة' }) : null)));
    status.replaceChildren(...(chat.status === 'pending' ? [isDoc ? h('div', { class: 'card col' }, h('b', {}, 'المريض طلب المراسلة'), h('div', { class: 'row' }, h('button', { class: 'btn block palm', onClick: () => decide(true) }, 'وافق'), h('button', { class: 'btn block ghost', onClick: () => decide(false) }, 'اعتذر'))) : h('div', { class: 'okmsg' }, 'بانتظار موافقة الطبيب. تنفتح المراسلة بعد ما يوافق.')] : chat.status === 'declined' ? [h('div', { class: 'err' }, 'الطبيب اعتذر عن المراسلة.')] : []));
    bar.classList.toggle('hide', chat.status !== 'accepted');
    window.scrollTo(0, document.body.scrollHeight);
  };
  const decide = async (accept) => { await post(`/chats/${id}/decide`, { accept }); load(); };
  const status = h('div');
  const text = h('input', { placeholder: 'اكتب رسالة' });
  const file = h('input', { type: 'file', accept: 'image/*', class: 'hide', onChange: async (e) => { const f = e.target.files[0]; if (!f) return; img = await shrink(f); toast('انرفقت الصورة'); } });
  const send = async (kind) => { try { await post(`/chats/${id}/messages`, { body: text.value, image: img, kind }); text.value = ''; img = null; load(); } catch (e) { toast(e.message, true); } };
  const bar = h('div', { class: 'sendbar hide' }, file, h('button', { class: 'ico-btn', 'aria-label': 'صورة', onClick: () => file.click() }, icon('cam')), text,
    isDoc ? h('button', { class: 'btn small teal', onClick: () => send('diagnosis') }, 'تشخيص') : null, h('button', { class: 'btn small', onClick: () => send('text') }, icon('send', 20)));
  load();
  return h('div', {}, page({ title: 'محادثة', back: '#/messages' }, status, box), bar);
}
async function shrink(file) {
  const bmp = await createImageBitmap(file); const s = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = bmp.width * s; c.height = bmp.height * s; c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
