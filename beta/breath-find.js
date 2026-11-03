/* 0.33.0: find every likely breath in a vocal at once. A breath is a short stretch of quiet, noisy (unpitched,
 * many zero crossings) sound, well below the singing level and above the room's background. Candidates are
 * suggestions only: the singer listens to each one and unticks anything that is part of a word (S, F, SH).
 * Works in the browser (window.BreathFind) and in Node (module.exports) for tests. */
(function(root){
'use strict';
function mono(channels){const n=channels[0].length;if(channels.length===1)return channels[0];const m=new Float32Array(n);for(const c of channels)for(let i=0;i<n;i++)m[i]+=c[i]/channels.length;return m;}
function pct(a,p){if(!a.length)return 0;const s=Float32Array.from(a).sort();return s[Math.min(s.length-1,Math.max(0,Math.floor(p*(s.length-1))))];}
// Returns [{start,end,db,score}] in seconds, sorted by time. Options: minLen, maxLen (s), exclude [[a,b],...].
function find(channels,rate,opt={}){
 const x=mono(channels),hop=Math.max(1,Math.round(rate*.02)),n=Math.floor(x.length/hop);if(n<4)return [];
 const rms=new Float32Array(n),zcr=new Float32Array(n);
 for(let k=0;k<n;k++){let p=0,z=0;const o=k*hop;for(let i=o+1;i<o+hop;i++){p+=x[i]*x[i];if((x[i]>=0)!==(x[i-1]>=0))z++;}rms[k]=Math.sqrt(p/hop);zcr[k]=z/hop;}
 const db=Array.from(rms,v=>20*Math.log10(v+1e-9)),floor=pct(db,.1),loud=pct(db,.92);
 // Singing sits near the loud level; background near the floor. A breath lives in between.
 const hi=Math.min(loud-10,-14),lo=Math.max(floor+6,-66),minLen=opt.minLen??.12,maxLen=opt.maxLen??1.2,ex=opt.exclude||[];
 const noisy=k=>db[k]>lo&&db[k]<hi&&zcr[k]>.08;
 const out=[];let s=-1,gap=0;
 for(let k=0;k<=n;k++){
  const on=k<n&&noisy(k);
  if(on){if(s<0)s=k;gap=0;continue;}
  if(s>=0&&k<n&&gap<1&&k+1<n&&noisy(k+1)){gap++;continue;}
  if(s>=0){const e=k-gap,a=s*hop/rate,b=e*hop/rate,len=b-a;
   if(len>=minLen&&len<=maxLen){
    // Singing right before or after is fine (breaths sit between phrases) but the stretch itself must not be pitched.
    let peak=-120,z=0;for(let j=s;j<e;j++){peak=Math.max(peak,db[j]);z+=zcr[j];}z/=Math.max(1,e-s);
    const score=Math.max(0,Math.min(1,(z-.08)/.25))*.5+Math.max(0,Math.min(1,(hi-peak)/12))*.5;
    const pad=.03,A=Math.max(0,a-pad),B=Math.min(x.length/rate,b+pad);
    if(!ex.some(([u,v])=>A<v&&B>u))out.push({start:+A.toFixed(4),end:+B.toFixed(4),db:+peak.toFixed(1),score:+score.toFixed(2)});
   }}
  s=-1;gap=0;
 }
 return out;
}
// Merge two candidate lists (for example the engine's own suggestions and ours), keeping one entry per breath.
function merge(a,b){const all=[...a,...b].sort((p,q)=>p.start-q.start),out=[];for(const c of all){const last=out[out.length-1];if(last&&c.start<last.end){last.end=Math.max(last.end,c.end);last.score=Math.max(last.score??0,c.score??0);last.db=Math.max(last.db??-120,c.db??-120);}else out.push({...c});}return out;}
// Estimate voicing in 10 ms frames relative to the whole lane. Use the stronger
// channel in each frame so opposite-polarity stereo audio cannot cancel out.
function sungFrames(channels,rate){
 const samples=channels[0].length,hop=Math.round(rate*.01),count=Math.ceil(samples/hop);
 const levels=new Float32Array(count),crossings=new Float32Array(count);
 for(let frame=0;frame<count;frame++){
  const start=frame*hop,end=Math.min(start+hop,samples),length=end-start;
  let strongest=-1;
  for(const channel of channels){
   let energy=0,changes=0;
   for(let i=start;i<end;i++){
    energy+=channel[i]*channel[i];
    if(i>start&&(channel[i]>=0)!==(channel[i-1]>=0))changes++;
   }
   if(energy>strongest){strongest=energy;crossings[frame]=changes/length;}
  }
  levels[frame]=10*Math.log10(strongest/length+1e-12);
 }
 const sorted=levels.slice().sort(),floor=sorted[Math.floor(.1*(count-1))],loud=sorted[Math.floor(.95*(count-1))];
 // A take can be one sustained note with no quiet opening.
 const threshold=Math.max(-70,Math.min(floor+12,loud-6),loud-30);
 return Uint8Array.from(levels,(level,i)=>level>threshold&&crossings[i]<.12?1:0);
}
const frameCache=new WeakMap();
function voicedShare(src,a,b){
 if(!src||!src.channels?.[0]?.length||!(b>a))return null;
 let frames=frameCache.get(src);if(!frames){frames=sungFrames(src.channels,src.rate);frameCache.set(src,frames);}
 const hop=Math.round(src.rate*.01)/src.rate,start=Math.max(0,Math.floor(a/hop)),end=Math.min(frames.length,Math.ceil(b/hop));
 if(end<=start)return null;let count=0;for(let i=start;i<end;i++)count+=frames[i];return count/(end-start);
}
const api={find,merge,voicedShare};root.BreathFind=api;if(typeof module!=='undefined')module.exports=api;

/* ---------- WAVE EDIT → Breaths: Find all breaths (browser) ---------- */
if(!root.document)return;
const doc=root.document,$=id=>doc.getElementById(id);
let found=[],batch=null;
const clock=t=>{const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(2);};
// The cleaned vocal when there is one (noise and beat bleed hide breaths), else the original recording.
function input(){if(typeof S==='undefined')return null;return S.audio?.[1]||S.audio?.[5]||(S.main?[S.main]:null);}
function reduced(){const e=(typeof S!=='undefined'?S:null)?.st?.edits?.breaths||[];return e.map(b=>[b[0],b[1]]);}
function db(){try{return +breathKnob.value;}catch(_){return 6;}}
function render(){const box=$('breathList');if(!box)return;if(!found.length){box.hidden=false;box.innerHTML='<p class="note">'+(batch?'All ticked breaths are reduced.':'No likely breaths found. Drag over a breath on the waveform to select it by hand.')+'</p>'+(batch?'<div class="btnrow"><button class="btn" id="breathUndoAll">Undo these '+batch.edits.length+'</button></div>':'');return;}
 box.hidden=false;
 box.innerHTML='<p class="note"><b>'+found.length+' possible breath'+(found.length===1?'':'s')+'.</b> Tap ▶ to listen. Untick anything that is part of a word (S, F, SH, T).</p><div class="breath-rows">'+found.map((b,i)=>'<div class="breath-row"><label><input type="checkbox" data-breath="'+i+'"'+(b.on?' checked':'')+'> '+clock(b.start)+'–'+clock(b.end)+' <small>'+(b.db!=null?b.db.toFixed(0)+' dB':'')+'</small></label><button class="btn small" data-breath-play="'+i+'" aria-label="Listen to breath '+(i+1)+'">▶</button><button class="btn small" data-breath-show="'+i+'" aria-label="Show breath '+(i+1)+' on the waveform">Show</button></div>').join('')+'</div>'
  +'<div class="btnrow"><button class="btn primary" id="breathReduceAll">Reduce ticked breaths by '+db().toFixed(1)+' dB</button><button class="btn" id="breathTickNone">Untick all</button><button class="btn" id="breathUndoAll"'+(batch?'':' hidden')+'>Undo these '+(batch?batch.edits.length:0)+'</button></div><p class="note">The reduction uses the REDUCTION knob above. Each breath becomes a normal breath edit you can choose and remove later.</p>';}
function scan(){const ch=input();if(!ch){$('editStatus').textContent='Open a vocal first.';return;}
 const ours=api.find(ch,S.rate,{exclude:reduced()}),eng=(S.st?.breathSuggestions||[]).map(b=>({start:b[0],end:b[1],db:null,score:.5})).filter(b=>!reduced().some(([a,c])=>b.start<c&&b.end>a));
 found=api.merge(ours,eng).map(b=>({...b,on:true}));batch=null;render();$('editStatus').textContent=found.length?'Found '+found.length+' possible breath'+(found.length===1?'':'s')+'. Listen, untick any words, then reduce.':'No likely breaths found.';}
function apply(){const on=found.filter(b=>b.on);if(!on.length){$('editStatus').textContent='Tick at least one breath.';return;}if(S.busy||S.loading)return;
 const v=db(),steps=on.map(b=>['edit',0,-1,b.start,b.end,v]),before=(S.st?.edits?.breaths||[]).length;
 endLoop();run(async()=>{setBusy(true);
  try{const r=await engine({type:'run',steps,update:true});absorb(r);S.dirty=false;readyStatus();persist();
   const after=(S.st?.edits?.breaths||[]).length;batch={edits:on.map(b=>[b.start,b.end,v])};found=found.filter(b=>!b.on);render();
   $('editStatus').textContent='Reduced '+(after-before)+' breath'+(after-before===1?'':'s')+' by '+v.toFixed(1)+' dB. Tap Hear final. "Undo these" puts them all back.';}
  catch(err){$('editStatus').textContent='Breaths were not reduced: '+err.message;try{absorb(await engine({type:'run',steps:[],update:false}));}catch(_){}}
  setBusy(false);});}
// Removes exactly the breath edits this batch added, wherever they now sit in the list. Later edits of any kind
// (timing, comp, other breaths, tuning) are untouched. Edits from the batch that were changed or removed since are skipped.
function undoAll(){if(!batch||S.busy)return;const list=S.st?.edits?.breaths||[],near=(a,b,t=2e-3)=>Math.abs(a-b)<t,idx=[];
 for(const [a,b,v] of batch.edits){const k=list.findIndex((e,i)=>!idx.includes(i)&&near(e[0],a)&&near(e[1],b)&&near(e[2],v,.05));if(k>=0)idx.push(k);}
 if(!idx.length){$('editStatus').textContent='These breath edits were already changed or removed.';batch=null;render();return;}
 idx.sort((x,y)=>y-x);const missing=batch.edits.length-idx.length;endLoop();run(async()=>{setBusy(true);try{const r=await engine({type:'run',steps:idx.map(k=>['editRemove',0,k]),update:true});absorb(r);persist();batch=null;$('editStatus').textContent='Removed the '+idx.length+' breath reduction'+(idx.length===1?'':'s')+' from this batch.'+(missing?' '+missing+' had been changed or removed already.':' Your other edits are kept.');scan();}catch(err){$('editStatus').textContent='Undo failed: '+err.message;try{absorb(await engine({type:'run',steps:[],update:false}));}catch(_){}}setBusy(false);});}
function install(){const rack=$('breathRack');if(!rack||$('breathFindAll'))return;const row=rack.querySelector('.btnrow');const b=doc.createElement('button');b.className='btn';b.id='breathFindAll';b.textContent='Find all breaths';row.append(b);
 const list=doc.createElement('div');list.id='breathList';list.className='breath-list';list.hidden=true;row.after(list);
 b.onclick=scan;
 list.addEventListener('change',e=>{const i=e.target.dataset.breath;if(i!=null){found[+i].on=e.target.checked;}});
 list.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
  if(t.dataset.breathPlay!=null){const x=found[+t.dataset.breathPlay];playLoop(input(),1,Math.max(0,x.start-.25),x.end+.25,{edit:'main'});}
  else if(t.dataset.breathShow!=null){const x=found[+t.dataset.breathShow];S.edit.sel=[x.start,x.end];S.edit.chosen=-1;zoomTo(x.start-1.5,x.end+1.5);syncEdit();}
  else if(t.id==='breathReduceAll')apply();else if(t.id==='breathTickNone'){found.forEach(x=>x.on=false);render();}else if(t.id==='breathUndoAll')undoAll();});
 $('breathKnobs').addEventListener('pointerup',()=>setTimeout(()=>{const r=$('breathReduceAll');if(r)r.textContent='Reduce ticked breaths by '+db().toFixed(1)+' dB';},50));}
const go=()=>{if($('breathRack')&&typeof engine==='function')install();else setTimeout(go,200);};doc.readyState==='loading'?doc.addEventListener('DOMContentLoaded',go):go();
root.BreathList={scan,apply,undoAll,found:()=>found.map(b=>({...b}))};
})(typeof window!=='undefined'?window:globalThis);
