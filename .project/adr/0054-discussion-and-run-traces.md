# ADR 0054: Read-only discussion and portable run traces

Status: Accepted, 2026-11-16.

Ask needs an actual discussion profile, not a prompt that recommends `write_page` while its tools are filtered. Add `page.discuss@1` with a dedicated prompt and read-only tool subset, register it as an explicit Ask scenario and retain existing defaults and profiles. Enforce the offered tool list at dispatch, so a provider cannot invoke a hidden writer. Discussion has no write-repair nudge.

Record `run-trace/1` at the shared loop execution boundary, one step per provider attempt and one result per dispatched tool. Export through the contract's existing open `ext["agent-trace"]` namespace, keyed by runId. Do not overload usage or modify the pinned vendor schema. Full bodies are omitted from normal browser exports; explicit `includeBodies` projects the stored trace with bodies. No credentials, headers or configured endpoint enters the recorder.

Record facts and unknowns: a proposal acceptance is not a page revision; byte size is not token usage; a stable context descriptor is not a cache hit; there is no aggregate token budget yet. Detailed field semantics and stateless cancellation limits are documented in `docs/run-trace.md`.

Validation includes a forged write in discussion, three rejected writes preserved as three gate events, default hash-only/body opt-in projection, and portable-session extension round-trip. Full repository gate remains required.
