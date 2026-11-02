# macOS client: реализация и проверка переноса

База: публичный `client-v1.0.0-rc.9-a994895c5fa9`; рабочая ветка `feat/macos-client`.
Обязательные архитектуры: нативные arm64 и Intel x64. Rosetta не заменяет Intel-проверку.
Пакет остаётся development candidate, без заявления о полном паритете и без публичного выпуска.

Состояние на 2026-11-02: публичного macOS release нет. Опубликованный Windows
Client RC9 и его файлы не изменены. Текущий кандидат — source SHA
`21a34b77cc046108722ed5cd8794e4ea65f1ba3e`,
[Actions run 41519202093](https://github.com/resokol/castlink/actions/runs/41519202093).
**CI: SUCCESS.** Нативные
[arm64 job 125530542614](https://github.com/resokol/castlink/actions/runs/41519202093/job/125530542614),
[Intel x64 job 125530542344](https://github.com/resokol/castlink/actions/runs/41519202093/job/125530542344)
и [итоговый guard 125535774273](https://github.com/resokol/castlink/actions/runs/41519202093/job/125535774273)
успешны. На обеих архитектурах прошли обязательные автоматические native
fixtures, упаковка и DMG smoke; ручная приёмка ниже остаётся NOT VERIFIED.

Локальные desktop contracts (Node.js 22.23.4), включая QA-исправление
audio fixture: 442 теста, 441 PASS и 1 пропуск
прежнего NSIS-теста; Python macOS setup: 32 PASS; Linux updater: 22 PASS.
Smoke/native/Preview policy: 46 PASS; после последнего изменения input fixture —
10 focused PASS и Swift parse PASS; audio fixture: 24 focused PASS.
Typecheck и web build: PASS. Полный
`pnpm test:ci` на предыдущем source `6746d7a458bdda727f4f23ee53c37865112425d8`
(Node.js 22.23.4, pnpm 9.15.0): 325 stable CI tests PASS, exit 0, включая
проверку актуального manual/catalog (1886 файлов). Текущий source отличается
только двумя QA-файлами audio fixture; frontend и каталог исходников не изменены.
Эти проверки подтверждают контракты, состояние и guards, но не работу macOS API,
Office, физических устройств или реального сервера.

База переноса остаётся опубликованным Client RC9. В текущий кандидат отдельно
перенесено проверенное исправление канонических update URL из публичного main:
клиент и встроенный local/SSH setup обращаются к `resokol/castlink`. Это не merge
main и не изменение опубликованных Windows/Linux пакетов. QA-исправление
audio fixture в текущем опубликованном source ожидает 3,2 секунды реально доставленного
PCM в пределах одного 8-секундного deadline. Используется один capture со всеми
его пакетами; пороги спектральной проверки и production helper не изменены.
Фактический результат native audio в текущем run оценивается отдельно ниже.

| Проверка текущего кандидата | arm64 | Intel x64 |
| --- | --- | --- |
| Runner / macOS / SDK | native arm64 · macOS 26.6.2 · SDK 26.5 · Xcode 26.6 (17F113) | native x64 · macOS 15.7.9 · SDK 15.5 · Xcode 16.4 (16F6) |
| Компиляция пяти helpers: audio/input/slides/powerpoint/registration | PASS | PASS |
| Core/self-test, kernel process birth, JXA syntax | PASS | PASS |
| Desktop / smoke-resource / Python tests в CI | PASS | PASS |
| app / DMG / ZIP, ресурсы, иконка; архитектура семи binaries | PASS | PASS |
| Установка копии из DMG / launcher / setup UI / renderer isolation | PASS | PASS |
| Четыре URI: registration; helper argv bootstrap / HTTP 401 | PASS | PASS |
| Реальная input fixture / crop geometry / release / watchdog | PASS | PASS |
| Реальная audio fixture / spectral isolation / direct-owner refusal | PASS | PASS |
| Preview: настоящее приложение / PDF / next / previous / focus refusal | PASS | PASS |
| Chrome PDF: пять обязательных доказательств | PASS | PASS |
| Edge PDF: пять обязательных доказательств | PASS | PASS |
| Protocol launch → реальная комната / успешный helper-сценарий | NOT VERIFIED | NOT VERIFIED |
| PowerPoint: оригинальный PPTX / Office / удалённый аудиотрек | NOT VERIFIED | NOT VERIFIED |
| Физические camera / microphone / TCC / keyboard / mouse | NOT VERIFIED | NOT VERIFIED |
| Несколько дисплеев / mixed Retina / Space / lock / sleep | NOT VERIFIED | NOT VERIFIED |
| Настоящий Docker Desktop / install / update / remove / restore | NOT VERIFIED | NOT VERIFIED |
| Настоящий SSH/VPS / ключи / принятие Windows-managed VPS | NOT VERIFIED | NOT VERIFIED |
| Ручное обновление app / сохранение userData | NOT VERIFIED | NOT VERIFIED |
| Developer ID / notarization / Gatekeeper acceptance | NOT VERIFIED | NOT VERIFIED |

Оба Mac jobs выполнялись на нативной архитектуре. arm64: Swift 6.3.3,
Node.js 22.23.4; Intel x64: Swift 6.1.2, Node.js 22.23.2. На каждом desktop-набор
дал 442 теста, 441 PASS и 1 прежний NSIS skip; smoke/resources/DMG — 37 PASS;
preflight/policy — 13 тестов, 12 PASS и 1 Linux-only skip.

| Development DMG | SHA256 файла DMG |
| --- | --- |
| `CastLink-Client-1.0.0-rc.9-21a34b77cc04-mac-arm64-development.dmg` | `0a011af1cb56ba2d394f7bffc63cfdb9270c2ccb35468541170b27c48745a9a8` |
| `CastLink-Client-1.0.0-rc.9-21a34b77cc04-mac-x64-development.dmg` | `2280d145f1ec03e54364a2360175406f57b5dbf83a245822b93d26d12a8165bc` |

| Actions artifact (ZIP-архив) | SHA256 архива Actions |
| --- | --- |
| [CastLink-macos-development-arm64-21a34b77cc046108722ed5cd8794e4ea65f1ba3e](https://github.com/resokol/castlink/actions/runs/41519202093/artifacts/13177970008) | `f2cfff5a66ff7a9275d7c368b14dea3aaf9c1bbccba2b8407bcfb27f286492a5` |
| [CastLink-macos-development-x64-21a34b77cc046108722ed5cd8794e4ea65f1ba3e](https://github.com/resokol/castlink/actions/runs/41519202093/artifacts/13176469423) | `dbddf2b67a649465b9218c1e39e16147cbdc5b52080b313c401f05840bc3bc96` |
| [CastLink-macos-native-evidence-arm64-21a34b77cc046108722ed5cd8794e4ea65f1ba3e](https://github.com/resokol/castlink/actions/runs/41519202093/artifacts/13176452646) | `496fd82adbe6bc558d9e45c5c0338695ed8e41fe81973da3818da528c757b68e` |
| [CastLink-macos-native-evidence-x64-21a34b77cc046108722ed5cd8794e4ea65f1ba3e](https://github.com/resokol/castlink/actions/runs/41519202093/artifacts/13177122216) | `b7d437978c39bda320552fc88eea68cc534ea869b70ab28bcff98254ef6e1395` |

Все четыре artifacts относятся к source `21a34b77cc046108722ed5cd8794e4ea65f1ba3e`,
не просрочены на дату проверки и хранятся до 2026-11-16. Это временные Actions
artifacts, не release assets. SHA256 архива Actions отличается от SHA256 DMG
внутри него; для DMG, ZIP и `manifest.json` используйте вложенный `SHA256SUMS`.

Native audio: arm64 собрал по 153600 frames / 160 packets в двух capture-фазах;
Intel — 154560 / 161 и 153600 / 160. Все фазы завершились за 3,23 секунды при
8-секундном deadline без stream error/EOF. Отношения амплитуд 880/1320 Hz к
440 Hz: arm64 −73,94/−84,81 dB (LaunchServices) и −98,58/−94,78 dB (direct
outsiders); Intel −122,18/−101,14 dB и −122,19/−101,14 dB соответственно.
Обе архитектуры отвергли direct owner с exit 4 и нулевым PCM; foreign-source
refusal и source termination прошли. Это проверка QA-приложений, не Office.

Для проверки результатов сохраняются `runner.json`, native summary,
`native-input.json`, `native-audio.json`, `native-browser-pdf.json`,
`native-preview-pdf.json`, `dmg-install.json`, `packaged-resources.json`,
`packaged-smoke.json`, logs и PNG. DMG smoke устанавливает app в принадлежащую
тесту папку `~/Applications/CastLink-QA-*`, отключает образ и запускает эту
установленную копию с отдельным профилем. Отчёт сохраняет
`quarantineBypass:false`; Developer ID/notarization/Gatekeeper acceptance
не подтверждены. `NOT VERIFIED` означает отсутствие полного
доказательства указанного сценария; self-test и компиляция не заменяют OS effect.
Прежние оценки Chrome, основанные только на появлении новых AX-маркеров, не
считаются доказательством навигации.

## Сборка и использование текущей ветки

Нужны чистый закоммиченный checkout, Node.js 22, pnpm 9.15.0 и Xcode Command Line
Tools. Каждая архитектура собирается на собственном нативном Mac. На arm64:

```sh
pnpm install --frozen-lockfile
node scripts/macos-client-preflight.mjs arm64
node apps/desktop/scripts/package-macos.cjs --arch arm64
```

На Intel замените `arm64` на `x64` в обеих командах `node`. Скрипт компилирует
четыре Swift helpers и пятый Objective-C/AppKit helper
`registration/CastLink.ProtocolRegistration`, включает setup-ресурсы и проверяемый
по SHA256 Python runtime. Результат:
`artifacts/desktop/<source-sha12>/mac-<arch>/`, включая app, DMG, ZIP,
`manifest.json` и `SHA256SUMS`. Уже непустой выходной каталог отвергается;
его предыдущие результаты следует сохранить перед новой сборкой.

При незаданном `CASTLINK_MAC_DISTRIBUTION` или значении `0` получаются
`CastLink Client Development.app` и
`CastLink-Client-<version>-<source-sha12>-mac-<arch>-development.dmg` / `.zip`.
Это отдельные development-артефакты: обновлятор не выбирает их как обычный выпуск.
Workflow `macos-client.yml` использует одну матрицу `macos` с двумя нативными
Mac jobs — arm64 и Intel x64. В каждом сначала запускаются native fixtures;
`continue-on-error` позволяет затем независимо получить package и DMG evidence.
Финальный guard с `if: always()` требует исходный `steps.*.outcome == success`
для `native`, `package` и `packaged_smoke`. Ошибка native шага не превращается
в успешный job из-за `continue-on-error`. Итоговый `both-architectures` требует
успеха обоих архитектурных jobs.

Сохраняются четыре отдельных архива Actions: native evidence и development
candidate для каждой архитектуры — `CastLink-macos-native-evidence-<arch>-<sha>`
и `CastLink-macos-development-<arch>-<sha>`. JSON/log/PNG и package evidence
остаются раздельными. Сохранённый artifact после неуспешного job не означает
готовность клиента.

Для ручной проверки откройте DMG, скопируйте приложение в Applications и запустите
его оттуда. В launcher доступны студия, подключение по приглашению и мастер
install/update/remove сервера. Меню macOS содержит смену сервера, обновления и
«Разрешения macOS…»; разрешения запрашиваются после явного действия пользователя.
Поддерживаются схемы `castlink` (приглашения), `castlink-presenter` (локальный
помощник презентации), `castlink-remote` и `castlink-share` (изолированный помощник
демонстрации/управления, включая запуск из обычного браузера). Smoke проверяет
декларации всех четырёх схем и естественный выбор установленной копии через
LaunchServices: только наблюдение до 15 секунд и фактический результат продукта
`REGISTERED`, без выбора handler со стороны QA. Для трёх helper-схем проверяются
bootstrap через argv и ожидаемый отказ авторизации (401) на локальном тестовом TLS-сервере. Доставка URI через
системный openURL, успешное подключение к комнате, весь helper-сценарий и
физический TCC требуют отдельной приёмки.

## Необязательная сборка для распространения

`CASTLINK_MAC_DISTRIBUTION=1` включает строгий режим подписи. До запуска той же
команды сборки необходимо предоставить через защищённое окружение один вариант
Developer ID Application:

- `CSC_LINK` и `CSC_KEY_PASSWORD` для сертификата; `CSC_NAME` может явно выбрать identity.
- Либо `CSC_NAME` и `CSC_KEYCHAIN` с уже разблокированной связкой ключей.

Если `CSC_IDENTITY_AUTO_DISCOVERY=false`, `CSC_NAME` обязателен. Дополнительно
нужен ровно один способ notarization:

- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
- Либо `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.
- Либо `APPLE_KEYCHAIN_PROFILE` и, при необходимости, `APPLE_KEYCHAIN`.

Здесь перечислены только имена переменных; секреты не записываются в репозиторий,
manifest или команды примеров. Неполные credentials, неудачная подпись,
Gatekeeper assessment или проверка stapled ticket останавливают сборку. Перехода
к ad-hoc после ошибки distribution-режима нет. Подписанный/notarized macOS
пакет пока не проверен.

Distribution-режим использует `CastLink Client.app` и канонические имена
`CastLink-Client-<version>-<source-sha12>-mac-arm64.dmg` либо
`CastLink-Client-<version>-<source-sha12>-mac-x64.dmg` (также ZIP). Именно эти DMG
выбирает обновлятор по архитектуре процесса из client release с `SHA256SUMS`.
Он проверяет SHA256, отдельно спрашивает согласие и открывает DMG; пользователь
завершает приложение и вручную заменяет его в Applications, сохраняя userData.
Подпись и каноническое имя не делают пакет выпущенным и не подтверждают полный
паритет. Никакой macOS release сейчас не опубликован.

## Области реализации и ограничения

| Функция | Реализованная область исходников | Что требуется подтвердить на macOS |
| --- | --- | --- |
| Сборка и DMG | Отдельные arm64/x64 app, ZIP и DMG; четыре Swift helpers, Objective-C registration helper, JXA, setup-ресурсы, Python, source SHA и SHA256SUMS. Проверяется архитектура семи binaries: app, пять helpers и Python; registration self-test пассивен и не регистрирует URI. DMG smoke проверяет checksum и контейнер, read-only mount, установку app в принадлежащую тесту папку `~/Applications/CastLink-QA-*`, detach перед запуском, ресурсы и launcher/setup UI с отдельным профилем. | Итог CI указан выше. Этот smoke проверяет реальную установку в пользовательскую Applications, но не заменяет установку в системную `/Applications`, обновление существующего app, сохранение userData, Gatekeeper или запуск на нижней версии macOS. |
| Разрешения | Отдельные camera/microphone/screen/Accessibility/Input Monitoring/Automation проверки и меню разрешений в app/helper. Automation определяется операцией PowerPoint. Отказ даёт конечную локализованную ошибку. | Физические deny/grant/revoke, повторный запуск, принадлежность TCC app/helper и замена сессии во время запроса. |
| Звук | Явный opt-in; ScreenCaptureKit `desktopIndependentWindow` закрепляет выбранное окно PowerPoint. Проверяются CGWindowID, PID, kernel process birth и LaunchServices launch identity. Источник без LaunchServices identity отвергается до выдачи PCM. CLPA0001: 48 kHz, stereo Float32; системный звук и микрофон не используются как fallback. | Spectral fixture проверяет 440 Hz выбранного QA-приложения против 880/1320 Hz посторонних процессов, включая смешанный способ запуска. QA-исправление собирает 3,2 секунды фактического PCM в одном capture с deadline 8 секунд и сохраняет byte/frame/packet diagnostics при недостаточных данных; спектральный oracle не меняется. Это не Microsoft Office и не физический микрофон. Нужны Office, удалённый трек, stop/source loss/revoke/sleep/reconnect. Звуковой scope — приложение, не отдельный документ. |
| PowerPoint | Исходный PPTX, привязка к процессу/окну/документу; start/status и next/previous через installed scripting dictionary. Goto — числовой shortcut для точного foreground slideshow с проверкой результата; неопределённый результат отзывает управление без повторения. | Установленный Office, анимации/media, одношаговые build-переходы, многоразрядный goto, раскладки, два deck/show, presenter view, fullscreen/Spaces и замена источника. |
| Preview PDF | Production helper связывает выбранный PDF с настоящим системным Preview по AX/CG/process identity. Поддерживается реальный PDFKit container и наблюдаемая позиция содержимого; PageDown/PageUp требуют foreground PDF focus, search/sidebar/dialog отклоняются. Fixture создаёт свой PDF и отдельный Preview, проверяет next/previous, editable-focus refusal, закрытие источника и cleanup. | Итог native fixture указан выше. Нужны пользовательские PDF, дополнительные версии macOS, revoke/disconnect/deadline; Acrobat и произвольные документы не заявлены. |
| Chrome/Edge PDF | Сохраняются точные AX-идентичности документа, viewer и вкладки. Fixture устанавливает и считывает AXFocused внутреннего PDF-элемента; focus внешнего viewer недостаточен. Перед вводом перепроверяются окно и process birth; замена content root отклоняется. Для отдельного QA-профиля не используется Chromium enable-automation, препятствующий передаче URL. Verdict требует все пять доказательств: `documentIdentity`, `contentFocus`, `navigation`, `editableFocusRefusal`, `sameURLTabRefusal`. До единственной навигационной команды требуются три одинаковых baseline-снимка. Затем существовавший ранее PDF-маркер должен сместиться вверх более чем на 2 pt при стабильной геометрии окна/поверхности и сохранении x/ширины маркера в допуске. Новые AX-маркеры и scrollbar values не подтверждают движение. | Отдельный результат каждого браузера и архитектуры указан выше. Наличие браузера или только найденный viewer не означает успешную навигацию; новые версии браузеров и полный пользовательский сценарий требуют приёмки. |
| Browser presenter / URI | `castlink`, `castlink-presenter`, `castlink-remote`, `castlink-share`: после готовности launcher продукт асинхронно выбирает собственный app URL через AppKit `setDefaultApplicationAtURL` для четырёх фиксированных схем. Пятый helper проверяет свой путь в bundle, главный executable, bundle ID и схемы; native deadline 8 секунд и точный readback исключают успех по одному bundle ID. Ошибка даёт локализованную подсказку без блокирования launcher. Для трёх helper-схем — bootstrap через argv и ожидаемый отказ авторизации (401) на локальном тестовом TLS-сервере. Presenter helper закреплён за владельцем/SID; `browserControl` описывает управление локальным PowerPoint. | Успешные browser → protocol → consent → helper → комната сценарии, смена SID/capture и stop. Регистрация и argv bootstrap не доказывают доставку через системный openURL или успешное управление. |
| Remote input | Main-only lease ≤750 ms, receiver watchdog ≤500 ms; CGWindowID + PID/kernel birth + retained AX window либо display ID + UUID. Геометрия и фокус проверяются до ввода; replay/gap/barrier, releaseAll, retireAuthority, reclaim и local stop. Binary corner IDs проверяют crop/orientation/backing extent с явным sRGB sampling. Display-sized Dock tracking surface пропускается только при Apple code identity, точных system paths и совпадении AX hit с выбранным окном; другие blockers закрывают ввод. | Итог реальной fixture указан выше. Binary markers не доказывают точность цвета дисплея. Нужны физические holds, owner takeover, mixed Retina/несколько дисплеев, отрицательные координаты, Space/lock/sleep и реальная комната. F21–F24 и secure/login desktop не поддерживаются. |
| Локальный сервер | Install/resume/update/reconfigure/remove, quick LAN address и advanced network. Пустая папка текущего пользователя безопасно переводится в private 0700; непустая/чужая/подменённая папка не принимается. Проверяются Docker Desktop provenance, `desktop-linux` daemon, ownership receipt, backup/readiness и remove guards. На Apple Silicon amd64-эмуляция требует согласия; CA trust — отдельный выбор. | Настоящий Docker Desktop first-run, install/update/remove, backup/restore, сохранение данных, явный erase, чужие Docker ресурсы и CA trust/removal. Эмуляция не доказывает native arm64 server image. |
| SSH сервер | Fingerprint pinning, password/private/generated key, fresh-key login; Ubuntu 22.04/24.04 x86_64 root workflow. Discovery, lifecycle и принятие совместимого Windows RC9 VPS сохраняют project/volume/secret identities. Полный preflight предшествует изменению владельца; backup предшествует scheduler changes; обычное remove сохраняет данные. Контрактный Python-набор: 32 PASS. | Настоящий доверенный VPS, изменённый fingerprint, ключи, install/update/remove/adoption, reconnect после обрыва и проверка восстановления данных. |
| Обновление клиента | Release identity, архитектура и SHA256 проверяются до открытия DMG после отдельного согласия. Замена app остаётся ручной. | Настоящая замена установленного app, запуск новой версии и сохранение userData/пользовательских серверных данных. Успех `/usr/bin/open` не означает установленное обновление. |

## Доказательства и критерий готовности

Исходники и точные контракты: [audio](../../native/macos-process-audio/PROTOCOL.md),
[input](../../native/macos-remote-input/PROTOCOL.md),
[presentation](../../native/macos-presentation/PROTOCOL.md).
Сборка: [macOS package](../../apps/desktop/scripts/package-macos.cjs);
workflow: [macos-client.yml](../../.github/workflows/macos-client.yml).

JS-тесты покрывают opaque IDs, ограниченные payloads, finite errors и отсутствие
утечки native сообщений, explicit audio selection, lease/replay, отмену и смену
поколения, ресурсную полноту и отдельный Windows package closure. Setup-тесты
дополнительно проверяют ownership, backup и destructive-operation guards с
контролируемыми зависимостями. Эти результаты следует сохранять отдельно от
OS acceptance.

Native audio fixture использует реальные AppKit audio apps с разными частотами
и production helper, но QA-приложение с тестовым PowerPoint bundle ID не является
Microsoft Office. Native input fixture измеряет реальные CGEvents и
ScreenCaptureKit capture своей сцены с четырьмя бинарными угловыми ID. Preview fixture использует настоящий
системный Preview с собственным PDF, browser fixture — отдельные профили
установленных Chrome/Edge. Они не заменяют физические held-key/multimonitor
проверки и полный сценарий в комнате.
`--self-test`, API probe и компиляция не доказывают OS effect. Недоступные GUI,
устройства или разрешения дают `NOT VERIFIED`, а не PASS изоляции/ввода.

Для каждого фактического результата нужны source SHA, arm64 либо Intel x64,
версия macOS/SDK/Office, состояние разрешений, команда/сценарий и сохранённые
JSON/log/PNG или измерения удалённого трека. Оба архитектурных jobs и реальные
сценарии приёмки должны быть оценены отдельно. Manifest после полной ресурсной
сборки сохраняет `fullParity:false`, `runtimeValidated:false` и
`portStatus:awaiting-native-acceptance`; capability flags описывают включённые
адаптеры, а не подтверждённую совместимость.

Заявленный deployment target — macOS 13.0 для ScreenCaptureKit audio API.
Фактический CI: macOS 26.6.2 на arm64 и macOS 15.7.9 на Intel x64. Эти runners не
подтверждают запуск Electron, helpers, Office или Docker Desktop на macOS 13.
Нижняя фактически поддержанная версия устанавливается только результатами запуска
всех требуемых компонентов; старые системы этим кандидатом не поддерживаются.
