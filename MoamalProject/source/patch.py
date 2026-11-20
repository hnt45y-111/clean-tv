import re, json
src = open('/home/claude/app2/template.html', encoding='utf-8').read()
css = open('/home/claude/v3/style.css', encoding='utf-8').read()
s = src

def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (s.count(old), old[:90])
    s = s.replace(old, new)

def rep_block(start, end, new):
    """replace from start marker up to (not including) end marker"""
    global s
    a = s.index(start); b = s.index(end, a)
    s = s[:a] + new + s[b:]

# ---------- head / css ----------
a = s.index('<style>'); b = s.index('</style>')
s = s[:a] + '<style>\n' + css + '\n' + s[b:]
rep('<meta name="theme-color" content="#7fd3ff">', '<meta name="theme-color" content="#43c6ff">')
rep('<script src="voices/index.js"></script>', '<script src="voices/index.js"></script>\n<script src="quran/quran.js"></script>')
rep('family=Baloo+Bhaijaan+2:wght@600;700;800&display=swap', 'family=Amiri+Quran&family=Baloo+Bhaijaan+2:wght@600;700;800&display=swap')

# ---------- body markup ----------
a = s.index('<body>'); b = s.index('<script>\nconst IMG')
body = '''<body>
<div id="scene">
  <div class="sunf"><i></i><i></i><b></b></div>
  <div class="cl" style="top:110px;width:110px;animation-duration:70s;animation-delay:-20s"></div>
  <div class="cl" style="top:200px;width:90px;transform:scale(.7);animation-duration:95s;animation-delay:-60s"></div>
  <div class="cl" style="top:40px;width:80px;animation-duration:80s;animation-delay:-45s"></div>
  <div class="flyer" style="top:150px">🐦</div>
  <svg class="hills" viewBox="0 0 400 160" preserveAspectRatio="none"><path d="M-10 80 Q70 25 150 72 T300 62 T420 52 V170 H-10Z" fill="#9be15d" stroke="#2b1d52" stroke-width="4"/><path d="M-10 115 Q100 78 200 110 T420 100 V170 H-10Z" fill="#6bcb77" stroke="#2b1d52" stroke-width="4"/></svg>
</div>

<div id="splash">
  <div class="balloons"><span style="left:8%;animation-duration:9s">🎈</span><span style="left:30%;animation-duration:12s;animation-delay:-4s">🎈</span><span style="left:62%;animation-duration:10s;animation-delay:-7s">🎈</span><span style="left:85%;animation-duration:13s;animation-delay:-2s">🎈</span></div>
  <div id="spOwl"></div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
    <h1>مغامرة<br><span>القراءة</span></h1>
    <span class="ver">الإصدار 2.22</span>
    <button class="btn b-g startbtn" id="startBtn">▶ يلّا نلعب</button>
  </div>
</div>

<div id="shell">
  <nav id="nav" hidden>
    <button data-go="home" style="--c:#ff8e3c"><span>🏠</span><b>البيت</b></button>
    <button data-go="letters" style="--c:#4cc9f0"><span>🔤</span><b>الحروف</b></button>
    <button data-go="write" style="--c:#8e6cf0"><span>✏️</span><b>الكتابة</b></button>
    <button data-go="games" style="--c:#ff5da2"><span>🎮</span><b>الألعاب</b></button>
    <button data-go="quran" style="--c:#2ec4b6"><span>🕌</span><b>القرآن</b></button>
    <button data-go="book" style="--c:#ffd93d"><span>📖</span><b>الكتاب</b></button>
  </nav>
  <div id="col">
    <header id="hud" hidden>
      <button class="hb" id="backBtn" aria-label="رجوع" hidden>↩</button>
      <div class="me"><div class="av" id="hAv">👦</div><div style="flex:1;min-width:0"><b id="hName"></b><div class="xp"><i id="hXp"></i></div></div></div>
      <span class="pill">⭐<b id="hStars">0</b></span>
      <button class="hb" id="hGift" aria-label="هدية اليوم">🎁</button>
      <button class="hb" id="recBtn" aria-label="وضع التسجيل">🎙️</button>
      <button class="hb" id="setBtn" aria-label="الإعدادات">⚙️</button>
    </header>
    <div id="recbar" hidden>🔴 وضع التسجيل: اضغط على أي شي حتى تسجّل صوته <button id="recOff">إيقاف</button></div>
    <main id="view"></main>
  </div>
</div>

'''
s = s[:a] + body + s[b:]

# ---------- hud ----------
rep("$('#hName').textContent=(S.name||'')+' · مستوى '+lvl();", "$('#hName').textContent=(S.name||'')+'  ⚡'+lvl();")

# ---------- mascot: kid with book ----------
a = s.index('const OWL=`'); b = s.index('const botSay=')
KID = r'''const OWL=`<svg class=owl viewBox="0 0 200 230" aria-hidden="true">
<g class=spark><path d="M24 40 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5z" fill="#ffd93d" stroke="#2b1d52" stroke-width="3"/></g>
<g class=spark><path d="M174 26 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" fill="#ff5da2" stroke="#2b1d52" stroke-width="3"/></g>
<g class=spark><path d="M182 118 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#4cc9f0" stroke="#2b1d52" stroke-width="3"/></g>
<path d="M58 228 Q58 168 100 166 Q142 168 142 228Z" fill="#ff8e3c" stroke="#2b1d52" stroke-width="4"/>
<g class=head>
 <circle cx="100" cy="96" r="58" fill="#ffd2a8" stroke="#2b1d52" stroke-width="4"/>
 <ellipse cx="42" cy="100" rx="10" ry="14" fill="#ffd2a8" stroke="#2b1d52" stroke-width="4"/><ellipse cx="158" cy="100" rx="10" ry="14" fill="#ffd2a8" stroke="#2b1d52" stroke-width="4"/>
 <path d="M44 86 Q40 36 100 34 Q162 36 156 86 Q150 64 128 60 Q120 72 100 66 Q82 74 70 62 Q50 66 44 86Z" fill="#6b3e26" stroke="#2b1d52" stroke-width="4" stroke-linejoin="round"/>
 <g class=eye><ellipse cx="78" cy="98" rx="10" ry="12" fill="#fff"/><g class=pup><ellipse cx="78" cy="98" rx="8" ry="10" fill="#2b1d52"/><circle cx="81" cy="94" r="3.5" fill="#fff"/></g></g>
 <g class=eye><ellipse cx="122" cy="98" rx="10" ry="12" fill="#fff"/><g class=pup><ellipse cx="122" cy="98" rx="8" ry="10" fill="#2b1d52"/><circle cx="125" cy="94" r="3.5" fill="#fff"/></g></g>
 <ellipse cx="64" cy="118" rx="9" ry="6" fill="#ff8fa3" opacity=".8"/><ellipse cx="136" cy="118" rx="9" ry="6" fill="#ff8fa3" opacity=".8"/>
 <path class=mo d="M84 122 Q100 140 116 122 Q100 128 84 122Z" fill="#c2304b" stroke="#2b1d52" stroke-width="4" stroke-linejoin="round"/>
</g>
<path d="M40 176 L100 186 L160 176 L160 222 L100 230 L40 222Z" fill="#ff595e" stroke="#2b1d52" stroke-width="4" stroke-linejoin="round"/>
<path d="M46 172 L100 182 L100 222 L46 214Z" fill="#fff" stroke="#2b1d52" stroke-width="4" stroke-linejoin="round"/>
<path class=page d="M100 182 L154 172 L154 214 L100 222Z" fill="#fff" stroke="#2b1d52" stroke-width="4" stroke-linejoin="round"/>
<path d="M56 186 L90 191 M56 196 L90 201 M56 206 L84 210" stroke="#a99ad6" stroke-width="3" stroke-linecap="round"/>
<circle cx="44" cy="190" r="12" fill="#ffd2a8" stroke="#2b1d52" stroke-width="4"/><circle cx="156" cy="190" r="12" fill="#ffd2a8" stroke="#2b1d52" stroke-width="4"/>
</svg>`;
'''
s = s[:a] + KID + s[b:]
rep("say('هههه! دغدغتني!',false)", "say('هههه! دغدغتني!',false)")  # sanity (exists once)
rep("confetti(o,0,8,['💜','✨','🪶'])", "confetti(o,0,8,['⭐','✨','📚'])")
rep(".replace('class=owl','class=owl style=\"width:150px;height:165px\"')", ".replace('class=owl','class=owl style=\"width:150px;height:172px\"')")

# ---------- router ----------
rep("games:'games',game:'games',book:'book',page:'book'};", "games:'games',game:'games',gpick:'games',book:'book',page:'book',quran:'quran',surah:'quran'};")
rep("  scrollTo(0,0);SCR[n](v,a)}", "  v.scrollTop=0;SCR[n](v,a)}")
rep("$('#hud').hidden=plain;$('#nav').hidden=plain;", "$('#hud').hidden=plain;$('#nav').hidden=plain;")

# ---------- home ----------
rep_block("SCR.home=v=>{", "/* ================= wish (gift) ================= */", r'''SCR.home=v=>{ensureDay();const d=S.day,w=wishToday();const tdy=S.today&&S.today.d===todayStr()&&S.today.i<5?TOPTS[S.today.i]:null;
  const P=[['📖','الكتاب','#ff5da2','book'],['🔤','الحروف','#4cc9f0','letters'],['✏️','الكتابة','#8e6cf0','write'],['🎮','الألعاب','#ff8e3c','games'],['🎵','النشيد','#ffd93d','poem'],['🎙️','الأصوات','#ff595e','studio'],['🏆','جوائزي','#2ec4b6','awards']];
  v.innerHTML=`${botSay(HOMEQ().join('، '))}
  ${tdy?`<div class="card todaychip"><span style="font-size:30px">📌</span><span>درس اليوم: <b>${esc(tdy[1])}</b></span><button class="btn sm b-p" id=tdy>كمّل ▶</button></div>`:''}
  <div class=hgrid>
   <button class="hm wide" data-go=quran data-l="حفظ القرآن" style="--c:#2bb673"><span class=newb>جديد!</span><span class=ic>🕌</span><span class=tx><b>حفظ القرآن</b><small>جزء عمّ، ${AR(QS.length-1)} سورة والفاتحة</small></span></button>
   ${P.map((p,k)=>`<button class=hm data-go="${p[3]}" data-l="${p[1]}" style="--c:${p[2]};animation-delay:${(k+1)*.06}s"><span class=ic>${p[0]}</span><b>${p[1]}</b></button>`).join('')}
  </div>
  <div class=topcards><div class="card mini"><h4>🎯 مهمات اليوم ${d.done?'✅':''}</h4>${MIS.map(m=>{const n=Math.min(d[m[0]],m[1]);return`<div class="mrow ${n>=m[1]?'ok':''}"><span>${m[2]}</span><div class=bar><i style="width:${n/m[1]*100}%"></i></div><b>${n}/${m[1]}</b></div>`}).join('')}</div>
   <button class="card mini giftc" id=gift><span class=e>${w?w[0]:'🎁'}</span><b>${w?'هديتي: '+w[1]:'اختار هديتك!'}</b><small style="color:var(--mut)">${w?(d.done?'تستاهلها! 🎉':'خلّص المهمات'):'دوّس هنا'}</small></button></div>`;
  bind(v,'.hm',e=>{const b=$('.ic',e);b.classList.remove('wob');void b.offsetWidth;b.classList.add('wob');confetti(b,0,10);say(e.dataset.l,false);setTimeout(()=>go(e.dataset.go),380)});
  $('#gift').onclick=()=>askWish();
  if(tdy)$('#tdy').onclick=()=>tdy[2]();
  const nodes=$$('.hm .ic',v),iv=setInterval(()=>{const b=pickOne(nodes);b.classList.remove('wob');void b.offsetWidth;b.classList.add('wob')},2600);LEAVE.push(()=>clearInterval(iv));
  setTimeout(()=>say(HOMEQ()),300)};

''')
rep("$('#gift').onclick=()=>askWish();", "$('#gift').onclick=()=>askWish();")

# ---------- gift button in hud ----------
rep("$('#recBtn').onclick=()=>setRec(!REC);", "$('#recBtn').onclick=()=>setRec(!REC);$('#hGift').onclick=()=>askWish();")

# ---------- letter-specific games ----------
rep("letter:{t:'وين الحرف؟',e:'🔤',mk(){const i=rnd(28),", "letter:{t:'وين الحرف؟',e:'🔤',mk(o){const i=o&&o.letter?LT.indexOf(o.letter):rnd(28),")
rep("first:{t:'أول صوت',e:'🖼️',mk(){const t=pickOne(ALLW),", "first:{t:'أول صوت',e:'🖼️',mk(oo){const pool=oo&&oo.letter?ALLW.filter(w=>BASE(w[0][0])===oo.letter):ALLW;const t=pickOne(pool.length?pool:ALLW),")
rep("miss:{t:'الحرف الناقص',e:'❓',mk(){let w,i;for(let g=0;g<50;g++){w=pickOne(ALLW);i=rnd(w[0].length);if(LT.includes(BASE(w[0][i])))break}",
    "miss:{t:'الحرف الناقص',e:'❓',mk(o){let w,i;const L=o&&o.letter,pool=L?ALLW.filter(x=>[...x[0]].some(c=>BASE(c)===L)):ALLW;for(let g=0;g<50;g++){w=pickOne(pool.length?pool:ALLW);if(L){const ix=[...w[0]].map((c,j)=>BASE(c)===L?j:-1).filter(j=>j>=0);if(ix.length){i=pickOne(ix);break}}i=rnd(w[0].length);if(!L&&LT.includes(BASE(w[0][i])))break}")
rep("function gBub(v){const tg=pickOne(LET),", "function gBub(v,o){const tg=o&&o.letter?letObj(o.letter):pickOne(LET),")
# games list -> picker
a = s.index("SCR.games=v=>{"); b = s.index("SCR.game=async")
s = s[:a] + r'''const LGAMES=['letter','first','pos','miss','bubbles'];
SCR.games=v=>{v.innerHTML=`${botSay('أي لعبة نلعب؟')}<div class=gcards>${Object.entries(G).filter(g=>!g[1].hide).map(([k,g],i)=>{const b=S.games[k]||0;return`<button class="gcard ${CL(i)}" data-k=${k} style="animation-delay:${i*.04}s">${LGAMES.includes(k)?'<span class=pk>🔤 حسب الحرف</span>':''}<span class=e>${g.e}</span><b>${g.t}</b><span class=st>${'⭐'.repeat(b)}${'☆'.repeat(3-b)}</span></button>`}).join('')}</div>`;
  bind(v,'.gcard',e=>{sq(e);const k=e.dataset.k;LGAMES.includes(k)?go('gpick',{id:k}):go('game',{id:k})});say('أي لعبة نلعب؟')};
SCR.gpick=(v,o)=>{const g=G[o.id];const BC=['#ff5da2','#4cc9f0','#6bcb77','#ff8e3c','#8e6cf0','#ffd93d','#ff595e','#2ec4b6'];
  v.innerHTML=`<h2 class=t>${g.e} ${g.t}</h2><div class=sub>اختار الحرف اللي تريد تتدرّب عليه</div><div class=row><button class="btn b-y" id=allL>🎲 كل الحروف</button></div>
  <div class=balls>${LET.map((l,i)=>{const b=S.games[o.id+':'+l[0]]||0;return`<button class=bal style="animation-delay:${i*.02}s"><div style="--c:${BC[i%8]}">${l[0]}</div>${b?`<em>${'⭐'.repeat(b)}</em>`:''}</button>`}).join('')}</div>`;
  bind(v,'.bal',(e,i)=>{e.classList.add('pop');SFX.pop();confetti(e,0,10,['🎈','⭐','✨']);say('حرف '+NM[i],false);setTimeout(()=>go('game',{id:o.id,letter:LT[i]}),420)});
  $('#allL').onclick=()=>go('game',{id:o.id});
  say('اختار الحرف اللي تريد تتدرّب عليه')};
''' + s[b:]
rep("async function finish(v,id,mis,o,starsOverride){stop();const st=starsOverride||(mis===0?3:mis<=2?2:1);S.games[id]=Math.max(S.games[id]||0,st);",
    "async function finish(v,id,mis,o,starsOverride){stop();const st=starsOverride||(mis===0?3:mis<=2?2:1);S.games[id]=Math.max(S.games[id]||0,st);if(o&&o.letter){const kk=id+':'+o.letter;S.games[kk]=Math.max(S.games[kk]||0,st)}")
rep('<div class="card qbox"><div class="q live">${esc(d.txt||d.q)}</div><div class=vis>${d.vis||\'\'}</div></div><div class="opts ${d.c3?\'c3\':\'\'}">${d.opts.map((x,k)=>`<button class="opt ${d.big?\'big\':\'\'}" style="animation-delay:${k*.06}s">${x.h}</button>`).join(\'\')}</div>`',
    '<div class=gplay><div class="card qbox"><div class="q live">${esc(d.txt||d.q)}</div><div class=vis>${d.vis||\'\'}</div></div><div class="opts ${d.c3?\'c3\':\'\'}">${d.opts.map((x,k)=>`<button class="opt ${d.big?\'big\':\'\'}" style="animation-delay:${k*.06}s">${x.h}</button>`).join(\'\')}</div></div>`')
# hotspots focusable for TV
s = s.replace('<i class="hs ', '<i tabindex=0 class="hs ').replace('<i class=hs ', '<i tabindex=0 class=hs ')

# splash -> owl size
rep("$('#spOwl').outerHTML=OWL;", "$('#spOwl').outerHTML=OWL;")

# ---------- phrases ----------
rep("  T.forEach(t=>t.split('|').forEach(add));POEM.forEach(add);\n  return[...out]}",
    "  T.forEach(t=>t.split('|').forEach(add));POEM.forEach(add);\n  add(['اختار الحرف اللي تريد تتدرّب عليه','حفظ القرآن','أي سورة نحفظ اليوم؟','هسه دورك! ردّد الآية','اقرا الآية من حفظك','ما سمعتك زين، قرّب واقرا بصوت أعلى','ممتاز! الآية صحيحة','ماشاء الله! حفظت السورة كلها']);for(const g of ['m','f']){S.g=g;add([G2('قريب! اسمع الآية وجرّب مرة ثانية','قريبة! اسمعي الآية وجرّبي مرة ثانية'),G2('عفية! ختمت السورة','عفية! ختمتي السورة')])}S.g=g0;\n  QS.forEach(q=>add('سورة '+q[1]));\n  return[...out]}")

# ---------- quran module + tv nav: insert before studio ----------
QJS = open('/home/claude/v3/quran.js', encoding='utf-8').read()
rep("/* ================= studio & recorder ================= */", QJS + "\n/* ================= studio & recorder ================= */")
rep("const CATS=[['👦','اسم الطفل',()=>[S.name].filter(Boolean)],", "const CATS=[['👦','اسم الطفل',()=>[S.name].filter(Boolean)],['🕌','أسماء السور',()=>QS.map(q=>'سورة '+q[1])],")


# ================= v2.23 changes =================
ICJS = open('/home/claude/v3/icons.js', encoding='utf-8').read()
rep("function hsh(s){", ICJS + "\nfunction hsh(s){")
# nav icons
rep("$$('#nav button').forEach(b=>b.onclick=()=>{sq(b);go(b.dataset.go)});", "const NAVI={home:'home',letters:'letters',write:'pencil',games:'game',quran:'mosque',book:'book'};$$('#nav button').forEach(b=>{b.querySelector('span').innerHTML=ic(NAVI[b.dataset.go]);b.onclick=()=>{sq(b);go(b.dataset.go)}});")
# hud icons
rep('<button class="hb" id="backBtn" aria-label="رجوع" hidden>↩</button>', '<button class="hb" id="backBtn" aria-label="رجوع" hidden></button>')
rep('<span class="pill">⭐<b id="hStars">0</b></span>', '<span class="pill" id="hStarP"><b id="hStars">0</b></span>')
rep("$('#recBtn').onclick=()=>setRec(!REC);", "$('#backBtn').innerHTML=ic('back');$('#setBtn').innerHTML=ic('gear');$('#recBtn').innerHTML=ic('mic');$('#hStarP').insertAdjacentHTML('afterbegin',ic('star'));$('#recBtn').onclick=()=>setRec(!REC);")
rep("$('#hAv').textContent=G2('👦','👧');", "$('#hAv').innerHTML=ic('kid');")
rep("const w=wishToday();$('#hGift').textContent=w?w[0]:'🎁'}", "const w=wishToday();$('#hGift').innerHTML=w?w[0]:ic('gift')}")
# home tiles
rep("const P=[['📖','الكتاب','#ff5da2','book'],['🔤','الحروف','#4cc9f0','letters'],['✏️','الكتابة','#8e6cf0','write'],['🎮','الألعاب','#ff8e3c','games'],['🎵','النشيد','#ffd93d','poem'],['🎙️','الأصوات','#ff595e','studio'],['🏆','جوائزي','#2ec4b6','awards']];",
    "const P=[['book','الكتاب','#ff5da2','book'],['letters','الحروف','#4cc9f0','letters'],['pencil','الكتابة','#8e6cf0','write'],['game','الألعاب','#ff8e3c','games'],['music','النشيد','#ffd93d','poem'],['mic','الأصوات','#ff595e','studio'],['trophy','جوائزي','#2ec4b6','awards']];")
rep('<button class="hm wide" data-go=quran data-l="حفظ القرآن" style="--c:#2bb673"><span class=newb>جديد!</span><span class=ic>🕌</span><span class=tx><b>حفظ القرآن</b><small>جزء عمّ، ${AR(QS.length-1)} سورة والفاتحة</small></span></button>',
    '<button class="hm wide" data-go=quran data-l="حفظ القرآن" style="--c:#2bb673"><span class=ic>${ic(\'mosque\')}</span><b>حفظ القرآن</b></button>')
rep('<span class=ic>${p[0]}</span><b>${p[1]}</b>', '<span class=ic>${ic(p[0])}</span><b>${p[1]}</b>')
rep("const MIS=[['g',3,'🎮'],['w',4,'✏️'],['p',3,'📖']];", "const MIS=[['g',3,'game'],['w',4,'pencil'],['p',3,'book']];")
rep('<div class="mrow ${n>=m[1]?\'ok\':\'\'}"><span>${m[2]}</span>', '<div class="mrow ${n>=m[1]?\'ok\':\'\'}"><span>${ic(m[2])}</span>')
# games icons
GI = {'letter':'search','first':'letters','pos':'puzzle','miss':'question','read':'book','hear':'headphones','madd':'wave','haraka':'music','count':'num','next':'plus','build':'blocks','memory':'cards','bubbles':'bubbles','hunt':'image','odd':'eye'}
rep("SCR.games=v=>{", "const GICON=" + json.dumps(GI) + ";\nSCR.games=v=>{")
rep("${LGAMES.includes(k)?'<span class=pk>🔤 حسب الحرف</span>':''}<span class=e>${g.e}</span>", "<span class=e>${ic(GICON[k]||'game')}</span>")
rep("v.innerHTML=`<h2 class=t>${g.e} ${g.t}</h2><div class=sub>اختار الحرف اللي تريد تتدرّب عليه</div><div class=row><button class=\"btn b-y\" id=allL>🎲 كل الحروف</button></div>",
    "v.innerHTML=`<h2 class=t>${g.t}</h2><div class=row><button class=\"btn b-y\" id=allL>كل الحروف</button></div>")
# hello chips icons
rep("const TOPTS=[['🔤','الحروف',", "const TOPTS=[['letters','الحروف',")
rep("['📖','الكتاب',()=>go('book')],['✏️','الكتابة',()=>go('write')],['🔢','الأرقام',()=>go('game',{id:'count'})],['🎵','النشيد',()=>go('poem')],['🙈','ما انطونه شي',()=>go('home')]];",
    "['book','الكتاب',()=>go('book')],['pencil','الكتابة',()=>go('write')],['num','الأرقام',()=>go('game',{id:'count'})],['music','النشيد',()=>go('poem')],['home','ما انطونه شي',()=>go('home')]];")
rep('<span class=e>${o[0]}</span>${o[1]}</button>', '<span class=e>${ic(o[0])}</span>${o[1]}</button>')
# settings: reading mode
rep('<label class=field>سرعة الصوت:', '<button class="btn b-t" id=qmS style="width:100%;margin:6px 0">${ic(\'mosque\')} طريقة قراءة القرآن</button>\n  <label class=field>سرعة الصوت:')
rep("$('#chn',sh).onclick=()=>{", "$('#qmS',sh).onclick=()=>{save();sh.remove();qModeSheet()};\n  $('#chn',sh).onclick=()=>{")
rep('<span class="ver">الإصدار 2.22</span>', '<span class="ver">الإصدار 2.23</span>')
open('/home/claude/v3/template.html', 'w', encoding='utf-8').write(s)
print('ok', len(s))

# ================= v2.24: interactive book =================
BJS = open('/home/claude/v3/book.js', encoding='utf-8').read()
a = s.index("/* ================= book ================= */"); b = s.index("/* ================= poem ================= */")
s = s[:a] + BJS + "\n" + s[b:]
rep("if($('#bk'))$('#bk').onclick=()=>go('page',LBOOK[c]);", "if($('#bk'))$('#bk').onclick=()=>go('book',{p:LBOOK[c]});")
rep('<span class="ver">الإصدار 2.23</span>', '<span class="ver">الإصدار 2.24</span>')
open('/home/claude/v3/template.html', 'w', encoding='utf-8').write(s)
