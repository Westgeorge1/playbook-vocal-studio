# Playbook Vocal Studio 0.34.0 beta: easier to use

Base: 0.33.1. This release covers the 13 user-friendliness changes the owner agreed to after the 0.33.1 scan. Its goal: the controls a feature needs sit next to it, and the older tools stay out of the way until asked for.

It changes **layout and labels only**:
- No processing, engine, saved-project or Undo code was changed.
- Every control keeps its id and handler. It is moved, folded or relabelled, not rebuilt.
- The approved presets give identical tuned and final audio to 0.32.3 (playback suite).
- ENGINE-SHA256.txt verifies.

New files:
- ux-simple.js and ux-simple.css (studio)
- note-editor-ux.js (tuning window)
- tests-0.34.0/ux.cjs

## 1. Classic tools switch (recommendation 10)

**Where it is:** View → **Classic tools (older tuner & cleaner)**, or tuning window → More → **Classic tools**. It is off by default and remembered on this device in `localStorage['pvs.classicTools']`. Both switches stay in step, including with the tuning window open.

**What it hides while off:**
- The original approved presets (Snap all + Smooth 25%, 85% correction + Smooth 25%). They are also hidden from the Blind compare lists.
- The Correct pitch panel and Keep blue notes.
- "Original tuner — restore" on TUNE and "Original cleaner — restore" on CLEAN.
- File → Session & tracks (classic) and Edit → Load my latest comp (classic RECORD & COMP).
- The old TUNE help text about Snap all + Smooth 25%. It is replaced by a short current one.

**What stays visible:**
- **Hard Effect** stays with the other presets, as a creative effect.
- **Classic Smooth.** Every new vocal starts in Classic Smooth at 25% (the approved starting sound), so the Automatic tuning Mode list always shows "Classic Smooth (current)" while it is in use. After you choose a Natural preset, it is tucked away.
- **Classic tools in use.** A vocal that uses the older tuner or the older cleaner keeps that choice and its controls visible even with the switch off, so nothing is stranded.

## 2. Tuning window settings as four tabs (recommendation 3)

The settings column was 4,600 px of scrolling. It is now split into four tabs:

| Tab | What it holds |
|---|---|
| Note | The selected note |
| Tune | Presets, My voice, Keep my hand-tuned notes, with **Automatic tuning right under the presets**, plus Correct pitch (classic) |
| Check | Blind compare and a new "Check your tuning" panel: riddim chords, Fit doubtful notes, Correction map, Next heavy correction |
| More | Voice / Level notes, Beat grid, Harmony, Note detection, Classic tools |

How the tabs behave:
- **Tune** opens first. The last tab you chose is remembered (`pne.sideTab`).
- **Selecting notes opens Note**, and its tab shows a mark. Clearing the selection returns to the tab you were on.
- **Selected note help.** With nothing selected, it shows a one-line tip; "How to edit notes" folds the full help.
- **The "Research presets (0.32)" heading** is now "Presets".

## 3. CLEAN, CHAIN and the settings panel (recommendations 1, 2, 4, 13)

**CLEAN** now shows the everyday controls first, in one **Noise removal** area that includes the background measurement (13):
- the measurement
- Enable
- Gentle / Balanced / Strong
- Where to clean
- Beat bleed
- the voice-safety meter
- Maximum reduction
- Undo / Redo cleaning

**More cleaning controls** (folded, remembered) holds:
- learning a noise sample
- room profiles
- AI voice isolation
- vocal protection and filters
- the Vocal Detail shortcut

The loudness graph folds too.

**Listen strip (4).** It is pinned at the top of each tab, so you compare while adjusting:
- CLEAN: BEFORE · CLEANED · REMOVED NOISE. These are the original buttons, moved.
- TUNE: CLEANED · TUNED.
- CHAIN: TUNED · FINAL.

They switch the same listening mode as the transport and stay in step with it.

**CHAIN** keeps the preset, Dynamics & tone and Level open. EQ, Second EQ and Echo & space fold, and each opens from its heading (remembered, `pvs.folds.v1`).

**Laptop (1).** The step header is one row (steps and workspace together), and the Polishing bar is slimmer:
- Its long explanation moved into the bar's tooltip.
- The "Preview: this vocal" chip is hidden; Play now says "this vocal".
- Sound controls ↓ is hidden on laptops.

The page no longer scrolls at 1280×800, and the settings panel grew from 377 px to about 480 px tall.

The editor panel (NOTE EDITOR / WAVE EDIT / COMPARE REFERENCE) starts as a slim tab bar:
- Choosing an editor tab, or the TUNE tab, opens it.
- Its open/closed choice is remembered (`pvs.dockOpen.v1`).
- The "Open … window" button moved into its tab row.

## 4. Phone (recommendations 5 and 6)

**Song & vocals:**
- The timeline tools (Add vocal track, zoom, Move parts, Move…) sit directly above the tracks.
- The takes list comes right under the tracks, before the section tools.
- The transport was already pinned.

**POLISH:**
- The five tabs are one row, and they and the listen strip stay pinned while you scroll.
- The note editor no longer sits far below the timeline: the editor panel starts slim, and TUNE's **Open tuning window** (near the top of the tab) opens it full screen. Closing it puts the panel back to slim.

## 5. Labels and duplicates (recommendations 7, 8, 9, 11, 12)

**Duplicate buttons (7, 9):**
- Hidden duplicates: "Open editing window" in the Polishing bar (WAVE EDIT has its own) and "◀ Song & vocals" under the timeline (the Polishing bar has "← Song & vocals").
- In the tuning window, the title bar's Play/Stop copies are hidden, because the editor has its own transport.
- The studio Play button says **this vocal**; ▶ Whole song plays every lane.

**Undo labels (8):**
- Song: "Undo song edit (takes, sections, moves)".
- Tuning window: "Undo note edit".
- Studio: the existing context label.
- CLEAN: Undo cleaning.

**Old names (11):**
- File → "Back to 1 Song & vocals".
- Classic items are named as classic.
- View → editor panel items say "editor panel" instead of "dock".

**One key line (12):**
- The key warning and **Use detected …** sit right under KEY / SCALE / TUNE TO in the editor.
- The studio's top bar shows the note editor's key, instead of the older tuner's key, whenever the note editor is in charge.

In the published beta, the expanded tuning window uses tighter spacing between controls on short laptop screens. This gives the piano roll more room at 1280×720. The Workspace selector also keeps your choice between picking a workspace and pressing Expand, including when the window resizes.

## Tests

The new suite **tests-0.34.0/ux.cjs** (66 checks) covers:
- Classic tools off by default, the View menu and editor switches staying in step, and a vocal using the older tuner keeping it visible.
- The four tabs, automatic switching to Note on selection, and the key line.
- CLEAN essentials, More cleaning controls, and the pinned listen strip.
- CHAIN folds.
- Laptop fit and panel height.
- The phone's pinned tabs and listen strip, and the Song page order.
- The phone tuning window, labels, and remembered choices.

Older suites were updated only where a test clicks a control that is now hidden by default:
- Suites that test the approved presets turn Classic tools on first (tuning, windows, playback, navigation, editors).
- layout opens the editor panel before checking its resize handle.
- Other changes are listed in TEST-RESULTS-0.34.0.txt.
