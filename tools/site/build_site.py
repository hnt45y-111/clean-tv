#!/usr/bin/env python3
"""Writes index.html (the download site). Release tags come from the command line:  build_site.py build-N studio-N auto-N remote-N mobile-N"""
import sys
b, s, a, r, mo = (sys.argv[1:6] + ['build-0', 'studio-0', 'auto-0', 'remote-0', 'mobile-0'])[:5]
BASE = 'https://github.com/hnt45y-111/clean-tv/releases/download/'
L = dict(tv=BASE + b + '/app-debug.apk', studio=BASE + s + '/moamal-studio.apk', auto=BASE + a + '/msm-auto.apk', remote=BASE + r + '/hawai-remote.apk', mobile=BASE + mo + '/qanawati-mobile.apk')
MK = open('tools/brand/mark_cls.txt').read()
def mark(cls='mk', extra=''): return '<svg class="%s" viewBox="0 0 100 100" aria-hidden="true"%s>%s</svg>' % (cls, extra, MK)
DL = '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>'
CK = '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
def li(items): return '<ul>' + ''.join('<li>%s%s</li>' % (CK, t) for t in items) + '</ul>'
VER = 'v6.0'
APPS = [
 dict(id='tv', tag='للتلفزيون والبوكس والسيارة', name='واجهة مدير الشاشات', img='tv-home.jpg', alt='الواجهة على التلفزيون', link=L['tv'], tagv=b, btn='تحميل الواجهة',
      text='واجهة كاملة بهوية واحدة: ساعة وتاريخ هجري وميلادي، تطبيقاتك ببلاطات واضحة، وكل شي يتحرك بالريموت.',
      feats=['واجهات على طراز الشركات: سامسونگ، إل جي، هايسنس، گوگل TV، فاير TV، روكو، شاومي', 'شريط المباريات المباشرة بالعربي، وتختار الفرق اللي تظهر', 'مواقيت الأذان والمناسبات ومربع آية وحديث', 'خلفيات يومية وشاشة توقف وأخبار', 'وضع الأطفال وقفل التطبيقات', 'واجهة سيارة بـ 14 تصميم وشاشة توقف قابلة للتعديل']),
 dict(id='live', tag='جزء من الواجهة', name='قنواتي', img='tv-channels.jpg', alt='قنواتي: القنوات المجانية', link=L['tv'], tagv=b, btn='تحميل الواجهة (فيها قنواتي)',
      text='بث مباشر مجاني بدون اشتراك: أكثر من 190 قناة من بثها الرسمي، بشعارات وأقسام، وتضيف قنواتك أنت.',
      feats=['أخبار: الجزيرة، العربية، الحدث، سكاي نيوز عربية، الشرق، فرانس 24، DW', 'باقة MBC المجانية، وأفلام ومسلسلات، ووثائقية، و12 قناة أطفال', 'باقة قنوات كربلاء: الإمام الحسين (ع)، العباسية، بيت العباس، كربلاء الوثائقية', 'رياضة: العراقية الرياضية، الكويت، عُمان، البحرين، وقنوات كل بلد', 'قنواتي الخاصة: ضيف قنواتك المرخّصة (قائمة M3U أو رابط يوتيوب) وتصير باقة', 'لوحة معلومات بشعار القناة ودقتها، وتبديل القناة بأسهم الريموت']),
 dict(id='studio', tag='للموبايل', name='مدير الشاشة', img='studio-design.jpg', alt='تطبيق مدير الشاشة', phone=True, link=L['studio'], tagv=s, btn='تحميل التطبيق',
      text='التطبيق الرئيسي: تنظّف الشاشة، وتصمم واجهتها وتشوف التعديل قدامك، وتصدّره بضغطة.',
      feats=['معاينة حية لكل تعديل قبل التصدير', 'واجهات حسب الشركة: شريط سامسونگ، إل جي وغيرها يتغيّر معها بالكامل', 'عرض شاشة الموبايل على التلفزيون بسرعة عالية', 'تنظيف وتسريع الشاشة، والربط بالواي فاي أو الكيبل', 'تصاميم سيارة جاهزة تعدّل بيها كل شي', 'تعديل شاشة التوقف، والساعة، والمناسبات، والمباريات']),
 dict(id='auto', tag='لأندرويد أوتو', name='مدير الشاشات أوتو', img='auto-phone.jpg', alt='مدير الشاشات أوتو', phone=True, link=L['auto'], tagv=a, btn='تحميل أوتو',
      text='لسيارتك إذا شاشتها تدعم أندرويد أوتو: واجهة خاصة بيك تطلع على الشاشة وتصممها من موبايلك.',
      feats=['قوالب جاهزة بالهوية الجديدة وغيرها', 'تترتب حسب شكل شاشة السيارة: عريضة أو عادية أو طولية', 'موسيقى وسرعة وطقس واختصارات للتطبيقات', 'اشتراك مرة وحدة مدى الحياة']),
 dict(id='mobile', tag='للموبايل · جديد', name='قنواتي موبايل', img='mobile-main.jpg', more=['mobile-vod.jpg', 'mobile-lock.jpg'], alt='قنواتي موبايل', phone=True, link=L['mobile'], tagv=mo, btn='تحميل قنواتي موبايل',
      text='قنواتي والأفلام والمسلسلات بموبايلك، بنفس هوية قنواتي على التلفزيون: أسود وأحمر وكبسولات. تفعّله مرة وحدة بكود من مدير الشاشة.',
      feats=['يفتح بكود تفعيل مرة وحدة (مدى الحياة ومربوط بموبايلك): تدز رمز جهازك لمدير الشاشة ويرجّعلك الكود', 'قنوات مجانية رسمية بأقسامها وشعاراتها، وتضيف قنواتك من حساب IPTV أو قائمة M3U', 'أفلام ومسلسلات من حسابك أو قائمتك بغلافات وتصنيفات وبحث', 'الربط الذكي: تلصق رابط المزوّد والتطبيق يتعرف على نوعه ويضيفه', 'مفضلة وآخر مشاهدة، وإكمال الفيلم من حيث وقفت', 'وضع الهدوء الليلي: الصوت ينزل والترجمة تكبر بعد ساعتك', 'ترحيب باسمك بحركة عند كل فتح']),
 dict(id='remote', tag='ريموت التحكم · جديد', name='هوائي', img='remote-main.jpg', alt='تطبيق هوائي', phone=True, link=L['remote'], tagv=r, btn='تحميل هوائي',
      text='ريموت كامل بموبايلك: يلگى التلفزيون وحده، ويتحكم بكل شي بدون ما تدور الريموت.',
      feats=['لوحة لمس وأسهم وOK ورجوع والرئيسية', 'الصوت والكتم والتشغيل والإعدادات والتالي والسابق', 'فتح أي تطبيق وكتابة النص والبحث', 'تشغيل قنواتي وشريط النتائج من الموبايل', 'تغيير الثيم والخلفيات وإرسال صورك', 'القرآن والأذان والتنبيهات ووضع الأطفال']),
]
def card(x):
    cls = 'shot phone' if x.get('phone') else 'shot'
    if x.get('more'):
        figs = ''.join('<figure class="shot phone"><img src="img/%s" alt="%s" loading="lazy"></figure>' % (i, x['alt']) for i in [x['img']] + x['more'])
        return ('<article class="app" id="%s"><div class="gal">%s</div><div class="body"><span class="tag">%s</span><h3>%s</h3><p>%s</p>%s'
                '<div class="act"><a class="btn pri" href="%s" target="_blank" rel="noopener">%s%s</a><span class="ver" dir="ltr">%s · %s</span></div></div></article>') % (
            x['id'], figs, x['tag'], x['name'], x['text'], li(x['feats']), x['link'], DL, x['btn'], VER, x['tagv'])
    return ('<article class="app" id="%s"><figure class="%s"><img src="img/%s" alt="%s" loading="lazy"></figure><div class="body"><span class="tag">%s</span><h3>%s</h3><p>%s</p>%s'
            '<div class="act"><a class="btn pri" href="%s" target="_blank" rel="noopener">%s%s</a><span class="ver" dir="ltr">%s · %s</span></div></div></article>') % (
        x['id'], cls, x['img'], x['alt'], x['tag'], x['name'], x['text'], li(x['feats']), x['link'], DL, x['btn'], VER, x['tagv'])
HIGH = [('شاشة واحدة، هوية واحدة', 'التلفزيون والموبايل والسيارة بنفس الألوان والخطوط والزوايا.'), ('قنوات مجانية بالعربي', 'قنواتي: أخبار ورياضة وقنوات كل بلد، بدون اشتراك.'), ('مباريات مباشرة', 'شريط عربي يمر بنتائج المباريات، وتختار الفرق اللي تتابعها.'),
        ('معاينة فورية', 'كل تعديل تسويه يبين قدامك قبل ما تصدّره.'), ('ريموت بموبايلك', 'هوائي يتحكم بكل شي، حتى الصوت وفتح القنوات.'), ('عرض الشاشة بسرعة', 'ابعث شاشة موبايلك للتلفزيون بصورة سلسة بدون تأخير.')]
CSS = '''
:root{--ink:#15181B;--surf:#23282D;--line:#3A4046;--ivory:#EFE7D4;--ivory2:#E2D8C0;--cu:#D9822B;--cu2:#E8A25E;--chrome:#B8BDC2;--teal:#1F6F6B;--r1:16px;--r2:8px;--r3:4px}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--ink);color:var(--ivory);font:400 17px/1.8 'IBM Plex Sans Arabic','Tajawal',system-ui,sans-serif;direction:rtl}
.mk .mf{fill:var(--ivory)}.mk .ms{stroke:var(--ivory)}.mk .mscr{fill:var(--ink)}.mk .mdot{fill:var(--cu)}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
h1,h2,h3,.brand b{font-family:'Reem Kufi',sans-serif;font-weight:700}
a{color:inherit}
.ic{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
header.top{position:sticky;top:0;z-index:20;background:var(--ink);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;height:68px}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}.brand .mk{width:44px;height:44px}.brand b{font-size:24px}
nav a{margin-inline-start:22px;text-decoration:none;color:var(--chrome);font-size:15px}nav a:hover{color:var(--cu2)}
.btn{display:inline-flex;align-items:center;gap:10px;min-height:50px;padding:0 22px;border-radius:var(--r2);font:600 16px 'IBM Plex Sans Arabic',sans-serif;text-decoration:none;border:2px solid transparent}
.btn.pri{background:var(--cu);color:var(--ink)}.btn.pri:hover{background:var(--cu2)}
.btn.sec{border-color:var(--chrome);color:var(--ivory)}.btn.sec:hover{border-color:var(--cu2);color:var(--cu2)}
.hero{padding:64px 0 40px}.hero .wrap{display:grid;grid-template-columns:1fr 1.1fr;gap:48px;align-items:center}
.eyebrow{display:inline-block;font:600 14px 'IBM Plex Sans Arabic';letter-spacing:.02em;color:var(--cu2);border:1px solid var(--cu);border-radius:var(--r3);padding:3px 12px;margin-bottom:18px}
h1{font-size:60px;line-height:1.15;margin-bottom:18px}h1 em{font-style:normal;color:var(--cu)}
.lead{color:var(--ivory2);font-size:19px;max-width:560px;opacity:.9}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.frame{border:1px solid var(--line);border-radius:var(--r1);overflow:hidden;background:var(--surf);box-shadow:none}
.frame img{display:block;width:100%;height:auto}
.strip{height:12px;background:var(--cu);border-top:4px solid var(--chrome);margin-top:0}
section{padding:72px 0}
.sh{margin-bottom:34px}.sh .k{font:600 14px 'IBM Plex Sans Arabic';color:var(--cu2);letter-spacing:.04em;margin-bottom:6px}.sh h2{font-size:38px;line-height:1.25}.sh p{color:var(--chrome);max-width:680px;margin-top:8px}
.story{background:var(--surf);border-block:1px solid var(--line);padding:46px 0}
.story .wrap{display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:center}.story .mk{width:120px;height:120px}.story p{font-size:20px;max-width:760px;color:var(--ivory2)}.story b{color:var(--cu2)}
.hl{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.hl div{background:var(--surf);border:1px solid var(--line);border-radius:var(--r1);padding:24px;border-top:4px solid var(--cu)}
.hl h3{font-size:22px;margin-bottom:6px}.hl p{color:var(--chrome);font-size:16px;line-height:1.7}
.apps{display:grid;gap:26px}
.app{display:grid;grid-template-columns:1.15fr 1fr;gap:34px;align-items:center;background:var(--surf);border:1px solid var(--line);border-radius:var(--r1);padding:26px}
.app:nth-child(even){direction:ltr}.app:nth-child(even)>*{direction:rtl}
.shot{border-radius:var(--r2);overflow:hidden;border:1px solid var(--line);background:var(--ink)}.shot img{display:block;width:100%;height:auto}
.shot.phone{max-width:300px;margin:0 auto}
.gal{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-self:start}.gal .shot.phone{max-width:none;margin:0}
@media(max-width:640px){.gal{grid-template-columns:repeat(3,minmax(0,1fr))}}
.tag{display:inline-block;font:600 13px 'IBM Plex Sans Arabic';color:var(--ink);background:var(--cu2);border-radius:var(--r3);padding:2px 10px}
.app h3{font-size:34px;margin:10px 0 6px}.app p{color:var(--ivory2);margin-bottom:12px;opacity:.9}
.app ul{list-style:none;display:grid;gap:7px;margin-bottom:20px}.app li{display:flex;gap:10px;font-size:16px;color:var(--ivory2);line-height:1.6}.app li .ic{color:var(--cu);margin-top:4px}
.act{display:flex;flex-wrap:wrap;gap:14px;align-items:center}.ver{font:500 13px 'IBM Plex Mono',monospace;color:var(--chrome)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.st{border:1px solid var(--line);border-radius:var(--r1);padding:24px;background:var(--surf)}
.st .n{font:700 40px 'Reem Kufi';color:var(--cu)}.st h3{font-size:22px;margin:4px 0}.st p{color:var(--chrome);font-size:16px}
.note{margin-top:22px;color:var(--chrome);font-size:15px;border:1px dashed var(--line);border-radius:var(--r2);padding:14px 18px}.note a{color:var(--cu2)}
.contact{display:grid;grid-template-columns:1fr auto;gap:30px;align-items:center;background:var(--surf);border:1px solid var(--line);border-radius:var(--r1);padding:32px}
.socs{display:flex;gap:12px;flex-wrap:wrap}.soc{display:flex;flex-direction:column;border:1px solid var(--chrome);border-radius:var(--r2);padding:12px 22px;text-decoration:none;min-width:190px}.soc small{color:var(--cu2);font-family:'IBM Plex Mono',monospace;direction:ltr}.soc:hover{border-color:var(--cu)}
footer{border-top:1px solid var(--line)}footer .wrap{display:flex;justify-content:space-between;color:var(--chrome);font-size:14px;padding:22px 20px}
footer .strip{margin:0}
@media(max-width:900px){.hero .wrap,.app,.story .wrap,.contact{grid-template-columns:1fr}.hl,.steps{grid-template-columns:1fr}h1{font-size:42px}.app:nth-child(even){direction:rtl}nav a.opt{display:none}.story .mk{width:84px;height:84px}}
'''
HTML = '''<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>مدير الشاشات</title>
<meta name="description" content="مدير الشاشات: واجهة التلفزيون والسيارة، قنواتي للبث المجاني، شريط المباريات، تطبيق الموبايل، أوتو، وهوائي الريموت.">
<meta name="theme-color" content="#15181B">
<link rel="icon" href="img/mark.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Reem+Kufi:wght@400..700&display=swap" rel="stylesheet">
<style>%(css)s</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="#top" aria-label="مدير الشاشات">%(mk)s<b>مدير الشاشات</b></a>
  <nav><a class="opt" href="#highlights">أفضل الميزات</a><a class="opt" href="#apps">التطبيقات</a><a class="opt" href="#start">البداية</a><a href="#contact">تواصل</a></nav>
</div></header>
<main id="top">
<section class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">الإصدار %(ver)s · خمسة تطبيقات بهوية واحدة</span>
    <h1>شاشاتك كلها <em>بيد وحدة</em></h1>
    <p class="lead">واجهة للتلفزيون والسيارة، وبث مجاني بالعربي، وشريط مباريات مباشرة، وتطبيق للموبايل يصمّم ويتحكم، وريموت بجيبك.</p>
    <div class="cta"><a class="btn pri" href="#apps">%(dl)s حمّل التطبيقات</a><a class="btn sec" href="#highlights">شنو الجديد</a></div>
  </div>
  <div class="frame"><img src="img/tv-home.jpg" alt="واجهة مدير الشاشات على التلفزيون"></div>
</div></section>
<div class="strip"></div>

<div class="story"><div class="wrap">%(mk2)s<p>الهوية مستوحاة من تاريخ بغداد التقني: <b>أول بث تلفزيوني عربي من بغداد عام ١٩٥٦</b>، وشكل المدينة المدوّرة بأسوارها وبواباتها الأربع داخل شاشة الشعار.</p></div></div>

<section id="highlights"><div class="wrap">
  <div class="sh"><div class="k">أفضل الميزات</div><h2>شنو يسوي مدير الشاشات</h2></div>
  <div class="hl">%(hl)s</div>
</div></section>

<section id="apps"><div class="wrap">
  <div class="apps">%(cards)s</div>
  <div class="note">إذا الموبايل كال «التطبيق من مصدر غير معروف»، اسمح بالتثبيت من المتصفح بس لهذي المرة. كل النسخ السابقة موجودة <a href="https://github.com/hnt45y-111/clean-tv/releases" target="_blank" rel="noopener">بصفحة الإصدارات</a>.</div>
</div></section>

<section id="start"><div class="wrap">
  <div class="sh"><div class="k">شلون تبدي</div><h2>ثلاث خطوات وتخلص</h2></div>
  <div class="steps">
    <div class="st"><div class="n">01</div><h3>نزّل التطبيقات</h3><p>الواجهة للتلفزيون، ومدير الشاشة وهوائي للموبايل. إذا طلب «السماح من هذا المصدر» اسمحله.</p></div>
    <div class="st"><div class="n">02</div><h3>اربط شاشتك</h3><p>شغّل «تصحيح الأخطاء» بالشاشة، والتطبيق يلگاها على الواي فاي، أو اربطها بالكيبل.</p></div>
    <div class="st"><div class="n">03</div><h3>صمّم وتحكّم</h3><p>صمّم الواجهة وشوف التعديل قدامك، وتحكّم بالشاشة من هوائي، وشغّل قنواتي.</p></div>
  </div>
</div></section>

<section id="contact"><div class="wrap">
  <div class="contact">
    <div class="sh" style="margin:0"><div class="k">تواصل</div><h2>عندك سؤال أو تريد اشتراك؟</h2><p>راسلنا على التيليگرام أو الإنستغرام، ونرد عليك بأسرع وقت.</p></div>
    <div class="socs"><a class="soc" href="https://t.me/KMK3993" target="_blank" rel="noopener"><b>تيليگرام</b><small>@KMK3993</small></a><a class="soc" href="https://instagram.com/HN_45Y" target="_blank" rel="noopener"><b>إنستغرام</b><small>@HN_45Y</small></a></div>
  </div>
</div></section>
</main>
<footer><div class="wrap"><span>مدير الشاشات · الإصدار %(ver)s</span><span>© ٢٠٢٦</span></div><div class="strip"></div></footer>
</body>
</html>
'''
out = HTML % dict(css=CSS, mk=mark('mk'), mk2=mark('mk'), ver=VER, dl=DL, hl=''.join('<div><h3>%s</h3><p>%s</p></div>' % h for h in HIGH), cards=''.join(card(x) for x in APPS))
open('index.html', 'w', encoding='utf-8').write(out)
print('site written', len(out) // 1024, 'KB', L)
