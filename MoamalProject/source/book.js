/* ================= interactive book (قراءتي الجديدة) ================= */
let seenToday=new Set();
const BE={'باب':'🚪','مربى':'🍯','بطة':'🦆','دار':'🏡','نار':'🔥','مستشفى':'🏥','غزال':'🦌','بقرة':'🐄','مرمى':'🥅','حلوى':'🍬','بومة':'🦉','خروف':'🐑','دمية':'🪆','نجوم':'✨','حاسوب':'💻','بندق':'🌰','بوق':'📯','توت':'🍓','حوت':'🐳','صوص':'🐥','ليمون':'🍋','ميزان':'⚖️','فيل':'🐘','حليب':'🥛','ريش':'🪶','ديك':'🐓','بطيخ':'🍉','سفينة':'🚢','برتقال':'🍊','بصل':'🧅','طبيب':'🧑‍⚕️','خبز':'🍞','موز':'🍌','مربع':'🟥','مفتاح':'🔑','ثوم':'🧄','قمح':'🌾','مثلث':'🔺','مقص':'✂️','دلة':'☕','دب':'🐻','درهم':'🪙','أسد':'🦁','قدر':'🍲','دود':'🪱','درج':'🪜','فراشة':'🦋','فستان':'👗','فنجان':'🍵','معطف':'🧥','فانوس':'🏮','نافورة':'⛲','فهد':'🐆','عصفور':'🐦','فم':'👄','سمكة':'🐟','شبكة':'🕸️','بابا':'👨','ماما':'👩','جدو':'👴','جدة':'👵','أخي':'👦','أختي':'👧','بساط':'🧶','سوار':'📿','تين':'🫐','مزمار':'🎺','دبس':'🫙','دور':'🏘️','فرن':'🧱','بوم':'🦉','بابي':'🚪','مفيد':'👍','دادا':'🤱'};
const BLC=['#ff5da2','#4cc9f0','#6bcb77','#ff8e3c','#8e6cf0','#ffd93d','#ff595e','#2ec4b6'];
const TL=i=>T[i].split('|');
const W=(...w)=>({k:'words',w});
const BOOK=[
 {k:'cover'},
 {k:'toc'},
 {c:1,b:[{k:'lines',l:TL(2).slice(1,6)},W('بطة','سمكة','شبكة','نار')]},
 {c:1,b:[{k:'pick',q:'وين الكرة المختلفة؟',o:['⚽','🏀','⚽'],a:1},{k:'pick',q:'وين الكتاب المختلف؟',o:['📘','📘','📕'],a:2},{k:'pick',q:'وين المتشابه؟',o:['🍎','🍌','🍎'],a:0,two:1}]},
 {c:1,b:[{k:'pick',q:'وين القلم الأطول؟',o:['✏️','✏️'],sz:[44,80],a:1},{k:'pick',q:'وين الزرافة الأطول؟',o:['🦒','🦒'],sz:[86,52],a:0},{k:'places'},{k:'dirs'}]},
 {c:1,b:[{k:'sounds',w:['باب','نار','فيل','دب']}]},
 {c:2,b:[{k:'words',w:TL(6).slice(1),h:'اى'}]},
 {c:2,b:[{k:'words',w:TL(7).slice(1),h:'اى'},{k:'trace',c:'ا'}]},
 {c:2,b:[{k:'words',w:TL(8).slice(1),h:'و'}]},
 {c:2,b:[{k:'words',w:TL(9).slice(1),h:'و'},{k:'trace',c:'و'}]},
 {c:2,b:[{k:'words',w:TL(10).slice(1),h:'ي'}]},
 {c:2,b:[{k:'words',w:TL(11).slice(1),h:'ي'},{k:'trace',c:'ي'}]},
 {c:3,b:[W('بابا','ماما','جدو','جدة','أخي','أختي'),{k:'lines',l:TL(12).slice(3)}]},
 {c:4,b:[{k:'letter',c:'ب'},W(...HS[13].map(z=>z[0]))]},
 {c:4,b:[{k:'words',w:TL(14).slice(1),h:'ب'},{k:'trace',c:'ب'}]},
 {c:4,b:[{k:'build',p:['با','ب']},{k:'build',p:['با','با']},{k:'build',p:['با','بي']}]},
 {c:5,b:[{k:'letter',c:'م'},{k:'words',w:TL(16).slice(1),h:'م'}]},
 {c:5,b:[{k:'words',w:TL(17).slice(1),h:'م'},{k:'trace',c:'م'}]},
 {c:5,b:[{k:'build',p:['ما','ما']},{k:'build',p:['بو','م']}]},
 {c:6,b:[{k:'letter',c:'د'},{k:'words',w:TL(19).slice(1),h:'د'}]},
 {c:6,b:[{k:'words',w:TL(20).slice(1),h:'د'},{k:'trace',c:'د'}]},
 {c:6,b:[{k:'build',p:['دا','دا']},{k:'build',p:['دو','د']}]},
 {c:7,b:[{k:'letter',c:'ف'},{k:'words',w:TL(22).slice(1),h:'ف'}]},
 {c:7,b:[{k:'words',w:TL(23).slice(1),h:'ف'},{k:'trace',c:'ف'}]},
 {c:7,b:[{k:'build',p:['فـ','م'],w:'فم'},{k:'build',p:['مـ','فيـ','د'],w:'مفيد'}]},
 {c:8,b:[{k:'lines',l:POEM,poem:1}]}
];
const BCH=[null,['التهيئة','#ff8e3c','star'],['أصوات المد','#4cc9f0','wave'],['أسرتي','#ff5da2','kid'],['حرف الباء','#8e6cf0','letters'],['حرف الميم','#6bcb77','letters'],['حرف الدال','#ff595e','letters'],['حرف الفاء','#2ec4b6','letters'],['نشيد ماما بابا','#ffd93d','music']];
const bTitle=i=>i===0?'قراءتي الجديدة':i===1?'الفهرس':i===25?'ماما بابا':TL(i)[0];
function hlWord(w,h){if(!h)return esc(w);const ix=[...w].findIndex((c,k)=>h.includes(c)&&k>0);return ix<0?esc(w):hl(w,ix)}

let BK={i:0,busy:false};
SCR.book=(v,a)=>{let start=a&&a.p!=null?a.p:(S.bk||0);if(typeof a==='number')start=a;BK.i=Math.max(0,Math.min(BOOK.length-1,start));
  v.innerHTML=`<div class=bkwrap><div class=book id=book><div class=bspine></div></div></div>
   <div class=bkfoot><button class="bknav prev" id=bkPrev aria-label="الصفحة السابقة">${ic('back')}</button><div class=bkbar><i id=bkProg></i></div><span id=bkNum></span><button class="bknav next" id=bkNext aria-label="الصفحة الجاية">${ic('back')}</button></div>`;
  const book=$('#book');
  const mount=(i,under)=>{const el=document.createElement('div');el.className='bpage';el.innerHTML=renderPage(i);if(under)book.insertBefore(el,book.firstChild.nextSibling);else book.appendChild(el);wirePage(el,i);return el};
  const setFoot=()=>{$('#bkNum').textContent=AR(BK.i+1)+' / '+AR(BOOK.length);$('#bkProg').style.width=((BK.i+1)/BOOK.length*100)+'%';$('#bkPrev').disabled=BK.i===0;$('#bkNext').disabled=BK.i===BOOK.length-1};
  const visit=i=>{S.bk=i;if(!S.pages[i]){S.pages[i]=1}save();if(!seenToday.has(i)){seenToday.add(i);progress('p');checkBadges()}};
  let curEl=mount(BK.i);setFoot();visit(BK.i);setTimeout(()=>sayPage(BK.i),350);
  const turn=dir=>{const ni=BK.i+dir;if(BK.busy||ni<0||ni>=BOOK.length)return;stop();BK.busy=true;SFX.flip();
    if(dir>0){const nx=mount(ni,true);const old=curEl;old.classList.add('turning');
      old.animate([{transform:'rotateY(0deg)',filter:'brightness(1)'},{transform:'rotateY(-165deg)',filter:'brightness(.7)'}],{duration:650,easing:'cubic-bezier(.45,.05,.3,1)',fill:'forwards'}).onfinish=()=>{old.remove();curEl=nx;BK.busy=false}}
    else{const nx=mount(ni,false);nx.classList.add('turning');const old=curEl;
      nx.animate([{transform:'rotateY(-165deg)',filter:'brightness(.7)'},{transform:'rotateY(0deg)',filter:'brightness(1)'}],{duration:650,easing:'cubic-bezier(.45,.05,.3,1)',fill:'forwards'}).onfinish=()=>{old.remove();nx.classList.remove('turning');curEl=nx;BK.busy=false}}
    BK.i=ni;setFoot();visit(ni);setTimeout(()=>sayPage(ni),500)};
  BK.turn=turn;BK.jump=i=>{if(i===BK.i)return;stop();const old=curEl;curEl=mount(i);old.remove();BK.i=i;setFoot();visit(i);sayPage(i)};
  $('#bkNext').onclick=()=>turn(1);$('#bkPrev').onclick=()=>turn(-1);
  let sx=null,sy=null;book.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;sx=e.clientX;sy=e.clientY});
  book.addEventListener('pointerup',e=>{if(sx==null)return;const dx=e.clientX-sx,dy=e.clientY-sy;sx=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.3)turn(dx>0?1:-1)});
  const kd=e=>{if(e.key==='PageDown')turn(1);if(e.key==='PageUp')turn(-1)};document.addEventListener('keydown',kd);LEAVE.push(()=>document.removeEventListener('keydown',kd))};
SCR.page=(v,a)=>SCR.book(v,{p:typeof a==='object'?a.i:a});
function sayPage(i){if(i===0)return say('قراءتي الجديدة');if(i===1)return;say(bTitle(i))}

function renderPage(i){const p=BOOK[i];
  if(p.k==='cover')return`<div class=bcover><div class=bcv-kid>${OWL}</div><div class=bcv-t>قراءتي<br><span>الجديدة</span></div><button class="bplay big" data-act=open aria-label="افتح الكتاب">${ic('play')}</button></div>`;
  if(p.k==='toc')return`<div class=bhead><b>الفهرس</b></div><div class=btoc>${BCH.slice(1).map((c,k)=>{const first=BOOK.findIndex(x=>x.c===k+1);return`<button class=btc data-go=${first} style="--c:${c[1]}"><span class=bti>${ic(c[2])}</span><b>${c[0]}</b><em>${AR(first+1)}</em></button>`}).join('')}</div>`;
  const ch=BCH[p.c];
  return`<div class=bhead style="--c:${ch[1]}"><span class=bchip>${ic(ch[2])}</span><b>${esc(bTitle(i))}</b><button class=bplay data-act=title aria-label="اسمع">${ic('speaker')}</button></div>
   <div class=bbody>${p.b.map((b,k)=>renderBlock(b,k)).join('')}</div><div class=bpn>${AR(i+1)}</div>`}

function renderBlock(b,k){
  if(b.k==='lines')return`<div class="bblk blines ${b.poem?'poem':''}" data-b=${k}><button class=bplay data-act=lines aria-label="اقرا">${ic('play')}</button>${b.l.map((l,j)=>`<button class=bl data-j=${j}>${esc(l)}</button>`).join('')}</div>`;
  if(b.k==='words'||b.k==='sounds')return`<div class="bblk bwords" data-b=${k}>${b.w.map((w,j)=>`<button class=bw data-j=${j} style="--c:${BLC[(j+k)%8]}"><span class=be>${BE[w]||emojiOf(w)||`<span class=bltr>${w[0]}</span>`}</span><b>${b.k==='sounds'?esc(w):hlWord(w,b.h)}</b></button>`).join('')}</div>`;
  if(b.k==='letter')return`<div class="bblk bletter" data-b=${k}><button class=bL data-act=L>${b.c}</button><div class=bhar>${HAR(b.c).map((s,j)=>`<button data-j=${j} style="--c:${BLC[j]}">${s}</button>`).join('')}</div></div>`;
  if(b.k==='build'){const w=b.w||b.p.join('');return`<div class="bblk bbuild" data-b=${k}><span class=be>${BE[w]||''}</span><div class=bslots>${b.p.map(()=>'<i></i>').join('')}</div><div class=btiles>${shuf(b.p.map((x,j)=>[x,j])).map(([x,j])=>`<button data-j=${j}>${x}</button>`).join('')}</div></div>`}
  if(b.k==='pick')return`<div class="bblk bpick" data-b=${k}><button class=bq data-act=q>${ic('speaker')}<span>${esc(b.q)}</span></button><div class=bopts>${b.o.map((o,j)=>`<button data-j=${j} style="${b.sz?`font-size:${b.sz[j]}px`:''}">${o}</button>`).join('')}</div></div>`;
  if(b.k==='places')return`<div class="bblk bplaces" data-b=${k}><div class=bstage><span class=bbox>📦</span><span class=bcat data-pos=up>🐱</span></div><div class=bpos>${[['up','فوق'],['down','تحت'],['front','أمام'],['back','خلف']].map(x=>`<button data-p=${x[0]}>${x[1]}</button>`).join('')}</div></div>`;
  if(b.k==='dirs')return`<div class="bblk bdirs" data-b=${k}><button data-d=r><span>✋</span><b>يمين</b></button><button data-d=l><span style="transform:scaleX(-1)">✋</span><b>يسار</b></button></div>`;
  if(b.k==='trace')return`<div class="bblk btrace" data-b=${k}><button class=btr data-c="${b.c}">${ic('pencil')}<span>${b.c}</span></button></div>`;
  return''}

function wirePage(el,i){const p=BOOK[i];
  const pop=(e,set)=>{e.classList.remove('bpop');void e.offsetWidth;e.classList.add('bpop');confetti(e,0,8,set||['⭐','✨'])};
  $$('[data-act=open]',el).forEach(b=>b.onclick=()=>BK.turn(1));
  $$('[data-act=title]',el).forEach(b=>b.onclick=()=>{pop(b);say(bTitle(i))});
  $$('.btc',el).forEach(b=>b.onclick=()=>{pop(b);BK.jump(+b.dataset.go)});
  if(!p.b)return;
  p.b.forEach((b,k)=>{const B=$(`[data-b="${k}"]`,el);if(!B)return;
    if(b.k==='lines'){const ls=$$('.bl',B);const one=async j=>{ls.forEach(x=>x.classList.remove('on'));ls[j].classList.add('on');await say(b.l[j]);ls[j].classList.remove('on')};
      ls.forEach((x,j)=>x.onclick=()=>{stop();one(j)});
      $('[data-act=lines]',B).onclick=async e=>{stop();const t=tok;pop(e.currentTarget);for(let j=0;j<ls.length;j++){if(t!==tok)return;await one(j);await sleep(200)}}}
    if(b.k==='words'||b.k==='sounds'){const cards=$$('.bw',B);let found=new Set();
      cards.forEach((c,j)=>c.onclick=async()=>{stop();pop(c);SFX.pop();const w=b.w[j];
        if(b.k==='sounds'){const lt=[...w];const bb=$('b',c);bb.innerHTML=lt.map((x,q)=>`<span class="${q===0?'hl':''}">${x}</span>`).join(' ');setTimeout(()=>{bb.textContent=w},2200)}
        say(w);if(!found.has(j)){found.add(j);c.classList.add('done');addXP(1,c);if(found.size===cards.length){setTimeout(()=>{SFX.ok();confetti(B,0,30);addStars(1,B);say(pr())},900)}}})}
    if(b.k==='letter'){const L=letObj(b.c);$('.bL',B).onclick=e=>{pop(e.currentTarget);say('حرف '+L[1])};$$('.bhar button',B).forEach((x,j)=>x.onclick=()=>{pop(x);say(HAR(b.c)[j])})}
    if(b.k==='build'){const w=b.w||b.p.join(''),slots=$$('.bslots i',B),tiles=$$('.btiles button',B);let got=[];
      tiles.forEach(t=>t.onclick=async()=>{if(t.classList.contains('used'))return;const j=+t.dataset.j;
        if(j!==got.length){SFX.bad();shake(t);return}
        SFX.pop();t.classList.add('used');slots[got.length].textContent=b.p[j];slots[got.length].classList.add('f');got.push(j);say(b.p[j].replace('ـ',''),false);
        if(got.length===b.p.length){await sleep(450);B.classList.add('ok');$('.bslots',B).innerHTML=`<span class=bwdone>${w}</span>`;SFX.ok();confetti(B,0,24);addXP(3,B);await say(w);say(pr(),false)}})}
    if(b.k==='pick'){const opts=$$('.bopts button',B);let ok=0;$('[data-act=q]',B).onclick=()=>say(b.q);
      opts.forEach((o,j)=>o.onclick=()=>{if(B.classList.contains('ok'))return;
        const right=b.two?(o.textContent===b.o[b.a]):j===b.a;
        if(right){o.classList.add('right');pop(o);SFX.ok();ok++;if(!b.two||ok>=2){B.classList.add('ok');addXP(2,o);say(pr(),false)}}else{o.classList.add('wrong');SFX.bad();setTimeout(()=>o.classList.remove('wrong'),600);say(oops(),false)}})}
    if(b.k==='places'){const cat=$('.bcat',B);$$('.bpos button',B).forEach(x=>x.onclick=()=>{pop(x);cat.dataset.pos=x.dataset.p;SFX.whoosh();say(x.textContent)})}
    if(b.k==='dirs')$$('button',B).forEach(x=>x.onclick=()=>{pop(x);say($('b',x).textContent)});
    if(b.k==='trace')$('.btr',B).onclick=()=>go('trace',{c:b.c,p:0});
  })}
