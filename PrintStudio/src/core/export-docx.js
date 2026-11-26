'use strict';
// تصدير نموذج المستند إلى DOCX حقيقي قابل للتحرير (فقرات/عناوين/قوائم/جداول فعلية، RTL صحيح).
const fs = require('fs');
const sharp = require('sharp');
const D = require('docx');
const { sizeMm, mmToTwip, mmToEmu } = require('./pagesize');
const { dirOf } = require('./docmodel');

const ALIGN = (b) => {
  if (b.align === 'center') return D.AlignmentType.CENTER;
  if (b.align === 'justify') return D.AlignmentType.BOTH;
  const natural = b.dir === 'rtl' ? 'right' : 'left';
  return b.align === natural ? D.AlignmentType.START : D.AlignmentType.END; // في الفقرات ثنائية الاتجاه START = جهة القراءة
};

function runs(text, b, st, extra = {}) {
  const rtl = b.dir === 'rtl';
  const size = Math.round((b.sizePt || st.fontSize) * 2);
  const opts = {
    font: { ascii: b.font || st.font, hAnsi: b.font || st.font, cs: b.font || st.font, eastAsia: b.font || st.font },
    size, sizeComplexScript: size, color: (b.color || '000000').replace('#', ''),
    bold: !!b.bold, boldComplexScript: !!b.bold, italics: !!b.italic, italicsComplexScript: !!b.italic,
    rightToLeft: rtl, ...extra,
  };
  const lines = String(text).split('\n');
  return lines.map((t, i) => new D.TextRun({ ...opts, text: t, break: i ? 1 : 0 }));
}

function para(b, st) {
  const rtl = b.dir === 'rtl';
  const o = { bidirectional: rtl, alignment: ALIGN(b), spacing: { after: 120, line: 276 } };
  let text = b.text || '';
  if (b.type === 'heading') {
    o.heading = b.level === 1 ? D.HeadingLevel.HEADING_1 : D.HeadingLevel.HEADING_2;
    o.spacing = { before: 120, after: 160 };
    return new D.Paragraph({ ...o, children: runs(text, { ...b, bold: b.bold ?? true, sizePt: b.sizePt || (b.level === 1 ? 20 : 16) }, st) });
  }
  if (b.type === 'list') {
    // رقم/نقطة نصية حقيقية داخل الفقرة (تظل قابلة للتحرير وتحافظ على الاتجاه)
    text = `${b.marker || '•'} ${text}`;
    o.indent = rtl ? { right: 360, hanging: 360 } : { left: 360, hanging: 360 };
  }
  return new D.Paragraph({ ...o, children: runs(text, b, st) });
}

function table(b, st, contentWidthTwip) {
  const rtl = b.dir === 'rtl';
  const total = b.colWidths.reduce((a, c) => a + c, 0) || 1;
  const widths = b.colWidths.map((w) => Math.max(500, Math.round((w / total) * contentWidthTwip)));
  const grid = Array.from({ length: b.rows }, () => new Array(b.cols).fill(null));
  for (const c of b.cells) for (let r = 0; r < c.rs; r++) for (let k = 0; k < c.cs; k++) grid[c.r + r][c.c + k] = (r === 0 && k === 0) ? c : 'covered';
  const rows = [];
  for (let r = 0; r < b.rows; r++) {
    const cells = [];
    for (let c = 0; c < b.cols; c++) {
      const cell = grid[r][c];
      if (cell === 'covered') { // خلية مغطّاة بدمج: أفقياً تُحذف، رأسياً تُنشأ كخلية استمرار
        const owner = b.cells.find((x) => r >= x.r && r < x.r + x.rs && c >= x.c && c < x.c + x.cs);
        if (owner && owner.c === c && owner.r !== r) cells.push(new D.TableCell({ children: [new D.Paragraph('')], verticalMerge: D.VerticalMergeType.CONTINUE, width: { size: widths.slice(c, c + owner.cs).reduce((a, x) => a + x, 0), type: D.WidthType.DXA }, columnSpan: owner.cs > 1 ? owner.cs : undefined }));
        continue;
      }
      if (!cell) { cells.push(new D.TableCell({ children: [new D.Paragraph('')], width: { size: widths[c], type: D.WidthType.DXA } })); continue; }
      const cdir = dirOf(cell.text, b.dir);
      const bb = { dir: cdir, align: cdir === 'rtl' ? 'right' : 'left', sizePt: cell.sizePt || st.fontSize, bold: b.header && cell.r === 0, font: cell.font, color: cell.color };
      const children = String(cell.text || '').split('\n').map((t) => new D.Paragraph({ bidirectional: cdir === 'rtl', alignment: ALIGN(bb), children: runs(t, bb, st) }));
      cells.push(new D.TableCell({
        children, columnSpan: cell.cs > 1 ? cell.cs : undefined,
        verticalMerge: cell.rs > 1 ? D.VerticalMergeType.RESTART : undefined,
        width: { size: widths.slice(cell.c, cell.c + cell.cs).reduce((a, x) => a + x, 0), type: D.WidthType.DXA },
        shading: b.header && cell.r === 0 ? { type: D.ShadingType.CLEAR, fill: 'E8EEF7', color: 'auto' } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
      }));
    }
    rows.push(new D.TableRow({ children: cells, tableHeader: b.header && r === 0 }));
  }
  return new D.Table({ rows, columnWidths: widths, width: { size: widths.reduce((a, x) => a + x, 0), type: D.WidthType.DXA }, visuallyRightToLeft: rtl, alignment: D.AlignmentType.START });
}

async function imageRun(file, widthMm, opts = {}) {
  const buf = opts.data || fs.readFileSync(file); const m = await sharp(buf).metadata();
  const wPx = Math.round((widthMm / 25.4) * 96), hPx = opts.heightMm ? Math.round((opts.heightMm / 25.4) * 96) : Math.round(wPx * (m.height / m.width));
  const png = m.format === 'png' || m.format === 'jpeg' ? buf : await sharp(buf).png().toBuffer();
  const type = m.format === 'jpeg' ? 'jpg' : 'png';
  return new D.ImageRun({ type, data: png, transformation: { width: wPx, height: hPx, rotation: opts.rotation || 0 }, floating: opts.floating, altText: { name: opts.name || 'image', description: opts.name || 'image', title: opts.name || 'image' } });
}

/**
 * @param model {pages:[{blocks, image?}]}
 * @param st {pageSize, orientation, rtl, font, fontSize, marginMm, content:'text'|'image'|'both'}
 */
async function buildDocx(model, st = {}) {
  st = { pageSize: 'A4', orientation: 'portrait', rtl: true, font: 'Arial', fontSize: 12, marginMm: 20, content: 'text', ...st };
  const size = sizeMm(st.pageSize, st.orientation);
  const mm = st.marginMm; const contentW = mmToTwip(size.w - 2 * mm);
  const children = [];
  for (let p = 0; p < model.pages.length; p++) {
    const pg = model.pages[p];
    if (p > 0) children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
    if (st.content !== 'image') {
      for (const b of pg.blocks) {
        if (b.type === 'table') { children.push(table(b, st, contentW)); children.push(new D.Paragraph({ spacing: { after: 120 } })); }
        else if (b.type === 'image' && b.file) children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [await imageRun(b.file, b.widthMm || 60)] }));
        else children.push(para({ dir: st.rtl ? 'rtl' : 'ltr', align: st.rtl ? 'right' : 'left', ...b }, st));
      }
    }
    if ((st.content === 'image' || st.content === 'both') && pg.image) {
      if (st.content === 'both') children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
      children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [await imageRun(pg.image, Math.min(size.w - 2 * mm, 180))] }));
    }
  }
  const doc = new D.Document({
    creator: 'Print Studio', title: model.title || 'Print Studio',
    styles: { default: { document: { run: { font: { ascii: st.font, hAnsi: st.font, cs: st.font, eastAsia: st.font }, size: st.fontSize * 2, sizeComplexScript: st.fontSize * 2, rightToLeft: st.rtl }, paragraph: { } } } },
    sections: [{
      properties: { page: { size: { width: mmToTwip(size.w), height: mmToTwip(size.h), orientation: st.orientation === 'landscape' ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT }, margin: { top: mmToTwip(mm), bottom: mmToTwip(mm), left: mmToTwip(mm), right: mmToTwip(mm) } }, bidi: st.rtl },
      children,
    }],
  });
  return D.Packer.toBuffer(doc);
}

/** DOCX لتخطيط الهويات: كل بطاقة صورة عائمة (قابلة للسحب داخل Word). */
async function buildIdDocx(layout) {
  const size = sizeMm(layout.paper, layout.orientation);
  const floatingImgs = [];
  for (const it of layout.items) {
    if (!it.data) continue;
    floatingImgs.push(await imageRun(null, it.w, {
      data: it.data, heightMm: it.h, rotation: it.rot || 0, name: it.label || 'ID',
      floating: { horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: mmToEmu(it.x) }, verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: mmToEmu(it.y) }, wrap: { type: D.TextWrappingType.NONE }, behindDocument: false, allowOverlap: true, lockAnchor: false },
    }));
  }
  // قيّد الارتفاع الفعلي لكل صورة (imageRun يحسبه من النسبة؛ نعدّل إلى h المطلوب)
  const doc = new D.Document({ creator: 'Print Studio', sections: [{ properties: { page: { size: { width: mmToTwip(size.w), height: mmToTwip(size.h), orientation: layout.orientation === 'landscape' ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } }, children: [new D.Paragraph({ children: floatingImgs })] }] });
  return D.Packer.toBuffer(doc);
}

module.exports = { buildDocx, buildIdDocx };
