// ينسخ pdf.js والخطوط من node_modules إلى الواجهة (تعمل دون إنترنت).
const fs = require('fs'); const path = require('path');
const out = path.join(__dirname, '..', 'src', 'renderer', 'vendor'); fs.mkdirSync(out, { recursive: true });
const pdf = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'build');
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(path.join(pdf, f), path.join(out, f));
const fonts = path.join(path.dirname(require.resolve('@fontsource/noto-sans-arabic/package.json')), 'files');
for (const f of ['noto-sans-arabic-arabic-400-normal.woff2', 'noto-sans-arabic-arabic-700-normal.woff2', 'noto-sans-arabic-latin-400-normal.woff2', 'noto-sans-arabic-latin-700-normal.woff2']) if (fs.existsSync(path.join(fonts, f))) fs.copyFileSync(path.join(fonts, f), path.join(out, f));
const tess = path.join(__dirname, '..', 'assets', 'tessdata'); fs.mkdirSync(tess, { recursive: true });
for (const l of ['ara', 'eng']) { const src = path.join(path.dirname(require.resolve(`@tesseract.js-data/${l}/package.json`)), '4.0.0_best_int', `${l}.traineddata.gz`); fs.copyFileSync(src, path.join(tess, `${l}.traineddata.gz`)); }
console.log('vendor ready');
