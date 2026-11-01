# Playbook Vocal Studio 0.32.5 beta

## Drag to resize panels and windows

On a laptop or desktop (900 px wide or more), the studio's panels can be resized by dragging their edges:

| Where | What you drag | What changes |
|---|---|---|
| POLISH | Left edge of the CLEAN · TUNE · CHAIN · DETAIL · MIX panel | Settings panel width |
| POLISH | Top edge of the Note editor · Wave edit · Compare reference panel | Editor panel height |
| POLISH | Right edge of the BACKING / VOCAL name column | Track-name column width |
| Song & vocals | Right edge of any track's name area | Name column width for every lane and the ruler |
| Song & vocals | Bottom edge of any track | Track height for every filled track. When you choose a height smaller than the track's buttons, they scroll inside the name area. |
| Floating windows (Expand) | Any edge or corner | Window size. The left and top edges keep the opposite side in place. The window keeps its 640 × 400 minimum and stays on screen. |
| Tuning window | The line between the piano roll and the settings column | Settings column width (wide windows) |
| Docked note editor | The grip under the piano roll | Piano roll height |
| Take editor, Song dialogs, Project storage and other dialogs | The title bar | Moves the dialog. It reopens in its usual place. |

- **Keyboard:** each handle can be focused with Tab. Arrow keys resize by 15 px, Shift + arrow by 60 px, and Home resets.
- **Reset:** double-click a handle (or a track edge, or a dialog title) to restore that size. **View → Reset panel sizes** restores every panel size.
- **Remembered per device:** sizes are view preferences in this browser. They are not saved in the song, autosave, backups or Undo. A size saved on a large screen is limited on a smaller one, so panels never push the page off screen.
- **Phones and narrow screens:** the stacked phone layout is unchanged and shows no resize handles. Floating windows are full screen there, as before.

## Other changes

- The floating-window footer now says "Drag any edge or corner to resize".
- Version 0.32.5 is used on every script and stylesheet link, so a phone cannot combine a cached 0.32.4 file with the new page.
- New files: layout-resize.js, layout-resize.css. Changed: index.html, work-windows.js/.css, note-editor.html, and version strings in studio-main.js, tuner-routing.js, workspace-transfer.js and workspace-standby.html.
- No tuning, audio, cleanup or storage code changed. The approved tuning presets are unchanged (verified by the same-browser reference comparison).

## Validation

See TEST-RESULTS-0.32.5.txt and TESTING.md. The new tests-0.32.5/layout suite drags every handle with a real mouse, checks keyboard resizing, reset, reload persistence, limits, phone widths and that no project data is written. tests-0.32.5/recording is the 0.32.4 recording suite with the version expectation updated.
