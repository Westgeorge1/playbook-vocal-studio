/* 0.28.0: conservative starting choices and review metadata; no DSP changes. */
(function(root){
'use strict';
const ceiling=-1.6;
function gentle(){return {cleanOn:1,cleanMode:0,cleanAmount:6,cleanSens:100,rumble:0,humFilter:0};}
function cleaning(report,finished=false){
 const snr=report?.snrDb;
 const bypass=finished||!Number.isFinite(snr)||snr>=38;
 return {...gentle(),cleanOn:bypass?0:1};
}
function steps(params){return Object.entries(params).map(([k,v])=>['set',k,v]);}
function pitchReview(notes){return {v:1,notes:(notes||[]).filter(n=>n[13]>.5).map(n=>[n[0],n[1]])};}
function validReview(r){return r?.v===1&&Array.isArray(r.notes)&&r.notes.length<=100000&&r.notes.every(n=>Array.isArray(n)&&n.length===2&&n.every(Number.isFinite)&&n[0]>=0&&n[1]>n[0]);}
function reviewTracks(w){
 const solo=w?.tracks.some(t=>t.solo);
 return (w?.tracks||[]).filter(t=>!t.mute&&(!solo||t.solo)&&t.regions?.some(r=>r.selected)&&t.polish&&!t.polish.bypass).map(t=>{
  const s=t.polish.session,r=s?.pitchReview,p=s?.P||{},ne=s?.noteTuner,ns=ne?.editor?.settings,tuning=ne?.mode==='note'?!!(ns?.smoothOn&&ns.smooth>0||ns?.notes?.some(n=>Math.abs(n[3])>1e-7||n[4]>0)):p.amount>0||p.drift>0;
  return {id:t.id,name:t.name,tuning,known:!tuning||validReview(r),count:tuning&&validReview(r)?r.notes.length:0};
 });
}
const api={ceiling,gentle,cleaning,steps,pitchReview,validReview,reviewTracks};
if(typeof module==='object'&&module.exports)module.exports=api;else root.FinishPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
