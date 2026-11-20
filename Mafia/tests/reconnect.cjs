// اختبار: قتل الخادم أثناء مباراة جارية ثم إعادة تشغيله؛ يجب أن تعود الواجهات لنفس الغرفة والدور (يتطلب playwright)
const { chromium } = require('playwright'); const { spawn, execSync } = require('child_process');
const BASE = 'http://localhost:3100'; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const startServer = () => spawn('node', ['src/server.js'], { cwd: require('path').join(__dirname, '../server'), env: { ...process.env, PORT: '3100', MAFIA_DB: '/tmp/mafia-rc.db' }, stdio: 'ignore' });
(async () => {
  execSync('rm -f /tmp/mafia-rc.db*'); let srv = startServer(); await sleep(1500);
  const b = await chromium.launch(); const errs = [];
  const mk = async (name, hash = '') => { const s = await (await fetch(BASE + '/api/auth/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })).json();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' }); await ctx.addInitScript((tok) => { localStorage.setItem('mafia.token', JSON.stringify(tok)); localStorage.setItem('mafia.prefs', JSON.stringify({ lite: true })); }, s.token);
    const p = await ctx.newPage(); p.setDefaultTimeout(5000); p.on('pageerror', (e) => errs.push(name + ' ' + e.message)); await p.goto(BASE + '/' + hash); return p; };
  const st = (p) => p.evaluate(() => { const R = window.__mafia.S.room; return R ? { status: R.status, phase: R.match?.phase, role: R.match?.me?.role, conn: window.__mafia.S.conn, key: R.joinKey } : { conn: window.__mafia.S.conn }; });
  const N = await mk('N'); await sleep(2000); await N.click('text=أوفلاين'); await N.click('text=إنشاء غرفة أوفلاين');
  for (let i = 0; i < 4; i++) await N.click('.setrow:has-text("العدد الإجمالي للاعبين") button:first-child'); await N.click('text=إنشاء الغرفة'); await sleep(700);
  const key = (await st(N)).key; const P = []; for (const n of ['A', 'B', 'C', 'D']) { P.push(await mk(n, `#/join/${key}`)); await sleep(400); }
  await sleep(1200); await N.click('text=بدء اللعبة'); await sleep(1000);
  for (const p of P) await p.click('.flip'); await sleep(900); for (const p of P) await p.click('text=فهمت'); await N.click('text=ابدأ الليل'); await sleep(800);
  const before = await Promise.all(P.map(st)); console.log('before', JSON.stringify(before.map((x) => [x.phase, x.role, x.conn])));
  srv.kill('SIGKILL'); await sleep(2500); console.log('during outage', JSON.stringify((await st(P[0])).conn));
  srv = startServer(); await sleep(6000);
  const after = await Promise.all(P.map(st)); console.log('after ', JSON.stringify(after.map((x) => [x.phase, x.role, x.conn])));
  const same = before.every((x, i) => x.role === after[i].role && x.phase === after[i].phase && after[i].conn === 'ok');
  console.log('narrator after', JSON.stringify(await st(N))); console.log('RESTORED:', same, 'errors:', errs);
  srv.kill(); await b.close(); process.exit(0);
})();
