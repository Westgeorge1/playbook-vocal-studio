'use strict';
importScripts('noise-core.js?v=0.31.1');
onmessage=({data:m})=>{try{let r;if(m.type==='learn')r={profile:NoiseCore.learn(m.channels,m.rate,m.start,m.end)};else if(m.type==='auto')r=NoiseCore.auto(m.channels,m.rate);else r=NoiseCore.process(m.channels,m.rate,m.settings,p=>postMessage({type:'progress',id:m.id,value:p}));const t=[];for(const c of r.channels||[])t.push(c.buffer);for(const c of r.removed||[])t.push(c.buffer);postMessage({id:m.id,...r},t);}catch(e){postMessage({id:m.id,error:e.message});}};
