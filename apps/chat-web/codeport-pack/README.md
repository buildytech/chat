# CodePort Latte runtime pack

Templates required to **compile** exact `latteFromPage` / CodePane ZIP output with PHP Latte 3.

| Path | Role |
| --- | --- |
| `Main/page.latte` | Layout referenced by `{layout 'Main/page.latte'}` in emitted `page.latte` |

Packaged into downloads via `packFilesFromPage` under `runtime/` (see GENERATOR.json).

## Smoke

```sh
npx tsx scripts/m5-codeport-latte-smoke.ts
```

Uses Session Page Store DTO/rev (default `page-5975af4003592b2c` rev1), exact `latteFromPage` + `packFilesFromPage`, PHP Latte 3 compile with `Main/page.latte`, semantic check of dish blocks.
