/* Visible removal actions, durable deletion and Undo; synthetic audio only.
 * PLAYWRIGHT_MODULE, PVS_CHROME and PVS_TEST_OUT work as in recording.cjs.
 */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=process.env.PVS_TEST_OUT;
const rows=[],errors=[];let browser,server;
function check(name,pass){rows.push({name,pass:!!pass});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);}
const idle=p=>p.waitForFunction(()=>window.SongStudio&&!S.loading&&!sessionLocked(),null,{timeout:180000});
async function page(width){
 const ctx=await browser.newContext({viewport:{width,height:width===390?844:1760},isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async()=>{const a=new AudioContext(),o=a.createOscillator(),g=a.createGain(),d=a.createMediaStreamDestination();g.gain.value=.12;o.connect(g).connect(d);o.start();await a.resume();return d.stream;};
 });
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.route('https://**/*',r=>r.abort());await p.goto('http://127.0.0.1:8761/beta/');await idle(p);return {ctx,p};
}
async function seed(p){return p.evaluate(async()=>{
 const C=SongCore,w=C.empty(48000),x=Float32Array.from({length:96000},(_,i)=>.12*Math.sin(i/29));w.lead=0;
 const lead=w.activeTrack,a=C.addTake(w,{channels:[x],start:0,end:2,choose:true,name:'Lead original'});
 const b=C.addTake(w,{regionId:a.region.id,channels:[Float32Array.from(x,v=>v*.5)],start:0,end:2,name:'Alternate'});a.region.reference=a.take.id;
 const harmony=C.addTrack(w,'Harmony');const h=C.addTake(w,{trackId:harmony.id,channels:[x],start:0,end:2,choose:true,name:'Shared audio'});h.take.source=a.take.source;C.gc(w);
 C.addSection(w,'Verse',0,2);w.activeTrack=lead;w.selectedRegion=a.region.id;S.song=w;
 const beat=audioCtx().createBuffer(1,48000,48000);beat.copyToChannel(Float32Array.from({length:48000},(_,i)=>.02*Math.sin(i/17)),0);S.beat=beat;S.beatName='Instrumental';S.beatLevel=.42;
 SongStudio.render();await persistNow();return {lead,harmony:harmony.id,region:a.region.id,a:a.take.id,b:b.take.id,source:a.take.source};
 });}
const tap=(p,selector)=>p.locator(selector).tap();
async function confirm(p,action='ok'){await p.waitForSelector('#songDialog[open]');await tap(p,'#songDialog [data-action="'+action+'"]');}
const count=p=>p.evaluate(()=>SongCore.usage(S.song).takes);
const undo=async p=>{await tap(p,'#rcUndo');};
const redo=async p=>{await tap(p,'#rcRedo');};
async function record(p){await p.evaluate(()=>{S.song.lead=0;SongStudio.render();});await tap(p,'#sgRecord');await p.waitForFunction(()=>SongStudio.state().recording);await p.waitForTimeout(550);await tap(p,'#sgStop');await p.waitForFunction(()=>!SongStudio.locked());}
(async()=>{
 server=spawn('python3',['-m','http.server','8761','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});await new Promise(r=>setTimeout(r,600));
 browser=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of (process.env.PVS_WIDTH?[+process.env.PVS_WIDTH]:[390,980])){
  const {ctx,p}=await page(width),f=await seed(p),tag=width+'px';
  check(tag+' track controls fit a compact touch lane',await p.evaluate(()=>[...document.querySelectorAll('.sg-lane:has([data-delete-track])')].every(e=>e.getBoundingClientRect().height<=380)));
  check(tag+' delete buttons are visible without a menu',await p.locator('[data-delete-take="'+f.a+'"]').isVisible()&&await p.locator('[data-delete-track="'+f.lead+'"]').isVisible()&&await p.locator('[data-clear-track="'+f.lead+'"]').isVisible());
  await tap(p,'[data-delete-take="'+f.b+'"]');await confirm(p,'cancel');check(tag+' Cancel keeps all recordings',await count(p)===3);
  await tap(p,'[data-delete-take="'+f.b+'"]');await confirm(p);check(tag+' deletes only the selected unchosen attempt',await p.evaluate(f=>SongCore.usage(S.song).takes===2&&S.song.tracks[0].regions[0].selected===f.a&&S.song.tracks[1].regions.length===1,f));
  await undo(p);check(tag+' Undo restores the attempt and source samples',await p.evaluate(f=>SongCore.usage(S.song).takes===3&&S.song.sources[SongCore.region(S.song).takes.find(a=>a.id===f.b).source].channels[0][100]!==0,f));
  await redo(p);check(tag+' Redo removes the attempt again',await count(p)===2);await undo(p);
  await tap(p,'[data-delete-take="'+f.a+'"]');
  check(tag+' chosen/reference deletion is explained',/chosen recording/.test(await p.locator('#songDialog').innerText())&&/reference/.test(await p.locator('#songDialog').innerText()));
  await confirm(p);check(tag+' chosen/reference pointers clear without selecting another take',await p.evaluate(()=>{const r=SongCore.region(S.song);return r.takes.length===1&&!r.selected&&!r.reference;}));
  check(tag+' shared source remains on the other track',await p.evaluate(f=>!!S.song.sources[f.source]&&S.song.tracks[1].regions[0].takes[0].source===f.source,f));
  await undo(p);await tap(p,'[data-clear-track="'+f.lead+'"]');await confirm(p,'cancel');check(tag+' cancelled clear keeps the track recordings',await count(p)===3);
  await tap(p,'[data-clear-track="'+f.lead+'"]');await confirm(p);check(tag+' Clear recordings retains empty track, backing, sections and other track',await p.evaluate(f=>S.song.tracks.length===2&&SongCore.track(S.song,f.lead).regions.length===0&&SongCore.track(S.song,f.harmony).regions.length===1&&S.beatName==='Instrumental'&&S.beatLevel===.42&&S.song.sections[0].name==='Verse',f));
  await undo(p);check(tag+' Undo clear restores every attempt',await count(p)===3);await redo(p);check(tag+' Redo clear leaves the track empty',await count(p)===1);await undo(p);
  await tap(p,'[data-delete-track="'+f.harmony+'"]');await confirm(p);check(tag+' deletes a whole track and preserves the other track',await p.evaluate(f=>S.song.tracks.length===1&&S.song.tracks[0].id===f.lead&&SongCore.usage(S.song).takes===2,f));
  await undo(p);check(tag+' Undo track deletion restores its recording',await p.evaluate(f=>!!SongCore.track(S.song,f.harmony)&&SongCore.usage(S.song).takes===3,f));
  await redo(p);
  await tap(p,'[data-delete-track="'+f.lead+'"]');check(tag+' last-track deletion explains the empty replacement',/new empty vocal track/.test(await p.locator('#songDialog').innerText()));await confirm(p);
  check(tag+' deleting last track leaves a new ready-to-record lane',await p.evaluate(f=>S.song.tracks.length===1&&S.song.tracks[0].id!==f.lead&&S.song.tracks[0].name==='Lead vocal'&&!Object.keys(S.song.sources).length&&S.beat&&S.song.sections.length===1&&!sessionLocked(),f));
  await undo(p);check(tag+' Undo restores deleted last track with both takes',await count(p)===2);await redo(p);
  await p.evaluate(async()=>persistNow());await p.reload();await idle(p);check(tag+' deleted tracks stay deleted after reload',await p.evaluate(()=>S.song.tracks.length===1&&!S.song.tracks[0].regions.length&&!Object.keys(S.song.sources).length&&S.beatName==='Instrumental'&&S.song.sections.length===1));
  await record(p);check(tag+' new recording works after deleting the last track',await count(p)===1);
  await p.evaluate(()=>{S.busy=true;SongStudio.render();});check(tag+' deletion disabled while processing',await p.locator('[data-delete-track]').isDisabled()&&await p.locator('[data-clear-track]').isDisabled()&&await p.locator('[data-delete-take]').isDisabled());await p.evaluate(()=>{S.busy=false;SongStudio.render();});
  if(out){fs.mkdirSync(out,{recursive:true});await tap(p,'#sgJumpVocal');await p.screenshot({path:path.join(out,'delete-controls-'+width+'.png')});await p.locator('[data-delete-take]').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'delete-recording-'+width+'.png')});}
  await ctx.close();
 }
 // POLISH's live editor formerly could resurrect the last deleted recording.
 for(const action of ['take','clear','track']){
  const {ctx,p}=await page(390),f=await seed(p);
  await p.evaluate(async f=>{SongStudio.edit(w=>{w.tracks=w.tracks.filter(t=>t.id===f.lead);const r=w.tracks[0].regions[0];r.takes=r.takes.filter(a=>a.id===f.a);});await SongPolish.open(f.lead);RC.go('rc');},f);await idle(p);
  check(action+' fixture has a real POLISH editor',await p.evaluate(()=>!!S.main&&!!S.song.tracks[0].polish));
  const original=await p.evaluate(async()=>{await persistNow();window.beforeDelete=await restore();return SongCore.hashPcm(S.song.tracks[0].polish.channels);});
  await tap(p,action==='take'?'[data-delete-take]':action==='clear'?'[data-clear-track]':'[data-delete-track]');await confirm(p);
  check(action+' deletion releases cached editor without waiting for DSP',await p.evaluate(()=>!S.main&&!S.st&&!SongPolish.state().binding&&!sessionLocked()));
  check(action+' snapshot excludes deleted editor audio',await p.evaluate(()=>!sessionSnapshot().pcm&&!S.song.tracks.some(t=>t.polish)));
  await p.evaluate(async()=>persistNow());
  await undo(p);check(action+' Undo restores exact POLISH output and recordings',await p.evaluate(h=>SongCore.hashPcm(S.song.tracks[0].polish.channels)===h&&SongCore.usage(S.song).takes===1,original));
  await redo(p);check(action+' Redo does not resurrect POLISH on an empty lane',await p.evaluate(()=>!S.song.tracks.some(t=>t.polish)&&!S.main));
  if(action==='clear')await p.evaluate(async()=>{cancelPersist();sessionSnapshot=()=>beforeDelete;await writeRemembered(beforeDelete);});else await p.evaluate(async()=>persistNow());
  await p.reload();await idle(p);check(action+(action==='clear'?' journal recovery':' reload')+' does not recover the deleted recording',await p.evaluate(()=>!Object.keys(S.song.sources).length&&S.song.tracks.every(t=>!t.regions.length&&!t.polish)&&!S.main));
  await ctx.close();
 }
 check('No page errors',errors.length===0);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill();if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'delete-results.json'),JSON.stringify({rows,errors},null,2));}console.log(rows.filter(r=>r.pass).length+' checks passed');});
