/* Isolated chain preview: the main editor and its Undo stack are never touched. */
(function(root){
'use strict';
function create(){
 const worker=new Worker('worker.js?v=0.29.0'),pending=new Map();let serial=0,closed=false,readyResolve,readyReject;
 const ready=new Promise((res,rej)=>{readyResolve=res;readyReject=rej;});ready.catch(()=>{});
 function stop(message='Preview cancelled.'){if(closed)return;closed=true;clearTimeout(timer);worker.terminate();const e=Error(message);readyReject(e);for(const p of pending.values())p.reject(e);pending.clear();}
 const timer=setTimeout(()=>stop('The preview timed out. Your settings are unchanged.'),120000);
 worker.onmessage=({data:m})=>{if(m.type==='ready')readyResolve();else if(m.type==='error')stop(m.message);else if(m.type==='done'){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve(m);}}};worker.onerror=e=>stop(e.message||'Preview could not start.');
 async function call(m){await ready;if(closed)throw Error('Preview cancelled.');return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});try{worker.postMessage({...m,id});}catch(e){pending.delete(id);reject(e);}});}
 async function render(channels,rate,params,changes,cropStart,cropEnd){
  try{await call({type:'open',channels,rate,importKind:1,detectKey:false});
   const steps=Object.entries(params).filter(([id,v])=>id.startsWith('ch')&&id!=='chainPreset'&&Number.isFinite(v)).map(([id,v])=>['set',id,v]);
   steps.push(['set','cleanOn',0],['set','amount',0],['set','drift',0],['set','chRepairOn',0],['set','chRoomReduceOn',0],['set','followSinging',0]);
   const a=await call({type:'run',steps,update:true,want:[3,4]});
   if(!SongCore.samePcm(channels,a.audio[3]))throw Error('The preview unexpectedly changed the tuned input. Your settings are unchanged.');
   const b=await call({type:'run',steps:Object.entries(changes).map(([id,v])=>['set',id,v]),update:true,want:[4]});
   const cut=r=>{if(!r.audio?.[4]?.[0])throw Error('The preview did not return audio.');const out=r.audio[4].map(c=>c.slice(cropStart,cropEnd));QualityCore.check(out,rate);return out;};
   return {before:cut(a),after:cut(b),rate};
  }finally{stop();}
 }
 return {render,cancel:()=>stop()};
}
root.ReferencePreview={create};
})(globalThis);
