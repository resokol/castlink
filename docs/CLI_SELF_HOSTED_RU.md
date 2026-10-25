# CastLink CLI: руководство разработчика

`apps/cli` — исследовательский TypeScript-инструмент с защищёнными операциями установки и обслуживания. Готовый `CastLink-Linux.tar.gz` использует другой инструмент, `scripts/linux-compose-setup.py`: его установка, обновление и восстановление пароля описаны в [Linux manual](../distribution/LINUX_MANUAL.md). Возможности этих инструментов нельзя переносить друг на друга по совпадению названий команд.

## Запуск из исходников

Нужны Node.js 22 и pnpm 9.15.0:

```sh
pnpm install --frozen-lockfile
pnpm --filter @castlink/cli build
node apps/cli/dist/main.js --help
node apps/cli/dist/main.js setup --target local --network loopback --dry-run
node apps/cli/dist/main.js doctor --json
pnpm test:cli
```

`--help` определяет доступные аргументы конкретной версии. Dry-run не исполняет стадии установки и не доказывает готовность Docker или медиасети. Пример удалённого планирования:

```sh
node apps/cli/dist/main.js setup --target remote --host 203.0.113.8 --user operator --domain studio.example.org --dry-run --json
```

Удалённые операции требуют системный OpenSSH, заранее доверенные host keys, вход по ключу и Python 3 на целевой машине. SSH executor использует фиксированные helpers и JSON через stdin. Он не добавляет host keys автоматически и не передаёт секреты через argv или сырой stderr.

## Профили и диагностика

Профиль связывает installation ID, запрос установки, выбранную цель и сохранённые результаты. Профили и credentials записываются атомарно, с закрытыми Unix permissions или ограниченной Windows DACL и эксклюзивным lock. Повреждённый профиль не считается новой установкой.

`CASTLINK_PROFILE_ROOT` задаёт абсолютный приватный каталог профилей и credentials. Без него используются платформенные пути. Относительный или небезопасный путь отклоняется. Настройка не переносит существующие профили и не изменяет системные каталоги пользователя.

`doctor --profile NAME` проверяет предпосылки сохранённой local/remote цели: ОС, архитектуру, выбранный Docker endpoint, Linux engine и Compose. `DOCKER_HOST` и `DOCKER_CONTEXT` учитываются; удалённый Docker context не доказывает наличие runtime на локальном компьютере. `status --profile NAME` наблюдает сохранённую установку и не создаёт новый профиль.

Отсутствующие предпосылки, неизвестный профиль и повреждённое состояние различаются. Команды с JSON возвращают структурированные проверки; код выхода нужно оценивать вместе с ними. `applicationReady:true` не равен общей готовности: доверие браузера и реальные медиа требуют отдельных проверок.

## Конфигурация и manifest

Release manifest проверяется строгой versioned schema: версии, архитектура, точные image digests и отсутствие неизвестных или повторяющихся JSON-ключей. Образы из тестовых fixture не являются устанавливаемым серверным выпуском.

`renderBundle()` в `src/bundle.ts` возвращает Compose, Caddyfile, конфигурацию служб и сведения о непроверенных предпосылках. Рендер сам не запускает процессы. Сериализованный Compose экранирует `$`; буквальную объектную модель нельзя подставлять вместо подготовленного текста. Inline `configs.content` требует совместимой версии Docker Compose.

Материализация создаёт новый защищённый каталог и согласованные секреты конфигурации. Существующий или частичный bundle блокирует повторное создание; неопределённую попытку нельзя обходить удалением её файлов. Пароли и ключи не попадают в profile, journal, Compose или сообщения об ошибках.

Loopback, LAN и Internet имеют разные сетевые ограничения. Internet-контракт и TURN: [CLI_INTERNET_CONTRACT](CLI_INTERNET_CONTRACT_RU.md), [диапазоны Compose](CLI_INTERNET_COMPOSE_RANGE_RU.md). Запись конфигурации не доказывает доступность DNS, сертификата, registry или сети.

## Стадии setup

Оркестрация объединяет подготовку config, проверенные images, services, migrations/seed, owner и наблюдение completion. Явные phase flags предназначены для отдельных стадий; они не отменяют их prerequisites.

- Images привязаны к manifest, архитектуре и выбранному engine; наличие registry metadata не означает завершённый pull.
- Services связываются с точными ресурсами установки. Чужой контейнер или неоднозначный ответ не становится собственным.
- SQL проверяет migrations, schema и installation/seed association. JSON и PostgreSQL не подменяют друг друга при ошибке.
- Первый доступ владельца выдаётся отдельно, через защищённый приватный артефакт; повтор не должен выдавать новые credentials.
- Completion проверяется на целевой машине. Потерянный completion или cursor не восстанавливается новым POST без достоверного наблюдения состояния.

Самостоятельная серверная настройка использует `CASTLINK_DEPLOYMENT_MODEL=self-hosted`; `legacy` выбирается явно. Setup token, origin и ограничения запроса проверяются сервером. Успешная настройка не выдаёт автоматически Super Admin session.

## Общая граница операций

Изменения config, images, services, SQL, owner и completion выполняются фиксированным helper под защищённым target-side lease. Binding содержит principal, canonical scope, выбранный engine/endpoint и generation. PRE, разрешённый эффект и POST выполняются внутри этой границы; клиентский journal сам по себе не даёт права выполнить эффект.

Private cursor сохраняет installation association. Только однозначно завершённый собственный эффект продвигает generation. Потерянный ответ или неизвестное состояние требуют наблюдения; автоматическое восстановление по PID, возрасту lock или удалению cursor не предусмотрено.

START, STOP, backup, update, rollback и uninstall имеют собственные guards и ограничения платформы. Cold update/rollback требуют точного профиля и явных canonical путей manifest, backup/checkpoint и новой attempt. Неудачная команда не означает автоматический rollback данных. Применимость определяется кодом команды и её платформенными проверками.

Windows launcher и broker описаны в [native contract](../native/primary-launcher/CONTRACT.md). Custom LiveKit admission и private storage имеют отдельные versioned capabilities: [idle seal](PRIVATE_LIVEKIT_IDLE_SEAL_RU.md), [CONFIG/SERVICES](CLI_PRIVATE_CONTROL_CAPABILITY_RU.md), [Windows volume](CLI_PRIVATE_CONTROL_WINDOWS_VOLUME_RU.md). Нельзя переносить proof между версиями, контейнерами, процессами или установками.

## Упаковка и проверка

[Упаковка CLI](CLI_PACKAGING_RU.md) описывает development-архивы с bundled Node, относительным launcher, manifest и integrity bootstrap. Их наличие не доказывает signing, доверие TLS, запуск на целевой ОС или завершённую серверную установку.

Для media preview используется [отдельный диагностический runtime](CLI_GUIDED_MEDIA_PREVIEW_RU.md). Unit fixtures, синтетические источники и успешный parse Compose не заменяют реальные browser/OS/Docker проверки. Перед использованием на рабочем сервере проверяйте конкретную версию, платформу, сетевой режим и границы незавершённых возможностей.
