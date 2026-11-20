// مؤثرات صوتية (تُولَّد برمجياً بلا ملفات) + اهتزاز + انتقال سينمائي. كلها اختيارية وتُعطَّل بالوضع الهادئ.
import { prefs } from './store.js';
import { h, ic } from './dom.js';
import { t } from './i18n.js';

let ctx;
const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
const SEQ = {
  tick: [[880, .05, 'square', .04]], join: [[520, .08], [780, .12]], flip: [[300, .06, 'triangle'], [600, .12, 'triangle']],
  night: [[220, .3, 'sine', .07], [165, .5, 'sine', .07]], day: [[440, .15], [554, .15], [659, .3]], vote: [[660, .08], [880, .1]],
  alarm: [[880, .18, 'square', .08], [0, .06], [880, .18, 'square', .08], [0, .06], [880, .3, 'square', .08]],
  win: [[523, .14], [659, .14], [784, .14], [1047, .4]], lose: [[392, .2, 'sawtooth', .05], [311, .2, 'sawtooth', .05], [233, .5, 'sawtooth', .05]],
  dead: [[200, .25, 'sawtooth', .06], [120, .5, 'sawtooth', .06]], notify: [[740, .09], [988, .14]],
};
export function sfx(name) {
  if (!prefs.sound || prefs.quiet) return;
  const a = ac(); const seq = SEQ[name]; if (!a || !seq) return;
  let at = a.currentTime;
  for (const [f, d, type = 'sine', vol = .1] of seq) {
    if (f) { const o = a.createOscillator(); const g = a.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(.0001, at + d); o.connect(g).connect(a.destination); o.start(at); o.stop(at + d + .02); }
    at += d;
  }
}
export const buzz = (p = 30) => { if (prefs.haptics && !prefs.quiet && navigator.vibrate && (navigator.userActivation?.hasBeenActive ?? true)) { try { navigator.vibrate(p); } catch { /* غير مدعوم */ } } };

export function cinematic(kind) { // 'night' | 'day'
  if (prefs.lite) return;
  const el = h('div', { class: `cine ${kind}` }, h('div', { class: 'orb', style: { color: kind === 'night' ? '#A45BE7' : '#E8AE42' } }, ic(kind === 'night' ? 'moon' : 'sun', 'lg')),
    h('div', { class: 'lbl' }, t(kind === 'night' ? 'night_falls' : 'day_breaks')));
  el.querySelector('.orb svg').style.cssText = 'width:120px;height:120px;stroke-width:1.2';
  document.getElementById('layer').append(el); setTimeout(() => el.remove(), 1750);
}
