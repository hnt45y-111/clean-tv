// يرسم نسخ الشعار إلى PNG بخلفية شفافة. التشغيل (من مجلد Mafia): node brand/render_logo.cjs
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 2400, height: 2400 } });
  const url = 'file://' + path.resolve(__dirname, 'logo.html');
  for (const v of ['primary', 'horizontal', 'mark', 'wordmark', 'mono']) {
    await p.goto(url + '#' + v); await p.reload(); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    const el = p.locator('#v-' + v); await el.screenshot({ path: path.resolve(__dirname, `logo/mafia-logo-${v}.png`), omitBackground: true });
  }
  await p.goto(url + '?dark#primary'); await p.reload(); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  await p.locator('#v-primary').screenshot({ path: path.resolve(__dirname, 'logo/mafia-logo-primary-on-dark.png') });
  await b.close();
})();
