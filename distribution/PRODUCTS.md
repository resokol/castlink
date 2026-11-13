[Русский](PRODUCTS.md) · [English](docs/en/PRODUCTS.md) · [简体中文](docs/zh-CN/PRODUCTS.md)

# Пакеты CastLink

| CastLink | Назначение | Загрузить |
| --- | --- | --- |
| Windows Client | Приложение Windows: студия и кастер | [1.0.0](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/CastLink-Client-1.0.0-93d9b93e17da-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/SHA256SUMS) |
| Windows Server | Мастер Windows: свой сервер локально или на Linux Ubuntu по SSH | [1.0.3](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.3-1a26de9f6f59/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.3-1a26de9f6f59/SHA256SUMS) |
| Linux Ubuntu | Самостоятельная установка сервера на Linux Ubuntu | [1.0.3](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/SHA256SUMS) |

**[Мануал по установке](LINUX_MANUAL.md)** — Из коробки и расширенный режим.

Перед запуском проверьте SHA256SUMS выбранного выпуска. EXE не подписаны. Client проверяет обновление перед установкой и отдельно запрашивает согласие; ручная установка нужна, если старый клиент не находит выпуск. Серверные службы обновляются после вашего действия и могут прервать эфир. Данные резервируйте самостоятельно; три направления выпускаются независимо.

Server Setup build: `1.0.3-1a26de9f6f59` · source: `1a26de9f6f59cc95e84708e6e259bc0503daae38`

Linux build: `1.0.3-1a26de9f6f59` · source: `1a26de9f6f59cc95e84708e6e259bc0503daae38`

Client build: `1.0.0-93d9b93e17da` · source: `93d9b93e17daced23b3eb4207c8464d6091bea0c`

**1.0.3:** единый тумблер шумоподавления и эха, по умолчанию выключен; основная студия может переключать его в карточке кастера. [1.0.3](RELEASE_NOTES_1_0_3.md).

**Сервер 1.0.2:** история показателей и журнал событий за 24 часа в Super Admin; данные сохраняются после перезапуска. Linux также включает [install-server.sh](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/install-server.sh) для установки одной командой. [Инструкции](SERVER_INSTALL.md) · [Примечания к 1.0.2](RELEASE_NOTES_1_0_2.md).

Локальный Windows-сервер в обычном Server Setup требует Docker Desktop с Linux-контейнерами. Windows/WSL2 без Docker — отдельный кандидат; установка и внешний медиазвонок ещё не подтверждены, стабильный WSL-пакет в этой таблице не предлагается.

**Обновление серверов до 1.0.3:** обновите Server Setup или Linux вне эфира, выбрав прежнюю установку. Восстановление связи требует 1.0.1 или новее на обоих серверах. Windows Client остаётся на 1.0.0; используйте его встроенную проверку обновлений. Если старый клиент не находит выпуск, один раз скачайте установщик 1.0.0 вручную по ссылке выше и проверьте SHA256SUMS. [Восстановление связи](README.md#server-pair-recovery) · [История изменений](../CHANGELOG.md).

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-93d9b93e17da) · [Server Setup release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.3-1a26de9f6f59) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.3-1a26de9f6f59)

Исходники сервера 1.0.3: [выпуск](https://github.com/resokol/castlink/releases/tag/source-v1.0.3-1a26de9f6f59) · [точный коммит](https://github.com/resokol/castlink/tree/1a26de9f6f59cc95e84708e6e259bc0503daae38) · [ZIP](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/CastLink-Source-1.0.3.zip) · [tar.gz](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/CastLink-Source-1.0.3.tar.gz) · [manifest.json](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/manifest.json) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/SHA256SUMS). Исходники под MIT; архив исходников не является установщиком. Текущая разработка: [ветка main](https://github.com/resokol/castlink/tree/main).

## Инструкции и опубликованные архивы

Текстовые инструкции в уже опубликованном архиве отражают момент сборки. Актуальные инструкции находятся в этом репозитории; их обновление не меняет установленные файлы и SHA256 опубликованных пакетов. Для нового поведения нужен соответствующий пакет, а для старой Linux-установки с отсутствующим паролем — явная команда восстановления.

## Единый репозиторий

Единственный публичный репозиторий CastLink — [resokol/castlink](https://github.com/resokol/castlink): собственные исходники по MIT, выпуски и инструкции. Архивы и `SHA256SUMS` доступны без предоставления отдельного доступа. Прежнее имя `resokol/castlink-releases` перенаправляет сюда и сохраняется для совместимости старых ссылок и установщиков; это не отдельное зеркало. Общий `releases/latest` не определяет сразу три продукта.

Прежние архивы перенесены без пересборки: имена, встроенные build/source ID и контрольные суммы сохраняются. Соответствие исходного коммита сборки текущей истории репозитория приведено ниже; новая ссылка на исходники не означает новый бинарный пакет.

| Исходный коммит сборки | Исходники в текущей истории |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
