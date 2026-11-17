# ADR 0058: Object-only field edit and repair pilot

Accepted, 2026-11-17. Policy page-agent/13.

Register page.edit-fields@1, block.props@1: Build-only, one selected existing block, only the canonical write_page tool, three logical attempts/five requests. A preview action explicitly selects this profile and Build mode; ordinary scope selection keeps existing behavior. The composer identifies the field-edit selection. Initial page composition remains on page.build@3.

The model receives the author's request, locale, selected block identity, exact props path and current model-view props (money in major units). A compact field outline is derived from the pinned schema; full Ajv schemas stay in the host. No page metadata, unrelated blocks, catalog index or conversation history is sent. Full schemas can be substantially larger than their useful field outline and are not assumed to save tokens.

Output is exactly one write_page call containing one replace operation on that block's entire props object. The host refuses full pages, foreign paths, structural edits and extra calls. This is application-side protocol enforcement, not a claim of provider-native constrained decoding. The existing normalization, document/props/render gates, scope/collection checks, diff, baseRevision and author Apply remain authoritative.

An invalid selected props candidate is retained in model-view units for the next small request; it never becomes the applied page. The next prompt contains only that candidate, current bounded errors and the original request. The stable prefix/tool definition is retained, while chat/tool transcripts are not accumulated. Errors outside the selected block terminate the narrow operation instead of expanding its privileges. Identical failed candidates stop; usage, cancellation and runtime ceilings use shared execution.

Trace v1 adds retainedMessages and transcriptChange so replacement of repair context is replayable; appended messages and unchanged retries continue to work. Initial prefix bodies stay governed by includeBodies. No export schema or storage backend changes are introduced.

Validation covers schema failure then repair, two-message context, absence of unrelated/history markers, preservation of neighboring blocks and baseRevision, forbidden full/foreign writes, and preflight scope rejection. No live paid benchmark or token/cost reduction percentage is claimed from byte-size checks alone.
