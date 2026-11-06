# context-serve

Go service for SI Chat. **M2:** durable PagePort (SQLite) for ordinary page drafts. Context runtime / Gateway / sessions are still unwired.

## HTTP contract (v1)

Loopback by default (`127.0.0.1:8090`). No authentication; do not bind a public interface without a later auth layer.

| Method | Path | Role (PagePort) |
| --- | --- | --- |
| `POST` | `/v1/pages` | `savePage` create draft (`parseDraftPage`) |
| `GET` | `/v1/pages/{id}` | `getPage` |
| `GET` | `/v1/slugs/{slug}` | `getPageBySlug` |
| `PUT` | `/v1/pages/{id}` | `savePage` update; optimistic `revision` |
| `GET` | `/healthz` | store ping |

Create body:

```json
{ "page": { "...Page DTO..." }, "idempotencyKey": "optional" }
```

Update body (If-Match header also accepted):

```json
{ "page": { "...Page DTO..." }, "revision": 1, "idempotencyKey": "optional" }
```

Success:

```json
{ "page": { "...validated Page DTO..." }, "revision": 1 }
```

Error:

```json
{ "error": { "code": "duplicate_slug", "path": "slug", "message": "..." } }
```

`page` is the canonical `layout.version` **1** DTO from `packages/page-contract`. Go does not implement the TypeScript interface; it validates the same JSON. Shared cases: `packages/page-contract/fixtures/conformance-cases.json`. Unknown envelope keys are rejected.

Statuses other than `draft` are valid on `parsePage` (get/load) but **this store only writes drafts**. Publish is out of M2.

## Persistence

- SQLite driver: `github.com/mattn/go-sqlite3` (CGO; gcc required). Chosen because `modernc.org/sqlite` / `proxy.golang.org` were unreachable from the implementation environment; GitHub-hosted CGO driver is widely supported.
- Path: `PAGE_STORE_PATH` (default `data/pages.sqlite`, relative). HTTP never accepts filesystem paths.
- Forward-only migration `internal/pagestore/migrations/001_init.sql` (`pages` + `revisions`).
- Unique slug is **global** in this database (no tenancy column).
- `page.id` is stable; `revision` is monotonic per page. Writes are one transaction: page row + revision row. Failures roll back (no placeholder rows).
- Optional `Idempotency-Key` / `idempotencyKey` for M3-friendly replays. Not a Gateway.

## Run

```sh
cd services/context-serve
go test ./...
go build -o context-serve .
CONTEXT_SERVE_ADDR=127.0.0.1:8090 PAGE_STORE_PATH=data/pages.sqlite ./context-serve
```

Bare `:8090` is rewritten to `127.0.0.1:8090`.
