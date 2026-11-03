/* Kill the renderer, bypassing Stop and page lifecycle callbacks. Only completed
 * draft transactions are expected to survive. The running song stays untouched. */
module.exports=async function verifyCrash(browser,url,check){
 const c=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,permissions:['microphone']});
 try{
  const p=await c.newPage();await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await p.waitForFunction(()=>window.CaptureDrafts&&window.SongStudio&&!S.loading&&!sessionLocked());
  await p.evaluate(async()=>{S.song.lead=0;SongStudio.edit(w=>SongCore.addTake(w,{start:0,end:1,channels:[new Float32Array(w.rate).fill(.1)],origin:0,choose:true}));S.song.cursor=2;await persistNow();});
  await p.locator('#sgRecord').tap();await p.waitForFunction(()=>SongStudio.state().recording&&sgRecord.textContent.includes('Stop & keep'));
  await p.waitForTimeout(2300);
  await p.waitForFunction(async()=>{const active=new Set((await navigator.locks.query()).held.map(x=>x.name));const db=await new Promise((done,fail)=>{const r=indexedDB.open('playbook-vocal-capture-drafts');r.onsuccess=()=>done(r.result);r.onerror=fail;});
   try{return await new Promise(done=>{const q=db.transaction('heads').objectStore('heads').getAll();q.onsuccess=()=>done(q.result.some(h=>active.has(h.id)&&h.frames>h.rate));});}finally{db.close();}
  },null,{timeout:45000});
  const ctl=await c.newCDPSession(p),event=p.waitForEvent('crash',{timeout:15000});ctl.send('Page.crash').catch(()=>{});await event;await p.close();
  const q=await c.newPage();await q.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await q.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked());await q.evaluate(()=>RC.go('rc'));
  await q.waitForFunction(async()=>(await CaptureDrafts.list()).length===1);console.log('Recovered draft lengths:',await q.evaluate(async()=>(await CaptureDrafts.list()).map(x=>x.frames)));await q.locator('#sgDrafts').tap();
  await q.locator('[data-draft]').first().waitFor();
  const down=q.waitForEvent('download',{timeout:20000});await q.locator('[data-draft]').first().tap();const wav=require('fs').readFileSync(await(await down).path());const frames=wav.readUInt32LE(40)/4,rate=wav.readUInt32LE(24);
  let peak=0;for(let n=44;n<wav.length;n+=4)peak=Math.max(peak,Math.abs(wav.readFloatLE(n)));
  console.log('Interrupted WAV:',frames,'frames at',rate,'Hz; peak',peak,'sha256',require('crypto').createHash('sha256').update(wav).digest('hex'));
  check('Renderer crash leaves the saved song and an audible checkpoint WAV',frames>=rate&&peak>.01&&await q.evaluate(()=>SongCore.usage(S.song).takes===1));
  await q.locator('#songDialog [data-action=close]').tap();await q.locator('#sgHelp').tap();await q.locator('#sgOffline').tap();await q.waitForFunction(()=>sgOfflineState.textContent.includes('ready'),null,{timeout:120000});await q.waitForFunction(()=>navigator.serviceWorker.controller);
  await c.setOffline(true);await q.reload({waitUntil:'domcontentloaded'});await q.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked());await q.locator('#sgHelp').tap();check('Explicit offline setup keeps the app, Help and saved take available after reload',await q.evaluate(()=>songDialog.open&&SongCore.usage(S.song).takes===1));await c.setOffline(false);
 }finally{await c.close();}
};
