'use strict';
// الطباعة عبر Chromium: صفحات HTML من صور (PDF تُحوَّل لصور في الواجهة) وتُرسل لطابعة Windows المحددة.
const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAGE = { A4: 'A4', A3: 'A3', A5: 'A5', Letter: 'Letter', Legal: 'Legal' };

function html(imgs, { fit, scale }) {
  const css = fit === 'actual' ? `img{width:${scale}%;height:auto}` : fit === 'fill' ? 'img{width:100vw;height:100vh;object-fit:fill}' : `img{max-width:${scale}%;max-height:${scale}vh;object-fit:contain}`;
  return `<!doctype html><meta charset="utf-8"><style>@page{margin:0}html,body{margin:0;padding:0;background:#fff}.p{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}.p:last-child{page-break-after:auto}${css}</style>${imgs.map((u) => `<div class="p"><img src="${u}"></div>`).join('')}`;
}

async function printJob(o, tmpDir) {
  const tmp = [];
  try {
    const urls = [];
    for (const f of o.files) {
      if (f.data) { const p = path.join(tmpDir, 'print-' + crypto.randomBytes(5).toString('hex') + '.png'); fs.writeFileSync(p, f.data); tmp.push(p); urls.push('file://' + (process.platform === 'win32' ? '/' : '') + p.replace(/\\/g, '/')); }
      else if (f.path) { const ext = path.extname(f.path).toLowerCase(); if (ext === '.pdf') throw new Error('حوّل صفحات PDF إلى صور قبل الطباعة'); urls.push('file://' + (process.platform === 'win32' ? '/' : '') + f.path.replace(/\\/g, '/')); }
    }
    if (!urls.length) throw new Error('لا توجد صفحات للطباعة');
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    const page = path.join(tmpDir, 'print-' + crypto.randomBytes(5).toString('hex') + '.html'); fs.writeFileSync(page, html(urls, o)); tmp.push(page);
    await w.loadFile(page);
    const opts = { silent: true, deviceName: o.printer, copies: o.copies, landscape: o.landscape, color: o.color, duplexMode: o.duplex, pageSize: PAGE[o.paper] || 'A4', printBackground: true, margins: { marginType: 'none' } };
    if (o.pageRanges) opts.pageRanges = o.pageRanges.split(',').map((r) => { const [a, b] = r.trim().split('-').map(Number); return { from: (a || 1) - 1, to: (b || a || 1) - 1 }; });
    const res = await new Promise((resolve) => w.webContents.print(opts, (ok, why) => resolve({ ok, why })));
    w.destroy();
    if (!res.ok) throw new Error('فشلت الطباعة: ' + (res.why === 'cancelled' ? 'أُلغيت' : res.why || 'تحقق من حالة الطابعة وقائمة الانتظار'));
    return { ok: true, pages: urls.length };
  } finally { for (const f of tmp) try { fs.unlinkSync(f); } catch {} }
}
module.exports = { printJob };
