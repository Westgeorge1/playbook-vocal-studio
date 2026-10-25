/* 0.27.0: measurable reference guidance; no learned voice model or pitch decisions. */
(function(root){
'use strict';
const Q=root.QualityCore||(typeof require==='function'?require('./quality-core.js'):null);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),db=x=>10*Math.log10(Math.max(x,1e-20));
const quantile=(a,q)=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=(b.length-1)*q,k=Math.floor(i);return b[k]+(b[Math.min(k+1,b.length-1)]-b[k])*(i-k);};
function fft(re,im,inverse=false){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len<<=1){const ang=(inverse?2:-2)*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let a=0;a<n;a+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const u=a+j,v=u+len/2,tr=re[v]*cr-im[v]*ci,ti=re[v]*ci+im[v]*cr;re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;}}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
function analyze(ch,rate){
 const count=Q.check(ch,rate),seconds=count/rate;if(seconds<3||seconds>30.001)throw Error('Choose a sung passage from 3 to 30 seconds.');
 const frame=Math.round(rate*.04),hop=Math.round(rate*.02);let size=1;while(size<frame*2)size*=2;
 const win=Float64Array.from({length:frame},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(frame-1))),w0=win.reduce((s,x)=>s+x*x,0),wc=new Float64Array(Math.ceil(rate/70)+1);
 for(let lag=Math.floor(rate/500);lag<wc.length;lag++){let p=0;for(let i=0;i<frame-lag;i++)p+=win[i]*win[i+lag];wc[lag]=p/w0;}
 const rows=[],edges=[80,300,2000,6000,Math.min(16000,rate/2)],re=new Float64Array(size),im=new Float64Array(size),power=new Float64Array(size);let maxLevel=-200;
 for(let a=0;a+frame<=count;a+=hop){
  let total=0,midPower=0,sidePower=0,cross=0,left=0,right=0;
  for(let j=0;j<frame;j++){const l=ch[0][a+j],r=ch.length===2?ch[1][a+j]:l,m=(l+r)/2,s=(l-r)/2;total+=(l*l+r*r)/2;midPower+=m*m;sidePower+=s*s;left+=l*l;right+=r*r;cross+=l*r;}
  const level=db(total/frame);maxLevel=Math.max(maxLevel,level);const bands=[0,0,0,0];power.fill(0);
  // Average channel powers; never sum stereo before tonal analysis.
  for(const c of ch){re.fill(0);im.fill(0);let mean=0;for(let j=0;j<frame;j++)mean+=c[a+j];mean/=frame;for(let j=0;j<frame;j++)re[j]=(c[a+j]-mean)*win[j];fft(re,im);for(let k=0;k<size;k++)power[k]+=(re[k]*re[k]+im[k]*im[k])/ch.length;}
  let sum=0;for(let k=1;k<=size/2;k++){const hz=k*rate/size,p=power[k];for(let b=0;b<4;b++)if(hz>=edges[b]&&hz<edges[b+1]){bands[b]+=p;sum+=p;break;}}
  // Window-corrected autocorrelation is a voiced-like proxy, not a note detector.
  re.set(power);im.fill(0);fft(re,im,true);let periodic=0;for(let lag=Math.floor(rate/500)+1;lag<wc.length-1;lag++)if(wc[lag-1]>.3&&wc[lag+1]>.3&&re[0]>0){const here=re[lag]/wc[lag];if(here>re[lag-1]/wc[lag-1]&&here>=re[lag+1]/wc[lag+1])periodic=Math.max(periodic,here/re[0]);}
  const air=sum?bands[3]/sum:0;rows.push({level,bands,sum,periodic:clamp(periodic,0,1),high:air>.3&&periodic<.65,midPower,sidePower,cross,left,right});
 }
 const active=rows.filter(x=>x.level>Math.max(-55,maxLevel-30)&&x.sum>0),voiced=active.filter(x=>x.periodic>=.65&&!x.high),high=active.filter(x=>x.high);
 if(active.length*hop/rate<1||maxLevel< -55)throw Error('This passage is too quiet. Choose a section with audible singing.');
 const sums=[0,0,0,0];for(const x of voiced)for(let i=0;i<4;i++)sums[i]+=x.bands[i];const sum=sums.reduce((a,b)=>a+b,0),tone=sum?sums.map(x=>x/sum):[0,0,0,0];
 const levels=voiced.map(x=>x.level),m=active.reduce((s,x)=>s+x.midPower,0),side=active.reduce((s,x)=>s+x.sidePower,0),l=active.reduce((s,x)=>s+x.left,0),r=active.reduce((s,x)=>s+x.right,0),cross=active.reduce((s,x)=>s+x.cross,0);
 const measured=Q.measure(ch,rate),median=quantile(levels,.5),hp=quantile(high.map(x=>x.level),.75);
 return {v:1,rate,seconds,channels:ch.length,lufs:measured.lufs,truePeak:measured.truePeak,activeSeconds:active.length*hop/rate,voicedSeconds:voiced.length*hop/rate,highSeconds:high.length*hop/rate,tone,voicedSpread:levels.length?quantile(levels,.9)-quantile(levels,.1):null,highRelative:median!==null&&hp!==null?hp-median:null,sidePercent:m+side?100*side/(m+side):0,correlation:l*r?clamp(cross/Math.sqrt(l*r),-1,1):1};
}
function validate(p){
 if(!p||p.v!==1||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||typeof p.sourceName!=='string'||p.sourceName.length>200||!Number.isFinite(p.start)||p.start<0||p.start>900||!p.profile||JSON.stringify(p).length>8192)throw Error('Invalid saved reference profile.');
 const q=p.profile,range=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
 if(q.v!==1||!range(q.rate,8000,192000)||!range(q.seconds,3,30.001)||p.start+q.seconds>900.001||![1,2].includes(q.channels)||!range(q.truePeak,-200,100)||q.lufs!==null&&!range(q.lufs,-100,100)||!Array.isArray(q.tone)||q.tone.length!==4||q.tone.some(x=>!range(x,0,1))||q.tone.reduce((a,b)=>a+b,0)>1.00001)throw Error('Invalid reference measurements.');
 if(q.activeSeconds<1||q.voicedSeconds>q.activeSeconds+.001||q.highSeconds>q.activeSeconds+.001||q.voicedSeconds+q.highSeconds>q.activeSeconds+.05)throw Error('Invalid reference activity totals.');
 for(const k of ['activeSeconds','voicedSeconds','highSeconds'])if(!range(q[k],0,q.seconds+.05))throw Error('Invalid reference activity.');
 if(!range(q.sidePercent,0,100)||!range(q.correlation,-1,1)||q.voicedSpread!==null&&!range(q.voicedSpread,0,150)||q.highRelative!==null&&!range(q.highRelative,-150,150))throw Error('Invalid reference dynamics.');
 return p;
}
function suggest(own,ref,P,locked=[]){
 const cards=[],notes=[],protectedSet=new Set(locked),add=(id,title,reason,listen,changes)=>{const entries=Object.entries(changes).filter(([k,v])=>Number.isFinite(v)&&v!==P[k]);if(entries.some(([k])=>protectedSet.has(k))){notes.push(title+': your Keep my choice setting is protected.');return;}if(entries.length)cards.push({id,title,reason,listen,changes:Object.fromEntries(entries)});};
 if(!(P.chainOn>.5))return {cards,notes:['Enable the vocal chain and listen to its current sound before requesting parameter suggestions.']};
 const voices=own.voicedSeconds>=1&&ref.voicedSeconds>=1;
 if(!voices)notes.push('Not enough clearly periodic singing in both passages for tone or leveling advice. Choose a solo sustained phrase.');
 if(Math.min(own.rate,ref.rate)<32000)notes.push('These sample rates do not cover the full air band equally. High-band and de-essing suggestions are withheld.');
 const highComparable=voices&&own.highSeconds>=.1&&ref.highSeconds>=.1&&own.highRelative!==null&&ref.highRelative!==null&&Math.min(own.rate,ref.rate)>=32000;
 const sharp=highComparable&&own.highRelative-ref.highRelative>3;
 if(sharp)add('sibilance','Try slightly more de-essing','High-frequency bursts stand out '+(own.highRelative-ref.highRelative).toFixed(1)+' dB more above the sung frames than in the reference. These may include S sounds or breaths.','Compare S and SH sounds, then check that words and brightness remain intact.',{chDeEss:clamp((P.chDeEss||0)+1,0,12)});
 if(!highComparable)notes.push('Too few comparable high-frequency bursts to recommend a de-esser change. Check S sounds and breaths by listening.');
 if(voices){
  const toneDelta=own.tone.map((v,i)=>db((ref.tone[i]+1e-6)/(v+1e-6)));
  const eq=(id,key,label,delta,freqKey,freq,lo,hi)=>{
   if(Math.abs(delta)<2||!Number.isFinite(delta))return;
   if(id==='air'&&delta>0&&sharp){notes.push('Air boost withheld: first compare the stronger high-frequency bursts.');return;}
   const bypass=P.chToneBypass>.5;
   if(!bypass&&!(P[freqKey]>=lo&&P[freqKey]<=hi)){notes.push(label+': your custom EQ frequency is outside the compared band; review it manually.');return;}
   const change=clamp(Math.round(delta*.25*4)/4,-1,1),changes=bypass?{chToneBypass:0,chToneBodyGain:0,chToneMidGain:0,chToneHighGain:0,chToneBodyFreq:180,chToneMidFreq:1000,chToneHighFreq:8000,chToneMidQ:1}:{};
   changes[key]=clamp((bypass?0:P[key]||0)+change,-6,6);
   add(id,(change>0?'Try a little more ':'Try a little less ')+label.toLowerCase(),label+' has a different share of the tone during sustained singing. This is a small trial, not an exact EQ match.'+(bypass?' Enables the second EQ from a flat starting point.':''),'Use similar notes and vowels in both passages. Keep your vocal character; reject a change that sounds thinner or harsher.',changes);
  };
  eq('body','chToneBodyGain','Body',toneDelta[0],'chToneBodyFreq',180,80,300);
  // Presence uses the final mid bell only when its actual frequency addresses presence.
  if(!(P.chToneBypass>.5)&&P.chToneMidFreq>=2000&&P.chToneMidFreq<=6000)eq('presence','chToneMidGain','Presence',toneDelta[2],'chToneMidFreq',3000,2000,6000);
  if(Math.min(own.rate,ref.rate)>=32000)eq('air','chToneHighGain','Air',toneDelta[3],'chToneHighFreq',8000,6000,16000);
  if(own.voicedSpread!==null&&ref.voicedSpread!==null&&own.voicedSpread>Math.max(6,ref.voicedSpread+3))add('level','Try gentler word-to-word variation','Your measured sung level range is '+own.voicedSpread.toFixed(1)+' dB; the reference is '+ref.voicedSpread.toFixed(1)+' dB. The comparison leaves out quiet pauses and sections that do not resemble sustained singing.','Listen to quiet words, breaths and phrase emphasis. This adjusts the existing word-leveling processor, not the reference loudness.',{chLevelRide:clamp((P.chLevelRide||0)+.05,0,1)});
 }
 if(own.sidePercent>ref.sidePercent+5){
  if(P.chDoubleOn>.5&&P.chDoubleMix>0)add('width','Try less vocal doubling','Your passage has '+own.sidePercent.toFixed(1)+'% side energy; the reference has '+ref.sidePercent.toFixed(1)+'%. Width can also come from harmonies, reverb or the original recording.','Compare in stereo and mono. This only reduces the existing doubler; it does not remove backing vocals.',{chDoubleMix:Math.max(0,P.chDoubleMix-3)});
  else notes.push('Your passage is wider. The doubler is not contributing: compare the original stereo recording, harmonies and reverb manually.');
 }
 if(own.correlation<.2)notes.push('Low stereo correlation: check mono playback before changing width.');
 notes.push('Reverb and delay amounts cannot be recovered reliably from this profile. Use Vocal Detail to compare space at matched volume.');
 if(!cards.length)notes.unshift('No clear small adjustment was found. This does not rate the quality of your singing.');
 return {cards:cards.slice(0,5),notes};
}
const api={analyze,validate,suggest,fft,quantile};root.ReferenceCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
