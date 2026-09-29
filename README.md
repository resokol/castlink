# StudioLink

Веб-студия и гостевые комнаты на Next.js и LiveKit. Исходники веб-приложения: [`apps/web`](apps/web). Нативные приложения Linux/Windows пока являются заготовками.

## Руководство на русском

**Для ручных правок интерфейса:** [карта кнопок, блоков, подписей и CSS с примерами](docs/UI_EDITING_GUIDE_RU.md).

1. [Как устроен проект и где менять функции и дизайн](docs/PROJECT_GUIDE_RU.md)
2. [VS Code, GitHub и порядок ручной работы](docs/EDITING_AND_ACCESS_RU.md)
3. [Если что-то не работает: команды, нормальный вывод, действия](docs/TROUBLESHOOTING_RU.md)
4. [Роли Codex и делегирование задач](.codex/agents/)

Откройте `studiolink.code-workspace` в VS Code. Через **Терминал → Запустить задачу** доступны проверка TypeScript, локальная разработка, сборка и запуск сборки.

Документация описывает состояние ветки 0.9 перед подготовкой CastLink 1.0. Семантическая версия продукта хранится только в корневом `package.json`; `/api/version` отдельно сообщает `productVersion` и идентификатор конкретной сборки `buildId`. Изменения на GitHub сами по себе не обновляют VPS.

- [Правила версий и релизов](docs/RELEASE_POLICY_RU.md)
- [Persistent storage, backup и restore](docs/PERSISTENT_STORAGE_RU.md)
- [TURN / TLS fallback](docs/TURN_TLS_RU.md)
- [История изменений](CHANGELOG.md)
- [Продолжить работу на домашнем компьютере](docs/HOME_SETUP_RU.md)
