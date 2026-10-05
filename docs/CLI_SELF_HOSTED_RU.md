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

## Проверка registry metadata — 05.10.2026

`releaseAvailabilityChecks({manifest,release,architecture}, executor)` — отдельная read-only библиотека для четырёх digest-pinned образов выбранного release. Перед первым subprocess она валидирует и копирует manifest, release, Linux amd64/arm64 и все полные repository refs (например `docker.io/library/postgres@sha256:…`); credentials, tags и неявные Docker Hub aliases не поддерживаются. Тот же API принимает выбранный local или OpenSSH executor: Docker metadata command исполняется на выбранной машине. CLI dispatch/setup, StateStore, profile и journal этот API не меняет.

Контракт — `docker buildx imagetools inspect --raw <ref>`: SHA-256 вычисляется по исходным байтам ответа без удаления whitespace/newline. Для OCI index/Docker manifest list выбирается единственный descriptor выбранной Linux-платформы; его child manifest загружается только как metadata и отдельно сверяется с digest, size и mediaType. Single-image config читается фиксированным `--format` шаблоном: только resolved manifest descriptor и Architecture/OS/Variant; Env/labels/history не выводятся. Descriptor должен совпасть с проверенным single manifest, а config обязан подтвердить Linux и выбранную архитектуру. Одних architecture claims из release или index недостаточно.

Результат — четыре независимые проверки `registry-web/postgres/livekit/caddy`. Missing/private/auth-denied/not-found, неизвестный CLI output, исключение/непустой stderr, неподдерживаемая схема, duplicate JSON keys (включая escaped aliases), digest/platform mismatch, обрезанный ответ и output >256 KiB дают фиксированный fail без raw registry/SSH данных. Поддержаны OCI/Docker schema 2 image/index и обычные image layers; nested indexes, artifact/subject, external URL/data descriptors, неоднозначные/повторные descriptors и нестандартные платформенные варианты отклоняются. Для arm64 поддержан пустой variant или v8; для amd64 — пустой.

Для запуска необходим совместимый Docker Buildx с `--raw` и `--format`; отсутствие/иная форма ответа даёт fail. Проверены официальные Docker Buildx docs/source и help установленного v0.31.0. Unit fixtures доказывают parsing/orchestration и существующий SSH JSON stdin seam; настоящие registry requests, SSH/VPS, Windows/macOS и engine/platform acceptance здесь не выполнялись. Registry metadata availability отдельно от загрузки layers, startup служб, TLS/public-registry provisioning, media и полного Task 6; journal release/runtime verified не выставляется. Исполнитель и самопроверка — GPT-6.1 Sol medium; независимое ревью выполняет координатор.

Проверки: первоначальный RED — 11 missing-API failures из 12 tests (один некорректный early-validation assertion исправлен); отдельные RED → GREEN для точной формы platform response, registry port и настоящего Docker layer mediaType. Итоговый CLI suite: 178 tests, 177 passed, 0 failed, 1 Windows ACL skipped; новые 17 registry tests passed. CLI build/typecheck прошли; baseline отдельно не повторялся, web проверки не запускались.

Независимое Sol medium review выявило I1: Python SSH helper с `text=True` нормализовал CRLF/lone CR и ломал digest правильного raw manifest. Fix round 1 захватывает subprocess bytes и явно декодирует UTF-8, сохраняя stdout/stderr переводы строк и UTF-8 stdin; argv, timeout/caps и фиксированные transport errors сохранены. Настоящий helper исполнялся локальным Python с fixture subprocess, не через SSH/registry: отдельные CRLF/lone CR+Unicode regressions и registry API через helper дали RED 4 failures → GREEN. Изменённые байты по-прежнему дают digest fail. Итоговый CLI suite fix: 183 tests, 182 passed, 0 failed, 1 Windows ACL skipped; CLI build/typecheck и каталог 430 прошли. Независимое ревью fix выполняет координатор.

## Проверки и ограничения

Архитектуру и ревью doctor выполнила Astra, реализацию и тесты — GPT-6.1 Sol. До интеграции в Git checkout авторская CLI-копия прошла build/typecheck и Node 22.23.3 suite: 73 passed, 0 failed, 1 Windows ACL skipped. Регрессии SSH CheckHostIP/VerifyHostKeyDNS и типов host/user в повреждённом профиле воспроизведены до исправлений и проверены после них. В интегрированном Git checkout прошли frozen install pnpm 9.15.0, общая TypeScript-проверка web + CLI (TypeScript 5.9.3), CLI suite (73 passed, 1 Windows ACL skipped) и 86 существующих стабильных web checks. Эти проверки относятся к первому CLI checkpoint, где серверные исходники и Dockerfile совпадали с RC2; независимая серверная настройка добавляется следующим отдельным изменением. GitHub CI проверяет frozen install, TypeScript, CLI и существующие web checks после публикации ветки.

Серверный Task 1 реализовал GPT-6.1 Sol, проверила Astra. В облачном checkout выполнены общий typecheck web + CLI, production build, 12 сценариев API/формы/seed boundary и профильные проверки access/licensing/storage/installers. Полный стабильный набор — 87 программ. GitHub CI для серверного коммита `69e1e66` полностью прошёл: включая настоящую PostgreSQL-регрессию fresh self-hosted/legacy и сохранение существующих cloud/edge при повторном seed, сборку, node operations и version API. После замечаний ревью повторены затронутые проверки. Подмена SQL driver в unit boundary отдельно от этой CI-проверки не является проверкой настоящей БД.

Генератор Task 4 реализовал GPT-6.1 Sol, архитектуру и итоговое ревью выполнила Astra. Полный CLI набор: 90 тестов, 89 passed, 0 failed, 1 Windows ACL skipped; общая TypeScript-проверка web + CLI прошла. Целевой набор 22/22 включает `docker compose config --quiet` на Compose 2.40.3 с временными файлами-заглушками, путями с пробелами/Unicode/`$` и проверкой прочитанных fixture env. Docker daemon, контейнеры и runtime bind mounts этой проверкой не испытывались. Дополнительно официальный Caddy 2.11.4, проверенный по опубликованной SHA-512, успешно выполнил `adapt --validate` для loopback и LAN с отдельными временными XDG-каталогами, без запуска listeners. Адаптированный JSON подтверждает admission перед LiveKit и отключённую установку доверия CA. Для защиты токенов исключены request error/access logs Caddy; это уменьшает детализацию HTTP-диагностики, безопасное редактирование таких журналов остаётся отдельной задачей.

Реальные Windows/macOS и SSH/media acceptance этого этапа не выполнены. Windows platform probe использует номер kernel build и пока не отличает Windows Server с тем же ядром от Windows 11. Новый server image и server release manifest не опубликованы. Операционные подробности текущего VPS не являются доказательством готовности этого CLI.

План: [реализация](superpowers/plans/2026-10-05-self-hosted-cli.md). Спецификация: [Windows/macOS CLI](superpowers/specs/2026-10-05-self-hosted-cli-design.md). Модель: [независимый self-hosted](ARCHITECTURE_SELF_HOSTED_RU.md).

## Защищённая remote материализация — 05.10.2026

`materializeRemoteBundle(input, {scopeRoot, directory}, executor)` из `apps/cli/src/remote-bundle.ts` — отдельная библиотека для Linux loopback/LAN candidate bundle через выбранный `SshExecutor`. Input содержит release manifest, installationId, architecture, network и bindIPv4; данные копируются и проверяются до executor. Caller обязан сначала сохранить installation identity и удерживать собственный profile lock; библиотека не обеспечивает безопасность произвольного StateStore. installationId связывает артефакты и не является серверной/platform авторизацией. CLI setup, profile/journal и remote resume ещё не подключены.

ScopeRoot и все родители назначения должны заранее существовать под контролем оператора. Пути абсолютные canonical POSIX, directory строго внутри scope. Scope/потомки требуют euid owner и 0700. Предки выше scope допускают владельца корня файловой системы (обычно uid0) или euid, без group/other write; sticky ancestor владельца корня, например /tmp, допускается с удержанием directory descriptors. Это работает и для обычного Ubuntu пользователя: sudo не используется. Symlinks, чужие владельцы, небезопасные права, hard links файлов и неизвестные существующие каталоги отклоняются без repair/chmod/delete. Злоумышленное изменение артефактов другим процессом того же владельца не блокируется profile lock: оператор должен сохранять контроль родителей.

Общая `bundleContents()` формирует тот же schema Compose/env/LiveKit, что local writer. Фиксированный `python3 -c` получает только ограниченный JSON по sensitive stdin, создаёт private directory эксклюзивно и генерирует credentials один раз. Передаются шаблоны с credential slots; marker collision в пользовательских данных отклоняется до executor, Compose никогда не подвергается secret substitution. Credentials не уходят в argv, stdout/stderr, result/ошибки. Result содержит пути, installation/project/node identity, fingerprints и checks. OpenSSH strict known-host/publickey contract сохраняется; response JSON отклоняет лишние/duplicate keys, включая escaped aliases.

Приватный `owner.json` связывает scope/path/identity и hash validated request/template; `receipt.json` содержит owner и hashes четырёх конфигурационных файлов. Все файлы 0600/euid/nlink1, directory 0700; используется nofollow/openat, exclusive writes и fsync файлов/каталогов. Retry сверяет фактическую защиту, ownership, exact Compose и все env/LiveKit байты через общий шаблон и извлечённые исходные credentials, затем receipt hashes. Один receipt не подтверждает config. Потеря ответа после durable commit допускает только verified retry с прежними байтами; частичный directory/owner/receipt требует диагностики и не регенерируется. Конкурентные writers не перезаписывают чужие/частичные файлы.

Проверки исполнителя GPT-6.1 Sol medium: 28 actual-helper tests passed, включая локальную execution через тот же SshExecutor JSON seam, euid1000, concurrency, stdlib fsync fault injection и lost-response retry. Настоящие SSH/VPS, Windows/macOS, containers/layers/SQL/owner/media не выполнялись. Это library-only partial milestone: provisioned parents, remote preflight/release checks и caller identity lifecycle остаются обязанностью интеграции; полный Task 6 с setup/resume для обоих targets и acceptance ещё не завершён. Независимое ревью выполняет координатор после local commit.

Итоговая локальная проверка remote slice: CLI build/full suite 212 tests — 211 passed, 0 failed, 1 Windows ACL skipped; typecheck и manual catalog 433 files прошли. Дополнительный durability RED → GREEN подтверждает fsync реальных файлов/каталогов и при verified retry, без перезаписи credentials. CI этого commit ещё не подтверждён.

Независимое Sol medium review remote slice выявило I1: owner.requestHash связывал templates/path/identity, но release version, Node version и architecture metadata могли меняться без изменения Compose. Fix round 1 включает полный validated bundle input без secretFiles в sensitive stdin и canonical requestHash; metadata-only mismatch теперь отклоняется без изменения артефактов. Actual-helper RED 4/4 → focused GREEN 32/32 проверяет release/nodeVersion/release architecture/image architecture declarations и сохранение всех credential bytes; setup/journal contract не изменён. Итог fix round 1: CLI build/full suite 216 tests, 215 passed, 0 failed, 1 Windows ACL skipped; typecheck и manual catalog 433 files прошли. CI и реальные SSH/VPS/platform acceptance по-прежнему не подтверждены.

## Task 6: CLI подготовка конфигурации (05.10.2026)

GPT-6.1 Sol medium подключил `setup --prepare-config` к выбранной машине: local executor либо существующий строгий `SshExecutor` с publickey и ранее доверенным `known_hosts`. Требуются явные `--release VERSION --release-manifest PATH --architecture amd64|arm64 --bind-ipv4 IP --journal-directory LOCAL_PATH`; для remote дополнительно `--remote-scope PRIVATE_REMOTE_PATH`, внутри которого расположен `--root`. Manifest — строгий versioned JSON до 64 KiB. Internet пока отклоняется до исполнения; поддерживаются loopback/LAN. `--dry-run` сохраняет прежний preview, не читает manifest и не вызывает executor/SSH.

Пример для своего VPS (это команда подготовки, а не подтверждение выполнения на VPS):

```sh
castlink setup --target remote --host VPS_HOST --user deploy --profile studio \
  --network loopback --root /srv/castlink-private/bundle --release 1.0.0-rc.2 \
  --prepare-config --release-manifest /operator/release.json --architecture amd64 \
  --bind-ipv4 127.0.0.1 --journal-directory /operator/private/studio-journal \
  --remote-scope /srv/castlink-private --json
```

Родители root/journal и profile storage должны быть заранее подготовлены оператором; remote scope и промежуточные каталоги требуют владельца текущего SSH-пользователя и mode 0700. CLI не использует sudo, не чинит разрешения существующих private артефактов. Read-only remote scope check предшествует локальному резервированию профиля. Preflight проверяет фактическую ОС/архитектуру, выбранный Docker endpoint, Compose, bind/порты; registry checks проверяют metadata четырёх pinned образов. Без всех обязательных PASS конфигурация не создаётся. Эти проверки не скачивают layers и не подтверждают runtime installation или media.

Owned local journal связывает installation ID, полный setup request и preparation (validated manifest, architecture, bind и remote scope). Orchestration owner содержит дополнительное поле `preparation`: существующие library-only local owner records автоматически не принимаются и не переписываются. Local receipt schema сохранён; remote owner hash по-прежнему связывает полный validated bundle declaration, а служебный `verifyOnly` исключён из hash, чтобы retry проверял те же файлы. До remote writer сохраняются running journal и profile paths/attempt. После попытки retry выполняет только проверку; отсутствующая папка не создаётся заново. Потерянный ответ после полного write допускает проверку с прежним ID и неизменными credentials. Real artifacts проверяются даже при journal verified. Секреты остаются в private target files и не попадают в result/ошибки/argv/profile/journal.

Успех этого этапа возвращает **код 3**, JSON `status: "partial", ready: false` и фиксированное сообщение. Verified только observed preflight/release/config; runtime/services/migrations/seed/owner/verify остаются pending. Полная установка ещё не готова, URL/owner invite не выдаются. Обычный setup по-прежнему отказывается исполнять отсутствующий runtime workflow.

POSIX journal/profile persistence теперь sync-ит файлы и каталоги после rename, включая reservation parents. На Windows Node directory fsync недоступен: остаются file sync и atomic rename, power-loss durability metadata на Windows не заявлена. Процессные failure/retry safeguards сохранены; Windows DACL/platform acceptance требует настоящей Windows-проверки. Исполнитель не обращался к production ПК/VPS/SSH/registry, контейнерам, службам или SQL. Тесты используют fixtures для OS/runtime/registry и actual temporary files/Python helper для materialization и read-only remote scope.

Авторская итоговая проверка orchestration: CLI build/full suite — 240 tests, 239 passed, 0 failed, 1 Windows ACL skipped; CLI typecheck, `git diff --check`, entrypoint help и remote dry-run с отсутствующим manifest прошли. 24 новых теста включают actual-helper lost reply, byte-preserving retry, удалённый после attempt bundle, ошибку fsync journal file/profile directory, before/after journal boundaries, profile save before/after persistence, shared journal/concurrent profile refusal и отсутствие конфигурационных эффектов при preflight/registry/scope failures. Независимое scoped review и публикация — следующий этап координатора; CI и production acceptance не заявлены.
