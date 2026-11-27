/* «تواصل» for the phone: contacts, chat, photos, files, voice notes, replies, pins, profile. The client is tw-core.js (shared with the TV launcher). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var A = window.Android || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ar = function (n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); };
  var COLORS = ['#D6B47A', '#6E9BFF', '#3CCFC4', '#E8A33D', '#B18CFF', '#FF8FA3', '#8FD694', '#F0DDB2'];
  var cur = '', view = '', rec = null, pendingShare = null, replyTo = null;

  /* ---- small helpers ---- */
  function toast(t) { var e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove('on'); }, 2200); }
  function show(v) { view = v; ['vWel', 'vHome', 'vChat'].forEach(function (x) { $(x).classList.toggle('on', x === v); }); }
  function colorOf(code) { var h = 0; for (var i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 997; return COLORS[h % COLORS.length]; }
  function initial(n) { return esc(String(n || '؟').replace(/\s/g, '').slice(0, 1)); }
  function hm(ts) { var d = new Date(ts); return ar(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); }
  function size(n) { return n > 1048576 ? ar((n / 1048576).toFixed(1)) + ' م.ب' : ar(Math.max(1, Math.round(n / 1024))) + ' ك.ب'; }
  function openSheet(html) { $('sheetIn').innerHTML = html; $('sheetIn').onclick = null; $('sheet').classList.add('on'); }
  function closeSheet() { $('sheet').classList.remove('on'); }
  var ERR = { bad_code: 'الرمز غير صحيح (١٠ حروف وأرقام)', self: 'هذا رمزك أنت', no_such_user: 'ما لقيت أحد بهذا الرمز', network: 'ما في إنترنت', timeout: 'انقطع الاتصال', too_big: 'الملف أكبر من ١٥ ميجا', slow_down: 'خفّف الإرسال شوي', unauthorized: 'الحساب غير معروف، سجّل من جديد', too_many_pins: 'ثبّتّ ٥ رسائل، أزل وحدة أول', bad_backup: 'النص غير صحيح', bad_avatar: 'الصورة كبيرة، جرّب غيرها' };
  function say(e) { toast(ERR[e && e.error] || 'صار خلل: ' + (e && e.error)); }
  function avatarHtml(code, name, kind) {
    var a = TW.avatar(code);
    return a ? '<img src="' + esc(a) + '" alt="">' : (kind === 'tv' ? '📺' : initial(name));
  }
  /* what the phone tells its Android side (quiet hours, muted people) */
  function pushPrefs() { try { A.twPrefs(JSON.stringify(TW.nativePrefs())); } catch (e) {} }

  /* ---- home ---- */
  function renderHome() {
    var S = TW.S; $('myCode').textContent = TW.fmtCode(S.code);
    var l = S.contacts.slice().sort(function (a, b) { var x = TW.lastOf(a.code), y = TW.lastOf(b.code); return (y ? Date.parse(y.ts) : 0) - (x ? Date.parse(x.ts) : 0) || b.added - a.added; });
    $('hSub').textContent = S.name ? 'أهلاً ' + S.name : 'المحادثات';
    $('list').innerHTML = l.length ? l.map(function (c, i) {
      var m = TW.lastOf(c.code), u = S.unread[c.code] || 0, prev = TW.isTyping(c.code) ? 'يكتب…' : !m ? (c.status || 'ابدأ المحادثة') : (m.me ? 'أنت: ' : '') + (m.kind === 'text' ? m.text : m.kind === 'image' ? '📷 صورة' : m.kind === 'audio' ? '🎤 رسالة صوتية' : '📎 ' + (m.name || 'ملف'));
      return '<div class="ct" data-c="' + c.code + '" style="animation-delay:' + Math.min(i, 8) * 40 + 'ms"><div class="av" style="background:' + (TW.avatar(c.code) ? 'var(--panel2)' : colorOf(c.code)) + '">' + avatarHtml(c.code, TW.contactName(c.code), c.kind) + '</div><div class="tx"><b>' + esc(TW.contactName(c.code)) + (c.muted ? ' 🔕' : '') + '</b><small>' + esc(prev) + '</small></div>' + (u ? '<span class="badge">' + ar(u) + '</span>' : '') + '</div>';
    }).join('') : '<div class="empty">ما عندك أحد بعد.<br>اضغط «إضافة شخص أو شاشة» واكتب رمزه، أو امسح QR.<br>وللشاشة: افتح «الرسائل» بالواجهة وشوف رمزها.</div>';
  }
  $('list').onclick = function (e) { var c = e.target.closest('[data-c]'); if (c) openChat(c.getAttribute('data-c')); };

  /* ---- chat ---- */
  function linkify(t) { return esc(t).replace(/(https?:\/\/[^\s<>"']+)/gi, function (u) { return '<a class="lk" data-url="' + u + '">' + u + '</a>'; }); }
  function ticks(m) { if (!m.me) return ''; if (m.st === 'sending') return ' ⏳'; if (m.st === 'failed') return ' <span class="bad" data-retry="' + esc(m.id) + '">✕ فشل — أعد الإرسال</span>'; var r = m.rs || 0; return ' <span class="tk' + (r === 2 ? ' rd' : '') + '">' + (r ? '✓✓' : '✓') + '</span>'; }
  function bubble(m, prevDay) {
    var d = new Date(m.ts).toDateString(), h = '';
    if (d !== prevDay.v) { prevDay.v = d; h += '<div class="day">' + (d === new Date().toDateString() ? 'اليوم' : ar(new Date(m.ts).getDate()) + '/' + ar(new Date(m.ts).getMonth() + 1)) + '</div>'; }
    var body = '';
    if (m.kind === 'text') body = linkify(m.text);
    else if (m.kind === 'image') body = m.url ? '<img data-img="' + esc(m.url) + '" src="' + esc(m.url) + '" alt="">' : '<div class="f"><i>📷</i><div><b>صورة</b></div></div>';
    else if (m.kind === 'audio') body = m.url ? '<audio controls preload="none" src="' + esc(m.url) + '"></audio>' : '<div class="f"><i>🎤</i><div><b>رسالة صوتية</b></div></div>';
    else body = '<div class="f" data-file="' + esc(m.url || '') + '" data-mime="' + esc(m.mime) + '"><i>📎</i><div><b>' + esc(m.name || 'ملف') + '</b><small>' + size(m.size) + (m.url ? ' · اضغط للفتح' : '') + '</small></div></div>';
    var rep = m.reply ? '<div class="rep"><b>' + esc(m.reply.n || '') + '</b>' + esc(m.reply.t || '') + '</div>' : '';
    return h + '<div class="m' + (m.me ? ' mine' : '') + '" data-mid="' + esc(m.id) + '">' + (m.pin ? '<div class="pn">📌 مثبّتة على الشاشة</div>' : '') + rep + body + '<div class="meta">' + hm(m.ts) + ticks(m) + ' · ' + esc(TW.leftLabel(m)) + '</div></div>';
  }
  function headerSub() {
    var c = TW.findContact(cur); if (!c) return TW.fmtCode(cur);
    if (TW.isTyping(cur)) return 'يكتب…';
    var s = TW.seenLabel(c) || c.status || '';
    return (c.kind === 'tv' ? 'شاشة · ' : '') + (s || TW.fmtCode(cur));
  }
  function renderHeader() {
    if (!cur) return;
    $('cName').firstChild.nodeValue = TW.contactName(cur) + (TW.findContact(cur) && TW.findContact(cur).muted ? ' 🔕' : '');
    $('cSub').textContent = headerSub();
    var c = TW.findContact(cur) || {}; $('cAv').innerHTML = avatarHtml(cur, TW.contactName(cur), c.kind); $('cAv').style.background = TW.avatar(cur) ? 'var(--panel2)' : colorOf(cur);
  }
  function renderChat(keep) {
    if (!cur) return;
    var box = $('msgs'), near = box.scrollHeight - box.scrollTop - box.clientHeight < 140, p = { v: '' };
    var l = TW.convo(cur);
    box.innerHTML = '<div class="note">الرسائل تنحذف تلقائياً حسب مدة المحادثة (' + esc(TW.ttlName(TW.ttlOf(cur))) + ' للي ترسله أنت). الأشخاص يبقون.</div>' + l.map(function (m) { return bubble(m, p); }).join('');
    renderHeader();
    if (!keep || near) box.scrollTop = box.scrollHeight;
  }
  function openChat(code) {
    cur = code; replyTo = null; showReply(); show('vChat'); TW.markRead(code); renderChat(); $('tx').value = ''; upd();
    TW.ensureUrls(code); TW.refreshProfiles();
    if (pendingShare) sendShared();
  }
  function upd() { var t = $('tx').value.trim().length > 0; $('bSend').style.display = t ? '' : 'none'; $('bMic').style.display = t ? 'none' : ''; $('tx').style.height = 'auto'; $('tx').style.height = Math.min(120, $('tx').scrollHeight) + 'px'; }
  $('tx').oninput = function () { upd(); if (cur && $('tx').value.trim()) TW.typingNow(cur); };
  $('bBack').onclick = function () { cur = ''; show('vHome'); renderHome(); };
  $('bSend').onclick = function () {
    var t = $('tx').value; if (!t.trim()) return; $('tx').value = ''; upd();
    var o = replyTo ? { reply: replyTo } : null; replyTo = null; showReply();
    TW.sendText(cur, t, function (e) { if (e) say(e); }, o);
  };
  function showReply() { var r = $('rBar'); if (!replyTo) { r.classList.remove('on'); return; } $('rbT').textContent = (replyTo.n ? replyTo.n + ': ' : '') + replyTo.t; r.classList.add('on'); }
  $('rbX').onclick = function () { replyTo = null; showReply(); };

  /* tap or hold a message: reply, copy, pin to the screen, open a link, delete */
  function msgSheet(id) {
    var f = TW.findMsg(id); if (!f) return; var m = f.m, c = TW.findContact(cur) || {}, url = m.kind === 'text' ? TW.firstUrl(m.text) : '', h = '<h3>الرسالة</h3>';
    h += '<div class="opt" data-a="reply"><i>↩</i><span>رد</span></div>';
    if (m.kind === 'text') h += '<div class="opt" data-a="copy"><i>📋</i><span>نسخ النص</span></div>';
    if (url) h += '<div class="opt" data-a="link"><i>🔗</i><span>فتح الرابط</span></div>';
    if (m.me && m.kind === 'text' && String(m.id).charAt(0) !== 'l') h += '<div class="opt" data-a="pin"><i>📌</i><span>' + (m.pin ? 'إلغاء التثبيت من الشاشة' : 'تثبيت على شاشة المستلم') + '</span></div>';
    h += '<div class="opt" data-a="del"><i>🗑</i><span>' + (m.me ? 'حذف عند الطرفين' : 'حذف عندي فقط') + '</span></div>';
    openSheet(h);
    $('sheetIn').onclick = function (e) {
      var o = e.target.closest('[data-a]'); if (!o) return; var a = o.getAttribute('data-a'); closeSheet();
      if (a === 'reply') { replyTo = { id: m.id, t: m.kind === 'text' ? m.text.slice(0, 100) : m.kind === 'image' ? '📷 صورة' : m.kind === 'audio' ? '🎤 رسالة صوتية' : '📎 ' + (m.name || 'ملف'), n: m.me ? 'أنت' : TW.contactName(cur) }; showReply(); $('tx').focus(); }
      else if (a === 'copy') { try { A.copy(m.text); } catch (x) {} toast('اننسخ النص'); }
      else if (a === 'link') { try { A.openUrl(url, 'text/html'); } catch (x) { window.open(url); } }
      else if (a === 'pin') TW.pin(m.id, !m.pin, function (e2) { if (e2) say(e2); else toast(m.pin ? 'انثبتت على الشاشة، تكدر تلغيها بأي وقت من هنا' : 'انلغى التثبيت'); });
      else if (a === 'del') { if (confirm(m.me ? 'تحذف الرسالة عندك وعند الطرف الثاني؟' : 'تحذفها عندك بس؟')) TW.del(m.id, function (e2) { if (e2) say(e2); }); }
    };
  }
  var pressT = 0, pressed = false;
  $('msgs').addEventListener('touchstart', function (e) { var m = e.target.closest('.m'); if (!m) return; pressed = false; clearTimeout(pressT); pressT = setTimeout(function () { pressed = true; msgSheet(m.getAttribute('data-mid')); }, 480); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { $('msgs').addEventListener(ev, function () { clearTimeout(pressT); }, { passive: true }); });
  $('msgs').oncontextmenu = function (e) { e.preventDefault(); };
  $('msgs').onclick = function (e) {
    if (pressed) { pressed = false; return; }
    var im = e.target.closest('[data-img]'); if (im) { $('vImg').src = im.getAttribute('data-img'); $('viewer').classList.add('on'); return; }
    var f = e.target.closest('[data-file]'); if (f && f.getAttribute('data-file')) { try { A.openUrl(f.getAttribute('data-file'), f.getAttribute('data-mime')); } catch (x) { window.open(f.getAttribute('data-file')); } return; }
    var lk = e.target.closest('[data-url]'); if (lk) { try { A.openUrl(lk.getAttribute('data-url'), 'text/html'); } catch (x) { window.open(lk.getAttribute('data-url')); } return; }
    var r = e.target.closest('[data-retry]'); if (r) { retry(r.getAttribute('data-retry')); return; }
    if (e.target.closest('audio')) return;
    var m = e.target.closest('.m'); if (m) msgSheet(m.getAttribute('data-mid'));
  };
  $('viewer').onclick = function () { $('viewer').classList.remove('on'); };
  function retry(id) { var l = TW.convo(cur), m = null; for (var i = 0; i < l.length; i++) if (l[i].id === id) m = l[i]; if (!m) return; if (m.kind === 'text') { l.splice(l.indexOf(m), 1); TW.sendText(cur, m.text, function (e) { if (e) say(e); }); } else toast('أعد اختيار الملف وأرسله'); }

  /* ---- sending media ---- */
  /* the picture is cut to 2048 px (JPEG 90 %) and the same file is shown here and sent: what you see is what they get */
  function shrink(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var max = 2048, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { URL.revokeObjectURL(url); cb(b || file); }, 'image/jpeg', 0.9);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(file); };
    img.src = url;
  }
  function opts() { var o = replyTo ? { reply: replyTo } : null; replyTo = null; showReply(); return o; }
  function sendBlob(to, blob, kind, name, mime, local) { TW.sendFile(to, blob, kind, name, mime, local, function (e) { if (e) say(e); }, opts()); }
  function sendPicked(to, f) {
    if (!f) return;
    if (/^image\//.test(f.type) && !/gif$/.test(f.type)) shrink(f, function (b) { sendBlob(to, b, 'image', (f.name || 'photo').replace(/\.\w+$/, '') + '.jpg', 'image/jpeg', URL.createObjectURL(b)); });
    else if (/^audio\//.test(f.type)) sendBlob(to, f, 'audio', f.name || 'audio', f.type, URL.createObjectURL(f));
    else sendBlob(to, f, /^image\//.test(f.type) ? 'image' : 'file', f.name || 'file', f.type || 'application/octet-stream', /^image\//.test(f.type) ? URL.createObjectURL(f) : '');
  }
  $('bAtt').onclick = function () {
    var c = TW.findContact(cur) || {};
    openSheet('<h3>إرسال</h3><div class="opt" data-a="img"><i>🖼</i><span>صورة من المعرض</span></div><div class="opt" data-a="any"><i>📎</i><span>ملف</span></div><div class="opt" data-a="url"><i>🔗</i><span>رابط ' + (c.kind === 'tv' ? '(يظهر بالشاشة وتفتحه بزر)' : '') + '</span></div>' + (c.kind === 'tv' ? '<div class="opt" data-a="snap"><i>📸</i><span>شنو تعرض الشاشة هسه؟ (لقطة)</span></div>' : ''));
    $('sheetIn').onclick = function (e) {
      var o = e.target.closest('[data-a]'); if (!o) return; var a = o.getAttribute('data-a');
      if (a === 'img') { closeSheet(); $('fImg').click(); } else if (a === 'any') { closeSheet(); $('fAny').click(); }
      else if (a === 'url') { openSheet('<h3>رابط</h3><input type="text" class="rt" id="uIn" placeholder="https://…" style="direction:ltr"><button class="btn pri" id="uGo">إرسال</button>'); $('uGo').onclick = function () { var u = $('uIn').value.trim(); if (!/^https?:\/\//i.test(u)) return toast('اكتب رابط يبدأ بـ https://'); closeSheet(); TW.sendText(cur, u, function (e2) { if (e2) say(e2); }); }; }
      else if (a === 'snap') { closeSheet(); TW.askSnap(cur, function (e2) { if (e2) say(e2); else toast('طلبت اللقطة، إذا الشاشة تسمح تجيك خلال ثواني'); }); }
    };
  };
  $('fImg').onchange = $('fAny').onchange = function () { var f = this.files && this.files[0]; this.value = ''; sendPicked(cur, f); };

  /* voice note: hold the mic and speak, let go to send (slide up to cancel). A short tap keeps recording until the next tap. */
  var rtimer = 0, rstart = 0, chunks = [], stream = null, holding = false, startY = 0, cancelled = false, starting = false;
  function recStop(send) {
    if (!rec) return;
    var r = rec; rec = null; holding = false; clearInterval(rtimer); $('comp').classList.remove('rec'); $('bMic').classList.remove('rec'); $('bMic').textContent = '🎤';
    r.onstop = function () {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      if (!send || !chunks.length) return;
      var mime = r.mimeType || 'audio/webm', b = new Blob(chunks, { type: mime }), ext = /mp4|aac/.test(mime) ? 'm4a' : 'webm';
      sendBlob(cur, b, 'audio', 'voice-' + Date.now() + '.' + ext, mime.split(';')[0], URL.createObjectURL(b));
    };
    try { r.stop(); } catch (e) {}
  }
  function recBegin() {
    if (rec || starting) return;
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('التسجيل ما يشتغل بهذا الجهاز');
    starting = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      starting = false; stream = s; chunks = [];
      if (!holding && cancelled) { s.getTracks().forEach(function (t) { t.stop(); }); stream = null; return; }
      var types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'], t = '';
      for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported(types[i])) { t = types[i]; break; }
      rec = t ? new MediaRecorder(s, { mimeType: t }) : new MediaRecorder(s);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start(); rstart = Date.now(); $('comp').classList.add('rec'); $('bMic').classList.add('rec'); $('bMic').textContent = holding ? '🎤' : '➤';
      rtimer = setInterval(function () { var s2 = Math.floor((Date.now() - rstart) / 1000); $('recT').textContent = ar(Math.floor(s2 / 60) + ':' + ('0' + (s2 % 60)).slice(-2)); if (s2 >= 180) recStop(true); }, 250);
      if (!holding) endHold(true);   /* the finger already left: a tap, so it keeps recording */
    }, function () { starting = false; toast('اسمح للتطبيق باستعمال المايك'); });
  }
  var downAt = 0;
  function endHold(fromStart) {
    if (!rec) return;
    var held = Date.now() - downAt;
    if (fromStart || held < 450) { holding = false; $('bMic').textContent = '➤'; return; }   /* tap: toggle mode */
    holding = false; if (cancelled) { recStop(false); toast('انلغى التسجيل'); } else recStop(true);
  }
  $('bMic').addEventListener('touchstart', function (e) { e.preventDefault(); if (rec) { recStop(true); return; } holding = true; cancelled = false; downAt = Date.now(); startY = e.touches[0].clientY; recBegin(); }, { passive: false });
  $('bMic').addEventListener('touchmove', function (e) { if (!holding) return; cancelled = startY - e.touches[0].clientY > 70; $('recH').textContent = cancelled ? 'اترك للإلغاء' : 'اترك للإرسال · اسحب للأعلى للإلغاء'; }, { passive: true });
  $('bMic').addEventListener('touchend', function (e) { e.preventDefault(); if (!holding) return; if (!rec) { holding = false; return; } endHold(false); }, { passive: false });
  $('bMic').addEventListener('touchcancel', function () { if (holding && rec) { holding = false; recStop(false); } });
  $('bMic').onclick = function (e) { if ('ontouchstart' in window) return; if (rec) recStop(true); else { holding = false; cancelled = false; recBegin(); } };   /* a mouse (tests, tablets with a pen) */
  $('comp').querySelector('.recbar').onclick = function () { recStop(false); toast('انلغى التسجيل'); };

  /* ---- add a person or a screen ---- */
  function scan() { try { A.scanQr(); } catch (e) { toast('المسح يحتاج خدمات جوجل بالموبايل. اكتب الرمز يدوياً'); } }
  window.__twQr = function (text, err) {
    if (err) { if (err !== 'cancel') toast('ما قدرت أقرأ الـQR'); return; }
    var q = TW.parseQr(text); if (!q) return toast('هذا مو QR تواصل');
    if (q.type === 'add') { TW.addContact(q.code, function (e, c) { if (e) return say(e); closeSheet(); toast('انضاف: ' + TW.contactName(c.code)); openChat(c.code); }); return; }
    askRestore('TW1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ c: q.code, t: q.token, n: q.name, k: 'phone', p: [] })))));
  };
  function addSheet() {
    openSheet('<h3>إضافة شخص أو شاشة</h3><p style="color:var(--mute);margin:0 4px 10px">اكتب رمزه (١٠ حروف وأرقام) أو امسح QR الخاص به. الشاشة تعرض رمزها بقسم «الرسائل».</p><input type="text" id="aCode" placeholder="XXXXX-XXXXX" maxlength="12" autocomplete="off" autocapitalize="characters"><button class="btn" id="aScan">📷 مسح QR</button><button class="btn" id="aPaste">لصق من الحافظة</button><button class="btn pri" id="aGo">إضافة</button>');
    $('aScan').onclick = scan;
    $('aPaste').onclick = function () { var t = ''; try { t = A.paste(); } catch (e) {} if (t) $('aCode').value = TW.fmtCode(TW.cleanCode(t).slice(0, 10)); else toast('الحافظة فاضية'); };
    $('aGo').onclick = function () {
      var b = $('aGo'); b.disabled = true; b.textContent = 'جاري البحث…';
      TW.addContact($('aCode').value, function (e, c) { b.disabled = false; b.textContent = 'إضافة'; if (e) return say(e); closeSheet(); toast('انضاف: ' + (c.name || TW.fmtCode(c.code))); openChat(c.code); TW.refreshProfiles(null, true); });
    };
  }
  $('bAdd').onclick = addSheet;
  $('bQr').onclick = function () {
    openSheet('<h3>QR الخاص بي</h3><div class="qr">' + TW.qrSvg(TW.qrAdd(), 240) + '</div><p class="hint" style="text-align:center">خلّي الشخص يمسحه من «إضافة شخص» وينضاف عندك بثانية.<br>' + TW.fmtCode(TW.S.code) + '</p>');
  };

  /* ---- menus ---- */
  $('bCm').onclick = function () {
    var c = TW.findContact(cur) || {};
    openSheet('<h3>' + esc(TW.contactName(cur)) + '</h3><div class="opt" data-a="ren"><i>✎</i><span>تغيير الاسم عندي</span></div><div class="opt" data-a="ttl"><i>⏳</i><span>مدة حذف رسائلي: <b>' + esc(TW.ttlName(TW.ttlOf(cur))) + '</b></span></div><div class="opt" data-a="mute"><i>🔕</i><span>كتم هذي المحادثة</span><div class="tg' + (c.muted ? ' on' : '') + '"></div></div><div class="opt" data-a="del"><i>🗑</i><span>حذف الشخص والمحادثة</span></div>');
    $('sheetIn').onclick = function (e) {
      var o = e.target.closest('[data-a]'); if (!o) return; var a = o.getAttribute('data-a');
      if (a === 'ren') { openSheet('<h3>الاسم</h3><input type="text" class="rt" id="rName" maxlength="40" value="' + esc(TW.contactName(cur)) + '"><button class="btn pri" id="rGo">حفظ</button>'); $('rGo').onclick = function () { TW.setAlias(cur, $('rName').value); closeSheet(); renderChat(true); }; }
      else if (a === 'ttl') ttlSheet();
      else if (a === 'mute') { TW.setMute(cur, !c.muted); closeSheet(); toast(c.muted ? 'انكتمت المحادثة: بدون إشعارات' : 'رجعت الإشعارات'); renderHeader(); pushPrefs(); }
      else if (a === 'del') { closeSheet(); if (confirm('تحذف «' + TW.contactName(cur) + '» ومحادثته؟')) { TW.removeContact(cur); cur = ''; show('vHome'); renderHome(); pushPrefs(); } }
    };
  };
  function ttlSheet() {
    var t = TW.ttlOf(cur);
    openSheet('<h3>مدة حذف الرسائل</h3><p class="hint">تخص الرسائل اللي ترسلها أنت بهذي المحادثة. رسائل الطرف الثاني تتبع اختياره. الصور والملفات الطويلة تاخذ مساحة، فالمدة المفتوحة تناسب النص أكثر.</p>' + TW.TTLS.map(function (x) { return '<div class="opt" data-t="' + x[0] + '"><i>' + (x[0] === t ? '✓' : '⏳') + '</i><span>' + x[1] + '</span></div>'; }).join(''));
    $('sheetIn').onclick = function (e) { var o = e.target.closest('[data-t]'); if (!o) return; TW.setTtl(cur, +o.getAttribute('data-t')); closeSheet(); renderChat(true); toast('تمام: ' + TW.ttlName(TW.ttlOf(cur))); };
  }

  /* profile: photo, name, status line, and what others may see */
  function cropAvatar(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url); cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(''); };
    img.src = url;
  }
  function profileSheet() {
    var S = TW.S, p = S.prof, av = TW.myAvatar();
    openSheet('<h3>ملفي الشخصي</h3><div class="av lg" id="pAv" style="background:' + (av ? 'var(--panel2)' : colorOf(S.code)) + '">' + (av ? '<img src="' + esc(av) + '" alt="">' : initial(S.name)) + '</div>' +
      '<div class="rowt"><button class="btn" id="pPick">تغيير الصورة</button><button class="btn" id="pDrop">حذف الصورة</button></div>' +
      '<input type="text" class="rt" id="pName" maxlength="40" placeholder="اسمك" value="' + esc(S.name) + '"><input type="text" class="rt" id="pStat" maxlength="80" placeholder="حالتك (مثلاً: بالدوام)" value="' + esc(p.status) + '">' +
      '<div class="opt" id="pLs"><i>👁</i><span>إظهار «آخر ظهور» لغيري</span><div class="tg' + (p.ls_on ? ' on' : '') + '"></div></div>' +
      '<div class="opt" id="pRr"><i>✓✓</i><span>إخبار الآخرين إني قريت رسائلهم</span><div class="tg' + (p.rr_on ? ' on' : '') + '"></div></div>' +
      '<div class="opt" id="pTy"><i>✎</i><span>إظهار «يكتب…» لمن أكتب له</span><div class="tg' + (p.ty_on ? ' on' : '') + '"></div></div>' +
      '<button class="btn pri" id="pGo">حفظ</button>');
    var avNew; /* undefined = unchanged */
    $('pPick').onclick = function () { $('fAv').click(); };
    $('fAv').onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (!f) return; cropAvatar(f, function (d) { if (!d) return toast('تعذّر قراءة الصورة'); avNew = d; $('pAv').innerHTML = '<img src="' + d + '" alt="">'; $('pAv').style.background = 'var(--panel2)'; }); };
    $('pDrop').onclick = function () { avNew = ''; $('pAv').innerHTML = initial($('pName').value); $('pAv').style.background = colorOf(S.code); };
    ['pLs', 'pRr', 'pTy'].forEach(function (id) { $(id).onclick = function () { $(id).querySelector('.tg').classList.toggle('on'); }; });
    $('pGo').onclick = function () {
      var f = { name: $('pName').value.trim() || S.name, status: $('pStat').value.trim(), ls_on: $('pLs').querySelector('.tg').classList.contains('on'), rr_on: $('pRr').querySelector('.tg').classList.contains('on'), ty_on: $('pTy').querySelector('.tg').classList.contains('on') };
      if (avNew !== undefined) f.avatar = avNew;
      var b = $('pGo'); b.disabled = true; b.textContent = 'جاري الحفظ…';
      TW.setProfile(f, function (e) { b.disabled = false; b.textContent = 'حفظ'; if (e) return say(e); closeSheet(); renderHome(); toast('انحفظ ملفك'); });
    };
  }

  /* quiet hours: no sound, no banner, no jump to the chat (messages still arrive) */
  function quietSheet() {
    var on = TW.pref('quietOn', false), f = TW.pref('quietFrom', '23:00'), t = TW.pref('quietTo', '07:00');
    openSheet('<h3>ساعات الهدوء</h3><p class="hint">بهالأوقات توصلك الرسائل بدون صوت ولا إشعار.</p><div class="opt" id="qOn"><i>🌙</i><span>تفعيل ساعات الهدوء</span><div class="tg' + (on ? ' on' : '') + '"></div></div><div class="rowt"><span>من</span><input type="time" id="qF" value="' + f + '"><span>إلى</span><input type="time" id="qT" value="' + t + '"></div><button class="btn pri" id="qGo">حفظ</button>');
    $('qOn').onclick = function () { $('qOn').querySelector('.tg').classList.toggle('on'); };
    $('qGo').onclick = function () { TW.setPref('quietOn', $('qOn').querySelector('.tg').classList.contains('on')); TW.setPref('quietFrom', $('qF').value || '23:00'); TW.setPref('quietTo', $('qT').value || '07:00'); pushPrefs(); closeSheet(); toast('انحفظ'); };
  }

  /* backup of the account (the code and its key), and restoring it on another phone */
  function backupSheet() {
    openSheet('<h3>نسخة احتياطية للحساب</h3><p class="hint">تحفظ رمزك ومفتاحه وأشخاصك (مو الرسائل). إذا غيّرت الموبايل: افتح «تواصل» الجديد واختر «استعادة» وامسح هذا الـQR أو الصق النص.</p><div class="qr">' + TW.qrSvg(TW.qrBackup(), 240) + '</div><p class="hint" style="color:var(--bad)">لا تعطيه لأحد: اللي يملكه يكدر يدخل بحسابك.</p><button class="btn" id="bkCopy">نسخ النص الكامل (يشمل الأشخاص)</button><button class="btn" id="bkShare">مشاركة النص</button>');
    $('bkCopy').onclick = function () { try { A.copy(TW.exportBackup()); toast('اننسخ النص'); } catch (e) { toast('تعذّر النسخ'); } };
    $('bkShare').onclick = function () { try { A.share(TW.exportBackup()); } catch (e) {} };
  }
  function askRestore(text) {
    openSheet('<h3>استعادة حساب</h3><p class="hint">هذا يبدّل حساب هالموبايل بالحساب المحفوظ. إذا كان الموبايل القديم لسه يشتغل، يفضّل تحذف الحساب منه حتى ما يستلم نفس الرسائل.</p><button class="btn pri" id="rsGo">استعادة</button>');
    $('rsGo').onclick = function () { TW.importBackup(text, function (e) { if (e) return say(e); closeSheet(); TW.init('phone', TW.S.name, function (e2) { if (e2) return say(e2); ready(); toast('رجع حسابك'); TW.refreshProfiles(null, true); }); }); };
  }
  function restoreSheet() {
    openSheet('<h3>استعادة حساب</h3><p class="hint">امسح QR النسخة الاحتياطية، أو الصق النص اللي ينبدي بـ TW1.</p><button class="btn" id="rsScan">📷 مسح QR</button><textarea id="rsTx" placeholder="TW1.…"></textarea><button class="btn" id="rsPaste">لصق من الحافظة</button><button class="btn pri" id="rsOk">متابعة</button>');
    $('rsScan').onclick = scan;
    $('rsPaste').onclick = function () { var t = ''; try { t = A.paste(); } catch (e) {} if (t) $('rsTx').value = t; else toast('الحافظة فاضية'); };
    $('rsOk').onclick = function () { var t = $('rsTx').value.trim(); if (!t) return toast('الصق النص أول'); askRestore(t); };
  }
  $('wRestore').onclick = restoreSheet;

  $('bSet').onclick = function () {
    openSheet('<h3>الإعدادات</h3><div class="opt" data-a="prof"><i>👤</i><span>ملفي الشخصي: <b>' + esc(TW.S.name || '—') + '</b></span></div><div class="opt" data-a="th"><i>🎨</i><span>الهوية البصرية: <b>' + esc(Brand.current().name) + '</b></span></div><div class="opt" data-a="nt"><i>🔔</i><span>إشعارات الرسائل</span><div class="tg on" id="tgN"></div></div><div class="opt" data-a="qt"><i>🌙</i><span>ساعات الهدوء: <b>' + (TW.pref('quietOn', false) ? 'شغّالة' : 'مطفية') + '</b></span></div><div class="opt" data-a="bk"><i>💾</i><span>نسخة احتياطية للحساب</span></div><div class="opt" data-a="rs"><i>♻</i><span>استعادة حساب</span></div><div class="opt" data-a="lv"><i>⚠</i><span>حذف حسابي من السيرفر</span></div>');
    $('sheetIn').onclick = function (e) {
      var o = e.target.closest('[data-a]'); if (!o) return; var a = o.getAttribute('data-a');
      if (a === 'prof') profileSheet(); else if (a === 'th') { closeSheet(); Brand.picker(function () { }); }
      else if (a === 'nt') { var t = $('tgN'); t.classList.toggle('on'); try { A.notifOn(t.classList.contains('on')); } catch (x) {} }
      else if (a === 'qt') quietSheet(); else if (a === 'bk') backupSheet(); else if (a === 'rs') restoreSheet();
      else if (a === 'lv') { closeSheet(); if (confirm('يحذف حسابك ورمزك ومحادثاتك. تتأكد؟')) TW.leave(function () { location.reload(); }); }
    };
  };
  $('bCopy').onclick = function () { try { A.copy(TW.S.code); } catch (e) {} toast('اننسخ الرمز'); };
  $('bShare').onclick = function () { var t = 'رمزي بتطبيق «تواصل»: ' + TW.fmtCode(TW.S.code); try { A.share(t); } catch (e) {} };
  $('sheet').onclick = function (e) { if (e.target === $('sheet')) closeSheet(); };

  /* ---- shared from another app, notification taps ---- */
  function sendShared() {
    var p = pendingShare; pendingShare = null; if (!p || !cur) return;
    if (p.text) { $('tx').value = p.text; upd(); return; }
    var bin = atob(p.b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    sendPicked(cur, new File([u], p.name, { type: p.mime }));
  }
  function intent() {
    var o = '', s = '';
    try { o = A.takeOpen(); s = A.takeShare(); } catch (e) {}
    if (s) { try { pendingShare = JSON.parse(s); } catch (e) {} }
    if (pendingShare) {
      var l = TW.S.contacts;
      if (!l.length) { pendingShare = null; toast('أضف شخص أول، وبعدين شارك'); return; }
      openSheet('<h3>أرسل إلى</h3>' + l.map(function (c) { return '<div class="opt" data-to="' + c.code + '"><i>' + (c.kind === 'tv' ? '📺' : '👤') + '</i><span>' + esc(TW.contactName(c.code)) + '</span></div>'; }).join(''));
      $('sheetIn').onclick = function (e) { var t = e.target.closest('[data-to]'); if (t) { closeSheet(); $('sheetIn').onclick = null; openChat(t.getAttribute('data-to')); } };
    } else if (o && TW.findContact(o)) openChat(o);
  }
  window.__twIntent = intent;
  window.__twResume = function () { drain(); renderHome(); if (cur) { TW.ensureUrls(cur); renderChat(true); } TW.refreshProfiles(); };
  function drain() { try { var q = JSON.parse(A.takeInbox() || '[]'); if (q.length) TW.ingest(q); } catch (e) {} }
  window.onBack = function () {
    if ($('viewer').classList.contains('on')) { $('viewer').classList.remove('on'); return true; }
    if ($('sheet').classList.contains('on')) { closeSheet(); return true; }
    if (rec) { recStop(false); return true; }
    if (view === 'vChat') { $('bBack').onclick(); return true; }
    return false;
  };

  /* ---- start ---- */
  Brand.init('tawasul');
  TW.load();
  TW.on('change', function () { if (view === 'vHome') renderHome(); else if (view === 'vChat') { TW.markRead(cur); renderChat(true); } });
  TW.on('typing', function () { if (view === 'vChat') renderHeader(); else if (view === 'vHome') renderHome(); });
  TW.on('prefs', pushPrefs);
  TW.on('msg', function (from, m) { if (view === 'vChat' && cur === from) TW.markRead(from); else if (document.visibilityState === 'visible') toast('رسالة من ' + TW.contactName(from)); });
  function ready() {
    try { A.creds(TW.S.code, TW.S.token); } catch (e) {}
    pushPrefs(); drain(); show('vHome'); renderHome(); TW.start(); intent(); TW.refreshProfiles(null, true); TW.loadMyProfile();
    setInterval(function () { TW.purgeLocal(); if (view === 'vHome') renderHome(); }, 60000);
  }
  if (!TW.S.code) {
    show('vWel');
    $('wGo').onclick = function () {
      var n = $('wName').value.trim(); if (!n) return toast('اكتب اسمك');
      var b = $('wGo'); b.disabled = true; b.textContent = 'لحظة…';
      TW.init('phone', n, function (e) { b.disabled = false; b.textContent = 'ابدأ'; if (e) return say(e); ready(); });
    };
  } else TW.init('phone', TW.S.name, function () { ready(); });
})();
