'use strict';
// طبقة التطبيق: تربط الأجهزة والمعالجة والتصدير والأرشيف. لا تعتمد على Electron (قابلة للاختبار).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DB } = require('./db');
const { Settings } = require('./settings');
const naming = require('./naming');
const imaging = require('./imaging');
const { WinHW } = require('./winhw');
const { Ocr } = require('./ocr');
const recognize = require('./recognize');
const pdfkit = require('./pdfkit');
const { buildDocx } = require('./export-docx');
const { buildXlsx } = require('./export-xlsx');
const idlayout = require('./idlayout');
const { sizeMm } = require('./pagesize');

const uid = () => crypto.randomBytes(6).toString('hex');
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp']);
const TYPE_OF = { '.pdf': 'pdf', '.docx': 'docx', '.xlsx': 'xlsx', '.jpg': 'jpg', '.png': 'png', '.txt': 'txt' };

class App {
  constructor({ dataDir, docsDir, ocrLangPath, hw, ocr } = {}) {
    this.dataDir = dataDir; this.docsDir = docsDir || path.join(dataDir, 'Documents');
    this.hw = hw || new WinHW(); this.ocr = ocr || new Ocr({ langPath: ocrLangPath });
    this.pages = []; // جلسة المسح الحالية
    this.cards = []; // صور الهويات الممسوحة (للمحرر)
    this.models = new Map(); // نماذج التعرف الجارية
    this.granted = new Set(); // ملفات اختارها المستخدم عبر نافذة الاختيار
  }
  async init() {
    for (const d of ['session', 'backgrounds', 'ids', 'tmp']) fs.mkdirSync(path.join(this.dataDir, d), { recursive: true });
    this.db = await DB.open(path.join(this.dataDir, 'printstudio.db'));
    this.settings = new Settings(this.db);
    return this;
  }
  async close() { try { await this.ocr.terminate(); } catch {} this.db.close(); }
  p(...a) { return path.join(this.dataDir, ...a); }

  // ---------- مسارات مسموحة (للبروتوكول والواجهة) ----------
  allowedRoots() {
    return [this.dataDir, this.settings.get('save.dir'), this.archiveDir()].filter(Boolean).map((r) => path.resolve(r));
  }
  grant(list) { for (const p of list) this.granted.add(path.resolve(p)); return list; }
  isAllowedPath(p) {
    const r = path.resolve(String(p));
    if (this.granted.has(r)) return true;
    if (this.allowedRoots().some((root) => r === root || r.startsWith(root + path.sep))) return true;
    return !!this.db.get('SELECT 1 FROM archive WHERE path=? OR source=?', [r, r]);
  }
  archiveDir() { return this.settings.get('archive.dir') || path.join(this.docsDir, 'Print Studio', 'Archive'); }
  defaultSaveDir() { return this.settings.get('save.dir') || ''; }

  // ---------- الحالة العامة ----------
  state() { const s = this.settings.all(); return { settings: s, firstRun: !s.firstRunDone || !s.printer.name, platform: process.platform, pages: this.pages.length }; }
  history(limit = 12) { return this.db.all('SELECT * FROM history ORDER BY id DESC LIMIT ?', [limit]); }
  log(action, detail = '', ok = true) { this.db.run('INSERT INTO history(action,detail,ok,created) VALUES(?,?,?,?)', [action, detail, ok ? 1 : 0, Date.now()]); }

  // ---------- الطابعات ----------
  async printers() { const list = await this.hw.listPrinters(); const sel = this.settings.get('printer.name'); return { list, selected: sel, selectedAvailable: !sel || list.some((p) => p.name === sel) }; }
  async selectPrinter(name) {
    const list = await this.hw.listPrinters(); const p = list.find((x) => x.name === name);
    if (!p) throw new Error('الطابعة غير موجودة بين طابعات Windows');
    this.settings.set({ 'printer.name': p.name, 'printer.driver': p.driver, firstRunDone: true }); this.log('printer', p.name); return p;
  }
  async connectedDevices() {
    const [dev, pr] = await Promise.all([this.hw.connectedDevices().catch(() => []), this.hw.listPrinters().catch(() => [])]);
    const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, '');
    return dev.map((d) => ({ ...d, installed: pr.some((p) => { const a = norm(p.name), b = norm(d.name); return a && b && (a.includes(b) || b.includes(a)); }) }));
  }
  // ---------- السكانرات ----------
  async scanners() { const list = await this.hw.listScanners(); const sel = this.settings.get('scanner.id'); return { list, selected: sel, selectedAvailable: list.some((s) => s.id === sel && s.ready) }; }
  selectScanner(id, name) { this.settings.set({ 'scanner.id': id, 'scanner.name': name || '' }); return this.settings.all().scanner; }

  // ---------- جلسة المسح ----------
  pageInfo(pg) { return { id: pg.id, file: pg.file, thumb: pg.thumb, width: pg.width, height: pg.height, v: pg.v }; }
  listPages() { return this.pages.map((p) => this.pageInfo(p)); }
  async _addImage(file, at) {
    const id = uid(), dest = this.p('session', id + '.png');
    await require('sharp')(file).rotate().png().toFile(dest);
    const pg = { id, file: dest, thumb: this.p('session', id + '.t.jpg'), v: 0 };
    await imaging.thumbnail(dest, pg.thumb); const m = await imaging.info(dest); pg.width = m.width; pg.height = m.height;
    if (at == null || at >= this.pages.length) this.pages.push(pg); else this.pages.splice(at, 0, pg);
    return pg;
  }
  async scan({ replaceId } = {}) {
    const s = this.settings.get('scan'), id = this.settings.get('scanner.id');
    if (!id) throw new Error('لم يتم اختيار سكانر. افتح الإعدادات ← السكانر واختر جهازاً.');
    const sz = sizeMm(s.paper, s.orientation);
    const base = this.p('tmp', 'scan-' + uid());
    let files;
    try { files = await this.hw.scan({ id, dpi: s.dpi, color: s.color, widthIn: sz.w / 25.4, heightIn: sz.h / 25.4, source: 'flatbed', outBase: base }); }
    catch (e) { this.log('scan', e.message, false); throw e; }
    if (!files.length) throw new Error('لم يُرجع السكانر أي صورة');
    const added = [];
    for (const f of files) {
      if (replaceId) { await this.replacePageImage(replaceId, f); added.push(replaceId); }
      else added.push((await this._addImage(f)).id);
      try { fs.unlinkSync(f); } catch {}
    }
    this.log('scan', `${files.length} صفحة`); return this.listPages();
  }
  /** مسح صفحة واحدة إلى ملف مؤقت دون إضافتها للجلسة (للنسخ السريع). */
  async scanToTemp() {
    const s = this.settings.get('scan'), id = this.settings.get('scanner.id'); if (!id) throw new Error('لم يتم اختيار سكانر. افتح الإعدادات ← السكانر واختر جهازاً.');
    const sz = sizeMm(s.paper, s.orientation); const base = this.p('tmp', 'copy-' + uid());
    const files = await this.hw.scan({ id, dpi: s.dpi, color: s.color, widthIn: sz.w / 25.4, heightIn: sz.h / 25.4, source: 'flatbed', outBase: base });
    if (!files.length) throw new Error('لم يُرجع السكانر أي صورة'); return files[0];
  }
  async importImages(paths) {
    for (const f of paths) { if (!IMG_EXT.has(path.extname(f).toLowerCase())) throw new Error('نوع صورة غير مدعوم: ' + path.basename(f)); await this._addImage(f); }
    this.log('import', `${paths.length} صورة`); return this.listPages();
  }
  async addImageBuffers(bufs) { // صفحات PDF بعد تحويلها في الواجهة
    for (const b of bufs) { const f = this.p('tmp', 'imp-' + uid() + '.png'); fs.writeFileSync(f, b); await this._addImage(f); fs.unlinkSync(f); }
    return this.listPages();
  }
  _page(id) { const pg = this.pages.find((x) => x.id === id); if (!pg) throw new Error('الصفحة غير موجودة'); return pg; }
  async _rewrite(pg, fn) {
    const tmp = this.p('tmp', uid() + '.png'); await fn(pg.file, tmp); fs.copyFileSync(tmp, pg.file); fs.unlinkSync(tmp);
    await imaging.thumbnail(pg.file, pg.thumb); const m = await imaging.info(pg.file); pg.width = m.width; pg.height = m.height; pg.v++;
  }
  async replacePageImage(id, file) { const pg = this._page(id); await this._rewrite(pg, async (_in, out) => { await require('sharp')(file).rotate().png().toFile(out); }); return this.pageInfo(pg); }
  async rotatePage(id, deg) { const pg = this._page(id); await this._rewrite(pg, (i, o) => imaging.rotate(i, o, deg)); return this.pageInfo(pg); }
  async cropPage(id, rect) { const pg = this._page(id); await this._rewrite(pg, (i, o) => imaging.crop(i, o, rect)); return this.pageInfo(pg); }
  async adjustPage(id, a) { const pg = this._page(id); await this._rewrite(pg, (i, o) => imaging.adjust(i, o, a)); return this.pageInfo(pg); }
  async autoCropPage(id) {
    const pg = this._page(id); const r = await imaging.detectBounds(pg.file);
    if (!r) return { page: this.pageInfo(pg), changed: false };
    await this._rewrite(pg, (i, o) => imaging.crop(i, o, r)); return { page: this.pageInfo(pg), changed: true };
  }
  async deskewPage(id) {
    const pg = this._page(id); const a = await imaging.estimateSkew(pg.file);
    if (Math.abs(a) < 0.4) return { page: this.pageInfo(pg), angle: 0 };
    await this._rewrite(pg, async (i, o) => { await require('sharp')(i).rotate(-a, { background: '#ffffff' }).png().toFile(o); });
    return { page: this.pageInfo(pg), angle: a };
  }
  removePages(ids) { const set = new Set(ids); for (const pg of this.pages.filter((x) => set.has(x.id))) { for (const f of [pg.file, pg.thumb]) try { fs.unlinkSync(f); } catch {} } this.pages = this.pages.filter((x) => !set.has(x.id)); return this.listPages(); }
  reorderPages(order) {
    if (order.length !== this.pages.length || new Set(order).size !== order.length) throw new Error('ترتيب غير صالح');
    const m = new Map(this.pages.map((p) => [p.id, p])); if (!order.every((i) => m.has(i))) throw new Error('ترتيب غير صالح');
    this.pages = order.map((i) => m.get(i)); return this.listPages();
  }
  clearPages() { return this.removePages(this.pages.map((p) => p.id)); }

  // ---------- التصدير ----------
  resolveDir(dir) {
    const d = dir || this.defaultSaveDir(); if (!d) throw new Error('اختر مكان الحفظ أولاً');
    if (!path.isAbsolute(d)) throw new Error('مسار الحفظ غير صالح'); fs.mkdirSync(d, { recursive: true }); return d;
  }
  /** يحفظ مكان الحفظ كافتراضي عند أول اختيار (أو عند طلب التغيير). */
  rememberDir(dir) { this.settings.set({ 'save.dir': dir, 'save.askedDir': true }); }

  async exportPages({ name, format, dir, ids, options = {}, content = 'image' }) {
    const dest = this.resolveDir(dir); if (!this.defaultSaveDir()) this.rememberDir(dest);
    const pgs = (ids && ids.length ? ids.map((i) => this._page(i)) : this.pages); if (!pgs.length) throw new Error('لا توجد صفحات للتصدير');
    const sOpts = this.settings.all(); const files = pgs.map((p) => p.file); const outs = [];
    if (format === 'pdf') {
      const o = { pageSize: sOpts.pdf.pageSize, orientation: sOpts.pdf.orientation, quality: sOpts.pdf.quality, ...options };
      const out = naming.uniquePath(dest, name, 'pdf', { overwrite: !!options.overwrite });
      fs.writeFileSync(out, await pdfkit.imagesToPdf(files, { ...o, dpi: sOpts.scan.dpi })); outs.push(out);
    } else if (format === 'jpg' || format === 'png') {
      const o = { format, dpi: sOpts.image.dpi, quality: sOpts.image.quality, color: sOpts.image.color, ...options, format };
      for (let i = 0; i < files.length; i++) {
        const out = files.length === 1 ? naming.uniquePath(dest, name, format, { overwrite: !!options.overwrite }) : naming.numberedPath(dest, name, format, i + 1, files.length);
        await imaging.exportImage(files[i], out, o); outs.push(out);
      }
    } else if (format === 'docx') {
      const w = { pageSize: sOpts.word.pageSize, orientation: sOpts.word.orientation, rtl: sOpts.word.rtl, font: sOpts.word.font, fontSize: sOpts.word.fontSize, ...options };
      let model;
      if (content === 'text') { // docx قابل للتحرير مع OCR
        model = await this.recognizeFiles(files, { dpi: sOpts.scan.dpi });
        model = { pages: model.pages.map((p, i) => ({ blocks: p.blocks, image: files[i] })) };
        w.content = options.content || 'text';
      } else { model = { pages: files.map((f) => ({ blocks: [], image: f })) }; w.content = 'image'; }
      const out = naming.uniquePath(dest, name, 'docx', { overwrite: !!options.overwrite }); fs.writeFileSync(out, await buildDocx(model, w)); outs.push(out);
    } else throw new Error('صيغة غير مدعومة');
    for (const o of outs) this.archiveAdd(o, { source: 'scan', pages: format === 'pdf' || format === 'docx' ? files.length : 1 });
    this.log('export', `${path.basename(outs[0])}${outs.length > 1 ? ` (+${outs.length - 1})` : ''}`);
    return { files: outs, dir: dest };
  }

  // ---------- التعرف الذكي ----------
  async recognizeFiles(files, { mode = 'auto', dpi, onProgress } = {}) { return recognize.recognizeDocument(files, { ocr: this.ocr, mode, dpi, onProgress }); }
  async startRecognition({ ids, mode = 'auto', onProgress }) {
    const pgs = ids && ids.length ? ids.map((i) => this._page(i)) : this.pages; if (!pgs.length) throw new Error('امسح أو استورد مستنداً أولاً');
    const model = await this.recognizeFiles(pgs.map((p) => p.file), { mode, onProgress });
    model.pages.forEach((pg, i) => { pg.image = pgs[i].file; });
    const id = uid(); this.models.set(id, model); this.log('ocr', `${pgs.length} صفحة · ثقة ${model.stats.confidence}%`);
    return { id, model };
  }
  _text(model) {
    return model.pages.map((p) => p.blocks.map((b) => (b.type === 'table' ? b.cells.map((c) => c.text).join('\t') : b.type === 'list' ? `${b.marker} ${b.text}` : b.text)).join('\n')).join('\n\n');
  }
  async exportModel({ name, format, dir, model, options = {} }) {
    const dest = this.resolveDir(dir); if (!this.defaultSaveDir()) this.rememberDir(dest);
    const s = this.settings.all(); let out, buf;
    if (format === 'docx') {
      model.pages.forEach((p) => { if (!p.image) p.image = null; });
      buf = await buildDocx(model, { pageSize: s.word.pageSize, orientation: s.word.orientation, rtl: s.word.rtl, font: s.word.font, fontSize: s.word.fontSize, ...options });
    } else if (format === 'xlsx') {
      const tabs = []; let n = 1;
      for (const p of model.pages) for (const b of p.blocks) if (b.type === 'table') tabs.push({ ...b, name: options.sheetNames?.[n - 1] || `جدول ${n++}`, autoFilter: !!options.autoFilter });
      if (!tabs.length) throw new Error('لا يوجد جدول في هذا المستند. اختر وضع «جدول» أو صيغة Word.');
      buf = await buildXlsx(tabs);
    } else if (format === 'txt') buf = Buffer.from('﻿' + this._text(model), 'utf8');
    else if (format === 'pdf') {
      const imgs = model.pages.map((p) => p.image).filter(Boolean); if (imgs.length !== model.pages.length) throw new Error('لا توجد صور للصفحات');
      const layers = model.pages.map((p) => ({ width: p.width, height: p.height, lines: p.blocks.flatMap((b) => (b.type === 'table' ? b.cells.filter((c) => c.text).map((c) => ({ text: c.text.replace(/\n/g, ' '), bbox: this._cellBox(b, c) })) : (b.lines || [{ text: b.text, bbox: b.bbox }]))) }));
      buf = await pdfkit.imagesToPdf(imgs, { pageSize: s.pdf.pageSize, orientation: s.pdf.orientation, quality: s.pdf.quality, dpi: s.scan.dpi, searchable: layers });
    } else throw new Error('صيغة غير مدعومة');
    out = naming.uniquePath(dest, name, format, { overwrite: !!options.overwrite }); fs.writeFileSync(out, buf);
    this.archiveAdd(out, { source: 'ocr', pages: model.pages.length, text: this._text(model) }); this.log('export', path.basename(out));
    return { files: [out], dir: dest };
  }
  _cellBox(t, c) {
    // تقريب لموضع الخلية من بنية الجدول (تُستخدم لطبقة النص غير المرئية فقط)
    const bb = t.bbox, tw = bb.x1 - bb.x0, th = bb.y1 - bb.y0, tot = t.colWidths.reduce((a, b) => a + b, 0) || 1, rh = t.rowHeights.reduce((a, b) => a + b, 0) || 1;
    const px = t.colWidths.slice(0, c.c).reduce((a, b) => a + b, 0), pw = t.colWidths.slice(c.c, c.c + c.cs).reduce((a, b) => a + b, 0);
    const py = t.rowHeights.slice(0, c.r).reduce((a, b) => a + b, 0), ph = t.rowHeights.slice(c.r, c.r + c.rs).reduce((a, b) => a + b, 0);
    const x0 = t.dir === 'rtl' ? bb.x1 - ((px + pw) / tot) * tw : bb.x0 + (px / tot) * tw;
    return { x0, x1: x0 + (pw / tot) * tw, y0: bb.y0 + (py / rh) * th, y1: bb.y0 + ((py + ph) / rh) * th };
  }

  // ---------- الهويات ----------
  async addCard(file) { // يضيف وجه هوية (صورة ممسوحة أو مستوردة) ويعيد وصفاً
    const id = uid(), dest = this.p('ids', id + '.png'); await require('sharp')(file).rotate().png().toFile(dest);
    await imaging.thumbnail(dest, this.p('ids', id + '.t.jpg'), 400); const m = await imaging.info(dest);
    const c = { id, file: dest, thumb: this.p('ids', id + '.t.jpg'), width: m.width, height: m.height }; this.cards.push(c); return c;
  }
  async scanCard() {
    const s = this.settings.get('scan'), id = this.settings.get('scanner.id'); if (!id) throw new Error('لم يتم اختيار سكانر. افتح الإعدادات ← السكانر واختر جهازاً.');
    const base = this.p('tmp', 'card-' + uid());
    const files = await this.hw.scan({ id, dpi: Math.max(300, s.dpi), color: 'color', widthIn: 4.3, heightIn: 3.2, source: 'flatbed', outBase: base });
    const c = await this.addCard(files[0]); try { fs.unlinkSync(files[0]); } catch {}
    // قصّ تلقائي لحدود البطاقة
    const r = await imaging.detectBounds(c.file, 30); if (r) { const tmp = this.p('tmp', uid() + '.png'); await imaging.crop(c.file, tmp, r); fs.copyFileSync(tmp, c.file); fs.unlinkSync(tmp); await imaging.thumbnail(c.file, c.thumb, 400); const m = await imaging.info(c.file); c.width = m.width; c.height = m.height; }
    return c;
  }
  listCards() { return this.cards.slice(); }
  removeCard(id) { const c = this.cards.find((x) => x.id === id); if (!c) return this.cards; for (const f of [c.file, c.thumb]) try { fs.unlinkSync(f); } catch {} this.cards = this.cards.filter((x) => x.id !== id); return this.cards; }
  arrangeIds(identities, opts) { return idlayout.autoArrange(identities, opts); }
  async exportIds({ name, format, dir, layout, dpi = 300 }) {
    const dest = this.resolveDir(dir); if (!this.defaultSaveDir()) this.rememberDir(dest);
    const items = layout.items.map((it) => { const c = this.cards.find((x) => x.id === it.cardId); if (!c) throw new Error('صورة هوية مفقودة'); return { ...it, file: c.file }; });
    const r = await idlayout.exportLayout({ ...layout, items }, format, { dpi }); const outs = [];
    if (r.buffers) r.buffers.forEach((b, i) => { const o = r.buffers.length === 1 ? naming.uniquePath(dest, name, format) : naming.numberedPath(dest, name, format, i + 1, r.buffers.length); fs.writeFileSync(o, b); outs.push(o); });
    else { const o = naming.uniquePath(dest, name, format); fs.writeFileSync(o, r.buffer); outs.push(o); }
    for (const o of outs) this.archiveAdd(o, { source: 'id', pages: r.pages || 1 }); this.log('export', 'هويات: ' + path.basename(outs[0]));
    return { files: outs, dir: dest, note: r.note || '' };
  }

  async previewIds({ layout, dpi = 110 }) {
    const items = layout.items.map((it) => { const c = this.cards.find((x) => x.id === it.cardId); if (!c) throw new Error('صورة هوية مفقودة'); return { ...it, file: c.file }; });
    const r = await idlayout.exportLayout({ ...layout, items }, 'png', { dpi }); return (r.buffers || [r.buffer]).map((b) => b);
  }
  async annotatePdf({ input, items, name, dir }) {
    if (!Array.isArray(items) || !items.length) throw new Error('لا توجد تعليقات لحفظها'); const dest = this.resolveDir(dir);
    const out = naming.uniquePath(dest, name, 'pdf'); fs.writeFileSync(out, await pdfkit.annotate(fs.readFileSync(input), items));
    this.archiveAdd(out, { source: 'pdf-tool', pages: 0 }); this.log('pdf-annotate', path.basename(out)); return { files: [out], dir: dest };
  }
  // ---------- أدوات PDF ----------
  async pdfTool(op, { inputs = [], name, dir, args = {} }) {
    const bufs = inputs.map((f) => { if (!f.toLowerCase().endsWith('.pdf')) throw new Error('الملف ليس PDF: ' + path.basename(f)); return fs.readFileSync(f); });
    const dest = this.resolveDir(dir); const outs = []; const w = (n, b) => { const o = naming.uniquePath(dest, n, 'pdf'); fs.writeFileSync(o, b); outs.push(o); };
    const base = name || path.basename(inputs[0] || 'مستند', '.pdf');
    switch (op) {
      case 'merge': if (inputs.length < 2) throw new Error('اختر ملفين على الأقل للدمج'); w(base, await pdfkit.merge(bufs)); break;
      case 'split': (await pdfkit.split(bufs[0], args)).forEach((p) => w(`${base}-${p.label}`, p.buf)); break;
      case 'extract': w(base, await pdfkit.pick(bufs[0], pdfkit.parseRanges(args.ranges, await pdfkit.pageCount(bufs[0])))); break;
      case 'reorder': { const total = await pdfkit.pageCount(bufs[0]); const order = pdfkit.parseRanges(args.order, total); if (order.length !== total || new Set(order).size !== total) throw new Error('الترتيب يجب أن يذكر كل الصفحات مرة واحدة'); w(base, await pdfkit.pick(bufs[0], order)); break; }
      case 'rotate': { const total = await pdfkit.pageCount(bufs[0]); w(base, await pdfkit.rotate(bufs[0], Number(args.degrees) || 90, args.ranges ? pdfkit.parseRanges(args.ranges, total) : undefined)); break; }
      case 'optimize': w(base, await pdfkit.optimize(bufs[0])); break;
      case 'numbers': w(base, await pdfkit.addPageNumbers(bufs[0], args)); break;
      case 'watermark': w(base, await pdfkit.addWatermark(bufs[0], args)); break;
      default: throw new Error('أداة غير معروفة');
    }
    for (const o of outs) this.archiveAdd(o, { source: 'pdf-tool', pages: 0 }); this.log('pdf-' + op, path.basename(outs[0]));
    return { files: outs, dir: dest };
  }
  async imagesToPdfTool({ files, name, dir, args = {} }) {
    const dest = this.resolveDir(dir); const s = this.settings.all();
    const out = naming.uniquePath(dest, name || 'صور', 'pdf'); fs.writeFileSync(out, await pdfkit.imagesToPdf(files, { pageSize: s.pdf.pageSize, orientation: s.pdf.orientation, quality: s.pdf.quality, ...args }));
    this.archiveAdd(out, { source: 'pdf-tool', pages: files.length }); return { files: [out], dir: dest };
  }
  /** PDF مبني من صور مُرسلة من الواجهة (ضغط الصور/إعادة بناء). */
  async buildPdfFromBuffers({ buffers, name, dir, quality = 70 }) {
    const tmp = buffers.map((b) => { const f = this.p('tmp', uid() + '.jpg'); fs.writeFileSync(f, b); return f; });
    try { return await this.imagesToPdfTool({ files: tmp, name, dir, args: { pageSize: 'fit', quality, dpi: 150 } }); } finally { tmp.forEach((f) => { try { fs.unlinkSync(f); } catch {} }); }
  }
  saveImageBuffers({ buffers, name, dir, format = 'png' }) { // تحويل صفحات PDF إلى صور
    const dest = this.resolveDir(dir); const outs = buffers.map((b, i) => { const o = naming.numberedPath(dest, name || 'صفحة', format, i + 1, buffers.length); fs.writeFileSync(o, b); return o; });
    outs.forEach((o) => this.archiveAdd(o, { source: 'pdf-tool', pages: 1 })); return { files: outs, dir: dest };
  }

  // ---------- الأرشيف ----------
  archiveAdd(file, { source = '', pages = 1, text = '' } = {}) {
    const ext = path.extname(file).toLowerCase(); const st = fs.statSync(file); let apath = file;
    try {
      const d = new Date(), dir = path.join(this.archiveDir(), String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
      fs.mkdirSync(dir, { recursive: true }); apath = naming.uniquePath(dir, path.basename(file, ext), TYPE_OF[ext] || 'pdf'); fs.copyFileSync(file, apath);
    } catch { apath = file; }
    return this.db.insert('INSERT INTO archive(name,path,type,pages,size,source,text,created) VALUES(?,?,?,?,?,?,?,?)', [path.basename(file), apath, TYPE_OF[ext] || ext.slice(1), pages, st.size, file, text.slice(0, 200000), Date.now()]);
  }
  archiveList({ q = '', type = '', from = 0, to = 0, limit = 200 } = {}) {
    const w = [], a = [];
    if (q) { w.push('(name LIKE ? OR text LIKE ?)'); a.push(`%${q}%`, `%${q}%`); }
    if (type) { w.push('type=?'); a.push(type); }
    if (from) { w.push('created>=?'); a.push(from); } if (to) { w.push('created<?'); a.push(to); }
    return this.db.all(`SELECT id,name,path,type,pages,size,source,created FROM archive ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY created DESC LIMIT ?`, [...a, Math.min(limit, 1000)]);
  }
  archiveGet(id) { const r = this.db.get('SELECT * FROM archive WHERE id=?', [id]); if (!r) throw new Error('السجل غير موجود'); return r; }
  archiveDelete(id, { deleteFile = false } = {}) { const r = this.archiveGet(id); if (deleteFile) try { fs.unlinkSync(r.path); } catch {} this.db.run('DELETE FROM archive WHERE id=?', [id]); }

  // ---------- خلفية اللوحة ----------
  async importBackground(file) {
    const ext = path.extname(file).toLowerCase(); if (!IMG_EXT.has(ext)) throw new Error('اختر صورة بصيغة JPG أو PNG');
    const dest = this.p('backgrounds', 'bg-' + uid() + '.jpg');
    return require('sharp')(file).rotate().resize({ width: 2560, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(dest).then(() => {
      const old = this.settings.get('background.file'); if (old && old.startsWith(this.p('backgrounds'))) try { fs.unlinkSync(old); } catch {}
      this.settings.set({ 'background.mode': 'image', 'background.file': dest }); return this.settings.get('background');
    });
  }
  clearBackground() {
    const old = this.settings.get('background.file'); if (old && old.startsWith(this.p('backgrounds'))) try { fs.unlinkSync(old); } catch {}
    this.settings.set({ 'background.mode': 'default', 'background.file': '', 'background.preset': '', 'background.brightness': 100, 'background.opacity': 100 }); return this.settings.get('background');
  }
}
module.exports = { App, IMG_EXT };
