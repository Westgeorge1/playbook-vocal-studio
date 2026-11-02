/* Review physical transport controls with synthetic audio and isolated browser storage. */
const {suite}=require('../tests-0.32.4/browser.cjs');
function installMic(){
 window.micRequests=[];
 navigator.mediaDevices.getUserMedia=()=>new Promise((resolve,reject)=>{
  const request={reject,grant:async()=>{
   const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain(),dest=ctx.createMediaStreamDestination();
   gain.gain.value=.15;osc.frequency.value=262;osc.connect(gain).connect(dest);osc.start();await ctx.resume();
   request.stream=dest.stream;resolve(dest.stream);
  }};
  micRequests.push(request);
 });
 window.outputs=[];
 const connect=AudioNode.prototype.connect;
 AudioNode.prototype.connect=function(target,...args){
  if(target===this.context.destination&&this instanceof GainNode){
   const meter=this.context.createAnalyser();connect.call(this,meter);outputs.push(meter);
  }
  return connect.call(this,target,...args);
 };
 window.outputPeak=()=>Math.max(0,...outputs.map(m=>{
  const samples=new Float32Array(m.fftSize);m.getFloatTimeDomainData(samples);
  return samples.reduce((v,x)=>Math.max(v,Math.abs(x)),0);
 }));
}
suite('transport',27,async({b,page,check,errors})=>{
 for(const [width,height] of [[1280,600],[390,844]]){
  const live=process.env.PVS_TRANSPORT_URL;
  let p;
  if(live){
   const c=await b.newContext({viewport:{width,height},hasTouch:width===390,isMobile:width===390});
   p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(live,{timeout:90000,waitUntil:'domcontentloaded'});
  }else p=await page(width,height);
  await p.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked());
  await p.evaluate(installMic);
  const verify=(name,pass)=>check(width+'px '+name,pass);
  const click=async selector=>{const el=p.locator(selector);if(width===390)await el.tap();else await el.click();};
  const wait=async condition=>{
   try{await p.waitForFunction(condition,null,{timeout:30000});}
   catch(e){
    const state=await p.evaluate(()=>({transport:SongStudio.state(),status:sgStatus.textContent,dialog:document.querySelector('dialog[open]')?.id||'',focus:document.activeElement?.id||'',takes:SongCore.usage(S.song).takes}));
    throw Error('Waiting for '+condition.toString()+'; studio state '+JSON.stringify(state),{cause:e});
   }
  };
  const lane='[data-song-play="Lead vocal"]',instrumental='[data-song-play="Instrumental"]';
  verify('An empty song has the same unavailable Play control at the top and in the timeline',await p.locator('#sgPlay').isDisabled()&&await p.locator(lane).isDisabled());
  await p.evaluate(()=>{
   const ctx=audioCtx(),beat=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=beat.getChannelData(0);
   for(let i=0;i<data.length;i++)data[i]=.3*Math.sin(2*Math.PI*130*i/ctx.sampleRate);
   S.beat=beat;document.getElementById('beatOn').checked=true;SongStudio.render();
  });
  await click(instrumental);await wait(()=>SongStudio.state().playing&&outputPeak()>.025);
  verify('A backing-only song can play from its waveform before any recording',await p.evaluate(()=>SongCore.usage(S.song).takes===0&&SongStudio.state().playing));
  verify('The active main Play tooltip describes playback in a backing-only song',/play or pause/i.test(await p.locator('#sgPlay').getAttribute('title')));
  await click('#sgStop');
  if(!await p.locator('#sgWithout').isVisible())await click('.sg-record-helpers summary');
  await click('#sgWithout');
  verify('Vocals only on an empty lane disables both Play controls',await p.locator('#sgPlay').isDisabled()&&await p.locator(lane).isDisabled());
  await p.keyboard.press('c');verify('With Click enabled both Play controls become available',await p.locator('#sgPlay').isEnabled()&&await p.locator(lane).isEnabled());
  await p.keyboard.press('c');await p.evaluate(()=>{S.beat=null;S.song.cursor=0;SongStudio.render();});
  await click('#sgStartRecord');await wait(()=>micRequests.length===1);
  await click('#sgRecord');
  verify('Cancel frees the transport before the unanswered microphone request resolves',await p.evaluate(()=>!SongStudio.locked()&&!S.songWorking&&!SongStudio.state().opening&&/cancelled/i.test(sgStatus.textContent)));
  await p.evaluate(()=>{S.song.lead=0;});
  await click('#sgRecord');await wait(()=>micRequests.length===2);
  await p.evaluate(()=>micRequests[1].grant());await wait(()=>SongStudio.state().recording);
  await p.evaluate(()=>micRequests[0].grant());await wait(()=>micRequests[0].stream.getAudioTracks()[0].readyState==='ended');
  verify('A late permission grant closes only the cancelled stream',await p.evaluate(()=>SongStudio.state().recording&&micRequests[1].stream.getAudioTracks()[0].readyState==='live'));
  verify('Main and lane Play are disabled while recording',await p.locator('#sgPlay').isDisabled()&&await p.locator(lane).isDisabled());
  await p.waitForTimeout(1350);await click('#sgRecord');await wait(()=>!SongStudio.locked());
  verify('Stop & keep writes exactly one audible take and closes the microphone',await p.evaluate(()=>SongCore.usage(S.song).takes===1&&Object.values(S.song.sources)[0].channels[0].some(x=>Math.abs(x)>.04)&&micRequests[1].stream.getAudioTracks()[0].readyState==='ended'));
  await click('#sgHome');
  await p.evaluate(()=>{window.normalResume=resumeAudio;resumeAudio=()=>new Promise(resolve=>{window.wake=async()=>resolve(await normalResume());});});
  await click(lane);await wait(()=>typeof wake==='function');
  verify('Both Play buttons acknowledge pending startup and Stop is available',await p.evaluate(()=>!sgStop.disabled&&/Cancel play/.test(sgPlay.textContent)&&[...document.querySelectorAll('[data-song-play]')].every(el=>el.textContent.includes('Cancel play'))));
  await click('#sgStop');await p.evaluate(()=>wake());await p.waitForTimeout(150);
  verify('Stopping a pending start prevents late playback',await p.evaluate(()=>!SongStudio.state().playing&&sgStop.disabled&&/Play/.test(sgPlay.textContent)));
  await p.evaluate(()=>{window.wake=null;});await click('#sgPlay');await wait(()=>typeof wake==='function');await click(instrumental);await p.evaluate(()=>wake());await p.waitForTimeout(150);
  verify('A second tap on another lane cancels the pending start',await p.evaluate(()=>!SongStudio.state().playing&&S.song.cursor===0));
  await p.evaluate(()=>{resumeAudio=normalResume;});
  await click(lane);await wait(()=>SongStudio.state().playing&&outputPeak()>.025);
  verify('The recorded voice produces a measurable speaker-output signal',await p.evaluate(()=>SongStudio.state().position>0&&/Pause/.test(sgPlay.textContent)));
  await click('#sgPlay');const paused=await p.evaluate(()=>S.song.cursor);
  verify('Main Pause holds the timeline position',paused>0&&!await p.evaluate(()=>SongStudio.state().playing));
  await click(instrumental);await wait(()=>SongStudio.state().playing);
  verify('Play from the instrumental lane resumes from the same spot',await p.evaluate(t=>SongStudio.state().position>=t-.002&&S.song.activeTrack===S.song.tracks[0].id,paused));
  await p.evaluate(()=>audioCtx().suspend());await wait(()=>!SongStudio.state().playing);
  verify('Audio interruption pauses transport and offers a usable restart',await p.evaluate(()=>!sgPlay.disabled&&/interrupted/.test(sgStatus.textContent)));
  await click(lane);await wait(()=>SongStudio.state().playing&&outputPeak()>.025);
  await wait(()=>!SongStudio.state().playing);
  verify('Natural end resets Play on every lane',await p.evaluate(()=>[...document.querySelectorAll('[data-song-play]')].every(e=>e.dataset.transport==='Play')&&S.song.cursor>=1));
  await click(lane);await wait(()=>SongStudio.state().playing&&outputPeak()>.025);
  verify('Play at the end restarts the recorded take',await p.evaluate(()=>SongStudio.state().position<S.song.cursor));await click('#sgStop');
  const stable=await p.evaluate(()=>{
   const play=document.querySelector('[data-song-play]'),wave=document.querySelector('.sg-lane.active canvas');
   SongStudio.edit(w=>{SongCore.addSection(w,'Verse',0,9);w.cursor=0;},'Test nine-second timeline');
   return play.isConnected&&wave.isConnected;
  });
  verify('A refresh unrelated to the lane preserves its Play button and waveform',stable);
  await click(lane);await wait(()=>SongStudio.state().playing);await click('#sgRecord');await wait(()=>micRequests.length===3);await click('#sgStop');
  verify('Stop during punch-in setup stops both recording setup and the song',await p.evaluate(()=>!SongStudio.state().playing&&!SongStudio.locked()));
  await p.evaluate(()=>micRequests[2].grant());await wait(()=>micRequests[2].stream.getAudioTracks()[0].readyState==='ended');
  verify('Late punch-in permission creates no extra take',await p.evaluate(()=>SongCore.usage(S.song).takes===1&&!SongStudio.state().playing));
  await click('#sgHome');await click('#sgPlay');await wait(()=>SongStudio.state().position>.3);await p.keyboard.press('r');
  await wait(()=>micRequests.length===4);await p.evaluate(()=>micRequests[3].grant());await wait(()=>SongStudio.state().recording);await p.waitForTimeout(750);await p.keyboard.press('r');await wait(()=>!SongStudio.locked());
  verify('R punches out, saves the new take, and lets the song play on',await p.evaluate(()=>SongStudio.state().playing&&SongCore.usage(S.song).takes===2&&micRequests[3].stream.getAudioTracks()[0].readyState==='ended'));
  await click('#sgStop');await click('#sgHome');
  await click('#sgRecord');await wait(()=>micRequests.length===5);await p.evaluate(()=>micRequests[4].grant());await wait(()=>SongStudio.state().recording);await p.waitForTimeout(1000);
  await p.evaluate(()=>audioCtx().suspend());await wait(()=>!SongStudio.locked()&&!SongStudio.state().playing);
  verify('Interrupting active capture releases the microphone and keeps the received audio',await p.evaluate(()=>SongCore.usage(S.song).takes===3&&micRequests[4].stream.getAudioTracks()[0].readyState==='ended'&&Object.values(S.song.sources).every(s=>s.channels[0].some(x=>Math.abs(x)>.04))));
  await p.evaluate(()=>{
   window.resumeCalls=0;window.wakeRecording=null;
   resumeAudio=()=>++resumeCalls===2?new Promise(resolve=>{window.wakeRecording=async()=>resolve(await normalResume());}):normalResume();
  });
  await click('#sgRecord');await wait(()=>micRequests.length===6);await p.evaluate(()=>micRequests[5].grant());await wait(()=>typeof wakeRecording==='function');
  await click('#sgStop');await p.evaluate(()=>wakeRecording());await wait(()=>micRequests[5].stream.getAudioTracks()[0].readyState==='ended');
  verify('Cancelling after permission but before the recording clock starts leaves no playback or new take',await p.evaluate(()=>!SongStudio.locked()&&!SongStudio.state().playing&&SongCore.usage(S.song).takes===3));
  await p.evaluate(()=>{resumeAudio=normalResume;});await p.evaluate(()=>persistNow());await p.reload();await wait(()=>window.SongStudio&&!S.loading&&!sessionLocked());
  verify('The three recordings survive autosave and reopening',await p.evaluate(()=>SongCore.usage(S.song).takes===3));
  await p.context().close();
 }
});
