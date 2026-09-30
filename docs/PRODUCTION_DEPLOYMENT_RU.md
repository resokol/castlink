# CastLink 1.0: production install, update и rollback

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
4. создаёт backup persistent storage;
5. валидирует compose;
6. запускает PostgreSQL/web;
7. ждёт Docker health;
8. проверяет `/api/version`;
9. при health failure автоматически возвращает предыдущий web image.

LiveKit/Caddy/HAProxy этим скриптом не перезапускаются.

## Rollback

Каждый pre-update backup содержит `previous-web-image.txt`.

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
