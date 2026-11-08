# adapters/wails3

Desktop shell for SI Chat using [Wails v3](https://wails.io).

## Status: stub

`go.mod` is a module placeholder (`github.com/buildytech/chat/adapters/wails3`). The webview will load the same `apps/chat-web` SPA (history sidebar + composer) and call PagePort via local HTTP or Go bindings.

Not wired in this scaffold. Do not implement desktop here until the Browser product works ([ADR-0007](../../.project/adr/0007-one-buildy-three-hosts.md)): same SPA, same pinned Stock snapshot, not a second catalog.
