# ADR 0040: The session is a project plus `ext.chat`; session 1.9.0

Status: accepted, 2026-11-14. Owner decision: plan item 2 of `docs/plans/refactor-2026-11.md` (audit A-01, A-02, A-04, part of A-05 and C-01).
Extends ADR 0015 (page revisions and history) and ADR 0034 (page-spec v2).

## Context

One 1051-line module (`chat-core/session.svelte.ts`) held the chat messages, the page binding, skin, mode, collection intake, proposal
apply, the mock send path and the session file import and export. The page store and the pages blob were keyed by the chat session
id, and `messages` was required, so a project (page, skin, history) could not exist without a chat.

## Decision

- Contract first (`ui8kit/contract` `fda5f32`, session 1.9.0, additive): `messages` is optional, a new optional `projectId` names the
  page record of a session (default: the session id), and the program check `duplicate_project_page` rejects two sessions that
  share one page record. `packages/page-contract` vendors it (chat `c2aa2cb`); session files key page records by `projectId ?? id`.
- `lib/project/` is the project: `types.ts` (`Project`: page id and revision, screen, skin, collection, history, and `ext` by name),
  `doc.ts` (the stored session document <-> `Project`, pure, schema key order), `transitions.ts` (pure: new, revision, skin, ext,
  applied, collection item), `store.svelte.ts` (list, selection, persistence, skin, empty start, apply and discard of the pending
  page, the revision listener, with `registerProjectNormalizer` for extensions) and `file.svelte.ts` (session file export and
  import with quarantine). It imports no chat code; a test scans the imports.
- `lib/chat-core/` is `ext.chat` (messages, mode, selected model, usage): `view.ts` (pure `viewOf` / `projectOfView` and the proposal
  normalizer), `chat.svelte.ts` (run state, selection wrappers that abort a run and restore the workspace context), `turn.ts`,
  `send.ts`, `proposal-flow.ts`, `intake.ts`, `transfer.ts`, `gates.ts`. `session.svelte.ts` is a facade of re-exports. No file is
  over 300 lines (a test enforces it).
- The page store is keyed by project: `bindProject`, `getBoundProjectId`, `readProjectPage`, `writeProjectPage`, `deleteProjectPage`,
  `RevisionEvent.projectId`. A chat is a view of a project (`viewOf`, memoized per project object); the chat writes back with
  `projectOfView`, and creates `ext.chat` only when it has something to keep.
- Storage and files stay byte-compatible with the previous app version: the stored list is the merged session documents,
  `projectId` is written only when it differs from `id`, and the chat-on app creates `ext.chat` with `messages: []` for every
  project it makes. A rollback therefore never meets a document its closed schema rejects. A project with no chat arises only
  from an imported file or a host without chat (item 5); it saves, loads and exports as it came (`project-split.test.ts`,
  `session-store.test.ts`).
- Migrations are counted (`window.buildy.migrationReport()`: `pageV1`, `feedScreen`, `legacyKeys`, `proposalApplied`; chat `a84dff1`)
  so item 4 can remove them on evidence. The chat normalizer counts `proposalApplied` on every load and import.

## Consequences

- Only the `chat` extension is written back to storage; another module's `ext.<name>` lives in memory until it has keys in the schema.
- `startEmptyPageInChat` and `loadPropsGate` are still imported by the Inspector through chat-core (A-05 is half done: the project
  action `startEmptyProject` exists, the chat wrapper creates a chat when none is selected; item 5 removes the wrapper).
- The project store and chat modules use module-level runes; only the pure parts (`doc`, `transitions`, `view`, the normalizer,
  `collection`) are unit-tested in node. The runes parts are covered by the source-structure tests and the staging smoke.
