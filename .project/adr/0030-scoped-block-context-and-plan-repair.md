# ADR 0030: Explicit block context and local Ask plan repair

Status: accepted, 2026-11-12.

Service labels in Preview offer Add to chat / Remove from chat context on every top-level block, showing the stable Page block ID. The composer shows all chosen IDs and a clear action. Draft scope is held per chat in memory; reloading clears it. It is neither Page content nor a new persisted session field. Future image actions can use these same IDs; image generation is out of scope.

A nonempty scopeBlockIds request is a hard edit boundary. The request mapper, Ask and Build hosts carry it. Page-patch permits set, set_items, set_variant, replace and remove only on chosen IDs; page metadata, insertions and moves are rejected with outside_scope. propose_layout cannot bypass scope. Local Ask plan/card actions use the same gate. A client result check also rejects changes to unselected content and page metadata. Empty scope retains existing full-page behavior; no scope is inferred from prose.

Ask plans are checked sequentially on a temporary page, without writes. Invalid operations remain diagnostic rows; the card derives Needs repair, and program/UI block applying a plan with unresolved errors. unknown_variant exposes a registry Select of allowed values. A user choice rechecks the whole plan locally and persists the corrected plan using the existing session shape; no provider call, synonym, guessed default or extra endpoint. Apply in Build makes one pending proposal. At execution the selected operations are checked again on the visible page, so stale/dependent selections can be rejected with their reason.

Hide service labels in Preview also hides run/token/tool details, composer connection details, catalog diagnostics, feed notes and code service notes in the chat document. Error messages and confirmation actions remain. Explicit block-context chips stay visible so a restriction is never hidden. Exported source, Page data and stored usage are unchanged.

Catalog provenance uses actual catalogBlock for IDs, links, variants and registry renderer metadata. No new runtime service, worker, shell or image generation is introduced. This does not solve general factual accuracy of model prose.
