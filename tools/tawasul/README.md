# «تواصل» — الخلفية

الخلفية على Supabase (مشروع `massar`): جداول `tawasul_*` + دالة `tawasul` (Edge Function، `verify_jwt=false`) + حذف كل ساعة.
`schema.sql` يشرح الجداول، والدالة نفسها منشورة على المشروع (`/functions/v1/tawasul`).

- كل جهاز عنده رمز علني (١٠ رموز) وتوكن سري؛ السيرفر يخزّن هاش التوكن فقط.
- الرسائل والملفات تنحذف بعد ٢٤ ساعة افتراضياً، أو أسبوع / شهر / بدون حذف حسب اختيار المرسل لكل محادثة (الدالة + cron).
- مسارات النسخة ٢: `sign` (رابط جديد للملف) `read` (قُرئت) `del` (حذف عند الطرفين) `pin` (تثبيت نص على شاشة المستلم) `typing` `snap` (طلب لقطة شاشة، الشاشة تقرر) `profile-set/get` `profiles`. ردّ `inbox` يحمل `sync` (علامات الاستلام، المثبّت، المحذوف، الكتابة) وتتغير `sig` عند أي تغيير فتنفك الاستعلامة الطويلة فوراً.
- الاختبار على السيرفر الحقيقي: `NODE_USE_ENV_PROXY=1 TW_E2E=1 node --test --test-name-pattern=E2E tests/tw-core.test.js`

## الإشعارات الفورية (Firebase Cloud Messaging)
- مشروع Firebase: `tawasul-8a478`، والتطبيق `com.cleantv.tawasul` (ملف `Tawasul/app/google-services.json` تعريف عام وليس سراً).
- الموبايل يسجّل رمز الإشعار بالمسار `push-token`، والدالة ترسل إشعار data عند وصول رسالة.
- المفتاح السري `FCM_SERVICE_ACCOUNT` (JSON حساب الخدمة) يوضع في Supabase: Edge Functions ← Secrets. بدونه ما يرسل شي والتطبيق يرجع للفحص كل ١٥ دقيقة.
- الكود الكامل للدالة بالملف `function.ts`.
