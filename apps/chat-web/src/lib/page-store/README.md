# Page Store (chat-web mock)

One Page DTO (`fixture.ts` → `mockLandingPage`) feeds Workspace BlockTree, PreviewPort (Svelte stub) and CodePort (Latte stub). ADR-0003.

Selection (`selectedBlockId`) lives next to the page in `mock.svelte.ts`. Hydrate / `setCurrentPage` / `selectBlock` run outside `$derived`. Preview and Code read the same tree and the same selected id.

Live CatalogPort / PagePort adapters are not wired. Do not import WordPress PHP here. The Latte string is generated from the DTO — not a compiler, not a second hand-edited source.
