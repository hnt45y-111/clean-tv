/* Shared by the car screen (car.html) and the phone app (index.html): ready designs, backgrounds and the config cleaner. */
const WALLS = {
  gold:   'radial-gradient(70% 90% at 85% 0%,#3a2d17 0,transparent 60%),radial-gradient(60% 80% at 0% 100%,#1b1a24 0,transparent 60%),linear-gradient(160deg,#14110c,#0B0C10)',
  aurora: 'radial-gradient(60% 80% at 15% 10%,#2b3f8f 0,transparent 60%),radial-gradient(55% 70% at 90% 90%,#5b2a86 0,transparent 60%),radial-gradient(40% 50% at 70% 20%,#1d6f8a 0,transparent 60%),#090b14',
  carbon: 'repeating-linear-gradient(45deg,rgba(255,255,255,.035) 0 6px,transparent 6px 12px),radial-gradient(70% 90% at 100% 0%,#4a0f12 0,transparent 60%),linear-gradient(160deg,#121214,#050506)',
  desert: 'radial-gradient(80% 70% at 80% 10%,#6b3f17 0,transparent 60%),radial-gradient(60% 60% at 0% 100%,#2c1a0c 0,transparent 60%),linear-gradient(170deg,#24160b,#0f0a06)',
  mint:   'radial-gradient(60% 80% at 85% 10%,#0f5d58 0,transparent 60%),radial-gradient(60% 70% at 10% 100%,#123a52 0,transparent 60%),#071012',
  pearl:  'radial-gradient(70% 80% at 90% 0%,#ffffff 0,transparent 60%),radial-gradient(60% 70% at 0% 100%,#e7dcc6 0,transparent 60%),#efe9de',
  night:  'radial-gradient(50% 60% at 50% 120%,#203a6b 0,transparent 70%),linear-gradient(180deg,#05060a,#0b1020)',
  rose:   'radial-gradient(60% 80% at 90% 0%,#6d2340 0,transparent 60%),radial-gradient(60% 70% at 0% 100%,#2a1636 0,transparent 60%),#0d080d',
  tealx:  'radial-gradient(60% 80% at 50% 0%,#0f3b44 0,transparent 65%),linear-gradient(180deg,#061219,#03090f)',
  redx:   'repeating-linear-gradient(120deg,rgba(255,31,61,.05) 0 2px,transparent 2px 40px),radial-gradient(70% 90% at 100% 0%,#3a0610 0,transparent 60%),#050505',
  frostx: 'radial-gradient(70% 80% at 80% 0%,#ffffff 0,transparent 60%),linear-gradient(180deg,#eef2f6,#dfe5ec)',
  violetx:'radial-gradient(70% 90% at 80% 10%,#6d28d9 0,transparent 60%),radial-gradient(60% 70% at 0% 100%,#be185d 0,transparent 60%),#12061f',
  blushx: 'linear-gradient(180deg,#e98aa4 0%,#b8607e 36%,#3a1d3f 74%,#1c0f22 100%)'
};
const WALL_NAMES = { gold: 'ذهبي', aurora: 'شفق', carbon: 'كاربون', desert: 'صحراء', mint: 'نعناعي', pearl: 'لؤلؤي', night: 'ليل', rose: 'وردي', tealx: 'فيروزي', redx: 'رياضي', frostx: 'زجاجي', violetx: 'بنفسجي', blushx: 'غروب' };

const TEMPLATES = [
  { id: 'gold', name: 'ذهبي هادئ', theme: { ac: '#D6B47A', bg: '#0B0C10', ink: '#F3EEE4', mute: '#A3A5B1', panel: 'rgba(255,255,255,.06)', font: 'Alx', radius: 3.2 }, wall: { type: 'preset', id: 'gold' }, clock: 'big', shade: .2 },
  { id: 'aurora', name: 'زجاج الليل', theme: { ac: '#9DBBFF', bg: '#090b14', ink: '#F2F4FF', mute: '#A9B0CC', panel: 'rgba(255,255,255,.09)', font: 'Alx', radius: 4 }, wall: { type: 'preset', id: 'aurora' }, clock: 'minimal', shade: .15 },
  { id: 'sport', name: 'رياضي', theme: { ac: '#FF4D4D', bg: '#060607', ink: '#F5F5F5', mute: '#A0A0A6', panel: 'rgba(255,255,255,.05)', font: 'Alx', radius: 1.4 }, wall: { type: 'preset', id: 'carbon' }, clock: 'digital', shade: .1 },
  { id: 'desert', name: 'صحراء', theme: { ac: '#F0A04B', bg: '#0f0a06', ink: '#FFF3E4', mute: '#C7AE92', panel: 'rgba(255,240,220,.07)', font: 'Tj', radius: 3 }, wall: { type: 'preset', id: 'desert' }, clock: 'big', shade: .15 },
  { id: 'mint', name: 'نعناعي', theme: { ac: '#3CCFC4', bg: '#071012', ink: '#ECFFFC', mute: '#98B9B5', panel: 'rgba(255,255,255,.07)', font: 'Alx', radius: 5 }, wall: { type: 'preset', id: 'mint' }, clock: 'minimal', shade: .1 },
  { id: 'tealx', name: 'الفيروزي', theme: { ac: '#19d3c5', bg: '#03090f', ink: '#EFFFFD', mute: '#8FB3B5', panel: 'rgba(255,255,255,.06)', font: 'Alx', radius: 2.4 }, wall: { type: 'preset', id: 'tealx' }, clock: 'big', shade: .05 },
  { id: 'redx', name: 'صُنع للسرعة', theme: { ac: '#ff1f3d', bg: '#050505', ink: '#FFFFFF', mute: '#A7A7AD', panel: 'rgba(255,255,255,.05)', font: 'Alx', radius: 1 }, wall: { type: 'preset', id: 'redx' }, clock: 'digital', shade: 0 },
  { id: 'frostx', name: 'الزجاج الأبيض', theme: { ac: '#3b82f6', bg: '#eef2f6', ink: '#0f172a', mute: '#5b6475', panel: 'rgba(255,255,255,.62)', font: 'Alx', radius: 3 }, wall: { type: 'preset', id: 'frostx' }, clock: 'minimal', shade: 0 },
  { id: 'violetx', name: 'البنفسجي المقسوم', theme: { ac: '#c084fc', bg: '#12061f', ink: '#FBF5FF', mute: '#C4B2D6', panel: 'rgba(255,255,255,.08)', font: 'Alx', radius: 3.6 }, wall: { type: 'preset', id: 'violetx' }, clock: 'big', shade: .1 },
  { id: 'blushx', name: 'غروب وردي', theme: { ac: '#ffb4c6', bg: '#1c0f22', ink: '#FFF5F8', mute: '#E3B9C6', panel: 'rgba(20,10,24,.72)', font: 'Alx', radius: 2.6 }, wall: { type: 'preset', id: 'blushx' }, clock: 'big', shade: 0 },
  { id: 'pearl', name: 'أبيض نقي', theme: { ac: '#A57C3C', bg: '#EFE9DE', ink: '#17181E', mute: '#5E5F69', panel: 'rgba(255,255,255,.62)', font: 'Alx', radius: 3.2 }, wall: { type: 'preset', id: 'pearl' }, clock: 'big', shade: 0 }
];

const DEFAULT_CFG = {
  v: 1, tpl: 'gold', name: 'ذهبي هادئ', theme: TEMPLATES[0].theme, wall: TEMPLATES[0].wall, clock: 'big', shade: .2,
  h24: false, digits: 'ar', greet: '', brand: '', flip: false,
  show: { media: true, speed: true, weather: true, battery: true, date: true },
  tiles: []
};

const hexOk = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
function cleanCfg(c) {
  const d = JSON.parse(JSON.stringify(DEFAULT_CFG));
  if (!c || typeof c !== 'object') return d;
  const o = Object.assign(d, c);
  const t = Object.assign({}, DEFAULT_CFG.theme, c.theme || {});
  ['ac', 'bg', 'ink', 'mute'].forEach(k => { if (!hexOk(t[k])) t[k] = DEFAULT_CFG.theme[k]; });
  if (typeof t.panel !== 'string' || !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/.test(t.panel)) t.panel = DEFAULT_CFG.theme.panel;
  if (!['Alx', 'Plex', 'Tj'].includes(t.font)) t.font = 'Alx';
  t.radius = Math.max(0, Math.min(8, +t.radius || 3.2));
  o.theme = t;
  const w = c.wall || {};
  if (w.type === 'photo') o.wall = { type: 'photo' };
  else if (w.type === 'grad' && hexOk(w.a) && hexOk(w.b)) o.wall = { type: 'grad', a: w.a, b: w.b, c: hexOk(w.c) ? w.c : '', angle: (+w.angle || 150) % 360 };
  else if (w.type === 'preset' && WALLS[w.id]) o.wall = { type: 'preset', id: w.id };
  else o.wall = DEFAULT_CFG.wall;
  if (!['big', 'digital', 'minimal'].includes(o.clock)) o.clock = 'big';
  o.shade = Math.max(0, Math.min(.8, +o.shade || 0));
  o.show = Object.assign({}, DEFAULT_CFG.show, c.show || {});
  o.greet = String(o.greet || '').slice(0, 40); o.brand = String(o.brand || '').slice(0, 24);
  o.tiles = Array.isArray(c.tiles) ? c.tiles.filter(x => x && ['media', 'nav', 'call'].includes(x.t)).slice(0, 24) : [];
  return o;
}

function wallCSS(w, photo) {
  if (!w) return WALLS.gold;
  if (w.type === 'photo') return photo ? `url("${photo}")` : WALLS.gold;
  if (w.type === 'grad') return w.c ? `radial-gradient(70% 90% at 85% 0%,${w.c} 0,transparent 60%),linear-gradient(${w.angle}deg,${w.a},${w.b})` : `linear-gradient(${w.angle}deg,${w.a},${w.b})`;
  return WALLS[w.id] || WALLS.gold;
}
