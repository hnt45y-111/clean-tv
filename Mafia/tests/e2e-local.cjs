// E2E للوضع المحلي (هاتف الراوي خادم): الراوي من 127.0.0.1، واللاعبون من عنوان شبكة آخر كأنهم أجهزة أخرى.
// التشغيل: خادم DevMain على المنفذ PORT (LAN_IP=<عنوان الحاوية>)، ثم: LAN_IP=… PORT=… OUT=./shots/ node tests/e2e-local.cjs
const { chromium } = require('playwright');
const OUT = process.env.OUT || './shots/'; require('fs').mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 3500; const LAN = process.env.LAN_IP;
const HOST = `http://127.0.0.1:${PORT}`; const REMOTE = `http://${LAN}:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const errs = [];
(async () => {
  const b = await chromium.launch({ args: ['--proxy-server=direct://'] }); // اتصال مباشر بالشبكة المحلية
  const page = async (name, url) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
    await ctx.addInitScript(() => { try { localStorage.setItem('mafia.prefs', JSON.stringify({ lite: true })); } catch {} });
    const p = await ctx.newPage(); p.setDefaultTimeout(5000);
    p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); }); p.on('pageerror', (e) => errs.push(name + ' PAGEERR ' + e.message));
    await p.goto(url); await p.waitForTimeout(1500); return { name, p };
  };
  const shot = (u, n) => u.p.screenshot({ path: OUT + n + '.png' });
  const st = (u) => u.p.evaluate(() => { const R = window.__mafia.S.room; return R ? { status: R.status, phase: R.match?.phase, role: R.match?.me?.role, alive: R.match?.me?.alive, key: R.joinKey, n: R.members.length } : null; });
  const login = async (u, name) => { await u.p.fill('#f_name', name); await u.p.click('button[type=submit]'); await sleep(900); };

  const N = await page('الراوي', HOST + '/'); await shot(N, 'L01-host-login'); await login(N, 'أبو علي'); await shot(N, 'L02-host-home');
  await N.p.click('text=إنشاء غرفة'); await sleep(300);
  for (let i = 0; i < 3; i++) await N.p.click('.setrow:has-text("العدد الإجمالي للاعبين") button:first-child');
  await N.p.click('.setrow:has-text("عدد المافيا") button:first-child');
  await N.p.click('text=إنشاء الغرفة'); await sleep(900); await shot(N, 'L03-lobby-wifi-qr');
  await N.p.click('text=التالي: باركود الغرفة'); await sleep(400); await shot(N, 'L04-lobby-room-qr');
  const qrLink = await N.p.evaluate(() => [...document.querySelectorAll('.tiny.dim.center')].map((e) => e.textContent).join('|'));
  const key = (await st(N)).key; console.log('key', key, 'lan shown:', qrLink);
  const P = [];
  for (const n of ['سالم', 'ليلى', 'خالد', 'نور', 'ريم']) {
    const u = await page(n, `${REMOTE}/#/join/${key}`); if (!P.length) await shot(u, 'L05-player-login');
    await login(u, n); P.push(u);
  }
  await sleep(1200); console.log('members', (await st(N)).n); await shot(N, 'L06-lobby-full'); await shot(P[0], 'L07-player-lobby');
  await N.p.click('text=بدء اللعبة'); await sleep(1200);
  for (const u of P) await u.p.click('.flip'); await sleep(1000); await shot(P[0], 'L08-role');
  for (const u of P) await u.p.click('text=فهمت');
  for (let it = 0; it < 60; it++) {
    const s = await st(N); if (!s || s.phase === 'ended') break; const ph = s.phase;
    try {
      if (ph === 'roles') await N.p.click('text=ابدأ الليل');
      else if (ph === 'night') {
        await sleep(1700);
        for (const u of P) { const x = await st(u); if (!x.alive || x.role === 'citizen') continue;
          const rows = u.p.locator('.prow.pick'); if (!(await rows.count())) continue; await rows.first().click(); await u.p.locator('.btn.lg.grow').click(); }
        await sleep(500); await N.p.click('text=إنهاء الليل وإعلان النتيجة'); await sleep(300);
        if (await N.p.locator('.sheet').count()) await N.p.locator('.sheet .btn.primary').click();
      } else if (ph === 'dawn') await N.p.click('text=ابدأ النهار');
      else if (ph === 'day') { await sleep(1700); await N.p.locator('.prow.pick').first().click(); await sleep(300); if (it < 5) await shot(N, 'L09-narrator-day');
        await N.p.click('.btn.primary:has-text("بدء التصويت")'); await sleep(300); await N.p.locator('.sheet .btn.blue').click(); }
      else if (ph === 'vote') { await sleep(300);
        for (const u of P) { const x = await st(u); if (!x.alive) continue; await u.p.locator('.prow.pick').first().click(); await u.p.locator('.btn.gold').click(); }
        await sleep(400); await N.p.click('text=إغلاق التصويت وإعلان النتيجة'); }
      else if (ph === 'voteResult') { await sleep(300); await N.p.click('text=ابدأ الليل'); }
    } catch (e) { console.log('step err', ph, e.message.split('\n')[0]); await shot(N, 'Lerr'); break; }
    await sleep(500);
  }
  await sleep(1200); console.log('final', JSON.stringify(await st(N)));
  await shot(N, 'L10-end-narrator'); await shot(P[0], 'L11-end-player');
  console.log('errors:', errs); await b.close();
})();
