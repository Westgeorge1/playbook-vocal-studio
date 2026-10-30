# Playbook Vocal Studio 0.31.7 (2026-10-30)

## Fixed: a new song could be tuned to the wrong key without a word
**What happened.** A new song has no key until you choose one, and POLISH TUNE then tunes to **C major**. The Song screen
showed "C maj" as if you had chosen it. Automatic tuning (Classic Smooth 25%, on for new vocals) and both tuning presets pull
every note toward the key's notes, so a vocal sung in another key was pulled toward wrong notes. On the bundled demo vocal
(sounds like A♭ major), 6 of its 9 notes had a different target in C major, up to a semitone away.

**What changed.**
- The Song screen shows **"key not set"** until you choose a key, and tapping it opens the setting
  ("Song key not set yet: POLISH TUNE uses C major until you choose one").
- In the note editor, while the song key is not set and your singing sounds like a key with different notes, the preset
  hint turns amber: "⚠ Tuning to C major, but your singing sounds like A♭ major…".
- **Snap all + Smooth 25%** and **85% correction + Smooth 25%** then ask first. **Cancel** changes nothing (then tap
  "Use detected …" or choose your key); **OK** tunes to the current key and is not asked again for the same keys.
- Once you choose a key (Song screen, the track's own key, or in the editor, including "Use detected"), nothing is ever asked.
  A relative major/minor (same notes) is never asked about.

## Unchanged
No automatic key change: the approved sound, both approved presets and the detector are untouched; with a chosen key the
result is sample-for-sample the same (tests-0.31.1/approved.test.cjs). Saved projects and formats are unchanged.
The 7 engine files are byte-identical. R1–R15 hold.

## Files changed
note-editor.html (key check, amber hint, `keyChosen` bridge method), tuner-routing.js (reports whether the key was chosen),
song-studio.js ("key not set", `SongStudio.keyChosen`), index.html (version strings), new tests-0.31.7/key_check317.py.

## Rollback
`rollback/pre-0.31.7-runtime.zip` is the complete 0.31.6 runtime.
