/* 0.33.1 regressions for three reported problems:
 *  1. Pauses only must never clean a held note, even one that fades far below the loudest singing.
 *  2. "Undo these" (Find all breaths) must remove exactly that batch, even after later edits of another kind.
 *  3. Undo/Redo of a timeline move must bring the track's hand-tuned notes back with the audio. */
const {suite}=require('../tests-0.32.4/browser.cjs');
const P=require('../cleaning-plus.js');
const R=48000;
suite('regressions-0.33.1',16,async({page,check})=>{
 /* ---------- 1. held notes ---------- */
 {let seed=5;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);const N=R*10,x=new Float32Array(N);
  for(let i=0;i<N;i++){const t=i/R;let v=.001*rnd();if(t>.5&&t<2)v+=.35*Math.sin(2*Math.PI*220*t);if(t>3&&t<8)v+=.3*Math.pow(10,-(t-3)*45/5/20)*Math.sin(2*Math.PI*196*t);x[i]=v;}
  const g=P.pauseGain([x],R);let held=0,pause=1;for(let i=Math.round(3.02*R);i<Math.round(7.98*R);i+=48)held=Math.max(held,g.at(i));for(let i=Math.round(8.4*R);i<Math.round(9.6*R);i+=48)pause=Math.min(pause,g.at(i));
  check('Pauses only: a held note fading 45 dB is never cleaned',held===0,held);
  check('Pauses only: the real pause after it is still cleaned',pause>.99,pause);
  // a breathy, quiet sung line (12 dB above the room, far below the loud phrase) is singing too
  const y=Float32Array.from(x);for(let i=Math.round(8.4*R);i<Math.round(9.4*R);i++)y[i]+=.004*Math.sin(2*Math.PI*247*i/R);
  const g2=P.pauseGain([y],R);let q=0;for(let i=Math.round(8.45*R);i<Math.round(9.35*R);i+=48)q=Math.max(q,g2.at(i));
  check('Pauses only: quiet pitched singing is protected',q===0,q);
  // noise alone (no pitch) at the same level is still treated as a pause
  const z=Float32Array.from(x);for(let i=Math.round(8.4*R);i<Math.round(9.4*R);i++)z[i]+=.006*rnd();
  const g3=P.pauseGain([z],R);let nz=1;for(let i=Math.round(8.5*R);i<Math.round(9.3*R);i+=48)nz=Math.min(nz,g3.at(i));
  check('Pauses only: unpitched noise at that level is still cleaned',nz>.99,nz);}

 /* ---------- 2 and 3 in the browser ---------- */
 const p=await page(1280,900);p.on('dialog',d=>d.accept());
 const N=R*12,v=new Float32Array(N);{let seed=3,ph=0;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);
  for(let i=0;i<N;i++){const t=i/R,k=Math.floor(t/3),u=t-k*3;if(u>.7&&u<2.6){ph+=2*Math.PI*(196+30*k)/R;v[i]=(.25*Math.sin(ph)+.08*Math.sin(2*ph))*Math.min(1,(u-.7)/.03,(2.6-u)/.03);}else if(u>.25&&u<.55)v[i]=.05*rnd()*Math.sin(Math.PI*(u-.25)/.3);v[i]+=.0005*rnd();}}
 await p.evaluate(a=>{const C=SongCore,x=Float32Array.from(a);S.song=C.empty(48000);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:1,end:13,channels:[x],origin:1,choose:true}),'regressions');},Array.from(v));
 await p.waitForTimeout(300);
 await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});
 const idle=()=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});await idle();
 // 2. breath batch, then a later timing edit, then Undo these.
 await p.locator('[data-dock="wave"]').click();await p.waitForTimeout(300);
 await p.locator('#breathFindAll').click();await p.waitForTimeout(300);const rows=await p.locator('#breathList [data-breath]').count();
 await p.locator('#breathReduceAll').click();await idle();
 const b1=await p.evaluate(()=>S.st.edits.breaths.length);check('The breath batch was applied',b1===rows&&rows>=3,{b1,rows});
 await p.evaluate(async()=>{const r=await engine({type:'run',steps:[['edit',1,-1,5.0,5.6,.02,1]],update:true});absorb(r);persist();});await idle();
 const t1=await p.evaluate(()=>S.st.edits.timing.length);check('A later timing edit exists',t1===1);
 await p.locator('#breathUndoAll').click();await idle();await p.waitForTimeout(300);
 const after=await p.evaluate(()=>({b:S.st.edits.breaths.length,t:S.st.edits.timing.length}));
 check('Undo these removes every breath of the batch',after.b===0,after);
 check('Undo these keeps the later timing edit',after.t===1,after);
 // A breath reduced by hand after the batch is kept too.
 await p.locator('#breathFindAll').click();await p.waitForTimeout(300);await p.locator('#breathReduceAll').click();await idle();
 await p.evaluate(async()=>{const r=await engine({type:'run',steps:[['edit',0,-1,11.0,11.2,9]],update:true});absorb(r);persist();});await idle();
 await p.locator('#breathUndoAll').click();await idle();await p.waitForTimeout(300);
 const kept=await p.evaluate(()=>S.st.edits.breaths.map(b=>[+b[0].toFixed(2),+b[1].toFixed(2)]));
 check('Undo these keeps a breath edit made by hand afterwards',kept.length===1&&kept[0][0]===11&&kept[0][1]===11.2,kept);

 // 3. Hand-tuned notes, move the whole track, Undo, Redo.
 await p.locator('[data-dock="notes"]').click();await p.locator('[data-tab=tune]').click();
 await p.locator('#noteEditorFrame').waitFor({state:'attached',timeout:60000});let f=await(await p.locator('#noteEditorFrame').elementHandle()).contentFrame();
 await f.waitForFunction(()=>window.PlaybookNoteEditor&&PlaybookNoteEditor.analysis().notes.length>=3,null,{timeout:120000});await idle();
 await f.locator('#selAll').click();await f.locator('#nUp').click();await idle();await p.waitForTimeout(600);
 const manNotes=fr=>fr.evaluate(()=>PlaybookNoteEditor.state().settings.notes.filter(n=>n[11]).map(n=>[n[0],+n[3].toFixed(4)]));
 const orig=await manNotes(f);check('Hand-tuned notes exist before the move',orig.length>=3);
 const back=async()=>{await p.locator('#rcStep1').click();await p.waitForFunction(()=>RC.step==='rc');await p.waitForTimeout(300);};
 const toPolish=async()=>{await p.locator('#rcStep2').click();await p.waitForTimeout(600);const asked=await p.locator('#songDialog[open]').count();if(asked)await p.locator('#songDialog [data-action="ok"]').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});await idle();f=await(await p.locator('#noteEditorFrame').elementHandle()).contentFrame();await f.waitForFunction(()=>window.PlaybookNoteEditor&&PlaybookNoteEditor.analysis().notes.length>=3,null,{timeout:120000});return asked;};
 await back();
 await p.evaluate(()=>SongStudio.commitMove(S.song.tracks[0].id,S.song.tracks[0].regions.map(r=>r.id),1,true));await p.waitForTimeout(400);
 // open POLISH at the new place and add one more hand edit there, so Undo must carry both
 let asked=await toPolish();check('After the move, POLISH opens without a reset prompt',!asked);
 const moved=await manNotes(f);check('After the move, the hand-tuned notes sit one second later',moved.length===orig.length&&moved.every((n,k)=>Math.abs(n[0]-orig[k][0]-100)<=1&&n[1]===orig[k][1]),{orig:orig.slice(0,2),moved:moved.slice(0,2)});
 await back();await p.keyboard.press('Control+z');await p.waitForTimeout(500);
 check('Undo puts the part back',await p.evaluate(()=>Math.abs(S.song.tracks[0].regions[0].start-1)<1e-9));
 asked=await toPolish();check('After Undo, POLISH opens without a reset prompt',!asked);
 const undone=await manNotes(f);check('After Undo, the hand-tuned notes are back at their original place',undone.length===orig.length&&undone.every((n,k)=>Math.abs(n[0]-orig[k][0])<=1&&n[1]===orig[k][1]),{orig:orig.slice(0,2),undone:undone.slice(0,2)});
 check('After Undo, POLISH is up to date',await p.evaluate(()=>SongCore.polishValid(S.song,S.song.tracks[0])));
 await back();await p.keyboard.press('Control+y');await p.waitForTimeout(500);
 asked=await toPolish();check('After Redo, POLISH opens without a reset prompt',!asked);
 const redone=await manNotes(f);check('After Redo, the hand-tuned notes follow the part again',redone.length===orig.length&&redone.every((n,k)=>Math.abs(n[0]-orig[k][0]-100)<=1&&n[1]===orig[k][1]),{redone:redone.slice(0,2)});
 // A burst of keyboard nudges undoes in one step and the notes come back exactly.
 await back();await p.keyboard.press('Control+z');await p.waitForTimeout(400);await toPolish();await back();
 await p.locator('#sgMove').check();const lane='#songStudio canvas.sg-wave[data-wave]:not([data-wave="ruler"]):not([data-wave="beat"])';
 await p.locator(lane).first().scrollIntoViewIfNeeded();await p.waitForTimeout(500);const bb=await p.locator(lane).first().boundingBox(),vw=await p.evaluate(()=>SongStudio.view());
 await p.mouse.click(bb.x+(5-vw.start)/vw.span*bb.width,bb.y+bb.height/2);await p.waitForTimeout(200);
 for(let i=0;i<5;i++){await p.keyboard.press('ArrowRight');await p.waitForTimeout(150);}
 check('Five nudges moved the part 50 ms',await p.evaluate(()=>Math.abs(S.song.tracks[0].regions[0].start-1.05)<1e-6));
 await p.keyboard.press('Control+z');await p.waitForTimeout(500);
 asked=await toPolish();const burst=await manNotes(f);
 check('One Undo after a burst of nudges restores the notes exactly',!asked&&burst.length===orig.length&&burst.every((n,k)=>Math.abs(n[0]-orig[k][0])<=1&&n[1]===orig[k][1]),{asked,burst:burst.slice(0,2)});
 await p.context().close();
});
