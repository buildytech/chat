# ADR 0005: ContextlY historical CR + lexproto/Jev gate scheme (future design only)

- Status: **Proposed** (documentation reserve — **not implemented**)
- Date: 2026-11-06
- Extends: [0004-agent-runtime-adapters.md](0004-agent-runtime-adapters.md)
- Surfaces: [0003-creator-surfaces-preview-code.md](0003-creator-surfaces-preview-code.md)
- Owner auth: t128u — request ContextlY historical scheme and **save ADR for future only**; do not implement now
- Related docs: [lexproto-status.md](../../docs/lexproto-status.md), [live-model-local.md](../../docs/live-model-local.md), [cr-port-provenance.md](../../docs/cr-port-provenance.md)

## Purpose

Capture a **historical** ContextlY account of how an earlier prototype wired Context Runtime (CR), a **local** typed Question/Decision protocol (called “lexproto” in that lineage), and Jev — so BuildY can design a future gate path **without inventing missing schemas** and **without treating Jev or LeX as lexproto**.

This ADR is **not** an acceptance claim that lexproto exists or that BuildY already runs that pipeline.

## Layer legend (must not be collapsed)

| Layer | Meaning |
| --- | --- |
| **H — Historical report** | ContextlY assertions about a deleted / non-BuildY prototype. **Not** independently verified in this ADR turn. Treat as design folklore until recovered artifacts prove otherwise. |
| **V — Verified in BuildY / upstream today** | What current `buildytech/chat` and inspected public repos actually contain (as of 2026-11-06). |
| **F — Future proposed design** | Acceptance-oriented target **if/when** owner authorizes implementation. Not started. |

---

## H — Historical report (ContextlY; unverified)

> The following is ContextlY’s reconstruction. Deleted trees and counts were **not** re-proven here. Exact Question/Decision schemas and signatures are **missing** — **do not invent**.

### Prototype locus

- Deleted prototype under `/workspace/cgx-orchestrator` — **not** BuildY / not `buildytech/chat`.
- Driver historically described as `@grok/agent-sdk` **0.5.0** with `CURSOR_API_KEY` (version differs from BuildY’s current agent-sdk pin — see **V**).
- Jev reached via agent-sdk **extension**, with a separate `TYPESAFE_API_KEY`, historically toward `api.typesafe.ai/v1/systemone`, model `jev-latest`. Those URLs/models are **historical**, not re-verified as current endpoints in this ADR.

### Context Runtime role (as described)

- Upstream product: **`github.com/fastygo/context`** — deterministic context / evidence / provenance / artifacts / trace; **no LLM and no outbound network in the CR core** (as ContextlY stated; aligns with CR’s product intent).
- Historical flow sketch:
  1. Request dictionary / stemming
  2. CR → ranked **candidates** (context-pack era: pack ranked itself; **no** explicit artifact-id selection API then)
  3. Finite typed **Question** set
  4. Jev via extension + **local wrapper**
  5. Validate schema, candidate ids, `source_refs`; preserve **`needsHuman`**
  6. Verify against sources, then artifacts/traces
- Sealing / storage / replay **in CR** was an **architectural direction**, not a proved semantic verifier.
- App-level tools named `resolve_candidates` / `submit_decision` were described in that lineage — **not** proved as a stable public CR API here.

### “lexproto” in that lineage (local protocol ≠ Jev ≠ LeX)

- Historically a **local** typed **Question / Decision** protocol with validation helpers **`above`** / **`needsHuman`**.
- **Jev was a backend model adapter**, not the protocol identity: **Jev ≠ lexproto**.
- Exact schema documents / signatures for Question/Decision were in deleted artifacts (e.g. references to `data/out/pipeline-v1/REPORT.md` and similar) and are **not available** to quote. **Cannot invent replacements in this ADR.**

### Historical integrity limits (as reported)

- `PUT /v1/tools` historically enforced **JSON Schema syntax only**, not tool **output** semantic enforcement.
- Tool-call “verified” historically meant a required nonempty **verification string**, not cryptographic truth.
- Artifact checksum optional (`expected_checksum`); **no** mandatory `sha256:` prefix discipline in that account; lineage `source_refs` required.
- **Integrity ≠ truth.**
- Anecdotal “39 Jev decisions / 7 runs / fallback 0” counts are **unverified historical folklore** — **omit from acceptance**, or label strictly as unverified if restated.

### Canonical upstream pointers (names only)

- CR: `https://github.com/fastygo/context`
- Separate product **LeX**: `https://github.com/fastygo/lex` — **not** a substitute for lexproto and **not** authorized as BuildY `features.lexproto` by this ADR.

---

## V — Verified in BuildY / upstream today (2026-11-06)

### lexproto adapter

- Public repo `github.com/fastygo/lexproto` @ `3b092b891e67dd5c8a3fb5050725acdc01b26358` is a **docs stub** (README title, LICENSE, `.project`); **no** in-tree PROTOCOL, **no** Go module on proxy.golang.org, **no** npm package, **no** releases, **no** runtime binary/SDK.
- BuildY ships `services/context-serve/internal/lexproto` as **`Unavailable`**. Capabilities must not flip `features.lexproto` from env flags or by mounting Jev.
- See [lexproto-status.md](../../docs/lexproto-status.md).

### Context Runtime + Session live path (BuildY)

- CR client: `services/context-serve/internal/contextclient` → real HTTP `POST /v1/context-pack` when `CONTEXT_RUNTIME_URL` probes healthy.
- BuildY-owned local CR bind documented as `127.0.0.1:18085` ([cr-port-provenance.md](../../docs/cr-port-provenance.md)).
- Opt-in live turns: `BUILDY_LIVE_MODEL=1` → Session `POST /v1/sessions/{id}/messages` → `liveruntime` → `@grok/agent-sdk` (current pin **0.6.0** in local page-agent) tools `context_pack` + `propose_page` → Session validates/`save_page`. `liveModel` capability flips only after `MarkLiveSuccess`.
- Ordinary chat still does **not** mutate pages without explicit save / propose→save. Idempotent `requestId` retries do not duplicate writes.
- This is **not** the historical lexproto/Jev gate pipeline.

### CodePort M5 (Preview/Code Latte compile — verified smoke)

Exact CodePort emitter output for saved Session revision (no WP publish):

| Field | Value |
| --- | --- |
| session | `sess-dcfe3398319aee1e` |
| pageId | `page-5975af4003592b2c` |
| revision | `1` |
| emitter | `latteFromPage` / `packFilesFromPage` (exact; not handwritten substitute) |
| layout dep | `Main/page.latte` (shipped in ZIP / `apps/chat-web/codeport-pack`) |
| pageLatteSha256 | `c337cb31ec8aa0231ae48be20686d876e6e4ed7df94aabeebd37d98f2a364517` |
| htmlSha256 | `9f218d9ca81ba07c70ec7d5614585562a334dba5379a86a6d70e9d800d4e6540` |
| dtoSha256 | `f06918720597b2a92f68e821cca1728affef696e99fd56964774fd0d52aa1ad7` |
| semantic | **7/7** dish blocks matched DTO |
| commit introducing pack/smoke | `402d372` |

Smoke entry: `npx tsx scripts/m5-codeport-latte-smoke.ts`. Evidence under `/workspace/var/phpingineer/logs/m5-codeport/` on the bot box.

### What this ADR does **not** claim

- Complete lexproto integration.
- That Jev extension gates equal lexproto.
- That LeX (`fastygo/lex`) may be silently renamed to `features.lexproto`.
- Recovery of deleted Question/Decision schemas.

---

## F — Future proposed design (acceptance sketch only)

Implement **only** after owner authorization and after a **recoverable** lexproto schema/wrapper exists (or an explicitly renamed capability).

### Target acceptance (proposed)

1. Two source fixtures: **relevant** and **irrelevant**.
2. CR produces a **candidate pack** (ids + `source_refs` + checksums as CR actually exposes).
3. **Recovered** lexproto Question schema + **actual wrapper/version** (not “Jev HTTP alone”) drive a finite Question set.
4. Validation rejects: schema errors, bad candidate ids, bad/missing `source_refs`, **`needsHuman`**, invalid answers, timeouts.
5. Persist: candidates, Question, raw answer (**redacted**), `validatedDecision`, validation result + content hashes.
6. **Replay** validation on the saved response **without** calling an LLM.
7. Prove wrapper identity/version in evidence (module path, pin, checksum) — Jev System One HTTP by itself is insufficient.

### Non-goals until authorized

- Runtime wiring in Session HTTP.
- Substituting LeX or Jev for lexproto availability.
- Inventing Question/Decision schemas to fill deleted gaps.

---

## Decision

1. **Record** the ContextlY historical scheme here as **H** only.
2. **Keep** BuildY `lexproto` adapter **Unavailable** until a published protocol + client/runtime (or owner-authorized distinctly named binding) exists (**V**).
3. **Defer** all **F** implementation; this ADR does not schedule work or change runtime defaults.
4. Future implementers must preserve: **Jev ≠ lexproto**, **LeX ≠ lexproto**, **integrity ≠ truth**, and must prove **wrapper/version**, not only a model HTTP call.

## Consequences

- Design memory survives without resurrecting deleted prototype trees.
- Product claims stay honest: CodePort M5 and CR/live Session paths are separate from lexproto gates.
- Owner can later authorize **F** against recovered schemas without re-litigating naming collisions.

## References

- Upstream CR: https://github.com/fastygo/context  
- Upstream lexproto stub: https://github.com/fastygo/lexproto  
- Upstream LeX (separate): https://github.com/fastygo/lex  
- BuildY ADR-0004 AdapterRegistry / capabilities discipline  
