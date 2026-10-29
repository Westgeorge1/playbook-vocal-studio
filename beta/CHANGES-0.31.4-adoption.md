# 0.31.4 adoption notes (on top of the supplied 0.31.4)

Defaults kept: Snap all + Smooth 25 % with Studio Spectral. High-note fix stays off (optional).

## Bug fixed: saved "Clean = on" was lost on restore (new rule R13)
Studio Spectral switches the old engine cleaner off while it works and remembers the singer's own Clean setting.
When a session was restored, the app sent the saved settings first and then opened the vocal; the open read back
the switched-off value (0), so a saved Clean = on came back as off and was saved again as off.
Fix (noise-cleaner.js): before opening, undo the switch-off so the engine reports the real setting.
Guarded by check25 R13 (fails on the old code) and tests-0.31.4/clean_restore314.py (7/0 with the fix, 5/2 without).

## Tests brought up to date
- tests-0.31/browser-natural.py: new vocals start on Classic 25 % (0.31.1 default); Natural still starts at 85 %.
- tests-0.29/integration.py: Original-tuner check compares with the engine's own render and a round trip;
  cleaned-audio check turns on a real Studio Spectral step (the clean fixture was passed through untouched) and waits for it.
- tests-0.29/audit.py: pitch tracking C2–E4 with the High-note fix off (default), C2–A5 with it on.
- Chrome path taken from PVS_CHROME in the 0.30/0.31 tests; check25 R6/R7 now cover noise-*.js and natural-tuning.js.
- run_all25.sh runs clean_restore314.py.

## Test results (29 Oct 2026, this box)
- Adoption pipeline (/tmp/f314.sh): 34 suites, all exit 0 after two isolated reruns: t314 fixes_review 19/0
  (first run was given the wrong previous version) and t29 audit 22/22 (after the High-note check update).
- run_all25.sh: 55 suites (incl. runner self-test and r314-clean-restore), all exit 0 except ports22-long under load
  (recorded 49 s of a 62 s take); isolated rerun 20 passed, 0 failed.
- run251 --capacity: 22/0. POLISH, three 4-minute vocals, isolated run: 130.5 s, 165.0 s, 178.9 s
  (a run shared with other suites showed 133/510/185 s, and h25-capacity 307/173/353 s, both from load).
- Engine 7/7 byte-identical (ENGINE-SHA256.txt).
- Summaries: tests-0.31.4/results/.
