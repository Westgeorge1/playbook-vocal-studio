/* 0.34.1: short laptop screens (Windows display scaling leaves ~600–730 px of browser height). The tracks on
 * Song & vocals must show without scrolling, the step header is one row, the recording window opens full size,
 * and POLISH fits the window with nothing clipped. */
const {suite}=require('../tests-0.32.4/browser.cjs');
const R=48000,N=R*12;
let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647-.5);
const voc=new Float32Array(N);{let ph=0;for(let i=0;i<N;i++){const t=i/R,u=t%3;if(u>.7&&u<2.6){ph+=2*Math.PI*220/R;voc[i]=.25*Math.sin(ph)*Math.min(1,(u-.7)/.03,(2.6-u)/.03);}voc[i]+=.0008*rnd();}}
const beat=new Float32Array(N);for(let i=0;i<N;i++){const t=i/R;beat[i]=.2*Math.sin(2*Math.PI*55*t)+(t%.8<.05?.4*rnd():0);}
function wav(x,name){const n=x.length,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(R,24);b.writeUInt32LE(R*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(x[i]*32767))),44+2*i);return{name,mimeType:'audio/wav',buffer:b};}

suite('laptop-0.34.1',18,async({page,check})=>{
 for(const [w,h] of [[1280,600],[1366,650],[1536,730]]){
  const tag=w+'×'+h,p=await page(w,h);p.on('dialog',d=>d.accept());
  await p.evaluate(a=>{const C=SongCore,x=Float32Array.from(a);S.song=C.empty(48000);SongStudio.edit(w=>C.addTake(w,{trackId:w.tracks[0].id,start:0,end:12,channels:[x],origin:0,choose:true}),'laptop test');},Array.from(voc));
  await p.waitForTimeout(300);
  const ch=p.waitForEvent('filechooser');await p.evaluate(()=>document.getElementById('sgLoadBeat').click());await(await ch).setFiles(wav(beat,'backing.wav'));
  await p.waitForFunction(()=>!!S.beat,null,{timeout:30000});
  await p.evaluate(()=>{const d=document.querySelector('.sg-record-helpers');if(d)d.open=true;});await p.waitForTimeout(400);
  const s=await p.evaluate(()=>{const r=e=>document.querySelector(e)?.getBoundingClientRect();const v=r('#sgTimeline .sg-lane.active')||r('#sgTimeline .sg-lane:nth-child(3)');
   return {vh:innerHeight,steps:r('#rcSteps').height,tracks:r('#sgTimeline').top,vocal:v.top,scroll:document.getElementById('songStudio').scrollTop,over:document.documentElement.scrollWidth-innerWidth,helpers:r('.sg-record-helpers').height};});
  check(tag+': step header is one row',s.steps<=60);
  check(tag+': tracks start in the upper part of the window',s.tracks<s.vh*.62);
  check(tag+': the vocal track shows without scrolling (Recording helpers open)',s.scroll===0&&s.vh-s.vocal>=80);
  check(tag+': Recording helpers fit one slim row',s.helpers<=56);
  check(tag+': no sideways scrolling',s.over<=1);
  // Expand: the recording window opens full size on short screens and still shows the vocal track.
  await p.locator('#workspaceExpand').click();await p.waitForTimeout(600);
  const rw=await p.evaluate(()=>{const v=document.querySelector('#sgTimeline .sg-lane.active')||document.querySelector('#sgTimeline .sg-lane:nth-child(3)');return {max:WorkWindows.state().maximized,vocal:v.getBoundingClientRect().top,vh:innerHeight};});
  check(tag+': recording window opens full size',rw.max);
  check(tag+': recording window shows the vocal track',rw.vh-rw.vocal>=60);
  await p.locator('#recordWindowClose').click();await p.waitForTimeout(300);
  // POLISH
  await p.locator('#rcStep2').click();await p.waitForFunction(()=>RC.step==='polish'&&!SongPolish.state().switching&&!!SongPolish.state().binding,null,{timeout:120000});
  await p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked(),null,{timeout:180000});await p.waitForTimeout(400);
  const q=await p.evaluate(()=>{const loop=document.getElementById('dawLoop');return {doc:document.documentElement.scrollHeight,vh:innerHeight,bar:document.getElementById('trackPolishBar').getBoundingClientRect().height,insp:document.querySelector('.insp').getBoundingClientRect().height,loop:loop.scrollWidth<=loop.clientWidth+1,lanes:document.querySelector('.lanes').getBoundingClientRect().height};});
  check(tag+': POLISH fits the window',q.doc<=q.vh+2);
  check(tag+': Polishing bar is one row',q.bar<=50);
  check(tag+': LOOP and transport labels are not clipped',q.loop);
  check(tag+': settings panel at least 290 px and timeline at least 150 px',q.insp>=290&&q.lanes>=150);
  await p.context().close();
 }
 await require('../tests-0.36.4/backing-reference.cjs')(page,check);
});
