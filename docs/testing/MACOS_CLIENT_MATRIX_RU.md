# macOS client: реализация и проверка переноса

База: публичный `client-v1.0.0-rc.9-a994895c5fa9`; рабочая ветка `feat/macos-client`.
Обязательные архитектуры: нативные arm64 и Intel x64. Rosetta не заменяет Intel-проверку.
Пакет остаётся development candidate, без заявления о полном паритете и без публичного выпуска.

Состояние на 2026-11-02: публичного macOS release нет. Опубликованный Windows
Client RC9 и его файлы не изменены. Проверенный интегрированный source SHA —
`4439fa87d3a459823ee853af040c551878cb6834`.
[Mac run 41531376176](https://github.com/resokol/castlink/actions/runs/41531376176), attempt 1 — **SUCCESS**.
Нативные [arm64 job 125572190990](https://github.com/resokol/castlink/actions/runs/41531376176/job/125572190990),
[Intel x64 job 125572191488](https://github.com/resokol/castlink/actions/runs/41531376176/job/125572191488)
и [итоговый guard 125577480530](https://github.com/resokol/castlink/actions/runs/41531376176/job/125577480530)
успешны. На обеих архитектурах прошли обязательные автоматические native
проверки, упаковка и запуск установленной копии из DMG. Итоговый native summary
сохраняет `NOT VERIFIED` для интерактивной приёмки: компиляция, протоколы и
реальные QA-fixtures не подтверждают все пользовательские сценарии.

[Общий PR CI 41531384481](https://github.com/resokol/castlink/actions/runs/41531384481),
[job 125572169832](https://github.com/resokol/castlink/actions/runs/41531384481/job/125572169832)
— **SUCCESS**: проверен PR merge `3177c3c715d5559dc2149db5eeb60ff21b12c8da`,
включающий указанный feature source. На Ubuntu 24.04.5 прошли TypeScript,
stable/web tests, release/public-assets checks, Linux installer/updater,
presentation converter, реальные PostgreSQL storage интеграции, production build,
изолированные LiveKit/Caddy operations и Version API. CLI harness — 13 PASS;
обычный actor UID/GID 1001 — 1436 тестов, 1376 PASS, 60 явных skips, 0 failures;
настоящий legacy actor UID/GID 1000 — 13 PASS, 0 skips и 0 failures.
Это не приёмка настоящего Docker Desktop или VPS на Mac.
Локальные QA readiness — 19 focused PASS; manual/catalog — PASS, 1896 файлов.

База переноса — опубликованный Client RC9. В feature интегрирован публичный
main `48478006e4348f1e185fb8066ee6233481a8a6a2`, включая общие web/runtime
исправления, актуальный каталог и дополнительные CI-проверки. Клиент и встроенный
local/SSH setup используют канонический публичный `resokol/castlink` для обновлений.
Production helpers и Mac guards сохранены. Input fixture ожидает готовности той
же сцены и geometry после capture перед единственным grant; Preview ограниченно
опрашивает состояние после поиска. Повторных input/slide-команд не добавлено.
Audio fixture собирает 3,2 секунды реально доставленного PCM в одном capture
в пределах 8-секундного deadline без изменения спектральных порогов.
Workflow устанавливает официальный stable Chrome и до fixtures проверяет
Apple anchor/Team ID, bundle ID, нативную архитектуру и канонический путь
NSWorkspace; сохраняет версию и SHA256 установщика. Общий CI закреплён на
Ubuntu 24.04 для проверки канонических системных путей; проверка пути `sudo`
не ослаблена. Main не менялся, release не опубликован.

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

## Проверенная сборка и artifacts (source 4439fa87)

Все runner, package, DMG, native evidence и измерения ниже относятся только
к source `4439fa87d3a459823ee853af040c551878cb6834` и
[run 41531376176](https://github.com/resokol/castlink/actions/runs/41531376176). Десять обязательных автоматических
native checks имеют `VERIFIED` на обеих архитектурах. Компиляция helpers,
core/self-test, kernel process birth и JXA syntax подтверждают соответствующие
контракты; реальные OS effects отдельно проверены input/audio/Preview/browser
fixtures. Это не полная приёмка PowerPoint, физических устройств или комнаты.

Оба Mac jobs выполнялись на нативной архитектуре. arm64: Swift 6.3.3,
Node.js 22.23.4; Intel x64: Swift 6.1.2, Node.js 22.23.2. На каждом desktop-набор
дал 444 теста, 443 PASS и 1 прежний NSIS skip; preflight/policy — 18 тестов,
17 PASS и 1 Linux-only skip; smoke/resources/DMG — 37 PASS; Python setup — 32 PASS.
Chrome 156.0.8078.80 проверен на обеих архитектурах; Edge — 156.0.4314.42 на
arm64 и 151.0.4129.101 на Intel. В каждом браузере подтверждены все пять PDF
доказательств при одной навигационной команде. Установщик Chrome:
`770f6d1d49017dd80e307f1fb41df38d12eb36b70947c5780bfb47592c4cd1d7` (SHA256);
подпись Google Team `EQHXZ8M8AV`, bundle ID, нативная архитектура и путь
`/Applications/Google Chrome.app` проверены до fixtures. Product guards
не отключались.

| Development DMG | SHA256 файла DMG |
| --- | --- |
| `CastLink-Client-1.0.0-rc.9-4439fa87d3a4-mac-arm64-development.dmg` | `5ca2995bba2c3f07179b458ed7afac53b437927b0f392a40750231c8a03e5e61` |
| `CastLink-Client-1.0.0-rc.9-4439fa87d3a4-mac-x64-development.dmg` | `1e7c26de1ef0eda83bfeffc3dbc6f14db316ca3f523882fb6c1bfa571e727b54` |

| Actions artifact (ZIP-архив) | SHA256 архива Actions | Хранится до (UTC) |
| --- | --- | --- |
| [CastLink-macos-development-arm64-4439fa87d3a459823ee853af040c551878cb6834](https://github.com/resokol/castlink/actions/runs/41531376176/artifacts/13181718891) | `a37bbd6459566988d97878f4a26145d76480329b5d747e8ec411ef20ee4f1ad5` | 2026-11-16T21:54:24Z |
| [CastLink-macos-development-x64-4439fa87d3a459823ee853af040c551878cb6834](https://github.com/resokol/castlink/actions/runs/41531376176/artifacts/13182023701) | `08592be0acc0254313634c4e90c8218761f11a9718f0222bec6ae5c51cc854c1` | 2026-11-16T21:56:24Z |
| [CastLink-macos-native-evidence-arm64-4439fa87d3a459823ee853af040c551878cb6834](https://github.com/resokol/castlink/actions/runs/41531376176/artifacts/13181074041) | `38a1c3d84672aa3dece82a58ba1ecf3d8411c2ddae7df9aab131b23b4f1cfc6e` | 2026-11-16T21:50:44Z |
| [CastLink-macos-native-evidence-x64-4439fa87d3a459823ee853af040c551878cb6834](https://github.com/resokol/castlink/actions/runs/41531376176/artifacts/13182197803) | `8990b119b59808db0311a8ea18c5f46fa92d5753b2f5ec33abd9c0c474ff3ef1` | 2026-11-16T21:52:06Z |

Все четыре artifacts относятся к source `4439fa87d3a459823ee853af040c551878cb6834`,
не просрочены на дату проверки. Это временные Actions artifacts, не release
assets. SHA256 архива Actions отличается от SHA256 DMG внутри него;
для DMG, ZIP и `manifest.json` используйте вложенный `SHA256SUMS`.

Native audio: arm64 собрал по 154560 frames / 161 packets в обеих capture-фазах;
Intel — 154560 / 161 и 153600 / 160. Сбор каждой фазы занял не более 3,22 секунды
при 8-секундном deadline без stream error/EOF. Отношения амплитуд 880/1320 Hz
к 440 Hz: arm64 −116,43/−101,33 dB (LaunchServices) и −219,23/−101,14 dB
(direct outsiders); Intel −67,11/−70,71 dB и −122,18/−101,14 dB соответственно.
Обе архитектуры отвергли direct owner с exit 4 и нулевым PCM; foreign-source
refusal и source termination прошли. Это проверка QA-приложений, не Office.

Для проверки результатов сохраняются `runner.json`, native summary,
`native-input.json`, `native-audio.json`, `native-browser-pdf.json`,
`native-preview-pdf.json`, `dmg-install.json`, `packaged-resources.json`,
`packaged-smoke.json`, logs и PNG. DMG smoke устанавливает app в принадлежащую
тесту папку `~/Applications/CastLink-QA-*`, отключает образ и запускает эту
установленную копию с отдельным профилем. Оба отчёта сохраняют `signed:false`,
`notarized:false` и `quarantineBypass:false`; Developer ID/notarization/Gatekeeper
acceptance не подтверждены. `NOT VERIFIED` означает отсутствие полного
доказательства указанного сценария; self-test и компиляция не заменяют OS effect.

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
