# 0048. Icon names: old Lucide names map, an unknown icon does not fail a page; a failed turn keeps its last rejected write

Status: accepted (owner bug report 15.11, f036216)

## Context

A Build turn "birthday site for my brother" ended with `write_stuck` and an empty page. A headless run of the same prompt (2 of 6 runs) showed the cause: the
model wrote the icon `smile` in a required `quotes/mark`. Lucide 1.x renamed it to `face-slightly-smiling` (`smile` is an alias), the registry's `lucideIcon`
enum lists canonical names only, the gate rejected the write, and the model sent the same page again. The session export held neither the document nor the
errors, and the chat said only `(write_stuck)`.

## Decision

1. **Old Lucide names map.** `scripts/lucide-aliases.mjs` writes `catalog/lucide-aliases.json` from the aliases of the pinned `lucide` package (key: the alias
   without separators and case, value: the published name; `npm run icons:aliases`, checked by `npm run check`). `resolveIconName` uses it before the typo match.
2. **An icon that matches nothing no longer fails the page.** An optional icon is dropped, a required one takes the icon the block's sample props have in the
   same field; both are noted in the write's warnings. With no sample icon the gate still rejects the path and names the nearest real icons.
3. **Diagnostics.** A failed turn (`write_invalid`, `write_stuck`) names the first reason in plain words of the interface language (`run.reason*` messages, no
   model-facing text). The last rejected write (first five issues, the document, or the block of the first issue when the document is over 24k characters) is
   kept in `run.rejected` of the assistant message (contract session 1.11.0, additive, open object; no prompts, no keys).
4. **Images.** (Superseded by ADR 0049.) No registry block has an image URL prop (photo slots are placeholders the host renders), so a request to "replace placeholders with stock photos"
   cannot be met; the Build prompt says so (never invent image URLs, never claim photos were added).

## Consequences

The pinned `lucide` version and the registry's enum must stay in step (the check regenerates the table from `node_modules`). A model that writes a real but
unpublished icon gets a sample icon instead of a repair round.
