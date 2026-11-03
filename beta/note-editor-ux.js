/* 0.34.0: easier tuning window. The settings column becomes four short tabs (Note · Tune · Check · More);
   presets sit with Automatic tuning; the key warning sits beside KEY; classic tools are hidden unless the
   Classic tools switch is on. Controls are moved, never rebuilt: ids, handlers, saved settings and audio are
   unchanged. View preferences are kept on this device only. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const CLASSIC='pvs.classicTools',TAB='pne.sideTab';
const read=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(_){return d;}};
const write=(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}};
const TABS=[['note','Note'],['tune','Tune'],['check','Check'],['more','More']];
let tab=read(TAB,'tune');if(!TABS.some(t=>t[0]===tab))tab='tune';
let autoFrom=null; // the tab to return to after a note selection opened the Note tab
const panels=document.querySelector('.panels');if(!panels)return;
const root=document.documentElement;

const css=document.createElement('style');css.textContent=`
.neTabs{display:flex;align-self:stretch;width:100%;box-sizing:border-box;gap:4px;padding:4px;background:var(--bg);border:1px solid var(--line);border-radius:10px;grid-column:1/-1;position:sticky;top:0;z-index:3;flex-shrink:0}
.neTabs button{flex:1 1 0;min-height:36px;border:0;border-radius:7px;background:transparent;color:var(--muted);font-weight:600;font-size:13.5px;font-family:inherit;cursor:pointer;padding:4px 6px;white-space:nowrap}
.neTabs button[aria-selected="true"]{background:var(--panel);color:var(--ink);box-shadow:0 0 0 1px var(--line)}
.neTabs button:focus-visible{outline:2px solid var(--sel);outline-offset:1px}
.neTabs .dot{display:inline-block;min-width:16px;margin-left:5px;padding:0 4px;border-radius:8px;background:var(--accent);color:var(--bg);font-size:11px;line-height:16px}
.panels>.panel[data-tab]:not(.tabOn){display:none!important}
.panels[data-tab]:not([data-tab="more"])>:not(.panel):not(.neTabs){display:none!important}
@media (min-width:760px){.panels>#notePanel{grid-row:auto}}
@media (min-width:1000px) and (max-height:650px){
  .hosted.work-window:not(.focus-notes) .mainCol{row-gap:6px}
}
.noteTip{margin:0}
.noteHow summary{cursor:pointer;color:var(--muted);font-size:13px}
.noteHow p{margin:6px 0 0}
.keyLine{display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;margin:0;padding:3px 8px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;line-height:1.35;color:var(--muted)}
.keyLine .btn,.hosted .mainCol .keyLine .btn{height:28px;min-height:28px;padding:0 10px;font-size:12.5px}
.keyLine #refInfo{margin:0;font-size:12px;flex:1 1 100%}
.keyLine #refInfo:empty{display:none}
.keyLine:empty,.keyLine.blank{display:none}
.keyLine .hint{margin:0}
.keyLine .keywarn{color:var(--warn,#f5c875);font-weight:600}
.keyLine.warn{border-color:var(--warn,#f5c875)}
html.pvs-simple .neClassic{display:none!important}
.hosted.work-window.focus-notes .keyLine{display:none}
#classicPanel label{display:flex;gap:8px;align-items:flex-start}
`;document.head.append(css);

/* ---------- tabs ---------- */
const bar=document.createElement('div');bar.className='neTabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Tuning settings');
for(const [k,t] of TABS){const b=document.createElement('button');b.type='button';b.id='neTab-'+k;b.dataset.tab=k;b.setAttribute('role','tab');b.innerHTML=t;b.onclick=()=>{autoFrom=null;show(k,true);};bar.append(b);}
panels.prepend(bar);
const assign={note:['notePanel'],tune:['tuningPresets','smoothPanel','correctPanel'],check:['comparePanel','checkPanel'],more:['voicePanel','gridPanel','harmPanel','detPanel','classicPanel']};

// Check: chords and the correction map move out of the presets panel into their own panel.
const presets=$('tuningPresets');
function section(fromH3,stop){const out=[];let el=fromH3;while(el&&!(el!==fromH3&&el.tagName==='H3')&&el!==stop){out.push(el);el=el.nextElementSibling;}return out;}
const h3s=presets?[...presets.querySelectorAll(':scope > h3')]:[];
const findH3=re=>h3s.find(h=>re.test(h.textContent));
const chordH=findH3(/Chords and corrections/i);
if(chordH){const p=document.createElement('div');p.className='panel';p.id='checkPanel';p.innerHTML='<div class="phead"><h2>Check your tuning</h2></div><p class="hint">See where tuning works hardest, and which notes clash with the riddim\'s chords.</p>';
 const parts=section(chordH);parts.shift();p.append(...parts);$('comparePanel')?.after(p);chordH.remove();}
// Classic: the original approved presets and Correct pitch.
const apH=findH3(/Original approved/i);
if(apH){const box=document.createElement('div');box.className='neClassic';box.id='classicApproved';const parts=section(apH);
 // keep the sound-profile hint visible for everyone
 const sh=$('presetSoundHint');const keep=parts.filter(x=>x!==sh);apH.before(box);box.append(...keep);}
$('correctPanel')?.classList.add('neClassic');
const rh=findH3(/Research presets/i);if(rh)rh.textContent='Presets';
// Automatic tuning sits right under the presets it works with.
if(presets&&$('smoothPanel'))presets.after($('smoothPanel'));
// More: the Classic tools switch.
const cp=document.createElement('div');cp.className='panel';cp.id='classicPanel';
cp.innerHTML='<div class="phead"><h2>Classic tools</h2></div><label class="chk" for="classicTools"><input type="checkbox" id="classicTools"> <span>Show classic tools: the original approved presets (Snap all + Smooth 25%, 85% correction + Smooth 25%), Correct pitch and the Classic Smooth mode. Also shows the older tuner and cleaner in the studio.</span></label><p class="hint">They are hidden only to keep things simple. Saved songs, settings and sound do not change.</p>';
panels.append(cp);
$('classicTools').onchange=e=>{write(CLASSIC,e.target.checked?'1':'0');apply();try{parent!==window&&parent.PvsUX?.apply();}catch(_){}};
for(const [k,ids] of Object.entries(assign))for(const id of ids)$(id)?.setAttribute('data-tab',k);

// Selected note: a one-line tip; the full how-to folds.
const empty=$('noteEmpty');
if(empty&&!empty.dataset.ux){empty.dataset.ux='1';const full=empty.textContent.trim();empty.textContent='';
 const tip=document.createElement('span');tip.className='noteTip';tip.textContent='Tap a note to edit it. Drag the strip above the notes to loop a section.';
 const d=document.createElement('details');d.className='noteHow';d.innerHTML='<summary>How to edit notes</summary>';const p=document.createElement('p');p.textContent=full;d.append(p);
 empty.append(tip,d);}

// One key line, right under KEY / SCALE / TUNE TO.
const tools=document.querySelector('.tools'),kh=$('presetKeyHint'),ub=$('useDetectedKey');
if(tools&&kh){const line=document.createElement('div');line.className='keyLine';line.id='keyLine';line.setAttribute('role','status');tools.after(line);line.append(kh);if(ub)line.append(ub);const ri=$('refInfo');if(ri)line.append(ri);
 const syncLine=()=>{line.classList.toggle('warn',kh.classList.contains('keywarn'));line.classList.toggle('blank',!kh.textContent.trim()&&(!ub||ub.hidden)&&!($('refInfo')?.textContent.trim()));};
 new MutationObserver(syncLine).observe(kh,{childList:true,characterData:true,subtree:true,attributes:true});if(ub)new MutationObserver(syncLine).observe(ub,{attributes:true});syncLine();}

// Undo / Redo in the editor say what they undo.
// (set in apply(): an empty editor temporarily replaces titles until a vocal loads)
function labels(){for(const [id,t] of [['undo','Undo note edit'],['redo','Redo note edit']]){const b=$(id);if(b&&!b.inert&&!b.title.startsWith(t)){b.title=t+(id==='undo'?' (Ctrl+Z)':' (Ctrl+Y)');b.setAttribute('aria-label',t);}}}

function show(k,user){
 tab=k;if(user)write(TAB,k);
 for(const b of bar.children)b.setAttribute('aria-selected',String(b.dataset.tab===k));
 for(const p of panels.querySelectorAll(':scope > .panel[data-tab]'))p.classList.toggle('tabOn',p.dataset.tab===k);
 panels.dataset.tab=k;
}
// Selecting notes opens the Note tab; clearing the selection returns to where you were.
const nb=$('noteBody');
if(nb)new MutationObserver(()=>{const on=!nb.hidden;
 const n=(()=>{try{return window.PlaybookNoteEditor?.state?.().selection?.length||0;}catch(_){return 0;}})();
 const label=$('neTab-note');if(label)label.innerHTML='Note'+(on?'<span class="dot">'+(n>1?n:'✓')+'</span>':'');
 if(on&&tab!=='note'){autoFrom=tab;show('note');}else if(!on&&autoFrom){const back=autoFrom;autoFrom=null;show(back);}
}).observe(nb,{attributes:true,attributeFilter:['hidden']});

/* ---------- Classic tools ---------- */
function apply(){
 const on=read(CLASSIC,'0')==='1';root.classList.toggle('pvs-simple',!on);labels();
 const cb=$('classicTools');if(cb)cb.checked=on;
 const mode=$('autoMode'),opt=mode?.querySelector('option[value="classic"]');
 // Classic Smooth is the starting sound of every new vocal (and Hard Effect), so it always shows when in use.
 if(opt){opt.hidden=!on&&mode.value!=='classic';opt.textContent=mode.value==='classic'&&!on?'Classic Smooth (current)':'Classic Smooth';}
 // Blind compare: the original approved presets are classic tools too (not while a test is running).
 const ids=['cmpA','cmpB','cmpC'],run=$('cmpRun');
 if(!on&&run&&!run.hidden&&ids.some(id=>/^approved/.test($(id)?.value||'')))$('cmpCancel')?.click();
 if(run&&run.hidden)for(const id of ids){const s=$(id);if(!s)continue;for(const o of s.options)if(/^approved/.test(o.value))o.hidden=!on;
  if(!on&&/^approved/.test(s.value)){const pick=['roots','gentle','tight','hard'].find(v=>!ids.some(j=>$(j)?.value===v));if(pick)s.value=pick;}}
}
addEventListener('storage',e=>{if(e.key===CLASSIC)apply();});
setInterval(apply,800);
show(tab);apply();
window.PlaybookUX={apply,show,tab:()=>tab};
})();
