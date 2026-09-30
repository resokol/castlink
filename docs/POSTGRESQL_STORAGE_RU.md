# CastLink 1.0: переход persistent storage на PostgreSQL

## Цель

Перевести постоянные данные CastLink с durable JSON на PostgreSQL без изменения media-path.

PostgreSQL относится только к control plane. Аудио, видео, ICE, TURN, RTP/RTCP и LiveKit signaling не должны проходить через БД.

## Базовое правило архитектуры

```text
Browser / Studio
   |-- control requests --> Next.js API --> PostgreSQL
   |
   '-- WebRTC media ---------------------> LiveKit / TURN
```

Из этого следуют требования:

- сбой PostgreSQL не должен сам по себе разрывать уже установленную LiveKit/WebRTC media-сессию;
- high-frequency WebRTC stats, active speaker и transient reconnect state не записываются в PostgreSQL;
- SQL-запросы выполняются только для постоянных control-plane данных;
- PostgreSQL желательно размещать на том же сервере или в том же LAN/datacenter, что и web backend.

## Фаза 1: storage boundary

`apps/web/lib/room-store.ts` больше не привязывает API маршруты напрямую к JSON. Публичные функции `readRooms()`, `updateRooms()` и `ensureRoomAccessVersions()` сохранены, а реализация находится за контрактом `RoomStoreBackend`.

Текущий backend остаётся `JsonRoomStoreBackend`, поэтому эта фаза не меняет production-поведение.

SQL-схема первой миграции находится в:

`infrastructure/postgres/001_rooms.sql`

Она вводит:

- `castlink_schema_migrations`;
- `castlink_installations`;
- `castlink_rooms`;
- изоляцию строк комнат по `installation_id`.

## Фаза 2: PostgreSQL backend

Реализован server-only backend на `pg` с небольшим pool.

Переключение:

Node-local room storage теперь поддерживает studio scope. Существующие установки автоматически используют:

```text
STUDIOLINK_DEFAULT_STUDIO_ID=studio-default
```

Migration `002_studio_scope.sql` переносит старые строки в `studio-default` и меняет ключ комнаты на:

```text
installation_id + studio_id + name
```

Это позволяет нескольким studios иметь одинаковые display room names на одном media node без коллизии.


```text
CASTLINK_STORAGE_BACKEND=json       # default
CASTLINK_STORAGE_BACKEND=postgres
DATABASE_URL=postgresql://...
STUDIOLINK_INSTALLATION_ID=<uuid>
```

PostgreSQL backend:
- реализует тот же `RoomStoreBackend`;
- выполняет mutation в одной транзакции;
- блокирует строку installation через `FOR UPDATE`, поэтому параллельные read-modify-write не теряются;
- использует parameterized SQL;
- имеет connection/query timeouts;
- сохраняет порядок комнат через `sort_order`;
- при startup проверяет migration version и отказывается запускаться с пустым room-store;
- не переключается автоматически обратно на JSON при ошибке PostgreSQL.

## Фаза 3: JSON -> PostgreSQL migration

Добавлены команды:

```bash
DATABASE_URL=postgresql://... pnpm postgres:migrate

STUDIOLINK_DATA_DIR=/opt/studiolink/data \
STUDIOLINK_INSTALLATION_ID=<uuid> \
DATABASE_URL=postgresql://... \
pnpm postgres:import-rooms
```

Importer:
- не изменяет исходный JSON;
- сохраняет порядок комнат;
- при полном совпадении данных повторный запуск даёт no-op;
- если в БД уже есть отличающиеся данные, останавливается;
- `--replace` разрешает явную замену только после проверки backup.

Порядок production migration:

1. снять проверенный backup текущего `STUDIOLINK_DATA_DIR`;
2. создать PostgreSQL database/user с минимальными правами;
3. применить SQL migrations;
4. импортировать `installation.json` и `studiolink-rooms.json`;
5. сверить количество и имена комнат;
6. запустить приложение с PostgreSQL backend;
7. проверить room create/rename/password/mode/delete и access-version rotation;
8. оставить JSON backup read-only на время rollback window.

Importer не должен удалять исходный JSON.

Повторный запуск importer должен быть безопасным и не создавать дубликаты.

## Rollback

До удаления JSON-backup rollback должен состоять из:

1. остановки web;
2. возврата предыдущего verified image/config;
3. возврата JSON backend;
4. запуска web;
5. проверки комнат и access.

LiveKit/Caddy/TURN при storage rollback перезапускать не требуется.

## Что переносить после rooms

После подтверждения room backend можно последовательно перенести:

- moderator access / revoke state;
- studio-control persistent settings;
- другие durable control-plane records.

Telemetry/history следует оценивать отдельно. Высокочастотные RTC samples не должны автоматически переноситься в основную transactional БД.

## Проверка производительности

До/после migration измерить отдельно:

- API latency для room operations;
- LiveKit connection setup time;
- WebRTC RTT;
- jitter;
- packet loss;
- media freeze/recovery.

Ожидаемый результат: PostgreSQL может добавить небольшую стоимость control-plane запросам, но не должен давать систематического изменения RTT/jitter/media latency после установления WebRTC-сессии.

## Статус

В GitHub реализованы:
- storage boundary;
- `pg` dependency + type definitions;
- PostgreSQL connection pool;
- transactional `PostgresRoomStoreBackend`;
- SQL migration runner;
- JSON -> PostgreSQL room importer;
- fail-closed startup validation;
- integration test против реального PostgreSQL 16 в GitHub Actions.

Production/VPS не изменён. Default backend остаётся `json`; PostgreSQL включается только явным `CASTLINK_STORAGE_BACKEND=postgres`.
