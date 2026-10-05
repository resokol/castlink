# Полный каталог файлов и прямых связей CastLink

[Оглавление](../MANUAL_RU.md) · [Системы](03_SYSTEMS_RU.md)

Генератор: `node scripts/build-manual-index.mjs`; проверка актуальности: `node scripts/build-manual-index.mjs --check`. Новые файлы сначала добавить в Git index. Каталог включает только файлы Git; реальные `.env`, токены, SSH-ключи, node_modules, runtime и временный QA не инвентаризируются.

Прямые импорты извлечены статически. Динамические загрузки с вычисляемым именем, HTTP, LiveKit events и SQL-связи не выводятся автоматически и разобраны в главе 03. Экспорт — доступный другим модулям символ, а не обязательно публичный HTTP API. Наличие теста в каталоге не означает, что он запускался.

Всего файлов в Git index: **426**. Каждый файл ниже имеет отдельную запись.

## .codex · 4 файлов

### .codex/agents/backend.toml

[`.codex/agents/backend.toml`](../../.codex/agents/backend.toml)

Правила/роль помощника при работе с кодом. Не browser/API security policy.

### .codex/agents/frontend.toml

[`.codex/agents/frontend.toml`](../../.codex/agents/frontend.toml)

Правила/роль помощника при работе с кодом. Не browser/API security policy.

### .codex/agents/sysadmin.toml

[`.codex/agents/sysadmin.toml`](../../.codex/agents/sysadmin.toml)

Правила/роль помощника при работе с кодом. Не browser/API security policy.

### .codex/config.toml

[`.codex/config.toml`](../../.codex/config.toml)

Правила/роль помощника при работе с кодом. Не browser/API security policy.

## Корень · 10 файлов

### .dockerignore

[`.dockerignore`](../../.dockerignore)

Какие файлы исключены из Docker build context.

### .gitignore

[`.gitignore`](../../.gitignore)

Какие локальные/секретные/сгенерированные файлы не включаются в Git.

### AGENTS.md

[`AGENTS.md`](../../AGENTS.md)

CastLink: постоянная команда агентов

### CHANGELOG.md

[`CHANGELOG.md`](../../CHANGELOG.md)

Changelog

### Dockerfile.web

[`Dockerfile.web`](../../Dockerfile.web)

Рецепт сборки web image, включая зависимости, scripts и control-plane SQL.

### README.md

[`README.md`](../../README.md)

CastLink

### package.json

[`package.json`](../../package.json)

Версия продукта, команды workspace, pnpm и overrides.

Используют: [`apps/web/tests/app-update-api.cjs`](../../apps/web/tests/app-update-api.cjs), [`apps/web/tests/version-api.cjs`](../../apps/web/tests/version-api.cjs).

### pnpm-lock.yaml

[`pnpm-lock.yaml`](../../pnpm-lock.yaml)

Зафиксированный граф версий зависимостей; не редактировать вручную ради обновления UI.

### pnpm-workspace.yaml

[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml)

Список проектов pnpm workspace.

### studiolink.code-workspace

[`studiolink.code-workspace`](../../studiolink.code-workspace)

Настройки редактора и задач разработчика; не production service.

## .github · 2 файлов

### .github/workflows/build-rc-image.yml

[`.github/workflows/build-rc-image.yml`](../../.github/workflows/build-rc-image.yml)

GitHub Actions: Build RC image. Выполняется runner-ом, а не в браузере.

### .github/workflows/ci.yml

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)

GitHub Actions: CI. Выполняется runner-ом, а не в браузере.

## .vscode · 2 файлов

### .vscode/extensions.json

[`.vscode/extensions.json`](../../.vscode/extensions.json)

Настройки редактора и задач разработчика; не production service.

### .vscode/tasks.json

[`.vscode/tasks.json`](../../.vscode/tasks.json)

Настройки редактора и задач разработчика; не production service.

## apps · 40 файлов

### apps/cli/.gitignore

[`apps/cli/.gitignore`](../../apps/cli/.gitignore)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/package.json

[`apps/cli/package.json`](../../apps/cli/package.json)

Зависимости и команды конкретного подпроекта.

### apps/cli/src/args.ts

[`apps/cli/src/args.ts`](../../apps/cli/src/args.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `ParsedArgs`, `parseArgs`.

### apps/cli/src/bundle-preflight.ts

[`apps/cli/src/bundle-preflight.ts`](../../apps/cli/src/bundle-preflight.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `bundlePrerequisiteChecks`.

Библиотеки/Node: `node:dgram`, `node:net`.

### apps/cli/src/bundle.ts

[`apps/cli/src/bundle.ts`](../../apps/cli/src/bundle.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `ReleaseImage`, `ReleaseManifest`, `validateReleaseManifest`, `BundleInput`, `ComposeModel`, `RenderedBundle`, `renderBundle`, `MaterializedBundle`, `materializeBundle`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

### apps/cli/src/doctor.ts

[`apps/cli/src/doctor.ts`](../../apps/cli/src/doctor.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `diagnosePrerequisites`.

### apps/cli/src/executors/local.ts

[`apps/cli/src/executors/local.ts`](../../apps/cli/src/executors/local.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `LocalExecutor`.

Библиотеки/Node: `node:child_process`, `node:string_decoder`.

### apps/cli/src/executors/ssh.ts

[`apps/cli/src/executors/ssh.ts`](../../apps/cli/src/executors/ssh.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `sshInvocation`, `SshExecutor`.

### apps/cli/src/journal.ts

[`apps/cli/src/journal.ts`](../../apps/cli/src/journal.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `Journal`, `FileJournal`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

### apps/cli/src/main.ts

[`apps/cli/src/main.ts`](../../apps/cli/src/main.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `runCli`.

Библиотеки/Node: `node:path`, `node:process`, `node:readline/promises`, `node:url`.

### apps/cli/src/network.ts

[`apps/cli/src/network.ts`](../../apps/cli/src/network.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `BundleNetwork`, `validateBundleNetwork`.

### apps/cli/src/plan.ts

[`apps/cli/src/plan.ts`](../../apps/cli/src/plan.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `validateProfileName`, `validateRequest`, `createPlan`.

Библиотеки/Node: `node:net`, `node:path`.

### apps/cli/src/probe.ts

[`apps/cli/src/probe.ts`](../../apps/cli/src/probe.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `prerequisiteChecks`, `localChecks`.

Библиотеки/Node: `node:os`.

Переменные окружения (только имена): `DOCKER_CONTEXT`, `DOCKER_HOST`.

### apps/cli/src/profile.ts

[`apps/cli/src/profile.ts`](../../apps/cli/src/profile.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `profileRoot`.

Библиотеки/Node: `node:os`, `node:path`.

Переменные окружения (только имена): `LOCALAPPDATA`.

### apps/cli/src/render.ts

[`apps/cli/src/render.ts`](../../apps/cli/src/render.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `help`, `renderPlan`.

### apps/cli/src/runtime.ts

[`apps/cli/src/runtime.ts`](../../apps/cli/src/runtime.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `runtimeActions`, `ensureRuntime`.

### apps/cli/src/secrets.ts

[`apps/cli/src/secrets.ts`](../../apps/cli/src/secrets.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `protectPath`, `ensurePrivateDirectory`, `writeSecretFile`.

Библиотеки/Node: `node:child_process`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/state.ts

[`apps/cli/src/state.ts`](../../apps/cli/src/state.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `FileStateStore`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

### apps/cli/src/types.ts

[`apps/cli/src/types.ts`](../../apps/cli/src/types.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `Target`, `NetworkMode`, `InstallRequest`, `HostFacts`, `StepId`, `InstallPlan`, `CommandResult`, `ExecutionRequest`, `Executor`, `CheckResult`, `Profile`, `StateStore`, `CliDependencies`, `CliError`.

### apps/cli/src/wizard.ts

[`apps/cli/src/wizard.ts`](../../apps/cli/src/wizard.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `requestFromArgs`.

Библиотеки/Node: `node:os`, `node:path`.

Переменные окружения (только имена): `LOCALAPPDATA`.

### apps/cli/tests/args.test.mjs

[`apps/cli/tests/args.test.mjs`](../../apps/cli/tests/args.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/bundle-preflight.test.mjs

[`apps/cli/tests/bundle-preflight.test.mjs`](../../apps/cli/tests/bundle-preflight.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:dgram`, `node:net`, `node:test`.

### apps/cli/tests/bundle.test.mjs

[`apps/cli/tests/bundle.test.mjs`](../../apps/cli/tests/bundle.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/doctor.test.mjs

[`apps/cli/tests/doctor.test.mjs`](../../apps/cli/tests/doctor.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/executors.test.mjs

[`apps/cli/tests/executors.test.mjs`](../../apps/cli/tests/executors.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/journal.test.mjs

[`apps/cli/tests/journal.test.mjs`](../../apps/cli/tests/journal.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/main.test.mjs

[`apps/cli/tests/main.test.mjs`](../../apps/cli/tests/main.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/materialize.test.mjs

[`apps/cli/tests/materialize.test.mjs`](../../apps/cli/tests/materialize.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/network.test.mjs

[`apps/cli/tests/network.test.mjs`](../../apps/cli/tests/network.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/plan.test.mjs

[`apps/cli/tests/plan.test.mjs`](../../apps/cli/tests/plan.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/probe.test.mjs

[`apps/cli/tests/probe.test.mjs`](../../apps/cli/tests/probe.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/runtime.test.mjs

[`apps/cli/tests/runtime.test.mjs`](../../apps/cli/tests/runtime.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/secrets.test.mjs

[`apps/cli/tests/secrets.test.mjs`](../../apps/cli/tests/secrets.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

### apps/cli/tests/state.test.mjs

[`apps/cli/tests/state.test.mjs`](../../apps/cli/tests/state.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tsconfig.json

[`apps/cli/tsconfig.json`](../../apps/cli/tsconfig.json)

Параметры проверки TypeScript и разрешения импортов.

### apps/studio-linux/CMakeLists.txt

[`apps/studio-linux/CMakeLists.txt`](../../apps/studio-linux/CMakeLists.txt)

Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.

### apps/studio-linux/src/main.cpp

[`apps/studio-linux/src/main.cpp`](../../apps/studio-linux/src/main.cpp)

Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.

### apps/studio-windows/CMakeLists.txt

[`apps/studio-windows/CMakeLists.txt`](../../apps/studio-windows/CMakeLists.txt)

Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.

### apps/studio-windows/README.md

[`apps/studio-windows/README.md`](../../apps/studio-windows/README.md)

StudioLink Studio — Windows 11 native

### apps/studio-windows/src/main.cpp

[`apps/studio-windows/src/main.cpp`](../../apps/studio-windows/src/main.cpp)

Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.

## apps/web/app · 48 файлов

### apps/web/app/admin/page.tsx

[`apps/web/app/admin/page.tsx`](../../apps/web/app/admin/page.tsx)

React-страница /admin. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/app/api/admin-access/route.ts

[`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts)

Серверный HTTP-обработчик /api/admin-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/auth/route.ts

[`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts)

Серверный HTTP-обработчик /api/auth. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `GET`, `POST`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/tests/guest-invite-revocation.cjs`](../../apps/web/tests/guest-invite-revocation.cjs).

Переменные окружения (только имена): `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/app/api/guest-command/route.ts

[`apps/web/app/api/guest-command/route.ts`](../../apps/web/app/api/guest-command/route.ts)

Серверный HTTP-обработчик /api/guest-command. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:fs/promises`, `node:path`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/app/api/health/route.ts

[`apps/web/app/api/health/route.ts`](../../apps/web/app/api/health/route.ts)

Серверный HTTP-обработчик /api/health. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:net`, `node:tls`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_HEALTH_TIMEOUT_MS`, `CASTLINK_NODE_ID`, `CASTLINK_STORAGE_BACKEND`, `CASTLINK_TURN_HEALTH_HOST`, `CASTLINK_TURN_TLS_PORT`, `LIVEKIT_SERVER_URL`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_PRODUCT_VERSION`, `STUDIOLINK_RELEASE`, `STUDIOLINK_STATS_MAX_BYTES`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/app/api/invites/route.ts

[`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts)

Серверный HTTP-обработчик /api/invites. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/tests/guest-invite-revocation.cjs`](../../apps/web/tests/guest-invite-revocation.cjs).

### apps/web/app/api/license-status/route.ts

[`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts)

Серверный HTTP-обработчик /api/license-status. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Переменные окружения (только имена): `CASTLINK_SERVER_ID`.

### apps/web/app/api/media-admission/route.ts

[`apps/web/app/api/media-admission/route.ts`](../../apps/web/app/api/media-admission/route.ts)

Серверный HTTP-обработчик /api/media-admission. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/app/api/moderator-access/route.ts

[`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts)

Серверный HTTP-обработчик /api/moderator-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/move-guest/route.ts

[`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts)

Серверный HTTP-обработчик /api/move-guest. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:fs/promises`, `node:path`.

### apps/web/app/api/participants/route.ts

[`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts)

Серверный HTTP-обработчик /api/participants. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `DELETE`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Используют: [`apps/web/tests/participant-mute-api.cjs`](../../apps/web/tests/participant-mute-api.cjs).

Переменные окружения (только имена): `CASTLINK_ENFORCE_NODE_ADMISSION`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/rooms/route.ts

[`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts)

Серверный HTTP-обработчик /api/rooms. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/moderator-room-rename.cjs`](../../apps/web/tests/moderator-room-rename.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/server-transfer/route.ts

[`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts)

Серверный HTTP-обработчик /api/server-transfer. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`, `STUDIOLINK_TRANSFER_ORIGIN`, `STUDIOLINK_TRANSFER_PEER_ORIGIN`.

### apps/web/app/api/servers/route.ts

[`apps/web/app/api/servers/route.ts`](../../apps/web/app/api/servers/route.ts)

Серверный HTTP-обработчик /api/servers. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/server-registry-client.ts`](../../apps/web/lib/server-registry-client.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/setup/route.ts

[`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts)

Серверный HTTP-обработчик /api/setup. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/deployment-model.ts`](../../apps/web/lib/deployment-model.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/tests/self-hosted-setup.cjs`](../../apps/web/tests/self-hosted-setup.cjs).

### apps/web/app/api/stats/route.ts

[`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts)

Серверный HTTP-обработчик /api/stats. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`, `GET`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/app/api/studio-access/route.ts

[`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts)

Серверный HTTP-обработчик /api/studio-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/studio-control/route.ts

[`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts)

Серверный HTTP-обработчик /api/studio-control. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/studio-route/route.ts

[`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts)

Серверный HTTP-обработчик /api/studio-route. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/studio-viewer/route.ts

[`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts)

Серверный HTTP-обработчик /api/studio-viewer. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/studio-viewer-api.cjs`](../../apps/web/tests/studio-viewer-api.cjs).

Переменные окружения (только имена): `CASTLINK_ENFORCE_NODE_ADMISSION`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/studios/route.ts

[`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts)

Серверный HTTP-обработчик /api/studios. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/super-admin-access/route.ts

[`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts)

Серверный HTTP-обработчик /api/super-admin-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/super-admin/history/route.ts

[`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts)

Серверный HTTP-обработчик /api/super-admin/history. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/super-admin/route.ts

[`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts)

Серверный HTTP-обработчик /api/super-admin. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts), [`apps/web/lib/platform-topology.ts`](../../apps/web/lib/platform-topology.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `CASTLINK_SUPER_ADMIN_NODE_TIMEOUT_MS`, `NODE_ENV`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/app/api/token/route.ts

[`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts)

Серверный HTTP-обработчик /api/token. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/staff-display-name.ts`](../../apps/web/lib/staff-display-name.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs).

Переменные окружения (только имена): `CASTLINK_ENFORCE_NODE_ADMISSION`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/version/route.ts

[`apps/web/app/api/version/route.ts`](../../apps/web/app/api/version/route.ts)

Серверный HTTP-обработчик /api/version. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Библиотеки/Node: `next/server`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/tests/version-api.cjs`](../../apps/web/tests/version-api.cjs).

Переменные окружения (только имена): `NEXT_BUILD_DIR`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_PRODUCT_VERSION`, `NODE_ENV`.

### apps/web/app/diagnostics/page.tsx

[`apps/web/app/diagnostics/page.tsx`](../../apps/web/app/diagnostics/page.tsx)

React-страница /diagnostics. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Библиотеки/Node: `next/navigation`, `react`.

### apps/web/app/globals.css

[`apps/web/app/globals.css`](../../apps/web/app/globals.css)

Глобальные дизайн-токены, интерфейс CastLink, LiveKit layout и адаптивные правила.

Используют: [`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx).

### apps/web/app/layout.tsx

[`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx)

Общая обёртка страниц, metadata, стили и уведомления версии.

Экспортируемые символы: `dynamic`, `metadata`.

Читает/импортирует: [`apps/web/app/globals.css`](../../apps/web/app/globals.css), [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx).

Библиотеки/Node: `@livekit/components-styles`, `next`.

### apps/web/app/moderator/page.tsx

[`apps/web/app/moderator/page.tsx`](../../apps/web/app/moderator/page.tsx)

React-страница /moderator. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/app/monitor/page.tsx

[`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx)

React-страница /monitor. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `next/navigation`, `react`.

### apps/web/app/output/[identity]/page.tsx

[`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx)

React-страница /output/[identity]. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `livekit-client`, `next/navigation`, `react`.

### apps/web/app/page.tsx

[`apps/web/app/page.tsx`](../../apps/web/app/page.tsx)

React-страница /. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx).

### apps/web/app/room/page.tsx

[`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx)

React-страница /room. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-video-bitrate.ts`](../../apps/web/lib/guest-video-bitrate.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts), [`apps/web/lib/room-mode.ts`](../../apps/web/lib/room-mode.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/studio-video-recovery.ts`](../../apps/web/lib/studio-video-recovery.ts), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `next/navigation`, `react`.

Используют: [`apps/web/app/page.tsx`](../../apps/web/app/page.tsx).

### apps/web/app/servers/page.tsx

[`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx)

React-страница /servers. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css).

Библиотеки/Node: `react`.

### apps/web/app/setup/page.tsx

[`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx)

React-страница /setup. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css), [`apps/web/lib/deployment-model.ts`](../../apps/web/lib/deployment-model.ts).

Библиотеки/Node: `react`.

### apps/web/app/studio/page.tsx

[`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx)

React-страница /studio. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/AdminInviteButton.tsx`](../../apps/web/components/AdminInviteButton.tsx), [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/GuestParticipantsTable.tsx`](../../apps/web/components/GuestParticipantsTable.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/ModeratorInviteButton.tsx`](../../apps/web/components/ModeratorInviteButton.tsx), [`apps/web/components/ModeratorStudioMonitoring.tsx`](../../apps/web/components/ModeratorStudioMonitoring.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx), [`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx), [`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx), [`apps/web/components/RotateVideoButton.tsx`](../../apps/web/components/RotateVideoButton.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/components/ServerTransferPanel.tsx`](../../apps/web/components/ServerTransferPanel.tsx), [`apps/web/components/StaffParticipantsPanel.tsx`](../../apps/web/components/StaffParticipantsPanel.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx), [`apps/web/components/StudioReturnPublishingControls.tsx`](../../apps/web/components/StudioReturnPublishingControls.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts), [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/room-mode.ts`](../../apps/web/lib/room-mode.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/studio-room-lifecycle.ts`](../../apps/web/lib/studio-room-lifecycle.ts), [`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `next/navigation`, `react`.

### apps/web/app/studios/page.tsx

[`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx)

React-страница /studios. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css).

Библиотеки/Node: `react`.

### apps/web/app/super-admin/page.tsx

[`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx)

React-страница /super-admin. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/PlatformParticipantActions.tsx`](../../apps/web/components/PlatformParticipantActions.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `react`.

### apps/web/app/transfer/page.tsx

[`apps/web/app/transfer/page.tsx`](../../apps/web/app/transfer/page.tsx)

React-страница /transfer. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts).

Библиотеки/Node: `react`.

### apps/web/app/v1/control/node-admission/route.ts

[`apps/web/app/v1/control/node-admission/route.ts`](../../apps/web/app/v1/control/node-admission/route.ts)

Серверный HTTP-обработчик /v1/control/node-admission. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/node-admission-store.ts`](../../apps/web/lib/node-admission-store.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts), [`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/v1/control/studio-transfer/route.ts

[`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts)

Серверный HTTP-обработчик /v1/control/studio-transfer. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

### apps/web/app/v1/control/studio/route.ts

[`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts)

Серверный HTTP-обработчик /v1/control/studio. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/v1/node/history/route.ts

[`apps/web/app/v1/node/history/route.ts`](../../apps/web/app/v1/node/history/route.ts)

Серверный HTTP-обработчик /v1/node/history. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/v1/node/operations/route.ts

[`apps/web/app/v1/node/operations/route.ts`](../../apps/web/app/v1/node/operations/route.ts)

Серверный HTTP-обработчик /v1/node/operations. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/v1/node/topology/route.ts

[`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts)

Серверный HTTP-обработчик /v1/node/topology. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts).

Библиотеки/Node: `next/server`.

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/app/v1/nodes/heartbeat/route.ts

[`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts)

Серверный HTTP-обработчик /v1/nodes/heartbeat. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/node-heartbeat.ts`](../../apps/web/lib/node-heartbeat.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/watch/page.tsx

[`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx)

React-страница /watch. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/watch-subscriptions.ts`](../../apps/web/lib/watch-subscriptions.ts).

Библиотеки/Node: `livekit-client`, `react`.

## apps/web/components · 39 файлов

### apps/web/components/AccessGate.tsx

[`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx)

Парольный gate старого входа Studio; не право Super Admin.

Экспортируемые символы: `AccessGate`.

Читает/импортирует: [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx).

### apps/web/components/AdminInviteButton.tsx

[`apps/web/components/AdminInviteButton.tsx`](../../apps/web/components/AdminInviteButton.tsx)

Создание/отзыв room-admin приглашений в разрешённом scope.

Экспортируемые символы: `AdminInviteButton`.

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/AppChrome.tsx

[`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `AppChrome`, `AppFooterSlot`.

Читает/импортирует: [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/AppUpdateNotice.tsx

[`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx)

Показ новой версии без вмешательства в чистый output; не автоматический deploy.

Экспортируемые символы: `AppUpdateNotice`.

Читает/импортирует: [`apps/web/components/ThemeToggle.tsx`](../../apps/web/components/ThemeToggle.tsx), [`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts).

Библиотеки/Node: `next/navigation`, `react`, `react-dom`.

Используют: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/tests/app-update-notice.cjs`](../../apps/web/tests/app-update-notice.cjs).

Переменные окружения (только имена): `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_PRODUCT_VERSION`.

### apps/web/components/AudioOutputSelect.tsx

[`apps/web/components/AudioOutputSelect.tsx`](../../apps/web/components/AudioOutputSelect.tsx)

Выбор локального аудиовыхода браузера.

Экспортируемые символы: `AudioOutputSelect`.

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx).

### apps/web/components/GuestAccessGate.tsx

[`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx)

Гостевой вход, имя, пароль/приглашение и проверка комнаты.

Экспортируемые символы: `GuestAccessGate`.

Читает/импортирует: [`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/tests/guest-entry.cjs`](../../apps/web/tests/guest-entry.cjs).

### apps/web/components/GuestAvCheck.tsx

[`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx)

Предварительный просмотр камеры/микрофона и выбор устройств до соединения.

Экспортируемые символы: `GuestAvCheck`.

Читает/импортирует: [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx).

### apps/web/components/GuestParticipantsTable.tsx

[`apps/web/components/GuestParticipantsTable.tsx`](../../apps/web/components/GuestParticipantsTable.tsx)

Таблица гостей и разрешённые действия/индивидуальные vMix-ссылки.

Экспортируемые символы: `GuestParticipantRow`, `GuestParticipantsTable`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/GuestServerPicker.module.css

[`apps/web/components/GuestServerPicker.module.css`](../../apps/web/components/GuestServerPicker.module.css)

Выбор сервера для подключения гостя; проверка и сохранение адреса.

Используют: [`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx).

### apps/web/components/GuestServerPicker.tsx

[`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx)

Выбор сервера для подключения гостя; проверка и сохранение адреса.

Экспортируемые символы: `GuestServerPicker`.

Читает/импортирует: [`apps/web/components/GuestServerPicker.module.css`](../../apps/web/components/GuestServerPicker.module.css), [`apps/web/lib/saved-servers.ts`](../../apps/web/lib/saved-servers.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx).

### apps/web/components/GuestVideoCard.tsx

[`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx)

Студийная карточка гостя: превью, лимит камеры, личный мониторинг, метр и фактические данные.

Экспортируемые символы: `GuestVideoCardData`, `GuestVideoCard`.

Читает/импортирует: [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/ParticipantRenameButton.tsx`](../../apps/web/components/ParticipantRenameButton.tsx), [`apps/web/components/RotateVideoButton.tsx`](../../apps/web/components/RotateVideoButton.tsx), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/MediaDevicePicker.tsx

[`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx)

Панель input/output устройств и обновление их списка.

Экспортируемые символы: `MediaDevicePicker`.

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx).

### apps/web/components/ModeratorInviteButton.tsx

[`apps/web/components/ModeratorInviteButton.tsx`](../../apps/web/components/ModeratorInviteButton.tsx)

Выдача и отзыв модераторских приглашений.

Экспортируемые символы: `ModeratorInviteButton`.

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/ModeratorRoomTools.tsx

[`apps/web/components/ModeratorRoomTools.tsx`](../../apps/web/components/ModeratorRoomTools.tsx)

Доступные модератору операции с комнатами.

Экспортируемые символы: `ModeratorRoomTools`.

Читает/импортирует: [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/ModeratorStudioMonitoring.tsx

[`apps/web/components/ModeratorStudioMonitoring.tsx`](../../apps/web/components/ModeratorStudioMonitoring.tsx)

Блок личного мониторинга Studio для модераторского режима.

Экспортируемые символы: `ModeratorStudioMonitoring`.

Читает/импортирует: [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts).

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/MonitoringControls.tsx

[`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx)

Общие кнопки личного audio/video mute и громкости.

Экспортируемые символы: `MonitoringControls`.

Читает/импортирует: [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts).

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/ParticipantRenameButton.tsx

[`apps/web/components/ParticipantRenameButton.tsx`](../../apps/web/components/ParticipantRenameButton.tsx)

Форма переименования гостя своей комнаты для Studio/admin/moderator.

Экспортируемые символы: `ParticipantRenameButton`.

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/PlatformAccessGate.tsx

[`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx)

UI gate только по отдельной Super Admin сессии; права дополнительно проверяет API.

Экспортируемые символы: `PlatformAccessGate`.

Читает/импортирует: [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx), [`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx).

### apps/web/components/PlatformParticipantActions.tsx

[`apps/web/components/PlatformParticipantActions.tsx`](../../apps/web/components/PlatformParticipantActions.tsx)

Явные операции Super Admin с участником: история, display name и отключение.

Экспортируемые символы: `PlatformParticipantActions`.

Библиотеки/Node: `react`.

Используют: [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx).

### apps/web/components/RemoteStudioDevices.tsx

[`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx)

Команды выбора устройств основной Studio с подтверждёнными доступными device IDs.

Экспортируемые символы: `StudioDevicePatch`, `RemoteStudioDevices`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx), [`apps/web/tests/remote-studio-devices.cjs`](../../apps/web/tests/remote-studio-devices.cjs).

### apps/web/components/RemoteVideoPreview.tsx

[`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx)

Подключение remote camera/screen tracks к video-элементам и применение rotation.

Экспортируемые символы: `RemoteVideoPreview`.

Читает/импортирует: [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/RoomConference.tsx

[`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx)

Гостевая видеосетка, режим only-studio и собственный нижний footer управления.

Экспортируемые символы: `RoomConference`.

Читает/импортирует: [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx).

### apps/web/components/RoomControlConsole.tsx

[`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx)

Полный admin/moderator UI комнаты: доступ, RTC, настройки, участники, статистика.

Экспортируемые символы: `RoomControlConsole`.

Читает/импортирует: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/ModeratorInviteButton.tsx`](../../apps/web/components/ModeratorInviteButton.tsx), [`apps/web/components/ModeratorRoomTools.tsx`](../../apps/web/components/ModeratorRoomTools.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/ParticipantRenameButton.tsx`](../../apps/web/components/ParticipantRenameButton.tsx), [`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx), [`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx), [`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx), [`apps/web/components/RotateVideoButton.tsx`](../../apps/web/components/RotateVideoButton.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/app/admin/page.tsx`](../../apps/web/app/admin/page.tsx), [`apps/web/app/moderator/page.tsx`](../../apps/web/app/moderator/page.tsx).

### apps/web/components/RoomInviteButton.tsx

[`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx)

Создание и управление гостевым приглашением комнаты.

Экспортируемые символы: `RoomInviteButton`.

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/RoomManagementPanel.tsx

[`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx)

Создание/выбор/редактирование комнат в Studio UI.

Экспортируемые символы: `RoomManagementPanel`.

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/RotateVideoButton.tsx

[`apps/web/components/RotateVideoButton.tsx`](../../apps/web/components/RotateVideoButton.tsx)

Отправка разрешённой команды поворота выбранного участника на 90°.

Экспортируемые символы: `RotateVideoButton`.

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/ScreenShareButton.tsx

[`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx)

Состояния демонстрации экрана, временные ошибки, поддержка браузера и busy guard.

Экспортируемые символы: `ScreenShareButton`.

Читает/импортирует: [`apps/web/lib/screen-share.ts`](../../apps/web/lib/screen-share.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx).

### apps/web/components/ServerTransferPanel.tsx

[`apps/web/components/ServerTransferPanel.tsx`](../../apps/web/components/ServerTransferPanel.tsx)

Выбор целевого сервера, состояние и запуск переноса Studio.

Экспортируемые символы: `TransferTarget`, `TransferInfo`, `ServerTransferPanel`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/StaffParticipantsPanel.tsx

[`apps/web/components/StaffParticipantsPanel.tsx`](../../apps/web/components/StaffParticipantsPanel.tsx)

Представление подключённого персонала и role badges.

Экспортируемые символы: `StaffParticipantView`, `StaffParticipantsPanel`.

Читает/импортирует: [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/StatisticsDashboard.tsx

[`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx)

Фильтры периода/роли/identity/session, графики, таблицы и экспорт.

Экспортируемые символы: `statisticsTokenRefreshUrl`, `StatisticsDashboard`.

Читает/импортирует: [`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts), [`apps/web/lib/stats-report.ts`](../../apps/web/lib/stats-report.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/tests/statistics-dashboard-refresh.cjs`](../../apps/web/tests/statistics-dashboard-refresh.cjs).

### apps/web/components/StudioDeviceControlPanel.tsx

[`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx)

Выделенный блок источников и устройств Studio.

Экспортируемые символы: `StudioDeviceControlPanel`.

Читает/импортирует: [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/StudioEntry.module.css

[`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx), [`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx), [`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx), [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx).

### apps/web/components/StudioOwnerGate.tsx

[`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx)

Приём scoped owner-link и проверка доступа к конкретной Studio.

Экспортируемые символы: `StudioOwnerGate`.

Читает/импортирует: [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css).

Библиотеки/Node: `next/navigation`, `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/StudioReturnPublishingControls.tsx

[`apps/web/components/StudioReturnPublishingControls.tsx`](../../apps/web/components/StudioReturnPublishingControls.tsx)

Кнопки preview/ON AIR и состояния публикации возврата.

Экспортируемые символы: `StudioReturnPublishingControls`.

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/StudioReturnStatsPanel.tsx

[`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx)

Качество, фактические параметры, график и ошибки Studio Return.

Экспортируемые символы: `StudioReturnStats`, `StudioReturnStatsPanel`.

Читает/импортирует: [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/StudioRoomPicker.tsx

[`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx)

Выбор существующей комнаты для Studio.

Экспортируемые символы: `StudioRoomPicker`.

Читает/импортирует: [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css), [`apps/web/lib/saved-servers.ts`](../../apps/web/lib/saved-servers.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/StudioStreamInviteButton.tsx

[`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx)

Отдельная ссылка просмотра Studio Return для /watch.

Экспортируемые символы: `StudioStreamInviteButton`.

Читает/импортирует: [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/TalkbackControls.tsx

[`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx)

Служебная речь выбранным адресатам, камера и screen-share персонала.

Экспортируемые символы: `setPanelCamera`, `TalkbackControls`.

Читает/импортирует: [`apps/web/components/AudioOutputSelect.tsx`](../../apps/web/components/AudioOutputSelect.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/ThemeToggle.tsx

[`apps/web/components/ThemeToggle.tsx`](../../apps/web/components/ThemeToggle.tsx)

Переключатель светлой/тёмной темы.

Экспортируемые символы: `ThemeToggle`.

Библиотеки/Node: `react`.

Используют: [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx).

## apps/web/instrumentation.ts · 1 файлов

### apps/web/instrumentation.ts

[`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts)

Startup-валидация persistent storage и room backend.

Экспортируемые символы: `register`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Переменные окружения (только имена): `NEXT_RUNTIME`.

## apps/web/lib · 73 файлов

### apps/web/lib/access.ts

[`apps/web/lib/access.ts`](../../apps/web/lib/access.ts)

Подписи scoped-сессий, проверка паролей, cookie, шифрование паролей комнат и проверка origin; не новый platform login.

Экспортируемые символы: `roomVersion`, `hashPassword`, `encryptRoomPassword`, `decryptRoomPassword`, `checkPassword`, `signAccess`, `readAccess`, `accessStudioMatches`, `isStudio`, `canJoin`, `canView`, `validGuestInvite`, `clearGuestAccess`, `setAccessCookie`, `sameOrigin`.

Читает/импортирует: [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/guest-command/route.ts`](../../apps/web/app/api/guest-command/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/servers/route.ts`](../../apps/web/app/api/servers/route.ts), [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts), [`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/tests/access-secrets.cjs`](../../apps/web/tests/access-secrets.cjs), [`apps/web/tests/studio-access-isolation.cjs`](../../apps/web/tests/studio-access-isolation.cjs), [`apps/web/tests/studio-auth-isolation.cjs`](../../apps/web/tests/studio-auth-isolation.cjs), [`apps/web/tests/transfer-owner-session.cjs`](../../apps/web/tests/transfer-owner-session.cjs).

Переменные окружения (только имена): `CASTLINK_DATA_ENCRYPTION_KEY`, `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`, `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/lib/app-update.ts

[`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts)

Сравнение версии приложения и безопасное построение URL обновления вкладки.

Экспортируемые символы: `updateUrl`, `availableVersion`.

Используют: [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx), [`apps/web/tests/app-update-notice.cjs`](../../apps/web/tests/app-update-notice.cjs), [`apps/web/tests/app-update.cjs`](../../apps/web/tests/app-update.cjs).

### apps/web/lib/audio-meter.ts

[`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts)

Пиковый dBFS и плавность индикатора; чистая математика, не обработка звука.

Экспортируемые символы: `METER_FLOOR_DB`, `peakDbfs`, `meterRelease`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/tests/feedback-media.cjs`](../../apps/web/tests/feedback-media.cjs).

### apps/web/lib/client-transfer.ts

[`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts)

Браузерный snapshot переноса, выбор целевого origin и сохранение/очистка данных перехода.

Экспортируемые символы: `TransferRole`, `TransferSnapshot`, `transferDestination`, `readTransferSnapshot`, `saveTransferSnapshot`, `clearTransferSnapshot`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/app/transfer/page.tsx`](../../apps/web/app/transfer/page.tsx), [`apps/web/tests/client-transfer.cjs`](../../apps/web/tests/client-transfer.cjs).

### apps/web/lib/control-plane-client.ts

[`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts)

Подписанные запросы удалённой ноды к центральному управлению Studio/assignment/access version.

Экспортируемые символы: `currentStudioOwnerAccessVersion`, `currentStudioRoute`, `commitStudioTransfer`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/tests/control-plane-client-remote.cjs`](../../apps/web/tests/control-plane-client-remote.cjs), [`apps/web/tests/transfer-owner-session.cjs`](../../apps/web/tests/transfer-owner-session.cjs).

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_TIMEOUT_MS`, `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `NODE_ENV`.

### apps/web/lib/control-plane-store.ts

[`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts)

PostgreSQL-операции центрального реестра: студии, ноды, scheduler, heartbeat, версии отзыва доступа.

Экспортируемые символы: `controlPlanePool`, `defaultOrganizationId`, `listControlNodes`, `NodeOperationalState`, `setNodeOperationalState`, `listStudios`, `listAllStudios`, `listControlRooms`, `createStudio`, `assignStudioAuto`, `pinStudio`, `closeControlPlanePool`, `resolveStudioRoute`, `transferStudioAssignment`, `applyNodeHeartbeat`, `studioOwnerAccessVersion`, `rotateStudioOwnerAccessVersion`, `superAdminAccessVersion`, `rotateSuperAdminAccessVersion`.

Читает/импортирует: [`apps/web/lib/node-heartbeat.ts`](../../apps/web/lib/node-heartbeat.ts), [`apps/web/lib/node-scheduler.ts`](../../apps/web/lib/node-scheduler.ts).

Библиотеки/Node: `node:crypto`, `pg`.

Используют: [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts), [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/node-admission-store.ts`](../../apps/web/lib/node-admission-store.ts), [`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts), [`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts), [`apps/web/tests/control-plane-store.cjs`](../../apps/web/tests/control-plane-store.cjs), [`apps/web/tests/node-operations-postgres.cjs`](../../apps/web/tests/node-operations-postgres.cjs), [`apps/web/tests/platform-access-postgres.cjs`](../../apps/web/tests/platform-access-postgres.cjs), [`apps/web/tests/studio-owner-access-postgres.cjs`](../../apps/web/tests/studio-owner-access-postgres.cjs).

Переменные окружения (только имена): `CASTLINK_CONTROL_DB_POOL_MAX`, `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_IDLE_TIMEOUT_MS`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `CASTLINK_DEFAULT_ORGANIZATION_ID`, `DATABASE_URL`, `NODE_ENV`.

### apps/web/lib/control-response.ts

[`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts)

Единый разбор HTTP-ответа управления: JSON, пустые и ошибочные ответы.

Экспортируемые символы: `readControlResponse`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/ModeratorRoomTools.tsx`](../../apps/web/components/ModeratorRoomTools.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/tests/control-response.cjs`](../../apps/web/tests/control-response.cjs).

### apps/web/lib/deployment-model.ts

[`apps/web/lib/deployment-model.ts`](../../apps/web/lib/deployment-model.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `DeploymentModel`, `deploymentModel`.

Используют: [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts), [`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx).

Переменные окружения (только имена): `CASTLINK_DEPLOYMENT_MODEL`.

### apps/web/lib/entitlement.ts

[`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts)

Проверка, разрешена ли операция при выбранном режиме enforcement/лицензирования.

Экспортируемые символы: `EntitlementDecision`, `entitlement`, `requireEntitlement`.

Читает/импортирует: [`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts), [`apps/web/lib/license.ts`](../../apps/web/lib/license.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts).

Используют: [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts).

Переменные окружения (только имена): `CASTLINK_SERVER_ID`, `CASTLINK_SERVER_LEASE`.

### apps/web/lib/fullscreen.ts

[`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts)

Нативный fullscreen и CSS fallback, в том числе для ограничений мобильного браузера.

Экспортируемые символы: `isElementFullscreen`, `exitCssFullscreen`, `toggleElementFullscreen`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/tests/fullscreen.cjs`](../../apps/web/tests/fullscreen.cjs).

### apps/web/lib/guest-media.ts

[`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts)

Типы гостевых устройств, constraints захвата и разрешённые получатели клиентских сведений.

Экспортируемые символы: `GuestChoices`, `GuestClientInfo`, `guestClientInfoRecipients`, `parseGuestClientInfo`, `outputQualityRecipients`, `guestCaptureConstraints`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/tests/guest-media.cjs`](../../apps/web/tests/guest-media.cjs).

### apps/web/lib/guest-video-bitrate.ts

[`apps/web/lib/guest-video-bitrate.ts`](../../apps/web/lib/guest-video-bitrate.ts)

Применение encoder budget камеры на стороне гостя и восстановление после SDK/reconnect изменений.

Экспортируемые символы: `watchGuestVideoBitrate`.

Читает/импортирует: [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx).

### apps/web/lib/license-activation.ts

[`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts)

Серверный обмен с внешним сервисом активации установки.

Экспортируемые символы: `activateInstallation`.

Читает/импортирует: [`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts), [`apps/web/lib/license.ts`](../../apps/web/lib/license.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts).

Используют: [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts).

Переменные окружения (только имена): `CASTLINK_LICENSE_SERVICE_URL`, `CASTLINK_LICENSE_TIMEOUT_MS`, `CASTLINK_SERVER_ID`, `NODE_ENV`.

### apps/web/lib/license-public-key.generated.ts

[`apps/web/lib/license-public-key.generated.ts`](../../apps/web/lib/license-public-key.generated.ts)

Публичный ключ проверки лицензии; публичный ключ не равен приватному секрету подписи.

Экспортируемые символы: `embeddedLicensePublicKeyPem`.

Используют: [`apps/web/lib/license.ts`](../../apps/web/lib/license.ts), [`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts).

### apps/web/lib/license-state.ts

[`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts)

Чтение/запись runtime-состояния лицензии в постоянный JSON-файл.

Экспортируемые символы: `readRuntimeLicenseState`, `writeRuntimeLicenseState`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Используют: [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/lib/server-registry-client.ts`](../../apps/web/lib/server-registry-client.ts).

### apps/web/lib/license.ts

[`apps/web/lib/license.ts`](../../apps/web/lib/license.ts)

Проверка подписи/срока license token и режима enforcement.

Экспортируемые символы: `LicensePayload`, `LicenseStatus`, `verifyLicenseToken`, `licenseEnforced`, `licenseToken`.

Читает/импортирует: [`apps/web/lib/license-public-key.generated.ts`](../../apps/web/lib/license-public-key.generated.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/tests/licensing.cjs`](../../apps/web/tests/licensing.cjs).

Переменные окружения (только имена): `CASTLINK_LICENSE_ENFORCE`, `CASTLINK_LICENSE_TOKEN`.

### apps/web/lib/live-telemetry-cache.ts

[`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts)

Ограниченный общий cache последних RTC samples для быстрого обзора нод.

Экспортируемые символы: `rememberLiveSample`, `latestLiveSamples`, `resetLiveTelemetryForTests`.

Читает/импортирует: [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/tests/live-telemetry-cache.cjs`](../../apps/web/tests/live-telemetry-cache.cjs).

### apps/web/lib/livekit-url.ts

[`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts)

Определение адреса LiveKit для браузерного соединения.

Экспортируемые символы: `getLiveKitUrl`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts).

Переменные окружения (только имена): `NEXT_PUBLIC_LIVEKIT_URL`.

### apps/web/lib/media-stats.ts

[`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts)

Чтение статистики отдельного Local/Remote track из WebRTC.

Экспортируемые символы: `readTrackStats`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts).

### apps/web/lib/moderator-access.ts

[`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts)

Приглашения, версии и индивидуальные сессии модераторов; отзыв и scope проверки.

Экспортируемые символы: `moderatorLifetimeSeconds`, `newModeratorInvite`, `createModeratorInvite`, `revokeModeratorInvites`, `validModeratorInvite`, `createRoomModeratorInvite`, `validRoomModeratorInvite`, `acceptRoomModeratorInvite`, `isModerator`, `verifiedModeratorVersion`, `verifiedRoomModeratorSession`, `revokeRoomModeratorSession`, `revokeRoomModeratorAccess`, `revokeRoomModeratorInvite`, `listRoomModeratorSessions`, `setModeratorCookie`, `setRoomModeratorCookie`, `clearModeratorCookie`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts).

Переменные окружения (только имена): `STUDIOLINK_MODERATOR_ACCESS_FILE`.

### apps/web/lib/monitor-audio.ts

[`apps/web/lib/monitor-audio.ts`](../../apps/web/lib/monitor-audio.ts)

Применение личного mute/volume к принятым аудиотрекам и очистка обработчиков.

Экспортируемые символы: `bindMonitorAudio`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/tests/monitor-audio.cjs`](../../apps/web/tests/monitor-audio.cjs).

### apps/web/lib/node-admission-store.ts

[`apps/web/lib/node-admission-store.ts`](../../apps/web/lib/node-admission-store.ts)

PostgreSQL desired state ноды, подтверждение ревизии и временный запрет повторного входа identity.

Экспортируемые символы: `Admission`, `readNodeAdmission`, `blockNodeParticipant`, `acknowledgeNodeOperation`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts).

Используют: [`apps/web/app/v1/control/node-admission/route.ts`](../../apps/web/app/v1/control/node-admission/route.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts).

### apps/web/lib/node-admission.ts

[`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts)

Node-side обращение к локальной БД или подписанному HTTPS control plane перед новым медиаподключением.

Экспортируемые символы: `admissionConfigured`, `localNodeAdmission`, `rememberLocalKick`, `acknowledgeLocalOperation`.

Читает/импортирует: [`apps/web/lib/node-admission-store.ts`](../../apps/web/lib/node-admission-store.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Используют: [`apps/web/app/api/media-admission/route.ts`](../../apps/web/app/api/media-admission/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts).

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_ENFORCE_NODE_ADMISSION`, `CASTLINK_NODE_SECRET`.

### apps/web/lib/node-control-auth.ts

[`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts)

HMAC подпись межсерверных control-запросов с method/path/body и проверкой свежести.

Экспортируемые символы: `signNodeControlRequest`, `verifyNodeControlRequest`.

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts), [`apps/web/tests/control-plane-client-remote.cjs`](../../apps/web/tests/control-plane-client-remote.cjs), [`apps/web/tests/node-control-plane-api.cjs`](../../apps/web/tests/node-control-plane-api.cjs).

### apps/web/lib/node-heartbeat-auth.ts

[`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts)

Поиск настроенного секрета конкретной ноды для проверки её подписи.

Экспортируемые символы: `heartbeatSecretForNode`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts), [`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts), [`apps/web/tests/node-heartbeat.cjs`](../../apps/web/tests/node-heartbeat.cjs).

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `CASTLINK_NODE_SECRETS_JSON`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/lib/node-heartbeat.ts

[`apps/web/lib/node-heartbeat.ts`](../../apps/web/lib/node-heartbeat.ts)

Канонический heartbeat payload, подпись, проверка формы и времени.

Экспортируемые символы: `NodeHeartbeat`, `canonicalHeartbeatBody`, `signHeartbeat`, `verifyHeartbeatSignature`, `validateHeartbeat`.

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/tests/node-heartbeat.cjs`](../../apps/web/tests/node-heartbeat.cjs).

### apps/web/lib/node-history.ts

[`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts)

Валидация запроса истории комнаты и чтение существующего хранилища телеметрии.

Экспортируемые символы: `localNodeHistory`.

Читает/импортирует: [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/v1/node/history/route.ts`](../../apps/web/app/v1/node/history/route.ts).

### apps/web/lib/node-operations.ts

[`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts)

Применение ревизии состояния ноды, удаление LiveKit rooms при Force Offline и SID-bound kick/rename.

Экспортируемые символы: `NodeOperation`, `validNodeOperation`, `executeLocalNodeOperation`.

Читает/импортирует: [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Библиотеки/Node: `livekit-server-sdk`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/node/operations/route.ts`](../../apps/web/app/v1/node/operations/route.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/node-request.ts

[`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts)

Общие body-bound HMAC запросы к зарегистрированным нодам без передачи полномочий браузеру.

Экспортируемые символы: `ownNodeId`, `verifiedNodeRequest`, `signedNodeFetch`.

Читает/импортирует: [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/v1/control/node-admission/route.ts`](../../apps/web/app/v1/control/node-admission/route.ts), [`apps/web/app/v1/node/history/route.ts`](../../apps/web/app/v1/node/history/route.ts), [`apps/web/app/v1/node/operations/route.ts`](../../apps/web/app/v1/node/operations/route.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts).

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `NODE_ENV`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/lib/node-scheduler.ts

[`apps/web/lib/node-scheduler.ts`](../../apps/web/lib/node-scheduler.ts)

Детерминированный выбор подходящей ноды по режиму, health и capacity.

Экспортируемые символы: `NodeCapacity`, `StudioPlacementRequest`, `PlacementResult`, `nodeEligible`, `nodeScore`, `selectNode`.

Используют: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/tests/node-scheduler.cjs`](../../apps/web/tests/node-scheduler.cjs).

### apps/web/lib/node-state-transition.ts

[`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts)

Сериализация операций ноды через отдельный PostgreSQL advisory lock и различение desired/applied.

Экспортируемые символы: `changeNodeState`, `reconcileNodeState`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts).

Библиотеки/Node: `pg`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/control/node-admission/route.ts`](../../apps/web/app/v1/control/node-admission/route.ts).

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `DATABASE_URL`.

### apps/web/lib/node-topology.ts

[`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts)

Сбор configured и live комнат ноды, публикаций, свежей RTC-статистики без медийного подключения.

Экспортируемые символы: `collectLocalNodeTopology`.

Читает/импортирует: [`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `livekit-server-sdk`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/output-track-bindings.ts

[`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `createOutputTrackBindings`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/tests/output-track-bindings.cjs`](../../apps/web/tests/output-track-bindings.cjs).

### apps/web/lib/participant-role.ts

[`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts)

Определение отображаемой роли по identity/metadata; технические участники не становятся персоналом.

Экспортируемые символы: `ParticipantRole`, `resolveParticipantRole`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StaffParticipantsPanel.tsx`](../../apps/web/components/StaffParticipantsPanel.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/tests/participant-role.cjs`](../../apps/web/tests/participant-role.cjs).

### apps/web/lib/persistent-storage.ts

[`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts)

Пути постоянных данных, installation identity, атомарная запись JSON и startup-валидация.

Экспортируемые символы: `storageSchemaVersion`, `PersistentDataError`, `productionDataDir`, `runtimeFile`, `persistentStatsDir`, `readJson`, `atomicWriteJson`, `ensureInstallationIdentity`, `validatePersistentStorage`, `getInstallationIdentity`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts), [`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts), [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/tests/persistent-storage.cjs`](../../apps/web/tests/persistent-storage.cjs).

Переменные окружения (только имена): `NODE_ENV`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_MODERATOR_ACCESS_FILE`, `STUDIOLINK_ROOMS_FILE`, `STUDIOLINK_STATS_DIR`, `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/lib/personal-monitoring.ts

[`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts)

React-hook личных настроек прослушивания/видео; не общее управление источником.

Экспортируемые символы: `MonitorPreference`, `defaultMonitor`, `usePersonalMonitoring`.

Читает/импортирует: [`apps/web/lib/monitor-audio.ts`](../../apps/web/lib/monitor-audio.ts), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/ModeratorStudioMonitoring.tsx`](../../apps/web/components/ModeratorStudioMonitoring.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/tests/room-mode-monitoring.cjs`](../../apps/web/tests/room-mode-monitoring.cjs).

### apps/web/lib/platform-credentials.ts

[`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts)

Одноразовые opaque приглашения и сессии в PG: только хэши, срок, atomic redemption, отзыв.

Экспортируемые символы: `PLATFORM_INVITE_SECONDS`, `PLATFORM_SESSION_SECONDS`, `platformTokenHash`, `issuePlatformInvite`, `redeemPlatformInvite`, `readPlatformSession`, `revokePlatformSession`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts), [`apps/web/tests/node-operations-postgres.cjs`](../../apps/web/tests/node-operations-postgres.cjs), [`apps/web/tests/platform-access-postgres.cjs`](../../apps/web/tests/platform-access-postgres.cjs).

### apps/web/lib/platform-node-operations.ts

[`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts)

Маршрутизация разрешённых Super Admin-команд на соответствующую ноду.

Экспортируемые символы: `executePlatformNodeOperation`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts).

### apps/web/lib/platform-topology.ts

[`apps/web/lib/platform-topology.ts`](../../apps/web/lib/platform-topology.ts)

Объединение central registry и observed node rooms, неизвестные значения и отдельный assignment.

Экспортируемые символы: `mergePlatformTopology`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/tests/topology-merge.cjs`](../../apps/web/tests/topology-merge.cjs).

### apps/web/lib/postgres-room-store.ts

[`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts)

Node-local PostgreSQL backend комнат, транзакции, установка и studio scope.

Экспортируемые символы: `roomRecordFromRow`, `createPostgresPool`, `PostgresRoomStoreBackend`.

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `pg`.

Используют: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/tests/multitenant-room-isolation.cjs`](../../apps/web/tests/multitenant-room-isolation.cjs), [`apps/web/tests/postgres-room-store.cjs`](../../apps/web/tests/postgres-room-store.cjs).

Переменные окружения (только имена): `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_IDLE_TIMEOUT_MS`, `CASTLINK_DB_POOL_MAX`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `DATABASE_URL`, `STUDIOLINK_INSTALLATION_ID`.

### apps/web/lib/rate-limit.ts

[`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts)

Ограничитель частоты control API в памяти процесса, HTTP429 и Retry-After; не сетевая DDoS-защита.

Экспортируемые символы: `RateLimitOptions`, `RateLimitDecision`, `requestSource`, `consumeRateLimit`, `rateLimitHeaders`, `resetRateLimitsForTests`.

Читает/импортирует: [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts), [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/tests/rate-limit.cjs`](../../apps/web/tests/rate-limit.cjs).

### apps/web/lib/reconnect-status.ts

[`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts)

Состояния и подписи UI при подключении, потере связи и восстановлении.

Экспортируемые символы: `RecoveryPhase`, `RecoveryStatus`, `RecoveryEvent`, `initialRecoveryStatus`, `nextRecoveryStatus`, `recoveryBadge`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/tests/reconnect-recovery.cjs`](../../apps/web/tests/reconnect-recovery.cjs).

### apps/web/lib/room-admin.ts

[`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts)

Выдача и проверка scoped room-admin cookie/приглашений и версии их отзыва.

Экспортируемые символы: `newRoomAdminInvite`, `validRoomAdminInvite`, `setRoomAdminCookie`, `clearRoomAdminCookie`, `verifiedRoomAdminVersion`, `isRoomAdmin`, `roomAdminLifetimeSeconds`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/health/route.ts`](../../apps/web/app/api/health/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts).

### apps/web/lib/room-mode.ts

[`apps/web/lib/room-mode.ts`](../../apps/web/lib/room-mode.ts)

Браузерная синхронизация режима комнаты, например просмотра только Studio.

Экспортируемые символы: `useRoomMode`.

Библиотеки/Node: `react`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/lib/room-store.ts

[`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts)

Общий интерфейс комнат, выбор явно заданного JSON/PG backend, access versions.

Экспортируемые символы: `RoomRecord`, `RoomMutation`, `RoomStoreBackend`, `JsonRoomStoreBackend`, `validateRoomStore`, `readRooms`, `updateRooms`, `ensureRoomAccessVersions`, `readNodeRoomInventory`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/guest-command/route.ts`](../../apps/web/app/api/guest-command/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/tests/room-access-version.cjs`](../../apps/web/tests/room-access-version.cjs), [`apps/web/tests/room-store-backend.cjs`](../../apps/web/tests/room-store-backend.cjs).

Переменные окружения (только имена): `CASTLINK_STORAGE_BACKEND`, `STUDIOLINK_ROOMS_FILE`.

### apps/web/lib/rtc-telemetry.ts

[`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts)

Сбор клиентских RTC samples, дельты счётчиков и отправка статистики.

Экспортируемые символы: `rateDelta`, `startRoomTelemetry`.

Читает/импортирует: [`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts), [`apps/web/lib/telemetry-context.ts`](../../apps/web/lib/telemetry-context.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/tests/telemetry-scope.cjs`](../../apps/web/tests/telemetry-scope.cjs), [`apps/web/tests/telemetry.cjs`](../../apps/web/tests/telemetry.cjs).

### apps/web/lib/saved-servers.ts

[`apps/web/lib/saved-servers.ts`](../../apps/web/lib/saved-servers.ts)

Проверка и хранение списка выбранных пользователем адресов серверов.

Экспортируемые символы: `SavedServer`, `normalizeServerOrigin`, `normalizeSavedServer`, `readSavedServers`, `writeSavedServers`.

Используют: [`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx), [`apps/web/tests/saved-servers.cjs`](../../apps/web/tests/saved-servers.cjs).

### apps/web/lib/screen-share.ts

[`apps/web/lib/screen-share.ts`](../../apps/web/lib/screen-share.ts)

Публикация экрана с опциональным звуком, отмена и остановка позднего capture после disconnect.

Экспортируемые символы: `ScreenShareRoom`, `enableRoomScreenShare`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/tests/screen-share-lifecycle.cjs`](../../apps/web/tests/screen-share-lifecycle.cjs).

### apps/web/lib/server-lease.ts

[`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts)

Проверка подписанного разрешения установки обращаться к registry/server service.

Экспортируемые символы: `ServerLeasePayload`, `ServerLeaseStatus`, `verifyServerLease`.

Читает/импортирует: [`apps/web/lib/license-public-key.generated.ts`](../../apps/web/lib/license-public-key.generated.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/tests/licensing.cjs`](../../apps/web/tests/licensing.cjs).

### apps/web/lib/server-log.ts

[`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts)

Структурированные серверные события и correlation/request IDs без прямой печати секретов.

Экспортируемые символы: `requestId`, `serverLog`, `requestHeaders`.

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts), [`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts), [`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts).

### apps/web/lib/server-registry-client.ts

[`apps/web/lib/server-registry-client.ts`](../../apps/web/lib/server-registry-client.ts)

Серверный клиент внешнего реестра: список, временная нода, деактивация.

Экспортируемые символы: `RegisteredServer`, `listRegisteredServers`, `createTemporaryServer`, `deactivateRegisteredServer`.

Читает/импортирует: [`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts).

Используют: [`apps/web/app/api/servers/route.ts`](../../apps/web/app/api/servers/route.ts).

Переменные окружения (только имена): `CASTLINK_LICENSE_SERVICE_URL`, `CASTLINK_LICENSE_TIMEOUT_MS`, `CASTLINK_SERVER_LEASE`, `NODE_ENV`.

### apps/web/lib/server-transfer.ts

[`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts)

Проверка доверенных origin, server bridge, transfer ticket и состояние переноса.

Экспортируемые символы: `TransferRole`, `TransferTicket`, `EligibleGuestSession`, `updateTransferState`, `transferSecret`, `TransferTarget`, `resolveClientTargetUrl`, `transferTargets`, `transferServer`, `peerOriginAllowed`, `transferOriginConfigured`, `signBridge`, `verifyBridge`, `transferRoomKey`, `ticketHash`, `newTicket`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:net`, `node:path`.

Используют: [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs), [`apps/web/tests/server-transfer.cjs`](../../apps/web/tests/server-transfer.cjs).

Переменные окружения (только имена): `STUDIOLINK_DEFAULT_STUDIO_ID`, `STUDIOLINK_TRANSFER_ORIGIN`, `STUDIOLINK_TRANSFER_PEER_ORIGIN`, `STUDIOLINK_TRANSFER_SECRET`, `STUDIOLINK_TRANSFER_SERVER_ID`, `STUDIOLINK_TRANSFER_SERVER_LABEL`, `STUDIOLINK_TRANSFER_STATE_FILE`, `STUDIOLINK_TRANSFER_TARGETS_JSON`.

### apps/web/lib/setup-state.ts

[`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts)

Состояние первичной настройки, проверка setup-token, завершение setup.

Экспортируемые символы: `readSetupState`, `validSetupToken`, `setupRequired`, `SetupConflictError`, `completeSetup`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts), [`apps/web/tests/self-hosted-setup.cjs`](../../apps/web/tests/self-hosted-setup.cjs), [`apps/web/tests/setup-wizard.cjs`](../../apps/web/tests/setup-wizard.cjs).

Переменные окружения (только имена): `CASTLINK_SETUP_TOKEN`.

### apps/web/lib/staff-display-name.ts

[`apps/web/lib/staff-display-name.ts`](../../apps/web/lib/staff-display-name.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `reserveStaffDisplayName`.

Используют: [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/tests/staff-display-name.cjs`](../../apps/web/tests/staff-display-name.cjs).

### apps/web/lib/stats-csv.ts

[`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts)

CSV-экспорт, экранирование ячеек, BOM и нейтрализация формул из пользовательских строк.

Экспортируемые символы: `csv`, `historyCsv`, `connectionsCsv`.

Читает/импортирует: [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/tests/telemetry.cjs`](../../apps/web/tests/telemetry.cjs).

### apps/web/lib/stats-report.ts

[`apps/web/lib/stats-report.ts`](../../apps/web/lib/stats-report.ts)

Автономный HTML-отчёт с графиками, участниками, последними потоками и временными агрегатами.

Экспортируемые символы: `statisticsReport`.

Читает/импортирует: [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs).

### apps/web/lib/studio-control.ts

[`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts)

Основная студия, lease, epoch, desired/actual и сериализация runtime JSON.

Экспортируемые символы: `StudioDesired`, `StudioRoomState`, `validStudioRoom`, `validStudioClient`, `readStudioState`, `joinStudio`, `claimStudio`, `heartbeatStudio`, `releaseStudio`, `resetStudioForTransfer`, `updateStudioDesired`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Используют: [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs), [`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs), [`apps/web/tests/studio-control-devices.cjs`](../../apps/web/tests/studio-control-devices.cjs).

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/lib/studio-outbound-stats.ts

[`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts)

Нормализация и выбор свежей статистики исходящего Studio Return.

Экспортируемые символы: `StudioOutboundMetrics`, `StudioOutboundSample`, `StudioOutboundView`, `createStudioOutboundSample`, `selectStudioOutboundView`, `receiveStudioActual`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs), [`apps/web/tests/studio-outbound-stats.cjs`](../../apps/web/tests/studio-outbound-stats.cjs).

### apps/web/lib/studio-owner-access.ts

[`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts)

Scoped доступ владельца Studio; legacy пароль разрешён только для default Studio, не платформы.

Экспортируемые символы: `newStudioOwnerInvite`, `validStudioOwnerInvite`, `isStudioOwner`, `studioOwnerSessionExpiresAt`, `setStudioOwnerCookie`, `clearStudioOwnerCookie`, `revokeStudioOwnerAccess`, `studioOwnerLifetimeSeconds`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/health/route.ts`](../../apps/web/app/api/health/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/tests/studio-owner-access-postgres.cjs`](../../apps/web/tests/studio-owner-access-postgres.cjs), [`apps/web/tests/transfer-owner-session.cjs`](../../apps/web/tests/transfer-owner-session.cjs).

### apps/web/lib/studio-room-lifecycle.ts

[`apps/web/lib/studio-room-lifecycle.ts`](../../apps/web/lib/studio-room-lifecycle.ts)

Подписки на события жизненного цикла комнаты и их симметричная очистка.

Экспортируемые символы: `StudioRoomLifecycleHandlers`, `bindStudioRoomLifecycle`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/lib/studio-scope.ts

[`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts)

Валидация studioId и namespace реального LiveKit room name.

Экспортируемые символы: `defaultStudioId`, `validateStudioId`, `requestedStudioId`, `mediaRoomName`.

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/guest-command/route.ts`](../../apps/web/app/api/guest-command/route.ts), [`apps/web/app/api/health/route.ts`](../../apps/web/app/api/health/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/tests/multitenant-room-isolation.cjs`](../../apps/web/tests/multitenant-room-isolation.cjs), [`apps/web/tests/studio-access-isolation.cjs`](../../apps/web/tests/studio-access-isolation.cjs).

Переменные окружения (только имена): `STUDIOLINK_DEFAULT_STUDIO_ID`.

### apps/web/lib/studio-stream-relay.ts

[`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts)

Отдельная публикация Studio Return для /watch; не замена индивидуальным guest outputs.

Экспортируемые символы: `useStudioStreamRelay`.

Читает/импортирует: [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/lib/studio-video-recovery.ts

[`apps/web/lib/studio-video-recovery.ts`](../../apps/web/lib/studio-video-recovery.ts)

Восстановление видео Studio после остановки/замены трека и сетевых событий.

Экспортируемые символы: `watchStudioVideo`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/tests/studio-video-recovery.cjs`](../../apps/web/tests/studio-video-recovery.cjs).

### apps/web/lib/super-admin-access.ts

[`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts)

Отдельная opaque platform-сессия и cookie, делегирование, logout/revoke без Studio bootstrap.

Экспортируемые символы: `isSuperAdmin`, `newSuperAdminInvite`, `acceptSuperAdminInvite`, `setSuperAdminCookie`, `clearSuperAdminCookie`, `logoutSuperAdmin`, `revokeSuperAdminAccess`, `superAdminLifetimeSeconds`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/servers/route.ts`](../../apps/web/app/api/servers/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts), [`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts), [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts).

### apps/web/lib/talkback-policy.ts

[`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts)

Политика адресатов служебного звука, разрешения подписки и проверка управляющих сообщений.

Экспортируемые символы: `TALK_TO_ROOM`, `TalkbackTarget`, `TrackSubscriptionPermission`, `talkbackPermissions`, `isVerifiedTalkback`, `GuestMediaCommand`, `parseGuestMediaCommand`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/tests/talkback-policy.cjs`](../../apps/web/tests/talkback-policy.cjs).

### apps/web/lib/telemetry-context.ts

[`apps/web/lib/telemetry-context.ts`](../../apps/web/lib/telemetry-context.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `telemetryContext`.

Используют: [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/tests/telemetry-scope.cjs`](../../apps/web/tests/telemetry-scope.cjs).

### apps/web/lib/telemetry-store.ts

[`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts)

JSONL-хранилище измерений, retention/size limits, фильтры и агрегирование истории.

Экспортируемые символы: `saveSample`, `clearDisconnected`, `readHistory`.

Читает/импортирует: [`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:readline`.

Используют: [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs), [`apps/web/tests/telemetry.cjs`](../../apps/web/tests/telemetry.cjs).

Переменные окружения (только имена): `STUDIOLINK_STATS_MAX_BYTES`.

### apps/web/lib/telemetry-types.ts

[`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts)

Типы RTC samples/history/streams и правила суммирования/средних.

Экспортируемые символы: `StreamStat`, `TelemetryRole`, `TelemetrySample`, `MetricPoint`, `ConnectionHistory`, `HistoryResponse`, `sumRates`, `mean`.

Используют: [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts), [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts), [`apps/web/lib/stats-report.ts`](../../apps/web/lib/stats-report.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

### apps/web/lib/tenant-scope.ts

[`apps/web/lib/tenant-scope.ts`](../../apps/web/lib/tenant-scope.ts)

Проверка и сравнение organization/studio/room scope, составные ключи.

Экспортируемые символы: `TenantScope`, `validateTenantScope`, `tenantKey`, `sameStudio`, `sameRoom`.

Используют: [`apps/web/tests/tenant-scope.cjs`](../../apps/web/tests/tenant-scope.cjs).

### apps/web/lib/video-fit.ts

[`apps/web/lib/video-fit.ts`](../../apps/web/lib/video-fit.ts)

Расчёт максимального вписывания native кадра после поворота и применение размеров к video.

Экспортируемые символы: `videoFitGeometry`, `applyContainedVideoFit`.

Используют: [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts), [`apps/web/tests/feedback-media.cjs`](../../apps/web/tests/feedback-media.cjs).

### apps/web/lib/video-quality.ts

[`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts)

FPS/bitrate ranges, capture/publish options, суммарный бюджет RTP encodings и default guest cap.

Экспортируемые символы: `STUDIO_FRAME_RATES`, `StudioFrameRate`, `MIN_STUDIO_VIDEO_BITRATE_KBPS`, `MAX_STUDIO_VIDEO_BITRATE_KBPS`, `DEFAULT_STUDIO_VIDEO_BITRATE_KBPS`, `VIDEO_BITRATES_KBPS`, `MAX_GUEST_VIDEO_BITRATE`, `isValidStudioVideoBitrateKbps`, `videoBitrateOptions`, `studioVideoConstraints`, `studioVideoPublishOptions`, `capStudioVideoEncodings`, `studioVideoEncodingsMatch`, `applyStudioSenderQuality`, `DEFAULT_GUEST_VIDEO_BITRATE_KBPS`, `guestVideoBitrate`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx), [`apps/web/lib/guest-video-bitrate.ts`](../../apps/web/lib/guest-video-bitrate.ts), [`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts), [`apps/web/tests/feedback-media.cjs`](../../apps/web/tests/feedback-media.cjs), [`apps/web/tests/video-quality.cjs`](../../apps/web/tests/video-quality.cjs).

### apps/web/lib/video-rotation.ts

[`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts)

React-жизненный цикл поворота: metadata и resize → геометрия native кадра.

Экспортируемые символы: `participantRotation`, `useVideoRotation`.

Читает/импортирует: [`apps/web/lib/video-fit.ts`](../../apps/web/lib/video-fit.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx).

### apps/web/lib/watch-subscriptions.ts

[`apps/web/lib/watch-subscriptions.ts`](../../apps/web/lib/watch-subscriptions.ts)

Фильтрация технических /watch подписок и защита от устаревшего намерения playback.

Экспортируемые символы: `WatchTrackKind`, `shouldSubscribeToWatchTrack`, `PlaybackIntent`, `togglePlaybackIntent`, `isPlaybackIntentCurrent`.

Используют: [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/tests/watch-subscriptions.cjs`](../../apps/web/tests/watch-subscriptions.cjs).

## apps/web/next.config.ts · 1 файлов

### apps/web/next.config.ts

[`apps/web/next.config.ts`](../../apps/web/next.config.ts)

Версия/build ID, headers безопасности, параметры сборки Next.js.

Библиотеки/Node: `next`, `node:crypto`, `node:fs`.

Переменные окружения (только имена): `NEXT_BUILD_DIR`, `STUDIOLINK_RELEASE`.

## apps/web/package.json · 1 файлов

### apps/web/package.json

[`apps/web/package.json`](../../apps/web/package.json)

Зависимости и команды конкретного подпроекта.

Используют: [`apps/web/tests/version-api.cjs`](../../apps/web/tests/version-api.cjs).

## apps/web/tests · 111 файлов

### apps/web/tests/access-secrets.cjs

[`apps/web/tests/access-secrets.cjs`](../../apps/web/tests/access-secrets.cjs)

Проверка/тестовый инструмент. PASS: dedicated session/data secrets with legacy migration fallback

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `CASTLINK_DATA_ENCRYPTION_KEY`, `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`.

### apps/web/tests/admin-access-api.cjs

[`apps/web/tests/admin-access-api.cjs`](../../apps/web/tests/admin-access-api.cjs)

Проверка/тестовый инструмент. PASS: room-admin invitation/revocation, room-scoped APIs, non-publishing token, primary lease and participant safety

Библиотеки/Node: `node:assert/strict`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_STUDIO_PASSWORD`.

### apps/web/tests/admin-ui.cjs

[`apps/web/tests/admin-ui.cjs`](../../apps/web/tests/admin-ui.cjs)

Проверка/тестовый инструмент. Admin UI receive-only and invite safeguards passed

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/app-update-api.cjs

[`apps/web/tests/app-update-api.cjs`](../../apps/web/tests/app-update-api.cjs)

Проверка/тестовый инструмент. PASS: API/build/client version agreement, uncached API and HTML, output/monitor exclusion

Читает/импортирует: [`package.json`](../../package.json).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_BUILD_DIR`.

### apps/web/tests/app-update-notice.cjs

[`apps/web/tests/app-update-notice.cjs`](../../apps/web/tests/app-update-notice.cjs)

Проверка/тестовый инструмент. PASS: background detection without reload, explicit refresh, offline handling, output exclusion, listener cleanup

Читает/импортирует: [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx), [`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `NEXT_PUBLIC_APP_VERSION`.

### apps/web/tests/app-update.cjs

[`apps/web/tests/app-update.cjs`](../../apps/web/tests/app-update.cjs)

Проверка/тестовый инструмент. PASS: current/new/rollback releases, invalid API responses, cache busting with preserved room URL

Читает/импортирует: [`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/client-transfer.cjs

[`apps/web/tests/client-transfer.cjs`](../../apps/web/tests/client-transfer.cjs)

Проверка/тестовый инструмент. PASS: client transfer routing keeps canonical fallback and restricts LAN overrides

Читает/импортирует: [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/conference-layout-browser.py

[`apps/web/tests/conference-layout-browser.py`](../../apps/web/tests/conference-layout-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/control-plane-client-remote.cjs

[`apps/web/tests/control-plane-client-remote.cjs`](../../apps/web/tests/control-plane-client-remote.cjs)

Проверка/тестовый инструмент. PASS: remote node reads Studio owner/version route over signed HTTP without control-plane DB access

Читает/импортирует: [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `NODE_ENV`.

### apps/web/tests/control-plane-postgres.cjs

[`apps/web/tests/control-plane-postgres.cjs`](../../apps/web/tests/control-plane-postgres.cjs)

Проверка/тестовый инструмент. PASS: control-plane schema isolates same-name rooms by studio and coexists with node-local storage

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `pg`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/control-plane-register-node.cjs

[`apps/web/tests/control-plane-register-node.cjs`](../../apps/web/tests/control-plane-register-node.cjs)

Проверка/тестовый инструмент. PASS: control-plane node registration is idempotent and updates routing/capacity

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:path`, `pg`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/control-plane-seed.cjs

[`apps/web/tests/control-plane-seed.cjs`](../../apps/web/tests/control-plane-seed.cjs)

Проверка/тестовый инструмент. PASS: existing single-studio node migrates idempotently into default multi-tenant control-plane scope

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `pg`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/control-plane-store.cjs

[`apps/web/tests/control-plane-store.cjs`](../../apps/web/tests/control-plane-store.cjs)

Проверка/тестовый инструмент. PASS: owner control-plane store creates studios, auto-assigns capacity and locks live placement

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DEFAULT_ORGANIZATION_ID`, `TEST_DATABASE_URL`.

### apps/web/tests/control-response.cjs

[`apps/web/tests/control-response.cjs`](../../apps/web/tests/control-response.cjs)

Проверка/тестовый инструмент. PASS: Studio Control response parser handles valid, empty, malformed, non-JSON, and API-error responses

Читает/импортирует: [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/diagnostics-page.cjs

[`apps/web/tests/diagnostics-page.cjs`](../../apps/web/tests/diagnostics-page.cjs)

Проверка/тестовый инструмент. PASS: diagnostics page hides data when protected health endpoint denies access

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/feedback-media.cjs

[`apps/web/tests/feedback-media.cjs`](../../apps/web/tests/feedback-media.cjs)

Проверка/тестовый инструмент. PASS: 48 native aspect/rotation cases, quiet meter signals, ballistic release, aggregate camera caps

Читает/импортирует: [`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts), [`apps/web/lib/video-fit.ts`](../../apps/web/lib/video-fit.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/fullscreen.cjs

[`apps/web/tests/fullscreen.cjs`](../../apps/web/tests/fullscreen.cjs)

Проверка/тестовый инструмент. PASS: native fullscreen with CSS fallback for iOS/WebKit limitations

Читает/импортирует: [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/guest-access-api.cjs

[`apps/web/tests/guest-access-api.cjs`](../../apps/web/tests/guest-access-api.cjs)

Проверка/тестовый инструмент. PASS: strict guest passwords, studio-cookie isolation, stale-cookie removal, signed invitations, tampering/expiry/room binding, open rooms

Библиотеки/Node: `node:assert/strict`, `node:crypto`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_SIGNING_SECRET`.

### apps/web/tests/guest-entry.cjs

[`apps/web/tests/guest-entry.cjs`](../../apps/web/tests/guest-entry.cjs)

Проверка/тестовый инструмент. PASS: two-field guest entry, no cookie auto-bypass, wrong/correct passwords, invitation bypass and invalid-link fallback

Читает/импортирует: [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-invite-revocation.cjs

[`apps/web/tests/guest-invite-revocation.cjs`](../../apps/web/tests/guest-invite-revocation.cjs)

Проверка/тестовый инструмент. PASS: guest invite fragment, independent version and explicit revocation

Читает/импортирует: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-media.cjs

[`apps/web/tests/guest-media.cjs`](../../apps/web/tests/guest-media.cjs)

Проверка/тестовый инструмент. PASS: guest device constraints, admin-only client-info recipients, bounded payload validation, and output-target data privacy

Читает/импортирует: [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-participants-table.cjs

[`apps/web/tests/guest-participants-table.cjs`](../../apps/web/tests/guest-participants-table.cjs)

Проверка/тестовый инструмент. PASS: guest participants table extraction preserves move, kick, refresh and output actions

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/guest-video-card.cjs

[`apps/web/tests/guest-video-card.cjs`](../../apps/web/tests/guest-video-card.cjs)

Проверка/тестовый инструмент. PASS: guest video card extraction preserves preview, monitoring, quality and actions

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/health-api.cjs

[`apps/web/tests/health-api.cjs`](../../apps/web/tests/health-api.cjs)

Проверка/тестовый инструмент. PASS: health endpoint is restricted to studio-owner/room-admin access and excludes application secrets

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/heartbeat-host-metrics.cjs

[`apps/web/tests/heartbeat-host-metrics.cjs`](../../apps/web/tests/heartbeat-host-metrics.cjs)

Проверка/тестовый инструмент. PASS: measured host egress, first sample unavailable, counter reset, stale interval and actual zero

Читает/импортирует: [`scripts/heartbeat-host-metrics.mjs`](../../scripts/heartbeat-host-metrics.mjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/helpers/rate-limit.cjs

[`apps/web/tests/helpers/rate-limit.cjs`](../../apps/web/tests/helpers/rate-limit.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:fs`, `node:path`, `node:vm`, `typescript`.

Используют: [`apps/web/tests/panel-session.cjs`](../../apps/web/tests/panel-session.cjs), [`apps/web/tests/rotation-api.cjs`](../../apps/web/tests/rotation-api.cjs).

### apps/web/tests/licensing.cjs

[`apps/web/tests/licensing.cjs`](../../apps/web/tests/licensing.cjs)

Проверка/тестовый инструмент. PASS: Ed25519 license/lease signatures, installation binding, server binding and expiry checks

Читает/импортирует: [`apps/web/lib/license.ts`](../../apps/web/lib/license.ts), [`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/live-telemetry-cache.cjs

[`apps/web/tests/live-telemetry-cache.cjs`](../../apps/web/tests/live-telemetry-cache.cjs)

Проверка/тестовый инструмент. PASS: shared bounded topology cache, one cold seed, monotonic rename and room isolation

Читает/импортирует: [`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/manual-docs.cjs

[`apps/web/tests/manual-docs.cjs`](../../apps/web/tests/manual-docs.cjs)

Проверка/тестовый инструмент. PASS: beginner manual links resolve and the full source-file catalog matches Git index

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:path`.

### apps/web/tests/mobile-operations-browser.py

[`apps/web/tests/mobile-operations-browser.py`](../../apps/web/tests/mobile-operations-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/moderator-access-api.cjs

[`apps/web/tests/moderator-access-api.cjs`](../../apps/web/tests/moderator-access-api.cjs)

Проверка/тестовый инструмент. PASS: server moderator invitation, room management allowlist, guest-only controls, read-only studio access, and owner/admin boundaries

Библиотеки/Node: `node:assert/strict`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_STUDIO_PASSWORD`.

### apps/web/tests/moderator-room-rename.cjs

[`apps/web/tests/moderator-room-rename.cjs`](../../apps/web/tests/moderator-room-rename.cjs)

Проверка/тестовый инструмент. PASS: moderators can rename inactive empty rooms but cannot rename rooms with participants or a live primary lease

Читает/импортирует: [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/moderator-studio-ui.cjs

[`apps/web/tests/moderator-studio-ui.cjs`](../../apps/web/tests/moderator-studio-ui.cjs)

Проверка/тестовый инструмент. PASS: moderator UI preserves studioId through refresh, room tools and invite flow

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/monitor-audio.cjs

[`apps/web/tests/monitor-audio.cjs`](../../apps/web/tests/monitor-audio.cjs)

Проверка/тестовый инструмент. PASS: reconnect mute, replacement element/track, WebAudio, live volume, zero slider, listener cleanup

Читает/импортирует: [`apps/web/lib/monitor-audio.ts`](../../apps/web/lib/monitor-audio.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/move-guest-studio-scope.cjs

[`apps/web/tests/move-guest-studio-scope.cjs`](../../apps/web/tests/move-guest-studio-scope.cjs)

Проверка/тестовый инструмент. PASS: guest move commands and moderator authorization remain studio-scoped

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/multitenant-room-isolation.cjs

[`apps/web/tests/multitenant-room-isolation.cjs`](../../apps/web/tests/multitenant-room-isolation.cjs)

Проверка/тестовый инструмент. PASS: identical room names remain isolated by studio in PostgreSQL and LiveKit namespace

Читает/импортирует: [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/node-control-plane-api.cjs

[`apps/web/tests/node-control-plane-api.cjs`](../../apps/web/tests/node-control-plane-api.cjs)

Проверка/тестовый инструмент. PASS: node control-plane reads and transfer mutations are HMAC signed, scoped and body-bound

Читает/импортирует: [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/node-heartbeat.cjs

[`apps/web/tests/node-heartbeat.cjs`](../../apps/web/tests/node-heartbeat.cjs)

Проверка/тестовый инструмент. PASS: node heartbeat signing/auth rejects tampering and validates freshness/load fields

Читает/импортирует: [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/node-heartbeat.ts`](../../apps/web/lib/node-heartbeat.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `CASTLINK_NODE_SECRETS_JSON`.

### apps/web/tests/node-operations-postgres.cjs

[`apps/web/tests/node-operations-postgres.cjs`](../../apps/web/tests/node-operations-postgres.cjs)

Проверка/тестовый инструмент. PASS: actual PostgreSQL + LiveKit + Caddy: connected participant drain, forced eviction, denied old-token reconnect, re-enable, rename and kick revocation

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts).

Библиотеки/Node: `livekit-server-sdk`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_SERVER_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/node-operations.cjs

[`apps/web/tests/node-operations.cjs`](../../apps/web/tests/node-operations.cjs)

Проверка/тестовый инструмент. PASS: node lifecycle/acknowledgement, session-bound mutation, block-before-kick, body HMAC and same-token admission denial

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/node-scheduler.cjs

[`apps/web/tests/node-scheduler.cjs`](../../apps/web/tests/node-scheduler.cjs)

Проверка/тестовый инструмент. PASS: node scheduler enforces health/capacity, pinning, stable broadcast and deterministic placement

Читает/импортирует: [`apps/web/lib/node-scheduler.ts`](../../apps/web/lib/node-scheduler.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/output-media-browser.py

[`apps/web/tests/output-media-browser.py`](../../apps/web/tests/output-media-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/output-track-bindings.cjs

[`apps/web/tests/output-track-bindings.cjs`](../../apps/web/tests/output-track-bindings.cjs)

Проверка/тестовый инструмент. PASS: 100 redundant events -> 1 attachment, 100 republish cycles leak-free, late events preserve replacement/audio

Читает/импортирует: [`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/panel-session.cjs

[`apps/web/tests/panel-session.cjs`](../../apps/web/tests/panel-session.cjs)

Проверка/тестовый инструмент. PASS: moderator presentation with existing admin session, unchanged authorization, camera grants, confirmed publication and failures

Читает/импортирует: [`apps/web/tests/helpers/rate-limit.cjs`](../../apps/web/tests/helpers/rate-limit.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/parallel-studios.cjs

[`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs)

Проверка/тестовый инструмент. PASS: parallel primary rooms, command/lease isolation, clock skew, stale sample age, 2-second export, HTML escaping

Читает/импортирует: [`apps/web/lib/stats-report.ts`](../../apps/web/lib/stats-report.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STATS_DIR`, `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/participant-mute-api.cjs

[`apps/web/tests/participant-mute-api.cjs`](../../apps/web/tests/participant-mute-api.cjs)

Проверка/тестовый инструмент. PASS: guest media controls, scoped session revocation, linked talkback kick, and admin/main safety

Читает/импортирует: [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts).

Библиотеки/Node: `livekit-server-sdk`, `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/participant-role.cjs

[`apps/web/tests/participant-role.cjs`](../../apps/web/tests/participant-role.cjs)

Проверка/тестовый инструмент. PASS: admin/moderator/guest roles and technical participant exclusion

Читает/импортирует: [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/persistent-storage.cjs

[`apps/web/tests/persistent-storage.cjs`](../../apps/web/tests/persistent-storage.cjs)

Проверка/тестовый инструмент. PASS: production data dir, stable installation identity, mismatch guard and corrupt JSON startup failure

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `NODE_ENV`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_INSTALLATION_ID`.

### apps/web/tests/platform-access-postgres.cjs

[`apps/web/tests/platform-access-postgres.cjs`](../../apps/web/tests/platform-access-postgres.cjs)

Проверка/тестовый инструмент. PASS: migration 004, actual PostgreSQL concurrent one-use redemption, expiry, logout, global revoke, and private owner CLI output

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/platform-access.cjs

[`apps/web/tests/platform-access.cjs`](../../apps/web/tests/platform-access.cjs)

Проверка/тестовый инструмент. PASS: creator-only bootstrap boundary, rejected tenant roles, legacy invalidation, one-use invitations, logout and global revocation

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/postgres-import-rooms.cjs

[`apps/web/tests/postgres-import-rooms.cjs`](../../apps/web/tests/postgres-import-rooms.cjs)

Проверка/тестовый инструмент. PASS: PostgreSQL migration/import is ordered, idempotent and refuses implicit overwrite

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `pg`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/postgres-room-store.cjs

[`apps/web/tests/postgres-room-store.cjs`](../../apps/web/tests/postgres-room-store.cjs)

Проверка/тестовый инструмент. PASS: PostgreSQL room store isolates studios, preserves order and serializes concurrent mutations

Читает/импортирует: [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/production-deployment.cjs

[`apps/web/tests/production-deployment.cjs`](../../apps/web/tests/production-deployment.cjs)

Проверка/тестовый инструмент. PASS: production preflight, update/rollback and cross-platform installer safeguards

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`.

Переменные окружения (только имена): `PATH`.

### apps/web/tests/rate-limit.cjs

[`apps/web/tests/rate-limit.cjs`](../../apps/web/tests/rate-limit.cjs)

Проверка/тестовый инструмент. PASS: bounded control-plane anti-abuse limits source/subject floods without touching media path

Читает/импортирует: [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/reconnect-recovery.cjs

[`apps/web/tests/reconnect-recovery.cjs`](../../apps/web/tests/reconnect-recovery.cjs)

Проверка/тестовый инструмент. PASS: reconnect phases, retry without refresh, output resubscribe, device fallback/restore and recovered UI

Читает/импортирует: [`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/remote-studio-devices.cjs

[`apps/web/tests/remote-studio-devices.cjs`](../../apps/web/tests/remote-studio-devices.cjs)

Проверка/тестовый инструмент. PASS: remote studio device kinds, selected IDs, live input lock, offline/pending states and device errors

Читает/импортирует: [`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `react`, `react-dom/server`, `typescript`.

### apps/web/tests/room-access-version.cjs

[`apps/web/tests/room-access-version.cjs`](../../apps/web/tests/room-access-version.cjs)

Проверка/тестовый инструмент. PASS: legacy access versions bootstrap compatibly and persist

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_ROOMS_FILE`.

### apps/web/tests/room-mode-monitoring.cjs

[`apps/web/tests/room-mode-monitoring.cjs`](../../apps/web/tests/room-mode-monitoring.cjs)

Проверка/тестовый инструмент. PASS: studio-only controls and moderator local listen defaults, gain, explicit audio unlock, no publication, and cleanup

Читает/импортирует: [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/room-store-backend.cjs

[`apps/web/tests/room-store-backend.cjs`](../../apps/web/tests/room-store-backend.cjs)

Проверка/тестовый инструмент. PASS: room-store backend preserves default room, versioned JSON and serialized mutations

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `NODE_ENV`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_ROOMS_FILE`.

### apps/web/tests/rotation-api.cjs

[`apps/web/tests/rotation-api.cjs`](../../apps/web/tests/rotation-api.cjs)

Проверка/тестовый инструмент. PASS: rotation authorization, room scope, primary protection, metadata preservation, four quarter turns

Читает/импортирует: [`apps/web/tests/helpers/rate-limit.cjs`](../../apps/web/tests/helpers/rate-limit.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/run-ci.cjs

[`apps/web/tests/run-ci.cjs`](../../apps/web/tests/run-ci.cjs)

Проверка/тестовый инструмент. \nPASS: ${tests.length} stable CI tests\n

Библиотеки/Node: `node:child_process`, `node:path`.

### apps/web/tests/saved-servers.cjs

[`apps/web/tests/saved-servers.cjs`](../../apps/web/tests/saved-servers.cjs)

Проверка/тестовый инструмент. saved server validation passed

Читает/импортирует: [`apps/web/lib/saved-servers.ts`](../../apps/web/lib/saved-servers.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/screen-share-lifecycle.cjs

[`apps/web/tests/screen-share-lifecycle.cjs`](../../apps/web/tests/screen-share-lifecycle.cjs)

Проверка/тестовый инструмент. PASS: screen share publishes, cancels cleanly, requests optional audio, and stops late capture after disconnect

Читает/импортирует: [`apps/web/lib/screen-share.ts`](../../apps/web/lib/screen-share.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/security-url-secrets.cjs

[`apps/web/tests/security-url-secrets.cjs`](../../apps/web/tests/security-url-secrets.cjs)

Проверка/тестовый инструмент. PASS: guest/output secrets are generated in fragments and exchanged outside URL query

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/self-hosted-setup.cjs

[`apps/web/tests/self-hosted-setup.cjs`](../../apps/web/tests/self-hosted-setup.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts), [`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:test`, `node:vm`, `react-dom/server`, `typescript`.

Переменные окружения (только имена): `CASTLINK_DEPLOYMENT_MODEL`, `CASTLINK_LICENSE_SERVICE_URL`, `CASTLINK_SERVER_ID`, `CASTLINK_SETUP_TOKEN`, `FIXTURE_QUERY_FILE`, `NODE_ENV`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/server-logging.cjs

[`apps/web/tests/server-logging.cjs`](../../apps/web/tests/server-logging.cjs)

Проверка/тестовый инструмент. PASS: structured logging covers auth, rooms, token issuance, control-plane, node heartbeat and failover while redacting sensitive fields

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/server-registry.cjs

[`apps/web/tests/server-registry.cjs`](../../apps/web/tests/server-registry.cjs)

Проверка/тестовый инструмент. PASS: server registry is Super-Admin-only and keeps signed lease server-side

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/server-transfer-api.cjs

[`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs)

Проверка/тестовый инструмент. PASS: studio authorization, token-scoped guest migration, legacy cutoff, snapshot failure, empty-room studio handoff, signed bridge, collision protection, and one-use ticket exchange

Читает/импортирует: [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `STUDIOLINK_STUDIO_CONTROL_FILE`, `STUDIOLINK_STUDIO_PASSWORD_HASH`, `STUDIOLINK_TRANSFER_ORIGIN`, `STUDIOLINK_TRANSFER_PEER_ORIGIN`, `STUDIOLINK_TRANSFER_SECRET`, `STUDIOLINK_TRANSFER_SERVER_ID`, `STUDIOLINK_TRANSFER_SERVER_LABEL`, `STUDIOLINK_TRANSFER_STATE_FILE`, `STUDIOLINK_TRANSFER_TARGETS_JSON`.

### apps/web/tests/server-transfer.cjs

[`apps/web/tests/server-transfer.cjs`](../../apps/web/tests/server-transfer.cjs)

Проверка/тестовый инструмент. PASS: signed peer requests, origin allowlist, role-bound one-use ticket material, and transfer state expiry

Читает/импортирует: [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_TRANSFER_PEER_ORIGIN`, `STUDIOLINK_TRANSFER_SECRET`, `STUDIOLINK_TRANSFER_SERVER_ID`, `STUDIOLINK_TRANSFER_SERVER_LABEL`, `STUDIOLINK_TRANSFER_STATE_FILE`, `STUDIOLINK_TRANSFER_TARGETS_JSON`.

### apps/web/tests/setup-wizard.cjs

[`apps/web/tests/setup-wizard.cjs`](../../apps/web/tests/setup-wizard.cjs)

Проверка/тестовый инструмент. PASS: first-run setup token is one-time gated and never persisted

Читает/импортирует: [`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_DEPLOYMENT_MODEL`, `CASTLINK_SETUP_TOKEN`, `NODE_ENV`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/staff-display-name.cjs

[`apps/web/tests/staff-display-name.cjs`](../../apps/web/tests/staff-display-name.cjs)

Проверка/тестовый инструмент. PASS: 20 simultaneous staff logins, stable retry, room/role isolation, manual names and expiry

Читает/импортирует: [`apps/web/lib/staff-display-name.ts`](../../apps/web/lib/staff-display-name.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/staff-participants-panel.cjs

[`apps/web/tests/staff-participants-panel.cjs`](../../apps/web/tests/staff-participants-panel.cjs)

Проверка/тестовый инструмент. PASS: staff participants extraction preserves roles, self marker and preview slot

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/statistics-dashboard-refresh.cjs

[`apps/web/tests/statistics-dashboard-refresh.cjs`](../../apps/web/tests/statistics-dashboard-refresh.cjs)

Проверка/тестовый инструмент. PASS: statistics refresh requests use current primary or moderator credentials

Читает/импортирует: [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/statistics-filters.cjs

[`apps/web/tests/statistics-filters.cjs`](../../apps/web/tests/statistics-filters.cjs)

Проверка/тестовый инструмент. PASS: statistics role/participant/session filters and detailed report wiring

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/stats-api.cjs

[`apps/web/tests/stats-api.cjs`](../../apps/web/tests/stats-api.cjs)

Проверка/тестовый инструмент. PASS: studio login/logout, guest passwords, role bypass protection, viewer links, kick authorization, stats ingestion/periods/reset, preserved graphs, protected commands, pages

Библиотеки/Node: `node:assert/strict`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_STUDIO_PASSWORD`.

### apps/web/tests/storage-backup-restore.cjs

[`apps/web/tests/storage-backup-restore.cjs`](../../apps/web/tests/storage-backup-restore.cjs)

Проверка/тестовый инструмент. PASS: backup manifest/checksums, full restore, installation guard and tamper detection

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`.

### apps/web/tests/studio-access-isolation.cjs

[`apps/web/tests/studio-access-isolation.cjs`](../../apps/web/tests/studio-access-isolation.cjs)

Проверка/тестовый инструмент. PASS: guest cookies, invites, viewer grants and media rooms are isolated by studioId

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`, `STUDIOLINK_DEFAULT_STUDIO_ID`.

### apps/web/tests/studio-auth-isolation.cjs

[`apps/web/tests/studio-auth-isolation.cjs`](../../apps/web/tests/studio-auth-isolation.cjs)

Проверка/тестовый инструмент. PASS: guest/moderator access is scoped by studio and cross-studio reuse is rejected

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`.

### apps/web/tests/studio-control-api.cjs

[`apps/web/tests/studio-control-api.cjs`](../../apps/web/tests/studio-control-api.cjs)

Проверка/тестовый инструмент. PASS: studio primary lease, moderator command authorization, validation, bounded requests, and non-publishing moderator token

Библиотеки/Node: `node:assert/strict`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_STUDIO_PASSWORD`.

### apps/web/tests/studio-control-devices.cjs

[`apps/web/tests/studio-control-devices.cjs`](../../apps/web/tests/studio-control-devices.cjs)

Проверка/тестовый инструмент. PASS: studio device command validation, input-transition lock, offline lease, and epoch reset

Читает/импортирует: [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/studio-control-plane-api.cjs

[`apps/web/tests/studio-control-plane-api.cjs`](../../apps/web/tests/studio-control-plane-api.cjs)

Проверка/тестовый инструмент. PASS: studio control-plane API is Super-Admin-only and mutation requests require same-origin

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-device-control-panel.cjs

[`apps/web/tests/studio-device-control-panel.cjs`](../../apps/web/tests/studio-device-control-panel.cjs)

Проверка/тестовый инструмент. PASS: Studio device control extraction preserves local/remote device wiring

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-main-scope.cjs

[`apps/web/tests/studio-main-scope.cjs`](../../apps/web/tests/studio-main-scope.cjs)

Проверка/тестовый инструмент. PASS: main studio UI preserves studioId across room, token and control operations

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-moderator-monitoring.cjs

[`apps/web/tests/studio-moderator-monitoring.cjs`](../../apps/web/tests/studio-moderator-monitoring.cjs)

Проверка/тестовый инструмент. PASS: moderator Studio monitoring extraction preserves personal monitoring callbacks

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-outbound-stats.cjs

[`apps/web/tests/studio-outbound-stats.cjs`](../../apps/web/tests/studio-outbound-stats.cjs)

Проверка/тестовый инструмент. PASS: primary outbound snapshot, moderator mirror, bounded history, stale/offline/reset guards

Читает/импортирует: [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/studio-owner-access-postgres.cjs

[`apps/web/tests/studio-owner-access-postgres.cjs`](../../apps/web/tests/studio-owner-access-postgres.cjs)

Проверка/тестовый инструмент. PASS: signed owner-links are isolated per Studio and revocation is tenant-local

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DEFAULT_ORGANIZATION_ID`, `CASTLINK_SESSION_SECRET`, `DATABASE_URL`, `LIVEKIT_API_SECRET`, `TEST_DATABASE_URL`.

### apps/web/tests/studio-owner-access.cjs

[`apps/web/tests/studio-owner-access.cjs`](../../apps/web/tests/studio-owner-access.cjs)

Проверка/тестовый инструмент. PASS: per-studio owner access is scoped, revocable and owner-link targets assigned node

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-return-publishing-controls.cjs

[`apps/web/tests/studio-return-publishing-controls.cjs`](../../apps/web/tests/studio-return-publishing-controls.cjs)

Проверка/тестовый инструмент. PASS: Studio Return publishing extraction preserves enable/disable rules and callbacks

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-return-stats-panel.cjs

[`apps/web/tests/studio-return-stats-panel.cjs`](../../apps/web/tests/studio-return-stats-panel.cjs)

Проверка/тестовый инструмент. PASS: Studio Return stats extraction preserves quality controls, errors and header actions

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-room-lifecycle.cjs

[`apps/web/tests/studio-room-lifecycle.cjs`](../../apps/web/tests/studio-room-lifecycle.cjs)

Проверка/тестовый инструмент. PASS: Studio Room lifecycle extraction preserves event binding and disconnect cleanup

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-room-management-panel.cjs

[`apps/web/tests/studio-room-management-panel.cjs`](../../apps/web/tests/studio-room-management-panel.cjs)

Проверка/тестовый инструмент. PASS: Studio room management UI extraction preserves callbacks and dialog behavior

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-routing.cjs

[`apps/web/tests/studio-routing.cjs`](../../apps/web/tests/studio-routing.cjs)

Проверка/тестовый инструмент. PASS: studio routing exposes only assigned healthy node and guest access is studio-scoped

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-stream-relay.cjs

[`apps/web/tests/studio-stream-relay.cjs`](../../apps/web/tests/studio-stream-relay.cjs)

Проверка/тестовый инструмент. PASS: watch relay 12000→6000 live cap/FPS, no reconnect/unpublish on quality change, reconciliation, viewer-zero cleanup preserves main sources

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/studio-transfer-panel.cjs

[`apps/web/tests/studio-transfer-panel.cjs`](../../apps/web/tests/studio-transfer-panel.cjs)

Проверка/тестовый инструмент. PASS: Studio server transfer panel extraction preserves state and callbacks

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-video-recovery.cjs

[`apps/web/tests/studio-video-recovery.cjs`](../../apps/web/tests/studio-video-recovery.cjs)

Проверка/тестовый инструмент. PASS: flowing video, prolonged stall recovery, mute, disabled video, cleanup

Читает/импортирует: [`apps/web/lib/studio-video-recovery.ts`](../../apps/web/lib/studio-video-recovery.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/studio-viewer-api.cjs

[`apps/web/tests/studio-viewer-api.cjs`](../../apps/web/tests/studio-viewer-api.cjs)

Проверка/тестовый инструмент. PASS: studio viewer scope, isolated subscriptions and explicit link revocation

Читает/импортирует: [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/studios-page.cjs

[`apps/web/tests/studios-page.cjs`](../../apps/web/tests/studios-page.cjs)

Проверка/тестовый инструмент. PASS: multi-studio placement UI is platform-gated and consumes sanitized control-plane API only

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/super-admin.cjs

[`apps/web/tests/super-admin.cjs`](../../apps/web/tests/super-admin.cjs)

Проверка/тестовый инструмент. PASS: isolated Super Admin access, four node states, signed topology, no media grants and limited diagnostics boundary

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/talkback-policy.cjs

[`apps/web/tests/talkback-policy.cjs`](../../apps/web/tests/talkback-policy.cjs)

Проверка/тестовый инструмент. talkback policy and server-only guest media command checks passed

Читает/импортирует: [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/telemetry-scope.cjs

[`apps/web/tests/telemetry-scope.cjs`](../../apps/web/tests/telemetry-scope.cjs)

Проверка/тестовый инструмент. PASS: telemetry keeps logical/media room distinct, renews scoped staff JWT and bounds control requests

Читает/импортирует: [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/telemetry-context.ts`](../../apps/web/lib/telemetry-context.ts).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/telemetry.cjs

[`apps/web/tests/telemetry.cjs`](../../apps/web/tests/telemetry.cjs)

Проверка/тестовый инструмент. PASS: CSV BOM, headings, connection export, formula neutralization, quoted cells; PASS: bitrate/loss deltas, counter resets, history aggregation, gaps, room isolation, session filter, disconnection, 24-hour range

Читает/импортирует: [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STATS_DIR`.

### apps/web/tests/tenant-playback-scope.cjs

[`apps/web/tests/tenant-playback-scope.cjs`](../../apps/web/tests/tenant-playback-scope.cjs)

Проверка/тестовый инструмент. PASS: tenant scope is wired through camera/screen output, rotation, statistics and staff telemetry

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/tenant-scope.cjs

[`apps/web/tests/tenant-scope.cjs`](../../apps/web/tests/tenant-scope.cjs)

Проверка/тестовый инструмент. PASS: tenant scope prevents cross-organization/studio room identity collisions

Читает/импортирует: [`apps/web/lib/tenant-scope.ts`](../../apps/web/lib/tenant-scope.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/topology-merge.cjs

[`apps/web/tests/topology-merge.cjs`](../../apps/web/tests/topology-merge.cjs)

Проверка/тестовый инструмент. PASS: unregistered node rooms appear, stale nodes stay unknown, observations update without mutating registry

Читает/импортирует: [`apps/web/lib/platform-topology.ts`](../../apps/web/lib/platform-topology.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/transfer-owner-session.cjs

[`apps/web/tests/transfer-owner-session.cjs`](../../apps/web/tests/transfer-owner-session.cjs)

Проверка/тестовый инструмент. PASS: local node control mode and verified owner lifetime across hot-swap, including revoked/wrong-scope/expired sessions

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `CASTLINK_SESSION_SECRET`, `STUDIOLINK_DEFAULT_STUDIO_ID`, `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/tests/version-api.cjs

[`apps/web/tests/version-api.cjs`](../../apps/web/tests/version-api.cjs)

Проверка/тестовый инструмент. PASS: version API exposes semantic product version and compatible build identifier

Читает/импортирует: [`apps/web/app/api/version/route.ts`](../../apps/web/app/api/version/route.ts), [`apps/web/package.json`](../../apps/web/package.json), [`package.json`](../../package.json).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_PRODUCT_VERSION`, `NODE_ENV`.

### apps/web/tests/video-quality.cjs

[`apps/web/tests/video-quality.cjs`](../../apps/web/tests/video-quality.cjs)

Проверка/тестовый инструмент. studio video quality caps and sender retries passed

Читает/импортирует: [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/video-rotation-lifecycle.cjs

[`apps/web/tests/video-rotation-lifecycle.cjs`](../../apps/web/tests/video-rotation-lifecycle.cjs)

Проверка/тестовый инструмент. PASS: rotation releases old video/frame listeners in 100 republish cycles and removes room listeners

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/watch-subscriptions.cjs

[`apps/web/tests/watch-subscriptions.cjs`](../../apps/web/tests/watch-subscriptions.cjs)

Проверка/тестовый инструмент. PASS: watch audio/video subscription choices are independent, reattach-safe, and cancel stale audio starts

Читает/импортирует: [`apps/web/lib/watch-subscriptions.ts`](../../apps/web/lib/watch-subscriptions.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/wave1-ui-media.cjs

[`apps/web/tests/wave1-ui-media.cjs`](../../apps/web/tests/wave1-ui-media.cjs)

Проверка/тестовый инструмент. PASS: Wave 1 UI/media regressions stay aligned with CastLink design and monitoring invariants

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/workspace-layout-browser.py

[`apps/web/tests/workspace-layout-browser.py`](../../apps/web/tests/workspace-layout-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

## apps/web/tsconfig.json · 1 файлов

### apps/web/tsconfig.json

[`apps/web/tsconfig.json`](../../apps/web/tsconfig.json)

Параметры проверки TypeScript и разрешения импортов.

## docs · 48 файлов

### docs/AGENT_MODELS_RU.md

[`docs/AGENT_MODELS_RU.md`](../AGENT_MODELS_RU.md)

CastLink: назначения моделей

### docs/AGENT_TEAM_RU.md

[`docs/AGENT_TEAM_RU.md`](../AGENT_TEAM_RU.md)

Постоянная команда CastLink

### docs/ARCHITECTURE_SELF_HOSTED_RU.md

[`docs/ARCHITECTURE_SELF_HOSTED_RU.md`](../ARCHITECTURE_SELF_HOSTED_RU.md)

CastLink: self-hosted open-source model

### docs/BROWSER_RECOVERY_MATRIX_RU.md

[`docs/BROWSER_RECOVERY_MATRIX_RU.md`](../BROWSER_RECOVERY_MATRIX_RU.md)

CastLink 1.0: браузеры, reconnect и recovery

### docs/CLI_SELF_HOSTED_RU.md

[`docs/CLI_SELF_HOSTED_RU.md`](../CLI_SELF_HOSTED_RU.md)

CastLink CLI: developer preview

### docs/CRITICAL_INVARIANTS_RU.md

[`docs/CRITICAL_INVARIANTS_RU.md`](../CRITICAL_INVARIANTS_RU.md)

CastLink: обязательный контекст перед изменениями

### docs/EDITING_AND_ACCESS_RU.md

[`docs/EDITING_AND_ACCESS_RU.md`](../EDITING_AND_ACCESS_RU.md)

VS Code локально + GitHub

### docs/HOME_SETUP_RU.md

[`docs/HOME_SETUP_RU.md`](../HOME_SETUP_RU.md)

Продолжение работы дома: CastLink

### docs/ISSUE_AUDIT_RC2_OPERATIONS_RU.md

[`docs/ISSUE_AUDIT_RC2_OPERATIONS_RU.md`](../ISSUE_AUDIT_RC2_OPERATIONS_RU.md)

Сверка issues и отложенных отметок — 02.10.2026

### docs/LICENSING_AND_SERVER_REGISTRY_RU.md

[`docs/LICENSING_AND_SERVER_REGISTRY_RU.md`](../LICENSING_AND_SERVER_REGISTRY_RU.md)

CastLink 1.0: лицензирование, подписки и реестр серверов

### docs/MANUAL_RU.md

[`docs/MANUAL_RU.md`](../MANUAL_RU.md)

CastLink: руководство с нуля

### docs/MULTITENANT_CLOUD_RU.md

[`docs/MULTITENANT_CLOUD_RU.md`](../MULTITENANT_CLOUD_RU.md)

CastLink Cloud: multi-tenant architecture

### docs/OBSERVABILITY_RU.md

[`docs/OBSERVABILITY_RU.md`](../OBSERVABILITY_RU.md)

CastLink 1.0: observability и health checks

### docs/PERSISTENT_STORAGE_RU.md

[`docs/PERSISTENT_STORAGE_RU.md`](../PERSISTENT_STORAGE_RU.md)

CastLink 1.0: persistent storage, backup и restore

### docs/POSTGRESQL_STORAGE_RU.md

[`docs/POSTGRESQL_STORAGE_RU.md`](../POSTGRESQL_STORAGE_RU.md)

CastLink 1.0: переход persistent storage на PostgreSQL

### docs/PRODUCTION_DEPLOYMENT_RU.md

[`docs/PRODUCTION_DEPLOYMENT_RU.md`](../PRODUCTION_DEPLOYMENT_RU.md)

CastLink 1.0: production install, update и rollback

### docs/PROJECT_GUIDE_RU.md

[`docs/PROJECT_GUIDE_RU.md`](../PROJECT_GUIDE_RU.md)

Как устроен StudioLink

### docs/RC2_OPERATIONS_FEEDBACK_RU.md

[`docs/RC2_OPERATIONS_FEEDBACK_RU.md`](../RC2_OPERATIONS_FEEDBACK_RU.md)

RC-2: мобильная сетка, реальные операции нод и статистика платформы

### docs/RC2_RELEASE_AUDIT_RU.md

[`docs/RC2_RELEASE_AUDIT_RU.md`](../RC2_RELEASE_AUDIT_RU.md)

CastLink RC-2: проверка выпуска перед совместным deploy

### docs/RC_ACCEPTANCE_1_0_RU.md

[`docs/RC_ACCEPTANCE_1_0_RU.md`](../RC_ACCEPTANCE_1_0_RU.md)

CastLink 1.0 RC acceptance checklist

### docs/RELEASE_POLICY_RU.md

[`docs/RELEASE_POLICY_RU.md`](../RELEASE_POLICY_RU.md)

Релизы CastLink

### docs/ROOM_ADMIN_RU.md

[`docs/ROOM_ADMIN_RU.md`](../ROOM_ADMIN_RU.md)

Отдельная админка комнаты

### docs/SECURITY_AUDIT_1_0_RU.md

[`docs/SECURITY_AUDIT_1_0_RU.md`](../SECURITY_AUDIT_1_0_RU.md)

CastLink 1.0 — security audit

### docs/SECURITY_RU.md

[`docs/SECURITY_RU.md`](../SECURITY_RU.md)

Безопасность CastLink и проверка гостевого доступа

### docs/SERVER_FAILOVER_RU.md

[`docs/SERVER_FAILOVER_RU.md`](../SERVER_FAILOVER_RU.md)

Переключение комнаты между VPS и локальным сервером

### docs/STUDIO_INTERFACE_RU.md

[`docs/STUDIO_INTERFACE_RU.md`](../STUDIO_INTERFACE_RU.md)

Студия CastLink: вход, серверы и исходящий поток

### docs/TROUBLESHOOTING_RU.md

[`docs/TROUBLESHOOTING_RU.md`](../TROUBLESHOOTING_RU.md)

Если что-то не работает

### docs/TURN_TLS_RU.md

[`docs/TURN_TLS_RU.md`](../TURN_TLS_RU.md)

CastLink 1.0: TURN / TLS fallback

### docs/UI_EDITING_GUIDE_RU.md

[`docs/UI_EDITING_GUIDE_RU.md`](../UI_EDITING_GUIDE_RU.md)

CastLink: где найти и как править элементы интерфейса

### docs/VERIFIED_RUNBOOK_RU.md

[`docs/VERIFIED_RUNBOOK_RU.md`](../VERIFIED_RUNBOOK_RU.md)

Проверенный runbook CastLink

### docs/av-fixes-20260926.md

[`docs/av-fixes-20260926.md`](../av-fixes-20260926.md)

Обновление студии и гостей — 26 сентября 2026

### docs/features-20260925.md

[`docs/features-20260925.md`](../features-20260925.md)

Мониторинг и статистика — 25 сентября 2026

### docs/guest-access-20260926.md

[`docs/guest-access-20260926.md`](../guest-access-20260926.md)

Гостевой вход и инвайты — 26 сентября 2026

### docs/manual/01_BASICS_RU.md

[`docs/manual/01_BASICS_RU.md`](01_BASICS_RU.md)

01. Основы без программирования

### docs/manual/02_INTERFACES_RU.md

[`docs/manual/02_INTERFACES_RU.md`](02_INTERFACES_RU.md)

02. Интерфейсы и первая рабочая комната

### docs/manual/03_SYSTEMS_RU.md

[`docs/manual/03_SYSTEMS_RU.md`](03_SYSTEMS_RU.md)

03. Системы, модули и связи

### docs/manual/04_DATA_ACCESS_RU.md

[`docs/manual/04_DATA_ACCESS_RU.md`](04_DATA_ACCESS_RU.md)

04. Данные, роли и безопасность

### docs/manual/05_DEVELOPMENT_RU.md

[`docs/manual/05_DEVELOPMENT_RU.md`](05_DEVELOPMENT_RU.md)

05. Первые шаги в коде и безопасная разработка

### docs/manual/06_OPERATIONS_RU.md

[`docs/manual/06_OPERATIONS_RU.md`](06_OPERATIONS_RU.md)

06. Эксплуатация: установка, миграции, обновление и восстановление

### docs/manual/07_ACCEPTANCE_RU.md

[`docs/manual/07_ACCEPTANCE_RU.md`](07_ACCEPTANCE_RU.md)

07. Приёмка исправлений RC-2 и границы проверки

### docs/manual/FILE_MAP_RU.md

[`docs/manual/FILE_MAP_RU.md`](FILE_MAP_RU.md)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/manual/descriptions.json

[`docs/manual/descriptions.json`](descriptions.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/qa/output-media-loopback.json

[`docs/qa/output-media-loopback.json`](../qa/output-media-loopback.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/responsive-layout-v0.9.1.md

[`docs/responsive-layout-v0.9.1.md`](../responsive-layout-v0.9.1.md)

StudioLink 0.9.1 — responsive layout

### docs/superpowers/plans/2026-10-05-self-hosted-cli.md

[`docs/superpowers/plans/2026-10-05-self-hosted-cli.md`](../superpowers/plans/2026-10-05-self-hosted-cli.md)

CastLink Self-hosted CLI Implementation Plan

### docs/superpowers/specs/2026-10-05-home-room-lobby-design.md

[`docs/superpowers/specs/2026-10-05-home-room-lobby-design.md`](../superpowers/specs/2026-10-05-home-room-lobby-design.md)

Главная CastLink: создание и вход в комнату

### docs/superpowers/specs/2026-10-05-self-hosted-cli-design.md

[`docs/superpowers/specs/2026-10-05-self-hosted-cli-design.md`](../superpowers/specs/2026-10-05-self-hosted-cli-design.md)

CastLink CLI: Windows/macOS и два способа установки

### docs/updates-20260926.md

[`docs/updates-20260926.md`](../updates-20260926.md)

Обновление клиентских страниц

## infrastructure · 23 файлов

### infrastructure/control-plane/001_multitenant.sql

[`infrastructure/control-plane/001_multitenant.sql`](../../infrastructure/control-plane/001_multitenant.sql)

SQL-структура/миграция: CastLink multi-tenant control-plane foundation.. Может менять БД.

### infrastructure/control-plane/002_super_admin.sql

[`infrastructure/control-plane/002_super_admin.sql`](../../infrastructure/control-plane/002_super_admin.sql)

SQL-структура/миграция: CastLink platform-level access state for Super Admin sessions.. Может менять БД.

### infrastructure/control-plane/003_node_operational_state.sql

[`infrastructure/control-plane/003_node_operational_state.sql`](../../infrastructure/control-plane/003_node_operational_state.sql)

SQL-структура/миграция: Add explicit emergency node state.. Может менять БД.

### infrastructure/control-plane/004_platform_credentials.sql

[`infrastructure/control-plane/004_platform_credentials.sql`](../../infrastructure/control-plane/004_platform_credentials.sql)

SQL-структура/миграция: Creator/delegated access only. Legacy studio-bootstrapped credentials are not accepted.. Может менять БД.

### infrastructure/control-plane/005_node_operations.sql

[`infrastructure/control-plane/005_node_operations.sql`](../../infrastructure/control-plane/005_node_operations.sql)

SQL-структура/миграция: Desired state and acknowledgement are deliberately separate.. Может менять БД.

### infrastructure/control-plane/control-plane.env.example

[`infrastructure/control-plane/control-plane.env.example`](../../infrastructure/control-plane/control-plane.env.example)

Шаблон переменных окружения. Не реальная конфигурация/секреты установки; значения заполняют вне Git.

### infrastructure/haproxy/haproxy.cfg

[`infrastructure/haproxy/haproxy.cfg`](../../infrastructure/haproxy/haproxy.cfg)

Конфигурация инфраструктуры: haproxy. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/haproxy/haproxy.test.cfg

[`infrastructure/haproxy/haproxy.test.cfg`](../../infrastructure/haproxy/haproxy.test.cfg)

Конфигурация инфраструктуры: haproxy. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/license-service/001_server_registry.sql

[`infrastructure/license-service/001_server_registry.sql`](../../infrastructure/license-service/001_server_registry.sql)

SQL-структура/миграция: CastLink control-plane server registry schema draft.. Может менять БД.

### infrastructure/livekit/docker-compose.yml

[`infrastructure/livekit/docker-compose.yml`](../../infrastructure/livekit/docker-compose.yml)

Описание контейнерных сервисов, сетей, volumes, портов и healthchecks. Не равняется фактически запущенному compose на VPS.

### infrastructure/livekit/turn.example.yaml

[`infrastructure/livekit/turn.example.yaml`](../../infrastructure/livekit/turn.example.yaml)

Конфигурация инфраструктуры: livekit. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/postgres/001_rooms.sql

[`infrastructure/postgres/001_rooms.sql`](../../infrastructure/postgres/001_rooms.sql)

SQL-структура/миграция: CastLink PostgreSQL storage schema, phase 1.. Может менять БД.

### infrastructure/postgres/002_studio_scope.sql

[`infrastructure/postgres/002_studio_scope.sql`](../../infrastructure/postgres/002_studio_scope.sql)

SQL-структура/миграция: Scope node-local rooms by studio while preserving existing single-studio data.. Может менять БД.

### infrastructure/production/docker-compose.media.yml

[`infrastructure/production/docker-compose.media.yml`](../../infrastructure/production/docker-compose.media.yml)

Описание контейнерных сервисов, сетей, volumes, портов и healthchecks. Не равняется фактически запущенному compose на VPS.

### infrastructure/production/docker-compose.yml

[`infrastructure/production/docker-compose.yml`](../../infrastructure/production/docker-compose.yml)

Описание контейнерных сервисов, сетей, volumes, портов и healthchecks. Не равняется фактически запущенному compose на VPS.

### infrastructure/production/livekit.yaml.example

[`infrastructure/production/livekit.yaml.example`](../../infrastructure/production/livekit.yaml.example)

Конфигурация инфраструктуры: production. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/production/postgres.env.example

[`infrastructure/production/postgres.env.example`](../../infrastructure/production/postgres.env.example)

Шаблон переменных окружения. Не реальная конфигурация/секреты установки; значения заполняют вне Git.

### infrastructure/production/rtc-admission.Caddyfile.example

[`infrastructure/production/rtc-admission.Caddyfile.example`](../../infrastructure/production/rtc-admission.Caddyfile.example)

Конфигурация инфраструктуры: production. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/production/systemd/castlink-node-heartbeat.service

[`infrastructure/production/systemd/castlink-node-heartbeat.service`](../../infrastructure/production/systemd/castlink-node-heartbeat.service)

Конфигурация инфраструктуры: production. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/production/systemd/castlink-node-heartbeat.timer

[`infrastructure/production/systemd/castlink-node-heartbeat.timer`](../../infrastructure/production/systemd/castlink-node-heartbeat.timer)

Конфигурация инфраструктуры: production. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/production/web.env.example

[`infrastructure/production/web.env.example`](../../infrastructure/production/web.env.example)

Шаблон переменных окружения. Не реальная конфигурация/секреты установки; значения заполняют вне Git.

### infrastructure/self-hosted/Caddyfile.template

[`infrastructure/self-hosted/Caddyfile.template`](../../infrastructure/self-hosted/Caddyfile.template)

Конфигурация инфраструктуры: self-hosted. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/self-hosted/release.schema.json

[`infrastructure/self-hosted/release.schema.json`](../../infrastructure/self-hosted/release.schema.json)

Конфигурация инфраструктуры: self-hosted. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

## scripts · 22 файлов

### scripts/build-manual-index.mjs

[`scripts/build-manual-index.mjs`](../../scripts/build-manual-index.mjs)

Воспроизводимая карта файлов/импортов/экспортов для этого мануала. Не читает production или Git credentials.

Библиотеки/Node: `node:child_process`, `node:fs`, `node:path`, `node:url`.

### scripts/control-plane-migrate.mjs

[`scripts/control-plane-migrate.mjs`](../../scripts/control-plane-migrate.mjs)

Последовательное применение central control-plane SQL из infrastructure/control-plane.

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`, `node:process`, `pg`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `DATABASE_URL`.

### scripts/control-plane-register-node.mjs

[`scripts/control-plane-register-node.mjs`](../../scripts/control-plane-register-node.mjs)

Регистрация node endpoint, региона и capacity в реестре; не физический запуск сервера.

Библиотеки/Node: `node:module`, `node:process`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_REGISTER_MAX_PARTICIPANTS`, `CASTLINK_REGISTER_MAX_STUDIOS`, `CASTLINK_REGISTER_MAX_VIDEO_TRACKS`, `CASTLINK_REGISTER_NODE_ENDPOINT`, `CASTLINK_REGISTER_NODE_ID`, `CASTLINK_REGISTER_NODE_NAME`, `CASTLINK_REGISTER_NODE_REGION`, `CASTLINK_REGISTER_NODE_TYPE`, `DATABASE_URL`.

### scripts/control-plane-seed-default.mjs

[`scripts/control-plane-seed-default.mjs`](../../scripts/control-plane-seed-default.mjs)

Создание/согласование default organization, Studio, node и room metadata.

Библиотеки/Node: `node:crypto`, `node:module`, `node:process`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DEFAULT_ACCOUNT_ID`, `CASTLINK_DEFAULT_ORGANIZATION_ID`, `CASTLINK_DEFAULT_STUDIO_ID`, `CASTLINK_DEPLOYMENT_MODEL`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_NAME`, `CASTLINK_NODE_REGION`, `DATABASE_URL`, `STUDIOLINK_DEFAULT_STUDIO_ID`, `STUDIOLINK_INSTALLATION_ID`.

### scripts/heartbeat-host-metrics.mjs

[`scripts/heartbeat-host-metrics.mjs`](../../scripts/heartbeat-host-metrics.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `networkOutRate`, `sampleHostNetwork`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:os`, `node:path`.

Используют: [`apps/web/tests/heartbeat-host-metrics.cjs`](../../apps/web/tests/heartbeat-host-metrics.cjs), [`scripts/node-heartbeat.mjs`](../../scripts/node-heartbeat.mjs).

Переменные окружения (только имена): `CASTLINK_HEARTBEAT_COUNTER_FILE`, `CASTLINK_NETWORK_INTERFACE`.

### scripts/install-ubuntu.sh

[`scripts/install-ubuntu.sh`](../../scripts/install-ubuntu.sh)

Начальная установка Linux-окружения и bootstrap-конфигурации; изменяет хост.

### scripts/install-windows.ps1

[`scripts/install-windows.ps1`](../../scripts/install-windows.ps1)

Bootstrap Windows/Docker-установки; не нативный media-клиент.

### scripts/node-heartbeat.mjs

[`scripts/node-heartbeat.mjs`](../../scripts/node-heartbeat.mjs)

Однократный сбор LiveKit/loadavg/memory и подписанная отправка heartbeat.

Читает/импортирует: [`scripts/heartbeat-host-metrics.mjs`](../../scripts/heartbeat-host-metrics.mjs).

Библиотеки/Node: `node:crypto`, `node:module`, `node:os`, `node:process`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_TIMEOUT_MS`, `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_ENFORCE_NODE_ADMISSION`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_REGION`, `CASTLINK_NODE_SECRET`, `CASTLINK_NODE_TYPE`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`, `NODE_ENV`.

### scripts/postgres-backup.sh

[`scripts/postgres-backup.sh`](../../scripts/postgres-backup.sh)

Создание custom pg_dump, проверка pg_restore --list и контрольной суммы.

### scripts/postgres-import-rooms.mjs

[`scripts/postgres-import-rooms.mjs`](../../scripts/postgres-import-rooms.mjs)

Перенос legacy JSON-комнат в PostgreSQL с отдельной проверкой результата.

Библиотеки/Node: `,
});

const client = await pool.connect();
try {
  await client.query(`, `node:fs/promises`, `node:module`, `node:path`, `node:process`, `pg`.

Переменные окружения (только имена): `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `DATABASE_URL`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_DEFAULT_STUDIO_ID`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_ROOMS_FILE`.

### scripts/postgres-migrate.mjs

[`scripts/postgres-migrate.mjs`](../../scripts/postgres-migrate.mjs)

Node-local SQL migrations комнат. Выполнять только в выбранной БД после backup.

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`, `node:process`, `pg`.

Переменные окружения (только имена): `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `DATABASE_URL`.

### scripts/postgres-restore.sh

[`scripts/postgres-restore.sh`](../../scripts/postgres-restore.sh)

Явное восстановление PostgreSQL с подтверждением замены. Потенциально разрушительно.

### scripts/production-preflight.mjs

[`scripts/production-preflight.mjs`](../../scripts/production-preflight.mjs)

Предварительная валидация compose/env/image перед установкой; не выводит значения секретов.

Библиотеки/Node: `node:fs/promises`, `node:path`, `node:process`.

Переменные окружения (только имена): `CASTLINK_WEB_IMAGE`.

### scripts/production-rollback.sh

[`scripts/production-rollback.sh`](../../scripts/production-rollback.sh)

Откат web image из сохранённого manifest; не возврат БД и не гарантия сохранения новой security policy.

### scripts/production-update.sh

[`scripts/production-update.sh`](../../scripts/production-update.sh)

Backup данных и PostgreSQL, замена web, health gate и попытка image rollback; не мигрирует всю БД автоматически.

### scripts/storage-backup.mjs

[`scripts/storage-backup.mjs`](../../scripts/storage-backup.mjs)

Backup постоянных файлов и manifest с привязкой к installation identity.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### scripts/storage-restore.mjs

[`scripts/storage-restore.mjs`](../../scripts/storage-restore.mjs)

Контролируемое восстановление файлов постоянных данных; отдельно от image rollback.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### scripts/super-admin-owner.mjs

[`scripts/super-admin-owner.mjs`](../../scripts/super-admin-owner.mjs)

Первая/восстановительная ссылка владельца сервиса. Меняет PG access; пишет bearer только в приватный новый файл.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:module`, `node:path`, `node:util`, `pg`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `DATABASE_URL`.

### scripts/support-bundle.mjs

[`scripts/support-bundle.mjs`](../../scripts/support-bundle.mjs)

Ограниченный диагностический JSON и TCP/TLS-пробы без полного env/dump.

Библиотеки/Node: `node:fs/promises`, `node:net`, `node:os`, `node:path`, `node:process`, `node:tls`.

Переменные окружения (только имена): `CASTLINK_STORAGE_BACKEND`, `CASTLINK_SUPPORT_TIMEOUT_MS`, `CASTLINK_TURN_HEALTH_HOST`, `CASTLINK_TURN_TLS_PORT`, `LIVEKIT_SERVER_URL`, `STUDIOLINK_STATS_MAX_BYTES`.

### scripts/turn-preflight.mjs

[`scripts/turn-preflight.mjs`](../../scripts/turn-preflight.mjs)

Предварительные проверки TURN-схемы.

Библиотеки/Node: `node:dns/promises`, `node:tls`.

### scripts/turn-stage2-deploy.sh

[`scripts/turn-stage2-deploy.sh`](../../scripts/turn-stage2-deploy.sh)

Установка TURN stage 2; может затронуть сетевой ingress и активные подключения.

### scripts/turn-stage2-preflight.mjs

[`scripts/turn-stage2-preflight.mjs`](../../scripts/turn-stage2-preflight.mjs)

Предварительная проверка TURN/TLS/SNI stage 2.

Библиотеки/Node: `node:dns/promises`, `node:https`, `node:tls`.
