# ADR 0011: Ask / Build chat modes and one shared agent tools file

- Status: Accepted
- Date: 2026-11-10
- Extends: [0004](0004-agent-runtime-adapters.md) (agent runtime), [0010](0010-props-schemas-program-gate.md) (props schemas)
- Owner: chat-first plan approved 2026-11-10 (step 2); WP FastY Builder (chaosbun#145, phase 4) reuses the tools file

## Context

The owner's exported session (2026-11-10) asked twice to "just talk, do not change the page, suggest 10 Features
blocks and explain". Both turns ran the page tool loop: the model was forced to call a tool on every step
(`tool_choice: required`, then a forced `propose_layout`), it called only `propose_layout`, and the chat showed the
program template "Proposal ready ... Apply it" instead of any model text. The first turn ended with the page applied,
the second with a new pending proposal. The catalog has 8 Features variants; an honest answer says so, which needs a
text reply the chat could not show. Tool definitions also lived twice in the runtime (an OpenAI tool list and a
never-loaded AI SDK path with zod copies), so another host (the WordPress builder) had nothing to reuse.

## Decision

1. **The author picks the mode.** The composer has an Ask / Build toggle, stored on the chat (`ChatSession.mode`,
   default Build; a choice made on the home screen moves to the new chat). The host never guesses the mode from the
   author's words: there is no intent word list. `POST /runtime/v1/run` takes `mode` (`ask` or `build`; anything else
   is build).
2. **Ask is read-only by construction.** Only Ask tools are sent: `search_catalog` and `get_block` (one catalog
   block: title, registry item, every variant with the props that set it apart from the default, row and text fields
   from `props/v0.json`, the Stock link; no icon list). `propose_layout`, `edit_page`, `get_block_details` and
   `get_skill` are not in the request, and `executeTool` rejects any tool the mode does not offer
   (`tool_not_in_mode`) even if the model names one. `tool_choice` is `auto`; after the step budget one last step
   runs with `tool_choice: none` to get the answer. The model's final text is the assistant message, rendered as
   safe Markdown (parsed into tokens and rendered with kit primitives, never as HTML; links only http/https). The
   reply carries the catalog block specs the model read; the browser rebuilds the cards from its own bundled catalog
   and never trusts card data from the wire. Ask never touches the page store and never creates or supersedes a
   proposal.
3. **Build may talk.** Build turns run with `tool_choice: auto` (no forced tool). A turn that ends with text and no
   `propose_layout` / `edit_page` call is shown as text and creates no proposal. A real proposal keeps the program
   summary (Apply / Discard, catalog refs) plus the model's own text when it wrote any (`modelText`). Edit turns still
   offer only `edit_page` and `propose_layout`.
4. **Ask to Build.** Each Ask card lists the block's variants; pressing one ("Apply variant") switches the chat to
   Build and creates an ordinary page-patch/v1 `set_variant` proposal through the same `editPage` and browser gate as
   model edits (pending until the author presses Apply). No model call. Without a page, or when the page has no block
   of that kind, the chat says so and nothing changes.
5. **One tools file.** `packages/builder-core/src/agent/agent-tools.v1.json` (`format: buildy-agent-tools`,
   `version: 1`) defines every tool once: name, description (optionally per mode), JSON Schema 2020-12 parameters and
   the modes that offer it. Value lists that come from data are markers, `"x-buildy-enum": "catalog.section"` and
   the like (`catalog.section`, `catalog.job`, `catalog.industry`, `catalog.blocks`, `page.contentKinds`); the host
   fills them from its pinned catalog and strips every `x-*` keyword before sending (`agentOpenAiTools`). The runtime
   reads tools only from this file; the dead AI SDK path and its zod copies are removed. `ALLOWED_TOOLS` must equal
   the file's tool names (test). `AGENT_TOOLS_VERSION` is part of the contract fingerprint, so a tab built against
   another tools file gets `client_outdated`.

## Consequences

- The WordPress builder (chaosbun#145 phase 4) loads the same JSON, fills the same enum sources from its own pinned
  catalog snapshot, and sends tools per mode; tool search results and answers then match the chat.
- Upstreaming: the file is a candidate for `@ui8kit/contract` (published next to `page-spec` / `page-patch`
  schemas) once WP has consumed it. The contract repository is not changed by this ADR.
- Policy version is `browser-constructor/3`.
- Ask runs carry their own token usage like Build runs; without the page payload and catalog sources they cost less.
- Ask needs the live runtime; the local catalog assembler (dev only) cannot answer questions.
