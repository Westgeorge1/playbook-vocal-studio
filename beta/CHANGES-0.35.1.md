# Playbook Vocal Studio 0.35.1 beta

## Record and Stop

Cancel setup or Stop immediately releases the timeline while a microphone request is outstanding. If the browser grants an old request later, the studio closes that stream and leaves the current take alone. Stop also stops the song when a punch-in is waiting for permission. During an established punch-in, pressing Record or R keeps the take and lets the song continue. Pressing Stop keeps the take and stops playback.

If a device interrupts the audio clock, the studio pauses playback at its last position. When it interrupts a recording, the studio keeps the audio frames already received and releases the microphone. An interrupted take is available to audition before choosing it.

## Timeline Play

The top Play and all waveform Play buttons follow the same transport. While the audio device is waking, every Play button shows Cancel play and Stop is available. Pressing a second button cancels the pending start. Once playback begins, Pause holds the playhead. At the end, Play starts again from the beginning. Play becomes available for a selected vocal, enabled backing, or the metronome.

Background take analysis updates its results without recreating identical waveforms or their Play buttons. A tap, held press, or keyboard focus can stay on that lane during the refresh.

## Review

The new transport tests measure the speaker output after recording a synthetic microphone signal. They also check the control state, saved samples, disconnected microphone tracks, stale permission responses, interruption recovery, and project reopening. See TESTING.md and TEST-RESULTS-0.35.1.txt for scope and results.
