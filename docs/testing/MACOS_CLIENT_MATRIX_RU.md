# macOS client: реализация и проверка переноса

База: публичный `client-v1.0.0-rc.9-a994895c5fa9`; рабочая ветка `feat/macos-client`.
Обязательные архитектуры: нативные arm64 и Intel x64. Rosetta не заменяет Intel-проверку.
Пакет остаётся development candidate, без заявления о полном паритете и без публичного выпуска.

В исходниках реализованы macOS-адаптеры перечисленных ниже функций. Контрактные
тесты на Linux проверяют валидацию, состояние и транспорт; они не доказывают работу
macOS API, Office, разрешений или Docker Desktop. Ниже `NOT VERIFIED` означает, что
реальное принятие функции на указанной архитектуре ещё не подтверждено сохранёнными
результатами. Наличие workflow или тестовой оснастки не считается её успешным запуском.

| Проверка | arm64 | Intel x64 |
| --- | --- | --- |
| Нативный runner / SDK / архитектура Mach-O | NOT VERIFIED — ожидает Actions | NOT VERIFIED — ожидает Actions |
| Desktop contracts на macOS | NOT VERIFIED — ожидает Actions | NOT VERIFIED — ожидает Actions |
| Компиляция Swift / JXA / наблюдение API | NOT VERIFIED — ожидает Actions | NOT VERIFIED — ожидает Actions |
| app / DMG / ZIP, ресурсы и встроенный Python | NOT VERIFIED — ожидает Actions | NOT VERIFIED — ожидает Actions |
| Запуск упакованного приложения / protocol launch | NOT VERIFIED | NOT VERIFIED |
| Камера / микрофон / Screen Recording TCC | NOT VERIFIED | NOT VERIFIED |
| Изолированный звук приложения PowerPoint | Реализован; OS / Office NOT VERIFIED | Реализован; OS / Office NOT VERIFIED |
| PowerPoint: оригинальный PPTX, start/status/step/goto | Реализован; Office NOT VERIFIED | Реализован; Office NOT VERIFIED |
| PDF: выбранное окно Preview, next/previous | Реализован; Preview / AX NOT VERIFIED | Реализован; Preview / AX NOT VERIFIED |
| Browser presenter → локальный PowerPoint helper | Реализован; полный сценарий NOT VERIFIED | Реализован; полный сценарий NOT VERIFIED |
| Remote input / geometry / watchdog / reclaim | Реализован; OS input NOT VERIFIED | Реализован; OS input NOT VERIFIED |
| Локальный server setup / Docker Desktop | Реализован; установка / update / remove NOT VERIFIED | Реализован; установка / update / remove NOT VERIFIED |
| SSH setup / ключи / Ubuntu / update / remove | Реализован; реальный SSH-сценарий NOT VERIFIED | Реализован; реальный SSH-сценарий NOT VERIFIED |
| Обновление клиента через DMG / сохранение данных | Контрактные тесты; OS NOT VERIFIED | Контрактные тесты; OS NOT VERIFIED |

## Области реализации и ограничения

| Функция | Реализованная область исходников | Что требуется подтвердить на macOS |
| --- | --- | --- |
| Сборка | Отдельные arm64/x64 app, ZIP и DMG; Swift helpers, фиксированный JXA, setup-ресурсы и Python. Чистый source SHA, manifest и SHA256SUMS. Development: ad hoc подпись, без notarization. | Нативная архитектура каждого helper/Python, подпись и ресурсная полнота упакованного app; запуск каждой архитектуры. |
| Разрешения | Отдельные camera/microphone/screen/Accessibility/Automation проверки. Automation определяется конкретной операцией PowerPoint. Отказ остаётся конечной ошибкой с локализованной подсказкой, без обхода TCC. | Deny, grant, revoke, повторный запуск и замена сессии во время запроса; фактическая принадлежность TCC app/helper. |
| Звук | ScreenCaptureKit включает только приложение — владельца выбранного окна PowerPoint; CLPA0001, 48 kHz, stereo Float32. Только явный opt-in. PID/launch date/CGWindowID закреплены и перепроверяются; нет fallback на системный звук или микрофон. | Маркеры PowerPoint / другого приложения / возвратного аудио / физического микрофона на удалённом треке; stop, source loss, permission revoke, sleep и reconnect. Несколько презентаций одного приложения имеют общий звуковой scope: отдельный документ/слайд не изолируется. |
| PowerPoint | Выбор и открытие исходного PPTX; привязка к процессу, настоящему окну и документу; start/status и next/previous через проверенный installed scripting dictionary. Goto: числовой shortcut только для точного foreground slideshow, с проверкой фактически полученного номера; неопределённый результат отзывает управление и не повторяется. | Установленные версии Office, оригинальный PPTX с анимациями и media, одношаговые build-переходы, многоразрядный goto и раскладки. Два deck/show, editor/presenter view, fullscreen/Spaces, замена файла/окна/захвата. Отсутствующие click-index/count не выдумываются. |
| PDF | Только локальный PDF в Preview, уникальная AX/CG привязка и явное согласие. Process-targeted PageDown/PageUp требуют выбранное foreground окно и фокус PDF content; search/sidebar/dialog отклоняются. | AX-дерево реального Preview, next/previous, focus loss, подмена PDF, permission revoke, disconnect/deadline. Acrobat, browser PDF tabs и произвольные документы не заявлены. |
| Browser presenter | `castlink-presenter` запускает локальный helper и связывает его с точным владельцем/SID. `browserControl` означает управление локальным PowerPoint из браузерного presenter-сценария. | Полный browser → protocol → local consent → PowerPoint → remote caster сценарий; смена SID/capture и stop. Флаг не означает управление произвольными вкладками браузера. |
| Remote input | Main-only lease ≤750 ms и независимый native watchdog; receiver heartbeat ≤500 ms. CGWindowID + PID/launch date + retained AX window либо display ID + UUID. Полная пауза при недоказанной геометрии/фокусе; replay/gap/barrier checks, releaseAll, retireAuthority, reclaim и локальный stop. Quartz points отделены от backing pixels. | Реальные mouse/key/text и release, occlusion, Retina/отрицательные координаты/несколько дисплеев, Space/lock/sleep, физические held-key/button пересечения и owner takeover. F21–F24 и secure/login desktop не поддерживаются; глобальные shortcut остаются поведением macOS. |
| Локальный сервер | Wizard install/update/remove; проверка provenance Docker Desktop и выбранного `desktop-linux` daemon; Compose, отдельная приватная папка и ownership receipt, backup, readiness, проверяемый cleanup/remove. На Apple Silicon amd64-эмуляция требует явного согласия. Доверие локальному CA — отдельный выбор. | Настоящие Docker Desktop first-run/permissions; install, resume, update/reconfigure, backup/restore, data retention и явный erase, чужие Docker ресурсы, CA trust/removal. Emulation не равна проверке нативного arm64 server image. |
| SSH сервер | Fingerprint verification, password/private/generated key, проверка свежего key login; ограниченный Ubuntu 22.04/24.04 x86_64 root workflow, bootstrap и тот же lifecycle/receipt. Пароли и ключи не передаются в argv. | Реальный доверенный host, изменённый fingerprint, fresh-key login, install/update/remove, reconnect после отмены/обрыва и проверка сохранения данных. |
| Обновление клиента | Проверенный manifest/checksum и ручное открытие DMG нужной архитектуры после согласия. Никакого утверждения об установленном обновлении только по успешному `/usr/bin/open`. | Реальная замена app, запуск новой версии, сохранение userData и пользовательских серверных данных. |

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
