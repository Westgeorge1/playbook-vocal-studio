const {suite,wave}=require('./browser.cjs');
suite('navigation',10,async({page,check,b,url})=>{
 let backup;
 for(const [width,height] of [[1280,800],[390,844],[320,740],[844,390]]){
  const p=await page(width,height),tag=width+'×'+height;
  await p.evaluate(()=>{
    window.navJobs=0;const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(...args){navJobs++;return post.apply(this,args);};
  });
  const quiet=()=>p.evaluate(()=>!sessionLocked()&&!SongPolish.state().switching&&!S.dirty&&!S.busy&&navJobs===0&&document.documentElement.scrollWidth<=innerWidth+2);
  check(tag+' starts empty',await p.evaluate(()=>StudioBrowse.empty()&&RC.step==='rc'));
  await p.locator('#rcStep2').click();
  check(tag+' POLISH opens empty',await p.evaluate(()=>RC.step==='polish'&&StudioBrowse.browsing()));
  for(const tab of ['clean','tune','chain','detail','mix']){
   await p.locator('[data-tab="'+tab+'"]').click();
   check(tag+' opens '+tab,await p.locator('[data-ipanel="'+tab+'"]').isVisible()&&await quiet());
  }
  for(const dock of ['notes','wave','ref']){
   await p.locator('[data-dock="'+dock+'"]').click();
   check(tag+' dock '+dock,await p.locator('[data-dpanel="'+dock+'"]').isVisible()&&await quiet());
  }
  for(const name of ['File','Edit','View','Help']){
   const button=p.locator('.menu .mtop').filter({hasText:new RegExp('^'+name+'$')});
   await button.click();check(tag+' '+name+' menu',await button.getAttribute('aria-expanded')==='true'&&await quiet());await button.click();
  }
  await p.locator('#guideBtn').click();check(tag+' guide opens',await p.locator('#guideSheet').isVisible()&&await quiet());await p.locator('#guideClose').click();
  for(const mode of ['record','notes','wave','ref']){
   const choice=p.locator('#workspaceChoice');
   await choice.selectOption(mode);
   if(width===844&&mode==='ref'){
    await choice.focus();await choice.press('Tab');
    await p.setViewportSize({width:width-1,height});
    await p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    check(tag+' keeps the chosen workspace after a resize before Expand',await choice.inputValue()===mode);
    await p.setViewportSize({width,height});
   }
   await p.locator('#workspaceExpand').click();
   await p.waitForFunction(m=>WorkWindows.state().open&&WorkWindows.state().mode===m,mode);
   const host=mode==='record'?'#songStudio':'#dock',prefix=mode==='record'?'recordWindow':'workWindow';
   const box=p.locator(host+' .studio-empty:visible').first();
   check(tag+' '+mode+' has three working entry points',await box.locator('button:enabled').count()===3&&await quiet());
   const close=p.locator('#'+prefix+'Close');await close.scrollIntoViewIfNeeded();
   const bounds=await close.boundingBox();check(tag+' '+mode+' return fits',bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=height+1);
   if(await p.locator('#'+prefix+'Max').isVisible()){await p.locator('#'+prefix+'Max').click();await p.locator('#'+prefix+'Max').click();}
   if(mode==='record'||mode==='notes'){await p.locator('#'+prefix+'Focus').click();await p.locator('#'+prefix+'Focus').click();}
   if(mode==='notes'){
    const frame=p.frames().find(f=>f.url().includes('note-editor.html'));await frame.locator('#presetRoots').waitFor({state:'attached'});
    check(tag+' empty piano roll, preset protection and reference',await frame.evaluate(()=>!!document.getElementById('roll')&&document.getElementById('presetRoots').disabled&&document.getElementById('refMode').title.includes('vocal')));
    const overflow=await frame.evaluate(()=>document.documentElement.scrollWidth-innerWidth);check(tag+' editor fits',overflow<=2);
   }
   if(mode==='ref'){await p.locator('#'+prefix+'Screen').click();if(await p.evaluate(()=>!!document.fullscreenElement))await p.evaluate(()=>document.exitFullscreen());}
   check(tag+' '+mode+' cannot strand the original in a popout',await p.locator('#'+prefix+'Pop').isDisabled());
   await close.click();
  }
  await p.locator('#rcStep1').click();check(tag+' returns to Song & vocals',await p.evaluate(()=>RC.step==='rc'));
  const emptyState=await p.evaluate(async()=>{
   await persistNow();const db=await idb();const keys=await new Promise(r=>{const q=db.transaction('s').objectStore('s').getAllKeys();q.onsuccess=()=>r(q.result);});db.close();
   return {keys,flags:Object.keys(localStorage).filter(k=>/hadProject|songJournal/.test(k)),undo:SongStudio.getHistorySnapshots().length,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  check(tag+' browsing leaves project storage and undo untouched',!emptyState.keys.length&&!emptyState.flags.length&&!emptyState.undo&&await quiet());
  check(tag+' studio fits horizontally',emptyState.overflow<=2);
  await p.locator('#rcStep2').click();await p.locator('[data-tab=tune]').click();
  if(width===1280){
   await p.locator('#workspaceChoice').selectOption('notes');await p.locator('#workspaceExpand').click();
   const chooser=p.waitForEvent('filechooser');await p.locator('#dockNotes .studio-empty button').filter({hasText:'Import a vocal'}).click();await(await chooser).setFiles(wave());
   await p.waitForFunction(()=>!!SongPolish.state().binding&&!sessionLocked(),null,{timeout:60000});
   check('Import binds and retains the tuning workspace',await p.evaluate(()=>RC.step==='polish'&&DAW.dock==='notes'&&WorkWindows.state().open&&DAW.tab==='tune'&&!StudioBrowse.browsing()));
   const fr=p.frames().find(f=>f.url().includes('note-editor.html'));await fr.evaluate(()=>{try{localStorage.setItem('pvs.classicTools','1');}catch(_){}window.PlaybookUX?.apply?.();window.PlaybookUX?.show?.('tune');});await fr.locator('#presetSnapSmooth').click();check('Preset works on the imported take',await fr.evaluate(()=>PlaybookNoteEditor.analysis().notes.length>0));
   await p.locator('#workWindowClose').click();await p.locator('#rcStep1').click();const dl=p.waitForEvent('download');await p.locator('#sgSave').click();backup=await(await dl).path();
   // Save an external copy because closing the browser context removes its downloads.
   const fs=require('node:fs');backup={name:'test-project.zip',mimeType:'application/zip',buffer:fs.readFileSync(backup)};
  }else if(width===390){
   const chooser=p.waitForEvent('filechooser');await p.locator('#page-tune .studio-empty button').filter({hasText:'Open a project'}).click();await(await chooser).setFiles(backup);
   await p.waitForFunction(()=>!!SongPolish.state().binding&&!sessionLocked(),null,{timeout:60000});
   check('Open project fills the current POLISH tab',await p.evaluate(()=>RC.step==='polish'&&DAW.tab==='tune'&&SongCore.usage(S.song).takes===1));
  }else if(width===320){
   await p.evaluate(()=>{S.song.lead=0;});
   await p.locator('#page-tune .studio-empty button').filter({hasText:'Record a vocal'}).click();
   await p.waitForFunction(()=>SongStudio.state().recording);await p.waitForTimeout(950);await p.locator('#sgStop').click();
   await p.waitForFunction(()=>!!SongPolish.state().binding&&!sessionLocked(),null,{timeout:60000});
   check('Record, stop and return to tuning',await p.evaluate(()=>RC.step==='polish'&&DAW.tab==='tune'&&SongCore.usage(S.song).takes===1));
  }
  await p.context().close();
 }
});
