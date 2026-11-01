/* 0.33.0 cleaning additions around Studio Spectral (POLISH → CLEAN). Each is off unless the singer turns it on, and
 * with all of them off the cleaner's output is byte-identical to 0.32.x.
 *  - Beat bleed: removes the backing that leaked from headphones or speakers into the mic, using the backing itself
 *    as the reference (per-frequency least squares after a cross-correlation lag search).
 *  - AI voice isolation: optional RNNoise (Apache-2.0 WebAssembly build, loaded only when used) blended with the dry vocal.
 *  - Pauses only: the singing stays exactly as recorded; cleaning applies only between phrases, with soft fades.
 *  - Voice-safety meter: how much cleaning changed the singing versus the pauses.
 * Works in the browser (window.CleanPlus) and in Node (module.exports) for the maths tests. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/* ---------- FFT (radix 2, in place) ---------- */
const tw=new Map();
function twiddles(n){let t=tw.get(n);if(!t){t={c:new Float64Array(n/2),s:new Float64Array(n/2),rev:new Uint32Array(n)};for(let i=0;i<n/2;i++){t.c[i]=Math.cos(2*Math.PI*i/n);t.s[i]=-Math.sin(2*Math.PI*i/n);}const bits=Math.log2(n);for(let i=0;i<n;i++){let r=0;for(let b=0;b<bits;b++)r|=((i>>b)&1)<<(bits-1-b);t.rev[i]=r;}tw.set(n,t);}return t;}
function fft(re,im,inv=false){const n=re.length,t=twiddles(n);for(let i=0;i<n;i++){const j=t.rev[i];if(j>i){let x=re[i];re[i]=re[j];re[j]=x;x=im[i];im[i]=im[j];im[j]=x;}}
 for(let size=2;size<=n;size*=2){const half=size/2,step=n/size;for(let i=0;i<n;i+=size)for(let k=0;k<half;k++){const c=t.c[k*step],s=inv?-t.s[k*step]:t.s[k*step],a=i+k,b=a+half,xr=re[b]*c-im[b]*s,xi=re[b]*s+im[b]*c;re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;}}
 if(inv)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
function mono(ch){if(ch.length===1)return ch[0];const n=ch[0].length,m=new Float32Array(n);for(const c of ch)for(let i=0;i<n;i++)m[i]+=c[i]/ch.length;return m;}

/* ---------- voice activity: 10 ms frames ---------- */
// Normalised autocorrelation peak (0-1) of a 40 ms window at 8 kHz: high for a sung (pitched) sound, low for
// breath, hiss and room noise. Used so quiet or fading singing is never mistaken for a pause.
function periodicity(y,c,sr){const W=Math.round(sr*.04),a=c-(W>>1);if(a<0||a+W+Math.ceil(sr/70)>=y.length)return 0;
 let e0=0;for(let i=0;i<W;i++)e0+=y[a+i]*y[a+i];if(e0<=0)return 0;let best=0;
 for(let L=Math.floor(sr/1000);L<=Math.ceil(sr/70);L++){let r=0,e1=0;for(let i=0;i<W;i++){r+=y[a+i]*y[a+i+L];e1+=y[a+i+L]*y[a+i+L];}const v=r/Math.sqrt(e0*e1+1e-30);if(v>best)best=v;}return best;}
// opt.pitch (default true): treat pitched frames as singing even when quiet. Beat-bleed estimation passes false,
// because a pitched backing heard in the pauses must count as a pause there.
function voiceFrames(ch,rate,opt={}){
 const x=mono(ch),hop=Math.max(1,Math.round(rate*.01)),n=Math.ceil(x.length/hop),db=new Float32Array(n);
 for(let k=0;k<n;k++){let p=0;const a=k*hop,b=Math.min(x.length,a+hop);for(let i=a;i<b;i++)p+=x[i]*x[i];db[k]=10*Math.log10(p/Math.max(1,b-a)+1e-12);}
 const s=Float32Array.from(db).sort(),floor=s[Math.floor(.1*(n-1))],loud=s[Math.floor(.95*(n-1))],thr=Math.max(floor+12,loud-30);
 let v=new Uint8Array(n);for(let k=0;k<n;k++)v[k]=db[k]>thr?1:0;
 if(opt.pitch!==false){const dec=Math.max(1,Math.round(rate/8000)),sr=rate/dec,m=Math.floor(x.length/dec),y=new Float32Array(m);for(let i=0;i<m;i++){let t=0;for(let j=0;j<dec;j++)t+=x[i*dec+j];y[i]=t/dec;}
  for(let k=0;k<n;k++)if(!v[k]&&db[k]>floor+4&&periodicity(y,Math.round((k+.5)*hop/dec),sr)>.65)v[k]=1;}
 // Drop clicks shorter than 60 ms, then bridge gaps under 150 ms, then keep 80 ms before and 150 ms after singing.
 const runs=(arr,val,fn)=>{let s=-1;for(let k=0;k<=n;k++){if(k<n&&arr[k]===val){if(s<0)s=k;}else if(s>=0){fn(s,k);s=-1;}}};
 runs(v,1,(a,b)=>{if(b-a<6)v.fill(0,a,b);});runs(v,0,(a,b)=>{if(a>0&&b<n&&b-a<15)v.fill(1,a,b);});
 const d=new Uint8Array(n);for(let k=0;k<n;k++)if(v[k])for(let j=Math.max(0,k-8);j<=Math.min(n-1,k+15);j++)d[j]=1;
 return {voice:d,hop,db,floor,loud};
}
// Per-sample weight of the cleaned signal for "Pauses only": 1 between phrases, 0 while singing, 50 ms raised-cosine fades.
function pauseGain(ch,rate,vf=voiceFrames(ch,rate)){const {voice,hop}=vf,n=voice.length,g=new Float32Array(n);for(let k=0;k<n;k++)g[k]=voice[k]?0:1;
 const r=5,sm=new Float32Array(n);for(let k=0;k<n;k++){let a=0,w=0;for(let j=-r;j<=r;j++){const q=clamp(k+j,0,n-1),c=.5+.5*Math.cos(Math.PI*j/(r+1));a+=g[q]*c;w+=c;}sm[k]=a/w;}
 for(let k=0;k<n;k++)if(voice[k])sm[k]=0; // never touch a sung frame, even inside a fade
 return {at:i=>{const f=i/hop-.5,k=Math.floor(f),u=f-k,a=sm[clamp(k,0,n-1)],b=sm[clamp(k+1,0,n-1)];return a+(b-a)*u;},frames:sm,hop};}

/* ---------- beat bleed ---------- */
function bestLag(x,r,rate,maxLag=.5){
 // Cross-correlation on a 4x decimated copy of up to 90 s, PHAT-weighted, then refined at full rate.
 const dec=4,len=Math.min(x.length,r.length,Math.round(rate*90)),m=Math.floor(len/dec);if(m<1024)return 0;
 let n=1;while(n<2*m)n*=2;const ar=new Float64Array(n),ai=new Float64Array(n),br=new Float64Array(n),bi=new Float64Array(n);
 for(let i=0;i<m;i++){let a=0,b=0;for(let j=0;j<dec;j++){a+=x[i*dec+j];b+=r[i*dec+j];}ar[i]=a;br[i]=b;}
 fft(ar,ai);fft(br,bi);for(let k=0;k<n;k++){const re=ar[k]*br[k]+ai[k]*bi[k],im=ai[k]*br[k]-ar[k]*bi[k],mag=Math.hypot(re,im)+1e-12;ar[k]=re/mag;ai[k]=im/mag;}
 fft(ar,ai,true);const L=Math.round(maxLag*rate/dec);let best=0,bv=-Infinity;for(let l=-L;l<=L;l++){const v=ar[(l+n)%n];if(v>bv){bv=v;best=l;}}
 // refine +-dec samples at full rate with plain correlation on 20 s
 const seg=Math.min(len,Math.round(rate*20));let lag=best*dec,fine=lag,fv=-Infinity;
 for(let l=lag-dec;l<=lag+dec;l++){let s=0;for(let i=Math.max(0,l);i<seg&&i-l<r.length;i++)s+=x[i]*r[i-l];if(s>fv){fv=s;fine=l;}}
 return fine;}
// Remove the part of each channel that is a linear (filtered, delayed) copy of the backing. strength 0-1.
function removeBleed(ch,ref,rate,strength=1,opt={}){
 const N=4096,H=1024,lag=opt.lag??bestLag(mono(ch),ref,rate),bins=N/2+1,win=new Float64Array(N);for(let i=0;i<N;i++)win[i]=Math.sin(Math.PI*(i+.5)/N);
 const vf=opt.vf||voiceFrames(ch,rate,{pitch:false}),R=i=>{const j=i-lag;return j>=0&&j<ref.length?ref[j]:0;};
 const out=[],report={lag,lagMs:+(lag/rate*1000).toFixed(1),coherence:0,bleedDb:-120};
 for(const x of ch){
  const n=x.length,frames=Math.ceil((n+N)/H),num_r=new Float64Array(bins),num_i=new Float64Array(bins),den=new Float64Array(bins),xx=new Float64Array(bins);
  const xr=new Float64Array(N),xi=new Float64Array(N),rr=new Float64Array(N),ri=new Float64Array(N);
  const frame=(f,re,im,src)=>{const o=f*H-N;for(let i=0;i<N;i++){const p=o+i;re[i]=(p>=0&&p<n?src(p):0)*win[i];im[i]=0;}fft(re,im);};
  // Pass 1: transfer function, weighted toward the pauses (where the mic hears mostly bleed).
  let quiet=0;for(const v of vf.voice)if(!v)quiet++;const wv=quiet>vf.voice.length*.08?0:1;
  for(let f=0;f<frames;f++){const c0=clamp(Math.floor((f*H-N)/vf.hop),0,vf.voice.length-1),c1=clamp(Math.floor(f*H/vf.hop),0,vf.voice.length-1),w=vf.voice[c0]||vf.voice[c1]||vf.voice[(c0+c1)>>1]?wv:1;if(!w)continue;
   frame(f,xr,xi,p=>x[p]);frame(f,rr,ri,R);
   for(let k=0;k<bins;k++){num_r[k]+=w*(xr[k]*rr[k]+xi[k]*ri[k]);num_i[k]+=w*(xi[k]*rr[k]-xr[k]*ri[k]);den[k]+=w*(rr[k]*rr[k]+ri[k]*ri[k]);xx[k]+=w*(xr[k]*xr[k]+xi[k]*xi[k]);}}
  const hr=new Float64Array(bins),hi=new Float64Array(bins);let cohSum=0,cohW=0;
  for(let k=0;k<bins;k++){if(den[k]<1e-12)continue;const coh=(num_r[k]**2+num_i[k]**2)/(den[k]*xx[k]+1e-30),a=strength*clamp((coh-.05)/.2,0,1);hr[k]=a*num_r[k]/den[k];hi[k]=a*num_i[k]/den[k];cohSum+=coh*den[k];cohW+=den[k];}
  report.coherence=Math.max(report.coherence,+(cohSum/Math.max(1e-30,cohW)).toFixed(3));
  // Pass 2: subtract H * R, overlap-add (sine window twice = Hann, 75% overlap sums to 2).
  const y=new Float32Array(n),norm=2*H/N;
  for(let f=0;f<frames;f++){frame(f,xr,xi,p=>x[p]);frame(f,rr,ri,R);
   for(let k=0;k<bins;k++){const er=hr[k]*rr[k]-hi[k]*ri[k],ei=hr[k]*ri[k]+hi[k]*rr[k];xr[k]-=er;xi[k]-=ei;if(k>0&&k<N/2){xr[N-k]=xr[k];xi[N-k]=-xi[k];}}
   fft(xr,xi,true);const o=f*H-N;for(let i=0;i<N;i++){const p=o+i;if(p>=0&&p<n)y[p]+=xr[i]*win[i]*norm;}}
  out.push(y);}
 // Estimated bleed level that was removed, relative to the recording.
 let a=0,b=0;for(let c=0;c<ch.length;c++)for(let i=0;i<ch[c].length;i+=7){const d=ch[c][i]-out[c][i];a+=d*d;b+=ch[c][i]**2;}report.bleedDb=+(10*Math.log10(a/(b+1e-30)+1e-12)).toFixed(1);
 return {channels:out,report};}

/* ---------- RNNoise (browser only) ---------- */
let rnLoad=null;
async function rnnoise(){if(!rnLoad)rnLoad=import('./vendor/rnnoise/rnnoise.js?v=0.33.1').then(m=>m.Rnnoise.load());return rnLoad;}
async function resample(ch,from,to){if(from===to)return ch;const len=Math.round(ch[0].length*to/from),ctx=new OfflineAudioContext(ch.length,len,to),buf=new AudioBuffer({numberOfChannels:ch.length,length:ch[0].length,sampleRate:from});ch.forEach((c,i)=>buf.copyToChannel(c,i));const s=ctx.createBufferSource();s.buffer=buf;s.connect(ctx.destination);s.start();const r=await ctx.startRendering();return Array.from({length:ch.length},(_,i)=>r.getChannelData(i).slice());}
async function isolate(ch,rate,blend){
 const rn=await rnnoise(),x48=await resample(ch,rate,48000),F=rn.frameSize,out=[];
 for(const x of x48){const st=rn.createDenoiseState(),y=new Float32Array(x.length+F),fr=new Float32Array(F);
  try{for(let o=0;o<x.length+F;o+=F){for(let i=0;i<F;i++)fr[i]=(o+i<x.length?x[o+i]:0)*32768;st.processFrame(fr);for(let i=0;i<F&&o+i<y.length;i++)y[o+i]=fr[i]/32768;}}finally{st.destroy();}
  // RNNoise delays its output by one frame (480 samples at 48 kHz). Re-align, then trim.
  out.push(y.subarray(F,F+x.length));}
 const wet=await resample(out,48000,rate);
 return ch.map((c,i)=>{const y=new Float32Array(c.length),w=wet[i];for(let k=0;k<c.length;k++)y[k]=c[k]*(1-blend)+(w[k]||0)*blend;return y;});}

/* ---------- glue for NoiseCleaner ---------- */
const FIELDS=['scope','bleed','ai'];
function wants(s){return !!s&&(s.scope==='pauses'||s.bleed>0||s.ai>0);}
function strip(s){const o={...s};for(const k of FIELDS)delete o[k];return o;}
let last={};
function backing(rate){
 // The Song & vocals backing, at song time 0, which is where a POLISH track's input starts.
 if(typeof S==='undefined'||!S.beat||!root.SongPolish?.state?.().binding)return null;const b=S.beat;
 const m=new Float32Array(b.length);for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<b.length;i++)m[i]+=d[i]/b.numberOfChannels;}return {data:m,rate:b.sampleRate};}
// Bleed removal runs in a worker (this same file) so the page stays responsive on long vocals; it falls back to
// the page itself if workers are unavailable.
let bw=null,bwSeq=0;const bwJobs=new Map();
function bleedJob(ch,ref,rate,strength){return new Promise((resolve,reject)=>{
 if(!bw){try{bw=new Worker('cleaning-plus.js?v=0.33.1');bw.onmessage=({data})=>{const j=bwJobs.get(data.id);if(!j)return;bwJobs.delete(data.id);data.error?j.reject(Error(data.error)):j.resolve({channels:data.channels,report:data.report});};bw.onerror=e=>{e.preventDefault?.();for(const j of bwJobs.values())j.reject(Error(e.message||'Beat-bleed processing stopped.'));bwJobs.clear();bw?.terminate();bw=null;};}
  catch(_){bw=null;try{resolve(removeBleed(ch,ref,rate,strength));}catch(e){reject(e);}return;}}
 const id=++bwSeq,c=ch.map(a=>a.slice()),r=ref.slice();bwJobs.set(id,{resolve,reject});bw.postMessage({id,ch:c,ref:r,rate,strength},[...c.map(a=>a.buffer),r.buffer]);});}
async function before(ch,rate,s){let x=ch;last={};
 if(s.bleed>0){const b=backing(rate);if(!b)last.bleed={skipped:'Load the backing in Song & vocals to remove beat bleed.'};else{const ref=b.rate===rate?b.data:(await resample([b.data],b.rate,rate))[0];const r=await bleedJob(x,ref,rate,s.bleed);x=r.channels;last.bleed=r.report;}}
 if(s.ai>0){try{x=await isolate(x,rate,s.ai);last.ai={blend:s.ai};}catch(e){last.ai={error:'AI voice isolation could not start: '+e.message};}}
 return x;}
function after(orig,r,rate,s,pre=orig){let ch=r.channels;
 // Pauses are judged on the vocal after bleed removal, so a backing heard in the mic is not mistaken for singing.
 if(s.scope==='pauses'){const g=pauseGain(pre,rate);ch=orig.map((o,c)=>{const y=new Float32Array(o.length),p=ch[c];for(let i=0;i<o.length;i++){const k=g.at(i);y[i]=o[i]+k*(p[i]-o[i]);}return y;});}
 const removed=orig.map((o,c)=>{const d=new Float32Array(o.length);for(let i=0;i<o.length;i++)d[i]=o[i]-ch[c][i];return d;});
 return {...r,channels:ch,removed,plus:{...last}};}
// Voice-safety meter: level change and removed energy, singing vs pauses.
function measure(orig,out,rate=48000){
 const ch=out.channels;if(!ch||!orig||ch.length!==orig.length)return null;const vf=voiceFrames(orig,rate);
 let vi=0,vo=0,vr=0,pi=0,po=0;for(let c=0;c<orig.length;c++){const a=orig[c],b=ch[c];for(let i=0;i<a.length;i+=3){const v=vf.voice[Math.min(vf.voice.length-1,Math.floor(i/vf.hop))],d=a[i]-b[i];if(v){vi+=a[i]*a[i];vo+=b[i]*b[i];vr+=d*d;}else{pi+=a[i]*a[i];po+=b[i]*b[i];}}}
 const db=(p,q)=>q>0&&p>0?10*Math.log10(p/q):0;
 return {voice:+db(vo,vi).toFixed(2),voiceRemoved:vi>0?+(10*Math.log10(vr/vi+1e-12)).toFixed(1):-120,pauses:+db(po,pi).toFixed(1),hasVoice:vi>0,hasPauses:pi>0};}
function safetyText(m){if(!m||!m.hasVoice)return '';const warn=m.voice<-1||m.voiceRemoved>-15;
 return (warn?'⚠ ':'')+'Singing changed '+(m.voice>=0?'+':'')+m.voice.toFixed(1)+' dB '+(m.voiceRemoved<-90?'(nothing removed from your singing)':'(removed sound sits '+Math.abs(m.voiceRemoved).toFixed(0)+' dB below your voice)')+' · Pauses cleaned '+Math.abs(m.pauses).toFixed(1)+' dB'+(warn?'. Cleaning is touching your singing: try Gentle, Pauses only, or a lower Maximum reduction.':'.');}
/* ---------- CLEAN panel controls (browser) ---------- */
const ROOMS='pvs.roomProfiles.v1';
function rooms(){try{const v=JSON.parse(localStorage.getItem(ROOMS)||'[]');return Array.isArray(v)?v:[];}catch(_){return [];}}
function installUI(){const doc=root.document,$=id=>doc.getElementById(id),host=$('studioNoiseControls');if(!host||$('noiseScope'))return;
 const presets=host.querySelector('.noise-presets'),note=presets?.nextElementSibling;const box=doc.createElement('div');box.className='noise-plus';
 box.innerHTML='<label class="field"><span>WHERE TO CLEAN</span><select id="noiseScope"><option value="all">Everywhere</option><option value="pauses">Pauses only: singing left exactly as recorded</option></select></label>'
  +'<label class="field"><span>BEAT BLEED (backing heard in the mic)</span><select id="noiseBleed"><option value="0">Off</option><option value="0.5">Gentle</option><option value="1">Strong</option></select></label>'
  +'<label class="field"><span>AI VOICE ISOLATION (optional)</span><select id="noiseAi"><option value="0">Off</option><option value="0.25">Blend 25%</option><option value="0.5">Blend 50%</option><option value="1">Full</option></select></label>'
  +'<p class="note" id="noisePlusInfo"></p><p class="note noise-safety" id="noiseSafety" role="status" aria-live="polite"></p>';
 (note||presets||host.firstChild).after(box);
 const set=(k,v)=>{const m=root.NoiseCleaner;if(!m.mutate({[k]:v}))sync();};
 $('noiseScope').onchange=e=>set('scope',e.target.value==='pauses'?'pauses':'all');$('noiseBleed').onchange=e=>set('bleed',+e.target.value);$('noiseAi').onchange=e=>set('ai',+e.target.value);
 // Room profiles: a learned noise sample saved on this device, reusable for any take recorded in the same room.
 const learn=$('noiseLearn')?.closest('.row'),rb=doc.createElement('div');rb.className='row noise-rooms';
 rb.innerHTML='<button class="btn" id="noiseRoomSave">Save as room profile</button><select id="noiseRoomList" aria-label="Saved room profiles"></select><button class="btn" id="noiseRoomUse">Use room profile</button>';
 const rm=doc.createElement('p');rm.className='note';rm.id='noiseRoomMsg';rm.setAttribute('role','status');
 if(learn){learn.after(rb);rb.after(rm);}
 $('noiseRoomSave').onclick=()=>{const c=root.NoiseCleaner.state();if(!c.profile){$('noiseRoomMsg').textContent='Learn or find a noise sample first, then save it as a room profile.';return;}
  const name=(root.prompt?.('Name this room profile (for example "Bedroom booth")','Room '+new Date().toLocaleDateString())||'').trim().slice(0,40);if(!name)return;
  const list=rooms().filter(r=>r.name!==name);list.unshift({name,savedAt:Date.now(),profile:c.profile});try{localStorage.setItem(ROOMS,JSON.stringify(list.slice(0,6)));}catch(_){ $('noiseRoomMsg').textContent='This browser could not save the profile.';return;}
  $('noiseRoomMsg').textContent='Saved "'+name+'". Use it on other takes recorded in the same room.';sync(true);};
 $('noiseRoomUse').onclick=()=>{const r=rooms().find(x=>x.name===$('noiseRoomList').value);if(!r)return;if(root.NoiseCleaner.mutate({profile:r.profile}))$('noiseRoomMsg').textContent='Using room profile "'+r.name+'". Listen to Removed noise to check it suits this take.';};
 sync(true);setInterval(sync,500);}
let shownRooms='';
function sync(force){const doc=root.document,$=id=>doc.getElementById(id),m=root.NoiseCleaner;if(!m||!$('noiseScope'))return;const c=m.state(),off=m.locked()||!m.active(),r=m.debug().rate||48000;
 for(const [id,v] of [['noiseScope',c.scope==='pauses'?'pauses':'all'],['noiseBleed',String(c.bleed||0)],['noiseAi',String(c.ai||0)]]){const el=$(id);if(doc.activeElement!==el)el.value=v;el.disabled=off;}
 const list=rooms().filter(x=>x.profile?.rate===r),key=list.map(x=>x.name).join('|');if(force||key!==shownRooms){shownRooms=key;$('noiseRoomList').innerHTML=list.length?list.map(x=>'<option>'+x.name.replace(/[<&"]/g,ch=>({'<':'&lt;','&':'&amp;','"':'&quot;'}[ch]))+'</option>').join(''):'<option value="">No saved rooms for this sample rate</option>';}
 $('noiseRoomUse').disabled=off||!list.length;$('noiseRoomSave').disabled=off||!c.profile;$('noiseRoomList').disabled=off||!list.length;
 const res=m.debug().result,p=res?.plus||{},info=[];
 if(c.bleed>0)info.push(p.bleed?.skipped||(p.bleed?'Beat bleed: backing found '+p.bleed.lagMs+' ms late, match '+Math.round(p.bleed.coherence*100)+'%, removed sound '+p.bleed.bleedDb+' dB relative to the recording.':'Beat bleed: applies when the vocal is processed.'));
 if(c.ai>0)info.push(p.ai?.error||'AI voice isolation (RNNoise) blended at '+Math.round(c.ai*100)+'%. It was trained on speech: listen for a watery or lisping voice and lower the blend if you hear it.');
 if(c.scope==='pauses')info.push('Pauses only: your singing is untouched; cleaning fades in between phrases.');
 $('noisePlusInfo').textContent=info.join(' ');
 $('noiseSafety').textContent=m.active()&&c.on?safetyText(res?.safety):'';$('noiseSafety').classList.toggle('warn',!!res?.safety&&(res.safety.voice<-1||res.safety.voiceRemoved>-15));}
if(root.document){const go=()=>{if(root.NoiseCleaner&&root.document.getElementById('studioNoiseControls'))installUI();else setTimeout(go,200);};root.document.readyState==='loading'?root.document.addEventListener('DOMContentLoaded',go):go();}

// Beat-bleed results depend on the backing too: a replaced backing must not reuse a cached result.
function cacheTag(s){if(!(s?.bleed>0)||typeof S==='undefined'||!S.beat)return '';const b=S.beat,d=b.getChannelData(0),n=d.length;let h=0;for(let i=0;i<64;i++){h=(h*31+Math.round((d[Math.floor(i*n/64)]||0)*1e6))|0;}return '|beat:'+b.sampleRate+':'+n+':'+h;}
const api={cacheTag,fft,voiceFrames,pauseGain,bestLag,removeBleed,isolate,wants,strip,before,after,measure,safetyText,FIELDS,last:()=>last};
root.CleanPlus=api;if(typeof module!=='undefined')module.exports=api;
if(typeof WorkerGlobalScope!=='undefined'&&root instanceof WorkerGlobalScope)root.onmessage=({data:m})=>{try{const r=removeBleed(m.ch,m.ref,m.rate,m.strength);root.postMessage({id:m.id,channels:r.channels,report:r.report},r.channels.map(c=>c.buffer));}catch(e){root.postMessage({id:m.id,error:e.message});}};
})(typeof window!=='undefined'?window:globalThis);
