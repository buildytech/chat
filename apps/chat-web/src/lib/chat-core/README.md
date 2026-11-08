# ChatCore

Logic-only chat module (no DOM). The browser SPA talks to this API.

- Default: sessions / messages in `session.svelte.ts` (in-memory + localStorage mock).
- Surfaces that render the thread live in `ChatColumn` (ADR-0003).
- Optional Session HTTP: `?live=1`.
- Live agent turns: Agent Gateway + AdapterRegistry (ADR-0004). Default `context-local`; opt-in `cursor-sdk` is not wired.
