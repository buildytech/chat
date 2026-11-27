# ADR 0070: Design mode and per-project Brand Skins

Status: accepted (2026-11-27). Owner request t237u.

## Context

Skins were a preinstalled registry list plus one browser-wide Custom Skin slot (ADR 0025). The owner asked for a Design
mode: a taste agent that composes a unique brand style and fonts, in practice a brand brief and design tokens.
ui8kit/brand-os is a compiler/verifier (no LLM, no taste), so Chat implements the agent and a host validator; the
full emit/verify CLI stays for VibeChat.

## Decision

1. **Fourth composer mode.** Ask / Build / Media / Design. Design is not an AgentMode: the session `mode` enum stays
   `ask | build`. The choice is `ext.design.active` of the project, the same way Media uses `ext.media.active` (ADR 0060).
2. **Taste agent.** Design produces a brief (subset of brand-os `brandThesis` / `designGrammar`: thesis, positioning,
   what-not-to-be, voice, form and image grammar) and a magazine-theme v2 config. It works from a base registry skin
   plus its own palette and fonts (Stock model). Fonts are only `THEME_FONT_IDS`; radius is only `RADII` (0, 4, 8, 12, 16).
   Palette contrast is WCAG 2.2 AA at minimum.
3. **Host validator.** The browser (and the Design turn loop) run `importThemeConfig`, ported brand-os contrast math
   (commit f0250f0, MIT) and brief completeness signals (slop heuristics). On failure the host writes nothing and
   returns issues to the agent for a retry, like `write_page`. At most three attempts.
4. **Brand Skins are per project.** A successful proposal, or a Settings import, is stored in `ext.design.skins` of
   that project (not the shared `buildy:v1:customSkin` slot). The legacy slot is migrated into the current project and
   into any project whose `skin` is still `custom`, then cleared so skins do not leak across projects.
5. **Project Skin selector.** The preview header lists the default theme, a Brand Skins group (this project only), and
   the registry kit skins. `session.skin` holds a registry id or a Brand Skin id (`custom` for an imported theme,
   `brand-*` for Design). A later "top 15 popular skins" trim of the kit list is not built here and is not blocked.
6. **Exports.** Preview, the Svelte ZIP and the templ ZIP wear the project's chosen Brand Skin the way ADR 0025 wore
   a Custom Skin (templ: `:root` in `ui/styles/theme.css`, no inline styles; font URLs in the manifest only). An
   optional `brand.contract.json` (brand-os schema 1.0.0) is saved as a VibeChat seed; Chat still applies the theme
   through magazine-theme / CSS variables.
7. **Session schema.** `ext.design` fits the existing open extension object (`additionalProperties`). A formal
   `$defs/designExt` in `session-v2.schema.json` waits on a `@ui8kit/contract` bump: the vendored schemas in this repo
   must stay byte-identical to contract 0.5.0.

## Consequences

Design turns use `POST /runtime/v1/design` on the web hosts (node, vercel). The desktop host is not required to
implement that path in this change; a 404 is a failed turn, not a silent write. brand-os `emit` / `verify` stay out
of Chat.
