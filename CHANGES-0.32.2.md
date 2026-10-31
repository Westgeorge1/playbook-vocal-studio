# 0.32.2 — Manual cleanup · Separate sound, ready for use

This release takes the manual-cleanup preview (built on 0.32.1) and fixes what the review found. All tuning work from 0.32.1 is unchanged.

## Manual cleanup · Separate sound (Song & vocals → a take's Edit → Manual cleanup · Separate sound)

- Drag across a breath or note, or tap **Find next possible breath**, and verify by ear.
- Choose a sound:
  - **Breath between words:** the full band, 6 dB.
  - **Rumble under voice:** 0–100 Hz, 4 dB.
  - **Frequency band:** a range you choose.
- **Inspect selected sound** shows a spectrogram; drag a rectangle to pick the time and frequency range.
- **Original selection / My edit / Hear removed** let you compare at the same monitor gain. **Loop cleanup preview** repeats the region.
- **Keep as new take** adds an editable take with its settings stored on it; Undo removes it.
- **Export edited selection** and **Export removed sound** save WAV files.
- Local edits handle up to 30 seconds. For whole-track cleanup, use POLISH → CLEAN.

## Fixes from the review

1. **Saves only the edit, not a whole new copy.** In the preview, every Keep stored a full copy of the recording (about 35 MB for a 3-minute mono vocal). Autosave now stores the original recording once plus only the edited stretch, and rebuilds the take sample for sample when the song opens. A cleanup on a cleanup take still chains back to the one original. In the 20-second test take, a 0.4 s breath edit stored 19,198 samples instead of 960,000 (2%). Project backups (.zip) still contain a full WAV per take, so they open anywhere.
2. **Every file carries the version (0.32.2).** studio-main.js and separation.js were missing a version tag and other files said "cleanup1", so a phone could combine a cached old script with a new page after an update.
3. **Soft band edges.** Frequency cuts now fade over a short raised-cosine edge (about 15% of the edge frequency, 20–400 Hz) instead of a brick wall, so narrow cuts ring less. Accuracy is unchanged: a 60 Hz rumble is removed with an error 48 dB below the signal while a 1 kHz tone is kept.
4. **Test suites updated for the moved studio script.** The separate-window and restore tests patched code inside index.html, which now lives in studio-main.js; updated copies are in tests-0.32.2.
5. **New cleanup tests** (tests-0.32.2/cleanup.cjs): separation maths, the real button flow, the breath finder, Keep and Undo, storage of only the edit, and rebuilding after reopening.

## Notes

- The studio's main script moved from index.html to studio-main.js unchanged (identical code apart from two blank lines). Deploy studio-main.js and separation.js with index.html.
- While a cleanup take is open, the app still holds its full audio in memory (as before); only storage is reduced.
- In Record & takes (phrase) mode, Keep still stores a full take copy.
