# Playbook Vocal Studio 0.31.5 (2026-10-29)

## Fixed: Record did nothing on a phone with a saved project
**What happened.** When the app opens, it first reads your saved project (your takes) from the phone's browser storage.
On West's Android phone that read never finished. Until it finishes, the app is in "Opening previous session…",
which switches off every button: Record, Play, Back up project, Open project, Export audio, New song. The
"Opening…" text was shown only on the old Open screen, not on the Song & Vocals screen, so Record looked
dimmed and a tap did nothing, with no message.

**What changed.**
- The Song & Vocals screen now shows "Opening your saved project from this phone… N s" while it loads.
- If the saved project has not loaded after 20 seconds, the app unlocks so you can record. Your saved project
  is left untouched in storage: the app will not save over it in that session, and says so on screen.
  If it finishes loading later and you have not recorded anything, it opens automatically.
- Record is never a dead button any more. If the app has to wait, tapping Record says why in plain words
  (loading, processing, Finish & check running, a POLISH change that failed, mic already in use).
- The old Record button and "● Record a vocal" in Start your song behave the same way.

## Unchanged
The 7 engine files are byte-identical (ENGINE-SHA256.txt). R1–R13 hold; new rule R14 in AGENT-HANDOVER.md.

## Tests
- New: tests-0.31.5/record_stuck315.py (390 px phone view; storage that never answers; busy app). 0.31.4 fails it.
- check25.cjs 68/0.
