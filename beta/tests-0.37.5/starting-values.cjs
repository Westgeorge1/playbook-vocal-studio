/* 0.37.5: Roots Reggae starting values (word leveling 25 %, compression 45 %) on every path that applies the preset
 * from its starting settings, saved projects left alone, and the Clean vocal notes that state the real order. */
const fs=require('node:fs'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {suite}=require('../tests-0.32.4/browser.cjs');
const near=(a,b)=>Math.abs(a-b)<1e-4;
async function idle(p){await p.waitForFunction(()=>!S.busy&&!S.loading&&!S.dirty&&!S.queued&&!NoteTuner.locked()&&!NoiseCleaner.locked());}
const read=p=>p.evaluate(()=>({ride:S.P.chLevelRide,comp:S.P.chCompress,preset:Math.round(S.P.chainPreset),knobRide:document.querySelector('#dynKnobs')?.textContent||''}));
async function sing(p){
 await p.evaluate(()=>{const R=48000,n=R*4,x=new Float32Array(n);let ph=0;
  for(let i=0;i<n;i++){const t=i/R,k=Math.floor(t/2),u=t-k*2,f=[220,247][k]*(1+.005*Math.sin(2*Math.PI*5.5*t));ph+=2*Math.PI*f/R;
   const e=u<.25?0:u<.3?(u-.25)/.05:u<1.7?1:u<1.8?(1.8-u)/.1:0;let s=0;for(let h=1;h<=10;h++)s+=Math.sin(h*ph)/h;x[i]=(k?.06:.2)*e*s+.002*Math.sin(i*12.9898)*Math.cos(i*78.233);}
  return openVocal(x,R,'starting-values',false);});
 await idle(p);
}
suite('starting-values',63,async({page,check})=>{
 const p=await page(1280,900);
 await sing(p);
 let s=await read(p);
 check('A new vocal starts on Roots Reggae with word leveling 25 % and compression 45 %',s.preset===0&&near(s.ride,.25)&&near(s.comp,.45));
 const chain=await p.evaluate(()=>({ride:S.st.chain.ride,comp:S.st.chain.compAvg,final:!!S.final}));
 check('The rendered FINAL used those values (word leveling is active)',chain.final&&chain.ride>0);
 await p.evaluate(()=>document.querySelector('#presetSeg button[data-preset="1"]').click());await idle(p);
 const pop=await read(p);
 check('Another preset keeps its own engine values',pop.preset===1);
 await p.evaluate(()=>document.querySelector('#presetSeg button[data-preset="0"]').click());await idle(p);
 s=await read(p);
 check('Choosing Roots Reggae again gives 25 % and 45 %',s.preset===0&&near(s.ride,.25)&&near(s.comp,.45));
 await p.evaluate(()=>{setP('chCompress',.7);setP('chLevelRide',.6);});await idle(p);
 s=await read(p);
 check('Manual changes are kept as set',near(s.ride,.6)&&near(s.comp,.7));
 await p.evaluate(()=>document.getElementById('resetPreset').click());await idle(p);
 s=await read(p);
 check('Reset preset returns Roots Reggae to 25 % and 45 %',near(s.ride,.25)&&near(s.comp,.45));
 await p.evaluate(()=>{document.getElementById('resetSettings').click();document.getElementById('resetYes').click();});await idle(p);
 s=await read(p);
 check('Reset all settings returns to 25 % and 45 %',s.preset===0&&near(s.ride,.25)&&near(s.comp,.45));
 await p.evaluate(()=>change([['undo']],0));await idle(p);
 /* Clean vocal notes */
 const notes=await p.evaluate(()=>({clicks:document.querySelector('[data-note="clicks"]')?.textContent||'',gaps:document.querySelector('[data-note="gaps"]')?.textContent||'',version:APP_VERSION,title:document.title}));
 check('Step 3 says it runs first',/Runs first/.test(notes.clicks));
 check('Step 7 says de-reverb runs before the noise remover and gap cleaning runs last',/De-reverb runs early/.test(notes.gaps)&&/Gap cleaning runs last/.test(notes.gaps)&&/Find breaths/.test(notes.gaps));
 check('Version is 0.37.5',notes.version==='0.37.5'&&notes.title.includes('0.37.5'));
 /* A project saved by 0.37.2 keeps the values it was saved with. */
 const q=await page(1280,900),bytes=gunzipSync(fs.readFileSync(path.join(__dirname,'../tests-0.37.4/fixtures/step7-off-0.37.2.zip.gz')));
 await q.locator('#fileProject').setInputFiles({name:'saved-project.zip',mimeType:'application/zip',buffer:bytes});
 await q.waitForFunction(()=>!sessionLocked()&&!S.loading&&SongCore.usage(S.song).takes===1);
 const saved=await q.evaluate(()=>{const t=S.song.tracks.find(t=>t.polish?.session?.P);return t?{ride:t.polish.session.P.chLevelRide,comp:t.polish.session.P.chCompress}:null;});
 await q.locator('#rcStep2').click();
 await q.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding);await idle(q);
 const open=await read(q);
 check('A saved project opens with the leveling and compression it was saved with',!!saved&&near(open.ride,saved.ride)&&near(open.comp,saved.comp));
 console.log('saved project values',saved,'opened',open.ride,open.comp);
});
