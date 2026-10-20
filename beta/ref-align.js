// 0.24 F7: compare takes with the reference even when the note counts differ.
// phrase-core.js is engine code and stays unchanged; this wrapper re-scores rows after PhraseCore.rank.
(function(root){'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),median=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null;};
// Dynamic time warping over stable notes. Cost = pitch distance (semitones) + onset distance (relative to phrase start, seconds*4).
function align(a,b){const n=a.length,m=b.length;if(!n||!m)return null;const a0=a[0].start,b0=b[0].start,INF=1e18;
 const cost=(i,j)=>Math.abs(a[i].pitch-b[j].pitch)+Math.abs((a[i].start-a0)-(b[j].start-b0))*4;
 const D=Array.from({length:n+1},()=>new Float64Array(m+1).fill(INF));D[0][0]=0;
 for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)D[i][j]=cost(i-1,j-1)+Math.min(D[i-1][j-1],D[i-1][j]+.5,D[i][j-1]+.5);
 const pairs=[];let i=n,j=m;while(i>0&&j>0){pairs.push([i-1,j-1]);const d=D[i-1][j-1],u=D[i-1][j]+.5,l=D[i][j-1]+.5;if(d<=u&&d<=l){i--;j--;}else if(u<=l)i--;else j--;}
 pairs.reverse();// keep one best partner per take note
 const best=new Map();for(const [x,y] of pairs){const c=cost(x,y);if(!best.has(x)||c<best.get(x)[1])best.set(x,[y,c]);}
 return [...best].map(([x,[y]])=>[x,y]);}
function compare(take,ref){const s=take?.stable||[],r=ref?.stable||[];
 if(!s.length||!r.length)return {ok:false,why:!s.length?'no steady notes were found in this take':'no steady notes were found in the reference'};
 const p=align(s,r);const used=new Set(p.map(x=>x[1])).size,cover=Math.min(p.length/s.length,used/r.length);
 if(cover<.5)return {ok:false,why:'the notes are too different from the reference to line up'};
 const off=Math.abs(s[0].start-r[0].start);
 return {ok:true,pitch:median(p.map(([i,j])=>Math.abs(s[i].pitch-Math.round(r[j].pitch))*100)),timing:median(p.map(([i,j])=>Math.abs((s[i].start-r[j].start))*1000)),matched:p.length,takeNotes:s.length,refNotes:r.length,shift:off};}
function rank(p,key=0,scale=0){const out=PhraseCore.rank(p,key,scale);const ref=p.takes.find(t=>t.id===p.reference)?.profile;if(!ref)return out;
 const useContrast=p.takes.every(t=>t.profile&&Number.isFinite(t.profile.contrast));
 for(const row of out.rows){const t=p.takes.find(x=>x.id===row.id),a=t?.profile;if(!a||a.v!==1||row.melody)continue;
  const c=compare(a,ref);
  if(!c.ok){row.refNote='Not compared with the reference: '+c.why+'.';row.reason=row.reason+'. '+row.refNote;continue;}
  row.pitch=c.pitch;row.timing=c.timing;row.melody=true;row.aligned=true;row.matched=c.matched;
  let score=0,weight=0;const add=(v,w)=>{score+=clamp(v,0,100)*w;weight+=w;};
  if(useContrast)add((a.contrast-10)*2,2);add(100-row.pitch*1.5,2);add(100-a.clippedPercent*150,1);add(100-row.timing/3,1);
  // notes that could not be paired count against the take
  const missing=Math.abs(c.takeNotes-c.refNotes);score-=Math.min(20,missing*5)*weight/6;
  row.score=weight?Math.max(0,score/weight):0;row.reason+=' · '+c.takeNotes+' notes lined up with the reference\'s '+c.refNotes;}
 const allReady=p.takes.every(t=>t.profile||t.analysisError),eligible=out.rows.filter(r=>r.eligible).sort((a,b)=>b.score-a.score);
 out.winner=allReady&&eligible.length>=2&&eligible[0].score-eligible[1].score>=3?eligible[0].id:null;out.tied=allReady&&eligible.length>=2&&!out.winner;return out;}
const api={align,compare,rank};root.RefAlign=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
