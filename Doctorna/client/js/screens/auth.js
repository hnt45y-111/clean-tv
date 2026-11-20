import { h, field, opts, toast, icon } from '../dom.js';
import { post, S, setToken, loadMe, loadMeta } from '../api.js';

const home = () => ({ patient: '#/home', doctor: '#/doctor', secretary: '#/doctor', pharmacy: '#/pharmacy', lab: '#/lab', admin: '#/admin' }[S.user.role]);

export function splash() {
  return h('div', { class: 'splash' }, h('img', { class: 'mark', src: 'icons/mark.svg', alt: '' }), h('h1', {}, 'دكتورنا'), h('div', { class: 'tag' }, 'حكيم المحلّة، بجيبك'));
}

function shell(...kids) {
  return h('div', { class: 'auth view' },
    h('div', { class: 'top' }, h('img', { src: 'img/logo-h.png', alt: 'دكتورنا — حكيم المحلّة، بجيبك', style: 'height:auto;width:min(280px,70vw);border-radius:4px' })),
    h('div', { class: 'box' }, ...kids));
}

export function login() {
  const err = h('div', { class: 'err hide' });
  const phone = h('input', { type: 'tel', inputmode: 'numeric', placeholder: '07xxxxxxxxx', autocomplete: 'tel', dir: 'ltr', style: 'text-align:right' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', dir: 'ltr', style: 'text-align:right' });
  const go = async (e) => {
    e.preventDefault(); err.classList.add('hide');
    try { const r = await post('/login', { phone: phone.value, password: pass.value }); setToken(r.token); await loadMe(); location.hash = home(); }
    catch (x) { err.textContent = x.message; err.classList.remove('hide'); }
  };
  return shell(h('form', { class: 'card form', onSubmit: go },
    h('h2', {}, 'هال بيك'), h('div', { class: 'muted' }, 'سجّل دخولك حتى تكمل'),
    err, field('رقم الهاتف', phone), field('كلمة السر', pass),
    h('button', { class: 'btn block', type: 'submit' }, 'دخول'),
    h('a', { class: 'btn ghost block', href: '#/register' }, 'عندي حساب جديد؟ سجّل')));
}

export async function register() {
  const meta = await loadMeta();
  let role = new URLSearchParams(location.hash.split('?')[1] || '').get('role') || 'patient';
  const ref = new URLSearchParams(location.hash.split('?')[1] || '').get('ref') || '';
  const box = h('div');
  const draw = () => {
    const err = h('div', { class: 'err hide' });
    const f = {
      name: h('input', { autocomplete: 'name', placeholder: role === 'patient' ? 'الاسم الثلاثي: علي حسين كاظم' : '' }),
      phone: h('input', { type: 'tel', inputmode: 'numeric', placeholder: '07xxxxxxxxx', dir: 'ltr', style: 'text-align:right' }),
      pass: h('input', { type: 'password', autocomplete: 'new-password', dir: 'ltr', style: 'text-align:right' }),
      area: h('select', {}, opts(meta.areas, '', 'المنطقة')),
      specialty: h('select', {}, opts(meta.specialties, '', 'اختار التخصص')),
      license: h('input', { placeholder: 'رقم هوية النقابة' }),
      title: h('input', { placeholder: role === 'lab' ? 'اسم المختبر' : 'اسم الصيدلية' }),
      address: h('input', { placeholder: 'العنوان' }),
      ref: h('input', { value: ref, placeholder: 'اختياري', dir: 'ltr', style: 'text-align:right' }),
    };
    const go = async (e) => {
      e.preventDefault(); err.classList.add('hide');
      try {
        const r = await post('/register', { role, name: f.name.value, phone: f.phone.value, password: f.pass.value, area: f.area.value, specialty: f.specialty.value, license: f.license.value, title: f.title.value, address: f.address.value, ref: f.ref.value });
        setToken(r.token); await loadMe(); toast('هال بيك بدكتورنا'); location.hash = home();
      } catch (x) { err.textContent = x.message; err.classList.remove('hide'); }
    };
    box.replaceChildren(h('form', { class: 'card form', onSubmit: go },
      h('h2', {}, 'حساب جديد'),
      h('div', { class: 'seg' }, [['patient', 'مريض'], ['doctor', 'طبيب'], ['pharmacy', 'صيدلية'], ['lab', 'مختبر']].map(([r, l]) => h('button', { type: 'button', class: role === r ? 'on' : '', onClick: () => { role = r; draw(); } }, l))),
      err,
      field(role === 'patient' ? 'الاسم الثلاثي' : 'الاسم', f.name, role === 'patient' ? 'نستخدمه حتى يطلع سجلك السابق لو سجّلك الطبيب من العيادة' : null),
      field('رقم الهاتف', f.phone), field('كلمة السر', f.pass, 'ست خانات على الأقل'),
      field('المنطقة', f.area),
      role === 'doctor' ? [field('التخصص', f.specialty), field('رقم هوية النقابة', f.license, 'الإدارة تتحقق منها وتمنحك علامة «طبيب موثّق»'), field('عنوان العيادة', f.address)] : null,
      role === 'pharmacy' || role === 'lab' ? [field(role === 'lab' ? 'اسم المختبر' : 'اسم الصيدلية', f.title), field('العنوان', f.address)] : null,
      role === 'patient' ? field('كود دعوة صديق', f.ref, 'إذا عندك كود، تاخذ ٥٠ نقطة هدية') : null,
      h('button', { class: 'btn block', type: 'submit' }, 'سجّل'),
      h('a', { class: 'btn ghost block', href: '#/login' }, 'عندي حساب')));
  };
  draw();
  return shell(box);
}
