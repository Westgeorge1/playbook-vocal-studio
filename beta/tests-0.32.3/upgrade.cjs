const port = require('../tests-0.32.4/test-port.cjs')(8965,9);
/* Upgrade and isolation regression. Point PVS_OLD_MAIN at unpacked 0.14.0 and
   PVS_OLD_BETA at unpacked 0.32.2. Uses only disposable browser storage. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const app = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pvs-upgrade-'));
const routes = { main:app, beta:app, preview:app, interrupted:app, oldmain:process.env.PVS_OLD_MAIN, oldbeta:process.env.PVS_OLD_BETA };
const origin = `http://127.0.0.1:${port}`;
const rows = [];
let server, browser;
function result(name, passed) {
  rows.push({name, pass:!!passed});
  assert.ok(passed, name);
  console.log('PASS', name);
}
async function visit(context, route) {
  const page = await context.newPage();
  await page.goto(origin + '/' + route + '/');
  await page.waitForFunction(() => typeof S !== 'undefined' && !S.loading);
  return page;
}
async function song(page) {
  return page.evaluate(() => {
    const w = S.song, region = w?.tracks[0].regions[0];
    return { title:w?.title, chosen:region?.selected, takes:(region?.takes || []).map(t =>
      [t.id, SongCore.hashPcm(w.sources[t.source].channels), t.cleanup?.db]) };
  });
}
async function rename(page, title) {
  await page.evaluate(async name => { SongStudio.edit(w => { w.title=name; }, 'Rename'); await persistNow(); }, title);
}
async function clean(context) {
  const p = await visit(context,'oldbeta');
  await p.evaluate(() => {
    const sr=48000, a=Float32Array.from({length:sr*3},(_,i)=>.2*Math.sin(i*2*Math.PI*220/sr));
    S.song=SongCore.empty(sr);
    SongStudio.edit(w=>{
      w.title='Two takes before upgrade';
      SongCore.addTake(w,{trackId:w.activeTrack,start:0,end:3,channels:[a,a.slice()],origin:0,choose:true});
    },'Import fixture');
  });
  await p.locator('[data-edit]').first().click();
  await p.locator('#songDialog button',{hasText:'Manual cleanup'}).click();
  for (const [id,value] of [['veA','0.4'],['veB','0.7']]) {
    await p.locator('#'+id).fill(value);
    await p.locator('#'+id).dispatchEvent('change');
  }
  await p.locator('#sepKeep').click();
  await p.waitForFunction(()=>S.song.tracks[0].regions[0].takes.length===2);
  await p.evaluate(()=>persistNow());
  const before=await song(p);
  const download=p.waitForEvent('download');
  await p.locator('#sgSave').click();
  await (await download).saveAs(path.join(temp,'song.zip'));
  await p.close();
  return before;
}
function testWav() {
  const sr=44100, frames=sr, wav=Buffer.alloc(44+frames*2);
  wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*2,28);wav.writeUInt16LE(2,32);
  wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(frames*2,40);
  for(let i=0;i<frames;i++)wav.writeInt16LE(Math.round(8000*Math.sin(i*.035)),44+i*2);
  return {name:'Legacy vocal.wav',mimeType:'audio/wav',buffer:wav};
}
async function oldMainSave(context) {
  const p=await visit(context,'oldmain');
  await p.locator('#fileVocal').setInputFiles(testWav());
  await p.waitForFunction(()=>S.main && S.st && !S.busy && !S.dirty);
  await p.evaluate(async()=>{cancelPersist();await writeRemembered(sessionSnapshot());});
  await p.close();
}
(async()=>{
  for(const [name,dir] of Object.entries(routes)){
    assert.ok(dir && fs.existsSync(path.join(dir,'index.html')), 'Missing source directory for '+name);
    fs.symlinkSync(path.resolve(dir),path.join(temp,name),'dir');
  }
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',temp],{stdio:'ignore'});
  browser=await chromium.launch({executablePath:process.env.PVS_CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext();await context.route('https://**/*',r=>r.abort());
  const before=await clean(context);
  // Interrupt copying after the destination transaction has started. No part
  // of the new autosave or its completion marker may survive an aborted upgrade.
  const failed=await context.newPage();
  await failed.addInitScript(()=>{
    const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){
      if (typeof key==='string' && key.startsWith('pvs@/interrupted/|src:'))
        throw new DOMException('Simulated storage limit','QuotaExceededError');
      return put.apply(this,arguments);
    };
  });
  await failed.goto(origin+'/interrupted/');
  await failed.waitForFunction(()=>typeof S!=='undefined' && S.restorePaused);
  const empty=await failed.evaluate(async()=>{
    const db=await idb();
    try {
      return await new Promise(resolve=>{
        const keys=db.transaction('s').objectStore('s').getAllKeys();
        keys.onsuccess=()=>resolve(!keys.result.some(k=>typeof k==='string' && k.startsWith(ProjectStorage.prefix)));
      });
    } finally { db.close(); }
  });
  result('Failed migration pauses saving and rolls back all destination records',empty);
  await failed.close();
  const retry=await visit(context,'interrupted');
  result('Retry restores the untouched legacy project',JSON.stringify(await song(retry))===JSON.stringify(before));
  await retry.close();
  const concurrent=await Promise.all([visit(context,'main'),visit(context,'main')]);
  const copies=await Promise.all(concurrent.map(song));
  result('Two simultaneous first opens recover the same complete project',copies.every(s=>JSON.stringify(s)===JSON.stringify(before)));
  await Promise.all(concurrent.map(page=>page.close()));
  for(const route of ['main','beta','preview']){
    const p=await visit(context,route);
    result(route+' restores original and compact cleanup audio, selected take and settings',JSON.stringify(await song(p))===JSON.stringify(before));
    await rename(p,route+' copy');
    await p.close();
  }
  const old=await visit(context,'oldbeta');
  result('Legacy snapshot still usable after three migrations',JSON.stringify(await song(old))===JSON.stringify(before));
  await old.close();
  await oldMainSave(context);
  for (const route of ['main','beta','preview']){
    const p=await visit(context,route), state=await song(p);
    result(route+' survives an overwrite by the legacy site',state.title===route+' copy' && JSON.stringify(state.takes)===JSON.stringify(before.takes));
    await p.close();
  }
  const main=await visit(context,'main');
  await main.evaluate(async()=>{SongStudio.edit(w=>{w.tracks[0].regions=[];SongCore.gc(w);},'Remove takes');await persistNow();});
  await main.close();
  const beta=await visit(context,'beta');
  result('Deleting main recordings preserves the beta audio blocks',JSON.stringify((await song(beta)).takes)===JSON.stringify(before.takes));
  await beta.close();
  const fresh=await browser.newContext();await fresh.route('https://**/*',r=>r.abort());
  await oldMainSave(fresh);
  const migrated=await visit(fresh,'main');
  result('An actual 0.14.0 WAV session migrates to the main release',(await song(migrated)).takes.length>0);
  await migrated.locator('#fileProject').setInputFiles(path.join(temp,'song.zip'));
  await migrated.waitForFunction(()=>S.song?.tracks[0].regions[0]?.takes?.length===2);
  result('A downloaded 0.32.2 project opens with both exact take hashes',JSON.stringify((await song(migrated)).takes)===JSON.stringify(before.takes));
  console.log(rows.length+' upgrade checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  await browser?.close();server?.kill();fs.rmSync(temp,{recursive:true,force:true});
});
