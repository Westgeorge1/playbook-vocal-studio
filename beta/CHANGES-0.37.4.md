# Playbook Vocal Studio 0.37.4 beta candidate

Base: 0.37.3. This is a privately prepared candidate for West’s review.

## Saved projects and Step 7

A 0.37.2 backup could store “Gaps, breaths, echo” as off while the audio engine still had de-reverb on. The restore path now bypasses de-reverb before the first render, preserves the 30% amount (or the singer’s chosen amount), and remembers the previous enabled setting for when Step 7 is switched on again. The alternate Vocal Detail switch also respects the parent switch. A preset or native undo cannot silently turn the engine back on while Step 7 is off.

If a track has a cached processed vocal made with conflicting settings, Song & vocals marks it for an update. Playback uses the original and the app prevents exporting that old processed result. Open the track in POLISH to rebuild it. Its recordings, note edits and takes are retained. The focused test compares the repaired final with the explicit manual off render and checks backup and autosave round trips.

## Laptop settings panel

The track status and ready messages now share the available toolbar width on desktop. The Reference guide button fits on the same row at 1280 × 800. The existing minimum-height test still requires 470 px; no assertion was loosened.

## Qualification

The runner uses 35 suites. Engine files, global cleaner defaults and the audio-clock watchdog retain their 0.37.3 versions. Qualification reports and listening ballots belong to the exact frozen archive. The physical Samsung test and blind sign-offs are separate. No deployment is part of this package.
