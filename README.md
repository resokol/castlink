# CastLink

Веб-студия и гостевые комнаты на Next.js и LiveKit. Исходники веб-приложения: [`apps/web`](apps/web). Нативные приложения Linux/Windows пока являются заготовками.

## Руководство на русском

**С нуля, без знаний программирования:** [полный учебный мануал CastLink](docs/MANUAL_RU.md) — основы, все интерфейсы, системы, БД и права, разработка, эксплуатация и каталог файлов со связями.

[Проверенные команды и процедуры](docs/VERIFIED_RUNBOOK_RU.md).

**Для ручных правок интерфейса:** [карта кнопок, блоков, подписей и CSS с примерами](docs/UI_EDITING_GUIDE_RU.md).

1. [Как устроен проект и где менять функции и дизайн](docs/PROJECT_GUIDE_RU.md)
2. [VS Code, GitHub и порядок ручной работы](docs/EDITING_AND_ACCESS_RU.md)
3. [Если что-то не работает: команды, нормальный вывод, действия](docs/TROUBLESHOOTING_RU.md)
4. [Роли Codex и делегирование задач](.codex/agents/)

Откройте `studiolink.code-workspace` в VS Code. Через **Терминал → Запустить задачу** доступны проверка TypeScript, локальная разработка, сборка и запуск сборки.

Новый мануал описывает текущий RC-2 и исправления этой ветки; старые датированные документы сохраняются как история. Результаты проверки и оставшиеся ограничения указаны в `docs/manual/07_ACCEPTANCE_RU.md`. Семантическая версия продукта хранится только в корневом `package.json`; `/api/version` отдельно сообщает `productVersion` и идентификатор конкретной сборки `buildId`. Изменения на GitHub сами по себе не обновляют VPS.

- [Правила версий и релизов](docs/RELEASE_POLICY_RU.md)
- [Persistent storage, backup и restore](docs/PERSISTENT_STORAGE_RU.md)
- [Production install, update и rollback](docs/PRODUCTION_DEPLOYMENT_RU.md)
- [Лицензирование, подписки и реестр серверов](docs/LICENSING_AND_SERVER_REGISTRY_RU.md)
- [Multi-tenant CastLink Cloud и Node Scheduler](docs/MULTITENANT_CLOUD_RU.md)
- [Observability и health checks](docs/OBSERVABILITY_RU.md)
- [TURN / TLS fallback](docs/TURN_TLS_RU.md)
- [Browser / reconnect / recovery matrix](docs/BROWSER_RECOVERY_MATRIX_RU.md)
- [История изменений](CHANGELOG.md)
- [Продолжить работу на домашнем компьютере](docs/HOME_SETUP_RU.md)
