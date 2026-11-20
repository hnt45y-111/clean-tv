// طبقة الاتصال بالخادم وحالة الجلسة
export const S = { user: null, extra: {}, meta: null, unread: 0 };
const tk = () => { try { return localStorage.getItem('dt_token'); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem('dt_token', t) : localStorage.removeItem('dt_token'); } catch {} };
export const hasToken = () => !!tk();

export async function api(method, path, body) {
  let r;
  try {
    r = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(tk() ? { authorization: 'Bearer ' + tk() } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('النت ضعيف، جرّب مرة ثانية'); }
  let j = {}; try { j = await r.json(); } catch {}
  if (r.status === 401 && tk()) { setToken(null); S.user = null; location.hash = '#/login'; }
  if (!r.ok) throw Object.assign(new Error(j.error || `خطأ (${r.status})`), { status: r.status });
  return j;
}
export const get = (p) => api('GET', p);
export const post = (p, b = {}) => api('POST', p, b);
export const put = (p, b = {}) => api('PUT', p, b);
export const del = (p) => api('DELETE', p);

export async function loadMe() {
  const j = await get('/me');
  S.user = j.user; S.extra = { doctor: j.doctor, pharmacy: j.pharmacy }; S.unread = j.unread;
  return j;
}
export async function loadMeta() { if (!S.meta) S.meta = await get('/meta'); return S.meta; }
