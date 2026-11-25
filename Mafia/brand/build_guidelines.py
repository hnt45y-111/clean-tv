"""يولّد صفحات دليل الهوية البصرية (HTML بمقاس A4 بالمليمتر) ثم يُطبع PDF عبر brand/render_pdf.cjs.
الاستعمال (من مجلد Mafia): python3 brand/build_guidelines.py && node brand/render_pdf.cjs
الدليل للهوية فقط: الفكرة، الشعار، الألوان، الخطوط، الأشكال والزوايا، المقاسات، أمثلة الاستعمال."""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
ICONS = json.load(open(os.path.join(ROOT, 'icons.json'), encoding='utf-8'))

C = dict(midnight='#080A12', navy='#10182B', navy3='#172240', silver='#DCE5F5', crimson='#D9233C', blue='#2478E8',
         emerald='#21A875', violet='#A45BE7', gold='#E8AE42')

CHARS = [
    ('mafia', 'المافيا', 'Mafia', C['crimson'], 'قبعة', 'بدلة سوداء بثلاث قطع وربطة عنق حمراء ومنديل جيب أحمر، جالس على أريكة جلدية، وخلفه قمر دموي وظلال رجال العصابة.'),
    ('doctor', 'طبيب المدينة', 'City Doctor', C['emerald'], 'صليب طبي', 'معطف أبيض وسماعة طبية ونظارات، ذراعان متقاطعتان، وخلفه خط نبض قلب وصليب أخضر.'),
    ('mafia_doctor', 'طبيب المافيا', 'Mafia Doctor', C['crimson'], 'حقنة', 'كمامة سوداء ومعطف داكن طويل وحقنة في يده، في أجواء المدينة الحمراء.'),
    ('detective', 'المحقق', 'Detective', C['blue'], 'عدسة مكبّرة', 'قبعة فيدورا ومعطف أزرق داكن وعدسة مكبّرة، تحت سماء المدينة الليلية الزرقاء.'),
    ('sniper', 'القناص', 'Sniper', C['violet'], 'منظار تصويب', 'قلنسوة بنفسجية وبندقية بمنظار، يصوّب نحو الأمام، وخلفه قمر بنفسجي.'),
    ('citizen', 'المواطن', 'Citizen', C['gold'], 'أشخاص', 'سترة سوداء فوق كنزة فاتحة بقلنسوة، ذراعان متقاطعتان، ومدينة ذهبية في الخلفية.'),
    ('super_citizen', 'المواطن سوبر', 'Super Citizen', C['gold'], 'نجمة', 'زيّ داكن بنجمة حمراء ذهبية على الصدر ورداء أحمر، بإضاءة ذهبية قوية.'),
    ('narrator', 'الراوي', 'Narrator', C['silver'], 'تاج', 'بدلة سهرة وربطة فراشة ولحية مهذّبة، يحمل بطاقة بتاج ذهبي، في مدينة فضية تحت المطر.'),
    ('negotiator', 'المفاوض', 'Negotiator', C['gold'], 'مصافحة', 'قميص أسود وربطة خمرية وساعة ذهبية، يتأمل ويده على ذقنه، بين الذهبي والأحمر.'),
    ('bodyguard', 'الحارس', 'Bodyguard', C['blue'], 'درع', 'نظارة شمسية وسماعة أذن وبدلة سوداء، يقبض يده على صدره، في المدينة الزرقاء.'),
    ('witch', 'الساحرة', 'Witch', C['violet'], 'قارورة', 'عباءة بنفسجية بقلنسوة وشعر أسود طويل، تحمل قارورة جرعة متوهجة.'),
    ('mayor', 'العمدة', 'Mayor', C['gold'], 'مبنى بأعمدة', 'شعر رمادي ولحية، قلادة ذهبية رسمية وربطة حمراء، أمام برج الساعة الذهبي.'),
]

PALETTE_BASE = [
    ('Midnight Black', 'أسود منتصف الليل', C['midnight'], 'الخلفية الأساسية لكل الشاشات والمطبوعات'),
    ('Deep Navy', 'كحلي عميق', C['navy'], 'الأسطح الثانوية واللوحات المنبثقة'),
    ('Night Steel', 'فولاذ الليل', C['navy3'], 'خلفية الصور الرمزية والعناصر المرتفعة'),
    ('Premium Silver', 'فضي فاخر', C['silver'], 'النصوص والتفاصيل، وهوية الراوي'),
]
PALETTE_ROLES = [
    ('Mafia Crimson', 'قرمزي المافيا', C['crimson'], 'المافيا وطبيب المافيا، الخطر، الزر الرئيسي'),
    ('Detective Blue', 'أزرق المحقق', C['blue'], 'المحقق والحارس، التحقيق، الإجراءات الثانوية'),
    ('Doctor Emerald', 'زمرّدي الطبيب', C['emerald'], 'طبيب المدينة، النجاة، التأكيد والنجاح'),
    ('Sniper Violet', 'بنفسجي القناص', C['violet'], 'القناص والساحرة، الأدوار السرية، الليل'),
    ('Citizen Gold', 'ذهبي المواطن', C['gold'], 'المواطن والمواطن سوبر والمفاوض والعمدة، التصويت، الجوائز'),
]
GOLD_METAL = ['#FFF4D6', '#F3C567', '#B9801C', '#F7D98A', '#9A6512']


def rgb(h):
    h = h.lstrip('#'); return ', '.join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def icon(name, size='8mm', color='currentColor', sw=1.8):
    return f'<svg viewBox="0 0 24 24" style="width:{size};height:{size}" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{ICONS.get(name, "")}</svg>'


from PIL import Image
CACHE = os.path.join(ROOT, '.pdf-cache'); os.makedirs(CACHE, exist_ok=True)
def jpg(rel, bg='#080A12', maxw=900, q=84):
    """يحوّل صورة (نسبةً لمجلد brand) إلى JPG فوق لون الخلفية، ويعيد المسار النسبي"""
    src = os.path.normpath(os.path.join(ROOT, rel)); name = re.sub(r'[^a-z0-9_]+', '_', rel.lower()) + '_' + bg.strip('#') + f'_{maxw}.jpg'
    out = os.path.join(CACHE, name)
    if not os.path.exists(out):
        im = Image.open(src).convert('RGBA'); im.thumbnail((maxw, maxw * 3), Image.LANCZOS)
        base = Image.new('RGBA', im.size, bg); base.alpha_composite(im); base.convert('RGB').save(out, quality=q, optimize=True)
    return '.pdf-cache/' + name

pages = []
page_no = [0]


def page(title_ar, title_en, num, body, cls=''):
    page_no[0] += 1
    head = '' if not title_ar else f'''<header class="ph"><div class="num">{num}</div><div><div class="en">{title_en}</div><h2>{title_ar}</h2></div></header>'''
    pages.append(f'''<section class="page {cls}">{head}<div class="body">{body}</div>
<footer class="pf"><span>MAFIA · دليل الهوية البصرية</span><span class="n">{page_no[0]:02d}</span></footer></section>''')


# 0. الغلاف
pages.append('''<section class="page cover">
<div class="cover-glow"></div>
<img class="cover-logo" src="logo/mafia-logo-primary.png">
<div class="cover-title">MAFIA GAME<br><span>VISUAL IDENTITY GUIDELINES</span></div>
<div class="cover-ar">دليل الهوية البصرية</div>
<div class="cover-strip">''' + ''.join(f'<img src="{jpg(f'../client/assets/characters/cards/{k}.webp', maxw=520)}">' for k in ['sniper', 'doctor', 'mafia', 'detective', 'citizen']) + '''</div>
<div class="cover-meta">الإصدار 1.0 · 2026</div></section>''')
page_no[0] += 1

# الفهرس
toc = ['الفكرة والاتجاه البصري', 'الشعار', 'نسخ الشعار وقواعده', 'لوحة الألوان', 'الخطوط', 'مجموعة الشخصيات', 'ألوان الشخصيات وهوياتها',
       'نظام الأيقونات', 'لغة عناصر الواجهة', 'نظام البطاقات', 'مبادئ الحركة', 'إرشادات الحركة والمؤثرات', 'الخلفيات والأنماط', 'أمثلة من شاشات اللعبة',
       'مبادئ التجاوب', 'قواعد الاستعمال']
page('المحتويات', 'CONTENTS', '00', '<ol class="toc">' + ''.join(f'<li><b>{i + 1:02d}</b><span>{t}</span></li>' for i, t in enumerate(toc)) + '</ol>')

# 1. الفكرة
page('الفكرة والاتجاه البصري', 'BRAND CONCEPT', '01', f'''
<p class="lead">مافيا لعبة جماعية بطابع <b>أنمي سينمائي</b>: مدينة ليلية تحت قمر أحمر، شخصيات بملامح حادّة وألوان أدوار واضحة، وواجهة <b>إنفوجرافيك</b> نظيفة تشرح اللعب دون ازدحام.</p>
<div class="pillars">
 <div><h3>نوار سينمائي</h3><p>ظلام عميق، إضاءة جانبية، ظلال رجال العصابة، وقمر وسماء مدينة في كل مشهد.</p></div>
 <div><h3>شخصيات أنمي</h3><p>اثنتا عشرة شخصية ثابتة الملامح والأزياء، لكل منها لون وأيقونة لا يتغيران.</p></div>
 <div><h3>إنفوجرافيك فاخر</h3><p>بطاقات مشطوفة الزوايا، أرقام واضحة، مؤشرات وعدادات، وأيقونات خطّية موحّدة.</p></div>
</div>
<div class="mood">''' + ''.join(f'<img src="{jpg(f'../client/assets/characters/portraits/{k}.webp', maxw=420)}">' for k in ['mafia', 'detective', 'witch', 'mayor']) + '''</div>
<div class="kw">''' + ''.join(f'<span>{w}</span>' for w in ['غموض', 'فخامة', 'توتر', 'ليل المدينة', 'ذهب وقرمزي', 'وضوح']) + '''</div>''')

# 2. الشعار
page('الشعار', 'LOGO', '02', '''
<div class="logo-hero"><img src="logo/mafia-logo-primary-on-dark.png"></div>
<div class="grid3 small-cards">
 <div class="spec"><h4>الشارة</h4><p>بطاقة ثُمانية مشطوفة الزوايا بإطار ذهبي معدني، تضم شخصية «المافيا» من مجموعة الشخصيات دون تعديل على ملامحها.</p></div>
 <div class="spec"><h4>الجوهرة</h4><p>معيّن قرمزي بحدّ ذهبي يتوسط أسفل الإطار، رمز الدم والولاء.</p></div>
 <div class="spec"><h4>الاسم</h4><p>«MAFIA» بخط Cinzel الأسود بتدرّج ذهبي ومسافة حروف واسعة، وتحته «مافيا» بخط ريم كوفي.</p></div>
</div>''')

# 3. نسخ الشعار
page('نسخ الشعار وقواعده', 'LOGO VARIATIONS & CLEAR SPACE', '03', '''
<div class="var-grid">
 <figure><div class="vbox dark"><img src="logo/mafia-logo-horizontal.png" style="width:150mm"></div><figcaption>الأفقي: للترويسات والشاشات العريضة</figcaption></figure>
 <figure class="half"><div class="vbox dark"><img src="logo/mafia-logo-mark.png" style="height:62mm"></div><figcaption>الرمز: أيقونة التطبيق والصورة الرمزية</figcaption></figure>
 <figure class="half"><div class="vbox navy"><img src="logo/mafia-logo-wordmark.png" style="width:70mm"></div><figcaption>الاسم وحده: عند صغر المساحة</figcaption></figure>
 <figure class="half"><div class="vbox crimson"><img src="logo/mafia-logo-mono.png" style="width:60mm"></div><figcaption>أحادي اللون (أبيض) فوق القرمزي أو الصور</figcaption></figure>
 <figure class="half"><div class="vbox dark clear"><div class="cs"><img src="logo/mafia-logo-mark.png" style="height:40mm"></div></div><figcaption>المساحة الحرّة حول الشعار = ربع عرض الشارة من كل جهة</figcaption></figure>
</div>
<table class="specs"><tr><th>النسخة</th><th>أصغر عرض مطبوع</th><th>أصغر عرض على الشاشة</th></tr>
<tr><td>الأساسي</td><td>30 مم</td><td>120 بكسل</td></tr><tr><td>الأفقي</td><td>45 مم</td><td>180 بكسل</td></tr>
<tr><td>الرمز</td><td>12 مم</td><td>48 بكسل</td></tr><tr><td>الاسم وحده</td><td>25 مم</td><td>96 بكسل</td></tr></table>''')

# 4. الألوان
sw = lambda name_en, name_ar, hx, use, big=False: f'''<div class="sw {'big' if big else ''}"><div class="chip" style="background:{hx}"></div><div class="meta"><b>{name_ar}</b><span class="en">{name_en}</span><span class="code">HEX {hx}</span><span class="code">RGB {rgb(hx)}</span><span class="use">{use}</span></div></div>'''
page('لوحة الألوان', 'COLOR SYSTEM', '04', '<h3 class="sub">الأساس الداكن</h3><div class="sw-grid">' + ''.join(sw(*p, big=True) for p in PALETTE_BASE) + '</div>'
     + '<h3 class="sub">ألوان الأدوار</h3><div class="sw-grid five">' + ''.join(sw(*p) for p in PALETTE_ROLES) + '</div>'
     + '<h3 class="sub">الذهب المعدني (الشعار والجوائز)</h3><div class="metal"><div class="bar" style="background:linear-gradient(90deg,' + ','.join(GOLD_METAL) + ')"></div><div class="stops">'
     + ''.join(f'<span>{g}</span>' for g in GOLD_METAL) + '</div></div>'
     + '<p class="note">النِّسب: 70% أساس داكن · 20% فضي للنصوص · 10% لون الدور. لون الدور يُستخدم للإبراز فقط، ولا يُستخدم خلفيةً لمساحات كبيرة.</p>')

# 5. الخطوط
page('الخطوط', 'TYPOGRAPHY', '05', '''
<div class="type-row"><div class="tlabel"><b>ريم كوفي</b><span>Reem Kufi · العناوين العربية</span></div><div class="tsample rk">الليل يحلّ على المدينة</div></div>
<div class="type-row"><div class="tlabel"><b>تجوّل</b><span>Tajawal · النصوص والأزرار</span></div><div class="tsample tj">اختر ضحية الليلة واتفق مع زملائك قبل الفجر.</div></div>
<div class="type-row"><div class="tlabel"><b>Cinzel</b><span>العلامة والعناوين الإنجليزية</span></div><div class="tsample cz">MAFIA · THE NIGHT FALLS</div></div>
<table class="specs"><tr><th>المستوى</th><th>الخط والوزن</th><th>الحجم على الشاشة</th><th>الحجم المطبوع</th></tr>
<tr><td>عنوان كبير</td><td>ريم كوفي 700</td><td>28 بكسل</td><td>24 نقطة</td></tr>
<tr><td>عنوان قسم</td><td>ريم كوفي 700</td><td>20 بكسل</td><td>16 نقطة</td></tr>
<tr><td>نص أساسي</td><td>تجوّل 400–500</td><td>16 بكسل</td><td>10 نقاط</td></tr>
<tr><td>زر</td><td>تجوّل 700</td><td>16–18 بكسل</td><td>11 نقطة</td></tr>
<tr><td>ملاحظة</td><td>تجوّل 400</td><td>13 بكسل</td><td>8 نقاط</td></tr>
<tr><td>علامة إنجليزية</td><td>Cinzel 900، تباعد 14%</td><td>حسب الشعار</td><td>حسب الشعار</td></tr></table>
<p class="note">العربية هي لغة الواجهة دائماً، واتجاه الكتابة من اليمين إلى اليسار. الأرقام والمؤقتات ورقم اللاعب تُكتب بالأرقام الغربية وباتجاه يسار-يمين داخل السطر العربي.</p>''')

# 6–7. الشخصيات
def char_page(items, num, title):
    cells = ''.join(f'''<div class="ch"><img src="{jpg(f'../client/assets/characters/cards/{k}.webp', maxw=520)}"><div class="cn"><b style="color:{col}">{ar}</b><span>{en}</span></div></div>''' for k, ar, en, col, *_ in items)
    page(title, 'CHARACTER COLLECTION', num, f'<div class="ch-grid">{cells}</div>')
char_page(CHARS[:6], '06', 'مجموعة الشخصيات (1)')
char_page(CHARS[6:], '06', 'مجموعة الشخصيات (2)')

# 8. ألوان الشخصيات
rows = ''.join(f'''<tr><td><img class="av" src="{jpg(f'../client/assets/characters/avatars/{k}.webp', maxw=160)}"></td><td><b>{ar}</b><br><span class="en">{en}</span></td><td><span class="dot" style="background:{col}"></span><span class="code">{col}</span></td><td>{ic}</td><td class="desc">{d}</td></tr>''' for k, ar, en, col, ic, d in CHARS)
page('ألوان الشخصيات وهوياتها', 'CHARACTER IDENTITIES', '07', f'<table class="chars">{rows}</table><p class="note">ملامح كل شخصية وزيّها ولونها ثابتة في كل الشاشات والمطبوعات، ولا تُعاد رسمتها ولا يُغيَّر لونها.</p>')

# 9. الأيقونات
ui_icons = ['moon', 'sun', 'vote', 'mic', 'micoff', 'skull', 'shield', 'target', 'search', 'med', 'users', 'trophy', 'star', 'crown', 'qr', 'wifi', 'clock', 'eye', 'flag', 'gear']
page('نظام الأيقونات', 'ICONOGRAPHY', '08', '''
<h3 class="sub">أيقونات البطاقات (من مجموعة الشخصيات)</h3>
<div class="card-icons">''' + ''.join(f'<div><img src="{jpg(f'../client/assets/characters/cards/{k}.webp', maxw=520)}" style="object-position:0 100%"><span>{ic}</span></div>' for k, ar, en, col, ic, d in CHARS[:6]) + '''</div>
<h3 class="sub">أيقونات الواجهة</h3>
<div class="ui-icons">''' + ''.join(f'<div>{icon(n, "9mm", "#DCE5F5")}<span>{n}</span></div>' for n in ui_icons) + '''</div>
<table class="specs"><tr><th>القاعدة</th><th>القيمة</th></tr><tr><td>الشبكة</td><td>24 × 24 وحدة</td></tr><tr><td>سماكة الخط</td><td>1.8 وحدة، أطراف وزوايا مستديرة</td></tr>
<tr><td>اللون</td><td>فضي، أو لون الدور عند الإبراز</td></tr><tr><td>الحجم</td><td>16 / 22 / 30 بكسل (صغير / عادي / كبير)</td></tr></table>''')

# 10. عناصر الواجهة
page('لغة عناصر الواجهة', 'UI COMPONENTS', '09', f'''
<div class="ui-demo">
 <div class="row"><span class="btn primary">ابدأ الليل</span><span class="btn gold">تأكيد التصويت</span><span class="btn blue">المتحدث التالي</span><span class="btn green">أنا جاهز</span><span class="btn ghost">إلغاء</span></div>
 <div class="row"><span class="pill" style="--c:{C['crimson']}">المافيا</span><span class="pill" style="--c:{C['emerald']}">طبيب المدينة</span><span class="pill" style="--c:{C['blue']}">المحقق</span><span class="pill" style="--c:{C['violet']}">القناص</span><span class="pill" style="--c:{C['gold']}">المواطن</span></div>
 <div class="row two"><div class="ui-card"><div class="accent" style="background:{C['crimson']}"></div><b>بطاقة معلومات</b><p>سطح كحلي شفاف، حدّ فضي خافت، وشريط علوي بلون الدور.</p></div>
  <div class="ui-card"><div class="prow sp"><img src="../client/assets/characters/avatars/citizen.webp"><div><b>سالم</b><span>يتحدث الآن</span></div><div class="timer">1:42</div></div><div class="prow"><img src="../client/assets/characters/avatars/narrator.webp"><div><b>الراوي</b><span>متصل</span></div></div></div></div>
</div>
<table class="specs"><tr><th>العنصر</th><th>الشكل</th><th>المقاس على الشاشة</th></tr>
<tr><td>الزر الرئيسي</td><td>تدرّج قرمزي، زوايا 16، توهّج سفلي</td><td>ارتفاع 50–58 بكسل</td></tr>
<tr><td>البطاقة</td><td>زوايا 18، حدّ 1 بكسل فضي 12% شفافية</td><td>هامش داخلي 14 بكسل</td></tr>
<tr><td>شريحة الدور</td><td>كبسولة بلون الدور 14% وحدّ 50%</td><td>ارتفاع 24 بكسل</td></tr>
<tr><td>صف اللاعب</td><td>زوايا 14، صورة دائرية 46 بكسل</td><td>المتحدث: حدّ ذهبي ونبض</td></tr>
<tr><td>هامش الشاشة</td><td>—</td><td>16 بكسل + المنطقة الآمنة</td></tr></table>''')

# 11. البطاقات
page('نظام البطاقات', 'CARD SYSTEM', '10', '''
<div class="card-anatomy">
 <div class="ca-card"><img src="../client/assets/characters/cards/detective.webp" style="width:58mm"></div>
 <div class="ca-notes">
  <div><b>1 · الإطار</b><span>ثماني مشطوف الزوايا، حدّ متوهّج بلون الدور.</span></div>
  <div><b>2 · نافذة الرسم</b><span>الشخصية بنصف جسد، والمدينة الليلية خلفها.</span></div>
  <div><b>3 · شريط الاسم</b><span>شريط داكن بحواف مدبّبة، والاسم بالعربية بخط عريض أبيض.</span></div>
  <div><b>4 · شارة الأيقونة</b><span>سداسي بلون الدور يحمل أيقونة الشخصية.</span></div>
  <div><b>5 · النسبة</b><span>العرض إلى الارتفاع 64 : 82، وتطبع البطاقة بمقاس 64 × 82 مم.</span></div>
 </div>
 </div>
<div class="card-row2"><div class="print-card"><div class="pc"><img src="../client/assets/characters/cards/mafia.webp"></div><span>الوجه الأمامي بالمقاس الفعلي المطبوع: 64 × 82 مم</span></div>
<div class="ca-back"><div class="back-face"><img src="logo/mafia-logo-mark.png"></div><span>الوجه الخلفي (64 × 82 مم): شعار الرمز فوق خطوط مائلة داكنة وتوهّج قرمزي وحدّ ذهبي.</span></div></div>''')

# 12. مبادئ الحركة
page('مبادئ الحركة', 'MOTION PRINCIPLES', '11', '''
<div class="motion">
 <div><h4>سريعة وواضحة</h4><p>الحركة تشرح ما حدث ولا تؤخر اللاعب. لمسة الزر 120 مللي ثانية، ودخول الشاشة 300–420.</p></div>
 <div><h4>سينمائية عند اللحظات الكبرى</h4><p>حلول الليل وطلوع النهار وكشف الدور وإعلان النتيجة تأخذ وقتاً أطول (0.8–1.7 ثانية) لأنها لحظات درامية.</p></div>
 <div><h4>انطلاق سريع وهبوط ناعم</h4><p>كل الحركات تبدأ بسرعة وتنتهي بهدوء، بلا ارتداد مبالغ فيه.</p></div>
 <div><h4>احترام الجهاز واللاعب</h4><p>عند «تقليل الحركة» تختفي الحركات الزخرفية وتبقى المعلومة. والأجهزة الضعيفة تستخدم الوضع المخفّف.</p></div>
</div>
<table class="specs"><tr><th>الحدث</th><th>المدة</th><th>الطابع</th></tr>
<tr><td>لمس زر أو بطاقة</td><td>120 مللي ثانية</td><td>انضغاط خفيف 3%</td></tr><tr><td>دخول شاشة</td><td>300–420 مللي ثانية</td><td>صعود 14 بكسل مع ظهور متتابع</td></tr>
<tr><td>قلب بطاقة الدور</td><td>800 مللي ثانية</td><td>دوران ثلاثي الأبعاد حول المحور العمودي</td></tr><tr><td>حلول الليل / النهار</td><td>1.7 ثانية</td><td>إظلام أو إضاءة كاملة مع صعود القمر أو الشمس</td></tr>
<tr><td>إعلان النتيجة</td><td>600–900 مللي ثانية</td><td>امتلاء أعمدة الأصوات ثم ظهور البطاقة</td></tr></table>''')

# 13. المؤثرات
fx = [('كشف المافيا', C['crimson'], 'دخان قرمزي من الأسفل وومضة حمراء على الإطار'), ('كشف الطبيب', C['emerald'], 'نبض قلب أخضر يعبر البطاقة'),
      ('التحقيق', C['blue'], 'مسح ضوئي أزرق بعدسة دائرية'), ('كشف القناص', C['violet'], 'دائرة تصويب تنغلق على الوجه'),
      ('كشف المفاوض', C['gold'], 'لمعة ذهبية قطرية'), ('حلول الليل', C['violet'], 'قمر يصعد وجزيئات غبار بنفسجي'),
      ('طلوع النهار', C['gold'], 'شمس وأشعة ذهبية تمسح الظلام'), ('نتيجة التصويت', C['gold'], 'أعمدة تمتلئ ثم بطاقة المُخرج'),
      ('الإقصاء', C['crimson'], 'تحوّل البطاقة للرمادي وشقّ أحمر'), ('الفوز', C['gold'], 'تاج وجزيئات ذهبية متصاعدة'), ('الخسارة', C['crimson'], 'إظلام بطيء وجمرات حمراء')]
page('إرشادات الحركة والمؤثرات', 'ANIMATION & VFX GUIDELINES', '12', '<div class="fx-grid">' + ''.join(f'<div class="fx" style="--c:{c}"><div class="orb"></div><b>{n}</b><span>{d}</span></div>' for n, c, d in fx)
     + '</div><p class="note">قواعد المؤثرات: الجزيئات خفيفة ومحدودة العدد، والتوهّج بلون الدور فقط ولا يغطي النص، والدخان عند الحواف لا فوق الوجوه. لا يتزامن أكثر من مؤثر كبير واحد على الشاشة.</p>')

# 14. الخلفيات
page('الخلفيات والأنماط', 'BACKGROUNDS & PATTERNS', '13', f'''
<div class="bg-grid">
 <div class="bgx" style="background:radial-gradient(120% 60% at 50% -10%,rgba(217,35,60,.35),transparent 60%),linear-gradient(180deg,#0b1124,{C['midnight']} 60%)"><div class="sky"></div><span>الافتراضية: وهج قرمزي من الأعلى</span></div>
 <div class="bgx" style="background:radial-gradient(100% 60% at 50% -10%,rgba(164,91,231,.4),transparent 60%),linear-gradient(180deg,#05070f,#070a16 70%)"><div class="sky"></div><span>الليل: وهج بنفسجي وظلام أعمق</span></div>
 <div class="bgx" style="background:radial-gradient(110% 60% at 50% -10%,rgba(232,174,66,.35),transparent 60%),linear-gradient(180deg,#121a36,{C['midnight']} 60%)"><div class="sky"></div><span>النهار: وهج ذهبي</span></div>
 <div class="bgx" style="background:repeating-linear-gradient(45deg,#140a12 0 3mm,#0c0a14 3mm 6mm)"><span>نمط ظهر البطاقة: خطوط مائلة 3 مم</span></div>
</div>
<p class="note">أفق المدينة (ناطحات سحاب صامتة) يثبت في أسفل كل الشاشات بنسبة 34% من الارتفاع وشفافية 55%. الوهج يأتي من الأعلى دائماً كأنه ضوء القمر.</p>''')

# 15. أمثلة الشاشات
shots = [('s1', 'الدخول'), ('s2', 'الراوي: الرئيسية'), ('s3', 'باركود الشبكة'), ('s4', 'بطاقة الدور'), ('s5', 'الراوي: الليل'), ('s6', 'اللاعب: الليل'), ('s7', 'تسجيل التصويت'), ('s8', 'نهاية المباراة')]
avail = [s for s in shots if os.path.exists(os.path.join(ROOT, 'screens', s[0] + '.png'))]
page('أمثلة من شاشات اللعبة', 'APPLICATION SCREENS', '14', '<div class="shots">' + ''.join(f'<figure><div class="phone"><img src="{jpg(f'screens/{f}.png', maxw=560, q=80)}"></div><figcaption>{c}</figcaption></figure>' for f, c in avail[:8]) + '</div>')

# 16. التجاوب
page('مبادئ التجاوب', 'RESPONSIVE PRINCIPLES', '15', '''
<div class="resp">
 <div><h4>الهاتف أولاً</h4><p>كل شاشة تُصمَّم لعرض 360–430 بكسل بعمود واحد. الأزرار الرئيسية أسفل الشاشة في متناول الإبهام، وارتفاعها 50 بكسل على الأقل.</p></div>
 <div><h4>المناطق الآمنة</h4><p>تُحترم حواف النوتش وشريط الإيماءات في آيفون وأندرويد. لا نص ولا زر في آخر 16 بكسل من الحواف.</p></div>
 <div><h4>التابلت والحاسوب</h4><p>المحتوى بعرض أقصى 540 بكسل في المنتصف، وتبقى الخلفية السينمائية على كامل الشاشة.</p></div>
 <div><h4>اللمس</h4><p>أصغر هدف لمس 42 × 42 بكسل، وكل ضغطة تعطي استجابة فورية (انضغاط واهتزاز اختياري).</p></div>
</div>
<div class="devices">''' + (f'<div class="phone big"><img src="screens/s4.png"></div>' if os.path.exists(os.path.join(ROOT, 'screens', 's4.png')) else '') + (f'<div class="tablet"><img src="screens/tablet.png"></div>' if os.path.exists(os.path.join(ROOT, 'screens', 'tablet.png')) else '') + '</div>')

# 17. قواعد الاستعمال
dos = ['استخدم الشعار على الخلفيات الداكنة أو فوق صور الشخصيات المعتمة', 'احتفظ بلون كل دور كما هو في كل مكان', 'استخدم البطاقات كاملة بإطارها واسمها عند كشف الدور', 'اترك المساحة الحرّة حول الشعار', 'اكتب الواجهة بالعربية دائماً']
donts = ['لا تمطّ الشعار ولا تغيّر نسبه', 'لا تضع الشعار الملوّن على خلفية فاتحة', 'لا تعِد رسم الشخصيات ولا تغيّر ملامحها أو أزياءها', 'لا تستخدم لون دور لشخصية أخرى', 'لا تكدّس أكثر من مؤثر كبير في الوقت نفسه']
page('قواعد الاستعمال', 'BRAND USAGE RULES', '16', '<div class="rules"><div class="do"><h4>✓ افعل</h4>' + ''.join(f'<p>{x}</p>' for x in dos) + '</div><div class="dont"><h4>✕ لا تفعل</h4>' + ''.join(f'<p>{x}</p>' for x in donts) + '''</div></div>
<div class="misuse"><figure><div class="vbox light"><img src="logo/mafia-logo-primary.png" style="height:38mm"></div><figcaption>✕ خلفية فاتحة</figcaption></figure>
<figure><div class="vbox dark"><img src="logo/mafia-logo-primary.png" style="height:38mm;width:50mm;object-fit:fill"></div><figcaption>✕ شعار ممطوط</figcaption></figure>
<figure><div class="vbox dark"><img src="logo/mafia-logo-primary.png" style="height:38mm;filter:hue-rotate(150deg)"></div><figcaption>✕ ألوان مغيّرة</figcaption></figure></div>''')

CSS = open(os.path.join(ROOT, 'guidelines.css'), encoding='utf-8').read()
html = f'''<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>MAFIA GAME – VISUAL IDENTITY GUIDELINES</title><style>{CSS}</style></head><body>{''.join(pages)}</body></html>'''
BG = {'dark': '#080A12', 'navy': '#10182B', 'crimson': '#B81E33', 'light': '#F2F2EE'}
def png_small(rel, maxw=1000):
    out = os.path.join(CACHE, re.sub(r'[^a-z0-9_]+', '_', rel.lower()) + f'_{maxw}.png')
    if not os.path.exists(out):
        im = Image.open(os.path.join(ROOT, rel)).convert('RGBA'); im.thumbnail((maxw, maxw * 3), Image.LANCZOS); im.save(out, optimize=True)
    return '.pdf-cache/' + os.path.basename(out)
# الشعار فوق خلفية متدرّجة يبقى شفافاً
html = html.replace('class="cover-logo" src="logo/mafia-logo-primary.png"', 'class="cover-logo" src="' + png_small('logo/mafia-logo-primary.png', 900) + '"')
html = html.replace('<div class="vbox crimson"><img src="logo/mafia-logo-mono.png"', '<div class="vbox crimson"><img src="' + png_small('logo/mafia-logo-mono.png', 700) + '"')
def vbox_sub(m):
    return m.group(0).replace(m.group(3), jpg(m.group(3), BG.get(m.group(1), '#080A12'), maxw=1100))
html = re.sub(r'<div class="vbox (\w+)[^"]*">(<div class="cs">)?<img src="(logo/[^"]+\.png)"', vbox_sub, html)
html = re.sub(r'src="(logo/[^"]+\.png)"', lambda m: 'src="' + jpg(m.group(1), '#080A12', maxw=1100) + '"', html)
html = re.sub(r'src="(\.\./client/assets/[^"]+\.webp)"', lambda m: 'src="' + jpg(m.group(1), '#080A12', maxw=520) + '"', html)
html = re.sub(r'src="(screens/[^"]+\.png)"', lambda m: 'src="' + jpg(m.group(1), '#080A12', maxw=900, q=80) + '"', html)
open(os.path.join(ROOT, 'guidelines.html'), 'w', encoding='utf-8').write(html)
print('pages:', len(pages))
