/* Preserve a native click when a queued scroll update would reshape the toolbar. */
const fs=require('node:fs'),path=require('node:path');
const {suite}=require('../tests-0.32.4/browser.cjs');
suite('transport-layout',38,async({page,check})=>{
 for(const [width,height] of [[1280,600],[390,844],[412,915]]){
  const p=await page(width,height);await p.waitForFunction(()=>!sessionLocked());
  await p.evaluate(()=>{
   const w=S.song=SongCore.empty(44100),x=Float32Array.from({length:44100*30},(_,i)=>.15*Math.sin(i*.03));
   SongCore.addTake(w,{channels:[x],rate:44100,start:0,end:30,choose:true});SongStudio.render();
   window.micCount=0;window.layoutTrace=[];
   navigator.mediaDevices.getUserMedia=()=>{micCount++;return new Promise(()=>{});};
   for(const type of ['pointerdown','pointerup','click','scroll'])document.addEventListener(type,e=>{
    const r=sgRecord.getBoundingClientRect();layoutTrace.push({at:performance.now(),type,target:e.target.id||e.target.tagName,record:[r.x,r.y,r.width,r.height],scroll:songStudio.scrollTop});
   },true);
  });
  const arrangeDeferredScroll=()=>p.evaluate(async()=>{
   const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   songStudio.scrollTop=220;await frame();
   // Hold one browser scroll event until the native press is in progress.
   // This reproduces the event ordering retained in the 0.36.4 failure trace.
   songStudio.addEventListener('scroll',e=>e.stopImmediatePropagation(),{capture:true,once:true});
   songStudio.scrollTop=0;await frame();
   if(!songStudio.classList.contains('sg-scrolled'))throw Error('Deferred-scroll fixture not ready');
  });
  await p.locator('[data-song-play="Lead vocal"]').click();await p.waitForFunction(()=>SongStudio.state().playing);
  await arrangeDeferredScroll();const before=await p.locator('#sgRecord').boundingBox();
  const x=before.x+before.width/2,y=before.y+before.height/2;
  await p.mouse.move(x,y);await p.mouse.down();await p.evaluate(()=>songStudio.dispatchEvent(new Event('scroll')));
  await p.waitForTimeout(100);const during=await p.locator('#sgRecord').boundingBox();await p.mouse.up();
  await p.waitForFunction(()=>!songStudio.classList.contains('sg-scrolled'));
  check(`${width}px queued scroll keeps Record under a held pointer`,x>=during.x&&x<=during.x+during.width&&y>=during.y&&y<=during.y+during.height);
  check(`${width}px native release starts exactly one microphone request`,await p.evaluate(()=>micCount===1&&SongStudio.state().opening));
  await p.locator('#sgStop').click();await p.waitForFunction(()=>!SongStudio.locked());
  await arrangeDeferredScroll();const drag=await p.locator('#sgRecord').boundingBox();
  await p.mouse.move(drag.x+drag.width/2,drag.y+drag.height/2);await p.mouse.down();await p.evaluate(()=>songStudio.dispatchEvent(new Event('scroll')));
  await p.mouse.move(2,height-2);await p.mouse.up();await p.waitForFunction(()=>!songStudio.classList.contains('sg-scrolled'));
  check(`${width}px dragging away neither records nor leaves compact layout frozen`,await p.evaluate(()=>micCount===1&&!SongStudio.locked()));
  await p.locator('#sgRecord').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>micCount===2);
  check(`${width}px keyboard Enter still activates Record`,await p.evaluate(()=>SongStudio.state().opening));
  await p.locator('#sgStop').click();await p.waitForFunction(()=>!SongStudio.locked());
  if(process.env.PVS_TEST_OUT)fs.writeFileSync(path.join(process.env.PVS_TEST_OUT,`transport-layout-${width}.json`),JSON.stringify(await p.evaluate(()=>layoutTrace),null,2));
  await p.context().close();
 }
});
