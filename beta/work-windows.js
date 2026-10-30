/* 0.31.8: presentation-only work windows. Never move/recreate the live iframe. */
(function(){
'use strict';
const $=id=>document.getElementById(id),dock=$('dock');
const names={notes:'Vocal tuning',wave:'Audio editing',ref:'Reference comparison'};
const sizes=new Map();
let active=false,maximized=false,focused=false,returnFocus=null,blocked=[],drag=null,raf=0;
const shade=document.createElement('div');shade.id='workWindowShade';shade.hidden=true;document.body.append(shade);
const bar=document.createElement('div');bar.className='ww-titlebar';bar.hidden=true;
bar.innerHTML='<strong id="workWindowTitle">Vocal tuning</strong><button type="button" id="workWindowFocus" aria-pressed="false">Focus notes</button><button type="button" id="workWindowStop">■ Stop</button><button type="button" id="workWindowMax" aria-pressed="false">Maximize</button><button type="button" id="workWindowClose">Return to studio</button>';
dock.prepend(bar);
const foot=document.createElement('div');foot.className='ww-footer';foot.hidden=true;
foot.innerHTML='<span>Drag the title bar to move · Drag the corner to resize</span><button type="button" id="workWindowResize" aria-label="Resize work window" title="Drag to resize, or use arrow keys. Shift + arrow changes size faster.">↘</button>';
dock.append(foot);
const launch=document.createElement('button');launch.id='workWindowOpen';launch.type='button';launch.textContent='⛶ Expand workspace';launch.className='btn small';launch.setAttribute('aria-haspopup','dialog');$('dock').before(launch);
const narrow=()=>innerWidth<720||innerHeight<460;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function rect(){const r=dock.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}
function applyRect(r){const pad=8,w=clamp(r.w,Math.min(640,innerWidth-16),innerWidth-16),h=clamp(r.h,Math.min(400,innerHeight-16),innerHeight-16);dock.style.left=clamp(r.x,pad,innerWidth-w-pad)+'px';dock.style.top=clamp(r.y,pad,innerHeight-h-pad)+'px';dock.style.width=w+'px';dock.style.height=h+'px';}
function redraw(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(typeof drawAll==='function')drawAll();window.DAW?.layout();});}
function sync(){
 const mode=DAW.dock;dock.dataset.workspace=mode;$('workWindowTitle').textContent=names[mode]||'Workspace';
 launch.textContent='⛶ Expand '+(mode==='notes'?'tuning':mode==='wave'?'audio editing':'comparison');
 const full=maximized||narrow();dock.classList.toggle('ww-maximized',active&&full);
 $('workWindowMax').textContent=full?'Restore size':'Maximize';$('workWindowMax').setAttribute('aria-pressed',String(full));$('workWindowMax').hidden=narrow();
 foot.hidden=!active||full;launch.hidden=active;
 const frame=$('noteEditorFrame');
 $('workWindowFocus').hidden=mode!=='notes'||!frame;$('workWindowFocus').textContent=focused?'All tuning controls':'Focus notes';$('workWindowFocus').setAttribute('aria-pressed',String(focused));
 if(frame?.contentDocument){frame.contentDocument.documentElement.classList.toggle('work-window',active);frame.contentDocument.documentElement.classList.toggle('focus-notes',active&&focused);bindFrame(frame);}
 redraw();
}
function setBackgroundInert(on){
 if(!on){for(const [el,was] of blocked)el.inert=was;blocked=[];return;}
 // Keep ancestors and the live editor in place; block only their siblings.
 for(let el=dock;el&&el!==document.body;el=el.parentElement){for(const sibling of el.parentElement.children){if(sibling===el||sibling===shade||['SCRIPT','STYLE','LINK'].includes(sibling.tagName))continue;blocked.push([sibling,sibling.inert]);sibling.inert=true;}}
}
function open(mode=DAW.dock){
 if(!names[mode])return;
 if(!active){returnFocus=document.activeElement;dawCloseMenus();$('guideSheet').hidden=true;active=true;maximized=false;focused=false;shade.hidden=false;bar.hidden=false;dock.classList.add('ww-window');dock.setAttribute('role','dialog');dock.setAttribute('aria-modal','true');dock.setAttribute('aria-labelledby','workWindowTitle');document.body.classList.add('ww-open');setBackgroundInert(true);}
 dawDock(mode);const r=sizes.get(mode)||{x:innerWidth*.04,y:innerHeight*.04,w:innerWidth*.92,h:innerHeight*.9};applyRect(r);sync();dock.querySelector('.dbody').scrollTop=0;$('noteEditorFrame')?.contentWindow?.scrollTo(0,0);$('workWindowClose').focus({preventScroll:true});
}
function close(){
 if(!active)return;if(!maximized&&!narrow())sizes.set(DAW.dock,rect());
 window.NoteTuner?.stopAudition();active=false;drag=null;dock.classList.remove('ww-window','ww-maximized','ww-dragging');for(const p of ['left','top','width','height'])dock.style.removeProperty(p);
 for(const a of ['role','aria-modal','aria-labelledby'])dock.removeAttribute(a);
 bar.hidden=true;foot.hidden=true;shade.hidden=true;document.body.classList.remove('ww-open');setBackgroundInert(false);sync();
 (returnFocus?.isConnected&&!returnFocus.closest('[hidden]')?returnFocus:launch).focus({preventScroll:true});
}
launch.onclick=()=>open();$('workWindowClose').onclick=close;
$('workWindowMax').onclick=()=>{if(!maximized)sizes.set(DAW.dock,rect());maximized=!maximized;if(!maximized)applyRect(sizes.get(DAW.dock)||rect());sync();};
$('workWindowStop').onclick=()=>{window.NoteTuner?.stopAudition();$('dawStop').click();};
$('workWindowFocus').onclick=()=>{focused=!focused;sync();$('noteEditorFrame')?.contentWindow?.scrollTo(0,0);};
// The familiar TUNE action now opens the large workspace directly.
const noteOpen=$('noteRouteOpen');noteOpen.textContent='Open tuning window';noteOpen.onclick=()=>{showPage('tune');open('notes');};
const waveOpen=$('polishWave');waveOpen.textContent='Open editing window';waveOpen.onclick=()=>open('wave');
const soundControls=$('polishBackToControls'),oldSoundAction=soundControls.onclick;soundControls.onclick=e=>{if(active)close();oldSoundAction?.call(soundControls,e);};
for(const [id,mode,label] of [['editWaveTitle','wave','Open editing window']]){
 const b=document.createElement('button');b.type='button';b.className='btn small ww-inline-open';b.textContent=label;b.setAttribute('aria-haspopup','dialog');b.onclick=()=>open(mode);$(id).after(b);
}
// Size changes must redraw host canvases; the iframe observes its own piano roll.
new ResizeObserver(()=>{if(active)redraw();}).observe(dock);
new MutationObserver(()=>sync()).observe(dock.querySelector('.dtabs'),{subtree:true,attributes:true,attributeFilter:['aria-selected']});
new MutationObserver(()=>{if(active&&document.body.classList.contains('rc-on'))close();}).observe(document.body,{attributes:true,attributeFilter:['class']});
window.addEventListener('resize',()=>{if(active&&!maximized)applyRect(rect());sync();});
function beginDrag(e,resize){if(!active||maximized||narrow()||e.button!==0||(!resize&&e.target.closest('button')))return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY,r:rect(),resize};e.currentTarget.setPointerCapture(e.pointerId);dock.classList.add('ww-dragging');}
bar.addEventListener('pointerdown',e=>beginDrag(e,false));$('workWindowResize').addEventListener('pointerdown',e=>beginDrag(e,true));
for(const handle of [bar,$('workWindowResize')]){
 handle.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y,r=drag.r;applyRect(drag.resize?{...r,w:r.w+dx,h:r.h+dy}:{...r,x:r.x+dx,y:r.y+dy});});
 const end=()=>{if(drag){sizes.set(DAW.dock,rect());drag=null;dock.classList.remove('ww-dragging');}};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,end);
}
$('workWindowResize').addEventListener('keydown',e=>{if(!/^Arrow/.test(e.key))return;e.preventDefault();e.stopPropagation();const r=rect(),s=e.shiftKey?80:20;applyRect({...r,w:r.w+(e.key==='ArrowRight'?s:e.key==='ArrowLeft'?-s:0),h:r.h+(e.key==='ArrowDown'?s:e.key==='ArrowUp'?-s:0)});sizes.set(DAW.dock,rect());});
const focusable=root=>[...root.querySelectorAll('button,input,select,textarea,a[href],summary,iframe,[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&!e.closest('[inert]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
function key(e,frame){
 if(!active)return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
 // Preserve native Space activation on window buttons instead of the DAW play shortcut.
 if(!frame&&e.key===' '&&e.target.closest('button,summary')){e.stopPropagation();return;}
 if(e.key==='Tab'){
  const f=focusable(frame?frame.contentDocument:dock),at=frame?frame.contentDocument.activeElement:document.activeElement,i=f.indexOf(at);
  if(!f.length)return;
  if(i<0||(!e.shiftKey&&i===f.length-1)||(e.shiftKey&&i===0)){
   e.preventDefault();e.stopImmediatePropagation();
   const parent=focusable(dock),j=frame?parent.indexOf(frame):-1;
   const target=frame?parent[(j+(e.shiftKey?-1:1)+parent.length)%parent.length]:(e.shiftKey?f.at(-1):f[0]);
   target?.focus();
  }
 }
 // Page-navigation shortcuts must not open a hidden inspector behind this window.
 if(!frame&&!e.ctrlKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)&&(/^[1-5]$/.test(e.key)||e.key==='?'))e.stopImmediatePropagation();
}
window.addEventListener('keydown',e=>key(e,null),true);
const bound=new WeakSet();
function bindFrame(frame){const doc=frame.contentDocument;if(!doc||bound.has(doc))return;bound.add(doc);frame.contentWindow.addEventListener('keydown',e=>key(e,frame),true);}
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
window.WorkWindows={open,close,state:()=>({open:active,mode:DAW.dock,maximized:maximized||narrow()})};sync();
})();
