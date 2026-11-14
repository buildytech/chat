# ADR 0004: Agent runtime adapters (superseded)

- Status: **Superseded** by [ADR-0011](0011-ask-build-modes-shared-agent-tools.md), [ADR-0034](0034-page-spec-2-one-write-tool.md) and [ADR-0041](0041-chat-as-optional-module.md). The Agent Gateway, the AdapterRegistry and the `cursor-sdk` opt-in were never built; the gateway client and its session map were deleted as dead code (audit B-09)
- Date: 2026-11-06
- Extends: [0001-cms-agnostic-chat-builder.md](0001-cms-agnostic-chat-builder.md)

## Context

The chat should reach an agent through one channel, not through scattered SDK calls from the UI. The default path would be a lightweight harness; a heavy VPS runtime on `@cursor/sdk` would be opt-in. `buildytech/vibecode` served as a spike for the patterns: an Agent Gateway, an Agent Contract, an AdapterRegistry, `cursor-sdk` with `local: { cwd }` and capabilities.

## Decision (as proposed)

- The UI talks only to one **Agent Gateway** (contract v1: sessions, messages, SSE, abort, capabilities); no direct SDK calls from `apps/chat-web`.
- `agent_runtime` selects an adapter (`context-local` by default, `cursor-sdk` opt-in); the UI branches on **capabilities**, never on the runtime name.
- Secrets are env or BYOK only and never in git; a missing key on the opt-in runtime answers 503.
- The preview plane is not the agent plane (no Docker socket in the API).

## What replaced it

One protected runtime, `apps/xai-runtime` (`/runtime/v1/status`, `/runtime/v1/run`), with a server-side `XAI_API_KEY` and Basic Auth on every non-loopback surface; one agent tool file and one write tool (ADR 0011, 0034); the chat as an optional module behind a `BuilderModule` port (ADR 0041). The principle that survives: the browser never holds the provider key and nothing calls a model before the author sends a message.
