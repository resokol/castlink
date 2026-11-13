# Текущее состояние — нативная статистика и node2, 13.11.2026

## Активная задача

Пользователь уточнил интерфейс: компактные показатели, графики и быстрый ZIP за
24 часа нужны в штатном окне Start/Stop/трей. Отдельный веб-экран `/super-admin`
удаляется; по прежнему адресу остаётся только принятие одноразовой ссылки
владельца с переходом на `/servers`. Серверная авторизация и API сохраняются. Исходники новой
панели и удаления страницы находятся в ветке `feat/native-server-statistics`,
ещё не выпущены. Интеграция в новый WSL-пакет добавлена и проходит проверку;
исходный RC8 не меняется.

Windows PowerShell 5.1: настоящая control fixture с WPF/WinExe прошла после
исправления очередей управления и экспорта (22588): polling, экспорт и управление
службами не конкурируют за lock, Stop имеет приоритет, закрытие окна не запускает
ожидающую выгрузку, ненулевой код дочернего процесса сохраняется. Финальный installer
прошёл полный WinPS-набор27052: размещение/checksums/binding, выбор native/legacy
task и настоящий дочерний WinPS compiler-wrapper (csc в этой fixture не вызывается). Bridge fixture8308 прошла ACL/DPAPI, owner authorization, отказ403,
ZIP/CSV/JSONL, null/zero и пагинацию. Это не доказательство настоящего GUI cutover
или автозапуска при входе. Нативный EXE собран в новой Node2-установке; binding
проверен (4012), службы/ярлыки/задачи этим staging не запускались.

`node2.castlink.ru` и `turn.node2.castlink.ru`: публичные A=94.29.40.190, AAAA нет.
Новая установка оригинального неизменённого RC8 дошла до активных служб, но
HTTP01 центра сертификации получает timeout на TCP80. Прямой запрос внутри
своего WSL получает301, порт80 слушается, Hyper-V правило CastLink разрешает80.
Независимая проверка извне во время запуска дала такой же timeout
([run43403202028](https://github.com/resokol/castlink/actions/runs/43403202028)).
Пользователю отправлена просьба проверить TCP80 → 192.168.1.8:80 в роутере.

Попытка2 сохранила санитизированный live journal до остановки и откатилась:
старый сервер/его task/восемь конфигурационных файлов восстановлены 09:42:49UTC.
Позднее дополнительный Status обнаружил остановленный keeper и отключённую
старую task. Штатный Start8564 и Status6236 подтвердили ready/все8active/desiredtrue,
но к09:55:35 снова записано desiredfalse, taskdisabled. Источник повторной
остановки не установлен; пользователю задан вопрос о ручном Stop или параллельной
настройке. Повторно не включать/запускать наперекор неизвестному оператору;
текущее состояние старого сервера нельзя называть стабильно работающим.
Новая установка сохранена в фазе imported; пароль пользователя не запрашивали,
не сбрасывали и не переносили в открытом виде. Новых Docker images не создавали.
RC8 release443272174 остаётся draft/prerelease, не опубликован. Показ нового
GUI, настоящий экспорт, media и окончательный takeover/autostart ещё не проверены.

Следующий шаг: после подтверждения сетевого исправления проверить HTTP80 извне,
возобновить именно сохранённую новую установку с новым журналом попытки; затем
HTTPS/TURN/media, реальное окно/трей/экспорт/Start/Stop и только после этого
передать автозапуск новой панели. Исходный пакет/старые данные сохраняются.

## Проверенные предыдущие этапы

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
Windows без Docker (WSL2): кандидат1.0.2-rc.6 из `9f87ea20` прошёл полный первый
Install на Windows11, HTTPS/API/PPTX и запуск настроенной logon task.
Исправления находятся в [PR #20](https://github.com/resokol/castlink/pull/20).
Ранее полныйrc.4 был собран из `61ce65a2`. Старые apt/pcre2 обновляются
из тех же APT indexes; реальная offline проверка всех190 source версий дала
RED на старом образе и GREEN на новом. Все corresponding sources, package audit,
SHA256 восьми файлов и запуск Windows installer -Help проверены. CI58 прошёл для
первого closure-fix `0ce26451`; CI63 для `61ce65a2` также прошёл.
Первый реальный Install rc.2 остановился до сети/import: WinPS5.1 получает WSL
--version с NUL и ошибочно отклонял установленный3.0.1.0. Однострочное исправление
и новая fixture прошли actual Windows RED→GREEN; genuine Initialize теперь проходит.
Пользователь прошёл mirrored/firewall prompts. QA-дистрибутив импортирован, но
rc.3 остановился до guest marker/init: в Docker-derived Ubuntu отсутствуют
libpam-systemd/dbus-user-session. Их точная диагностическая установка только в
новый failed QA guest и повторный boot дали root session active, bus socket и
нулевой stderr. Artifact rc.3 не менялся; новый rc.4 уже построен и проверен.
Также исправлен путь wslinfo на реальный /usr/bin/wslinfo. Node8 и runtime20
PASS; Windows fixtures и genuine canonical mode probe PASS.

Службам возвращён только read-only DNS resolver через tmpfs /mnt; Windows mounts
скрыты, converter сохраняет полную изоляцию. Настоящий systemd sandbox test дал
RED PermissionError на старом правиле и GREEN readable/EROFS/другие mounts скрыты
на новом (с приватным synthetic resolver, не доказательство внешнего DNS).

Сетевой блокер Windows/WSL устранён: после отдельно согласованного DWORD
DisabledComponents0xFFFFFFFF→0x20 и полной пользовательской перезагрузки
LastBootUtc2026-11-12T06:25:08.5000000Z позже Apply06:16:23.5088677Z;
независимый readback остаётся32. Actual guest probe видит обычные NIC, default
route, /mnt/wsl/resolv.conf и разрешает archive.ubuntu.com. Этот контроль прошёл
при выключенном Docker Desktop. Повторять registry Apply или пересобирать rc.4
не требуется; старые QA state/VHD сохранены.

По прямому поручению пользователя завершена очистка накопленных Docker-сборок:
исходная inventory92images/66.27GB и773cache records/78.07GB (shared bytes нельзя
складывать). Удалены11 точных manufacturer images пяти подтверждённых WSL commits;
готовые package/source archives и audit receipts сохранены вне Docker. Очистка
остальных старых сборок использует producer ownership labels, проверенные Git
source IDs и защиту всех running/stopped container refs. Тома/данные не удаляются;
общий system prune и force image removal запрещены. Удалены59 images:
осталось33/21.75GB. Scoped cache сократился до263records/20.15GB;
все11 containers сохранены,13volumes не изменялись. После TRIM Docker остановлен;
штатный offline DiskPart compact только data VHD завершился exit0. Размер
132404740096→48391782400 bytes, Windows D: получил84012957696 bytes (84.0GB).
Docker после compaction повторно открыт: все11 container/image refs,13volumes,
8foreign image IDs, stable1.0.2 и текущий audio candidate сохранены; receipt PASS.

**Постоянное правило сборщика:** после успешного экспорта и проверки артефактов
удалять собственные временные Docker images и относящийся к сборке cache в этом же
рабочем сеансе, затем измерять остаток. Сохранять текущий stable, изображения всех
контейнеров (включая stopped), чужие/unattributed ресурсы и все данные/тома. Не
накапливать новый image tag на каждый commit без завершённой scoped cleanup.

Диагностическая Windows/WSL установка завершилась exit0: phase=ready,
autoStartAtLogon=true. Пользователь сам ввёл скрытый пароль и отдельно подтвердил
CA/автозапуск; CA присутствует в CurrentUser Root. Все8 служб active, runtime
ready=true/https-db-livekit-verified. Настоящий isolated PPTX worker вернул200/PDF,
9724bytes. Данные/пароль не сбрасывались; Docker выключен, новых images не создавали.

Проверены platform fixes: WinPS trailingASCIIspace keepalive и provider Set-Acl
исправлены вfa396558 (actual Windows RED→GREEN). Теперь выявлены и проверены
ещё два: mirrored WSL ведёт localhost черезloopback0, поэтому старыйprivate-port
nftdrop блокировал PG/LK; узкоеaccept толькоloopback0+src/dst127.0.0.1+/32+6TCP
ports передoriginaldrop дало actualRED→GREEN→rollbackRED, финальныйcounter16.
PG/LKconnectPASS, нелокальныйsource→127.0.0.1 остаётсяblocked; это не доказательство
внешнегоLAN. Первая logon registration создала ровно нужнуюtask/stagedbytes, но
Windows сериализовала principal/trigger как accountname. КанонизацияSID принимает
только ту же учётную запись. Actual WinPS suite RED→GREEN,21runtime tests PASS,
Sol high review обоихdiff без замечаний. Diagnostic completion сохраняла прежние
pinned/stagedbytes+taskhash и использовала новыйAssert/SIDhelper; неизменённыйrc.4
release installer целиком не объявлять проверенным. Полноценный пакет с fixes
нужно собрать позже, после integration; обязательная cleanup после export.

Пользователь отдельно разрешил общий `hostAddressLoopback=true` и перезапуск
только CastLink. Настройка добавлена с резервной копией; другие WSL-дистрибутивы
не работали и не останавливались. После штатного Stop и terminate своего guest
общая VM завершилась сама за63.3s; глобальный shutdown не использовался. Существующая
проверенная logon task запустила сервер: новый keeper, phase=ready, task=Running.
Windows LAN:443 изменился с timeout на connectPASS. Все8 fingerprints конфигурации,
identity, секрета и пароля совпали после холодного stop/start.

Настоящий HTTPS API на Windows (system CA roots, HTTP/1.1 ALPN, без bypass):
metrics/events guest403, owner200, повтор invite401; scope=wsl, retention86400000,
storage=ok, samplerRunning=true, history52points. В WinPS5 HttpWebRequest нет нужного
ALPN для IP+TURN multiplex; curlSchannel требует CRL для privateCA. Поэтому proof
использует Node24 --use-system-ca с явным HTTP ALPN, не отключение TLS/revocation.
После закрытия своего controller сервер95.138s отвечал200 (8samples) без WSL-вызовов,
keeper PID/time не менялись. Обычное окно Chrome (без DevTools/CDP) приняло private
invite и показало5 настоящих графиков/журнал; проверены1366×900 и390×844. Скриншоты
только собственного окна и receipts хранятся в приватном QA-каталоге. Chrome policy
RemoteDebuggingAllowed сохранена. Пароль и owner URL никогда не выводились.

Source installer теперь проверяет оба shared settings до записи, требует явного
согласия, сохраняет байты/BOM и отказывает при конфликтах/работающих дистрибутивах.
После записи останавливает Install до активации WSL и повторной команды. Start
не запрашивает ввод и не меняет отсутствующие shared settings. Actual WinPS suite
PASS; manifest объявляет hostAddressLoopback, инструкции RU/EN/zh-CN синхронизированы.
Реализация helper/fixtures — Sol high; ревью и native Windows proof — Codex root.

Далее — новый пакет из чистого текущего source с этими исправлениями, сборка на
GitHub Actions вместо новых Docker images на ПК. Первый factory43193869966
для0741e62b прошёл Windows/tests и построил rootfs с190 source versions, но сборка
упаковки упала на старом upstream404. Workflow теперь скачивает опубликованный
архив1.0.2 по закреплённым1448015378bytes/SHA256e755…1f25c; импортирует только
текущие manifest paths после отдельной проверки size/SHA каждого файла. Старые
fetch/runtime checks сохранены. Python13 и Node8 PASS. Factory43196993237
для506b36e9/rc.5 прошёл; на Windows проверены8 SHA256, весь source/runtime audit
и побайтно идентичная повторная упаковка из чистого checkout.

Первый полный Install неизменённогоrc.5 в новом временном guest дошёл до8active
служб/ready и экспорта CA, но owner-access отказал. Причина: parent start сохраняет
свою старую копию state после systemd bootstrap и затирает databasePhase=seed
значениемnew. Actual state: completed=true/databasePhase=new; guard owner-access
сохраняется. Исправление перечитывает validated state, проверяет прежнюю identity
и completed bootstrap, меняет только completed/readiness. Regression воспроизводит
реальный disk bootstrap new→migrations→seed: RED→GREEN; runtime23/23 PASS,
package8/8 PASS. Исправление runtime и regression — Sol high; review/Windows/factory — Codex root.
Пробный guest штатно остановлен, прежний настроенный сервер восстановлен exit0;
все8 fingerprints прежних данных совпали. Originalrc.4/rc.5 archives не менялись,
новых Docker images на ПК нет.

Factory43205312805 успешно собралrc.6 из9f87ea20; CI verify этого source также
SUCCESS. На ПК подтверждены8 SHA256, полный source/runtime audit и byte-identical
reconstruction. Прямую большую загрузку оборвала сеть; authenticated HTTP206
докачка111частей завершилась совпадением полного GitHub ZIP digest и CRC.
Неизменённые generated installer/rootfs установлены с нуля: exit0/phaseReady,
8active служб, hidden QA password действительно совпал, owner metrics/events200,
guest403/replay401, retention24h/storageok/samplerRunning. Настоящий PPTX→PDF200
и TURN TLS443 STUN binding прошли без TLS bypass. Временный CA в Windows не добавлен.
Настроенная задача проверена по SID/action/hash, её actual Start дал новый keeper
и ready. Первый Status в harness поспешил до освобождения operation.lock;
исправлено только ожидание в приватной проверке, пакет не менялся. После закрытия
installer95s/8HTTPS200 samples прошли без WSL calls с тем же PID/starttime.
Все8 конфигурационных fingerprints нового guest сохранены после Stop/Start.

Временная task удалена, пробный guest остановлен; прежний настроенный сервер,
его task и обычное окно Chrome восстановлены. Его8 fingerprints также совпали,
HTTPS проверен через Windows system roots. Части/ZIP загрузки удалены после audit:
дополнительно освобождены7.388GB; готовые9assets и receipts сохранены. Docker OFF.
Реализация runtime/докачки — Sol high; review и native Windows QA — Codex root.
Внешний forced relay media и настоящий logon после нового Windows reboot не
проверены; текущая конфигурация LAN. Публичный WSL release/main не менялись.
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
