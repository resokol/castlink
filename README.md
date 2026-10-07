# CastLink

CastLink — веб-студия и гостевые комнаты на Next.js, LiveKit и PostgreSQL.

## Скачать и установить

- [Windows: CastLink-Windows.zip](https://github.com/resokol/studiolink/releases/latest/download/CastLink-Windows.zip) — распакуй архив и запусти **EasySetup.exe**. Графический мастер устанавливает, обновляет и удаляет сервер. Консольный вариант — `EasySetup-Console.cmd`.
- [Linux: CastLink-Linux.tar.gz](https://github.com/resokol/studiolink/releases/latest/download/CastLink-Linux.tar.gz) — серверный пакет для внешнего Linux VPS, который мастер Windows переносит по SSH. Это не отдельный Linux GUI-установщик.
- [Последний выпуск](https://github.com/resokol/studiolink/releases/latest) · [SHA256SUMS](https://github.com/resokol/studiolink/releases/latest/download/SHA256SUMS).

Мастер запускается на Windows 10/11. Локальный сервер использует Docker Desktop; отсутствующие зависимости мастер предлагает установить. Поддерживаются LAN, публичный IPv4 и localhost. Для доступа по LAN с камерой/микрофоном потребуется доверие собственному сертификату; мастер создаёт переносимый набор для других устройств.

Внешний сервер — Ubuntu 22.04/24.04 amd64 по SSH с правами root. Домен необязателен: можно начать с публичного IPv4. Сетевые порты, HTTPS, сохранение данных и удаление описаны в [руководстве Easy Setup](https://github.com/resokol/studiolink/blob/feat/self-hosted-cli-github/docs/EASY_SETUP_WINDOWS_RU.md).

На главной странице текущего установочного выпуска можно создать свою комнату или войти в существующую. Пароль студии сохраняет доступ создателя к своей комнате; гостевой пароль не даёт прав студии. Отдельная ссылка Super Admin для этого сценария не нужна.

EXE пока не подписан. Подробные результаты проверок и ограничения приведены в руководстве; наличие пакета не означает проверку всех физических Windows 10/11 и всех вариантов VPS.

## Исходники и версия

Текущая линия установочных пакетов — **1.0.0-rc.2**. Конкретный выпуск определяется Git commit и `/api/version`. Обновление работающего сервера запускается мастером с выбранной прежней установкой; публикация в GitHub сама сервер не обновляет.

Исходники текущего мастера и его исправлений находятся в [feat/self-hosted-cli-github](https://github.com/resokol/studiolink/tree/feat/self-hosted-cli-github), изменения рассматриваются в [PR №56](https://github.com/resokol/studiolink/pull/56). Ветка `main` пока содержит прежний код и метаданные версии 0.9.2. Эта правка лицензии и страницы репозитория не переносит в `main` код приложения из PR.

- [Мануал и каталог исходников текущей ветки](https://github.com/resokol/studiolink/blob/feat/self-hosted-cli-github/docs/MANUAL_RU.md)
- [Проверенные процедуры](https://github.com/resokol/studiolink/blob/feat/self-hosted-cli-github/docs/VERIFIED_RUNBOOK_RU.md)
- [Правила работы с проектом](AGENTS.md)

Личные `.codex/` и `.agents/` настройки исключены из Git и не требуются для установки. История чатов, авторизация и секреты не должны публиковаться. Ранее опубликованные файлы остаются в истории Git; этот коммит её не переписывает.

## Лицензия

Код CastLink распространяется по [MIT](LICENSE): разрешены изменения, коммерческое использование и закрытые производные версии с сохранением уведомления об авторских правах и текста лицензии. Зависимости и включённые сторонние компоненты сохраняют собственные лицензии и условия использования.
