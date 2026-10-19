/* Playbook Vocal Studio 0.18.2 — Recovered audio (from 0.18.1, with fixes).
   Audio that could not be placed as a take (a failed add, an unfinished loop ending, a loop pass that did not fit, an
   interrupted punch) is kept here. The list is included in the browser autosave and in Save project, and every file
   can be downloaded. The list only shows (badge at the top of RECORD & COMP) when there is something in it. */
(function(){
'use strict';
const list=()=>S.recoveryFiles||(S.recoveryFiles=[]);
const bytes=()=>list().reduce((n,f)=>n+(f.blob?.size||0),0);
const ext=type=>/wav/.test(type)?'wav':/mp4|m4a|aac/.test(type)?'m4a':/ogg/.test(type)?'ogg':'webm';
const LIMIT=32*1024*1024;
function changed(){try{persist();}catch(e){}if(window.Studio)Studio.sync();}
function keep(blob,name,reason){
 if(!(blob instanceof Blob)||!blob.size)return null;
 const old=list().find(f=>f.blob===blob);if(old)return old;
 const item={id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),name:String(name||'Recovered recording'),reason:String(reason||'The recording could not be placed as a take'),blob,at:Date.now()};
 list().push(item);changed();
 toast('Audio kept for recovery','“'+item.name+'” is under Recovered audio (the badge at the top). Download it from there. It is also saved with your project.',10000);return item;
}
async function pack(root,files){root.phoneRecovery=[];for(const f of list()){const file='pbv-recovery-'+root.phoneRecovery.length+'.'+ext(f.blob.type);files.push({name:file,data:new Uint8Array(await f.blob.arrayBuffer())});root.phoneRecovery.push({id:f.id,name:f.name,reason:f.reason,file,type:f.blob.type,at:f.at||0});}}
function unpack(root,files){if(root.phoneRecovery===undefined)return [];if(!Array.isArray(root.phoneRecovery))throw new Error('Invalid recovered audio list.');
 return root.phoneRecovery.map(f=>{const data=files.get(baseName(f.file).toLowerCase());if(!data)throw new Error('Recovered recording is missing from the project: '+f.file);return {id:String(f.id),name:String(f.name),reason:String(f.reason),at:+f.at||0,blob:new Blob([data.data],{type:f.type||'audio/webm'})};});}
function fileName(f){return safeName(f.name)+'.'+ext(f.blob.type);}
async function download(id){const f=list().find(f=>f.id===id);if(!f)return null;const status=await saveDownload(fileName(f),f.blob);toast(status,fileName(f)+' — keep the recovery copy until you have checked the file.');return status;}
// 0.18.1 removed EVERY recovery copy here (filter(f=>f!==f)); 0.18.2 removes only the one you picked.
function remove(id,noAsk){if(sessionLocked())return false;const f=list().find(x=>x.id===id);if(!f)return false;
 if(!noAsk&&!confirm('Remove the recovery copy “'+f.name+'”?\n\nDownload and check it first. This cannot be undone.'))return false;
 S.recoveryFiles=list().filter(x=>x!==f);changed();return true;}
function canRecord(){if(bytes()<LIMIT)return true;toast('Save your recovered audio first','Recovered audio is using 32 MB. Download the files under Recovered audio and remove their recovery copies before recording more.');return false;}
window.Recovery={list,bytes,keep,pack,unpack,download,remove,canRecord,fileName,LIMIT};
})();
