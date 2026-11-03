# 0.36.5 beta — saved-source protection and recording controls

3 November 2026. This is a reliability repair, not a release-quality audio certification.

## Saved originals

If a remembered project refers to a missing original recording, restoration now enters the existing paused-recovery path. It no longer opens an empty project with autosave enabled. This prevents a later save from overwriting the unresolved manifest and deleting other surviving recordings. The guard cannot recreate bytes already lost; restore a downloaded project backup when available.

## Record during scrolling

A queued scroll event could hide Options while a mouse press was in progress. Record moved horizontally before release, and the click reached the toolbar instead of Record. Compact toolbar updates now wait through the native click, including delayed touch compatibility clicks. Cancellation and loss of focus release the hold; a bounded fallback handles releases with no click. Native click behavior remains in control: dragging away does not start recording, and keyboard controls remain available.

## Regression coverage

- Missing/corrupt source, quota and aborted-transaction checks are included in the full runner.
- A deferred-scroll regression exercises native presses, drag-away cancellation and keyboard Record at laptop and phone-sized widths.
- Short replay is observed inside the browser before Play, requires actual new audible output and retains the existing timeout. A delayed test driver cannot miss an entire short take.
- The positive R-key fixture grants permission in the browser and is longer than its startup timeout. A separate nine-second fixture verifies cancellation when permission arrives after playback ends, permission denial, microphone closure and unchanged original PCM hashes. The app's stale-punch-in safeguard is preserved.
- The runner executes 30 suites. Phone and recording wrappers require the 0.36.5 version. No failed attempt may be discarded or retroactively counted as passing.

Audio processing algorithms, engine binaries, default sound settings and approved presets are unchanged from 0.36.4. Human listening preference, professional-tool equivalence, physical-phone reliability, power-loss guarantees and a complete release-ready song remain separate acceptance work.

Run instructions and required historical references are in TESTING.md. The companion validation report records the delivered ZIP hash, fresh results and any remaining failures. Historical result files in this package apply only to their named versions.
