// اختبار Electron حقيقي (بشاشة افتراضية xvfb على Linux). يتطلب: ELECTRON_BIN و playwright.
const { _electron } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os'); const sharp = require('sharp');
const P = path.join(__dirname, '..', '..') + '/'; const pdfkit = require(P + 'src/core/pdfkit'); const fx = require('../fixtures');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const SH = os.tmpdir() + '/ps-el-';
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'psel-')); const out = path.join(tmp, 'out'); fs.mkdirSync(out);
  const land = path.join(tmp, 'wide.png'); await sharp({ create: { width: 1400, height: 900, channels: 3, background: '#cfe8ff' } }).png().toFile(land);
  const por = path.join(tmp, 'tall.png'); fs.writeFileSync(por, await fx.letterPng());
  const pdf = path.join(tmp, 'doc.pdf'); fs.writeFileSync(pdf, await pdfkit.imagesToPdf([por, land, por], { pageSize: 'fit', searchable: [{ width: 1240, height: 1754, lines: [{ text: 'Hello Print Studio', bbox: { x0: 100, y0: 300, x1: 700, y1: 360 } }] }, null, null] }));
  const env = { ...process.env, PS_TEST_HW: P + 'tools/fakehw.js' }; delete env.NODE_OPTIONS;
  const app = await _electron.launch({ executablePath: process.env.ELECTRON_BIN || '/tmp/electron-dist/electron', args: ['--no-sandbox', '--disable-gpu', P, '--user-data-dir=' + path.join(tmp, 'ud')], env });
  const pg = await app.firstWindow(); const errs = []; pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await pg.setViewportSize({ width: 1100, height: 640 }).catch(() => {});
  const pick = (files, folder) => app.evaluate(({ dialog }, a) => { dialog.showOpenDialog = async (_w, o) => ({ canceled: false, filePaths: o.properties.includes('openDirectory') ? [a.folder] : a.files.splice(0) }); globalThis.__pk = a; }, { files, folder: folder || out });
  await pg.waitForSelector('.printer-i'); await pg.click('.printer-i >> nth=0'); await pg.click('#w-add'); await pg.waitForSelector('.overlay', { state: 'detached' });
  // 1) النقر على عناصر الرئيسية بشاشة صغيرة (1100×640)
  for (const sel of ['.hero .btn-start', '[data-act=copy]', '[data-go=pdf]']) { const b = pg.locator(sel).first(); await b.scrollIntoViewIfNeeded(); const bx = await b.boundingBox(); const hit = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest('button') && e.closest('button').outerHTML.slice(0, 60); }, [bx.x + bx.width / 2, bx.y + bx.height / 2]); ok(!!hit, 'عنصر قابل للنقر على الرئيسية: ' + sel); }
  await pg.click('[data-act=scanner-pick]'); await pg.waitForSelector('.printer-i'); await pg.click('.printer-i >> nth=0'); await pg.waitForTimeout(500);
  await pg.click('.hero .btn-start'); await pg.waitForSelector('.th', { timeout: 30000 }); ok(true, 'مسح ورقة في Electron حقيقي');
  await pg.click('[data-r=scan]').catch(() => {}); await pg.screenshot({ path: SH + 'home.png' });
  // 2) مركز الطباعة: معاينة صورة (لا تكون بيضاء) + PDF + اتجاه تلقائي
  await pg.click('[data-r=print]'); await pg.waitForSelector('[data-act=add]'); await pick([por, land, pdf]); await pg.click('[data-act=add]'); await pg.waitForSelector('.pv-pages img', { timeout: 40000 }); await pg.waitForTimeout(800);
  const imgs = await pg.$$eval('.pv-pages img', (a) => a.map((i) => ({ w: i.naturalWidth, h: i.naturalHeight })));
  ok(imgs.length === 5 && imgs.every((i) => i.w > 50 && i.h > 50), 'معاينة 5 صفحات (صورتان + PDF بـ 3) وليست فارغة: ' + JSON.stringify(imgs.map((i) => i.w + 'x' + i.h)));
  const labels = await pg.$$eval('.pv-pages .pill', (a) => a.map((x) => x.textContent)); ok(labels.filter((l) => l.includes('عرضي')).length === 2 && labels.filter((l) => l.includes('طولي')).length === 3, 'الاتجاه تلقائي حسب كل ملف: ' + labels.join(' | '));
  const shot = await pg.locator('.pv-pages img').first().screenshot(); const st = await sharp(shot).stats(); ok(st.channels[0].stdev > 8, 'محتوى المعاينة ليس أبيض فارغاً (stdev=' + st.channels[0].stdev.toFixed(1) + ')');
  await pg.selectOption('[data-o=orientation]', 'portrait'); await pg.waitForTimeout(300); ok((await pg.$$eval('.pv-pages .pill', (a) => a.every((x) => x.textContent.includes('طولي')))), 'خيار «طولي» يفرض الاتجاه'); await pg.selectOption('[data-o=orientation]', 'auto');
  await pg.screenshot({ path: SH + 'print.png' });
  // 3) قارئ PDF
  await pg.click('[data-r=reader]'); await pg.waitForSelector('[data-act=open]'); await pick([pdf]); await pg.click('.rd-empty [data-act=open]'); await pg.waitForSelector('.pgw canvas.pg', { timeout: 40000 }); await pg.waitForSelector('.textLayer span', { timeout: 20000 });
  ok((await pg.locator('.pgw').count()) === 3, 'القارئ يعرض 3 صفحات'); ok((await pg.locator('.rd-side .tn').count()) === 3, 'مصغّرات الصفحات');
  await pg.fill('#q', 'Print'); await pg.press('#q', 'Enter'); await pg.waitForSelector('.textLayer span.hl', { timeout: 20000 }); ok(true, 'البحث يظلّل النتيجة');
  const z0 = await pg.textContent('#zv'); await pg.click('[data-act=zin]'); await pg.waitForTimeout(400); ok((await pg.textContent('#zv')) !== z0, 'التكبير');
  await pg.click('[data-act=night]'); ok(await pg.locator('.pgw.night').count() === 3, 'الوضع الليلي');
  await pg.click('[data-tool=hl]'); const an = pg.locator('canvas.an').first(); const bb = await an.boundingBox(); await pg.mouse.move(bb.x + 40, bb.y + 60); await pg.mouse.down(); await pg.mouse.move(bb.x + 200, bb.y + 90, { steps: 5 }); await pg.mouse.up();
  await pg.click('[data-tool=pen]'); await pg.mouse.move(bb.x + 60, bb.y + 200); await pg.mouse.down(); await pg.mouse.move(bb.x + 160, bb.y + 230, { steps: 6 }); await pg.mouse.up();
  await pg.click('[data-act=saveann]'); await pg.waitForSelector('#s-name'); await pg.fill('#s-name', 'معلّق'); await pg.click('#s-go'); await pg.waitForSelector('.toast:has-text("تم الحفظ")', { timeout: 30000 }); ok(fs.existsSync(path.join(out, 'معلّق.pdf')), 'حفظ نسخة PDF بالتعليقات');
  await pg.screenshot({ path: SH + 'reader.png' });
  // 4) الطابعات: الأجهزة المتصلة
  await pg.click('[data-r=printers]'); await pg.waitForSelector('.printer-i'); await pg.waitForSelector('text=متصلة لكن تعريفها غير مثبّت', { timeout: 15000 }).catch(() => {}); ok((await pg.locator('text=الأجهزة المتصلة بالحاسوب').count()) === 1 && (await pg.locator('table.t td:has-text("Canon G3020")').count()) === 1, 'قائمة الأجهزة المتصلة بالحاسوب'); await pg.screenshot({ path: SH + 'printers.png' });
  // 5) الهويات: الأمامي يمين + معاينة
  await pg.click('[data-r=ids]'); await pg.waitForSelector('.id-wrap'); await pick([por]); await pg.click('[data-act=imp-front]'); await pg.waitForSelector('.card-t img'); await pick([land]); await pg.click('[data-act=imp-back]'); await pg.waitForFunction(() => document.querySelectorAll('.card-t img').length === 2);
  await pg.click('[data-act=arrange]'); await pg.waitForSelector('.idc'); const xs = await pg.$$eval('.idc', (a) => a.map((e) => ({ l: e.style.left, k: e.dataset.key }))); const f = xs.find((x) => x.k.includes(':front:')), b = xs.find((x) => x.k.includes(':back:')); ok(parseFloat(f.l) > parseFloat(b.l), 'الوجه الأمامي يمين والخلفي يسار على A4');
  await pg.selectOption('[data-p=frontSide]', 'left'); await pg.click('[data-act=arrange]'); await pg.waitForSelector('.idc'); const ys = await pg.$$eval('.idc', (a) => a.map((e) => ({ l: e.style.left, k: e.dataset.key }))); ok(parseFloat(ys.find((x) => x.k.includes(':front:')).l) < parseFloat(ys.find((x) => x.k.includes(':back:')).l), 'خيار العكس يعمل');
  await pg.click('[data-act=preview]'); await pg.waitForSelector('.modal img', { timeout: 20000 }); const nw = await pg.$eval('.modal img', (i) => i.naturalWidth); ok(nw > 500, 'معاينة ورقة A4 النهائية (' + nw + 'px)'); await pg.screenshot({ path: SH + 'ids-preview.png' });
  console.log('ERRS', JSON.stringify(errs.slice(0, 6))); ok(errs.length === 0, 'لا أخطاء في الكونسول');
  await app.close();
})().catch((e) => { console.log('FAIL', e.stack.split('\n').slice(0, 5).join('\n')); process.exit(1); });
