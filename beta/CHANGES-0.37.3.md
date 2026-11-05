# Playbook Vocal Studio 0.37.3 beta

Base: 0.37.2. This candidate fixes the two holds in the 4 November acceptance review (Playbook-Vocal-Acceptance.html). Clean vocal's sound is unchanged from 0.37.2.

## 1. Recording: audio-clock watchdog (merged from draft PR #2, 0.36.9)

**The problem in 0.36.8–0.37.2.** The recording watchdog used page time. If the audio clock ran behind, or the worklet's completion acknowledgement was delayed or missing, a bounded take could be kept short of its planned end. The app then reported "Recording reached its time or storage limit." The acceptance review's replay of PR #2's failure injection failed on 0.37.2 for this reason.

**The fix.** The fix is the agent's PR #2 commit `b1fdc86`, merged without change.

| File | Change |
|---|---|
| `capture-watchdog.js` | New. Deadlines follow the audio clock. A separate five-second guard detects a clock or capture stream that stops, and keeps the received audio for review. |
| `song-studio.js` | Byte-identical to PR #2's version. 0.37.x had not changed this file. |
| `tests-0.36.9/watchdog-clock.cjs` | PR #2's injected-clock test, unchanged. |
| `tests-0.36.9/watchdog-browser.cjs` | PR #2's real-worklet fault-injection test, unchanged. |
| `tests-0.32.4/browser.cjs`, `tests-0.34.2/coach.cjs`, `tests-0.36.3/crash.cjs` | PR #2's added failure capture, unchanged. |
| `run-tests.cjs` | PR #2's qualification/stress mode, and the two watchdog suites added first. |

**Result on 0.37.3.**
- `watchdog-clock`: all checks pass.
- `watchdog-browser`: 8 of 8, including "Audio-clock endpoint still keeps the complete alternate", the check that failed on 0.37.2.

## 2. Clean vocal step 7 switch now also switches room-echo reduction

**The problem in 0.37.0–0.37.2.** Step 7, "Gaps, breaths, echo", has an on/off switch. Turning it off stopped gap cleaning only. Its de-reverb is a Vocal Detail engine setting, so it kept running, at 30% in the review.

**The fix** (`clean-vocal.js`).
- Turning step 7 off now remembers whether room-echo reduction was on (`echoMemo`, saved with the track) and switches it off. The echo controls are greyed out while the step is off.
- Turning step 7 on restores the remembered setting.
- Pressing Clean vocal while step 7 is off stores its echo choice for later instead of applying it.

**Tests** (`tests-0.37.0/clean-vocal`, now 34 checks): step 7 off turns de-reverb off; step 7 on restores it.

## Unchanged

- Clean vocal defaults: AI clean on, held-note protection 100%, Pops and rumble 0 dB.
- Engine files and approved presets.

## Versions

- APP_VERSION and the offline cache are 0.37.3. The offline list now includes `capture-watchdog.js`.
- `?v=0.37.3` is on `capture-watchdog.js`, `song-studio.js`, `clean-vocal.js`, `noise-core.js`, `noise-worker.js`, `noise-cleaner.js`, `smart-coach.js` and `studio-main.js`.
- `tests-0.37.3/recording` and `/phone` expect 0.37.3.
- The runner has 34 suites.

## Still open, as the review says

- Three consecutive serial qualification runs of this frozen package. This release ran one; see TEST-RESULTS-0.37.3.txt.
- The long-song POLISH test.
- The physical Samsung test: record with the real mic and headphones, alternate take, interruption and recovery, save and reopen, export, and five-minute POLISH with AI clean timing.
- The blind scored listening with an independent engineer, in the review's player.
