# CastLink

CastLink — WebRTC-платформа для студий, удалённых гостей и broadcast workflows на Next.js, LiveKit и PostgreSQL.
Активная release-линия: **1.0.0-rc.2**. Код и документация этой линии находятся в ветке [`release/1.0.0-rc.2`](https://github.com/resokol/studiolink/tree/release/1.0.0-rc.2). Наличие изменений в GitHub не означает, что они уже установлены на публичном сервере: проверяйте `/api/version`.

## Новый мануал: с нуля, без знаний программирования

**Начать здесь: [руководство CastLink для новичков](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/MANUAL_RU.md).**

Семь глав: основы и словарь, все интерфейсы, системы и связи, PostgreSQL и права доступа, первая работа с кодом, эксплуатация/миграции/backup, результаты проверки и ограничения.

[Полный каталог файлов и зависимостей](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/manual/FILE_MAP_RU.md) содержит отдельную запись для каждого файла текущей release-ветки: назначение, экспортируемые символы, прямые импорты, обратные зависимости и имена переменных окружения без секретов.

[Проверенные команды и процедуры](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/VERIFIED_RUNBOOK_RU.md) · [Статус приёмки](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/manual/07_ACCEPTANCE_RU.md)

## Архитектура 1.0

```text
Browser / Studio
  |-- HTTPS/API --> Next.js --> PostgreSQL / control plane
  |
  '-- WebRTC ----------------> LiveKit / TURN
```

PostgreSQL хранит данные управления, а не передаёт каждый аудио-/видеопакет. Control plane и media path разделены; при этом общая нагрузка на CPU, память и сеть требует отдельного контроля.

Основные системы: multi-tenant Organization → Studio → Room, постоянное хранилище комнат, node scheduler и signed heartbeat, scoped owner/admin/moderator access, отдельная платформа Super Admin, diagnostics, статистика, production update/rollback.

**Super Admin в новых исправлениях не получается через создание Studio или её пароль.** Первый доступ выдаёт владелец сервера отдельной CLI, дальнейшие доступы — одноразовыми приглашениями. Обязательны миграция 004 и проверка новой границы доступа до включения runtime. Подробности и ограничения: [данные и безопасность](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/manual/04_DATA_ACCESS_RU.md).

## Операционная документация

- [Production install, update и rollback](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/PRODUCTION_DEPLOYMENT_RU.md)
- [PostgreSQL storage и миграция](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/POSTGRESQL_STORAGE_RU.md)
- [Multi-tenant Cloud и scheduler](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/MULTITENANT_CLOUD_RU.md)
- [Observability и health](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/OBSERVABILITY_RU.md)
- [TURN/TLS](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/TURN_TLS_RU.md)
- [Релизы и версии](https://github.com/resokol/studiolink/blob/release/1.0.0-rc.2/docs/RELEASE_POLICY_RU.md)

Датированные старые документы сохраняются как история. При расхождении с новым мануалом сначала проверяйте текущий исходник, тесты и реально запущенный build ID.

## Репозиторий и разработка

Web-приложение — `apps/web`; production-конфигурация — `infrastructure/production`; SQL — `infrastructure/postgres` и `infrastructure/control-plane`; операторские инструменты — `scripts`. Нативные Linux/Windows приложения пока являются отдельными заготовками, а не основным production-клиентом.

Откройте `studiolink.code-workspace` в VS Code. Перед работой читайте `AGENTS.md`, критические инварианты и проверенный runbook. Для независимой задачи используйте отдельный worktree. После изменения нужны TypeScript, профильные тесты и build; для медиа — также реальная браузерная/устройственная приёмка.

Не редактируйте production container вручную, не выводите `.env` и токены в GitHub и не выполняйте deploy/restart во время эфира без согласования с оператором. Откат image не является восстановлением БД и может вернуть старые правила безопасности.
