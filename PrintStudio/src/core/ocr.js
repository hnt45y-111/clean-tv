'use strict';
// محرك OCR: Tesseract (ara+eng) عبر tesseract.js مع بيانات لغة محلية (يعمل دون إنترنت).
const path = require('path');
const { createWorker, PSM } = require('tesseract.js');

class Ocr {
  constructor({ langPath, langs = 'ara+eng' } = {}) {
    this.langPath = langPath || path.join(__dirname, '..', '..', 'assets', 'tessdata');
    this.langs = langs; this.worker = null; this.q = Promise.resolve(); this._init = null;
  }
  async init() {
    if (!this._init) this._init = createWorker(this.langs, 1, { langPath: this.langPath, gzip: true, cacheMethod: 'none' }).then((w) => { this.worker = w; return w; });
    return this._init;
  }
  _enqueue(fn) { const p = this.q.then(fn, fn); this.q = p.catch(() => {}); return p; }
  /** يعيد {text, confidence, lines:[{text,conf,bbox,words:[{text,conf,bbox}]}], paragraphs} */
  recognize(buf, { psm = PSM.AUTO, onProgress } = {}) {
    return this._enqueue(async () => {
      const w = await this.init();
      await w.setParameters({ tessedit_pageseg_mode: String(psm), preserve_interword_spaces: '0' });
      const { data } = await w.recognize(buf, {}, { blocks: true });
      void onProgress;
      const lines = [];
      for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
        const words = (l.words || []).map((x) => ({ text: x.text, conf: x.confidence, bbox: x.bbox })).filter((x) => x.text.trim());
        if (!words.length) continue;
        lines.push({ text: l.text.replace(/\s+$/, ''), conf: l.confidence, bbox: l.bbox, words, para: lines.length ? undefined : 0 });
      }
      return { text: data.text, confidence: data.confidence, lines, blocks: data.blocks };
    });
  }
  async terminate() { if (this.worker) { await this.worker.terminate(); this.worker = null; this._init = null; } }
}
module.exports = { Ocr, PSM };
