# Playbook Vocal Studio 0.32.3

## Project upgrades and separate saves

The main studio, original beta URL and cleanup preview URL each keep an independent browser autosave. On first open in a browser, each location copies the last project saved by a pre-0.32.3 build. The copy includes the referenced recordings, compact cleanup edits, backing and POLISH audio. The project can then be edited independently at each location. A failed migration rolls back before its completion marker is written. The older save remains available. The standalone note editor also separates saves by location.

Each copy uses browser storage. **Back up project** creates a portable ZIP with your recordings and edits. Use **Open project** to move a song deliberately between locations or devices.

## Blind compare and small screens

Starting a blind test selects Tuned even when playback is stopped on Cleaned input. Each Hear button explicitly returns to tuned audio if the input monitor was subsequently selected. Keep, Cancel and Undo retain their existing editing behavior.

The Tune to control shrinks inside its label on narrow phones. The full editing window was tested at 320 and 390 CSS pixels and in landscape.

## Manual Cleanup

In Song & vocals, open a take's Edit menu and choose **Manual cleanup · Separate sound**. Select a breath, rumble or frequency band, then audition Original selection, My edit and Hear removed. Keep the edit as a new take or export the selection. Version 0.32.3 includes the compact autosave and soft frequency-band edges from 0.32.2.

## Verification

See TEST-RESULTS-0.32.3.txt. The new upgrade and playback regressions are in tests-0.32.3. They use previously released source directories as independent references. No changes were made to the pitch algorithm, the approved preset values or the compiled audio engine.
