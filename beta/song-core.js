/* Playbook Vocal Studio 0.21.0. Pure multitrack model and render functions.
 * Audio arrays are immutable. History clones metadata and shares audio arrays.
 * Sections are navigation markers. Regions are independent, ordered replacements
 * within ONE track. Tracks are summed; takes within a region are alternatives.
 * No engine/WASM dependency. See tests-0.20/core.test.cjs. */
(function(root){
'use strict';
const LIMITS=Object.freeze({seconds:900,recordSeconds:600,tracks:8,sections:128,regions:256,takes:128,perRegion:32,bytes:128*1024*1024});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function number(x,a,b,name){if(!Number.isFinite(x)||x<a||x>b)throw Error('Invalid '+name+'.');return x;}
function label(s,fallback){return String(s||fallback).trim().slice(0,100)||fallback;}
function id(w,prefix){return prefix+(w.nextId++);}
function empty(rate=48000){return {v:1,title:'My song',rate,nextId:2,revision:0,tracks:[{id:'v1',name:'Lead vocal',gainDb:0,pan:0,mute:false,solo:false,regions:[]}],sections:[],sources:{},activeTrack:'v1',selectedRegion:null,cursor:0,range:null,lead:2,fadeMs:20,masterDb:-6,appliedSig:null};}
function clone(w){return {...w,range:w.range?.slice()||null,sections:w.sections.map(s=>({...s})),sources:{...w.sources},tracks:w.tracks.map(t=>({...t,regions:t.regions.map(r=>({...r,takes:r.takes.map(a=>({...a}))}))}))};}
function range(a,b){number(a,0,LIMITS.seconds-.04,'start');number(b,a+.04,LIMITS.seconds,'end');}
function usage(w){let bytes=0,seconds=0,takes=0;for(const s of Object.values(w.sources)){bytes+=s.channels.reduce((n,c)=>n+c.byteLength,0);seconds+=s.channels[0].length/s.rate;}for(const t of w.tracks)for(const r of t.regions)takes+=r.kind==='legacy-base'?0:r.takes.length;return {bytes,seconds,takes};}
function track(w,id=w.activeTrack){return w.tracks.find(t=>t.id===id);}
function region(w,id=w.selectedRegion){return track(w)?.regions.find(r=>r.id===id);}
function origin(t){return t.origin+(t.offsetMs||0)/1000;}
function covers(w,t,r){const s=w.sources[t.source];return !!s&&Math.round(origin(t)*w.rate)<=Math.round(r.start*w.rate)&&Math.round(origin(t)*w.rate)+s.channels[0].length>=Math.round(r.end*w.rate);}
function trackEnd(t){return Math.max(1,...t.regions.filter(r=>r.selected).map(r=>r.end));}
function trackSignature(w,t){return JSON.stringify([w.rate,w.fadeMs,t.regions.filter(r=>r.selected).map(r=>{const a=r.takes.find(a=>a.id===r.selected);return [r.start,r.end,r.fadeMs,a.id,a.source,a.origin,a.offsetMs,a.gainDb];})]);}
function polishValid(w,t){return !!(t.polish&&t.polish.sourceSig===trackSignature(w,t)&&t.polish.rate===w.rate&&t.polish.channels?.length);}
function duration(w){return Math.max(1,...w.sections.map(s=>s.end),...w.tracks.flatMap(t=>t.regions.map(r=>r.end)),...w.tracks.map(t=>polishValid(w,t)&&!t.polish.bypass?t.polish.channels[0].length/w.rate:0));}
function validate(w){
 if(!w||w.v!==1||!Array.isArray(w.tracks)||!w.tracks.length||w.tracks.length>LIMITS.tracks||!Array.isArray(w.sections)||w.sections.length>LIMITS.sections||!w.sources||typeof w.sources!=='object')throw Error('Invalid song workspace.');
 number(w.rate,8000,192000,'song sample rate');number(w.nextId,1,1e9,'identity');number(w.cursor,0,LIMITS.seconds,'playhead');number(w.lead,0,5,'lead-in');number(w.fadeMs,0,100,'join fade');number(w.masterDb,-36,6,'master level');
 if(w.meter!=null&&!METERS.includes(w.meter))throw Error('Invalid time signature.');if(w.countIn!=null&&![0,1,2].includes(w.countIn))throw Error('Invalid count-in.');if(w.clickVol!=null)number(w.clickVol,0,1,'click volume');
 if(w.range)range(...w.range);const ids=new Set(),seen=x=>{if(typeof x!=='string'||!/^[-_a-zA-Z0-9]+$/.test(x)||ids.has(x))throw Error('Duplicate or invalid song identity.');ids.add(x);};
 for(const [key,s] of Object.entries(w.sources)){
  seen(key);if(!s||s.rate!==w.rate||!Array.isArray(s.channels)||!s.channels.length||s.channels.length>2)throw Error('Invalid source audio.');
  const n=s.channels[0].length;if(!n||n>(LIMITS.seconds+10)*w.rate||s.channels.some(c=>!(c instanceof Float32Array)||c.length!==n))throw Error('Invalid source length.');
  // Full sample validation is performed at import/capture; immutable arrays are
  // trusted here so a history action does not scan 128 MB on the UI thread.
 }
 let nr=0;
 for(const t of w.tracks){seen(t.id);number(t.gainDb,-36,12,'track level');number(t.pan,-1,1,'track pan');if(!Array.isArray(t.regions))throw Error('Invalid recording regions.');
  for(const r of t.regions){seen(r.id);nr++;range(r.start,r.end);if(r.fadeMs!=null)number(r.fadeMs,0,100,'range fade');if(!Array.isArray(r.takes)||r.takes.length>LIMITS.perRegion)throw Error('Up to 32 attempts for one recording range.');
   const tids=new Set();for(const a of r.takes){seen(a.id);tids.add(a.id);if(!Object.hasOwn(w.sources,a.source))throw Error('Missing recording audio.');number(a.origin,-10,LIMITS.seconds,'take position');number(a.offsetMs||0,-500,500,'take alignment');number(a.gainDb||0,-36,24,'take gain');}
   if(r.selected&&!tids.has(r.selected))throw Error('Chosen take is missing.');if(r.selected&&!covers(w,r.takes.find(a=>a.id===r.selected),r))throw Error('Chosen take does not cover its recording range.');
  }
 }
 if(nr>LIMITS.regions)throw Error('This song has reached 256 recording ranges.');
 for(const s of w.sections){seen(s.id);range(s.start,s.end);}
 if(!track(w))throw Error('The recording track is missing.');
 const u=usage(w);if(u.takes>LIMITS.takes||u.bytes>LIMITS.bytes)throw Error('The song has reached 128 takes or 128 MB of vocal audio. Back up and remove unused takes to make room.');
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
function choose(w,r,takeId){const a=r.takes.find(t=>t.id===takeId);if(takeId&&(!a||!covers(w,a,r)))throw Error('This attempt ended early. Record the full selected range before choosing it.');r.selected=takeId||null;}
function gc(w){const used=new Set(w.tracks.flatMap(t=>t.regions.flatMap(r=>r.takes.map(a=>a.source))));for(const k of Object.keys(w.sources))if(!used.has(k))delete w.sources[k];}
function selectedCount(w){return w.tracks.reduce((n,t)=>n+t.regions.filter(r=>r.selected).length,0);}
// Render only the requested interval, at the song's sample rate. Later chosen
// regions replace earlier ones on this track with complementary (sum=1) fades.
function renderTrack(w,t,{start=0,end=duration(w),override=null,exclude=null}={}){
 const first=Math.round(start*w.rate),last=Math.round(end*w.rate),n=Math.max(1,last-first);
 const nc=Math.max(1,...t.regions.flatMap(r=>r.takes.map(a=>w.sources[a.source].channels.length))),out=Array.from({length:nc},()=>new Float32Array(n));
 for(const r of t.regions){const selected=override?.regionId===r.id?override.takeId:r.selected,a=r.takes.find(a=>a.id===selected);if(!a)continue;const s=w.sources[a.source],o=Math.round(origin(a)*w.rate),rs=Math.round(r.start*w.rate),re=Math.round(r.end*w.rate),lo=Math.max(first,rs,o),hi=Math.min(last,re,o+s.channels[0].length),fade=Math.min(Math.round((r.fadeMs??w.fadeMs)*w.rate/1000),Math.floor((re-rs)/4)),g=Math.pow(10,(a.gainDb||0)/20);
  for(let i=lo;i<hi;i++){const m=fade?clamp(Math.min(i-rs,re-1-i)/fade,0,1):1;for(let c=0;c<nc;c++){const x=i-first;out[c][x]=out[c][x]*(1-m)+s.channels[Math.min(c,s.channels.length-1)][i-o]*g*m;}}
 }
 if(exclude){const lo=Math.max(first,Math.round(exclude[0]*w.rate)),hi=Math.min(last,Math.round(exclude[1]*w.rate));for(const c of out)c.fill(0,Math.max(0,lo-first),Math.max(0,hi-first));}
 return out;
}
// Processed lanes stay anchored at song time zero. Auditioning an alternative
// uses the dry comp on that lane; other lanes retain their processing.
function renderVoice(w,t,options={}){
 const {start=0,end=duration(w),override=null,exclude=null,processed=true}=options;
 if(!processed||!polishValid(w,t)||t.polish.bypass||t.regions.some(r=>r.id===override?.regionId))return renderTrack(w,t,options);
 const first=Math.round(start*w.rate),n=Math.max(1,Math.round(end*w.rate)-first);
 const out=t.polish.channels.map(c=>{const a=new Float32Array(n),lo=Math.max(0,first),hi=Math.min(c.length,first+n);if(hi>lo)a.set(c.subarray(lo,hi),lo-first);return a;});
 if(exclude){const lo=clamp(Math.round(exclude[0]*w.rate)-first,0,n),hi=clamp(Math.round(exclude[1]*w.rate)-first,0,n);for(const c of out)c.fill(0,lo,Math.max(lo,hi));}return out;
}
// Mono uses equal-power pan. Stereo uses balance without summing channels.
function panGains(nc,pan){return nc===1?[Math.cos((pan+1)*Math.PI/4),Math.sin((pan+1)*Math.PI/4)]:[pan>0?Math.cos(pan*Math.PI/2):1,pan<0?Math.cos(-pan*Math.PI/2):1];}
function mix(w,{start=0,end=duration(w),override=null,excludeTrack=null,excludeRange=null,ignoreMute=false,processed=true}={}){
 const n=Math.max(1,Math.round(end*w.rate)-Math.round(start*w.rate)),out=[new Float32Array(n),new Float32Array(n)],solo=w.tracks.some(t=>t.solo),master=Math.pow(10,w.masterDb/20);
 for(const t of w.tracks){if(!ignoreMute&&(t.mute||(solo&&!t.solo)))continue;const ch=renderVoice(w,t,{start,end,override,exclude:t.id===excludeTrack?excludeRange:null,processed}),pan=panGains(ch.length,t.pan),g=Math.pow(10,t.gainDb/20)*master;
  for(let c=0;c<2;c++){const d=ch[Math.min(c,ch.length-1)],gain=g*pan[c];for(let i=0;i<n;i++)out[c][i]+=d[i]*gain;}
 }return out;
}
function signature(w){return JSON.stringify([w.rate,w.fadeMs,w.masterDb,duration(w),w.tracks.map(t=>[t.id,t.mute,t.solo,t.gainDb,t.pan,t.regions.filter(r=>r.selected).map(r=>{const a=r.takes.find(a=>a.id===r.selected);return [r.start,r.end,r.fadeMs,a.id,a.source,a.origin,a.offsetMs,a.gainDb];})])]);}
function peak(channels){let p=0;for(const c of channels)for(const x of c)p=Math.max(p,Math.abs(x));return p;}
// Older single-vocal workspaces become a lead track. Keep every take and its
// original timing. Old named parts become independent (possibly overlapping)
// navigation markers; new section edits enforce non-overlap.
function migrate(phrases,main,rate=48000,title='My song'){
 const w=empty(phrases?.rate||rate);w.title=label(phrases?.title||title,'My song');w.fadeMs=phrases?.fadeMs??20;w.lead=phrases?.lead??2;w.masterDb=0;
 const t=w.tracks[0],base=phrases?.base||(!phrases?.phrases?.length&&main?{channels:main,rate}:null);
 if(base){const d=base.channels[0].length/base.rate;addTake(w,{start:0,end:Math.min(LIMITS.seconds,d),channels:base.channels,rate:base.rate,name:base.name||'Original vocal',kind:'legacy-base',choose:true}).region.fadeMs=0;}
 for(const p of phrases?.phrases||[]){const r={id:id(w,'r'),name:label(p.name,'Recording'),kind:'legacy',start:p.start,end:p.end,selected:null,takes:[]};t.regions.push(r);
  for(const a of p.takes){const source=id(w,'a'),tid=id(w,'t');w.sources[source]={rate:a.rate,channels:a.channels};r.takes.push({id:tid,name:label(a.name,'Take'),source,origin:a.origin,offsetMs:a.offsetMs||0,gainDb:a.gainDb||0,legacyRating:a.rating});if(p.selected===a.id)r.selected=tid;}
  w.sections.push({id:id(w,'s'),name:label(p.name,'Section'),start:p.start,end:p.end});
 }
 // Legacy imported vocals are stereo/mono unchanged: balance law for mono
 // is compensated at the track gain so the centre output matches the old comp.
 if(!Object.values(w.sources).some(s=>s.channels.length===2))t.gainDb=20*Math.log10(Math.SQRT2);
 w.cursor=phrases?.cursor||0;w.selectedRegion=t.regions.at(-1)?.id||null;return validate(w);
}
// 0.21.0: tempo grid, click, count-in and loop helpers (pure, tested in tests-0.21/core21.test.cjs).
// Bar 1 beat 1 is song time 0. A beat is a quarter note at the song tempo; meter = beats per bar.
const METERS=[2,3,4,5,6,7];
function prefs(w){return {meter:METERS.includes(w?.meter)?w.meter:4,click:!!w?.click,clickVol:Number.isFinite(w?.clickVol)?clamp(w.clickVol,0,1):.7,countIn:[0,1,2].includes(w?.countIn)?w.countIn:0,snap:!!w?.snap,loopRec:!!w?.loopRec};}
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
const api={LIMITS,clamp,label,id,empty,clone,range,usage,track,region,origin,covers,duration,validate,checkAudio,addTrack,addSection,findRange,addTake,choose,gc,selectedCount,trackEnd,trackSignature,polishValid,renderTrack,renderVoice,panGains,mix,signature,peak,migrate,METERS,prefs,beatSec,barBeat,snapTime,beatsIn,countInWindow,loopPasses};
root.SongCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
