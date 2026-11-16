# Stage 1 — единая политика выполнения

2026-11-16. Scope: ADR 0050; первый этап agent-system-plan.md.

Изменения: agent-tools.v1.json v3 задаёт Ask=auto, Build=required; agentToolChoice читает это значение; runtime использует accessor, сохраняя явный named write после nudge. POLICY_VERSION = page-agent/5, fingerprint меняется штатным способом. Тест контракта проверяет обе настройки; существующие mock-provider replays проверяют фактические HTTP request bodies и завершение после write.

Проверки: npm run verify прошёл полностью на Node 22.23.5. Все 332 теста успешны; inspector coverage 526/526; gitleaks 8.30.1 не нашёл секретов в истории и staged diff; production audit — 0 vulnerabilities; strict TS, ESLint, ratchets, dead code, ui8px grid и svelte-check прошли. Обычная сборка и сборка без чата успешны. No-trace: 707/707 chat-only strings отсутствуют в сборке без чата, контроль на сборке с чатом — 584/707. Headless smoke через Microsoft Edge: chat off 27/27, chat on 22/22. Визуальная приёмка владельцем этим не подменяется.

Для воспроизводимости на Windows исправлены пути/запуски локальных CLI в gate.test.ts, runtime-bundle.test.ts, check-ratchet.mjs, check-dead.mjs, ui8px-extract.mjs и check-modules.mjs. Сами проверки и baselines не ослаблены. Зависимости восстановлены npm ci --ignore-scripts из существующего lockfile; lockfile не менялся. Платных API-вызовов нет. Отдельного кабинета/новых провайдеров в этом этапе нет; они перечислены в плане с критериями приёмки.

Среда запуска: Node 22; NODE_OPTIONS=--max-old-space-size=1024, GOMAXPROCS=1; GITLEAKS_BIN указывает на проверенный по официальному SHA256 gitleaks 8.30.1; BUILDY_CHROME — установленный Microsoft Edge. Локальный журнал: .cache/refactor-verify-ready.log (gitignored). Сборка сохраняет предупреждение о несовпадающих JSON import attributes в pack.ts; оно не относится к политике агента и не блокирует gate.

Доставка: gate/push.sh в checkout отсутствует. AGENTS.md требует push только через него, поэтому прямой push не выполняется; требуется восстановить штатный gate. Исходные аудиты и .project/README.md принадлежат текущей работе пользователя и не перезаписываются/не включаются в этот коммит.
