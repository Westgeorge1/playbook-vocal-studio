importScripts('quality-core.js?v=0.29.0');
onmessage=({data:m})=>{try{const r=m.type==='finish'?QualityCore.finish(m.channels,m.rate,m.settings):QualityCore.measure(m.channels,m.rate);postMessage({result:r},Array.isArray(r.channels)?r.channels.map(c=>c.buffer):[]);}catch(e){postMessage({error:e.message});}};
