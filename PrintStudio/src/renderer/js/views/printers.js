import { $, $$, esc, call, run, toast, icon, actions, fmtDate } from '../util.js';
import { S, refreshState, refreshDevices } from '../state.js';
import { printerWizard } from '../main.js';

export async function mount(root) {
  let sel = S.settings.printer.name || '', jobs = null, devs = null, devErr = '';
  const redraw = () => draw(); S.listeners.add(redraw);
  async function loadJobs() { jobs = null; draw(); try { jobs = await call('printerJobs', sel); } catch (e) { jobs = { error: e.message }; } draw(); }
  async function loadDevs() {
    devs = null; devErr = ''; draw();
    try { devs = await call('devicesConnected'); } catch (e) { devs = []; devErr = e.message; }
    draw();
  }
  const devPanel = () => `<div class="card" style="margin-top:14px"><div class="row"><h3 class="grow">الأجهزة المتصلة بالحاسوب</h3><button class="btn sm" data-act="devs">${icon('refresh')} بحث عن أجهزة</button><button class="btn sm purple" data-act="addwiz">${icon('plus')} إضافة طابعة في Windows</button><button class="btn sm ghost" data-act="winprn">${icon('gear')} إعدادات الطابعات في Windows</button></div>
    ${devs === null ? '<div class="progress ind" style="margin-top:10px"><i></i></div>' : devErr ? `<div class="sub" style="margin-top:8px">${esc(devErr)}</div>` : !devs.length ? '<div class="sub" style="margin-top:8px">لم يُعثر على طابعة أو سكانر متصل بالحاسوب حالياً. تأكد من التشغيل والكابل، ثم اضغط «بحث عن أجهزة».</div>' : `<table class="t" style="margin-top:8px"><tbody>${devs.map((d) => `<tr><td><b>${esc(d.name)}</b><div class="sub" style="font-size:12px">${esc(d.manufacturer || '')} · ${d.class === 'Image' ? 'سكانر / كاميرا' : 'طابعة'}</div></td><td>${d.installed ? '<span class="pill ok">مثبّتة وجاهزة للاستخدام</span>' : '<span class="pill warn">متصلة لكن تعريفها غير مثبّت</span>'}</td></tr>`).join('')}</tbody></table><p class="sub" style="font-size:12px">الجهاز «غير المثبّت» يحتاج تعريفاً من موقع الشركة المصنّعة أو من «إضافة طابعة في Windows» ليظهر في القائمة أعلاه.</p>`}</div>`;
  function draw() {
    const P = S.printers, list = P && P.list || [], cur = S.settings.printer.name, p = list.find((x) => x.name === sel);
    root.innerHTML = `<div class="page-h"><span class="tag">🖨</span><h1>إدارة الطابعات</h1><span class="grow"></span><button class="btn sm" data-act="refresh">${icon('refresh')} تحديث</button><button class="btn sm ghost" data-act="wiz">اختيار طابعة مفضّلة</button></div>
    ${!P ? '<div class="progress ind"><i></i></div>' : P.error ? `<div class="card empty">${esc(P.error)}</div>` : !list.length ? '<div class="card empty">لا توجد طابعات مثبّتة في Windows.</div>' : `<div class="grid2" style="align-items:start">
      <div class="col">${list.map((x, i) => `<div class="printer-i ${x.name === sel ? 'on' : ''}" data-act="sel" data-i="${i}" role="button" tabindex="0">${icon('printer')}<div class="grow"><b>${esc(x.name)}</b><div class="sub" style="font-size:12px">${esc(x.driver)}</div></div><div class="col" style="gap:4px;align-items:flex-end"><span class="pill ${x.state === 'ready' || x.state === 'busy' ? 'ok' : x.state === 'offline' ? 'bad' : 'warn'}">${esc(x.statusText)}</span>${x.name === cur ? '<span class="pill ok">المفضّلة في البرنامج</span>' : ''}${x.isDefault ? '<span class="pill">افتراضية في Windows</span>' : ''}</div></div>`).join('')}</div>
      <div class="card">${p ? `<h2>${esc(p.name)}</h2><table class="t"><tbody><tr><th>التعريف (Driver)</th><td style="direction:ltr;text-align:start">${esc(p.driver)}</td></tr><tr><th>المنفذ</th><td style="direction:ltr;text-align:start">${esc(p.port)}</td></tr><tr><th>الحالة</th><td>${esc(p.statusText)}</td></tr><tr><th>الاتصال</th><td>${p.network ? 'شبكة' : 'محلي / USB'}${p.shared ? ' · مشتركة' : ''}</td></tr>${p.location ? `<tr><th>الموقع</th><td>${esc(p.location)}</td></tr>` : ''}${p.warning ? `<tr><th>تنبيه</th><td><span class="pill warn">${esc(p.warning)}</span></td></tr>` : ''}</tbody></table>
      <div class="row" style="margin-top:14px"><button class="btn sm" data-act="prefer" ${p.name === cur ? 'disabled' : ''}>${icon('check')} جعلها المفضّلة</button><button class="btn sm ghost" data-act="queue">${icon('open')} قائمة الانتظار في Windows</button><button class="btn sm ghost" data-act="props">${icon('gear')} خصائص الطابعة</button></div>
      <p class="sub" style="font-size:12px">مستويات الحبر والصيانة وتنظيف الرؤوس لا تُعرض هنا لأنها تعتمد على تعريف الشركة المصنّعة؛ استخدم «خصائص الطابعة» للوصول إليها إن كان التعريف يدعمها.</p>
      <h3 style="margin:14px 0 8px">مهام الطباعة الجارية ${jobs && !jobs.error ? `<span class="pill">${jobs.length}</span>` : ''}</h3>
      ${jobs === null ? '<div class="progress ind"><i></i></div>' : jobs.error ? `<div class="sub">${esc(jobs.error)}</div>` : !jobs.length ? '<div class="sub">لا توجد مهام في قائمة الانتظار.</div>' : `<table class="t"><tbody>${jobs.map((j) => `<tr><td>${esc(j.document)}</td><td>${esc(j.status)}</td><td>${j.pages || ''}</td><td><button class="btn sm red" data-act="cancel" data-id="${j.id}">إلغاء</button></td></tr>`).join('')}</tbody></table>`}
      <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="jobs">${icon('refresh')} تحديث المهام</button></div>` : '<div class="empty">اختر طابعة من القائمة</div>'}</div></div>`}${devPanel()}`;
  }
  actions(root, {
    refresh: (b) => run(b, async () => { await refreshDevices(); toast('تم تحديث الطابعات', 'ok'); }),
    wiz: () => printerWizard({ first: false }),
    devs: loadDevs,
    addwiz: (b) => run(b, () => call('printerAddWizard')),
    winprn: (b) => run(b, () => call('settingsOpen', 'ms-settings:printers')),
    sel: (b) => { sel = S.printers.list[+b.dataset.i].name; loadJobs(); },
    prefer: (b) => run(b, async () => { await call('printerSelect', sel); await refreshState(); await refreshDevices(); toast('الطابعة المفضّلة: ' + sel, 'ok'); }),
    queue: (b) => run(b, () => call('printerQueue', sel)), props: (b) => run(b, () => call('printerProps', sel)),
    jobs: loadJobs, cancel: (b) => run(b, async () => { await call('printerCancelJob', sel, +b.dataset.id); toast('أُلغيت المهمة', 'ok'); await loadJobs(); }),
  });
  draw(); if (!S.printers) await refreshDevices(); loadDevs(); if (sel) loadJobs();
  return () => S.listeners.delete(redraw);
}
