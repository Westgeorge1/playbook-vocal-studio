# 0.31.11 — visible recording and track removal

Recording removal previously required the attempt's ellipsis menu, and track removal was hidden in track settings. The final track could not be removed at all. Recording cards now show **Delete recording**, while vocal lane headers show **Clear recordings** and **Delete track**. The header controls wrap for touch use without clipping the mixer. The existing range-removal button is labelled **Delete range**.

Each action identifies what will be removed and asks for confirmation. Cancel changes nothing. A recording delete removes that attempt from its range; other uses of the source remain. Chosen/reference pointers are cleared as needed, without silently choosing another attempt. Clear recordings keeps the lane and its mixer controls. Delete track removes that lane; deleting the final lane creates a fresh empty Lead vocal. Backing music, song sections and other lanes are preserved. All actions use the existing edit, Undo/Redo, autosave and journal paths.

Removing the last recording from an open POLISH lane also releases its live editor view, without a new DSP request. Otherwise the old root editor could be saved and recovered as a recording on reload. The prior lane and processed audio remain in the Undo snapshot. Redo and crash-journal recovery no longer reattach POLISH to an emptied lane. Existing range deletion, redo-a-take and delete-unchosen actions use the same empty-lane cleanup.

The main/root app, native DSP, recording worklets and project format are unchanged. See TEST-RESULTS-0.31.11.txt for automated checks; this is still a beta requiring use on the physical phone.
