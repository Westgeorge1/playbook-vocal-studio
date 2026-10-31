# Reference-guided finish — 0.27.0

Use a finished solo vocal as a guide when deciding how to finish your own recording. The guide saves measurements from a passage, proposes small changes to existing effects, and lets you compare the result before applying anything.

## Try it

1. Back up your song before upgrading. Extract this complete package, run `python serve.py`, and open the address it prints.
2. Open your vocal in POLISH. Choose **Reference guide**, **Use a reference profile** in Smart Guide, or **Save reference / get suggestions** in the existing reference comparison.
3. Choose the reference audio. **Find a sung section** estimates a useful start from the audio level; listen and adjust it. Select 3–30 seconds of a solo vocal, avoiding long silence, instrumental accompaniment and stacked harmonies.
4. Name the profile and choose **Save reference profile**. One profile is saved with this song. Saving another replaces it; Song Undo restores the previous profile.
5. Select 3–20 seconds from your own POLISH vocal, preferably similar notes, vowels and intensity. Choose **Get suggestions**.
6. Choose **Prepare matched preview** on one suggestion. Compare **Hear current** and **Hear suggested**. **Listen in mono** affects this audition only.
7. Choose **Apply this change** only if you prefer it. The existing POLISH Undo restores the previous settings and rendering. Close discards the preview. Analyze again before trying another change.

The profile is included in browser saves and project ZIP backups. The reference audio is not embedded: load its original file again to hear it. Saved measurements remain usable without that file. No reference recording is bundled with this application.

## What it can suggest

| Comparison | Possible listening trial |
| --- | --- |
| Body or upper-frequency balance in sustained, voice-like sections | A small change to the existing Second EQ, at most 1 dB per trial |
| Unusually prominent high-frequency bursts relative to singing | Up to 1 dB more of the existing de-esser |
| Greater variation in sung-frame levels | A small increase in existing word leveling |
| More side energy than the reference, with the doubler enabled | A small reduction in the existing doubler blend |
| Space or questionable stereo compatibility | A note to review reverb/doubling and compare in mono |

Protected Smart Guide controls are respected. The guide does not change the key, scale, pitch targets, tuning strength, source channel count, recording or notes. A bypassed effects chain is left alone. A bypassed Second EQ can be enabled from a flat starting point; its proposed resets and gain changes are shown before preview. With Second EQ already enabled, custom frequencies are preserved; the guide withholds a band when its frequency falls outside the compared range.

Insufficient singing, a quiet passage, incompatible high-frequency coverage or protected settings can produce no suggested change. That is a valid result. A brighter, louder or wider vocal is not automatically better.

## How the comparison works

`reference-core.js` uses 40 ms analysis windows at 20 ms intervals. Window-corrected autocorrelation provides a voice-like activity estimate; FFT band energy describes broad tone. Stereo channel powers are averaged before tonal comparison so opposite-polarity audio does not disappear from the measurement. Side energy and correlation supply separate width information.

The sung level range is the difference between the 90th and 10th percentiles of voice-like frame levels. It is not the same as whole-song loudness range (LRA). High-frequency bursts are a heuristic: they can include breaths, consonants, harmonies, noise and effects. The app does not recognize words or recover an exact studio effects chain.

Existing QualityCore measurements provide loudness and estimated true peak. The two preview buffers are matched to the quieter loudness and attenuated when necessary for peak protection. Reference audition has peak protection and can attenuate toward the measured vocal level; the existing reference A/B controls remain available for matched reference listening.

The preview runs the unchanged processing engine in a separate worker, starting from the current tuned audio. It copies the effects parameters, renders current and proposed versions, then returns only the selected passage. It uses up to two seconds of lead-in and one second after the passage. Long effect tails and adaptation can therefore differ from a full-song render. Apply uses the normal full-vocal edit/render path.

The main editor's audio, controls and Undo stack remain untouched during preview. Changing the source, settings, profile or passage invalidates the preview. Close cancels active analysis/rendering; a cancelled file load cannot populate a reopened guide.

## Persistence and integration

- The optional song property `referenceGuide` stores versioned, bounded measurement data: name, source filename, passage start and profile. It stores no PCM or embedded reference file.
- Profile writes use `SongStudio.edit`, including normal revision, journal, autosave and Song Undo behavior. SongCore validates profiles and deep-clones them for history.
- Applied audio changes use the existing `undoable` POLISH path. Acceptance into a vocal lane still uses the existing SongPolish/SongCore path.
- `S.referenceWorking` participates in the existing session lock. The dialog blocks editor shortcuts and prevents stale asynchronous results from being applied.
- Added files: `reference-core.js`, `reference-worker.js`, `reference-preview.js`, `reference-guide.js`, `reference-guide.css`. Keep the entire package together when hosting.
- All seven files in `ENGINE-SHA256.txt` remain byte-identical. No second pitch-correction stage was added. No website was deployed.

## Limits and validation

A reference captures a performance, microphone/timbre, production decisions and possibly generated artifacts. Matching its broad measurements cannot recreate its singer, performance or Suno generation process. Suggestions are listening trials, not a quality score or a promise of a perfect sound.

The supplied Suno vocal was used to exercise decoding, passage analysis, saving, comparison and preview. A deliberately altered copy provided a controlled tonal mismatch; the preview moved that measured tonal balance in the intended direction. This is technical validation, not a subjective listening endorsement. Real-device listening remains necessary, especially with long reverbs, layered vocals and mobile hardware.

See `TEST-RESULTS-0.27.0.txt` for executed checks and exclusions. Existing engine, song-capacity and browser/device limitations in `AGENT-HANDOVER.md` still apply.
