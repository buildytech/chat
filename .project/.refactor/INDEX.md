# .project/.refactor

Working notes for planned refactors that are not yet ADRs (or that supersede an ADR once done).
Each note is one change: why, what to delete, what to keep, how to verify.

| Note | Status | What |
| --- | --- | --- |
| [remove-page-family.md](remove-page-family.md) | planned | Drop `page-family.ts` and the advisory PAGE_FAMILIES / feed-boost path (ADR 0027 leftover after page-spec 2.0) |

## Agent system programme

- [Общий план и приоритеты](agent-system-plan.md) — этапы 1–2 реализованы; backend этапа 3 готов. Workbench отложен владельцем; поиск и контекст ещё впереди.
- [Stage 1: единая политика](stage-1-policy.md) — ход реализации и проверки.
- [Stage 2: общее выполнение](stage-2-runtime.md) — история реализации loop, нейтрального протокола, provider-xai, профилей и учёта.
- Исходные сведения: [xAI API audit](grokapi-report-2026-11-16.md), [catalog search audit](constructor-search-audit-2026-11-16.md).

## Текущий приоритет (2026-11-16)

Учёт billed ticks, корректные steps/nudge, новые defaults v2 и bounded HTTP retries реализованы. Следующий отдельный шаг — сценарии обсуждения без write_page, затем общий поиск и оптимизация контекста/кэша. Браузерная карта выполнения и редактор сценариев отложены по указанию владельца. Streaming, Responses и платные замеры моделей остаются поздними этапами.

Discussion follow-up (ADR 0054): Read-only page.discuss@1 is registered explicitly; Ask defaults stay compatible; registered legacy Ask proposal profiles remain. Server run-trace/1 is persisted in ext["agent-trace"], with body opt-in on export. Browser Workbench remains deferred. Next: unified search/context and cache experiments.

Session completeness follow-up, 2026-11-17 (ADR 0055): host attempt ledger, interrupted/superseded/error accounting, retry links, provider-observed trace metadata, neutral usage origin, registry IDs and compact search evidence implemented. Server persistence, cache-key/prefix experiments, request-count targets, search relevance and answer-contract work remain separate stages.
