[Русский](PRODUCTS.md) · [English](docs/en/PRODUCTS.md) · [简体中文](docs/zh-CN/PRODUCTS.md)

# Пакеты CastLink

Основная линейка: **Windows Server на WSL2 (без Docker Desktop)**, **Linux Server на Ubuntu** и отдельный **Windows Client**. Подробности, ограничения и план снятия Legacy: [каналы установки](SUPPORTED_INSTALLERS.md).

## Основные продукты

| CastLink | Назначение | Загрузить |
| --- | --- | --- |
| Windows Server / WSL2 | Windows 11 x64, сервер без Docker Desktop. **Основное Windows-направление; опубликованный пакет пока prerelease.** | [1.0.6-rc.1](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.6-rc.1-dad063393b53) · [Установщик](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.6-rc.1-dad063393b53/install-server-windows.ps1) · [Обслуживание (fix1)](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.6-rc.1-dad063393b53/CastLink-Server-WSL-Maintenance-fix1.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.6-rc.1-dad063393b53/SHA256SUMS) |
| Linux Ubuntu | Отдельный сервер Linux, Docker Engine/Compose (не Docker Desktop на Windows) | [1.0.6](https://github.com/resokol/castlink/releases/tag/linux-v1.0.6-bc0679d83df8) · [Установщик](https://github.com/resokol/castlink/releases/download/linux-v1.0.6-bc0679d83df8/install-server.sh) · [CastLink-Linux.tar.gz](https://github.com/resokol/castlink/releases/download/linux-v1.0.6-bc0679d83df8/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.6-bc0679d83df8/SHA256SUMS) |
| Windows Client | Отдельное приложение для студии и кастера; сервер не устанавливает | [1.0.1](https://github.com/resokol/castlink/releases/tag/client-v1.0.1-079fd0f9d4b1) · [Установщик](https://github.com/resokol/castlink/releases/download/client-v1.0.1-079fd0f9d4b1/CastLink-Client-1.0.1-079fd0f9d4b1-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.1-079fd0f9d4b1/SHA256SUMS) |

## Legacy: Windows Server с Docker Desktop

| CastLink | Для кого | Архив |
| --- | --- | --- |
| Windows Server Setup / Docker | Только существующие Docker/SSH-установки и безопасное обслуживание; **не рекомендуется новым Windows-серверам** | [Последний опубликованный 1.0.4](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.4-079fd0f9d4b1) · [Исторический ZIP](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.4-079fd0f9d4b1/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.4-079fd0f9d4b1/SHA256SUMS) |

Автоматический перенос действующего Windows/Docker-сервера в WSL2 не поддерживается. Старые пакеты и их SHA256 сохраняются; **новый релиз `server-setup` не формируется** из штатного workflow. Внешний Ubuntu/VPS устанавливайте через Linux-инсталлятор; прежний Windows/SSH-мастер остаётся Legacy до появления полноценной замены.

**[Мануал по установке](LINUX_MANUAL.md)** — Из коробки и расширенный режим.

Перед запуском проверьте SHA256SUMS выбранного выпуска. EXE не подписаны. Client проверяет обновление перед установкой и отдельно запрашивает согласие; ручная установка нужна, если старый клиент не находит выпуск. Серверные службы обновляются после вашего действия и могут прервать эфир. Данные резервируйте самостоятельно; Windows Client, WSL2 и Linux выпускаются независимо. Legacy Windows/Docker не получает новых основных выпусков.

Server Setup build: `1.0.4-079fd0f9d4b1` · source: `079fd0f9d4b18215274ff401ba584435e263994f`

Windows/WSL build: `1.0.6-rc.1-dad063393b53` · source: `dad063393b5308638d99383669617e41c9e163fc`

Linux build: `1.0.6-bc0679d83df8` · source: `bc0679d83df87c48adb029656c9b10c3b5556205`

Client build: `1.0.1-079fd0f9d4b1` · source: `079fd0f9d4b18215274ff401ba584435e263994f`

**1.0.6:** В статистике студии добавлена «Диагностика видео → JSON»: история отправки и приёма с доступными счётчиками кадров и зависаний. [Примечания](RELEASE_NOTES_1_0_6.md).

Исходники 1.0.6: [web / Windows](https://github.com/resokol/castlink/tree/dad063393b5308638d99383669617e41c9e163fc) · [ZIP](https://github.com/resokol/castlink/archive/dad063393b5308638d99383669617e41c9e163fc.zip) · [Linux](https://github.com/resokol/castlink/tree/bc0679d83df87c48adb029656c9b10c3b5556205).

**1.0.4:** памятка о качестве сети в карточке кастера; Windows Client обновлён до 1.0.1. [1.0.4](RELEASE_NOTES_1_0_4.md).

**1.0.3:** единый тумблер шумоподавления и эха, по умолчанию выключен; основная студия может переключать его в карточке кастера. [1.0.3](RELEASE_NOTES_1_0_3.md).

**Сервер 1.0.2:** история показателей и журнал событий за 24 часа в Super Admin; данные сохраняются после перезапуска. Linux также включает [install-server.sh](https://github.com/resokol/castlink/releases/download/linux-v1.0.4-079fd0f9d4b1/install-server.sh) для установки одной командой. [Инструкции](SERVER_INSTALL.md) · [Примечания к 1.0.2](RELEASE_NOTES_1_0_2.md).

Windows/WSL2 остаётся отдельным предварительным каналом. Для обновления существующей WSL-установки используйте ZIP обслуживания этого же выпуска; обновляйте вне эфира, затем страницы студии и кастеров. Обычный Windows Server Setup по-прежнему требует Docker Desktop.

**Обновление прежних Docker-серверов до 1.0.4 (Legacy):** обновляйте только соответствующим Server Setup вне эфира, выбрав прежнюю установку. Для новых Windows-серверов используйте WSL2; для Ubuntu — Linux 1.0.6. Восстановление связи требует 1.0.1 или новее на обоих серверах. Windows Client остаётся на 1.0.1; используйте его встроенную проверку обновлений. Если старый клиент не находит выпуск, один раз скачайте установщик 1.0.1 вручную по ссылке выше и проверьте SHA256SUMS. [Восстановление связи](README.md#server-pair-recovery) · [История изменений](../CHANGELOG.md).

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.1-079fd0f9d4b1) · [Windows WSL2 release (RC)](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.6-rc.1-dad063393b53) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.6-bc0679d83df8) · [Docker Legacy release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.4-079fd0f9d4b1)

Исходники сервера 1.0.4: [выпуск](https://github.com/resokol/castlink/releases/tag/source-v1.0.4-079fd0f9d4b1) · [точный коммит](https://github.com/resokol/castlink/tree/079fd0f9d4b18215274ff401ba584435e263994f) · [ZIP](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/CastLink-Source-1.0.4.zip) · [tar.gz](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/CastLink-Source-1.0.4.tar.gz) · [manifest.json](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/manifest.json) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/SHA256SUMS). Исходники под MIT; архив исходников не является установщиком. Текущая разработка: [ветка main](https://github.com/resokol/castlink/tree/main).

## Инструкции и опубликованные архивы

Текстовые инструкции в уже опубликованном архиве отражают момент сборки. Актуальные инструкции находятся в этом репозитории; их обновление не меняет установленные файлы и SHA256 опубликованных пакетов. Для нового поведения нужен соответствующий пакет, а для старой Linux-установки с отсутствующим паролем — явная команда восстановления.

## Единый репозиторий

Единственный публичный репозиторий CastLink — [resokol/castlink](https://github.com/resokol/castlink): собственные исходники по MIT, выпуски и инструкции. Архивы и `SHA256SUMS` доступны без предоставления отдельного доступа. Прежнее имя `resokol/castlink-releases` перенаправляет сюда и сохраняется для совместимости старых ссылок и установщиков; это не отдельное зеркало. Общий `releases/latest` не определяет сразу три продукта.

Прежние архивы перенесены без пересборки: имена, встроенные build/source ID и контрольные суммы сохраняются. Соответствие исходного коммита сборки текущей истории репозитория приведено ниже; новая ссылка на исходники не означает новый бинарный пакет.

| Исходный коммит сборки | Исходники в текущей истории |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
