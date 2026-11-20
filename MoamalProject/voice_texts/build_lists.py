import json,re
p=json.load(open('/home/claude/MoamalApp3/phrases.json'))
L='ألف|باء|تاء|ثاء|جيم|حاء|خاء|دال|ذال|راء|زاي|سين|شين|صاد|ضاد|طاء|ظاء|عين|غين|فاء|قاف|كاف|لام|ميم|نون|هاء|واو|ياء'
seen=set()
def add(lst,x):
    if x and x not in seen: seen.add(x); lst.append(x)
el=[];mm=[]
sec_el={};sec_mm={}
def sec(d,name):
    d.setdefault(name,[]); return d[name]
S=lambda name:sec(sec_el,name)
M=lambda name:sec(sec_mm,name)
def A(sect,x):
    if x and x not in seen: seen.add(x); sect.append(x)
# ---- letters ----
for x in p:
    if re.fullmatch(r'حرف ال(%s)'%L,x): A(S('أسماء الحروف'),x)
for x in p:
    if re.fullmatch(r'حرف ال(%s) في (أول|وسط|آخر) الكلمة، مثل \S+'%L,x): A(S('أمثلة الحرف في الكلمة'),x)
frags=['وين','هذا','وحده','هسه نكتب','أي صورة تبدأ بحرف','أي شكل يناسب كلمة','يلا نفقّع فقاعات','واو! كتبنا','بكل أشكاله',
 'هسه نكتب في أول الكلمة، مثل كلمة','هسه نكتب في وسط الكلمة، مثل كلمة','هسه نكتب في آخر الكلمة، مثل كلمة',
 'شنو الحرف الناقص من كلمة','وين صورة','أي كلمة بيها صوت المد','شنو الرقم اللي بعد','شنو الرقم اللي قبل','هسه نكتب الرقم',
 'وين الكرة المختلفة؟','وين الكتاب المختلف؟','وين القلم الأطول؟','وين الزرافة الأطول؟','وين المتشابه؟','رتّب القطع حتى تصير كلمة',
 'اقلب البطاقات ولاقي كل حرف ويّا صورته','ديربال، اكتب فوق الخط المنقّط','شنو صورة هاي الكلمة؟','كم صورة أكو هنا؟']
frags[0:0]=[]
for f in frags: A(S('قطع الأسئلة'),f)
# syllables
for x in p:
    if re.fullmatch(r'[ء-ي][ً-ْ]',x) or x in('با','بو','بي'): A(S('الحركات'),x)
i0=p.index('اا');i1=p.index('بقرة')
for x in p[i0:i1]:
    if len(x)==2: A(S('المقاطع الطويلة'),x)
# words
i2=p.index('ب')
for x in p[i1:]:
    if len(x)>1 and ' ' not in x and len(x)<=9 and x not in ('بابا','بابي','ماما','بوم','دادا','فادي','مُفيد','دُفوف') and not re.fullmatch(r'(واحد|اثنين|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|صفر)',x): A(S('كلمات الصور'),x)
for x in ['بابا','بابي','ماما','بوم','دادا','فادي','مُفيد','دُفوف']: A(S('كلمات الصور'),x)
for x in ['صفر','واحد','اثنين','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة']: A(S('الأرقام'),x)
for x in p:
    if re.match(r'^سورة ',x): A(S('أسماء السور'),x)
# ---- MiniMax: book, lessons, quran, gifts, praise ----
praise=['أحسنت','صح','حاول مرة ثانية']
for x in praise: A(M('التشجيع'),x)
for x in ['شنو انطوك اليوم بالمدرسة؟','إذا تحفظ اليوم زين، شنو تريد هدية؟']: A(M('الترحيب'),x)
gifts=[re.match(r'^تدلل! بابا راح يجيبلك (.+)$',x).group(1) for x in p if re.match(r'^تدلل! بابا راح يجيبلك ',x)]
for x in ['عفية! بابا راح يجيبلك','عفية! بابا راح يجيبلج','إذا حفظت. تدلل!','إذا حفظتي. تدلللي!'.replace('تدلللي','تدللي')]: A(M('الهدايا'),x)
for g in gifts: A(M('الهدايا'),g)
for x in ['ما سمعتك زين، قرّب واقرا بصوت أعلى','ممتاز! الآية صحيحة','ماشاء الله! حفظت السورة كلها','اقرا الآية من حفظك','أي سورة نحفظ اليوم؟','هسه دورك! ردّد الآية','حفظ القرآن']: A(M('القرآن'),x)
for x in ['هسه دورك','أي درس نقرا؟']: pass
i3=p.index('قراءتي الجديدة للصف الأول الابتدائي');i4=p.index('اختار الحرف اللي تريد تتدرّب عليه')
skip={'استمع وقلد'}
for x in p[i3:i4]:
    if x.startswith(('يا بط','قل للسمكة','ميلي عنها','وعلى الجرف')): continue  # nashid: no voice
    A(M('الكتاب والدروس'),x)
A(M('الكتاب والدروس'),'قراءتي الجديدة')
for x in ['هاي جوائزك','هسه دورك']: A(M('الترحيب'),x)
def dump(secs,path,limit,title):
    tot=0;lines=[]
    for k,v in secs.items():
        for x in v: tot+=len(x); lines.append(x)
    open(path,'w',encoding='utf-8').write('\n'.join(lines)+'\n')
    print(title,len(lines),'عبارة',tot,'حرف /',limit)
    for k,v in secs.items(): print('  ',k,len(v),sum(map(len,v)))
dump(sec_el,'/home/claude/out/elevenlabs_text.txt',10000,'ElevenLabs')
dump(sec_mm,'/home/claude/out/minimax_text.txt',9500,'MiniMax')
