# Playbook Vocal Studio 0.14.0 (DAW) — live audit, recording workflow

Date: 2026-10-18 (America/Havana). This was analysis only: nothing in the app, `/workspace/pvs-site` or GitHub was changed or pushed.
Live URL: https://westgeorge1.github.io/playbook-vocal-studio/. The live files are byte-identical to `/workspace/vocalapp-daw`, including `index.html`, `daw.js`, `daw.css`, the workers and the WASM (checked with curl and cmp).
Tools: Playwright with Google Chrome, flags `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. Chrome's fake microphone plays a repeating beep, not a voice.
Scripts and logs: `/workspace/build/` (`smoke2.py`, `audit2.py`, `deep.py`, `deep_g.py`, `dup.py`, `*-live.*`, `*-local.*`). Screenshots: `screens/audit-live/` and `screens/audit-local/`.

## 1. Test results

| Suite | Live (HTTPS) | Local (http.server) |
|---|---|---|
| Functional smoke (60 checks: backing load, play/stop, Space/Home, seek, loop, ruler loop, 6 inspector tabs, 3 dock tabs, menus, windows, help, Smart Guide, legacy navigation, fake-mic record, auto punch-out, redo, early stop, analysis, take lanes, listen, choose, Ctrl+Z/Ctrl+Shift+Z, lane Choose, Apply, FINAL playback, mute/solo, Ctrl+S project ZIP, phone layout) | **60/60 pass** | **60/60 pass** |
| Control audit (all 311 ids from 0.13.0: exists, same event listeners, visible when its panel opens) | **304 PASS + 7 REPLACED, 0 FAIL** | same |
| Console errors / failed requests | **none / none** | none / none |
| HTTPS boot | `isSecureContext=true`. Engine reports "0.12.1 WebAssembly". The main worker and WASM loaded. The phrase-analysis worker ran every take. | same |

The 7 REPLACED items are the old OPEN…SAVE step tabs. They are still in the page and still wired, but hidden; their destinations are covered by the smoke test.

Not covered: a real voice, a real phone, Bluetooth, physical latency, how loud headphone bleed is, and long sessions.

## 2. How the key workflows work today (plain language, with evidence)

### A. Clearing and removing takes, and undo
- **Clear take choice** (PHRASE panel or Edit menu) un-picks the take. The phrase then goes back to the old vocal, or silence, the next time you Apply. *Evidence:* selected → `null`; one transport Undo brought it back.
- **Remove** (on a take card) deletes one take straight away, with **no confirmation**. **Remove phrase** deletes the phrase and all of its takes, also without confirmation.
- **Undo for takes is only one step deep.** *Evidence:* I had Take 1, 2 and 3, then removed Take 1 and then Take 3. One Undo brought back only Take 3; Take 1 could not be recovered. Pressing Undo again swaps back, so it acts as Redo.
- **There is no "delete all takes for this phrase"** except removing the whole phrase.

### B. Redoing a phrase (more attempts)
- After the first take, the record button reads **"Redo this part"**. Each attempt is added as a new take; nothing is overwritten. *Evidence:* Take 1's audio was unchanged after two redos. The limit is 32 takes per phrase and 128 in total.
- **Take names can repeat.** New takes are named "Take (number of takes + 1)". *Evidence:* with Take 1 and Take 2, removing Take 1 and recording again gave **"Take 2, Take 2"**. The lane labels count positions, so the "Take 1" lane showed a take named "Take 2". You can't rename or rate takes.
- **Once you choose a take, R and the big record button move on to the NEXT phrase.** That's because the resume line jumps to the end of the chosen phrase. *Evidence:* after Choose, R recorded a new 2.5–10.5 s phrase. To redo a phrase you've already chosen, you must use "Redo this part" in PHRASE, or click inside the phrase first. This rule came from the 0.14 design and surprises people.
- If you stop early (R, Stop or Stop and keep attempt), the take is kept but marked incomplete ("ended before the phrase was complete"). It can't be chosen.

### C. Recording without the backing, or without hearing the old vocal
- **No backing loaded:** recording works, and only the mic is recorded.
- **Backing switched off:** the backing M button (the same as "Include backing") stops the backing in your headphones while recording. *Evidence:* no backing source was scheduled. The switch is locked while recording.
- **The old vocal is always heard around the phrase.** Outside the phrase (during the lead-in, and for 0.3 s after End) the assembled vocal plays in your headphones, and you can't turn it off. **The new VOCAL M/S buttons don't affect recording.** *Evidence:* with vocal M on, 2 vocal sources were still scheduled at gain 0.87. Inside the phrase the old vocal is muted, which is correct for punch-in.
- The microphone records your voice only; the backing is never mixed in. Echo cancellation, noise suppression and auto gain are off, which is good for vocals.

### D. Punch-in
- **Setting the start point:** click the timeline. That moves the playhead and the gold resume line. Then press **Continue from here**, which makes an 8 s phrase from the resume line. Alternatively press **Use playback position** while it plays, which makes the phrase at the playhead (*evidence:* a phrase at 4.18 s while playing). Then press **R** or ●.
- **Pressing R while the backing plays does NOT punch in where you are.** It stops playback and records the selected phrase, or the next one at the resume line. *Evidence:* I pressed R at 2.9 s, and it recorded the 11–19 s phrase. Afterwards the playhead jumps back to 0:00. See `deep-03-R-during-playback.png`.
- **Pre-roll (lead-in):** 0–5 s, default 2 s, plus 0.15 s. Recording starts with the backing (and old vocal) from that point. At 0:00 the lead-in is silent, with an on-screen "Start in 2.1 s". *Evidence:* `deep-04`. **There is no count-in click and no metronome.**
- **Auto punch-out:** recording stops at End + 0.3 s. This worked in every test. Phrases can be 0.5–60 s long.
- **Punch-in over an existing vocal:** draw the phrase over the vocal you've already applied. You hear the old vocal up to Start, and the new take replaces only Start–End, with 20 ms fades, when you Apply. The original stays as the base, so nothing is lost.
- **Space during recording does nothing,** because Play is locked. Only R, ● or Stop end a recording.

### E. Other recording features
| Feature | Status |
|---|---|
| Loop recording (several takes in a loop) | **Missing.** R during a loop ends the loop and records the selected phrase once. |
| Count-in / metronome | **Missing.** The lead-in is silent. |
| Latency compensation | Automatic subtraction of `outputLatency + baseLatency` (0.04 s in the test), plus a manual alignment of ±500 ms per take. No calibration, and the input latency isn't measured. Bluetooth will be badly off. |
| Input monitoring (hearing yourself) | **Missing.** The mic is never routed to the headphones. |
| Mic gain / clipping | No gain control. The live meter turns amber above 0.7 and red at clipping. After recording, a "peaks were loud" message appears, and the analyzer reports the clipped percentage. All of these worked with the fake mic. **You can only see the mic level while recording,** so you can't check it beforehand. |
| Take naming / rating | Automatic "Take N" (imports use the file name). No rename, no stars. There is an analyzer score and a "suggested" take, but it is advisory. |
| Markers | None. Phrases are the only markers. |
| Keyboard flow | R starts and stops, L loops, Space plays (but not during recording), Ctrl+Z undoes the take change (one step), and 1–6 switch tabs. |
| Safety | The browser autosaves (IndexedDB `playbook-vocal-studio`). Recording stops and keeps the take if the page is hidden. Recovery download if decoding fails. |

## 3. Issues found

| # | Severity | Issue | Evidence |
|---|---|---|---|
| 1 | **High** | R / ● during playback doesn't punch in at the playhead. It stops and records a different phrase, then resets the playhead to 0:00. | deep D, `deep-03` |
| 2 | **High** | Take undo is one step only, and Remove take / Remove phrase have no confirmation. Several removals can't be undone. | deep C |
| 3 | **Med** | After Choose, R records a new 8 s phrase at the next position instead of redoing the current one. Easy to start the wrong phrase. | `dup.py`, `deep-06` |
| 4 | **Med** | Duplicate take names ("Take 2, Take 2"), and lane numbers that don't match take names. | `dup.py` |
| 5 | **Med** | VOCAL M/S doesn't work while recording. The old vocal is always heard in the lead-in, with no "hear old vocal" option. | deep E |
| 6 | **Med** | No count-in click or metronome. A silent lead-in is hard to come in on. | deep G |
| 7 | **Med** | The mic level only shows while recording, so you can't check your level first. No mic gain. | code + deep H |
| 8 | Low | Space can't stop a recording (DAWs usually allow it). | deep D |
| 9 | Low | No loop recording, markers, rename or rating. | deep F/H |
| 10 | Low | Latency compensation is automatic only, with no calibration. Bluetooth headphones will be early or late. | deep G |
| 11 | Low | A phrase can run past the end of the backing (11–19 s on an 11.5 s beat) with no warning. | `deep-03` |
| 12 | Info | Fake-mic takes all show "peaks were loud" and "pitch uncertain". This is expected for a beep, not a bug, but scoring on real singing still needs checking. | deep B |

## 4. Recommendations (for a solo singer on phone or laptop with headphones)

### Must fix
| Item | Benefit | Effort | Risk |
|---|---|---|---|
| **Punch-in on the fly:** R during playback starts recording at the playhead, without stopping the backing, and makes a phrase from there. R again (or Space, or End) punches out, and the playhead stays where it was. | Sing along and jump in when you feel it, like a real DAW. | M | Med: needs a new recorder start path (`startRecording` currently stops playback). Sample alignment must be tested on a real phone. |
| **Multi-step take undo/redo** (a history of about 20 workspace snapshots, sharing audio like the current snapshot does) plus confirmation for Remove phrase. | Mistakes when deleting takes can always be undone. | S–M | Low: snapshots already share the audio. Watch memory. |
| **Clear "Redo vs Next" buttons:** a big **Redo this phrase** and **Next phrase**, with R = redo the selected phrase and Shift+R = next. | Removes the confusing behaviour in issue 3. | S | Low |
| **Unique, permanent take names** (based on a counter that only goes up, e.g. "Take 4"), with lanes labelled by name. | You always know which take is which. | S | Low: old projects keep their names. |

### Should add
| Item | Benefit | Effort | Risk |
|---|---|---|---|
| **Count-in click and metronome** (1 or 2 bars from the BPM, own level, headphones only, never recorded). | Easier to come in on time. | M | Low–Med: timing must line up with the lead-in. |
| **Punch in/out markers on the ruler** (drag handles for Start/End, plus a pre-roll area). | Set phrases visually instead of typing seconds. | M | Low |
| **"Hear old vocal while recording" switch,** and make VOCAL M/S apply to recording monitoring. | Record clean, or follow your guide vocal. | S | Low |
| **Input check / arm meter:** a live mic meter when the track is armed, before recording, with a clipping light and advice. | Fix your level before singing. | S | Low: opens the mic earlier (permission prompt). |
| **Quick take tools:** a "Delete all unchosen takes" button (with undo), Clear choice on a right-click/long-press menu, and star rating (1–5) on take lanes and cards. | Fast clean-up, and you can mark favourites yourself. | S–M | Low; ratings must be added to the project format. |
| **Loop record:** while a loop region plays, each pass becomes a new take of that phrase. | Many attempts without touching anything. | M–L | Med: continuous recorder, split at loop boundaries, memory limits. |
| **Latency calibration:** play a click and record it back, or tap along, then save the offset per device and headphones. | Takes line up on any phone, even Bluetooth. | M | Med: device-specific. |
| **Warn when a phrase runs past the backing,** and offer to trim it. | Avoids empty recordings. | S | Low |

### Nice to have
| Item | Benefit | Effort | Risk |
|---|---|---|---|
| **Big-button phone record mode** (full-screen ●, phrase name, countdown, Redo / Keep / Next). | Easy with one hand while holding the mic. | M | Low |
| **Optional input monitoring** (mic to headphones, with gain and a "wired headphones only" warning). | Hear yourself. | M | Med: browser latency, feedback through speakers. |
| **Rename takes and phrases on the timeline** (double-click the label). | Organise verses and choruses. | S | Low |
| **Markers** (M key; verse/chorus labels on the ruler, jump with < >). | Navigate the song quickly. | S–M | Low |
| **Space stops recording, Esc cancels a take,** and Enter = keep and Next. | Faster keyboard flow. | S | Low |
| **Stronger autosave safety:** a "last saved" indicator, an autosave after every take, and a reminder to download a project after N takes or when storage is low. | Less risk of losing takes. | S | Low |
| **Mic input gain** (only when the browser allows it; otherwise guidance). | Easier level setting on quiet mics. | S | Low–Med: gain doesn't fix clipping before the converter. |
