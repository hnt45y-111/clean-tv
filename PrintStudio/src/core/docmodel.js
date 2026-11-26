'use strict';
// يحوّل أسطر OCR إلى نموذج مستند: فقرات/عناوين/قوائم مع الاتجاه والمحاذاة والثقة.
const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
const LAT = /[A-Za-z]/g;
const LOW_CONF = 70;

function arabicRatio(s) {
  const a = (s.match(AR) || []).length, l = (s.match(LAT) || []).length;
  return a + l ? a / (a + l) : -1;
}
function dirOf(s, fallback = 'rtl') { const r = arabicRatio(s); return r < 0 ? fallback : r >= 0.4 ? 'rtl' : 'ltr'; }

/** تصحيحات معروفة لمخرجات Tesseract العربية (ترتيب علامات الترقيم والترقيم الرقمي). */
function fixLine(text, dir) {
  let t = text.replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
  if (dir === 'rtl') {
    // "1. نص" يخرج أحياناً ".نص.1" : نقطة في الأول ورقم في الآخر
    let m = t.match(/^[.\-)]\s*(.+?)\s*[.\-)](\d{1,3})$/);
    if (m && arabicRatio(m[1]) > 0.4) return `${m[2]}. ${m[1]}`;
    // نقطة ختامية انتقلت لأول السطر
    m = t.match(/^([.،؛:!؟])(.+)$/);
    if (m && arabicRatio(m[2]) > 0.4) t = m[2].trim() + m[1];
  }
  return t;
}

const LIST_RE = /^\s*(?:(\d{1,3}|[٠-٩]{1,3})\s*[.)\-]|[•\-–*▪●])\s*(.+)$/;

function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; }

function linesToBlocks(rawLines, { pageW, pageH, dpi = 300, defaultDir = 'rtl' } = {}) {
  const lines = rawLines.map((l) => ({ ...l, h: l.bbox.y1 - l.bbox.y0 })).filter((l) => l.text && l.text.trim()).sort((a, b) => a.bbox.y0 - b.bbox.y0);
  if (!lines.length) return [];
  const mh = median(lines.map((l) => l.h)) || 20;
  pageW = pageW || Math.max(...lines.map((l) => l.bbox.x1)) * 1.1;
  const blocks = []; let cur = null;
  const flush = () => { if (cur) { blocks.push(cur); cur = null; } };
  for (const l of lines) {
    const dir = dirOf(l.text, defaultDir);
    const fixed = fixLine(l.text, dir);
    const m = fixed.match(LIST_RE);
    const isList = !!m && fixed.length > 3 && !/^\d{1,3}[.)]?\s*$/.test(fixed);
    const cx = (l.bbox.x0 + l.bbox.x1) / 2;
    const centered = Math.abs(cx - pageW / 2) < pageW * 0.04 && (l.bbox.x1 - l.bbox.x0) < pageW * 0.75;
    const align = centered ? 'center' : dir === 'rtl' ? 'right' : 'left';
    const heading = (l.h >= mh * 1.35 && fixed.length <= 90) || (centered && l.h >= mh * 1.15 && fixed.length <= 60);
    const words = l.words.map((w) => ({ text: w.text, conf: w.conf, low: w.conf < LOW_CONF }));
    const sizePt = Math.max(8, Math.min(48, Math.round(((l.h / dpi) * 72 * 0.8) * 2) / 2));
    
    const type = heading ? 'heading' : isList ? 'list' : 'paragraph';
    const gap = cur ? l.bbox.y0 - cur.bbox.y1 : 1e9;
    const canJoin = cur && type === 'paragraph' && cur.type === 'paragraph' && gap < mh * 0.6 && cur.dir === dir && cur.align === align && Math.abs(cur.sizePt - sizePt) <= 1.5;
    if (canJoin) {
      cur.text += ' ' + fixed; cur.words.push(...words); cur.lines.push({ text: fixed, bbox: { ...l.bbox } });
      cur.bbox = { x0: Math.min(cur.bbox.x0, l.bbox.x0), y0: cur.bbox.y0, x1: Math.max(cur.bbox.x1, l.bbox.x1), y1: l.bbox.y1 };
    } else {
      flush();
      const body = isList ? m[2].trim() : fixed;
      cur = { type, dir, align, lines: [{ text: fixed, bbox: { ...l.bbox } }], text: body, words: isList ? l.words.map((w) => ({ text: w.text, conf: w.conf, low: w.conf < LOW_CONF })) : words, sizePt, bbox: { ...l.bbox } };
      if (type === 'heading') cur.level = l.h >= mh * 1.5 ? 1 : 2;
      if (isList) { cur.marker = /^\d|^[٠-٩]/.test(m[1] || '') ? `${m[1]}.` : '•'; cur.ordered = !!m[1]; }
      if (type !== 'paragraph') flush();
    }
  }
  flush();
  // تثبيت أحجام الخط القريبة من حجم النص الأساسي (تباين الارتفاع بين الأسطر ضجيج لا فرق حقيقي)
  const body = median(blocks.filter((b) => b.type !== 'heading').map((b) => b.sizePt)) || 12;
  for (const b of blocks) if (b.type !== 'heading' && Math.abs(b.sizePt - body) <= body * 0.4) b.sizePt = body;
  for (const b of blocks) {
    b.lowConfCount = b.words.filter((w) => w.low).length;
    b.conf = b.words.length ? Math.round(b.words.reduce((s, w) => s + w.conf, 0) / b.words.length) : 0;
  }
  void pageH;
  return blocks;
}

module.exports = { arabicRatio, dirOf, fixLine, linesToBlocks, LOW_CONF };
