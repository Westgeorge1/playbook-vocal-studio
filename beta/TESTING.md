# Running the studio regression suites

Use Node.js, Playwright with Chromium, and Python 3. Unpack the candidate into any directory. The runner copies it into a temporary server root under the expected folder name and runs the suites one at a time. The source folder remains clean.

## Reference sources

- For `PVS_OLD_MAIN`, use the **root** of [the GitHub repository at commit 3fd7da830a7de894c2b5430b2368f8a78790ab26](https://github.com/Westgeorge1/playbook-vocal-studio/tree/3fd7da830a7de894c2b5430b2368f8a78790ab26). That root is the original 0.14.0 main application. The beta subfolders are different releases. [Download the pinned archive](https://github.com/Westgeorge1/playbook-vocal-studio/archive/3fd7da830a7de894c2b5430b2368f8a78790ab26.zip).
- For `PVS_OLD_BETA`, use the directory containing index.html from the owner's **Playbook-Vocal-Studio-Beta-0.32.2.zip**. It supplies the compact-cleanup autosave used in upgrade tests.
- For `PVS_REFERENCE_DIR`, use the unpacked [0.32.3 main release](https://github.com/Westgeorge1/playbook-vocal-studio/tree/7cddbe77b6effceeccc040b1c0da69e5ae884924), or the owner's unpacked 0.32.2 reference. The same-browser comparison runs both builds with the same generated input and verifies rate, channel lengths and SHA-256 of tuned and final PCM.

```sh
PVS_OLD_MAIN=/absolute/path/to/0.14.0 \
PVS_OLD_BETA=/absolute/path/to/0.32.2 \
PVS_REFERENCE_DIR=/absolute/path/to/0.32.3 \
PVS_TEST_OUT=/absolute/path/to/results \
node run-tests.cjs
```

If Chromium is not installed by Playwright, set `PVS_CHROME` to its executable. If Playwright is installed elsewhere, set `PLAYWRIGHT_MODULE` to its module path. Set `PVS_PORT_BASE=9200` to start a separate run using ports 9200 through 9220. Choose disjoint ranges for concurrent runs. Individual suites keep their customary ports by default.

The 0.34.2 suite (tests-0.34.2/coach) checks Clean up here and the Smart Guide coach; tests-0.34.1/laptop checks short laptop screens. The 0.34.0 suite (tests-0.34.0/ux) checks the Classic tools switch, the tuning-window tabs, CLEAN and CHAIN folding, the pinned listen strips, the laptop panel height, the phone layout and the new labels. Suites that click the original approved presets turn Classic tools on first, as a user would.

Results include a log per suite and summary.json. Historical pitch hashes are reported as information. The pass/fail check for the approved presets is the independent same-browser reference comparison. The navigation suite also exercises import, opening a backup and recording with a simulated mic from an empty editing view. The 0.33.0 suites cover moving recordings on the timeline (tests-0.33.0/timeline-move: drag, snap, Esc, overlaps, Shift whole track, keyboard nudges, Move…, sample-exact render, autosave, cleanup takes, POLISH edits moving with the audio), cleaning (tests-0.33.0/cleaning: beat bleed, Pauses only, voice-safety meter, room profiles, RNNoise isolation, Find all breaths, byte-identical output when everything is off) and tuning (tests-0.33.0/tuning-plus: live pitch guide with a simulated mic, correction map, locked hand-tuned notes, chord detection and fitting, My Voice). The layout suite (tests-0.32.5/layout) drags every panel handle, work-window edge and movable dialog, checks keyboard resizing, reset, persistence, phone widths, and that resizing never writes to the project, autosave or Undo. Physical Android, Bluetooth, headphone latency and listening judgments on a real performance still require device checks.

The 0.35.0 phrase-guide suite exercises the visible timeline Play/Pause controls, per-take guided decisions, matched and blind auditions, original-preserving edits, song Undo and reopen, isolated tone and tuning previews, persisted changes, and phone touch input. tests-0.35.0/recording checks the new version.

The 0.35.1 transport suite checks real Web Audio capture and the rendered speaker signal on 1280×600 and 390×844 layouts. It forces late microphone responses, slow audio startup, cancelled punch-ins, and interrupted recording. To exercise a served beta in a fresh test browser, set PVS_TRANSPORT_URL to its HTTPS URL when running tests-0.35.1/transport.cjs. The microphone is synthetic in both cases.

The 0.36.0 workflow and guide-undo suites exercise take replay, alternative performances, microphone checks, concern routing, native Undo, actual WAV samples, and reopening an exported project in a fresh browser context. Physical microphone and listening tests remain separate.

The 0.36.1 manual-cleanup suite exercises the two entry points, blocked and oversized selections, focus and gesture state, actual backing offsets, looping, context, stereo PCM, saving, Undo, and late worker responses after Stop or Escape. PVS_CLEANUP_URL can point it at the served beta.

The 0.36.2 phone suite checks real taps with Explain saved on, a test microphone routed through the studio capture worklet, delayed permission, denied permission, page visibility, cancellation, saved audio and playback. Run tests-0.36.2/phone.cjs. PVS_PHONE_URL selects a served build. Phone views and permission timing are emulated in Chromium.

0.36.3 adds checks to the existing 26 suites: Natural/Classic phrase previews, stale decisions, shared singing measurements, saved room filter handling, stereo protection, AI alignment, cleaning history, and crash recovery followed by offline reopening.

The release gate is serial: set PVS_TEST_MODE=qualification and PVS_TEST_JOBS=1. The runner rejects concurrent qualification runs. Use PVS_TEST_MODE=stress and PVS_TEST_JOBS=2 only for separately labelled load tests with disjoint ports. run-metadata.json records mode and concurrency; summary.json records each suite, exit status and duration. A failed suite never silently skips the remaining suites. Stress results never replace qualification results.

For the 0.36.4 long-lane acceptance case, use the same Chromium and Playwright environment as the standard suites. Set PVS_TEST_OUT to an empty existing results directory and run `node tests-0.36.4/long-polish.cjs` after the standard suites finish. It needs several minutes and enough memory for the complete song and its full-length vocal effects. The output includes PCM and downloaded WAV fingerprints, timings, and two screenshots. Set PVS_KEEP_EXPORT=1 to also keep the synthetic mix WAV in the results directory.

## 0.36.9 follow-up candidate qualification

The current runner has 33 suites, including the audio-clock watchdog and real-worklet failure-injection checks. Recording and phone wrappers require version 0.36.9. Run the complete suite three consecutive times against the same frozen ZIP, with PVS_TEST_JOBS=1; retain every invocation, summary and failure. Do not count reruns as replacing earlier failures.

The watchdog clock test advances audio time at one-quarter of page time and also checks stopped-clock, missing-capture and delayed-message cases. This is a deterministic injected-clock regression. The browser test uses the real worklet with deliberately withheld completion/capture messages to verify complete-take finalization, preservation of partial received audio, original-take protection and reload.

The 0.36.8 beta deployment is an owner-authorized beta, not completion of this final-release gate. Its parallel run-4 failures remain stress/timing evidence. The earlier 0.36.6 empty-draft observation and 0.36.5 navigation timeout remain unexplained. Crash checks now preserve draft heads, PCM keys, locks, availability, storage state and UI state around the crash/reopen sequence and on failure; no PCM is written into diagnostic JSON. The existing bounded navigation/network capture remains in place.

For targeted driver-latency checks, PVS_REPLAY_OBSERVER_DELAY_MS=2200 delays replay observation and PVS_R_DRIVER_DELAY_MS=10000 delays the positive R-key driver. Browser-side observers still require actual output/capture, and the existing 30-second waits are unchanged. The separate permission regression uses a nine-second song and requires cancellation after natural end.

Verify historical reference files against their pinned GitHub blobs. A similarly numbered owner archive may be a different variant; its version string alone is not enough.

These automated checks and hashes do not certify musical quality. Human/professional listening and actual phone hardware acceptance remain outstanding until separately evidenced.


The navigation assertion and its 60-second deadline are unchanged. Shared browser tests persist the original failure before optional bounded state capture (five seconds total, at most four open pages). Navigation also samples up to 180 metadata snapshots at 500 ms intervals and retains up to 80 network/worker events. These observations never retain PCM and do not retry an import. This improves diagnosis; it is not a claimed repair of the prior unexplained timeout.

Before qualification, run `node tests-audit/failure-capture.cjs` with the same environment. Its child deliberately fails; the outer check succeeds only if the failed exit, original assertion and bounded state evidence are retained. This control is separate from the 31 product suites.

Keep three full qualification runs consecutive, against one frozen archive, and preserve every failure. Stop before starting another full run if a run fails. Run the five-minute long-POLISH acceptance separately after standard qualification. A new package or code change starts a new candidate record; prior failures remain evidence.
