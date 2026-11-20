import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DOCTORNA_DB = ':memory:';
process.env.OWNER_PASSWORD = 'owner-pass';
const { createApp } = await import('../src/server.js');
const { ensureBootstrap } = await import('../src/seed.js');
const { today, addDays, weekday } = await import('../src/util.js');

let server, base;
before(async () => {
  ensureBootstrap();
  server = createApp();
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function api(method, path, body, tok) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  return { ...j, status: r.status };
}
const ok = async (...a) => { const r = await api(...a); assert.equal(r.status, 200, `${a[0]} ${a[1]} → ${r.status} ${r.error}`); return r; };
const reg = (role, phone, name, extra = {}) => ok('POST', '/api/register', { role, phone, name, password: '123456', ...extra });

// أول يوم دوام للطبيب (لازم ما يكون الجمعة الافتراضية عطلة)
let workDay = addDays(today(), 1); while (weekday(workDay) === 5) workDay = addDays(workDay, 1);
const ctx = {};

test('تسجيل الأطباء والمرضى والتحقق من الاسم الثلاثي', async () => {
  const bad = await api('POST', '/api/register', { role: 'patient', phone: '07711111111', name: 'علي حسين', password: '123456' });
  assert.equal(bad.status, 400);
  ctx.doc = await reg('doctor', '07712340001', 'د. كريم نوري', { specialty: 'باطنية', area: 'الكرادة', license: 'L-1' });
  ctx.pharm = await reg('pharmacy', '07712340002', 'صيدلية الأمل', { title: 'صيدلية الأمل', area: 'الكرادة' });
  ctx.lab = await reg('lab', '07712340003', 'مختبر الحياة', { title: 'مختبر الحياة', area: 'الكرادة' });
  ctx.doctorId = ctx.doc.user.id;
  const dup = await api('POST', '/api/register', { role: 'patient', phone: '07712340001', name: 'علي حسين كاظم', password: '123456' });
  assert.equal(dup.status, 409);
});

test('الطبيب غير الموثّق ما يظهر له توثيق، والأدمن يوثّقه', async () => {
  const list = await ok('GET', '/api/doctors');
  assert.equal(list.doctors.find((d) => d.id === ctx.doctorId).verified, false);
  const owner = await ok('POST', '/api/login', { phone: '07700000001', password: 'owner-pass' });
  ctx.owner = owner.token;
  const ov = await ok('GET', '/api/admin/overview', null, ctx.owner);
  assert.ok(ov.pending_doctors.some((d) => d.id === ctx.doctorId));
  await ok('POST', '/api/admin/verify', { user_id: ctx.doctorId }, ctx.owner);
  assert.equal((await ok('GET', '/api/doctors')).doctors.find((d) => d.id === ctx.doctorId).verified, true);
  const forbidden = await api('GET', '/api/admin/overview', null, ctx.doc.token);
  assert.equal(forbidden.status, 403);
});

test('الدوام: يوم عطلة ما ينحجز، وإجازة تمنع الحجز', async () => {
  await ok('PUT', '/api/doctor/profile', { capacity: 2, avg_minutes: 10 }, ctx.doc.token);
  const p = await reg('patient', '07713330001', 'سارة علي حسن');
  ctx.p1 = p;
  let fri = today(); while (weekday(fri) !== 5) fri = addDays(fri, 1);
  const r = await api('POST', '/api/bookings', { doctor_id: ctx.doctorId, date: fri }, p.token);
  assert.equal(r.status, 400); assert.match(r.error, /مو موجود/);
  const lv = addDays(workDay, 1); // نضيف إجازة ليوم بعد
  await ok('POST', '/api/doctor/leaves', { from_date: lv, to_date: lv, note: 'سفر' }, ctx.doc.token);
  if (weekday(lv) !== 5) assert.equal((await api('POST', '/api/bookings', { doctor_id: ctx.doctorId, date: lv }, p.token)).status, 400);
});

test('الأرقام التسلسلية، اكتمال العدد، وموافقة الطبيب', async () => {
  const p2 = await reg('patient', '07713330002', 'محمد جواد كريم'), p3 = await reg('patient', '07713330003', 'هدى سالم ناصر');
  Object.assign(ctx, { p2, p3 });
  const b1 = await ok('POST', '/api/bookings', { doctor_id: ctx.doctorId, date: workDay }, ctx.p1.token);
  const b2 = await ok('POST', '/api/bookings', { doctor_id: ctx.doctorId, date: workDay }, p2.token);
  assert.equal(b1.booking.seq, 1); assert.equal(b2.booking.seq, 2);
  assert.match(b1.booking.code, /^DR-\d{4}-\d{4}$/);
  assert.equal(b2.booking.ahead, 1); assert.equal(b2.booking.eta_minutes, 10);
  const dup = await api('POST', '/api/bookings', { doctor_id: ctx.doctorId, date: workDay }, ctx.p1.token);
  assert.equal(dup.status, 400);
  const b3 = await ok('POST', '/api/bookings', { doctor_id: ctx.doctorId, date: workDay }, p3.token);
  assert.equal(b3.booking.status, 'pending'); assert.equal(b3.booking.seq, 0);
  const q1 = await ok('GET', `/api/doctor/queue?date=${workDay}`, null, ctx.doc.token);
  assert.equal(q1.pending.length, 1);
  const acc = await ok('POST', `/api/doctor/bookings/${b3.booking.id}/decide`, { action: 'accept' }, ctx.doc.token);
  assert.equal(acc.booking.status, 'confirmed'); assert.equal(acc.booking.seq, 3);
  ctx.b = [b1.booking, b2.booking, acc.booking];
  // إلغاء يفرغ مقعد ويعاد استعماله
  await ok('POST', `/api/bookings/${b2.booking.id}/cancel`, {}, p2.token);
  const p4 = await reg('patient', '07713330004', 'ليث عادل فاضل');
  const b4 = await api('POST', '/api/bookings', { doctor_id: ctx.doctorId, date: workDay }, p4.token);
  assert.equal(b4.booking.status, 'pending'); // 1 و 3 فعّالين = 2 = السعة
});

test('رفض الطلب وتأجيله', async () => {
  const q = await ok('GET', `/api/doctor/queue?date=${workDay}`, null, ctx.doc.token);
  const pend = q.pending[0];
  const rej = await ok('POST', `/api/doctor/bookings/${pend.id}/decide`, { action: 'reject' }, ctx.doc.token);
  assert.equal(rej.booking.status, 'rejected');
});

test('الباركود: تسجيل حضور، وطبيب ثاني ما يگدر', async () => {
  // نقدّم تاريخ اليوم: نحجز مريض لليوم الحالي إن كان دوام
  const sec = await ok('POST', '/api/doctor/secretary', { name: 'سكرتير الدكتور', phone: '07714440001', password: '123456' }, ctx.doc.token);
  ctx.sec = (await ok('POST', '/api/login', { phone: '07714440001', password: '123456' })).token;
  const w = await api('POST', '/api/doctor/walkin', { name: 'حسن عبد الله جبار', phone: '07715550001', date: workDay }, ctx.sec);
  assert.equal(w.status, 200);
  ctx.walk = w.booking;
  assert.equal(w.booking.source, 'clinic'); assert.ok(w.booking.seq >= 1);
  // الحضور مسموح فقط بيوم الحجز؛ نجرّب بيوم غير اليوم → خطأ واضح
  if (workDay !== today()) { const r = await api('POST', '/api/doctor/checkin', { code: w.booking.code }, ctx.sec); assert.equal(r.status, 400); assert.match(r.error, /ليوم/); }
  const otherDoc = await reg('doctor', '07712340009', 'د. ثاني', { specialty: 'عيون' });
  const r2 = await api('POST', '/api/doctor/checkin', { code: w.booking.code }, otherDoc.token);
  assert.ok([400, 403].includes(r2.status));
  const sec2 = await api('POST', '/api/doctor/special', { seq: 1, name: 'x y z', phone: '07715550002' }, ctx.sec);
  assert.equal(sec2.status, 403); // السكرتير ما يسوّي حالة خاصة
});

test('الحالة الخاصة بشرط أن صاحب الرقم كمّل', async () => {
  const first = ctx.b[0];
  const early = await api('POST', '/api/doctor/special', { seq: first.seq, name: 'رقم مكرر الخامس', phone: '07715550003', date: workDay }, ctx.doc.token);
  assert.equal(early.status, 400);
});

test('ربط سجل مراجع سجّله الطبيب بحسابه الجديد (نفس الاسم الثلاثي والهاتف)', async () => {
  const acc = await reg('patient', '07715550001', 'حسن عبد الله جبار');
  const my = await ok('GET', '/api/bookings', null, acc.token);
  assert.equal(my.bookings.length, 1);
  assert.equal(my.bookings[0].code, ctx.walk.code);
  ctx.walkTok = acc.token;
});

test('ملف طبي: زيارة، علاج للصيدلية، بيع، تنبيهات وتحميل الملف', async () => {
  const pf = await ok('GET', `/api/doctor/patient?booking_id=${ctx.walk.id}`, null, ctx.doc.token);
  assert.equal(pf.patient.has_account, true);
  await ok('POST', '/api/doctor/visit', { booking_id: ctx.walk.id, complaint: 'سعال', diagnosis: 'التهاب شعب' }, ctx.doc.token);
  const drugs = await ok('GET', '/api/drugs?q=pana', null, ctx.doc.token);
  assert.ok(drugs.drugs.length >= 1);
  const rx = await ok('POST', '/api/doctor/prescribe', { booking_id: ctx.walk.id, drug_id: drugs.drugs[0].id, times_per_day: 3, days: 5, notes: 'بعد الأكل', pharmacy_id: ctx.pharm.user.id }, ctx.doc.token);
  const orders = await ok('GET', '/api/pharmacy/orders', null, ctx.pharm.token);
  assert.equal(orders.orders.length, 1);
  assert.equal((await ok('GET', '/api/reminders', null, ctx.walkTok)).reminders.filter((r) => r.type === 'dose').length, 0); // لسه ما انباع
  const sale = await ok('POST', `/api/pharmacy/orders/${rx.id}/sell`, {}, ctx.pharm.token);
  assert.ok(sale.amount > 0); assert.equal(sale.platform.mode, 'local');
  const rem = await ok('GET', '/api/reminders', null, ctx.walkTok);
  assert.equal(rem.reminders.filter((r) => r.type === 'dose').length, 3);
  const file = await ok('GET', '/api/file', null, ctx.walkTok);
  assert.equal(file.file.visits.length, 1); assert.equal(file.file.prescriptions[0].status, 'sold'); assert.equal(file.file.prescriptions[0].received_date, today());
  const rewards = await ok('GET', '/api/rewards', null, ctx.walkTok);
  assert.ok(rewards.points >= 1);
});

test('طلب تحليل ونتيجته تصل للطبيب والمريض', async () => {
  const l = await ok('POST', '/api/doctor/lab', { booking_id: ctx.walk.id, test: 'CBC', lab_id: ctx.lab.user.id }, ctx.doc.token);
  const orders = await ok('GET', '/api/lab/orders', null, ctx.lab.token);
  assert.equal(orders.orders[0].test, 'CBC');
  await ok('POST', `/api/lab/orders/${l.id}/result`, { result: 'WBC 7.2 · Hb 13.5' }, ctx.lab.token);
  const file = await ok('GET', '/api/file', null, ctx.walkTok);
  assert.equal(file.file.labs[0].status, 'ready');
  const n = await ok('GET', '/api/notifications', null, ctx.doc.token);
  assert.ok(n.notifications.some((x) => x.title.includes('نتيجة')));
});

test('المراسلة: تحتاج موافقة الطبيب', async () => {
  const c = await ok('POST', '/api/chats', { doctor_id: ctx.doctorId }, ctx.walkTok);
  const early = await api('POST', `/api/chats/${c.chat.id}/messages`, { body: 'سلام' }, ctx.walkTok);
  assert.equal(early.status, 400);
  await ok('POST', `/api/chats/${c.chat.id}/decide`, { accept: true }, ctx.doc.token);
  await ok('POST', `/api/chats/${c.chat.id}/messages`, { body: 'عندي ألم' }, ctx.walkTok);
  await ok('POST', `/api/chats/${c.chat.id}/messages`, { body: 'تشخيص مبدئي: التهاب', kind: 'diagnosis' }, ctx.doc.token);
  const m = await ok('GET', `/api/chats/${c.chat.id}/messages`, null, ctx.walkTok);
  assert.equal(m.messages.length, 2); assert.equal(m.messages[1].kind, 'diagnosis');
  const spoof = await ok('POST', `/api/chats/${c.chat.id}/messages`, { body: 'أنا دكتور', kind: 'diagnosis' }, ctx.walkTok);
  assert.equal((await ok('GET', `/api/chats/${c.chat.id}/messages`, null, ctx.walkTok)).messages[2].kind, 'text');
  const x = await reg('patient', '07716660001', 'غريب عن الدكتور');
  assert.equal((await api('GET', `/api/chats/${c.chat.id}/messages`, null, x.token)).status, 403);
});

test('التقييم يتطلب مراجعة فعلية', async () => {
  const x = await reg('patient', '07716660002', 'ثالث رابع خامس');
  assert.equal((await api('POST', '/api/ratings', { type: 'doctor', target_id: ctx.doctorId, stars: 5 }, x.token)).status, 400);
  await ok('POST', `/api/doctor/bookings/${ctx.walk.id}/done`, {}, ctx.doc.token);
  const r = await ok('POST', '/api/ratings', { type: 'doctor', target_id: ctx.doctorId, stars: 4, comment: 'ممتاز' }, ctx.walkTok);
  assert.equal(r.rating.avg, 4);
  const again = await ok('POST', '/api/ratings', { type: 'doctor', target_id: ctx.doctorId, stars: 5 }, ctx.walkTok);
  assert.equal(again.rating.count, 1); assert.equal(again.rating.avg, 5);
});

test('المنتدى: منشور المشترك مباشر وغيره بانتظار الأدمن، المدونة للموثّقين', async () => {
  const p = await ok('POST', '/api/posts', { kind: 'forum', title: 'سؤال', body: 'هل يصير آخذ المضاد مع الشاي؟' }, ctx.walkTok);
  assert.equal(p.post_status, 'pending');
  assert.equal((await ok('GET', '/api/posts?kind=forum')).posts.length, 0);
  const ov = await ok('GET', '/api/admin/overview', null, ctx.owner);
  await ok('POST', `/api/admin/posts/${ov.pending_posts[0].id}/decide`, { approve: true }, ctx.owner);
  assert.equal((await ok('GET', '/api/posts?kind=forum')).posts.length, 1);
  await ok('POST', '/api/me/subscribe', {}, ctx.walkTok);
  assert.equal((await ok('POST', '/api/posts', { kind: 'forum', title: 'مشترك', body: 'نص مباشر بلا موافقة' }, ctx.walkTok)).post_status, 'published');
  assert.equal((await api('POST', '/api/posts', { kind: 'blog', title: 'مقال', body: 'مرحبا بكم' }, ctx.walkTok)).status, 403);
  assert.equal((await ok('POST', '/api/posts', { kind: 'blog', title: 'مقال طبي', body: 'نص المقال الطبي' }, ctx.doc.token)).post_status, 'published');
  assert.equal((await ok('POST', '/api/posts', { kind: 'chronic', topic: 'السكري', title: 'نصيحة', body: 'نص النصيحة هنا' }, ctx.doc.token)).post_status, 'published');
});

test('الإحالة والنقاط والكوبونات', async () => {
  const me = await ok('GET', '/api/rewards', null, ctx.p1.token);
  const inv = await ok('POST', '/api/register', { role: 'patient', phone: '07717770001', name: 'مدعو جديد تجريبي', password: '123456', ref: me.refcode });
  const after = await ok('GET', '/api/rewards', null, ctx.p1.token);
  assert.equal(after.points, me.points + 100);
  assert.equal((await ok('GET', '/api/rewards', null, inv.token)).points, 50);
  assert.equal((await api('POST', '/api/rewards/redeem', { cost: 500 }, inv.token)).status, 400);
  const c = await ok('POST', '/api/rewards/redeem', { cost: 100 }, ctx.p1.token);
  assert.equal(c.percent, 5);
  // الكوبون يطبق على بيع مباشر
  const sale = await ok('POST', '/api/pharmacy/sell', { name: 'سارة علي حسن', phone: '07713330001', drug_name: 'Panadol', amount: 2000, coupon: c.code, times_per_day: 2, days: 3 }, ctx.pharm.token);
  assert.equal(sale.amount, 1900);
  assert.equal((await api('POST', '/api/pharmacy/sell', { name: 'سارة علي حسن', phone: '07713330001', drug_name: 'Panadol', amount: 2000, coupon: c.code }, ctx.pharm.token)).status, 400);
});

test('المساعد الصوتي: معاينة ثم تنفيذ حجز وإلغاءه', async () => {
  const v = await reg('patient', '07718880001', 'صوت تجريبي ثالث');
  const dayName = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][weekday(workDay)];
  const prev = await ok('POST', '/api/voice', { text: `احجزلي عند الدكتور كريم يوم ${dayName} الساعة ٥` }, v.token);
  assert.equal(prev.needs_confirm, true);
  assert.equal((await ok('GET', '/api/bookings', null, v.token)).bookings.length, 0);
  const done = await ok('POST', '/api/voice', { text: `احجزلي عند الدكتور كريم يوم ${dayName}`, execute: true }, v.token);
  assert.match(done.reply, /تم|العدد مكتمل/);
  const rem = await ok('POST', '/api/voice', { text: 'ضيفلي تنبيه حبة پنادول 3 مرات باليوم 5 ايام', execute: true }, v.token);
  assert.match(rem.reply, /تم/);
  const unk = await ok('POST', '/api/voice', { text: 'شنو الجو اليوم' }, v.token);
  assert.equal(unk.ok, false);
});

test('الأمان: بدون تسجيل دخول ممنوع، والمريض ما يشوف ملف غيره', async () => {
  assert.equal((await api('GET', '/api/bookings')).status, 401);
  assert.equal((await api('GET', `/api/doctor/patient?booking_id=${ctx.walk.id}`, null, ctx.walkTok)).status, 403);
  const other = await reg('doctor', '07712340010', 'د. ما راجعه', { specialty: 'جلدية' });
  assert.equal((await api('GET', `/api/doctor/patient?booking_id=${ctx.walk.id}`, null, other.token)).status, 404);
});
