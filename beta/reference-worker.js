importScripts('quality-core.js?v=0.27.0','reference-core.js?v=0.27.0');
onmessage=({data:m})=>{try{const profiles=m.clips.map(c=>m.kind==='match'?QualityCore.measure(c.channels,c.rate):ReferenceCore.analyze(c.channels,c.rate));postMessage({profiles});}catch(e){postMessage({error:e.message});}};
