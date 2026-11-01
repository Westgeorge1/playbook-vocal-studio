/* 0.33.0: live pitch guide while recording in Song & vocals. Shows the note being sung against the piano and how far
 * it is from the nearest note of the song's key, so the singer can sing closer to pitch and tuning has less to do.
 * Analysis only: it reads a copy of the microphone signal and never changes what is recorded. */
(function(root){
'use strict';
const NAMES=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
// YIN pitch estimate over one block. Returns Hz or 0 when no clear pitch.
function yin(buf,rate,minHz=70,maxHz=1100,threshold=.15){
 const n=buf.length,maxTau=Math.min(Math.floor(rate/minHz),Math.floor(n/2)),minTau=Math.max(2,Math.floor(rate/maxHz)),d=new Float32Array(maxTau+1);
 let rms=0;for(let i=0;i<n;i++)rms+=buf[i]*buf[i];rms=Math.sqrt(rms/n);if(rms<.004)return 0;
 const W=n-maxTau;for(let t=1;t<=maxTau;t++){let s=0;for(let i=0;i<W;i++){const x=buf[i]-buf[i+t];s+=x*x;}d[t]=s;}
 let run=0;d[0]=1;for(let t=1;t<=maxTau;t++){run+=d[t];d[t]=d[t]*t/(run||1);}
 let tau=-1;for(let t=minTau;t<=maxTau;t++){if(d[t]<threshold){while(t+1<=maxTau&&d[t+1]<d[t])t++;tau=t;break;}}
 if(tau<0)return 0;const a=d[tau-1]??d[tau],b=d[tau],c=d[tau+1]??d[tau],den=a-2*b+c,shift=den?(a-c)/(2*den):0;return rate/(tau+shift);}
// Nearest note of the key/scale (scale = list of semitones above the key). Returns {midi, cents}.
function nearest(midi,key=0,scale=[0,1,2,3,4,5,6,7,8,9,10,11]){let best=null;for(let m=Math.floor(midi)-2;m<=Math.ceil(midi)+2;m++){if(!scale.includes(((m-key)%12+12)%12))continue;const c=(midi-m)*100;if(!best||Math.abs(c)<Math.abs(best.cents))best={midi:m,cents:c};}return best||{midi:Math.round(midi),cents:(midi-Math.round(midi))*100};}
const name=m=>NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1);
let state=null;
function attach(ctx,node,opt={}){detach();if(!root.document)return;const el=root.document.getElementById('sgPitch');if(!el||opt.enabled===false)return;
 const an=ctx.createAnalyser();an.fftSize=4096;an.smoothingTimeConstant=0;node.connect(an);
 const buf=new Float32Array(an.fftSize),cv=root.document.getElementById('sgPitchCanvas'),txt=root.document.getElementById('sgPitchText');
 state={an,node,raf:0,last:0,hist:[],key:opt.key||(()=>({key:0,scale:null})),ref:opt.ref||(()=>440)};el.hidden=false;
 const tick=now=>{if(!state)return;state.raf=requestAnimationFrame(tick);if(now-state.last<45)return;state.last=now;an.getFloatTimeDomainData(buf);
  const hz=yin(buf,ctx.sampleRate),k=state.key(),ref=state.ref()||440;let info=null;
  if(hz){const midi=69+12*Math.log2(hz/ref),nn=nearest(midi,k.key||0,k.scale||undefined);info={hz,midi,target:nn.midi,cents:nn.cents};}
  state.hist.push(info);if(state.hist.length>60)state.hist.shift();draw(cv,txt,info,state.hist,k);};
 state.raf=requestAnimationFrame(tick);}
function draw(cv,txt,info,hist,k){if(!cv)return;const g=cv.getContext('2d'),w=cv.width,h=cv.height;g.clearRect(0,0,w,h);
 // cents lane: centre line = in tune, ±50 cents at the edges
 g.fillStyle='#14222e';g.fillRect(0,0,w,h);g.fillStyle='#1f4f3a';g.fillRect(0,h/2-h*.15,w,h*.3);g.strokeStyle='#3e5a70';g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
 hist.forEach((p,i)=>{if(!p)return;const x=i/(hist.length-1||1)*w,y=h/2-Math.max(-50,Math.min(50,p.cents))/50*(h/2-2);const a=Math.abs(p.cents);g.fillStyle=a<=15?'#62e3a0':a<=30?'#f5c875':'#ff8a8a';g.fillRect(x-1.5,y-1.5,3,3);});
 if(!info){txt.textContent='Sing to see your pitch';txt.className='';return;}
 const a=Math.abs(info.cents),dir=info.cents>0?'sharp':'flat';txt.className=a<=15?'ok':a<=30?'near':'off';
 txt.textContent=name(Math.round(info.midi))+' · '+(a<=15?'in tune':Math.round(a)+'¢ '+dir)+(k.scale&&k.scale.length<12?' · key note '+name(info.target):'');}
function detach(){if(!state)return;cancelAnimationFrame(state.raf);try{state.node.disconnect(state.an);}catch(_){}const el=root.document?.getElementById('sgPitch');if(el)el.hidden=true;state=null;}
const api={yin,nearest,name,attach,detach,active:()=>!!state};root.LivePitch=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
