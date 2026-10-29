# Playbook Vocal Studio 0.31.4

0.31.4 adds an optional High-note fix (off by default), makes new imports match the
approved tuning references sample-for-sample in the browser, and fixes the phone top bar
and embedded editor theme. Read **CHANGES-0.31.4.md** and **TEST-RESULTS-0.31.4.txt**.

## 0.31.3

This release reviews the integrated application and fixes editor-state validation,
note-splitting persistence, and narrow-phone control layout. It retains the Low,
Mid, High and Gain labels and both approved original-tuner presets.

Read **REVIEW-0.31.3.md** for results and remaining limits. The exact previous
runtime is included for rollback; the current application is ready for agent
handover with the documented detector and device-testing caveats.

The following tuning summary remains applicable.

This update adds the two owner-approved original-tuner recipes: **Snap all +
Smooth 25%** and **85% correction + Smooth 25%**. Both use Classic Smooth and
Keep blue notes off. Snap all is the primary workflow; apply once, then edit
individual notes. Confirm the key and tuning reference for each song.

New imports restore the supplied standalone pitch-candidate ranking and its
full-vocal Classic Smooth resynthesis. They start with Smooth 25% alone until
you choose a whole-vocal preset. Saved projects retain their previous sound,
settings and note edits. Selection-only correction, neutral bypass, linked
stereo, validated export and the original native tuner are retained.

Studio Spectral noise reduction and the chain after tuning are unchanged.
See START-HERE.txt for operation and rollback, APPROVED-TUNING-0.31.1.txt for
implementation details and TEST-RESULTS-0.31.1.txt for fresh verification.
Historical release notes/results remain labelled by their older versions.

## Run

Extract the entire folder. Run `python serve.py` and open its localhost URL.
This is a static HTML/JS/WASM application with no Node build step. HTTPS is
needed for online microphone access. No GitHub/v0 deployment was performed.

## Tests

`node tests-0.31.1/approved.test.cjs` exercises shipped DSP and actual import,
preset, selection correction, Undo and persistence handlers offline with a
synthetic source. Set PVS_VOCAL_PCM to a mono 48 kHz Float32 little-endian PCM
file to repeat the real-vocal comparison. Personal recordings are not bundled.
The supplied original source and unchanged 0.31 runtime are included as
comparison/rollback references. DOM/device playback is stubbed; this is not a
browser/UI test. Existing core suites remain included.

## Browser regression checks

The app itself has no build dependencies. Tests require Python with Playwright,
NumPy and SciPy, plus Node.js for the core suites. Use an installed Chromium:

```sh
PVS_CHROME=/path/to/chromium python tests-0.31.3/run_suite.py tests-0.30/browser.py noise.log
PVS_CHROME=/path/to/chromium python tests-0.31.3/editor_review.py
PVS_CHROME=/path/to/chromium python tests-0.31.3/layout_review.py
```

The wrapper changes only browser discovery/local serving, not old assertions.
Some historical scripts need private recordings or older defaults; their names
are not evidence that they passed on this version. Consult the current results.
Screenshots and generated fixture/export audio are internal test output and are
not included in this handover. Synthetic fixtures can be regenerated.
