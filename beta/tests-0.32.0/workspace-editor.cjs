/* 0.31.13 regression: workspace selector, Escape ownership, remembered layout, title-bar Play,
 * wide tuning layout, phone focus, vertical zoom / Fit, shortcuts, reference-pitch note,
 * backing tuning match, collapsible panels, knob readout, help button.
 * PLAYWRIGHT_MODULE, PVS_CHROME and PVS_TEST_OUT may override local setup. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const APP=path.resolve(__dirname,'..'),OUT=process.env.PVS_TEST_OUT||path.join(__dirname,'results');fs.mkdirSync(OUT,{recursive:true});
const rows=[],errors=[];let b,server;const PORT=8791,URL=`http://127.0.0.1:${PORT}/index.html`;
function check(name,value,detail){rows.push({name,pass:!!value,detail});console.log((value?'PASS ':'FAIL ')+name+(detail!==undefined?' '+JSON.stringify(detail):''));}
const sleep=t=>new Promise(r=>setTimeout(r,t));
const idle=p=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked()&&!NoiseCleaner.locked(),null,{timeout:240000});
async function boot(ctx,{fresh=true}={}){
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(URL);
 await p.waitForFunction(()=>window.WorkWindows&&window.SongStudio&&!S.loading,null,{timeout:180000});
 if(fresh){
  await p.evaluate(()=>{const C=SongCore,R=48000;S.song=C.empty(R);S.song.key=0;S.song.scale=1;const a=new Float32Array(R*4);for(let i=0;i<a.length;i++){const t=i/R,f=[261.63,293.66,329.63,261.63][Math.floor(t)];a[i]=.2*Math.sin(2*Math.PI*f*t)*Math.min(1,(t%1)*30,(1-t%1)*30);}SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:4,channels:[a],origin:0,choose:true}),'0.31.13 test');});
  await p.evaluate(()=>SongPolish.open(S.song.tracks[0].id));await idle(p);
 }else{
  await p.waitForFunction(()=>S.song?.tracks?.[0]?.takes?.length||S.song?.tracks?.some(t=>t.takes?.length),null,{timeout:60000}).catch(()=>{});
  await p.evaluate(()=>RC.step==='rc'?SongPolish.open(S.song.tracks[0].id):true);await idle(p);
 }
 await p.evaluate(()=>showPage('tune'));await sleep(800);
 const fr=()=>p.frames().find(f=>f.url().includes('note-editor.html'));
 return {p,fr};
}
const rollPng=fr=>fr().evaluate(()=>document.getElementById('roll').toDataURL());
(async()=>{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory',APP],{stdio:'ignore'});await sleep(700);
 b=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'],headless:true});

 /* ---------- laptop 1280 x 720 ---------- */
 let ctx=await b.newContext({viewport:{width:1280,height:720}});await ctx.route('https://**/*',r=>r.abort());
 let {p,fr}=await boot(ctx);
 check('Workspace selector follows POLISH (shows Vocal tuning, not Recording)',await p.locator('#workspaceChoice').inputValue()==='notes');
 await p.locator('#workspaceExpand').click();await sleep(600);
 check('Expand from POLISH opens tuning and stays in POLISH',await p.evaluate(()=>WorkWindows.state().open&&WorkWindows.state().mode==='notes'&&RC.step!=='rc'));
 check('Short laptop screen opens tuning maximized the first time',await p.evaluate(()=>WorkWindows.state().maximized));
 const lap=await fr().evaluate(()=>{const r=document.getElementById('roll').getBoundingClientRect(),n=document.getElementById('notePanel').getBoundingClientRect();return{top:r.top,h:r.height,bottom:r.bottom,right:r.right,inner:innerHeight,nl:n.left,nt:n.top};});
 check('Piano roll fully visible and at least 300 px tall at 1280x720',lap.bottom<=lap.inner&&lap.h>=300,lap);
 check('Selected-note inspector sits beside the piano roll',lap.nl>=lap.right&&lap.nt<lap.top+40,lap);
 await p.screenshot({path:path.join(OUT,'tuning-laptop-1280x720.png')});

 // Title-bar Play / pause drives the editor's own audition
 await p.locator('#workWindowPlay').click();await sleep(700);
 check('Title-bar Play starts tuning playback',await fr().evaluate(()=>/pause/i.test(document.getElementById('playLabel').textContent)));
 await p.locator('#workWindowPlay').click();await sleep(300);
 check('Title-bar Play pauses again',await fr().evaluate(()=>/play/i.test(document.getElementById('playLabel').textContent)));

 // Escape ownership: a selected note is deselected first, the window stays open
 await fr().evaluate(()=>document.getElementById('selAll').click());await sleep(200);
 check('Notes selected before Escape',await fr().evaluate(()=>PlaybookNoteEditor.consumesEscape()));
 await fr().locator('#status').click();
 await p.keyboard.press('Escape');await sleep(250);
 check('Escape with a note selected keeps the tuning window open',await p.evaluate(()=>WorkWindows.state().open));
 check('Escape deselected the notes',!(await fr().evaluate(()=>PlaybookNoteEditor.consumesEscape())));
 await fr().evaluate(()=>document.getElementById('selAll').click());await p.locator('#workWindowTitle').click();await p.keyboard.press('Escape');await sleep(250);
 check('Escape after clicking the title bar also deselects first',await p.evaluate(()=>WorkWindows.state().open)&&!(await fr().evaluate(()=>PlaybookNoteEditor.consumesEscape())));
 await fr().locator('#status').click();
 // Keyboard shortcuts dialog: ? opens, Escape closes it but not the window
 await p.keyboard.press('?');await sleep(200);
 check('? opens the keyboard shortcuts',await fr().evaluate(()=>document.getElementById('keysDlg').open));
 await p.keyboard.press('Escape');await sleep(250);
 check('Escape closes the shortcuts, not the window',!(await fr().evaluate(()=>document.getElementById('keysDlg').open))&&await p.evaluate(()=>WorkWindows.state().open));

 // Vertical zoom, Alt+wheel and Fit change the piano-roll view
 let before=await rollPng(fr);await fr().locator('#vIn').click();await sleep(150);
 check('Taller rows button changes the view',(await rollPng(fr))!==before);
 before=await rollPng(fr);const box=await fr().locator('#roll').boundingBox();const fb=await p.locator('#noteEditorFrame').boundingBox();
 await p.mouse.move(fb.x+box.x+box.width/2,fb.y+box.y+box.height/2);await p.keyboard.down('Alt');await p.mouse.wheel(0,-240);await p.keyboard.up('Alt');await sleep(150);
 check('Alt + wheel zooms rows vertically',(await rollPng(fr))!==before);
 before=await rollPng(fr);await p.keyboard.press('f');await sleep(150);
 check('F fits the notes in view',(await rollPng(fr))!==before);
 before=await rollPng(fr);await fr().locator('#zFit').click();await sleep(150);
 check('Fit button is idempotent after F',(await rollPng(fr))===before);

 // Reference-pitch note
 check('No reference warning at A = 440',await fr().evaluate(()=>document.getElementById('refWarn').hidden));
 await fr().evaluate(()=>{const i=document.getElementById('refHz');i.value='430.1';i.dispatchEvent(new Event('change'));});await sleep(200);
 const warn=await fr().evaluate(()=>({shown:!document.getElementById('refWarn').hidden,text:document.getElementById('refWarnText').textContent,match:!document.getElementById('refMatch').hidden}));
 check('Reference far from 440 shows a warning with the cents',warn.shown&&/39¢ flat/.test(warn.text),warn);
 check('Match backing hidden when the song has no backing',!warn.match);
 await fr().locator('#refUse440').click();await sleep(200);
 check('Use A = 440 sets the reference and hides the warning',await fr().evaluate(()=>document.getElementById('refHz').value==='440.0'&&document.getElementById('refWarn').hidden));
 await fr().locator('#undo').click();await sleep(200);
 check('Undo brings the previous reference back',await fr().evaluate(()=>document.getElementById('refHz').value==='430.1'));
 await fr().locator('#refKeep').click();await sleep(100);
 check('Keep mine hides the warning',await fr().evaluate(()=>document.getElementById('refWarn').hidden));

 // Backing: tuning match is offered and works in the embedded editor
 await fr().evaluate(()=>{const R=44100,a=new Float32Array(R*3);const f=440*Math.pow(2,-30/1200);for(let i=0;i<a.length;i++){const t=i/R;a[i]=.25*(Math.sin(2*Math.PI*f*t)+.5*Math.sin(2*Math.PI*f*1.5*t)+.4*Math.sin(2*Math.PI*f*2*t));}PlaybookNoteEditor.backing([a],R);});await sleep(300);
 check('Backing row and Match tuning appear when the song has a backing',await fr().evaluate(()=>!document.querySelector('.riddim').classList.contains('noBacking')&&getComputedStyle(document.getElementById('rTune')).display!=='none'));
 await fr().locator('#rTune').click();await fr().waitForFunction(()=>/Riddim|tuning|Couldn/.test(document.getElementById('rTuneOut').textContent),null,{timeout:30000});
 const tuned=await fr().evaluate(()=>({hz:+document.getElementById('refHz').value,msg:document.getElementById('rTuneOut').textContent}));
 check('Match tuning reads a 30¢-flat backing (about A = 432.4)',Math.abs(tuned.hz-432.4)<1.2,tuned);
 await fr().evaluate(()=>PlaybookNoteEditor.backing(null));await sleep(150);

 // Collapsible settings panels
 await fr().locator('#tuningPresets .phead h2').click();await sleep(100);
 check('Settings panel collapses from its heading',await fr().evaluate(()=>document.getElementById('tuningPresets').classList.contains('collapsed')&&document.getElementById('presetSnapSmooth').getClientRects().length===0));
 // Knob readout, formant labels
 const knob=await fr().evaluate(()=>{const l=document.getElementById('kPtr');return Math.hypot(+l.getAttribute('x1')-60,+l.getAttribute('y1')-60);});
 check('Smooth knob tick starts outside the % readout',knob>=23,knob);
 check('Formant labels say this note / whole vocal',await fr().evaluate(()=>/this note/.test(document.querySelector('label[for=nFmt]').textContent)&&/whole vocal/.test(document.querySelector('label[for=gFmt]').textContent)));

 // Remembered layout: restore size, resize, then reload
 await p.locator('#workWindowMax').click();await sleep(200);
 const h=await p.locator('#workWindowResize').boundingBox();await p.mouse.move(h.x+h.width/2,h.y+h.height/2);await p.mouse.down();await p.mouse.move(h.x-150,h.y-60,{steps:5});await p.mouse.up();await sleep(200);
 const size1=await p.locator('#dock').boundingBox();
 await p.locator('#workWindowFocus').click();await sleep(150);
 await p.keyboard.press('Escape');await sleep(250);
 check('Escape with nothing selected still returns to studio',!(await p.evaluate(()=>WorkWindows.state().open)));
 check('Window layout saved on this device',await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('pvs.workWindows.v1')||'{}');return !!v.sizes?.notes&&v.focus?.notes===true;}));
 await p.close();
 ({p,fr}=await boot(ctx,{fresh:false}));
 await p.evaluate(()=>WorkWindows.open('notes'));await sleep(500);
 const size2=await p.locator('#dock').boundingBox();
 check('Reopened window keeps its size after reload',Math.abs(size1.width-size2.width)<4&&Math.abs(size1.height-size2.height)<4,{size1,size2});
 check('Reopened window keeps Focus notes after reload',await p.locator('#workWindowFocus').getAttribute('aria-pressed')==='true');
 check('Collapsed panel remembered after reload',await fr().evaluate(()=>document.getElementById('tuningPresets').classList.contains('collapsed')));
 await fr().locator('#tuningPresets .phead h2').click().catch(()=>{});
 await p.close();await ctx.close();

 /* ---------- desktop 1440 x 900 ---------- */
 ctx=await b.newContext({viewport:{width:1440,height:900}});await ctx.route('https://**/*',r=>r.abort());({p,fr}=await boot(ctx));
 await p.locator('#noteRouteOpen').click();await sleep(600);
 check('Desktop opens as a movable window (not maximized)',await p.evaluate(()=>WorkWindows.state().open&&!WorkWindows.state().maximized));
 const desk=await fr().evaluate(()=>{const r=document.getElementById('roll').getBoundingClientRect();return{h:r.height,bottom:r.bottom,inner:innerHeight};});
 check('Desktop piano roll fully visible and at least 340 px tall',desk.bottom<=desk.inner&&desk.h>=340,desk);
 check('Help is a round ? button without a disclosure arrow',await p.evaluate(()=>{const s=document.querySelector('#workspaceTools summary');return getComputedStyle(s).listStyleType==='none'&&s.getBoundingClientRect().width<=34;}));
 await p.screenshot({path:path.join(OUT,'tuning-desktop-1440x900.png')});
 await p.locator('#workWindowClose').click();await sleep(200);
 await p.evaluate(()=>RC.go('rc'));await sleep(300);
 check('Selector shows Recording on Song & vocals',await p.locator('#workspaceChoice').inputValue()==='record');
 await p.close();await ctx.close();

 /* ---------- phone 390 x 844 ---------- */
 ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});await ctx.route('https://**/*',r=>r.abort());({p,fr}=await boot(ctx));
 await p.locator('#noteRouteOpen').click();await sleep(700);
 check('Phone opens tuning in Focus notes',await p.locator('#workWindowFocus').getAttribute('aria-pressed')==='true');
 const ph=await fr().evaluate(()=>{const r=document.getElementById('roll').getBoundingClientRect();return{top:r.top,h:r.height,inner:innerHeight};});
 const ifr=await p.locator('#noteEditorFrame').boundingBox();
 check('Phone piano roll is at least 280 px tall and starts in the top half',ph.h>=280&&ph.top<ph.inner*.5,ph);
 check('Phone tuning fills the screen',Math.abs(ifr.width-390)<6);
 await p.screenshot({path:path.join(OUT,'tuning-phone-390x844.png')});
 await p.close();await ctx.close();

 await b.close();server.kill();
 const failed=rows.filter(r=>!r.pass).length;
 fs.writeFileSync(path.join(OUT,'workspace-editor-results.json'),JSON.stringify({rows,errors},null,1));
 console.log(`${rows.length-failed} passed, ${failed} failed, ${errors.length} page errors`);if(errors.length)console.log(errors.slice(0,5));
 process.exit(failed||errors.length?1:0);
})().catch(e=>{console.error(e);try{server.kill();}catch(_){}process.exit(1);});
