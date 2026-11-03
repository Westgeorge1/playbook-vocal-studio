/* 0.36.8: the studio asks the browser to keep its songs (navigator.storage.persist) during the first song
 * action, shows the result in Project storage with Ask again, and Smart Guide warns when the browser said no
 * or cannot be asked. The browser's answer is simulated: granted, denied, and unsupported. */
const {suite}=require('../tests-0.32.4/browser.cjs');
suite('storage-keep',57,async({check,url,b,errors})=>{
 async function open(mode){
  const c=await b.newContext({viewport:{width:1280,height:800},permissions:['microphone']});
  await c.route('https://**/*',r=>r.abort());
  await c.addInitScript(mode=>{
   window.__persistCalls=0;
   if(mode==='unsupported'){try{Object.defineProperty(navigator,'storage',{value:undefined,configurable:true});}catch(_){}}
   else{let on=false;const s=navigator.storage;
    s.persisted=async()=>on;
    s.persist=async()=>{window.__persistCalls++;if(mode==='grant')on=true;return on;};}
  },mode);
  const p=await c.newPage();p.on('pageerror',e=>errors.push(mode+': '+e.message));p.on('dialog',d=>d.accept());
  await p.goto(url);await p.waitForFunction(()=>window.StorageKeep&&window.SongStudio&&!S.loading,null,{timeout:60000});
  return {c,p};
 }
 const addTake=p=>p.evaluate(async()=>{SongStudio.edit(w=>SongCore.addTake(w,{trackId:w.tracks[0].id,start:0,end:1,channels:[new Float32Array(w.rate).fill(.05)],origin:0,choose:true}),'keep test');});
 const panel=async p=>{await p.evaluate(()=>{const d=document.getElementById('projectStoragePanel');if(!d.open)d.showModal();});await p.waitForTimeout(300);
  return p.evaluate(()=>({state:document.getElementById('storageKeepState')?.textContent,data:document.getElementById('storageKeepState')?.dataset.state,ask:!document.getElementById('storageKeepAsk')?.hidden,note:document.getElementById('storageKeepNote')?.textContent}));};
 const close=p=>p.evaluate(()=>document.getElementById('projectStoragePanel').close());

 /* Granted */
 {const {c,p}=await open('grant');
  check('Before any song action the studio has not asked yet',await p.evaluate(()=>StorageKeep.status()==='not-asked'&&__persistCalls===0));
  const pn=await panel(p);check('Project storage shows "Not yet asked" with a Keep my songs button',pn.state==='Not yet asked'&&pn.ask,pn);await close(p);
  await addTake(p);await p.locator('#sgSave').click().catch(()=>{});await p.waitForTimeout(400);
  check('The first song action asks the browser once',await p.evaluate(()=>__persistCalls===1&&StorageKeep.status()==='granted'));
  await p.locator('#sgSave').click().catch(()=>{});await p.waitForTimeout(300);
  check('It does not ask again once granted',await p.evaluate(()=>__persistCalls===1));
  const pg=await panel(p);check('Project storage shows On and still recommends backups',pg.state==='On'&&!pg.ask&&/backups/.test(pg.note),pg);await close(p);
  await p.evaluate(()=>PvsCoach.evaluate());check('No Smart Guide storage tip when the browser agreed',!(await p.evaluate(()=>PvsCoach.items().some(x=>x.id==='song-keep'))));
  await c.close();}
 /* Every visible POLISH entry requests persistence for an existing song. */
 for(const selector of ['#sgPolish','[data-polish]','#rcStep2']){
  const {c,p}=await open('grant');
  try{
   await addTake(p);
   await p.locator(selector).first().click();
   const observed=await p.evaluate(()=>({calls:__persistCalls,status:StorageKeep.status(),switching:SongPolish.state().switching,step:RC.step}));
   check('First POLISH action asks the browser: '+selector,observed.calls===1&&observed.status==='granted'&&(observed.switching||observed.step==='polish'),observed);
  }finally{await c.close();}
 }
 /* Denied */
 {const {c,p}=await open('deny');await addTake(p);
  await p.locator('#sgSave').click().catch(()=>{});await p.waitForTimeout(400);
  check('A refusal is recorded',await p.evaluate(()=>StorageKeep.status()==='not-granted'&&__persistCalls===1));
  const pn=await panel(p);check('Project storage explains the risk and offers Ask again',pn.state==='Not granted'&&pn.ask&&/Install the app/.test(pn.note),pn);
  await p.locator('#storageKeepAsk').click();await p.waitForTimeout(300);
  check('Ask again asks the browser again',await p.evaluate(()=>__persistCalls===2));await close(p);
  await p.evaluate(()=>PvsCoach.evaluate());const it=await p.evaluate(()=>PvsCoach.items().find(x=>x.id==='song-keep'));
  check('Smart Guide advises when the browser may clear songs, with Ask again and Back up project',!!it&&it.actions.includes('Ask again')&&it.actions.includes('Back up project'),it);
  await c.close();}
 /* Unsupported */
 {const {c,p}=await open('unsupported');await addTake(p);
  await p.locator('#sgSave').click().catch(()=>{});await p.waitForTimeout(300);
  const pn=await panel(p);check('A browser without the setting is reported honestly, with no Ask button',pn.data==='unsupported'&&!pn.ask&&/Back up/.test(pn.note),pn);await close(p);
  await p.evaluate(()=>PvsCoach.evaluate());const it=await p.evaluate(()=>PvsCoach.items().find(x=>x.id==='song-keep'));
  check('Smart Guide recommends backups when the browser cannot be asked',!!it&&!it.actions.includes('Ask again')&&it.actions.includes('Back up project'),it);
  await c.close();}
});
