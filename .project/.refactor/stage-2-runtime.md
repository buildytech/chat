# Stage 2 — общее выполнение и адаптер xAI

2026-11-16. Первый отдельный шаг: общие prompts и сборка контекста перенесены из apps/xai-runtime/src/chat-prompts.ts в packages/chat-agent/src/agent/prompts.ts. Runtime импортирует их из chat-agent; копии и compatibility shim отсутствуют. Тела prompts и context functions сравнены с предыдущим коммитом: изменений, кроме импортов, нет. Runtime bundles обновлены штатным генератором.

Это ещё не завершение этапа 2. Следующие изменения: нейтральный контракт provider step, выделение xAI HTTP adapter, перенос loop с инъекцией адаптера и host dependencies; отдельный учёт запросов (включая named fallback и финальный ответ), вызовов tools, попыток записи и deadline. Смена протокола сообщений и разбор provider usage требуют отдельных fixtures; API-параметры не меняются вместе с механическим переносом.

Проверки текущего шага: npm run verify завершился с кодом 0 на Node 22.23.5. Все 332 теста, coverage 526/526, secrets, audit, typecheck, lint/ratchets, Svelte и обе сборки прошли. No-trace: 725/725 строк отсутствуют без чата, контроль 584/725; headless chat off 27/27, chat on 22/22. Первый sandbox-прогон упёрся в EPERM временных ссылок двух ZIP-тестов; повтор с необходимым доступом успешен без изменения тестов. Журнал: .cache/stage2-prompts-verify.log (gitignored).

Платные вызовы провайдеров не запускаются. Предыдущее разовое разрешение на push относилось к 70edd6a; отсутствие штатного gate этим не устранено. Текущий шаг фиксируется локально.
