/* Exercise the reference finishing at the point where an unawaited backing
 * analysis used to leave a completed vocal permanently marked pending. */
const fs=require('node:fs'),path=require('node:path');
module.exports=async function checkBacking(page,check){
 const p=await page(1366,650);
 await p.addInitScript(()=>{
  const Native=Worker;let count=0;
  window.referenceGate=new Promise(done=>window.releaseReference=done);
  window.Worker=class extends Native{
   constructor(url,...rest){super(url,...rest);this.effects=/^worker\.js/.test(String(url))&&++count>1;}
   postMessage(m,t){
    if(this.effects&&m.type==='run'&&m.update){window.postStarted=true;setTimeout(()=>releaseReference('effects already started'),20);}
    return super.postMessage(m,t);
   }
  };
 });
 await p.route('**/note-editor.html*',route=>{
  const html=fs.readFileSync(path.resolve(__dirname,'../note-editor.html'),'utf8');
  const marker='const t = await riddimTuning(); if (tok !== refToken)';
  if(!html.includes(marker))throw Error('Backing reference probe is missing its injection point.');
  return route.fulfill({contentType:'text/html',body:html.replace(marker,'const t = await riddimTuning(); if(S.riddim){parent.referenceGateResult=await Promise.race([parent.referenceGate,new Promise(done=>setTimeout(()=>done("reference completed first"),1200))]);} if (tok !== refToken)')});
 });
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked());
 await p.evaluate(()=>{
  const w=S.song=SongCore.empty(44100),x=Float32Array.from({length:176400},(_,i)=>.12*Math.sin(i*.035));
  SongCore.addTake(w,{channels:[x],rate:44100,start:0,end:4,choose:true});
  const backing=audioCtx().createBuffer(1,x.length,44100);backing.getChannelData(0).set(x);
  S.beat=backing;S.beatName='Backing reference';SongStudio.render();
 });
 await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching,null,{timeout:120000});
 const state=await p.evaluate(()=>({gate:referenceGateResult,post:postStarted,pending:NoteTuner.pending(),locked:sessionLocked(),returnDisabled:polishReturn.disabled}));
 console.log('Delayed backing reference',JSON.stringify(state));
 check('Backing reference finishes before effects render and Ready enables Return',state.gate==='reference completed first'&&state.post&&!state.pending&&!state.locked&&!state.returnDisabled);
 await p.locator('#polishReturn').click();await p.waitForFunction(()=>RC.step==='rc');await p.context().close();
};
