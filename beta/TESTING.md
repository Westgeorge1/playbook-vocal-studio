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

If Chromium is not installed by Playwright, set `PVS_CHROME` to its executable. If Playwright is installed elsewhere, set `PLAYWRIGHT_MODULE` to its module path. Set `PVS_PORT_BASE=9200` to start a separate run using ports 9200 through 9216. Choose disjoint ranges for concurrent runs. Individual suites keep their customary ports by default.

Results include a log per suite and summary.json. Historical pitch hashes are reported as information. The pass/fail check for the approved presets is the independent same-browser reference comparison. The navigation suite also exercises import, opening a backup and recording with a simulated mic from an empty editing view. The 0.33.0 suites cover moving recordings on the timeline (tests-0.33.0/timeline-move: drag, snap, Esc, overlaps, Shift whole track, keyboard nudges, Move…, sample-exact render, autosave, cleanup takes, POLISH edits moving with the audio), cleaning (tests-0.33.0/cleaning: beat bleed, Pauses only, voice-safety meter, room profiles, RNNoise isolation, Find all breaths, byte-identical output when everything is off) and tuning (tests-0.33.0/tuning-plus: live pitch guide with a simulated mic, correction map, locked hand-tuned notes, chord detection and fitting, My Voice). The layout suite (tests-0.32.5/layout) drags every panel handle, work-window edge and movable dialog, checks keyboard resizing, reset, persistence, phone widths, and that resizing never writes to the project, autosave or Undo. Physical Android, Bluetooth, headphone latency and listening judgments on a real performance still require device checks.
