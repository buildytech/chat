# context-serve

Go service that will wrap and run the **context runtime (CR)** used by SI Chat (see fastygo-context / FastyGo).

## Status: stub

- Module path: `github.com/buildytech/chat/services/context-serve`
- `main.go` exits successfully and prints that the CR is not wired yet.
- Local stack: [deploy/compose](../../deploy/compose/docker-compose.yml) will run this next to the Agent SDK orchestrator.

## Planned role

1. Load site/page context for the orchestrator (CatalogPort / PagePort reads).
2. Stream retrieval results into Agent SDK tools.
3. Stay CMS-agnostic: WordPress and FastyGo talk through adapters, not this binary.
