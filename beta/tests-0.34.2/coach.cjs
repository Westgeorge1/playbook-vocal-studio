/* 0.34.2: Clean up here (button, N key, right-click; opens at the spot; returns there) and the Smart Guide coach
 * (follows where you are, tracks what you change, warns about risky settings with fix buttons, quality outlook,
 * how-to per feature, explain mode), on laptop and phone. */
const {suite}=require('../tests-0.32.4/browser.cjs');
const R=48000,N=R*12;
let seed=11;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);
const voc=new Float32Array(N);{let ph=0;for(let i=0;i<N;i++){const t=i/R,k=Math.floor(t/3),u=t-k*3;if(u>.7&&u<2.6){ph+=2*Math.PI*(196+30*k)/R;voc[i]=(.25*Math.sin(ph)+.08*Math.sin(2*ph))*Math.min(1,(u-.7)/.03,(2.6-u)/.03);}else if(u>.25&&u<.55)voc[i]=.05*rnd()*Math.sin(Math.PI*(u-.25)/.3);voc[i]+=.003*rnd();}}
const beat=new Float32Array(N);for(let i=0;i<N;i++){const t=i/R;beat[i]=.2*Math.sin(2*Math.PI*55*t)+(t%.8<.05?.4*rnd():0);}
function wav(x,name){const n=x.length,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(R,24);b.writeUInt32LE(R*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(x[i]*32767))),44+2*i);return{name,mimeType:'audio/wav',buffer:b};}

suite('coach-0.34.2',19,async({page,check})=>{
 const p=await page(1280,800);p.on('dialog',d=>d.accept());
 const items=()=>p.evaluate(()=>PvsCoach.items());
 await p.evaluate(a=>{const C=SongCore,x=Float32Array.from(a);S.song=C.empty(48000);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:12,channels:[x],origin:0,choose:true}),'coach test');},Array.from(voc));
 await p.waitForTimeout(400);
 /* ---------- Song & vocals ---------- */
 check('Guide button on Song & vocals',await p.locator('#coachBtn').isVisible());
 await p.evaluate(()=>PvsCoach.evaluate());
 check('Guide follows you: Song & vocals',await p.evaluate(()=>PvsCoach.context())==='song');
 check('Without a riddim the guide suggests loading one',(await items()).some(x=>x.id==='song-beat'&&x.actions.includes('Load backing')));
 const ch=p.waitForEvent('filechooser');await p.evaluate(()=>document.getElementById('sgLoadBeat').click());await(await ch).setFiles(wav(beat,'backing.wav'));
 await p.waitForFunction(()=>!!S.beat,null,{timeout:30000});await p.waitForTimeout(300);await p.evaluate(()=>PvsCoach.evaluate());
 check('…and drops that advice once the riddim is loaded',!(await items()).some(x=>x.id==='song-beat'));
 await p.locator('#coachBtn').click();await p.waitForTimeout(300);
 const g=await p.evaluate(()=>({open:!document.getElementById('guideSheet').hidden,now:document.getElementById('coachNow').textContent,next:document.getElementById('coachNext').textContent,how:document.querySelector('#coachHow summary').textContent,stages:document.querySelectorAll('.coach-stage').length}));
 check('Guide opens from Song & vocals with Now / Next / How it works and five stages',g.open&&/Song & vocals/.test(g.now)&&/POLISH/.test(g.next)&&/How Song & vocals works/.test(g.how)&&g.stages===5,g);
 await p.locator('#guideClose').click();
 /* ---------- Clean up here ---------- */
 check('Clean up here button sits in the transport',await p.locator('#sgCleanHere').isVisible()&&!(await p.locator('#sgCleanHere').isDisabled()));
 await p.evaluate(()=>{S.song.cursor=3.4;SongStudio.render();});
 await p.locator('#sgCleanHere').click();await p.waitForTimeout(500);
 const mc=await p.evaluate(()=>({open:!document.getElementById('vocalEditor').hidden,a:+document.getElementById('veA').value,b:+document.getElementById('veB').value,msg:document.getElementById('veStatus').textContent,ctx:PvsCoach.context()}));
 check('Clean up here opens Manual cleanup',mc.open);
 check('…with about one second around the playhead selected',Math.abs(mc.a-2.9)<.02&&Math.abs(mc.b-3.9)<.02,mc);
 check('…and says what to do next',/selected/.test(mc.msg)&&/Hear removed/.test(mc.msg));
 check('Guide knows you are in Manual cleanup',mc.ctx==='cleanup');
 // A selection over singing with a strong reduction gets a warning; a breath gets a reassurance.
 await p.evaluate(()=>{const a=document.getElementById('veA'),b=document.getElementById('veB');a.value='1.0';b.value='2.4';for(const e of [a,b])e.dispatchEvent(new Event('change',{bubbles:true}));const d=document.getElementById('sepDb');d.value='14';d.dispatchEvent(new Event('input',{bubbles:true}));d.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.waitForTimeout(300);await p.evaluate(()=>PvsCoach.evaluate());let it=await items();
 check('Guide warns when a cleanup selection covers singing',it.some(x=>x.id==='mc-voice'&&x.level==='warn'),it.map(x=>x.id));
 check('Guide warns about a very strong cleanup reduction',it.some(x=>x.id==='mc-deep'));
 await p.evaluate(()=>{const a=document.getElementById('veA'),b=document.getElementById('veB');a.value='3.28';b.value='3.52';for(const e of [a,b])e.dispatchEvent(new Event('change',{bubbles:true}));const d=document.getElementById('sepDb');d.value='6';d.dispatchEvent(new Event('input',{bubbles:true}));d.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.waitForTimeout(300);await p.evaluate(()=>PvsCoach.evaluate());it=await items();
 check('Guide recognises a breath and says a gentle reduction is safe',it.some(x=>x.id==='mc-breath')&&!it.some(x=>x.id==='mc-voice'),it.map(x=>x.id));
 await p.locator('#veClose').click();await p.waitForTimeout(400);
 check('Closing returns the playhead to where you were',await p.evaluate(()=>Math.abs(S.song.cursor-3.4)<.01&&document.getElementById('vocalEditor').hidden));
 await p.keyboard.press('n');await p.waitForTimeout(400);
 check('N key opens Clean up here',await p.evaluate(()=>!document.getElementById('vocalEditor').hidden));
 await p.locator('#veClose').click();await p.waitForTimeout(300);
 const lane=p.locator('#sgTimeline .sg-lane.active canvas.sg-wave');await lane.scrollIntoViewIfNeeded();await p.waitForTimeout(200);const bx=await lane.boundingBox();
 const view=await p.evaluate(()=>SongStudio.view());const x=bx.x+bx.width*(6.5-view.start)/view.span;
 await p.mouse.click(x,bx.y+bx.height/2,{button:'right'});await p.waitForTimeout(400);
 const rc=await p.evaluate(()=>({open:!document.getElementById('vocalEditor').hidden,a:+document.getElementById('veA').value,b:+document.getElementById('veB').value}));
 check('Right-click a recording opens Clean up here at that spot',rc.open&&Math.abs((rc.a+rc.b)/2-6.5)<.15,rc);
 await p.locator('#veClose').click();await p.waitForTimeout(300);
 check('Right-click cleanup restores the playhead from before the click',await p.evaluate(()=>Math.abs(S.song.cursor-3.4)<.001));
 check('Guide tracked your actions',(await p.evaluate(()=>PvsCoach.log().map(x=>x.text).join('|'))).includes('Clean up here'));
 /* ---------- POLISH: CLEAN ---------- */
 await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});
 const idle=()=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked()&&!NoiseCleaner.locked(),null,{timeout:180000});await idle();
 await p.locator('.itabs [data-tab=clean]').click();await p.waitForTimeout(300);await p.evaluate(()=>PvsCoach.evaluate());
 check('Guide follows you to CLEAN',await p.evaluate(()=>PvsCoach.context())==='clean');
 await p.evaluate(()=>{const r=document.getElementById('noiseReduction');r.value='18';r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}));});await idle();await p.waitForTimeout(600);await p.evaluate(()=>PvsCoach.evaluate());
 it=await items();
 check('Guide warns when Maximum reduction is very high, with a fix',it.some(x=>x.id==='cl-max'&&x.level==='warn'&&x.actions.includes('Set 12 dB')),it.map(x=>x.id));
 check('Guide reminds you to listen to REMOVED NOISE after changing cleaning',it.some(x=>x.id==='cl-listen'));
 const toast=await p.evaluate(()=>({shown:!document.getElementById('coachToast').hidden,text:document.getElementById('coachToast').textContent}));
 check('A warning appears as a slim line under the header while you work',toast.shown&&/Smart Guide/.test(toast.text)&&await p.evaluate(()=>document.getElementById('coachToast').parentElement.id==='rcSteps'),toast);
 await p.evaluate(()=>{let b=[...document.querySelectorAll('#coachToast [data-coach]')].find(b=>/12 dB/.test(b.textContent));if(!b){PvsCoach.open();b=[...document.querySelectorAll('#coachAdvice [data-coach]')].find(b=>/12 dB/.test(b.textContent));}b?.click();});
 await idle();await p.waitForTimeout(500);
 check('The fix button applies the safer setting',await p.evaluate(()=>NoiseCleaner.state().reduction===12));
 /* ---------- CHAIN: EQ and dynamics ---------- */
 await p.locator('.itabs [data-tab=chain]').click();await p.waitForTimeout(300);
 await p.evaluate(()=>{setP('chEq2Gain',8);setP('chCompress',.9);setP('chLimitCeiling',-.1);syncControls();});await idle();await p.waitForTimeout(400);await p.evaluate(()=>PvsCoach.evaluate());
 it=await items();
 check('Guide follows you to CHAIN',await p.evaluate(()=>PvsCoach.context())==='chain');
 check('Too much EQ: a +8 dB presence boost is flagged as harsh, with a fix',it.some(x=>x.id==='eq-boost-chEq2Gain'&&x.level==='warn'&&/harsh/.test(x.text)&&x.actions.includes('Set +3 dB')),it.map(x=>x.id));
 check('Heavy compression is flagged',it.some(x=>x.id==='dy-comp'));
 check('A limiter ceiling near 0 dB is flagged',it.some(x=>x.id==='lv-ceiling'));
 const o=await p.evaluate(()=>PvsCoach.outlook());
 check('Sound-quality outlook rates each area Good / Fair / At risk',o&&o.rows.length>=4&&o.rows.some(r=>r.area==='Vocal chain'&&r.lvl===2)&&o.overall===2&&/At risk/.test(o.summary),o);
 await p.evaluate(()=>PvsCoach.open());await p.waitForTimeout(300);
 const fixes=await p.locator('#coachAdvice [data-coach]').count();
 await p.evaluate(()=>[...document.querySelectorAll('#coachAdvice [data-coach]')].find(b=>/\+3 dB/.test(b.textContent))?.click());await idle();await p.waitForTimeout(700);
 check('Fix buttons in the guide change the setting',fixes>=3&&await p.evaluate(()=>S.P.chEq2Gain===3));
 await p.evaluate(()=>{setP('chEq1Gain',-12);syncControls();});await idle();await p.evaluate(()=>PvsCoach.evaluate());
 check('Going too low: a −12 dB cut is flagged',(await items()).some(x=>x.id==='eq-cut-chEq1Gain'));
 const panel=await p.evaluate(()=>({now:document.getElementById('coachNow').textContent,how:document.querySelector('#coachHow summary').textContent,outlook:document.getElementById('coachOutlook').textContent,w:document.getElementById('guideSheet').getBoundingClientRect().width,classic:!!document.querySelector('#coachClassic #gApply')}));
 check('Laptop: the guide is a side panel with Now, How it works and the outlook',/CHAIN/.test(panel.now)&&/How CHAIN/.test(panel.how)&&/outlook/i.test(panel.outlook)&&panel.w<=560,panel);
 check('The original measured tips are kept, folded under the coach',panel.classic);
 // Explain mode
 await p.locator('label:has(#coachExplain)').click();check('Explain switch turns on from the guide',await p.evaluate(()=>document.getElementById('coachExplain').checked));await p.locator('#guideClose').click();
 await p.locator('#chainOn').hover().catch(()=>{});await p.locator('#playBtn').hover();await p.waitForTimeout(200);
 const tip=await p.evaluate(()=>({shown:!document.getElementById('coachTip').hidden,text:document.getElementById('coachTip').textContent}));
 check('Explain mode: hovering a control says what it does',tip.shown&&/this vocal/.test(tip.text),tip);
 await p.evaluate(()=>{document.getElementById('coachExplain').checked=false;document.getElementById('coachExplain').dispatchEvent(new Event('change'));});
 // Tuning window events are tracked too
 await p.locator('.itabs [data-tab=tune]').click();await p.locator('#noteEditorFrame').waitFor({state:'attached',timeout:60000});
 const f=await(await p.locator('#noteEditorFrame').elementHandle()).contentFrame();await f.waitForFunction(()=>window.PlaybookNoteEditor&&PlaybookNoteEditor.analysis().notes.length>=3,null,{timeout:120000});await idle();
 await p.waitForTimeout(1500);await f.locator('#presetRoots').click();await idle();await p.waitForTimeout(1500);
 check('Guide follows you to TUNE and tracks note-editor actions',await p.evaluate(()=>PvsCoach.context()==='tune'&&PvsCoach.log().some(x=>x.editor&&/Natural Roots/.test(x.text))));
 check('Outlook includes tuning once the note editor has notes',await p.evaluate(()=>PvsCoach.outlook().rows.some(r=>r.area==='Tuning')));
 /* ---------- phone ---------- */
 const q=await page(390,844);q.on('dialog',d=>d.accept());
 await q.evaluate(a=>{const C=SongCore,x=Float32Array.from(a);S.song=C.empty(48000);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:12,channels:[x],origin:0,choose:true}),'coach phone');},Array.from(voc));await q.waitForTimeout(400);
 await q.locator('#coachBtn').click();await q.waitForTimeout(300);
 const ph=await q.evaluate(()=>{const r=document.getElementById('guideSheet').getBoundingClientRect();return {w:r.width,over:document.documentElement.scrollWidth-innerWidth,open:!document.getElementById('guideSheet').hidden};});
 check('Phone: the guide opens full width without sideways scrolling',ph.open&&ph.w<=390&&ph.over<=1,ph);
 await q.locator('label:has(#coachExplain)').tap();await q.locator('#guideClose').tap();
 await q.locator('#coachBtn').tap();
 check('Touch: the Guide can be reopened while Explain is enabled',await q.locator('#guideSheet').isVisible());
 await q.locator('label:has(#coachExplain)').tap();
 check('Touch: Explain can be turned off from the reopened Guide',!(await q.locator('#coachExplain').isChecked()));
 await q.locator('#guideClose').tap();
 await q.evaluate(()=>{S.song.cursor=1;SongStudio.render();});
 const mobileLane=q.locator('#sgTimeline .sg-lane.active canvas.sg-wave');
 await mobileLane.scrollIntoViewIfNeeded();
 const rect=await mobileLane.boundingBox(),mobileView=await q.evaluate(()=>SongStudio.view());
 const pressPoint={x:rect.x+rect.width*(8-mobileView.start)/mobileView.span,y:rect.y+rect.height/2};
 const touch=await q.context().newCDPSession(q);
 try{
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pressPoint]});
  await q.waitForTimeout(850);
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const held=await q.evaluate(()=>Studio.state());
  check('Touch: holding a recording opens cleanup at that spot',held.open&&Math.abs((held.a+held.b)/2-8)<.25);
  await q.locator('#veClose').tap();await q.waitForTimeout(150);
  check('Touch: closing cleanup restores the previous playhead',await q.evaluate(()=>Math.abs(S.song.cursor-1)<.001));
  await mobileLane.scrollIntoViewIfNeeded();
  // A tall, user-resized lane can extend beyond the viewport. Drag through
  // visible waveform pixels, just as a finger must, including after a sheet closes.
  const {start,end,dy}=await mobileLane.evaluate(c=>{const r=c.getBoundingClientRect(),start=r.x+r.width*.25,end=r.x+r.width*.45;
   const top=Math.max(0,r.y),bottom=Math.min(innerHeight,r.bottom),mid=(top+bottom)/2;
   for(const y of [mid,...Array.from({length:Math.ceil(Math.max(0,bottom-top)/8)},(_,i)=>top+4+i*8)])
    if(document.elementFromPoint(start,y)===c&&document.elementFromPoint(end,y)===c)return {start,end,dy:y};
   throw Error('The visible lane has no reachable touch path.');});
  console.log('Verified touch path',start,end,dy);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y:dy}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end,y:dy}]});
  await q.waitForTimeout(750);
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check('Touch: dragging selects a range without opening cleanup',await q.evaluate(()=>!Studio.state().open&&S.song.range?.[1]>S.song.range?.[0]));
 }finally{await touch.detach();}


 // The selected take is silent. The alternative contains a stereo word at 4–5 s in song time.
 const alt=await page(1280,720);
 const ids=await alt.evaluate(()=>{
  S.song=SongCore.empty(48000);let ids;
  SongStudio.edit(w=>{
   w.lead=0;
   const silence=new Float32Array(5*w.rate);
   const left=Float32Array.from(silence,(_,i)=>i>=w.rate&&i<2*w.rate?.3*Math.sin(2*Math.PI*220*i/w.rate):0);
   const right=Float32Array.from(left,x=>-x);
   const {region}=SongCore.addTake(w,{start:3,end:8,origin:3,channels:[silence],choose:true});
   const {take}=SongCore.addTake(w,{regionId:region.id,start:3,end:8,origin:3,channels:[left,right]});
   ids={region:region.id,take:take.id};
  },'Alternate cleanup test');return ids;
 });
 await alt.locator('#sgTakes [data-edit="'+ids.take+'"]').click();
 await alt.locator('#songDialog [data-action="cleanup"]').click();
 const advice=await alt.evaluate(()=>{
  Studio.select(4.15,4.65);
  const db=document.getElementById('sepDb');db.value='14';db.dispatchEvent(new Event('change',{bubbles:true}));
  PvsCoach.evaluate();return PvsCoach.items().map(x=>x.id);
 });
 check('Guide detects singing on the alternate take being edited',advice.includes('mc-voice')&&!advice.includes('mc-breath'));
 await alt.locator('#veClose').click();
 await alt.locator('#sgTakes [data-listen="'+ids.take+'"]').click();
 await alt.waitForFunction(()=>SongStudio.state().playing&&SongStudio.state().position>3.05);
 await alt.locator('#sgCleanHere').click();
 check('Clean up here opens the take being auditioned',await alt.evaluate(id=>Studio.state().open&&Studio.state().tid===id,ids.take));
});
