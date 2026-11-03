'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
if(process.env.PVS_CAPTURE_CONTROL==='child'){
 require('../tests-0.32.4/browser.cjs').suite('navigation',55,async({page,check})=>{
  const p=await page();await p.evaluate(()=>{S.busy=true;});await p.waitForTimeout(600);
  check('Deliberate failure-capture control',false);
 });
}else{
 const {spawnSync}=require('node:child_process');
 const out=process.env.PVS_TEST_OUT||fs.mkdtempSync(path.join(os.tmpdir(),'pvs-capture-control-'));
 fs.mkdirSync(out,{recursive:true});
 const child=spawnSync(process.execPath,[__filename],{env:{...process.env,PVS_TEST_OUT:out,PVS_CAPTURE_CONTROL:'child'},encoding:'utf8',timeout:30000});
 fs.writeFileSync(path.join(out,'expected-failure.log'),child.stdout+child.stderr);
 assert.equal(child.status,1,'A controlled assertion failure must retain its failing exit code');
 const data=JSON.parse(fs.readFileSync(path.join(out,'navigation.json'),'utf8'));
 assert(data.rows.some(r=>r.name==='Deliberate failure-capture control'&&!r.pass),'Original assertion is preserved');
 assert(data.rows.some(r=>r.name==='Completed'&&!r.pass),'Original failure remains recorded');
 assert.equal(data.capture.state,'finished');
 assert(data.failureStates.some(r=>r.state?.flags.busy===true),'Actual lock state is retained');
 const trace=data.failureStates.find(r=>r.state?.navigation)?.state.navigation;
 assert(trace&&trace.samples.length>0&&trace.samples.length<=trace.limit,'Bounded navigation samples are retained');
 assert(trace.samples.some(r=>r.flags?.busy===true),'Samples capture the controlled busy state');
 console.log('PASS controlled failure: exit, original assertion, failure record, capture completion, lock state, bounded trace, sampled busy state');
}
