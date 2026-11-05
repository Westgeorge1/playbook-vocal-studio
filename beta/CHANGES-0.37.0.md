# Playbook Vocal Studio 0.37.0 beta

Base: 0.36.8 (the live beta candidate). This release adds **Clean vocal**, the owner-approved eight-step cleaner with manual control of every step, an adaptive noise remover written for this app, held-note protection, and an optional AI clean step.

## What the singer sees

POLISH > CLEAN now opens with a **Clean vocal** panel.

- **Clean vocal** measures the take and sets starting values for every step.
- **Reset** puts every step back to those values.
- Any control the singer moves is remembered. Pressing Clean vocal again never changes it, until Reset.
- Each step has an on/off switch that keeps its values. A switched-off step is dimmed and does nothing.
- Nothing changes unless the singer presses a button or moves a control.

| Step | Controls | Where it runs |
|---|---|---|
| 1. Measure | Readings, Measure again | New (noise-core.js `measure`) |
| 2. Hum and rumble | Hum Off/50/60 Hz, rumble cut-off 0–120 Hz | Existing filters |
| 3. Clicks and pops | On/off, click sensitivity, pop reduction | Existing Vocal Detail engine settings |
| 4. Beat leak | Off / Gentle / Strong | Existing beat-bleed removal (needs the beat in Song & vocals) |
| 5a. AI clean | Amount 0–100 % | New: DeepFilterNet3 on the device |
| 5b. Noise remover | Engine (Adaptive / Classic), Amount, Follow speed, Smoothness, Where | New adaptive engine; Classic is the 0.36.8 engine |
| 6. Protect held notes | Protection 0–100 % | New |
| 7. Gaps, breaths, echo | Gap cleaning 0–24 dB, Find breaths, Gentle de-reverb on/off and amount | Gap cleaning is new; the rest is existing |
| 8. Safety check | Singing change, top-end change, pause change; Hear what was removed, Before, After | Existing meter plus a new 4–10 kHz top-end reading |

### How the button chooses starting values

The values come from the measured difference between the voice level and the background.

| Measured difference | Amount | Follow speed | Noise threshold |
|---|---|---|---|
| 50 dB or more | 8 dB | Medium | 0 dB |
| 35–50 dB | 12 dB | Fast | +3 dB |
| Under 35 dB | 14 dB | Fast | +3 dB |

These settings are the same at every level:
- Held-note protection is 100%.
- Smoothness is 50%.
- Clicks and pops are on at 25% sensitivity and 30% pop reduction.
- Echo reduction is off.
- Hum is set to the frequency that Measure finds.
- Rumble cut-off is 70 Hz when Measure finds low rumble.

AI clean is set to 100% unless music or another voice is heard in the pauses, or the difference is under 25 dB. In those cases AI clean is off and Smart Guide points to Beat leak. Beat leak is set to Gentle only when music is detected and the beat is loaded.

## The new sound path (all own code except the AI networks)

- **Adaptive noise remover** (`noise-core.js` `processAdaptive`).
  - Follows changing noise. For each frequency, the noise estimate tracks the minimum of the smoothed spectrum over a sliding window (Follow speed: 1.5, 0.6 or 0.35 s). It updates only where a voice is unlikely.
  - Uses a decision-directed gain whose time constant comes from Smoothness.
  - With Follow speed Off it uses the learned noise print.
- **Held-note protection** (`pitchTrack`, `harmonicWeights`).
  - A YIN pitch tracker finds the sung note in every 10.7 ms frame. The cleaner keeps that note's harmonics up to 10 kHz and cleans between them.
  - After AI clean it restores harmonics from the vocal as it was before the AI. A note that the AI thinned is put back.
- **AI clean** (`dfn-core.js`, `dfn-worker.js`, `vendor/dfn3`). DeepFilterNet3 by Hendrik Schröter (MIT or Apache-2.0). The three ONNX networks are unmodified.
  - The signal path around them is written for this app from the published design: 960-point Vorbis-window STFT at 48 kHz, ERB features, and a 5-tap deep filter on the lowest 96 bins with 2 frames of lookahead. It is checked against a direct DFT and for perfect reconstruction.
  - It runs offline in a worker on ONNX Runtime Web (already in the app for the note editor), in 5 s chunks with 1 s of warm-up so memory stays small.
  - The output is aligned with the input to the sample.
  - Nothing is uploaded. The models (8.6 MB) are part of the offline download.
- **Gap cleaning** (`cleaning-plus.js` `after`). Lowers what is left between lines by up to 24 dB, with the existing 50 ms fades.
- **RNNoise.** The older "AI voice isolation" (RNNoise) stays only so projects that used it sound the same. Its selector is shown only when a project has it on.

## Compatibility

- **Classic engine:** output is byte-identical to 0.36.8 and to the 0.32.3 reference. The new test checks this against `PVS_REFERENCE_DIR`.
- **Existing projects** keep `engine` unset (Classic) until the singer presses Clean vocal. They render exactly as before.
- **Saved fields:** new settings are saved with the track in the existing cleaner state: `engine`, `follow`, `smooth`, `harmonic`, `dfn`, `gap`, `stepsOff` and `touched`. Older builds ignore them.
- **Engine and presets:** engine binaries and ENGINE-SHA256 are unchanged. The approved tuning presets are unaffected.

## Evidence

### 1. Your voice with known added noise (objective)

Method: 60 s of G04 (raw) and G03, whose own background is −68 to −70 dBFS. Fan, street (changing) and hiss noise were added at 10 and 20 dB below the voice, giving 12 mixes. The score is improvement in SI-SDR against the clean take (higher is better). It counts noise left in and any change to the voice.

| Method | Mean improvement | Street (changing) noise |
|---|---|---|
| 0.36.8 Classic, Balanced 10 dB | +1.5 dB | 0.0 to +0.1 dB |
| New, no AI | +5.3 dB | +4.6 to +6.3 dB |
| New + AI (as Clean vocal sets it) | +6.8 dB | +5.7 to +9.5 dB |
| AI alone, no held-note protection | +2.8 dB | made 3 of the 12 mixes worse |

### 2. Your ten recordings (no clean reference, measured with the app's own safety meter)

- **G01–G07 and G09 are already quiet.** The steady background is −54 to −70 dBFS.
  - The 0.36.8 cleaner at Balanced, with a learned noise print, changes the pauses by 0.0–0.1 dB.
  - New, no AI changes them by 0.3–2.7 dB.
  - New + AI cleans the pauses by 2.9–14.4 dB, mostly room sound and tails.
  - Voice level changes by −0.02 to −0.13 dB and the top end by −0.08 to −0.22 dB, on all of these except G09.
- **G09 with AI:** the voice changes by −1.3 dB and the safety check warns. Listen to this one.
- **G08 and G10 have music or another voice behind the singing.** Measure flags G08; G10 is caught by its low 18.8 dB difference.
  - Clean vocal leaves AI off for both. With AI forced on, the voice drops 1.6 dB on G08 and 0.6 dB on G10.
  - These takes need Beat leak with the matching beat, or a re-record with the beat in headphones only.

### 3. Listening

A blind A/B/C page with the old cleaner, New, and New + AI on all ten takes was delivered to the owner. The agreed rule: Clean vocal's settings become the recommended default only if the owner prefers a new version on at least 7 of 10. That result is pending.

## Tests

- **New suite:** `tests-0.37.0/clean-vocal.cjs` (30 checks). It covers:
  - FFT and ERB band layout, and perfect reconstruction.
  - Pitch tracking, adaptive following, and pause and held-note levels.
  - Restoring harmonics after AI, and step switches.
  - Hum detection and classic-engine identity.
  - In the browser: the panel, Clean vocal and the AI worker, safety text, remembered knobs, Reset, switching AI off, the listening buttons, saving with the track, and the offline list.
- **Updated suites:**
  - `tests-0.33.0/cleaning`: the RNNoise selector is now reached through a project that uses it, with two added checks that it appears and hides.
  - `tests-0.34.0/ux`: the More-controls check now expects AI clean in Clean vocal and the RNNoise selector hidden.
- **Version wrappers:** `tests-0.37.0/recording` and `tests-0.37.0/phone` expect 0.37.0.

## Versions

- APP_VERSION and the offline cache are 0.37.0.
- `?v=0.37.0` is on changed files and on the files that carried the 0.36.8 release mark.
- **New files:** `clean-vocal.js`, `dfn-core.js`, `dfn-worker.js`, `vendor/dfn3/` (models, both licences, README with source commit and archive SHA-256), and `licenses/DeepFilterNet3-*.txt`.

## Still open

- The owner's blind listening result.
- On a real phone, AI clean speed is not measured yet. In Node on one CPU core it runs 12–15 times faster than real time, so a phone should be well under a minute for a 3-minute vocal; this needs a device check.
- No automatic room-echo measurement. An estimate was tried and was unreliable on the ten takes, so echo reduction stays a manual step.
