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
  function blank() { return { code: '', token: '', name: '', kind: 'phone', contacts: [], msgs: {}, unread: {}, since: '', auto: true }; }
  TW.load = function () {
    var raw = TW.store ? TW.store.get('tw.state') : lsGet('tw.state'), s = null;
    try { s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }
    TW.S = s && s.contacts ? s : blank();
    TW.purgeLocal(true);
    return TW.S;
  };
  TW.save = function () { var raw = JSON.stringify(TW.S); if (TW.store) TW.store.set('tw.state', raw); else lsSet('tw.state', raw); };
  function emit(ev, a, b) { var l = TW.ls[ev] || []; for (var i = 0; i < l.length; i++) { try { l[i](a, b); } catch (e) {} } }
  TW.on = function (ev, fn) { (TW.ls[ev] = TW.ls[ev] || []).push(fn); };
  TW.off = function (ev) { TW.ls[ev] = []; };

  /* every message is dropped 24 hours after it was sent; the people stay */
  TW.purgeLocal = function (silent) {
    var S = TW.S, now = Date.now(), n = 0, c;
    for (c in S.msgs) {
      var keep = [], l = S.msgs[c];
      for (var i = 0; i < l.length; i++) { if (now - Date.parse(l[i].ts) < DAY) keep.push(l[i]); else n++; }
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
  TW.markRead = function (code) { if (TW.S.unread[code]) { TW.S.unread[code] = 0; TW.save(); emit('change'); } };
  TW.unreadTotal = function () { var n = 0, c; for (c in TW.S.unread) n += TW.S.unread[c] || 0; return n; };

  /* text message. cb(err) */
  TW.sendText = function (to, text, cb) {
    text = String(text || '').replace(/^\s+|\s+$/g, ''); cb = cb || function () {};
    if (!text) return cb({ error: 'empty' });
    var m = { id: 'l' + Date.now() + Math.floor(Math.random() * 1000), me: true, kind: 'text', text: text, ts: new Date().toISOString(), st: 'sending' };
    addMsg(to, m); TW.save(); emit('change');
    TW.api('send', { to: to, kind: 'text', text: text }, function (e, d) {
      if (e) { m.st = 'failed'; m.err = e.error; } else { m.st = 'sent'; m.id = d.id; m.ts = d.ts; }
      TW.save(); emit('change'); cb(e);
    });
  };
  /* file, image or voice note: blob = Blob/File; kind = image | audio | file. localUrl is shown at once on this side. cb(err) */
  TW.sendFile = function (to, blob, kind, name, mime, localUrl, cb) {
    cb = cb || function () {};
    var size = blob.size || 0;
    if (size > MAXFILE) return cb({ error: 'too_big' });
    var m = { id: 'l' + Date.now() + Math.floor(Math.random() * 1000), me: true, kind: kind, text: '', name: name || '', mime: mime || '', size: size, url: localUrl || '', ts: new Date().toISOString(), st: 'sending' };
    addMsg(to, m); TW.save(); emit('change');
    var fail = function (e) { m.st = 'failed'; m.err = e.error; TW.save(); emit('change'); cb(e); };
    TW.api('upload', { name: name, mime: mime, size: size }, function (e, up) {
      if (e) return fail(e);
      TW.putFile(up.url, blob, function (e2) {
        if (e2) return fail(e2);
        TW.api('send', { to: to, kind: kind, path: up.path, name: name, mime: mime, size: size }, function (e3, d) {
          if (e3) return fail(e3);
          m.st = 'sent'; m.id = d.id; m.ts = d.ts; TW.save(); emit('change'); cb(null);
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
      var m = { id: r.id, me: false, kind: r.kind, text: r.text, name: r.name, mime: r.mime, size: r.size, url: r.url, ts: r.ts, st: 'ok' };
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
  TW.pollOnce = function (wait, cb) {
    TW.api('inbox', { since: TW.S.since || null, wait: wait }, function (e, d) {
      if (e) return cb(e);
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

  /* leave: erases this device from the server (its files too) and clears everything here */
  TW.leave = function (cb) { TW.api('leave', {}, function (e) { TW.S = blank(); TW.save(); emit('change'); (cb || function () {})(e); }); };

  if (typeof module !== 'undefined' && module.exports) module.exports = TW; else root.TW = TW;
})(typeof window !== 'undefined' ? window : globalThis);
