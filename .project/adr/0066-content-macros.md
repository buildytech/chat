# ADR 0066: Content macros ({year}) and the author's date

Status: accepted, 2026-11-22 (owner t134u: "с {year} верное решение … начнем с года").

## Context

Exported pages showed a stale "© 2025": the agent wrote a year number into the copyright line, and nothing in a page can
change after it is written. The WordPress builder (wp-fasty, `WPFastyBuilder\Links`) already resolves tokens in string
props (`{year}`, `{today}`, `{site:name}`, `{page:<slug>}`, …) when a block renders. The chat had no such mechanism, and
the agent had no idea what the date is.

## Decision

1. **One registry, one syntax.** `packages/builder-core/src/page-doc/macros.ts` holds `MACROS` (a name, a description
   for the prompt, a value function). The token syntax is wp-fasty's: `{name}` or `{name:argument}`, lowercase name.
   The first macro is `{year}`: the four-digit current year, read in the local time zone of the host that renders. It
   takes no argument (`{year:…}` stays as written). New macros (`{today}`, site data) are one entry plus a test, and the
   names follow wp-fasty's where the meaning is the same. The code is not shared with wp-fasty (PHP vs TS; its tokens
   depend on WordPress data).
2. **Expanded by the render, kept in the document.** `renderBlock` expands every string of the effective props, so the
   preview, the code pane, the ZIP export (its sections carry the props `renderBlock` returns) and the render probe of
   the server and the webview loops show the same text and the same DOM. The page document, the inspector and the
   session file keep `{year}`. An exported ZIP is static: it carries the year of the export; exporting again refreshes it.
3. **Unknown tokens are left as written, never rejected.** Only registered names are replaced; `{Year}`, `{site:name}`,
   `{}` or any brace text is shown as it is, and the strict render check does not judge it. Literal braces in copy (code,
   templates, a product name) are valid content, wp-fasty behaves the same, and rejecting would make the agent fight the
   gate over text it was asked to write. The cost: a misspelt macro shows its token; the prompt names the exact macros.
4. **The agent writes the macro.** The system prompt (`MACRO_RULE`, listed from `MACROS`) says to write the copyright as
   `© {year} Name`, never a year number. A scenario prompt that lacks it gets it appended (`systemText`).
5. **The agent knows the date.** The browser sends `today: { date: "YYYY-MM-DD", timeZone }` (its IANA zone, `todayIn`)
   with each turn; `mapChatRunRequest` keeps only a well-formed value; the system text ends with "Today is … in the
   author's time zone (…)" so prose never invents a year. Without it (an older client) the prompt stays the constant one.
   Server and webview loops read the same request body, so the replay parity holds.

## Consequences

- No catalog or dictionary text in this repository contains a year: the stale years came only from model-written copy.
  Pages written before this change keep their literal year until the author or the agent edits that line.
- The system prompt now changes once a day per time zone (the date line): prompt-cache reuse resets daily.
- The registry components are untouched; the macro is page data, the registry contract and ui8px rules are unaffected.

## Tests

`scripts/m4-api-tests/content-macros.test.ts`: substitution, unknown and argument tokens kept, deep props, renderBlock vs
the document, the exported section, the prompt rule, the date line and its time zone, the request parsing.
