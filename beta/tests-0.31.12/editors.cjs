/* Real browser regression: workspace geometry, live iframe, edits and focus. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const APP=path.resolve(__dirname,'..'),OUT=process.env.PVS_TEST_OUT||path.join(__dirname,'results');fs.mkdirSync(OUT,{recursive:true});
const rows=[],errors=[];let b,server;
function check(name,value,detail){rows.push({name,pass:!!value,detail});console.log((value?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));}
const sleep=t=>new Promise(r=>setTimeout(r,t));
(async()=>{
 server=spawn('python3',['-m','http.server','8753','--bind','127.0.0.1','--directory',APP],{stdio:'ignore'});await sleep(600);
 b=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'],headless:true});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});await ctx.route('https://**/*',r=>r.abort());const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:8753/index.html');
 await p.waitForFunction(()=>window.WorkWindows&&window.SongStudio&&!S.loading);
 await p.evaluate(()=>{const C=SongCore,R=48000;S.song=C.empty(R);S.song.key=0;S.song.scale=1;const a=new Float32Array(R*3);for(let i=0;i<a.length;i++){const t=i/R,f=[261.6,293.7,329.6][Math.floor(t)];a[i]=.2*Math.sin(2*Math.PI*f*t)*Math.min(1,(t%1)*30,(1-t%1)*30);}SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:3,channels:[a],origin:0,choose:true}),'Window test');});
 await p.evaluate(()=>SongPolish.open(S.song.tracks[0].id));await p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked()&&!NoiseCleaner.locked(),null,{timeout:180000});
 await p.evaluate(()=>showPage('tune'));const fr=p.frames().find(f=>f.url().includes('note-editor.html'));assert(fr,'note iframe exists');
 await fr.evaluate(()=>{window._workspaceToken='live-frame';});await fr.locator('#presetSnapSmooth').click();await p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});
 const before=await fr.evaluate(()=>JSON.stringify(PlaybookNoteEditor.state()));const audio=await p.evaluate(()=>SongCore.hashPcm(S.final));const widthBefore=await p.locator('#noteEditorFrame').evaluate(e=>e.clientWidth);
 await p.locator('#noteRouteOpen').click();await sleep(100);
 check('Tuning opens as a dialog',await p.locator('#dock').getAttribute('role')==='dialog');
 check('Tuning gains at least 250 pixels of width',await p.locator('#noteEditorFrame').evaluate(e=>e.clientWidth)>widthBefore+250);
 check('Live note iframe is never reloaded',await fr.evaluate(()=>window._workspaceToken==='live-frame'));
 await p.locator('#workWindowMax').click();check('Maximize fills the browser',await p.locator('#dock').evaluate(e=>Math.abs(e.clientWidth-innerWidth)<3&&Math.abs(e.clientHeight-innerHeight)<3));await p.locator('#workWindowMax').click();
 const r0=await p.locator('#dock').boundingBox(),handle=await p.locator('#workWindowResize').boundingBox();await p.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await p.mouse.down();await p.mouse.move(handle.x-180,handle.y-100,{steps:5});await p.mouse.up();const r1=await p.locator('#dock').boundingBox();check('Corner drag resizes window',r1.width<r0.width-100&&r1.height<r0.height-60);
 const title=await p.locator('#workWindowTitle').boundingBox();await p.mouse.move(title.x+40,title.y+10);await p.mouse.down();await p.mouse.move(title.x+100,title.y+50,{steps:5});await p.mouse.up();const r2=await p.locator('#dock').boundingBox();check('Title drag moves window',Math.abs(r2.x-r1.x)>20&&r2.y>r1.y+20);
 await p.locator('#workWindowResize').focus();await p.keyboard.press('ArrowRight');check('Resize supports keyboard',(await p.locator('#dock').boundingBox()).width>r2.width+15);
 await p.locator('#workWindowMax').click();await fr.evaluate(()=>scrollTo(0,0));await p.locator('#workWindowFocus').click();
 check('Focus notes keeps playback and tools visible',await fr.locator('#play').isVisible()&&await fr.locator('#toolTime').isVisible()&&!await fr.locator('#tuningPresets').isVisible());
 await p.screenshot({path:path.join(OUT,'tuning-desktop.png')});await p.locator('#workWindowFocus').click();
 check('All tuning controls restores presets',await fr.locator('#tuningPresets').isVisible());
 check('Size changes preserve all note edits',await fr.evaluate(()=>JSON.stringify(PlaybookNoteEditor.state()))===before);
 check('Size changes preserve rendered audio',await p.evaluate(()=>SongCore.hashPcm(S.final))===audio);
 const point=await fr.evaluate(()=>{const c=document.getElementById('roll'),scale=c.width/c.clientWidth,x=76,ys=c.getContext('2d').getImageData(Math.round(x*scale),0,1,c.height).data;for(let y=24*scale;y<c.height;y++){const j=Math.round(y)*4;if(ys[j]>60&&ys[j+1]>120&&ys[j+2]>90)return {x,y:y/scale+4};}throw Error('No note drawn at the expected fixture position');});await fr.locator('#roll').click({position:point});await fr.locator('#nUp').click();await p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});
 check('Individual-note correction applies in work window',await fr.evaluate(()=>!!PlaybookNoteEditor.state().settings.notes[0][11]));await fr.locator('#undo').click();await p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});check('Note Undo restores earlier tuning',await fr.evaluate(()=>JSON.stringify(PlaybookNoteEditor.state()))===before);
 await p.locator('#workWindowClose').click();check('Return docks without losing edits',await fr.evaluate(()=>JSON.stringify(PlaybookNoteEditor.state()))===before&&!await p.locator('#dock').getAttribute('role'));
 check('Return restores launcher focus',await p.evaluate(()=>document.activeElement.id==='noteRouteOpen'));
 check('Background controls unlock',await p.locator('#rcStep1').evaluate(e=>!e.closest('[inert]')));
 await p.locator('#noteRouteOpen').click();await fr.locator('#play').focus();await p.keyboard.press('Escape');check('Escape works inside the embedded tuner',!(await p.evaluate(()=>WorkWindows.state().open)));
 await p.evaluate(()=>WorkWindows.open('wave'));await p.locator('#selStart').fill('0.3');await p.locator('#selStart').dispatchEvent('change');await p.locator('#selEnd').fill('0.8');await p.locator('#selEnd').dispatchEvent('change');await p.locator('#editZoom').click();const selection=await p.evaluate(()=>JSON.stringify({sel:S.edit.sel,view:S.edit.view}));
 await p.locator('#workWindowMax').click();await p.locator('#workWindowMax').click();check('Waveform selection and zoom survive maximize',selection===await p.evaluate(()=>JSON.stringify({sel:S.edit.sel,view:S.edit.view})));
 await p.locator('#breathApply').click();await p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});check('Audio edits work in expanded window',await p.evaluate(()=>S.st.edits.breaths?.length>0||S.st.edits.breath?.length>0),await p.evaluate(()=>S.st.edits));
 await p.locator('#dock .dbody').evaluate(e=>e.scrollTop=0);await p.screenshot({path:path.join(OUT,'editing-desktop.png')});
 await p.locator('#polishBackToControls').click();check('Sound controls leaves the work window',!await p.evaluate(()=>WorkWindows.state().open));await p.locator('#polishWave').click();check('Top editing action opens the work window',await p.evaluate(()=>WorkWindows.state().open&&WorkWindows.state().mode==='wave'));
 await p.locator('#workWindowClose').focus();await p.keyboard.press('Tab');check('Keyboard focus stays in work window',await p.evaluate(()=>!!document.activeElement.closest('#dock')));
 await p.locator('[data-dock="ref"]').click();check('Reference comparison has its own expanded view',await p.locator('#workWindowTitle').textContent()==='Reference comparison');
 for(const [w,h] of [[768,1024],[390,844],[320,740],[844,390]]){
  await p.setViewportSize({width:w,height:h});
  for(const mode of ['notes','wave','ref']){
   await p.locator('[data-dock="'+mode+'"]').click();await sleep(80);
   const bounds=await p.locator('#dock').boundingBox();const close=await p.locator('#workWindowClose').boundingBox();
   check(mode+' window stays within '+w+'×'+h,bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=w+1&&bounds.y+bounds.height<=h+1);
   check(mode+' Return stays visible '+w,close.x>=0&&close.y>=0&&close.x+close.width<=w+1&&close.y+close.height<=h);
   check(mode+' content fits width '+w,await p.locator('#dock .dbody').evaluate(e=>e.scrollWidth<=e.clientWidth+2));
   if(mode==='notes')check('Tuner content fits width '+w,await fr.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   if(w===390&&mode==='notes'){await p.locator('#workWindowFocus').click();const roll=await fr.locator('#roll').boundingBox();const iframe=await p.locator('#noteEditorFrame').boundingBox();check('Phone focus view exposes the note canvas',roll.y<iframe.y+iframe.height*.55&&roll.height>250);await p.screenshot({path:path.join(OUT,'notes-phone.png')});await p.locator('#workWindowFocus').click();}
   if(w===390&&mode==='wave')await p.screenshot({path:path.join(OUT,'wave-phone.png')});
  }
 }
 console.log('STAGE close mobile');await p.locator('#workWindowClose').click();console.log('STAGE resize desktop');await p.setViewportSize({width:1440,height:1000});console.log('STAGE return song');await p.evaluate(()=>RC.go('rc'));console.log('STAGE take editor');
 await p.locator('#sgTakes [data-edit]').first().click();await p.locator('#sgEditMaximize').click();check('Take editor maximizes',await p.locator('#songDialog').evaluate(e=>e.classList.contains('ww-take-max')&&e.clientWidth>innerWidth*.95));
 await p.locator('#songDialog [name="gainDb"]').fill('-2');await p.locator('#songDialog [data-action="ok"]').click();check('Take edit Apply still saves',await p.evaluate(()=>S.song.tracks[0].regions[0].takes[0].gainDb===-2));
 await p.locator('#sgTakes [data-edit]').first().click();check('Take editor reopens at normal size',!await p.locator('#songDialog').evaluate(e=>e.classList.contains('ww-take-max')));await p.locator('#songDialog [name="gainDb"]').fill('-7');await p.locator('#songDialog [data-action="cancel"]').click();check('Take edit Cancel leaves saved value',await p.evaluate(()=>S.song.tracks[0].regions[0].takes[0].gainDb===-2));
 console.log('STAGE restore test');await p.locator('#sgPolish').click();if(await p.locator('#songDialog').isVisible())await p.locator('#songDialog [data-action="ok"]').click();await p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});await p.evaluate(()=>WorkWindows.open('notes'));await p.locator('#workWindowClose').click();
 const stored=await p.evaluate(async()=>{SongPolish.capture();cancelPersist();await writeRemembered(sessionSnapshot());return JSON.stringify(NoteTuner.state().editor.settings);});await p.reload();await p.waitForFunction(()=>window.SongStudio&&!S.loading&&!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});await p.evaluate(()=>SongPolish.open(S.song.activeTrack));await p.waitForFunction(()=>!sessionLocked(),null,{timeout:180000});check('Project reload retains tuning after work windows',await p.evaluate(()=>JSON.stringify(NoteTuner.state().editor.settings))===stored);
 await p.evaluate(()=>WorkWindows.open('wave'));await p.evaluate(()=>{S.phrases=PhraseCore.empty(S.rate);const t={id:'t2',name:'Legacy test take',rate:S.rate,channels:S.audio[5].map(c=>c.slice()),origin:0,offsetMs:0,gainDb:0,rating:0};S.phrases.phrases=[{id:'p1',name:'Test part',start:0,end:3,selected:'t2',reference:null,takes:[t]}];S.phrases.selected='p1';S.phrases.nextId=3;Studio.edit('t2');});
 check('Legacy take dialog remains usable from expanded editing',await p.locator('#veMaximize').isVisible()&&!await p.evaluate(()=>document.getElementById('vocalEditor').closest('[inert]')));const oldSpan=await p.evaluate(()=>JSON.stringify(Studio.state()));await p.locator('#veMaximize').click();await sleep(150);check('Legacy take editor redraws at maximized size',await p.locator('#veCanvas').evaluate(e=>e.width===Math.round(e.clientWidth*Math.min(2,devicePixelRatio))&&e.height===Math.round(e.clientHeight*Math.min(2,devicePixelRatio))&&e.clientHeight>350));check('Legacy take selection survives maximize',await p.evaluate(()=>JSON.stringify(Studio.state()))===oldSpan);await p.locator('#veMaximize').click();await p.locator('#veClose').click();
 check('No JavaScript errors in UI workflows',!errors.length,errors);
})().catch(e=>{check('Browser workflow completed',false,String(e));console.error(e);}).finally(async()=>{await b?.close();server?.kill();fs.writeFileSync(path.join(OUT,'windows.json'),JSON.stringify(rows,null,2));console.log(rows.filter(r=>r.pass).length+' passed, '+rows.filter(r=>!r.pass).length+' failed');process.exitCode=rows.some(r=>!r.pass)?1:0;});
