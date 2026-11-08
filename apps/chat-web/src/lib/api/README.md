# Session HTTP client (optional)

Default Creator path does **not** use this client. Mock ChatCore is localStorage.

- Opt-in `?live=1` talks to same-origin `/v1/*` via Vite proxy → loopback `context-serve`.
- Ordinary chat never auto-saves a page.
- API failure never silently falls back to mock.
