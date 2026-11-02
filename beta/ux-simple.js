/* 0.34.0: easier to use. Rearranges existing controls so each feature's controls sit together; it never
   changes processing, saved projects or Undo. Every control keeps its id and handlers: it is moved, folded or
   relabelled, not rebuilt.
   - Classic tools switch (View menu and the tuning window, off by default): hides the older tuner, the older
     cleaner and old RECORD & COMP menu items. A song that uses one of them keeps it visible.
   - CLEAN: the everyday controls first; learning a noise sample, room profiles, AI isolation, filters and the
     loudness graph fold under "More cleaning controls". One background-noise area.
   - CHAIN: the detailed EQ, second EQ and echo racks fold (remembered on this device).
   - A small listen strip at the top of CLEAN, TUNE and CHAIN, pinned while you scroll.
   - Laptop: one-row step header so the settings panel gets the window height; the editor panel starts as a
     slim bar until opened (remembered). Phone: tabs and listen strip pinned; Song & vocals tools above the
     tracks and the takes right under them.
   - Clearer labels for duplicate Play / Undo / tuning-window buttons and old menu names; one key line. */
(function(){
'use strict';
const $=id=>document.getElementById(id),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const CLASSIC='pvs.classicTools',FOLDS='pvs.folds.v1',DOCKS='pvs.dockOpen.v1';
const DOCK=()=>DOCKS+(innerWidth>=900?'':'.narrow');
const read=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(_){return d;}};
const write=(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}};
let classic=read(CLASSIC,'0')==='1';
let folds={};try{folds=JSON.parse(read(FOLDS,'{}'))||{};}catch(_){folds={};}
const wide=()=>innerWidth>=900;
const body=document.body;

/* ---------------- Classic tools ---------------- */
function frameDoc(){try{return $('noteEditorFrame')?.contentDocument||null;}catch(_){return null;}}
function setClassic(on){classic=!!on;write(CLASSIC,classic?'1':'0');apply();}
// Only a vocal open in POLISH can be "using" the older tuner or cleaner (before that the choices hold defaults).
function legacyInUse(){const bound=window.RC?.step==='polish'&&!!window.SongPolish?.state?.().binding;return {tuner:bound&&$('tunerChoice')?.value==='original',cleaner:bound&&$('noiseChoice')?.value==='original'};}
function apply(){
 body.classList.toggle('pvs-simple',!classic);body.classList.toggle('pvs-classic',classic);
 const use=legacyInUse();body.classList.toggle('pvs-legacy-tuner',use.tuner);body.classList.toggle('pvs-legacy-cleaner',use.cleaner);
 const item=$('uxClassicItem');if(item){item.setAttribute('aria-checked',String(classic));item.querySelector('b').textContent=classic?'On':'Off';}
 const help=$('noteRouteHelp');if(help){if(!help.dataset.uxOld)help.dataset.uxOld=help.textContent;
  help.textContent=classic||use.tuner?help.dataset.uxOld:'Tune in the note editor: pick a preset on its Tune tab, then fix single notes. Cleaning and the vocal chain stay in their own tabs.';}
 const fd=frameDoc();if(fd?.documentElement){fd.documentElement.classList.toggle('pvs-simple',!classic);try{fd.defaultView.PlaybookUX?.apply();}catch(_){}}
}
addEventListener('storage',e=>{if(e.key===CLASSIC){classic=e.newValue==='1';apply();}});
function markClassic(el,inUse){if(!el)return;el.classList.add('ux-classic-only');if(inUse)el.dataset.uxUse=inUse;}

/* ---------------- Menus and names ---------------- */
function menus(){
 const view=qa('.menubar .menu').find(m=>/^\s*View\s*$/.test(m.querySelector('.mtop')?.textContent||''));
 if(view&&!$('uxClassicItem')){const b=document.createElement('button');b.id='uxClassicItem';b.setAttribute('role','menuitemcheckbox');b.setAttribute('aria-checked','false');
  b.innerHTML='Classic tools (older tuner &amp; cleaner) <b>Off</b>';b.title='Show the older tuner, the older cleaner, the original approved presets and Correct pitch. A song that uses one of them always shows it.';
  b.onclick=()=>{setClassic(!classic);view.querySelector('.mdrop').hidden=true;view.querySelector('.mtop')?.setAttribute('aria-expanded','false');};
  view.querySelector('.mdrop').append(document.createElement('hr'),b);}
 const act=a=>document.querySelector('.mdrop [data-act="'+a+'"]');
 if(act('toRC'))act('toRC').textContent='Back to 1 Song & vocals';
 if(act('session')){act('session').textContent='Session & tracks (classic)…';markClassic(act('session'));}
 if(act('loadComp')){act('loadComp').textContent='Load my latest comp (classic RECORD & COMP)';markClassic(act('loadComp'));}
 const dock=qa('.mdrop [data-act^="dock:"]');for(const b of dock)b.textContent=b.textContent.replace(' (dock)',' (editor panel)');
 if(act('dockToggle'))act('dockToggle').textContent='Show / hide editor panel';
}

/* ---------------- Fold racks ---------------- */
function fold(rack,key,openByDefault,label){
 if(!rack||rack.dataset.uxFold)return;const h=rack.querySelector(':scope > h2');if(!h)return;rack.dataset.uxFold=key;
 const b=document.createElement('button');b.type='button';b.className='ux-fold-btn';b.textContent=label||h.textContent;h.textContent='';h.append(b);
 const set=open=>{rack.classList.toggle('ux-folded',!open);b.setAttribute('aria-expanded',String(open));};
 set(key in folds?!!folds[key]:openByDefault);
 b.onclick=()=>{const open=rack.classList.contains('ux-folded');set(open);folds[key]=open;write(FOLDS,JSON.stringify(folds));requestAnimationFrame(()=>{if(typeof drawAll==='function')try{drawAll();}catch(_){}dispatchEvent(new Event('resize'));});};
}
function moreBox(id,label,key){
 const d=document.createElement('div');d.className='ux-more';d.id=id;
 const b=document.createElement('button');b.type='button';b.className='ux-more-btn';b.textContent=label;
 const inner=document.createElement('div');inner.className='ux-more-body';d.append(b,inner);
 const set=open=>{d.classList.toggle('open',open);b.setAttribute('aria-expanded',String(open));inner.hidden=!open;};
 set(!!folds[key]);b.onclick=()=>{const open=!d.classList.contains('open');set(open);folds[key]=open;write(FOLDS,JSON.stringify(folds));if(open)requestAnimationFrame(()=>{if(typeof drawAll==='function')try{drawAll();}catch(_){}});};
 return {box:d,body:inner,open:()=>{set(true);}};
}

/* ---------------- Listen strip ---------------- */
function strip(panel,modes,label){
 if(!panel||panel.querySelector(':scope > .ux-listen'))return;
 const s=document.createElement('div');s.className='ux-listen';s.setAttribute('role','group');s.setAttribute('aria-label','Listen and compare');
 s.innerHTML='<span>LISTEN</span>';const seg=document.createElement('div');seg.className='seg';s.append(seg);
 for(const [mode,text] of modes){const src=document.querySelector('#abSeg [data-mode="'+mode+'"]');if(!src)continue;
  const b=document.createElement('button');b.type='button';b.dataset.mode=mode;b.dataset.uxProxy='1';b.textContent=text;b.onclick=()=>src.click();seg.append(b);}
 if(label){const l=document.createElement('small');l.textContent=label;s.append(l);}
 panel.prepend(s);
}
function syncStrips(){for(const b of qa('.ux-listen [data-ux-proxy]')){const src=document.querySelector('#abSeg [data-mode="'+b.dataset.mode+'"]');if(!src)continue;b.setAttribute('aria-pressed',src.getAttribute('aria-pressed')||'false');b.disabled=src.disabled;}}

/* ---------------- CLEAN ---------------- */
function arrangeClean(){
 const host=$('studioNoiseControls'),studio=host?.closest('.rack'),plus=host?.querySelector('.noise-plus'),page=$('page-clean');
 if(!host||!plus||!page||host.dataset.ux)return false;host.dataset.ux='1';
 // One background-noise area: the measurement moves into Noise removal.
 const big=$('noiseBig'),oldRack=big?.closest('.rack');
 const head=document.createElement('div');head.className='ux-noise-head';
 for(const id of ['noiseBig','noiseVerdict','humInfo','musicWarn'])if($(id))head.append($(id));
 studio.querySelector(':scope > h2').after(head);
 markClassic($('noiseChoice')?.closest('label'),'cleaner');
 // Everyday controls first.
 const reduction=$('noiseReduction')?.closest('label'),undo=$('noiseUndo')?.closest('.row'),aiField=$('noiseAi')?.closest('label');
 const more=moreBox('uxCleanMore','More cleaning controls: learn noise, room profiles, AI isolation, filters','clean-more');
 if(reduction)plus.after(reduction);
 if(undo)(reduction||plus).after(undo);
 if($('noiseMeasured'))(undo||reduction||plus).after($('noiseMeasured'));
 host.append(more.box);
 // Learn the background … the "Choose 0.2–10 seconds" note.
 const learnH=[...host.querySelectorAll(':scope > h3')].find(h=>/Learn the background/i.test(h.textContent));
 if(learnH){let el=learnH;const take=[];while(el&&el!==more.box){take.push(el);if(el.tagName==='P'&&/0\.2.?10 seconds/.test(el.textContent))break;el=el.nextElementSibling;}
  for(const x of take)if(x!==reduction&&x!==undo&&x!==$('noiseMeasured'))more.body.append(x);}
 if(aiField){const h=document.createElement('h3');h.textContent='AI voice isolation';more.body.append(h,aiField);}
 const det=host.querySelector(':scope > details');if(det){det.open=true;const h=document.createElement('h3');h.textContent='Vocal protection & filters';const s=det.querySelector('summary');if(s)s.hidden=true;more.body.append(h,det);}
 const vd=oldRack?.querySelector('[data-open-detail]');if(vd){vd.classList.add('ux-wide');more.body.append(vd);}
 if(oldRack&&!oldRack.querySelector('.big,.verdict,button'))oldRack.classList.add('ux-empty');
 // Listen buttons at the top of CLEAN; the loudness graph folds.
 const listen=$('cleanListen'),graph=listen?.closest('.rack');
 if(listen){const s=document.createElement('div');s.className='ux-listen';s.setAttribute('role','group');s.setAttribute('aria-label','Listen and compare');s.innerHTML='<span>LISTEN</span>';s.append(listen);
  const t=document.createElement('small');t.textContent='REMOVED plays only what was taken out: it should sound like background only.';s.append(t);page.prepend(s);}
 if(graph){const h=graph.querySelector(':scope > h2');if(h)h.textContent='Loudness graph';fold(graph,'clean-graph',false);}
 return true;
}

/* ---------------- TUNE ---------------- */
function arrangeTune(){
 const page=$('page-tune'),choice=$('tunerChoice');if(!page||!choice||page.dataset.ux)return false;page.dataset.ux='1';
 markClassic(choice.closest('label'),'tuner');
 strip(page,[['cleaned','CLEANED'],['after','TUNED']],'TUNED is your vocal after the note editor, before the chain.');
 choice.addEventListener('change',()=>setTimeout(apply,50));
 return true;
}

/* ---------------- CHAIN ---------------- */
function arrangeChain(){
 const page=$('page-chain');if(!page||page.dataset.ux)return false;page.dataset.ux='1';
 strip(page,[['after','TUNED'],['final','FINAL']],'FINAL adds the vocal chain.');
 const racks=qa(':scope > .rack',page),by=t=>racks.find(r=>new RegExp(t,'i').test(r.querySelector(':scope > h2')?.textContent||''));
 fold(by('^EQ'),'chain-eq',false);fold(by('^Second EQ'),'chain-eq2',false);fold(by('^Echo'),'chain-echo',false);
 fold(by('^Dynamics'),'chain-dyn',true);fold(by('^Level'),'chain-level',true);
 return true;
}

/* ---------------- Header, transport and editor panel ---------------- */
function arrangeHeader(){
 const bar=$('trackPolishBar');if(!bar||bar.dataset.ux)return false;bar.dataset.ux='1';
 const p=bar.querySelector(':scope > p');if(p){bar.title=p.textContent.trim();p.classList.add('ux-explain');}
 $('polishWave')?.classList.add('ux-dup');               // WAVE EDIT tab and its own "Open editing window" stay
 $('polToRC')?.classList.add('ux-dup');                  // same as "← Song & vocals" in the Polishing bar
 // Play buttons say what they play.
 const play=$('playBtn');if(play&&!play.querySelector('.ux-what')){const s=document.createElement('small');s.className='ux-what';s.textContent='this vocal';play.append(s);play.title='Play / pause this vocal with its backing (Space). ▶ Whole song plays every lane.';}
 // Undo buttons say what they undo.
 const nm=[['rcUndo','Undo song edit (takes, sections, moves)'],['rcRedo','Redo song edit'],['recordWindowUndo','Undo song edit'],['recordWindowRedo','Redo song edit'],['sgUndo','Undo song edit'],['sgRedo','Redo song edit']];
 for(const [id,t] of nm)if($(id)){$(id).title=t;$(id).setAttribute('aria-label',t);}
 for(const id of ['recordWindowUndo','recordWindowRedo'])if($(id))$(id).textContent=id.endsWith('Undo')?'Undo song edit':'Redo song edit';
 // The tuning window has its own Play/Stop: the title-bar copies show only for the other workspaces.
 const sync=()=>{const notes=window.DAW?.dock==='notes';for(const id of ['workWindowPlay','workWindowStop'])$(id)?.classList.toggle('ux-dup',!!notes);};
 sync();if($('dock'))new MutationObserver(sync).observe($('dock'),{attributes:true,attributeFilter:['data-workspace']});
 // The "Open … window" launcher sits in the editor panel's tab row.
 const launch=$('workWindowOpen'),tabs=document.querySelector('#dock .dtabs');if(launch&&tabs){tabs.insertBefore(launch,$('dockToggle'));launch.classList.add('ux-in-tabs');}
 return true;
}
let dockInit=false;
function arrangeDock(){
 const dock=$('dock');if(!dock||dockInit)return;dockInit=true;
 // Laptop: the editor panel starts as a slim tab bar; opening any editor tab, or the TUNE tab, opens it.
 // Phone: the note editor opens from the TUNE tab's "Open tuning window" instead of sitting below the timeline.
 if(read(DOCK(),'0')!=='1')dock.classList.add('collapsed');
 // A tuning/editing window opened from a slim panel puts it back to slim when it closes.
 let inWindow=false,wasSlim=false;
 new MutationObserver(()=>{const win=dock.classList.contains('ww-window');
  if(win&&!inWindow){inWindow=true;wasSlim=read(DOCK(),'0')!=='1';return;}
  if(!win&&inWindow){inWindow=false;if(wasSlim){dock.classList.add('collapsed');return;}}
  if(!win)write(DOCK(),dock.classList.contains('collapsed')?'0':'1');if(typeof drawAll==='function')requestAnimationFrame(()=>{try{drawAll();}catch(_){}});}).observe(dock,{attributes:true,attributeFilter:['class']});
 const tune=document.querySelector('.itabs [data-tab="tune"]');
 tune?.addEventListener('click',()=>{if(wide()&&dock.classList.contains('collapsed')&&window.NoteTuner?.enabled?.()&&typeof dawDock==='function')dawDock('notes');});
 const t=$('dockToggle');if(t){t.title='Show / hide the editor panel';t.setAttribute('aria-label','Show or hide the editor panel');}
}

/* ---------------- One key line ---------------- */
let keyText='';
function syncKey(){
 const k=$('dawKey');if(!k||!window.NoteTuner?.enabled?.())return;
 const d=frameDoc(),ks=d?.getElementById('key'),ss=d?.getElementById('scale');if(!ks||!ss||!ks.options.length)return;
 const t='Key '+ks.options[ks.selectedIndex]?.text+' '+(ss.options[ss.selectedIndex]?.text||'').toLowerCase();
 if(k.textContent!==t){keyText=t;k.textContent=t;}
 const b=$('dawTempo');if(b&&!b.dataset.ux){b.dataset.ux='1';b.title='Tempo is set on CHAIN. The key is set in the note editor (KEY), next to your singing\'s detected key.';}
}

/* ---------------- Song & vocals ---------------- */
function arrangeSong(){
 const tools=document.querySelector('#songStudio > .sg-tools');if(!tools||tools.dataset.ux)return false;tools.dataset.ux='1';
 tools.setAttribute('aria-label','Timeline tools');
 return true;
}

/* ---------------- Boot ---------------- */
let tries=0;
function arrange(){
 menus();
 const done=[arrangeClean(),arrangeTune(),arrangeChain(),arrangeHeader(),arrangeSong()];arrangeDock();
 apply();syncStrips();
 if(!done.every(x=>x!==false)||!document.querySelector('#studioNoiseControls[data-ux]'))if(++tries<150)setTimeout(arrange,200);
}
function boot(){arrange();
 const ab=$('abSeg');if(ab)new MutationObserver(syncStrips).observe(ab,{subtree:true,attributes:true,attributeFilter:['aria-pressed','disabled']});
 setInterval(()=>{const rm=$('sgRoom'),ck=$('sgClock');if(rm&&ck&&ck.title!==rm.textContent)ck.title=rm.textContent;const u=legacyInUse();if(u.tuner!==body.classList.contains('pvs-legacy-tuner')||u.cleaner!==body.classList.contains('pvs-legacy-cleaner'))apply();syncKey();},700);
 const k=$('dawKey');if(k)new MutationObserver(()=>{if(k.textContent!==keyText)syncKey();}).observe(k,{childList:true,characterData:true,subtree:true});
 // The note editor frame is created on first use: give it the current switch as soon as it loads.
 const np=$('newNotePanel');if(np)new MutationObserver(()=>{const f=$('noteEditorFrame');if(f)f.addEventListener('load',()=>{apply();syncKey();},{once:true});}).observe(np,{childList:true,subtree:true});
 body.classList.add('ux-034');
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
window.PvsUX={classic:()=>classic,setClassic,apply,folds:()=>({...folds})};
})();
