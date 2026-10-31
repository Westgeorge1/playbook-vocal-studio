# 0.31.13 — Bigger tuning workspace, safer Escape, tuning-reference note

This release fixes the problems found in the 0.31.12 workspace review and gives the note editor a layout built around the piano roll. No processing algorithms, presets, approved tuning sound, project format or locked engine files changed.

## Fixes

- **Escape no longer throws you out of tuning.** Before, pressing Escape to deselect a note closed the whole tuning window. Now the first Escape closes the shortcuts list or deselects your notes (or leaves a text field), wherever the key was pressed. Escape with nothing selected still returns to the studio. Recording and the other workspaces behave as before.
- **The Workspace selector follows the screen you are on.** Before, it always said Recording, so pressing Expand or Pop out while in POLISH sent you back to Song & vocals. It now shows Vocal tuning, Audio editing or Reference comparison in POLISH and Recording on Song & vocals. You can still pick another workspace before pressing Expand.
- **Window size, position and Focus choice are remembered** on this device for each workspace, including after a reload. Saved per browser (localStorage); nothing leaves the device.
- **Play / pause in the tuning window title bar.** It plays the tuning audition, the same as the editor's own Play. In Audio editing and Reference comparison it uses the studio transport.
- **Smooth knob readout.** The pointer is now a short tick at the rim, so it no longer crosses the "25%" number.
- **Workspace help** is a small round "?" button instead of a disclosure arrow.
- **Consistent names.** The launcher above the editor now reads "Open tuning window" / "Open editing window", matching the POLISH buttons.

## Tuning editor

- **Wide tuning window (about 1000 px and wider):** the piano roll takes the full height on the left, and the Selected note inspector and all settings sit in a scrollable column on the right. You can now change a note's drift, vibrato, slide, length, volume or formant while the note stays in view.
- **Short laptop screens (under 800 px high)** open tuning maximized the first time. Choose Restore size to get a window back; your size is then remembered.
- **Phones** open tuning in Focus notes. Fit sits beside Play and Loop, and the piano roll starts right under the controls.
- **Compact controls:** the zoom buttons moved into the playback row, the backing row is hidden when the song has no backing, and the privacy footnote is hidden inside the window.
- **Fit** (button or F key) fits all notes, or the selected notes, in view, both in time and in pitch.
- **Vertical zoom on a computer:** the ↕− / ↕+ buttons or Alt + mouse wheel make note rows shorter or taller. Pinch still zooms both ways on touch.
- **Keyboard shortcuts:** the ? button or the ? key lists every shortcut.
- **Collapsible settings panels:** tap a panel heading (Vocal tuning presets, Correct pitch, Automatic tuning, Voice, Beat grid, Note detection) to fold it. The choice is remembered on this device. Selected note always stays open.
- **Clearer formant labels:** "Formant (this note)" in Selected note and "Formant (whole vocal)" in Voice.

## Tuning reference note

"Tune to my singing's pitch" stays on by default because it is part of the approved sound. When the reference it picks is 15 cents or more away from A = 440, the editor now shows a short note, for example "A = 430.1 Hz · 39¢ flat of 440". The note offers:

- **Use A = 440:** sets standard pitch. Then apply your preset again. Undo restores your previous reference.
- **Match backing:** appears when the song has a backing. It measures the backing's tuning and sets the reference to it. The existing "Match tuning" button is now also available in the embedded editor.
- **Keep mine:** hides the note for that reference on this device.

## Not in this release (planned)

- Non-modal, side-by-side workspace panels and a slim transport in every panel (roadmap 0.34).
- A live second window for two monitors (later).
- Moving Clear recordings / Delete track into the lane menu.
- A bottom drawer for the Selected note on phones (the tap pop-up covers cents, snap, loop and join).

## Files changed

note-editor.html, work-windows.js, work-windows.css, index.html (version), tuner-routing.js (version), workspace-transfer.js (version). New tests in tests-0.31.13/. The main/root application stays at 0.14.0.
