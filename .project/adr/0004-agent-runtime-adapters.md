# ADR 0004: Agent runtime adapters & VPS cursor-sdk opt-in

- Status: Accepted
- Date: 2026-11-06
- Extends: [0001-cms-agnostic-chat-builder.md](0001-cms-agnostic-chat-builder.md)
- Surfaces: [0003-creator-surfaces-preview-code.md](0003-creator-surfaces-preview-code.md)
- Spike (patterns only): `buildytech/vibecode` — **not** the BuildY reference

## Context

Чат должен ходить в агента через один канал, а не через разрозненные SDK-вызовы из UI. Default path — лёгкий harness / context-serve (уже stub в репо). Тяжёлый VPS runtime с `@cursor/sdk` — **opt-in**, не default.

`buildytech/vibecode` полезен как spike: Agent Gateway, Agent Contract, AdapterRegistry, `cursor-sdk` с `local: { cwd }` и capabilities. Не копируем Solid Studio, Docker preview isolation, multi-tenant TEE.

## Decision

### Agent Gateway — единственный chat channel

UI (ChatCore) говорит только с **Agent Gateway**. Контракт v1:

- sessions
- messages
- SSE (token / event stream)
- abort
- capabilities

Нет прямых вызовов `@cursor/sdk`, OpenCode HTTP shards или orchestrator internals из `apps/chat-web`. P0: mock ChatCore (`session.svelte.ts`) закрывает local path, пока Gateway не live (как offline mock в ADR-0001).

### AdapterRegistry

`agent_runtime` → factory. UI **не** ветвится по `if (runtime === …)`. Ветвление только по **capabilities**, которые Gateway отдаёт в контракте.

| `agent_runtime` | When | Notes |
| --- | --- | --- |
| `context-local` | **default** | Lightweight context-serve / harness. Matches current stubs (`services/context-serve`, mock ChatCore). No CURSOR_API_KEY. |
| `cursor-sdk` | **opt-in** | VPS: `agent_runtime=cursor-sdk` + `CURSOR_API_KEY` + local cwd workspace. |

Новый адаптер не вливается без **conformance-suite** (sessions / messages / SSE / abort / capabilities). Suite — follow-up; gate обязателен до второго runtime в проде.

Семейство рантаймов: **`sdk` only**. HTTP agent shards в стиле OpenCode — **non-goal**.

### cursor-sdk (opt-in VPS)

Когда включён:

- `@cursor/sdk` `Agent.create` / `Agent.resume`
- `local: { cwd: workspacePath }` на VPS (workspace = cwd агента, не Docker preview)
- Capabilities рекламируются Gateway; CreatorShell читает capabilities, не имя адаптера

Не включать в default compose. Не класть ключ в git.

### Secrets

- BYOK / env only (`CURSOR_API_KEY` и аналоги). **Never in git.**
- Нет ключа на opt-in runtime: prompt → ясный **503**; **sessions may still bootstrap** (список/создание сессий без model turn).
- Mock / `context-local` не требует ключа (сегодняшний `npm run dev`).

### Preview plane ≠ agent plane

Preview/Code (ADR-0003) живут в Page Store / Creator Workspace. Агентский runtime **не** монтирует Docker socket на API в P0. Нет Docker preview isolation из vibecode.

### vibecode

Цитируем **паттерны**: Gateway, Contract, AdapterRegistry, `cursor-sdk` + `local.cwd`, capabilities. Не переносим код и не считаем vibecode референсом продукта.

### Non-goals (this ADR / P0)

- Live `@cursor/sdk` wiring, VPS compose, Docker runners
- OpenCode-style HTTP agent shards
- Multi-tenant TEE, Solid Studio
- UI `if (runtime === "cursor-sdk")`

## Consequences

- ChatCore остаётся CMS-agnostic и runtime-agnostic: один клиент Gateway.
- Default install остаётся лёгким (mock + будущий context-local).
- Opt-in VPS документирован до реализации; latency SLO для cursor-sdk — N/A, пока нет профиля (см. [slo/chat-web.md](../slo/chat-web.md)).
- Orchestrator stub (`apps/orchestrator`, `@grok/agent-sdk@0.6.0`) может позже стать одним из sdk-family адаптеров; это не второй канал в обход Gateway.
