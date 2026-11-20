// اختبار شامل بمتصفح حقيقي (Playwright): مريض ← طبيب ← صيدلية ← مختبر ← إدارة
// التشغيل:  cd Doctorna && node tests/e2e.cjs   (SHOTS=مجلد لحفظ اللقطات)
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const PORT = 3400 + Math.floor(Math.random() * 300);
const B = `http://127.0.0.1:${PORT}`;
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const dbf = path.join(require('node:os').tmpdir(), `dt-e2e-${process.pid}.db`);
  const srv = spawn('node', ['src/server.js'], { cwd: path.join(__dirname, '../server'), env: { ...process.env, PORT, DOCTORNA_DB: dbf, DOCTORNA_DEMO: '1', OWNER_PASSWORD: 'owner123' }, stdio: 'ignore' });
  const b = await chromium.launch();
  const errs = [];
  const done = (code) => { srv.kill(); for (const s of ['', '-wal', '-shm']) try { fs.unlinkSync(dbf + s); } catch {} b.close().finally(() => process.exit(code)); };
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(B + '/api/meta'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
    const sessions = {};
    const open = async (key, phone, pass = '123456') => {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-IQ', permissions: ['clipboard-read', 'clipboard-write'] });
      const p = await ctx.newPage();
      p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errs.push(`${key}: ${m.text()}`));
      p.on('pageerror', (e) => errs.push(`${key} pageerror: ${e.message}`));
      p.on('dialog', (d) => d.accept());
      await p.goto(B + '/#/login');
      await p.fill('input[type=tel]', phone); await p.fill('input[type=password]', pass); await p.click('button[type=submit]');
      await p.waitForSelector('.tabbar', { timeout: 8000 }); await p.waitForTimeout(400);
      sessions[key] = p; return p;
    };
    const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(700); };
    const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };
    const txt = (p, t) => p.getByText(t, { exact: false }).first();
    const step = (m) => console.log('✔', m);

    // ===== مريض: يحجز عند طبيب ثاني =====
    const pat = await open('pat', '07705550001');
    assert.match(await pat.textContent('body'), /هال بيك يا علي/); step('دخول المريض');
    await go(pat, '#/doctors'); await shot(pat, '02-doctors');
    await pat.locator('select').nth(1).selectOption(''); await pat.waitForTimeout(600);
    await txt(pat, 'زينب كاظم').click(); await pat.waitForTimeout(800);
    await shot(pat, '03-doctor-profile');
    await pat.locator('.chip').first().click();
    await pat.getByRole('button', { name: /احجز دوري/ }).click();
    await pat.waitForURL(/#\/ticket\//); await pat.waitForTimeout(600);
    assert.ok(await pat.locator('.barcode svg').count(), 'الباركود ظاهر'); await shot(pat, '04-ticket'); step('حجز مع بطاقة وباركود');
    await go(pat, '#/bookings'); assert.equal(await pat.locator('a.card').count() >= 2, true); await shot(pat, '05-bookings');

    // ===== الطبيب: يستقبل المريض، يكتب علاج وتحليل =====
    const doc = await open('doc', '07701110001');
    // يوم أول حجز تجريبي للمريض عند د. سلام
    const bkDate = await pat.evaluate(async () => (await (await fetch('/api/bookings', { headers: { authorization: 'Bearer ' + localStorage.getItem('dt_token') } })).json()).bookings.find((x) => x.doctor_name.includes('سلام')).date);
    await go(doc, '#/doctor?date=' + bkDate); await shot(doc, '06-doctor-queue');
    assert.match(await doc.textContent('body'), /علي حسين كاظم/); step('الطبيب يشوف الطابور');
    await doc.getByRole('link', { name: 'افتح' }).first().click(); await doc.waitForTimeout(800);
    await doc.getByRole('button', { name: /تشخيص وزيارة/ }).click();
    await doc.getByPlaceholder('الشكوى').fill('سعال وحرارة'); await doc.getByPlaceholder('التشخيص').fill('التهاب حلق');
    await doc.getByRole('button', { name: 'احفظ' }).click(); await doc.waitForTimeout(600);
    await doc.getByRole('button', { name: /اكتب علاج/ }).click();
    await doc.getByPlaceholder(/اكتب اسم الدواء/).fill('pana'); await doc.waitForTimeout(700);
    await doc.locator('.modal button.card').first().click();
    await doc.locator('.modal select').nth(1).selectOption({ index: 1 });
    await shot(doc, '07-prescribe');
    await doc.getByRole('button', { name: /احفظ وأرسل/ }).click(); await doc.waitForTimeout(600);
    await doc.getByRole('button', { name: /اطلب تحليل/ }).click();
    await doc.getByPlaceholder(/CBC/).fill('CBC'); await doc.locator('.modal select').selectOption({ index: 1 });
    await doc.getByRole('button', { name: /أرسل الطلب/ }).click(); await doc.waitForTimeout(600);
    await shot(doc, '08-patient-file-doctor'); step('الطبيب: زيارة + علاج + تحليل');
    await doc.getByRole('button', { name: /خلّصت الزيارة/ }).click(); await doc.waitForTimeout(600);

    // ===== الصيدلية تبيع =====
    const ph = await open('ph', '07702220001');
    assert.match(await ph.textContent('body'), /Panadol/); await shot(ph, '09-pharmacy');
    await ph.getByRole('button', { name: 'بيع', exact: true }).first().click();
    await ph.getByPlaceholder('السعر (دينار)').fill('1500'); await ph.getByRole('button', { name: 'تأكيد البيع' }).click(); await ph.waitForTimeout(800);
    assert.match(await ph.textContent('body'), /ماكو علاجات معلّقة/); step('الصيدلية: بيع على المنصة');

    // ===== المختبر =====
    const lab = await open('lab', '07703330001');
    assert.match(await lab.textContent('body'), /CBC/);
    await lab.getByRole('button', { name: 'أدخل النتيجة' }).click(); await lab.locator('.modal textarea').fill('WBC: 7.2\nHb: 13.5');
    await lab.getByRole('button', { name: 'أرسل النتيجة' }).click(); await lab.waitForTimeout(700); step('المختبر: نتيجة');

    // ===== المريض: الملف الطبي والتنبيهات والمكافآت والصوت =====
    await go(pat, '#/file'); await shot(pat, '10-file');
    const fb = await pat.textContent('body');
    assert.match(fb, /Panadol/); assert.match(fb, /WBC: 7\.2/); assert.match(fb, /التهاب حلق/); step('الملف الطبي فيه الزيارة والدواء والتحليل');
    await go(pat, '#/notifications'); await shot(pat, '11-notifications');
    assert.match(await pat.textContent('body'), /وقت علاجك/);
    await go(pat, '#/voice');
    await pat.getByPlaceholder('أو اكتب الأمر هنا').fill('شنو رقم دوري'); await pat.keyboard.press('Enter'); await pat.waitForTimeout(700);
    await pat.getByPlaceholder('أو اكتب الأمر هنا').fill('ألغي حجزي'); await pat.keyboard.press('Enter'); await pat.waitForTimeout(700);
    assert.ok(await pat.getByRole('button', { name: 'أكّد' }).count()); await shot(pat, '12-voice'); step('المساعد الصوتي يطلب تأكيد');
    await go(pat, '#/rewards'); await shot(pat, '13-rewards'); assert.match(await pat.textContent('body'), /نقطة/);
    await go(pat, '#/pharmacies'); await txt(pat, 'صيدلية الشفاء').click(); await pat.waitForTimeout(700); await shot(pat, '14-pharmacy-profile');
    await go(pat, '#/forum?kind=chronic'); await shot(pat, '15-chronic'); assert.match(await pat.textContent('body'), /السكّري/);

    // ===== منتدى: منشور ينتظر الأدمن =====
    await go(pat, '#/forum'); await pat.getByRole('button', { name: /اكتب منشور/ }).click();
    await pat.getByPlaceholder('العنوان').fill('سؤال عن الضغط'); await pat.locator('.modal textarea').fill('شلون أنظم الضغط بالبيت؟');
    await pat.getByRole('button', { name: 'انشر' }).click(); await pat.waitForTimeout(600);

    // ===== الإدارة =====
    const adm = await open('adm', '07700000001', 'owner123'); await shot(adm, '16-admin');
    assert.match(await adm.textContent('body'), /سؤال عن الضغط/);
    await adm.getByRole('button', { name: 'انشر' }).first().click(); await adm.waitForTimeout(600);
    await adm.getByRole('button', { name: /وثّق/ }).first().click(); await adm.waitForTimeout(600); step('الإدارة: توثيق ونشر');

    // ===== تسجيل مريض جديد من الواجهة (اسم ثلاثي) =====
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const np = await ctx.newPage();
    np.on('pageerror', (e) => errs.push('reg pageerror: ' + e.message));
    await np.goto(B + '/#/register'); await np.waitForTimeout(600); await shot(np, '01-register');
    await np.getByPlaceholder(/الاسم الثلاثي/).fill('حسن عبد الله جبار'); await np.locator('input[type=tel]').fill('07709998877'); await np.locator('input[type=password]').fill('secret1');
    await np.getByRole('button', { name: 'سجّل', exact: true }).click(); await np.waitForURL(/#\/home/); step('تسجيل مريض جديد');

    // ===== السكرتير: تسجيل حضور بالرمز =====
    const code = await pat.evaluate(async () => (await (await fetch('/api/bookings', { headers: { authorization: 'Bearer ' + localStorage.getItem('dt_token') } })).json()).bookings.find((x) => x.doctor_name.includes('زينب'))?.code);
    assert.ok(code);
    await open('sec', '07704440001');
    step('دخول السكرتيرة');

    assert.deepEqual(errs, [], 'أخطاء بالمتصفح:\n' + errs.join('\n'));
    console.log('\nكل اختبارات الواجهة نجحت');
    done(0);
  } catch (e) { console.error('✖', e.message || e); if (errs.length) console.error(errs.join('\n')); done(1); }
})();
