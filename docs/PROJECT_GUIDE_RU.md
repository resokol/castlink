> Исторический документ линии RC-1/RC-2. Текущее состояние и проверки: [WORKING_STATE_RU.md](WORKING_STATE_RU.md).

# CastLink 1.0.0-rc.1 — гайд по проекту

Актуальный срез: 01.10.2026, release candidate `1.0.0-rc.1`.
Этот документ заменяет старую карту 0.9.x. Источник истины для RC-1 — ветка `release/1.0.0-rc.1`, immutable release image и профильные документы в `docs/`.

## Главное изменение 1.0

CastLink разделён на два независимых тракта:

```text
Browser / Studio
  |-- HTTPS control requests --> Next.js API --> PostgreSQL / control plane
  |
  '-- WebRTC media -----------------------> LiveKit / TURN
```

PostgreSQL НЕ находится в media path. Аудио, видео, ICE, RTP/RTCP и установленная WebRTC-сессия не проходят через БД.
Это принципиальный инвариант: развитие storage/control plane не должно добавлять систематическую media latency.

## Архитектура RC-1

- **Next.js web** — UI, auth, API, выдача LiveKit JWT, управление комнатами и control-plane операции.
- **PostgreSQL** — постоянные control-plane данные и node-local room storage.
- **LiveKit** — WebRTC SFU: аудио, видео, screen share и signaling.
- **TURN / HAProxy / Caddy** — сетевой ingress и fallback; media services остаются отдельным слоем.
- **Control plane** — studios, organizations, nodes, placement, heartbeat, routing и tenant-aware failover.
- **Heartbeat** — подписанная телеметрия node для scheduler/control plane.
## Модель данных и tenancy

Новая иерархия:

```text
Account -> Organization -> Studio -> Room -> Participants
```

Room name больше не считается глобальным идентификатором. Node-local комнаты изолируются минимум по:
`installation_id + studio_id + name`.

Для старой установки используется compatibility scope `studio-default`.
Control-plane schema находится отдельно от node-local room storage и может жить в той же PostgreSQL database.

Ключевые файлы:
- `apps/web/lib/postgres-room-store.ts` — PostgreSQL backend комнат;
- `apps/web/lib/room-store.ts` — storage boundary / совместимый API;
- `apps/web/lib/control-plane-store.ts` — control-plane persistence;
- `apps/web/lib/control-plane-client.ts` — signed HTTPS client для remote node;
- `apps/web/lib/tenant-scope.ts`, `studio-scope.ts` — tenant/studio isolation;
- `infrastructure/postgres/001_rooms.sql`, `002_studio_scope.sql` — node-local migrations;
- `infrastructure/control-plane/001_multitenant.sql` — multi-tenant control plane.

## PostgreSQL

Production RC-1 использует PostgreSQL для persistent storage. JSON больше нельзя считать основной архитектурой 1.0.

Миграции выполняются явно; backend fail-closed и не должен молча откатываться на JSON при ошибке PostgreSQL.
Room mutations выполняются транзакционно. SQL параметризован, pool ограничен, используются connection/query timeouts.

Высокочастотные RTC samples, active-speaker state и transient reconnect state не следует превращать в transactional DB writes.
Подробности: `docs/POSTGRESQL_STORAGE_RU.md`.
## Multi-node и control plane

Одна физическая node может обслуживать несколько независимых Studios.
Node registry хранит identity, endpoint, health, last_seen, capacity и текущую нагрузку.

Scheduler учитывает capacity и не должен назначать новые Studios на unhealthy/degraded node.
Heartbeat подписывается HMAC и содержит node id, active studios/participants/video tracks, CPU, memory и timestamp.
Replay, stale heartbeat, неизвестная node и неверная подпись отклоняются.

Для remote node PostgreSQL control plane не выставляется наружу: чтение/мутации идут через подписанный HTTPS control-plane API.
Основные endpoints RC-1:
- `/v1/nodes/heartbeat` — heartbeat receiver;
- `/v1/control/studio` — scoped control-plane read;
- `/v1/control/studio-transfer` — signed transfer mutation;
- `/api/studios` — owner studio management;
- `/api/studio-route` — назначенная node;
- `/api/servers` — protected server registry.

## Доступ и роли

Доступ теперь studio-scoped. Guest/admin/moderator/owner credentials одной Studio не должны давать права в другой.
Guest cookie/invite, viewer grant, room-admin, moderator sessions и LiveKit metadata несут studio scope.

Новые Studios используют отдельный owner access. Owner-link выдаёт scoped HttpOnly session; revoke ротирует access version.
`studio-default` сохраняет legacy compatibility на время миграции.
Диагностика, статистика и control-plane данные защищены соответствующей ролью; публичному гостю они не выдаются.
## Рефакторинг Studio UI

Большой `app/studio/page.tsx` больше не является единственным местом для всей Studio-логики.
В RC-1 вынесены отдельные компоненты и lifecycle helpers:

- `RoomManagementPanel.tsx` — управление комнатами;
- `ServerTransferPanel.tsx` — перенос/выбор server node;
- `StudioDeviceControlPanel.tsx` — удалённое управление устройствами;
- `StudioReturnPublishingControls.tsx` — публикация Studio Return;
- `StudioReturnStatsPanel.tsx` — статистика Studio Return;
- `ModeratorStudioMonitoring.tsx` — monitoring для moderator;
- `StaffParticipantsPanel.tsx` — staff participant controls;
- `GuestParticipantsTable.tsx` — таблица гостей;
- `GuestVideoCard.tsx` — presentation карточки гостя;
- `StudioOwnerGate.tsx` — scoped owner access;
- `apps/web/lib/studio-room-lifecycle.ts` — lifecycle Studio Room.

Правило: перед изменением функции сначала искать её extracted component/helper, а не автоматически править `studio/page.tsx`.
Каждый extraction сопровождается regression test и включён в CI.

## Основные API

Сохранились: `auth`, `rooms`, `invites`, `token`, `participants`, `move-guest`, `guest-command`, `stats`,
`moderator-access`, `admin-access`, `studio-control`, `studio-viewer`, `server-transfer`, `version`.

Добавлены: `health`, `license-status`, `servers`, `setup`, `studio-access`, `studio-route`, `studios`.
API route обязан проверять studio/room scope серверно; скрытая кнопка в UI не является авторизацией.
## Observability и диагностика

RC-1 добавляет structured server logging с correlation context для auth, room mutations, token/control-plane операций.
Секреты и чувствительные значения должны редактироваться/исключаться из логов.

Добавлены:
- `/api/health` — ограниченная health surface;
- `/diagnostics` — защищённая operator diagnostics page;
- `scripts/support-bundle.mjs` — sanitized support bundle;
- control-plane lifecycle/heartbeat observability.

Гостевая WebRTC telemetry остаётся недоверенным client-side источником: клиент может подделать собственные значения.

## Production и release model

RC-1 разворачивается immutable image, а не сборкой случайного checkout на VPS.
Production image должен быть привязан к release tag/digest; `:latest` запрещён.

Текущий формат build identity: `<productVersion>-<git-sha>`.
`/api/version` должен показывать product version и конкретный build id.

Основные файлы:
- `infrastructure/production/docker-compose.yml`;
- `infrastructure/production/web.env.example`;
- `infrastructure/production/postgres.env.example`;
- `scripts/production-preflight.mjs`;
- `scripts/production-update.sh`;
- `scripts/production-rollback.sh`.

Перед update обязателен preflight и backup. Update/rollback не должны требовать изменения media architecture.
## Backup и restore

Для PostgreSQL есть отдельные guarded workflows:
- `scripts/postgres-backup.sh`;
- `scripts/postgres-restore.sh`;
- pre-update deployment backup включает PostgreSQL dump.

Restore — явная операторская операция, не автоматический fallback.
Legacy JSON backup сохраняется только как rollback artifact периода миграции и не должен конкурировать с PostgreSQL как второй source of truth.

## Reconnect / media recovery

RC-1 включает hardened reconnect/device recovery. Эти механизмы относятся к клиентскому media lifecycle и не должны смешиваться с DB recovery.
Storage failure и media reconnect — разные классы отказов.

Screen share публикуется как отдельные LiveKit sources `screen_share` / `screen_share_audio`.
Media path по-прежнему идёт напрямую через LiveKit/TURN, а не через Next.js/PostgreSQL.

## Где менять функцию

| Задача | Начать здесь |
|---|---|
| Комнаты / persistent room data | `room-store.ts`, `postgres-room-store.ts` |
| Tenant/studio isolation | `tenant-scope.ts`, `studio-scope.ts` |
| Studio placement/routing | `control-plane-store.ts`, `node-scheduler.ts`, `studio-route` API |
| Heartbeat | `node-heartbeat*.ts`, `scripts/node-heartbeat.mjs` |
| Studio UI | соответствующий extracted component, затем `studio/page.tsx` |
| LiveKit token permissions | `app/api/token/route.ts` |
| Reconnect | `reconnect-status.ts`, media lifecycle helpers |
| Deploy/rollback | `scripts/production-*.sh`, `docs/PRODUCTION_DEPLOYMENT_RU.md` |
| DB migration | `scripts/postgres-*.mjs/sh`, `docs/POSTGRESQL_STORAGE_RU.md` |
| Diagnostics/logging | `server-log.ts`, health API, `docs/OBSERVABILITY_RU.md` |
## Документы, которые считать актуальными для 1.0

- `docs/POSTGRESQL_STORAGE_RU.md`
- `docs/MULTITENANT_CLOUD_RU.md`
- `docs/PRODUCTION_DEPLOYMENT_RU.md`
- `docs/OBSERVABILITY_RU.md`
- `docs/SECURITY_AUDIT_1_0_RU.md`
- `docs/BROWSER_RECOVERY_MATRIX_RU.md`
- `docs/TURN_TLS_RU.md`
- `docs/LICENSING_AND_SERVER_REGISTRY_RU.md`
- `docs/RC_ACCEPTANCE_1_0_RU.md`
- `docs/RELEASE_POLICY_RU.md`

Датированные документы 0.9.x полезны как история, но не должны использоваться как описание текущей архитектуры.

## Инварианты перед любой правкой

1. Не помещать PostgreSQL/Next.js proxy в WebRTC media path.
2. Не ослаблять studio/tenant isolation ради совместимости.
3. Не отдавать browser/server API секреты, node secrets, DB credentials или private keys.
4. Не делать silent fallback между PostgreSQL и legacy JSON.
5. Не выполнять deploy/restart во время активного soak/эфира без отдельного решения оператора.
6. Перед операцией читать проверенный runbook и профильный документ.
7. После изменения запускать TypeScript + соответствующие regression tests; для release — полный CI/acceptance.
8. Production изменяется immutable image + guarded update/rollback, а не ручным редактированием контейнера.

## Статус RC-1

`1.0.0-rc.1` — release candidate, а не финальный 1.0. Его задача — зафиксировать новую storage/control-plane архитектуру,
multi-tenant isolation, production workflow и refactored UI на одном проверяемом кандидате.
Soak/stress результаты и RC acceptance должны оцениваться отдельно от факта успешной сборки.
