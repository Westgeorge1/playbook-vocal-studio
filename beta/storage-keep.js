/* 0.36.8: ask the browser to keep this site's songs.
   Browser storage is "best effort" by default: when a device runs short of space, the browser may clear a
   site's saved data, including songs and interrupted-recording safety copies. navigator.storage.persist()
   asks it not to. Chrome and Edge decide silently (installed or often-used sites are usually granted);
   Firefox may ask. We ask once per page, during the first song action (record, import, open, back up,
   POLISH), and show the result in Project storage with an "Ask again" button. Nothing is uploaded, and
   persistence never replaces downloaded backups. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const api=navigator.storage&&typeof navigator.storage.persist==='function'&&typeof navigator.storage.persisted==='function'?navigator.storage:null;
 let status=api?'unknown':'unsupported',asked=false,pending=null;
 const listeners=new Set(),emit=()=>{for(const f of listeners)try{f(status);}catch(_){}render();};
 async function check(){if(!api)return status;try{const on=await api.persisted();status=on?'granted':(asked?'not-granted':'not-asked');}catch(_){status='unknown';}emit();return status;}
 async function request(){
  if(!api){status='unsupported';emit();return false;}
  if(status==='granted')return true;
  if(pending)return pending;
  asked=true;
  pending=(async()=>{try{const on=await api.persist();status=on?'granted':'not-granted';}catch(_){status='not-granted';}pending=null;emit();return status==='granted';})();
  return pending;
 }
 // The first song action asks (inside the user's gesture, so a browser that prompts can show its question).
 const TRIGGERS='#sgRecord,#sgStartRecord,#sgFix,#sgImport,#sgStartImport,#sgOpen,#sgStartOpen,#sgSave,#storageBackup,#sgLoadBeat,#sgStartBacking,#sgPolish,[data-polish],#rcStep2';
 document.addEventListener('click',e=>{if(asked||status==='granted'||!api)return;if(e.target.closest?.(TRIGGERS)&&!e.target.closest('#storageKeepAsk'))request();},true);
 const TEXT={
  granted:['On','This browser will not clear your songs to free space. Downloaded backups are still the only copy that survives clearing site data, uninstalling the browser or a lost phone.'],
  'not-granted':['Not granted','This browser may clear your songs and interrupted-recording copies when the device runs low on space. Install the app (Add to Home screen or Install), or bookmark it, then press Ask again. Keep backing up your projects.'],
  'not-asked':['Not yet asked','The studio asks the first time you record, import, open or back up a song.'],
  unsupported:['Not available in this browser','This browser cannot be asked to keep site data. Back up your projects after each session.'],
  unknown:['Unknown','The browser did not report its storage setting. Back up your projects after each session.']};
 function render(){
  const panel=$('projectStoragePanel');if(!panel)return;
  let box=$('storageKeep');
  if(!box){box=document.createElement('div');box.id='storageKeep';box.className='storage-keep';box.innerHTML='<p><b>Keep songs on this device:</b> <span id="storageKeepState"></span> <button type="button" id="storageKeepAsk">Ask again</button></p><p id="storageKeepNote" class="note"></p>';
   const first=panel.querySelector(':scope > p');(first||panel.firstChild).after(box);
   $('storageKeepAsk').onclick=()=>request();}
  const [state,note]=TEXT[status]||TEXT.unknown;
  $('storageKeepState').textContent=state;$('storageKeepState').dataset.state=status;$('storageKeepNote').textContent=note;
  const ask=$('storageKeepAsk');ask.hidden=status==='granted'||status==='unsupported';ask.textContent=status==='not-asked'?'Keep my songs on this device':'Ask again';ask.disabled=!!pending;
 }
 function boot(){render();check();const panel=$('projectStoragePanel');if(panel)new MutationObserver(()=>{if(panel.open)check();}).observe(panel,{attributes:true,attributeFilter:['open']});}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
 window.StorageKeep={status:()=>status,request,check,onChange:f=>listeners.add(f)};
})();
