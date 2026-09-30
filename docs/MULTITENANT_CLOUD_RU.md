# CastLink Cloud: multi-tenant architecture

## Цель

Запустить бесплатный managed CastLink Cloud на небольшом количестве физических серверов: сначала один VPS и один домашний сервер с белым IP, позже N nodes без переделки модели.

## Иерархия

```text
Account
  ↓
Organization
  ↓
Studio
  ↓
Room
  ↓
Participants
```

Физический media node не принадлежит одной студии. Одна node может обслуживать несколько независимых studios одновременно.

## Почему studio — отдельная сущность

Исторический CastLink использует room name как главный идентификатор. Для публичного multi-tenant сервиса этого недостаточно.

Новая модель:

```text
organization_id + studio_id + room_id
```

Имена комнат остаются удобными display names, но не глобальными ключами.

Например эти комнаты разные:

```text
org-a / studio-main / caster
org-b / studio-main / caster
```

## Совместимость с текущим CastLink

Миграция выполняется постепенно.

### Этап A — foundation

Добавляются:
- control-plane schema;
- tenant scope helpers;
- node registry;
- scheduler;
- tests.

Существующие production room API пока продолжают работать.

### Этап B — default tenant wrapper

Для текущей одиночной установки создаётся:
- default organization;
- default studio;
- существующие rooms импортируются внутрь default studio.

UI/URL остаются совместимыми.

### Этап C — scoped API

Новые control-plane API используют:

```text
/api/studios/:studioId/rooms
```

и каждый запрос проверяет membership/role организации.

Старые room-name API становятся compatibility layer, а не source of truth.

## Node registry

Schema: `infrastructure/control-plane/001_multitenant.sql`.

Node содержит:
- `node_id`;
- name/region/type;
- endpoint;
- health + last_seen;
- capacity limits;
- текущую нагрузку.

Минимальные capacity counters:
- active studios;
- participants;
- published video tracks.

Дополнительно можно использовать:
- CPU;
- RAM;
- outbound network.

## Начальный кластер

### Node 1 — VPS

Рекомендуется:
- primary managed node;
- работает 24/7;
- основной public ingress/TURN;
- capacity задаётся консервативно после soak-тестов.

### Node 2 — домашний сервер с белым IP

Рекомендуется:
- overflow;
- backup capacity;
- тестовая node;
- временные/неприоритетные studios.

Домашний сервер не должен автоматически принимать критический эфир, если health нестабилен.

## Heartbeat

Media node отправляет control plane подписанный heartbeat.

Реализация:
- `apps/web/lib/node-heartbeat.ts` — canonical payload + HMAC verify;
- `scripts/node-heartbeat.mjs` — одноразовая отправка heartbeat из конкретной node.

Heartbeat содержит:
- nodeId;
- region/nodeType;
- active studios;
- active participants;
- active video tracks;
- CPU load;
- memory load;
- timestamp.

Подпись:
```text
HMAC-SHA256(node_secret, "castlink-node-heartbeat-v1:" + JSON-body)
```

Control plane отклоняет:
- неверную подпись;
- stale heartbeat;
- неизвестную node;
- отрицательные/некорректные counters.

Node secret хранится только на сервере и не попадает в browser/API response.

Для первых двух серверов можно использовать:
```text
node-vps   -> primary managed capacity
node-home  -> overflow / backup
```

Heartbeat sender не является background daemon сам по себе. На production его следует запускать systemd timer/service либо отдельным lightweight agent примерно раз в 10–15 секунд.

## Scheduler

Реализация: `apps/web/lib/node-scheduler.ts`.

Auto placement исключает node если:
- disabled/draining;
- health != healthy;
- heartbeat старше 45 секунд;
- закончился лимит active studios;
- закончился participant capacity;
- закончился video-track capacity.

Score учитывает:
- studio utilization;
- participant utilization;
- video-track utilization;
- CPU;
- RAM;
- penalty за другой region.

При равном score используется deterministic nodeId tie-break.

## Active broadcast invariant

Scheduler не мигрирует уже активную студию только потому, что другая node стала свободнее.

```text
idle/start -> scheduler chooses node
live       -> assignment locked
manual failover/transfer -> отдельный контролируемый механизм
```

Это защищает эфир от неожиданных reconnect.

## Capacity

Не использовать количество созданных комнат как основной capacity metric.

100 пустых rooms почти не создают media load.

Считать:
- active studios;
- connected participants;
- published video tracks;
- network/CPU/RAM.

На старте лимиты должны быть консервативными и конфигурируемыми на node.

Пример:

```text
VPS:
max_active_studios = 4
max_participants = 24
max_video_tracks = 32

Home:
max_active_studios = 2
max_participants = 12
max_video_tracks = 16
```

Это только пример стартовых ограничений, не измеренная производительность текущего железа.

## Когда capacity закончилась

Free managed cloud работает best-effort.

Если все разрешённые managed nodes заполнены:

```text
no_capacity
```

UI должен объяснить:
- все бесплатные cloud nodes сейчас заняты;
- можно попробовать позже;
- можно использовать собственный self-hosted node.

Нельзя молча переполнять media node.

## Free model

Core CastLink:
- бесплатный;
- self-hosted бесплатный;
- базовые media features не зависят от DRM.

Managed CastLink Cloud:
- бесплатная shared capacity при наличии ресурсов;
- позже возможны платные dedicated capacity, SLA, support, long-term analytics и managed temporary nodes.

Уже написанные Ed25519/server identity компоненты остаются полезны как trust/auth между managed nodes и control plane, но не должны блокировать бесплатное локальное ядро.

## Следующие шаги

1. Добавить heartbeat protocol node -> control plane.
2. Добавить persistent node metrics.
3. Сделать studio CRUD.
4. Сделать assignment API.
5. Добавить default-org/default-studio migration для текущих rooms.
6. Подключить VPS как `node-vps`.
7. Подключить домашний сервер как `node-home`.
8. После этого тестировать реальное распределение параллельных studios.
