const C='calm-v1',F=['./','index.html','css/style.css','js/i18n.js','js/core.js','js/character.js','js/challenges.js','js/app.js','data/questions.js','fonts/cairo-arabic-900-normal.woff2','fonts/cairo-latin-900-normal.woff2','fonts/cairo-latin-ext-900-normal.woff2','manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
