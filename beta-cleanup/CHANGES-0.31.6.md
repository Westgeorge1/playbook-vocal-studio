# Playbook Vocal Studio 0.31.6 (2026-10-30)

## Fixed: a saved project could be silently erased
**What happened.** 0.31.5 protected your saved project when the phone's storage *never answered*. But if the storage
answered with an *error*, the app treated that as "nothing saved": it opened as an empty new song with no warning, and
the next autosave (after recording, importing or changing a setting) replaced the old project and deleted its audio.
The same happened if the project was read but could not be opened (for example, damaged saved data).

**What changed.**
- If your saved project cannot be read or opened, the app says so on the Song & Vocals screen, including the step
  where it stopped (for example "while reading the saved project"). Autosave on this phone is paused, so the saved
  project is left exactly as it was. The top bar shows "⚠ autosave paused".
- A box under the steps offers three choices:
  - **Try again**: opens it if storage now answers. If you have already recorded new work in
    this session, it does not replace it; it tells you to back up first.
  - **Back up project now**: downloads this session as a project file.
  - **Start fresh**: only after you confirm, this session becomes the saved project and autosave resumes.
- The same box and buttons now also appear when loading is stuck (the 0.31.5 case), so you are no longer left with
  autosave off until a reload that may get stuck again.
- The "Opening your saved project… N s" line no longer stays on screen after loading finishes.

## Unchanged
Audio, tuning, cleaning and the approved sound. The 7 engine files are byte-identical (ENGINE-SHA256.txt). R1–R14 hold.
Project and backup formats are unchanged; projects open in 0.31.5 and 0.31.6 alike.

## Files changed
index.html (restore, start-up, storage box, version strings), rec.js (autosave indicator), song-studio.js (shows the
warning if it happened before the Song screen was built), song-studio.css (box buttons), tuner-routing.js and
note-editor.html (cache version strings only), tests-0.25/check25.cjs (R15), new tests-0.31.6/restore_error316.py.

## Rollback
`rollback/pre-0.31.6-runtime.zip` is the complete 0.31.5 runtime. Extract it into a separate folder and run serve.py.
