# Windows/WSL: сборка и испытание 11.11.2026

Проверяется отдельный сервер без Docker на Windows11/WSL2, согласно утверждённой
[спецификации](../superpowers/specs/2026-11-11-server-installation-monitoring.md).
Linux и Docker Server Setup 1.0.2 уже опубликованы и этим этапом не заменяются.

## Исправление полной сборки

Исходник кандидата: `0ce26451f886fb02aa3a293179e9f4b81488731d`,
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
перед этим нет. На первом наблюдении state phase=created, .wslconfig отсутствует:
установщик ожидает локального согласия на mirrored networking. Настройки и скрытый
ввод пароля подтверждает пользователь в этом окне; автоматического ответа нет.

Следующие обязательные результаты: import/первый Install, HTTPS/DB/PPTX и owner
доступ; история/события; сохранность после stop/start; keepalive90 секунд после
закрытия управляющей консоли без запросов wsl, которые сами запускают дистрибутив.
Перезагрузка/logon и внешний принудительный TURN TCP443 проверяются отдельно.
WSL-кандидат ещё не опубликован. Исполнитель — Codex root; независимый проверяющий
исходников — GPT-6.1 Sol high.
