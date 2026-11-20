'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../Studio/app/src/main/assets/smart.js'), 'utf8');
function load(map) {
  const calls = [];
  const sb = { window: {}, console, JSON, decodeURIComponent, encodeURIComponent, Date, Set, Object, String, Promise };
  sb.window.__direct = (op, a) => { calls.push(a.url); for (const k in map) if (a.url.indexOf(k) >= 0) return Promise.resolve(JSON.stringify(map[k])); return Promise.resolve(JSON.stringify({ err: 'ما لگيت عنوان الخادم', ms: 5 })); };
  vm.createContext(sb); vm.runInContext(SRC, sb); return { S: sb.window.SmartLink, calls };
}
test('رابط حساب Xtream شغّال: يتعرف عليه ويضيفه للقنوات والأفلام', async () => {
  const { S } = load({ 'player_api.php': { code: 200, type: 'application/json', ms: 40, head: '{"user_info":{"auth":1,"exp_date":"1900000000","max_connections":"2"}}' } });
  const r = await S.identify('http://srv.test:8080/get.php?username=u1&password=p1&type=m3u_plus');
  assert.strictEqual(r.kind, 'xtream'); const set = {}; r.apply(set, 'both');
  assert.strictEqual(set.xtream.host, 'http://srv.test:8080'); assert.strictEqual(set.xtream.user, 'u1'); assert.ok(set.xtream.live && set.xtream.vod);
  assert.ok(!S.logText(r).includes('p1'), 'كلمة المرور ما تطلع بالتشخيص');
});
test('دخول Xtream مرفوض', async () => {
  const { S } = load({ 'player_api.php': { code: 200, type: 'application/json', head: '{"user_info":{"auth":0}}' } });
  const r = await S.identify('http://srv.test/get.php?username=u&password=bad'); assert.strictEqual(r.kind, 'xtream-bad'); assert.strictEqual(r.apply, null);
});
test('قائمة M3U: يتعرف ويضيفها للأفلام أو القنوات', async () => {
  const { S } = load({ 'list.test/my.m3u': { code: 200, type: 'audio/x-mpegurl', head: '#EXTM3U\n#EXTINF:-1 group-title="أفلام",فيلم أ\nhttp://x/a.mp4\n' } });
  const r = await S.identify('http://list.test/my.m3u'); assert.strictEqual(r.kind, 'm3u');
  const set = {}; r.apply(set, 'vod'); assert.strictEqual(set.vodLinks, 'http://list.test/my.m3u'); assert.ok(!set.myM3u);
  const set2 = {}; r.apply(set2, 'live'); assert.strictEqual(set2.myM3u, 'http://list.test/my.m3u');
});
test('رابط فيديو مباشر', async () => {
  const { S } = load({ 'cdn.test/a.mp4': { code: 200, type: 'video/mp4', head: '' } });
  const r = await S.identify('http://cdn.test/a.mp4'); assert.strictEqual(r.kind, 'file'); const set = {}; r.apply(set); assert.strictEqual(set.vodItems[0].u, 'http://cdn.test/a.mp4');
});
test('صفحة موقع: يقول إنه ما يقدر يضيفها، و403 يوصف بدقة، وما ينكتب شي غلط', async () => {
  let { S } = load({ 'site.test': { code: 200, type: 'text/html', head: '<html><title>موقع أفلام</title>' } });
  let r = await S.identify('http://site.test/movies'); assert.strictEqual(r.kind, 'web'); assert.strictEqual(r.apply, null);
  ({ S } = load({ 'blk.test': { code: 403, type: 'text/html', head: 'Cloudflare Website Access Blocked' } }));
  r = await S.identify('http://blk.test/x'); assert.strictEqual(r.kind, 'blocked');
  assert.strictEqual((await S.identify('مو رابط')).kind, 'bad');
});
