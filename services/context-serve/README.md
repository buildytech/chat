# context-serve

Go service for SI Chat. **M3:** durable PagePort + Session HTTP/Gateway foundation (SQLite) with a labelled deterministic stub builder. This is **not** a live model. Optional from chat-web: open `/?live=1` so Vite `/v1` proxies here. Default Creator start is mock and does not require this process. Workspace still does not treat stub output as live-model acceptance.

## Product model

- One **session** ↔ one stable **pageId**. First successful turn binds that page in one short transaction; later turns update the same page with optimistic concurrency. They never mint a second page by accident.
- A **new explicit session** is allowed to create a new page.
- **Slug policy:** slug is globally unique. `slugIntent` is a hint used on the first successful turn. A colliding `slugIntent` fails that turn with `duplicate_slug` and must not leave a page row. Omit `slugIntent` to use the session id as the slug.
- Page effect is **exactly-once**, not model invocation (there is no live model). Key = request-scoped session `Idempotency-Key` / `requestId` + payload hash of `content`+`tools`. Same key+payload returns the same run/page/revision. Same key different payload → `409`. A durable `pending` run is recovered after restart; it cannot stay stuck or create a second page.
- Stub work runs **outside** the DB transaction. Persistence uses the validated M1 Page DTO and the M2 transaction boundary.

## HTTP contract (v1)

Loopback by default (`127.0.0.1:8090`). Unexpected `Host` and browser `Origin` values are rejected (loopback bind alone does not stop CSRF from websites). No CORS headers. No authentication; do not bind a public interface without a later auth layer. No model secrets. Body cap 72KiB.

### PagePort (M2, preserved)

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/v1/pages` | create draft |
| `GET` | `/v1/pages/{id}` | get by id |
| `GET` | `/v1/slugs/{slug}` | get by slug |
| `PUT` | `/v1/pages/{id}` | update; optimistic `revision` |
| `GET` | `/healthz` | store ping |

### Session HTTP (M3)

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/v1/capabilities` | `liveModel: false`, stub builder named |
| `POST` | `/v1/sessions` | create session + allocate `pageId` (no page row yet) |
| `GET` | `/v1/sessions` | list sessions |
| `GET` | `/v1/sessions/{id}` | session + optional bound page |
| `POST` | `/v1/sessions/{id}/messages` | user turn; `Idempotency-Key` or `requestId` required |
| `GET` | `/v1/sessions/{id}/messages` | message history |
| `GET` | `/v1/sessions/{id}/runs/{runId}` | run status / recovery read |
| `GET` | `/v1/runs/{runId}` | run by id (polling) |
| `POST` | `/v1/sessions/{id}/runs/{runId}/recover` | complete a durable `pending` run |

Create session:

```json
{ "slugIntent": "home", "title": "optional" }
```

Message turn (stub builder writes/updates the bound page):

```http
POST /v1/sessions/{id}/messages
Idempotency-Key: req-1
Content-Type: application/json

{ "content": "Harbor tables, seasonal plates" }
```

Completed runs return `200` with `run.status=completed` and the page. Pending returns `202` (never fabricated success). Failed returns `422` with `run.status=failed` plus `error`. Repeat the same key after a crash to recover a pending run.

Optional `save_page` tool supplies an explicit M1 DTO instead of the stub (used to test invalid DTO rejection). It is not a live model.

## Persistence

- SQLite (`github.com/mattn/go-sqlite3`, CGO). Path: `PAGE_STORE_PATH` (default `data/pages.sqlite`).
- Forward-only migrations: `001_init.sql` (pages/revisions), `002_sessions.sql` (sessions/messages/runs), `003_session_request_scope.sql` (request id unique per session).
- Writes that bind a page commit page row + revision + session revision + run result in one short transaction after the stub has finished.

## Run

```sh
cd services/context-serve
go test ./...
go build -o context-serve .
CONTEXT_SERVE_ADDR=127.0.0.1:8090 PAGE_STORE_PATH=data/pages.sqlite ./context-serve
```

Bare `:8090` is rewritten to `127.0.0.1:8090`.

## Not in M3

Live model / Cursor SDK / Context Runtime / lexproto adapters, SSE/abort streaming, CMS publish, five landings / hierarchy / UTM. Demo “Wrote page” text in the SPA is not live-model acceptance.
