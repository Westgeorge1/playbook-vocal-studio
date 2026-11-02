/* Post-recording choices, concern routing, native Undo and portable exports.
 * Synthetic audio only. PVS_WORKFLOW_URL optionally serves a published beta. */
const fs=require('node:fs/promises'),{suite}=require('../tests-0.32.4/browser.cjs');
function micFixture(){
 const mic=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 window.streams=[];navigator.mediaDevices.getUserMedia=async args=>{
  const s=await mic(args);streams.push(s);
  if(window.delayMic)await new Promise(r=>window.grantLate=r);
  return s;
 };
}
suite('workflow',29,async({page,b,errors,check})=>{
 for(const [width,height] of [[390,844],[1280,600]]){
  let p;
  if(process.env.PVS_WORKFLOW_URL){
   const ctx=await b.newContext({viewport:{width,height},isMobile:width===390,hasTouch:width===390,permissions:['microphone']});
   p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.PVS_WORKFLOW_URL,{waitUntil:'domcontentloaded',timeout:90000});
  }else p=await page(width,height);
  const verify=(msg,value)=>check(width+'px '+msg,value);
  const tap=id=>width===390?p.locator(id).tap():p.locator(id).click();
  const wait=fn=>p.waitForFunction(fn,null,{timeout:40000});
  await wait(()=>window.SongStudio&&!S.loading&&!sessionLocked());await p.evaluate(micFixture);
  await p.evaluate(()=>{const ctx=audioCtx(),beat=ctx.createBuffer(1,ctx.sampleRate*10,ctx.sampleRate);beat.getChannelData(0).fill(.08);S.beat=beat;S.beatName='Test backing';document.getElementById('beatOn').checked=true;S.song.lead=0;S.song.cursor=2;SongStudio.render();});
  if(!await p.locator('#sgCheckMic').isVisible())await tap('.sg-record-helpers summary');
  await p.evaluate(()=>window.delayMic=true);await tap('#sgCheckMic');await wait(()=>window.grantLate);
  await tap('#songDialog [data-action="close"]');await p.evaluate(()=>{delayMic=false;grantLate();});await wait(()=>streams[0].getTracks().every(t=>t.readyState==='ended'));
  verify('Closing mic check releases a late permission grant without recording',await p.evaluate(()=>!SongStudio.locked()&&!SongCore.usage(S.song).takes));
  await tap('#sgCheckMic');await wait(()=>streams.length===2&&document.getElementById('sgTestNote').textContent!=='Opening microphone…');
  await tap('#songDialog [data-action="close"]');await wait(()=>streams[1].getTracks().every(t=>t.readyState==='ended'));
  verify('Checking the microphone releases its active stream and preserves the song cursor',await p.evaluate(()=>S.song.cursor===2&&!SongCore.usage(S.song).takes));
  await tap('#sgRecord');await wait(()=>SongStudio.state().recording);await p.waitForTimeout(1800);await tap('#sgRecord');
  await wait(()=>!SongStudio.locked()&&SongCore.usage(S.song).takes===1);
  const saved=await p.evaluate(()=>{const r=S.song.tracks[0].regions[0];return {a:r.start,b:r.end,id:r.selected,cursor:S.song.cursor,undo:SongStudio.undoCount()};});
  verify('Hear this take is on screen immediately after recording',await p.locator('#sgHearRecent').evaluate(el=>{const b=el.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight&&el.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2));}));
  verify('Receipt identifies the chosen take and track',/Lead vocal.*Take 1.*Used in song/.test(await p.locator('#sgRecentLabel').innerText()));
  await tap('#sgHearRecent');await wait(()=>SongStudio.state().playing);
  verify('Replay starts at the recorded line rather than its end',await p.evaluate(({a,b})=>{const pos=SongStudio.state().position;return pos>=a-.01&&pos<b;},saved));
  await tap('#sgHearRecent');
  verify('Stopping replay preserves editing position, take choice, and Undo history',await p.evaluate(x=>!SongStudio.state().playing&&S.song.cursor===x.cursor&&S.song.tracks[0].regions[0].selected===x.id&&SongStudio.undoCount()===x.undo,saved));
  await tap('#sgHearRecent');await wait(()=>SongStudio.state().playing);await wait(()=>!SongStudio.state().playing);
  verify('Natural end of replay returns to the editing position',await p.evaluate(x=>S.song.cursor===x,saved.cursor));
  await tap('#sgRetryRecent');await wait(()=>SongStudio.state().recording);await wait(()=>!SongStudio.locked()&&SongCore.usage(S.song).takes===2);
  verify('Another attempt uses exactly the same range and preserves the chosen vocal',await p.evaluate(x=>{const t=S.song.tracks[0],r=t.regions[0];return t.regions.length===1&&r.takes.length===2&&r.selected===x.id&&r.start===x.a&&r.end===x.b;},saved));
  verify('The alternate is labelled and can be heard without choosing it',/Alternate take/.test(await p.locator('#sgRecentLabel').innerText())&&await p.locator('#sgUseRecent').isVisible());
  await tap('#sgHearRecent');await wait(()=>SongStudio.state().playing);await tap('#sgHearRecent');await tap('#sgUseRecent');
  verify('Use in song changes the choice and keeps both takes',await p.evaluate(x=>S.song.tracks[0].regions[0].selected!==x&&SongCore.usage(S.song).takes===2,saved.id));
  await tap('#rcUndo');
  verify('Song Undo restores the earlier take and refreshes the receipt',await p.evaluate(x=>S.song.tracks[0].regions[0].selected===x,saved.id)&&await p.locator('#sgUseRecent').isVisible());
  await tap('#coachBtn');await tap('#guideThisVocal');
  await p.locator('#pgMode').selectOption('take');await tap('#pgPrepare');await p.locator('#pgScope').waitFor();
  verify('The take comparison states its recording-range scope and retains both takes',/recording range.*Both takes/.test(await p.locator('#pgScope').innerText()));
  await tap('#pgKeep');await p.waitForFunction(()=>document.getElementById('pgUndo')&&!document.getElementById('pgUndo').disabled);
  await tap('#pgUndo');await p.waitForFunction(()=>/^Undone/.test(document.getElementById('pgMessage').textContent));
  verify('The Guide reverses its own take choice',await p.evaluate(x=>S.song.tracks[0].regions[0].selected===x,saved.id));
  await p.locator('#pgMode').selectOption('listen');await tap('#pgLeave');await wait(()=>!document.getElementById('pgUndo').disabled);
  await p.evaluate(()=>SongStudio.edit(w=>{w.title='Newer edit';},'Later song edit'));
  await tap('#pgUndo');verify('A newer song edit cannot be undone by a stale Guide button',await p.evaluate(()=>S.song.title==='Newer edit'&&document.getElementById('pgUndo').disabled));
  await tap('#pgClose');if(await p.locator('#guideClose').isVisible())await tap('#guideClose');
  if(!await p.locator('#sgWithout').isVisible())await tap('.sg-record-helpers summary');
  await tap('#sgWithout');await tap('#sgFinish');verify('Finish explicitly identifies vocals-only after monitoring without backing',await p.locator('#qMixLabel').innerText()==='Exporting vocals only');
  await tap('#qPrepare');await p.locator('#qDownload').waitFor({timeout:90000});verify('Prepared WAV is labelled beside the download control',await p.locator('#qReadyMix').innerText()==='Exporting vocals only');
  const pull=async(id)=>{const a=p.waitForEvent('download');await tap(id);return await a;};
  const dry=await pull('#qDownload'),dryBytes=await fs.readFile(await dry.path());
  await p.locator('#qIncludeBacking').check();verify('Changing the backing invalidates the old download',await p.locator('#qDownload').count()===0&&await p.locator('#qMixLabel').innerText()==='Exporting vocals + backing');
  await tap('#qPrepare');await p.locator('#qDownload').waitFor({timeout:90000});
  const full=await pull('#qDownload'),fullBytes=await fs.readFile(await full.path());
  verify('The WAV with backing differs in audio data and has the full backing duration',fullBytes.length>dryBytes.length&&fullBytes.readUIntLE(44+600*3,3)!==dryBytes.readUIntLE(44+600*3,3));
  const zip=await pull('#qProjectBackup');verify('Back up editable project produces a ZIP, not a finished WAV',zip.suggestedFilename().endsWith(' - song project.zip')&&(await fs.readFile(await zip.path())).readUInt16LE(0)===0x4b50);
  const backupBytes=await fs.readFile(await zip.path());
  const fresh=process.env.PVS_WORKFLOW_URL?await (await b.newContext({viewport:{width,height}})).newPage():await page(width,height);
  if(process.env.PVS_WORKFLOW_URL){fresh.on('pageerror',e=>errors.push(e.message));await fresh.goto(process.env.PVS_WORKFLOW_URL,{timeout:90000,waitUntil:'domcontentloaded'});}
  await fresh.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked()&&!SongCore.usage(S.song).takes);
  await fresh.locator('#fileProject').setInputFiles({name:zip.suggestedFilename(),mimeType:'application/zip',buffer:backupBytes});
  await fresh.waitForFunction(()=>!S.loading&&!sessionLocked()&&SongCore.usage(S.song).takes===2,null,{timeout:100000});
  verify('Opening the editable project restores both takes and the saved Guide decision',await fresh.evaluate(()=>S.song.tracks[0].regions[0].takes.some(t=>t.coachDecisions?.some(d=>d.label==='Left as heard'))));
  await fresh.context().close();
  await p.evaluate(()=>{S.song.cursor=6;S.song.lead=0;SongStudio.render();});
  await tap('#sgRecord');await wait(()=>SongStudio.state().recording);await p.waitForTimeout(1400);
  await p.evaluate(()=>streams.at(-1).getAudioTracks()[0].dispatchEvent(new Event('ended')));
  await wait(()=>!SongStudio.locked()&&SongCore.usage(S.song).takes===3);
  verify('An interrupted take is marked for review without replacing the chosen audio',/Kept for review/.test(await p.locator('#sgRecentLabel').innerText())&&await p.evaluate(()=>S.song.tracks[0].regions.at(-1).selected===null));
  await p.evaluate(()=>{
   window.replayedNonBacking=false;const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer!==S.beat&&this.buffer?.getChannelData(0).some(x=>Math.abs(x)>.01))window.replayedNonBacking=true;return start.apply(this,args);};
  });
  await tap('#sgHearRecent');await wait(()=>SongStudio.state().playing);
  verify('An unchosen take past the end of the chosen vocal actually produces vocal audio',await p.evaluate(()=>window.replayedNonBacking));
  await tap('#sgHearRecent');await p.context().close();
 }
});
