/* An interrupted take can be downloaded even if the renderer never reached Stop.
   Drafts are local to this studio route. They never replace project audio. */
(() => {
 'use strict';
 const scope=ProjectStorage.key('capture-draft'),active=new Set();
 let connection;
 function db(){
  if(!connection)connection=new Promise((resolve,reject)=>{
   const r=indexedDB.open('playbook-vocal-capture-drafts',1);
   r.onupgradeneeded=()=>{r.result.createObjectStore('heads',{keyPath:'id'});r.result.createObjectStore('pcm');};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  }).catch(e=>{connection=null;throw e;});
  return connection;
 }
 async function change(fn){
  const database=await db();return new Promise((resolve,reject)=>{
   const tx=database.transaction(['heads','pcm'],'readwrite');
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Draft write aborted.'));
   fn(tx.objectStore('heads'),tx.objectStore('pcm'));
  });
 }
 async function get(store,range){
  const database=await db();return new Promise((resolve,reject)=>{
   const r=database.transaction(store).objectStore(store).getAll(range);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
 }
 const range=id=>IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]);
 const erase=id=>change((heads,pcm)=>{heads.delete(id);pcm.delete(range(id));});
 function start(c,notify){
  const id=scope+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const info={id,scope,rate:c.rate,name:SongCore.track(c.w,c.trackId).name,song:c.w.title||'Song',at:Date.now(),frames:0};
  let index=0,lastFrames=0,queue=Promise.resolve(),error=false,ended=false;
  active.add(id);
  // Other tabs can see their own recordings, but never discard an active writer.
  let release;const lifetime=new Promise(done=>release=done);
  const lock=navigator.locks?.request(id,()=>lifetime).catch(()=>{});
  function flush(force=false){
   if(ended||error||index===c.chunks.length||(!force&&c.frames-lastFrames<c.rate))return;
   const chunks=c.chunks.slice(index).map(x=>({frame:x.frame-c.first,data:x.data}));
   index=c.chunks.length;lastFrames=c.frames;
   const end=chunks.at(-1),head={...info,frames:end.frame+end.data.length};
   queue=queue.then(()=>error?undefined:change((heads,pcm)=>{
    for(const chunk of chunks)pcm.put(chunk,[id,chunk.frame]);heads.put(head);
   })).catch(()=>{error=true;notify('Recording continues, but the local safety copy could not be written. Stop and back up this take before closing.');});
  }
  async function finish(discard){
   flush(true);ended=true;try{await queue;if(discard)await erase(id);}catch{}finally{active.delete(id);release();await lock;}
  }
  return {flush,finish};
 }
 async function state(){const all=(await get('heads')).filter(h=>h.scope===scope),locks=await navigator.locks?.query?.().catch(()=>null);
  const held=new Set((locks?.held||[]).map(l=>l.name));const available=all.filter(h=>!active.has(h.id)&&!held.has(h.id));return {available,writing:available.length<all.length};}
 async function list(){return (await state()).available;}
 async function download(head){
  const chunks=await get('pcm',range(head.id)),samples=new Float32Array(head.frames);
  for(const c of chunks){const off=Math.max(0,c.frame);if(off>=samples.length)continue;samples.set(c.data.subarray(Math.max(0,-c.frame),Math.min(c.data.length,samples.length-c.frame)),off);}
  return saveDownload(head.name+' - interrupted recording.wav',wavFloat([samples],head.rate));
 }
 async function discard(id){if(active.has(id))return; if(!navigator.locks)return;return navigator.locks.request(id,{ifAvailable:true},lock=>lock?erase(id):undefined);}
 window.CaptureDrafts={start,list,state,download,discard};
})();
