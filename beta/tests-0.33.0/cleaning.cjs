/* 0.33.0 cleaning: beat-bleed removal, Pauses only, voice-safety meter, room profiles, optional AI isolation
 * (RNNoise), and Find all breaths. Maths are checked in Node; the real CLEAN and WAVE EDIT controls in the browser. */
const fs=require('node:fs'),path=require('node:path');
const {suite}=require('../tests-0.32.4/browser.cjs');
const P=require('../cleaning-plus.js'),B=require('../breath-find.js');
const R=48000,N=R*12;let seed=3;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);
// Backing: bass, chords and drum bursts. Leak: 9.3 ms late, low-passed, -22 dB. Voice: four phrases with breaths between.
const beat=new Float32Array(N);for(let i=0;i<N;i++){const t=i/R,bt=t%.8;beat[i]=.3*Math.sin(2*Math.PI*55*t)+.15*Math.sin(2*Math.PI*220*t)+.12*Math.sin(2*Math.PI*277*t)+(bt<.05?.6*rnd()*(1-bt/.05):0)+(t%.4<.02?.3*rnd():0);}
const D=Math.round(.0093*R),leak=new Float32Array(N);let lp=0;for(let i=0;i<N;i++){const s=i-D>=0?beat[i-D]:0;lp=.7*lp+.3*s;leak[i]=.08*lp;}
const voice=new Float32Array(N),breath=new Float32Array(N);let ph=0;
for(let i=0;i<N;i++){const t=i/R,k=Math.floor(t/3),u=t-k*3;if(u>.7&&u<2.6){ph+=2*Math.PI*(196+30*k)/R;const e=Math.min(1,(u-.7)/.03,(2.6-u)/.03);voice[i]=(.25*Math.sin(ph)+.08*Math.sin(2*ph))*e;}else if(u>.25&&u<.55)breath[i]=.05*rnd()*Math.sin(Math.PI*(u-.25)/.3);}
const mic=new Float32Array(N);for(let i=0;i<N;i++)mic[i]=voice[i]+breath[i]+leak[i]+.0005*rnd();
const db=(a,b)=>10*Math.log10(a/b);
function wav(x,name){const buf=Buffer.alloc(44+x.length*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(R,24);buf.writeUInt32LE(R*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(x.length*2,40);for(let i=0;i<x.length;i++)buf.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(x[i]*32767))),44+2*i);return {name,mimeType:'audio/wav',buffer:buf};}

suite('cleaning',14,async({page,check})=>{
 /* ---------- maths ---------- */
 {const r=P.removeBleed([mic],beat,R,1),y=r.channels[0];let eb=0,er=0,vv=0;for(let i=R;i<N-R;i++){eb+=leak[i]**2;er+=(y[i]-voice[i]-breath[i])**2;vv+=voice[i]**2;}
  check('Beat bleed: finds the 9.3 ms leak delay (±0.3 ms)',Math.abs(r.report.lagMs-9.3)<=.3);
  check('Beat bleed: removes at least 20 dB of the leaked backing',db(er,eb)<-20);
  const c=Float32Array.from(voice,(v,i)=>v+breath[i]),r2=P.removeBleed([c],beat,R,1);let d=0;for(let i=R;i<N-R;i++)d+=(r2.channels[0][i]-c[i])**2;
  check('Beat bleed: a vocal without bleed is left unchanged (below -60 dB)',db(d,vv)<-60);
  const g=P.pauseGain([mic],R);let inside=0,pause=0;for(let i=0;i<N;i+=240){if(voice[i]!==0)inside=Math.max(inside,g.at(i));}pause=g.at(Math.round(.4*R));
  check('Pauses only: cleaning weight is zero on every sung sample and full in a pause',inside===0&&pause>.99);
  const br=B.find([Float32Array.from(mic,(v,i)=>v-leak[i])],R);check('Find all breaths: finds the four breaths and nothing inside the singing',br.length===4&&br.every((b,k)=>Math.abs(b.start-(k*3+.25))<.1&&b.end<k*3+.7),br);}

 /* ---------- browser: CLEAN controls on a song with a backing ---------- */
 const p=await page(1280,900);
 await p.evaluate(a=>{const C=SongCore,x=Float32Array.from(a);S.song=C.empty(48000);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:12,channels:[x],origin:0,choose:true}),'clean test');},Array.from(mic));
 await p.waitForTimeout(400);
 const chooser=p.waitForEvent('filechooser');await p.locator('#sgLoadBeat').click();await(await chooser).setFiles(wav(beat,'backing.wav'));
 await p.waitForFunction(()=>!!S.beat,null,{timeout:30000});await p.waitForTimeout(400);
 await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});
 await p.locator('[data-tab=clean]').click();
 const idle=()=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked()&&!NoiseCleaner.locked()&&!NoiseCleaner.debug().error,null,{timeout:180000});await idle();
 check('Studio Spectral is active for the song vocal',await p.evaluate(()=>NoiseCleaner.active()));
 for(const id of ['noiseScope','noiseBleed','noiseAi','noiseRoomSave','noiseRoomUse','noiseSafety'])check('CLEAN shows '+id,await p.locator('#'+id).count()===1);
 const before=await p.evaluate(()=>SongCore.hashPcm(NoiseCleaner.debug().result.channels));
 const hashOf=()=>p.evaluate(()=>SongCore.hashPcm(NoiseCleaner.debug().result.channels));
 // Choosing "Everywhere / Off / Off" explicitly changes nothing.
 await p.evaluate(()=>NoiseCleaner.mutate({scope:'all',bleed:0,ai:0}));await idle();await p.waitForTimeout(300);
 check('With every new option off, cleaning is byte-identical to 0.32',await hashOf()===before);
 await p.waitForFunction(()=>/Singing changed/.test(document.getElementById('noiseSafety').textContent),null,{timeout:5000}).catch(()=>{});
 check('Voice-safety meter reports the singing and the pauses',/Singing changed .* dB .* Pauses cleaned/.test(await p.locator('#noiseSafety').textContent()));
 // Beat bleed only (spectral reduction set to 0 so the measurement isolates the bleed canceller).
 const pauseDb=()=>p.evaluate(()=>{const o=NoiseCleaner.debug().result.channels[0],R=48000;let e=0;for(let k=0;k<4;k++)for(let i=Math.round((k*3+.6)*R);i<Math.round((k*3+.68)*R);i++)e+=o[i]*o[i];for(let k=0;k<4;k++)for(let i=Math.round((k*3+2.75)*R);i<Math.round((k*3+2.95)*R);i++)e+=o[i]*o[i];return 10*Math.log10(e+1e-20);});
 await p.evaluate(()=>NoiseCleaner.mutate({reduction:0}));await idle();await p.waitForTimeout(300);const pd0=await pauseDb();
 await p.locator('#noiseBleed').selectOption('1');await idle();await p.waitForTimeout(400);
 const plus=await p.evaluate(()=>NoiseCleaner.debug().result.plus);
 check('Beat bleed uses the Song & vocals backing and reports the delay',plus?.bleed&&Math.abs(plus.bleed.lagMs-9.3)<=.5&&plus.bleed.coherence>.9,plus);
 const pd1=await pauseDb();check('Beat bleed lowers the backing heard in the pauses by at least 15 dB',pd1<pd0-15,{pd0,pd1});
 check('The info line explains what bleed removal did',/Beat bleed: backing found/.test(await p.locator('#noisePlusInfo').textContent()));
 // Pauses only: sung samples identical to the input.
 await p.evaluate(()=>NoiseCleaner.mutate({reduction:15}));await p.locator('#noiseScope').selectOption('pauses');await idle();await p.waitForTimeout(400);
 const untouched=await p.evaluate(()=>{const d=NoiseCleaner.debug(),o=d.result.channels[0],x=d.baseline[0],R=48000;let max=0;for(let k=0;k<4;k++)for(let i=Math.round((k*3+.82)*R);i<Math.round((k*3+2.5)*R);i++)max=Math.max(max,Math.abs(o[i]-x[i]));return max;});
 check('Pauses only: every sung sample is exactly as recorded',untouched===0,untouched);
 await p.waitForFunction(()=>/Singing changed \+0\.0 dB/.test(document.getElementById('noiseSafety').textContent),null,{timeout:5000}).catch(()=>{});
 check('Pauses only: the meter shows the singing unchanged',/Singing changed \+0\.0 dB/.test(await p.locator('#noiseSafety').textContent()));
 check('Removed-noise listening matches the new output',await p.evaluate(()=>{const d=NoiseCleaner.debug(),o=d.result.channels[0],x=d.baseline[0],rm=d.result.removed[0];for(let i=0;i<o.length;i+=997)if(Math.abs(x[i]-o[i]-rm[i])>1e-6)return false;return true;}));
 // Strong everywhere on a vocal: the meter warns when the singing is touched.
 await p.locator('#noiseScope').selectOption('all');await p.evaluate(()=>NoiseCleaner.mutate({reduction:18,sensitivity:6,bleed:0}));await idle();await p.waitForTimeout(300);
 const meter=await p.evaluate(()=>NoiseCleaner.debug().result.safety);check('The meter measures how much the singing changed',meter&&meter.hasVoice&&Number.isFinite(meter.voice),meter);
 // Settings are saved with the project and restored.
 await p.locator('#noiseScope').selectOption('pauses');await idle();await p.waitForTimeout(300);
 await p.locator('#rcStep1').click();await p.waitForFunction(()=>RC.step==='rc');await p.waitForTimeout(300);
 check('Cleaning choices are saved on the track',await p.evaluate(()=>S.song.tracks[0].polish.session.noteTuner.cleaner.scope==='pauses'));
 await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching,null,{timeout:120000});await p.locator('[data-tab=clean]').click();await idle();
 // Room profiles.
 p.on('dialog',d=>d.accept('Bedroom booth'));
 if(!(await p.evaluate(()=>!!NoiseCleaner.state().profile))){await p.locator('#noiseFind').click();await idle();}
 await p.locator('#noiseRoomSave').click();await p.waitForTimeout(300);
 check('A learned noise sample can be saved as a room profile',await p.evaluate(()=>JSON.parse(localStorage.getItem('pvs.roomProfiles.v1')||'[]')[0]?.name==='Bedroom booth'));
 await p.evaluate(()=>NoiseCleaner.mutate({profile:null}));await idle();
 await p.waitForTimeout(700);await p.locator('#noiseRoomList').selectOption('Bedroom booth');await p.locator('#noiseRoomUse').click();await idle();
 check('The saved room profile can be used on a take',await p.evaluate(()=>NoiseCleaner.state().profile?.power?.length>0)&&/Using room profile/.test(await p.locator('#noiseRoomMsg').textContent()));
 // AI voice isolation (RNNoise, loaded on demand).
 await p.locator('#noiseScope').selectOption('all');await idle();const h1=await hashOf();
 await p.locator('#noiseAi').selectOption('0.5');await idle();await p.waitForTimeout(400);
 const ai=await p.evaluate(()=>{const d=NoiseCleaner.debug(),o=d.result.channels[0];let bad=0;for(const v of o)if(!Number.isFinite(v))bad++;return {plus:d.result.plus,len:o.length,base:d.baseline[0].length,bad};});
 check('AI voice isolation runs in the browser and blends with the vocal',!ai.plus?.ai?.error&&ai.plus?.ai?.blend===.5&&ai.len===ai.base&&!ai.bad&&await hashOf()!==h1,ai);
 await p.locator('#noiseAi').selectOption('0');await p.evaluate(()=>NoiseCleaner.mutate({bleed:1,reduction:6,sensitivity:0}));await idle();
 // Find all breaths in WAVE EDIT.
 await p.locator('[data-dock="wave"]').click();await p.waitForTimeout(300);
 await p.locator('#breathFindAll').click();await p.waitForTimeout(300);
 const rows=await p.locator('#breathList [data-breath]').count();check('Find all breaths lists every likely breath',rows>=4,rows);
 await p.locator('#breathList [data-breath]').first().uncheck();
 await p.locator('#breathReduceAll').click();await idle();await p.waitForTimeout(300);
 const n=await p.evaluate(()=>S.st.edits.breaths.length);check('Reduce ticked breaths applies every ticked breath in one go',n===rows-1,{n,rows});
 check('The breath list offers to undo them all',await p.locator('#breathUndoAll').isVisible());
 await p.locator('#breathUndoAll').click();await idle();await p.waitForTimeout(300);
 check('Undo these removes all of the batch',await p.evaluate(()=>S.st.edits.breaths.length)===0);
 // Phone layout keeps the CLEAN controls on screen.
 await p.context().close();
 const q=await page(390,844);await q.locator('#rcStep2').click();await q.locator('[data-tab=clean]').click();await q.waitForTimeout(300);
 check('390×844: CLEAN still fits the screen with the new controls',await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await q.context().close();
});
