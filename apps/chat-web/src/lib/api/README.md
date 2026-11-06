# Mock session API

ChatCore lives in `src/lib/chat-core` (ADR-0003). This folder re-exports the mock for older imports.

- Sessions persist in `localStorage` (`buildytech-chat-sessions`).
- Assistant replies acknowledge an ordinary page + unique slug.
- No orchestrator, WordPress, Agent Gateway, or `@cursor/sdk` keys (ADR-0004).
