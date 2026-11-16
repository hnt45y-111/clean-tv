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
  const sandbox = { window: win, document: { getElementById: () => null, createElement: () => ({ getContext: null }), querySelectorAll: () => [], body: { classList: { add() {}, remove() {} } } }, navigator: {}, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, setTimeout, clearTimeout, setInterval, clearInterval, Image: function () {}, Intl };
  win.window = win;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { Depth: win.Depth, t: win.Depth._t, store, toasts, apps };
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
  const first = load();
  first.t.dockApps(); first.t.hideApp('a'); first.t.state.bg = 3; first.t.state.effect = false; first.t.state.reduce = true; first.t.saveCfg();
  const next = load();                              // same TV, next boot
  next.store.depthCfg = first.store.depthCfg;
  next.t.loadCfg();
  assert.strictEqual(next.t.state.bg, 3);
  assert.strictEqual(next.t.state.effect, false);
  assert.strictEqual(next.t.state.reduce, true);
  assert.deepStrictEqual(plain(next.t.state.hidden), ['a']);
  assert.ok(!next.t.dockApps().some(a => a.pkg === 'a'));
});

test('a design can carry the first choices; the TV\'s own choice wins afterwards', () => {
  const x = load({ settings: { depth: { bg: 4, effect: false } } });
  x.t.loadCfg();
  assert.strictEqual(x.t.state.bg, 4); assert.strictEqual(x.t.state.effect, false);
  x.store.depthCfg = JSON.stringify({ bg: 1 });
  x.t.loadCfg();
  assert.strictEqual(x.t.state.bg, 1);
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

test('every place has its picture and its front layer, both 1920x1080', () => {
  const { Depth } = load();
  assert.strictEqual(Depth.places.length, 6);
  assert.deepStrictEqual(plain(Depth.places.map(p => p.n)), ['طاسيلي', 'تاغيت', 'جرجرة', 'تيميمون', 'غرداية', 'قسنطينة']);
  Depth.places.forEach(p => {
    const jpg = path.join(ASSETS, 'depth', p.id + '.jpg'), png = path.join(ASSETS, 'depth', p.id + '_fg.png');
    assert.ok(fs.existsSync(jpg) && fs.existsSync(png), p.id + ' files');
    const b = fs.readFileSync(png);
    assert.strictEqual(b.readUInt32BE(16), 1920); assert.strictEqual(b.readUInt32BE(20), 1080);
    assert.strictEqual(b[25], 6, p.id + ' front layer must be RGBA (transparent)');
    const j = fs.readFileSync(jpg); assert.ok(j[0] === 0xff && j[1] === 0xd8, p.id + ' is a jpeg');
    assert.ok(j.length < 600 * 1024 && b.length < 600 * 1024, p.id + ' stays light for weak TVs');
  });
});

test('credits name every picture', () => {
  const c = fs.readFileSync(path.join(__dirname, '../CREDITS.md'), 'utf8');
  ['tassili', 'taghit', 'djurdjura', 'timimoun', 'ghardaia', 'constantine'].forEach(id => assert.ok(c.indexOf(id + '.jpg') >= 0, id));
});

test('the page loads the new files and the old skins stay in the studio lists', () => {
  const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
  assert.ok(html.indexOf('depth.css') > 0 && html.indexOf('depth.js') > 0);
  const studio = fs.readFileSync(path.join(__dirname, '../Studio/app/src/main/assets/studio.js'), 'utf8');
  ['classic', 'ribbon', 'shelf', 'club', 'depth'].forEach(id => assert.ok(studio.indexOf("['" + id + "',") >= 0, id));
});
