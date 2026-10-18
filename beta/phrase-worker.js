// Independent raw-take measurements. The song engine and its Undo history are untouched.
importScripts('phrase-core.js?v=0.13.0','engine-wasm.js?v=0.12.1');
const ready=PVEngineWasm('engine-wasm.wasm?v=0.12.1');
ready.catch(()=>{});
let serial=Promise.resolve();
onmessage=({data:m})=>{serial=serial.then(async()=>{
  try {
    const M=await ready,t=m.take,p=m.phrase;PhraseCore.audio(t);PhraseCore.span(p.start,p.end);
    const ch=PhraseCore.excerpt(t,p);if(!ch[0].length)throw new Error('This take does not reach the phrase.');
    M._pv_import_kind(1);let ptr=M._pv_input(ch[0].length);M.HEAPF32.set(ch[0],ptr>>2);
    if(ch[1]){ptr=M._pv_input_right(ch[1].length);M.HEAPF32.set(ch[1],ptr>>2);}
    if(M._pv_load(t.rate,0,0)<0)throw new Error(M.UTF8ToString(M._pv_error()));
    const state=JSON.parse(M.UTF8ToString(M._pv_state()));
    postMessage({id:m.id,profile:PhraseCore.stats(t,p,state.notes,state.report)});
  }catch(e){postMessage({id:m.id,error:e.message||String(e)});}
});};
