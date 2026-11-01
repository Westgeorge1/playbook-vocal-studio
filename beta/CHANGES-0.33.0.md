# Playbook Vocal Studio 0.33.0 beta

This release adds moving recordings on the timeline, five cleaning features and five tuning features. It also includes everything from 0.32.5 (drag-to-resize panels and windows).

Every new cleaning and tuning feature is **off or unchanged until you use it**. With nothing turned on, cleaning output is byte-identical to 0.32.x, and the approved tuning presets produce identical audio. The same-browser reference comparison and a CLEAN test both check this.

## Move recordings on the timeline (Song & vocals)

- **Move parts switch** (next to Snap to beat). Turn it on, then drag a recording left or right. All of its attempts move together, so comping stays lined up. The move snaps to the beat when Snap is on. Hold **Alt/Option** to move freely, or press **Esc** to cancel while dragging.
- **Shift + drag** moves every part on the track. Use it to line a whole vocal up with the riddim.
- **Move…** button and **⋯ → Move track…**: move by milliseconds, beats, bars or seconds, or to an exact start time.
- **Arrow keys** nudge the selected part by 10 ms. **Shift + arrow** nudges by one beat. A burst of nudges is a single Undo step.
- **Overlaps ask first.** "Move anyway" is allowed, and where parts overlap, the later one is heard. Moves stop at 0:00 and 15:00.
- **One Undo** puts any move back exactly. Positions survive autosave and reopening, including compact Manual-cleanup takes.
- **Your POLISH work moves with the audio.** This covers note-editor tuning edits, breath and timing edits, the loop and the noise sample. Reopening POLISH re-renders with every edit kept, without the "Update POLISH … reset" prompt. Only an edit that straddles a moved part's edge, or that the moved part now covers, is removed, and the status line says how many.
- A part moved away from a section start is no longer listed under that section. The status line says so.

## Cleaning (POLISH → CLEAN, Studio Spectral)

- **Beat bleed.** This removes the backing that leaked from your headphones or speakers into the mic, using the Song & vocals backing itself as the reference.
  - It finds the delay automatically and estimates how the leak was filtered.
  - It reports the delay and the match.
  - Choose Off, Gentle or Strong.
  - It works when the bleed was picked up while recording, not when the beat was mixed into the file.
- **Pauses only.** Singing is left sample-for-sample as recorded, and cleaning fades in only between phrases. This is the safest way to lower noise without touching your tone.
- **Voice-safety meter.** It shows how much cleaning changed your singing and how much it cleaned the pauses, for example: "Singing changed −0.2 dB (removed sound sits 31 dB below your voice) · Pauses cleaned 9.5 dB". It warns when the singing is touched.
- **Room profiles.** Save a learned noise sample as a named room profile on this device, then use it on any take recorded in the same room.
- **AI voice isolation (optional).** This is RNNoise, a speech-trained noise remover (Apache-2.0 WebAssembly build in vendor/rnnoise). It loads only when you choose a blend of 25%, 50% or Full. Listen for a watery or lisping voice and lower the blend if you hear one.
- **Find all breaths** (WAVE EDIT → Breaths).
  - It lists every likely breath with a ▶ button and a Show button for each.
  - Untick anything that is part of a word, then press **Reduce ticked breaths** to reduce them all in one go with the REDUCTION knob value.
  - **Undo these** removes the whole batch.
  - It searches the cleaned vocal, so backing bleed and noise don't hide breaths.

## Tuning

- **Live pitch guide while recording.** Song & vocals shows the note you are singing, how many cents sharp or flat you are, and a short trail, measured against the song key. It reads a copy of the mic, so the recording is unchanged. Turn it off with **Pitch guide** in Recording helpers.
- **Correction map** (note editor). This colours each note by how far tuning moved it: green under 20¢, amber 20–50¢, red over 50¢. **Next heavy correction** jumps to the notes where tuning starts to be heard.
- **Keep my hand-tuned notes** (on by default). Natural Roots, Gentle, Tight, Hard, both Original approved presets and Snap all leave the notes you moved or fine-tuned by hand exactly as you left them, and the panel says how many were kept. Untick it to reset every note as before.
- **Riddim chords.**
  - **Show riddim chords** reads the chords from the backing and draws them over the piano roll.
  - Notes that clash with the chord get a purple outline.
  - **Fit doubtful notes to the chord** moves notes sung between two key notes to the one in the chord. These count as hand edits, and Undo puts them back.
- **My voice.**
  - **Learn from this vocal** measures your vibrato speed and depth, how you scoop into notes, how fast you slide between notes, and how much you naturally drift.
  - Do this on up to three vocals.
  - The **My Voice preset** is Natural mode set from those measurements (note transition, flex and vibrato kept).
  - The profile stays on this device and is never saved in a song.
- **Loudness-matched comparing** already existed (BEFORE / CLEANED / TUNED / FINAL and Blind compare play at matched loudness), so it is unchanged.

## Files

- **New:**
  - timeline moves in song-core.js (`moveRegions`, `moveLimits`, `moveOverlaps`) and song-studio.js; edits that move with the audio in song-polish.js (`followMove`)
  - cleaning-plus.js, breath-find.js
  - live-pitch.js, chord-core.js
  - vendor/rnnoise/
  - tests-0.33.0/
- **Changed:**
  - noise-core.js: validates the new settings
  - noise-cleaner.js: render hook
  - note-editor.html: lock, correction map, chords, My Voice
  - song-studio.css, noise-cleaner.css
  - index.html and version strings
- **Unchanged:** the engine files (ENGINE-SHA256.txt verifies), natural-tuning.js and the approved preset values.
