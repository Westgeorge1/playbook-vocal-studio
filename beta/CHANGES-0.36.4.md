# Playbook Vocal Studio 0.36.4 beta

## Opening a long vocal in POLISH

Song & vocals shows the processing stage beside the button that opened POLISH. The stage also appears in the song status and in the POLISH workspace when switching between vocals.

Both audio workers allow at least two minutes of inactivity for the active request. Longer vocals allow one second per second of input, up to six minutes between progress messages. A new processing stage restarts the idle timer. An individual request still has a ten-minute upper bound. Requests waiting behind it receive their own idle interval when they become active.

When Studio Spectral is selected, the native analysis still initializes the vocal and its guide. The host applies the initial cleaning policy before rendering the bypassed native cleaner. It asks for the PCM stages the next processor actually uses and skips an extra render of the vocal. Classic sessions continue to use the native cleaner and tuner.

The song key and scale are applied before the first result is saved. A newly ready vocal no longer queues a second key change that disables Return and Export. Long playback-level measurements run in a web worker using the same loudness algorithm as before. With a backing track loaded, the note editor waits for its tuning reference before rendering, including guided tuning previews. A delayed reference can no longer leave a ready vocal marked pending.

If an effects worker fails during opening, the studio releases the unfinished editor. The original lane can be recorded or retried. A failed switch restores the previous editor when possible and protects the saved project if restoration itself fails.

The compiled engine, tuning algorithms, project format and capture worklet keep their previous bytes or format. The JavaScript worker bridge changed to return selected PCM stages. The new engine manifest records that change.

## Reproducing the five-minute case

Run the standard suites as described in TESTING.md. Run `tests-0.36.4/long-polish.cjs` separately on a machine with adequate free memory. It opens a 300-second, four-lane, 40-take song through the POLISH button, verifies that the recordings remain in place and downloads a full-length mix. The test also measures the largest UI timer gap. It uses synthetic mono recordings at 44.1 kHz. Long jobs still take several minutes. Stereo POLISH retains its 8,000,000-frame input limit, about 3:01 at 44.1 kHz.
