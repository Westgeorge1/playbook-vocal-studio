/* Browser handoff, live recording and responsive workspace regression.
 * Synthetic microphone through the real capture worklet; no physical-device claim.
 * PLAYWRIGHT_MODULE, PVS_CHROME and PVS_TEST_OUT may override local setup. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=process.env.PVS_TEST_OUT||path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
const rows=[],errors=[];let browser,server;
function check(name,pass){rows.push({name,pass:!!pass});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);}
const wait=p=>p.waitForFunction(()=>window.SongStudio&&window.AppWindow&&!S.loading&&!AppWindow.blocked(),null,{timeout:180000});
async function popup(p,ctx,mode='record'){
 await p.locator('#workspaceChoice').selectOption(mode);const next=ctx.waitForEvent('page');await p.locator('#workspacePop').click();const child=await next;
 await child.waitForURL(/handoff/);await wait(child);await child.waitForFunction(m=>WorkWindows.state().open&&WorkWindows.state().mode===m,mode,{timeout:180000});
 await p.waitForURL(/workspace-standby/);await p.waitForFunction(()=>!document.getElementById('standbyReturn').disabled);return child;
}
(async()=>{
 server=spawn('python3',['-m','http.server','8782','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});await new Promise(r=>setTimeout(r,500));
 browser=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});await ctx.route('https://**/*',r=>r.abort());
 await ctx.addInitScript(()=>{if(!navigator.mediaDevices)return;navigator.mediaDevices.getUserMedia=async()=>{const ac=new AudioContext(),osc=ac.createOscillator(),g=ac.createGain(),dest=ac.createMediaStreamDestination();g.gain.value=.15;osc.frequency.value=261.63;osc.connect(g).connect(dest);osc.start();await ac.resume();window.testMicStream=dest.stream;return dest.stream;};});
 ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const p=await ctx.newPage();await p.goto('http://127.0.0.1:8782/beta/');await wait(p);
 check('Four workspaces visible at the top',await p.locator('#workspaceChoice option').count()===4&&await p.locator('#workspacePop').isVisible());
 await p.evaluate(()=>{S.song.lead=0;SongStudio.render();window.originalRecord=document.getElementById('sgRecord');window.originalTimeline=document.getElementById('sgTimeline');});
 await p.locator('#sgRecord').click();await p.waitForFunction(()=>SongStudio.state().recording);
 await p.locator('#workspaceExpand').click();
 check('Recording can expand during a take',await p.evaluate(()=>SongStudio.state().recording&&WorkWindows.state().mode==='record'));
 check('Recording keeps the live controls and timeline',await p.evaluate(()=>originalRecord===document.getElementById('sgRecord')&&originalTimeline===document.getElementById('sgTimeline')));
 check('Expanded recording has a modal label',await p.locator('#songStudio').getAttribute('aria-labelledby')==='recordWindowTitle');
 await p.locator('#recordWindowMax').click();check('Maximized recording fills the viewport',await p.locator('#songStudio').evaluate(e=>Math.abs(e.clientWidth-innerWidth)<3&&Math.abs(e.clientHeight-innerHeight)<3));
 await p.locator('#recordWindowMax').click();const before=await p.locator('#songStudio').boundingBox();await p.locator('#recordWindowResize').focus();await p.keyboard.press('Shift+ArrowLeft');
 check('Keyboard resize works during recording',(await p.locator('#songStudio').boundingBox()).width<before.width-70&&await p.evaluate(()=>SongStudio.state().recording));
 await p.locator('#recordWindowClose').click();check('Docking does not stop the take',await p.evaluate(()=>SongStudio.state().recording&&!WorkWindows.state().open));
 await p.locator('#workspaceExpand').click();await p.keyboard.press('Escape');check('Escape docks recording without cancelling it',await p.evaluate(()=>SongStudio.state().recording&&!WorkWindows.state().open));
 await p.locator('#sgStop').click();await p.waitForFunction(()=>!SongStudio.locked());check('A real capture produces an audible saved take',await p.evaluate(()=>SongCore.usage(S.song).takes===1&&Object.values(S.song.sources).some(s=>s.channels[0].some(x=>Math.abs(x)>.01))));
 await p.locator('#workspaceExpand').click();await p.locator('#recordWindowUndo').click();check('Expanded recording Undo works',await p.evaluate(()=>SongCore.usage(S.song).takes===0));await p.locator('#recordWindowRedo').click();check('Expanded recording Redo restores the take',await p.evaluate(()=>SongCore.usage(S.song).takes===1));
 await p.locator('#recordWindowFocus').click();check('All recording controls restores file and section tools',await p.locator('#sgSave').isVisible()&&await p.locator('#sgAddSection').isVisible());await p.locator('#recordWindowFocus').click();
 await p.locator('#recordWindowScreen').click();check('Full screen enters or safely expands',await p.evaluate(()=>!!document.fullscreenElement||WorkWindows.state().maximized));await p.waitForFunction(()=>!!document.fullscreenElement||document.getElementById('workspaceStatus').textContent.includes('fill this browser'));await p.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});await p.waitForTimeout(200);
 await p.locator('#recordWindowClose').click();
 for(const [w,h] of [[390,844],[980,1760],[320,740],[844,390]]){
  await p.setViewportSize({width:w,height:h});await p.locator('#workspaceExpand').click();const box=await p.locator('#songStudio').boundingBox(),close=await p.locator('#recordWindowClose').boundingBox();
  check(w+'×'+h+' recording fits the viewport',box.x>=-1&&box.y>=-1&&box.x+box.width<=w+1&&box.y+box.height<=h+1);
  check(w+'×'+h+' return button is reachable',close.x>=0&&close.x+close.width<=w+1&&close.y>=0&&close.y+close.height<=h);
  check(w+'×'+h+' focused recording exposes the timeline',await p.locator('#sgTimeline').isVisible());
  await p.locator('#sgJumpVocal').click();await p.screenshot({path:path.join(out,'recording-'+w+'.png')});await p.locator('#recordWindowClose').click();
 }
 await p.setViewportSize({width:1440,height:1000});
 // A blocked popup never parks the working studio.
 await p.evaluate(()=>{window.realOpen=window.open;window.open=()=>null;});await p.locator('#workspacePop').click();check('Blocked popup falls back to expansion with explanation',await p.evaluate(()=>!AppWindow.blocked()&&WorkWindows.state().open&&document.getElementById('workspaceStatus').textContent.includes('blocked')));await p.evaluate(()=>{window.open=realOpen;});await p.locator('#recordWindowClose').click();
 // A failing write must keep the current session open.
 await p.evaluate(()=>{window.realWrite=writeRemembered;writeRemembered=()=>Promise.reject(Error('test save failure'));});await p.locator('#workspacePop').click();await p.waitForFunction(()=>!AppWindow.blocked());
 check('Save failure keeps the original project active',await p.evaluate(()=>SongCore.usage(S.song).takes===1&&document.getElementById('workspaceStatus').textContent.includes('test save failure')));await p.evaluate(()=>{writeRemembered=realWrite;});
 // Pause the child restore briefly to inspect write protection in the original.
 await ctx.route('**/beta/?*handoff*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const last=await restoreWithWatchdog();','await new Promise(r=>setTimeout(r,1500));const last=await restoreWithWatchdog();')});});
 const childPromise=ctx.waitForEvent('page');await p.locator('#workspacePop').click();const child=await childPromise;await child.waitForURL(/handoff/);
 check('Original is locked while the child restores',await p.evaluate(()=>AppWindow.blocked()&&sessionLocked()));
 check('Original cannot overwrite the shared autosave',await p.evaluate(async()=>await writeRemembered(null)===false));
 await wait(child);await p.waitForURL(/workspace-standby/);await p.waitForFunction(()=>!document.getElementById('standbyReturn').disabled);await ctx.unroute('**/beta/?*handoff*');
 check('Original releases the audio engine while standing by',await p.evaluate(()=>typeof SongStudio==='undefined'&&typeof worker==='undefined'));
 check('Separate window restores the recording',await child.evaluate(()=>SongCore.usage(S.song).takes===1));
 await child.evaluate(()=>{SongStudio.edit(w=>{w.title='Window changes';w.tracks[0].name='Pop-out vocal';},'Window changes');S.song.lead=0;SongStudio.render();});
 await child.locator('#sgRecord').click();await child.waitForFunction(()=>SongStudio.state().recording);await child.waitForTimeout(1000);
 await child.locator('#songStudio .ww-return-main').click();await p.waitForURL(/beta\/\?v/);await wait(p);
 check('Returning during recording stops and keeps the new take',await p.evaluate(()=>SongCore.usage(S.song).takes===2));check('Returning preserves project and track edits',await p.evaluate(()=>S.song.title==='Window changes'&&S.song.tracks[0].name==='Pop-out vocal'));
 check('Return closes the separate window',child.isClosed());
 // The browser X close is recovered through the standby, after autosave.
 const second=await popup(p,ctx);await second.evaluate(async()=>{SongStudio.edit(w=>w.title='Closed-window save','Rename');await persistNow();});await second.close();await p.waitForURL(/beta\/\?v/);await wait(p);
 check('Closing the separate window restores its latest autosave',await p.evaluate(()=>S.song.title==='Closed-window save'));
 // The same handoff works with a loaded tuning engine and its iframe settings.
 const tuning=await popup(p,ctx,'notes');await tuning.waitForFunction(()=>!sessionLocked(),null,{timeout:180000});const fr=tuning.frames().find(f=>f.url().includes('note-editor.html'));
 check('Separate tuning window opens the live note editor',!!fr);await fr.locator('#presetSnapSmooth').click();await tuning.waitForFunction(()=>!sessionLocked(),null,{timeout:180000});
 const tuned=await fr.evaluate(()=>JSON.stringify(PlaybookNoteEditor.state()));await tuning.locator('#dock .ww-return-main').click();await p.waitForURL(/beta\/\?v/);await wait(p);await p.locator('#workspaceChoice').selectOption('notes');await p.locator('#workspaceExpand').click();await p.waitForFunction(()=>WorkWindows.state().open&&WorkWindows.state().mode==='notes'&&!sessionLocked(),null,{timeout:180000});
 const restored=p.frames().find(f=>f.url().includes('note-editor.html'));check('Tuning edits survive returning to the original tab',await restored.evaluate(()=>JSON.stringify(PlaybookNoteEditor.state()))===tuned);await p.locator('#workWindowClose').click();await p.evaluate(()=>RC.go('rc'));
 // A refused restore never makes the child a writer or discards the original state.
 await ctx.route('**/beta/?*handoff*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const last=await restoreWithWatchdog();',"throw Error('test restore failure');const last=await restoreWithWatchdog();")});});
 await p.locator('#workspaceChoice').selectOption('record');await p.locator('#workspacePop').click();await p.waitForFunction(()=>!AppWindow.blocked(),null,{timeout:20000});
 check('Child restore failure leaves original studio usable',await p.evaluate(()=>document.getElementById('workspaceStatus').textContent.includes('could not open')&&SongCore.usage(S.song).takes===2));await ctx.unroute('**/beta/?*handoff*');
 // Reloads authenticate against the parked tab and retain a single writer.
 const reloaded=await popup(p,ctx);await reloaded.reload();await wait(reloaded);check('Reloading the popup reconnects to the standby',await reloaded.evaluate(()=>!AppWindow.blocked()&&SongCore.usage(S.song).takes===2));await p.reload();await p.locator('#standbyReturn').waitFor();
 await reloaded.evaluate(()=>{window.goodWrite=writeRemembered;writeRemembered=()=>Promise.reject(Error('return save failure'));});await p.locator('#standbyReturn').click();await reloaded.waitForFunction(()=>!AppWindow.blocked());
 check('Failed return save leaves the workspace open',!reloaded.isClosed()&&await reloaded.evaluate(()=>document.getElementById('workspaceStatus').textContent.includes('return save failure')));
 await reloaded.evaluate(()=>{writeRemembered=goodWrite;});await p.locator('#standbyReturn').click();await p.waitForURL(/beta\/\?v/);await wait(p);check('Reloaded standby reconnects and returns safely',await p.evaluate(()=>SongCore.usage(S.song).takes===2));
 for(const mode of ['wave','ref']){const other=await popup(p,ctx,mode);check(mode+' opens in a separate browser window',await other.evaluate(m=>WorkWindows.state().mode===m,mode));await other.locator('#dock .ww-return-main').click();await p.waitForURL(/beta\/\?v/);await wait(p);}
 await ctx.route('**/beta/?*handoff*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const last=await restoreWithWatchdog();','await new Promise(r=>setTimeout(r,3000));const last=await restoreWithWatchdog();')});});
 await p.locator('#workspaceChoice').selectOption('record');const cancelNext=ctx.waitForEvent('page');await p.locator('#workspacePop').click();const cancelled=await cancelNext;await cancelled.waitForURL(/handoff/);await p.locator('#handoffCancel').click();check('Cancelling a handoff keeps the original session',await p.evaluate(()=>!AppWindow.blocked()&&SongCore.usage(S.song).takes===2));if(!cancelled.isClosed())await cancelled.waitForEvent('close');await ctx.unroute('**/beta/?*handoff*');
 const alone=await popup(p,ctx);await p.close();await alone.locator('#songStudio .ww-return-main').click();check('Closing the original tab leaves a usable independent studio',await alone.evaluate(()=>!AppWindow.isChild()&&!AppWindow.blocked()&&SongCore.usage(S.song).takes===2&&document.getElementById('workspacePop').hidden===false));await alone.close();
 const invalid=await ctx.newPage();await invalid.goto('http://127.0.0.1:8782/beta/?handoff=invalid&workspace=record');await invalid.locator('#workspaceHandoff').waitFor();check('Expired popup links cannot become autosave writers',await invalid.evaluate(()=>AppWindow.blocked()));await invalid.close();
 check('No browser JavaScript errors',errors.length===0);await ctx.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'workspace-results.json'),JSON.stringify({rows,errors},null,2));await browser?.close();server?.kill();});
