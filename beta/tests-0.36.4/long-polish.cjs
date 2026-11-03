/* Explicit five-minute acceptance test. Run separately from the standard suites
 * so smaller test machines can reserve memory for one long lane at a time. */
const {suite}=require('../tests-0.32.4/browser.cjs');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
suite('long-polish',48,async({page,check})=>{
 const p=await page(1280,600);
 const fixture=await p.evaluate(()=>{
  const rate=44100,w=S.song=SongCore.empty(rate);
  for(let lane=0;lane<4;lane++){
   const track=lane?SongCore.addTrack(w,'Harmony '+lane):w.tracks[0];
   for(let take=0;take<10;take++){
    const start=take*32+(take===9?8:0);
    const pcm=Float32Array.from({length:4*rate},(_,i)=>.06*Math.sin(i*(.025+lane*.002)));
    SongCore.addTake(w,{trackId:track.id,start,end:start+4,channels:[pcm],origin:start,choose:true});
   }
  }
  w.activeTrack=w.tracks[0].id;SongCore.validate(w);SongStudio.render();
  window.longLayout=()=>S.song.tracks.map(t=>[t.id,t.regions.map(r=>[r.start,r.end,r.selected,r.takes.map(a=>[a.id,a.source,a.origin,SongCore.hashPcm(S.song.sources[a.source].channels)])])]);
  window.longCheck={stages:[],maxGap:0,gaps:[]};
  const status=document.querySelector('#sgStatus');
  new MutationObserver(()=>longCheck.stages.push([performance.now(),status.textContent]))
   .observe(status,{childList:true,subtree:true,characterData:true});
  let last=performance.now();
  longCheck.timer=setInterval(()=>{const now=performance.now();const gap=now-last;longCheck.maxGap=Math.max(gap,longCheck.maxGap);if(gap>500)longCheck.gaps.push({ms:Math.round(gap),stage:status.textContent});last=now;},100);
  return {layout:longLayout(),seconds:SongCore.duration(w),usage:SongCore.usage(w),source:SongCore.trackSignature(w,w.tracks[0])};
 });
 check('The song contains 300 seconds, four lanes and 40 takes',fixture.seconds===300&&fixture.usage.takes===40);
 const start=Date.now();await p.locator('#sgPolish').click();
 await p.waitForFunction(()=>sgStatus.textContent.includes('in POLISH ·'),null,{timeout:30000});
 const bounds=await p.locator('#sgPolishProgress').boundingBox();
 check('Live status is visible beside the footer button at 1280 × 600',bounds&&bounds.y>=0&&bounds.y+bounds.height<=600);
 if(process.env.PVS_TEST_OUT)await p.screenshot({path:path.join(process.env.PVS_TEST_OUT,'opening-vocal.png')});
 await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching||sgStatus.textContent.startsWith('Could not open POLISH'),null,{timeout:650000});
 const elapsed=Date.now()-start;
 const actual=await p.evaluate(async()=>{
  clearInterval(longCheck.timer);
  const w=S.song,t=w.tracks[0],channels=S.final||[],hashes=[],lockedAtReady=sessionLocked();
  for(const c of channels){
   const hash=await crypto.subtle.digest('SHA-256',c);
   hashes.push(Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''));
  }
  return {lockedAtReady,layout:longLayout(),status:sgStatus.textContent,source:SongCore.trackSignature(w,t),tracks:w.tracks.length,takes:SongCore.usage(w).takes,
   valid:SongCore.polishValid(w,t),inputFrames:t.polish?.session?.pcm?.[0]?.length,finalFrames:channels.map(x=>x.length),hashes,
   maxUiTimerGapMs:Math.round(longCheck.maxGap),timerGaps:longCheck.gaps,stages:longCheck.stages};
 });
 console.log('Long vocal opened:',elapsed,'ms;',JSON.stringify({...actual,layout:undefined}));
 if(process.env.PVS_TEST_OUT)fs.writeFileSync(path.join(process.env.PVS_TEST_OUT,'long-open.json'),JSON.stringify({fixture,elapsedMs:elapsed,...actual},null,2));
 check('The ready message leaves the song controls unlocked',!actual.lockedAtReady);
 check('POLISH stored a valid full-length stereo result on the selected mono lane',actual.valid&&actual.inputFrames===13230000&&actual.finalFrames.length===2&&actual.finalFrames.every(n=>n>=13230000));
 check('The original 40 takes stayed in place',JSON.stringify(actual.layout)===JSON.stringify(fixture.layout)&&actual.source===fixture.source&&actual.tracks===4&&actual.takes===40);
 check('The song showed cleaning, note detection and effects progress', ['Studio Spectral','Detecting notes','Applying your vocal chain'].every(s=>actual.stages.some(e=>e[1].includes(s))));
 if(process.env.PVS_TEST_OUT)await p.screenshot({path:path.join(process.env.PVS_TEST_OUT,'ready-vocal.png')});
 await p.locator('#polishReturn').click();await p.waitForFunction(()=>RC.step==='rc');
 const download=p.waitForEvent('download',{timeout:150000});await p.locator('#sgExport').click();await p.locator('#songDialog [data-action=mix]').click();
 const file=await download,wav=fs.readFileSync(await file.path());
 if(process.env.PVS_KEEP_EXPORT==='1'&&process.env.PVS_TEST_OUT)await file.saveAs(path.join(process.env.PVS_TEST_OUT,'long-mix.wav'));
 const exported={name:file.suggestedFilename(),bytes:wav.length,rate:wav.readUInt32LE(24),channels:wav.readUInt16LE(22),bits:wav.readUInt16LE(34),sha256:crypto.createHash('sha256').update(wav).digest('hex')};
 exported.frames=wav.readUInt32LE(40)/(exported.channels*exported.bits/8);
 check('The song downloads as a full-length vocal mix at the original sample rate',wav.toString('ascii',0,4)==='RIFF'&&exported.rate===44100&&exported.frames>=13230000);
 const summary={fixture,elapsedMs:elapsed,...actual,exported};
 if(process.env.PVS_TEST_OUT)fs.writeFileSync(path.join(process.env.PVS_TEST_OUT,'long-measurements.json'),JSON.stringify(summary,null,2));
 console.log('Exported:',JSON.stringify(exported));
});
