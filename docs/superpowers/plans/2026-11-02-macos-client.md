# CastLink macOS arm64 + Intel x64 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Полный функциональный перенос выпущенного Windows-клиента на Apple Silicon arm64 и Intel x64 с отдельными нативными сборками и проверками GitHub Actions.
**Architecture:** Общие Electron UI, IPC и сетевые контракты сохраняются. Платформенные адаптеры выбираются только в main; helpers macOS используют фиксированные протоколы и проверяют системные права, идентичность источника и сроки полномочий.
**Tech Stack:** Electron 44.9.0, electron-builder 26.15.3, pnpm 9.15.0, Node.js 22 для разработки, Swift/Objective-C и macOS frameworks для helpers.
**Spec:** ../specs/2026-11-01-macos-client-design.md — согласован 2026-11-02, Intel обязателен.

## Global Constraints
- Только публичный resokol/castlink. Эталон: client-v1.0.0-rc.9-a994895c5fa9, SHA a994895c5fa976a073965f845ba23a4f61f94387; повторно подтверждён 2026-11-02.
- Обязательные архитектуры — Apple Silicon arm64 (включая M1) и Intel x64. Одинаковый функциональный объём; отсутствие проверки одной архитектуры не считается успехом двухархитектурного выпуска.
- Отдельные app/DMG/ZIP, не требующие Rosetta. Universal bundle не нужен для выполнения требования.
- Сохранить полный клиент: media, remote input, PowerPoint/PDF, browser helpers, локальный серверный мастер/Ubuntu SSH, обновления и языки RU/EN/zh-CN.
- Минимальную macOS зафиксировать по доказанной совместимости Electron и необходимых API до первого кандидата; Intel не означает поддержку любой старой macOS.
- Изоляция renderer, локальное согласие, capture identity, lease/MAC/replay checks и независимый Stop сохраняются.
- Неподтверждённые native возможности не рекламируются, пропущенная OS-проверка обозначается NOT VERIFIED.
- GitHub Actions artifacts — промежуточные кандидаты. Публичные releases, существующие теги и assets не изменять этим планом.
- Файлы, отсутствующие в последнем публичном выпуске, создаются заново; приватные исходники не импортировать.
- Изменения актуального main переносить только отдельным рассмотренным diff. Перед PR проверить интеграцию с main, сохранив эталон выпущенного поведения.

## Review Focus
1. Intel-пакет или обновление содержит arm64 helper: проверять Mach-O каждого executable и архитектуру текущего процесса (задачи 1, 8, 9).
2. TCC отозван после выдачи remote grant: прекращать ввод и освобождать удержания, сохраняя независимые media (задачи 2, 5).
3. PID/window ID переиспользован или окно перемещено между Retina-мониторами: не переключать источник молча (задачи 3–5).
4. Поздний ответ native helper или двойной клик выполняет команду в новой презентации: generation/commandId/deadline не допускают эффект (задача 4).
5. Прерванное обновление, путь с пробелами, повреждённый ZIP или неверный SHA: старое приложение и настройки остаются доступны (задача 8).

## Карта файлов и порядок
План разделён на проверяемые подсистемы; каждая задача — самостоятельный коммит после своих тестов.
Единственный исполнитель владеет общими main.cjs, preload.cjs и packaging integration; при делегировании их не редактируют параллельно.
Зависимости: 1 → 2 → 3/4/5; 6 после 2–5; 7 после 1–2; 8 после 2; 9 после 3–8; 10 после 9.
Задача 1 подтверждает технические предпосылки; если API не обеспечивает контракт, продолжать независимые задачи, записать точное ограничение, не подменять функцию.

### Task 1: Доказать доступность двух нативных runner и API
**Files:** создать .github/workflows/macos-client.yml, scripts/macos-client-preflight.mjs, scripts/tests/macos-client-preflight.test.mjs, docs/testing/MACOS_CLIENT_MATRIX_RU.md.
**Interfaces:** preflight({platform, arch, expectedArch}) возвращает проверенное darwin/arm64 либо darwin/x64, остальные сочетания отклоняет. CLI: node scripts/macos-client-preflight.mjs arm64|x64.
- [ ] Создать изолированную ветку feat/macos-client от подтверждённого публичного тега, сохранить согласованные документы; не использовать старый studiolink.
- [ ] Тесты: assert.throws(() => preflight({platform:'darwin',arch:'arm64',expectedArch:'x64'})); assert.equal(preflight({platform:'darwin',arch:'x64',expectedArch:'x64'}).arch,'x64'); Linux и Rosetta-процесс arm64 job отклоняются.
- [ ] Запустить node --test scripts/tests/macos-client-preflight.test.mjs, сначала FAIL отсутствующего модуля, затем реализовать проверки и получить PASS.
- [ ] Workflow: push только feat/macos-client и workflow_dispatch; contents:read, fail-fast:false, arm64 на macos-15 и x64 на macos-15-intel. Проверить фактические uname/process.arch/sysctl Rosetta, Xcode/Swift/SDK, версию macOS, доступные дисплеи и Electron launch. Никаких private-repository условий из старых workflows.
- [ ] На каждом runner собрать минимальные native probes ScreenCaptureKit, Accessibility/CGEvent, Automation; различать compile PASS, permission denied и фактическую OS-операцию. Проверить наличие PowerPoint без его автоматической активации/лицензирования.
- [ ] Записать в матрицу source SHA, архитектуру, SDK, minimum deployment target, runner/Office/TCC ограничения и полный список действий клиента, найденный в публичных main/preload/UI/helpers.
- [ ] Коммит ci: verify macOS arm64 and Intel prerequisites. Запустить Actions на этом SHA; сохранить ссылки и проверить оба результата. При недоступной метке подобрать поддерживаемый нативный runner той же архитектуры, а не пропускать job.

### Task 2: macOS lifecycle, разрешения и выбор платформы
**Files:** создать apps/desktop/src/macos-platform.cjs, apps/desktop/tests/macos-platform.test.cjs; изменить src/main.cjs, permissions.cjs, native-presentation-desktop.cjs и tests/main-runtime.test.cjs.
**Interfaces:** createMacPermissionAdapter({systemPreferences,openSettings}) → {status(kind),request(kind)}; kind строго microphone|camera|screen|accessibility|automation. Результат {granted:boolean,reason:string|null}; grant приложения и системное разрешение остаются раздельными.
- [ ] Тесты assert.equal((await denied.request('camera')).granted,false); late permission callback после закрытия окна не открывает capture; неизвестный kind отклоняется.
- [ ] Run node --test apps/desktop/tests/macos-platform.test.cjs: FAIL → реализовать TCC API по поддержке вида права → PASS. Для отсутствующего API явный отказ/инструкция, без изменения TCC database.
- [ ] Подключить macOS app menu, Cmd shortcuts, activate/dock lifecycle и open-url до ready. Сохранить три URI scheme и проверку доверенных ссылок для холодного/тёплого запуска, отдельные helper modes.
- [ ] Добавить runtime assertions: повторный URI не создаёт лишний grant; Hide не Stop; Quit подтверждает выход из активной комнаты.
- [ ] Проверить macos-platform, main-runtime, permissions, deep-link, helper launch tests; затем desktop:test. Коммит feat: add macOS lifecycle and permission adapters.

### Task 3: Захват экрана и изолированного звука
**Files:** создать native/macos-process-audio/{ProcessAudio.swift,PROTOCOL.md}, apps/desktop/scripts/build-macos-native.cjs, apps/desktop/tests/macos-process-audio.test.cjs; изменить src/{capture,process-audio,main,remote-pc-capture,remote-pc-helper}.cjs.
**Interfaces:** сохранить createProcessAudioAdapter(...).start({sourceId,enabled,onFrame,onError,onEnded}) → {ready,stop}. Native output CLPA0001: 48000 Hz, 2 channels, Float32; frames 1..4800; ограничение буфера 131072. Новый source ID разрешается main в подтверждённый macOS window/application identity, не в Windows HWND.
- [ ] Тесты: enabled:false отклоняется; подмена sourceId/PID прекращает поток; чужое приложение и собственный CastLink не включаются в audio filter; malformed PCM и EOF завершают capture.
- [ ] node --test apps/desktop/tests/macos-process-audio.test.cjs: сначала FAIL, реализовать ScreenCaptureKit helper и адаптер, затем PASS.
- [ ] build-macos-native.cjs принимает --arch arm64|x64, проверяет текущую нативную архитектуру и строит helpers для согласованного deployment target, без PowerShell/C# ресурсов.
- [ ] Реальные fixtures на каждом runner: известные независимые тоны двух приложений; проверять выбранный тон и отсутствие чужого, mic и return. Нет доступного аудио/TCC — NOT VERIFIED, не подмена синтетическим PASS.
- [ ] Проверить source identity, disconnect и Stop отдельно от камеры/микрофона. Прогнать process-audio, capture, preload-audio и remote-pc-capture regression. Коммит feat: capture selected application audio on macOS.

### Task 4: Оригинальный PowerPoint и PDF
**Files:** создать src/{macos-powerpoint,macos-window-slides}.cjs, native/macos-presentation/{PowerPoint.applescript,WindowSlides.swift,PROTOCOL.md}, tests/{macos-powerpoint,macos-window-slides}.test.cjs внутри desktop для src/tests; изменить src/native-presentation-desktop.cjs и presentation-helper.cjs.
**Interfaces:** macOS PowerPoint controller сохраняет prepare/start/connect/connectBrowser/connectShared/status/goTo/step/disconnect/cancelPending/cancelSharedCapture/dispose текущего Windows controller; PDF сохраняет prepare/start/status/step/disconnect/cancelPending/dispose. Renderer получает прежние opaque IDs и статусы, не OS targets.
- [ ] Тесты: prepare не вызывает start; повторный commandId выполняет step один раз; просроченный step не доходит до native; изменённая binding/window identity отказывает; late callback прежнего grant не изменяет новый.
- [ ] node --test apps/desktop/tests/macos-powerpoint.test.cjs apps/desktop/tests/macos-window-slides.test.cjs: FAIL → реализовать фиксированные Automation/Accessibility операции → PASS.
- [ ] PowerPoint uses data arguments, без интерполяции путей/команд в AppleScript source; точная привязка документа/показа/окна и process lifetime. Проверить следующий/предыдущий animation step, goto, state и media на реальном Office; отсутствие Office не выдавать за поддержанный сценарий.
- [ ] PDF-команды ограничены выбранным поддерживаемым окном; смена foreground/идентичности запрещает effect. Произвольный глобальный PageDown запрещён.
- [ ] Прогнать native-presentation, powerpoint, window-slides и presentation-helper regressions; реальные PPTX/PDF fixtures на обеих архитектурах. Коммит feat: add macOS native presentation adapters.

### Task 5: Удалённый ввод с сохранением защитных контрактов
**Files:** создать native/macos-remote-input/{RemoteInput.swift,PROTOCOL.md,CoreFixture.swift}, apps/desktop/tests/macos-remote-input.test.cjs; изменить src/{remote-pc-input,remote-pc-capture,remote-pc-desktop}.cjs.
**Interfaces:** сохраняются bind/geometry/activate/renew/input/releaseAll/retireAuthority/stop. Источник macOS window = {kind:'window',windowId:string}; screen = {kind:'screen',displayId:string}; helper дополнительно связывает PID/start identity. mapping.kind = macos-window|macos-display, Windows dwm-frame/win32-monitor сохраняются.
- [ ] Тесты: input до grant запрещён; lease >750 ms отклоняется; stale/replayed seq не создаёт event; EOF, TCC revoke, geometry change и timeout освобождают только удалённые удержания.
- [ ] node --test apps/desktop/tests/macos-remote-input.test.cjs: FAIL → реализовать main adapter и native CGEvent/Accessibility backend → PASS.
- [ ] Native independent monotonic watchdog: receiver silence500ms, lease максимум750ms; после pause нужен новый разрешённый serial и empty heartbeat. Preserve retireAuthority без retarget.
- [ ] CoreFixture проверяет state machine без OS effects; реальные marker/window fixtures проверяют crop origin и Retina/display coordinate mapping, occlusion, клавиатурные раскладки, text, физические удержания и Cmd keys.
- [ ] Native event injection только в отдельное тестовое окно по подтверждённому grant. Revoke оставляет share/audio; Stop завершает capture. Прогнать remote-pc input/session/bridge/protocol/toolbar suites. Коммит feat: implement macOS remote input backend.

### Task 6: Сквозная интеграция всех режимов клиента
**Files:** изменить src/{main,preload,presentation-helper,remote-pc-helper,screen-share-main,native-presentation}.cjs; добавить tests/macos-client-integration.test.cjs; обновить ui только для реальных macOS состояний/переводов.
**Interfaces:** существующие castlinkDesktop bridge методы и versioned capabilities сохраняются; capability true только при реально доступном helper/permission/API. Веб-клиент не получает новые shell полномочия.
- [ ] Тесты: full desktop, browser remote helper и presenter используют один платформенный backend; missing helper не рекламирует возможность; отмена выбора источника не публикует трек.
- [ ] Integration test FAIL → подключить результаты задач2–5 → PASS. Не включать готовность по одному наличию файла без проверки native protocol version.
- [ ] Прогнать desktop:test и typecheck, проверить приглашение/роль/reconnect, поддерживаемые codecs, floating panels, Stop/Hide, смену сервера, RU/EN/zh-CN.
- [ ] По полной матрице Task1 проверить, что все пользовательские действия покрыты, включая дополнительные modes и варианты packaging. Коммит feat: integrate complete macOS desktop modes.

### Task 7: Встроенный серверный мастер
**Files:** создать src/macos-setup.cjs, ui/{macos-setup.html,macos-setup.js}, tests/macos-setup.test.cjs в apps/desktop; изменить src/setup.cjs, main.cjs и scripts/setup-resources.cjs.
**Interfaces:** createSetupAdapter(...).launch(action,locale,folder) сохраняет install|update|remove и существующий ответ started:true, который не означает завершённую установку. Новый macOS controller выполняет только typed operations выбранной установки.
- [ ] Тесты: update/remove чужого path/receipt запрещён; cancel не меняет конфигурацию; запуск GUI не возвращает installed:true; SSH failure сохраняет текущую установку.
- [ ] node --test apps/desktop/tests/macos-setup.test.cjs: FAIL → реализовать GUI на общей дизайн-системе и адаптер существующих public provisioning операций → PASS.
- [ ] Проверить Docker Desktop readiness и архитектуры каждого server image отдельно: arm64 native при наличии image или явно проверенная amd64 эмуляция. До доказательства стек не объявляется работающим.
- [ ] Сохранить passwords/volume identity/operation locks/current+previous retention, SSH host verification, quick/advanced и saved update. Никакого общего prune.
- [ ] Реальные install/update/remove только на одноразовых тестовых установках; macOS hosted Docker ограничения записать в матрице. Прогнать setup/setup-resources и профильные provisioning tests. Коммит feat: support server management from macOS client.

### Task 8: Обновление правильного macOS-пакета
**Files:** создать src/macos-update.cjs, tests/macos-update.test.cjs; изменить src/updates.cjs, main.cjs, scripts/package-files.cjs и tests/updates.test.cjs.
**Interfaces:** selectUpdate(releases,current,{platform=process.platform,arch=process.arch}={}); Windows сохраняет -setup.exe, darwin выбирает CastLink-Client-<version>-<sha12>-mac-<arm64|x64>.dmg. downloadInstaller сохраняет {file,cleanup}; macOS installer adapter открывает проверенный DMG после согласия и ведёт явную установку app с сохранением userData.
- [ ] Тесты: при current arch=x64 arm64-only release даёт null; неверный SHA, duplicate asset, иной release URL и неверная архитектура не запускают installer; cancel не закрывает сеанс.
- [ ] node --test apps/desktop/tests/macos-update.test.cjs apps/desktop/tests/updates.test.cjs: FAIL → реализовать платформенный выбор/инсталляцию → PASS.
- [ ] Сохранить separate server/client tracks, настройку авто-проверки, ручную проверку и два согласия. SHA256 всегда из того же выпуска. Не переносить фиксы main без отдельного сверенного diff.
- [ ] Проверить реальную установку/обновление DMG на обоих runners с пробелами/Unicode в path, сохраняемыми настройками, read-only destination и прерыванием; не объявлять spawn(open) завершённым обновлением.
- [ ] Коммит feat: select and install macOS architecture-specific updates.

### Task 9: Полные пакеты и двухархитектурный CI
**Files:** создать apps/desktop/scripts/package-macos.cjs, apps/desktop/build/entitlements.mac.plist, tests/macos-package.test.cjs, tests/macos-smoke.cjs; изменить electron-builder.yml, package.json, scripts/package-files.cjs и .github/workflows/macos-client.yml.
**Interfaces:** pnpm --filter @castlink/desktop package:mac -- --arch arm64|x64; artifacts/desktop/<sha12>/mac-<arch>/; app, DMG, ZIP, manifest.json, SHA256SUMS. manifest содержит sourceCommit, platform, arch, deployment target, native protocol versions и фактический signature status.
- [ ] Тесты: dirty source запрещён; x64 package с arm64 helper запрещён; Windows .exe/.ps1 не входят в macOS payload; обязательные native resources отсутствуют → build fail.
- [ ] node --test apps/desktop/tests/macos-package.test.cjs: FAIL → реализовать staging/config/Info.plist/permissions/descriptions/icons/helpers → PASS.
- [ ] На обеих архитектурах строить все native components, проверять file/lipo/otool и deployment targets, запускать установленный app и URL schemes из собранного пакета. Проверять отсутствие незапакованных runtime dependencies.
- [ ] Signing: ad-hoc candidate отмечается явно; Developer ID hardened runtime/notarization только при имеющихся credentials, проверять codesign/spctl/staple и entitlement каждого helper. Не запрашивать/публиковать секреты в логах.
- [ ] Upload-artifact с уникальным arch+SHA, SHA256 readback; не создавать release. Separate aggregate job требует успеха обоих build jobs, при этом NOT VERIFIED acceptance остаётся видимым и блокирует full-parity claim.
- [ ] Коммит build: package complete macOS client for arm64 and Intel.

### Task 10: Итоговая приёмка и документация
**Files:** docs/testing/MACOS_CLIENT_MATRIX_RU.md, apps/desktop/README.md, distribution/INSTALL.md и соответствующие существующие EN/zh-CN руководства; профильные macOS acceptance fixtures в apps/desktop/tests.
**Interfaces:** строка матрицы = feature + architecture + source SHA + evidence URL + PASS|FAIL|NOT VERIFIED; полнота — все строки обязательных сценариев имеют PASS.
- [ ] Добавить проверку матрицы: отсутствие Intel строки/источника или NOT VERIFIED не допускает overall complete=true. Провалить тест на неполном fixture, реализовать evaluator, подтвердить PASS теста.
- [ ] Выполнить обе native suites и packaged app smoke, desktop:test, pnpm typecheck, pnpm test:ci, pnpm build и профильные Windows-native regressions общего кода. Baseline failures воспроизвести отдельно, не скрывать.
- [ ] Проверить реальный PowerPoint/audio isolation/remote input/TCC/Spaces/Retina, server management и installer/update на обеих архитектурах; внешние интерактивные зависимости не подменять mock.
- [ ] Сверить public main diff и подготовить PR совместимый с актуальным main; до merge повторить только затронутые проверки. Документировать API/OS floor, версии Office, ограничения окружения, подпись и инструкции.
- [ ] Финальное независимое review diff и matrix. Коммит docs: document macOS client validation and installation. Итоговый отчёт отличает выполненные проверки от блокирующих, не объявляет выпуск готовым до полного PASS.

## Execution handoff
Рекомендуется основной исполнитель в текущей сессии (Native): общие IPC/lifecycle/native interfaces сильно связаны; отдельная независимая проверка всего diff перед завершением. При выборе работы отдельными исполнителями владельцы файлов назначаются по задаче, shared integration остаётся у координатора.
План подготовлен и проверен на покрытие согласованного дизайна; код ещё не менялся, GitHub workflow не запускался. Для native API/Office и интерактивных hosted runner ограничений предусмотрены явные ранние проверки, а не допущения об успешности.

