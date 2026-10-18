/* Playbook Vocal Studio 0.16.0 — RECORD & COMP screen.
   A simplified front for the existing 0.15 phrase / take system:
     part  = phrase (S.phrases.phrases[]),  take = phrase take,  chosen take = phrase.selected,
     comp  = PhraseCore.compose(workspace) (same join fade as before),  POLISH = phraseApply() + the 0.15 tabs.
   Nothing here changes audio math or the project format. Every 0.15 control keeps working; the extras
   are reachable from the More ▾ menu. */
(function(){
'use strict';
const D=window.DAW,PV=window.PVSRec;
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}};
const LSset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bpm=()=>Math.min(200,Math.max(50,+$('bpm').value||75)),beatSec=()=>60/bpm(),barSec=()=>240/bpm();
const narrow=()=>matchMedia('(max-width: 899px)').matches;
const isTyping=el=>el&&(el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&!/^(checkbox|radio|range|button)$/.test(el.type||''));
const RC={step:'rc',aud:null,counts:{},replace:null,playMode:null,showStars:!!LS('pvs-rc-stars',false),drag:null,mdrag:null,dirty:true,sig:'',lastExport:null,savedPos:null,auditioning:false};
window.RC=RC;
const W=()=>phraseWorkspace(),sel=()=>selectedPhrase();
const sorted=()=>[...W().phrases].sort((a,b)=>a.start-b.start);
const takeDur=t=>t.channels[0].length/t.rate;
const mmss=s=>{s=Math.max(0,s);const m=Math.floor(s/60),x=s-m*60;return String(m).padStart(2,'0')+':'+x.toFixed(1).padStart(4,'0');};
const msShort=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const busy=()=>!!(rec||S.recStarting||phraseBusy()||S.busy||S.loading);
const recording=()=>!!(rec||(PV.state&&PV.state()));

// ---------------------------------------------------------------- colours per part name
const PAL=['#4f9fd8','#f0a030','#a776d6','#3cc6a0','#d9913a','#6f7fa8','#d9607a','#8fb84a'];
function partColor(p,i){const n=(p.name||'').toLowerCase();
  if(/^intro|^outro/.test(n))return '#6f7fa8';if(/^pre/.test(n))return '#3cc6a0';if(/^verse/.test(n))return '#4f9fd8';
  if(/^chorus|^hook|^refrain/.test(n))return /\d/.test(n)&&!/chorus 1\b/.test(n)?'#d9913a':'#f0a030';if(/^bridge/.test(n))return '#a776d6';
  return PAL[(i||0)%PAL.length];}
RC.partColor=partColor;

// ---------------------------------------------------------------- step switch
function setStepsHeight(){const h=$('rcSteps').getBoundingClientRect().height||48;document.documentElement.style.setProperty('--steps-h',Math.ceil(h)+'px');}
function step(s,tab){
  if(s!=='rc'&&s!=='polish')return;RC.step=s;document.body.classList.toggle('rc-on',s==='rc');document.body.classList.add('has-steps');
  $('rcView').hidden=s!=='rc';$('rcStep1').setAttribute('aria-selected',s==='rc');$('rcStep2').setAttribute('aria-selected',s==='polish');
  closePops();setStepsHeight();
  if(s==='polish'){requestAnimationFrame(()=>{D.layout();D.dirty=true;if(tab)dawTab(tab);});}
  else{D.ctx='phrase';RC.dirty=true;RC.sig='';requestAnimationFrame(()=>{layout();sync(true);});}
}
RC.step=RC.step;RC.go=step;window.rcStep=step;
$('rcStep1').onclick=()=>step('rc');$('rcStep2').onclick=()=>step('polish');
new ResizeObserver(setStepsHeight).observe($('rcSteps'));

// ---------------------------------------------------------------- comp (cached compose of the chosen takes)
let compCache={w:null,rev:-1,key:'',chs:null,err:''};
function compKey(w){return w.phrases.map(p=>p.id+':'+p.start+':'+p.end+':'+(p.selected||'')).join('|')+'|'+w.fadeMs+'|'+(w.base?1:0);}
function hasComp(){const w=W();return !!w.base||w.phrases.some(p=>p.selected);}
function compChannels(){const w=W(),k=compKey(w);
  if(compCache.w===w&&compCache.rev===w.revision&&compCache.key===k)return compCache.chs;
  let chs=null,err='';try{if(hasComp())chs=PhraseCore.compose(w);}catch(e){err=e.message;}
  compCache={w,rev:w.revision,key:k,chs,err};return chs;}
RC.compChannels=compChannels;

// ---------------------------------------------------------------- playback
function padTo(chs,rate,sec){const n=Math.ceil(sec*rate);if(!chs||chs[0].length>=n)return chs;return chs.map(c=>{const a=new Float32Array(n);a.set(c);return a;});}
async function playFrom(at){
  if(rec||S.recStarting||S.loading)return false;const w=W();
  const comp=PV.prefs.hearOld?compChannels():null;
  RC.auditioning=false;RC.savedPos=null;
  if(comp){endLoop();const beatOn=S.beat&&$('beatOn').checked;const chs=beatOn?padTo(comp,w.rate,S.beat.duration):comp;
    loop={phrase:true,rcComp:true,chs,rate:w.rate,gain:phraseSafeGain(comp),start:0,end:chs[0].length/w.rate,noBeat:!beatOn,beatOffset:0,oneShot:true};RC.playMode='comp';
    at=Math.max(0,at);if(at>=loop.end-.1)at=0; // past the end -> start again from the top
    const ok=await startPlayback(at);rcMsg(ok?'Playing your comp'+(beatOn?' with the backing.':'.'):'Audio could not start.');return ok;}
  if(S.beat&&$('beatOn').checked){endLoop();RC.playMode='beat';if(at>=S.beat.duration-.1)at=0;const ok=await startPlayback(Math.max(0,at),'beat');rcMsg(ok?'Playing the backing'+(PV.prefs.hearOld?' (no chosen takes yet).':' only (Hear my comp is OFF).'):'Audio could not start.');return ok;}
  toast('Nothing to play yet',S.beat?'The backing is OFF and no take is chosen yet.':'Open a backing track (More ▾ › Open backing track) or record and choose a take.');return false;}
function rcPlay(){if(rec||S.recStarting)return;if(playing||playPending){stopAll();return;}
  playFrom(RC.savedPos!=null?RC.savedPos:position);}
function stopAll(){if(loop)endLoop();stopPlayback();restoreAfterAudition();RC.dirty=true;}
function restoreAfterAudition(){if(RC.savedPos!=null){position=RC.savedPos;RC.savedPos=null;}RC.auditioning=false;}
function rcStop(){if(recording()){PV.stop(true);return;}const was=playing||playPending;stopAll();if(!was){position=0;}tick();RC.dirty=true;D.dirty=true;}
function rcToStart(){if(recording())return;if(playing||playPending){stopAll();playFrom(0);}else{restoreAfterAudition();position=0;tick();}RC.dirty=true;}
function rcSeek(t){if(recording())return;t=Math.max(0,t);restoreAfterAudition();if(playing||playPending){stopAll();playFrom(t);}else{position=t;tick();const w=W();if(!phraseBusy()){w.cursor=Math.min(899.5,t);persist();}}RC.dirty=true;D.dirty=true;}
function audition(t,p){if(busy())return;if(W().selected!==p.id)phraseSelect(p.id);RC.aud=t.id;
  if(RC.savedPos==null)RC.savedPos=playing&&!(loop&&loop.phrase&&!loop.rcComp)?D.playheadTime():position;
  if(playing&&loop&&loop.phrase&&!loop.rcComp&&RC.playingTake===t.id){stopAll();return;}
  RC.playingTake=t.id;RC.auditioning=true;phraseListen(t.id).then(()=>rcMsg('Playing '+t.name+' of '+p.name+($('phraseCompareBeat').checked&&S.beat?' with the backing.':'.')+' Double-click it (or tap Choose) to use it.'));RC.dirty=true;}
RC.playFrom=playFrom;RC.audition=(id)=>{const f=findTake(id);if(f)audition(f.t,f.p);};
function findTake(id){for(const p of W().phrases){const t=p.takes.find(t=>t.id===id);if(t)return {p,t};}return null;}

// ---------------------------------------------------------------- recording
function rcRecord(){
  closePops();
  if(recording()){PV.record(false);return;}
  if(S.micBlocked){toast('Microphone blocked','Allow the microphone for this page in the browser, then try again.');return;}
  if(S.recStarting||phraseBusy())return;
  const p=sel();if(!p){openAdd(true);rcMsg('Add a part first (for example Intro or Verse 1), then press Record.');return;}
  if(playing||playPending){if(loop)endLoop();stopPlayback();}
  restoreAfterAudition();
  if(!D.armed){D.armed=true;}
  PV.record(false);RC.dirty=true;}
function redoLast(){const p=sel();if(!p||busy())return;const last=p.takes.at(-1);if(!last){rcRecord();return;}
  RC.replace={pid:p.id,tid:last.id,n:p.takes.length,chosen:p.selected===last.id,t0:performance.now()};rcRecord();
  rcMsg('Recording '+p.name+' again — '+last.name+' will be replaced when the new take is in (Undo brings it back).');}
function pollReplace(){const r=RC.replace;if(!r)return;const w=W(),p=w.phrases.find(p=>p.id===r.pid);
  if(!p){RC.replace=null;return;}
  if(rec||S.recStarting||S.loading||S.busy||S.phraseWorking||!$('micModal').hidden)return;
  if(p.takes.length>r.n){const nt=p.takes.at(-1),old=p.takes.find(t=>t.id===r.tid);RC.replace=null;if(!old||nt.id===r.tid)return;
    // one Undo goes back to before the redo (phraseAddAudio already saved that state)
    p.takes=p.takes.filter(t=>t.id!==r.tid);if(p.reference===r.tid)p.reference=null;
    if(p.selected===r.tid)p.selected=r.chosen&&PhraseCore.covers(nt,p)?nt.id:null;
    RC.aud=nt.id;phraseChanged(nt.name+' replaces '+old.name+' on '+p.name+'. Undo brings '+old.name+' back.');return;}
  if(performance.now()-r.t0>1500)RC.replace=null;}
RC.record=rcRecord;RC.redoLast=redoLast;

// ---------------------------------------------------------------- parts
function selectPart(p){if(!p||phraseBusy())return;if(W().selected!==p.id){phraseSelect(p.id);const ch=p.takes.find(t=>t.id===p.selected);RC.aud=ch?ch.id:p.takes.at(-1)?.id||null;}RC.dirty=true;}
function stepPart(dir){if(phraseBusy())return;const L=sorted(),i=L.findIndex(p=>p.id===W().selected);
  if(dir>0&&(i<0||i>=L.length-1)){if(!L.length||i===L.length-1)openAdd(true);else selectPart(L[0]);return;}
  const p=L[Math.max(0,Math.min(L.length-1,i<0?0:i+dir))];selectPart(p);}
function nameFor(base){const w=W(),n=w.phrases.map(p=>p.name);base=String(base||'').trim();if(!base)return 'Part '+(n.length+1);
  const same=n.filter(x=>x===base||x.startsWith(base+' ')&&/^\d+$/.test(x.slice(base.length+1))).length;
  if(base==='Verse')return 'Verse '+(same+1);if(!same)return base;return base+' '+(same+1);}
function addBounds(where,bars){const w=W(),bar=barSec();let start;
  if(where==='play'){start=playing?D.playheadTime():position;}else{const end=Math.max(0,...w.phrases.map(p=>p.end));start=w.phrases.length?end:Math.max(0,Math.min(w.cursor||0,899));}
  start=where==='play'||!w.phrases.length?Math.floor(start/bar+1e-6)*bar:start;start=Math.max(0,Math.min(899,Math.round(start*1000)/1000));
  let end=Math.min(900,start+bars*bar,start+60);const after=w.phrases.filter(p=>p.start>start+.5).sort((a,b)=>a.start-b.start)[0];if(after&&after.start<end&&after.start-start>=.5)end=after.start;
  return [start,Math.round(end*1000)/1000];}
function addPart(name,bars,where){if(phraseBusy())return null;const [a,b]=addBounds(where||'end',bars||8);
  if(!(b-a>=.5)){toast('No room here','Move the playhead or make the next part shorter first.');return null;}
  const n0=W().phrases.length;$('phraseLabel').value=name||nameFor('Part');$('phraseStart').value=a;$('phraseEnd').value=b;phraseNew();
  if(W().phrases.length===n0)return null;const p=sel();RC.aud=null;rcMsg(p.name+' added ('+fmtShort(a)+'–'+fmtShort(b)+'). Press Record (R) to record it. Drag its edges to change the length.');RC.dirty=true;return p;}
RC.addPart=addPart;RC.nameFor=nameFor;
function renamePart(p){p=p||sel();if(!p)return;const r=$('rcView').hidden?null:(narrow()?$('rcPartName'):$('rcCanvas')).getBoundingClientRect();
  let x=r?r.left+20:100,y=r?r.top+20:100;if(r&&!narrow()){const L=lanes().find(l=>l.k==='parts');x=r.left+Math.max(10,Math.min(r.width-220,X(p.start)+8));y=r.top+L.y+24;}
  PV.inlineRename('phrase',p,null,x,y);}
function deletePart(){const p=sel();if(!p||phraseBusy())return;$('phraseRemove').click();RC.dirty=true;}
RC.renamePart=renamePart;

// ---------------------------------------------------------------- choose / delete
function choose(t,p){if(phraseBusy())return;if(W().selected!==p.id)phraseSelect(p.id);if(p.selected===t.id){rcMsg(t.name+' is already chosen for '+p.name+'.');return;}phraseChoose(t.id);if(p.selected===t.id){RC.aud=t.id;rcMsg(t.name+' chosen for '+p.name+'. '+progressText());}else rcMsg($('phraseStatus').textContent);RC.dirty=true;}
function delTake(t,p){if(phraseBusy())return;if(W().selected!==p.id)phraseSelect(p.id);phraseRemoveTake(t.id);if(RC.aud===t.id)RC.aud=null;rcMsg(t.name+' deleted. Undo brings it back.');RC.dirty=true;}
function progressText(){const L=W().phrases,n=L.filter(p=>p.selected).length;return n+' of '+L.length+' part'+(L.length===1?'':'s')+' chosen.';}

// ---------------------------------------------------------------- export + go to POLISH
async function sendToPolish(ask){const w=W();if(!phraseNeedsApply())return true;
  if(ask&&w.applied>=0&&S.main&&!confirm('Your comp changed since you last sent it to POLISH.\n\nSend the new comp to POLISH now? Tuning note edits made on the old comp start again on the new vocal.'))return false;
  const ok=await phraseApply();return ok;}
async function exportComp(){if(busy()){toast('Please wait','Finish the recording or the current job first.');return false;}
  const w=W();if(!hasComp()){toast('Nothing to export yet','Choose a take for at least one part first (green ✓).');return false;}
  const chs=compChannels();if(!chs){toast('Comp not ready',compCache.err||'Check the chosen takes.');return false;}
  const name=safeName(w.title&&w.title!=='My phrase recording'?w.title:S.name||'My vocal')+' - comp vocal.wav';
  const data=wav24ch(chs,w.rate);RC.lastExport={name,rate:w.rate,length:chs[0].length,channels:chs.length,bytes:data.length};
  let res='';try{res=await saveDownload(name,new Blob([data],{type:'audio/wav'}));}catch(e){toast('Export failed',e.message);return false;}
  const sent=await sendToPolish(true);
  toast('Comp exported',name+' · '+msShort(chs[0].length/w.rate)+(sent?' · also sent to POLISH (Clean · Tune · Chain).':''),7000);
  rcMsg('Comp exported as “'+name+'”'+(sent?' and loaded into POLISH.':'.'));return true;}
async function compDone(){if(busy())return;const w=W(),L=sorted(),todo=L.filter(p=>!p.selected);
  if(!hasComp()){toast('Choose some takes first','Each part needs a chosen take (green ✓) before POLISH.');return;}
  if(todo.length&&!confirm(todo.length+' part'+(todo.length===1?' has':'s have')+' no chosen take yet: '+todo.map(p=>p.name).join(', ')+'.\n\n'+(w.base?'Your starting vocal is used there.':'Those parts will be silent.')+' Go to POLISH anyway?'))return;
  const ok=await sendToPolish(true);if(!ok&&phraseNeedsApply())return;
  step('polish','clean');toast('Comp ready for POLISH','Your joined vocal is loaded. Use CLEAN, TUNE and CHAIN, then Save / Export. Switch back to 1 RECORD & COMP at any time.',8000);}
RC.exportComp=exportComp;RC.compDone=compDone;

// ---------------------------------------------------------------- timeline geometry (desktop)
const HEADW=170,ADDW=104,RULER=30,BACK=56,PARTS=46,TAKE=44,COMP=54;
let geo={w:600,dur:30};
function songDur(){const w=W();return Math.max(S.beat?.duration||0,w.phrases.length||w.base?PhraseCore.duration(w):0,20)+.5;}
function lanes(){const w=W(),n=Math.max(3,...w.phrases.map(p=>p.takes.length));const L=[{k:'ruler',h:RULER},{k:'beat',h:BACK},{k:'parts',h:PARTS}];for(let i=0;i<n;i++)L.push({k:'take',i,h:TAKE});L.push({k:'comp',h:COMP});let y=0;for(const l of L){l.y=y;y+=l.h;}return L;}
function X(t){return t/geo.dur*(geo.w-ADDW);}
function T(x){return Math.max(0,x/(geo.w-ADDW)*geo.dur);}
RC.X=X;RC.lanes=()=>lanes();
function layout(){if(RC.step!=='rc')return;const L=lanes(),H=L.at(-1).y+L.at(-1).h,tl=$('rcTl'),c=$('rcCanvas'),r=Math.min(2,devicePixelRatio||1),w=Math.max(300,tl.clientWidth||600);
  geo={w,dur:songDur()};c.style.width=w+'px';c.style.height=H+'px';if(c.width!==Math.round(w*r)||c.height!==Math.round(H*r)){c.width=Math.round(w*r);c.height=Math.round(H*r);}
  const key=L.map(l=>l.k+(l.i??'')).join('|');if(key!==RC.headKey){RC.headKey=key;$('rcHeads').innerHTML=L.map(l=>'<div class="rch '+l.k+'" style="height:'+l.h+'px">'+headHTML(l)+'</div>').join('');}
  syncHeads();const pl=L.find(l=>l.k==='parts');const ab=$('rcAddBtn');ab.style.top=(pl.y+6)+'px';ab.style.left=(w-ADDW+6)+'px';ab.style.width=(ADDW-10)+'px';ab.style.height=(pl.h-12)+'px';
  sizeMini();RC.dirty=true;}
function headHTML(l){if(l.k==='ruler')return '<span class="rcs">bars</span>';if(l.k==='beat')return '<b>BACKING</b><span class="rcs" id="rcBeatName">none</span>';
  if(l.k==='parts')return '<b class="acc">PARTS</b><span class="rcs">click to select</span>';if(l.k==='take')return '<b class="mut">Take '+(l.i+1)+'</b>';return '<b class="grn">COMP</b><span class="rcs">best takes joined</span>';}
function syncHeads(){const b=$('rcBeatName');if(b)b.textContent=S.beat?S.beatName+($('beatOn').checked?'':' · OFF'):'none · More ▾ › Open backing';}
window.addEventListener('resize',()=>{layout();});new ResizeObserver(()=>layout()).observe($('rcTl'));

// ---------------------------------------------------------------- peaks
const pk=new WeakMap();
function peaks(arr,rate){let p=pk.get(arr);if(p&&p.rate===rate)return p;const step=Math.max(1,Math.round(rate/200)),n=Math.ceil(arr.length/step),out=new Float32Array(n);
  for(let k=0,i=0;k<n;k++,i+=step){let m=0;const e=Math.min(arr.length,i+step);for(let j=i;j<e;j+=2){const v=arr[j]<0?-arr[j]:arr[j];if(v>m)m=v;}out[k]=m;}p={data:out,rate,step};pk.set(arr,p);return p;}
function wave(g,arr,rate,origin,t0,t1,y,h,color,Xf,Tf){if(!arr||!arr.length)return;const P=peaks(arr,rate),a=Math.max(0,Math.floor(Xf(t0))),b=Math.min(g.canvas.width,Math.ceil(Xf(t1)));if(b<=a)return;g.fillStyle=color;const mid=y+h/2,half=h/2-1,per=P.rate/P.step;
  for(let x=a;x<b;x++){const ta=Tf(x)-origin,tb=Tf(x+1)-origin;let i0=Math.max(0,Math.floor(ta*per)),i1=Math.min(P.data.length,Math.max(i0+1,Math.ceil(tb*per)));if(i0>=P.data.length||tb<0)continue;let m=0;for(let i=i0;i<i1;i++)if(P.data[i]>m)m=P.data[i];const hh=Math.max(.5,Math.min(1,m*1.6)*half);g.fillRect(x,mid-hh,1,hh*2);}}
function rr(g,x,y,w,h,r){g.beginPath();g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h);}

// ---------------------------------------------------------------- draw (desktop timeline)
function nowT(){if(rec&&rec.target==='phrase'&&rec.phrase)return Math.max(0,rec.origin+(performance.now()-rec.t0)/1000);return playing?D.playheadTime():position;}
function draw(){const c=$('rcCanvas'),g=c.getContext('2d');if(!g)return;const r=c.width/(parseFloat(c.style.width)||1);g.setTransform(r,0,0,r,0,0);
  const Wd=geo.w,L=lanes(),H=L.at(-1).y+L.at(-1).h,w=W(),sp=sel(),Tw=Wd-ADDW,lane=k=>L.find(l=>l.k===k);
  g.clearRect(0,0,Wd,H);
  for(const l of L){g.fillStyle=l.k==='ruler'?'#0a0d12':l.k==='comp'?'#0d1612':'#0f141a';g.fillRect(0,l.y,Wd,l.h);g.fillStyle='#070a0e';g.fillRect(0,l.y+l.h-1,Wd,1);}
  // bars
  const bar=barSec(),bpx=X(bar);let every=1;while(every*bpx<26)every*=2;g.font='600 10px "IBM Plex Mono",monospace';
  for(let b=0;b*bar<=geo.dur;b++){const x=X(b*bar);if(x>Tw)break;const big=b%(every*4)===0||every>=4&&b%every===0;if(b%every===0){g.fillStyle=big?'#8d98a5':'#3a4450';g.fillRect(x,big?10:18,1,RULER-(big?10:18));if(big){g.fillStyle='#8d98a5';g.fillText(String(b+1),x+3,10);}g.fillStyle='rgba(255,255,255,.035)';g.fillRect(x,RULER,1,H-RULER);}}
  // selected part shading + pre-roll + IN/OUT
  const pre=PV.preRoll();let a=0,b=0;
  if(sp){const dr=RC.drag&&RC.drag.p===sp?RC.drag:null;a=dr&&dr.which==='start'?dr.t:sp.start;b=dr&&dr.which==='end'?dr.t:sp.end;
    g.fillStyle='rgba(240,160,48,.07)';g.fillRect(X(a-pre),RULER,X(a)-X(a-pre),H-RULER);g.fillStyle='rgba(240,160,48,.10)';g.fillRect(X(a),RULER,X(b)-X(a),H-RULER);
    g.fillStyle='#f0a030';g.font='600 9px "IBM Plex Sans",sans-serif';if(X(a)-X(a-pre)>34)g.fillText('pre-roll',X(a-pre)+3,RULER+9);}
  // markers
  for(const m of (Array.isArray(w.markers)?w.markers:[])){const x=X(m.t);if(x>Tw)continue;g.fillStyle='#f5d08a';g.beginPath();g.moveTo(x,2);g.lineTo(x+7,6);g.lineTo(x,10);g.fill();g.fillRect(x,2,1,RULER-2);g.font='600 9px "IBM Plex Sans",sans-serif';g.fillText(m.name,x+9,RULER-6);}
  // backing
  const lb=lane('beat');if(S.beat){g.fillStyle='#131a28';rr(g,1,lb.y+3,Math.min(Tw,X(S.beat.duration))-2,lb.h-6,4);g.fill();wave(g,S.beat.getChannelData(0),S.beat.sampleRate,0,0,S.beat.duration,lb.y+4,lb.h-8,$('beatOn').checked?'#5a7be0':'#323c52',X,T);}
  else{g.fillStyle='#5d6873';g.font='13px "IBM Plex Sans",sans-serif';g.fillText('No backing track yet · More ▾ › Open backing track',10,lb.y+lb.h/2+4);}
  // parts
  const lp=lane('parts'),list=sorted();
  list.forEach((p,i)=>{const isSel=p.id===w.selected,dr=RC.drag&&RC.drag.p===p?RC.drag:null,pa=dr&&dr.which==='start'?dr.t:p.start,pb=dr&&dr.which==='end'?dr.t:p.end,x0=X(pa)+1,x1=X(pb)-1;if(x1<0||x0>Tw)return;
    g.globalAlpha=isSel?1:.78;g.fillStyle=partColor(p,i);rr(g,x0,lp.y+4,Math.max(2,x1-x0),lp.h-8,5);g.fill();g.globalAlpha=1;
    if(isSel){g.strokeStyle='#ffffff';g.lineWidth=2;rr(g,x0,lp.y+4,Math.max(2,x1-x0),lp.h-8,5);g.stroke();}
    g.save();g.beginPath();g.rect(x0,lp.y,x1-x0,lp.h);g.clip();g.fillStyle='#0d1117';g.font=(x1-x0>70?'700 12px':'700 10px')+' "IBM Plex Sans",sans-serif';const lab=p.name+(p.selected?' ✓':'');const tw=g.measureText(lab).width;g.fillText(lab,Math.max(x0+4,(x0+x1)/2-tw/2),lp.y+lp.h/2+4);g.restore();
    g.fillStyle='rgba(13,17,23,.35)';g.fillRect(x0,lp.y+10,2,lp.h-20);g.fillRect(x1-2,lp.y+10,2,lp.h-20);});
  if(!list.length){g.fillStyle='#8d98a5';g.font='13px "IBM Plex Sans",sans-serif';g.fillText('No parts yet → click “+ Add part” (Intro, Verse 1, Chorus…)',10,lp.y+lp.h/2+4);}
  // take lanes
  for(const l of L.filter(l=>l.k==='take'))for(const p of list){const t=p.takes[l.i],x0=X(p.start)+3,x1=X(p.end)-3,ww=x1-x0;if(x1<0||x0>Tw||ww<2)continue;
    if(!t){if(l.i===0){g.setLineDash([3,3]);g.strokeStyle='#3a4450';g.lineWidth=1;rr(g,x0+.5,l.y+4.5,ww-1,l.h-9,4);g.stroke();g.setLineDash([]);if(ww>44){g.fillStyle='#5d6873';g.font='10px "IBM Plex Sans",sans-serif';const s1='not',s2='recorded';g.fillText(s1,x0+ww/2-g.measureText(s1).width/2,l.y+18);g.fillText(s2,x0+ww/2-g.measureText(s2).width/2,l.y+31);}}continue;}
    const chosen=p.selected===t.id,aud=RC.aud===t.id&&p.id===w.selected,inc=!PhraseCore.covers(t,p);
    g.fillStyle=chosen?'#163326':'#1c232c';rr(g,x0,l.y+4,ww,l.h-8,4);g.fill();
    wave(g,t.channels[0],t.rate,PhraseCore.origin(t),p.start,p.end,l.y+7,l.h-14,chosen?'#3ddc84':inc?'#8a5555':'#6b7580',X,T);
    g.strokeStyle=chosen?'#3ddc84':aud?'#e6e9ec':'#3a4450';g.lineWidth=chosen||aud?1.6:1;if(aud&&!chosen)g.setLineDash([4,3]);rr(g,x0+.5,l.y+4.5,ww-1,l.h-9,4);g.stroke();g.setLineDash([]);
    if(chosen&&ww>20){g.fillStyle='#3ddc84';g.beginPath();g.arc(x0+11,l.y+13,7,0,7);g.fill();g.fillStyle='#0d1117';g.font='700 9px sans-serif';g.fillText('✓',x0+7.5,l.y+16.5);}
    if(ww>60){g.save();g.beginPath();g.rect(x0,l.y,ww,l.h);g.clip();g.font='600 9px "IBM Plex Mono",monospace';g.fillStyle=chosen?'#bff5d6':'#9aa5b1';g.fillText(t.name+(RC.showStars&&t.rating?' '+'★'.repeat(t.rating):'')+(inc?' · short':''),x0+(chosen?22:5),l.y+14);g.restore();}}
  // comp lane
  const lc=lane('comp');g.fillStyle='#0f1a14';rr(g,1,lc.y+3,Tw-2,lc.h-6,4);g.fill();
  const comp=compChannels();
  for(const p of list){const x0=X(p.start),x1=X(p.end),ch=p.takes.find(t=>t.id===p.selected);
    if(ch){g.fillStyle='#1a3a2a';g.fillRect(x0,lc.y+7,x1-x0,lc.h-14);}
    else if(x1-x0>40){g.setLineDash([3,3]);g.strokeStyle='#2c3a33';g.strokeRect(x0+2.5,lc.y+7.5,x1-x0-5,lc.h-15);g.setLineDash([]);g.fillStyle='#5d6873';g.font='10px "IBM Plex Sans",sans-serif';const s=p.takes.length?'choose a take':'to record';g.fillText(s,(x0+x1)/2-g.measureText(s).width/2,lc.y+lc.h/2+4);}}
  if(comp)wave(g,comp[0],w.rate,0,0,comp[0].length/w.rate,lc.y+8,lc.h-16,'#3cc6c9',X,T);
  for(const p of list){if(!p.selected)continue;const x0=X(p.start),x1=X(p.end);if(x1-x0>40){g.save();g.beginPath();g.rect(x0,lc.y,x1-x0,lc.h);g.clip();g.fillStyle='#bfeee0';g.font='700 9px "IBM Plex Sans",sans-serif';g.fillText(p.name,x0+6,lc.y+15);g.restore();}}
  // joins = crossfades
  for(let i=1;i<list.length;i++){const A=list[i-1],B=list[i];if(!A.selected||!B.selected)continue;if(Math.abs(A.end-B.start)>.3&&!(B.start<A.end))continue;const x=X(B.start);g.strokeStyle='#ffffff';g.lineWidth=1;g.beginPath();g.moveTo(x-5,lc.y+lc.h/2-3);g.lineTo(x+5,lc.y+lc.h-8);g.moveTo(x-5,lc.y+lc.h-8);g.lineTo(x+5,lc.y+lc.h/2-3);g.stroke();}
  // IN / OUT flags on top
  if(sp){for(const [t,lab,dir] of [[a,'IN',1],[b,'OUT',-1]]){const x=X(t);g.fillStyle='#ff4d4d';g.fillRect(x-.8,0,1.6,H);const fw=lab==='IN'?20:28;g.fillRect(dir>0?x:x-fw,0,fw,12);g.fillStyle='#fff';g.font='700 9px "IBM Plex Sans",sans-serif';g.fillText(lab,dir>0?x+3:x-fw+3,9.5);}}
  // playhead / recording head
  const tnow=nowT(),xp=X(tnow);
  if(rec&&rec.target==='phrase'&&rec.phrase){const p=rec.phrase.p;g.fillStyle='rgba(255,77,77,.18)';g.fillRect(X(p.start),RULER,Math.max(0,X(Math.min(tnow,p.end))-X(p.start)),H-RULER);g.fillStyle='#ff4d4d';g.fillRect(xp-1,0,2,H);}
  else if(rec){g.fillStyle='#ff4d4d';g.fillRect(xp-1,0,2,H);}
  else{g.fillStyle='rgba(255,255,255,.92)';g.fillRect(xp-.6,0,1.2,H);g.beginPath();g.moveTo(xp-5,0);g.lineTo(xp+5,0);g.lineTo(xp,7);g.fill();}
  // right column
  g.fillStyle='#0b0f14';g.fillRect(Tw,0,ADDW,H);
}

// ---------------------------------------------------------------- phone mini view of the selected part
function sizeMini(){const c=$('rcMini');if(!c||!narrow()||RC.step!=='rc')return;const w=Math.max(200,c.clientWidth||300),h=72,r=Math.min(2,devicePixelRatio||1);if(c.width!==Math.round(w*r)||c.height!==Math.round(h*r)){c.width=Math.round(w*r);c.height=Math.round(h*r);}c.style.height=h+'px';}
function miniRange(p){const pre=PV.preRoll(),a0=Math.max(0,p.start-pre),b0=p.end+Math.min(1,(p.end-p.start)*.04);return [a0,b0];}
function drawMini(){const c=$('rcMini'),g=c.getContext('2d');if(!g)return;const w=c.clientWidth||300,h=72,r=c.width/w;g.setTransform(r,0,0,r,0,0);g.clearRect(0,0,w,h);g.fillStyle='#0f141a';g.fillRect(0,0,w,h);
  const p=sel();if(!p){g.fillStyle='#8d98a5';g.font='12px "IBM Plex Sans",sans-serif';g.fillText('Add a part to see it here',10,40);return;}
  const dr=RC.drag&&RC.drag.p===p&&RC.drag.mini?RC.drag:null,pa=dr&&dr.which==='start'?dr.t:p.start,pb=dr&&dr.which==='end'?dr.t:p.end;const [a0,b0]=miniRange({start:pa,end:pb});const Xm=t=>(t-a0)/(b0-a0)*w,Tm=x=>a0+x/w*(b0-a0);RC.miniX=Xm;RC.miniT=Tm;
  g.fillStyle='rgba(240,160,48,.10)';g.fillRect(0,0,Xm(pa),h);g.fillStyle='#f0a030';g.font='600 9px "IBM Plex Sans",sans-serif';if(Xm(pa)>40)g.fillText('pre-roll',5,12);
  if(S.beat)wave(g,S.beat.getChannelData(0),S.beat.sampleRate,0,a0,b0,4,h/2-6,$('beatOn').checked?'#5a7be0':'#323c52',Xm,Tm);
  const t=p.takes.find(t=>t.id===RC.aud)||p.takes.find(t=>t.id===p.selected)||p.takes.at(-1);if(t)wave(g,t.channels[0],t.rate,PhraseCore.origin(t),pa,pb,h/2+2,h/2-6,p.selected===t.id?'#3ddc84':'#8d98a5',Xm,Tm);
  else{g.fillStyle='#5d6873';g.font='11px "IBM Plex Sans",sans-serif';g.fillText('not recorded yet',Xm(pa)+8,h*.75);}
  for(const [tt,lab,dir] of [[pa,'IN',1],[pb,'OUT',-1]]){const x=Xm(tt);g.fillStyle='#ff4d4d';g.fillRect(x-1,0,2,h);g.font='700 9px "IBM Plex Sans",sans-serif';g.fillText(lab,dir>0?x+4:x-4-g.measureText(lab).width,11);}
  const tn=nowT();if(tn>=a0&&tn<=b0){g.fillStyle=rec?'#ff4d4d':'#fff';g.fillRect(Xm(tn)-.6,0,1.2,h);}}

// ---------------------------------------------------------------- timeline interaction
function hit(e){const c=$('rcCanvas'),r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const l=lanes().find(l=>y>=l.y&&y<l.y+l.h);return {x,y,t:T(x),l,right:x>geo.w-ADDW};}
function partAt(t){const L=sorted();for(let i=L.length-1;i>=0;i--)if(t>=L[i].start&&t<=L[i].end)return L[i];return null;}
function edgeAt(x,lk){const w=W(),cand=lk==='ruler'?[sel()].filter(Boolean):sorted();let best=null;for(const p of cand)for(const which of ['start','end']){const d=Math.abs(X(p[which])-x);if(d<=7&&(!best||d<best.d))best={p,which,d};}
  if(best&&lk!=='ruler'&&best.p.id!==w.selected){/* prefer the selected part when two edges touch */const s=sel();if(s)for(const which of ['start','end'])if(Math.abs(X(s[which])-x)<=7)return {p:s,which};}return best;}
function snap(t,free){if(free)return Math.round(t*100)/100;const b=beatSec();return Math.round(t/b)*b;}
function clampEdge(p,which,t){if(which==='start')return Math.max(0,Math.min(t,p.end-.5,899.5),p.end-60);return Math.min(900,Math.max(t,p.start+.5),p.start+60);}
const cv=$('rcCanvas');let clickTimer=0;
cv.addEventListener('pointerdown',e=>{if(e.button)return;closePops();D.ctx='phrase';const h=hit(e);if(!h.l||h.right)return;
  if((h.l.k==='parts'||h.l.k==='ruler')&&!phraseBusy()){const ed=edgeAt(h.x,h.l.k);if(ed){try{cv.setPointerCapture(e.pointerId);}catch(_){}if(ed.p.id!==W().selected)selectPart(ed.p);RC.drag={p:ed.p,which:ed.which,t:ed.p[ed.which],x0:e.clientX};return;}}
  if(h.l.k==='ruler'){const m=(W().markers||[]).find(m=>Math.abs(X(m.t)-h.x)<=6);rcSeek(m?m.t:h.t);return;}
  if(h.l.k==='beat'){rcSeek(h.t);return;}
  if(h.l.k==='parts'){const p=partAt(h.t);if(p){selectPart(p);rcMsg(p.name+' selected · '+partInfo(p)+'. Press Record (R).');}else rcSeek(h.t);return;}
  if(h.l.k==='take'){const p=partAt(h.t),t=p?.takes[h.l.i];if(t){clearTimeout(clickTimer);const tt=t,pp=p;clickTimer=setTimeout(()=>audition(tt,pp),230);}else if(p)selectPart(p);else rcSeek(h.t);return;}
  if(h.l.k==='comp'){rcSeek(h.t);if(!playing)playFrom(h.t);return;}});
cv.addEventListener('pointermove',e=>{const h=hit(e);
  if(RC.drag&&e.buttons){RC.drag.t=clampEdge(RC.drag.p,RC.drag.which,snap(h.t,e.shiftKey));RC.dirty=true;return;}
  if(h.l&&(h.l.k==='parts'||h.l.k==='ruler')&&!h.right&&edgeAt(h.x,h.l.k))cv.style.cursor='ew-resize';else cv.style.cursor=h.l&&(h.l.k==='take'||h.l.k==='parts')?'pointer':'default';});
function endDrag(e){const d=RC.drag;RC.drag=null;if(!d)return;if(Math.abs(d.t-d.p[d.which])>.005&&(!e||Math.abs(e.clientX-d.x0)>2)){const a=d.which==='start'?d.t:d.p.start,b=d.which==='end'?d.t:d.p.end;PV.setBounds(d.p,a,b);rcMsg(d.p.name+' now '+fmtShort(a)+'–'+fmtShort(b)+'. Undo puts it back.');}RC.dirty=true;}
cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',()=>{RC.drag=null;RC.dirty=true;});
cv.addEventListener('dblclick',e=>{const h=hit(e);if(!h.l)return;
  if(h.l.k==='parts'){const p=partAt(h.t);if(p){selectPart(p);PV.inlineRename('phrase',p,null,e.clientX,e.clientY);}return;}
  if(h.l.k==='take'){clearTimeout(clickTimer);const p=partAt(h.t),t=p?.takes[h.l.i];if(t)choose(t,p);}});
cv.addEventListener('contextmenu',e=>{const h=hit(e);if(!h.l)return;if(h.l.k==='take'){const p=partAt(h.t),t=p?.takes[h.l.i];if(t){e.preventDefault();if(W().selected!==p.id)selectPart(p);PV.takeMenu(p,t,e.clientX,e.clientY);}}
  else if(h.l.k==='parts'){const p=partAt(h.t);if(p){e.preventDefault();selectPart(p);PV.phraseMenu(p,e.clientX,e.clientY);}}});
// mini (phone) flags
const mc=$('rcMini');
mc.addEventListener('pointerdown',e=>{const p=sel();if(!p||phraseBusy()||!RC.miniX)return;const r=mc.getBoundingClientRect(),x=e.clientX-r.left;let best=null;for(const which of ['start','end']){const d=Math.abs(RC.miniX(p[which])-x);if(d<=18&&(!best||d<best.d))best={which,d};}
  if(best){try{mc.setPointerCapture(e.pointerId);}catch(_){}RC.drag={p,which:best.which,t:p[best.which],x0:e.clientX,mini:true,T:RC.miniT};e.preventDefault();}else rcSeek(RC.miniT(x));});
mc.addEventListener('pointermove',e=>{if(!RC.drag||!RC.drag.mini||!e.buttons)return;const r=mc.getBoundingClientRect();RC.drag.t=clampEdge(RC.drag.p,RC.drag.which,snap(RC.drag.T(e.clientX-r.left),false));RC.dirty=true;});
mc.addEventListener('pointerup',endDrag);mc.addEventListener('pointercancel',()=>{RC.drag=null;});

// ---------------------------------------------------------------- the part panel
function partInfo(p){const bar=barSec(),b0=Math.floor(p.start/bar+1e-6)+1,b1=Math.max(b0,Math.ceil(p.end/bar-1e-6));const pre=PV.preRoll()/bar,ci=PV.prefs.countIn?PV.prefs.countBars:0;
  const f=v=>{const r=Math.round(v*10)/10;return (r%1?r.toFixed(1):String(r))+' bar'+(r===1?'':'s');};
  return 'bars '+b0+'–'+b1+(narrow()?'':' · pre-roll '+f(pre))+' · count-in '+(ci?ci+' bar'+(ci>1?'s':''):'off');}
function takeNote(t,p,rank){const bits=[msShort(takeDur(t))];if(!PhraseCore.covers(t,p))bits.push('too short — redo');
  else if(t.analysisToken)bits.push('checking…');else if(t.profile)bits.push(t.profile.clippedPercent>0.001?'clipped '+t.profile.clippedPercent.toFixed(2)+'%':'clip ok');
  if(rank&&rank.winner===t.id)bits.push('suggested');if(p.selected===t.id)bits.push('chosen');return bits.join(' · ');}
function signature(){const w=W();return JSON.stringify([w.revision,w.selected,w.phrases.map(p=>[p.id,p.name,p.start,p.end,p.selected,p.takes.map(t=>t.id+t.name+'|'+(t.rating||0)+'|'+(t.profile?1:0)+(t.analysisToken?1:0))]),RC.aud,recording(),!!S.recStarting,busy(),RC.showStars,PV.prefs.countIn,PV.prefs.countBars,narrow(),bpm(),RC.playingTake&&playing,phraseUndoStack.length,phraseRedoStack.length]);}
function sync(force){const s=signature();if(!force&&s===RC.sig)return;RC.sig=s;RC.dirty=true;
  const w=W(),p=sel(),L=sorted(),locked=phraseBusy(),rank=p?PhraseCore.rank(p,w.key||0,w.scale||0):null;
  // remember new takes -> auto-select the newest for audition
  for(const ph of w.phrases){const n=ph.takes.length,o=RC.counts[ph.id];if(o!==undefined&&n>o&&ph.id===w.selected)RC.aud=ph.takes.at(-1).id;RC.counts[ph.id]=n;}
  if(p&&RC.aud&&!p.takes.some(t=>t.id===RC.aud))RC.aud=p.takes.find(t=>t.id===p.selected)?.id||null;
  const idx=p?L.indexOf(p):-1;$('rcPanel').style.setProperty('--pc',p?partColor(p,idx):'#3a4450');
  $('rcPartName').textContent=p?p.name.toUpperCase():'NO PART YET';$('rcPartTakes').textContent=p?'—  '+p.takes.length+' take'+(p.takes.length===1?'':'s'):'';
  $('rcPartInfo').textContent=p?partInfo(p):'Add your first part (for example Intro or Verse 1). Then press Record.';
  for(const id of ['rcRename','rcDelPart'])$(id).disabled=!p||locked;$('rcAddPart2').disabled=locked;
  const next=p?phraseNextTakeName(p).replace('Take ','take '):'';
  $('rcBigLabel').innerHTML=recording()?'Stop<br>keep take':S.recStarting?'Starting…':p?'Record<br>'+esc(next):'Add a<br>part';
  $('rcBig').classList.toggle('on',recording());$('rcRec').classList.toggle('on',recording());$('rcRec').lastChild.textContent=recording()?' STOP':' REC';
  $('rcBig').disabled=!!S.micBlocked||(!recording()&&(locked||S.recStarting));$('rcRec').disabled=$('rcBig').disabled;
  $('rcRedoLast').disabled=!p||!p.takes.length||busy();$('rcPrev').disabled=!p||idx<=0||locked;$('rcNext').disabled=locked||recording();$('rcNext').textContent=p&&idx===L.length-1?'+ Add next part':'Next part ▶';
  // take list
  const rows=p?p.takes.map(t=>{const ch=p.selected===t.id,aud=RC.aud===t.id,pl=playing&&RC.playingTake===t.id&&loop&&loop.phrase&&!loop.rcComp;
    return '<div class="rctake'+(ch?' chosen':'')+(aud?' aud':'')+'" data-id="'+esc(t.id)+'"><div class="rctn"><b>'+esc(t.name)+'</b><small>'+esc(takeNote(t,p,rank))+'</small>'+(RC.showStars?'<span class="rcstars">'+[1,2,3,4,5].map(i=>'<button class="star'+(i<=(t.rating||0)?' on':'')+'" data-star="'+i+'" aria-label="'+i+' stars">★</button>').join('')+'</span>':'')+'</div>'+
      '<button class="rcbtn rcplay" data-act="play" aria-label="Play '+esc(t.name)+'">'+(pl?'■':'▶')+'<span class="rcphone"> '+(pl?'Stop':'Play')+'</span></button><button class="rcbtn rcchoose" data-act="choose">'+(ch?'✓ Chosen':'✓ Choose')+'</button><button class="rcbtn rcdel" data-act="del" aria-label="Delete '+esc(t.name)+'">Del</button></div>';}).join(''):'';
  const th=rows||'<p class="rcempty">'+(p?'No takes yet. Press the big red button (or R). The backing starts just before the part and recording stops at the end.':'No part selected.')+'</p>';
  // rebuild the list only when it really changed, and never in the middle of a tap/click on it (the click would be lost)
  if(RC.listPress){RC.sig='';}else if(RC.takesHtml!==th){RC.takesHtml=th;$('rcTakes').innerHTML=th;}
  for(const b of qa('#rcTakes button'))b.disabled=locked&&b.dataset.act!=='play'||locked&&!!rec;
  const un=p?p.takes.filter(t=>t.id!==p.selected).length:0;$('rcDelUn').textContent='Delete unchosen takes ('+un+')';$('rcDelUn').disabled=!un||locked;
  // progress
  const n=L.filter(q=>q.selected).length;$('rcProgText').textContent=n+' of '+L.length+' part'+(L.length===1?'':'s')+' chosen';
  $('rcSegs').innerHTML=L.map(q=>'<i class="'+(q.selected?'on':'')+(q.id===w.selected?' cur':'')+'" title="'+esc(q.name)+(q.selected?' ✓':' — not chosen yet')+'"></i>').join('');
  const todo=L.filter(q=>!q.selected).map(q=>q.name);$('rcTodo').textContent=!L.length?'Add parts to build your comp.':todo.length?'Still to do:  '+todo.join(' · '):'All parts chosen ✓  Ready for POLISH.';
  // chips (phone)
  $('rcChips').innerHTML=L.map((q,i)=>'<button role="listitem" class="rcchip'+(q.id===w.selected?' on':'')+(q.selected?' done':'')+'" data-pid="'+esc(q.id)+'" style="--cc:'+partColor(q,i)+'">'+(q.selected?'✓ ':'')+esc(q.name)+'</button>').join('')+'<button class="rcchip add" data-pid="+">+ Add</button>';
  for(const b of qa('#rcChips button'))b.disabled=locked;
  const cur=q('#rcChips .on');if(cur&&narrow())cur.scrollIntoView({block:'nearest',inline:'nearest'});
  // flow highlight
  const stage=!L.length||!p?1:!p.takes.length?2:!p.selected?3:n===L.length?4:2;for(const el of qa('#rcFlow .rcfs'))el.classList.toggle('cur',+el.dataset.fs===stage);
  $('rcUndo').disabled=!phraseUndoStack.length||locked;$('rcRedo').disabled=!phraseRedoStack.length||locked;
  $('rcUndo').title='Undo ('+phraseUndoStack.length+' step'+(phraseUndoStack.length===1?'':'s')+') · Ctrl+Z';$('rcRedo').title='Redo ('+phraseRedoStack.length+') · Ctrl+Shift+Z';
  $('rcJoinNote').textContent='× marks = smooth crossfades at the joins (no clicks) · join fade '+w.fadeMs+' ms';
  const lk=lanes().map(l=>l.k+(l.i??'')).join('|')+'|'+Math.round(songDur());if(lk!==RC.layoutKey){RC.layoutKey=lk;layout();}
}
$('rcTakes').addEventListener('pointerdown',()=>{RC.listPress=true;});window.addEventListener('pointerup',()=>{if(RC.listPress)setTimeout(()=>{RC.listPress=false;RC.sig='';},0);},true);window.addEventListener('pointercancel',()=>{RC.listPress=false;RC.sig='';},true);
$('rcTakes').addEventListener('click',e=>{const row=e.target.closest('.rctake');if(!row)return;const p=sel(),t=p?.takes.find(t=>t.id===row.dataset.id);if(!t)return;const b=e.target.closest('button');
  if(b&&b.dataset.star){PV.rate(t.id,+b.dataset.star);RC.sig='';return;}
  const act=b?b.dataset.act:'aud';if(act==='play'||act==='aud')audition(t,p);else if(act==='choose')choose(t,p);else if(act==='del')delTake(t,p);RC.sig='';});
$('rcTakes').addEventListener('dblclick',e=>{const row=e.target.closest('.rctake');if(!row||e.target.closest('button'))return;const p=sel(),t=p?.takes.find(t=>t.id===row.dataset.id);if(t)choose(t,p);});
$('rcChips').addEventListener('click',e=>{const b=e.target.closest('[data-pid]');if(!b)return;if(b.dataset.pid==='+'){openAdd(true);return;}const p=W().phrases.find(p=>p.id===b.dataset.pid);if(p)selectPart(p);});

// ---------------------------------------------------------------- buttons
$('rcBig').onclick=rcRecord;$('rcRec').onclick=rcRecord;$('rcRedoLast').onclick=redoLast;
$('rcPrev').onclick=()=>stepPart(-1);$('rcNext').onclick=()=>stepPart(1);
$('rcDelUn').onclick=()=>{PV.deleteUnchosen(false);RC.sig='';};
$('rcRename').onclick=()=>renamePart();$('rcDelPart').onclick=deletePart;$('rcAddPart2').onclick=()=>openAdd(true);$('rcAddBtn').onclick=()=>openAdd(true);
$('rcPlay').onclick=rcPlay;$('rcPlayP').onclick=rcPlay;$('rcStop').onclick=rcStop;$('rcStopP').onclick=rcStop;$('rcStart').onclick=rcToStart;
$('rcUndo').onclick=()=>{phraseHistory(-1);RC.sig='';};$('rcRedo').onclick=()=>{phraseHistory(1);RC.sig='';};
$('rcExport').onclick=exportComp;$('rcExportP').onclick=exportComp;$('rcDone').onclick=compDone;$('rcDoneP').onclick=compDone;
$('rcCount').onchange=()=>{const v=+$('rcCount').value;$('optCountIn').checked=v>0;$('optCountIn').dispatchEvent(new Event('change'));if(v>0){$('optCountBars').value=String(v);$('optCountBars').dispatchEvent(new Event('change'));}rcMsg(v?'Count-in: '+v+' bar'+(v>1?'s':'')+' of clicks before each take (headphones only).':'Count-in off.');RC.sig='';};
$('rcBacking').onclick=()=>{if($('beatOn').disabled||!S.beat){toast('No backing track','Open one from More ▾ › Open backing track.');return;}$('beatOn').checked=!$('beatOn').checked;$('beatOn').dispatchEvent(new Event('change'));if(playing&&RC.playMode){const t=D.playheadTime();stopAll();playFrom(t);}RC.dirty=true;};
$('rcHearComp').onclick=()=>{$('optHearOld').checked=!PV.prefs.hearOld;$('optHearOld').dispatchEvent(new Event('change'));if(playing&&RC.playMode){const t=D.playheadTime();stopAll();playFrom(t);}rcMsg(PV.prefs.hearOld?'Hear my comp ON: you hear your chosen takes while you play and record.':'Hear my comp OFF: backing only while you play and record.');};
for(const id of ['rcClip','rcClipP'])$(id).onclick=()=>$('dawClip').click();
for(const id of ['rcMeterBtn','rcMeterBtnP'])$(id).onclick=()=>PV.micCheck();
$('rcTempo').onclick=()=>{openMore($('rcMoreBtn'));setTimeout(()=>{const i=$('rcmBpm');if(i){i.focus();i.select();}},30);};
$('rcSaved').onclick=()=>$('dawSaved').click();
$('rcSong').ondblclick=()=>{const w=W(),v=prompt('Song name',w.title&&w.title!=='My phrase recording'?w.title:'');if(v!=null&&v.trim()){$('phraseTitle').value=v.trim();$('phraseTitle').dispatchEvent(new Event('change'));}};
$('rcView').addEventListener('pointerdown',()=>{D.ctx='phrase';},true);
function rcMsg(t){$('rcStatus').textContent=t;RC.msgAt=performance.now();}
RC.msg=rcMsg;

// ---------------------------------------------------------------- Add part popover
function openAdd(near){closePops();const pop=$('rcAdd');pop.hidden=false;const w=W();
  const guess=!w.phrases.length?'Intro':(()=>{const last=sorted().at(-1).name.toLowerCase();return /^intro/.test(last)?'Verse':/^verse/.test(last)?'Chorus':/^chorus/.test(last)?'Verse':/^bridge/.test(last)?'Chorus':'Verse';})();
  $('rcAddName').value=nameFor(guess);$('rcAddWhere').value='end';syncAddInfo();
  const anchor=narrow()?null:$('rcAddBtn').getBoundingClientRect();
  if(anchor&&anchor.width){pop.style.left=Math.max(8,Math.min(innerWidth-pop.offsetWidth-8,anchor.right-pop.offsetWidth))+'px';pop.style.top=Math.min(innerHeight-pop.offsetHeight-8,anchor.bottom+6)+'px';}else{pop.style.left=Math.max(8,(innerWidth-pop.offsetWidth)/2)+'px';pop.style.top=Math.max(8,(innerHeight-pop.offsetHeight)/3)+'px';}
  requestAnimationFrame(()=>{$('rcAddName').focus();$('rcAddName').select();});}
function syncAddInfo(){const [a,b]=addBounds($('rcAddWhere').value,+$('rcAddLen').value);const bar=barSec();$('rcAddInfo').textContent='From '+fmtShort(a)+' to '+fmtShort(b)+' (bar '+(Math.floor(a/bar+1e-6)+1)+' to '+Math.ceil(b/bar-1e-6)+') · you can drag its edges later.';}
for(const b of qa('#rcAddNames button'))b.onclick=()=>{$('rcAddName').value=nameFor(b.dataset.n);};
$('rcAddLen').onchange=syncAddInfo;$('rcAddWhere').onchange=syncAddInfo;
$('rcAddCancel').onclick=()=>{$('rcAdd').hidden=true;};
$('rcAddOk').onclick=()=>{const n=$('rcAddName').value.trim()||nameFor('Part');$('rcAdd').hidden=true;addPart(n,+$('rcAddLen').value,$('rcAddWhere').value);};
$('rcAddName').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();$('rcAddOk').click();}if(e.key==='Escape'){e.preventDefault();$('rcAdd').hidden=true;}});
RC.openAdd=openAdd;

// ---------------------------------------------------------------- More ▾ menu (every extra still works)
function moreItems(){const P=PV.prefs,w=W(),p=sel(),looping=!!(loop&&loop.daw&&playing);
  const tg=(on)=>'<i class="rcsw'+(on?' on':'')+'">'+(on?'ON':'OFF')+'</i>';
  return [
  ['h','RECORDING EXTRAS'],
  ['loopRec',(PV.state()&&PV.state().mode==='loop'?'■ Stop loop recording':'⟲ Loop this part · record a take every pass'),'Plays the part round and round; every full pass becomes a new take.'],
  ['punch','● Punch in now (while playing)','Press Play, then this (or R in POLISH) to start recording at the playhead.'],
  ['metro','Metronome click while playing'+tg(P.metro),'Headphones only, never recorded (key C).'],
  ['monitor','Hear myself (input monitoring)'+tg(P.monitor),'Wired headphones only. Adds a small delay.'],
  ['micCheck','Mic level check'+tg(PV.cap.checking),'See your level before recording (key I).'],
  ['gain','Mic gain <input type="range" id="rcmGain" min="-12" max="24" step="1" value="'+P.micGainDb+'"> <span id="rcmGainV">'+(P.micGainDb>0?'+':'')+P.micGainDb+' dB</span>',null],
  ['lat','Latency test (timing)…','Run once per device and browser so takes land on the beat.'],
  ['big','Phone REC MODE (big buttons)',null],
  ['stars','Star ratings on takes'+tg(RC.showStars),null],
  ['marker','Add song marker at the playhead (M)',null],
  ['h','THIS PART'],
  ['import','Import a take for this part (audio file)…',null,!p],
  ['unchoose','Clear the chosen take',null,!p||!p.selected],
  ['rename','Rename part…',null,!p],['delpart','Delete part…',null,!p],
  ['delAll','Delete unchosen takes in ALL parts…',null],
  ['h','SETTINGS'],
  ['count','Count-in <select id="rcmCount"><option value="0">Off</option><option value="1">1 bar</option><option value="2">2 bars</option></select>',null],
  ['lead','Pre-roll before IN <input type="number" id="rcmLead" min="0" max="5" step="0.5" value="'+w.lead+'"> s',null],
  ['fade','Join crossfade <input type="number" id="rcmFade" min="0" max="100" step="5" value="'+w.fadeMs+'"> ms',null],
  ['bpm','Tempo <input type="number" id="rcmBpm" min="50" max="200" value="'+bpm()+'"> BPM',null],
  ['backing','Backing'+tg(S.beat&&$('beatOn').checked),null,!S.beat],
  ['hearComp','Hear my comp while playing / recording'+tg(P.hearOld),null],
  ['audBeat','Hear backing when I play a take'+tg($('phraseCompareBeat').checked),null],
  ['h','FILES'],
  ['openBeat','Open backing track…',null],
  ['saveProj','Save project with every take (Ctrl+S)',null,$('phraseSave').disabled],
  ['openProj','Open song project…',null],
  ['export','Export comp (WAV)',null],
  ['recTab','All recording settings (POLISH › REC tab)',null],
  ['keys','Keyboard shortcuts',null]];}
function openMore(anchor){closePops();const m=$('rcMore');m.innerHTML=moreItems().map(([k,label,hint,dis])=>k==='h'?'<div class="rcmh">'+label+'</div>':
  (/<(input|select)/.test(label)?'<div class="rcmi rcmrow" data-k="'+k+'">'+label+'</div>':'<button class="rcmi" role="menuitem" data-k="'+k+'"'+(dis?' disabled':'')+'><span>'+label+'</span>'+(hint?'<small>'+hint+'</small>':'')+'</button>')).join('');
  m.hidden=false;$('rcmCount').value=PV.prefs.countIn?String(PV.prefs.countBars):'0';
  const r=(anchor||$('rcMoreBtn')).getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight;
  m.style.left=Math.max(6,Math.min(innerWidth-mw-6,r.right-mw))+'px';m.style.top=Math.max(6,Math.min(innerHeight-mh-6,r.bottom+4))+'px';
  $('rcmGain').oninput=e=>{PV.setGain(+e.target.value);$('rcmGainV').textContent=(PV.prefs.micGainDb>0?'+':'')+PV.prefs.micGainDb+' dB';};
  $('rcmCount').onchange=e=>{$('rcCount').value=e.target.value;$('rcCount').dispatchEvent(new Event('change'));};
  const num=(id,target)=>{$(id).onchange=e=>{$(target).value=e.target.value;$(target).dispatchEvent(new Event('change'));RC.sig='';RC.dirty=true;};$(id).addEventListener('keydown',ev=>ev.stopPropagation());};
  num('rcmLead','phraseLead');num('rcmFade','phraseFade');num('rcmBpm','bpm');}
RC.openMore=openMore;
function moreAct(k){const P=PV.prefs,p=sel();
  const keep=['metro','monitor','micCheck','stars','backing','hearComp','audBeat'].includes(k);
  ({loopRec:loopRec,punch:()=>{if(!playing){toast('Press Play first','Punch-in starts recording at the playhead while the song plays. Press Play, then choose this again (or press R in POLISH).');return;}punchNow();},
    metro:()=>PV.toggle('metro'),monitor:()=>{$('optMonitor').checked=!P.monitor;$('optMonitor').dispatchEvent(new Event('change'));},micCheck:()=>PV.micCheck(),
    lat:()=>PV.calOpen(),big:()=>PV.bigMode(true),stars:()=>{RC.showStars=!RC.showStars;LSset('pvs-rc-stars',RC.showStars);RC.sig='';},marker:()=>PV.markerAdd(),
    import:()=>$('phraseImport').click(),unchoose:()=>{phraseUnchoose();RC.sig='';},rename:()=>renamePart(),delpart:deletePart,delAll:()=>PV.deleteUnchosen(true),
    backing:()=>$('rcBacking').click(),hearComp:()=>$('rcHearComp').click(),audBeat:()=>{$('phraseCompareBeat').checked=!$('phraseCompareBeat').checked;},
    openBeat:()=>$('beatPick').click(),saveProj:()=>$('phraseSave').click(),openProj:()=>$('projBtn').click(),export:exportComp,
    recTab:()=>step('polish','rec'),keys:()=>dawOpenModal('helpModal','keys')})[k]?.();
  if(keep)setTimeout(()=>{if(!$('rcMore').hidden)openMore(RC.moreAnchor);},80);else $('rcMore').hidden=true;}
$('rcMore').addEventListener('click',e=>{const b=e.target.closest('button.rcmi');if(!b||b.disabled)return;moreAct(b.dataset.k);});
for(const id of ['rcMoreBtn','rcMoreP'])$(id).onclick=e=>{e.stopPropagation();if(!$('rcMore').hidden){$('rcMore').hidden=true;return;}RC.moreAnchor=$(id);openMore($(id));};
// punch-in records at the playhead over plain playback (the comp player is a phrase loop, which the 0.15 punch code treats as 'stopped')
async function punchNow(){if(loop&&!loop.daw){const at=D.playheadTime(),beat=S.beat&&$('beatOn').checked;endLoop();stopPlayback();RC.playMode=beat?'beat':null;
    if(!(await startPlayback(at,beat?'beat':undefined))){toast('Punch-in','Audio could not start.');return;}
    for(let i=0;i<40&&!playing;i++)await new Promise(r=>setTimeout(r,25));}
  if(playing){PV.record(false);rcMsg('Punch-in: recording from the playhead. Press Stop (or R) to finish.');}}
async function loopRec(){if(PV.state()){PV.stop(false);return;}const p=sel();if(!p){openAdd(true);return;}
  if(!(loop&&loop.daw&&playing)){if(playing||playPending)stopAll();D.region=null;$('dawLoop').click();}
  for(let i=0;i<60&&!(playing&&loop&&loop.daw);i++)await new Promise(r=>setTimeout(r,50));
  if(playing&&loop&&loop.daw){PV.record(false);rcMsg('Loop recording '+p.name+': every full pass becomes a new take. Press Stop (or R) to finish, Esc to drop the pass in progress.');}
  else toast('Loop recording','Could not start the loop. Load a backing track first.');}
function closePops(){$('rcMore').hidden=true;$('rcAdd').hidden=true;}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#rcMore,#rcMoreBtn,#rcMoreP'))$('rcMore').hidden=true;if(!e.target.closest('#rcAdd,#rcAddBtn,#rcAddPart2,#rcNext,#rcChips,#rcBig,#rcRec'))$('rcAdd').hidden=true;},true);

// ---------------------------------------------------------------- keys (only while RECORD & COMP is showing)
window.addEventListener('keydown',e=>{if(RC.step!=='rc')return;
  if(e.key==='Escape'&&(!$('rcMore').hidden||!$('rcAdd').hidden)&&!recording()){closePops();e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.defaultPrevented||isTyping(e.target)||e.altKey||e.ctrlKey||e.metaKey)return;
  if(qa('.modal').some(m=>!m.hidden)||!$('bigRec').hidden)return;
  const k=e.key,stop=()=>{e.preventDefault();e.stopImmediatePropagation();};
  if((k==='r'||k==='R')&&!e.shiftKey){stop();if(!e.repeat)rcRecord();return;}
  if(k===' '&&!recording()){stop();rcPlay();return;}
  if(k==='Home'){stop();rcToStart();return;}
  if(k==='Enter'&&!e.target.closest('button,a,summary,select,[role=button],[tabindex]')){stop();rcToStart();return;}
  if(k==='n'||k==='N'){stop();stepPart(1);return;}
  if(k==='p'||k==='P'){stop();stepPart(-1);return;}
  if(k==='l'||k==='L'){stop();loopRec();return;}
  if(/^[1-7]$/.test(k)){stop();if(k==='2')step('polish');return;}
},true);

// ---------------------------------------------------------------- frame: mirror readouts, poll, redraw
let lastSlow=0;
function frame(now){
  if(RC.step==='rc'){
    if(RC.auditioning&&!playing&&!playPending)restoreAfterAudition();
    if(!playing&&RC.playMode)RC.playMode=null;
    const t=nowT();const bar=barSec(),beat=beatSec();$('rcBars').textContent='bar '+(Math.floor(t/bar+1e-9)+1)+' · beat '+(Math.floor(t/beat+1e-9)%4+1);
    $('rcTime').textContent=mmss(t)+'  /  '+mmss(Math.max(songDur()-.5,0));
    const m=$('dawMicMeter');for(const id of ['rcMeter','rcMeterP']){$(id).style.width=m.style.width||'0';$(id).style.background=m.style.background||'';}
    const clip=$('dawClip').classList.contains('on');$('rcClip').classList.toggle('on',clip);$('rcClipP').classList.toggle('on',clip);
    $('rcPlay').textContent=playing||playPending?'❚❚':'▶';$('rcPlayP').textContent=playing||playPending?'❚❚ Pause':'▶ Play';
    if(rec&&rec.target==='phrase'){const tx=$('phraseRecTime').textContent;$('rcOrR').textContent='● '+tx;$('rcOrR').classList.add('live');}
    else if(rec){$('rcOrR').textContent='● '+($('pvsRecTime')?.textContent||'Recording');$('rcOrR').classList.add('live');}
    else{$('rcOrR').innerHTML=S.recStarting?'Allow the microphone…':'or press <b>R</b>';$('rcOrR').classList.remove('live');}
    if(now-lastSlow>200){lastSlow=now;slow();}
    if(RC.dirty||playing||rec||RC.drag){RC.dirty=false;if(!narrow())draw();else drawMini();}
  }
  requestAnimationFrame(frame);}
function slow(){pollReplace();sync(false);syncHeads();
  $('rcBpm').textContent=bpm()+' BPM';$('rcKey').textContent=$('dawKey').textContent;
  $('rcCount').value=PV.prefs.countIn?String(PV.prefs.countBars):'0';
  const bo=!!S.beat&&$('beatOn').checked;$('rcBacking').setAttribute('aria-pressed',bo);$('rcBacking').textContent=!S.beat?'NONE':bo?'ON':'OFF';
  $('rcHearComp').setAttribute('aria-pressed',PV.prefs.hearOld);$('rcHearComp').textContent=PV.prefs.hearOld?'ON':'OFF';
  const sv=$('dawSaved');$('rcSaved').textContent=sv.textContent;$('rcSaved').className='rcsaved '+sv.className.replace('savedind','').trim();$('rcSaved').title=sv.title;
  const chip=$('chip').textContent||'';$('rcEngine').textContent=/starting/i.test(chip)?'Engine starting…':/fail|error|could not|stopped/i.test(chip)?chip.slice(0,40):'Engine ready ●';$('rcEngine').title=chip;
  const w=W();$('rcSong').textContent=(w.title&&w.title!=='My phrase recording'?w.title:S.beat?S.beatName.replace(/\.[a-z0-9]+$/i,''):'New session')+' · lead vocal';
  const st=$('phraseStatus').textContent;if(st&&st!==RC.lastPhraseMsg){RC.lastPhraseMsg=st;if(performance.now()-(RC.msgAt||0)>400)$('rcStatus').textContent=st;}
}
// ---------------------------------------------------------------- start: RECORD & COMP is the default on open
document.body.classList.add('has-steps');RC.lastPhraseMsg=$('phraseStatus').textContent;
step(/[?&]step=polish\b/.test(location.search)?'polish':'rc'); // ?step=polish opens straight on POLISH (bookmark / tests)
layout();sync(true);requestAnimationFrame(frame);
})();
