# Mock session API

`session.svelte.ts` is the offline stub backend used by `npm run dev`.

- Sessions persist in `localStorage` (`buildytech-chat-sessions`).
- Assistant replies acknowledge an ordinary page + unique slug.
- No orchestrator, WordPress, or Agent SDK keys.
