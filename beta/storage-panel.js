/* The Storage panel reports song project data. Deletions are always scoped. */
(() => {
  'use strict';
  const token=()=>globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const legacy='Old shared save';
  const locationName=new URL('./',location.href).pathname;
  const dialog=document.createElement('dialog');dialog.id='projectStoragePanel';
  dialog.setAttribute('aria-labelledby','storagePanelTitle');
  dialog.innerHTML='<header><h2 id="storagePanelTitle">Project storage</h2><button id="storageClose">Close</button></header><p>Approximate browser space used by song projects on this site. Exported project ZIPs are separate.</p><ul id="storageRows"></ul><div class="storage-actions"><button id="storageBackup">Back up open project</button><label><input type="checkbox" id="storageVerified"> I have checked a downloaded backup of the project I want to remove.</label><button id="storageRemoveHere">Remove this location’s save</button><button id="storageRemoveLegacy">Remove old shared copy</button></div><p id="storageNote" role="status"></p>';
  document.body.append(dialog);
  const $=id=>document.getElementById(id);
  window.addEventListener('storage',e=>{
    if(e.key!==ProjectStorage.key('deletionNotice')||!e.newValue)return;
    cancelPersist();S.restorePaused=true;
    S.restoreNote='This location’s saved project was removed in another tab. Back up open work before reloading.';
    showStorageRecovery();SongStudio.notify(S.restoreNote,true);
  });
  const title=key=>typeof key!=='string'?null:key.startsWith('pvs@')?key.slice(4,key.lastIndexOf('|')):/^(last$|src:|pcm:)/.test(key)?legacy:null;
  function bytes(x){
    if(x==null)return 0;
    if(typeof x==='string')return 2*x.length;
    if(typeof x!=='object')return 8;
    if(ArrayBuffer.isView(x)||x instanceof ArrayBuffer)return x.byteLength;
    if(x instanceof Blob)return x.size;
    return Object.entries(x).reduce((n,[k,v])=>n+2*k.length+bytes(v),0);
  }
  let sizes=new Map(),scanning=false;
  function controls(){
    const ok=$('storageVerified').checked&&!scanning&&!SongStudio.locked()&&!sessionLocked();
    $('storageRemoveHere').disabled=!ok||!sizes.get(locationName)?.saved;
    $('storageRemoveLegacy').disabled=!ok||!sizes.get(legacy)?.saved;
    $('storageBackup').disabled=!(SongStudio.hasWork()||S.phrases?.phrases.some(p=>p.takes.length))||SongStudio.locked()||sessionLocked();
  }
  async function refresh(){
    scanning=true;sizes=new Map();controls();$('storageNote').textContent='Checking saved audio…';
    let db;
    try{
      db=await idb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('s'),req=tx.objectStore('s').openCursor();
        req.onsuccess=()=>{const cur=req.result;if(!cur)return;const name=title(cur.key);
          if(name){const item=sizes.get(name)||{bytes:0,saved:false};item.bytes+=bytes(cur.value)+bytes(cur.key);item.saved ||= (cur.key==='last'||cur.key.endsWith('|last'))&&!!cur.value;sizes.set(name,item);}
          cur.continue();};
        tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
      });
      $('storageRows').replaceChildren();
      for(const name of new Set([locationName,legacy,...sizes.keys()])){
        const li=document.createElement('li'),n=sizes.get(name)?.bytes||0;
        li.textContent=(name===locationName?'This location ('+name+')':name)+' — '+(n>=1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB');
        $('storageRows').append(li);
      }
      $('storageNote').textContent='Back up the specific project you want to remove. Close other tabs editing that location.';
    }catch(e){$('storageNote').textContent='Could not read browser storage: '+e.message;}
    finally{db?.close();scanning=false;controls();}
  }
  async function remove(shared){
    if(!dialog.open||!$('storageVerified').checked||scanning||sessionLocked()||SongStudio.locked())return;
    const which=shared?legacy:locationName;
    if(!sizes.get(which)?.saved||!confirm('Remove '+which+' from this browser? Your downloaded ZIP is kept.'+(shared?'':' This studio will reopen empty.')))return;
    scanning=true;controls();let db;
    try{
      if(!shared){cancelPersist();await rememberQueue.catch(()=>{});}
      db=await idb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('s','readwrite'),st=tx.objectStore('s'),req=st.getAllKeys();
        req.onsuccess=()=>{
          for(const k of req.result)if(title(k)===which)st.delete(k);
          if(!shared){st.put(true,ProjectStorage.key('initialized'));st.put(token(),ProjectStorage.key('removed-at'));}
        };
        tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
      });
      try{
        if(!shared)localStorage.setItem(ProjectStorage.key('deletionNotice'),token());
        localStorage.removeItem(shared?'pvs.songJournal':ProjectStorage.key('pvs.songJournal'));
        localStorage.removeItem(shared?'pvs.hadProject':ProjectStorage.key('pvs.hadProject'));
      }catch(_){}
      if(!shared){S.restorePaused=true;location.reload();return;}
      $('storageVerified').checked=false;await refresh();
    }catch(e){$('storageNote').textContent='Could not remove the save: '+e.message;}
    finally{db?.close();scanning=false;controls();}
  }
  function open(){if(dialog.open)return;$('storageVerified').checked=false;dialog.showModal();refresh();}
  $('storageClose').onclick=()=>dialog.close();$('storageVerified').onchange=controls;
  $('storageBackup').onclick=()=>SongStudio.save();$('storageRemoveHere').onclick=()=>remove(false);$('storageRemoveLegacy').onclick=()=>remove(true);
  for(const parent of [document.querySelector('.sg-filebar'),document.querySelector('.menu .mdrop')]){
    const btn=document.createElement('button');btn.type='button';btn.textContent='Project storage';
    btn.onclick=()=>{dawCloseMenus();open();};parent.append(btn);
  }
})();
