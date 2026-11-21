# ADR 0065: One frontend, a runtime HTTP contract, a Go desktop host

Status: accepted, 2026-11-22 (owner t127u, t127s644).

## Decision

1. **One frontend, maintained here.** `buildytech/buildychat-desktop` is a Go / Wails 3.1 app, not a fork of the UI. It takes `buildytech/chat` as a git submodule pinned by commit, builds the same `apps/chat-web` static site and embeds it. The catalog, prompts, schemas, fixtures and agent loop remain single-sourced here. This supersedes the `adapters/wails3` location in ADR 0007 (the one-product / one-catalog decision stands).
2. **The same HTTP contract.** Wails' asset-server middleware answers `/runtime/v1/*` in process, on the app's own origin (no TCP port). The web app's `fetch` calls stay the same. `contract/runtime-http` holds the hand-written cases and generated constants/pictures; every host runs its own runner against them. The cases are seeded from the existing media, provider and gate tests, not replacements for those tests.
3. **Optional capabilities of `/v1/status`.** `capabilities.schema.json` documents `loop: "server" | "client"`, `files: boolean`, `saveFile: boolean`. The web hosts never send `capabilities` (tested), so the web app keeps its server loop. The desktop sends it (initially `loop: "client", files: false, saveFile: false`; the latter two become true only when implemented).
4. **Desktop loop in the webview (phase 2).** The same TS loop and gates run in the webview. Go only adds the keychain key on a narrow provider forward. A render probe cannot be ported to Go: it renders the compiled Svelte registry components. The client loop must use the same strict render probe as the server (the Inspector's probe allows empty blocks). Replay fixtures must yield equal proposals on both paths before this is enabled. The Chat Completions → Responses migration, if any, happens once in provider-xai, not separately in Go.
5. **Phase boundaries.** Phase 0 here: contract cases, constants generator (`npm run contract:runtime`), TS runner in its own tests.json group, this ADR. No web behavior change. Phase 1 in the desktop repo: shell, status, keychain, headless build, Go status cases, CI. Phase 2: loop switch in chat and the Go provider forward. Phase 3: Media, durable local pictures and WebP. Phase 4: native ZIP save and the five-page exam.
6. **Key.** The owner supplies XAI_API_KEY, kept in the OS keychain (env fallback in dev), never in the webview. No multi-tenant auth and no CLI mode.

## Consequences

The second host does not duplicate the agent, prompts or frontend. It must preserve the status readiness and discovery behavior (including HTTP 200 with `ready: false` when a key is present but discovery failed). Phase 1 advertises the future loop location but does not run a live turn yet. A submodule update is the only way the desktop app receives chat changes; its gate runs the cases from that exact pin. The generated `constants.json` is checked against TS sources and `contractFingerprint()` by the TS runner, and also stamps the desktop status.
