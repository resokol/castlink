# CastLink: production install, update и rollback

Пользовательские установки обслуживаются своим установщиком: [Windows Server Setup](../distribution/INSTALL.md) или [standalone Linux](../distribution/LINUX_MANUAL.md). Описанные ниже `infrastructure/production`, `production-update.sh`, backup и rollback — отдельная операторская/legacy схема; её пути и поведение не являются инструкцией обновления любого установленного пакета. Текущие опубликованные версии и подтверждённые поставки: [Каталоге продуктов](../distribution/PRODUCTS.md).

## Три независимых направления выпуска

Текущая опубликованная версия — **1.0.0-rc.8**, с независимыми source/build ID по направлениям. Переход на 1.1 пока не выполняется. Для будущего старта 1.1 каждое направление получает собственную версию; далее номера могут меняться независимо в зависимости от того, какой компонент обновлён.

| Направление | Назначенная ветка основного репозитория | Источник версии | Тег пакета |
| --- | --- | --- | --- |
| CastLink Client — приложение Windows | `release/client` | `tracks.client.version` | `client-v<version>-<12-char-sha>` |
| CastLink Server Setup — Windows-мастер установки сервера на ПК/VPS | `release/server-setup` | `tracks.server-setup.version` | `server-setup-v<version>-<12-char-sha>` |
| CastLink Linux — самостоятельная установка сервера | `release/linux` | `tracks.linux.version` | `linux-v<version>-<12-char-sha>` |

Все три значения и назначенные ветки хранятся в `distribution/release-tracks.json`. Корневой `package.json` задаёт версию обычной web/development-сборки. При сборке серверного пакета выбранное направление передаёт свои `CASTLINK_PRODUCT_VERSION` и `CASTLINK_PRODUCT_BUILD_NUMBER` в Docker/Next.js, без изменения исходников и версий остальных пакетов. `main` остаётся интеграционной веткой. Перед очередным выпуском проверить существование и точный SHA выбранной ветки, перенести только согласованные изменения и проверить конечный source. Запись имени ветки в конфигурации не доказывает, что она создана на remote. Ветки направлений сохранять после выпуска: правило удаления слитых временных веток на них не распространяется. Основной `studiolink` хранит исходники, текущие пакеты и инструкции; `castlink-releases` остаётся публичным зеркалом одобренных пакетов.

В выпуске Server Setup `CastLink-Linux.tar.gz` сохраняется как транспортная зависимость Windows-мастера для VPS, строго из того же source SHA/выпуска. Это не повышает версию самостоятельного продукта Linux: его выпускают отдельным тегом `linux-v…`. Подставлять мастеру независимо выбранный Linux-архив нельзя.

Выпускать только изменившееся направление: Client через `windows-desktop-client.yml`, Server Setup или Linux через выбор направления в `easy-setup-packages.yml`. Раздельный выпуск не доказывает совместимость любых версий: в release notes указывать проверенные версии клиента, web/runtime и серверного пакета. Изменения серверного кода, общие для обоих способов установки, должны быть включены в оба серверных направления, когда они выпускаются.

Перед публикацией проверить настоящий артефакт на целевой ОС, полный состав пакета, `SHA256SUMS`, лицензии и source SHA. Черновик не является доступным выпуском. Ссылки сайта/публичной документации обновлять только после проверки и публикации соответствующего пакета; ссылки каждого направления обновляются независимо. Общий GitHub `releases/latest` не является источником версии всех трёх продуктов. [Выбор пакета и ссылки](../distribution/PRODUCTS.md).

Сборка Windows/контейнеров, публикация пакетов и production deploy — отдельные действия по этой инструкции; их нельзя считать выполненными по наличию PR или записи в плане. Build/source ID и контрольные суммы фиксируются в каталоге продуктов и manifest каждого выпуска.

## Цель

Сделать установку и обновление воспроизводимыми и убрать зависимость от набора ручных команд конкретного VPS.

Эта схема не меняет существующую сетевую архитектуру LiveKit/Caddy/HAProxy. Production compose в `infrastructure/production` управляет web + PostgreSQL; медиасервисы остаются отдельным слоем.

## Файлы

```text
infrastructure/production/docker-compose.yml
infrastructure/production/web.env.example
infrastructure/production/postgres.env.example
scripts/production-preflight.mjs
scripts/production-update.sh
scripts/production-rollback.sh
```

Реальные `web.env` и `postgres.env` игнорируются Git.

## Быстрый bootstrap

Ubuntu/VPS:

```bash
sudo bash scripts/install-ubuntu.sh \
  --image studiolink_web:1.0.0-a1b2c3d \
  --mode public \
  --domain castlink.example
```

Windows + Docker Desktop:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-windows.ps1 `
  -Image studiolink_web:1.0.0-a1b2c3d `
  -Mode edge
```

Режимы:
- `public` — VPS/сервер с публичной доступностью, где можно поднимать собственный ingress/TURN;
- `edge` — локальный ПК/офисный сервер, который в целевой архитектуре регистрируется в CastLink Cloud и не требует самостоятельного публичного ingress.

Bootstrap автоматически создаёт installation/server IDs, PostgreSQL password, session/encryption secrets и env-файлы. Секреты не печатаются в консоль.

## Подготовка сервера

Рекомендуемый root:

```text
/opt/studiolink
```

Постоянные каталоги:

```text
/opt/studiolink/data
/opt/studiolink/postgres
/opt/studiolink/backups
```

Скопировать шаблоны:

```bash
cd /opt/studiolink/infrastructure/production
cp web.env.example web.env
cp postgres.env.example postgres.env
chmod 600 web.env postgres.env
```

Заполнить секреты только на сервере.

## Immutable image

`CASTLINK_WEB_IMAGE` должен указывать на конкретный release tag или digest.

Допустимо:

```text
studiolink_web:1.0.0-a1b2c3d
registry.example/castlink@sha256:...
```

Не использовать:

```text
studiolink_web:latest
```

## Preflight

Перед обновлением:

```bash
cd /opt/studiolink
CASTLINK_WEB_IMAGE=studiolink_web:1.0.0-a1b2c3d \
  node scripts/production-preflight.mjs infrastructure/production
```

Preflight:
- проверяет наличие compose/env;
- проверяет UUID installation;
- не допускает `CHANGE_ME`;
- проверяет согласованность PostgreSQL password и DATABASE_URL;
- проверяет допустимый storage backend;
- запрещает `:latest`;
- не выводит секреты.

## Обновление

Новый image должен уже существовать локально или быть предварительно получен из registry.

```bash
cd /opt/studiolink
bash scripts/production-update.sh studiolink_web:1.0.0-a1b2c3d
```

Update script:

1. запускает preflight;
2. проверяет наличие нового image;
3. запоминает image текущего `studiolink-web`;
4. сохраняет receipt собственных образов для контролируемой очистки, без копирования данных;
5. валидирует Compose;
6. запускает PostgreSQL, конвертер и web;
7. ждёт health служб;
8. проверяет `/api/version`;
9. при health failure пытается вернуть прежний web/converter image;
10. только после успешных проверок удаляет доказанно принадлежащие установке неиспользуемые образы, сохраняя ресурсы других контейнеров.

LiveKit/Caddy/HAProxy этим скриптом не перезапускаются.

## Rollback

`production-update.sh` не создаёт backup данных и не записывает `previous-web-image.txt`. Legacy rollback ниже подходит только к заранее сохранённому оператором каталогу с таким файлом и доступным прежним image; после успешной очистки старый image может отсутствовать.

```bash
bash scripts/production-rollback.sh \
  /opt/studiolink/backups/pre-update-YYYYMMDD-HHMMSS
```

Rollback:
- проверяет сохранённый previous image;
- запускает его через тот же compose;
- ждёт health;
- проверяет version API.

Rollback web image сам по себе не восстанавливает данные. Если релиз уже выполнил необратимую data migration, отдельно использовать проверенный storage restore по инструкции `PERSISTENT_STORAGE_RU.md`.

## PostgreSQL migration

При первом переходе JSON -> PostgreSQL:

1. оставить `CASTLINK_STORAGE_BACKEND=json`;
2. сделать backup;
3. поднять PostgreSQL;
4. выполнить `pnpm postgres:migrate`;
5. выполнить `pnpm postgres:import-rooms`;
6. сверить данные;
7. только после этого поставить `CASTLINK_STORAGE_BACKEND=postgres`;
8. выполнить guarded update/restart web.

Не включать PostgreSQL backend до успешного import: startup validation намеренно fail-closed.

## Health gate

Web compose использует `/api/version` как локальный container healthcheck.

После запуска оператор дополнительно проверяет:

```bash
curl -fsS http://127.0.0.1:3000/api/version
curl -fsS http://127.0.0.1:3000/api/health
```

`/api/health` может вернуть 503 при проблеме LiveKit/TURN, даже если web сам работает. Это полезно для диагностики, но автоматический rollback web image основан на локальном health web-процесса, чтобы внешний TURN outage сам по себе не откатывал релиз.

## Логи

Production compose включает Docker `json-file` rotation:

```text
max-size: 10m
max-file: 3
```

для web и PostgreSQL.

## Ограничения текущего GitHub-only этапа

Пока не выполнено на чистом Ubuntu сервере:
- полный fresh install от нуля;
- pull из внешнего registry;
- production PostgreSQL migration;
- реальный update/rollback через этот новый compose;
- интеграция текущих Caddy/HAProxy/LiveKit unit-файлов в единый installer.

До этих проверок Issue #9 нельзя считать полностью закрытым.


## PostgreSQL backup перед update

Автоматический PostgreSQL backup при обновлении не выполняется. Если владельцу нужна копия, он создаёт и проверяет её отдельно до изменения. Backup БД и файлов `/data` — разные операции.

Ручной DB backup:

```bash
bash scripts/postgres-backup.sh   /opt/studiolink/backups/manual-postgres.dump
```

DB restore намеренно не является частью автоматического image rollback: откат web image и откат schema/data — разные операции. Для осознанного восстановления БД остановить web и выполнить:

```bash
docker compose -f /opt/studiolink/infrastructure/production/docker-compose.yml stop web
bash scripts/postgres-restore.sh   /opt/studiolink/backups/manual-postgres.dump   --confirm-replace
```

После этого web запускается вручную и проходят health/tenant checks. Это снижает риск автоматического разрушительного restore при обычном неудачном deploy.


## RC image из GitHub Actions

Для release candidate используется ручной workflow:

```text
Build RC image
```

Он доступен только для версии вида `1.0.0-rc.N` и публикует образ в GHCR без тега `:latest`.

Формат:

```text
ghcr.io/<owner>/castlink-web:<productVersion>-<12-char-git-sha>
```

Пример:

```text
ghcr.io/resokol/castlink-web:1.0.0-rc.1-a1b2c3d4e5f6
```

В image build передаётся:

```text
STUDIOLINK_RELEASE=<productVersion>-<short-sha>
```

Поэтому `/api/version` после deploy должен показать тот же buildId, что указан в image tag.

Workflow только собирает и публикует образ. Он НЕ выполняет production deploy.

Для VPS:

```bash
docker pull ghcr.io/resokol/castlink-web:1.0.0-rc.1-<short-sha>

cd /opt/studiolink
CASTLINK_WEB_IMAGE=ghcr.io/resokol/castlink-web:1.0.0-rc.1-<short-sha> \
  node scripts/production-preflight.mjs infrastructure/production

bash scripts/production-update.sh \
  ghcr.io/resokol/castlink-web:1.0.0-rc.1-<short-sha>
```

Если GHCR package private, серверу нужен read-only container registry token. Не сохранять его в репозитории или `web.env`.
