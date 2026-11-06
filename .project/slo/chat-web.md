# SLO: apps/chat-web

Ранняя стадия (scaffold + CreatorShell skeleton). Нет production traffic и live backends — цифры про **сборку, CI и дымовые индикаторы**, не про 99.99% uptime.

## Build / CI (kept)

| Indicator | Target | Window | Notes |
| --- | --- | --- | --- |
| Build success rate on `main` | ≥ **90%** green `chat-web` job | rolling 28 days / last 20 runs (что больше) | `npm run build` in `apps/chat-web` |
| Time-to-green (`apps/chat-web` CI) | p90 **≤ 10 min** | same | checkout + Node LTS + `npm install` + build |

## Early product indicators (not production SLOs)

| Indicator | Target | Window | Notes |
| --- | --- | --- | --- |
| CreatorShell layout smoke | **compile + mount** | each `main` build | 3 columns on `lg+` (AppNav \| ChatColumn \| Workspace) or Chat \| Workspace tabs below `lg`. Fail = build/typecheck red, not a latency SLO. |
| ChatCore mock path | **works locally** | `npm run dev` | create session, send, persist (`session.svelte.ts` / ChatCore). N/A as production availability until live Gateway. |
| Gateway stub health | **N/A** | — | No Gateway HTTP yet (ADR-0004). When a stub exists: process-up **2xx** on its health route. Not a production SLO. |
| cursor-sdk agent latency | **N/A** | — | No opt-in profile (`agent_runtime=cursor-sdk` + key + VPS cwd) yet. Do not invent p95 until that path is runnable. |
| Mock-session local path availability | **N/A (production)** | — | in-memory + localStorage; same as ChatCore mock. Live orchestrator / Page Store still stub. |

## Measurement

- **Build success / time-to-green:** GitHub Actions [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) (`chat-web` job). Источник: Actions run duration + conclusion на `main`.
- **Release path:** [`.github/workflows/slsa-provenance.yml`](../../.github/workflows/slsa-provenance.yml) — success rate считается отдельно; красный provenance не жжёт build SLO, но блокирует объявление release-ready.
- **CreatorShell smoke:** same `chat-web` job (`npm run build` must compile Shell / Column / Workspace). Visual check is local/dev, not CI until a smoke test exists.
- **ChatCore mock:** только локальный `npm run dev` (см. [docs/runbook.md](../../docs/runbook.md)).
- **Gateway / cursor-sdk:** не измеряем, пока нет stub health и opt-in profile (ADR-0004).

## Error budget (greenfield)

10% неуспешных CI runs на 28 дней — бюджет на registry flakes, toolchain drift и отсутствие lockfile.

Пока бюджет горит (main красный дольше одного рабочего цикла): не публиковать теги `v*`, не считать SPA release-ready. On-call нет; реакция — починить build на `main`, не маскировать skip-ами.

Когда появится lockfile + live backend, пересмотреть targets (ожидаемо: build ≥ 95%, отдельный availability SLO). Agent latency для cursor-sdk появляется **только** вместе с opt-in профилем — не раньше.
