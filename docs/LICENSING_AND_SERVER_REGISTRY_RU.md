# CastLink 1.0: лицензирование, подписки и реестр серверов

## Цель

Поддержать одновременно:

- CastLink Cloud — серверы, которыми управляет владелец CastLink;
- Dedicated — выделенный узел для конкретного клиента/организации;
- Self-Hosted — сервер клиента на своём ПК/VPS;
- Temporary Private Node — временный сервер, доступный только конкретному аккаунту/организации.

## Модель

```text
Account
  ↓
Organization
  ↓
License / Subscription
  ↓
Server Registry
  ├─ Cloud
  ├─ Dedicated
  ├─ Self-Hosted
  └─ Temporary
```

Каждый зарегистрированный сервер имеет:
- `serverId`;
- `installationId`;
- `licenseId`;
- `organizationId`;
- тип сервера;
- region/endpoint;
- visibility;
- state;
- optional expiry для temporary nodes.

SQL draft: `infrastructure/license-service/001_server_registry.sql`.

## Почему не один локальный ключ

Self-hosted сервер находится под контролем клиента. Поэтому локальная проверка вида `if (licensed)` не считается достаточной.

Используется два уровня:

### 1. Signed server lease

License Service периодически выдаёт короткоживущий Ed25519-подписанный lease:

```text
leaseId
licenseId
organizationId
serverId
installationId
serverType
issuedAt
validUntil
graceUntil
features[]
```

Подпись проверяется локально public key, встроенным в release build.

Private signing key:
- не хранится в Git;
- не входит в Docker image;
- не передаётся на customer server;
- существует только в issuer/license service.

### 2. Offline signed license

Если License Service временно недоступен, сервер может использовать подписанную offline license до `offlineGraceUntil`.

Это fallback, а не основной механизм subscription enforcement.

## Защита от простого копирования

Lease одновременно привязан к:
- `installationId`;
- `serverId`;
- `licenseId`;
- организации;
- сроку действия;
- списку features.

Копирование lease на другой зарегистрированный сервер не должно пройти проверку server/install binding.

## Ограничение модели

Абсолютно защитить self-hosted software от модификации нельзя: администратор физически контролирует машину и может патчить локальный код.

Цель защиты:
- исключить подделку лицензии без private signing key;
- исключить простое копирование лицензии между серверами;
- сделать обход нескольких server-side entitlement checks существенно сложнее одного патча;
- хранить самые ценные SaaS/control-plane операции на стороне CastLink Cloud;
- выдавать клиентам release image/installer, а не private repository.

Обфускация может применяться дополнительно, но не считается основной границей безопасности.

## Enforcement

`apps/web/lib/entitlement.ts` принимает решение:

1. development mode, если enforcement выключен;
2. активный server lease;
3. offline signed license;
4. deny.

Feature checks должны вызываться в server-side control-plane операциях, например:
- создание новых комнат;
- регистрация сервера;
- server transfer;
- Pro/enterprise features;
- создание новых studio sessions.

Не следует строить всю защиту вокруг одного глобального `licenseValid`.

## Поведение при expiry

Broadcast safety важнее billing enforcement.

Если лицензия истекла во время активного эфира:
- уже установленные WebRTC/LiveKit media connections не разрываются;
- текущий эфир не завершается принудительно;
- новые control-plane операции могут блокироваться;
- UI основной студии показывает license warning;
- operator diagnostics показывает статус лицензии.

## Cloud server selection

Подписка может давать пользователю список доступных CastLink servers:

```text
Auto
Frankfurt
Helsinki
Moscow
Private Tournament Node
Office Self-Hosted
```

Visibility:
- `platform` — публичная Cloud-нода, доступная по плану;
- `organization` — dedicated/self-hosted/temporary node организации;
- `account` — временный персональный узел конкретного аккаунта.

Auto-select в будущем должен учитывать region, health и latency/load, но это отдельная задача routing/control plane.

## Temporary Private Nodes

Temporary node:
- создаётся с `serverType=temporary`;
- имеет `expiresAt`;
- виден только разрешённому account/organization;
- получает обычный signed lease;
- после expiry перестаёт принимать новые control-plane sessions;
- может быть автоматически deprovisioned в Cloud infrastructure.

## Self-hosted onboarding

Желаемый UX:

1. пользователь покупает/активирует лицензию;
2. скачивает CastLink Installer;
3. выбирает:
   - This PC;
   - VPS/Linux server;
4. вводит license/activation code;
5. installer:
   - ставит Docker/проверяет Docker Desktop;
   - генерирует local secrets;
   - создаёт installation identity;
   - поднимает PostgreSQL/web/media components;
   - регистрирует server;
   - получает `serverId` и signed lease;
   - запускает health checks;
6. браузер открывает setup wizard;
7. сервер появляется в разделе «Мои серверы».

Цель — типовая установка без ручного редактирования YAML/env.

## Diagnostics

`/api/health`, `/diagnostics` и `/api/license-status` доступны только:
- основной студии;
- либо room-admin при явно указанной комнате.

Они не должны становиться публичными endpoints инфраструктурной разведки.

## Текущий статус

Реализовано в GitHub:
- Ed25519 offline license verifier;
- signed server lease verifier;
- installation/server binding;
- layered entitlement helper;
- protected license status endpoint;
- server registry SQL draft;
- production env placeholders;
- tests подписи/tamper/server binding/expiry.

Enforcement по умолчанию выключен, чтобы не ломать текущую development/production миграцию.

До production licensing ещё нужны:
- отдельный License Service/API;
- issuer с private key вне repo;
- activation flow;
- lease renewal protocol;
- account/organization authentication;
- server list UI;
- revoke/deactivate flow;
- signed image/release verification;
- clean-host installer и setup wizard.
