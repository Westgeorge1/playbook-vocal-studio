# Playbook Vocal Studio 0.29.0 — editable notes after cleaning

Read [TUNER-INTEGRATION-0.29.0.md](TUNER-INTEGRATION-0.29.0.md) for the new editor, rollback selector, fixes and limits. Extract this whole folder, run `python serve.py`, and open the local address. The original tuner and its settings are preserved. No live deployment.

## Earlier release notes

# Playbook Vocal Studio 0.28.0 — conservative finishing update

See CHANGES-0.28.0.txt and TEST-RESULTS-0.28.0.txt for this release.
Back up your project before upgrading. Saved processing settings are preserved.

## Historical 0.27.0 notes

# Playbook Vocal Studio 0.27.0 — reference-guided finish

Save a preferred vocal's measurement profile with your song, compare it with your own POLISH vocal, and audition small finishing suggestions at matched volume. Apply changes you prefer; Undo restores the previous result. The profile stores measurements, not reference audio.

Back up your song, extract this complete package, run `python serve.py`, and open the address it prints. In POLISH, choose **Reference guide**. See `REFERENCE-GUIDE-0.27.0.md` for the workflow and `TEST-RESULTS-0.27.0.txt` for validation and limits. No live website has been changed.

## Included from 0.26.0 — vocal finishing workbench

Adds matched stage listening, phrase-volume moves, and explicit final-song loudness/peak control. Read `CHANGES-0.26.0.txt`, `QUALITY-NOTES-0.26.0.md`, and `TEST-RESULTS-0.26.0.txt`.

The existing tuning engine is unchanged. Real-vocal listening validation remains necessary.

## Previous release documentation

# Playbook Vocal Studio 0.25.1 — every vocal lane can be polished, safer audio and settings

- **0.25.1:** fixes the independent 0.25.0 review: autosave/Undo, standalone-project recovery, mono/stereo editor rebuilding, exact legacy input in modern backups, and phone editing access. See CHANGES-0.25.1.txt, IMPLEMENTATION-HANDOVER-0.25.1.txt and TEST-RESULTS-0.25.1.txt.

- **0.25.0:** fixes R1–R6 from the 0.24.0 review: a 4-min lead + two 4-min backing vocals all complete POLISH,
  POLISH readiness shown ("POLISH: 2 of 3 vocals ready"), instant capacity refusal, stereo kept on reopen (mono only
  by your choice), no stale take approved on older projects, "own key" works both ways, POLISH settings survive a
  crash, invalid (NaN) audio rejected; modern backup without older-app copies (CHANGES-0.25.0.txt,
  REVIEW-RESPONSE-0.25.0.md, TEST-RESULTS-0.25.0.txt; tests in tests-0.25, run_all25.sh; invariants in AGENT-HANDOVER.md).


- **0.24.0:** fixes F1–F8 from the 0.23.1 review, 256 MB of recording room (about 23 minutes mono) with the room left shown,
  compact 16-bit storage, sticky take-editor footer and 44 px touch targets (CHANGES-0.24.0.txt, REVIEW-RESPONSE-0.24.0.md,
  TEST-RESULTS-0.24.0.txt; tests in tests-0.24, run_all24.sh).

- **0.23.1:** autosave survives an immediate reload or a killed tab; the downloads box is a
  small toast that folds to a chip and never covers the transport (CHANGES-0.23.1.txt).
- **Fix A:** choosing a shorter take for one section now replaces only that time range; the
  earlier (e.g. whole-song) take keeps playing everywhere else. Delete unchosen never removes
  a take still in use and lists what it will delete.
- **Fix B:** projects from 0.18.3, 0.20, 0.21 and 0.22 open with their POLISH intact (no false
  "Update needed"); a real change keeps edits outside the changed range and lists the rest.
- "Section" wording everywhere; "With backing / Vocals only"; on phones POLISH shows
  Clean / Tune / Chain before the note editor.
- **Split a take** in the take editor (at the playhead or a chosen time). Both sides keep
  every attempt, the chosen take, stars and reference; both are checked again; Undo/Redo.
- **Reference take**: Use as reference / Clear reference in the take editor or ⋯ menu.
  The check compares the other takes with it for melody and timing, as in 0.18.3. Kept in
  projects and in the 0.18.3 parts data.
- **Key and scale** in Recording settings, shown in the transport, the same key as POLISH
  TUNE (changing either changes both).

See `CHANGES-0.23.0.txt` and `TEST-RESULTS-0.23.0.txt`.

## Earlier notes (0.22.0)


0.22.0 keeps the multi-lane Song & Vocals screen (SongCore / SongStudio is still the
only microphone owner) and brings back the 0.18.3 part workflow:

- Part flow from song sections: pick a part, ● Record part, ◀ Previous part / Next part ▶,
  Redo last take, Delete unchosen takes. "Stop at part end" is OFF by default: recording
  runs until you press Stop and the part grows to fit (never past the next part).
- Take stars (1–5, yours) and a Suggested badge with "Why suggested?", using the same
  phrase-core check as 0.18.3, run for every attempt. It runs again after any edit,
  Undo or Redo.
- Take editor behind an Edit button on each take: trim start/end, level, fade in/out,
  timing. Nothing is cut from the recording; Undo/Redo work.
- Start card on an empty session: Record a vocal / Import a vocal / Open a project /
  + Add backing. The long help is behind a Help link.
- With / Without backing switch in the transport.
- Compatibility: project ZIPs also carry 0.18.3 parts data (the Lead vocal as a whole
  vocal plus one part per section). **Older versions (0.18.3 and earlier) open only the
  Lead vocal and its parts; other vocal tracks need 0.20.0 or newer.** The app says so
  when you back up a project with more than one vocal track. Old projects keep their
  star ratings, check results, key/scale and reference take when they are opened.
- POLISH tidy: one Undo/Redo pair, one export entry (Export song, which also offers
  "Only this vocal"), a one-row POLISH bar at 1024, no saved-notice overlap on phones,
  phone Song screen compact (Hear backing on the first screen).

See `CHANGES-0.22.0.txt` and `TEST-RESULTS-0.22.0.txt`.

## Earlier notes (0.21.0)


0.21.0 builds on the 0.20.0 multi-lane Song & Vocals design (SongCore / SongStudio is
the only microphone owner) and brings back the first set of 0.18.3 recording tools on
the song recording screen:

- Metronome click (on/off, volume) and count-in of 0, 1 or 2 bars, following the song
  tempo and time signature. The click is heard only through your speakers/headphones
  and is never written into a take.
- Bar/beat grid on the recording timeline, a bar | beat readout, optional snap to beat.
- HEAR ME live monitoring with its own level, through the same capture graph, with a
  headphones warning. Monitoring never enters the take or any other lane.
- Punch-in on the fly: play the song, press R to punch in on the selected track, R again
  to punch out; the song keeps playing and the new attempt has short edge fades.
- Gapless loop recording over a selection: one continuous recording, one attempt per pass.
- Autosave is written immediately after a backup or an opened project and when the page
  is hidden or closed.
- Shortcuts R, Space, Home, C (click), L (loop), Esc (cancel recording).

See `CHANGES-0.21.0.txt` and `TEST-RESULTS-0.21.0.txt`. The rest of the 0.18.3 features
(part flow from sections, stars / Why suggested, take editor, start card, With/Without,
0.18.3 write-back) follow in stage 2.

## Earlier notes (0.20.0)


This build integrates the existing Clean, Tune, note editor, wave editor and
effects engine with independent lead, harmony, double and ad-lib recording lanes.
Each lane retains its own settings and processed audio. Song playback combines
those processed vocals; a project backup preserves their editable sessions.

Start with `START-HERE.txt`. Give your coding agent the complete ZIP and ask them
to read `AGENT-HANDOVER.md` before merging it into your current application.

To try this build locally, extract the folder and run `python serve.py`, then
open the address it prints. Production microphone access requires HTTPS. This
package has not changed or deployed your existing website.

Included:

- Complete runnable static application and original audio engine assets.
- Patches from the exact supplied 0.18.3 application and the 0.19.0 handover.
- Source tests and current results under `tests-0.20/`.
- `TEST-RESULTS-0.20.0.txt`, `PATCH-VALIDATION.txt` and integrity manifests.

The new behavior is described by the 0.20.0 documentation. Earlier versioned
reviews and changelogs are historical. The unchanged licensing files remain
applicable; see `LICENSE-AGPL-3.0.txt` and `licenses/`.
