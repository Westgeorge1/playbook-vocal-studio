/* 0.33.0: chord detection on the backing (riddim), for chord-aware tuning in the note editor. Chroma from a
 * log-frequency map of the spectrum (55-1760 Hz), matched against major and minor triads, then smoothed.
 * Returns segments [{t0,t1,root,minor,pcs,name,confidence}] in seconds; "N" when no chord is clear.
 * Works in the browser (window.ChordCore) and in Node (module.exports). */
(function(root){
'use strict';
const NAMES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let s=2;s<=n;s*=2){const h=s/2,a=-2*Math.PI/s;for(let i=0;i<n;i+=s)for(let k=0;k<h;k++){const c=Math.cos(a*k),d=Math.sin(a*k),p=i+k,q=p+h,xr=re[q]*c-im[q]*d,xi=re[q]*d+im[q]*c;re[q]=re[p]-xr;im[q]=im[p]-xi;re[p]+=xr;im[p]+=xi;}}}
const TEMPL=[];for(let r=0;r<12;r++){TEMPL.push({root:r,minor:false,pcs:[r,(r+4)%12,(r+7)%12]});TEMPL.push({root:r,minor:true,pcs:[r,(r+3)%12,(r+7)%12]});}
function detect(x,rate,opt={}){
 // decimate to about 11 kHz
 const dec=Math.max(1,Math.floor(rate/11025)),sr=rate/dec,n=Math.floor(x.length/dec),y=new Float32Array(n);
 for(let i=0;i<n;i++){let s=0;for(let j=0;j<dec;j++)s+=x[i*dec+j];y[i]=s/dec;}
 const N=4096,H=opt.hop?Math.round(opt.hop*sr):2048,win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/N);
 const binPc=new Int8Array(N/2),binW=new Float32Array(N/2);for(let k=1;k<N/2;k++){const f=k*sr/N;if(f<55||f>1760){binPc[k]=-1;continue;}const m=69+12*Math.log2(f/440),near=Math.round(m),dist=Math.abs(m-near);binPc[k]=dist<.35?((near%12)+12)%12:-1;binW[k]=1-dist/.35;}
 const frames=[],re=new Float64Array(N),im=new Float64Array(N);let maxE=0;
 for(let o=0;o+N<=n;o+=H){for(let i=0;i<N;i++){re[i]=y[o+i]*win[i];im[i]=0;}fft(re,im);const ch=new Float64Array(12);let e=0;for(let k=1;k<N/2;k++){if(binPc[k]<0)continue;const m=Math.hypot(re[k],im[k]);ch[binPc[k]]+=m*binW[k];e+=m;}frames.push({t:(o+N/2)/sr,ch,e});maxE=Math.max(maxE,e);}
 const labels=frames.map(f=>{if(f.e<maxE*.03)return {k:-1,c:0};const s=Math.hypot(...f.ch)||1,c=Array.from(f.ch,v=>v/s);let best=-1,bv=0;TEMPL.forEach((t,i)=>{const v=(c[t.pcs[0]]*1.1+c[t.pcs[1]]+c[t.pcs[2]]*.9)/Math.sqrt(3);if(v>bv){bv=v;best=i;}});return {k:bv>.55?best:-1,c:bv};});
 // mode filter over 5 frames
 const sm=labels.map((_,i)=>{const cnt=new Map();for(let j=Math.max(0,i-2);j<=Math.min(labels.length-1,i+2);j++)cnt.set(labels[j].k,(cnt.get(labels[j].k)||0)+1);let bk=labels[i].k,bc=0;for(const [k,c] of cnt)if(c>bc){bc=c;bk=k;}return bk;});
 const out=[];const step=H/sr;
 sm.forEach((k,i)=>{const t0=Math.max(0,frames[i].t-step/2),t1=frames[i].t+step/2,last=out[out.length-1];if(last&&last.k===k){last.t1=t1;last.cs.push(labels[i].c);}else out.push({k,t0,t1,cs:[labels[i].c]});});
 return out.map(s=>{const t=TEMPL[s.k];const conf=s.cs.reduce((a,b)=>a+b,0)/s.cs.length;return t?{t0:+s.t0.toFixed(3),t1:+s.t1.toFixed(3),root:t.root,minor:t.minor,pcs:t.pcs,name:NAMES[t.root]+(t.minor?'m':''),confidence:+conf.toFixed(2)}:{t0:+s.t0.toFixed(3),t1:+s.t1.toFixed(3),root:-1,minor:false,pcs:[],name:'N',confidence:0};});
}
function at(chords,t){if(!chords)return null;for(const c of chords)if(t>=c.t0&&t<c.t1)return c;return null;}
const api={detect,at,NAMES};root.ChordCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
