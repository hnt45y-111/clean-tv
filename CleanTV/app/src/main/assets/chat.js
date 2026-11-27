/* «تواصل» on the screen: messages, photos, files and voice notes between the phone app and this screen, driven by the remote.
   The client is tw-core.js; Tawasul.java keeps the long poll running in the background and wakes this page. ES5 on purpose (old TV WebViews). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var A = window.Android || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ar = function (n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); };
  var st = { on: false, f: 'list', li: 0, mi: 0, bi: 0, cur: '', mode: '', rec: false, recT: 0, recTimer: 0, listen: false, oi: 0, status: '', playing: '', reply: null, menu: [], xi: 0, qi: 0, view: null };
  var audio = null, BAR = [['type', '✎ اكتب رسالة'], ['stt', '🎤 تكلّم وأنا أكتب'], ['rec', '⏺ رسالة صوتية'], ['file', '📎 ملف أو صورة'], ['quick', '💬 ردود جاهزة']];
  var QUICK = ['تمام', 'أجي بعد شوية', 'ما أكدر هسه', 'هلا والله', 'شكراً', 'وصلت', 'موافق', 'لا، مو الحين'];
  function toast(t) { if (window.toastMsg) window.toastMsg(t); }
  function ready() { return !!(window.TW && TW.S && TW.S.code); }

  /* ---- identity ---- */
  function boot(cb) {
    if (!window.TW) return cb && cb(new Error('no core'));
    if (!TW.S) TW.load();
    var name = (window.__getSettings && window.__getSettings().ownerName) || '';
    TW.init('tv', name ? 'شاشة ' + name : 'شاشة البيت', function (e) {
      if (!e && A.twCreds) { try { A.twCreds(TW.S.code, TW.S.token); } catch (x) {} }
      if (cb) cb(e);
    });
  }
  if (window.TW) {
    TW.load();
    if (TW.S.code) { try { A.twCreds && A.twCreds(TW.S.code, TW.S.token); } catch (e) {} }
    TW.on('change', function () { if (st.on) draw(); topRefresh(); pushPrefs(); });
    TW.on('typing', function () { if (st.on) draw(); });
    TW.on('pins', renderPins);
    TW.on('prefs', pushPrefs);
    TW.on('msg', function (from, m) {
      if (st.on && st.cur === from && st.f !== 'list') { TW.markRead(from); scrollEnd(); if (m.kind === 'audio' && autoOn()) setTimeout(function () { playAudio(m); }, 300); }
    });
  }
  function topRefresh() { if (window.__twTop) window.__twTop(); }
  function unread() { return ready() ? TW.unreadTotal() : 0; }
  function autoOn() { return ready() && TW.pref('autoPlay', false) && !TW.quietNow(); }
  /* what the Android side needs (quiet hours, muted people, contacts, screenshot permission) */
  var lastNp = '';
  function pushPrefs() { if (!ready()) return; var j = JSON.stringify(TW.nativePrefs()); if (j === lastNp) return; lastNp = j; try { A.twPrefs && A.twPrefs(j); } catch (e) {} }
  /* pinned notes from other people, shown on the home screen until their sender takes them down */
  function renderPins() {
    var el = $('twPins'); if (!el) return; var l = (window.TW && TW.S && TW.S.pins) || [];
    if (!l.length) { el.className = ''; el.innerHTML = ''; return; }
    el.className = 'on'; el.innerHTML = l.map(function (p) { return '<div class="tw-pin"><b>📌 ' + esc(p.fromName || TW.contactName(p.from)) + '</b><p>' + esc(p.text) + '</p></div>'; }).join('');
  }
  window.__twPins = renderPins;

  /* ---- data ---- */
  function contacts() {
    var l = TW.S.contacts.slice();
    l.sort(function (a, b) { var x = TW.lastOf(a.code), y = TW.lastOf(b.code); return (y ? Date.parse(y.ts) : 0) - (x ? Date.parse(x.ts) : 0) || b.added - a.added; });
    return l;
  }
  function rows() { var r = [{ k: 'add' }, { k: 'opt' }]; contacts().forEach(function (c) { r.push({ k: 'c', c: c }); }); return r; }
  function size(n) { return n > 1048576 ? ar((n / 1048576).toFixed(1)) + ' ميجا' : ar(Math.max(1, Math.round(n / 1024))) + ' كيلو'; }
  function hm(ts) { var d = new Date(ts); return ar(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); }
  function left(m) { return ar(TW.leftLabel(m)); }
  function prev(c) { if (TW.isTyping(c.code)) return 'يكتب…'; var m = TW.lastOf(c.code); if (!m) return c.status || 'ابدأ المحادثة'; return (m.me ? 'أنت: ' : '') + (m.kind === 'text' ? m.text : m.kind === 'image' ? '📷 صورة' : m.kind === 'audio' ? '🎤 رسالة صوتية' : '📎 ' + (m.name || 'ملف')); }
  function avHtml(c) { var a = TW.avatar(c.code); return a ? '<img src="' + esc(a) + '" alt="">' : (c.kind === 'tv' ? '📺' : esc(String(TW.contactName(c.code)).replace(/\s/g, '').slice(0, 1))); }
  function linkText(t) { return esc(t).replace(/(https?:\/\/[^\s<>"']+)/gi, '<u>$1</u>'); }
  function b64blob(b64, mime) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); }

  /* ---- drawing ---- */
  function bubble(m, i) {
    var body = '';
    if (m.kind === 'text') body = linkText(m.text);
    else if (m.kind === 'image') body = m.url ? '<img src="' + esc(m.url) + '" alt="">' : '<b>📷 صورة</b>';
    else if (m.kind === 'audio') body = '<b>' + (st.playing === m.id ? '⏸ إيقاف' : '▶ تشغيل الرسالة الصوتية') + '</b>';
    else body = '<b>📎 ' + esc(m.name || 'ملف') + '</b><small>' + size(m.size) + (m.url ? ' · OK للفتح' : '') + '</small>';
    var s2 = m.me ? (m.st === 'sending' ? ' ⏳' : m.st === 'failed' ? ' ✕ فشل' : ' <span class="tk' + (m.rs === 2 ? ' rd' : '') + '">' + (m.rs ? '✓✓' : '✓') + '</span>') : '';
    var rep = m.reply ? '<div class="ch-rep"><b>' + esc(m.reply.n || '') + '</b>' + esc(m.reply.t || '') + '</div>' : '';
    return '<div class="ch-m' + (m.me ? ' me' : '') + (st.f === 'convo' && i === st.mi ? ' ch-f' : '') + '" data-i="' + i + '">' + (m.pin ? '<small class="pn">📌 مثبّتة على الشاشة</small>' : '') + rep + body + '<small class="mt">' + hm(m.ts) + s2 + ' · ' + esc(left(m)) + '</small></div>';
  }
  function draw() {
    var m = $('chatModal'); if (!m || !st.on) return;
    if (!ready()) { $('chMain').innerHTML = '<div class="ch-empty">جاري تجهيز «تواصل»…</div>'; return; }
    var r = rows(), L = '';
    if (st.li >= r.length) st.li = r.length - 1;
    r.forEach(function (x, i) {
      var f = st.f === 'list' && i === st.li ? ' ch-f' : '', on = x.k === 'c' && x.c.code === st.cur ? ' on' : '';
      if (x.k === 'add') L += '<div class="ch-row add' + f + '">＋ إضافة شخص برمزه</div>';
      else if (x.k === 'opt') L += '<div class="ch-row add' + f + '">⚙ خيارات «تواصل»</div>';
      else { var u = TW.S.unread[x.c.code] || 0; L += '<div class="ch-row' + on + f + '"><i class="av">' + avHtml(x.c) + '</i><span class="tx"><b>' + esc(TW.contactName(x.c.code)) + (x.c.muted ? ' 🔕' : '') + '</b><small>' + esc(prev(x.c)) + '</small></span>' + (u ? '<em>' + ar(u) + '</em>' : '') + '</div>'; }
    });
    var C = '';
    if (st.f === 'qr') {
      C = '<div class="ch-qrp"><h3>QR لرمز شاشتك</h3><div class="ch-qr">' + TW.qrSvg(TW.qrAdd(), 420) + '</div><p>من تطبيق «تواصل» بالموبايل: إضافة شخص ← مسح QR</p><div class="code">' + TW.fmtCode(TW.S.code) + '</div></div>';
    } else if (st.f === 'opts') {
      var o = optList(), ow = Math.max(0, Math.min(st.oi - 3, o.length - 8));
      C = '<div class="ch-opts"><h3>خيارات «تواصل»</h3><div class="ch-ol">' + o.map(function (x, i) { return i >= ow && i < ow + 8 ? '<div class="ch-row add' + (i === st.oi ? ' ch-f' : '') + '">' + esc(x) + '</div>' : ''; }).join('') + '</div><small class="ch-note">' + ar(st.oi + 1) + ' / ' + ar(o.length) + '</small></div>';
    } else if (st.cur) {
      var l = TW.convo(st.cur);
      if (st.mi >= l.length) st.mi = Math.max(0, l.length - 1);
      var cc = TW.findContact(st.cur) || {}, sub = TW.isTyping(st.cur) ? 'يكتب…' : (TW.seenLabel(cc) || cc.status || '');
      C = '<div class="ch-head"><i class="av">' + avHtml(cc) + '</i><b>' + esc(TW.contactName(st.cur)) + (cc.muted ? ' 🔕' : '') + '</b><small>' + esc(sub ? ar(sub) + ' · ' : '') + TW.fmtCode(st.cur) + '</small></div><div id="chMsgs"><div class="ch-note">الرسائل تنحذف حسب مدة المحادثة (' + esc(TW.ttlName(TW.ttlOf(st.cur))) + ' للي ترسله أنت). الأشخاص يبقون.</div>' + (l.length ? l.map(bubble).join('') : '<div class="ch-empty">ماكو رسائل بعد.</div>') + '</div>' +
        (st.reply ? '<div class="ch-rbar">↩ رد على: ' + esc((st.reply.n ? st.reply.n + ': ' : '') + st.reply.t) + ' <small>(OK على «إلغاء الرد» بالأسفل)</small></div>' : '') +
        (st.f === 'msgmenu' ? '<div class="ch-menu">' + st.menu.map(function (x, i) { return '<div class="ch-b' + (i === st.xi ? ' ch-f' : '') + '">' + esc(x[1]) + '</div>'; }).join('') + '</div>' : '') +
        (st.f === 'quick' ? '<div class="ch-menu">' + QUICK.map(function (x, i) { return '<div class="ch-b' + (i === st.qi ? ' ch-f' : '') + '">' + esc(x) + '</div>'; }).join('') + '</div>' : '') +
        '<div id="chBar">' + BAR.map(function (b, i) { var t = b[1]; if (b[0] === 'rec' && st.rec) t = '⏹ إيقاف وإرسال · ' + ar(Math.floor(st.recT / 60) + ':' + ('0' + (st.recT % 60)).slice(-2)); if (b[0] === 'stt' && st.listen) t = '👂 جاري الاستماع…'; return '<div class="ch-b' + (st.f === 'bar' && i === st.bi ? ' ch-f' : '') + (b[0] === 'rec' && st.rec ? ' rec' : '') + '">' + t + '</div>'; }).join('') + (st.rec ? '<div class="ch-b' + (st.f === 'bar' && st.bi === BAR.length ? ' ch-f' : '') + '">✕ إلغاء</div>' : '') + (st.reply ? '<div class="ch-b' + (st.f === 'bar' && st.bi === BAR.length + (st.rec ? 1 : 0) ? ' ch-f' : '') + '">✕ إلغاء الرد</div>' : '') + '</div>';
    } else {
      C = '<div class="ch-welcome"><div class="code">' + TW.fmtCode(TW.S.code) + '</div><div class="ch-qr">' + TW.qrSvg(TW.qrAdd(), 300) + '</div><p>هذا رمز شاشتك. اكتبه بتطبيق «تواصل» بالموبايل (إضافة شخص)، أو امسح الـQR، حتى تبدأ المحادثة.</p><p>أو أضف شخص من هنا برمزه.</p></div>';
    }
    $('chMain').innerHTML = '<div class="ch-side"><div class="ch-me"><small>رمز شاشتك</small><b>' + TW.fmtCode(TW.S.code) + '</b></div>' + L + '</div><div class="ch-conv">' + C + (st.status ? '<div class="ch-status">' + esc(st.status) + '</div>' : '') + '</div>';
    focusScroll();
  }
  function scrollEnd() { var b = $('chMsgs'); if (b) b.scrollTop = b.scrollHeight; }
  function focusScroll() {
    var b = $('chMsgs'); if (!b) return;
    var f = b.querySelector('.ch-f');
    if (f) { var t = f.offsetTop, h = f.offsetHeight, H = b.clientHeight, o = b.scrollTop; if (t < o + 10) b.scrollTop = Math.max(0, t - 10); else if (t + h > o + H - 10) b.scrollTop = t + h - H + 10; }
    else b.scrollTop = b.scrollHeight;
  }
  function say(t, ms) { st.status = t; draw(); if (ms) setTimeout(function () { if (st.status === t) { st.status = ''; draw(); } }, ms); }

  /* ---- input (keyboard) ---- */
  var ERR = { bad_code: 'الرمز غير صحيح (١٠ حروف وأرقام)', self: 'هذا رمز شاشتك أنت', no_such_user: 'ما لقيت أحد بهذا الرمز', network: 'ما في إنترنت', timeout: 'انقطع الاتصال', too_big: 'الملف أكبر من ١٥ ميجا', slow_down: 'خفّف الإرسال شوي', unauthorized: 'الحساب غير معروف', too_many_pins: 'ثبّتّ ٥ رسائل، أزل وحدة أول', text_only: 'التثبيت للنص فقط', not_ready: 'انتظر لين تنرسل الرسالة' };
  function box() { return $('chIn'); }
  (function () { var b = $('chIn'); if (b) b.addEventListener('input', function () { if (st.mode === 'send' && st.cur && b.value) { try { TW.typingNow(st.cur); } catch (e) {} } }); })();
  function startInput(mode, ph, val) {
    var b = box(); st.mode = mode; b.placeholder = ph; b.value = val || ''; b.classList.add('on'); b.setAttribute('dir', mode === 'add' ? 'ltr' : 'rtl'); b.focus();
  }
  function endInput(commit) {
    var b = box(), v = b.value.replace(/^\s+|\s+$/g, ''), mode = st.mode;
    b.blur(); b.classList.remove('on'); st.mode = ''; b.value = '';
    if (!commit || !v) { draw(); return; }
    if (mode === 'send') { var ro = st.reply ? { reply: st.reply } : null; st.reply = null; TW.sendText(st.cur, v, function (e) { if (e) toast(ERR[e.error] || 'تعذّر الإرسال'); }, ro); }
    else if (mode === 'add') { say('جاري البحث…'); TW.addContact(v, function (e, c) { st.status = ''; if (e) { toast(ERR[e.error] || 'تعذّر'); return draw(); } toast('انضاف: ' + TW.contactName(c.code)); openChat(c.code); }); }
    else if (mode === 'name') { TW.rename(v); toast('انحفظ الاسم'); draw(); }
    else if (mode === 'status') { TW.setProfile({ status: v }); toast('انحفظت حالتك'); draw(); }
    draw();
  }

  /* ---- sending ---- */
  function sendBlob(blob, kind, name, mime) {
    var ro = st.reply ? { reply: st.reply } : null; st.reply = null;
    TW.sendFile(st.cur, blob, kind, name, mime, kind === 'image' || kind === 'audio' ? URL.createObjectURL(blob) : '', function (e) { if (e) toast(ERR[e.error] || 'تعذّر الإرسال'); }, ro);
  }
  window.__twPicked = function (name, mime, b64) {
    if (!b64) { if (name === '' && mime === '') toast('ما انختار شي، أو الملف أكبر من ١٢ ميجا'); return; }
    sendBlob(b64blob(b64, mime), /^image\//.test(mime) ? 'image' : /^audio\//.test(mime) ? 'audio' : 'file', name, mime);
  };
  window.__twMic = function (ok) { toast(ok ? 'تمام، اضغط مرة ثانية للتسجيل' : 'بدون إذن المايك ما أكدر أسجل'); };
  window.__twStt = function (text, err) {
    st.listen = false;
    if (err === 'ready') { st.listen = true; draw(); return; }
    if (err) { say(''); toast(err === 'none' ? 'شاشتك ما فيها خدمة تحويل الصوت لنص. اكتب بالكيبورد' : err === 'perm' ? 'اسمح بالمايك وجرّب' : 'ما سمعت شي، جرّب مرة ثانية'); draw(); return; }
    draw(); if (text) startInput('send', 'عدّل الكلام إذا تحتاج واضغط OK للإرسال', text); else toast('ما سمعت شي');
  };
  function recStart() {
    var ok = false; try { ok = A.twRecStart(); } catch (e) {}
    if (!ok) { toast('إذا طلب إذن المايك اسمح له ثم اضغط مرة ثانية'); return; }
    st.rec = true; st.recT = 0; clearInterval(st.recTimer);
    st.recTimer = setInterval(function () { st.recT++; if (st.recT >= 180) recStop(true); else draw(); }, 1000);
    draw();
  }
  function recStop(send) {
    clearInterval(st.recTimer); st.rec = false;
    var b64 = ''; try { b64 = send ? A.twRecStop() : (A.twRecCancel(), ''); } catch (e) {}
    st.bi = 1; draw();
    if (send && b64) sendBlob(b64blob(b64, 'audio/mp4'), 'audio', 'voice-' + Date.now() + '.m4a', 'audio/mp4'); else if (send) toast('ما انسجّل شي');
  }
  function playAudio(m) {
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
    if (st.playing === m.id) { st.playing = ''; draw(); return; }
    if (!m.url) return toast('الملف الصوتي مو متوفر');
    audio = new Audio(m.url); st.playing = m.id;
    audio.onended = audio.onerror = function () { st.playing = ''; draw(); };
    audio.play().catch(function () { st.playing = ''; draw(); toast('تعذّر التشغيل'); }); draw();
  }
  /* a photo on the whole screen; left/right to move between the photos of the conversation, OK for a slideshow */
  function viewDraw() {
    var v = st.view; if (!v) return;
    $('chView').innerHTML = '<img src="' + esc(v.list[v.i]) + '" alt=""><div class="ch-vf">' + ar(v.i + 1) + ' / ' + ar(v.list.length) + (v.list.length > 1 ? ' · ◀ ▶ للتنقل · OK ' + (v.timer ? 'لإيقاف العرض' : 'لعرض تلقائي') : '') + '</div>';
    $('chView').classList.add('on');
  }
  function viewOpen(m) {
    var l = TW.convo(st.cur), urls = [], at = 0;
    l.forEach(function (x) { if (x.kind === 'image' && x.url) { if (x === m) at = urls.length; urls.push(x.url); } });
    if (!urls.length) return;
    st.view = { list: urls, i: at, timer: 0 }; viewDraw();
  }
  function viewClose() { if (st.view && st.view.timer) clearInterval(st.view.timer); st.view = null; $('chView').classList.remove('on'); }
  function viewKey(k) {
    var v = st.view;
    if (k === 'back') { viewClose(); return; }
    if (k === 'ArrowLeft') v.i = (v.i + 1) % v.list.length; else if (k === 'ArrowRight') v.i = (v.i - 1 + v.list.length) % v.list.length;
    else if (k === 'ok') { if (v.timer) { clearInterval(v.timer); v.timer = 0; } else if (v.list.length > 1) v.timer = setInterval(function () { v.i = (v.i + 1) % v.list.length; viewDraw(); }, 5000); }
    viewDraw();
  }
  function msgMenu(m) {
    var url = m.kind === 'text' ? TW.firstUrl(m.text) : '', l = [['reply', '↩ رد']];
    if (m.kind === 'image' && m.url) l.push(['view', '🖼 عرض بملء الشاشة']);
    if (m.kind === 'audio') l.push(['play', st.playing === m.id ? '⏸ إيقاف' : '▶ تشغيل']);
    if (m.kind === 'file' && m.url) l.push(['open', '📂 فتح الملف']);
    if (url) l.push(['link', '🔗 فتح الرابط بالشاشة']);
    if (m.me && m.kind === 'text' && String(m.id).charAt(0) !== 'l') l.push(['pin', m.pin ? '📌 إلغاء التثبيت' : '📌 تثبيت على شاشة المستلم']);
    l.push(['del', m.me ? '🗑 حذف عند الطرفين' : '🗑 حذف عندي فقط']);
    st.menu = l; st.xi = 0; st.f = 'msgmenu'; st.target = m;
  }
  function menuDo(id) {
    var m = st.target; st.f = 'convo'; st.menu = [];
    if (!m) return;
    if (id === 'reply') { st.reply = { id: m.id, t: m.kind === 'text' ? m.text.slice(0, 100) : m.kind === 'image' ? '📷 صورة' : m.kind === 'audio' ? '🎤 رسالة صوتية' : '📎 ' + (m.name || 'ملف'), n: m.me ? 'أنت' : TW.contactName(st.cur) }; st.f = 'bar'; st.bi = 0; }
    else if (id === 'view') viewOpen(m);
    else if (id === 'play') playAudio(m);
    else if (id === 'open') { try { A.twOpenUrl(m.url, m.mime); } catch (e) { toast('يحتاج الشاشة نفسها'); } }
    else if (id === 'link') { try { A.twOpenLink(TW.firstUrl(m.text)); } catch (e) { toast('يحتاج الشاشة نفسها'); } }
    else if (id === 'pin') TW.pin(m.id, !m.pin, function (e) { if (e) toast(ERR[e.error] || 'تعذّر'); else toast(m.pin ? 'انثبتت على شاشة المستلم' : 'انلغى التثبيت'); });
    else if (id === 'del') TW.del(m.id, function (e) { if (e) toast(ERR[e.error] || 'تعذّر الحذف'); });
  }
  function actMsg(m) {
    if (m.st === 'failed' && m.kind === 'text') { var l = TW.convo(st.cur); l.splice(l.indexOf(m), 1); TW.sendText(st.cur, m.text, function () {}); return; }
    msgMenu(m);
  }

  /* the list in «خيارات تواصل» (the first five rows keep their old places) */
  function onOff(b) { return b ? 'شغّال' : 'متوقف'; }
  function optList() {
    var auto = false; try { auto = A.twAutoOn ? A.twAutoOn() : true; } catch (e) {}
    var alertsOk = true; try { alertsOk = A.twAlertsOk ? A.twAlertsOk() : true; } catch (e) {}
    var cc = st.cur ? TW.findContact(st.cur) : null;
    return ['فتح الرسائل مباشرة عند وصولها: ' + onOff(auto), 'اسم شاشتك عند الآخرين: ' + (TW.S.name || '—'), 'حذف الشخص المحدد ومحادثته', 'حذف حسابي من السيرفر (يحتاج OK مرتين)', 'السماح بظهور الرسائل فوق التطبيقات: ' + (alertsOk ? 'مسموح ✓' : 'غير مسموح — اضغط OK للسماح'),
      'تشغيل الرسائل الصوتية تلقائياً: ' + onOff(TW.pref('autoPlay', false)), 'ساعات الهدوء (بدون صوت ولا فتح تلقائي): ' + onOff(TW.pref('quietOn', false)), 'بداية ساعات الهدوء: ' + TW.pref('quietFrom', '23:00') + ' (OK يزيد ساعة)', 'نهاية ساعات الهدوء: ' + TW.pref('quietTo', '07:00') + ' (OK يزيد ساعة)',
      'كتم المحادثة المحددة: ' + (cc ? (cc.muted ? 'مكتومة' : 'غير مكتومة') : 'اختر شخص من القائمة أول'), 'مدة حذف رسائلي بالمحادثة المحددة: ' + (cc ? TW.ttlName(TW.ttlOf(st.cur)) : 'اختر شخص أول'),
      'السماح لأشخاصي بطلب لقطة لما تعرضه الشاشة: ' + (TW.pref('snapOn', false) ? 'مسموح' : 'ممنوع'), 'عرض QR لرمز شاشتك', 'حالتي (يشوفها الآخرون): ' + (TW.S.prof.status || '—')];
  }
  function bumpHour(k) { var p = String(TW.pref(k, k === 'quietFrom' ? '23:00' : '07:00')).split(':'); var h = ((+p[0] || 0) + 1) % 24; TW.setPref(k, ('0' + h).slice(-2) + ':' + (p[1] || '00')); }

  /* ---- open / close / keys ---- */
  function openChat(code) { st.cur = code; st.f = 'bar'; st.bi = 0; st.mi = 1e6; st.reply = null; TW.markRead(code); draw(); try { TW.ensureUrls(code); TW.refreshProfiles(); } catch (e) {} }
  function open(code) {
    st.on = true; st.f = 'list'; st.li = 0; st.cur = ''; st.status = ''; st.mode = '';
    $('chatModal').classList.add('on'); if (window.__setLayer) window.__setLayer('chat');
    draw();
    boot(function (e) {
      if (e) { toast('ما قدرت أتصل بـ«تواصل»: ' + (e.error || '')); }
      if (code && TW.findContact(code)) openChat(code); else draw();
      topRefresh();
    });
  }
  function close() {
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; st.playing = ''; }
    if (st.rec) recStop(false);
    st.on = false; $('chatModal').classList.remove('on'); if (window.__closeChat) window.__closeChat();
    topRefresh();
  }
  function key(k) {
    var b = box();
    if (b && document.activeElement === b) {
      if (k === 'back') { endInput(false); return; }
      if (k === 'ok' || k === 'ArrowDown' || k === 'Enter') { endInput(true); return; }
      return;
    }
    if (st.view) { viewKey(k); return; }
    if (st.rec && k === 'back') { recStop(false); return; }
    if (k === 'back') {
      if (st.f === 'qr') { st.f = 'opts'; draw(); return; }
      if (st.f === 'msgmenu') { st.f = 'convo'; st.menu = []; draw(); return; }
      if (st.f === 'quick') { st.f = 'bar'; draw(); return; }
      if (st.f === 'opts') { st.f = 'list'; draw(); return; }
      if (st.f === 'convo' || st.f === 'bar') { st.f = 'list'; draw(); return; }
      close(); return;
    }
    if (!ready()) return;
    if (st.f === 'list') {
      var r = rows();
      if (k === 'ArrowDown') st.li = Math.min(r.length - 1, st.li + 1); else if (k === 'ArrowUp') st.li = Math.max(0, st.li - 1);
      else if (k === 'ArrowLeft' && st.cur) { st.f = 'bar'; }
      else if (k === 'ok') {
        var x = r[st.li];
        if (x.k === 'add') { startInput('add', 'اكتب رمز الشخص أو الشاشة (١٠ حروف وأرقام)'); return; }
        if (x.k === 'opt') { st.f = 'opts'; st.oi = 0; }
        else if (x.k === 'c') { openChat(x.c.code); return; }
      }
      draw(); return;
    }
    if (st.f === 'qr') { return; }
    if (st.f === 'msgmenu') {
      if (k === 'ArrowDown') st.xi = Math.min(st.menu.length - 1, st.xi + 1); else if (k === 'ArrowUp') st.xi = Math.max(0, st.xi - 1);
      else if (k === 'ok') { menuDo(st.menu[st.xi][0]); draw(); return; }
      draw(); return;
    }
    if (st.f === 'quick') {
      if (k === 'ArrowDown') st.qi = Math.min(QUICK.length - 1, st.qi + 1); else if (k === 'ArrowUp') st.qi = Math.max(0, st.qi - 1);
      else if (k === 'ok') { var ro = st.reply ? { reply: st.reply } : null; st.reply = null; TW.sendText(st.cur, QUICK[st.qi], function (e) { if (e) toast(ERR[e.error] || 'تعذّر الإرسال'); }, ro); st.f = 'bar'; st.bi = 0; }
      draw(); return;
    }
    if (st.f === 'opts') {
      if (k === 'ArrowDown') st.oi = Math.min(optList().length - 1, st.oi + 1); else if (k === 'ArrowUp') st.oi = Math.max(0, st.oi - 1);
      else if (k === 'ArrowRight') { st.f = 'list'; }
      else if (k === 'ok') {
        if (st.oi === 0) { var a = true; try { a = A.twAutoOn(); A.twAuto(!a); } catch (e) {} }
        else if (st.oi === 1) { startInput('name', 'اسم شاشتك عند الآخرين', TW.S.name); return; }
        else if (st.oi === 2) { if (st.cur) { TW.removeContact(st.cur); st.cur = ''; st.f = 'list'; toast('انحذف'); } else toast('اختر شخص من القائمة أول'); }
        else if (st.oi === 4) { try { A.openOverlaySettings(); } catch (e) { toast('يحتاج الشاشة نفسها'); } }
        else if (st.oi === 5) TW.setPref('autoPlay', !TW.pref('autoPlay', false));
        else if (st.oi === 6) TW.setPref('quietOn', !TW.pref('quietOn', false));
        else if (st.oi === 7) bumpHour('quietFrom');
        else if (st.oi === 8) bumpHour('quietTo');
        else if (st.oi === 9) { if (st.cur) { var cm = TW.findContact(st.cur); TW.setMute(st.cur, !(cm && cm.muted)); } else toast('اختر شخص من القائمة أول'); }
        else if (st.oi === 10) { if (st.cur) { var ts = TW.TTLS.map(function (x) { return x[0]; }), ix = ts.indexOf(TW.ttlOf(st.cur)); TW.setTtl(st.cur, ts[(ix + 1) % ts.length]); } else toast('اختر شخص من القائمة أول'); }
        else if (st.oi === 11) TW.setPref('snapOn', !TW.pref('snapOn', false));
        else if (st.oi === 12) { st.f = 'qr'; }
        else if (st.oi === 13) { startInput('status', 'حالتك (مثلاً: بالدوام)', TW.S.prof.status); return; }
        else if (st.oi === 3) { if (st.sure) { TW.leave(function () { toast('انحذف حسابك'); st.cur = ''; st.f = 'list'; boot(function () { draw(); }); }); st.sure = false; } else { st.sure = true; toast('اضغط OK مرة ثانية للتأكيد'); setTimeout(function () { st.sure = false; }, 5000); } }
      }
      draw(); return;
    }
    var l = TW.convo(st.cur);
    if (st.f === 'convo') {
      if (k === 'ArrowUp') st.mi = Math.max(0, st.mi - 1);
      else if (k === 'ArrowDown') { if (st.mi >= l.length - 1) { st.f = 'bar'; } else st.mi++; }
      else if (k === 'ArrowRight') { st.f = 'list'; }
      else if (k === 'ok' && l[st.mi]) { actMsg(l[st.mi]); draw(); return; }
      draw(); return;
    }
    if (st.f === 'bar') {
      var extra = (st.rec ? 1 : 0) + (st.reply ? 1 : 0), n = BAR.length + extra;
      if (k === 'ArrowRight') st.bi = Math.max(0, st.bi - 1); else if (k === 'ArrowLeft') st.bi = Math.min(n - 1, st.bi + 1);
      else if (k === 'ArrowUp') { st.f = 'convo'; st.mi = l.length - 1; }
      else if (k === 'ok') {
        var id = st.bi >= BAR.length ? (st.rec && st.bi === BAR.length ? 'cancel' : 'noreply') : BAR[st.bi][0];
        if (id === 'type') { startInput('send', 'اكتب رسالتك واضغط OK للإرسال'); return; }
        if (id === 'stt') { if (st.listen) { try { A.twListenStop(); } catch (e) {} } else { st.listen = true; try { A.twListen(); } catch (e) { st.listen = false; toast('يحتاج الشاشة نفسها'); } } }
        else if (id === 'rec') { if (st.rec) recStop(true); else recStart(); return; }
        else if (id === 'cancel') { recStop(false); return; }
        else if (id === 'noreply') { st.reply = null; st.bi = 0; }
        else if (id === 'quick') { st.f = 'quick'; st.qi = 0; }
        else if (id === 'file') { try { A.twPick(); } catch (e) { toast('يحتاج الشاشة نفسها'); } }
      }
      draw(); return;
    }
  }

  /* messages that arrived while the page was asleep or showing something else */
  window.__twDrain = function () {
    if (!window.TW) return;
    if (!TW.S) TW.load();
    /* marks, pins, deleted ids, typing that the background service fetched */
    try { var sj = A.twTakeSync ? A.twTakeSync() : ''; if (sj) TW.applySync(JSON.parse(sj)); } catch (e) {}
    var q = []; try { q = JSON.parse(A.twTake ? A.twTake() : '[]') || []; } catch (e) {}
    renderPins();
    if (!q.length) { topRefresh(); return; }
    var got = TW.ingest(q);
    topRefresh();
    if (!got.length) return;
    var last = got[got.length - 1].from, auto = true; try { auto = A.twAutoOn ? A.twAutoOn() : true; } catch (e) {}
    var cm = TW.findContact(last), quiet = (cm && cm.muted) || TW.quietNow();
    if (st.on && !st.cur && st.f === 'list') openChat(last);
    else if (!st.on && auto && !quiet) open(last);
    else if (!st.on) toast('رسالة جديدة من ' + TW.contactName(last));
    else if (st.cur !== last) toast('رسالة جديدة من ' + TW.contactName(last));
    /* a voice note plays by itself if the owner asked for that (not in quiet hours) */
    if (autoOn() && !(cm && cm.muted)) setTimeout(function () {
      if (!st.on || st.cur !== last) return;
      for (var i = got.length - 1; i >= 0; i--) if (got[i].from === last && got[i].msg.kind === 'audio') { playAudio(got[i].msg); break; }
    }, 1200);
  };
  window.__twOpen = function (code) { open(code); };
  setInterval(function () { if (st.on && ready()) { TW.purgeLocal(); draw(); } }, 60000);
  renderPins(); pushPrefs();
  window.Chat = { open: open, key: key, unread: unread, close: close };
})();
