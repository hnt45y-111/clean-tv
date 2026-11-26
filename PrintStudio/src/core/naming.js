'use strict';
// تسمية الملفات: اسم يكتبه المستخدم + امتداد يُضاف تلقائياً حسب الصيغة، دون تكرار.
const fs = require('fs');
const path = require('path');

const EXT = { pdf: '.pdf', docx: '.docx', xlsx: '.xlsx', jpg: '.jpg', png: '.png', txt: '.txt' };
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function extFor(format) {
  const e = EXT[String(format).toLowerCase()];
  if (!e) throw new Error('صيغة غير مدعومة: ' + format);
  return e;
}

/** ينظّف الاسم ويحذف الامتداد إن كتبه المستخدم بنفس صيغة التصدير (لا تكرار). */
function baseName(input, format) {
  let n = String(input == null ? '' : input).replace(ILLEGAL, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  const ext = extFor(format);
  const same = (l) => l.endsWith(ext) || (ext === '.jpg' && l.endsWith('.jpeg'));
  // احذف الامتداد المطابق للصيغة المختارة (حتى لو تكرر: "تقرير.pdf.pdf")
  for (let i = 0; i < 4; i++) {
    const l = n.toLowerCase();
    if (!same(l)) break;
    const cut = l.endsWith('.jpeg') ? 5 : ext.length;
    if (n.length <= cut) break;
    n = n.slice(0, -cut).replace(/[. ]+$/, '');
  }
  if (!n || RESERVED.test(n)) n = 'مستند';
  return n.length > 150 ? n.slice(0, 150).trim() : n;
}

function fileName(input, format) { return baseName(input, format) + extFor(format); }

/** مسار فريد: إذا كان الملف موجوداً يضيف (2) (3) ... */
function uniquePath(dir, input, format, { overwrite = false } = {}) {
  const base = baseName(input, format), ext = extFor(format);
  let p = path.join(dir, base + ext);
  if (overwrite) return p;
  let i = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
  return p;
}

/** ملفات متعددة الصفحات للصور: اسم-1.jpg، اسم-2.jpg ... */
function numberedPath(dir, input, format, n, total) {
  const base = baseName(input, format), ext = extFor(format);
  const w = String(total).length;
  return path.join(dir, `${base}-${String(n).padStart(w, '0')}${ext}`);
}

module.exports = { extFor, baseName, fileName, uniquePath, numberedPath };
