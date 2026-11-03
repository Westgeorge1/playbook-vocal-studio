/* Touch-only regression. Chromium uses a real MediaStream from its test microphone
 * and the studio's Web Audio capture worklet. Permission timing is controlled by the test. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {wave}=require('../tests-0.32.4/browser.cjs');
const port=require('../tests-0.32.4/test-port.cjs')(8996,44);
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const rows=[],errors=[],tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pvs-phone-'));
const check=(name,ok)=>{rows.push({name,pass:!!ok});assert.ok(ok,name);console.log('PASS',name);};
let server,browser;
async function run(width,url){
 const c=await browser.newContext({viewport:{width,height:width===360?740:850},deviceScaleFactor:3,hasTouch:true,isMobile:true,permissions:['microphone']});
 // Wrap only the permission decision. On grant Chromium supplies the microphone.
 await c.addInitScript(()=>{
  localStorage.setItem('pvs.coachExplain','1');window.requests=[];
  const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=opt=>new Promise((resolve,reject)=>{
   const r={active:navigator.userActivation.isActive,grant:async()=>{try{r.stream=await get(opt);resolve(r.stream);}catch(e){reject(e);}},deny:()=>reject(new DOMException('Permission denied','NotAllowedError'))};requests.push(r);
  });
  window.sheet=hidden=>{
   Object.defineProperty(document,'hidden',{value:hidden,configurable:true});
   Object.defineProperty(document,'visibilityState',{value:hidden?'hidden':'visible',configurable:true});
   document.dispatchEvent(new Event('visibilitychange'));
  };
 });
 try{
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  const wait=async fn=>{try{await p.waitForFunction(fn,null,{timeout:20000});}catch(err){
   const state=await p.evaluate(()=>({status:sgStatus.textContent,dialog:songDialog.open?songDialog.innerText:'',song:SongStudio.state(),button:sgRecord.textContent,requests:requests.map(r=>({active:r.active,track:r.stream?.getTracks()[0]?.readyState})),hidden:document.hidden}));
   throw Error('Waiting for '+fn+' '+JSON.stringify(state),{cause:err});
  }},tap=sel=>p.locator(sel).tap(),test=(name,ok)=>check(width+'px '+name,ok);
  await wait(()=>window.PvsCoach&&window.SongStudio&&!S.loading&&!sessionLocked());
  test('current beta and persisted Explain mode loaded',await p.evaluate(expected=>APP_VERSION===expected&&coachExplain.checked,process.env.PVS_EXPECT_VERSION||'0.36.3'));
  await tap('#sgHelp');await p.locator('#songDialog[open]').waitFor();
  test('Help opens on the first touch with Explain on',await p.locator('#sgDialogTitle').innerText()==='How Song & Vocals works');
  await tap('#songDialog [data-action=ok]');test('dialog Close also operates on touch',!await p.locator('#songDialog').isVisible());
  await tap('#sgSnap');const snap=await p.locator('#sgSnap').isChecked();await tap('#sgSnap');
  test('a checkbox still changes through native touch',snap!==await p.locator('#sgSnap').isChecked());
  await p.evaluate(()=>{S.song.lead=0;SongStudio.render();});
  await tap(width===360?'#sgStartRecord':'#sgRecord');await wait(()=>requests.length===1);
  test('first Record tap requests the microphone during user activation',await p.evaluate(()=>requests[0].active&&SongStudio.state().opening));
  test('permission instructions are visible while setup is pending',await p.locator('#sgMicWait').isVisible());
  await p.evaluate(()=>sheet(true));
  test('showing a simulated permission sheet keeps setup pending',await p.evaluate(()=>SongStudio.state().opening&&!SongStudio.state().recording));
  if(width===360){await p.evaluate(()=>sheet(false));await p.evaluate(()=>requests[0].grant());}
  else{
   await p.evaluate(()=>requests[0].grant());await wait(()=>requests[0].stream&&!requests[0].stream.getAudioTracks()[0].enabled);
   test('grant while hidden mutes the input and creates no take',await p.evaluate(()=>!SongStudio.state().recording&&SongCore.usage(S.song).takes===0));
   await p.evaluate(()=>sheet(false));
  }
  await wait(()=>SongStudio.state().recording&&sgRecord.textContent.includes('Stop & keep'));
  test('permission granted once starts the capture worklet',await p.evaluate(()=>requests.length===1&&requests[0].stream.getAudioTracks()[0].enabled));
  await p.waitForTimeout(1200);await tap('#sgStop');await wait(()=>!SongStudio.locked()&&SongCore.usage(S.song).takes===1);
  test('Stop saves one audible take and releases the microphone',await p.evaluate(()=>requests[0].stream.getTracks().every(t=>t.readyState==='ended')&&Object.values(S.song.sources).some(s=>s.channels[0].some(v=>Math.abs(v)>.01))));
  await tap('#sgHearRecent');await wait(()=>SongStudio.state().playing);test('Hear this take starts playback with Explain still on',true);
  await tap('#sgStop');await tap('#sgHome');await tap('[data-song-play="Lead vocal"]');await wait(()=>SongStudio.state().playing);await tap('#sgStop');
  test('Play on the track and Stop respond to touch',await p.evaluate(()=>!SongStudio.state().playing));
  await tap('#sgRecord');await wait(()=>requests.length===2);await p.evaluate(()=>sheet(true));await p.evaluate(()=>requests[1].grant());
  await wait(()=>requests[1].stream&&!requests[1].stream.getAudioTracks()[0].enabled);await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await p.evaluate(()=>sheet(false));
  await wait(()=>!SongStudio.locked()&&requests[1].stream.getTracks().every(t=>t.readyState==='ended'));
  test('leaving the page during permission releases the mic and never saves a phantom take',await p.evaluate(()=>SongCore.usage(S.song).takes===1));
  await tap('#sgRecord');await wait(()=>requests.length===3);await tap('#sgStop');await p.evaluate(()=>requests[2].grant());
  await wait(()=>requests[2].stream.getTracks().every(t=>t.readyState==='ended'));
  test('late permission after explicit Stop releases the input',await p.evaluate(()=>!SongStudio.locked()&&SongCore.usage(S.song).takes===1));
  await tap('#sgRecord');await wait(()=>requests.length===4);await p.evaluate(()=>requests[3].deny());await p.locator('#songDialog[open]').waitFor();
  test('permission denial shows recovery instructions and leaves the studio unlocked',await p.evaluate(()=>/Microphone to Allow/.test(songDialog.innerText)&&!SongStudio.locked()));
  await tap('#songDialog [data-action=close]');await tap('#sgCheckMic');await wait(()=>requests.length===5);await p.evaluate(()=>sheet(true));await p.evaluate(()=>sheet(false));await p.evaluate(()=>requests[4].grant());
  await wait(()=>/Mic signal detected|Input clipped/.test(sgTestNote.textContent));await tap('#songDialog [data-action=close]');
  test('Check mic detects audio after returning from the permission sheet and releases the stream',await p.evaluate(()=>requests[4].stream.getTracks().every(t=>t.readyState==='ended')));
  if(width===412){
   await tap('#sgRecord');await wait(()=>requests.length===6);await p.evaluate(()=>sheet(true));await p.evaluate(()=>requests[5].grant());
   await wait(()=>!SongStudio.locked()&&requests[5].stream.getTracks().every(t=>t.readyState==='ended'));await p.evaluate(()=>sheet(false));
   test('staying in the background releases the muted mic and explains how to retry',await p.evaluate(()=>/background/.test(songDialog.innerText)&&SongCore.usage(S.song).takes===1));
  }
 }finally{await c.close();}
}
(async()=>{
 const url=process.env.PVS_PHONE_URL||'http://127.0.0.1:'+port+'/';
 if(!process.env.PVS_PHONE_URL){
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',path.resolve(__dirname,'..')],{stdio:'ignore'});
  let ready=false;for(let i=0;i<40&&!ready;i++){try{const r=await fetch(url);await r.arrayBuffer();ready=r.ok;}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 }
 const audio=path.join(tmp,'input.wav');fs.writeFileSync(audio,wave().buffer);
 browser=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--autoplay-policy=user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture='+audio]});
 for(const width of [360,412])await run(width,url);
 // Fresh session with Chromium's microphone untouched by any permission wrapper.
 const ctx=await browser.newContext({viewport:{width:412,height:850},deviceScaleFactor:3,hasTouch:true,isMobile:true,permissions:['microphone']});
 try{
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction(()=>window.PvsCoach&&window.SongStudio&&!sessionLocked()&&!S.loading);
  check('Fresh session starts with Explain off and no takes',await p.evaluate(()=>!coachExplain.checked&&SongCore.usage(S.song).takes===0));
  await p.locator('#sgRecord').tap();
  await p.waitForFunction(()=>SongStudio.state().recording&&SongStudio.state().position<-.25);
  const leadIn=await p.evaluate(()=>({position:SongStudio.state().position,label:sgRecord.textContent}));
  console.log('Default lead-in:',leadIn);
  check('Default lead-in does not promise a take before the capture region',leadIn.position<0&&leadIn.label.includes('lead-in'));
  await p.waitForFunction(()=>sgRecord.textContent.includes('Stop & keep'));
  const ready=await p.evaluate(()=>SongStudio.state().position);console.log('First keep-ready position:',ready);
  check('Stop & keep waits until microphone audio reaches the recording region',ready>=.04);
  await p.locator('#sgRecord').tap();
  await p.waitForFunction(()=>!SongStudio.locked()&&SongCore.usage(S.song).takes===1);
  check('Fresh session records an audible take using the browser microphone path and the same Record button to stop',await p.evaluate(()=>Object.values(S.song.sources).some(s=>s.channels[0].some(v=>Math.abs(v)>.01))));
  await p.locator('#sgHearRecent').tap();await p.waitForFunction(()=>SongStudio.state().playing);
  check('Fresh session replays its take after first-touch recording',true);
 }finally{await ctx.close();}
 await require('./crash.cjs')(browser,url,check);
 check('No JavaScript errors',!errors.length);
})().catch(e=>{rows.push({name:'Completed',pass:false,detail:String(e)});console.error(e);process.exitCode=1;}).finally(async()=>{
 await browser?.close();server?.kill();fs.rmSync(tmp,{force:true,recursive:true});
 if(process.env.PVS_TEST_OUT){fs.mkdirSync(process.env.PVS_TEST_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.PVS_TEST_OUT,'phone.json'),JSON.stringify({rows,errors},null,2));}
 console.log(rows.filter(x=>x.pass).length+'/'+rows.length+' passed',errors);
});
