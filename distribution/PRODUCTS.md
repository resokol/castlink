[Русский](https://github.com/resokol/castlink-releases/blob/main/PRODUCTS.md) · [English](https://github.com/resokol/castlink-releases/blob/main/docs/en/PRODUCTS.md) · [简体中文](https://github.com/resokol/castlink-releases/blob/main/docs/zh-CN/PRODUCTS.md)

# Пакеты CastLink

| CastLink | Назначение | Загрузить |
| --- | --- | --- |
| Windows Client | Приложение Windows: студия и кастер | [1.0.0-rc.8](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-f6c47a27a62c/CastLink-Client-1.0.0-rc.8-f6c47a27a62c-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-f6c47a27a62c/SHA256SUMS) |
| Windows Server | Мастер Windows: свой сервер локально или на Linux Ubuntu по SSH | [1.0.0-rc.8](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/SHA256SUMS) |
| Linux Ubuntu | Самостоятельная установка сервера на Linux Ubuntu | [1.0.0-rc.8](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-d703726cd50b/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-d703726cd50b/SHA256SUMS) |

**[Мануал по установке](LINUX_MANUAL.md)** — Из коробки и расширенный режим.

Перед запуском проверьте SHA256SUMS выбранного выпуска. EXE не подписаны. Новый Client предлагает проверенное обновление, но установка требует отдельного согласия; старый Client замените вручную. Серверные службы обновляются после вашего действия и могут прервать эфир. Данные резервируйте самостоятельно; три направления выпускаются независимо.

Server Setup build: `1.0.0-rc.8-d703726cd50b` · source: `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1`

Linux build: `1.0.0-rc.8-d703726cd50b` · source: `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1`

Client build: `1.0.0-rc.8-f6c47a27a62c` · source: `f6c47a27a62c59f72067f4fe95ee215fcb056bfc`

Если родная Windows-панель ещё показывает прежнюю надпись управления, обновите Client: F10 → «Проверить обновления» либо скачайте новый установщик вручную. Старые версии без проверки обновлений замените вручную. Обновление сервера не заменяет EXE; перед обновлением завершите эфир. EXE не подписаны.

[Client release](https://github.com/resokol/castlink-releases/releases/tag/client-v1.0.0-rc.8-f6c47a27a62c) · [Server Setup release](https://github.com/resokol/castlink-releases/releases/tag/server-setup-v1.0.0-rc.8-d703726cd50b) · [Linux release](https://github.com/resokol/castlink-releases/releases/tag/linux-v1.0.0-rc.8-d703726cd50b)

## Инструкции и опубликованные архивы

Текстовые инструкции в уже опубликованном архиве отражают момент сборки. Актуальные инструкции находятся в этом репозитории; их обновление не меняет установленные файлы и SHA256 опубликованных пакетов. Для нового поведения нужен соответствующий пакет, а для старой Linux-установки с отсутствующим паролем — явная команда восстановления.
