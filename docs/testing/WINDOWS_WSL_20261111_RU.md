# Windows/WSL: сборка и испытание 11.11.2026

Проверяется отдельный сервер без Docker на Windows11/WSL2, согласно утверждённой
[спецификации](../superpowers/specs/2026-11-11-server-installation-monitoring.md).
Linux и Docker Server Setup 1.0.2 уже опубликованы и этим этапом не заменяются.

## Продолжение после локального согласия пользователя

Mirrored setting и named Hyper-V TCP/UDP rules применены пользователем. Import
успешен, но rc.3 завершился exit1 до создания guest marker и init: WSL пишет
Failed to start the systemd user session for root. Подтверждено отсутствие
libpam-systemd, dbus-user-session и /etc/pam.d/systemd-user. До диагностической
записи проверены registration BasePath своего QA guest, release8e302887 и отсутствие
app state. Точные два .deb сверены с SHA256 retained APT indexes и переданы offline
из Windows (guest DNS недоступен). После их установки и scoped terminate/boot:
root session active, /run/user/0/bus socket, stderr пустой. Это controlled probe;
готовый rc.3 archive не исправлялся и не должен использоваться для новой установки.

В producer добавлены эти пакеты с policy-rc.d101; packager требует PAM module и
user dbus.socket. Новый отрицательный package test дал RED missing rejection,
после guards — GREEN8 Node tests. Runtime20 и actual WinPS5.1 suite проходят.
Actual /usr/bin/wslinfo является symlink на /init и возвращает mirrored; прежний
путь /usr/lib/wsl/wslinfo отсутствует. Product и fixture исправлены RED→GREEN.

Старые networked units скрывали весь /mnt и вместе с ним WSL resolver symlink.
Шесть служб теперь используют TemporaryFileSystem=/mnt:ro и единственный optional
read-only bind /mnt/wsl/resolv.conf, сохраняя deny /media и /run/WSL. Converter не
менялся. Настоящий transient systemd unit с Caddy user/security properties и
приватным synthetic resolver воспроизводит старый PermissionError; новый вариант
читает resolver, получает EROFS при записи и не видит посторонний /mnt marker.
Это proof mount isolation, не внешний DNS. Sol high source review без замечаний.

Отдельно подтверждена общая проблема VM/GNS: и guest, и wsl --system видят только
lo (127 и tunnel address), без других IPv4 routes/NIC. /mnt/wsl tmpfs есть, resolver
target отсутствует. WSL3.0.1 source подтверждает: GNS настраивает сетевой стек по
notifications wslservice; это не Ubuntu networkd/udev. Automount=false не отключает
специальный shared mount; пустой manufacturer resolv.conf штатно заменён symlink.
Read-only Windows event-log probe доступных соответствующих ошибок не вернул.
Scoped terminate/natural idle и один manual empty-VM shutdown не восстановили сеть.
Перед последним сверены только два известных registrations (QA и stopped builder)
и running count0; installer по-прежнему никогда не делает global shutdown сам.
VPN, Windows adapters, HNS и общие firewall rules не менялись. Нужен Windows reboot
с участием пользователя; сначала подготовить новый artifact, если builder доступен.
Полный сервер ещё не запускался, пароль/CA/owner bearer не вводились и не выдавались.

Первый rebuilt rc.4 из6fb7d583 собрался, но audit остановил упаковку
по неверно заданному required path /etc/pam.d/systemd-user. Actual dpkg-query -L
libpam-systemd в самом image подтвердил PAM module в
/usr/lib/x86_64-linux-gnu/security/pam_systemd.so; пакет не содержит предполагаемый
config file. Guard и fixture теперь проверяют именно реальный обязательный module
и dbus.socket. Это исправление validation predicate, не обход проверки. Нужен
чистый новый source commit для окончательного artifact; исходный failed rootfs сохранён.

## Текущий пакет 1.0.2-rc.3

Чистый source commit `8e3028878d11f1b046a9f919868a1b2040725732`, tag в manifest
`server-wsl-v1.0.2-rc.3-8e3028878d11`. Новые web/rootfs собраны штатными Dockerfile;
реальная offline проверка190 source версий снова проходит. Новый packages.tsv
побайтно совпадает с rc.2. Архивы Ubuntu/upstream из таблицы rc.2 сверены целиком
по SHA256, а штатная assembleWslPackage повторно проверила новый rootfs, точный
inventory, каждый DSC/payload и upstream manifest. Проверки не пропускались.
Все8 файлов нового пакета повторно сверены с SHA256SUMS/manifest. Windows -Help и
genuine Initialize-CastlinkWsl из самого generated installer проходят, exit0.

| Новый файл | Размер, байт | SHA256 |
| --- | ---: | --- |
| CastLink-Server-WSL-amd64.tar.gz | 476267240 | `c8c57ab506330a0a79e148a6ff041577be4eb7676134ee7fd3ecc9d2bb4dff40` |
| manifest.json | 1143 | `25c75bb2d2a011a24070a2a0cf809d48d2805bc17543205f6e20ba69d51dcd9e` |
| install-server-windows.ps1 | 42505 | `b28db56bad2e3edbdce65a90fb7044d3854054ee3b89b04319dce2828f3393b1` |

Старое окно с failed rc.2 закрыто только после проверки command line собственного
завершённого QA controller. Его created-state сохранён. Для rc.3 открыт новый
QA-каталог и отдельная консоль. Наблюдение подтверждено содержимым только этой
консоли: `Add networkingMode=mirrored to .wslconfig? [y/N]`, phase=created,
attempt receipts=0, .wslconfig отсутствует. Это действительный pending consent,
а не предположение по одному phase. Пароля/owner bearer ещё не вводили; import,
firewall/CA и работа служб не подтверждены. Никакого автоматического ответа нет.
CI60 для `8e302887` выполняется; CI58 относится к исходному closure-fix `0ce26451`.

## Исправление полной сборки

Исходник предыдущего кандидата: `0ce26451f886fb02aa3a293179e9f4b81488731d`,
версия `1.0.2-rc.2`, [PR #20](https://github.com/resokol/castlink/pull/20).
Producer использует отдельный чистый checkout с LF, Windows11 build26100.9457,
WSL3.0.1 и Docker Desktop только для изготовления пакета.

Предыдущая сборка остановилась на получении точных Ubuntu sources: базовый образ
оставил apt2.8.3 и pcre2=10.42-4ubuntu2.1, которых уже нет в текущих source indexes.
Новый offline integration test запущен на настоящем прежнем rootfs: из190 source
версий отсутствуют ровно эти две, exit1. После обновления остаточных пакетов базы
из тех же APT indexes настоящий новый rootfs проходит проверку:190 версий,
missing=[], exit0. Проверка встроена в producer до export/download. Подстановка
других source версий, пропуск DSC или ослабление SHA256 не применяются.

Node packaging/source suites:7 проверок PASS. Runtime:20 PASS. Export:1 PASS.
Независимое ревью GPT-6.1 Sol high замечаний к патчу не нашло. Это не доказательство
установки на Windows. Новый rootfs успешно собран и экспортирован.

GitHub CI58 для этого коммита прошёл полностью: run43076996199. Первый полный
source stage прерван на liborcus=0.19.2-3build3 из-за Connection failed; это не
отсутствующая версия. HTTP/HTTPS HEAD затем вернули200, и настоящий apt-get source
для того же пакета в одноразовом контейнере того же rootfs скачал все3 файла,
exit0. Повторён только source target того же Dockerfile с теми же аргументами;
готовые rootfs/upstream/inventory сохранены. Итоговая штатная assembleWslPackage
успешно проверила все исходники и inventory перед созданием пакета. Source resume
завершён с exit0. Повторная проверка SHA256 всех8 файлов и реальный Windows
PowerShell -Help сгенерированного установщика прошли.

| Файл | Размер, байт | SHA256 |
| --- | ---: | --- |
| CastLink-Server-WSL-amd64.tar.gz | 476263940 | `9241bbc0f2c81d0bbd9432a423065e57a416d9fcf7e7818081946d3abe45cc82` |
| CastLink-Server-WSL-Sources.tar.gz | 1845669617 | `262c522a8f4cbe6a4035691f78b18db94ac2ce82d1b05c2002c9fa5066aa66b4` |
| CastLink-ThirdParty-Sources.tar.gz | 1448015378 | `ea8dda60622faaba340ed5dafe3ee97342168dded141a1d45e312f3d5cd8b198` |
| manifest.json | 1143 | `dfc1e6de9ff2c2922aa1cdc3f82af68009b1addada40a389ff2074260dbe2efb` |
| install-server-windows.ps1 | 42483 | `925b29a917a1a1679702f1579eeae5f9d5592fef1ca3ab3c2b758b54bb0f8179` |

Тег в manifest: `server-wsl-v1.0.2-rc.2-0ce26451f886`; публичного release нет.
В пакете8 файлов плюс SHA256SUMS. Установщик получает только rootfs/manifest;
source archives доступны отдельно. Аудит запрещает Docker binaries, installation
secrets и producer identity в runtime, сверяет release и Windows-drive isolation,
все source descriptors/payloads и1004 upstream inputs.

## Реальное Windows испытание

До установки: подходящие Windows/WSL есть, запрошенные TCP порты свободны;
существующих установок в стандартном LocalAppData-каталоге нет. Рабочие проекты
и прежние серверные данные сохраняются. Перед запуском QA настройки WSL,
firewall и CA не менялись.

Обычный DC stdin не является TTY. Первую установку необходимо запускать настоящим
Windows PowerShell в отдельной консоли, с generated pinned installer и готовым
PackageDirectory. Пароль вводится скрыто в гостевом терминале; предварительный
guest init через password-file не считается доказательством первого полного Install.
Сам пароль и owner bearer не читаются через stdout инструментов и не публикуются.

Перед испытанием закрывается только использованный сборщик Docker Desktop, после
свежей проверки отсутствия работающих контейнеров. Глобальный wsl shutdown не
используется. Mirrored networking требует явного согласия в штатном установщике;
firewall — штатного administrator consent. CA current-user и logon task являются
отдельными явными предложениями установщика.

После успешной проверки пакета открыта отдельная консоль настоящего Windows
PowerShell с generated installer, PackageDirectory и новым QA-каталогом внутри
LocalAppData. Docker Desktop сборщика штатно остановлен, работающих контейнеров
перед этим нет. Первый Install завершился exit1 до mirrored networking/import:
WSL3.0.1.0 ошибочно сочтён устаревшим. phase=created не доказывает ожидание prompt;
необходимо проверять receipt дочернего процесса. Сообщение прочитано только из
собственной консоли, до ввода пароля. .wslconfig, firewall и CA не менялись.

Actual WinPS5.1 native probe: WSL --version exit0, containsNul=true,
rawRegexVersion пусто, после удаления NUL —3.0.1.0. Однострочная нормализация
перед прежней regex сохраняет minimum2.4.13. Новая behavioral fixture сначала
воспроизвела отказ на старом шаблоне, затем весь Windows suite прошёл на исправленном.
Проверены обычный/NUL current, NUL minimum, старый2.4.12 и malformed отказ.
Настоящий Initialize-CastlinkWsl с actual wsl.exe после исправления проходит без
изменения сети. Node package suites7 PASS; независимое Sol high review без замечаний.
Новый pinned пакет из чистого исправленного коммита (rc.3) построен и проверен
выше; Ubuntu/upstream повторно использованы через штатный audit точного нового
inventory, DSC и payload SHA256. rc.2 больше не использовать для Install.

Следующие обязательные результаты: import/первый Install, HTTPS/DB/PPTX и owner
доступ; история/события; сохранность после stop/start; keepalive90 секунд после
закрытия управляющей консоли без запросов wsl, которые сами запускают дистрибутив.
Перезагрузка/logon и внешний принудительный TURN TCP443 проверяются отдельно.
WSL-кандидат ещё не опубликован. Исполнитель — Codex root; независимый проверяющий
исходников — GPT-6.1 Sol high.
