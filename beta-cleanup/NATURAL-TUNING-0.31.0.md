# Playbook Vocal Studio 0.31.0

This merges Studio Spectral into the reviewed 0.29.0 upload, preserving its immediate preview-gain repair, shared validated WAV writers and stricter test failures. The original native engine remains byte-identical.

## What we learned from the original tuner

Its Natural starting style uses 85% correction, 70 ms note speed, 35% drift control and 65% expression retention, with controls for preserving tone, consonants, expressive slides, in-tune notes and the singer's tuning reference. These controls help explain why its behavior may suit the vocal; they do not prove which feature caused a particular listening preference. Its compiled DSP source is not supplied here, so this is a review of its exposed behavior and controls, not a line-by-line reconstruction of the native algorithm.

The earlier Note Editor's Smooth mode corrected each pitch frame toward a nearby scale note. The new **Natural** mode instead shifts a stable note centre and retains movement around it. The pitch-synchronous renderer is still the Note Editor renderer; the result is not claimed to sound identical to the original engine.

## Natural automatic tuning

- Starting amount: **85%** of a stable note-centre correction. This is different from Classic Smooth's 25% frame correction.
- Note transition: **70 ms**, adjustable 20–200 ms. The correction fades at note edges.
- In-tune protection: notes within 10 cents are left alone, with a soft transition to full correction at 25 cents.
- Vibrato: the sustained pitch movement is retained instead of being flattened by automatic frame snapping. Manual vibrato and drift controls remain available.
- Expression: larger glides receive less automatic correction; clearly sung notes outside the chosen key can remain on their own semitone.
- Uncertain detections, short fragments and automatic target moves greater than 60 cents are left for manual review.
- Sibilant and low-confidence pitch frames receive no automatic pitch correction. This does not claim perfect consonant detection or exact preservation of every noisy waveform sample after resynthesis.
- Manual pitch, drift, vibrato and transition edits take priority. Natural does not add another correction to those notes.
- New embedded vocals start from the original engine's detected singing reference when its Follow singing option is enabled. Saved references are retained. Change the reference for the backing track when necessary.

Finished-vocal imports start with the original bypassed processing path. If opened in the new editor, automatic tuning starts off; saved explicit choices are preserved. Clean & Natural keeps your Note Editor and Studio Spectral choices rather than silently replacing them.

Natural can intentionally leave some notes uncorrected. Check the displayed counts, use Review, or select a note and choose its target. Correct selected notes still affects the selection; Snap all remains a separate whole-vocal action.

## Existing projects and rollback

Saved editor settings without an automatic-mode field retain **Classic Smooth**, at their original amount. Switching modes is undoable. The new mode, amount, transitions and protections are saved in browser state and project ZIPs.

CLEAN > Original cleaner — restore keeps the new editor but restores the previous cleaner. TUNE > Original tuner — restore restores the complete previous tuner/cleaner path. Returning to the new path retains its settings and note edits.

The release includes a separate copy of the reviewed 0.29.0 runtime for whole-application rollback. Keep a project backup before upgrading. Before opening a project in 0.29.0, switch Studio Spectral lanes to Original cleaner and Natural lanes to Classic Smooth (or Original tuner), then save a separate project backup. Version 0.29.0 cannot apply the newer processors; retain the 0.31 backup too.

## Listening comparison

The supplied comparison files identify which tuner and settings produced them. Use the matched-level versions to judge pitch movement, vowel tone, consonants and note endings. Choose by listening before adopting a permanent preset. Automated frequency, peak and recovery tests do not establish professional sound quality on every recording.

This package contains the application and its source. Physical-phone behavior, real microphone latency and operating-system background termination require device testing. Do not infer those from desktop Chromium or narrow-viewport tests.
