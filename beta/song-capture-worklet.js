/* Exact sample-frame capture gates. Batches reduce message/GC overhead, and the
 * final partial batch is flushed before the completion acknowledgement. Only
 * the microphone enters this processor; playback has a separate output graph. */
class SongCapture extends AudioWorkletProcessor {
 constructor(options){super();const p=options.processorOptions||{};this.first=p.first;this.last=p.last;this.done=false;this.buffer=new Float32Array(2048);this.used=0;this.block=0;this.port.onmessage=e=>{if(Number.isFinite(e.data?.stopAt))this.last=Math.min(this.last,Math.max(this.first,e.data.stopAt));};}
 flush(){if(!this.used)return;const data=this.used===2048?this.buffer:this.buffer.slice(0,this.used);this.port.postMessage({frame:this.block,data},[data.buffer]);this.buffer=new Float32Array(2048);this.used=0;}
 process(inputs){
  if(this.done)return false;
  const channels=inputs[0],n=channels?.[0]?.length||128,a=Math.max(currentFrame,this.first),b=Math.min(currentFrame+n,this.last);
  for(let frame=a;frame<b;frame++){if(!this.used)this.block=frame;const j=frame-currentFrame;this.buffer[this.used++]=channels?.length?(channels.length>1?(channels[0][j]+channels[1][j])*.5:channels[0][j]):0;if(this.used===2048)this.flush();}
  if(currentFrame+n>=this.last){this.flush();this.done=true;this.port.postMessage({done:true,last:this.last});return false;}
  return true;
 }
}
registerProcessor('song-capture',SongCapture);
