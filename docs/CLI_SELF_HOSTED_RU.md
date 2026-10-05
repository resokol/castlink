# CastLink CLI: developer preview

Дата: 05.10.2026. GitHub-ветка `feat/self-hosted-cli-github` основана на RC2 `24a05c909e1a4aae622fd3b4e2605ccbd5883975`. Цель первого выпуска — Windows/macOS, локальная установка и собственный VPS, работа через существующий браузерный UI. Этот checkpoint содержит каркас CLI и диагностику предпосылок; автоматическая установка сервера ещё не подключена.

## Что работает в этой ветке

- Консольный мастер выбора local/remote, профиля и режима доступа; проверка аргументов и pure planner девяти шагов установки.
- `setup --dry-run` не создаёт конфигурацию, не устанавливает runtime и не связывается с VPS.
- Профили и journal: атомарная запись, Unix permissions/Windows restricted ACL, эксклюзивный lock, сохранение installationId, отказ от трактовки повреждённого профиля как новой установки.
- `doctor` проверяет предпосылки этого компьютера; `doctor --profile NAME` читает сохранённый профиль и проверяет его local/remote цель.
- Проверяются ОС, архитектура, эффективный Docker endpoint, Linux engine и Compose v2. Удалённый Docker context не считается runtime проверяемой машины.
- SSH использует системный OpenSSH, существующие доверенные host keys, вход по ключу и фиксированный Python 3 helper. Параметры передаются через JSON stdin, секреты и сырой stderr не выводятся. Диагностика не меняет known_hosts, профиль или journal, не устанавливает runtime и не запускает контейнеры.
- Validator/schema developer release manifest проверяет точные версии, Node 22, image digests, архитектуры и отсутствие дополнительных полей. Фиктивные образы из unit tests не являются опубликованным server bundle.

Службы CastLink, DNS/TLS, ICE/TURN и реальные аудио/видео остаются `unverified`: успешно проверенные предпосылки не подтверждают завершение установки или готовность медиасети.

## Запуск из исходников

Требуется Node 22 и pnpm 9.15.0. Из корня репозитория:

```text
pnpm install --frozen-lockfile
pnpm --filter @castlink/cli build
node apps/cli/dist/main.js --help
node apps/cli/dist/main.js setup --target local --network loopback --dry-run
node apps/cli/dist/main.js setup --target remote --host 203.0.113.8 --user operator --domain studio.example.org --dry-run --json
node apps/cli/dist/main.js doctor --json
node apps/cli/dist/main.js doctor --profile home --json
pnpm test:cli
```

Адреса — примеры. `home` — имя уже сохранённого профиля: doctor его не создаёт и не принимает под управление существующий сервер. Remote-проверка требует заранее доверенный ключ сервера, вход по SSH-ключу и Python 3 на Ubuntu 22.04/24.04 amd64/arm64. Отсутствие OpenSSH — предупреждение для local и блокер для remote. DOCKER_HOST/DOCKER_CONTEXT учитываются при выборе эффективного endpoint.

`doctor` возвращает 3 при непрошедших предпосылках, 2 при неизвестном имени профиля и 4 при повреждённом сохранённом профиле. `doctor --json` выдаёт массив `CheckResult[]` и при ошибках. `--media`, setup без `--dry-run` и команды обслуживания пока возвращают явный отказ. В продуктовый выпуск планируется включённый Node runtime; текущие команды требуют developer toolchain.

## Независимая настройка сервера

После CLI checkpoint в этой ветке реализована независимая первичная настройка сервера. По умолчанию используется `self-hosted`: API и браузерная форма требуют setup token, название сервера и режим, без кода активации и обращения к сервису лицензий. Только явный `CASTLINK_DEPLOYMENT_MODEL=legacy` сохраняет прежнюю активацию. Неизвестное значение модели блокирует настройку.

Существующие проверки origin, токена и размера запроса сохранены. Эксклюзивный файловый lock защищает настройку от параллельных POST и повторной активации. После аварийного завершения оставшийся lock не удаляется автоматически: оператор проверяет отсутствие действующей операции перед ручным восстановлением. Успешный ответ содержит `{ok:true}`; настройка не выдаёт Super Admin, cookies или данные активации. Первый доступ владельца остаётся отдельной процедурой.

Шаблон env и новые установки не задают creator endpoints. При создании нового node seed задаёт тип `self-hosted`, а явный legacy — `cloud`. Повторный seed сохраняет тип существующего node. Windows installer отказывается перезаписывать обнаруженные файлы существующей установки. Web image включает SQL миграции комнат. Эти изменения проверяются в исходниках и CI; новый server image ещё не опубликован.

Это новая реализация контракта Task 1 по согласованной спецификации. Недоступные Windows-коммиты не восстановлены; при возвращении ПК требуется сравнение содержимого с сохранением его локальных изменений.

Полный versioned server bundle, installer/runtime bootstrap для macOS, первый доступ владельца из CLI, setup/resume, media doctor, backup/update/rollback/uninstall и подписанные Windows/macOS пакеты остаются следующими этапами.

## Генератор локальной конфигурации

`renderBundle()` в `apps/cli/src/bundle.ts` возвращает модель Compose, JSON/YAML текст, Caddyfile, project/node identity и непроверенные предпосылки. Вход содержит digest-pinned release manifest, архитектуру, installationId, явно выбранный IPv4 и пути защищённых web.env/postgres.env/livekit.yaml. Генератор не читает эти файлы, не записывает конфигурацию и не запускает процессы. Команда `setup` пока не применяет результат.

Поддержаны loopback `127.0.0.1` и LAN с частным IPv4. Четыре сервиса используют отдельную сеть и тома проекта. HTTPS 443/TCP, ICE 7881/TCP и 61000–61100/UDP публикуются только на выбранном адресе; PostgreSQL, web и прямой signalling не публикуются. Caddy пропускает `/rtc` через локальный admission перед LiveKit, с сохранением пути. Генератор принудительно задаёт self-hosted/local admission и внутренний LiveKit URL.

Результат требует **Docker Compose 2.23.1+** из-за inline `configs.content`; будущий executor должен проверить это до применения. Общий `doctor` пока проверяет только Compose v2. `composeModel` хранит буквальные пути, а `composeText` экранирует `$` как `$$` для Compose interpolation; применять следует сериализованный текст.

Доступность image digests, multiarch, файлы и их права, миграции/seed, свободные порты, доверие локальному CA, соответствие LiveKit-конфига портам и реальные медиа требуют отдельной проверки. Internet/TURN этим генератором явно отклоняются. Защищённая материализация описана ниже; применение bundle и установка сертификата остаются следующим шагом.


### Защищённая материализация кандидата

`materializeBundle(input, absoluteDirectory)` создаёт новый локальный каталог с `compose.yaml`, `web.env`, `postgres.env`, `livekit.yaml`. Родительский каталог уже должен существовать и находиться под контролем владельца; симлинки в предках отклоняются. Unix: каталог 0700, файлы 0600; Windows использует существующий exact DACL helper (реальная Windows-проверка этого среза ещё не выполнена). Результат содержит только пути, identities, requirements и unverified checks. Случайные DB/LiveKit/session/encryption/setup/node секреты создаются один раз и согласованы между конфигурациями; в Compose, profile, journal и ошибки их значения не передаются.

Любой существующий путь, включая частичный bundle, блокирует повторную материализацию с кодом 4. При сбое записи приватные частичные артефакты сохраняются для диагностики; ошибка имеет код 1 и не содержит исходного OS/ACL exception. Автоматический resume пока отсутствует, удалять каталог для обхода конфликта установщик не пытается. Backend остаётся `json`, как у действующего installer; migrations/seed/owner будут отдельными prerequisite steps.

LiveKit JSON/YAML задаёт 7880 внутри сети Compose, ICE TCP 7881, UDP 61000–61100, `node_ip` из выбранного bind и `use_external_ip=false`; loopback candidate включён только для loopback. Это кандидат, не доказательство работы ICE/Docker Desktop. Совместимость защищённого bind mount с UID контейнера, реальный LiveKit config parse, TLS trust, images, SQL, media и полная установка остаются unverified. `setup` и SSH writer не подключены.

Реализация и проверки — GPT-6.1 Sol medium. Новые failure/credential tests сначала RED (API отсутствовал), затем GREEN. CLI suite: 97 tests, 96 passed, 0 failed, 1 Windows ACL skipped; CLI TypeScript build прошёл. Проверки затронутого среза не повторяют историческую web/media/platform acceptance.

## Bundle preflight перед будущей установкой

`bundlePrerequisiteChecks(input, executor, remote)` проверяет дополнительные предпосылки локального loopback/LAN bundle: точную запрошенную архитектуру и стабильный Docker Compose v2 не ниже 2.23.1. Переиспользуются существующие platform/context/Linux-engine проверки. Общий `doctor` сохраняет прежний contract проверки Compose v2; новая bundle-проверка пока не подключена к `setup` или флагу doctor.

Только после подходящих platform/context/engine/Compose проверяется явно выбранный IPv4 и доступность TCP 443/7881, UDP 61000–61100. Проверка кратковременно привязывает sockets к выбранному адресу и сразу освобождает их; TCP probe может кратко слушать и закрывает случайное соединение. Это snapshot доступности для текущего пользователя, не reservation, не service startup и не проверка прохождения Docker/ICE/media. Permission denial, занятые порты, отсутствующий адрес, ошибка или неполная схема helper блокируют предпосылки; при неподтверждённом runtime networking остаётся unverified.

Local использует фиксированный Node helper, remote — standard-library Python через переданный существующий SSH executor. Вход передаётся JSON на stdin; адрес и параметры не интерполируются в shell/script. Диагностика содержит фиксированные сообщения без raw stdout/stderr/exception. Реальные Windows/macOS/SSH probes, WSL/platform identity, disk/memory/sudo, installer bootstrap, container UID/config parser, TLS trust, images и media acceptance остаются отдельными неподтверждёнными этапами; этот срез не закрывает весь Task 5.

Task5 реализовал GPT-6.1 Sol medium, отдельное scoped review и проверку fix выполнил GPT-6.1 Sol medium (открытых Critical/Important нет): build/typecheck и CLI suite 111 tests (110 passed, 0 failed, 1 Windows ACL skipped) прошли. Scoped review выявил обход strict schema через duplicate JSON object keys; raw/escaped-equivalent regression воспроизведена RED → GREEN, ключи проверяются до доверия результату. Новые Node/Python helpers проверены на реальных временных loopback TCP/UDP sockets: busy detection и немедленный rebind после cleanup; Python запускался локально, не через настоящий SSH/VPS. Фиксированные production ports в real tests не привязывались. Ошибки версии Compose/requested architecture воспроизведены RED → GREEN; daemon-free Compose config regression прошёл.

## Защищённая локальная подготовка config — 05.10.2026

`prepareLocalConfig(plan, {release, architecture, bindIPv4, journalDirectory}, executor, store)` в `apps/cli/src/setup.ts` объединяет bundle preflight, `StateStore`, `FileJournal` и materialization. Это отдельная библиотека для validated local loopback/LAN плана; команда `setup` не подключена. Remote, блокеры, несовместимые шаги/request/release и небезопасные пути отклоняются до записи. Caller не передаёт готовые pass checks: проверки выполняет существующий executor. Родители bundle и journal уже должны существовать; journal задаётся отдельным абсолютным каталогом, не перекрывающим bundle.

После настоящего preflight эксклюзивный profile lock защищает сохранение installationId до генерации credentials. Сначала сохраняется identity-only profile, затем journal `config:running` и ссылки, обозначающие начало создания артефактов. Поэтому удаление bundle и journal не разрешает retry регенерировать credentials. Ошибки до первой записи profile не создают секретов; retry identity-only профиля с pending config сохраняет ID. Ошибка после отметки начала записи без полного bundle требует диагностики.

Journal нового профиля создаётся эксклюзивно вместе с приватным `owner.json`, содержащим installationId и request. Существующий неизвестный каталог, даже пустой или с all-pending journal, отклоняется без изменения его содержимого и без profile/credentials. Reservation каталогом защищает от двух разных profile locks, выбравших общий journal. Retry требует совпадения durable owner с сохранённым профилем, включая identity-only состояние. Если первая запись profile не сохранилась, удаляется только собственная неизменённая reservation без journal и посторонних файлов; сбой с уже сохранённым профилем оставляет ownership для retry. Неполный owner требует диагностики.

Полный bundle дополнен приватным `receipt.json`: identity, release/bind/architecture и SHA-256 четырёх файлов; значения credentials в receipt не записываются. Retry с полным receipt проверяет реальные пути, защищённость, точный Compose, env schema/identity/согласование DB и LiveKit credentials, фиксированные LiveKit network settings и hashes. Journal сам по себе не доказывает готовность. На Unix проверяются владелец, 0700/0600 и отсутствие hard links у файлов; на Windows читается exact restricted DACL без её автоматического исправления. Симлинки в артефактах и предках отклоняются. Родительские каталоги должны оставаться под контролем оператора; profile lock не блокирует внешние изменения файлов другим процессом владельца.

Неполные, отсутствующие или изменённые артефакты, включая окно materialize → receipt, сохраняются для диагностики: автоматического восстановления или перезаписи credentials нет. После проверки только `config` отмечается verified; все остальные journal stages остаются pending. Runtime/Compose/bind checks описывают наблюдённые предпосылки, а images/services/TLS/media, миграции, seed, owner и завершение установки остаются unverified. Raw OS/ACL/subprocess/dependency errors и ошибки освобождения lock редактируются фиксированными сообщениями; результат/profile/journal не содержат credential values.

Исполнитель и локальная самопроверка — GPT-6.1 Sol medium; независимое ревью выполняется координатором после этого commit. Проверки 05.10.2026: initial focused RED 36/36 (API отсутствовал), GREEN 36/36; отдельный regression удаления bundle+journal RED → GREEN. Итоговые 45 setup tests прошли в CLI suite 156 tests: 155 passed, 0 failed, 1 Windows ACL skipped; CLI build/typecheck прошли. Linux tests используют fixture executor для Windows/macOS/runtime/bind preflight, а реальные временные файлы — для materialization/retry. Это library-only partial milestone Task 6; Windows/macOS/SSH/LiveKit acceptance, release readiness и полный setup/resume ещё не подтверждены.

После независимого Sol medium review исправлен I1 (journal ownership): 5 regressions сначала RED, затем focused 50/50 GREEN. Проверки fix round 1 от 05.10.2026: CLI suite 161 tests, 160 passed, 0 failed, 1 Windows ACL skipped; CLI build/typecheck и manual catalog 428 прошли. Полный Task 6 остаётся незавершённым.

## Проверки и ограничения

Архитектуру и ревью doctor выполнила Astra, реализацию и тесты — GPT-6.1 Sol. До интеграции в Git checkout авторская CLI-копия прошла build/typecheck и Node 22.23.3 suite: 73 passed, 0 failed, 1 Windows ACL skipped. Регрессии SSH CheckHostIP/VerifyHostKeyDNS и типов host/user в повреждённом профиле воспроизведены до исправлений и проверены после них. В интегрированном Git checkout прошли frozen install pnpm 9.15.0, общая TypeScript-проверка web + CLI (TypeScript 5.9.3), CLI suite (73 passed, 1 Windows ACL skipped) и 86 существующих стабильных web checks. Эти проверки относятся к первому CLI checkpoint, где серверные исходники и Dockerfile совпадали с RC2; независимая серверная настройка добавляется следующим отдельным изменением. GitHub CI проверяет frozen install, TypeScript, CLI и существующие web checks после публикации ветки.

Серверный Task 1 реализовал GPT-6.1 Sol, проверила Astra. В облачном checkout выполнены общий typecheck web + CLI, production build, 12 сценариев API/формы/seed boundary и профильные проверки access/licensing/storage/installers. Полный стабильный набор — 87 программ. GitHub CI для серверного коммита `69e1e66` полностью прошёл: включая настоящую PostgreSQL-регрессию fresh self-hosted/legacy и сохранение существующих cloud/edge при повторном seed, сборку, node operations и version API. После замечаний ревью повторены затронутые проверки. Подмена SQL driver в unit boundary отдельно от этой CI-проверки не является проверкой настоящей БД.

Генератор Task 4 реализовал GPT-6.1 Sol, архитектуру и итоговое ревью выполнила Astra. Полный CLI набор: 90 тестов, 89 passed, 0 failed, 1 Windows ACL skipped; общая TypeScript-проверка web + CLI прошла. Целевой набор 22/22 включает `docker compose config --quiet` на Compose 2.40.3 с временными файлами-заглушками, путями с пробелами/Unicode/`$` и проверкой прочитанных fixture env. Docker daemon, контейнеры и runtime bind mounts этой проверкой не испытывались. Дополнительно официальный Caddy 2.11.4, проверенный по опубликованной SHA-512, успешно выполнил `adapt --validate` для loopback и LAN с отдельными временными XDG-каталогами, без запуска listeners. Адаптированный JSON подтверждает admission перед LiveKit и отключённую установку доверия CA. Для защиты токенов исключены request error/access logs Caddy; это уменьшает детализацию HTTP-диагностики, безопасное редактирование таких журналов остаётся отдельной задачей.

Реальные Windows/macOS и SSH/media acceptance этого этапа не выполнены. Windows platform probe использует номер kernel build и пока не отличает Windows Server с тем же ядром от Windows 11. Новый server image и server release manifest не опубликованы. Операционные подробности текущего VPS не являются доказательством готовности этого CLI.

План: [реализация](superpowers/plans/2026-10-05-self-hosted-cli.md). Спецификация: [Windows/macOS CLI](superpowers/specs/2026-10-05-self-hosted-cli-design.md). Модель: [независимый self-hosted](ARCHITECTURE_SELF_HOSTED_RU.md).
