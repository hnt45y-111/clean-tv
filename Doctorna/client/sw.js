// عامل الخدمة: يخزّن واجهة التطبيق حتى تفتح بسرعة، والبيانات دايمًا من الخادم
const V = 'doctorna-v1';
const SHELL = ['./', 'css/app.css', 'js/main.js', 'icons/icon.svg', 'icons/mark.svg', 'img/logo-h.png', 'fonts/reem-kufi-arabic-700-normal.woff2', 'fonts/noto-kufi-arabic-arabic-600-normal.woff2', 'fonts/noto-kufi-arabic-arabic-700-normal.woff2', 'fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2', 'fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2', 'fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2', 'fonts/noto-naskh-arabic-arabic-400-normal.woff2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('./'))));
});
self.addEventListener('notificationclick', (e) => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./#/notifications')))); });
