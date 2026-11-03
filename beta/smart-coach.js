/* 0.34.2: Smart Guide as an engineer beside you. It watches where you are and what you change (recording,
   Manual cleanup, CLEAN, tuning, EQ and the vocal chain), checks it against what the app measures and the
   usual safe ranges, and tells you, step by step, what is likely wrong and what usually works better.
   It only reads state and, when you press a fix button, uses the same controls you would. It never changes
   anything by itself. Advice is guidance from measurements and common practice, not a guarantee. */
(function(){
'use strict';
const $=id=>document.getElementById(id),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST=()=>typeof S!=='undefined'?S:null;
const num=v=>Number.isFinite(+v)?+v:null,dbf=x=>x>0?20*Math.log10(x):-120;
const store={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v;}catch(_){return d;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}}};

/* ------------------------------------------------------------------ where you are */
const CTX={
 song:{name:'Song & vocals',stage:0},recording:{name:'Recording',stage:0},cleanup:{name:'Manual cleanup',stage:1},
 clean:{name:'CLEAN · background noise',stage:1},tune:{name:'TUNE · note editor',stage:2},chain:{name:'CHAIN · vocal chain',stage:3},
 detail:{name:'Vocal Detail',stage:3},mix:{name:'MIX · with your beat',stage:4},wave:{name:'WAVE EDIT · breaths and timing',stage:1},ref:{name:'Compare with a reference',stage:4}};
const STAGES=['Record','Clean','Tune','Chain','Finish'];
function frameDoc(){try{return $('noteEditorFrame')?.contentDocument||null;}catch(_){return null;}}
function frameWin(){try{return $('noteEditorFrame')?.contentWindow||null;}catch(_){return null;}}
function songState(){try{return window.SongStudio?.state?.()||{};}catch(_){return {};}}
function cleanupOpen(){const m=$('vocalEditor');return !!(m&&!m.hidden&&m.classList.contains('song-cleanup'));}
function context(){
 if(cleanupOpen())return 'cleanup';
 const ss=songState();
 if(window.RC?.step!=='polish'){return ss.recording||ss.starting?'recording':'song';}
 const ww=window.WorkWindows?.state?.();
 if(ww?.open)return ww.mode==='notes'?'tune':ww.mode==='wave'?'wave':ww.mode==='ref'?'ref':'song';
 const dock=$('dock'),dockOpen=dock&&!dock.classList.contains('collapsed');
 const tab=window.DAW?.tab||'clean';
 if(tab==='tune'||(dockOpen&&window.DAW?.dock==='notes'&&lastPointerIn==='dock'))return 'tune';
 if(dockOpen&&lastPointerIn==='dock')return window.DAW?.dock==='wave'?'wave':window.DAW?.dock==='ref'?'ref':'tune';
 return CTX[tab]?tab:'clean';
}
let lastPointerIn='';
document.addEventListener('pointerdown',e=>{lastPointerIn=e.target.closest?.('#dock')?'dock':e.target.closest?.('.insp')?'insp':'';},true);

/* ------------------------------------------------------------------ how each part works */
const HOW={
 song:{what:'Where you record, choose your best takes and arrange the song before polishing.',steps:['Load your riddim (INSTRUMENTAL → Load backing).','Arm the vocal track and press Record (R). Press R again while playing to punch in.','Record a few takes of each part. ★ your favourites, then Choose the best one in the takes list.','Fix a word: drag over it on the vocal lane, then Fix selected phrase.','Hear a noise? Press Clean up here (N) at that moment, or right-click the recording.','When every part sounds right, press 2 POLISH.'],listen:'Listen with the backing at the level you will mix at. Judge timing and feeling first; tuning and cleaning come later.',mistakes:['Recording with the beat playing through speakers: it leaks into the mic. Use headphones.','Recording too hot: a red CLIP means distortion that cannot be repaired. Back off and record again.','Fixing pitch by re-recording endlessly: get the feeling right, the tuner handles small pitch slips.']},
 recording:{what:'The mic is live and your take is being recorded on the armed track.',steps:['Sing at your normal performance level; the Mic meter should move well into the bar without CLIP.','Press Record (or R) again to stop and keep the take.','Listen back before recording the next take.'],listen:'Watch the Mic meter: busy in the upper half on loud lines, never CLIP.',mistakes:['Mic too far: a thin, roomy sound that cleaning cannot fix.','Mic too close or too loud: CLIP and pops. Move back a hand-width and turn the input down.','Headphones too loud: they bleed into the mic.']},
 cleanup:{what:'Manual cleanup removes or lowers one sound in a short stretch (a breath, a click, a gust) without touching the rest of the take. Your original stays; the result is saved as a new take.',steps:['Make the selection tight around the sound (drag on the waveform). Shorter is safer.','Choose Reduce a breath, Rumble under voice (low gusts/thumps, 0–100 Hz) or Frequency band.','Start with 6 dB for a breath. Edge fade and frequency limits are in Advanced.','Compare Before, After and Hear removed at the same level.','Hear removed should contain only the unwanted sound. If you hear words, reduce less or narrow the selection.','Keep as new take saves it; Undo returns the old take.'],listen:'Play a little before and after the selection: the edit should be invisible in context.',mistakes:['Selecting across a sung word: the word loses body. Keep the selection in the gap, or reduce only 3–4 dB.','Removing every breath: the vocal sounds unnatural. Lower breaths 6–10 dB instead.','Selections over 30 seconds: use POLISH → CLEAN for whole-take noise.']},
 clean:{what:'Studio Spectral removes steady background noise (hiss, fan, room hum) from the whole vocal. It cannot remove a beat or other voices; Beat bleed reduces the backing that leaked into the mic.',steps:['Listen to BEFORE first: decide whether the background is actually a problem.','Turn on Enable noise removal and start with Gentle · 6 dB.','Press REMOVED NOISE: you should hear only hiss or room, never words.','Raise to Balanced or Strong only while REMOVED stays free of your voice and the safety meter stays green.','Singing quiet passages? Use Where to clean: Pauses only, so the singing is left exactly as recorded.','Backing heard in the mic? Try Beat bleed: Gentle.','For strong cleaning, open More cleaning controls and Learn the noise from a quiet moment with no singing.'],listen:'Compare BEFORE and CLEANED at the same volume, then REMOVED NOISE. Cleaner is not better if the voice loses air or sounds watery.',mistakes:['Max reduction too high: watery, swirly voice and lost breath detail.','Learning a noise sample that contains singing or music: the cleaner then removes your voice.','Trying to clean a beat out of the vocal with Studio Spectral: use Beat bleed, or record with headphones.']},
 tune:{what:'The note editor shows every sung note on a piano roll and tunes them to the key: a preset tunes the whole vocal, then you fix single notes.',steps:['Check the key line under KEY: if your singing sounds like another key, use the detected key.','On the Tune tab choose a preset: Natural Roots for natural reggae, Gentle Polish for light, Tight Modern for tight, Hard Effect for the auto-tune sound.','Check tab → Correction map: red notes are moved over 50¢ and may sound tuned.','Tap a note to fix it on the Note tab: Snap to key, ±10¢, drift and vibrato.','Compare Cleaned input and Tuned, then TUNED in the studio with your beat.'],listen:'Long held notes and slides show tuning first. If it sounds robotic, the preset is too strong or the note is far off.',mistakes:['Tuning in the wrong key: notes jump to wrong pitches. Fix the key before any preset.','Forcing far-off notes onto the key: re-record that phrase instead (Fix phrase).','Removing all vibrato: sounds synthetic. Keep vibrato 70–100%.']},
 chain:{what:'The vocal chain is your mix processing: EQ (tone), compression (even level), de-ess, warmth, echo and reverb (space), then level and limiter. It is heard on FINAL.',steps:['Pick the preset closest to your style (Roots Reggae is made for this).','Listen with FINAL against TUNED to hear what the chain adds.','EQ small moves: cut what is ugly before boosting. Most good vocal EQ moves are within ±3 dB.','Compression: just enough that words stay steady; Peak control catches sudden loud words.','Space: echo and reverb behind the voice, not on top of it. Echo duck keeps words clear.','Set VOCAL LEVEL and keep the limiter on with a −1 dB ceiling.'],listen:'Judge with the beat at mix level. Switch FINAL/TUNED often so your ears do not get used to too much processing.',mistakes:['Big EQ boosts (over +6 dB): harsh, boomy or hissy and the noise comes up with them.','Heavy compression: flat, lifeless and breaths become loud.','Too much reverb or echo: words blur and the vocal sits far behind the beat.']},
 detail:{what:'Vocal Detail adds five optional effects: click/plosive repair, gentle de-reverb, precision dynamic EQ, reverb ducking and a doubler. All start bypassed.',steps:['Turn on one effect at a time.','Prepare A/B, then compare A: bypassed and B: enabled at matched volume.','Use Hear removed on repair and de-reverb: it should contain only clicks or room tail.','Keep an effect only if B is clearly better; check Mono after the doubler.'],listen:'If you cannot hear a clear improvement in A/B, leave the effect off.',mistakes:['Turning on all five at once: you cannot tell what helps.','A loud doubler: phasey, wide sound that collapses in mono.']},
 mix:{what:'Monitor levels and Fit the beat to my vocal set how loud the beat sits under your finished vocal.',steps:['Set your monitor faders to taste (they do not change exports).','Fit the beat to my vocal sets the beat so your vocal sits just above it and dips the beat\'s word range while you sing.','Listen to the whole song, then export.'],listen:'Words should be clear at low playback volume without the vocal sounding pasted on top.',mistakes:['Judging the mix only on headphones or only loud: check quiet and on a phone speaker.']},
 wave:{what:'WAVE EDIT changes the performance: lower breaths, nudge timing, and swap passages from other takes.',steps:['Breaths: Find all breaths, listen to each, keep ticked only real breaths, then Reduce ticked breaths (start 6 dB).','Timing: select a word and move it a few ms or stretch it slightly.','Takes / Comp: replace a passage with a better one from another take.'],listen:'Breaths should get quieter, not disappear; timing moves should be small.',mistakes:['Reducing consonants (S, F, T) by mistake: listen to every suggestion first.','Removing breaths completely: unnatural, gasping vocal.']},
 ref:{what:'Compare your vocal with a finished reference vocal at matched volume.',steps:['Choose reference audio (a solo vocal you like).','Pick similar sung passages and Prepare matched comparison.','Switch A and B and note tone and level differences.'],listen:'Compare tone and space, not loudness; the comparison is volume-matched.',mistakes:['Comparing against a full mix instead of a solo vocal.']}};

/* ------------------------------------------------------------------ explain a control */
const EXPLAIN={
 sgPlay:'Play or pause the current mix at the playhead. Mute, Solo and With backing apply.',sgStop:'Stops recording or playback. Use Go to song start to return to the beginning.',sgRecord:'Records the armed vocal track from the playhead (R). Press while playing to punch in.',sgCleanHere:'Opens Manual cleanup at the spot you are hearing, with about one second selected (N). Right-click a recording does the same there.',sgQuickFix:'Records only the selected word or phrase again.',sgJumpVocal:'Scrolls to the armed vocal track.',sgTempo:'Song tempo, time signature and key.',sgClick:'Metronome click while recording (C).',sgMonitor:'HEAR ME: hear your mic in the headphones while you record. Use headphones only.',sgMeter:'Mic level while recording: aim for the upper half on loud lines, never CLIP.',sgMove:'Move parts: drag recordings left or right in time. Shift+drag moves the whole track.',sgMovePart:'Move a part or track by an exact amount (beats or seconds).',sgAddSection:'Adds a label (Verse, Chorus…) across every track. Recordings are not changed.',sgAddTrack:'Adds another vocal track (harmony, double, ad-libs).',sgImport:'Imports an audio file onto the armed track.',sgLoadBeat:'Loads your riddim / instrumental.',
 noiseEnabled:'Turns Studio Spectral noise removal on or off for this vocal.',noiseReduction:'Maximum reduction: how far noise can be pushed down. 6 dB is gentle, 10 balanced, 15 strong. Higher risks a watery voice.',noiseScope:'Everywhere cleans all of the vocal; Pauses only protects detected singing and fades the cleaning in between phrases. Listen for quiet word endings.',noiseBleed:'Reduces the backing track that leaked into the mic, using the loaded backing as a reference.',noiseAi:'Blends in an AI voice isolator (trained on speech). Start at 25%; listen for a watery or lisping voice.',noiseLearn:'Learns the background from the selected quiet stretch (no singing, words or music).',noiseFind:'Finds the quietest stretch automatically to learn from.',noiseSample:'Plays the selected noise sample so you can check it has no singing in it.',noiseUndo:'Undoes the last cleaning change.',noiseSensitivity:'Noise threshold: raise only if noise remains; lower if quiet vocal detail disappears.',noiseHighpass:'Removes rumble below this frequency. Keep low (60–80 Hz) so low notes keep their body.',noiseHum:'Removes mains hum at 50 or 60 Hz and its harmonics. Only use if you hear a steady hum.',noiseRoomSave:'Saves the learned noise as a room profile to reuse for takes recorded in the same room.',
 cleanListen:'BEFORE: as recorded · CLEANED: after noise removal · REMOVED NOISE: only what was taken out (should be background only).',abSeg:'What you hear: BEFORE (raw), CLEANED, TUNED (after the note editor) or FINAL (with the vocal chain).',
 presetSeg:'Vocal chain presets: a full starting point for EQ, compression, echo and reverb.',chainOn:'Turns the whole vocal chain on or off (FINAL vs TUNED).',eqCanvas:'EQ: drag a coloured point. Left/right = frequency, up/down = boost/cut. Small moves (±3 dB) usually sound best.',dynKnobs:'Peak control, compression, de-ess and warmth: how steady and smooth the vocal is.',eq2On:'Second EQ: final tone touch after compression. Keep within ±3 dB.',limitOn:'Output limiter keeps peaks under the ceiling. Leave it on with −1 dB.',
 playBtn:'Plays this vocal with its fitted backing (Space).',dawLoop:'Loops the selected region for listening (L).',noteRouteOpen:'Opens the note editor in a large tuning window.',polishSong:'Plays every vocal lane with the backing and song mixer.',polishExportSong:'Exports the song, the vocal mix, stems or this vocal.',
 sepMode:'What you are removing: a breath between words, a low rumble under the voice, or a chosen frequency band.',sepDb:'How much the selected sound is lowered. Start at 6 dB; above 12 dB risks a hole in the sound.',sepFade:'Edge fade in ms so the edit has no click. 10 ms is a good start.',sepOriginal:'Plays the selection as it was.',sepEdited:'Plays your edit at the same monitor gain.',sepRemoved:'Plays only what your edit removes. It should contain no words.',sepKeep:'Saves the result as a new take; the original stays.',sepLoop:'Repeats the region so you can adjust while listening.',sepInspect:'Shows a spectrogram; drag a rectangle to pick time and frequency.',sepFind:'Jumps to the next likely breath. Always confirm by ear.',
 presetRoots:'Natural Roots: natural tuning that keeps your vibrato and slides.',presetGentle:'Gentle Polish: light tuning, most of your natural pitch kept.',presetTight:'Tight Modern: tight, modern tuning.',presetHard:'Hard Effect: the deliberate auto-tune sound.',snapAll:'Snaps every note to the key.',key:'Song key used for tuning. Must match your song.',scale:'Major, minor or all notes.',refMode:'What the notes are tuned against: the backing\'s tuning, A = 440, or your own singing.',corrMap:'Colours each note by how far tuning moved it: green < 20¢, amber 20–50¢, red > 50¢ (audible).',chordShow:'Shows the riddim\'s chords under the ruler.',chordFit:'Moves doubtful notes to the nearest chord tone.',cmpStart:'Blind compare: hear presets without knowing which is which, then keep the best.',lockMan:'Keeps notes you tuned by hand when applying a preset.',nSnap:'Snaps the selected note to the key.',levApply:'Evens out loud and quiet notes (up to ±6 dB).',quantize:'Moves note starts onto the beat grid.'};
function explainFor(el){
 for(let e=el;e&&e!==document.body;e=e.parentElement){
  if(e.id&&EXPLAIN[e.id])return EXPLAIN[e.id];
  if(e.dataset?.noisePreset)return 'Noise removal preset: Gentle 6 dB, Balanced 10 dB or Strong 15 dB. Start Gentle.';
  if(e.dataset?.mode&&e.closest?.('#abSeg,.ux-listen,#cleanListen'))return EXPLAIN.abSeg;
  if(e.dataset?.tab&&e.closest?.('.itabs'))return 'POLISH steps: CLEAN (noise) → TUNE (pitch) → CHAIN (mix sound) → DETAIL (extra effects) → MIX (with the beat).';
  if(e.matches?.('button,label,select,input,[role=slider],canvas,summary')){const t=e.getAttribute('title')||e.getAttribute('aria-label');if(t)return t;const l=e.closest('label')?.textContent?.trim()||e.textContent?.trim();if(l)return l.replace(/\s+/g,' ').slice(0,140);}
 }
 return '';
}

/* ------------------------------------------------------------------ what you did */
const log=[];const MAXLOG=12;
function describe(el,doc){
 const id=el.id||el.closest?.('[id]')?.id||'';
 let label=(el.matches?.('select')?(el.closest('label')?.querySelector('span')?.textContent||id)+': '+(el.options[el.selectedIndex]?.text||el.value):el.matches?.('input[type=range]')?((el.closest('label')?.childNodes[0]?.textContent||el.getAttribute('aria-label')||id).trim()+' → '+el.value):el.matches?.('input[type=checkbox]')?((el.closest('label')?.textContent||id).trim()+(el.checked?' on':' off')):(el.textContent||el.getAttribute('aria-label')||id)).replace(/\s+/g,' ').trim();
 if(!label)return null;return {t:Date.now(),id,text:label.slice(0,90),ctx:context(),editor:doc!==document};
}
function track(e,doc){const el=e.target.closest?.('button,select,input,[role=slider]');if(!el||el.closest('#coachPanel,#coachToast,#guideSheet'))return;const d=describe(el,doc);if(!d)return;log.unshift(d);log.length=Math.min(log.length,MAXLOG);changed.add(d.id);visited.add(d.ctx);soon();}
for(const t of ['click','change'])document.addEventListener(t,e=>track(e,document),true);
const changed=new Set(),visited=new Set();

/* ------------------------------------------------------------------ the checks */
const P=()=>ST()?.P||{},M=()=>(ST()?.guide&&S.guide.valid&&S.guide.measured)||null;
const polished=()=>window.RC?.step==='polish'&&!!window.SongPolish?.state?.().binding&&!!ST()?.final?.length;
const nc=()=>{try{return window.NoiseCleaner?.active()?{s:NoiseCleaner.state(),d:NoiseCleaner.debug()}:null;}catch(_){return null;}};
const BANDS=[['chEq0Gain','LOW (body, ~180 Hz)'],['chEq1Gain','LOW-MID (mud, ~350 Hz)'],['chEq2Gain','HIGH-MID (presence, ~3 kHz)'],['chEq3Gain','HIGH (air, ~11 kHz)']];
const act=(label,run)=>({label,run});
function setChain(id,v){if(typeof setP==='function'){setP(id,v);try{syncControls();}catch(_){}}}
function rules(){
 const out=[],add=(id,level,stage,title,text,actions=[])=>out.push({id,level,stage,title,text,actions}),c=context(),ss=songState(),p=P(),m=M();
 /* --- recording --- */
 if(ss.recording&&$('sgClip')?.textContent==='CLIP')add('rec-clip','warn',0,'Your mic is clipping','The recording is louder than the maximum, which causes distortion that cannot be repaired later. Move back a hand-width or turn the mic input down, then record that line again (Fix phrase).');
 if(ss.recording){const pk=+($('sgMeter')?.value||0);peaks.push(pk);if(peaks.length>12)peaks.shift();if(peaks.length>=8&&Math.max(...peaks)<.05)add('rec-quiet','tip',0,'The mic level is very low','Your loudest moments are under −26 dBFS. Sing closer to the mic (about a hand-width) or raise the input, so the voice is well above the room noise; quiet recordings bring up hiss when processed.');}else peaks.length=0;
 if(c==='recording'&&$('sgMonitor')?.getAttribute('aria-pressed')==='true')add('rec-monitor','tip',0,'HEAR ME is on','Use headphones while HEAR ME is on, or your voice comes back out of the speakers into the mic and can feed back.');
 if((c==='song'||c==='recording')&&!ST()?.beat&&ST()?.song?.tracks?.some(t=>t.regions?.length))add('song-beat','tip',0,'Load your riddim','With the backing loaded, tuning can match its tuning and key, cleaning can remove beat bleed, and you judge the vocal in context.',[act('Load backing',()=>$('sgLoadBeat')?.click())]);
 const room=($('sgRoom')?.textContent||'').match(/(\d+)\s*min/);if(room&&+room[1]<3&&(c==='song'||c==='recording'))add('song-room','warn',0,'Little recording room left','About '+room[1]+' min of recording fits in this browser. Back up the project and remove takes you do not need (Project storage).');
 if(c==='song'){const w=ST()?.song,t=w?.tracks?.find(x=>x.id===w.activeTrack);const many=t?.regions?.find(r=>r.takes.length>=3&&!r.takes.some(a=>a.rating));if(many)add('song-takes','tip',0,'Several takes, none starred yet','Listen to each take of this part, star the ones you like, then Choose the best. Why suggested? ranks them by pitch steadiness, level and clipping.');}
 /* --- manual cleanup --- */
 if(c==='cleanup'){const a=num($('veA')?.value),b=num($('veB')?.value),db=num($('sepDb')?.value),mode=$('sepMode')?.selectedIndex||0;
  if(a!=null&&b!=null&&b-a>30)add('mc-long','warn',1,'Selection too long for Manual cleanup','Manual cleanup handles up to 30 seconds. For noise across the whole take use POLISH → CLEAN.');
  const v=a!=null&&b!=null&&b>a?voicedShare(a,b):null;
  if(v!=null&&v>.35&&db>4)add('mc-voice','warn',1,'This selection covers singing','About '+Math.round(v*100)+'% of the selection is sung. Reducing '+db+' dB here will thin the word. Narrow the selection to the gap, or keep the reduction to 3–4 dB and check Hear removed for words.',[act('Set 4 dB',()=>setRange('sepDb',4))]);
  else if(v!=null&&v<.1&&b-a<1.5&&mode===0)add('mc-breath','ok',1,'Looks like a breath or gap','This selection looks mostly unvoiced. Try 6 dB and listen to Hear removed. If you hear part of a word, lower the reduction or shorten the selection.');
  if(db>12)add('mc-deep','tip',1,'Reduction is strong','Over 12 dB can leave a hole or a click. Most breaths sound natural lowered 6–10 dB.',[act('Set 8 dB',()=>setRange('sepDb',8))]);
  if(mode===1&&db>8)add('mc-rumble','tip',1,'Rumble under voice','For a gust or thump under a word, 0–100 Hz with about 4 dB is usually enough; more takes the warmth out of low notes.');}
 /* --- CLEAN --- */
 const n=nc();
 if(n&&polished()){const s=n.s,res=n.d.result,saf=res?.safety,gap=m?.gapValid?m.gapContrast:null,noise=res?.profile?.noiseDb;
  if(s.on&&saf&&saf.hasVoice&&(saf.voice<-1||saf.voiceRemoved>-15))add('cl-voice','warn',1,'Cleaning is eating into your singing','The voice changed '+saf.voice.toFixed(1)+' dB and the removed sound sits only '+Math.abs(saf.voiceRemoved).toFixed(0)+' dB below it. Lower Maximum reduction, or clean Pauses only so the singing stays as recorded.',[act('Gentle · 6 dB',()=>clickSel('[data-noise-preset="gentle"]')),act('Pauses only',()=>setSel('noiseScope','pauses'))]);
  if(!s.on&&gap!=null&&gap<35)add('cl-off-noisy','warn',1,'Background is close to your voice','The background is only '+Math.round(gap)+' dB below your singing, so it will be heard in the mix. Turn on noise removal (start Gentle), then check REMOVED NOISE.',[act('Turn on · Gentle',()=>{if(!$('noiseEnabled')?.checked)$('noiseEnabled')?.click();setTimeout(()=>clickSel('[data-noise-preset="gentle"]'),300);})]);
  if(s.on&&gap!=null&&gap<40&&s.reduction<10&&!(saf&&(saf.voice<-1||saf.voiceRemoved>-15)))add('cl-weak','tip',1,'Background may still be audible','After cleaning the background is about '+Math.round(gap)+' dB below your voice (aim for 45 dB or more). Try Balanced · 10 dB, or Learn the noise from a quiet moment for a more accurate print.',[act('Balanced · 10 dB',()=>clickSel('[data-noise-preset="balanced"]'))]);
  if(s.on&&((gap!=null&&gap>=55)||(noise!=null&&noise<-75))&&s.reduction>=10)add('cl-strong','tip',1,'The background is already very quiet','Strong cleaning here can only cost voice detail. Gentle (6 dB) or off is usually enough.',[act('Gentle · 6 dB',()=>clickSel('[data-noise-preset="gentle"]'))]);
  if(s.on&&s.reduction>15)add('cl-max','warn',1,'Maximum reduction is very high','Above 15 dB the voice often turns watery or swirly. Keep it at or below 15 dB and use Pauses only if the gaps still need more.',[act('Set 12 dB',()=>setRange('noiseReduction',12))]);
  if(s.ai>=.5)add('cl-ai','tip',1,'AI isolation blend is high','The AI isolator was trained on speech. On singing it can sound watery or lisp on S sounds. Compare at 25%.',[act('Blend 25%',()=>setSel('noiseAi','0.25'))]);
  if(s.bleed>0&&res?.plus?.bleed?.skipped)add('cl-bleed-skip','tip',1,'Beat bleed could not run',res.plus.bleed.skipped);
  else if(s.bleed>0&&res?.plus?.bleed&&res.plus.bleed.coherence<.3)add('cl-bleed-low','tip',1,'Little beat bleed found','The backing matched the mic only '+Math.round(res.plus.bleed.coherence*100)+'%. Beat bleed is unlikely to help; turn it off if REMOVED NOISE contains voice.');
  if(s.on&&s.reduction>=10&&(!s.profile||s.profile.kind!=='manual')&&c==='clean')add('cl-learn','tip',1,'Teach the cleaner your room','For stronger cleaning, select 0.5–3 s with no singing or music under More cleaning controls and press Learn selected noise. An accurate noise print removes more noise with less damage.');
  if(c==='clean'&&recent(['noiseReduction','noiseEnabled','noiseScope','noiseBleed','noiseAi','noiseLearn'])&&!recent(['cleanListen']))add('cl-listen','tip',1,'Listen to what you removed','After changing cleaning, press REMOVED NOISE: it should be only hiss or room. Any words or music in it means the cleaning is too strong.',[act('REMOVED NOISE',()=>clickSel('#cleanListen [data-mode="removed"]'))]);}
 /* --- TUNE --- */
 const fd=frameDoc(),fw=frameWin();
 if(fd&&window.NoteTuner?.enabled?.()&&polished()){
  const kh=fd.getElementById('presetKeyHint');if(kh?.classList.contains('keywarn'))add('tu-key','warn',2,'Check the key',kh.textContent.replace(/^⚠\s*/,'')+' Tuning in the wrong key moves notes to wrong pitches.',fd.getElementById('useDetectedKey')&&!fd.getElementById('useDetectedKey').hidden?[act(fd.getElementById('useDetectedKey').textContent.trim(),()=>fd.getElementById('useDetectedKey').click())]:[]);
  try{const an=fw.PlaybookNoteEditor.analysis(),tp=fw.PlaybookTuningPlus;if(an?.notes?.length&&tp){let heavy=0;for(let i=0;i<an.notes.length;i++){const v=tp.corrOf(i);if(v>=50)heavy++;}
   if(heavy&&heavy/an.notes.length>.15)add('tu-heavy','tip',2,heavy+' notes are moved a lot','Over 15% of your notes are pulled 50¢ or more, where tuning starts to be heard. Check the Correction map; for the reddest phrases, re-recording (Fix phrase) often sounds more natural than forcing them.',[act('Show correction map',()=>{fw.PlaybookUX?.show('check');const b=fd.getElementById('corrMap');if(b&&b.getAttribute('aria-pressed')!=='true')b.click();})]);}}catch(_){}
  const rw=fd.getElementById('refWarn');if(rw&&!rw.hidden&&rw.textContent.trim())add('tu-ref','tip',2,'Tuning reference',rw.textContent.trim().slice(0,220));
  const mode=fd.getElementById('autoMode'),kn=fd.getElementById('knob');if(mode?.value==='classic'&&+(kn?.getAttribute('aria-valuenow')||0)>=90)add('tu-hard','ok',2,'Hard tune sound','Classic Smooth near 100% is the deliberate auto-tune effect. For a natural reggae vocal choose Natural Roots instead.');}
 /* --- CHAIN and EQ --- */
 if(polished()&&p&&('chEq0Gain' in p)){
  const chainCtx=c==='chain'||c==='detail'||c==='mix';
  if(+p.chainOn!==1&&chainCtx)add('ch-off','tip',3,'The vocal chain is off','FINAL now sounds like TUNED: no EQ, compression or space. That suits a dry stem for another engineer; for a finished vocal turn the chain on.',[act('Turn chain on',()=>{if(!$('chainOn')?.checked)$('chainOn')?.click();})]);
  if(+p.chainOn===1){
   for(const [k,name] of BANDS){const g=+p[k];if(g>6)add('eq-boost-'+k,'warn',3,'Big EQ boost on '+name,'+'+g.toFixed(1)+' dB is a lot. Large boosts make the vocal '+(k==='chEq0Gain'?'boomy':k==='chEq1Gain'?'muddy and boxy':k==='chEq2Gain'?'harsh and edgy':'hissy and sibilant')+' and lift the noise with it. Most good vocal moves stay within ±3 dB; cut elsewhere instead of boosting a lot.',[act('Set +3 dB',()=>setChain(k,3))]);
    else if(g>4)add('eq-mid-'+k,'tip',3,'Strong EQ boost on '+name,'+'+g.toFixed(1)+' dB. Check it with the beat: if the vocal starts to sound '+(k==='chEq2Gain'?'sharp on S and T':k==='chEq3Gain'?'hissy':k==='chEq0Gain'?'boomy':'muddy')+', bring it back toward +2–3 dB.');
    if(g<-8)add('eq-cut-'+k,'tip',3,'Deep EQ cut on '+name,g.toFixed(1)+' dB removes a lot of '+(k==='chEq0Gain'?'body and warmth: the vocal can turn thin':k==='chEq1Gain'?'fullness; a −2 to −5 dB cut is usually enough to clear mud':k==='chEq2Gain'?'clarity: words can sound dull and far away':'air: the vocal can sound dull')+'.',[act('Set −4 dB',()=>setChain(k,-4))]);}
   if(+p.chEq0Gain>3&&+p.chEq1Gain>0)add('eq-mud','tip',3,'Low end is building up','Both LOW and LOW-MID are boosted, which usually makes a vocal muddy against a reggae bass line. Cut LOW-MID a little (−2 to −4 dB).');
   if(+p.chEq2Gain>3&&+p.chDeEss<4)add('eq-sss','tip',3,'Presence boost with little de-ess','A HIGH-MID boost brings up S and T sounds. Raise De-ess a little or reduce the boost.');
   if(+p.chEq3Gain>3&&m?.gapValid&&m.gapContrast<45)add('eq-air-noise','tip',3,'Air boost lifts the background','The background is only '+Math.round(m.gapContrast)+' dB below the voice; boosting HIGH also lifts the hiss. Clean first, or boost less.');
   if(+p.chLowCut>140)add('eq-lowcut','tip',3,'Low cut is high','A low cut above 140 Hz can make a reggae vocal thin. 70–110 Hz removes rumble but keeps chest.');
   for(const k of ['chToneBodyGain','chToneMidGain','chToneHighGain'])if(Math.abs(+p[k])>4&&!+p.chToneBypass)add('eq2-'+k,'tip',3,'Second EQ move is large',k.replace('chTone','').replace('Gain','')+' '+(+p[k]).toFixed(1)+' dB. The second EQ is a final touch; keep it within ±3 dB and do bigger tone work in the first EQ.');
   if(+p.chCompress>.75)add('dy-comp','warn',3,'Heavy compression','Compression at '+Math.round(p.chCompress*100)+'% flattens the performance and makes breaths and noise loud. Try 40–60% with Peak control catching the loud words.',[act('Set 55%',()=>setChain('chCompress',.55))]);
   if(+p.chPeak>.85)add('dy-peak','tip',3,'Peak control very high','Peak control is meant to catch only sudden loud words. Very high settings squash every word; 40–60% is typical.');
   if(+p.chDeEss>10)add('dy-ess','tip',3,'Strong de-ess','Over 10 dB of de-ess can make S sounds lisp. Lower it until S is smooth but still clear.');
   if(+p.chWarmth>.7)add('dy-warm','tip',3,'A lot of warmth','High warmth (saturation) adds grit and can sound distorted on loud notes. Try 25–45%.');
   if(+p.chReverb>.35)add('sp-verb','tip',3,'A lot of reverb','Reverb at '+Math.round(p.chReverb*100)+'% pushes the vocal back and blurs words. Pull it down or use Reverb ducking in Vocal Detail.');
   if(+p.chEcho>.35&&+p.chEchoDuck<.3)add('sp-echo','tip',3,'Loud echo without ducking','Echoes this loud fight your words. Raise Echo duck (50–70%) so they bloom in the gaps, the dub way.',[act('Echo duck 60%',()=>setChain('chEchoDuck',.6))]);
   if(+p.chLimitBypass)add('lv-limit-off','warn',3,'The output limiter is off','Peaks can clip on export and on streaming. Turn it on with a −1 dB ceiling.',[act('Limiter on',()=>{if(!$('limitOn')?.checked)$('limitOn')?.click();})]);
   else if(+p.chLimitCeiling>-.5)add('lv-ceiling','warn',3,'Limiter ceiling too close to 0 dB','Streaming conversion can clip peaks above −1 dBTP. Set the ceiling to −1 dB.',[act('Ceiling −1 dB',()=>setChain('chLimitCeiling',-1))]);
   if(+p.chLevel<-22)add('lv-low','tip',3,'Vocal level is low','VOCAL LEVEL '+p.chLevel+' LUFS is quiet for a finished vocal; around −18 to −14 LUFS is typical before the mix.');
   if(+p.chLevel>-11)add('lv-high','tip',3,'Vocal level is very loud','VOCAL LEVEL '+p.chLevel+' LUFS makes the limiter work hard and squashes the vocal. Around −16 LUFS leaves room for the mix.');
   if(+p.chDoubleOn&&+p.chDoubleMix>30)add('dt-double','tip',3,'Doubler is loud','A loud doubler sounds phasey and can vanish in mono. Keep the blend low and use Check mono.');
   if(m&&m.wordSpread>12)add('dy-spread','tip',3,'Loud and quiet words differ a lot','Your words vary about '+Math.round(m.wordSpread)+' dB. Try Word leveling 20–30%, or lift single quiet words with Phrase volume on Song & vocals.');}
  // Measured tips from the original guide that apply to the current tuner.
  for(const t of (ST()?.guide?.enabled&&S.guide.tips)||[]){if(t.stage===2&&window.NoteTuner?.enabled?.())continue;if(t.stage===3||t.stage===1)add('engine-'+t.title,'tip',t.stage,t.title,t.reason||'',[act('Open this tip',()=>openLegacy())]);}
 }
 return out;
}
const peaks=[];
function recent(ids,ms=60000){const now=Date.now();return log.some(x=>now-x.t<ms&&ids.some(i=>x.id===i||x.id.startsWith(i)));}
function setRange(id,v){const e=$(id);if(!e)return;e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}
function setSel(id,v){const e=$(id);if(!e)return;e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}
function clickSel(s){document.querySelector(s)?.click();}
function voicedShare(a,b){
 const edit=window.Studio?.state(),song=ST()?.song;if(!edit||!song)return null;
 const track=SongCore.track(song),region=track?.regions.find(r=>r.id===edit.pid),take=region?.takes.find(t=>t.id===edit.tid);
 if(!take)return null;const [lo,hi]=SongCore.takeSpan(song,take);
 if(a<Math.max(region.start,lo/song.rate)-1/song.rate||b>Math.min(region.end,hi/song.rate)+1/song.rate)return null;
 return BreathFind.voicedShare(song.sources[take.source],a-SongCore.origin(take),b-SongCore.origin(take));
}
/* ------------------------------------------------------------------ quality outlook */
const R3=['Good','Fair','At risk'];
function outlook(){
 if(!polished())return null;const p=P(),m=M(),rows=[],r=(area,lvl,why)=>rows.push({area,lvl,why});
 // Recording: peaks of the processed input
 try{const ch=S.audio?.[0]||[S.main];let pk=0;for(const c of ch)for(let i=0;i<c.length;i+=7){const v=Math.abs(c[i]);if(v>pk)pk=v;}const d=dbf(pk);
  r('Recording level',pk>=.999?2:d<-24?1:0,pk>=.999?'Clipped while recording: distortion stays. Re-record the loudest lines.':d<-24?'Recorded quietly (peaks '+d.toFixed(0)+' dBFS): noise rises when processed.':'Healthy recording level (peaks '+d.toFixed(0)+' dBFS).');}catch(_){}
 if(m?.gapValid)r('Background noise',m.gapContrast>=45?0:m.gapContrast>=30?1:2,'Background '+Math.round(m.gapContrast)+' dB below your voice'+(m.gapContrast>=45?'.':m.gapContrast>=30?': audible in quiet parts. Cleaning helps.':': clearly audible. Clean it; some may remain.'));
 const n=nc(),saf=n?.d.result?.safety;if(n?.s.on&&saf?.hasVoice)r('Cleaning safety',saf.voice<-1||saf.voiceRemoved>-15?2:saf.voiceRemoved>-22?1:0,saf.voice<-1||saf.voiceRemoved>-15?'Cleaning is touching your singing.':'Cleaning leaves your singing intact.');
 if(m)r('Even volume',m.wordSpread<=8?0:m.wordSpread<=14?1:2,'Loud vs quiet words: '+Math.round(m.wordSpread)+' dB.');
 try{const fw=frameWin(),an=fw?.PlaybookNoteEditor?.analysis(),tp=fw?.PlaybookTuningPlus;if(an?.notes?.length&&tp){let h=0;for(let i=0;i<an.notes.length;i++)if(tp.corrOf(i)>=50)h++;const f=h/an.notes.length;r('Tuning',f<=.05?0:f<=.15?1:2,h?h+' of '+an.notes.length+' notes moved 50¢ or more'+(f>.15?': tuning will be heard.':'.'):'All notes sit close to their targets.');}}catch(_){}
 if(+p.chainOn===1){let risk=0,why=[];const big=BANDS.filter(([k])=>+p[k]>6);if(big.length){risk=Math.max(risk,2);why.push('big EQ boost');}else if(BANDS.some(([k])=>+p[k]>4)){risk=Math.max(risk,1);why.push('strong EQ boost');}
  if(+p.chCompress>.75){risk=Math.max(risk,1);why.push('heavy compression');}if(+p.chReverb>.35||+p.chEcho>.45){risk=Math.max(risk,1);why.push('a lot of space');}if(+p.chLimitBypass||+p.chLimitCeiling>-.5){risk=Math.max(risk,2);why.push('limiter');}
  r('Vocal chain',risk,why.length?'Watch: '+why.join(', ')+'.':'Settings are in sensible ranges.');}
 else r('Vocal chain',1,'Chain off: dry sound.');
 if(m&&Number.isFinite(m.lufs))r('Final level',m.lufs>-11?1:m.lufs<-24?1:0,'Finished vocal at '+m.lufs.toFixed(1)+' LUFS.');
 const worst=Math.max(0,...rows.map(x=>x.lvl)),main=rows.filter(x=>x.lvl===worst&&worst>0).map(x=>x.area.toLowerCase());
 return {rows,overall:worst,summary:worst===0?'Good chance of a clean, release-ready vocal. Keep checking with your beat.':worst===1?'Fair chance: '+main.join(' and ')+' could hold it back.':'At risk: fix '+main.join(' and ')+' first for a good result.'};
}

/* ------------------------------------------------------------------ next step */
function nextStep(){
 const w=ST()?.song,has=w?.tracks?.some(t=>t.regions?.length),c=context();
 if(!has)return 'Record or import a vocal on Song & vocals.';
 const reviewed=window.PhraseGuide?.nextStep();if(reviewed)return reviewed;
 if(window.RC?.step!=='polish')return 'Choose your best take for each part, then press 2 POLISH to clean, tune and mix it.';
 if(!visited.has('clean')&&c!=='clean')return 'Step 2: CLEAN. Listen to BEFORE and decide whether the background needs cleaning.';
 if(!visited.has('tune')&&c!=='tune')return 'Step 3: TUNE. Check the key, choose a preset, then fix single notes.';
 if(!visited.has('chain')&&c!=='chain')return 'Step 4: CHAIN. Pick a preset and compare FINAL with TUNED.';
 return 'Step 5: listen to the whole song with ▶ Whole song, then Finish & check and Export.';
}

/* ------------------------------------------------------------------ panel */
const ICON={warn:'⚠',tip:'✦',ok:'✓'};
let items=[],dismissed=new Map(),explain=false;
function install(){
 const sheet=$('guideSheet');if(!sheet||$('coachPanel'))return;
 document.body.append(sheet); // also reachable from Song & vocals (the studio is hidden there)
 const inner=sheet.querySelector('.inner'),top=inner.querySelector('.top');
 const panel=document.createElement('section');panel.id='coachPanel';panel.setAttribute('aria-label','Smart Guide coach');
 panel.innerHTML='<div class="coach-stages" id="coachStages"></div><p class="coach-now" id="coachNow"></p><p class="coach-next" id="coachNext"></p>'+
  '<div id="coachAdvice" class="coach-advice" aria-live="polite"></div>'+
  '<div id="coachOutlook" class="coach-outlook"></div>'+
  '<details id="coachHow" class="coach-how"><summary></summary><div></div></details>'+
  '<div class="coach-explain"><label class="switch"><input type="checkbox" id="coachExplain"> Explain controls: show a tip when you hover or tap. Taps still operate the controls.</label><p id="coachExplainOut" class="note"></p></div>'+
  '<details class="coach-log"><summary>What you just did</summary><ol id="coachLog"></ol></details>';
 top.after(panel);
 const guided=document.createElement('button');guided.id='guideThisVocal';guided.className='btn';guided.textContent='Guide this vocal';guided.title='Review one phrase, compare takes and hear changes before keeping them.';guided.onclick=()=>window.PhraseGuide.open();panel.prepend(guided);
 // The original measured tips stay, folded underneath.
 const old=document.createElement('details');old.id='coachClassic';old.className='coach-classic';old.innerHTML='<summary>Measured tips · help with · target sound</summary>';
 for(const el of [...inner.children])if(el!==top&&el!==panel)old.append(el);inner.append(old);
 $('coachExplain').onchange=e=>{explain=e.target.checked;store.set('pvs.coachExplain',explain?'1':'0');if(!explain)hideTip();};
 explain=store.get('pvs.coachExplain','0')==='1';$('coachExplain').checked=explain;
 // A Smart Guide button on Song & vocals too.
 const tr=document.querySelector('.rctopright');if(tr&&!$('coachBtn')){const b=document.createElement('button');b.id='coachBtn';b.className='rcbtn coach-btn';b.innerHTML='✦ Guide <span class="count" id="coachCount2"></span>';b.title='Smart Guide: watches what you do and advises step by step';b.onclick=()=>openGuide();tr.prepend(b);}
 const gb=$('guideBtn');if(gb&&!$('coachCount')){const s=document.createElement('span');s.className='count';s.id='coachCount';gb.append(s);const old=$('guideCount');if(old)old.hidden=true;}
 // Live advice bubble.
 // A slim advice line under the step header: it pushes the page down instead of covering controls.
 const toast=document.createElement('div');toast.id='coachToast';toast.hidden=true;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');($('rcSteps')||document.body).append(toast);
 const tip=document.createElement('div');tip.id='coachTip';tip.hidden=true;document.body.append(tip);
}
function openGuide(){const s=$('guideSheet');if(!s)return;$('detailSheet')&&($('detailSheet').hidden=true);s.hidden=false;if(typeof syncGuide==='function')try{syncGuide();}catch(_){}render(true);}
function openLegacy(){openGuide();const d=$('coachClassic');if(d)d.open=true;}
function render(force){
 const sheet=$('guideSheet');const on=$('guideOn')?.checked!==false;
 const c=context(),ctx=CTX[c],count=items.filter(x=>x.level!=='ok').length;
 for(const id of ['coachCount','coachCount2']){const e=$(id);if(e)e.textContent=on&&count?String(count):'';}
 if(!sheet||sheet.hidden)return;
 const st=$('coachStages');if(st)st.innerHTML=STAGES.map((s,i)=>{const n=items.filter(x=>x.stage===i&&x.level==='warn').length,here=ctx.stage===i;return '<span class="coach-stage'+(here?' here':'')+(n?' attn':'')+'">'+(i+1)+' '+s+(n?' ⚠':'')+'</span>';}).join('<i>›</i>');
 $('coachNow').innerHTML='<b>Now:</b> '+esc(ctx.name);$('coachNext').innerHTML='<b>Next:</b> '+esc(nextStep());
 const adv=$('coachAdvice');
 adv.innerHTML=!on?'<p class="note">Smart Guide is paused (On switch below).</p>':items.length?items.map((x,k)=>'<div class="coach-item '+x.level+'"><b>'+ICON[x.level]+' '+esc(x.title)+'</b><p>'+esc(x.text)+'</p><div class="row">'+x.actions.map((a,j)=>'<button class="btn small" data-coach="'+esc(x.id)+'" data-coach-j="'+j+'">'+esc(a.label)+'</button>').join('')+'<button class="btn small ghost" data-coach-dismiss="'+esc(x.id)+'">Not now</button></div></div>').join(''):'<p class="note">Nothing needs attention here right now. Keep listening with your beat.</p>';
 const o=outlook(),ob=$('coachOutlook');
 ob.innerHTML=o?'<h3>Sound-quality outlook: <span class="coach-r r'+o.overall+'">'+R3[o.overall]+'</span></h3><p>'+esc(o.summary)+'</p><table>'+o.rows.map(x=>'<tr><th>'+esc(x.area)+'</th><td><span class="coach-r r'+x.lvl+'">'+R3[x.lvl]+'</span></td><td>'+esc(x.why)+'</td></tr>').join('')+'</table><p class="note">From measurements and common studio practice, not a guarantee. Always judge with your beat.</p>':'';
 const h=HOW[c],how=$('coachHow');if(h&&(force||how.dataset.ctx!==c)){how.dataset.ctx=c;how.querySelector('summary').textContent='How '+ctx.name+' works';how.querySelector('div').innerHTML='<p>'+esc(h.what)+'</p><ol>'+h.steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol><p><b>How to listen:</b> '+esc(h.listen)+'</p><p><b>Common mistakes:</b></p><ul>'+h.mistakes.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>';if(force&&!items.length)how.open=true;}
 $('coachLog').innerHTML=log.length?log.map(x=>'<li><span>'+esc(CTX[x.ctx]?.name||'')+'</span> '+esc(x.text)+'</li>').join(''):'<li>Nothing yet.</li>';
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-coach],[data-coach-dismiss]');if(!b)return;
 if(b.dataset.coach){const it=items.find(x=>x.id===b.dataset.coach);try{it?.actions[+b.dataset.coachJ]?.run();}catch(_){}if(b.closest('#coachToast'))$('coachToast').hidden=true;setTimeout(()=>evaluate(true),600);}
 else{const it=items.find(x=>x.id===b.dataset.coachDismiss);if(it)dismissed.set(it.id,sig(it));evaluate(true);}});
const sig=it=>it.title+'|'+it.text;
/* ------------------------------------------------------------------ evaluate, notify */
let shown=new Map(),toastTimer=0,pending=0;
function soon(){clearTimeout(pending);pending=setTimeout(()=>evaluate(),250);}
function evaluate(force){
 let list=[];try{list=rules();}catch(e){list=[];}
 list=list.filter(x=>dismissed.get(x.id)!==sig(x));
 const rank={warn:0,tip:1,ok:2},c=context(),here=CTX[c]?.stage;
 list.sort((a,b)=>rank[a.level]-rank[b.level]||(a.stage===here?-1:0)-(b.stage===here?-1:0));
 items=list;render(force);notify();
}
function notify(){
 const on=$('guideOn')?.checked!==false,t=$('coachToast');if(!t)return;
 if(!on||!$('guideSheet')?.hidden){t.hidden=true;return;}
 // Pop up only advice for the stage you are working in; the rest waits in the guide (badge count).
 const here=CTX[context()]?.stage,cur=!t.hidden&&items.find(x=>x.id===t.dataset.id);
 // Only warnings (something likely going wrong) pop up; tips wait in the guide and its counter.
 const fresh=items.find(x=>x.level==='warn'&&x.stage===here&&shown.get(x.id)!==sig(x));
 if(!fresh||cur){if(!cur)t.hidden=true;return;}
 shown.set(fresh.id,sig(fresh));t.dataset.id=fresh.id;t.className='coach-toast '+fresh.level;
 t.title=fresh.text;t.innerHTML='<b>'+ICON[fresh.level]+' Smart Guide: '+esc(fresh.title)+'</b><span class="coach-toast-text">'+esc(fresh.text)+'</span><div class="row">'+fresh.actions.map((a,j)=>'<button class="btn small" data-coach="'+esc(fresh.id)+'" data-coach-j="'+j+'">'+esc(a.label)+'</button>').join('')+'<button class="btn small" id="coachToastOpen">Open guide</button><button class="btn small ghost" id="coachToastClose" aria-label="Close">✕</button></div>';
 t.hidden=false;$('coachToastOpen').onclick=()=>{t.hidden=true;openGuide();};$('coachToastClose').onclick=()=>{t.hidden=true;};
 clearTimeout(toastTimer);if(fresh.level!=='warn')toastTimer=setTimeout(()=>{t.hidden=true;},14000);
}
/* ------------------------------------------------------------------ explain mode */
let tipFor=null,touchTipTimer;
function showTip(el,text,x,y){const t=$('coachTip');if(!t||!text){hideTip();return;}t.textContent=text;t.hidden=false;const w=Math.min(340,innerWidth-16);t.style.maxWidth=w+'px';const r=t.getBoundingClientRect();t.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x+12))+'px';t.style.top=Math.max(8,Math.min(innerHeight-r.height-8,y+16))+'px';const o=$('coachExplainOut');if(o)o.textContent=text;tipFor=el;}
function hideTip(){clearTimeout(touchTipTimer);const t=$('coachTip');if(t)t.hidden=true;tipFor=null;}
function explainHandlers(doc,offset){
 doc.addEventListener('pointerover',e=>{if(!explain||e.pointerType==='touch')return;const el=e.target.closest?.('button,select,input,label,[role=slider],canvas,summary');if(!el||el===tipFor||el.closest('#coachTip,#coachToast'))return;const o=offset();showTip(el,explainFor(el),e.clientX+o.x,e.clientY+o.y);},true);
 doc.addEventListener('pointerout',e=>{if(explain&&e.target===tipFor)hideTip();},true);
 // Observe the touch without cancelling its click or the user gesture that opens the mic.
 doc.addEventListener('click',e=>{
  if(!explain||!e.isTrusted||!lastTouch||e.target.closest?.('#guideSheet,#coachToast,#coachBtn,#guideBtn,#phraseGuide,#vocalEditor.song-cleanup,#sgCleanHere'))return;
  const el=e.target.closest?.('button,select,input,label,[role=slider],canvas,summary');if(!el)return;
  const o=offset();showTip(el,explainFor(el),e.clientX+o.x,e.clientY+o.y);
  clearTimeout(touchTipTimer);touchTipTimer=setTimeout(hideTip,2200);
 },{capture:true,passive:true});
 doc.addEventListener('pointerdown',e=>{lastTouch=e.pointerType==='touch';hideTip();},true);
}
let lastTouch=false;
/* ------------------------------------------------------------------ note editor frame */
const boundDocs=new WeakSet();
function bindFrame(){const f=$('noteEditorFrame'),d=frameDoc();if(!f||!d||boundDocs.has(d)||!d.body)return;boundDocs.add(d);
 for(const t of ['click','change'])d.addEventListener(t,e=>track(e,d),true);
 explainHandlers(d,()=>{const r=f.getBoundingClientRect();return {x:r.left,y:r.top};});
 const w=frameWin();try{Object.assign(EXPLAIN,{});}catch(_){}
}
/* ------------------------------------------------------------------ boot */
let guideAutoScroll=null;
function dock(){const open=!!$('guideSheet')&&!$('guideSheet').hidden,b=document.body;
 const wide=open&&innerWidth>=900,narrow=open&&!wide;
 if(b.classList.contains('coach-docked')===wide&&b.classList.contains('coach-phone-open')===narrow)return;
 b.classList.toggle('coach-docked',wide);b.classList.toggle('coach-phone-open',narrow);dispatchEvent(new Event('resize'));
 if(!narrow&&guideAutoScroll){const {host,before,after}=guideAutoScroll;guideAutoScroll=null;if(Math.abs(host.scrollTop-after)<2)host.scrollTop=before;}
 if(narrow&&window.RC?.step==='rc')requestAnimationFrame(()=>{
  const host=$('songStudio'),record=$('sgRecord'),sheet=$('guideSheet');if(!host||!record||sheet.hidden)return;
  const overlap=record.getBoundingClientRect().bottom-sheet.getBoundingClientRect().top+8;
  if(overlap>0){const before=host.scrollTop;host.scrollTop+=overlap;guideAutoScroll={host,before,after:host.scrollTop};}
 });
}
function boot(){install();explainHandlers(document,()=>({x:0,y:0}));
 const sh=$('guideSheet');if(sh){new MutationObserver(()=>{dock();if(!sh.hidden)render(true);}).observe(sh,{attributes:true,attributeFilter:['hidden']});addEventListener('resize',dock);}
 setInterval(()=>{bindFrame();visited.add(context());evaluate();},1200);
 for(const s of ['guideBtn'])$(s)?.addEventListener('click',()=>setTimeout(()=>render(true),0));
 evaluate();}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
window.PvsCoach={context,items:()=>items.map(x=>({id:x.id,level:x.level,stage:x.stage,title:x.title,text:x.text,actions:x.actions.map(a=>a.label)})),outlook,log:()=>log.slice(),open:openGuide,evaluate,explainFor,nextStep};
})();
