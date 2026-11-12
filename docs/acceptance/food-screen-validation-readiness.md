# Food screen add: validation readiness — 2026-11-12

Owner export: commit 7719a6c, one chat, revision 0, empty applied draft, screen.theme-food-grill/home. No private export is committed.

Reproduction: addScreenSections without loading props-gate rejected all four supported sections with props_gate_unavailable and collapsed them to nothing_added / No section fits this page. With props-gate loaded, the same page accepts navbar, hero, FAQ and footer. grillbuilder, combobuilder and delivery lack supported sections and remain skipped.

Fix: inspector.add and inspector.addScreen await the existing shared lazy validator before starting or mutating a page. A switched chat cancels the pending action. Feed add, screen fallback and drag/drop callers await the result; Sections announcements follow completion. No validation is bypassed. If all sections are rejected by a gate, addScreenSections preserves the first actual error rather than reporting compatibility failure.

Checks: full serialized contract/unit suite passed; focused screen-family/feed/drag tests 19/19, including an isolated no-gate/load-gate regression; Svelte check zero errors/warnings; production build passed.

Isolated Edge production replay: held the Ajv validator chunk, imported the empty owner session, searched food screens and dragged home into Preview. While held, the page stayed empty. After release, four sections were committed as revision 1; the start button stayed enabled, no page errors. No model calls were made. Owner visual acceptance pending.
