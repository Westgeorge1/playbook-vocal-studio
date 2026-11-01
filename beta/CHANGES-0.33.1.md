# Playbook Vocal Studio 0.33.1 beta: fixes from debugging 0.33.0

The owner reported three suspected problems. All three were real, and each was reproduced on 0.33.0 before fixing. tests-0.33.1/regressions.cjs has 21 checks, and 11 of them failed on 0.33.0.

## 1. Pauses only could clean the end of a held note

**Cause.** "Singing" was decided by loudness alone: anything more than 30 dB below the loudest singing counted as a pause. A held note that fades out was cleaned once it dropped that low (in the test, from 6.3 s, while still 26 dB above the room). So was quiet, breathy singing.

**Fix.** Voice detection now also checks whether a frame is *pitched*: a sung sound repeats, while breath, hiss and room noise don't. Any pitched frame above the room noise counts as singing, however quiet it is. Unpitched noise at the same level is still cleaned.

Also:
- Pauses are now judged on the vocal after beat-bleed removal, so a pitched backing heard in the mic isn't mistaken for singing.
- Beat-bleed estimation keeps using loudness only, so a backing heard in the pauses is still used to measure the leak.
- The voice-safety meter uses the same, better detection.

## 2. "Undo these" (Find all breaths) could undo a later edit

**Cause.** It stepped back through the editor's history once per breath. It only checked that the number of breath edits hadn't changed, so a timing edit made afterwards was undone instead of a breath. In the test, one breath stayed reduced and the timing edit was lost. If a breath was then reduced by hand, the batch couldn't be undone at all.

**Fix.** The batch now remembers exactly which breath edits it added and removes those, wherever they are, with "remove this edit" steps. Timing, comp, tuning and hand-made breath edits made afterwards are kept. Edits from the batch that you already changed or removed are skipped, and the status line says so.

**Also fixed:** when every listed breath was reduced, the list emptied and the "Undo these" button disappeared. It now stays.

## 3. Undo of a timeline move left the hand-tuned notes behind

**Cause.** By design, Undo in Song & vocals keeps each track's latest POLISH work. For a move, that meant the part went back but its POLISH edits stayed at the new place. Opening POLISH then asked to reset them, and the hand-tuned notes were lost. Redo had the same problem.

**Fix.** Each move is remembered on its Undo step. Undo carries the track's POLISH edits back with the audio, and Redo carries them forward again. This includes edits made in POLISH after the move, which are captured first. A burst of arrow-key nudges is one Undo step, and the edits come back by the burst's full distance.

## Found while debugging

- **Cleaning cache:** with Beat bleed on, replacing the backing could reuse the result computed with the old backing. The cache now includes the backing's identity. With Beat bleed off, the cache is unchanged.

## Unchanged

Engine files (ENGINE-SHA256.txt verifies), approved presets, and everything else from 0.33.0.
