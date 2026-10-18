// Runs the Vocal Studio engine (the same C++ as the Windows app, compiled to WebAssembly)
// off the main thread. 0.9.8: one engine for every phone (needs WebAssembly exception handling:
// iPhone iOS 15.2+, Android Chrome 95+). The old plain-JavaScript fallback ran 0.9.3 code and is gone.
let M = null, engineKind = '';
async function boot() {
  importScripts('engine-wasm.js?v=0.12.1'); M = await PVEngineWasm('engine-wasm.wasm?v=0.12.1'); engineKind = 'wasm';
  postMessage({ type: 'ready', engine: engineKind });
}
const ready = boot().catch(err => postMessage({ type: 'error', message: 'The audio engine could not start on this browser (it needs iOS 15.2+ or Chrome 95+): ' + (err && err.message || err) }));

// HEAPF32 can be replaced when memory grows, so always copy right after a call
const floats = (ptr, n) => ptr && n ? new Float32Array(M.HEAPF32.buffer, ptr, n).slice() : new Float32Array(0);
const text = ptr => M.UTF8ToString(ptr);
// allocate first, THEN read HEAPF32 (allocation can grow memory and replace the heap view)
function put(arr, alloc) { const ptr = alloc(); M.HEAPF32.set(arr, ptr >> 2); }
function put64(arr, alloc) { const ptr = alloc(); M.HEAPF64.set(arr, ptr >> 3); }
function withString(s, f) { const n = M.lengthBytesUTF8(s) + 1, p = M._malloc(n); M.stringToUTF8(s, p, n); try { return f(p); } finally { M._free(p); } }
function check(r) { if (r === -1) throw new Error(text(M._pv_error()) || 'Could not finish this operation.'); return r; }
function audio(which) {
  const n = M._pv_length(which); if (!n) return null;
  const ch = M._pv_channels ? M._pv_channels(which) : (which===4||which===7||which===8||which===9||(which>=10&&which<=12)?2:1), out = [];
  for (let c = 0; c < ch; c++) out.push(floats(M._pv_buffer(which, c), n));
  return out;
}
function putInput(m){const channels=m.channels||[m.samples];if(!channels.length||channels.length>2||!channels[0]?.length||channels.some(c=>c.length!==channels[0].length))throw new Error('Use mono or stereo audio with equal channel lengths.');put(channels[0],()=>M._pv_input(channels[0].length));if(channels[1])put(channels[1],()=>M._pv_input_right(channels[1].length));}
// one step = [name, ...args]
const STEPS = {
  set: (id, v) => withString(id, p => M._pv_set(p, v)),
  style: s => M._pv_style(s), preset: p => M._pv_chain_preset(p), autoClean: () => M._pv_auto_clean(), learnRange: () => M._pv_learn_range(),
  pushUndo: () => M._pv_push_undo(), undo: () => M._pv_undo(), redo: () => M._pv_redo(),
  noteSet: (i, target, enabled, manual) => M._pv_note_set(i, target, enabled ? 1 : 0, manual ? 1 : 0),
  noteShape: (i, h) => M._pv_note_shape(i, h.vibrato, h.drift, h.slideMs, h.bend, h.scoop, h.scoopMs),
  noteGain: (i, db) => M._pv_note_gain(i, db), split: (i, t) => M._pv_note_split(i, t), merge: i => M._pv_note_merge(i),
  retarget: keep => M._pv_retarget(keep ? 1 : 0), resetNotes: () => M._pv_reset_notes(),
  edit: (kind, index, a, b, c, d, e) => check(M._pv_edit_set(kind, index, a, b, c || 0, d || 0, e || 0)),
  editRemove: (kind, index) => M._pv_edit_remove(kind, index),
  guidePrefs: (enabled, goal, bpm, sync) => M._pv_guide_prefs(enabled ? 1 : 0, goal, bpm, sync ? 1 : 0),
  guideDismiss: keep => M._pv_guide_dismiss(keep ? 1 : 0), guideReset: () => M._pv_guide_reset(),
  guideRestore: (locked, dismissed) => withString(locked, a => withString(dismissed, b => M._pv_guide_restore(a, b))),
  guideApply: () => M._pv_guide_apply(),
  guideConcern: c => M._pv_guide_concern(c),
  exportMask: mask => M._pv_export_mask(mask),
  resetPreset: finishing => M._pv_reset_preset(finishing ? 1 : 0), resetSettings: () => M._pv_reset_settings(),
  notes: list => { put64(Float64Array.from(list.flat()), () => M._pv_notes_input(list.length)); if (!M._pv_notes_apply(list.length)) throw new Error('Saved note edits did not fit this recording.'); },
};
function snapshot(mask, extra) {
  const msg = { state: JSON.parse(text(M._pv_state())), guide: JSON.parse(text(M._pv_guide())), mask, audio: {} };
  const want = new Set(extra || []);
  if (mask & 1) { want.add(0); want.add(6); }
  if (mask & 2) { want.add(1); want.add(2); }
  if (mask & 8) { want.add(3); const fc = M._pv_frame_count(); msg.frames = floats(M._pv_frames(), fc); msg.after = floats(M._pv_after(), fc); }
  if (mask & 16) { want.add(4); msg.spectrum = [floats(M._pv_spectrum(0), 160), floats(M._pv_spectrum(1), 160)]; }
  for (const w of want) msg.audio[w] = audio(w);
  return msg;
}
function transfer(msg) { const t = []; for (const k in msg.audio) if (msg.audio[k]) for (const a of msg.audio[k]) t.push(a.buffer); return t; }
onmessage = async ({ data: m }) => {
  await ready; if (!M) return;
  const reply = (body) => { body.type = 'done'; body.id = m.id; postMessage(body, transfer(body)); };
  try {
    if (m.type === 'clear') {
      // A fresh module discards every take, render, reference and Undo buffer.
      M = await PVEngineWasm('engine-wasm.wasm?v=0.12.1');M._pv_import_kind(0);reply(snapshot(0));
    } else if (m.type === 'open') {
      postMessage({ type: 'stage', text: 'Measuring your voice and the background...' });
      putInput(m);
      if(!m.keep && m.importKind!=null)M._pv_import_kind(m.importKind);
      const mask = check(M._pv_load(m.rate, m.keep === 2 ? 2 : m.keep ? 1 : 0, m.detectKey ? 1 : 0));
      reply(snapshot(mask, [5, 100]));
    } else if (m.type === 'take') {
      putInput(m);
      const index = check(M._pv_take_add(m.rate));
      const body = snapshot(0, [100 + index]); body.take = index; reply(body);
    } else if(m.type==='reference'){putInput(m);check(M._pv_reference(m.start,m.duration,m.rate));reply({audio:{13:audio(13),14:audio(14)},profile:JSON.parse(text(M._pv_reference_profile()))});
    } else if (m.type === 'run') {
      for (const [name, ...args] of m.steps || []) STEPS[name](...args);
      const mask = m.update ? check(M._pv_update()) : 0;
      reply(snapshot(mask, m.want));
    } else if (m.type === 'preview') {
      const ok = check(M._pv_guide_preview());
      reply(snapshot(0, ok ? [7, 8] : []));
    } else if(m.type==='detail'){
      if(!check(M._pv_detail_preview(m.group)))throw new Error('Wait for Ready and enable the chain for tone/space effects.');
      reply({audio:{10:audio(10),11:audio(11),12:audio(12)},gains:[M._pv_detail_gain(0),M._pv_detail_gain(1),M._pv_detail_gain(2)]});
    } else if (m.type === 'custom') {   // 0.10: render the ticked stages, matched against FINAL
      postMessage({ type: 'stage', text: 'Rendering your export choice...' });
      check(M._pv_custom(m.mask));
      const body = { audio: { 9: audio(9) }, gains: [M._pv_custom_gain(0), M._pv_custom_gain(1)], lufs: M._pv_custom_lufs(),
                     savedSheet: withString(m.name || '', p => text(M._pv_sheet(p, m.mask, 2))),
                     sheet: withString(m.name || '', p => text(M._pv_sheet(p, m.mask, 1))) };
      reply(body);
    } else if (m.type === 'sheet') {
      const body = { sheet: withString(m.name || '', p => text(M._pv_sheet(p, m.mask, 0))) }; reply(body);
    } else if (m.type === 'beat') {   // keep the beat in the engine (it is fitted after every render)
      M._pv_beat_clear(); if (m.channels) m.channels.forEach((c, i) => put(c, () => M._pv_beat_input(i, c.length)));
      postMessage({ type: 'done', id: m.id });
    } else if (m.type === 'beatfit') {
      const n = check(M._pv_beat_fit(m.rate, m.over, m.room));
      const body = { type: 'done', id: m.id, L: floats(M._pv_beat_out(0), n), R: floats(M._pv_beat_out(1), n), gainDb: M._pv_beat_gain(), roomDb: M._pv_beat_room() };
      postMessage(body, n ? [body.L.buffer, body.R.buffer] : []);
    } else if (m.type === 'master') {
      postMessage({ type: 'stage', text: 'Mastering the rough mix...' });
      const n = m.L.length;
      put(m.L, () => M._pv_mix(0, n)); put(m.R, () => M._pv_mix(1, n));
      M._pv_master(m.lufs, m.ceiling);
      const body = { L: floats(M._pv_mix_out(0), n), R: floats(M._pv_mix_out(1), n), lufs: M._pv_master_lufs(), peak: M._pv_master_peak() };
      body.type = 'done'; body.id = m.id; postMessage(body, [body.L.buffer, body.R.buffer]);
    }
  } catch (err) {
    postMessage({ type: 'done', id: m.id, error: String(err && err.message || err) });
  }
};
