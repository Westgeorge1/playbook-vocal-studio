/* 0.32.5 drag-and-resize regression: POLISH panel splitters, Song & vocals track height and name column,
 * movable dialogs, floating work windows resized from any edge, the tuning window's settings column and
 * piano-roll height, keyboard resizing, reset, persistence, phones, and no project or autosave writes. */
const {suite}=require('../tests-0.32.4/browser.cjs');
suite('layout',12,async({page,check})=>{
 const box=async(p,sel)=>{const b=await p.locator(sel).first().boundingBox();return b&&{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
 const drag=async(p,x,y,dx,dy)=>{await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx/2,y+dy/2,{steps:4});await p.mouse.move(x+dx,y+dy,{steps:4});await p.mouse.up();await p.waitForTimeout(120);};
 const dragEl=async(p,sel,dx,dy)=>{const b=await box(p,sel);await drag(p,b.x+b.w/2,b.y+b.h/2,dx,dy);};
 const near=(a,b,t=3)=>Math.abs(a-b)<=t;
 const untouched=p=>p.evaluate(async()=>{await persistNow();const db=await idb();const keys=await new Promise(r=>{const q=db.transaction('s').objectStore('s').getAllKeys();q.onsuccess=()=>r(q.result);});db.close();return !keys.length&&!S.dirty&&!SongStudio.getHistorySnapshots().length;});

 /* ---------- 1. POLISH splitters (desktop) ---------- */
 let p=await page(1280,800);
 await p.locator('#rcStep2').click();await p.waitForTimeout(300);
 const i0=await box(p,'.work > .insp'),d0=await box(p,'#dock'),h0=await box(p,'#laneHeads');
 check('Original sizes are unchanged until you drag',i0.w===420&&near(h0.w,150)&&await p.evaluate(()=>!document.documentElement.style.cssText.includes('--pvs')));
 for(const s of ['.pvs-split-insp','.pvs-split-dock','.pvs-split-heads'])check('Handle visible and labelled: '+s,await p.locator(s).isVisible()&&await p.locator(s).getAttribute('role')==='separator'&&!!await p.locator(s).getAttribute('aria-label'));
 await dragEl(p,'.pvs-split-insp',-100,0);
 const i1=await box(p,'.work > .insp');check('Dragging the settings panel edge left widens it by the drag',near(i1.w,520,4),i1);
 await dragEl(p,'.pvs-split-dock',0,-80);
 const d1=await box(p,'#dock');check('Dragging the editor panel top up makes it taller',near(d1.h,d0.h+80,4),[d0.h,d1.h]);
 await dragEl(p,'.pvs-split-heads',40,0);
 const h1=await box(p,'#laneHeads');check('Dragging the track-name column edge widens it',near(h1.w,190,4),h1);
 check('Timeline and lanes keep fitting the page width',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await p.locator('.pvs-split-insp').focus();await p.keyboard.press('ArrowLeft');
 check('Arrow keys resize a focused handle',near((await box(p,'.work > .insp')).w,535,4));
 await p.keyboard.press('Shift+ArrowRight');check('Shift+arrow uses bigger steps',near((await box(p,'.work > .insp')).w,475,4));
 check('Handle reports its size to screen readers',near(+await p.locator('.pvs-split-insp').getAttribute('aria-valuenow'),475,4));
 check('Resizing panels leaves project storage, autosave and Undo untouched',await untouched(p));
 await p.reload();await p.waitForFunction(()=>window.StudioBrowse&&window.SongStudio&&!S.loading);await p.locator('#rcStep2').click();await p.waitForTimeout(300);
 check('Panel sizes persist after reload',near((await box(p,'.work > .insp')).w,475,4)&&near((await box(p,'#laneHeads')).w,190,4)&&near((await box(p,'#dock')).h,d1.h,4));
 await p.locator('.pvs-split-heads').dblclick();check('Double-click resets one handle',near((await box(p,'#laneHeads')).w,150,3)&&near((await box(p,'.work > .insp')).w,475,4));
 await p.locator('.pvs-split-insp').focus();await p.keyboard.press('Home');check('Home key resets a focused handle',(await box(p,'.work > .insp')).w===420);
 await dragEl(p,'.pvs-split-insp',-5000,0);check('Settings panel cannot squeeze the timeline below its minimum',(await box(p,'.work > .insp')).w<=1280-480+2);
 await dragEl(p,'.pvs-split-insp',5000,0);check('Settings panel has a minimum width',(await box(p,'.work > .insp')).w>=278);
 await p.locator('.menu .mtop').filter({hasText:/^View$/}).click();await p.locator('#pvsResetLayout').click();
 check('View → Reset panel sizes restores every original size',(await box(p,'.work > .insp')).w===420&&near((await box(p,'#dock')).h,d0.h,2)&&await p.evaluate(()=>!Object.keys(PanelLayout.prefs()).length));
 await p.locator('#dockToggle').click();check('Editor-panel handle hides while the panel is collapsed',!(await p.locator('.pvs-split-dock').isVisible()));
 await p.locator('#dockToggle').click();check('…and returns when it opens again',await p.locator('.pvs-split-dock').isVisible());

 /* ---------- 2. Floating work window: resize from any edge ---------- */
 await p.locator('#workspaceChoice').selectOption('notes');await p.locator('#workspaceExpand').click();
 await p.waitForFunction(()=>WorkWindows.state().open&&WorkWindows.state().mode==='notes');await p.waitForTimeout(300);
 if(await p.evaluate(()=>WorkWindows.state().maximized))await p.locator('#workWindowMax').click();
 for(const e of ['n','s','e','w','ne','nw','se','sw'])check('Window edge handle present: '+e,await p.locator('#dock > .ww-edge-'+e).isVisible());
 const w0=await box(p,'#dock');
 await dragEl(p,'#dock > .ww-edge-w',60,0);
 let w1=await box(p,'#dock');check('Left edge moves only the left side',near(w1.x,w0.x+60)&&near(w1.x+w1.w,w0.x+w0.w),[w0,w1]);
 await dragEl(p,'#dock > .ww-edge-n',0,40);
 let w2=await box(p,'#dock');check('Top edge moves only the top side',near(w2.y,w1.y+40)&&near(w2.y+w2.h,w1.y+w1.h),[w1,w2]);
 await dragEl(p,'#dock > .ww-edge-se',-30,-20);
 let w3=await box(p,'#dock');check('Corner resizes both directions',near(w3.w,w2.w-30)&&near(w3.h,w2.h-20)&&near(w3.x,w2.x),[w2,w3]);
 await dragEl(p,'#dock > .ww-edge-e',-2000,0);check('Window keeps its minimum width',(await box(p,'#dock')).w>=638);
 const kept=await box(p,'#dock');
 await p.locator('#workWindowClose').click();await p.locator('#workspaceExpand').click();await p.waitForFunction(()=>WorkWindows.state().open);await p.waitForTimeout(200);
 const again=await box(p,'#dock');check('Window size is remembered when reopened',near(again.w,kept.w)&&near(again.h,kept.h),[kept,again]);
 await p.locator('#workWindowMax').click();check('Edge handles hide while maximized',!(await p.locator('#dock > .ww-edge-w').isVisible()));

 /* ---------- 3. Tuning window: settings column and piano roll ---------- */
 const frame=p.frames().find(f=>f.url().includes('note-editor.html'));await frame.locator('.neSplit').waitFor({state:'attached'});
 if(await frame.evaluate(()=>document.documentElement.classList.contains('focus-notes')))await p.locator('#workWindowFocus').click();
 await p.waitForTimeout(200);
 const fb=await p.locator('#noteEditorFrame').boundingBox();
 const fbox=async sel=>{const b=await frame.locator(sel).first().boundingBox();return b&&{x:b.x,y:b.y,w:Math.round(b.width),h:Math.round(b.height)};};
 check('Settings column handle visible in the wide tuning window',await frame.locator('.neSplit').isVisible());
 const pw0=(await fbox('.panels')).w,s0=await fbox('.neSplit');
 await drag(p,s0.x+s0.w/2,s0.y+40,-80,0);
 const pw1=(await fbox('.panels')).w;check('Dragging the tuning settings edge left widens the column',near(pw1,pw0+80,4),[pw0,pw1]);
 check('Piano roll still fills the window without page overflow',await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await frame.locator('.neSplit').dblclick();check('Double-click resets the settings column',near((await fbox('.panels')).w,pw0,3));
 await p.locator('#workWindowMax').click();await p.locator('#workWindowClose').click();
 // The recording window resizes from its edges too.
 await p.locator('#workspaceChoice').selectOption('record');await p.locator('#workspaceExpand').click();await p.waitForFunction(()=>WorkWindows.state().open&&WorkWindows.state().mode==='record');await p.waitForTimeout(200);
 if(await p.evaluate(()=>WorkWindows.state().maximized))await p.locator('#recordWindowMax').click();
 const rw0=await box(p,'#songStudio');await dragEl(p,'#songStudio > .ww-edge-e',-50,0);const rw1=await box(p,'#songStudio');
 check('Recording window resizes from its right edge',near(rw1.w,rw0.w-50)&&near(rw1.x,rw0.x),[rw0,rw1]);
 await p.locator('#recordWindowClose').click();
 if(await p.evaluate(()=>RC.step!=='polish')){await p.locator('#rcStep2').click();await p.waitForTimeout(300);}
 // Docked editor panel (not a window): piano-roll height grip.
 await p.locator('[data-dock="notes"]').click();await p.waitForTimeout(300);
 if(await frame.locator('.neRollGrip').isVisible()){
  await frame.locator('.neRollGrip').scrollIntoViewIfNeeded();await p.waitForTimeout(100);
  const e0=(await fbox('#editor')).h,g=await fbox('.neRollGrip');
  await drag(p,g.x+g.w/2,g.y+g.h/2,0,60);
  check('Dragging the piano-roll grip makes the roll taller',near((await fbox('#editor')).h,e0+60,4));
  await frame.locator('.neRollGrip').dblclick();check('Double-click resets the piano-roll height',near((await fbox('#editor')).h,e0,3));
 }else check('Piano-roll grip appears below the docked roll',false);
 check('Tuning layout lives in view preferences only',await frame.evaluate(()=>!!localStorage.getItem('pne.layout.v1')&&!JSON.stringify(PlaybookNoteEditor.state?.()||{}).includes('sideW')));
 check('Resizing work windows and the tuning editor leaves the project untouched',await untouched(p));

 /* ---------- 4. Song & vocals tracks and movable dialogs ---------- */
 await p.locator('#rcStep1').click();await p.waitForTimeout(300);
 await p.evaluate(()=>{const C=SongCore,R=48000,a=new Float32Array(R*4);for(let i=0;i<a.length;i++)a[i]=.2*Math.sin(2*Math.PI*220*i/R);S.song=C.empty(R);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:4,channels:[a],origin:0,choose:true}),'layout test');});
 await p.waitForTimeout(600);
 const lane='#songStudio .sg-lane:not(.sg-ruler):not(.sg-empty-backing)';
 await p.locator(lane).first().scrollIntoViewIfNeeded();await p.waitForTimeout(900);
 const l0=await box(p,lane),hd0=await box(p,lane+' > .sg-lane-head');
 check('Track lanes keep their original layout by default',hd0.w===205&&l0.h>=176,[l0,hd0]);
 await drag(p,hd0.x+hd0.w-1,hd0.y+hd0.h-60,70,0);
 const hd1=await box(p,lane+' > .sg-lane-head'),rh=await box(p,'#songStudio .sg-ruler > .sg-lane-head');
 check('Dragging the track-name edge widens every lane and the ruler together',near(hd1.w,275,4)&&near(rh.w,hd1.w,1),[hd1.w,rh.w]);
 const l1=await box(p,lane);
 await drag(p,l1.x+l1.w-200,l1.y+l1.h-2,0,-Math.round(l1.h-150));
 const l2=await box(p,lane);check('Dragging a track’s bottom edge sets the track height (smaller than its controls)',near(l2.h,150,4),[l1.h,l2.h]);
 check('Track controls stay reachable by scrolling inside the name column',await p.evaluate(s=>{const h=document.querySelector(s+' > .sg-lane-head');return getComputedStyle(h).overflowY==='auto';},lane));
 await drag(p,l2.x+l2.w-200,l2.y+l2.h-2,0,120);check('Track height grows again',near((await box(p,lane)).h,270,4));
 check('Lane drag did not start a waveform selection or change the song',await p.evaluate(()=>SongStudio.getHistorySnapshots().length<=1&&!document.querySelector('#songStudio .sg-selection:not([hidden]) .sg-sel-active')));
 await p.mouse.dblclick(l2.x+l2.w-200,(await box(p,lane)).y+(await box(p,lane)).h-2);
 check('Double-click on a track edge resets the height',await p.evaluate(()=>PanelLayout.get('sgLaneH')===null));
 // Take dialog moves by its title.
 await p.locator('[data-edit]').first().click();await p.waitForTimeout(300);
 const t0=await box(p,'#songDialog'),hb=await box(p,'#songDialog h2');
 await drag(p,hb.x+10,hb.y+hb.h/2,-120,-40);
 const t1=await box(p,'#songDialog');check('Song dialog moves by its title',near(t1.x,t0.x-120)&&near(t1.y,t0.y-40),[t0,t1]);
 await p.locator('#songDialog button',{hasText:'Manual cleanup'}).click();await p.waitForTimeout(500);
 const v0=await box(p,'#vocalEditor .stdialog'),vh=await box(p,'#vocalEditor .stdialog > header');
 await drag(p,vh.x+vh.w/2-40,vh.y+6,-60,30);
 const v1=await box(p,'#vocalEditor .stdialog');check('Take editor moves by its header',near(v1.x,v0.x-60)&&near(v1.y,v0.y+30),[v0,v1]);
 await p.locator('#veClose').click();await p.waitForTimeout(200);
 await p.locator('[data-edit]').first().click();await p.waitForTimeout(300);
 check('A moved dialog reopens in its usual place',near((await box(p,'#songDialog')).x,t0.x)&&near((await box(p,'#songDialog')).y,t0.y));
 await p.keyboard.press('Escape');
 await p.context().close();

 /* ---------- 5. Phones and narrow screens ---------- */
 for(const [w,h] of [[390,844],[844,390]]){
  const q=await page(w,h),tag=w+'×'+h;
  await q.locator('#rcStep2').click();await q.waitForTimeout(300);
  check(tag+' desktop-only handles stay hidden',!(await q.locator('.pvs-split-insp').isVisible())&&!(await q.locator('.pvs-split-dock').isVisible())&&!(await q.locator('.pvs-split-heads').isVisible()));
  check(tag+' page still fits the screen width',await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await q.locator('#workspaceChoice').selectOption('notes');await q.locator('#workspaceExpand').click();await q.waitForFunction(()=>WorkWindows.state().open);
  check(tag+' full-screen window has no edge handles',!(await q.locator('#dock > .ww-edge-e').isVisible()));
  await q.locator('#workWindowClose').click();
  await q.context().close();
 }
 // Saved desktop sizes never squeeze a smaller laptop window.
 const r=await page(1000,700);
 await r.evaluate(()=>{localStorage.setItem('pvs.layout.v1',JSON.stringify({inspW:900,headsW:320}));});await r.reload();await r.waitForFunction(()=>window.StudioBrowse&&!S.loading);
 await r.locator('#rcStep2').click();await r.waitForTimeout(300);
 check('A large saved width is limited on a smaller window',(await box(r,'.work > .insp')).w<=1000-480+2&&await r.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await r.context().close();
});
