[Русский](PRODUCTS.md) · [English](docs/en/PRODUCTS.md) · [简体中文](docs/zh-CN/PRODUCTS.md)

# Пакеты CastLink

| CastLink | Назначение | Загрузить |
| --- | --- | --- |
| Windows Client | Приложение Windows: студия и кастер | [1.0.0](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/CastLink-Client-1.0.0-93d9b93e17da-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/SHA256SUMS) |
| Windows Server | Мастер Windows: свой сервер локально или на Linux Ubuntu по SSH | [1.0.0](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-1ea894bd94ad/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-1ea894bd94ad/SHA256SUMS) |
| Linux Ubuntu | Самостоятельная установка сервера на Linux Ubuntu | [1.0.0](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-1ea894bd94ad/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.0-1ea894bd94ad/SHA256SUMS) |

**[Мануал по установке](LINUX_MANUAL.md)** — Из коробки и расширенный режим.

Перед запуском проверьте SHA256SUMS выбранного выпуска. EXE не подписаны. Client проверяет обновление перед установкой и отдельно запрашивает согласие; ручная установка нужна, если старый клиент не находит выпуск. Серверные службы обновляются после вашего действия и могут прервать эфир. Данные резервируйте самостоятельно; три направления выпускаются независимо.

Server Setup build: `1.0.0-1ea894bd94ad` · source: `1ea894bd94adb96f861398cc30addc93d1bf9d21`

Linux build: `1.0.0-1ea894bd94ad` · source: `1ea894bd94adb96f861398cc30addc93d1bf9d21`

Client build: `1.0.0-93d9b93e17da` · source: `93d9b93e17daced23b3eb4207c8464d6091bea0c`

**Обновление до 1.0.0:** используйте встроенную проверку обновлений Client. Если старый клиент не находит выпуск (например, после переименования репозитория), один раз скачайте установщик 1.0.0 вручную по ссылке выше и проверьте SHA256SUMS. Для собственного сервера отдельно обновите Server Setup или Linux вне эфира, выбрав прежнюю установку. [Что нового и порядок обновления](RELEASE_NOTES_1_0_0.md).

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-93d9b93e17da) · [Server Setup release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.0-1ea894bd94ad) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.0-1ea894bd94ad)

## Инструкции и опубликованные архивы

Текстовые инструкции в уже опубликованном архиве отражают момент сборки. Актуальные инструкции находятся в этом репозитории; их обновление не меняет установленные файлы и SHA256 опубликованных пакетов. Для нового поведения нужен соответствующий пакет, а для старой Linux-установки с отсутствующим паролем — явная команда восстановления.

## Единый репозиторий

Единственный публичный репозиторий CastLink — [resokol/castlink](https://github.com/resokol/castlink): собственные исходники по MIT, выпуски и инструкции. Архивы и `SHA256SUMS` доступны без предоставления отдельного доступа. Прежнее имя `resokol/castlink-releases` перенаправляет сюда и сохраняется для совместимости старых ссылок и установщиков; это не отдельное зеркало. Общий `releases/latest` не определяет сразу три продукта.

Архивы перенесены без пересборки: имена, встроенные build/source ID и контрольные суммы сохраняются. Соответствие исходного коммита сборки текущей истории репозитория приведено ниже; новая ссылка на исходники не означает новый бинарный пакет.

| Исходный коммит сборки | Исходники в текущей истории |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
