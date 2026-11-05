/* 0.34.0 user-friendliness: classic tools switch, tuning-window tabs, CLEAN/CHAIN folding, listen strips,
 * laptop panel height, phone pinned tabs, Song & vocals order, clearer labels, one key line. */
const {suite}=require('../tests-0.32.4/browser.cjs');
const R=48000,N=R*12;
let seed=3;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);
const voc=new Float32Array(N);{let ph=0;for(let i=0;i<N;i++){const t=i/R,k=Math.floor(t/3),u=t-k*3;if(u>.7&&u<2.6){ph+=2*Math.PI*(196+30*k)*(1+.004*Math.sin(2*Math.PI*5.5*t))/R;voc[i]=(.25*Math.sin(ph)+.08*Math.sin(2*ph))*Math.min(1,(u-.7)/.03,(2.6-u)/.03);}voc[i]+=.0008*rnd();}}
const beat=new Float32Array(N);for(let i=0;i<N;i++){const t=i/R,bt=t%.8;beat[i]=.2*Math.sin(2*Math.PI*55*t)+.1*Math.sin(2*Math.PI*220*t)+(bt<.05?.4*rnd()*(1-bt/.05):0);}
function wav(x,name){const n=x.length,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(R,24);b.writeUInt32LE(R*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(x[i]*32767))),44+2*i);return{name,mimeType:'audio/wav',buffer:b};}

suite('ux-0.34.0',17,async({page,check})=>{
 const seen=async(p,sel)=>p.locator(sel).first().isVisible().catch(()=>false);
 async function song(p){
  await p.evaluate(a=>{const C=SongCore,x=Float32Array.from(a);S.song=C.empty(48000);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:12,channels:[x],origin:0,choose:true}),'ux test');},Array.from(voc));
  await p.waitForTimeout(300);
  const ch=p.waitForEvent('filechooser');await p.evaluate(()=>document.getElementById('sgLoadBeat').click());await(await ch).setFiles(wav(beat,'backing.wav'));
  await p.waitForFunction(()=>!!S.beat,null,{timeout:30000});await p.waitForTimeout(300);
 }
 const idle=p=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked()&&!NoiseCleaner.locked(),null,{timeout:180000});
 async function polish(p){await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});await idle(p);await p.waitForTimeout(500);}
 const frame=async p=>{await p.locator('#noteEditorFrame').waitFor({state:'attached',timeout:60000});const f=await(await p.locator('#noteEditorFrame').elementHandle()).contentFrame();await f.waitForFunction(()=>window.PlaybookNoteEditor&&window.PlaybookUX&&PlaybookNoteEditor.analysis().notes.length>=3,null,{timeout:120000});return f;};

 /* ---------- laptop ---------- */
 const p=await page(1280,800);p.on('dialog',d=>d.accept());
 check('Classic tools are off on a new device',await p.evaluate(()=>document.body.classList.contains('pvs-simple')&&!PvsUX.classic()));
 await song(p);await polish(p);
 await p.locator('.menubar .mtop',{hasText:'File'}).click();
 check('File menu: the classic session item is hidden',!(await seen(p,'.mdrop [data-act="session"]'))&&await seen(p,'.mdrop [data-act="toRC"]'));
 check('File menu: old RECORD & COMP name replaced',/Song & vocals/.test(await p.locator('.mdrop [data-act="toRC"]').textContent()));
 await p.locator('.menubar .mtop',{hasText:'Edit'}).click();
 check('Edit menu: the classic comp loader is hidden',!(await seen(p,'.mdrop [data-act="loadComp"]')));
 await p.keyboard.press('Escape');await p.evaluate(()=>window.dawCloseMenus?.());
 // Laptop layout
 const lay=await p.evaluate(()=>({doc:document.documentElement.scrollHeight,vh:innerHeight,insp:document.querySelector('.insp').getBoundingClientRect().height,bar:document.getElementById('trackPolishBar').getBoundingClientRect().height,dock:document.getElementById('dock').classList.contains('collapsed')}));
 check('Laptop: the page fits the window (no page scroll)',lay.doc<=lay.vh+2,lay);
 check('Laptop: the settings panel is at least 470 px tall at 1280×800 (0.33.1: 377 px)',lay.insp>=470,lay);
 check('Laptop: the Polishing bar takes at most two slim rows',lay.bar<=90,lay);
 check('Laptop: the editor panel starts as a slim bar',lay.dock);
 check('Duplicate "Open editing window" and "◀ Song & vocals" are hidden',!(await seen(p,'#polishWave'))&&!(await seen(p,'#polToRC'))&&await seen(p,'#polishReturn'));
 check('Play says what it plays',/this vocal/.test(await p.locator('#playBtn').textContent()));
 // CLEAN
 await p.locator('.itabs [data-tab=clean]').click();await idle(p);
 for(const id of ['noiseEnabled','noiseScope','noiseBleed','noiseReduction','noiseUndo','noiseBig'])check('CLEAN shows '+id+' without opening anything',await p.evaluate(id=>{const e=document.getElementById(id);return !!e&&e.getClientRects().length>0;},id));
 check('CLEAN: one background-noise area (measurement inside Noise removal)',await p.evaluate(()=>!!document.querySelector('.noise-studio #noiseBig')&&!document.querySelector('#page-clean > .rack:not(.ux-empty) #noiseBig:not(.noise-studio *)')));
 check('CLEAN: the older cleaner choice is hidden',!(await seen(p,'#noiseChoice')));
 for(const id of ['noiseLearn','noiseRoomSave','noiseAi','noiseHum'])check('CLEAN: '+id+' waits under More cleaning controls',!(await seen(p,'#'+id)));
 const listenTop=await p.evaluate(()=>{const s=document.querySelector('#page-clean > .ux-listen'),b=document.querySelector('.ibody').getBoundingClientRect();return s&&s.contains(document.getElementById('cleanListen'))?s.getBoundingClientRect().top-b.top:null;});
 check('CLEAN: BEFORE / CLEANED / REMOVED sit at the top of the tab',listenTop!==null&&listenTop<4,listenTop);
 await p.locator('#uxCleanMore .ux-more-btn').click();
 // 0.37.0: AI clean (DeepFilterNet3) lives in the Clean vocal panel; the older RNNoise selector shows only for projects that use it.
 check('More cleaning controls opens learn, rooms and filters; AI clean is in Clean vocal',await seen(p,'#noiseLearn')&&await seen(p,'#noiseRoomSave')&&await seen(p,'#cv-dfn')&&await seen(p,'#noiseHum')&&!(await seen(p,'#noiseAi')));
 await p.locator('.ibody').evaluate(e=>e.scrollTop=e.scrollHeight);await p.waitForTimeout(200);
 const pinned=await p.evaluate(()=>{const s=document.querySelector('#page-clean > .ux-listen').getBoundingClientRect(),b=document.querySelector('.ibody').getBoundingClientRect();return s.top-b.top;});
 check('CLEAN: the listen strip stays pinned while scrolling the settings',Math.abs(pinned)<12,pinned);
 await p.locator('#cleanListen [data-mode=removed]').click();await p.waitForTimeout(200);
 check('CLEAN listen buttons still switch what you hear',await p.evaluate(()=>S.mode==='removed'));
 await p.locator('#cleanListen [data-mode=cleaned]').click();
 // CHAIN
 await p.locator('.itabs [data-tab=chain]').click();await p.waitForTimeout(300);
 check('CHAIN: the detailed EQ starts folded',!(await seen(p,'#eqCanvas'))&&await seen(p,'#presetSeg'));
 check('CHAIN: Dynamics and Level stay open',await seen(p,'#dynKnobs')&&await seen(p,'#levelKnobs'));
 await p.locator('#page-chain .rack[data-ux-fold="chain-eq"] .ux-fold-btn').click();
 check('CHAIN: a folded rack opens from its heading',await seen(p,'#eqCanvas'));
 await p.locator('#page-chain .ux-listen [data-mode=after]').click();await p.waitForTimeout(200);
 check('CHAIN listen strip switches to TUNED and mirrors the transport',await p.evaluate(()=>S.mode==='after'&&document.querySelector('#abSeg [data-mode=after]').getAttribute('aria-pressed')==='true'&&document.querySelector('#page-chain .ux-listen [data-mode=after]').getAttribute('aria-pressed')==='true'));
 // TUNE + note editor
 await p.locator('.itabs [data-tab=tune]').click();await p.waitForTimeout(300);
 check('TUNE: opening the TUNE tab opens the editor panel on the note editor',await p.evaluate(()=>!document.getElementById('dock').classList.contains('collapsed')&&DAW.dock==='notes'));
 check('TUNE: the older tuner choice is hidden and the help is current',!(await seen(p,'#tunerChoice'))&&/Tune tab/.test(await p.locator('#noteRouteHelp').textContent()));
 check('TUNE: has a CLEANED / TUNED listen strip',await seen(p,'#page-tune > .ux-listen [data-mode=after]'));
 let f=await frame(p);await idle(p);
 const tabs=await f.evaluate(()=>({tabs:[...document.querySelectorAll('.neTabs [role=tab]')].map(b=>b.textContent),sel:PlaybookUX.tab()}));
 check('Tuning settings are four tabs: Note, Tune, Check, More',tabs.tabs.join()==='Note,Tune,Check,More',tabs);
 check('The Tune tab opens first',tabs.sel==='tune');
 const order=await f.evaluate(()=>{const a=document.getElementById('tuningPresets'),b=document.getElementById('smoothPanel');return {next:a.nextElementSibling===b,vis:a.getClientRects().length>0&&b.getClientRects().length>0};});
 check('Tune tab: Automatic tuning sits right under the presets',order.next&&order.vis,order);
 check('Classic tools hidden in the editor: approved presets and Correct pitch',!(await f.locator('#presetSnapSmooth').isVisible())&&!(await f.locator('#correctPanel').isVisible()));
 check('Hard Effect stays visible',await f.locator('#presetHard').isVisible());
 check('Classic Smooth stays listed while it is the current mode',await f.evaluate(()=>{const s=document.getElementById('autoMode'),o=s.querySelector('[value=classic]');return s.value!=='classic'||!o.hidden;}));
 await f.locator('#presetRoots').click();await idle(p);await p.waitForTimeout(900);
 check('After choosing a Natural preset the Classic Smooth mode is tucked away',await f.evaluate(()=>document.getElementById('autoMode').value==='natural'&&document.querySelector('#autoMode [value=classic]').hidden));
 const key=await f.evaluate(()=>{const t=document.querySelector('.tools'),l=document.getElementById('keyLine');return {after:t.nextElementSibling===l,has:l.contains(document.getElementById('presetKeyHint'))};});
 check('Key warning sits right under KEY / SCALE',key.after&&key.has,key);
 const top=await p.locator('#dawKey').textContent(),ed=await f.evaluate(()=>{const k=document.getElementById('key'),s=document.getElementById('scale');return k.options[k.selectedIndex].text+' '+s.options[s.selectedIndex].text.toLowerCase();});
 check('The top bar shows the note editor\'s key',top==='Key '+ed,{top,ed});
 await f.locator('#neTab-check').click();
 check('Check tab: blind compare, chords and correction map',await f.locator('#cmpStart').isVisible()&&await f.locator('#chordShow').isVisible()&&await f.locator('#corrMap').isVisible()&&!(await f.locator('#presetRoots').isVisible()));
 await f.locator('#neTab-more').click();
 {const v={};for(const id of ['levApply','quantize','redetect','classicTools'])v[id]=await f.locator('#'+id).isVisible();
 check('More tab: voice, beat grid, detection and the Classic tools switch',Object.values(v).every(Boolean),v);}
 await f.locator('#neTab-tune').click();
 // Selecting a note opens the Note tab, clearing returns
 await f.locator('#selAll').click();await p.waitForTimeout(200);
 check('Selecting notes opens the Note tab',await f.evaluate(()=>PlaybookUX.tab()==='note')&&await f.locator('#nUp').isVisible());
 check('The Selected note help is a one-line tip with the full how-to folded',await f.evaluate(()=>{const e=document.getElementById('noteEmpty');return !!e.querySelector('.noteTip')&&!!e.querySelector('details.noteHow');}));
 await f.locator('#editor').click({position:{x:5,y:60}}).catch(()=>{});await f.evaluate(()=>window.PlaybookNoteEditor.escape?.());await p.waitForTimeout(300);
 check('Clearing the selection goes back to the Tune tab',await f.evaluate(()=>PlaybookUX.tab()==='tune'));
 check('Editor Undo says what it undoes',(await f.locator('#undo').getAttribute('title')).startsWith('Undo note edit'));
 // Classic switch from the View menu reaches the open editor
 await p.locator('.menubar .mtop',{hasText:'View'}).click();await p.locator('#uxClassicItem').click();await p.waitForTimeout(400);
 check('View → Classic tools turns them on',await p.evaluate(()=>PvsUX.classic()&&localStorage.getItem('pvs.classicTools')==='1'));
 check('…and shows the older tuner and cleaner choices',await p.evaluate(()=>document.getElementById('tunerChoice').getClientRects().length>0));
 await f.waitForFunction(()=>!document.documentElement.classList.contains('pvs-simple'),null,{timeout:3000}).catch(()=>{});
 check('…and the approved presets and Correct pitch in the editor',await f.locator('#presetSnapSmooth').isVisible()&&await f.locator('#neTab-tune').getAttribute('aria-selected')==='true'&&await f.locator('#correctPanel').isVisible());
 await f.locator('#neTab-more').click();await f.locator('#classicTools').uncheck();await p.waitForTimeout(500);
 check('The switch in the editor turns them off everywhere',await p.evaluate(()=>!PvsUX.classic()&&document.body.classList.contains('pvs-simple'))&&!(await f.locator('#correctPanel').isVisible()));
 await f.locator('#neTab-tune').click();
 // Tuning window: title-bar Play/Stop copies hidden (the editor has its own)
 await p.locator('#noteRouteOpen').click();await p.waitForTimeout(500);
 check('Tuning window: no duplicate Play / Stop in the title bar',await p.evaluate(()=>document.body.classList.contains('ww-open'))&&!(await seen(p,'#workWindowPlay'))&&await f.locator('#play').isVisible());
 await p.locator('#workWindowClose').click();await p.waitForTimeout(300);
 // Older tuner in use stays visible even with classic tools off
 await p.evaluate(()=>{const s=document.getElementById('tunerChoice');s.value='original';s.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.waitForFunction(()=>!S.busy&&!NoteTuner.locked(),null,{timeout:180000});await p.waitForTimeout(900);
 check('A vocal that uses the older tuner keeps its choice visible',await p.evaluate(()=>document.getElementById('tunerChoice').value==='original'&&document.getElementById('tunerChoice').getClientRects().length>0&&document.getElementById('legacyTuneControls').getClientRects().length>0));
 await p.evaluate(()=>{const s=document.getElementById('tunerChoice');if(s.value!=='note'){s.value='note';s.dispatchEvent(new Event('change',{bubbles:true}));}});await p.waitForFunction(()=>!S.busy&&!NoteTuner.locked(),null,{timeout:180000});
 // Remembered on this device
 check('Folds and editor-panel choice are remembered on this device',await p.evaluate(()=>{const f=JSON.parse(localStorage.getItem('pvs.folds.v1')||'{}');return f['clean-more']===true&&f['chain-eq']===true&&localStorage.getItem('pvs.dockOpen.v1')==='1';}));

 /* ---------- phone ---------- */
 const q=await page(390,844);q.on('dialog',d=>d.accept());await song(q);
 const so=await q.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();const st=document.getElementById('songStudio');return {tools:r('#songStudio > .sg-tools').top,tl:r('#sgTimeline').top,tlEnd:r('#sgTimeline').bottom,takes:r('#songStudio > .sg-takes').top,move:r('#sgMovePart').top,over:st.scrollWidth-st.clientWidth};});
 check('Phone Song & vocals: timeline tools and Move… sit above the tracks',so.tools<so.tl&&so.move<so.tl,so);
 check('Phone Song & vocals: the takes come right under the tracks',so.takes>so.tlEnd&&so.takes-so.tlEnd<140,so);
 check('Phone Song & vocals: no sideways scrolling',so.over<=1,so);
 await polish(q);
 check('Phone: the note editor waits behind a slim editor bar',await q.evaluate(()=>document.getElementById('dock').classList.contains('collapsed')));
 await q.evaluate(()=>scrollTo(0,0));await q.locator('.itabs [data-tab=chain]').click();await q.waitForTimeout(300);
 await q.evaluate(()=>scrollTo(0,document.querySelector('.insp').getBoundingClientRect().top+scrollY+1200));await q.waitForTimeout(300);
 const pin=await q.evaluate(()=>({tabs:document.querySelector('.insp > .itabs').getBoundingClientRect().top,strip:document.querySelector('#page-chain > .ux-listen').getBoundingClientRect().top,over:document.documentElement.scrollWidth-innerWidth}));
 check('Phone: POLISH tabs stay pinned at the top while scrolling',Math.abs(pin.tabs)<=2,pin);
 check('Phone: the listen strip stays pinned under the tabs',pin.strip>=30&&pin.strip<=70,pin);
 check('Phone: no sideways scrolling in POLISH',pin.over<=1,pin);
 await q.locator('.itabs [data-tab=tune]').click();await q.waitForTimeout(300);
 check('Phone TUNE: "Open tuning window" is near the top of the tab',await q.evaluate(()=>{const b=document.getElementById('noteRouteOpen').getBoundingClientRect(),t=document.querySelector('.insp > .itabs').getBoundingClientRect();return b.top-t.bottom<260&&b.height>0;}));
 await q.locator('#noteRouteOpen').click();await q.waitForTimeout(600);
 check('Phone TUNE: it opens the note editor full screen',await q.evaluate(()=>document.getElementById('dock').classList.contains('ww-window')&&!document.getElementById('dock').classList.contains('collapsed')));
 await q.locator('#workWindowClose').click();await q.waitForTimeout(300);
 check('Phone: closing the tuning window puts the editor bar back to slim',await q.evaluate(()=>document.getElementById('dock').classList.contains('collapsed')));
});
