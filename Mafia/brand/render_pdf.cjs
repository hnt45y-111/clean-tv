// يطبع brand/guidelines.html إلى PDF بمقاس A4 (210×297 مم). التشغيل من مجلد Mafia: node brand/render_pdf.cjs
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, 'guidelines.html'), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  await p.pdf({ path: path.resolve(__dirname, 'MAFIA-GAME-Visual-Identity-Guidelines.pdf'), width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
