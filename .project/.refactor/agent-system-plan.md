# Общий план рефакторинга агентской системы

Дата: 2026-11-16. Историческая база: 502d881. Текущий статус: этапы 1–2 реализованы (политика, loop/протокол, provider-xai, lifecycle, бюджеты и учёт); backend этапа 3 — манифесты и зарегистрированные профили — реализован. Браузерная карта и редактор отложены владельцем. Поиск, контекст/кэш и дополнительные адаптеры ещё не реализованы. Подробная хронология — stage-2-runtime.md.

Источники: [аудит API](grokapi-report-2026-11-16.md), [аудит поиска](constructor-search-audit-2026-11-16.md), ADR 0034, 0038, 0041–0049 и обсуждение владельца.

## Цель и границы

Конструктор — самостоятельный ручной офлайн-редактор. Чат, выполнение агентов, кабинет сценариев и провайдеры подключаются модулями. Один агентский цикл обслуживает xAI, OpenAI и OpenRouter. Единственный способ предложения страницы — write_page, документ page-spec v2, общий gate схем и рендера, scope и проверка ревизии. Старые plan ops, page kinds и copy slots не возвращаются.

Уже работающую границу VITE_MODULE_CHAT=0 и no-trace сохраняем. Ядро конструктора не импортирует чат, промпты, модели и SDK; оно предоставляет снимок/ревизию, выбор блоков и проверяемое предложение изменений. Никаких ключей API в браузере, проекте или экспорте.

## Целевая ответственность

- builder-core / page-contract: документ, каталог, поиск, валидация, рендер, diff, история и экспорт. Общее для ручного и агентского путей.
- chat module: разговор, выбор режима/профиля, отображение предложения, явное подтверждение. Провайдерный формат запроса сюда не проникает.
- agent core (эволюция chat-agent): профиль, контекст, общий цикл, бюджеты, инструменты, нормализованный результат и события. Не зависит от UI и конкретного API.
- provider adapters: xAI, OpenAI, OpenRouter. Авторизация, протоколы, capabilities, usage, ошибки, streaming и cache policy. Общая инфраструктура HTTP возможна, доменная логика не копируется.
- agent runtime: serverless composition root, защита, привязка серверных credentials, установка render probe и выбранного адаптера. Будущие Wails/Shell — другие hosts, не обязательные зависимости Browser.
- agent studio: отключаемый браузерный кабинет сценариев. Для конструктора это ещё один модуль, а не новый режим его ядра.

## Приоритеты и этапы

### 1 — P0. Единая текущая политика и воспроизводимая база

Результат: действующее Build=required / Ask=auto читается runtime из versioned agent-tools.v1.json. Убираем расхождение контракта/комментария/исполнения, повышаем версии политики и tool document. Вынесение остальных настроек выполняется позже, не выдаём этот шаг за полный профиль.

Проверка: tool contract, provider replay Build/Ask/nudge, существующие группы тестов; bundle только генератором; npm run verify и штатный push gate. Не меняем модель, промпты по смыслу, Page DTO, schema gate и поведение подтверждения.

### 2 — P0. Общее выполнение и первый адаптер xAI

Перенести loop и общие prompts из apps/xai-runtime в агентский слой. Выделить интерфейс провайдера и адаптер текущего Chat Completions без изменения поведения. Разделить budgets: provider requests, tool calls, write attempts, deadline и наблюдаемые токены/стоимость. Fallback и финальный запрос входят в бюджет. Одна запись на ответ контролируется host; read batches сохраняются по возможности.

Результат: runtime — композиция, не второй агентский движок. Тесты нормализованных ответов: tool-only content:null, refusal, обрыв, неполный usage, отмена, лимит, несколько записей, повтор ошибок. Нулевой usage не вызывает платный retry. Повторы только для разрешённых временных ошибок и внутри бюджета; возможное повторное списание учитывается.

### 3 — P0. Версионируемый профиль и карта выполнения

Статус: манифесты, schema/compiler/registry, pinned versions и применение профилей в runtime готовы. Workbench отложен. Отдельный сценарий обсуждения без write_page ещё требуется; существующий Ask с предложениями не заменяется.

Профиль содержит ID/version, ссылки на prompt fragments, tool set, context policy, execution policy, budgets, provider/model и проверенные provider options. Определения инструментов остаются в одном JSON; профиль ссылается на них. Handler coverage и отсутствие неизвестных ссылок проверяет программа. Семантические проверки запрещают противоречивые комбинации: например, forced write без write_page среди tools. Сценарий только для обсуждения может отключать запись явной политикой, без угадывания намерения по словам.

Сначала read-only Workbench: resolved prompts с происхождением, tools/schemas/handlers, capabilities, размеры context parts, redacted фактический запрос, шаги и gate errors. Карта генерируется из исполняемой конфигурации; ручной второй карты нет. Не хранить секреты и полные частные prompts в обычных логах.

### 4 — P1. Один поиск каталога для UI и агента

Канонические сущности item и screen, явные связи с Stock spec/label (возможны несколько item). Один normalizer на build/runtime, детерминированный queryCatalog и производный индекс через существующий snapshot pipeline. Общая семантика поиска, отдельные UI/agent projections.

Агент получает поиск блоков и экранов через существующий search_catalog. get_block читает однозначный item; ошибочный variant больше не заменяется молча default. Fuzzy выдаёт кандидатов, не подменяет identity. Русские названия/синонимы приходят из закреплённого upstream; ручного overlay здесь нет. Полные props/enum не смешивать с основным поиском назначения блока.

Проверка: golden queries и matched reasons, exact identity, неоднозначные aliases, диакритика/camelCase, одинаковый результат при перемешивании данных. Веса ранжирования выбирать по измерению, не принимать предложенные в аудите числа как доказанные.

### 5 — P1. Context compiler и управляемый кэш

Одна сборка ContextParts: rules, tools, catalog reference, task, page/scope, conversation, turn results. Каждая часть имеет source/version/hash/bytes; реальный token count — только документированный подсчёт или usage, не байты под видом токенов.

Для scoped edit — выбранные блоки полностью, карта остальных, точный контракт нужных item. Для новой страницы — композиция и затем контракты выбранных блоков. get_block: краткий обзор отдельно от точного контракта/образца нужного варианта. Большие enums запрашиваются по полю. write_page сохраняется: полная страница для сборки, RFC 6902 для локальных правок; жёсткая проверка в host остаётся полной.

Сравнить стабильный компактный полный индекс и поиск по требованию. Порядок неизменной части стабилен; внутри turn сохраняется append-only история. Кэш приложения, prompt cache и provider conversation state — разные механизмы. Адаптер реализует cache key/breakpoints своего API; один ключ не обещает общий кэш между провайдерами. Холодные запросы обязательны в сравнении.

### 6 — P1. Второй адаптер: OpenAI

Проверить реальную независимость ядра на другом протоколе. Модели и capabilities проверяются явно; несовместимые настройки не удаляются молча. По умолчанию выбранная модель не заменяется. Provider state IDs не становятся идентичностью проекта. Выбранная политика хранения данных явная; режим без server-side conversation history должен оставаться рабочим.

Приёмка: те же gate/scope/revision/eval scenarios, одинаковый формат proposal. Provider usage нормализуется с сохранением неизвестных полей; billed, estimated и unknown cost не смешиваются. Платные прогоны запускаются отдельно только по явному разрешению.

### 7 — P1. Браузерный кабинет сценариев: создание и редактирование

Отдельный отключаемый agent-studio module, использующий тот же реестр профилей и компилятор, что runtime. Возможности: список/создание/клонирование/архивирование сценариев; черновики и immutable версии; prompts с параметрами; выбор разрешённых tools; context policy; provider/model/options; budgets; просмотр compiled request и карты связей; сравнение версий; импорт/экспорт конфигурации без credentials.

Конфигурация проверяется JSON Schema и semantic checks. Нельзя вводить произвольный JS, новый исполняемый handler или повышать серверный потолок бюджета. Секрет выбирается только по серверной привязке, не вводится в переносимый профиль. Изменения в UI не переписывают исходники репозитория и не меняют production автоматически.

Жизненный цикл: draft → validation → local replay → отдельный разрешённый live eval → approved immutable version → явная активация → rollback. Рабочий turn закрепляет версию; редактирование черновика не меняет уже идущий запрос. Локальные drafts хранятся через storage-v1 и module extension с собственным контрактом; published profiles привязывает runtime. Server-side авторизация обязательна, браузерная проверка её не заменяет. Обычный runtime принимает зарегистрированный profileId/version, а не произвольный browser prompt или имя секрета; запуск draft для live eval — отдельное привилегированное действие.

### 8 — P2. OpenRouter и дополнительные комбинации

OpenRouter — отдельный gateway adapter: различать запрошенную модель и фактический маршрут/провайдера. Закрепление маршрута или разрешённый fallback — явная версия политики. Изменение endpoint может менять кэш, возможности и качество. Нельзя заявлять эквивалентность прямому OpenAI/xAI только по model ID. Один loop и gate остаются общими.

### 9 — P2. Эксплуатация и сопровождение

Общие events для UI progress, streaming — адаптерная реализация без исполнения частичного JSON. Golden replays, offline/no-trace smoke, provider contract fixtures, проверка timeout/cancel/revision и budget. Метрики: accepted proposals, scope violations, попытки записи, token/cost completeness, cache hit, latency; локальный диагностический экспорт, не новая скрытая телеметрия.

Изменения провайдерных документов не активируют модели/цены автоматически. Snapshot обновляется через генератор с diff и тестами. Поиск/нормализация имеют свою версию; validation fingerprint покрывает документ/props/renderer; profile fingerprint — prompts/tools/policy/context. Ранжирование поиска само по себе не должно означать несовместимость валидатора.

## Условия приёмки всей программы

- Offline build не содержит агентских модулей, strings/routes и не вызывает runtime.
- Один профиль компилируется одинаково в Studio, диагностике и runtime.
- Провайдерная замена не меняет правила страницы и подтверждения.
- Нет дублирующих tools, prompts, схем props и правил предметной области.
- Каждый этап отдельно проверяется и откатывается обычным коммитом, без PR/force.
- Gate и ratchets не ослабляются; generated files меняются только генераторами, workflows — только владельцем.

## Исторический итог первого этапа

Этап 1 завершён: policy accessor, version bumps и регрессионные проверки; подробности — stage-1-policy.md. В тот момент штатный gate отсутствовал; затем он был перенесён в scripts/push-gate.sh. Текущая доставка выполняется через репозиторный gate с полным verify.

## Дополнительные решения из API-аудита

- Этап 2: xAI billed ticks из каждого полученного ответа, безопасное целочисленное суммирование; неполные usage/cost не равны нулю. 401/403, временные 429/5xx, cancellation и schema failures различаются. max_tokens заменяется документированным параметром адаптера, но не считается deadline.
- Этапы 2/6: параметры effort/temperature/output limits относятся к capabilities конкретной модели. grok-4.7 с low — отдельный разрешённый benchmark качества и времени перед изменением доступности. Тихого fallback нет. Chat Completions и Responses — разные protocol implementations, не простая замена URL.
- Этап 2: discovery кэшируется с TTL и ключом серверной конфигурации/доступа, не смешивает разные credentials; offline или неизвестная доступность не выдается за подтверждённую. Удалить устаревшие комментарии и неиспользуемые настройки после измерения потребителей.
- Этап 3: generation конфигурации и prompts — явная версия/rollback; убрать противоречие о внешних картинках. До появления проверяемого источника изображений разрешать предоставленные автором адреса, не просить модель угадывать существующие stock URL.
- Этапы 4/5: fingerprints должны покрывать props/source schema; стабильный prefix переносит общую справку перед переменным request. Внутри одного turn существующий append-only prefix уже может кэшироваться: не заявлять отсутствие cache hits без usage.
- Этапы 6/8: каталоги моделей и доступность аккаунта разделены, update через проверяемый snapshot; автоматического подключения новых моделей по документации нет. Rates optional для estimate, exact reported cost хранится отдельно. Monetary units документа и provider USD ticks — независимые контракты; расширение поддержки ISO 4217 валют — отдельная задача ядра с тестами, не побочный эффект адаптера.

## Историческая карта переноса для этапа 2 (актуальные пути — в stage-2-runtime.md)

- apps/xai-runtime/src/chat-tools.ts: providerStep и HTTP payload → server-side provider-xai; agentLoop, budgets и нормализованные events → agent core. Не копировать весь файл в адаптер.
- apps/xai-runtime/src/chat-prompts.ts → prompts/context compiler агентского ядра; vendor-specific protocol wording остаётся у адаптера. Tool definitions не перемещать в prompt text.
- packages/chat-agent/src/models.ts и xai-env.ts → xAI-specific model/config adapter; общие типы request/result остаются в core.
- packages/chat-agent/src/protect.ts → runtime host protection там, где она нужна; ключи/Basic Auth не попадают в browser agent module.
- packages/chat-agent/src/usage.ts → общий контракт наблюдаемого usage и стоимости плюс отдельные provider parsers. Протокольные поля не проникают в конструктор.
- packages/builder-core/src/policy.ts → агентские budgets/версии/allowlist переезжают в агентский слой; каталог остаётся pure. Импорты разбиваются по ответственности без дублирования схем.
- apps/chat-web/src/modules/chat/browser/xai-client.ts → нейтральный runtime client; UI читает разрешённые profile/model choices, не собирает vendor HTTP body.
- apps/xai-runtime → composition host до отдельного согласованного переименования. Генераторы Vercel, fingerprint и no-trace smoke меняются вместе с переносом, не после него.

Endpoints, secret bindings и жёсткие серверные лимиты выбирает host; переносимый сценарий не может задавать произвольный URL провайдера или исполняемый код. Это сохраняет модульность без превращения кабинета в обход runtime-защиты.

## Уточнение приоритетов после аудита учёта

Учёт ticks и запросов, nudge по бюджету сценария, классификация ошибок и один transient retry реализованы. Defaults page.ask/page.build v2 закрепляют manifest v2 (max_completion_tokens) и page-loop@2. Явные v1 сохраняют legacy wire contract и отсутствие retries. POLICY_VERSION и связанные версии перенесены из builder-core в chat-agent; бюджеты уже там. Следом — read-only обсуждение, поиск, контекст/кэш и eval. Workbench/стадии UI сейчас отложены; платные эксперименты — только по отдельному разрешению.

Discussion follow-up (ADR 0054): Read-only page.discuss@1 is registered explicitly; Ask defaults stay compatible; registered legacy Ask proposal profiles remain. Server run-trace/1 is persisted in ext["agent-trace"], with body opt-in on export. Browser Workbench remains deferred. Next: unified search/context and cache experiments.

Session completeness follow-up, 2026-11-17 (ADR 0055): host attempt ledger, interrupted/superseded/error accounting, retry links, provider-observed trace metadata, neutral usage origin, registry IDs and compact search evidence implemented. Server persistence, cache-key/prefix experiments, request-count targets, search relevance and answer-contract work remain separate stages.
