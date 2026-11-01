# Handover: Playbook Vocal Studio 0.34.0 beta (easier to use)

**Base:** 0.33.1, the copy published in westgeorge1/playbook-vocal-studio under `beta/`.

**Owner's request:** make the studio "very user friendly". The controls a feature needs should sit next to it, and the older tuning tools should be hidden behind a switch.

The owner agreed to 13 recommendations after a scan at 390×844 and 1280×800. All 13 are built. Details are in CHANGES-0.34.0.md.

## Guarantees

- This release changes **layout and labels only**:
  - No engine, processing, saved-project or Undo code changed.
  - Every control keeps its id and handler. It is moved, folded or relabelled, never rebuilt.
- The approved presets give identical tuned and final PCM to the 0.32.3 reference in the same browser (playback suite).
- ENGINE-SHA256.txt verifies.
- All view choices live in localStorage on the device. None are stored in the project.

| Key | What it remembers |
|---|---|
| `pvs.classicTools` | Classic tools switch (`'1'` = on) |
| `pvs.folds.v1` | Which CLEAN / CHAIN sections are folded |
| `pvs.dockOpen.v1` (+`.narrow`) | Whether the editor panel is open (laptop and phone separately) |
| `pne.sideTab` | Tuning-window tab |

## Files

| File | What it does |
|---|---|
| ux-simple.js / ux-simple.css | Studio side, loaded last in index.html. See the table below. |
| note-editor-ux.js | Tuning-window side, loaded after the editor's inline script. See the second table. |
| tests-0.34.0/ux.cjs | 66 checks |
| tests-0.34.0/recording.cjs | Copy of the 0.33.1 suite with the version string updated |

What `ux-simple.js` handles:

| Part | Details |
|---|---|
| Classic switch | `setClassic`, `apply`. A body class `pvs-simple` / `pvs-classic` drives the CSS. Elements tagged `.ux-classic-only` (with `data-ux-use="tuner"` or `"cleaner"`) stay visible while the song uses them (`body.pvs-legacy-tuner` / `pvs-legacy-cleaner`, polled every 0.7 s). |
| View menu item | `#uxClassicItem` |
| `arrangeClean()` | Moves the measurement into Noise removal and the everyday controls first. Builds the `#uxCleanMore` fold. Moves `#cleanListen` into a pinned `.ux-listen` strip. Folds the loudness graph. |
| `arrangeTune()` / `arrangeChain()` | Listen strips: proxy buttons that click the matching `#abSeg` button and mirror its `aria-pressed`. CHAIN rack folds via `fold(rack, key, openByDefault)`. |
| `arrangeHeader()` | Slimmer Polishing bar. `.ux-dup` hides #polishWave, #polToRC, and the tuning-window title-bar Play/Stop when the workspace is notes. Labels: Play says "this vocal", plus song Undo titles. Moves #workWindowOpen into the dock tab row. |
| `arrangeDock()` | Editor panel starts collapsed unless remembered open. TUNE tab opens it on laptops. After a work window opened from a slim panel closes, the panel goes back to slim. |
| `syncKey()` | `#dawKey` shows the note editor's KEY / SCALE while the note editor is the tuner. |
| API | `window.PvsUX = {classic, setClassic, apply, folds}` |

What `note-editor-ux.js` handles:

| Part | Details |
|---|---|
| Tab bar | `.neTabs` with `#neTab-note/-tune/-check/-more`. Each panel's `data-tab` comes from the `assign` map. Non-panel children of `.panels` (the hosted help line) belong to More. |
| `#checkPanel` | New panel built from the "Chords and corrections" block. |
| `#classicApproved` | Wraps the approved presets (`.neClassic`); `#correctPanel` also gets `.neClassic`. |
| `#classicPanel` | Holds the `#classicTools` checkbox. |
| `#keyLine` | Holds #presetKeyHint, #useDetectedKey and #refInfo, placed right after `.tools`. |
| `apply()` | Every 0.8 s and on `storage` events. Hides the Classic Smooth option unless it is the current mode (new vocals start in Classic Smooth 25%). Hides approved presets in the Blind compare lists when classic is off. Sets editor Undo/Redo titles after the empty-state code restores titles. |
| Note tab | A MutationObserver on `#noteBody[hidden]` switches to Note when a selection appears and returns to the previous tab when it clears. |
| API | `window.PlaybookUX = {apply, show, tab}` |

## Decisions the owner should know about

1. **Hard Effect stays visible.** The owner didn't answer this, so I kept it as a creative effect.
2. **Classic Smooth stays in the Mode list while it is in use.** It is the starting sound of every new vocal (and of Hard Effect), so hiding it would misreport the current setting. It is labelled "(current)" and is tucked away once a Natural preset is chosen.
3. **The editor panel starts as a slim bar** on laptops and phones. On laptops, choosing TUNE opens it. On phones, TUNE's "Open tuning window" opens the editor full screen.

## Older tests that changed (only where a control is now hidden by design)

| Suite | Change |
|---|---|
| tuning, windows, playback, navigation, editors | Before clicking the approved presets, turn Classic tools on in the editor (`localStorage pvs.classicTools='1'` + `PlaybookUX.apply()`) and show the Tune tab. |
| tuning, playback | Show the Check tab before Blind compare, and the More tab before Level notes / AI octave check. |
| tuning-plus | Click the Check tab before chords / correction map, and the Tune tab before presets. |
| cleaning | Open More cleaning controls before room profiles, learn noise and AI isolation. |
| layout | Open the editor panel before checking its resize handle. |
| workspace-editor | Settings column beside the roll is checked on `.panels`. Play is the editor's own #play, and the title-bar copy is checked as hidden. |
| editors | "Open editing window" is the one inside WAVE EDIT; the Polishing-bar duplicate was removed. |
| recording | tests-0.34.0/recording.cjs replaces tests-0.33.1/recording.cjs (version string). |

All suites ran green on 0.33.1 in this environment before the change. Results are in TEST-RESULTS-0.34.0.txt.

## Still to check on real devices

1. The owner's Android phone:
   - pinned POLISH tabs and listen strip while scrolling
   - the one-row tab bar at 360 px
   - Song & vocals tools above the tracks
2. Older Samsung Internet. CSS uses `display:revert` and sticky positioning. No `:has()` is used.
3. Whether the owner wants the editor panel open by default on laptops. It is a single default in `arrangeDock()`.

## Possible next steps (not built)

- One shared Undo across the song, cleaning and notes. Each Undo is only labelled for now.
- Merge the File/Edit/View/Help menu row into the step header to give the settings panel another ~45 px.
- Fold DETAIL's five effects like CHAIN. It is still 2,600 px tall on a laptop.
