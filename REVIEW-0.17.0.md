# Playbook Vocal Studio 0.17.0 — review

**Goal:** remove the old recording features completely, keep the necessary ones and fuse them into
1 RECORD & COMP, so there is one place to record and POLISH only polishes the comp.

## Verdict
Ready for the **test link**. All 275 automated checks pass at 1366x768, 1920x1080, 390x844 and 360x800.
The control audit covers all 509 element ids and all menu actions of 0.16.1 with no unexplained loss: 406 still
there and wired, 106 replaced (each replacement checked), 29 intentionally dropped with a reason.
None of this has been tried on a real phone, mic or pair of headphones yet. Please do one real session (below)
before this goes on the main link.

## What changed for you
- **One record screen.** Punch-in on the fly, the Loop switch, CLICK, HEAR ME, GAIN and Import take are all on the
  screen now, not in a menu. Settings ▾ only has settings and files.
- **Punch-in that keeps the groove.** Press R while the song plays, then R again, and the song keeps going.
  The punch becomes a new take of the part under the playhead: the old take outside the punch and the new
  singing inside it. One Undo puts things back.
- **POLISH is smaller.** It has CLEAN · TUNE · CHAIN · DETAIL · MIX (keys 1–5) and the editors. If you change a
  choice after loading the comp, POLISH shows **Load my new comp**.

## Checked in this review
| Area | Result |
|---|---|
| Punch-in lands in the right part at the right time | Pass: with the fake mic the punch started at the key press; the test allows up to 0.6 s for mic start-up. The end is within 0.5 s. Outside the punch the audio matches the old take exactly (error 0); inside it is new. |
| Punch-out keeps playing | Pass: the song keeps playing. The comp player restarts so you hear the new take. |
| Punch over empty song | Pass: a "Punch 0:10" part is made. |
| Loop: one take per pass | Pass: 3 passes give 3 takes, 2 passes give 2 (phone), names are unique and every take covers the part. |
| Loop past the end of the backing | Pass: refused, with a plain warning. |
| Import take (part / song aligned, too short) | Pass. |
| Metronome, count-in, HEAR ME, GAIN | Pass (desktop and phone). |
| Latency applied | Pass: 250 ms makes the take land 0.25 s earlier (measured 0.250). |
| Full 7-part song, 24 takes, export alignment | Pass: the exported WAV matches the chosen takes sample for sample (max error below the 24-bit step), with no clicks at the joins. |
| POLISH on the comp | Pass: CLEAN, TUNE, the note editor, CHAIN, DETAIL, MIX, listen modes, loop, WAVE EDIT take file, compare reference and export WAV all work. |
| Save / reload / reopen | Pass, including punch and import notes. |
| 0.15.0 and 0.16.1 projects in 0.17 | Pass: markers and ratings are kept in the data but not shown, and they survive a 0.17 save. |
| 0.17 project in 0.16.1 | Pass. |
| Engine files byte-identical | Pass (sha256 in ENGINE-SHA256.txt). |
| Console errors | None in any suite. |

## Bugs found and fixed during this build
1. **Page error on load.** The core still bound the old Session-window Record button, which had been removed.
   This stopped the rest of the old panel bindings from running. Fixed.
2. **Monitoring stayed on after a normal take.** With HEAR ME on, your mic kept playing in the headphones after
   the take ended. This was already in 0.15/0.16. Now monitoring switches off and the mic is released when the take ends.

## Risks and limits (please read)
- **Real devices not tested.** Headless Chrome with a fake mic cannot show real Bluetooth delay, phone
  power-saving or how loud the click is on your headphones. Do one real session: run the latency test, punch in
  on a verse, loop-record a chorus, and listen to the comp.
- **First punch in a play-through can miss a moment.** If the mic is closed when you press R, the browser needs
  time to open it, usually 0.05–0.3 s on real devices. That bit is not recorded, and the punch starts when the mic
  is ready. To avoid it, click the MIC LEVEL meter (mic check) before you press Play. The mic then stays open and
  a 1-second buffer covers the press.
- **Small gap at punch-out.** When you punch out over your comp, playback restarts with the new take. Expect a
  brief gap. Its length was not measured on real devices.
- **Loop recording mutes your comp** for the whole loop, the same as 0.16. You hear the backing (plus the click
  if it is on) while you loop.
- **Old panels are hidden, not deleted.** The 0.13 core still reads some fields from the old PHRASE/REC panels.
  Those elements sit in one hidden, inert container, and some dead code that draws them is still there.
  Deleting them safely would mean rewriting the core recording code, which also handles the audio, so it was not
  done in this release.
- **Two record buttons on desktop.** The transport REC and the big red button remain on purpose. REC is the
  punch control near Play, and the big button is the main one; they do the same thing. The phone has only the big button.
- **1366 px is tight.** The transport row fits, but the meter and gain slider are narrower there.

## Files
App: index.html, rc.js, rc.css, rec.js, daw.js (changed). daw.css, rec.css, rec-worklet.js and the engine files
are unchanged. Documents: CHANGES-0.17.0.txt, TEST-RESULTS-0.17.0.txt, CONTROL-AUDIT-0.17.0.txt, RECORD-AND-TAKES.txt,
START-HERE.txt. Screenshots: screens/. Tests: tests-0.17/ (run_all.sh).
