/* Local time-frequency selection (soft band edges since 0.32.2). Return the removed component; the edited
   signal is the original minus this component. Square-root Hann windows at
   half-window hops sum to unity after analysis and synthesis. */
(function(root){
'use strict';
const fft=typeof module==='object'?require('./noise-core.js').fft:root.NoiseCore.fft;
const n=2048, hop=n/2;
const window=Float64Array.from({length:n},(_,i)=>Math.sin(Math.PI*i/n));
function removed(source,start,end,rate,settings){
  const {low,high,db,fade}=settings;
  if(![low,high,db,fade].every(Number.isFinite)||low<0||high<=low||low>=rate/2||db<0||db>36||fade<0||fade>100)throw Error('Check the frequency range, reduction and edge fade.');
  const count=end-start, result=new Float32Array(count);
  if(count>rate*30)throw Error('Select up to 30 seconds for a local edit.');
  const strength=1-10**(-db/20), edge=Math.min(count/2,rate*fade/1000);
  // 0.32.2: soft band edges (raised-cosine, about 15% of the edge frequency, 20-400 Hz wide) instead of a
  // brick wall, so narrow cuts don't ring. A band starting at 0 Hz or reaching Nyquist has no edge there.
  const ramp=f=>Math.min(400,Math.max(20,f*.15)),gain=new Float64Array(n/2+1);
  for(let k=0;k<=n/2;k++){const hz=k*rate/n;let g=1;
    if(low>0){const w=ramp(low),x=(hz-(low-w/2))/w;g*=x<=0?0:x>=1?1:.5-.5*Math.cos(Math.PI*x);}
    if(high<rate/2){const w=ramp(high),x=((high+w/2)-hz)/w;g*=x<=0?0:x>=1?1:.5-.5*Math.cos(Math.PI*x);}
    gain[k]=g;}
  if(low===0&&high>=rate/2)result.set(source.subarray(start,end));
  else{
    const re=new Float64Array(n),im=new Float64Array(n);
    for(let at=-hop;at<count;at+=hop){
      im.fill(0);
      for(let i=0;i<n;i++)re[i]=(source[start+at+i]||0)*window[i];
      fft(re,im);
      for(let k=0;k<n;k++){
        const g=gain[Math.min(k,n-k)];
        if(g!==1){re[k]*=g;im[k]*=g;}
      }
      fft(re,im,true);
      for(let i=Math.max(0,-at);i<Math.min(n,count-at);i++)result[at+i]+=re[i]*window[i];
    }
  }
  for(let i=0;i<count;i++)result[i]*=strength*(edge?Math.min(1,i/edge,(count-1-i)/edge):1);
  return result;
}
const api={removed};if(typeof module==='object'&&module.exports)module.exports=api;else root.VocalSeparation=api;
})(globalThis);
