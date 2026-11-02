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
