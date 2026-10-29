# Studio Spectral noise removal — 0.30.0

Studio Spectral is a new, offline noise-profile processor for the Playbook Note Editor path. It reduces steady hiss, fan noise and room background before pitch correction, with controls for vocal protection, noise learning, hum and rumble. The original Voice Focus and Gentle Spectral cleaners remain available unchanged.

## Quick use

1. Back up your project before upgrading. Extract the entire application folder, run `python serve.py`, and open the printed address. Online microphone recording requires HTTPS.
2. Open your vocal in **POLISH → CLEAN**. New vocals use **Studio Spectral** with the Playbook Note Editor. Existing projects retain their prior cleaner until you select Studio Spectral.
3. Start with **Gentle · 6 dB**. The app looks for a quiet, reasonably stable pause. If it cannot find a credible noise sample, spectral reduction remains bypassed and the panel explains why. A sustained tone in the quietest region prevents automatic capture.
4. Check the displayed sample. Use **Listen to sample**; it should contain only background noise. Quiet samples receive up to 24 dB of disclosed audition gain, limited by peak headroom; saved/exported audio is unchanged. To replace it, enter a start/end time covering 0.2–10 seconds, listen, then choose **Learn selected noise**. **Start at playhead** helps locate the range. **Find quiet sample** tries automatic capture again.
5. Compare **BEFORE**, **CLEANED** and **REMOVED NOISE** at the existing matched playback level. Words, sustained vocal tones or excessive consonants in Removed Noise are a reason to reduce the amount or threshold, or learn a better sample.
6. Try **Balanced · 10 dB** only when needed. **Strong · 15 dB** is a more aggressive starting point, not an approved vocal preset. The maximum control is 18 dB; the measured reduction can be less because the filter protects stronger signal components and smooths changes.
7. Use **Finish & check** for the finished export. Noise removal does not set loudness or master the vocal by itself.

## Advanced controls

- **Noise threshold:** changes the assumed noise power relative to the learned print. Positive values remove more; negative values retain more low-level detail. Range −6 to +6 dB.
- **Frequency smoothing:** averages the attenuation across neighbouring bins to reduce isolated spectral fluctuations. Excessive smoothing may reduce detail; compare at the same level.
- **Keep attacks & endings:** changes onset protection and the speed at which reduction returns after signal energy falls. This is not a guarantee that every breath or consonant will be identified correctly.
- **Rumble high-pass:** a second-order high-pass, off by default, adjustable up to 120 Hz. It can remove body from a low voice.
- **Electrical hum:** explicit 50 or 60 Hz notch filtering, including four harmonics, off by default. Check low sung notes; a hum filter also attenuates wanted sound at those frequencies.
- **Undo cleaning / Redo cleaning:** up to 30 local cleaning-setting changes, including learned profiles. This history resets when changing vocal lanes or reopening a project; the current settings and profile are saved with the lane. The original application's settings reset and Undo remain separate.

The measurement beneath the controls compares the chosen noise sample before and after this stage. It is not a whole-song signal-to-noise ratio, an intelligibility score or a guarantee of vocal quality. A contaminated sample makes the measurement misleading.

## Routing and rollback

The active order is:

**Existing comp/timing, breath and early repair processing → Studio Spectral → Playbook Note Editor → existing vocal effects → finishing/export.**

The native cleaner is bypassed while Studio Spectral is active, so the vocal is not denoised twice. Its settings remain stored for restoration. The effects worker also bypasses cleaning and pitch correction after receiving the newly tuned vocal.

- To compare or restore the prior cleaner while retaining the new note editor, select **CLEAN → PROCESSOR → Original cleaner — restore**.
- To return to the original tuner, select **TUNE → VOCAL TUNER → Original tuner — restore**. This also uses the original cleaner. Studio Spectral is available with the Playbook Note Editor; its settings and profile remain stored when that path is inactive.
- Each vocal lane keeps its own noise settings/profile, note-editor state and original tuner state in browser saves and project ZIPs.
- Source recordings stay intact. Changes to the source, comp or timing invalidate the old noise print and trigger a fresh attempt to profile the new input.
- Processing failure leaves the last accepted lane audio intact and blocks stale finishing/export. Restore the original cleaner or tuner to continue.
- For a complete version rollback, use the untouched `rollback/Playbook-Vocal-Studio-0.29.0-with-Rollback.zip`. It also contains 0.28.0. Before opening an older app, back up the current project, select Original cleaner on each Studio Spectral lane, then save another backup. Older versions cannot apply this new noise stage; keep the 0.30 backup to retain it.

## Technical design

`noise-core.js` implements an original FFT-based noise-profile reducer. It uses a sample-rate-scaled Hann window, 75% overlap, normalized overlap-add, a decision-directed spectral gain, a reduction floor, frequency smoothing, fast opening and slower closing. Broadband onset protection avoids treating every isolated noisy frequency-bin increase as a consonant. Stereo uses linked gains derived from channel power, without averaging the waveforms or cancelling antiphase content. Spectral reduction retains each bin’s phase and the sample count; the optional high-pass and notch filters have their normal phase response. Processing is deterministic and runs in `noise-worker.js` off the UI thread.

`noise-cleaner.js` provides the UI, validated per-lane state, original-cleaner bypass/restoration, worker lifecycle, cached output, sample audition and error recovery. It is wrapped beneath `NoteTuner.dispatch`, and its state is stored inside `noteTuner.cleaner`. Native Undo/preset commands run with the original cleaner parameter restored before its render is bypassed. This preserves native settings and manual note edits. The new files and all existing application assets must be hosted together.

No external service or model is used. The seven locked native-engine assets remain byte-identical. The new code does not clip floating-point headroom or normalize saved audio. A high sample peak can still require attenuation/limiting during final export.

## Limits and evidence

This is stationary-noise reduction, not source separation. It cannot reliably remove another voice, background music, a door slam or strong reverberation mixed into singing. The existing click/plosive and room-tail controls remain separate. Changing noise may require a new print or a different recording; this version does not continuously adapt the print under singing.

The existing per-vocal engine and storage limits remain: 256 MB input-plus-output budget, 8,000,000-frame stereo limit (166.7 seconds at 48 kHz), and a minimum 22,050 Hz processing rate. A separate spectral worker adds memory and CPU use. Layout tests do not certify physical phone performance, microphone latency or low-memory/background termination.

See `TEST-RESULTS-0.30.0.txt` and `tests-0.30/` for measured results and incomplete legacy checks. Automated tests and peak measurements cannot establish that a vocal sounds natural or release-ready. Listening to your recordings and approving a preset remain necessary. This package has not been deployed to a live site.

Professional noise-profile workflows and the importance of auditioning removed sound are described in the official [Audacity Noise Reduction manual](https://manual.audacityteam.org/man/noise_reduction.html) and [Audacity repair guide](https://support.audacityteam.org/au3/repairing-audio/noise-reduction-removal). These informed the workflow; no Audacity code or equivalence claim is included.
