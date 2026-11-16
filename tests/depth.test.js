// «واجهة العمق»: the logic that needs no screen (dock, parallax position, saved choices) and the files it needs. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const plain = x => JSON.parse(JSON.stringify(x));   // values made inside the vm are from another realm

const ASSETS = path.join(__dirname, '../CleanTV/app/src/main/assets');
const SRC = fs.readFileSync(path.join(ASSETS, 'depth.js'), 'utf8');

function load(opts = {}) {
  const store = {};
  const toasts = [];
  const apps = (opts.apps || ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']).map(p => ({ pkg: p, label: p, color: '#445566' }));
  const win = {
    __depthApi: {
      preview: !!opts.preview, settings: () => Object.assign({ skin: 'depth' }, opts.settings || {}), apps: () => apps, label: a => a.label, icon: () => '', launch() {}, hijri: () => '', clock: () => '٥:١٩',
      prayer: () => null, toast: m => toasts.push(m), layer: () => 'main', press() {}, openSettings() {}, sysSettings() {}
    },
    addEventListener() {}
  };
  const stub = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, className: '', innerHTML: '', textContent: '', children: [], value: '', querySelector: () => null, querySelectorAll: () => [], appendChild() {}, focus() {}, blur() {}, offsetWidth: 0 });
  const els = {};
  const sandbox = { window: win, document: { getElementById: id => els[id] || (els[id] = stub()), createElement: () => ({ getContext: null }), querySelectorAll: () => [], body: { classList: { add() {}, remove() {} } }, activeElement: null }, navigator: {}, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, setTimeout, clearTimeout, setInterval, clearInterval, Image: function () {}, Intl };
  win.window = win;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { Depth: win.Depth, t: win.Depth._t, store, toasts, apps, els };
}

test('first run: the dock holds the first nine apps', () => {
  const { t } = load();
  assert.deepStrictEqual(plain(t.dockApps().map(a => a.pkg)), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
});

test('dock never takes more than ten apps and says so', () => {
  const { t, toasts } = load();
  t.dockApps();
  assert.ok(t.addDock('j'));                       // tenth: fine
  assert.strictEqual(t.dockApps().length, 10);
  assert.strictEqual(t.addDock('k'), false);       // eleventh: refused
  assert.ok(toasts.some(m => /ممتلئ/.test(m)));
  assert.strictEqual(t.dockApps().length, 10);
});

test('remove and hide take an app off the dock; the choice is saved', () => {
  const { t, store } = load();
  t.dockApps();
  t.removeDock('b');
  assert.ok(!t.dockApps().some(a => a.pkg === 'b'));
  t.hideApp('c');
  assert.ok(!t.dockApps().some(a => a.pkg === 'c'));
  const saved = JSON.parse(store.depthCfg);
  assert.deepStrictEqual(plain(saved.hidden), ['c']);
  assert.ok(saved.dock.indexOf('b') < 0 && saved.dock.indexOf('c') < 0);
});

test('saved choices are read back on the next start', () => {
  const first = load(); first.t.loadCfg();
  first.t.dockApps(); first.t.hideApp('a'); first.t.state.bg = 'timimoun'; first.t.state.effect = false; first.t.state.reduce = true; first.t.saveCfg();
  const next = load();                              // same TV, next boot, same design
  next.store.depthCfg = first.store.depthCfg;
  next.t.loadCfg();
  assert.strictEqual(next.t.state.bg, 'timimoun');
  assert.strictEqual(next.t.state.effect, false);
  assert.strictEqual(next.t.state.reduce, true);
  assert.deepStrictEqual(plain(next.t.state.hidden), ['a']);
  assert.ok(!next.t.dockApps().some(a => a.pkg === 'a'));
});

test('a design can carry the first choices; the TV\'s own choice wins afterwards', () => {
  const x = load({ settings: { depth: { bg: 'dukan', effect: false } } });
  x.t.loadCfg();
  assert.strictEqual(x.t.state.bg, 'dukan'); assert.strictEqual(x.t.state.effect, false);
  x.t.state.bg = 'shatt'; x.t.saveCfg();             // the TV chooses under the same design
  x.t.loadCfg();
  assert.strictEqual(x.t.state.bg, 'shatt');
});

test('preview mode (the phone app) never writes to the TV storage', () => {
  const { t, store } = load({ preview: true });
  t.dockApps(); t.hideApp('a');
  assert.strictEqual(store.depthCfg, undefined);
});

test('parallax follows the selection: right end of the dock +1, left end -1, middle 0', () => {
  const { t } = load();
  t.dockApps();
  t.state.di = 0; assert.strictEqual(t.selPos(), 1);
  t.state.di = 8; assert.strictEqual(t.selPos(), -1);
  t.state.di = 4; assert.strictEqual(t.selPos(), 0);
});

test('one app only: the picture stays still', () => {
  const { t } = load({ apps: ['a'] });
  t.dockApps(); t.state.di = 0; assert.strictEqual(t.selPos(), 0);
});

test('every place has its picture, a small blurred copy for the glass clock, and a front layer', () => {
  const { Depth } = load();
  assert.strictEqual(Depth.places.length, 14);
  assert.deepStrictEqual(plain(Depth.places.slice(0, 8).map(p => p.n)), ['قمة ثلجية', 'هيبت سلطان', 'رواندوز', 'جبل حلگورد', 'سد دوكان', 'دهوك وعمادية', 'شط العرب', 'أهوار ذي قار']);
  assert.deepStrictEqual(plain(Depth.places.slice(8).map(p => p.n)), ['طاسيلي', 'تاغيت', 'جرجرة', 'تيميمون', 'غرداية', 'قسنطينة']);
  Depth.places.forEach(p => {
    const jpg = path.join(ASSETS, 'depth', p.id + '.jpg'), blur = path.join(ASSETS, 'depth', p.id + '_b.jpg'), png = path.join(ASSETS, 'depth', p.id + '_fg.png');
    assert.ok(fs.existsSync(jpg) && fs.existsSync(blur), p.id + ' files');
    const j = fs.readFileSync(jpg); assert.ok(j[0] === 0xff && j[1] === 0xd8, p.id + ' is a jpeg'); assert.ok(j.length < 600 * 1024, p.id + ' stays light for weak TVs');
    assert.ok(fs.statSync(blur).size < 30 * 1024);
    if (p.user) { assert.ok(p.user.sky && p.user.sky.length >= 96, p.id + ' front layer (skyline)'); }
    else {
      const b = fs.readFileSync(png);
      assert.strictEqual(b.readUInt32BE(16), 1920); assert.strictEqual(b.readUInt32BE(20), 1080);
      assert.strictEqual(b[25], 6, p.id + ' front layer must be RGBA (transparent)'); assert.ok(b.length < 600 * 1024);
    }
  });
});

test('a design sent from the phone replaces the TV\'s old choices, but the TV keeps its own pictures', () => {
  const x = load({ settings: { depth: { bg: 'dukan', cs: 'bold', prov: 7 } } });
  x.t.state.users = [{ id: 'u1', src: 'x.jpg' }];
  x.store.depthCfg = JSON.stringify({ sig: 'old-design', bg: 'shatt', cs: 'thin', prov: 3, users: [{ id: 'u1', src: 'x.jpg' }] });
  x.t.loadCfg();
  assert.strictEqual(x.t.state.bg, 'dukan'); assert.strictEqual(x.t.state.cs, 'bold'); assert.strictEqual(x.t.state.prov, 7);
  assert.strictEqual(x.t.state.users.length, 1, 'pictures picked on the TV are kept');
  x.t.saveCfg(); x.t.state.bg = 'ahwar'; x.t.saveCfg();                      // the TV chooses again under the same design
  x.t.loadCfg(); assert.strictEqual(x.t.state.bg, 'ahwar', 'a choice made on the TV holds while the design is the same');
});

test('the phone decides the order and which pictures show; pictures sent from it join the list', () => {
  const x = load({ settings: { depth: { order: ['constantine', 'snow'], off: ['haibat'], bgs: [{ id: 'p1', n: 'صورة من التلفون', src: 'data:image/jpeg;base64,AA==', sky: [.3, .3], ok: true, dy: 20 }] } } });
  x.t.loadCfg();
  const ids = plain(x.t.placeList().map(p => p.id));
  assert.strictEqual(ids[0], 'constantine'); assert.strictEqual(ids[1], 'snow');
  assert.ok(!ids.includes('haibat'), 'switched off'); assert.ok(ids.includes('p1'));
  x.t.state.bg = 'haibat'; assert.ok(plain(x.t.placeList().map(p => p.id)).includes('haibat'), 'the one on screen is never removed from under it');
});

test('the news strip moves at a pace a person can read, and the pace is a setting', () => {
  const x = load(); x.t.loadCfg();
  const slow = x.t.newsCps(); assert.ok(slow >= 3 && slow <= 5, 'default about 4 letters a second, was ' + slow);
  x.t.state.nsp = 10; assert.ok(x.t.newsCps() > slow * 2); x.t.state.nsp = 1; assert.ok(x.t.newsCps() < slow);
});

test('the strips never stay silently empty: they say what they are waiting for', () => {
  const x = load();
  x.t.setMatches([], false, 'done'); assert.ok(/اختر فرقك/.test(x.els.dpMatches.innerHTML));
  x.t.setMatches([], true, 'done'); assert.ok(/ماكو مباريات/.test(x.els.dpMatches.innerHTML));
  x.t.setMatches([], true, 'loading'); assert.ok(/جاري/.test(x.els.dpMatches.innerHTML));
  x.t.setMatches([], true, 'fail'); assert.ok(/تعذّر/.test(x.els.dpMatches.innerHTML));
  x.t.setMatches([{ h: 'ريال مدريد', a: 'برشلونة', at: Date.now() + 1e8, lg: 'الدوري' }], true, 'done'); assert.ok(/ريال مدريد/.test(x.els.dpMatches.innerHTML));
  x.t.setNewsState('loading'); assert.ok(/جاري/.test(x.els.dpNews.innerHTML));
  x.t.setNewsState('fail'); assert.ok(/تعذّر/.test(x.els.dpNews.innerHTML));
  x.t.setNewsState('none'); assert.ok(/مصادر/.test(x.els.dpNews.innerHTML));
});

test('the phone editor has its «العمق» tab and its files are loaded', () => {
  const sdir = path.join(__dirname, '../Studio/app/src/main/assets');
  assert.ok(fs.existsSync(path.join(sdir, 'depth-studio.js')));
  assert.ok(fs.readFileSync(path.join(sdir, 'index.html'), 'utf8').indexOf('depth-studio.js') > 0);
  const js = fs.readFileSync(path.join(sdir, 'depth-studio.js'), 'utf8');
  ['data-dbg', 'data-dup', 'data-dcs', 'data-dpv', 'pspd', 'nsp', 'data-drss', 'tickerTeamsSheet', '__dsel', 'bgimages'].forEach(k => assert.ok(js.indexOf(k) >= 0, k));
});

test('the 18 governorates, in Iraq, with the Baghdad default', () => {
  const { Depth, t } = load();
  assert.deepStrictEqual(plain(Depth.provinces.map(p => p[0])), ['بغداد', 'البصرة', 'نينوى', 'الأنبار', 'ديالى', 'صلاح الدين', 'كركوك', 'أربيل', 'السليمانية', 'دهوك', 'واسط', 'ميسان', 'ذي قار', 'المثنى', 'القادسية', 'بابل', 'كربلاء', 'النجف']);
  Depth.provinces.forEach(p => { assert.ok(p[1] > 29 && p[1] < 37.5 && p[2] > 38 && p[2] < 49, p[0]); });
  t.loadCfg(); assert.strictEqual(t.state.prov, 0);
});

test('six clock looks and seven widgets', () => {
  const { Depth } = load();
  assert.deepStrictEqual(plain(Depth.clockStyles.map(c => c[1])), ['زجاجية', 'عادية', 'عريض', 'رفيع', 'مدوّر', 'مائل']);
  assert.deepStrictEqual(plain(Depth.widgets.map(w => w[0])), ['clock', 'date', 'pray', 'top', 'dock', 'matches', 'news']);
});

test('edit mode: move, resize, hide and reset a widget; it is saved and read back', () => {
  const x = load();
  x.t.loadCfg(); x.t.enterEdit();
  const E = x.t.state.edit; assert.ok(E && E.mode === 'sel');
  E.i = 4;                                            // the dock
  E.mode = 'move'; x.t.editKey('ArrowRight'); x.t.editKey('ArrowDown');
  const s = x.t.wState('dock'); assert.ok(s.x > 0 && s.y > 0);
  E.mode = 'size'; x.t.editKey('ArrowRight'); assert.ok(s.sx > 1 && s.sy > 1);
  for (let i = 0; i < 40; i++) x.t.editKey('ArrowLeft');
  assert.ok(s.sx >= .5 && s.sy >= .5, 'never smaller than half');
  E.mode = 'sel'; x.t.exitEdit();
  const saved = JSON.parse(x.store.depthCfg); assert.ok(saved.w.dock.x > 0);
  const again = load(); again.store.depthCfg = x.store.depthCfg; again.t.loadCfg();
  assert.strictEqual(again.t.wState('dock').x, saved.w.dock.x);
});

test('the clock takes width and height separately', () => {
  const x = load(); x.t.loadCfg(); x.t.enterEdit();
  const E = x.t.state.edit; E.i = 0; E.mode = 'size';
  x.t.editKey('ArrowRight'); x.t.editKey('ArrowRight'); x.t.editKey('ArrowDown');
  const c = x.t.wState('clock'); assert.ok(c.sx > 1.05 && c.sy < 1);
});

test('widgets cannot be pushed off the screen forever', () => {
  const x = load(); x.t.loadCfg(); x.t.enterEdit(); const E = x.t.state.edit; E.i = 2; E.mode = 'move';
  for (let i = 0; i < 400; i++) x.t.editKey('ArrowRight');
  assert.ok(x.t.wState('pray').x <= 1500);
});

test('the sky is found from the top: a skyline photo gives the skyline, an indoor one gives nothing', () => {
  const { t } = load();
  const W = 64, H = 36, img = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, peak = 14 + Math.abs(x - 32) * .6;           // a mountain: its top is at y = peak
    const ground = y > peak; img[i] = ground ? 60 : 120 + y; img[i + 1] = ground ? 50 : 150 + y; img[i + 2] = ground ? 70 : 220; img[i + 3] = 255;
  }
  const sky = t.skylineFrom(img, W, H);
  assert.ok(sky, 'sky found');
  const mid = sky[32] * H, edge = sky[2] * H;
  assert.ok(Math.abs(mid - 14) < 3, 'peak height ' + mid); assert.ok(edge > mid + 8, 'the skyline falls away from the peak');
  const dark = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < dark.length; i += 4) { dark[i] = 20; dark[i + 1] = 22; dark[i + 2] = 25; dark[i + 3] = 255; for (let q = 0; q < 3; q++) dark[i + q] += ((i / 4) % 7) * 12; }
  assert.strictEqual(t.skylineFrom(dark, W, H), null, 'no sky: no front layer');
});

test('clock height: aims for a seventh of the digits hidden, refuses more than 30%', () => {
  const { t } = load();
  const r = t.bestDy(dy => Math.max(0, Math.min(1, .14 + (dy - 10) * .004)));
  assert.ok(r.ok && Math.abs(r.cov - .14) < .03 && r.dy === 10, JSON.stringify(r));
  const bad = t.bestDy(() => .6); assert.strictEqual(bad.ok, false);
  const none = t.bestDy(() => 0); assert.strictEqual(none.ok, true);        // nothing covered: the clock simply stays above
});

test('depth and motion are chosen per picture; reduce motion switches the motion off', () => {
  const x = load(); x.t.loadCfg();
  const p = x.t.placeList()[0];
  assert.ok(x.t.depthOn(p));
  x.t.state.bgo[p.id] = { depth: false }; assert.ok(!x.t.depthOn(p)); assert.ok(x.t.depthOn(x.t.placeList()[1]));
  x.t.state.bgo[p.id] = { motion: false }; assert.ok(!x.t.motionOn(p.id));
  x.t.state.bgo[p.id] = {}; assert.ok(x.t.motionOn(p.id)); x.t.state.reduce = true; assert.ok(!x.t.motionOn(p.id));
});

test('the old first-release choice (a number) still maps to the same Algerian picture', () => {
  const x = load({ settings: { depth: { bg: 4 } } }); x.t.loadCfg(); assert.strictEqual(x.t.state.bg, 'ghardaia');
});

test('RSS items are read from titles, duplicates dropped, at most eight', () => {
  const { t } = load();
  const items = Array.from({ length: 12 }, (_, i) => '<item><title>خبر ' + (i % 10) + ' - موقع</title></item>').join('');
  // DOMParser is a browser object: the function must not crash without it
  assert.deepStrictEqual(plain(t.parseRss('<rss>' + items + '</rss>')), []);
});

test('credits name every picture', () => {
  const c = fs.readFileSync(path.join(__dirname, '../CREDITS.md'), 'utf8');
  ['snow', 'haibat', 'rawanduz', 'halgurd', 'dukan', 'amadiya', 'shatt', 'ahwar', 'tassili', 'taghit', 'djurdjura', 'timimoun', 'ghardaia', 'constantine'].forEach(id => assert.ok(c.indexOf(id + '.jpg') >= 0, id));
});

test('the page loads the new files and the old skins stay in the studio lists', () => {
  const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
  assert.ok(html.indexOf('depth.css') > 0 && html.indexOf('depth.js') > 0);
  const studio = fs.readFileSync(path.join(__dirname, '../Studio/app/src/main/assets/studio.js'), 'utf8');
  ['classic', 'ribbon', 'shelf', 'club', 'depth'].forEach(id => assert.ok(studio.indexOf("['" + id + "',") >= 0, id));
});
