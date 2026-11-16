const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
  fs.mkdirSync('./out', { recursive: true });
  for (const id of ['haibat', 'rawanduz', 'halgurd', 'dukan', 'amadiya', 'shatt', 'ahwar', 'tassili', 'taghit', 'djurdjura', 'timimoun', 'ghardaia', 'constantine']) {
    await p.setContent('<body style="margin:0;background:#000">' + fs.readFileSync('./svg/' + id + '.svg', 'utf8') + '</body>');
    await p.screenshot({ path: './out/' + id + '.png' });
    await p.setContent('<body style="margin:0;background:transparent">' + fs.readFileSync('./svg/' + id + '_fg.svg', 'utf8') + '</body>');
    await p.screenshot({ path: './out/' + id + '_fg.png', omitBackground: true });
  }
  await b.close();
})();
