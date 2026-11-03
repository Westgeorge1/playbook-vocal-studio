# Storage recovery regression

`storage-faults.cjs` uses synthetic sources in fresh Chromium contexts. It injects quota failure, transaction abort, a missing saved source and a corrupt saved source. It checks that failed saves and restores preserve the complete surviving database, that failure is visible, and that successful retries reopen correctly. It never uses personal vocal files.

The full `run-tests.cjs` runner includes this suite. To run it alone from the repository root:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright PVS_CHROME=/path/to/chromium node beta/tests-audit/storage-faults.cjs
```

Python 3 serves the local app. `PVS_TEST_OUT` selects the result directory; `PVS_STORAGE_PORT` optionally selects a port. Normal full-run port isolation is supported through the existing helper.

Before the missing-source repair, this test produces 8/10 passing assertions: restoration fails to pause saves, then a later save overwrites the unresolved project. With the repair it passes 10/10. These targeted results do not establish all crash, power-loss or device-storage guarantees. Release packaging and full candidate qualification are still required.
