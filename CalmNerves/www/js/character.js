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

G.charSVG = function (state, opt) {
  opt = opt || {}; var av = G.AVATARS[opt.avatar != null ? opt.avatar : G.S.avatar] || G.AVATARS[0];
  var body = av[0], dark = av[1], id = 'c' + Math.random().toString(36).slice(2, 7), mouth, brows, extra = '', pr = 9, eyeRed = '';
  if (state === 'furious') { body = '#ff3b2e'; dark = '#a50f12'; eyeRed = '<g stroke="#e0182d" stroke-width="1.6" fill="none" opacity=".85"><path d="M62 78l14 8M64 96l16-4M96 70l-8 12M150 70l8 12M176 78l-14 8M176 96l-16-4"/></g>'; pr = 7; }
  var hands = '<g class="hands"><ellipse cx="62" cy="206" rx="22" ry="15" fill="' + body + '" stroke="#2a0f3e" stroke-width="5"/><ellipse cx="178" cy="206" rx="22" ry="15" fill="' + body + '" stroke="#2a0f3e" stroke-width="5"/><path d="M50 200v8M62 196v10M74 200v8M166 200v8M178 196v10M190 200v8" stroke="#2a0f3e" stroke-width="3" stroke-linecap="round"/></g>';
  switch (state) {
    case 'worried': mouth = '<path d="M98 150q22-14 44 0" fill="none" stroke="#2a0f3e" stroke-width="6" stroke-linecap="round"/>'; brows = '<path d="M64 62q22-20 46 0M130 62q22-20 46 0" transform="rotate(0)" fill="none" stroke="#2a0f3e" stroke-width="8" stroke-linecap="round"/>'; break;
    case 'sweat': mouth = '<path d="M96 154q24-22 48 0q-24 12-48 0z" fill="#5a1220" stroke="#2a0f3e" stroke-width="5"/>'; brows = '<path d="M62 70l46-12M132 58l46 12" fill="none" stroke="#2a0f3e" stroke-width="8" stroke-linecap="round"/>';
      extra = '<g class="steam"><circle cx="30" cy="115" r="16" fill="#fff" opacity=".9"/><circle cx="14" cy="130" r="12" fill="#fff" opacity=".8"/><circle cx="210" cy="115" r="16" fill="#fff" opacity=".9"/><circle cx="226" cy="130" r="12" fill="#fff" opacity=".8"/></g><path d="M186 60q10 18 0 26q-10-8 0-26z" fill="#7fd6ff" stroke="#1d6fb8" stroke-width="2"/>'; break;
    case 'furious': mouth = '<path d="M80 150q40-40 80 0q-4 36-40 36q-36 0-40-36z" fill="#4a0a14" stroke="#2a0f3e" stroke-width="6"/><path d="M92 152h56M98 164h44" stroke="#fff" stroke-width="9" stroke-linecap="round"/>'; brows = '<path d="M58 52l54 24M182 52l-54 24" fill="none" stroke="#2a0f3e" stroke-width="12" stroke-linecap="round"/>';
      extra = '<g class="steam"><circle cx="24" cy="120" r="24" fill="#fff" opacity=".92"/><circle cx="6" cy="140" r="16" fill="#fff" opacity=".8"/><circle cx="216" cy="120" r="24" fill="#fff" opacity=".92"/><circle cx="234" cy="140" r="16" fill="#fff" opacity=".8"/></g>'; break;
    case 'win': mouth = '<path d="M84 140q36 56 72 0z" fill="#5a1220" stroke="#2a0f3e" stroke-width="5"/><path d="M100 160q20 12 40 0q-20-8-40 0z" fill="#ff6b81"/>'; brows = '<path d="M62 70q22-14 46 0M132 70q22-14 46 0" fill="none" stroke="#2a0f3e" stroke-width="8" stroke-linecap="round"/>';
      hands = '<g><ellipse cx="38" cy="96" rx="26" ry="28" fill="' + body + '" stroke="#2a0f3e" stroke-width="5"/><ellipse cx="202" cy="96" rx="26" ry="28" fill="' + body + '" stroke="#2a0f3e" stroke-width="5"/><path d="M26 82h24M26 94h24M190 82h24M190 94h24" stroke="#2a0f3e" stroke-width="3"/></g>';
      extra = '<circle cx="120" cy="205" r="20" fill="#ffd21f" stroke="#a66a00" stroke-width="5"/><path d="M120 192l4 9 10 1-8 6 3 10-9-6-9 6 3-10-8-6 10-1z" fill="#ffe97a" stroke="#a66a00" stroke-width="2"/>'; break;
    case 'think': mouth = '<path d="M104 152q16 6 32-2" fill="none" stroke="#2a0f3e" stroke-width="6" stroke-linecap="round"/>'; brows = '<path d="M64 60q22-12 46 2M130 52q22-6 46 10" fill="none" stroke="#2a0f3e" stroke-width="8" stroke-linecap="round"/>'; break;
    default: mouth = '<path d="M96 146q24 24 48 0" fill="none" stroke="#2a0f3e" stroke-width="6" stroke-linecap="round"/>'; brows = '<path d="M64 64q22-16 46 0M130 64q22-16 46 0" fill="none" stroke="#2a0f3e" stroke-width="8" stroke-linecap="round"/>';
  }
  var hat = opt.hat != null ? opt.hat : G.S.hat; var hatTxt = G.HATS[hat] ? '<text x="120" y="38" font-size="58" text-anchor="middle">' + G.HATS[hat] + '</text>' : '';
  var eye = function (cx) { return '<g class="eye" data-cx="' + cx + '"><ellipse cx="' + cx + '" cy="100" rx="38" ry="42" fill="#fff" stroke="#2a0f3e" stroke-width="6"/>' + (eyeRed || '') +
    '<g class="pupil"><circle cx="' + cx + '" cy="104" r="' + (pr + 14) + '" fill="#2a1a4a"/><circle cx="' + cx + '" cy="104" r="' + (pr + 5) + '" fill="#10061f"/><circle cx="' + (cx - 5) + '" cy="96" r="6" fill="#fff"/><circle cx="' + (cx + 6) + '" cy="110" r="3" fill="#fff"/></g>' +
    '<rect class="lid" x="' + (cx - 40) + '" y="54" width="80" height="0" fill="' + body + '"/></g>'; };
  return '<svg class="char ' + state + '" viewBox="-20 -10 280 240" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="' + id + '" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#fff3a8"/><stop offset=".25" stop-color="' + body + '"/><stop offset="1" stop-color="' + dark + '"/></radialGradient></defs>' +
    '<g class="breathe"><ellipse cx="120" cy="120" rx="108" ry="96" fill="url(#' + id + ')" stroke="#2a0f3e" stroke-width="7"/><ellipse cx="85" cy="55" rx="40" ry="16" fill="#fff" opacity=".35" transform="rotate(-18 85 55)"/>' +
    eye(80) + eye(160) + brows + '<ellipse cx="46" cy="140" rx="12" ry="7" fill="#ff6b6b" opacity=".35"/><ellipse cx="194" cy="140" rx="12" ry="7" fill="#ff6b6b" opacity=".35"/>' + mouth + hatTxt + '</g>' + extra + hands + '</svg>';
};
G.bossSVG = function () {
  return '<svg class="char boss" viewBox="-30 -10 300 250" xmlns="http://www.w3.org/2000/svg"><g class="breathe"><rect x="-5" y="100" width="40" height="46" rx="12" fill="#c8c8d8" stroke="#2a0f3e" stroke-width="6"/><rect x="205" y="100" width="40" height="46" rx="12" fill="#c8c8d8" stroke="#2a0f3e" stroke-width="6"/><ellipse cx="120" cy="125" rx="108" ry="100" fill="#ff3a28" stroke="#2a0f3e" stroke-width="8"/><ellipse cx="80" cy="50" rx="44" ry="14" fill="#fff" opacity=".3"/>' +
    '<ellipse cx="82" cy="98" rx="40" ry="44" fill="#fff" stroke="#2a0f3e" stroke-width="6"/><ellipse cx="160" cy="98" rx="40" ry="44" fill="#fff" stroke="#2a0f3e" stroke-width="6"/><g stroke="#e0182d" stroke-width="1.8" fill="none"><path d="M50 80l16 8M48 100l18-4M84 62l-4 16M126 80l16 8M188 80l-16 8M160 62l4 16"/></g>' +
    '<g class="pupil"><circle cx="86" cy="104" r="12" fill="#10061f"/><circle cx="156" cy="104" r="12" fill="#10061f"/></g><path d="M44 56l76 28M196 56l-76 28" stroke="#2a0f3e" stroke-width="14" stroke-linecap="round"/>' +
    '<path d="M74 160q46-52 92 0q-6 44-46 44q-40 0-46-44z" fill="#4a0a14" stroke="#2a0f3e" stroke-width="7"/><path d="M90 162h60M98 178h44" stroke="#fff" stroke-width="10" stroke-linecap="round"/></g>' +
    '<g class="steam"><circle cx="-6" cy="125" r="30" fill="#fff" opacity=".9"/><circle cx="-24" cy="150" r="20" fill="#fff" opacity=".8"/><circle cx="246" cy="125" r="30" fill="#fff" opacity=".9"/><circle cx="264" cy="150" r="20" fill="#fff" opacity=".8"/></g></svg>';
};
G.crownSVG = '<svg class="crown" viewBox="0 0 120 80"><path d="M10 66L4 20l32 24 24-38 24 38 32-24-6 46z" fill="#ffc21a" stroke="#6b3a00" stroke-width="5" stroke-linejoin="round"/><path d="M14 58h92v10H14z" fill="#e89a00" stroke="#6b3a00" stroke-width="4"/><circle cx="60" cy="48" r="7" fill="#ff3b6b" stroke="#6b3a00" stroke-width="3"/><circle cx="30" cy="52" r="4" fill="#4aa8ff"/><circle cx="90" cy="52" r="4" fill="#34d52a"/></svg>';
// eyes follow the finger; periodic blink
(function () {
  document.addEventListener('pointermove', function (e) {
    document.querySelectorAll('.char .pupil').forEach(function (p) {
      var r = p.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 200) * 7;
      p.style.transform = 'translate(' + dx / d * m + 'px,' + dy / d * m + 'px)';
    });
  });
  setInterval(function () {
    document.querySelectorAll('.char .lid').forEach(function (l) { l.setAttribute('height', 90); setTimeout(function () { l.setAttribute('height', 0); }, 120); });
  }, 3200);
})();
