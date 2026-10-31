/* Playbook Vocal Studio 0.25.0. Pure multitrack model and render functions.
 * Audio arrays are immutable. History clones metadata and shares audio arrays.
 * Sections are navigation markers. Regions are independent, ordered replacements
 * within ONE track. Tracks are summed; takes within a region are alternatives.
 * No engine/WASM dependency. See tests-0.20/core.test.cjs. */
(function(root){
'use strict';
const LIMITS=Object.freeze({seconds:900,recordSeconds:600,tracks:8,sections:128,regions:256,takes:128,perRegion:32,bytes:256*1024*1024});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function number(x,a,b,name){if(!Number.isFinite(x)||x<a||x>b)throw Error('Invalid '+name+'.');return x;}
function label(s,fallback){return String(s||fallback).trim().slice(0,100)||fallback;}
function id(w,prefix){return prefix+(w.nextId++);}
function empty(rate=48000){return {v:1,uid:Math.random().toString(36).slice(2)+Date.now().toString(36),title:'My song',rate,nextId:2,revision:0,tracks:[{id:'v1',name:'Lead vocal',gainDb:0,pan:0,mute:false,solo:false,regions:[]}],sections:[],sources:{},activeTrack:'v1',selectedRegion:null,cursor:0,range:null,lead:2,fadeMs:20,masterDb:-6,appliedSig:null};}
function clone(w){return {...w,referenceGuide:w.referenceGuide?structuredClone(w.referenceGuide):undefined,range:w.range?.slice()||null,sections:w.sections.map(s=>({...s})),sources:{...w.sources},tracks:w.tracks.map(t=>({...t,levelMoves:t.levelMoves?.map(m=>({...m})),regions:t.regions.map(r=>({...r,takes:r.takes.map(a=>({...a}))}))}))};}
function range(a,b){number(a,0,LIMITS.seconds-.04,'start');number(b,a+.04,LIMITS.seconds,'end');}
function roomSeconds(w){const u=usage(w);return Math.max(0,(LIMITS.bytes-u.bytes)/(w.rate*4));}
function usage(w){let bytes=0,seconds=0,takes=0;for(const s of Object.values(w.sources)){bytes+=s.channels.reduce((n,c)=>n+c.byteLength,0);seconds+=s.channels[0].length/s.rate;}for(const t of w.tracks)for(const r of t.regions)takes+=r.kind==='legacy-base'?0:r.takes.length;return {bytes,seconds,takes};}
function track(w,id=w.activeTrack){return w.tracks.find(t=>t.id===id);}
function region(w,id=w.selectedRegion){return track(w)?.regions.find(r=>r.id===id);}
function origin(t){return t.origin+(t.offsetMs||0)/1000;}
// 0.22.0: a take may be trimmed (seconds cut from its start/end) and faded (ms).
function takeSpan(w,t){const s=w.sources[t.source],o=Math.round(origin(t)*w.rate),n=s?s.channels[0].length:0,a=Math.round((t.trimIn||0)*w.rate),b=Math.round((t.trimOut||0)*w.rate);return [o+a,o+Math.max(a,n-b)];}
function covers(w,t,r){if(!w.sources[t.source])return false;const [lo,hi]=takeSpan(w,t);return lo<=Math.round(r.start*w.rate)&&hi>=Math.round(r.end*w.rate);}
function trackEnd(t){return Math.max(1,...t.regions.filter(r=>r.selected).map(r=>r.end));}
// 0.24 (F1/F3): a vocal's POLISH is valid only for the exact audio it was made from. The signature is
// a hash of the rendered lane (every sample), so every audio-affecting edit (trim, fade, gain, offset,
// replacement) is detected, and a split that leaves the audio unchanged keeps POLISH valid. Hashes are
// cached by layout (sources are immutable). Checking validity has no side effects.
function layoutSig(w,t){return JSON.stringify([w.rate,w.fadeMs,t.regions.filter(r=>r.selected).map(r=>{const a=r.takes.find(a=>a.id===r.selected);return [r.start,r.end,r.fadeMs,a.id,a.source,a.origin,a.offsetMs,a.gainDb,a.trimIn||0,a.trimOut||0,a.fadeIn||0,a.fadeOut||0];})]);}
function hashPcm(ch){let h=0x811c9dc5|0,g=0x01000193|0;h=Math.imul(h^ch.length,16777619);for(const c of ch){const u=new Uint32Array(c.buffer,c.byteOffset,c.length);h=Math.imul(h^u.length,16777619);for(let i=0;i<u.length;i++){h=Math.imul(h^u[i],16777619);g=Math.imul(g+u[i]|0,2654435761)^(g>>>13);}}return (h>>>0).toString(16)+(g>>>0).toString(16);}
const SIGMEMO=new Map(),SRCID=new WeakMap();let srcN=0;const srcTok=s=>{const c=s?.channels?.[0];if(!c)return 0;if(!SRCID.has(c))SRCID.set(c,++srcN);return SRCID.get(c);};
function trackSignature(w,t){const key=t.regions.some(r=>r.selected)?layoutSig(w,t)+'|'+t.regions.filter(r=>r.selected).map(r=>srcTok(w.sources[r.takes.find(a=>a.id===r.selected).source])).join(','):'';if(!key)return 'pcm1:empty';if(SIGMEMO.has(key))return SIGMEMO.get(key);const s='pcm1:'+w.rate+':'+hashPcm(renderTrack(w,t,{end:trackEnd(t)}));if(SIGMEMO.size>64)SIGMEMO.delete(SIGMEMO.keys().next().value);SIGMEMO.set(key,s);return s;}
function oldPad(sig){try{const o=JSON.parse(sig);if(!Array.isArray(o)||!Array.isArray(o[2]))return null;return JSON.stringify([o[0],o[1],o[2].map(r=>r.length===8?r.concat([0,0,0,0]):r)]);}catch(e){return null;}}
// Called once when a song is loaded: converts signatures saved by 0.20–0.23 (layout lists) into audio hashes.
// 0.25 (R3): there is NO tolerance zone. The saved POLISH input must equal, sample for sample, either the
// current render or the exact 0.20–0.23 render (renderTrackLegacy23) of the CURRENT choices. Anything else
// stays stale. Projects converted from 0.18 (no saved input audio) need the exact saved layout.
function samePcm(a,b){if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;for(let c=0;c<a.length;c++){const x=a[c],y=b[c];if(!x||!y||x.length!==y.length)return false;for(let i=0;i<x.length;i++)if(x[i]!==y[i]&&!(x[i]!==x[i]&&y[i]!==y[i]))return false;}return true;}
// The renderer of 0.20–0.23, kept ONLY to prove a legacy POLISH input is unchanged (fade on both sides of every range).
function renderTrackLegacy23(w,t,{start=0,end}){
 const first=Math.round(start*w.rate),last=Math.round(end*w.rate),n=Math.max(1,last-first);
 const nc=Math.max(1,...t.regions.flatMap(r=>r.takes.map(a=>w.sources[a.source].channels.length))),out=Array.from({length:nc},()=>new Float32Array(n));
 for(const r of t.regions){const a=r.takes.find(a=>a.id===r.selected);if(!a)continue;const s=w.sources[a.source],o=Math.round(origin(a)*w.rate),[ts,te]=takeSpan(w,a),fi=Math.round((a.fadeIn||0)*w.rate/1000),fo=Math.round((a.fadeOut||0)*w.rate/1000),rs=Math.round(r.start*w.rate),re=Math.round(r.end*w.rate),lo=Math.max(first,rs,ts),hi=Math.min(last,re,te),fade=Math.min(Math.round((r.fadeMs??w.fadeMs)*w.rate/1000),Math.floor((re-rs)/4)),g=Math.pow(10,(a.gainDb||0)/20);
  for(let i=lo;i<hi;i++){const m=fade?clamp(Math.min(i-rs,re-1-i)/fade,0,1):1,e=(fi?clamp((i-ts)/fi,0,1):1)*(fo?clamp((te-1-i)/fo,0,1):1);for(let c=0;c<nc;c++){const x=i-first;out[c][x]=out[c][x]*(1-m)+s.channels[Math.min(c,s.channels.length-1)][i-o]*g*e*m;}}}
 return out;}
function migrationProof(w,t){const p=t.polish,pcm=p?.session?.pcm;if(!t.regions.some(x=>x.selected))return false;
 if(Array.isArray(pcm)&&pcm.length&&pcm[0]?.length!=null){const end=trackEnd(t);return samePcm(pcm,renderTrack(w,t,{end}))||samePcm(pcm,renderTrackLegacy23(w,t,{end}));}
 return oldPad(p.sourceSig)===layoutSig(w,t);}
function normalizeSigs(w){for(const t of w.tracks){const p=t.polish;if(!p||typeof p.sourceSig!=='string'||p.sourceSig.startsWith('pcm1:')||p.sourceSig.startsWith('stale:')||p.sourceSig==='legacy')continue;
 p.sourceSig=migrationProof(w,t)?trackSignature(w,t):'stale:'+p.sourceSig;}return w;}
// 0.24 (F4): one song key. A polished vocal whose TUNE key differs from the song key needs a settings
// update (its notes and effects are kept) unless the vocal is set to keep its own key.
function polishKey(t){const P=t.polish?.session?.P;return P&&Number.isFinite(P.key)?{key:P.key,scale:Number.isFinite(P.scale)?P.scale:0}:null;}
// 0.25 (R4): THE key a vocal must be tuned to. Song key, unless the vocal keeps its own key (then its saved own
// key, or the key it was polished in). Both directions of key sync and keyStale use only this function.
// 0.25 (R2): the explicit, user-chosen mono version of a stereo lane for POLISH (originals untouched).
function monoMix(ch){if(ch.length<2)return ch[0];const m=new Float32Array(ch[0].length);for(let i=0;i<m.length;i++)m[i]=(ch[0][i]+ch[1][i])/2;return m;}
function songKeyOf(w){return {key:Number.isInteger(w?.key)?w.key:0,scale:Number.isInteger(w?.scale)?w.scale:1};}
function wantedKey(w,t){const p=t?.polish;if(p?.ownKey){if(Number.isInteger(p.key))return {key:p.key,scale:Number.isInteger(p.scale)?p.scale:0};const k=polishKey(t);if(k)return k;}return songKeyOf(w);}
function keyStale(w,t){if(!t.polish||t.polish.bypass)return false;if(w.key==null&&!t.polish.ownKey)return false;const k=polishKey(t);if(!k)return false;const want=t.polish.ownKey?wantedKey(w,t):{key:w.key,scale:w.scale??0};return k.key!==want.key||k.scale!==want.scale;}
// 0.25 (R6): ONE validated PCM boundary. Every accepted POLISH result and every written WAV goes through
// acceptPcm; non-finite samples (NaN/Infinity) are rejected. Results are memoised per (immutable) array.
const FINITE=new WeakMap();
function pcmFinite(ch){if(!Array.isArray(ch)||!ch.length)return false;const n=ch[0]?.length;for(const c of ch){if(!(c instanceof Float32Array)||c.length!==n)return false;let v=FINITE.get(c);if(v===undefined){v=true;for(let i=0;i<c.length;i++){const x=c[i];if(x-x!==0){v=false;break;}}FINITE.set(c,v);}if(!v)return false;}return true;}
function acceptPcm(ch,what='This audio'){if(!pcmFinite(ch))throw Object.assign(Error(what+' contains invalid samples (not-a-number or infinite values). It was not accepted; your recordings and the last good version are kept.'),{code:'nonfinite'});return ch;}
// 0.25 (R1): POLISH capacity is a property of ONE lane: only the open editor is resident in the engine;
// completed lanes keep their final render (saved to browser storage once). plan() runs BEFORE the engine is touched.
// Measured 0.25: the engine returns NaN/Infinity for sessions below 22.05 kHz (tests-0.25/rateprobe.py), and runs out of
// memory near the previous 3-minute stereo limit. 0.29 uses a verified conservative
// 8,000,000-frame ceiling after a 179-second/48 kHz native-chain failure.
// Both limits are checked here, outside the unchanged engine.
const ENGINE=Object.freeze({bytes:256*1024*1024,stereoFrames:8000000,minRate:22050});
function polishPlan(w,t){const nc0=Math.max(1,...t.regions.filter(r=>r.selected).flatMap(r=>r.takes.map(a=>w.sources[a.source]?.channels.length||1))),mono=!!t.polishMono&&nc0===2,nc=mono?1:nc0,frames=Math.round(trackEnd(t)*w.rate),needed=(frames*nc+(frames+10*w.rate)*2)*4;
 const out={nc:nc0,inputChannels:nc,mono,frames,needed,budget:ENGINE.bytes,ok:true,reason:'',canMono:false};
 if(!t.regions.some(r=>r.selected))return {...out,ok:false,reason:'Choose a take on this vocal first.'};
 if(w.rate<ENGINE.minRate){out.ok=false;out.reason='POLISH works at 22,050 Hz or higher; this song is '+w.rate+' Hz (the processor produces invalid audio below that). Recording, choosing takes, playback and dry export still work.';}
 else if(nc===2&&frames>ENGINE.stereoFrames){out.ok=false;out.canMono=true;out.reason='This stereo vocal exceeds the POLISH stereo limit of '+(ENGINE.stereoFrames/w.rate/60).toFixed(2)+' minutes at '+w.rate.toLocaleString()+' Hz.';}
 else if(needed>ENGINE.bytes){out.ok=false;out.reason='This vocal is too long for POLISH in one piece ('+(needed/1048576).toFixed(0)+' MB needed, '+(ENGINE.bytes/1048576)+' MB available for one vocal).';}
 return out;}
function pcmChannelsOk(w,t){const p=t.polish;if(!p)return false;const want=polishPlan(w,t).inputChannels,pc=p.session?.pcm;const n=Array.isArray(pc)?pc.length:pc?.nch;return n==null||n===want;}
// 0.25 (R5): the small, user-chosen POLISH preferences of a vocal. Journalled separately from audio.
const POLISH_PREFS=['bypass','ownKey','key','scale'];
function polishPrefs(p){const o={};for(const k of POLISH_PREFS)if(p&&p[k]!==undefined)o[k]=p[k];return o;}
function validPrefs(o){return !!o&&typeof o==='object'&&Object.entries(o).every(([k,v])=>POLISH_PREFS.includes(k)&&(['key','scale'].includes(k)?Number.isInteger(v)&&v>=0&&v<=11:typeof v==='boolean'));}
function polishValid(w,t){return !!(t.polish&&!t.polish.recoveryMissing&&t.polish.sourceSig===trackSignature(w,t)&&t.polish.rate===w.rate&&t.polish.channels?.length&&pcmChannelsOk(w,t)&&pcmFinite(t.polish.channels));}
// 0.25 (UX 1): full-song readiness, one line per vocal lane.
function readiness(w){const lanes=w.tracks.filter(t=>t.regions.some(r=>r.selected)).map(t=>{const pl=polishPlan(w,t);let state,text;
  if(t.polish?.bypass){state='dry';text='dry vocal (your choice)';}
  else if(polishValid(w,t)&&!keyStale(w,t)){state='ready';text='polished';}
  else if(!pl.ok){state='blocked';text=pl.reason;}
  else if(t.polish&&polishValid(w,t)){state='key';text='key update needed';}
  else if(t.polish){state='update';text='needs update';}
  else {state='todo';text='not polished yet';}
  return {id:t.id,name:t.name,state,text,ok:pl.ok};});
 const todo=lanes.filter(l=>['todo','update','key'].includes(l.state)).length,blocked=lanes.filter(l=>l.state==='blocked').length;
 return {lanes,total:lanes.length,ready:lanes.filter(l=>l.state==='ready'||l.state==='dry').length,todo,blocked,canFinish:!blocked};}
function duration(w){return Math.max(1,...w.sections.map(s=>s.end),...w.tracks.flatMap(t=>t.regions.map(r=>r.end)),...w.tracks.map(t=>polishValid(w,t)&&!t.polish.bypass?t.polish.channels[0].length/w.rate:0));}
function validate(w){
 if(!w||w.v!==1||!Array.isArray(w.tracks)||!w.tracks.length||w.tracks.length>LIMITS.tracks||!Array.isArray(w.sections)||w.sections.length>LIMITS.sections||!w.sources||typeof w.sources!=='object')throw Error('Invalid song workspace.');
 if(w.referenceGuide){const RC=root.ReferenceCore||(typeof require==='function'?require('./reference-core.js'):null);if(!RC)throw Error('Reference profile support did not load.');RC.validate(w.referenceGuide);}
 number(w.rate,8000,192000,'song sample rate');number(w.nextId,1,1e9,'identity');number(w.cursor,0,LIMITS.seconds,'playhead');number(w.lead,0,5,'lead-in');number(w.fadeMs,0,100,'join fade');number(w.masterDb,-36,6,'master level');
 if(w.meter!=null&&!METERS.includes(w.meter))throw Error('Invalid time signature.');if(w.countIn!=null&&![0,1,2].includes(w.countIn))throw Error('Invalid count-in.');if(w.clickVol!=null)number(w.clickVol,0,1,'click volume');if(w.key!=null&&!(Number.isInteger(w.key)&&w.key>=0&&w.key<=11))throw Error('Invalid key.');if(w.scale!=null&&!(Number.isInteger(w.scale)&&w.scale>=0&&w.scale<=6))throw Error('Invalid scale.');if(w.backing!=null&&typeof w.backing!=='boolean')throw Error('Invalid backing switch.');
 if(w.range)range(...w.range);const ids=new Set(),seen=x=>{if(typeof x!=='string'||!/^[-_a-zA-Z0-9]+$/.test(x)||ids.has(x))throw Error('Duplicate or invalid song identity.');ids.add(x);};
 for(const [key,s] of Object.entries(w.sources)){
  seen(key);if(!s||s.rate!==w.rate||!Array.isArray(s.channels)||!s.channels.length||s.channels.length>2)throw Error('Invalid source audio.');
  const n=s.channels[0].length;if(!n||n>(LIMITS.seconds+10)*w.rate||s.channels.some(c=>!(c instanceof Float32Array)||c.length!==n))throw Error('Invalid source length.');
  // Full sample validation is performed at import/capture; immutable arrays are
  // trusted here so a history action does not scan 128 MB on the UI thread.
 }
 let nr=0;
 for(const t of w.tracks){seen(t.id);validateMoves(t);number(t.gainDb,-36,12,'track level');if(t.polishMono!=null&&typeof t.polishMono!=='boolean')throw Error('Invalid mono choice.');number(t.pan,-1,1,'track pan');if(!Array.isArray(t.regions))throw Error('Invalid recording regions.');
  for(const r of t.regions){seen(r.id);nr++;range(r.start,r.end);if(r.fadeMs!=null)number(r.fadeMs,0,100,'range fade');if(!Array.isArray(r.takes)||r.takes.length>LIMITS.perRegion)throw Error('Up to 32 attempts for one recording range.');
   const tids=new Set();for(const a of r.takes){seen(a.id);tids.add(a.id);if(!Object.hasOwn(w.sources,a.source))throw Error('Missing recording audio.');number(a.origin,-10,LIMITS.seconds,'take position');number(a.offsetMs||0,-500,500,'take alignment');number(a.gainDb||0,-36,24,'take gain');number(a.trimIn||0,0,LIMITS.seconds,'take trim');number(a.trimOut||0,0,LIMITS.seconds,'take trim');number(a.fadeIn||0,0,5000,'take fade');number(a.fadeOut||0,0,5000,'take fade');if(a.rating!=null&&![0,1,2,3,4,5].includes(a.rating))throw Error('Invalid take rating.');const sp=takeSpan(w,a);if(sp[1]-sp[0]<1)throw Error('A take cannot be trimmed to nothing.');}
   if(r.selected&&!tids.has(r.selected))throw Error('Chosen take is missing.');if(r.reference&&!tids.has(r.reference))throw Error('Reference take is missing.');if(r.selected&&!covers(w,r.takes.find(a=>a.id===r.selected),r))throw Error('Chosen take does not cover its recording range.');
  }
 }
 if(nr>LIMITS.regions)throw Error('This song has reached 256 recording ranges.');
 for(const s of w.sections){seen(s.id);range(s.start,s.end);}
 if(!track(w))throw Error('The recording track is missing.');
 const u=usage(w);if(u.takes>LIMITS.takes||u.bytes>LIMITS.bytes)throw Error('The song has reached 128 takes or 256 MB of vocal audio (about 23 minutes of mono recording). Back up and remove unused takes to make room.');
 return w;
}
function checkAudio(channels,rate){number(rate,8000,192000,'source sample rate');if(!Array.isArray(channels)||channels.length<1||channels.length>2||!channels[0]?.length)throw Error('Use mono or stereo audio.');const n=channels[0].length;for(const c of channels){if(!(c instanceof Float32Array)||c.length!==n)throw Error('Invalid audio channels.');for(const x of c)if(!Number.isFinite(x))throw Error('The recording contains invalid audio samples.');}}
function addTrack(w,name){if(w.tracks.length>=LIMITS.tracks)throw Error('Up to 8 vocal tracks per song.');const t={id:id(w,'v'),name:label(name,'Backing vocal '+w.tracks.length),gainDb:0,pan:0,mute:false,solo:false,regions:[]};w.tracks.push(t);w.activeTrack=t.id;w.selectedRegion=null;return t;}
function addSection(w,name,a,b){range(a,b);if(w.sections.length>=LIMITS.sections)throw Error('Up to 128 song sections.');if(w.sections.some(s=>a<s.end&&b>s.start))throw Error('Sections cannot overlap. Adjust the start or end so they meet or leave a gap.');const s={id:id(w,'s'),name:label(name,'Section'),start:a,end:b};w.sections.push(s);w.sections.sort((a,b)=>a.start-b.start);return s;}
function findRange(t,a,b){return [...t.regions].reverse().find(r=>Math.abs(r.start-a)<.5e-6&&Math.abs(r.end-b)<.5e-6);}
function addTake(w,{trackId=w.activeTrack,regionId=null,start,end,channels,rate=w.rate,origin:at=start,name='Take',choose=false,kind='record'}){
 range(start,end);checkAudio(channels,rate);if(rate!==w.rate)throw Error('Resample audio before adding it.');const t=track(w,trackId);if(!t)throw Error('Select a vocal track.');
 let r=regionId?t.regions.find(x=>x.id===regionId):null;if(regionId&&!r)throw Error('The recording range no longer exists.');
 if(r&&r.takes.length>=LIMITS.perRegion)throw Error('This range has 32 attempts. Back up and remove unused attempts first.');
 const u=usage(w),bytes=channels.reduce((n,c)=>n+c.byteLength,0);if(u.takes>=LIMITS.takes||u.bytes+bytes>LIMITS.bytes)throw Error('Not enough vocal storage. Back up and remove unused takes first.');
 if(!r){if(w.tracks.reduce((n,t)=>n+t.regions.length,0)>=LIMITS.regions)throw Error('This song has reached 256 recording ranges.');r={id:id(w,'r'),name:kind==='fix'?'Phrase fix':kind==='punch'?'Punch-in':kind==='loop'?'Loop':'Recording',kind,start,end,selected:null,takes:[]};t.regions.push(r);}
 const source=id(w,'a');w.sources[source]={rate,channels};const take={id:id(w,'t'),name:label(name==='Take'?'Take '+(Math.max(r.sequence||0,r.takes.length)+1):name,'Take'),source,origin:at,offsetMs:0,gainDb:0};r.sequence=Math.max(r.sequence||0,r.takes.length)+1;r.takes.push(take);
 if(choose&&covers(w,take,r))r.selected=take.id;w.activeTrack=t.id;w.selectedRegion=r.id;return {region:r,take};
}
function choose(w,r,takeId){const a=r.takes.find(t=>t.id===takeId);if(takeId&&(!a||!covers(w,a,r)))throw Error('This attempt ended early. Record the full selected range before choosing it.');r.selected=takeId||null;if(takeId){const tr=w.tracks.find(x=>x.regions.includes(r));if(tr&&tr.regions[tr.regions.length-1]!==r){tr.regions.splice(tr.regions.indexOf(r),1);tr.regions.push(r);}}}
function gc(w){const used=new Set(w.tracks.flatMap(t=>t.regions.flatMap(r=>r.takes.map(a=>a.source))));for(const k of Object.keys(w.sources))if(!used.has(k))delete w.sources[k];}
function selectedCount(w){return w.tracks.reduce((n,t)=>n+t.regions.filter(r=>r.selected).length,0);}
// Render only the requested interval, at the song's sample rate. Later chosen
// regions replace earlier ones on this track with complementary (sum=1) fades.
function renderTrack(w,t,{start=0,end=duration(w),override=null,exclude=null}={}){
 const first=Math.round(start*w.rate),last=Math.round(end*w.rate),n=Math.max(1,last-first);
 const nc=Math.max(1,...t.regions.flatMap(r=>r.takes.map(a=>w.sources[a.source].channels.length))),out=Array.from({length:nc},()=>new Float32Array(n));
 // 0.24 (F2): an auditioned take is played on top within its own range; the saved order is untouched.
 let list=t.regions.map(r=>{const selected=override?.regionId===r.id?override.takeId:r.selected,a=r.takes.find(a=>a.id===selected);return a?{r,a}:null;}).filter(Boolean);
 if(override){const k=list.findIndex(x=>x.r.id===override.regionId);if(k>=0)list.push(list.splice(k,1)[0]);}
 for(const x of list){const {r,a}=x;x.rs=Math.round(r.start*w.rate);x.re=Math.round(r.end*w.rate);x.o=Math.round(origin(a)*w.rate);[x.ts,x.te]=takeSpan(w,a);x.fade=Math.min(Math.round((r.fadeMs??w.fadeMs)*w.rate/1000),Math.floor((x.re-x.rs)/4));x.fadeS=x.fade;x.fadeE=x.fade;x.lo=x.rs;x.hi=x.re;}
 // 0.24 (F3): where two chosen ranges meet exactly, a seam inside the same continuous recording plays
 // sample-for-sample as if unsplit (no fades); a seam between different audio is a true crossfade:
 // the range rendered first continues past the seam (its recording's handle), the later one fades over it.
 const same=(p,q)=>p.a.source===q.a.source&&p.o===q.o&&(p.a.gainDb||0)===(q.a.gainDb||0)&&!(p.a.fadeOut)&&!(q.a.fadeIn)&&p.te>=p.re&&q.ts<=q.rs;
 for(let i=0;i<list.length;i++)for(let j=0;j<list.length;j++){if(i===j)continue;const p=list[i],q=list[j];if(p.re!==q.rs)continue;
  if(same(p,q)){p.fadeE=0;q.fadeS=0;continue;}
  if(i<j){const ext=Math.min(q.fadeS,Math.max(0,p.te-p.re));if(ext>0){p.hi=p.re+ext;p.fadeE=0;}}
  else{const ext=Math.min(p.fadeE,Math.max(0,q.rs-q.ts));if(ext>0){q.lo=q.rs-ext;q.fadeS=0;}}}
 for(const x of list){const {a}=x,s=w.sources[a.source],fi=Math.round((a.fadeIn||0)*w.rate/1000),fo=Math.round((a.fadeOut||0)*w.rate/1000),lo=Math.max(first,x.lo,x.ts),hi=Math.min(last,x.hi,x.te),g=Math.pow(10,(a.gainDb||0)/20);
  for(let i=lo;i<hi;i++){const ms=x.fadeS?clamp((i-x.rs)/x.fadeS,0,1):1,me=x.fadeE?clamp((x.re-1-i)/x.fadeE,0,1):1,m=Math.min(ms,me),e=(fi?clamp((i-x.ts)/fi,0,1):1)*(fo?clamp((x.te-1-i)/fo,0,1):1);if(!m)continue;for(let c=0;c<nc;c++){const y=i-first;out[c][y]=out[c][y]*(1-m)+s.channels[Math.min(c,s.channels.length-1)][i-x.o]*g*e*m;}}
 }
 if(exclude){const lo=Math.max(first,Math.round(exclude[0]*w.rate)),hi=Math.min(last,Math.round(exclude[1]*w.rate));for(const c of out)c.fill(0,Math.max(0,lo-first),Math.max(0,hi-first));}
 return out;
}
// Processed lanes stay anchored at song time zero. Auditioning an alternative
// uses the dry comp on that lane; other lanes retain their processing.
// Phrase volume is a mix-stage envelope: it never changes POLISH input/signatures.
function validateMoves(t){if(t.levelMoves==null)return;if(!Array.isArray(t.levelMoves)||t.levelMoves.length>128)throw Error('Up to 128 phrase-volume moves per track.');let end=-1;const ids=new Set();for(const m of t.levelMoves){if(typeof m.id!=='string'||ids.has(m.id))throw Error('Invalid phrase-volume identity.');ids.add(m.id);range(m.start,m.end);number(m.db,-12,12,'phrase level');number(m.fadeMs,10,500,'phrase transition');if(m.start<end)throw Error('Phrase-volume moves cannot overlap. Edit or remove the existing move.');end=m.end;}}
function levelDbAt(t,time){for(const m of t.levelMoves||[]){if(time<m.start)break;if(time<m.end){const fade=Math.min(m.fadeMs/1000,(m.end-m.start)/2),x=clamp(Math.min(time-m.start,m.end-time)/fade,0,1);return m.db*x;}}return 0;}
function setLevelMove(w,t,{id:mid=null,start,end,db,fadeMs=80}){const moves=(t.levelMoves||[]).filter(m=>m.id!==mid).map(m=>({...m}));if(mid&&!(t.levelMoves||[]).some(m=>m.id===mid))throw Error('That phrase-volume move no longer exists.');moves.push({id:mid||id(w,'lv'),start,end,db,fadeMs});moves.sort((a,b)=>a.start-b.start);validateMoves({levelMoves:moves});t.levelMoves=moves;}
function applyLevelMoves(ch,t,rate,start){if(!t.levelMoves?.length)return ch;for(const m of t.levelMoves){const lo=Math.max(0,Math.ceil((m.start-start)*rate)),hi=Math.min(ch[0].length,Math.ceil((m.end-start)*rate)),fade=Math.min(m.fadeMs/1000,(m.end-m.start)/2);for(let i=lo;i<hi;i++){const time=start+i/rate,x=clamp(Math.min(time-m.start,m.end-time)/fade,0,1),g=Math.pow(10,m.db*x/20);for(const c of ch)c[i]*=g;}}return ch;}
function renderVoice(w,t,options={}){
 const {start=0,end=duration(w),override=null,exclude=null,processed=true}=options;
 const finish=ch=>options.automation===false||!processed?ch:applyLevelMoves(ch,t,w.rate,start);
 if(!processed||!polishValid(w,t)||t.polish.bypass||t.regions.some(r=>r.id===override?.regionId))return finish(renderTrack(w,t,options));
 const first=Math.round(start*w.rate),n=Math.max(1,Math.round(end*w.rate)-first);
 const out=t.polish.channels.map(c=>{const a=new Float32Array(n),lo=Math.max(0,first),hi=Math.min(c.length,first+n);if(hi>lo)a.set(c.subarray(lo,hi),lo-first);return a;});
 if(exclude){const lo=clamp(Math.round(exclude[0]*w.rate)-first,0,n),hi=clamp(Math.round(exclude[1]*w.rate)-first,0,n);for(const c of out)c.fill(0,lo,Math.max(lo,hi));}return finish(out);
}
// Mono uses equal-power pan. Stereo uses balance without summing channels.
function panGains(nc,pan){return nc===1?[Math.cos((pan+1)*Math.PI/4),Math.sin((pan+1)*Math.PI/4)]:[pan>0?Math.cos(pan*Math.PI/2):1,pan<0?Math.cos(-pan*Math.PI/2):1];}
function mix(w,{start=0,end=duration(w),override=null,excludeTrack=null,excludeRange=null,ignoreMute=false,processed=true}={}){
 const n=Math.max(1,Math.round(end*w.rate)-Math.round(start*w.rate)),out=[new Float32Array(n),new Float32Array(n)],solo=w.tracks.some(t=>t.solo),master=Math.pow(10,w.masterDb/20);
 for(const t of w.tracks){if(!ignoreMute&&(t.mute||(solo&&!t.solo)))continue;const ch=renderVoice(w,t,{start,end,override,exclude:t.id===excludeTrack?excludeRange:null,processed}),pan=panGains(ch.length,t.pan),g=Math.pow(10,t.gainDb/20)*master;
  for(let c=0;c<2;c++){const d=ch[Math.min(c,ch.length-1)],gain=g*pan[c];for(let i=0;i<n;i++)out[c][i]+=d[i]*gain;}
 }return out;
}
function signature(w){return JSON.stringify([w.rate,w.fadeMs,w.masterDb,duration(w),w.tracks.map(t=>[t.id,t.mute,t.solo,t.gainDb,t.pan,t.regions.filter(r=>r.selected).map(r=>{const a=r.takes.find(a=>a.id===r.selected);return [r.start,r.end,r.fadeMs,a.id,a.source,a.origin,a.offsetMs,a.gainDb,a.trimIn||0,a.trimOut||0,a.fadeIn||0,a.fadeOut||0];})]),...(w.tracks.some(t=>t.levelMoves?.length)?[w.tracks.map(t=>t.levelMoves||[])]:[])]);}
function peak(channels){let p=0;for(const c of channels)for(const x of c){if(x-x!==0)return Infinity;p=Math.max(p,Math.abs(x));}return p;}
// Older single-vocal workspaces become a lead track. Keep every take and its
// original timing. Old named parts become independent (possibly overlapping)
// navigation markers; new section edits enforce non-overlap.
function migrate(phrases,main,rate=48000,title='My song'){
 const w=empty(phrases?.rate||rate);w.title=label(phrases?.title||title,'My song');w.fadeMs=phrases?.fadeMs??20;w.lead=phrases?.lead??2;w.masterDb=0;
 const t=w.tracks[0],base=phrases?.base||(!phrases?.phrases?.length&&main?{channels:main,rate}:null);
 if(base){const d=base.channels[0].length/base.rate;addTake(w,{start:0,end:Math.min(LIMITS.seconds,d),channels:base.channels,rate:base.rate,name:base.name||'Original vocal',kind:'legacy-base',choose:true}).region.fadeMs=0;}
 for(const p of phrases?.phrases||[]){const r={id:id(w,'r'),name:label(p.name,'Recording'),kind:'legacy',start:p.start,end:p.end,selected:null,takes:[]};t.regions.push(r);
  for(const a of p.takes){const source=id(w,'a'),tid=id(w,'t');w.sources[source]={rate:a.rate,channels:a.channels};r.takes.push({id:tid,name:label(a.name,'Take'),source,origin:a.origin,offsetMs:a.offsetMs||0,gainDb:a.gainDb||0,legacyRating:a.rating,...([1,2,3,4,5].includes(a.rating)?{rating:a.rating}:{}),...(a.profile?{profile:a.profile,profileKey:'legacy'}:{})});if(p.selected===a.id)r.selected=tid;if(p.reference===a.id)r.reference=tid;}
  w.sections.push({id:id(w,'s'),name:label(p.name,'Section'),start:p.start,end:p.end});
 }
 // Legacy imported vocals are stereo/mono unchanged: balance law for mono
 // is compensated at the track gain so the centre output matches the old comp.
 if(!Object.values(w.sources).some(s=>s.channels.length===2))t.gainDb=20*Math.log10(Math.SQRT2);
 if(phrases){w.key=Number.isInteger(phrases.key)?phrases.key:0;w.scale=Number.isInteger(phrases.scale)?phrases.scale:0;}w.legacy=phrases?{key:phrases.key||0,scale:phrases.scale||0,lead:phrases.lead??2,cursor:phrases.cursor||0,parts:(phrases.phrases||[]).map(p=>({id:p.id,name:p.name,start:p.start,end:p.end,selected:p.selected||null,reference:p.reference||null,takes:p.takes.map(a=>({id:a.id,name:a.name,rating:a.rating||0,origin:a.origin}))}))}:null;w.cursor=phrases?.cursor||0;w.selectedRegion=t.regions.at(-1)?.id||null;return validate(w);
}
// 0.21.0: tempo grid, click, count-in and loop helpers (pure, tested in tests-0.21/core21.test.cjs).
// Bar 1 beat 1 is song time 0. A beat is a quarter note at the song tempo; meter = beats per bar.
const METERS=[2,3,4,5,6,7];
function prefs(w){return {meter:METERS.includes(w?.meter)?w.meter:4,click:!!w?.click,clickVol:Number.isFinite(w?.clickVol)?clamp(w.clickVol,0,1):.7,countIn:[0,1,2].includes(w?.countIn)?w.countIn:0,snap:!!w?.snap,loopRec:!!w?.loopRec,stopAtEnd:!!w?.stopAtEnd};}
function beatSec(bpm){return 60/clamp(+bpm||75,50,200);}
function barBeat(t,bpm,meter=4){const b=t/beatSec(bpm),k=Math.floor(b+1e-9);return {bar:Math.floor(k/meter)+1,beat:((k%meter)+meter)%meter+1,frac:b-k};}
function snapTime(t,bpm){const s=beatSec(bpm);return clamp(Math.round(t/s)*s,0,LIMITS.seconds);}
// Grid beats k*s with from <= k*s < to. Accent on the first beat of each bar.
function beatsIn(from,to,bpm,meter=4){const s=beatSec(bpm),out=[];for(let k=Math.ceil(from/s-1e-9);k*s<to-1e-9;k++)out.push({k,t:k*s,accent:((k%meter)+meter)%meter===0});return out;}
// Count-in window: whole bars ending exactly at the recording start a.
function countInWindow(a,bars,bpm,meter=4){const lead=bars*meter*beatSec(bpm);return {from:a-lead,to:a,lead};}
// One continuous capture of `total` samples over a loop of `len` samples becomes
// consecutive passes [lo,hi) with no gap and no overlap. The last pass may be partial.
function loopPasses(total,len){len=Math.round(len);if(!(len>0))throw Error('Invalid loop length.');const out=[];for(let lo=0;lo<total;lo+=len)out.push([lo,Math.min(total,lo+len)]);return out;}
// 0.23.0 part flow: the takes of a part are every region on the track that starts at the section start.
function partRegions(w,t,sec){const next=w.sections.filter(s=>s!==sec&&s.start>sec.start+1e-6).reduce((m,s)=>Math.min(m,s.start),Infinity);return t.regions.filter(r=>r.kind!=='legacy-base'&&Math.abs(r.start-sec.start)<.5e-3&&(r.kind==='part'||r.end<=next+.5e-3));} // 0.23: a take recorded for another purpose that runs on past the next section (e.g. a whole-song take) is not part of this section; section takes always are
function partTakes(w,t,sec){return partRegions(w,t,sec).flatMap(r=>r.takes.map(a=>({region:r,take:a})));}
function choosePart(w,t,sec,takeId){const regs=partRegions(w,t,sec),r=regs.find(r=>r.takes.some(a=>a.id===takeId));if(takeId&&!r)throw Error('That attempt is not in this section.');if(r)choose(w,r,takeId);for(const x of regs)if(x!==r&&(!r||(x.start>=r.start-.5e-3&&x.end<=r.end+.5e-3)))x.selected=null;}
// Grow a section to `end` without overlapping the next one. Returns the end used.
function growSection(w,sec,end){const next=w.sections.filter(s=>s!==sec&&s.start>=sec.end-1e-6).reduce((m,s)=>Math.min(m,s.start),LIMITS.seconds);const e=Math.min(Math.max(sec.end,end),next);sec.end=e;return e;}
// Render the audio of one take as heard (trim, fades, gain) for analysis / write-back.
function takeAudio(w,a){const s=w.sources[a.source],[lo,hi]=takeSpan(w,a),o=Math.round(origin(a)*w.rate),fi=Math.round((a.fadeIn||0)*w.rate/1000),fo=Math.round((a.fadeOut||0)*w.rate/1000),g=Math.pow(10,(a.gainDb||0)/20),n=hi-lo;
 const channels=s.channels.map(c=>{const out=new Float32Array(n);for(let i=0;i<n;i++){const e=(fi?clamp(i/fi,0,1):1)*(fo?clamp((n-1-i)/fo,0,1):1);out[i]=c[lo-o+i]*g*e;}return out;});return {channels,rate:w.rate,origin:lo/w.rate,offsetMs:0};}
// 0.18.3 write-back: the Lead vocal lane as a phrase workspace (base = lead comp, parts = sections and recordings).
// 0.18.3 parts are 0.5-60 s long, <=32 takes each, <=128 takes and <=128 MB in total; longer ones are split "(cont.)".
function toPhrases(w){
 const t=w.tracks[0],L=w.legacy||{},out={v:1,rate:w.rate,title:w.title,base:null,phrases:[],selected:null,cursor:clamp(w.cursor||0,0,900),lead:clamp(w.lead,0,5),fadeMs:w.fadeMs,nextId:1,revision:0,applied:-1,key:w.key??L.key??0,scale:w.scale??L.scale??0},notes=[];let bytes=0,count=0;const MAXB=128*1024*1024;
 const used=t.regions.filter(r=>r.kind!=='legacy-base'&&r.takes.length),end=Math.min(900,trackEnd(t));
 if(t.regions.some(r=>r.selected)){const ch=renderTrack(w,t,{start:0,end});const b=ch.reduce((n,c)=>n+c.byteLength,0);if(b<=MAXB/2){out.base={name:'Lead vocal (0.22 comp)',channels:ch,rate:w.rate,origin:0};bytes+=b;}else notes.push('The lead comp is too long to include as a whole vocal for older versions.');}
 const cache=new Map(),aud=a=>{if(!cache.has(a.id))cache.set(a.id,takeAudio(w,a));return cache.get(a.id);};
 const groups=[];for(const s of w.sections){const regs=partRegions(w,t,s).filter(r=>r.takes.length);if(regs.length){const ch=regs.find(r=>r.selected);groups.push({name:s.name,start:s.start,end:ch?ch.end:Math.max(s.end,...regs.map(r=>r.end)),regs});}}
 for(const r of used)if(!groups.some(g=>g.regs.includes(r)))groups.push({name:r.name,start:r.start,end:r.end,regs:[r]});
 groups.sort((a,b)=>a.start-b.start);
 for(const g of groups){const takes=g.regs.flatMap(r=>r.takes.map(a=>({r,a}))).sort((x,y)=>(y.r.selected===y.a.id)-(x.r.selected===x.a.id)||(y.a.rating||0)-(x.a.rating||0));
  for(let a=g.start,k=0;a<g.end-.5&&a<899.5;k++){const b=Math.min(g.end,a+60,900);if(b-a<.5)break;const p={id:'p'+(out.nextId++),name:label(g.name+(k?' (cont.)':''),'Part'),start:a,end:b,takes:[],selected:null};
   for(const {r,a:tk} of takes){if(p.takes.length>=32||count>=128){notes.push('Some attempts of '+g.name+' are not included for older versions (take limit).');break;}const au=aud(tk),tb=au.channels.reduce((n,c)=>n+c.byteLength,0);if(bytes+tb>MAXB){notes.push('Some attempts are not included for older versions (size limit).');break;}
    const id='t'+(out.nextId++);if(r.reference===tk.id&&!p.reference)p.reference=id;p.takes.push({id,name:tk.name,channels:au.channels,rate:w.rate,origin:au.origin,offsetMs:0,gainDb:0,rating:tk.rating||0,sourceTake:tk.id});bytes+=tb;count++;if(r.selected===tk.id&&!p.selected){const lo=Math.round(au.origin*w.rate),hi=lo+au.channels[0].length;if(lo<=Math.round(a*w.rate)&&hi>=Math.round(b*w.rate)){p.selected=id;
     // 0.24 (F8): older versions compose phrases over the base again. So that they play exactly what is heard
     // now, the chosen take's audio inside the phrase is the current comp; outside it keeps its real handles.
     if(out.base){const A=Math.round(a*w.rate),B=Math.round(b*w.rate),pt=p.takes[p.takes.length-1],fz=Math.round(w.fadeMs*w.rate/1000)+2;let changed=false;pt.channels=pt.channels.map((c,ci)=>{const x=Float32Array.from(c),bc=out.base.channels[Math.min(ci,out.base.channels.length-1)];for(let i=A;i<B&&i<bc.length;i++){const j=i-lo;if(j>=0&&j<x.length){if(Math.abs(x[j]-bc[i])>1e-6&&i>=A+fz&&i<B-fz)changed=true;x[j]=bc[i];}}return x;});
      if(changed)notes.push(g.name+': another chosen take overlaps it, so older versions get this phrase exactly as it sounds now (the overlapping audio is included in its chosen take).');}}}}
   if(p.takes.length)out.phrases.push(p);a=b;if(out.phrases.length>=128)break;}
 }
 out.selected=out.phrases[0]?.id||null;out.notes=[...new Set(notes)];return out;
}
function laneCount(w){return w.tracks.filter(t=>t.regions.some(r=>r.takes.length)).length;}
// 0.23.0: split one recording range at song time `at` into two ranges. Every attempt goes to
// both sides (same source audio, so both keep their handles); choice, stars and reference follow;
// check results are dropped so both sides are checked again. Returns [left,right].
function splitRegion(w,t,r,at){if(!(at>r.start+.04&&at<r.end-.04))throw Error('Split inside the range, at least 0.04 s from each end.');if(w.tracks.reduce((n,x)=>n+x.regions.length,0)>=LIMITS.regions)throw Error('This song has reached 256 recording ranges.');
 if(usage(w).takes+r.takes.length>LIMITS.takes)throw Error('Not enough room for the copies of these attempts (128 takes). Remove unused attempts first.');
 const clean=a=>{const x={...a};delete x.profile;delete x.profileKey;delete x.analysisError;return x;};
 const right={...r,id:id(w,'r'),start:at,selected:null,reference:null,takes:[]};delete right.sequence;
 for(const a of r.takes){const b={...clean(a),id:id(w,'t'),name:label(a.name+' (2)','Take'),splitFrom:a.id};right.takes.push(b);if(r.selected===a.id)right.selected=b.id;if(r.reference===a.id)right.reference=b.id;}
 r.takes=r.takes.map(a=>clean(a));r.end=at;if(r.name&&!/\(1\)$/.test(r.name)){right.name=r.name+' (2)';r.name=r.name+' (1)';}
 for(const x of [r,right])if(x.selected&&!covers(w,x.takes.find(a=>a.id===x.selected),x))x.selected=null;
 t.regions.splice(t.regions.indexOf(r)+1,0,right);w.selectedRegion=right.id;return [r,right];}
function setReference(w,t,regs,regionId,takeId){for(const x of regs)x.reference=null;if(!takeId)return;const r=t.regions.find(x=>x.id===regionId);if(!r||!r.takes.some(a=>a.id===takeId))throw Error('That attempt is not here.');r.reference=takeId;}
const api={LIMITS,validateMoves,levelDbAt,setLevelMove,applyLevelMoves,splitRegion,setReference,takeSpan,partRegions,partTakes,choosePart,growSection,takeAudio,toPhrases,laneCount,clamp,label,id,empty,clone,range,usage,track,region,origin,covers,duration,validate,checkAudio,addTrack,addSection,findRange,addTake,choose,gc,selectedCount,trackEnd,trackSignature,layoutSig,hashPcm,normalizeSigs,samePcm,renderTrackLegacy23,migrationProof,polishKey,songKeyOf,wantedKey,keyStale,monoMix,pcmFinite,acceptPcm,POLISH_PREFS,polishPrefs,validPrefs,ENGINE,polishPlan,readiness,roomSeconds,polishValid,renderTrack,renderVoice,panGains,mix,signature,peak,migrate,METERS,prefs,beatSec,barBeat,snapTime,beatsIn,countInWindow,loopPasses};
root.SongCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
