# Intent

BuildY Chat is a browser-first website builder: assemble a page from the pinned Stock catalog (UI8Kit registry blocks), edit
schema-backed fields in the Inspector, and ask or build with a model (Ask / Build chat). The page is one document
(page-spec 2.0, [ADR 0034](adr/0034-page-spec-2-one-write-tool.md)) that exports as Svelte code and a ZIP identical to what
`npx ui8kit add` installs. CMS-agnostic: ordinary pages (`page` + unique slug), no checkout, payment, fabricated promo or stock,
no multilanding or UTM.

**Creator:** the shell (nav, left panel with Blocks / Sections / Chat tabs, preview, inspector slide-over) is the core; the chat is
an optional module behind a `BuilderModule` port ([ADR 0041](adr/0041-chat-as-optional-module.md)): `VITE_MODULE_CHAT=0` builds the
page builder with no trace of it. The browser keeps projects and chats under `buildy:v1:*` ([ADR 0015](adr/0015-session-standard-buildy-v1.md)).

**Agent:** one write tool, `write_page`, behind a host gate (document schema, props schema, a renderer exists). The optional
protected runtime (`apps/xai-runtime`, server-side `XAI_API_KEY`) serves Grok models; nothing calls a model until the author sends
a message.

**Targets:** one BuildY product on three hosts (WordPress builder page, Browser, Desktop Wails3) sharing the pinned CodeGen-X Stock
catalog ([ADR-0007](adr/0007-one-buildy-three-hosts.md)). This repository ships the Browser host first ([ADR-0006](adr/0006-browser-first-no-wordpress-runtime.md)).
Wails3 is a later copy of the same core; WordPress is a separate runtime.

Figma is a layout reference only. Copyright **BuildYtech**, Apache-2.0.

See [docs/architecture.md](../docs/architecture.md), [docs/plans/one-buildy-three-hosts.md](../docs/plans/one-buildy-three-hosts.md),
[adr/](adr/README.md).
