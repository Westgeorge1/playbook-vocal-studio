/* Run suites serially with isolated temporary server layout and full reference coverage. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const source=__dirname,temp=fs.mkdtempSync(path.join(os.tmpdir(),'pvs-suites-'));
const output=path.resolve(process.env.PVS_TEST_OUT || path.join(os.tmpdir(),'pvs-results-'+Date.now()));
const suites=['tests-0.32.4/navigation','tests-0.32.4/storage','tests-0.32.5/layout','tests-0.33.0/timeline-move','tests-0.33.0/cleaning','tests-0.33.0/tuning-plus','tests-0.33.1/regressions','tests-0.34.0/ux','tests-0.34.1/laptop','tests-0.34.2/coach','tests-0.35.0/phrase-guide','tests-0.32.3/cleanup','tests-0.32.0/editors','tests-0.32.0/tuning','tests-0.32.0/workspace-editor','tests-0.32.3/windows','tests-0.36.1/recording','tests-0.36.1/manual-cleanup','tests-0.36.0/workflow','tests-0.36.0/guide-undo','tests-0.35.1/transport','tests-0.32.3/restore','tests-0.31.11/delete','tests-0.32.3/playback','tests-0.32.3/upgrade'];
try{
  for(const key of ['PVS_REFERENCE_DIR','PVS_OLD_BETA','PVS_OLD_MAIN']){
    if(!process.env[key]||!fs.existsSync(path.join(process.env[key],'index.html')))throw Error('Set '+key+' to an unpacked reference directory. See TESTING.md.');
  }
  fs.mkdirSync(output,{recursive:true});const stage=path.join(temp,'beta');
  fs.cpSync(source,stage,{recursive:true,filter:f=>!['.git','node_modules','test-results'].includes(path.basename(f))&&!path.resolve(f).startsWith(output+path.sep)&&path.resolve(f)!==output});
  const results=[];
  for(const suite of suites){
    const name=path.basename(suite),out=path.join(output,name);fs.mkdirSync(out,{recursive:true});
    const log=fs.openSync(path.join(out,'suite.log'),'w');
    console.log('Running',suite);
    let run;
    try{run=spawnSync(process.execPath,[path.join(stage,suite+'.cjs')],{env:{...process.env,PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||require.resolve('playwright'),PVS_TEST_OUT:out},stdio:['ignore',log,log],timeout:780000});}
    finally{fs.closeSync(log);}
    const pass=run.status===0;results.push({suite,pass,code:run.status,error:run.error?.message});console.log(pass?'PASS':'FAIL',suite);
  }
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(results,null,2));
  console.log(results.filter(x=>x.pass).length+'/'+suites.length+' suites passed. '+output);
  if(results.some(x=>!x.pass))process.exitCode=1;
}catch(e){console.error(e.message);process.exitCode=1;}
finally{fs.rmSync(temp,{recursive:true,force:true});}
