[Русский](PRODUCTS.md) · [English](docs/en/PRODUCTS.md) · [简体中文](docs/zh-CN/PRODUCTS.md)

# Пакеты CastLink

| CastLink | Назначение | Загрузить |
| --- | --- | --- |
| Windows Client | Приложение Windows: студия и кастер | [1.0.0-rc.9](https://github.com/resokol/castlink/releases/download/client-v1.0.0-rc.9-a994895c5fa9/CastLink-Client-1.0.0-rc.9-a994895c5fa9-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.0-rc.9-a994895c5fa9/SHA256SUMS) |
| macOS Client — проверочная сборка | Нативные Apple Silicon arm64 и Intel x64; автоматические Mac-проверки пройдены, ручная приёмка не завершена | [arm64 candidate](https://github.com/resokol/castlink/actions/runs/41531376176/artifacts/13181718891) · [Intel x64 candidate](https://github.com/resokol/castlink/actions/runs/41531376176/artifacts/13182023701) · [матрица и SHA256](../docs/testing/MACOS_CLIENT_MATRIX_RU.md); macOS release не опубликован |
| Windows Server | Мастер Windows: свой сервер локально или на Linux Ubuntu по SSH | [1.0.0-rc.9](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.9-7ff7880b402f/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.9-7ff7880b402f/SHA256SUMS) |
| Linux Ubuntu | Самостоятельная установка сервера на Linux Ubuntu | [1.0.0-rc.9](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.9-7ff7880b402f/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.9-7ff7880b402f/SHA256SUMS) |

**[Мануал по установке](LINUX_MANUAL.md)** — Из коробки и расширенный режим.

Перед запуском проверьте SHA256SUMS выбранного выпуска. EXE не подписаны. Новый Client предлагает проверенное обновление, но установка требует отдельного согласия; старый Client замените вручную. Серверные службы обновляются после вашего действия и могут прервать эфир. Данные резервируйте самостоятельно; три направления выпускаются независимо.

Server Setup build: `1.0.0-rc.9-7ff7880b402f` · source: `7ff7880b402fb83db02301678cab52c29912fbe0`

Linux build: `1.0.0-rc.9-7ff7880b402f` · source: `7ff7880b402fb83db02301678cab52c29912fbe0`

Client build: `1.0.0-rc.9-a994895c5fa9` · source: `a994895c5fa976a073965f845ba23a4f61f94387`

**Обновление с rc.8:** старый Client может не найти новый выпуск после переименования репозитория. Один раз скачайте установщик rc.9 вручную по ссылке выше и проверьте SHA256SUMS. Для собственного сервера отдельно обновите Server Setup или Linux. [Что нового и порядок обновления](RELEASE_NOTES_RC9.md).

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-rc.9-a994895c5fa9) · [Server Setup release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.0-rc.9-7ff7880b402f) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.0-rc.9-7ff7880b402f)

## macOS: текущая ветка и проверочные сборки

Исходники переноса доступны в публичной ветке `feat/macos-client`. Проверенный
интегрированный source — `4439fa87d3a459823ee853af040c551878cb6834`.
[Mac run 41531376176](https://github.com/resokol/castlink/actions/runs/41531376176) — **SUCCESS**:
нативные [arm64 job 125572190990](https://github.com/resokol/castlink/actions/runs/41531376176/job/125572190990),
[Intel x64 job 125572191488](https://github.com/resokol/castlink/actions/runs/41531376176/job/125572191488)
и [итоговый guard 125577480530](https://github.com/resokol/castlink/actions/runs/41531376176/job/125577480530)
прошли обязательные автоматические native, package и DMG-проверки.
[Общий PR CI 41531384481](https://github.com/resokol/castlink/actions/runs/41531384481)
— **SUCCESS**: общие проверки исходников и серверных интеграций пройдены.
В feature интегрирован публичный main `48478006e4348f1e185fb8066ee6233481a8a6a2`.
QA-fixtures проверяют готовность input/Preview; workflow устанавливает актуальный
официальный stable Chrome и проверяет подпись, bundle ID, нативную архитектуру
и путь. Production helpers и их guards сохранены. Четыре Actions artifacts
с candidate и native evidence доступны до 2026-11-16; точные имена и SHA256 —
в матрице ниже. Это ad-hoc development candidate без notarization;
macOS release не опубликован.

Реализованы изоляция звука выбранного приложения, управление PowerPoint/PDF,
remote input, регистрация четырёх URI через пятый AppKit helper, мастер
локального/SSH сервера и принятие совместимого Windows RC9 VPS. Клиент и
встроенный setup используют канонический публичный `resokol/castlink` для
обновлений; база переноса — опубликованный Client RC9. Проверки охватывают реальные audio/input/PDF
fixtures и запуск установленной копии приложения из DMG. Текущие результаты и границы
доказательств — в [матрице macOS](../docs/testing/MACOS_CLIENT_MATRIX_RU.md).
Office, физические TCC/микрофон/ввод, несколько дисплеев, настоящий Docker/VPS,
Developer ID/notarization и полный паритет ещё не подтверждены. Навигация PDF в
браузере требует перемещения прежнего маркера после трёх стабильных исходных
снимков и одной команды; появление новых AX-маркеров не считается движением.
Совместимость с заявленным deployment target macOS 13.0 не подтверждена.
Фактический запуск проверен на macOS 26.6.2 arm64 и macOS 15.7.9 Intel x64.

Сборка требует чистого закоммиченного checkout, Node.js 22, pnpm 9.15.0 и Xcode
Command Line Tools. После `pnpm install --frozen-lockfile` выполните на нативном
Mac нужной архитектуры:

```sh
node scripts/macos-client-preflight.mjs arm64
node apps/desktop/scripts/package-macos.cjs --arch arm64
```

Для Intel используйте `x64` в обеих командах. Выходной каталог:
`artifacts/desktop/<source-sha12>/mac-<arch>/`; в нём app, DMG, ZIP,
`manifest.json` и `SHA256SUMS`. Проверочный DMG содержит
`CastLink Client Development.app`: скопируйте приложение в Applications для
ручного запуска. Основное меню macOS содержит смену сервера, обновления и
инструкции по разрешениям; launcher — подключение студии/гостя и мастер сервера.
Приглашения используют `castlink:`, презентации — `castlink-presenter:`,
локальная демонстрация/управление — `castlink-remote:` и `castlink-share:`.
После готовности launcher продукт асинхронно выбирает точный URL своего app
для четырёх URI через `CastLink.ProtocolRegistration`; отказ показывает
локализованную подсказку и не блокирует launcher. Smoke только наблюдает
естественный выбор app и требует результат продукта `REGISTERED`; QA не
назначает handler. Для трёх helper-схем проверяются bootstrap через argv и ожидаемый отказ авторизации (401) на локальном
тестовом TLS-сервере. Доставка через системный openURL, успешное подключение к
комнате и физический TCC требуют приёмки. DMG smoke устанавливает приложение в
принадлежащую тесту папку `~/Applications/CastLink-QA-*`, отключает образ и
запускает установленную копию с отдельным профилем. Это не подтверждает обновление
прежней установки или сохранение пользовательских данных.

По умолчанию, при `CASTLINK_MAC_DISTRIBUTION=0` или без этой переменной,
имя архива —
`CastLink-Client-<version>-<source-sha12>-mac-<arch>-development.dmg` / `.zip`.
Это ad-hoc development candidate без notarization; обновлятор не принимает
такое имя за обычный выпуск.

Необязательный `CASTLINK_MAC_DISTRIBUTION=1` включает строгую сборку для
распространения. Для Developer ID Application нужны `CSC_LINK` и
`CSC_KEY_PASSWORD` либо `CSC_NAME` и `CSC_KEYCHAIN`. При
`CSC_IDENTITY_AUTO_DISCOVERY=false` также обязателен `CSC_NAME`.
Для notarization нужен ровно один набор: `APPLE_ID` +
`APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`; либо `APPLE_API_KEY` +
`APPLE_API_KEY_ID` + `APPLE_API_ISSUER`; либо `APPLE_KEYCHAIN_PROFILE`
(необязательно `APPLE_KEYCHAIN`). Значения credentials передаются только через
защищённое окружение. Недостающие credentials или неуспешные проверки подписи,
Gatekeeper и stapled ticket останавливают сборку.

В этом режиме имя приложения — `CastLink Client.app`, а DMG имеет каноническое
имя `CastLink-Client-<version>-<source-sha12>-mac-arm64.dmg` или
`CastLink-Client-<version>-<source-sha12>-mac-x64.dmg`. После отдельного согласия
обновлятор может скачать соответствующий опубликованный client asset, проверить
SHA256 и открыть DMG; замена приложения в Applications остаётся ручной,
с сохранением данных приложения. Подписанный/notarized macOS пакет пока не
проверен; macOS release не опубликован.
Подробные ограничения и доказательства — в
[матрице macOS](../docs/testing/MACOS_CLIENT_MATRIX_RU.md).

## Инструкции и опубликованные архивы

Текстовые инструкции в уже опубликованном архиве отражают момент сборки. Актуальные инструкции находятся в этом репозитории; их обновление не меняет установленные файлы и SHA256 опубликованных пакетов. Для нового поведения нужен соответствующий пакет, а для старой Linux-установки с отсутствующим паролем — явная команда восстановления.

## Единый репозиторий

Единственный публичный репозиторий CastLink — [resokol/castlink](https://github.com/resokol/castlink): собственные исходники по MIT, выпуски и инструкции. Архивы и `SHA256SUMS` доступны без предоставления отдельного доступа. Прежнее имя `resokol/castlink-releases` перенаправляет сюда и сохраняется для совместимости старых ссылок и установщиков; это не отдельное зеркало. Общий `releases/latest` не определяет сразу три продукта.

Архивы перенесены без пересборки: имена, встроенные build/source ID и контрольные суммы сохраняются. Соответствие исходного коммита сборки текущей истории репозитория приведено ниже; новая ссылка на исходники не означает новый бинарный пакет.

| Исходный коммит сборки | Исходники в текущей истории |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
