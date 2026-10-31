/* 0.30: reversible Studio Spectral stage before the Playbook Note Editor.
 * Native worker bytes and the native cleaner's chosen parameters stay intact. */
(function(){'use strict';
const $=id=>document.getElementById(id),clone=x=>structuredClone(x);
let cfg={...NoiseCore.defaults(),mode:'original'},client=null,seq=0,generation=0,jobs=new Map(),bypassed=false,busy=false,error='',notice='',cache=null,baseline=null,sourceAudio=null,rate=48000,undo=[],redo=[];
function active(){return cfg.mode==='studio'&&window.NoteTuner?.enabled();}
function state(){return clone(cfg);}
function begin(saved,fresh){generation++;cfg=saved?clone(NoiseCore.validate(saved)):{...NoiseCore.defaults(),mode:fresh?'studio':'original'};client?.terminate();client=null;for(const j of jobs.values()){clearTimeout(j.timer);j.reject(Error('Vocal changed.'));}jobs.clear();bypassed=false;busy=false;error='';notice='';cache=null;baseline=null;sourceAudio=null;undo=[];redo=[];ui();}
function worker(msg){if(!client){client=new Worker('noise-worker.js?v=0.31.1');client.onmessage=({data:m})=>{if(m.type==='progress'){$('noiseStatus').textContent='Reducing noise… '+Math.min(99,Math.round(m.value*100))+'%';return;}const j=jobs.get(m.id);if(!j)return;clearTimeout(j.timer);jobs.delete(m.id);m.error?j.reject(Error(m.error)):j.resolve(m);};client.onerror=e=>{for(const j of jobs.values()){clearTimeout(j.timer);j.reject(Error(e.message||'Noise processing stopped.'));}jobs.clear();client?.terminate();client=null;};}return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{jobs.delete(id);client?.terminate();client=null;reject(Error('Noise processing took too long. Restore the original cleaner to continue.'));},240000);jobs.set(id,{resolve,reject,timer});client.postMessage({...msg,id});});}
function wrap(r){if(r.state)r={...r,state:{...r.state,params:{...r.state.params,cleanOn:cfg.legacyOn}}};return r;}
async function render(ch,settings=cfg){const key=rate+':'+SongCore.hashPcm(ch)+':'+JSON.stringify(settings);if(cache?.key===key)return cache.result;const r=await worker({type:'process',channels:ch,rate,settings});NoteEditorSafety.audio(r.channels,rate);return { ...r,_key:key};}
async function dispatch(msg,transfer,raw){
 if(!active()){
  if(bypassed){await raw({type:'run',steps:[['set','cleanOn',cfg.legacyOn]],update:true,want:[]});bypassed=false;}
  error='';cache=null;baseline=null;sourceAudio=null;client?.terminate();client=null;ui();return raw(msg,transfer);
 }
 try{
  if(msg.type==='run'){
   // Restore the parameter before executing Undo/presets/settings, but render only
   // after bypassing native cleaning. This leaves its undo snapshots meaningful.
   if(bypassed)await raw({type:'run',steps:[['set','cleanOn',cfg.legacyOn]],update:false});
   const requested=await raw({...msg,update:false,want:[]},transfer);cfg.legacyOn=requested.state.params.cleanOn;
   const want=Array.from(new Set([...(msg.want||[]),...(msg.update?[0,1,2,5]:[])]));
   const r=await raw({type:'run',steps:[['set','cleanOn',0]],update:!!msg.update,want});bypassed=true;
   return msg.update||r.audio?.[1]?await finish(wrap(r)):wrap(r);
  }
  if(msg.type==='open'){
   // 0.31.4 adoption (R13): undo our bypass before opening, so the engine reports the singer's own Clean setting.
   // Otherwise a restore (settings first, then open) read back the bypassed 0 and lost a saved Clean = on.
   if(bypassed){await raw({type:'run',steps:[['set','cleanOn',cfg.legacyOn]],update:false});bypassed=false;}
   const opened=await raw(msg,transfer);cfg.legacyOn=opened.state.params.cleanOn;
   const r=await raw({type:'run',steps:[['set','cleanOn',0]],update:true,want:[0,1,2,3,4,5,6,100]});bypassed=true;
   return finish(wrap({...r,mask:(r.mask||0)|(opened.mask||0),audio:{...opened.audio,...r.audio}}));
  }
  if(msg.type==='custom'){
   const r=await raw(msg,transfer);if(msg.mask&1){const c=await render(r.audio[9]);r.audio[9]=c.channels;}return r;
  }
  return wrap(await raw(msg,transfer));
 }catch(e){error=e.message;S.dirty=true;throw e;}finally{busy=false;ui();}
}
async function finish(r){if(!r.audio?.[1])return r;busy=true;ui();rate=r.state.rate;baseline=r.audio[1];if(r.audio[5])sourceAudio=r.audio[5];
 const source=rate+':'+SongCore.hashPcm(sourceAudio||baseline)+':'+JSON.stringify([r.state.edits?.timing,r.state.edits?.comp]);
 // Store a bounded identity, never a second copy of the vocal.
 const id=rate+':'+SongCore.hashPcm([Float32Array.from(source,c=>c.charCodeAt(0))]);
 if(cfg.source&&cfg.source!==id){cfg.profile=null;notice='The source or timing changed. The previous noise profile was cleared; check the new sample.';undo=[];redo=[];}cfg.source=id;
 const result=await render(baseline);if(!cfg.profile&&result.profile){cfg.profile=result.profile;notice=result.report.reason;}
 cache={key:rate+':'+SongCore.hashPcm(baseline)+':'+JSON.stringify(cfg),result};error='';
 const removed=result.removed||baseline.map(c=>new Float32Array(c.length));return {...r,mask:(r.mask||0)|2,audio:{...r.audio,1:result.channels,2:removed}};
}
function mutate(patch,history=true){if(busy||typeof S==='undefined'||S.busy||S.loading)return false;const next=NoiseCore.validate({...clone(cfg),...patch});if(history){undo.push(state());if(undo.length>30)undo.shift();redo=[];}cfg=next;error='';cache=null;endLoop();stopPlayback();NoteTuner.refreshNoise();ui();return true;}
function profileJob(type){
 if(!active()||!baseline||busy||S.busy||S.dirty||NoteTuner.pending())return;
 const token=generation,input=baseline,sampleRate=rate,start=+$('noiseStart').value,end=+$('noiseEnd').value;busy=true;ui();
 return run(async()=>{
  if(token!==generation)return;setBusy(true);let result,failure;
  try{result=await worker({type,channels:input,rate:sampleRate,start,end});}catch(e){failure=e;}
  finally{if(token===generation){busy=false;setBusy(false);}}
  if(token!==generation)return;
  if(failure){notice=failure.message;ui();return;}
  if(result.profile){mutate({profile:result.profile});notice=type==='auto'?result.reason:'Learned this noise sample. Listen to Removed noise for words or sustained notes.';}
  else notice=result.reason;ui();
 });
}
function learn(){return profileJob('learn');}
function find(){return profileJob('auto');}
function history(dir){const from=dir<0?undo:redo,to=dir<0?redo:undo;if(!from.length||busy||S.busy)return;to.push(state());const next=from.pop();mutate(next,false);}
function sample(){if(!baseline)return;const a=+$('noiseStart').value,b=+$('noiseEnd').value;if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||b>baseline[0].length/rate){notice='Choose a sample inside the vocal.';ui();return;}let peak=0;for(const c of baseline)for(let i=Math.floor(a*rate);i<Math.ceil(b*rate);i++)peak=Math.max(peak,Math.abs(c[i]));const level=NoiseCore.rms(baseline,a*rate,b*rate),gain=Math.min(10**(24/20),10**(-24/20)/Math.max(1e-8,level),.89/Math.max(.001,peak));notice='Noise-sample audition gain: '+(20*Math.log10(gain)).toFixed(1)+' dB (playback only). Saved audio is unchanged.';playLoop(baseline,gain,a,b,{noBeat:true,noiseSample:true});ui();}
function ui(){if(!$('noiseChoice'))return;const n=active(),isNote=!!window.NoteTuner?.enabled(),locked=busy||(typeof S!=='undefined'&&(S.busy||!!S.loading));$('noiseChoice').value=isNote?cfg.mode:'original';$('noiseChoice').disabled=locked||!isNote;$('studioNoiseControls').hidden=!n;$('legacyNoiseControls').hidden=n;
 $('noiseStatus').textContent=!isNote?'Original tuner and original cleaner are active. Choose Playbook Note Editor to use Studio Spectral.':error?'Not applied: '+error+' Restore the original cleaner to continue.':busy?'Reducing background noise…':notice||(n?'Studio Spectral runs before tuning. Start gently, then compare.':'Original cleaner restored. Studio settings are kept.');$('noiseStatus').classList.toggle('warn',!!error);
 for(const [id,k] of [['noiseReduction','reduction'],['noiseSensitivity','sensitivity'],['noiseSmoothing','smoothing'],['noiseProtect','protect'],['noiseHighpass','highpass'],['noiseHum','hum']]){if(document.activeElement!==$(id))$(id).value=String(cfg[k]);$(id).disabled=locked;$('value'+id)?.replaceChildren(document.createTextNode(String(cfg[k])));}
 $('noiseEnabled').checked=cfg.on;$('noiseEnabled').disabled=locked;
 for(const id of ['noiseLearn','noiseFind','noiseSample','noiseClear'])$(id).disabled=locked||!baseline||(['noiseLearn','noiseFind'].includes(id)&&typeof S!=='undefined'&&(S.dirty||window.NoteTuner?.pending()));
 for(const b of document.querySelectorAll('[data-noise-preset]'))b.disabled=locked;
 $('noiseUndo').disabled=locked||!undo.length;$('noiseRedo').disabled=locked||!redo.length;
 const p=cfg.profile,r=cache?.result?.report;$('noiseProfile').textContent=p?(p.kind==='auto'?'Automatic':'Learned')+' sample: '+p.start.toFixed(2)+'–'+p.end.toFixed(2)+' s · '+p.noiseDb.toFixed(1)+' dBFS.':'No noise print yet. Automatic capture needs a clear pause without singing.';
 if(p&&document.activeElement!==$('noiseStart')&&document.activeElement!==$('noiseEnd')&&$('noiseStart').dataset.profile!==String(p.start)+':'+p.end){$('noiseStart').value=p.start.toFixed(3);$('noiseEnd').value=p.end.toFixed(3);$('noiseStart').dataset.profile=String(p.start)+':'+p.end;}
 $('noiseMeasured').textContent=r?(r.bypassed?r.reason:(Number.isFinite(r.reductionDb)?r.reductionDb.toFixed(1)+' dB reduction in the noise sample. ':'')+'This measures the sample, not vocal quality.'):'Compare BEFORE, CLEANED and REMOVED NOISE below.';
 if(n){$('noiseVerdict').textContent=p?'Noise profile ready — listen to check vocal detail.':'Noise profile needs review.';$('noiseBig').innerHTML=p?p.noiseDb.toFixed(1)+'<small>dBFS sample</small>':'—<small>noise sample</small>';$('humInfo').textContent=cfg.hum?cfg.hum+' Hz and four harmonics filtered. Check that low sung notes retain their body.':'Hum filtering is off until you choose 50 or 60 Hz.';}
}
function install(){const page=$('page-clean'),legacy=$('modeSeg').closest('.rack');legacy.id='legacyNoiseControls';const box=document.createElement('div');box.className='rack noise-studio';box.innerHTML=`<h2>Noise removal</h2><label class="field"><span>PROCESSOR</span><select id="noiseChoice"><option value="studio">Studio Spectral</option><option value="original">Original cleaner — restore</option></select></label><p id="noiseStatus" role="status" aria-live="polite"></p><div id="studioNoiseControls"><label class="switch"><input type="checkbox" id="noiseEnabled"> Enable noise removal</label><div class="row noise-presets"><button class="btn" data-noise-preset="gentle">Gentle · 6 dB</button><button class="btn" data-noise-preset="balanced">Balanced · 10 dB</button><button class="btn" data-noise-preset="strong">Strong · 15 dB</button></div><p class="note">Starting points for steady hiss, fans and room noise. Stronger reduction can affect quiet singing. This is not voice/music separation.</p><h3>Learn the background</h3><p id="noiseProfile" class="note"></p><div class="grid2"><label class="field"><span>START (SECONDS)</span><input id="noiseStart" type="number" min="0" step="0.01" value="0"></label><label class="field"><span>END (SECONDS)</span><input id="noiseEnd" type="number" min="0.2" step="0.01" value="0.4"></label></div><div class="row"><button class="btn" id="noiseAtPlayhead">Start at playhead</button><button class="btn" id="noiseSample">Listen to sample</button><button class="btn" id="noiseStop">Stop</button></div><div class="row"><button class="btn primary" id="noiseLearn">Learn selected noise</button><button class="btn" id="noiseFind">Find quiet sample</button><button class="btn" id="noiseClear">Reset profile</button></div><p class="note">Choose 0.2–10 seconds with no singing, words or music. Listen before learning. A wrong noise print can remove your voice.</p><label class="noise-range">Maximum reduction <output id="valuenoiseReduction"></output> dB<input id="noiseReduction" type="range" min="0" max="18" step="0.5"></label><details><summary>Vocal protection &amp; filters</summary><label class="noise-range">Noise threshold <output id="valuenoiseSensitivity"></output> dB<input id="noiseSensitivity" type="range" min="-6" max="6" step="0.5"></label><p class="note">Raise only if noise remains. Lower it if quiet vocal detail disappears.</p><label class="noise-range">Frequency smoothing <output id="valuenoiseSmoothing"></output><input id="noiseSmoothing" type="range" min="0" max="6" step="1"></label><label class="noise-range">Keep attacks &amp; endings <output id="valuenoiseProtect"></output><input id="noiseProtect" type="range" min="0" max="1" step="0.05"></label><label class="noise-range">Rumble high-pass <output id="valuenoiseHighpass"></output> Hz<input id="noiseHighpass" type="range" min="0" max="120" step="5"></label><label class="field"><span>ELECTRICAL HUM</span><select id="noiseHum"><option value="0">Off — preserve low notes</option><option value="50">50 Hz + harmonics</option><option value="60">60 Hz + harmonics</option></select></label></details><div class="row"><button class="btn" id="noiseUndo">Undo cleaning</button><button class="btn" id="noiseRedo">Redo cleaning</button></div><p id="noiseMeasured" class="note" role="status"></p></div>`;page.insertBefore(box,legacy);
 $('noiseChoice').onchange=e=>mutate({mode:e.target.value});$('noiseEnabled').onchange=e=>mutate({on:e.target.checked});
 for(const [id,k] of [['noiseReduction','reduction'],['noiseSensitivity','sensitivity'],['noiseSmoothing','smoothing'],['noiseProtect','protect'],['noiseHighpass','highpass'],['noiseHum','hum']]){$(id).oninput=e=>$('value'+id)?.replaceChildren(document.createTextNode(e.target.value));$(id).onchange=e=>mutate({[k]:+e.target.value});}
 const presets={gentle:{reduction:6,sensitivity:0,smoothing:2,protect:.85},balanced:{reduction:10,sensitivity:0,smoothing:3,protect:.85},strong:{reduction:15,sensitivity:1,smoothing:4,protect:.9}};for(const b of document.querySelectorAll('[data-noise-preset]'))b.onclick=()=>mutate({...presets[b.dataset.noisePreset],on:true});
 $('noiseLearn').onclick=learn;$('noiseFind').onclick=find;$('noiseSample').onclick=sample;$('noiseStop').onclick=()=>{endLoop();stopPlayback();};$('noiseClear').onclick=()=>mutate({profile:null});$('noiseAtPlayhead').onclick=()=>{const a=Math.max(0,currentPos());$('noiseStart').value=a.toFixed(2);$('noiseEnd').value=Math.min(a+.4,baseline?.[0]?.length/rate||a+.4).toFixed(2);};$('noiseUndo').onclick=()=>history(-1);$('noiseRedo').onclick=()=>history(1);ui();
}
window.NoiseCleaner={begin,state,validate:NoiseCore.validate,active,dispatch,mutate,learn,find,history,ui,failed:()=>!!error,locked:()=>busy,debug:()=>({baseline,result:cache?.result,error,bypassed,rate})};install();setInterval(ui,350);
})();
