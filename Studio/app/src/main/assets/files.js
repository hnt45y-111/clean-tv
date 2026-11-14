'use strict';
/* ============================================================ file manager (TV, box or car screen) */
const FM_PLACES = [['التنزيلات', '/sdcard/Download'], ['الصور', '/sdcard/Pictures'], ['الكاميرا', '/sdcard/DCIM'], ['الفيديو', '/sdcard/Movies'],
  ['الموسيقى', '/sdcard/Music'], ['المستندات', '/sdcard/Documents'], ['كل الذاكرة', '/sdcard']];
const FM_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
  mp4: 'video/mp4', mkv: 'video/x-matroska', avi: 'video/x-msvideo', mov: 'video/quicktime', ts: 'video/mp2t', webm: 'video/webm', m4v: 'video/mp4', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg',
  pdf: 'application/pdf', txt: 'text/plain', apk: 'application/vnd.android.package-archive', zip: 'application/zip' };
const fmExt = n => (/\.([a-z0-9]+)$/i.exec(n) || [, ''])[1].toLowerCase();
const fmKind = n => { const m = FM_MIME[fmExt(n)] || ''; return m.startsWith('image') ? 'img' : m.startsWith('video') ? 'vid' : m.startsWith('audio') ? 'aud' : fmExt(n) === 'apk' ? 'apk' : 'doc'; };
const fmIcon = r => r.dir ? 'layers' : ({ img: 'cam', vid: 'play', aud: 'vol', apk: 'apps', doc: 'file' })[fmKind(r.name)];
const fmKindName = n => ({ img: 'صورة', vid: 'فيديو', aud: 'صوت', apk: 'تطبيق', doc: 'ملف' })[fmKind(n)];
const fmSize = n => n > 1073741824 ? (n / 1073741824).toFixed(1) + ' گيگا' : n > 1048576 ? (n / 1048576).toFixed(1) + ' ميگا' : n > 1024 ? Math.round(n / 1024) + ' كيلو' : n + ' بايت';
const shQ = p => '"' + String(p).replace(/(["\\$`])/g, '\\$1') + '"';
const fmJoin = (dir, name) => (dir === '/' ? '' : dir.replace(/\/$/, '')) + '/' + name;

function fmParse(out) {
  return String(out || "").split("\n").map(l => {
    const m = /^([dl\-])[rwxst\-]{9}\S*\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+\s+\S+)\s+(.+)$/.exec(l.trim());
    if (!m) return null;
    let name = m[4]; if (m[1] === 'l') name = name.split(' -> ')[0];
    if (name === '.' || name === '..') return null;
    return { dir: m[1] !== '-', size: +m[2], date: m[3], name };
  }).filter(Boolean).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'ar'));
}

async function fmOpenOnScreen(full) {
  const mime = FM_MIME[fmExt(full)] || '*/*';
  if (fmExt(full) === 'apk') {
    busy('أثبّت التطبيق على الشاشة…');
    try { const o = await sh(`pm install -r ${shQ(full)} 2>&1`); unbusy(); toast(/Success/.test(o) ? 'تم التثبيت ✓' : 'ما تثبّت: ' + o.slice(0, 120)); } catch (e) { unbusy(); toast(errText(e)); }
    return;
  }
  try {
    const where = "_data='" + full.replace(/'/g, "''") + "'";
    const q = await sh(`content query --uri content://media/external/file --projection _id --where ${shQ(where)} 2>/dev/null | head -1`);
    const id = (/_id=(\d+)/.exec(q) || [])[1];
    const uri = id ? 'content://media/external/file/' + id : 'file://' + full;
    const r = await sh(`am start -a android.intent.action.VIEW -d ${shQ(uri)} -t ${shQ(mime)} --grant-read-uri-permission 2>&1`);
    if (/Error|No Activity|unable to resolve/i.test(r)) toast('ماكو تطبيق بالشاشة يفتح هذا النوع. نصّب VLC من المتجر');
    else toast('انفتح على الشاشة');
  } catch (e) { toast(errText(e)); }
}
function fmScan(full) { sh(`am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d ${shQ('file://' + full)} >/dev/null 2>&1`).catch(() => {}); }

function fmAsk(title, value, okText, done) {
  sheet(`<h2>${esc(title)}</h2><input id="fmIn" value="${esc(value || '')}" style="direction:ltr;text-align:right" maxlength="120">
    <button class="btn pri full" id="fmOk" style="margin-top:12px">${esc(okText)}</button><div style="height:8px"></div><button class="btn ghost full" id="fmNo">إلغاء</button>`);
  const i = $('#fmIn'); setTimeout(() => { i.focus(); i.select(); }, 150);
  $('#fmNo').onclick = closeSheet;
  $('#fmOk').onclick = () => { const v = i.value.trim().replace(/[\/\\]/g, '_'); if (!v) return; closeSheet(); done(v); };
}

function afterSend(full) {
  fmScan(full);
  const dir = full.split('/').slice(0, -1).join('/') || '/', name = full.split('/').pop();
  addLog('إرسال ملف ' + name + ' لـ ' + tvName(), []);
  const isImg = fmKind(name) === 'img';
  sheet(`<h2>وصل الملف ✓</h2><p class="sub">«${esc(name)}» صار بالشاشة بمجلد:</p><p class="sub num" style="direction:ltr;text-align:right">${esc(dir)}</p>
    ${isImg ? `<button class="btn pri full" id="asWall">${ic('layers')} خليها خلفية للشاشة</button><div style="height:8px"></div>` : ''}
    <button class="btn ${isImg ? 'sec' : 'pri'} full" id="asOpen">${ic(fmIcon({ name }))} ${fmKind(name) === 'apk' ? 'ثبّته على الشاشة' : 'افتحه على الشاشة هسه'}</button><div style="height:8px"></div>
    <button class="btn sec full" id="asDir">${ic('layers')} روح للمجلد بمدير الملفات</button><div style="height:8px"></div>
    <button class="btn ghost full" id="asOk">تمام</button>`);
  $('#asOpen').onclick = () => { closeSheet(); fmOpenOnScreen(full); };
  if (isImg) $('#asWall').onclick = () => { closeSheet(); wallFromScreenFile(full); };
  $('#asDir').onclick = () => { closeSheet(); openFiles(dir); };
  $('#asOk').onclick = closeSheet;
}

let fmStore = null;
async function fmStorage() {
  try {
    const [df, st] = await Promise.all([sh('df /sdcard 2>/dev/null | tail -1'), sh('ls /storage 2>/dev/null')]);
    const p = String(df).trim().split(/\s+/), total = +p[1], used = +p[2];
    const usb = String(st).split(/\s+/).filter(x => /^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$|^usb/i.test(x)).map(x => ['ذاكرة خارجية ' + x, '/storage/' + x]);
    fmStore = { total: total * 1024, used: used * 1024, usb };
  } catch (e) { fmStore = { usb: [] }; }
  return fmStore;
}

openFiles = async function (path, opts) {
  if (!need()) return;
  path = path || '/sdcard/Download';
  busy('أفتح المجلد…');
  let rows = [];
  try {
    const [out] = await Promise.all([sh(`ls -la ${shQ(path)} 2>/dev/null`), fmStore ? null : fmStorage()]);
    rows = fmParse(out);
    unbusy();
  } catch (e) { unbusy(); return toast(errText(e)); }
  const q = (opts && opts.q) || '';
  const places = FM_PLACES.concat((fmStore && fmStore.usb) || []);
  const up = path.split('/').slice(0, -1).join('/') || '/';
  const st = fmStore && fmStore.total ? `<div class="panel" style="padding:12px 14px"><div class="row" style="justify-content:space-between"><b>ذاكرة ${esc(tvName())}</b><span class="sub num">${fmSize(fmStore.total - fmStore.used)} فارغة</span></div>
    <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, Math.round(fmStore.used * 100 / fmStore.total))}%;background:${fmStore.used / fmStore.total > .85 ? 'var(--bad)' : 'var(--ac)'}"></i></div></div>` : '';
  const shown = rows.slice(0, 400);
  const html = `${st}
    <div class="chips" style="margin-bottom:10px">${places.map(([n, p]) => `<button class="chip ${path === p ? 'on' : ''}" data-pl="${esc(p)}">${esc(n)}</button>`).join('')}</div>
    <div class="panel" style="padding:10px 14px;margin-bottom:10px"><p class="sub num" style="direction:ltr;text-align:right;margin:0;word-break:break-all">${esc(path)}</p></div>
    <div class="row" style="margin-bottom:10px;gap:8px">
      <button class="btn sec" id="fUp" style="flex:1" ${path === '/' ? 'disabled' : ''}>${ic('right')} للأعلى</button>
      <button class="btn pri" id="fSend" style="flex:1.3">${ic('plus')} أرسل ملف هنا</button></div>
    <div class="row" style="margin-bottom:12px;gap:8px">
      <button class="btn ghost" id="fNew" style="flex:1">${ic('layers')} مجلد جديد</button>
      <button class="btn ghost" id="fFind" style="flex:1">${ic('info')} بحث</button></div>
    <div class="list">${shown.length ? shown.map((r, i) => `<div class="item tap" data-f="${i}"><div class="fileic">${ic(fmIcon(r))}</div>
      <div class="t"><b style="direction:ltr;text-align:right;word-break:break-all">${esc(r.name)}</b><small>${r.dir ? 'مجلد' : fmKindName(r.name) + ' · ' + fmSize(r.size)} · <span class="num">${esc(r.date)}</span></small></div>${r.dir ? ic('left') : ''}</div>`).join('')
      : `<div class="empty">${q ? 'ما لگيت شي بهالاسم' : 'المجلد فارغ'}</div>`}</div>
    ${rows.length > shown.length ? `<p class="sub">يبين أول ${shown.length} من ${rows.length}</p>` : ''}`;
  const after = el => {
    el.onclick = async e => {
      const pl = e.target.closest('[data-pl]'); if (pl) { tap(); openFiles(pl.dataset.pl); return; }
      if (e.target.closest('#fUp')) { openFiles(up); return; }
      if (e.target.closest('#fSend')) {
        busy('اختار الملف من موبايلك…');
        run('pick', { mode: 'push', dir: path }).then(r => { unbusy(); openFiles(path); setTimeout(() => afterSend(r), 300); })
          .catch(er => { unbusy(); if (er.message !== 'CANCEL') toast(errText(er)); });
        return;
      }
      if (e.target.closest('#fNew')) { fmAsk('اسم المجلد الجديد', '', 'سوّي المجلد', async n => { try { await sh(`mkdir -p ${shQ(fmJoin(path, n))}`); toast('انسوّى'); openFiles(path); } catch (er) { toast(errText(er)); } }); return; }
      if (e.target.closest('#fFind')) {
        fmAsk('دوّر على ملف (جزء من الاسم)', '', 'دوّر', async n => {
          busy('أدور…');
          try {
            const o = await sh(`find /sdcard ${(fmStore && fmStore.usb || []).map(x => shQ(x[1])).join(' ')} -iname ${shQ('*' + n + '*')} 2>/dev/null | head -150`);
            unbusy();
            const list = String(o).split('\n').map(x => x.trim()).filter(Boolean);
            page('نتائج «' + n + '»', `<div class="list">${list.length ? list.map((p, i) => `<div class="item tap" data-r="${i}"><div class="fileic">${ic(fmIcon({ name: p }))}</div><div class="t"><b style="direction:ltr;text-align:right;word-break:break-all">${esc(p.split('/').pop())}</b><small class="num" style="direction:ltr;text-align:right">${esc(p)}</small></div></div>`).join('') : '<div class="empty">ما لگيت شي</div>'}</div>`, el2 => {
              el2.onclick = ev => { const r = ev.target.closest('[data-r]'); if (!r) return; const p = list[+r.dataset.r]; fileSheet({ name: p.split('/').pop(), dir: false, size: 0 }, p, p.split('/').slice(0, -1).join('/')); };
            });
          } catch (er) { unbusy(); toast(errText(er)); }
        });
        return;
      }
      const f = e.target.closest('[data-f]'); if (!f) return;
      const r = shown[+f.dataset.f], full = fmJoin(path, r.name);
      if (r.dir) { openFiles(full); return; }
      fileSheet(r, full, path);
    };
  };
  page('مدير الملفات', html, after);
};

function fileSheet(r, full, dir) {
  const k = fmKind(r.name);
  sheet(`<h2 style="direction:ltr;text-align:right;word-break:break-all">${esc(r.name)}</h2><p class="sub">${fmKindName(r.name)}${r.size ? ' · ' + fmSize(r.size) : ''}</p>
    <button class="btn pri full" data-x="open">${ic(fmIcon(r))} ${k === 'apk' ? 'ثبّته على الشاشة' : 'افتحه على الشاشة'}</button><div style="height:8px"></div>
    <button class="btn sec full" data-x="get">${ic('save')} نزّله للموبايل</button><div style="height:8px"></div>
    <div class="row" style="gap:8px"><button class="btn sec" style="flex:1" data-x="ren">${ic('kb')} اسم جديد</button><button class="btn sec" style="flex:1" data-x="copy">${ic('copy')} نسخة بالتنزيلات</button></div><div style="height:8px"></div>
    <button class="btn bad full" data-x="del">${ic('trash')} حذف من الشاشة</button>`);
  $('#sheetBody').onclick = async ev => {
    const x = ev.target.closest('[data-x]'); if (!x) return;
    const a = x.dataset.x;
    if (a === 'del' && x.dataset.sure !== '1') { x.dataset.sure = '1'; x.textContent = 'متأكد؟ الحذف نهائي، اضغط مرة ثانية'; return; }
    closeSheet();
    try {
      if (a === 'open') fmOpenOnScreen(full);
      if (a === 'get') { busy('أنزل الملف للموبايل…'); const w = await run('pull', { path: full }); unbusy(); toast('انحفظ بموبايلك ← ' + w); }
      if (a === 'ren') fmAsk('الاسم الجديد', r.name, 'غيّر الاسم', async n => { try { await sh(`mv ${shQ(full)} ${shQ(fmJoin(dir, n))}`); fmScan(fmJoin(dir, n)); toast('تغيّر الاسم'); openFiles(dir); } catch (er) { toast(errText(er)); } });
      if (a === 'copy') { busy('أنسخ…'); await sh(`cp ${shQ(full)} ${shQ('/sdcard/Download/' + r.name)}`); fmScan('/sdcard/Download/' + r.name); unbusy(); toast('انحطت نسخة بالتنزيلات'); }
      if (a === 'del') { await sh(`rm -rf ${shQ(full)}`); toast('انحذف'); openFiles(dir); }
    } catch (er) { unbusy(); toast(errText(er)); }
  };
}

/* a photo that is already on the screen becomes a wallpaper: it is copied into the launcher's own wallpaper folder
   («صوري», read by the wallpaper sources) and shown at once, instead of opening a file manager */
async function wallFromScreenFile(full) {
  busy('أخليها خلفية…');
  try {
    const nm = 'w' + Date.now().toString(36) + '.jpg', q = s => "'" + String(s).replace(/'/g, "'\\''") + "'";
    await sh(`content write --uri content://com.cleantv.launcher.files/bg/${nm} < ${q(full)}`);
    const r = await sh(`am broadcast -n com.cleantv.launcher/.ConfigReceiver -a com.cleantv.WALLPAPER --es name ${nm} --ez pin true`);
    unbusy();
    if (/result=1/.test(r)) { toast('صارت خلفية الشاشة ✓ وتلگاها بمصدر «صوري»'); addLog('خلفية جديدة من الموبايل لـ ' + tvName(), []); }
    else needLauncherSheet('حتى تصير الصورة خلفية لازم «واجهة مدير الشاشات» النسخة الجديدة على الشاشة.', () => wallFromScreenFile(full));
  } catch (e) { unbusy(); toast(errText(e)); }
}
