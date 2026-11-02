# Playbook Vocal Studio 0.35.0 beta

## Play from the recording timeline

Each vocal lane has Play at the top right of its waveform. The instrumental lane has it too. Every button controls the same transport as Play at the top of Song & vocals. Playback starts at the playhead, keeps the current armed track, Mute, Solo, levels and backing choice, and shows Pause on every lane while the song plays.

## Guide this vocal

Open **✦ Guide → Guide this vocal** on Song & vocals or from Smart Guide in POLISH. Choose a track and a passage. If a timeline selection fits inside the take and is at most 20 seconds, the guide offers it first. Otherwise it looks for likely breaths, sung passages, loud peaks, quieter lines and overlaps with other vocals. These are listening prompts. The guide does not transcribe lyrics or decide whether a note or word was intended.

- **Compare takes** loops two performances of the same range against the song mix, with matched level, basic peak and entry measurements, and an optional blind A/B. Choosing the challenger changes the selected take for that recording range.
- **Find the cause** plays raw, cleaned, tuned and final audio at matched loudness. Select the earliest stage where you hear the problem to go to the relevant controls.
- **Reduce a breath** starts with 6 dB and offers 3 dB under Try less. Edit the start and end, listen to the removed sound on its own, and hear the proposal alongside the song. Keeping creates a new take and preserves the source recording.
- **Check tuning** previews Snap All + Smooth 25% in a separate note editor. Try less previews 85% correction + Smooth 25%. Open notes in this phrase jumps to a nearby flagged note when one is available. The excerpt is local; keeping a preset applies it to that complete vocal lane. Use note-editor Undo to reverse a tuning preset.
- **Adjust vocal tone** auditions one HIGH-MID EQ or de-essing change in an isolated chain. Try less halves the proposed move. Keeping changes that control for the entire vocal. Use POLISH Undo to reverse a tone change.
- **Balance the mix** compares the current song with a 2 dB lift on the active phrase or a 2 dB dip on a separate vocal lane. Try less uses 1 dB. Mute, Solo, the master level and the enabled backing are respected. Existing overlapping volume moves must be reviewed in Phrase volume.

**Leave it** records the listening decision for this take without applying a sound change. Decisions use time relative to the source, so they travel with moved recordings and survive normal project saves. **Next unreviewed** advances to another passage. Take choices, breath edits, phrase level changes and review decisions use Song Undo. Tuning and chain changes retain their existing editor Undo histories.

This beta uses the existing vocal engine and approved tuning presets. Upgrade and playback comparisons use the pinned reference builds in TESTING.md.
