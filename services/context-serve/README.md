# context-serve

Go service for SI Chat. **M3:** durable PagePort + page-associated Session foundation (SQLite). This is **not** a finished full-agent runtime (no live model, Context Runtime, or lexproto wiring yet).

## Product model

- One **session** ↔ one stable **pageId** (unique mutable slug after first save).
- New clean page workspace = new clean session (isolated messages/runs/context).
- Ordinary conversation persists messages and **must not** create or revise a page.
- Only an explicit **`save_page` tool** request creates/updates the draft bound to that session.
- Deterministic `context-local` test runtime exists for infrastructure tests only — do not treat it as a live agent.

## HTTP contract (v1)

Loopback by default (`127.0.0.1:8090`). Host/Origin must be loopback when present. No permissive CORS. No authentication; do not bind a public interface without a later auth layer. Body cap 72KiB.

### PagePort (M2, preserved)

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/v1/pages` | create draft |
| `GET` | `/v1/pages/{id}` | get by id |
| `GET` | `/v1/slugs/{slug}` | get by slug |
| `PUT` | `/v1/pages/{id}` | update; optimistic `revision` |
| `GET` | `/healthz` | store ping |

### Session foundation (M3)

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/v1/capabilities` | runtime/capabilities (`liveModel: false`) |
| `POST` | `/v1/sessions` | create session + allocate `pageId` (no page row yet) |
| `GET` | `/v1/sessions` | list sessions |
| `GET` | `/v1/sessions/{id}` | session + optional bound page |
| `POST` | `/v1/sessions/{id}/messages` | user turn (conversation and/or explicit tools) |
| `GET` | `/v1/sessions/{id}/messages` | message history |
| `GET` | `/v1/sessions/{id}/runs/{runId}` | run status / recovery read |
| `POST` | `/v1/sessions/{id}/runs/{runId}/recover` | complete a durable `pending` run |

Create session:

```json
{ "slugIntent": "home", "title": "optional" }
```

Message turn (conversation only — no page write):

```json
{ "content": "What should the hero say?", "requestId": "req-1" }
```

Message turn with explicit save:

```json
{
  "content": "optional note",
  "requestId": "req-2",
  "tools": [{
    "name": "save_page",
    "arguments": {
      "page": { "...Page DTO with session pageId..." },
      "expectedRevision": 1
    }
  }]
}
```

`requestId` is durable idempotency for the turn: same key + same payload replays; same key + different payload → `409 idempotency_conflict`. First `save_page` creates revision 1 and binds the session; later saves update the same pageId. Pending runs survive crash and complete via `/recover`.

## Persistence

- SQLite (`github.com/mattn/go-sqlite3`, CGO). Path: `PAGE_STORE_PATH` (default `data/pages.sqlite`).
- Forward-only migrations: `001_init.sql` (pages/revisions), `002_sessions.sql` (sessions/messages/runs).
- One logical page per session (`sessions.page_id` unique). Page content rows appear only after `save_page`.
- Writes that bind a page commit page row + revision + run + messages in one transaction after the durable pending marker.

## Run

```sh
cd services/context-serve
go test ./...
go build -o context-serve .
CONTEXT_SERVE_ADDR=127.0.0.1:8090 PAGE_STORE_PATH=data/pages.sqlite ./context-serve
```

Bare `:8090` is rewritten to `127.0.0.1:8090`.

## Not in M3

Live model / Cursor SDK / Context Runtime / lexproto adapters, SSE/abort streaming, WordPress publish, five landings / hierarchy / UTM, UI wiring of Session API.
