# Playbook Vocal Studio 0.34.1 beta: laptop spacing

Owner report: on a Windows laptop, Song & vocals showed only the header, buttons and recording helpers. The tracks were far below and needed scrolling. Windows display scaling (for example 150% on a 1920×1080 screen) leaves about 1280×600 inside the browser. At that size, 0.34.0 started the first track at 650 px, which is below the window.

## What changed (laptops, 900 px and wider)

**Step header: one row.** The steps, Workspace (label hidden, select narrower) and Undo/Redo sit on one line. The POLISH subtitle "(Clean · Tune · Chain · Mix)" is hidden on laptops. Between 900 and 1199 px wide, the app name is hidden too; the browser tab still shows it.

**Song & vocals is compact:**
- File buttons 34 px tall.
- Transport buttons 38 px tall.
- Recording helpers show their title and tools on one row, with the recording-track readout beside them.
- The status message is one slim line.
- Song sections is one row (title, sections, Add / Edit).
- Timeline tools 32 px tall.

**Short laptop screens (760 px tall or less; the room readout and slimmer POLISH rows apply up to 820 px):**
- Tracks are 132 px tall unless you drag a track's height yourself.
- Track side panels scroll inside the track instead of making it taller.
- "Room: … of recording" moves into the clock's tooltip so the transport fits one row.
- The Expand recording window opens full size the first time (as the tuning window already did); your own window size is remembered as before.
- POLISH has a slimmer menu row and transport, and the Polishing bar fits on one row.

**Result at 1280×600:**

| | 0.34.0 | 0.34.1 |
|---|---|---|
| Tracks start | 650 px (off screen) | 342 px |
| Vocal track and waveform | needed scrolling | visible with Recording helpers open |
| POLISH settings panel | 290 px | 336 px |

**Fix:** with no vocal open in POLISH, the older tuner and cleaner choices no longer count as "in use". The Classic tools switch decides.

**New test suite** tests-0.34.1/laptop.cjs (34 checks) at 1280×600, 1366×650 and 1536×730 covers:
- the one-row header
- the vocal track visible without scrolling
- Recording helpers on one row
- the recording window full size
- POLISH fitting the window with LOOP not clipped

tests-0.34.1/recording.cjs replaces the 0.34.0 copy (version string).

