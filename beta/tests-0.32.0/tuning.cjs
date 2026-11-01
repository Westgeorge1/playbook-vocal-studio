/* 0.32.0 tuning regression: approved sound unchanged, research presets, smart centres, Natural controls,
 * tilt, leveling, blind compare, Natural display and the optional AI octave check (SwiftF0).
 * PLAYWRIGHT_MODULE, PVS_CHROME and PVS_TEST_OUT may override local setup. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {synth,singer}=require('./fixtures/synth-vocal.cjs');
const APP=path.resolve(__dirname,'..'),OUT=process.env.PVS_TEST_OUT||path.join(__dirname,'results');fs.mkdirSync(OUT,{recursive:true});
const rows=[],errors=[];let b,server;const PORT=require('../tests-0.32.4/test-port.cjs')(8792,0),URL=`http://127.0.0.1:${PORT}/index.html`;
function check(name,value,detail){rows.push({name,pass:!!value,detail});console.log((value?'PASS ':'FAIL ')+name+(detail!==undefined?' '+JSON.stringify(detail):''));}
const sleep=t=>new Promise(r=>setTimeout(r,t));
const idle=p=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked()&&!NoiseCleaner.locked(),null,{timeout:300000});
// SongCore.hashPcm(S.final) recorded from 0.31.13 for synth(11): these historical values are informational; playback.cjs checks audible PCM on one runtime.
// 0.31.13 tuned this vocal to its follow-my-singing reference, A = 443.8 Hz; the check sets that reference as Custom.
const APPROVED={none:'f512165a811412b8',presetSnapSmooth:'4a46484d219a07ee',presetCenterSmooth:'1e4f667830f611c6'};

/* ---------- 1. Natural tuning engine: defaults identical to 0.31.13 ---------- */
{
 const A=require('./fixtures/natural-tuning-0.31.13.js'),B=require(path.join(APP,'natural-tuning.js'));
 let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);let diff=0,runs=0;
 for(let r=0;r<200;r++){
  const n=1500,hop=.0058,edited=new Float32Array(n).fill(NaN),notes=[];let i=10;
  while(i<n-60){const len=10+Math.floor(rnd()*120),c=48+rnd()*24;for(let k=i;k<i+len;k++)edited[k]=c+.3*Math.sin(k*.2)+(rnd()-.5)*.1;notes.push({i0:i,i1:i+len-1,center:c,shift:0,drift:0,vib:1,tr:0,review:rnd()<.05});i+=len+Math.floor(rnd()*20);}
  const quality=new Float32Array(n).map(()=>rnd()),sib=new Uint8Array(n).map(()=>rnd()<.05?1:0);
  for(const opt of [{},{keepInTune:false},{expression:false},{keepBlue:false}]){
   const o={edited,notes,hop,amount:.2+rnd()*.8,ref:(rnd()-.5)*.6,pcs:[0,2,4,5,7,9,11],speedMs:20+rnd()*180,quality,sibilants:sib,...opt};
   const a=A.apply(o),c=B.apply(o);runs++;
   for(let k=0;k<n;k++){const x=a.final[k],y=c.final[k];if(!(x===y||(x!==x&&y!==y)))diff++;}
   if(JSON.stringify([a.review,a.corrected,a.untouched])!==JSON.stringify([c.review,c.corrected,c.untouched]))diff++;
  }}
 check('Natural engine with default controls is bit-identical to 0.31.13 ('+runs+' random runs)',diff===0,diff);
 const n=400,hop=.0058,edited=new Float32Array(n),note={i0:20,i1:380,center:60.3,shift:0,drift:0,vib:1,tr:0};
 for(let i=0;i<n;i++)edited[i]=60.3+.3*Math.sin(2*Math.PI*5.5*i*hop)+.15*Math.sin(Math.PI*i/n);
 const base={edited,notes:[note],hop,amount:1,ref:0,pcs:[0,2,4,5,7,9,11],speedMs:50,keepInTune:true,expression:false};
 const sd=v=>{let m=0,c=0;for(let i=120;i<300;i++){m+=v[i];c++;}m/=c;let s=0;for(let i=120;i<300;i++)s+=(v[i]-m)**2;return Math.sqrt(s/c);};
 const v0=sd(B.apply(base).final),vHalf=sd(B.apply({...base,vibrato:.5}).final);
 check('Vibrato 50% roughly halves the vibrato depth',vHalf<v0*.65&&vHalf>v0*.35,{v0,vHalf});
 const flexOff=B.apply({...base,edited:edited.map(v=>v-.22),notes:[{...note,center:60.08}],flex:30}).untouched.length;
 check('Flex 30 leaves a note 8 cents off alone',flexOff===1);
 const hum=B.apply({...base,drift:1,humanize:1}).final,noHum=B.apply({...base,drift:1}).final;
 check('Humanize relaxes drift correction late in a long note',Math.abs(hum[330]-noHum[330])>1e-4&&Math.abs(hum[40]-noHum[40])<1e-6);
}

(async()=>{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory',APP],{stdio:'ignore'});await sleep(700);
 b=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'],headless:true});
 // Each fresh case gets its own browser profile; a reload (fresh:false) reuses the previous profile.
 let ctx=null;
 async function open(vox,{fresh=true}={}){
  if(fresh||!ctx){ctx=await b.newContext({viewport:{width:1440,height:900}});await ctx.route('https://**/*',r=>r.abort());}
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(URL);
  await p.waitForFunction(()=>window.WorkWindows&&window.SongStudio&&!S.loading,null,{timeout:180000});
  if(fresh)await p.evaluate(v=>{const C=SongCore;const a=new Float32Array(Uint8Array.from(atob(v.data),x=>x.charCodeAt(0)).buffer);S.song=C.empty(v.R);S.song.key=7;S.song.scale=1;SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:a.length/v.R,channels:[a],origin:0,choose:true}),'0.32 test');},{R:vox.R,data:Buffer.from(Float32Array.from(vox.a).buffer).toString('base64')});
  await p.evaluate(()=>RC.step==='rc'?SongPolish.open(S.song.tracks[0].id):true);await idle(p);await p.evaluate(()=>showPage('tune'));await sleep(500);
  const fr=p.frames().find(f=>f.url().includes('note-editor.html'));await fr.evaluate(()=>{window.confirm=()=>true;});
  return {p,fr};
 }
 const vox=synth(11);
 const metrics=async fr=>{const an=await fr.evaluate(()=>PlaybookNoteEditor.analysis());let e=0,n=0,vi=0,vo=0,si=0,so=0,sn=0;
  const mean=x=>x.reduce((s,v)=>s+v,0)/x.length,dev=(x,m)=>Math.sqrt(mean(x.map(v=>(v-m)**2)));
  for(const nt of vox.notes){const f=t=>Math.round((t-an.tOff)/an.hop),a=f(nt.t0+(nt.t1-nt.t0)*.25),z=f(nt.t0+(nt.t1-nt.t0)*.85),fin=[],org=[];
   for(let i=a;i<=z;i++)if(an.final[i]!=null&&an.m[i]!=null){fin.push(an.final[i]);org.push(an.m[i]);}
   if(fin.length<5)continue;const mf=mean(fin);if(Math.abs(mf-nt.mid)>.5)continue;e+=Math.abs(mf-nt.mid)*100;n++;vi+=dev(org,mean(org));vo+=dev(fin,mf);
   const a2=f(nt.t0+.01),z2=f(nt.t0+.06),x=[],y=[];for(let i=a2;i<=z2;i++)if(an.final[i]!=null&&an.m[i]!=null){x.push(an.m[i]-mean(org));y.push(an.final[i]-mf);}
   if(x.length>2){si+=Math.abs(mean(x));so+=Math.abs(mean(y));sn++;}}
  return {centreErr:+(e/n).toFixed(1),vibKept:Math.round(100*vo/vi),scoopKept:Math.round(100*so/si)};};

 /* ---------- 2. approved presets unchanged ---------- */
 for(const preset of Object.keys(APPROVED)){
  const {p,fr}=await open(vox);
  await fr.evaluate(()=>{const i=document.getElementById('refHz');i.value='443.8';i.dispatchEvent(new Event('change'));});await sleep(300);await idle(p);
  if(preset!=='none'){await fr.locator('#'+preset).click();await sleep(300);await idle(p);}
  const hash=await p.evaluate(()=>SongCore.hashPcm(S.final));console.log('INFO historical fingerprint',preset,hash,hash===APPROVED[preset]?'match':'differs; see same-browser playback comparison');
  if(preset==='presetSnapSmooth'){await fr.locator('#refMode').selectOption('standard');await sleep(300);await idle(p);await fr.locator('#presetSnapSmooth').click();await sleep(300);await idle(p);const m=await metrics(fr);check('Approved A tunes the test vocal within 4 cents at A = 440',m.centreErr<4,m);}
  await p.close();
 }

 /* ---------- 3. research presets ---------- */
 const expect={presetRoots:{err:4,vibMin:85,scoopMin:60},presetGentle:{err:9,vibMin:95,scoopMin:70},presetTight:{err:4,vibMin:70},presetHard:{err:5,vibMax:60}};
 for(const [id,e] of Object.entries(expect)){
  const {p,fr}=await open(vox);
  // 0.32: a new vocal without a backing tunes to A = 440 (the test vocal is written at 440).
  check(id+': new vocal starts on Auto at A = 440',await fr.evaluate(()=>document.getElementById('refMode').value==='auto'&&document.getElementById('refHz').value==='440.0'));
  await fr.locator('#'+id).click();await sleep(300);await idle(p);
  const m=await metrics(fr);
  check(id+' accuracy and expression',m.centreErr<e.err&&(!e.vibMin||m.vibKept>=e.vibMin)&&(!e.vibMax||m.vibKept<=e.vibMax)&&(!e.scoopMin||m.scoopKept>=e.scoopMin),m);
  if(id==='presetRoots'){
   const st=await fr.evaluate(()=>PlaybookNoteEditor.state().settings);
   check('Natural Roots sets Natural mode, smart centres and its values',st.autoMode==='natural'&&st.centreMode==='weighted'&&st.smooth===1&&st.autoSpeed===50&&st.autoFlex===15&&st.autoDrift===.3&&st.autoVib===.9&&st.autoHumanize===.2);
   check('Status counts automatically tuned notes',/tuned automatically|0\s*off pitch/.test(await fr.evaluate(()=>document.getElementById('status').textContent)));
   // Natural sliders + undo
   await fr.locator('#autoDrift').fill('60');await sleep(200);await idle(p);
   check('Drift slider updates the setting',await fr.evaluate(()=>PlaybookNoteEditor.state().settings.autoDrift)===.6);
   await fr.locator('#undo').click();await sleep(200);await idle(p);
   check('Undo restores the drift setting',await fr.evaluate(()=>PlaybookNoteEditor.state().settings.autoDrift)===.3);
   // reload keeps everything
   await p.evaluate(async()=>{if(window.persistNow)await persistNow();});await sleep(1500);await p.close();
   const r=await open(vox,{fresh:false});const st2=await r.fr.evaluate(()=>PlaybookNoteEditor.state().settings);
   check('Research preset settings survive a reload',st2.autoMode==='natural'&&st2.centreMode==='weighted'&&st2.autoFlex===15&&st2.autoVib===.9&&st2.ref===440);
   await r.p.close();
  } else await p.close();
 }

 /* ---------- 4. tilt, leveling, blind compare ---------- */
 {
  const {p,fr}=await open(vox);
  await fr.locator('#presetSnapSmooth').click();await sleep(300);await idle(p);
  const before=await p.evaluate(()=>SongCore.hashPcm(S.final));
  // Tilt applies to the selection; Select all puts every note in it.
  await fr.locator('#selAll').click();await sleep(150);await fr.locator('#nTilt').fill('40');await sleep(300);await idle(p);
  const rowsT=await fr.evaluate(()=>PlaybookNoteEditor.state().settings.notes.map(r=>r[13]));
  check('Tilt is stored per note (row index 13)',rowsT.length>0&&rowsT.every(v=>Math.abs(v-.4)<1e-9));
  check('Tilt changes the tuned vocal',await p.evaluate(()=>SongCore.hashPcm(S.final))!==before);
  await fr.locator('#undo').click();await sleep(300);await idle(p);
  check('Undo removes the tilt',await p.evaluate(()=>SongCore.hashPcm(S.final))===before);
  await fr.locator('#status').click();await p.keyboard.press('Escape');await sleep(150);
  const g0=await fr.evaluate(()=>PlaybookNoteEditor.state().settings.notes.map(r=>r[9]));
  await fr.locator('#levApply').click();await sleep(300);await idle(p);
  const g1=await fr.evaluate(()=>PlaybookNoteEditor.state().settings.notes.map(r=>r[9]));
  check('Level all notes moves note volumes within ±6 dB',g1.some((v,i)=>v!==g0[i])&&g1.every((v,i)=>Math.abs(v-g0[i])<=6),{g0,g1});
  await fr.locator('#undo').click();await sleep(300);await idle(p);
  const base=await fr.evaluate(()=>{const {id,...s}=PlaybookNoteEditor.state().settings;return JSON.stringify(s);});
  await fr.locator('#cmpStart').click();await sleep(500);await idle(p);
  check('Blind compare shows three Hear and Keep buttons',await fr.locator('#cmpPlays button').count()===3&&await fr.locator('#cmpKeeps button').count()===3);
  check('Names stay hidden during the test',!/Natural Roots|Gentle Polish|approved/i.test(await fr.locator('#cmpRun').textContent()));
  const h=[];for(let k=0;k<3;k++){await fr.locator('#cmpPlays button').nth(k).click();await sleep(400);await idle(p);h.push(await p.evaluate(()=>SongCore.hashPcm(S.final)));await fr.locator('#play').click().catch(()=>{});}
  if(await fr.evaluate(()=>/pause/i.test(document.getElementById('playLabel').textContent)))await fr.locator('#play').click();
  check('Each version sounds different',new Set(h).size===3,h);
  await fr.locator('#cmpKeeps button').nth(1).click();await sleep(400);await idle(p);
  const msg=await fr.locator('#cmpMsg').textContent();
  check('Keep reveals which preset was which',/You kept Y/.test(msg)&&/Natural Roots/.test(msg)&&/Gentle Polish/.test(msg),msg);
  check('Kept version is the one heard as Y',await p.evaluate(()=>SongCore.hashPcm(S.final))===h[1]);
  await fr.locator('#undo').click();await sleep(400);await idle(p);
  check('Undo returns to the settings before the test',await fr.evaluate(()=>{const {id,...s}=PlaybookNoteEditor.state().settings;return JSON.stringify(s);})===base);
  await fr.locator('#cmpStart').click();await sleep(400);await idle(p);await fr.locator('#cmpPlays button').nth(0).click();await sleep(300);await idle(p);
  await fr.locator('#cmpCancel').click();await sleep(300);await idle(p);
  check('Cancel test restores the previous settings',await fr.evaluate(()=>{const {id,...s}=PlaybookNoteEditor.state().settings;return JSON.stringify(s);})===base);
  await p.close();
 }

 /* ---------- 5. tuning reference ---------- */
 {
  const {p,fr}=await open(vox);
  const ref=()=>fr.evaluate(()=>({mode:document.getElementById('refMode').value,hz:+document.getElementById('refHz').value,info:document.getElementById('refInfo').textContent,warn:!document.getElementById('refWarn').hidden}));
  let r=await ref();check('Auto without a backing explains standard A = 440',r.mode==='auto'&&r.hz===440&&/No backing yet/.test(r.info),r);
  await fr.locator('#presetSnapSmooth').click();await sleep(300);await idle(p);
  await fr.evaluate(()=>{const R=44100,a=new Float32Array(R*20),f=440*Math.pow(2,-25/1200);for(let i=0;i<a.length;i++){const t=i/R;a[i]=.25*(Math.sin(2*Math.PI*f*t)+.5*Math.sin(2*Math.PI*f*1.5*t)+.4*Math.sin(2*Math.PI*f*2*t));}PlaybookNoteEditor.backing([a],R);});
  await sleep(800);await idle(p);r=await ref();
  check('Adding a backing 25 cents flat re-tunes Auto to it',r.mode==='auto'&&Math.abs(r.hz-433.6)<1.2&&/Tuned to the backing/.test(r.info),r);
  check('Snapped notes move with the reference (none left off pitch)',/(^|\D)0\s*off pitch/.test(await fr.evaluate(()=>document.getElementById('status').textContent)));
  await fr.locator('#refMode').selectOption('singing');await sleep(400);await idle(p);r=await ref();
  check('My singing with a backing warns about clashing with the beat',r.mode==='singing'&&r.warn&&/Following your singing/.test(r.info),r);
  await fr.locator('#refMatch').click();await sleep(800);await idle(p);r=await ref();
  check('Tune to the backing from the warning',r.mode==='riddim'&&!r.warn&&Math.abs(r.hz-433.6)<1.2,r);
  await fr.locator('#undo').click();await sleep(500);await idle(p);r=await ref();
  check('Undo restores My singing',r.mode==='singing',r);
  await p.close();
 }
 {
  const v=singer(9,17,20),truth=17+20/2;const res={};
  for(const mode of ['singing','singingDrift']){
   const {p,fr}=await open(v);await fr.locator('#refMode').selectOption(mode);await sleep(400);await idle(p);
   await fr.locator('#presetSnapSmooth').click();await sleep(300);await idle(p);
   const an=await fr.evaluate(()=>PlaybookNoteEditor.analysis()),info=await fr.evaluate(()=>document.getElementById('refInfo').textContent);
   let e=0,n=0;const mean=x=>x.reduce((a,b)=>a+b,0)/x.length;
   for(const nt of v.notes){const f=t=>Math.round((t-an.tOff)/an.hop),a=f(nt.t0+(nt.t1-nt.t0)*.25),z=f(nt.t0+(nt.t1-nt.t0)*.85),x=[];for(let i=a;i<=z;i++)if(an.final[i]!=null)x.push(an.final[i]);if(x.length<5)continue;const m=mean(x);if(Math.abs(m-nt.mid)>.6)continue;e+=Math.abs(m-(nt.mid+(v.offsetC+v.driftC*nt.tc/v.total)/100))*100;n++;}
   res[mode]={err:+(e/n).toFixed(1),cents:Math.round(1200*Math.log2(an.ref/440)),info};
   if(mode==='singingDrift'){
    const st=await fr.evaluate(()=>PlaybookNoteEditor.state().settings);
    check('Drift curve is saved with the project',st.refMode==='singingDrift'&&Array.isArray(st.refDrift?.v)&&st.refDrift.v.length>10);
    const m=/move from ([+-]?\d+)¢ to ([+-]?\d+)¢/.exec(info);
    check('Drift readout matches the singer (about +19 to +35 cents)',m&&Math.abs(+m[1]-19.4)<7&&Math.abs(+m[2]-34.6)<7,info);
    await p.evaluate(async()=>{if(window.persistNow)await persistNow();});await sleep(1200);await p.close();
    const r2=await open(v,{fresh:false});const an2=await r2.fr.evaluate(()=>PlaybookNoteEditor.analysis());
    check('Following drift sounds the same after reopening',JSON.stringify(an2.final)===JSON.stringify(an.final));
    await r2.p.close();
   } else await p.close();
  }
  check('My singing finds the singer\'s centre (within 5 cents)',Math.abs(res.singing.cents-truth)<=5,res.singing);
  check('Following drift tunes closer to the singer than one fixed centre',res.singingDrift.err<res.singing.err&&res.singingDrift.err<3,res);
 }

 /* ---------- 6. AI octave check ---------- */
 {
  const v37=synth(37);const {p,fr}=await open(v37);
  const wrong=async()=>{const an=await fr.evaluate(()=>PlaybookNoteEditor.analysis());let w=0;for(const nt of v37.notes){const a=Math.round((nt.t0+(nt.t1-nt.t0)*.3-an.tOff)/an.hop),z=Math.round((nt.t0+(nt.t1-nt.t0)*.7-an.tOff)/an.hop);let bad=0,c=0;for(let i=a;i<=z;i++){if(an.m[i]==null)continue;c++;if(Math.abs(an.m[i]-nt.mid)>6)bad++;}if(c&&bad/c>.3)w++;}return w;};
  const w0=await wrong();
  await fr.locator('#aiPitch').click();await sleep(800);await idle(p);await fr.waitForFunction(()=>document.getElementById('busy').hidden,null,{timeout:300000});await sleep(300);
  const w1=await wrong(),hint=await fr.locator('#aiPitchHint').textContent();
  check('Test vocal starts with an octave error',w0>=1,w0);
  check('AI octave check fixes it',w1===0,{w1,hint});
  check('AI check reports what it moved',/moved \d+ pitch frames/.test(hint),hint);
  check('AI check setting is saved',await fr.evaluate(()=>PlaybookNoteEditor.state().settings.aiPitch)===true);
  await p.close();
 }

 await b.close();server.kill();
 const failed=rows.filter(r=>!r.pass).length;
 fs.writeFileSync(path.join(OUT,'tuning-results.json'),JSON.stringify({rows,errors},null,1));
 console.log(`${rows.length-failed} passed, ${failed} failed, ${errors.length} page errors`);if(errors.length)console.log(errors.slice(0,5));
 process.exit(failed||errors.length?1:0);
})().catch(e=>{console.error(e);try{server.kill();}catch(_){}process.exit(1);});
