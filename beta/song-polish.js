/* Per-vocal bridge to the existing POLISH worker. The engine edits one lane at
 * a time; each lane owns an immutable session and its rendered PCM. Track faders
 * and pan are applied AFTER processing. No song workspace is nested in a session.
 */
(function(){
'use strict';
const C=SongCore,$=id=>document.getElementById(id),copy=x=>structuredClone(x);
const MAX_BYTES=C.ENGINE.bytes; // project-file sanity limit for ONE saved lane's POLISH audio
let lastRefusal=null,binding=null,switching=false,lastError='',allowStep=false;
const bar=document.createElement('div');bar.id='trackPolishBar';bar.hidden=true;
bar.innerHTML='<label>Polishing <select id="polishTrack" aria-label="Vocal track to polish"></select></label><button id="polishSong" title="Plays every lane with the backing and the song mixer">▶ Whole song</button><button id="polishExportSong" title="Every export: the song, the vocal mix, stems, or only this vocal">Export song</button><button id="polishReturn">← Song & vocals</button><button id="polishWave">Edit waveform ↓</button><button id="polishControls">Sound controls ↓</button><label><input type="checkbox" id="polishBypass"> Use dry vocal</label><span id="polishTrackStatus" role="status" aria-live="polite"></span><button id="polishReviewNotes" hidden></button><span id="polishReady" class="sg-ready" aria-live="polite"></span><span id="polishPreview" class="sg-preview-chip" aria-live="polite">Preview: this vocal</span><p><b>This vocal:</b> Clean, Tune, edits and effects change only this track; ▶ Play and Mix below play only this vocal with its fitted backing. <b>Whole song:</b> ▶ Whole song and Export song play or export all lanes with the song mixer.</p>';
$('rcSteps').append(bar);
function reviewNotes(){if(NoteTuner.enabled()){NoteTuner.review();return;}document.querySelector('[data-dock="notes"]').click();$('nextUnsure').click();$('dockNotes').scrollIntoView({block:'center'});$('nextUnsure').focus({preventScroll:true});}
$('polishReviewNotes').onclick=reviewNotes;
const W=()=>S.song,T=()=>binding&&W()?.tracks.find(t=>t.id===binding.id);
function snapshot(){
 if(!S.main||!S.st||!S.final?.length)return null;
 const g=S.guide||{};
 return {v:4,name:S.name,rate:S.rate,pcm:S.audio[5]||[S.main],takes:S.takeChannels.slice(1),P:{...S.st.params},notes:S.st.notes.map(a=>a.slice(0,13)),pitchReview:NoteTuner.enabled()?NoteTuner.pitchReview():FinishPolicy.pitchReview(S.st.notes),noteTuner:NoteTuner.state(),edits:copy(S.st.edits),match:S.match,chainEdited,mix:{...S.mix},exportMask:S.exportMask,
 guide:{...S.guidePrefs,locked:[...(g.locked||[])],dismissed:{...(g.dismissed||{})}}};
}
function bytes(p){if(!p)return 0;const buffers=new Set();for(const ch of [p.channels,p.session?.pcm,...(p.session?.takes||[])])if(Array.isArray(ch))for(const c of ch||[])buffers.add(c.buffer);return [...buffers].reduce((n,b)=>n+b.byteLength,0);}
// 0.25 (R1/R2/R6): THE only way a POLISH result becomes a lane's saved processing. Finite samples only,
// the processing input has exactly the channel count of the lane (or 1 when the singer chose mono), and the
// lane's small preferences are carried over unchanged. A rejected result leaves the last good one in place.
function acceptPolish(w,t,p){C.acceptPcm(p.channels,'The POLISH result for '+t.name);const pl=C.polishPlan(w,t),n=p.session?.pcm?.length;if(n!==pl.inputChannels)throw Error('POLISH input for '+t.name+' has '+n+' channel(s); this vocal has '+pl.inputChannels+'. Nothing was replaced.');t.polish={...p,...C.polishPrefs(t.polish)};w.polishTrack=t.id;return t.polish;}
function capture(){
 if(switching||S.songApplying||!binding||!T()||NoteTuner.locked()||NoteTuner.failed()||S.dirty)return false;
 const session=snapshot();if(!session)return false;
 // Never overwrite a history-restored lane with a different source's engine state.
 if(!bindingMatches(W(),T()))return false;
 const p={v:1,sourceSig:binding.sourceSig,rate:S.rate,session,channels:S.final};
 if(p.channels===T().polish?.channels&&p.session.pcm===T().polish?.session?.pcm&&JSON.stringify(p.session.P)===JSON.stringify(T().polish?.session?.P)&&JSON.stringify(p.session.edits)===JSON.stringify(T().polish?.session?.edits)&&JSON.stringify(p.session.notes)===JSON.stringify(T().polish?.session?.notes)&&JSON.stringify(p.session.pitchReview)===JSON.stringify(T().polish?.session?.pitchReview)&&JSON.stringify(p.session.noteTuner)===JSON.stringify(T().polish?.session?.noteTuner)){lastError='';return true;}
 try{acceptPolish(W(),T(),p);lastError='';return true;}
 catch(e){lastError=e.message;render();return false;}
}
const monoOf=C.monoMix;
function processingInput(w,t){const pcm=C.renderTrack(w,t,{end:C.trackEnd(t)});return C.polishPlan(w,t).mono?[monoOf(pcm)]:pcm;}
function bindingMatches(w,t){return !!(binding&&t&&binding.id===t.id&&binding.sourceSig===C.trackSignature(w,t)&&binding.inputChannels===C.polishPlan(w,t).inputChannels);}
function detach(){binding=null;lastError='';}
function needsApply(){return !!(W()&&C.selectedCount(W())&&!bindingMatches(W(),T()));}
function notify(text,error=false){SongStudio.notify(text,error);$('polishTrackStatus').textContent=text;if(error)setStatus(text,'warn');}
// 0.23: which stretches of a vocal really changed since it was polished (compares the saved signature rows).
function changedRanges(w,t,oldSig,oldPcm){
 // 0.24: compare the audio the vocal was polished from with the audio now chosen, sample by sample.
 if(!oldPcm?.length)return null;const n=C.renderTrack(w,t,{end:C.trackEnd(t)}),R=w.rate,out=[];if(n.length!==oldPcm.length)return null;
 const len=Math.max(n[0].length,oldPcm[0].length);let s=-1;
 for(let i=0;i<len;i++){let d=false;for(let c=0;c<n.length;c++){if((n[c][i]||0)!==(oldPcm[c][i]||0)){d=true;break;}}if(d&&s<0)s=i;else if(!d&&s>=0){if(out.length&&s/R-out[out.length-1][1]<.25)out[out.length-1][1]=i/R;else out.push([s/R,i/R]);s=-1;}}
 if(s>=0)out.push([s/R,len/R]);return out.map(([a,b])=>[Math.max(0,a-.05),b+.05]);}
function hits(ranges,a,b){return !ranges||ranges.some(([s,e])=>a<e&&b>s);}
function fmtRanges(r){return r?r.map(([a,b])=>a.toFixed(2)+'–'+b.toFixed(2)+' s').join(', '):'the whole vocal';}
function planKeep(w,t,old){const ranges=changedRanges(w,t,old.sourceSig,old.session?.pcm),s=old.session||{},e=s.edits||{},notes=(s.notes||[]).filter(a=>a[5]>.5);
 const part=(list,f)=>{const keep=[],drop=[];for(const x of list||[])(hits(ranges,...f(x))?drop:keep).push(x);return {keep,drop};};
 return {ranges,notes:part(notes,a=>[a[0],a[1]]),breaths:part(e.breaths,b=>[b[0],b[1]]),timing:part(e.timing,x=>[x[0],x[1]]),comp:(e.comp||[]).length,takes:(s.takes||[]).length};}
async function open(id=W()?.activeTrack){
 if(switching||SongStudio.locked()||sessionLocked())return false;
 const w=W(),t=w&&C.track(w,id);if(!t?.regions.some(r=>r.selected)){notify('Choose a take on this vocal track first.',true);return false;}
 // 0.25 (R1): the capacity check runs FIRST: nothing is captured, stopped, restored or processed before it.
 const t0=performance.now();let pl=C.polishPlan(w,t);
 if(!pl.ok&&pl.canMono&&!(binding?.id===id)){const a=await SongStudio.dialog('POLISH a mono version of '+t.name+'?','<p>'+pl.reason+'</p><p>You can choose to POLISH a <b>mono version</b> (left and right averaged). Your original stereo recordings are kept unchanged, and you can switch back in the track settings. Listen first: opposite-phase content can cancel in mono.</p>',[['cancel','Keep stereo (do not POLISH)'],['listen','▶ Listen to mono version'],['ok','Use mono for POLISH']]);
  if(a.action==='listen'){await SongStudio.auditionMono(t.id);return open(id);}
  if(a.action!=='ok'){notify(t.name+' was not processed. Its recordings and any saved POLISH are unchanged.');return false;}
  SongStudio.setTrackMono(t.id,true,t.name+': POLISH will use a mono version (your choice). The stereo original is kept.');pl=C.polishPlan(w,t);}
 if(!pl.ok){lastRefusal={id,ms:performance.now()-t0,reason:pl.reason};notify('Not opened: '+pl.reason+' The vocal you are editing is unchanged. Your recordings are kept.',true);return false;}
 SongStudio.stopPlay();endLoop();stopPlayback();capture();
 const sig=C.trackSignature(w,t),old=t.polish,valid=C.polishValid(w,t);
 if(bindingMatches(w,t)&&valid){setMode('final');allowStep=true;RC.go('polish');window.SongStudio?.syncKey?.();allowStep=false;render();return true;}
 let plan=null;const rebuildSaved=old?.recoveryMissing&&old.sourceSig===sig&&Array.isArray(old.session?.pcm)&&old.session.pcm.length===pl.inputChannels;const modeChange=old&&old.sourceSig===sig&&old.session?.pcm?.length!==pl.inputChannels&&!old.recoveryMissing;
 if(old&&!valid&&!modeChange&&!rebuildSaved){
  plan=planKeep(w,t,old);const c=(n,s)=>n+' '+s+(n===1?'':'s'),pl=plan;
  const answer=await SongStudio.dialog('Update POLISH for '+t.name+'?', (old.recoveryMissing?'<p>Some saved POLISH audio is missing. Rebuild this vocal from its original recordings. The edits listed below cannot be checked against the missing input.</p>':'<p>Your chosen recording changed in <b>'+fmtRanges(pl.ranges)+'</b>. This updates <b>only this vocal track</b>.</p>')+'<ul class="sg-gone"><li>Kept: cleaning, tuning settings and effects.</li><li>Kept (outside the change): '+c(pl.notes.keep.length,'note edit')+', '+c(pl.breaths.keep.length,'breath edit')+', '+c(pl.timing.keep.length,'timing edit')+'.</li><li>Reset (inside the change): '+c(pl.notes.drop.length,'note edit')+', '+c(pl.breaths.drop.length,'breath edit')+', '+c(pl.timing.drop.length,'timing edit')+'.</li>'+(pl.comp||pl.takes?'<li>Reset: POLISH alternate takes ('+c(pl.takes,'take')+').</li>':'')+'</ul>'+(old.session?.noteTuner?.mode==='note'?'<p>The new note editor will detect notes again for the changed recording. Back up first to keep an editable copy of your previous vocal and its note edits.</p>':'')+'<p>Back up first if you need the earlier edited version.</p>',[['cancel','Keep current version'],['ok','Update this vocal']]);
  if(answer.action!=='ok')return false;
 }
 const previous=binding?{...binding}:null,previousSession=snapshot();
 switching=true;S.songApplying=true;lastError='';render();notify('Opening '+t.name+' in POLISH…');
 try{
  if(valid||rebuildSaved){await restoreSession({...old.session,name:w.title+' — '+t.name});}
  else{
   let pcm=C.renderTrack(w,t,{end:C.trackEnd(t)});
   if(pl.mono)pcm=[monoOf(pcm)]; // explicit, user-chosen conversion (track setting); originals untouched
   if(modeChange){const takes=(old.session.takes||[]).map(ch=>pl.mono&&ch.length===2?[monoOf(ch)]:ch);await restoreSession({...old.session,name:w.title+' — '+t.name,rate:w.rate,pcm,takes});}
   else if(old){await restoreSession({...old.session,name:w.title+' — '+t.name,rate:w.rate,pcm,takes:[],notes:[],edits:{breaths:plan?plan.breaths.keep:[],timing:plan?plan.timing.keep:[],comp:[]},guide:{...old.session.guide,locked:[],dismissed:{}}});
   if(plan&&plan.notes.keep.length&&S.st?.notes){const keep=plan.notes.keep.map(a=>a.slice(0,13)),fresh=S.st.notes.map(a=>Array.from(a).slice(0,13)).filter(a=>!keep.some(k=>a[0]<k[1]&&a[1]>k[0])),merged=[...fresh,...keep].sort((a,b)=>a[0]-b[0]);try{const rr=await engine({type:'run',steps:[['notes',merged]],update:true});absorb(rr);}catch(e){notify('Your note edits outside the change could not be kept; notes were found again.',true);}}}
   else {S.guidePrefs={enabled:true,concern:0,goal:0,bpm:S.guidePrefs.bpm||75,sync:false};S.mix={fit:true,over:1,room:.5};chainEdited=false;S.match=true;await openVocal(pcm,w.rate,w.title+' — '+t.name,false,0);}
  }
  if(S.rate!==w.rate)throw Error('The processor changed the sample rate. This track has not replaced the song audio.');
  acceptPolish(w,t,{v:1,sourceSig:sig,rate:w.rate,session:snapshot(),channels:S.final});if(w.activeTrack!==id){w.activeTrack=id;w.selectedRegion=null;w.range=null;}binding={id,sourceSig:sig,inputChannels:pl.inputChannels};S.song=w;
  S.loadedNotice='POLISH: '+t.name+'. Changes are saved on this track and heard in your song.';
  setMode('final');allowStep=true;RC.go('polish');window.SongStudio?.syncKey?.();allowStep=false;
  notify(t.name+' is ready. Its processing is saved automatically.');return true;
 }catch(e){
  binding=null;S.song=w;
  if(previous&&previousSession){try{await restoreSession(previousSession);binding=previous;}catch(restoreError){lastError='Previous editor could not reopen: '+restoreError.message;}}
  notify('Could not open POLISH: '+e.message,true);return false;
 }finally{S.songApplying=false;switching=false;allowStep=false;if(binding?.id===id&&RC.step==='polish')window.SongStudio?.syncKey?.();persist();SongStudio.render();render();}
}
function beforeShow(screen){
 if(allowStep)return true;
 if(switching||sessionLocked()){notify('Wait for processing to finish before changing screens.',true);return false;}
 if(screen==='polish'&&(!binding||binding.id!==W()?.activeTrack||needsApply())){open(W()?.activeTrack);return false;}
 if(screen==='rc')capture();requestAnimationFrame(render);return true;
}
function restored(last){
 detach();const w=W();if(!w)return;
 const saved=w.tracks.find(t=>t.id===w.polishTrack);
 if(saved?.polish){if(saved.polish.session?.pcm?.length&&S.audio[5]?.length===saved.polish.session.pcm.length)binding={id:saved.id,sourceSig:saved.polish.sourceSig,inputChannels:saved.polish.session.pcm.length};}
 else if(S.main&&S.final?.length&&(!last.song||w.appliedSig)){
  const session=snapshot();if(!session)return;
  const p={v:1,rate:S.rate,sourceSig:'legacy',session,channels:S.final,bypass:false};
  if(w.tracks.filter(t=>t.regions.some(r=>r.selected)).length===1&&w.appliedSig===C.signature(w)){
   // Legacy POLISH was run on this same single vocal. Preserve all edits.
   const vocal=w.tracks.find(t=>t.regions.some(r=>r.selected));p.sourceSig=C.trackSignature(w,vocal);if(Number.isInteger(w.key)&&(session.P.key!==w.key||session.P.scale!==(w.scale??0))){p.ownKey=true;p.key=session.P.key;p.scale=session.P.scale;}try{acceptPolish(w,vocal,p);binding={id:w.polishTrack,sourceSig:p.sourceSig,inputChannels:session.pcm.length};}catch(e){if(!w.previousMix)w.previousMix=p;}
  }else if(!w.previousMix)w.previousMix=p;
 }
 render();
}
function render(){
 bar.hidden=RC.step!=='polish';if(bar.hidden)return;
 const w=W(),tracks=w?.tracks.filter(t=>t.regions.some(r=>r.selected))||[],selected=binding?.id||w?.activeTrack||'',items=tracks.map(t=>[t.id,t.name]);
 const key=JSON.stringify(items);if($('polishTrack').dataset.key!==key){$('polishTrack').dataset.key=key;$('polishTrack').replaceChildren(...items.map(([id,name])=>{const o=document.createElement('option');o.value=id;o.textContent=name;return o;}));}
 const count=(NoteTuner.enabled()?NoteTuner.notes():S.notes).filter(n=>n.review).length;$('polishReviewNotes').hidden=!count;$('polishReviewNotes').textContent=count+' uncertain note'+(count===1?'':'s')+' · Review';$('polishReviewNotes').disabled=switching||sessionLocked();
 $('polishTrack').value=selected;const locked=switching||sessionLocked();for(const id of ['polishTrack','polishSong','polishExportSong','polishReturn','polishBypass'])$(id).disabled=locked;
 $('polishBypass').checked=!!T()?.polish?.bypass;$('polishSong').textContent=SongStudio.state().playing?'■ Stop whole song':'▶ Whole song';if($('polishPreview'))$('polishPreview').textContent=SongStudio.state().playing?'Preview: whole song (all lanes)':'Preview: this vocal';
 const rd=C.readiness(w);$('polishReady').textContent='Whole song: '+rd.ready+' of '+rd.total+' vocals ready'+(rd.todo?' · '+rd.todo+' to polish':'')+(rd.blocked?' · '+rd.blocked+' cannot be processed as is':'');$('polishReady').title=rd.lanes.map(l=>l.name+': '+l.text).join('\n');
 $('polishTrackStatus').textContent=lastError||(switching?'Opening vocal…':needsApply()?'Recording or input mode changed — reopen this vocal to update POLISH.':T()?.polish?.bypass?'Dry vocal is used in the song. Your POLISH settings are kept.':T()?.polishMono?'POLISH uses a mono version of this stereo vocal (your choice in track settings). The stereo original is kept.':'This vocal’s processing is saved in your song.');
}
function assertExport(tracks){const bad=tracks.filter(t=>t.polish&&!t.polish.bypass&&t.polish.channels&&!C.pcmFinite(t.polish.channels));if(bad.length)throw Error('The processed audio of '+bad.map(t=>t.name).join(', ')+' is invalid. Open it in POLISH to process it again, or select Use dry vocal.');const stale=tracks.filter(t=>t.polish&&!t.polish.bypass&&!C.polishValid(W(),t));if(stale.length)throw Error('Update POLISH for '+stale.map(t=>t.name).join(', ')+' before exporting, or select Use dry vocal for that track.');const keyLag=tracks.filter(t=>C.polishValid(W(),t)&&C.keyStale(W(),t));if(keyLag.length)throw Error('The song key changed. Update POLISH for '+keyLag.map(t=>t.name).join(', ')+' (open it in POLISH; notes and effects are kept), or set that track to keep its own key.');if(lastError)throw Error(lastError);}
async function pack(meta,files){
 // 0.25 (UX 5): a MODERN backup does not store what it can rebuild exactly: a POLISH-valid lane's input is its
 // chosen render (proved by sourceSig) and a final whose two channels are identical is stored once. Compatibility
 // backups keep every file for older readers.
 const modern=!window.PVS_BACKUP?.compat,live=W();
 const packAudio=(ch,rate,file)=>{if(!ch?.length)return null;files.push({name:file,data:wavFloat(ch,rate)});return {file,rate,frames:ch[0].length,channels:ch.length};};
 // Modern backups store POLISH finals as 16-bit WAV (half the size) when they fit in [-1,1]; otherwise 32-bit float. Compatibility backups stay float.
 const pack16=(ch,rate,file)=>{if(!modern||ch.some(c=>{for(let i=0;i<c.length;i++)if(c[i]>1||c[i]<-1)return true;return false;}))return packAudio(ch,rate,file);files.push({name:file,data:wav16(ch,rate)});return {file,rate,frames:ch[0].length,channels:ch.length,bits:16};};
 const final=(ch,rate,file)=>!ch?.length?null:modern&&ch.length===2&&C.samePcm([ch[0]],[ch[1]])?{...pack16([ch[0]],rate,file),channels:2,stored:1}:pack16(ch,rate,file);
 const one=(p,id)=>{if(!p)return null;const t=live&&live.tracks.find(x=>x.id===id),derive=modern&&t&&t.polish===p&&C.polishValid(live,t)&&C.samePcm(p.session.pcm,processingInput(live,t));const session={...p.session,pcm:derive?{derived:'render',rate:p.rate,frames:p.session.pcm[0].length,channels:p.session.pcm.length}:packAudio(p.session.pcm,p.rate,'pbv-polish-'+id+'-input.wav'),takes:(p.session.takes||[]).map((ch,i)=>packAudio(ch,p.rate,'pbv-polish-'+id+'-take-'+i+'.wav'))};return {...p,session,channels:final(p.channels,p.rate,'pbv-polish-'+id+'-final.wav')};};
 for(const t of meta.tracks)t.polish=one(t.polish,t.id);if(meta.previousMix)meta.previousMix=one(meta.previousMix,'previous-mix');meta.polishVersion=1;
}
// Rebuild a derived POLISH input from the lane's own recordings; if it no longer proves equal, the lane is stale.
function derived(w,t,p,m){if(!t||m.rate!==w.rate)throw Error('Invalid derived POLISH input.');let pcm=C.renderTrack(w,t,{end:C.trackEnd(t)});if(t.polishMono&&pcm.length===2)pcm=[C.monoMix(pcm)];if(pcm.length!==m.channels||pcm[0].length!==m.frames||C.trackSignature(w,t)!==p.sourceSig)p.sourceSig='stale:'+p.sourceSig;return pcm;}
async function unpack(w,files){
 if(w.polishVersion!=null&&w.polishVersion!==1)throw Error('This project needs a newer per-track POLISH version.');
 let total=0;
 const audio=async a=>{if(a===null)return null;if(!a||typeof a.file!=='string')throw Error('Missing POLISH audio metadata.');if(a.stored===1&&a.channels===2){const d=await audio({...a,channels:1,stored:undefined});return [d[0],d[0]];}const f=files.get(baseName(a.file).toLowerCase());if(!f)throw Error('Missing POLISH audio: '+a.file);total+=f.data.length;if(total>MAX_BYTES+1048576)throw Error('Saved POLISH data of one vocal exceeds 256 MB.');const d=await decodeBytes(f.data,a.file);C.checkAudio(d.channels,d.rate);if(d.rate!==w.rate||d.channels[0].length!==a.frames||d.channels.length!==a.channels||a.frames>(C.LIMITS.seconds+10)*w.rate)throw Error('Saved POLISH audio does not match its metadata.');return d.channels;};
 const one=async(p,t)=>{if(!p)return null;total=0;const s=p.session;if(s?.noteTuner)NoteTuner.validate(s.noteTuner);if(p.v!==1||p.rate!==w.rate||typeof p.sourceSig!=='string'||!s?.P||s.rate!==w.rate||Object.values(s.P).some(v=>typeof v!=='number'||!Number.isFinite(v))||!Array.isArray(s.notes)||s.notes.some(n=>!Array.isArray(n)||n.length!==13||n.some(v=>!Number.isFinite(v)))||!Array.isArray(s.takes)||s.takes.length>128||!s.edits||['breaths','timing','comp'].some(k=>!Array.isArray(s.edits[k])||s.edits[k].some(a=>!Array.isArray(a)||a.some(v=>!Number.isFinite(v)))))throw Error('Invalid per-track POLISH state.');if(!C.validPrefs(C.polishPrefs(p)))throw Error('Invalid per-track POLISH preferences.');s.pcm=s.pcm?.derived==='render'?derived(w,t,p,s.pcm):await audio(s.pcm);s.takes=(await Promise.all(s.takes.map(audio))).filter(Boolean);p.channels=await audio(p.channels);if((!s.pcm?.length||!p.channels?.length)&&p.recoveryMissing!==true)throw Error('Missing POLISH audio without recovery metadata.');return p;};
 for(const t of w.tracks)t.polish=await one(t.polish,t);if(w.previousMix)w.previousMix=await one(w.previousMix,null);
}
$('polishTrack').onchange=()=>open($('polishTrack').value);
$('polishReturn').onclick=()=>RC.go('rc');
function focusEditor(wave){if(wave)document.querySelector('.dtabs [data-dock="wave"]')?.click();const target=wave?$('editCanvas'):document.querySelector('main.work>.insp');if(target){target.setAttribute('tabindex','-1');requestAnimationFrame(()=>{target.scrollIntoView({block:'start',behavior:'instant'});target.focus({preventScroll:true});});}}
$('polishWave').onclick=()=>focusEditor(true);$('polishControls').onclick=()=>focusEditor(false);
const backToControls=document.createElement('button');backToControls.id='polishBackToControls';backToControls.textContent='↑ Sound controls';backToControls.onclick=()=>focusEditor(false);$('editCanvas').after(backToControls);
$('polishExportSong').onclick=()=>{capture();const id=T()?.id;RC.go('rc');SongStudio.exportAudio({vocal:id});};
$('polishSong').onclick=async()=>{if(SongStudio.state().playing){SongStudio.stopPlay();render();return;}capture();try{await SongStudio.play(0);}catch(e){notify(e.message,true);}render();};
$('polishBypass').onchange=()=>{const t=T();if(!t?.polish)return;const bypass=$('polishBypass').checked;SongStudio.setPolishPref(t.id,{bypass},bypass?'Dry vocal enabled. Processing settings are kept.':'Processed vocal enabled.');render();};
for(const b of document.querySelectorAll('.savebtn'))b.textContent='EXPORT THIS VOCAL ▾';
window.SongPolish={open,capture,detach,restored,beforeShow,render,pack,unpack,needsApply,assertExport,snapshot,acceptPolish,monoOf,state:()=>({binding:binding?{...binding}:null,switching,error:lastError,refusal:lastRefusal})};
if(S.song&&S.main)restored({song:S.song});
setInterval(render,400);
})();

