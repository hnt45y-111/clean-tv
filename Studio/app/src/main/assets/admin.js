/* ============================================================ accounts control (admin dashboard + rules on every phone)
   Rules live in one public file (policy.json in the «accounts» release on GitHub) that only the admin can write
   (with his own GitHub key). Every app reads it on start, every 2 minutes and whenever it comes back to the screen.
   Device details travel the other way through ntfy.sh: each app posts its own details, the admin's app collects them. */

ICONS.lock = ICONS.lock || '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';

const POLICY_URL = 'https://github.com/hnt45y-111/clean-tv/releases/download/accounts/policy.json';
const TELE_TOPIC = 'msm-acct-r7Hq3vK9pXw2LmZ4';
const FEATURES = [['ai', 'مولّد الواجهات بالذكاء الاصطناعي'], ['saver', 'شاشة التوقف'], ['adb', 'التحكم بالشاشات (ADB والواي فاي)'],
  ['design', 'تصميم الواجهات'], ['clean', 'تجهيز وتنظيف الشاشة'], ['files', 'إرسال الملفات']];

const myCode = () => { try { return String(B.code() || '').replace('-', '').toUpperCase(); } catch (e) { return ''; } };
const normCode = c => String(c || '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
const isAdminS = () => !!(SESSION && SESSION.admin);
let POLICY = kv('policyCache', null);

function myRule() {
  if (!POLICY || !POLICY.acct) return null;
  const u = SESSION && SESSION.user ? 'u:' + String(SESSION.user).toLowerCase() : '';
  return POLICY.acct[myCode()] || (u && POLICY.acct[u]) || null;
}
function featureOn(f) {
  if (isAdminS()) return true;
  const r = myRule();
  return !(r && (r.s || (r.off || []).includes(f)));
}
function featureLocked() {
  sheet(`<div style="text-align:center;padding:6px 0">${ic('lock')}<h2 style="margin:10px 0 6px">هاي الميزة موقوفة لحسابك</h2>
    <p class="sub">الإدارة وقفت هاي الميزة على حسابك. إذا تحتاجها تواصل وياهم.</p>
    <p class="sub num" style="direction:ltr">${esc(B.code())}</p><button class="btn pri full" id="flOk">تمام</button></div>`);
  $('#flOk').onclick = closeSheet;
}

/* ---- lock-out screen for a suspended account */
function applyPolicy() {
  if (!SESSION || !SESSION.ok) return;
  const r = myRule(), sus = !isAdminS() && !!(r && r.s);
  let el = document.getElementById('suspended');
  if (sus) {
    if (!el) {
      el = document.createElement('div'); el.id = 'suspended';
      el.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:100000;background:var(--bg,#0B0C10);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;text-align:center';
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="width:84px;height:84px;border-radius:26px;display:flex;align-items:center;justify-content:center;background:rgba(239,91,91,.12);color:#EF5B5B;margin-bottom:18px">${ic('lock')}</div>
      <h1 style="font-size:26px;margin:0 0 10px">تم إيقاف حسابك</h1>
      <p class="sub" style="max-width:320px">حسابك موقوف من الإدارة، وكل ميزات التطبيق مقفولة هسه. تواصل ويا الإدارة حتى يرجعون يفعّلوه.</p>
      ${r.msg ? `<p class="sub" style="max-width:320px;color:var(--ink)">${esc(r.msg)}</p>` : ''}
      <p class="sub num" style="direction:ltr;margin-top:6px">${esc(B.code())}</p>
      <button class="btn ghost" id="susRe" style="margin-top:14px">${ic('refresh')} تحقق مرة ثانية</button>`;
    el.querySelector('#susRe').onclick = () => checkPolicy(true);
    try { closeSheet(); } catch (e) {}
  } else if (el) el.remove();
}

async function checkPolicy(loud) {
  try {
    const t = await run('fetchText', { url: POLICY_URL + '?t=' + Date.now(), __local: true });
    const p = JSON.parse(t);
    if (p && p.acct) { POLICY = p; kvSet('policyCache', p); }
  } catch (e) { if (loud) toast('ما گدرت أتحقق هسه، تأكد من الإنترنت'); }
  applyPolicy();
  if (loud && !(myRule() || {}).s) toast('حسابك فعّال ✓');
}

/* ---- this phone's details for the admin (sent at most every 6 hours, and on every login) */
async function sendTele(force) {
  if (!SESSION || !SESSION.ok) return;
  const last = kv('teleAt', 0);
  if (!force && Date.now() - last < 6 * 3600e3) return;
  try {
    const t = await run('tele', { __local: true });
    const body = Object.assign({ v: 1, user: SESSION.user || '', admin: !!SESSION.admin, ver: (() => { try { return B.version(); } catch (e) { return ''; } })(),
      exp: SESSION.expAt || 0, screen: INFO ? [INFO.brand, INFO.model].filter(Boolean).join(' ') : '', ts: Date.now() }, t);
    await run('httpPost', { url: 'https://ntfy.sh/' + TELE_TOPIC, body: JSON.stringify(body), type: 'application/json', __local: true });
    kvSet('teleAt', Date.now());
  } catch (e) {}
}

/* ---- enforcement: hooks on navigation and on every command to a screen */
(function () {
  const _enter = enter;
  enter = function (s) { _enter.apply(this, arguments); applyPolicy(); checkPolicy(false); sendTele(true); };
  setInterval(() => { if (SESSION && SESSION.ok) checkPolicy(false); }, 120000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && SESSION && SESSION.ok) { checkPolicy(false); sendTele(false); } });

  const _show = show;
  show = function (id) {
    if (id === 'design' && !featureOn('design')) return featureLocked();
    if (id === 'clean' && !featureOn('clean')) return featureLocked();
    return _show.apply(this, arguments);
  };
  const FREE = new Set([...D_LOCAL, 'shareStart', 'shareStop', 'status', 'selfInfo', 'selfStart', 'selfStop', 'kv', 'tele', 'httpPost', 'fetchText']);
  ['connect', 'pair'].forEach(x => FREE.delete(x));
  const _d = window.__direct;
  window.__direct = function (op, a) {
    if (!isAdminS()) {
      const r = myRule();
      if (r && r.s && !['fetchText', 'tele', 'httpPost'].includes(op)) return Promise.reject(new Error('تم إيقاف حسابك'));
      if (!featureOn('adb') && !FREE.has(op)) return Promise.reject(new Error('التحكم بالشاشات موقوف لحسابك من الإدارة'));
      if (!featureOn('files') && /^(push|pushData|pick|sendFile|fmPush)$/.test(op)) return Promise.reject(new Error('إرسال الملفات موقوف لحسابك من الإدارة'));
    }
    return _d ? _d.apply(this, arguments) : null;
  };
  if (typeof designPanel === 'function') {
    const _dp = designPanel;
    designPanel = function () {
      _dp.apply(this, arguments);
      if (D && D.tab === 'saver' && !featureOn('saver')) {
        $('#dPanel').innerHTML = `<div class="panel" style="text-align:center">${ic('lock')}<h2 style="margin:8px 0">شاشة التوقف موقوفة لحسابك</h2><p class="sub">الإدارة وقفت هاي الميزة. تواصل وياهم إذا تحتاجها.</p></div>`;
      }
    };
  }
})();

/* ============================================================ admin dashboard */
function policyObj() { const p = POLICY && POLICY.acct ? JSON.parse(JSON.stringify(POLICY)) : { v: 1, acct: {} }; p.acct = p.acct || {}; return p; }
async function savePolicy(p) {
  const tok = kv('ghToken', '');
  if (!tok) { toast('اربط حساب GitHub أول حتى توصل الأوامر للمشتركين'); return ghTokenSheet(() => openAdmin()); }
  p.updated = new Date().toISOString();
  busy('أرسل الأمر للمشتركين…');
  try { await run('policyPut', { token: tok, policy: JSON.stringify(p), __local: true }); POLICY = p; kvSet('policyCache', p); unbusy(); toast('انحفظ ✓ يوصل لجهاز المشترك خلال دقيقتين أو أول ما يفتح التطبيق'); return true; }
  catch (e) { unbusy(); toast(errText(e)); return false; }
}

async function pullTele(loud) {
  if (loud) busy('أجيب معلومات الأجهزة…');
  try {
    const t = await run('fetchText', { url: 'https://ntfy.sh/' + TELE_TOPIC + '/json?poll=1&since=all', __local: true });
    const map = kv('teleMap', {});
    String(t).split('\n').forEach(line => {
      try {
        const m = JSON.parse(line); if (m.event !== 'message') return;
        const d = JSON.parse(m.message); const c = normCode(d.code); if (!c) return;
        if (!map[c] || (map[c].ts || 0) <= d.ts) map[c] = d;
      } catch (e) {}
    });
    kvSet('teleMap', map);
    if (loud) { unbusy(); toast('تحدّثت معلومات الأجهزة'); }
  } catch (e) { if (loud) { unbusy(); toast(errText(e)); } }
}

function accountsAll() {
  const issued = kv('issued', []), tele = kv('teleMap', {}), pol = (POLICY && POLICY.acct) || {}, out = {};
  issued.forEach(a => { const c = normCode(a.code); out[c] = Object.assign({ code: c }, out[c], { user: a.user, exp: a.exp, at: a.at, pw: a.pw }); });
  Object.keys(tele).forEach(c => { out[c] = Object.assign({ code: c, user: tele[c].user, exp: tele[c].exp }, out[c], { tele: tele[c] }); });
  Object.keys(pol).forEach(c => { if (c.indexOf('u:') === 0) return; out[c] = Object.assign({ code: c }, out[c], { rule: pol[c] }); });
  return Object.values(out).sort((a, b) => ((b.tele && b.tele.ts) || b.at || 0) - ((a.tele && a.tele.ts) || a.at || 0));
}

function accountsSection() {
  const list = accountsAll(), now = Date.now();
  return `<div class="lb" style="margin:18px 0 8px"><h2 style="margin:0">المشتركين</h2><button class="btn ghost" id="tlPull" style="min-height:36px;padding:0 12px">${ic('refresh')} حدّث</button></div>
    <div class="list" id="acList">${list.length ? list.map(a => {
      const t = a.tele || {}, r = a.rule || {}, sus = !!r.s, exp = a.exp && a.exp <= now;
      return `<div class="item tap" data-ac="${esc(a.code)}"><div class="t"><b>${esc(a.user || 'بدون اسم')} <span class="sub num">${esc(a.code.slice(0, 4) + '-' + a.code.slice(4))}</span></b>
        <small>${t.model ? esc([t.brand, t.model].filter(Boolean).join(' ')) + ' · أندرويد ' + esc(t.android || '') : 'ما وصلت معلومات جهازه بعد'}${t.ts ? ' · آخر ظهور ' + fmtAgo(t.ts) : ''}</small></div>
        <span class="tag ${sus || exp ? 'bad' : ''}">${sus ? 'موقوف' : exp ? 'منتهي' : (r.off && r.off.length ? 'محدود' : 'فعّال')}</span></div>`;
    }).join('') : '<div class="empty">ما أكو مشتركين بعد</div>'}</div>`;
}
function fmtAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 2 ? 'هسه' : m < 60 ? 'قبل ' + m + ' دقيقة' : m < 1440 ? 'قبل ' + Math.round(m / 60) + ' ساعة' : fmtDate(ts);
}

function accountSheet(code) {
  const a = accountsAll().find(x => x.code === code) || { code }, t = a.tele || {}, p = policyObj(), r = Object.assign({ off: [] }, p.acct[code] || {});
  const row = (k, v) => v ? `<div class="item" style="min-height:0;padding:9px 0"><div class="t"><small>${k}</small><b class="${/[0-9a-f:]{6}|\d+\.\d+/.test(String(v)) ? 'num' : ''}" style="direction:${/^[\x00-\x7F]+$/.test(String(v)) ? 'ltr;text-align:right' : 'rtl'}">${esc(v)}</b></div></div>` : '';
  const tg = (key, label, on) => `<div class="item tap" data-k="${key}" style="min-height:0;padding:11px 0"><div class="t"><b>${label}</b></div><div class="toggle ${on ? 'on' : ''}"></div></div>`;
  sheet(`<h2>${esc(a.user || 'مشترك')}</h2>
    <div class="panel soft" style="padding:4px 14px">
      ${row('رمز الجهاز', code.slice(0, 4) + '-' + code.slice(4))}
      ${row('الجهاز', [t.brand, t.model].filter(Boolean).join(' '))}
      ${row('إصدار أندرويد', t.android ? t.android + (t.sdk ? ' (SDK ' + t.sdk + ')' : '') : '')}
      ${row('عنوان IP', t.ip)}
      ${row('دقة الشاشة', t.res)}
      ${row('معرّف الجهاز', t.aid)}
      ${row('MAC', t.mac)}
      ${row('نسخة التطبيق', t.ver)}
      ${row('آخر شاشة اتصل بيها', t.screen)}
      ${row('آخر ظهور', t.ts ? fmtAgo(t.ts) : '')}
      ${row('الاشتراك', a.exp ? (a.exp > Date.now() ? 'ينتهي ' : 'انتهى ') + fmtDate(a.exp) : (a.at || t.ts ? 'مدى الحياة' : ''))}
      ${t.model ? '' : '<p class="sub" style="margin:10px 0">معلومات الجهاز توصل أول ما يفتح المشترك التطبيق وهو متصل بالإنترنت.</p>'}
    </div>
    <h2 style="font-size:16px;margin:14px 0 4px">الميزات</h2>
    <div class="panel soft" style="padding:2px 14px" id="acFeat">${FEATURES.map(([k, l]) => tg(k, l, !r.off.includes(k))).join('')}</div>
    <div class="panel soft" style="padding:2px 14px;margin-top:10px;border-color:rgba(239,91,91,.35)" id="acSus">${tg('__s', '<span style="color:var(--bad,#EF5B5B)">إيقاف الحساب</span>', !!r.s)}</div>
    <input id="acMsg" placeholder="رسالة تطلع للمشترك وقت الإيقاف (اختياري)" value="${esc(r.msg || '')}" style="margin-top:10px">
    <button class="btn pri full" id="acSave" style="margin-top:12px">${ic('check')} احفظ وأرسل للمشترك</button>`);
  const body = $('#sheetBody');
  body.onclick = e => {
    const it = e.target.closest('[data-k]'); if (!it) return;
    const k = it.dataset.k, tgl = it.querySelector('.toggle'); tgl.classList.toggle('on'); const on = tgl.classList.contains('on');
    if (k === '__s') r.s = on; else { r.off = r.off.filter(x => x !== k); if (!on) r.off.push(k); }
  };
  $('#acSave').onclick = async () => {
    r.msg = $('#acMsg').value.trim().slice(0, 140); if (!r.msg) delete r.msg;
    if (!r.s) delete r.s; if (!r.off.length) delete r.off;
    if (a.user) r.user = a.user;
    const q = policyObj();
    if (Object.keys(r).filter(k => k !== 'user').length) q.acct[code] = r; else delete q.acct[code];
    if (await savePolicy(q)) { closeSheet(); openAdmin(); }
  };
}

/* the old admin page gets the subscribers list on top of account generation */
(function () {
  const _oa = openAdmin;
  openAdmin = function () {
    _oa.apply(this, arguments);
    const host = document.querySelector('#pageBody') || document.querySelector('.screen.on');
    const gen = host && host.querySelector('.panel');
    if (!gen) return;
    gen.insertAdjacentHTML('beforebegin', accountsSection());
    gen.insertAdjacentHTML('afterend', `<div class="panel"><h2>مفتاح الذكاء الاصطناعي</h2><p class="sub" style="margin-top:-4px">المفتاح ينزل ويّا التطبيق بملف خاص. إذا بدّلته من Google، الصقه هنا حتى يشتغل على موبايلك فوراً (وبالنسخة الجاية أحطه بالملف للكل).</p>
      <input id="aiK" placeholder="الصق المفتاح الجديد" autocapitalize="off" autocomplete="off" style="direction:ltr"><div class="row" style="margin-top:10px"><button class="btn pri" id="aiKs">احفظ</button><button class="btn ghost" id="aiKr">رجّع مفتاح التطبيق</button></div></div>`);
    $('#aiKs').onclick = async () => { const k = $('#aiK').value.trim(); if (k.length < 20) return toast('المفتاح قصير'); await run('aiKey', { key: k, __local: true }); $('#aiK').value = ''; toast('انحفظ المفتاح ✓'); };
    $('#aiKr').onclick = async () => { await run('aiKey', { key: '', __local: true }); toast('رجع مفتاح التطبيق'); };
    const draw = () => { const l = $('#acList'); if (l) l.outerHTML = accountsSection().replace(/^[\s\S]*?(<div class="list" id="acList">)/, '$1'); bind(); };
    const bind = () => {
      const l = $('#acList'); if (l) l.onclick = e => { const it = e.target.closest('[data-ac]'); if (it) accountSheet(it.dataset.ac); };
      const pb = $('#tlPull'); if (pb) pb.onclick = async () => { await pullTele(true); await checkPolicy(false); draw(); };
    };
    bind();
    pullTele(false).then(draw);
  };
})();
