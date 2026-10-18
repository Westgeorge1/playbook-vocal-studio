/* Playbook Vocal Studio 0.16.0 — microphone capture worklet.
   Copies the (mono) microphone input in blocks of 2048 frames and stamps each block with the
   AudioContext frame it was rendered at, so takes recorded during playback can be placed on the
   song timeline sample-accurately. It never alters the audio. */
class PvsCapture extends AudioWorkletProcessor{
  constructor(){super();this.buf=new Float32Array(2048);this.n=0;this.start=0;this.alive=true;
    this.port.onmessage=e=>{if(e.data==='stop')this.alive=false;};}
  process(inputs){
    const input=inputs[0];const ch=input&&input[0];
    if(ch){if(this.n===0)this.start=currentFrame;
      let off=0;while(off<ch.length){const k=Math.min(ch.length-off,this.buf.length-this.n);
        if(input.length>1){const r=input[1];for(let i=0;i<k;i++)this.buf[this.n+i]=(ch[off+i]+r[off+i])*.5;}else this.buf.set(ch.subarray(off,off+k),this.n);
        this.n+=k;off+=k;if(this.n===this.buf.length){this.port.postMessage({frame:this.start,data:this.buf},[this.buf.buffer]);this.buf=new Float32Array(2048);this.n=0;this.start=currentFrame+off;}}}
    return this.alive;
  }
}
registerProcessor('pvs-capture',PvsCapture);
