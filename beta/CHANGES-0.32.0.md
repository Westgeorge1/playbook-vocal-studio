# 0.32.0 — Research-based tuning: new presets, smart centres, Natural controls, blind compare, AI octave check

This release adds the improvements from the vocal-tuning research (Melodyne, Auto-Tune, RePitch, VariAudio, SwiftF0). **Your two approved presets are unchanged**: on the bundled sample and on a synthetic test vocal they produce byte-identical audio to 0.31.13. Everything new sits beside them.

## New presets (Vocal tuning presets → Research presets)

| Preset | For | Settings |
| --- | --- | --- |
| Natural Roots | Your roots reggae lead; keep your tone | Natural mode · 100% · 50 ms · Flex 15 (±6¢) · Drift 30% · Vibrato 90% · Humanize 20 · smart centres · keep blue notes |
| Gentle Polish | A good take that needs only a touch | Natural · 85% · 70 ms · Flex 25 (±10¢) · Drift 0% · Vibrato 100% · Humanize 30 · smart centres · keep blue notes |
| Tight Modern | Dancehall / pop leads locked on the beat | Natural · 100% · 30 ms · Flex 15 · Drift 50% · Vibrato 80% · Humanize 10 · smart centres |
| Hard Effect | The deliberate auto-tune sound | Classic Smooth 100% (about 12 ms) |

Research presets reset each note's pitch, drift, vibrato, tilt and slide, then tune the whole vocal. Timing, volume and formant edits are kept. Apply them before fixing single notes. Undo restores the previous settings.

**Measured on synthetic test vocals** (three vocals, A = 440, octave-error notes excluded):

| Preset | Average tuning error | Vibrato kept | Scoops kept |
| --- | --- | --- | --- |
| No tuning | about 16.5¢ | 99% | 79% |
| Original approved A | 2.6¢ | 98% | 81% |
| Natural Roots | 2.7¢ | 92% | 82% |
| Gentle Polish | 6.3¢ | 100% | 93% |
| Tight Modern | 2.6¢ | 82% | 69% |
| Hard Effect | about 2¢ | 31% | 18% |

The first research values (90% and Flex 30 for Natural Roots; 70% and Flex 50 for Gentle Polish) left 6.5¢ and 13.5¢ of error, so they were tightened from the measurements. These numbers come from synthetic vocals, not your voice: use Blind compare on your own vocals to choose.

## Blind compare (new panel)

Pick two or three presets (default: Original approved A, Natural Roots, Gentle Polish), tap **Start blind test**, then **Hear X / Y / Z** in any order. Names stay hidden until you tap **Keep**. Undo returns to where you started; **Cancel test** restores your previous settings. Set a loop over a phrase first for quick switching.

## Smart note centres

Like Melodyne 5's musically weighted pitch centre: the first and last 18% of each note (scoops and tails), consonants and uncertain frames are ignored, and steady, louder frames count more. The research presets turn it on; the approved presets always use the original detected centre. You can switch it in Automatic tuning → **Smart note centres**. On the test vocals it lowered Natural Roots' error from 3.1¢ to 2.7¢.

## Natural mode controls (Automatic tuning → Mode: Natural)

- **Flex** (replaces "Leave in-tune notes alone"): notes this close to the key are left as sung. 25 = ±10¢, the earlier default.
- **Steady drift**: evens slow wandering on held notes (natural 20–40%).
- **Vibrato**: scales your own vibrato (natural 70–100%; 0% sounds synthetic).
- **Humanize**: relaxes drift and vibrato changes after the first 0.3 s of long notes so they breathe (natural 10–30).
- **Note transition** works like retune speed: 30–50 ms natural, under 10 ms robotic.

At their defaults the Natural engine is bit-identical to 0.31.13 (checked over 800 random runs), so existing Natural projects sound the same.

## Note tools

- **Tilt** (Selected note): raises or lowers the end of a note against its start, around the middle, ±100¢. For held notes that sag flat or creep sharp.
- **Level notes** (Voice panel): like Melodyne's Leveling macro. Lift quiet notes and tame loud notes towards the vocal's typical level, up to ±6 dB per note, without compressing each note's shape.

## Natural tuning display

Natural mode tunes the pitch line rather than each note's stored shift, so notes it tunes used to stay red and count as "off pitch". Each note is now judged by where its steady middle lands after tuning: tuned notes show green, and the status line says how many were tuned automatically. Notes more than 60¢ away are still left for you to check.

## AI octave check (Note detection → AI octave check, off by default)

[SwiftF0](https://github.com/lars76/swift-f0) (MIT licence, a 135 KB model) double-checks the pitch reading and moves frames that were read a whole octave too high or low. It only moves a frame when SwiftF0 is confident on three neighbouring frames that agree. It runs on your device through ONNX Runtime Web 1.20.1 (MIT licence, Microsoft). The first use loads about 11 MB from the app folder. On the test vocal with an A4 read as A3 it fixed the note in about 2.6 seconds. It re-reads the pitch, so turn it on before editing notes. The setting is saved with the project.

New files: `vendor/ort/` (ort.wasm.min.js, ort-wasm-simd-threaded.mjs, ort-wasm-simd-threaded.wasm), `vendor/swiftf0/model.onnx`, `licenses/ONNX-Runtime-Web.txt`, `licenses/SwiftF0.txt`. Your web server must serve `.mjs` as JavaScript and `.wasm` as `application/wasm` (Python's http.server does).

## Saved projects

New settings are stored with the editor state: centreMode, autoFlex, autoDrift, autoVib, autoHumanize, aiPitch, and a 14th note column for tilt. Projects without them open exactly as before. Validation (note-editor-safety.js) checks the new values.

## Files changed

note-editor.html, natural-tuning.js, note-editor-safety.js, index.html / tuner-routing.js / workspace-transfer.js (version only). New: vendor/, two licence files, tests-0.32.0/. Locked engine files are unchanged.
