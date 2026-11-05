/* 0.37.0 AI clean: DeepFilterNet3 (Hendrik Schröter, MIT or Apache-2.0; models in vendor/dfn3) run offline.
 * This file is the signal path around the three ONNX networks, written for this app from the published
 * DeepFilterNet design (libDF): 48 kHz, 960-point Vorbis-window STFT, 480 hop, 32 ERB bands, deep filtering
 * of the lowest 96 bins with 5 taps (2 frames of lookahead). The networks only estimate gains and filter taps.
 * Offline: the whole take is analysed first, the networks run in chunks with 1 s of warm-up so memory stays
 * small on a phone, and the result is trimmed so it lines up with the input to the sample.
 * Works in a worker or page (root.DfnCore) and in Node (module.exports) with an injected onnxruntime. */
(function(root){
'use strict';
const SR=48000,N=960,H=480,F=N/2+1,NB_ERB=32,NB_DF=96,ORDER=5,DF_LA=2,CONV_LA=2,ALPHA=.99,CHUNK=500,WARM=100;

/* ---------- mixed-radix complex FFT for n = 960 (2^6 * 3 * 5) ---------- */
function plan(n){
 const fac=[];let m=n;for(const p of [4,2,3,5])while(m%p===0){fac.push(p);m/=p;}if(m!==1)throw Error('FFT size');
 const c=new Float64Array(n),s=new Float64Array(n);for(let i=0;i<n;i++){c[i]=Math.cos(2*Math.PI*i/n);s[i]=-Math.sin(2*Math.PI*i/n);}
 return {n,fac,c,s};}
const P=plan(N);
// Out-of-place recursive decimation in time. xr/xi read with stride; results written contiguously.
function rec(xr,xi,off,stride,n,yr,yi,yo,depth){
 if(n===1){yr[yo]=xr[off];yi[yo]=xi[off];return;}
 const p=P.fac[depth],m=n/p;
 for(let q=0;q<p;q++)rec(xr,xi,off+q*stride,stride*p,m,yr,yi,yo+q*m,depth+1);
 const tr=new Float64Array(p),ti=new Float64Array(p),step=N/n;
 for(let k=0;k<m;k++){
  for(let q=0;q<p;q++){const a=yo+q*m+k,j=(q*k*step)%N,wr=P.c[j],wi=P.s[j];tr[q]=yr[a]*wr-yi[a]*wi;ti[q]=yr[a]*wi+yi[a]*wr;}
  for(let s=0;s<p;s++){let ar=0,ai=0;for(let q=0;q<p;q++){const j=(q*s*m*step)%N,wr=P.c[j],wi=P.s[j];ar+=tr[q]*wr-ti[q]*wi;ai+=tr[q]*wi+ti[q]*wr;}yr[yo+k+s*m]=ar;yi[yo+k+s*m]=ai;}
 }}
function fft(xr,xi,yr,yi){rec(xr,xi,0,1,N,yr,yi,0,0);}

/* ---------- DeepFilterNet front end ---------- */
const freq2erb=f=>9.265*Math.log1p(f/(24.7*9.265)),erb2freq=e=>24.7*9.265*(Math.exp(e/9.265)-1);
function erbWidths(){const nyq=SR/2,fw=SR/N,lo=freq2erb(0),hi=freq2erb(nyq),step=(hi-lo)/NB_ERB,w=new Array(NB_ERB);let prev=0,over=0;
 for(let i=1;i<=NB_ERB;i++){const fb=Math.round(erb2freq(lo+i*step)/fw);let nb=fb-prev-over;if(nb<2){over=2-nb;nb=2;}else over=0;w[i-1]=nb;prev=fb;}
 w[NB_ERB-1]+=1;const extra=w.reduce((a,b)=>a+b,0)-F;if(extra>0)w[NB_ERB-1]-=extra;return w;}
const WIDTHS=erbWidths(),BAND=new Uint8Array(F);{let b=0,k=0;for(const w of WIDTHS){for(let j=0;j<w;j++)BAND[k++]=b;b++;}}
const WIN=Float64Array.from({length:N},(_,i)=>{const s=Math.sin(.5*Math.PI*(i+.5)/(N/2));return Math.sin(.5*Math.PI*s*s);});
const WNORM=1/(N*N/(2*H));

// Analysis of a whole channel: frame t covers input samples [(t-1)H, (t+1)H) (480 samples of history).
function analyse(x,frames){
 const re=new Float32Array(frames*F),im=new Float32Array(frames*F),br=new Float64Array(N),bi=new Float64Array(N),or=new Float64Array(N),oi=new Float64Array(N);
 for(let t=0;t<frames;t++){const a=(t-1)*H;for(let i=0;i<N;i++){const p=a+i;br[i]=(p>=0&&p<x.length?x[p]:0)*WIN[i];bi[i]=0;}
  fft(br,bi,or,oi);for(let k=0;k<F;k++){re[t*F+k]=or[k]*WNORM;im[t*F+k]=oi[k]*WNORM;}}
 return {re,im};}
function features(sp,frames){
 const erb=new Float32Array(frames*NB_ERB),spec=new Float32Array(2*frames*NB_DF),mean=new Float64Array(NB_ERB),unit=new Float64Array(NB_DF);
 for(let b=0;b<NB_ERB;b++)mean[b]=-60+b*(-30/(NB_ERB-1));for(let k=0;k<NB_DF;k++)unit[k]=.001+k*(-.0009/(NB_DF-1));
 for(let t=0;t<frames;t++){let k=0;
  for(let b=0;b<NB_ERB;b++){let e=0;const w=WIDTHS[b];for(let j=0;j<w;j++,k++)e+=sp.re[t*F+k]**2+sp.im[t*F+k]**2;let v=10*Math.log10(e/w+1e-10);mean[b]=v*(1-ALPHA)+mean[b]*ALPHA;erb[t*NB_ERB+b]=(v-mean[b])/40;}
  for(let k=0;k<NB_DF;k++){const r=sp.re[t*F+k],i=sp.im[t*F+k];unit[k]=Math.hypot(r,i)*(1-ALPHA)+unit[k]*ALPHA;const d=Math.sqrt(unit[k]);spec[t*NB_DF+k]=r/d;spec[(frames+t)*NB_DF+k]=i/d;}}
 return {erb,spec};}

/* ---------- networks, in chunks ---------- */
async function loadSessions(ort,urls){const o={executionProviders:['wasm'],graphOptimizationLevel:'all'};
 return {ort,enc:await ort.InferenceSession.create(urls.enc,o),erb:await ort.InferenceSession.create(urls.erb_dec,o),df:await ort.InferenceSession.create(urls.df_dec,o)};}
// Returns gains [frames*32] and taps [frames*96*10] for spectrum frames 0..frames-1. Features are read
// CONV_LA frames ahead, as the trained model expects (its encoder sees 2 frames of the future).
async function networks(s,feat,frames,progress,pause){
 const {ort}=s,gains=new Float32Array(frames*NB_ERB),taps=new Float32Array(frames*NB_DF*ORDER*2);
 const fe=t=>t+CONV_LA<frames?t+CONV_LA:-1;
 for(let start=0;start<frames;start+=CHUNK){
  const a=Math.max(0,start-WARM),b=Math.min(frames,start+CHUNK),S=b-a,ferb=new Float32Array(S*NB_ERB),fsp=new Float32Array(2*S*NB_DF);
  for(let i=0;i<S;i++){const q=fe(a+i);if(q<0)continue;ferb.set(feat.erb.subarray(q*NB_ERB,(q+1)*NB_ERB),i*NB_ERB);
   fsp.set(feat.spec.subarray(q*NB_DF,(q+1)*NB_DF),i*NB_DF);fsp.set(feat.spec.subarray((frames+q)*NB_DF,(frames+q+1)*NB_DF),(S+i)*NB_DF);}
  const e=await s.enc.run({feat_erb:new ort.Tensor('float32',ferb,[1,1,S,NB_ERB]),feat_spec:new ort.Tensor('float32',fsp,[1,2,S,NB_DF])});
  const m=(await s.erb.run({emb:e.emb,e3:e.e3,e2:e.e2,e1:e.e1,e0:e.e0})).m.data;
  const c=(await s.df.run({emb:e.emb,c0:e.c0})).coefs.data;
  for(const k of Object.keys(e))e[k].dispose?.();
  const skip=start-a;gains.set(m.subarray(skip*NB_ERB,S*NB_ERB),start*NB_ERB);taps.set(c.subarray(skip*NB_DF*ORDER*2,S*NB_DF*ORDER*2),start*NB_DF*ORDER*2);
  progress?.(b/frames);if(pause)await pause();
 }
 return {gains,taps};}

/* ---------- apply and resynthesise ---------- */
function synthesise(sp,net,frames,len){
 const y=new Float32Array(frames*H+N),mem=new Float64Array(N-H),xr=new Float64Array(N),xi=new Float64Array(N),or=new Float64Array(N),oi=new Float64Array(N);
 for(let t=0;t<frames;t++){
  const o=t*F;
  // Upper bins: ERB gains on this frame. Lower 96 bins: 5-tap deep filter over frames t-2..t+2 of the noisy input.
  for(let k=NB_DF;k<F;k++){const g=net.gains[t*NB_ERB+BAND[k]];xr[k]=sp.re[o+k]*g;xi[k]=sp.im[o+k]*g;}
  for(let k=0;k<NB_DF;k++){let ar=0,ai=0;for(let n=0;n<ORDER;n++){const q=t-(ORDER-1-DF_LA)+n;if(q<0||q>=frames)continue;const cr=net.taps[((t*NB_DF+k)*ORDER+n)*2],ci=net.taps[((t*NB_DF+k)*ORDER+n)*2+1],sr=sp.re[q*F+k],si=sp.im[q*F+k];ar+=sr*cr-si*ci;ai+=sr*ci+si*cr;}xr[k]=ar;xi[k]=ai;}
  // Inverse real FFT as a conjugate-symmetric complex FFT (forward FFT of the conjugate, then conjugate).
  for(let k=1;k<F-1;k++){xr[N-k]=xr[k];xi[N-k]=-xi[k];}xi[0]=0;xi[F-1]=0;for(let k=0;k<N;k++)xi[k]=-xi[k];
  fft(xr,xi,or,oi);
  for(let i=0;i<N;i++)or[i]*=WIN[i];
  const a=t*H;for(let i=0;i<H;i++)y[a+i]=or[i]+mem[i];for(let i=0;i<N-H;i++)mem[i]=or[H+i];
 }
 // Analysis frame t starts at (t-1)H and synthesis writes frame t at tH, so output sample i is input sample i-H.
 return y.slice(H,H+len);}

async function process(s,ch,rate,opt={}){
 if(rate!==SR)throw Error('AI clean runs at 48 kHz.');
 const out=[],len=ch[0].length,frames=Math.ceil((len+N)/H),lsnr=[];
 for(let c=0;c<ch.length;c++){const sp=analyse(ch[c],frames),feat=features(sp,frames);
  const net=await networks(s,feat,frames,p=>opt.progress?.((c+p)/ch.length),opt.pause);
  out.push(synthesise(sp,net,frames,len));}
 return out;}

const api={SR,N,H,WIDTHS,fft,erbWidths,analyse,features,loadSessions,networks,synthesise,process};
root.DfnCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
