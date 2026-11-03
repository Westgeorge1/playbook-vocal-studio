# Playbook Vocal Studio 0.36.7 beta: keep songs on this device

Base: 0.36.6 (prepared candidate). This release asks the browser to keep the studio's saved data.

## Why

Browser storage is "best effort" by default. When a phone or laptop runs short of space, the browser may clear a site's saved data without asking. That includes saved songs and the interrupted-recording safety copies.

0.36.6 never asked the browser to keep this data. That is a plausible cause of the one unreproduced phone-test failure, where an interrupted recording disappeared on a machine that had just failed and restarted. It was not reproduced in 24 independent attempts, so the cause remains unconfirmed.

## What changed

**Asking the browser.** The studio calls `navigator.storage.persist()` once per page, during your first song action:
- Record, Fix phrase, Import, Open project, Back up project
- Load backing, or POLISH

Asking inside your tap means a browser that shows a question (for example Firefox) can show it.
- Chrome and Edge decide silently. Installed or often-used sites are usually allowed.
- Asking never delays the action.

**Project storage** shows **Keep songs on this device**, in one of four states:

| State | Meaning |
|---|---|
| On | The browser will not clear your songs to free space. |
| Not granted | Explains the risk, suggests installing or bookmarking the app, and offers **Ask again**. |
| Not yet asked | The studio asks at your first song action, or press **Keep my songs on this device**. |
| Not available in this browser | Recommends backups. |

**Smart Guide** shows a tip, "Your browser may clear your songs", when a song has recordings and the browser refused or cannot be asked. It offers **Ask again** (when possible) and **Back up project**.

**Offline:** storage-keep.js is in the offline cache.

Nothing is uploaded. Downloaded backups remain the only copy that survives clearing site data, uninstalling the browser or losing the phone.

## Code

- **New:** storage-keep.js, which provides `window.StorageKeep = {status, request, check, onChange}`.
- **smart-coach.js:** one new tip (`song-keep`).
- **offline-worker.js:** new asset in the cache list.
- **Versions:**
  - APP_VERSION and the offline cache are 0.36.7.
  - `?v=0.36.7` is on storage-keep.js, smart-coach.js and the files that were at 0.36.6.
- **Unchanged:** audio processing, engine files, defaults and approved presets. ENGINE-SHA256.txt verifies.

## Tests

| Suite | What it covers |
|---|---|
| tests-0.36.7/storage-keep.cjs (13 checks) | The browser's answer simulated as granted, denied and unsupported: asks once at the first song action; does not ask again once granted; Project storage text and Ask again; the Smart Guide tip in the two risky cases; no JavaScript errors. |
| tests-0.36.7/recording, tests-0.36.7/phone | Replace the 0.36.6 copies (version string). |

The runner now has 31 suites.
