/* Recording deadlines follow the audio clock. A separate five-second stall
 * guard retains received audio if either the clock or capture stops advancing. */
(function(root){
 'use strict';
 function start({first,last,rate,audioTime,frames,onEnd,onStall,
  now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout,
  stallMs=5000,pollMs=250}){
  let clock=audioTime(),count=frames(),clockAt=now(),framesAt=clockAt;
  let stopped=false,timer=null,stallPending=false;
  function stop(){stopped=true;if(timer!==null)cancel(timer);timer=null;}
  function tick(){
   if(stopped)return;
   const wall=now(),audio=audioTime(),received=frames();
   if(audio>clock){clock=audio;clockAt=wall;}
   if(received>count){count=received;framesAt=wall;stallPending=false;}
   if(audio>=last/rate){stop();onEnd();return;}
   // No microphone batch is due during scheduled pre-roll. Allow a batch
   // after the first sample before starting the missing-capture deadline.
   const captureDue=audio>=first/rate+.1;
   if(!captureDue)framesAt=wall;
   const stalled=wall-clockAt>=stallMs||(captureDue&&wall-framesAt>=stallMs);
   if(stalled&&stallPending){stop();onStall();return;}
   // Confirm on the next tick so queued worklet messages get a chance to run
   // after a busy main thread resumes. Any new progress cancels the suspicion.
   stallPending=stalled;
   timer=schedule(tick,pollMs);
  }
  timer=schedule(tick,pollMs);
  return {stop};
 }
 if(typeof module==='object'&&module.exports)module.exports={start};
 else root.CaptureWatchdog={start};
})(typeof globalThis==='object'?globalThis:this);
