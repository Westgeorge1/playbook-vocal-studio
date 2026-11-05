// This synthetic three-second project was saved through the 0.37.2 backup button.
// Its Step 7 is off, the saved engine still has de-reverb on, and it has no echoMemo.
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {suite} = require('../tests-0.32.4/browser.cjs');

async function idle(p) {
  await p.waitForFunction(() => !S.busy && !S.loading && !S.dirty && !NoteTuner.locked() && !NoiseCleaner.locked());
}

async function openPolish(p) {
  await p.locator('#rcStep2').click();
  await p.waitForFunction(() => RC.step === 'polish' && !SongPolish.state().switching && !!SongPolish.state().binding);
  await p.locator('[data-tab=clean]').click();
  await idle(p);
}

async function importProject(p, bytes) {
  await p.locator('#fileProject').setInputFiles({name:'echo-project.zip', mimeType:'application/zip', buffer:bytes});
  await p.waitForFunction(() => !sessionLocked() && !S.loading && SongCore.usage(S.song).takes === 1);
}

async function readEcho(p) {
  return p.evaluate(() => ({
    stepOff: NoiseCleaner.state().stepsOff.includes('gaps'),
    disabled: document.querySelector('#cv-echo').disabled,
    memo: NoiseCleaner.state().echoMemo, engine: S.P.chRoomReduceOn, amount: S.P.chRoomReduce,
    finalHash: SongCore.hashPcm(S.final)
  }));
}

suite('echo-restore', 62, async ({page,check}) => {
  const bytes = gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/step7-off-0.37.2.zip.gz')));
  // Inspect a saved lane before its editor has been rendered. This is the playback/export
  // path for inactive lanes; importing a backup with its editor active can rebuild it immediately.
  const cold = await page(1280,900);
  const before = await cold.evaluate(async base64 => {
    const packed = Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const files = new Map((await unzip(packed)).map(entry=>[entry.name.toLowerCase(),entry]));
    const pbv = [...files.values()].find(entry=>entry.name.endsWith('.pbv'));
    const song = await SongStudio.unpack(JSON.parse(new TextDecoder().decode(pbv.data)),files);
    SongStudio.restore({song});
    const w = S.song, t = w.tracks[0];
    const opts = {start:0,end:1};
    let exportRefused = false;
    try { SongPolish.assertExport([t]); } catch(e) { exportRefused = /Update POLISH/.test(e.message); }
    return {
      stale: !SongCore.polishValid(w,t),
      usesDry: SongCore.samePcm(SongCore.renderVoice(w,t,opts),SongCore.renderTrack(w,t,opts)),
      exportRefused, original: SongCore.hashPcm(Object.values(w.sources)[0].channels)
    };
  },bytes.toString('base64'));
  check('Legacy cached audio is stale; playback uses the original until POLISH is rebuilt',before.stale && before.usesDry);
  check('Export refuses the stale processed result from the old backup',before.exportRefused);
  await cold.context().close();
  const p = await page(1280,900);
  await importProject(p,bytes);
  await openPolish(p);
  const off = await readEcho(p);
  check('Restore applies Step 7 off before rendering and remembers de-reverb at 30%',off.stepOff && off.disabled && off.engine===0 && off.memo===1 && off.amount===30);
  check('Vocal Detail also disables the de-reverb switch while Step 7 is off',
    await p.evaluate(() => detailSwitches.chRoomReduceOn.disabled));
  await p.evaluate(async () => {
    const result=await engine({type:'run',steps:[['set','chRoomReduceOn',1]],update:true});
    absorb(result);
  });
  const protectedState=await readEcho(p);
  check('A recalled engine setting cannot render de-reverb while Step 7 is off',
    protectedState.engine===0 && protectedState.finalHash===off.finalHash);
  const toggle=p.locator('[data-step="gaps"]');
  await toggle.check(); await p.waitForFunction(() => S.P.chRoomReduceOn===1); await idle(p);
  const on=await readEcho(p);
  check('Re-enabling Step 7 restores the prior de-reverb choice',!on.stepOff && on.engine===1 && on.amount===30);
  await toggle.uncheck(); await p.waitForFunction(() => S.P.chRoomReduceOn===0); await idle(p);
  check('The migrated final matches a manually switched-off render',off.finalHash===(await readEcho(p)).finalHash);
  await p.locator('#rcStep1').click();
  await p.waitForFunction(() => RC.step==='rc' && !sessionLocked());
  check('Rebuilt audio is current and the original source still has the same PCM fingerprint',await p.evaluate(hash => SongCore.polishValid(S.song,S.song.tracks[0]) && SongCore.hashPcm(Object.values(S.song.sources)[0].channels)===hash,before.original));
  await p.evaluate(() => persistNow());
  const [download]=await Promise.all([p.waitForEvent('download'),p.evaluate(() => SongStudio.save())]);
  const corrected=fs.readFileSync(await download.path());
  await p.reload(); await p.waitForFunction(() => !!window.SongStudio && !S.loading && !sessionLocked() && SongCore.usage(S.song).takes===1);
  await openPolish(p);
  const restored=await readEcho(p);
  check('Autosave reload keeps the corrected final and remembered switch',restored.finalHash===off.finalHash && restored.engine===0 && restored.memo===1);
  const fresh=await page(1280,900); await importProject(fresh,corrected); await openPolish(fresh);
  const reopened=await readEcho(fresh);
  check('A fresh browser opening the re-saved backup gets the corrected final',reopened.finalHash===off.finalHash && reopened.engine===0 && reopened.memo===1);
  await p.context().close(); await fresh.context().close();
});
