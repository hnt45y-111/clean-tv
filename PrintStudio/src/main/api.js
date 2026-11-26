'use strict';
// واجهة الاستدعاءات المسموحة من الواجهة. كل مسار ملف يجب أن يأتي من نافذة اختيار أو من مجلدات التطبيق.
const fs = require('fs');
const path = require('path');
const { PRESETS } = require('../core/idlayout');

function buildApi(app, ui) {
  const granted = new Set();
  const grant = (list) => { for (const p of list) granted.add(path.resolve(p)); return list; };
  const need = (p) => {
    const r = path.resolve(String(p));
    if (!granted.has(r) && !app.isAllowedPath(r)) throw new Error('مسار غير مسموح: ' + path.basename(r));
    if (!fs.existsSync(r)) throw new Error('الملف غير موجود: ' + path.basename(r));
    return r;
  };
  const needAll = (arr) => { if (!Array.isArray(arr) || arr.length > 500) throw new Error('قائمة ملفات غير صالحة'); return arr.map(need); };
  const str = (v, max = 300) => { if (typeof v !== 'string' || v.length > max) throw new Error('قيمة نصية غير صالحة'); return v; };
  const buf = (b) => Buffer.from(b);
  const bufs = (arr) => { if (!Array.isArray(arr) || arr.length > 1000) throw new Error('قائمة صور غير صالحة'); return arr.map(buf); };
  const saveDir = async (dir, { remember } = {}) => { if (!dir) return undefined; const d = path.resolve(str(dir, 1024)); if (remember) app.rememberDir(d); return d; };
  const progress = (ch) => (x) => ui.emit('progress', { ch, ...x });

  return {
    // الحالة والإعدادات
    state: () => app.state(),
    history: (n) => app.history(Math.min(+n || 12, 100)),
    settingsSet: (obj) => app.settings.set(obj),
    settingsReset: (g) => app.settings.reset(str(g, 40)),
    // الطابعات
    printers: () => app.printers(),
    printerSelect: (name) => app.selectPrinter(str(name)),
    printerJobs: (name) => app.hw.printerJobs(str(name)),
    printerCancelJob: (name, id) => app.hw.cancelJob(str(name), Number(id)),
    printerQueue: (name) => app.hw.openQueue(str(name)),
    printerProps: (name) => app.hw.openProperties(str(name)),
    // السكانرات
    scanners: () => app.scanners(),
    scannerSelect: (id, name) => app.selectScanner(str(id), str(name || '')),
    scan: (o) => app.scan(o || {}),
    // الصفحات
    pagesList: () => app.listPages(),
    pagesImport: async () => { const f = await ui.pickFiles({ images: true }); if (!f.length) return app.listPages(); return app.importImages(grant(f)); },
    pagesImportPaths: (paths) => app.importImages(needAll(paths)),
    pagesAddBuffers: (b) => app.addImageBuffers(bufs(b)),
    pageRotate: (id, d) => app.rotatePage(str(id), Number(d)),
    pageCrop: (id, r) => app.cropPage(str(id), { x: +r.x, y: +r.y, w: +r.w, h: +r.h }),
    pageAdjust: (id, a) => app.adjustPage(str(id), { brightness: +a.brightness || 0, contrast: +a.contrast || 0 }),
    pageAutoCrop: (id) => app.autoCropPage(str(id)),
    pageDeskew: (id) => app.deskewPage(str(id)),
    pagesRemove: (ids) => app.removePages(ids.map((i) => str(i))),
    pagesReorder: (order) => app.reorderPages(order.map((i) => str(i))),
    pagesClear: () => app.clearPages(),
    // التصدير
    folderPick: async (remember) => { const d = await ui.pickFolder(); if (!d) return ''; grant([d]); if (remember) app.rememberDir(d); return d; },
    exportPages: async (o) => app.exportPages({ name: str(o.name), format: str(o.format, 8), dir: await saveDir(o.dir), ids: o.ids, options: o.options || {}, content: o.content }),
    // التعرف
    recognize: (o) => app.startRecognition({ ids: o.ids, mode: o.mode || 'auto', onProgress: progress('ocr') }),
    exportModel: async (o) => { for (const pg of o.model.pages) { if (pg.image) need(pg.image); for (const b of pg.blocks) if (b.type === 'image' && b.file) need(b.file); } return app.exportModel({ name: str(o.name), format: str(o.format, 8), dir: await saveDir(o.dir), model: o.model, options: o.options || {} }); },
    // الهويات
    cardsList: () => app.listCards(),
    cardImport: async () => { const f = await ui.pickFiles({ images: true }); const out = []; for (const x of grant(f)) out.push(await app.addCard(x)); return out; },
    cardScan: () => app.scanCard(),
    cardRemove: (id) => app.removeCard(str(id)),
    idsArrange: (ids, opts) => app.arrangeIds(ids, opts || {}),
    idsExport: async (o) => app.exportIds({ name: str(o.name), format: str(o.format, 8), dir: await saveDir(o.dir), layout: o.layout, dpi: Math.min(600, Math.max(72, +o.dpi || 300)) }),
    idPresets: () => PRESETS,
    // الملفات والحوارات
    pickPdfs: async (multi) => grant(await ui.pickFiles({ pdf: true, multi: multi !== false })),
    pickImages: async () => grant(await ui.pickFiles({ images: true })),
    pickPrintable: async () => grant(await ui.pickFiles({ pdf: true, images: true })),
    readFile: (p) => fs.readFileSync(need(p)),
    openPath: (p) => ui.openPath(need(p)),
    reveal: (p) => ui.reveal(need(p)),
    // أدوات PDF
    pdfTool: async (o) => app.pdfTool(str(o.op, 20), { inputs: needAll(o.inputs), name: o.name ? str(o.name) : undefined, dir: await saveDir(o.dir), args: o.args || {} }),
    imagesToPdf: async (o) => app.imagesToPdfTool({ files: needAll(o.files), name: o.name ? str(o.name) : undefined, dir: await saveDir(o.dir), args: o.args || {} }),
    pdfBuild: async (o) => app.buildPdfFromBuffers({ buffers: bufs(o.buffers), name: str(o.name), dir: await saveDir(o.dir), quality: +o.quality || 70 }),
    imagesSave: async (o) => app.saveImageBuffers({ buffers: bufs(o.buffers), name: str(o.name), dir: await saveDir(o.dir), format: o.format === 'jpg' ? 'jpg' : 'png' }),
    // الأرشيف
    archiveList: (f) => app.archiveList(f || {}),
    archiveOpen: (id) => { const r = app.archiveGet(+id); if (!fs.existsSync(r.path)) throw new Error('الملف لم يعد موجوداً'); return ui.openPath(r.path); },
    archiveReveal: (id) => { const r = app.archiveGet(+id); if (!fs.existsSync(r.path)) throw new Error('الملف لم يعد موجوداً'); return ui.reveal(r.path); },
    archiveDelete: (id, del) => app.archiveDelete(+id, { deleteFile: !!del }),
    archiveGet: (id) => { const r = app.archiveGet(+id); delete r.text; return r; },
    archiveDirPick: async () => { const d = await ui.pickFolder(); if (!d) return ''; app.settings.set('archive.dir', d); return d; },
    // الخلفية
    bgImport: async () => { const f = await ui.pickFiles({ images: true, multi: false }); return f[0] ? app.importBackground(f[0]) : app.settings.get('background'); },
    bgClear: () => app.clearBackground(),
    fileUrl: (p) => ui.fileUrl(need(p)),
    // الطباعة
    printRun: async (o) => {
      const printer = o.printer || app.settings.get('printer.name'); if (!printer) throw new Error('اختر طابعة أولاً');
      const files = o.files.map((f) => ({ path: f.path ? need(f.path) : null, data: f.data ? buf(f.data) : null }));
      return ui.print({ printer: str(printer), files, copies: Math.min(999, Math.max(1, +o.copies || 1)), landscape: !!o.landscape, color: o.color !== false, duplex: ['simplex', 'longEdge', 'shortEdge'].includes(o.duplex) ? o.duplex : 'simplex', paper: str(o.paper || 'A4', 12), fit: o.fit || 'contain', scale: Math.min(300, Math.max(10, +o.scale || 100)), pageRanges: o.pageRanges ? str(o.pageRanges, 100) : '' });
    },
    startupApply: (v) => { ui.setStartup(!!v); return true; },
    appInfo: () => ({ version: ui.version(), dataDir: app.dataDir }),
  };
}
module.exports = { buildApi };
