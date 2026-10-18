/* Phrase recording data and measurements. Pure functions, shared by UI, worker and tests. */
(function(root){
  'use strict';
  const MAX_SONG=900,MAX_TOTAL=1800,MAX_TAKES=128,MAX_BYTES=128*1024*1024;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,a,b,name)=>{if(!Number.isFinite(v)||v<a||v>b)throw new Error('Invalid '+name+'.');return v;};
  const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
  const db=v=>20*Math.log10(Math.max(1e-9,v));
  function empty(rate=48000){return {v:1,rate,title:'My phrase recording',base:null,phrases:[],selected:null,cursor:0,lead:2,fadeMs:20,nextId:1,revision:0,applied:-1};}
  function audio(a){
    if(!a||!Array.isArray(a.channels)||a.channels.length<1||a.channels.length>2)throw new Error('Use mono or stereo takes.');
    finite(a.rate,8000,192000,'sample rate');const n=a.channels[0]?.length;
    if(!n||n>a.rate*(MAX_SONG+10)||a.channels.some(c=>!(c instanceof Float32Array)||c.length!==n))throw new Error('Invalid take audio.');
    for(const c of a.channels)for(const v of c)if(!Number.isFinite(v))throw new Error('The take contains invalid audio samples.');return a;
  }
  function validate(w){
    if(!w||w.v!==1||!Array.isArray(w.phrases)||w.phrases.length>128)throw new Error('Invalid recording workspace.');finite(w.rate,8000,192000,'recording rate');finite(w.cursor,0,MAX_SONG,'resume position');finite(w.lead,0,5,'lead-in');finite(w.fadeMs,0,100,'fade');finite(w.nextId,1,1000000,'next take identity');finite(w.key||0,0,11,'key');finite(w.scale||0,0,6,'scale');if(!Number.isInteger(w.key||0)||!Number.isInteger(w.scale||0))throw new Error('Invalid musical key.');
    if(w.base){audio(w.base);if(w.base.rate!==w.rate)throw new Error('Base audio rate differs from the workspace.');}
    const ids=new Set();let count=0,total=0,bytes=w.base?w.base.channels.reduce((n,c)=>n+c.byteLength,0):0;
    for(const p of w.phrases){if(typeof p.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(p.id)||ids.has(p.id))throw new Error('Duplicate phrase.');ids.add(p.id);span(p.start,p.end);if(!Array.isArray(p.takes)||p.takes.length>32)throw new Error('Up to 32 attempts per phrase.');const tids=new Set();
      for(const t of p.takes){audio(t);if(t.rate!==w.rate||typeof t.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(t.id)||tids.has(t.id))throw new Error('Invalid take identity or rate.');tids.add(t.id);finite(t.origin,-10,MAX_SONG,'take position');finite(t.offsetMs??0,-500,500,'alignment');finite(t.gainDb??0,-12,12,'take level');total+=t.channels[0].length/t.rate;bytes+=t.channels.reduce((n,c)=>n+c.byteLength,0);++count;}
      if(p.selected&&!tids.has(p.selected))throw new Error('Selected take is missing.');if(p.reference&&!tids.has(p.reference))throw new Error('Reference take is missing.');
    }
    if(count>MAX_TAKES||total>MAX_TOTAL||bytes>MAX_BYTES)throw new Error('This session has reached 128 takes, 30 minutes of take audio or 128 MB of source audio. Save it and remove unused takes before recording more.');
    return w;
  }
  function clone(w){return {...w,base:w.base?{...w.base,channels:w.base.channels.slice()}:null,phrases:w.phrases.map(p=>({...p,takes:p.takes.map(t=>{const a={...t,channels:t.channels.slice()};delete a.analysisToken;return a;})}))};}
  function span(start,end){finite(start,0,MAX_SONG-.5,'phrase start');finite(end,start+.5,Math.min(MAX_SONG,start+60),'phrase end');}
  function duration(w){return Math.max(w.base?w.base.channels[0].length/w.rate:0,...w.phrases.map(p=>p.end),1);}
  function origin(t){return t.origin+(t.offsetMs||0)/1000;}
  function covers(t,p){return Math.round(origin(t)*t.rate)<=Math.round(p.start*t.rate)&&Math.round(origin(t)*t.rate)+t.channels[0].length>=Math.round(p.end*t.rate);}
  function excerpt(t,p){const from=Math.max(0,Math.round((p.start-origin(t))*t.rate)),to=Math.min(t.channels[0].length,Math.round((p.end-origin(t))*t.rate));return t.channels.map(c=>c.slice(from,Math.max(from,to)));}
  function audition(t,p){const n=Math.round((p.end-p.start)*t.rate),at=Math.round((p.start-origin(t))*t.rate);return t.channels.map(c=>{const a=new Float32Array(n),from=Math.max(0,at),to=Math.min(c.length,at+n);if(to>from)a.set(c.subarray(from,to),Math.max(0,-at));return a;});}
  function compose(w){
    validate(w);const n=Math.ceil(duration(w)*w.rate),nc=Math.max(w.base?.channels.length||1,...w.phrases.flatMap(p=>p.takes.filter(t=>t.id===p.selected).map(t=>t.channels.length))),out=Array.from({length:nc},(_,c)=>{const x=new Float32Array(n);if(w.base)x.set(w.base.channels[Math.min(c,w.base.channels.length-1)]);return x;});
    // Creation order is explicit: a later punch replaces an earlier selection in overlaps.
    for(const p of w.phrases){const t=p.takes.find(t=>t.id===p.selected);if(!t)continue;if(!covers(t,p))throw new Error(p.name+': selected take does not cover the phrase. Adjust its boundaries or choose another take.');
      const start=Math.round(p.start*w.rate),end=Math.min(n,Math.round(p.end*w.rate)),fade=Math.min(Math.round(w.fadeMs/1000*w.rate),Math.floor((end-start)/4)),gain=Math.pow(10,(t.gainDb||0)/20),at=Math.round(origin(t)*w.rate);
      for(let i=start;i<end;i++){const j=i-at;if(j<0||j>=t.channels[0].length)continue;const mix=fade?clamp(Math.min(i-start,end-1-i)/fade,0,1):1;for(let c=0;c<nc;c++)out[c][i]=out[c][i]*(1-mix)+t.channels[Math.min(c,t.channels.length-1)][j]*gain*mix;}
    }return out;
  }
  function stats(t,p,notes=[],report={}){
    const channels=excerpt(t,p),rate=t.rate,n=channels[0]?.length||0,win=Math.max(1,Math.round(rate*.02));let power=0,peak=0,clipped=0;const rms=[];
    for(let i=0;i<n;i+=win){let e=0,count=0;for(const c of channels)for(let j=i;j<Math.min(n,i+win);j++){const v=c[j];e+=v*v;power+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=.999)clipped++;count++;}rms.push(Math.sqrt(e/Math.max(1,count)));}
    const sorted=[...rms].sort((a,b)=>a-b),voice=sorted[Math.floor(sorted.length*.8)]||0;const threshold=Math.max(.001,voice*.18);
    const active=rms.map((v,i)=>v>threshold?i:-1).filter(i=>i>=0);
    // Only measure background from captured lead-in before the sung region, not quiet vowels.
    const leadEnd=Math.max(0,Math.min(t.channels[0].length,Math.floor((p.start-origin(t)-.2)*rate))),leadStart=Math.max(0,leadEnd-Math.round(rate*.6));let noise=null;
    if(leadEnd-leadStart>=rate*.15){let e=0;for(const c of t.channels)for(let i=leadStart;i<leadEnd;i++)e+=c[i]*c[i];noise=Math.sqrt(e/((leadEnd-leadStart)*t.channels.length));}
    const stable=notes.filter(a=>a[1]-a[0]>=.18&&!a[13]).map(a=>({start:a[0],end:a[1],pitch:a[2]}));
    return {v:1,rms:Math.sqrt(power/Math.max(1,n*channels.length)),peakDb:db(peak),clippedPercent:100*clipped/Math.max(1,n*channels.length),contrast:noise===null?null:clamp(db(voice)-db(noise),-20,100),noiseDb:noise===null?null:db(noise),voiceDb:db(voice),activeSeconds:active.length*win/rate,onset:active.length?active[0]*win/rate:null,ending:active.length?(active[active.length-1]+1)*win/rate:null,stable,complete:covers(t,p),music:!!report.music};
  }
  const scales=[[0,1,2,3,4,5,6,7,8,9,10,11],[0,2,4,5,7,9,11],[0,2,3,5,7,8,10],[0,2,3,5,7,8,11],[0,2,4,7,9],[0,3,5,7,10],[0,3,5,6,7,10]];
  function nearest(pitch,key,scale){let best=Infinity;for(let n=Math.floor(pitch)-12;n<=Math.ceil(pitch)+12;n++)if(scales[scale||0].includes(((n-key)%12+12)%12))best=Math.min(best,Math.abs(pitch-n));return best*100;}
  function rank(p,key=0,scale=0){
    const ref=p.takes.find(t=>t.id===p.reference)?.profile;
    const useContrast=p.takes.every(t=>t.profile&&Number.isFinite(t.profile.contrast));
    const rows=p.takes.map(t=>{const a=t.profile;if(!a||a.v!==1)return {id:t.id,eligible:false,reason:t.analysisError||'Waiting for analysis'};
      const stable=a.stable||[];let pitch=stable.length?median(stable.map(n=>nearest(n.pitch,key,scale))):null,timing=null,melody=false;
      if(ref&&Array.isArray(ref.stable)&&ref.stable.length===stable.length&&stable.length){pitch=median(stable.map((n,i)=>Math.abs(n.pitch-Math.round(ref.stable[i].pitch))*100));timing=median(stable.map((n,i)=>Math.abs(n.start-ref.stable[i].start)*1000));melody=true;}
      let score=0,weight=0;const add=(v,w)=>{score+=clamp(v,0,100)*w;weight+=w;};
      if(useContrast)add((a.contrast-10)*2,2);if(pitch!==null)add(100-pitch*1.5,2);add(100-a.clippedPercent*150,1);if(timing!==null)add(100-timing/3,1);
      const eligible=a.complete&&a.rms>.001&&a.activeSeconds>.25&&stable.length>0;
      return {id:t.id,eligible,score:weight?score/weight:0,pitch,timing,melody,contrast:a.contrast,clippedPercent:a.clippedPercent,reason:!a.complete?'Incomplete phrase coverage':a.rms<=.001?'No clear audible vocal':!stable.length?'Pitch tracking uncertain':'Estimated from recording quality and stable note centres'};
    });
    const eligible=rows.filter(r=>r.eligible).sort((a,b)=>b.score-a.score),allReady=p.takes.every(t=>t.profile||t.analysisError);
    const winner=allReady&&eligible.length>=2&&eligible[0].score-eligible[1].score>=3?eligible[0].id:null;
    return {rows,winner,tied:allReady&&eligible.length>=2&&!winner};
  }
  function matchGains(p){const ok=p.takes.filter(t=>t.profile?.rms>.00001);if(!ok.length)return {};const target=Math.min(...ok.map(t=>t.profile.rms)),g={};for(const t of ok)g[t.id]=Math.min(1,target/t.profile.rms,Math.pow(10,(-1-t.profile.peakDb)/20));return g;}
  const api={empty,clone,audio,validate,span,duration,covers,origin,excerpt,audition,compose,stats,rank,matchGains,MAX_SONG,MAX_TOTAL,MAX_TAKES,MAX_BYTES};
  root.PhraseCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
