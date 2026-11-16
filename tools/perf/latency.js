// Measures how long the launcher takes to answer remote keys (headless Chromium, 1920x1080, the real launcher page).
// Usage: node tools/perf/latency.js [label]     Prints median / p95 / max in milliseconds for each action.
const { chromium } = require('playwright');
const path = require('path');
const ASSETS = path.join(__dirname, '../../CleanTV/app/src/main/assets');
const http = require('http'), fs = require('fs');
const srv = http.createServer((q, r) => { const f = path.join(ASSETS, decodeURIComponent(q.url.split('?')[0]).replace(/^\//, '') || 'index.html'); fs.readFile(f, (e, d) => { if (e) { r.statusCode = 404; r.end(); } else { r.end(d); } }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } }); const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p); const slow = +(process.env.CPU || 1); if (slow > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });   // CPU=6 behaves like a weak TV box
  await p.addInitScript(() => {
    localStorage.setItem('settings', JSON.stringify({ religious: false }));
    const mk = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="' + c + '"/></svg>');
    window.__DEMO_APPS = Array.from({ length: 40 }, (_, i) => ({ pkg: 'demo.' + i, label: 'تطبيق ' + i, color: '#' + ((i * 2654435) % 0xffffff).toString(16).padStart(6, '0'), icon: mk('#556' + (i % 10)) }));
    window.Android = undefined;
  });
  await p.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, r => r.abort());
  await p.goto('http://127.0.0.1:' + port + '/index.html'); await p.waitForTimeout(2500);
  const time = async (label, n, fn) => {
    const ts = [];
    for (let i = 0; i < n; i++) { const t = await p.evaluate(([src, k]) => (0, eval)('(' + src + ')')(k), [fn, i]); ts.push(t); }
    ts.sort((a, b) => a - b); const q = x => ts[Math.min(ts.length - 1, Math.floor(ts.length * x))];
    console.log((process.argv[2] || '') + ' ' + label.padEnd(44) + ' median ' + q(.5).toFixed(2) + ' ms · p95 ' + q(.95).toFixed(2) + ' · max ' + ts[ts.length - 1].toFixed(2));
    return q(.5);
  };
  // the time from the key to the end of the page's own work (script + style + layout), measured in the page
  await time('home: arrow left/right (40 apps)', 60, `(i) => { const t0 = performance.now(); window.remoteKey(i % 2 ? 'ArrowLeft' : 'ArrowRight'); document.body.offsetHeight; return performance.now() - t0; }`);
  await time('home: arrow down/up', 30, `(i) => { const t0 = performance.now(); window.remoteKey(i % 2 ? 'ArrowUp' : 'ArrowDown'); document.body.offsetHeight; return performance.now() - t0; }`);
  const frame = async (label, n, act) => {
    const ts = [];
    for (let i = 0; i < n; i++) ts.push(await p.evaluate(([src, k]) => new Promise(res => { const t0 = performance.now(); (0, eval)('(' + src + ')')(k); requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t0))); }), [act, i]));
    ts.sort((a, b) => a - b); const q = x => ts[Math.min(ts.length - 1, Math.floor(ts.length * x))];
    console.log((process.argv[2] || '') + ' ' + label.padEnd(44) + ' to the next frame: median ' + q(.5).toFixed(1) + ' ms · p95 ' + q(.95).toFixed(1));
  };
  await frame('home: arrow left/right', 40, `(i) => window.remoteKey(i % 2 ? 'ArrowLeft' : 'ArrowRight')`);
  const open = await p.evaluate(() => { const t0 = performance.now(); window.Live.open(); document.body.offsetHeight; return performance.now() - t0; });
  console.log((process.argv[2] || '') + ' ' + 'قنواتي: open the page'.padEnd(44) + ' ' + open.toFixed(2) + ' ms');
  await p.waitForTimeout(400);
  await time('قنواتي: arrow down in the grid (200 channels)', 60, `(i) => { const t0 = performance.now(); window.Live.key('ArrowLeft'); document.body.offsetHeight; return performance.now() - t0; }`);
  await time('قنواتي: arrow down in the folders column', 20, `(i) => { if (i === 0) window.Live.key('ArrowRight'); const t0 = performance.now(); window.Live.key('ArrowDown'); document.body.offsetHeight; return performance.now() - t0; }`);
  await frame('قنواتي: arrow in the grid', 40, `(i) => window.Live.key('ArrowLeft')`);
  await b.close(); srv.close();
})();
