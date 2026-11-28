# ADR 0073: The desktop host opens the standalone preview window

Status: accepted (2026-11-28). Owner request t276u.

Extends [0065](0065-runtime-http-contract.md) (the runtime host) with one endpoint.

## Context

"Open in new window" in the Preview pane called `window.open("/<slug>?preview&session=<id>", "_blank", "noopener")`. In the desktop app (Wails v3) the owner got `http://wails.localhost/home?preview&session=session-…` and the page did not open.

The address is right (the web app serves it, SvelteKit's `[...path]` route with `preview` and `session`, read from the saved sessions of the same origin). The window is what fails: in Wails v3.1.0 the asset server answers `wails.localhost` through a handler attached to the app's own webview. On Windows, `window.open` makes a WebView2 popup, a different webview with no such handler, so `wails.localhost` is not served. Wails v3.1.0 has no new-window handler there, and on macOS and Linux (WebKit) a popup that the application did not create is not shown at all.

## Decision

1. `POST /runtime/v1/preview-window` with `{ "path": "<in-app preview address>" }` makes the desktop host open that address in a second application window: same asset server, same webview data, so the preview reads the page from the same storage and follows edits (storage events). The window is named after the session; a second request raises it instead of opening another.
2. The host accepts only a preview address of this app (`/preview?session=<id>` or `/<slug>?preview&session=<id>`; a plain session id; no scheme, no host, never the runtime). Anything else is 422 `invalid_path`. The headless build has no window and answers 501 `unsupported`.
3. The web app asks the host when the status says it is a desktop host (`host.kind`), and falls back to `window.open` when the host cannot (501), fails, or the app is in a browser. Vercel and the node host are unchanged: they never get the request.

## Consequences

The window is created on the UI thread from a goroutine, not on the request's. The windows of the preview are ordinary app windows (the app menu applies). Closing the main window quits the app as before.

The live run found a second fault in the same window: it never hydrates the project store, so the Brand Skin of its session was never found and the preview showed the default look, not the project's skin. `storedCustomSkin(session)` now falls back to a read-only read of the stored project (`lib/project/stored.ts`); nothing is bound or written.
