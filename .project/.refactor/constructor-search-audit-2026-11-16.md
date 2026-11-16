# Audit of BuildY constructor block and screen search — 2026-11-16

Note: original Russian queries are transliterated, with the English meaning in parentheses.

Source: local copy `E:\_@Bun\@BuildYchat`, HEAD `502d881` + uncommitted docs (`.project/README.md`, `.project/.refactor/`).
Mode: read-only. Nothing was created or changed in the repository (`git status` before and after is identical).
Measurements were taken with a temporary script in `%TEMP%` (deleted) via `bun --no-install`; it only imports modules and calls functions.
Paths are relative to the repo root. Line numbers are at HEAD 502d881.

---------------------------------------------------------------------------------------------------
## 0. In brief

1. All catalog search is pure logic in `packages/builder-core/src/catalog/` with no chat or model dependencies (`packages/builder-core/package.json`: "No chat or model dependencies"). Data is bundled JSON, with no network at runtime.
2. The repository has two independent search algorithms. The agent's `search_catalog` searches only screens (weighted term index). In the UI, `stockSearch` searches blocks by substring and screens via the same index. The agent searches blocks only via `itemIndex` in the prompt and by exact name in `get_block`.
3. The screen term index is already precomputed and versioned (`search-index.json`, 148 KB, built by `npm run snapshot`, under lock). Blocks (items/variants) are not in it.
4. Main gaps: no block search for the agent, ru queries against block names find nothing, no diacritic or stop-word normalization, `itemIndex` sits at the end of the volatile user-prompt and does not land in the cacheable prefix, and `contractFingerprint` does not cover `sources.json` and `props.json`.

---------------------------------------------------------------------------------------------------
## 1. Where things are searched (trace)

### 1.1 Data (where the catalog comes from)

| Artifact | Path | Size | Contents |
| --- | --- | --- | --- |
| Source pin | `catalog/snapshot.config.json` | 1.3 KB | codegen-x/ui8kit commit `b616634…`, `ui8kit@3.5.0`, `https://registry.buildy.tw` |
| Graph (full) | `catalog/stock-registry.v0.json` | 1.87 MB | entities: screen 79, block 111, variant 526, item 360, props 116, facetValue 309, icon 1890, collection 89 |
| Snapshot | `packages/builder-core/src/catalog/snapshot.json` | 237 KB | 79 screens (`labels` type/site/section/job/blocks/industry, `layout[]` ≈5.5 slots), `blockIndex` 111, 526 variants |
| Search index | `…/catalog/search-index.json` | 148 KB | 1711 terms, 79 packed screens, vocabulary 12 facets (5 locales: en, fr, de, es, ru) |
| Registry sources | `…/catalog/sources.json` | 259 KB | blocks 112, assets 526, specs 111, items 360 |
| Props schemas | `…/catalog/props.json` | 374 KB | 116 items (JSON Schema + shared `$defs`) |
| Lock | `catalog/snapshot.lock.json` | 3.9 KB | sha256 of inputs and outputs |

How it is obtained: `scripts/snapshot.mjs:89-92` (network: `raw.githubusercontent.com/<repo>/<commit>/apps/stock/content/*` and `registry.buildy.tw/*`), `scripts/registry-snapshot.mjs:37-38,146-170` (`variants/v0.json`, `props/v0.json`). Then `buildGraph` → `stock-registry.v0.json` → `deriveSearchIndex` (`scripts/lib/catalog-graph.mjs:494-575`) → JSON artifacts. Offline check: `npm run snapshot:check`, `snapshot:derive` (`scripts/snapshot.mjs:11-13,176-187`).
There is no network at runtime. JSON files are imported at module load: `text-search.ts:1`, `snapshot.ts:1`, `sources.ts:7`, `props-schema.ts:12`. On Vercel all of this is baked into the generated bundle `api/runtime/v1/run.ts` (in git; for example `itemIndex` at :30481, `userPrompt` at :31688). After any index change the bundle must be rebuilt.

### 1.2 Agent: `search_catalog` (screens only)

`packages/chat-agent/src/agent/catalog-tools.ts`:
- `searchTool` `:114-154`. Input: `q` (≤200 characters), `site`, `section`, `job`, `industry`, `blocks[≤6]`, `page`, `browse`. Fixed `type:"screen"`, `supportedOnly:true`, `pageSize = RUN_BUDGET.toolPageSize = 4` (`packages/builder-core/src/policy.ts:15`).
- If a facet is unknown (`catalog_facet_unknown`), the facet is dropped and an error with `facetTree` is returned (`:130-137`).
- If `noFit`, `searchRelaxed` (`:52-74`) tries facet combinations in `RELAX_ORDER = industry, section, job, blocks, site`, dropping the fewest facets, and returns `relaxed.dropped`.
- Output `compactItem` (`:39-50`): `screenId, title, subtitle, sections[{item,variant}], labels{site,section,job,blocks}, score(round .1), matched, via, missingBlocks`. This is 4 screens per page.

Core `packages/builder-core/src/catalog/search.ts`:
- `searchCatalog` `:139-200`:
  1. `unknownFacetResult` `:66-91` and `unknownTermResult` `:93-114` — early replies from the vocabularies.
  2. `filterScreens` `:37-54` — linear scan of 79 screens, exact match via `labels.*.includes`.
  3. `blocks` — soft facet: `coverage` = how many requested labels are present (`:147-155`), sort `coverage desc → compareScreenSupport`.
  4. when `q` is present: `scoreScreens(q)` (`text-search.ts:63-81`) → filter "at least one term matched" → sort `coverage → score → compareScreenSupport` (`:157-164`).
  5. `renderableFirst` `:117-137`: non-renderable screens are replaced with "siblings" of the same `spec` with score×0.8 and `via`.
  6. pagination `:171-177`, `nearest` on an empty result, `suggested`, `clarification`.
- `facetTree` `:222-242`: counts over 5 facets, sort `count desc → localeCompare`.

Text layer `packages/builder-core/src/catalog/text-search.ts`:
- `queryTokens` `:37-46`: `toLowerCase`, split on `[^\p{L}\p{N}]+`, length 2–40, dedupe, at most 12 tokens.
- `termScore` `:48-58`: an exact match yields the term weight. Otherwise, if the token length is ≥4, prefix match in both directions (`term.startsWith(token) || token.startsWith(term)`), weight×0.5, linear scan of all terms of the screen.
- `scoreScreens` `:63-81`: sum over tokens; a screen with no matches is dropped; `unmatched` is used for suggestions.
- `nearestTerms` `:99-111`: Levenshtein (`distance` `:83-96`, length window ±2) over all 1711 terms for each unmatched token. This is the only fuzzy matching.
- Vocabularies: `vocabularyValues`/`blockLabelVocabulary` `:122-129` read `index.vocabulary`.

How weights are built (`scripts/lib/catalog-graph.mjs:523-552`): words from screen fields with weight `field.w`, `title` 6, `subtitle` 4, `spec` 3, `variant` 4, facet values 3, facet labels in all 5 locales 2, facet synonyms 2, block labels 3, `variant.title` 2, `variant.subtitle` 1, words from variant fields with `w≥3` 1. The build tokenizer `:486-491` (length 2–20) differs from runtime (2–40). Terms are packed as base36 indexes into one string per screen (`text-search.ts:23-33`).
The rule in the header of `text-search.ts:3-6`: "no handwritten keyword lists", everything comes from the catalog.

### 1.3 Agent: blocks (items) — `itemIndex` and `get_block`

`packages/chat-agent/src/agent/blocks.ts`:
- `itemIndex()` `:45-50`: one line per registry item, `item (title; variants[; header|footer])`. Source — `allItems()` (`packages/builder-core/src/page-doc/items.ts:54-56`: `Object.keys(catalogSources.blocks)`, filter `itemInfo≠null`) and `itemInfo` (`items.ts:31-51`, `Map` cache). Result: 112 lines, 526 variants, 7 487 B JSON (≈7 KB).
- Insertion into the prompt: `apps/xai-runtime/src/chat-prompts.ts:49` (`itemIndex: itemIndex()`), last key of `JSON.stringify` (`:40-50`). The system text refers to it (`:12`).
- `get_block` → `readBlock` `:100-131`, `resolveItem` `:53-59`. Accepts: exact item name, Stock spec `block.x`, or label `x` (via `itemOfSpec`, `items.ts:59-61`). Otherwise `unknown_item` and `near` (`:104-105`): item names that contain the needle or are contained in it, `slice(0,8)`. Titles, ru, spaces, and tokens are not supported.
- `readBlock` response: title, install, role, variants, `variantSets` (diff from default), `props` (`propsOutline` `:29-42`), `sample` (`convertProps`), icons, stockUrl, thumb. ≈2.1–2.7 KB per block.
- Page-document gate validation — `packages/builder-core/src/page-doc/gate.ts:77` (`unknown_item` + `similar`).

### 1.4 Pinned catalog facets / `x-buildy-enum`

`packages/chat-agent/src/agent/agent-tools.ts`:
- `agentEnumSource` `:41-56`: `catalog.site|section|job` ← `facetVocabulary()` (`search.ts:9-11`, from `snapshot.json`); `catalog.industry|blocks` ← `vocabularyValues`/`blockLabelVocabulary` (from `search-index.json`).
- `resolveAgentSchema` `:59-72` substitutes `enum` and strips `x-*`. `agentOpenAiTools` `:102-118` caches by `mode:only` in `RESOLVED`.
- Tool definition — `agent-tools.v1.json` (description of `search_catalog` `:25-72`). Tools size: build 5 148 B, ask 4 840 B, of which `search_catalog` is 2 967 B (enum of 111 block labels + 9 industries).
- Contract fingerprint `packages/chat-agent/src/fingerprint.ts:26-42`: kinds, rendererMap, `snapshot.sourceDigest`, `SEARCH_INDEX_SOURCES`, `POLICY_VERSION`, `AGENT_TOOLS_VERSION` → `cf1-<fnv1a64>`. Test `scripts/m4-api-tests/catalog-search.test.ts:75-82`.

### 1.5 Browser (UI)

- Block/screen feed: `apps/chat-web/src/lib/feed/feed.svelte.ts:94` → `stockSearch` (`packages/builder-core/src/catalog/stock-search.ts:231-295`, format `stock-search/v1`, ADR 0024). Filters `type, role, spec, site, variant, scope`, `boostRoles` (page family, ADR 0027). Page size 8, maximum 48 (`:20-21`). The `result` getter (`feed.svelte.ts:90-95`) runs the search on every read.
- Blocks: `blockRows` `:105-148` (module-level cache `blockRowsCache`, one row per variant, 526 rows, text = `spec blockId title variant role jobs sites`). `blockMatches` `:201-212` — tokens split on whitespace, each must be a substring of the text (AND), `score` = the number of tokens found in `spec title role`, sort by score (stable).
- Screens: `screenRows` `:183-198` — two calls to `searchCatalog` with `pageSize:1000` (with scope and with q), plus a substring fallback over `id title subtitle labels`.
- Facets: 5 passes over the entire pool (`:256-271`).
- Candidate sorting: blocks before screens (`:252`), blocks with a renderer before those without (`:145`).
- Other searches in `apps/chat-web` (`SidebarSearch.svelte`, Recents by title) are unrelated to the catalog.

### 1.6 Data size, summary

79 screens (14 unique titles: 65 duplicates due to `title="Site"` + `subtitle`), 111 Stock blocks → 112 registry items → 526 variants, 24 `job`, 8 `section`, 6 `site`, 7 industries on screens (9 in the vocabulary). 1 711 terms (of which 209 are Cyrillic, only from facet labels), 79 × on average several hundred pairs per screen.

---------------------------------------------------------------------------------------------------
## 2. Measurements on the real code

| Query | Result |
| --- | --- |
| `q:"pricing"` | 5 screens, top `theme-marketing-pricing/*` (score 6), 2.6 KB |
| `q:"tseny tarify"` (prices plans) | 4 `pricing` screens (score 4) — works, ru facet labels for "pricing" |
| `q:"lending dlya kofeyni"` (landing page for a coffee shop) | 9 `marketing-landing` screens (score 2): the word "dlya" (for) is treated as a term, `nearest {"dlya":["dve"]}` (for → two) — noise |
| `q:"saydbar"` (sidebar) | `noFit`, `nearest {"saydbar":["sayt","sayta"]}` (sidebar → site, of a site), response 3.6 KB (vocabulary dump); the test `catalog-search.test.ts:44-49` treats this as the expected behavior |
| `q:"navegacion"` (no accent) | `noFit`, `nearest` suggests `navegación`, but does not apply it |
| `q:"forma obratnoy svyazi"` (contact / feedback form) | 10 screens with the same score 2, order is set by `compareScreenSupport`, `shop/home` ranks above `support-center/contact` |
| `q:"kontakty"` (contacts) | 4 screens, scores are tied, `support-center/contact` is third |
| `site:"landing", industry:"food"` | no screens → `relaxed.dropped:["industry"]` |
| `get_block {item:"pricing"}` / `"hero"` | finds `pricing-tiers` / `hero-classic` via the spec label |
| `get_block {item:"Pricing tiers"}` or `"tseny"` (prices) | `unknown_item`, `near:[]` |
| `stockSearch q:"pricing", type:block` | 21 variants (substring) |
| `stockSearch q:"pricing table"` / `"tiers pricing"` / `"tseny"` (prices) | 0 results (AND of substrings against the row text) |
| `stockSearch q:"navigation"` | 124 (blocks and screens mixed) |

Speed (Windows, Bun): first call 45 ms (warmup), then ≈7 ms per `search_catalog q` (200 calls = 1.4 s), ≈0.5 ms for a facet-only query, 9 ms for `browse`. The result is deterministic (two runs are byte-for-byte identical). `search_catalog` response sizes: 1.4–3.7 KB.

---------------------------------------------------------------------------------------------------
## 3. Quality assessment

What works well:
- The term index is precomputed, under lock and checked by `snapshot:check` (byte-for-byte), serialization is deterministic (`catalog-graph.mjs:614`, terms are sorted with `localeCompare("en")` at `:554`, `.sort()` at `:556`).
- No handwritten keyword lists; terms come from the catalog, including labels in 5 languages and facet synonyms.
- Search and `facetTree` are pure functions in builder-core; the gate and `itemInfo` are factored out.
- There is a relax strategy and `nearest` for suggestions.

Problems:
1. **The agent cannot search blocks.** `search_catalog` returns only screens. The agent takes blocks from `itemIndex` and from an exact name in `get_block`. A hook already exists in the types (`types.ts:2-3` `type:"screen"|"block"`), but `filterScreens` returns `[]` when `type!=="screen"` (`search.ts:38-41`).
2. **Two different matchers.** The weighted term index (`text-search.ts`) is used for the agent and for screens; substring AND (`stock-search.ts:207`) is used for blocks in the UI. The same query yields a different answer, and ADR 0024 ("one search for every surface") is violated: the agent does not use `stockSearch`.
3. **Three namespaces with no unified table.** item (`pricing-tiers`), spec (`block.pricing`), label (`pricing`, this is the `blocks` enum). `itemOfSpec` returns exactly one item per spec (`items.ts:59-61`), so `hero-prompt` (spec `block.hero`, `sources.json`) is unreachable via spec and label, and in `itemIndex` both `hero-classic` and `hero-prompt` have the same title "Hero" (`blocks.ts:48`) — ambiguous. A block title ("Pricing tiers") does not resolve.
4. **Locales.** Ru exists only in facet labels (209 Cyrillic terms). There are no ru names for blocks, variants, or props, so "saydbar" (sidebar), "geroy" (hero), "forma obratnoy svyazi" (contact / feedback form) do not find blocks. There are no stop words ("dlya" (for), "i" (and), "v" (in)): they become terms and produce noisy `nearest`. Ru morphology is only via a prefix of ≥4 characters in either direction.
5. **Normalization.** Case is folded, diacritics are not (`navegacion` ≠ `navegación`), Cyrillic yo/e folding is absent, camelCase and hyphens are not split (terms such as `announcementbar`, `aboutcompany` are concatenated), the build tokenizer (2–20) and the runtime tokenizer (2–40) diverge. There are no block synonyms or block tags for search (`jobs` exists on `blockIndex`, but is used only in the UI row text, `stock-search.ts:139`).
6. **Facet noise.** The `industry` vocabulary contains 9 values, but only 7 appear on screens (`medicine`, `realestate` do not occur): the agent will get `relaxed` instead of an answer. 23 of 79 screens have an empty `industry`. The `blocks` enum has 111 labels, dominated by `navbar` (76 screens) and `sitemap` (72). Labels are not equal to registry items (`navbar` vs `nav-bar`/`site-header`). In `policy.v0.json:6`, `searchFacets` includes `role, composition, character, density, media, slots, tone`; they are indexed as terms, but the tool does not accept them.
7. **Ranking.** Ties at equal score are broken by `compareScreenSupport` (`compatibility.ts:99-107`), not by relevance. There is no IDF, no bonus for an exact id/title match, and no account of the fraction of query tokens covered (score = sum of weights, so a long query accumulates accidental 1–2 points). `supported` is computed in two ways: `screenSupport` (all blocks render and a body is present, `compatibility.ts:76-97`) and in the UI `screenItems().items.length>0` (`stock-search.ts:171`). Currently 79/79 agree, but this is a hidden divergence.
8. **O(n) and rebuilding.** `filterScreens` is linear (79 is cheap). But `compareScreenSupport` recomputes `screenSupport→compatibilityFor` inside the sort comparator (`compatibility.ts:99-107`), and inside that a linear `blockIndex.find` runs for every slot (`:7`). `catalogEntryBySpec` is a linear `find` (`sources.ts:84`), `catalogSourceFor` walks all 526 assets (`:67-70`). `itemIndex()` is rebuilt on every turn (only `itemInfo` is cached). `screenRows` calls `searchCatalog` twice with `pageSize:1000` on every keystroke. `nearestTerms` is Levenshtein over 1711 terms per token. On 79 screens this is 7 ms, not a bottleneck; the main cost is prompt tokens, not CPU.
9. **Nondeterminism.** The result sets themselves are deterministic, but `facetTree` sorts with `localeCompare` without an explicit locale (`search.ts:237`), and the `blocks` vocabulary is built with `localeCompare` without a locale (`catalog-graph.mjs:521`). On a different ICU/OS the order may differ. The variant order in `itemIndex` is JSON insertion order (depends on the generator).
10. **Coupling with the agent.** The relax logic (`catalog-tools.ts:52-74`) and the compact form live in `chat-agent`, but they are essentially deterministic catalog logic. `builder-core/policy.ts` holds agent budgets (`RUN_BUDGET`: `shortlist:12` and `reserveProposeSteps:1` are unused in the code, I found only the declaration).
11. **Fingerprint is incomplete.** `contractFingerprint` (`fingerprint.ts:31-40`) includes the assets `sourceDigest` and `SEARCH_INDEX_SOURCES`, but not `sources.json.lockDigest`, not `props.json.digest`, and not the `itemIndex` hash. A registry change (variants/props) with the same assets digest will not change the fingerprint, even though `itemIndex` and tools will change.

---------------------------------------------------------------------------------------------------
## 4. How to build a query index (PROPOSALS; files with these names do not exist yet)

### 4.1 Principle
One pure module in `packages/builder-core/src/catalog/` and one derived artifact, built by the same `snapshot:derive` pipeline (`snapshot:check` and the lock already exist). It is used by the UI (in place of the matcher in `stock-search.ts:201-212`), the agent (`search_catalog` with `type:"item"`), and the `get_block` resolver. The agent remains only a formatter of the compact response.

### 4.2 What to index (document = item | screen)
An `item` document: `item` id, `spec`, `label` (blockId), `title`, variant names + `variant.title/subtitle`, `kind`/`role` (header, footer), `jobs`, `sites` (from screens that use the block — inverted index of `layout`), `screens[]`, props keys (field names from `propsOutline`/`propsFieldTree`, lists and enum values), facet labels in 5 locales, synonyms.
A `screen` document: as today + section `roles` and `sections[{item,variant}]`.
Weighted fields (BM25F-lite): id/name 10, title 8, variant ids 4, jobs/role 4, facet labels by locale 3, synonyms 3, props keys 2, words from variant fields 1. A per-locale field is needed so that an ru query boosts ru fields.

### 4.3 Normalization (one function at both build and runtime)
NFKC → lowercase → NFD with `\p{M}` stripped → `yo→e` → split on non-letter-digit characters, on camelCase and hyphens (also keep the concatenated form) → stop words `ru/en/es/de/fr` (a small language list; this is not catalog data and must be versioned) → light ru stemming (ending stripping) or edge-n-gram ≥3 instead of a linear prefix scan. The normalizer version goes into the index header.

### 4.4 Structure and version
Inverted index: `term → packed [(docIdx, weight)]`, document table sorted by `(kind, id)` by code points (not `localeCompare`), terms by code points, IDF computed at build time. Precomputed typo neighbors (SymSpell, deletions ≤2), or keep `nearestTerms` only as a fallback on a miss.
Header: `{format, schemaVersion, normalizerVersion, catalogDigest (snapshot.sourceDigest), registryLockDigest (sources.json), propsDigest, bodySha256}`. Serialization — as in `serialize()` (`catalog-graph.mjs:614`): ASCII-only, deterministic, one entity per line. Include `bodySha256` in `contractFingerprint` and in the lock.
Block synonyms (ru: "saydbar" (sidebar)→sidenav, "geroy" (hero)→hero) should come from pinned Stock (`facets.v0.json` synonyms, extend upstream) or from a separate overlay with provenance in the lock. This needs an explicit decision: the "no handwritten lists" principle (`text-search.ts:3-6`) will have to be adjusted for synonyms.

### 4.5 Ranking (deterministic)
`score = Σ_fields weight × idf(term)` + a bonus for full coverage of query tokens + a bonus for an exact `id/title` match. Ties: `supported desc → kind order → id` by code points. Do not use object traversal order or `localeCompare`.
Move facet relaxation (`catalog-tools.ts:52-74`) into the pure package as `relaxQuery`.

### 4.6 Output forms
- **For the gate** (full): unchanged — `itemInfo`, `readBlock`, `compatibilityFor`, `screenSupport`.
- **For the model** (compact): lines or tuples `{item, title, variants[:k], why}` without a float score and without `labels`; top-5; one format for `item` and `screen`. Keep `get_block` (≈2.1–2.7 KB) separately as "detailed read".
- **Modes for comparison** (as the owner asked earlier): A) a static compact `itemIndex` in the cacheable prefix; B) the same index only via search `type:"item"`. Measure `cached_tokens`, ticks, and the number of turns.
- `get_block`: resolver via the index (id → spec/label → normalized title → fuzzy), `near` from the index with a rank, accepts ru names.
- Take the query locale from `page.locale` / the turn context.

### 4.7 Where it should live
`packages/builder-core/src/catalog/` (pure, like `search.ts`/`text-search.ts`): query module + normalizer; derived JSON next to `search-index.json`; generation — an extension of `deriveSearchIndex` in `scripts/lib/catalog-graph.mjs`. `chat-agent` — only the compact formatter and the tool schema; `xai-runtime` — only prompt printing; `apps/chat-web/src/lib/feed/feed.svelte.ts` — calls the same `queryCatalog`.

### 4.8 Tests (golden queries)
In the style of the existing `node:test` (`scripts/m4-api-tests/catalog-search.test.ts`, `blocks-feed.test.ts`), proposal: `scripts/m4-api-tests/catalog-query-index.test.ts` + `catalog/golden-queries.v0.json` (`{q, locale, expectTop[], expectIn[], expectNot[]}`).
Golden queries: `pricing` / `tseny` (prices) / `tarify` (plans) / `tariffs`; `hero` / `geroy` (hero); `sidebar` / `saydbar` (sidebar) / `bokovoe menyu` (side menu); `navigation` / `navegación` / `navegacion`; `faq` / `voprosy` (questions); `kontakty` (contacts) / `forma obratnoy svyazi` (contact / feedback form) / `contact form`; `pricing table`, `tiers pricing`; typos `prcing`, `sidenv`; stop words (`lending dlya kofeyni` (landing page for a coffee shop)); `announcementBar`, `announcement bar`.
Properties: every item is found by its id, title, and each of its variant ids; two build runs are byte-for-byte identical; shuffling the input document order does not change the result set; normalization is idempotent; the index hash changes only when the catalog or the normalizer changes; recall@5 on the golden set ≥ a threshold; compact response size ≤ N bytes; every item has ≥1 findable ru term; `supported` is computed in one way.

---------------------------------------------------------------------------------------------------
## 5. Prompt caching

- The stable prefix today: system (`chat-prompts.ts:9-26`) + tools (`agentOpenAiTools`, `RESOLVED` cache, `agent-tools.ts:99-118`; 5.1 KB). The contents are byte-stable: `Object.keys(catalogSources.blocks)` is sorted, enums come from sorted vocabularies, a repeated call yields an identical result.
- `itemIndex` (7.5 KB) sits as the **last key of the user-prompt** (`chat-prompts.ts:40-50`), after the volatile `request`, `conversation`, `page`, `renderProblems`, `scope`, `propsOfBlocksOnPage`. Therefore it is not part of the shared prefix and every turn is billed without the cached-input discount. Proposal: move it into a separate stable message (system or the first user message) before the volatile part, with a deterministic order; the session cache key is `x-grok-conv-id` / `prompt_cache_key`, using a single mechanism.
- The key order of `propsOfBlocksOnPage` depends on the order of blocks on the page (volatile, that is fine — it is at the end).
- For the new index: serialize a compact static index by code points, without `Map`/`Set` order, without floats; store the index hash and put it in `contractFingerprint` and in telemetry (`index_hash`). Changing the index format means invalidating the cache of all sessions, so a format version is a separate deliberate event.
- `search_catalog` and `get_block` responses live in the dialogue tail and are cached as a continuation only within the turn. The compact form shrinks the tail, not the prefix.

---------------------------------------------------------------------------------------------------
## 6. Not verified

- The real contribution of the cache and ticks (I did not make paid requests).
- Ranking quality on real user queries (there are no query logs; a golden set needs to be compiled).
- The reason for score 2 on irrelevant screens for "forma obratnoy svyazi" (contact / feedback form) (which terms actually matched) was not investigated: `matched` is present in the result and can be inspected.
- Behavior of `feed.svelte.ts:90-95` (the getter) under Svelte reactivity: recomputation on every read is an inference from the code, not a measurement.
- No files in the user's repository were changed; temporary files in `%TEMP%` were deleted; the `/workspace/tmp/grokapi/` directory was not created (copying onto the box was not needed).
