# 0.31.12 — Recording, editing and separate workspace windows

The work windows introduced in 0.31.8 did not include recording or true browser windows, and their launchers were hard to find. This release adds a visible Workspace selector with Recording, Vocal tuning, Audio editing and Reference comparison, plus Expand and Pop out actions.

Expanded recording keeps the existing recorder and timeline DOM in place. Moving, resizing, maximizing, pressing Escape or docking does not stop or discard a take. Recording has its own Undo/Redo controls and a Focus timeline toggle. Expanded tuning retains the same live iframe, edits and rendered audio. Existing take editor maximize controls remain available. Full screen uses the browser API when supported, with an expanded-view fallback.

A separate browser window uses a single-owner handoff: stop playback, commit the project through the existing serialized atomic autosave, restore in the new window, then replace the original app with a lightweight standby page. The original writer and song journal are blocked during transfer. A failed save, failed restore, cancelled handoff or blocked popup retains the original session. Only the expected child and a fresh handoff token can complete the transfer. Return stops and keeps any active recording, commits the project and closes the popup. Closing the popup restores the last autosave in the original tab. Reloading the popup authenticates against the standby again.

This is a save-and-reopen transfer, so Undo starts fresh in the destination. Use Expand to keep in-session Undo. Browsers decide whether Pop out opens a window or a tab; phones can always use the full-size in-app workspace. Only one separate editing window owns the project at a time.

No processing algorithms, channel counts, project formats or locked engine files changed. The previous recording, restore protection and deletion fixes remain in place. Only beta files are released; the root application stays at 0.14.0.

New runtime files: workspace-transfer.js and workspace-standby.html. Deploy these with index.html, work-windows.js/css, song-studio.js and tuner-routing.js from this release.
