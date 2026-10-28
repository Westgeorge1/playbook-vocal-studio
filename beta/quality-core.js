/* Playbook Vocal Studio 0.26.0 — offline finish measurements and transparent output control.
 * Independent of the locked vocal engine. See QUALITY-NOTES-0.26.0.md for algorithms and limits. */
(function(root){
'use strict';
const db=x=>x>0?20*Math.log10(x):-Infinity, gain=x=>Math.pow(10,x/20);
function check(ch,rate){if(!Number.isFinite(rate)||rate<8000||rate>192000||!Array.isArray(ch)||!ch.length||ch.length>2||!ch[0]?.length)throw Error('Use non-empty mono or stereo audio at 8–192 kHz.');const n=ch[0].length;for(const c of ch){if(!(c instanceof Float32Array)||c.length!==n)throw Error('Audio channels must have equal lengths.');for(const x of c)if(!Number.isFinite(x))throw Error('Audio contains invalid samples.');}return n;}
function filters(rate){const f=(hz,q,vh=1,vb=1,hp=false)=>{const k=Math.tan(Math.PI*hz/rate),a=1+k/q+k*k;return hp?[1,-2,1,2*(k*k-1)/a,(1-k/q+k*k)/a]:[(vh+vb*k/q+k*k)/a,2*(k*k-vh)/a,(vh-vb*k/q+k*k)/a,2*(k*k-1)/a,(1-k/q+k*k)/a];};const vh=gain(3.999843853973347);return [f(1681.974450955533,.7071752369554196,vh,Math.pow(vh,.4996667741545416)),f(38.13547087602444,.5003270373238773,1,1,true)];}
function stage(coeff){let z1=0,z2=0;const [b0,b1,b2,a1,a2]=coeff;return x=>{const y=b0*x+z1;z1=b1*x-a1*y+z2;z2=b2*x-a2*y;return y;};}
function loudness(ch,rate){const n=ch[0].length,block=Math.round(.4*rate),hop=Math.round(.1*rate);if(n<block)return null;
 const count=Math.floor((n-block)/hop)+1,energies=new Float64Array(count),co=filters(rate);
 for(const c of ch){const s1=stage(co[0]),s2=stage(co[1]),ring=new Float64Array(block);let sum=0;for(let i=0;i<n;i++){const y=s2(s1(c[i])),p=y*y,j=i%block;sum+=p-ring[j];ring[j]=p;if(i+1>=block&&(i+1-block)%hop===0)energies[(i+1-block)/hop]+=Math.max(0,sum/block);}}
 const absolute=Math.pow(10,(-70+.691)/10),above=Array.from(energies).filter(x=>x>absolute);if(!above.length)return null;const relative=above.reduce((s,x)=>s+x,0)/above.length*.1,kept=above.filter(x=>x>relative);return -.691+10*Math.log10(kept.reduce((s,x)=>s+x,0)/kept.length);
}
// 4x reconstruction with 48 taps per fractional phase, Blackman-windowed sinc.
// Keeps original samples in the maximum; includes zero-padded file boundaries.
const HALF=24,PHASES=[.25,.5,.75].map(fr=>{const a=[];let sum=0;for(let j=-HALF+1;j<=HALF;j++){const x=fr-j,w=.42+.5*Math.cos(Math.PI*x/HALF)+.08*Math.cos(2*Math.PI*x/HALF),v=Math.sin(Math.PI*x)/(Math.PI*x)*w;a.push([j,v]);sum+=v;}return a.map(([j,v])=>[j,v/sum]);});
const TP_COEFF=PHASES.map(p=>Float64Array.from(p,x=>x[1]));
function truePeak(ch){let p=0;const [k0,k1,k2]=TP_COEFF;for(const c of ch){for(const x of c)p=Math.max(p,Math.abs(x));const pad=new Float32Array(c.length+4*HALF);pad.set(c,2*HALF);for(let i=1;i<=c.length+2*HALF;i++){let a=0,b=0,d=0;for(let j=0;j<2*HALF;j++){const x=pad[i+j];a+=x*k0[j];b+=x*k1[j];d+=x*k2[j];}p=Math.max(p,Math.abs(a),Math.abs(b),Math.abs(d));}}return p;}
function measure(ch,rate,{peaks=true}={}){const n=check(ch,rate);let peak=0,ss=0,clipped=0;for(const c of ch)for(const x of c){peak=Math.max(peak,Math.abs(x));ss+=x*x;if(Math.abs(x)>=1)clipped++;}const tp=peaks?truePeak(ch):peak;return {seconds:n/rate,channels:ch.length,samplePeak:db(peak),truePeak:db(tp),lufs:loudness(ch,rate),rms:db(Math.sqrt(ss/(n*ch.length))),clipped,crest:ss>0?db(peak)-db(Math.sqrt(ss/(n*ch.length))):null};}
function finish(ch,rate,opts={}){check(ch,rate);const ceiling=opts.ceiling??-1.6,target=opts.target??null,mode=opts.mode??'gain';if(!Number.isFinite(ceiling)||ceiling< -6||ceiling>-.3||!['gain','limit'].includes(mode)||(target!==null&&(!Number.isFinite(target)||target< -24||target> -10)))throw Error('Invalid finish settings.');const before=measure(ch,rate),wanted=target!==null&&before.lufs!==null?Math.max(-12,Math.min(12,target-before.lufs)):0;
 const applied=mode==='gain'?Math.min(wanted,ceiling-before.truePeak):wanted,out=ch.map(c=>Float32Array.from(c,x=>x*gain(applied)));let reduction=0,trim=0;
 if(mode==='limit'){const n=out[0].length,env=new Float32Array(n),cap=gain(ceiling),release=Math.exp(-1/(rate*.08)),attack=Math.exp(-1/(rate*.003));let g=1;
  for(let i=0;i<n;i++){let p=0;for(const c of out)p=Math.max(p,Math.abs(c[i]));const need=p>cap?cap/p:1;g=Math.min(need,1-(1-g)*release);env[i]=g;}
  for(let i=n-2;i>=0;i--)env[i]=Math.min(env[i],1-(1-env[i+1])*attack);
  for(let i=0;i<n;i++){reduction=Math.max(reduction,-db(env[i]));for(const c of out)c[i]*=env[i];}
 }
 // A small margin covers Float32 rounding; post-limiter reconstruction is checked again.
 const p=truePeak(out),cap=gain(ceiling-.001);if(p>cap){trim=db(cap/p);const g=gain(trim);for(const c of out)for(let i=0;i<c.length;i++)c[i]*=g;}
 const after=measure(out,rate);return {channels:out,before,after,settings:{ceiling,target,mode},gainDb:applied,maxReduction:reduction,safetyTrimDb:trim,targetReached:target===null||after.lufs!==null&&Math.abs(after.lufs-target)<.5};
}
function match(a,b){const ar=Number.isFinite(a.lufs)?a.lufs:a.rms,br=Number.isFinite(b.lufs)?b.lufs:b.rms;if(!Number.isFinite(ar)||!Number.isFinite(br))return [0,0];const target=Math.min(ar,br),ga=gain(target-ar),gb=gain(target-br),safe=Math.min(1,gain(-1-a.truePeak)/ga,gain(-1-b.truePeak)/gb);return [ga*safe,gb*safe];}
const api={check,db,gain,filters,loudness,truePeak,measure,finish,match};root.QualityCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
