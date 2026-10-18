/* Playbook Vocal Studio 0.14.0 — DAW layout controller.
   Wires the timeline, transport, menus, tabs and shortcuts to the unchanged 0.13 functions
   (startPlayback, phraseSelect, phraseChoose, phraseListen, startRecording via #phraseRecord, …).
   No audio math lives here: only monitor gains (mute / solo / vocal fader) for playback. */
(function(){
'use strict';
const D={tab:'phrase',dock:'notes',ctx:'phrase',pps:0,fit:true,region:null,drag:null,dirty:true,armed:true,
  mix:{vMute:false,vSolo:false,bSolo:false,vVol:1},phraseRedoRev:null,lastDraw:0,heads:'',stoppedAt:null};
window.DAW=D;
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const bpm=()=>Math.min(200,Math.max(50,+$('bpm').value||75));
const isTyping=el=>el&&(el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)&&!/^(checkbox|radio|range|button)$/.test(el.type||''));
const narrow=()=>matchMedia('(max-width: 899px)').matches;

// ---------------------------------------------------------------- monitor gains (called from startPlayback)
const monitored=()=>!loop||!!loop.daw;
window.dawVocalGain=()=>{if(!monitored())return 1;const m=D.mix;if(m.vMute)return 0;if(m.bSolo&&!m.vSolo)return 0;return m.vVol;};
window.dawBeatGain=()=>{if(!monitored())return 1;const m=D.mix;return m.vSolo&&!m.bSolo?0:1;};
function mixChanged(){syncMixUI();if((playing||playPending)&&monitored())restartPlayback();}

// ---------------------------------------------------------------- tabs, dock, modals
const TABS=['phrase','clean','tune','chain','detail','mix'];
function dawTab(t,noScroll){if(!TABS.includes(t))return;D.tab=t;for(const b of qa('.itabs [data-tab]'))b.setAttribute('aria-selected',b.dataset.tab===t);for(const p of qa('.ipanel'))p.hidden=p.dataset.ipanel!==t;
  if(t==='phrase'&&typeof syncPhraseUI==='function')syncPhraseUI();if(t==='detail'&&typeof syncDetail==='function')syncDetail();
  if(t==='tune'&&S.mode==='removed')setMode('after');if(t==='chain'&&S.mode!=='final')setMode('final');
  D.ctx=t==='phrase'?'phrase':'engine';requestAnimationFrame(drawAll);syncUndo();try{localStorage.setItem('pvs-daw-tab',t);}catch(e){}
  if(narrow()&&!noScroll&&D.started){const el=q('.insp');if(el&&el.getBoundingClientRect().top>innerHeight*.6)el.scrollIntoView({behavior:'smooth',block:'start'});}}
function dawDock(d){D.dock=d;$('dock').classList.remove('collapsed');for(const b of qa('.dtabs [data-dock]'))b.setAttribute('aria-selected',b.dataset.dock===d);for(const p of qa('.dpanel'))p.hidden=p.dataset.dpanel!==d;
  if(d==='wave')D.ctx='edit';else if(d==='notes')D.ctx='engine';requestAnimationFrame(()=>{drawAll();});syncUndo();}
window.dawTab=dawTab;window.dawDock=dawDock;
function openModal(id,sub){closeMenus();const m=$(id);m.hidden=false;for(const sec of qa('section.page',m))sec.hidden=false;if(id==='helpModal'){$('helpKeys').hidden=sub!=='keys';$('helpHow').hidden=sub!=='how';$('helpAbout').hidden=sub!=='about';$('helpTitle').textContent={keys:'KEYBOARD SHORTCUTS',how:'HOW RECORDING WORKS',about:'ABOUT THIS ENGINE'}[sub];}
  requestAnimationFrame(()=>{(q('[data-close]',m)).focus();if(sub&&id==='saveModal'&&$(sub))$(sub).scrollIntoView({block:'start'});if(typeof syncCustom==='function'&&id==='saveModal')syncCustom();});}
function closeModals(){let any=false;for(const m of qa('.modal'))if(!m.hidden){m.hidden=true;any=true;}return any;}
for(const b of qa('.modal [data-close]'))b.onclick=()=>{b.closest('.modal').hidden=true;};
for(const m of qa('.modal'))m.addEventListener('pointerdown',e=>{if(e.target===m)m.hidden=true;});

// Replace page navigation: the old pages now live in tabs, dock panels and windows.
showPage=function(p){
  if(p==='record')dawTab('phrase');else if(p==='edit')dawDock('wave');else if(p==='clean'||p==='chain')dawTab(p);
  else if(p==='tune'){dawTab('tune');dawDock('notes');}else if(p==='save')openModal('saveModal');
  // 'open' (after loading / clearing) stays on the timeline; File › Session shows the classic panel.
  requestAnimationFrame(drawAll);D.dirty=true;try{localStorage.setItem('pvs-page',p);}catch(e){}
};
for(const b of qa('[data-open-detail]'))b.onclick=()=>{$('saveModal').hidden=true;dawTab('detail');};
$('guideBtn').onclick=()=>{$('guideSheet').hidden=!$('guideSheet').hidden;syncGuide();};
$('sessionOpen').onclick=()=>openModal('sessionModal');
$('detailClose').addEventListener('click',()=>dawTab('phrase'));
for(const id of ['page-open','page-save'])$(id).hidden=false;
for(const b of qa('.itabs [data-tab]'))b.onclick=()=>dawTab(b.dataset.tab);
for(const b of qa('.dtabs [data-dock]'))b.onclick=()=>dawDock(b.dataset.dock);
$('dockToggle').onclick=()=>{$('dock').classList.toggle('collapsed');D.dirty=true;requestAnimationFrame(layout);};
q('.arrange').addEventListener('pointerdown',e=>{if(e.target.closest('.dock'))return;D.ctx='phrase';syncUndo();},true);
$('dock').addEventListener('pointerdown',()=>{D.ctx=D.dock==='wave'?'edit':D.dock==='notes'?'engine':D.ctx;syncUndo();},true);
q('.ibody').addEventListener('pointerdown',()=>{D.ctx=D.tab==='phrase'?'phrase':'engine';syncUndo();},true);
$('guideSheet').addEventListener('pointerdown',()=>{D.ctx='engine';syncUndo();},true);

// ---------------------------------------------------------------- proxies (menus and duplicate buttons click the real control)
function proxyTarget(el){return el.dataset.proxy?$(el.dataset.proxy):el.dataset.saveProxy?q('#page-save [data-save="'+el.dataset.saveProxy+'"]'):null;}
function syncProxies(){for(const el of qa('[data-proxy],[data-save-proxy]')){const t=proxyTarget(el);if(t)el.disabled=!!t.disabled||!!t.hidden;}}
document.addEventListener('click',e=>{const el=e.target.closest('[data-proxy],[data-save-proxy],[data-act]');if(!el||el.disabled)return;
  if(el.closest('.mdrop'))closeMenus();
  if(el.dataset.act){act(el.dataset.act);return;}
  const t=proxyTarget(el);if(!t||t.disabled)return;if(el.dataset.tab)dawTab(el.dataset.tab);t.click();});
function act(a){
  if(a.startsWith('tab:'))return dawTab(a.slice(4));if(a.startsWith('dock:'))return dawDock(a.slice(5));
  ({session:()=>openModal('sessionModal'),save:()=>openModal('saveModal'),custom:()=>openModal('saveModal','customRack'),reset:()=>{openModal('saveModal','resetRack');$('resetSettings').click();},
    newSession:()=>{if($('newSession').disabled)return;if(confirm('Start a new empty session? This clears the vocal, every take, the backing track and the reference. Undo clear can restore it.'))$('newSession').click();},
    undo:dawUndo,redo:dawRedo,zin:()=>zoom(1.6),zout:()=>zoom(1/1.6),zfit:()=>{D.fit=true;layout();},dockToggle:()=>$('dockToggle').click(),
    help:()=>openModal('helpModal','keys'),howto:()=>openModal('helpModal','how'),about:()=>openModal('helpModal','about')})[a]?.();
}
// menus
function closeMenus(){for(const m of qa('.menu')){q('.mdrop',m).hidden=true;q('.mtop',m).setAttribute('aria-expanded','false');}}
for(const m of qa('.menu')){const top=q('.mtop',m),drop=q('.mdrop',m);
  top.onclick=e=>{e.stopPropagation();const open=drop.hidden;closeMenus();if(open){syncProxies();syncMenuUndo();drop.hidden=false;top.setAttribute('aria-expanded','true');}};
  top.onmouseenter=()=>{if(qa('.mdrop').some(d=>!d.hidden)&&drop.hidden)top.click();};}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menu'))closeMenus();});

// ---------------------------------------------------------------- context-aware undo / redo
function undoState(){
  if(D.ctx==='phrase'){const w=S.phrases;const redo=D.phraseRedoRev!==null&&w&&w.revision===D.phraseRedoRev&&!!phraseUndo;
    return {label:'takes',undo:!!phraseUndo&&!redo&&!phraseBusy(),redo:redo&&!phraseBusy()};}
  const can=!!(S.st&&S.st.canUndo),canR=!!(S.st&&S.st.canRedo),busy=!!(S.busy||rec);
  return {label:D.ctx==='edit'?'wave edit':'sound / notes',undo:can&&!busy,redo:canR&&!busy};
}
function dawUndo(){const s=undoState();if(!s.undo)return;
  if(D.ctx==='phrase'){$('phraseUndo').click();D.phraseRedoRev=S.phrases?.revision??null;}
  else if(D.ctx==='edit')$('editUndo').click();else $('undoBtn').click();setTimeout(syncUndo,60);}
function dawRedo(){const s=undoState();if(!s.redo)return;
  if(D.ctx==='phrase'){$('phraseUndo').click();D.phraseRedoRev=null;}
  else if(D.ctx==='edit')$('editRedo').click();else $('redoBtn').click();setTimeout(syncUndo,60);}
function syncUndo(){const s=undoState();$('dawUndo').disabled=!s.undo;$('dawRedo').disabled=!s.redo;$('dawUndoCtx').textContent=s.label;$('dawUndo').title='Undo · '+s.label+' (Ctrl+Z)';$('dawRedo').title='Redo · '+s.label+' (Ctrl+Shift+Z)';}
function syncMenuUndo(){const s=undoState();for(const b of qa('[data-act="undo"]')){b.disabled=!s.undo;b.firstChild.textContent='Undo · '+s.label;}for(const b of qa('[data-act="redo"]')){b.disabled=!s.redo;b.firstChild.textContent='Redo · '+s.label;}}
$('dawUndo').onclick=dawUndo;$('dawRedo').onclick=dawRedo;

// ---------------------------------------------------------------- transport
function dawStop(){if(rec){if(rec.mr.state!=='inactive')rec.mr.stop();return;}
  const was=playing||playPending;if(loop)endLoop();stopPlayback();if(!was){position=0;view.start=0;}tick();D.dirty=true;}
function dawRecord(){
  if(rec){if(rec.mr.state!=='inactive')rec.mr.stop();return;}
  if(!D.armed){toast('Vocal track not armed','Press the red ● on the VOCAL lane to arm it for recording.');return;}
  if(S.micBlocked||phraseBusy())return;
  const w=phraseWorkspace();let p=selectedPhrase();
  if(!p||(p.selected&&w.cursor>=p.end-.05)){$('phraseLabel').value='';phraseNew(w.cursor);p=selectedPhrase();if(!p)return;}
  dawTab('phrase');requestAnimationFrame(()=>{if(!$('phraseRecord').disabled)$('phraseRecord').click();});
}
function dawLoop(){
  if(loop&&loop.daw){endLoop();D.dirty=true;return;}
  let a,b;const p=typeof selectedPhrase==='function'?selectedPhrase():null,bar=240/bpm();
  if(D.region)[a,b]=D.region;else if(p)[a,b]=[p.start,p.end];else{const pos=currentPos();a=Math.floor(pos/bar)*bar;b=a+4*bar;}
  const c=clipFor(S.mode),avail=Math.max(c?c.chs[0].length/S.rate:0,S.beat&&$('beatOn').checked?S.beat.duration:0);
  b=Math.min(b,avail);if(!(b-a>=.05)){toast('Nothing to loop here','Load a backing track or a vocal, then drag across the ruler to set a loop.');return;}
  endLoop();loop={chs:c?c.chs:null,gain:c?c.gain:1,start:a,end:b,daw:true,follow:true};startPlayback(a);D.dirty=true;
}
$('dawStop').onclick=dawStop;$('dawRec').onclick=dawRecord;$('dawLoop').onclick=dawLoop;
$('dawTempo').onclick=()=>{dawTab('chain');setTimeout(()=>{$('bpm').scrollIntoView({block:'center'});$('bpm').focus();},50);};

// ---------------------------------------------------------------- timeline geometry
const RULER=26,BACK=66,VOC=70,TAKE=44,COMP=40;
function work(){return typeof phraseWorkspace==='function'?phraseWorkspace():null;}
function songDur(){const w=work();return Math.max(w&&(w.phrases.length||w.base)?PhraseCore.duration(w):0,S.beat?.duration||0,songSeconds(),...((S.takes||[]).slice(1).map(t=>t?t.length/S.rate:0)),30);}
function lanesSpec(){const w=work(),n=Math.max(1,...(w?w.phrases.map(p=>p.takes.length):[0])),comp=Math.max(0,(S.takes||[]).length-1);
  const L=[{k:'ruler',h:RULER},{k:'beat',h:BACK},{k:'voc',h:VOC}];for(let i=0;i<n;i++)L.push({k:'take',i,h:TAKE});for(let i=1;i<=comp;i++)L.push({k:'comp',i,h:COMP});
  let y=0;for(const l of L){l.y=y;y+=l.h;}return L;}
D.x=t=>t*pps()-$('tlScroll').scrollLeft;D.lanes=()=>lanesSpec();
function viewW(){return $('tlScroll').clientWidth||600;}
function pps(){const dur=songDur();if(D.fit||!D.pps)return viewW()/dur;return D.pps;}
function zoom(f){const old=pps(),sc=$('tlScroll'),centre=(sc.scrollLeft+viewW()/2)/old;D.fit=false;D.pps=Math.max(viewW()/songDur(),Math.min(400,old*f));layout();sc.scrollLeft=centre*D.pps-viewW()/2;D.dirty=true;}
$('dawZoomIn').onclick=()=>zoom(1.6);$('dawZoomOut').onclick=()=>zoom(1/1.6);$('dawZoomFit').onclick=()=>{D.fit=true;layout();};
$('tlScroll').addEventListener('scroll',()=>{D.dirty=true;},{passive:true});
$('tlScroll').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(e.deltaY<0?1.25:.8);}},{passive:false});
function layout(){const L=lanesSpec(),H=L.at(-1).y+L.at(-1).h,W=viewW(),c=$('dawCanvas'),r=Math.min(2,devicePixelRatio||1);
  $('tlInner').style.width=Math.max(W,Math.ceil(songDur()*pps()))+'px';$('tlInner').style.height=H+'px';
  c.style.width=W+'px';c.style.height=H+'px';if(c.width!==Math.round(W*r)||c.height!==Math.round(H*r)){c.width=Math.round(W*r);c.height=Math.round(H*r);}
  buildHeads(L);D.dirty=true;}
window.addEventListener('resize',()=>{layout();});

// ---------------------------------------------------------------- lane headers
function buildHeads(L){const key=L.map(l=>l.k+(l.i||'')+':'+l.h).join('|');if(key===D.heads){syncHeads();return;}D.heads=key;const host=$('laneHeads');host.innerHTML='';
  for(const l of L){const d=document.createElement('div');d.className='lhead '+l.k;d.style.height=l.h+'px';
    if(l.k==='ruler')d.innerHTML='<div class="ls">bars · '+'<span id="lhBpm"></span></div>';
    else if(l.k==='beat')d.innerHTML='<div class="ln">BACKING</div><div class="ls" id="lhBeatName">none · File › Open backing</div><div class="lc"><button class="msb" data-ms="bMute" title="Mute backing (also in recording)">M</button><button class="msb" data-ms="bSolo" title="Solo backing">S</button><input type="range" id="lhBeatVol" min="0" max="100" aria-label="Backing level"></div>';
    else if(l.k==='voc')d.innerHTML='<div class="ln">VOCAL</div><div class="ls" id="lhVocName">assembled lead</div><div class="lc"><button class="msb" data-ms="vMute" title="Mute vocal (monitor)">M</button><button class="msb" data-ms="vSolo" title="Solo vocal">S</button><button class="msb arm" id="lhArm" title="Record-arm the vocal track" aria-pressed="true">●</button><input type="range" id="lhVocVol" min="0" max="150" aria-label="Vocal monitor level"></div>';
    else if(l.k==='take')d.innerHTML='<div class="ln">Take '+(l.i+1)+'</div><div class="lc"><span class="ls lhTakeInfo" data-i="'+l.i+'">phrase takes</span><button class="msb choose" data-choose="'+l.i+'" title="Choose this take for the selected phrase">Choose</button></div>';
    else d.innerHTML='<div class="ln">Comp take '+l.i+'</div><div class="lc"><span class="ls">EDIT · passages</span><button class="msb choose" data-comp="'+l.i+'" title="Open this comp take in WAVE EDIT">Use…</button></div>';
    host.appendChild(d);}
  for(const b of qa('[data-choose]',host))b.onclick=()=>{const p=selectedPhrase(),t=p?.takes[+b.dataset.choose];if(t)phraseChoose(t.id);};
  for(const b of qa('[data-comp]',host))b.onclick=()=>openComp(+b.dataset.comp);
  $('lhArm').onclick=()=>{D.armed=!D.armed;syncHeads();};
  $('lhBeatVol').oninput=e=>setBeatLevel(+e.target.value);$('lhVocVol').oninput=e=>{D.mix.vVol=+e.target.value/100;syncMixUI();};$('lhVocVol').onchange=mixChanged;
  syncHeads();}
function syncHeads(){const w=work(),p=w&&selectedPhrase();
  if($('lhBeatName'))$('lhBeatName').textContent=S.beat?S.beatName+' · '+Math.round(S.beatLevel*100)+'%':'none · File › Open backing';
  if($('lhVocName'))$('lhVocName').textContent=S.main?(S.name||'vocal'):w&&w.phrases.length?w.phrases.length+' phrases':'record or import';
  if($('lhArm'))$('lhArm').setAttribute('aria-pressed',D.armed);
  if($('lhBpm'))$('lhBpm').textContent=bpm()+' BPM';
  for(const b of qa('[data-choose]')){const t=p?.takes[+b.dataset.choose];b.disabled=!t||phraseBusy();b.textContent=t&&p.selected===t.id?'Chosen':'Choose';}
  for(const s of qa('.lhTakeInfo')){const t=p?.takes[+s.dataset.i];s.textContent=t?t.name:'—';}
  syncMixUI();}
function setBeatLevel(v){$('beatLevel').value=v;$('beatLevel').dispatchEvent(new Event('input'));syncMixUI();}
function syncMixUI(){const m=D.mix;
  for(const b of qa('[data-ms]')){const k=b.dataset.ms,on=k==='bMute'?!$('beatOn').checked:!!m[k];b.setAttribute('aria-pressed',on);if(k==='bMute')b.disabled=$('beatOn').disabled;}
  const bl=Math.round(S.beatLevel*100);for(const id of ['lhBeatVol','mixBeatFader'])if($(id)&&document.activeElement!==$(id))$(id).value=bl;
  $('mixBeatVal').textContent=bl+'%';const vv=Math.round(m.vVol*100);for(const id of ['lhVocVol','mixVocFader'])if($(id)&&document.activeElement!==$(id))$(id).value=vv;$('mixVocVal').textContent=vv+'%';}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ms]');if(!b||b.disabled)return;const k=b.dataset.ms;
  if(k==='bMute'){$('beatOn').checked=!$('beatOn').checked;$('beatOn').dispatchEvent(new Event('change'));syncMixUI();return;}
  D.mix[k]=!D.mix[k];mixChanged();});
$('mixBeatFader').oninput=e=>setBeatLevel(+e.target.value);
$('mixVocFader').oninput=e=>{D.mix.vVol=+e.target.value/100;syncMixUI();};$('mixVocFader').onchange=mixChanged;
function openComp(i){if(!S.takes[i])return;dawDock('wave');const tb=q('#editTabs [data-etab="comp"]');if(S.edit.tab!=='comp')tb.click();$('takeSel').value=String(i);$('takeSel').dispatchEvent(new Event('change'));D.dirty=true;}

// ---------------------------------------------------------------- peaks cache (100 per second)
const peakCache=new WeakMap();
function peaks(arr,rate){if(!arr)return null;let p=peakCache.get(arr);if(p&&p.rate===rate)return p;const step=Math.max(1,Math.round(rate/100)),n=Math.ceil(arr.length/step),out=new Float32Array(n);
  for(let k=0,i=0;k<n;k++,i+=step){let m=0;const e=Math.min(arr.length,i+step);for(let j=i;j<e;j+=2){const v=arr[j]<0?-arr[j]:arr[j];if(v>m)m=v;}out[k]=m;}p={data:out,rate,step};peakCache.set(arr,p);return p;}
function drawPeaks(g,P,origin,t0,t1,y,h,color,X){if(!P)return;const a=Math.max(0,X(t0)),b=Math.min(g.canvas.width,X(t1));if(b<=a)return;g.fillStyle=color;const per=100,mid=y+h/2,half=h/2-2,s=pps();
  for(let x=Math.floor(a);x<b;x++){const ta=(x+$('tlScroll').scrollLeft)/s-origin,tb=ta+1/s;let i0=Math.floor(ta*per*P.rate/(P.step*100)),i1=Math.ceil(tb*per*P.rate/(P.step*100));i0=Math.max(0,i0);i1=Math.min(P.data.length,Math.max(i0+1,i1));let m=0;for(let i=i0;i<i1;i++)if(P.data[i]>m)m=P.data[i];if(i0>=P.data.length)continue;const hh=Math.max(1,Math.min(1,m*1.6)*half);g.fillRect(x,mid-hh,1,hh*2);}}

// ---------------------------------------------------------------- drawing
function playheadTime(){let t=currentPos();if(loop&&loop.phrase)t+=loop.beatOffset||0;return t;}
function draw(){const c=$('dawCanvas'),g=c.getContext('2d');if(!g)return;const r=c.width/(parseFloat(c.style.width)||1);g.setTransform(r,0,0,r,0,0);
  const W=parseFloat(c.style.width),L=lanesSpec(),H=L.at(-1).y+L.at(-1).h,s=pps(),sl=$('tlScroll').scrollLeft,X=t=>t*s-sl,w=work();
  g.clearRect(0,0,W,H);
  for(const l of L){g.fillStyle=l.k==='ruler'?'#0d1115':l.k==='beat'?'#111827':l.k==='voc'?'#0f1a1a':(l.k==='take'?(l.i%2?'#12171c':'#141a20'):'#151320');g.fillRect(0,l.y,W,l.h);g.fillStyle='#0b0f13';g.fillRect(0,l.y+l.h-1,W,1);}
  // bar grid
  const bar=240/bpm(),bpx=bar*s;let every=1;while(every*bpx<56)every*=2;const first=Math.max(0,Math.floor(sl/s/bar));g.font='600 11px "IBM Plex Mono",monospace';
  for(let b=first;b*bar*s-sl<W;b++){const x=X(b*bar);if(b%every===0){g.fillStyle='#2a333c';g.fillRect(x,RULER,1,H-RULER);g.fillStyle='#a3afb9';g.fillText(String(b+1),x+3,13);g.fillStyle='#55606a';g.fillText(fmtShort(b*bar),x+3,23);g.fillStyle='#55606a';g.fillRect(x,0,1,RULER);}else if(bpx>=10){g.fillStyle='#1b2229';g.fillRect(x,RULER,1,H-RULER);}}
  const lane=k=>L.find(l=>l.k===k);
  // loop region
  const reg=loop&&loop.daw?[loop.start,loop.end]:D.region;if(reg){g.fillStyle=loop&&loop.daw?'rgba(242,163,58,.16)':'rgba(242,163,58,.08)';g.fillRect(X(reg[0]),0,X(reg[1])-X(reg[0]),H);g.fillStyle='#f2a33a';g.fillRect(X(reg[0]),0,X(reg[1])-X(reg[0]),4);}
  // backing
  const lb=lane('beat');if(S.beat){const P=peaks(S.beat.getChannelData(0),S.beat.sampleRate);drawPeaks(g,P,0,0,S.beat.duration,lb.y+2,lb.h-4,$('beatOn').checked?'#5a7fd6':'#39445a',X);}else{g.fillStyle='#55606a';g.font='13px "IBM Plex Sans",sans-serif';g.fillText('No backing track · File › Open backing track',10,lb.y+lb.h/2+4);}
  // vocal
  const lv=lane('voc');const vocArr=S.comped||S.main;if(vocArr)drawPeaks(g,peaks(vocArr,S.rate),0,0,vocArr.length/S.rate,lv.y+4,lv.h-8,'rgba(63,183,163,.45)',X);
  else if(w&&w.base)drawPeaks(g,peaks(w.base.channels[0],w.rate),0,0,w.base.channels[0].length/w.rate,lv.y+4,lv.h-8,'rgba(63,183,163,.35)',X);
  if(w){for(const p of w.phrases){const x0=X(p.start),x1=X(p.end);if(x1<0||x0>W)continue;const chosen=p.takes.find(t=>t.id===p.selected),sel=p.id===w.selected;
      g.fillStyle=chosen?'rgba(63,183,163,.22)':'rgba(120,104,70,.30)';g.fillRect(x0,lv.y+3,x1-x0,lv.h-6);
      if(chosen)drawPeaks(g,peaks(chosen.channels[0],chosen.rate),PhraseCore.origin(chosen),p.start,p.end,lv.y+16,lv.h-20,'#5eead4',X);
      g.strokeStyle=sel?'#ffffff':chosen?'#3fb7a3':'#a08a55';g.lineWidth=sel?2:1;g.strokeRect(x0+.5,lv.y+3.5,x1-x0-1,lv.h-7);
      g.save();g.beginPath();g.rect(x0,lv.y,x1-x0,lv.h);g.clip();g.fillStyle='#f4f1ea';g.font='600 11px "IBM Plex Sans",sans-serif';g.fillText(p.name+(chosen?' ✓':'')+' · '+p.takes.length,x0+5,lv.y+14);g.restore();}
    // take lanes
    for(const l of L.filter(l=>l.k==='take')){for(const p of w.phrases){const t=p.takes[l.i];if(!t)continue;const x0=X(p.start),x1=X(p.end);if(x1<0||x0>W)continue;
        const rank=PhraseCore.rank(p,w.key||0,w.scale||0),row=rank.rows.find(r=>r.id===t.id),chosen=p.selected===t.id,complete=PhraseCore.covers(t,p),sug=rank.winner===t.id,sel=p.id===w.selected;
        g.fillStyle=chosen?'rgba(242,163,58,.30)':sel?'rgba(255,255,255,.07)':'rgba(255,255,255,.04)';g.fillRect(x0,l.y+3,x1-x0,l.h-6);
        drawPeaks(g,peaks(t.channels[0],t.rate),PhraseCore.origin(t),p.start,p.end,l.y+14,l.h-16,chosen?'#f2c14e':complete?'#8d99a5':'#7a4a4a',X);
        g.strokeStyle=chosen?'#f2a33a':sug?'#5eead4':sel?'#c9d1d9':'#3a444e';g.lineWidth=chosen||sug?2:1;g.strokeRect(x0+.5,l.y+3.5,x1-x0-1,l.h-7);
        g.save();g.beginPath();g.rect(x0,l.y,x1-x0,l.h);g.clip();g.font='700 10px "IBM Plex Mono",monospace';g.fillStyle=chosen?'#f2c14e':'#c9d1d9';
        const score=row&&row.eligible?Math.round(row.score):null,lab=(chosen?'CHOSEN · ':sug?'SUGGESTED · ':'')+(t.analysisToken?'analysing…':score!==null?score+'%':row?.reason&&t.profile?'—':'…')+(complete?'':' · INCOMPLETE');
        g.fillText(lab,x0+5,l.y+13);g.restore();}}
  }
  if(w&&!w.phrases.length){const l=L.find(l=>l.k==='take');g.fillStyle='#55606a';g.font='13px "IBM Plex Sans",sans-serif';g.fillText('Takes appear here · click the timeline, then Continue from here and press ● (R)',10,l.y+l.h/2+4);}
  // comp lanes (EDIT engine takes)
  for(const l of L.filter(l=>l.k==='comp')){const a=S.takes[l.i];if(!a)continue;drawPeaks(g,peaks(a,S.rate),0,0,a.length/S.rate,l.y+3,l.h-6,S.edit.take===l.i?'#b48cff':'#6f5d99',X);
    if(S.edit.take===l.i&&S.edit.src){g.strokeStyle='#b48cff';g.lineWidth=2;g.strokeRect(X(S.edit.src[0]),l.y+2,X(S.edit.src[1])-X(S.edit.src[0]),l.h-4);}}
  if(S.edit.sel&&S.edit.tab==='comp'&&S.takes.length>1){g.strokeStyle='#ff7a45';g.lineWidth=1;g.setLineDash([4,3]);g.strokeRect(X(S.edit.sel[0]),lv.y+2,X(S.edit.sel[1])-X(S.edit.sel[0]),lv.h-4);g.setLineDash([]);}
  // resume line + playhead
  if(w){const x=X(w.cursor);g.strokeStyle='#f5d08a';g.setLineDash([5,4]);g.lineWidth=1;g.beginPath();g.moveTo(x+.5,RULER);g.lineTo(x+.5,H);g.stroke();g.setLineDash([]);g.fillStyle='#f5d08a';g.beginPath();g.moveTo(x-5,RULER);g.lineTo(x+5,RULER);g.lineTo(x,RULER+7);g.fill();}
  if(rec&&rec.target==='phrase'&&rec.phrase){const t=rec.origin+(performance.now()-rec.t0)/1000,p=rec.phrase.p;g.fillStyle='rgba(255,74,79,.18)';g.fillRect(X(p.start),RULER,X(Math.max(p.start,t))-X(p.start),H-RULER);
    const x=X(t);g.fillStyle='#ff4a4f';g.fillRect(x,0,2,H);}
  else{const x=X(playing?playheadTime():position);g.fillStyle='#ffb02e';g.fillRect(x-.5,0,2,H);g.beginPath();g.moveTo(x-6,0);g.lineTo(x+7,0);g.lineTo(x+.5,9);g.fill();}
}

// ---------------------------------------------------------------- timeline interaction
function hit(e){const c=$('dawCanvas'),r=c.getBoundingClientRect(),y=e.clientY-r.top,x=e.clientX-r.left,t=Math.max(0,(x+$('tlScroll').scrollLeft)/pps());const l=lanesSpec().find(l=>y>=l.y&&y<l.y+l.h);return {t,l,x,y};}
function phraseAt(t){const w=work();if(!w)return null;for(let i=w.phrases.length-1;i>=0;i--){const p=w.phrases[i];if(t>=p.start&&t<=p.end)return p;}return null;}
function seekTo(t){if(rec)return;const was=playing;if(loop&&!(loop.daw&&t>=loop.start&&t<loop.end)){endLoop();}t=Math.max(0,t);position=t;
  if(was&&!loop)startPlayback(t,playbackTarget==='beat'?'beat':'mix');else if(was&&loop)startPlayback(t);else{seek(t);position=t;}
  if(!phraseBusy()){const w=work();w.cursor=Math.min(899.5,t);syncPhraseUI();persist();}tick();D.dirty=true;}
const cv=$('dawCanvas');let clickTimer=0;
cv.addEventListener('pointerdown',e=>{if(e.button)return;const h=hit(e);if(!h.l)return;D.ctx='phrase';
  if(h.l.k==='ruler'){cv.setPointerCapture(e.pointerId);D.drag={t0:h.t,x0:e.clientX};return;}
  if(h.l.k==='voc'){const p=phraseAt(h.t);if(p){if(!phraseBusy()){phraseSelect(p.id);dawTab('phrase');}D.dirty=true;return;}seekTo(h.t);return;}
  if(h.l.k==='take'){const p=phraseAt(h.t),t=p?.takes[h.l.i];if(t&&!phraseBusy()){if(work().selected!==p.id)phraseSelect(p.id);clearTimeout(clickTimer);const id=t.id;clickTimer=setTimeout(()=>phraseListen(id),230);D.dirty=true;return;}seekTo(h.t);return;}
  if(h.l.k==='comp'){openComp(h.l.i);return;}
  seekTo(h.t);});
cv.addEventListener('dblclick',e=>{const h=hit(e);if(h.l?.k!=='take')return;clearTimeout(clickTimer);const p=phraseAt(h.t),t=p?.takes[h.l.i];if(t){phraseChoose(t.id);D.dirty=true;}});
cv.addEventListener('pointermove',e=>{if(!D.drag||!e.buttons)return;const h=hit(e);if(Math.abs(e.clientX-D.drag.x0)>4){D.region=[Math.min(D.drag.t0,h.t),Math.max(D.drag.t0,h.t)];D.dirty=true;}});
cv.addEventListener('pointerup',e=>{if(!D.drag)return;const moved=Math.abs(e.clientX-D.drag.x0)>4;const t0=D.drag.t0;D.drag=null;if(!moved){D.region=null;seekTo(t0);}else if(D.region&&D.region[1]-D.region[0]<.1)D.region=null;D.dirty=true;$('dawLoop').title=D.region?'Loop '+fmt(D.region[0])+'–'+fmt(D.region[1])+' (L)':'Loop selected phrase or region (L)';});
cv.addEventListener('contextmenu',e=>{const h=hit(e);if(h.l?.k==='ruler'&&D.region){e.preventDefault();D.region=null;D.dirty=true;}});

// ---------------------------------------------------------------- keyboard shortcuts
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(qa('.mdrop').some(d=>!d.hidden)){closeMenus();return;}if(closeModals())return;if(!$('guideSheet').hidden){$('guideSheet').hidden=true;return;}return;}
  if(e.defaultPrevented||isTyping(e.target)||e.altKey)return;
  const mod=e.ctrlKey||e.metaKey,k=e.key;
  if(mod&&(k==='z'||k==='Z')){e.preventDefault();e.shiftKey?dawRedo():dawUndo();return;}
  if(mod&&(k==='y'||k==='Y')){e.preventDefault();dawRedo();return;}
  if(mod&&(k==='s'||k==='S')){e.preventDefault();if(!$('phraseSave').disabled)$('phraseSave').click();else if(!$('saveProject').disabled)$('saveProject').click();return;}
  if(mod)return;
  const modalOpen=qa('.modal').some(m=>!m.hidden);
  if(k===' '){e.preventDefault();if(!$('playBtn').disabled)$('playBtn').click();return;}
  if(modalOpen)return;
  if(k==='Home'||(k==='Enter'&&!e.target.closest('button,a,summary,[role=button],[role=slider],[tabindex]'))){e.preventDefault();$('toStart').click();return;}
  if(k==='r'||k==='R'){e.preventDefault();dawRecord();return;}
  if(k==='l'||k==='L'){e.preventDefault();dawLoop();return;}
  if(/^[1-6]$/.test(k)&&!e.target.closest('[role=slider]')){e.preventDefault();dawTab(TABS[+k-1]);return;}
  if(k==='?'){e.preventDefault();openModal('helpModal','keys');return;}
  if(k==='+'||k==='='){zoom(1.6);return;}if(k==='-'||k==='_'){zoom(1/1.6);return;}
});

// ---------------------------------------------------------------- frame loop: clock, meters, button states, redraw
const micBuf=new Float32Array(1024);let outBuf=null,lastSlow=0;
const lvl=pk=>Math.max(0,Math.min(100,(20*Math.log10(pk+1e-6)+60)/60*100));
function meter(el,pk){el.style.width=lvl(pk)+'%';el.style.background=pk>.98?'var(--red)':pk>.7?'var(--amber)':'var(--green)';}
function frame(now){
  const t=rec&&rec.target==='phrase'?Math.max(0,rec.origin+(performance.now()-rec.t0)/1000):playing?playheadTime():position;
  const ms=Math.floor((t%1)*1000),m=Math.floor(t/60),sec=Math.floor(t%60);$('dawTime').textContent=m+':'+String(sec).padStart(2,'0')+'.'+String(ms).padStart(3,'0');
  const b=bpm(),beat=60/b;$('dawBars').textContent='bar '+(Math.floor(t/(beat*4))+1)+' · beat '+(Math.floor(t/beat)%4+1);
  if(rec&&rec.an){rec.an.getFloatTimeDomainData(micBuf);let pk=0;for(const v of micBuf)pk=Math.max(pk,Math.abs(v));meter($('dawMicMeter'),pk);$('dawRecStat').textContent='● '+($(rec.ids.time)?.textContent||'Recording');}
  else{$('dawMicMeter').style.width='0';$('dawRecStat').textContent=S.recStarting?'Allow the microphone…':'';}
  if(outputMeter&&playing){if(!outBuf||outBuf.length!==outputMeter.fftSize)outBuf=new Float32Array(outputMeter.fftSize);outputMeter.getFloatTimeDomainData(outBuf);let pk=0;for(const v of outBuf)pk=Math.max(pk,Math.abs(v));meter($('dawOutMeter'),pk);}else $('dawOutMeter').style.width='0';
  $('dawRec').classList.toggle('on',!!rec);$('dawRec').disabled=!rec&&(!!S.micBlocked||(typeof phraseBusy==='function'&&phraseBusy()));
  $('dawLoop').setAttribute('aria-pressed',!!(loop&&loop.daw));
  if(now-lastSlow>400){lastSlow=now;slow();}
  if(playing||rec||D.dirty||D.drag){D.dirty=false;draw();}
  requestAnimationFrame(frame);
}
function slow(){
  const P=S.P||{};$('dawBpm').textContent=bpm()+' BPM';$('dawKey').textContent=P.key!=null&&S.st?'Key '+SHORT[P.key|0]+' '+(['chromatic','major','minor','harm. minor','maj. pent.','min. pent.','blues'][P.scale|0]||''):'Key —';
  $('dawSong').textContent='· '+(S.phrases?.title&&S.phrases.phrases.length?S.phrases.title:S.name||'New session');
  syncUndo();syncProxies();
  const L=lanesSpec(),key=L.map(l=>l.k+(l.i||'')).join('|')+'|'+Math.round(songDur());if(key!==D.layoutKey){D.layoutKey=key;layout();}else syncHeads();
  D.dirty=true;
}
// redraw promptly after app state changes
for(const name of ['syncPhraseUI','renderOpen','syncEdit','absorb']){const f=window[name];if(typeof f!=='function')continue;window[name]=function(){const r=f.apply(this,arguments);D.dirty=true;return r;};}

// ---------------------------------------------------------------- start
let saved='phrase';try{saved=localStorage.getItem('pvs-daw-tab')||'phrase';}catch(e){}
dawDock('notes');dawTab(TABS.includes(saved)?saved:'phrase',true);layout();D.started=true;requestAnimationFrame(frame);
})();
