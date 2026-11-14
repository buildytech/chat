# ADR 0005: Historical CR + lexproto/Jev gate scheme (withdrawn)

- Status: **Withdrawn**. It was a "future design only" record and was never implemented. The services it described (the Session HTTP, the Context Runtime client, the `lexproto` adapter stub, the Latte CodePort) no longer exist in this repository
- Date: 2026-11-06
- Related: [0004](0004-agent-runtime-adapters.md) (superseded), [0006](0006-browser-first-no-wordpress-runtime.md)

## What it recorded

An unverified, historical account of an earlier prototype that wired a deterministic Context Runtime (`github.com/fastygo/context`), a local typed Question/Decision protocol ("lexproto") and a model adapter ("Jev"). The exact schemas were lost. The public `github.com/fastygo/lexproto` repository was only a documentation stub, so BuildY shipped the adapter as `Unavailable` and never flipped a `lexproto` capability.

## Why it is withdrawn

The product moved to one protected runtime (`apps/xai-runtime`) with schema-checked tools and a rendered-DOM render probe for self-correction ([ADR 0011](0011-ask-build-modes-shared-agent-tools.md), [ADR 0018](0018-build-self-correction.md), [ADR 0034](0034-page-spec-2-one-write-tool.md)). Nothing in the repository depends on lexproto, the Context Runtime or Jev, and the supporting status docs were deleted with the dead services.

## If it is ever revisited

Start from a published, recoverable protocol and a pinned client, not from this record. Keep the distinctions it insisted on: a model adapter is not the protocol, and a checksum proves integrity, not truth.
