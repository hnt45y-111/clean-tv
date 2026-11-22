/* Reads the arrangement of a page: rows of posters (a link with a picture and a name), each row with the heading above it.
   Menus, icons, logos, ads and other sites' links are left out. Runs inside the page (WebView). Returns JSON text. */
(function () {
  try {
    function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return ''; } }
    function dom(h) { return String(h).split('.').slice(-2).join('.'); }
    var base = dom(location.hostname), cards = [], seen = {};
    var MENU = /^(الرئيسية|الصفحة الرئيسية|بحث|search|home|menu|القائمة|تسجيل|دخول|login|register|حسابي|المزيد|more|اتصل|من نحن|about|contact|الاصدارات الجديدة|المشهورة|الإعدادات|settings)$/i;
    var NAV = 'nav,header,footer,aside,[role=navigation],[class*=menu],[class*=navbar],[class*=sidebar],[class*=footer],[id*=menu],[id*=nav],[id*=sidebar]';
    var as = document.querySelectorAll('a[href]');
    for (var i = 0; i < as.length && cards.length < 1200; i++) {
      var a = as[i], href = abs(a.getAttribute('href'));
      if (!href || /^(javascript|mailto|tel)/i.test(href) || href.split('#')[0] === location.href.split('#')[0]) continue;
      var hn = ''; try { hn = new URL(href).hostname; } catch (e) { continue; }
      if (dom(hn) !== base) continue;
      if (a.closest(NAV)) continue;
      var im = a.querySelector('img'), src = '';
      if (im) src = im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || im.getAttribute('data-original') || im.currentSrc || im.src || '';
      if (!src) { var bg = a.querySelector('[style*="background-image"]') || a; var m = (bg.getAttribute('style') || '').match(/url\(['"]?([^'")]+)/); if (m) src = m[1]; }
      if (!src || /\.svg(\?|$)/i.test(src) || /^data:image\/svg/i.test(src) || /(^|[\/_-])(icon|logo|sprite|avatar|flag|banner-ad)[\/_.-]/i.test(src)) continue;
      var box = (im || a).getBoundingClientRect(), w = box.width, h = box.height;
      if (w < 90 || h < 60 || w * h < 9000) continue;
      var name = (a.getAttribute('title') || (im && im.getAttribute('alt')) || a.getAttribute('aria-label') || a.innerText || '').replace(/\s+/g, ' ').trim();
      if (name.length < 2 || name.length > 70 || MENU.test(name) || seen[href]) continue;
      seen[href] = 1; cards.push({ n: name, u: href, img: abs(src), a: a, area: w * h });
    }
    if (cards.length < 4) return JSON.stringify({ sections: [] });
    /* posters are the most common picture size on such a page: smaller things (icons, shortcut tiles, badges) are not posters */
    var all = cards.map(function (c) { return c.area; }).sort(function (x, y) { return x - y; }), gm = all[Math.floor(all.length / 2)];
    cards = cards.filter(function (c) { return c.area >= gm * 0.45; });
    if (cards.length < 4) return JSON.stringify({ sections: [] });
    function count(el) { var n = 0; for (var k = 0; k < cards.length; k++) if (el.contains(cards[k].a)) n++; return n; }
    var groups = [];
    cards.forEach(function (c) {
      var e = c.a.parentElement, best = null;
      for (var d = 0; d < 6 && e && e !== document.body; d++, e = e.parentElement) { if (count(e) >= 4) { best = e; break; } }
      if (!best) best = document.body;
      var g = null; for (var j = 0; j < groups.length; j++) if (groups[j].el === best) g = groups[j];
      if (!g) { g = { el: best, items: [] }; groups.push(g); }
      g.items.push(c);
    });
    function head(el) {
      var e = el;
      for (var d = 0; d < 5 && e; d++, e = e.parentElement) {
        var q = e.querySelector && e.querySelector('h1,h2,h3,h4,[class*=title],[class*=heading],[class*=head]');
        if (q && !q.querySelector('a[href] img')) { var t = (q.innerText || '').replace(/\s+/g, ' ').trim(); if (t.length >= 2 && t.length <= 40 && !MENU.test(t)) return t; }
        var p = e.previousElementSibling;
        for (var k = 0; k < 2 && p; k++, p = p.previousElementSibling) {
          if (/^H[1-6]$/.test(p.tagName) || /title|head/i.test(p.className || '')) { var t2 = (p.innerText || '').replace(/\s+/g, ' ').trim(); if (t2.length >= 2 && t2.length <= 40) return t2; }
        }
      }
      return '';
    }
    var out = [];
    groups.forEach(function (g) {
      var ar = g.items.map(function (c) { return c.area; }).sort(function (x, y) { return x - y; }), med = ar[Math.floor(ar.length / 2)];
      var items = g.items.filter(function (c) { return c.area >= med * 0.45; });     /* the odd small things in a row of posters are not posters */
      if (items.length < 3) return;
      out.push({ title: head(g.el) || ('قسم ' + (out.length + 1)), items: items.slice(0, 60).map(function (c) { return { n: c.n, u: c.u, img: c.img }; }) });
    });
    var nm = (document.querySelector('meta[property="og:site_name"]') || {}).content || (document.title || location.hostname).split(/\s[-|–—]\s/)[0];
    var ic = document.querySelector('link[rel~="icon"],link[rel="apple-touch-icon"]');
    return JSON.stringify({ name: String(nm).trim().slice(0, 40), icon: ic ? abs(ic.getAttribute('href')) : '', sections: out.slice(0, 30) });
  } catch (e) { return JSON.stringify({ sections: [], err: String(e) }); }
})()
