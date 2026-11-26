'use strict';
// تصدير الجدول إلى مصنف Excel حقيقي: خلايا فعلية، دمج، عرض أعمدة/ارتفاع صفوف، تصفية، RTL.
const ExcelJS = require('exceljs');

function toNumber(t) {
  const s = String(t).trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,]/g, '');
  if (/^-?\d+(\.\d+)?$/.test(s) && !/^0\d+/.test(s) && s.length < 16) return Number(s);
  return null;
}

/** tables: [{name, dir, rows, cols, cells:[{r,c,rs,cs,text,bold?,fill?,color?,align?}], colWidths?, rowHeights?, autoFilter?, header?}] */
async function buildXlsx(tables, { rtl } = {}) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Print Studio'; wb.created = new Date();
  tables.forEach((t, i) => {
    const name = (t.name || `ورقة ${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `ورقة ${i + 1}`;
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: rtl ?? t.dir === 'rtl', state: t.header ? 'frozen' : 'normal', ySplit: t.header ? 1 : 0 }] });
    const total = (t.colWidths || []).reduce((a, b) => a + b, 0);
    for (let c = 0; c < t.cols; c++) {
      let w = 18;
      if (t.colWidths && total) w = Math.max(8, Math.round((t.colWidths[c] / total) * t.cols * 18));
      if (t.colWidthChars && t.colWidthChars[c]) w = t.colWidthChars[c];
      ws.getColumn(c + 1).width = w;
    }
    if (t.rowHeights) { const m = t.rowHeights.reduce((a, b) => a + b, 0) / t.rows; t.rowHeights.forEach((h, r) => { ws.getRow(r + 1).height = Math.max(18, Math.round((h / m) * 22)); }); }
    for (const cell of t.cells) {
      const x = ws.getCell(cell.r + 1, cell.c + 1);
      const n = cell.type === 'text' ? null : toNumber(cell.text);
      x.value = cell.formula ? { formula: cell.formula } : n !== null ? n : cell.text;
      const isHeader = t.header && cell.r === 0;
      x.font = { name: cell.font || 'Arial', size: cell.size || 11, bold: !!(cell.bold || isHeader), italic: !!cell.italic, color: cell.color ? { argb: 'FF' + cell.color.replace('#', '') } : undefined };
      x.alignment = { vertical: 'middle', horizontal: cell.align || (n !== null ? 'center' : (t.dir === 'rtl' ? 'right' : 'left')), wrapText: true, readingOrder: t.dir === 'rtl' ? 'rtl' : 'ltr' };
      x.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      if (cell.fill || isHeader) x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (cell.fill || 'E8EEF7').replace('#', '') } };
    }
    for (const cell of t.cells) if (cell.rs > 1 || cell.cs > 1) ws.mergeCells(cell.r + 1, cell.c + 1, cell.r + cell.rs, cell.c + cell.cs);
    if (t.autoFilter && t.rows > 1) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.cols } };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
module.exports = { buildXlsx, toNumber };
