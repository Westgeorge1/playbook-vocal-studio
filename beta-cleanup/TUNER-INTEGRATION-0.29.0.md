# Playbook Vocal Studio 0.29.0

The new Playbook Note Editor is integrated after cleaning and before the vocal effects. The original tuner remains available on every track, with its notes and settings preserved separately.

## Use it

1. Back up the current project. Extract the complete application folder, run `python serve.py`, and open its printed local address. Online hosting must use HTTPS for microphone recording.
2. Open a vocal in POLISH. Under TUNE, select **Playbook Note Editor**, then **Open note editor**. New vocals start here; older saved projects retain **Original tuner** until you change it.
3. Check the song key and scale. **Correct selected note(s)** and **Quantize selected note(s)** affect only the selection. **Select all** followed by correction and **Snap all** are explicit whole-vocal actions. **Smooth** provides automatic correction; the starting amount is 25% and Keep blue notes is off. These are starting choices, not a listening-approved preset.
4. Note pitch, cents, drift, vibrato, transitions, formants, timing, split/join and gain edits apply to this vocal lane. Use the editor's Undo/Redo for its changes, and the existing POLISH Undo for cleaning/effect changes.
5. Play inside the editor to audition the cleaned input against the tuning. Use the application's **CLEANED / TUNED / FINAL** controls or **Find what needs improving** to compare the processing stages. The song backing is available inside the editor and is never baked into the vocal.
6. Use **Finish & check** to prepare the finished song. Review flagged notes and listen before approving a reusable preset.

## Return to the original

In POLISH → TUNE → VOCAL TUNER, choose **Original tuner — restore**. This restores that track's original tuning path and controls. New-editor edits are retained, so switching back reopens them. The choice and both sets of edits travel with browser saves and project ZIPs.

For a complete application rollback, the delivery includes the untouched `rollback/Playbook-Vocal-Studio-0.28.0.zip`. Before opening an older application, make a project backup and switch each affected track to **Original tuner**, then back up again. The old application cannot interpret the new editor's note edits; keep the 0.29 backup if you want to return to them.

## Processing and preservation

The original worker supplies the cleaned float PCM, including existing comp, timing, breath, click/plosive repair and room-reduction edits. The embedded editor changes this PCM. A second instance of the unchanged engine then applies the existing vocal chain. Cleaning, original pitch correction, click repair and room reduction are explicitly bypassed in this second pass, with a sample-exact check of its dry input.

Original source recordings and the original tuner state remain intact. Stereo channels share pitch marks and timing without being averaged. Neutral editor processing is sample exact. With global Smooth off and no timing move, unedited regions away from a changed note and its short crossfades pass through sample-identically. Note render caching uses a deterministic full render, so a new edit and a fresh project reopen produce the same waveform.

The bridge validates finite PCM, source dimensions, saved scales, note positions and output capacity before accepting a result. Switching to Original releases the new editor and its effects worker from memory; only its editable settings are kept. A processing error keeps the last accepted lane audio, blocks finishing stale output, and leaves the Original tuner selector available. Source/timing changes that make old note positions incompatible start new analysis and retain the previous editor state in project metadata; it is not automatically reapplied to a different recording.

## Review fixes

- Single-note pitch correction and quantization respect the selection.
- Edits made during processing are queued by revision. Only the latest completed edit becomes ready for saving/export, and it survives a normal reload.
- Undo includes key, scale and other editor settings.
- Pitch candidate selection no longer discards the fundamental solely because a later harmonic-period candidate has a lower cost. High-note period refinement passed the measured synthetic range tests.
- Manual cents targets remain exact with Smooth enabled.
- Stereo and floating-point source headroom survive session saves.
- Malformed session metadata is rejected before replacing the open session.
- Standalone WAV export applies a disclosed common attenuation when needed instead of silently clipping.
- Editor audition uses a displayed monitor attenuation when needed for summed-vocal/backing headroom. This does not alter saved processing or export gain.
- A standard viewport fixes the standalone phone layout.

## Integration boundaries

The embedded editor processes one vocal lane. Its standalone harmony/double stem generator is hidden in embedded mode; use separate Song & vocals lanes and the application's vocal doubler. The standalone `note-editor.html` retains those stem controls. The legacy Smart Guide's proposed tuning A/B and Apply actions are disabled while the new tuner is active; matched stage listening, vocal-detail comparisons, the existing chain, reference measurement workflow and Finish & check remain available.

Existing per-lane effects limits still apply, including the conservative 8,000,000-frame stereo limit (166.7 seconds at 48 kHz) and the 256 MB input-plus-output budget. Retiming beyond a limit is refused rather than silently converting stereo. The former 8,640,000-frame limit allowed a 179-second stereo input to fail inside the unchanged engine; 0.29 refuses that size before touching the open editor. A second engine and the editor increase memory and processing requirements. Phone-width layout tests are not physical iOS/Android or low-memory certification.

Automated technical checks and peak measurements do not establish that every vocal sounds natural or release-ready. Pitch detection can still be wrong on breathy, doubled or noisy singing; flagged-note review is a listening aid, not a guarantee. The listening comparison and your preset approval remain the next step. Nothing has been deployed to a live site.

## Developer entry points

- `tuner-routing.js` owns the per-track engine choice, cleaned-input bridge, effect pass, comparisons and error recovery.
- `note-editor.html` provides the scoped `PlaybookNoteEditor` API; embedded mode skips standalone storage and file controls.
- `note-editor-safety.js` validates the bridge and standalone sessions.
- `index.html` keeps its original engine RPC as `engineRaw`, routes the active path through `NoteTuner.dispatch`, and persists `noteTuner` beside original fields.
- `song-polish.js` still accepts lane output only through `acceptPolish`. It captures and validates both tuner states.
- The seven files listed in `ENGINE-SHA256.txt` remain byte-identical to 0.28.0.

See `TEST-RESULTS-0.29.0.txt` and `tests-0.29/` for reproducible checks and limitations.
