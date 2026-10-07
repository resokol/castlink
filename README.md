# CastLink

CastLink — веб-студия и гостевые комнаты на Next.js, LiveKit и PostgreSQL. На главной странице можно создать свою комнату или войти в существующую. Исходники приложения: [`apps/web`](apps/web).

## Установить CastLink

- [Windows: CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip) — распакуй архив и запусти **EasySetup.exe**. Графический мастер устанавливает, обновляет и удаляет сервер локально или на внешнем Linux VPS. Консольный вариант — `EasySetup-Console.cmd`.
- [Linux: CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz) — серверный пакет, который мастер Windows переносит на выбранный VPS; это не отдельный Linux GUI-установщик.
- [Последний выпуск](https://github.com/resokol/castlink-releases/releases/latest) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/latest/download/SHA256SUMS) · [Подробные шаги и ограничения](docs/EASY_SETUP_WINDOWS_RU.md).

Мастер Windows рассчитан на Windows 10/11 и Docker Desktop; отсутствующие зависимости предлагает установить. Внешний сервер — Ubuntu 22.04/24.04 amd64 по SSH, с правами root; домен необязателен. Запуск локально поддерживает LAN, публичный IPv4 и localhost. Для камеры/микрофона по LAN потребуется доверие собственному сертификату, мастер создаёт переносимый набор для других устройств. Сетевые порты и условия HTTPS описаны в руководстве.

Текущая линия пакетов — **1.0.0-rc.2**; конкретный выпуск определяется Git commit и `/api/version`. Пакет не обновляет уже работающий сервер сам: обновление запускается мастером с выбранной прежней установкой. EXE пока не подписан; физические Windows 10 и все варианты VPS не заявлены как проверенные.

## Лицензия

Код CastLink распространяется по [MIT](LICENSE): разрешены изменения, коммерческое использование и закрытые производные версии с сохранением уведомления об авторских правах и текста лицензии. Зависимости и включённые сторонние компоненты сохраняют собственные лицензии и условия использования.

## Руководство на русском

**С нуля, без знаний программирования:** [полный учебный мануал CastLink](docs/MANUAL_RU.md) — основы, все интерфейсы, системы, БД и права, разработка, эксплуатация и каталог файлов со связями.

[Проверенные команды и процедуры](docs/VERIFIED_RUNBOOK_RU.md).

**Для ручных правок интерфейса:** [карта кнопок, блоков, подписей и CSS с примерами](docs/UI_EDITING_GUIDE_RU.md).

1. [Как устроен проект и где менять функции и дизайн](docs/PROJECT_GUIDE_RU.md)
2. [VS Code, GitHub и порядок ручной работы](docs/EDITING_AND_ACCESS_RU.md)
3. [Если что-то не работает: команды, нормальный вывод, действия](docs/TROUBLESHOOTING_RU.md)
4. [Правила работы с проектом](AGENTS.md) и [роли помощников](docs/AGENT_MODELS_RU.md)

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
