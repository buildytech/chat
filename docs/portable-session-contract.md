# Portable session contract before IndexedDB

Normative application profile, 2026-11-17. The published `buildy:v2` session schema (`https://schema.buildy.tw/session-v2.schema.json`, @ui8kit/contract 0.5.0) is the wire contract; `buildy:v1` files and stored chats are no longer read (they fail the schema and go to quarantine). Do not hand-edit vendor schemas or encode storage-engine keys/transactions in the exported document.

## Storage-independent records

- `sessions[].id` is the session identity; `projectId` identifies its page record when different.
- `page` contains the current applied/candidate/lastProposed record, revision and provenance. This pass does not replace page documents with patches or references.
- `ext.chat` follows the pinned contract, including its existing messages and usage fields. Adding `chat/1` or `message.run.attemptId` requires an upstream contract change; neither is silently added here.
- `ext["agent-runs"]` maps attempt IDs to `run-attempt/1`. `userMessageId`, optional `assistantMessageId`, `runId` and `retryOf` are logical links, not database primary-key implementation details. Retry reuses its original user message. A normal repeated utterance is a new message.
- `ext["agent-trace"]` maps server run IDs to `run-trace/1`. Detailed or explicitly summarized records are valid application states. Attempts retain usage, billed ticks/unknown, fingerprint and gate codes after detail pruning. Legacy traces without attempts retain usage in their summary.
- Unknown extensions and unknown trace versions are carried through unchanged. No migration fabricates missing attempts, usage or bodies.

## Diagnostic size records

`attempt.storage`, format `run-storage/1`, captures run trace size, project size and global observations once on a completed host attempt with an observed trace. Measurements are taken before current-save metrics and retention; they remain historical observations for Lab growth charts. `trace.storage` in a compacted trace retains its pre-compaction sizes. `ext["agent-storage"]`, format `agent-storage/1`, reports the latest save projection, coverage and whether the soft budget remains exceeded.

`jsonUtf8Bytes` measures UTF-8 JSON serialization. `estimatedUtf16Bytes` estimates two bytes per UTF-16 code unit; origin totals include keys and values, replacing the old sessions value with the candidate serialized sessions. These are not the browser's actual quota counters. Project size excludes its own current diagnostic record; origin measurements are taken before replacing current metrics. Measurements are not self-inclusive fixed points. Foreign key names and values never enter diagnostics. Unavailable origin enumeration is explicitly reported; it is never treated as zero.

## Retention

Policy v1 lives in one constant: at most 20 detailed completed traces across all projects, 1 MiB serialized trace JSON, and a 4 MiB estimated UTF-16 origin soft limit. The latter includes pages, quarantine, preferences and foreign keys. Oldest known completed traces are summarized first. Running traces, unknown formats, messages, pages, history and foreign data are preserved. Summaries may themselves eventually exceed the budget; `budgetExceeded` reports this rather than deleting audit totals.

The generic project store invokes module-owned retention before saves. It updates in-memory records to the compact projection only after successful persistence. A quota failure retries with all eligible known details summarized. If that also fails, the original in-memory data and the existing storage error remain available. Export with `includeBodies: true` cannot restore pruned details; `retention` states why and when they were removed.

## Migration acceptance

Before introducing IndexedDB, keep the export/split/rebuild roundtrip test green. The future migration must compare parsed portable documents before and after copying into session/page/attempt/trace stores, preserve IDs and unknown extensions, and check that billing totals and links match. Compare objects, not JSON property order. Freeze `exportedAt` and app metadata for exact fixture comparisons; real host/build timestamps may differ. Historical diagnostic records must survive migration unchanged. Do not run retention while verifying an exact migration copy.

Write and verify the target before changing the active backend. Keep the source until the verified target is committed. Failed writes, interrupted migration and quota failures must leave a recoverable source. IndexedDB implementation is a separate stage; this pass adds no new backend.
