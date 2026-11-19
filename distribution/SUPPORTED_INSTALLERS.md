# Каналы установки CastLink / Supported install channels

**Решение по продукту (19.11.2026):** для новых серверов Windows основное направление — **Windows 11 + WSL2 без Docker Desktop**. Для Ubuntu/VPS — **отдельный Linux Server на Docker Engine/Compose**. Для участников — самостоятельный **Windows Client**. Их установщики **не идентичны**: форматы пакетов, зависимости, инструменты обслуживания и циклы выпуска различаются.

## Основные направления

| Назначение | Рекомендуемый пакет | Текущий публичный выпуск | Статус самого артефакта |
| --- | --- | --- | --- |
| Windows 11 server | `server-wsl`: `install-server-windows.ps1` + средства обслуживания | [1.0.6-rc.1](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.6-rc.1-dad063393b53) | опубликованный **prerelease**; WSL2 — выбранное основное направление Windows |
| Ubuntu Linux/VPS server | `linux`: `install-server.sh` + Docker/Compose | [1.0.6](https://github.com/resokol/castlink/releases/tag/linux-v1.0.6-bc0679d83df8) | стабильный выпуск |
| Windows caster/studio client | `client`: отдельный `setup.exe` | [1.0.1](https://github.com/resokol/castlink/releases/tag/client-v1.0.1-079fd0f9d4b1) | стабильный выпуск; **не** устанавливает сервер |

См. [каталог пакетов](PRODUCTS.md), [установку Windows/Ubuntu](../README.md), [обслуживание сервера](SERVER_INSTALL.md). Все версии и хеши берите из **своего** конкретного релиза, а не общего `releases/latest`.

**Статус WSL2:** подтверждённая владельцем стабильная работа существующей установки сама по себе не переименовывает опубликованный `1.0.6-rc.1` в стабильный релиз. Переход на версию без `-rc` требует отдельной проверенной сборки, контрольных сумм, полного теста на Windows 11 и публикации. Не менять задним числом существующие архивы или теги.

## Windows/Docker Server Setup — Legacy

[Последний отдельный выпуск 1.0.4](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.4-079fd0f9d4b1) и предыдущие архивы остаются для действующих установок, проверок и безопасного обслуживания. **Для новых установок Windows его не рекомендуем.** Не запускать создание новых `server-setup` выпусков из основного workflow; не удалять старые релизы, контрольные суммы и работающие Docker-серверы.

Старый `EasySetup.exe` умеет разворачивать Ubuntu/VPS через SSH. Для новых серверов Ubuntu предпочитайте официальный Linux-инсталлятор по SSH; исторический мастер остаётся Legacy, пока не создана полноценная замена удалённой установки.

## Переход существующих серверов

- **Docker → WSL2:** прямой импорт и автоматическая миграция **не поддерживаются**. Не устанавливайте поверх старого каталога, не удаляйте рабочие тома Docker и не используйте WSL `Restore` с Docker-архивом.
- До переключения необходимы проверенный перенос/восстановление PostgreSQL, постоянных слотов и ссылок, комнат, резервов, UUID/секретов, HTTPS/TURN и тест внешнего медиазвонка. До этого — отдельная новая установка, ручной экспорт необходимых данных и согласованное переключение вне эфира. Не обещайте бесшовную миграцию.
- Обновления `server-wsl` проводите только средствами WSL того же выпуска. `linux` обновляйте штатным Linux-инсталлятором с **тем же `--state-dir`**. Windows Client обновляется **отдельно**.
- Сначала резервная копия и проверка отката, затем обновление вне эфира, перезагрузка страниц студии и кастеров, контроль камеры, микрофона, TURN и отдельных ссылок OBS/vMix.

## Требования к продвижению Windows/WSL2 в stable

1. Отдельный полный тест на чистой Windows 11: установка, перезагрузка, автозапуск и остановка, повторный запуск и удаление с архивом.
2. Внешний HTTPS/TURN, реальное аудио/видео с физическими устройствами и полный маршрут кастер → сервер → студия → OBS/vMix; проверка VPN, CGNAT/портов и поведения при потере сети.
3. Обновление текущего WSL RC без потери UUID, комнат, паролей, слотов и сертификата; восстановление после отказа и верификация контрольных сумм.
4. Сверка функций и API с Linux 1.0.6; в двух независимых установщиках **общие возможности**, но различная инфраструктура. Не заявлять побайтовую или функциональную идентичность без тестов.
5. Опубликовать **новый** стабильный WSL тег и пакеты, инструкции и SHA256; после подтверждения обновить каталог. Никаких изменений старых релизов.

---

## English summary

**Primary Windows Server:** Windows 11 / WSL2 without Docker Desktop. **Primary Linux/VPS Server:** Ubuntu using Docker Engine/Compose. **Windows Client:** separate application. The installers are different. Windows/Docker Server Setup is **Legacy**, retained for existing installations only. The currently published WSL package is still **1.0.6-rc.1 (prerelease)**, regardless of the owner's successful operational tests. A stable WSL release needs its own fully tested and newly published artifacts. There is **no supported automatic migration from Docker to WSL2**; do not overwrite or delete existing Docker data.
