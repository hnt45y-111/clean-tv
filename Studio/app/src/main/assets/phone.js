'use strict';
/* ============================================================ phones: clean, speed up and remove extra apps
   This phone (Android 11+: wireless debugging + code in a notification; 10 and older: one-time "adb tcpip 5555")
   or another phone on the same Wi-Fi (same flows as a TV). Everything runs over ADB, nothing is rooted. */
Object.assign(ICONS, {
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 5-9 12-9 0 7-5 11-9 12z"/><circle cx="15" cy="9" r="1.6"/>',
  battery: '<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2M6 10v4M9.5 10v4"/>',
  box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>'
});

const PHONE_PROTECT = /^(android|com\.android\.(systemui|settings|shell|phone|providers\..*|packageinstaller|inputmethod.*|vending|externalstorage|bluetooth|nfc|keychain|location.*|server.*|networkstack.*|wifi.*|permissioncontroller|webview|media.*|se|cts.*|dialer|contacts|mms|server\.telecom|incallui|launcher3|camera2?|documentsui|emergency|cellbroadcast.*|carrierconfig|stk|ims|telephony.*)|com\.google\.android\.(gms|gsf|packageinstaller|inputmethod.*|webview|ext\..*|permissioncontroller|networkstack.*|modulemetadata|configupdater|syncadapters.*|dialer|contacts|apps\.messaging|trichromelibrary)|com\.android\.chrome|com\.sec\.android\.app\.launcher|com\.miui\.home|com\.mi\.android\.globallauncher|com\.oppo\.launcher|com\.android\.launcher|com\.huawei\.android\.launcher|com\.bbk\.launcher2|com\.samsung\.android\.(dialer|messaging|incallui|providers\..*|honeyboard|biometrics.*|knox.*|kgclient|lool|sm\..*)|com\.sec\.android\.app\.(camera|myfiles)|com\.miui\.(securitycenter|securitycore|guardprovider|system|systemAdSolution\.x)|com\.lbe\.security\.miui|com\.coloros\.(safecenter|securitypermission)|com\.oplus\.(securitypermission|safecenter)|com\.moamal\..*|com\.cleantv\..*)$/;
// [package, name, safe? (true = nothing breaks, false = check first)]
const PHONE_BLOAT = {
  common: [['com.facebook.appmanager', 'فيسبوك (مدير خفي)', true], ['com.facebook.services', 'خدمات فيسبوك الخفية', true], ['com.facebook.system', 'نظام فيسبوك الخفي', true],
    ['com.netflix.partner.activation', 'تفعيل نتفلكس المسبق', true], ['com.google.android.apps.tachyon', 'گوگل ميت', false], ['com.google.android.videos', 'گوگل تي في', true],
    ['com.google.android.apps.youtube.music', 'يوتيوب ميوزك', false], ['com.google.android.apps.podcasts', 'گوگل بودكاست', true], ['com.google.android.apps.magazines', 'گوگل نيوز', true],
    ['com.google.android.apps.subscriptions.red', 'گوگل ون', true], ['com.google.android.feedback', 'ملاحظات گوگل', true], ['com.google.android.apps.googleassistant', 'المساعد (اختصار)', false],
    ['com.linkedin.android', 'لينكد إن المسبق', true], ['com.booking', 'بوكنگ المسبق', true], ['com.amazon.mShop.android.shopping', 'أمازون المسبق', true], ['com.amazon.appmanager', 'مدير أمازون', true],
    ['com.microsoft.office.officehubrow', 'أوفيس المسبق', true], ['com.spotify.music', 'سبوتيفاي المسبق', false], ['com.netflix.mediaclient', 'نتفلكس المسبق', false], ['com.ss.android.ugc.trill', 'تيك توك المسبق', false]],
  samsung: [['com.samsung.android.bixby.agent', 'بيكسبي', true], ['com.samsung.android.bixby.wakeup', 'تشغيل بيكسبي بالصوت', true], ['com.samsung.android.app.spage', 'سامسونگ فري', true],
    ['com.samsung.android.visionintelligence', 'بيكسبي فيجن', true], ['com.samsung.android.bixbyvision.framework', 'إطار بيكسبي فيجن', true], ['com.samsung.android.arzone', 'منطقة AR', true],
    ['com.samsung.android.aremoji', 'إيموجي AR', true], ['com.samsung.android.app.tips', 'نصائح سامسونگ', true], ['com.samsung.android.kidsinstaller', 'وضع الأطفال', true],
    ['com.samsung.android.mateagent', 'وكيل الأجهزة', true], ['com.samsung.android.app.watchmanagerstub', 'مدير الساعة', true], ['com.samsung.android.game.gamehome', 'گيم لانچر', false],
    ['com.samsung.android.game.gametools', 'أدوات الألعاب', false], ['com.samsung.android.app.routines', 'الروتين', false], ['com.sec.android.app.sbrowser', 'متصفح سامسونگ', false],
    ['com.samsung.android.email.provider', 'بريد سامسونگ', false], ['com.samsung.android.spay', 'سامسونگ باي', false], ['com.samsung.android.samsungpass', 'سامسونگ باس', false],
    ['com.samsung.android.app.updatecenter', 'مركز التحديثات', false], ['com.samsung.android.livestickers', 'ملصقات حية', true], ['com.samsung.android.stickercenter', 'مركز الملصقات', true]],
  xiaomi: [['com.miui.msa.global', 'إعلانات شاومي (MSA)', true], ['com.miui.analytics', 'تحليلات شاومي', true], ['com.miui.daemon', 'جمع البيانات', true], ['com.miui.hybrid', 'تطبيقات سريعة', true],
    ['com.miui.hybrid.accessory', 'ملحقات سريعة', true], ['com.miui.yellowpage', 'الصفحات الصفراء', true], ['com.miui.bugreport', 'تقارير الأعطال', true], ['com.xiaomi.glgm', 'مركز الألعاب', true],
    ['com.miui.android.fashiongallery', 'خلفيات القفل المتغيرة', true], ['com.mi.globalbrowser', 'متصفح شاومي', false], ['com.miui.videoplayer', 'مشغل الفيديو', false],
    ['com.miui.player', 'مشغل الموسيقى', false], ['com.xiaomi.mipicks', 'متجر GetApps', false], ['com.miui.weather2', 'الطقس', false], ['com.xiaomi.joyose', 'جويوز (تحليلات الأداء)', false],
    ['com.miui.compass', 'البوصلة', false], ['com.mi.android.globalFileexplorer', 'مدير الملفات', false], ['com.miui.notes', 'الملاحظات', false], ['com.xiaomi.midrop', 'شير مي', false],
    ['com.miui.cleaner', 'المنظف', false], ['com.mi.health', 'صحة شاومي', false]],
  oppo: [['com.opos.ads', 'إعلانات أوبو وريلمي', true], ['com.heytap.pictorial', 'مجلة شاشة القفل', true], ['com.oplus.statistics.rom', 'إحصائيات النظام', true], ['com.coloros.bootreg', 'تسجيل أول تشغيل', true],
    ['com.heytap.browser', 'متصفح هاي تاب', false], ['com.heytap.market', 'متجر أوبو', false], ['com.coloros.gamespace', 'مساحة الألعاب', false], ['com.heytap.cloud', 'سحابة هاي تاب', false],
    ['com.coloros.video', 'الفيديو', false], ['com.heytap.music', 'الموسيقى', false], ['com.coloros.weather2', 'الطقس', false], ['com.realme.link', 'ريلمي لينك', true],
    ['com.oplus.games', 'ألعاب أوبو', false], ['com.heytap.themestore', 'متجر الثيمات', false], ['com.coloros.assistantscreen', 'شاشة المساعد', false]],
  huawei: [['com.huawei.browser', 'متصفح هواوي', false], ['com.huawei.appmarket', 'متجر هواوي', false], ['com.huawei.gameassistant', 'مساعد الألعاب', true], ['com.huawei.hifolder', 'المجلدات الذكية', true],
    ['com.huawei.himovie.overseas', 'الفيديو', false], ['com.huawei.music', 'الموسيقى', false], ['com.huawei.intelligent', 'الشاشة الذكية', true], ['com.huawei.hiskytone', 'سكاي تون', true]],
  vivo: [['com.vivo.browser', 'متصفح فيفو', false], ['com.vivo.globalsearch', 'البحث', true], ['com.vivo.hybrid', 'تطبيقات سريعة', true], ['com.bbk.theme', 'الثيمات', false], ['com.vivo.appstore', 'متجر فيفو', false]],
  transsion: [['com.transsion.phoenix', 'فينكس', true], ['com.transsion.hilauncher', '—', false], ['com.talpa.hibrowser', 'متصفح هاي', false], ['net.bat.store', 'متجر بالم', false], ['com.transsion.aivoiceassistant', 'المساعد الصوتي', true], ['com.afmobi.boomplayer', 'بوم بلاير', true], ['com.hoffnung.app.theme', 'الثيمات', false]]
};
const PHONE_NAMES = {};
Object.values(PHONE_BLOAT).forEach(l => l.forEach(x => { PHONE_NAMES[x[0]] = x[1]; }));
Object.assign(PHONE_NAMES, { 'com.whatsapp': 'واتساب', 'com.facebook.katana': 'فيسبوك', 'com.instagram.android': 'إنستغرام', 'org.telegram.messenger': 'تيليگرام', 'com.snapchat.android': 'سناب شات',
  'com.zhiliaoapp.musically': 'تيك توك', 'com.google.android.youtube': 'يوتيوب', 'com.android.chrome': 'كروم', 'com.facebook.orca': 'ماسنجر', 'com.viber.voip': 'فايبر', 'com.imo.android.imoim': 'إيمو' });

function brandKey(b) {
  b = String(b || '').toLowerCase();
  if (/samsung/.test(b)) return 'samsung'; if (/xiaomi|redmi|poco/.test(b)) return 'xiaomi'; if (/oppo|realme|oneplus/.test(b)) return 'oppo';
  if (/huawei|honor/.test(b)) return 'huawei'; if (/vivo|iqoo/.test(b)) return 'vivo'; if (/tecno|infinix|itel/.test(b)) return 'transsion'; return '';
}
const nfP = n => Number(n || 0).toLocaleString('ar-IQ', { maximumFractionDigits: 1 });
const SELF_HOST = '127.0.0.1';
let SELF = null, PH = null;
const phones = () => kv('phones', []);
function savePhone(d) { const l = phones().filter(x => x.host !== d.host); l.unshift(Object.assign({ at: Date.now() }, d)); kvSet('phones', l.slice(0, 8)); }
function isPhoneConn() {
  if (!CONN.connected) return false;
  if (CONN.host === SELF_HOST) return true;
  return phones().some(p => p.host === CONN.host) || (typeof devType === 'function' && devType() === 'phone');
}
function andBadge(sdk, rel) {
  const n = +sdk || 0;
  return n >= 30 ? `<span class="tag">أندرويد ${esc(rel || '')} · ربط لاسلكي</span>` : `<span class="tag warn">أندرويد ${esc(rel || '')} · يحتاج كيبل مرة وحدة</span>`;
}

/* ---------- inside «أجهزتي» ---------- */
const phRefresh = () => { if (cur === 'home') renderHome(); else show('home'); };
function phonesEntryHtml() {
  const sdk = +(SELF && SELF.sdk) || 0;
  return `<h2>الموبايلات</h2>
    <div class="pick" id="phPick">
      <button class="pcard" id="phSelf"><div class="pc-ic">${ic('phone')}</div><b>هذا الموبايل</b><small>${esc(SELF ? (SELF.brand || '') + ' ' + (SELF.model || '') : 'نظّفه وسرّعه')}</small>${sdk ? andBadge(sdk, SELF.release) : ''}</button>
      <button class="pcard" id="phOther"><div class="pc-ic alt">${ic('wifi')}</div><b>موبايل ثاني</b><small>على نفس الواي فاي</small><span class="tag">أي إصدار</span></button>
    </div>
    <button class="btn ghost full" id="phDiff">${ic('info')} شنو الفرق بين إصدارات أندرويد؟</button>`;
}
function bindPhonesEntry(root) {
  const w = root.querySelector('#phEntry'); if (!w) return;
  w.onclick = e => {
    e.stopPropagation();
    if (e.target.closest('#phSelf')) { tap(); selfFlow(); return; }
    if (e.target.closest('#phOther')) { tap(); otherFlow(); return; }
    if (e.target.closest('#phDiff')) {
      sheet(`<h2>إصدارات أندرويد</h2><div class="vs"><div><b>أندرويد ١١ وفوق</b><small>«تصحيح الأخطاء اللاسلكي» موجود. تربط من الموبايل نفسه برمز ٦ أرقام، بدون كيبل.</small></div>
        <div><b>أندرويد ١٠ وأقل</b><small>ماكو ربط لاسلكي. تحتاج حاسبة وكيبل مرة وحدة تكتب بيها أمر واحد، وبعدها يشتغل لحد ما تطفي الموبايل.</small></div></div>`);
    }
  };
}
async function loadSelf() {
  if (SELF) return SELF;
  try { SELF = await run('selfInfo', { __local: 1 }); } catch (e) { SELF = { sdk: 0 }; }
  return SELF;
}
function stepsHtml(list) { return `<ol class="steps2">${list.map((s, i) => `<li><i>${i + 1}</i><div>${s}</div></li>`).join('')}</ol>`; }
function selfFlow() {
  const sdk = +SELF.sdk || 0;
  if (sdk >= 30) {
    sheet(`<h2>ربط هذا الموبايل</h2><p class="sub">${andBadge(sdk, SELF.release)}</p>
      ${stepsHtml(['شغّل «خيارات المطوّر»: الإعدادات ← حول الهاتف ← اضغط «رقم الإصدار» ٧ مرات.', 'بخيارات المطوّر فعّل «تصحيح الأخطاء اللاسلكي».', 'ادخل عليه واضغط «إقران جهاز برمز الإقران». يطلع رمز من ٦ أرقام.', 'اسحب الإشعار من فوق («ربط هذا الموبايل») واكتب الرمز بيه. ما تحتاج تطلع من الإعدادات.'])}
      <button class="btn pri full" id="sfGo">${ic('bolt')} ابدأ الربط</button><div style="height:8px"></div>
      <button class="btn sec full" id="sfDev">افتح خيارات المطوّر</button>
      <button class="btn ghost full" id="sfDone">ربطته قبل؟ اتصل مباشرة</button>`);
    $('#sfDev').onclick = () => run('devSettings', { __local: 1 });
    $('#sfGo').onclick = async () => { try { await run('selfStart', { __local: 1 }); } catch (e) { return toast(errText(e)); } toast('هسه افتح «إقران جهاز برمز الإقران» واكتب الرمز بالإشعار'); run('devSettings', { __local: 1 }); };
    $('#sfDone').onclick = () => { closeSheet(); selfConnect(); };
  } else {
    sheet(`<h2>ربط هذا الموبايل</h2><p class="sub">${andBadge(sdk, SELF.release)}</p>
      <p class="sub">أندرويد ${esc(SELF.release || '')} ما بيه ربط لاسلكي، فنحتاج حاسبة مرة وحدة:</p>
      ${stepsHtml(['شغّل «خيارات المطوّر» (اضغط «رقم الإصدار» ٧ مرات) وفعّل «تصحيح أخطاء USB».', 'اربط الموبايل بالحاسبة بالكيبل، ووافق على رسالة السماح.', 'بمجلد platform-tools بالحاسبة اكتب: <b class="num" dir="ltr">adb tcpip 5555</b>', 'افصل الكيبل واضغط «اتصل» تحت. يبقى شغال لحد ما تطفي الموبايل.'])}
      <button class="btn pri full" id="sfOld">${ic('bolt')} اتصل</button>`);
    $('#sfOld').onclick = () => { closeSheet(); phoneConnect(SELF_HOST, 5555, 'هذا الموبايل'); };
  }
}
window.onSelfPaired = (ok, msg) => {
  if (!ok) { toast(msg || 'ما صار الربط'); return; }
  toast('تم الربط ✓ أتصل هسه…');
  selfConnect();
};
async function selfConnect() {
  busy('أتصل بهذا الموبايل…');
  let port = 0;
  for (let i = 0; i < 12 && !port; i++) { try { const s = await run('selfInfo', { __local: 1 }); port = +s.conn || 0; } catch (e) {} if (!port) await new Promise(r => setTimeout(r, 500)); }
  unbusy();
  if (!port) {
    sheet(`<h2>شنو المنفذ؟</h2><p class="sub">بصفحة «تصحيح الأخطاء اللاسلكي» مكتوب «عنوان IP والمنفذ»، مثل 192.168.1.5:<b>41235</b>. اكتب الرقم اللي بعد النقطتين.</p>
      <input id="sfPort" class="num" inputmode="numeric" placeholder="41235"><button class="btn pri full" id="sfPGo" style="margin-top:10px">اتصل</button>`);
    $('#sfPGo').onclick = () => { const p = +($('#sfPort').value || '').replace(/\D/g, ''); if (!p) return toast('اكتب المنفذ'); closeSheet(); phoneConnect(SELF_HOST, p, 'هذا الموبايل'); };
    return;
  }
  phoneConnect(SELF_HOST, port, 'هذا الموبايل');
}
/* «موبايل ثاني»: first the way to connect, cable (OTG) or wireless */
function otherFlow() {
  sheet(`<h2>موبايل ثاني</h2><p class="sub">شلون تريد تربطه؟</p>
    <div class="pick" id="poWay">
      <button class="pcard" data-w="otg"><div class="pc-ic">${ic('phone')}</div><b>كيبل OTG</b><small>أسرع طريقة، تشتغل ويا كل الإصدارات وبدون حاسبة</small><span class="tag">أي إصدار</span></button>
      <button class="pcard" data-w="wifi"><div class="pc-ic alt">${ic('wifi')}</div><b>لاسلكي</b><small>على نفس الواي فاي أو الهوتسبوت</small><span class="tag">أندرويد ١١ وفوق</span></button>
    </div>`);
  $('#poWay').onclick = e => { const b = e.target.closest('[data-w]'); if (!b) return; tap(); closeSheet(); if (b.dataset.w === 'otg') otgFlow(); else wifiPhoneFlow(); };
}
function otgFlow() {
  sheet(`<h2>ربط موبايل بكيبل OTG</h2>
    ${stepsHtml(['بالموبايل الثاني شغّل «خيارات المطوّر» (الإعدادات ← حول الهاتف ← اضغط «رقم الإصدار» ٧ مرات) وفعّل «تصحيح USB».',
      'اربط المحوّل (OTG) بهذا الموبايل، والكيبل بالموبايل الثاني. إذا الكيبل Type-C من الطرفين: بالموبايل الثاني افتح إشعار USB واختار «التحكم بالـ USB: الجهاز المتصل».',
      'اضغط «اتصل بالكيبل»، واسمح للتطبيق بالكيبل، وبالموبايل الثاني اختار «السماح دائماً» على رسالة تصحيح USB.'])}
    <button class="btn pri full" id="otgGo">${ic('bolt')} اتصل بالكيبل</button>`);
  $('#otgGo').onclick = () => { closeSheet(); usbConnect(otgConnected); };
}
async function otgConnected() {
  kvSet('devType_usb', 'phone');
  let ip = '';
  try { const r = await sh("ip -f inet addr show wlan0 2>/dev/null | grep -o 'inet [0-9.]*' | head -1"); ip = (String(r).match(/inet ([0-9.]+)/) || [])[1] || ''; } catch (e) {}
  const nm = INFO ? (INFO.brand + ' ' + INFO.model).trim() : 'الموبايل';
  toast('اتصلت بـ ' + nm + ' بالكيبل'); PH = null;
  phRefresh();
  /* old phones (Android 10 and below) can stay connected without the cable: switch its ADB to Wi-Fi, no computer needed */
  sheet(`<h2>اتصلت بالكيبل ✓</h2><p class="sub">تگدر تشتغل هسه وهو مربوط. وإذا تريد تشيل الكيبل وتكمل لاسلكي${ip ? ' (عنوانه ' + `<b class="num" dir="ltr">${esc(ip)}</b>` + ')' : ''}، اضغط تحت. يبقى لاسلكي لحد ما يطفي الموبايل.</p>
    ${ip ? `<button class="btn pri full" id="otgWifi">${ic('wifi')} خليه لاسلكي وشيل الكيبل</button><div style="height:8px"></div>` : '<p class="sub">حتى يصير لاسلكي لازم الموبايل الثاني يكون مربوط على واي فاي.</p>'}
    <button class="btn ghost full" id="otgStay">أبقى على الكيبل</button>`);
  $('#otgStay').onclick = closeSheet;
  const w = $('#otgWifi'); if (w) w.onclick = async () => {
    closeSheet(); busy('أحوّله للاسلكي…', 'بعد ثواني تگدر تشيل الكيبل');
    try { await run('usbTcpip', { port: 5555, __local: true }); } catch (e) {}
    CONN = { connected: false };
    await new Promise(r => setTimeout(r, 3500));
    unbusy();
    phoneConnect(ip, 5555, nm);
  };
}
function wifiPhoneFlow() {
  sheet(`<h2>موبايل ثاني (لاسلكي)</h2><p class="sub">اربط الموبايلين على نفس الواي فاي (أو هوتسبوت واحد منهم).</p>
    <div class="vs"><div><b>إذا أندرويد ١١ وفوق</b><small>بالموبايل الثاني: خيارات المطوّر ← تصحيح الأخطاء اللاسلكي ← «إقران جهاز برمز الإقران». يطلع بقائمة «أجهزتي» وحده، اختاره واكتب الرمز.</small></div>
    <div><b>إذا أندرويد ١٠ وأقل</b><small>اربطه بالحاسبة مرة وحدة واكتب <b class="num" dir="ltr">adb tcpip 5555</b>، وبعدين اكتب عنوانه هنا.</small></div></div>
    <label class="f">عنوان الموبايل (IP)</label><input id="poH" class="num" inputmode="decimal" placeholder="192.168.1.30">
    <label class="f">المنفذ</label><input id="poP" class="num" inputmode="numeric" placeholder="5555">
    <button class="btn pri full" id="poGo" style="margin-top:10px">اتصل</button>
    <button class="btn sec full" id="poPair" style="margin-top:8px">عندي رمز إقران (أندرويد ١١ وفوق)</button>`);
  $('#poGo').onclick = () => { const h = $('#poH').value.trim(); if (!h) return toast('اكتب العنوان'); closeSheet(); phoneConnect(h, +$('#poP').value || 5555); };
  $('#poPair').onclick = () => { const h = $('#poH').value.trim(); closeSheet(); kvSet('nextIsPhone', 1); pairSheet(h); };
}
async function phoneConnect(host, port, label) {
  busy('أتصل بالموبايل…', 'إذا طلعت رسالة «السماح بتصحيح الأخطاء» على الموبايل، اختار «السماح دائماً»');
  try {
    CONN = await run('connect', { host, port: +port });
    INFO = await run('info');
    const name = label || (INFO.brand + ' ' + INFO.model).trim();
    savePhone({ host, port: +port, name, model: INFO.model, brand: INFO.brand, android: INFO.android, sdk: INFO.sdk });
    kvSet('devType_' + host, 'phone');
    unbusy(); toast('اتصلت بـ ' + name); PH = null;
    phRefresh();
  } catch (e) { unbusy(); toast(errText(e)); }
}

/* ---------- dashboard ---------- */
async function phoneScan() {
  const out = await sh("df -k /data | tail -1; echo '|'; grep -E 'MemTotal|MemAvailable' /proc/meminfo; echo '|'; dumpsys battery | grep -E 'level|temperature|health|status|AC powered|USB powered'; echo '|';"
    + " pm list packages -3 | wc -l; echo '|'; pm list packages -d | wc -l; echo '|'; settings get global window_animation_scale; echo '|'; settings get global private_dns_mode; echo '|'; settings get global private_dns_specifier; echo '|';"
    + " getprop ro.product.manufacturer; echo '|'; getprop ro.product.model; echo '|'; getprop ro.build.version.release; echo '|'; getprop ro.build.version.sdk; echo '|'; pm list packages");
  const p = String(out).split('|').map(s => s.trim());
  const d = p[0].split(/\s+/), tot = +d[1] || 0, used = +d[2] || 0, av = +d[3] || 0;
  const mt = /MemTotal:\s+(\d+)/.exec(p[1]), ma = /MemAvailable:\s+(\d+)/.exec(p[1]);
  const g = (re, s) => { const m = re.exec(s); return m ? m[1] : ''; };
  const pk = new Set((p[12] || '').split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean));
  return {
    disk: { tot: tot / 1048576, used: used / 1048576, free: av / 1048576, pct: tot ? Math.round(used * 100 / tot) : 0 },
    ram: mt && ma ? { tot: +mt[1] / 1048576, free: +ma[1] / 1048576, pct: Math.round(100 - (+ma[1] * 100 / +mt[1])) } : null,
    bat: { lvl: +g(/level:\s*(\d+)/, p[2]) || 0, temp: (+g(/temperature:\s*(\d+)/, p[2]) || 0) / 10, health: +g(/health:\s*(\d+)/, p[2]) || 0, charging: /powered: true/.test(p[2]) },
    apps: +p[3] || 0, disabled: +p[4] || 0, anim: p[5] === 'null' ? '1' : p[5], dns: p[6], dnsHost: p[7],
    brand: p[8], model: p[9], rel: p[10], sdk: +p[11] || 0, pk
  };
}
function bloatFor(s) {
  const k = brandKey(s.brand), list = (PHONE_BLOAT[k] || []).concat(PHONE_BLOAT.common);
  return list.filter(x => s.pk.has(x[0]) && !PHONE_PROTECT.test(x[0]));
}
function healthScore(s) {
  let sc = 100;
  sc -= Math.max(0, s.disk.pct - 60) * 1.1;
  if (s.ram) sc -= Math.max(0, s.ram.pct - 65) * .8;
  sc -= Math.min(15, bloatFor(s).length * 1.2);
  if (s.bat.temp > 40) sc -= 8;
  return Math.max(5, Math.min(100, Math.round(sc)));
}
function ringSvg(v, c) { const C = 2 * Math.PI * 52; return `<svg viewBox="0 0 120 120"><defs><linearGradient id="hg" x1="0" x2="1"><stop offset="0" stop-color="var(--ac2)"/><stop offset="1" stop-color="${c || 'var(--ac)'}"/></linearGradient></defs><circle cx="60" cy="60" r="52" class="rb"/><circle cx="60" cy="60" r="52" class="rf" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - v / 100)).toFixed(1)}"/></svg>`; }
async function phoneDash(el, fresh) {
  el.dataset.ph = '1';
  if (!PH || fresh) {
    el.innerHTML = `<div class="skel"></div><div class="skel s2"></div><div class="skel s3"></div>`;
    try { PH = await phoneScan(); } catch (e) { el.innerHTML = `<div class="empty">${esc(errText(e))}<br><button class="btn sec" id="phRe" style="margin-top:12px">${ic('refresh')} حاول مرة ثانية</button></div>`; $('#phRe').onclick = () => phoneDash(el, true); return; }
  }
  const s = PH, score = healthScore(s), bl = bloatFor(s), self = CONN.host === SELF_HOST;
  const col = score >= 75 ? 'var(--ok)' : score >= 50 ? 'var(--warn)' : 'var(--bad)';
  const animTxt = { '1': 'عادي', '1.0': 'عادي', '0.5': 'سريع', '0': 'بدون حركة', '0.0': 'بدون حركة' }[s.anim] || s.anim;
  const dnsOn = s.dns === 'hostname' && /adguard|nextdns|controld/i.test(s.dnsHost || '');
  el.innerHTML = `
    <div class="phead">
      <div class="hring" style="--rc:${col}">${ringSvg(score, col)}<div><b class="num">${score}</b><small>صحة الموبايل</small></div></div>
      <div class="pinfo"><b>${esc(self ? 'هذا الموبايل' : (s.brand + ' ' + s.model))}</b><small>${esc(s.brand + ' ' + s.model)}</small>${andBadge(s.sdk, s.rel)}
        <button class="btn sm sec" id="phRefresh" style="margin-top:10px">${ic('refresh')} افحص مرة ثانية</button></div>
    </div>
    <div class="mstats">
      <div class="ms"><small>التخزين</small><b class="num">${nfP(s.disk.free)} GB</b><span>فاضي من ${nfP(s.disk.tot)}</span><div class="bar"><i style="width:${s.disk.pct}%;${s.disk.pct > 85 ? 'background:var(--bad)' : ''}"></i></div></div>
      <div class="ms"><small>الرام</small><b class="num">${s.ram ? s.ram.pct + '%' : '—'}</b><span>${s.ram ? 'مستعمل من ' + nfP(s.ram.tot) + ' GB' : ''}</span><div class="bar"><i style="width:${s.ram ? s.ram.pct : 0}%"></i></div></div>
      <div class="ms"><small>البطارية</small><b class="num">${s.bat.lvl}%</b><span>${nfP(s.bat.temp)}° ${s.bat.charging ? '· يشحن' : ''}</span><div class="bar"><i style="width:${s.bat.lvl}%;${s.bat.lvl < 20 ? 'background:var(--bad)' : 'background:var(--ok)'}"></i></div></div>
      <div class="ms"><small>التطبيقات</small><b class="num">${s.apps}</b><span>${s.disabled ? s.disabled + ' معطّل' : 'منصّبة منك'}</span></div>
    </div>
    <button class="btn pri full big" id="phAll">${ic('sparkle')} نظّف وسرّع بضغطة وحدة</button>
    <div class="acts">
      <button data-pa="clean"><i class="a1">${ic('broom')}</i><b>تنظيف سريع</b><small>الملفات المؤقتة والخلفية</small></button>
      <button data-pa="bloat"><i class="a2">${ic('box')}</i><b>التطبيقات الزايدة</b><small>${bl.length ? bl.length + ' تطبيق ممكن تشيله' : 'ماكو شي واضح'}</small></button>
      <button data-pa="apps"><i class="a3">${ic('apps')}</i><b>كل التطبيقات</b><small>حذف، تعطيل، إيقاف</small></button>
      <button data-pa="anim"><i class="a4">${ic('rocket')}</i><b>سرعة الحركة</b><small>هسه: ${esc(animTxt)}</small></button>
      <button data-pa="ads"><i class="a5">${ic('shield')}</i><b>حاجب الإعلانات</b><small>${dnsOn ? 'شغّال ✓' : 'متوقف'}</small></button>
      <button data-pa="bat"><i class="a6">${ic('battery')}</i><b>البطارية</b><small>صحة وحرارة وتوفير</small></button>
      <button data-pa="restore"><i class="a7">${ic('restore')}</i><b>استرجاع</b><small>رجّع اللي شلته</small></button>
      <button data-pa="off"><i class="a8">${ic('logout')}</i><b>فصل</b><small>${self ? 'افصل هذا الموبايل' : 'افصل الموبايل'}</small></button>
    </div>`;
  el.onclick = e => {
    if (e.target.closest('#phRefresh')) { tap(); phoneDash(el, true); return; }
    if (e.target.closest('#phAll')) { tap(); phoneAll(); return; }
    const a = e.target.closest('[data-pa]'); if (!a) return; tap();
    ({ clean: phoneClean, bloat: phoneBloat, apps: phoneApps, anim: phoneAnim, ads: phoneAds, bat: phoneBattery, restore: phoneRestore, off: phoneOff })[a.dataset.pa]();
  };
}
function resultSheet(title, rows, after) {
  sheet(`<div class="done-ic">${ic('check')}</div><h2 style="text-align:center">${esc(title)}</h2><div class="report2">${rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
    <button class="btn pri full" id="rsOk" style="margin-top:14px">تمام</button>`);
  $('#rsOk').onclick = () => { closeSheet(); after && after(); };
}
async function freeGb() { const o = await sh('df -k /data | tail -1'); return (+String(o).trim().split(/\s+/)[3] || 0) / 1048576; }
async function phoneClean(silent) {
  if (!silent) busy('أنظف الملفات المؤقتة…', 'ما ينحذف شي من صورك أو رسائلك');
  try {
    const before = await freeGb();
    window.onProg && onProg('أمسح ذاكرة التطبيقات المؤقتة…');
    await sh('pm trim-caches 999999M 2>/dev/null; for d in /sdcard/Android/data/*/cache; do rm -rf "$d"/* 2>/dev/null; done; rm -rf /sdcard/DCIM/.thumbnails/* /sdcard/.thumbnails/* 2>/dev/null; true');
    window.onProg && onProg('أوقف التطبيقات اللي تشتغل بالخلفية…');
    await sh('am kill-all 2>/dev/null; true');
    const after = await freeGb(), freed = Math.max(0, (after - before) * 1024);
    if (!silent) { unbusy(); PH = null; resultSheet('خلص التنظيف', [['انفضى', nfP(freed) + ' MB'], ['المساحة الفاضية هسه', nfP(after) + ' GB'], ['التطبيقات بالخلفية', 'توقفت']], () => phRefresh()); }
    return freed;
  } catch (e) { if (!silent) { unbusy(); toast(errText(e)); } return 0; }
}
async function phoneAll() {
  busy('أنظف وأسرّع الموبايل…');
  const freed = await phoneClean(true);
  try { onProg('أسرّع الحركة…'); await sh('settings put global window_animation_scale 0.5; settings put global transition_animation_scale 0.5; settings put global animator_duration_scale 0.5'); } catch (e) {}
  unbusy(); PH = null;
  const s = await phoneScan().catch(() => null); PH = s;
  const bl = s ? bloatFor(s).filter(x => x[2]) : [];
  resultSheet('الموبايل صار أخف', [['انفضى', nfP(freed) + ' MB'], ['الحركة', 'أسرع (٠٫٥)'], ['تطبيقات زايدة آمنة', bl.length ? bl.length + ' تگدر تشيلها' : 'ماكو']], () => { if (bl.length) phoneBloat(); else phRefresh(); });
}
function phoneBloat() {
  const s = PH; if (!s) return phRefresh();
  const list = bloatFor(s), sel = new Set(list.filter(x => x[2]).map(x => x[0]));
  if (!list.length) return toast('ما لگيت تطبيقات زايدة معروفة بهذا الموبايل');
  const draw = () => {
    page('التطبيقات الزايدة', `<div class="panel soft"><p class="sub" style="margin:0">هاي تطبيقات جاية ويّا ${esc(s.brand)} وتاكل رام وبطارية. الأخضر آمن تمامًا، والبرتقالي شيله إذا ما تستعمله. كلشي ينرجع من «استرجاع».</p></div>
      <div class="chips" style="margin-bottom:12px"><button class="chip" id="blSafe">اختار الآمن بس</button><button class="chip" id="blAll">اختار الكل</button><button class="chip" id="blNone">ولا شي</button></div>
      <div class="list">${list.map(x => `<div class="item tap" data-bl="${esc(x[0])}"><div class="check ${sel.has(x[0]) ? 'on' : ''}">${ic('check')}</div><div class="t"><b>${esc(x[1])}</b><small class="num" style="direction:ltr;text-align:right">${esc(x[0])}</small></div><span class="tag ${x[2] ? '' : 'warn'}">${x[2] ? 'آمن' : 'انتبه'}</span></div>`).join('')}</div>
      <label class="f">الطريقة</label>${chips([['تعطيل (الأضمن)', 'disable'], ['إزالة للمستخدم', 'remove']], kv('phMethod', 'disable'), 'blm')}
      <div style="height:12px"></div><button class="btn pri full" id="blGo">${ic('trash')} شيل ${sel.size} تطبيق</button>`, el => {
      el.onclick = async e => {
        const m = e.target.closest('[data-blm]'); if (m) { kvSet('phMethod', m.dataset.blm); const y = $('#pageBody').scrollTop; draw(); $('#pageBody').scrollTop = y; return; }
        const r = e.target.closest('[data-bl]');
        if (r) { tap(); const p = r.dataset.bl; sel.has(p) ? sel.delete(p) : sel.add(p); r.querySelector('.check').classList.toggle('on', sel.has(p)); $('#blGo').innerHTML = ic('trash') + ' شيل ' + sel.size + ' تطبيق'; return; }
        if (e.target.closest('#blSafe')) { sel.clear(); list.filter(x => x[2]).forEach(x => sel.add(x[0])); }
        else if (e.target.closest('#blAll')) { list.forEach(x => sel.add(x[0])); }
        else if (e.target.closest('#blNone')) { sel.clear(); }
        else if (e.target.closest('#blGo')) { if (!sel.size) return toast('اختار تطبيق'); return removeApps([...sel], kv('phMethod', 'disable'), () => { PH = null; show('home'); }); }
        else return;
        const y = $('#pageBody').scrollTop; draw(); $('#pageBody').scrollTop = y;
      };
    });
  };
  draw();
}
async function removeApps(pkgs, method, done) {
  pkgs = pkgs.filter(p => !PHONE_PROTECT.test(p));
  busy('أشيل التطبيقات…'); let ok = 0;
  const log = kv('phRemoved', []);
  for (let i = 0; i < pkgs.length; i++) {
    onProg((i + 1) + ' من ' + pkgs.length + ': ' + (PHONE_NAMES[pkgs[i]] || pkgs[i]));
    try {
      const r = await sh(method === 'remove' ? 'pm uninstall -k --user 0 ' + pkgs[i] : 'pm disable-user --user 0 ' + pkgs[i]);
      if (/Success|disabled/i.test(r)) { ok++; log.unshift({ p: pkgs[i], m: method, at: Date.now() }); }
    } catch (e) {}
  }
  kvSet('phRemoved', log.slice(0, 300));
  unbusy(); toast(ok ? 'انشال ' + ok + ' تطبيق ✓' : 'ما انشال شي');
  done && done();
}
async function phoneApps() {
  busy('أجيب التطبيقات…');
  let all = [], user = new Set(), dis = new Set();
  try {
    const o = await sh("pm list packages; echo '|'; pm list packages -3; echo '|'; pm list packages -d");
    const p = String(o).split('|'), parse = t => (t || '').split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean);
    all = parse(p[0]); user = new Set(parse(p[1])); dis = new Set(parse(p[2]));
  } catch (e) { unbusy(); return toast(errText(e)); }
  unbusy();
  let filt = 'user', q = '';
  const draw = () => {
    const l = all.filter(x => !PHONE_PROTECT.test(x)).filter(x => filt === 'user' ? user.has(x) : filt === 'sys' ? !user.has(x) : dis.has(x))
      .filter(x => !q || x.toLowerCase().includes(q) || (PHONE_NAMES[x] || '').includes(q)).sort();
    const body = `<input id="paQ" placeholder="دوّر على تطبيق…" value="${esc(q)}" style="margin-bottom:10px">
      ${chips([['منصّبة منك', 'user'], ['جاية ويّا الموبايل', 'sys'], ['معطّلة', 'dis']], filt, 'paf')}<div style="height:10px"></div>
      <div class="list">${l.slice(0, 250).map(x => `<div class="item"><div class="fileic">${ic(dis.has(x) ? 'power' : 'apps')}</div><div class="t"><b>${esc(PHONE_NAMES[x] || x.split('.').slice(-1)[0])}</b><small class="num" style="direction:ltr;text-align:right">${esc(x)}</small></div>
        ${dis.has(x) ? `<button class="chip" data-pe="${esc(x)}">شغّله</button>` : `<button class="chip" data-pst="${esc(x)}" aria-label="إيقاف">${ic('power')}</button><button class="chip" data-pdel="${esc(x)}" aria-label="حذف">${ic('trash')}</button>`}</div>`).join('') || '<div class="empty">ماكو تطبيقات</div>'}</div>`;
    if (cur === 'page' && $('#pageTitle').textContent === 'كل التطبيقات') { const y = $('#pageBody').scrollTop; $('#pageBody').innerHTML = body; $('#pageBody').scrollTop = y; bindQ(); }
    else page('كل التطبيقات', body, () => bindQ());
  };
  const bindQ = () => {
    const qi = $('#paQ'); qi.oninput = () => { q = qi.value.trim().toLowerCase(); clearTimeout(bindQ.t); bindQ.t = setTimeout(() => { draw(); const n = $('#paQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    $('#pageBody').onclick = async e => {
      const f = e.target.closest('[data-paf]'); if (f) { filt = f.dataset.paf; draw(); return; }
      const st = e.target.closest('[data-pst]'); if (st) { tap(); await sh('am force-stop ' + st.dataset.pst).catch(() => {}); toast('توقف'); return; }
      const en = e.target.closest('[data-pe]'); if (en) { tap(); await sh('pm enable ' + en.dataset.pe).catch(() => {}); dis.delete(en.dataset.pe); toast('اشتغل'); draw(); return; }
      const d = e.target.closest('[data-pdel]');
      if (d) {
        const p = d.dataset.pdel, u = user.has(p);
        sheet(`<h2>${esc(PHONE_NAMES[p] || p)}</h2><p class="sub num" style="direction:ltr;text-align:right">${esc(p)}</p>
          ${u ? `<button class="btn bad full" id="pdU">${ic('trash')} احذفه نهائياً</button>` : `<button class="btn bad full" id="pdR">${ic('trash')} شيله (ينرجع من استرجاع)</button>`}
          <div style="height:8px"></div><button class="btn sec full" id="pdD">${ic('power')} عطّله بس</button>`);
        const fin = () => { closeSheet(); dis.add(p); draw(); };
        const pu = $('#pdU'); if (pu) pu.onclick = async () => { closeSheet(); busy('أحذف…'); try { const r = await sh('pm uninstall ' + p); unbusy(); if (/Success/.test(r)) { all = all.filter(x => x !== p); user.delete(p); toast('انحذف'); draw(); } else toast(r.trim() || 'ما انحذف'); } catch (er) { unbusy(); toast(errText(er)); } };
        const pr = $('#pdR'); if (pr) pr.onclick = () => removeApps([p], 'remove', () => { all = all.filter(x => x !== p); closeSheet(); draw(); });
        $('#pdD').onclick = () => removeApps([p], 'disable', fin);
      }
    };
  };
  draw();
}
function phoneAnim() {
  const cur2 = PH ? PH.anim : '1';
  sheet(`<h2>سرعة الحركة</h2><p class="sub">تقليل حركات فتح وسكر التطبيقات يخلي الموبايل يحس أسرع كلش، خصوصاً الموبايلات القديمة.</p>
    <div class="list">${[['1', 'عادي', 'مثل ما جاي من الشركة'], ['0.5', 'سريع', 'أنصح بيه: نفس الشكل بنص الوقت'], ['0', 'بدون حركة', 'أسرع شي، بس الحركة تختفي']].map(([v, n, d]) => `<div class="item tap" data-an="${v}"><div class="t"><b>${n}</b><small>${d}</small></div>${String(+cur2) === String(+v) ? '<span class="tag">المختار</span>' : ''}</div>`).join('')}</div>`);
  $('#sheetBody').onclick = async e => {
    const r = e.target.closest('[data-an]'); if (!r) return; const v = r.dataset.an;
    try { await sh(`settings put global window_animation_scale ${v}; settings put global transition_animation_scale ${v}; settings put global animator_duration_scale ${v}`); if (PH) PH.anim = v; closeSheet(); toast('انطبق ✓'); phRefresh(); } catch (er) { toast(errText(er)); }
  };
}
function phoneAds() {
  const on = PH && PH.dns === 'hostname' && /adguard/i.test(PH.dnsHost || '');
  sheet(`<h2>حاجب الإعلانات</h2><p class="sub">يحجب أغلب الإعلانات والمتتبعات بكل التطبيقات والمتصفح عن طريق «DNS خاص» (AdGuard). ما يحتاج تطبيق ولا يبطّئ.</p>
    <div class="list">${toggleRowP('ad', 'حجب الإعلانات', on, on ? 'شغّال' : 'متوقف')}</div>
    <p class="sub">إذا موقع أو تطبيق ما اشتغل زين، طفّيه من هنا.</p>`);
  $('#sheetBody').onclick = async e => {
    if (!e.target.closest('[data-ad]')) return;
    try {
      await sh(on ? 'settings put global private_dns_mode opportunistic' : 'settings put global private_dns_specifier dns.adguard-dns.com; settings put global private_dns_mode hostname');
      if (PH) { PH.dns = on ? 'opportunistic' : 'hostname'; PH.dnsHost = on ? '' : 'dns.adguard-dns.com'; }
      closeSheet(); toast(on ? 'انطفى' : 'اشتغل حاجب الإعلانات ✓'); phRefresh();
    } catch (er) { toast(errText(er)); }
  };
}
function toggleRowP(attr, label, on, sub) { return `<div class="item tap" data-${attr}="1"><div class="t"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="toggle ${on ? 'on' : ''}"></div></div>`; }
async function phoneBattery() {
  busy('أقرا البطارية…');
  let o = '';
  try { o = await sh("dumpsys battery; echo '|'; settings get global low_power"); } catch (e) { unbusy(); return toast(errText(e)); }
  unbusy();
  const [b, lp] = String(o).split('|'), g = re => { const m = re.exec(b); return m ? m[1] : ''; };
  const H = { 2: 'ممتازة', 3: 'حارة كلش', 4: 'ضعيفة', 5: 'فولتية عالية', 7: 'باردة' }[+g(/health:\s*(\d+)/)] || 'ما معروفة';
  const temp = (+g(/temperature:\s*(\d+)/) || 0) / 10, low = String(lp).trim() === '1';
  sheet(`<h2>البطارية</h2><div class="report2"><div><span>الشحن</span><b>${g(/level:\s*(\d+)/)}%</b></div><div><span>الحرارة</span><b>${nfP(temp)}°${temp > 40 ? ' 🔥' : ''}</b></div><div><span>الحالة</span><b>${H}</b></div><div><span>الفولتية</span><b class="num">${nfP((+g(/voltage:\s*(\d+)/) || 0) / 1000)} V</b></div></div>
    <div class="list" style="margin-top:12px">${toggleRowP('lp', 'توفير الطاقة', low, 'يقلل الأداء والخلفية حتى تطول البطارية')}</div>
    <button class="btn sec full" id="btKill">${ic('power')} أوقف كل التطبيقات اللي بالخلفية</button>`);
  $('#sheetBody').onclick = async e => {
    if (e.target.closest('[data-lp]')) { await sh('settings put global low_power ' + (low ? 0 : 1)).catch(() => {}); closeSheet(); toast(low ? 'انطفى توفير الطاقة' : 'اشتغل توفير الطاقة'); return; }
    if (e.target.closest('#btKill')) { await sh('am kill-all').catch(() => {}); closeSheet(); toast('توقفت ✓'); }
  };
}
async function phoneRestore() {
  busy('أدوّر على اللي انشال…');
  let dis = [], gone = [];
  try {
    const o = await sh("pm list packages -d; echo '|'; pm list packages -u; echo '|'; pm list packages");
    const p = String(o).split('|'), parse = t => (t || '').split('\n').map(l => l.replace('package:', '').trim()).filter(Boolean);
    dis = parse(p[0]); const inst = new Set(parse(p[2])); gone = parse(p[1]).filter(x => !inst.has(x));
  } catch (e) { unbusy(); return toast(errText(e)); }
  unbusy();
  const rows = dis.map(p => [p, 'd']).concat(gone.map(p => [p, 'u']));
  page('استرجاع', `<p class="sub">التطبيقات المعطّلة والمشالة. اضغط «رجّعه» وينرجع مثل ما چان.</p>
    <div class="list">${rows.map(([p, t]) => `<div class="item"><div class="t"><b>${esc(PHONE_NAMES[p] || p.split('.').slice(-1)[0])}</b><small class="num" style="direction:ltr;text-align:right">${esc(p)} · ${t === 'd' ? 'معطّل' : 'مشال'}</small></div><button class="chip" data-rs="${esc(p)}" data-rt="${t}">رجّعه</button></div>`).join('') || '<div class="empty">ماكو شي مشال</div>'}</div>
    ${rows.length > 1 ? `<button class="btn sec full" id="rsAll">${ic('restore')} رجّع الكل</button>` : ''}`, el => {
    el.onclick = async e => {
      const r = e.target.closest('[data-rs]');
      const one = async (p, t) => sh(t === 'd' ? 'pm enable ' + p : 'cmd package install-existing ' + p).catch(() => '');
      if (r) { tap(); await one(r.dataset.rs, r.dataset.rt); r.closest('.item').remove(); toast('رجع ✓'); PH = null; return; }
      if (e.target.closest('#rsAll')) { busy('أرجّع…'); for (const [p, t] of rows) await one(p, t); unbusy(); toast('رجع كلشي ✓'); PH = null; show('home'); }
    };
  });
}
async function phoneOff() {
  const wasSelf = CONN.host === SELF_HOST;
  try { await run('disconnect'); } catch (e) {}
  CONN = { connected: false }; INFO = null; PH = null;
  if (wasSelf) run('selfStop', { __local: 1 }).catch(() => {});
  toast('انفصل'); phRefresh();
}

/* ---------- hook into the app ---------- */
const _connectTo3 = connectTo;
connectTo = async function (host, port, label) {
  const r = await _connectTo3(host, port, label);
  if (r && kv('nextIsPhone', 0)) { kvSet('nextIsPhone', 0); kvSet('devType_' + host, 'phone'); savePhone({ host, port: +port, name: label || (INFO && (INFO.brand + ' ' + INFO.model)) }); show('home'); }
  return r;
};
if (typeof DEV_TYPES !== 'undefined' && !DEV_TYPES.some(x => x[0] === 'phone')) DEV_TYPES.push(['phone', 'موبايل']);

/* «أجهزتي»: a connected phone shows its dashboard; otherwise the screens list plus the phones entry */
const _renderHomeP = renderHome;
renderHome = function () {
  const b = $('#homeBody');
  if (isPhoneConn()) {
    $('#addTv').innerHTML = ic('plus'); $('#addTv').onclick = () => addSheet();
    b.onclick = null;
    b.innerHTML = '<div id="savedBox"></div><div id="phHost"></div>';
    renderSavedBox();
    phoneDash($('#phHost'));
    return;
  }
  _renderHomeP();
  const fl = $('#foundList');
  if (fl && !$('#phEntry')) { fl.insertAdjacentHTML('afterend', '<div id="phEntry">' + phonesEntryHtml() + '</div>'); bindPhonesEntry(b); }
  if (!SELF) loadSelf().then(() => { const e = $('#phEntry'); if (e && cur === 'home' && !isPhoneConn()) { e.innerHTML = phonesEntryHtml(); } });
};
RENDER.home = renderHome;
