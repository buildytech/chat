# .project/.refactor

Working notes for planned refactors that are not yet ADRs (or that supersede an ADR once done).
Each note is one change: why, what to delete, what to keep, how to verify.

| Note | Status | What |
| --- | --- | --- |
| [remove-page-family.md](remove-page-family.md) | planned | Drop `page-family.ts` and the advisory PAGE_FAMILIES / feed-boost path (ADR 0027 leftover after page-spec 2.0) |

## Agent system programme

- [Общий план и приоритеты](agent-system-plan.md) — код этапа 1 реализован; общий агентский цикл, адаптеры, поиск, контекст и браузерный кабинет сценариев.
- [Stage 1: единая политика](stage-1-policy.md) — ход реализации и проверки.
- Исходные сведения: [xAI API audit](grokapi-report-2026-11-16.md), [catalog search audit](constructor-search-audit-2026-11-16.md).
