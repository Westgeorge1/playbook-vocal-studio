# Playbook Vocal Studio 0.37.1 beta

Base: 0.37.0. One fix, found on the owner's ten new vocals of 4 November.

## Hum detection no longer mistakes low rumble for mains hum

**The problem in 0.37.0.** On "Little boy" and "Dont think you can feel", Measure reported 50 Hz hum. Clean vocal would then have switched on the 50 Hz filter with its four harmonic notches. The recordings have no mains hum. A broad bump of low-frequency sound raised the 50 Hz and 60 Hz bins alike, by about 14 dB on "Little boy".

**The fix** (`noise-core.js` `measure`). Hum is now reported only when it looks like mains hum. A hum frequency counts only when all three hold:
- At least two lines of its series (the frequency, 2×, 3×, 4×) stand more than 6 dB above the bins 9–23 Hz either side.
- The fundamental or the second line stands more than 10 dB above them.
- The other mains series (50 vs 60 Hz) does not show the same pattern.

**Result on all 20 owner recordings** (G01–G10 and the 4 November set): no hum reported, which matches listening to them. Synthetic 60 Hz hum with harmonics is still found.

**Tests** (`tests-0.37.0/clean-vocal`):
- The hum check now uses hum with harmonics, as real mains hum has.
- A new check confirms a broad low rumble is not reported as hum.

## Versions

- **App version:** APP_VERSION and the offline cache are 0.37.1.
- **Changed files:** `?v=0.37.1` is on `noise-core.js`, `noise-worker.js`, `noise-cleaner.js` and `studio-main.js`.
- **Version tests:** `tests-0.37.1/recording` and `tests-0.37.1/phone` expect 0.37.1.
- **Engine files** are unchanged, and ENGINE-SHA256.txt verifies.

Everything else is as in [CHANGES-0.37.0.md](CHANGES-0.37.0.md).
