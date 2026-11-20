const { chromium } = require('playwright');
// اختبار E2E: راوٍ + 5 لاعبين في متصفحات منفصلة يلعبون مباراة أوفلاين كاملة بالنقر، مع لقطات شاشة.
// التشغيل: خادم على المنفذ 3100 بقاعدة بيانات فارغة، ثم: OUT=./shots/ node tests/e2e.cjs (يتطلب playwright)
const OUT = process.env.OUT || './shots/'; require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:3100';
const errs = []; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const mk = async (name, hash = '') => {
    const s = await (await fetch(BASE + '/api/auth/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })).json();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
    await ctx.addInitScript((tok) => { try { localStorage.setItem('mafia.token', JSON.stringify(tok)); localStorage.setItem('mafia.prefs', JSON.stringify({ lite: true })); } catch {} }, s.token);
    const p = await ctx.newPage(); p.setDefaultTimeout(4000);
    p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); }); p.on('pageerror', (e) => errs.push(name + ' PAGEERR ' + e.message));
    await p.goto(BASE + '/' + hash); return { name, p, ctx };
  };
  const shot = (u, n) => u.p.screenshot({ path: OUT + n + '.png' });
  const st = (u) => u.p.evaluate(() => { const R = window.__mafia.S.room; return R ? { status: R.status, phase: R.match?.phase, role: R.match?.me?.role, alive: R.match?.me?.alive, key: R.joinKey, n: R.members.length, round: R.round } : null; });

  const N = await mk('الراوي'); await N.p.waitForTimeout(2200);
  await N.p.click('text=أوفلاين'); await N.p.click('text=إنشاء غرفة أوفلاين');
  for (let i = 0; i < 3; i++) await N.p.click('.setrow:has-text("العدد الإجمالي للاعبين") button:first-child'); await N.p.click('.setrow:has-text("عدد المافيا") button:first-child');
  await sleep(200); await shot(N, '10-create');
  await N.p.click('text=إنشاء الغرفة'); await sleep(800);
  const key = (await st(N)).key; console.log('key', key);
  const names = ['سالم', 'ليلى', 'خالد', 'نور', 'ريم']; const P = [];
  for (const n of names) { const u = await mk(n, `#/join/${key}`); P.push(u); await sleep(500); }
  await sleep(1500); console.log('members', (await st(N)).n); await shot(N, '11-lobby-narrator'); await shot(P[0], '12-lobby-player');
  await N.p.click('text=بدء اللعبة'); await sleep(1200);
  await shot(P[0], '13-role-back');
  for (const u of P) { await u.p.click('.flip'); }
  await sleep(1200); for (let i = 0; i < P.length; i++) await shot(P[i], `14-role-front-${i}`);
  for (const u of P) await u.p.click('text=فهمت'); await sleep(500); await shot(N, '15-narrator-roles');
  let shots = 0;
  for (let it = 0; it < 60; it++) {
    const s = await st(N); if (!s || s.phase === 'ended') break; const ph = s.phase;
    try {
      if (ph === 'roles') await N.p.click('text=ابدأ الليل');
      else if (ph === 'night') {
        await sleep(1700); // انتظر انتهاء الانتقال السينمائي
        for (let i = 0; i < P.length; i++) { const x = await st(P[i]); if (!x.alive || x.role === 'citizen') continue;
          const rows = P[i].p.locator('.prow.pick'); if (!(await rows.count())) continue; await rows.first().click();
          if (shots < 6) { await shot(P[i], `20-night-${x.role}`); shots++; }
          await P[i].p.locator('.btn.lg.grow').click(); }
        await sleep(500); if (it < 4) await shot(N, `21-narrator-night-${it}`);
        await N.p.click('text=إنهاء الليل وإعلان النتيجة'); await sleep(300);
        if (await N.p.locator('.sheet').count()) await N.p.locator('.sheet .btn.primary').click();
      } else if (ph === 'dawn') { if (it < 6) await shot(P[0], `22-dawn-${it}`); await N.p.click('text=ابدأ النهار'); }
      else if (ph === 'day') { await sleep(1700); await N.p.locator('.prow.pick').first().click(); await sleep(400); if (it < 8) { await shot(N, `23-narrator-day-${it}`); await shot(P[1], `24-player-day-${it}`); }
        await N.p.click('.btn.primary:has-text("بدء التصويت")'); await sleep(300); await N.p.locator('.sheet .btn.blue').click(); }
      else if (ph === 'vote') { await sleep(300);
        for (let i = 0; i < P.length; i++) { const x = await st(P[i]); if (!x.alive) continue; await P[i].p.locator('.prow.pick').first().click(); if (it < 8 && i === 0) await shot(P[i], `25-vote-${it}`); await P[i].p.locator('.btn.gold').click(); }
        await sleep(400); await N.p.click('text=إغلاق التصويت وإعلان النتيجة'); }
      else if (ph === 'voteResult') { await sleep(300); if (it < 10) { await shot(P[0], `26-result-${it}`); } await N.p.click('text=ابدأ الليل'); }
    } catch (e) { console.log('step err', ph, e.message.split('\n')[0]); await shot(N, 'err-narrator'); break; }
    await sleep(500);
  }
  await sleep(1200); console.log('final', JSON.stringify(await st(N)));
  await shot(N, '30-end-narrator'); await shot(P[0], '31-end-player'); await shot(P[1], '31-end-player2');

  const U = P[0]; await U.p.click('text=مغادرة الغرفة'); await sleep(400); if (await U.p.locator('.sheet').count()) {} 
  await U.p.evaluate(() => window.__mafia.go('home')); await sleep(500); await shot(U, '40-home');
  for (const r of ['friends', 'profile', 'leaderboard', 'stats', 'tasks', 'achievements', 'settings']) { await U.p.evaluate((x) => window.__mafia.go(x), r); await sleep(700); await shot(U, '41-' + r); }
  await U.p.evaluate(() => window.__mafia.go('mode', { m: 'online' })); await sleep(500); await shot(U, '42-mode-online');
  await U.p.evaluate(() => window.__mafia.go('create', { mode: 'online' })); await sleep(500); await shot(U, '43-create-online');
  await U.p.evaluate(() => window.__mafia.go('join', { mode: 'offline' })); await sleep(500); await shot(U, '44-join-offline');
  console.log('errors:', errs); await b.close();
})();
