// خلفيات لوحة التحكم الرئيسية فقط (المسبقة + المخصّصة).
export const PRESETS = [
  { id: 'comic-blue', name: 'أزرق كوميك', css: 'radial-gradient(800px 460px at 75% 5%,#2b5bff66,transparent 60%),radial-gradient(700px 500px at 5% 100%,#7c3aed55,transparent 60%),linear-gradient(160deg,#0a1445,#050816)' },
  { id: 'neon-city', name: 'مدينة نيون', css: 'linear-gradient(180deg,#120536 0%,#3a0f6e 45%,#ff2d95 100%)' },
  { id: 'cyan-wave', name: 'موجة سماوية', css: 'radial-gradient(900px 500px at 20% 0%,#19d3ff55,transparent 60%),linear-gradient(200deg,#04283f,#041021 70%)' },
  { id: 'sunset', name: 'غروب', css: 'linear-gradient(170deg,#1b0b3b,#7a1f5c 55%,#ff9a3c)' },
  { id: 'forest', name: 'غابة داكنة', css: 'radial-gradient(800px 500px at 90% 0%,#22c55e44,transparent 60%),linear-gradient(160deg,#04210f,#02080a)' },
  { id: 'steel', name: 'فولاذ', css: 'linear-gradient(135deg,#1e2433,#0b0e18 60%,#2a3350)' },
];
/** يطبّق الخلفية على عنصر اللوحة فقط. */
export function applyBackground(layer, scrim, bg, urlOf) {
  layer.className = 'dash-bg'; layer.style.cssText = ''; layer.style.opacity = String(Math.max(0.1, bg.opacity / 100)); layer.style.filter = `brightness(${bg.brightness}%)`;
  if (bg.mode === 'image' && bg.file) { layer.style.backgroundImage = `url("${urlOf(bg.file)}")`; scrim.hidden = false; }
  else if (bg.mode === 'preset' && PRESETS.find((p) => p.id === bg.preset)) { layer.style.background = PRESETS.find((p) => p.id === bg.preset).css; scrim.hidden = false; }
  else { layer.classList.add('default'); scrim.hidden = true; layer.style.opacity = '1'; layer.style.filter = 'none'; }
}
