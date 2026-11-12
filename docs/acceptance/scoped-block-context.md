# Scoped block context and Ask repair — 2026-11-12

Contract/unit suite passed (serialized); focused Ask/Build suite: 18 tests passed, including scope rejection, request propagation through runtime, sequential replacement and local enum repair. Svelte check and production build passed.

Isolated Edge production-browser fixture: Add to chat in Preview creates the block ID chip; invalid replacement shows Needs repair; choosing a supported variant clears the error; Apply in Build creates a pending ask-plan proposal with the chosen catalog block. Enabling Hide service labels in Preview removes composer diagnostics and preview provenance, keeping the explicit scope chip. No page errors. No paid model call was made; runtime tests use a mocked provider.

Draft selection is per-chat memory only, cleared by reload. Owner visual acceptance is pending. Existing model prose can still contain unverified claims; scope limits the affected blocks rather than certifying facts.
