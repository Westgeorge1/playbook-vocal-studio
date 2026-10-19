/* Playbook Vocal Studio 0.17.1 — recording engine behind the RECORD & COMP screen.
   Punch-in on the fly (into the part under the playhead), loop recording (a take every pass), count-in /
   metronome, mic check + gain, input monitoring, latency calibration, rename, delete-unchosen,
   autosave indicator and backup reminders.
   0.17.0: the old POLISH recording controls (REC tab, PHRASE tab, phone REC MODE, markers, star ratings) are
   gone from the screens; their code is removed here. Markers and ratings already in a project are kept in
   the data untouched. Audio math is unchanged: new takes go through the existing phraseAddAudio / PhraseCore paths. */
(function(){
'use strict';
const D=window.DAW;
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const LS=(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}};
const LSset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
const P=Object.assign({metro:false,countIn:true,countBars:1,clickVol:.6,hearOld:true,monitor:false,monitorVol:.8,micGainDb:0,micFirst:true,backupEvery:6,stopAtEnd:false},LS('pvs-rec-prefs',{}));
P.monitor=false; // input monitoring is always off when the app starts
const savePrefs=()=>LSset('pvs-rec-prefs',{...P,monitor:false});
const bpm=()=>Math.min(200,Math.max(50,+$('bpm').value||75)),beatSec=()=>60/bpm(),barSec=()=>240/bpm();
const dbToGain=db=>Math.pow(10,db/20);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const PV={}; window.PVSRec=PV;
let micChecked=false;

// ================================================================ microphone capture (AudioWorklet)
const Cap={stream:null,ctx:null,src:null,gain:null,an:null,node:null,mon:null,keep:null,sinks:new Set(),ring:[],peak:0,hold:0,clip:false,label:LS('pvs-mic-label',''),opening:null,checking:false,users:0};
function capLive(){return !!(Cap.stream&&Cap.ctx===actx&&Cap.stream.getAudioTracks().some(t=>t.readyState==='live'));}
async function capOpen(){
  if(capLive())return Cap;
  if(Cap.opening)return Cap.opening;
  Cap.opening=(async()=>{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone input is not available in this view. Open the page directly in Chrome or Safari.');
    const ctx=await resumeAudio();
    if(!ctx.audioWorklet||!window.AudioWorkletNode)throw new Error('This browser has no AudioWorklet, so punch-in and loop recording are not available. Recording a part from the Record button still works.');
    capClose(true);
    if(Cap.moduleCtx!==ctx){await ctx.audioWorklet.addModule('rec-worklet.js?v=0.17.1');Cap.moduleCtx=ctx;}
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    const tr=stream.getAudioTracks()[0];Cap.label=tr?.label||'microphone';LSset('pvs-mic-label',Cap.label);
    Cap.ctx=ctx;Cap.stream=stream;Cap.src=ctx.createMediaStreamSource(stream);Cap.gain=ctx.createGain();Cap.gain.gain.value=dbToGain(P.micGainDb);
    Cap.an=ctx.createAnalyser();Cap.an.fftSize=1024;Cap.node=new AudioWorkletNode(ctx,'pvs-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
    Cap.keep=ctx.createGain();Cap.keep.gain.value=0;Cap.mon=ctx.createGain();Cap.mon.gain.value=0;
    Cap.src.connect(Cap.gain);Cap.gain.connect(Cap.an);Cap.gain.connect(Cap.node);Cap.node.connect(Cap.keep).connect(ctx.destination);Cap.gain.connect(Cap.mon).connect(ctx.destination);
    Cap.ring=[];Cap.rate=ctx.sampleRate;
    Cap.node.port.onmessage=e=>{const c={frame:e.data.frame,data:e.data.data};let pk=0;const d=c.data;for(let i=0;i<d.length;i+=2){const v=d[i]<0?-d[i]:d[i];if(v>pk)pk=v;}c.peak=pk;
      if(pk>.98){Cap.clip=true;if(R)R.clip=true;}Cap.peak=pk;Cap.hold=Math.max(Cap.hold*.97,pk);
      Cap.ring.push(c);const keepFrames=3*Cap.rate;while(Cap.ring.length&&Cap.ring[0].frame<c.frame-keepFrames)Cap.ring.shift();for(const s of Cap.sinks)s(c);};
    if(tr)tr.onended=()=>{if(R&&!R.stopping){R.error='Microphone disconnected.';stopRec(false,false);}capClose(true);syncPanel();};
    applyMonitor();syncPanel();return Cap;
  })();
  try{return await Cap.opening;}finally{Cap.opening=null;}
}
function capClose(force){
  if(!force&&(Cap.checking||P.monitor&&rec||R||Cap.sinks.size))return;
  if(Cap.node){try{Cap.node.port.postMessage('stop');}catch(e){}}
  for(const n of [Cap.src,Cap.gain,Cap.an,Cap.node,Cap.keep,Cap.mon])if(n)try{n.disconnect();}catch(e){}
  if(Cap.stream)Cap.stream.getTracks().forEach(t=>t.stop());
  Object.assign(Cap,{stream:null,src:null,gain:null,an:null,node:null,mon:null,keep:null,ring:[],peak:0,hold:0});
}
function applyMonitor(){if(!Cap.mon)return;const on=P.monitor&&(rec||Cap.checking);Cap.mon.gain.setTargetAtTime(on?P.monitorVol:0,Cap.ctx.currentTime,.02);}
function chunksBetween(list,f0,f1){ // returns {data,first} covering frames [f0,f1)
  const parts=list.filter(c=>c.frame+c.data.length>f0&&c.frame<f1).sort((a,b)=>a.frame-b.frame);if(!parts.length)return null;
  const first=Math.max(f0,parts[0].frame),last=Math.min(f1,parts.at(-1).frame+parts.at(-1).data.length),out=new Float32Array(Math.max(0,last-first));
  for(const c of parts){const a=Math.max(first,c.frame),b=Math.min(last,c.frame+c.data.length);if(b>a)out.set(c.data.subarray(a-c.frame,b-c.frame),a-first);}
  return {data:out,first};
}
PV.inputOpen=()=>capLive()&&(Cap.checking||!!R);
PV.inputPeak=()=>Cap.peak;
// 0.17.0: one meter source for the RECORD & COMP screen (was mirrored from the POLISH transport meter)
const meterBuf=new Float32Array(1024);
PV.meterPeak=()=>{if(rec&&rec.an&&!R){rec.an.getFloatTimeDomainData(meterBuf);let pk=0;for(const v of meterBuf){const a=v<0?-v:v;if(a>pk)pk=a;}if(pk>.98)rec.clip=true;return pk;}if(capLive()&&(Cap.checking||R))return Cap.peak;return -1;};
PV.clipOn=()=>Cap.clip||!!(rec&&rec.clip);
PV.clipReset=()=>{Cap.clip=false;Cap.hold=0;if(rec)rec.clip=false;syncPanel();};

// ---- MediaRecorder paths (stopped-transport phrase, main recording, comp take): digital mic gain
window.pvsRecStream=(ctx,mic,stream,an)=>{const tr=stream.getAudioTracks()[0];if(tr?.label){Cap.label=tr.label;LSset('pvs-mic-label',tr.label);}
  if(Math.abs(P.micGainDb)<.05||!ctx.createMediaStreamDestination)return stream;
  const g=ctx.createGain(),d=ctx.createMediaStreamDestination();g.gain.value=dbToGain(P.micGainDb);try{mic.disconnect(an);}catch(e){}mic.connect(g);g.connect(d);g.connect(an);return d.stream;};
window.pvsRecVocalGain=()=>{if(!P.hearOld)return 0;return typeof dawVocalGain==='function'?dawVocalGain():1;};
window.pvsRecScheduled=(r,ctx)=>{if(P.monitor){Cap.forRec=true;capOpen().then(applyMonitor).catch(()=>{});}
  const was=micChecked;micChecked=true;if(!was)syncPanel();};

// ================================================================ latency
const Lat=LS('pvs-latency',{});
function latKey(){return (Cap.label||'default microphone')+' · '+(navigator.userAgentData?.platform||navigator.platform||'');}
function latEntry(){return Lat[latKey()]||(Lat.__last&&Lat[Lat.__last])||null;}
function autoLatency(){const ctx=audioCtx();return Math.max(0,(ctx.outputLatency||0)+(ctx.baseLatency||0));}
window.pvsLatency=()=>{const e=latEntry();return e&&Number.isFinite(e.ms)?e.ms/1000:autoLatency();};
function latStore(ms,method,detail){const k=latKey();Lat[k]={ms:Math.round(ms*10)/10,method,detail:detail||'',date:new Date().toISOString().slice(0,10)};Lat.__last=k;LSset('pvs-latency',Lat);syncPanel();}
PV.latStore=latStore;
// onset detection used by the loopback test (exported for tests)
function detectOnsets(chunks,times,rate){
  const at=t=>Math.round(t*rate);const nb=chunksBetween(chunks,at(times[0]-.35),at(times[0]-.05));let noise=.002;
  if(nb&&nb.data.length){let e=0;for(const v of nb.data)e+=v*v;noise=Math.max(.0005,Math.sqrt(e/nb.data.length));}
  const thr=Math.max(.03,noise*8),out=[];
  for(const t of times){const seg=chunksBetween(chunks,at(t),at(t+.4));if(!seg)continue;let hitAt=-1;for(let i=0;i<seg.data.length;i++){if(Math.abs(seg.data[i])>thr){hitAt=i;break;}}if(hitAt>=0)out.push((seg.first+hitAt)/rate-t);}
  if(out.length<5)return {ok:false,n:out.length,thr,noise};
  const sorted=[...out].sort((a,b)=>a-b),med=sorted[Math.floor(sorted.length/2)],spread=sorted[Math.floor(sorted.length*.8)]-sorted[Math.floor(sorted.length*.2)];
  return {ok:true,n:out.length,ms:med*1000,spreadMs:spread*1000,thr,noise};
}
PV.detectOnsets=detectOnsets;
function clickAt(t,accent,vol,dest){const ctx=audioCtx();const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=accent?1760:1175;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(Math.max(.0001,vol),t+.0015);g.gain.exponentialRampToValueAtTime(.0005,t+.06);o.connect(g).connect(dest||ctx.destination);o.start(t);o.stop(t+.08);o.onended=()=>{o.disconnect();g.disconnect();};
  Clk.count++;Clk.log.push({t:+t.toFixed(4),accent});if(Clk.log.length>64)Clk.log.shift();}
let calPending=null;
async function calLoopback(){
  const res=$('calResult');$('calSave').disabled=true;calPending=null;res.textContent='Opening the microphone…';
  try{await capOpen();}catch(e){res.textContent='Microphone unavailable: '+e.message;return;}
  const ctx=audioCtx(),chunks=[],sink=c=>chunks.push(c);Cap.sinks.add(sink);$('calDevice').textContent=latKey();
  const T=ctx.currentTime+.5,times=[];for(let i=0;i<8;i++){const t=T+i*.5;times.push(t);
    const n=ctx.createBufferSource(),b=ctx.createBuffer(1,Math.round(ctx.sampleRate*.004),ctx.sampleRate),d=b.getChannelData(0);for(let j=0;j<d.length;j++)d[j]=(j%2?-1:1)*(1-j/d.length);n.buffer=b;const g=ctx.createGain();g.gain.value=.9;n.connect(g).connect(ctx.destination);n.start(t);n.onended=()=>{n.disconnect();g.disconnect();};}
  res.textContent='Listening for 8 clicks…';await sleep((.5+8*.5+.6)*1000);Cap.sinks.delete(sink);capClose();
  const r=detectOnsets(chunks,times,ctx.sampleRate);
  if(!r.ok){res.textContent='Heard only '+r.n+' of 8 clicks. Turn the volume up, hold the headphone against the mic (or use the speaker) and try again — or use the tap test.';return;}
  calPending={ms:r.ms,method:'loopback',detail:r.n+'/8 clicks, spread '+r.spreadMs.toFixed(1)+' ms'};
  res.textContent='Measured round-trip latency: '+r.ms.toFixed(1)+' ms ('+calPending.detail+')'+(r.spreadMs>10?' — the clicks were inconsistent; run it again to be sure.':'.');$('calSave').disabled=false;
}
let tap=null;
function calTapStart(){const ctx=audioCtx();resumeAudio().then(()=>{const T=ctx.currentTime+.6,times=[];for(let i=0;i<10;i++){const t=T+i*.6;times.push(t);clickAt(t,i%4===0,.9);}
  tap={times,taps:[]};$('calTap').disabled=false;$('calTap').focus();$('calResult').textContent='Tap on every click…';$('calSave').disabled=true;calPending=null;
  setTimeout(calTapDone,(.6+10*.6+.5)*1000);});}
function calTapHit(ev){if(!tap)return;const ctx=audioCtx(),age=Math.max(0,(performance.now()-(ev&&ev.timeStamp||performance.now()))/1000);tap.taps.push(ctx.currentTime-age);}
function calTapDone(){if(!tap)return;const t=tap;tap=null;$('calTap').disabled=true;const d=[];
  for(const x of t.taps){let best=null;for(let i=2;i<t.times.length;i++){const v=x-t.times[i];if(v>-.25&&v<.45&&(best===null||Math.abs(v)<Math.abs(best)))best=v;}if(best!==null)d.push(best);}
  if(d.length<5){$('calResult').textContent='Only '+d.length+' usable taps. Try again and tap on every click.';return;}
  d.sort((a,b)=>a-b);const med=d[Math.floor(d.length/2)],ms=Math.max(0,med*1000+((audioCtx().baseLatency||0)*1000));
  calPending={ms,method:'tap-along',detail:d.length+' taps'};$('calResult').textContent='Estimated latency: '+ms.toFixed(0)+' ms from '+d.length+' taps (approximate — includes your own timing).';$('calSave').disabled=false;}
PV._tap={start:calTapStart,hit:calTapHit,done:calTapDone,get state(){return tap;}};
PV.calOpen=()=>{if(typeof dawCloseMenus==='function')dawCloseMenus();$('calDevice').textContent=latKey();$('calModal').hidden=false;};

// ================================================================ click: count-in + metronome (headphones only)
const Clk={last:-1,key:'',count:0,log:[]};
PV.clicks=Clk;
function songMap(){
  if(rec&&rec.target==='phrase'&&Number.isFinite(rec.clockStart)&&rec.phrase)return {key:'r'+rec.clockStart,T0:rec.clockStart,s0:rec.origin,loop:null,p:rec.phrase.p,rec:true};
  if(playing&&actx&&(!loop||loop.daw||loop.rcComp))return {key:'p'+startTime+':'+startPos,T0:startTime,s0:startPos,loop:loop&&loop.daw?[loop.start,Math.min(loop.end,Math.max(loop.start+.05,loop.end))]:null,p:loop&&loop.rcPart||null,rec:!!rec};
  return null;
}
function beatsIn(m,A,B){ // song beats whose context time lies in [A,B)
  const bt=beatSec(),out=[],uA=m.s0+(A-m.T0),uB=m.s0+(B-m.T0);
  const emit=(sLo,sHi,shift)=>{for(let k=Math.ceil(sLo/bt-1e-9);k*bt<sHi;k++){out.push({T:m.T0+(k*bt+shift-m.s0),k,s:k*bt});}};
  if(!m.loop){emit(uA,uB,0);return out;}
  const [a,b]=m.loop,L=b-a;if(L<=.05)return out;
  for(let c=0;c<1000;c++){const lo=c===0?-Infinity:b+(c-1)*L,hi=b+c*L;if(lo>=uB)break;const x=Math.max(uA,lo),y=Math.min(uB,hi);if(y>x){const shift=c*L;emit(Math.max(x-shift,c===0?-Infinity:a),y-shift,shift);}}
  return out;
}
PV._beatsIn=beatsIn;
function clockTick(){
  const ctx=actx;if(!ctx||ctx.state!=='running'){Clk.last=-1;return;}
  const m=songMap();if(!m){Clk.last=-1;Clk.key='';return;}
  if(m.key!==Clk.key){Clk.key=m.key;Clk.last=-1;}
  const now=ctx.currentTime,A=Math.max(now,Clk.last,m.T0),B=now+.15;if(B<=A)return;
  for(const b of beatsIn(m,A,B)){
    const countIn=m.p&&b.s<m.p.start-1e-6;
    const play=countIn?P.countIn:P.metro;
    if(!play)continue;
    const acc=((b.k%4)+4)%4===0;clickAt(Math.max(now,b.T),acc,P.clickVol*(countIn?1:.75)*(acc?1:.7));
  }
  Clk.last=B;
}
setInterval(clockTick,25);
// longer lead-in when the count-in is on
const origOptions=window.phraseRecordOptions;
window.phraseRecordOptions=function(){const o=origOptions.apply(this,arguments);const ci=P.countIn?P.countBars*barSec():0;if(ci>0)o.start=Math.min(o.start,o.p.start-ci-.15);
  // 0.16.1: a take may start at most 10 s before 0:00 (project rule). Slow songs with a 2-bar count-in on a part at 0:00 plus
  // Bluetooth-size latency went past it and the take was thrown away ('Invalid take position'). Start the lead-in a little later instead.
  o.start=Math.max(o.start,-9.9+Math.max(0,pvsLatency()));
  // 0.17.1: the take runs until you press Stop (o.free), unless "Stop at part end" is ON. o.cap = safety limit in seconds.
  o.free=!P.stopAtEnd;o.cap=capSec(o.w);o.capFull=!!PV.capFull;return o;};
// ================================================================ 0.17.1 takes run until you press Stop
// 0.17.0 (and every version before) stopped a take by itself 0.3 s after the part's OUT flag. Real singers run over,
// so a take now keeps recording (and the backing keeps playing) until you press Stop / R / Space. If you sang past
// OUT, the part gets longer to fit (one Undo puts it back). "Stop at part end: ON" brings back the old behaviour.
PV.CAP=600; // 10-minute safety limit for one take
function capSec(w){w=w||phraseWorkspace();const C=PhraseCore;let secs=0,bytes=w.base?w.base.channels.reduce((n,c)=>n+c.byteLength,0):0;
  for(const p of w.phrases)for(const t of p.takes){secs+=t.channels[0].length/w.rate;bytes+=t.channels.reduce((n,c)=>n+c.byteLength,0);}
  const room=Math.min(C.MAX_TOTAL-secs,(C.MAX_BYTES-bytes)/(w.rate*4))-3; // mono takes (a two-channel recording of a mono mic is stored as one channel)
  PV.capFull=room<(PV._capSec||PV.CAP);return Math.max(5,Math.min(PV._capSec||PV.CAP,room));}
PV.capSec=capSec;
const capText=s=>s>=90?Math.round(s/60)+' minutes':Math.round(s)+' seconds';
// time (s from the start of the audio) just after the last audible sound; 0 when it is all quiet
function lastSound(chs,rate){const d=chs[0],h=Math.max(1,Math.round(rate*.05)),n=Math.floor(d.length/h);if(!n)return 0;const e=new Float32Array(n);
  for(let k=0;k<n;k++){let s=0;for(const x of chs)for(let i=k*h,j=i+h;i<j;i++)s+=x[i]*x[i];e[k]=Math.sqrt(s/(h*chs.length));}
  const srt=Array.from(e).sort((a,b)=>a-b),floor=srt[Math.floor(n*.1)],thr=Math.max(.0056,Math.min(floor*4,.02));
  for(let k=n-1;k>=0;k--)if(e[k]>thr)return (k+1)*h/rate;return 0;}
PV._lastSound=lastSound;
// where should part p end so it holds a take that runs to song time E?
function fitOut(p,E,ask){const w=phraseWorkspace(),maxEnd=Math.min(900,p.start+60);
  let end=Math.min(E,maxEnd),cut=E>maxEnd+.05?{at:maxEnd,why:'limit'}:null,shrink=null;
  const q=w.phrases.filter(x=>x!==p&&x.start>=p.end-.05&&x.start<end-.05).sort((a,b)=>a.start-b.start)[0];
  if(q){const canMove=end<=q.end-.5;if(!canMove||ask(q,end)){cut={at:q.start,why:'next',q};end=q.start;}else shrink=q;}
  return {end:Math.max(p.end,Math.floor(end*1000+1e-6)/1000),shrink,cut};} // rounded down to 1 ms so the take still covers the part
PV._fitOut=fitOut;
function askTrim(p,q,E){if(typeof PV._ask==='function')return PV._ask(p,q,E);
  return confirm(p.name+': your take runs '+(E-q.start).toFixed(1)+' s into “'+q.name+'”.\n\nOK = keep '+q.name+' as it is: '+p.name+' ends where '+q.name+' starts ('+fmt(q.start)+') and the take is trimmed there.\n\nCancel = make room: '+p.name+' ends at '+fmt(E)+' and '+q.name+' starts there instead, so your new singing is used.\n\nUndo (Ctrl+Z) puts everything back either way.');}
function reAnalyze(p){for(const t of p.takes)phraseAnalyze(t,p);}
function stopNote(title,m){phraseMessage(m);toast(title,m,10000);}
PV._stopNote=stopNote;
const origFinish=window.phraseFinishRecording;
window.phraseFinishRecording=async function(r,channels,rate){
  const o=r.phrase,why=r.autoStop;
  if(o&&o.free&&channels.length===2){let same=true;const x=channels[0],y=channels[1];for(let i=0;i<x.length;i+=7)if(Math.abs(x[i]-y[i])>1e-6){same=false;break;}if(same)channels=[x];}
  if(!o||!o.free){await origFinish.apply(this,arguments);
    if(why==='end')stopNote('Recording stopped at the part end','Stopped at the end of '+o.p.name+' because “Stop at part end” is ON. Turn it OFF on the part panel to keep recording until you press Stop.');return;}
  const p=o.p,w=phraseWorkspace(),lat=pvsLatency(),origin=r.origin-lat,E=origin+channels[0].length/rate;
  const sung=Math.min(E,Math.max(origin+lastSound(channels,rate)+.25,p.end));
  const pre=PhraseCore.clone(w),oldEnd=p.end,oldSel=p.takes.find(t=>t.id===p.selected);
  const fit=sung>p.end+.05?fitOut(p,sung,(q,e)=>askTrim(p,q,e)):{end:p.end,shrink:null,cut:null};
  const sl=(a,b)=>{const i0=Math.max(0,Math.round((a-origin)*rate)),i1=Math.min(channels[0].length,Math.round((b-origin)*rate));return channels.map(c=>c.slice(i0,Math.max(i0+1,i1)));};
  const keepTo=Math.min(E,fit.end+(fit.cut?.3:1)); // the silent tail after your last note is not stored
  let adds=0;const extra=[];
  await phraseAddAudio(p,sl(origin,keepTo),rate,origin,phraseNextTakeName(p));adds++;
  const t=p.takes.at(-1);
  if(fit.end>p.end+.0005){p.end=fit.end;if(p.selected&&!PhraseCore.covers(p.takes.find(x=>x.id===p.selected),p))p.selected=null;reAnalyze(p);}
  if(fit.shrink){fit.shrink.start=fit.end;reAnalyze(fit.shrink);}
  // longer than the 60-s part limit: the rest goes into new part(s) right after it
  let contNote='';
  if(fit.cut&&fit.cut.why==='limit'){let a=fit.end;const made=[];
    try{while(sung-a>=.5&&w.phrases.length<128){const nx=w.phrases.filter(x=>x!==p&&x.start>a-.05&&x.start<sung).sort((x,y)=>x.start-y.start)[0];
        if(nx&&nx.start<a+.5){contNote=' The singing after '+fmt(a)+' was not kept because '+nx.name+' starts there.';break;}
        const b=Math.floor(Math.min(sung,a+60,nx?nx.start:Infinity)*1000+1e-6)/1000;let nm=p.name+' (cont.)',k=2;while(w.phrases.some(x=>x.name===nm))nm=p.name+' (cont. '+(k++)+')';
        const cp={id:'p'+w.nextId++,name:nm,start:+a.toFixed(3),end:b,selected:null,reference:null,takes:[]};w.phrases.push(cp);
        const s0=Math.max(origin,a-.25);try{await phraseAddAudio(cp,sl(s0,Math.min(E,b+.3)),rate,s0,phraseNextTakeName(cp));adds++;}catch(e){w.phrases=w.phrases.filter(x=>x!==cp);throw e;}
        made.push(cp.name);a=b;if(nx&&Math.abs(b-nx.start)<.01&&sung-b>=.5){contNote=' The singing after '+fmt(b)+' was not kept because '+nx.name+' starts there.';break;}}
    }catch(e){contNote+=' The rest could not be added: '+e.message;}
    if(made.length)contNote=' A part can be at most 60 s long, so the rest of the take went into '+made.join(', ')+'.'+contNote;}
  // one Undo goes back to before this take
  for(let i=0;i<adds;i++)phraseUndoStack.pop();phraseUndoStack.push(pre);phraseUndo=pre;phraseRedoStack=[];
  w.selected=p.id;
  let m=t.name+' recorded on '+p.name+'.';
  if(p.end>oldEnd+.0005)m+=' You sang past the OUT flag, so '+p.name+' now ends at '+fmt(p.end)+' (was '+fmt(oldEnd)+').';
  if(fit.shrink)m+=' '+fit.shrink.name+' now starts at '+fmt(fit.shrink.start)+'.';
  if(fit.cut&&fit.cut.why==='next')m+=' The take was trimmed where '+fit.cut.q.name+' starts ('+fmt(fit.cut.at)+').';
  m+=contNote;
  if(oldSel&&p.selected!==oldSel.id&&p.end>oldEnd)m+=' '+oldSel.name+' no longer covers the longer part, so it is not chosen any more.';
  if(p.end>oldEnd+.0005||fit.shrink||adds>1)m+=' Undo (Ctrl+Z) puts it all back.';
  if(!PhraseCore.covers(t,p))m+=' The take ended before the part was complete — record again or drag the OUT flag back.';
  else if(r.clip)m+=' Some input peaks were loud; check the clipping figure before choosing.';
  phraseChanged(m);w.cursor=Math.min(899.5,p.end);persist();
  if(why==='cap')stopNote('Recording stopped by itself',m+' — It stopped because it reached the '+capText(o.cap)+' safety limit for one take'+(o.capFull?' (the project is nearly full: save it and delete unused takes)':'')+'. Press Record again to carry on.');
  if(typeof showPage==='function')showPage('record');};
window.pvsHoldPlay=()=>!!(R&&R.mode==='punch'&&!R.stopping); // a punch keeps going after the song ends
PV.preRoll=()=>{const w=S.phrases;return Math.max(w?w.lead:2,P.countIn?P.countBars*barSec():0);};

// ================================================================ punch-in on the fly + loop recording
let R=null,loopOwner=null; // active worklet recording / loop session being finalised
PV.state=()=>R&&{mode:R.mode,s0:R.s0,passes:R.passes,takes:R.added};
function vocalNodes(){return playbackNodes.filter(n=>!beatGains.includes(n));}
function muteOldVocal(at){R.muted=[];for(const n of vocalNodes()){R.muted.push([n,n.gain.value]);n.gain.cancelScheduledValues(at);n.gain.setTargetAtTime(0,at,.008);}}
function restoreOldVocal(){const ctx=audioCtx();for(const [n,v] of R.muted||[])try{n.gain.cancelScheduledValues(ctx.currentTime);n.gain.setTargetAtTime(v,ctx.currentTime,.02);}catch(e){}}
function pseudoRec(target){return {target,mr:{state:'recording',stop:()=>stopRec(true,false)},ids:{time:'pvsRecTime'},an:Cap.an,clip:false,origin:R.s0,t0:performance.now(),loopA:R.a,phrase:null,stream:Cap.stream};}
function capacityCheck(seconds){const w=phraseWorkspace();const total=w.phrases.reduce((n,p)=>n+p.takes.reduce((n,t)=>n+t.channels[0].length/w.rate,0),0);
  if(w.phrases.reduce((n,p)=>n+p.takes.length,0)>=128)throw new Error('Save the project and remove unused takes before recording more (128 takes).');
  if(total+seconds>PhraseCore.MAX_TOTAL)throw new Error('The project is near its 30-minute take limit. Save and remove unused takes first.');}
async function punchStart(){
  if(R||rec)return;const ctx=audioCtx();if(!playing)return;
  try{capacityCheck(30);}catch(e){phraseMessage(e.message);toast('Cannot punch in',e.message);return;}
  const T0=ctx.currentTime,s0=currentPos();
  R={mode:'punch',T0,s0,a:s0,chunks:[],clip:false,added:0,starting:true,part:partUnder(s0)};
  S.recStarting=true;
  try{await capOpen();}catch(e){R=null;S.recStarting=false;renderOpen();toast('Punch-in needs the microphone',e.message);phraseMessage(e.message);return;}
  S.recStarting=false;
  if(!playing){R=null;renderOpen();return;}
  // keep up to 1 s of audio captured before R was pressed (only if the mic was already open)
  for(const c of Cap.ring)if(c.frame+c.data.length>(T0-1)*Cap.rate)R.chunks.push(c);
  R.sink=c=>R.chunks.push(c);Cap.sinks.add(R.sink);R.starting=false;
  muteOldVocal(Math.max(ctx.currentTime,T0));
  rec=pseudoRec('punch');applyMonitor();renderOpen();syncPhraseUI();
  phraseMessage('● Punch-in at '+fmt(s0)+(R.part?' on '+R.part.name:' (no part here yet: a new part will be made)')+' — press R to punch out (the song keeps playing), Space to punch out and stop, Esc to cancel.');
}
async function loopRecStart(){
  if(R||rec)return;const ctx=audioCtx();if(!playing||!loop||!loop.daw)return;
  const a=loop.start,b=loop.end,L=b-a;
  if(L<.5||L>60){toast('Loop recording','The loop must be 0.5–60 s long to record takes on every pass (it is '+L.toFixed(1)+' s).');return;}
  try{capacityCheck(L*4);}catch(e){toast('Cannot loop-record',e.message);return;}
  R={mode:'loop',T0:ctx.currentTime,s0:a,a,b,L,chunks:[],clip:false,passes:0,added:0,next:null,phrase:loop.rcPart||null,starting:true,pending:Promise.resolve()};
  S.recStarting=true;
  try{await capOpen();}catch(e){R=null;S.recStarting=false;renderOpen();toast('Loop recording needs the microphone',e.message);return;}
  S.recStarting=false;if(!playing||!loop){R=null;renderOpen();return;}
  for(const c of Cap.ring)if(c.frame+c.data.length>(R.T0-1)*Cap.rate)R.chunks.push(c);
  R.sink=c=>R.chunks.push(c);Cap.sinks.add(R.sink);R.starting=false;
  // first pass that starts after (or within 0.25 s before) R was pressed
  const st=startTime,sp=startPos,passStart=c=>st+(b-sp)+(c-1)*L;R.passStart=passStart;
  let c=0;while(passStart(c)<R.T0-.25||passStart(c)<st-.001)c++;R.next=c;R.kept=c;
  muteOldVocal(ctx.currentTime);
  rec=pseudoRec('loop');rec.loopA=a;applyMonitor();renderOpen();syncPhraseUI();
  phraseMessage('● Loop recording '+fmt(a)+'–'+fmt(b)+': every full pass becomes a new take. R or Space stops, Esc cancels the pass in progress.');
  R.timer=setInterval(loopPollBound,40);
}
async function stopRec(keep,stopTransport,why){
  if(!R||R.stopping)return;const r=R;r.stopping=true;r.why=why||'';
  if(!stopTransport&&r.mode==='punch'&&playing&&currentPos()>=songLength()-.05)stopTransport=true;/* punched out after the song ended */const ctx=audioCtx(),T1=ctx.currentTime,lat=pvsLatency();
  clearInterval(r.timer);restoreOldVocal();
  const s1=r.mode==='punch'?r.s0+(T1-r.T0):null;
  if(stopTransport){if(loop)endLoop();stopPlayback();}
  phraseMessage(keep?'Finishing the take…':'Take cancelled.');
  await sleep(Math.min(600,(lat+.18)*1000));
  Cap.sinks.delete(r.sink);const chunks=r.chunks;rec=null;R=null;applyMonitor();
  try{
    if(r.error)throw new Error(r.error);
    if(!keep){phraseMessage(r.mode==='loop'&&r.added?'Loop recording cancelled — the pass in progress was discarded; '+r.added+' finished take'+(r.added===1?' is':'s are')+' kept (Undo removes them).':'Take cancelled (Esc) — nothing was added.');return;}
    if(r.mode==='punch'){
      const rate=Cap.rate||ctx.sampleRate,seg=chunksBetween(chunks,0,Infinity);if(!seg)throw new Error('No microphone audio was captured.');
      const origin=r.s0+(seg.first/rate-lat-r.T0),endAudio=origin+seg.data.length/rate;
      let a=Math.max(r.s0,origin+.002),b=Math.min(s1,endAudio-.002);
      if(b-a<.5)throw new Error('Punch was shorter than 0.5 s — nothing was added.');
      if(b-a>60)b=a+60;
      await addPunch(seg.data,rate,origin,a,b,r);
    }else{while(r.passStart(r.next+1)<=T1+.03)queuePass(r,r.next);await r.pending;if(!r.added)phraseMessage('Loop recording stopped before a full pass finished — nothing was added.');else phraseMessage('Loop recording: '+r.added+' new take'+(r.added===1?'':'s')+' on '+(r.phrase?.name||'the loop')+'. Listen and choose the best one.');}
    if(r.why){const what=r.mode==='loop'?'Loop recording':'The punch';const reason={end:'Punched out at the end of '+(r.part?.name||'the part')+' because “Stop at part end” is ON.',paused:what+' stopped by itself because the audio stopped playing (the phone or browser paused it).',hidden:what+' stopped by itself because the app went to the background (screen locked or another app opened). What was recorded is kept.'}[r.why];
      if(reason)stopNote(r.why==='end'?'Punched out at the part end':'Recording stopped by itself',reason+(r.why==='end'?' Turn it OFF on the part panel to keep punching past OUT.':''));}
    if(r.clip)toast('Some peaks clipped','The take is kept. Move back from the mic or lower the GAIN next to the mic meter, and check the clipping figure before choosing.');
  }catch(e){phraseMessage('Recording not added: '+e.message);}
  finally{capClose();renderOpen();syncPhraseUI();D.dirty=true;}
}
PV.stop=(stopTransport)=>{if(R)return stopRec(true,!!stopTransport);if(rec&&rec.mr&&rec.mr.state!=='inactive')rec.mr.stop();};
PV.cancel=()=>{if(R)return stopRec(false,false);if(rec&&rec.mr&&rec.mr.state!=='inactive'){rec.cancelled=true;rec.mr.stop();}};
PV.escape=()=>{if(!rec&&!R)return false;PV.cancel();return true;};
// where does a recorded range go? existing phrase (matching / contained) or a new phrase
function targetPhrase(a,b,mode,r){
  const w=phraseWorkspace();
  if(mode==='loop'&&r&&r.phrase&&w.phrases.includes(r.phrase))return {p:r.phrase};
  let best=null;for(const p of w.phrases){const inside=p.start>=a-.3&&p.end<=b+.3,ov=Math.min(b,p.end)-Math.max(a,p.start);if(inside&&ov>.8*(p.end-p.start)&&(!best||ov>best.ov))best={p,ov};}
  if(best){const p=best.p;const na=Math.min(p.start,a),nb=Math.max(p.end,b);return {p,extend:(p.start-na>.3||nb-p.end>.3)&&nb-na<=60?[na,nb]:null};}
  return {p:null};
}
async function addRecorded(data,rate,origin,a,b,mode){
  const w=phraseWorkspace(),pre=PhraseCore.clone(w);let r=null;if(mode==='loop')r=loopOwner;
  const tgt=targetPhrase(a,b,mode,r);let p=tgt.p,created=false;
  if(!p){if(w.phrases.length>=128)throw new Error('Up to 128 phrases per project.');PhraseCore.span(+a.toFixed(3),+b.toFixed(3));phraseCaptureBase();
    p={id:'p'+w.nextId++,name:(mode==='loop'?'Loop ':'Punch ')+fmtShort(a),start:+a.toFixed(3),end:+b.toFixed(3),selected:null,reference:null,takes:[]};w.phrases.push(p);created=true;}
  w.selected=p.id;if(loopOwner&&mode==='loop')loopOwner.phrase=p;
  try{await phraseAddAudio(p,[data],rate,origin,null);}catch(e){if(created){w.phrases=w.phrases.filter(q=>q!==p);w.selected=w.phrases.at(-1)?.id||null;syncPhraseUI();}throw e;}
  if(tgt.extend){p.start=+tgt.extend[0].toFixed(3);p.end=+tgt.extend[1].toFixed(3);for(const t of p.takes)if(t!==p.takes.at(-1))phraseAnalyze(t,p);phraseAnalyze(p.takes.at(-1),p);if(p.selected&&!PhraseCore.covers(p.takes.find(t=>t.id===p.selected),p))p.selected=null;}
  if(created||tgt.extend){phraseUndoStack[phraseUndoStack.length-1]=pre;phraseUndo=pre;}
  if(loopOwner&&mode==='loop')loopOwner.added++;
  const t=p.takes.at(-1);phraseMessage(t.name+(mode==='punch'?' punched in on ':' recorded on ')+p.name+' ('+fmt(p.start)+'–'+fmt(p.end)+')'+(created?' — new phrase.':tgt.extend?' — phrase extended.':'.')+(PhraseCore.covers(t,p)?'':' The take does not cover the whole phrase.'));
  w.cursor=Math.min(899.5,p.end);syncPhraseUI();persist();D.dirty=true;return t;
}

// 0.17.0 punch-in on the fly: the take goes into the part under the playhead.
// The new take covers the whole part: the part's chosen take (if any) with the punched section dropped in
// (15 ms fades at both edges), or silence around the punch when nothing is chosen yet. If the part had a chosen
// take, the new take is chosen in its place (one Undo goes back). No part there -> a new part is made (as before).
function partUnder(t){const L=phraseWorkspace().phrases;let hit=null;for(const p of L)if(t>=p.start-1e-6&&t<p.end)hit=p; // later parts win, like the comp
  if(hit)return hit;let next=null;for(const p of L)if(p.start>t&&p.start-t<=.5&&(!next||p.start<next.start))next=p;return next;} // pressed a moment early
PV.partUnder=partUnder;
async function addPunch(data,rate,origin,a,b,r){
  const w=phraseWorkspace(),p=r.part&&w.phrases.includes(r.part)?r.part:null;
  if(!p)return addRecorded(data,rate,origin,a,b,'punch');
  const pre=PhraseCore.clone(w),oldEnd=p.end,base0=p.takes.find(t=>t.id===p.selected),useBase0=!!(base0&&PhraseCore.covers(base0,p));let fit=null;
  if(!P.stopAtEnd&&b>p.end+.05&&a<p.end){const sung=Math.min(b,Math.max(origin+lastSound([data],rate)+.25,p.end));if(sung>p.end+.05)fit=fitOut(p,sung,(q,e)=>askTrim(p,q,e));}
  if(fit&&p.takes.length<32){if(fit.end>p.end)p.end=fit.end;if(fit.shrink){fit.shrink.start=fit.end;reAnalyze(fit.shrink);}}
  const undoFit=()=>{p.end=oldEnd;if(fit&&fit.shrink){const q0=pre.phrases.find(x=>x.id===fit.shrink.id);if(q0)fit.shrink.start=q0.start;}};
  try{
  const pa=Math.max(a,p.start),pb=Math.min(b,p.end);
  if(pb-pa<.3)throw new Error('The punch did not reach into '+p.name+' long enough (less than 0.3 s) — nothing was added.');
  if(p.takes.length>=32)throw new Error(p.name+' already has 32 takes. Delete some takes first.');
  const W=w.rate,[mono]=await phraseResample([data],rate,W),base=base0,useBase=useBase0;
  const pad=.25,o=Math.max(-9.9,+(p.start-pad).toFixed(4)),n=Math.round((p.end+pad-o)*W),nc=useBase?base.channels.length:1,out=Array.from({length:nc},()=>new Float32Array(n));
  if(useBase){const off=Math.round((o-PhraseCore.origin(base))*W),g=Math.pow(10,(base.gainDb||0)/20);for(let c=0;c<nc;c++){const src=base.channels[c],dst=out[c];for(let i=0;i<n;i++){const j=off+i;if(j>=0&&j<src.length)dst[i]=src[j]*g;}}}
  const F=Math.max(1,Math.round(.015*W)),ia=Math.round((pa-o)*W),ib=Math.round((pb-o)*W),mo=Math.round((origin-o)*W);
  for(let i=Math.max(0,ia);i<Math.min(n,ib);i++){const j=i-mo;if(j<0||j>=mono.length)continue;const wt=Math.min(1,(i-ia)/F,(ib-1-i)/F);if(wt<=0)continue;for(let c=0;c<nc;c++)out[c][i]=out[c][i]*(1-wt)+mono[j]*wt;}
  w.selected=p.id;await phraseAddAudio(p,out,W,o,null);
  }catch(e){undoFit();throw e;}
  const pa=Math.max(a,p.start),pb=Math.min(b,p.end),base=base0,useBase=useBase0;
  const t=p.takes.at(-1);t.punch={from:+pa.toFixed(3),to:+pb.toFixed(3),over:useBase?base.name:null};
  if(useBase)p.selected=t.id;
  if(p.end>oldEnd+.0005||fit&&fit.shrink){if(p.selected&&!PhraseCore.covers(p.takes.find(x=>x.id===p.selected),p))p.selected=null;for(const x of p.takes)if(x!==t)phraseAnalyze(x,p);phraseUndoStack[phraseUndoStack.length-1]=pre;phraseUndo=pre;}
  const grew=p.end>oldEnd+.0005?' You punched past the OUT flag, so '+p.name+' now ends at '+fmt(p.end)+' (was '+fmt(oldEnd)+')'+(fit.shrink?' and '+fit.shrink.name+' starts there':'')+'.':'';
  const cut=a<p.start-.05||b>p.end+.05;
  phraseChanged('Punched in '+fmt(pa)+'–'+fmt(pb)+' on '+p.name+' → '+t.name+(useBase?' ('+base.name+' with that bit replaced). '+t.name+' is now chosen; Undo or choose '+base.name+' to go back.':' (silence around the punch — no take was chosen on this part yet).')+grew+(cut?(fit&&fit.cut&&fit.cut.why==='next'?' The punch was trimmed where '+fit.cut.q.name+' starts.':fit&&fit.cut?' A part can be at most 60 s long, so the punch was trimmed there.':' Only the part between its IN and OUT was kept'+(P.stopAtEnd?' (“Stop at part end” is ON).':'.')):''));
  w.cursor=Math.min(899.5,p.end);persist();D.dirty=true;return t;}

// ================================================================ the R / Shift+R logic
function pastBackingText(p){if(!p||!S.beat)return '';const d=S.beat.duration;if(p.end<=d+.01)return '';return p.start>=d?p.name+' starts after the backing track ends ('+fmt(d)+'): you will hear no backing.':p.name+' runs past the end of the backing track ('+fmt(d)+'): the last '+(p.end-d).toFixed(1)+' s has no backing.';}
function warnPast(p){const t=pastBackingText(p);if(t)toast('Part past the backing end',t,5000);}
PV.pastBackingText=pastBackingText;
function gate(fn){if(!P.micFirst||micChecked){fn();return;}micModalOpen(fn);}
function redoPhrase(){const w=phraseWorkspace();let p=selectedPhrase();if(!p){$('phraseLabel').value='';phraseNew(w.cursor);p=selectedPhrase();if(!p)return;}
  warnPast(p);requestAnimationFrame(()=>{if(!$('phraseRecord').disabled)$('phraseRecord').click();});}
function nextPhrase(){const w=phraseWorkspace(),p=selectedPhrase();let start=p?(w.cursor>p.end+.05?w.cursor:p.end):w.cursor;start=Math.min(899,Math.round(start*1000)/1000);
  const after=w.phrases.filter(q=>q.start>start+.5).sort((x,y)=>x.start-y.start)[0];let end=Math.min(900,start+8);if(after&&after.start<end&&after.start-start>=.5)end=after.start;
  $('phraseLabel').value='';$('phraseStart').value=start;$('phraseEnd').value=end;phraseNew();const np=selectedPhrase();if(!np||np===p&&p)return;redoPhrase();}
PV.record=(shift)=>{
  if(R){if(!R.starting)stopRec(true,false);return;}
  if(rec){if(rec.mr.state!=='inactive')rec.mr.stop();return;}
  if(S.micBlocked||phraseBusy()||S.recStarting)return;
  if(!shift&&playing&&(!loop||loop.daw||loop.rcComp)){if(loop&&loop.daw)loopRecStart();else punchStart();return;}
  if(playing||playPending){if(loop)endLoop();stopPlayback();}
  gate(()=>shift?nextPhrase():redoPhrase());
};
function queuePass(owner,c){owner.next=Math.max(owner.next,c+1);owner.passes++;owner.pending=owner.pending.then(async()=>{loopOwner=owner;try{await finishLoopPassFor(owner,c);}catch(e){phraseMessage('Loop pass not added: '+e.message);}finally{loopOwner=null;owner.kept=c+1;}});}
function loopPollBound(){if(!R||R.mode!=='loop'||R.stopping)return;const ctx=audioCtx(),lat=pvsLatency();
  while(ctx.currentTime>R.passStart(R.next+1)+.15+lat+.12)queuePass(R,R.next);
  const keepFrom=(R.passStart(R.kept)-1)*Cap.rate;while(R.chunks.length&&R.chunks[0].frame+R.chunks[0].data.length<keepFrom)R.chunks.shift();}
async function finishLoopPassFor(owner,c){const lat=pvsLatency(),pre=.15,post=.15,rate=Cap.rate,ps=owner.passStart(c);
  const seg=chunksBetween(owner.chunks,Math.round((ps-pre+lat)*rate),Math.round((ps+owner.L+post+lat)*rate));if(!seg||seg.data.length<rate*.3)return;
  const origin=owner.a+(seg.first/rate-lat-ps);await addRecorded(seg.data,rate,origin,owner.a,owner.b,'loop');}

// ================================================================ takes: rename, delete unchosen (star ratings: kept in old projects' data, no longer shown)
function findTake(id){for(const p of phraseWorkspace().phrases){const t=p.takes.find(t=>t.id===id);if(t)return {p,t};}return null;}
PV.renameTake=(id,name)=>{const f=findTake(id);name=String(name||'').trim().slice(0,60);if(!f||!name||name===f.t.name)return;phraseBackup();f.t.name=name;syncPhraseUI();persist();D.dirty=true;phraseMessage('Take renamed to “'+name+'”.');};
PV.renamePhrase=(id,name)=>{const p=phraseWorkspace().phrases.find(p=>p.id===id);name=String(name||'').trim().slice(0,80);if(!p||!name||name===p.name)return;phraseBackup();p.name=name;if(phraseWorkspace().selected===id)$('phraseLabel').value=name;syncPhraseUI();persist();D.dirty=true;phraseMessage('Part renamed to “'+name+'”.');};
PV.deleteUnchosen=(all)=>{if(phraseBusy())return;const w=phraseWorkspace(),list=all?w.phrases:[selectedPhrase()].filter(Boolean);
  const n=list.reduce((n,p)=>n+p.takes.filter(t=>t.id!==p.selected).length,0);if(!n){phraseMessage(all?'No unchosen takes in any part.':'This part has no unchosen takes.');return;}
  const unchosenPhrases=list.filter(p=>!p.selected&&p.takes.length).length;
  if(!confirm('Delete '+n+' unchosen take'+(n===1?'':'s')+(all?' in all parts':' in “'+list[0].name+'”')+'?'+(unchosenPhrases?'\n\n'+unchosenPhrases+' part'+(unchosenPhrases===1?' has':'s have')+' no chosen take, so all of its takes go.':'')+'\n\nUndo (Ctrl+Z) can bring them back.'))return;
  phraseBackup();for(const p of list){p.takes=p.takes.filter(t=>t.id===p.selected);if(p.reference&&!p.takes.some(t=>t.id===p.reference))p.reference=null;}
  phraseChanged(n+' unchosen take'+(n===1?'':'s')+' deleted. Undo restores them.');};
PV.setBounds=(p,a,b)=>{if(phraseBusy())return;if(phraseWorkspace().selected!==p.id)phraseSelect(p.id);$('phraseStart').value=+a.toFixed(2);$('phraseEnd').value=+b.toFixed(2);$('phraseLabel').value=p.name;$('phraseBounds').click();warnPast(p);};
PV.takeMenu=(p,t,x,y)=>{const items=[['▶ Listen',()=>window.RC?RC.audition(t.id):phraseListen(t.id)],[p.selected===t.id?'Un-choose this take':'✓ Choose',()=>p.selected===t.id?phraseUnchoose():phraseChoose(t.id)],['Rename…',()=>PV.inlineRename('take',p,t,x,y)],[p.reference===t.id?'Stop using as melody reference':'Use as melody / timing reference',()=>{const r=$('phraseReference');if(phraseWorkspace().selected!==p.id)phraseSelect(p.id);r.value=p.reference===t.id?'':t.id;r.dispatchEvent(new Event('change'));}],['Delete take',()=>phraseRemoveTake(t.id)],['Delete unchosen takes',()=>PV.deleteUnchosen(false)]];menu(x,y,items);};
PV.phraseMenu=(p,x,y,extra)=>menu(x,y,[['Rename part…',()=>PV.inlineRename('phrase',p,null,x,y)],['● Record this part (R)',()=>window.RC?RC.record():PV.record(false)],...(extra||[]),['Delete unchosen takes',()=>PV.deleteUnchosen(false)],['Delete part…',()=>$('phraseRemove').click()]]);
function menu(x,y,items){const m=$('ctxMenu');m.innerHTML='';for(const [label,fn] of items){
    const b=document.createElement('button');b.setAttribute('role','menuitem');b.textContent=label;b.onclick=()=>{closeCtx();fn();};m.appendChild(b);}
  m.hidden=false;const r=m.getBoundingClientRect();m.style.left=Math.max(4,Math.min(innerWidth-r.width-4,x))+'px';m.style.top=Math.max(4,Math.min(innerHeight-r.height-4,y))+'px';(q('button',m)||m).focus();}
function closeCtx(){$('ctxMenu').hidden=true;}
document.addEventListener('pointerdown',e=>{if(!$('ctxMenu').hidden&&!e.target.closest('#ctxMenu'))closeCtx();},true);
PV.inlineRename=(kind,p,obj,x,y)=>{closeCtx();const inp=$('inlineEdit');const cur=kind==='phrase'?p.name:kind==='take'?obj.name:obj.name;inp.value=cur;inp.hidden=false;
  inp.style.left=Math.max(4,Math.min(innerWidth-224,x-20))+'px';inp.style.top=Math.max(4,Math.min(innerHeight-40,y-16))+'px';inp.focus();inp.select();
  const done=ok=>{inp.onkeydown=null;inp.onblur=null;inp.hidden=true;if(!ok)return;const v=inp.value;if(kind==='phrase')PV.renamePhrase(p.id,v);else if(kind==='take')PV.renameTake(obj.id,v);};
  inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();done(true);}else if(e.key==='Escape'){e.preventDefault();done(false);}};inp.onblur=()=>done(true);};

// ================================================================ mic check (RECORD & COMP meter, pre-record modal)
let mcAfter=null;
async function micCheckOn(on){
  if(on){Cap.checking=true;Cap.clip=false;Cap.hold=0;try{await capOpen();}catch(e){Cap.checking=false;toast('Mic check',e.message);syncPanel();return false;}applyMonitor();}
  else{Cap.checking=false;applyMonitor();capClose();}
  syncPanel();return true;}
PV.micCheck=()=>micCheckOn(!Cap.checking);
function micModalOpen(after){mcAfter=after;$('micModal').hidden=false;$('mcGain').value=P.micGainDb;$('mcNoAsk').checked=!P.micFirst;micCheckOn(true);}
function micModalClose(go){$('micModal').hidden=true;if($('mcNoAsk').checked){P.micFirst=false;savePrefs();}micChecked=true;const f=mcAfter;mcAfter=null;if(!$('chkToggle').dataset.keep)micCheckOn(false);if(go&&f)setTimeout(f,60);syncPanel();}
$('mcGo').onclick=()=>micModalClose(true);$('mcSkip').onclick=()=>micModalClose(true);
q('#micModal [data-close]').addEventListener('click',()=>{mcAfter=null;micCheckOn(false);});
function setGain(db){P.micGainDb=Math.max(-12,Math.min(24,Math.round(db)));savePrefs();if(Cap.gain)Cap.gain.gain.setTargetAtTime(dbToGain(P.micGainDb),Cap.ctx.currentTime,.02);syncPanel();}
PV.setGain=setGain;
function levelUI(pk,hold,clip,ids){const lv=x=>Math.max(0,Math.min(100,(20*Math.log10(x+1e-6)+60)/60*100));$(ids[0]).style.width=lv(pk)+'%';$(ids[0]).style.background=pk>.98?'var(--red)':pk>.5?'var(--amber)':'var(--green)';if(ids[1])$(ids[1]).style.left=lv(hold)+'%';
  const db=20*Math.log10(hold+1e-6);$(ids[2]).textContent=hold<.001?'— dBFS':db.toFixed(1)+' dBFS peak';$(ids[3]).classList.toggle('on',clip);
  return hold<.001?'No signal yet. Check the mic is allowed and selected.':clip?'CLIPPING — move back from the mic or lower the gain, then click CLIP to reset.':db>-6?'Hot: peaks above −6 dBFS. Back off a little for safety.':db<-30?'Quiet: move closer or raise MIC GAIN.':'Good level.';}

// ================================================================ autosave indicator + backup reminders
const BK=Object.assign({since:0,lastBackup:0,lastNag:0},LS('pvs-backup',{}));const saveBK=()=>LSset('pvs-backup',BK);
const sessionStart=Date.now();let savedAt=0,saveState='idle';
const origWrite=window.writeRemembered;
window.writeRemembered=async function(){saveState='saving';syncSaved();try{const r=await origWrite.apply(this,arguments);saveState='ok';savedAt=Date.now();return r;}catch(e){saveState='fail';throw e;}finally{syncSaved();}};
const origAdd=window.phraseAddAudio;
window.phraseAddAudio=async function(){const r=await origAdd.apply(this,arguments);BK.since++;saveBK();maybeNag();return r;};
const origSaveProject=window.saveProject;
if(typeof origSaveProject==='function')window.saveProject=async function(){const r=await origSaveProject.apply(this,arguments);if(!/fail|could not|couldn|not saved|error/i.test($('saveStatus').textContent||'')){BK.since=0;BK.lastBackup=Date.now();saveBK();syncSaved();}return r;};
function maybeNag(){const every=+P.backupEvery||0;if(!every||BK.since<every)return;if(Date.now()-BK.lastNag<10*60000)return;BK.lastNag=Date.now();saveBK();
  toast('Back up your takes',BK.since+' new takes since your last project download. Browser storage can be cleared by the phone — Settings ▾ › Save project with every take (Ctrl+S).',9000);}
PV._nag=maybeNag;PV._bk=BK;
function syncSaved(){const el=$('dawSaved');if(!el)return;const tm=d=>new Date(d).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  el.className='savedind '+saveState+(BK.since>=(+P.backupEvery||Infinity)?' nag':'');
  el.textContent=saveState==='saving'?'● saving…':saveState==='fail'?'⚠ not saved':savedAt?'✓ saved '+tm(savedAt):'';
  if(BK.since&&+P.backupEvery&&BK.since>=+P.backupEvery)el.textContent+=' · back up ('+BK.since+' new)';
  el.title='Autosave on this browser'+(savedAt?' · last '+tm(savedAt):'')+(BK.lastBackup?' · last project download '+new Date(BK.lastBackup).toLocaleString():' · no project download yet');
  if($('bkInfo'))$('bkInfo').textContent=(savedAt?'Autosaved on this browser at '+tm(savedAt)+'. ':'Autosave runs after every change. ')+(BK.lastBackup?'Last project download: '+new Date(BK.lastBackup).toLocaleString()+'. ':'No project download yet. ')+BK.since+' new take'+(BK.since===1?'':'s')+' since.';}
$('dawSaved').onclick=()=>{if(BK.since&&!$('phraseSave').disabled)$('phraseSave').click();};

// ================================================================ panel wiring
function bindSwitch(id,key,after){const el=$(id);el.checked=!!P[key];el.onchange=()=>{P[key]=el.checked;savePrefs();if(after)after();syncPanel();};}
bindSwitch('optCountIn','countIn');bindSwitch('optMetro','metro');bindSwitch('optHearOld','hearOld');bindSwitch('optMicFirst','micFirst');
bindSwitch('optMonitor','monitor',async()=>{if(P.monitor){toast('Input monitoring on','Wired headphones only. Expect a small delay ('+Math.round(pvsLatency()*1000)+' ms or more). Turn it off if you hear an echo or howl.',7000);}applyMonitor();});
$('optCountBars').value=String(P.countBars);$('optCountBars').onchange=()=>{P.countBars=+$('optCountBars').value===2?2:1;savePrefs();syncPanel();};
$('optClickVol').value=Math.round(P.clickVol*100);$('optClickVol').oninput=()=>{P.clickVol=+$('optClickVol').value/100;savePrefs();syncPanel();};
$('optMonVol').value=Math.round(P.monitorVol*100);$('optMonVol').oninput=()=>{P.monitorVol=+$('optMonVol').value/100;savePrefs();applyMonitor();syncPanel();};
$('optMicGain').oninput=()=>setGain(+$('optMicGain').value);$('mcGain').oninput=()=>setGain(+$('mcGain').value);
$('optBackupEvery').value=String(P.backupEvery);$('optBackupEvery').onchange=()=>{P.backupEvery=+$('optBackupEvery').value;savePrefs();syncSaved();};
$('chkToggle').onclick=()=>PV.micCheck();
for(const id of ['chkClip','mcClip'])$(id).onclick=()=>PV.clipReset();
PV.toggle=k=>{P[k]=!P[k];savePrefs();syncPanel();if(k==='metro')phraseMessage('Metronome '+(P.metro?'on':'off')+' (headphones only, never recorded).');if(k==='countIn')phraseMessage('Count-in '+(P.countIn?P.countBars+' bar'+(P.countBars>1?'s':''):'off')+'.');};
$('latMs').onchange=()=>{const v=+$('latMs').value;if(Number.isFinite(v)&&v>=0&&v<=800)latStore(v,'manual');};
$('latAuto').onclick=()=>{delete Lat[latKey()];if(Lat.__last===latKey())delete Lat.__last;LSset('pvs-latency',Lat);syncPanel();};
PV.latAuto=()=>$('latAuto').click();PV.latInfo=()=>$('latInfo').textContent;
$('latCal').onclick=()=>PV.calOpen();$('calLoop').onclick=calLoopback;$('calTapStart').onclick=calTapStart;
$('calTap').addEventListener('pointerdown',e=>{e.preventDefault();calTapHit(e);});
document.addEventListener('keydown',e=>{if(!$('calModal').hidden&&tap&&(e.key==='t'||e.key==='T'||e.key===' ')){e.preventDefault();e.stopPropagation();calTapHit(e);}},true);
$('calSave').onclick=()=>{if(!calPending)return;latStore(calPending.ms,calPending.method,calPending.detail);$('calResult').textContent='Saved: '+calPending.ms.toFixed(1)+' ms for '+latKey()+'. New takes use it.';$('calSave').disabled=true;};
function syncPanel(){
  $('optCountIn').checked=P.countIn;$('optMetro').checked=P.metro;$('optHearOld').checked=P.hearOld;$('optMonitor').checked=P.monitor;$('optMicFirst').checked=P.micFirst;
  $('optClickVolVal').textContent=Math.round(P.clickVol*100)+'%';$('optMonVolVal').textContent=Math.round(P.monitorVol*100)+'%';$('clickBpm').textContent=bpm();
  for(const id of ['optMicGain','mcGain'])if(document.activeElement!==$(id))$(id).value=P.micGainDb;const gtxt=(P.micGainDb>0?'+':'')+P.micGainDb+' dB';$('optMicGainVal').textContent=gtxt;$('mcGainVal').textContent=gtxt;
  $('chkToggle').setAttribute('aria-pressed',Cap.checking);$('chkToggle').textContent=Cap.checking?'Stop mic check':'Start mic check';
  const e=latEntry(),auto=Math.round(autoLatency()*1000);$('monLat').textContent=Math.round(pvsLatency()*1000+10);
  $('latInfo').textContent=(e?'Using '+e.ms+' ms ('+e.method+(e.detail?', '+e.detail:'')+', '+e.date+')':'Using automatic estimate: '+auto+' ms (browser output + base latency; the input side is not reported by browsers)')+' for '+latKey()+'.';
  if(document.activeElement!==$('latMs'))$('latMs').value=Math.round(pvsLatency()*1000);
  syncSaved();
}
PV.syncPanel=syncPanel;PV.prefs=P;PV.cap=Cap;PV.latKey=latKey;
// past-backing warning text for the (hidden) phrase engine status
const origSync=window.syncPhraseUI;
window.syncPhraseUI=function(){const r=origSync.apply(this,arguments);if(!phraseReady)return r;const p=selectedPhrase();
  const warn=pastBackingText(p);$('phraseWarn').hidden=!warn;$('phraseWarn').textContent=warn?'⚠ '+warn:'';return r;};
PV.frame=now=>{
  // 0.17.0 fix: input monitoring opened for a normal take is switched off and released when that take ends (it stayed on before)
  if(Cap.forRec&&!rec&&!S.recStarting){Cap.forRec=false;applyMonitor();capClose();}
  if(rec&&rec.target==='phrase'&&rec.phrase&&rec.phrase.free&&rec.t0){const o=rec.phrase,el=(performance.now()-rec.t0)/1000,st=rec.origin+el;
    if(!rec.outNoted&&st>o.p.end+.3){rec.outNoted=true;phraseMessage('● Still recording past the OUT flag of '+o.p.name+' — the part will get longer to fit. Press R, Space or Stop when you have finished.');}
    if(!rec.beatNoted&&rec.beatGain&&S.beat&&st>S.beat.duration){rec.beatNoted=true;toast('The backing track has ended','Still recording. Press Stop (R or Space) when you have finished.',7000);}
    if(!rec.capNoted&&o.cap>90&&el>o.cap-60){rec.capNoted=true;toast('Recording stops in 1 minute','One take can be at most '+capText(o.cap)+' long (a safety limit). Press Stop soon and record the rest as another part.',10000);}}
  if(R&&R.mode==='punch'&&!R.beatNoted&&S.beat&&$('beatOn').checked&&playing&&currentPos()>S.beat.duration){R.beatNoted=true;toast('The backing track has ended','Still punching in. Press R to punch out.',7000);}
  if(rec){const t=R?(R.mode==='punch'?'PUNCH '+fmt(R.s0)+'→'+fmt(D.playheadTime()):'LOOP pass '+(R.passes+1)+' · '+R.added+' takes'):null;if(t)$('pvsRecTime').textContent=t;}
  const clip=PV.clipOn();
  if(!$('micModal').hidden)$('mcAdvice').textContent=levelUI(Cap.peak,Cap.hold,clip,['mcMeter','mcHold','mcPeak','mcClip']);
  if(now-(PV._ps||0)>500){PV._ps=now;syncPanel();}
};
// stop & keep a punch/loop when the page is hidden; R is not active across reloads
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&R)stopRec(true,true,'hidden');});
// playback ended while punching (song end / Stop) -> punch out
setInterval(()=>{if(!R||R.starting||R.stopping)return;
  if(!playing){stopRec(true,false,'paused');return;}
  // 0.17.1: "Stop at part end" ON also punches out at the part's OUT flag (the song keeps playing)
  if(R.mode==='punch'&&P.stopAtEnd&&R.part&&phraseWorkspace().phrases.includes(R.part)&&R.s0<R.part.end&&currentPos()>=R.part.end+.05)stopRec(true,false,'end');},100);
syncPanel();syncSaved();
})();
