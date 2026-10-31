# Playbook Vocal Studio 0.32.1

**Tune to** (in the note editor, next to A =) now defaults to **Backing, else A = 440**, so your vocal is tuned to the beat. **My singing** has a better estimate and a clear readout, and **My singing, following drift** tracks slow drift through the song for a cappella singing. Changing the reference keeps notes you've already snapped on the new keys. Older projects keep their exact reference. Also fixed from the review: Level notes, harmony layers in drift mode, and the settings report. See CHANGES-0.32.1.md and TEST-RESULTS-0.32.1.txt. Beta only; the main site stays at 0.14.0.

# Previous release: 0.32.0

Research-based tuning in the note editor. **Research presets** (Natural Roots, Gentle Polish, Tight Modern, Hard Effect) sit beside your two **Original approved** presets, which are unchanged. **Blind compare** plays two or three presets as X, Y and Z and reveals the names only after you keep one. Natural mode adds **Flex**, **Steady drift**, **Vibrato**, **Humanize** and **Smart note centres**. Each note gets **Tilt**, and the Voice panel gets **Level notes**. The optional **AI octave check** (SwiftF0, run on your device) fixes notes read an octave wrong.

Measured on synthetic test vocals at A = 440: Original approved A 2.6¢ average error, Natural Roots 2.7¢ with drift steadied and 92% of the vibrato kept, Gentle Polish 6.3¢ with all vibrato kept. Use Blind compare on your own vocals to choose. See CHANGES-0.32.0.md and TEST-RESULTS-0.32.0.txt. Beta only; the main site stays at 0.14.0.

# Previous release: 0.31.13

**Vocal tuning** now gives the piano roll the room. In a wide window the roll fills the height on the left, with **Selected note** and the settings beside it on the right. Short laptop screens open tuning maximized, and phones open in **Focus notes**. The **Workspace** selector follows the screen you are on, so **Expand** in POLISH opens tuning instead of jumping back to recording.

**Escape** first deselects notes; press it again to return to the studio. Use **Fit** (F), **↕− / ↕+** or **Alt + wheel** for row height, and **?** for shortcuts. Settings panels fold from their headings. Window size, Focus and folded panels are remembered on this device.

When the tuning reference that follows your singing is 15¢ or more from A = 440, a short note offers **Use A = 440**, **Match backing** or **Keep mine**. The approved default sound is unchanged.

See CHANGES-0.31.13.md and TEST-RESULTS-0.31.13.txt. Beta only; the main site stays at 0.14.0.

## 0.31.12

Choose **Recording**, **Vocal tuning**, **Audio editing**, or **Reference comparison** in the **Workspace** row at the top. **Expand** gives the selected tool its own movable, resizable workspace. Phones fill the browser automatically. Recording opens with **Focus timeline**; choose **All controls** to restore the file and section tools. **Maximize**, **Full screen**, and **Return to studio** are in each window header.

**Pop out ↗** opens a separate browser window (or tab, depending on the browser). It saves and reopens this project, then puts the original tab on standby to prevent competing saves. **Return to main tab** saves your changes and returns there; an active recording is stopped and kept. Undo history starts fresh when transferring between browser windows. Expanding inside the app retains the live session and Undo. Stop recording before opening a separate window. If pop-ups are blocked, the app explains it and expands the workspace here.

See CHANGES-0.31.12.md and TEST-RESULTS-0.31.12.txt. Beta only; the main site stays at 0.14.0.

# Previous release: 0.31.11

Visible **Delete recording** buttons on recording cards, plus **Clear recordings** and **Delete track** beside each vocal track. Confirm before removing; Undo restores it during the current session. Deleting the last track leaves a fresh empty lane, with backing and song sections kept. See CHANGES-0.31.11.md and TEST-RESULTS-0.31.11.txt. Beta only.

# Previous release: 0.31.10

Saved songs reopen for recording without reprocessing an editor vocal already kept in a track. POLISH opens when you choose to edit. Unique editor sessions still use full restoration; a processor that does not answer stops after two minutes, with the saved project protected from autosave. See CHANGES-0.31.10.md and TEST-RESULTS-0.31.10.txt. Beta only.

# Previous release: 0.31.9

Recording feedback fix: an empty vocal no longer gets stuck waiting for a tuning job. If Record cannot start, it opens a visible explanation with troubleshooting details. See CHANGES-0.31.9.md and TEST-RESULTS-0.31.9.txt. Beta only.

# Previous release: 0.31.8

Expandable work windows: choose **Open tuning window** or **Open editing window** in POLISH. Move and resize the window, use **Maximize**, or select **Focus notes** for more piano-roll space. **Return to studio** docks the same editor. Phones fill the browser automatically.

See CHANGES-0.31.8.md and TEST-RESULTS-0.31.8.txt. This update is scoped to the beta folder.

# Previous release: 0.31.7

0.31.7 also opens normally in private mode (with a backup reminder) and automatic tuning waits for your key instead of tuning to C major (CHANGES-0.31.7-adoption.md). 0.31.7 stops a new song being tuned to C major by mistake: an unset key is shown as "key not set", and while it is unset the tuning presets ask first when your singing suggests another key (CHANGES-0.31.7.md). 0.31.6 protects a saved project that cannot be read or opened: autosave pauses instead of replacing it, with Try again, Back up and Start fresh (CHANGES-0.31.6.md). 0.31.5 fixes Record staying switched off on a phone while a saved project loads (CHANGES-0.31.5.md). 0.31.4 adds an optional High-note fix (off by default), makes new imports match the
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
