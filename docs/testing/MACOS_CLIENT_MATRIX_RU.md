# macOS client: реализация и проверка переноса

База: публичный `client-v1.0.0-rc.9-a994895c5fa9`; рабочая ветка `feat/macos-client`.
Обязательные архитектуры: нативные arm64 и Intel x64. Rosetta не заменяет Intel-проверку.
Пакет остаётся development candidate, без заявления о полном паритете и без публичного выпуска.

Состояние на 2026-11-02: рабочая публичная ветка не является выпущенным macOS
клиентом. Опубликованный Client RC9 и его файлы не изменены. Последняя проверенная
точка — публичный [Actions run 41465249691](https://github.com/resokol/castlink/actions/runs/41465249691),
source SHA `60290e6ebb9ca3eaff2054e35fc7ccc84a3676f8`, attempt 1.
На обеих нативных архитектурах прошли компиляция четырёх Swift helpers,
core/self-test и kernel process-birth проверки, desktop/Python тесты, сборка
DMG/ZIP и smoke реального упакованного приложения. Проверены его ресурсы, иконка,
архитектура/идентичность встроенного Python, launcher, setup UI и изоляция renderer.

**Общий результат run — FAILED.** Реальная input fixture успешно дошла до
передачи клавиш и Unicode, затем завершилась assertion failure; реальная audio
fixture провалила spectral isolation. Прежняя проблема process identity уже не
блокирует initial binding: сохранённые данные показывают `kernel-proc-pidinfo`,
`ready:true` и `pointerReady:true`. Это не означает успешное завершение всего
сценария ввода. Chrome/Edge установлены на runners, но точную AX-идентичность
встроенного PDF-viewer получить не удалось: `NOT VERIFIED` на обеих архитектурах.
Office, физический ввод/микрофон, реальные Mac Docker/VPS и Developer ID/notarization
не проверены. Наличие изменений после этого SHA не меняет результаты этого run.

В исходниках реализованы macOS-адаптеры перечисленных ниже функций. Контрактные
тесты на Linux проверяют валидацию, состояние и транспорт; они не доказывают работу
macOS API, Office, разрешений или Docker Desktop. Ниже `NOT VERIFIED` означает, что
реальное принятие функции на указанной архитектуре ещё не подтверждено сохранёнными
результатами. Наличие workflow или тестовой оснастки не считается её успешным запуском.

| Проверка | arm64 | Intel x64 |
| --- | --- | --- |
| Runner / SDK | PASS — native arm64, macOS 26.6.2, SDK 26.5 | PASS — native x64, macOS 15.7.9, SDK 15.5 |
| Нативная компиляция Swift helpers | PASS — audio/input/slides/powerpoint | PASS — audio/input/slides/powerpoint |
| CoreFixture / self-test / kernel process birth / JXA syntax | PASS; без доказательства полного OS-сценария | PASS; без доказательства полного OS-сценария |
| Desktop contracts / smoke-resource contracts / Python setup tests | PASS — 416 desktop tests, 1 skipped; 14 smoke/resource tests; 26 Python tests | PASS — 416 desktop tests, 1 skipped; 14 smoke/resource tests; 26 Python tests |
| app / DMG / ZIP | PASS — development candidate собран | PASS — development candidate собран |
| Ресурсы / иконка / встроенный Python | PASS — проверены в фактическом app | PASS — проверены в фактическом app |
| Запуск фактического app / launcher / setup UI / renderer isolation | PASS — setup-операции не запускались | PASS — setup-операции не запускались |
| Protocol launch → реальная комната / helper | NOT VERIFIED | NOT VERIFIED |
| Камера / микрофон / Screen Recording TCC | NOT VERIFIED | NOT VERIFIED |
| Реальная audio fixture | FAILED — ScreenCaptureKit spectral isolation | FAILED — ScreenCaptureKit spectral isolation |
| Изолированный звук приложения PowerPoint | Office / удалённый трек NOT VERIFIED | Office / удалённый трек NOT VERIFIED |
| PowerPoint: оригинальный PPTX, start/status/step/goto | Реализован; Office NOT VERIFIED | Реализован; Office NOT VERIFIED |
| PDF: выбранное окно Preview, next/previous | Реализован; Preview / AX NOT VERIFIED | Реализован; Preview / AX NOT VERIFIED |
| PDF в Chrome/Edge | NOT VERIFIED — built-in PDF AX identity unavailable | NOT VERIFIED — built-in PDF AX identity unavailable |
| Browser presenter → локальный PowerPoint helper | Реализован; полный сценарий NOT VERIFIED | Реализован; полный сценарий NOT VERIFIED |
| Реальная input fixture / geometry | FAILED — после key/Unicode delivery; initial binding/geometry готовы | FAILED — после key/Unicode delivery; initial binding/geometry готовы |
| Remote input / watchdog / reclaim в реальной комнате | NOT VERIFIED | NOT VERIFIED |
| Локальный server setup / Docker Desktop | Реализован; установка / update / remove NOT VERIFIED | Реализован; установка / update / remove NOT VERIFIED |
| SSH setup / ключи / Ubuntu / update / remove | Реализован; реальный SSH-сценарий NOT VERIFIED | Реализован; реальный SSH-сценарий NOT VERIFIED |
| Принятие Windows-managed VPS | Реализовано; 26 Python tests PASS; реальный VPS NOT VERIFIED | Реализовано; 26 Python tests PASS; реальный VPS NOT VERIFIED |
| Обновление клиента через DMG / сохранение данных | Контрактные тесты; OS NOT VERIFIED | Контрактные тесты; OS NOT VERIFIED |
| Developer ID / notarization | Не выполнены — credentials не предоставлены | Не выполнены — credentials не предоставлены |

Все PASS/FAILED в этой таблице относятся к SHA `60290e6ebb9c`, а не к любому
последующему состоянию ветки. Jobs:
[arm64, 125344284614](https://github.com/resokol/castlink/actions/runs/41465249691/job/125344284614),
[Intel x64, 125344285237](https://github.com/resokol/castlink/actions/runs/41465249691/job/125344285237).
Шаги packaging и packaged smoke прошли независимо от native fixture failure;
финальный обязательный native-check завершился ошибкой в обоих jobs.

Сохранены development artifacts с DMG/ZIP, manifest/SHA256SUMS и evidence;
это не опубликованные release assets. Metadata на момент проверки:

| Архитектура | Artifact | SHA256 архива Actions |
| --- | --- | --- |
| arm64 | [13151721124](https://github.com/resokol/castlink/actions/runs/41465249691/artifacts/13151721124) | `dc2607752757bea72a38585db63cb33a79a16e909352a261e4e6aba6fa6b3214` |
| x64 | [13151297045](https://github.com/resokol/castlink/actions/runs/41465249691/artifacts/13151297045) | `8ee9ae6cdeb000aad0ee06461a121bb044b2f7687a8590dbb6044269394526df` |

Artifact names: `CastLink-macos-development-<arch>-60290e6ebb9ca3eaff2054e35fc7ccc84a3676f8`;
срок хранения metadata — до 2026-11-16. Эти digests относятся ко всему ZIP Actions,
не к отдельному DMG. Пакеты записали `signed:false`, `signing:ad-hoc`,
`notarized:false`; проверка целостности ad-hoc кода не является Developer ID
подписью или notarization. Для повторного анализа служат `runner.json`, native
summary, `native-input.json`, `native-audio.json`, `native-browser-pdf.json`,
`packaged-resources.json`, `packaged-smoke.json` и независимые logs/PNG.

## Сборка и использование текущей ветки

Нужны чистый закоммиченный checkout, Node.js 22, pnpm 9.15.0 и Xcode Command Line
Tools. Каждая архитектура собирается на собственном нативном Mac. На arm64:

```sh
pnpm install --frozen-lockfile
node scripts/macos-client-preflight.mjs arm64
node apps/desktop/scripts/package-macos.cjs --arch arm64
```

На Intel замените `arm64` на `x64` в обеих командах `node`. Скрипт компилирует
helpers, включает setup-ресурсы и проверяемый по SHA256 Python runtime. Результат:
`artifacts/desktop/<source-sha12>/mac-<arch>/`, включая app, DMG, ZIP,
`manifest.json` и `SHA256SUMS`. Уже непустой выходной каталог отвергается;
его предыдущие результаты следует сохранить перед новой сборкой.

При незаданном `CASTLINK_MAC_DISTRIBUTION` или значении `0` получаются
`CastLink Client Development.app` и
`CastLink-Client-<version>-<source-sha12>-mac-<arch>-development.dmg` / `.zip`.
Это отдельные development-артефакты: обновлятор не выбирает их как обычный выпуск.
Workflow `macos-client.yml` сохраняет кандидаты и независимые JSON/log/PNG
доказательства в Actions artifacts; затем требует успешного native шага.
Сохранённый artifact после неуспешного job не означает готовность клиента.

Для ручной проверки откройте DMG, скопируйте приложение в Applications и запустите
его оттуда. В launcher доступны студия, подключение по приглашению и мастер
install/update/remove сервера. Меню macOS содержит смену сервера, обновления и
«Разрешения macOS…»; разрешения запрашиваются после явного действия пользователя.
Поддерживаются схемы `castlink` (приглашения), `castlink-presenter` (локальный
помощник презентации), `castlink-remote` и `castlink-share` (изолированный помощник
демонстрации/управления, включая запуск из обычного браузера). Сценарии protocol
launch и TCC в настоящем упакованном приложении ещё требуют приёмки.

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
к ad-hoc после ошибки distribution-режима нет. В текущей сессии credentials не
предоставлены, подписанный/notarized пакет не получен.

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
| Сборка | Отдельные arm64/x64 app, ZIP и DMG; Swift helpers, фиксированный JXA, setup-ресурсы и Python. Чистый source SHA, manifest и SHA256SUMS. На `60290e6ebb9c` обе сборки и packaged resource/launcher/setup UI smoke прошли. Development: ad hoc подпись, без notarization. | Developer ID/notarization, запуск на нижней поддерживаемой версии macOS и полная функциональная приёмка каждой архитектуры. |
| Разрешения | Отдельные camera/microphone/screen/Accessibility/Input Monitoring/Automation проверки и меню разрешений в основном приложении и helper. Automation определяется конкретной операцией PowerPoint. Отказ остаётся конечной ошибкой с локализованной подсказкой, без обхода TCC. | Deny, grant, revoke, повторный запуск и замена сессии во время запроса; фактическая принадлежность TCC app/helper. |
| Звук | ScreenCaptureKit включает только приложение — владельца выбранного окна PowerPoint; CLPA0001, 48 kHz, stereo Float32. Только явный opt-in. PID/kernel process birth/CGWindowID закреплены и перепроверяются; нет fallback на системный звук или микрофон. Реальная spectral fixture на `60290e6ebb9c` завершилась FAILED. | Исправление spectral failure; маркеры PowerPoint / другого приложения / возвратного аудио / физического микрофона на удалённом треке; stop, source loss, permission revoke, sleep и reconnect. Несколько презентаций одного приложения имеют общий звуковой scope: отдельный документ/слайд не изолируется. |
| PowerPoint | Выбор и открытие исходного PPTX; привязка к процессу, настоящему окну и документу; start/status и next/previous через проверенный installed scripting dictionary. Goto: числовой shortcut только для точного foreground slideshow, с проверкой фактически полученного номера; неопределённый результат отзывает управление и не повторяется. | Установленные версии Office, оригинальный PPTX с анимациями и media, одношаговые build-переходы, многоразрядный goto и раскладки. Два deck/show, editor/presenter view, fullscreen/Spaces, замена файла/окна/захвата. Отсутствующие click-index/count не выдумываются. |
| PDF | Локальный PDF в Preview, уникальная AX/CG привязка и явное согласие. Process-targeted PageDown/PageUp требуют выбранное foreground окно и фокус PDF content; search/sidebar/dialog отклоняются. Chrome/Edge PDF дорабатываются с сохранением AX-идентичности вкладки в отдельном native процессе. | AX-деревья реальных Preview/Chrome/Edge, next/previous, focus loss, подмена PDF/вкладки, permission revoke, disconnect/deadline. Acrobat и произвольные документы не заявлены. |
| Browser presenter | `castlink-presenter` запускает локальный helper и связывает его с точным владельцем/SID. `browserControl` означает управление локальным PowerPoint из браузерного presenter-сценария. | Полный browser → protocol → local consent → PowerPoint → remote caster сценарий; смена SID/capture и stop. Флаг не означает управление произвольными вкладками браузера. |
| Remote input | Main-only lease ≤750 ms и независимый native watchdog; receiver heartbeat ≤500 ms. CGWindowID + PID/kernel process birth + retained AX window либо display ID + UUID. Полная пауза при недоказанной геометрии/фокусе; replay/gap/barrier checks, releaseAll, retireAuthority, reclaim и локальный stop. Quartz points отделены от backing pixels. На `60290e6ebb9c` initial binding и key/Unicode delivery подтверждены, полная fixture FAILED. | Исправление оставшегося assertion failure; полный mouse/key/text/release сценарий, occlusion, Retina/отрицательные координаты/несколько дисплеев, Space/lock/sleep, физические held-key/button пересечения и owner takeover. F21–F24 и secure/login desktop не поддерживаются; глобальные shortcut остаются поведением macOS. |
| Локальный сервер | Wizard install/update/remove; проверка provenance Docker Desktop и выбранного `desktop-linux` daemon; Compose, отдельная приватная папка и ownership receipt, backup, readiness, проверяемый cleanup/remove. На Apple Silicon amd64-эмуляция требует явного согласия. Доверие локальному CA — отдельный выбор. | Настоящие Docker Desktop first-run/permissions; install, resume, update/reconfigure, backup/restore, data retention и явный erase, чужие Docker ресурсы, CA trust/removal. Emulation не равна проверке нативного arm64 server image. |
| SSH сервер | Fingerprint verification, password/private/generated key, проверка свежего key login; ограниченный Ubuntu 22.04/24.04 x86_64 root workflow, bootstrap и тот же lifecycle/receipt. Пароли и ключи не передаются в argv. Принятие совместимого Windows-managed VPS реализовано вместе с четырьмя независимыми исправлениями; контрактный Python-набор из 26 тестов прошёл. | Реальный доверенный host, изменённый fingerprint, fresh-key login, install/update/remove, принятие совместимой существующей установки на настоящем VPS, reconnect после отмены/обрыва и проверка сохранения данных. |
| Обновление клиента | Проверка release identity, архитектуры и SHA256; ручное открытие DMG после согласия. Никакого утверждения об установленном обновлении только по успешному `/usr/bin/open`. | Реальная замена app, запуск новой версии, сохранение userData и пользовательских серверных данных. |

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
Microsoft Office. Native input fixture измеряет реальные CGEvents и capture своей
синтетической сцены, но не заменяет физические held-key/multimonitor проверки.
`--self-test`, API probe и компиляция не доказывают OS effect. Недоступные GUI,
устройства или разрешения дают `NOT VERIFIED`, а не PASS изоляции/ввода.

Для каждого фактического результата нужны source SHA, arm64 либо Intel x64,
версия macOS/SDK/Office, состояние разрешений, команда/сценарий и сохранённые
JSON/log/PNG или измерения удалённого трека. Оба архитектурных jobs и реальные
сценарии приёмки должны быть оценены отдельно. Manifest после полной ресурсной
сборки сохраняет `fullParity:false`, `runtimeValidated:false` и
`portStatus:awaiting-native-acceptance`; capability flags описывают включённые
адаптеры, а не подтверждённую совместимость.

Минимальный deployment target macOS 13.0 выбран для ScreenCaptureKit audio API.
Он не доказывает запуск Electron, helpers, Office или Docker Desktop на macOS 13.
Нижняя фактически поддержанная версия устанавливается только результатами запуска
всех требуемых компонентов; старые системы этим кандидатом не поддерживаются.
