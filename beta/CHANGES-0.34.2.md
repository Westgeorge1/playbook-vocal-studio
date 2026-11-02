# Playbook Vocal Studio 0.34.2 beta: Clean up here and the Smart Guide coach

## 1. Clean up here (Song & vocals)

The owner asked for a way to clean a noise at the moment he hears it, without hunting for it.

**How to start it:**
- **Clean up here** button in the transport, next to Fix phrase.
- **N** key (C was already Click).
- **Right-click** a recording on the timeline. On phones, press and hold.

**What it does:**
- It pauses and opens Manual cleanup on the recording under the playhead, on the armed track.
- About one second around that moment is already selected and zoomed in. A timeline selection is used instead when there is one.
- The cleanup window says what to do next.
- Closing it returns the playhead to where you were.
- Saving is unchanged: Keep as new take adds a take, the original stays, and Undo works.

**Code:**
- song-studio.js: `openCleanup()` and `cleanupHere()`; the Edit dialog uses the same `openCleanup`.
- studio.js: `openSongCleanup(t, p, save, {a, b, message, onClose})`. Without the new options it behaves as before.

## 2. Smart Guide coach (smart-coach.js, smart-coach.css)

The Smart Guide now works like an engineer beside you. It watches where you are and what you change, then advises stage by stage.

**What it follows:**
- Song & vocals, Recording, Manual cleanup
- CLEAN, TUNE (note editor, including its own actions)
- CHAIN, Vocal Detail, MIX, WAVE EDIT and Compare reference

**Stage tracker:** 1 Record › 2 Clean › 3 Tune › 4 Chain › 5 Finish. The current stage is highlighted and stages with warnings are marked. "Now" and "Next" lines say where you are and what to do next.

**Checks** (warning ⚠ or tip ✦, each explaining why and the usual safe range, often with a fix button):

| Area | What it checks |
|---|---|
| Recording | Clipping, a very low mic level, HEAR ME without headphones, no riddim loaded, little recording room left, several takes with none starred |
| Manual cleanup | Selection over 30 s. Selection covering singing with a strong reduction (pitched frames measured against the whole track); a selection that is only a breath gets the all-clear for 6–10 dB. Very strong reduction, Rumble under voice settings |
| CLEAN | Cleaning eating into the singing (the voice-safety meter); background close to the voice with cleaning off; background still audible after cleaning; strong cleaning on an already quiet background; Maximum reduction above 15 dB; AI isolation blend at 50% or more; Beat bleed skipped or finding little bleed; strong cleaning without a learned noise print; a reminder to listen to REMOVED NOISE after changes |
| TUNE | Key mismatch (with the "Use detected key" fix); more than 15% of notes moved 50¢ or more; tuning-reference notes; Hard tune sound |
| EQ and chain | Band boosts over +4 dB (tip) or +6 dB (warning), named by band (boomy, muddy, harsh, hissy); cuts below −8 dB (thin, dull); LOW plus LOW-MID boosted (mud); presence boost with little de-ess; air boost with a noisy background; low cut above 140 Hz; second EQ beyond ±3–4 dB; compression over 75%; Peak control, de-ess and warmth too high; too much reverb; loud echo without echo duck; limiter off or ceiling above −0.5 dB; vocal level too low or too loud; loud doubler; big differences between loud and quiet words. The original guide's measured tips are included. |

Fix buttons use the same controls you would: they set the safer value and nothing else.

**Sound-quality outlook:** Good / Fair / At risk for each area, with the reason and an overall verdict. The areas are recording level, background noise, cleaning safety, even volume, tuning, vocal chain and final level. It is labelled as guidance from measurements and common practice, not a guarantee.

**Also in the guide:**
- **How it works** for the part you are in: what it does, steps, how to listen, common mistakes.
- **Explain controls:** hover any control (laptop) and the guide says what it does. On a phone, a tap explains instead of pressing until you switch Explain off.
- **What you just did:** the last 12 actions, including in the tuning window.

**Where it shows up:**
- **Live advice line:** a warning for the stage you are working in appears as a slim line under the step header, with its fix button, Open guide and ✕. It pushes the page down instead of covering controls. Tips do not pop up; they wait in the guide and its counter. It respects the guide's On switch.
- **Song & vocals** has a **✦ Guide** button with a count. POLISH keeps SMART GUIDE.
- **Laptop:** the guide opens as a side panel and the studio makes room for it.
- **Phone:** it opens as a full-width sheet.
- The original measured tips (Help with, Target sound, Preview / Apply) are kept, folded under the coach.

## Tests

| Suite | What it covers |
|---|---|
| tests-0.34.2/coach.cjs (45 checks) | Clean up here: button, preselection, guide context, singing and breath detection, return to spot, N key, right-click. The guide: context tracking, riddim advice, CLEAN too-strong warning and fix, listen reminder, live advice line, EQ too much and too low, compression, limiter, outlook ratings, panel fix buttons, side panel, explain mode, note-editor action tracking, phone sheet. |
| tests-0.34.2/recording.cjs | Replaces the 0.34.1 copy (version string). |

## Verified beta corrections

- On 1280×600 laptop screens, the transport and POLISH bar fit more compactly. With a backing track loaded and Recording helpers open, the timeline began at about 342 px and the vocal lane at about 507 px in Chromium. Custom track heights still take precedence.
- A stationary touch-and-hold opens Manual cleanup on the pressed spot. Dragging still selects a range. Right-click and touch-and-hold both restore the previous playhead on close. During take audition, the shortcut opens the take being heard.
- The Guide estimates singing using the whole vocal lane with the edited take substituted, including stereo takes whose channels have opposite polarity. Its breath suggestion now asks the listener to audition what was removed. The Guide can also be reopened on a touch screen while Explain is on.
- The published 0.34.0 short-laptop piano-roll fix, workspace-selector fix, regression check and historical release files are included.
