# CastLink

CastLink — студия для удалённого подключения кастеров, презентаций и передачи отдельных аудио- и видеопотоков в OBS/vMix. Студия и кастеры работают в браузере; для Windows доступен отдельный клиент. Репозиторий содержит исходники приложения, инструменты сборки и документацию для разработчиков.

## Скачать и установить

Готовые пакеты и контрольные суммы: [каталог продуктов](distribution/PRODUCTS.md), [выпуски основного репозитория](https://github.com/resokol/studiolink/releases). Windows Client, Windows Server Setup и standalone Linux имеют независимые версии; пакет и `SHA256SUMS` нужно брать из одного выпуска одного продукта.

| Продукт | Назначение |
| --- | --- |
| Windows Client | Приложение кастера и студии. Устанавливается через `setup.exe`; Docker не нужен. |
| Windows Server Setup | Мастер установки сервера на Windows или на Linux Ubuntu по SSH. Распакуйте весь `CastLink-Windows.zip` и запустите `EasySetup.exe`. |
| Linux Ubuntu | Самостоятельная установка сервера: [Linux manual](distribution/LINUX_MANUAL.md), быстрый и расширенный режимы. |

[Установка: Русский / English / 简体中文](distribution/INSTALL.md) · [Руководство пользователя](distribution/README.md) · [Управление ПК](docs/REMOTE_PC_CONTROL_RU.md).

Пока основной репозиторий закрыт, скачивание из него требует входа в GitHub и предоставленного доступа. [Публичное зеркало](https://github.com/resokol/castlink-releases/releases) содержит проверенные и одобренные пакеты. Текущие архивы скопированы без пересборки; встроенные версии и SHA256 сохранены.

Для Windows-сервера нужен Docker Desktop с Linux-контейнерами; VPS-установка поддерживает Ubuntu 22.04/24.04 amd64. Самостоятельная установка работает на инфраструктуре её владельца. Условия сети, HTTPS, порты и обновление описаны в руководствах.

## Разработка

Нужны Git, Node.js 22 и pnpm 9.15.0. Версии зависимостей закреплены в `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:ci
pnpm build
```

Для запуска интерфейса используйте `pnpm dev`. Полноценный локальный стенд требует LiveKit, конфигурацию доступа и выбранное хранилище; создавайте отдельную среду и данные для разработки. Шаблоны конфигурации находятся в `infrastructure/`. Не используйте данные работающего сервера для тестов.

| Каталог | Содержимое |
| --- | --- |
| [apps/web](apps/web) | Next.js/React, серверные API и браузерные интерфейсы |
| [apps/desktop](apps/desktop) | Windows-клиент и нативные интеграции |
| [apps/cli](apps/cli) | Исследовательский CLI; отличается от установщика standalone Linux |
| [native](native) | Нативные компоненты Windows и протоколы |
| [scripts](scripts) | Сборка, установщики, миграции и проверки |
| [infrastructure](infrastructure) | Compose, SQL, шаблоны сервисов и runtime-компоненты |
| [docs](docs/README.md) | Архитектура, разработка и эксплуатация |
| [distribution](distribution) | Пользовательские инструкции и описание направлений выпуска |

Начните с [учебного мануала](docs/MANUAL_RU.md), [карты проекта](docs/PROJECT_GUIDE_RU.md) и [технических инвариантов](docs/CRITICAL_INVARIANTS_RU.md). Для интерфейса используйте [дизайн-систему](DESIGN.md) и [карту UI](docs/UI_EDITING_GUIDE_RU.md). Изменение исходников само по себе не обновляет установленное приложение или сервер.

## Лицензия

Условия использования и распространения определяет [LICENSE](LICENSE). Публикация исходников не меняет эти условия. Сторонние компоненты сохраняют собственные лицензии и права на получение исходников: [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES).

Автор: [Telegram @sklvmax](https://t.me/sklvmax), [GitHub resokol](https://github.com/resokol).
