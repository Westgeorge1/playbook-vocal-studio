/* 0.37.0 Clean vocal: the eight cleaning steps in order, in one panel at the top of POLISH > CLEAN.
 * The Clean vocal button measures the recording and sets starting values for every step. Every value stays a manual
 * control: a knob the singer moves is remembered (NoiseCleaner touched list) and the button never changes it again;
 * Reset clears that list and returns every step to the button's values. Each step has an on/off switch that keeps
 * its values. Nothing changes unless the singer presses a button or moves a control.
 * Steps 3 (clicks) and 7 (echo) drive the existing Vocal Detail engine settings; the rest are NoiseCleaner settings. */
(function(){'use strict';
const $=id=>document.getElementById(id),NC=()=>window.NoiseCleaner;
const ENGINE={clicks:'chRepairOn',clickAmt:'chRepairClicks',plosive:'chRepairPlosives',echo:'chRoomReduceOn',echoAmt:'chRoomReduce'};
const NOISE_KEYS=['hum','highpass','under','bleed','dfn','engine','reduction','follow','sensitivity','smooth','scope','harmonic','gap'];
let measured=null,measuring=false,msg='';
const hasBeat=()=>typeof S!=='undefined'&&!!S.beat;
const music=m=>!!m&&(m.musicInPauses>=.35||m.snrDb<25);
// Starting values from the measurement (tested on the owner's ten recordings and on noise added to clean takes).
function plan(m){const clean=m.snrDb>=50;
 return {hum:m.hum,highpass:m.rumble>.01?70:0,under:0,bleed:music(m)&&hasBeat()?.5:0,dfn:music(m)?0:1,engine:'adaptive',reduction:clean?8:m.snrDb>=35?12:14,
  follow:clean?2:3,sensitivity:clean?0:3,smooth:.5,scope:'all',harmonic:1,gap:0,clicks:1,clickAmt:25,plosive:30,echo:0,echoAmt:30};}
const STEPS=[
 {id:'hum',n:'2',title:'Hum, rumble and pops',items:[{k:'hum',type:'select',label:'HUM',opts:[[0,'Off'],[50,'50 Hz + harmonics'],[60,'60 Hz + harmonics']]},{k:'highpass',type:'range',label:'Rumble cut-off (fixed)',unit:' Hz',min:0,max:120,step:5},{k:'under',type:'range',label:'Pops and rumble under the voice',unit:' dB',min:0,max:24,step:1}],note:()=>'Pops and rumble under the voice follows your sung note and removes low thumps below it (breath pops, mic handling). Clean vocal leaves it at 0: turn it up (18 dB is strong) when you hear thumps at the starts of lines. It needs the Adaptive engine.'},
 {id:'clicks',n:'3',title:'Clicks and pops',engine:'clicks',items:[{k:'clickAmt',type:'range',label:'Click sensitivity',unit:'%',min:0,max:100,step:1},{k:'plosive',type:'range',label:'Pop (plosive) reduction',unit:'%',min:0,max:100,step:1}]},
 {id:'bleed',n:'4',title:'Beat leak',items:[{k:'bleed',type:'select',label:'AMOUNT',opts:[[0,'Off'],[.5,'Gentle'],[1,'Strong']]}],note:()=>hasBeat()?'Removes the beat that leaked from your headphones, using the beat loaded in Song & vocals.':'Needs the matching beat: load it in Song & vocals first.'},
 {id:'ai',n:'5a',title:'AI clean',items:[{k:'dfn',type:'range',label:'Amount',unit:'%',scale:100,min:0,max:100,step:5}],note:()=>'DeepFilterNet3, run on this device; nothing is uploaded. It was trained on speech, so keep step 6 on. It is left off when music is heard behind your voice.'},
 {id:'noise',n:'5b',title:'Noise remover',items:[{k:'engine',type:'select',label:'ENGINE',opts:[['adaptive','Adaptive: follows changing noise'],['classic','Classic: fixed noise print']]},{k:'reduction',type:'range',label:'Amount',unit:' dB',min:0,max:18,step:.5},
  {k:'follow',type:'select',label:'FOLLOW SPEED',opts:[[0,'Off: use the noise print'],[1,'Slow (1.5 s)'],[2,'Medium (0.6 s)'],[3,'Fast (0.35 s)']]},{k:'smooth',type:'range',label:'Smoothness',unit:'%',scale:100,min:0,max:100,step:5},
  {k:'scope',type:'select',label:'WHERE',opts:[['all','Everywhere'],['pauses','Only between lines (singing untouched)']]}],note:()=>(NC()?.state().engine||'classic')==='classic'?'Follow speed, Smoothness and step 6 need the Adaptive engine.':'Higher Smoothness leaves a little more noise but fewer watery sounds.'},
 {id:'protect',n:'6',title:'Protect held notes',items:[{k:'harmonic',type:'range',label:'Protection',unit:'%',scale:100,min:0,max:100,step:5}],note:()=>'Finds the note you sing in every moment and keeps its harmonics, cleaning only between them. After AI clean it puts back any harmonics the AI took.'},
 {id:'gaps',n:'7',title:'Gaps, breaths, echo',items:[{k:'gap',type:'range',label:'Gap cleaning (between lines)',unit:' dB',min:0,max:24,step:1},{k:'echo',type:'check',label:'Gentle de-reverb (room echo)'},{k:'echoAmt',type:'range',label:'Echo reduction',unit:'%',min:0,max:100,step:1}],extra:'<button class="btn" id="cvBreaths" type="button">Find breaths</button>',note:()=>'Breaths: Find breaths opens the breath finder, where you hear each one and choose how much to lower it.'}];
const isEngine=k=>Object.hasOwn(ENGINE,k);
function value(k){if(isEngine(k))return typeof S!=='undefined'&&S.P?S.P[ENGINE[k]]:undefined;const c=NC()?.state()||{};
 return k==='engine'?(c.engine||'classic'):k==='follow'?(c.follow??2):k==='smooth'?(c.smooth??.5):k==='harmonic'?(c.harmonic??0):k==='dfn'?(c.dfn||0):k==='scope'?(c.scope||'all'):k==='gap'?(c.gap||0):k==='under'?(c.under||0):k==='bleed'?(c.bleed||0):c[k];}
function setValues(patch,touchKeys){const m=NC();if(!m)return false;const noise={},steps=[];
 for(const [k,v] of Object.entries(patch)){if(isEngine(k)){if(typeof S==='undefined'||S.P?.[ENGINE[k]]!==v)steps.push(['set',ENGINE[k],v]);}else noise[k]=v;}
 if(touchKeys){const t=new Set(m.state().touched||[]);for(const k of touchKeys)t.add(k);noise.touched=[...t];}
 let ok=true;if(Object.keys(noise).length)ok=m.mutate(noise);
 if(ok&&steps.length&&typeof undoable==='function')undoable(steps);
 return ok;}
async function measure(){const m=NC();if(!m?.active()){msg='Clean vocal needs the Playbook Note Editor tuner (the default for new vocals).';ui();return null;}
 measuring=true;msg='Measuring this recording…';ui();try{measured=await m.measure();}catch(e){measured=null;msg='Could not measure: '+e.message;}finally{measuring=false;}ui();return measured;}
async function auto(reset){const m=NC();const r=await measure();if(!r){if(!msg)msg='Open a vocal first.';ui();return;}
 const p=plan(r),c=m.state(),t=reset?[]:(c.touched||[]),patch={mode:'studio',on:true};
 for(const k of [...NOISE_KEYS,...Object.keys(ENGINE)])if(!t.includes(k))patch[k]=p[k];
 if(reset){patch.stepsOff=[];patch.echoMemo=null;}patch.touched=t;
 // With step 7 off, the echo choice is remembered for when the step is switched back on, not applied now.
 if(!reset&&(c.stepsOff||[]).includes('gaps')&&'echo' in patch){patch.echoMemo=patch.echo;patch.echo=0;}
 const ok=setValues(patch,null);
 const kept=t.length?' Kept your own settings: '+t.join(', ')+'.':'';
 msg=ok?(reset?'Reset: every step is back to the Clean vocal settings for this recording.':'Clean vocal set every step for this recording.')+kept+(music(r)?' Music or another voice is behind your singing, so AI clean is off. If it is your beat, load it in Song & vocals and use step 4.':''):'The studio is busy. Try again when processing finishes.';
 ui();}
function readings(m){if(!m)return 'Not measured yet. Press Clean vocal or Measure again.';
 const parts=['Background '+m.floorDb+' dBFS','voice '+m.voiceDb+' dBFS','difference '+m.snrDb+' dB',m.hum?'hum at '+m.hum+' Hz':'no hum',m.rumble>.01?'low rumble present':'no rumble'];
 if(m.clipped)parts.push(m.clipped+' samples at full scale (listen to the loudest lines for distortion)');
 parts.push(music(m)?'music or a voice heard in the pauses':'pauses hold background only');return parts.join(' · ')+'.';}
function build(){const host=$('studioNoiseControls');if(!host||$('cleanVocal'))return false;
 const box=document.createElement('section');box.className='clean-vocal';box.id='cleanVocal';
 let h='<h3>Clean vocal</h3><p class="note">One button measures this recording and sets every step below. You can change any control; the button keeps your changes. Reset puts every step back to the button\'s settings.</p>'
  +'<div class="row"><button class="btn primary" id="cvAuto" type="button">Clean vocal</button><button class="btn" id="cvReset" type="button">Reset</button></div><p class="note" id="cvStatus" role="status" aria-live="polite"></p><ol class="cv-steps">'
  +'<li class="cv-step" id="cvStep-measure"><div class="cv-head"><b>1. Measure</b><button class="btn" id="cvMeasure" type="button">Measure again</button></div><p class="note" id="cvReadings"></p></li>';
 for(const s of STEPS){h+='<li class="cv-step" id="cvStep-'+s.id+'"><div class="cv-head"><label class="switch"><input type="checkbox" '+(s.engine?'data-engine-switch="'+s.engine+'"':'data-step="'+s.id+'"')+'> <b>'+s.n+'. '+s.title+'</b></label></div>';
  for(const it of s.items){const id='cv-'+it.k;
   if(it.type==='select')h+='<label class="field"><span>'+it.label+'</span><select id="'+id+'" data-k="'+it.k+'">'+it.opts.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('')+'</select></label>';
   else if(it.type==='check')h+='<label class="switch"><input type="checkbox" id="'+id+'" data-k="'+it.k+'"> '+it.label+'</label>';
   else h+='<label class="noise-range">'+it.label+' <output id="'+id+'-out"></output><input id="'+id+'" data-k="'+it.k+'" type="range" min="'+it.min+'" max="'+it.max+'" step="'+it.step+'"></label>';}
  if(s.extra)h+='<div class="row">'+s.extra+'</div>';if(s.note)h+='<p class="note" data-note="'+s.id+'"></p>';h+='</li>';}
 h+='<li class="cv-step" id="cvStep-safety"><div class="cv-head"><b>8. Safety check</b></div><p class="note" id="cvSafety" role="status"></p><div class="row"><button class="btn" id="cvRemoved" type="button">Hear what was removed</button><button class="btn" id="cvBefore" type="button">Before</button><button class="btn" id="cvAfter" type="button">After</button></div></li></ol>';
 box.innerHTML=h;host.prepend(box);
 const item=k=>STEPS.flatMap(s=>s.items).find(i=>i.k===k);
 for(const el of box.querySelectorAll('[data-k]')){const k=el.dataset.k,it=item(k),num=it.type==='range'||(it.type==='select'&&typeof it.opts[0][0]==='number');
  const read=()=>it.type==='check'?(el.checked?1:0):num?(+el.value)/(it.scale||1):el.value;
  if(it.type==='range')el.oninput=()=>{$('cv-'+k+'-out').textContent=el.value+it.unit;};
  el.onchange=()=>{if(!setValues({[k]:read()},[k]))ui();};}
 // 0.37.3: step 7's room-echo reduction is a Vocal Detail engine setting, so its switch turns that setting off too
 // (and back on to what it was), instead of only stopping gap cleaning.
 for(const el of box.querySelectorAll('[data-step]'))el.onchange=()=>{const m=NC(),c=m.state(),off=new Set(c.stepsOff||[]),step=el.dataset.step;el.checked?off.delete(step):off.add(step);const patch={stepsOff:[...off]};
  let echo=null;if(step==='gaps'){if(!el.checked){patch.echoMemo=value('echo')>.5?1:0;if(patch.echoMemo)echo=0;}else{patch.echoMemo=null;if(c.echoMemo)echo=1;}}
  if(!m.mutate(patch)){ui();return;}if(echo!==null&&typeof undoable==='function')undoable([['set',ENGINE.echo,echo]]);};
 for(const el of box.querySelectorAll('[data-engine-switch]'))el.onchange=()=>{const k=el.dataset.engineSwitch;if(!setValues({[k]:el.checked?1:0},[k]))ui();};
 $('cvAuto').onclick=()=>auto(false);$('cvReset').onclick=()=>auto(true);$('cvMeasure').onclick=()=>measure();
 const listen=mode=>document.querySelector('#cleanListen [data-mode="'+mode+'"]')?.click();
 $('cvRemoved').onclick=()=>listen('removed');$('cvBefore').onclick=()=>listen('before');$('cvAfter').onclick=()=>listen('cleaned');
 $('cvBreaths').onclick=()=>{try{window.dawDock?.('wave');}catch(_){}requestAnimationFrame(()=>($('breathFindAll')||$('breathRack'))?.scrollIntoView({block:'center'}));};
 // Knobs moved in the classic Studio Spectral and CLEAN controls below also count as the singer's own settings.
 const watch={noiseReduction:'reduction',noiseSensitivity:'sensitivity',noiseHighpass:'highpass',noiseHum:'hum',noiseScope:'scope',noiseBleed:'bleed'};
 for(const [id,k] of Object.entries(watch))$(id)?.addEventListener('change',()=>setTimeout(()=>NC()?.touch([k]),0));
 for(const b of document.querySelectorAll('[data-noise-preset]'))b.addEventListener('click',()=>setTimeout(()=>NC()?.touch(['reduction','sensitivity']),0));
 return true;}
function ui(){const box=$('cleanVocal');if(!box)return;const m=NC();if(!m)return;const c=m.state(),act=m.active(),locked=m.locked()||measuring||(typeof S!=='undefined'&&(S.busy||!!S.loading)),off=new Set(c.stepsOff||[]);
 for(const el of box.querySelectorAll('input,select,button'))el.disabled=locked||(!act&&el.id!=='cvAuto');
 $('cvStatus').textContent=!act?'Clean vocal works with the Playbook Note Editor tuner.':msg;
 $('cvReadings').textContent=readings(measured);
 for(const el of box.querySelectorAll('[data-k]')){if(document.activeElement===el)continue;const k=el.dataset.k,v=value(k),it=STEPS.flatMap(s=>s.items).find(i=>i.k===k);
  if(it.type==='check')el.checked=v>.5;else if(it.type==='range'){const shown=Math.round((v??0)*(it.scale||1)*10)/10;el.value=String(shown);$('cv-'+k+'-out').textContent=shown+it.unit;}else el.value=String(v??it.opts[0][0]);}
 for(const el of box.querySelectorAll('[data-step]'))el.checked=!off.has(el.dataset.step);
 for(const el of box.querySelectorAll('[data-engine-switch]'))el.checked=value(el.dataset.engineSwitch)>.5;
 const echoOff=off.has('gaps');for(const id of ['cv-echo','cv-echoAmt'])if($(id))$(id).disabled=$(id).disabled||echoOff;
 for(const s of STEPS){const li=$('cvStep-'+s.id),on=s.engine?value(s.engine)>.5:!off.has(s.id);li.classList.toggle('off',!on);const n=box.querySelector('[data-note="'+s.id+'"]');if(n&&s.note)n.textContent=s.note();}
 const res=m.debug().result,safe=res?.safety,P=window.CleanPlus;
 $('cvSafety').textContent=!c.on?'Cleaning is off.':safe&&P?P.safetyText(safe):'Shown after the vocal is processed: how much your singing and the pauses changed.';
 $('cvSafety').classList.toggle('warn',!!(P&&P.safetyWarn?.(safe)));}
const api={plan,auto,measure,readings,ui,state:()=>({measured,msg})};window.CleanVocal=api;
const go=()=>{if(window.NoiseCleaner&&window.CleanPlus&&$('studioNoiseControls')&&build()){ui();setInterval(ui,400);}else if(!$('cleanVocal'))setTimeout(go,200);};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go):go();
})();
