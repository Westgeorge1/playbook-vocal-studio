const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const portFor=require('./test-port.cjs');
function wave(){
 const R=44100,n=2*R,buf=Buffer.alloc(44+n*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(R,24);buf.writeUInt32LE(R*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++)buf.writeInt16LE(Math.round(8500*Math.sin(2*Math.PI*225*i/R)),44+2*i);
 return {name:'navigation-vocal.wav',mimeType:'audio/wav',buffer:buf};
}
async function suite(name,offset,run){
 let b,server;const rows=[],errors=[],pages=[],failureStates=[],navigationNetwork=new Map();
 const capture={state:'not_needed',totalPages:0,pageLimit:4,totalDeadlineMs:5000};
 function saveResult(){
  if(!process.env.PVS_TEST_OUT)return;
  fs.mkdirSync(process.env.PVS_TEST_OUT,{recursive:true});
  const target=path.join(process.env.PVS_TEST_OUT,name+'.json'),temp=target+'.tmp';
  fs.writeFileSync(temp,JSON.stringify({rows,errors,failureStates,capture},null,2));fs.renameSync(temp,target);
 }
 const check=(label,pass)=>{rows.push({name:label,pass:!!pass});assert.ok(pass,label);console.log('PASS',label);};
 try{
  const port=portFor(8970+offset,offset),url='http://127.0.0.1:'+port+'/';
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',path.resolve(__dirname,'..')],{stdio:'ignore'});
  let ready=false;
  for(let i=0;i<40&&!ready;i++){
    if(server.exitCode!==null)throw Error('Could not start test server on '+port);
    try{const r=await fetch(url);ready=r.ok;await r.arrayBuffer();}catch(_){}
    if(!ready)await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,'Local test server is ready');
  b=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  async function page(width=1280,height=800){
   const c=await b.newContext({viewport:{width,height},hasTouch:width<=844,isMobile:width<=844,permissions:['microphone']});
   await c.route('https://**/*',r=>r.abort());const p=await c.newPage();pages.push(p);p.setDefaultTimeout(30000);
   if(name==='navigation')navigationNetwork.set(p,await require('./navigation-evidence.cjs').attach(c,p));
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(url,{waitUntil:"domcontentloaded",timeout:60000});await p.waitForFunction(()=>window.StudioBrowse&&window.SongStudio&&!S.loading);
   return p;
  }
  await run({check,page,url,b,errors});check('No JavaScript errors',errors.length===0);
 }catch(e){console.error(e);rows.push({name:'Completed',pass:false,detail:String(e)});process.exitCode=1;}
 finally{
  // Retain the state behind a compound timeout before closing its browser.
  // This is read-only metadata: no audio samples, retries or longer assertions.
  if(process.exitCode){
   capture.state='capturing';capture.totalPages=pages.length;
   saveResult(); // The original failure survives interruption of optional capture.
   const deadline=Date.now()+capture.totalDeadlineMs;
   const openPages=pages.map((p,index)=>({p,index})).filter(({p})=>!p.isClosed());
   capture.closedPages=pages.length-openPages.length;
   for(const {index,p} of openPages.reverse().slice(0,capture.pageLimit)){
    const remaining=deadline-Date.now();if(remaining<=0){capture.deadlineReached=true;break;}
    let timer;
    try{
     const state=await Promise.race([p.evaluate(()=>{
      const read=fn=>{try{return fn();}catch(e){return {error:e.message};}};
      const text=id=>document.getElementById(id)?.textContent?.slice(0,2000)||'';
      const bounded=(values,limit,map)=>({total:values.length,items:values.slice(0,limit).map(map),truncated:values.length>limit});
      return {
       version:read(()=>APP_VERSION),visibility:document.visibilityState,readyState:document.readyState,
       navigation:read(()=>window.__pvsNavigationEvidence?.dump()||null),
       locked:read(()=>sessionLocked()),lockReason:read(()=>lockReason()),
       studioLocked:read(()=>SongStudio.locked()),windowBlocked:read(()=>!!window.AppWindow?.blocked()),qualityLocked:read(()=>!!window.QualityStudio?.locked()),legacyRecording:read(()=>!!rec),audioContextState:read(()=>actx?.state||'not created'),
       flags:read(()=>Object.fromEntries(['busy','dirty','loading','loadError','beatLoading','referenceLoading','referenceWorking','recStarting','phraseWorking','songWorking','songApplying','restorePaused','restoreNote','queued'].map(k=>[k,S[k]??null]))),
       editorAudio:read(()=>({main:!!S.main,rate:S.rate,originalFrames:S.original?.length??0,finalChannels:S.final?.length??0})),
       sources:read(()=>bounded(Object.values(S.song?.sources||{}),128,s=>({rate:s.rate,channels:s.channels?.length??0,frames:s.channels?.[0]?.length??0}))),
       selectedRegions:read(()=>S.song?.tracks.reduce((n,t)=>n+t.regions.filter(r=>r.selected).length,0)??0),
       route:read(()=>({step:RC.step,tab:DAW.tab,dock:DAW.dock,workspace:WorkWindows.state()})),
       studio:read(()=>S.song?SongStudio.state():null),polish:read(()=>SongPolish.state()),
       tuner:read(()=>({pending:NoteTuner.pending(),failed:NoteTuner.failed(),processing:NoteTuner.debug().processing,error:NoteTuner.debug().error})),
       noise:read(()=>({locked:NoiseCleaner.locked(),failed:NoiseCleaner.failed(),error:NoiseCleaner.debug().error})),
       engine:read(()=>({error:engineFailure?.message||null,jobs:bounded(Object.values(pending),32,j=>({type:j.type,update:j.update,ageMs:Date.now()-j.started}))})),
       status:Object.fromEntries(['chip','sgStatus','sgPolishProgress','polishTrackStatus','noteRouteStatus','noiseStatus'].map(id=>[id,text(id)]))
      };
     }),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Failure-state capture reached the aggregate 5-second limit.')),remaining);})]);
     failureStates.push({page:index,state,network:navigationNetwork.get(p)||[]});
    }catch(e){failureStates.push({page:index,captureError:String(e),network:navigationNetwork.get(p)||[]});}finally{clearTimeout(timer);}
   }
   capture.state='finished';capture.recordedPages=failureStates.length;capture.omittedPages=openPages.length-failureStates.length;
  }
  console.log(rows.filter(x=>x.pass).length+'/'+rows.length+' passed',errors);
  saveResult();
  await b?.close();server?.kill();
 }
}
module.exports={suite,wave};
