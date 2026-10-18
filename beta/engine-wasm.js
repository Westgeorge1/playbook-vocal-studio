// Playbook Vocal Studio 0.9.8 - loads the phone engine (engine-wasm.wasm) inside worker.js.
// The engine is the desktop app's C++ compiled for wasm32-wasi with WebAssembly exception handling.
// This small loader replaces the Emscripten runtime: it provides the few system calls the engine
// makes, a progress callback, and the helpers worker.js uses (HEAPF32, UTF8ToString, ...).
var PVEngineWasm = async function (wasmUrl) {
  let exp = null, mem = null, u8 = null, f32 = null, f64 = null;
  const views = () => { if (!u8 || u8.buffer !== mem.buffer) { u8 = new Uint8Array(mem.buffer); f32 = new Float32Array(mem.buffer); f64 = new Float64Array(mem.buffer); } };
  const dec = new TextDecoder("utf-8"), enc = new TextEncoder();
  const UTF8ToString = ptr => { if (!ptr) return ""; views(); let end = ptr; while (u8[end]) end++; return dec.decode(u8.subarray(ptr, end)); };
  const dv = () => new DataView(mem.buffer);
  const wasi = {
    fd_write(fd, iov, count, written) {
      views(); const d = dv(); let total = 0, text = "";
      for (let i = 0; i < count; i++) { const p = d.getUint32(iov + 8 * i, true), n = d.getUint32(iov + 8 * i + 4, true); text += dec.decode(u8.subarray(p, p + n)); total += n; }
      d.setUint32(written, total, true); if (text.trim()) console.warn("[engine]", text.trim()); return 0;
    },
    fd_close: () => 0, fd_seek: () => 70,
    environ_sizes_get(count, size) { const d = dv(); d.setUint32(count, 0, true); d.setUint32(size, 0, true); return 0; },
    environ_get: () => 0,
    proc_exit(code) { throw new Error("The audio engine stopped (code " + code + ")."); }
  };
  const env = { pv_stage(ptr) { if (typeof postMessage === "function") postMessage({ type: "stage", text: UTF8ToString(ptr) }); } };
  const imports = { wasi_snapshot_preview1: wasi, env };
  let instance;
  if (typeof PV_WASM_BYTES !== "undefined") instance = (await WebAssembly.instantiate(PV_WASM_BYTES, imports)).instance;   // tests
  else {
    const url = wasmUrl || "engine-wasm.wasm";
    try { instance = (await WebAssembly.instantiateStreaming(fetch(url), imports)).instance; }
    catch (e) { const bytes = await (await fetch(url)).arrayBuffer(); instance = (await WebAssembly.instantiate(bytes, imports)).instance; }
  }
  exp = instance.exports; mem = exp.memory; exp._initialize();
  const M = {
    get HEAPF32() { views(); return f32; }, get HEAPF64() { views(); return f64; }, get HEAPU8() { views(); return u8; },
    UTF8ToString, lengthBytesUTF8: s => enc.encode(s).length,
    stringToUTF8(s, ptr, max) { views(); const b = enc.encode(s), n = Math.min(b.length, max - 1); u8.set(b.subarray(0, n), ptr); u8[ptr + n] = 0; },
    _malloc: n => exp.malloc(n), _free: p => exp.free(p)
  };
  for (const k of Object.keys(exp)) if (k.startsWith("pv_")) M["_" + k] = exp[k];
  return M;
};
if (typeof module !== "undefined") module.exports = PVEngineWasm;
