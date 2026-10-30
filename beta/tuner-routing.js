/* 0.29: cleaned float PCM -> note editor -> existing vocal chain.
 * The original worker and its note/parameter state are never replaced. */
(function(){'use strict';
const $=id=>document.getElementById(id),clone=x=>x==null?null:structuredClone(x),scales=NoteEditorSafety.scales;
let cfg={v:1,mode:'original',editor:null},cache={},iframe=null,loaded='',api=null,processing=false,error='',timer=0,revision=0,appliedRevision=0,post=null,postInput='',postParams='',postResult=null,postBeat=null,editorBeat=null,notice='',label='';
const metrics=new WeakMap();
function valid(c){if(c?.cleaner)NoiseCleaner.validate(c.cleaner);if(!c||c.v!==1||!['note','original'].includes(c.mode))throw Error('Invalid saved tuning engine.');if(c.editor){const e=c.editor;NoteEditorSafety.number(e.rate,22050,192000,'tuner sample rate');NoteEditorSafety.number(e.frames,1,e.rate*900,'tuner input length');if(![1,2].includes(e.channels))throw Error('Invalid tuner channel count.');NoteEditorSafety.edits(e.settings,Math.max(0,Math.floor((Math.ceil(e.frames*11025/e.rate)-490)/110)));}return c;}
function enabled(){return cfg.mode==='note';}
function releaseEditor(){api?.dispose?.();iframe?.remove();iframe=null;api=null;loaded='';editorBeat=null;}
function begin(saved,fresh=false,name=""){NoiseCleaner.begin(saved?.cleaner,fresh);label=name;clearTimeout(timer);++revision;appliedRevision=revision;cfg=saved?clone(valid(saved)):{v:1,mode:fresh?'note':'original',editor:null};cache={};loaded='';error='';notice='';post?.close();post=null;postInput='';postParams='';postResult=null;postBeat=null;editorBeat=null;api?.stop();if(!enabled())releaseEditor();ui();}
function state(){return {...clone(cfg),cleaner:NoiseCleaner.state()};}
function measure(ch,rate){if(!ch?.[0])return null;let m=metrics.get(ch[0]);if(!m){m=QualityCore.measure(ch,rate,{peaks:false});metrics.set(ch[0],m);}return m;}
function matched(arr,rate){const ms=arr.map(c=>measure(c,rate)),levels=ms.map(m=>m?.lufs??m?.rms??-Infinity),finite=levels.filter((v,i)=>i!==3&&Number.isFinite(v)),target=finite.length?Math.min(...finite):0;const gains=ms.map((m,i)=>Number.isFinite(levels[i])?Math.pow(10,Math.max(-60,Math.min(24,target-levels[i]))/20):1),safe=ms.map(m=>m?Math.min(1,Math.pow(10,(-1-m.samplePeak)/20)):1);const cap=Math.min(1,...gains.map((g,i)=>safe[i]/g));return {gains:gains.map(g=>g*cap),safe};}
class Client{
 constructor(){this.n=0;this.jobs=new Map();this.w=new Worker('worker.js?v=0.31.1');this.w.onmessage=({data:m})=>{if(m.type==='done'){const p=this.jobs.get(m.id);if(p){this.jobs.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve(m);}}else if(m.type==='error')this.fail(Error(m.message));};this.w.onerror=e=>this.fail(Error(e.message||'Vocal effects stopped.'));}
 fail(e){for(const p of this.jobs.values()){clearTimeout(p.timer);p.reject(e);}this.jobs.clear();}
 send(m){return new Promise((resolve,reject)=>{const id=++this.n,timer=setTimeout(()=>{this.jobs.delete(id);reject(Error('Vocal effects took too long. Your original tuner is available.'));},240000);this.jobs.set(id,{resolve,reject,timer});this.w.postMessage({...m,id});});}
 close(){this.fail(Error('Tuning track changed.'));this.w.terminate();}
}
async function editor(){if(api)return api;if(!iframe){iframe=document.createElement('iframe');iframe.id='noteEditorFrame';iframe.title='Playbook vocal note editor';iframe.src='note-editor.html?embed=1&v=0.31.12';$('newNotePanel').append(iframe);}
 const start=performance.now();while(!iframe.contentWindow?.PlaybookNoteEditor){if(performance.now()-start>20000)throw Error('The note editor could not open. Switch to Original tuner and retry.');await new Promise(r=>setTimeout(r,30));}
 api=iframe.contentWindow.PlaybookNoteEditor;api.onChange(edited);api.onPlay(()=>{endLoop();stopPlayback();window.SongStudio?.stopPlay();});return api;
}
async function chain(ch,rate,P,mask=null){
 NoteEditorSafety.audio(ch,rate);if(ch.length===2&&ch[0].length>SongCore.ENGINE.stereoFrames)throw Error('The retimed stereo vocal exceeds the effects engine limit. Shorten it or switch to the original tuner.');
 if((ch[0].length*ch.length+(ch[0].length+10*rate)*2)*4>SongCore.ENGINE.bytes)throw Error('The retimed vocal is too long for the effects engine. Shorten it before applying.');
 post=post||new Client();const hash=rate+':'+SongCore.hashPcm(ch),params=Object.fromEntries(Object.entries(P).filter(([k])=>(k.startsWith('ch')&&k!=='chainPreset')));params.chRepairOn=0;params.chRoomReduceOn=0;const sig=JSON.stringify(params);
 if(hash!==postInput){await post.send({type:'run',steps:[['set','cleanOn',0],['set','amount',0],['set','drift',0],['set','followSinging',0],...Object.entries(params).map(([k,v])=>['set',k,v])],update:false});await post.send({type:'open',channels:ch,rate,keep:2,detectKey:false});postInput=hash;postParams='';}
 if(sig!==postParams||!postResult){postResult=await post.send({type:'run',steps:[['set','cleanOn',0],['set','amount',0],['set','drift',0],...Object.entries(params).map(([k,v])=>['set',k,v])],update:true,want:[3,4]});postParams=sig;}
 // The chain input must be bit-identical: no second cleaning or tuning pass.
 if(!SongCore.samePcm(ch,postResult.audio[3]))throw Error('The effects stage unexpectedly changed the dry tuned input. Nothing was applied.');
 if(mask!=null)return post.send({type:'custom',mask:mask&~7,name:S.name});
 return postResult;
}
async function setPostBeat(){if(!post)return;const b=S.beat;if(postBeat===b)return;await post.send({type:'beat',channels:b?Array.from({length:b.numberOfChannels},(_,c)=>b.getChannelData(c)):null});postBeat=b;}
function trackNote(){if(cfg.editor){const s=cfg.editor.settings;return !!(s.smoothOn&&s.smooth>0||s.notes?.some(n=>Math.abs(n[3])>1e-7||n[4]>0));}return false;}
function pitchReview(){return {v:1,notes:(cache.notes||[]).filter(n=>n.review).map(n=>[n.start,n.end])};}
async function decorate(r,msg){
 if(!r.state)return r;for(const k of ['0','1','2','3','4','5'])if(r.audio?.[k])cache['raw'+k]=r.audio[k];cache.P=r.state.params;cache.rate=r.state.rate;
 if(!enabled()||!r.state.rendered)return r;
 if(!r.audio?.[3]&&!r.audio?.[4]&&!r.audio?.[1])return cache.chain?{...r,state:{...r.state,chain:cache.chain,gains:cache.gains,safe:cache.safe},noteEditor:true}:r;
 if(!cache.raw1)return r;processing=true;ui();
 try{
  const e=await editor(),ch=cache.raw1,rate=r.state.rate,hash=rate+':'+SongCore.hashPcm(ch),source=cache.raw5?SongCore.hashPcm(cache.raw5):cfg.sourceHash;
  if(loaded!==hash){
   let saved=cfg.editor;
   if(saved&&(saved.rate!==rate||saved.frames!==ch[0].length||saved.channels!==ch.length||(cfg.sourceHash&&source!==cfg.sourceHash))){cfg.previousEditor=saved;saved=null;notice='The recording or its timing changed. Previous note edits are kept in this project; review the newly detected notes.';}
   cfg.editor=await e.load(ch,rate,{name:label||S.name||'Cleaned vocal',state:saved,key:r.state.params.key,scale:scales[r.state.params.scale]||'chromatic',bpm:S.guidePrefs?.bpm||75,automatic:r.state.params.importKind<.5,referenceHz:r.state.params.followSinging>.5&&Number.isFinite(r.state.reference)?440*Math.pow(2,r.state.reference/12):440});loaded=hash;cfg.sourceHash=source;
  }else e.key(r.state.params.key,scales[r.state.params.scale]||'chromatic');
  try{e.keyChosen?.(window.SongStudio?.keyChosen?SongStudio.keyChosen():true);}catch(_){}
  syncBacking();
  const renderRevision=revision,rendered=e.render();if(rendered.state.rate!==rate||rendered.state.frames!==ch[0].length||rendered.state.channels!==ch.length)throw Error("The editor input no longer matches the cleaned vocal. Reopen this track.");rendered.channels=rendered.channels.map(c=>Float32Array.from(c));NoteEditorSafety.audio(rendered.channels,rate);const p=await chain(rendered.channels,rate,r.state.params);
  if(revision===renderRevision)cfg.editor=rendered.state;appliedRevision=renderRevision;cache.notes=rendered.notes;cache.tuned=rendered.channels;cache.final=p.audio[4];cache.duration=rendered.duration;error='';
  const m=matched([cache.raw0,cache.raw1,cache.tuned,cache.raw2,cache.final],rate);cache.chain=p.state.chain;cache.gains=m.gains;cache.safe=m.safe;const st={...r.state,chain:p.state.chain,gains:m.gains,safe:m.safe};
  return {...r,state:st,noteEditor:true,mask:(r.mask||0)|24,audio:{...r.audio,3:cache.tuned,4:cache.final},spectrum:p.spectrum||r.spectrum};
 }catch(e){error=e.message;if(typeof S!=='undefined')S.dirty=true;throw e;}finally{processing=false;ui();}
}
async function alternate(ch,P){if(cfg.editor?.channels===1&&ch.length===2&&SongCore.samePcm([ch[0]],[ch[1]]))ch=[ch[0]];const f=document.createElement('iframe');f.hidden=true;f.src='note-editor.html?embed=1&v=0.31.12';document.body.append(f);try{const start=performance.now();while(!f.contentWindow?.PlaybookNoteEditor){if(performance.now()-start>20000)throw Error('Alternate tuning preview could not open.');await new Promise(r=>setTimeout(r,30));}const e=f.contentWindow.PlaybookNoteEditor;await e.load(ch,cache.rate,{state:cfg.editor,key:P.key,scale:scales[P.scale]});return e.render().channels.map(c=>Float32Array.from(c));}finally{f.remove();}}
function sheet(mask){return 'Playbook Vocal Studio '+APP_VERSION+'\nTuning: Playbook Note Editor (after background cleaning)\nStage mask: '+mask+'\nOriginal tuner remains available.\n\nNote-editor settings:\n'+JSON.stringify(cfg.editor?.settings,null,2)+'\n\nCleaning and vocal-chain settings:\n'+JSON.stringify(Object.fromEntries(Object.entries(cache.P||{}).filter(([k])=>!['amount','drift','speed','expression','style'].includes(k))),null,2);}
async function dispatch(msg,transfer,raw){
 if(enabled()&&cache.tuned){
  if(msg.type==='sheet')return {sheet:sheet(msg.mask)};
  if(msg.type==='preview')throw Error('Use Find what needs improving to compare the new tuning stages. Smart Guide previews use the original tuner.');
  if(msg.type==='detail'&&msg.group<2)return earlyDetail(msg,raw);
  if(msg.type==='detail'||msg.type==='reference'){await chain(cache.tuned,cache.rate,cache.P);return post.send(msg);}
  if(msg.type==='beatfit'){await chain(cache.tuned,cache.rate,cache.P);await setPostBeat();return post.send(msg);}
  if(msg.type==='custom'){
   const base=await raw({type:'custom',mask:msg.mask&3,name:msg.name});let ch=base.audio[9];if(msg.mask&4)ch=(msg.mask&3)===3?cache.tuned:await alternate(ch,cache.P);
   const p=await chain(ch,cache.rate,cache.P,msg.mask),out=p.audio[9],m=matched([cache.final,out],cache.rate),l=measure(out,cache.rate);
   // Restore the effects context for subsequent detail/reference/beat comparisons.
   await chain(cache.tuned,cache.rate,cache.P);return {audio:{9:out},gains:m.gains,lufs:l.lufs??-100,sheet:sheet(msg.mask),savedSheet:sheet(msg.mask)};
  }
 }
 return decorate(await raw(msg,transfer),msg);
}
async function earlyDetail(msg,raw){
 const param=msg.group===0?'chRepairOn':'chRoomReduceOn',P=cache.P,outs=[],clean=[];
 try{for(const value of [0,1]){const r=await raw({type:'run',steps:[['set',param,value]],update:true,want:[1]});clean.push(r.audio[1]);const tuned=await alternate(r.audio[1],P),p=await chain(tuned,cache.rate,P);outs.push(p.audio[4]);}}
 finally{await raw({type:'run',steps:[['set',param,P[param]]],update:true,want:[]});await chain(cache.tuned,cache.rate,P);}
 const nc=Math.max(clean[0].length,clean[1].length),removed=Array.from({length:nc},(_,c)=>Float32Array.from(clean[0][c%clean[0].length],(v,i)=>v-(clean[1][c%clean[1].length][i]||0))),m=matched(outs,cache.rate);
 return {audio:{10:outs[0],11:outs[1],12:removed},gains:[...m.gains,Math.min(1,Math.pow(10,(-1-measure(removed,cache.rate).samplePeak)/20))]};
}
function syncBacking(){if(!api||typeof S==='undefined'||editorBeat===S.beat)return;editorBeat=S.beat;api.backing(S.beat?Array.from({length:S.beat.numberOfChannels},(_,c)=>S.beat.getChannelData(c)):null,S.beat?.sampleRate||S.rate);}
function openEditor(){showPage('tune');document.querySelector('[data-dock="notes"]')?.click();$('dockNotes').scrollIntoView({block:'start'});}
function edited(noise=false){if(!enabled())return;++revision;if(!noise)cfg.editor=api.state();error='';clearTimeout(timer);
 // With no editor vocal, there is no audio job to wait for.
 // Do not clear S.dirty here: another queued engine change may still own that flag.
 if(!S.main){appliedRevision=revision;ui();return;}
 S.dirty=true;ui();timer=setTimeout(()=>apply(),450);}
async function apply(){clearTimeout(timer);const rev=revision;if(!enabled()||!S.main)return;
 // Route the embedded key controls through the host's existing authoritative controls.
 const k=cfg.editor?.settings;if(k){const si=scales.indexOf(k.scale);for(const [id,v] of [['keySel',k.key],['scaleSel',si]])if(v>=0&&+$(id).value!==v){$(id).value=String(v);$(id).dispatchEvent(new Event('change'));}}
 await run(async()=>{if(rev!==revision)return;try{await exec([],true,[1,3,4]);if(rev===revision)S.dirty=false;readyStatus();persist();}catch(e){error=e.message;S.dirty=true;setStatus('Note editor: '+error,'warn');ui();}},true).catch(()=>{});
}
async function select(mode){if(!['note','original'].includes(mode)||processing||NoiseCleaner.locked()||S.busy||S.loading||rec)return;if(mode===cfg.mode)return;clearTimeout(timer);++revision;appliedRevision=revision;api?.stop();stopPlayback();window.SongStudio?.stopPlay();
 const before=cfg.mode;cfg.mode=mode;error='';S.dirty=false;ui();
 try{await run(async()=>{await exec([],true,[0,1,2,3,4,5]);readyStatus();persist();},true);if(mode==='original'){releaseEditor();post?.close();post=null;postInput='';postParams='';postResult=null;postBeat=null;}notice=mode==='original'?'Original tuner restored. Your note-editor edits are kept.':'Playbook Note Editor is active after noise removal.';}
 catch(e){cfg.mode=before;error=e.message;S.dirty=true;}ui();
}
function ui(){const n=enabled();if(!$('tunerChoice'))return;$('tunerChoice').value=cfg.mode;$('legacyTuneControls').hidden=n;$('legacyNoteControls').hidden=n;$('newNotePanel').hidden=!n;$('noteRouteHelp').hidden=!n;$('tunerChoice').disabled=processing||NoiseCleaner.locked()||typeof S!=='undefined'&&(S.busy||!!S.loading);$('noteRouteStatus').textContent=error?'Not applied: '+error+' Switch to Original tuner to continue.':processing?'Applying cleaned vocal → note editor → vocal effects…':notice||(n?'Noise removal → note editor → vocal effects. Changes apply automatically.':'Original tuner active. Note-editor edits are preserved.');$('noteRouteStatus').classList.toggle('warn',!!error);}
function install(){const tune=$('page-tune'),dock=$('dockNotes');const oldT=document.createElement('div');oldT.id='legacyTuneControls';oldT.append(...tune.childNodes);tune.append(oldT);const oldN=document.createElement('div');oldN.id='legacyNoteControls';oldN.append(...dock.childNodes);dock.append(oldN);const bar=document.createElement('div');bar.className='rack';bar.innerHTML='<label class="field"><span>VOCAL TUNER</span><select id="tunerChoice"><option value="note">Playbook Note Editor</option><option value="original">Original tuner — restore</option></select></label><p id="noteRouteStatus" role="status" aria-live="polite"></p><p id="noteRouteHelp">Edit individual notes below. Choose Snap all + Smooth 25% or 85% correction + Smooth 25% inside the editor, then adjust individual notes. Check the key shown there. Your cleaning and vocal-chain controls stay in their usual tabs.</p><button class="btn" id="noteRouteOpen">Open note editor</button>';
 tune.prepend(bar);const panel=document.createElement('div');panel.id='newNotePanel';dock.append(panel);$('tunerChoice').onchange=e=>select(e.target.value);$('noteRouteOpen').onclick=openEditor;ui();}
window.NoteTuner={begin,validate:valid,state,enabled,dispatch,apply,select,refreshNoise:()=>edited(true),stopAudition:()=>api?.stop(),pitchReview,notes:()=>cache.notes||[],tuning:trackNote,ui,locked:()=>processing||NoiseCleaner.locked()||(enabled()&&appliedRevision!==revision),pending:()=>enabled()&&appliedRevision!==revision,failed:()=>!!error||NoiseCleaner.failed(),review:()=>{openEditor();api?.reviewNext?.();},debug:()=>({mode:cfg.mode,processing,error,inputHash:loaded,postInput,rate:cache.rate,clean:cache.raw1,tuned:cache.tuned,final:cache.final,postState:postResult?.state})};
install();setInterval(()=>{ui();if(enabled())syncBacking();},350);
})();
