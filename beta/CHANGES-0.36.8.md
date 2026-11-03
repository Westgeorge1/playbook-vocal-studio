# Playbook Vocal Studio 0.36.8 beta candidate

The footer and per-track POLISH buttons now request persistent browser storage, matching the existing POLISH tab behavior. In 0.36.7 these two entry points opened POLISH but left storage in the not-asked state. The storage suite now covers all three entry points (16 checks including the existing cases).

This is a narrow correction to 0.36.7 storage hardening. Audio processing and the seven locked engine files remain unchanged. The earlier intermittent missing-draft failure still has no demonstrated cause; persistent storage is not claimed as its repair.

The 0.36.7 source, supplied test report, and failed entry-point reproduction remain separate evidence. This candidate requires its own qualification before release. Main and live beta are unchanged while this remains a draft.
