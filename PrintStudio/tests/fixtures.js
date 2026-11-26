// صور اختبار اصطناعية (جدول + خطاب رسمي) تُرسم بـ SVG ثم تُحوَّل إلى PNG.
const sharp = require('sharp');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function tablePng() {
  const W = 1240, H = 800, x0 = 80, y0 = 120, cw = [300, 260, 300, 300], rh = 90;
  const rows = [
    ['الاسم', 'القسم', 'الراتب', 'ID'],
    ['علي حسن', 'المحاسبة', '750000', '101'],
    ['Sara Ahmed', 'IT', '900000', '102'],
    ['محمد كريم', 'المبيعات', '820000', '103'],
  ];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>`;
  s += `<text x="${W / 2}" y="70" font-size="40" font-family="DejaVu Sans" text-anchor="middle" fill="#000">جدول الموظفين</text>`;
  const tw = cw.reduce((a, b) => a + b, 0);
  for (let r = 0; r <= rows.length; r++) s += `<line x1="${x0}" y1="${y0 + r * rh}" x2="${x0 + tw}" y2="${y0 + r * rh}" stroke="#000" stroke-width="3"/>`;
  let x = x0; const xs = [x0]; for (const w of cw) { x += w; xs.push(x); }
  xs.forEach((xx) => (s += `<line x1="${xx}" y1="${y0}" x2="${xx}" y2="${y0 + rows.length * rh}" stroke="#000" stroke-width="3"/>`));
  rows.forEach((row, r) => row.forEach((t, c) => {
    const ci = cw.length - 1 - c; // الجدول RTL: العمود الأول في أقصى اليمين
    const cx = (xs[ci] + xs[ci + 1]) / 2;
    s += `<text x="${cx}" y="${y0 + r * rh + 58}" font-size="36" font-family="DejaVu Sans" text-anchor="middle" fill="#000">${esc(t)}</text>`;
  }));
  s += '</svg>';
  return sharp(Buffer.from(s)).png().toBuffer();
}

async function letterPng() {
  const W = 1240, H = 1754;
  const L = (y, t, o = {}) => `<text x="${o.x ?? W - 100}" y="${y}" font-size="${o.size ?? 34}" font-family="DejaVu Sans" text-anchor="${o.anchor ?? 'end'}" font-weight="${o.bold ? 'bold' : 'normal'}" fill="#000">${esc(t)}</text>`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>`;
  s += L(150, 'جمهورية العراق', { x: W / 2, anchor: 'middle', size: 52, bold: true });
  s += L(220, 'وزارة التربية', { x: W / 2, anchor: 'middle', size: 44, bold: true });
  s += L(330, 'العدد: 1234');
  s += L(390, 'التاريخ: 2026/03/15');
  s += L(500, 'م / طلب إجازة');
  s += L(620, 'نرجو التفضل بالموافقة على منح الموظف المذكور إجازة اعتيادية لمدة خمسة أيام.');
  s += L(690, 'وذلك لظروفه الخاصة، مع فائق الشكر والتقدير لجهودكم المبذولة.');
  s += L(800, '1. تسليم الطلب إلى الشؤون الإدارية.');
  s += L(860, '2. مراجعة رصيد الإجازات.');
  s += L(1000, 'Please find the attached documents for your review.', { x: 100, anchor: 'start', dir: 'ltr' });
  s += L(1060, 'Best regards, Human Resources Department.', { x: 100, anchor: 'start', dir: 'ltr' });
  s += '</svg>';
  return sharp(Buffer.from(s)).png().toBuffer();
}
module.exports = { tablePng, letterPng };
