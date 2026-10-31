# Response to the independent review of 0.17.1 → Playbook Vocal Studio 0.17.2

Every finding was first checked against the 0.17.1 code (all seven were confirmed), then fixed in the order the
review recommended: F1, F2, F5, F6, then F3, F4, F7, then the smaller items. The audio engine is byte-identical
(ENGINE-SHA256.txt verified). No feature was removed. The review's evidence scripts (reproduce.cjs, engine-checks.cjs)
were not supplied, so equivalent tests were written in `tests-0.17/t172.py`. They run in real Chrome with a fake
microphone, and some checks call the real recording-finish path with synthetic audio so the results can be checked
sample by sample.

| # | Finding (0.17.1) | Confirmed cause in the code | Fix in 0.17.2 | Tests |
|---|---|---|---|---|
| F1 | A long punch-in loses the audio after 60 s | `stopRec`: `if(b-a>60)b=a+60`. The punch composite was built only to `p.end+pad`. There was no safety limit on punch or loop recording. | Removed the clamp. A punch now uses the same placement code as a normal take (`placeTake`): the part grows to the 60-s project limit and the rest of the punch goes into `(cont.)` parts, as many as needed. The composite runs to the raw end. The 10-min limit (warning 1 min before) and its message now also apply to punch and loop recording. | t172: synthetic 75 s and 125 s punches, sample-exact over every second, one Undo; real 75 s and 125 s punches through the microphone; the safety limit stops a punch and a loop, with a message |
| F2 | The take is trimmed at the next part without asking; the silent tail is cut off | `fitOut`: `if(!canMove‖ask(...))` trims when the next part can't be shortened; the finish code sliced to `keepTo` | The take always stores the whole raw recording, from the lead-in to Stop, silent tail included. If the singing runs into any part, a window (`#pvsChoice`) asks: **Keep ‹next› as it is** / **Make room / Replace …** (names the parts and how many takes are removed) / **Keep it as a take only**. Any failure restores the parts exactly. One Undo reverses the whole change. The recovery copy is cleared only after the take is stored; an add that fails keeps a WAV for "Download my last microphone recording" | t172: short overlap, most of the next part (part left and part removed), entire next part, several following parts, a continuation reaching another part, each with every choice, with full-take and Undo checks; "replace" names the takes and Undo restores them; the real window on desktop and phone (screenshots); t171: keep / make-room, silent tail stored |
| F5 | Mic disconnect throws away the take | Cap `onended` → `stopRec(false)`; core `track.onended`/`mr.onerror` → `r.error` → throw | Device loss now sets `r.lost`, not an error. The audio so far is kept as **Take N (mic lost)** (normal take or punch), and a loop pass in progress as **(mic lost, incomplete)**, with a message. Esc (your own cancel) still discards. If decoding fails, the message points to the recovery download | t172: mic lost during a normal take, a punch and a loop pass; Esc still cancels; sessB updated |
| F6 | Saving resets POLISH note, breath and timing edits | `saveProject` called `phraseApply()` (`restoreSession` with empty notes/edits) whenever `phraseNeedsApply()` | Save no longer applies anything: it saves the POLISH session as it is plus the whole workspace. Whether the comp has changed is now decided by a comp signature (`phraseCompSig` / `appliedSig`), so adding, renaming or deleting unchosen takes doesn't count. Older projects fall back to the revision rule, and the signature is recorded the first time it's needed. Sending a new comp is explicit and always asks, with a warning that POLISH edits start again | t172: note edit → unchosen add / rename / delete is not stale → un-choose is stale → cancelled download leaves everything identical → save (phraseApply calls = 0) → reopen keeps the note edit and the same vocal, comp still waiting → "Load latest comp" asks, No keeps the edits |
| F3 | GAIN isn't live for normal takes | `pvsRecStream` added a gain node only at ≠0 dB and only at start | One owned input gain stage (`RG`) is always built: mic → GAIN → recorder, meter and HEAR ME. `setGain` updates RG and the punch/loop capture live | t172: a take started at 0 dB uses the stage; 0 → +12 dB mid-take shows about +12 dB in the stored PCM; a punch 0 → −12 dB shows about −12 dB |
| F4 | Turning HEAR ME on during a take does nothing | `applyMonitor` only drove the punch capture; a normal take opened a second mic stream, and only if monitoring was on at start | `applyMonitor` drives `RG.mon` (normal take) or `Cap.mon` (mic check, punch, loop). No second `getUserMedia`. A visible message appears if it can't connect, and the monitor is released when recording stops | t172: OFF→ON→OFF before recording (no mic opened), in the mic check, during a normal take (still one stream) and during a punch; released afterwards; already ON at start; forced failure shows "HEAR ME is not working"; t17 updated |
| F7 | The tests don't fail properly | `report()` always returned 0; `run_all.sh` ignored exit codes; hard-coded paths; the Undo check was a NOTE | `report()` exits 1 on any FAIL (or no checks). The audit exits 1 on fails or page errors. `run_all.sh` records each suite's exit code, prints a summary and exits 1. `selftest_run_all.sh` proves pass → 0, FAIL → 1, crash → 1. Env vars: PVS_APP_DIR, PVS_TESTS, PVS_CHROME, URL, URL15/16/170/171, PVS_PYTHON, PVS_OLD_DIR. The polish17 Undo is now a real assertion | selftest_run_all.sh; t171 seen exiting 1 on its first 0.17.2 run |

## Smaller items
- **App version vs engine version** are labelled separately in help › About ("App version: 0.17.2 · Audio engine version: 0.12.1") and in Settings ▾ › ABOUT. Tested in t172.
- **START-HERE** no longer contains the stale "hosted link is still 0.13.0" sentence. It now says which version each link serves.
- **Backup and export results on the phone:** the backup result (saved / cancelled / failed) is shown on the RECORD & COMP status line and as a message. Tested on a 390 px phone for a cancel and a success.
- **Autosave, backup and export are clearly separate:** Settings ▾ lists "Autosave (this browser only) — not a backup", "Back up project (.zip with every take)" and "Export comp audio (WAV) — not a project backup". The help and RECORD-AND-TAKES.txt explain each one.
- **"Why suggested?"** under each take shows the pitch, timing and noise numbers, the clipping and the score, or why there is none: analysis failed, pitch uncertain, the take doesn't cover the part, too close to call, or not enough takes. Tested, including the analysis-failed state.

## Compatibility
- Projects from 0.15 and 0.16 open in 0.17.2 (old17.py). Projects saved by 0.17.0 and 0.17.1 open in 0.17.2 (t172).
- A 0.17.2 project opens in 0.17.1 and in 0.16.1 (t171). The new `appliedSig` field is ignored by older versions.

## Still unverified (as the review says)
- Physical phones (iPhone / Android), Safari, Bluetooth routing, real unplugging of a USB mic, and audibility of HEAR ME. The tests use Chrome's fake devices and simulate a disconnect with the track's `ended` event.
- Memory on low-end phones for 10-minute captures.

## Test run
Full `tests-0.17/run_all.sh` on 2026-10-18 (America/Havana): 418 checks pass, 0 fail, across 14 suites; the control audit against 0.16.1 passes; `selftest_run_all.sh` passes; the engine files are byte-identical (ENGINE-SHA256.txt). One check in F1920 failed under heavy parallel load (timing in the test, not the app) and passed when that suite was run again on its own. Details are in TEST-RESULTS-0.17.2.txt.

## Known limits (not changed)
- The POLISH Clean on/off switch is not on the POLISH Undo stack (true in every version).
