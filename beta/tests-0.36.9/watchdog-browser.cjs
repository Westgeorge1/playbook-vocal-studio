/* Fault injection drops worklet messages; the real capture worklet still runs.
 * Exercises completion and received-audio recovery, using synthetic mic input. */
const {suite}=require('../tests-0.32.4/browser.cjs');
suite('watchdog-browser',60,async({page,check})=>{
 async function setup(seconds){
  const p=await page(1280,800);
  await p.evaluate(seconds=>{
   const Original=window.AudioWorkletNode;window.__captureMessages={frames:0,done:0,dropped:0};window.__captureDrop='';
   window.AudioWorkletNode=class extends Original {
    constructor(ctx,name,options){super(ctx,name,options);if(name!=='song-capture')return;
     let handler;Object.defineProperty(this.port,'onmessage',{configurable:true,get:()=>handler,set:fn=>{handler=fn;}});
     this.port.addEventListener('message',e=>{const d=e.data;if(d.data)__captureMessages.frames+=d.data.length;if(d.done)__captureMessages.done++;
      if(__captureDrop==='all'||(__captureDrop==='done'&&d.done)){__captureMessages.dropped++;return;}handler?.call(this.port,e);});this.port.start();
    }
   };
   S.song=SongCore.empty(48000);SongStudio.edit(w=>{w.lead=0;SongCore.addTake(w,{trackId:w.tracks[0].id,start:0,end:seconds,origin:0,channels:[new Float32Array(seconds*w.rate).fill(.05)],choose:true});w.range=[0,seconds];},'Watchdog fixture');
  },seconds);
  const before=await p.evaluate(()=>({choice:S.song.tracks[0].regions[0].selected,hash:SongCore.hashPcm(Object.values(S.song.sources)[0].channels)}));
  return {p,before};
 }
 const first=await setup(2);await first.p.evaluate(()=>__captureDrop='done');
 await first.p.locator('#sgQuickFix').click();await first.p.waitForFunction(()=>SongStudio.state().recording);
 await first.p.waitForFunction(()=>!SongStudio.locked()&&SongCore.usage(S.song).takes===2,null,{timeout:15000});
 const done=await first.p.evaluate(()=>{const r=S.song.tracks[0].regions[0];return {messages:__captureMessages,choice:r.selected,complete:r.takes.every(t=>SongCore.covers(S.song,t,r)),receipt:sgRecentLabel.textContent,status:sgStatus.textContent};});
 check('Completion acknowledgement was deliberately withheld',done.messages.done>0&&done.messages.dropped>0);
 check('Audio-clock endpoint still keeps the complete alternate',done.complete&&/Alternate take/.test(done.receipt));
 check('The earlier chosen vocal stays selected',done.choice===first.before.choice);
 await first.p.context().close();
 const stalled=await setup(12);await stalled.p.locator('#sgQuickFix').click();
 await stalled.p.waitForFunction(()=>SongStudio.state().recording&&SongStudio.state().position>1);
 const at=await stalled.p.evaluate(()=>{__captureDrop='all';return performance.now();});
 await stalled.p.waitForFunction(()=>!SongStudio.locked()&&SongCore.usage(S.song).takes===2,null,{timeout:12000});
 const saved=await stalled.p.evaluate(()=>{const r=S.song.tracks[0].regions[0],old=r.takes[0],take=r.takes[1],src=S.song.sources[take.source];return {at:performance.now(),messages:__captureMessages,choice:r.selected,oldHash:SongCore.hashPcm(S.song.sources[old.source].channels),frames:src.channels[0].length,hash:SongCore.hashPcm(src.channels),complete:SongCore.covers(S.song,take,r),status:sgStatus.textContent};});
 check('A stalled recorder is stopped independently of its twelve-second range',saved.at-at<10000&&saved.messages.dropped>0&&/stopped advancing/.test(saved.status));
 check('Received audio survives the missing-acknowledgement fallback',saved.frames>0&&!saved.complete);
 check('Stall recovery leaves the original selected and byte-identical',saved.choice===stalled.before.choice&&saved.oldHash===stalled.before.hash);
 await stalled.p.evaluate(()=>persistNow());await stalled.p.reload();await stalled.p.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked());
 check('Recovered partial audio survives reload',await stalled.p.evaluate(hash=>Object.values(S.song.sources).some(s=>SongCore.hashPcm(s.channels)===hash),saved.hash));
 await stalled.p.context().close();
});
