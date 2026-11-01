/* 0.33.0 tuning additions: live pitch guide while recording, correction map and Next heavy correction, locked
 * hand-tuned notes, riddim chord detection and Fit doubtful notes, and the My Voice profile and preset. */
const {suite}=require('../tests-0.32.4/browser.cjs');
const L=require('../live-pitch.js'),CH=require('../chord-core.js');
const R=48000;
// Backing: C | F | Am | G, two seconds each, repeated. Vocal: notes with 5.5 Hz vibrato, small scoops, and two
// "doubtful" notes a quarter tone above E4 (one over C, one over F).
const prog=[[0,4,7],[5,9,0],[9,0,4],[7,11,2]],N=R*16;
const beat=new Float32Array(N);for(let i=0;i<N;i++){const t=i/R,c=prog[Math.floor(t/2)%4];let v=0;for(const pc of c){const f=261.63*Math.pow(2,pc/12);v+=.06*Math.sin(2*Math.PI*f*t)+.02*Math.sin(4*Math.PI*f*t);}v+=.1*Math.sin(2*Math.PI*65.41*Math.pow(2,c[0]/12)*t);beat[i]=v;}
// note list: [start, end, midi]
const notes=[[.4,1.6,64.5],[2.4,3.6,64.5],[4.3,5.8,69],[6.2,7.7,67],[8.3,9.8,60],[10.2,11.7,65],[12.2,13.8,69],[14.1,15.6,67]];
const vocal=new Float32Array(N);{let ph=0;for(let i=0;i<N;i++){const t=i/R,n=notes.find(x=>t>=x[0]&&t<x[1]);if(!n)continue;const u=t-n[0],len=n[1]-n[0],scoop=u<.08?-.4*(1-u/.08):0,vib=len>1?.3*Math.sin(2*Math.PI*5.5*u)*Math.min(1,u/.3):0,f=440*Math.pow(2,(n[2]+scoop+vib-69)/12);ph+=2*Math.PI*f/R;const e=Math.min(1,u/.02,(len-u)/.02);vocal[i]=e*(.28*Math.sin(ph)+.09*Math.sin(2*ph)+.04*Math.sin(3*ph));}}
function wav(x,name){const buf=Buffer.alloc(44+x.length*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(R,24);buf.writeUInt32LE(R*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(x.length*2,40);for(let i=0;i<x.length;i++)buf.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(x[i]*32767))),44+2*i);return {name,mimeType:'audio/wav',buffer:buf};}

suite('tuning-plus',15,async({page,check})=>{
 /* ---------- maths ---------- */
 {let worst=0;for(const f of [82.4,110,196,261.63,440,880]){const b=new Float32Array(4096);for(let i=0;i<b.length;i++)b[i]=.3*Math.sin(2*Math.PI*f*i/R)+.1*Math.sin(4*Math.PI*f*i/R);worst=Math.max(worst,Math.abs(1200*Math.log2(L.yin(b,R)/f)));}
  check('Live pitch: detects sung pitches from 82 to 880 Hz within 1 cent',worst<1,worst);
  check('Live pitch: silence shows no pitch',L.yin(new Float32Array(4096),R)===0);
  const nn=L.nearest(70.4,0,[0,2,4,5,7,9,11]);check('Live pitch: measures against the nearest key note',nn.midi===71&&Math.round(nn.cents)===-60);
  const ch=CH.detect(beat,R),names=[...new Set(ch.filter(c=>c.root>=0).map(c=>c.name))];
  check('Chords: reads C, F, Am and G from the backing',['C','F','Am','G'].every(n=>names.includes(n))&&names.length===4,names);
  check('Chords: changes land within 0.2 s of the real changes',[2,4,6,8].every(t=>ch.some(c=>Math.abs(c.t0-t)<.2)));}

 /* ---------- browser: song vocal with the backing, note editor ---------- */
 const p=await page(1280,900);p.on('dialog',d=>d.accept());
 await p.evaluate(a=>{const C=SongCore,x=Float32Array.from(a);S.song=C.empty(48000);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:16,channels:[x],origin:0,choose:true}),'tuning plus');},Array.from(vocal));
 await p.waitForTimeout(300);
 const chooser=p.waitForEvent('filechooser');await p.locator('#sgLoadBeat').click();await(await chooser).setFiles(wav(beat,'riddim.wav'));await p.waitForFunction(()=>!!S.beat,null,{timeout:30000});
 await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});
 await p.locator('[data-tab=tune]').click();await p.locator('[data-dock=notes]').click();
 const idle=()=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});
 await p.locator('#noteEditorFrame').waitFor({state:'attached',timeout:60000});const f=await(await p.locator('#noteEditorFrame').elementHandle()).contentFrame();
 await f.waitForFunction(()=>window.PlaybookNoteEditor&&PlaybookNoteEditor.analysis().notes.length>=6,null,{timeout:120000});await idle();
 await f.evaluate(()=>PlaybookNoteEditor.key(0,'major'));await idle();
 for(const id of ['lockMan','myVoiceLearn','presetMyVoice','chordShow','chordFit','corrMap','corrNext'])check('Tuning panel shows '+id,await f.locator('#'+id).count()===1);
 // Correction map.
 await f.locator('#neTab-check').click(); // 0.34.0: chords and the correction map are on the Check tab
 await f.locator('#corrMap').click();check('Correction map turns on',await f.locator('#corrMap').getAttribute('aria-pressed')==='true');
 const corr=await f.evaluate(()=>PlaybookNoteEditor.analysis().notes.map((n,i)=>PlaybookTuningPlus.corrOf(i)));
 check('Each note has a measured correction in cents',corr.length>=6&&corr.every(Number.isFinite),corr);
 await f.locator('#corrNext').click();check('Next heavy correction explains what it found',/Heavy correction|No heavy corrections/.test(await f.locator('#chordInfo').textContent()));
 // Chords from the riddim.
 await f.locator('#chordShow').click();await f.waitForTimeout(200);
 const info=await f.locator('#chordInfo').textContent();check('Show riddim chords lists the chords from the backing',/C/.test(info)&&/F/.test(info)&&/Am/.test(info)&&/G/.test(info),info);
 // Fit doubtful notes: the quarter-tone notes go to E over C and to F over F.
 const before=await f.evaluate(()=>PlaybookNoteEditor.analysis().notes.slice(0,2).map(n=>n.target));
 await f.locator('#chordFit').click();await idle();
 const fit=await f.evaluate(()=>PlaybookNoteEditor.analysis().notes.slice(0,2).map(n=>+n.target.toFixed(2)));
 check('Fit doubtful notes: a note between E and F goes to E over a C chord and to F over an F chord',Math.abs(fit[0]-64)<.05&&Math.abs(fit[1]-65)<.05,{before,fit});
 check('Fitted notes count as hand edits',await f.evaluate(()=>PlaybookNoteEditor.state().settings.notes.slice(0,2).every(n=>n[11]===1)));
 // Locked hand-tuned notes survive a preset; unlocking lets the preset reset them.
 await f.locator('#neTab-tune').click(); // 0.34.0: presets are on the Tune tab
 await f.locator('#presetRoots').click();await idle();
 const kept=await f.evaluate(()=>PlaybookNoteEditor.analysis().notes.slice(0,2).map(n=>+n.target.toFixed(2)));
 check('Natural Roots keeps the hand-tuned notes when the lock is on',Math.abs(kept[0]-64)<.05&&Math.abs(kept[1]-65)<.05,kept);
 await f.locator('#lockMan').uncheck();await f.locator('#presetRoots').click();await idle();
 check('With the lock off, the preset resets every note',await f.evaluate(()=>PlaybookNoteEditor.state().settings.notes.every(n=>!n[11])));
 await f.locator('#lockMan').check();
 // My voice.
 await f.locator('#myVoiceLearn').click();await f.waitForTimeout(200);
 const mv=await f.locator('#myVoiceInfo').textContent();
 check('Learn from this vocal measures vibrato near 5.5 Hz',/Learned from 1 vocal/.test(mv)&&/vibrato (5\.[0-9]|6\.0) Hz/.test(mv),mv);
 const meas=await f.evaluate(()=>PlaybookTuningPlus.measureVoice());check('Scoops are measured as starting below the note',meas.scoopCents<0,meas);
 check('My Voice preset is available after learning',!(await f.locator('#presetMyVoice').isDisabled()));
 await f.locator('#presetMyVoice').click();await idle();
 const st=await f.evaluate(()=>PlaybookNoteEditor.state().settings);check('My Voice preset tunes in Natural mode with the learned settings',st.autoMode==='natural'&&st.autoSpeed>=30&&st.autoSpeed<=90&&st.autoVib===1,{mode:st.autoMode,speed:st.autoSpeed,vib:st.autoVib});
 check('The voice profile is kept on this device only (not in the project)',await f.evaluate(()=>!!localStorage.getItem('pne.myVoice.v1'))&&!(await p.evaluate(()=>JSON.stringify(S.song.tracks[0].polish?.session?.noteTuner||{}).includes('vibRate'))));
 // Approved presets are untouched when nothing is hand-tuned (the lock only matters for hand edits).
 await f.evaluate(()=>{const s=PlaybookNoteEditor.state().settings;return s.notes.length;});
 await p.context().close();

 /* ---------- live pitch guide while recording (simulated microphone) ---------- */
 const q=await page(1280,900);
 check('Pitch guide is on by default and can be switched off',await q.locator('#sgPitchOn').isChecked());
 await q.locator('#sgRecord').click();await q.waitForFunction(()=>!document.getElementById('sgPitch').hidden,null,{timeout:20000});
 await q.waitForTimeout(1500);
 const txt=await q.locator('#sgPitchText').textContent();check('While recording, the guide shows a note or asks you to sing',/^[A-G][♯♭]?\d|Sing to see your pitch/.test(txt),txt);
 check('The guide reads a copy of the mic and records normally',await q.evaluate(()=>LivePitch.active()));
 await q.locator('#sgRecord').click();await q.waitForFunction(()=>document.getElementById('sgPitch').hidden,null,{timeout:20000});
 check('The guide hides when recording stops',!(await q.evaluate(()=>LivePitch.active())));
 await q.locator('#sgPitchOn').uncheck();await q.locator('#sgRecord').click();await q.waitForTimeout(1200);
 check('With the guide off, recording shows no pitch display',await q.evaluate(()=>document.getElementById('sgPitch').hidden&&!LivePitch.active()));
 await q.locator('#sgRecord').click();await q.waitForTimeout(800);
 await q.context().close();
 const m=await page(390,844);await m.locator('#sgPitchOn').scrollIntoViewIfNeeded().catch(()=>{});
 check('390×844: the Song & vocals page still fits with the new controls',await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await m.context().close();
});
