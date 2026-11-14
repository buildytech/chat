# ChatCore

Logic-only chat module (no DOM). The browser SPA talks to this API.

- Default: sessions / messages in `session.svelte.ts` (in-memory + localStorage). Delete and delete-all are local QA actions, not a remote Session API.
- The thread, composer and proposal UI live in `../ui`; the left panel mounts them as the chat tab (`ui/ChatPanel.svelte`, registered in `../index.ts`, ADR 0041).
- Live Grok turns: protected `/runtime` (xAI), not Session HTTP.
- Agent Gateway + AdapterRegistry (ADR-0004) is historical; not the Browser product path.
