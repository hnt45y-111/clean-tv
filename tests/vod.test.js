'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../CleanTV/app/src/main/assets/vod.js'), 'utf8');
function el() { const o = { innerHTML: '', textContent: '', style: {}, clientHeight: 800, classList: { add() {}, remove() {} }, querySelector() { return null; } }; return o; }
function page(settings, fetchMap) {
  const els = {}, played = [], store = {};
  const sb = {
    document: { getElementById: (i) => els[i] || (els[i] = el()) }, console,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    Android: { playLive: (j, i) => played.push(JSON.parse(j)) },
    __getSettings: () => settings, __setLayer() {}, __closeVod() { sb.closed = true; },
    __fetchText: (u) => { for (const k in fetchMap) if (u.indexOf(k) >= 0) return Promise.resolve(fetchMap[k]); return Promise.resolve('ERR'); },
    setTimeout, Promise, Date, JSON
  };
  sb.window = sb; vm.createContext(sb); vm.runInContext(SRC, sb);
  return { sb, els, played };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
test('الروابط: اسم | رابط، أرشيف، يوتيوب، ملف مباشر', () => {
  const { sb } = page({}, {});
  const r = sb.Vod._t.parseLinks('فيلم أ | https://x.test/a.mp4\nhttps://archive.org/details/abc\nhttps://youtu.be/xyz\nنص عادي\nhttps://x.test/page.html');
  assert.strictEqual(r.map((x) => x.t).join(), 'url,ia,yt');
  assert.strictEqual(r[0].n, 'فيلم أ'); assert.strictEqual(r[1].id, 'abc');
});
test('الأقسام الافتراضية والاسم المخصص', async () => {
  const { sb, els } = page({ vodName: 'سينما' }, { 'advancedsearch': JSON.stringify({ response: { docs: [{ identifier: 'f1', title: 'فيلم قديم', year: 1950 }] } }) });
  sb.Vod.open(); await tick();
  assert.strictEqual(els.vdTitle.textContent, 'سينما');
  assert.strictEqual(sb.Vod._t.state.secs.length, 5);
  assert.match(els.vdGrid.innerHTML, /فيلم قديم/);
});
test('تشغيل عنصر أرشيف يختار ملف mp4', async () => {
  const meta = JSON.stringify({ files: [{ name: 'a.ogv', format: 'Ogg Video' }, { name: 'a.mp4', format: 'h.264', size: '10' }] });
  const { sb, played } = page({}, { 'advancedsearch': JSON.stringify({ response: { docs: [{ identifier: 'f1', title: 'T' }] } }), 'archive.org/metadata/f1': meta });
  sb.Vod.open(); await tick(); sb.Vod.key('ok'); sb.Vod.key('ok'); await tick();
  assert.strictEqual(played.length, 1); assert.strictEqual(played[0].vod, 1);
  assert.strictEqual(played[0].list[0].u, 'https://archive.org/download/f1/a.mp4');
});
test('قسم فاضي يعرض الرسالة، ورجوع يغلق', async () => {
  const { sb, els } = page({}, {});
  sb.Vod.open(); await tick(); sb.Vod.key('ArrowUp'); sb.Vod.key('ArrowDown'); await tick();
  assert.match(els.vdGrid.innerHTML, /vd-empty/);
  sb.Vod.key('back'); assert.ok(sb.closed);
});
test('حساب Xtream: فيلم ومسلسل بحلقاته', async () => {
  const x = { host: 'srv.test:8080', user: 'u', pass: 'p' };
  const { sb, played } = page({ xtream: x, vodSections: [] }, {
    'action=get_vod_categories': '[{"category_id":"1","category_name":"أكشن"}]', 'action=get_vod_streams': '[{"stream_id":7,"name":"فلم","category_id":"1","container_extension":"mkv"}]',
    'action=get_series_categories': '[]', 'action=get_series': '[]'
  });
  sb.Vod.open(); await tick();
  const i = sb.Vod._t.state.secs.findIndex((s) => s.id === 'xm1'); assert.ok(i >= 0);
  for (let k = 0; k < i; k++) sb.Vod.key('ArrowDown');
  await tick(); sb.Vod.key('ArrowLeft'); sb.Vod.key('ok'); await tick();
  assert.strictEqual(played[0].list[0].u, 'http://srv.test:8080/movie/u/p/7.mkv');
});
