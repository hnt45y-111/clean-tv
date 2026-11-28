// قراءة PDF وتحويل صفحاته إلى صور داخل الواجهة (pdf.js محلي).
let lib = null;
async function L() { if (!lib) { lib = await import('../vendor/pdf.min.mjs'); lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href; } return lib; }
export async function getLib() { return L(); }
export async function openPdf(bytes) { const p = await L(); return p.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise; }
export async function renderPage(doc, n, scale = 1.5, type = 'image/png', q = 0.9) {
  const page = await doc.getPage(n), vp = page.getViewport({ scale }); const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return new Promise((res) => c.toBlob(async (b) => res({ blob: b, url: URL.createObjectURL(b), buf: await b.arrayBuffer(), w: c.width, h: c.height }), type, q));
}
/** يحوّل كل صفحات PDF لصور (dpi تقريبي: 72*scale) */
export async function pdfToImages(bytes, { dpi = 150, type = 'image/png', quality = 0.9, onProgress } = {}) {
  const doc = await openPdf(bytes); const out = [];
  for (let i = 1; i <= doc.numPages; i++) { out.push(await renderPage(doc, i, dpi / 72, type, quality)); if (onProgress) onProgress(i, doc.numPages); }
  return out;
}
