# Документация CastLink

## Установка и работа

| Задача | Документ |
| --- | --- |
| Выбрать продукт и проверить контрольные суммы | [Пакеты](../distribution/PRODUCTS.md) |
| Установить клиент или сервер | [Установка](../distribution/INSTALL.md) |
| Установить и обновить standalone Linux | [Linux manual](../distribution/LINUX_MANUAL.md) |
| Работать в комнатах и студии | [Руководство пользователя](../distribution/README.md), [интерфейсы](manual/02_INTERFACES_RU.md) |
| Настроить роли и постоянные выходы | [Роли и слоты](SERVER_ROLES_AND_SLOTS_RU.md) |
| Передать управление ПК | [Русский](REMOTE_PC_CONTROL_RU.md) · [English](en/REMOTE_PC_CONTROL.md) · [简体中文](zh-CN/REMOTE_PC_CONTROL.md) |
| Разобрать ошибку подключения | [Устранение неполадок](TROUBLESHOOTING_RU.md) |

У Windows Client, Server Setup и Linux независимые выпуски. Инструкции внутри архива относятся к его версии; действующие дополнения публикуются в [castlink-releases](https://github.com/resokol/castlink-releases). Сверяйте номер пакета и `/api/version` своей установки.

## Разработка

- [Учебный мануал](MANUAL_RU.md): основы, интерфейсы, подсистемы, данные, разработка, эксплуатация и проверка.
- [Карта архитектуры](PROJECT_GUIDE_RU.md), [self-hosted модель](ARCHITECTURE_SELF_HOSTED_RU.md), [технические инварианты](CRITICAL_INVARIANTS_RU.md).
- [Работа с исходниками](EDITING_AND_ACCESS_RU.md), [карта файлов](manual/FILE_MAP_RU.md), [проверка изменений](manual/07_ACCEPTANCE_RU.md).
- [Дизайн-система](../DESIGN.md), [где править UI](UI_EDITING_GUIDE_RU.md), [эталон входа](design/ENTRY_DESIGN_20261020_RU.md).
- [Камеры](GUEST_CAMERA_CAPTURE_RU.md), [качество видео](STUDIO_VIDEO_QUALITY_RU.md), [восстановление браузера](BROWSER_RECOVERY_MATRIX_RU.md).
- [Исследовательский CLI](CLI_SELF_HOSTED_RU.md), [его упаковка](CLI_PACKAGING_RU.md), [runtime web-образа](WEB_RUNTIME_DISTRIBUTION_RU.md).

CLI и прототипы runtime имеют собственные ограничения; наличие исходников не означает, что функция входит во все готовые пакеты.

## Данные, безопасность и эксплуатация

- [Безопасность](SECURITY_RU.md), [данные и доступ](manual/04_DATA_ACCESS_RU.md).
- [Постоянное хранилище](PERSISTENT_STORAGE_RU.md), [PostgreSQL](POSTGRESQL_STORAGE_RU.md), [multi-tenant control plane](MULTITENANT_CLOUD_RU.md).
- [Развёртывание и обновление](PRODUCTION_DEPLOYMENT_RU.md), [эксплуатация](manual/06_OPERATIONS_RU.md).
- [Резервные серверы](SERVER_RESERVE_RU.md), [наблюдаемость](OBSERVABILITY_RU.md), [TURN/TLS](TURN_TLS_RU.md), [TURN в Easy Setup](TURN_TLS_EASY_SETUP_RU.md).
- [Версии и сборки](RELEASE_POLICY_RU.md), [политика готовых выпусков](../distribution/RELEASE_POLICY.md).

Примеры описывают настройку собственной установки. Они не содержат действующих учётных данных и не подтверждают состояние какого-либо работающего сервера. Локальные конфигурации, данные пользователей и рабочие записи сопровождения не входят в исходники.
