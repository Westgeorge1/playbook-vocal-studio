/* Native Chromium touch lifecycle plus explicitly synthetic event-order/blur controls. */
const fs=require('node:fs'),path=require('node:path');
const {suite}=require('../tests-0.32.4/browser.cjs');
suite('transport-touch',40,async({page,check})=>{
 const cases=[['synthetic-order',1280,600],['synthetic-no-click',1280,600],['touch-release-390-a',390,844],['touch-release-390-b',390,844],['touch-release-412-a',412,915],['touch-release-412-b',412,915],['touch-cancel',390,844],['synthetic-blur',1280,600]];
 for(const [name,width,height] of cases){
  const p=await page(width,height);const evidence={name,width,height};
  try{
   await p.waitForFunction(()=>!sessionLocked());
   await p.evaluate(()=>{
    const w=S.song=SongCore.empty(44100),pcm=Float32Array.from({length:88200},(_,i)=>.15*Math.sin(i*.03));
    SongCore.addTake(w,{channels:[pcm],rate:44100,start:0,end:2,choose:true});SongCore.addSection(w,'Touch regression',0,30);SongStudio.render();
    window.micCount=0;window.touchTrace=[];navigator.mediaDevices.getUserMedia=()=>{micCount++;return new Promise(()=>{});};
    for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel','mousedown','mouseup','click','scroll','blur'])window.addEventListener(type,e=>touchTrace.push({wall:Date.now(),type,target:e.target.id||e.target.tagName,pointerId:e.pointerId,pointerType:e.pointerType,isPrimary:e.isPrimary,trusted:e.isTrusted,compact:songStudio.classList.contains('sg-scrolled'),micCount}),true);
   });
   await p.locator('[data-song-play="Lead vocal"]').click();await p.waitForFunction(()=>SongStudio.state().playing);
   await p.evaluate(async()=>{
    const frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    songStudio.scrollTop=220;await frames();
    // Defer this real scroll update until the button press is active.
    songStudio.addEventListener('scroll',e=>e.stopImmediatePropagation(),{capture:true,once:true});songStudio.scrollTop=0;await frames();
    if(!songStudio.classList.contains('sg-scrolled'))throw Error('Deferred scroll precondition failed');
   });
   const box=await p.locator('#sgRecord').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;evidence.point={x,y,box};
   evidence.hitTarget=await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,{x,y});
   if(evidence.hitTarget!=='sgRecord')throw Error('Record hit target precondition failed');
   let cdp;
   if(name.startsWith('touch')){cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});}
   else if(name==='synthetic-blur'){await p.mouse.move(x,y);await p.mouse.down();}
   else await p.evaluate(()=>sgRecord.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:77,isPrimary:true,button:0})));
   await p.evaluate(()=>songStudio.dispatchEvent(new Event('scroll')));await p.waitForTimeout(60);
   check(name+': compact layout remains stable during the press',await p.evaluate(()=>songStudio.classList.contains('sg-scrolled')));
   if(name.startsWith('touch-release')){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForFunction(()=>micCount===1);await p.waitForFunction(()=>!songStudio.classList.contains('sg-scrolled'));
    check(name+': native touch activates Record exactly once',await p.evaluate(()=>micCount===1&&SongStudio.state().opening));
   }else if(name==='touch-cancel'){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.waitForFunction(()=>!songStudio.classList.contains('sg-scrolled'));
    check('Native touch cancellation releases layout without recording',await p.evaluate(()=>micCount===0&&!SongStudio.locked()));
    await p.locator('#sgRecord').tap();await p.waitForFunction(()=>micCount===1);
    check('Native touch remains usable after cancellation',await p.evaluate(()=>micCount===1&&SongStudio.state().opening));
   }else if(name==='synthetic-blur'){
    await p.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:999,isPrimary:false})));await p.waitForTimeout(30);
    check('An unrelated pointer cancellation does not unlock the held layout',await p.evaluate(()=>songStudio.classList.contains('sg-scrolled')));
    await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForFunction(()=>!songStudio.classList.contains('sg-scrolled'));
    await p.mouse.move(1,height-2);await p.mouse.up();
    check('Synthetic window blur releases layout without forcing activation',await p.evaluate(()=>micCount===0&&!SongStudio.locked()));
   }else{
    evidence.afterUp=await p.evaluate(async()=>{
     const at=performance.now();window.dispatchEvent(new PointerEvent('pointerup',{pointerId:77,isPrimary:true,button:0}));
     await new Promise(r=>requestAnimationFrame(r));return {elapsed:performance.now()-at,compact:songStudio.classList.contains('sg-scrolled')};
    });
    check(name+': a frame before the no-click deadline cannot move the target',evidence.afterUp.elapsed<450&&evidence.afterUp.compact);
    if(name==='synthetic-order')await p.evaluate(()=>window.dispatchEvent(new PointerEvent('click',{pointerId:77,isPrimary:true,button:0})));
    await p.waitForFunction(()=>!songStudio.classList.contains('sg-scrolled'),null,{timeout:3000});
    check(name+': click or bounded no-click cleanup releases layout without activation',await p.evaluate(()=>micCount===0&&!SongStudio.locked()));
   }
  }catch(e){evidence.failure=String(e);throw e;}
  finally{
   try{evidence.final=await p.evaluate(()=>({trace:window.touchTrace||[],micCount:window.micCount,compact:document.getElementById('songStudio')?.classList.contains('sg-scrolled'),state:window.SongStudio?.state()}));}catch(e){evidence.traceReadError=String(e);}
   if(process.env.PVS_TEST_OUT){fs.mkdirSync(process.env.PVS_TEST_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.PVS_TEST_OUT,`transport-touch-${name}.json`),JSON.stringify(evidence,null,2));}
   await p.context().close();
  }
 }
});
