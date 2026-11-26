const P=require('path').join(__dirname,'..','..')+'/'; const {start}=require(P+'tools/devserver'); const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path'); const sharp=require(P+'node_modules/sharp'); const JSZip=require(P+'node_modules/jszip');
const SH=require('os').tmpdir()+'/ps-shots-';  const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1;};
(async()=>{
  const s=await start({port:5183}); const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1366,height:860}}); const pg=await ctx.newPage();
  const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  const post=(o)=>fetch(s.url+'__picks',{method:'POST',body:JSON.stringify(o)}).then(r=>r.json());
  await pg.goto(s.url); await pg.waitForSelector('.printer-i'); await pg.click('.printer-i >> nth=0'); await pg.click('#w-add'); await pg.waitForSelector('.overlay',{state:'detached'});
  await pg.click('[data-act=scanner-pick]'); await pg.waitForSelector('.printer-i'); await pg.click('.printer-i >> nth=0'); await pg.waitForTimeout(400);
  // ---- الهويات
  await pg.click('[data-r=ids]'); await pg.waitForSelector('.id-wrap');
  const cardPng=async(c)=>{const f=path.join(s.dataDir,c+'.png'); await sharp({create:{width:856,height:540,channels:3,background:c}}).png().toFile(f); return f;};
  await post({scan:['letter','letter']}); await pg.click('[data-act=scan-front]'); await pg.waitForSelector('.card-t img'); await pg.click('[data-act=scan-back]'); await pg.waitForFunction(()=>document.querySelectorAll('.card-t img').length===2);
  ok(true,'مسح الوجهين الأمامي والخلفي لهوية واحدة');
  await pg.click('[data-act=new-ident]'); await post({scan:['table']}); await pg.click('[data-act=scan-front]'); await pg.waitForFunction(()=>document.querySelectorAll('.card-t img').length===3);
  await pg.click('[data-act=arrange]'); await pg.waitForSelector('.idc'); ok(await pg.locator('.idc').count()===3,'ترتيب تلقائي: 3 بطاقات على الورقة');
  const box0=await pg.locator('.idc >> nth=0').boundingBox();
  await pg.mouse.move(box0.x+box0.width/2,box0.y+box0.height/2); await pg.mouse.down(); await pg.mouse.move(box0.x+box0.width/2+120,box0.y+box0.height/2+160,{steps:8}); await pg.mouse.up();
  const box1=await pg.locator('.idc >> nth=0').boundingBox(); ok(Math.abs(box1.x-box0.x-120)<12&&Math.abs(box1.y-box0.y-160)<12,'سحب بطاقة إلى موضع جديد');
  const w0=await pg.inputValue('[data-i=w]'); const h=await pg.locator('.idc.sel .h.se').boundingBox(); await pg.mouse.move(h.x+5,h.y+5); await pg.mouse.down(); await pg.mouse.move(h.x+45,h.y+35,{steps:6}); await pg.mouse.up();
  ok(+(await pg.inputValue('[data-i=w]'))>+w0+5,'تكبير بطاقة بمقبض الزاوية ('+w0+' → '+await pg.inputValue('[data-i=w]')+')');
  await pg.fill('[data-i=rot]','20'); await pg.press('[data-i=rot]','Tab'); await pg.waitForTimeout(100);
  await pg.screenshot({path:SH+'30-ids.png'});
  await pg.click('[data-act=export]'); await pg.waitForSelector('#s-name'); await pg.fill('#s-name','هويات الموظفين'); await pg.click('#s-fmt [data-f=docx]'); await pg.click('#s-go'); await pg.waitForSelector('.toast:has-text("تم الحفظ")');
  const dx=path.join(s.picks.folder,'هويات الموظفين.docx'); ok(fs.existsSync(dx),'Word للهويات'); const xml=await (await JSZip.loadAsync(fs.readFileSync(dx))).file('word/document.xml').async('string'); ok((xml.match(/<wp:anchor/g)||[]).length===3&&xml.includes('rot='),'3 صور عائمة مستقلة + دوران في Word');
  await pg.click('[data-act=export]'); await pg.waitForSelector('#s-name'); await pg.fill('#s-name','هويات'); await pg.click('#s-fmt [data-f=pdf]'); await pg.click('#s-go'); await pg.waitForSelector('.toast:has-text("هويات.pdf")'); ok(fs.existsSync(path.join(s.picks.folder,'هويات.pdf')),'PDF للهويات');
  // ---- الإعدادات + الخلفية
  await pg.click('[data-r=settings]'); await pg.waitForSelector('.tabs'); await pg.click('[data-t=bg]');
  const bgf=path.join(s.dataDir,'bg.png'); await sharp({create:{width:2000,height:1200,channels:3,background:'#8a2be2'}}).png().toFile(bgf); await post({files:[bgf]}); await pg.click('[data-act=bg-img]'); await pg.waitForSelector('.toast:has-text("الخلفية")');
  await pg.click('[data-r=scan]'); await pg.waitForSelector('#bg'); const bgStyle=await pg.$eval('#bg',e=>e.style.backgroundImage); ok(bgStyle.includes('/file/'),'الخلفية على اللوحة الرئيسية'); await pg.screenshot({path:SH+'31-bgdash.png'});
  await pg.click('[data-r=ocr]'); await pg.waitForSelector('[data-act=scan]'); ok(await pg.locator('#bg').count()===0,'لا خلفية مخصّصة في الصفحات الأخرى');
  await pg.reload(); await pg.waitForSelector('.nav-i'); await pg.click('[data-r=scan]'); await pg.waitForSelector('#bg'); ok((await pg.$eval('#bg',e=>e.style.backgroundImage)).includes('/file/'),'الخلفية باقية بعد إعادة التحميل');
  // ---- أدوات PDF
  await pg.click('[data-r=pdf]'); await pg.waitForSelector('.tool-grid'); const mk=async(n,col)=>{const f=path.join(s.dataDir,n+'.png'); await sharp({create:{width:600,height:800,channels:3,background:col}}).png().toFile(f); return f;};
  await pg.click('[data-t=img2pdf]'); await post({files:[await mk('a','#f00'),await mk('b','#0f0'),await mk('c','#00f')]}); await pg.click('[data-act=pick]'); await pg.waitForSelector('.file-i'); await pg.fill('#on','ثلاث صور'); await pg.click('[data-act=go]'); await pg.waitForSelector('.toast:has-text("ثلاث صور.pdf")'); ok(true,'صور إلى PDF');
  const pdf=path.join(s.picks.folder,'ثلاث صور.pdf'); 
  await pg.click('[data-t=merge]'); await post({files:[pdf,pdf]}); await pg.click('[data-act=pick]'); await pg.waitForSelector('.file-i'); await pg.fill('#on','مدموج'); await pg.click('[data-act=go]'); await pg.waitForSelector('.toast:has-text("مدموج.pdf")'); ok(true,'دمج PDF');
  await pg.click('[data-t=reorder]'); await post({files:[pdf]}); await pg.click('[data-act=pick]'); await pg.waitForSelector('#tg img',{timeout:20000}); ok(await pg.locator('#tg img').count()===3,'مصغّرات الصفحات عبر pdf.js'); await pg.screenshot({path:SH+'32-pdf.png'});
  await pg.dragAndDrop('#tg [data-k="2"]','#tg [data-k="0"]'); await pg.fill('#on','معاد ترتيبه'); await pg.click('[data-act=go]'); await pg.waitForSelector('.toast:has-text("معاد ترتيبه.pdf")'); ok(true,'إعادة ترتيب الصفحات');
  await pg.click('[data-t=compress]'); await post({files:[pdf]}); await pg.click('[data-act=pick]'); await pg.waitForSelector('#tg img'); await pg.click('#cm [data-v=images]'); await pg.fill('#on','مضغوط'); await pg.click('[data-act=go]'); await pg.waitForSelector('.toast:has-text("مضغوط.pdf")',{timeout:30000}); ok(true,'ضغط PDF (صور)');
  await pg.click('[data-t=watermark]'); await post({files:[pdf]}); await pg.click('[data-act=pick]'); await pg.waitForSelector('#tg img'); await pg.fill('#on','بعلامة'); await pg.click('[data-act=go]'); await pg.waitForSelector('.toast:has-text("بعلامة.pdf")'); ok(true,'علامة مائية');
  await pg.click('[data-t=pdf2img]'); await post({files:[pdf]}); await pg.click('[data-act=pick]'); await pg.waitForSelector('#tg img'); await pg.fill('#on','صفحات'); await pg.click('[data-act=go]'); await pg.waitForSelector('.toast:has-text("ملفات")',{timeout:30000}); ok(fs.readdirSync(s.picks.folder).filter(f=>/^صفحات-\d\.png$/.test(f)).length===3,'PDF إلى صور');
  // ---- الأرشيف
  await pg.click('[data-r=archive]'); await pg.waitForSelector('#al table'); const cnt=await pg.locator('#al tbody tr').count(); ok(cnt>=8,'الأرشيف يعرض الملفات ('+cnt+')'); await pg.fill('#fq','مدموج'); await pg.waitForTimeout(500); ok(await pg.locator('#al tbody tr').count()===1,'البحث بالاسم');
  await pg.click('[data-act=pv]'); await pg.waitForSelector('.arch-pv img',{timeout:20000}); ok(true,'معاينة PDF من الأرشيف'); await pg.screenshot({path:SH+'33-archive.png'}); await pg.click('#pc');
  await pg.click('[data-act=reprint]'); await pg.waitForSelector('.pv-pages img',{timeout:20000}); ok(true,'إعادة الطباعة تفتح مركز الطباعة بالملف');
  await pg.screenshot({path:SH+'34-print.png'}); await pg.click('[data-act=print]'); await pg.waitForSelector('.file-i .pill:has-text("أُرسلت")',{timeout:30000}); ok((await post({})).printed.length===1,'طلب الطباعة وصل لخدمة الطباعة');
  await pg.click('[data-r=printers]'); await pg.waitForSelector('.printer-i'); await pg.screenshot({path:SH+'35-printers.png'}); ok(await pg.locator('.printer-i').count()===2,'عرض الطابعات');
  console.log('ERRS',JSON.stringify(errs.slice(0,6)));
  await b.close(); await s.close();
})().catch(e=>{console.log('FAIL',e.stack.split('\n').slice(0,4).join('\n'));process.exit(1)});
