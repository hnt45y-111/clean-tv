/* ============================================================ connecting with a cable
   Two ways, for car screens and old phones that have no wireless debugging:
   1) USB tethering: the phone shares its internet over the cable, the screen gets an address on that cable
      network and the app finds it there like on Wi-Fi (ADB over network, port 5555).
   2) Direct ADB over an OTG cable: this phone is the USB host and talks ADB straight to the screen. */

function cableSheet() {
  sheet(`<h2>الاتصال عبر الكيبل</h2>
    <p class="sub">للشاشات والموبايلات القديمة اللي ما بيها تصحيح أخطاء لاسلكي. اختار الطريقة اللي تناسب جهازك:</p>
    <div class="panel soft" style="margin:10px 0;padding:14px">
      <h2 style="font-size:16px;margin:0 0 4px">١. كيبل مباشر (OTG)</h2>
      <p class="sub" style="margin:0 0 10px">اربط الموبايل بالشاشة بكيبل OTG (الموبايل يكون الطرف الرئيسي). فعّل «تصحيح USB» بالشاشة من خيارات المطوّر، وبعدها اضغط اتصل ووافق على «السماح بتصحيح USB» اللي يطلع على الشاشة.</p>
      <button class="btn pri full" id="cbUsb">${ic('screen')} اتصل بالكيبل</button>
    </div>
    <div class="panel soft" style="margin:10px 0;padding:14px">
      <h2 style="font-size:16px;margin:0 0 4px">٢. مشاركة الإنترنت عبر USB (أغلب شاشات السيارات)</h2>
      <p class="sub" style="margin:0 0 10px">اربط الموبايل بمنفذ USB بالسيارة، وشغّل «مشاركة الإنترنت عبر USB» بالموبايل. بشاشة السيارة فعّل «تصحيح الأخطاء عبر الشبكة» (ADB 5555) من خيارات المطوّر. التطبيق يدوّر على الشاشة بالكيبل وحده.</p>
      <button class="btn sec full" id="cbTether">${ic('settings')} افتح إعدادات مشاركة الإنترنت</button>
      <button class="btn ghost full" id="cbScan" style="margin-top:8px">${ic('refresh')} دوّر على الشاشة بالكيبل</button>
    </div>`);
  $('#cbUsb').onclick = () => { closeSheet(); kvSet('devType_usb', null); usbConnect(); };
  $('#cbTether').onclick = () => { run('tetherSettings', { __local: true }); toast('شغّل «مشاركة الإنترنت عبر USB» وارجع'); };
  $('#cbScan').onclick = () => { closeSheet(); try { B.discover(true); } catch (e) {} show('home'); toast('أدوّر على الشاشة… تطلع بقائمة «أجهزة حواليك»'); };
}

async function usbConnect(after) {
  busy('أتصل بالكيبل…', 'إذا طلب الموبايل إذن الكيبل اسمحله، وعلى الجهاز الثاني اختار «السماح بتصحيح USB»');
  window.__usbBusy = true;
  /* a way out if nothing happens */
  const bx = $('#busy'); let cx = null;
  const tm = setTimeout(() => {
    if (!bx || !window.__usbBusy) return;
    cx = document.createElement('button'); cx.className = 'btn ghost'; cx.id = 'usbX'; cx.style.marginTop = '12px'; cx.textContent = 'إلغاء';
    cx.onclick = () => run('usbCancel', { __local: true }).catch(() => {});
    (bx.querySelector('.box') || bx).appendChild(cx);
  }, 8000);
  const done = () => { window.__usbBusy = false; clearTimeout(tm); if (cx) cx.remove(); };
  try {
    const r = await run('usbConnect', { __local: true });
    done();
    CONN = { connected: true, host: 'usb', port: 0, usb: true };
    try { INFO = await run('info'); } catch (e) { INFO = null; }
    unbusy();
    toast('اتصلت بالكيبل' + (INFO && INFO.model ? ' بـ ' + INFO.model : r.model ? ' بـ ' + r.model : ''));
    if (after) after(r); else RENDER[cur] && RENDER[cur]();
  } catch (e) { done(); unbusy(); usbHelp(errText(e)); }
}

/* a failed cable attempt explains what to check, instead of a short toast */
function usbHelp(msg) {
  sheet(`<h2>ما اشتغل الكيبل</h2><p class="sub" style="color:var(--ink)">${esc(msg)}</p>
    <div class="panel soft" style="padding:12px 14px;margin:10px 0"><b>تأكد من هاي:</b>
      <p class="sub" style="margin:6px 0 0">١. طرف الـ OTG (المحوّل) يكون بهذا الموبايل، والكيبل يدعم البيانات مو بس الشحن.<br>
      ٢. بالجهاز الثاني: الإعدادات ← خيارات المطوّر ← «تصحيح USB» مشغّل.<br>
      ٣. إذا الكيبل Type-C من الطرفين: بالجهاز الثاني افتح إشعار USB واختار «التحكم بالـ USB: الجهاز المتصل».<br>
      ٤. لما تطلع «السماح بتصحيح USB» على الجهاز الثاني اختار «السماح دائماً من هذا الكمبيوتر».</p></div>
    <button class="btn pri full" id="uhAgain">${ic('refresh')} جرّب مرة ثانية</button>`);
  $('#uhAgain').onclick = () => { closeSheet(); usbConnect(); };
}

/* the «add a screen» sheet starts with the choice: Wi-Fi or cable */
(function () {
  const _add = addSheet;
  addSheet = function () {
    _add.apply(this, arguments);
    const b = $('#sheetBody'); if (!b) return;
    b.insertAdjacentHTML('afterbegin', `<div class="seg" id="conWay" style="margin-bottom:12px"><button class="on" data-w="wifi">الاتصال عبر واي فاي</button><button data-w="usb">الاتصال عبر الكيبل</button></div>`);
    $('#conWay').onclick = e => { const x = e.target.closest('[data-w]'); if (x && x.dataset.w === 'usb') cableSheet(); };
  };
})();
