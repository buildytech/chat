# ADR 0029: Page slug and standalone preview address

Status: accepted (2026-11-12).

Site edits the existing Page DTO slug. No session or Page schema change: the canonical contract already stores a single segment (lowercase ASCII letters, digits, hyphens, at most 48 characters). Host routes build, preview, runtime and api are reserved. Nested paths are out of scope.

Enter validates and commits the visible page (pending candidate, otherwise applied) through the page store and inspector history. An unchanged slug is a no-op. Escape cancels. Invalid input reports a field error. One committed change is one undo step and, for an applied page, one revision.

External preview opens /<slug>?preview&session=<id>; /preview?session=<id> remains supported. The session id selects browser-local content; the slug is its readable address, not a global lookup key. An outdated slug is canonicalized with replaceState. Missing or unknown sessions never select another chat. Preview reads only; existing storage migration remains the sole permitted exception.

URL generation accepts the configured app base for future hosts, including a WordPress plugin bundle. This does not implement WordPress routing, publishing or shared storage. Links require the session in this browser. A CMS host will own deployment rewrites and global uniqueness policy. Duplicate slugs across sessions remain unambiguous because the session id is required in friendly preview links.

Static hosting must retain SPA fallback (200.html; existing Vercel rewrite). Friendly routes accept the preview flag and session; other catch-all requests return 404.
