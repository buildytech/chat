# Context Runtime port provenance (BuildY)

## Current (owner-authorized)

| Service | Bind | PID (example) | Data | Binary |
| --- | --- | --- | --- | --- |
| BuildY CR | `127.0.0.1:18085` | started by this bot | `/workspace/var/phpingineer/buildy-cr/data` | `/workspace/var/phpingineer/bin/context-serve` |
| Session HTTP | `127.0.0.1:18090` | demo supervisor | `/home/box/.config/buildy-demo/pages.sqlite` | `/home/box/.config/buildy-demo/context-serve` |
| Vite Creator | `127.0.0.1:5173` | npm | — | chat-web demo |

`:18080` is **free** and must not be assumed BuildY-owned going forward.

## How `:18080` / PID 32658 relates

1. Earlier in this same BuildY agent lineage, `context-serve` was started on `127.0.0.1:18080` with `data=/workspace/var/phpingineer/context-data`. Evidence: `/workspace/var/phpingineer/logs/context-serve-m5.log`, `/workspace/var/phpingineer/logs/context-serve.log`, pid file `/workspace/var/phpingineer/run/context-serve.pid` containing `32658`.
2. That process was **this bot’s own** CR for stage/demo — not an unrelated third-party service. The earlier “do-not-touch” caution applied until provenance (pid file + log path under `/workspace/var/phpingineer`) was established.
3. After ownership was confirmed, that listener was stopped and BuildY CR was restarted on a **distinct** port **`18085`** with a dedicated data dir (`buildy-cr/data`) so we never collide with or kill someone else’s future service on `:18080`.
4. Live demo evidence that still cites `:18080` is **stale** relative to the current bind; Session/live agent now use `CONTEXT_RUNTIME_URL=http://127.0.0.1:18085`.

## Policy

- Never replace/kill a listener on a port without establishing provenance (pid → cmdline → data path → our tree).
- Prefer BuildY-owned distinct ports (`18085` CR, `18090` Session, `5173` UI).
