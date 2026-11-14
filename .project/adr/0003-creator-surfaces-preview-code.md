# ADR 0003: Creator surfaces and Preview / Code

- Status: Accepted in part. The WordPress embed composition is **superseded** by [ADR-0006](0006-browser-first-no-wordpress-runtime.md); the Latte CodePort is **superseded**: Code is generated Svelte UI8Kit source and the ZIP export ([ADR-0034](0034-page-spec-2-one-write-tool.md), [ADR-0008](0008-registry-single-source-of-ui.md)); the shell layout is refined by ADR 0017, 0024 and 0041
- Date: 2026-11-06
- Extends: [0001-cms-agnostic-chat-builder.md](0001-cms-agnostic-chat-builder.md)

## Context

ADR-0001 fixed a CMS-agnostic chat builder with one Page Store. It did not fix the **UI surfaces** (what the SPA draws) or the **two render ports** of one page: the Svelte preview and the code view.

The product is a turnkey landing page with a built-in chat, assembled **modularly**: not a ChatGPT clone, not a Lovable canvas with containers. The shell structure follows ui8kit/spline-svelte `BuilderScreen` (nav, chat, workspace with Preview and Code); the **paint** is UI8Kit / ui8px, shadcn HSL tokens, Istok Web and `rounded-default` (the spline skin is not copied).

## Decision

### Surfaces

| Surface | DOM | Role |
| --- | --- | --- |
| **ChatCore** | no | Session, messages, send. Logic only. Hosts never import DOM from here. |
| **ChatColumn** | yes | Thread and composer. |
| **CreatorShell** | yes | AppNav, top bar and Workspace. Composes the chat column. |

One `Block` per file and render path (UI8Kit rule 01). ChatCore is not a composition.

### Workspace is the current page

The Workspace shows the **current page** (its sections), not a Lovable-level builder (containers, an agent shell, an arbitrary canvas). The source of truth is the page document (ADR 0034).

### Preview and Code

Both are derived from the one page: **Preview** renders the blocks with the registry components (Svelte, UI8Kit); **Code** shows the Svelte source of the export. A divergence between them is a contract bug, not "two editors". The `PreviewPort.previewUrl()` of `packages/ports` (a CMS adapter's preview URL) is a different thing and stays.

### Paint vs structure

| Axis | Decision |
| --- | --- |
| Structure | AppNav, chat column, Workspace (Preview, Code). Below `lg`, tabs switch the chat and the workspace. |
| Paint | UI8Kit Svelte primitives, Istok Web, `rounded-default`, shadcn HSL tokens. No spline round-button skin, no Inter or kit radii from Figma. |

Figma remains a layout reference only (ADR-0001).

### Hosts

Browser SPA (`apps/chat-web`): the whole shell (active). Wails3 and Telegram Mini App would run the same SPA in a webview. The WordPress embed was removed (ADR-0006).

### Non-goals

- A Lovable-level canvas: containers, arbitrary hierarchy, an agent shell in the workspace.
- Copying `buildytech/vibecode` (Studio, Docker isolation, multi-tenant TEE) or the spline-svelte skin.

## Consequences

- `apps/chat-web` is built around CreatorShell.
- Preview and Code always show the one current page.
- ADR-0001 (Page Store, ordinary pages only) stays in force.
