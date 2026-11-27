/* «تواصل» on the screen: messages, photos, files and voice notes between the phone app and this screen, driven by the remote.
   The client is tw-core.js; Tawasul.java keeps the long poll running in the background and wakes this page. ES5 on purpose (old TV WebViews). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var A = window.Android || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ar = function (n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); };
  var st = { on: false, f: 'list', li: 0, mi: 0, bi: 0, cur: '', mode: '', rec: false, recT: 0, recTimer: 0, listen: false, oi: 0, status: '', playing: '' };
  var audio = null, BAR = [['type', '✎ اكتب رسالة'], ['stt', '🎤 تكلّم وأنا أكتب'], ['rec', '⏺ رسالة صوتية'], ['file', '📎 ملف أو صورة']];
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
    TW.on('change', function () { if (st.on) draw(); topRefresh(); });
    TW.on('msg', function (from, m) { if (st.on && st.cur === from && st.f !== 'list') { TW.markRead(from); scrollEnd(); } });
  }
  function topRefresh() { if (window.__twTop) window.__twTop(); }
  function unread() { return ready() ? TW.unreadTotal() : 0; }

  /* ---- data ---- */
  function contacts() {
    var l = TW.S.contacts.slice();
    l.sort(function (a, b) { var x = TW.lastOf(a.code), y = TW.lastOf(b.code); return (y ? Date.parse(y.ts) : 0) - (x ? Date.parse(x.ts) : 0) || b.added - a.added; });
    return l;
  }
  function rows() { var r = [{ k: 'add' }, { k: 'opt' }]; contacts().forEach(function (c) { r.push({ k: 'c', c: c }); }); return r; }
  function size(n) { return n > 1048576 ? ar((n / 1048576).toFixed(1)) + ' ميجا' : ar(Math.max(1, Math.round(n / 1024))) + ' كيلو'; }
  function hm(ts) { var d = new Date(ts); return ar(('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); }
  function left(ts) { return 'تنحذف بعد ' + ar(Math.max(0, Math.ceil((TW.DAY - (Date.now() - Date.parse(ts))) / 3600000))) + ' س'; }
  function prev(c) { var m = TW.lastOf(c.code); if (!m) return 'ابدأ المحادثة'; return (m.me ? 'أنت: ' : '') + (m.kind === 'text' ? m.text : m.kind === 'image' ? '📷 صورة' : m.kind === 'audio' ? '🎤 رسالة صوتية' : '📎 ' + (m.name || 'ملف')); }
  function b64blob(b64, mime) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); }

  /* ---- drawing ---- */
  function bubble(m, i) {
    var body = '';
    if (m.kind === 'text') body = esc(m.text);
    else if (m.kind === 'image') body = m.url ? '<img src="' + esc(m.url) + '" alt="">' : '<b>📷 صورة</b>';
    else if (m.kind === 'audio') body = '<b>' + (st.playing === m.id ? '⏸ إيقاف' : '▶ تشغيل الرسالة الصوتية') + '</b>';
    else body = '<b>📎 ' + esc(m.name || 'ملف') + '</b><small>' + size(m.size) + (m.url ? ' · OK للفتح' : '') + '</small>';
    var s = m.me ? (m.st === 'sending' ? ' ⏳' : m.st === 'failed' ? ' ✕ فشل' : ' ✓') : '';
    return '<div class="ch-m' + (m.me ? ' me' : '') + (st.f === 'convo' && i === st.mi ? ' ch-f' : '') + '" data-i="' + i + '">' + body + '<small class="mt">' + hm(m.ts) + s + ' · ' + left(m.ts) + '</small></div>';
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
      else { var u = TW.S.unread[x.c.code] || 0; L += '<div class="ch-row' + on + f + '"><i class="av">' + (x.c.kind === 'tv' ? '📺' : esc(String(TW.contactName(x.c.code)).replace(/\s/g, '').slice(0, 1))) + '</i><span class="tx"><b>' + esc(TW.contactName(x.c.code)) + '</b><small>' + esc(prev(x.c)) + '</small></span>' + (u ? '<em>' + ar(u) + '</em>' : '') + '</div>'; }
    });
    var C = '';
    if (st.f === 'opts') {
      var auto = false; try { auto = A.twAutoOn ? A.twAutoOn() : true; } catch (e) {}
      var o = [['فتح الرسائل مباشرة عند وصولها: ' + (auto ? 'شغّال' : 'متوقف')], ['اسم شاشتك عند الآخرين: ' + (TW.S.name || '—')], ['حذف الشخص المحدد ومحادثته'], ['حذف حسابي من السيرفر (يحتاج OK مرتين)']];
      C = '<div class="ch-opts"><h3>خيارات «تواصل»</h3>' + o.map(function (x, i) { return '<div class="ch-row add' + (i === st.oi ? ' ch-f' : '') + '">' + esc(x[0]) + '</div>'; }).join('') + '</div>';
    } else if (st.cur) {
      var l = TW.convo(st.cur);
      if (st.mi >= l.length) st.mi = Math.max(0, l.length - 1);
      C = '<div class="ch-head"><b>' + esc(TW.contactName(st.cur)) + '</b><small>' + TW.fmtCode(st.cur) + '</small></div><div id="chMsgs"><div class="ch-note">الرسائل تنحذف تلقائياً بعد ٢٤ ساعة. الأشخاص يبقون.</div>' + (l.length ? l.map(bubble).join('') : '<div class="ch-empty">ماكو رسائل بعد.</div>') + '</div>' +
        '<div id="chBar">' + BAR.map(function (b, i) { var t = b[1]; if (b[0] === 'rec' && st.rec) t = '⏹ إيقاف وإرسال · ' + ar(Math.floor(st.recT / 60) + ':' + ('0' + (st.recT % 60)).slice(-2)); if (b[0] === 'stt' && st.listen) t = '👂 جاري الاستماع…'; return '<div class="ch-b' + (st.f === 'bar' && i === st.bi ? ' ch-f' : '') + (b[0] === 'rec' && st.rec ? ' rec' : '') + '">' + t + '</div>'; }).join('') + (st.rec ? '<div class="ch-b' + (st.f === 'bar' && st.bi === BAR.length ? ' ch-f' : '') + '">✕ إلغاء</div>' : '') + '</div>';
    } else {
      C = '<div class="ch-welcome"><div class="code">' + TW.fmtCode(TW.S.code) + '</div><p>هذا رمز شاشتك. اكتبه بتطبيق «تواصل» بالموبايل (إضافة شخص أو شاشة) حتى تبدأ المحادثة.</p><p>أو أضف شخص من هنا برمزه.</p></div>';
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
  var ERR = { bad_code: 'الرمز غير صحيح (١٠ حروف وأرقام)', self: 'هذا رمز شاشتك أنت', no_such_user: 'ما لقيت أحد بهذا الرمز', network: 'ما في إنترنت', timeout: 'انقطع الاتصال', too_big: 'الملف أكبر من ١٥ ميجا', slow_down: 'خفّف الإرسال شوي', unauthorized: 'الحساب غير معروف' };
  function box() { return $('chIn'); }
  function startInput(mode, ph, val) {
    var b = box(); st.mode = mode; b.placeholder = ph; b.value = val || ''; b.classList.add('on'); b.setAttribute('dir', mode === 'add' ? 'ltr' : 'rtl'); b.focus();
  }
  function endInput(commit) {
    var b = box(), v = b.value.replace(/^\s+|\s+$/g, ''), mode = st.mode;
    b.blur(); b.classList.remove('on'); st.mode = ''; b.value = '';
    if (!commit || !v) { draw(); return; }
    if (mode === 'send') TW.sendText(st.cur, v, function (e) { if (e) toast(ERR[e.error] || 'تعذّر الإرسال'); });
    else if (mode === 'add') { say('جاري البحث…'); TW.addContact(v, function (e, c) { st.status = ''; if (e) { toast(ERR[e.error] || 'تعذّر'); return draw(); } toast('انضاف: ' + TW.contactName(c.code)); openChat(c.code); }); }
    else if (mode === 'name') { TW.rename(v); toast('انحفظ الاسم'); draw(); }
    draw();
  }

  /* ---- sending ---- */
  function sendBlob(blob, kind, name, mime) {
    TW.sendFile(st.cur, blob, kind, name, mime, kind === 'image' || kind === 'audio' ? URL.createObjectURL(blob) : '', function (e) { if (e) toast(ERR[e.error] || 'تعذّر الإرسال'); });
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
  function actMsg(m) {
    if (m.kind === 'image' && m.url) { $('chView').innerHTML = '<img src="' + esc(m.url) + '" alt="">'; $('chView').classList.add('on'); st.view = true; }
    else if (m.kind === 'audio') playAudio(m);
    else if (m.kind === 'file' && m.url) { try { A.twOpenUrl(m.url, m.mime); } catch (e) { toast('يحتاج الشاشة نفسها'); } }
    else if (m.st === 'failed' && m.kind === 'text') { var l = TW.convo(st.cur); l.splice(l.indexOf(m), 1); TW.sendText(st.cur, m.text, function () {}); }
  }

  /* ---- open / close / keys ---- */
  function openChat(code) { st.cur = code; st.f = 'bar'; st.bi = 0; st.mi = 1e6; TW.markRead(code); draw(); }
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
    if (st.view) { st.view = false; $('chView').classList.remove('on'); return; }
    if (st.rec && k === 'back') { recStop(false); return; }
    if (k === 'back') {
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
    if (st.f === 'opts') {
      if (k === 'ArrowDown') st.oi = Math.min(3, st.oi + 1); else if (k === 'ArrowUp') st.oi = Math.max(0, st.oi - 1);
      else if (k === 'ArrowRight') { st.f = 'list'; }
      else if (k === 'ok') {
        if (st.oi === 0) { var a = true; try { a = A.twAutoOn(); A.twAuto(!a); } catch (e) {} }
        else if (st.oi === 1) { startInput('name', 'اسم شاشتك عند الآخرين', TW.S.name); return; }
        else if (st.oi === 2) { if (st.cur) { TW.removeContact(st.cur); st.cur = ''; st.f = 'list'; toast('انحذف'); } else toast('اختر شخص من القائمة أول'); }
        else if (st.oi === 3) { if (st.sure) { TW.leave(function () { toast('انحذف حسابك'); st.cur = ''; st.f = 'list'; boot(function () { draw(); }); }); st.sure = false; } else { st.sure = true; toast('اضغط OK مرة ثانية للتأكيد'); setTimeout(function () { st.sure = false; }, 5000); } }
      }
      draw(); return;
    }
    var l = TW.convo(st.cur);
    if (st.f === 'convo') {
      if (k === 'ArrowUp') st.mi = Math.max(0, st.mi - 1);
      else if (k === 'ArrowDown') { if (st.mi >= l.length - 1) { st.f = 'bar'; } else st.mi++; }
      else if (k === 'ArrowRight') { st.f = 'list'; }
      else if (k === 'ok' && l[st.mi]) { actMsg(l[st.mi]); return; }
      draw(); return;
    }
    if (st.f === 'bar') {
      var n = BAR.length + (st.rec ? 1 : 0);
      if (k === 'ArrowRight') st.bi = Math.max(0, st.bi - 1); else if (k === 'ArrowLeft') st.bi = Math.min(n - 1, st.bi + 1);
      else if (k === 'ArrowUp') { st.f = 'convo'; st.mi = l.length - 1; }
      else if (k === 'ok') {
        var id = st.bi === BAR.length ? 'cancel' : BAR[st.bi][0];
        if (id === 'type') { startInput('send', 'اكتب رسالتك واضغط OK للإرسال'); return; }
        if (id === 'stt') { if (st.listen) { try { A.twListenStop(); } catch (e) {} } else { st.listen = true; try { A.twListen(); } catch (e) { st.listen = false; toast('يحتاج الشاشة نفسها'); } } }
        else if (id === 'rec') { if (st.rec) recStop(true); else recStart(); return; }
        else if (id === 'cancel') { recStop(false); return; }
        else if (id === 'file') { try { A.twPick(); } catch (e) { toast('يحتاج الشاشة نفسها'); } }
      }
      draw(); return;
    }
  }

  /* messages that arrived while the page was asleep or showing something else */
  window.__twDrain = function () {
    if (!window.TW) return;
    var q = []; try { q = JSON.parse(A.twTake ? A.twTake() : '[]') || []; } catch (e) {}
    if (!q.length) return;
    if (!TW.S) TW.load();
    var got = TW.ingest(q);
    topRefresh();
    if (!got.length) return;
    var auto = true; try { auto = A.twAutoOn ? A.twAutoOn() : true; } catch (e) {}
    if (st.on && !st.cur && st.f === 'list') openChat(got[got.length - 1].from);
    else if (!st.on && auto) open(got[got.length - 1].from);
    else if (!st.on) toast('رسالة جديدة من ' + TW.contactName(got[got.length - 1].from));
    else if (st.cur !== got[got.length - 1].from) toast('رسالة جديدة من ' + TW.contactName(got[got.length - 1].from));
  };
  window.__twOpen = function (code) { open(code); };
  setInterval(function () { if (st.on && ready()) { TW.purgeLocal(); draw(); } }, 60000);
  window.Chat = { open: open, key: key, unread: unread, close: close };
})();
