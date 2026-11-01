/* 0.32.5: drag-to-resize panels and draggable dialogs. Sizes are view preferences only (localStorage, per
   device); they never touch the project, autosave or Undo. Double-click a handle, or View → Reset layout,
   to go back to the original sizes. Handles appear only where the desktop layout has side-by-side panels. */
(function(){
'use strict';
const KEY='pvs.layout.v1',root=document.documentElement,$=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let prefs={};try{prefs=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){prefs={};}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch(_){}};
// name: [css variable, default (px), min, max()]
const SIZES={
 inspW:['--pvs-insp-w',420,280,()=>Math.max(300,innerWidth-480)],
 dockH:['--pvs-dock-h',null,120,()=>Math.max(160,innerHeight*.8)],
 headsW:['--pvs-heads-w',150,110,()=>320],
 sgHeadW:['--pvs-sghead-w',205,150,()=>380],
 sgLaneH:['--pvs-sglane-h',176,120,()=>Math.max(200,innerHeight*.7)]
};
function apply(name,announce){
 const [v,,min,max]=SIZES[name],x=prefs[name];
 if(Number.isFinite(x))root.style.setProperty(v,Math.round(clamp(x,min,max()))+'px');else root.style.removeProperty(v);
 root.toggleAttribute('data-pvs-'+name.toLowerCase(),Number.isFinite(x));
 if(announce!==false)relayout();
}
let raf=0;function relayout(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>dispatchEvent(new Event('resize')));}
function set(name,px){const [,,min,max]=SIZES[name];prefs[name]=Math.round(clamp(px,min,max()));apply(name);save();}
function reset(name){delete prefs[name];apply(name);save();}
function resetAll(){for(const n of Object.keys(SIZES))delete prefs[n];delete prefs.dialogs;save();for(const n of Object.keys(SIZES))apply(n,false);for(const d of document.querySelectorAll('[data-pvs-moved]')){d.style.translate='';d.removeAttribute('data-pvs-moved');}relayout();}
for(const n of Object.keys(SIZES))apply(n,false);
addEventListener('resize',()=>{for(const n of Object.keys(SIZES))if(Number.isFinite(prefs[n])){const [v,,min,max]=SIZES[n];root.style.setProperty(v,Math.round(clamp(prefs[n],min,max()))+'px');}});

/* A separator handle: pointer drag (mouse, pen, touch), arrow keys (Shift = bigger steps), double-click resets. */
function handle(el,{name,axis,sign,current,label}){
 el.classList.add('pvs-split',axis==='x'?'pvs-split-x':'pvs-split-y');
 el.setAttribute('role','separator');el.setAttribute('aria-orientation',axis==='x'?'vertical':'horizontal');
 el.setAttribute('aria-label',label);el.title=label+' · drag to resize · double-click to reset';el.tabIndex=0;
 const now=()=>current();
 const sync=()=>{const [,,min,max]=SIZES[name];el.setAttribute('aria-valuemin',min);el.setAttribute('aria-valuemax',Math.round(max()));el.setAttribute('aria-valuenow',Math.round(now()));};
 let drag=null;
 el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();drag={id:e.pointerId,p:axis==='x'?e.clientX:e.clientY,v:now()};el.setPointerCapture(e.pointerId);document.body.classList.add('pvs-resizing',axis==='x'?'pvs-resizing-x':'pvs-resizing-y');});
 el.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const d=(axis==='x'?e.clientX:e.clientY)-drag.p;set(name,drag.v+sign*d);sync();});
 const end=()=>{if(!drag)return;drag=null;document.body.classList.remove('pvs-resizing','pvs-resizing-x','pvs-resizing-y');sync();};
 for(const t of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(t,end);
 el.addEventListener('dblclick',()=>{reset(name);sync();});
 el.addEventListener('keydown',e=>{const k=e.key,step=e.shiftKey?60:15;let d=0;
  if(axis==='x'&&(k==='ArrowLeft'||k==='ArrowRight'))d=(k==='ArrowRight'?1:-1)*sign*step;
  if(axis==='y'&&(k==='ArrowUp'||k==='ArrowDown'))d=(k==='ArrowDown'?1:-1)*sign*step;
  if(k==='Home'){reset(name);sync();e.preventDefault();return;}
  if(d){e.preventDefault();set(name,now()+d);sync();}});
 sync();return el;
}
const make=(parent,cls)=>{const d=document.createElement('div');d.className=cls;parent.append(d);return d;};

/* ---------- POLISH: inspector width, dock height, track-name column ---------- */
const insp=document.querySelector('.work > .insp')||document.querySelector('.insp'),dock=$('dock'),lanes=document.querySelector('.arrange .lanes');
if(insp)handle(make(insp,'pvs-split-insp'),{name:'inspW',axis:'x',sign:-1,label:'Settings panel width',current:()=>insp.getBoundingClientRect().width});
if(dock)handle(make(dock,'pvs-split-dock'),{name:'dockH',axis:'y',sign:-1,label:'Editor panel height',current:()=>dock.getBoundingClientRect().height});
if(lanes)handle(make(lanes,'pvs-split-heads'),{name:'headsW',axis:'x',sign:1,label:'Track name column width',current:()=>($('laneHeads')?.getBoundingClientRect().width)||150});

/* ---------- Song & vocals: track height and name column, by dragging the lane edges ---------- */
// Lanes are re-rendered often, so edges are found by position instead of by injected elements.
const EDGE=matchMedia('(pointer:coarse)').matches?12:6;let laneDrag=null;
function laneZone(e){
 if(innerWidth<900||document.body.classList.contains('ww-open')&&!e.target.closest('#songStudio'))return null;
 const lane=e.target.closest?.('.sg-lane');if(!lane)return null;
 const r=lane.getBoundingClientRect(),head=lane.querySelector('.sg-lane-head'),hr=head?.getBoundingClientRect();
 if(!lane.matches('.sg-ruler,.sg-empty-backing')&&e.clientY>r.bottom-EDGE&&e.clientY<=r.bottom+1)return {kind:'h',lane};
 if(hr&&Math.abs(e.clientX-hr.right)<=EDGE&&!e.target.closest('button,input,select,a'))return {kind:'w',lane};
 return null;
}
document.addEventListener('pointermove',e=>{
 if(laneDrag){if(e.pointerId!==laneDrag.id)return;const d=laneDrag.kind==='h'?e.clientY-laneDrag.p:e.clientX-laneDrag.p;set(laneDrag.kind==='h'?'sgLaneH':'sgHeadW',laneDrag.v+d);return;}
 const z=laneZone(e);document.body.classList.toggle('pvs-lane-h',z?.kind==='h');document.body.classList.toggle('pvs-lane-w',z?.kind==='w');
},true);
document.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;const z=laneZone(e);if(!z)return;
 e.preventDefault();e.stopPropagation();
 const r=z.lane.getBoundingClientRect(),hr=z.lane.querySelector('.sg-lane-head').getBoundingClientRect();
 laneDrag={id:e.pointerId,kind:z.kind,p:z.kind==='h'?e.clientY:e.clientX,v:z.kind==='h'?r.height:hr.width};
 try{e.target.setPointerCapture(e.pointerId);}catch(_){}
 document.body.classList.add('pvs-resizing',z.kind==='h'?'pvs-resizing-y':'pvs-resizing-x');
},true);
const laneEnd=e=>{if(!laneDrag||e.pointerId!==laneDrag.id)return;laneDrag=null;document.body.classList.remove('pvs-resizing','pvs-resizing-x','pvs-resizing-y');};
document.addEventListener('pointerup',laneEnd,true);document.addEventListener('pointercancel',laneEnd,true);
document.addEventListener('dblclick',e=>{const z=laneZone(e);if(z){e.preventDefault();e.stopPropagation();reset(z.kind==='h'?'sgLaneH':'sgHeadW');}},true);

/* ---------- Dialogs: drag by the header to move ---------- */
function movable(box,headerSel,id){
 if(!box||box.dataset.pvsMovable)return;box.dataset.pvsMovable='1';
 box.addEventListener('pointerdown',e=>{
  const h=e.target.closest(headerSel);if(!h||!box.contains(h)||e.button!==0||e.target.closest('button,input,select,textarea,a,label'))return;
  if(innerWidth<900||box.classList.contains('ww-take-max'))return;
  e.preventDefault();const [tx,ty]=(box.style.translate||'0px 0px').split(' ').map(v=>parseFloat(v)||0);
  const r=box.getBoundingClientRect(),start={x:e.clientX,y:e.clientY,tx,ty,r};h.setPointerCapture(e.pointerId);box.classList.add('pvs-moving');
  const move=ev=>{const dx=clamp(ev.clientX-start.x,-start.r.left+8-0,innerWidth-start.r.right-8),dy=clamp(ev.clientY-start.y,-start.r.top+8,innerHeight-start.r.top-48);box.style.translate=(start.tx+dx)+'px '+(start.ty+dy)+'px';box.setAttribute('data-pvs-moved','');};
  const up=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);box.classList.remove('pvs-moving');};
  h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
 });
 const home=()=>{box.style.translate='';box.removeAttribute('data-pvs-moved');};
 box.addEventListener('dblclick',e=>{if(e.target.closest(headerSel)&&!e.target.closest('button,input,select'))home();});
 // A dialog opens where it was designed to; a moved position lasts until it closes.
 if(box.tagName==='DIALOG')box.addEventListener('close',home);
 else{const host=box.closest('[hidden],.stmodal')||box.parentElement;new MutationObserver(()=>{if(host.hidden)home();}).observe(host,{attributes:true,attributeFilter:['hidden']});}
}
function wireDialogs(){
 const take=$('vocalEditor')?.querySelector('.stdialog');movable(take,'header','take');
 const song=$('songDialog');movable(song,'h2,.sg-dialog-head,header','song');
 for(const d of document.querySelectorAll('dialog'))movable(d,'header,h2','dlg');
}
wireDialogs();new MutationObserver(wireDialogs).observe(document.body,{childList:true});

/* ---------- View → Reset layout ---------- */
const viewMenu=[...document.querySelectorAll('.menubar .menu')].find(m=>/^\s*View\s*$/.test(m.querySelector('.mtop')?.textContent||''));
if(viewMenu){const b=document.createElement('button');b.setAttribute('role','menuitem');b.id='pvsResetLayout';b.textContent='Reset panel sizes';b.onclick=()=>{resetAll();viewMenu.querySelector('.mdrop').hidden=true;};viewMenu.querySelector('.mdrop').append(b);}
window.PanelLayout={reset:resetAll,set,get:n=>prefs[n]??null,prefs:()=>({...prefs})};
})();
