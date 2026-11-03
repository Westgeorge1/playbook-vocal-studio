const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const watchdog=require('../capture-watchdog.js');
const rows=[];const check=(name,test)=>{test();rows.push({name,pass:true});console.log('PASS',name);};
function clock({first=0,last=2000,rate=1000}={}){
 let wall=0,audio=0,frames=0,id=0;const jobs=new Map(),events=[];
 const controller=watchdog.start({first,last,rate,audioTime:()=>audio,frames:()=>frames,now:()=>wall,
  schedule:(fn,ms)=>{jobs.set(++id,{fn,at:wall+ms});return id;},cancel:key=>jobs.delete(key),
  onEnd:()=>events.push({kind:'end',wall,audio,frames}),onStall:()=>events.push({kind:'stall',wall,audio,frames})});
 return {events,controller,set:(a,n)=>{audio=a;frames=n;},step(ms,a,n){audio=a;frames=n;wall+=ms;const due=[...jobs].filter(([,j])=>j.at<=wall);for(const [key,j] of due){jobs.delete(key);j.fn();}},pending:()=>jobs.size};
}
try{
 check('Audio clock at one-quarter speed completes the full planned range, after the old wall deadline',()=>{
  const c=clock();for(let i=1;i<32;i++){c.step(250,i/16,Math.floor(i*62.5));assert.equal(c.events.length,0);}
  c.step(250,2,2000);assert.deepEqual(c.events,[{kind:'end',wall:8000,audio:2,frames:2000}]);assert.equal(c.pending(),0);
 });
 check('Slow scheduled pre-roll is not mistaken for missing microphone data',()=>{
  const c=clock({first:5000,last:7000});for(let i=1;i<=32;i++){c.step(250,i/8,0);assert.equal(c.events.length,0);}
  for(let i=33;i<=56;i++)c.step(250,i/8,Math.max(0,i*125-5000));assert.equal(c.events[0].kind,'end');assert.equal(c.events[0].audio,7);
 });
 check('An audio clock that stops advancing triggers the separate stall guard',()=>{
  const c=clock({last:10000});c.step(250,1,1000);for(let i=0;i<20;i++){c.step(250,1,1000);assert.equal(c.events.length,0);}
  c.step(250,1,1000);assert.equal(c.events[0].kind,'stall');assert.equal(c.events[0].frames,1000);assert.equal(c.pending(),0);
 });
 check('A running clock with a stalled recorder also triggers recovery',()=>{
  const c=clock({last:20000});c.step(250,1,1000);for(let i=1;i<=21;i++)c.step(250,1+i/4,1000);assert.equal(c.events[0].kind,'stall');
 });
 check('Queued capture progress cancels a suspected stall after a page delay',()=>{
  const c=clock({last:20000});c.step(250,1,1000);c.step(6000,7,1000);assert.equal(c.events.length,0);c.step(250,7.25,7250);assert.equal(c.events.length,0);c.step(250,7.5,7500);assert.equal(c.events.length,0);c.controller.stop();
 });
 check('Manual completion cancels the guard and cannot stop a later capture',()=>{
  const c=clock();c.step(250,.25,250);c.controller.stop();c.step(10000,12,12000);assert.equal(c.events.length,0);assert.equal(c.pending(),0);
 });
}catch(e){rows.push({name:'Completed',pass:false,error:String(e.stack||e)});process.exitCode=1;console.error(e);}
finally{if(process.env.PVS_TEST_OUT){fs.mkdirSync(process.env.PVS_TEST_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.PVS_TEST_OUT,'watchdog-clock.json'),JSON.stringify({clock:'Injected page and audio clocks; no physical-device claim',rows},null,2)+'\n');}}
