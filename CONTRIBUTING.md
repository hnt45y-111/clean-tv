# Contributing / المساهمة

Thanks for helping improve Clean TV (مدير الشاشات).

## Ways to help
- Report bugs, with device brand + model + Android version and steps to reproduce.
- Add themes to `gallery/` (a `.jpg` preview + `.json`, then an entry in `gallery/index.json`).
- Improve Arabic/English text and localization.
- Performance fixes for low-end TV hardware.
- Tests and documentation.

## Workflow
1. Open an issue first for larger changes.
2. Fork, create a branch, make focused commits.
3. Build the app you changed (`gradle assembleDebug --no-daemon`) and run the Node tests (`node tests/*.test.js`; `npm test` in `Mafia/server`).
4. Open a pull request describing what changed and how you tested it.

## Rules
- UI must stay RTL-first and keep the shared identity (colors, fonts, corner shapes).
- Only add channels from official, publicly available streams; never add pirated or credential-protected sources.
- Do not commit secrets, keys, or personal data.
- By contributing you agree your work is released under the MIT License.

---

## بالعربي
- بلّغ عن الأخطاء مع اسم الجهاز وموديله وإصدار أندرويد.
- أضف ثيمات لمجلد `gallery/`، أو حسّن النصوص والترجمة والأداء والتوثيق.
- افتح Issue قبل التعديلات الكبيرة، وافتح Pull Request مع شرح ما تغيّر وكيف جرّبته.
- الواجهة تبقى RTL وبنفس الهوية. القنوات من بث رسمي عام فقط، بدون مصادر مقرصنة.
- مساهمتك تنزل تحت رخصة MIT.
