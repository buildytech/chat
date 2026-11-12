# Plan field repairs and continuation — 2026-11-12

ADR 0031. Replays the owner's 14:43 session from commit 7719a6c without committing that private export.

Validation: serialized contract/unit suite passed; final focused Ask/Build suite 22/22; Svelte check: zero errors/warnings; production build passed. Provider continuation tests use a mocked response, no paid call.

Isolated Edge on production build: imported the actual owner session; the icon repair control changed only the Analytics row from bar-chart-3 to activity, preserving other rows; the field repair offered contract fields and changed heading to title, correctly producing a no-change row when the value already matched. The all-no-change plan showed No changes. Re-imported the original fixture and applied the three valid operations while heading remained invalid: a pending proposal was created, and the applied page remained unchanged. Zero runtime run POSTs and zero page errors.

The first browser pass exposed an async-schema readiness issue on restored plans. AskPlanCard now waits for the shared validator chunk and recomputes repair controls when ready; failed loading reports an error. The repeated browser replay passed.

Limits: repairs cover contract enum values, supported field names and row copy enum origins, not arbitrary semantic rewrites. Applying a subset consumes the plan and records skipped/rejected operations. Bounded dialogue is not unlimited task memory or a factual-accuracy guarantee. Owner visual acceptance remains pending.
