[Русский](PRODUCTS.md) · [English](docs/en/PRODUCTS.md) · [简体中文](docs/zh-CN/PRODUCTS.md)

# Пакеты CastLink

| CastLink | Назначение | Загрузить |
| --- | --- | --- |
| Windows Client | Приложение Windows: студия и кастер | [Опубликованный Client RC9](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-rc.9-a994895c5fa9) |
| macOS Client — в разработке | Та же область клиента для Apple Silicon arm64 и Intel x64; приёмка не завершена | Публичного macOS выпуска нет; [сборка и матрица проверки](../docs/testing/MACOS_CLIENT_MATRIX_RU.md) |
| Windows Client — архив RC8 | Предыдущий опубликованный установщик | [1.0.0-rc.8](https://github.com/resokol/castlink/releases/download/client-v1.0.0-rc.8-f6c47a27a62c/CastLink-Client-1.0.0-rc.8-f6c47a27a62c-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.0-rc.8-f6c47a27a62c/SHA256SUMS) |
| Windows Server | Мастер Windows: свой сервер локально или на Linux Ubuntu по SSH | [1.0.0-rc.8](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/SHA256SUMS) |
| Linux Ubuntu | Самостоятельная установка сервера на Linux Ubuntu | [1.0.0-rc.8](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.8-d703726cd50b/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.8-d703726cd50b/SHA256SUMS) |

**[Мануал по установке](LINUX_MANUAL.md)** — Из коробки и расширенный режим.

Перед запуском проверьте SHA256SUMS выбранного выпуска. EXE не подписаны. Новый Client предлагает проверенное обновление, но установка требует отдельного согласия; старый Client замените вручную. Серверные службы обновляются после вашего действия и могут прервать эфир. Данные резервируйте самостоятельно; три направления выпускаются независимо.

Server Setup build: `1.0.0-rc.8-d703726cd50b` · source: `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1`

Linux build: `1.0.0-rc.8-d703726cd50b` · source: `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1`

Опубликованный Client RC9 — база переноса macOS: `1.0.0-rc.9-a994895c5fa9` · source: `a994895c5fa976a073965f845ba23a4f61f94387`. Его бинарные файлы и контрольные суммы не изменены работой над macOS.

Архивный Client RC8 build: `1.0.0-rc.8-f6c47a27a62c` · source: `f6c47a27a62c59f72067f4fe95ee215fcb056bfc`

Если родная Windows-панель ещё показывает прежнюю надпись управления, обновите Client: F10 → «Проверить обновления» либо скачайте новый установщик вручную. Старые версии без проверки обновлений замените вручную. Обновление сервера не заменяет EXE; перед обновлением завершите эфир. EXE не подписаны.

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-rc.8-f6c47a27a62c) · [Server Setup release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.0-rc.8-d703726cd50b) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.0-rc.8-d703726cd50b)

## macOS: текущая ветка и проверочные сборки

Исходники переноса доступны в публичной ветке `feat/macos-client`. Ветка и Actions
artifacts не являются macOS release. В [проверенном run 41465249691](https://github.com/resokol/castlink/actions/runs/41465249691)
для source SHA `60290e6ebb9ca3eaff2054e35fc7ccc84a3676f8` на обеих нативных
архитектурах прошли компиляция helpers, core/self-test и kernel process-birth
проверки, desktop/Python тесты, сборка DMG/ZIP и запуск фактического app с
проверкой ресурсов, иконки, встроенного Python, launcher/setup UI и изоляции renderer.
Общий результат run — **FAILED**: input fixture прошла key/Unicode delivery,
затем завершилась assertion failure; audio fixture провалила spectral isolation.
Chrome/Edge PDF остаются NOT VERIFIED: не получена точная AX-идентичность PDF.
Принятие Windows-managed VPS реализовано и проверено контрактными Python-тестами,
но сценарий с настоящим VPS пока NOT VERIFIED. Полные результаты и границы
проверки перечислены в [матрице macOS](../docs/testing/MACOS_CLIENT_MATRIX_RU.md).
Работа с установленным Microsoft Office, полный клиентский сценарий и полный
паритет Windows на обеих архитектурах пока не подтверждены.

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
Фактическая работа этих сценариев и TCC ещё требует приёмки.

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
с сохранением данных приложения. Credentials в текущей работе не предоставлены:
подписанный/notarized macOS пакет не получен и macOS release не опубликован.
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
