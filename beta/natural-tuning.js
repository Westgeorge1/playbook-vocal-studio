/* Natural automatic correction for the Note Editor. No audio resynthesis here:
 * move a stable note centre while retaining its sung pitch movement. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function target(p,pcs,reference,keepBlue){
 const q=p-reference,rounded=Math.round(q),pc=((rounded%12)+12)%12;
 if(keepBlue&&!pcs.has(pc)&&Math.abs(q-rounded)<=.35)return rounded+reference;
 let best=rounded,d=Infinity;
 for(let k=Math.floor(q)-6;k<=Math.ceil(q)+6;k++)if(pcs.has(((k%12)+12)%12)&&Math.abs(k-q)<d){d=Math.abs(k-q);best=k;}
 return best+reference;
}
function manual(n){return !!n.man||Math.abs(n.shift||0)>1e-7||(n.drift||0)>0||Math.abs((n.vib??1)-1)>1e-7||Math.abs(n.tr||0)>1e-7;}
function apply(o){
 const {edited,notes,hop}=o,final=Float32Array.from(edited),amount=clamp(o.amount??.85,0,1);
 const pcs=new Set(o.pcs??[0,1,2,3,4,5,6,7,8,9,10,11]),reference=12*Math.log2((o.ref||440)/440);
 const speed=clamp(o.speedMs??70,20,200)/1000,edge=Math.max(1,Math.ceil(speed/hop));
 const review=[],corrected=[],untouched=[];
 if(!amount)return {final,review,corrected,untouched:notes.map((_,i)=>i)};
 for(let ni=0;ni<notes.length;ni++){
  const nt=notes[ni],a=Math.max(0,nt.i0),b=Math.min(edited.length-1,nt.i1),duration=(b-a+1)*hop;
  // Explicit note edits own their target. Never add a second correction to them.
  if(manual(nt)){untouched.push(ni);continue;}
  const centre=nt.center,goal=target(centre,pcs,reference,o.keepBlue!==false),delta=goal-centre,d=Math.abs(delta);
  if(nt.review||!Number.isFinite(centre)||duration<.12||d>.6){review.push(ni);continue;}
  if(o.keepInTune!==false&&d<=.1){untouched.push(ni);continue;}
  // A soft knee prevents a 10-cent threshold from becoming an abrupt on/off jump.
  const knee=o.keepInTune===false?1:ease((d-.1)/.15);
  if(knee===0){untouched.push(ni);continue;}
  let used=false;
  for(let i=a;i<=b;i++){
   if(!Number.isFinite(edited[i]))continue;
   // Fade at note boundaries, and retain consonants and uncertain pitch frames.
   const confidence=o.quality?ease(((o.quality[i]||0)-.65)/.2):1;
   const consonant=o.sibilants?.[i]?0:1;
   const boundary=ease((i-a)/edge)*ease((b-i)/edge);
   let expression=1;
   if(o.expression!==false){
    let sum=0,count=0;
    for(let k=Math.max(a,i-4);k<=Math.min(b,i+4);k++)if(Number.isFinite(edited[k])){sum+=edited[k];count++;}
    const movement=count?Math.abs(sum/count-centre):0;
    expression=1-ease((movement-.65)/.6);
   }
   const correction=amount*delta*knee*boundary*confidence*consonant*expression;
   final[i]=edited[i]+correction;if(Math.abs(correction)>1e-7)used=true;
  }
  (used?corrected:untouched).push(ni);
 }
 return {final,review,corrected,untouched};
}
const api={apply,target,manual};if(typeof module==='object'&&module.exports)module.exports=api;else root.NaturalTuning=api;
})(typeof globalThis!=='undefined'?globalThis:this);
