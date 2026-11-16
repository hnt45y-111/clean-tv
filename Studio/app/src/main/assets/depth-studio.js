/* «واجهة العمق» from the phone: everything about this look is set here and shown live in the preview.
   The choices go into settings.depth, which the TV reads (see CleanTV/app/src/main/assets/depth.js).
   Tap a part in the preview (clock, date, prayer…) and its sliders open here. */
(() => {
  const PL = [['snow', 'قمة ثلجية (صورة حقيقية)'], ['haibat', 'هيبت سلطان'], ['rawanduz', 'رواندوز'], ['halgurd', 'جبل حلگورد'], ['dukan', 'سد دوكان'], ['amadiya', 'دهوك وعمادية'], ['shatt', 'شط العرب'],
    ['ahwar', 'أهوار ذي قار'], ['tassili', 'طاسيلي'], ['taghit', 'تاغيت'], ['djurdjura', 'جرجرة'], ['timimoun', 'تيميمون'], ['ghardaia', 'غرداية'], ['constantine', 'قسنطينة']];
  const PROVS = ['بغداد', 'البصرة', 'نينوى', 'الأنبار', 'ديالى', 'صلاح الدين', 'كركوك', 'أربيل', 'السليمانية', 'دهوك', 'واسط', 'ميسان', 'ذي قار', 'المثنى', 'القادسية', 'بابل', 'كربلاء', 'النجف'];
  const CSTY = [['زجاجية (ضباب)', 'glass'], ['عادية', 'normal'], ['عريض', 'bold'], ['رفيع', 'thin'], ['مدوّر', 'round'], ['مائل', 'ital']];
  const WID = [['clock', 'الساعة'], ['date', 'التاريخ والمكان'], ['pray', 'الصلاة القادمة'], ['top', 'أزرار الأعلى'], ['dock', 'شريط التطبيقات'], ['matches', 'شريط المباريات'], ['news', 'شريط الأخبار']];
  const RSS = [['https://feeds.bbci.co.uk/arabic/rss.xml', 'بي بي سي عربي'], ['https://news.google.com/rss?hl=ar&gl=IQ&ceid=IQ:ar', 'أخبار العراق (Google News)'], ['https://www.skynewsarabia.com/web/rss', 'سكاي نيوز عربية'], ['https://www.alarabiya.net/feed/rss2/ar.xml', 'العربية']];
  const SENS = [['منخفضة', .7], ['متوسطة', 1], ['عالية', 1.4]];
  const css = document.createElement('style');
  css.textContent = `.dprow{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}.dprow .dpn{flex:1;text-align:right;background:none;border:0;color:inherit;font:inherit;padding:8px 4px}
    .dprow.on .dpn{color:var(--ac,#E8A25E);font-weight:700}.dprow button.m{min-width:42px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit}.dprow button.m.on{background:var(--ac,#D9822B);color:#15181B}
    .dprow.offp .dpn{opacity:.45;text-decoration:line-through}.dpnote{font-size:13px;opacity:.7;margin:6px 2px}
    .pv.dpstick{position:sticky;top:0;z-index:30;box-shadow:0 10px 30px rgba(0,0,0,.45)}`;
  document.head.appendChild(css);

  const dd = () => (D.cfg.settings.depth = D.cfg.settings.depth || {});
  const wst = id => { const w = (dd().w = dd().w || {}); return w[id] || (w[id] = { x: 0, y: 0, sx: 1, sy: 1, h: false }); };
  const push = () => { changed(); live({ settings: D.cfg.settings }); setTimeout(() => live({ dsel: D.dsel || null }), 1100); };
  const places = () => {
    const d = dd(), all = PL.concat((d.bgs || []).map((b, i) => [b.id, b.n || 'صورة ' + (i + 1)]));
    const pos = {}; (d.order || []).forEach((id, i) => pos[id] = i);
    return all.map((p, i) => [p, i]).sort((a, b) => ((pos[a[0][0]] ?? 1e4 + a[1]) - (pos[b[0][0]] ?? 1e4 + b[1]))).map(x => x[0]);
  };
  /* the preview page does the picture analysis (it has the fonts and the clock): asked by message, it answers by message */
  const waiting = {};
  window.addEventListener('message', e => { let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (x) { return; } } if (d && d.__depthResult && waiting[d.__depthResult.id]) { waiting[d.__depthResult.id](d.__depthResult.res); delete waiting[d.__depthResult.id]; } });
  const analyzeVia = (src, opts) => new Promise(res => {
    const f = $('#pvf'); if (!f || !f.contentWindow) return res(null);
    const id = 'a' + Date.now() + Math.random();
    waiting[id] = res; setTimeout(() => { if (waiting[id]) { delete waiting[id]; res(null); } }, 20000);
    f.contentWindow.postMessage(JSON.stringify({ __depthAnalyze: { id, src, opts: opts || {} } }), '*');
  });

  window.addEventListener('message', e => { const d = e.data; if (d && typeof d === 'object' && d.__dsel && D && D.cfg && D.cfg.settings.skin === 'depth') { D.dsel = d.__dsel; D.tab = 'depth'; D.dopen = 'parts'; designPanel(); } });

  /* ---------- the panel ---------- */
  const sec = (id, title, body) => `<div class="panel"><div class="item tap" data-dsec="${id}" style="padding:0;min-height:0"><div class="t"><b style="font-size:18px">${title}</b></div><span>${D.dopen === id ? '▲' : '▼'}</span></div>${D.dopen === id ? `<div style="margin-top:10px">${body}</div>` : ''}</div>`;
  const sl = (key, label, min, max, step, val, unit) => `<div class="ctl"><div class="lb"><span>${label}</span><b id="dv_${key}">${val}${unit || ''}</b></div><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-dr="${key}" data-u="${unit || ''}"></div>`;
  const tg = (key, label, on) => `<div class="item tap" data-dtg="${key}" style="padding:8px 0;min-height:0"><div class="t"><b>${label}</b></div><div class="toggle ${on ? 'on' : ''}"></div></div>`;

  function bgBody() {
    const d = dd(), cur = d.bg || 'snow', ord = places(), off = d.off || [], bgo = d.bgo || {}, c = bgo[cur] || {};
    let h = `<div class="dpnote">اضغط الاسم لاختيار الخلفية الحالية · ▲▼ لترتيبها · العين لإظهارها أو إخفائها</div>`;
    ord.forEach(([id, n], i) => {
      const hid = off.includes(id), isPh = (d.bgs || []).some(b => b.id === id);
      h += `<div class="dprow ${id === cur ? 'on' : ''} ${hid ? 'offp' : ''}"><button class="dpn" data-dbg="${id}">${esc(n)}</button><button class="m" data-dup="${id}">▲</button><button class="m" data-ddn="${id}">▼</button><button class="m ${hid ? '' : 'on'}" data-doff="${id}">${hid ? '✕' : '✓'}</button>${isPh ? `<button class="m" data-ddel="${id}">🗑</button>` : ''}</div>`;
    });
    h += `<div class="lb" style="margin:12px 0 6px"><span class="sub">الخلفية الحالية: ${esc((ord.find(p => p[0] === cur) || [, cur])[1])}</span></div>
      ${chips([['متحركة', 'm1'], ['ثابتة', 'm0']], c.motion === false ? 'm0' : 'm1', 'dmo')}
      ${chips([['تأثير العمق شغّال', 'd1'], ['تأثير العمق مطفي', 'd0']], c.depth === false ? 'd0' : 'd1', 'ddp')}
      <button class="btn sec full" data-dadd="1" style="margin-top:10px">${ic('layers')} إضافة صور من التلفون (حتى ١٥)</button>`;
    const ph = (d.bgs || []).find(b => b.id === cur);
    if (ph) {
      h += `<div class="lb" style="margin:14px 0 6px"><span class="sub">فصل العنصر البارز (العمق) لهذي الصورة: ${ph.sky ? (ph.ok ? 'تم، الساعة خلفه' : 'تعذّر: الساعة فوق الصورة') : 'ما لگيت سماء واضحة'}</span></div>
        ${chips(SENS.map(([n, v]) => [n, String(v)]), String(ph.sens || 1), 'dsens')}${sl('off', 'ارتفاع خط الفصل (أعلى/أسفل)', -15, 15, 1, Math.round((ph.off || 0) * 100), '٪')}
        <button class="btn ghost full" data-dre="1">إعادة الفصل</button>
        <div class="dpnote">الفصل يلقى السماء من أعلى الصورة، وكل شي يطلع فيها (جبل، مبنى، نخيل) يصير الطبقة الأمامية. حرّك الخط إذا قصّ شي زايد أو ناقص.</div>`;
    }
    return h;
  }
  function clockBody() {
    const d = dd(), w = wst('clock');
    return `<div class="lb" style="margin:0 0 6px"><span class="sub">شكل الساعة</span></div>${chips(CSTY, d.cs || 'glass', 'dcs')}
      ${sl('c_sx', 'العرض', 50, 180, 5, Math.round(w.sx * 100), '٪')}${sl('c_sy', 'الارتفاع', 50, 180, 5, Math.round(w.sy * 100), '٪')}
      ${sl('c_x', 'الموقع (يمين/يسار)', -700, 700, 10, w.x, '')}${sl('c_y', 'الموقع (أعلى/أسفل)', -250, 500, 10, w.y, '')}
      ${tg('c_h', 'إخفاء الساعة', w.h)}
      <div class="lb" style="margin:12px 0 6px"><span class="sub">المحافظة (أوقات الصلاة والتاريخ الهجري)</span></div>${chips(PROVS.map((n, i) => [n, i]), d.prov || 0, 'dpv')}`;
  }
  function partsBody() {
    const id = D.dsel || 'clock', w = wst(id);
    return `<div class="dpnote">اضغط على أي جزء بالمعاينة، أو اختره من هنا:</div>${chips(WID.map(([k, n]) => [n, k]), id, 'dsel')}
      ${sl('w_x', 'يمين/يسار', -900, 900, 10, w.x, '')}${sl('w_y', 'أعلى/أسفل', -600, 600, 10, w.y, '')}${sl('w_s', 'الحجم', 50, 180, 5, Math.round(w.sx * 100), '٪')}
      ${tg('w_h', 'إخفاء هذا الجزء', w.h)}<button class="btn ghost full" data-dwreset="1">إعادة الوضع الأصلي</button>`;
  }
  function motionBody() {
    const d = dd();
    return `${sl('pspd', 'سرعة حركة الخلفية عند التنقل (أقل = أسرع)', 120, 1400, 20, d.pspd ?? 450, ' م.ث')}${sl('pamt', 'شدة الحركة (البارالاكس)', 0, 250, 10, Math.round((d.pamt ?? 1) * 100), '٪')}
      <div class="lb" style="margin:8px 0 6px"><span class="sub">الضباب المتحرك</span></div>${chips([['مطفي', 0], ['خفيف', 1], ['متوسط', 2], ['كثيف', 3]], d.mist ?? 1, 'dmist')}
      ${tg('reduce', 'تقليل الحركة (للأجهزة الضعيفة)', !!d.reduce)}${tg('effect', 'تأثير العمق عموماً', d.effect !== false)}`;
  }
  function newsBody() {
    const d = dd(), cur = d.rss || [RSS[0][0]], custom = cur.filter(u => !RSS.some(r => r[0] === u));
    return `${sl('nsp', 'سرعة شريط الأخبار (١ بطيء جداً … ١٠ سريع)', 1, 10, 1, d.nsp ?? 3, '')}
      <div class="lb" style="margin:8px 0 6px"><span class="sub">المصادر (RSS)</span></div>
      <div class="chips">${RSS.map(([u, n]) => `<button class="chip ${cur.includes(u) ? 'on' : ''}" data-drss="${esc(u)}">${esc(n)}</button>`).join('')}${custom.map(u => `<button class="chip on" data-drss="${esc(u)}">${esc(u.replace(/^https?:\/\//, '').slice(0, 26))} ×</button>`).join('')}</div>
      <input id="dRssIn" dir="ltr" placeholder="https://…/rss" style="margin-top:8px"><button class="btn sec full" data-drssadd="1" style="margin-top:6px">إضافة رابط RSS</button>`;
  }
  function matchBody() {
    const S = D.cfg.settings, n = (S.tickerTeams || []).length;
    return `<p class="sub" style="margin-top:0">${n ? 'مختار ' + n + ' فريق: ' + esc((S.tickerNames || []).slice(0, 4).join('، ')) : 'ماكو فرق مختارة بعد. الشريط يبين مباريات فرقك القادمة.'}</p>
      <button class="btn sec full" data-dtm="pick">${ic('layers')} اختار الفرق والمنتخبات</button>
      <button class="btn sec full" data-dtm="lg" style="margin-top:6px">${ic('layers')} اختار دوريات وكؤوس</button>${n ? '<button class="btn ghost full" data-dtm="clear">شيل الفرق</button>' : ''}`;
  }
  function render() {
    const p = $('#dPanel'); if (!p) return;
    p.innerHTML = `<div class="dpnote" style="margin:0 2px 8px">كل شي هنا ينعكس مباشرة بالمعاينة فوق، ويروح للشاشة ويا التصميم.</div>` +
      sec('bg', 'الخلفيات والعمق', bgBody()) + sec('clock', 'الساعة والمحافظة', clockBody()) + sec('parts', 'مواقع الأجزاء وأحجامها', partsBody()) +
      sec('motion', 'الحركة والضباب', motionBody()) + sec('news', 'شريط الأخبار', newsBody()) + sec('match', 'شريط المباريات', matchBody());
  }
  function ensureTab() {
    const seg = $('#dSeg'); if (!seg) return;
    const has = seg.querySelector('[data-tab="depth"]'), want = D.cfg.settings.skin === 'depth';
    if (want && !has) { const b = document.createElement('button'); b.dataset.tab = 'depth'; b.textContent = 'العمق'; seg.appendChild(b); }
    if (!want && has) { has.remove(); if (D.tab === 'depth') D.tab = 'theme'; }
  }
  const _dp = designPanel;
  designPanel = function () {
    if (D && !(typeof isCarD === 'function' && isCarD())) ensureTab();
    if (D && D.tab === 'depth' && D.cfg.settings.skin === 'depth') {
      document.querySelectorAll('#dSeg button').forEach(b => b.classList.toggle('on', b.dataset.tab === 'depth'));
      if (!D.dopen) D.dopen = 'bg';
      const pv = $('#tvPv'); if (pv) pv.classList.add('dpstick');
      render(); wire(); return;
    }
    const pv0 = $('#tvPv'); if (pv0) pv0.classList.remove('dpstick');
    return _dp.apply(this, arguments);
  };

  /* ---------- changes ---------- */
  function moveOrder(id, dir) {
    const d = dd(), ids = places().map(p => p[0]), i = ids.indexOf(id), j = i + dir;
    if (j < 0 || j >= ids.length) return; ids.splice(j, 0, ids.splice(i, 1)[0]); d.order = ids;
  }
  async function addPhotos() {
    const d = dd(); busy('اختار صور من موبايلك (حتى ١٥)…');
    let list; try { list = await run('pick', { mode: 'bgimages' }); } catch (e) { unbusy(); if (e.message !== 'CANCEL') toast(errText(e)); return; }
    d.bgs = d.bgs || [];
    for (let i = 0; i < list.length && d.bgs.length < 15; i++) {
      busy('أفصل العنصر البارز…', (i + 1) + ' من ' + list.length);
      const res = await analyzeVia(list[i], {});
      d.bgs.push({ id: 'p' + Date.now() + i, n: 'صورة ' + (d.bgs.length + 1), src: list[i], sky: res ? res.sky : null, dy: res ? res.dy : 0, ok: res ? !!res.ok : false, blur: res ? res.blur : '', sens: 1, off: 0 });
    }
    unbusy(); if (d.bgs.length) d.bg = d.bgs[d.bgs.length - 1].id;
    push(); D.dopen = 'bg'; designPanel(); toast('انضافت ' + list.length + ' صورة');
  }
  async function redo(ph) {
    busy('أعيد فصل العنصر البارز…');
    const res = await analyzeVia(ph.src, { sens: ph.sens || 1, off: ph.off || 0 }); unbusy();
    if (!res) toast('المعاينة مو جاهزة، جرّب بعد لحظة');
    if (res) { ph.sky = res.sky; ph.dy = res.dy; ph.ok = !!res.ok; ph.blur = res.blur || ph.blur; }
    push(); designPanel();
  }
  const phCur = () => (dd().bgs || []).find(b => b.id === (dd().bg || 'snow'));

  function wire() {
    const p = $('#dPanel'); if (!p || p._dw) return; p._dw = 1;
    p.addEventListener('input', e => {
      const r = e.target.closest('[data-dr]'); if (!r || D.tab !== 'depth') return;
      const k = r.dataset.dr, v = +r.value, d = dd(), lab = $('#dv_' + k); if (lab) lab.textContent = v + (r.dataset.u || '');
      if (k === 'c_sx') wst('clock').sx = v / 100; else if (k === 'c_sy') wst('clock').sy = v / 100; else if (k === 'c_x') wst('clock').x = v; else if (k === 'c_y') wst('clock').y = v;
      else if (k === 'w_x') wst(D.dsel || 'clock').x = v; else if (k === 'w_y') wst(D.dsel || 'clock').y = v; else if (k === 'w_s') { const w = wst(D.dsel || 'clock'); w.sx = w.sy = v / 100; }
      else if (k === 'pspd') d.pspd = v; else if (k === 'pamt') d.pamt = v / 100; else if (k === 'nsp') d.nsp = v;
      else if (k === 'off') { const ph = phCur(); if (ph) ph.off = v / 100; return; }
      push();
    });
    p.addEventListener('change', e => { const r = e.target.closest('[data-dr="off"]'); if (r) { const ph = phCur(); if (ph) redo(ph); } });
    p.addEventListener('click', e => {
      const t = e.target.closest('[data-dsec],[data-dbg],[data-dup],[data-ddn],[data-doff],[data-ddel],[data-dmo],[data-ddp],[data-dadd],[data-dsens],[data-dre],[data-dcs],[data-dpv],[data-dsel],[data-dtg],[data-dwreset],[data-dmist],[data-drss],[data-drssadd],[data-dtm]');
      if (!t || D.tab !== 'depth') return; e.stopPropagation(); tap();
      const d = dd(), S = D.cfg.settings, ds = t.dataset, cur = d.bg || 'snow';
      if (ds.dsec) { D.dopen = D.dopen === ds.dsec ? '' : ds.dsec; return designPanel(); }
      if (ds.dbg) d.bg = ds.dbg;
      else if (ds.dup) moveOrder(ds.dup, -1); else if (ds.ddn) moveOrder(ds.ddn, 1);
      else if (ds.doff) { d.off = d.off || []; const i = d.off.indexOf(ds.doff); if (i >= 0) d.off.splice(i, 1); else if (places().length - d.off.length > 1) d.off.push(ds.doff); }
      else if (ds.ddel) { d.bgs = (d.bgs || []).filter(b => b.id !== ds.ddel); if (d.bg === ds.ddel) d.bg = 'snow'; }
      else if (ds.dmo) { const b = (d.bgo = d.bgo || {}); (b[cur] = b[cur] || {}).motion = ds.dmo === 'm1'; }
      else if (ds.ddp) { const b = (d.bgo = d.bgo || {}); (b[cur] = b[cur] || {}).depth = ds.ddp === 'd1'; }
      else if (ds.dadd) return addPhotos();
      else if (ds.dsens) { const ph = phCur(); if (ph) { ph.sens = +ds.dsens; return redo(ph); } }
      else if (ds.dre) { const ph = phCur(); if (ph) return redo(ph); }
      else if (ds.dcs) d.cs = ds.dcs; else if (ds.dpv) d.prov = +ds.dpv;
      else if (ds.dsel) D.dsel = ds.dsel;
      else if (ds.dtg) { const k = ds.dtg; if (k === 'c_h') wst('clock').h = !wst('clock').h; else if (k === 'w_h') { const w = wst(D.dsel || 'clock'); w.h = !w.h; } else if (k === 'reduce') d.reduce = !d.reduce; else if (k === 'effect') d.effect = d.effect === false; }
      else if (ds.dwreset) { (d.w = d.w || {})[D.dsel || 'clock'] = { x: 0, y: 0, sx: 1, sy: 1, h: false }; }
      else if (ds.dmist) d.mist = +ds.dmist;
      else if (ds.drss) { d.rss = d.rss || [RSS[0][0]]; const i = d.rss.indexOf(ds.drss); if (i >= 0) d.rss.splice(i, 1); else d.rss.push(ds.drss); }
      else if (ds.drssadd) { const v = ($('#dRssIn').value || '').trim(); if (!/^https?:\/\//i.test(v)) return toast('اكتب رابط يبدأ بـ https://'); d.rss = d.rss || [RSS[0][0]]; if (!d.rss.includes(v)) d.rss.push(v); }
      else if (ds.dtm) {
        const redoT = () => { changed(); live({ settings: S }); designPanel(); };
        if (ds.dtm === 'pick') return tickerTeamsSheet(S, redoT);
        if (ds.dtm === 'lg') return tickerLeaguesSheet(S, redoT);
        if (ds.dtm === 'clear') { delete S.tickerTeams; delete S.tickerNames; return redoT(); }
      }
      push(); designPanel();
    });
  }
})();
