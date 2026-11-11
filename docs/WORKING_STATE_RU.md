# Текущее состояние — сервер и суточный мониторинг, 11.11.2026

## Серверный выпуск 1.0.2

Основной публичный репозиторий — `resokol/castlink`. PR #18 с установщиками и
суточным мониторингом слит после успешного полного GitHub CI. Исходный коммит
серверных пакетов и архива исходников: `78327495ead06f3d74902cf0c60a7973a0828f2e`.
Windows Client остаётся 1.0.0. Ссылки и точные build/source IDs — в
[каталоге продуктов](../distribution/PRODUCTS.md).

Linux и обычный Windows Server Setup 1.0.2 собраны штатным producer на Windows11
через Docker Desktop из отдельного чистого checkout. Проверены настоящие
PostgreSQL/HTTP/TURN smoke, Windows Framework/WPF launcher и recovery fixtures.
Аудит всех слоёв: 5 образов, 37 слоёв, 20570 файлов, приватных файлов и исходников
приложения в распространяемых слоях не обнаружено. Linux bootstrap проверен
как сгенерированный release asset через настоящий `bash` pipeline.

Сторонние source inputs восстановлены из прежнего опубликованного source asset:
1004 основных и 348 дополнительных файлов повторно сверены с неизменёнными
текущими manifests и индивидуальными SHA256. Старые внешние URL могут возвращать
404; проверки состава, версий и bytes не ослаблялись. Каждое направление имеет
свои 7 assets и SHA256SUMS. ZIP/TAR собственных исходников содержат одинаковые
1961 Git blob; manifest фиксирует commit/tree, версии и контрольные суммы.
Publisher сначала загружает draft, сверяет GitHub asset size/digest с локальными
файлами и только затем открывает release. Ссылки в main обновляются после этой
проверки. Публикация пакета сама не обновляет установленный сервер.

Локальный Windows-сервер обычного Server Setup использует Docker Desktop.
Windows без Docker/WSL2: полный кандидат1.0.2-rc.3 собран из чистого `8e302887`
в [PR #20](https://github.com/resokol/castlink/pull/20). Старые apt/pcre2 обновляются
из тех же APT indexes; реальная offline проверка всех190 source версий дала
RED на старом образе и GREEN на новом. Все corresponding sources, package audit,
SHA256 восьми файлов и запуск Windows installer -Help проверены. CI58 прошёл для
первого closure-fix `0ce26451`; CI60 для исправленного Windows `8e302887` выполняется.
Первый реальный Install rc.2 остановился до сети/import: WinPS5.1 получает WSL
--version с NUL и ошибочно отклонял установленный3.0.1.0. Однострочное исправление
и новая fixture прошли actual Windows RED→GREEN; genuine Initialize теперь проходит.
Пользователь прошёл mirrored/firewall prompts. QA-дистрибутив импортирован, но
rc.3 остановился до guest marker/init: в Docker-derived Ubuntu отсутствуют
libpam-systemd/dbus-user-session. Их точная диагностическая установка только в
новый failed QA guest и повторный boot дали root session active, bus socket и
нулевой stderr. Artifact rc.3 не менялся; для пользователя нужен новый rc.4.
Также исправляется путь wslinfo на реальный /usr/bin/wslinfo. Node8 и runtime20
PASS; Windows fixtures и genuine canonical mode probe PASS.

Службам возвращён только read-only DNS resolver через tmpfs /mnt; Windows mounts
скрыты, converter сохраняет полную изоляцию. Настоящий systemd sandbox test дал
RED PermissionError на старом правиле и GREEN readable/EROFS/другие mounts скрыты
на новом (с приватным synthetic resolver, не доказательство внешнего DNS).

Остаётся отдельный Windows/WSL GNS blocker: direct guest и --system видят только
lo с DNS-tunnel address, /mnt/wsl/resolv.conf отсутствует. Shared mirrored setting
и два named firewall rules уже применены; CA/пароль/init ещё не выполнялись.
После свежей проверки двух известных registrations и нуля running workloads
вручную остановлена пустая VM один раз; это не автоматическое действие installer.
Сеть не восстановилась. VPN/адаптеры/HNS и общие firewall policy не менялись.
Следующий шаг: новый проверенный пакет и Windows reboot с локальным участием
пользователя перед продолжением target install. Не запускать перезагрузку молча.
Полный Windows Install, firewall/CA, keepalive, HTTPS и внешний TURN ещё не
подтверждены; публичного WSL release нет.
[Размеры, хеши и порядок испытания](testing/WINDOWS_WSL_20261111_RU.md).

Реализация/публикация — Codex root и GPT-6.1 Sol high; независимое ревью — Sol high.
Подробные проверки суточной истории:
[OBSERVABILITY_24H_20261111_RU.md](testing/OBSERVABILITY_24H_20261111_RU.md).

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
