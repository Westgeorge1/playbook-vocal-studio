/* Playbook Studio Spectral 1.0. Offline, linked-channel noise-profile reduction.
 * Original implementation; no model, network requests or third-party DSP code.
 * A noise print is evidence of a noise spectrum, never a guarantee of source separation. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), db=x=>20*Math.log10(Math.max(1e-12,x));
function dimensions(ch,rate){if(!Number.isFinite(rate)||rate<22050||rate>192000||!Array.isArray(ch)||![1,2].includes(ch.length)||!ch[0]?.length||ch[0].length>rate*900||ch.some(c=>c.length!==ch[0].length))throw Error('Use a finite mono or stereo vocal at 22,050–192,000 Hz.');for(const c of ch)for(const v of c)if(!Number.isFinite(v))throw Error('The vocal contains invalid audio samples.');}
function size(rate){return 2**Math.round(Math.log2(rate*.043));}
function defaults(){return {v:1,mode:'studio',on:true,reduction:6,sensitivity:0,smoothing:2,protect:.85,highpass:0,hum:0,profile:null,source:'',legacyOn:1};}
function validate(c){if(!c||c.v!==1||!['studio','original'].includes(c.mode)||typeof c.on!=='boolean')throw Error('Invalid noise-remover settings.');for(const [k,a,b] of [['reduction',0,18],['sensitivity',-6,6],['smoothing',0,6],['protect',0,1],['highpass',0,120],['hum',0,60],['legacyOn',0,1]])if(!Number.isFinite(c[k])||c[k]<a||c[k]>b)throw Error('Invalid noise-remover '+k+'.');if(![0,50,60].includes(c.hum)||typeof c.source!=='string'||c.source.length>150)throw Error('Invalid noise-remover source or hum setting.');if(c.scope!=null&&!['all','pauses'].includes(c.scope))throw Error('Invalid noise-remover scope.');if(c.bleed!=null&&![0,.5,1].includes(c.bleed))throw Error('Invalid beat-bleed setting.');if(c.ai!=null&&![0,.25,.5,1].includes(c.ai))throw Error('Invalid AI isolation setting.');if(c.engine!=null&&!['classic','adaptive'].includes(c.engine))throw Error('Invalid noise-remover engine.');if(c.follow!=null&&![0,1,2,3].includes(c.follow))throw Error('Invalid follow speed.');if(cfg_under_check(c))throw Error('Invalid pops and rumble setting.');for(const k of ['smooth','harmonic','dfn'])if(c[k]!=null&&(!Number.isFinite(c[k])||c[k]<0||c[k]>1))throw Error('Invalid noise-remover '+k+'.');if(c.stepsOff!=null&&(!Array.isArray(c.stepsOff)||c.stepsOff.some(k=>!Object.hasOwn(STEPS,k))))throw Error('Invalid Clean vocal steps.');if(c.echoMemo!=null&&![0,1].includes(c.echoMemo))throw Error('Invalid Clean vocal echo memory.');if(c.gap!=null&&(!Number.isFinite(c.gap)||c.gap<0||c.gap>24))throw Error('Invalid gap cleaning.');if(c.touched!=null&&(!Array.isArray(c.touched)||c.touched.length>40||c.touched.some(k=>typeof k!=='string'||k.length>24)))throw Error('Invalid noise-remover touched list.');if(c.profile)validProfile(c.profile);return c;}
function validProfile(p){if(!p||p.v!==1||!Number.isFinite(p.rate)||p.rate<22050||p.rate>192000||p.n!==size(p.rate)||!Array.isArray(p.power)||p.power.length!==p.n/2+1||p.power.some(x=>!Number.isFinite(x)||x<0||x>1e15)||!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start<0||p.end<=p.start||p.end>900||!['manual','auto'].includes(p.kind)||!Number.isFinite(p.noiseDb))throw Error('Invalid saved noise profile.');return p;}
function fft(re,im,inverse=false){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len<<=1){const ang=(inverse?2:-2)*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let ar=1,ai=0;for(let j=0;j<len/2;j++){const u=i+j,v=u+len/2,tr=re[v]*ar-im[v]*ai,ti=re[v]*ai+im[v]*ar;re[v]=re[u]-tr;im[v]=im[u]-ti;re[u]+=tr;im[u]+=ti;const nx=ar*wr-ai*wi;ai=ar*wi+ai*wr;ar=nx;}}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
const windowFor=n=>Float64Array.from({length:n},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/n));
function spectrum(ch,start,n,w){const re=ch.map(()=>new Float64Array(n)),im=ch.map(()=>new Float64Array(n)),power=new Float64Array(n/2+1);for(let c=0;c<ch.length;c++){for(let i=0;i<n;i++)re[c][i]=(ch[c][start+i]||0)*w[i];fft(re[c],im[c]);for(let k=0;k<power.length;k++)power[k]+=(re[c][k]**2+im[c][k]**2)/ch.length;}return {re,im,power};}
function rms(ch,a=0,b=ch[0].length){a=Math.max(0,Math.floor(a));b=Math.min(ch[0].length,Math.ceil(b));let p=0;for(const c of ch)for(let i=a;i<b;i++)p+=c[i]*c[i];return Math.sqrt(p/Math.max(1,(b-a)*ch.length));}
function learn(ch,rate,start,end,kind='manual'){dimensions(ch,rate);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>ch[0].length/rate+1e-6||end-start<.2||end-start>10)throw Error('Choose 0.2–10 seconds containing background noise only.');const n=size(rate),hop=n/4,w=windowFor(n),a=Math.round(start*rate),b=Math.round(end*rate),frames=[];for(let i=a;i+n<=b;i+=hop)frames.push({start:i,level:rms(ch,i,i+n)});if(frames.length<2)throw Error('The noise sample is too short.');frames.sort((a,b)=>a.level-b.level);const used=frames.slice(0,Math.max(2,Math.ceil(frames.length*.85))),power=new Float64Array(n/2+1);for(const f of used){const s=spectrum(ch,f.start,n,w);for(let k=0;k<power.length;k++)power[k]+=s.power[k]/used.length;}const level=rms(ch,a,b);if(level<1e-8)throw Error('This selection is silence, not a usable noise sample.');return {v:1,rate,n,power:Array.from(power),start,end,kind,noiseDb:db(level)};}
function periodicity(ch,rate,a,b){const step=Math.max(1,Math.round(rate/12000)),sr=rate/step;let c=ch[0];if(ch[1]&&rms([ch[1]],a,b)>rms([c],a,b))c=ch[1];const x=[];for(let i=a;i<b;i+=step)x.push(c[i]);let mean=x.reduce((a,b)=>a+b,0)/x.length;x.forEach((v,i)=>x[i]=v-mean);let best=0;for(let lag=Math.floor(sr/700);lag<=Math.ceil(sr/70);lag++){let dot=0,e1=0,e2=0;for(let i=lag;i<x.length;i++){dot+=x[i]*x[i-lag];e1+=x[i]*x[i];e2+=x[i-lag]*x[i-lag];}best=Math.max(best,dot/Math.sqrt(e1*e2+1e-30));}return best;}
function auto(ch,rate){dimensions(ch,rate);const step=Math.round(rate*.02),span=Math.ceil(.4*rate/step),levels=[];for(let i=0;i+step<=ch[0].length;i+=step)levels.push(rms(ch,i,i+step));if(levels.length<span+5)return {profile:null,reason:'Too short to identify a noise-only pause. Learn a sample manually.'};const sorted=levels.slice().sort((a,b)=>a-b),voice=sorted[Math.floor(sorted.length*.8)];let best=Infinity,start=-1;for(let i=0;i+span<=levels.length;i++){let p=0,mx=0,mn=Infinity;for(let j=i;j<i+span;j++){p+=levels[j]**2;mx=Math.max(mx,levels[j]);mn=Math.min(mn,levels[j]);}const level=Math.sqrt(p/span);if(level<best&&level>1e-7&&mx<Math.max(mn*5,1e-7)){best=level;start=i*step;}}if(start<0||db(voice/Math.max(best,1e-12))<12)return {profile:null,reason:'No clear noise-only pause found. Choose a sample without singing.'};const end=Math.min(ch[0].length,start+span*step);if(periodicity(ch,rate,start,end)>.55)return {profile:null,reason:'The quietest pause contains a sustained tone. Listen and learn a noise-only sample manually.'};const profile=learn(ch,rate,start/rate,end/rate,'auto');return {profile,reason:'Automatic profile from '+profile.start.toFixed(2)+'–'+profile.end.toFixed(2)+' s. Check it with Listen to sample.'};}
function filter(ch,rate,settings){const out=ch.map(c=>Float32Array.from(c));function biquad(type,f,q){const w=2*Math.PI*f/rate,cs=Math.cos(w),a=Math.sin(w)/(2*q),a0=1+a,b0=type==='highpass'?(1+cs)/2:1,b1=type==='highpass'?-(1+cs):-2*cs,b2=b0,a1=-2*cs/a0,a2=(1-a)/a0;for(const c of out){let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<c.length;i++){const x=c[i],y=b0/a0*x+b1/a0*x1+b2/a0*x2-a1*y1-a2*y2;c[i]=y;x2=x1;x1=x;y2=y1;y1=y;}}}if(settings.highpass>0)biquad('highpass',settings.highpass,Math.SQRT1_2);if(settings.hum)for(let k=1;k<=5;k++)biquad('notch',settings.hum*k,40);return out;}
// Apply the current filters to a saved room spectrum without sampling the new
// performance at the old recording's timestamp. The spectrum is power, not amplitude.
function filteredRoomPower(profile,rate,cfg){
 const power=profile.power.slice(),bins=power.length;
 const filters=cfg.highpass?[[cfg.highpass,Math.SQRT1_2,true]]:[];
 if(cfg.hum)for(let i=1;i<=5;i++)filters.push([cfg.hum*i,40,false]);
 for(const [hz,q,hp] of filters){
  const w0=2*Math.PI*hz/rate,c0=Math.cos(w0),alpha=Math.sin(w0)/(2*q);
  for(let k=0;k<bins;k++){const w=Math.PI*k/(bins-1),c=Math.cos(w);
   const numerator=hp?(1+c0)*(c-1):2*(c-c0);
   power[k]*=numerator**2/Math.max(1e-24,4*((c-c0)**2+(alpha*Math.sin(w))**2));
  }
 }
 return power;
}
function process(ch,rate,cfg,progress=()=>{},ref=null){dimensions(ch,rate);validate(cfg);if(cfg.engine==='adaptive'&&cfg.mode!=='original'&&cfg.on&&(cfg.reduction||cfg.highpass||cfg.hum||cfg.harmonic||cfg.under))return processAdaptive(ch,rate,cfg,progress,ref);if(cfg.mode==='original'||!cfg.on||(!cfg.reduction&&!cfg.highpass&&!cfg.hum))return {channels:ch.map(c=>Float32Array.from(c)),profile:cfg.profile,report:{bypassed:true,reason:'Noise removal bypassed.',reductionDb:0}};
 let p=cfg.profile;if(p&&p.rate!==rate)throw Error('The noise profile sample rate no longer matches this vocal. Learn it again.');let reason='';if(!p){const a=auto(ch,rate);p=a.profile;reason=a.reason;}
 const n=size(rate),hop=n/4,len=ch[0].length,bins=n/2+1,w=windowFor(n),filtered=filter(ch,rate,cfg);let out=filtered;
 if(p&&cfg.reduction>0){let noise=p.power;if(cfg.highpass||cfg.hum)noise=p.room||p.end>len/rate?filteredRoomPower(p,rate,cfg):learn(filtered,rate,p.start,p.end,p.kind).power;
  out=ch.map(()=>new Float32Array(len));const norm=new Float32Array(len),last=new Float64Array(bins).fill(1),prevPower=new Float64Array(bins),prevSignal=new Float64Array(bins),floor=10**(-cfg.reduction/20),sensitivity=10**(cfg.sensitivity/10),attack=Math.exp(-hop/(rate*.003)),release=Math.exp(-hop/(rate*(.035+.065*cfg.protect))),radius=Math.round(cfg.smoothing),total=Math.ceil((len+n)/hop);let f=0,previousEnergy=0;
  for(let start=-n+hop;start<len;start+=hop){const s=spectrum(filtered,start,n,w),g=new Float64Array(bins),ratios=new Float64Array(bins),energy=s.power.reduce((a,b)=>a+b,0),onset=energy>previousEnergy*2;previousEnergy=energy;for(let k=0;k<bins;k++){const np=Math.max(1e-20,noise[k]*sensitivity),tracked=onset?s.power[k]:.65*prevPower[k]+.35*s.power[k],ratio=tracked/np;ratios[k]=ratio;const xi=.82*prevSignal[k]/np+.18*Math.max(0,ratio-1.6);let gain=Math.sqrt(xi/(1+xi));if(ratio>8)gain=Math.max(gain,1-(1-.8*cfg.protect)/Math.max(2,ratio));if(onset&&ratio>3)gain=Math.max(gain,.65+.3*cfg.protect);g[k]=Math.max(floor,Math.min(1,gain));prevPower[k]=tracked;}
   for(let k=0;k<bins;k++){let sum=0,weight=0;for(let j=Math.max(0,k-radius);j<=Math.min(bins-1,k+radius);j++){const wt=radius+1-Math.abs(j-k);sum+=g[j]*wt;weight+=wt;}let target=sum/weight;if(ratios[k]>8)target=Math.max(target,g[k]);const a=target>last[k]?attack:release;last[k]=clamp(a*last[k]+(1-a)*target,floor,1);prevSignal[k]=prevPower[k]*last[k]**2;for(let c=0;c<ch.length;c++){s.re[c][k]*=last[k];s.im[c][k]*=last[k];if(k&&k<n/2){s.re[c][n-k]*=last[k];s.im[c][n-k]*=last[k];}}}
   for(let c=0;c<ch.length;c++){fft(s.re[c],s.im[c],true);for(let j=Math.max(0,-start);j<Math.min(n,len-start);j++)out[c][start+j]+=s.re[c][j]*w[j];}for(let j=Math.max(0,-start);j<Math.min(n,len-start);j++)norm[start+j]+=w[j]*w[j];if((++f%100)===0)progress(f/total);
  }for(let c=0;c<ch.length;c++)for(let i=0;i<len;i++)out[c][i]/=norm[i]||1;
 }
 dimensions(out,rate);const removed=ch.map((c,j)=>Float32Array.from(c,(v,i)=>v-out[j][i]));let peak=0;for(const c of out)for(const v of c)peak=Math.max(peak,Math.abs(v));const reduction=p&&!p.room&&p.end<=len/rate?db(rms(ch,p.start*rate,p.end*rate)/Math.max(1e-12,rms(out,p.start*rate,p.end*rate))):null;
 return {channels:out,removed,profile:p,report:{bypassed:!p&&!cfg.highpass&&!cfg.hum,reason:reason||(p?'Noise profile applied.':'No profile: spectral reduction bypassed.'),profileKind:p?.kind||null,noiseDb:p?.noiseDb??null,reductionDb:reduction,peakDb:db(peak),samples:len,channels:ch.length}};
}
function sampleWarning(ch,rate,start,end){
 const a=Math.round(start*rate),b=Math.min(Math.round(end*rate),a+Math.round(.4*rate));
 return periodicity(ch,rate,a,b)>.55?'This sample contains a repeating tone. It could be hum, singing or music. Listen to the sample before using it.':'';
}
/* ---------- 0.37.0 Studio Spectral Adaptive (original implementation) ----------
 * Three changes from the fixed noise print above:
 *  1. The noise estimate follows the recording. Per frequency it keeps the minimum of the smoothed spectrum over a
 *     sliding window (Follow speed: 0.6, 1.5 or 3 s) and updates only where no voice is likely, so a fan that
 *     changes speed or traffic that rises and falls is tracked. With Follow speed Off the learned print is used.
 *  2. A smoother gain rule (decision-directed signal-to-noise estimate) controlled by Smoothness, which trades a
 *     little leftover noise for fewer "underwater" artefacts.
 *  3. Held-note protection: an autocorrelation (YIN) pitch tracker finds the sung note in every frame and the
 *     cleaner keeps the note's harmonics, cleaning only between them. When an AI stage ran first, protection
 *     restores the harmonics from the vocal as it was before the AI, so the AI cannot thin a held note. */
const FOLLOW_SEC=[0,1.5,.6,.35];
function pitchTrack(x,rate,n,hop,frames){
 const dec=Math.max(1,Math.round(rate/12000)),sr=rate/dec,W=Math.round(sr*.032),minLag=Math.floor(sr/1000),maxLag=Math.ceil(sr/65),m=Math.floor(x.length/dec),y=new Float32Array(m);
 for(let i=0;i<m;i++){let s=0;for(let j=0;j<dec;j++)s+=x[i*dec+j];y[i]=s/dec;}
 const f0=new Float32Array(frames),clarity=new Float32Array(frames),d=new Float64Array(maxLag+2);
 for(let t=0;t<frames;t++){const centre=-n+hop+t*hop+n/2,a=Math.round(centre/dec)-(W>>1);if(a<0||a+W+maxLag+1>=m)continue;
  let e=0;for(let i=0;i<W;i++)e+=y[a+i]*y[a+i];if(e<W*1e-9)continue;
  let run=0,best=-1,bestV=1;d[0]=1;
  for(let L=1;L<=maxLag+1;L++){let s=0;for(let i=0;i<W;i++){const q=y[a+i]-y[a+i+L];s+=q*q;}run+=s;d[L]=run>0?s*L/run:1;}
  for(let L=minLag;L<=maxLag;L++){if(d[L]<.15){while(L<maxLag&&d[L+1]<d[L])L++;best=L;bestV=d[L];break;}if(d[L]<bestV){bestV=d[L];best=L;}}
  if(best<minLag||bestV>.3)continue;
  const a1=d[best-1],b1=d[best],c1=d[best+1],den=a1-2*b1+c1,shift=den>0?clamp(.5*(a1-c1)/den,-.5,.5):0;
  f0[t]=sr/(best+shift);clarity[t]=1-bestV;}
 return {f0,clarity};}
function harmonicWeights(w,f0,rate,n){w.fill(0);if(!f0)return w;const bin=rate/n,top=Math.min(rate/2-bin,10000);
 for(let fh=f0;fh<top;fh+=f0){const c=fh/bin,core=Math.max(1.5,.012*c+1),edge=core+1.5;for(let k=Math.max(1,Math.ceil(c-edge));k<=Math.min(w.length-1,Math.floor(c+edge));k++){const d=Math.abs(k-c),v=d<=core?1:.5+.5*Math.cos(Math.PI*(d-core)/(edge-core));if(v>w[k])w[k]=v;}}
 return w;}
function adaptive(ch,rate,cfg,p,progress,ref){
 const n=size(rate),hop=n/4,len=ch[0].length,bins=n/2+1,w=windowFor(n),filtered=filter(ch,rate,cfg),refF=ref?filter(ref,rate,cfg):null;
 const frames=Math.ceil((len+n-hop)/hop),mono=filtered.length===1?filtered[0]:Float32Array.from(filtered[0],(v,i)=>(v+filtered[1][i])/2);
 const prot=clamp(cfg.harmonic??0,0,1),under=clamp(cfg.under??0,0,24),ug=10**(-under/20),binHz=rate/n,pitch=prot>0||under>0?pitchTrack(refF?(refF.length===1?refF[0]:Float32Array.from(refF[0],(v,i)=>(v+refF[1][i])/2)):mono,rate,n,hop,frames):null;
 const followSec=FOLLOW_SEC[(cfg.follow===0&&!p)?2:(cfg.follow??2)],a=.9+.08*clamp(cfg.smooth??.5,0,1),floor=10**(-cfg.reduction/20),beta=1.4*10**(cfg.sensitivity/10);
 let noise=p?(cfg.highpass||cfg.hum)?(p.room||p.end>len/rate?filteredRoomPower(p,rate,cfg):learn(filtered,rate,p.start,p.end,p.kind).power):p.power:null;
 const lam=new Float64Array(bins),Sm=new Float64Array(bins),sub=new Float64Array(bins).fill(Infinity),U=8,V=Math.max(1,Math.ceil(followSec*rate/hop/U)),ring=Array.from({length:U},()=>new Float64Array(bins).fill(Infinity));
 const pres=new Float64Array(bins),gPrev=new Float64Array(bins).fill(1),gamPrev=new Float64Array(bins).fill(1),last=new Float64Array(bins).fill(1),hw=new Float64Array(bins),hwS=new Float64Array(bins),g=new Float64Array(bins),ratios=new Float64Array(bins);
 const attack=Math.exp(-hop/(rate*.003)),release=Math.exp(-hop/(rate*(.035+.065*cfg.protect))),radius=Math.round(cfg.smoothing);
 const out=ch.map(()=>new Float32Array(len)),norm=new Float32Array(len);let f=0,ri=0,inSub=0,previousEnergy=0,voiced=0,started=false;
 for(let start=-n+hop;start<len;start+=hop,f++){
  const s=spectrum(filtered,start,n,w),r=refF?spectrum(refF,start,n,w):null,P=s.power,energy=P.reduce((x,y)=>x+y,0),onset=energy>previousEnergy*2;previousEnergy=energy;
  const f0=pitch?pitch.f0[f]:0;harmonicWeights(hw,f0,rate,n);
  // 0.37.2 Pops and rumble under the voice: a sung note has nothing below its fundamental, so everything below
  // three quarters of the sung pitch (at most 150 Hz) is breath pop, handling thump or room rumble. Between notes
  // the cut sits at 90 Hz. It acts at once (no release), so a 30 ms pop is caught.
  const cut=under>0?(f0?Math.min(150,.75*f0):90):0;if(f0)voiced++;for(let k=0;k<bins;k++)hwS[k]=Math.max(hw[k],hwS[k]*.6);
  if(!started){for(let k=0;k<bins;k++){Sm[k]=P[k];lam[k]=noise?noise[k]:P[k];}started=energy>0;}
  // 1. noise tracking
  for(let k=0;k<bins;k++){const pk=k>0&&k<bins-1?.25*P[k-1]+.5*P[k]+.25*P[k+1]:P[k];Sm[k]=.7*Sm[k]+.3*pk;if(Sm[k]<sub[k])sub[k]=Sm[k];}
  if(++inSub>=V){inSub=0;ring[ri].set(sub);ri=(ri+1)%U;sub.fill(Infinity);}
  if(followSec>0)for(let k=0;k<bins;k++){let mn=sub[k];for(let u=0;u<U;u++)if(ring[u][k]<mn)mn=ring[u][k];const present=(f0&&hw[k]>.3)||Sm[k]>5*mn?1:0;pres[k]=.2*pres[k]+.8*present;const al=.85+.15*pres[k];lam[k]=al*lam[k]+(1-al)*P[k];}
  // 2. gain
  for(let k=0;k<bins;k++){const np=Math.max(1e-20,lam[k]*beta),gam=P[k]/np,xi=Math.max(a*gPrev[k]*gPrev[k]*gamPrev[k]+(1-a)*Math.max(0,gam-1),1e-4);let gain=xi/(1+xi);ratios[k]=gam;
   if(onset&&gam>3)gain=Math.max(gain,.65+.3*cfg.protect);g[k]=Math.max(floor,Math.min(1,gain));gamPrev[k]=gam;}
  for(let k=0;k<bins;k++){let sum=0,wt=0;for(let j=Math.max(0,k-radius);j<=Math.min(bins-1,k+radius);j++){const q=radius+1-Math.abs(j-k);sum+=g[j]*q;wt+=q;}let target=sum/wt;if(ratios[k]>8)target=Math.max(target,g[k]);
   const al=target>last[k]?attack:release;last[k]=clamp(al*last[k]+(1-al)*target,floor,1);gPrev[k]=last[k];
   // 3. held-note protection (never below the voice)
   let h=prot*hwS[k],gk=last[k];if(cut&&k*binHz<cut){const t=clamp((cut-k*binHz)/binHz,0,1);gk=gk*(1-t)+Math.min(gk,ug)*t;h*=1-t;}
   for(let c=0;c<ch.length;c++){let yr=s.re[c][k]*gk,yi=s.im[c][k]*gk;if(h>0){const xr=r?r.re[c][k]:s.re[c][k],xi2=r?r.im[c][k]:s.im[c][k];yr+=h*(xr-yr);yi+=h*(xi2-yi);}
    s.re[c][k]=yr;s.im[c][k]=yi;if(k&&k<n/2){s.re[c][n-k]=yr;s.im[c][n-k]=-yi;}}}
  for(let c=0;c<ch.length;c++){s.im[c][0]=0;s.im[c][n/2]=0;fft(s.re[c],s.im[c],true);for(let j=Math.max(0,-start);j<Math.min(n,len-start);j++)out[c][start+j]+=s.re[c][j]*w[j];}
  for(let j=Math.max(0,-start);j<Math.min(n,len-start);j++)norm[start+j]+=w[j]*w[j];if((f%100)===0)progress(f/frames);
 }
 for(let c=0;c<ch.length;c++)for(let i=0;i<len;i++)out[c][i]/=norm[i]||1;
 let ld=0;for(let k=0;k<bins;k++)ld+=lam[k];
 return {channels:out,voicedShare:frames?voiced/frames:0,noiseDb:10*Math.log10(ld/(n*n/8)+1e-20)};}
function processAdaptive(ch,rate,cfg,progress,ref){
 let p=cfg.profile;if(p&&p.rate!==rate)throw Error('The noise profile sample rate no longer matches this vocal. Learn it again.');let reason='';if(!p){const a=auto(ch,rate);p=a.profile;reason=a.reason;}
 if(ref&&(ref.length!==ch.length||ref[0].length!==ch[0].length))ref=null;
 const r=adaptive(ch,rate,cfg,p,progress,ref),out=r.channels;dimensions(out,rate);
 const removed=(ref||ch).map((c,j)=>Float32Array.from(c,(v,i)=>v-out[j][i]));let peak=0;for(const c of out)for(const v of c)peak=Math.max(peak,Math.abs(v));
 const reduction=p&&!p.room&&p.end<=ch[0].length/rate?db(rms(ref||ch,p.start*rate,p.end*rate)/Math.max(1e-12,rms(out,p.start*rate,p.end*rate))):null;
 return {channels:out,removed,profile:p,report:{bypassed:false,engine:'adaptive',reason:reason||(p?'Adaptive cleaning, started from the noise print.':'Adaptive cleaning, no noise print: the estimate builds from the quiet moments.'),profileKind:p?.kind||null,noiseDb:p?.noiseDb??null,reductionDb:reduction,voicedShare:+r.voicedShare.toFixed(3),peakDb:db(peak),samples:ch[0].length,channels:ch.length}};}

/* ---------- 0.37.0 Measure: what the recording needs, before cleaning ---------- */
function measure(ch,rate){dimensions(ch,rate);
 const x=ch.length===1?ch[0]:Float32Array.from(ch[0],(v,i)=>(v+ch[1][i])/2),hop=Math.round(rate*.02),nf=Math.floor(x.length/hop),lv=new Float32Array(nf);
 let clip=0;for(const c of ch)for(const v of c)if(Math.abs(v)>=.999)clip++;
 for(let k=0;k<nf;k++){let s=0;for(let i=k*hop;i<(k+1)*hop;i++)s+=x[i]*x[i];lv[k]=10*Math.log10(s/hop+1e-12);}
 const sorted=Float32Array.from(lv).sort(),pc=q=>sorted[Math.min(nf-1,Math.floor(q*(nf-1)))]??-120,floorDb=pc(.1),voiceDb=pc(.95);
 // Hum: a narrow peak at 50/60 Hz (or its second harmonic) against the bins beside it, from 0.34 s windows that start
 // in the quietest moments (2.9 Hz resolution, so a hum line is not mistaken for broadband rumble).
 const quiet=[];for(let k=0;k<nf;k++)if(lv[k]<floorDb+3)quiet.push(k);
 const L=2**Math.round(Math.log2(rate*.34)),wl=windowFor(L),pw=new Float64Array(L/2+1);let used=0;
 for(let q=0;q<quiet.length&&used<12;q+=Math.max(1,Math.floor(quiet.length/12))){const a=quiet[q]*hop;if(a+L>x.length)continue;const re=new Float64Array(L),im=new Float64Array(L);for(let i=0;i<L;i++)re[i]=x[a+i]*wl[i];fft(re,im);for(let k=0;k<pw.length;k++)pw[k]+=re[k]*re[k]+im[k]*im[k];used++;}
 const bin=rate/L,peakAt=hz=>{if(!used)return 0;const c=Math.round(hz/bin);let side=0,cnt=0;for(let o=3;o<=8;o++){side+=(pw[c-o]||0)+(pw[c+o]||0);cnt+=2;}return 10*Math.log10((Math.max(pw[c-1],pw[c],pw[c+1])+1e-30)/(side/cnt+1e-30));};
 // Mains hum is a set of narrow lines at the mains frequency and its multiples. A broad low bump (rumble, handling)
 // raises 50 and 60 Hz alike, so hum is reported only when at least two lines of one series stand out and the other
 // series does not.
 const lines=f=>[1,2,3,4].map(k=>peakAt(f*k)),l50=lines(50),l60=lines(60),count=l=>l.filter(v=>v>6).length;
 const hum50=Math.max(...l50.slice(0,2)),hum60=Math.max(...l60.slice(0,2)),ok50=hum50>10&&count(l50)>=2&&count(l60)<2,ok60=hum60>10&&count(l60)>=2&&count(l50)<2,hum=ok50?50:ok60?60:0;
 let lowShare=0,all=0;for(let k=1;k<pw.length;k++){const f=k*bin;if(Math.abs(f-50)<4||Math.abs(f-60)<4||Math.abs(f-100)<4||Math.abs(f-120)<4)continue;all+=pw[k];if(f<70)lowShare+=pw[k];}
 // Music or another voice in the pauses: pitched sound above 120 Hz in frames that are not singing (hum excluded).
 const xh=filter([x],rate,{highpass:120,hum:0})[0];let tonal=0,checked=0;for(let q=0;q<quiet.length&&checked<60;q+=Math.max(1,Math.floor(quiet.length/60))){const a=quiet[q]*hop;if(a+Math.round(rate*.06)>=x.length)continue;checked++;if(periodicity([xh],rate,a,a+Math.round(rate*.05))>.6)tonal++;}
 return {floorDb:+floorDb.toFixed(1),voiceDb:+voiceDb.toFixed(1),snrDb:+(voiceDb-floorDb).toFixed(1),clipped:clip,hum,humDb:+Math.max(hum50,hum60).toFixed(1),rumble:all?+(lowShare/all).toFixed(3):0,musicInPauses:checked?+(tonal/checked).toFixed(2):0};}
/* Steps switched off in Clean vocal keep their values but do nothing. With no step off the settings are returned
 * unchanged (the same object), so existing projects render exactly as before. */
const cfg_under_check=c=>c.under!=null&&(!Number.isFinite(c.under)||c.under<0||c.under>24);
const STEPS={hum:{hum:0,highpass:0,under:0},bleed:{bleed:0},ai:{dfn:0},noise:{reduction:0},protect:{harmonic:0},gaps:{gap:0}};
function effective(c){if(!c||!Array.isArray(c.stepsOff)||!c.stepsOff.length)return c;const o={...c};for(const k of c.stepsOff)Object.assign(o,STEPS[k]||{});return o;}

const api={STEPS,effective,sampleWarning,defaults,validate,validProfile,dimensions,size,fft,learn,auto,process,processAdaptive,pitchTrack,harmonicWeights,measure,rms};if(typeof module==='object'&&module.exports)module.exports=api;else root.NoiseCore=api;
})(typeof self!=='undefined'?self:globalThis);
