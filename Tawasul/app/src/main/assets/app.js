/* «تواصل» for the phone: contacts, chat, photos, files, voice notes. The client is tw-core.js (shared with the TV launcher). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var A = window.Android || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ar = function (n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); };
  var COLORS = ['#D6B47A', '#6E9BFF', '#3CCFC4', '#E8A33D', '#B18CFF', '#FF8FA3', '#8FD694', '#F0DDB2'];
  var cur = '', view = '', rec = null, pendingShare = null;

  /* ---- small helpers ---- */
  function toast(t) { var e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove('on'); }, 2200); }
  function show(v) { view = v; ['vWel', 'vHome', 'vChat'].forEach(function (x) { $(x).classList.toggle('on', x === v); }); }
  function colorOf(code) { var h = 0; for (var i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 997; return COLORS[h % COLORS.length]; }
  function initial(n) { return esc(String(n || '؟').replace(/\s/g, '').slice(0, 1)); }
  function hm(ts) { var d = new Date(ts); return ar(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); }
  function left(ts) { var h = Math.max(0, Math.ceil((TW.DAY - (Date.now() - Date.parse(ts))) / 3600000)); return 'تنحذف بعد ' + ar(h) + ' س'; }
  function size(n) { return n > 1048576 ? ar((n / 1048576).toFixed(1)) + ' م.ب' : ar(Math.max(1, Math.round(n / 1024))) + ' ك.ب'; }
  function openSheet(html) { $('sheetIn').innerHTML = html; $('sheet').classList.add('on'); }
  function closeSheet() { $('sheet').classList.remove('on'); }
  var ERR = { bad_code: 'الرمز غير صحيح (١٠ حروف وأرقام)', self: 'هذا رمزك أنت', no_such_user: 'ما لقيت أحد بهذا الرمز', network: 'ما في إنترنت', timeout: 'انقطع الاتصال', too_big: 'الملف أكبر من ١٥ ميجا', slow_down: 'خفّف الإرسال شوي', unauthorized: 'الحساب غير معروف، سجّل من جديد' };
  function say(e) { toast(ERR[e && e.error] || 'صار خلل: ' + (e && e.error)); }

  /* ---- home ---- */
  function renderHome() {
    var S = TW.S; $('myCode').textContent = TW.fmtCode(S.code);
    var l = S.contacts.slice().sort(function (a, b) { var x = TW.lastOf(a.code), y = TW.lastOf(b.code); return (y ? Date.parse(y.ts) : 0) - (x ? Date.parse(x.ts) : 0) || b.added - a.added; });
    $('hSub').textContent = S.name ? 'أهلاً ' + S.name : 'المحادثات';
    $('list').innerHTML = l.length ? l.map(function (c, i) {
      var m = TW.lastOf(c.code), u = S.unread[c.code] || 0, prev = !m ? 'ابدأ المحادثة' : (m.me ? 'أنت: ' : '') + (m.kind === 'text' ? m.text : m.kind === 'image' ? '📷 صورة' : m.kind === 'audio' ? '🎤 رسالة صوتية' : '📎 ' + (m.name || 'ملف'));
      return '<div class="ct" data-c="' + c.code + '" style="animation-delay:' + Math.min(i, 8) * 40 + 'ms"><div class="av" style="background:' + colorOf(c.code) + '">' + (c.kind === 'tv' ? '📺' : initial(TW.contactName(c.code))) + '</div><div class="tx"><b>' + esc(TW.contactName(c.code)) + '</b><small>' + esc(prev) + '</small></div>' + (u ? '<span class="badge">' + ar(u) + '</span>' : '') + '</div>';
    }).join('') : '<div class="empty">ما عندك أحد بعد.<br>اضغط «إضافة شخص أو شاشة» واكتب رمزه.<br>وللشاشة: افتح «الرسائل» بالواجهة وشوف رمزها.</div>';
  }
  $('list').onclick = function (e) { var c = e.target.closest('[data-c]'); if (c) openChat(c.getAttribute('data-c')); };

  /* ---- chat ---- */
  function bubble(m, prevDay) {
    var d = new Date(m.ts).toDateString(), h = '';
    if (d !== prevDay.v) { prevDay.v = d; h += '<div class="day">' + (d === new Date().toDateString() ? 'اليوم' : ar(new Date(m.ts).getDate()) + '/' + ar(new Date(m.ts).getMonth() + 1)) + '</div>'; }
    var body = '';
    if (m.kind === 'text') body = esc(m.text);
    else if (m.kind === 'image') body = m.url ? '<img data-img="' + esc(m.url) + '" src="' + esc(m.url) + '" alt="">' : '<div class="f"><i>📷</i><div><b>صورة</b></div></div>';
    else if (m.kind === 'audio') body = m.url ? '<audio controls preload="none" src="' + esc(m.url) + '"></audio>' : '<div class="f"><i>🎤</i><div><b>رسالة صوتية</b></div></div>';
    else body = '<div class="f" data-file="' + esc(m.url || '') + '" data-mime="' + esc(m.mime) + '"><i>📎</i><div><b>' + esc(m.name || 'ملف') + '</b><small>' + size(m.size) + (m.url ? ' · اضغط للفتح' : '') + '</small></div></div>';
    var st = m.me ? (m.st === 'sending' ? ' ⏳' : m.st === 'failed' ? ' <span class="bad" data-retry="' + esc(m.id) + '">✕ فشل — أعد الإرسال</span>' : ' ✓') : '';
    return h + '<div class="m' + (m.me ? ' mine' : '') + '">' + body + '<div class="meta">' + hm(m.ts) + st + ' · ' + left(m.ts) + '</div></div>';
  }
  function renderChat(keep) {
    if (!cur) return;
    var box = $('msgs'), near = box.scrollHeight - box.scrollTop - box.clientHeight < 140, p = { v: '' };
    var l = TW.convo(cur);
    box.innerHTML = '<div class="note">الرسائل تنحذف تلقائياً بعد ٢٤ ساعة. الأشخاص يبقون.</div>' + l.map(function (m) { return bubble(m, p); }).join('');
    $('cName').firstChild.nodeValue = TW.contactName(cur);
    var c = TW.findContact(cur); $('cSub').textContent = c && c.kind === 'tv' ? 'شاشة · ' + TW.fmtCode(cur) : TW.fmtCode(cur);
    if (!keep || near) box.scrollTop = box.scrollHeight;
  }
  function openChat(code) {
    cur = code; show('vChat'); TW.markRead(code); renderChat(); $('tx').value = ''; upd();
    if (pendingShare) sendShared();
  }
  function upd() { var t = $('tx').value.trim().length > 0; $('bSend').style.display = t ? '' : 'none'; $('bMic').style.display = t ? 'none' : ''; $('tx').style.height = 'auto'; $('tx').style.height = Math.min(120, $('tx').scrollHeight) + 'px'; }
  $('tx').oninput = upd;
  $('bBack').onclick = function () { cur = ''; show('vHome'); renderHome(); };
  $('bSend').onclick = function () { var t = $('tx').value; if (!t.trim()) return; $('tx').value = ''; upd(); TW.sendText(cur, t, function (e) { if (e) say(e); }); };
  $('msgs').onclick = function (e) {
    var im = e.target.closest('[data-img]'); if (im) { $('vImg').src = im.getAttribute('data-img'); $('viewer').classList.add('on'); return; }
    var f = e.target.closest('[data-file]'); if (f && f.getAttribute('data-file')) { try { A.openUrl(f.getAttribute('data-file'), f.getAttribute('data-mime')); } catch (x) { window.open(f.getAttribute('data-file')); } return; }
    var r = e.target.closest('[data-retry]'); if (r) retry(r.getAttribute('data-retry'));
  };
  $('viewer').onclick = function () { $('viewer').classList.remove('on'); };
  function retry(id) { var l = TW.convo(cur), m = null; for (var i = 0; i < l.length; i++) if (l[i].id === id) m = l[i]; if (!m) return; if (m.kind === 'text') { l.splice(l.indexOf(m), 1); TW.sendText(cur, m.text, function (e) { if (e) say(e); }); } else toast('أعد اختيار الملف وأرسله'); }

  /* ---- sending media ---- */
  function shrink(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var t = document.createElement('canvas'), tk = 160 / Math.max(w, h); t.width = Math.round(w * tk); t.height = Math.round(h * tk); t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
      c.toBlob(function (b) { URL.revokeObjectURL(url); cb(b || file, t.toDataURL('image/jpeg', 0.6)); }, 'image/jpeg', 0.85);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(file, ''); };
    img.src = url;
  }
  function sendBlob(to, blob, kind, name, mime, thumb) { TW.sendFile(to, blob, kind, name, mime, thumb, function (e) { if (e) say(e); }); }
  function sendPicked(to, f) {
    if (!f) return;
    if (/^image\//.test(f.type) && !/gif$/.test(f.type)) shrink(f, function (b, th) { sendBlob(to, b, 'image', (f.name || 'photo').replace(/\.\w+$/, '') + '.jpg', 'image/jpeg', th); });
    else if (/^audio\//.test(f.type)) sendBlob(to, f, 'audio', f.name || 'audio', f.type, URL.createObjectURL(f));
    else sendBlob(to, f, /^image\//.test(f.type) ? 'image' : 'file', f.name || 'file', f.type || 'application/octet-stream', /^image\//.test(f.type) ? URL.createObjectURL(f) : '');
  }
  $('bAtt').onclick = function () { openSheet('<h3>إرسال</h3><div class="opt" id="oImg"><i>🖼</i><span>صورة من المعرض</span></div><div class="opt" id="oAny"><i>📎</i><span>ملف</span></div>'); $('oImg').onclick = function () { closeSheet(); $('fImg').click(); }; $('oAny').onclick = function () { closeSheet(); $('fAny').click(); }; };
  $('fImg').onchange = $('fAny').onchange = function () { var f = this.files && this.files[0]; this.value = ''; sendPicked(cur, f); };

  /* voice note: tap the mic, speak, tap again to send (✕ in the bar cancels by tapping the bar) */
  var rtimer = 0, rstart = 0, chunks = [], stream = null;
  function recStop(send) {
    if (!rec) return;
    var r = rec; rec = null; clearInterval(rtimer); $('comp').classList.remove('rec'); $('bMic').classList.remove('rec'); $('bMic').textContent = '🎤';
    r.onstop = function () {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      if (!send || !chunks.length) return;
      var mime = r.mimeType || 'audio/webm', b = new Blob(chunks, { type: mime }), ext = /mp4|aac/.test(mime) ? 'm4a' : 'webm';
      sendBlob(cur, b, 'audio', 'voice-' + Date.now() + '.' + ext, mime.split(';')[0], URL.createObjectURL(b));
    };
    try { r.stop(); } catch (e) {}
  }
  $('bMic').onclick = function () {
    if (rec) return recStop(true);
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('التسجيل ما يشتغل بهذا الجهاز');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s; chunks = [];
      var types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'], t = '';
      for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported(types[i])) { t = types[i]; break; }
      rec = t ? new MediaRecorder(s, { mimeType: t }) : new MediaRecorder(s);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start(); rstart = Date.now(); $('comp').classList.add('rec'); $('bMic').classList.add('rec'); $('bMic').textContent = '➤';
      rtimer = setInterval(function () { var s2 = Math.floor((Date.now() - rstart) / 1000); $('recT').textContent = ar(Math.floor(s2 / 60) + ':' + ('0' + (s2 % 60)).slice(-2)); if (s2 >= 180) recStop(true); }, 250);
    }, function () { toast('اسمح للتطبيق باستعمال المايك'); });
  };
  $('comp').querySelector('.recbar').onclick = function () { recStop(false); toast('انلغى التسجيل'); };

  /* ---- add a person or a screen ---- */
  function addSheet() {
    openSheet('<h3>إضافة شخص أو شاشة</h3><p style="color:var(--mute);margin:0 4px 10px">اكتب رمزه (١٠ حروف وأرقام). الشاشة تعرض رمزها بقسم «الرسائل».</p><input type="text" id="aCode" placeholder="XXXXX-XXXXX" maxlength="12" autocomplete="off" autocapitalize="characters"><button class="btn" id="aPaste">لصق من الحافظة</button><button class="btn pri" id="aGo">إضافة</button>');
    $('aPaste').onclick = function () { var t = ''; try { t = A.paste(); } catch (e) {} if (t) $('aCode').value = TW.fmtCode(TW.cleanCode(t).slice(0, 10)); else toast('الحافظة فاضية'); };
    $('aGo').onclick = function () {
      var b = $('aGo'); b.disabled = true; b.textContent = 'جاري البحث…';
      TW.addContact($('aCode').value, function (e, c) { b.disabled = false; b.textContent = 'إضافة'; if (e) return say(e); closeSheet(); toast('انضاف: ' + (c.name || TW.fmtCode(c.code))); openChat(c.code); });
    };
  }
  $('bAdd').onclick = addSheet;

  /* ---- menus ---- */
  $('bCm').onclick = function () {
    openSheet('<h3>' + esc(TW.contactName(cur)) + '</h3><div class="opt" id="oRen"><i>✎</i><span>تغيير الاسم عندي</span></div><div class="opt" id="oDel"><i>🗑</i><span>حذف الشخص والمحادثة</span></div>');
    $('oRen').onclick = function () { openSheet('<h3>الاسم</h3><input type="text" class="rt" id="rName" maxlength="40" value="' + esc(TW.contactName(cur)) + '"><button class="btn pri" id="rGo">حفظ</button>'); $('rGo').onclick = function () { TW.setAlias(cur, $('rName').value); closeSheet(); renderChat(true); }; };
    $('oDel').onclick = function () { closeSheet(); if (confirm('تحذف «' + TW.contactName(cur) + '» ومحادثته؟')) { TW.removeContact(cur); cur = ''; show('vHome'); renderHome(); } };
  };
  $('bSet').onclick = function () {
    var dark = !document.body.classList.contains('light'), notif = true;
    openSheet('<h3>الإعدادات</h3><div class="opt" id="oName"><i>👤</i><span>اسمي: <b>' + esc(TW.S.name || '—') + '</b></span></div><div class="opt" id="oTh"><i>🌗</i><span>الوضع الفاتح</span><div class="tg' + (dark ? '' : ' on') + '"></div></div><div class="opt" id="oNt"><i>🔔</i><span>إشعارات الرسائل</span><div class="tg on" id="tgN"></div></div><div class="opt" id="oLv"><i>⚠</i><span>حذف حسابي من السيرفر</span></div>');
    $('oName').onclick = function () { openSheet('<h3>اسمك</h3><input type="text" class="rt" id="nName" maxlength="30" value="' + esc(TW.S.name) + '"><button class="btn pri" id="nGo">حفظ</button>'); $('nGo').onclick = function () { TW.rename($('nName').value); closeSheet(); renderHome(); }; };
    $('oTh').onclick = function () { document.body.classList.toggle('light'); try { localStorage.setItem('tw.light', document.body.classList.contains('light') ? '1' : '0'); } catch (e) {} $('oTh').querySelector('.tg').classList.toggle('on'); };
    $('oNt').onclick = function () { var t = $('tgN'); t.classList.toggle('on'); try { A.notifOn(t.classList.contains('on')); } catch (e) {} };
    $('oLv').onclick = function () { closeSheet(); if (confirm('يحذف حسابك ورمزك ومحادثاتك. تتأكد؟')) TW.leave(function () { location.reload(); }); };
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
  window.__twResume = function () { drain(); renderHome(); if (cur) renderChat(true); };
  function drain() { try { var q = JSON.parse(A.takeInbox() || '[]'); if (q.length) TW.ingest(q); } catch (e) {} }
  window.onBack = function () {
    if ($('viewer').classList.contains('on')) { $('viewer').classList.remove('on'); return true; }
    if ($('sheet').classList.contains('on')) { closeSheet(); return true; }
    if (rec) { recStop(false); return true; }
    if (view === 'vChat') { $('bBack').onclick(); return true; }
    return false;
  };

  /* ---- start ---- */
  try { if (localStorage.getItem('tw.light') === '1') document.body.classList.add('light'); } catch (e) {}
  TW.load();
  TW.on('change', function () { if (view === 'vHome') renderHome(); else if (view === 'vChat') { TW.markRead(cur); renderChat(true); } });
  TW.on('msg', function (from, m) { if (view === 'vChat' && cur === from) TW.markRead(from); else if (document.visibilityState === 'visible') toast('رسالة من ' + TW.contactName(from)); });
  function ready() {
    try { A.creds(TW.S.code, TW.S.token); } catch (e) {}
    drain(); show('vHome'); renderHome(); TW.start(); intent();
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
