/* Immutable, non-ripple vocal edits. Originals stay in the workspace.
   From the third-party 0.18.1 build; 0.18.2 fixes the edge ramp at the ends of the audio (see edit()). */
(function(root){
'use strict';
const C=typeof module==='object'?require('./phrase-core.js'):root.PhraseCore;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function range(t,a,b){if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw new Error('Select a start and end first.');const o=C.origin(t),n=t.channels[0].length,from=clamp(Math.round((a-o)*t.rate),0,n),to=clamp(Math.round((b-o)*t.rate),0,n);if(to-from<2)throw new Error('The selection contains no recorded audio.');return [from,to];}
function edit(t,a,b,kind,value=0){
 const [from,to]=range(t,a,b),n=to-from,g=Math.pow(10,value/20),edge=Math.min(Math.round(t.rate*.005),Math.floor(n/2));
 if(!['gain','silence','fade-in','fade-out'].includes(kind)||!Number.isFinite(value)||Math.abs(value)>24)throw new Error('Invalid edit.');
 const o=C.origin(t),inL=Math.round((a-o)*t.rate)>0,inR=Math.round((b-o)*t.rate)<t.channels[0].length; // 0.18.2: no 5 ms ramp where the selection runs past the start / end of the audio (it left the last 5 ms un-silenced)
 const channels=t.channels.map(src=>{const out=src.slice();for(let i=from;i<to;i++){const x=(i-from)/(n-1),smooth=edge?clamp(Math.min(inL?i-from:Infinity,inR?to-1-i:Infinity)/edge,0,1):1;let mul=kind==='gain'?1+(g-1)*smooth:kind==='silence'?1-smooth:kind==='fade-in'?x:1-x;out[i]=src[i]*mul;}return out;});
 return {...t,channels,profile:null,analysisError:null,analysisToken:undefined,sourceTake:t.sourceTake||t.id,edit:kind};
}
function clearIncomplete(p){if(p.selected&&!C.covers(p.takes.find(t=>t.id===p.selected),p))p.selected=null;}
function transform(w,pid,action,args={}){
 const next=C.clone(w),p=next.phrases.find(p=>p.id===pid);if(!p)throw new Error('Select a part first.');
 if(action==='trim'){C.span(args.start,args.end);p.start=args.start;p.end=args.end;clearIncomplete(p);}
 else if(action==='move'){const delta=args.start-p.start;if(!Number.isFinite(delta))throw new Error('Enter a valid position.');p.start+=delta;p.end+=delta;for(const t of p.takes){t.origin+=delta;t.profile=null;}}
 else if(action==='nudge'){const t=p.takes.find(t=>t.id===args.tid);if(!t)throw new Error('Select a take.');t.offsetMs=(t.offsetMs||0)+args.ms;t.profile=null;clearIncomplete(p);}
 else if(action==='split'){
  const at=args.at;C.span(p.start,at);C.span(at,p.end);const q={...p,id:'p'+next.nextId++,name:p.name+' · next',start:at,takes:[]};p.end=at;
  for(const t of p.takes){const id='t'+next.nextId++,o=C.origin(t),from=clamp(Math.floor((at-.1-o)*t.rate),0,t.channels[0].length-1);q.takes.push({...t,id,origin:o+from/t.rate,offsetMs:0,channels:t.channels.map(c=>c.slice(from)),profile:null,analysisToken:undefined});if(q.selected===t.id)q.selected=id;if(q.reference===t.id)q.reference=id;}
  next.phrases.splice(next.phrases.indexOf(p)+1,0,q);clearIncomplete(p);clearIncomplete(q);next.selected=q.id;
 }else throw new Error('Unknown part edit.');
 C.validate(next);return next;
}
const api={range,edit,transform};if(typeof module==='object'&&module.exports)module.exports=api;else root.VocalEdit=api;
})(typeof self!=='undefined'?self:this);
