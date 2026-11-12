# ADR 0031: Plan field repairs, selected subsets and bounded continuation

Status: accepted, 2026-11-12. Follow-up to ADR 0030, replaying the owner's 14:43 session.

A bad operation must not prevent the author from applying a different valid operation. The card offers Apply selected changes with a count. Invalid rows remain unticked; no-change rows are kept. The chosen subset is checked in order against the current page at execution, including scope. A variant operation depending on an omitted replacement is rejected explicitly. One pending proposal still requires Apply.

Repair controls are derived afresh by pagePlanRepairs from page-patch validation, the props gate's structured issues (origin, value and allowed enum) and PAGE_SLOTS. They are not stored in session data. A row icon error maps to that row's items index and key, not a parsed error sentence. Field-name errors offer the target kind's contract slots; nothing silently maps heading to title. repairPagePlan accepts only a currently offered value and rechecks the whole plan. Other row content is preserved. The session plan shape is unchanged; legacy exports can be repaired on load. Long icon enums stay out of saved error prose.

Plans containing only no-change rows show No changes and offer no apply action. Plans with errors still show Needs repair, while the explicit valid subset may run. A consumed plan remains a record of selected and skipped results; repairs are available before execution.

Requests carry bounded conversation data: first prior user message plus the last six prior messages, excluding the current brief; each entry at most 2000 characters, server accepts at most eight entries. Prior checked-plan ops are appended within that bound. The host sends this as historical data in the existing model request; no new model call, service or mode inference. Older callers omit it. This is bounded context rather than durable semantic task memory: sufficiently long dialogue can lose details.
