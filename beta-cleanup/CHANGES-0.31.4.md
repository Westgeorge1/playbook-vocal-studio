# Playbook Vocal Studio 0.31.4 — high-note fix, matched resampler, phone top bar

Built on the reviewed 0.31.3 handover (29 October 2026). The approved sound is still the default.
The seven locked engine files are byte-identical. Changed runtime files: `note-editor.html`,
`note-editor-safety.js`, `song-studio.css`, plus version/cache strings in `index.html` and `tuner-routing.js`.

## 1. Optional high-note fix (off by default)

**Problem found in review.** With the approved original detector, sustained notes from about G4 upward
could be read an octave low (A5 about 19 semitones low). Snap all still landed the main pitch within
3 cents, but the tuner then built the note from the wrong cycle length and **added a rough sub-harmonic
undertone 32–37 dB below the note** (A4, C5, E5; about 55 dB below on A5). The input had none. On the
bundled real vocal raised an octave, half of the notes were read an octave low.

**Change.** TUNE › Open note editor › *Note detection* › **High-note fix**. When on, for periods shorter
than 36 samples at 11,025 Hz (above about 306 Hz / D#4), if the best pitch candidate is a whole multiple of
a shorter, equally clear candidate, the shorter one (the true note) is preferred. Below D#4 nothing changes.

- Off by default for every vocal, so the approved sound is unchanged unless you choose it.
- Turning it on or off re-reads the pitch and clears note edits (a confirmation appears if you have edits;
  cancelling keeps everything). Apply your preset again afterwards.
- Saved with the project (`highNoteGuard`), validated on load, and restored on reopen.
- Available only for the approved-original sound profile; older `reviewed-031` projects are unaffected.

## 2. Browser now matches the approved references for new imports

The approved listening files were made with the editor's built-in resampler. In Chrome, the app used the
browser's resampler instead, so a fresh import was not sample-identical to what was approved (same pitch
targets, but some note starts moved by 10 ms). New imports now record `resampler: "standalone"` and use
the same resampler as the approved files. Verified sample-for-sample in Chromium.
Projects saved before 0.31.4 have no `resampler` field and keep the browser resampler, so they reopen with
exactly the audio they had in 0.31.3 (verified against the 0.31.3 runtime).

## 3. Phone layout

- The embedded note editor now uses the studio's dark theme instead of a light page inside the dark app.
- At 520 px and narrower, the top bar uses a second short row so the save status ("✓ saved 09:29 AM") and
  engine status are shown in full instead of being cut to "saved …" and "R…". No horizontal overflow at
  320 or 390 px.

## Verification (this release)

See `TEST-RESULTS-0.31.4.txt`. New checks: `tests-0.31.4/fixes_review.py` (19 checks, embedded editor in
a real iframe). Existing core, invariant and browser suites were re-run.

## Not yet verified — owner and device checks

- **Listen to the high-note fix on your own high vocals** and compare it with the fix off before using it on
  a release. Tests used synthetic tones and the bundled sample, not your recordings.
- The phone/Safari/microphone device checks from the 0.31.3 review are still open.
- Remaining 0.31.3 limits (16-bit cached POLISH finals in backups, capacity on phones, no formal WCAG audit)
  are unchanged.

## Rollback

`rollback/pre-0.31.4-runtime.zip` is the complete 0.31.3 runtime. Extract it into a separate folder and run
its `serve.py`. Projects saved in 0.31.4 should be reopened in 0.31.4 or newer; keep a backup before
opening them in an older version.
