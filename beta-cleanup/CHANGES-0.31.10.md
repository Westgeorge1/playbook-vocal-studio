# 0.31.10 — saved-project processing no longer waits indefinitely

The phone diagnostics showed `Opening My song — Lead vocal…`, `engineBusy: true`, one pending engine request, and a loaded vocal. Recording was blocked by restoration before microphone access. The existing restore watchdog covered IndexedDB reads, but not the native processing requests used to reopen the saved editor.

Modern saved songs now reopen directly into SONG when the root editor is absent or its complete audio, alternate takes, parameters, notes, tuning state, edits and guide settings already exist in the saved track session. The comparison is exact; a unique root edit is never discarded. Saved per-track POLISH audio/settings remain in autosave and project backups, and POLISH rebuilds its active editor when explicitly opened. Stale track processing stays stale until the user chooses to update it. Restoration waits for the song modules to load.

Native worker requests now have a two-minute deadline. On failure the worker is terminated, all pending requests reject, timers are cleared and late replies are ignored. A failed startup restore discards its incomplete live editor, then uses the existing protected-storage recovery flow: autosave pauses so the original saved project cannot be replaced. A singer can make a new recording and back it up separately. Reload is required to retry the stopped processor. This fallback does not claim the old project was successfully reopened.

Record diagnostics now also include request types, update flags, elapsed seconds, processor errors and autosave protection state. No audio is included.

The native DSP, capture worklets, song model and project format are unchanged. Only beta is updated; the main site stays at 0.14.0. Tests reproduce a withheld worker response and the reported busy/loaded-vocal flags, but the specific cause of the processor's delay on the physical phone has not been measured. See TEST-RESULTS-0.31.10.txt.
