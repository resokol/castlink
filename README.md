# CastLink

CastLink — студия для удалённого подключения кастеров, презентаций и передачи отдельных аудио- и видеопотоков в OBS/vMix. Студия и кастеры работают в браузере; для Windows доступен отдельный клиент. Этот закрытый репозиторий содержит исходники, сборку и документацию разработки.

## Скачать и установить

Текущий опубликованный выпуск — **1.0.0-rc.8**, сборка **1.0.0-rc.8-bdfe91a92b6b**. [Сайт CastLink](https://castlink.ru) · [Выбор пакета и контрольные суммы](https://github.com/resokol/castlink-releases/blob/main/PRODUCTS.md).

| Продукт | Установка |
| --- | --- |
| [Windows Client](https://github.com/resokol/castlink-releases/releases/tag/client-v1.0.0-rc.8-bdfe91a92b6b) | Приложение кастера; запустите setup.exe и выберите папку. Docker не нужен. |
| [Windows Server Setup](https://github.com/resokol/castlink-releases/releases/tag/server-setup-v1.0.0-rc.8-bdfe91a92b6b) | Распакуйте весь CastLink-Windows.zip и запустите EasySetup.exe. Мастер устанавливает сервер на Windows или на Linux Ubuntu по SSH. |
| [Linux Ubuntu](https://github.com/resokol/castlink-releases/releases/tag/linux-v1.0.0-rc.8-bdfe91a92b6b) | Самостоятельная установка: [единый мануал](distribution/LINUX_MANUAL.md), режимы «из коробки» и «расширенный». |

[Инструкция установки RU / EN / 简体中文](distribution/INSTALL.md). Для сервера доступны быстрый и расширенный режимы, HTTPS и внешний прокси. Windows-серверу нужен Docker Desktop с Linux-контейнерами; VPS — Ubuntu 22.04/24.04 amd64 и доступ root по SSH. Точные требования и сетевые порты приведены в инструкции.

Клиент, серверный мастер и Linux имеют независимые выпуски: общий GitHub latest не определяет их версии. Пакет и SHA256SUMS берите из одного выпуска одного продукта. Клиент обновляется вручную новым setup.exe; сервер — через «Обновить» с выбором прежней установки после резервного копирования. Публикация исходников не обновляет установленный сервер. EXE пока не подписан; перед эфиром проверьте устройства, сеть и полноэкранную презентацию в своей среде.

## Разработка и эксплуатация

- [Текущее состояние и подтверждённые проверки](docs/WORKING_STATE_RU.md).
- [Полный учебный мануал](docs/MANUAL_RU.md), [карта проекта](docs/PROJECT_GUIDE_RU.md), [правки интерфейса](docs/UI_EDITING_GUIDE_RU.md).
- [Проверенные команды](docs/VERIFIED_RUNBOOK_RU.md), [диагностика](docs/TROUBLESHOOTING_RU.md).
- [Установка, обновление и откат production](docs/PRODUCTION_DEPLOYMENT_RU.md), [данные и резервные копии](docs/PERSISTENT_STORAGE_RU.md).
- [Версии и релизы](docs/RELEASE_POLICY_RU.md), [история изменений](CHANGELOG.md).
- [Правила проекта](AGENTS.md), [обязательные инварианты](docs/CRITICAL_INVARIANTS_RU.md), [передача работы](docs/AGENT_TEAM_RU.md).

Исходники приложения: [apps/web](apps/web); Windows-клиент: [apps/desktop](apps/desktop). Менеджер пакетов — pnpm 9.15.0, зафиксированный в package.json. Откройте studiolink.code-workspace в VS Code; команды разработки и проверок описаны в руководствах выше. Локальные секреты, данные, сборки и резервные копии не публикуются.

## Лицензия

Новые выпуски бесплатны для личного и коммерческого использования на условиях [CastLink Freeware Distribution License](LICENSE). Разрешено распространять неизменённые официальные пакеты с лицензией, уведомлениями и указанием автора: [Telegram @sklvmax](https://t.me/sklvmax), [GitHub resokol](https://github.com/resokol). Изменение программы и распространение изменённых версий требуют предварительного письменного разрешения автора. Это не open-source лицензия.

Ранее опубликованные выпуски под MIT сохраняют предоставленные права. Условия конкретного выпуска определяются вложенной лицензией. Сторонние компоненты сохраняют собственные лицензии и права на получение исходников: [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).
