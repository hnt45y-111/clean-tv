// بيانات البداية: قاعدة الأدوية، حساب المالك، وحسابات تجريبية (DOCTORNA_DEMO=1 أو npm run seed)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, one, run, now, DB_PATH } from './db.js';
import { hashPass, nameKey, refCode, addDays, today } from './util.js';
import { defaultSchedule, createBooking, addPoints } from './logic.js';
import { randomBytes } from 'node:crypto';

// [الاسم الإنگليزي, العربي, الشكل, التركيز, السعر بالدينار]
const DRUGS = [
  ['Panadol', 'بنادول', 'حبوب', '500mg', 1500], ['Paracetamol', 'باراسيتامول', 'حبوب', '500mg', 750], ['Brufen', 'بروفين', 'حبوب', '400mg', 2000], ['Ibuprofen', 'إيبوبروفين', 'حبوب', '400mg', 1500],
  ['Aspirin', 'أسبرين', 'حبوب', '100mg', 1000], ['Augmentin', 'أوگمنتين', 'حبوب', '1g', 9500], ['Amoxicillin', 'أموكسيسيلين', 'كبسول', '500mg', 3500], ['Azithromycin', 'أزيثروميسين', 'حبوب', '500mg', 6500],
  ['Ciprofloxacin', 'سيبروفلوكساسين', 'حبوب', '500mg', 4000], ['Metronidazole', 'ميترونيدازول', 'حبوب', '500mg', 2000], ['Cefixime', 'سيفكسيم', 'كبسول', '400mg', 8000], ['Doxycycline', 'دوكسي سايكلين', 'كبسول', '100mg', 3000],
  ['Metformin', 'ميتفورمين', 'حبوب', '500mg', 2500], ['Glucophage', 'گلوكوفاج', 'حبوب', '850mg', 4500], ['Gliclazide', 'گليكلازايد', 'حبوب', '80mg', 3500], ['Insulin Mixtard', 'إنسولين ميكستارد', 'حقنة', '100IU/ml', 15000],
  ['Amlodipine', 'أملوديبين', 'حبوب', '5mg', 2500], ['Concor', 'كونكور', 'حبوب', '5mg', 6000], ['Lisinopril', 'ليزينوبريل', 'حبوب', '10mg', 3000], ['Losartan', 'لوسارتان', 'حبوب', '50mg', 4000],
  ['Atorvastatin', 'أتورفاستاتين', 'حبوب', '20mg', 5000], ['Clopidogrel', 'كلوبيدوگريل', 'حبوب', '75mg', 5500], ['Furosemide', 'فيوروسيمايد', 'حبوب', '40mg', 1500], ['Warfarin', 'وارفارين', 'حبوب', '5mg', 3000],
  ['Omeprazole', 'أوميبرازول', 'كبسول', '20mg', 3000], ['Nexium', 'نيكسيوم', 'حبوب', '40mg', 12000], ['Domperidone', 'دومبيريدون', 'حبوب', '10mg', 2500], ['Buscopan', 'بسكوبان', 'حبوب', '10mg', 3500],
  ['Loperamide', 'لوبيراميد', 'كبسول', '2mg', 2000], ['ORS', 'محلول الجفاف', 'شراب', 'كيس', 500], ['Ventolin', 'ڤنتولين', 'بخاخ', '100mcg', 5500], ['Symbicort', 'سيمبيكورت', 'بخاخ', '160/4.5', 38000],
  ['Montelukast', 'مونتيلوكاست', 'حبوب', '10mg', 9000], ['Prednisolone', 'بريدنيزولون', 'حبوب', '5mg', 2000], ['Dexamethasone', 'ديكساميثازون', 'حقنة', '8mg', 1500], ['Cetirizine', 'سيتريزين', 'حبوب', '10mg', 2000],
  ['Loratadine', 'لوراتادين', 'حبوب', '10mg', 2000], ['Telfast', 'تيلفاست', 'حبوب', '120mg', 9000], ['Vitamin D3', 'فيتامين د٣', 'حبوب', '50000IU', 4000], ['Vitamin C', 'فيتامين سي', 'حبوب', '1000mg', 3000],
  ['Ferrous Sulfate', 'حديد', 'حبوب', '200mg', 2500], ['Folic Acid', 'حامض الفوليك', 'حبوب', '5mg', 1000], ['Calcium + D', 'كالسيوم مع د', 'حبوب', '600mg', 6000], ['Zinc', 'زنك', 'كبسول', '50mg', 4000],
  ['Bisolvon', 'بيزولفون', 'شراب', '8mg/5ml', 4500], ['Mucosolvan', 'موكوسولفان', 'شراب', '30mg/5ml', 6000], ['Cough Syrup', 'شراب كحة', 'شراب', '120ml', 3500], ['Strepsils', 'ستريبسلز', 'حبوب', 'مص', 3000],
  ['Voltaren', 'ڤولتارين', 'حقنة', '75mg', 2500], ['Voltaren Gel', 'ڤولتارين جل', 'مرهم', '1%', 7000], ['Diclofenac', 'ديكلوفيناك', 'حبوب', '50mg', 2000], ['Tramadol', 'ترامادول', 'كبسول', '50mg', 3500],
  ['Fusidic Acid', 'فيوسيديك أسيد', 'مرهم', '2%', 5000], ['Clotrimazole', 'كلوتريمازول', 'مرهم', '1%', 3500], ['Betamethasone', 'بيتاميثازون', 'مرهم', '0.1%', 4500], ['Hydrocortisone', 'هيدروكورتيزون', 'مرهم', '1%', 3500],
  ['Chloramphenicol Eye Drops', 'قطرة عين كلورامفينيكول', 'قطرة', '0.5%', 2500], ['Tobradex', 'توبراديكس', 'قطرة', '0.3%', 9500], ['Artificial Tears', 'دموع صناعية', 'قطرة', '0.3%', 6000], ['Otrivin', 'أوتريفين', 'قطرة', '0.1%', 3500],
  ['Levothyroxine', 'ليفوثايروكسين', 'حبوب', '100mcg', 4000], ['Sertraline', 'سيرترالين', 'حبوب', '50mg', 6000], ['Diazepam', 'ديازيبام', 'حبوب', '5mg', 2500], ['Gabapentin', 'گابابنتين', 'كبسول', '300mg', 7000],
  ['Pantoprazole', 'بانتوبرازول', 'حبوب', '40mg', 5500], ['Ranitidine', 'رانتيدين', 'حبوب', '150mg', 2000], ['Lactulose', 'لاكتيولوز', 'شراب', '10g/15ml', 6000], ['Rennie', 'ريني', 'حبوب', 'مص', 2500],
];

export function seedDrugs() {
  if (one('SELECT COUNT(*) n FROM drugs').n > 0) return;
  for (const d of DRUGS) run('INSERT INTO drugs(name_en,name_ar,form,strength,price) VALUES(?,?,?,?,?)', ...d);
}

export function ensureBootstrap() {
  seedDrugs();
  if (!one(`SELECT id FROM users WHERE is_owner=1`)) {
    const pass = process.env.OWNER_PASSWORD || randomBytes(6).toString('hex');
    const phone = process.env.OWNER_PHONE || '07700000001';
    const { salt, hash } = hashPass(pass);
    run(`INSERT INTO users(role,phone,name,name_key,pass_hash,salt,is_owner,verified,subscribed,refcode,created) VALUES('admin',?,?,?,?,?,1,1,1,?,?)`, phone, 'مالك دكتورنا', nameKey('مالك دكتورنا'), hash, salt, refCode(), now());
    if (!process.env.OWNER_PASSWORD && DB_PATH !== ':memory:') {
      const f = resolve(dirname(DB_PATH), 'OWNER.txt');
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, `هاتف المالك: ${phone}\nكلمة السر: ${pass}\n(غيّرها بتحديد OWNER_PASSWORD قبل أول تشغيل)\n`);
      console.log(`تم إنشاء حساب المالك — البيانات بالملف ${f}`);
    }
  }
  if (process.env.DOCTORNA_DEMO === '1') seedDemo();
}

function mk(role, phone, name, extra = {}) {
  const ex = one('SELECT id FROM users WHERE phone=?', phone); if (ex) return ex.id;
  const { salt, hash } = hashPass('123456');
  const r = run(`INSERT INTO users(role,phone,name,name_key,pass_hash,salt,area,verified,refcode,doctor_id,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, role, phone, name, nameKey(name), hash, salt, extra.area || '', extra.verified ? 1 : 0, refCode(), extra.doctor_id ?? null, now());
  return Number(r.lastInsertRowid);
}

// حسابات تجريبية (كلمة السر لكلها 123456) — أسماء افتراضية للتجربة فقط
export function seedDemo() {
  if (one(`SELECT id FROM users WHERE phone='07701110001'`)) return;
  const docs = [
    ['07701110001', 'سلام حسن علي', 'باطنية', 'الكرادة', 'شارع ٦٠، قرب ساحة الواثق', 33.3 , 44.42, 14, 12, 15000],
    ['07701110002', 'زينب كاظم محمد', 'أطفال', 'المنصور', 'مجمع المنصور الطبي', 33.31, 44.35, 20, 10, 20000],
    ['07701110003', 'أحمد جاسم صالح', 'عظام', 'الأعظمية', 'الأعظمية، شارع الإمام الأعظم', 33.36, 44.38, 12, 15, 25000],
    ['07701110004', 'نور الهدى عباس', 'نسائية وتوليد', 'زيونة', 'زيونة، قرب مول بغداد', 33.33, 44.45, 16, 15, 20000],
    ['07701110005', 'حيدر رزاق حميد', 'سكري وغدد صماء', 'البصرة', 'البصرة، العشار', 30.51, 47.81, 18, 10, 15000],
  ];
  docs.forEach(([ph, n, sp, ar, ad, lat, lng, cap, avg, price], i) => {
    const id = mk('doctor', ph, 'د. ' + n, { area: ar, verified: i !== 4 });
    run('INSERT OR IGNORE INTO doctors(user_id,specialty,area,address,lat,lng,bio,capacity,avg_minutes,price,license,license_pending) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, sp, ar, ad, lat, lng, `طبيب ${sp} — حساب تجريبي.`, cap, avg, price, 'LIC-' + (1000 + i), i === 4 ? 1 : 0);
    defaultSchedule(id);
  });
  const pharms = [
    ['07702220001', 'صيدلية الشفاء', 'pharmacy', 'الكرادة', 'الكرادة داخل، قرب الجامع', 1, 0, '٩ صباحًا – ١١ مساءً'],
    ['07702220002', 'صيدلية الرافدين', 'pharmacy', 'المنصور', 'شارع الأميرات', 1, 0, '٨ صباحًا – ١٠ مساءً'],
    ['07702220003', 'صيدلاني جوّال — علي', 'mobile', 'الأعظمية', 'يتنقل بين مناطق بغداد', 1, 1, '٤ عصرًا – ١٠ مساءً'],
  ];
  for (const [ph, t, kind, ar, ad, del, hv, hrs] of pharms) {
    const id = mk('pharmacy', ph, t, { area: ar });
    run('INSERT OR IGNORE INTO pharmacies(user_id,title,kind,area,address,delivers,home_visit,hours,staff,work_method,prices_note) VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, t, kind, ar, ad, del, hv, hrs, 'صيادلة مجازون', 'استلام من الصيدلية أو توصيل للبيت', 'الأسعار حسب منصة التسعير');
  }
  const lab = mk('lab', '07703330001', 'مختبر النهرين', { area: 'الكرادة' });
  run(`INSERT OR IGNORE INTO pharmacies(user_id,title,kind,area,address) VALUES(?,?,'lab',?,?)`, lab, 'مختبر النهرين', 'الكرادة', 'الكرادة، شارع ٦٠');
  const sec = one(`SELECT id FROM users WHERE phone='07701110001'`).id;
  mk('secretary', '07704440001', 'سكرتيرة د. سلام', { doctor_id: sec });
  const pat = mk('patient', '07705550001', 'علي حسين كاظم', { area: 'الكرادة' });
  addPoints(pat, 120, 'هدية تجريبية');
  mk('patient', '07705550002', 'فاطمة أحمد جاسم', { area: 'المنصور' });
  mk('admin', '07700000002', 'أدمن تجريبي');
  // مدونة ونصائح مزمنة للتجربة
  const d1 = one(`SELECT id FROM users WHERE phone='07701110001'`).id;
  run(`INSERT INTO posts(user_id,kind,topic,title,body,status,created) VALUES(?,'chronic','السكري','السكّري مرض مزمن يمكن التعايش معه',?,'published',?)`, d1, 'الالتزام بالعلاج وقياس السكر بانتظام وتقليل السكريات والنشويات والمشي نص ساعة باليوم يخلّي حياتك طبيعية. راجع طبيبك كل ثلاثة أشهر.', now());
  run(`INSERT INTO posts(user_id,kind,topic,title,body,status,created) VALUES(?,'chronic','الضغط','الضغط والملح',?,'published',?)`, d1, 'قلّل الملح بالأكل والمخللات، وقيس ضغطك بالبيت مرتين بالأسبوع، ولا توقف الدواء من نفسك حتى لو انضبط الضغط.', now());
  run(`INSERT INTO posts(user_id,kind,topic,title,body,status,created) VALUES(?,'blog','',?,?,'published',?)`, d1, 'متى أروح للطوارئ؟', 'ألم الصدر المفاجئ، ضيق النفس الشديد، فقدان الوعي، نزيف ما يتوقف، أو ضعف مفاجئ بجانب من الجسم — هذي كلها حالات لا تنتظر حجز.', now());
  // حجز تجريبي للمريض
  let d = today(); for (let i = 0; i < 8; i++, d = addDays(d, 1)) { try { createBooking({ doctorId: d1, patientId: pat, name: 'علي حسين كاظم', phone: '07705550001', date: d }); break; } catch {} }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.env.DOCTORNA_DEMO = '1';
  ensureBootstrap();
  console.log('تم تجهيز البيانات التجريبية. كلمة السر لكل الحسابات التجريبية: 123456');
  console.log('مريض 07705550001 · طبيب 07701110001 · سكرتيرة 07704440001 · صيدلية 07702220001 · مختبر 07703330001');
}
