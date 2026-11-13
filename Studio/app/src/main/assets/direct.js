'use strict';
/* ============================================================ direct connection (Wi-Fi, no setup permission)
   The TV launcher runs a small server (port 8686). After a one-time code shown on the TV, the phone controls it
   directly: remote, designs, photos, files, apps, casting, notifications. Only the setup (cleaning) and a few
   tools need the setup permission (ADB / wireless debugging). */
const D_PORT = 8686;
const dTok = h => kv('dtok_' + h, '');
const dBase = h => 'http://' + h + ':' + D_PORT;
const isDirect = () => !!(CONN && CONN.connected && CONN.direct);

async function dapi(path, body, opt = {}) {
  const h = opt.host || CONN.host, t = opt.token || dTok(h);
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), opt.timeout || 9000);
  try {
    const r = await fetch(dBase(h) + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST', signal: ctl.signal,
      headers: { 'X-Token': t, 'Content-Type': opt.bin ? 'application/octet-stream' : 'application/json' },
      body: body === undefined ? undefined : opt.bin ? body : typeof body === 'string' ? body : JSON.stringify(body)
    });
    const txt = await r.text();
    if (r.status === 401) throw new Error('DIRECTAUTH');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return opt.raw ? txt : txt ? JSON.parse(txt) : {};
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('الشاشة ما ترد على الواي فاي. تأكد إنها شغالة وعلى نفس الشبكة');
    if (/Failed to fetch|NetworkError/i.test(e.message)) throw new Error('الشاشة ما ترد على الواي فاي. تأكد إن «واجهة مدير الشاشات» منصّبة وشغالة عليها');
    throw e;
  } finally { clearTimeout(tm); }
}
const dataBytes = u => { const b = atob(u.slice(u.indexOf(',') + 1)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };

/* key codes the app uses → the launcher server's key names */
const D_KEYS = { 19: 'up', 20: 'down', 21: 'left', 22: 'right', 23: 'ok', 66: 'ok', 4: 'back', 3: 'home', 82: 'menu', 26: 'power', 85: 'play', 126: 'play', 127: 'play', 87: 'next', 88: 'prev', 86: 'stop',
  164: 'mute', 24: 'vup', 25: 'vdn', 166: 'chup', 167: 'chdn', 176: 'settings', 84: 'search' };
const D_LOCAL = new Set(['gallery', 'fetchText', 'ghPublish', 'ghDelete', 'ghCheck', 'dl', 'saveText', 'release', 'selfUpdate', 'capture', 'voice', 'appDetails', 'connect', 'pair', 'ai', 'httpPost', 'tele', 'policyPut', 'usbConnect', 'usbClose', 'tetherSettings', 'usbCancel', 'usbTcpip', 'aiKey', 'zipTheme']);
let D_LAST_SENT = null;
const D_OPS = {
  status: async () => CONN,
  disconnect: async () => ({ connected: false }),
  info: async () => {
    const i = await dapi('info2');
    return { brand: i.brand || '', model: i.model || '', android: i.android || '', sdk: i.sdk, name: '', isTv: !!i.isTv, isCar: i.mode === 'car', a11y: !!i.a11y, overlay: !!i.overlay,
      mem: '', pkgs: '—', disabled: '—', home: 'com.cleantv.launcher/.MainActivity', chip: '', procs: '—', direct: true, launcherVersion: i.version || 0 };
  },
  key: async a => {
    const k = D_KEYS[a.code];
    if (!k) throw new Error('هذا الزر يحتاج إذن التجهيز');
    const r = await dapi('key', { k });
    if (!r.ok && /^(up|down|left|right|ok)$/.test(k)) dA11yHint();
    return true;
  },
  text: async a => { const r = await dapi('text', { text: a.t != null ? a.t : a.text, submit: true }); if (!r.ok) dA11yHint(); return true; },
  cfgGet: async () => dapi('config/get', undefined, { raw: true }),
  cfgSet: async a => { await dapi('config/set', a.cfg); return true; },
  pushData: async a => { const r = await dapi('file?name=' + encodeURIComponent(a.name || 'p.jpg'), dataBytes(a.data), { bin: true, timeout: 60000 }); return 'file://' + r.path; },
  castPrep: async () => { B.castDirect && B.castDirect(CONN.host, dTok(CONN.host)); return true; },
  launcher: async () => { await dapi('cmd', { type: 'update' }); toast('الشاشة تدوّر على تحديث «واجهة مدير الشاشات» وتنصّبه. وافق على التثبيت بالريموت إذا طلب'); return {}; },
  launcherUpdate: async () => D_OPS.launcher(),
  pick: async a => {
    if (a.mode === 'push' || a.mode === 'install') {
      const r = await run('pick', { mode: a.mode === 'push' ? 'dsend' : 'dinstall', url: dBase(CONN.host), token: dTok(CONN.host), __local: 1 });
      if (a.mode === 'install') { toast('وصل التطبيق للشاشة. وافق على التثبيت بالريموت'); return r.name || 'التطبيق'; }
      D_LAST_SENT = r; return r.path || '/sdcard/Download/' + (r.name || '');
    }
    return null;
  }
};
window.__direct = (op, a) => {
  if (!isDirect() || (a && a.__local)) return null;
  if (D_OPS[op]) { const p = D_OPS[op](a || {}); return p.then(r => r === null ? new Promise((res, rej) => { const id = 'c' + (++N); P[id] = { res, rej }; B.run(id, op, JSON.stringify(a || {})); }) : r); }
  if (D_LOCAL.has(op)) return null;
  return Promise.reject(new Error('NEEDADB'));
};

/* ---------- connecting ---------- */
async function directConnect(host, label, quiet) {
  if (!quiet) busy('أتصل بالشاشة على الواي فاي…');
  try {
    let ok = false;
    if (dTok(host)) { try { await dapi('info2', undefined, { host }); ok = true; } catch (e) { if (e.message !== 'DIRECTAUTH') throw e; } }
    if (!ok) { if (!quiet) unbusy(); if (quiet) return false; return directPair(host, label); }
    CONN = { connected: true, host, port: D_PORT, direct: true };
    B.castDirect && B.castDirect(host, dTok(host));
    INFO = await run('info');
    const old = devices().find(d => d.host === host) || {};
    const name = label || old.name || (INFO.brand + ' ' + INFO.model).trim() || 'شاشتي';
    saveDevice(Object.assign({}, old, { host, port: old.port || D_PORT, name, model: INFO.model, brand: INFO.brand, android: INFO.android, direct: true }));
    if (!quiet) { unbusy(); toast('اتصلت بـ ' + name + ' على الواي فاي ✓'); }
    RENDER[cur] && RENDER[cur]();
    return true;
  } catch (e) { if (!quiet) { unbusy(); toast(errText(e)); } return false; }
}
async function directPair(host, label) {
  try { await fetch(dBase(host) + '/api/pair/start', { method: 'POST', body: '{}' }); }
  catch (e) { return toast('الشاشة ما ترد. لازم «واجهة مدير الشاشات» تكون منصّبة وشغالة عليها وعلى نفس الواي فاي'); }
  sheet(`<h2>ربط بالواي فاي</h2><p class="sub">طلع رمز من ٦ أرقام على التلفزيون. اكتبه هنا. هذا الربط مرة وحدة بس، وما يحتاج تصحيح الأخطاء.</p>
    <input id="dpCode" class="num code6" inputmode="numeric" maxlength="6" placeholder="••••••">
    <button class="btn pri full" id="dpGo" style="margin-top:14px">ربط</button>
    <button class="btn ghost full" id="dpAgain">ما طلع الرمز؟ أعد الطلب</button>`);
  setTimeout(() => $('#dpCode') && $('#dpCode').focus(), 300);
  $('#dpAgain').onclick = () => { closeSheet(); directPair(host, label); };
  $('#dpGo').onclick = async () => {
    const code = $('#dpCode').value.trim(); if (code.length < 6) return toast('اكتب الرمز كامل');
    try {
      const r = await fetch(dBase(host) + '/api/pair', { method: 'POST', body: JSON.stringify({ code }) });
      const j = await r.json();
      if (!j.token) return toast('الرمز غلط أو انتهى. اطلب رمز جديد');
      kvSet('dtok_' + host, j.token); closeSheet(); directConnect(host, label);
    } catch (e) { toast('ما گدرت أربط. جرب مرة ثانية'); }
  };
}
/* pair the current screen over Wi-Fi too (for features that live on the TV: usage, notifications, voice) */
async function ensureDirectToken() {
  if (!CONN.connected) { need(); return false; }
  if (dTok(CONN.host)) { try { await dapi('info2'); return true; } catch (e) { if (e.message !== 'DIRECTAUTH') { toast(errText(e)); return false; } } }
  directPair(CONN.host); return false;
}

function dA11yHint() {
  if (dA11yHint.shown) return; dA11yHint.shown = true;
  sheet(`<h2>فعّل التحكم داخل التطبيقات</h2><p class="sub">الأسهم وموافق تشتغل بواجهة مدير الشاشات. حتى تشتغل داخل التطبيقات الثانية (يوتيوب وغيره) فعّل «واجهة مدير الشاشات» من إعدادات إمكانية الوصول بالتلفزيون مرة وحدة.</p>
    <button class="btn pri full" id="a1Go">${ic('tv')} افتح الإعدادات على التلفزيون</button><div style="height:8px"></div><button class="btn ghost full" id="a1No">بعدين</button>`);
  $('#a1Go').onclick = () => { closeSheet(); dapi('open', { what: 'a11y' }).then(() => toast('اختار «واجهة مدير الشاشات» وفعّلها بالريموت')).catch(e => toast(errText(e))); };
  $('#a1No').onclick = closeSheet;
}
function needAdbSheet() {
  if (needAdbSheet.open) return; needAdbSheet.open = true; setTimeout(() => { needAdbSheet.open = false; }, 1500);
  sheet(`<h2>هذي تحتاج إذن التجهيز</h2><p class="sub">إنت متصل بالشاشة على الواي فاي، وكل شي يشتغل: الريموت، الواجهات، الصور، الملفات، العرض، والإعدادات. بس تنظيف الشاشة وإيقاف التطبيقات والمشاهدة المباشرة تحتاج إذن «تصحيح الأخطاء» مرة وحدة.</p>
    <button class="btn pri full" id="naGo">${ic('key')} أعطي الإذن هسه</button><div style="height:8px"></div><button class="btn ghost full" id="naNo">بعدين</button>`);
  $('#naGo').onclick = () => { closeSheet(); addSheet(); };
  $('#naNo').onclick = closeSheet;
}

/* found on the network: a TV with the launcher → connect over Wi-Fi */
const _renderFound = renderFound;
renderFound = function () {
  _renderFound();
  const el = $('#foundList'); if (!el) return;
  el.onclick = e => {
    const f = e.target.closest('[data-found]'); if (!f) return;
    e.stopPropagation();
    const o = FOUND[f.dataset.found]; if (!o) return;
    tap();
    if (o.kind === 'launcher') directConnect(o.host, o.label);
    else if (o.kind === 'pair') pairSheet(o.host, o.port);
    else connectTo(o.host, o.port);
  };
};
/* saved screens: prefer the setup permission if the TV offers it, otherwise Wi-Fi */
const _savedSheet = savedSheet;
savedSheet = function (d) {
  _savedSheet(d);
  const b = $('#sheetBody'), old = b.onclick;
  b.onclick = async e => {
    const x = e.target.closest('[data-x]');
    if (x && x.dataset.x === 'con' && !foundBy('connect', d.host)[0] && (d.direct || dTok(d.host))) { closeSheet(); directConnect(d.host, d.name); return; }
    if (x && x.dataset.x === 'dis' && isDirect()) { closeSheet(); CONN = { connected: false }; INFO = null; renderHome(); return; }
    old && old(e);
  };
};
/* after a restart: if the setup permission is not there, come back over Wi-Fi */
const _autoReconnect = autoReconnect;
autoReconnect = async function () {
  await _autoReconnect();
  setTimeout(async () => {
    if (CONN.connected) return;
    const last = devices()[0];
    if (last && dTok(last.host)) await directConnect(last.host, last.name, true);
  }, 4500);
};

/* home card: say how we are connected, offer the permission for the setup */
const _renderHome2 = renderHome;
renderHome = function () {
  _renderHome2();
  if (!isDirect()) return;
  const card = document.querySelector('#homeBody .tv'); if (!card) return;
  const sub = card.querySelector('.row .sub'); if (sub) sub.textContent = 'متصل على الواي فاي';
  card.querySelectorAll('.stats').forEach(s => s.remove());
  card.insertAdjacentHTML('beforeend', `<div class="hint" style="margin-top:12px">${ic('info')} كل شي يشتغل هسه. التنظيف بس يحتاج إذن التجهيز. <a href="#" id="hAdb" style="color:var(--ac)">أعطي الإذن</a>${INFO && !INFO.a11y ? ` · <a href="#" id="hA11y" style="color:var(--ac)">فعّل الأسهم داخل التطبيقات</a>` : ''}</div>`);
  const a = $('#hAdb'); if (a) a.onclick = ev => { ev.preventDefault(); addSheet(); };
  const b = $('#hA11y'); if (b) b.onclick = ev => { ev.preventDefault(); dA11yHint.shown = false; dA11yHint(); };
};
/* setup tab over Wi-Fi: explain what needs the permission */
const _renderClean = renderClean;
renderClean = function () {
  if (!isDirect()) return _renderClean();
  $('#cleanBody').innerHTML = `<div class="panel"><h2>التجهيز يحتاج إذن مرة وحدة</h2>
    <p class="sub" style="margin:0 0 12px">إنت متصل على الواي فاي. حتى أنظف الشاشة وأوقف التطبيقات المزعجة لازم تفعّل «تصحيح الأخطاء» بالتلفزيون مرة وحدة. بعد التجهيز ترجع تشتغل على الواي فاي عادي.</p>
    <button class="btn pri full" id="ccAdb">${ic('key')} أعطي الإذن وابدي التجهيز</button>
    <button class="btn ghost full" id="ccHow">${ic('info')} شلون أفعّل تصحيح الأخطاء؟</button></div>
    <div class="panel"><h2>شغال على الواي فاي بدون إذن</h2><p class="sub" style="margin:0">الريموت، تصميم وتصدير الواجهات، المعرض، الصور، إرسال الملفات وتثبيت التطبيقات، عرض الموبايل، واجهة السيارة، جدول التشغيل، قفل التطبيقات، تقرير الاستخدام، والإشعارات.</p></div>`;
  $('#ccAdb').onclick = () => addSheet();
  $('#ccHow').onclick = () => howTo();
};
RENDER.home = renderHome; RENDER.clean = renderClean;

/* live view needs the permission; sending a file opens it through the launcher */
const _openLive = openLive;
openLive = function () { if (isDirect()) return needAdbSheet(); return _openLive(); };
const _afterSend = afterSend;
afterSend = function (full) {
  if (!isDirect() || !D_LAST_SENT) return _afterSend(full);
  const r = D_LAST_SENT, name = r.name || full.split('/').pop();
  addLog('إرسال ملف ' + name + ' لـ ' + tvName(), []);
  const isImg = /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(name) || /^image\//.test(r.mime || '');
  sheet(`<h2>وصل الملف ✓</h2><p class="sub">«${esc(name)}» صار بمجلد التنزيلات بالشاشة.</p>
    ${isImg ? `<button class="btn pri full" id="asWall">${ic('layers')} خليها خلفية للشاشة</button><div style="height:8px"></div>` : ''}
    <button class="btn ${isImg ? 'sec' : 'pri'} full" id="asOpen">${ic('play')} افتحه على الشاشة هسه</button><div style="height:8px"></div><button class="btn ghost full" id="asOk">تمام</button>`);
  if (isImg) $('#asWall').onclick = () => { closeSheet(); busy('أخليها خلفية…');
    dapi('wall/from', { uri: r.uri || r.path || full }).then(x => { unbusy(); toast(x.ok ? 'صارت خلفية الشاشة ✓ وتلگاها بمصدر «صوري»' : 'ما گدرت. حدّث «واجهة مدير الشاشات» على الشاشة'); })
      .catch(e => { unbusy(); toast(/HTTP 404|HTTP 400/.test(e.message) ? 'حدّث «واجهة مدير الشاشات» على الشاشة حتى تشتغل هاي' : errText(e)); }); };
  $('#asOpen').onclick = () => { closeSheet(); dapi('view', { uri: r.uri, mime: r.mime || '' }).then(x => toast(x.ok ? 'انفتح على الشاشة' : 'ماكو تطبيق بالشاشة يفتح هذا النوع')).catch(e => toast(errText(e))); };
  $('#asOk').onclick = closeSheet;
};
const _openFiles = openFiles;
openFiles = function (p, o) {
  if (!isDirect()) return _openFiles(p, o);
  sheet(`<h2>ملفات الشاشة</h2><p class="sub">تگدر ترسل أي ملف وتفتحه على الشاشة هسه. تصفح كل ملفات الشاشة يحتاج إذن التجهيز.</p>
    <button class="btn pri full" id="ofSend">${ic('plus')} أرسل ملف وافتحه</button><div style="height:8px"></div><button class="btn sec full" id="ofAdb">${ic('key')} أعطي إذن التجهيز</button>`);
  $('#ofSend').onclick = () => { closeSheet(); busy('اختار الملف…'); run('pick', { mode: 'push' }).then(r => { unbusy(); afterSend(r); }).catch(e => { unbusy(); if (e.message !== 'CANCEL') toast(errText(e)); }); };
  $('#ofAdb').onclick = () => { closeSheet(); addSheet(); };
};
/* apps on the TV for pickers (lock, kids, car) */
async function tvAppList() {
  if (dTok(CONN.host)) { try { const l = await dapi('apps'); if (Array.isArray(l) && l.length) return l.map(a => ({ pkg: a.pkg, label: a.label || a.pkg })); } catch (e) {} }
  if (!isDirect()) {
    try {
      const out = await sh('cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER; cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER');
      return [...new Set(String(out).split('\n').map(l => l.trim().split('/')[0]).filter(p => /^[a-z][\w.]+\.[\w.]+$/i.test(p)))].sort().map(pkg => ({ pkg, label: (KNOWN_APPS[pkg] || [pkg])[0] }));
    } catch (e) {}
  }
  return [];
}
const _previewApps = previewApps;
previewApps = async function () {
  if (isDirect() && !pvApps) { const l = await tvAppList(); if (l.length) { pvApps = l.slice(0, 16).map(a => ({ pkg: a.pkg, label: a.label, color: (KNOWN_APPS[a.pkg] || [])[1] || '' })); return pvApps; } }
  return _previewApps();
};

/* manual add: Wi-Fi first (car head units on the phone hotspot are often not found by discovery) */
const _addSheet = addSheet;
addSheet = function () {
  _addSheet();
  const b = $('#sheetBody'); if (!b) return;
  b.insertAdjacentHTML('afterbegin', `<div class="panel" style="margin:0 0 14px"><h2 style="margin-top:0">${ic('wifi')} على الواي فاي (بدون تصحيح الأخطاء)</h2>
    <p class="sub">«واجهة مدير الشاشات» لازم تكون منصّبة بالشاشة. العنوان يطلع بمربع الربط بالشاشة (بالسيارة: اضغط مطوّل على الشريط العلوي).</p>
    <input id="wHost" class="num" inputmode="decimal" placeholder="192.168.43.20">
    <button class="btn pri full" id="wGo" style="margin-top:10px">اتصل على الواي فاي</button></div>
    <h2 style="font-size:15px">أو بإذن تصحيح الأخطاء</h2>`);
  $('#wGo').onclick = () => {
    const h = $('#wHost').value.trim().replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return toast('اكتب العنوان مثل 192.168.43.20');
    closeSheet(); directConnect(h);
  };
};

/* install the launcher on a new screen from the phone itself: the screen's browser opens a short address */
async function shareInstall() {
  busy('أجهّز الواجهة بالموبايل…');
  let r;
  try { r = await run('shareStart', { __local: true }); } catch (e) { unbusy(); return toast(errText(e)); }
  unbusy();
  const ips = (r.ips || []), hot = ips.filter(x => x.hot), pick = (hot.length ? hot : ips)[0];
  if (!pick) return toast('شغّل الهوتسبوت بالموبايل أو اربطه على نفس الواي فاي ويه الشاشة');
  /* one address only, sized to fit any phone: the long list of numbers used to spill out of the box */
  const addr = pick.ip + ':' + r.port, mb = r.size ? (r.size / 1048576).toFixed(1) + ' ميگا' : '';
  sheet(`<div style="text-align:center"><div class="sub" style="color:var(--ac);font-weight:700;margin:0 0 4px">أهلاً وسهلاً 👋</div>
    <h2 style="margin:0 0 6px">ثبّت واجهة مدير الشاشات على الشاشة</h2>
    <p class="sub" style="margin:0 0 12px">${r.ver ? 'الإصدار ' + esc(r.ver) + (mb ? ' · ' : '') : ''}${esc(mb)}</p></div>
    <p class="sub">١. اربط الشاشة على هوتسبوت هذا الموبايل، أو نفس الواي فاي، أو بالكيبل (مشاركة الإنترنت عبر USB).<br>٢. افتح المتصفح بالشاشة واكتب هذا العنوان:</p>
    <div class="shAddr" style="direction:ltr;text-align:center;padding:16px 10px 10px;margin:10px 0 4px;border-radius:18px;background:var(--card2,rgba(255,255,255,.06));border:1px solid var(--line,rgba(255,255,255,.1));overflow:hidden">
      <div style="font-size:12px;opacity:.55;margin-bottom:2px">http://</div>
      <div class="num" style="font-weight:800;line-height:1.2;white-space:nowrap;font-size:28px">${esc(addr)}</div>
      <div style="font-size:11px;opacity:.6;margin-top:8px;direction:rtl">تحميل</div></div>
    <button class="btn ghost full" id="shCopy" style="margin-bottom:6px">${ic('copy')} انسخ العنوان</button>
    <p class="sub">٣. اضغط الصندوق الذهبي بالصفحة وثبّت الملف. بعدها افتح الواجهة وارجع هنا، الشاشة تطلع وحدها بالقائمة.</p>
    ${hot.length ? '' : `<p class="sub" style="opacity:.75">إذا العنوان ما فتح: شغّل نقطة الاتصال بالموبايل واربط الشاشة عليها، ورجع افتح هذي الصفحة.</p>`}
    <button class="btn pri full" id="shDone">خلصت</button>`);
  const big = $('#sheetBody .shAddr .num'); if (big) { const w = Math.min(34, Math.floor(($('#sheetBody').clientWidth - 40) / (addr.length * 0.62))); big.style.fontSize = Math.max(18, w) + 'px'; }
  $('#shCopy').onclick = () => { try { B.copy('http://' + addr); } catch (e) {} toast('انتسخ العنوان'); };
  $('#shDone').onclick = () => { closeSheet(); run('shareStop', { __local: true }).catch(() => {}); };
}
const _addSheet2 = addSheet;
addSheet = function () {
  _addSheet2();
  const b = $('#sheetBody'); if (!b) return;
  b.insertAdjacentHTML('afterbegin', `<button class="btn pri full" id="shNew" style="margin-bottom:12px">${ic('plus')} ثبّت واجهة مدير الشاشات على شاشة جديدة (سيارة / بوكس)</button>`);
  $('#shNew').onclick = () => { closeSheet(); shareInstall(); };
};
const _renderFound2 = renderFound;
renderFound = function () {
  _renderFound2();
  const el = $('#foundList'); if (!el || !el.querySelector('.empty') || el.querySelector('#shNew2')) return;
  el.querySelector('.empty').insertAdjacentHTML('beforeend', `<button class="btn sec" id="shNew2" style="margin-top:12px">ما تطلع شاشتك؟ ثبّت الواجهة عليها من الموبايل</button>`);
  $('#shNew2').onclick = e => { e.stopPropagation(); shareInstall(); };
};
