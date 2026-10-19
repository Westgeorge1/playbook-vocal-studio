/* Per-vocal bridge to the existing POLISH worker. The engine edits one lane at
 * a time; each lane owns an immutable session and its rendered PCM. Track faders
 * and pan are applied AFTER processing. No song workspace is nested in a session.
 */
(function(){
'use strict';
const C=SongCore,$=id=>document.getElementById(id),copy=x=>structuredClone(x);
const MAX_BYTES=256*1024*1024;
let binding=null,switching=false,lastError='',allowStep=false;
const bar=document.createElement('div');bar.id='trackPolishBar';bar.hidden=true;
bar.innerHTML='<label>Polishing <select id="polishTrack" aria-label="Vocal track to polish"></select></label><button id="polishSong">▶ Hear song</button><button id="polishExportSong">Export song</button><button id="polishReturn">← Song & vocals</button><label><input type="checkbox" id="polishBypass"> Use dry vocal</label><span id="polishTrackStatus" role="status" aria-live="polite"></span><p>Clean, Tune, edits and effects apply to this vocal only. Play and Mix below audition this track with its fitted backing. Hear song and Export song use all lanes and the song mixer.</p>';
$('rcSteps').append(bar);
const W=()=>S.song,T=()=>binding&&W()?.tracks.find(t=>t.id===binding.id);
function snapshot(){
 if(!S.main||!S.st||!S.final?.length)return null;
 const g=S.guide||{};
 return {v:4,name:S.name,rate:S.rate,pcm:S.audio[5]||[S.main],takes:S.takeChannels.slice(1),P:{...S.st.params},notes:S.st.notes.map(a=>a.slice(0,13)),edits:copy(S.st.edits),match:S.match,chainEdited,mix:{...S.mix},exportMask:S.exportMask,
 guide:{...S.guidePrefs,locked:[...(g.locked||[])],dismissed:{...(g.dismissed||{})}}};
}
function bytes(p){if(!p)return 0;const buffers=new Set();for(const ch of [p.channels,p.session?.pcm,...(p.session?.takes||[])])for(const c of ch||[])buffers.add(c.buffer);return [...buffers].reduce((n,b)=>n+b.byteLength,0);}
function budget(w,p,id){const used=w.tracks.reduce((n,t)=>n+(t.id===id?0:bytes(t.polish)),0)+bytes(w.previousMix)+bytes(p);if(used>MAX_BYTES)throw Error('POLISH storage is full (256 MB). Back up the project, then shorten or remove an unused vocal track. Your recordings and previous processing are kept.');}
function reserve(w,t){const nc=Math.max(1,...t.regions.flatMap(r=>r.takes.map(a=>w.sources[a.source].channels.length))),needed=Math.round((C.trackEnd(t)*nc+(C.trackEnd(t)+10)*2)*w.rate)*4,used=w.tracks.reduce((n,x)=>n+(x.id===t.id?0:bytes(x.polish)),0)+bytes(w.previousMix);if(used+needed>MAX_BYTES)throw Error('This vocal needs more POLISH memory than the remaining 256 MB budget. Back up the project and shorten or remove an unused track before processing.');}
function capture(){
 if(switching||S.songApplying||!binding||!T())return false;
 const session=snapshot();if(!session)return false;
 // Never overwrite a history-restored lane with a different source's engine state.
 if(binding.sourceSig!==C.trackSignature(W(),T()))return false;
 const p={v:1,sourceSig:binding.sourceSig,rate:S.rate,session,channels:S.final,bypass:!!T().polish?.bypass};
 try{budget(W(),p,binding.id);T().polish=p;W().polishTrack=binding.id;lastError='';return true;}
 catch(e){lastError=e.message;render();return false;}
}
function detach(){binding=null;lastError='';}
function needsApply(){return !!(W()&&C.selectedCount(W())&&(!binding||!T()||binding.sourceSig!==C.trackSignature(W(),T())));}
function notify(text,error=false){SongStudio.notify(text,error);$('polishTrackStatus').textContent=text;if(error)setStatus(text,'warn');}
async function open(id=W()?.activeTrack){
 if(switching||SongStudio.locked()||sessionLocked())return false;
 const w=W(),t=w&&C.track(w,id);if(!t?.regions.some(r=>r.selected)){notify('Choose a take on this vocal track first.',true);return false;}
 SongStudio.stopPlay();endLoop();stopPlayback();capture();
 const sig=C.trackSignature(w,t),old=t.polish,valid=C.polishValid(w,t);
 if(binding?.id===id&&binding.sourceSig===sig){allowStep=true;RC.go('polish');allowStep=false;render();return true;}
 if(old&&!valid){
  const answer=await SongStudio.dialog('Update POLISH for '+t.name+'?', '<p>Your chosen recording changed. This updates <b>only this vocal track</b>. Cleaning, tuning settings and effects are kept.</p><p>Manual note edits, breath edits, timing edits and POLISH alternate takes refer to the earlier audio. They will be reset for the new performance. Back up first if you need that earlier edited version.</p>',[['cancel','Keep current version'],['ok','Update this vocal']]);
  if(answer.action!=='ok')return false;
 }
 const previous=binding?{...binding}:null,previousSession=snapshot();
 switching=true;S.songApplying=true;lastError='';render();notify('Opening '+t.name+' in POLISH…');
 try{
  if(valid){await restoreSession({...old.session,name:w.title+' — '+t.name});}
  else{
   reserve(w,t);
   const pcm=C.renderTrack(w,t,{end:C.trackEnd(t)});
   budget(w,{channels:[pcm[0],pcm[0]],session:{pcm,takes:[]}},id);
   if(old){await restoreSession({...old.session,name:w.title+' — '+t.name,rate:w.rate,pcm,takes:[],notes:[],edits:{breaths:[],timing:[],comp:[]},guide:{...old.session.guide,locked:[],dismissed:{}}});}
   else {S.guidePrefs={enabled:true,concern:0,goal:0,bpm:S.guidePrefs.bpm||75,sync:false};S.mix={fit:true,over:1,room:.5};chainEdited=false;S.match=true;await openVocal(pcm,w.rate,w.title+' — '+t.name,false,0);}
  }
  if(S.rate!==w.rate)throw Error('The processor changed the sample rate. This track has not replaced the song audio.');
  const p={v:1,sourceSig:sig,rate:w.rate,session:snapshot(),channels:S.final,bypass:!!old?.bypass};budget(w,p,id);
  t.polish=p;w.polishTrack=id;if(w.activeTrack!==id){w.activeTrack=id;w.selectedRegion=null;w.range=null;}binding={id,sourceSig:sig};S.song=w;
  S.loadedNotice='POLISH: '+t.name+'. Changes are saved on this track and heard in your song.';
  setMode('final');allowStep=true;RC.go('polish');allowStep=false;
  notify(t.name+' is ready. Its processing is saved automatically.');return true;
 }catch(e){
  binding=null;S.song=w;
  if(previous&&previousSession){try{await restoreSession(previousSession);binding=previous;}catch(restoreError){lastError='Previous editor could not reopen: '+restoreError.message;}}
  notify('Could not open POLISH: '+e.message,true);return false;
 }finally{S.songApplying=false;switching=false;allowStep=false;persist();SongStudio.render();render();}
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
 if(saved?.polish){binding={id:saved.id,sourceSig:saved.polish.sourceSig};}
 else if(S.main&&S.final?.length&&(!last.song||w.appliedSig)){
  const session=snapshot();if(!session)return;
  const p={v:1,rate:S.rate,sourceSig:'legacy',session,channels:S.final,bypass:false};
  if(w.tracks.length===1&&w.appliedSig===C.signature(w)){
   // Legacy POLISH was run on this same single vocal. Preserve all edits.
   p.sourceSig=C.trackSignature(w,w.tracks[0]);w.tracks[0].polish=p;w.polishTrack=w.tracks[0].id;binding={id:w.polishTrack,sourceSig:p.sourceSig};
  }else if(!w.previousMix)w.previousMix=p;
 }
 render();
}
function render(){
 bar.hidden=RC.step!=='polish';if(bar.hidden)return;
 const w=W(),tracks=w?.tracks.filter(t=>t.regions.some(r=>r.selected))||[],selected=binding?.id||w?.activeTrack||'',items=tracks.map(t=>[t.id,t.name]);
 const key=JSON.stringify(items);if($('polishTrack').dataset.key!==key){$('polishTrack').dataset.key=key;$('polishTrack').replaceChildren(...items.map(([id,name])=>{const o=document.createElement('option');o.value=id;o.textContent=name;return o;}));}
 $('polishTrack').value=selected;const locked=switching||sessionLocked();for(const id of ['polishTrack','polishSong','polishExportSong','polishReturn','polishBypass'])$(id).disabled=locked;
 $('polishBypass').checked=!!T()?.polish?.bypass;$('polishSong').textContent=SongStudio.state().playing?'■ Stop song':'▶ Hear song';
 $('polishTrackStatus').textContent=lastError||(switching?'Opening vocal…':needsApply()?'Recording changed — update this vocal in Song & vocals.':T()?.polish?.bypass?'Dry vocal is used in the song. Your POLISH settings are kept.':'This vocal’s processing is saved in your song.');
}
function assertExport(tracks){const stale=tracks.filter(t=>t.polish&&!t.polish.bypass&&!C.polishValid(W(),t));if(stale.length)throw Error('Update POLISH for '+stale.map(t=>t.name).join(', ')+' before exporting, or select Use dry vocal for that track.');if(lastError)throw Error(lastError);}
async function pack(meta,files){
 const packAudio=(ch,rate,file)=>{files.push({name:file,data:wavFloat(ch,rate)});return {file,rate,frames:ch[0].length,channels:ch.length};};
 const one=(p,id)=>{if(!p)return null;const session={...p.session,pcm:packAudio(p.session.pcm,p.rate,'pbv-polish-'+id+'-input.wav'),takes:(p.session.takes||[]).map((ch,i)=>packAudio(ch,p.rate,'pbv-polish-'+id+'-take-'+i+'.wav'))};return {...p,session,channels:packAudio(p.channels,p.rate,'pbv-polish-'+id+'-final.wav')};};
 for(const t of meta.tracks)t.polish=one(t.polish,t.id);if(meta.previousMix)meta.previousMix=one(meta.previousMix,'previous-mix');meta.polishVersion=1;
}
async function unpack(w,files){
 if(w.polishVersion!=null&&w.polishVersion!==1)throw Error('This project needs a newer per-track POLISH version.');
 let total=0;
 const audio=async a=>{if(!a||typeof a.file!=='string')throw Error('Missing POLISH audio metadata.');const f=files.get(baseName(a.file).toLowerCase());if(!f)throw Error('Missing POLISH audio: '+a.file);total+=f.data.length;if(total>MAX_BYTES+1048576)throw Error('Saved POLISH data exceeds 256 MB.');const d=await decodeBytes(f.data,a.file);C.checkAudio(d.channels,d.rate);if(d.rate!==w.rate||d.channels[0].length!==a.frames||d.channels.length!==a.channels||a.frames>(C.LIMITS.seconds+10)*w.rate)throw Error('Saved POLISH audio does not match its metadata.');return d.channels;};
 const one=async p=>{if(!p)return null;const s=p.session;if(p.v!==1||p.rate!==w.rate||typeof p.sourceSig!=='string'||!s?.P||s.rate!==w.rate||Object.values(s.P).some(v=>typeof v!=='number'||!Number.isFinite(v))||!Array.isArray(s.notes)||s.notes.some(n=>!Array.isArray(n)||n.length!==13||n.some(v=>!Number.isFinite(v)))||!Array.isArray(s.takes)||s.takes.length>128||!s.edits||['breaths','timing','comp'].some(k=>!Array.isArray(s.edits[k])||s.edits[k].some(a=>!Array.isArray(a)||a.some(v=>!Number.isFinite(v)))))throw Error('Invalid per-track POLISH state.');s.pcm=await audio(s.pcm);s.takes=await Promise.all(s.takes.map(audio));p.channels=await audio(p.channels);return p;};
 for(const t of w.tracks)t.polish=await one(t.polish);if(w.previousMix)w.previousMix=await one(w.previousMix);
}
$('polishTrack').onchange=()=>open($('polishTrack').value);
$('polishReturn').onclick=()=>RC.go('rc');
$('polishExportSong').onclick=()=>{capture();RC.go('rc');SongStudio.exportAudio();};
$('polishSong').onclick=async()=>{if(SongStudio.state().playing){SongStudio.stopPlay();render();return;}capture();try{await SongStudio.play(0);}catch(e){notify(e.message,true);}render();};
$('polishBypass').onchange=()=>{const t=T();if(!t?.polish)return;const bypass=$('polishBypass').checked;SongStudio.edit(()=>{t.polish={...t.polish,bypass};},bypass?'Dry vocal enabled. Processing settings are kept.':'Processed vocal enabled.');render();};
for(const b of document.querySelectorAll('.savebtn'))b.textContent='EXPORT THIS VOCAL ▾';
window.SongPolish={open,capture,detach,restored,beforeShow,render,pack,unpack,needsApply,assertExport,snapshot,state:()=>({binding:binding?{...binding}:null,switching,error:lastError})};
if(S.song&&S.main)restored({song:S.song});
setInterval(render,400);
})();
