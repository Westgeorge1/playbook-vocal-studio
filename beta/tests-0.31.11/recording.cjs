/* Regression checks with synthetic microphone input; no physical-device claim.
 * npm install playwright, then node beta/tests-0.31.11/recording.cjs
 * Optional: PLAYWRIGHT_MODULE, PVS_CHROME, PVS_TEST_OUT.
 */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=process.env.PVS_TEST_OUT;
const rows=[],errors=[];let browser,server;
const check=(name,pass)=>{rows.push({name,pass:!!pass});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);};
async function page(width,denied=false){
 const ctx=await browser.newContext({viewport:{width,height:width===390?844:1760},hasTouch:true,isMobile:true});
 await ctx.addInitScript(denied=>{
  window.micRequests=0;
  navigator.mediaDevices.getUserMedia=async()=>{
   window.micRequests++;
   if(denied)throw new DOMException('Permission denied','NotAllowedError');
   const ac=new AudioContext(),osc=ac.createOscillator(),gain=ac.createGain(),dest=ac.createMediaStreamDestination();
   gain.gain.value=.15;osc.frequency.value=261.63;osc.connect(gain).connect(dest);osc.start();await ac.resume();
   window.testMicContext=ac;window.testMicStream=dest.stream;return dest.stream;
  };
 },denied);
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.route('https://**/*',r=>r.abort());
 await p.goto('http://127.0.0.1:8759/beta/');await p.waitForFunction(()=>window.SongStudio&&!S.loading);await p.waitForTimeout(500);
 return {ctx,p};
}
async function errorVisible(p){return p.evaluate(()=>{const d=document.getElementById('songDialog'),r=d.getBoundingClientRect();return d.open&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;});}
(async()=>{
 server=spawn('python3',['-m','http.server','8759','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});await new Promise(r=>setTimeout(r,600));
 browser=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [390,980]){
  const {ctx,p}=await page(width),tag=width+'px';
  check(tag+' version',await p.evaluate(()=>APP_VERSION==='0.31.11'));
  const before=await p.evaluate(()=>JSON.stringify(SongStudio.snapshot()));
  await p.evaluate(()=>{NoteTuner.begin({v:1,mode:'note',editor:null});NoiseCleaner.mutate({mode:'studio'});});await p.waitForTimeout(650);
  check(tag+' empty tuner settings do not block recording',await p.evaluate(()=>!S.dirty&&!NoteTuner.pending()&&!sessionLocked()));
  check(tag+' empty settings preserve song',before===await p.evaluate(()=>JSON.stringify(SongStudio.snapshot())));
  await p.evaluate(()=>{S.busy=true;SongStudio.render();document.getElementById('songStudio').scrollTop=120;});
  await p.locator('#sgRecord').tap();
  check(tag+' blocked Record remains accessible',await p.locator('#sgRecord').getAttribute('aria-disabled')!=='true');
  check(tag+' blocked reason visible above toolbar',await errorVisible(p));
  check(tag+' dialog explains actual blocker',(await p.locator('#songDialog').innerText()).includes('Still processing'));
  const details=JSON.parse(await p.locator('#songDialog textarea').inputValue());check(tag+' diagnostic identifies busy engine',details.engineBusy===true&&details.version==='0.31.11');
  check(tag+' blocked Record never requests microphone',await p.evaluate(()=>micRequests===0));
  check(tag+' blocked Record keeps genuine lock',await p.evaluate(()=>S.busy&&sessionLocked()));
  if(out){fs.mkdirSync(out,{recursive:true});await p.screenshot({path:path.join(out,'record-blocked-'+width+'.png')});}
  await p.locator('#songDialog [data-action="close"]').tap();
  await p.evaluate(()=>{S.busy=false;S.dirty=true;NoiseCleaner.mutate({mode:'original'});});
  check(tag+' no-audio changes preserve another pending edit',await p.evaluate(()=>S.dirty));
  await p.evaluate(()=>{S.dirty=false;S.song.lead=0;SongStudio.render();});
  await p.locator('#sgRecord').tap();await p.waitForFunction(()=>SongStudio.state().recording,null,{timeout:15000});await p.waitForTimeout(1200);
  check(tag+' Record captures input after settings change',await p.evaluate(()=>micRequests===1&&SongStudio.state().recording));
  await p.locator('#sgStop').tap();await p.waitForFunction(()=>!SongStudio.locked());
  check(tag+' Stop saves an audible take',await p.evaluate(()=>SongCore.usage(S.song).takes===1&&Object.values(S.song.sources).some(s=>s.channels[0].some(x=>Math.abs(x)>.01))));
  check(tag+' microphone stream closes',await p.evaluate(()=>testMicStream.getTracks().every(t=>t.readyState==='ended')));
  await p.evaluate(async()=>{await persistNow();});await p.reload();await p.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked());
  check(tag+' reload preserves recorded take',await p.evaluate(()=>SongCore.usage(S.song).takes===1));
  if(width===390){
   await p.evaluate(()=>SongPolish.open(S.song.activeTrack));await p.waitForFunction(()=>!sessionLocked(),null,{timeout:180000});
   const fr=p.frames().find(f=>f.url().includes('note-editor.html'));
   check('Loaded-vocal tuner opens',!!fr);
   await p.evaluate(()=>NoiseCleaner.mutate({reduction:8}));
   check('Loaded vocal still waits for processing',await p.evaluate(()=>S.dirty&&NoteTuner.pending()));
   await p.waitForFunction(()=>!sessionLocked(),null,{timeout:180000});
   check('Loaded-vocal processing finishes',await p.evaluate(()=>!!S.final?.length&&!NoteTuner.failed()));
  }
  await ctx.close();
  const fail=await page(width,true);await fail.p.evaluate(()=>document.getElementById('songStudio').scrollTop=120);await fail.p.locator('#sgRecord').tap();await fail.p.waitForSelector('#songDialog[open]');
  check(tag+' denied microphone shows visible dialog',await errorVisible(fail.p));
  check(tag+' permission help is actionable',(await fail.p.locator('#songDialog').innerText()).includes('Microphone to Allow'));
  check(tag+' denied microphone releases setup lock',await fail.p.evaluate(()=>!sessionLocked()&&!SongStudio.state().opening));
  await fail.ctx.close();
 }
 check('No page errors',errors.length===0);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill();if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'recording-results.json'),JSON.stringify({rows,errors},null,2));}console.log(rows.filter(r=>r.pass).length+' checks passed');});
