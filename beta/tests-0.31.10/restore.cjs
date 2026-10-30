/* Restore/record regression with real DSP and fault-injected worker replies.
 * Run with the same PLAYWRIGHT_MODULE / PVS_CHROME options as recording.cjs.
 * Test-only document routing shortens the 120-second watchdog to 5000 ms.
 */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=process.env.PVS_TEST_OUT;
let browser,server;const rows=[],errors=[];
const check=(name,pass)=>{rows.push({name,pass:!!pass});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);};
const idle=p=>p.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked(),null,{timeout:180000});
async function setup(width){
 const ctx=await browser.newContext({viewport:{width,height:width===390?844:1760},hasTouch:true,isMobile:true});
 await ctx.addInitScript(()=>{
  const Native=window.Worker;window.nativeJobs=[];window.nativeStopped=0;let count=0;
  window.Worker=class extends Native{
   constructor(url,...rest){super(url,...rest);this.main=/^worker\.js/.test(String(url))&&count++===0;}
   postMessage(m,t){if(this.main){window.nativeJobs.push({type:m.type,update:!!m.update});if(localStorage.testStall==='1'&&m.type==='run'&&m.update){window.heldWorker=this;window.heldMessage=m;return;}}return super.postMessage(m,t);}
   terminate(){if(this.main)window.nativeStopped++;return super.terminate();}
  };
  window.micRequests=0;navigator.mediaDevices.getUserMedia=async()=>{
   window.micRequests++;const ac=new AudioContext(),osc=ac.createOscillator(),gain=ac.createGain(),dest=ac.createMediaStreamDestination();
   gain.gain.value=.12;osc.connect(gain).connect(dest);osc.start();await ac.resume();window.testMic=dest.stream;return dest.stream;
  };
 });
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));
 await p.route('https://**/*',r=>r.abort());
 await p.route('**/beta/?shortWatchdog=1',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'beta/index.html'),'utf8').replace('var ENGINE_WAIT_MS = 120000;','var ENGINE_WAIT_MS = 5000;')}));
 await p.goto('http://127.0.0.1:8760/beta/');await idle(p);
 return {ctx,p};
}
async function seed(p){
 await p.evaluate(async()=>{
  const w=SongCore.empty(48000),x=Float32Array.from({length:96000},(_,i)=>.14*Math.sin(2*Math.PI*261.63*i/48000));w.lead=0;
  SongCore.addTake(w,{channels:[x],rate:w.rate,start:0,end:2,choose:true});S.song=w;SongStudio.render();
  if(!await SongPolish.open(w.activeTrack))throw Error('Fixture POLISH failed');
  // Keep actual completed rendering, with a non-default cleaner setting.
  NoiseCleaner.mutate({reduction:8});
 });await idle(p);
 await p.evaluate(async()=>{
  await NoteTuner.apply();await exec([['edit',0,-1,.2,.3,3]],true);
  if(S.st.notes.length){const notes=S.st.notes.map(n=>n.slice(0,13));notes[0][3]+=1;notes[0][5]=1;await exec([['notes',notes]],true);}
  SongPolish.capture();await persistNow();
  const b=audioCtx().createBuffer(1,48000,48000);b.copyToChannel(Float32Array.from({length:48000},(_,i)=>.01*Math.sin(i/20)),0);S.beat=b;S.beatName='backing.wav';S.beatLevel=.37;$('beatOn').checked=false;S.song.recBacking=false;
  await persistNow();
  window.saved=await restore();
  const fingerprint=last=>JSON.stringify({song:{...last.song,sources:Object.fromEntries(Object.entries(last.song.sources).map(([id,s])=>[id,SongCore.hashPcm(s.channels)])),tracks:last.song.tracks.map(t=>({...t,polish:t.polish?{...t.polish,channels:SongCore.hashPcm(t.polish.channels),session:{...t.polish.session,pcm:SongCore.hashPcm(t.polish.session.pcm),takes:t.polish.session.takes.map(SongCore.hashPcm)}}:null}))},backing:{...last.backing,channels:SongCore.hashPcm(last.backing.channels)},recordBacking:last.recordBacking});
  window.fingerprint=fingerprint;localStorage.expected=fingerprint(saved);
 });
}
async function record(p){await p.evaluate(()=>{S.song.lead=0;RC.go('rc');SongStudio.render();});await p.locator('#sgRecord').tap();await p.waitForFunction(()=>SongStudio.state().recording);await p.waitForTimeout(650);await p.locator('#sgStop').tap();await p.waitForFunction(()=>!SongStudio.locked());}
(async()=>{
 server=spawn('python3',['-m','http.server','8760','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});await new Promise(r=>setTimeout(r,600));
 browser=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [390,980]){
  const {ctx,p}=await setup(width),tag=width+'px';await seed(p);
  const fp=await p.evaluate(()=>fingerprint.toString());
  check(tag+' real saved lane can reopen without render',await p.evaluate(()=>songCanOpenWithoutRender(saved)));
  check(tag+' stale lane still keeps duplicate editor safely',await p.evaluate(()=>{const q=structuredClone(saved);q.song.tracks[0].polish.sourceSig='stale:'+q.song.tracks[0].polish.sourceSig;return songCanOpenWithoutRender(q);}));
  for(const field of ['P','notes','edits','noteTuner','pcm','takes','guide']){
   const safe=await p.evaluate(field=>{const q=structuredClone(saved);if(field==='P')q.P.amount+=1;else if(field==='notes')q.notes.push([0,.1,60,61,1,1,-1,-1,-1,0,0,120,0]);else if(field==='edits')q.edits.breaths.push([0,.1,-6]);else if(field==='noteTuner')q.noteTuner.mode='original';else if(field==='pcm'){q.pcm=q.pcm.map(c=>c.slice());q.pcm[0][0]+=.1;}else if(field==='takes')q.takes.push(q.pcm);else q.guide.bpm+=1;return !songCanOpenWithoutRender(q);},field);
   check(tag+' unique root '+field+' never skipped',safe);
  }
  await p.evaluate(()=>{localStorage.testStall='1';});await p.reload();await idle(p);
  check(tag+' saved song opens despite stalled DSP',await p.evaluate(()=>!S.main&&!S.busy&&!S.restorePaused&&Object.keys(S.song.sources).length===1));
  check(tag+' no vocal reprocessing on startup',await p.evaluate(()=>!nativeJobs.some(j=>j.type==='open'||j.update)));
  await p.evaluate(fp=>{window.fingerprint=eval('('+fp+')');},fp);
  check(tag+' saved audio, settings, edits, backing preserved',await p.evaluate(()=>fingerprint(sessionSnapshot())===localStorage.expected));
  await p.evaluate(async()=>persistNow());await p.reload();await idle(p);await p.evaluate(fp=>{window.fingerprint=eval('('+fp+')');},fp);
  check(tag+' autosave/reload retains all saved lane data',await p.evaluate(()=>fingerprint(sessionSnapshot())===localStorage.expected));
  await p.evaluate(async()=>{window.packed={};window.files=[];await SongStudio.pack(packed,files);window.unpacked=await SongStudio.unpack(packed,new Map(files.map(f=>[f.name.toLowerCase(),f])));});
  check(tag+' project backup preserves originals/settings and standard WAV output',await p.evaluate(()=>{
   const a=S.song.tracks[0].polish,b=unpacked.tracks[0].polish;
   return JSON.stringify({...a.session,pcm:null,takes:null})===JSON.stringify({...b.session,pcm:null,takes:null})&&SongCore.samePcm(readWav(wav16(a.channels,a.rate)).channels,b.channels)&&SongCore.samePcm(a.session.pcm,b.session.pcm)&&SongCore.samePcm(Object.values(S.song.sources)[0].channels,Object.values(unpacked.sources)[0].channels);
  }));
  await p.locator('#sgPlay').tap();await p.waitForFunction(()=>SongStudio.state().playing);check(tag+' saved song plays without reprocessing',await p.evaluate(()=>SongStudio.state().playing));await p.locator('#sgStop').tap();
  await record(p);check(tag+' Record starts and saves new take after reopen',await p.evaluate(()=>micRequests===1&&SongCore.usage(S.song).takes===2&&testMic.getTracks().every(t=>t.readyState==='ended')));
  await p.evaluate(async()=>persistNow());await p.reload();await idle(p);check(tag+' new and previous recordings survive reload',await p.evaluate(()=>SongCore.usage(S.song).takes===2));
  await p.evaluate(()=>{localStorage.removeItem('testStall');window.polishOpening=SongPolish.open(S.song.activeTrack);});
  await p.locator('#songDialog[open] [data-action="ok"]').tap();
  check(tag+' POLISH opens on demand with real processor',await p.evaluate(()=>polishOpening));await idle(p);
  check(tag+' POLISH renders after deferred startup',await p.evaluate(()=>!!S.final?.length&&!NoteTuner.failed()));
  await ctx.close();
 }
 // A unique root session must use the full restore; inject exactly the user's
 // state: open succeeded, but a following native update never sends done.
 for(const mode of ['original','note']){
 const {ctx,p}=await setup(390);await seed(p);
 await p.evaluate(async mode=>{saved.P.amount+=1;saved.noteTuner.mode=mode;sessionSnapshot=()=>saved;await writeRemembered(saved);localStorage.testStall='1';localStorage.removeItem('pvs.songJournal');},mode);
 await p.goto('http://127.0.0.1:8760/beta/?shortWatchdog=1');
 await p.waitForFunction(()=>Object.values(pending).some(p=>p.update),null,{timeout:15000}).catch(async e=>{console.log('RESTORE DEBUG',await p.evaluate(()=>({jobs:nativeJobs,loading:S.loading,paused:S.restorePaused,reason:S.restoreNote,error:engineFailure?.message,busy:S.busy,main:!!S.main,can:typeof saved==='undefined'?null:songCanOpenWithoutRender(saved)})));throw e;});
 check(mode+' stalled restore blocks Record until worker is stopped',await p.evaluate(()=>sessionLocked()&&S.loading.startsWith('Opening')));
 if(mode==='original')check('reproduces vocalLoaded + outstanding update diagnostics',await p.evaluate(()=>!!S.main&&Object.keys(pending).length===1&&S.busy&&!NoiseCleaner.locked()));
 await p.waitForFunction(()=>S.restorePaused&&!sessionLocked(),null,{timeout:15000});
 check('timeout terminates worker and drains requests',await p.evaluate(()=>nativeStopped===1&&Object.keys(pending).length===0&&!!engineFailure));
 check('timeout clears only incomplete live editor',await p.evaluate(()=>!S.main&&!S.st&&!NoteTuner.failed()&&!NoteTuner.pending()&&!S.dirty));
 check('timeout warns that saved project is protected',await p.evaluate(()=>S.restorePaused&&S.restoreNote.includes('left untouched')&&S.restoreNote.includes('autosave')));
 const old=await p.evaluate(async()=>JSON.stringify(await restore()));
 await p.evaluate(async()=>persistNow());check('failed restore never overwrites saved project',old===await p.evaluate(async()=>JSON.stringify(await restore())));
 check('late worker result is ignored',await p.evaluate(()=>{const a=S.name;heldWorker.onmessage({data:{type:'done',id:heldMessage.id,state:{invalid:true}}});return S.name===a&&!S.main;}));
 await record(p);check('new recording works after timeout',await p.evaluate(()=>micRequests===1&&SongCore.usage(S.song).takes===1));
 await p.evaluate(async()=>persistNow());check('new recording cannot replace protected old project',old===await p.evaluate(async()=>JSON.stringify(await restore())));
 if(out){fs.mkdirSync(out,{recursive:true});await p.screenshot({path:path.join(out,'restore-timeout.png')});}
 await ctx.close();}
 check('No page errors',errors.length===0);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill();if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'restore-results.json'),JSON.stringify({rows,errors},null,2));}console.log(rows.filter(r=>r.pass).length+' checks passed');});
