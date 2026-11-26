const P=require('path').join(__dirname,'..','..')+'/'; const {start}=require(P+'tools/devserver'); const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path'); const ExcelJS=require(P+'node_modules/exceljs'); const JSZip=require(P+'node_modules/jszip');
const SH=require('os').tmpdir()+'/ps-shots-';  const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c) process.exitCode=1;};
(async()=>{
  const s=await start({port:5182}); const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1366,height:860}});
  const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  const post=(o)=>fetch(s.url+'__picks',{method:'POST',body:JSON.stringify(o)}).then(r=>r.json());
  await pg.goto(s.url); await pg.waitForSelector('.printer-i'); await pg.click('.printer-i >> nth=0'); await pg.click('#w-add'); await pg.waitForSelector('.overlay',{state:'detached'});
  await pg.click('[data-act=scanner-pick]'); await pg.waitForSelector('.printer-i'); await pg.click('.printer-i >> nth=0'); await pg.waitForTimeout(500);
  await post({scan:['table']}); await pg.click('[data-act=start]'); await pg.waitForSelector('.th');
  // --- OCR: جدول
  await pg.click('[data-act=ocr]'); await pg.waitForSelector('[data-act=analyze]'); await pg.click('#mode [data-m=table]'); await pg.click('[data-act=analyze]');
  await pg.waitForSelector('.review',{timeout:120000}); await pg.screenshot({path:SH+'20-review.png'});
  await pg.click('.tab[data-t=xlsx]'); await pg.waitForSelector('.grid-ed td'); await pg.screenshot({path:SH+'21-xlsx.png'});
  ok(await pg.locator('.grid-ed td[data-r]').count()===16,'16 خلية حقيقية قابلة للتحرير');
  // تحرير خلية + إضافة صف + حذف عمود + فرز
  const cellTxt=async(r,c)=>pg.textContent(`.grid-ed td[data-r="${r}"][data-c="${c}"]`);
  await pg.click('.grid-ed td[data-r="1"][data-c="0"]'); await pg.fill('.grid-ed td[data-r="1"][data-c="0"]','علي حسن'); 
  ok((await cellTxt(0,0)).trim()==='الاسم','العمود الأول RTL هو «الاسم»');
  await pg.click('[data-g=row-below]'); await pg.waitForTimeout(100); ok(await pg.locator('.grid-ed td[data-r]').count()===20,'إضافة صف');
  await pg.click('.grid-ed td[data-r="4"][data-c="2"]'); await pg.click('[data-g=col-del]'); ok(await pg.locator('.grid-ed td[data-r]').count()===15,'حذف عمود');
  await pg.click('[data-g=sort-asc]'); await pg.waitForTimeout(200);
  await pg.click('[data-act=export]'); await pg.waitForSelector('#s-name'); await pg.fill('#s-name','موظفون'); await pg.click('#s-go'); await pg.waitForSelector('.toast:has-text("تم الحفظ")');
  const xf=path.join(s.picks.folder,'موظفون.xlsx'); ok(fs.existsSync(xf),'تم إنشاء xlsx'); const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(xf); const ws=wb.worksheets[0];
  ok(ws.rowCount===5&&ws.columnCount===3,'الجدول المعدّل: '+ws.rowCount+'×'+ws.columnCount); console.log([1,2,3,4,5].map(r=>[1,2,3].map(c=>ws.getCell(r,c).value).join('|')).join('\n'));
  // --- OCR: خطاب → Word
  await post({scan:['letter']}); await pg.click('[data-r=scan]'); await pg.waitForSelector('[data-act=another]'); await pg.click('[data-act=another]'); await pg.waitForFunction(()=>document.querySelectorAll('.th').length===2);
  await pg.click('[data-act=ocr]'); await pg.waitForSelector('[data-act=analyze]'); await pg.click('#mode [data-m=auto]'); 
  // اترك صفحة الخطاب فقط: احذف الجدول من الجلسة عبر API
  const pages=await pg.evaluate(()=>window.ps.call('pagesList')); await pg.evaluate((id)=>window.ps.call('pagesRemove',[id]),pages[0].id); await pg.reload(); await pg.waitForSelector('.nav-i'); await pg.click('[data-r=ocr]'); await pg.waitForSelector('[data-act=analyze]'); await pg.click('[data-act=analyze]');
  await pg.waitForSelector('.review',{timeout:120000}); await pg.waitForSelector('.blk'); await pg.screenshot({path:SH+'22-word.png'});
  const n0=await pg.locator('.blk').count(); await pg.click('.blk >> nth=3'); await pg.click('[data-f=add]'); ok(await pg.locator('.blk').count()===n0+1,'إضافة فقرة');
  await pg.click('.blk >> nth=0'); await pg.selectOption('#f-font','Tahoma'); await pg.fill('#f-size','26'); await pg.click('[data-f=bold]');
  await pg.click('[data-act=export]'); await pg.waitForSelector('#s-name'); await pg.fill('#s-name','خطاب رسمي'); await pg.click('#s-go'); await pg.waitForSelector('.toast:has-text("تم الحفظ")');
  const df=path.join(s.picks.folder,'خطاب رسمي.docx'); ok(fs.existsSync(df),'تم إنشاء docx'); const xml=await (await JSZip.loadAsync(fs.readFileSync(df))).file('word/document.xml').async('string');
  ok(xml.includes('<w:bidi')&&xml.includes('Tahoma')&&xml.includes('w:sz w:val="52"')&&xml.includes('فقرة جديدة')&&!xml.includes('<w:drawing>'),'DOCX: bidi + الخط والحجم المعدّلان + الفقرة المضافة');
  console.log('ERRS',JSON.stringify(errs.slice(0,5)));
  await b.close(); await s.close();
})().catch(e=>{console.log('FAIL',e.stack);process.exit(1)});
