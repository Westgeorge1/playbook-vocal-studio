# Handover: Playbook Vocal Studio 0.33.0 beta

**Base:** the owner's 0.32.4 source, plus 0.32.5 (drag-to-resize panels and windows, verified by its own 61-check layout suite).

**Owner's request:** "implement everything" from the 0.32.5 handover sections 6 and 7:
- moving tracks on the timeline
- the cleaning suggestions
- the tuning suggestions

Then review it and hand it all over. **All of it is implemented, tested and reviewed.**

**Guarantees:**
- Every new cleaning or tuning feature is off or unchanged until the singer uses it.
- Cleaning with all new options off is byte-identical to 0.32.x (tested).
- The approved presets produce identical tuned and final PCM to the 0.32.3 reference in the same browser (playback suite).
- ENGINE-SHA256.txt verifies.

## 1. Moving recordings on the timeline (Song & vocals)

| What | Where |
|---|---|
| `SongCore.moveRegions(w, trackId, ids, delta)` | song-core.js. Shifts region start/end and every take's `origin`. Clamps to 0–900 s and to take origin ≥ −10 s, and to whole samples. Phrase-volume moves (`levelMoves`) lying wholly inside move along. If moving them would create an overlap, it throws a readable error. |
| `moveLimits`, `moveOverlaps` | song-core.js helpers for clamping and the overlap prompt. |
| UI | song-studio.js: `#sgMove` toggle (mutually exclusive with Drag to scroll), `#sgMovePart` (Move… dialog), ⋯ → Move track…. Drag preview in `draw()` shows a dashed outline at the old place, a live readout (time · bar.beat) and red outlines on overlaps. Alt bypasses snap, Esc cancels, Shift+drag moves the whole track. ←/→ nudge 10 ms and Shift+←/→ nudge one beat, merged into one Undo step per burst (≤1.5 s apart). |
| Commit | `commitMove()` → one `edit()` (one Undo step). It calls `SongPolish.capture()` first. Overlaps ask "Move anyway" (drag/dialog) or refuse (keyboard). The status line reports the move, whether POLISH edits moved, and any section the part left. |
| POLISH follows the audio | song-polish.js `followMove(w, t, ranges, d, whole)`. It runs inside the same edit and rewrites the track's saved session: `pcm` becomes the new render; legacy notes, breath and timing edits are shifted; note-editor `settings.notes` are shifted in analysis frames (11025/110), along with the loop, `frames`, `sourceHash`, the cleaner's noise-sample times, and `refDrift` on whole-track moves. `open()` skips the "Update POLISH … reset" dialog when the input is identical (`changedRanges` is empty) and no alternates would reset. Result: edits are kept and POLISH re-renders. Undo restores the old polish object (tracks are shallow-cloned and `t.polish` is replaced, not mutated). |
| Focus | The lane canvas keeps keyboard focus across timeline re-renders. Generic fix in `render()`. |

Known edge: a note-editor note that straddles a moved part's edge is dropped. Parts normally start and end in silence, so this is rare. Hand-edited notes are counted in the status message.

## 2. Cleaning (POLISH → CLEAN, Studio Spectral)

All of the following lives in **cleaning-plus.js** (browser + Node + its own Web Worker for bleed):
- **Hook:** noise-cleaner.js `render()`.
  - `CleanPlus.before()`: bleed, then RNNoise.
  - Worker: always receives `CleanPlus.strip(settings)`, so the worker's input and settings are exactly 0.32's when nothing new is on.
  - `CleanPlus.after()`: Pauses only, and recomputes `removed`.
  - `measure()`: attaches `result.safety`.
- **Settings** in the noise cfg, validated in noise-core.js:
  - `scope` 'all' | 'pauses'
  - `bleed` 0 | .5 | 1
  - `ai` 0 | .25 | .5 | 1

  They are saved with the track (`session.noteTuner.cleaner`) and absent from old projects, which means off.
- **Beat bleed** `removeBleed()`:
  - PHAT cross-correlation lag search (±0.5 s, 4× decimated, refined at full rate).
  - STFT 4096/1024 sine windows; per-bin least-squares transfer estimated from the pauses only, with coherence-weighted strength; subtraction; overlap-add.
  - Reference: the Song & vocals backing (`S.beat`) when a song track is bound. Otherwise it explains why it is skipped.
  - Test signal: 9.3 ms low-passed leak at −22 dB. It finds the lag within 0.3 ms, removes ≥20 dB in Node and lowers the backing heard in pauses by ≥15 dB in the browser. A vocal without bleed changes by < −60 dB.
- **Pauses only** `voiceFrames()` / `pauseGain()`:
  - 10 ms energy VAD with click removal, gap bridging, 80 ms before and 150 ms after each phrase, and 50 ms raised-cosine fades.
  - Sung samples are exactly the input (tested: max difference 0).
- **Voice-safety meter:** level change and removed-energy ratio on voiced versus pause samples. Warns when the voice changes by more than 1 dB, or removed sound is less than 15 dB below the voice.
- **Room profiles:** `localStorage['pvs.roomProfiles.v1']`, up to 6 named noise profiles, filtered by sample rate. "Use" calls `NoiseCleaner.mutate({profile})`.
- **AI voice isolation:**
  - Package: vendor/rnnoise/rnnoise.js (@shiguredo/rnnoise-wasm 2025.1.5, Apache-2.0; RNNoise BSD-3).
  - Loaded by dynamic `import()` only when used.
  - Processing: resampled to 48 kHz through OfflineAudioContext, 480-sample frames, one-frame delay compensated, blended dry/wet.
  - Runs on the main thread. It is fast (well above real time on desktop), but a phone check is still owed.
- **Find all breaths:** breath-find.js.
  - Detector: 20 ms frames; noisy (ZCR), between the floor+6 dB and the singing level −10 dB; 0.12–1.2 s long.
  - Merged with the engine's `breathSuggestions`. Already-reduced breaths are excluded.
  - It searches the cleaned vocal (`S.audio[1]`) so bleed and noise don't hide breaths.
  - UI in WAVE EDIT → Breaths: list with tick, ▶ and Show. "Reduce ticked breaths" applies all `['edit',0,-1,a,b,dB]` steps in one engine run. "Undo these N" runs N `['undo']` steps, and only if nothing else changed. The engine undoes one edit per step; this was verified, and the engine was not changed.

## 3. Tuning

- **Live pitch guide:**
  - live-pitch.js, YIN, accurate to 0.1¢ on test tones. It attaches an AnalyserNode to the recording's gain node in song-studio `wire()` and detaches in `unwire()`.
  - Display: `#sgPitch` canvas trail (green ≤15¢, amber ≤30¢, red) plus text such as "A3 · 12¢ sharp · key note G3".
  - Uses the song key and scale when set (`scales` from studio-main), otherwise chromatic, at A = 440.
  - Toggle `#sgPitchOn` in Recording helpers, stored in `localStorage['pvs.pitchGuide']`.
- **Note editor** (note-editor.html, inside the IIFE before boot, `tuningPlusUI()`; test hooks `window.PlaybookTuningPlus`):
  - **Lock hand-tuned notes** (`#lockMan`, default on, stored in `localStorage['pne.lockMan']`):
    - `applyResearchPreset`, `applyVocalPreset` and `#snapAll` skip notes with `man`.
    - The panel says how many were kept.
    - Approved-preset audio on a vocal without hand edits is unchanged.
  - **Correction map:** `corrOf(nt)` is the median |final − detected| over the note in cents. Bars and labels are drawn under notes. "Next heavy correction" jumps to notes ≥50¢, else ≥35¢. The toggle is stored in `localStorage['pne.corrMap']`.
  - **Riddim chords:**
    - chord-core.js: chroma from 55–1760 Hz, major/minor triads, 5-frame mode filter. It reads C/F/Am/G exactly in the test, with changes within 0.2 s.
    - Shown as a band under the ruler.
    - Clash outline: the output pitch class is a semitone from a chord tone and not in the chord.
    - "Fit doubtful notes": notes more than 30¢ from any semitone move to the nearest key-and-chord tone, are marked `man`, and form one history step.
  - **My voice:**
    - `measureVoice()` measures: vibrato rate and depth (long notes, detrended zero crossings), vibrato share, natural deviation, scoop cents and ms, and slide time.
    - The profile keeps the last 3 vocals, averaged, in `localStorage['pne.myVoice.v1']`. It is never stored in a project.
    - The preset is `RESEARCH_PRESETS.myvoice`, Natural mode:
      - speed = clamp(slide × 0.8, 30–90 ms)
      - flex = clamp(deviation × 0.8, 10–30¢)
      - vibrato kept 100% if it appears on more than 25% of long notes, else 90%
      - drift .3, humanize .2
- **Loudness-matched A/B** already existed: tuner-routing `matched()` for BEFORE / CLEANED / TUNED / FINAL, and Blind compare. No change.

## 4. Files

- **New:**
  - cleaning-plus.js, breath-find.js, live-pitch.js, chord-core.js
  - vendor/rnnoise/ (rnnoise.js, LICENSE, README.txt)
  - layout-resize.js and layout-resize.css (from 0.32.5)
  - tests-0.33.0/{timeline-move, cleaning, tuning-plus, recording}.cjs
  - CHANGES-0.33.0.md, TEST-RESULTS-0.33.0.txt, FILES-SHA256-0.33.0.txt
- **Changed since 0.32.5:**
  - song-core.js, song-studio.js and .css, song-polish.js
  - noise-core.js, noise-cleaner.js and .css
  - note-editor.html, index.html
  - version strings (studio-main.js, tuner-routing.js, workspace-transfer.js, workspace-standby.html)
  - run-tests.cjs, TESTING.md, README.md, START-HERE.txt
- **Untouched:** engine files (worker.js, engine-wasm.*, phrase-*, rec-worklet.js, daw.css), natural-tuning.js, separation.js, studio.js, project-storage.js.

## 5. Tests

`node run-tests.cjs` runs **16 suites** serially. The results are in TEST-RESULTS-0.33.0.txt. New suites:

| Suite | Checks | Covers |
|---|---|---|
| tests-0.33.0/timeline-move | 41 | drag distance, sample-exact landing, Undo/Redo, snap, Alt, Esc, overlap prompt (Cancel / Move anyway), Shift whole track, 0:00 clamp, keyboard nudges merged into one Undo, Move… (beats, start time), track menu, sample-exact render, autosave/reopen, moved cleanup take rebuilds and stays compact, POLISH note edits shift by 100 frames with pitch edits unchanged, no reset prompt, hand-tuned notes kept and POLISH valid after reopening, phone fit |
| tests-0.33.0/cleaning | 31 | bleed maths (lag, ≥20 dB, untouched without bleed), pause gain, breath detector, byte-identical when off, meter, bleed in the browser using the loaded backing (≥15 dB in pauses), Pauses only exact, removed-noise consistency, settings saved on the track, room profile save/use, RNNoise run and blend, Find all breaths list, untick, reduce, Undo these, phone fit |
| tests-0.33.0/tuning-plus | 32 | YIN accuracy, nearest key note, chord detection, correction map, Next heavy, chord display, Fit doubtful (E over C, F over F) as hand edits, lock keeps edits through Natural Roots, lock off resets, My Voice learn (5.5 Hz vibrato, scoop below) and preset, profile not in the project, pitch guide during simulated-mic recording (shows, hides, off switch), phone fit |

## 6. Still to check on real devices and voices

1. **Listening tests on the owner's three real vocals** for each new cleaning and tuning feature. The synthetic tests prove the maths and the controls, not the taste.
2. **Beat bleed on real recordings.** Headphone leak can change as the singer moves. The canceller uses one fixed transfer per take. If real takes leave residue, the next step is block-wise (for example 10 s) estimation.
3. **RNNoise** is speech-trained. Check on sung vowels and sibilants, and check speed on the owner's Android phone with a 3-minute vocal.
4. **Live pitch guide** on a phone: CPU and readability at arm's length. Its reference is A = 440. If the song is tuned to the backing (for example 443 Hz), use the note editor's reference instead (small change in the `ref` option of `LivePitch.attach`).
5. **Chord detection** knows major and minor triads only (no 7ths or sus). Riddims with heavy bass and drums are expected to work, but check on the owner's riddims.
6. **Find all breaths** is a heuristic. The singer must listen, and the UI says so.
7. **Moving parts:** test a long song (3–5 minutes) for responsiveness. `followMove` renders the track once per move.
8. **Touch tablets:** lane-edge resizing (0.32.5) and Move parts with finger drags.
