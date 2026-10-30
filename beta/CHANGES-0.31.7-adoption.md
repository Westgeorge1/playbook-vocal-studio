# 0.31.7 adoption (2026-10-30)

Base: our 0.31.5, plus the third party's 0.31.6 + 0.31.7 runtime changes (index.html, rec.js, song-studio.js,
song-studio.css, tuner-routing.js, note-editor.html, README.md, START-HERE.txt). Their package was runtime-only, so all
docs, tests, runners, fixtures, guides, licenses and rollback files are kept from 0.31.5. The 7 engine files are byte-identical.

## Fixes made during adoption
- **Private mode / storage turned off (R15).** Their 0.31.6 paused autosave whenever storage could not be opened, so a
  first-time singer in private mode saw "autosave paused" and had to tap Start fresh. Now, if storage cannot even be opened
  AND this browser has never kept a project here (marker `pvs.hadProject`, set on every successful save or restore), the
  app opens normally with one calm note: "This browser is not keeping projects on this phone… use Back up project".
  If a project was kept here before, it still pauses and protects it.
- **Automatic tuning on a new vocal (R16).** Their 0.31.7 only asked before the two presets; the automatic Classic Smooth
  25% that is on for new vocals still tuned to C major silently. Now, when a NEW vocal opens while the song key is not
  chosen and the singing clearly sounds like a key with different notes (at least 3 different sung notes and a confident
  detection), automatic tuning is switched off and the Automatic tuning panel says why. Choosing a key, "Use detected …",
  a preset (asked first) or the On switch turns it back on. It is saved as an ordinary "automatic tuning off", so
  reopening sounds exactly the same (h25-stereo). Saved projects and chosen keys are never touched (sample-identical).
- **Save-failure banner.** Their 0.31.6 added a hidden "Start fresh" button to the storage banner, which broke the
  0.25.1 save-failure banner (Retry was no longer the last button). Start fresh now exists only while autosave is paused.

## Tests added
tests-0.31.6/restore_error316.py (19 checks), tests-0.31.7/key_check317.py (12 checks), check25 R15 (5) and R16 (5).

## Rollback
rollback/pre-0.31.7-runtime.zip = complete 0.31.5 runtime.
