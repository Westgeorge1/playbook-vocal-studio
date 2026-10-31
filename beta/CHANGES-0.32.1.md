# 0.32.1 — Tune to the beat by default; a better "follow my singing"

## New default: tune to the backing

New vocals no longer follow your own pitch centre. In the note editor, **Tune to** (next to A =) now starts on **Backing, else A = 440 (auto)**:

- With a backing in the song, the editor measures the backing's tuning and tunes your notes to it, so the vocal matches the beat. If the beat's tuning can't be read clearly, it uses A = 440.
- With no backing yet, it uses A = 440. When you add the beat later, tuning moves to it automatically.
- A line under the tools says what the notes are tuned to and why, e.g. "Tuned to the backing: A = 433.6 Hz (−25¢)."

Projects saved before 0.32.1 keep their exact reference (shown as **Custom**), so they sound the same.

## Tune to: all choices

| Choice | What it does |
| --- | --- |
| Backing, else A = 440 (auto) | Default for new vocals, as above |
| The backing (measured) | Measures the backing now and keeps that reference |
| Standard A = 440 | Concert pitch |
| My singing | Tunes to your own pitch centre (for singing a cappella or with a band tuned to you) |
| My singing, following drift | Also follows slow drift sharp or flat across the song |
| Custom A = | Type a value; typing in A = also selects this |

## Improved "My singing"

- **Better estimate.** It uses only steady notes of 0.15 s or more, skips notes flagged for review, and uses smart note centres when they're on, so scoops and octave errors don't pull it off. On a simulated singer centred 27¢ sharp it found +27¢.
- **Clear readout:** where your singing centres, how clear the reading is (clear / fair / weak), how many notes it used, and how far you move across the song, e.g. "you move from +19¢ to +36¢ across the song". If your notes don't agree on one centre, it suggests Standard A = 440.
- **Following drift.** The new mode tracks the slow movement of your pitch centre (a weighted local line fit, about ±5 s) and tunes each note to the centre at that moment. On a simulated singer drifting 20¢ sharper over the song, notes landed within 1.3¢ of the singer's own intended pitch, against 6.6¢ for one fixed centre. The drift curve is saved with the project, so it sounds the same when reopened.
- **Warning with a backing.** If you follow your singing while the song has a backing, a note says the vocal may clash with the beat, with one tap to **Tune to the backing**, or **Keep** to dismiss it.

## Changing the reference keeps your edits in tune

When the reference changes (any Tune to choice, typing A =, Match backing, or Auto following a new backing), notes you've already snapped or edited move with it, so they stay on the new keys. You no longer need to reapply a preset. Untouched notes are re-tuned by automatic tuning as before. Undo restores the previous reference and notes.

## Fixes from the 0.32.0 review

- **Level notes** did nothing in an intermediate 0.32.1 build: its button code had been removed while the reference warning was rewritten. Restored and covered by a test. 0.32.0 itself was not affected.
- **Harmony and double layers** now use the same per-note reference as the lead in "following drift" mode.
- **Settings report** (Export / Finish & check): when the note editor is the tuner, "Pitch reference" now shows the editor's real reference (e.g. "note editor: backing, else A = 440 (A = 433.6 Hz)") instead of the Original tuner's follow-my-singing setting.

## Unchanged

Your approved presets' settings and processing are unchanged. At the same reference they produce byte-identical audio to 0.31.13, and tuning.cjs checks this using A = 443.8 Hz, the reference 0.31.13 chose for its test vocal. A new vocal now starts at the backing's tuning or A = 440 instead of your singing's centre, so its final pitch target can differ by that offset.

Files changed: note-editor.html, natural-tuning.js, note-editor-safety.js, index.html (settings report and version), tuner-routing.js and workspace-transfer.js (version), tests-0.32.0/ (tuning, recording).
