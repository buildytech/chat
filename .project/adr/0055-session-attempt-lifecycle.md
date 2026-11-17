# ADR 0055: Host attempts and observed provider traces

Accepted, 2026-11-17.

An assistant message is not a complete ledger of work: preflight errors, browser exceptions, aborts and superseded sends may have no reply. Record a `run-attempt/1` in `ext["agent-runs"]` before asynchronous work. Attempts link user and optional assistant message IDs, optional server run ID, scenario/provider, lifecycle status, timestamps and observed usage. Explicit retries link through `retryOf`. The host must persist the initial attempt before dispatch; storage failure prevents provider work. Unknown extension versions remain opaque and prevent overwriting that namespace.

Statuses are running, completed, error, aborted, superseded and interrupted. A rehydrated running attempt becomes interrupted. Late results update their original attempt without replacing newer messages, creating proposals after cancellation, or recreating deleted projects. The ledger is independent of selection. Usage aggregation counts ledger attempts plus legacy message runs not already owned by an attempt. Failure status makes session usage incomplete even when some billed usage is known. Unknown cost never becomes zero.

`run-trace/1` stays in the separate `ext["agent-trace"]` namespace. The adapter supplies observed wire metadata (parallel calls, token parameter name and limit); the generic recorder does not infer xAI behavior from a version number. Missing metadata remains unknown. Trace steps and tool records have explicit TypeScript contracts. Calls skipped by the tool budget are recorded as skipped, not as executed. Search evidence retains real screen IDs, ranking and registry sections in hash-only exports. `answer.blocks` uses registry IDs; legacy Stock specs remain readable by card resolution.

New run usage uses neutral `reportedBy: "provider"` with optional profile-derived `providerId`. Legacy `xai-provider` records stay readable. Transport-specific decoding and credentials remain in provider adapters. Page tools, schema/render gates and registry vocabulary remain page-domain responsibilities, not a general agent framework.

No server database, telemetry, worker, provider cache promise or paid model call is introduced. This stateless server cannot send a final trace after the connection is lost. The host records that attempt and `traceState: not_received`; it must not invent server steps. Existing orphan messages are not retroactively given fabricated attempts.

Validation: lifecycle aggregation and malformed/unknown extensions, project view roundtrip, browser Ask/Build scenario serialization and trace retention, adapter-neutral observed metadata, zero-score search evidence, existing agent replays, and the full repository push gate.
