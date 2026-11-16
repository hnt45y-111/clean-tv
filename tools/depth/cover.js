const { chromium } = require('playwright'); const fs = require('fs');
const FONT = process.argv[2] || 'DejaVu Sans';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } }); const p = await ctx.newPage();
  const AR = t => t.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
  const times = ['12:00', '10:08', '11:11', '8:45', '1:23', '12:58', '9:41', '7:07', '3:30', '6:15', '5:19', '2:17', '4:44'].map(AR);
  const res = {};
  const scenes = ['tassili', 'taghit', 'djurdjura', 'timimoun', 'ghardaia', 'constantine'];
  const cfg = JSON.parse(process.argv[3] || '{}');
  for (const id of scenes) {
    const dx = (cfg[id] || {}).dx || 0, dy = (cfg[id] || {}).dy || 0;
    const fgData = 'data:image/png;base64,' + fs.readFileSync('./out/' + id + '_fg.png').toString('base64');
    let worst = 0, best = 1, rows = [];
    for (const t of times) {
      const r = await p.evaluate(async ([t, fg, font, dx, dy]) => {
        const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, 1920, 1080);
        x.font = '800 300px "' + font + '"'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff';
        x.fillText(t, 960 + dx, 376 + dy);
        const A = x.getImageData(0, 0, 1920, 1080).data;
        const img = new Image(); await new Promise(r => { img.onload = r; img.src = fg; });
        const c2 = document.createElement('canvas'); c2.width = 1920; c2.height = 1080; const y = c2.getContext('2d'); y.drawImage(img, 0, 0);
        const B = y.getImageData(0, 0, 1920, 1080).data;
        let tot = 0, cov = 0; for (let i = 0; i < A.length; i += 4) { if (A[i] > 128) { tot++; if (B[i + 3] > 128) cov++; } }
        return tot ? cov / tot : 0;
      }, [t, fgData, FONT, dx, dy]);
      rows.push(t + ':' + (r * 100).toFixed(0)); worst = Math.max(worst, r); best = Math.min(best, r);
    }
    res[id] = { worst: +(worst * 100).toFixed(1), best: +(best * 100).toFixed(1), rows: rows.join(' ') };
  }
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
