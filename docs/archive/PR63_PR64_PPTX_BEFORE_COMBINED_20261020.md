# Историческая подготовка перед общим выпуском PR63/PR64/PPTX

Эти записи описывают отдельные кандидаты до объединения; не являются подтверждением текущей установки.

# Паритет Windows UI с Timeweb — подготовлен к PR 20.10.2026

Панель слайдов Windows приведена к компактному browser PiP сайта: графит, нейтральные стрелки, зелёное управление, нижний статус/STOP и отдельное сообщение ошибки. Runtime source ce6a02b89bd0, ветка fix/client-control-ui-parity-pr-20261020 отправлена в приватный resokol/studiolink по явному разрешению пользователя «Да готовь pr к деплою». PR63 https://github.com/resokol/studiolink/pull/63 открыт без конфликтов на актуальном main fe300b3; приложения побайтно совпадают с ce6,83tests повторно PASS. GitHub CI не стартует из-за Billing/spending limit (run39445357613, steps=[]), не является PASS; merge, публичный выпуск и production deploy не выполнялись. Только desktop UI/геометрия и профильные тесты; серверный web/backend и медиаправа не менялись.

83desktop/11actualElectron/21renderchecks PASS. Native/browser dark/light RU/EN/ZH280–340px, owner/recipient/menu/error/100participants просмотрены; guardian GPT-6.1 Sol high PASS. Windows portable/NSIS/ZIP sourcece6: ASAR30files/setup20entries/3archive integrity/resourcebytes/SHA PASS; portable запуск/отвечающее окно PASS. Проверенные пакеты локально в artifacts/desktop/ce6a02b89bd0; пользовательский EXE backups/client-ui-parity-20261020/CastLink.exe. Native theme остаётся по механизму ОС. Physical PowerPoint/эфир/NSIS install не проверены. Подробности: docs/testing/CLIENT_CONTROL_UI_PARITY_RU.md. Root владеет UI/сборкой/docs; guardian — независимой проверкой. Следующее: review/merge PR, затем выпуск Windows-клиента из принятого source; для применения закрыть старый клиент и открыть новый EXE. Серверный deploy для этой native UI-правки не нужен.

# CastLink: установленный общий выпуск — 20.10.2026

## Новый кандидат: изолированное открытие презентаций
Ветка `fix/presentation-isolated-converter-20261020`, отдельный checkout `D:/GitHub/SL/castlink-presentation-universal-20261020`. Причина пользовательского PPTX воспроизведена: статический SVG отклонялся семантическим allowlist. Новый worker без сети/данных/credentials преобразует обычные PPTX в PDF; прежний PDF.js и гостевой admission/SID сохранены. Установленный runtime этим заданием не менялся.
Проверено: исходник → реальный UDS/Office →6страниц → PDF.js6.4.299 все6отрисованы; worker19Docker PASS; TypeScript EXIT0; generators6/Linux14/Node29+skip1/Windows lifecycle PASS; production image build/runtime smoke PASS; compiledHTTP FormData/delayed/buffered200 по6страниц,403/422/maintenance/aliases PASS.
Независимый GPT-6.1 Sol high выявил forgedZIPsize и reaping дочерних процессов; оба закрыты full-stream inflate и init:true, RED→GREEN + реальный spawned-child timeout. Исполнение: root worker/client/docs/E2E; GPT-6.1 Sol high integration/runtime и отдельное review/LinuxCI.
Итоговый Linux webCI:262PASS/exit0; worker19PASS, Linux install5PASS+1Windows skip; exact1590blobs/tree25e41f63d96cb63b40e9496f0cabb449d904d754. Следующее: решение об установке проверенного изменения на рабочий сервер. NativeCLI legacy требует converter/socket; cancellation bounded30s, не мгновенный. [Подробные доказательства и границы](testing/PRESENTATION_ISOLATED_CONVERTER_RU.md).

На https://castlink.ru установлен web build `1.0.0-rc.3-1de5b686d719`, source `1de5b686d719c5ab7b813fe2f772fd41a501ff05`. Private main содержит оригинальные PR60/PR61 и browser-панели; оба PR merged. Дальнейший commit только документации не меняет этот runtime source. Public latest: https://github.com/resokol/castlink-releases/releases/tag/easy-setup-1de5b686d719,9полностью проверенных файлов; инструкции RU/EN/zh-CN синхронизированы, исходники приложения приватные.

Включено: прежний дизайн и презентации/native панели, Linux/Windows installers, staff customcamera размеры/FPS (с720/1080/default1080), role-first web/Windows entry и castlink: invitations, draggable/Document PiP панели сайта с независимыми STOP/слайдами. Portable handler указывает на постоянный EXE. Промостраница сохранена; приложение: https://castlink.ru/?name=.

Проверено:262webCI, TSCweb/CLI,83desktop,5images/runtime/audit, serverpackages+3Electron archives,9полных download SHA256, actualbrowser16floating/12ASAR/65production-routeAPI-fixtures и33точных externalassets/anonymousPOSTguards. Независимые reviews PASS/P1/P2нет. [Полный delivery record](testing/COMBINED_PR60_PR61_RELEASE_RU.md).

Web-only установка: проверенный backup, exact room/identity/SID на всех барьерах, в момент commit7→7sessions/4→4tracks. Env values/runtimepassword/mounts/limits/всяinfrastructure сохранены; maintenance отсутствует. SQL/forcedreload/prune не выполнялись. Более поздняя активность участников менялась отдельно; не утверждать вечную неизменность состава по receipt. QA/receipts: `D:/GitHub/SL/castlink-entry-final-release-20261020-qa`.

Новый Windowsклиент скачивается вручную после полного закрытия старого; self-updater25a922f не включён. Физические PowerPoint/OS focus/fullscreen, camera/broadcast, NSIS install/OS protocol E2E не проверены; EXE unsigned, установленный профиль пользователя не менялся. Следующее — пользовательская приёмка на реальном рабочем месте. Не повторять успешный deployment по старым input.

Root владел integration/docs/publish/deploy/browserQA; GPT-6.1 Sol high: integration_review — frontend/offlinehelper; pr60_integration — PR60/61/CI/pre/postreview; release_inventory — source review/artifacts. [Исторический handoff](archive/WORKING_STATE_BEFORE_PR60_PR61_20261020.md), [инварианты](CRITICAL_INVARIANTS_RU.md), [дизайн](../DESIGN.md).


---

# CastLink: установленный общий выпуск — 20.10.2026

## Компактные слоты кастеров — 20.10.2026, PR64 и подготовка web-only деплоя

Владелец согласовал компактный макет, затем поручил загрузить PR и подготовить деплой. PR: https://github.com/resokol/studiolink/pull/64 ; ветка feat/compact-caster-slots, worktree C:/Users/Max/Projects/studiolink-slots-ui. Изменение перенесено поверх main fe300b3; PR60/61 и плавающие панели сохранены. Основной агент владеет кодом/публикацией, независимое ревью — GPT-6.1 Sol high slots_pr_review.

Согласованы выровненные строки, реальные статусы/счётчики, камера/экран/инвайт с копированием, создание в шапке и доступная шестерёнка. Container queries учитывают ширину панели. Ревью выявило перекрытие Release/settings на621–640px: minimum assignment354px исправлен,22 width/state повторных проверок PASS, оставшихся P1/P2 нет. API/SQL/admission/маршрутизация/URL/медиа не менялись.

Проверки текущего кода: TypeScript PASS; PASS: 262 stable CI tests; production Docker build и runtime files/dependencies/PostgreSQL migrations+seed/HTTP/design-assets/maintenance на отдельных одноразовых контейнерах PASS, cleanup подтверждён. Изменённые slot JS/CSS найдены в фактическом immutable image. Ранее actual component Chromium:12 width/theme/locale и10sidebar/edge случаев PASS, визуально просмотрены desktop/mobile/expanded настройки. Windows общий прогон остановился на production-deployment.cjs из-за отсутствующего Bash в WSL; полный прогон повторён без пропусков в Linux/Node22. Для каталога файлов теста temporary index содержит точные paths Gitarchive, dependency symlinks исключены; это не поддельный release commit.

GitHub CI run39445380350 НЕ стартовал: annotation сообщает failed account payments/spending limit, steps[]. Это внешний блокер hostedCI, а не PASS. Рабочий production не менялся. Read-only HTTPS на20.10 подтвердил version/buildId1.0.0-rc.3-1de5b686d719. Public release не создавался, merge/deploy не выполнялись.

Кандидат: source0f2d867927beddcd174de09ea7bb4a7e44cc603e, tree4ead1ec26381d5fe80d29dee470ad1bf86f1b485; release1.0.0-rc.3-slots-0f2d867927be, imagecastlink-web:slots-0f2d867927be. Image ID sha256:951a46a07b24088d0079d0fe88c8aa0fc8b392c83577797919ddadf67c31fe8b. Gitarchive SHA256 52943db4bfd9e90354ffd64a3a9be6b204b91373c4ee4d45ccaa9a0cabbd886a. Архив C:/Users/Max/Projects/slots-ui-deploy/slots-0f2d867927be.image.tar.gz (270772745bytes), SHA256 b99521ae7c96e1d11ac558514fc2df41c076a07dc74d59a3e02f68cea0d2e390. После кандидата допустим только documentation-only follow-up: перед установкой сверить отсутствие изменений runtime inputs относительно0f2d867. Артефакты/receipts приватные, не для публичного репозитория.

Порядок установки и отката (подготовлен, не выполнен):
1. Закрыть hostedCI-blocker/решение по интеграции, проверить exact PR/source/image/архив SHA. До установки заново снять version/current web image+container и authoritative room/identity/SID/track snapshot. При изменении исходного runtime или состава — пересмотреть preflight; не считать исторические7sessions текущими.
2. Сохранить текущие web image и полную конфигурацию без печати секретов; выполнить и проверить pg_dump, web-data/config backup с durable checksum receipt. Сверить ENV values, mounts, limits и все infrastructure IDs. Текущий ожидаемый rollback runtime1.0.0-rc.3-1de5b686d719/image90dca4943f181d367e9676c161d377bff7dee049f1acc67b2330c598c436540f — это предыдущий проверенный record; фактический ID подтвердить перед установкой.
3. Доставить архив, проверить SHA256, docker load и exact imageID. Обновить только фактический web service по текущей установке, сохранив config/секреты/data и инфраструктуру. Не запускать SQL, installer, prune, forcedreload, kick или изменение OBS/vMix URL. Следовать существующим active-session/maintenance guards из delivery record PR60/61.
4. Проверить health, exact /api/version, JS/CSS, авторизацию и слот-панель; повторно сверить authoritative sessions/tracks и infrastructure/config. Страницы обновлять вручную вне эфира. Физический RTC/операторский эфир этими source/API fixtures не подтверждён.
5. При отказе вернуть сохранённый exact web image через тот же service/config, проверить прежний version/health и sessions. Данные и инфраструктуру не откатывать вслепую; SQL в этом изменении отсутствует.

Доказательства: C:/Users/Max/Projects/slots-ui-deploy/candidate.json, predeploy-receipt.json, linux-web-ci-result.json, linux-web-ci.log, runtime-smoke.log, image-build.log, checksum; C:/Users/Max/Projects/slots-ui-proof/browser-results.json, edge-results.json, overlap-review-results.json и PNG. Временная QA-страница удалена, devсервер остановлен. Следующий шаг — согласованная интеграция/установка проверенного web image; сейчас это подготовка.

## Текущий установленный выпуск

На https://castlink.ru установлен web build `1.0.0-rc.3-1de5b686d719`, source `1de5b686d719c5ab7b813fe2f772fd41a501ff05`. Private main содержит оригинальные PR60/PR61 и browser-панели; оба PR merged. Дальнейший commit только документации не меняет этот runtime source. Public latest: https://github.com/resokol/castlink-releases/releases/tag/easy-setup-1de5b686d719,9полностью проверенных файлов; инструкции RU/EN/zh-CN синхронизированы, исходники приложения приватные.

Включено: прежний дизайн и презентации/native панели, Linux/Windows installers, staff customcamera размеры/FPS (с720/1080/default1080), role-first web/Windows entry и castlink: invitations, draggable/Document PiP панели сайта с независимыми STOP/слайдами. Portable handler указывает на постоянный EXE. Промостраница сохранена; приложение: https://castlink.ru/?name=.

Проверено:262webCI, TSCweb/CLI,83desktop,5images/runtime/audit, serverpackages+3Electron archives,9полных download SHA256, actualbrowser16floating/12ASAR/65production-routeAPI-fixtures и33точных externalassets/anonymousPOSTguards. Независимые reviews PASS/P1/P2нет. [Полный delivery record](testing/COMBINED_PR60_PR61_RELEASE_RU.md).

Web-only установка: проверенный backup, exact room/identity/SID на всех барьерах, в момент commit7→7sessions/4→4tracks. Env values/runtimepassword/mounts/limits/всяinfrastructure сохранены; maintenance отсутствует. SQL/forcedreload/prune не выполнялись. Более поздняя активность участников менялась отдельно; не утверждать вечную неизменность состава по receipt. QA/receipts: `D:/GitHub/SL/castlink-entry-final-release-20261020-qa`.

Новый Windowsклиент скачивается вручную после полного закрытия старого; self-updater25a922f не включён. Физические PowerPoint/OS focus/fullscreen, camera/broadcast, NSIS install/OS protocol E2E не проверены; EXE unsigned, установленный профиль пользователя не менялся. Следующее — пользовательская приёмка на реальном рабочем месте. Не повторять успешный deployment по старым input.

Root владел integration/docs/publish/deploy/browserQA; GPT-6.1 Sol high: integration_review — frontend/offlinehelper; pr60_integration — PR60/61/CI/pre/postreview; release_inventory — source review/artifacts. [Исторический handoff](archive/WORKING_STATE_BEFORE_PR60_PR61_20261020.md), [инварианты](CRITICAL_INVARIANTS_RU.md), [дизайн](../DESIGN.md).
