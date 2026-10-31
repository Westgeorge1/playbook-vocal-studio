/* Deterministic synthetic sung line for tuning tests: G major at A = 440, with scoops into notes,
 * vibrato after the onset, slow drift, a fall at the end and random detune up to +/-40 cents.
 * Returns {R, a:number[], notes:[{t0,t1,mid,det}]}. */
function synth(seed){
 let s=seed;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
 const R=44100,notes=[],scale=[55,57,59,60,62,64,66,67,69,71];let t=.3;const f0=[];const env=[];
 while(t<14){const dur=.35+rnd()*.9,mid=scale[Math.floor(rnd()*scale.length)],det=(rnd()-.5)*.8,scoop=-(.5+rnd()*.8),vib=.25+rnd()*.15,vr=5+rnd()*1.2,dr=(rnd()-.5)*.3,tail=-(rnd()*.5);notes.push({t0:t,t1:t+dur,mid,det});
  for(let i=Math.round(t*R);i<Math.round((t+dur)*R);i++){const u=i/R-t;let p=mid+det;
   p+=u<.07?scoop*(1-u/.07)*(1-u/.07):0;                        // scoop into the note
   p+=u>.22?vib*Math.min(1,(u-.22)/.15)*Math.sin(2*Math.PI*vr*(u-.22)):0; // vibrato after onset
   p+=dr*Math.sin(Math.PI*u/dur);                                 // slow drift
   p+=(dur-u)<.06?tail*(1-(dur-u)/.06):0;                         // fall at the end
   f0[i]=440*Math.pow(2,(p-69)/12);env[i]=Math.min(1,u/.02,(dur-u)/.03);}
  t+=dur+.06+rnd()*.15;}
 const n=Math.round(t*R)+R/2,a=new Float32Array(n);let ph=0;
 for(let i=0;i<n;i++){const f=f0[i];if(!f){ph=0;continue;}ph+=2*Math.PI*f/R;let v=0;for(let k=1;k<=12;k++){const fk=f*k;if(fk>7000)break;const g=Math.exp(-(((fk-700)/500)**2))+.6*Math.exp(-(((fk-1200)/600)**2))+.3*Math.exp(-(((fk-2600)/800)**2));v+=g*Math.sin(k*ph)/k;}a[i]=.25*env[i]*v;}
 return {R,a:Array.from(a),notes};
}
module.exports={synth};
/* A consistent singer for reference tests: every note sits `offsetC` cents from A = 440, plus a slow drift that
 * rises by `driftC` cents from start to end, plus small (+/-6 cent) note-to-note scatter. Vibrato and scoops as above. */
function singer(seed,offsetC=17,driftC=20){
 let s=seed;const rnd=()=>((s=(s*16807)%2147483647)/2147483647);
 const R=44100,notes=[],scale=[55,57,59,60,62,64,66,67,69,71],total=16;let t=.3;const f0=[],env=[];
 while(t<total){const dur=.4+rnd()*.8,mid=scale[Math.floor(rnd()*scale.length)],off=(offsetC+driftC*t/total+(rnd()-.5)*12)/100;notes.push({t0:t,t1:t+dur,mid,sung:mid+off,tc:t+dur/2});
  for(let i=Math.round(t*R);i<Math.round((t+dur)*R);i++){const u=i/R-t;let p=mid+off;p+=u<.06?-.5*(1-u/.06)**2:0;p+=u>.22?.25*Math.min(1,(u-.22)/.15)*Math.sin(2*Math.PI*5.5*(u-.22)):0;f0[i]=440*Math.pow(2,(p-69)/12);env[i]=Math.min(1,u/.02,(dur-u)/.03);}
  t+=dur+.08+rnd()*.12;}
 const n=Math.round(t*R)+R/2,a=new Float32Array(n);let ph=0;
 for(let i=0;i<n;i++){const f=f0[i];if(!f){ph=0;continue;}ph+=2*Math.PI*f/R;let v=0;for(let k=1;k<=12;k++){const fk=f*k;if(fk>7000)break;const g=Math.exp(-(((fk-700)/500)**2))+.6*Math.exp(-(((fk-1200)/600)**2))+.3*Math.exp(-(((fk-2600)/800)**2));v+=g*Math.sin(k*ph)/k;}a[i]=.25*env[i]*v;}
 return {R,a:Array.from(a),notes,offsetC,driftC,total};
}
module.exports.singer=singer;
