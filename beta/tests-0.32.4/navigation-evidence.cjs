'use strict';
// Bounded observations only: no app calls, PCM, retries, or changed test deadlines.
async function attach(context, page) {
 const network=[];
 const add=(kind,detail)=>{network.push({at:Date.now(),kind,...detail});if(network.length>80)network.shift();};
 const asset=url=>{try{return new URL(url).pathname;}catch{return String(url).slice(0,200);}};
 page.on('requestfailed',r=>add('requestfailed',{asset:asset(r.url()),error:r.failure()?.errorText}));
 page.on('response',r=>{if(r.status()>=400)add('response',{asset:asset(r.url()),status:r.status()});});
 page.on('worker',w=>add('worker',{asset:asset(w.url())}));
 page.on('crash',()=>add('crash',{}));
 page.on('filechooser',()=>add('filechooser',{}));
 await context.addInitScript(()=>{
  if(window!==window.top)return;
  const samples=[],limit=180;let frames=0,lastFrame=null;
  const read=fn=>{try{return fn();}catch{return null;}};
  const sample=()=>{
   const state={at:Date.now(),visibility:document.visibilityState,frames,lastFrame,
    locked:read(()=>sessionLocked()),lockReason:read(()=>lockReason()),
    flags:read(()=>Object.fromEntries(['busy','dirty','loading','loadError','songWorking','songApplying','restorePaused'].map(k=>[k,S[k]??null]))),
    polish:read(()=>SongPolish.state()),
    tuner:read(()=>({pending:NoteTuner.pending(),failed:NoteTuner.failed()})),
    noise:read(()=>({locked:NoiseCleaner.locked(),failed:NoiseCleaner.failed()})),
    status:Object.fromEntries(['sgStatus','sgPolishProgress','polishTrackStatus','noteRouteStatus','noiseStatus'].map(id=>[id,document.getElementById(id)?.textContent?.slice(0,600)||'']))};
   samples.push(state);if(samples.length>limit)samples.shift();
   requestAnimationFrame(()=>{frames++;lastFrame=Date.now();});
  };
  window.__pvsNavigationEvidence={dump:()=>({limit,intervalMs:500,samples:samples.slice()})};
  sample();const timer=setInterval(sample,500);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 });
 return network;
}
module.exports={attach};
