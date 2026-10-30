/* Expanded workspaces keep live editors, audio and history in their original DOM. */
(function(){
'use strict';
const $=id=>document.getElementById(id),dock=$('dock'),record=$('songStudio');
const names={record:'Recording',notes:'Vocal tuning',wave:'Audio editing',ref:'Reference comparison'},sizes=new Map();
let active=false,recordingView=false,maximized=false,focused=false,returnFocus=null,blocked=[],drag=null,raf=0,launching=false;
const panel=()=>recordingView?record:dock,mode=()=>recordingView?'record':DAW.dock;
const shade=document.createElement('div');shade.id='workWindowShade';shade.hidden=true;document.body.append(shade);
const bars=new Map(),feet=new Map();
for(const [el,prefix,title] of [[dock,'workWindow','Vocal tuning'],[record,'recordWindow','Recording']]){
 const bar=document.createElement('div');bar.className='ww-titlebar';bar.hidden=true;
 bar.innerHTML=`<strong id="${prefix}Title">${title}</strong><div class="ww-window-actions"><button type="button" id="${prefix}Focus" aria-pressed="false">Focus ${el===record?'timeline':'notes'}</button>${el===record?'<button type="button" id="recordWindowUndo">Undo</button><button type="button" id="recordWindowRedo">Redo</button>':'<button type="button" id="workWindowStop">■ Stop</button>'}<button type="button" id="${prefix}Max" aria-pressed="false">Maximize</button><button type="button" id="${prefix}Screen">Full screen</button><button type="button" id="${prefix}Pop">Pop out ↗</button><button type="button" id="${prefix}Close">Return to studio</button></div>`;
 const status=document.createElement('output');status.className='ww-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');bar.append(status);
 el.prepend(bar);bars.set(el,bar);
 const foot=document.createElement('div');foot.className='ww-footer';foot.hidden=true;foot.innerHTML=`<span>Drag the title bar to move · Drag the corner to resize</span><button type="button" id="${prefix}Resize" aria-label="Resize ${el===record?'recording':'work'} window" title="Drag to resize, or use arrow keys. Shift + arrow changes size faster.">↘</button>`;
 el.append(foot);feet.set(el,foot);
 $(prefix+'Close').onclick=()=>close();
 $(prefix+'Max').onclick=()=>{if(!maximized)sizes.set(mode(),rect());maximized=!maximized;if(!maximized)applyRect(sizes.get(mode())||rect());sync();};
 $(prefix+'Screen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen){if(!maximized)sizes.set(mode(),rect());maximized=true;sync();await document.documentElement.requestFullscreen();}else throw Error();}catch(_){maximized=true;sync();announce('Workspace expanded to fill this browser.');}};
 $(prefix+'Pop').onclick=()=>window.AppWindow?.open(mode());
 $(prefix+'Focus').onclick=()=>{focused=!focused;sync();if(recordingView)record.scrollTop=0;else $('noteEditorFrame')?.contentWindow?.scrollTo(0,0);};
 const handle=$(prefix+'Resize');bar.addEventListener('pointerdown',e=>beginDrag(e,false));handle.addEventListener('pointerdown',e=>beginDrag(e,true));
 for(const h of [bar,handle]){
  h.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y,r=drag.r;applyRect(drag.resize?{...r,w:r.w+dx,h:r.h+dy}:{...r,x:r.x+dx,y:r.y+dy});});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])h.addEventListener(type,()=>{if(drag){sizes.set(mode(),rect());drag=null;panel().classList.remove('ww-dragging');}});
 }
 handle.addEventListener('keydown',e=>{if(!/^Arrow/.test(e.key))return;e.preventDefault();e.stopPropagation();const r=rect(),s=e.shiftKey?80:20;applyRect({...r,w:r.w+(e.key==='ArrowRight'?s:e.key==='ArrowLeft'?-s:0),h:r.h+(e.key==='ArrowDown'?s:e.key==='ArrowUp'?-s:0)});sizes.set(mode(),rect());});
}
const selector=document.createElement('div');selector.id='workspaceTools';selector.innerHTML='<label for="workspaceChoice">Workspace</label><select id="workspaceChoice"><option value="record">Recording</option><option value="notes">Vocal tuning</option><option value="wave">Audio editing</option><option value="ref">Reference comparison</option></select><button type="button" id="workspaceExpand" aria-haspopup="dialog">⛶ Expand</button><button type="button" id="workspacePop">Pop out ↗</button><details><summary aria-label="About workspace windows">?</summary><p>Expand keeps your current session and Undo history. Pop out saves and reopens the project in a separate window or tab; Undo starts fresh there. The original tab waits until you return. Stop recording before popping out.</p></details><output id="workspaceStatus" role="status" aria-live="polite"></output>';
$('rcSteps').append(selector);
$('workspaceExpand').onclick=()=>launchMode($('workspaceChoice').value);
$('workspacePop').onclick=()=>window.AppWindow?.open($('workspaceChoice').value);
const launch=document.createElement('button');launch.id='workWindowOpen';launch.type='button';launch.className='btn small';launch.setAttribute('aria-haspopup','dialog');dock.before(launch);launch.onclick=()=>open();
const narrow=()=>innerWidth<720||innerHeight<460,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function announce(text){$('workspaceStatus').textContent=text;if(active)bars.get(panel()).querySelector('.ww-status').textContent=text;window.SongStudio?.notify(text);}
function rect(){const r=panel().getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}
function applyRect(r){const el=panel(),pad=8,w=clamp(r.w,Math.min(640,innerWidth-16),innerWidth-16),h=clamp(r.h,Math.min(400,innerHeight-16),innerHeight-16);el.style.left=clamp(r.x,pad,innerWidth-w-pad)+'px';el.style.top=clamp(r.y,pad,innerHeight-h-pad)+'px';el.style.width=w+'px';el.style.height=h+'px';}
function redraw(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(typeof drawAll==='function')drawAll();window.DAW?.layout();});}
function sync(){
 const m=mode(),full=maximized||narrow();dock.dataset.workspace=DAW.dock;$('workWindowTitle').textContent=names[DAW.dock]||'Workspace';launch.textContent='⛶ Expand '+(DAW.dock==='notes'?'tuning':DAW.dock==='wave'?'audio editing':'comparison');launch.hidden=active;
 for(const [el,prefix] of [[dock,'workWindow'],[record,'recordWindow']]){
  const on=active&&el===panel();el.classList.toggle('ww-maximized',on&&full);feet.get(el).hidden=!on||full;
  $(prefix+'Max').textContent=full?'Restore size':'Maximize';$(prefix+'Max').setAttribute('aria-pressed',String(full));$(prefix+'Max').hidden=narrow();
  $(prefix+'Screen').textContent=document.fullscreenElement?'Exit full screen':'Full screen';
  $(prefix+'Pop').hidden=!!window.AppWindow?.isChild();
  $(prefix+'Focus').setAttribute('aria-pressed',String(on&&focused));
 }
 record.classList.toggle('ww-focus-timeline',active&&recordingView&&focused);
 $('recordWindowFocus').textContent=focused?'All controls':'Focus timeline';
 syncHistory();
 const frame=$('noteEditorFrame');$('workWindowFocus').hidden=DAW.dock!=='notes'||!frame;$('workWindowFocus').textContent=focused?'All tuning controls':'Focus notes';
 if(frame?.contentDocument){frame.contentDocument.documentElement.classList.toggle('work-window',active&&!recordingView);frame.contentDocument.documentElement.classList.toggle('focus-notes',active&&!recordingView&&focused);bindFrame(frame);}
 redraw();
}
function setBackgroundInert(on){
 if(!on){for(const [el,was] of blocked)el.inert=was;blocked=[];return;}
 for(let el=panel();el&&el!==document.body;el=el.parentElement)for(const sibling of el.parentElement.children){if(sibling===el||sibling===shade||['SCRIPT','STYLE','LINK','DIALOG'].includes(sibling.tagName))continue;blocked.push([sibling,sibling.inert]);sibling.inert=true;}
}
function open(m=DAW.dock){
 if(!names[m])return false;
 if(m==='record'&&RC.step!=='rc'){RC.go('rc');if(RC.step!=='rc')return false;}
 if(m!=='record'&&RC.step==='rc')return launchMode(m);
 if(active&&recordingView!==(m==='record'))close();
 recordingView=m==='record';
 if(!active){returnFocus=document.activeElement;dawCloseMenus();$('guideSheet').hidden=true;active=true;maximized=false;focused=recordingView;if(recordingView&&narrow())record.querySelector('.sg-record-helpers').open=false;shade.hidden=false;bars.get(panel()).hidden=false;bars.get(panel()).querySelector('.ww-status').textContent='';panel().classList.add('ww-window');panel().setAttribute('role','dialog');panel().setAttribute('aria-modal','true');panel().setAttribute('aria-labelledby',recordingView?'recordWindowTitle':'workWindowTitle');document.body.classList.add('ww-open');setBackgroundInert(true);}
 if(!recordingView)dawDock(m);
 applyRect(sizes.get(m)||{x:innerWidth*.04,y:innerHeight*.04,w:innerWidth*.92,h:innerHeight*.9});sync();
 if(recordingView)record.scrollTop=0;else{dock.querySelector('.dbody').scrollTop=0;$('noteEditorFrame')?.contentWindow?.scrollTo(0,0);}
 $(recordingView?'recordWindowClose':'workWindowClose').focus({preventScroll:true});return true;
}
async function launchMode(m){
 if(launching)return false;
 if(m==='record')return open(m);
 if(window.SongStudio?.locked()){announce('Stop recording or wait for the current operation before changing workspace.');return false;}
 launching=true;
 try{if(RC.step==='rc'){if(!await SongPolish.open(S.song.activeTrack))return false;}if(m==='notes')showPage('tune');return open(m);}catch(e){announce(e.message);return false;}finally{launching=false;}
}
function close(){
 if(!active)return;if(!maximized&&!narrow())sizes.set(mode(),rect());
 if(!recordingView)window.NoteTuner?.stopAudition();const el=panel();active=false;drag=null;el.classList.remove('ww-window','ww-maximized','ww-dragging','ww-focus-timeline');for(const p of ['left','top','width','height'])el.style.removeProperty(p);for(const a of ['role','aria-modal','aria-labelledby'])el.removeAttribute(a);
 bars.get(el).hidden=true;feet.get(el).hidden=true;shade.hidden=true;document.body.classList.remove('ww-open');setBackgroundInert(false);sync();
 (returnFocus?.isConnected&&!returnFocus.closest('[hidden]')?returnFocus:$('workspaceExpand')).focus({preventScroll:true});
}
$('workWindowStop').onclick=()=>{window.NoteTuner?.stopAudition();$('dawStop').click();};
$('recordWindowUndo').onclick=()=>SongStudio.history(-1);$('recordWindowRedo').onclick=()=>SongStudio.history(1);
function syncHistory(){for(const [to,from] of [['recordWindowUndo','rcUndo'],['recordWindowRedo','rcRedo']]){if($(to).disabled!==$(from).disabled)$(to).disabled=$(from).disabled;}}
for(const id of ['rcUndo','rcRedo'])new MutationObserver(syncHistory).observe($(id),{attributes:true,attributeFilter:['disabled']});
const noteOpen=$('noteRouteOpen');noteOpen.textContent='Open tuning window';noteOpen.onclick=()=>{showPage('tune');open('notes');};
const waveOpen=$('polishWave');waveOpen.textContent='Open editing window';waveOpen.onclick=()=>open('wave');
const soundControls=$('polishBackToControls'),oldSoundAction=soundControls.onclick;soundControls.onclick=e=>{if(active)close();oldSoundAction?.call(soundControls,e);};
const inline=document.createElement('button');inline.type='button';inline.className='btn small ww-inline-open';inline.textContent='Open editing window';inline.setAttribute('aria-haspopup','dialog');inline.onclick=()=>open('wave');$('editWaveTitle').after(inline);
new ResizeObserver(()=>{if(active)redraw();}).observe(dock);
const recordingPadding=()=>{const h=active&&recordingView?bars.get(record).offsetHeight:0;record.style.setProperty('--record-window-bar',h+'px');record.style.scrollPaddingTop=(h+record.querySelector('.sg-transport').offsetHeight+8)+'px';};
new ResizeObserver(recordingPadding).observe(bars.get(record));new ResizeObserver(recordingPadding).observe(record.querySelector('.sg-transport'));
new MutationObserver(sync).observe(dock.querySelector('.dtabs'),{subtree:true,attributes:true,attributeFilter:['aria-selected']});
new MutationObserver(()=>{if(active&&((recordingView&&RC.step!=='rc')||(!recordingView&&RC.step==='rc')))close();}).observe(document.body,{attributes:true,attributeFilter:['class']});
// Legacy dialogs live outside the workspace; docking releases their ancestors.
new MutationObserver(()=>{if(active&&document.querySelector('.stmodal:not([hidden]),.modal:not([hidden]),.sheet:not([hidden])'))close();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden']});
window.addEventListener('resize',()=>{if(active&&!maximized)applyRect(rect());sync();});document.addEventListener('fullscreenchange',sync);
function beginDrag(e,resize){if(!active||maximized||narrow()||e.button!==0||(!resize&&e.target.closest('button')))return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY,r:rect(),resize};e.currentTarget.setPointerCapture(e.pointerId);panel().classList.add('ww-dragging');}
const focusable=root=>[...root.querySelectorAll('button,input,select,textarea,a[href],summary,iframe,[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&!e.closest('[inert]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
function key(e,frame){
 if(!active||document.querySelector('dialog[open]'))return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
 if(!frame&&e.key===' '&&e.target.closest('button,summary')){e.stopPropagation();return;}
 if(e.key==='Tab'){
  const f=focusable(frame?frame.contentDocument:panel()),at=frame?frame.contentDocument.activeElement:document.activeElement,i=f.indexOf(at);if(!f.length)return;
  if(i<0||(!e.shiftKey&&i===f.length-1)||(e.shiftKey&&i===0)){e.preventDefault();e.stopImmediatePropagation();const parent=focusable(panel()),j=frame?parent.indexOf(frame):-1;const target=frame?parent[(j+(e.shiftKey?-1:1)+parent.length)%parent.length]:(e.shiftKey?f.at(-1):f[0]);target?.focus();}
 }
 if(!frame&&!e.ctrlKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)&&(/^[1-5]$/.test(e.key)||e.key==='?'))e.stopImmediatePropagation();
}
window.addEventListener('keydown',e=>key(e,null),true);
const bound=new WeakSet();function bindFrame(frame){const doc=frame.contentDocument;if(!doc||bound.has(doc))return;bound.add(doc);frame.contentWindow.addEventListener('keydown',e=>key(e,frame),true);}
new MutationObserver(()=>{const frame=$('noteEditorFrame');if(frame){frame.addEventListener('load',sync,{once:true});sync();}}).observe($('newNotePanel'),{childList:true});
// Existing take dialogs get size controls without changing their apply/cancel paths.
const takeDialog=$('vocalEditor')?.querySelector('.stdialog');
if(takeDialog){const b=document.createElement('button');b.type='button';b.id='veMaximize';b.textContent='Maximize';b.setAttribute('aria-pressed','false');takeDialog.querySelector('header').insertBefore(b,$('veClose'));b.onclick=()=>{const on=takeDialog.classList.toggle('ww-take-max');b.textContent=on?'Restore size':'Maximize';b.setAttribute('aria-pressed',String(on));window.dispatchEvent(new Event('resize'));};}
if(takeDialog)new ResizeObserver(()=>{const s=window.Studio?.state();if(s?.open)Studio.view(s.start,s.seconds);}).observe(takeDialog);
const songDialog=$('songDialog');
new MutationObserver(()=>{
 if(!songDialog.open||!songDialog.querySelector('.sg-editor')||songDialog.querySelector('#sgEditMaximize'))return;
 const b=document.createElement('button');b.type='button';b.id='sgEditMaximize';b.textContent='Maximize editor';b.setAttribute('aria-pressed','false');b.onclick=()=>{const on=songDialog.classList.toggle('ww-take-max');b.textContent=on?'Restore size':'Maximize editor';b.setAttribute('aria-pressed',String(on));};$('sgDialogTitle').after(b);
}).observe(songDialog,{childList:true,attributes:true,attributeFilter:['open']});
songDialog.addEventListener('close',()=>songDialog.classList.remove('ww-take-max'));
window.WorkWindows={open,launch:launchMode,close,sync,announce,state:()=>({open:active,mode:mode(),maximized:maximized||narrow()})};sync();
})();
