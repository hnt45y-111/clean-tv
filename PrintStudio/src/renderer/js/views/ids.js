import { $, $$, esc, call, run, toast, confirmBox, icon, actions, fileUrl } from '../util.js';
import { S } from '../state.js';
import { openSimpleExport } from '../export-dialog.js';

// حالة المحرر تبقى أثناء التنقل بين الصفحات
const E = window.__idEditor || (window.__idEditor = { cards: [], idents: [], active: null, items: [], sel: null, page: 0, paper: 'A4', orientation: 'portrait', cw: 85.6, ch: 54, gap: 5, margin: 10, border: true, snap: false, grid: 5, zoom: 0, pairMode: 'side' });
const PAPERS = { A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [215.9, 279.4] };
let uidn = Date.now(); const uid = () => 'i' + (uidn++).toString(36);
const dim = () => { const [w, h] = PAPERS[E.paper]; return E.orientation === 'landscape' ? { w: h, h: w } : { w, h }; };

export async function mount(root) {
  E.cards = await call('cardsList'); const presets = await call('idPresets');
  if (!E.idents.length) newIdent();
  let guides = [];
  function newIdent() { const i = { id: uid(), name: `هوية ${E.idents.length + 1}`, front: null, back: null }; E.idents.push(i); E.active = i.id; return i; }
  const cardOf = (id) => E.cards.find((c) => c.id === id);
  const scale = () => { const box = $('#pbox', root); const z = E.zoom || Math.max(1, Math.min(3.4, ((box ? box.clientWidth : 700) - 50) / dim().w)); return z; };

  function draw() {
    const act = E.idents.find((i) => i.id === E.active) || E.idents[0]; const sel = E.items.find((i) => i.key === E.sel);
    const pages = Math.max(1, ...E.items.map((i) => (i.page || 0) + 1));
    root.innerHTML = `<div class="page-h"><span class="tag">ID</span><h1>سكانر الهويات والباجات</h1><span class="grow"></span><button class="btn green" data-act="export" ${E.items.length ? '' : 'disabled'}>${icon('save')} حفظ وتصدير</button></div>
    <div class="id-wrap">
      <div class="card sidepanel" style="padding:12px"><h3>الهويات</h3>
        <div class="col">${E.idents.map((i) => `<div class="card-t ${i.id === E.active ? 'on' : ''}" style="${i.id === E.active ? 'border-color:var(--cyan)' : ''}" data-act="act" data-id="${i.id}">
          <div class="grow"><b>${esc(i.name)}</b><div class="sbs" style="margin-top:4px">${['front', 'back'].map((s) => { const c = cardOf(i[s]); return `<div style="text-align:center;font-size:11px" class="sub">${s === 'front' ? 'أمامي' : 'خلفي'}<br>${c ? `<img src="${fileUrl(c.thumb)}" style="width:62px;height:40px;object-fit:cover;border-radius:4px;background:#fff" alt="">` : '<div style="width:62px;height:40px;border:1px dashed var(--edge);border-radius:4px"></div>'}</div>`; }).join('')}</div></div>
          <button class="btn sm red" data-act="del-ident" data-id="${i.id}" title="حذف">${icon('trash')}</button></div>`).join('')}</div>
        <button class="btn sm ghost" data-act="new-ident">${icon('plus')} هوية جديدة</button>
        <hr style="border-color:var(--edge2);width:100%"><h3>مسح الوجوه — «${esc(act.name)}»</h3>
        <div class="col"><button class="btn sm" data-act="scan-front">${icon('scan')} مسح الوجه الأمامي</button><button class="btn sm purple" data-act="scan-back">${icon('scan')} مسح الوجه الخلفي</button><button class="btn sm ghost" data-act="imp-front">${icon('folder')} استيراد أمامي</button><button class="btn sm ghost" data-act="imp-back">${icon('folder')} استيراد خلفي</button></div>
        <div class="sub" style="font-size:12px">ضع البطاقة على زجاج السكانر ثم اضغط. يُقصّ حدّها تلقائياً.</div></div>
      <div class="col" style="min-width:0;min-height:0"><div class="card" style="padding:10px"><div class="row" style="gap:8px">
        <label class="f">الورقة<select data-p="paper">${Object.keys(PAPERS).map((k) => `<option ${k === E.paper ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="f">الاتجاه<select data-p="orientation"><option value="portrait" ${E.orientation === 'portrait' ? 'selected' : ''}>طولي</option><option value="landscape" ${E.orientation === 'landscape' ? 'selected' : ''}>عرضي</option></select></label>
        <label class="f">مقاس البطاقة<select id="preset"><option value="">مخصّص</option>${Object.entries(presets).map(([k, [w, h]]) => `<option value="${w}x${h}" ${w === E.cw && h === E.ch ? 'selected' : ''}>${esc(k)} (${w}×${h})</option>`).join('')}</select></label>
        <label class="f">العرض مم<input type="number" step="0.1" data-p="cw" value="${E.cw}" style="width:80px"></label><label class="f">الارتفاع مم<input type="number" step="0.1" data-p="ch" value="${E.ch}" style="width:80px"></label>
        <label class="f">التباعد مم<input type="number" step="0.5" data-p="gap" value="${E.gap}" style="width:70px"></label>
        <label class="f">وضع الأوجه<select data-p="pairMode"><option value="side" ${E.pairMode === 'side' ? 'selected' : ''}>جنب بعض</option><option value="stack" ${E.pairMode === 'stack' ? 'selected' : ''}>فوق بعض</option></select></label></div>
        <div class="row" style="margin-top:8px"><button class="btn sm" data-act="arrange">${icon('wand')} ترتيب تلقائي</button><button class="btn sm ghost" data-act="add-sel">إضافة أوجه الهوية الحالية للورقة</button><button class="btn sm red" data-act="clear-paper">إفراغ الورقة</button>
          <label class="chk"><input type="checkbox" data-p="border" ${E.border ? 'checked' : ''}> إطار</label><label class="chk"><input type="checkbox" data-p="snap" ${E.snap ? 'checked' : ''}> محاذاة للشبكة</label>
          <label class="f" style="flex-direction:row;align-items:center;gap:6px">تكبير<input type="range" min="1" max="4" step="0.1" value="${scaleVal()}" id="zoom" style="width:110px"></label>
          ${pages > 1 ? `<div class="seg">${Array.from({ length: pages }, (_, k) => `<button class="${k === E.page ? 'on' : ''}" data-act="pg" data-k="${k}">صفحة ${k + 1}</button>`).join('')}</div>` : ''}</div></div>
        <div class="paper-box" id="pbox"><div class="paper ${E.snap ? 'grid' : ''}" id="paper"></div></div></div>
      <div class="card sidepanel props" style="padding:12px"><h3>خصائص العنصر</h3>${sel ? props(sel) : '<div class="sub">اختر بطاقة على الورقة لتعديل موضعها وحجمها، أو اسحبها بالفأرة. الأسهم تحرّك 0.5 مم (+Shift = 5 مم).</div>'}</div></div>`;
    paintPaper(); wire();
  }
  const scaleVal = () => (E.zoom || 2.4);
  const props = (it) => `<div class="num-g"><label class="f">X (مم)<input type="number" step="0.1" data-i="x" value="${it.x.toFixed(1)}"></label><label class="f">Y (مم)<input type="number" step="0.1" data-i="y" value="${it.y.toFixed(1)}"></label>
    <label class="f">العرض<input type="number" step="0.1" data-i="w" value="${it.w.toFixed(1)}"></label><label class="f">الارتفاع<input type="number" step="0.1" data-i="h" value="${it.h.toFixed(1)}"></label>
    <label class="f">الدوران °<input type="number" step="1" data-i="rot" value="${Math.round(it.rot || 0)}"></label></div>
    <div class="row"><button class="btn sm ghost" data-act="rot90">${icon('rot')} 90°</button><button class="btn sm ghost" data-act="dup">نسخ</button><button class="btn sm red" data-act="del">${icon('trash')} حذف</button></div>
    <div class="sub" style="font-size:12px">${esc(it.label || '')}</div>`;

  function paintPaper() {
    const z = scale(), d = dim(), paper = $('#paper', root); if (!paper) return; paper.style.width = d.w * z + 'px'; paper.style.height = d.h * z + 'px'; paper.innerHTML = '';
    if (E.snap) paper.style.backgroundSize = `${E.grid * z}px ${E.grid * z}px`;
    for (const it of E.items.filter((i) => (i.page || 0) === E.page)) { const el = document.createElement('div'); el.className = 'idc' + (it.key === E.sel ? ' sel' : ''); el.dataset.key = it.key; const c = cardOf(it.cardId);
      el.innerHTML = `<img src="${c ? fileUrl(c.file) : ''}" alt="">${E.border ? '<div style="position:absolute;inset:0;border:1px solid #444;pointer-events:none"></div>' : ''}` + (it.key === E.sel ? '<div class="h nw" data-h="nw"></div><div class="h ne" data-h="ne"></div><div class="h sw" data-h="sw"></div><div class="h se" data-h="se"></div><div class="h rot" data-h="rot" title="تدوير"></div>' : '');
      place(el, it, z); paper.append(el); }
    for (const g of guides) { const e = document.createElement('div'); e.className = 'guide ' + (g.v ? 'v' : 'hh'); if (g.v) e.style.left = g.pos * z + 'px'; else e.style.top = g.pos * z + 'px'; paper.append(e); }
  }
  const place = (el, it, z) => { el.style.left = it.x * z + 'px'; el.style.top = it.y * z + 'px'; el.style.width = it.w * z + 'px'; el.style.height = it.h * z + 'px'; el.style.transform = `rotate(${it.rot || 0}deg)`; };

  function wire() {
    $$('[data-p]', root).forEach((el) => (el.onchange = () => { const k = el.dataset.p; E[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value; draw(); }));
    $('#preset', root).onchange = (e) => { if (e.target.value) { const [w, h] = e.target.value.split('x').map(Number); E.cw = w; E.ch = h; draw(); } };
    $('#zoom', root).oninput = (e) => { E.zoom = +e.target.value; paintPaper(); };
    $$('[data-i]', root).forEach((el) => (el.onchange = () => { const it = E.items.find((i) => i.key === E.sel); it[el.dataset.i] = +el.value; paintPaper(); }));
    const paper = $('#paper', root);
    paper.onpointerdown = (e) => {
      const el = e.target.closest('.idc'); if (!el) { if (E.sel) { E.sel = null; draw(); } return; }
      e.preventDefault(); const it = E.items.find((i) => i.key === el.dataset.key); const hnd = e.target.dataset.h; const reselect = E.sel !== it.key; E.sel = it.key;
      if (reselect) { paintPaper(); const pr = $('.props', root); pr.innerHTML = '<h3>خصائص العنصر</h3>' + props(it); $$('[data-i]', pr).forEach((x) => (x.onchange = () => { it[x.dataset.i] = +x.value; paintPaper(); })); }
      const z = scale(), sx = e.clientX, sy = e.clientY, o = { ...it }; const live = () => $('.idc.sel', paper);
      const cx0 = (o.x + o.w / 2) * z, cy0 = (o.y + o.h / 2) * z; const pr0 = paper.getBoundingClientRect();
      const mv = (ev) => {
        const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z; const th = ((o.rot || 0) * Math.PI) / 180;
        if (hnd === 'rot') { let a = (Math.atan2(ev.clientY - (pr0.top + cy0), ev.clientX - (pr0.left + cx0)) * 180) / Math.PI + 90; a = ((a % 360) + 360) % 360; const n = Math.round(a / 15) * 15; it.rot = Math.abs(a - n) < 4 ? n % 360 : Math.round(a); }
        else if (hnd) { const lx = dx * Math.cos(th) + dy * Math.sin(th), ly = -dx * Math.sin(th) + dy * Math.cos(th); const sgx = hnd.includes('e') ? 1 : -1, sgy = hnd.includes('s') ? 1 : -1; const nw = Math.max(5, o.w + sgx * lx), nh = Math.max(5, o.h + sgy * ly);
          if (!o.rot) { it.x = hnd.includes('w') ? o.x + o.w - nw : o.x; it.y = hnd.includes('n') ? o.y + o.h - nh : o.y; } else { it.x = o.x + (o.w - nw) / 2; it.y = o.y + (o.h - nh) / 2; } it.w = nw; it.h = nh; }
        else { let nx = o.x + dx, ny = o.y + dy; guides = []; const d = dim(); const thr = 1.4;
          if (E.snap) { nx = Math.round(nx / E.grid) * E.grid; ny = Math.round(ny / E.grid) * E.grid; }
          else { const xs = [0, d.w / 2, d.w], ys = [0, d.h / 2, d.h]; for (const q of E.items) if (q.key !== it.key && (q.page || 0) === E.page) { xs.push(q.x, q.x + q.w / 2, q.x + q.w); ys.push(q.y, q.y + q.h / 2, q.y + q.h); }
            let bx = thr, by = thr; for (const [off] of [[0], [it.w / 2], [it.w]]) for (const g of xs) { const df = Math.abs(nx + off - g); if (df < bx) { bx = df; guides = guides.filter((x) => !x.v); guides.push({ v: true, pos: g }); nx = g - off; } }
            for (const [off] of [[0], [it.h / 2], [it.h]]) for (const g of ys) { const df = Math.abs(ny + off - g); if (df < by) { by = df; guides = guides.filter((x) => x.v); guides.push({ v: false, pos: g }); ny = g - off; } } }
          it.x = nx; it.y = ny; }
        const el2 = live(); if (el2) place(el2, it, z); $$('.guide', paper).forEach((g) => g.remove()); for (const g of guides) { const ge = document.createElement('div'); ge.className = 'guide ' + (g.v ? 'v' : 'hh'); if (g.v) ge.style.left = g.pos * z + 'px'; else ge.style.top = g.pos * z + 'px'; paper.append(ge); }
      };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); guides = []; draw(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
  }
  const keyH = (e) => { const it = E.items.find((i) => i.key === E.sel); if (!it || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return; const st = e.shiftKey ? 5 : 0.5;
    if (e.key === 'Delete') { E.items = E.items.filter((i) => i !== it); E.sel = null; draw(); } else if (e.key === 'ArrowLeft') it.x -= st; else if (e.key === 'ArrowRight') it.x += st; else if (e.key === 'ArrowUp') it.y -= st; else if (e.key === 'ArrowDown') it.y += st; else return; e.preventDefault(); paintPaper(); };
  document.addEventListener('keydown', keyH);

  function addIdentToPaper(idn, x0, y0) { let n = 0; for (const s of ['front', 'back']) if (idn[s]) { const c = cardOf(idn[s]); const key = `${idn.id}:${s}:${uid()}`; E.items.push({ key, identity: idn.id, side: s, cardId: idn[s], x: x0 + n * (E.cw + E.gap), y: y0, w: E.cw, h: E.ch, rot: 0, page: E.page, label: `${idn.name} — ${s === 'front' ? 'أمامي' : 'خلفي'}` }); void c; n++; } if (!n) throw new Error('هذه الهوية بلا صور بعد — امسح أو استورد وجهاً أولاً'); }
  async function scanSide(side) {
    const idn = E.idents.find((i) => i.id === E.active); const c = await call('cardScan'); E.cards = await call('cardsList'); idn[side] = c.id; toast(`تم مسح الوجه ${side === 'front' ? 'الأمامي' : 'الخلفي'}`, 'ok'); draw();
  }
  async function impSide(side) { const idn = E.idents.find((i) => i.id === E.active); const r = await call('cardImport'); if (!r.length) return; E.cards = await call('cardsList'); idn[side] = r[0].id; draw(); }

  actions(root, {
    act: (b, e) => { if (e.target.closest('[data-act=del-ident]')) return; E.active = b.dataset.id; draw(); },
    'new-ident': () => { newIdent(); draw(); },
    'del-ident': async (b) => { const id = b.dataset.id; if (E.idents.length === 1) { toast('يجب أن تبقى هوية واحدة على الأقل', 'warn'); return; } E.idents = E.idents.filter((i) => i.id !== id); E.items = E.items.filter((i) => i.identity !== id); if (E.active === id) E.active = E.idents[0].id; draw(); },
    'scan-front': (b) => run(b, () => scanSide('front')), 'scan-back': (b) => run(b, () => scanSide('back')),
    'imp-front': (b) => run(b, () => impSide('front')), 'imp-back': (b) => run(b, () => impSide('back')),
    'add-sel': () => run(null, async () => { const idn = E.idents.find((i) => i.id === E.active); addIdentToPaper(idn, E.margin, E.margin + (E.items.filter((i) => (i.page || 0) === E.page).length ? E.ch + E.gap : 0)); draw(); }),
    arrange: (b) => run(b, async () => { const ids = E.idents.filter((i) => i.front || i.back).map((i) => ({ id: i.id, front: i.front, back: i.back })); if (!ids.length) throw new Error('لا توجد هويات ممسوحة بعد');
      const r = await call('idsArrange', ids, { paper: E.paper, orientation: E.orientation, cardW: E.cw, cardH: E.ch, gap: E.gap, margin: E.margin, pairMode: E.pairMode });
      E.items = r.items.map((it) => { const idn = E.idents.find((x) => x.id === it.identity); return { ...it, key: `${it.identity}:${it.side}:${uid()}`, cardId: idn[it.side], label: `${idn.name} — ${it.side === 'front' ? 'أمامي' : 'خلفي'}` }; }); E.page = 0; E.sel = null; draw(); if (r.pages > 1) toast(`الهويات تحتاج ${r.pages} صفحات`, 'warn'); }),
    'clear-paper': async () => { if (E.items.length && await confirmBox('إفراغ الورقة؟', 'إفراغ', true)) { E.items = []; E.sel = null; draw(); } },
    pg: (b) => { E.page = +b.dataset.k; E.sel = null; draw(); },
    rot90: () => { const it = E.items.find((i) => i.key === E.sel); it.rot = ((it.rot || 0) + 90) % 360; draw(); },
    dup: () => { const it = E.items.find((i) => i.key === E.sel); const c = { ...it, key: it.key.split(':').slice(0, 2).join(':') + ':' + uid(), x: it.x + 5, y: it.y + 5 }; E.items.push(c); E.sel = c.key; draw(); },
    del: () => { E.items = E.items.filter((i) => i.key !== E.sel); E.sel = null; draw(); },
    export: () => {
      const dpiOpt = `<label class="f">دقة الصورة (للتصدير كصورة / PDF)<select id="e-dpi"><option>150</option><option selected>300</option><option>600</option></select></label><p class="sub" style="font-size:12px;margin:0">Word: كل هوية صورة مستقلة قابلة للسحب والتحجيم داخل Word. الصفحات المتعددة تُحفظ في PDF أو صور.</p>`;
      openSimpleExport({ title: 'تصدير ورقة الهويات', formats: [['pdf', 'PDF'], ['docx', 'Word'], ['png', 'PNG'], ['jpg', 'JPG']], extra: dpiOpt, defaultName: 'هويات',
        onExport: async ({ name, format, dir, m }) => call('idsExport', { name, format, dir, dpi: +$('#e-dpi', m).value, layout: { paper: E.paper, orientation: E.orientation, border: E.border, items: E.items.map((i) => ({ cardId: i.cardId, x: i.x, y: i.y, w: i.w, h: i.h, rot: i.rot || 0, page: i.page || 0, label: i.label })) } }) });
    },
  });
  draw(); window.addEventListener('resize', paintPaper);
  return () => { document.removeEventListener('keydown', keyH); window.removeEventListener('resize', paintPaper); };
}
