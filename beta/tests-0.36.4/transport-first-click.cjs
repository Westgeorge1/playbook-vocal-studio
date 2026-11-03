module.exports=async function checkFirstClicks({page,check}){
 for(const [width,height] of [[1280,600],[360,780],[412,915]]){
  const p=await page(width,height);
  await p.waitForFunction(()=>!sessionLocked());
  await p.evaluate(()=>{
   const w=S.song=SongCore.empty(44100),x=Float32Array.from({length:44100*9},(_,i)=>.15*Math.sin(i*.03));
   SongCore.addTake(w,{channels:[x],rate:44100,start:0,end:9,choose:true});SongStudio.render();
   window.micCount=0;window.trace=[];
   navigator.mediaDevices.getUserMedia=()=>{micCount++;return new Promise(()=>{});};
   for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','focusin','scroll'])document.addEventListener(type,e=>{
    const r=sgRecord.getBoundingClientRect();trace.push({type,target:e.target.id||e.target.tagName,x:e.clientX,y:e.clientY,record:[r.x,r.y,r.width,r.height],scroll:songStudio.scrollTop,playing:SongStudio.state().playing});if(trace.length>30)trace.shift();
   },true);
  });
  const click=async sel=>width<600?p.locator(sel).tap():p.locator(sel).click();
  for(let i=0;i<8;i++){
   await p.evaluate(()=>{SongStudio.stopPlay();S.song.cursor=0;SongStudio.render();});
   await click('[data-song-play="Lead vocal"]');await p.waitForFunction(()=>SongStudio.state().playing);
   await p.evaluate(i=>{songStudio.scrollTop=[21,149,151,220][i%4];},i);
   await click('#sgRecord');
   try{await p.waitForFunction(n=>micCount===n,i+1,{timeout:3000});}
   catch(e){console.log('MISSED',width,i,JSON.stringify(await p.evaluate(()=>trace)));throw e;}
   await click('#sgStop');await p.waitForFunction(()=>!SongStudio.locked());
  }
  check(width+'px 8 consecutive first-click punch-in requests',await p.evaluate(()=>micCount===8));
  await p.context().close();
 }
};
