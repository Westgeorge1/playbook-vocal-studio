# Playbook Vocal Studio 0.36.1 beta

Manual cleanup now starts in **Select sound** mode. Edit opens on a short timeline selection or about one second of the chosen take. Clean up here at the exact end can open the take that just finished. When another recording starts at that boundary, the recording under the playhead takes priority.

**Reduce a breath** starts at 6 dB. Use the waveform or the Start and End fields to mark the sound. **Before** and **After** audition the same passage at the same gain with up to half a second of surrounding audio on each side. With backing applies to both previews independently of the song monitoring switch. **Hear removed** solos only the material being reduced. **Keep as new take** changes only the selection and preserves the original. If you edit the chosen take, the edited copy becomes chosen. Song Undo restores the earlier choice.

The action row and selection length stay visible while the settings scroll. Selections over 30 seconds show the limit and offer **Select one second**. **Advanced** contains the frequency limits, spectrum, fade and selection exports. Stop or Close cancels a pending edit, preview or analysis. Escape closes the window. The frequency processing, spectrogram and breath search run in a worker using copies of the input.
