/* Kill the renderer, bypassing Stop and page lifecycle callbacks. Only completed
 * draft transactions are expected to survive. The running song stays untouched. */
module.exports=async function verifyCrash(browser,url,check){
 const c=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,permissions:['microphone']});
 const evidence=[];let p,q;
 async function capture(page,label){
  let timer;
  try{
   const state=await Promise.race([page.evaluate(async()=>{
    const read=fn=>{try{return fn();}catch(e){return {error:e.message};}};
    const databases=await indexedDB.databases();let drafts=null;
    if(databases.some(d=>d.name==='playbook-vocal-capture-drafts')){
     const db=await new Promise((done,fail)=>{const r=indexedDB.open('playbook-vocal-capture-drafts');r.onsuccess=()=>done(r.result);r.onerror=()=>fail(r.error);});
     try{const tx=db.transaction(['heads','pcm']);const get=req=>new Promise((done,fail)=>{req.onsuccess=()=>done(req.result);req.onerror=()=>fail(req.error);});drafts={heads:await get(tx.objectStore('heads').getAll(null,128)),pcmKeys:await new Promise((done,fail)=>{const r=db.transaction('pcm').objectStore('pcm').getAllKeys(null,4096);r.onsuccess=()=>done(r.result);r.onerror=()=>fail(r.error);})};}finally{db.close();}
    }
    return {at:performance.now(),version:APP_VERSION,visibility:document.visibilityState,locks:await navigator.locks.query(),databases,drafts,
     available:await CaptureDrafts.state(),storage:window.StorageKeep?.status(),studio:SongStudio.state(),locked:sessionLocked(),
     flags:read(()=>Object.fromEntries(['loading','loadError','busy','dirty','songWorking','restorePaused','restoreNote'].map(k=>[k,S[k]??null]))),
     sources:read(()=>Object.values(S.song.sources).map(s=>({rate:s.rate,frames:s.channels[0].length,hash:SongCore.hashPcm(s.channels)}))),
     draftButton:read(()=>({hidden:sgDrafts.hidden,disabled:sgDrafts.disabled,text:sgDrafts.textContent})),status:sgStatus.textContent};
   }),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Draft state capture exceeded 2500 ms')),2500);})]);
   evidence.push({label,state});
  }catch(e){evidence.push({label,error:String(e)});}finally{clearTimeout(timer);}
  if(process.env.PVS_TEST_OUT)require('fs').writeFileSync(require('path').join(process.env.PVS_TEST_OUT,'crash-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 }
 try{
  p=await c.newPage();await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await p.waitForFunction(()=>window.CaptureDrafts&&window.SongStudio&&!S.loading&&!sessionLocked());
  await p.evaluate(async()=>{S.song.lead=0;SongStudio.edit(w=>SongCore.addTake(w,{start:0,end:1,channels:[new Float32Array(w.rate).fill(.1)],origin:0,choose:true}));S.song.cursor=2;await persistNow();});
  await p.locator('#sgRecord').tap();await p.waitForFunction(()=>SongStudio.state().recording&&sgRecord.textContent.includes('Stop & keep'));
  await p.waitForTimeout(2300);
  await p.waitForFunction(async()=>{const active=new Set((await navigator.locks.query()).held.map(x=>x.name));const db=await new Promise((done,fail)=>{const r=indexedDB.open('playbook-vocal-capture-drafts');r.onsuccess=()=>done(r.result);r.onerror=fail;});
   try{return await new Promise(done=>{const q=db.transaction('heads').objectStore('heads').getAll();q.onsuccess=()=>done(q.result.some(h=>active.has(h.id)&&h.frames>h.rate));});}finally{db.close();}
  },null,{timeout:45000});
  await capture(p,'before renderer crash');
  const ctl=await c.newCDPSession(p),event=p.waitForEvent('crash',{timeout:15000});ctl.send('Page.crash').catch(()=>{});await event;await p.close();
  q=await c.newPage();await q.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await q.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked());await q.evaluate(()=>RC.go('rc'));
  await capture(q,'reopened before draft wait');
  await q.waitForFunction(async()=>(await CaptureDrafts.list()).length===1);console.log('Recovered draft lengths:',await q.evaluate(async()=>(await CaptureDrafts.list()).map(x=>x.frames)));await capture(q,'draft observed before recovery button');await q.locator('#sgDrafts').tap();
  await q.locator('[data-draft]').first().waitFor();
  const down=q.waitForEvent('download',{timeout:20000});await q.locator('[data-draft]').first().tap();const wav=require('fs').readFileSync(await(await down).path());const frames=wav.readUInt32LE(40)/4,rate=wav.readUInt32LE(24);
  let peak=0;for(let n=44;n<wav.length;n+=4)peak=Math.max(peak,Math.abs(wav.readFloatLE(n)));
  console.log('Interrupted WAV:',frames,'frames at',rate,'Hz; peak',peak,'sha256',require('crypto').createHash('sha256').update(wav).digest('hex'));
  check('Renderer crash leaves the saved song and an audible checkpoint WAV',frames>=rate&&peak>.01&&await q.evaluate(()=>SongCore.usage(S.song).takes===1));
  await q.locator('#songDialog [data-action=close]').tap();await q.locator('#sgHelp').tap();await q.locator('#sgOffline').tap();await q.waitForFunction(()=>sgOfflineState.textContent.includes('ready'),null,{timeout:120000});await q.waitForFunction(()=>navigator.serviceWorker.controller);
  await c.setOffline(true);await q.reload({waitUntil:'domcontentloaded'});await q.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked());await q.locator('#sgHelp').tap();check('Explicit offline setup keeps the app, Help and saved take available after reload',await q.evaluate(()=>songDialog.open&&SongCore.usage(S.song).takes===1));await c.setOffline(false);
 }catch(e){await capture(q||p,'original failure: '+String(e));throw e;}finally{await c.close();}
};
