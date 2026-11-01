/* 0.33.0 Move parts: drag a recording along the Song & vocals timeline, Shift+drag the whole track, snap, Esc,
 * overlap prompt, keyboard nudges merged into one Undo, Move… dialog, track menu, sample-exact render at the new
 * time, autosave/reopen, compact cleanup takes, and POLISH note edits that move with the audio. */
const {suite}=require('../tests-0.32.4/browser.cjs');
suite('timeline-move',13,async({page,check})=>{
 const p=await page(1280,900);
 const sleep=t=>p.waitForTimeout(t);
 // Two 2-second tones on one track: part A at 1-3 s (220 Hz), part B at 6-8 s (330 Hz). Part A has two attempts.
 await p.evaluate(()=>{const C=SongCore,R=48000,tone=(f,n)=>{const a=new Float32Array(R*n);for(let i=0;i<a.length;i++)a[i]=.25*Math.sin(2*Math.PI*f*i/R)*Math.min(1,i/480,(a.length-i)/480);return a;};
  S.song=C.empty(R);SongStudio.edit(w=>{const id=w.tracks[0].id;C.addTake(w,{trackId:id,start:1,end:3,channels:[tone(220,2)],origin:1,choose:true});const r=w.tracks[0].regions[0];C.addTake(w,{trackId:id,regionId:r.id,start:1,end:3,channels:[tone(247,2)],origin:1});C.addTake(w,{trackId:id,start:6,end:8,channels:[tone(330,2)],origin:6,choose:true});},'move test');});
 await sleep(700);
 const lane='#songStudio canvas.sg-wave[data-wave]:not([data-wave="ruler"]):not([data-wave="beat"])';
 await p.locator(lane).first().scrollIntoViewIfNeeded();await sleep(600);
 const regs=()=>p.evaluate(()=>S.song.tracks[0].regions.map(r=>({id:r.id,start:r.start,end:r.end,origins:r.takes.map(a=>a.origin),selected:r.selected})));
 const geo=async()=>{const b=await p.locator(lane).first().boundingBox(),v=await p.evaluate(()=>SongStudio.view());return {b,v,X:t=>b.x+(t-v.start)/v.span*b.width,px:v.span/b.width};};
 const near=(a,b,t)=>Math.abs(a-b)<=t;
 check('Move parts switch and Move… button are in the timeline tools',await p.locator('#sgMove').isVisible()&&await p.locator('#sgMovePart').isVisible());
 const r0=await regs();
 // Plain drag (Move parts off) still selects, never moves.
 let g=await geo();await p.mouse.move(g.X(1.5),g.b.y+g.b.height/2);await p.mouse.down();await p.mouse.move(g.X(2.5),g.b.y+g.b.height/2,{steps:5});await p.mouse.up();await sleep(200);
 check('With Move parts off, dragging selects and does not move',JSON.stringify(await regs())===JSON.stringify(r0)&&await p.evaluate(()=>!!S.song.range));
 await p.locator('#sgMove').check();check('Move parts turns Drag to scroll off',!(await p.locator('#sgHand').isChecked()));
 // Drag part A right by 120 px.
 g=await geo();const y=g.b.y+g.b.height/2;let undo0=await p.evaluate(()=>SongStudio.undoCount());
 await p.mouse.move(g.X(2),y);await p.mouse.down();await p.mouse.move(g.X(2)+30,y,{steps:4});await p.mouse.move(g.X(2)+50,y,{steps:4});
 check('A live readout shows while dragging',await p.evaluate(()=>document.body.classList.contains('sg-moving')));
 await p.mouse.up();await sleep(300);
 let r1=await regs(),d=r1[0].start-r0[0].start;
 check('Dragging moves the part by the drag distance',near(d,50*g.px,g.px*1.5),{d,expected:50*g.px});
 check('Every attempt in the part moves with it',r1[0].origins.every((o,i)=>near(o-r0[0].origins[i],d,1e-9))&&r1[0].selected===r0[0].selected);
 check('The other part stays put',r1[1].start===r0[1].start);
 check('A move is one Undo step',await p.evaluate(()=>SongStudio.undoCount())===undo0+1);
 check('The move lands on a whole sample',near(Math.round(r1[0].start*48000),r1[0].start*48000,1e-6));
 await p.keyboard.press('Control+z');await sleep(300);
 check('Undo puts the part back exactly',JSON.stringify(await regs())===JSON.stringify(r0));
 await p.keyboard.press('Control+y');await sleep(300);check('Redo moves it again',(await regs())[0].start===r1[0].start);
 await p.keyboard.press('Control+z');await sleep(300);
 // Snap to beat (75 BPM default => 0.8 s beats).
 await p.locator('#sgSnap').check();g=await geo();
 await p.mouse.move(g.X(2),y);await p.mouse.down();await p.mouse.move(g.X(2)+97,y,{steps:6});await p.mouse.up();await sleep(300);
 const beat=await p.evaluate(()=>SongCore.beatSec(+document.getElementById('bpm').value||75));
 r1=await regs();check('With Snap on, the part starts on a beat',near(r1[0].start/beat,Math.round(r1[0].start/beat),1e-4),{start:r1[0].start,beat});
 await p.keyboard.press('Control+z');await sleep(300);
 // Alt bypasses snap.
 g=await geo();await p.keyboard.down('Alt');await p.mouse.move(g.X(2),y);await p.mouse.down();await p.mouse.move(g.X(2)+37,y,{steps:4});await p.mouse.up();await p.keyboard.up('Alt');await sleep(300);
 r1=await regs();check('Holding Alt moves freely with Snap on',!near(r1[0].start/beat,Math.round(r1[0].start/beat),1e-3)&&r1[0].start>r0[0].start,r1[0].start);
 await p.keyboard.press('Control+z');await sleep(300);await p.locator('#sgSnap').uncheck();
 // Esc cancels mid-drag.
 g=await geo();await p.mouse.move(g.X(2),y);await p.mouse.down();await p.mouse.move(g.X(2)+80,y,{steps:4});await p.keyboard.press('Escape');await p.mouse.up();await sleep(250);
 check('Esc cancels a drag and nothing moves',JSON.stringify(await regs())===JSON.stringify(r0)&&await p.evaluate(()=>!document.body.classList.contains('sg-moving')));
 // Overlap: drag part A onto part B. Cancel, then Move anyway.
 g=await geo();const over=async()=>{await p.mouse.move(g.X(2),y);await p.mouse.down();await p.mouse.move(g.X(6.2),y,{steps:6});await p.mouse.up();await sleep(400);};
 await over();check('Overlapping another part asks first',await p.locator('#songDialog[open]').count()===1&&/overlap/i.test(await p.locator('#songDialog h2').textContent()));
 await p.locator('#songDialog [data-action="cancel"]').click();await sleep(250);check('Cancel leaves everything as it was',JSON.stringify(await regs())===JSON.stringify(r0));
 await over();await p.locator('#songDialog [data-action="ok"]').click();await sleep(400);r1=await regs();
 check('Move anyway overlaps as asked',r1[0].start>5&&r1[0].start<6.5,r1[0].start);
 await p.keyboard.press('Control+z');await sleep(300);
 // Shift+drag moves the whole track.
 g=await geo();await p.keyboard.down('Shift');await p.mouse.move(g.X(7),y);await p.mouse.down();await p.mouse.move(g.X(7)-100,y,{steps:5});await p.mouse.up();await p.keyboard.up('Shift');await sleep(300);
 r1=await regs();const dw=r1[1].start-r0[1].start;
 check('Shift+drag moves every part on the track by the same amount',dw<0&&near(r1[0].start-r0[0].start,dw,1e-9),{dw});
 await p.keyboard.press('Control+z');await sleep(300);
 // Moves are clamped to the start of the song.
 g=await geo();await p.mouse.move(g.X(2),y);await p.mouse.down();await p.mouse.move(Math.max(g.b.x+2,g.X(0)-300),y,{steps:6});await p.mouse.up();await sleep(300);
 r1=await regs();check('A part cannot move before 0:00',r1[0].start===0,r1[0].start);
 await p.keyboard.press('Control+z');await sleep(300);
 // Keyboard nudges: three presses merge into one Undo.
 g=await geo();await p.mouse.click(g.X(2),y);await sleep(150);undo0=await p.evaluate(()=>SongStudio.undoCount());
 await p.locator(lane).first().focus();for(let i=0;i<3;i++){await p.keyboard.press('ArrowRight');await sleep(120);}
 r1=await regs();check('Arrow keys nudge the selected part 10 ms each',near(r1[0].start-r0[0].start,.03,1e-6),r1[0].start);
 check('A burst of nudges is one Undo step',await p.evaluate(()=>SongStudio.undoCount())===undo0+1);
 await p.keyboard.press('Shift+ArrowLeft');await sleep(200);r1=await regs();check('Shift+arrow nudges one beat',near(r1[0].start-r0[0].start,.03-beat,1e-6));
 await p.keyboard.press('Control+z');await sleep(300);check('One Undo restores the start of the burst',JSON.stringify(await regs())===JSON.stringify(r0));
 // Move… dialog: exact amounts.
 await p.mouse.click(g.X(2),y);await sleep(150);
 await p.locator('#sgMovePart').click();await sleep(200);
 await p.locator('#songDialog [name="by"]').fill('2');await p.locator('#songDialog [name="unit"]').selectOption('beats');await p.locator('#songDialog [data-action="ok"]').click();await sleep(400);
 r1=await regs();check('Move… by 2 beats moves exactly 2 beats',near(r1[0].start-r0[0].start,2*beat,1e-4));
 await p.keyboard.press('Control+z');await sleep(300);
 await p.locator('#sgMovePart').click();await sleep(200);await p.locator('#songDialog [name="what"]').selectOption('track');await p.locator('#songDialog [name="to"]').fill('0.5');await p.locator('#songDialog [data-action="ok"]').click();await sleep(400);
 r1=await regs();check('Move… whole track to start at 0.5 s',near(r1[0].start,.5,1e-4)&&near(r1[1].start-r0[1].start,-.5,1e-4));
 await p.keyboard.press('Control+z');await sleep(300);
 // Track menu → Move track….
 await p.locator('[data-track-menu]').first().click();await sleep(200);check('Track menu offers Move track…',await p.locator('#songDialog [data-action="move"]').count()===1);
 await p.locator('#songDialog [data-action="move"]').click();await sleep(250);
 check('Track menu opens the move dialog for the whole track',await p.locator('#songDialog [name="what"]').inputValue()==='track');
 await p.locator('#songDialog [name="by"]').fill('250');await p.locator('#songDialog [name="unit"]').selectOption('ms');await p.locator('#songDialog [data-action="ok"]').click();await sleep(400);
 r1=await regs();check('Whole track moved 250 ms later',near(r1[0].start-r0[0].start,.25,1e-6)&&near(r1[1].start-r0[1].start,.25,1e-6));
 // Sample-exact render at the new time.
 const onset=await p.evaluate(()=>{const w=S.song,t=w.tracks[0],r=t.regions[0],a=r.takes.find(x=>x.id===r.selected),src=w.sources[a.source].channels[0],ch=SongCore.renderTrack(w,t,{end:SongCore.trackEnd(t)})[0],o=Math.round(SongCore.origin(a)*w.rate);
  const ratios=k0=>{const out=[];for(let k=k0;k<k0+40;k++)if(Math.abs(src[k])>.05)out.push(ch[o+k]/src[k]);return out;},same=v=>v.length>5&&v.every(x=>Math.abs(x-v[0])<1e-6&&Math.abs(x)>.1);
  const ok=same(ratios(24000)),shifted=(()=>{const out=[];for(let k=24000;k<24040;k++)if(Math.abs(src[k])>.05)out.push(ch[o+k+1]/src[k]);return same(out);})();return {ok,shifted,o};});
 check('Playback and export render the part at its new time (sample exact)',onset.ok&&!onset.shifted,onset);
 // A manual-cleanup take (stored compactly as an edit of its original) moves with its part and rebuilds after reopening.
 await p.locator('#sgMove').uncheck();g=await geo();await p.mouse.click(g.X((await regs())[0].start+.5),y);await sleep(200);
 await p.locator('[data-edit]').first().click();await sleep(300);await p.locator('#songDialog button',{hasText:'Manual cleanup'}).click();await sleep(600);
 await p.locator('#sepMode').selectOption({index:1});await p.locator('#sepKeep').click();await sleep(1200);await p.locator('#veClose').click().catch(()=>{});await sleep(300);
 const cl=await p.evaluate(()=>{const r=S.song.tracks[0].regions[0],t=r.takes.find(a=>a.cleanup);return t?{id:t.id,hash:SongCore.hashPcm(S.song.sources[t.source].channels),chosen:r.selected===t.id}:null;});
 check('A cleanup take is chosen in the first part',cl&&cl.chosen,cl);
 await p.evaluate(()=>SongStudio.commitMove(S.song.tracks[0].id,[S.song.tracks[0].regions[0].id],.5,false));await sleep(400);
 await p.evaluate(async()=>{await persistNow();});await sleep(300);const before=await regs();
 await p.reload();await p.waitForFunction(()=>window.SongStudio&&!S.loading&&S.song?.tracks?.[0]?.regions?.length===2&&S.song.tracks[0].regions[0].takes.length===3,null,{timeout:60000});
 check('Moved positions survive autosave and reopening',JSON.stringify(await regs())===JSON.stringify(before));
 check('The moved cleanup take rebuilds exactly after reopening',await p.evaluate(c=>{const r=S.song.tracks[0].regions[0],t=r.takes.find(a=>a.id===c.id);return !!t&&SongCore.hashPcm(S.song.sources[t.source].channels)===c.hash&&r.selected===c.id;},cl));
 check('Autosave stores the cleanup take as an edit, not a full copy',await p.evaluate(()=>new Promise(res=>{const rq=indexedDB.open('playbook-vocal-studio');rq.onsuccess=()=>{const db=rq.result,names=[...db.objectStoreNames],st=db.transaction(names[0],'readonly').objectStore(names[0]),out=[];const c=st.openCursor();c.onsuccess=()=>{const cur=c.result;if(!cur){res(out.includes('edit'));return;}if(typeof cur.key==='string'&&cur.key.includes('src:'))out.push(cur.value.derived?'edit':'full');cur.continue();};};})));
 await p.context().close();

 /* ---------- POLISH note edits move with the audio ---------- */
 const q=await page(1280,900);
 await q.evaluate(()=>{const C=SongCore,R=48000,n=R*6,a=new Float32Array(n);let ph=0;
  for(let i=0;i<n;i++){const t=i/R,f=t<1.5?220:t<3?246.94:t<4.5?261.63:293.66;ph+=2*Math.PI*f/R;const env=Math.min(1,(t%1.5)/.03,(1.5-(t%1.5))/.03);a[i]=.3*Math.sin(ph)*env+.08*Math.sin(2*ph)*env;}
  S.song=C.empty(R);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:1,end:7,channels:[a],origin:1,choose:true}),'tuning move');});
 await q.waitForTimeout(500);
 await q.locator('#rcStep2').click();await q.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});
 await q.locator('[data-tab=tune]').click();await q.locator('[data-dock=notes]').click();
 const fr=async()=>{await q.locator('#noteEditorFrame').waitFor({state:'attached',timeout:60000});const f=await(await q.locator('#noteEditorFrame').elementHandle()).contentFrame();await f.waitForFunction(()=>window.PlaybookNoteEditor&&PlaybookNoteEditor.analysis().notes.length>2,null,{timeout:120000});return f;};
 const idle=()=>q.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});
 let f=await fr();
 await f.locator('#selAll').click();await f.locator('#nUp').click();await idle();await q.waitForTimeout(800);
 await q.locator('#rcStep1').click();await q.waitForFunction(()=>RC.step==='rc');await q.waitForTimeout(400);
 const notesOf=e=>e.settings.notes.map(n=>({i0:n[0],i1:n[1],shift:+n[3].toFixed(6),man:n[11]}));
 const saved=await q.evaluate(()=>{const e=S.song.tracks[0].polish?.session?.noteTuner?.editor;return e?e.settings.notes.map(n=>({i0:n[0],i1:n[1],shift:+n[3].toFixed(6),man:n[11]})):null;});
 check('The hand edits are saved on the track before moving',saved&&saved.length>2&&saved.every(n=>n.man),saved&&saved.length);
 await q.evaluate(()=>SongStudio.commitMove(S.song.tracks[0].id,S.song.tracks[0].regions.map(r=>r.id),1,true));await q.waitForTimeout(500);
 check('The status line says the POLISH edits moved with it',/POLISH edits moved with it/.test(await q.locator('#sgStatus').textContent()));
 const F=Math.round(11025/110);
 const shifted=await q.evaluate(()=>S.song.tracks[0].polish.session.noteTuner.editor.settings.notes.map(n=>({i0:n[0],i1:n[1],shift:+n[3].toFixed(6),man:n[11]})));
 check('Saved edits shifted by one second (about 100 analysis frames), pitch edits unchanged',shifted.length===saved.length&&shifted.every((n,k)=>Math.abs(n.i0-saved[k].i0-F)<=1&&n.i1-n.i0===saved[k].i1-saved[k].i0&&n.shift===saved[k].shift&&n.man),{saved:saved.slice(0,2),shifted:shifted.slice(0,2)});
 await q.locator('#rcStep2').click();await q.waitForTimeout(800);
 check('Reopening POLISH does not ask to reset edits',await q.locator('#songDialog[open]').count()===0);
 await q.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});await idle();
 f=await fr();
 const after=await f.evaluate(()=>PlaybookNoteEditor.state().settings.notes.map(n=>({i0:n[0],i1:n[1],shift:+n[3].toFixed(6),man:n[11]})));
 check('Every hand-tuned note is still there at its new time',after.length===shifted.length&&after.every((n,k)=>n.i0===shifted[k].i0&&n.shift===shifted[k].shift&&n.man),{after:after.slice(0,2),shifted:shifted.slice(0,2)});
 check('No "recording changed" notice and POLISH is up to date with the moved vocal',await q.evaluate(()=>SongCore.polishValid(S.song,S.song.tracks[0])));
 await q.context().close();
 // Phone: the switch is reachable and the timeline still fits.
 const m=await page(390,844);await m.evaluate(()=>{const C=SongCore,R=48000;S.song=C.empty(R);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:1,end:3,channels:[new Float32Array(R*2).fill(.1)],origin:1,choose:true}),'phone');});
 await m.waitForTimeout(500);await m.locator('#sgMove').scrollIntoViewIfNeeded();
 check('390×844: Move parts and Move… are reachable and the page fits',await m.locator('#sgMove').isVisible()&&await m.locator('#sgMovePart').isVisible()&&await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await m.context().close();
});
