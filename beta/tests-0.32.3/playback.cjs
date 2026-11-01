/* Compare two independently served releases on one Chromium runtime.
   Set PVS_REFERENCE_DIR to an unpacked, previously approved release. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { synth } = require('../tests-0.32.0/fixtures/synth-vocal.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'pvs-audition-'));
const reference = process.env.PVS_REFERENCE_DIR;
const raw = Buffer.from(Float32Array.from(synth(11).a).buffer).toString('base64');
const port = Number(process.env.PVS_COMPARE_PORT || require('../tests-0.32.4/test-port.cjs')(8966,8));
let browser, server;
async function fingerprint(page) {
  return page.evaluate(async () => {
    const sum = async channels => Promise.all(channels.map(async x => {
      const bytes = new Uint8Array(x.buffer,x.byteOffset,x.byteLength);
      const hash = await crypto.subtle.digest('SHA-256',bytes);
      return [x.length, Array.from(new Uint8Array(hash), b=>b.toString(16).padStart(2,'0')).join('')];
    }));
    return {rate:S.rate,tuned:await sum(NoteTuner.debug().tuned),final:await sum(S.final)};
  });
}
async function render(route) {
  const ctx = await browser.newContext({viewport:{width:1440,height:900}});
  await ctx.route('https://**/*',r=>r.abort());
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:'+port+'/'+route+'/');
  await p.waitForFunction(()=>window.SongStudio && !S.loading);
  await p.evaluate(base64=>{
    const sample = new Float32Array(Uint8Array.from(atob(base64), c=>c.charCodeAt(0)).buffer);
    S.song=SongCore.empty(44100);S.song.key=7;S.song.scale=1;
    SongStudio.edit(w=>SongCore.addTake(w,{trackId:w.activeTrack,start:0,end:sample.length/44100,channels:[sample],origin:0,choose:true}),'Tuning test');
  },raw);
  const idle=()=>p.waitForFunction(()=>!S.busy&&!S.dirty&&!NoteTuner.locked()&&!NoiseCleaner.locked(),null,{timeout:120000});
  await p.evaluate(()=>SongPolish.open(S.song.activeTrack));await idle();
  await p.evaluate(()=>showPage('tune'));
  const fr = p.frames().find(f=>f.url().includes('note-editor.html'));
  await fr.evaluate(()=>{
    window.confirm=()=>true;
    const input=document.getElementById('refHz');input.value='443.8';input.dispatchEvent(new Event('change'));
  });
  const output={};
  for(const id of ['none','presetSnapSmooth','presetCenterSmooth']){
    if(id!=='none')await fr.locator('#'+id).click();
    await p.waitForTimeout(500);await idle();output[id]=await fingerprint(p);
  }
  if(route==='candidate'){
    await fr.evaluate(()=>{
      window.heard=[];
      const start=AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start=function(...args){
        if(this.buffer?.length>32000)heard.push(parent.SongCore.hashPcm([this.buffer.getChannelData(0)]));
        return start.apply(this,args);
      };
    });
    await fr.locator('#abOrig').click();
    await fr.locator('#cmpStart').click();
    assert.equal(await fr.locator('#abTuned').getAttribute('aria-pressed'),'true');
    const heard=[];
    for(let i=0;i<3;i++){
      // Even if the user switches to input again, Hear must route the tuned buffer.
      await fr.locator('#abOrig').click();
      await fr.evaluate(()=>heard.length=0);
      await fr.locator('#cmpPlays button').nth(i).click();
      await fr.waitForFunction(()=>heard.length>0);
      assert.equal(await fr.locator('#abTuned').getAttribute('aria-pressed'),'true');
      heard.push(await fr.evaluate(()=>heard.at(-1)));
      await fr.locator('#play').click();
    }
    assert.equal(new Set(heard).size,3);
    console.log('PASS X/Y/Z played three distinct tuned audio buffers from Cleaned input');
  }
  await ctx.close();return output;
}
(async()=>{
  assert.ok(reference,'Set PVS_REFERENCE_DIR to the reference source directory');
  fs.symlinkSync(path.resolve(reference),path.join(dir,'reference'),'dir');
  fs.symlinkSync(path.resolve(__dirname,'..'),path.join(dir,'candidate'),'dir');
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',dir],{stdio:'ignore'});
  browser=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
  const [ref,candidate]=await Promise.all(['reference','candidate'].map(render));
  for(const id of Object.keys(ref)){
    assert.deepEqual(candidate[id],ref[id],id+' tuned and final PCM');
    console.log('PASS identical tuned and final PCM versus the reference',id,JSON.stringify(candidate[id]));
  }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  await browser?.close();server?.kill();fs.rmSync(dir,{recursive:true,force:true});
});
