const {suite}=require('./browser.cjs');
suite('storage',11,async({check,page})=>{
 const p=await page();
 const keys=()=>p.evaluate(async()=>{const d=await idb();try{return await new Promise(r=>{const q=d.transaction('s').objectStore('s').getAllKeys();q.onsuccess=()=>r(q.result);});}finally{d.close();}});
 // Record & takes uses immutable Float32 channel buffers. Exercise the same Keep button as a user.
 await p.evaluate(()=>{
   const R=48000,a=Float32Array.from({length:R*2},(_,i)=>.23*Math.sin(i*2*Math.PI*250/R));
   S.phrases=PhraseCore.empty(R);
   const t={id:'t2',name:'Phrase original',rate:R,channels:[a,a.slice()],origin:0,offsetMs:0,rating:0,gainDb:0};
   S.phrases.phrases=[{id:'p1',name:'Verse',start:0,end:2,takes:[t],selected:t.id}];S.phrases.selected='p1';S.phrases.nextId=3;
   Studio.edit(t.id);
 });
 for(const [id,v] of [['veA','0.4'],['veB','0.7']]){await p.locator('#'+id).fill(v);await p.locator('#'+id).dispatchEvent('change');}
 await p.locator('#sepKeep').click();await p.waitForFunction(()=>S.phrases.phrases[0].takes.length===2);
 await p.evaluate(()=>persistNow());
 const before=await p.evaluate(()=>S.phrases.phrases[0].takes.map(t=>SongCore.hashPcm(t.channels)));
 const packed=await p.evaluate(async()=>{
   const d=await idb();try{return await new Promise(r=>{const st=d.transaction('s').objectStore('s'),q=st.openCursor(),rows=[];q.onsuccess=()=>{const c=q.result;if(!c)return r(rows);if(c.key.startsWith(ProjectStorage.key('src:')))rows.push(c.value.derived?[c.value.derived.frames,c.value.patch.channels[0].length]:[c.value.channels[0].length,0]);c.continue();};});}finally{d.close();}
 });
 check('Phrase cleanup stores one stereo original and a patch limited to the edit',packed.length===2&&packed.some(([n,k])=>n===96000&&k>0&&k<=14401)&&packed.some(([,k])=>k===0));
 await p.reload();await p.waitForFunction(()=>!S.loading&&S.phrases?.phrases[0]?.takes.length===2);
 check('Phrase cleanup reopens sample-for-sample',JSON.stringify(before)===JSON.stringify(await p.evaluate(()=>S.phrases.phrases[0].takes.map(t=>SongCore.hashPcm(t.channels)))));
 await p.evaluate(async()=>{
   const d=await idb();try{await new Promise(r=>{const tx=d.transaction('s','readwrite'),st=tx.objectStore('s');st.put({original:true},'last');st.put({channels:[new Float32Array(512)]},'pcm:legacy-test');st.put({other:true},'pvs@/a-different-location/|last');tx.oncomplete=r;});}finally{d.close();}
 });
 async function openStorage(){await p.getByRole('button',{name:'Project storage',exact:true}).and(p.locator('button:visible')).first().click();await p.waitForFunction(()=>document.getElementById('storageNote').textContent.includes('Close other tabs'));}
 await openStorage();check('Storage shows this location, other location and the legacy shared save',(await p.locator('#storageRows li').count())>=3);
 check('Removal requires confirmation of a backup',await p.locator('#storageRemoveHere').isDisabled()&&await p.locator('#storageRemoveLegacy').isDisabled());
 await p.locator('#storageVerified').check();p.once('dialog',d=>d.dismiss());await p.locator('#storageRemoveLegacy').click();
 check('Cancelling the removal preserves the old save',(await keys()).includes('last'));
 p.once('dialog',d=>d.accept());await p.locator('#storageRemoveLegacy').click();await p.waitForTimeout(250);
 const afterLegacy=await keys();check('Confirmed old-copy removal only removes unscoped project data',!afterLegacy.includes('last')&&!afterLegacy.includes('pcm:legacy-test')&&afterLegacy.includes('pvs@/|last')&&afterLegacy.includes('pvs@/a-different-location/|last'));
 const sibling=await p.context().newPage();await sibling.goto(p.url());await sibling.waitForFunction(()=>!S.loading&&S.phrases?.phrases[0]?.takes.length===2);
 await p.locator('#storageVerified').check();p.once('dialog',d=>d.accept());await Promise.all([p.waitForEvent('load'),p.locator('#storageRemoveHere').click()]);await p.waitForFunction(()=>window.SongStudio&&!S.loading);
 const removed=await keys();check('Removing this location leaves the other location intact',!removed.includes('pvs@/|last')&&removed.includes('pvs@/a-different-location/|last'));
 const stale=await sibling.evaluate(async()=>{try{await persistNow();return S.restorePaused;}catch(e){return /removed/.test(e.message);}});
 check('A previously open tab cannot resurrect a removed project',stale&&!(await keys()).includes('pvs@/|last'));
 const missed=await sibling.evaluate(async()=>{S.restorePaused=false;try{await persistNow();return false;}catch(e){return /removed/.test(e.message);}});
 check('The database transaction also rejects a stale tab that missed the notification',missed && !(await keys()).includes('pvs@/|last'));
 await p.context().close();
});
