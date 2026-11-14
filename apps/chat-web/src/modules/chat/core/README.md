# ChatCore

Logic-only chat module (no DOM). The browser SPA talks to this API.

- Default: sessions / messages in `session.svelte.ts` (in-memory + localStorage). Delete and delete-all are local QA actions, not a remote Session API.
- Surfaces that render the thread live in `LeftPanel` (ADR-0003).
- Live Grok turns: protected `/runtime` (xAI), not Session HTTP.
- Agent Gateway + AdapterRegistry (ADR-0004) is historical; not the Browser product path.
