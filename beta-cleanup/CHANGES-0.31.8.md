# 0.31.8 — expandable work windows for beta

Tuning, waveform editing and reference comparison now have a movable, resizable work window inside the app. Maximize fills the browser; Restore size returns to the smaller window. Return to studio or Escape docks the existing editor. Phones and short landscape screens fill the browser automatically.

Focus notes gives the piano roll more room while retaining playback, editing tools, Undo/Redo, zoom, overview and key/status. All tuning controls restores the settings and presets. Both take-editing dialogs have Maximize. The waveform Sound controls button returns to the inspector correctly.

The live note-editor iframe stays in place through layout changes; its vocal, note edits and current session are retained. Existing processing, key safety, autosave and project formats are unchanged. The seven locked engine files are byte-identical.

## Repository integration

Prepared against main commit `3d0b037599c3b16ebd570c84b79beff967e55e1b`. All 42 beta runtime files matched the supplied 0.31.7 source before the update. Changes are confined to `beta/`; the repository root app is untouched.

Runtime changes: `index.html` (version/cache tags and new assets), `note-editor.html` (layout CSS only), `tuner-routing.js` (iframe cache tag only), plus new `work-windows.js` and `work-windows.css`. Copy all five together. There is no build step. Window position is remembered during the current page session, not stored in projects. These are in-app windows, not separate browser windows for another monitor.

The full 0.31.8 source ZIP supplied in the conversation contains the browser tests, core suites, detailed results and previous runtime rollback. This deployment repository keeps its existing compact layout. See TEST-RESULTS-0.31.8.txt for checks performed. A Git revert of the integration commit restores the previous deployment files.
