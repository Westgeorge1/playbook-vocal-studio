# Storage and transport regressions

`storage-faults.cjs` uses synthetic sources in fresh Chromium contexts. It injects quota failure, transaction abort, a missing saved source and a corrupt saved source. It checks that failed saves and restores preserve the complete surviving database, that failure is visible, and that successful retries reopen correctly. It never uses personal vocal files.

The full `run-tests.cjs` runner includes this suite. To run it alone from the extracted application folder (or after `cd beta` in the GitHub checkout):

```sh
PLAYWRIGHT_MODULE=/path/to/playwright PVS_CHROME=/path/to/chromium node tests-audit/storage-faults.cjs
```

Python 3 serves the local app. `PVS_TEST_OUT` selects the result directory; `PVS_STORAGE_PORT` optionally selects a port. Normal full-run port isolation is supported through the existing helper.

Before the missing-source repair, this test produces 8/10 passing assertions: restoration fails to pause saves, then a later save overwrites the unresolved project. With the repair it passes 10/10. These targeted results do not establish all crash, power-loss or device-storage guarantees. Release packaging and full candidate qualification are still required.

`transport-layout.cjs` delays a scroll callback until a native Record press is active, reproducing the recorded moving-button failure. It checks the completed click, drag-away cancellation and keyboard Enter on three viewport sizes. It does not synthesize a successful click to compensate for a missed one.

`transport-permission.cjs` checks the separate case where a nine-second song ends before microphone permission arrives, plus permission denial. It requires capture to remain stopped, late streams to close, and original source hashes/take counts to remain unchanged.

The full 0.36.5 runner includes all four audit suites (30 suites total). The combined release ZIP needs full qualification; isolated results are not a substitute. Physical phones and human listening remain separate.

`transport-touch.cjs` adds native Chromium touch release/cancel checks and separately labeled synthetic event-order, unrelated-pointer and window-blur controls. It requires a pointerup followed by an animation frame to keep the layout stable until click or the bounded no-click cleanup, then checks cleanup. Native touch emulation is not physical-phone qualification. Every case writes its trace even on failure.
