/* Main character & boss as SVG. states: calm, worried, sweat, furious, win, think */
window.G = window.G || {};
G.AVATARS = [ // fixed avatar set: [body, body-dark, unlockLevel]
  ['#ffb52e', '#e8761a', 1], ['#7ee04a', '#3da51c', 1], ['#5db8ff', '#2a74d8', 5], ['#d98bff', '#9a3fd6', 10],
  ['#ff7a9c', '#d42e62', 20], ['#f5f5f5', '#a9a9c8', 35], ['#ffd21f', '#d19a00', 50], ['#46e6c8', '#16a58c', 80]
];
G.HATS = ['', '👑', '🎩', '🧢', '🎓', '⛑️', '🪖', '🎀']; // index = hat id, unlock = 1,3,8,15,30,60,100,150 levels
G.HAT_UNLOCK = [0, 1, 8, 15, 30, 60, 100, 150];
G.avatarUnlocked = function (i) { return G.S.level >= G.AVATARS[i][2]; };
G.hatUnlocked = function (i) { return G.S.level >= G.HAT_UNLOCK[i]; };

/* Characters are the reference art itself (img/*.png cropped from the approved reference image). */
G.IMG = function (n) { return 'img/' + n + '.png'; };
G.HUE = [0, 85, 175, 235, 305, 0, -18, 130]; // avatar colour variants = hue rotation of the reference character
G.charSVG = function (state, opt) {
  opt = opt || {}; var av = opt.avatar != null ? opt.avatar : G.S.avatar, hat = opt.hat != null ? opt.hat : G.S.hat;
  var img = { calm: 'char_calm', worried: 'think', think: 'think', sweat: 'shock', furious: 'boss', win: 'win' }[state] || 'char_calm';
  var f = av === 5 ? 'saturate(0) brightness(1.25)' : (G.HUE[av] && state !== 'furious' ? 'hue-rotate(' + G.HUE[av] + 'deg)' : 'none');
  return '<div class="char ' + state + '"><div class="breathe"><img src="' + G.IMG(img) + '" style="filter:' + f + '" draggable="false" alt="">' + (G.HATS[hat] && state !== 'furious' ? '<span class="hatov">' + G.HATS[hat] + '</span>' : '') + '</div></div>';
};
G.bossSVG = function () { return '<div class="char boss"><div class="breathe"><img src="' + G.IMG('boss') + '" draggable="false" alt=""></div></div>'; };
G.crownSVG = '<img class="crown" src="img/crown.png" alt="">';
// character leans toward the finger (replaces eye-tracking, since the face is the original artwork)
document.addEventListener('pointermove', function (e) {
  document.querySelectorAll('.char .breathe img').forEach(function (p) {
    var r = p.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 250) * 4;
    p.style.transform = 'translate(' + dx / d * m + 'px,' + dy / d * m + 'px)';
  });
});
