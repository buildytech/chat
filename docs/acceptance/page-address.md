# Page address acceptance — 2026-11-12

Implemented ADR 0029 with the existing Page.slug, no schema migration. Enter commits; Escape cancels; invalid routes use native field validity. Pending proposals retain their pending status. Slug edits share inspector undo history and page revisions.

Validation: contract + unit suite passed (serialized), Svelte check passed, production build passed. Isolated Edge/Playwright fixture: changed Site to /marketing-landing, reloaded and observed the saved address; opened the friendly preview and legacy /preview route with the same session; confirmed rendered content and unchanged exported session (excluding export timestamp); no page errors.

Limits: one segment only. Browser-local links require the stored session. WordPress routing/publishing/global slug uniqueness are future host responsibilities. The configured application base is used for outgoing preview links and canonicalization. No WordPress adapter was added. Owner visual acceptance is pending.
