# Review response — 0.24.0

Every fix has a regression test that fails on 0.23.1 and checks real samples or real stored state.

| Finding | Fix | Test (0.24 / 0.23.1) |
|---|---|---|
| F1 fade/trim ignored | Signature = hash of the rendered lane audio (memo by layout + source identity); `polishValid` side-effect free; `normalizeSigs` converts old signatures on open (sample compare with the saved POLISH input, else padded layout, else stale) | core24 F1 (fadeIn/fadeOut/trimIn on 8-field old signature, side-effect free, undo, hidden stale fade from a 0.23.1 save); ui24 F1 (real editor fade changes samples, lane stale, export blocked, undo valid, redo stale, reopen stale) — 0.23.1 fails 5 browser + core checks |
| F2 Listen audition | Audition region rendered last inside its range | core24 F2 (overlaps above and below, order unchanged) |
| F3 split | Same recording across a seam → no fades (sample-identical); different takes → true crossfade over the handle; outer fades kept | core24 F3 (every sample at the seam, POLISH stays valid, no crossfade dip, two takes, undo/redo, real change invalidates) |
| F4 one key | `keyStale`: polished lanes in another key show "Key update needed", notes/effects kept, processed export blocked; per-track "own key" override | ui24 F4 (two polished lanes, from Song and POLISH screens, override) — 0.23.1 fails 4 |
| F5 durable settings | `durable()` for key, scale, count-in, stop-at-end, click volume, backing pref, master and lane mixer; journal v2 {uid, rev}, only applied when newer, retired otherwise | durable24 (tab crash straight after each of 9 settings; older journal never overwrites) — 0.23.1 fails 5+ |
| F6 reference removal | Reference cleared on Delete unchosen / Redo last take / Remove attempt; confirm says so; undo restores both | ui24 F6 — 0.23.1 fails 2 |
| F7 unequal note counts | `ref-align.js`: DTW alignment over steady notes, wraps `PhraseCore.rank` (engine untouched); equal counts give exactly the engine result; non-comparable takes labelled in Why suggested | refalign24 9/9 (0.23.1 behaviour 3/9); t24 at 1366/390 checks the app's real ranking honestly (each take compared or labelled) |
| F8 legacy write-back | Chosen legacy take inside its phrase carries the current comp; precise warning on overlaps | core24 F8 (compose(toPhrases) == current render sample by sample: whole+phrase, overlapping, split) |
| Capacity | 256 MB cap (23 min 18 s mono 48k); Room shown; 16-bit grid recordings; per-recording IDB entries written once at half size, unused removed; 16-bit WAV in ZIP; long stereo main vocal opened mono for the engine | capacity24 (4-min lead + two 4-min lanes + 10 fixes = 15 min: fits, Room 23:18 → 8:18, autosave compact and incremental, reload bit-exact, ZIP save + reopen bit-exact, mix export 240 s, lead POLISH within budget) — 0.23.1 refuses the song |
| Phone/UX | Sticky dialog footer, secondary Split/Reference group, 44 px touch targets, transport emphasis, Chosen note, POLISH preview chip | ux24 @390 and @1366 with screenshots |
| Test hygiene | fontstub (sitecustomize routes Google Fonts locally); T1366/A1366 project ZIPs shipped | full run |

Known limits
- Project ZIPs for long songs stay large (a 15-minute song: about 290 MB) because they also carry the copies older apps need (float main vocal + legacy phrase files). Song recordings themselves are 16-bit.
- F2/F3 are verified at the sample level in core24 (the same render code drives Listen and export); the browser suites exercise them indirectly.
