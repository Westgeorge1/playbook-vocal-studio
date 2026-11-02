const {suite}=require('../tests-0.32.4/browser.cjs');
suite('guide-undo',31,async({page,check})=>{
 const p=await page(1280,600);p.on('dialog',d=>d.accept());
 await p.evaluate(()=>{
  const rate=44100;
  function voice(hz){return Float32Array.from({length:rate*4},(_,i)=>.22*Math.sin(2*Math.PI*hz*i/rate)*(i<rate/5?0:1));}
  S.song=SongCore.empty(rate);
  SongStudio.edit(w=>{const t=SongCore.track(w);SongCore.addTake(w,{trackId:t.id,start:0,end:4,channels:[voice(225)],choose:true});const h=SongCore.addTrack(w,'Harmony');SongCore.addTake(w,{trackId:h.id,start:0,end:4,channels:[voice(335)],choose:true});w.activeTrack=t.id;});
 });
 const open=async()=>{if(!await p.locator('#guideSheet').isVisible())await p.locator('#coachBtn').click();await p.locator('#guideThisVocal').click();};
 const mode=v=>p.locator('#pgMode').selectOption(v);
 const prepare=async()=>{await p.locator('#pgPrepare').click();await p.locator('#pgHear1').waitFor({timeout:150000});};
 const reversed=async()=>{
  await p.waitForFunction(()=>{
   const m=document.getElementById('pgMessage').textContent;
   return /^(Undone|A newer|The editor history|The song changed|Check the result|Wait for recording)/.test(m);
  },null,{timeout:150000});
  const message=await p.locator('#pgMessage').innerText();
  if(!message.startsWith('Undone.'))throw Error('Undo response: '+message+' · '+JSON.stringify(await p.evaluate(()=>({generation:engineGeneration,busy:sessionLocked(),tone:S.P.chEq2Gain}))));
 };
 const idle=()=>p.waitForFunction(()=>!sessionLocked()&&!SongStudio.locked(),null,{timeout:150000});
 await open();check('With a single take the Guide starts with a listening concern, not a missing comparison',await p.locator('#pgMode').inputValue()!=='take');
 await mode('harmony');
 check('Harmony concern selects the overlapping vocal and its dip',await p.locator('#pgBalance').evaluate(e=>e.selectedOptions[0].textContent.includes('Lower Harmony')));
 await prepare();check('The scope identifies the harmony and its precise interval',/Harmony.*from.*to/.test(await p.locator('#pgScope').innerText()));
 await mode('breath');check('Breath concern explains hearing the removed sound and protecting the next word',/consonant/.test(await p.locator('#pgAdvice').innerText()));
 await mode('tune');await p.locator('#pgPolish').click();await p.locator('#pgOpenNotes').waitFor({timeout:180000});
 check('Pitch concern offers direct note editing before preparing a preset',await p.locator('#pgOpenNotes').isVisible());
 await p.evaluate(()=>{if(+S.P.chainOn<.5){setP('chainOn',1,0);syncControls();}});await idle();await mode('tone');const gain=await p.evaluate(()=>S.P.chEq2Gain);
 await prepare();check('Tone comparison discloses whole-vocal scope before Keep',/whole Lead vocal/.test(await p.locator('#pgScope').innerText()));
 await p.locator('#pgKeep').click();await p.waitForFunction(()=>document.getElementById('pgMessage').textContent.includes('Tone kept'),null,{timeout:150000});
 check('Tone Keep offers its own Undo',await p.locator('#pgUndo').isEnabled()&&/tone/.test(await p.locator('#pgUndo').innerText()));
 await p.evaluate(()=>engine({type:'sheet',name:'Background sheet',mask:0}));
 await p.locator('#pgUndo').click();await reversed();
 check('Tone Undo restores both the native EQ value and review history',await p.evaluate(old=>S.P.chEq2Gain===old&&!S.song.tracks[0].regions[0].takes[0].coachDecisions?.length,gain));
 await mode('tune');await prepare();
 const before=await p.evaluate(()=>JSON.stringify(NoteTuner.state().editor.settings));
 await p.locator('#pgKeep').click();await p.waitForFunction(()=>document.getElementById('pgMessage').textContent.includes('Preset kept'),null,{timeout:150000});
 check('The kept tuning preset offers the note editor Undo',await p.locator('#pgUndo').isEnabled()&&/tuning/.test(await p.locator('#pgUndo').innerText()));
 await p.locator('#pgUndo').click();await reversed();
 check('Tuning Undo restores the original editor settings and review history',await p.evaluate(s=>JSON.stringify(NoteTuner.state().editor.settings)===s&&!S.song.tracks[0].regions[0].takes[0].coachDecisions?.length,before));
 await mode('tone');await prepare();await p.locator('#pgKeep').click();await p.waitForFunction(()=>document.getElementById('pgMessage').textContent.includes('Tone kept'),null,{timeout:150000});
 await p.evaluate(()=>{setP('chEq2Gain',2,0);syncControls();});await idle();
 await p.locator('#pgUndo').click();check('A later POLISH edit cannot be popped by the Guide',await p.evaluate(()=>S.P.chEq2Gain===2&&document.getElementById('pgUndo').disabled));
 await p.context().close();
});
