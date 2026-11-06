# ChatCore

Logic-only chat module (no DOM). SPA and WP embed both talk to this API.

- Sessions / messages: `session.svelte.ts` (in-memory + localStorage mock).
- Surfaces that render the thread live in `ChatColumn` (ADR-0003).
- Live agent turns: Agent Gateway + AdapterRegistry (ADR-0004). Default `context-local`; opt-in `cursor-sdk` is not wired.
