# CastLink

CastLink — WebRTC-платформа для студий, удалённых гостей и broadcast workflows на Next.js, LiveKit и PostgreSQL.
Текущая release candidate: **1.0.0-rc.1**.

## Архитектура 1.0

CastLink разделяет control plane и media path:

```text
Browser / Studio
  |-- HTTPS/API --> Next.js --> PostgreSQL / control plane
  |
  '-- WebRTC ----------------> LiveKit / TURN
```

PostgreSQL не находится в тракте аудио/видео. Media latency определяется WebRTC/LiveKit/TURN и сетью, а не SQL-запросами.

RC-1 включает multi-tenant модель Account → Organization → Studio → Room, PostgreSQL persistent storage,
node scheduler + signed heartbeat, tenant-aware failover, scoped owner/admin/moderator access,
observability/diagnostics, production update/rollback и refactored Studio UI.

## С чего начать

1. [Актуальный гайд по архитектуре и коду 1.0.0-rc.1](docs/PROJECT_GUIDE_RU.md)
2. [PostgreSQL storage и миграция](docs/POSTGRESQL_STORAGE_RU.md)
3. [Multi-tenant Cloud, nodes и scheduler](docs/MULTITENANT_CLOUD_RU.md)
4. [Production install, update и rollback](docs/PRODUCTION_DEPLOYMENT_RU.md)
5. [RC acceptance checklist](docs/RC_ACCEPTANCE_1_0_RU.md)
6. [Security audit 1.0](docs/SECURITY_AUDIT_1_0_RU.md)

## Операционная документация

- [Observability, health и diagnostics](docs/OBSERVABILITY_RU.md)
- [TURN / TLS fallback](docs/TURN_TLS_RU.md)
- [Browser / reconnect / recovery matrix](docs/BROWSER_RECOVERY_MATRIX_RU.md)
- [Persistent storage, backup и restore](docs/PERSISTENT_STORAGE_RU.md)
- [Лицензирование и server registry](docs/LICENSING_AND_SERVER_REGISTRY_RU.md)
- [Правила версий и релизов](docs/RELEASE_POLICY_RU.md)
- [Troubleshooting](docs/TROUBLESHOOTING_RU.md)
- [Работа из VS Code](docs/EDITING_AND_ACCESS_RU.md)
- [Продолжить работу на домашнем компьютере](docs/HOME_SETUP_RU.md)

## Репозиторий

Основное web-приложение: `apps/web`.
Production infrastructure: `infrastructure/production`.
SQL migrations: `infrastructure/postgres` и `infrastructure/control-plane`.
Операционные scripts: `scripts`.

Нативные Linux/Windows приложения пока не являются основным production-клиентом.

## Release model

Product version хранится в корневом `package.json`.
Production build дополнительно имеет immutable `buildId` вида `<version>-<git-sha>`.
`/api/version` используется для проверки реально запущенной сборки.

Production должен обновляться release image/tag/digest через guarded preflight/update/rollback workflow.
Git checkout на сервере сам по себе не определяет реально запущенную версию контейнера.

## Разработка

Откройте `studiolink.code-workspace` в VS Code.
Перед изменениями используйте актуальный project guide и профильный документ функции.
После изменения обязательны TypeScript и соответствующие regression tests; release candidate проверяется полным CI и RC acceptance.

Не редактируйте production container вручную и не выполняйте deploy/restart во время активного эфира или soak-теста без отдельного решения оператора.
