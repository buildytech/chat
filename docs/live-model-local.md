# Local live model + Context Runtime (temporary)

Manual opt-in for owner demos. Disable with `BUILDY_LIVE_MODEL=0` (and stop the sidecar agent).

## Pieces

| Piece | Source | Role |
| --- | --- | --- |
| Session HTTP | `services/context-serve` `:18090` | sessions, validated `save_page`, Page Store |
| Context Runtime | `github.com/fastygo/context` (`/workspace/fastygo-context`, tag ~v0.1.0) on `:18080` | `POST /v1/context-pack` over Razguliay dishes corpus |
| Live agent | `@grok/agent-sdk@0.6.0` bot in `/workspace/var/phpingineer/buildy-page-agent` | model `grok-4.7`, tools `context_pack` + `save_page` |
| Lexproto gates | `@grok/agent-sdk/extensions/jev` + `TYPESAFE_API_KEY` | `jev__evaluate` / `needsHuman`-style gating (experimental). `fastygo/lexproto` git clone has no runtime sources. |

`liveModel: true` on `/v1/capabilities` is set only after `MarkLiveSuccess` in-process (successful live turn), never from env alone.

## Disable after viewing

```sh
export BUILDY_LIVE_MODEL=0 BUILDY_LEXPROTO=0
# restart context-serve without those flags; leave CR up or stop intentionally
```

Do not invent promo/delivery facts; catalog dish prices come from the CR corpus only.
