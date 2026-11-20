/* «الربط الذكي»: you paste a link your provider gave you; the PHONE looks at it (it is on the same network as the provider),
   works out what kind of service it is, and offers to hand it to the TV. Only generic kinds are recognised (an Xtream account, an M3U playlist,
   a direct video link): nothing here is written for one particular service. Every look is kept in a log you can copy. */
(function () {
  'use strict';
  const short = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').slice(0, n || 90);
  const origin = u => { const m = String(u).match(/^(https?:\/\/[^\/?#]+)/i); return m ? m[1] : ''; };
  const qs = u => { const o = {}; (String(u).split('?')[1] || '').split('#')[0].split('&').forEach(p => { const k = p.indexOf('='); if (k > 0) o[decodeURIComponent(p.slice(0, k))] = decodeURIComponent(p.slice(k + 1).replace(/\+/g, ' ')); }); return o; };

  async function look(url, log, ua) {
    let r; try { r = JSON.parse(await window.__direct('probe', { url, ua })); } catch (e) { r = { err: String(e && e.message || e) }; }
    log.push({ url: url.replace(/(password|pass|token|key)=([^&]+)/gi, '$1=***'), code: r.code || 0, type: short(r.type, 40), ms: r.ms, err: r.err || '', head: short(r.head, 70) });
    return r;
  }
  const isM3u = t => /^\s*#EXTM3U/.test(String(t || ''));
  function m3uSample(t) {
    const names = [], groups = {}; let n = 0;
    String(t).split(/\r?\n/).forEach(l => { if (l.indexOf('#EXTINF') === 0) { n++; const nm = (l.match(/,(.*)$/) || [0, ''])[1].trim(); if (names.length < 3 && nm) names.push(nm); const g = (l.match(/group-title="([^"]*)"/) || [0, ''])[1]; if (g) groups[g] = 1; } });
    return { n, names, groups: Object.keys(groups).slice(0, 4) };
  }

  /* what is this link? resolves to {kind, label, detail, log, apply(S, target)} — never throws */
  async function identify(raw) {
    const url = String(raw || '').trim(), log = [];
    const out = (kind, label, detail, apply, extra) => Object.assign({ kind, label, detail, log, apply }, extra || {});
    if (!/^https?:\/\/[^\s]+$/i.test(url)) return out('bad', 'هذا مو رابط', 'اكتب الرابط كامل يبدأ بـ http:// أو https://');
    const org = origin(url), q = qs(url);

    // 1) an Xtream login written as a link (get.php / player_api.php with username and password)
    if (q.username && q.password) {
      const r = await look(org + '/player_api.php?username=' + encodeURIComponent(q.username) + '&password=' + encodeURIComponent(q.password), log);
      let j = null; try { j = JSON.parse(r.head || ''); } catch (e) { }
      if (j && j.user_info) {
        const ui = j.user_info, ok = String(ui.auth) === '1';
        return out(ok ? 'xtream' : 'xtream-bad', ok ? 'حساب IPTV (Xtream)' : 'حساب Xtream: الدخول مرفوض',
          ok ? 'الحساب شغّال' + (ui.exp_date ? ' · ينتهي ' + new Date(ui.exp_date * 1000).toLocaleDateString('ar-IQ') : '') + (ui.max_connections ? ' · أجهزة ' + ui.max_connections : '') : 'تأكد من اليوزر والباسوورد وتاريخ الاشتراك',
          ok ? ((S, target) => { S.xtream = Object.assign({}, S.xtream || {}, { host: org, user: q.username, pass: q.password, name: (S.xtream || {}).name || 'اشتراكي', out: (S.xtream || {}).out || 'ts', live: target !== 'vod', vod: target !== 'live' }); }) : null,
          { targets: ['live', 'vod', 'both'] });
      }
      if (r.code === 403 || /cloudflare/i.test(r.head || '')) return out('blocked', 'السيرفر رافض الطلب (403)', 'الرد جاي من حماية قبل ما يوصل للسيرفر. اطلب عنوان بديل من المزوّد. التفاصيل بالتشخيص.');
    }

    // 2) the link itself: a playlist, a video, or a page
    const r = await look(url, log);
    if (r.err) return out('down', 'ما انفتح الرابط', r.err + (r.ms ? ' (بعد ' + r.ms + ' م.ث)' : '') + ' · تأكد إن الموبايل على شبكة المزوّد');
    if (r.code === 403 || r.code === 401) return out('blocked', 'الخدمة رافضة الطلب (' + r.code + ')', /cloudflare/i.test(r.head || '') ? 'الرد من حماية Cloudflare، مو من السيرفر نفسه' : 'يحتاج دخول أو ما يسمح لهذا الاتصال');
    if (r.code >= 400) return out('down', 'الرابط يرجّع خطأ ' + r.code, 'الصفحة غير موجودة أو انحذفت');
    if (isM3u(r.head)) {
      const s = m3uSample(r.head);
      return out('m3u', 'قائمة تشغيل (M3U)', 'تحتوي على الأقل ' + s.n + ' عنصر' + (s.names.length ? ' · مثل: ' + s.names.join(' · ') : '') + (s.groups.length ? ' · تصنيفات: ' + s.groups.join('، ') : ''),
        (S, target) => {
          const add = (key, lines) => { const set = new Set(String(S[key] || '').split(/\s+/).filter(Boolean)); set.add(url); S[key] = [...set].join('\n'); };
          if (target !== 'vod') { const L = String(S.myM3u || ''); if (L.indexOf(url) < 0) S.myM3u = (L ? L + '\n' : '') + url; }
          if (target !== 'live') add('vodLinks');
        }, { targets: ['live', 'vod', 'both'] });
    }
    if (/\.(mp4|m3u8|mkv|webm|ts|mov)(\?|$)/i.test(r.url || url) || /^(video|application\/(vnd\.apple\.mpegurl|x-mpegurl|octet-stream))/i.test(r.type || '') && !/html/i.test(r.type || '')) {
      return out('file', 'رابط فيديو مباشر', 'ملف تشغيل واحد (' + short(r.type, 30) + ')', (S) => {
        const l = S.vodItems || []; if (!l.some(x => x.u === url)) l.push({ n: decodeURIComponent((url.split('?')[0].split('/').pop() || 'فيديو')).replace(/\.[a-z0-9]+$/i, ''), u: url }); S.vodItems = l.slice(-60);
      }, { targets: ['vod'] });
    }
    // a bare server address: is it an Xtream panel waiting for a login?
    const p = await look(org + '/player_api.php', log);
    let pj = null; try { pj = JSON.parse(p.head || ''); } catch (e) { }
    if (pj && (pj.user_info || pj.server_info) || /"?auth"?\s*:\s*0/.test(p.head || ''))
      return out('xtream-host', 'سيرفر IPTV (Xtream)', 'السيرفر شغّال لكن يحتاج اليوزر والباسوورد: الصق الرابط الكامل اللي أعطاك إياه المزوّد (فيه username= و password=)، أو اكتبهم بقسم حساب IPTV.', null);
    if (/html/i.test(r.type || '')) { const t = (String(r.head || '').match(/<title[^>]*>([^<]*)/i) || [0, ''])[1].trim(); return out('web', 'صفحة موقع' + (t ? ': ' + short(t, 50) : ''), 'مو قائمة ولا فيديو. التطبيق ما يقدر يضيفها كمصدر. إذا عندك رابط قائمة (M3U) أو بيانات Xtream من المزوّد، استعملها.', null); }
    return out('unknown', 'نوع غير معروف', 'الرد: ' + short(r.type, 40) + ' · ' + short(r.head, 60) + ' · صوّر التشخيص وأدزّه حتى أضيف النوع.', null);
  }

  const logText = res => (res.log || []).map(l => (l.code || l.err) + ' · ' + (l.ms || 0) + 'ms · ' + l.url + (l.err ? ' · ' + l.err : '') + (l.type ? ' · ' + l.type : '') + (l.head ? ' · ' + l.head : '')).join('\n');
  window.SmartLink = { identify, logText };
})();
