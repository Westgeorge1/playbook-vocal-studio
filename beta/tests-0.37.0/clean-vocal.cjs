/* 0.37.0 Clean vocal: the adaptive noise remover, held-note protection, AI clean (DeepFilterNet3) and the
 * eight-step panel. Maths in Node; the panel, the AI worker and saving in the browser. */
const fs=require('node:fs'),path=require('node:path');
const {suite}=require('../tests-0.32.4/browser.cjs');
const NC=require('../noise-core.js'),CP=require('../cleaning-plus.js'),D=require('../dfn-core.js');
const R=48000,N=R*12;let seed=11;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);
// A sung line: four phrases of a held note with vibrato and a vowel-like harmonic series, pauses between.
const voice=new Float32Array(N);{let ph=0;for(let i=0;i<N;i++){const t=i/R,k=Math.floor(t/3),u=t-k*3;if(u>.6&&u<2.6){const f=[196,220,247,262][k]*(1+.006*Math.sin(2*Math.PI*5.5*t));ph+=2*Math.PI*f/R;const e=Math.min(1,(u-.6)/.03,(2.6-u)/.05);let s=0;for(let h=1;h<=12;h++)s+=Math.sin(h*ph)/(h*(h>2&&h<6?.6:1));voice[i]=.12*s*e;}}}
// Background noise that gets 12 dB louder half-way (a fan speeding up), slightly low-pass.
const noise=new Float32Array(N);{let lp=0;for(let i=0;i<N;i++){lp=.6*lp+.4*rnd();noise[i]=lp*(i<N/2?.004:.016);}}
const mic=Float32Array.from(voice,(v,i)=>v+noise[i]);
const db=x=>10*Math.log10(x+1e-30);
function energy(x,ranges){let e=0;for(const [a,b] of ranges)for(let i=Math.round(a*R);i<Math.round(b*R);i++)e+=x[i]*x[i];return e;}
const pauses=[[.1,.5],[3.1,3.5],[6.1,6.5],[9.1,9.5]],sung=[[1,2.4],[4,5.4],[7,8.4],[10,11.4]];

suite('clean-vocal',59,async({page,check})=>{
 /* ---------- maths ---------- */
 {const n=960,xr=new Float64Array(n),xi=new Float64Array(n),yr=new Float64Array(n),yi=new Float64Array(n);for(let i=0;i<n;i++)xr[i]=Math.sin(i*.37)+rnd();D.fft(xr,xi,yr,yi);let err=0;
  for(const k of [0,1,97,480,959]){let a=0,b=0;for(let j=0;j<n;j++){a+=xr[j]*Math.cos(2*Math.PI*k*j/n);b-=xr[j]*Math.sin(2*Math.PI*k*j/n);}err=Math.max(err,Math.hypot(a-yr[k],b-yi[k]));}
  check('AI clean: the 960-point FFT matches a direct transform',err<1e-9,err);}
 check('AI clean: 32 ERB bands cover all 481 bins as in DeepFilterNet3',D.WIDTHS.length===32&&D.WIDTHS.reduce((a,b)=>a+b)===481&&D.WIDTHS[0]===2&&D.WIDTHS[31]===67);
 {const len=R,x=mic.slice(R,2*R),frames=Math.ceil((len+960)/480),sp=D.analyse(x,frames),gains=new Float32Array(frames*32).fill(1),taps=new Float32Array(frames*96*10);
  for(let t=0;t<frames;t++)for(let k=0;k<96;k++)taps[((t*96+k)*5+2)*2]=1;const y=D.synthesise(sp,{gains,taps},frames,len);let e=0,p=0;for(let i=0;i<len;i++){e+=(y[i]-x[i])**2;p+=x[i]**2;}
  check('AI clean: with neutral gains the signal path returns the input sample-aligned (below -120 dB)',db(e/p)<-120,db(e/p));}
 {const tone=Float32Array.from({length:R},(_,i)=>.2*Math.sin(2*Math.PI*233*i/R)+.05*Math.sin(2*Math.PI*466*i/R)),n=NC.size(R),tr=NC.pitchTrack(tone,R,n,n/4,Math.ceil((R+n-n/4)/(n/4)));
  const mid=Array.from(tr.f0.slice(10,-10)).filter(Boolean);check('Held-note protection: the pitch tracker finds a 233 Hz note within 0.5%',mid.length>40&&mid.every(f=>Math.abs(f/233-1)<.005),mid.slice(0,5));}
 const base={...NC.defaults(),mode:'studio',on:true,reduction:12,smoothing:3,protect:.85,sensitivity:0};
 const classic=NC.process([mic],R,base).channels[0];
 const adaptive=NC.process([mic],R,{...base,engine:'adaptive',follow:3,sensitivity:3,smooth:.5,harmonic:1}).channels[0];
 const late=[[8.7,9.5]],inLate=energy(mic,late);
 check('Adaptive engine: follows noise that gets louder (at least 6 dB more cleaning than the fixed print in the louder half)',db(energy(adaptive,late))<db(energy(classic,late))-6,{adaptive:db(energy(adaptive,late))-db(inLate),classic:db(energy(classic,late))-db(inLate)});
 {const settled=[[.1,.5],[3.1,3.5],[9.1,9.5]];check('Adaptive engine: pauses at least 9 dB quieter once it has followed the change (it needs about half a second after a sudden jump)',db(energy(adaptive,settled))<db(energy(mic,settled))-9);}
 {const err=Float32Array.from(adaptive,(v,i)=>v-voice[i]);check('Held-note protection: held notes keep their level (within 0.5 dB) and the error under them is 20 dB below the voice',Math.abs(db(energy(adaptive,sung))-db(energy(voice,sung)))<.5&&db(energy(err,sung))<db(energy(voice,sung))-20,{lvl:db(energy(adaptive,sung))-db(energy(voice,sung)),err:db(energy(err,sung))-db(energy(voice,sung))});}
 {const wrecked=Float32Array.from(mic,(v,i)=>v*.3),fixed=NC.process([wrecked],R,{...base,reduction:0,engine:'adaptive',harmonic:1},()=>{},[mic]).channels[0];
  check('Held-note protection restores harmonics from the vocal before AI (a stage that took 10 dB of the note gets most of it back)',db(energy(fixed,sung))>db(energy(voice,sung))-3,db(energy(fixed,sung))-db(energy(voice,sung)));}
 {const thump=Float32Array.from(mic,(v,i)=>{const t=i/R,u=t%3,b=(a,w)=>u>a&&u<a+w?Math.sin(Math.PI*(u-a)/w):0;return v+.08*Math.sin(2*Math.PI*45*t)*(b(.35,.1)+b(1.5,.1));});
  // Energy of the 45 Hz thump itself in each window (correlation with a 45 Hz sine and cosine), so the sung note does not count.
  const at45=(x,rs)=>{let e=0;for(const [a0,b0] of rs){let c=0,q=0;for(let i=Math.round(a0*R);i<Math.round(b0*R);i++){c+=x[i]*Math.cos(2*Math.PI*45*i/R);q+=x[i]*Math.sin(2*Math.PI*45*i/R);}e+=c*c+q*q;}return e;};
  const pops=[[.35,.45],[3.35,3.45],[6.35,6.45],[9.35,9.45]],under=[[1.5,1.6],[4.5,4.6],[7.5,7.6],[10.5,10.6]],c0={...base,engine:'adaptive',follow:2,smooth:.5,harmonic:1,reduction:6};
  const y0=NC.process([thump],R,c0).channels[0],y1=NC.process([thump],R,{...c0,under:18}).channels[0];
  const r={pause:db(at45(y1,pops))-db(at45(y0,pops)),underNote:db(at45(y1,under))-db(at45(y0,under)),sung:db(energy(y1,sung))-db(energy(y0,sung))};
  check('Pops under the voice: an 18 dB setting lowers low thumps before a line and under a held note by at least 10 dB, and the held notes stay within 0.3 dB',r.pause<-10&&r.underNote<-10&&Math.abs(r.sung)<.3,r);}
 {const c={...base,dfn:1};check('Step switches: with none off the settings are returned unchanged',NC.effective(c)===c);
  const o=NC.effective({...base,engine:'adaptive',dfn:1,harmonic:1,gap:6,stepsOff:['ai','protect','gaps']});check('Step switches: a step that is off does nothing but keeps its value elsewhere',o.dfn===0&&o.harmonic===0&&o.gap===0&&o.reduction===12);}
 {const hum=Float32Array.from(mic,(v,i)=>v+.003*Math.sin(2*Math.PI*60*i/R)+.0015*Math.sin(2*Math.PI*120*i/R)+.001*Math.sin(2*Math.PI*180*i/R)),m=NC.measure([hum],R);check('Measure: finds 60 Hz hum and reports level and difference',m.hum===60&&m.snrDb>20&&Number.isFinite(m.floorDb),m);
  const m2=NC.measure([mic],R);check('Measure: no hum reported on a clean take',m2.hum===0,m2);
  {let lp=0;const bump=Float32Array.from(mic,(v,i)=>{lp=.995*lp+.005*rnd();return v+lp*.4;});const m3=NC.measure([bump],R);check('Measure: a broad low rumble is not mistaken for hum',m3.hum===0,m3);}}
 {const ref=process.env.PVS_REFERENCE_DIR&&path.join(process.env.PVS_REFERENCE_DIR,'noise-core.js');
  if(ref&&fs.existsSync(ref)){const old=require(ref),a=old.process([mic],R,base).channels[0];check('Classic engine output is identical to the reference build',Buffer.from(a.buffer).equals(Buffer.from(classic.buffer)));}}

 /* ---------- browser ---------- */
 const p=await page(1280,900);
 await p.evaluate(a=>{const C=SongCore,x=Float32Array.from(a);S.song=C.empty(48000);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:12,channels:[x],origin:0,choose:true}),'clean vocal test');},Array.from(mic));
 await p.waitForTimeout(400);
 await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});
 await p.locator('[data-tab=clean]').click();
 const idle=()=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked()&&!NoiseCleaner.locked()&&!NoiseCleaner.debug().error,null,{timeout:240000});await idle();
 check('Clean vocal panel shows steps 1 to 8 at the top of CLEAN',await p.evaluate(()=>{const b=document.getElementById('cleanVocal');return !!b&&b.querySelectorAll('.cv-step').length===9&&b.getBoundingClientRect().height>0;}));
 check('Every step with settings has its own on/off switch',await p.evaluate(()=>['hum','bleed','ai','noise','protect','gaps'].every(s=>document.querySelector('#cleanVocal [data-step="'+s+'"]'))&&!!document.querySelector('#cleanVocal [data-engine-switch="clicks"]')));
 const hashOf=()=>p.evaluate(()=>SongCore.hashPcm(NoiseCleaner.debug().result.channels));const before=await hashOf();
 await p.locator('#cvAuto').click();
 await p.waitForFunction(()=>NoiseCleaner.state().engine==='adaptive',null,{timeout:60000});await idle();await p.waitForTimeout(500);await idle();
 const st=await p.evaluate(()=>({c:NoiseCleaner.state(),r:NoiseCleaner.debug().result,clicks:S.P.chRepairOn,msg:CleanVocal.state().msg,m:CleanVocal.state().measured}));
 check('Clean vocal measures the take and sets every step',!!st.m&&st.c.engine==='adaptive'&&st.c.harmonic===1&&st.c.dfn===1&&st.c.reduction>0&&st.clicks===1&&/Clean vocal set every step/.test(st.msg),{c:st.c,msg:st.msg,m:st.m});
 check('AI clean ran on this device (DeepFilterNet3 worker) without an error',st.r?.plus?.dfn?.amount===1&&!st.r.plus.dfn.error,st.r?.plus);
 check('The cleaned vocal changed and has the same length',await hashOf()!==before&&await p.evaluate(()=>{const d=NoiseCleaner.debug();return d.result.channels[0].length===d.baseline[0].length&&d.result.channels[0].every(Number.isFinite);}));
 const q=await p.evaluate(({pauses,sung})=>{const d=NoiseCleaner.debug(),o=d.result.channels[0],x=d.baseline[0],R=48000,e=(y,rs)=>{let s=0;for(const [a,b] of rs)for(let i=Math.round(a*R);i<Math.round(b*R);i++)s+=y[i]*y[i];return 10*Math.log10(s+1e-30);};return {pause:e(o,pauses)-e(x,pauses),sung:e(o,sung)-e(x,sung),safety:d.result.safety};},{pauses,sung});
 check('Clean vocal: pauses at least 15 dB quieter, held notes within 1 dB (this synthetic tone is one the AI alone removes completely, so this also proves held-note protection)',q.pause<-15&&Math.abs(q.sung)<1,q);
 check('Safety check reports singing, top end and pauses',/Singing changed .* Top end \(4–10 kHz\) .* Pauses cleaned/.test(await p.locator('#cvSafety').textContent()));
 // The singer's own setting stays when the button is pressed again; Reset returns to the button's settings.
 await p.locator('#cv-reduction').fill('5');await p.locator('#cv-reduction').dispatchEvent('change');await idle();
 check('Moving a knob is remembered as your own setting',await p.evaluate(()=>NoiseCleaner.state().reduction===5&&NoiseCleaner.state().touched.includes('reduction')));
 await p.locator('#cvAuto').click();await p.waitForFunction(()=>/Kept your own settings/.test(CleanVocal.state().msg),null,{timeout:60000});await idle();
 check('Clean vocal does not overwrite your own setting',await p.evaluate(()=>NoiseCleaner.state().reduction===5));
 await p.locator('#cvReset').click();await p.waitForFunction(()=>/Reset/.test(CleanVocal.state().msg),null,{timeout:60000});await idle();
 check('Reset returns every step to the Clean vocal settings',await p.evaluate(()=>NoiseCleaner.state().reduction!==5&&!(NoiseCleaner.state().touched||[]).length));
 // A step switched off keeps its value and does nothing.
 await p.locator('#cleanVocal [data-step="ai"]').uncheck();await idle();await p.waitForTimeout(300);await idle();
 check('Switching AI clean off keeps its amount and skips it',await p.evaluate(()=>{const c=NoiseCleaner.state(),r=NoiseCleaner.debug().result;return c.stepsOff.includes('ai')&&c.dfn===1&&!r.plus?.dfn;}));
 check('The switched-off step is shown dimmed',await p.evaluate(()=>document.getElementById('cvStep-ai').classList.contains('off')));
 await p.locator('#cleanVocal [data-step="ai"]').check();await idle();
 // Step 7's switch must also stop room-echo reduction (a Vocal Detail engine setting), and restore it when switched back on.
 await p.locator('#cv-echo').check();await p.waitForFunction(()=>S.P.chRoomReduceOn===1,null,{timeout:30000});await idle();
 await p.locator('#cleanVocal [data-step="gaps"]').uncheck();await p.waitForFunction(()=>S.P.chRoomReduceOn===0,null,{timeout:30000}).catch(()=>{});await idle();
 check('Switching step 7 off also switches room-echo reduction off',await p.evaluate(()=>S.P.chRoomReduceOn===0&&NoiseCleaner.state().stepsOff.includes('gaps')&&NoiseCleaner.state().echoMemo===1&&document.getElementById('cv-echo').disabled));
 await p.locator('#cleanVocal [data-step="gaps"]').check();await p.waitForFunction(()=>S.P.chRoomReduceOn===1,null,{timeout:30000}).catch(()=>{});await idle();
 check('Switching step 7 back on restores room-echo reduction',await p.evaluate(()=>S.P.chRoomReduceOn===1&&!(NoiseCleaner.state().stepsOff||[]).includes('gaps')&&NoiseCleaner.state().echoMemo==null));
 await p.locator('#cv-echo').uncheck();await idle();
 // Listening buttons.
 await p.locator('#cvRemoved').click();await p.waitForTimeout(200);check('Hear what was removed plays the removed sound',await p.evaluate(()=>S.mode==='removed'));
 await p.locator('#cvBefore').click();await p.waitForTimeout(200);check('Before plays the original',await p.evaluate(()=>S.mode==='before'));
 await p.evaluate(()=>{if(typeof stopPlayback==='function')stopPlayback();});
 // Saved with the track.
 await p.locator('#rcStep1').click();await p.waitForFunction(()=>RC.step==='rc');await p.waitForTimeout(300);
 check('Clean vocal settings are saved on the track',await p.evaluate(()=>{const c=S.song.tracks[0].polish.session.noteTuner.cleaner;return c.engine==='adaptive'&&c.dfn===1&&c.harmonic===1;}));
 check('The AI models are part of the offline download',await p.evaluate(async()=>{const t=await (await fetch('offline-worker.js')).text();return ['vendor/dfn3/enc.onnx','vendor/dfn3/erb_dec.onnx','vendor/dfn3/df_dec.onnx','dfn-worker.js','clean-vocal.js'].every(f=>t.includes('"'+f+'"'));}));
});
