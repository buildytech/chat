# orchestrator

Agent SDK TypeScript bot (`@grok/agent-sdk@0.6.0`) that will sit between chat-web and the Page Store.

## Status: stub

This folder is a **scaffold**. It does **not** require live Cursor/Agent SDK keys to exist in the monorepo. Do not run model turns until credentials are provisioned.

When ready:

```sh
cd apps/orchestrator
npx --yes @grok/agent-sdk@0.6.0 init
npx --yes @grok/agent-sdk@0.6.0 validate
```

Use Node 22.13+, never Bun. Evals belong at `evals/` of this project, not `bot/evals/`. See the Agent SDK project layout.

`bot/instructions.md` is a placeholder identity for the future website-builder agent.
