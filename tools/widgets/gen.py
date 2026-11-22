#!/usr/bin/env python3
"""Writes, for each phone app, the widget provider XMLs, the strings and the manifest snippet.
   Run:  python3 tools/widgets/gen.py     (the generated files are committed, so CI does not need it)"""
import os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

# class, xml name, label, description, minW, minH, cellsW, cellsH, minResizeW, minResizeH, configurable
APPS = {
 'Remote': ('com.cleantv.remote', 'com.cleantv.remote.wd.RemoteWidgets', [
   ('Pad', 'wd_pad', 'ريموت', 'أزرار التحكم بالتلفاز: اتجاهات وموافق ورجوع وصوت', 250, 250, 4, 4, 180, 180, False),
   ('Volume', 'wd_volume', 'صوت التلفاز', 'رفع وخفض وكتم صوت التلفاز', 250, 70, 4, 1, 110, 40, False),
   ('Power', 'wd_power', 'طاقة التلفاز', 'زر واحد لقائمة إيقاف التلفاز', 250, 70, 4, 1, 110, 40, False),
   ('Channels', 'wd_channels', 'قنواتي على التلفاز', 'افتح القنوات أو قناة عشوائية أو غيّر الخلفية', 250, 180, 4, 3, 180, 110, False),
   ('Media', 'wd_media', 'وسائط', 'تشغيل وإيقاف والتالي والسابق والرئيسية', 250, 110, 4, 2, 180, 40, False),
   ('Grid', 'wd_grid', 'اختصاراتي', 'اختصارات جاهزة تختارها، وكل ما تكبّر الويدجت تطلع اقتراحات أكثر', 250, 110, 4, 2, 110, 40, True),
   ('Status', 'wd_status', 'حالة التلفاز', 'متصل أو لا، وزر للإعدادات', 250, 110, 4, 2, 180, 110, False)]),
 'Studio': ('com.moamal.studio', 'com.moamal.studio.wd.StudioWidgets', [
   ('Health', 'wd_health', 'صحة الموبايل', 'مؤشر تقديري للتخزين والرام والبطارية وزر تنظيف', 250, 110, 4, 2, 180, 110, False),
   ('Clean', 'wd_clean', 'نظّف وسرّع', 'زر واحد يفتح تنظيف الموبايل', 250, 70, 4, 1, 110, 40, False),
   ('Grid', 'wd_grid', 'اختصاراتي', 'اختصارات جاهزة تختارها، وكل ما تكبّر الويدجت تطلع اقتراحات أكثر', 250, 110, 4, 2, 110, 40, True),
   ('Devices', 'wd_devices', 'أجهزتي', 'هذا الموبايل، موبايل ثاني، أو الشاشة', 250, 180, 4, 3, 180, 110, False),
   ('Nav', 'wd_nav', 'شريط سريع', 'أجهزتي والتجهيز والواجهة والريموت', 250, 110, 4, 2, 180, 40, False),
   ('Storage', 'wd_storage', 'التخزين', 'المساحة الفاضية والرام', 110, 110, 2, 2, 110, 110, False),
   ('Tv', 'wd_tv', 'جهّز الشاشة', 'تنظيف وتسريع التلفزيون وتصميم واجهته', 250, 110, 4, 2, 180, 110, False)]),
 'Mobile': ('com.cleantv.mobile', 'com.cleantv.mobile.wd.MobileWidgets', [
   ('Resume', 'wd_resume', 'كمّل المشاهدة', 'آخر قناة شفتها بضغطة', 250, 110, 4, 2, 180, 110, False),
   ('Favs', 'wd_favs', 'مفضلتي', 'أول قنواتك المفضلة', 250, 180, 4, 3, 180, 110, False),
   ('Grid', 'wd_grid', 'اختصاراتي', 'اختصارات جاهزة تختارها، وكل ما تكبّر الويدجت تطلع اقتراحات أكثر', 250, 110, 4, 2, 110, 40, True),
   ('Nav', 'wd_nav', 'شريط سريع', 'قنواتي والأفلام والمفضلة والإعدادات', 250, 110, 4, 2, 180, 40, False),
   ('Clock', 'wd_clock', 'ساعة وتحية', 'الوقت والتاريخ وتحية باسمك', 180, 110, 3, 2, 110, 110, False),
   ('Movies', 'wd_movies', 'الأفلام', 'تابع فيلمك أو افتح الأفلام والمسلسلات', 250, 70, 4, 1, 110, 40, False),
   ('Quiet', 'wd_quiet', 'وضع الهدوء', 'شغّل أو أوقف الهدوء الليلي', 250, 70, 4, 1, 110, 40, False)]),
}

def esc(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('"', '&quot;')

for app, (pkg, wcls, ws) in APPS.items():
    res = os.path.join(ROOT, app, 'app', 'src', 'main', 'res')
    os.makedirs(os.path.join(res, 'xml'), exist_ok=True); os.makedirs(os.path.join(res, 'values'), exist_ok=True)
    strings = ['<?xml version="1.0" encoding="utf-8"?>', '<resources>']
    snippet = []
    for cls, xml, label, desc, mw, mh, cw, ch, rw, rh, conf in ws:
        x = ['<?xml version="1.0" encoding="utf-8"?>', '<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"',
             '    android:minWidth="%ddp" android:minHeight="%ddp"' % (mw, mh), '    android:targetCellWidth="%d" android:targetCellHeight="%d"' % (cw, ch),
             '    android:minResizeWidth="%ddp" android:minResizeHeight="%ddp"' % (rw, rh), '    android:resizeMode="horizontal|vertical"',
             '    android:updatePeriodMillis="1800000" android:initialLayout="@layout/msm_widget" android:widgetCategory="home_screen"',
             '    android:description="@string/%s"' % xml]
        if conf: x.append('    android:configure="com.msm.widgets.PickActivity" android:widgetFeatures="reconfigurable"')
        x[-1] += ' />'
        open(os.path.join(res, 'xml', xml + '.xml'), 'w').write('\n'.join(x) + '\n')
        strings.append('    <string name="%s">%s</string>' % (xml, esc(desc)))
        snippet.append('        <receiver android:name="%s$%s" android:exported="true" android:label="%s">\n            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>\n            <meta-data android:name="android.appwidget.provider" android:resource="@xml/%s" />\n        </receiver>' % (wcls, cls, esc(label), xml))
    strings.append('</resources>')
    open(os.path.join(res, 'values', 'wd_strings.xml'), 'w').write('\n'.join(strings) + '\n')
    snippet.append('        <activity android:name="com.msm.widgets.PickActivity" android:exported="true" android:excludeFromRecents="true" android:theme="@android:style/Theme.Material.NoActionBar">\n            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_CONFIGURE" /></intent-filter>\n            <meta-data android:name="msm.app" android:value="%s" />\n        </activity>' % wcls)
    snippet.append('        <activity android:name="com.msm.widgets.ActActivity" android:exported="false" android:excludeFromRecents="true" android:theme="@android:style/Theme.NoDisplay">\n            <meta-data android:name="msm.app" android:value="%s" />\n        </activity>' % wcls)
    out = '\n'.join(snippet) + '\n'
    open(os.path.join(ROOT, 'tools', 'widgets', app + '.manifest.txt'), 'w').write(out)
    # put the snippet into the manifest between markers
    mp = os.path.join(ROOT, app, 'app', 'src', 'main', 'AndroidManifest.xml'); m = open(mp).read()
    a, b = '<!-- MSM-WIDGETS:BEGIN -->', '<!-- MSM-WIDGETS:END -->'
    block = a + '\n' + out + '        ' + b
    if a in m: m = m[:m.index(a)] + block + m[m.index(b) + len(b):]
    else: m = m.replace('    </application>', '        ' + block + '\n    </application>', 1)
    open(mp, 'w').write(m)
    print(app, 'ok', len(ws), 'widgets')
