# Agent plane (stub)

Not wired. See [ADR-0004](../../../../../.project/adr/0004-agent-runtime-adapters.md).

- Chat UI talks only to Agent Gateway (Contract v1) once it exists.
- Default adapter: `context-local`. Opt-in VPS: `agent_runtime=cursor-sdk` + `CURSOR_API_KEY` + `local: { cwd }` — do not implement here.
- Branch the UI on **capabilities**, never on runtime id.
- Preview/Code stay on the Page Store plane. No Docker socket on the API in P0.
