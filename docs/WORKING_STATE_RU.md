# Текущее состояние — сервер и суточный мониторинг, 11.11.2026

## Публикация — текущий этап

Пользователь разрешил публикацию. Фактический активный репозиторий теперь
`resokol/castlink`, публичные исходники MIT и выпуски в одном канале; прежний
`resokol/studiolink` перенаправляет в архив `castlink-private-archive-20261026`.
Старую ветку/коммиты не меняли. Новая рабочая копия `/workspace/castlink-publish`,
временная ветка `feat/server-install-monitoring`, основа actual public main
`8426400d390f7daca0cd72c5164ae0814861b296`. Сохранены текущие recovery/UI/документы.
Новый bootstrap/WSL packager используют канонический `resokol/castlink`.
Подготовлена версия серверных направлений 1.0.2; Client остаётся 1.0.0.
Windows WSL — отдельный 1.0.2-rc.1 кандидат, без утверждения о проверке Windows.
Пакеты 1.0.1 в каталоге остаются прежними до проверки и публикации новых assets.

Предыдущий CI-отказ output-source-quality был на архивной основе; текущий main
уже исправил этот тест. Итоговый `pnpm test:ci` прошёл: 361 stable CI test. `pnpm typecheck` (web и CLI),
production Next build, 25 packaging tests и 17 bootstrap tests прошли;
проверки Linux owner-access/recovery и runtime также прошли. Независимый Sol high
review переноса не нашёл материальных регрессий. Новый Node22 runtime и
production Chromium desktop/mobile proof прошли: фильтры, cursor, hidden-tab
poll pause при продолжающемся серверном сборе; оба настоящих API гостю 403.
Для локального standalone стенда разрешены только сгенерированные абсолютные
dependency symlinks; исходники runtime не менялись. Полноценные distribution
archives после переноса ещё не строились.
Windows ПК сейчас offline; реальный WSL lifecycle/media не выполнен. Коннектор
GitHub поддерживает PR/refs, но не dispatch/release; CLI API пока Forbidden из-за
сетевой политики окружения. Автоматическая проверка отклонила push в новый публичный репозиторий: требуется
явное подтверждение именно `resokol/castlink` и публикации новых исходников.
Удалённая feature-ветка не создана; это проверено чтением refs.
Следующий результат после подтверждения — source PR и затем
пакеты через действующий ручной release workflow с SHA256 и соответствующими sources.

## Задача и принятые решения — исходный локальный этап

Пользователь поручил сервер Linux одной командой, Windows без Docker и графические
показатели стабильности. Выбран и подтверждён WSL2 на Windows11, а не порт всего
стека на native Windows. Панель встроена в существующий Super Admin; права комнаты
не дают серверной статистики. Данные работающих серверов и production этим этапом не изменяются.

Рабочая копия: `/workspace/castlink-installer`, ветка `feat/server-one-command`.
Основа — фактически полученный приватный `origin/main` `255d9b38bb281bff7612d8ad00535c1e6f77f7ee`.
Прежняя `/workspace/studiolink` расходилась с приватной веткой; её уникальная история
и файлы сохранены. Названия удалённого GitHub проверялись реальным `git ls-remote`.

## Реализовано

- Linux: самодостаточный `install-server.sh` с точными pins, checksum/безопасной
  распаковкой, подготовкой зависимостей по явному флагу, init/start существующего
  helper, настоящим /dev/tty и сохранением работающей установки. Добавлен в Linux
  packager, SHA256SUMS и точный publisher asset list.
- Windows: PowerShell и выделенный WSL2-rootfs со службами PostgreSQL/web/LiveKit/
  Caddy/TURN443 и изолированным PPTX worker. Предусмотрены prerequisite/reboot,
  mirrored networking, scoped firewall, отказ от чужого состояния, keepalive,
  добровольный logon task, CA current-user consent, приватный owner-access.
- WSL отключает Windows disk automount/interop; службы скрывают /mnt,/media,/run/WSL.
  Приватные порты защищает отдельная nft table с эксклюзивным созданием; чужая таблица
  и занятые порты приводят к отказу до изменения правил.
- Super Admin: реальные комнаты/подключения/кастеры, CPU/RAM/диск/сеть, uptime/RSS,
  явные scope/нет данных/устаревание. Теперь хранение за 24 часа в приватном SQLite,
  фоновый сбор раз в 15 секунд независимо от панели, сохранение после restart.
  Структурированный журнал событий/ошибок с фильтром и страницами; лимиты размера,
  очистка секретов, 1/6/24h графики пиков, latest из необработанного замера.
- Пакет WSL: rootfs/source inventory, генерируемые pinned PowerShell-assets,
  фильтрация Docker-export identity, обязательные соответствующие Ubuntu/upstream
  sources с проверкой DSC и payload SHA256; private CI без публичной публикации.
- Инструкции RU/EN/简体中文 и release-candidate notes.

## Свидетельства этапа установщиков

Профильные Node/PowerShell suites, Linux tests, monitoring/auth/i18n и общий
TypeScript прошли. `test:ci` остановился на `output-source-quality.cjs:39`
(`false` вместо `undefined`); тот же отказ воспроизведён на неизменённом main в
`/workspace/castlink-baseline` с теми же закреплёнными зависимостями.

Реальная Dockerfile.web сборка прошла (Node22.23.3, Next15.5.27). WSL-rootfs
собрался: Ubuntu24.04, LiveKit1.13.7, Caddy2.10.2; systemd-analyze verify прошёл.
В изолированном Docker-стенде systemd действительно запущен; это проверка Linux
служб, не замена Windows/WSL испытанию. Genuine startup выявил и устранил AF_NETLINK
для LiveKit, execute-бит helper directory, неподдерживаемый promises.readFile(0)
в Node22 и отсутствие ALPN у IP HTTPS probe. Проверен полный HTTPS/DB/LiveKit/TURN
TLS/converter readiness, все8служб active. Команда stop ждёт все службы и отключает
target от boot; stopped status exit0/readyfalse. Повторный start включает target,
возвращает readytrue и сохраняет state/secrets/setup/owner-invite/user-data побайтно.
20 runtime tests проходят, включая настоящий локальный TLS ALPN regression.

Сквозной backend-тест через проверяемый HTTPS: гость metrics403; одноразовый owner
invite принят, owner metrics200; настоящий LiveKit вернул0комнат/0кастеров, две
точки реальных CPU/RAM и история подтверждены. URL приглашения/cookies не выводились.
Изолированный стенд не проверяет маршрутизацию WSL, публичный ACME и внешний relay.

Chromium desktop1366 и mobile390: настоящие локальные OS samples, no overflow,
readable labels, zero/null/gaps, hidden-tab polling; авторизация/overview в browser
proof подставлены только тестом. Actual unauth metrics route403/no-store.
Скриншоты `/tmp/server-monitor-desktop.png`, `/tmp/server-monitor-mobile.png`.

## Суточный мониторинг — текущий этап

Суточный мониторинг дополнительно проверен production-сборкой и настоящим
Node22.23.3: без HTTP появились 10 замеров, restart сохранил исходную точку,
сбор продолжился, оба API гостю 403. Профильные suites и браузерные проверки
desktop/mobile production CSP прошли. SQLite, worker и fatal-observer tests
повторены на Node22. Полный web CI снова остановился на прежнем output-source-quality.
Тестовый полный store (5760 точек + 20000 событий) ~6.5MiB; sample write ~2.7ms.
Подробные факты, лимиты и остаточное замечание счётчика пропусков:
[проверка суточной истории](testing/OBSERVABILITY_24H_20261111_RU.md).

## Что остаётся перед выпуском Windows WSL

Настоящая Windows11: WSL import/reboot/mirrored/firewall, CA consent, keepalive,
task logon/start/stop, внешний HTTPS, медиазвонок/forced TURN TCP443. Linux PowerShell
parser/fixtures этого не доказывают. Полный соответствующий-source release build
в CI также обязателен. Публикация не разрешена одним наличием новой private сборки.
Прерванный import до guest marker сохраняется для ручной проверки, без auto-adoption.

## Владельцы файлов и следующий шаг

Codex root — упаковка/сборка/документы/интеграция. GPT-6.1 Sol high: Linux bootstrap;
Windows installer; WSL runtime; monitoring. Независимый review — GPT-6.1 Sol high.
Спецификация и план: `docs/superpowers/{specs,plans}/2026-11-11-server-installation-monitoring.md`.
Продолжение: `docs/superpowers/{specs,plans}/2026-11-11-server-observability-24h.md`.
Следующий проверяемый результат: целевой Windows proof и полный release package
из чистого коммита перед распространением. Secrets и owner URLs не
записываются в git/логи/этот документ.
