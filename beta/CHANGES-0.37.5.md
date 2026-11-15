# Playbook Vocal Studio 0.37.5 beta candidate

Base: 0.37.4. Two changes from the owner's 15 November order review. The seven locked engine files are unchanged.

## 1. Clean vocal says when clicks and de-reverb really run

The review ran the compiled engine on a synthetic vocal and confirmed its stage order: click repair, de-reverb, cleaning, breaths, tuning, EQ, dynamic EQ, de-esser, word leveling, peak control, compression, warmth, second EQ, echo, reverb, level, limiter.

Clean vocal lists de-reverb under step 7, after the noise remover. The engine applies click repair (step 3) and de-reverb to the raw recording before the app's own noise remover receives the audio. The real order is 3, de-reverb, 4, 2, 5a, 5b, 6, gap cleaning.

The processing order is **not** changed. Moving de-reverb after noise removal needs a third engine pass on the cleaned audio and a second owner of the Step 7 switch state that 0.37.3 and 0.37.4 repaired. That is a larger change with its own listening test. This release makes the panel truthful:

- Step 3 note: "Runs first, on the raw recording, before steps 2 and 4 to 7."
- Step 7 note: gap cleaning runs last; de-reverb runs early, together with step 3, before the noise remover.

The step numbers, switches, saved settings and Step 7 behaviour are as in 0.37.4.

## 2. Roots Reggae starting values

Roots Reggae now starts with **word leveling 25 %** and **compression 45 %**. It was 0 % and 55 %. Word leveling sits before both compressors, so it evens the words first and the compressor has less to do.

Measured on the review's synthetic vocal (phrases 10.1 dB apart), through the unchanged engine:

| Starting values | Compressor average | Compressor maximum | Loud-to-quiet gap in FINAL |
|---|---|---|---|
| 0 % leveling, 55 % compression (0.37.4) | 1.38 dB | 3.02 dB | 7.5 dB |
| 25 % leveling, 45 % compression (0.37.5) | 0.99 dB | 2.53 dB | 5.9 dB |

Vocal level stayed at -16.0 LUFS in both. This is a measurement on a synthetic signal. It does not establish that a real vocal sounds better; the owner should compare both on his own singing.

The compiled engine still holds 0 % and 55 %. `studio-main.js` applies the two values wherever the preset is applied from its starting settings:

- a new vocal (recorded or raw import) that is still on the untouched engine values
- the Roots Reggae preset button
- Reset preset while on Roots Reggae
- Reset all settings

Saved projects, autosaves and finished-vocal imports keep the values they have. A project saved with 0 % and 55 % opens with 0 % and 55 %. The Smart Guide's own engine suggestions are unchanged.

`tests-0.32.3/playback.cjs` compares tuned and final PCM of a new vocal with the 0.32.3 reference. A new vocal now starts with the new values, so the test first confirms 25 % and 45 %, then puts 0 % and 55 % back and requires the same bit-identical PCM as before. That shows the engine and routing are unchanged. See TEST-RESULTS-0.37.5.txt for what was run.

## Files

`clean-vocal.js`, `studio-main.js`, `index.html` (version and two cache tags), `offline-worker.js` (version, so installed offline copies update), `run-tests.cjs`, `tests-0.37.5/`, `tests-0.32.3/playback.cjs`.
