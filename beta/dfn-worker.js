/* 0.37.0 AI clean worker: DeepFilterNet3 networks (vendor/dfn3) on ONNX Runtime Web (vendor/ort), single thread,
 * offline. Input and output are 48 kHz; the page resamples. Nothing leaves the device. */
'use strict';
importScripts('vendor/ort/ort.wasm.min.js','dfn-core.js?v=0.37.0');
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('vendor/ort/',self.location.href).href;
let sessions=null;
async function load(){if(!sessions){const u=p=>new URL('vendor/dfn3/'+p,self.location.href).href;sessions=await DfnCore.loadSessions(ort,{enc:u('enc.onnx'),erb_dec:u('erb_dec.onnx'),df_dec:u('df_dec.onnx')});}return sessions;}
onmessage=async({data:m})=>{
 try{
  if(m.type==='warm'){await load();postMessage({id:m.id,ok:true});return;}
  const s=await load(),out=await DfnCore.process(s,m.channels,48000,{progress:p=>postMessage({type:'progress',id:m.id,value:p})});
  postMessage({id:m.id,channels:out},out.map(c=>c.buffer));
 }catch(e){postMessage({id:m.id,error:String(e&&e.message||e)});}
};
