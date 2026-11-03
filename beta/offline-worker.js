/* Cache only known public app assets. Never cache project or microphone data. */
const version='0.36.8',scope=new URL(self.registration.scope);
const prefix='pvs-offline:'+scope.pathname+':',name=prefix+version;
const assets=new Set([
  "breath-find.js",
  "chord-core.js",
  "capture-drafts.js",
  "cleaning-plus.js",
  "cleanup-worker.js",
  "daw.css",
  "daw.js",
  "edit-core.js",
  "engine-wasm.js",
  "engine-wasm.wasm",
  "finish-policy.js",
  "index.html",
  "layout-resize.css",
  "layout-resize.js",
  "live-pitch.js",
  "natural-tuning.js",
  "noise-cleaner.css",
  "noise-cleaner.js",
  "noise-core.js",
  "noise-worker.js",
  "note-editor-safety.js",
  "note-editor-ux.js",
  "note-editor.html",
  "phrase-core.js",
  "phrase-guide.css",
  "phrase-guide.js",
  "phrase-worker.js",
  "project-storage.js",
  "quality-core.js",
  "quality-studio.css",
  "quality-studio.js",
  "quality-worker.js",
  "rc.css",
  "rc.js",
  "rec-worklet.js",
  "rec.css",
  "rec.js",
  "recovery.js",
  "ref-align.js",
  "reference-core.js",
  "reference-guide.css",
  "reference-guide.js",
  "reference-preview.js",
  "reference-worker.js",
  "sample.mp3",
  "separation.js",
  "smart-coach.css",
  "smart-coach.js",
  "song-capture-worklet.js",
  "song-core.js",
  "song-polish.js",
  "song-studio.css",
  "song-studio.js",
  "storage-keep.js",
  "storage-panel.js",
  "studio-browse.css",
  "studio-browse.js",
  "studio-main.js",
  "studio.css",
  "studio.js",
  "tuner-routing.css",
  "tuner-routing.js",
  "ux-simple.css",
  "ux-simple.js",
  "vendor/ort/ort-wasm-simd-threaded.mjs",
  "vendor/ort/ort-wasm-simd-threaded.wasm",
  "vendor/ort/ort.wasm.min.js",
  "vendor/rnnoise/rnnoise.js",
  "vendor/swiftf0/model.onnx",
  "work-windows.css",
  "work-windows.js",
  "worker.js",
  "workspace-standby.html",
  "workspace-transfer.js"
]);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(name),list=[...assets];
 try{
  async function load(){while(list.length){const path=list.pop(),target=new URL(path,scope);
   const response=await fetch(target+'?v='+version,{cache:'reload'});if(!response.ok)throw Error('Offline download failed: '+path);
   await cache.put(target,response);
  }}
  const results=await Promise.allSettled(Array.from({length:4},load));
  if(results.some(r=>r.status==='rejected'))throw Error('Offline installation was incomplete.');
 }catch(err){await caches.delete(name);throw err;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith(prefix)&&key!==name)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const q=event.request,u=new URL(q.url);if(q.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;
 const path=u.pathname.slice(scope.pathname.length)||'index.html';if(!assets.has(path))return;
 event.respondWith((async()=>{const cache=await caches.open(name);return await cache.match(new URL(path,scope))||await fetch(q);})());
});
