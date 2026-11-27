# Style sources

- `kit.css`: copied from UI8Kit (`ui8kit/site`, MIT License, UI8Kit). Do not edit;
  replace it as a whole when the kit is updated.
- `theme.css`: shadcn/ui neutral theme tokens (MIT License), written as `hsl()`.
  Change colours here, never in templates.
- `fonts.css`: self-hosted `@font-face` for Istok Web (SIL OFL 1.1, files and
  licence in `internal/web/static/fonts/`). No runtime font CDN.
- `app.css`: the Tailwind v4 entry. `make css` compiles it into the committed
  `internal/web/static/app.css` with the Tailwind standalone CLI (no Node).
