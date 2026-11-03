/* Guided phrase review. Auditions use temporary audio and song copies. Only Keep
   or Leave it writes a decision, attached to the take in source-relative time. */
(function(){
'use strict';
const C=SongCore,Q=QualityCore,$=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=t=>Math.floor(t/60)+':'+(t%60).toFixed(2).padStart(5,'0');
const dialog=document.createElement('dialog');dialog.id='phraseGuide';dialog.setAttribute('aria-labelledby','pgTitle');
document.body.append(dialog);
const modes={listen:'I want to hear this passage',breath:'My breath covers the next word',tune:'One word sounds off pitch',harmony:'The harmony hides my lead',mix:'A word gets lost in the mix',take:'I want to compare two takes',tone:'The vocal sounds harsh or dull',stage:'I want to find where the problem starts'};
const advice={
 listen:'Hear the selected passage with the current song mix, then choose what you want to check.', 
 take:'Listen to the same line with the riddim. Which take has the clearest ending, the right timing and the delivery you want?',
 stage:'Switch between the same passage at matched loudness. Where do you first hear the problem?',
 breath:'Hear what would be removed. If there is a consonant or a piece of the next word, shorten the selection or try less. Compare again with the song.',
 tune:'Listen for the slide into the note and the held vowel. Keeping applies the preset to this entire vocal lane.',
 tone:'Choose what you actually hear, then compare one chain control on this phrase. Keeping changes that control across the whole vocal.',
 mix:'Listen for the last word against the arrangement. Try a small lift on this phrase or a dip on a separate harmony lane. Only the selected time range changes.'
};
let project,trackId,cues=[],cue,mode,preview,serial=0,audioSerial=0,source=null,busy=false,returnTo;
let committing=false,chainJob=null,intent=null,lastChange=null,manualCue=false;
const beatCache=new WeakMap();
const cache=new WeakMap();
function recording(w,c){
 const track=C.track(w,c.track),region=track?.regions.find(r=>r.id===c.region),take=region?.takes.find(a=>a.id===c.take);
 if(!take||!w.sources[take.source])throw Error('This take is no longer available. Reopen the guide.');
 return {track,region,take,src:w.sources[take.source]};
}
function scanSource(src){
 if(cache.has(src))return cache.get(src);
 const channels=src.channels,rate=src.rate;
 // Use the stronger channel for detection; stereo phase should not hide a word.
 let best=channels[0],bestEnergy=-1;
 for(const ch of channels){let e=0;for(let i=0;i<ch.length;i+=24)e+=ch[i]*ch[i];if(e>bestEnergy){best=ch;bestEnergy=e;}}
 const hop=Math.max(1,Math.round(rate*.04)),frames=[];
 for(let i=0;i<best.length;i+=hop){
  const end=Math.min(i+hop,best.length);let energy=0,peak=0;
  for(let j=i;j<end;j++){const x=best[j];energy+=x*x;peak=Math.max(peak,Math.abs(x));}
  frames.push({start:i/rate,end:end/rate,db:Q.db(Math.sqrt(energy/(end-i))),peak});
 }
 const sorted=frames.map(f=>f.db).sort((a,b)=>a-b),loud=sorted[Math.floor(sorted.length*.9)]??-Infinity;
 const result={frames,loud,breaths:BreathFind.find([best],rate)};cache.set(src,result);return result;
}
function scan(w,t){
 const out=[];
 for(const region of t.regions){
  const take=region.takes.find(a=>a.id===region.selected)||region.takes[0];if(!take)continue;
  const src=w.sources[take.source],origin=C.origin(take),span=C.takeSpan(w,take);
  const lo=Math.max(region.start,span[0]/w.rate),hi=Math.min(region.end,span[1]/w.rate);
  if(hi-lo<.08)continue;
  const base={track:t.id,region:region.id,take:take.id};
  function add(start,end,kind,label,reason){
   const a=Math.max(lo,start),b=Math.min(hi,end);
   if(b-a<.08)return;
   const key=kind+'@'+Math.round((a-origin)*w.rate)+'-'+Math.round((b-origin)*w.rate);
   if(!out.some(c=>c.take===take.id&&c.key===key))out.push({...base,a,b,key,kind,label,reason});
  }
  const info=scanSource(src);
  if(w.range&&w.range[1]-w.range[0]<=20)add(w.range[0],w.range[1],'selection','Your selection','Listen to the passage you selected on the timeline.');
  for(const b of info.breaths)add(origin+b.start,origin+b.end,'breath','Possible breath','Quiet, noise-like sound near the vocal. Listen for a consonant before reducing it.');
  let start=null,last=0,maxDb=-Infinity,peak=0;
  function finish(){
   if(start!==null){
    const quiet=maxDb<info.loud-8,clipped=peak>=.999;
    add(start-.10,last+.12,'phrase',clipped?'Check loud peak':quiet?'Check quiet phrase':'Vocal phrase',
     clipped?'A sample is near full scale. Compare takes for audible distortion.':quiet?'This phrase peaks below the louder words on this take. Hear it with the backing.':'Check delivery and timing with the backing before choosing a change.');
   }
   start=null;maxDb=-Infinity;peak=0;
  }
  for(const f of info.frames){
   const at=origin+f.start;if(at>=hi||origin+f.end<=lo)continue;
   const voiced=f.db>Math.max(-58,info.loud-28);
   if(start!==null&&(at-last>.28||at-start>=6))finish();
   if(voiced){if(start===null)start=at;last=origin+f.end;maxDb=Math.max(maxDb,f.db);peak=Math.max(peak,f.peak);}
  }
  finish();
  if(!out.some(c=>c.region===region.id))add(lo,Math.min(hi,lo+6),'phrase','Listen to take','No clear vocal phrase detected. Check the recording level and listen.');
 }
 const notes=bound(t)?NoteTuner.notes():[];
 for(const c of out){
  const note=notes.find(n=>n.end>c.a&&n.start<c.b&&(n.review||Math.abs(n.target-n.centre)>=.5));
  if(note&&c.label==='Vocal phrase'){c.label='Review note';c.reason='A detected note near '+clock(note.start)+' needs a listening check. A pitch move alone does not establish the intended melody.';}
  if(c.label==='Vocal phrase'||c.label==='Check quiet phrase'){
   const other=w.tracks.find(l=>l!==t&&!l.mute&&(!w.tracks.some(v=>v.solo)||l.solo)&&l.regions.some(r=>r.selected&&r.start<c.b&&r.end>c.a));
   if(other){c.label='Check vocal balance';c.reason=other.name+' overlaps this phrase. Listen with the mix and decide whether the words are clear.';}
  }
 }
 return out.sort((a,b)=>a.a-b.a||a.b-b.b);
}
function bound(t){
 const b=SongPolish.state().binding;
 return !!(t&&b?.id===t.id&&C.polishValid(S.song,t)&&S.main&&!sessionLocked()&&!SongPolish.state().switching);
}
function decisions(take){return Array.isArray(take.coachDecisions)?take.coachDecisions:[];}
function decision(c){return decisions(recording(project,c).take).find(d=>d.key===c.key);}
function remember(take,c,label,a,b){
 const origin=C.origin(take),key=c.kind+'@'+Math.round((c.a-origin)*project.rate)+'-'+Math.round((c.b-origin)*project.rate);
 const rows=decisions(take).filter(d=>d.key!==key);
 if(rows.length>=512)throw Error('This take already has 512 reviewed passages.');
 take.coachDecisions=[...rows,{key,label,start:a-origin,end:b-origin}];
}
function stopAudio(){
 audioSerial++;
 if(source){source.onended=null;try{source.stop();source.disconnect();}catch(_){}source=null;}
}
function invalidate(){serial++;stopAudio();chainJob?.cancel();chainJob=null;preview=null;busy=false;}
function close(){if(committing)return;lastChange=null;invalidate();if(dialog.open)dialog.close();project=null;cue=null;cues=[];returnTo?.focus?.({preventScroll:true});}
dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
function say(text){if($('pgMessage'))$('pgMessage').textContent=text;}
function available(){if(!project||S.song!==project)throw Error('The song changed. Reopen the guide.');if(sessionLocked()||SongStudio.locked())throw Error('Wait for recording or processing to finish.');}
function choose(c){
 if(committing)return;invalidate();cue=c;
 const suggested=!c?'listen':c.kind==='breath'?'breath':c.label==='Review note'?'tune':
  ['Check quiet phrase','Check vocal balance'].includes(c.label)?'mix':
  recording(project,c).region.takes.length>1?'take':'listen';
 mode=intent==='harmony'?'mix':intent||suggested;render();
}
function overlap(c){
 return project.tracks.find(t=>t.id!==trackId&&!t.mute&&(!project.tracks.some(x=>x.solo)||t.solo)&&t.regions.some(r=>r.selected&&r.start<c.b&&r.end>c.a));
}
function setConcern(value){
 const custom=$('pgA').value!==cue.a.toFixed(3)||$('pgB').value!==cue.b.toFixed(3);
 const match=c=>value==='breath'?c.kind==='breath':value==='tune'?c.label==='Review note':
  value==='harmony'?!!overlap(c):value==='take'?recording(project,c).region.takes.length>1:false;
 intent=value;mode=value==='harmony'?'mix':value;
 const candidates=cues.filter(match).sort((x,y)=>Number(y.region===cue.region)-Number(x.region===cue.region)||Math.abs(x.a-cue.a)-Math.abs(y.a-cue.a));
 const next=!custom&&!manualCue&&cue.kind!=='selection'&&!match(cue)&&candidates[0];
 if(next){choose(next);return;}
 invalidate();tools();say('');
}
function reload(key){
 const t=C.track(project,trackId);cues=t?scan(project,t):[];
 const c=cues.find(x=>x.key===key&&x.region===cue?.region)||cues.find(x=>x.kind==='selection'&&!decision(x))||
  cues.find(x=>x.label==='Check loud peak'&&!decision(x))||cues.find(x=>x.kind==='breath'&&!decision(x))||cues.find(x=>x.label==='Review note'&&!decision(x))||cues.find(x=>!decision(x))||cues[0];
 choose(c);
}
function open(){
 if(SongStudio.locked()||sessionLocked()){SongStudio.notify('Wait for recording or processing to finish, then open Guide this vocal.');return;}
 if(dialog.open)return;
 invalidate();intent=null;manualCue=false;project=S.song;returnTo=document.activeElement;SongStudio.stopPlay();stopPlayback();NoteTuner.stopAudition();
 trackId=(RC.step==='polish'&&SongPolish.state().binding?.id)||project?.activeTrack;
 dialog.showModal();reload();
}
function selectOptions(values,id){return values.map(([v,t])=>'<option value="'+esc(v)+'"'+(v===id?' selected':'')+'>'+esc(t)+'</option>').join('');}
function render(){
 const t=project&&C.track(project,trackId);
 dialog.innerHTML='<header><div><small>SMART GUIDE</small><h2 id="pgTitle">Guide this vocal</h2></div><button id="pgClose" aria-label="Close phrase guide">Close</button></header><div class="pg-body" id="pgBody"></div>';
 $('pgClose').onclick=close;
 const body=$('pgBody');
 if(!project){body.textContent='Record or import a vocal on Song & vocals, then open the guide.';return;}
 body.innerHTML='<label>Vocal track<select id="pgTrack">'+selectOptions(project.tracks.map(t=>[t.id,t.name]),trackId)+'</select></label>';
 $('pgTrack').onchange=()=>{trackId=$('pgTrack').value;intent=null;manualCue=false;reload();};
 if(!cue){body.insertAdjacentHTML('beforeend','<p>Record or import a take on this vocal track to start a phrase review.</p>');return;}
 const {take,region}=recording(project,cue),review=decision(cue);
 const section=project.sections.find(s=>s.start<=cue.a&&s.end>cue.a);
 const reviewed=cues.filter(c=>decision(c)).length;
 body.insertAdjacentHTML('beforeend','<label class="pg-question">What would you like to check?<select id="pgMode">'+selectOptions(Object.entries(modes),intent||mode)+'</select></label><label>Passage<select id="pgCue">'+selectOptions(cues.map((c,i)=>[String(i),clock(c.a)+' · '+c.label+(decision(c)?' ✓':'')]),String(cues.indexOf(cue)))+'</select></label>'+
 '<p class="pg-location">'+esc([section?.name,region.name,take.name].filter(Boolean).join(' · '))+'</p>'+
 '<div class="pg-focus"><strong>'+esc(cue.label)+'</strong><span>'+esc(cue.reason)+'</span></div>'+
 '<div class="pg-range"><label>Start (s)<input id="pgA" type="number" step=".01" value="'+cue.a.toFixed(3)+'"></label><label>End (s)<input id="pgB" type="number" step=".01" value="'+cue.b.toFixed(3)+'"></label><label class="pg-loop"><input type="checkbox" id="pgLoop" checked> Loop</label></div>'+
 '<p class="pg-note" id="pgConcernNote" hidden></p><p class="pg-listen" id="pgAdvice">'+esc(advice[mode])+'</p><div id="pgTools"></div><p id="pgMessage" role="status"></p>'+
 '<div class="pg-actions"><button id="pgLeave">Leave it</button><button id="pgNext">Next unreviewed</button><button id="pgStop">■ Stop</button><button id="pgUndo" title="Undo the last song edit (take choice, cleanup, phrase volume or review decision)">Undo song edit</button></div>'+
 '<p id="pgProgress">'+reviewed+' of '+cues.length+' passages reviewed on this track.'+(review?' This passage: '+esc(review.label)+'.':'')+'</p>'+
 '<details id="pgHistory"><summary>Saved decisions for this take ('+decisions(take).length+')</summary><ol>'+decisions(take).map(d=>'<li>'+clock(C.origin(take)+d.start)+'–'+clock(C.origin(take)+d.end)+' · '+esc(d.label)+'</li>').join('')+'</ol></details>');
 $('pgCue').onchange=()=>{manualCue=true;choose(cues[+$('pgCue').value]);};
 $('pgMode').onchange=()=>setConcern($('pgMode').value);
 for(const id of ['pgA','pgB'])$(id).oninput=()=>{invalidate();tools();say('Range changed. Prepare the comparison again.');};
 $('pgLoop').onchange=()=>{if(source)source.loop=$('pgLoop').checked;};
 $('pgStop').onclick=stopAudio;
 const undo=$('pgUndo'),receipt=lastChange;
 undo.textContent=receipt?.song===project?receipt.caption:'Undo guide change';
 undo.title='Reverse the latest guide decision when it is still the most recent edit.';
 undo.disabled=!canReverse(receipt);
 undo.onclick=()=>run(()=>reverse(receipt));
 $('pgLeave').onclick=()=>run(()=>leave());
 $('pgNext').onclick=()=>{
  const i=cues.indexOf(cue),next=[...cues.slice(i+1),...cues.slice(0,i)].find(c=>!decision(c));
  if(next){manualCue=true;choose(next);}else say('No other unreviewed passages on this track. Listen to the whole song and open Finish & check when ready.');
 };
 tools();
}
function range(){
 const a=$('pgA').valueAsNumber,b=$('pgB').valueAsNumber,{region,take}=recording(project,cue),span=C.takeSpan(project,take);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b-a<.04||b-a>20||a<Math.max(region.start,span[0]/project.rate)-.001||b>Math.min(region.end,span[1]/project.rate)+.001)
  throw Error('Choose 0.04–20 seconds within this recording.');
 return {a:Math.max(a,region.start,span[0]/project.rate),b:Math.min(b,region.end,span[1]/project.rate)};
}
function run(fn){Promise.resolve().then(fn).catch(e=>say(e.message));}
addEventListener('pvs-classic-change',()=>{if(!dialog.open||mode!=='tune')return;invalidate();$('pgPlayers').textContent='';tools();say('Tuning choices changed. Prepare the comparison again.');});
function tuningPair(){return window.PvsUX?.classic()?[[ 'snap','Snap All + Smooth 25%' ],[ 'centre','85% + Smooth 25%' ]]:[[ 'roots','Natural Roots' ],[ 'gentle','Gentle Polish' ]];}
function tools(){
 $('pgAdvice').textContent=advice[mode]+(mode==='tune'?' Compare '+tuningPair()[0][1]+'. Try less compares '+tuningPair()[1][1]+'.':'');
 const el=$('pgTools');if(!el)return;
 const {region,track,take}=recording(project,cue);
 const note=$('pgConcernNote');
 note.hidden=!(intent==='breath'&&cue.kind!=='breath'&&!cues.some(c=>c.kind==='breath'&&c.take===cue.take&&c.a<cue.b&&c.b>cue.a));
 if(!note.hidden)note.textContent='No breath was detected in this passage. Listen and set the start and end around the breath you hear.';
 if(mode==='listen'||(mode==='take'&&region.takes.length<2)){el.innerHTML='<p>'+(mode==='listen'?'Listen for the words and delivery over the backing.':'There is one take here. Record another take of the same line to compare performances.')+'</p><button id="pgSingle">▶ Hear phrase</button>'; $('pgSingle').onclick=()=>run(async()=>{const {a,b}=range();const override=mode==='listen'&&region.selected===take.id?null:{regionId:region.id,takeId:take.id};await hear(await mix(project,a,b,override),1);});return;}
 if((['stage','tune','tone'].includes(mode))&&region.selected!==take.id){
  el.innerHTML='<p>Choose this take in Song &amp; vocals before comparing its processed stages.</p>';return;
 }
 if((['stage','tune','tone'].includes(mode))&&!bound(track)){
  el.innerHTML='<p>Prepare this vocal’s POLISH audio to hear the same phrase at each stage.</p><button id="pgPolish">Open this vocal in POLISH</button>';
  $('pgPolish').onclick=()=>run(async()=>{const id=trackId,key=cue.key,action=mode,song=project;close();$('guideSheet').hidden=true;const ok=await SongPolish.open(id);
   if(!ok||S.song!==song)return;
   for(let i=0;sessionLocked()&&!NoteTuner.failed()&&!NoiseCleaner.failed()&&i<600;i++)await new Promise(r=>setTimeout(r,200));
   if(sessionLocked()||S.song!==song){SongStudio.notify('POLISH is still processing. Open Guide this vocal again when ready.');return;}
   open();trackId=id;intent=action;reload(key);mode=action;$('pgMode').value=action;tools();
  });return;
 }
 let config='';
 if(mode==='take')config='<label>Challenger (replaces the chosen take for its recording range)<select id="pgOther">'+selectOptions(region.takes.filter(a=>a.id!==take.id).map(a=>[a.id,a.name]))+'</select></label>';
 if(mode==='tone'){
  if(+S.P.chainOn<.5){el.innerHTML='<p>The vocal chain is off. Enable it in CHAIN if you want a tone preview.</p><button id="pgChain">Open CHAIN controls</button>';$('pgChain').onclick=()=>{close();$('guideSheet').hidden=true;showPage('chain');};return;}
  config='<label>What do you hear?<select id="pgTone">'+selectOptions([['harsh','Harsh edge · soften HIGH-MID'],['dull','Words sound dull · lift HIGH-MID'],['ess','Sharp S or T · increase de-essing']])+'</select></label>';
 }
 if(mode==='mix'){
  const harmonies=project.tracks.filter(t=>t.id!==trackId&&t.regions.some(r=>r.selected&&r.start<cue.b&&r.end>cue.a));
  config='<label>Preview one change<select id="pgBalance">'+selectOptions([['lead','Lift this vocal phrase'],...harmonies.map(t=>[t.id,'Lower '+t.name+' during this phrase'])],intent==='harmony'?overlap(cue)?.id:'lead')+'</select></label>';
  if(intent==='mix'&&!S.beat)config='<p>No backing is loaded. You can compare the vocal lanes here. Add your backing in Song &amp; vocals to judge this change against the beat.</p>'+config;
  if(intent==='harmony'&&!overlap(cue))config='<p>No audible overlapping vocal here. Choose another passage, or compare a small lead lift.</p>'+config;
 }
 if(mode==='tune'&&!NoteTuner.enabled()){el.innerHTML='<p>This vocal uses the original tuner. Switch to the note editor in TUNE to compare whole-vocal presets.</p>';return;}
 if(mode==='tune')config+='<button id="pgOpenNotes">Open these notes</button>';
 el.innerHTML=config+'<button class="pg-primary" id="pgPrepare">Prepare '+(mode==='stage'?'four stages':'comparison')+'</button><div id="pgPlayers"></div>';
 $('pgPrepare').onclick=()=>run(()=>prepare(false));
 if($('pgOpenNotes'))$('pgOpenNotes').onclick=()=>run(()=>{const {a,b}=range();return openNotes(a,b);});
 for(const id of ['pgOther','pgBalance','pgTone'])if($(id))$(id).onchange=()=>{invalidate();$('pgPlayers').textContent='';say('Prepare the new comparison.');};
}
function leave(){
 if(committing)return;available();const {a,b}=range(),c=cue;
 if(!SongStudio.edit(w=>remember(recording(w,c).take,c,'Left as heard',a,b),'Phrase left as heard. Song Undo restores the decision.'))throw Error('Could not save the decision.');
 rememberUndo('song');reload(c.key);say('Left as heard. Your audio is unchanged.');
}
async function hear(channels,gain=1){
 stopAudio();const token=audioSerial;const ctx=await resumeAudio();
 if(token!==audioSerial||!dialog.open)return;
 const n=channels[0].length,buffer=ctx.createBuffer(channels.length,n,project.rate);
 channels.forEach((ch,i)=>{const out=buffer.getChannelData(i);for(let j=0;j<n;j++)out[j]=ch[j]*gain;});
 source=ctx.createBufferSource();source.buffer=buffer;source.loop=$('pgLoop').checked;source.connect(ctx.destination);source.start();
}
async function mix(w,a,b,override=null){
 const out=C.mix(w,{start:a,end:b,override});
 const beat=S.beat;
 if(beat&&$('beatOn').checked){
  let cached=beatCache.get(beat);
  if(!cached||cached.rate!==w.rate){
   const channels=toChannels(beat);
   cached={rate:w.rate,pcm:beat.sampleRate===w.rate?channels:phraseResample(channels,beat.sampleRate,w.rate)};
   beatCache.set(beat,cached);
  }
  let beatPCM;
  try{beatPCM=await cached.pcm;}catch(e){if(beatCache.get(beat)===cached)beatCache.delete(beat);throw e;}
  const start=Math.round(a*w.rate),g=(S.beatLevel??.8)*Q.gain(w.masterDb);
  for(let c=0;c<out.length;c++){const src=beatPCM[Math.min(c,beatPCM.length-1)];for(let i=0;i<out[c].length&&i+start<src.length;i++)out[c][i]+=src[start+i]*g;}
 }
 return out;
}
function matched(clips){
 const levels=clips.map(ch=>Q.loudness(ch,project.rate)??Q.measure(ch,project.rate,{peaks:false}).rms);
 const valid=levels.filter(Number.isFinite);
 if(!valid.length)throw Error('This passage is silent. Choose a different range or check Mute and Solo.');
 const common=Math.min(...valid),gains=levels.map(v=>Number.isFinite(v)?Q.gain(common-v):0);
 const peak=Math.max(.001,...clips.map((ch,i)=>C.peak(ch)*gains[i]));
 return gains.map(g=>g*Math.min(1,.89/peak));
}
function addMove(w,id,a,b,db){
 const track=C.track(w,id);
 if(!track||track.mute||(w.tracks.some(t=>t.solo)&&!track.solo))throw Error('This vocal is muted or outside the solo mix. Make it audible before comparing.');
 if(!track.regions.some(r=>r.selected&&r.start<b&&r.end>a))throw Error('This track has no chosen take under this phrase.');
 C.setLevelMove(w,track,{start:a,end:b,db,fadeMs:60});
}
function stamp(track){return {song:project,revision:project.revision,pcm:S.audio?.[3],final:S.audio?.[4],beat:S.beat,
 backing:$('beatOn').checked,beatLevel:S.beatLevel,track};}
function isCurrent(s){return dialog.open&&project===s.song&&S.song===project&&project.revision===s.revision&&
 S.audio?.[3]===s.pcm&&S.audio?.[4]===s.final&&S.beat===s.beat&&$('beatOn').checked===s.backing&&S.beatLevel===s.beatLevel&&trackId===s.track;}
async function prepare(less){
 available();const {a,b}=range(),c=cue,{track,region,take,src}=recording(project,c);
 const other=$('pgOther')?.value,balance=$('pgBalance')?.value,tone=$('pgTone')?.value;
 invalidate();const token=serial,identity=stamp(trackId),kind=mode,rate=project.rate;
 const pad=kind==='breath'||kind==='mix'?.75:0,start=Math.max(region.start,a-pad),end=Math.min(region.end,b+pad);
 const cut=ch=>ch.map(x=>x.slice(Math.round(start*rate),Math.round(end*rate)));
 const p={kind,a,b,identity,clips:[],labels:[],take:take.id,region:region.id,less,save:null};
 busy=true;$('pgPlayers').textContent='';say('Preparing this passage…');
 try{
  if(kind==='take'){
   const alt=region.takes.find(t=>t.id===other);
   if(track.mute||(project.tracks.some(t=>t.solo)&&!track.solo))throw Error('Make this vocal audible before comparing takes.');
   if(!alt||!C.covers(project,alt,region))throw Error('This attempt does not cover the recording range. Choose a complete take.');
   p.clips=[await mix(project,a,b,{regionId:region.id,takeId:take.id}),await mix(project,a,b,{regionId:region.id,takeId:alt.id})];
   const onsets=[];
   const evidence=a=>{
    const i=Math.max(0,Math.round((start-C.origin(a))*rate)),j=Math.max(i,Math.round((end-C.origin(a))*rate));
    const data=project.sources[a.source].channels.map(ch=>ch.subarray(i,j)),peak=C.peak(data);
    const hop=Math.max(1,Math.round(rate*.02)),floor=Math.max(.008,peak*.12);
    let onset=null;
    for(let f=0;f<data[0].length;f+=hop){
     const end=Math.min(f+hop,data[0].length);
     if(data.some(ch=>{let sum=0;for(let k=f;k<end;k++)sum+=ch[k]*ch[k];return sum/(end-f)>=floor*floor;})){onset=f/rate;break;}
    }
    onsets.push(onset);
    return a.name+': '+(peak>=.999?'near full scale; listen for distortion':peak>0?'peak '+Q.db(peak).toFixed(1)+' dBFS':'silent in this passage');
   };
   p.evidence=evidence(take)+' · '+evidence(alt)+'.';
   if(onsets.every(Number.isFinite)&&Math.abs(onsets[1]-onsets[0])>=.05)p.evidence+=' The first strong sound in '+alt.name+' enters '+Math.round(1000*Math.abs(onsets[1]-onsets[0]))+' ms '+(onsets[1]>onsets[0]?'later':'earlier')+' in this passage.';
   p.evidence+=' Both takes are dry against the current mix. Listen for the delivery you prefer.';
   p.labels=[take.name,alt.name];p.label='Chose '+alt.name;
   p.save=w=>{const r=recording(w,c).region;C.choose(w,r,alt.id);return alt.id;};
  }else if(kind==='breath'){
   if(track.mute||(project.tracks.some(t=>t.solo)&&!track.solo))throw Error('Make this track audible to compare the breath with the song.');
   const i=Math.max(0,Math.round((a-C.origin(take))*rate)),j=Math.min(src.channels[0].length,Math.round((b-C.origin(take))*rate));
   const share=BreathFind.voicedShare(src,a-C.origin(take),b-C.origin(take));const sung=share!=null&&share>.35;
   const db=less?3:sung?4:6;if(sung)p.evidence='About '+Math.round(100*share)+'% of this selection appears sung. Narrow the selection or compare this gentler reduction. Listen to Removed for words.';
   const settings={db,fade:10,low:0,high:rate/2,start:a,end:b};
   const removed=src.channels.map(x=>VocalSeparation.removed(x,i,j,rate,settings));
   const changed=src.channels.map((x,k)=>{const copy=x.slice();for(let n=i;n<j;n++)copy[n]-=removed[k][n-i];return copy;});
   const clone=C.clone(project);
   // Takes can share one source. Override just this take in the temporary mix.
   const newSource=C.id(clone,'a');clone.sources[newSource]={rate,channels:changed};
   recording(clone,c).take.source=newSource;
   const ov={regionId:region.id,takeId:take.id};
   p.clips=[await mix(project,start,end,ov),await mix(clone,start,end,ov)];p.removed=removed;
   p.labels=['Current take with mix','Breath −'+db+' dB with mix'];p.label='Breath −'+db+' dB';
   p.save=w=>SongStudio.addCleanupTake(w,c.track,c.region,c.take,changed,p.label,settings).id;
  }else if(kind==='mix'){
   const target=balance==='lead'?trackId:balance,db=(less?1:2)*(balance==='lead'?1:-1);
   const clone=C.clone(project);addMove(clone,target,a,b,db);
   p.clips=[await mix(project,start,end),await mix(clone,start,end)];p.labels=['Current mix','Proposed mix'];
   p.label=C.track(clone,target).name+' '+(db>0?'+':'')+db+' dB on phrase';
   p.save=w=>{addMove(w,target,a,b,db);return take.id;};
  }else{
   if(!bound(track))throw Error('The processed stages changed. Reopen this vocal in POLISH.');
   if(end>S.audio[3][0].length/rate+.001)throw Error('This range is outside the tuned output. Choose a shorter passage.');
   if(kind==='stage'){
    const stages=[['Raw',0],['Cleaned',1],['Tuned',3],['Final',4]];
    for(const [label,index] of stages){if(!S.audio[index]?.length)throw Error(label+' audio is unavailable.');p.clips.push(cut(S.audio[index]));p.labels.push(label);}
   }else if(kind==='tone'){
    const param=tone==='ess'?'chDeEss':'chEq2Gain',old=Number(S.P[param]);
    if(!Number.isFinite(old))throw Error('This control is unavailable on the current chain.');
    const step=(less?.75:1.5)*(tone==='harsh'?-1:1),value=C.clamp(old+step,param==='chDeEss'?0:-12,12);
    if(Math.abs(value-old)<.01)throw Error('This control is already at its limit. Try a different change.');
    const renderer=ReferencePreview.create();chainJob=renderer;
    let result;
    try{result=await renderer.render(S.audio[3],rate,{...S.P},{[param]:value},Math.round(start*rate),Math.round(end*rate));}
    finally{if(chainJob===renderer)chainJob=null;}
    p.param=param;p.value=value;p.prior=old;p.clips=[result.before,result.after];
    const label=param==='chDeEss'?'De-ess':'HIGH-MID';
    p.labels=['Current chain',label+' '+old+' → '+value+' dB'];p.label=p.labels[1]+' (whole vocal)';
   }else{
    const [preset,label]=tuningPair()[less?1:0];p.preset=preset;
    const next=await NoteTuner.previewGuidePreset(preset);
    p.clips=[cut(S.audio[3]),cut(next)];p.labels=['Current tuning',label];
    p.label=p.labels[1]+' (whole vocal)';
   }
  }
  if(serial!==token)return;
  if(!isCurrent(identity))throw Error('The audio changed during preparation. Prepare the comparison again.');
  const n=p.clips[0][0].length;if(!n||p.clips.some(ch=>!ch.length||ch[0].length!==n))throw Error('These stages have different durations. Review the timing in the note editor.');
  p.gains=matched(p.clips);preview=p;players(p);
  const notes=(kind==='tune'||kind==='stage')&&NoteTuner.enabled()?NoteTuner.notes().filter(n=>n.end>a&&n.start<b&&(n.review||Math.abs(n.target-n.centre)>=.5)):[];
  say(notes.length?'Check note'+(notes.length===1?'':'s')+' at '+notes.slice(0,5).map(n=>clock(n.start)).join(', ')+'. Listen for the intended pitch and slide.':
   p.evidence|| (kind==='stage'?'Play each stage. Choose where the issue first appears.':kind==='tune'?'Compare the slide and held vowel. Keeping changes tuning across this entire vocal.':'Same passage at matched playback level. Compare before deciding.'));
 }catch(e){if(token===serial)throw e;}finally{if(token===serial)busy=false;}
}
function players(p){
 const box=$('pgPlayers');box.innerHTML='<div class="pg-audio"></div>';
 const row=box.firstElementChild;
 const scope=document.createElement('p');scope.className='pg-scope';scope.id='pgScope';
 const track=recording(project,cue).track;
 scope.textContent=p.kind==='stage'?'Listening only. Comparing stages does not change the song.':
  p.kind==='take'?'Choosing uses this take throughout its recording range. Both takes stay available.':
  (p.kind==='tone'||p.kind==='tune')?'Preview '+clock(p.a)+'–'+clock(p.b)+'. Keeping changes the whole '+track.name+' vocal.':
  p.kind==='breath'?'Keep a new take with only '+clock(p.a)+'–'+clock(p.b)+' reduced. The original is kept.':
  'Keep '+p.label+' from '+clock(p.a)+' to '+clock(p.b)+'.';
 box.prepend(scope);
 function button(label,fn,id){const b=document.createElement('button');b.textContent=label;if(id)b.id=id;b.onclick=()=>run(fn);row.append(b);return b;}
 p.clips.forEach((clip,i)=>button('▶ '+p.labels[i],()=>{if(!isCurrent(p.identity))throw Error('The song changed. Prepare a new comparison.');return hear(clip,p.gains[i]);},'pgHear'+i));
 if(p.removed)button('▶ Hear removed (solo)',()=>{if(!isCurrent(p.identity))throw Error('Prepare a fresh comparison.');return hear(p.removed);},'pgRemoved');
 if(p.clips.length===2){
  const blind=button('Blind A/B',()=>{
   p.blind=!p.blind;stopAudio();
   if(p.blind)p.order=Math.random()<.5?[0,1]:[1,0];
   for(let i=0;i<2;i++){
    const b=$('pgHear'+i),index=p.blind?p.order[i]:i;
    b.textContent='▶ '+(p.blind?['A','B'][i]:p.labels[i]);b.onclick=()=>run(()=>{
     if(!isCurrent(p.identity))throw Error('Prepare a fresh comparison.');
     return hear(p.clips[index],p.gains[index]);
    });
   }
   blind.textContent=p.blind?'Reveal A/B':'Blind A/B';$('pgKeep').disabled=p.blind;
   say(p.blind?'Listen to A and B. Reveal the choices before keeping one.':'A was '+p.labels[p.order[0]]+'. B was '+p.labels[p.order[1]]+'.');
  },'pgBlind');
 }
 if(p.kind==='stage'){
  const select=document.createElement('select');select.id='pgEarliest';select.setAttribute('aria-label','First stage with a problem');
  select.innerHTML=selectOptions([['raw','Already in the raw take'],['clean','First heard after cleanup'],['tune','First heard after tuning'],['final','First heard in the final chain']]);box.append(select);
  const go=document.createElement('button');go.textContent='Review this stage';go.onclick=()=>route(select.value);box.append(go);return;
 }
 if(p.kind==='tune')button('Open notes in this phrase',()=>openNotes(p.a,p.b),'pgNotes');
 if(['breath','tune','tone','mix'].includes(p.kind)&&!p.less)button('Try less',()=>prepare(true),'pgLess');
 button(p.kind==='tune'?'Keep preset on whole vocal':p.kind==='tone'?'Keep tone on whole vocal':p.kind==='take'?'Use alternate take in song':'Keep phrase change',()=>keep(p),'pgKeep');
}
async function openNotes(a,b){
 close();$('guideSheet').hidden=true;showPage('tune');WorkWindows.open('notes');
 const editor=await NoteTuner.editor();editor.focusPhrase(a,b);
}
function route(stage){
 if(stage==='clean'&&cue.kind!=='breath'){
  close();$('guideSheet').hidden=true;showPage('clean');PvsCoach.open();return;
 }
 if(stage==='raw'||stage==='clean'||stage==='tune'){
  mode=stage==='raw'?'take':stage==='clean'?'breath':'tune';intent=mode;invalidate();$('pgMode').value=mode;$('pgAdvice').textContent=advice[mode];tools();say(stage==='clean'?'For a breath, review only its range. For noise across the track, use POLISH → CLEAN.':'Listen to this phrase before choosing a change.');return;
 }
 mode='tone';intent=mode;invalidate();$('pgMode').value=mode;tools();say('Preview a small change to the chain on this passage.');
}
async function keep(p){
 if(committing)return;
 available();if(busy||preview!==p||!isCurrent(p.identity))throw Error('Prepare the comparison again before keeping it.');
 const c=cue;let nativeUndo=null;stopAudio();committing=true;
 const controls=[...dialog.querySelectorAll('button,input,select')].map(el=>[el,el.disabled]);
 controls.forEach(([el])=>el.disabled=true);
 try{
 if(p.kind==='tune'||p.kind==='tone'){
  const destination={...recording(project,c).take};remember(destination,c,p.label,p.a,p.b);
  if(!bound(recording(project,c).track))throw Error('Open the correct vocal in POLISH first.');
  if(p.kind==='tune'){
   const e=await NoteTuner.editor();if(preview!==p||!isCurrent(p.identity))throw Error('Prepare the tuning comparison again.');
   if(!tuningPair().some(([id])=>id===p.preset))throw Error('Classic tools changed. Prepare the comparison again.');
   if(!e.guidePreset(p.preset))return;
   const marker=e.undoMarker();nativeUndo={valid:()=>e.undoMarker()===marker&&!!marker,apply:()=>e.undoIfCurrent(marker)};
  }else{
   if(S.P[p.param]!==p.prior)throw Error('The chain changed. Prepare the comparison again.');
   chainEdited=true;undoable([['set',p.param,p.value]],0);
  }
  invalidate();say('Applying the change to this vocal…');
  for(let i=0;sessionLocked()&&!NoteTuner.failed()&&!NoiseCleaner.failed()&&i<600;i++)await new Promise(r=>setTimeout(r,200));
  if(S.song!==p.identity.song||sessionLocked()||NoteTuner.failed()||(p.kind==='tone'&&S.P[p.param]!==p.value))throw Error('The change was sent to POLISH, but its render was not confirmed. Check the vocal there before keeping another adjustment.');
 }
 const ok=SongStudio.edit(w=>{
  const id=p.save?p.save(w):c.take,{region,take}=recording(w,c);
  remember(take,c,p.label,p.a,p.b);
  if(id!==take.id){const next=region.takes.find(x=>x.id===id);if(p.kind==='breath')next.coachDecisions=decisions(take).slice();else remember(next,c,p.label,p.a,p.b);}
 },p.kind==='tune'?'Tuning kept. Undo the preset in the note editor.':p.kind==='tone'?'Tone kept. Use POLISH Undo to restore the chain.':'Phrase change kept. Song Undo restores the previous choice.');
 if(!ok)throw Error('The change could not be saved. Check song storage or wait for processing.');
 if(p.kind==='tone'){
  const generation=engineGeneration;
  nativeUndo={valid:()=>generation===engineGeneration&&S.P[p.param]===p.value&&!$('undoBtn').disabled,apply:()=>{$('undoBtn').click();return true;},verify:()=>S.P[p.param]===p.prior};
 }
 rememberUndo(p.kind==='tune'?'tune':p.kind==='tone'?'tone':'song',nativeUndo);
 committing=false;
 if(dialog.open){reload(c.key);say(p.kind==='tune'?'Preset kept on the whole '+recording(project,c).track.name+' vocal. Note-editor Undo restores the previous tuning.':p.kind==='tone'?'Tone kept on the whole '+recording(project,c).track.name+' vocal. POLISH Undo restores the previous chain.':'Kept '+p.label+' for '+(p.kind==='take'?'the recording range':clock(p.a)+'–'+clock(p.b))+'. Song Undo restores the previous choice.');}
 }finally{committing=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});}
}
function rememberUndo(kind,native=null){
 lastChange={kind,native,song:project,revision:project.revision,track:trackId,marker:SongStudio.undoMarker(),
  caption:kind==='tune'?'Undo whole-vocal tuning':kind==='tone'?'Undo whole-vocal tone':'Undo this song edit'};
}
function canReverse(r){
 return !!r&&r.song===S.song&&r.song===project&&r.track===trackId&&r.revision===project.revision&&!!r.marker&&r.marker===SongStudio.undoMarker()&&
  (!r.native||(bound(C.track(project,trackId))&&r.native.valid()));
}
async function reverse(r){
 available();if(committing)return;
 if(!canReverse(r)){render();say('A newer edit or a different vocal is active. Review Undo in the original editor.');return;}
 const key=cue.key;invalidate();committing=true;
 const controls=[...dialog.querySelectorAll('button,input,select')].map(el=>[el,el.disabled]);
 controls.forEach(([el])=>el.disabled=true);say('Restoring the previous edit…');
 try{
  if(r.native){
   if(!r.native.apply())throw Error('The editor history changed. Review Undo in the original editor.');
   await new Promise(resolve=>setTimeout(resolve,100));
   for(let i=0;sessionLocked()&&!NoteTuner.failed()&&!NoiseCleaner.failed()&&i<600;i++)await new Promise(resolve=>setTimeout(resolve,200));
   if(sessionLocked()||NoteTuner.failed()||NoiseCleaner.failed()||(r.native.verify&&!r.native.verify()))throw Error('Check the result in the original editor. Its Undo could not be confirmed.');
  }
  if(r.marker!==SongStudio.undoMarker()||S.song!==r.song||r.revision!==S.song.revision)throw Error('The song changed. Review the saved decision before undoing another edit.');
  SongStudio.history(-1);project=S.song;lastChange=null;committing=false;reload(key);say('Undone. The previous '+(r.kind==='tune'?'tuning':r.kind==='tone'?'tone':'song choice')+' and review decision are restored.');
 }finally{committing=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});if($('pgUndo'))$('pgUndo').disabled=!canReverse(lastChange);}
}
function nextStep(){
 const w=S.song,t=w&&C.track(w,RC.step==='polish'?(SongPolish.state().binding?.id||w.activeTrack):w.activeTrack);
 const count=t?.regions.reduce((n,r)=>n+decisions(r.takes.find(a=>a.id===r.selected)||{}).length,0)||0;
 return count?'Guide this vocal: '+count+' saved phrase decision'+(count===1?'':'s')+' on '+t.name+'. Resume the next unreviewed passage, or listen with the whole song.':'';
}
window.PhraseGuide={open,nextStep};
})();
