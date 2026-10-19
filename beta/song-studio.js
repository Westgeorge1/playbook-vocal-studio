/* Playbook Vocal Studio 0.21.0 — song sections, independent vocal tracks and
 * non-destructive phrase attempts. Integrates with the existing POLISH engine.
 * Browser globals supplied by index.html are intentional; see AGENT-HANDOVER.md. */
(function(){
'use strict';
const C=SongCore,$=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const W=()=>S.song||(S.song=C.empty(S.rate||48000)),T=()=>C.track(W()),R=()=>C.region(W()),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const UI={start:0,span:30,section:null,drag:null,undo:[],redo:[],play:null,capture:null,opening:false,busy:false,shown:RC.step==='rc',renderKey:'',micGainDb:0,repeat:false,revision:0,monitor:false,monitorOk:false,monitorVol:C.clamp(+(localStorage.getItem('pvs.monitorVol')??.8),0,1),lastClicks:[],lastCapture:null,lastLoop:null,get loop(){return C.prefs(W()).loopRec;}};
const host=document.createElement('section');host.id='songStudio';host.setAttribute('aria-label','Song recording studio');host.hidden=!UI.shown;
host.innerHTML=`
<div class="sg-row sg-top"><label><span class="sr-only">Song title</span><input id="songTitle" maxlength="100" aria-label="Song title" value="My song"></label><div class="sg-filebar"><button id="sgSave">Back up project</button><button id="sgOpen">Open project</button><button id="sgExport">Export audio</button><button id="sgNew">New song</button></div></div>
<div class="sg-transport" aria-label="Recording and playback">
 <button id="sgHome" aria-label="Go to song start">|◀</button><button id="sgPlay">▶ Play</button><button id="sgStop">■ Stop</button><button id="sgRecord">● Record</button><button id="sgQuickFix" title="Record only the selected word or phrase">Fix phrase</button><output id="sgClock" class="sg-clock">0:00.0</output><output id="sgBarBeat" class="sg-barbeat" aria-label="Bar and beat" title="Bar | beat">1 | 1</output><button id="sgTempo" class="sg-tempo" title="Tempo and time signature (opens Recording settings)">75 BPM · 4/4</button>
 <span class="sg-rtools" aria-label="Recording helpers"><button id="sgClick" aria-pressed="false" title="Metronome click on/off (C). Heard only in your headphones, never recorded.">♩ Click</button><label class="sg-count">Count-in <select id="sgCountIn" aria-label="Count-in bars"><option value="0">Off</option><option value="1">1 bar</option><option value="2">2 bars</option></select></label><button id="sgMonitor" aria-pressed="false" title="HEAR ME: hear your microphone while recording. Use headphones.">🎧 HEAR ME</button></span>
 <span class="sg-spacer"></span><span id="sgArmed">Recording track: Lead vocal</span><label>Mic <meter id="sgMeter" min="0" max="1" value="0" aria-label="Microphone level"></meter><span id="sgClip"></span></label>
</div>
<p id="sgStatus" class="sg-status" role="status" aria-live="polite">Record your song, then drag over a word or phrase to fix it. Add a vocal track for harmonies.</p>
<div class="sg-sectionbar"><div class="sg-row"><h2>Song sections</h2><span class="sg-help">Labels across every track</span><span class="sg-spacer"></span><button id="sgAddSection">+ Add section</button><button id="sgEditSection">Edit section</button></div><div id="sgSections"></div></div>
<div class="sg-row sg-tools"><div class="sg-row"><button id="sgAddTrack">+ Add vocal track</button><button id="sgImport">Import to this track</button></div><div class="sg-row" aria-label="Timeline zoom"><button id="sgZoomOut" aria-label="Zoom out">−</button><button id="sgZoomIn" aria-label="Zoom in">+</button><button id="sgFit">Fit song</button><button id="sgZoomRange">Fit selection</button><label><input id="sgSnap" type="checkbox"> Snap to beat</label><label><input id="sgHand" type="checkbox"> Drag to scroll</label></div></div>
<div id="sgTimeline" class="sg-timeline"></div>
<div class="sg-scroll"><label for="sgPan">Scroll timeline</label><input id="sgPan" type="range" min="0" max="1" step="0.001" value="0"><output id="sgView"></output></div>
<div class="sg-selection"><div class="sg-row"><strong>Fix a word or phrase</strong><span class="sg-help">Drag on its vocal lane, or enter seconds below.</span></div><div class="sg-row" style="margin-top:8px"><label>Start (s) <input id="sgA" type="number" min="0" max="899.96" step="0.01" aria-label="Phrase start in seconds"></label><label>End (s) <input id="sgB" type="number" min="0.04" max="900" step="0.01" aria-label="Phrase end in seconds"></label><button id="sgUseSection">Use section</button><button id="sgClearRange">Clear selection</button><button id="sgHearRange">▶ Hear selection</button><button id="sgFix">● Fix selected phrase</button><button id="sgLoop" aria-pressed="false" title="Loop the selection without gaps while you record; each pass becomes an attempt (L)">⟲ Loop: Off</button><label title="Stop after each attempt, then play the lead-in again"><input id="sgRepeat" type="checkbox"> Repeat with lead-in</label></div><p id="sgRangeHint" class="sg-help">Select a range to record only that spot. Other tracks and the rest of this vocal stay unchanged.</p></div>
<div class="sg-takes"><div class="sg-row"><h2 id="sgTakesTitle">Takes on this track</h2><select id="sgRegion" aria-label="Recording range to inspect"></select><span class="sg-spacer"></span><button id="sgRetry">Record this range again</button><button id="sgRemoveRange">Remove range…</button></div><div id="sgTakes" class="sg-take-list"></div><p class="sg-help">Listen plays the attempt in context. Choose uses it in your song. Earlier audio and other attempts remain available.</p></div>
<details class="sg-settings"><summary>Recording settings and help</summary><div class="sg-row"><label>Tempo <input id="sgBpm" type="number" min="50" max="200" step="1"> BPM</label><label>Time signature <select id="sgTimeSig"><option value="2">2/4</option><option value="3">3/4</option><option value="4">4/4</option><option value="5">5/4</option><option value="6">6/4</option><option value="7">7/4</option></select></label><label>Click volume <input id="sgClickVol" type="range" min="0" max="100" step="1"></label><label>HEAR ME level <input id="sgMonitorVol" type="range" min="0" max="100" step="1"></label></div><div class="sg-row"><label>Lead-in <input id="sgLead" type="number" min="0" max="5" step="0.5"> s</label><label>Mic gain <input id="sgMicGain" type="number" min="-24" max="18" step="1" value="0"> dB</label><label>Timing correction <input id="sgLatency" type="number" min="0" max="800" step="1"> ms</label><button id="sgCalibration">Timing test</button><label>Join fade <input id="sgFade" type="number" min="0" max="100" step="5"> ms</label><label>Master level <input id="sgMaster" type="number" min="-36" max="6" step="1"> dB</label></div><p class="sg-help">Use headphones so the microphone does not pick up your music. Backing and existing vocals are heard but are never written into the microphone take. During a fix, the selected lane is silent only inside the replacement range. Count-in replaces the lead-in when it is on. HEAR ME has a small delay; turn it off if it distracts you.</p><table class="sg-keys"><tr><td><kbd>R</kbd></td><td>Stopped: record on the selected track (R again = stop and keep). Playing: <b>punch in</b> where you are; R again punches out and the song keeps playing</td></tr><tr><td><kbd>Space</kbd></td><td>Play / pause · while recording: stop and keep</td></tr><tr><td><kbd>Esc</kbd></td><td>Cancel the recording in progress (nothing is added)</td></tr><tr><td><kbd>C</kbd></td><td>Metronome click on / off</td></tr><tr><td><kbd>L</kbd></td><td>Loop recording on / off for the selection (one attempt per pass, no gaps)</td></tr><tr><td><kbd>Home</kbd></td><td>Go to the song start</td></tr><tr><td><kbd>Ctrl/⌘ Z</kbd> · <kbd>Ctrl/⌘ Shift Z</kbd></td><td>Undo / redo a song edit</td></tr><tr><td><kbd>Ctrl/⌘ S</kbd></td><td>Back up the project</td></tr></table><p id="sgCapacity" class="sg-help"></p><p class="sg-help">Limits: 8 vocal tracks, 15-minute song, 10 minutes per continuous recording, 32 attempts per range, 128 takes and 128 MB of vocal sources. The microphone stops when capacity is reached. Song sections are not restricted to 60 seconds.</p></details>
<div class="sg-row sg-footer"><span id="sgSaveState" class="sg-help">Autosave is local to this browser. Keep project backups.</span><button id="sgPolish">Polish selected vocal →</button></div>
<input id="sgImportFile" type="file" accept="audio/*,.wav,.mp3,.m4a,.flac" hidden>`;
$('rcSteps').after(host);
const polishNotice=document.createElement('div');polishNotice.id='sgPolishNotice';polishNotice.hidden=true;host.after(polishNotice);
const modal=document.createElement('dialog');modal.id='songDialog';modal.setAttribute('aria-labelledby','sgDialogTitle');document.body.append(modal);
let modalResolve=null,modalFocus=null;
function finishDialog(action){if(!modalResolve)return;const values={};for(const input of modal.querySelectorAll('[name]'))values[input.name]=input.type==='checkbox'?input.checked:input.value;const done=modalResolve;modalResolve=null;modal.close();modalFocus?.isConnected&&modalFocus.focus();done({action,values});}
function dialog(title,html,buttons=[['cancel','Cancel'],['ok','Save']]){if(modalResolve)return Promise.resolve({action:'cancel',values:{}});modalFocus=document.activeElement;modal.innerHTML='<h2 id="sgDialogTitle">'+esc(title)+'</h2><form id="sgDialogForm"><div class="sg-dialog-content">'+html+'</div><p class="sg-dialog-error" id="sgDialogError" role="status"></p><div class="sg-row sg-dialog-buttons">'+buttons.map(([k,n])=>'<button type="'+(k==='ok'?'submit':'button')+'" data-action="'+esc(k)+'">'+esc(n)+'</button>').join('')+'</div></form>';
 modal.querySelector('form').onsubmit=e=>{e.preventDefault();finishDialog('ok');};modal.querySelectorAll('[data-action]').forEach(b=>{if(b.type!=='submit')b.onclick=()=>finishDialog(b.dataset.action);});modal.showModal();(modal.querySelector('input,select')||modal.querySelector('button'))?.focus();return new Promise(resolve=>modalResolve=resolve);}
modal.addEventListener('cancel',e=>{e.preventDefault();finishDialog('cancel');});
function busy(){return UI.busy||UI.opening||!!UI.capture||sessionLocked();}
function message(text,error=false){$('sgStatus').textContent=text;$('sgStatus').classList.toggle('error',error);}
function clock(t){t=Math.max(0,t);return Math.floor(t/60)+':'+(t%60).toFixed(1).padStart(4,'0');}
function current(){const p=UI.play;if(!p)return W().cursor;const t=audioCtx().currentTime;return p.map?p.map(Math.max(t,p.when)):p.start+Math.max(0,t-p.when);}
function backup(){UI.undo.push(C.clone(W()));if(UI.undo.length>30)UI.undo.shift();UI.redo=[];}
function trimHistory(){const bytes=()=>{const buffers=new Set();for(const w of [W(),...UI.undo,...UI.redo]){for(const s of Object.values(w.sources))for(const c of s.channels)buffers.add(c.buffer);for(const t of w.tracks)if(t.polish)for(const ch of [t.polish.channels,t.polish.session.pcm,...(t.polish.session.takes||[])])for(const c of ch||[])buffers.add(c.buffer);}return [...buffers].reduce((n,b)=>n+b.byteLength,0);};while(bytes()>256*1024*1024&&(UI.undo.length>1||UI.redo.length)){if(UI.undo.length>1)UI.undo.shift();else UI.redo.shift();}}
function changed(text){trimHistory();W().revision++;S.isSample=false;C.gc(W());persist();UI.renderKey='';render();if(text)message(text);}
function edit(fn,text,live=false){if(busy())return false;if(!live)stopPlay();const previous=C.clone(W());try{fn(W());C.validate(W());UI.undo.push(previous);if(UI.undo.length>30)UI.undo.shift();UI.redo=[];changed(text);if(live)syncLiveMix();return true;}catch(e){S.song=previous;message(e.message,true);render();return false;}}
function history(dir){if(busy())return;const from=dir<0?UI.undo:UI.redo,to=dir<0?UI.redo:UI.undo;if(!from.length)return;stopPlay();to.push(C.clone(W()));const applied=W().appliedSig,processing=new Map(W().tracks.map(t=>[t.id,t.polish]));S.song=from.pop();for(const t of W().tracks){const p=processing.get(t.id);if(p)t.polish={...p,bypass:!!t.polish?.bypass};}W().appliedSig=applied;UI.section=null;changed(dir<0?'Undone. Your previous audio is restored.':'Redone.');}
function setRange(a,b){try{C.range(a,b);W().range=[a,b];W().cursor=a;const r=C.findRange(T(),a,b);W().selectedRegion=r?.id||null;render();persist();return true;}catch(e){message(e.message,true);return false;}}
function focusTrack(id){if(busy())return;stopPlay();W().activeTrack=id;W().selectedRegion=null;W().range=null;render();persist();message('Recording track: '+T().name+'. Other vocal tracks play alongside it.');}
async function addTrack(){if(busy())return;const r=await dialog('Add vocal track','<label>Track name <input name="name" maxlength="100" value="Backing vocal '+W().tracks.length+'" required></label><p>Record harmonies, doubles or ad-libs here. Your other tracks stay in place.</p>',[['cancel','Cancel'],['ok','Add track']]);if(r.action==='ok')edit(w=>C.addTrack(w,r.values.name),'Vocal track added. It is selected for recording.');}
async function trackMenu(id){if(busy())return;const t=C.track(W(),id);const r=await dialog('Vocal track','<label>Name <input name="name" maxlength="100" value="'+esc(t.name)+'" required></label>'+(t.polish?'<label><input type="checkbox" name="dry" '+(t.polish.bypass?'checked':'')+'> Use dry vocal (keep POLISH settings)</label>':'')+'<p>Removing a track also removes its attempts from this song. Undo restores it during this session.</p>',[['cancel','Cancel'],['remove','Remove track…'],['ok','Save name']]);
 if(r.action==='ok')edit(()=>{t.name=C.label(r.values.name,'Vocal track');if(t.polish)t.polish={...t.polish,bypass:!!r.values.dry};},'Track settings saved.');
 if(r.action==='remove'){if(W().tracks.length===1){message('Keep at least one vocal track. Start a new song to clear the session.',true);return;}const a=await dialog('Remove '+t.name+'?','<p>Its '+t.regions.reduce((n,r)=>n+r.takes.length,0)+' attempts will be removed. Undo can bring them back until you close this session.</p>',[['cancel','Keep track'],['ok','Remove track']]);if(a.action==='ok')edit(w=>{w.tracks=w.tracks.filter(x=>x.id!==id);if(w.activeTrack===id){w.activeTrack=w.tracks[0].id;w.selectedRegion=null;}},'Track removed. Undo restores it.');}}
async function sectionForm(existing){if(busy())return;const s=existing||null,range=W().range||[W().sections.at(-1)?.end||W().cursor,Math.min(900,(W().sections.at(-1)?.end||W().cursor)+16)];
 const d=await dialog(s?'Edit song section':'Add song section','<label>Name <input name="name" list="sgSectionNames" maxlength="100" value="'+esc(s?.name||(!W().sections.length?'Intro':'Verse '+(W().sections.filter(x=>/^verse/i.test(x.name)).length+1)))+'" required></label><datalist id="sgSectionNames">'+['Intro','Verse 1','Chorus','Verse 2','Bridge','Outro'].map(x=>'<option>'+x+'</option>').join('')+'</datalist><label>Start (seconds) <input name="start" type="number" min="0" max="899.96" step="0.01" value="'+(s?.start??range[0]).toFixed(2)+'" required></label><label>End (seconds) <input name="end" type="number" min="0.04" max="900" step="0.01" value="'+(s?.end??range[1]).toFixed(2)+'" required></label><p>Sections label the song across every track. Changing a section does not cut or move your recordings.</p>',s?[['cancel','Cancel'],['remove','Remove label'],['ok','Save section']]:undefined);
 if(d.action==='remove')edit(w=>{w.sections=w.sections.filter(x=>x.id!==s.id);UI.section=null;},'Section label removed. The recordings are unchanged.');
 if(d.action==='ok')edit(w=>{if(s)w.sections=w.sections.filter(x=>x.id!==s.id);const n=C.addSection(w,d.values.name,+d.values.start,+d.values.end);UI.section=n.id;},'Song section saved. Your recordings stay in place.');}
function setView(start,span){UI.span=C.clamp(span,.25,900);const end=Math.max(C.duration(W()),S.beat?.duration||0,W().cursor+1,UI.span);UI.start=C.clamp(start,0,Math.max(0,end-UI.span));draw();}
function fit(){setView(0,Math.max(10,C.duration(W())+.5,S.beat?.duration||0));}

// Playback sources share the same AudioContext start time. No microphone nodes
// connect to this output graph. The recording track is masked only in the fix.
function stopPlay(keepPosition=true){const p=UI.play;if(!p)return;if(UI.capture?.punch&&UI.capture.playback===p&&!UI.capture.stopping)stopRecording('Playback stopped.');if(keepPosition)W().cursor=C.clamp(p.loop?p.loop.a:current(),0,900);UI.play=null;clearTimeout(p.timer);stopClicks(p);for(const n of p.nodes){try{n.stop();}catch(e){}try{n.disconnect();}catch(e){}}renderTransport();}
function syncLiveMix(){const p=UI.play;if(!p)return;const w=W(),now=audioCtx().currentTime,solo=w.tracks.some(t=>t.solo);p.master?.gain.setTargetAtTime(Math.pow(10,w.masterDb/20),now,.02);for(const v of p.voices||[]){const t=C.track(w,v.id);if(!t)continue;const pan=C.panGains(v.nc,t.pan),gain=t.mute||(solo&&!t.solo)||(UI.capture?.punch&&UI.capture.trackId===v.id)?0:Math.pow(10,t.gainDb/20);v.left.gain.setTargetAtTime(gain*pan[0],now,.02);v.right.gain.setTargetAtTime(gain*pan[1],now,.02);}if(p.click)p.click.gain.setTargetAtTime(prefs().clickVol,now,.02);if(p.backing)p.backing.gain.setTargetAtTime($('beatOn').checked?(S.beatLevel??.8):0,now,.02);}
// 0.21.0 click/metronome: a look-ahead scheduler on the PLAYBACK graph only (its own
// gain straight to the speakers). Segments map song time to AudioContext time, so the
// click stays on the bar grid for normal playback, recording, count-in and loops.
const clickCache=new WeakMap();
function clickBuffers(ctx){let c=clickCache.get(ctx);if(c)return c;const make=(f,amp)=>{const n=Math.round(ctx.sampleRate*.035),b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=amp*Math.sin(2*Math.PI*f*i/ctx.sampleRate)*Math.exp(-i/(ctx.sampleRate*.006));return b;};c={hi:make(1760,.9),lo:make(1175,.6)};clickCache.set(ctx,c);return c;}
function segment(p,k){if(!p.loop)return k===0?{c0:p.when,s0:p.start,s1:p.end}:null;const L=p.loop;if(k===0)return {c0:p.when,s0:L.a-L.lead,s1:L.a};return {c0:p.when+L.lead+(k-1)*L.len,s0:L.a,s1:L.a+L.len};}
function startClicks(p,countTo){const ctx=audioCtx();p.click=ctx.createGain();p.click.gain.value=prefs().clickVol;p.click.connect(ctx.destination);p.nodes.push(p.click);p.countTo=countTo;p.ck={k:0,beat:null};p.clickLog=[];UI.lastClicks=p.clickLog;const tick=()=>{if(UI.play!==p)return;scheduleClicks(p);p.clickTimer=setTimeout(tick,40);};tick();}
function scheduleClicks(p){const ctx=audioCtx(),now=ctx.currentTime,horizon=now+.3,bs=beatLen(),pr=prefs(),buf=clickBuffers(ctx);
 for(let guard=0;guard<512;guard++){const seg=segment(p,p.ck.k);if(!seg)return;if(p.ck.beat==null)p.ck.beat=Math.ceil(seg.s0/bs-1e-9);const s=p.ck.beat*bs;if(s>=seg.s1-1e-9||s>=900){p.ck.k++;p.ck.beat=null;continue;}const at=seg.c0+(s-seg.s0);if(at>horizon)return;p.ck.beat++;
  const counting=p.countTo!=null&&p.ck.k===0&&s<p.countTo-1e-9;if(at<now-.005||!(pr.click||counting))continue;const accent=((Math.round(s/bs)%pr.meter)+pr.meter)%pr.meter===0,src=ctx.createBufferSource();src.buffer=accent?buf.hi:buf.lo;src.connect(p.click);src.start(at);p.clickLog.push({at,s,accent,countIn:counting});if(p.clickLog.length>4000)p.clickLog.splice(0,2000);}}
function stopClicks(p){clearTimeout(p.clickTimer);p.clickTimer=0;}
// Gapless loop playback over [a,b): one pre-roll (lead-in / count-in) then the same
// range repeats sample-accurately via looping buffer sources. The armed lane is
// silent inside the range; other lanes and the backing play every pass.
async function playLoop(a,b,lead,excludeTrack,countTo){
 stopPlay(false);if(loop)endLoop();stopPlayback();
 const w=W(),ctx=await resumeAudio(),master=ctx.createGain();master.connect(ctx.destination);
 const len=(Math.round(b*w.rate)-Math.round(a*w.rate))/w.rate,from=a-lead,to=a+len;
 const p={start:from,end:Infinity,when:0,nodes:[master],voices:[],timer:null,forRecording:true,master,loop:{a,b:to,lead,len}};
 p.map=t=>{const x=t-p.when;return x<lead?from+x:a+((x-lead)%len);};
 const queued=[];
 for(const t of w.tracks){if(!t.regions.some(r=>r.selected))continue;const channels=C.renderVoice(w,t,{start:from,end:to,exclude:t.id===excludeTrack?[a,to]:null}),src=ctx.createBufferSource(),split=ctx.createChannelSplitter(channels.length),left=ctx.createGain(),right=ctx.createGain(),merge=ctx.createChannelMerger(2);
  src.buffer=bufferOf(channels,w.rate);src.loop=true;src.loopStart=lead;src.loopEnd=lead+len;src.connect(split);split.connect(left,0);split.connect(right,channels.length>1?1:0);left.connect(merge,0,0);right.connect(merge,0,1);merge.connect(master);p.voices.push({id:t.id,nc:channels.length,left,right});p.nodes.push(src,split,left,right,merge);queued.push(()=>src.start(p.when));}
 if(S.beat){const br=S.beat.sampleRate,n0=Math.round(from*br),n=Math.max(1,Math.round((to-from)*br)),buf=ctx.createBuffer(S.beat.numberOfChannels,n,br);for(let c=0;c<S.beat.numberOfChannels;c++){const d=S.beat.getChannelData(c),o=buf.getChannelData(c);for(let i=Math.max(0,-n0);i<n&&n0+i<d.length;i++)o[i]=d[n0+i];}
  const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buf;src.loop=true;src.loopStart=lead;src.loopEnd=lead+len;src.connect(gain).connect(master);p.backing=gain;p.nodes.push(src,gain);queued.push(()=>src.start(p.when));}
 p.when=ctx.currentTime+.25;UI.play=p;syncLiveMix();for(const s of queued)s();startClicks(p,countTo);renderTransport();return p;
}
async function play(start=W().cursor,{end=null,override=null,excludeTrack=null,excludeRange=null,forRecording=false,countTo=null}={}){
 if(!forRecording&&busy())return false;stopPlay(false);if(loop)endLoop();stopPlayback();
 const w=W(),dur=Math.min(910,Math.max(C.duration(w),$('beatOn').checked?(S.beat?.duration||0):0));if(end==null)end=dur;
 if(start>=end-.04)start=0;if(end-start<.04)return false;
 const ctx=await resumeAudio(),master=ctx.createGain();master.connect(ctx.destination);
 const p={start,end,when:0,nodes:[master],voices:[],timer:null,forRecording,master};
 const queued=[],offset=Math.max(0,-start);
 for(const t of w.tracks){if(!t.regions.some(r=>r.selected||(override?.regionId===r.id&&override.takeId)))continue;const trackEnd=Math.min(end,Math.max(C.trackEnd(t),C.polishValid(w,t)&&!t.polish.bypass?t.polish.channels[0].length/w.rate:0));if(trackEnd<=Math.max(0,start))continue;
  const channels=C.renderVoice(w,t,{start:Math.max(0,start),end:trackEnd,override,exclude:t.id===excludeTrack?excludeRange:null}),src=ctx.createBufferSource(),split=ctx.createChannelSplitter(channels.length),left=ctx.createGain(),right=ctx.createGain(),merge=ctx.createChannelMerger(2);src.buffer=bufferOf(channels,w.rate);src.connect(split);split.connect(left,0);split.connect(right,channels.length>1?1:0);left.connect(merge,0,0);right.connect(merge,0,1);merge.connect(master);p.voices.push({id:t.id,nc:channels.length,left,right});p.nodes.push(src,split,left,right,merge);queued.push(()=>src.start(p.when+offset));
 }
 if(S.beat){const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=S.beat;src.connect(gain).connect(master);p.backing=gain;p.nodes.push(src,gain);const from=Math.max(0,start),seconds=Math.min(end-from,S.beat.duration-from);if(seconds>0)queued.push(()=>src.start(p.when+offset,from,seconds));}
 // Allocate/render first, schedule second: long-song rendering must never make
 // a scheduled microphone gate expire before the capture node is connected.
 p.when=ctx.currentTime+.25;UI.play=p;syncLiveMix();for(const schedule of queued)schedule();startClicks(p,countTo);
 if(!forRecording)p.timer=setTimeout(()=>{if(UI.play===p){W().cursor=C.clamp(end,0,900);stopPlay(false);render();}},(end-start+.3)*1000);
 renderTransport();return p;
}
async function togglePlay(){if(UI.capture||UI.opening)return;if(UI.play){stopPlay();render();return;}try{await play();}catch(e){message('Playback could not start: '+e.message,true);}}
async function audition(regionId,takeId){if(busy())return;const r=T().regions.find(r=>r.id===regionId);if(!r)return;const begin=Math.max(0,r.start-W().lead),end=Math.min(900,r.end+.7);await play(begin,{end,override:{regionId:r.id,takeId}});message('Listening to this attempt dry, alongside the other processed vocals. Choose it when you are happy with it, then update POLISH for this track.');}

// Microphone capture uses sample-frame gates, with flushed final blocks. A stop,
// device loss, hidden tab or AudioContext interruption keeps captured samples.
// 0.21.0: SongStudio is the ONLY capture owner. Three capture shapes share one graph:
//  normal/fix (playback starts with the capture), punch (playback already running) and
//  gapless loop (looping playback, one continuous capture split into passes).
// Graph: mic -> mic gain -> capture worklet (input only; its output is muted)
//                        \-> HEAR ME gain -> speakers/headphones
// The click and every lane play on a separate output graph; nothing but the
// microphone reaches the capture worklet, so click/monitor/other lanes never enter PCM.
let workletContext=null;
const songAt=(p,t)=>p.map?p.map(t):p.start+(t-p.when);
const ctxAt=(p,s)=>p.when+(s-p.start);
function bpm(){return C.clamp(+$('bpm').value||75,50,200);}
function prefs(){return C.prefs(W());}
function beatLen(){return C.beatSec(bpm());}
function barLen(){return beatLen()*prefs().meter;}
async function openMic(){
 if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone recording needs HTTPS or localhost. Open the hosted app in a browser.');
 const ctx=await resumeAudio();if(!ctx.audioWorklet)throw Error('This browser needs AudioWorklet support. Use a current Chrome, Edge or Safari browser.');
 if(workletContext!==ctx){await ctx.audioWorklet.addModule('song-capture-worklet.js?v=0.21.0');workletContext=ctx;}
 if(window.pvsRecPrepare)pvsRecPrepare();const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});return {ctx,stream};
}
function wire(c){const ctx=c.ctx;
 c.src=ctx.createMediaStreamSource(c.stream);c.gain=ctx.createGain();c.gain.gain.value=Math.pow(10,UI.micGainDb/20);
 c.node=new AudioWorkletNode(ctx,'song-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{first:c.first,last:c.last}});
 c.keep=ctx.createGain();c.keep.gain.value=0;c.src.connect(c.gain).connect(c.node).connect(c.keep).connect(ctx.destination);
 c.mon=ctx.createGain();c.mon.gain.value=UI.monitor?UI.monitorVol:0;c.gain.connect(c.mon).connect(ctx.destination);
 c.node.port.onmessage=e=>{if(c.finished)return;if(e.data.data){const d=e.data.data;c.chunks.push(e.data);c.frames+=d.length;let peak=0;for(const x of d)peak=Math.max(peak,Math.abs(x));c.peak=peak;c.clipped ||= peak>=.999;}if(e.data.done)finishCapture(c,e.data.last);};
 c.node.onprocessorerror=()=>stopRecording('The microphone processor stopped.');
 for(const tr of c.stream.getTracks())tr.onended=()=>stopRecording('The microphone disconnected.');
 c.promise=new Promise(resolve=>c.resolve=resolve);UI.lastCapture={first:c.first,last:c.last,rate:c.rate,a:c.a,b:c.b,latency:c.latency,when:c.playback.when,start:c.playback.start,punch:!!c.punch,loop:c.loop||null};
}
function unwire(c){for(const tr of c.stream?.getTracks()||[]){tr.onended=null;tr.stop();}for(const n of [c.src,c.gain,c.node,c.keep,c.mon])try{n?.disconnect();}catch(e){}}
function captureBase(w,t,extra){return {w,trackId:t.id,regionId:null,handle:.15,bounded:false,repeat:false,chunks:[],frames:0,peak:0,clipped:false,finished:false,stopping:false,reason:'',resolve:null,timer:null,...extra};}
async function record(bounded=false,repeat=false){
 if(UI.capture){await stopRecording();return;}if(UI.opening){UI.cancelOpen=true;return;}
 if(!bounded&&UI.play&&!UI.play.forRecording&&!UI.busy&&!sessionLocked())return punchIn();
 if(busy())return;
 const w=W(),t=T(),range=bounded?w.range?.slice():null;if(bounded&&!range){message('Select the word or phrase first.',true);return;}
 const loopMode=bounded&&UI.loop;
 let a=range?range[0]:C.clamp(current(),0,899.96),b=range?range[1]:null,r=range?C.findRange(t,...range):null;
 const u=C.usage(w);if(u.takes>=C.LIMITS.takes||(r&&r.takes.length>=32)){message('Take limit reached. Back up the project and remove unused attempts.',true);return;}
 stopPlay();if(loop)endLoop();stopPlayback();UI.opening=true;UI.cancelOpen=false;S.songWorking=true;render();message('Opening microphone for '+t.name+'…');
 let stream,c=null;
 try{
  const m=await openMic();stream=m.stream;const ctx=m.ctx;
  if(UI.cancelOpen){throw Error('Recording cancelled before it started.');}
  const room=Math.floor((C.LIMITS.bytes-u.bytes)/(w.rate*4))-.5,available=Math.min(C.LIMITS.recordSeconds,900-a,room);
  if(available<.1)throw Error('No room for another take. Back up and remove unused attempts.');
  if(range&&!loopMode&&b-a>available)throw Error('Not enough room for this entire range. Back up and remove unused attempts, or select a shorter range.');
  const pr=prefs(),latency=C.clamp(+$('sgLatency').value||0,0,800)/1000,lead=pr.countIn?C.countInWindow(a,pr.countIn,bpm(),pr.meter).lead:w.lead;
  if(loopMode){
   const playback=await playLoop(a,b,lead,t.id,pr.countIn?a:null),rate=ctx.sampleRate,first=Math.round((playback.when+lead+latency)*rate),last=first+Math.round(available*rate);
   c=captureBase(w,t,{regionId:r?.id||null,a,b,origin:a,handle:0,bounded:true,loop:{len:playback.loop.len,rate:w.rate},rate,first,last,latency,stream,ctx,playback});
  }else{
   b=b??a+available;const start=Math.max(-20,a-lead);
   const playback=await play(start,{end:Math.min(900,b+.9),excludeTrack:t.id,excludeRange:[a,b],forRecording:true,countTo:pr.countIn?a:null});
   const handle=.15,origin=a-handle,rate=ctx.sampleRate,first=Math.round((playback.when+origin-start+latency)*rate),last=Math.round((playback.when+b+handle-start+latency)*rate);
   c=captureBase(w,t,{regionId:r?.id||null,a,b,origin,handle,bounded,repeat,rate,first,last,latency,stream,ctx,playback});
  }
  wire(c);
  c.timer=setTimeout(()=>stopRecording('Recording reached its time or storage limit.'),((c.last-c.first)/c.rate+lead+2)*1000);
  UI.capture=c;UI.opening=false;render();
  message(loopMode?'Loop recording '+clock(a)+'–'+clock(b)+' on '+t.name+'. Sing every pass; each pass becomes an attempt. Press Stop when you are done.':(a>Math.max(-20,a-lead)?(pr.countIn?'Count-in: '+pr.countIn+' bar'+(pr.countIn>1?'s':'')+', then sing. ':'Listen to the lead-in, then sing. '):'')+'Recording '+t.name+(range?' from '+clock(a)+' to '+clock(b)+'.':' until you press Stop.'));
 }catch(e){if(c)unwire(c);else for(const tr of stream?.getTracks()||[])tr.stop();UI.opening=false;S.songWorking=false;stopPlay(false);message(e.message,true);render();}
}
// Punch-in on the fly: the song is already playing; R starts a capture on the armed
// lane at the current position without restarting playback; R again punches out.
async function punchIn(){
 const p=UI.play,w=W(),t=T(),u=C.usage(w);if(u.takes>=C.LIMITS.takes){message('Take limit reached. Back up the project and remove unused attempts.',true);return;}
 UI.opening=true;UI.cancelOpen=false;S.songWorking=true;renderTransport();message('Punch-in on '+t.name+': opening the microphone…');
 let stream,c=null;
 try{
  const m=await openMic();stream=m.stream;const ctx=m.ctx;if(UI.cancelOpen||UI.play!==p)throw Error('Punch-in cancelled.');
  const latency=C.clamp(+$('sgLatency').value||0,0,800)/1000,rate=ctx.sampleRate,a=C.clamp(songAt(p,ctx.currentTime+.05),0,899.9);
  const room=Math.floor((C.LIMITS.bytes-u.bytes)/(w.rate*4))-.5,b=Math.min(p.end,900,a+Math.min(C.LIMITS.recordSeconds,room));
  if(b-a<.2)throw Error('Too close to the end of the song to punch in.');
  c=captureBase(w,t,{a,b,origin:a,handle:0,punch:true,rate,first:Math.round((ctxAt(p,a)+latency)*rate),last:Math.round((ctxAt(p,b)+latency)*rate),latency,stream,ctx,playback:p});
  wire(c);UI.capture=c;UI.opening=false;
  const v=p.voices.find(v=>v.id===t.id),at=Math.max(ctx.currentTime,ctxAt(p,a));if(v)for(const g of [v.left,v.right]){g.gain.cancelScheduledValues(at);g.gain.setTargetAtTime(0,at,.005);}
  c.timer=setTimeout(()=>stopRecording('Recording reached its time or storage limit.'),(b-a+2)*1000);
  render();message('Punched in at '+clock(a)+' on '+t.name+'. Press R to punch out; the song keeps playing.');
 }catch(e){if(c)unwire(c);else for(const tr of stream?.getTracks()||[])tr.stop();UI.capture=null;UI.opening=false;S.songWorking=false;message(e.message,true);render();}
}
async function stopRecording(reason='',{cancel=false}={}){
 UI.repeat=false;$('sgRepeat').checked=false;
 if(UI.opening){UI.cancelOpen=true;message('Cancelling microphone setup…');return;}
 const c=UI.capture;if(!c||c.stopping)return c?.promise;c.stopping=true;c.reason=reason;c.cancelled=cancel;
 if(!c.bounded)c.stopEnd=C.clamp(current(),c.a,c.b);
 const stopAt=Math.min(c.last,Math.max(c.first,Math.round((c.ctx.currentTime+c.latency+c.handle)*c.rate)));
 c.node.port.postMessage({stopAt});c.last=stopAt;
 // Suspended/disconnected processors may not acknowledge. Retain received frames.
 c.fallback=setTimeout(()=>finishCapture(c,c.chunks.at(-1)?.frame+c.chunks.at(-1)?.data.length||c.first),Math.max(300,(stopAt/c.rate-c.ctx.currentTime)*1000+300));
 message(cancel?'Cancelling the recording…':'Keeping the recording…');return c.promise;
}
async function finishCapture(c,last){
 if(c.finished)return;c.finished=true;clearTimeout(c.timer);clearTimeout(c.fallback);if(!c.punch||c.cancelled)stopPlay(false);unwire(c);
 UI.capture=null;UI.busy=true;UI.opening=false;S.songWorking=true;syncLiveMix();
 try{
  if(c.cancelled){message('Recording cancelled. Nothing was added; your song is unchanged.');return;}
  const end=Math.min(last,c.last),n=Math.max(0,end-c.first);if(n<c.rate*.04||!c.frames){message('Stopped before enough audio was captured. Your existing recordings are unchanged.');return;}
  const pcm=new Float32Array(n);let copied=0;for(const x of c.chunks){const lo=Math.max(c.first,x.frame),hi=Math.min(end,x.frame+x.data.length);if(hi>lo){pcm.set(x.data.subarray(lo-x.frame,hi-x.frame),lo-c.first);copied+=hi-lo;}}
  if(copied<n-c.rate*.02)c.reason='The audio stream had a gap. Listen before choosing this take.';
  if(c.loop){await finishLoop(c,pcm);return;}
  const actualEnd=c.origin+n/c.rate,complete=!c.bounded||actualEnd>=c.b-.002;if(actualEnd-c.a<.04){message('Stopped during the lead-in. Your existing recordings are unchanged.');return;}let channels=await phraseResample([pcm],c.rate,c.w.rate);
  const needed=Math.round((actualEnd-c.origin)*c.w.rate);if(channels[0].length!==needed){const out=new Float32Array(needed);out.set(channels[0].subarray(0,needed));channels=[out];}
  const base=S.song===c.w?c.w:W(),next=C.clone(base);const added=C.addTake(next,{trackId:c.trackId,regionId:c.regionId,start:c.a,end:c.bounded?c.b:Math.min(c.stopEnd??c.b,actualEnd,900),channels,origin:c.origin,kind:c.bounded?'fix':c.punch?'punch':'record',choose:!c.bounded&&!c.reason});
  if(c.punch)added.region.fadeMs=Math.max(5,next.fadeMs);
  C.validate(next);UI.undo.push(C.clone(base));if(UI.undo.length>30)UI.undo.shift();UI.redo=[];S.song=next;if(!c.punch)W().cursor=c.bounded?c.a:added.region.end;if(c.bounded)W().range=[c.a,c.b];
  message((c.reason?c.reason+' ':'')+added.take.name+' kept on '+C.track(W(),c.trackId).name+'. '+(c.punch?'Punch-in '+clock(added.region.start)+'–'+clock(added.region.end)+' replaces that stretch with short fades. “Keep earlier audio” puts the old part back.':!complete?'This attempt ended early; it is kept for listening but cannot replace the whole selected range.':c.bounded||c.reason?'Listen, then Choose. Your earlier vocal stays until you choose.':'It is now playing in the song. Select a phrase to fix it.')+(c.clipped?' Input clipped: lower Mic gain and record again.':''),!!c.reason||c.clipped);
  changed();
  const again=c.repeat&&!c.stopping&&!c.reason&&complete;
  if(again){UI.busy=false;S.songWorking=false;setTimeout(()=>{if(UI.repeat)record(true,true);},100);}
 }catch(e){
  const kept=c.chunks.map(x=>x.data);const samples=new Float32Array(kept.reduce((n,a)=>n+a.length,0));let at=0;for(const x of kept){samples.set(x,at);at+=x.length;}
  if(samples.length&&window.Recovery){try{Recovery.keep(new Blob([wavFloat([samples],c.rate)],{type:'audio/wav'}),'Recovered vocal track','Multitrack capture: '+e.message);}catch(_){} }
  message('Take could not be placed: '+e.message+'. Check Recovered audio for the microphone file.',true);
 }finally{UI.busy=false;S.songWorking=false;c.resolve();render();try{persistNow().catch(()=>persist());}catch(e){persist();}}
}
// Gapless loop: the capture is continuous; pass k is samples [k*len,(k+1)*len).
async function finishLoop(c,pcm){
 const w=S.song===c.w?c.w:W(),[ch]=await phraseResample([pcm],c.rate,w.rate),len=Math.round(c.b*w.rate)-Math.round(c.a*w.rate),passes=C.loopPasses(ch.length,len);
 const next=C.clone(w);let regionId=c.regionId,kept=0,full=0,region=null;const room=32-(regionId?C.track(next,c.trackId).regions.find(r=>r.id===regionId)?.takes.length||0:0);
 for(const [lo,hi] of passes){if(hi-lo<Math.min(len,Math.round(.25*w.rate))||kept>=room)continue;const added=C.addTake(next,{trackId:c.trackId,regionId,start:c.a,end:c.b,channels:[ch.slice(lo,hi)],origin:c.a,kind:'fix'});regionId=added.region.id;region=added.region;kept++;if(hi-lo===len)full++;}
 UI.lastLoop={passes:passes.length,kept,full,len,total:ch.length,bounds:passes};
 if(!kept){message('Stopped before a whole loop pass was sung. Your existing recordings are unchanged.');return;}
 C.validate(next);UI.undo.push(C.clone(w));if(UI.undo.length>30)UI.undo.shift();UI.redo=[];S.song=next;W().cursor=c.a;W().range=[c.a,c.b];W().selectedRegion=region.id;
 message((c.reason?c.reason+' ':'')+kept+' loop pass'+(kept>1?'es':'')+' kept as attempts ('+full+' complete) on '+C.track(W(),c.trackId).name+'. Listen, then Choose the best one.'+(c.clipped?' Input clipped: lower Mic gain and record again.':''),!!c.reason||c.clipped);
 changed();
}


async function importAudio(file){if(!file||busy())return;stopPlay();UI.busy=true;S.songWorking=true;message('Importing '+file.name+'…');const trackId=W().activeTrack,start=W().cursor;
 try{const b=await decodeFile(file);if(start+b.duration>900)throw Error('This file runs past the 15-minute song limit. Move the playhead earlier or use a shorter file.');const channels=await phraseResample(toChannels(b),b.sampleRate,W().rate);const next=C.clone(W());C.addTake(next,{trackId,start,end:start+channels[0].length/next.rate,channels,name:file.name,choose:true});C.validate(next);backup();S.song=next;changed('Vocal imported onto '+T().name+' at '+clock(start)+'. Other tracks are unchanged.');fit();}
 catch(e){message('Vocal not imported: '+e.message,true);}finally{UI.busy=false;S.songWorking=false;render();}}
async function save(){if(busy())return;stopPlay();UI.busy=true;render();message('Preparing a project with all tracks, takes and song sections…');try{const result=await saveProject();message(result.msg,!result.ok);try{await persistNow();}catch(e){}return result;}finally{UI.busy=false;render();}}
async function confirmReplace(title){const r=await dialog(title,'<p>Back up this song first if you want to keep it. Browser downloads must be checked in your Downloads folder.</p>',[['cancel','Keep this song'],['save','Back up first'],['ok','Continue without backup']]);if(r.action==='save'){const result=await save();if(!result?.ok)return false;const check=await dialog('Check your backup','<p>Make sure the project ZIP has finished downloading. The browser cannot confirm this for the app.</p>',[['cancel','Keep this song'],['ok','My backup is saved — continue']]);return check.action==='ok';}return r.action==='ok';}
async function openProject(){if(busy())return;stopPlay();if(hasWork()&&!await confirmReplace('Open a different song?'))return;$('fileProject').click();}
async function newSong(){if(busy())return;stopPlay();if(hasWork()&&!await confirmReplace('Start a new song?'))return;await clearSession(true);S.song=C.empty(S.rate||48000);UI.undo=[];UI.redo=[];UI.section=null;fit();render();persist();message('New song ready. Add backing music or record without it.');}
function hasWork(){const w=S.song;return !!(w&&(Object.keys(w.sources).length||w.sections.length||w.tracks.length>1))||!!S.main||!!S.beat;}
async function exportAudio(){if(busy())return;window.SongPolish?.capture();const choices=[['cancel','Cancel'],['mix','Vocal mix WAV'],['full','Song with backing WAV'],['stems','Polished stems ZIP'],['dry','Dry stems ZIP']];if(W().previousMix)choices.push(['previous','Earlier combined POLISH WAV']);const r=await dialog('Export your song','<p><b>Vocal mix:</b> each vocal’s POLISH processing, with track level, pan, Mute, Solo and Master level.</p><p><b>Song with backing:</b> the same vocal mix plus your instrumental at its song playback level.</p><p><b>Polished stems:</b> separate vocals with their saved processing, aligned at 0:00, without track faders or pan. Includes muted tracks. Dry stems contain your chosen recordings before POLISH.</p><p>Unpolished tracks and tracks set to Use dry vocal stay dry. A changed recording must be updated in POLISH before processed export. WAV files use 32-bit float audio. Back up project keeps all takes and editable settings.</p>',choices);if(!['mix','full','stems','dry','previous'].includes(r.action))return;
 stopPlay();try{const w=W(),end=C.duration(w),base=safeName(w.title);if(!C.selectedCount(w))throw Error('Choose at least one take before exporting.');let result;
 if(r.action==='previous'){result=await saveDownload(base+' - earlier combined polish.wav',wavFloat(w.previousMix.channels,w.previousMix.rate));}
 else if(['mix','full'].includes(r.action)){const solo=w.tracks.some(t=>t.solo);window.SongPolish?.assertExport(w.tracks.filter(t=>!t.mute&&(!solo||t.solo)));let ch=C.mix(w);
  if(r.action==='full'){if(!S.beat)throw Error('Load an instrumental first, or export the vocal mix.');const seconds=Math.max(end,S.beat.duration),n=Math.round(seconds*w.rate),out=[new Float32Array(n),new Float32Array(n)],beat=await phraseResample(toChannels(S.beat),S.beat.sampleRate,w.rate),gain=($('beatOn').checked?(S.beatLevel??.8):0)*Math.pow(10,w.masterDb/20);for(let c=0;c<2;c++){out[c].set(ch[c]);const d=beat[Math.min(c,beat.length-1)];for(let i=0;i<d.length;i++)out[c][i]+=d[i]*gain;}ch=out;}
  if(C.peak(ch)>1)throw Error('The mix peaks above 0 dBFS. Lower Master level before exporting.');result=await saveDownload(base+(r.action==='full'?' - song.wav':' - vocal mix.wav'),wavFloat(ch,w.rate));}
 else {const processed=r.action==='stems';if(processed)window.SongPolish?.assertExport(w.tracks);const files=w.tracks.map((t,i)=>({name:String(i+1).padStart(2,'0')+' - '+safeName(t.name)+'.wav',data:wavFloat(C.renderVoice(w,t,{end,processed}),w.rate)}));files.push({name:'STEMS-READ-ME.txt',data:new TextEncoder().encode('Playbook Vocal Studio 0.21.0\nAll stems start at song time 0:00 and share the same duration.\n'+(processed?'Saved per-track POLISH is included where enabled. Unpolished/bypassed tracks stay dry.':'Dry chosen vocals before POLISH.')+'\nNo track faders, pan, Mute, Solo or Master level.\nSample rate: '+w.rate+' Hz; 32-bit float WAV.\n'+w.tracks.map(t=>t.name+': '+(processed&&C.polishValid(w,t)&&!t.polish.bypass?'POLISH':'dry')).join('\n')+'\nSong sections:\n'+w.sections.map(s=>s.name+': '+s.start+'–'+s.end+' seconds').join('\n'))});result=await saveDownload(base+(processed?' - polished stems.zip':' - dry stems.zip'),zip(files));}
 message(result+'. Check your Downloads folder. Your song and all takes are still here.');}catch(e){message(e.message,true);}}
async function polish(id){return window.SongPolish?.open(typeof id==='string'?id:W().activeTrack);}

function renderTransport(){const c=UI.capture,locked=busy();if(!c){$('sgMeter').value=0;$('sgClip').textContent='';}$('sgRecord').textContent=c?'■ Stop & keep':UI.opening?'Cancel setup':'● Record';$('sgRecord').classList.toggle('recording',!!c);$('sgRecord').disabled=!c&&!UI.opening&&locked;$('sgPlay').textContent=UI.play?'❚❚ Pause':'▶ Play';$('sgPlay').disabled=locked;$('sgStop').disabled=!(c||UI.opening||UI.play);$('sgHome').disabled=locked;$('sgArmed').textContent=c&&current()<c.a?'Get ready · '+(c.a-current()).toFixed(1)+' s · '+T().name:'Recording track: '+(T()?.name||'Lead vocal');$('sgClock').textContent=clock(current());renderGrid();
 $('rcUndo').disabled=locked||!UI.undo.length;$('rcRedo').disabled=locked||!UI.redo.length;
}
function render(){if(!UI.shown){polishStatus();return;}if(UI.drag){draw();return;}const w=W(),t=T(),r=R(),lk=busy();
 if(document.activeElement!==$('songTitle'))$('songTitle').value=w.title;
 for(const [id,value] of [['sgLead',w.lead],['sgFade',w.fadeMs],['sgMaster',w.masterDb],['sgA',w.range?.[0]?.toFixed(3)||''],['sgB',w.range?.[1]?.toFixed(3)||'']])if(document.activeElement!==$(id)&&(!['sgA','sgB'].includes(id)||!['sgA','sgB'].includes(document.activeElement?.id)))$(id).value=value;
 for(const id of ['sgSave','sgOpen','sgExport','sgNew','sgAddSection','sgAddTrack','sgImport','sgClearRange','sgFit','sgZoomRange','sgZoomIn','sgZoomOut','sgLead','sgFade','sgMaster','sgLatency','sgCalibration','songTitle','sgA','sgB','sgCountIn','sgBpm','sgTimeSig','sgLoop','sgTempo'])$(id).disabled=lk;
 $('sgEditSection').disabled=lk||!UI.section;$('sgUseSection').disabled=lk||!UI.section;$('sgQuickFix').disabled=lk||!w.range;$('sgFix').disabled=lk||!w.range;$('sgHearRange').disabled=lk||!w.range;$('sgRemoveRange').disabled=lk||!r;$('sgRetry').disabled=lk||!r;$('sgRepeat').disabled=lk;$('sgPolish').disabled=lk||!t.regions.some(r=>r.selected);$('sgPolish').textContent='Polish '+t.name+' →';
 $('sgRangeHint').textContent=w.range?'Replace only '+clock(w.range[0])+'–'+clock(w.range[1])+' on '+t.name+'. Earlier audio stays until you Choose a complete attempt.':'Select a range to record only that spot. Other tracks and the rest of this vocal stay unchanged.';
 const key=JSON.stringify([w.tracks.map(t=>[C.polishValid(w,t),!!t.polish,t.polish?.bypass]),w.revision,w.activeTrack,w.selectedRegion,UI.section,lk,!!S.beat,S.beatName,$('beatOn').checked,Studio.state().removed]);
 if(key!==UI.renderKey){UI.renderKey=key;
  $('sgSections').innerHTML=w.sections.length?w.sections.map(s=>'<button data-section="'+s.id+'" aria-pressed="'+(UI.section===s.id)+'">'+esc(s.name)+'<small>'+clock(s.start)+'–'+clock(s.end)+'</small></button>').join(''):'<p class="sg-help">Add Intro, Verse, Chorus, Bridge or Outro whenever you are ready. You can record before adding sections.</p>';
  $('sgRegion').innerHTML='<option value="">Select a recording or phrase fix</option>'+t.regions.map(r=>'<option value="'+r.id+'">'+esc(r.name)+' · '+clock(r.start)+'–'+clock(r.end)+' · '+r.takes.length+' takes</option>').join('');$('sgRegion').value=w.selectedRegion||'';$('sgRegion').disabled=lk;
  $('sgTakesTitle').textContent=t.name+' — attempts';
  $('sgTakes').innerHTML=r?r.takes.map(a=>'<div class="sg-take '+(r.selected===a.id?'chosen':'')+'"><strong>'+esc(a.name)+(r.selected===a.id?' · Chosen':'')+'</strong><small>'+clock(w.sources[a.source].channels[0].length/w.rate)+(C.covers(w,a,r)?'':' · Incomplete')+'</small><div class="sg-row"><button data-listen="'+a.id+'"'+(lk?' disabled':'')+'>▶ Listen</button><button data-choose="'+a.id+'" aria-pressed="'+(r.selected===a.id)+'"'+(lk||!C.covers(w,a,r)?' disabled':'')+'>'+(r.selected===a.id?'✓ Chosen':'Choose')+'</button><button data-take-menu="'+a.id+'" aria-label="Edit or remove '+esc(a.name)+'"'+(lk?' disabled':'')+'>⋯</button></div></div>').join('')+((r.kind==='fix'||r.kind==='punch')?'<button data-original="1"'+(lk?' disabled':'')+'>Keep earlier audio</button>':''):'<p class="sg-help">Record here, or click a recording on the timeline to compare its attempts.</p>';
  const disabled=lk?' disabled':'';
  $('sgTimeline').innerHTML='<div class="sg-lane sg-ruler"><div class="sg-lane-head">SONG TIME</div><canvas class="sg-wave" data-wave="ruler" aria-label="Song time ruler"></canvas></div><div class="sg-lane"><div class="sg-lane-head"><strong>INSTRUMENTAL</strong><span class="sg-help">'+esc(S.beat?S.beatName:'Optional backing music')+'</span><div class="sg-row"><button class="sg-mini" id="sgLoadBeat"'+disabled+'>'+(S.beat?'Replace…':'Load backing')+'</button>'+(S.beat?'<button class="sg-mini" id="sgRemoveBeat"'+disabled+'>Remove</button>':Studio.state().removed?'<button class="sg-mini" id="sgUndoBeat"'+disabled+'>Undo remove</button>':'')+'</div><label><input id="sgBackingOn" type="checkbox" '+($('beatOn').checked?'checked':'')+disabled+'> Hear backing</label>'+(S.beat?'<label>Level <input id="sgBackingLevel" type="range" min="0" max="100" value="'+Math.round((S.beatLevel??.8)*100)+'"'+disabled+'></label>':'')+'</div><canvas class="sg-wave" data-wave="beat" tabindex="0" aria-label="Instrumental waveform. Click to move the playhead."></canvas></div>'+w.tracks.map(t=>'<div class="sg-lane '+(t.id===w.activeTrack?'active':'')+'"><div class="sg-lane-head"><div class="sg-row"><button class="sg-track-name" data-track="'+t.id+'" aria-pressed="'+(t.id===w.activeTrack)+'"'+disabled+'>'+esc(t.name)+(t.id===w.activeTrack?' ●':'')+'</button><button class="sg-mini" data-track-menu="'+t.id+'" aria-label="Settings for '+esc(t.name)+'"'+disabled+'>⋯</button></div><div class="sg-row"><button class="sg-mini" data-polish="'+t.id+'"'+(lk||!t.regions.some(r=>r.selected)?' disabled':'')+'>Polish</button><span class="sg-polish-state">'+(t.polish?.bypass?'Dry':C.polishValid(w,t)?'Polished':t.polish?'Update needed':'Not polished')+'</span></div><div class="sg-row"><button class="sg-mini" data-mute="'+t.id+'" aria-pressed="'+t.mute+'"'+disabled+'>Mute</button><button class="sg-mini" data-solo="'+t.id+'" aria-pressed="'+t.solo+'"'+disabled+'>Solo</button></div><label>Level <input data-level="'+t.id+'" type="range" min="-36" max="12" step="1" value="'+t.gainDb+'" aria-label="'+esc(t.name)+' volume in dB"'+disabled+'><span>'+Math.round(t.gainDb)+' dB</span></label><label>Pan <input data-pan="'+t.id+'" type="range" min="-1" max="1" step="0.1" value="'+t.pan+'" aria-label="'+esc(t.name)+' left right position"'+disabled+'><span>'+(t.pan===0?'Centre':Math.round(Math.abs(t.pan)*100)+(t.pan<0?'L':'R'))+'</span></label></div><canvas class="sg-wave" data-wave="'+t.id+'" tabindex="0" aria-label="'+esc(t.name)+' waveform. Drag to select a phrase. Use the Start and End fields for keyboard selection."></canvas></div>').join('');
  $('sgLoadBeat').onclick=()=>{if(!busy()){stopPlay();$('fileBeat').click();}};if($('sgRemoveBeat'))$('sgRemoveBeat').onclick=async()=>{stopPlay();await Studio.removeBacking();UI.renderKey='';render();message('Backing removed. Your vocals stay in place. Undo remove brings it back.');};if($('sgUndoBeat'))$('sgUndoBeat').onclick=()=>{Studio.undoRemoveBacking();UI.renderKey='';render();message('Backing restored.');};$('sgBackingOn').onchange=e=>{if(busy())return;PVSRec.setRecordBacking(e.target.checked);syncLiveMix();UI.renderKey='';render();};if($('sgBackingLevel'))$('sgBackingLevel').oninput=e=>{$('beatLevel').value=e.target.value;$('beatLevel').dispatchEvent(new Event('input'));syncLiveMix();};
 }
 const u=C.usage(w);$('sgCapacity').textContent=w.tracks.length+' / 8 tracks · '+u.takes+' / 128 takes · '+(u.bytes/1048576).toFixed(1)+' / 128 MB of vocal sources. Undo keeps earlier audio in memory until you close this session.';
 renderTransport();draw();polishStatus();}

// Timeline waveforms are sampled from immutable source arrays. Rendering the
// full audio comp on each animation frame would be expensive on a phone.
function draw(){if(!UI.shown)return;const w=W(),at=current(),ratio=Math.min(2,devicePixelRatio||1);
 for(const canvas of $('sgTimeline').querySelectorAll('canvas')){const box=canvas.getBoundingClientRect(),width=box.width,height=box.height;if(!width||!height)continue;if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}const g=canvas.getContext('2d');g.setTransform(ratio,0,0,ratio,0,0);g.clearRect(0,0,width,height);const X=s=>(s-UI.start)/UI.span*width,kind=canvas.dataset.wave;
  g.font='11px system-ui';
  // 0.21.0: bar/beat grid (bar 1 = 0:00). Beat lines only when there is room.
  {const mt=prefs().meter,pxBeat=beatLen()/UI.span*width,barEvery=[1,2,4,8,16,32,64].find(n=>n*mt*pxBeat>=30)||128;for(const b of C.beatsIn(UI.start,UI.start+UI.span+.001,bpm(),mt)){const x=X(b.t),bar=Math.floor(b.k/mt);if(b.accent&&bar%barEvery===0){g.strokeStyle=kind==='ruler'?'#4b6378':'#2c4154';g.beginPath();g.moveTo(x,0);g.lineTo(x,height);g.stroke();if(kind==='ruler'){g.fillStyle='#e2ecf3';g.fillText(String(bar+1),x+3,12);}}else if(pxBeat>=7&&kind!=='ruler'){g.strokeStyle='#1c2a37';g.beginPath();g.moveTo(x,0);g.lineTo(x,height);g.stroke();}else if(pxBeat>=7){g.strokeStyle='#36495a';g.beginPath();g.moveTo(x,height-7);g.lineTo(x,height);g.stroke();}}}
  if(kind==='ruler'){const step=[.05,.1,.25,.5,1,2,5,10,15,30,60,120,300,600].find(s=>s>=UI.span*65/width)||900;g.font='10px system-ui';g.fillStyle='#8193a3';for(let s=Math.ceil(UI.start/step)*step;s<=UI.start+UI.span;s+=step)g.fillText(clock(s),X(s)+3,27);g.font='11px system-ui';}
  const wave=(ch,rate,origin,a,b,color)=>{const lo=Math.max(0,Math.floor(X(a))),hi=Math.min(width,Math.ceil(X(b)));g.fillStyle=color;for(let x=lo;x<hi;x++){const ta=UI.start+x/width*UI.span-origin,tb=UI.start+(x+1)/width*UI.span-origin,from=Math.max(0,Math.floor(ta*rate)),to=Math.min(ch.length,Math.ceil(tb*rate));let peak=0;for(let j=from;j<to;j+=Math.max(1,Math.floor((to-from)/16)))peak=Math.max(peak,Math.abs(ch[j]));const h=Math.min(height*.35,peak*height*.4);if(h)g.fillRect(x,height/2-h,1,Math.max(1,h*2));}};
  if(kind==='beat'&&S.beat)wave(S.beat.getChannelData(0),S.beat.sampleRate,0,0,S.beat.duration,'#7099ad');
  const t=C.track(w,kind);if(t){const rows=[];for(const r of t.regions){if(r.end<UI.start||r.start>UI.start+UI.span)continue;const x=X(r.start),rw=X(r.end)-x;g.fillStyle=!r.selected?'#28473744':(r.kind==='fix'||r.kind==='punch')?'#284737':'#20374d';g.fillRect(Math.max(0,x),8,Math.min(width,x+rw)-Math.max(0,x),height-16);g.strokeStyle=r.id===w.selectedRegion?'#f5c875':r.selected?'#8aebba':'#698197';g.strokeRect(x,8,rw,height-16);const a=r.takes.find(a=>a.id===r.selected);if(a){const s=w.sources[a.source];wave(s.channels[0],s.rate,C.origin(a),r.start,r.end,t.mute?'#627383':'#8acceb');}const text=(r.kind==='fix'?'Fix · ':r.kind==='punch'?'Punch · ':'')+(a?.name||'Choose an attempt'),lx=Math.max(3,x+5),tw=g.measureText(text).width+8;let row=rows.findIndex(e=>e<=lx);if(row<0){row=rows.length;rows.push(0);}rows[row]=lx+tw;const ly=23+row*17;if(ly<height-8){g.fillStyle='#0d1620d9';g.fillRect(lx-3,ly-12,tw,16);g.fillStyle='#e8f1f7';g.fillText(text,lx,ly);}}}
  for(const s of w.sections){if(s.start>=UI.start&&s.start<=UI.start+UI.span){g.strokeStyle='#9b82bb';g.setLineDash([3,5]);g.beginPath();g.moveTo(X(s.start),0);g.lineTo(X(s.start),height);g.stroke();g.setLineDash([]);}}
  if(w.range&&t?.id===w.activeTrack){g.fillStyle='#c7a35338';g.fillRect(X(w.range[0]),0,X(w.range[1])-X(w.range[0]),height);g.strokeStyle='#f5c875';g.strokeRect(X(w.range[0]),1,X(w.range[1])-X(w.range[0]),height-2);}
  if(at>=UI.start&&at<=UI.start+UI.span){g.fillStyle=UI.capture?'#ff7e93':'#ffffff';g.fillRect(X(at),0,2,height);}
 }
 const max=Math.max(C.duration(w),S.beat?.duration||0,w.cursor+1,UI.span);$('sgPan').value=String(UI.start/Math.max(.001,max-UI.span));$('sgView').textContent=clock(UI.start)+'–'+clock(UI.start+UI.span);
}

// All pointer actions have equivalent named buttons and numeric fields.
$('sgTimeline').addEventListener('pointerdown',e=>{const c=e.target.closest('canvas');if(!c||busy())return;e.preventDefault();stopPlay();const box=c.getBoundingClientRect();let t=UI.start+(e.clientX-box.left)/box.width*UI.span;if(prefs().snap)t=C.snapTime(t,bpm());UI.drag={canvas:c,x:e.clientX,t:C.clamp(t,0,900),view:UI.start,width:box.width,kind:c.dataset.wave,moved:false};c.setPointerCapture(e.pointerId);});
$('sgTimeline').addEventListener('pointermove',e=>{const d=UI.drag;if(!d)return;const dx=e.clientX-d.x;d.moved ||= Math.abs(dx)>5;if($('sgHand').checked){setView(d.view-dx/d.width*UI.span,UI.span);return;}if(!C.track(W(),d.kind))return;W().activeTrack=d.kind;let b=C.clamp(d.t+dx/d.width*UI.span,0,900);if(prefs().snap)b=C.snapTime(b,bpm());if(Math.abs(b-d.t)>=.04){W().range=[Math.min(b,d.t),Math.max(b,d.t)];W().selectedRegion=null;draw();}});
function endDrag(){const d=UI.drag;if(!d)return;UI.drag=null;if(!d.moved){W().cursor=d.t;const t=C.track(W(),d.kind);if(t){W().activeTrack=t.id;const r=[...t.regions].reverse().find(r=>d.t>=r.start&&d.t<r.end);W().selectedRegion=r?.id||null;}W().range=null;}else if(W().range){W().cursor=W().range[0];W().selectedRegion=C.findRange(T(),...W().range)?.id||null;}UI.renderKey='';render();persist();}
$('sgTimeline').addEventListener('pointerup',endDrag);$('sgTimeline').addEventListener('pointercancel',endDrag);
$('sgTimeline').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||busy())return;if(b.dataset.polish)polish(b.dataset.polish);if(b.dataset.track)focusTrack(b.dataset.track);if(b.dataset.trackMenu)trackMenu(b.dataset.trackMenu);for(const k of ['mute','solo'])if(b.dataset[k])edit(w=>{const t=C.track(w,b.dataset[k]);t[k]=!t[k];},k==='mute'?'Track mute updated.':'Solo updated. Solo affects vocal tracks; backing remains controlled separately.',true);});
$('sgTimeline').addEventListener('change',e=>{for(const [key,field] of [['level','gainDb'],['pan','pan']])if(e.target.dataset[key]){const id=e.target.dataset[key],v=+e.target.value;edit(w=>C.track(w,id)[field]=v,'Track '+(field==='pan'?'position':'level')+' updated.',true);}});
$('sgSections').onclick=e=>{const b=e.target.closest('[data-section]');if(!b||busy())return;stopPlay();const s=W().sections.find(s=>s.id===b.dataset.section);UI.section=s.id;W().cursor=s.start;W().range=null;setView(s.start,Math.max(8,s.end-s.start+1));render();persist();};
$('sgRegion').onchange=()=>{if(busy())return;stopPlay();W().selectedRegion=$('sgRegion').value||null;const r=R();if(r){W().range=[r.start,r.end];W().cursor=r.start;}render();};
$('sgTakes').onclick=async e=>{const b=e.target.closest('button'),r=R();if(!b||!r||busy())return;if(b.dataset.listen){try{await audition(r.id,b.dataset.listen);}catch(e){message(e.message,true);}return;}
 if(b.dataset.choose)edit(w=>C.choose(w,r,b.dataset.choose),'Take chosen. The rest of this track and every other track stay unchanged.');
 if(b.dataset.original)edit(w=>C.choose(w,r,null),'Earlier audio restored for this phrase. All attempts are still here.');
 if(b.dataset.takeMenu){const a=r.takes.find(a=>a.id===b.dataset.takeMenu),d=await dialog('Take settings','<label>Name <input name="name" value="'+esc(a.name)+'" maxlength="100"></label><label>Timing (milliseconds) <input name="offset" type="number" min="-500" max="500" step="1" value="'+a.offsetMs+'"></label><p>Negative moves the take earlier. A shifted take must still cover the selected range before it can be chosen.</p>',[['cancel','Cancel'],['remove','Remove attempt…'],['ok','Save']]);
  if(d.action==='ok')edit(w=>{a.name=C.label(d.values.name,'Take');a.offsetMs=+d.values.offset;if(r.selected===a.id&&!C.covers(w,a,r))r.selected=null;},'Take updated. Listen to check the timing.');
  if(d.action==='remove'){const q=await dialog('Remove '+a.name+'?','<p>The source remains available through Undo during this session. Back up first if you want to keep every attempt permanently.</p>',[['cancel','Keep attempt'],['ok','Remove attempt']]);if(q.action==='ok')edit(w=>{r.takes=r.takes.filter(x=>x.id!==a.id);if(r.selected===a.id)r.selected=null;},'Attempt removed. Undo restores it.');}
 }
};
$('sgQuickFix').onclick=()=>$('sgFix').click();$('sgRemoveRange').onclick=async()=>{const r=R();if(!r||busy())return;const d=await dialog('Remove this recording range?', '<p>This removes its '+r.takes.length+' attempts from this track. Audio underneath becomes audible again. Other tracks are unchanged. Undo restores the range during this session.</p>',[['cancel','Keep range'],['ok','Remove range']]);if(d.action==='ok')edit(w=>{T().regions=T().regions.filter(x=>x.id!==r.id);w.selectedRegion=null;w.range=null;},'Recording range removed. Undo restores it.');};$('sgRecord').onclick=()=>record();$('sgFix').onclick=()=>{UI.repeat=$('sgRepeat').checked;record(true,UI.repeat);};$('sgStop').onclick=()=>stopAll();$('sgPlay').onclick=togglePlay;$('sgHome').onclick=()=>{stopPlay(false);W().cursor=0;draw();renderTransport();};
$('sgRetry').onclick=()=>{const r=R();if(r&&!busy()){setRange(r.start,r.end);UI.repeat=$('sgRepeat').checked;record(true,UI.repeat);}};
$('sgHearRange').onclick=()=>{if(W().range)play(Math.max(0,W().range[0]-W().lead),{end:Math.min(900,W().range[1]+.7)}).catch(e=>message(e.message,true));};
$('sgAddTrack').onclick=addTrack;$('sgAddSection').onclick=()=>sectionForm();$('sgEditSection').onclick=()=>sectionForm(W().sections.find(s=>s.id===UI.section));
$('sgUseSection').onclick=()=>{const s=W().sections.find(s=>s.id===UI.section);if(s)setRange(s.start,s.end);};$('sgClearRange').onclick=()=>{if(!busy()){W().range=null;render();}};
for(const id of ['sgA','sgB'])$(id).onchange=()=>{if($('sgA').value!==''&&$('sgB').value!=='')setRange(+$('sgA').value,+$('sgB').value);};
$('sgZoomIn').onclick=()=>setView(UI.start+UI.span*.25,UI.span/2);$('sgZoomOut').onclick=()=>setView(UI.start-UI.span/2,UI.span*2);$('sgFit').onclick=fit;$('sgZoomRange').onclick=()=>{if(W().range)setView(Math.max(0,W().range[0]-.25),W().range[1]-W().range[0]+.5);else message('Select a phrase first.');};$('sgPan').oninput=()=>{const end=Math.max(C.duration(W()),S.beat?.duration||0,W().cursor+1,UI.span);setView((end-UI.span)*+$('sgPan').value,UI.span);};
$('songTitle').onchange=()=>edit(w=>w.title=C.label($('songTitle').value,'My song'),'Song renamed.');
for(const [id,key] of [['sgLead','lead'],['sgFade','fadeMs'],['sgMaster','masterDb']])$(id).onchange=()=>edit(w=>w[key]=+$(id).value,'Setting saved.',key==='masterDb');
$('sgMicGain').oninput=()=>{UI.micGainDb=C.clamp(+$('sgMicGain').value||0,-24,18);if(UI.capture)UI.capture.gain.gain.setTargetAtTime(Math.pow(10,UI.micGainDb/20),audioCtx().currentTime,.02);};
$('sgLatency').value=Math.round((typeof pvsLatency==='function'?pvsLatency():0)*1000);$('sgLatency').onchange=()=>PVSRec.latStore(C.clamp(+$('sgLatency').value||0,0,800),'manual','Song studio');$('sgCalibration').onclick=()=>PVSRec.calOpen();
$('sgSave').onclick=save;$('sgOpen').onclick=openProject;$('sgNew').onclick=newSong;$('sgExport').onclick=exportAudio;$('sgPolish').onclick=polish;$('sgImport').onclick=()=>{if(!busy())$('sgImportFile').click();};$('sgImportFile').onchange=e=>{const f=e.target.files[0];e.target.value='';importAudio(f);};
$('projBtn').onclick=openProject;
const oldUndo=$('rcUndo').onclick,oldRedo=$('rcRedo').onclick,oldExport=$('rcExport').onclick;
$('rcUndo').onclick=()=>UI.shown?history(-1):oldUndo?.();$('rcRedo').onclick=()=>UI.shown?history(1):oldRedo?.();$('rcExport').onclick=()=>UI.shown?exportAudio():oldExport?.();

// 0.21.0 recording helpers: click, count-in, HEAR ME, loop, snap, tempo grid.
function setPref(key,value,text){W()[key]=value;C.validate(W());persist();UI.renderKey='';syncLiveMix();render();if(text)message(text);}
function toggleClick(){setPref('click',!prefs().click,prefs().click?'Click off.':'Click on: '+bpm()+' BPM, '+prefs().meter+'/4. Only you hear it; it is never recorded.');}
function toggleLoop(){if(busy())return;setPref('loopRec',!prefs().loopRec,prefs().loopRec?'Loop recording off. Fix records the selection once.':'Loop recording on: Fix records the selection again and again without gaps. Each pass becomes an attempt. Press Stop when you are done.');}
async function toggleMonitor(){if(!UI.monitor&&!UI.monitorOk){const d=await dialog('HEAR ME — use headphones','<p>HEAR ME plays your microphone back to you while you record, mixed with the song.</p><p><b>Use headphones.</b> Through speakers the microphone picks the sound up again and you will hear feedback. What you hear is never written into the take or onto other tracks.</p>',[['cancel','Cancel'],['ok','I am using headphones']]);if(d.action!=='ok')return;UI.monitorOk=true;}
 UI.monitor=!UI.monitor;const c=UI.capture;if(c?.mon)c.mon.gain.setTargetAtTime(UI.monitor?UI.monitorVol:0,c.ctx.currentTime,.01);renderTransport();message(UI.monitor?'HEAR ME on: you hear your microphone while recording (headphones only).':'HEAR ME off.');}
async function stopAll(){if(UI.capture?.punch){await stopRecording();stopPlay();render();return;}if(UI.capture||UI.opening)return stopRecording();stopPlay();render();}
function renderGrid(){const t=current(),pr=prefs(),c=UI.capture;$('sgBarBeat').textContent=c&&t<c.a&&pr.countIn?'count-in':(t<0?'–':(({bar,beat})=>bar+' | '+beat)(C.barBeat(t,bpm(),pr.meter)));$('sgTempo').textContent=bpm()+' BPM · '+pr.meter+'/4';
 $('sgClick').setAttribute('aria-pressed',pr.click);$('sgMonitor').setAttribute('aria-pressed',UI.monitor);$('sgLoop').setAttribute('aria-pressed',pr.loopRec);$('sgLoop').textContent='⟲ Loop: '+(pr.loopRec?'On':'Off');
 for(const [id,v] of [['sgCountIn',pr.countIn],['sgTimeSig',pr.meter],['sgBpm',bpm()],['sgClickVol',Math.round(pr.clickVol*100)],['sgMonitorVol',Math.round(UI.monitorVol*100)]])if(document.activeElement!==$(id))$(id).value=String(v);$('sgSnap').checked=pr.snap;}
$('sgClick').onclick=toggleClick;$('sgLoop').onclick=toggleLoop;$('sgMonitor').onclick=toggleMonitor;
$('sgCountIn').onchange=()=>setPref('countIn',+$('sgCountIn').value,+$('sgCountIn').value?'Count-in: '+$('sgCountIn').value+' bar'+(+$('sgCountIn').value>1?'s':'')+' of click before each recording. It replaces the lead-in.':'Count-in off. The lead-in in seconds is used.');
$('sgTimeSig').onchange=()=>setPref('meter',+$('sgTimeSig').value,'Time signature '+$('sgTimeSig').value+'/4.');
$('sgSnap').onchange=()=>setPref('snap',$('sgSnap').checked,$('sgSnap').checked?'Selections snap to the nearest beat.':'Snap off.');
$('sgClickVol').oninput=()=>{W().clickVol=C.clamp(+$('sgClickVol').value/100,0,1);syncLiveMix();persist();};
$('sgMonitorVol').oninput=()=>{UI.monitorVol=C.clamp(+$('sgMonitorVol').value/100,0,1);localStorage.setItem('pvs.monitorVol',UI.monitorVol);const c=UI.capture;if(c?.mon&&UI.monitor)c.mon.gain.setTargetAtTime(UI.monitorVol,c.ctx.currentTime,.02);};
$('sgBpm').onchange=()=>{const v=C.clamp(Math.round(+$('sgBpm').value||75),50,200);$('bpm').value=v;$('bpm').dispatchEvent(new Event('change'));persist();UI.renderKey='';render();message('Tempo '+v+' BPM. The grid and click follow it.');};
$('sgTempo').onclick=()=>{const d=host.querySelector('.sg-settings');d.open=true;$('sgBpm').focus();};
function polishStatus(){polishNotice.hidden=true;window.SongPolish?.render();}
function show(s){if(window.SongPolish&&!SongPolish.beforeShow(s))return false;if(UI.capture||UI.opening){message('Stop recording before changing screens.',true);return false;}stopPlay();UI.shown=s==='rc';host.hidden=!UI.shown;document.body.classList.add('song-studio');$('rcView').hidden=true;if(UI.shown){$('rcExport').textContent='Export audio';render();}polishStatus();return true;}
function reset(){if(S.songApplying)return;window.SongPolish?.detach();S.song=null;UI.undo=[];UI.redo=[];UI.section=null;UI.renderKey='';}
function restoreSong(last){if(S.songApplying)return;if(last.song){C.validate(last.song);S.song=C.clone(last.song);}else if(last.phrases?.phrases.length||last.phrases?.base||last.pcm?.length){S.song=C.migrate(last.phrases,last.pcm,last.rate,last.name);if(last.pcm?.length&&(!last.phrases?.phrases.length||last.phrases?.appliedSig===phraseCompSig(last.phrases)))S.song.appliedSig=C.signature(S.song);S.phrases=null;message('Earlier project opened as a Lead vocal track. Every attempt is preserved. Song section labels are separate from recordings.');}else S.song=C.empty(last.rate||S.rate||48000);UI.undo=[];UI.redo=[];UI.section=null;UI.renderKey='';if(!UI.journalChecked){UI.journalChecked=true;if(applyJournal())message('Your last changes from before the page closed are restored.');}window.SongPolish?.restored(last);fit();render();}
async function pack(root,files){const w=S.song;if(!w)return;C.validate(w);window.SongPolish?.capture();const meta=C.clone(w);meta.sources={};for(const [id,s] of Object.entries(w.sources)){const file='pbv-song-'+id+'.wav';files.push({name:file,data:wavFloat(s.channels,s.rate)});meta.sources[id]={file,rate:s.rate,frames:s.channels[0].length,channels:s.channels.length};}if(window.SongPolish)await SongPolish.pack(meta,files);root.songStudio=meta;root.songStudioVersion=2;root.requiresSongStudio='0.20.0';root.songStudioAppliedSig=w.appliedSig;}
async function unpack(root,files){if(!root.songStudio)return null;if(![1,2].includes(root.songStudioVersion)||root.songStudio.v!==1)throw Error('This song needs a newer Song Studio version.');const w=structuredClone(root.songStudio);let bytes=0;const entries=Object.entries(w.sources||{});if(entries.length>C.LIMITS.takes+8)throw Error('Too many vocal sources.');for(const [id,s] of entries){const file=files.get(baseName(s.file).toLowerCase());if(!file)throw Error('Missing vocal source: '+s.file);bytes+=file.data.length;if(bytes>C.LIMITS.bytes+1024*1024)throw Error('The project exceeds the vocal source limit.');const decoded=await decodeBytes(file.data,s.file);C.checkAudio(decoded.channels,decoded.rate);if(decoded.rate!==w.rate)throw Error('The saved source sample rate does not match the song.');w.sources[id]={rate:decoded.rate,channels:decoded.channels};}if(window.SongPolish)await SongPolish.unpack(w,files);C.validate(w);return w;}
function needsApply(){return window.SongPolish?SongPolish.needsApply():false;}
window.SongStudio={dialog,edit,notify:message,show,reset,restore:restoreSong,pack,unpack,needsApply,hasWork,record,stopRecording,play,stopPlay,importAudio,save,exportAudio,polish,render,setRange,history,selectTrack:focusTrack,fit,debug:()=>({clicks:UI.lastClicks.slice(),capture:UI.lastCapture,loop:UI.lastLoop,monitor:UI.monitor,monitorGain:UI.capture?.mon?.gain.value??null,punch:!!UI.capture?.punch}),state:()=>({recording:!!UI.capture,opening:UI.opening,playing:!!UI.play,busy:UI.busy,start:UI.start,span:UI.span,position:current(),activeTrack:W().activeTrack}),locked:()=>!!(UI.capture||UI.opening||UI.busy),snapshot:()=>S.song?C.clone(S.song):null};
// Capture before the legacy hotkeys. Their listeners also explicitly skip this screen.
document.addEventListener('keydown',e=>{if(!UI.shown||modal.open||document.querySelector('.stmodal:not([hidden]),.modal:not([hidden]),#pvsChoice:not([hidden])'))return;const typing=e.target.isContentEditable||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName);if(typing)return;const k=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&['s','z','y'].includes(k)){e.preventDefault();e.stopImmediatePropagation();if(k==='s')save();else history(k==='y'||e.shiftKey?1:-1);return;}if(e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(k==='r'||k===' '||k==='home'||k==='c'||k==='l'||k==='escape'){if(k==='escape'&&!UI.capture&&!UI.opening&&!UI.play)return;e.preventDefault();e.stopImmediatePropagation();if(k==='r')record();else if(k===' '){UI.capture||UI.opening?stopAll():togglePlay();}else if(k==='c')toggleClick();else if(k==='l')toggleLoop();else if(k==='escape'){if(UI.capture)stopRecording('',{cancel:true});else if(UI.opening)stopRecording();else{stopPlay();render();}}else $('sgHome').click();}},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(UI.capture||UI.opening))stopRecording('Recording stopped because the app went into the background.');});
window.addEventListener('pagehide',()=>{if(UI.capture)stopRecording('Page closing.');writeJournal();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)writeJournal();});
// 0.21.0: the full autosave (all audio) is an IndexedDB write that a closing page can
// abort. The song's arrangement (choices, mutes, levels, sections, settings) is also
// written synchronously to a small journal on pagehide; the next start applies it on
// top of the autosave when every audio source it names is present, then deletes it.
function writeJournal(){try{const w=S.song;if(!w||S.isSample)return;const meta={...C.clone(w),sources:Object.keys(w.sources),tracks:w.tracks.map(t=>({...t,polish:undefined,regions:t.regions.map(r=>({...r,takes:r.takes.map(a=>({...a}))}))}))};localStorage.setItem('pvs.songJournal',JSON.stringify({v:1,at:Date.now(),meta}));}catch(e){}}
function applyJournal(){let j;try{j=JSON.parse(localStorage.getItem('pvs.songJournal')||'null');}catch(e){}localStorage.removeItem('pvs.songJournal');const w=S.song;if(!j||j.v!==1||!w||Date.now()-j.at>7*864e5)return false;const m=j.meta;if(!Array.isArray(m.sources)||!m.sources.every(k=>Object.hasOwn(w.sources,k)))return false;
 try{const next={...m,sources:Object.fromEntries(m.sources.map(k=>[k,w.sources[k]])),tracks:m.tracks.map(t=>{const old=w.tracks.find(x=>x.id===t.id);const n={...t};if(old?.polish)n.polish=old.polish;else delete n.polish;return n;})};C.validate(next);if(JSON.stringify(C.clone({...next,sources:{}}).tracks)===JSON.stringify(C.clone({...w,sources:{}}).tracks)&&next.revision===w.revision)return false;S.song=next;persist();return true;}catch(e){return false;}}
window.addEventListener('beforeunload',e=>{if(UI.capture||UI.opening){e.preventDefault();e.returnValue='';}});
window.addEventListener('resize',()=>{draw();});
let tickAt=0,lastBeat=null;function frame(now){if(UI.shown){if(UI.play||UI.capture){$('sgClock').textContent=clock(current());renderGrid();const c=UI.capture;if(c?.loop&&!c.stopping){const r=c.regionId&&C.track(W(),c.trackId)?.regions.find(r=>r.id===c.regionId),done=Math.floor(c.frames/(c.loop.len*c.rate));if((r?.takes.length||0)+done>=32)stopRecording('Reached 32 attempts for this range.');}$('sgMeter').value=c?.peak||0;$('sgClip').textContent=c?.clipped?'CLIP':'';if(current()>UI.start+UI.span-.2)setView(Math.max(0,current()-UI.span*.2),UI.span);draw();if(c&&c.ctx.state!=='running'&&!c.stopping)stopRecording('Audio was interrupted.');}
 if(now-tickAt>400){tickAt=now;const beatKey=S.beatName+':'+!!S.beat+':'+$('beatOn').checked;if(lastBeat!==beatKey){lastBeat=beatKey;UI.renderKey='';}render();$('rcSaved').textContent=$('dawSaved').textContent;$('rcSaved').title=$('dawSaved').title;$('sgSaveState').textContent=$('phraseSaveStatus').textContent||'Autosave is local to this browser. Keep project backups.';}}
 requestAnimationFrame(frame);}
$('rcExport').textContent='Export audio';$('rcStep1').innerHTML='<b>1</b> SONG &amp; VOCALS';$('rcSong').textContent='Song sections · lead · harmonies';
document.body.classList.add('song-studio');$('rcView').hidden=true;if(S.song)restoreSong({song:S.song});else if(S.phrases?.phrases.length||S.main)restoreSong({phrases:S.phrases,pcm:S.audio[0]||S.audio[5],rate:S.rate,name:S.name});else W();render();requestAnimationFrame(frame);
})();
