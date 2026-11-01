# Handover: Playbook Vocal Studio 0.32.5 beta (resizable panels and windows)

Base: the owner's **Playbook-Vocal-Studio-Beta-0.32.4** source, unchanged except as listed below.
Goal from the owner: "check that everything is working correctly and that layers, blocks or windows can be dragged and resized."

## 1. Check of 0.32.4 (before any change)

The 0.32.4 source passed `node run-tests.cjs` with every reference set (0.14.0 at the pinned commit, 0.32.2 beta and 0.32.3 main). The suites ran serially on Chromium. **All 12 suites passed.** The counts match the agent's TEST-RESULTS-0.32.4.txt exactly.

| Suite | Result |
|---|---|
| navigation | 133/133 |
| storage | 10/10 |
| cleanup | 18/18 |
| editors | 74/74 |
| tuning | 44/44 |
| workspace-editor | 40/40 |
| windows | 48/48 |
| recording | 38/38 |
| restore | 56/56 |
| delete | 61/61 |
| playback | 4/4 (approved presets: identical tuned and final PCM vs 0.32.3 in the same browser) |
| upgrade | 13/13 |

No defects found in 0.32.4. ENGINE-SHA256.txt verifies.

## 2. What 0.32.5 adds

Resizing only applies from 900 px wide, where the desktop layout puts panels side by side. Phones and the stacked layout are unchanged and show no handles.

| Area | Handle | Implementation |
|---|---|---|
| POLISH settings panel (CLEAN…MIX) | Left edge of `.insp` | `--pvs-insp-w` → `.work` grid column. 280 px to (window − 480 px). |
| POLISH editor dock | Top edge of `#dock` | `--pvs-dock-h`. Hidden when the dock is collapsed or is a floating window. 120 px to 80% of the window. |
| POLISH track-name column | Right edge of `#laneHeads` (inside `.arrange .lanes`) | `--pvs-heads-w`. 110–320 px. |
| Song & vocals name column | Right edge of any `.sg-lane-head` | `--pvs-sghead-w` on every `#songStudio .sg-lane`, including the ruler. 150–380 px. |
| Song & vocals track height | Bottom edge of any filled lane | `--pvs-sglane-h` plus `:root[data-pvs-sglaneh]`. Unset keeps the original `height:auto; min-height:176px`. When set, the height is exact and the lane head scrolls (`overflow-y:auto`). |
| Floating work windows (#dock, #songStudio) | Eight `.ww-edge-*` elements (n, s, e, w, and the four corners) | In work-windows.js. Uses the existing `rect()/applyRect()/remember()`, so the 640×400 minimum, screen clamping and per-mode size memory are reused. West and north edges keep the opposite edge fixed. Hidden when maximized, on narrow screens, or when not a window. |
| Tuning window settings column | `.neSplit` between `.mainCol` and `.panels` (note-editor.html) | `--ne-side-w`. Visible only in the hosted wide work window (≥1000 px, not Focus notes). |
| Piano-roll height | `.neRollGrip` under `#editor` | `--ne-roll-h`. Visible in the docked editor and narrow windows. Hidden in Focus notes, where the roll already fills the window, and in the wide window. |
| Dialogs | Title bar: `#vocalEditor .stdialog > header`, `#songDialog h2`, and `dialog > header, h2` (Project storage, Quality, Reference guide) | `style.translate`. Desktop only. The position resets when the dialog closes or its title is double-clicked. Buttons and inputs in the title still work. |

All handles:
- use pointer events with pointer capture (mouse, pen, touch). Each is a focusable `role="separator"` with `aria-label`, `aria-orientation` and value attributes.
- resize with Arrow keys (15 px), Shift+Arrow (60 px) and Home (reset). Double-click also resets.
- add `body.pvs-resizing` during a drag. This blocks text selection and turns off iframe pointer events so the tuning iframe doesn't swallow the drag.
- trigger a `resize` event once per animation frame. The canvases (song-studio draw, daw layout, rc layout) redraw at the new size.

**Reset all:** a new "Reset panel sizes" item (`#pvsResetLayout`) at the end of the View menu.

**Persistence (view preferences only, per browser):**
- `localStorage['pvs.layout.v1']`: inspW, dockH, headsW, sgHeadW, sgLaneH
- `localStorage['pne.layout.v1']`: rollH, sideW (inside the editor iframe, same origin)
- floating window sizes: unchanged key `pvs.workWindows.v1`

These keys never go into the project, IndexedDB autosave, backups or Undo. Saved values are clamped to the current window on load and on every resize. A width saved on a large monitor therefore cannot push a smaller laptop page off screen.

**Public hooks for tests and the agent:** `window.PanelLayout = {reset, set(name, px), get(name), prefs()}` and `PlaybookNoteEditorLayout = {reset, get(k)}` inside the editor frame.

## 3. Files

New: `layout-resize.js`, `layout-resize.css` (both loaded last in index.html), `tests-0.32.5/layout.cjs`, `tests-0.32.5/recording.cjs` (the 0.32.4 suite with the version expectation set to 0.32.5), `CHANGES-0.32.5.md`, `TEST-RESULTS-0.32.5.txt`, `FILES-SHA256-0.32.5.txt`.

Changed:
- `work-windows.js`: edge handles. The footer now reads "Drag any edge or corner to resize".
- `work-windows.css`: `.ww-edge-*`, plus larger touch targets under `pointer:coarse`.
- `note-editor.html`:
  - CSS variables on `.editor` and `.panels`
  - `.neSplit` and `.neRollGrip` markup, inserted next to the existing `.mainCol` wrapping
  - a `paneHandles()` function
- `index.html`: the two new links and `?v=0.32.5`.
- Version strings set to 0.32.5 in: `studio-main.js` (APP_VERSION, savedBy, READ-ME text, worker URLs), `tuner-routing.js`, `workspace-transfer.js`, `workspace-standby.html`.
- `run-tests.cjs`: adds `tests-0.32.5/layout` and uses `tests-0.32.5/recording`.
- `TESTING.md`, `README.md`, `START-HERE.txt`.

Unchanged and byte-identical to 0.32.4: all audio, tuning, cleanup, storage and engine files. These include natural-tuning.js, separation.js, song-core.js, song-studio.js, studio.js, project-storage.js, daw.js, rc.js, worker.js and engine-wasm.*. ENGINE-SHA256.txt verifies.

## 4. Tests

`tests-0.32.5/layout.cjs` (port offset 12, so 8982, or PVS_PORT_BASE+12). It runs **61 checks**, all passing, with real mouse drags:
- the POLISH splitters: drag amounts, limits, keyboard, aria value, double-click, Home, reload persistence, View → Reset, and the dock handle hiding when collapsed
- all eight edges on the tuning window: left and top keep the opposite side, corner, minimum, remembered size, hidden when maximized
- the recording window's right edge
- the tuning settings column and the docked piano-roll grip
- Song & vocals: name column (lane and ruler together), track height below the controls' natural height with the head scrolling, grow again, no selection or song edit from the drag, double-click reset
- moving the song dialog and the take editor, then reopening in the original position
- 390×844 and 844×390: no handles, no horizontal overflow, full-screen windows without edges
- a 1000×700 window with oversized saved widths stays clamped
- no IndexedDB keys, no dirty flag and no Undo entries after resizing, plus no page errors

The full serial run of 0.32.5 is in TEST-RESULTS-0.32.5.txt.

## 5. Not done, or recommended next

1. **Moving parts and tracks on the timeline** is now a firm owner requirement. See section 6.
2. **Touch tablets ≥900 px:** grab areas widen under `pointer:coarse`. Two device checks are still needed:
   - Song & vocals lane edges: a touch drag there can be taken over by page scrolling, which sends pointercancel and ends the resize.
   - The panel handles on an iPad or Android tablet in landscape.
3. **Rearranging or docking panels** (swapping the settings panel to the left, or tearing tabs into their own windows) is not part of this release. Pop out already moves a whole workspace to a separate browser window.
4. **Pop-out windows** load the same index.html, so they get the same handles and the same per-device sizes.
5. **Accessibility:** handles are keyboard reachable. A screen-reader pass on real devices is still needed.

## 6. NEXT (owner requirement): move parts and whole tracks on the Song & vocals timeline

The owner wants to drag a recording along the timeline, the way a DAW moves clips. Today:
- In Song & vocals, dragging on a lane's waveform makes a time selection, and Drag to scroll (`#sgHand`) pans the view.
- A part can only move with "Move part to … s" in the take editor. That is the Record & takes path, `VocalEdit.transform(...,'move')` in studio.js `partEdit`, which also checks overlaps.
- A take can be nudged with ◀ 10 ms ▶ (`offsetMs`).
- SongCore has no region-move operation.

### Behaviour

- **Toggle:** add a **Move parts** checkbox next to "Snap to beat" and "Drag to scroll", following the `#sgHand` pattern. Move parts and Drag to scroll are mutually exclusive. With it off, nothing changes. A toggle is used instead of press-and-hold so phones work without fighting scroll or selection.
- **Dragging a part:** with Move parts on, dragging a part slides it.
  - Show a ghost outline and a live readout of the new start (seconds and bar·beat).
  - Snap to beat when Snap is on. Holding Alt/Option bypasses snap.
  - Esc during a drag cancels.
- **Whole track:** Shift+drag moves every part on that track together. Add "Move whole track…" to the track's ⋯ menu, with a seconds/beats field and Earlier/Later nudges. Use this to line up a whole vocal against the riddim.
- **Keyboard:** for the selected part, ←/→ moves it 10 ms, Shift+←/→ one beat (or one bar). One Undo step per key burst.
- **Undo:** one `SongStudio.edit(..., 'Move part')` per completed drag. One Undo puts it back. Autosave as usual.

### Data (SongCore)

Add `SongCore.moveRegions(w, trackId, regionIds, delta)`:
- For each region:
  - shift `r.start` and `r.end` by `delta`
  - shift **every** take's `origin` by `delta`, so the alternative takes stay aligned for comping
  - keep `offsetMs`, `trimIn` and `trimOut` unchanged
- **Clamp delta** so that `start ≥ 0` and `end ≤ LIMITS.seconds` (900). Respect `range()`.
- **Overlap with another part on the same track:** use the same rule as `partEdit`, either ask ("Do it anyway") or refuse at the end of the drag. Outline the overlap in red while dragging.
- **Phrase-volume moves (`t.levelMoves`)** that lie fully inside a moved part shift with it. If a shifted move would overlap another, `validateMoves` throws. In that case refuse the drag with a clear message, never a silent drop.
- **Section links:** `partRegions()` matches parts to a section by `r.start` ≈ section start (0.5 ms). Moving a section part detaches it from that section's comp list. Decide explicitly: either store a section id on the part, or warn "This part will no longer be listed under Verse 1" before moving.
- **Compact cleanup takes (PVS_DERIVED):** their sources don't change, only `origin`, so they must still rebuild after reopening. Cover this with a test.

### POLISH and tuning: the main risk

`trackSignature()` hashes the rendered track, so after a move, POLISH shows "Update needed" automatically. The owner's **note-editor edits** (`cfg.editor` state in tuner-routing.js) belong to the old rendered input. Moving a part must **never silently discard his hand tuning**:
- Whole-track move: shift every note time in the saved editor state by `delta`, then re-render.
- Single-part move: shift the notes inside the old part range by `delta`.
- Notes that no longer line up: warn before the move ("Tuning edits inside this part will be re-analysed").

Test that a moved, tuned track still has its hand-edited notes.

### Tests to add (tests-0.32.6/timeline-move.cjs)

- The drag moves the part by the drag distance. Snap and the Alt bypass work. Esc cancels.
- All takes in the part move together. Comp choice is kept.
- Shift+drag and "Move whole track…" move every part. Keyboard nudges work.
- One Undo restores exact positions. Redo works.
- The overlap prompt appears, and Cancel changes nothing.
- Clamping at 0 s and 900 s.
- Phrase-volume moves travel with the part. A blocked overlap shows a message.
- Playback and export render the part at the new time (sample-exact offset of a test tone).
- Autosave and reopen keep the positions. Cleanup-derived takes rebuild.
- POLISH is marked "Update needed". Hand-tuned notes are kept after a whole-track move.
- At 390×844, the touch drag moves the part with Move parts on and doesn't scroll the page.
- With Move parts off, selection behaviour is unchanged (the existing suites stay green).

## 7. Improvement suggestions (owner asked for these before handover)

The suggestions are ranked by value for the owner's stated goals: clean background noise and breathiness without touching his voice, natural tuning that keeps his tone, and a phone-first workflow. Items marked ✔ already exist and are not repeated:
- ✔ cleaning: Studio Spectral noise profile, hum and rumble, Vocal Detail, manual Separate sound, one-at-a-time breath reduction, de-ess
- ✔ tuning: Natural mode, per-note formant, note transition, quantize, research presets, blind compare, AI octave check

### Cleaning

1. **Remove beat bleed using the beat itself.** CLEAN currently warns "Music detected behind your voice … cleaning can't separate a voice from a beat". The app has what generic cleaners lack: the exact backing file and the exact time it played during the take (including the recording latency it already measures).
   - Method: an adaptive reference canceller (frequency-domain NLMS / echo-cancellation style). It estimates how the beat leaked from headphones or a speaker into the mic and subtracts only that.
   - Output: a "Beat bleed" control (Off / Gentle / Strong) with Hear removed.
   - Limits: works when the bleed came from playback during recording, not when the beat was mixed into the file.
   - Test: synthetic bleed (beat through a short filtered delay plus voice) should drop by ≥ 15 dB while the voice's error stays below −30 dB.
2. **Find all breaths at once.** The current WAVE EDIT flow is one breath at a time ("Next possible breath" → "Reduce this breath").
   - Add "Find all breaths": a list showing time and level, with ▶ for each breath and a tick to skip it. "Reduce ticked breaths by 6 dB" applies them as one Undo step.
   - Keep the existing safeguards: no words, consonant protection, 6 dB start.
3. **Gap-only cleaning.** Lower the background only in the pauses between phrases, with slow fades, and leave sung notes untouched. That is the safest way to remove noise without changing tone.
   - Use the note editor's voiced/unvoiced map, or the phrase detector, to find the gaps.
   - Offer it as a mode beside Gentle / Balanced / Strong, for example "Pauses only".
4. **Voice-safety meter.** After cleaning, report how much was removed inside sung notes versus inside pauses, for example "Voice touched: 0.4 dB · Pauses cleaned: 9 dB". Warn when the voice is touched by more than about 1 dB. This makes the owner's rule "don't affect the voice" visible and testable.
5. **Optional AI voice isolation**, not the default.
   - Run a speech-enhancement model in the browser through the onnxruntime-web build already in `vendor/` (used for the octave check), for example DeepFilterNet.
   - Add a Blend knob (dry/wet) and Hear removed.
   - Check: the model's licence against AGPL-3.0, download size, and phone CPU time on a 3-minute vocal. Process offline, with progress shown.
6. **One noise profile per recording session.** Reuse a learned profile for every take recorded in the same room. Cleaning is then consistent across verses and doesn't depend on each take having a quiet pause.

### Tuning

1. **Live pitch guide while recording.** Show the sung note against the piano keys, and the key/scale, in real time in Record. On the phone it must stay readable at arm's length. Singing closer to pitch means less correction later, which is the most natural result.
2. **Learn my voice.** The owner plans to supply three of his vocals.
   - Measure his natural vibrato rate and depth, typical scoop and fall lengths, and note-transition speed.
   - Save that as a "My voice" profile that Natural Roots uses for its vibrato, drift and transition settings, so tuning keeps his phrasing. Approved presets stay untouched.
   - The profile is a separate preset.
3. **Chord-aware tuning.** Key detection already exists. Add chord detection on the riddim and use it in two ways:
   - When a sung note sits between two scale notes, prefer the chord tone sounding at that moment.
   - Mark notes that clash with the current chord.
   Reggae riddims usually loop a short progression, which helps detection. Keep this as an option and compare it with Blind compare.
4. **Correction map.** Colour each note by how far tuning moved it (for example green < 20¢, amber 20–50¢, red > 50¢), with a "Next heavy correction" button. Large moves are where tuning becomes audible. The owner can then fix those by hand or re-sing the phrase (Fix phrase already exists).
5. **Protect hand-tuned notes.** Make sure notes the owner moved or fine-tuned (− / + cents) are never changed when he later applies a preset or the Smooth knob. If that isn't guaranteed today, add a lock that shows on each note (🔒), applies automatically to hand-edited notes, and can be turned off.

### Workflow

- **Before/after loudness match** on every A/B in CLEAN and TUNE (Blind compare already does this), so "louder" never sounds like "better".
- **Device checks still owed:** Android phone and tablet, Bluetooth latency, headphone recording, and a listening test on his three real vocals for each new cleaning or tuning feature.
