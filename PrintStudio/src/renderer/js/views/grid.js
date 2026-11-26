// محرر جدول قابل للتحرير (خلايا حقيقية، إضافة/حذف صفوف وأعمدة، فرز وتصفية، عرض/ارتفاع).
import { esc, toast, icon } from '../util.js';

export const letters = (n) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - m) / 26); } return s; };
const owner = (t) => { const g = Array.from({ length: t.rows }, () => new Array(t.cols).fill(null)); for (const c of t.cells) for (let a = 0; a < c.rs; a++) for (let b = 0; b < c.cs; b++) if (g[c.r + a]) g[c.r + a][c.c + b] = c; return g; };

export const ops = {
  addRow(t, at) { for (const c of t.cells) { if (c.r >= at) c.r++; else if (c.r + c.rs > at) c.rs++; } t.rows++; t.rowHeights.splice(at, 0, t.rowHeights[Math.min(at, t.rowHeights.length - 1)] || 40);
    const g = owner(t); for (let c = 0; c < t.cols; c++) if (!g[at][c]) t.cells.push({ r: at, c, rs: 1, cs: 1, text: '', conf: 100, low: false }); },
  delRow(t, r) { if (t.rows <= 1) throw new Error('لا يمكن حذف آخر صف'); const out = []; for (const c of t.cells) { if (c.r === r && c.rs === 1) continue; if (c.r === r) { c.rs--; out.push(c); continue; } if (c.r > r) c.r--; else if (c.r + c.rs > r) c.rs--; out.push(c); } t.cells = out; t.rows--; t.rowHeights.splice(r, 1); },
  addCol(t, at) { for (const c of t.cells) { if (c.c >= at) c.c++; else if (c.c + c.cs > at) c.cs++; } t.cols++; t.colWidths.splice(at, 0, t.colWidths[Math.min(at, t.colWidths.length - 1)] || 100);
    const g = owner(t); for (let r = 0; r < t.rows; r++) if (!g[r][at]) t.cells.push({ r, c: at, rs: 1, cs: 1, text: '', conf: 100, low: false }); },
  delCol(t, k) { if (t.cols <= 1) throw new Error('لا يمكن حذف آخر عمود'); const out = []; for (const c of t.cells) { if (c.c === k && c.cs === 1) continue; if (c.c === k) { c.cs--; out.push(c); continue; } if (c.c > k) c.c--; else if (c.c + c.cs > k) c.cs--; out.push(c); } t.cells = out; t.cols--; t.colWidths.splice(k, 1); },
  sort(t, col, asc) { if (t.cells.some((c) => c.rs > 1 || c.cs > 1)) throw new Error('لا يمكن الفرز مع وجود خلايا مدموجة'); const start = t.header ? 1 : 0; const rows = []; for (let r = start; r < t.rows; r++) rows.push(t.cells.filter((c) => c.r === r)); const key = (row) => { const c = row.find((x) => x.c === col); return c ? c.text : ''; }; const num = (s) => { const n = Number(String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g, '')); return Number.isFinite(n) && String(s).trim() !== '' ? n : null; };
    rows.sort((a, b) => { const x = key(a), y = key(b), nx = num(x), ny = num(y); const r = nx !== null && ny !== null ? nx - ny : String(x).localeCompare(String(y), 'ar'); return asc ? r : -r; }); rows.forEach((row, i) => row.forEach((c) => (c.r = start + i))); },
};

/** يرسم المحرر داخل el. opts: {letters:true, onChange} */
export function gridEditor(el, t, opts = {}) {
  let sel = { r: 0, c: 0 }, filter = { col: 0, q: '' };
  const total = () => t.colWidths.reduce((a, b) => a + b, 0) || 1;
  function paint() {
    const g = owner(t); const dirRtl = t.dir === 'rtl';
    const head = opts.letters ? `<tr><th style="width:30px;cursor:default"></th>${Array.from({ length: t.cols }, (_, c) => `<th data-hc="${c}" title="العمود ${letters(c)}">${letters(c)}</th>`).join('')}</tr>` : '';
    const q = filter.q.trim();
    const rows = Array.from({ length: t.rows }, (_, r) => { const cells = []; for (let c = 0; c < t.cols; c++) { const k = g[r][c]; if (!k || k.r !== r || k.c !== c) continue; const isSel = sel.r === r && sel.c === c;
      cells.push(`<td data-r="${r}" data-c="${c}" ${k.rs > 1 ? `rowspan="${k.rs}"` : ''} ${k.cs > 1 ? `colspan="${k.cs}"` : ''} class="${t.header && r === 0 ? 'hdr' : ''} ${isSel ? 'sel' : ''}" contenteditable="plaintext-only" dir="auto" style="${k.low ? 'background:#fff3b0;' : ''}${k.bold ? 'font-weight:700;' : ''}${k.fill ? `background:#${k.fill};` : ''}${k.color ? `color:#${k.color};` : ''}text-align:${k.align || (dirRtl ? 'right' : 'left')}" title="${k.low ? 'ثقة منخفضة — راجع النص' : ''}">${esc(k.text)}</td>`); }
      const hide = q && r > (t.header ? 0 : -1) && !(g[r][filter.col] && String(g[r][filter.col].text).includes(q)); return `<tr ${hide ? 'hidden' : ''} style="height:${Math.max(26, Math.round((t.rowHeights[r] || 40) * 0.7))}px">${opts.letters ? `<th data-hr="${r}" style="cursor:default">${r + 1}</th>` : ''}${cells.join('')}</tr>`; });
    const colg = `<colgroup>${opts.letters ? '<col style="width:30px">' : ''}${t.colWidths.map((w) => `<col style="width:${Math.max(4, (w / total()) * 100).toFixed(1)}%">`).join('')}</colgroup>`;
    const k = g[sel.r] && g[sel.r][sel.c];
    el.innerHTML = `<div class="fmt-bar" data-tb>
      <button class="btn sm ghost" data-g="row-above">+ صف أعلى</button><button class="btn sm ghost" data-g="row-below">+ صف أسفل</button><button class="btn sm red" data-g="row-del">− صف</button>
      <button class="btn sm ghost" data-g="col-before">+ عمود قبل</button><button class="btn sm ghost" data-g="col-after">+ عمود بعد</button><button class="btn sm red" data-g="col-del">− عمود</button>
      <span style="width:1px;height:22px;background:var(--edge2)"></span>
      <button class="btn sm ghost" data-g="bold" title="خط عريض">B</button><input type="color" data-g="fill" title="لون الخلية" value="#${(k && k.fill) || 'ffffff'}"><input type="color" data-g="color" title="لون النص" value="#${(k && k.color) || '000000'}">
      <select data-g="align"><option value="">محاذاة</option><option value="right">يمين</option><option value="center">وسط</option><option value="left">يسار</option></select>
      <label class="sub" style="font-size:12px">عرض العمود%<input type="number" data-g="cw" min="3" max="90" value="${Math.round((t.colWidths[sel.c] || 0) / total() * 100)}" style="width:62px"></label>
      <label class="sub" style="font-size:12px">ارتفاع الصف<input type="number" data-g="rh" min="20" max="400" value="${Math.round(t.rowHeights[sel.r] || 40)}" style="width:62px"></label>
      <span style="width:1px;height:22px;background:var(--edge2)"></span>
      <button class="btn sm ghost" data-g="sort-asc">فرز ↑</button><button class="btn sm ghost" data-g="sort-desc">فرز ↓</button>
      <label class="sub" style="font-size:12px">تصفية بالعمود<select data-g="fcol">${Array.from({ length: t.cols }, (_, c) => `<option value="${c}" ${c === filter.col ? 'selected' : ''}>${letters(c)}</option>`).join('')}</select></label><input type="text" data-g="fq" value="${esc(filter.q)}" placeholder="نص التصفية" style="width:110px;padding:5px 8px">
      <button class="btn sm ghost" data-g="hdr">${t.header ? 'إلغاء رأس الجدول' : 'الصف الأول رأس'}</button><button class="btn sm ghost" data-g="flip" title="عكس ترتيب الأعمدة">⇄ عكس الأعمدة</button></div>
      <div class="grid-ed"><table dir="${t.dir === 'rtl' ? 'rtl' : 'ltr'}">${colg}<tbody>${head}${rows.join('')}</tbody></table></div>`;
    wire();
  }
  const changed = () => { if (opts.onChange) opts.onChange(t); };
  function wire() {
    el.querySelectorAll('td[data-r]').forEach((td) => {
      const cell = () => owner(t)[+td.dataset.r][+td.dataset.c];
      td.onfocus = () => { const p = { r: +td.dataset.r, c: +td.dataset.c }; if (p.r !== sel.r || p.c !== sel.c) { sel = p; el.querySelectorAll('td.sel').forEach((x) => x.classList.remove('sel')); td.classList.add('sel'); syncBar(); } };
      td.oninput = () => { const c = cell(); c.text = td.innerText.replace(/\n$/, ''); if (c.low) { c.low = false; td.style.background = ''; } changed(); };
    });
    el.querySelectorAll('th[data-hc]').forEach((h) => (h.onclick = () => { sel = { r: sel.r, c: +h.dataset.hc }; paint(); }));
    el.querySelectorAll('[data-g]').forEach((b) => {
      const k = b.dataset.g; const tr = (fn) => () => { try { fn(); changed(); paint(); } catch (e) { toast(e.message, 'err'); } };
      const cell = () => owner(t)[sel.r][sel.c];
      if (b.tagName === 'BUTTON') b.onclick = tr({
        'row-above': () => ops.addRow(t, sel.r), 'row-below': () => { const c = cell(); ops.addRow(t, c.r + c.rs); sel.r = c.r + c.rs; }, 'row-del': () => { ops.delRow(t, sel.r); sel.r = Math.min(sel.r, t.rows - 1); },
        'col-before': () => ops.addCol(t, sel.c), 'col-after': () => { const c = cell(); ops.addCol(t, c.c + c.cs); }, 'col-del': () => { ops.delCol(t, sel.c); sel.c = Math.min(sel.c, t.cols - 1); },
        bold: () => { const c = cell(); c.bold = !c.bold; }, 'sort-asc': () => ops.sort(t, sel.c, true), 'sort-desc': () => ops.sort(t, sel.c, false),
        hdr: () => { t.header = !t.header; }, flip: () => { t.cells.forEach((c) => (c.c = t.cols - 1 - c.c - (c.cs - 1))); t.colWidths.reverse(); t.dir = t.dir === 'rtl' ? 'ltr' : 'rtl'; },
      }[k]);
      else if (k === 'fill') b.onchange = () => { cell().fill = b.value.slice(1); changed(); paint(); };
      else if (k === 'color') b.onchange = () => { cell().color = b.value.slice(1); changed(); paint(); };
      else if (k === 'align') b.onchange = () => { if (b.value) { cell().align = b.value; changed(); paint(); } };
      else if (k === 'cw') b.onchange = () => { t.colWidths[sel.c] = Math.max(1, (+b.value / 100) * total()); changed(); paint(); };
      else if (k === 'rh') b.onchange = () => { t.rowHeights[sel.r] = +b.value; changed(); paint(); };
      else if (k === 'fcol') b.onchange = () => { filter.col = +b.value; paint(); };
      else if (k === 'fq') b.oninput = () => { filter.q = b.value; const pos = b.selectionStart; paint(); const nb = el.querySelector('[data-g=fq]'); nb.focus(); nb.setSelectionRange(pos, pos); };
    });
  }
  const syncBar = () => { const k = owner(t)[sel.r][sel.c]; const cw = el.querySelector('[data-g=cw]'), rh = el.querySelector('[data-g=rh]'); if (cw) cw.value = Math.round((t.colWidths[sel.c] || 0) / total() * 100); if (rh) rh.value = Math.round(t.rowHeights[sel.r] || 40); void k; };
  paint(); return { repaint: paint };
}
