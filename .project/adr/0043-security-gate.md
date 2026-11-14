# ADR 0043: Secret scan, dependency audit and security headers are part of the gate

Status: accepted, 2026-11-14. Owner decision (t189u): security work next to the module and standards plan.

## Decision

1. **Secret scan.** `npm run secrets:check` (`scripts/check-secrets.mjs`) runs a pinned gitleaks release (8.30.1, sha256 checked, downloaded once into
   the git-ignored `.cache/gitleaks`; `GITLEAKS_BIN` overrides) over the full git history and over the staged changes. Output is redacted: rule, file, line,
   commit. `.gitleaks.toml` extends the default rules and lists the reviewed false positives with the reason. First run over 211 commits: 13 findings,
   all false positives (8 content hashes in `registry/svelte/ui8kit.lock.json`, the fake canary key of `logs-secrets.test.ts`, 4 uses of throwaway local
   credentials in two removed e2e scripts); no real credential in the history. A new finding fails `verify` and the push gate.
2. **Dependency audit.** `npm run audit:prod` = `npm audit --omit=dev --audit-level=moderate`: production dependencies, fail on moderate or worse (0 today).
   Dev-only findings (13: 6 low, 7 moderate in the SvelteKit 2 and typescript-eslint toolchains; every fix is a major upgrade) are not gated and stay listed in the audit.
3. **Headers.** `vercel.json` sends on every response: `Strict-Transport-Security` (2 years, subdomains, preload), `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment, usb, serial, bluetooth, interest-cohort off;
   the clipboard stays), `Content-Security-Policy: frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`. The page policy is a `<meta>` that SvelteKit writes
   into every page, the SPA fallback `200.html` included (`kit.csp`, mode `hash`): `default-src 'self'`, `script-src 'self' 'unsafe-eval'` plus the hash of the one inline
   bootstrap script (no `unsafe-inline`; `unsafe-eval` only because Ajv compiles the props schemas with `new Function` in the browser, found by the headless smoke), `style-src 'self' 'unsafe-inline'` plus Google Fonts (custom skins), `font-src` self, data and gstatic,
   `img-src 'self' data: blob: https:` (page content may point at images), `connect-src 'self'` (the app talks to its own `/runtime`), `object-src 'none'`,
   `base-uri` and `form-action` `'self'`. The preview iframes are same-origin `about:blank` documents and the render bundle is a same-origin module, so `'self'` covers them.
4. `security-headers.test.ts` pins the headers and the policy; the headless smoke of both builds checks the meta is on the built page and that nothing is refused
   (a refusal is a console error, which fails the smoke).

## Consequences

- Rich-text `__html` page content cannot run scripts (no inline script allowed). Inline `style` stays allowed because the kit and the preview set styles.
- Changing the bootstrap script needs no manual hash: it is computed per build.
- Not done: precompiling the props validators (Ajv standalone) to drop `unsafe-eval`; nonce-less `style-src` hardening, `Cross-Origin-Opener-Policy` (the `/preview?session` window relies on the opener), and `Access-Control-Allow-Origin: *`
  that Vercel adds to static assets (the assets are public).
