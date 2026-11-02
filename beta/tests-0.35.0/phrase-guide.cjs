/* User-facing phrase review and recording-timeline transport, including persistence
   and sample comparisons. All fixture audio is generated locally. */
const {suite}=require('../tests-0.32.4/browser.cjs');
suite('phrase-guide',20,async({page,check})=>{
 const p=await page(1280,600);p.on('dialog',dialog=>dialog.accept());
 const open=async()=>{if(!await p.locator('#guideSheet').isVisible())await p.locator('#coachBtn').click();await p.locator('#guideThisVocal').click();};
 const mode=v=>p.locator('#pgMode').selectOption(v);
 const prepare=async()=>{await p.locator('#pgPrepare').click();await p.locator('#pgHear0').waitFor({timeout:150000});};
 const capture=()=>p.evaluate(()=>{const w=S.song,t=w.tracks[0],r=t.regions[0];return {rev:w.revision,undo:SongStudio.undoCount(),count:r.takes.length,selected:r.selected,
  pcm:SongCore.hashPcm(w.sources[r.takes[0].source].channels),moves:w.tracks.map(t=>(t.levelMoves||[]).map(m=>[m.start,m.end,m.db]))};});
 await open();check('Empty guide tells the user to record or import',/record or import/i.test(await p.locator('#pgBody').innerText()));await p.locator('#pgClose').click();await p.locator('#guideClose').click();
 const ids=await p.evaluate(()=>{
  const rate=44100,n=rate*6,lead=new Float32Array(n),alt=new Float32Array(n),harmony=new Float32Array(n);let seed=74;
  for(let i=0;i<n;i++){const t=i/rate;seed=seed*16807%2147483647;
   if((t>.55&&t<1.8)||(t>2.4&&t<3.65)||(t>4.4&&t<5.55)){
    const hz=t<2?206:t<4?245:264;lead[i]=.25*Math.sin(2*Math.PI*hz*t);alt[i]=.19*Math.sin(2*Math.PI*(hz+5)*t);harmony[i]=.12*Math.sin(2*Math.PI*hz*1.5*t);
   }else if(t>2&&t<2.28){lead[i]=.024*(seed/2147483647-.5);alt[i]=lead[i];}
  }
  S.song=SongCore.empty(rate);let ids;
  SongStudio.edit(w=>{const a=SongCore.addTake(w,{start:1,end:7,origin:1,channels:[lead],name:'Lead A',choose:true});
   const b=SongCore.addTake(w,{regionId:a.region.id,start:1,end:7,origin:1,channels:[alt],name:'Lead B'}),h=SongCore.addTrack(w,'Harmony');
   SongCore.addTake(w,{trackId:h.id,start:1,end:7,origin:1,channels:[harmony],choose:true});w.activeTrack=w.tracks[0].id;w.cursor=1.6;
   ids={lead:w.activeTrack,harmony:h.id,a:a.take.id,b:b.take.id,r:a.region.id};
  },'Test song');return ids;
 });
 // Import a riddim at a different sample rate through the normal backing-file input.
 const opened=p.waitForEvent('filechooser');await p.locator('#sgLoadBeat').click();
 const sr=48000,n=sr*8,wav=Buffer.alloc(44+2*n);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++)wav.writeInt16LE(Math.round(2100*Math.sin(i*2*Math.PI*76/sr)),44+2*i);
 await (await opened).setFiles({name:'riddim.wav',mimeType:'audio/wav',buffer:wav});
 await p.waitForFunction(()=>!!S.beat&&!sessionLocked());
 // Independent evidence that preview controls play real, different audio.
 const captureAudio=()=>{window.pgAuditions=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer&&this.buffer.length>1000){window.lastGuideAudio=this.buffer.getChannelData(0).slice();pgAuditions.push({hash:SongCore.hashPcm([this.buffer.getChannelData(0)]),loop:this.loop});}return start.apply(this,a);};};
 await p.addInitScript(captureAudio);await p.evaluate(captureAudio);
 const lanes=p.locator('#sgTimeline [data-song-play]');
 check('Backing and both vocal lanes have a Play button',await lanes.count()===3);
 check('Each timeline Play button sits inside its own waveform',await lanes.evaluateAll(buttons=>buttons.every(button=>{
  const b=button.getBoundingClientRect(),w=button.closest('.sg-lane').querySelector('canvas.sg-wave').getBoundingClientRect();
  return b.left>=w.left&&b.right<=w.right+1&&b.top>=w.top&&b.bottom<=w.bottom+1;
 })));
 const before=await capture();await lanes.last().click();await p.waitForFunction(()=>SongStudio.state().playing);
 check('Play from another lane starts at the playhead without arming or soloing it',await p.evaluate(()=>SongStudio.state().position>=1.6&&S.song.activeTrack===S.song.tracks[0].id&&S.song.tracks.every(t=>!t.solo&&!t.mute)));
 check('All timeline buttons and the main transport show Pause',await lanes.allTextContents().then(a=>a.every(x=>x.includes('Pause')))&&(await p.locator('#sgPlay').textContent()).includes('Pause'));
 await lanes.first().click();check('Pause from the backing stops the song and preserves history',await p.evaluate(()=>!SongStudio.state().playing)&&before.undo===(await capture()).undo);
 await p.locator('[data-mute="'+ids.harmony+'"]').click();
 await p.locator('[data-solo="'+ids.lead+'"]').click();
 await lanes.last().click();await p.waitForFunction(()=>SongStudio.state().playing);
 check('Lane playback respects existing Solo and Mute choices',await p.evaluate(()=>S.song.tracks[0].solo&&S.song.tracks[1].mute&&S.song.activeTrack===S.song.tracks[0].id));
 await p.locator('#sgPlay').click();
 await p.locator('[data-mute="'+ids.harmony+'"]').click();await p.locator('[data-solo="'+ids.lead+'"]').click();
 await open();check('Guide prioritizes a detected breath and provides a timed passage',await p.locator('#pgMode').inputValue()==='breath'&&/Possible breath/.test(await p.locator('.pg-focus').innerText()));
 const current=await capture();await prepare();await p.locator('#pgHear0').click();await p.locator('#pgHear1').click();await p.locator('#pgRemoved').click();
 check('Original, proposed and removed sound each produce audible distinct buffers',await p.evaluate(()=>new Set(pgAuditions.slice(-3).map(x=>x.hash)).size===3&&pgAuditions.slice(-3).every(x=>x.loop)));
 const wet=await p.evaluate(()=>pgAuditions.at(-3).hash);
 await p.evaluate(()=>{window.testBeatLevel=S.beatLevel;S.beatLevel=0;});
 await p.locator('#pgKeep').click();check('A stale preview cannot apply after the backing level changes',/Prepare/.test(await p.locator('#pgMessage').textContent())&&(await capture()).count===2);
 await prepare();await p.locator('#pgHear0').click();
 check('Phrase audition includes the riddim at the song mix level',await p.evaluate(h=>h!==pgAuditions.at(-1).hash,wet));
 await p.evaluate(()=>{S.beatLevel=window.testBeatLevel;});await prepare();
 check('Audition does not modify the song or Undo',JSON.stringify(await capture())===JSON.stringify(current));
 await p.locator('#pgLess').click();await p.waitForFunction(()=>document.querySelector('#pgHear1')?.textContent.includes('3 dB'));
 await p.locator('#pgBlind').click();check('Blind A/B conceals identities and blocks accidental Keep',await p.locator('#pgKeep').isDisabled()&&/A$/.test(await p.locator('#pgHear0').innerText()));await p.locator('#pgBlind').click();
 await p.locator('#pgKeep').click();
 check('Keeping a breath creates a new chosen take, retaining the original PCM',await p.evaluate(()=>{const r=S.song.tracks[0].regions[0],a=r.takes.find(a=>a.id===r.selected);return r.takes.length===3&&a.cleanup?.db===3&&a.coachDecisions?.some(d=>/−3 dB/.test(d.label));})&&(await capture()).pcm===current.pcm);
 await p.locator('#pgUndo').click();check('One song Undo restores the old selection and review state',(await capture()).count===2&&(await capture()).selected===ids.a);
 await mode('take');await prepare();await p.locator('#pgKeep').click();check('Choosing the challenger changes the actual selected take',(await capture()).selected===ids.b);
 await p.locator('#pgUndo').click();
 await mode('mix');await p.locator('#pgBalance').selectOption(ids.harmony);await prepare();const mixBefore=await capture();await p.locator('#pgHear1').click();
 check('Harmony preview leaves all saved phrase envelopes unchanged',(await capture()).moves.every(a=>!a.length));
 await p.locator('#pgKeep').click();check('Keep lowers only the chosen harmony for the selected interval',await p.evaluate(()=>!S.song.tracks[0].levelMoves?.length&&S.song.tracks[1].levelMoves?.length===1&&S.song.tracks[1].levelMoves[0].db===-2));
 await p.locator('#pgUndo').click();
 await mode('mix');await prepare();await p.locator('#pgKeep').click();check('Lead lift uses the native phrase level envelope',(await capture()).moves[0][0][2]===2);
 await p.locator('#pgUndo').click();await p.locator('#pgLeave').click();await p.locator('#pgHistory summary').click();check('Leave it records a take-local decision without changing the audio',(await capture()).pcm===current.pcm&&/Left as heard/.test(await p.locator('#pgHistory').innerText()));
 await p.locator('#pgNext').click();check('Next unreviewed advances to another passage',!(await p.locator('#pgProgress').innerText()).includes('This passage: Left as heard'));
 await p.locator('#pgClose').click();await p.locator('#guideClose').click();
 const dl=p.waitForEvent('download');await p.locator('#sgSave').click();
 const backup=require('node:fs').readFileSync(await(await dl).path());
 const restored=await page(1280,720);const chooser=restored.waitForEvent('filechooser');await restored.locator('#sgStartOpen').click();
 await (await chooser).setFiles({name:'guided-song.zip',mimeType:'application/zip',buffer:backup});
 await restored.waitForFunction(()=>S.song?.tracks[0]?.regions[0]?.takes[0]?.coachDecisions?.some(d=>d.label==='Left as heard')&&!sessionLocked(),null,{timeout:90000});
 check('A downloaded backup reopens with the saved decision and both vocal lanes',await restored.evaluate(()=>S.song.tracks.length===2&&S.song.tracks[0].regions[0].takes.length===2));
 await restored.context().close();
 await p.evaluate(async()=>await persistNow());await p.reload();await p.waitForFunction(()=>window.SongStudio&&!S.loading&&S.song?.tracks?.[0]?.regions[0]?.takes[0]?.coachDecisions?.length);
 await open();await p.locator('#pgHistory summary').click();check('Review decisions survive autosave and reopening',/Left as heard/.test(await p.locator('#pgHistory').innerText()));
 await mode('stage');await p.locator('#pgPolish').click();await p.locator('#pgPrepare').waitFor({timeout:150000});await prepare();check('Diagnostic compares raw, cleaned, tuned and final for the same phrase',await p.locator('#pgPlayers .pg-audio button').allTextContents().then(a=>['Raw','Cleaned','Tuned','Final'].every((v,i)=>a[i]?.includes(v))));
 await p.evaluate(()=>{if(+S.P.chainOn<.5){setP('chainOn',1,0);syncControls();}});
 await p.waitForFunction(()=>!sessionLocked(),null,{timeout:120000});
 await p.locator('#pgEarliest').selectOption('final');await p.getByRole('button',{name:'Review this stage'}).click();
 check('A problem first heard in Final opens guided tone controls',await p.locator('#pgMode').inputValue()==='tone');
 const oldMid=await p.evaluate(()=>S.P.chEq2Gain);
 await prepare();await p.locator('#pgHear1').click();
 check('A tone preview is isolated from the actual chain',await p.evaluate(()=>S.P.chEq2Gain)===oldMid);
 await p.locator('#pgLess').click();await p.waitForFunction(()=>document.querySelector('#pgHear1')?.textContent.includes('→ '+(S.P.chEq2Gain-.75)+' dB'),null,{timeout:150000});
 await p.locator('#pgKeep').click();await p.waitForFunction(()=>document.querySelector('#pgMessage')?.textContent.includes('Tone kept'),null,{timeout:150000});
 check('Keeping the gentler tone suggestion changes exactly the requested HIGH-MID amount',await p.evaluate(()=>S.P.chEq2Gain)===oldMid-.75);
 await mode('tune');await prepare();check('Snap All + Smooth 25% can be previewed before Keep',(await p.locator('#pgHear1').innerText()).includes('Snap All + Smooth'));
 const st=await p.evaluate(()=>JSON.stringify(NoteTuner.state().editor.settings));await p.locator('#pgLess').click();await p.waitForFunction(()=>document.querySelector('#pgHear1')?.textContent.includes('85%'),null,{timeout:150000});check('The lighter tuning preview preserves current note edits',await p.evaluate(()=>JSON.stringify(NoteTuner.state().editor.settings))===st);
 await p.locator('#pgHear1').click();
 await p.waitForFunction(()=>window.lastGuideAudio?.length>0);
 await p.evaluate(()=>{window.testPresetAudio=lastGuideAudio.slice();window.testPresetStart=Number(document.getElementById('pgA').value);});
 await p.locator('#pgKeep').click();await p.waitForFunction(()=>document.querySelector('#pgMessage')?.textContent.includes('Preset kept'),null,{timeout:150000});
 const parity=await p.evaluate(()=>{
  const expected=window.testPresetAudio,from=Math.round(window.testPresetStart*S.rate),actual=S.audio[3][0].subarray(from,from+expected.length);
  let ref=0,cross=0;for(let i=0;i<actual.length;i++){ref+=actual[i]*actual[i];cross+=actual[i]*expected[i];}
  const g=cross/ref;let err=0,power=0;for(let i=0;i<actual.length;i++){err+=(expected[i]-g*actual[i])**2;power+=expected[i]**2;}
  return {g,rel:Math.sqrt(err/Math.max(1e-15,power)),power};
 });
 console.log('Tuning preview versus committed phrase',parity);
 check('The tuning preset that was heard matches the applied audio at monitoring gain',parity.g>0&&parity.power>0.001&&parity.rel<.0002);
 check('Keeping the tuning preset stores the explicit whole-lane decision',await p.evaluate(()=>S.song.tracks[0].regions[0].takes[0].coachDecisions.some(x=>x.label.includes('85%'))));
 await mode('tune');await prepare();await p.locator('#pgNotes').click();check('Open notes jumps from the passage to the tuning window',await p.evaluate(()=>WorkWindows.state().open&&WorkWindows.state().mode==='notes'&&!document.getElementById('phraseGuide').open));
 const q=await page(360,800);await q.evaluate(()=>{S.song=SongCore.empty(44100);SongStudio.edit(w=>SongCore.addTake(w,{start:0,end:2,channels:[Float32Array.from({length:88200},(_,i)=>.2*Math.sin(i*.03))],choose:true}),'Mobile recording');});
 await q.locator('[data-song-play]').last().tap();await q.waitForFunction(()=>SongStudio.state().playing);await q.locator('[data-song-play]').last().tap();
 check('Mobile timeline Play and Pause work by touch',await q.evaluate(()=>!SongStudio.state().playing));
 await q.locator('#coachBtn').tap();await q.locator('#guideThisVocal').tap();check('Phrase coach fits a 360 px phone without horizontal scrolling',await q.locator('#phraseGuide').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth));
});
