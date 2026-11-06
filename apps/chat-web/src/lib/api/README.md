# Session HTTP client (M4)

Default: same-origin `/v1/*` via Vite proxy → loopback `context-serve`.

- Live mode talks to Session HTTP. Ordinary chat never auto-saves a page.
- Explicit `?mock=1` keeps the old localStorage ChatCore + North Harbor fixture.
- API failure never silently falls back to mock.
