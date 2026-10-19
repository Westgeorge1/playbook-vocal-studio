/* Playbook Vocal Studio 0.18.3 — take editor, lane menus, backing remove/undo and Recovered audio.
   Features from the third-party 0.18.1 build, rebuilt to fit the tidy RECORD & COMP screen:
   - the take editor opens only from the Edit button on a take (modal);
   - BACKING ▾ and VOCAL ▾ are small menus on the lane headers (phone: Backing ▾ / Vocal ▾ in the part panel);
   - Recovered audio shows a badge in the top bar only when there is something to recover.
   Every edit makes a NEW take (the original stays) or a part change with one Undo. Engine untouched. */
(function(){
'use strict';
const el=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PV=window.PVSRec;
const busy=()=>sessionLocked()||!!rec||!!S.recStarting||!!(PV.state&&PV.state())||phraseBusy();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=id=>Number(el(id).value);
const E={pid:null,tid:null,a:0,b:1,start:0,seconds:8,hand:false,drag:null,lastFocus:null};
let removedBeat=null,recoveryHTML='',recoveryFocus=null;

// ---------------------------------------------------------------- editor modal
const modal=document.createElement('section');modal.id='vocalEditor';modal.className='stmodal';modal.hidden=true;
modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','veTitle');
modal.innerHTML=`<div class="stdialog">
<header><h2 id="veTitle">Edit take</h2><select id="veTake" aria-label="Take to edit"></select><button id="veChoose" class="stgreen">✓ Choose</button><button id="veClose" aria-label="Close the editor">Close ✕</button></header>
<p class="sthint">Drag across the waveform to select. Level, silence and fades make a <b>new take</b>; the original stays in the list. Part changes (trim, split, move) keep every recording — one Undo puts them back.</p>
<canvas id="veCanvas" class="stcanvas" tabindex="0" aria-label="Backing and take waveforms. Drag to select; use the Start and End fields for exact times."></canvas>
<div class="strow stnav"><button id="vePlay">▶ Play selection</button><button id="veStop" aria-label="Stop">■</button><label class="stchk"><input id="veBeat" type="checkbox" checked> with backing</label><span class="stgap"></span><span class="stzoomg"><button id="veOut" aria-label="Zoom out" title="Zoom out">−</button><button id="veIn" aria-label="Zoom in" title="Zoom in">+</button><button id="veFit">Part</button><button id="veFull">Whole take</button><button id="veMode" aria-pressed="false" title="Hand: drag to scroll instead of selecting" aria-label="Hand (drag to scroll)">✋</button></span></div>
<div class="strow stpan"><input id="vePan" type="range" min="0" max="1" step="0.001" aria-label="Scroll the take"><output id="veView"></output></div>
<div class="strow"><label>Start <input id="veA" type="number" step="0.001" aria-label="Selection start in song seconds"> s</label><label>End <input id="veB" type="number" step="0.001" aria-label="Selection end in song seconds"> s</label><button id="veSelectPart">Select whole part</button></div>
<div class="stgrid">
 <div class="stbox"><h3>SELECTED AUDIO → new take</h3><div class="strow"><label>Level <input id="veGain" type="number" value="-3" min="-24" max="24" step="0.5" aria-label="Level change in dB"> dB</label><button id="veApplyGain">Apply level</button></div><div class="strow"><button id="veSilence">Silence</button><button id="veFadeIn">Fade in</button><button id="veFadeOut">Fade out</button></div></div>
 <div class="stbox"><h3>PART</h3><div class="strow"><button id="veTrim" title="Make the part start and end at the selection. Nothing is deleted from the takes.">Trim part to selection</button><button id="veSplit" title="Split the part at the selection start into two parts">Split at start</button></div><div class="strow"><label>Move part to <input id="veMoveTo" type="number" min="0" max="899.5" step="0.01" aria-label="New part start in seconds"> s</label><button id="veMove">Move</button></div></div>
 <div class="stbox"><h3>TIMING · HISTORY</h3><div class="strow"><button id="veEarlier" title="Move this take 10 ms earlier">◀ 10 ms</button><output id="veOffset">0 ms</output><button id="veLater" title="Move this take 10 ms later">10 ms ▶</button></div><div class="strow"><button id="veUndo">↶ Undo</button><button id="veRedo">↷ Redo</button><button id="veDownload" title="Download the whole take as a WAV file">Download WAV</button></div></div>
</div>
<details class="stbox stdet"><summary>Why was this take suggested?</summary><div id="veAnalysis" class="stanalysis"></div><button id="veAnalyze">Check again</button></details>
<p id="veStatus" class="ststatus" role="status" aria-live="polite"></p></div>`;
document.body.append(modal);
// ---------------------------------------------------------------- Recovered audio panel
const recovery=document.createElement('section');recovery.id='recoveryModal';recovery.className='stmodal';recovery.hidden=true;recovery.setAttribute('role','dialog');recovery.setAttribute('aria-modal','true');recovery.setAttribute('aria-labelledby','recoveryTitle');
recovery.innerHTML='<div class="stdialog stsmall"><header><h2 id="recoveryTitle">Recovered audio</h2><button id="recoveryClose">Close ✕</button></header><p class="sthint">Microphone audio that could not be placed as a take (for example the mic stopped, or a loop pass was not finished). It is kept in autosave and in Back up project. Download each file and check it before you remove it.</p><div id="recoveryList"></div></div>';
document.body.append(recovery);

function find(){const w=phraseWorkspace(),p=w.phrases.find(p=>p.id===E.pid),t=p?.takes.find(t=>t.id===E.tid);return {w,p,t};}
function message(s){el('veStatus').textContent=s;}
function stop(){if(loop)endLoop();stopPlayback();RC.auditioning=false;RC.savedPos=null;}
function bounds(){const {p,t}=find();if(!t)return [0,1];const o=PhraseCore.origin(t);return [Math.max(0,Math.min(p.start,o)),Math.max(p.end,o+t.channels[0].length/t.rate,.5)];}
function setView(start,seconds){const [a,b]=bounds();E.seconds=clamp(seconds,.05,Math.max(.05,b-a));E.start=clamp(start,a,b-E.seconds);draw();}
function selection(a,b){E.a=Math.min(a,b);E.b=Math.max(a,b);el('veA').value=E.a.toFixed(3);el('veB').value=E.b.toFixed(3);draw();}
function refresh(keepSelection){let {p,t}=find();if(!p){p=selectedPhrase();E.pid=p?.id;}if(!p){closeEditor();return;}
  if(!t){t=p.takes.find(x=>x.id===p.selected)||p.takes.at(-1);E.tid=t?.id;}if(!t){closeEditor();return;}
  el('veTitle').textContent='Edit · '+p.name;
  el('veTake').innerHTML=p.takes.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+(p.selected===x.id?' ✓':'')+'</option>').join('');el('veTake').value=t.id;
  el('veMoveTo').value=p.start.toFixed(2);el('veOffset').textContent=(t.offsetMs||0)+' ms';
  el('veUndo').disabled=!phraseUndoStack.length;el('veRedo').disabled=!phraseRedoStack.length;
  const ch=p.selected===t.id;el('veChoose').textContent=ch?'✓ Chosen':'✓ Choose';el('veChoose').classList.toggle('on',ch);el('veChoose').disabled=!PhraseCore.covers(t,p);el('veChoose').title=PhraseCore.covers(t,p)?'Use this take in the comp':'This take does not cover the whole part';
  el('veBeat').disabled=!S.beat;
  if(!keepSelection){selection(p.start,p.end);setView(p.start-.25,p.end-p.start+.5);}else draw();analysis();}
function analysis(){const {w,p,t}=find();if(!t)return;let text;
  try{const rows=RC.whyText?RC.whyText(t.id):null;text=t.analysisToken?'Checking this take…':t.analysisError?'The check failed: '+t.analysisError+'. Press Check again.':rows&&rows.length?rows.join(' · '):'No check result yet.';}catch(e){text='No check result yet.';}
  const v=text+' These are estimates: listen before you choose.';if(el('veAnalysis').textContent!==v)el('veAnalysis').textContent=v;}
function openEditor(id){if(busy()){toast('Not right now','Stop recording first, then press Edit.');return;}const w=phraseWorkspace();
  const p=w.phrases.find(p=>p.takes.some(t=>t.id===id))||selectedPhrase(),t=p?.takes.find(t=>t.id===id)||p?.takes.find(t=>t.id===p.selected)||p?.takes.at(-1);
  if(!t){toast('No take yet','Record or import a take first, then press Edit on it.');return;}
  stop();el('rcLaneMenu').hidden=true;E.lastFocus=document.activeElement;E.pid=p.id;E.tid=t.id;RC.aud=t.id;if(w.selected!==p.id)phraseSelect(p.id);
  modal.hidden=false;document.body.classList.add('st-open');message('The original recordings are always kept.');refresh(false);el('veClose').focus();}
function closeEditor(){stop();modal.hidden=true;E.drag=null;document.body.classList.remove('st-open');RC.sig='';RC.dirty=true;const fid=E.lastFocus?.closest?.('.rctake')?.dataset.id,back=late=>{if(!modal.hidden)return;const ae=document.activeElement;if(late&&ae&&ae!==document.body&&ae.isConnected)return;const q=id=>id&&[...document.querySelectorAll('#rcTakes .rctake')].find(r=>r.dataset.id===id)?.querySelector('[data-act=edit]');const t=(E.lastFocus?.isConnected&&E.lastFocus)||q(fid)||q(E.tid)||el('rcBig');if(t&&document.activeElement!==t)t.focus();};back();setTimeout(()=>back(1),80);setTimeout(()=>back(1),300);}
function commit(next,label){if(busy())return false;stop();phraseBackup();S.phrases=next;phraseChanged(label+' Undo puts it back.');RC.aud=E.tid;RC.sig='';RC.dirty=true;if(window.DAW)DAW.dirty=true;phraseAnalyzeMissing();persist();refresh(true);message(label+' Undo puts it back.');return true;}
const KIND={gain:'level','silence':'silence','fade-in':'fade in','fade-out':'fade out'};
function applyEdit(kind){if(busy())return;try{const {w,p,t}=find();if(!t)return;
  const v=kind==='gain'?num('veGain'):0;if(kind==='gain'&&(!Number.isFinite(v)||Math.abs(v)>24||v===0)){message('Enter a level change between −24 and +24 dB (not 0).');return;}
  const nt=VocalEdit.edit(t,E.a,E.b,kind,v),next=PhraseCore.clone(w),np=next.phrases.find(q=>q.id===E.pid);
  if(np.takes.length>=32){message('This part has 32 takes. Delete a spare take first.');return;}
  nt.id='t'+next.nextId++;nt.name=(t.name+' · '+(kind==='gain'?(v>0?'+':'')+v+' dB':KIND[kind])).slice(0,75);np.takes.push(nt);if(np.selected===t.id)np.selected=nt.id;PhraseCore.validate(next);
  E.tid=nt.id;commit(next,'New take '+nt.name+' made; '+t.name+' is still in the list.');}catch(e){message(e.message);}}
function overlaps(next,id){const np=next.phrases.find(q=>q.id===id);return next.phrases.filter(q=>q.id!==id&&Math.min(q.end,np.end)-Math.max(q.start,np.start)>.01);}
async function partEdit(action,args){if(busy())return;try{const {w,p}=find();if(!p)return;const next=VocalEdit.transform(w,p.id,action,args);
  if(action==='move'||action==='trim'){const over=overlaps(next,p.id);if(over.length){const k=await PV.chooseModal('This would overlap '+over.map(q=>q.name).join(', '),p.name+' would cover part of '+over.map(q=>q.name).join(', ')+'. Parts should not overlap: in the overlap only one of them is heard.',[['cancel','Cancel','Nothing changes.'],['go','Do it anyway','You can move or trim the other part afterwards. Undo puts everything back.']]);if(k!=='go'){message('Nothing changed.');return;}}}
  if(action==='split'){E.pid=next.selected;E.tid=null;}
  commit(next,action==='trim'?'Part trimmed to '+fmtShort(args.start)+'–'+fmtShort(args.end)+'; every take still holds all its audio.':action==='move'?'Part and its takes moved to '+args.start.toFixed(2)+' s.':action==='split'?'Part split in two; choose a take for each.':'Take moved '+(args.ms>0?'later':'earlier')+' by 10 ms.');
  if(action!=='nudge')refresh(false);}catch(e){message(e.message);}}
async function preview(){if(busy())return;try{stop();const {t}=find(),[a,b]=VocalEdit.range(t,E.a,E.b),chs=t.channels.map(c=>c.slice(a,b)),start=PhraseCore.origin(t)+a/t.rate;
  const withBeat=!!S.beat&&el('veBeat').checked;loop={phrase:true,chs,rate:t.rate,gain:Math.pow(10,(t.gainDb||0)/20),start:0,end:chs[0].length/t.rate,noBeat:!withBeat,beatOffset:start,oneShot:true};
  const ok=await startPlayback(0);message(ok?'Playing the selection'+(withBeat?' with the backing.':'.'):'Audio could not start.');}catch(e){message(e.message);}}
const cache=new WeakMap();function envelope(a,rate){let c=cache.get(a);if(c)return c;const step=Math.max(1,Math.floor(rate/200)),d=new Float32Array(Math.ceil(a.length/step));for(let i=0;i<a.length;i++){const k=(i/step)|0,v=a[i]<0?-a[i]:a[i];if(v>d[k])d[k]=v;}c={d,step};cache.set(a,c);return c;}
function draw(){if(modal.hidden)return;const {p,t}=find();if(!t)return;const c=el('veCanvas'),r=Math.min(2,devicePixelRatio||1),w=c.clientWidth||600,h=c.clientHeight||200;
  if(c.width!==Math.round(w*r)||c.height!==Math.round(h*r)){c.width=Math.round(w*r);c.height=Math.round(h*r);}const g=c.getContext('2d');if(!g)return;g.setTransform(r,0,0,r,0,0);
  g.fillStyle='#0b0f14';g.fillRect(0,0,w,h);const X=s=>(s-E.start)/E.seconds*w,bh=Math.round(h*.26),vy=bh+6,vh=h-vy-2;
  const paint=(a,rate,origin,y,hh,color)=>{const pk=envelope(a,rate);g.fillStyle=color;for(let x=0;x<w;x++){const lo=Math.max(0,Math.floor(((E.start+x/w*E.seconds)-origin)*rate/pk.step)),hi=Math.min(pk.d.length,Math.ceil(((E.start+(x+1)/w*E.seconds)-origin)*rate/pk.step));let v=0;for(let i=lo;i<hi;i++)if(pk.d[i]>v)v=pk.d[i];if(v){const hgt=Math.max(.5,Math.min(hh/2-1,v*hh*.8));g.fillRect(x,y+hh/2-hgt,1,hgt*2);}}};
  g.fillStyle='#0f141a';g.fillRect(0,0,w,bh);g.fillStyle='#070a0e';g.fillRect(0,bh,w,2);
  if(S.beat)paint(S.beat.getChannelData(0),S.beat.sampleRate,0,2,bh-4,'#5a7be0');
  const ch=p.selected===t.id;paint(t.channels[0],t.rate,PhraseCore.origin(t),vy,vh,ch?'#3ddc84':'#8d98a5');
  g.fillStyle='#8d98a5';g.font='600 10px "IBM Plex Sans",sans-serif';g.fillText(S.beat?'BACKING':'NO BACKING',6,12);g.fillText('TAKE · '+t.name,6,vy+12);
  const xa=X(E.a),xb=X(E.b);g.fillStyle='rgba(240,160,48,.18)';g.fillRect(xa,vy,xb-xa,vh);g.strokeStyle='#f0a030';g.lineWidth=1;g.strokeRect(xa+.5,vy+.5,Math.max(1,xb-xa-1),vh-1);
  for(const [s,lab,dir] of [[p.start,'IN',1],[p.end,'OUT',-1]]){const x=X(s);if(x<-2||x>w+2)continue;g.fillStyle='#ff4d4d';g.fillRect(x-1,0,2,h);g.font='700 9px "IBM Plex Sans",sans-serif';g.fillText(lab,dir>0?x+4:x-4-g.measureText(lab).width,h-6);}
  if(playing&&loop&&loop.oneShot&&!loop.rcComp){const tt=(loop.beatOffset||0)+D_play();const x=X(tt);if(x>=0&&x<=w){g.fillStyle='#fff';g.fillRect(x,0,1,h);}}
  const [a,b]=bounds(),pan=el('vePan');pan.min=a;pan.max=Math.max(a,b-E.seconds);pan.value=E.start;pan.disabled=b-a<=E.seconds+.001;el('veView').textContent=E.start.toFixed(2)+'–'+(E.start+E.seconds).toFixed(2)+' s';}
function D_play(){try{return window.DAW?.playheadTime?DAW.playheadTime():0;}catch(e){return 0;}}
el('veClose').onclick=closeEditor;el('veTake').onchange=()=>{stop();E.tid=el('veTake').value;RC.aud=E.tid;refresh(true);};el('vePlay').onclick=preview;el('veStop').onclick=stop;
el('veDownload').onclick=async()=>{const {t}=find();if(!t)return;try{const r=await saveDownload(safeName(t.name)+'.wav',new Blob([wavFloat(t.channels,t.rate)],{type:'audio/wav'}));message((r||'Downloaded')+' — the whole take, every sample.');}catch(e){message('Download failed: '+e.message);}};
el('veChoose').onclick=()=>{const {p,t}=find();if(!t||busy())return;if(p.selected===t.id){message(t.name+' is already chosen.');return;}phraseSelect(p.id);phraseChoose(t.id);RC.sig='';refresh(true);message(t.name+' chosen for '+p.name+'.');};
for(const id of ['veA','veB'])el(id).onchange=()=>{const a=num('veA'),b=num('veB');if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a){message('End must be later than Start.');el('veA').value=E.a.toFixed(3);el('veB').value=E.b.toFixed(3);return;}selection(a,b);};
el('veSelectPart').onclick=()=>{const {p}=find();if(p)selection(p.start,p.end);};
el('veApplyGain').onclick=()=>applyEdit('gain');el('veSilence').onclick=()=>applyEdit('silence');el('veFadeIn').onclick=()=>applyEdit('fade-in');el('veFadeOut').onclick=()=>applyEdit('fade-out');
el('veTrim').onclick=()=>partEdit('trim',{start:E.a,end:E.b});el('veSplit').onclick=()=>partEdit('split',{at:E.a});el('veMove').onclick=()=>partEdit('move',{start:num('veMoveTo')});
el('veEarlier').onclick=()=>partEdit('nudge',{tid:E.tid,ms:-10});el('veLater').onclick=()=>partEdit('nudge',{tid:E.tid,ms:10});
for(const [id,dir] of [['veUndo',-1],['veRedo',1]])el(id).onclick=()=>{stop();if(phraseHistory(dir)){const w=phraseWorkspace();if(!w.phrases.some(p=>p.id===E.pid))E.pid=w.selected;const p=find().p;if(p&&!p.takes.some(t=>t.id===E.tid))E.tid=null;RC.sig='';refresh(true);message(dir<0?'Undone.':'Redone.');}};
el('veAnalyze').onclick=()=>{const {p,t}=find();if(!t||busy())return;phraseAnalyze(t,p);message('Checking the take…');};
const zoom=f=>{const c=(E.a+E.b)/2;setView(c-E.seconds/f/2,E.seconds/f);};
el('veIn').onclick=()=>zoom(2);el('veOut').onclick=()=>zoom(.5);el('veFit').onclick=()=>{const {p}=find();setView(p.start-.25,p.end-p.start+.5);};el('veFull').onclick=()=>{const [a,b]=bounds();setView(a,b-a);};
el('vePan').oninput=()=>setView(num('vePan'),E.seconds);
el('veMode').onclick=()=>{E.hand=!E.hand;el('veMode').setAttribute('aria-pressed',E.hand);el('veCanvas').style.cursor=E.hand?'grab':'crosshair';};
const pointers=new Map();let pinch=null;const canvas=el('veCanvas');
canvas.onpointerdown=e=>{if(e.button>0)return;try{canvas.setPointerCapture(e.pointerId);}catch(_){}pointers.set(e.pointerId,e.clientX);
  if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.abs(b-a),seconds:E.seconds,start:E.start,center:(a+b)/2};E.drag=null;return;}
  const r=canvas.getBoundingClientRect(),t=E.start+(e.clientX-r.left)/r.width*E.seconds;E.drag={x:e.clientX,t,start:E.start,seconds:E.seconds,moved:false};e.preventDefault();};
canvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,e.clientX);const r=canvas.getBoundingClientRect();
  if(pinch&&pointers.size===2){const [a,b]=[...pointers.values()],dist=Math.max(10,Math.abs(b-a)),seconds=pinch.seconds*Math.max(10,pinch.distance)/dist,anchor=pinch.start+(pinch.center-r.left)/r.width*pinch.seconds;setView(anchor-((a+b)/2-r.left)/r.width*seconds,seconds);return;}
  if(!E.drag)return;if(Math.abs(e.clientX-E.drag.x)>2)E.drag.moved=true;if(!E.drag.moved)return;
  if(E.hand)setView(E.drag.start-(e.clientX-E.drag.x)/r.width*E.drag.seconds,E.seconds);else{const [a,b]=bounds(),t=clamp(E.start+(e.clientX-r.left)/r.width*E.seconds,a,b);selection(clamp(E.drag.t,a,b),t);}};
for(const ty of ['pointerup','pointercancel'])canvas.addEventListener(ty,e=>{pointers.delete(e.pointerId);pinch=null;E.drag=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey||e.metaKey||!e.deltaX&&!e.shiftKey)zoom(e.deltaY<0?1.25:.8);else setView(E.start+(e.deltaX||e.deltaY)/canvas.clientWidth*E.seconds,E.seconds);},{passive:false});
new ResizeObserver(draw).observe(canvas);

// ---------------------------------------------------------------- backing: remove + Undo remove
function removeBacking(){if(busy()||!S.beat)return;stop();removedBeat={buffer:S.beat,name:S.beatName,level:S.beatLevel,on:el('beatOn').checked};
  S.beat=null;S.beatName='';S.fitBeat=null;S.fitInfo=null;sendBeat();renderOpen();tick();persist();RC.sig='';RC.dirty=true;
  toast('Backing removed','“Undo remove backing” in the BACKING ▾ menu brings it back. Your takes are kept.');RC.msg&&RC.msg('Backing removed. BACKING ▾ › Undo remove backing brings it back.');}
function undoRemoveBacking(){if(busy()||!removedBeat)return;stop();const b=removedBeat;removedBeat=null;
  S.beat=b.buffer;S.beatName=b.name;S.beatLevel=b.level;el('beatOn').checked=b.on;el('beatLevel').value=Math.round(100*S.beatLevel);el('beatLevelText').textContent=Math.round(100*S.beatLevel)+'%';
  S.fitBeat=null;S.fitInfo=null;sendBeat();renderOpen();tick();persist();RC.sig='';RC.dirty=true;RC.msg&&RC.msg('Backing '+b.name+' is back.');}
el('beatRemove').onclick=removeBacking;
// a newly loaded backing replaces what Undo remove would bring back
el('fileBeat').addEventListener('change',()=>{removedBeat=null;});

// ---------------------------------------------------------------- vocal: import whole vocal / play / clear + undo
async function importVocal(){if(busy())return;const n=phraseWorkspace().phrases.reduce((n,p)=>n+p.takes.length,0);
  if(n){const k=await PV.chooseModal('Import a whole vocal?','Importing a whole vocal replaces your parts and their '+n+' take'+(n===1?'':'s')+'. To add a recording to one part instead, use Import take in the part panel.',[['cancel','Cancel','Keep my parts and takes.'],['go','Back up first, then import','Downloads a project backup (.zip with every take), then asks for the vocal file.'],['now','Import and replace','Your parts and takes are replaced. Back up project first if you may need them.']]);
    if(k==='cancel'||!k)return;
    // 0.18.3 (review 01): only go on to the file picker after the backup really worked; on failure or cancel keep everything and offer Try again
    while(k==='go'){const r=await saveProject();if(r&&r.ok)break;
      const k2=await PV.chooseModal(r&&r.status==='cancelled'?'Backup cancelled':'Backup not made',(r&&r.msg?r.msg+'\n':'')+'Nothing was imported. Your parts and takes are unchanged.',[['stay','Keep my takes','Do not import now.'],['go','Try the backup again','Then choose the vocal file.']]);
      if(k2!=='go'){RC.msg&&RC.msg('Import cancelled: the backup was not made, so nothing was replaced.');return;}}}
  el('fileVocal').click();}
async function playVocal(){if(busy())return;if(playing||playPending){stop();return;}const chs=RC.compChannels();
  if(!chs){toast('No vocal yet','Import a vocal, or choose a take in a part, then press Play vocal.');return;}
  if(loop)endLoop();loop={phrase:true,rcComp:true,chs,rate:RC.compRate(),gain:phraseSafeGain(chs),start:0,end:chs[0].length/RC.compRate(),noBeat:true,beatOffset:0,oneShot:true};RC.playMode='comp';
  const at=position<loop.end-.1?position:0,ok=await startPlayback(at);RC.msg(ok?'Playing the vocal only (no backing). Space or ■ stops.':'Audio could not start.');}
async function clearVocal(){if(busy())return;const w=phraseWorkspace(),n=w.phrases.reduce((n,p)=>n+p.takes.length,0);if(!n&&!S.main&&!w.phrases.length){toast('Nothing to clear','There is no vocal or take yet.');return;}
  const k=await PV.chooseModal('Clear the vocal?','This clears the imported vocal, every part and all '+n+' take'+(n===1?'':'s')+'. The backing and Recovered audio are kept.',[['cancel','Cancel','Nothing changes.'],['clear','Clear vocal and takes','“Undo clear” in the VOCAL ▾ menu brings everything back until you load or record a new vocal.']]);
  if(k!=='clear')return;stop();await clearSession(false);RC.step==='rc'&&RC.go('rc');RC.sig='';RC.dirty=true;RC.msg('Vocal and takes cleared. VOCAL ▾ › Undo clear brings them back.');}
async function undoClear(){if(!clearedSession||busy())return;el('undoClear').click();setTimeout(()=>{RC.sig='';RC.dirty=true;},300);}

// ---------------------------------------------------------------- lane menus (BACKING ▾ / VOCAL ▾)
const menu=el('rcLaneMenu');let menuKind=null,menuAnchor=null;
function menuItems(kind){const lk=busy(),w=phraseWorkspace(),n=w.phrases.reduce((n,p)=>n+p.takes.length,0);
  if(kind==='beat')return [['h','BACKING TRACK'+(S.beat?' · '+esc(S.beatName):'')],
    ['load',S.beat?'Replace backing…':'Load backing…','MP3, WAV, M4A… It is only heard, never recorded.',lk],
    ['remove','Remove backing',S.beat?'Your takes stay. Undo remove brings it back.':'No backing loaded.',lk||!S.beat],
    ...(removedBeat?[['undoRemove','Undo remove backing','Brings back '+esc(removedBeat.name)+'.',lk]]:[]),
    ['level','Listening level <input type="range" id="rcmBeatLevel" min="0" max="100" value="'+Math.round((S.beatLevel??.8)*100)+'"'+(S.beat?'':' disabled')+' aria-label="Backing listening level"> <span id="rcmBeatLevelV">'+Math.round((S.beatLevel??.8)*100)+'%</span><small class="rcmsm">what you hear; not the export mix</small>'],
    ['h',PV.withBacking()?'Recording WITH backing (switch: With / Without)':'Recording WITHOUT backing (switch: With / Without)']];
  return [['h','VOCAL'],
    ['import','Import vocal (whole song)…','One finished vocal file for the whole song.',lk],
    ['play',(playing?'■ Stop':'▶ Play vocal'),'The vocal only, without the backing.',lk||(!RC.hasComp()&&!playing)],
    ['clear','Clear vocal…','Clears the imported vocal, parts and takes. Keeps the backing.',lk||(!n&&!S.main&&!w.phrases.length)],
    ...(clearedSession?[['undoClear','Undo clear','Brings back the cleared vocal, parts and takes.',lk]]:[])];}
function laneMenu(kind,anchor){if(!menu.hidden&&menuKind===kind){menu.hidden=true;return;}el('rcMore').hidden=true;menuKind=kind;menuAnchor=anchor;renderMenu();
  const r=anchor.getBoundingClientRect(),mw=menu.offsetWidth,mh=menu.offsetHeight;menu.style.left=Math.max(6,Math.min(innerWidth-mw-6,r.left))+'px';menu.style.top=Math.max(6,Math.min(innerHeight-mh-6,r.bottom+4))+'px';
  setTimeout(()=>menu.querySelector('button.rcmi:not(:disabled)')?.focus(),20);}
function renderMenu(){menu.setAttribute('aria-label',menuKind==='beat'?'Backing track menu':'Vocal menu');
  menu.innerHTML=menuItems(menuKind).map(([k,label,hint,dis])=>k==='h'?'<div class="rcmh">'+label+'</div>':/<input/.test(label)?'<div class="rcmi rcmrow" data-k="'+k+'">'+label+'</div>':'<button class="rcmi" role="menuitem" data-k="'+k+'"'+(dis?' disabled':'')+'><span>'+label+'</span>'+(hint?'<small>'+hint+'</small>':'')+'</button>').join('');menu.hidden=false;
  const lv=el('rcmBeatLevel');if(lv)lv.oninput=()=>{el('beatLevel').value=lv.value;el('beatLevel').dispatchEvent(new Event('input'));el('rcmBeatLevelV').textContent=lv.value+'%';RC.dirty=true;};}
menu.addEventListener('click',e=>{const b=e.target.closest('button.rcmi');if(!b||b.disabled)return;const k=b.dataset.k;
  menu.hidden=true;if(menuAnchor?.isConnected)menuAnchor.focus();/* 0.18.3: a question opened from the menu returns focus to its button */({load:()=>el('fileBeat').click(),remove:removeBacking,undoRemove:undoRemoveBacking,import:importVocal,play:playVocal,clear:clearVocal,undoClear})[k]?.();});
menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();menu.hidden=true;menuAnchor?.focus();}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){const items=[...menu.querySelectorAll('button.rcmi:not(:disabled)')],i=items.indexOf(document.activeElement);e.preventDefault();e.stopPropagation();items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});

// ---------------------------------------------------------------- Recovered audio badge + panel
function openRecovery(){recoveryFocus=document.activeElement;recovery.hidden=false;document.body.classList.add('st-open');sync();el('recoveryClose').focus();}
function closeRecovery(){recovery.hidden=true;document.body.classList.remove('st-open');if(recoveryFocus?.isConnected)recoveryFocus.focus();}
el('rcRecovery').onclick=openRecovery;el('recoveryClose').onclick=closeRecovery;
el('recoveryList').onclick=async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.download)await Recovery.download(b.dataset.download);else if(b.dataset.remove){await Recovery.remove(b.dataset.remove);if(!Recovery.list().length)closeRecovery();}}catch(err){toast('Recovered audio',err.message);}sync();};

function sync(){const files=Recovery.list(),b=el('rcRecovery');if(b.hidden===!!files.length)b.hidden=!files.length;el('rcRecoveryN').textContent=files.length;
  if(!recovery.hidden){const lk=busy(),html=files.map(f=>'<div class="strecitem"><div><b>'+esc(f.name)+'</b><small>'+esc(f.reason||'')+' · '+((f.blob?.size||0)/1048576).toFixed(1)+' MB</small></div><button data-download="'+esc(f.id)+'">Download</button><button data-remove="'+esc(f.id)+'"'+(lk?' disabled':'')+'>Remove…</button></div>').join('')||'<p class="sthint">Nothing to recover.</p>';if(html!==recoveryHTML){recoveryHTML=html;el('recoveryList').innerHTML=html;}}
  if(!modal.hidden){analysis();if(playing)draw();}
  if(!menu.hidden&&menuKind&&document.activeElement?.id!=='rcmBeatLevel'&&!menu.contains(document.activeElement)){renderMenu();}}

// ---------------------------------------------------------------- dialog keys: Esc closes, Tab stays inside, Ctrl+Z/Y = editor undo/redo
window.addEventListener('keydown',e=>{const m=!modal.hidden?modal:!recovery.hidden?recovery:null;if(!m)return;
  if(el('pvsChoice')&&!el('pvsChoice').hidden)return; // a question on top of the editor handles its own keys
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();m===modal?closeEditor():closeRecovery();return;}
  if(e.key==='Tab'){const items=[...m.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,canvas[tabindex]')].filter(x=>x.getClientRects().length&&(x.tagName==='SUMMARY'||!x.closest('details:not([open])')));const a=items[0],b=items.at(-1);
    if(!m.contains(document.activeElement)){e.preventDefault();a?.focus();}else if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}e.stopImmediatePropagation();return;}
  if(m===modal&&(e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())&&!/^(INPUT|SELECT)$/.test(e.target.tagName)){e.preventDefault();el(e.key.toLowerCase()==='y'||e.shiftKey?'veRedo':'veUndo').click();}
  if(m===modal&&e.target===canvas){if(e.key===' '){e.preventDefault();playing?stop():preview();}if(e.key==='+'||e.key==='=')zoom(2);if(e.key==='-')zoom(.5);if(e.key==='ArrowLeft')setView(E.start-E.seconds*.25,E.seconds);if(e.key==='ArrowRight')setView(E.start+E.seconds*.25,E.seconds);}
  e.stopImmediatePropagation();},true);
modal.addEventListener('pointerdown',e=>{if(e.target===modal)closeEditor();});recovery.addEventListener('pointerdown',e=>{if(e.target===recovery)closeRecovery();});
window.Studio={edit:openEditor,close:closeEditor,sync,removeBacking,undoRemoveBacking,laneMenu,importVocal,playVocal,clearVocal,undoClear,openRecovery,closeRecovery,
  state:()=>({open:!modal.hidden,pid:E.pid,tid:E.tid,a:E.a,b:E.b,start:E.start,seconds:E.seconds,hand:E.hand,removed:!!removedBeat,recoveryOpen:!recovery.hidden}),select:(a,b)=>selection(a,b),view:(a,s)=>setView(a,s)};
setInterval(sync,250);sync();
// ---------------------------------------------------------------- 0.18.3 start card + Help folded away once you have started
(function(){const card=el('rcStartCard'),help=el('rcHelpBox'),link=el('rcHelpLink');let touched=false,wasStarted=null;
  el('rcsRecord').onclick=()=>{el('rcAddBtn').click();RC.msg&&RC.msg('Name the first part and choose its length, then press Record (or R).');};
  el('rcsImport').onclick=()=>importVocal();el('rcsOpen').onclick=()=>el('projBtn').click();el('rcsBacking').onclick=()=>el('fileBeat').click();
  help.addEventListener('toggle',()=>{if(help.dataset.auto!=='1')touched=true;help.dataset.auto='';link.setAttribute('aria-expanded',help.open);document.body.classList.toggle('rc-helpopen',help.open);});
  link.onclick=()=>{help.open=!help.open;if(help.open)help.scrollIntoView({block:'nearest'});};
  const setOpen=v=>{if(help.open!==v){help.dataset.auto='1';help.open=v;}};
  const desk=el('rcStatus'),phone=el('rcPartInfo'),mq=(typeof matchMedia==='function'&&matchMedia('(max-width:899px)'))||{matches:false};
  function placeCard(){if(mq.matches){if(card.previousElementSibling!==phone)phone.after(card);}else if(card.nextElementSibling!==desk)desk.before(card);}
  try{mq.addEventListener?mq.addEventListener('change',placeCard):mq.addListener&&mq.addListener(placeCard);}catch(e){}try{placeCard();}catch(e){}
  function syncStart(){const w=phraseWorkspace?.();if(!w)return;const started=!!(w.phrases.length||S.main);
    const empty=!started&&!busy();if(card.hidden===empty)card.hidden=!empty;el('rcsBacking').hidden=!!S.beat;
    for(const id of ['rcsRecord','rcsImport','rcsOpen','rcsBacking'])el(id).disabled=busy();
    document.body.classList.toggle('rc-started',started);
    if(started!==wasStarted){if(!touched)setOpen(!started);wasStarted=started;}}
  // a control that cannot be used right now says why, in its tooltip, and the big Record button also right below it
  const lockWhy=()=>S.micBlocked?'The microphone is blocked: allow it in the browser address bar, then try again.':S.recStarting?'Opening the microphone…':busy()?'Still working: wait until the status says Ready.':'';
  const WHY={rcBig:lockWhy,rcRec:lockWhy,rcRedoLast:()=>!selectedPhrase()?'Pick a part first.':!selectedPhrase().takes.length?'This part has no take yet.':lockWhy(),
    rcDelUn:()=>lockWhy()||'Every take in this part is the chosen one.',rcDelAll:()=>lockWhy()||'No unchosen takes in any part.',
    rcPrev:()=>lockWhy()||'This is the first part.'};
  const NA=' — Not available now: ';
  function syncWhy(){for(const [id,f] of Object.entries(WHY)){const b=el(id);if(!b)continue;const base=(b.title||'').split(NA)[0],r=b.disabled?f():'';
      const t=r?base+NA+r:base;if(b.title!==t)b.title=t;}
    const w=el('rcBigWhy'),r=el('rcBig').disabled?lockWhy():'';if(w.textContent!==r)w.textContent=r;if(w.hidden!==!r)w.hidden=!r;}
  setInterval(()=>{syncStart();syncWhy();},250);syncStart();Studio.syncStart=syncStart;})();
})();
