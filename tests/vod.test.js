'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../CleanTV/app/src/main/assets/vod.js'), 'utf8');
function el() { return { innerHTML: '', textContent: '', value: '', style: {}, children: [], clientHeight: 800, classList: { add() {}, remove() {}, toggle() {} }, querySelector() { return null; }, setAttribute() {}, addEventListener() {}, focus() {}, blur() {} }; }
function page(settings, fetchMap) {
  const els = {}, played = [], store = {}, asked = [];
  const sb = {
    document: { getElementById: (i) => els[i] || (els[i] = el()), addEventListener() {} }, console,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    Android: { playLive: (j) => played.push(JSON.parse(j)), getPref: () => '' },
    __getSettings: () => settings, __setLayer() {}, __closeVod() { sb.closed = true; }, toastMsg() {},
    __fetchText: (u) => { asked.push(u); for (const k in fetchMap) if (u.indexOf(k) >= 0) return Promise.resolve(fetchMap[k]); return Promise.resolve('ERR:رد الخادم 403'); },
    setTimeout, setInterval, clearInterval, clearTimeout, Promise, Date, JSON, Math, Object, String
  };
  sb.window = sb; vm.createContext(sb); vm.runInContext(SRC, sb);
  return { sb, els, played, asked, store };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
const X = { host: 'srv.test:8080', user: 'u', pass: 'p' };
const MAP = {
  'action=get_vod_categories': '[{"category_id":"1","category_name":"أكشن"},{"category_id":"2","category_name":"كوميدي"}]',
  'action=get_vod_streams': '[{"stream_id":7,"name":"فلم أ","category_id":"1","container_extension":"mkv"},{"stream_id":8,"name":"فلم ب","category_id":"2"}]',
  'action=get_series_categories': '[{"category_id":"9","category_name":"دراما"}]',
  'action=get_series&': '[]', 'action=get_series_info': '{"episodes":{"1":[{"id":"55","episode_num":1,"title":"البداية","container_extension":"mp4"}]}}',
  'action=get_series': '[{"series_id":3,"name":"مسلسل ج","category_id":"9"}]'
};
test('بدون حساب: رسالة تدل على إضافة حساب IPTV ولا يطلب أي مصدر آخر', async () => {
  const { sb, els, asked } = page({ vodName: 'سينما' }, {});
  sb.Vod.open(); await tick();
  assert.strictEqual(els.vdTitle.textContent, 'سينما');
  assert.match(els.vdGrid.innerHTML, /حساب IPTV/);
  assert.strictEqual(asked.length, 0);
});
test('الأفلام من الحساب فقط، بتصنيفاتها، وتشتغل برابط الحساب', async () => {
  const { sb, els, played, asked } = page({ xtream: X }, MAP);
  sb.Vod.open(); await tick();
  assert.ok(asked.every((u) => u.indexOf('http://srv.test:8080/player_api.php') === 0));
  assert.match(els.vdSecs.innerHTML, /الكل \(2\)/); assert.match(els.vdSecs.innerHTML, /أكشن/);
  sb.Vod.key('ArrowDown'); sb.Vod.key('ArrowDown');           // tabs -> categories -> «أكشن»
  assert.strictEqual(sb.Vod._t.state.list.length, 1);
  sb.Vod.key('ok'); sb.Vod.key('ok');
  assert.strictEqual(played[0].vod, 1); assert.strictEqual(played[0].list[0].u, 'http://srv.test:8080/movie/u/p/7.mkv');
});
test('المسلسل يفتح حلقاته والحلقة تشتغل، ورجوع يرجّع للقائمة', async () => {
  const { sb, played } = page({ xtream: X }, MAP);
  sb.Vod.open(); await tick();
  sb.Vod.key('ArrowLeft'); sb.Vod.key('ok');                   // the series tab
  sb.Vod.key('ArrowDown'); sb.Vod.key('ok'); sb.Vod.key('ok'); await tick();
  assert.strictEqual(sb.Vod._t.state.list[0].t, 'xe');
  sb.Vod.key('ok');
  assert.strictEqual(played[0].list[0].u, 'http://srv.test:8080/series/u/p/55.mp4');
  sb.Vod.key('back'); assert.strictEqual(sb.Vod._t.state.list[0].t, 'xs');
});
test('المفضلة والتحديث والخروج', async () => {
  const { sb, els, played, asked, store } = page({ xtream: X }, MAP);
  sb.Vod.open(); await tick();
  for (let i = 0; i < 4; i++) sb.Vod.key('ArrowLeft'); sb.Vod.key('ok');      // «إضافة للمفضلة»
  sb.Vod.key('ArrowDown'); sb.Vod.key('ok'); sb.Vod.key('ok');
  assert.strictEqual(played.length, 0); assert.strictEqual(JSON.parse(store.vodFav).length, 1);
  sb.Vod.key('back'); sb.Vod.key('back');
  const before = asked.length; sb.Vod.key('ArrowLeft'); sb.Vod.key('ArrowLeft'); sb.Vod.key('ok'); await tick();     // «تحديث» (بعد «وضع السينما»)
  assert.ok(asked.length > before);
  sb.Vod.key('back'); assert.ok(sb.closed);
});
test('حساب مرفوض: تظهر رسالة الخطأ', async () => {
  const { sb, els } = page({ xtream: X }, {});
  sb.Vod.open(); await tick();
  assert.match(els.vdGrid.innerHTML, /403/);
});
test('وضع السينما: زر واحد يشغّله، وستارة وعدّ تنازلي قبل كل فيلم', async () => {
  const { sb, els, played, store } = page({ xtream: X }, MAP);
  sb.Vod.open(); await tick();
  for (let i = 0; i < 5; i++) sb.Vod.key('ArrowLeft'); sb.Vod.key('ok');      // «وضع السينما»
  assert.strictEqual(store.vodCinema, '1');
  assert.match(els.vdTabs.innerHTML, /وضع السينما/);
  sb.Vod.key('ArrowDown'); sb.Vod.key('ok'); sb.Vod.key('ok');      // tab -> cat -> grid -> play
  assert.strictEqual(played.length, 0, 'الفيلم ما يبدأ قبل ما تخلص الستارة');
  await new Promise((r) => setTimeout(r, 3100));
  assert.strictEqual(played.length, 1, 'الفيلم يبدأ بعد ما تفتح الستارة');
});
