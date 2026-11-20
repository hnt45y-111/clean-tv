/* ================= quran (juz amma) ================= */
const QS=[[1,'الفاتحة',7],[114,'الناس',6],[113,'الفلق',5],[112,'الإخلاص',4],[111,'المسد',5],[110,'النصر',3],[109,'الكافرون',6],[108,'الكوثر',3],[107,'الماعون',7],[106,'قريش',4],[105,'الفيل',5],[104,'الهمزة',9],[103,'العصر',3],[102,'التكاثر',8],[101,'القارعة',11],[100,'العاديات',11],[99,'الزلزلة',8],[98,'البينة',8],[97,'القدر',5],[96,'العلق',19],[95,'التين',8],[94,'الشرح',8],[93,'الضحى',11],[92,'الليل',21],[91,'الشمس',15],[90,'البلد',20],[89,'الفجر',30],[88,'الغاشية',26],[87,'الأعلى',19],[86,'الطارق',17],[85,'البروج',22],[84,'الانشقاق',25],[83,'المطففين',36],[82,'الانفطار',19],[81,'التكوير',29],[80,'عبس',42],[79,'النازعات',46],[78,'النبأ',40]];
const AR=n=>String(n).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const QBC=['#ff5da2','#4cc9f0','#6bcb77','#ff8e3c','#8e6cf0','#ffd93d','#ff595e','#2ec4b6'];
const QD=n=>{const D=window.QURAN_DATA;return D&&D.surahs&&D.surahs[n]?D.surahs[n]:null};
const Qst=n=>{S.q=S.q||{};return S.q[n]=S.q[n]||{c:0}};
/* ---------- player: one audio element per surah, seamless pauses ---------- */
const QP={a:null,src:null};
function qAudio(src){if(QP.src!==src){if(QP.a){try{QP.a.pause()}catch(e){}}QP.a=new Audio(src);QP.a.preload='auto';QP.src=src}return QP.a}
function qFade(a,to,ms){return new Promise(r=>{const from=a.volume,st=performance.now();(function f(){const k=Math.min(1,(performance.now()-st)/ms);try{a.volume=Math.max(0,Math.min(1,from+(to-from)*k))}catch(e){}k<1?setTimeout(f,16):r()})()})}
function qSeek(a,sec){return new Promise(r=>{let done=false;const fin=()=>{if(!done){done=true;a.removeEventListener('seeked',fin);r()}};
  const go=()=>{if(Math.abs(a.currentTime-sec)<.05)return fin();a.addEventListener('seeked',fin);try{a.currentTime=sec}catch(e){fin()}};
  if(a.readyState<1)a.addEventListener('loadedmetadata',go,{once:true});else go();setTimeout(fin,2500)})}
async function waitT(ms,t){const end=Date.now()+ms;while(Date.now()<end){if(t!==tok)return false;await sleep(80)}return t===tok}
/* opts:{single,rep,pause(i)->ms|0,onAyah(i),onTurn(i)} ; returns 'end' | 'one' | 'stop' */
async function qRun(n,startI,o){stop();const t=tok,D=QD(n),N=D.u.length,rep=o.rep||1;let i=startI;
  if(D.f&&D.t&&!D.a){const a=qAudio(D.f),T=D.t;curAud=a;curRes=null;a.volume=1;
    await qSeek(a,T[i][0]/1000);if(t!==tok)return'stop';o.onAyah&&o.onAyah(i);
    try{await a.play()}catch(e){return'stop'}curAud=a;
    let r=1;
    const FD=170;
    while(t===tok){await sleep(25);const ms=a.currentTime*1000,last=i>=N-1;
      const pm=(!o.single&&!last&&r>=rep&&o.pause)?o.pause(i,T[i][1]-T[i][0]):0;
      const stopping=r<rep||o.single||last||pm>0;
      if(a.ended||ms>=T[i][1]-(stopping?FD:25)){
        if(r<rep){r++;await qFade(a,0,FD);a.pause();await qSeek(a,T[i][0]/1000);if(t!==tok)return'stop';a.volume=0;try{await a.play()}catch(e){return'stop'}curAud=a;qFade(a,1,FD);continue}
        r=1;
        if(o.single||last){await qFade(a,0,FD);a.pause();a.volume=1;return last?'end':'one'}
        if(pm){await qFade(a,0,FD);a.pause();o.onTurn&&o.onTurn(i);if(!await waitT(pm,t))return'stop'}
        i++;o.onAyah&&o.onAyah(i);
        if(a.paused){await qSeek(a,T[i][0]/1000);if(t!==tok)return'stop';a.volume=0;try{await a.play()}catch(e){return'stop'}curAud=a;qFade(a,1,FD)}
      }}
    return'stop'}
  /* per-ayah files */
  for(;i<N;i++){o.onAyah&&o.onAyah(i);
    for(let r=0;r<rep;r++){if(i===0&&r===0&&n!==1&&window.QURAN_DATA.bsm){await qClip(window.QURAN_DATA.bsm);if(t!==tok)return'stop'}
      const t1=Date.now();await qClip(D.a[i]);if(t!==tok)return'stop';
      if(r===rep-1&&!o.single&&i<N-1){const pm=o.pause?o.pause(i,Date.now()-t1):0;if(pm){o.onTurn&&o.onTurn(i);if(!await waitT(pm,t))return'stop'}}}
    if(o.single)return'one'}
  return'end'}
function qClip(src){return new Promise(r=>{if(!src)return r();const a=new Audio(src);let d=0;const fin=()=>{if(!d){d=1;r()}};curAud=a;curRes=fin;a.onended=fin;a.onerror=fin;a.play().catch(fin)})}

const QMODES=[['cont','القارئ والأطفال يقرون السورة كاملة','headphones'],['pause','بعد كل آية وقفة حتى يردد '+'ابني','kid'],['solo','القارئ يكمّل السورة، وبعدها ابني يقرا وحده','mic']];
function qModeSheet(onDone){const sh=document.createElement('div');sh.className='shade';const m=S.qm||'cont',r=S.qrep||1;
  sh.innerHTML=`<div class=sheet><h3>طريقة القراءة</h3><div class=qmodes>${QMODES.map(x=>`<button class="qmode ${x[0]===m?'on':''}" data-m=${x[0]}>${ic(x[2])}<span>${x[1].replace('ابني',esc(S.name||'ابني'))}</span>${x[0]===m?ic('check','ck'):''}</button>`).join('')}</div>
   <div class=reprow><span>${ic('repeat')}</span>${[1,2,3].map(k=>`<button data-r=${k} class="${k===r?'on':''}">${AR(k)}</button>`).join('')}</div>
   <div class=row><button class="btn b-g" id=ok>${ic('check')}</button></div></div>`;
  document.body.appendChild(sh);
  bind(sh,'.qmode',e=>{S.qm=e.dataset.m;save();$$('.qmode',sh).forEach(x=>{x.classList.toggle('on',x===e);const c=x.querySelector('.ck');if(c)c.remove()});e.insertAdjacentHTML('beforeend',ic('check','ck'))});
  bind(sh,'[data-r]',e=>{S.qrep=+e.dataset.r;save();$$('[data-r]',sh).forEach(x=>x.classList.toggle('on',x===e))});
  const close=()=>{sh.remove();onDone&&onDone()};$('#ok',sh).onclick=close;sh.onclick=e=>{if(e.target===sh)close()}}

SCR.quran=v=>{const D=window.QURAN_DATA;
  v.innerHTML=`<div class=qban><span class=moon>${ic('mosque')}</span><b>حفظ القرآن</b></div>
  ${!D?`<div class=tip>ملفات القرآن بعدها ما نزلت. شغّل RUN.bat على الحاسوب.</div>`:''}
  <div class=surs>${QS.map((q,i)=>{const st=qStars(q[0]);return`<div class=sur role=button tabindex=0 data-i=${i} style="animation-delay:${Math.min(i,12)*.03}s"><span class=num style="--c:${QBC[i%8]}">${AR(q[0])}</span><span class=n><b>${q[1]}</b><small>${AR(q[2])} ${q[2]>2&&q[2]<11?'آيات':'آية'}</small></span><span class=st>${[0,1,2].map(k=>ic('star',k<st?'on':'')).join('')}</span><button class=spk data-i=${i} aria-label="اسم السورة">${ic('speaker')}</button></div>`}).join('')}</div>`;
  $$('.sur',v).forEach(e=>e.onclick=ev=>{const q=QS[+e.dataset.i];if(ev.target.closest('.spk')){sq(ev.target.closest('.spk'));say('سورة '+q[1]);return}sq(e);say('سورة '+q[1]);setTimeout(()=>go('surah',{n:q[0]}),650)});
  say('أي سورة نحفظ اليوم؟')};
function qStars(n){const p=(S.q||{})[n];const c=p&&p.c||0;return c>=5?3:c>=3?2:c>=1?1:0}

SCR.surah=(v,a)=>{const q=QS.find(x=>x[0]===a.n),D=QD(a.n);
  if(!D){v.innerHTML=`<h2 class=t>سورة ${q[1]}</h2><div class=tip>ملفات هاي السورة بعدها ما نزلت.</div>`;return}
  const N=D.u.length,P=Qst(a.n);let i=0,playing=false;
  v.innerHTML=`<div class=shead><h2 class=t>سورة ${q[1]}</h2><button class="hb splay" id=pl aria-label="تشغيل">${ic('play')}</button></div>
   <div class=mushaf id=mus>${D.u.map((u,k)=>`<button class=ay data-k=${k}>${esc(u.replace(/\ufeff/g,''))}<span class=am>${AR(k+1)}</span></button>`).join(' ')}</div>`;
  const ays=$$('.ay',v),pl=$('#pl');
  const mark=k=>{i=k;ays.forEach((e,j)=>{e.classList.toggle('on',j===k);e.classList.remove('turn')});const e=ays[k];if(e){const m=$('#mus');const r=e.getBoundingClientRect(),vr=$('#view').getBoundingClientRect();if(r.top<vr.top+60||r.bottom>vr.bottom-150)e.scrollIntoView({block:'center',behavior:'smooth'})}};
  const turn=k=>{ays[k]&&ays[k].classList.add('turn')};
  const setBtn=p=>{playing=p;pl.innerHTML=ic(p?'pause':'play')};
  const pauseFn=(k,dur)=>{const m=S.qm||'cont';if(m!=='pause')return 0;const kidsRec=D.f&&!D.a;return Math.min(14000,Math.max(2500,dur*(kidsRec?.55:1)))};
  const runFrom=async(k,single)=>{setBtn(!single);const res=await qRun(a.n,k,{single,rep:S.qrep||1,pause:single?null:pauseFn,onAyah:mark,onTurn:turn});
    if(res==='end'&&!single){P.c=(P.c||0)+1;save();setBtn(false);
      if((S.qm||'cont')==='solo'){ays.forEach(e=>e.classList.remove('on'));$('#mus').classList.add('solo');await say(['هسه دورك',S.name]);}
      else{SFX.lvl();confetti(innerWidth/2,innerHeight/2,40,['⭐','🌙','✨']);addXP(15);addStars(1,pl);say(G2('عفية! ختمت السورة','عفية! ختمتي السورة'))}}
    else if(res!=='stop')setBtn(false)};
  pl.onclick=()=>{if(playing){stop();setBtn(false);return}$('#mus').classList.remove('solo');runFrom(i,false)};
  bind(v,'.ay',(e,k)=>{stop();$('#mus').classList.remove('solo');mark(k);runFrom(k,true);setBtn(false)});
  LEAVE.push(()=>{if(QP.a){try{QP.a.pause()}catch(e){}}});
  mark(0);setTimeout(()=>say('سورة '+q[1]),250)};

/* ================= TV remote / keyboard navigation ================= */
(function(){const vis=el=>{if(el.disabled||el.closest('[hidden]'))return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight+400};
  const D={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  document.addEventListener('pointerdown',()=>document.body.classList.remove('kbd'),true);
  document.addEventListener('keydown',e=>{const k=e.key;const ae=document.activeElement;if(ae&&ae.tagName==='INPUT'&&(k==='ArrowLeft'||k==='ArrowRight'))return;
    if(D[k]){document.body.classList.add('kbd');const scope=$('.shade')||document;const cand=$$('button,[tabindex="0"],input,label.btn',scope).filter(vis);
      const cur=ae&&cand.includes(ae)?ae:null;e.preventDefault();
      if(!cur){const f=cand.find(x=>x.closest('#view'))||cand[0];f&&f.focus();return}
      const r=cur.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,[dx,dy]=D[k];let best=null,bs=1e9;
      for(const el of cand){if(el===cur)continue;const q=el.getBoundingClientRect(),vx=q.left+q.width/2-cx,vy=q.top+q.height/2-cy,along=vx*dx+vy*dy;if(along<=6)continue;if(Math.abs(vx*dy-vy*dx)>along*3)continue;const sc=along+Math.abs(vx*dy-vy*dx)*2.5;if(sc<bs){bs=sc;best=el}}
      if(best){best.focus({preventScroll:true});best.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})}}
    else if((k==='Enter'||k===' ')&&ae&&ae!==document.body&&ae.tagName!=='BUTTON'&&ae.tagName!=='INPUT'){e.preventDefault();ae.click()}
    else if(k==='Escape'||k==='BrowserBack'||k==='GoBack'){if(window.appBack)appBack()}});
})();
