/* Actual studio controls, worker DSP and Web Audio in isolated projects. */
const {suite}=require('../tests-0.32.4/browser.cjs');
suite('manual-cleanup',36,async({page,b,errors,check})=>{
 for(const [width,height] of [[390,844],[1280,600]]){
  let p;
  if(process.env.PVS_CLEANUP_URL){
   const ctx=await b.newContext({viewport:{width,height},isMobile:width===390,hasTouch:width===390});p=await ctx.newPage();
   p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.PVS_CLEANUP_URL,{waitUntil:'domcontentloaded',timeout:90000});
  }else p=await page(width,height);
  const verify=(name,ok)=>check(width+'px '+name,ok);
  const go=id=>width===390?p.locator(id).tap():p.locator(id).click();
  const wait=fn=>p.waitForFunction(fn,null,{timeout:45000});
  await wait(()=>window.SongStudio&&!sessionLocked());
  await p.evaluate(()=>{
   const rate=44100,R=rate*40,pcm=new Float32Array(R);let seed=91;
   for(let i=0;i<R;i++){const t=i/rate;seed=seed*16807%2147483647;pcm[i]=t>5&&t<5.35?.04*(seed/2147483647-.5):.28*Math.sin(t*2*Math.PI*195)+.02*Math.cos(t*2*Math.PI*70);}
   S.song=SongCore.empty(rate);SongStudio.edit(w=>{SongCore.addTake(w,{start:2,end:42,origin:2,channels:[pcm,pcm.map(v=>v*.75)],choose:true});w.cursor=42;});
   S.beat=audioCtx().createBuffer(1,rate*15,rate);const beat=S.beat.getChannelData(0);
   for(let i=0;i<beat.length;i++)beat[i]=.1*Math.sin(i*.036);
   S.beatName='Backing';document.getElementById('beatOn').checked=false;SongStudio.render();
   window.orig=pcm.slice();window.originalHash=SongCore.hashPcm(S.song.sources[S.song.tracks[0].regions[0].takes[0].source].channels);
  });
  const openEdit=async()=>{await go('#sgTakes [data-edit]');await go('#songDialog [data-action="cleanup"]');};
  await go('#sgCleanHere');verify('Clean up here at the exact end opens the final second',await p.evaluate(()=>Studio.state().open&&Studio.state().a===41&&Studio.state().b===42));
  verify('Breath cleanup opens in Select sound mode with Advanced collapsed',await p.evaluate(()=>!Studio.state().hand&&!sepAdvanced.open&&sepMode.selectedIndex===0));
  const reachable=()=>p.evaluate(()=>['veClose','sepOriginal','sepEdited','sepRemoved','veStop','sepKeep'].every(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return r.width>0&&r.top>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  verify('Before, After, removed, Keep, Stop and Close are on screen',await reachable());
  await go('#veMode');verify('Move view explains that dragging scrolls',await p.locator('#scInstruction').innerText().then(t=>t.includes('Drag to scroll')));
  await go('#veClose');await openEdit();
  verify('Edit opens a short selection and resets Move view',await p.evaluate(()=>Studio.state().b-Studio.state().a===1&&!Studio.state().hand&&sepMode.selectedIndex===0));
  await go('#veSelectionTools summary');await go('#veSelectPart');verify('Oversized selection explains the 30-second limit before preview or Keep',await p.locator('#sepEdited').isDisabled()&&await p.locator('#sepKeep').isDisabled()&&/40.00 s.*30 seconds/.test(await p.locator('#scRange').innerText()));
  await go('#scUseSecond');verify('One tap recovers a usable local range from an oversized selection',await p.evaluate(()=>Studio.state().b-Studio.state().a<=1&&!sepEdited.disabled&&scUseSecond.hidden));
  await p.evaluate(()=>{Studio.select(6.9,7.4);});
  await p.locator('#sepMode').selectOption({index:1});verify('Selecting the frequency-based mode reveals its advanced controls',await p.locator('#sepLow').isVisible()&&await p.locator('#sepInspect').isVisible());
  await go('#sepInspect');await wait(()=>!document.getElementById('sepMap').hidden);
  verify('Background spectrum can be inspected without covering Stop or Keep',await reachable());
  await p.evaluate(()=>{
   Studio.select(4,34);window.yieldedDuringCleanup=false;const jobStart=performance.now();
   setTimeout(()=>{window.yieldedDuringCleanup=!sepKeep.disabled?false:veStatus.textContent.includes('Preparing');},0);
   sepEdited.click();window.dispatchMs=Math.round(performance.now()-jobStart);
  });await wait(()=>playing&&veStatus.textContent.includes('Playing After'));
  verify('A full 30-second stereo band edit gives control back to the interface before completion',await p.evaluate(()=>yieldedDuringCleanup));
  console.log('30-second cleanup button dispatch (ms)',width,await p.evaluate(()=>dispatchMs));
  await go('#veStop');await p.evaluate(()=>Studio.select(6.9,7.4));
  await p.evaluate(()=>{S.busy=true;Studio.sync();});
  verify('A processing lock is explained beside visibly disabled actions',await p.locator('#sepEdited').isDisabled()&&await p.locator('#sepKeep').isDisabled()&&/process|wait/i.test(await p.locator('#scRange').innerText())&&await p.locator('#veClose').isEnabled());
  await p.evaluate(()=>{S.busy=false;Studio.sync();});
  await p.locator('#veBeat').check();await p.locator('#sepLoop').check();
  await go('#sepOriginal');await wait(()=>playing&&loop?.backingClip);
  const before=await p.evaluate(()=>{window.beforeAudio=loop.chs.map(c=>c.slice());window.beforeBeat=loop.backingClip.getChannelData(0).slice();return {offset:loop.beatOffset,frames:loop.chs[0].length,gain:loop.gain,n:sources.length};});
  verify('Before plays half a second of context at both edges with the requested backing',Math.abs(before.offset-6.4)<.0001&&before.frames===Math.round(1.5*44100)&&before.n===2);
  await go('#sepEdited');await wait(()=>playing&&veStatus.textContent.includes('Playing After'));
  verify('After uses the same context, playback gain and aligned looping backing',await p.evaluate(b=>loop.beatOffset===b.offset&&loop.chs[0].length===b.frames&&loop.gain===b.gain&&sources.length===2&&SongCore.hashPcm([beforeBeat])===SongCore.hashPcm([loop.backingClip.getChannelData(0)])&&sources.every(s=>s.loop&&s.loopStart===0),before));
  await p.evaluate(()=>window.afterAudio=loop.chs.map(c=>c.slice()));await go('#sepRemoved');await wait(()=>playing&&veStatus.textContent.includes('removed sound solo'));
  verify('Removed is solo and exactly accounts for the difference inside the selection',await p.evaluate(()=>{const R=44100,off=R/2;return sources.length===1&&!loop.backingClip&&loop.chs[0].length===off&&loop.chs.every((r,c)=>r.every((v,i)=>Math.abs(beforeAudio[c][i+off]-afterAudio[c][i+off]-v)<1e-6)&&beforeAudio[c].every((v,i)=>i>=off&&i<2*off||v===afterAudio[c][i]));}));
  await go('#veStop');await p.locator('#veBeat').uncheck();await go('#sepEdited');await wait(()=>playing&&veStatus.textContent.includes('Playing After'));
  verify('Turning off preview backing gives vocal-only After without changing song monitoring',await p.evaluate(()=>sources.length===1&&loop.noBeat&&!beatOn.checked));
  await go('#veStop');
  await p.evaluate(()=>{
   const Native=window.Worker;window.held=[];window.pauseCleanup=true;
   window.Worker=class extends Native{
    constructor(url,...args){super(url,...args);this.cleanup=String(url).includes('cleanup-worker.js');}
    postMessage(...args){if(this.cleanup&&window.pauseCleanup){window.held.push(this);return;}return super.postMessage(...args);}
    terminate(){this.wasStopped=true;return super.terminate();}
   };
  });
  await go('#sepEdited');await wait(()=>held.length===1);
  verify('Preparation displays progress while Stop and Close remain available',/Preparing/.test(await p.locator('#veStatus').innerText())&&await p.locator('#veStop').isEnabled()&&await reachable());
  await go('#veStop');await p.evaluate(()=>held[0].onmessage({data:{value:[]}}));
  verify('Stop cancels pending work and a late reply cannot start playback',await p.evaluate(()=>held[0].wasStopped&&!playing&&!sepKeep.disabled&&veStatus.textContent.startsWith('Stopped')));
  await go('#sepKeep');await wait(()=>held.length===2);await p.keyboard.press('Escape');await p.evaluate(()=>held[1].onmessage({data:{value:[]}}));
  verify('Escape cancels pending Keep and returns the song without adding a take',await p.evaluate(()=>!Studio.state().open&&!document.body.classList.contains('st-open')&&held[1].wasStopped&&SongCore.usage(S.song).takes===1));
  await p.evaluate(()=>{window.pauseCleanup=false;S.song.range=[6.9,7.4];S.song.cursor=7.1;SongStudio.render();});
  await openEdit();verify('An explicit short timeline selection survives entry through Edit',await p.evaluate(()=>Math.abs(Studio.state().a-6.9)<1e-5&&Math.abs(Studio.state().b-7.4)<1e-5));
  await p.locator('#sepMode').selectOption({index:1});await go('#sepKeep');await wait(()=>!Studio.state().open&&SongCore.usage(S.song).takes===2);
  verify('Keep produces the exact existing stereo DSP result and preserves the original',await p.evaluate(()=>{
   const w=S.song,r=w.tracks[0].regions[0],t=r.takes[0],n=r.takes[1],old=w.sources[t.source].channels,edited=w.sources[n.source].channels;
   const a=Math.round((6.9-2)*w.rate),b=Math.round((7.4-2)*w.rate);
   return r.selected===n.id&&SongCore.hashPcm(old)===originalHash&&old.every((ch,c)=>{const d=VocalSeparation.removed(ch,a,b,w.rate,{low:0,high:100,db:4,fade:10});return edited[c].every((v,i)=>v===(i>=a&&i<b?Math.fround(ch[i]-d[i-a]):ch[i]));});
  }));
  await go('#rcUndo');verify('Song Undo restores the original take after cleanup',await p.evaluate(()=>SongCore.usage(S.song).takes===1&&S.song.tracks[0].regions[0].selected===S.song.tracks[0].regions[0].takes[0].id));
  await p.evaluate(()=>{SongStudio.edit(w=>{const rate=w.rate;SongCore.addTake(w,{start:42,end:43,origin:42,channels:[new Float32Array(rate)],choose:true,name:'Next line'});w.range=null;w.cursor=42;});});
  await go('#sgCleanHere');verify('A new take starting at the same boundary wins over the preceding take',await p.evaluate(()=>veTitle.textContent.includes('Next line')&&Studio.state().a===42));
  await go('#veClose');
  if(width===390){
   await go('#coachBtn');await go('label:has(#coachExplain)');await go('#guideClose');
   await p.evaluate(()=>{S.song.range=null;S.song.cursor=7;SongStudio.render();});
   await go('#sgCleanHere');await go('#sepOriginal');await wait(()=>playing);
   await go('#veStop');await go('#veClose');
   check('Phone Explain mode leaves Clean up here, Before, Stop and Close usable',await p.evaluate(()=>!Studio.state().open&&!playing));
   const wave=p.locator('#sgTimeline .sg-lane.active canvas');await wave.scrollIntoViewIfNeeded();
   // Determine a real on-screen point on this vocal, even if the host clips the bottom of the lane.
   const point=await wave.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width*.25;
    for(let y=Math.max(1,Math.ceil(r.top));y<Math.min(innerHeight,r.bottom);y+=2)if(document.elementFromPoint(x,y)===e)return {x,y};
    throw Error('No exposed vocal waveform');});
   const touch=await p.context().newCDPSession(p);
   try{
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await wait(()=>Studio.state().open);
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(350);
    check('A touch release after holding the vocal cannot trigger Keep or dismiss cleanup',await p.evaluate(()=>Studio.state().open&&SongCore.usage(S.song).takes===2&&!playing));
    await go('#veClose');check('The next deliberate tap closes a long-press cleanup',await p.evaluate(()=>!Studio.state().open));
   }finally{await touch.detach();}
  }
  await p.context().close();
 }
});
