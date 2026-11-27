# «تواصل» — الخلفية

الخلفية على Supabase (مشروع `massar`): جداول `tawasul_*` + دالة `tawasul` (Edge Function، `verify_jwt=false`) + حذف كل ساعة.
`schema.sql` يشرح الجداول، والدالة نفسها منشورة على المشروع (`/functions/v1/tawasul`).

- كل جهاز عنده رمز علني (١٠ رموز) وتوكن سري؛ السيرفر يخزّن هاش التوكن فقط.
- الرسائل والملفات تنحذف بعد ٢٤ ساعة (الدالة + cron).
- الاختبار على السيرفر الحقيقي: `NODE_USE_ENV_PROXY=1 TW_E2E=1 node --test --test-name-pattern=E2E tests/tw-core.test.js`
