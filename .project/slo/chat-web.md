# SLO: apps/chat-web

Ранняя стадия (scaffold). Нет production traffic и live backends — цифры про **сборку и CI**, не про 99.99% uptime.

| Indicator | Target | Window | Notes |
| --- | --- | --- | --- |
| Build success rate on `main` | ≥ **90%** green `chat-web` job | rolling 28 days / last 20 runs (что больше) | `npm run build` in `apps/chat-web` |
| Time-to-green (`apps/chat-web` CI) | p90 **≤ 10 min** | same | checkout + Node LTS + `npm install` + build |
| Mock-session local path availability | **N/A (production)** | — | in-memory + localStorage; не production SLO, пока нет live orchestrator / Page Store |

## Measurement

- **Build success / time-to-green:** GitHub Actions [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) (`chat-web` job). Источник: Actions run duration + conclusion на `main`.
- **Release path:** [`.github/workflows/slsa-provenance.yml`](../../.github/workflows/slsa-provenance.yml) — success rate считается отдельно; красный provenance не жжёт build SLO, но блокирует объявление release-ready.
- Mock-session: только локальный `npm run dev` (см. [docs/runbook.md](../../docs/runbook.md)). Production availability появится вместе с live backends — тогда отдельный SLO.

## Error budget (greenfield)

10% неуспешных CI runs на 28 дней — бюджет на registry flakes, toolchain drift и отсутствие lockfile.

Пока бюджет горит (main красный дольше одного рабочего цикла): не публиковать теги `v*`, не считать SPA release-ready. On-call нет; реакция — починить build на `main`, не маскировать skip-ами.

Когда появится lockfile + live backend, пересмотреть targets (ожидаемо: build ≥ 95%, отдельный availability SLO).
