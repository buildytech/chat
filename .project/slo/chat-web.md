# SLO: apps/chat-web

For the visual and accessibility acceptance of the shell refactor, see [Chat UI refinement](chat-ui-refinement.md) (ADR 0028).
This document holds the build and CI indicators of the app. There is no production traffic and no hosted backend yet, so the
numbers are about **build, CI and smoke indicators**, not about 99.99% uptime.

## Build / CI

| Indicator | Target | Window | Notes |
| --- | --- | --- | --- |
| Build success rate on `main` | at least **90%** green `chat-web` job | rolling 28 days or the last 20 runs, whichever is larger | `npm run build` in `apps/chat-web` |
| Time-to-green (`apps/chat-web` CI) | p90 **at most 10 min** | same | checkout, Node 22, `npm ci`, tests, `svelte-check`, build |

## Product indicators (not production SLOs)

| Indicator | Target | Window | Notes |
| --- | --- | --- | --- |
| Shell smoke | **compile and mount** | each `main` build | The headless smoke of `npm run verify` mounts the shell with the chat on and off (ADR 0041). Fail means a red build, not a latency SLO. |
| Local persistence | **works locally** | `npm run dev` | Projects and chats persist under `buildy:v1:*` in the browser (ADR 0015). Not a production availability figure. |
| Runtime latency | **N/A** | n/a | The optional runtime (`apps/xai-runtime`) has a run budget (60 s on Vercel Hobby, 90 s locally) but no latency SLO until a hosted profile exists. |

## Measurement

- **Build success and time-to-green:** GitHub Actions [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) (`chat-web` job): run duration and conclusion on `main`.
- **Release path:** [`.github/workflows/slsa-provenance.yml`](../../.github/workflows/slsa-provenance.yml). Its success rate is counted separately; a red provenance run does not burn the build SLO but blocks calling a release ready.
- **Shell smoke:** `npm run verify` (see [docs/runbook.md](../../docs/runbook.md)).

## Error budget

10% failed CI runs over 28 days is the budget for registry flakes and toolchain drift.

While the budget is burning (`main` red for more than one working cycle): do not publish `v*` tags and do not call the SPA release-ready. There is no on-call; the response is to fix the build on `main`, never to mask it with skips.

Revisit the targets when a hosted backend exists (expected: build at least 95% and a separate availability SLO).
