/* One writable project owner during a user-requested browser-window handoff. */
(function(){
'use strict';
const query=new URLSearchParams(location.search),requested=query.get('workspace')||'record';let token=query.get('handoff');
const studioURL=()=>new URL('./?v=0.31.12',location.href).href;
const standby=location.pathname.endsWith('/workspace-standby.html');
if(standby){
 let child=null,returning=false,lastSeen=0;
 const status=document.getElementById('standbyStatus'),focus=document.getElementById('standbyFocus'),back=document.getElementById('standbyReturn');
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.data?.type!=='pvs-workspace'||e.data.token!==token)return;
  if(child&&e.source!==child)return;child=e.source;lastSeen=Date.now();focus.disabled=false;back.disabled=false;
  status.textContent=e.data.recording?'Recording is running in the other window. Returning will stop and keep this take.':'Your project is open in the other window. This tab is standing by.';
 });
 function reconnect(){
  if(child)return true;
  const candidate=window.open('', 'pvs-workspace-'+token);
  if(!candidate){status.textContent='Allow pop-ups to reconnect to the workspace, then try again.';return false;}
  try{if(candidate.location.href==='about:blank'){candidate.close();location.replace(studioURL());return false;}
   if(candidate.AppWindow?.identify(token)){child=candidate;return true;}
  }catch(_){}
  status.textContent='The workspace is still opening or has navigated away. Return to that window before reopening the studio.';candidate.focus();return false;
 }
 focus.disabled=false;back.disabled=false;
 focus.onclick=()=>{if(reconnect())try{child.focus();}catch(_){};};
 back.onclick=async()=>{
  if(returning)return;
  if(!reconnect())return;
  if(child.closed){location.replace(studioURL());return;}
  returning=true;back.disabled=true;
  try{const ok=await child.AppWindow.returnHere();if(!ok){returning=false;back.disabled=false;status.textContent='Finish the current operation in the workspace, then try returning again.';child.focus();}}
  catch(_){returning=false;back.disabled=false;status.textContent='The workspace is still loading. Try again when it is ready.';}
 };
 // Navigation back is accepted only from the authenticated, current child.
 window.WorkspaceStandby={complete(w,key){if(w!==child||key!==token)return false;location.replace(studioURL());return true;},claim(w,key){if(key!==token||(child&&child!==w))return false;child=w;lastSeen=Date.now();return true;}};
 setInterval(()=>{if(child?.closed){location.replace(studioURL());}else if(lastSeen&&Date.now()-lastSeen>12000)status.textContent='The workspace may be in the background. Use Show workspace to return to it.';},750);
 return;
}
let phase=token?'opening':'active',saving=false,popup=null,popupToken=null,watch=null,heartbeat=null,overlay=null,oldInert=[];
const blocked=()=>phase!=='active';
const report=text=>window.WorkWindows?.announce(text);
function cover(text,cancel){
 if(!overlay){overlay=document.createElement('section');overlay.id='workspaceHandoff';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','handoffTitle');overlay.innerHTML='<div><h2 id="handoffTitle">Opening your workspace</h2><p id="handoffMessage" role="status"></p><button id="handoffCancel" type="button">Cancel and stay here</button></div>';document.body.append(overlay);for(const el of document.body.children)if(el!==overlay&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)){oldInert.push([el,el.inert]);el.inert=true;}}
 document.getElementById('handoffMessage').textContent=text;const b=document.getElementById('handoffCancel');b.hidden=!cancel;b.onclick=cancel;if(cancel)b.focus();
}
function uncover(){overlay?.remove();overlay=null;for(const [el,was] of oldInert)el.inert=was;oldInert=[];}
async function flush(){
 cancelPersist();await rememberQueue.catch(()=>{});
 saving=true;
 try{for(let n=0;n<3;n++){cancelPersist();const generation=persistGeneration,snapshot=sessionSnapshot();if(!snapshot)throw Error('There is no project to save.');if(await writeRemembered(snapshot,generation)!==false)return;}
  throw Error('The project is still changing. Wait for processing to finish and try again.');
 }finally{saving=false;}
}
function canTransfer(){
 if(S.restorePaused||S.storageUnavailable){report('Open the saved project successfully before moving it to another window.');return false;}
 if(S.isSample){report('Open or record your own project before popping out this workspace.');return false;}
 if(sessionLocked()||SongStudio.locked()){report('Stop recording or wait for processing to finish, then pop out this workspace.');return false;}
 return true;
}
function cancelTransfer(message){clearInterval(watch);watch=null;popupToken=null;try{popup?.close();}catch(_){}popup=null;phase='active';uncover();report(message||'Workspace opening cancelled. Your project is still here.');}
async function open(mode){
 if(token){await WorkWindows.launch(mode);return;}
 if(blocked()){try{popup?.focus();}catch(_){}return;}
 if(!canTransfer())return;
 // Must run directly in the click, before an await, to retain popup permission.
 const key=crypto.randomUUID(),child=window.open('about:blank','pvs-workspace-'+key,'popup,width=1280,height=900,resizable=yes,scrollbars=yes');
 if(!child){report('Your browser blocked the separate window. Allow pop-ups for this site, or use Expand here.');await WorkWindows.launch(mode);return;}
 popup=child;popupToken=key;phase='transferring';
 try{child.document.title='Opening Playbook workspace';child.document.body.textContent='Saving your project and opening the workspace…';}catch(_){}
 cover('Saving the project before opening a separate window…',()=>cancelTransfer());
 try{
  SongStudio.stopPlay();window.NoteTuner?.stopAudition();if(typeof endLoop==='function')endLoop();if(typeof stopPlayback==='function')stopPlayback();
  await flush();if(popupToken!==key)return;
  if(child.closed)throw Error('The separate window was closed.');
  const url=new URL(studioURL());url.searchParams.set('workspace',mode);url.searchParams.set('handoff',key);child.location.replace(url.href);
  cover('Opening the saved project. This tab will wait while you work in the separate window.',()=>cancelTransfer());
  watch=setInterval(()=>{if(child.closed)cancelTransfer('The workspace closed before it finished opening. Your project is still here.');},500);
 }catch(e){if(popupToken===key)cancelTransfer('Could not open the separate window: '+e.message);}
}
function begin(){
 if(!token)return true;
 try{
  if(window.opener?.AppWindow?.claim(window,token)||window.opener?.WorkspaceStandby?.claim(window,token))return true;
 }catch(_){}
 cover('This workspace link has expired. Close it and use Pop out from the main studio.',null);return false;
}
function pulse(){try{if(window.opener&&!window.opener.closed)window.opener.postMessage({type:'pvs-workspace',token,recording:SongStudio.state().recording},location.origin);}catch(_){};}
async function ready(ok){
 if(!token)return;
 if(!ok){cover('The saved project could not be opened. It remains safe in the original studio. Close this window and try again there.',null);try{window.opener?.AppWindow?.failed(window,token);}catch(_){}return;}
 try{
  const accepted=window.opener?.AppWindow?.accept(window,token)||window.opener?.WorkspaceStandby?.claim(window,token);
  if(!accepted){cover('The handoff was cancelled. Close this window and continue in the original studio.',null);return;}
 }catch(_){cover('The original studio closed before the handoff finished. Close this window and reopen the beta to restore your saved project.',null);return;}
 // The old tab must know this WindowProxy before editing is enabled. Otherwise
 // a quick browser-X close could beat the first heartbeat and leave it waiting.
 cover('Connecting the main tab to this workspace…',null);
 for(let attempt=0;attempt<40;attempt++){
  try{if(!window.opener||window.opener.closed||window.opener.WorkspaceStandby?.claim(window,token))break;}catch(_){}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 phase='active';uncover();pulse();heartbeat=setInterval(pulse,750);
 for(const parent of [document.getElementById('workspaceTools'),...document.querySelectorAll('.ww-window-actions')]){
  const b=document.createElement('button');b.type='button';b.className='ww-return-main';b.textContent='Return to main tab';b.onclick=()=>returnHere();parent.append(b);
 }
 document.getElementById('workspacePop').hidden=true;
 await WorkWindows.launch(requested);WorkWindows.sync();
}
async function returnHere(){
 if(blocked())return false;
 try{
  if(SongStudio.state().recording||SongStudio.state().starting||SongStudio.state().opening)await SongStudio.stopRecording('Recording kept before returning to the main tab.');
  if(!canTransfer())return false;
  if(!window.opener||window.opener.closed){clearInterval(heartbeat);token=null;WorkWindows.close();history.replaceState(null,'',studioURL());document.querySelectorAll('.ww-return-main').forEach(b=>b.remove());document.getElementById('workspacePop').hidden=false;WorkWindows.sync();report('The original tab has closed. Continue working in this window.');return true;}
  phase='returning';cover('Saving changes before returning to the main studio…',null);SongStudio.stopPlay();NoteTuner.stopAudition();await flush();
  if(!window.opener.WorkspaceStandby?.complete(window,token))throw Error('The main tab is not ready yet. Try again in a moment.');
  clearInterval(heartbeat);window.close();return true;
 }catch(e){phase='active';uncover();report('Your project is still open here: '+e.message);return false;}
}
window.AppWindow={open,begin,ready,returnHere,blocked,writeBlocked:()=>blocked()&&!saving,isChild:()=>!!token,identify:key=>!!token&&key===token,
 claim(w,key){return phase==='transferring'&&w===popup&&key===popupToken;},
 failed(w,key){if(w===popup&&key===popupToken)cancelTransfer('The separate workspace could not open the project. Your original session is still here.');},
 accept(w,key){if(phase!=='transferring'||w!==popup||key!==popupToken)return false;clearInterval(watch);phase='parked';cancelPersist();const url=new URL('workspace-standby.html',location.href);url.searchParams.set('handoff',key);location.replace(url.href);return true;}
};
})();
