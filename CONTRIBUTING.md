# Contributing to BuildY Chat

The Browser application is in development. Read the [README](README.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## Participate now

- Report reproducible bugs through [Issue forms](https://github.com/buildytech/chat/issues/new/choose).
- Propose a concrete feature, describe a UX problem, or suggest documentation and translation corrections.
- Help reproduce existing reports in another browser, viewport, theme or locale.
- Ask questions and explore early ideas in [Discussions](https://github.com/buildytech/chat/discussions).

Search existing reports first. Keep one issue focused on one problem. Remove credentials, personal data and private
conversation content from screenshots, logs and session files before sharing them.

## Pull requests are currently not accepted

Implementation is maintainer-led, with verified commits to `main`. Do not open PRs or send unsolicited code patches,
including AI-generated ones. Large volumes of generated changes are difficult to review safely while the architecture
is evolving. Reports and proposals are welcome regardless of whether AI helped prepare them: verify the facts,
identify generated reproduction material when relevant, and avoid duplicate or bulk submissions.

Maintainers decide scope and sequence; a proposal does not guarantee implementation. This workflow is not an additional
license restriction. The source remains under [Apache-2.0](LICENSE). Policy changes will be documented here.

## Reproduce locally

Use Node.js 22.x and npm from the repository root:

```sh
npm ci
npm run dev
npm run verify
npm run registry:check
```

Record the commit (`git rev-parse --short HEAD`), browser/version, OS, CSS viewport, zoom, locale, theme and pane state.
Include exact steps and expected/actual behavior. Local catalog/editor reproduction normally needs no live inference
or paid model call. For runtime-specific issues see [runtime setup](docs/xai-grok.md).

## Development boundaries

- Read [AGENTS.md](AGENTS.md), [UI8Kit rules](.cursor/rules/00-ui8kit-core.mdc) and relevant
  [ADRs](.project/adr/README.md). UI refinement follows [ADR 0028](.project/adr/0028-chat-ui-refinement.md).
- Use Svelte 5 runes and registry primitives. App components live in `src/app`; `src/lib` holds logic.
- Never hand-edit the installed registry or generated catalog snapshots; use the pinned generator workflow.
- Keep shell styles isolated from preview/export. Preserve schemas, gates and browser storage adapters.
- Never put credentials in client code or sessions. Do not hide check failures with skips or growing baselines.
- Published history is not rewritten; maintainer commit identity follows `AGENTS.md`.

Vulnerabilities belong in the [private security channel](SECURITY.md), not public issues.
