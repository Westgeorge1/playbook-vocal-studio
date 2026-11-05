/* Run every suite with isolated temporary server layout and full reference coverage. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const source=__dirname,temp=fs.mkdtempSync(path.join(os.tmpdir(),'pvs-suites-'));
const output=path.resolve(process.env.PVS_TEST_OUT || path.join(os.tmpdir(),'pvs-results-'+Date.now()));
const suites=['tests-0.36.9/watchdog-clock','tests-0.36.9/watchdog-browser','tests-audit/storage-faults','tests-audit/transport-layout','tests-audit/transport-permission','tests-audit/transport-touch','tests-0.32.4/navigation','tests-0.32.4/storage','tests-0.32.5/layout','tests-0.33.0/timeline-move','tests-0.33.0/cleaning','tests-0.33.0/tuning-plus','tests-0.33.1/regressions','tests-0.34.0/ux','tests-0.34.1/laptop','tests-0.34.2/coach','tests-0.35.0/phrase-guide','tests-0.32.3/cleanup','tests-0.32.0/editors','tests-0.32.0/tuning','tests-0.32.0/workspace-editor','tests-0.32.3/windows','tests-0.37.4/recording','tests-0.37.4/phone','tests-0.37.4/echo-restore','tests-0.37.0/clean-vocal','tests-0.36.8/storage-keep','tests-0.36.1/manual-cleanup','tests-0.36.0/workflow','tests-0.36.0/guide-undo','tests-0.35.1/transport','tests-0.32.3/restore','tests-0.31.11/delete','tests-0.32.3/playback','tests-0.32.3/upgrade'];
const concurrency=Number(process.env.PVS_TEST_JOBS||1),mode=process.env.PVS_TEST_MODE||'qualification';
async function run(){
 if(!['qualification','stress'].includes(mode))throw Error('PVS_TEST_MODE must be qualification or stress.');
 if(mode==='qualification'&&concurrency!==1)throw Error('Release qualification must use PVS_TEST_JOBS=1. Use PVS_TEST_MODE=stress for separate concurrent runs.');
 if(!Number.isInteger(concurrency)||concurrency<1||concurrency>2)throw Error('PVS_TEST_JOBS must be 1 or 2.');
 for(const key of ['PVS_REFERENCE_DIR','PVS_OLD_BETA','PVS_OLD_MAIN']){
  if(!process.env[key]||!fs.existsSync(path.join(process.env[key],'index.html')))throw Error('Set '+key+' to an unpacked reference directory. See TESTING.md.');
 }
 const port=Number(process.env.PVS_PORT_BASE||33000);
 if(concurrency>1&&(!Number.isInteger(port)||port<1024||port+64*suites.length>65520))throw Error('PVS_PORT_BASE does not leave enough isolated test ports.');
 fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'run-metadata.json'),JSON.stringify({mode,jobs:concurrency,started:new Date().toISOString(),node:process.version,suites:suites.length},null,2));const stage=path.join(temp,'beta');
 fs.cpSync(source,stage,{recursive:true,filter:f=>!['.git','node_modules','test-results'].includes(path.basename(f))&&!path.resolve(f).startsWith(output+path.sep)&&path.resolve(f)!==output});
 const results=new Array(suites.length);let next=0;
 async function batch(){
  while(next<suites.length){
   const i=next++,suite=suites[i],out=path.join(output,path.basename(suite));fs.mkdirSync(out,{recursive:true});
   const log=fs.openSync(path.join(out,'suite.log'),'w'),start=Date.now(),env={...process.env,PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||require.resolve('playwright'),PVS_TEST_OUT:out};
   if(concurrency>1)env.PVS_PORT_BASE=String(port+i*64);
   console.log('Running',suite);
   try{
    const outcome=await new Promise(resolve=>{
     const child=spawn(process.execPath,[path.join(stage,suite+'.cjs')],{env,stdio:['ignore',log,log]});
     let timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},780000);
     child.once('error',err=>{clearTimeout(timer);resolve({code:null,error:err.message});});
     child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,error:timedOut?'Suite timed out after 780 seconds.':signal||undefined});});
    });
    results[i]={suite,pass:outcome.code===0,...outcome,seconds:+((Date.now()-start)/1000).toFixed(1)};
   }finally{fs.closeSync(log);}
   console.log(results[i].pass?'PASS':'FAIL',suite,results[i].seconds+' s');
  }
 }
 await Promise.all(Array.from({length:concurrency},batch));fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(results,null,2));
 console.log(results.filter(r=>r.pass).length+'/'+suites.length+' suites passed; 0 skipped. '+output);
 if(results.some(r=>!r.pass))process.exitCode=1;
}
run().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>fs.rmSync(temp,{recursive:true,force:true}));
