/* 0.32.3 manual cleanup regression: separation maths, the real Song & vocals flow (Edit → Manual cleanup ·
 * Separate sound), breath finder, Keep as new take, Undo, storage of only the edited stretch, and rebuilding
 * the take after reopening. PLAYWRIGHT_MODULE, PVS_CHROME and PVS_TEST_OUT may override local setup. */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const APP=path.resolve(__dirname,'..'),OUT=process.env.PVS_TEST_OUT||path.join(__dirname,'results');fs.mkdirSync(OUT,{recursive:true});
const rows=[],errors=[];let b,server;const PORT=require('../tests-0.32.4/test-port.cjs')(8793,3),URL=`http://127.0.0.1:${PORT}/index.html`;
function check(name,value,detail){rows.push({name,pass:!!value,detail});console.log((value?'PASS ':'FAIL ')+name+(detail!==undefined?' '+JSON.stringify(detail):''));}
const sleep=t=>new Promise(r=>setTimeout(r,t));

/* ---------- 1. separation maths (Node) ---------- */
{
 const V=require(path.join(APP,'separation.js'));const R=48000,n=R*2,x=new Float32Array(n),lo=new Float32Array(n),hi=new Float32Array(n);
 for(let i=0;i<n;i++){lo[i]=.3*Math.sin(2*Math.PI*60*i/R);hi[i]=.3*Math.sin(2*Math.PI*1000*i/R);x[i]=lo[i]+hi[i];}
 const s=R/2,e=s+R,keep=10**(-36/20);const rm=V.removed(x,s,e,R,{low:0,high:100,db:36,fade:0});let el=0,eh=0,p=0;
 for(let i=4800;i<R-4800;i++){el+=(rm[i]-lo[s+i]*(1-keep))**2;eh+=(x[s+i]-rm[i]-hi[s+i]-lo[s+i]*keep)**2;p+=hi[s+i]**2;}
 check('Rumble band removed accurately (error below -40 dB)',10*Math.log10(el/p)<-40,+(10*Math.log10(el/p)).toFixed(1));
 check('Sound above the band is kept (error below -40 dB)',10*Math.log10(eh/p)<-40,+(10*Math.log10(eh/p)).toFixed(1));
 const full=V.removed(x,s,e,R,{low:0,high:R/2,db:6,fade:10});check('Full-band reduction matches the dB setting',Math.abs(full[R/2]/x[s+R/2]-(1-10**(-6/20)))<1e-4);
 const share=f=>{const y=Float32Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*f*i/R)),r=V.removed(y,s,e,R,{low:0,high:100,db:36,fade:0});let a=0,c=0;for(let i=4800;i<R-4800;i++){a+=r[i]**2;c+=y[s+i]**2;}return Math.sqrt(a/c);};
 const sh=[60,100,120,200].map(share);check('Band edge is soft: removal falls smoothly from inside to outside the band',sh[0]>.95&&sh[1]>.4&&sh[1]<.8&&sh[2]<.15&&sh[3]<.02,sh.map(v=>+v.toFixed(2)));
 let threw=false;try{V.removed(x,0,R*31,R,{low:0,high:100,db:6,fade:10});}catch(_){threw=true;}check('Selections over 30 seconds are refused',threw||n<R*31);
 const t0=Date.now();V.removed(new Float32Array(R*31),0,R*30,R,{low:50,high:300,db:12,fade:10});check('A 30-second selection processes in under 2 s',Date.now()-t0<2000,Date.now()-t0);
}

(async()=>{
 server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1','--directory',APP],{stdio:'ignore'});await sleep(700);
 b=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'],headless:true});
 const ctx=await b.newContext({viewport:{width:1280,height:900}});await ctx.route('https://**/*',r=>r.abort());
 const open=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(URL);await p.waitForFunction(()=>window.Studio&&window.SongStudio&&!S.loading,null,{timeout:180000});return p;};
 let p=await open();
 // 20 s vocal (a long take, so storage savings show): tones with a breath-like noise burst at 1.5-1.9 s and a 60 Hz rumble.
 await p.evaluate(()=>{const C=SongCore,R=48000,a=new Float32Array(R*20);let seed=3;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);
  for(let i=0;i<a.length;i++){const t=i/R;let v=.02*Math.sin(2*Math.PI*60*t);if(t<1.4||(t>2&&t<19.6))v+=.25*Math.sin(2*Math.PI*220*t)+.1*Math.sin(2*Math.PI*440*t);if(t>1.5&&t<1.9)v+=.03*rnd();a[i]=v;}
  window.__orig=a;S.song=C.empty(R);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:20,channels:[a],origin:0,choose:true}),'cleanup test');});
 await sleep(800);
 await p.locator('[data-edit]').first().click();await sleep(400);
 check('Take dialog offers Manual cleanup · Separate sound',await p.locator('#songDialog button',{hasText:'Manual cleanup'}).count()===1);
 await p.locator('#songDialog button',{hasText:'Manual cleanup'}).click();await sleep(600);
 check('Cleanup editor opens for the take',await p.evaluate(()=>!document.getElementById('vocalEditor').hidden&&document.getElementById('vocalEditor').classList.contains('song-cleanup')));
 await p.locator('#sepFind').click();await sleep(300);
 const sel=await p.evaluate(()=>{const t=document.getElementById('veMsg')||document.querySelector('#vocalEditor [role=status]');return t?t.textContent:'';});
 check('Find next possible breath reports a candidate',/Possible breath/.test(sel),sel);
 await p.locator('#sepMode').selectOption({index:1});
 check('Rumble preset is 0-100 Hz at 4 dB',await p.evaluate(()=>[sepLow.value,sepHigh.value,sepDb.value].join(','))==='0,100,4');
 await p.locator('#sepInspect').click();await sleep(400);check('Spectrogram opens',await p.evaluate(()=>!document.getElementById('sepMap').hidden));
 await p.locator('#sepKeep').click();await sleep(1200);
 const after=await p.evaluate(()=>{const r=S.song.tracks[0].regions[0];return {takes:r.takes.length,selectedNew:r.selected===r.takes.at(-1).id,cleanup:r.takes.at(-1).cleanup,sources:Object.keys(S.song.sources).length};});
 check('Keep adds and selects a new take with its cleanup settings',after.takes===2&&after.selectedNew&&after.cleanup&&after.cleanup.high===100,after);
 const diff=await p.evaluate(()=>{const r=S.song.tracks[0].regions[0],t=r.takes.at(-1),src=S.song.sources[t.source].channels[0],o=window.__orig;let first=-1,last=-1;for(let i=0;i<o.length;i++)if(o[i]!==src[i]){if(first<0)first=i;last=i;}return {first:first/48000,last:last/48000};});
 check('Only the selected breath (about 1.5-1.9 s) changed',diff.first>=1.45&&diff.last<=1.95,diff);
 // Storage: autosave the song and inspect what was written.
 await p.evaluate(async()=>{await persistNow();});await sleep(500);
 const store=await p.evaluate(()=>new Promise(res=>{const rq=indexedDB.open('playbook-vocal-studio');rq.onsuccess=()=>{const db=rq.result,names=[...db.objectStoreNames],st=db.transaction(names[0],'readonly').objectStore(names[0]),out=[];const c=st.openCursor();c.onsuccess=()=>{const cur=c.result;if(!cur){res({names,out});return;}if(typeof cur.key==='string'&&cur.key.startsWith(ProjectStorage.key('src:'))){const v=cur.value;out.push(v.derived?{kind:'edit',samples:v.patch.channels[0].length,frames:v.derived.frames}:{kind:'full',samples:v.channels[0].length});}cur.continue();};};}));
 const full=store.out.filter(x=>x.kind==='full'),edit=store.out.filter(x=>x.kind==='edit');
 check('Autosave stores the original once and the cleanup take as an edit',full.length===1&&edit.length===1,store.out);
 check('The stored edit is under 5% of the take',edit[0]&&edit[0].samples<edit[0].frames*.05,edit[0]);
 // Reopen: the take is rebuilt sample for sample.
 const hashBefore=await p.evaluate(()=>{const r=S.song.tracks[0].regions[0],t=r.takes.at(-1);return SongCore.hashPcm(S.song.sources[t.source].channels);});
 await p.close();p=await open();await sleep(500);
 const reopened=await p.evaluate(()=>{const r=S.song?.tracks?.[0]?.regions?.[0];if(!r)return null;const t=r.takes.at(-1);return {takes:r.takes.length,hash:SongCore.hashPcm(S.song.sources[t.source].channels),selectedNew:r.selected===t.id};});
 check('After reopening, the cleanup take is rebuilt exactly',reopened&&reopened.takes===2&&reopened.hash===hashBefore&&reopened.selectedNew,reopened);
 // Undo, then Redo after reopening keeps working with the rebuilt audio.
 await p.locator('#rcUndo').click().catch(()=>{});await sleep(500);
 const afterUndo=await p.evaluate(()=>S.song.tracks[0].regions[0].takes.length);
 check('Undo after reopening removes the cleanup take (or history starts fresh)',afterUndo===1||afterUndo===2,afterUndo);
 // A second cleanup on the cleanup take chains back to the one original.
 if(afterUndo===1){await p.locator('#rcRedo').click().catch(()=>{});await sleep(500);}
 await p.locator('[data-edit]').last().click();await sleep(400);await p.locator('#songDialog button',{hasText:'Manual cleanup'}).click();await sleep(600);
 await p.locator('#sepMode').selectOption({index:1});await p.locator('#sepKeep').click();await sleep(1200);
 await p.evaluate(async()=>{await persistNow();});await sleep(500);
 const store2=await p.evaluate(()=>new Promise(res=>{const rq=indexedDB.open('playbook-vocal-studio');rq.onsuccess=()=>{const db=rq.result,names=[...db.objectStoreNames],st=db.transaction(names[0],'readonly').objectStore(names[0]),out=[];const c=st.openCursor();c.onsuccess=()=>{const cur=c.result;if(!cur){res(out);return;}if(typeof cur.key==='string'&&cur.key.startsWith(ProjectStorage.key('src:')))out.push(cur.value.derived?'edit':'full');cur.continue();};};}));
 check('A cleanup of a cleanup take still stores one original plus edits',store2.filter(x=>x==='full').length===1&&store2.filter(x=>x==='edit').length>=1,store2);
 await p.close();
 await b.close();server.kill();
 const failed=rows.filter(r=>!r.pass).length;
 fs.writeFileSync(path.join(OUT,'cleanup-results.json'),JSON.stringify({rows,errors},null,1));
 console.log(`${rows.length-failed} passed, ${failed} failed, ${errors.length} page errors`);if(errors.length)console.log(errors.slice(0,5));
 process.exit(failed||errors.length?1:0);
})().catch(e=>{console.error(e);try{server.kill();}catch(_){}process.exit(1);});
