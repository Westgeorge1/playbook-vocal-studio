/* The nine-second fixture intentionally ends while microphone permission is pending. */
const {suite}=require('../tests-0.32.4/browser.cjs');
const fs=require('node:fs'),path=require('node:path');
suite('transport-permission',39,async({page,check})=>{
 const observations=[];
 const snapshot=()=>({state:SongStudio.state(),status:sgStatus.textContent,dialog:document.querySelector('dialog[open]')?.innerText||'',takes:SongCore.usage(S.song).takes,sourceIds:Object.keys(S.song.sources)});
 for(const mode of ['late-grant','denied']){
  const p=await page(1280,600);await p.waitForFunction(()=>!sessionLocked());
  await p.evaluate(()=>{
   const w=S.song=SongCore.empty(44100),pcm=Float32Array.from({length:44100*2},(_,i)=>.15*Math.sin(i*.03));
   SongCore.addTake(w,{channels:[pcm],rate:44100,start:0,end:2,choose:true});SongCore.addSection(w,'Permission test',0,9);w.cursor=0;SongStudio.render();
   window.permissionRequests=[];
   navigator.mediaDevices.getUserMedia=()=>new Promise((resolve,reject)=>{
    const request={reject,grant:async()=>{
     const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain(),dest=ctx.createMediaStreamDestination();
     gain.gain.value=.15;osc.connect(gain).connect(dest);osc.start();await ctx.resume();request.stream=dest.stream;resolve(dest.stream);
    }};permissionRequests.push(request);
   });
   window.fingerprint=async()=>({takes:SongCore.usage(S.song).takes,sources:await Promise.all(Object.entries(S.song.sources).map(async([id,s])=>({id,rate:s.rate,channels:await Promise.all(s.channels.map(async c=>({frames:c.length,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c))).map(n=>n.toString(16).padStart(2,'0')).join('')})))})))});
  });
  const before=await p.evaluate(()=>fingerprint());
  await p.locator('#sgPlay').click();await p.waitForFunction(()=>SongStudio.state().playing&&SongStudio.state().position>.3);
  await p.keyboard.press('r');await p.waitForFunction(()=>permissionRequests.length===1&&SongStudio.state().opening);
  check(mode+': no PCM or new take is promised while permission is unanswered',await p.evaluate(()=>!SongStudio.state().recording&&!SongStudio.state().starting&&SongCore.usage(S.song).takes===1));
  const pending=await p.evaluate(snapshot);
  if(mode==='late-grant'){
   await p.waitForFunction(()=>!SongStudio.state().playing);
   check('Natural end before permission leaves the original audio unchanged',JSON.stringify(before)===JSON.stringify(await p.evaluate(()=>fingerprint())));
   await p.evaluate(()=>permissionRequests[0].grant());
   await p.waitForFunction(()=>!SongStudio.state().opening&&!!document.querySelector('dialog[open]'));
   check('Late permission is rejected, stream closed, and capture never starts',await p.evaluate(()=>!SongStudio.state().recording&&!SongStudio.state().starting&&permissionRequests[0].stream.getAudioTracks().every(t=>t.readyState==='ended')&&songDialog.innerText.includes('Punch-in cancelled.')));
  }else{
   await p.evaluate(()=>permissionRequests[0].reject(Object.assign(new Error('Permission denied'),{name:'NotAllowedError'})));
   await p.waitForFunction(()=>!SongStudio.state().opening&&!!document.querySelector('dialog[open]'));
   check('Denied permission reports the microphone block without starting capture',await p.evaluate(()=>!SongStudio.state().recording&&!SongStudio.state().starting&&songDialog.innerText.includes('Record needs your microphone')));
  }
  const after=await p.evaluate(()=>fingerprint());
  check(mode+': source PCM hashes and take count remain unchanged',JSON.stringify(before)===JSON.stringify(after));
  observations.push({mode,before,pending,after,state:await p.evaluate(snapshot)});await p.context().close();
 }
 if(process.env.PVS_TEST_OUT){fs.mkdirSync(process.env.PVS_TEST_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.PVS_TEST_OUT,'permission-observations.json'),JSON.stringify(observations,null,2));}
});
