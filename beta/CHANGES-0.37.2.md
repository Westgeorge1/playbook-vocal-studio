# Playbook Vocal Studio 0.37.2 beta

Base: 0.37.1. Changes from the owner's two listening rounds on his ten vocals of 4 November.

## Listening results that shaped this release

**Round 1, blind, 10 songs.** Choices: old 0.36.8 cleaner, Clean vocal without AI, Clean vocal with AI.
- Clean vocal with AI won on 9 of 10 songs. The agreed bar was 7.
- Clean vocal with AI therefore stays the recommended setting.

**Round 2, blind.** Choices: round 1 winner, the same plus a new pop fix, and the pop fix without AI.
- The round 1 winner won 5 songs.
- Round 2 with AI won 5 songs: Come and let go, Dont want to give no one 2, Lean on me, Little boy, What a friend.
- Round 2 without AI won none. AI clean is clearly part of the sound the owner prefers.
- On Giving you no space, the owner marked the pop-fix version as changing his voice.

## New: Pops and rumble under the voice (step 2)

**What it does.** A sung note has nothing below its fundamental. Everything below three quarters of the sung pitch is cut by the chosen amount. This is at most 150 Hz while singing and 90 Hz between notes. It covers breath pops, mic handling thumps and room rumble. The pitch comes from the same tracker as held-note protection, and the cut acts at once, so short pops are caught.

**Range.** 0–24 dB. It needs the Adaptive engine.

**Default.** Clean vocal leaves it at **0** because round 2 was a tie. The control note tells the singer to raise it, 18 dB is strong, when thumps are heard at the starts of lines.

**Measurements on the ten songs at 18 dB:**
- Low pops below 90 Hz: 13–24 dB quieter than the original, against 1–11 dB with AI clean alone.
- The 60–120 Hz band during singing changed by −0.1 to −3.6 dB.
- 120 Hz and above changed by 0.00–0.01 dB.

**Objective score.** On the 12 known-noise mixes, the mean SI-SDR improvement rose from +6.8 to +7.3 dB with 18 dB.

**Code.**
- `noise-core.js` adaptive engine: setting `under`, saved with the track. Step 2's switch turns it off with the rest of the step.
- `clean-vocal.js`: the control, with Clean vocal setting 0.
- `smart-coach.js`: the explanation.

## Other findings

**Voice level near the end of songs.** The owner wondered whether the voice weakens near the end with AI. Measured second by second, the cleaned voice stays within 0.3 dB of the original from start to end on all ten songs. No change was made. The owner will report a song and time if it is still heard.

## Tests

`tests-0.37.0/clean-vocal` now has 32 checks. The new one confirms that an 18 dB setting lowers a 45 Hz thump by at least 10 dB in two places: before a line, and under a held note. Held notes must stay within 0.3 dB.

## Versions

- APP_VERSION and the offline cache are 0.37.2.
- `?v=0.37.2` is on `noise-core.js`, `noise-worker.js`, `noise-cleaner.js`, `clean-vocal.js`, `smart-coach.js` and `studio-main.js`.
- `tests-0.37.2/recording` and `/phone` expect 0.37.2.
- Engine files are unchanged.
