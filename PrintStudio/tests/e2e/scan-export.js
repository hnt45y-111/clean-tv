const P=require('path').join(__dirname,'..','..')+'/'; const {start}=require(P+'tools/devserver'); const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
const SH=require('os').tmpdir()+'/ps-shots-';  const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1;};
(async()=>{
  const s=await start({port:5181}); const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1366,height:820}});
  const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  const post=(o)=>fetch(s.url+'__picks',{method:'POST',body:JSON.stringify(o)}).then(r=>r.json());
  await pg.goto(s.url); await pg.waitForSelector('.printer-i'); await pg.click('.printer-i >> nth=0'); await pg.click('#w-add'); await pg.waitForSelector('.overlay',{state:'detached'});
  await pg.click('[data-act=scanner-pick]'); await pg.waitForSelector('.printer-i'); await pg.click('.printer-i >> nth=0'); await pg.waitForTimeout(500);
  await post({scan:['letter','table','letter']});
  await pg.click('[data-act=start]'); await pg.waitForSelector('.th'); await pg.click('[data-act=another]'); await pg.waitForFunction(()=>document.querySelectorAll('.th').length===2); await pg.click('[data-act=another]'); await pg.waitForFunction(()=>document.querySelectorAll('.th').length===3);
  ok(await pg.locator('[data-act=another]').first().isVisible(),'زر مسح صفحة أخرى ظاهر في الأعلى');
  // إعادة ترتيب بالسحب: اسحب الثالثة قبل الأولى
  const ids0=await pg.$$eval('.th',e=>e.map(x=>x.dataset.id));
  await pg.dragAndDrop('.th >> nth=2','.th >> nth=0'); await pg.waitForTimeout(600);
  const ids1=await pg.$$eval('.th',e=>e.map(x=>x.dataset.id)); ok(ids1[0]===ids0[2]&&ids1[1]===ids0[0],'إعادة الترتيب بالسحب والإفلات');
  // تدوير وحذف
  await pg.click('[data-act=rot-r]'); await pg.waitForTimeout(500);
  await pg.click('.th >> nth=1'); await pg.click('[data-act=delete]'); await pg.click('[data-ok]'); await pg.waitForFunction(()=>document.querySelectorAll('.th').length===2); ok(true,'حذف صفحة');
  await pg.screenshot({path:SH+'10-ws.png'});
  // تصدير
  await pg.click('[data-act=export]'); await pg.waitForSelector('#x-name'); await pg.screenshot({path:SH+'11-export.png'});
  await pg.fill('#x-name','تقرير التدريب.pdf'); await pg.click('#x-fmt [data-f=pdf]'); await pg.click('#x-go');
  await pg.waitForSelector('.toast.ok'); const files=fs.readdirSync(s.picks.folder); console.log(files); ok(files.includes('تقرير التدريب.pdf'),'ملف PDF باسم صحيح بدون تكرار الامتداد');
  ok(s.core.settings.get('save.dir')===s.picks.folder,'مكان الحفظ تذكّره الإعدادات');
  // تصدير ثانٍ PNG بدون اختيار مجلد
  await pg.click('[data-act=export]'); await pg.waitForSelector('#x-name'); ok((await pg.textContent('#x-dir')).includes('exports'),'المجلد المحفوظ يُستعمل تلقائياً');
  await pg.fill('#x-name','صورة'); await pg.click('#x-fmt [data-f=png]'); await pg.click('#x-go'); await pg.waitForFunction(()=>document.querySelectorAll('.toast.ok').length>=1); await pg.waitForTimeout(800);
  ok(fs.readdirSync(s.picks.folder).some(f=>/^صورة-\d\.png$/.test(f)),'تصدير PNG مرقّم');
  console.log('ERRS',JSON.stringify(errs));
  await b.close(); await s.close();
})().catch(e=>{console.log('FAIL',e.stack);process.exit(1)});
