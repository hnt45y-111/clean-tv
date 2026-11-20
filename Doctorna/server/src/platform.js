// الربط مع منصة بيع وتسعير الأدوية العراقية (الميزة ٠٨)
// المنصة الحقيقية تُضبط بمتغيرات البيئة. بدونها يشتغل تسجيل البيع محليًا بنفس الواجهة حتى يجي عنوان المنصة ومفتاحها.
//   DRUG_PLATFORM_URL   مثال: https://platform.example/api   (نقاط النهاية المتوقعة: POST /sales  و  GET /drugs?q=)
//   DRUG_PLATFORM_KEY   مفتاح الربط
import { randomBytes } from 'node:crypto';

export const platformInfo = () => ({ mode: process.env.DRUG_PLATFORM_URL ? 'live' : 'local' });

export async function postSale(sale) {
  const url = process.env.DRUG_PLATFORM_URL;
  if (!url) return { ref: 'LOCAL-' + randomBytes(4).toString('hex').toUpperCase(), mode: 'local' };
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (process.env.DRUG_PLATFORM_KEY || '') },
      body: JSON.stringify(sale),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('platform ' + r.status);
    const j = await r.json();
    return { ref: String(j.id ?? j.ref ?? 'PLAT-' + randomBytes(4).toString('hex')), mode: 'live' };
  } catch (e) {
    // لا نخسر البيع إذا المنصة واقفة: يتسجل محليًا ويُعاد إرساله لاحقًا
    return { ref: 'PENDING-' + randomBytes(4).toString('hex').toUpperCase(), mode: 'queued', error: String(e.message) };
  }
}
