# Local live model + Context Runtime (temporary)

Manual opt-in for owner demos. Disable with `BUILDY_LIVE_MODEL=0` and restart Session HTTP (no background autonomous runs).

## Pieces

| Piece | Source | Role |
| --- | --- | --- |
| Session HTTP | `services/context-serve` `:18090` | sessions, validated `save_page`, Page Store; **owns** live turns via `POST /v1/sessions/{id}/messages` |
| Context Runtime | `github.com/fastygo/context` binary `/workspace/var/phpingineer/bin/context-serve` on **`127.0.0.1:18085`** (BuildY-owned) | `POST /v1/context-pack` over Razguliay dishes corpus |
| Live agent | `@grok/agent-sdk@0.6.0` bot in `/workspace/var/phpingineer/buildy-page-agent` | model `grok-4.7`, tools `context_pack` + `propose_page` (Session persists) |
| Lexproto | `github.com/fastygo/lexproto` @ `3b092b8` | **docs-only** — adapter is `Unavailable`. **Jev ≠ lexproto**; do not enable fake lexproto gates |

`liveModel: true` on `/v1/capabilities` is set only after `MarkLiveSuccess` (successful Session-integrated live turn), never from env alone. `features.contextRuntime` flips only after a real `/health` probe. `features.lexproto` stays false until a real runtime artifact exists.

## Catalog prices (honesty)

CR evidence surfaces use `pack_price` / `pack_price_display` integers with `weight: "100 гр"`. There is **no** currency/RUB field in the dishes corpus. Prefer copy like `каталожная цена 150 · 100 гр`. Do not invent promo dates, delivery zones/fees, or seasonal claims absent from the pack.

## UI8Kit selection ids

Agent cites real catalog component/variant ids (format 2, version 3.0.0), e.g. `products/grid3`, `cta/banner`, `delivery/facts`, `pagehead/start`. Creator Preview still renders Page DTO kinds (`nav`/`hero`/`menu`/…).

## Disable after viewing

```sh
export BUILDY_LIVE_MODEL=0
# restart Session context-serve without BUILDY_LIVE_MODEL; leave CR on :18085 or stop intentionally
```

Ngrok and WordPress writes are out of scope for this path.
