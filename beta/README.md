# Playbook Vocal Studio 0.21.0 — song recording, stage 1 of the 0.18.3 feature merge

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
