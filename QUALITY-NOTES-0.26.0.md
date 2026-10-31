# Playbook Vocal Studio 0.26.0 — implementation and listening notes

This is the first finishing upgrade to 0.25.1. It adds a practical diagnosis workflow,
phrase volume after vocal processing, and explicit whole-song finishing. It does
not establish that a real singer sounds better, nor add a second automatic tuner.

## Listening workflow

1. Back up the project, choose the strongest takes, and POLISH the selected vocal.
2. Use **Find what needs improving**. Choose a sung passage containing a sustained
   vowel, an S sound, a quiet word and a note transition. Compare each available
   processing stage at matched loudness. Locate the earliest stage that introduces
   a problem. Adjust only that stage and compare again.
3. In Song & Vocals, select a quiet/loud phrase. Open **Phrase volume**, use the
   selection, choose a small level change and click Add phrase level. Audition with
   the backing. Overlapping moves are refused; edit the existing move instead.
4. **Finish & check** renders the chosen vocals plus optional backing. Start with
   Keep current loudness and Preserve dynamics. If desired, choose a loudness
   target and compare the optional limiter. A missed target is reported honestly.
5. Listen to both previews, which are volume matched. Download only the preferred
   finished result. The WAV contains the actual output level, not preview gain.

To validate musical improvement, use the same real vocal excerpt in every version,
listen both solo and in the mix, and keep only changes that sound better. Suggested
material: breathy lines, low notes, strong vibrato, slides, consonants, quiet/loud
phrases and harmonies. Numerical pitch distance cannot identify the intended melody.

## Architecture

- `quality-core.js`: dependency-free measurement and offline mastering functions,
  usable from Node and a Worker. It accepts finite Float32 mono/stereo only.
- `quality-worker.js`: cancellable background processing. The immutable input on the
  main thread is copied, not detached. Processed arrays transfer back. Dialog generations
  prevent old asynchronous results from entering a reopened window.
- `quality-studio.js` and `.css`: native dialog, matched audition, measurements,
  downloadable output, diagnostic guidance and phrase-volume UI.
- `song-core.js`: validates/clones `track.levelMoves`; applies smooth gain after
  `renderVoice`, never inside `renderTrack` or the POLISH source signature. Default
  dry stem rendering bypasses moves. Song signatures include nonempty moves only,
  preserving the original signature for old songs without automation.
- `song-studio.js`: a single `renderExportMix` builder is shared by old exports and
  finishing. The original export path still respects Hear backing. The finish
  checkbox is explicit. Song keyboard shortcuts respect any open native dialog.
- Song edits and finish preferences use the existing edit / revision / autosave /
  synchronous journal paths. Existing archive packing carries the metadata.

All locked engine files in `ENGINE-SHA256.txt` are untouched. New functionality
works outside the existing compiled engine. Do not claim its formant processing or
note detection was improved by this update.

## Measurements and output

Loudness uses the BS.1770 mono/stereo K-weighting stages with coefficients derived
for the source sample rate, 400 ms blocks at 100 ms hops, an absolute -70 LUFS gate
and a relative -10 LU gate. No partial final block contributes. Silence, gated-out
material and clips under 400 ms return no integrated loudness. Phase-opposed stereo
channels are measured independently, not summed before measurement.

True peak is an **estimate**, using original samples and 4x Blackman-windowed sinc
reconstruction (48 taps per fractional phase), with zero-padded file boundaries.
This is not a certified meter. Independent FFmpeg comparisons and tolerances are in
`tests-0.26/reference_check.py` and its result file. Loudness target is optional and
is not a universal platform requirement or a quality score.

Gain-only finishing uses one shared gain for all channels, constrained by the peak
ceiling. Optional limiting uses stereo-linked gain, 80 ms exponential release and
3 ms backward attack anticipation. It changes neither length nor timing. It is an
offline limiter, not a new live-monitoring processor. The output is reconstructed
and checked again; any necessary safety attenuation is a shared constant gain. A
0.001 dB margin covers Float32 rounding. Normalization is capped at +/-12 dB. The
actual attained loudness is always reported, including when a target is not met.

Finished WAV uses the existing validated 24-bit writer. Ordinary mix/stem exports
remain 32-bit float. All rendered source and processed buffers remain editable.
The 0.25.1 compact project-backup policy still stores normal POLISH finals on a
16-bit grid; the existing compatibility backup retains float finals. This update
is not a change to that storage policy.

## Remaining work

- Real-vocal listening comparisons and physical Android/desktop microphone tests.
- Further tuner changes only after audible problems are reproduced with a known
  intended melody; engine source is not included in this archive.
- Shared vocal buses / reverb sends and microphone-room diagnosis are separate
  future work, not implemented features of this update.
- Low-memory phone performance and Safari/iOS remain unverified. Closing a quality
  check cancels its worker and preserves the source audio.

## Reproduce checks

```sh
node tests-0.26/quality.test.cjs
python tests-0.26/reference_check.py  # requires FFmpeg
PVS_CHROME=/path/to/chromium python tests-0.26/run_browser.py  # Python Playwright
node tests-0.25/check25.cjs
```

The older `tests-0.25/run_all25.sh` expects a separate 0.18.3 app at `OLD_URL`.
If that build is unavailable, `PVS_SKIP_LEGACY_APP=1` explicitly skips only the
external-open checks in t22/t24; their current-app and archive-content assertions
still run. The default remains strict. This flag does not certify old-app support.

See TEST-RESULTS-0.26.0.txt for the exact checks run and their limits.

## Algorithm references

- ITU-R BS.1770-5: https://www.itu.int/rec/R-REC-BS.1770-5-202311-I
- De Man, Evaluation of Implementations of the EBU R128 Loudness Measurement,
  via the author's meter implementation: https://github.com/BrechtDeMan/loudness.py
- Independent reference meter: FFmpeg ebur128 filter,
  https://ffmpeg.org/ffmpeg-filters.html#ebur128

Equations are implemented independently; no external audio library is bundled.
