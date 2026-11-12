# Manual inspector availability — 2026-11-12

ADR 0032. Root cause: preview and Sections picks set inspectorPanel.open, while Workspace rendering, header toggle and Ctrl+I were gated by Build. Ask therefore had an invisible open panel. Manual undo keys had the same mode restriction. This was a conflicting UI policy, not a missing renderer.

Fix: manual inspector and history remain available in either chat mode; model Ask remains read-only. Ctrl+I can return from Code to Preview; iframe Escape closes the panel. Explicit inspector open requests reveal the workspace on small viewports without continuously forcing the active surface. Fields wait for lazy props validation and picked-field focus waits for both validation and DOM readiness. Load failures show a retry-by-reopen message.

Verification: full serialized contract/unit suite passed; focused inspector/view-map suite 41/41; Svelte check zero errors/warnings; production build passed. Existing source tests enforcing the old Build-only UI were updated to the revised contract.

Isolated Edge production test at 1440x1000: Ask click selects and focuses the field, edit persists, Ctrl+Z / Ctrl+Shift+Z work, mode stays Ask; Escape and Ctrl+I work from inside the iframe; Ctrl+I returns from Code; Sections selects the requested second block; clean mode still permits selection; explicit Build switch retains working selection. At 390x844, a Sections pick reveals a visible inspector in the workspace. Zero page errors and zero model-run POSTs.

Scope: this verifies the named editor interactions, not every runtime/model or deployment scenario. Owner visual acceptance is pending.
