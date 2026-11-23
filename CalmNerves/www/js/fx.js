/* fx: particle bursts, floating pop-ups, and the 3D-depth tilt (gyro on phones, pointer on desktop) */
(function () {
  G.burst = function (host, x, y, n, cols) {
    cols = cols || ['#ffd21f', '#8cf12a', '#ff8a14', '#ffffff', '#3aa0ff']; n = n || 20;
    for (var i = 0; i < n; i++) {
      var p = G.el('i', 'prt'), a = Math.random() * 6.283, d = 50 + Math.random() * 110, sz = 5 + Math.random() * 9;
      p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.width = p.style.height = sz + 'px'; p.style.background = cols[i % cols.length];
      p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px');
      if (i % 3 === 0) p.style.borderRadius = '2px';
      host.appendChild(p); setTimeout(function (q) { q.remove(); }.bind(null, p), 900);
    }
  };
  G.popText = function (host, txt, cls) { var e = G.el('div', 'pop ' + (cls || ''), txt); host.appendChild(e); setTimeout(function () { e.remove(); }, 1400); };
  // ---- 3D depth: --tx / --ty in [-1,1], eased, drive parallax layers in motion.css
  var tx = 0, ty = 0, cx = 0, cy = 0, app, gyro = false;
  function loop() { cx += (tx - cx) * .08; cy += (ty - cy) * .08; app.style.setProperty('--tx', cx.toFixed(3)); app.style.setProperty('--ty', cy.toFixed(3)); requestAnimationFrame(loop); }
  document.addEventListener('pointermove', function (e) { if (gyro || !app) return; var r = app.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - .5) * 2; ty = ((e.clientY - r.top) / r.height - .5) * 2; });
  document.addEventListener('pointerup', function (e) { if (!gyro && e.pointerType === 'touch') { tx = 0; ty = 0; } });
  window.addEventListener('deviceorientation', function (e) { if (e.gamma == null || e.beta == null) return; gyro = true; tx = Math.max(-1, Math.min(1, e.gamma / 25)); ty = Math.max(-1, Math.min(1, (e.beta - 50) / 25)); });
  window.addEventListener('load', function () { app = document.getElementById('app'); loop(); });
})();
