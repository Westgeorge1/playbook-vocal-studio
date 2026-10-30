# 0.31.9 — recording blockers and visible feedback

A settings change in note-tuner mode with no editor vocal loaded could set a pending processing flag, then return without processing anything. That left Record waiting indefinitely. Such changes no longer create an audio job or a pending lock. Existing pending edits and genuine processing locks are preserved.

Record now shows a dialog when another task blocks it or the microphone fails to open. The sticky recording toolbar can no longer hide the only explanation. Record remains accessible for this help action while recording is unavailable. Troubleshooting details show the app version and task states without audio; microphone permission failures include recovery instructions. Inline error messages also scroll into view.

The reported phone screenshot showed disabled controls and an obscured error. The empty-vocal lock was reproduced separately; the exact lock on that physical phone has not yet been confirmed. If recording remains blocked, the new dialog provides the reason and details needed to identify it.

Only beta is updated. Audio DSP, recording worklets, project formats and the root application are unchanged. See TEST-RESULTS-0.31.9.txt and tests-0.31.9/recording.cjs.
