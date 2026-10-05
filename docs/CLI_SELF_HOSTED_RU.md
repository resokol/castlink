# CastLink CLI: developer preview

Дата: 05.10.2026. GitHub-ветка `feat/self-hosted-cli-github` основана на RC2 `24a05c909e1a4aae622fd3b4e2605ccbd5883975`. Цель первого выпуска — Windows/macOS, локальная установка и собственный VPS, работа через существующий браузерный UI. Этот checkpoint содержит каркас CLI и диагностику предпосылок; автоматическая установка сервера ещё не подключена.

## Что работает в этой ветке

- Консольный мастер выбора local/remote, профиля и режима доступа; проверка аргументов и pure planner девяти шагов установки.
- `setup --dry-run` не создаёт конфигурацию, не устанавливает runtime и не связывается с VPS.
- Профили и journal: атомарная запись, Unix permissions/Windows restricted ACL, эксклюзивный lock, сохранение installationId, отказ от трактовки повреждённого профиля как новой установки.
- `doctor` проверяет предпосылки этого компьютера; `doctor --profile NAME` читает сохранённый профиль и проверяет его local/remote цель.
- Проверяются ОС, архитектура, эффективный Docker endpoint, Linux engine и Compose v2. Удалённый Docker context не считается runtime проверяемой машины.
- SSH использует системный OpenSSH, существующие доверенные host keys, вход по ключу и фиксированный Python 3 helper. Параметры передаются через JSON stdin, секреты и сырой stderr не выводятся. Диагностика не меняет known_hosts, профиль или journal, не устанавливает runtime и не запускает контейнеры.
- Validator/schema developer release manifest проверяет точные версии, Node 22, image digests, архитектуры и отсутствие дополнительных полей. Фиктивные образы из unit tests не являются опубликованным server bundle.

Службы CastLink, DNS/TLS, ICE/TURN и реальные аудио/видео остаются `unverified`: успешно проверенные предпосылки не подтверждают завершение установки или готовность медиасети.

## Запуск из исходников

Требуется Node 22 и pnpm 9.15.0. Из корня репозитория:

```text
pnpm install --frozen-lockfile
pnpm --filter @castlink/cli build
node apps/cli/dist/main.js --help
node apps/cli/dist/main.js setup --target local --network loopback --dry-run
node apps/cli/dist/main.js setup --target remote --host 203.0.113.8 --user operator --domain studio.example.org --dry-run --json
node apps/cli/dist/main.js doctor --json
node apps/cli/dist/main.js doctor --profile home --json
pnpm test:cli
```

Адреса — примеры. `home` — имя уже сохранённого профиля: doctor его не создаёт и не принимает под управление существующий сервер. Remote-проверка требует заранее доверенный ключ сервера, вход по SSH-ключу и Python 3 на Ubuntu 22.04/24.04 amd64/arm64. Отсутствие OpenSSH — предупреждение для local и блокер для remote. DOCKER_HOST/DOCKER_CONTEXT учитываются при выборе эффективного endpoint.

`doctor` возвращает 3 при непрошедших предпосылках, 2 при неизвестном имени профиля и 4 при повреждённом сохранённом профиле. `doctor --json` выдаёт массив `CheckResult[]` и при ошибках. `--media`, setup без `--dry-run` и команды обслуживания пока возвращают явный отказ. В продуктовый выпуск планируется включённый Node runtime; текущие команды требуют developer toolchain.

## Граница серверной части

Серверный код этой ветки на момент CLI checkpoint сохранён из RC2. Независимый `/api/setup`, изменение seed node type и Dockerfile copy room migrations ранее реализованы в Windows worktree `feat/self-hosted-cli` (локальные коммиты `3a13b58` и `d63e094`); эти коммиты ещё не находятся в GitHub и не входят в данное изменение. Их исторические Windows/web/SQL проверки относятся к той локальной версии, а не подтверждают отсутствующие здесь серверные изменения.

Перенос или реконструкция независимого server setup выполняется отдельным изменением с тестами и ревью. Полный versioned server bundle, installer/runtime bootstrap, первый доступ владельца, setup/resume, media doctor, backup/update/rollback/uninstall и подписанные Windows/macOS пакеты остаются следующими этапами.

## Проверки и ограничения

Архитектуру и ревью doctor выполнила Astra, реализацию и тесты — GPT-6.1 Sol. До интеграции в Git checkout авторская CLI-копия прошла build/typecheck и Node 22.23.3 suite: 73 passed, 0 failed, 1 Windows ACL skipped. Регрессии SSH CheckHostIP/VerifyHostKeyDNS и типов host/user в повреждённом профиле воспроизведены до исправлений и проверены после них. В интегрированном Git checkout прошли frozen install pnpm 9.15.0, общая TypeScript-проверка web + CLI (TypeScript 5.9.3), CLI suite (73 passed, 1 Windows ACL skipped) и 86 существующих стабильных web checks. Серверные исходники и Dockerfile совпадают с RC2. GitHub CI проверяет frozen install, TypeScript, CLI и существующие web checks после публикации ветки.

Реальные Windows/macOS и SSH/media acceptance этого этапа не выполнены. Windows platform probe использует номер kernel build и пока не отличает Windows Server с тем же ядром от Windows 11. Новый server image и server release manifest не опубликованы. Операционные подробности текущего VPS не являются доказательством готовности этого CLI.

План: [реализация](superpowers/plans/2026-10-05-self-hosted-cli.md). Спецификация: [Windows/macOS CLI](superpowers/specs/2026-10-05-self-hosted-cli-design.md). Модель: [независимый self-hosted](ARCHITECTURE_SELF_HOSTED_RU.md).
