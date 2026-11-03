# 0.36.9 follow-up candidate

Status: **beta – qualification ongoing**. This candidate is not deployed. The owner-authorized live beta remains frozen 0.36.8 at merge commit `6837197af69082c7e532496780520fb83d58c408`.

## Recording watchdog

The previous watchdog used elapsed page time to end a capture. In a recorded diagnostic, about 5.5 seconds of page time elapsed while the audio clock advanced about 1.97 seconds; the watchdog kept a shorter attempt before the selected range finished.

The worklet still gates the exact sample range. A new watchdog uses the audio clock to finalize at the planned endpoint if the completion acknowledgement is delayed or missing. A separate five-second guard detects a clock or capture stream that stops advancing, then uses the existing received-frame recovery path. A second polling tick permits queued worklet messages to arrive after a busy page resumes. Normal Stop, cancellation, background interruption and original-take protection remain in place.

Deterministic clock tests include audio running at one-quarter of page speed, slow pre-roll, stopped clocks, stopped capture, queued messages and cancellation. A browser regression runs the real worklet while withholding completion or capture messages, then checks complete/partial takes, original preservation and reload. The completion regression fails on the frozen 0.36.8 control. These are automated synthetic-input checks, not physical microphone acceptance.

## Qualification and failure evidence

The 33-suite release gate runs serially with `PVS_TEST_JOBS=1`. Concurrent runs require explicit `PVS_TEST_MODE=stress`, and their results are labelled separately.

The coach phone test records pointer timing, cleanup state, range and geometry, including when a wait fails. It waits for cleanup closure and stable timeline geometry before selecting a touch path, then for the required range state beyond the hold threshold. Its final predicate is unchanged. Three paired coach/workflow stress rounds on unmodified 0.36.8 passed with added observation; they do not establish the cause of the earlier phone-drag failure.

Crash checks now retain draft heads, PCM keys, locks, availability and UI state before crashing, after reopening and on failure. Shared failure capture also records the exact touch predicate values and the recent-take label, visibility and coverage. The earlier 0.36.6 empty-draft observation and 0.36.5 navigation timeout remain open; the existing navigation/network evidence capture is retained. No repair of those historical observations is claimed.

Audio algorithms, seven locked engine files, defaults and approved presets are unchanged. Three full serial passes on one frozen candidate, long-song acceptance, actual Samsung checks and the listening pilot remain distinct evidence requirements. Consult the companion validation report for actual completed runs.
