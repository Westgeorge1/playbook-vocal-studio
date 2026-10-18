# Playbook Vocal Studio — debug and review of 0.16.0 (result: 0.16.1)

Reviewed 18 Oct 2026 by Grok Bot. Written in plain English.

## In short
0.16.0 worked well. The main jobs — record each part, keep several takes,
pick the best one, join them into one vocal and carry it to POLISH — all work,
and the joined vocal is exactly your chosen takes in the right places.
I found **4 medium bugs and 6 small ones**, plus one honest-wording fix. All are
fixed in **0.16.1**. The sound engine was not touched, and projects still open
both ways between 0.15, 0.16.0 and 0.16.1.

## What I checked
- Read every line that changed from 0.15 to 0.16 (the new RECORD & COMP
  screen, rc.js / rc.css, and the edits to index.html).
- Ran the app in a real Chrome browser (no screen) with a fake microphone
  that sings a voice-like tone, at four sizes: laptop 1366x768, big screen
  1920x1080, and phones 390x844 and 360x800 with touch.
- Recorded a whole 7-part song with several takes per part, picked takes,
  exported, saved, reloaded, reopened in a fresh browser and went on to POLISH.
- Tried to break it: pressing Record many times fast, switching parts while
  recording, Undo while recording, unplugging the mic mid-take, mic blocked,
  no mic at all, 32 takes on one part (43 in the project), slow 50 BPM songs
  with count-in, a 44.1 kHz sound card, and no backing track.
- Measured the exported comp against the chosen takes sample by sample, and
  checked the joins for clicks.
- Checked the live beta link (it loads over HTTPS with no errors, still 0.16.0).
- Re-ran every earlier test suite.

## Bugs found and fixed
| # | How bad | What happened | Now |
|---|---|---|---|
| 1 | Medium | On a 1366x768 laptop the COMP lane and take lanes 4-5 were hidden; you had to scroll inside a small box to see your comp. | The lanes use the space; COMP lane visible with 5 takes. |
| 2 | Medium | After Export, the browser's download box covered "Comp done → Go to POLISH" and blocked the click (on phone it covered it). | Download box moved out of the way on this screen. |
| 3 | Medium | Dragging a part's IN/OUT flag past the end of its chosen take quietly un-chose that take, so that part went silent in the comp with no warning. | A message tells you and Undo brings it back. |
| 4 | Medium (rare) | Slow song (~50 BPM) + 2-bar count-in + part at 0:00 + latency ≥ about 0.25 s: the take was thrown away ("Invalid take position"). | Take kept; count-in still plays. |
| 5 | Small | Mic errors showed raw browser text ("NotAllowedError…"). | Plain English: blocked / no mic found / mic in use. |
| 6 | Small | Shift+R made a stray 8-second "Phrase N" part. | Shift+R = next part and record. |
| 7 | Small | After changing Count-in, R and Space did nothing until you clicked elsewhere. | Work straight away. |
| 8 | Small | 33rd take on a part gave a vague message. | Clear "delete some takes first" message. |
| 9 | Small | Adding a part on top of another silently replaced the older part's sound in the overlap. | Warning shown. |
| 10 | Small | While a big saved session was opening (~6 s), the screen said "Add your first part". | Says "Opening your saved session… one moment". |
| — | Wording | Help said parts "crossfade". They actually each fade out and in over 20 ms (no clicks, but a tiny dip at the join). | Wording now says exactly that. |

Also tidied: part chips no longer jump on every screen update, and Play no
longer copies the whole comp each time (snappier on long songs).

## Checked and working (no change needed)
Fast repeated Record gives one take only · switching part, Next/Previous,
Undo during recording are ignored safely · Esc cancels · mic unplugged
mid-take gives a clear message and the next take works · count-in plays 4
clicks · 32 takes on one part still runs at 60 frames a second · delete
unchosen takes + Undo · no-backing sessions · 44.1 kHz sound cards · export
matches the chosen takes exactly (error 0.00000007) · no clicks at joins ·
POLISH gets exactly the comp · save ZIP, reload, reopen in a fresh browser ·
phone layouts at both sizes, buttons at least 44 px.

## Test results (final 0.16.1 code)
- Earlier suites: 0.16 tests **110/110**, 0.15 tests **85/85**, smoke **61/61**,
  control audits **437 and 352 controls, none missing**.
- New scenario runs: laptop **35/35**, big screen **35/35**, stress/races
  **27/27**, mic problems + live beta **10/10**, phones **22/22**, the fixes
  **11/11** — **140/140**.
- Details: TEST-RESULTS-0.16.1.txt. Screenshots: tests-0.16.1/screens/.

## What is still a risk (not bugs I could fix safely)
1. **No real phone, mic or Bluetooth was tested.** Everything ran in a browser
   with a fake mic. Run the Latency test once on your real phone and mic.
2. **iPhone / Safari**: recording starts a moment after your tap (same as 0.15);
   Safari is fussy about that. Android Chrome is the safe choice.
3. **The tiny dip at each join** (each part fades out and in over 20 ms). No
   clicks, but on a held note across a join you may hear a small gap. Fixing it
   means changing the engine — suggested for a later version, only with your OK.
4. **Many takes on one part** (more than about 7): the lanes box scrolls; the
   COMP lane is then below the takes.
5. **Autosave** rewrites the whole session after each change. Fine on a computer;
   on an older phone with a long song it may feel slow for a second. If the
   indicator ever shows "not saved", use Save project (ZIP).
6. Lane headers say "Take 1, 2…" by position, not the take's own name; one
   confirm box still says "phrases" instead of "parts".

## Files changed
rc.js, rc.css, rec.js, index.html (fixes); daw.js, rec-worklet.js, rec.css
(version text only). Engine files byte-identical: phrase-core.js, worker.js,
phrase-worker.js, engine-wasm.*, daw.css. Project format still version 9.
