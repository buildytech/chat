# BuildY Chat

Build websites through AI chat and visual editing, using UI8Kit components and exportable Svelte code.

BuildY Chat is a browser-first creator built with Svelte 5 and TypeScript. Browse the Stock catalog, assemble a page,
edit schema-backed fields in the inspector, and use Ask or Build chat for model assistance. Chats and pages are saved
in the current browser; a protected server runtime provides optional live Grok access.

**In development.** The hosted chat is not ready for public use. Its planned address is `https://chat.buildy.tw`;
this is not an available demo or a launch announcement.

- [BuildY](https://buildy.tw) — project website.
- [UI8Kit](https://ui.buildy.tw) — available components.
- [Discussions](https://github.com/buildytech/chat/discussions) — questions, ideas and feedback.
- [Issues](https://github.com/buildytech/chat/issues/new/choose) — reproducible bugs and concrete proposals.

## What works today

- Browse blocks/screens, filter results, start a page and add/reorder sections without a model call.
- Edit schema-backed fields, undo/redo, and switch between explicit Ask and Build modes.
- Preview device widths, open a clean preview, inspect generated Svelte source and download a ZIP.
- Choose a page skin, import a compatible custom theme, and export/import portable browser sessions.
- Connect the optional protected xAI runtime with a server-side API key.

Catalog availability depends on renderers and schemas. Browser storage belongs to the current browser profile;
export a session file for a portable copy. Persistence and live inference are separate features.

UI refinement follows [ADR 0028](.project/adr/0028-chat-ui-refinement.md) and its
[plan](docs/plans/chat-ui-refinement.md). Desktop and WordPress hosts are later work under
[ADR 0007](.project/adr/0007-one-buildy-three-hosts.md); this repository implements the Browser application.

## Run locally

Requires **Node.js 22.x**, npm and Git. From the repository root:

```sh
git clone https://github.com/buildytech/chat.git
cd chat
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). No model key is required to browse the catalog and
assemble/edit pages locally. Live inference requires the optional runtime.

```sh
npm run verify          # tests, svelte-check and static build
npm run registry:check # offline registry snapshot verification
```

The static SPA is written to `apps/chat-web/build/`. See the [runbook](docs/runbook.md).

### Optional live Grok

Set `XAI_API_KEY` in the server environment, then run:

```sh
npm run start --workspace=@buildytech/xai-runtime
```

The SPA does not contact `/runtime` until you send a message. Vite (dev and preview) then proxies `/runtime` to `127.0.0.1:18100`. If that process is not running, the proxy returns JSON 503 instead of failing the page load. Keep credentials server-side. Non-loopback access requires Basic Auth.
See [runtime setup](docs/xai-grok.md) and [protected deployment](docs/deploy-xai.md). Provider charges may apply.

## Project structure

- `apps/chat-web` — browser application, shell and editor.
- `apps/xai-runtime` — optional protected runtime.
- `packages/builder-core` — catalog, assembly, edit gates and agent tools.
- `packages/page-contract` — page and portable-session contracts.
- `packages/ports` — framework-neutral ports.
- `registry/svelte` — generated, pinned UI8Kit CLI snapshot; never hand-edited.

[Architecture](docs/architecture.md) · [Decisions](.project/adr/README.md) · [Agent instructions](AGENTS.md)

## Participate

We welcome bug reports, testing, UX feedback, documentation suggestions and translation feedback.
**Pull requests are not accepted at this stage.** Maintainers implement changes after discussion; please do not open
PRs or send unsolicited patches. This keeps review manageable while the architecture evolves.

Read [Contributing](CONTRIBUTING.md), [Support](SUPPORT.md), and the [Code of Conduct](CODE_OF_CONDUCT.md).
Report vulnerabilities privately through [our security policy](SECURITY.md).

## License

Copyright BuildYtech. Licensed under [Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
