# Architecture Decision Records

Нумерация: `NNNN-kebab-title.md`. Номера монотонно возрастают, файлы не переименовываем.

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-cms-agnostic-chat-builder.md) | CMS-agnostic chat builder (dual builders + Page Store ports) | Accepted (WP embed host superseded by 0006) |
| [0002](0002-supply-chain-slsa.md) | Verifiable technical supply via SLSA-aligned CI | Accepted |
| [0003](0003-creator-surfaces-preview-code.md) | Creator surfaces & Preview/Code ports | Accepted (WP embed composition superseded by 0006) |
| [0004](0004-agent-runtime-adapters.md) | Agent runtime adapters & VPS cursor-sdk opt-in | Accepted |
| [0005](0005-contextly-historical-lexproto-cr-gates.md) | ContextlY historical CR + lexproto/Jev gate scheme (future only) | Proposed |
| [0006](0006-browser-first-no-wordpress-runtime.md) | Browser-first Creator; no WordPress runtime in this repo | Accepted |
| [0007](0007-one-buildy-three-hosts.md) | One BuildY product, three hosts, shared Stock | Accepted |
| [0008](0008-registry-single-source-of-ui.md) | The UI8Kit registry is the single source of UI | Accepted |
| [0009](0009-brands-in-codegen-x-single-registry.md) | Brands live in CodeGen-X; the published registry stays one | Accepted |

Status values: Proposed, Accepted, Superseded, Deprecated.

0003/0004 extend 0001 (surfaces + agent channel); they do not replace Page Store ports or SLSA.
0005 records a historical ContextlY gate scheme for future design only; it does not implement lexproto or change runtime defaults.
0006 removes the WordPress runtime from this repo and makes mock ChatCore the default start; optional Session HTTP stays non-default.
0007 records the product-level three-host strategy (WordPress builder page, Browser, Desktop Wails3) on one pinned Stock catalog. Browser first; Wails3 later, same core. Portable export / WP import / round-trip tests are planned, not implemented. 0006 still bans a WordPress runtime in this repository. Plan: [docs/plans/one-buildy-three-hosts.md](../../docs/plans/one-buildy-three-hosts.md).
0008 makes registry.buildy.tw/svelte the only source of UI: a pinned CLI snapshot (`registry/svelte`, sha256 lock), published variants, `lib` without components, a "not in the registry" stub instead of own layouts, and a ZIP identical to `ui8kit init` + `add`.
0009 records that brands (badge + filter) live in the CodeGen-X database, not as per-brand kits or author namespaces/URLs. Contribution is closed and trusted, through XGenBot and the generator; `registry.buildy.tw` publishes one cleaned `@ui8kit` registry, with brand visible as metadata. Chat and WP FastY Builder both snapshot that registry. Catalog data for WordPress, a CLI snapshot for the plugin, and the brand field remain open (WordPress to be discussed further).
