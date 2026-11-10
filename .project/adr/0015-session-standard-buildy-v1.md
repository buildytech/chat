# ADR 0015: Session standard buildy:v1: one key space, validated load, portable export, one revision per edit

- Status: Accepted
- Date: 2026-11-10
- Extends: [0007](0007-one-buildy-three-hosts.md) (portable export across hosts), [0014](0014-build-inspector.md) (inspector history)
- Schema: [`https://schema.buildy.tw/session.schema.json`](https://schema.buildy.tw/session.schema.json) (source: `ui8kit/contract` `src/session-v1.ts`, `scripts/schemas-session-v1.ts`)

## Context

Chats, pages and preferences lived under six unrelated localStorage keys (`buildytech-*`, `buildy.creator.*`,
`buildy.chat.*`, one `buildy:v1:*`). Stored data was read without a schema: a corrupt blob froze the key and the
author lost access to it. There was no file a session could leave the browser in, so Lab and the other hosts
(ADR 0007) could not open it. The page revision went up on every saved keystroke of an inspector field, and
`session.pageRevision` changed only on Apply, so the two drifted.

## Decision

1. **One key space.** Every BuildY value is under `buildy:v1:*` (`apps/chat-web/src/lib/browser/storage-v1.ts`):
   `sessions`, `pages`, `selectedSessionId`, `selectedModelId`, `layout`, `theme`, `preview.hideServiceLabels`,
   `migration`, `quarantine`. On the first storage access of a load, each legacy key is copied, read back and only then
   removed. The move is idempotent (a second run writes nothing). If both keys exist with different values, the
   buildy:v1 value wins and the legacy value goes to quarantine. A refused write leaves the legacy key for the next load.
2. **Validated load, quarantine instead of loss.** Chats are checked against `session.schema.json#/$defs/session`
   and page records against `page-spec.schema.json#/$defs/record`. The check uses the dependency-free checker of
   `packages/page-contract` (no Ajv in the main chunk), once per stored value. A value that fails (or JSON that does not
   parse) is kept in `buildy:v1:quarantine` as raw text with its reason and path, the store is rewritten without it, and
   the rest loads. The status line says so. If the quarantine write is refused too, the key is frozen as before.
3. **Portable session file.** `window.buildy.export()` returns a `buildy:v1` file. `export({ download: true })` also
   saves it as JSON. The file holds every chat with its messages and mode, the chat's page-spec record, `pageRevision`,
   the revision `history`, the catalog pins (Stock content commit, registry source commit, catalog digest), the app
   (name, version, host, build commit) and non-secret settings. It never holds a credential, and its objects are closed.
   `window.buildy.import(json)` runs the schema and the program checks (`duplicate_session_id`, `page_revision_mismatch`,
   `history_not_monotonic`, `selected_session_unknown`) and writes nothing when they fail. If a chat with the same id
   exists, that chat and its page record go to quarantine first, then the import replaces them. Lab BuildY reads the same
   file: its importer takes `sessions[]`.
4. **One revision per committed change.** The page store bumps the applied page's revision once per committed change:
   Apply, one inspector edit, one block operation, one undo, one redo. Typing in one field continues the open undo step
   (`EditHistory.continues`), so it keeps that revision and the page is still saved. The pure rule is
   `page-store/revision.ts`. A value equal to what the block renders returns the same page, so it gets no step and no
   revision. Edits of a pending proposal add no revision. Each new revision is announced (`onPageRevision`). The chat
   store then sets `pageRevision` and `pageId` and appends one history entry `{ revision, at, cause, pageId, blockId }`
   (the last 500 are kept). At load, `pageRevision` is reconciled with the page store, which is the source of truth.

## Consequences

- Revision counts are meaningful: N committed edits are N revisions and N undo steps, and `expectedRevision` sent to the
  runtime matches what the author sees.
- `/preview` may run the one-time key migration on its first storage read. It never writes chat or page data.
- Desktop (Wails3) and WordPress hosts implement the same file. Version bumps of the profile stay additive within
  `buildy:v1`.
- Not done here: Export / Import buttons in the UI (the API is the contract; UI follows with the 8+4 gate), and
  showing quarantined entries in Settings.
