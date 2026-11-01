const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const portFor=require('./test-port.cjs');
function wave(){
 const R=44100,n=2*R,buf=Buffer.alloc(44+n*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(R,24);buf.writeUInt32LE(R*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++)buf.writeInt16LE(Math.round(8500*Math.sin(2*Math.PI*225*i/R)),44+2*i);
 return {name:'navigation-vocal.wav',mimeType:'audio/wav',buffer:buf};
}
async function suite(name,offset,run){
 let b,server;const rows=[],errors=[];
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
   await c.route('https://**/*',r=>r.abort());const p=await c.newPage();p.setDefaultTimeout(10000);
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(url);await p.waitForFunction(()=>window.StudioBrowse&&window.SongStudio&&!S.loading);
   return p;
  }
  await run({check,page,url,b,errors});check('No JavaScript errors',errors.length===0);
 }catch(e){console.error(e);rows.push({name:'Completed',pass:false,detail:String(e)});process.exitCode=1;}
 finally{
  console.log(rows.filter(x=>x.pass).length+'/'+rows.length+' passed',errors);
  if(process.env.PVS_TEST_OUT){fs.mkdirSync(process.env.PVS_TEST_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.PVS_TEST_OUT,name+'.json'),JSON.stringify({rows,errors},null,2));}
  await b?.close();server?.kill();
 }
}
module.exports={suite,wave};
