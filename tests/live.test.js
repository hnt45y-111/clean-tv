// Logic tests for «قنواتي» (CleanTV/app/src/main/assets/live.js): run with `node --test tests/`
// The page is loaded into a tiny fake browser, so no emulator or device is needed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '../CleanTV/app/src/main/assets/live.js'), 'utf8');

function classList() {
  const s = new Set();
  return { add: c => s.add(c), remove: c => s.delete(c), contains: c => s.has(c), toggle(c, f) { (f === undefined ? !s.has(c) : f) ? s.add(c) : s.delete(c); } };
}
function makePage(opts = {}) {
  const els = {};
  const el = id => els[id] || (els[id] = { id, innerHTML: '', textContent: '', value: '', style: {}, children: [], clientHeight: 600, offsetTop: 0, offsetHeight: 100, classList: classList(), setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, blur() {}, focus() {}, addEventListener() {} });
  const store = {};
  const calls = [];
  let saved = (opts.saved || []).slice();
  const win = {
    CHANNELS: opts.channels || [
      { n: 'قناة أخبار', c: 'qa', g: 'news', u: 'http://a/1.m3u8' },
      { n: 'قناة رياضة', c: 'qa', g: 'sport', u: 'http://a/2.m3u8' },
      { n: 'العراقية', c: 'iq', g: 'ent', u: 'http://a/3.m3u8' }],
    CH_GROUPS: [['iq', 'العراق'], ['qa', 'قطر']],
    __getSettings: () => opts.settings || {},
    Android: {
      siteChannels: () => JSON.stringify(saved),
      siteDelete: k => { calls.push('del ' + k); saved = saved.filter(o => o.u + '|' + o.n !== k); },
      openSite: u => calls.push('open ' + u),
      playLive: (json, i) => calls.push({ play: i, pack: JSON.parse(json) })
    },
    toastMsg: () => {}
  };
  const sandbox = { window: win, document: { getElementById: el, addEventListener() {}, activeElement: null, createElement: () => el('x') }, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, console, setTimeout, clearTimeout };
  win.window = win;
  vm.createContext(sandbox);
  vm.runInContext(SRC, Object.assign(sandbox, { window: win }));
  const Live = win.Live;
  const names = () => [...el('lvGrid').innerHTML.matchAll(/class="lv-n">([^<]*)</g)].map(m => m[1]);
  const cats = () => [...el('lvCats').innerHTML.matchAll(/class="lv-cat[^"]*">([^<]*)</g)].map(m => m[1]);
  const onCat = () => (el('lvCats').innerHTML.match(/class="lv-cat on[^"]*">([^<]*)</) || [])[1];
  const keys = (...ks) => ks.forEach(k => Live.key(k));
  /* move the category column to the folder with this name */
  const goCat = name => {
    keys('ArrowRight');
    for (let i = 0; i < 60 && onCat() !== name; i++) keys('ArrowDown');
    assert.strictEqual(onCat(), name, 'folder ' + name + ' not reachable by the remote');
    keys('ok');
  };
  return { Live, el, win, calls, names, cats, onCat, keys, goCat };
}

const SPORT = { n: 'قناة محفوظة رياضة', u: 'http://site/s.m3u8', g: 'sport', p: '', c: 'my', r: 'http://site/', ua: 'UA' };
const IRAQ = { n: 'عراقية محفوظة', u: 'http://site/i.m3u8', g: 'ent', p: '', c: 'iq' };

test('saved site channels show in "all", in their category and in the Iraqi group', () => {
  const t = makePage({ saved: [SPORT, IRAQ] });
  t.Live.open();
  assert.ok(t.names().includes('قناة محفوظة رياضة'));
  assert.ok(t.names().includes('عراقية محفوظة'));
  t.goCat('رياضة');
  assert.deepStrictEqual(t.names().sort(), ['قناة رياضة', 'قناة محفوظة رياضة'].sort());
  t.keys('ArrowRight');
  t.goCat('قنوات عراقية');
  assert.ok(t.names().includes('عراقية محفوظة'));
  assert.ok(t.names().includes('العراقية'));
});

test('saved channel is played with its referer and user agent', () => {
  const t = makePage({ saved: [SPORT] });
  t.Live.open();
  t.goCat('رياضة');
  const i = t.names().indexOf('قناة محفوظة رياضة');
  for (let k = 0; k < i; k++) t.keys('ArrowLeft');
  t.keys('ok');
  const play = t.calls.find(c => c.play !== undefined);
  assert.ok(play, 'playLive was not called');
  const ch = play.pack.list[play.pack.idx];
  assert.strictEqual(ch.n, 'قناة محفوظة رياضة');
  assert.strictEqual(ch.r, 'http://site/');
  assert.strictEqual(ch.ua, 'UA');
});

test('tools row is separate from the view chips and reachable', () => {
  const t = makePage();
  t.Live.open();
  assert.ok(!/بحث|ترتيب/.test(t.el('lvViews').innerHTML), 'search/edit must not sit among the view chips');
  assert.ok(/بحث/.test(t.el('lvTools').innerHTML) && /ترتيب القنوات/.test(t.el('lvTools').innerHTML));
  t.keys('ArrowUp');                                  // top row of the grid -> tools
  assert.ok(/lv-tl focus/.test(t.el('lvTools').innerHTML));
  t.keys('ArrowUp');                                  // -> view chips
  assert.ok(/lv-vw[^"]* focus/.test(t.el('lvViews').innerHTML));
  t.keys('ArrowDown', 'ArrowLeft', 'ok');             // tools: second chip = edit mode
  assert.ok(/lv-tl on/.test(t.el('lvTools').innerHTML), 'edit mode did not turn on');
});

test('delete chip only exists when there are saved site channels', () => {
  assert.ok(!/حذف قناة محفوظة/.test((() => { const t = makePage(); t.Live.open(); return t.el('lvTools').innerHTML; })()));
  const t = makePage({ saved: [SPORT] });
  t.Live.open();
  assert.ok(/حذف قناة محفوظة/.test(t.el('lvTools').innerHTML));
});

test('delete mode removes a saved channel and nothing else', () => {
  const t = makePage({ saved: [SPORT] });
  t.Live.open();
  t.keys('ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ok');  // tools: third chip = delete mode
  t.keys('ArrowDown');                                // back to the grid
  t.goCat('رياضة');
  const i = t.names().indexOf('قناة محفوظة رياضة');
  for (let k = 0; k < i; k++) t.keys('ArrowLeft');
  t.keys('ok');
  assert.deepStrictEqual(t.calls.filter(c => typeof c === 'string'), ['del http://site/s.m3u8|قناة محفوظة رياضة']);
  assert.ok(!t.names().includes('قناة محفوظة رياضة'));
  assert.ok(!t.calls.some(c => c.play !== undefined), 'delete mode must not start playback');
});

test('delete mode refuses ordinary channels', () => {
  const t = makePage({ saved: [SPORT] });
  t.Live.open();
  t.keys('ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ok', 'ArrowDown', 'ok');
  assert.deepStrictEqual(t.calls, []);
});

test('websites folder opens the site and is left out of the player list', () => {
  const t = makePage({ settings: { chSites: 'https://tv.example/ https://x.example/' } });
  t.Live.open();
  assert.ok(t.cats().includes('مواقع القنوات') || (t.goCat('مواقع القنوات'), true));
  t.goCat('مواقع القنوات');
  assert.deepStrictEqual(t.names(), ['tv.example', 'x.example']);
  t.keys('ok');
  assert.deepStrictEqual(t.calls, ['open https://tv.example/']);
  // a normal channel played afterwards must not carry the sites folder
  const t2 = makePage({ settings: { chSites: 'https://tv.example/' } });
  t2.Live.open();
  t2.keys('ok');
  const play = t2.calls.find(c => c.play !== undefined);
  assert.ok(play && !play.pack.folders.some(f => f.n === 'مواقع القنوات'));
  assert.ok(!play.pack.list.some(c => c.u === 'https://tv.example/'));
});

test('no websites folder without sites', () => {
  const t = makePage();
  t.Live.open();
  t.keys('ArrowRight');
  for (let i = 0; i < 60; i++) t.keys('ArrowDown');
  assert.ok(!t.cats().includes('مواقع القنوات'));
});

test('private M3U text becomes a folder with its channels', () => {
  const m3u = '#EXTM3U\n#EXTINF:-1 group-title="رياضة" tvg-logo="http://l/x.png",قناتي الأولى\nhttp://p/1.m3u8\n#EXTINF:-1,قناتي الثانية\nhttp://p/2.m3u8\n';
  const t = makePage({ settings: { myM3u: m3u } });
  t.Live.open();
  t.goCat('📁 قنواتي الخاصة');
  assert.deepStrictEqual(t.names(), ['قنواتي المضافة']);
  t.keys('ok');
  assert.deepStrictEqual(t.names(), ['قناتي الأولى', 'قناتي الثانية']);
});

test('a link to a list is read as a list, not shown as a channel', () => {
  const t = makePage({ settings: { myM3u: 'https://example.com/sports.m3u' } });
  t.Live.open();
  t.goCat('📁 قنواتي الخاصة');
  assert.deepStrictEqual(t.names(), ['sports']);       // a folder named after the list
});

test('search finds channels by name, saved ones included', () => {
  const t = makePage({ saved: [SPORT] });
  t.Live.open();
  t.Live.search('محفوظة');
  assert.deepStrictEqual(t.names(), ['قناة محفوظة رياضة']);
});
