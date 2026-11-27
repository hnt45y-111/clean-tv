/* «تواصل»: the client shared by the phone app (Tawasul/) and the TV launcher (chat.js).
   One public code per device (10 letters), a private token that never leaves the device, contacts and the last 24 hours of messages kept locally.
   Messages travel through the Supabase function «tawasul» (long poll), files through signed upload / download links. ES5 on purpose (old TV WebViews). */
(function (root) {
  'use strict';
  var BASE = 'https://pegjfuculkrkwitihfqg.supabase.co/functions/v1/tawasul';
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* 32 symbols, no I O 0 1: the server accepts exactly these */
  var DAY = 86400000, MAXFILE = 15 * 1024 * 1024;
  var TW = { BASE: BASE, DAY: DAY, MAXFILE: MAXFILE, kind: 'phone', S: null, http: null, store: null, ls: {}, polling: false };

  /* ---- plumbing: storage, http, random ---- */
  function lsGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
  function rnd(n) {
    var a = new Uint8Array(n);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a); else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }
  TW.newCode = function () { var a = rnd(10), s = ''; for (var i = 0; i < 10; i++) s += ALPHA.charAt(a[i] & 31); return s; };
  TW.newToken = function () { var a = rnd(32), s = ''; for (var i = 0; i < 32; i++) s += (a[i] + 256).toString(16).slice(1); return s; };
  TW.cleanCode = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  TW.validCode = function (c) { return /^[A-HJ-NP-Z2-9]{10}$/.test(c); };
  TW.fmtCode = function (c) { c = String(c || ''); return c.length === 10 ? c.slice(0, 5) + '-' + c.slice(5) : c; };

  /* default transport: XMLHttpRequest. Tests replace TW.http with a fetch based one. cb(err, json) */
  TW.http = function (route, body, ms, cb) {
    var x = new XMLHttpRequest(), done = false;
    var fin = function (e, d) { if (!done) { done = true; cb(e, d); } };
    x.open('POST', BASE + '/' + route, true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.timeout = ms || 20000;
    x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) {} if (x.status >= 200 && x.status < 300 && j) fin(null, j); else fin({ status: x.status, error: (j && j.error) || 'http_' + x.status }, j); };
    x.onerror = function () { fin({ status: 0, error: 'network' }); };
    x.ontimeout = function () { fin({ status: 0, error: 'timeout' }); };
    x.send(JSON.stringify(body));
  };
  /* default file upload: PUT multipart (the form Supabase's own SDK uses). cb(err) */
  TW.putFile = function (url, blob, cb) {
    var f = new FormData(); f.append('cacheControl', '3600'); f.append('', blob);
    var x = new XMLHttpRequest();
    x.open('PUT', url, true); x.timeout = 120000;
    x.onload = function () { cb(x.status >= 200 && x.status < 300 ? null : { error: 'upload_' + x.status }); };
    x.onerror = function () { cb({ error: 'network' }); };
    x.ontimeout = function () { cb({ error: 'timeout' }); };
    x.send(f);
  };

  /* ---- state ---- */
  function blank() { return { code: '', token: '', name: '', kind: 'phone', contacts: [], msgs: {}, unread: {}, since: '', auto: true, pins: [], set: {}, prof: { status: '', pver: 0, ls_on: true, rr_on: true, ty_on: true } }; }
  TW.load = function () {
    var raw = TW.store ? TW.store.get('tw.state') : lsGet('tw.state'), s = null;
    try { s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }
    TW.S = s && s.contacts ? s : blank();
    var d = blank(), k; for (k in d) if (TW.S[k] === undefined) TW.S[k] = d[k];
    /* an object link made by the page dies with the page: such files are fetched again from the server when they are shown */
    for (var c in TW.S.msgs) for (var i = 0; i < TW.S.msgs[c].length; i++) { var u = TW.S.msgs[c][i]; if (u.url && String(u.url).indexOf('blob:') === 0) u.url = ''; }
    TW.sig = null; TW.typing = {};
    TW.purgeLocal(true);
    return TW.S;
  };
  TW.save = function () { var raw = JSON.stringify(TW.S); if (TW.store) TW.store.set('tw.state', raw); else lsSet('tw.state', raw); };
  function emit(ev, a, b) { var l = TW.ls[ev] || []; for (var i = 0; i < l.length; i++) { try { l[i](a, b); } catch (e) {} } }
  TW.on = function (ev, fn) { (TW.ls[ev] = TW.ls[ev] || []).push(fn); };
  TW.off = function (ev) { TW.ls[ev] = []; };

  /* a message is dropped when its time is up (24 hours unless the conversation says otherwise); the people stay */
  var NEVER = 4102444800000;
  TW.expOf = function (m) { return m.exp || (Date.parse(m.ts) + DAY); };
  TW.leftLabel = function (m) {
    var e = TW.expOf(m); if (e >= NEVER - DAY) return 'بدون حذف';
    var h = Math.max(0, Math.ceil((e - Date.now()) / 3600000));
    return h > 47 ? 'تنحذف بعد ' + Math.ceil(h / 24) + ' يوم' : 'تنحذف بعد ' + h + ' س';
  };
  TW.purgeLocal = function (silent) {
    var S = TW.S, now = Date.now(), n = 0, c;
    for (c in S.msgs) {
      var keep = [], l = S.msgs[c];
      for (var i = 0; i < l.length; i++) { if (now < TW.expOf(l[i])) keep.push(l[i]); else n++; }
      S.msgs[c] = keep;
    }
    if (n) { TW.save(); if (!silent) emit('change'); }
    return n;
  };

  /* ---- api ---- */
  TW.api = function (route, body, cb, ms) {
    var S = TW.S; body = body || {}; body.code = S.code; body.token = S.token;
    TW.http(route, body, ms, cb || function () {});
  };

  /* identity: created once, registered on the server; a taken code is replaced by a new one (only before anything was shared) */
  TW.init = function (kind, name, cb) {
    var S = TW.S || TW.load(), tries = 0;
    TW.kind = kind; cb = cb || function () {};
    if (!S.code) { S.code = TW.newCode(); S.token = TW.newToken(); S.kind = kind; if (name) S.name = name; TW.save(); }
    else if (name && !S.name) { S.name = name; TW.save(); }
    (function reg() {
      TW.http('register', { code: S.code, token: S.token, name: S.name, kind: S.kind }, 20000, function (e) {
        if (e && e.error === 'code_taken' && tries++ < 5 && !S.registered) { S.code = TW.newCode(); S.token = TW.newToken(); TW.save(); return reg(); }
        if (!e) { S.registered = true; TW.save(); }
        cb(e);
      });
    })();
  };
  TW.rename = function (name, cb) { TW.S.name = String(name || '').slice(0, 40); TW.save(); if (TW.S.registered) TW.api('rename', { name: TW.S.name }, cb); emit('change'); };

  /* ---- contacts ---- */
  TW.findContact = function (code) { var l = TW.S.contacts; for (var i = 0; i < l.length; i++) if (l[i].code === code) return l[i]; return null; };
  TW.contactName = function (code) { var c = TW.findContact(code); return c ? (c.alias || c.name || TW.fmtCode(code)) : TW.fmtCode(code); };
  TW.addContact = function (codeStr, cb) {
    var code = TW.cleanCode(codeStr);
    if (!TW.validCode(code)) return cb({ error: 'bad_code' });
    if (code === TW.S.code) return cb({ error: 'self' });
    var have = TW.findContact(code); if (have) return cb(null, have);
    TW.api('lookup', { other: code }, function (e, d) {
      if (e) return cb(e);
      var c = { code: code, name: d.user.name || '', kind: d.user.kind, added: Date.now() };
      TW.S.contacts.push(c); TW.save(); emit('change'); cb(null, c);
    });
  };
  TW.setAlias = function (code, alias) { var c = TW.findContact(code); if (c) { c.alias = String(alias || '').slice(0, 40); TW.save(); emit('change'); } };
  TW.removeContact = function (code) {
    var l = TW.S.contacts, o = [];
    for (var i = 0; i < l.length; i++) if (l[i].code !== code) o.push(l[i]);
    TW.S.contacts = o; delete TW.S.msgs[code]; delete TW.S.unread[code]; TW.save(); emit('change');
  };

  /* ---- messages ---- */
  TW.convo = function (code) { return TW.S.msgs[code] || (TW.S.msgs[code] = []); };
  TW.lastOf = function (code) { var l = TW.S.msgs[code]; return l && l.length ? l[l.length - 1] : null; };
  function addMsg(code, m) {
    var l = TW.convo(code);
    for (var i = 0; i < l.length; i++) if (l[i].id === m.id) return false;
    l.push(m); l.sort(function (a, b) { return Date.parse(a.ts) - Date.parse(b.ts); });
    return true;
  }
  TW.markRead = function (code) { if (TW.S.unread[code]) { TW.S.unread[code] = 0; TW.save(); emit('change'); if (TW.S.registered) TW.api('read', { from: code }, function () {}); } };
  TW.unreadTotal = function () { var n = 0, c; for (c in TW.S.unread) n += TW.S.unread[c] || 0; return n; };

  /* text message. cb(err) */
  TW.TTLS = [[86400, '٢٤ ساعة'], [604800, 'أسبوع'], [2592000, 'شهر'], [0, 'بدون حذف']];
  TW.ttlOf = function (code) { var c = TW.findContact(code); return c && c.ttl !== undefined ? c.ttl : 86400; };
  TW.ttlName = function (t) { for (var i = 0; i < TW.TTLS.length; i++) if (TW.TTLS[i][0] === t) return TW.TTLS[i][1]; return '٢٤ ساعة'; };
  TW.setTtl = function (code, t) { var c = TW.findContact(code); if (c) { c.ttl = t; TW.save(); emit('change'); } };
  function expFor(ttl, ts) { return ttl ? Date.parse(ts) + ttl * 1000 : NEVER; }
  function replyOf(o) { return o && o.reply ? { id: String(o.reply.id || ''), t: String(o.reply.t || '').slice(0, 100), n: String(o.reply.n || '').slice(0, 40) } : null; }
  TW.sendText = function (to, text, cb, o) {
    text = String(text || '').replace(/^\s+|\s+$/g, ''); cb = cb || function () {};
    if (!text) return cb({ error: 'empty' });
    var ttl = TW.ttlOf(to), now = new Date().toISOString(), rp = replyOf(o);
    var m = { id: 'l' + Date.now() + Math.floor(Math.random() * 1000), me: true, kind: 'text', text: text, ts: now, st: 'sending', exp: expFor(ttl, now), rs: 0 };
    if (rp) m.reply = rp;
    addMsg(to, m); TW.save(); emit('change');
    var body = { to: to, kind: 'text', text: text, ttl: ttl }; if (rp) body.reply = rp;
    TW.api('send', body, function (e, d) {
      if (e) { m.st = 'failed'; m.err = e.error; } else { m.st = 'sent'; m.id = d.id; m.ts = d.ts; m.exp = d.exp ? Date.parse(d.exp) : expFor(ttl, d.ts); }
      TW.save(); emit('change'); cb(e);
    });
  };
  /* file, image or voice note: blob = Blob/File; kind = image | audio | file. localUrl is shown at once on this side. cb(err) */
  TW.sendFile = function (to, blob, kind, name, mime, localUrl, cb, o) {
    cb = cb || function () {};
    var size = blob.size || 0;
    if (size > MAXFILE) return cb({ error: 'too_big' });
    var ttl = TW.ttlOf(to), now = new Date().toISOString(), rp = replyOf(o);
    var m = { id: 'l' + Date.now() + Math.floor(Math.random() * 1000), me: true, kind: kind, text: '', name: name || '', mime: mime || '', size: size, url: localUrl || '', ts: now, st: 'sending', exp: expFor(ttl, now), rs: 0 };
    if (rp) m.reply = rp;
    addMsg(to, m); TW.save(); emit('change');
    var fail = function (e) { m.st = 'failed'; m.err = e.error; TW.save(); emit('change'); cb(e); };
    TW.api('upload', { name: name, mime: mime, size: size }, function (e, up) {
      if (e) return fail(e);
      TW.putFile(up.url, blob, function (e2) {
        if (e2) return fail(e2);
        var body = { to: to, kind: kind, path: up.path, name: name, mime: mime, size: size, ttl: ttl }; if (rp) body.reply = rp;
        TW.api('send', body, function (e3, d) {
          if (e3) return fail(e3);
          m.st = 'sent'; m.id = d.id; m.ts = d.ts; m.exp = d.exp ? Date.parse(d.exp) : expFor(ttl, d.ts); m.urlAt = Date.now(); TW.save(); emit('change'); cb(null);
        });
      });
    });
  };

  /* ---- receiving: long poll, one request at a time ---- */
  function take(msgs) {
    var got = [], S = TW.S;
    for (var i = 0; i < msgs.length; i++) {
      var r = msgs[i];
      if (!TW.findContact(r.from)) { S.contacts.push({ code: r.from, name: r.fromName || '', kind: 'phone', added: Date.now(), incoming: 1 }); }
      else if (r.fromName) { var c = TW.findContact(r.from); if (c.name !== r.fromName) c.name = r.fromName; }
      var m = { id: r.id, me: false, kind: r.kind, text: r.text, name: r.name, mime: r.mime, size: r.size, url: r.url, urlAt: Date.now(), ts: r.ts, st: 'ok', exp: r.exp ? Date.parse(r.exp) : 0 };
      if (r.reply) m.reply = r.reply;
      var cc = TW.findContact(r.from); if (cc && r.pv !== undefined && cc.pv !== r.pv) cc.stale = 1;
      if (addMsg(r.from, m)) { S.unread[r.from] = (S.unread[r.from] || 0) + 1; got.push({ from: r.from, msg: m }); }
      if (!S.since || Date.parse(r.ts) > Date.parse(S.since)) S.since = r.ts;
    }
    return got;
  }
  /* messages the phone's background check already fetched (raw server form) */
  TW.ingest = function (list) {
    var got = take(list || []);
    if (got.length) { TW.save(); emit('change'); for (var i = 0; i < got.length; i++) emit('msg', got[i].from, got[i].msg); }
    return got;
  };
  /* what the server says besides new messages: delivery marks, pinned notes, deleted ids, who is typing, a screenshot request */
  TW.applySync = function (sy) {
    if (!sy) return; var S = TW.S, dirty = false, c, i, l, k;
    TW.sig = sy.sig;
    var rc = {}, gone = {};
    for (i = 0; i < (sy.rcpt || []).length; i++) rc[sy.rcpt[i][0]] = sy.rcpt[i];
    for (i = 0; i < (sy.gone || []).length; i++) gone[sy.gone[i]] = 1;
    for (c in S.msgs) {
      l = S.msgs[c]; var keep = [];
      for (i = 0; i < l.length; i++) {
        var m = l[i];
        if (!m.me && gone[m.id]) { dirty = true; continue; }
        if (m.me && rc[m.id]) { var rs = rc[m.id][2] ? 2 : rc[m.id][1] ? 1 : 0; if ((m.rs || 0) !== rs) { m.rs = rs; dirty = true; } }
        keep.push(m);
      }
      S.msgs[c] = keep;
    }
    var pj = JSON.stringify(sy.pins || []); if (pj !== JSON.stringify(S.pins || [])) { S.pins = sy.pins || []; dirty = true; emit('pins'); }
    var t = {}, now = Date.now(); for (i = 0; i < (sy.typing || []).length; i++) t[sy.typing[i]] = now;
    var tj = Object.keys(t).sort().join(), oj = Object.keys(TW.typing || {}).sort().join();
    TW.typing = t; if (tj !== oj) emit('typing');
    if (dirty) { TW.save(); emit('change'); }
    if (sy.snap) emit('snap', sy.snap);
  };
  TW.isTyping = function (code) { var t = TW.typing && TW.typing[code]; return !!t && Date.now() - t < 7000; };
  var lastTy = 0;
  TW.typingNow = function (code) { if (Date.now() - lastTy < 3000 || !TW.S.registered) return; lastTy = Date.now(); TW.api('typing', { to: code }, function () {}); };
  TW.pollOnce = function (wait, cb) {
    TW.api('inbox', { since: TW.S.since || null, wait: wait, sig: TW.sig === undefined ? null : TW.sig }, function (e, d) {
      if (e) return cb(e);
      if (d.sync) TW.applySync(d.sync);
      var got = take(d.msgs || []);
      if (got.length) { TW.save(); emit('change'); for (var i = 0; i < got.length; i++) emit('msg', got[i].from, got[i].msg); }
      cb(null, got);
    }, (wait + 15) * 1000);
  };
  TW.start = function () {
    if (TW.polling) return; TW.polling = true;
    var back = 2000;
    (function loop() {
      if (!TW.polling) return;
      if (!TW.S.code || !TW.S.registered) return setTimeout(loop, 3000);
      TW.pollOnce(20, function (e) {
        TW.purgeLocal();
        if (e) { back = Math.min(back * 2, 30000); return setTimeout(loop, back); }
        back = 2000; setTimeout(loop, 300);
      });
    })();
  };
  TW.stop = function () { TW.polling = false; };


  /* ---- delete for both, pin to the other screen ---- */
  function findMsg(id) { for (var c in TW.S.msgs) { var l = TW.S.msgs[c]; for (var i = 0; i < l.length; i++) if (l[i].id === id) return { code: c, list: l, i: i, m: l[i] }; } return null; }
  TW.findMsg = findMsg;
  TW.del = function (id, cb) {
    cb = cb || function () {}; var f = findMsg(id); if (!f) return cb(null);
    var local = String(id).charAt(0) === 'l';
    f.list.splice(f.i, 1); TW.save(); emit('change');
    if (local || !f.m.me) return cb(null);
    TW.api('del', { id: id }, function (e) { cb(e); });
  };
  TW.pin = function (id, on, cb) {
    cb = cb || function () {}; var f = findMsg(id); if (!f || !f.m.me || f.m.kind !== 'text' || String(id).charAt(0) === 'l') return cb({ error: 'not_ready' });
    TW.api('pin', { id: id, on: !!on }, function (e) { if (!e) { f.m.pin = !!on; TW.save(); emit('change'); } cb(e); });
  };

  /* ---- fresh links for files (the first link lasts 24 hours) ---- */
  TW.ensureUrls = function (code, cb) {
    var l = TW.convo(code), ids = [], i, now = Date.now();
    for (i = 0; i < l.length; i++) { var m = l[i]; if (m.kind !== 'text' && String(m.id).charAt(0) !== 'l' && (!m.url || now - (m.urlAt || 0) > 20 * 3600000)) ids.push(m.id); }
    if (!ids.length) return (cb || function () {})(null);
    TW.api('sign', { ids: ids.slice(-20) }, function (e, d) {
      if (!e && d && d.urls) { var any = false; for (var j = 0; j < l.length; j++) if (d.urls[l[j].id]) { l[j].url = d.urls[l[j].id]; l[j].urlAt = Date.now(); any = true; } if (any) { TW.save(); emit('change'); } }
      (cb || function () {})(e);
    });
  };

  /* ---- profile: mine and the people's ---- */
  function avKey(code) { return 'tw.av.' + code; }
  var avMem = {};
  TW.avatar = function (code) {
    if (avMem[code] !== undefined) return avMem[code];
    var v = TW.store ? TW.store.get(avKey(code)) : lsGet(avKey(code)); avMem[code] = v || ''; return avMem[code];
  };
  function setAvatar(code, v) { avMem[code] = v || ''; if (TW.store) TW.store.set(avKey(code), v || ''); else lsSet(avKey(code), v || ''); }
  TW.myAvatar = function () { return TW.avatar(TW.S.code); };
  /* fields: name, status, avatar (data link or ''), ls_on, rr_on, ty_on */
  TW.setProfile = function (f, cb) {
    var S = TW.S, p = S.prof, body = {}, k;
    if (f.name !== undefined) { S.name = String(f.name).slice(0, 40); body.name = S.name; }
    if (f.status !== undefined) { p.status = String(f.status).slice(0, 80); body.status = p.status; }
    if (f.avatar !== undefined) { setAvatar(S.code, f.avatar); body.avatar = f.avatar || null; }
    var flags = ['ls_on', 'rr_on', 'ty_on']; for (var i = 0; i < flags.length; i++) if (f[flags[i]] !== undefined) { p[flags[i]] = !!f[flags[i]]; body[flags[i]] = p[flags[i]]; }
    TW.save(); emit('change');
    if (!S.registered) return (cb || function () {})(null);
    TW.api('profile-set', body, function (e, d) { if (!e && d && d.pver) { p.pver = d.pver; TW.save(); } (cb || function () {})(e); });
  };
  TW.loadMyProfile = function (cb) {
    TW.api('profile-get', {}, function (e, d) {
      if (!e && d && d.me) { var m = d.me, p = TW.S.prof; p.status = m.status || ''; p.pver = m.pver || 0; p.ls_on = m.ls_on !== false; p.rr_on = m.rr_on !== false; p.ty_on = m.ty_on !== false; if (m.avatar) setAvatar(TW.S.code, m.avatar); TW.save(); emit('change'); }
      (cb || function () {})(e);
    });
  };
  /* names, status lines, photos and last seen of my contacts (photos only when changed) */
  TW.refreshProfiles = function (cb, force) {
    var S = TW.S, codes = [], have = {}, now = Date.now();
    if (!force && S.profAt && now - S.profAt < 120000 && !S.contacts.some(function (c) { return c.stale; })) return (cb || function () {})(null);
    S.contacts.forEach(function (c) { codes.push(c.code); have[c.code] = c.avatar ? c.pv : -1; });
    if (!codes.length) return (cb || function () {})(null);
    TW.api('profiles', { codes: codes, have: have }, function (e, d) {
      if (e || !d) return (cb || function () {})(e);
      (d.list || []).forEach(function (u) {
        var c = TW.findContact(u.code); if (!c) return;
        if (u.name) c.name = u.name; c.kind = u.kind || c.kind; c.status = u.status || ''; c.pv = u.pv; c.seen = u.seen || ''; c.stale = 0; c.avatar = u.hasAvatar ? 1 : 0;
        if (u.avatar) setAvatar(c.code, u.avatar); else if (!u.hasAvatar) setAvatar(c.code, '');
      });
      S.profAt = now; TW.save(); emit('change'); (cb || function () {})(null);
    });
  };
  TW.seenLabel = function (c) {
    if (!c || !c.seen) return ''; var s = Date.now() - Date.parse(c.seen);
    if (s < 60000) return 'متصل الآن'; if (s < 3600000) return 'آخر ظهور قبل ' + Math.ceil(s / 60000) + ' د';
    if (s < 86400000) return 'آخر ظهور قبل ' + Math.ceil(s / 3600000) + ' س'; return 'آخر ظهور قبل ' + Math.ceil(s / 86400000) + ' يوم';
  };

  /* ---- settings the apps share (quiet hours, auto play, mute) ---- */
  TW.setPref = function (k, v) { TW.S.set[k] = v; TW.save(); emit('prefs'); };
  TW.pref = function (k, d) { var v = TW.S.set[k]; return v === undefined ? d : v; };
  TW.setMute = function (code, on) { var c = TW.findContact(code); if (c) { c.muted = !!on; TW.save(); emit('prefs'); emit('change'); } };
  /* the part the Android side needs to decide about ringing, banners and opening the app */
  TW.nativePrefs = function () {
    var S = TW.S, mu = [], all = [];
    S.contacts.forEach(function (c) { all.push(c.code); if (c.muted) mu.push(c.code); });
    return { quiet: { on: !!TW.pref('quietOn', false), from: TW.pref('quietFrom', '23:00'), to: TW.pref('quietTo', '07:00') }, muted: mu, contacts: all, snap: !!TW.pref('snapOn', false), autoplay: !!TW.pref('autoPlay', false) };
  };
  /* true while the quiet hours are on and now falls inside them */
  TW.quietNow = function (d) {
    if (!TW.pref('quietOn', false)) return false;
    function mins(h) { var p = String(h).split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
    var f = mins(TW.pref('quietFrom', '23:00')), t = mins(TW.pref('quietTo', '07:00')), n = (d || new Date()).getHours() * 60 + (d || new Date()).getMinutes();
    if (f === t) return false; return f < t ? (n >= f && n < t) : (n >= f || n < t);
  };
  TW.askSnap = function (code, cb) { TW.api('snap', { to: code }, function (e) { (cb || function () {})(e); }); };

  /* ---- backup of the account and QR texts ---- */
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64d(s) { return decodeURIComponent(escape(atob(s))); }
  TW.exportBackup = function () {
    var S = TW.S, o = { c: S.code, t: S.token, n: S.name, k: S.kind, p: [] };
    S.contacts.forEach(function (c) { o.p.push([c.code, c.alias || '', c.ttl === undefined ? 86400 : c.ttl]); });
    return 'TW1.' + b64e(JSON.stringify(o));
  };
  /* replaces the identity of this device by the saved one. cb(err) */
  TW.importBackup = function (text, cb) {
    var o = null, t = String(text || '').replace(/\s+/g, '');
    try { if (t.indexOf('TW1.') === 0) o = JSON.parse(b64d(t.slice(4))); } catch (e) { o = null; }
    if (!o || !TW.validCode(o.c) || String(o.t || '').length < 20) return cb({ error: 'bad_backup' });
    TW.S = blank(); var S = TW.S;
    S.code = o.c; S.token = o.t; S.name = o.n || ''; S.kind = o.k === 'tv' ? 'tv' : 'phone'; S.registered = false;
    (o.p || []).forEach(function (r) { if (TW.validCode(r[0])) S.contacts.push({ code: r[0], name: '', alias: r[1] || '', kind: 'phone', added: Date.now(), ttl: r[2] === undefined ? 86400 : r[2] }); });
    TW.save(); cb(null);
  };
  TW.qrAdd = function () { return 'TAWASUL:ADD:' + TW.S.code; };
  TW.qrBackup = function () { return 'TAWASUL:ID:' + TW.S.code + ':' + TW.S.token + ':' + encodeURIComponent(TW.S.name || ''); };
  /* what a scanned text means: {type:'add',code} | {type:'id',code,token,name} | null */
  TW.parseQr = function (text) {
    var t = String(text || '').replace(/^\s+|\s+$/g, ''), m;
    if ((m = /^TAWASUL:ADD:([A-Z0-9]{10})$/.exec(t))) return TW.validCode(m[1]) ? { type: 'add', code: m[1] } : null;
    if ((m = /^TAWASUL:ID:([A-Z0-9]{10}):([0-9a-f]{20,}):(.*)$/.exec(t))) { var n = ''; try { n = decodeURIComponent(m[3]); } catch (e) {} return TW.validCode(m[1]) ? { type: 'id', code: m[1], token: m[2], name: n } : null; }
    var c = TW.cleanCode(t); if (TW.validCode(c)) return { type: 'add', code: c };
    return null;
  };
  /* a QR as an SVG string (needs qr.js); '' if it cannot be made */
  TW.qrSvg = function (text, px) {
    try {
      var q = (root.qrcode || (typeof require === 'function' ? require('./qr.js') : null))(0, 'M'); q.addData(String(text)); q.make();
      var n = q.getModuleCount(), d = '', r, c;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + 2) + ' ' + (r + 2) + 'h1v1h-1z';
      var z = n + 4;
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + z + ' ' + z + '" width="' + (px || 220) + '" height="' + (px || 220) + '" shape-rendering="crispEdges"><rect width="' + z + '" height="' + z + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
    } catch (e) { return ''; }
  };
  /* the first web link in a text (for «open on the screen») */
  TW.firstUrl = function (text) { var m = /https?:\/\/[^\s<>"']+/i.exec(String(text || '')); return m ? m[0].replace(/[).,،؛!؟]+$/, '') : ''; };

  /* leave: erases this device from the server (its files too) and clears everything here */
  TW.leave = function (cb) { TW.api('leave', {}, function (e) { TW.S = blank(); TW.sig = null; TW.save(); emit('change'); (cb || function () {})(e); }); };

  if (typeof module !== 'undefined' && module.exports) module.exports = TW; else root.TW = TW;
})(typeof window !== 'undefined' ? window : globalThis);
