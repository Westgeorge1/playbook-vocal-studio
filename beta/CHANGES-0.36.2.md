# 0.36.2 beta

On 0.36.1, touch tests reproduced two separate failures. With Smart Guide’s saved Explain setting enabled, Help and Record showed a tip instead of running. With Explain off, returning from a simulated permission sheet that briefly hid the studio cancelled microphone setup before the user could record.

- A touch now operates its control on the first tap, including Record, Stop, Play, checkboxes and dialog buttons. Optional touch tips disappear automatically and let taps through.
- Record requests access during the original gesture and shows permission instructions next to the transport. A brief permission-sheet transition can finish when the studio is visible again. If access is granted while hidden, the input stays muted while waiting for the foreground, for up to five seconds. Leaving the page or cancelling stops the request. A late grant cannot start another recording.
- Check mic uses the same startup logic. Existing recordings still stop when the page goes into the background. The vocal DSP and project format are unchanged.

To test on a phone, open the beta in the browser, tap Record, allow microphone access if prompted, sing a line, tap Stop & keep, then Hear this take. Local projects remain in the browser where they were recorded.
