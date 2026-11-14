# ADR 0041: The chat is an optional module behind a `BuilderModule` port

Status: accepted, 2026-11-14. Owner decision: plan item 5 of `docs/plans/refactor-2026-11.md` (audit A-03, A-05, A-06, half of F-01).
Builds on ADR 0040 (project vs `ext.chat`).

## Context

The page builder (Blocks feed, Sections, Inspector, Preview, Code, export) imported the chat module concretely in 16 files, so it could
not be built, shown or tested without the chat, and the agent, model and usage code sat in the page core (`builder-core`).

## Decision

- Packages: `@buildytech/chat-agent` holds the agent turn and tools, models, usage, xAI env, protect, redact and the contract
  fingerprint (A-06); `builder-core` is the page and catalog core again.
- Layout: `apps/chat-web/src/modules/chat/` (`core`, `ui`, `browser`, `api`, `agent`, `i18n`, `chat.css`, `index.ts`) is the module;
  `src/lib/modules/` is the port and the host side (`types.ts`, `registry.svelte.ts`, `workspace.svelte.ts`); `src/modules/index.ts`
  is the one place the app names a module.
- The port, `BuilderModule` (`lib/modules/types.ts`), is data plus hooks: message catalogs (own keys, and `overrides` that re-word core
  keys while the module is loaded), the project extension keys (`ext.<id>`) and a normalizer, a new-project default, left-panel tabs
  and the names of the left panel, slots (`preview.review`, `block.actions`, rendered by `ModuleSlot`), hooks
  (`beforeProjectChange`, `projectOpened`, `beforeHydrate` / `afterHydrate`, `pageStarted`), `hasActivity`, `editorMode`,
  `startPageFromScreen`, session-file `sessionSettings` and extra import file kinds. The core asks the registry and gets the
  builder-only answer when nothing is registered.
- The workspace controller (`lib/modules/workspace.svelte.ts`) owns open, new, delete, import and URL selection of projects and emits
  the hooks; the chat stops a run and reloads its context in them. The shell, the sidebar (a project list), the Blocks feed, the
  Inspector and the buildy API use it and know no module.
- The flag: `VITE_MODULE_CHAT` (12-factor, default on; 0, false, off or no turns it off), parsed in `apps/chat-web/module-flags.ts`,
  turned into the constant `__MODULE_CHAT__` by `vite.config.ts` (`define`), documented in `.env.example`. `modules/index.ts` loads the
  module with `if (__MODULE_CHAT__) registerModule((await import("./chat")).chatModule)` from the `init` hook of `hooks.client.ts`, so
  with the flag off the bundler drops the branch and the module is not in the bundle. The `/runtime` dev proxy and the `/build`
  alias (a param matcher, `params/collectionalias.ts`) exist only with the chat on.
- Project data: modules register their `ext` keys (`registerProjectExtension`) before the first load. Keys no module claims travel in
  `Project.extra`, so a project stored with the chat survives a load and a save with the chat off, byte for byte. A project made
  with the chat off has no chat keys.
- Gate (`npm run modules:check`, `modules:check:trace`, part of `verify`): the core imports no module and not the chat-agent
  package, modules import no other module, every message key has one owner and a module overrides only core keys that exist
  (`scripts/lib/module-boundary.mjs`, unit-tested on a fixture tree); the trace check builds with `VITE_MODULE_CHAT=0`
  (`BUILDY_BUILD_DIR`) and fails if any string only the chat uses (its message keys, texts and wording overrides, the string literals
  of the module and of the chat-agent package that no core source also uses) is in a file of the build; a control over the normal
  build proves the same strings are found when the chat is on.

## Consequences

- Core wording is neutral (project, page, builder) and the chat module restores its own words through `overrides`; the chat-on UI is
  unchanged, the chat-off UI says "project" and "SI Builder" (the product brand of a chat-less build is a decision to review).
- The composer CSS and the `selectedModelId` storage key (and its legacy key, `registerLegacyKey`) live in the module.
- What the core still knows about the chat, on purpose: the session document schema (`messages`, `mode`, `usage`, `selectedModelId`
  are keys of the session profile, so import validation and key order name them), the counter `proposalApplied` in the migration
  report (item 4 removes it), and the historical ids of the left column (`creator-chat-column`, the `chat` pane of the layout prefs,
  `data-action="chat-toggle"`): renaming them is a prefs migration, left as a later cleanup.
- A chat-off build ships the same `/runtime` rewrites in `vercel.json` and the `api/runtime` functions (deployment files, not the
  bundle); a deploy without the chat can drop them.
