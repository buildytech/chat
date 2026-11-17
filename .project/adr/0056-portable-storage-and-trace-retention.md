# ADR 0056: Portable contract, Retry identity and global trace retention

Accepted, 2026-11-17.

Keep the portable session contract independent of localStorage/IndexedDB. Freeze the current application profile and roundtrip invariants in `docs/portable-session-contract.md` before replacing storage. The pinned vendor schema remains unchanged; page snapshot references, `chat/1` and attempt references in message.run require a separate contract stage.

Explicit Retry reuses the original user message and mode, and creates a fresh attempt linked by retryOf. Conversation construction excludes the current user message by ID, not by assuming it is the last row. Normal repeated text remains a new utterance.

Retention belongs to the chat module through a generic project-save projection hook. Its budget covers all projects and estimates the whole origin, including non-BuildY keys without recording their identities. Limit known completed trace details by count, serialized trace bytes and a conservative global soft limit. Preserve usage, exact billed ticks or unknown, model/provider, fingerprint, gate codes, logical links and explicit retention state. Do not silently prune pages, messages, history or unknown extensions.

Historical per-run size observations and current project/origin observations are exported for Lab. UTF-8 JSON sizes and estimated UTF-16 storage costs are distinct, with explicit measurement bases. Estimates are not browser quota guarantees. Apply compact projections to memory only after successful persistence; retry quota failures with more aggressive detail compaction.

Validation covers Retry identity and context, cross-project count limits, global foreign-key pressure, a single oversized trace, immutable input, exact billing preservation, unknown-format preservation and portable export/split/rebuild equivalence. Full gate remains required.
