'use strict';
// الطباعة عبر Chromium: صفحات من صور (PDF تُحوَّل لصور في الواجهة). الاتجاه تلقائي حسب كل صفحة، مع إمكانية الفرض.
const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const PAGE = { A4: 'A4', A3: 'A3', A5: 'A5', Letter: 'Letter', Legal: 'Legal' };
const urlOf = (p) => 'file://' + (process.platform === 'win32' ? '/' : '') + p.replace(/\\/g, '/').split('/').map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');

function html(imgs, { fit, scale }) {
  const css = fit === 'actual' ? `img{width:${scale}%;height:auto}` : fit === 'fill' ? 'img{width:100vw;height:100vh;object-fit:fill}' : `img{max-width:${scale}%;max-height:${scale}vh;object-fit:contain}`;
  return `<!doctype html><meta charset="utf-8"><style>@page{margin:0}html,body{margin:0;padding:0;background:#fff}.p{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}.p:last-child{page-break-after:auto}${css}</style>${imgs.map((u) => `<div class="p"><img src="${u}"></div>`).join('')}`;
}

/** "1-3,5" → مجموعة فهارس (0-based) */
function rangeSet(str, total) {
  if (!str) return null; const out = new Set();
  for (const part of String(str).split(/[,،\s]+/).filter(Boolean)) { const m = part.match(/^(\d*)-(\d*)$/); if (m) { const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : total; for (let i = a; i <= Math.min(b, total); i++) out.add(i - 1); } else if (/^\d+$/.test(part) && +part <= total) out.add(+part - 1); else throw new Error('نطاق الصفحات غير صالح: ' + part); }
  if (!out.size) throw new Error('نطاق الصفحات لا يطابق أي صفحة'); return out;
}

/** يقسم الصفحات إلى مجموعات متتالية بنفس الاتجاه (landscape/portrait). */
function groupByOrientation(pages, mode) {
  if (mode !== 'auto') return [{ landscape: mode === 'landscape', pages }];
  const groups = [];
  for (const p of pages) { const l = p.w > p.h; const g = groups[groups.length - 1]; if (g && g.landscape === l) g.pages.push(p); else groups.push({ landscape: l, pages: [p] }); }
  return groups;
}

async function printGroup(g, o, tmpDir, tmp) {
  const urls = g.pages.map((p) => p.url);
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    const page = path.join(tmpDir, 'print-' + crypto.randomBytes(5).toString('hex') + '.html'); fs.writeFileSync(page, html(urls, o)); tmp.push(page);
    await w.loadFile(page);
    await w.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r})))');
    const opts = { silent: true, deviceName: o.printer, copies: o.copies, landscape: g.landscape, color: o.color, duplexMode: o.duplex, pageSize: PAGE[o.paper] || 'A4', printBackground: true, margins: { marginType: 'none' } };
    if (o.dpi) opts.dpi = { horizontal: o.dpi, vertical: o.dpi };
    const res = await new Promise((resolve) => w.webContents.print(opts, (ok, why) => resolve({ ok, why })));
    if (!res.ok) throw new Error('فشلت الطباعة: ' + (res.why === 'cancelled' ? 'أُلغيت' : res.why || 'تحقق من حالة الطابعة وقائمة الانتظار'));
  } finally { if (!w.isDestroyed()) w.destroy(); }
}

async function printJob(o, tmpDir) {
  const tmp = [];
  try {
    let pages = [];
    for (const f of o.files) {
      let url, meta;
      if (f.data) { const p = path.join(tmpDir, 'print-' + crypto.randomBytes(5).toString('hex') + '.png'); fs.writeFileSync(p, f.data); tmp.push(p); url = urlOf(p); meta = await sharp(f.data).metadata(); }
      else if (f.path) { if (path.extname(f.path).toLowerCase() === '.pdf') throw new Error('حوّل صفحات PDF إلى صور قبل الطباعة'); url = urlOf(f.path); meta = await sharp(f.path).rotate().metadata(); }
      else continue;
      const rot = meta.orientation && meta.orientation >= 5; pages.push({ url, w: rot ? meta.height : meta.width, h: rot ? meta.width : meta.height });
    }
    if (!pages.length) throw new Error('لا توجد صفحات للطباعة');
    const sel = rangeSet(o.pageRanges, pages.length); if (sel) pages = pages.filter((_, i) => sel.has(i));
    const groups = groupByOrientation(pages, o.orientation || 'auto');
    for (const g of groups) await printGroup(g, o, tmpDir, tmp);
    return { ok: true, pages: pages.length, jobs: groups.length };
  } finally { for (const f of tmp) try { fs.unlinkSync(f); } catch {} }
}
module.exports = { printJob, groupByOrientation, rangeSet };
