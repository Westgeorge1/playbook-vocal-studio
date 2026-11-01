# Playbook Vocal Studio 0.32.4 beta

## Browse before recording

Open **2 POLISH** to explore CLEAN, TUNE, CHAIN, DETAIL and MIX. The note editor, waveform editor and reference comparison also open without audio. To expand any workspace, choose it at the top and press **Expand**. The real note editor opens with an empty piano roll. You can change view size, fold panels and return to the studio while the audio actions wait for a vocal.

Use **Record a vocal**, **Import a vocal** or **Open a project** in an empty panel. Importing into the empty tuning window fills the same window with the selected take. Recording takes you to the transport so you can stop the microphone, then returns to the editing view you started in. Pop out is available once you have a project. With the studio empty, Expand, Focus and Full screen are available in the current tab.

View preferences such as window size may be remembered. Looking around an empty studio does not create a saved song, write audio blocks, add undo history or start audio processing.

## Project storage

Open **Project storage** from Song & vocals or the File menu. It shows estimated song-project storage for the current location, the other locations on this origin, and the old shared save. Project backups are separate downloads. To remove either this location's save or the old shared copy, first check the downloaded backup for that specific song, tick the confirmation and confirm the removal. Removing this location reopens it empty. The other locations' saved projects remain available.

Manual Cleanup in the phrase take editor now uses the same compact autosave as Song & vocals. The original recording is stored once and the edited segment is saved separately. Opening the song reconstructs the editable take. Project downloads still carry the full audio. Each open cleanup take still occupies its full in-memory audio size.

## Validation

See TEST-RESULTS-0.32.4.txt and TESTING.md. The approved tuning presets use a pass/fail comparison against a reference release in the same browser. Historical 0.31.13 hash values remain visible as information. Test suites run serially from a temporary server root with an optional port range.
