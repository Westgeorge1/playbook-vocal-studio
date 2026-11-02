/* Work on copies of the selected samples. Stop and Close terminate the worker. */
'use strict';
importScripts('noise-core.js?v=0.36.2','separation.js?v=0.36.2');
function inspect({samples,offset,count,rate,width,height}){
 const pixels=new Uint8ClampedArray(width*height*4),size=1024;
 const re=new Float64Array(size),im=new Float64Array(size);
 for(let x=0;x<width;x++){
  const center=offset+Math.floor(count*x/width);im.fill(0);
  for(let j=0;j<size;j++)re[j]=(samples[center+j-size/2]||0)*(.5-.5*Math.cos(2*Math.PI*j/size));
  NoiseCore.fft(re,im);
  for(let y=0;y<height;y++){
   const hz=30*(Math.pow(1+rate/60,1-y/height)-1),k=Math.min(size/2,Math.round(hz*size/rate));
   const v=Math.max(0,Math.min(1,(20*Math.log10(Math.hypot(re[k],im[k])/size+1e-9)+95)/75));
   pixels.set([18+200*v*v,24+205*v,38+130*v,255],4*(y*width+x));
  }
 }
 return pixels;
}
function breath({samples,rate,from}){
 const hop=Math.max(1,Math.round(rate*.02)),found=[];
 let run=0;
 for(let pos=0;pos<=samples.length;pos+=hop){
  let sum=0,cross=0;const full=pos+hop<=samples.length;
  if(full)for(let j=pos+1;j<pos+hop;j++){sum+=samples[j]**2;if(samples[j]*samples[j-1]<0)cross++;}
  const rms=Math.sqrt(sum/hop);
  if(full&&rms>.0008&&rms<.13&&cross/hop>.022){run++;continue;}
  if(run>=4&&run<=65)found.push([pos-run*hop,pos]);run=0;
 }
 return found.find(r=>r[0]>=from)||found[0]||null;
}
onmessage=({data})=>{
 try{
  if(data.kind==='inspect'){
   const pixels=inspect(data);postMessage({value:pixels},[pixels.buffer]);return;
  }
  if(data.kind==='find'){postMessage({value:breath(data)});return;}
  if(data.kind!=='separate')throw Error('Unknown cleanup operation.');
  const value=data.channels.map(ch=>VocalSeparation.removed(ch,data.offset,data.offset+data.count,data.rate,data.settings));
  postMessage({value},value.map(ch=>ch.buffer));
 }catch(e){postMessage({error:e.message||String(e)});}
};
