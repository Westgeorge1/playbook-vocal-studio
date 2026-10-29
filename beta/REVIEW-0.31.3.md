# Playbook Vocal Studio 0.31.3 — review and agent handover

Reviewed 29 October 2026. This package is suitable for the next agent to continue from. The main workflows passed the checks below after three fixes. It is **not an unconditional professional-quality or all-device certification**: one reproducible detector limitation remains, and physical-device acceptance is still needed.

## Results

- **293 browser assertions passed; 1 detector assertion failed and is documented below.** All 16 core/invariant suites passed. The combined core, JavaScript syntax and locked-engine verification recorded 55 successful scopes.
- Both approved presets reproduced the supplied original editor's output **sample-for-sample** on the full supplied 129.045-second, 48 kHz vocal, using the real DSP in Node. The fixture yielded 281 notes and G major, A=440. Both settings/state round trips also reproduced their output. This checks reproducibility, not a new listening judgment.
- Browser environment: Linux, Chromium 153.0.8010.0, Playwright. The audio engine, workers, IndexedDB, downloads and AudioWorklet ran in the browser. Recording checks used a simulated microphone.
- Screen widths checked: **320, 390, 768 and 1366 pixels**. Desktop and 390-pixel workflows also used actual UI clicks, focus/keyboard actions and phone-size touch contexts. Screenshots were inspected internally.
- All local HTML script/style references resolved. The seven files listed in `ENGINE-SHA256.txt` remain byte-identical. Only four runtime files changed: `index.html`, `note-editor.html`, `note-editor-safety.js`, `tuner-routing.js`.

`REVIEW-RESULTS-0.31.3.json` contains individual checks, failures and their disposition, the core scopes and real-vocal hashes. Older test files and result records are historical; do not count their presence as current verification.

## Fixes made

| Finding | Change | Verification |
|---|---|---|
| Invalid saved editor state could replace the open vocal/reset edits before throwing an error. Some bridge key/scale/tempo options were not validated. | Validate audio dimensions, settings and host options before replacement; validate analyzed note bounds before committing the new analysis. Analyze using the requested sound profile without first changing the current profile. | Bad dimensions, scale, note bounds, key and tempo are rejected with the previous state and rendered PCM unchanged. |
| Note-splitting sensitivity was omitted from saved settings and could carry over to a new vocal. | Persist and validate `detSplit`, restore the slider/readout, save changes with Undo support, and reset new imports to 0.70. Old projects without this field use the established default. | State round trip and fresh-import reset pass. Existing note boundaries are restored from saved edits. |
| At a 320-pixel phone width, the editor clipped the Select tool and the long alternative-preset button caused horizontal overflow. | Wrap the tool group and long preset labels; enlarge primary editor touch controls to at least 44 pixels on narrow screens. | Embedded editor now fits its 304-pixel available width with no overflowing controls; 390/768/1366 layouts pass too. |

Export help now distinguishes audio exports from editable project backups and names the current version for full-state reopening. Cache versions were updated for the changed editor and validator.

## Workflow coverage

| Area | Result and scope |
|---|---|
| Import and audio integrity | Mono/stereo synthetic sources, standalone WAV/session import, already-finished vocal bypass, short/silent audio, finite-sample validation, oversized-import refusal and original-source preservation passed. |
| Noise remover | Studio Spectral precedes the new tuner. Automatic/manual noise profiles, presets, Undo/Redo, bypass, removed-noise audition, exact source reconstruction, state recovery and switching to Original passed. Effects do not clean or tune again. |
| New tuner | Both approved whole-vocal presets, selected-note-only correction, manual fractional targets, Snap All Undo/Redo, Classic/Natural mode controls, note timing/quantize, split/join, stereo and concurrent edits passed. The separate high-note detector assertion is the exception below. |
| Playback | Host/editor playback ownership, safe audition gain, stage comparisons and unchanged parameters during comparison passed. This verifies generated buffers/routing, not speaker sound. |
| EQ and effects | Low/Mid/High/Gain labels inspected; Low/Mid/High gain knobs respond to keyboard steps, announce their values and fit desktop/phone layouts. Effects changes preserve the tuned-stage PCM. Original engine and processing algorithms are unchanged. |
| Recording | A stalled capture processor does not falsely report Recording. Stopping before capture starts explains that no audio was recorded; stopping a real simulated capture after one second retains the attempt. Physical mic quality and latency are not established. |
| Song and recovery | Track-specific keys, song key changes, own-key overrides, dry bypass, immediate crash recovery and unrelated-project journal exclusion passed. |
| Finishing | Phrase-volume moves, playback/render agreement, loudness/limiter paths, 24-bit stereo WAV, measurement export, invalidation after settings change and cancellation/reopen safety passed. |
| Reference guide | Profile measurement and persistence, quiet-reference rejection, proposed EQ previews, matched auditions, mono check, Apply/Undo, cancel/reopen, profile removal/Undo and project ZIP recovery passed. Synthetic reference audio was used. |
| Saving/export | Browser reload, project ZIP save/reopen, both tuner states, cleaner state, all 16 custom-stage combinations, session ZIP, MIDI inclusion, aligned lead/harmony/double exports and clipping protection were exercised. |
| Layout/usability | Empty/loaded Song, Edit, Clean, Tune, Chain and Save views fit the tested widths. Scrolled recording controls remain reachable; comparison/finish dialogs block recording shortcuts and provide touch-sized actions. |

## Remaining findings — tell the next agent

1. **High-note detector ambiguity is reproducible.** The approved original detector sometimes selects an octave/subharmonic on sustained synthetic high notes. In the C2–A5 test, A4/C5/E5 displayed about one octave low and A5 about 19 semitones low. Consequently note labels, derived MIDI and automatic key suggestions cannot be treated as ground truth. In this same fixture, the actual snapped WAV fundamental frequencies passed the 10-cent criterion (worst error about 2.9 cents), so a bad displayed octave does not automatically mean that the audible result is an octave wrong. This is the one failed assertion. The approved detector and sound were deliberately retained. Any detector replacement needs a separate opt-in mode and owner listening comparison before changing defaults.
2. **Modern project backups cache processed POLISH finals at 16-bit precision.** Original recordings and processing settings are retained; public finished-audio export is 24-bit PCM. A 24-bit export made from a restored 16-bit cache does not regain precision. Evaluate a lossless processed-audio backup option if mastering-grade round-trip precision is a requirement. Do not silently change the established backup format or break older projects.
3. **Physical phone and audio-device acceptance remains open.** Test the released ZIP on the user's actual Chrome/Android or Safari/iPhone, with their microphone/headphones. Verify permission denial/retry, background/lock-screen interruption, file-picker support, a saved ZIP appearing in Files, and reopen after browser restart. Viewport emulation is not a substitute for these checks. Safari/Firefox were not tested here.
4. **Capacity and accessibility limits remain.** Import refusal guards were exercised, but the maximum 15-minute/eight-lane workload was not stress-tested on phone hardware. The existing engine has tighter per-vocal POLISH limits than the song workspace. Canvas note/EQ editing remains primarily visual/pointer-based; this was not a formal screen-reader/WCAG audit. The main studio is dense on a small phone, although tested controls can be reached by scrolling.
5. **Professional sound still depends on the recording and listening.** Spectral cleanup can become watery with aggressive reduction, and tuning relies on a suitable key/reference. No universal preset or end-to-end listening certification is claimed. The previously approved recipes are preserved, not retuned by this review.

## Handover priorities

1. Run the physical-device acceptance checks above using the user's existing project backup and familiar vocal.
2. Keep **Snap all + Smooth 25%** as the preferred explicit whole-vocal command and **85% correction + Smooth 25%** as the alternative. Check the song key before applying; subsequent correction of one selected note must stay local.
3. Investigate high-note confidence/octave handling as a separate change, with the supplied original editor and approved renders as references. Do not change existing saved-project sound profiles automatically.
4. Decide whether lossless processed-audio backup and additional keyboard access to canvas editors are needed for the next release.

## Running, tests and rollback

Extract the entire package and run `python serve.py`. Open the localhost address it prints. Online microphone use requires HTTPS. No GitHub/v0 deployment was performed as part of this review.

The app requires no Node build. Test dependencies are Python, Playwright, NumPy, SciPy and Node. Set `PVS_CHROME` to an installed Chromium executable. Examples:

```sh
node tests-0.25/check25.cjs
node tests-0.31.1/approved.test.cjs
PVS_CHROME=/path/to/chromium python tests-0.31.3/editor_review.py
PVS_CHROME=/path/to/chromium python tests-0.31.3/layout_review.py
PVS_CHROME=/path/to/chromium python tests-0.31.3/run_suite.py tests-0.30/browser.py noise.log
PVS_CHROME=/path/to/chromium python tests-0.31.3/run_suite.py tests-0.26/browser26.py quality.log
PVS_CHROME=/path/to/chromium python tests-0.31.3/run_suite.py tests-0.31.3/controls_review.py controls.log
```

Run the standalone audit to generate the shared synthetic editor fixtures before advanced editor/final-check scripts. Reference-guide fixtures can be generated with `tests-0.31.3/reference_fixtures.py`. Old scripts with private-recording dependencies or superseded default expectations are not turnkey release tests. The wrapper changes browser discovery/local serving, not test assertions.

The source WAV/PCM from the user's recording and QA screenshots are excluded from this package. Set `PVS_VOCAL_PCM` to a mono 48 kHz Float32 little-endian file to repeat the approved full-vocal offline comparison.

For rollback, choose **Original tuner — restore** and/or **Original cleaner** in the app. The two tuner states are preserved separately. For an exact pre-review runtime, extract `rollback/pre-review-0.31.2-runtime.zip` into a separate directory and run its `serve.py`. Earlier 0.31.0 and reviewed 0.29 runtimes remain included. Keep a separate project backup before opening it with an older application.
