# Каналы установки CastLink / Supported install channels

**Решение по продукту (21.11.2026):** для новых серверов Windows основное направление — **Windows 11 + WSL2 без Docker Desktop**. Для Ubuntu/VPS — **отдельный Linux Server на Docker Engine/Compose**. Для участников — самостоятельный **Windows Client**. Их установщики **не идентичны**: форматы пакетов, зависимости, инструменты обслуживания и циклы выпуска различаются.

## Основные направления

| Назначение | Рекомендуемый пакет | Текущий публичный выпуск | Статус самого артефакта |
| --- | --- | --- | --- |
| Windows 11 server | `server-wsl`: `install-server-windows.ps1` + средства обслуживания | [1.0.10](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.10-890a903d51f9) | стабильный выпуск; WSL2 — основное направление Windows |
| Ubuntu Linux/VPS server | `linux`: `install-server.sh` + Docker/Compose | [1.0.10](https://github.com/resokol/castlink/releases/tag/linux-v1.0.10-890a903d51f9) | стабильный выпуск |
| Windows caster/studio client | `client`: отдельный `setup.exe` | [1.0.3](https://github.com/resokol/castlink/releases/tag/client-v1.0.3-35dbb73b5925) | стабильный выпуск; **не** устанавливает сервер |

См. [каталог пакетов](PRODUCTS.md), [установку Windows/Ubuntu](../README.md), [обслуживание сервера](SERVER_INSTALL.md). Все версии и хеши берите из **своего** конкретного релиза, а не общего `releases/latest`.

**Статус WSL2:** стабильный выпуск **1.0.10** имеет собственные тег, пакет и SHA256. Исторический `1.0.6-rc.1` сохраняет статус prerelease; его архивы и теги не меняются. Обслуживание 1.0.10 поддерживает исходные выпуски `server-wsl-v1.0.6-rc.1-dad063393b53`, `server-wsl-v1.0.7-0d16de2e782c` и `server-wsl-v1.0.8-1afa39b54dd7`; используйте новый инструмент 1.0.10 и прежнюю установку.

## Windows/Docker Server Setup — Legacy

[Последний отдельный выпуск 1.0.4](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.4-079fd0f9d4b1) и предыдущие архивы остаются для действующих установок, проверок и безопасного обслуживания. **Для новых установок Windows его не рекомендуем.** Не запускать создание новых `server-setup` выпусков из основного workflow; не удалять старые релизы, контрольные суммы и работающие Docker-серверы.

Старый `EasySetup.exe` умеет разворачивать Ubuntu/VPS через SSH. Для новых серверов Ubuntu предпочитайте официальный Linux-инсталлятор по SSH; исторический мастер остаётся Legacy, пока не создана полноценная замена удалённой установки.

## Переход существующих серверов

- **Docker → WSL2:** прямой импорт и автоматическая миграция **не поддерживаются**. Не устанавливайте поверх старого каталога, не удаляйте рабочие тома Docker и не используйте WSL `Restore` с Docker-архивом.
- До переключения необходимы проверенный перенос/восстановление PostgreSQL, постоянных слотов и ссылок, комнат, резервов, UUID/секретов, HTTPS/TURN и тест внешнего медиазвонка. До этого — отдельная новая установка, ручной экспорт необходимых данных и согласованное переключение вне эфира. Не обещайте бесшовную миграцию.
- Обновления `server-wsl` проводите только средствами WSL того же выпуска. `linux` обновляйте штатным Linux-инсталлятором с **тем же `--state-dir`**. Windows Client обновляется **отдельно**.
- Сначала резервная копия и проверка отката, затем обновление вне эфира, перезагрузка страниц студии и кастеров, контроль камеры, микрофона, TURN и отдельных ссылок OBS/vMix.

## Выпуск и границы проверки Windows/WSL2

WSL2 собирается отдельной фабрикой `server-wsl-package.yml` с закреплённым source SHA. Полный набор пакетов и соответствующих исходников, manifests, SHA256 и результаты нативных Windows CI-проверок сверяются перед ручной публикацией нового стабильного тега. Linux 1.0.10 имеет отдельную сборку, тег и инфраструктуру.

Нативные CI-проверки и проверки точного пакета не заменяют физическую проверку перезагрузки чистой Windows 11, внешнего HTTPS/TURN и живого эфира OBS/vMix с камерами и микрофонами. Выпуск не заявляет новую проверку этих сценариев. При обновлении проверьте собственное подключение и медиа вне эфира; прежние архивы не заменяются.

---

## English summary

**Primary Windows Server:** stable **Windows 11 / WSL2 1.0.10** without Docker Desktop. **Primary Linux/VPS Server:** stable **Ubuntu/Linux 1.0.10** using Docker Engine/Compose. **Windows Client:** separate **1.0.3** application. Their installers and build pipelines differ. Windows/Docker Server Setup remains **Legacy 1.0.4** for existing installations; new legacy builds are disabled. Historical WSL 1.0.6-rc.1 remains a prerelease, while its exact source tag is supported by 1.0.10 maintenance. WSL packages use a separate source-pinned factory and manual publication after checking exact assets, manifests, SHA256 and native Windows CI results. These checks do not establish a fresh physical Windows reboot or live OBS/vMix acceptance test. There is **no supported automatic Docker → WSL2 migration**; preserve existing data.

## 简体中文摘要

**主要 Windows 服务器：Windows 11 / WSL2 稳定版 1.0.10**，无需 Docker Desktop。**主要 Linux/VPS 服务器：Ubuntu/Linux 稳定版 1.0.10**，使用 Docker Engine/Compose。**Windows Client：**独立版本 **1.0.3**。安装程序及构建流程各不相同。Windows/Docker Server Setup 保持 **Legacy 1.0.4**，仅供现有安装使用，禁用新构建。历史 WSL 1.0.6-rc.1 仍为预发布版，其准确来源标签受 1.0.10 维护工具支持。WSL 使用固定源码的独立构建流程，核对准确归档、manifest、SHA256 及原生 Windows CI 结果后手动发布；这些检查不代表新完成的实体 Windows 重启或真实 OBS/vMix 直播验收。不支持自动 Docker → WSL2 迁移，请保留原数据。
