# Полный каталог файлов и прямых связей CastLink

[Оглавление](../MANUAL_RU.md) · [Системы](03_SYSTEMS_RU.md)

Генератор: `node scripts/build-manual-index.mjs`; проверка актуальности: `node scripts/build-manual-index.mjs --check`. Новые файлы сначала добавить в Git index. Каталог включает только файлы Git; реальные `.env`, токены, SSH-ключи, node_modules, runtime и временный QA не инвентаризируются.

Прямые импорты извлечены статически. Динамические загрузки с вычисляемым именем, HTTP, LiveKit events и SQL-связи не выводятся автоматически и разобраны в главе 03. Экспорт — доступный другим модулям символ, а не обязательно публичный HTTP API. Наличие теста в каталоге не означает, что он запускался.

Всего файлов в Git index: **1927**. Каждый файл ниже имеет отдельную запись.

## Корень · 14 файлов

### .dockerignore

[`.dockerignore`](../../.dockerignore)

Какие файлы исключены из Docker build context.

### .gitattributes

[`.gitattributes`](../../.gitattributes)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### .gitignore

[`.gitignore`](../../.gitignore)

Какие локальные/секретные/сгенерированные файлы не включаются в Git.

### AGENTS.md

[`AGENTS.md`](../../AGENTS.md)

CastLink: постоянная команда агентов

### CHANGELOG.md

[`CHANGELOG.md`](../../CHANGELOG.md)

Changelog

### DESIGN.md

[`DESIGN.md`](../../DESIGN.md)

Design System: CastLink preview

### Dockerfile.web

[`Dockerfile.web`](../../Dockerfile.web)

Рецепт сборки web image, включая зависимости, scripts и control-plane SQL.

### LICENSE

[`LICENSE`](../../LICENSE)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### README.md

[`README.md`](../../README.md)

CastLink

### THIRD_PARTY_NOTICES

[`THIRD_PARTY_NOTICES`](../../THIRD_PARTY_NOTICES)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### package.json

[`package.json`](../../package.json)

Версия продукта, команды workspace, pnpm и overrides.

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/web/tests/app-update-api.cjs`](../../apps/web/tests/app-update-api.cjs), [`apps/web/tests/version-api.cjs`](../../apps/web/tests/version-api.cjs).

### pnpm-lock.yaml

[`pnpm-lock.yaml`](../../pnpm-lock.yaml)

Зафиксированный граф версий зависимостей; не редактировать вручную ради обновления UI.

### pnpm-workspace.yaml

[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml)

Список проектов pnpm workspace.

### studiolink.code-workspace

[`studiolink.code-workspace`](../../studiolink.code-workspace)

Настройки редактора и задач разработчика; не production service.

## .github · 9 файлов

### .github/workflows/build-cli.yml

[`.github/workflows/build-cli.yml`](../../.github/workflows/build-cli.yml)

GitHub Actions: Build development CLI packages (NOT INSTALLABLE). Выполняется runner-ом, а не в браузере.

Переменные окружения (только имена): `CLI_TARGET`.

### .github/workflows/build-rc-image.yml

[`.github/workflows/build-rc-image.yml`](../../.github/workflows/build-rc-image.yml)

GitHub Actions: Build RC image. Выполняется runner-ом, а не в браузере.

### .github/workflows/ci.yml

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)

GitHub Actions: CI. Выполняется runner-ом, а не в браузере.

### .github/workflows/easy-setup-packages.yml

[`.github/workflows/easy-setup-packages.yml`](../../.github/workflows/easy-setup-packages.yml)

GitHub Actions: Server setup or standalone Linux release. Выполняется runner-ом, а не в браузере.

Переменные окружения (только имена): `GITHUB_ENV`, `RUNNER_TEMP`.

### .github/workflows/easy-setup-vps-release.yml

[`.github/workflows/easy-setup-vps-release.yml`](../../.github/workflows/easy-setup-vps-release.yml)

GitHub Actions: Private Easy Setup VPS image and manifest (NO DEPLOYMENT). Выполняется runner-ом, а не в браузере.

Переменные окружения (только имена): `BUILD_ID`, `GH_TOKEN`, `GITHUB_EVENT_PATH`, `GITHUB_SHA`, `WEB_DIGEST`, `WEB_IMAGE`.

### .github/workflows/macos-desktop-provenance.yml

[`.github/workflows/macos-desktop-provenance.yml`](../../.github/workflows/macos-desktop-provenance.yml)

GitHub Actions: Private macOS Desktop provenance (no installation). Выполняется runner-ом, а не в браузере.

### .github/workflows/reserve-outbound-test.yml

[`.github/workflows/reserve-outbound-test.yml`](../../.github/workflows/reserve-outbound-test.yml)

GitHub Actions: Reserve outbound test branch. Выполняется runner-ом, а не в браузере.

### .github/workflows/windows-desktop-client.yml

[`.github/workflows/windows-desktop-client.yml`](../../.github/workflows/windows-desktop-client.yml)

GitHub Actions: Windows client release. Выполняется runner-ом, а не в браузере.

### .github/workflows/windows-primary-kernel.yml

[`.github/workflows/windows-primary-kernel.yml`](../../.github/workflows/windows-primary-kernel.yml)

GitHub Actions: Private Windows primary kernel compile (NO EXECUTION). Выполняется runner-ом, а не в браузере.

## .impeccable · 1 файлов

### .impeccable/design.json

[`.impeccable/design.json`](../../.impeccable/design.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

## .vscode · 2 файлов

### .vscode/extensions.json

[`.vscode/extensions.json`](../../.vscode/extensions.json)

Настройки редактора и задач разработчика; не production service.

### .vscode/tasks.json

[`.vscode/tasks.json`](../../.vscode/tasks.json)

Настройки редактора и задач разработчика; не production service.

## apps · 400 файлов

### apps/cli/.gitignore

[`apps/cli/.gitignore`](../../apps/cli/.gitignore)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/package.json

[`apps/cli/package.json`](../../apps/cli/package.json)

Зависимости и команды конкретного подпроекта.

### apps/cli/src/args.ts

[`apps/cli/src/args.ts`](../../apps/cli/src/args.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `ParsedArgs`, `parseArgs`.

### apps/cli/src/backup-archive.ts

[`apps/cli/src/backup-archive.ts`](../../apps/cli/src/backup-archive.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `validateBackupArchive`.

### apps/cli/src/backup-native-output.ts

[`apps/cli/src/backup-native-output.ts`](../../apps/cli/src/backup-native-output.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `backupOutputNames`, `BackupOutputAssociation`, `backupOutputHeader`, `backupOutputFrame`, `backupOutputTerminal`, `BackupOutputAck`, `parseBackupOutputAck`, `nativeBackupOutputPowerShell`.

Библиотеки/Node: `node:path`.

### apps/cli/src/backup-target.ts

[`apps/cli/src/backup-target.ts`](../../apps/cli/src/backup-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `backupTarget`, `guardedBackupTarget`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `node:util`.

### apps/cli/src/backup.ts

[`apps/cli/src/backup.ts`](../../apps/cli/src/backup.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `BackupManifest`, `verifyColdBackup`, `createColdBackup`, `GuardedBackupResult`, `createGuardedColdBackup`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/bundle-preflight.ts

[`apps/cli/src/bundle-preflight.ts`](../../apps/cli/src/bundle-preflight.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `bundlePrerequisiteChecks`.

Библиотеки/Node: `node:dgram`, `node:net`.

### apps/cli/src/bundle.ts

[`apps/cli/src/bundle.ts`](../../apps/cli/src/bundle.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `ReleaseImage`, `ReleaseManifest`, `validateReleaseManifest`, `BundleInput`, `ComposeModel`, `RenderedBundle`, `renderBundle`, `BundleCredentials`, `bundleContents`, `MaterializedBundle`, `materializeBundle`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

### apps/cli/src/compose-port-bindings.ts

[`apps/cli/src/compose-port-bindings.ts`](../../apps/cli/src/compose-port-bindings.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `servicePortBindings`, `pythonServicePortBindings`.

### apps/cli/src/config-target.ts

[`apps/cli/src/config-target.ts`](../../apps/cli/src/config-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `ConfigTargetAssociation`, `TargetMaterializedBundle`, `validateConfigTargetAssociation`, `configTargetNode`, `materializeTargetBundle`, `windowsConfigurationScopeNode`, `initializeWindowsConfigurationScope`.

Библиотеки/Node: `node:crypto`, `node:path`.

### apps/cli/src/database.ts

[`apps/cli/src/database.ts`](../../apps/cli/src/database.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `DatabasePhaseError`, `observeDatabase`, `nodeDatabaseTarget`, `pythonDatabaseTarget`.

Библиотеки/Node: `node:util`.

### apps/cli/src/doctor.ts

[`apps/cli/src/doctor.ts`](../../apps/cli/src/doctor.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `diagnosePrerequisites`.

### apps/cli/src/executors/local.ts

[`apps/cli/src/executors/local.ts`](../../apps/cli/src/executors/local.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `LocalExecutor`.

Библиотеки/Node: `node:child_process`, `node:string_decoder`.

### apps/cli/src/executors/ssh.ts

[`apps/cli/src/executors/ssh.ts`](../../apps/cli/src/executors/ssh.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `sshInvocation`, `SshExecutor`.

Библиотеки/Node: `node:path`.

Переменные окружения (только имена): `S`.

### apps/cli/src/fixed-node-program.ts

[`apps/cli/src/fixed-node-program.ts`](../../apps/cli/src/fixed-node-program.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `windowsCommandLineLength`, `fixedNodeArguments`.

Библиотеки/Node: `node:crypto`, `node:vm`, `node:zlib`.

### apps/cli/src/host-startup-entry.ts

[`apps/cli/src/host-startup-entry.ts`](../../apps/cli/src/host-startup-entry.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `provisionHostControllerRun`, `invoke`, `hostStartupEntry`.

Библиотеки/Node: `node:crypto`, `node:module`, `node:path`, `node:url`.

### apps/cli/src/host-startup-producer-runner.ts

[`apps/cli/src/host-startup-producer-runner.ts`](../../apps/cli/src/host-startup-producer-runner.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `publishHostControllerFromCursor`.

### apps/cli/src/host-startup-producer.ts

[`apps/cli/src/host-startup-producer.ts`](../../apps/cli/src/host-startup-producer.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `HostProducerGeneration`, `HostProducerRequest`, `HostProducerResult`, `produceHostController`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:util`.

### apps/cli/src/host-startup-registration.ts

[`apps/cli/src/host-startup-registration.ts`](../../apps/cli/src/host-startup-registration.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `StartupRegistrationInput`, `StartupRegistrationTemplate`, `renderHostStartupRegistration`.

Библиотеки/Node: `node:path`.

### apps/cli/src/host-startup-state.ts

[`apps/cli/src/host-startup-state.ts`](../../apps/cli/src/host-startup-state.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `DesiredStateGuard`, `readDesiredState`, `writeDesiredState`.

Библиотеки/Node: `node:fs`, `node:path`, `node:util`.

### apps/cli/src/host-startup-target.ts

[`apps/cli/src/host-startup-target.ts`](../../apps/cli/src/host-startup-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `PRIVATE_CONTROL_BINARY_SHA256`, `PRIVATE_CONTROL_IMAGE_ID`, `HostControllerDescriptor`, `loadHostControllerDescriptor`, `createNativeHostControllerRunner`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:util`.

### apps/cli/src/image-provision.ts

[`apps/cli/src/image-provision.ts`](../../apps/cli/src/image-provision.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `ImagesPhaseError`, `ImageIdentity`, `WindowsImageObservation`, `imageFailureContext`, `imagePullRequest`, `selectedImageEngine`, `observePinnedImage`.

Библиотеки/Node: `node:util`.

### apps/cli/src/image-target-runner.ts

[`apps/cli/src/image-target-runner.ts`](../../apps/cli/src/image-target-runner.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `pullPinnedImageTarget`, `recoverPreparedWindowsImageCache`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/image-target.ts

[`apps/cli/src/image-target.ts`](../../apps/cli/src/image-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeImageTarget`, `pythonImageTarget`, `nodeImageObservation`, `pythonImageObservation`.

Библиотеки/Node: `node:util`.

### apps/cli/src/internet-network.ts

[`apps/cli/src/internet-network.ts`](../../apps/cli/src/internet-network.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `InternetConfiguration`, `internetTurnTlsDiagnosis`, `ipv4Octets`, `validateInternetConfiguration`.

### apps/cli/src/journal.ts

[`apps/cli/src/journal.ts`](../../apps/cli/src/journal.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `syncDirectory`, `Journal`, `FileJournal`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

### apps/cli/src/lifecycle-controller.ts

[`apps/cli/src/lifecycle-controller.ts`](../../apps/cli/src/lifecycle-controller.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `PRIVATE_CONTROL_VERSION`, `ControllerAction`, `ControllerAssociation`, `DesiredRecord`, `ControlBinding`, `ControlRequest`, `ControlStatus`, `ControlProof`, `ControlResponse`, `ControllerRequest`, `ControllerEvidence`, `ControllerResult`, `FixedLifecycleRunner`, `HeldControllerTarget`, `FixedControllerTarget`, `validateControllerAssociation`, `controllerAssociationDigest`, `validateDesiredRecord`, `runHostStartupController`, `createLifecycleControllerRunner`.

Библиотеки/Node: `node:crypto`, `node:path`, `node:util`.

### apps/cli/src/lifecycle.ts

[`apps/cli/src/lifecycle.ts`](../../apps/cli/src/lifecycle.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `retainedLifecycleAssociationsEqual`, `runLifecycle`.

Библиотеки/Node: `node:path`, `node:util`.

### apps/cli/src/main.ts

[`apps/cli/src/main.ts`](../../apps/cli/src/main.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `runCli`, `entry`.

Библиотеки/Node: `node:fs`, `node:fs/promises`, `node:path`, `node:process`, `node:readline/promises`, `node:url`.

### apps/cli/src/media-browser-driver.ts

[`apps/cli/src/media-browser-driver.ts`](../../apps/cli/src/media-browser-driver.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `PrivateCdpPipe`, `BrowserDriverMeasurements`, `createUnverifiedPipeBrowserDriver`, `createBuiltinMediaBrowserDriver`, `isBuiltinBrowserEvidence`, `validateCollectedBrowserObservations`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:stream`, `node:util`.

### apps/cli/src/media-browser-target.ts

[`apps/cli/src/media-browser-target.ts`](../../apps/cli/src/media-browser-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `diagnosticBrowserRuntimeDiagnosis`, `GuardedBrowserProcess`, `retainedBrowserTargetAuthority`, `isGuardedBrowserProcess`, `nodeDiagnosticBrowserTarget`, `nodeDiagnosticBrowserObservation`, `nodeDiagnosticBrowserLifetime`, `createGuardedMediaBrowserTarget`.

Библиотеки/Node: `node:child_process`, `node:net`, `node:stream`, `node:util`.

### apps/cli/src/media-check.ts

[`apps/cli/src/media-check.ts`](../../apps/cli/src/media-check.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `GuidedMediaOptions`, `MediaAssociation`, `MediaRoomReceipt`, `MediaMutationRequest`, `MediaMutationTransport`, `MediaClient`, `GuidedBrowserProbe`, `createMediaHttpClient`, `inspectMediaScope`, `diagnoseGuidedMedia`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:https`, `node:path`, `node:util`.

### apps/cli/src/media-evidence.ts

[`apps/cli/src/media-evidence.ts`](../../apps/cli/src/media-evidence.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `MediaEvidenceScope`, `validateBrowserMeasurements`.

Библиотеки/Node: `node:util`.

### apps/cli/src/media-files-target.ts

[`apps/cli/src/media-files-target.ts`](../../apps/cli/src/media-files-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeMediaFilesTarget`, `pythonMediaFilesTarget`.

### apps/cli/src/media-http-target.ts

[`apps/cli/src/media-http-target.ts`](../../apps/cli/src/media-http-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeMediaHttpTarget`, `pythonMediaHttpTarget`, `nodeMediaAdmissionTarget`, `pythonMediaAdmissionTarget`.

### apps/cli/src/media-target-common.ts

[`apps/cli/src/media-target-common.ts`](../../apps/cli/src/media-target-common.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `MediaFileAssociation`, `MediaArtifactAuthority`, `MediaAuthority`, `MediaTargetBinding`, `MediaPrivateArtifact`, `nodeMediaCommon`, `pythonMediaCommon`, `nodeMediaEntry`, `pythonMediaEntry`.

### apps/cli/src/media-target-transport.ts

[`apps/cli/src/media-target-transport.ts`](../../apps/cli/src/media-target-transport.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `GuardedMediaTargetOptions`, `GuardedMediaTransport`, `MediaBrowserAuthority`, `MediaBrowserAuthoritySnapshot`, `captureLocalMediaBrowserAuthority`, `mediaBrowserAuthoritySnapshot`, `assertMediaBrowserAuthorityTarget`, `verifyOriginalMediaBrowserAuthority`, `createGuardedMediaTransport`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/network.ts

[`apps/cli/src/network.ts`](../../apps/cli/src/network.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `BundleNetwork`, `validateBundleNetwork`.

### apps/cli/src/owner.ts

[`apps/cli/src/owner.ts`](../../apps/cli/src/owner.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `OwnerPhaseError`, `OwnerMetadata`, `OwnerHostRequest`, `nodeOwnerTarget`, `pythonOwnerTarget`, `observeOwnerHost`.

Библиотеки/Node: `node:child_process`, `node:fs`, `node:path`, `node:util`.

### apps/cli/src/plan.ts

[`apps/cli/src/plan.ts`](../../apps/cli/src/plan.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `validateProfileName`, `validateRequest`, `createPlan`.

Библиотеки/Node: `node:path`.

### apps/cli/src/private-control-capability.ts

[`apps/cli/src/private-control-capability.ts`](../../apps/cli/src/private-control-capability.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `privateControlCapability`, `PrivateControlCapability`, `validatePrivateControlCapability`, `privateControlReferences`, `assertPrivateControlPlatform`.

Библиотеки/Node: `node:path`, `node:util`.

### apps/cli/src/private-control-target.ts

[`apps/cli/src/private-control-target.ts`](../../apps/cli/src/private-control-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodePrivateControlConfiguration`, `nodePrivateControlServices`, `nodePrivateControlPrimitives`, `nodePrivateControlDocker`.

Библиотеки/Node: `node:util`.

### apps/cli/src/private-volume-capability.ts

[`apps/cli/src/private-volume-capability.ts`](../../apps/cli/src/private-volume-capability.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `privateVolumeCapability`, `PrivateVolumeCapability`, `privateVolumeArtifact`, `isPrivateVolumeCapability`, `privateVolumeReferences`.

Библиотеки/Node: `node:path`, `node:util`.

### apps/cli/src/private-volume-image.ts

[`apps/cli/src/private-volume-image.ts`](../../apps/cli/src/private-volume-image.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `PublisherVolumeImage`, `publisherVolumeImage`.

### apps/cli/src/private-volume-observer-program.ts

[`apps/cli/src/private-volume-observer-program.ts`](../../apps/cli/src/private-volume-observer-program.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodePrivateVolumeObservation`.

### apps/cli/src/private-volume-observer.ts

[`apps/cli/src/private-volume-observer.ts`](../../apps/cli/src/private-volume-observer.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `observeWindowsVolumeTarget`.

Библиотеки/Node: `node:crypto`, `node:path`, `node:util`.

### apps/cli/src/private-volume-protocol.ts

[`apps/cli/src/private-volume-protocol.ts`](../../apps/cli/src/private-volume-protocol.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `VolumeDescriptor`, `GuestIdentity`, `GuestReservation`, `GuestBinding`, `GuestMetadata`, `volumeKeys`, `volumeDescriptor`, `volumeIdentity`, `volumeInspection`, `volumeBinding`, `validateGuestMetadata`, `volumeCommandPlan`.

Библиотеки/Node: `node:util`.

### apps/cli/src/private-volume-target.ts

[`apps/cli/src/private-volume-target.ts`](../../apps/cli/src/private-volume-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodePrivateVolumeCommon`, `nodePrivateVolumeServices`.

### apps/cli/src/probe.ts

[`apps/cli/src/probe.ts`](../../apps/cli/src/probe.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `prerequisiteChecks`, `localChecks`.

Библиотеки/Node: `node:fs`, `node:os`.

Переменные окружения (только имена): `DOCKER_CONTEXT`, `DOCKER_HOST`.

### apps/cli/src/profile.ts

[`apps/cli/src/profile.ts`](../../apps/cli/src/profile.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `profileRoot`.

Библиотеки/Node: `node:os`, `node:path`.

### apps/cli/src/release-availability.ts

[`apps/cli/src/release-availability.ts`](../../apps/cli/src/release-availability.ts)

Read-only registry library: Docker Buildx imagetools через выбранный local/SSH Executor, SHA-256 исходных root/child manifest bytes и наблюдённая Linux-платформа config. Не downloads/runtime/setup/journal verification.

Экспортируемые символы: `releaseAvailabilityChecks`.

Библиотеки/Node: `node:crypto`.

### apps/cli/src/remote-backup-target.ts

[`apps/cli/src/remote-backup-target.ts`](../../apps/cli/src/remote-backup-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `remoteBackupTarget`.

### apps/cli/src/remote-backup.ts

[`apps/cli/src/remote-backup.ts`](../../apps/cli/src/remote-backup.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `RemoteBackupManifest`, `RemoteBackupResult`, `createRemoteColdBackup`, `verifyRemoteColdBackup`.

Библиотеки/Node: `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/remote-bundle.ts

[`apps/cli/src/remote-bundle.ts`](../../apps/cli/src/remote-bundle.ts)

Library-only protected Linux remote bundle writer через выбранный SSH executor: fixed Python/stdin templates, exclusive scope-bound private files, owner/receipt и verified actual-file retry. Caller сохраняет identity/profile lock; setup/runtime/services/owner не подключены.

Экспортируемые символы: `RemoteBundleScope`, `RemoteMaterializedBundle`, `validateRemoteScope`, `inspectRemoteScope`, `materializeRemoteBundle`, `observeRemoteBundle`, `materializeRemoteTargetBundle`.

Библиотеки/Node: `node:crypto`, `node:path`.

### apps/cli/src/render.ts

[`apps/cli/src/render.ts`](../../apps/cli/src/render.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `help`, `renderPlan`, `renderUninstallChecks`, `renderBackupResult`, `renderColdReleaseResult`.

### apps/cli/src/restore-target.ts

[`apps/cli/src/restore-target.ts`](../../apps/cli/src/restore-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `restoreSupport`, `restoreTarget`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `node:util`.

### apps/cli/src/restore.ts

[`apps/cli/src/restore.ts`](../../apps/cli/src/restore.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `ColdRestoreOptions`, `ColdRestoreResult`, `createColdRestore`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/runtime.ts

[`apps/cli/src/runtime.ts`](../../apps/cli/src/runtime.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `runtimeActions`, `ensureRuntime`.

### apps/cli/src/secrets.ts

[`apps/cli/src/secrets.ts`](../../apps/cli/src/secrets.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `protectPath`, `ensurePrivateDirectory`, `writeSecretFile`.

Библиотеки/Node: `node:fs/promises`, `node:path`.

### apps/cli/src/service-target-runner.ts

[`apps/cli/src/service-target-runner.ts`](../../apps/cli/src/service-target-runner.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `runServiceTarget`.

Библиотеки/Node: `node:crypto`, `node:util`.

### apps/cli/src/service-target.ts

[`apps/cli/src/service-target.ts`](../../apps/cli/src/service-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeServiceTarget`, `nodeWindowsVolumeServiceTarget`, `pythonServiceTarget`.

Библиотеки/Node: `node:util`.

### apps/cli/src/services-archive.ts

[`apps/cli/src/services-archive.ts`](../../apps/cli/src/services-archive.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeServiceCaddyArchive`.

### apps/cli/src/services-observer.ts

[`apps/cli/src/services-observer.ts`](../../apps/cli/src/services-observer.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `observeCaddyConfig`.

Библиотеки/Node: `node:child_process`, `node:crypto`.

### apps/cli/src/services-protocol.ts

[`apps/cli/src/services-protocol.ts`](../../apps/cli/src/services-protocol.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `serviceInspectionFormats`, `serviceHashProtocol`, `observeComposeHashes`.

### apps/cli/src/services.ts

[`apps/cli/src/services.ts`](../../apps/cli/src/services.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `serviceNames`, `ServicesPhaseError`, `ServiceContract`, `serviceContract`, `Inventory`, `inventory`, `ownedResources`, `resourceIdentity`.

Библиотеки/Node: `node:crypto`, `node:util`.

### apps/cli/src/setup-target-guard.ts

[`apps/cli/src/setup-target-guard.ts`](../../apps/cli/src/setup-target-guard.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `SetupTargetCursorError`, `retainedTargetCursorDiagnosis`, `unverifiedTargetEffectDiagnosis`, `SetupTargetCursor`, `openSetupTargetCursor`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/setup-verification-target.ts

[`apps/cli/src/setup-verification-target.ts`](../../apps/cli/src/setup-verification-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeObserver`, `pythonObserver`, `nodeAssociationCapture`, `pythonAssociationCapture`, `nodeCompletionTarget`, `pythonCompletionTarget`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:https`, `node:path`, `node:util`.

### apps/cli/src/setup-verification.ts

[`apps/cli/src/setup-verification.ts`](../../apps/cli/src/setup-verification.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `FileAssociation`, `SetupVerificationRequest`, `WindowsSetupContext`, `SetupObservation`, `SetupVerificationError`, `SetupAssociationRequest`, `SetupAssociations`, `captureSetupAssociations`, `observeSetupTarget`, `completeSetupTarget`.

Библиотеки/Node: `node:crypto`, `node:path`, `node:util`.

### apps/cli/src/setup.ts

[`apps/cli/src/setup.ts`](../../apps/cli/src/setup.ts)

Библиотека защищённой локальной подготовки config: preflight, profile identity/lock, exclusive journal reservation/ownership, materialization и сверка receipt/реальных артефактов при retry. Не подключена к setup; runtime/services/migrations/owner не выполняет.

Экспортируемые символы: `PrepareOptions`, `ConfigOptions`, `PreparedConfig`, `WindowsSetupInitializationError`, `windowsSetupDiagnosis`, `initializeWindowsSetupTarget`, `prepareLocalConfig`, `prepareConfig`, `startPreparedServices`, `preparePreparedDatabase`, `provisionPreparedImages`, `preparePreparedOwner`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/state.ts

[`apps/cli/src/state.ts`](../../apps/cli/src/state.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `FileStateStore`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

### apps/cli/src/status.ts

[`apps/cli/src/status.ts`](../../apps/cli/src/status.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `InstallationObservation`, `getStatus`, `observeInstallation`.

Библиотеки/Node: `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/steps.ts

[`apps/cli/src/steps.ts`](../../apps/cli/src/steps.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `SetupResult`, `executeSetup`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/strict-json.ts

[`apps/cli/src/strict-json.ts`](../../apps/cli/src/strict-json.ts)

Ограниченный JSON protocol parser: syntax/UTF-8 replacement/cap и duplicate decoded keys, включая escaped aliases; используется SSH envelope и remote writer response.

Экспортируемые символы: `parseStrictJson`.

### apps/cli/src/target-operation-observer.ts

[`apps/cli/src/target-operation-observer.ts`](../../apps/cli/src/target-operation-observer.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `TargetOperationObservationError`, `nativeWindowsLeaseDiagnosis`, `blockedTargetGenerationDiagnosis`, `TargetPrincipal`, `TargetGeneration`, `observeTargetGeneration`, `validTargetPrincipal`.

Библиотеки/Node: `node:path`.

### apps/cli/src/target-operation.ts

[`apps/cli/src/target-operation.ts`](../../apps/cli/src/target-operation.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeTargetLease`, `pythonTargetLease`, `nodeTargetLeaseObservation`, `pythonTargetLeaseObservation`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`.

Переменные окружения (только имена): `DOCKER_CONTEXT`, `DOCKER_HOST`.

### apps/cli/src/target-private-files.ts

[`apps/cli/src/target-private-files.ts`](../../apps/cli/src/target-private-files.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeTargetPrivateFiles`.

### apps/cli/src/target-sql-guard.ts

[`apps/cli/src/target-sql-guard.ts`](../../apps/cli/src/target-sql-guard.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `TargetSqlGuard`, `nodeSqlGuard`, `pythonSqlGuard`.

### apps/cli/src/types.ts

[`apps/cli/src/types.ts`](../../apps/cli/src/types.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `Target`, `NetworkMode`, `InstallRequest`, `HostFacts`, `StepId`, `InstallPlan`, `CommandResult`, `ExecutionRequest`, `Executor`, `CheckResult`, `Profile`, `StateStore`, `CliDependencies`, `CliError`.

### apps/cli/src/uninstall-context.ts

[`apps/cli/src/uninstall-context.ts`](../../apps/cli/src/uninstall-context.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `observeUninstallContext`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/uninstall-target.ts

[`apps/cli/src/uninstall-target.ts`](../../apps/cli/src/uninstall-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `uninstallDiagnosis`, `UninstallError`, `UninstallReply`, `runUninstallTarget`, `nodeUninstallTarget`, `pythonUninstallTarget`.

### apps/cli/src/uninstall.ts

[`apps/cli/src/uninstall.ts`](../../apps/cli/src/uninstall.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `UninstallOptions`, `uninstall`.

Библиотеки/Node: `node:crypto`, `node:path`, `node:util`.

### apps/cli/src/update-target.ts

[`apps/cli/src/update-target.ts`](../../apps/cli/src/update-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `coldRuntimeObservation`, `coldReleaseFailureSupport`, `coldReleaseProtocol`, `updateTarget`.

Библиотеки/Node: `/app/scripts/runtime-startup-observe-v1.mjs`, `node:fs`.

Переменные окружения (только имена): `DATABASE_URL`.

### apps/cli/src/update.ts

[`apps/cli/src/update.ts`](../../apps/cli/src/update.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `prepareColdUpdate`, `ColdUpdateOptions`, `ColdRollbackOptions`, `ColdReleaseResult`, `runColdUpdate`, `runColdRollback`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`, `node:util`.

### apps/cli/src/windows-config-worker.ts

[`apps/cli/src/windows-config-worker.ts`](../../apps/cli/src/windows-config-worker.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `WindowsConfigProgram`, `windowsConfigWorkerBootstrap`, `runWindowsConfigTarget`.

Библиотеки/Node: `node:worker_threads`.

### apps/cli/src/windows-database-worker.ts

[`apps/cli/src/windows-database-worker.ts`](../../apps/cli/src/windows-database-worker.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `WindowsDatabaseProvider`, `windowsDatabaseWorkerBootstrap`, `runWindowsDatabaseTarget`, `runWindowsOwnerTarget`, `runWindowsGenerationTarget`, `runWindowsAssociationTarget`, `runWindowsSetupObservationTarget`, `runWindowsSetupCompletionTarget`.

Библиотеки/Node: `node:worker_threads`.

### apps/cli/src/windows-docker-context.ts

[`apps/cli/src/windows-docker-context.ts`](../../apps/cli/src/windows-docker-context.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `WindowsDockerContextError`, `NativeContextSelection`, `inspectHeldDockerContext`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:path`.

### apps/cli/src/windows-doctor-diagnostic.ts

[`apps/cli/src/windows-doctor-diagnostic.ts`](../../apps/cli/src/windows-doctor-diagnostic.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `windowsDoctorDiagnostic`.

Библиотеки/Node: `node:fs`.

### apps/cli/src/windows-image-worker-catalog.ts

[`apps/cli/src/windows-image-worker-catalog.ts`](../../apps/cli/src/windows-image-worker-catalog.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nodeWindowsImageWorker`, `nodeWindowsImageRecoveryWorker`.

Библиотеки/Node: `node:util`.

### apps/cli/src/windows-local-preview-image.ts

[`apps/cli/src/windows-local-preview-image.ts`](../../apps/cli/src/windows-local-preview-image.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `publisherWebImage`.

### apps/cli/src/windows-local-preview.ts

[`apps/cli/src/windows-local-preview.ts`](../../apps/cli/src/windows-local-preview.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `windowsLocalPreviewSources`, `windowsLocalPreviewRelease`, `isWindowsLocalPreviewRelease`, `assertWindowsPreviewVersion`, `windowsLocalPreviewOfficialAliases`.

Библиотеки/Node: `node:util`.

### apps/cli/src/windows-native-broker.ts

[`apps/cli/src/windows-native-broker.ts`](../../apps/cli/src/windows-native-broker.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `NativeBrokerError`, `NativeBrokerOperation`, `NativeBrokerSession`, `NativeBrokerChannel`, `createNativeBrokerClient`, `windowsNativeBroker`.

Библиотеки/Node: `node:fs`.

Переменные окружения (только имена): `CASTLINK_NATIVE_REPLY_FD`, `CASTLINK_NATIVE_REQUEST_FD`.

### apps/cli/src/windows-native-preflight.ts

[`apps/cli/src/windows-native-preflight.ts`](../../apps/cli/src/windows-native-preflight.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `NativeWindowsPreflight`, `observeNativeWindowsPreflight`.

### apps/cli/src/windows-native-root.ts

[`apps/cli/src/windows-native-root.ts`](../../apps/cli/src/windows-native-root.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `WindowsRootGuard`, `WindowsRootRequest`, `encodeWindowsRootRequest`, `createWindowsNativeRootAdapter`.

Библиотеки/Node: `node:path`.

### apps/cli/src/windows-native-target.ts

[`apps/cli/src/windows-native-target.ts`](../../apps/cli/src/windows-native-target.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `WindowsTargetLeaseBinding`, `WindowsTargetRequest`, `WindowsNativeTargetError`, `encodeWindowsTargetRequest`, `WindowsReadonlySnapshot`, `WindowsReadonlyTargetRequest`, `encodeWindowsReadonlyTargetRequest`, `WindowsTargetPrivateTransport`, `createWindowsNativeTargetAdapter`, `createWindowsTargetWireTransport`.

Библиотеки/Node: `node:path`.

### apps/cli/src/windows-root-observer.ts

[`apps/cli/src/windows-root-observer.ts`](../../apps/cli/src/windows-root-observer.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `WindowsRootObservation`, `windowsRootObservationProgram`, `WindowsRootObservationError`, `observeWindowsRoot`.

Библиотеки/Node: `node:worker_threads`.

### apps/cli/src/windows-service-worker-catalog.ts

[`apps/cli/src/windows-service-worker-catalog.ts`](../../apps/cli/src/windows-service-worker-catalog.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `windowsServiceRootBridge`, `nodeWindowsServicesWorker`, `nodeWindowsPrivateServicesWorker`, `nodeWindowsServiceCaptureWorker`, `nodeWindowsPrivateObservationWorker`.

### apps/cli/src/windows-service-worker.ts

[`apps/cli/src/windows-service-worker.ts`](../../apps/cli/src/windows-service-worker.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `parseImageRecoveryFailure`, `runWindowsServiceWorker`.

Библиотеки/Node: `node:worker_threads`.

### apps/cli/src/windows-setup-root.ts

[`apps/cli/src/windows-setup-root.ts`](../../apps/cli/src/windows-setup-root.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `windowsProfileRootPowerShell`, `windowsProfileRootNode`.

Библиотеки/Node: `node:fs`, `node:os`, `node:path`.

Переменные окружения (только имена): `CASTLINK_PROFILE_ROOT`, `LOCALAPPDATA`.

### apps/cli/src/windows-target-container-boundary.ts

[`apps/cli/src/windows-target-container-boundary.ts`](../../apps/cli/src/windows-target-container-boundary.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `admitWindowsTargetContainer`.

### apps/cli/src/windows-target-lease.ts

[`apps/cli/src/windows-target-lease.ts`](../../apps/cli/src/windows-target-lease.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `WindowsTargetGeneration`, `windowsTargetBridgePowerShell`, `nativeWindowsTargetLease`, `windowsTargetScopeInitializer`, `windowsTargetLeaseObservation`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:path`, `node:util`.

### apps/cli/src/windows-target-worker-catalog.ts

[`apps/cli/src/windows-target-worker-catalog.ts`](../../apps/cli/src/windows-target-worker-catalog.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `windowsTargetWorkerBridge`, `nodeWindowsSqlGuard`, `nodeWindowsDatabaseTarget`, `nodeWindowsDatabaseWorkerTarget`, `nodeWindowsOwnerTarget`, `nodeWindowsOwnerWorkerTarget`, `windowsGenerationSnapshot`, `nodeWindowsGenerationWorkerTarget`, `nodeWindowsAssociationCapture`, `nodeWindowsAssociationWorkerTarget`, `windowsSetupObservationBridge`, `nodeWindowsObserver`, `nodeWindowsObserverWorkerTarget`, `nodeWindowsCompletionWorkerTarget`.

### apps/cli/src/windows-volume-bind.ts

[`apps/cli/src/windows-volume-bind.ts`](../../apps/cli/src/windows-volume-bind.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `windowsLivekitBindCandidates`, `nodeWindowsLivekitBind`.

Библиотеки/Node: `node:path`.

### apps/cli/src/wizard.ts

[`apps/cli/src/wizard.ts`](../../apps/cli/src/wizard.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `requestFromArgs`.

Библиотеки/Node: `node:os`, `node:path`.

### apps/cli/tests/args.test.mjs

[`apps/cli/tests/args.test.mjs`](../../apps/cli/tests/args.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/backup-cli.test.mjs

[`apps/cli/tests/backup-cli.test.mjs`](../../apps/cli/tests/backup-cli.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `createGuardedColdBackup`, `open`, `observeUninstallContext`, `openSetupTargetCursor`.

Библиотеки/Node: `fs`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/backup-native-output-windows.test.mjs

[`apps/cli/tests/backup-native-output-windows.test.mjs`](../../apps/cli/tests/backup-native-output-windows.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_BACKUP_NATIVE_PROOF`, `CASTLINK_BACKUP_NATIVE_ROOT`.

### apps/cli/tests/backup-native-output.test.mjs

[`apps/cli/tests/backup-native-output.test.mjs`](../../apps/cli/tests/backup-native-output.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/backup.test.mjs

[`apps/cli/tests/backup.test.mjs`](../../apps/cli/tests/backup.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_BACKUP_DOCKER_PROOF`, `DOCKER_HOST`.

### apps/cli/tests/bundle-preflight.test.mjs

[`apps/cli/tests/bundle-preflight.test.mjs`](../../apps/cli/tests/bundle-preflight.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:dgram`, `node:net`, `node:test`.

### apps/cli/tests/bundle.test.mjs

[`apps/cli/tests/bundle.test.mjs`](../../apps/cli/tests/bundle.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:events`, `node:fs/promises`, `node:net`, `node:os`, `node:path`, `node:test`, `node:timers/promises`, `node:util`.

Переменные окружения (только имена): `CASTLINK_TEST_CADDY_BINARY`, `NO_PROXY`.

### apps/cli/tests/config-target.test.mjs

[`apps/cli/tests/config-target.test.mjs`](../../apps/cli/tests/config-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `fs`, `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `os`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/database.test.mjs

[`apps/cli/tests/database.test.mjs`](../../apps/cli/tests/database.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/default-setup.test.mjs

[`apps/cli/tests/default-setup.test.mjs`](../../apps/cli/tests/default-setup.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/doctor.test.mjs

[`apps/cli/tests/doctor.test.mjs`](../../apps/cli/tests/doctor.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/easy-setup.test.mjs

[`apps/cli/tests/easy-setup.test.mjs`](../../apps/cli/tests/easy-setup.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/executors.test.mjs

[`apps/cli/tests/executors.test.mjs`](../../apps/cli/tests/executors.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:test`.

### apps/cli/tests/fixed-node-program.test.mjs

[`apps/cli/tests/fixed-node-program.test.mjs`](../../apps/cli/tests/fixed-node-program.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:test`.

### apps/cli/tests/fixed-target-fixture.mjs

[`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `fixedTargetFixture`, `advanceFixtureTarget`, `resetFixtureTarget`, `retargetFixtureCursor`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`.

Используют: [`apps/cli/tests/backup.test.mjs`](../../apps/cli/tests/backup.test.mjs), [`apps/cli/tests/database.test.mjs`](../../apps/cli/tests/database.test.mjs), [`apps/cli/tests/default-setup.test.mjs`](../../apps/cli/tests/default-setup.test.mjs), [`apps/cli/tests/image-provision.test.mjs`](../../apps/cli/tests/image-provision.test.mjs), [`apps/cli/tests/lifecycle.test.mjs`](../../apps/cli/tests/lifecycle.test.mjs), [`apps/cli/tests/orchestrate.test.mjs`](../../apps/cli/tests/orchestrate.test.mjs), [`apps/cli/tests/owner.test.mjs`](../../apps/cli/tests/owner.test.mjs), [`apps/cli/tests/remote-backup.test.mjs`](../../apps/cli/tests/remote-backup.test.mjs), [`apps/cli/tests/restore.test.mjs`](../../apps/cli/tests/restore.test.mjs), [`apps/cli/tests/services.test.mjs`](../../apps/cli/tests/services.test.mjs), [`apps/cli/tests/setup.test.mjs`](../../apps/cli/tests/setup.test.mjs), [`apps/cli/tests/status.test.mjs`](../../apps/cli/tests/status.test.mjs), [`apps/cli/tests/uninstall.test.mjs`](../../apps/cli/tests/uninstall.test.mjs), [`apps/cli/tests/update.test.mjs`](../../apps/cli/tests/update.test.mjs).

### apps/cli/tests/fixtures/windows-cache-image-result.c

[`apps/cli/tests/fixtures/windows-cache-image-result.c`](../../apps/cli/tests/fixtures/windows-cache-image-result.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-compose-image-selection.c

[`apps/cli/tests/fixtures/windows-compose-image-selection.c`](../../apps/cli/tests/fixtures/windows-compose-image-selection.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-config-route-loader.mjs

[`apps/cli/tests/fixtures/windows-config-route-loader.mjs`](../../apps/cli/tests/fixtures/windows-config-route-loader.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `load`, `runWindowsConfigTarget`.

Библиотеки/Node: `node:path`, `node:worker_threads`.

### apps/cli/tests/fixtures/windows-config-route.mjs

[`apps/cli/tests/fixtures/windows-config-route.mjs`](../../apps/cli/tests/fixtures/windows-config-route.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `fixture`, `missingFs`, `scopeBroker`.

Библиотеки/Node: `node:fs`, `node:module`.

Используют: [`apps/cli/tests/windows-default-profile-root.test.mjs`](../../apps/cli/tests/windows-default-profile-root.test.mjs), [`apps/cli/tests/windows-setup-caller.test.mjs`](../../apps/cli/tests/windows-setup-caller.test.mjs).

### apps/cli/tests/fixtures/windows-image-fixed-plans.c

[`apps/cli/tests/fixtures/windows-image-fixed-plans.c`](../../apps/cli/tests/fixtures/windows-image-fixed-plans.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-image-provenance-format.c

[`apps/cli/tests/fixtures/windows-image-provenance-format.c`](../../apps/cli/tests/fixtures/windows-image-provenance-format.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-private-control-result.c

[`apps/cli/tests/fixtures/windows-private-control-result.c`](../../apps/cli/tests/fixtures/windows-private-control-result.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-private-raw-image-plans.c

[`apps/cli/tests/fixtures/windows-private-raw-image-plans.c`](../../apps/cli/tests/fixtures/windows-private-raw-image-plans.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-private-service-template.go

[`apps/cli/tests/fixtures/windows-private-service-template.go`](../../apps/cli/tests/fixtures/windows-private-service-template.go)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-private-volume-guest.c

[`apps/cli/tests/fixtures/windows-private-volume-guest.c`](../../apps/cli/tests/fixtures/windows-private-volume-guest.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-private-volume-root.c

[`apps/cli/tests/fixtures/windows-private-volume-root.c`](../../apps/cli/tests/fixtures/windows-private-volume-root.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-private-volume-service.c

[`apps/cli/tests/fixtures/windows-private-volume-service.c`](../../apps/cli/tests/fixtures/windows-private-volume-service.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-readonly-target.c

[`apps/cli/tests/fixtures/windows-readonly-target.c`](../../apps/cli/tests/fixtures/windows-readonly-target.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-root-catalog.c

[`apps/cli/tests/fixtures/windows-root-catalog.c`](../../apps/cli/tests/fixtures/windows-root-catalog.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-root-plans.c

[`apps/cli/tests/fixtures/windows-root-plans.c`](../../apps/cli/tests/fixtures/windows-root-plans.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-target-catalog.c

[`apps/cli/tests/fixtures/windows-target-catalog.c`](../../apps/cli/tests/fixtures/windows-target-catalog.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-target-record.c

[`apps/cli/tests/fixtures/windows-target-record.c`](../../apps/cli/tests/fixtures/windows-target-record.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/fixtures/windows-target-route-loader.mjs

[`apps/cli/tests/fixtures/windows-target-route-loader.mjs`](../../apps/cli/tests/fixtures/windows-target-route-loader.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `load`.

Библиотеки/Node: `node:path`, `node:worker_threads`.

### apps/cli/tests/fixtures/windows-target-route.mjs

[`apps/cli/tests/fixtures/windows-target-route.mjs`](../../apps/cli/tests/fixtures/windows-target-route.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `targetFixture`, `missingTargetFs`, `generationProvider`.

Библиотеки/Node: `node:fs`, `node:module`.

Используют: [`apps/cli/tests/windows-setup-caller.test.mjs`](../../apps/cli/tests/windows-setup-caller.test.mjs), [`apps/cli/tests/windows-wrapper-adapters.test.mjs`](../../apps/cli/tests/windows-wrapper-adapters.test.mjs).

### apps/cli/tests/fixtures/windows-target-server-catalog.c

[`apps/cli/tests/fixtures/windows-target-server-catalog.c`](../../apps/cli/tests/fixtures/windows-target-server-catalog.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/cli/tests/host-startup-producer-adapter.test.mjs

[`apps/cli/tests/host-startup-producer-adapter.test.mjs`](../../apps/cli/tests/host-startup-producer-adapter.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/host-startup-producer-fixture.mjs

[`apps/cli/tests/host-startup-producer-fixture.mjs`](../../apps/cli/tests/host-startup-producer-fixture.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `fixture`.

Читает/импортирует: [`apps/cli/tests/host-startup-runner-fixture.mjs`](../../apps/cli/tests/host-startup-runner-fixture.mjs).

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:events`, `node:fs`, `node:https`, `node:path`, `node:stream`, `node:tls`.

Используют: [`apps/cli/tests/host-startup-producer.test.mjs`](../../apps/cli/tests/host-startup-producer.test.mjs).

Переменные окружения (только имена): `FIXTURE_STATE`.

### apps/cli/tests/host-startup-producer.test.mjs

[`apps/cli/tests/host-startup-producer.test.mjs`](../../apps/cli/tests/host-startup-producer.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/host-startup-producer-fixture.mjs`](../../apps/cli/tests/host-startup-producer-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:test`.

Переменные окружения (только имена): `FIXTURE_STATE`.

### apps/cli/tests/host-startup-registration.test.mjs

[`apps/cli/tests/host-startup-registration.test.mjs`](../../apps/cli/tests/host-startup-registration.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/host-startup-runner-fixture.mjs

[`apps/cli/tests/host-startup-runner-fixture.mjs`](../../apps/cli/tests/host-startup-runner-fixture.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `id`, `fixture`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:url`.

Используют: [`apps/cli/tests/host-startup-producer-fixture.mjs`](../../apps/cli/tests/host-startup-producer-fixture.mjs), [`apps/cli/tests/host-startup-target.test.mjs`](../../apps/cli/tests/host-startup-target.test.mjs), [`apps/web/tests/host-runtime-startup-postgres.cjs`](../../apps/web/tests/host-runtime-startup-postgres.cjs).

Переменные окружения (только имена): `FIXTURE_STATE`, `PATH`.

### apps/cli/tests/host-startup-state.test.mjs

[`apps/cli/tests/host-startup-state.test.mjs`](../../apps/cli/tests/host-startup-state.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/host-startup-target.test.mjs

[`apps/cli/tests/host-startup-target.test.mjs`](../../apps/cli/tests/host-startup-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/host-startup-runner-fixture.mjs`](../../apps/cli/tests/host-startup-runner-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:test`.

### apps/cli/tests/image-provision.test.mjs

[`apps/cli/tests/image-provision.test.mjs`](../../apps/cli/tests/image-provision.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/image-target.test.mjs

[`apps/cli/tests/image-target.test.mjs`](../../apps/cli/tests/image-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `FIXTURE_STATE`, `PATH`.

### apps/cli/tests/integration/setup-verification-target.test.mjs

[`apps/cli/tests/integration/setup-verification-target.test.mjs`](../../apps/cli/tests/integration/setup-verification-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:https`, `node:os`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/internet-compose-range.test.mjs

[`apps/cli/tests/internet-compose-range.test.mjs`](../../apps/cli/tests/internet-compose-range.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:test`.

### apps/cli/tests/internet-contract.test.mjs

[`apps/cli/tests/internet-contract.test.mjs`](../../apps/cli/tests/internet-contract.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `INTERNET_TRACE`, `PATH`.

### apps/cli/tests/internet-direct-config.test.mjs

[`apps/cli/tests/internet-direct-config.test.mjs`](../../apps/cli/tests/internet-direct-config.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `CASTLINK_TEST_DIST`, `PATH`.

### apps/cli/tests/internet-direct-tls.test.mjs

[`apps/cli/tests/internet-direct-tls.test.mjs`](../../apps/cli/tests/internet-direct-tls.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:https`, `node:os`, `node:path`, `node:test`, `node:url`, `node:util`.

Переменные окружения (только имена): `CASTLINK_TEST_DIST`, `PATH`.

### apps/cli/tests/internet-direct.test.mjs

[`apps/cli/tests/internet-direct.test.mjs`](../../apps/cli/tests/internet-direct.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `CASTLINK_TEST_DIST`.

### apps/cli/tests/journal.test.mjs

[`apps/cli/tests/journal.test.mjs`](../../apps/cli/tests/journal.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/lifecycle-controller.test.mjs

[`apps/cli/tests/lifecycle-controller.test.mjs`](../../apps/cli/tests/lifecycle-controller.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/lifecycle.test.mjs

[`apps/cli/tests/lifecycle.test.mjs`](../../apps/cli/tests/lifecycle.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/main.test.mjs

[`apps/cli/tests/main.test.mjs`](../../apps/cli/tests/main.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/materialize.test.mjs

[`apps/cli/tests/materialize.test.mjs`](../../apps/cli/tests/materialize.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/media-browser-driver.test.mjs

[`apps/cli/tests/media-browser-driver.test.mjs`](../../apps/cli/tests/media-browser-driver.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/media-browser-target.test.mjs

[`apps/cli/tests/media-browser-target.test.mjs`](../../apps/cli/tests/media-browser-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `${pathToFileURL(path.join(dist,file)).href}`, `${pathToFileURL(targetFile).href}`, `(\.\/[^`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:https`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/media-check.test.mjs

[`apps/cli/tests/media-check.test.mjs`](../../apps/cli/tests/media-check.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:https`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/media-evidence.test.mjs

[`apps/cli/tests/media-evidence.test.mjs`](../../apps/cli/tests/media-evidence.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/media-target.test.mjs

[`apps/cli/tests/media-target.test.mjs`](../../apps/cli/tests/media-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:https`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/network.test.mjs

[`apps/cli/tests/network.test.mjs`](../../apps/cli/tests/network.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/orchestrate.test.mjs

[`apps/cli/tests/orchestrate.test.mjs`](../../apps/cli/tests/orchestrate.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/owner.test.mjs

[`apps/cli/tests/owner.test.mjs`](../../apps/cli/tests/owner.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`, `os`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/plan.test.mjs

[`apps/cli/tests/plan.test.mjs`](../../apps/cli/tests/plan.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/private-control-capability.test.mjs

[`apps/cli/tests/private-control-capability.test.mjs`](../../apps/cli/tests/private-control-capability.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `manifest`.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:test`.

### apps/cli/tests/private-control-config.test.mjs

[`apps/cli/tests/private-control-config.test.mjs`](../../apps/cli/tests/private-control-config.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/private-control-fixture.mjs`](../../apps/cli/tests/private-control-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:test`.

### apps/cli/tests/private-control-fixture.mjs

[`apps/cli/tests/private-control-fixture.mjs`](../../apps/cli/tests/private-control-fixture.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `dist`, `capability`, `configFixture`.

Библиотеки/Node: `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:url`.

Используют: [`apps/cli/tests/private-control-config.test.mjs`](../../apps/cli/tests/private-control-config.test.mjs), [`apps/cli/tests/private-control-services-fixture.mjs`](../../apps/cli/tests/private-control-services-fixture.mjs), [`apps/cli/tests/private-control-setup.test.mjs`](../../apps/cli/tests/private-control-setup.test.mjs).

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/private-control-preflight.test.mjs

[`apps/cli/tests/private-control-preflight.test.mjs`](../../apps/cli/tests/private-control-preflight.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/private-control-services-fixture.mjs

[`apps/cli/tests/private-control-services-fixture.mjs`](../../apps/cli/tests/private-control-services-fixture.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `servicesFixture`.

Читает/импортирует: [`apps/cli/tests/private-control-fixture.mjs`](../../apps/cli/tests/private-control-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`.

Используют: [`apps/cli/tests/private-control-services.test.mjs`](../../apps/cli/tests/private-control-services.test.mjs).

Переменные окружения (только имена): `PATH`, `PC_STATE`, `PC_TRACE`.

### apps/cli/tests/private-control-services.test.mjs

[`apps/cli/tests/private-control-services.test.mjs`](../../apps/cli/tests/private-control-services.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/private-control-services-fixture.mjs`](../../apps/cli/tests/private-control-services-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:test`.

### apps/cli/tests/private-control-setup.test.mjs

[`apps/cli/tests/private-control-setup.test.mjs`](../../apps/cli/tests/private-control-setup.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/private-control-fixture.mjs`](../../apps/cli/tests/private-control-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/probe.test.mjs

[`apps/cli/tests/probe.test.mjs`](../../apps/cli/tests/probe.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/profile-root.test.mjs

[`apps/cli/tests/profile-root.test.mjs`](../../apps/cli/tests/profile-root.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:test`, `node:url`.

### apps/cli/tests/release-availability.test.mjs

[`apps/cli/tests/release-availability.test.mjs`](../../apps/cli/tests/release-availability.test.mjs)

Node:test fixtures документированных OCI/Docker registry metadata: digest/platform binding, malformed/duplicate/oversized responses, redaction, snapshot и SSH argv seam. Без настоящих registry requests/pull или platform acceptance.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:test`.

### apps/cli/tests/remote-backup.test.mjs

[`apps/cli/tests/remote-backup.test.mjs`](../../apps/cli/tests/remote-backup.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_BACKUP_DOCKER_PROOF`, `DOCKER_HOST`, `PATH`.

### apps/cli/tests/remote-bundle.test.mjs

[`apps/cli/tests/remote-bundle.test.mjs`](../../apps/cli/tests/remote-bundle.test.mjs)

Actual local Python helper tests: private artifacts, credential consistency, unchanged retry/lost response, nofollow/perms/hardlinks, fault/concurrency, JSON caps/duplicates/redaction и выбранный SshExecutor stdin seam. Не real SSH/VPS/platform acceptance.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/restore-real.test.mjs

[`apps/cli/tests/restore-real.test.mjs`](../../apps/cli/tests/restore-real.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_RESTORE_DOCKER_PROOF`, `DOCKER_HOST`.

### apps/cli/tests/restore-schema3-fixture.mjs

[`apps/cli/tests/restore-schema3-fixture.mjs`](../../apps/cli/tests/restore-schema3-fixture.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `fixtureDockerSelector`, `fixtureCapacityPaths`, `fixtureDockerEnvironment`.

Библиотеки/Node: `node:path`.

Используют: [`apps/cli/tests/restore-schema3-portable.test.mjs`](../../apps/cli/tests/restore-schema3-portable.test.mjs), [`apps/cli/tests/restore-schema3-real.test.mjs`](../../apps/cli/tests/restore-schema3-real.test.mjs).

### apps/cli/tests/restore-schema3-portable.test.mjs

[`apps/cli/tests/restore-schema3-portable.test.mjs`](../../apps/cli/tests/restore-schema3-portable.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/restore-schema3-fixture.mjs`](../../apps/cli/tests/restore-schema3-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/restore-schema3-real.test.mjs

[`apps/cli/tests/restore-schema3-real.test.mjs`](../../apps/cli/tests/restore-schema3-real.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/restore-schema3-fixture.mjs`](../../apps/cli/tests/restore-schema3-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:module`, `node:test`, `node:url`.

Переменные окружения (только имена): `CASTLINK_RESTORE_SCHEMA3_PROOF`.

### apps/cli/tests/restore-schema3.test.mjs

[`apps/cli/tests/restore-schema3.test.mjs`](../../apps/cli/tests/restore-schema3.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:module`, `node:test`.

### apps/cli/tests/restore-target-bindings.test.mjs

[`apps/cli/tests/restore-target-bindings.test.mjs`](../../apps/cli/tests/restore-target-bindings.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/restore.test.mjs

[`apps/cli/tests/restore.test.mjs`](../../apps/cli/tests/restore.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/runtime.test.mjs

[`apps/cli/tests/runtime.test.mjs`](../../apps/cli/tests/runtime.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/secrets.test.mjs

[`apps/cli/tests/secrets.test.mjs`](../../apps/cli/tests/secrets.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

### apps/cli/tests/service-target.test.mjs

[`apps/cli/tests/service-target.test.mjs`](../../apps/cli/tests/service-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `FIXTURE_STATE`, `PATH`.

### apps/cli/tests/services-hash.test.mjs

[`apps/cli/tests/services-hash.test.mjs`](../../apps/cli/tests/services-hash.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:module`, `node:test`.

Переменные окружения (только имена): `CASTLINK_SERVICE_HASH_DOCKER_PROOF`.

### apps/cli/tests/services-health.test.mjs

[`apps/cli/tests/services-health.test.mjs`](../../apps/cli/tests/services-health.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_SERVICE_HEALTH_DOCKER_PROOF`.

### apps/cli/tests/services-observer.test.mjs

[`apps/cli/tests/services-observer.test.mjs`](../../apps/cli/tests/services-observer.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/services.test.mjs

[`apps/cli/tests/services.test.mjs`](../../apps/cli/tests/services.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/setup-target-cursor.test.mjs

[`apps/cli/tests/setup-target-cursor.test.mjs`](../../apps/cli/tests/setup-target-cursor.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `os`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/setup-target-guard-path.test.mjs

[`apps/cli/tests/setup-target-guard-path.test.mjs`](../../apps/cli/tests/setup-target-guard-path.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/setup-verification.test.mjs

[`apps/cli/tests/setup-verification.test.mjs`](../../apps/cli/tests/setup-verification.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`scripts/setup-observe-v1.mjs`](../../scripts/setup-observe-v1.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/setup.test.mjs

[`apps/cli/tests/setup.test.mjs`](../../apps/cli/tests/setup.test.mjs)

Node:test: локальные protected config/identity/retry, границы сбоев, отказ от регенерации секретов, symlink/permissions, lock и redaction. Не Windows/macOS/SSH/LiveKit acceptance.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/ssh-windows.test.mjs

[`apps/cli/tests/ssh-windows.test.mjs`](../../apps/cli/tests/ssh-windows.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/state.test.mjs

[`apps/cli/tests/state.test.mjs`](../../apps/cli/tests/state.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/status.test.mjs

[`apps/cli/tests/status.test.mjs`](../../apps/cli/tests/status.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `PATH`.

### apps/cli/tests/target-operation.test.mjs

[`apps/cli/tests/target-operation.test.mjs`](../../apps/cli/tests/target-operation.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `fs`, `node:assert/strict`, `node:child_process`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `os`.

### apps/cli/tests/target-sql-guard.test.mjs

[`apps/cli/tests/target-sql-guard.test.mjs`](../../apps/cli/tests/target-sql-guard.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `child_process`, `fs`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:https`, `node:module`, `node:os`, `node:path`, `node:test`, `node:url`, `node:util`, `path`.

Переменные окружения (только имена): `PATH`, `TEST_DATABASE_URL`.

### apps/cli/tests/uninstall-cli.test.mjs

[`apps/cli/tests/uninstall-cli.test.mjs`](../../apps/cli/tests/uninstall-cli.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `uninstall`.

Библиотеки/Node: `node:assert/strict`, `node:module`, `node:test`.

### apps/cli/tests/uninstall-docker.test.mjs

[`apps/cli/tests/uninstall-docker.test.mjs`](../../apps/cli/tests/uninstall-docker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_UNINSTALL_DOCKER_PROOF`, `DOCKER_CONTEXT`, `DOCKER_HOST`.

### apps/cli/tests/uninstall-target.test.mjs

[`apps/cli/tests/uninstall-target.test.mjs`](../../apps/cli/tests/uninstall-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `FIXTURE_STATE`, `PATH`.

### apps/cli/tests/uninstall.test.mjs

[`apps/cli/tests/uninstall.test.mjs`](../../apps/cli/tests/uninstall.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/update-cli.test.mjs

[`apps/cli/tests/update-cli.test.mjs`](../../apps/cli/tests/update-cli.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `runColdUpdate`, `runColdRollback`, `observeTargetGeneration`.

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/update-real.test.mjs

[`apps/cli/tests/update-real.test.mjs`](../../apps/cli/tests/update-real.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_UPDATE_DOCKER_PROOF`, `DOCKER_CONFIG`, `DOCKER_CONTEXT`, `DOCKER_HOST`.

### apps/cli/tests/update-schema3.test.mjs

[`apps/cli/tests/update-schema3.test.mjs`](../../apps/cli/tests/update-schema3.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/update.test.mjs

[`apps/cli/tests/update.test.mjs`](../../apps/cli/tests/update.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixed-target-fixture.mjs`](../../apps/cli/tests/fixed-target-fixture.mjs).

Библиотеки/Node: `/app/scripts/runtime-startup-observe-v1.mjs`, `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/windows-association-worker.test.mjs

[`apps/cli/tests/windows-association-worker.test.mjs`](../../apps/cli/tests/windows-association-worker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:vm`.

### apps/cli/tests/windows-cache-image-result.test.mjs

[`apps/cli/tests/windows-cache-image-result.test.mjs`](../../apps/cli/tests/windows-cache-image-result.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_CACHE_RESULT_BASELINE`.

### apps/cli/tests/windows-caddy-declared-volumes.test.mjs

[`apps/cli/tests/windows-caddy-declared-volumes.test.mjs`](../../apps/cli/tests/windows-caddy-declared-volumes.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `(\.\/[^`, `+JSON.stringify(pathToFileURL(path.join(root,`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:test`, `node:url`, `node:util`, `node:vm`.

Переменные окружения (только имена): `CASTLINK_CADDY_VOLUMES_BASELINE`.

### apps/cli/tests/windows-caddy-resource-template.test.mjs

[`apps/cli/tests/windows-caddy-resource-template.test.mjs`](../../apps/cli/tests/windows-caddy-resource-template.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_TEST_GO`.

### apps/cli/tests/windows-common-target-native.test.mjs

[`apps/cli/tests/windows-common-target-native.test.mjs`](../../apps/cli/tests/windows-common-target-native.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_WINDOWS_PROOF_ROOT`.

### apps/cli/tests/windows-common-target.test.mjs

[`apps/cli/tests/windows-common-target.test.mjs`](../../apps/cli/tests/windows-common-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:test`.

### apps/cli/tests/windows-compose-image-selection.test.mjs

[`apps/cli/tests/windows-compose-image-selection.test.mjs`](../../apps/cli/tests/windows-compose-image-selection.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-config-broker.test.mjs

[`apps/cli/tests/windows-config-broker.test.mjs`](../../apps/cli/tests/windows-config-broker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

Переменные окружения (только имена): `CASTLINK_BROKER_TEST_MODULE`.

### apps/cli/tests/windows-config-public-route.test.mjs

[`apps/cli/tests/windows-config-public-route.test.mjs`](../../apps/cli/tests/windows-config-public-route.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-config-target-native.test.mjs

[`apps/cli/tests/windows-config-target-native.test.mjs`](../../apps/cli/tests/windows-config-target-native.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_WINDOWS_PROOF_ROOT`.

### apps/cli/tests/windows-config-target.test.mjs

[`apps/cli/tests/windows-config-target.test.mjs`](../../apps/cli/tests/windows-config-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:test`, `node:vm`.

### apps/cli/tests/windows-config-worker.test.mjs

[`apps/cli/tests/windows-config-worker.test.mjs`](../../apps/cli/tests/windows-config-worker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:util`, `node:worker_threads`.

Переменные окружения (только имена): `CASTLINK_PROFILE_ROOT`, `CASTLINK_WINDOWS_LEASE_TEST_MODULE`, `LOCALAPPDATA`.

### apps/cli/tests/windows-database-bootstrap.test.mjs

[`apps/cli/tests/windows-database-bootstrap.test.mjs`](../../apps/cli/tests/windows-database-bootstrap.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:test`, `node:vm`.

### apps/cli/tests/windows-database-default-route.test.mjs

[`apps/cli/tests/windows-database-default-route.test.mjs`](../../apps/cli/tests/windows-database-default-route.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-database-worker.test.mjs

[`apps/cli/tests/windows-database-worker.test.mjs`](../../apps/cli/tests/windows-database-worker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:util`, `node:vm`.

### apps/cli/tests/windows-default-profile-root-native.test.mjs

[`apps/cli/tests/windows-default-profile-root-native.test.mjs`](../../apps/cli/tests/windows-default-profile-root-native.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:path`, `node:test`, `node:util`, `node:vm`, `node:zlib`.

Переменные окружения (только имена): `CASTLINK_PROFILE_ROOT`, `CASTLINK_WINDOWS_PROOF_ROOT`, `LOCALAPPDATA`.

### apps/cli/tests/windows-default-profile-root.test.mjs

[`apps/cli/tests/windows-default-profile-root.test.mjs`](../../apps/cli/tests/windows-default-profile-root.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixtures/windows-config-route.mjs`](../../apps/cli/tests/fixtures/windows-config-route.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:vm`.

Переменные окружения (только имена): `CASTLINK_PROFILE_ROOT`, `LOCALAPPDATA`.

### apps/cli/tests/windows-docker-context.test.mjs

[`apps/cli/tests/windows-docker-context.test.mjs`](../../apps/cli/tests/windows-docker-context.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-doctor-diagnostic.test.mjs

[`apps/cli/tests/windows-doctor-diagnostic.test.mjs`](../../apps/cli/tests/windows-doctor-diagnostic.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:test`.

### apps/cli/tests/windows-generation-default-route.test.mjs

[`apps/cli/tests/windows-generation-default-route.test.mjs`](../../apps/cli/tests/windows-generation-default-route.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-generation-worker.test.mjs

[`apps/cli/tests/windows-generation-worker.test.mjs`](../../apps/cli/tests/windows-generation-worker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:util`, `node:vm`.

### apps/cli/tests/windows-image-engine-default-route.test.mjs

[`apps/cli/tests/windows-image-engine-default-route.test.mjs`](../../apps/cli/tests/windows-image-engine-default-route.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-image-failure-provenance.test.mjs

[`apps/cli/tests/windows-image-failure-provenance.test.mjs`](../../apps/cli/tests/windows-image-failure-provenance.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:util`.

### apps/cli/tests/windows-image-fixed-plans.test.mjs

[`apps/cli/tests/windows-image-fixed-plans.test.mjs`](../../apps/cli/tests/windows-image-fixed-plans.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/windows-image-provenance-format.test.mjs

[`apps/cli/tests/windows-image-provenance-format.test.mjs`](../../apps/cli/tests/windows-image-provenance-format.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_IMAGE_PROVENANCE_BASELINE`.

### apps/cli/tests/windows-image-public-route.test.mjs

[`apps/cli/tests/windows-image-public-route.test.mjs`](../../apps/cli/tests/windows-image-public-route.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-image-recovery-channel.test.mjs

[`apps/cli/tests/windows-image-recovery-channel.test.mjs`](../../apps/cli/tests/windows-image-recovery-channel.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:test`.

### apps/cli/tests/windows-image-recovery-cursor.test.mjs

[`apps/cli/tests/windows-image-recovery-cursor.test.mjs`](../../apps/cli/tests/windows-image-recovery-cursor.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:path`, `node:test`, `node:util`.

### apps/cli/tests/windows-image-recovery-execution.test.mjs

[`apps/cli/tests/windows-image-recovery-execution.test.mjs`](../../apps/cli/tests/windows-image-recovery-execution.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/windows-image-recovery-setup-stage.test.mjs

[`apps/cli/tests/windows-image-recovery-setup-stage.test.mjs`](../../apps/cli/tests/windows-image-recovery-setup-stage.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:path`, `node:test`, `node:util`.

### apps/cli/tests/windows-image-worker-execution.test.mjs

[`apps/cli/tests/windows-image-worker-execution.test.mjs`](../../apps/cli/tests/windows-image-worker-execution.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `(\.\/[^`, `+JSON.stringify(pathToFileURL(path.join(root,`, `node:assert/strict`, `node:child_process`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:test`, `node:url`, `node:vm`.

Переменные окружения (только имена): `CASTLINK_CADDY_WORKER_BASELINE`.

### apps/cli/tests/windows-local-preview.test.mjs

[`apps/cli/tests/windows-local-preview.test.mjs`](../../apps/cli/tests/windows-local-preview.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:vm`.

### apps/cli/tests/windows-native-broker.test.mjs

[`apps/cli/tests/windows-native-broker.test.mjs`](../../apps/cli/tests/windows-native-broker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-native-consumers.test.mjs

[`apps/cli/tests/windows-native-consumers.test.mjs`](../../apps/cli/tests/windows-native-consumers.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:test`, `node:vm`.

### apps/cli/tests/windows-native-engine.test.mjs

[`apps/cli/tests/windows-native-engine.test.mjs`](../../apps/cli/tests/windows-native-engine.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:module`, `node:test`, `node:vm`.

### apps/cli/tests/windows-native-preflight.test.mjs

[`apps/cli/tests/windows-native-preflight.test.mjs`](../../apps/cli/tests/windows-native-preflight.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-native-root.test.mjs

[`apps/cli/tests/windows-native-root.test.mjs`](../../apps/cli/tests/windows-native-root.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-native-target.test.mjs

[`apps/cli/tests/windows-native-target.test.mjs`](../../apps/cli/tests/windows-native-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `guard`.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-owner-default-route.test.mjs

[`apps/cli/tests/windows-owner-default-route.test.mjs`](../../apps/cli/tests/windows-owner-default-route.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-owner-worker-catalog.test.mjs

[`apps/cli/tests/windows-owner-worker-catalog.test.mjs`](../../apps/cli/tests/windows-owner-worker-catalog.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:vm`.

### apps/cli/tests/windows-private-control-result.test.mjs

[`apps/cli/tests/windows-private-control-result.test.mjs`](../../apps/cli/tests/windows-private-control-result.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_PRIVATE_CONTROL_BASELINE`.

### apps/cli/tests/windows-private-image-catalog.test.mjs

[`apps/cli/tests/windows-private-image-catalog.test.mjs`](../../apps/cli/tests/windows-private-image-catalog.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-private-publisher-image.test.mjs

[`apps/cli/tests/windows-private-publisher-image.test.mjs`](../../apps/cli/tests/windows-private-publisher-image.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-private-volume-root.test.mjs

[`apps/cli/tests/windows-private-volume-root.test.mjs`](../../apps/cli/tests/windows-private-volume-root.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_TEMPLATE_GO`.

### apps/cli/tests/windows-private-volume-worker.test.mjs

[`apps/cli/tests/windows-private-volume-worker.test.mjs`](../../apps/cli/tests/windows-private-volume-worker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:util`, `node:vm`.

Переменные окружения (только имена): `CASTLINK_PRIVATE_WORKER_BASELINE`, `CASTLINK_VOLUME_RENDER_BASELINE`.

### apps/cli/tests/windows-protected-path-broker.test.mjs

[`apps/cli/tests/windows-protected-path-broker.test.mjs`](../../apps/cli/tests/windows-protected-path-broker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/windows-readonly-native-catalog.test.mjs

[`apps/cli/tests/windows-readonly-native-catalog.test.mjs`](../../apps/cli/tests/windows-readonly-native-catalog.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-readonly-target.test.mjs

[`apps/cli/tests/windows-readonly-target.test.mjs`](../../apps/cli/tests/windows-readonly-target.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-readonly-web-bundle.test.mjs

[`apps/cli/tests/windows-readonly-web-bundle.test.mjs`](../../apps/cli/tests/windows-readonly-web-bundle.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-root-native-catalog.test.mjs

[`apps/cli/tests/windows-root-native-catalog.test.mjs`](../../apps/cli/tests/windows-root-native-catalog.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-root-native-plans.test.mjs

[`apps/cli/tests/windows-root-native-plans.test.mjs`](../../apps/cli/tests/windows-root-native-plans.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-root-observer.test.mjs

[`apps/cli/tests/windows-root-observer.test.mjs`](../../apps/cli/tests/windows-root-observer.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/windows-root-wire.test.mjs

[`apps/cli/tests/windows-root-wire.test.mjs`](../../apps/cli/tests/windows-root-wire.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:test`.

### apps/cli/tests/windows-service-worker-catalog.test.mjs

[`apps/cli/tests/windows-service-worker-catalog.test.mjs`](../../apps/cli/tests/windows-service-worker-catalog.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:vm`.

Переменные окружения (только имена): `CASTLINK_TEST_LEGACY_SERVICE_SOURCE`.

### apps/cli/tests/windows-services-default-route.test.mjs

[`apps/cli/tests/windows-services-default-route.test.mjs`](../../apps/cli/tests/windows-services-default-route.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-setup-caller-native.test.mjs

[`apps/cli/tests/windows-setup-caller-native.test.mjs`](../../apps/cli/tests/windows-setup-caller-native.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:path`, `node:test`, `node:util`, `node:vm`, `node:zlib`.

Переменные окружения (только имена): `CASTLINK_PROFILE_ROOT`, `CASTLINK_WINDOWS_PROOF_ROOT`.

### apps/cli/tests/windows-setup-caller.test.mjs

[`apps/cli/tests/windows-setup-caller.test.mjs`](../../apps/cli/tests/windows-setup-caller.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixtures/windows-config-route.mjs`](../../apps/cli/tests/fixtures/windows-config-route.mjs), [`apps/cli/tests/fixtures/windows-target-route.mjs`](../../apps/cli/tests/fixtures/windows-target-route.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:zlib`.

Переменные окружения (только имена): `CASTLINK_PROFILE_ROOT`.

### apps/cli/tests/windows-setup-completion-worker.test.mjs

[`apps/cli/tests/windows-setup-completion-worker.test.mjs`](../../apps/cli/tests/windows-setup-completion-worker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:path`, `node:test`, `node:util`, `node:vm`.

### apps/cli/tests/windows-setup-default-route.test.mjs

[`apps/cli/tests/windows-setup-default-route.test.mjs`](../../apps/cli/tests/windows-setup-default-route.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:path`, `node:test`.

### apps/cli/tests/windows-setup-observer-worker.test.mjs

[`apps/cli/tests/windows-setup-observer-worker.test.mjs`](../../apps/cli/tests/windows-setup-observer-worker.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:util`, `node:vm`.

### apps/cli/tests/windows-target-container-boundary.test.mjs

[`apps/cli/tests/windows-target-container-boundary.test.mjs`](../../apps/cli/tests/windows-target-container-boundary.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-target-lease.test.mjs

[`apps/cli/tests/windows-target-lease.test.mjs`](../../apps/cli/tests/windows-target-lease.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_WINDOWS_PROOF_ROOT`.

### apps/cli/tests/windows-target-native-catalog.test.mjs

[`apps/cli/tests/windows-target-native-catalog.test.mjs`](../../apps/cli/tests/windows-target-native-catalog.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`scripts/windows-primary-target-helper-inventory.mjs`](../../scripts/windows-primary-target-helper-inventory.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-target-record.test.mjs

[`apps/cli/tests/windows-target-record.test.mjs`](../../apps/cli/tests/windows-target-record.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-target-server-bootstrap.test.mjs

[`apps/cli/tests/windows-target-server-bootstrap.test.mjs`](../../apps/cli/tests/windows-target-server-bootstrap.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:test`, `node:vm`.

### apps/cli/tests/windows-target-server-catalog.test.mjs

[`apps/cli/tests/windows-target-server-catalog.test.mjs`](../../apps/cli/tests/windows-target-server-catalog.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_TARGET_TEST_SOURCE`.

### apps/cli/tests/windows-target-structural-template.test.mjs

[`apps/cli/tests/windows-target-structural-template.test.mjs`](../../apps/cli/tests/windows-target-structural-template.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_TEST_GO`.

### apps/cli/tests/windows-target-worker-catalog.test.mjs

[`apps/cli/tests/windows-target-worker-catalog.test.mjs`](../../apps/cli/tests/windows-target-worker-catalog.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/windows-volume-bounds.test.mjs

[`apps/cli/tests/windows-volume-bounds.test.mjs`](../../apps/cli/tests/windows-volume-bounds.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:test`, `node:vm`.

### apps/cli/tests/windows-volume-capability.test.mjs

[`apps/cli/tests/windows-volume-capability.test.mjs`](../../apps/cli/tests/windows-volume-capability.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-volume-cursor.test.mjs

[`apps/cli/tests/windows-volume-cursor.test.mjs`](../../apps/cli/tests/windows-volume-cursor.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### apps/cli/tests/windows-volume-helper.test.mjs

[`apps/cli/tests/windows-volume-helper.test.mjs`](../../apps/cli/tests/windows-volume-helper.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:path`, `node:test`, `node:util`, `node:vm`.

### apps/cli/tests/windows-volume-pin.test.mjs

[`apps/cli/tests/windows-volume-pin.test.mjs`](../../apps/cli/tests/windows-volume-pin.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:test`, `node:url`.

### apps/cli/tests/windows-volume-protocol.test.mjs

[`apps/cli/tests/windows-volume-protocol.test.mjs`](../../apps/cli/tests/windows-volume-protocol.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/cli/tests/windows-wrapper-adapters-native.test.mjs

[`apps/cli/tests/windows-wrapper-adapters-native.test.mjs`](../../apps/cli/tests/windows-wrapper-adapters-native.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `nativeFixtureReply`, `nativeOwnerStageTrace`.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:path`, `node:test`, `node:util`, `node:vm`, `node:zlib`.

Используют: [`apps/cli/tests/windows-wrapper-native-fixture.test.mjs`](../../apps/cli/tests/windows-wrapper-native-fixture.test.mjs).

Переменные окружения (только имена): `CASTLINK_WINDOWS_PROOF_ROOT`.

### apps/cli/tests/windows-wrapper-adapters.test.mjs

[`apps/cli/tests/windows-wrapper-adapters.test.mjs`](../../apps/cli/tests/windows-wrapper-adapters.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/fixtures/windows-target-route.mjs`](../../apps/cli/tests/fixtures/windows-target-route.mjs).

Библиотеки/Node: `node:assert/strict`, `node:path`, `node:test`, `node:vm`.

### apps/cli/tests/windows-wrapper-native-fixture.test.mjs

[`apps/cli/tests/windows-wrapper-native-fixture.test.mjs`](../../apps/cli/tests/windows-wrapper-native-fixture.test.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/cli/tests/windows-wrapper-adapters-native.test.mjs`](../../apps/cli/tests/windows-wrapper-adapters-native.test.mjs).

Библиотеки/Node: `node:assert/strict`, `node:test`, `node:vm`.

### apps/cli/tsconfig.json

[`apps/cli/tsconfig.json`](../../apps/cli/tsconfig.json)

Параметры проверки TypeScript и разрешения импортов.

### apps/desktop/README.md

[`apps/desktop/README.md`](../../apps/desktop/README.md)

CastLink Client для Windows

### apps/desktop/assets/castlink-icon.ico

[`apps/desktop/assets/castlink-icon.ico`](../../apps/desktop/assets/castlink-icon.ico)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/assets/castlink-icon.svg

[`apps/desktop/assets/castlink-icon.svg`](../../apps/desktop/assets/castlink-icon.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/build/client-preview.nsh

[`apps/desktop/build/client-preview.nsh`](../../apps/desktop/build/client-preview.nsh)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/build/generate-assets.ps1

[`apps/desktop/build/generate-assets.ps1`](../../apps/desktop/build/generate-assets.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/build/installer-header.bmp

[`apps/desktop/build/installer-header.bmp`](../../apps/desktop/build/installer-header.bmp)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/build/installer-sidebar.bmp

[`apps/desktop/build/installer-sidebar.bmp`](../../apps/desktop/build/installer-sidebar.bmp)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/build/installer.nsh

[`apps/desktop/build/installer.nsh`](../../apps/desktop/build/installer.nsh)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/electron-builder.yml

[`apps/desktop/electron-builder.yml`](../../apps/desktop/electron-builder.yml)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/package.json

[`apps/desktop/package.json`](../../apps/desktop/package.json)

Зависимости и команды конкретного подпроекта.

### apps/desktop/scripts/build-process-audio.cjs

[`apps/desktop/scripts/build-process-audio.cjs`](../../apps/desktop/scripts/build-process-audio.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:child_process`, `node:fs`, `node:path`.

Используют: [`apps/desktop/scripts/package-client-preview.cjs`](../../apps/desktop/scripts/package-client-preview.cjs), [`apps/desktop/scripts/package-pptx-test.cjs`](../../apps/desktop/scripts/package-pptx-test.cjs), [`apps/desktop/scripts/package.cjs`](../../apps/desktop/scripts/package.cjs).

Переменные окружения (только имена): `S`.

### apps/desktop/scripts/build-window-slides.cjs

[`apps/desktop/scripts/build-window-slides.cjs`](../../apps/desktop/scripts/build-window-slides.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:child_process`, `node:fs`, `node:path`.

Используют: [`apps/desktop/scripts/package-client-preview.cjs`](../../apps/desktop/scripts/package-client-preview.cjs).

Переменные окружения (только имена): `S`.

### apps/desktop/scripts/package-client-preview.cjs

[`apps/desktop/scripts/package-client-preview.cjs`](../../apps/desktop/scripts/package-client-preview.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/scripts/build-process-audio.cjs`](../../apps/desktop/scripts/build-process-audio.cjs), [`apps/desktop/scripts/build-window-slides.cjs`](../../apps/desktop/scripts/build-window-slides.cjs), [`apps/desktop/scripts/package-files.cjs`](../../apps/desktop/scripts/package-files.cjs).

Библиотеки/Node: `electron-builder`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`.

Используют: [`apps/desktop/tests/client-preview-package.test.cjs`](../../apps/desktop/tests/client-preview-package.test.cjs).

### apps/desktop/scripts/package-files.cjs

[`apps/desktop/scripts/package-files.cjs`](../../apps/desktop/scripts/package-files.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`scripts/release-track.cjs`](../../scripts/release-track.cjs).

Библиотеки/Node: `node:fs`, `node:path`.

Используют: [`apps/desktop/scripts/package-client-preview.cjs`](../../apps/desktop/scripts/package-client-preview.cjs), [`apps/desktop/scripts/package-pptx-test.cjs`](../../apps/desktop/scripts/package-pptx-test.cjs), [`apps/desktop/scripts/package.cjs`](../../apps/desktop/scripts/package.cjs), [`apps/desktop/scripts/verify-pptx-test.cjs`](../../apps/desktop/scripts/verify-pptx-test.cjs), [`apps/desktop/tests/package.test.cjs`](../../apps/desktop/tests/package.test.cjs).

### apps/desktop/scripts/package-pptx-test.cjs

[`apps/desktop/scripts/package-pptx-test.cjs`](../../apps/desktop/scripts/package-pptx-test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/scripts/build-process-audio.cjs`](../../apps/desktop/scripts/build-process-audio.cjs), [`apps/desktop/scripts/package-files.cjs`](../../apps/desktop/scripts/package-files.cjs), [`apps/desktop/src/private-test-basic-auth.cjs`](../../apps/desktop/src/private-test-basic-auth.cjs).

Библиотеки/Node: `electron-builder`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`.

Используют: [`apps/desktop/scripts/verify-pptx-test.cjs`](../../apps/desktop/scripts/verify-pptx-test.cjs), [`apps/desktop/tests/private-test-auth-package.test.cjs`](../../apps/desktop/tests/private-test-auth-package.test.cjs).

Переменные окружения (только имена): `CASTLINK_PRIVATE_TEST_AUTH_ORIGIN`, `CASTLINK_PRIVATE_TEST_AUTH_SOURCE`.

### apps/desktop/scripts/package.cjs

[`apps/desktop/scripts/package.cjs`](../../apps/desktop/scripts/package.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/scripts/build-process-audio.cjs`](../../apps/desktop/scripts/build-process-audio.cjs), [`apps/desktop/scripts/package-files.cjs`](../../apps/desktop/scripts/package-files.cjs), [`apps/desktop/scripts/setup-resources.cjs`](../../apps/desktop/scripts/setup-resources.cjs).

Библиотеки/Node: `electron-builder`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`.

Переменные окружения (только имена): `GITHUB_OUTPUT`.

### apps/desktop/scripts/setup-resources.cjs

[`apps/desktop/scripts/setup-resources.cjs`](../../apps/desktop/scripts/setup-resources.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`scripts/release-track.cjs`](../../scripts/release-track.cjs).

Библиотеки/Node: `node:crypto`, `node:fs`, `node:path`.

Используют: [`apps/desktop/scripts/package.cjs`](../../apps/desktop/scripts/package.cjs), [`apps/desktop/tests/setup-resources.test.cjs`](../../apps/desktop/tests/setup-resources.test.cjs).

### apps/desktop/scripts/verify-pptx-test.cjs

[`apps/desktop/scripts/verify-pptx-test.cjs`](../../apps/desktop/scripts/verify-pptx-test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/scripts/package-files.cjs`](../../apps/desktop/scripts/package-files.cjs), [`apps/desktop/scripts/package-pptx-test.cjs`](../../apps/desktop/scripts/package-pptx-test.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`.

### apps/desktop/src/capture.cjs

[`apps/desktop/src/capture.cjs`](../../apps/desktop/src/capture.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/server-policy.cjs`](../../apps/desktop/src/server-policy.cjs).

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/tests/capture.test.cjs`](../../apps/desktop/tests/capture.test.cjs).

### apps/desktop/src/helper-preload.cjs

[`apps/desktop/src/helper-preload.cjs`](../../apps/desktop/src/helper-preload.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `electron`.

### apps/desktop/src/ipc-policy.cjs

[`apps/desktop/src/ipc-policy.cjs`](../../apps/desktop/src/ipc-policy.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/server-policy.cjs`](../../apps/desktop/src/server-policy.cjs).

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/src/slide-panel.cjs`](../../apps/desktop/src/slide-panel.cjs), [`apps/desktop/src/stop-panel.cjs`](../../apps/desktop/src/stop-panel.cjs), [`apps/desktop/tests/ipc-policy.test.cjs`](../../apps/desktop/tests/ipc-policy.test.cjs).

### apps/desktop/src/main.cjs

[`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/capture.cjs`](../../apps/desktop/src/capture.cjs), [`apps/desktop/src/ipc-policy.cjs`](../../apps/desktop/src/ipc-policy.cjs), [`apps/desktop/src/native-presentation-desktop.cjs`](../../apps/desktop/src/native-presentation-desktop.cjs), [`apps/desktop/src/permissions.cjs`](../../apps/desktop/src/permissions.cjs), [`apps/desktop/src/presentation-helper.cjs`](../../apps/desktop/src/presentation-helper.cjs), [`apps/desktop/src/presenter-protocol.cjs`](../../apps/desktop/src/presenter-protocol.cjs), [`apps/desktop/src/private-test-basic-auth.cjs`](../../apps/desktop/src/private-test-basic-auth.cjs), [`apps/desktop/src/process-audio.cjs`](../../apps/desktop/src/process-audio.cjs), [`apps/desktop/src/server-policy.cjs`](../../apps/desktop/src/server-policy.cjs), [`apps/desktop/src/setup.cjs`](../../apps/desktop/src/setup.cjs), [`apps/desktop/src/slide-panel.cjs`](../../apps/desktop/src/slide-panel.cjs), [`apps/desktop/src/stop-panel.cjs`](../../apps/desktop/src/stop-panel.cjs), [`apps/desktop/src/updates.cjs`](../../apps/desktop/src/updates.cjs), [`package.json`](../../package.json).

Библиотеки/Node: `electron`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:url`.

Переменные окружения (только имена): `CASTLINK_PRIVATE_TEST_AUTH_FILE`, `LOCALAPPDATA`, `PORTABLE_EXECUTABLE_FILE`.

### apps/desktop/src/native-presentation-desktop.cjs

[`apps/desktop/src/native-presentation-desktop.cjs`](../../apps/desktop/src/native-presentation-desktop.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/native-presentation.cjs`](../../apps/desktop/src/native-presentation.cjs), [`apps/desktop/src/powerpoint.cjs`](../../apps/desktop/src/powerpoint.cjs), [`apps/desktop/src/window-slides-picker.cjs`](../../apps/desktop/src/window-slides-picker.cjs), [`apps/desktop/src/window-slides.cjs`](../../apps/desktop/src/window-slides.cjs).

Библиотеки/Node: `node:path`.

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/src/presentation-helper.cjs`](../../apps/desktop/src/presentation-helper.cjs).

### apps/desktop/src/native-presentation.cjs

[`apps/desktop/src/native-presentation.cjs`](../../apps/desktop/src/native-presentation.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Используют: [`apps/desktop/src/native-presentation-desktop.cjs`](../../apps/desktop/src/native-presentation-desktop.cjs), [`apps/desktop/tests/native-presentation.test.cjs`](../../apps/desktop/tests/native-presentation.test.cjs).

### apps/desktop/src/permissions.cjs

[`apps/desktop/src/permissions.cjs`](../../apps/desktop/src/permissions.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/server-policy.cjs`](../../apps/desktop/src/server-policy.cjs).

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/tests/permissions.test.cjs`](../../apps/desktop/tests/permissions.test.cjs).

### apps/desktop/src/powerpoint.cjs

[`apps/desktop/src/powerpoint.cjs`](../../apps/desktop/src/powerpoint.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:path`.

Используют: [`apps/desktop/src/native-presentation-desktop.cjs`](../../apps/desktop/src/native-presentation-desktop.cjs).

Переменные окружения (только имена): `S`.

### apps/desktop/src/preload.cjs

[`apps/desktop/src/preload.cjs`](../../apps/desktop/src/preload.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `electron`.

### apps/desktop/src/presentation-helper.cjs

[`apps/desktop/src/presentation-helper.cjs`](../../apps/desktop/src/presentation-helper.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/native-presentation-desktop.cjs`](../../apps/desktop/src/native-presentation-desktop.cjs), [`apps/desktop/src/presenter-protocol.cjs`](../../apps/desktop/src/presenter-protocol.cjs).

Библиотеки/Node: `electron`, `node:path`, `node:url`.

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/tests/helper-window.test.cjs`](../../apps/desktop/tests/helper-window.test.cjs), [`apps/desktop/tests/presentation-helper.test.cjs`](../../apps/desktop/tests/presentation-helper.test.cjs).

### apps/desktop/src/presenter-protocol.cjs

[`apps/desktop/src/presenter-protocol.cjs`](../../apps/desktop/src/presenter-protocol.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/src/presentation-helper.cjs`](../../apps/desktop/src/presentation-helper.cjs), [`apps/desktop/tests/presenter-protocol.test.cjs`](../../apps/desktop/tests/presenter-protocol.test.cjs).

### apps/desktop/src/private-test-basic-auth.cjs

[`apps/desktop/src/private-test-basic-auth.cjs`](../../apps/desktop/src/private-test-basic-auth.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:fs`, `node:path`.

Используют: [`apps/desktop/scripts/package-pptx-test.cjs`](../../apps/desktop/scripts/package-pptx-test.cjs), [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/tests/private-test-auth-package.test.cjs`](../../apps/desktop/tests/private-test-auth-package.test.cjs), [`apps/desktop/tests/private-test-basic-auth.test.cjs`](../../apps/desktop/tests/private-test-basic-auth.test.cjs).

### apps/desktop/src/process-audio.cjs

[`apps/desktop/src/process-audio.cjs`](../../apps/desktop/src/process-audio.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:child_process`, `node:fs`, `node:path`.

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/tests/process-audio.test.cjs`](../../apps/desktop/tests/process-audio.test.cjs), [`apps/desktop/tests/windows-process-audio-smoke.cjs`](../../apps/desktop/tests/windows-process-audio-smoke.cjs).

### apps/desktop/src/server-policy.cjs

[`apps/desktop/src/server-policy.cjs`](../../apps/desktop/src/server-policy.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Используют: [`apps/desktop/src/capture.cjs`](../../apps/desktop/src/capture.cjs), [`apps/desktop/src/ipc-policy.cjs`](../../apps/desktop/src/ipc-policy.cjs), [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/src/permissions.cjs`](../../apps/desktop/src/permissions.cjs), [`apps/desktop/tests/deep-link.test.cjs`](../../apps/desktop/tests/deep-link.test.cjs), [`apps/desktop/tests/server-policy.test.cjs`](../../apps/desktop/tests/server-policy.test.cjs).

### apps/desktop/src/setup.cjs

[`apps/desktop/src/setup.cjs`](../../apps/desktop/src/setup.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:child_process`, `node:fs`, `node:path`.

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/tests/setup.test.cjs`](../../apps/desktop/tests/setup.test.cjs).

Переменные окружения (только имена): `S`.

### apps/desktop/src/slide-panel.cjs

[`apps/desktop/src/slide-panel.cjs`](../../apps/desktop/src/slide-panel.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/ipc-policy.cjs`](../../apps/desktop/src/ipc-policy.cjs).

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/tests/slide-panel.test.cjs`](../../apps/desktop/tests/slide-panel.test.cjs), [`apps/desktop/tests/windows-slide-toolbar-smoke.cjs`](../../apps/desktop/tests/windows-slide-toolbar-smoke.cjs).

### apps/desktop/src/stop-panel.cjs

[`apps/desktop/src/stop-panel.cjs`](../../apps/desktop/src/stop-panel.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/ipc-policy.cjs`](../../apps/desktop/src/ipc-policy.cjs), [`apps/desktop/src/stop-session.cjs`](../../apps/desktop/src/stop-session.cjs).

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs).

### apps/desktop/src/stop-session.cjs

[`apps/desktop/src/stop-session.cjs`](../../apps/desktop/src/stop-session.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Используют: [`apps/desktop/src/stop-panel.cjs`](../../apps/desktop/src/stop-panel.cjs), [`apps/desktop/tests/stop-panel.test.cjs`](../../apps/desktop/tests/stop-panel.test.cjs).

### apps/desktop/src/updates.cjs

[`apps/desktop/src/updates.cjs`](../../apps/desktop/src/updates.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`.

Используют: [`apps/desktop/src/main.cjs`](../../apps/desktop/src/main.cjs), [`apps/desktop/tests/updates.test.cjs`](../../apps/desktop/tests/updates.test.cjs), [`apps/desktop/tests/windows-updates-smoke.cjs`](../../apps/desktop/tests/windows-updates-smoke.cjs).

### apps/desktop/src/window-slides-picker-preload.cjs

[`apps/desktop/src/window-slides-picker-preload.cjs`](../../apps/desktop/src/window-slides-picker-preload.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `electron`.

### apps/desktop/src/window-slides-picker.cjs

[`apps/desktop/src/window-slides-picker.cjs`](../../apps/desktop/src/window-slides-picker.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:path`, `node:url`.

Используют: [`apps/desktop/src/native-presentation-desktop.cjs`](../../apps/desktop/src/native-presentation-desktop.cjs), [`apps/desktop/tests/window-slides-picker.test.cjs`](../../apps/desktop/tests/window-slides-picker.test.cjs).

### apps/desktop/src/window-slides.cjs

[`apps/desktop/src/window-slides.cjs`](../../apps/desktop/src/window-slides.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:path`.

Используют: [`apps/desktop/src/native-presentation-desktop.cjs`](../../apps/desktop/src/native-presentation-desktop.cjs), [`apps/desktop/tests/window-slides.test.cjs`](../../apps/desktop/tests/window-slides.test.cjs).

### apps/desktop/tests/capture-picker-ui.test.cjs

[`apps/desktop/tests/capture-picker-ui.test.cjs`](../../apps/desktop/tests/capture-picker-ui.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/desktop/tests/capture.test.cjs

[`apps/desktop/tests/capture.test.cjs`](../../apps/desktop/tests/capture.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/capture.cjs`](../../apps/desktop/src/capture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/client-preview-package.test.cjs

[`apps/desktop/tests/client-preview-package.test.cjs`](../../apps/desktop/tests/client-preview-package.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/scripts/package-client-preview.cjs`](../../apps/desktop/scripts/package-client-preview.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/desktop/tests/contextbridge-foreground.smoke.cjs

[`apps/desktop/tests/contextbridge-foreground.smoke.cjs`](../../apps/desktop/tests/contextbridge-foreground.smoke.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `electron`, `node:fs`, `node:os`, `node:path`.

### apps/desktop/tests/deep-link.test.cjs

[`apps/desktop/tests/deep-link.test.cjs`](../../apps/desktop/tests/deep-link.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/server-policy.cjs`](../../apps/desktop/src/server-policy.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/fixtures/process-audio-tone.cs

[`apps/desktop/tests/fixtures/process-audio-tone.cs`](../../apps/desktop/tests/fixtures/process-audio-tone.cs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/tests/fixtures/update-dialog-driver.ps1

[`apps/desktop/tests/fixtures/update-dialog-driver.ps1`](../../apps/desktop/tests/fixtures/update-dialog-driver.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/tests/helper-window.test.cjs

[`apps/desktop/tests/helper-window.test.cjs`](../../apps/desktop/tests/helper-window.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/presentation-helper.cjs`](../../apps/desktop/src/presentation-helper.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:test`.

### apps/desktop/tests/ipc-policy.test.cjs

[`apps/desktop/tests/ipc-policy.test.cjs`](../../apps/desktop/tests/ipc-policy.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/ipc-policy.cjs`](../../apps/desktop/src/ipc-policy.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/main-runtime.test.cjs

[`apps/desktop/tests/main-runtime.test.cjs`](../../apps/desktop/tests/main-runtime.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:test`, `node:url`, `node:vm`.

### apps/desktop/tests/native-pptx-ipc.test.cjs

[`apps/desktop/tests/native-pptx-ipc.test.cjs`](../../apps/desktop/tests/native-pptx-ipc.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/desktop/tests/native-presentation.test.cjs

[`apps/desktop/tests/native-presentation.test.cjs`](../../apps/desktop/tests/native-presentation.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/native-presentation.cjs`](../../apps/desktop/src/native-presentation.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/package.test.cjs

[`apps/desktop/tests/package.test.cjs`](../../apps/desktop/tests/package.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/scripts/package-files.cjs`](../../apps/desktop/scripts/package-files.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/desktop/tests/permissions.test.cjs

[`apps/desktop/tests/permissions.test.cjs`](../../apps/desktop/tests/permissions.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/permissions.cjs`](../../apps/desktop/src/permissions.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/powerpoint-core.tests.ps1

[`apps/desktop/tests/powerpoint-core.tests.ps1`](../../apps/desktop/tests/powerpoint-core.tests.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/tests/powerpoint-native-step.tests.ps1

[`apps/desktop/tests/powerpoint-native-step.tests.ps1`](../../apps/desktop/tests/powerpoint-native-step.tests.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/tests/powerpoint.test.cjs

[`apps/desktop/tests/powerpoint.test.cjs`](../../apps/desktop/tests/powerpoint.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`.

### apps/desktop/tests/pptx-test-isolation.test.cjs

[`apps/desktop/tests/pptx-test-isolation.test.cjs`](../../apps/desktop/tests/pptx-test-isolation.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:test`, `node:url`, `node:vm`.

### apps/desktop/tests/pptx-test-package.test.cjs

[`apps/desktop/tests/pptx-test-package.test.cjs`](../../apps/desktop/tests/pptx-test-package.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/desktop/tests/preload-audio.test.cjs

[`apps/desktop/tests/preload-audio.test.cjs`](../../apps/desktop/tests/preload-audio.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/desktop/tests/preload-capture.test.cjs

[`apps/desktop/tests/preload-capture.test.cjs`](../../apps/desktop/tests/preload-capture.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/desktop/tests/preload-slides.test.cjs

[`apps/desktop/tests/preload-slides.test.cjs`](../../apps/desktop/tests/preload-slides.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/desktop/tests/preload-theme.test.cjs

[`apps/desktop/tests/preload-theme.test.cjs`](../../apps/desktop/tests/preload-theme.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/desktop/tests/presentation-helper-ipc.test.cjs

[`apps/desktop/tests/presentation-helper-ipc.test.cjs`](../../apps/desktop/tests/presentation-helper-ipc.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:url`, `node:vm`.

### apps/desktop/tests/presentation-helper-launch.test.cjs

[`apps/desktop/tests/presentation-helper-launch.test.cjs`](../../apps/desktop/tests/presentation-helper-launch.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `node:path`, `node:test`, `node:url`, `node:vm`.

### apps/desktop/tests/presentation-helper-ui.test.cjs

[`apps/desktop/tests/presentation-helper-ui.test.cjs`](../../apps/desktop/tests/presentation-helper-ui.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`.

### apps/desktop/tests/presentation-helper.test.cjs

[`apps/desktop/tests/presentation-helper.test.cjs`](../../apps/desktop/tests/presentation-helper.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/presentation-helper.cjs`](../../apps/desktop/src/presentation-helper.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:test`.

### apps/desktop/tests/presenter-protocol.test.cjs

[`apps/desktop/tests/presenter-protocol.test.cjs`](../../apps/desktop/tests/presenter-protocol.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/presenter-protocol.cjs`](../../apps/desktop/src/presenter-protocol.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/private-test-auth-package.test.cjs

[`apps/desktop/tests/private-test-auth-package.test.cjs`](../../apps/desktop/tests/private-test-auth-package.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/scripts/package-pptx-test.cjs`](../../apps/desktop/scripts/package-pptx-test.cjs), [`apps/desktop/src/private-test-basic-auth.cjs`](../../apps/desktop/src/private-test-basic-auth.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/desktop/tests/private-test-basic-auth.test.cjs

[`apps/desktop/tests/private-test-basic-auth.test.cjs`](../../apps/desktop/tests/private-test-basic-auth.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/private-test-basic-auth.cjs`](../../apps/desktop/src/private-test-basic-auth.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/desktop/tests/process-audio-analysis.test.cjs

[`apps/desktop/tests/process-audio-analysis.test.cjs`](../../apps/desktop/tests/process-audio-analysis.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/tests/windows-process-audio-smoke.cjs`](../../apps/desktop/tests/windows-process-audio-smoke.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/process-audio.test.cjs

[`apps/desktop/tests/process-audio.test.cjs`](../../apps/desktop/tests/process-audio.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/process-audio.cjs`](../../apps/desktop/src/process-audio.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:os`, `node:path`, `node:stream`, `node:test`.

### apps/desktop/tests/server-policy.test.cjs

[`apps/desktop/tests/server-policy.test.cjs`](../../apps/desktop/tests/server-policy.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/server-policy.cjs`](../../apps/desktop/src/server-policy.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/setup-resources.test.cjs

[`apps/desktop/tests/setup-resources.test.cjs`](../../apps/desktop/tests/setup-resources.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/scripts/setup-resources.cjs`](../../apps/desktop/scripts/setup-resources.cjs), [`scripts/release-track.cjs`](../../scripts/release-track.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/desktop/tests/setup.test.cjs

[`apps/desktop/tests/setup.test.cjs`](../../apps/desktop/tests/setup.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/setup.cjs`](../../apps/desktop/src/setup.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/desktop/tests/slide-panel-ui.test.cjs

[`apps/desktop/tests/slide-panel-ui.test.cjs`](../../apps/desktop/tests/slide-panel-ui.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/desktop/tests/slide-panel.test.cjs

[`apps/desktop/tests/slide-panel.test.cjs`](../../apps/desktop/tests/slide-panel.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/slide-panel.cjs`](../../apps/desktop/src/slide-panel.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:test`.

### apps/desktop/tests/start-ui.test.cjs

[`apps/desktop/tests/start-ui.test.cjs`](../../apps/desktop/tests/start-ui.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### apps/desktop/tests/stop-panel.test.cjs

[`apps/desktop/tests/stop-panel.test.cjs`](../../apps/desktop/tests/stop-panel.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/stop-session.cjs`](../../apps/desktop/src/stop-session.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/updates.test.cjs

[`apps/desktop/tests/updates.test.cjs`](../../apps/desktop/tests/updates.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/updates.cjs`](../../apps/desktop/src/updates.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:events`, `node:fs`, `node:os`, `node:path`, `node:test`.

### apps/desktop/tests/window-slides-picker.test.cjs

[`apps/desktop/tests/window-slides-picker.test.cjs`](../../apps/desktop/tests/window-slides-picker.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/window-slides-picker.cjs`](../../apps/desktop/src/window-slides-picker.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:path`, `node:test`, `node:url`.

### apps/desktop/tests/window-slides.test.cjs

[`apps/desktop/tests/window-slides.test.cjs`](../../apps/desktop/tests/window-slides.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/window-slides.cjs`](../../apps/desktop/src/window-slides.cjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### apps/desktop/tests/windows-native-theme-picker-smoke.cjs

[`apps/desktop/tests/windows-native-theme-picker-smoke.cjs`](../../apps/desktop/tests/windows-native-theme-picker-smoke.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `electron`, `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:path`, `node:vm`.

### apps/desktop/tests/windows-process-audio-smoke.cjs

[`apps/desktop/tests/windows-process-audio-smoke.cjs`](../../apps/desktop/tests/windows-process-audio-smoke.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/process-audio.cjs`](../../apps/desktop/src/process-audio.cjs).

Библиотеки/Node: `node:child_process`, `node:fs`, `node:os`, `node:path`.

Используют: [`apps/desktop/tests/process-audio-analysis.test.cjs`](../../apps/desktop/tests/process-audio-analysis.test.cjs).

Переменные окружения (только имена): `S`.

### apps/desktop/tests/windows-slide-parity-smoke.cjs

[`apps/desktop/tests/windows-slide-parity-smoke.cjs`](../../apps/desktop/tests/windows-slide-parity-smoke.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `electron`, `node:assert/strict`, `node:fs`, `node:path`.

### apps/desktop/tests/windows-slide-toolbar-smoke.cjs

[`apps/desktop/tests/windows-slide-toolbar-smoke.cjs`](../../apps/desktop/tests/windows-slide-toolbar-smoke.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/slide-panel.cjs`](../../apps/desktop/src/slide-panel.cjs).

Библиотеки/Node: `electron`, `node:assert/strict`, `node:fs`, `node:http`, `node:path`, `node:url`.

### apps/desktop/tests/windows-smoke.cjs

[`apps/desktop/tests/windows-smoke.cjs`](../../apps/desktop/tests/windows-smoke.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `electron`, `node:assert/strict`, `node:child_process`, `node:fs`, `node:http`, `node:os`, `node:path`.

Переменные окружения (только имена): `CASTLINK_QA_POWERPOINT_AUDIO`, `CASTLINK_QA_WEB_ADAPTER`, `S`.

### apps/desktop/tests/windows-updates-smoke.cjs

[`apps/desktop/tests/windows-updates-smoke.cjs`](../../apps/desktop/tests/windows-updates-smoke.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/desktop/src/updates.cjs`](../../apps/desktop/src/updates.cjs).

Библиотеки/Node: `electron`, `node:assert/strict`, `node:child_process`, `node:fs`, `node:path`.

Переменные окружения (только имена): `CASTLINK_UPDATE_QA_OUTPUT`, `S`.

### apps/desktop/ui/capture-picker.css

[`apps/desktop/ui/capture-picker.css`](../../apps/desktop/ui/capture-picker.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/capture-picker.html

[`apps/desktop/ui/capture-picker.html`](../../apps/desktop/ui/capture-picker.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/capture-picker.js

[`apps/desktop/ui/capture-picker.js`](../../apps/desktop/ui/capture-picker.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/presentation-helper.css

[`apps/desktop/ui/presentation-helper.css`](../../apps/desktop/ui/presentation-helper.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/presentation-helper.html

[`apps/desktop/ui/presentation-helper.html`](../../apps/desktop/ui/presentation-helper.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/presentation-helper.js

[`apps/desktop/ui/presentation-helper.js`](../../apps/desktop/ui/presentation-helper.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/slide-panel.css

[`apps/desktop/ui/slide-panel.css`](../../apps/desktop/ui/slide-panel.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/slide-panel.html

[`apps/desktop/ui/slide-panel.html`](../../apps/desktop/ui/slide-panel.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/slide-panel.js

[`apps/desktop/ui/slide-panel.js`](../../apps/desktop/ui/slide-panel.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/start.css

[`apps/desktop/ui/start.css`](../../apps/desktop/ui/start.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/start.html

[`apps/desktop/ui/start.html`](../../apps/desktop/ui/start.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/start.js

[`apps/desktop/ui/start.js`](../../apps/desktop/ui/start.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/stop-panel.css

[`apps/desktop/ui/stop-panel.css`](../../apps/desktop/ui/stop-panel.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/stop-panel.html

[`apps/desktop/ui/stop-panel.html`](../../apps/desktop/ui/stop-panel.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/stop-panel.js

[`apps/desktop/ui/stop-panel.js`](../../apps/desktop/ui/stop-panel.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/window-slides-picker.css

[`apps/desktop/ui/window-slides-picker.css`](../../apps/desktop/ui/window-slides-picker.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/window-slides-picker.html

[`apps/desktop/ui/window-slides-picker.html`](../../apps/desktop/ui/window-slides-picker.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/desktop/ui/window-slides-picker.js

[`apps/desktop/ui/window-slides-picker.js`](../../apps/desktop/ui/window-slides-picker.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/studio-linux/CMakeLists.txt

[`apps/studio-linux/CMakeLists.txt`](../../apps/studio-linux/CMakeLists.txt)

Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.

### apps/studio-linux/src/main.cpp

[`apps/studio-linux/src/main.cpp`](../../apps/studio-linux/src/main.cpp)

Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.

### apps/studio-windows/CMakeLists.txt

[`apps/studio-windows/CMakeLists.txt`](../../apps/studio-windows/CMakeLists.txt)

Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.

### apps/studio-windows/README.md

[`apps/studio-windows/README.md`](../../apps/studio-windows/README.md)

StudioLink Studio — Windows 11 native

### apps/studio-windows/src/main.cpp

[`apps/studio-windows/src/main.cpp`](../../apps/studio-windows/src/main.cpp)

Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.

## apps/web/app · 77 файлов

### apps/web/app/admin/page.tsx

[`apps/web/app/admin/page.tsx`](../../apps/web/app/admin/page.tsx)

React-страница /admin. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/app/api/admin-access/route.ts

[`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts)

Серверный HTTP-обработчик /api/admin-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/auth/route.ts

[`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts)

Серверный HTTP-обработчик /api/auth. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `GET`, `POST`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-invite-key.ts`](../../apps/web/lib/guest-invite-key.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/tests/guest-invite-revocation.cjs`](../../apps/web/tests/guest-invite-revocation.cjs).

Переменные окружения (только имена): `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/app/api/caster-slot-output/route.ts

[`apps/web/app/api/caster-slot-output/route.ts`](../../apps/web/app/api/caster-slot-output/route.ts)

Серверный HTTP-обработчик /api/caster-slot-output. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/caster-slot-access.ts`](../../apps/web/lib/caster-slot-access.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/app/api/caster-slots/route.ts

[`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts)

Серверный HTTP-обработчик /api/caster-slots. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/caster-slot-access.ts`](../../apps/web/lib/caster-slot-access.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/co-presentation-helper/route.ts

[`apps/web/app/api/co-presentation-helper/route.ts`](../../apps/web/app/api/co-presentation-helper/route.ts)

Серверный HTTP-обработчик /api/co-presentation-helper. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts), [`apps/web/lib/co-presentation-helper.ts`](../../apps/web/lib/co-presentation-helper.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Переменные окружения (только имена): `CASTLINK_HELPER_ALLOW_LOOPBACK_TEST`.

### apps/web/app/api/co-presentations/route.ts

[`apps/web/app/api/co-presentations/route.ts`](../../apps/web/app/api/co-presentations/route.ts)

Серверный HTTP-обработчик /api/co-presentations. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts), [`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/guest-admission/route.ts

[`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts)

Серверный HTTP-обработчик /api/guest-admission. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/caster-slot-access.ts`](../../apps/web/lib/caster-slot-access.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/guest-command/route.ts

[`apps/web/app/api/guest-command/route.ts`](../../apps/web/app/api/guest-command/route.ts)

Серверный HTTP-обработчик /api/guest-command. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:fs/promises`, `node:path`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/app/api/guest-device-control/route.ts

[`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts)

Серверный HTTP-обработчик /api/guest-device-control. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-device-control-state.ts`](../../apps/web/lib/guest-device-control-state.ts), [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/guest-media-control/route.ts

[`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts)

Серверный HTTP-обработчик /api/guest-media-control. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/connection-route-config.ts`](../../apps/web/lib/connection-route-config.ts), [`apps/web/lib/guest-media-control-state.ts`](../../apps/web/lib/guest-media-control-state.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-session-settings.ts`](../../apps/web/lib/guest-session-settings.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/health/route.ts

[`apps/web/app/api/health/route.ts`](../../apps/web/app/api/health/route.ts)

Серверный HTTP-обработчик /api/health. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:net`, `node:tls`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_HEALTH_TIMEOUT_MS`, `CASTLINK_NODE_ID`, `CASTLINK_STORAGE_BACKEND`, `CASTLINK_TURN_HEALTH_HOST`, `CASTLINK_TURN_TLS_PORT`, `LIVEKIT_SERVER_URL`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_PRODUCT_VERSION`, `STUDIOLINK_RELEASE`, `STUDIOLINK_STATS_MAX_BYTES`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/app/api/hosted-access/route.ts

[`apps/web/app/api/hosted-access/route.ts`](../../apps/web/app/api/hosted-access/route.ts)

Серверный HTTP-обработчик /api/hosted-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `GET`, `POST`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/invites/route.ts

[`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts)

Серверный HTTP-обработчик /api/invites. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-entry-store.ts`](../../apps/web/lib/guest-entry-store.ts), [`apps/web/lib/guest-invite-key.ts`](../../apps/web/lib/guest-invite-key.ts), [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`, `node:util`.

Используют: [`apps/web/tests/guest-invite-revocation.cjs`](../../apps/web/tests/guest-invite-revocation.cjs), [`apps/web/tests/media-room-api.cjs`](../../apps/web/tests/media-room-api.cjs), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs).

### apps/web/app/api/license-status/route.ts

[`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts)

Серверный HTTP-обработчик /api/license-status. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Переменные окружения (только имена): `CASTLINK_SERVER_ID`.

### apps/web/app/api/media-admission/route.ts

[`apps/web/app/api/media-admission/route.ts`](../../apps/web/app/api/media-admission/route.ts)

Серверный HTTP-обработчик /api/media-admission. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/app/api/moderator-access/route.ts

[`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts)

Серверный HTTP-обработчик /api/moderator-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Используют: [`apps/web/tests/participant-role-api.cjs`](../../apps/web/tests/participant-role-api.cjs), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/move-guest/route.ts

[`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts)

Серверный HTTP-обработчик /api/move-guest. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:fs/promises`, `node:path`.

### apps/web/app/api/multiview/route.ts

[`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts)

Серверный HTTP-обработчик /api/multiview. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `POST`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/multiview-store.ts`](../../apps/web/lib/multiview-store.ts), [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/tests/multiview-api.cjs`](../../apps/web/tests/multiview-api.cjs), [`apps/web/tests/multiview-delete-api.cjs`](../../apps/web/tests/multiview-delete-api.cjs).

### apps/web/app/api/participant-role/route.ts

[`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts)

Серверный HTTP-обработчик /api/participant-role. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/participant-role-store.ts`](../../apps/web/lib/participant-role-store.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`, `node:util`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/participants/route.ts

[`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts)

Серверный HTTP-обработчик /api/participants. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `DELETE`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/guest-session-settings.ts`](../../apps/web/lib/guest-session-settings.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/talkback-session.ts`](../../apps/web/lib/talkback-session.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Используют: [`apps/web/tests/participant-mute-api.cjs`](../../apps/web/tests/participant-mute-api.cjs), [`apps/web/tests/talkback-api.cjs`](../../apps/web/tests/talkback-api.cjs).

Переменные окружения (только имена): `CASTLINK_ENFORCE_NODE_ADMISSION`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/presentation-control/route.ts

[`apps/web/app/api/presentation-control/route.ts`](../../apps/web/app/api/presentation-control/route.ts)

Серверный HTTP-обработчик /api/presentation-control. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Библиотеки/Node: `next/server`.

### apps/web/app/api/presentation-file/route.ts

[`apps/web/app/api/presentation-file/route.ts`](../../apps/web/app/api/presentation-file/route.ts)

Серверный HTTP-обработчик /api/presentation-file. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts), [`apps/web/lib/presentation-file.ts`](../../apps/web/lib/presentation-file.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/update-maintenance.ts`](../../apps/web/lib/update-maintenance.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/room-chat/route.ts

[`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts)

Серверный HTTP-обработчик /api/room-chat. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `POST`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-chat-auth.ts`](../../apps/web/lib/room-chat-auth.ts), [`apps/web/lib/room-chat-store.ts`](../../apps/web/lib/room-chat-store.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/room-studio-access/route.ts

[`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts)

Серверный HTTP-обработчик /api/room-studio-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`, `POST`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/deployment-model.ts`](../../apps/web/lib/deployment-model.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/public-room-name.ts`](../../apps/web/lib/public-room-name.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-creation-access.ts`](../../apps/web/lib/room-creation-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/tests/hosted-access-api.cjs`](../../apps/web/tests/hosted-access-api.cjs), [`apps/web/tests/multiview-api.cjs`](../../apps/web/tests/multiview-api.cjs), [`apps/web/tests/multiview-delete-api.cjs`](../../apps/web/tests/multiview-delete-api.cjs), [`apps/web/tests/room-creation-access.cjs`](../../apps/web/tests/room-creation-access.cjs), [`apps/web/tests/room-creation-password-settings.cjs`](../../apps/web/tests/room-creation-password-settings.cjs), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/stats-multi-client.cjs`](../../apps/web/tests/stats-multi-client.cjs).

### apps/web/app/api/rooms/route.ts

[`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts)

Серверный HTTP-обработчик /api/rooms. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/public-room-name.ts`](../../apps/web/lib/public-room-name.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/media-room-api.cjs`](../../apps/web/tests/media-room-api.cjs), [`apps/web/tests/moderator-room-rename.cjs`](../../apps/web/tests/moderator-room-rename.cjs), [`apps/web/tests/room-creation-access.cjs`](../../apps/web/tests/room-creation-access.cjs), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/server-provisioning/operator/route.ts

[`apps/web/app/api/server-provisioning/operator/route.ts`](../../apps/web/app/api/server-provisioning/operator/route.ts)

Серверный HTTP-обработчик /api/server-provisioning/operator. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/tests/server-provisioning-operator.cjs`](../../apps/web/tests/server-provisioning-operator.cjs).

Переменные окружения (только имена): `CASTLINK_SETUP_TOKEN`, `STUDIOLINK_INSTALLATION_ID`.

### apps/web/app/api/server-provisioning/route.ts

[`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts)

Серверный HTTP-обработчик /api/server-provisioning. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `DELETE`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-profile-removal.ts`](../../apps/web/lib/server-profile-removal.ts), [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-provisioning-ssh.ts`](../../apps/web/lib/server-provisioning-ssh.ts), [`apps/web/lib/server-provisioning.ts`](../../apps/web/lib/server-provisioning.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`scripts/server-provisioning-ssh.mjs`](../../scripts/server-provisioning-ssh.mjs).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/tests/server-provisioning-api.cjs`](../../apps/web/tests/server-provisioning-api.cjs).

### apps/web/app/api/server-reserve/route.ts

[`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts)

Серверный HTTP-обработчик /api/server-reserve. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `OPTIONS`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/reserve-health.ts`](../../apps/web/lib/reserve-health.ts), [`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs).

### apps/web/app/api/server-transfer/route.ts

[`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts)

Серверный HTTP-обработчик /api/server-transfer. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs), [`apps/web/tests/transfer-node-admission.cjs`](../../apps/web/tests/transfer-node-admission.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`, `STUDIOLINK_TRANSFER_ORIGIN`.

### apps/web/app/api/servers/route.ts

[`apps/web/app/api/servers/route.ts`](../../apps/web/app/api/servers/route.ts)

Серверный HTTP-обработчик /api/servers. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/server-registry-client.ts`](../../apps/web/lib/server-registry-client.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/setup/route.ts

[`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts)

Серверный HTTP-обработчик /api/setup. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/deployment-model.ts`](../../apps/web/lib/deployment-model.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/tests/self-hosted-setup.cjs`](../../apps/web/tests/self-hosted-setup.cjs).

### apps/web/app/api/stats/route.ts

[`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts)

Серверный HTTP-обработчик /api/stats. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`, `GET`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/audio-diagnostics.ts`](../../apps/web/lib/audio-diagnostics.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Используют: [`apps/web/tests/stats-multi-client.cjs`](../../apps/web/tests/stats-multi-client.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/app/api/studio-access/route.ts

[`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts)

Серверный HTTP-обработчик /api/studio-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/studio-control/route.ts

[`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts)

Серверный HTTP-обработчик /api/studio-control. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/tests/media-studio-control.cjs`](../../apps/web/tests/media-studio-control.cjs), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs).

### apps/web/app/api/studio-route/route.ts

[`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts)

Серверный HTTP-обработчик /api/studio-route. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/studio-viewer/route.ts

[`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts)

Серверный HTTP-обработчик /api/studio-viewer. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/studio-viewer-api.cjs`](../../apps/web/tests/studio-viewer-api.cjs).

Переменные окружения (только имена): `CASTLINK_ENFORCE_NODE_ADMISSION`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/studios/route.ts

[`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts)

Серверный HTTP-обработчик /api/studios. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/super-admin-access/route.ts

[`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts)

Серверный HTTP-обработчик /api/super-admin-access. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/super-admin/history/route.ts

[`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts)

Серверный HTTP-обработчик /api/super-admin/history. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/api/super-admin/route.ts

[`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts)

Серверный HTTP-обработчик /api/super-admin. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts), [`apps/web/lib/platform-topology.ts`](../../apps/web/lib/platform-topology.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts).

Библиотеки/Node: `next/server`.

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `CASTLINK_SUPER_ADMIN_NODE_TIMEOUT_MS`, `NODE_ENV`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/app/api/talkback/route.ts

[`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts)

Серверный HTTP-обработчик /api/talkback. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`, `POST`, `DELETE`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/talkback-session.ts`](../../apps/web/lib/talkback-session.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/talkback-api.cjs`](../../apps/web/tests/talkback-api.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/token/route.ts

[`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts)

Серверный HTTP-обработчик /api/token. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `GET`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/caster-slot-access.ts`](../../apps/web/lib/caster-slot-access.ts), [`apps/web/lib/connection-route-config.ts`](../../apps/web/lib/connection-route-config.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-session-settings.ts`](../../apps/web/lib/guest-session-settings.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/staff-display-name.ts`](../../apps/web/lib/staff-display-name.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/talkback-session.ts`](../../apps/web/lib/talkback-session.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Используют: [`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs).

Переменные окружения (только имена): `CASTLINK_ENFORCE_NODE_ADMISSION`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/app/api/version/route.ts

[`apps/web/app/api/version/route.ts`](../../apps/web/app/api/version/route.ts)

Серверный HTTP-обработчик /api/version. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Библиотеки/Node: `next/server`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/tests/version-api.cjs`](../../apps/web/tests/version-api.cjs).

Переменные окружения (только имена): `NEXT_BUILD_DIR`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_BUILD_NUMBER`, `NEXT_PUBLIC_PRODUCT_VERSION`, `NODE_ENV`.

### apps/web/app/apple-icon.png

[`apps/web/app/apple-icon.png`](../../apps/web/app/apple-icon.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/app/diagnostics/page.tsx

[`apps/web/app/diagnostics/page.tsx`](../../apps/web/app/diagnostics/page.tsx)

React-страница /diagnostics. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts).

Библиотеки/Node: `next/navigation`, `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/error.tsx

[`apps/web/app/error.tsx`](../../apps/web/app/error.tsx)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/favicon.ico

[`apps/web/app/favicon.ico`](../../apps/web/app/favicon.ico)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/app/globals.css

[`apps/web/app/globals.css`](../../apps/web/app/globals.css)

Глобальные дизайн-токены, интерфейс CastLink, LiveKit layout и адаптивные правила.

Используют: [`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx).

### apps/web/app/graphite-workspace.css

[`apps/web/app/graphite-workspace.css`](../../apps/web/app/graphite-workspace.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Используют: [`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx).

### apps/web/app/icon.svg

[`apps/web/app/icon.svg`](../../apps/web/app/icon.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/app/join/page.tsx

[`apps/web/app/join/page.tsx`](../../apps/web/app/join/page.tsx)

React-страница /join. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/entry-links.ts`](../../apps/web/lib/entry-links.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts).

Библиотеки/Node: `react`.

### apps/web/app/layout.tsx

[`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx)

Общая обёртка страниц, metadata, стили и уведомления версии.

Экспортируемые символы: `dynamic`, `metadata`.

Читает/импортирует: [`apps/web/app/globals.css`](../../apps/web/app/globals.css), [`apps/web/app/graphite-workspace.css`](../../apps/web/app/graphite-workspace.css), [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/native-pptx.css`](../../apps/web/components/native-pptx.css).

Библиотеки/Node: `@livekit/components-styles`, `next`.

### apps/web/app/moderator/page.tsx

[`apps/web/app/moderator/page.tsx`](../../apps/web/app/moderator/page.tsx)

React-страница /moderator. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/app/monitor/page.tsx

[`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx)

React-страница /monitor. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/LanguageSwitcher.tsx`](../../apps/web/components/LanguageSwitcher.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `next/navigation`, `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/multiview/[sceneId]/page.module.css

[`apps/web/app/multiview/[sceneId]/page.module.css`](../../apps/web/app/multiview/%5BsceneId%5D/page.module.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Используют: [`apps/web/app/multiview/[sceneId]/page.tsx`](../../apps/web/app/multiview/%5BsceneId%5D/page.tsx).

### apps/web/app/multiview/[sceneId]/page.tsx

[`apps/web/app/multiview/[sceneId]/page.tsx`](../../apps/web/app/multiview/%5BsceneId%5D/page.tsx)

React-страница /multiview/[sceneId]. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/app/multiview/[sceneId]/page.module.css`](../../apps/web/app/multiview/%5BsceneId%5D/page.module.css), [`apps/web/components/multiview/MultiviewAudio.tsx`](../../apps/web/components/multiview/MultiviewAudio.tsx), [`apps/web/components/multiview/MultiviewMedia.tsx`](../../apps/web/components/multiview/MultiviewMedia.tsx), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/multiview-media.ts`](../../apps/web/lib/multiview-media.ts), [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts).

Библиотеки/Node: `livekit-client`, `next/navigation`, `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/not-found.tsx

[`apps/web/app/not-found.tsx`](../../apps/web/app/not-found.tsx)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/output/[identity]/page.tsx

[`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx)

React-страница /output/[identity]. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `livekit-client`, `next/navigation`, `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/output/slot/[slotId]/output.module.css

[`apps/web/app/output/slot/[slotId]/output.module.css`](../../apps/web/app/output/slot/%5BslotId%5D/output.module.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Используют: [`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx).

### apps/web/app/output/slot/[slotId]/page.tsx

[`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx)

React-страница /output/slot/[slotId]. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/app/output/slot/[slotId]/output.module.css`](../../apps/web/app/output/slot/%5BslotId%5D/output.module.css), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts), [`apps/web/lib/slot-output-controller.ts`](../../apps/web/lib/slot-output-controller.ts), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `livekit-client`, `next/navigation`, `react`.

Используют: [`apps/web/tests/fixtures/image-correction-pipeline.tsx`](../../apps/web/tests/fixtures/image-correction-pipeline.tsx), [`apps/web/tests/fixtures/output-transparency.tsx`](../../apps/web/tests/fixtures/output-transparency.tsx).

### apps/web/app/page.tsx

[`apps/web/app/page.tsx`](../../apps/web/app/page.tsx)

React-страница /. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Экспортируемые символы: `dynamic`.

Читает/импортирует: [`apps/web/components/HomeEntry.tsx`](../../apps/web/components/HomeEntry.tsx), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/room-creation-access.ts`](../../apps/web/lib/room-creation-access.ts).

### apps/web/app/room/page.tsx

[`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx)

React-страница /room. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/entry-links.ts`](../../apps/web/lib/entry-links.ts).

Библиотеки/Node: `next/navigation`, `react`.

### apps/web/app/servers/page.tsx

[`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx)

React-страница /servers. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css).

Библиотеки/Node: `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/setup/page.tsx

[`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx)

React-страница /setup. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css), [`apps/web/lib/deployment-model.ts`](../../apps/web/lib/deployment-model.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/studio/page.tsx

[`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx)

React-страница /studio. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Экспортируемые символы: `dynamic`.

Читает/импортирует: [`apps/web/components/HomeEntry.tsx`](../../apps/web/components/HomeEntry.tsx), [`apps/web/components/StudioPageClient.tsx`](../../apps/web/components/StudioPageClient.tsx), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/room-creation-access.ts`](../../apps/web/lib/room-creation-access.ts).

### apps/web/app/studios/page.tsx

[`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx)

React-страница /studios. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css).

Библиотеки/Node: `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/super-admin/page.tsx

[`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx)

React-страница /super-admin. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/PlatformParticipantActions.tsx`](../../apps/web/components/PlatformParticipantActions.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/app/transfer/page.tsx

[`apps/web/app/transfer/page.tsx`](../../apps/web/app/transfer/page.tsx)

React-страница /transfer. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs), [`apps/web/tests/viewer-transfer-page.cjs`](../../apps/web/tests/viewer-transfer-page.cjs).

### apps/web/app/v1/control/node-admission/route.ts

[`apps/web/app/v1/control/node-admission/route.ts`](../../apps/web/app/v1/control/node-admission/route.ts)

Серверный HTTP-обработчик /v1/control/node-admission. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`, `POST`.

Читает/импортирует: [`apps/web/lib/node-admission-store.ts`](../../apps/web/lib/node-admission-store.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts), [`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/v1/control/studio-transfer/route.ts

[`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts)

Серверный HTTP-обработчик /v1/control/studio-transfer. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

### apps/web/app/v1/control/studio/route.ts

[`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts)

Серверный HTTP-обработчик /v1/control/studio. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/v1/node/history/route.ts

[`apps/web/app/v1/node/history/route.ts`](../../apps/web/app/v1/node/history/route.ts)

Серверный HTTP-обработчик /v1/node/history. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/v1/node/operations/route.ts

[`apps/web/app/v1/node/operations/route.ts`](../../apps/web/app/v1/node/operations/route.ts)

Серверный HTTP-обработчик /v1/node/operations. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/v1/node/topology/route.ts

[`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts)

Серверный HTTP-обработчик /v1/node/topology. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `GET`.

Читает/импортирует: [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts).

Библиотеки/Node: `next/server`.

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/app/v1/nodes/heartbeat/route.ts

[`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts)

Серверный HTTP-обработчик /v1/nodes/heartbeat. Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/node-heartbeat.ts`](../../apps/web/lib/node-heartbeat.ts), [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts).

Библиотеки/Node: `next/server`.

### apps/web/app/watch/page.tsx

[`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx)

React-страница /watch. Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/LanguageSwitcher.tsx`](../../apps/web/components/LanguageSwitcher.tsx), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts), [`apps/web/lib/watch-subscriptions.ts`](../../apps/web/lib/watch-subscriptions.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs), [`apps/web/tests/fixtures/image-correction-pipeline.tsx`](../../apps/web/tests/fixtures/image-correction-pipeline.tsx), [`apps/web/tests/watch-transfer.cjs`](../../apps/web/tests/watch-transfer.cjs).

## apps/web/components · 106 файлов

### apps/web/components/AccessGate.tsx

[`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx)

Парольный gate старого входа Studio; не право Super Admin.

Экспортируемые символы: `AccessGate`.

Читает/импортирует: [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx).

### apps/web/components/AdminInviteButton.tsx

[`apps/web/components/AdminInviteButton.tsx`](../../apps/web/components/AdminInviteButton.tsx)

Создание/отзыв room-admin приглашений в разрешённом scope.

Экспортируемые символы: `AdminInviteButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx).

### apps/web/components/AppChrome.tsx

[`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `AppChrome`, `AppFooterSlot`.

Читает/импортирует: [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx), [`apps/web/components/DesignPreview.tsx`](../../apps/web/components/DesignPreview.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs), [`apps/web/tests/design-preview.browser.cjs`](../../apps/web/tests/design-preview.browser.cjs).

### apps/web/components/AppUpdateNotice.tsx

[`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx)

Показ новой версии без вмешательства в чистый output; не автоматический deploy.

Экспортируемые символы: `AppUpdateNotice`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/LanguageSwitcher.tsx`](../../apps/web/components/LanguageSwitcher.tsx), [`apps/web/components/ThemeToggle.tsx`](../../apps/web/components/ThemeToggle.tsx), [`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts).

Библиотеки/Node: `next/navigation`, `react`, `react-dom`.

Используют: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/tests/app-update-notice.cjs`](../../apps/web/tests/app-update-notice.cjs).

Переменные окружения (только имена): `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_BUILD_NUMBER`, `NEXT_PUBLIC_PRODUCT_VERSION`.

### apps/web/components/AudioMeter.module.css

[`apps/web/components/AudioMeter.module.css`](../../apps/web/components/AudioMeter.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx).

### apps/web/components/AudioMeter.tsx

[`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `AudioMeter`.

Читает/импортирует: [`apps/web/components/AudioMeter.module.css`](../../apps/web/components/AudioMeter.module.css), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Используют: [`apps/web/components/GuestAudioMeter.tsx`](../../apps/web/components/GuestAudioMeter.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx).

### apps/web/components/AudioOutputSelect.tsx

[`apps/web/components/AudioOutputSelect.tsx`](../../apps/web/components/AudioOutputSelect.tsx)

Выбор локального аудиовыхода браузера.

Экспортируемые символы: `AudioOutputSelect`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/audio-output.ts`](../../apps/web/lib/audio-output.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/tests/audio-output-switch.cjs`](../../apps/web/tests/audio-output-switch.cjs).

### apps/web/components/BrandIcon.tsx

[`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `BrandIcon`.

Используют: [`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx), [`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx), [`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx), [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/CasterSlotsPanel.tsx

[`apps/web/components/CasterSlotsPanel.tsx`](../../apps/web/components/CasterSlotsPanel.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `CasterSlotsPanel`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/ChatEmojis.module.css

[`apps/web/components/ChatEmojis.module.css`](../../apps/web/components/ChatEmojis.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/ChatEmojis.tsx`](../../apps/web/components/ChatEmojis.tsx).

### apps/web/components/ChatEmojis.tsx

[`apps/web/components/ChatEmojis.tsx`](../../apps/web/components/ChatEmojis.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `emojiLabel`, `formatChatEmojis`, `ChatEmojiPicker`.

Читает/импортирует: [`apps/web/components/ChatEmojis.module.css`](../../apps/web/components/ChatEmojis.module.css), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/chat-emojis.ts`](../../apps/web/lib/chat-emojis.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomChat.tsx`](../../apps/web/components/RoomChat.tsx), [`apps/web/components/RoomReactions.tsx`](../../apps/web/components/RoomReactions.tsx), [`apps/web/components/StaffChatPanel.tsx`](../../apps/web/components/StaffChatPanel.tsx), [`apps/web/tests/fixtures/room-reactions-ui.tsx`](../../apps/web/tests/fixtures/room-reactions-ui.tsx).

### apps/web/components/CoPresentationNavigation.tsx

[`apps/web/components/CoPresentationNavigation.tsx`](../../apps/web/components/CoPresentationNavigation.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PresentationScreenNavigation`, `CoPresentationNavigationProvider`, `useCoPresentationNavigation`, `usePresentationNavigationButtonFocus`.

Читает/импортирует: [`apps/web/lib/co-presentation-acceptance.ts`](../../apps/web/lib/co-presentation-acceptance.ts), [`apps/web/lib/co-presentation-navigation.ts`](../../apps/web/lib/co-presentation-navigation.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/RecipientSlideControls.tsx`](../../apps/web/components/RecipientSlideControls.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/ScreenShareSettings.tsx`](../../apps/web/components/ScreenShareSettings.tsx).

### apps/web/components/CoPresentationPanel.tsx

[`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `CoPresentationPanel`.

Читает/импортирует: [`apps/web/components/CoPresentationNavigation.tsx`](../../apps/web/components/CoPresentationNavigation.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/PdfPresentationViewer.tsx`](../../apps/web/components/PdfPresentationViewer.tsx), [`apps/web/components/RecipientSlideControls.tsx`](../../apps/web/components/RecipientSlideControls.tsx), [`apps/web/lib/co-presentation-acceptance.ts`](../../apps/web/lib/co-presentation-acceptance.ts), [`apps/web/lib/co-presentation-client.ts`](../../apps/web/lib/co-presentation-client.ts), [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts), [`apps/web/lib/co-presentation-helper-client.ts`](../../apps/web/lib/co-presentation-helper-client.ts), [`apps/web/lib/co-presentation-native.ts`](../../apps/web/lib/co-presentation-native.ts), [`apps/web/lib/co-presentation-navigation.ts`](../../apps/web/lib/co-presentation-navigation.ts), [`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts), [`apps/web/lib/desktop-stop-panel.ts`](../../apps/web/lib/desktop-stop-panel.ts), [`apps/web/lib/floating-panel-position.ts`](../../apps/web/lib/floating-panel-position.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/presentation-file-client.ts`](../../apps/web/lib/presentation-file-client.ts), [`apps/web/lib/screen-share-stop-panel.ts`](../../apps/web/lib/screen-share-stop-panel.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/caster-feedback.browser.cjs`](../../apps/web/tests/caster-feedback.browser.cjs), [`apps/web/tests/fixtures/caster-layout-proof.tsx`](../../apps/web/tests/fixtures/caster-layout-proof.tsx).

### apps/web/components/ConferenceScene.module.css

[`apps/web/components/ConferenceScene.module.css`](../../apps/web/components/ConferenceScene.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/ConferenceScene.tsx`](../../apps/web/components/ConferenceScene.tsx).

### apps/web/components/ConferenceScene.tsx

[`apps/web/components/ConferenceScene.tsx`](../../apps/web/components/ConferenceScene.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ConferenceSceneItem`, `ConferenceScene`.

Читает/импортирует: [`apps/web/components/ConferenceScene.module.css`](../../apps/web/components/ConferenceScene.module.css), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/conference-scene.ts`](../../apps/web/lib/conference-scene.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/tests/fixtures/caster-layout-proof.tsx`](../../apps/web/tests/fixtures/caster-layout-proof.tsx), [`apps/web/tests/fixtures/room-reactions-ui.tsx`](../../apps/web/tests/fixtures/room-reactions-ui.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx).

### apps/web/components/DesignPreview.tsx

[`apps/web/components/DesignPreview.tsx`](../../apps/web/components/DesignPreview.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `DesignPreview`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/design-preview.ts`](../../apps/web/lib/design-preview.ts).

Библиотеки/Node: `next/navigation`, `react`.

Используют: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx).

### apps/web/components/EmergencyReservePanel.tsx

[`apps/web/components/EmergencyReservePanel.tsx`](../../apps/web/components/EmergencyReservePanel.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `EmergencyReservePanel`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/ServerTransferPanel.tsx`](../../apps/web/components/ServerTransferPanel.tsx), [`apps/web/lib/client-reserve.ts`](../../apps/web/lib/client-reserve.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts), [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts).

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/EntryFlow.module.css

[`apps/web/components/EntryFlow.module.css`](../../apps/web/components/EntryFlow.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/HostedAccessGate.tsx`](../../apps/web/components/HostedAccessGate.tsx).

### apps/web/components/EntryShell.tsx

[`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `EntryIcon`, `EntryShell`.

Читает/импортирует: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/EntryFlow.module.css`](../../apps/web/components/EntryFlow.module.css), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/LanguageSwitcher.tsx`](../../apps/web/components/LanguageSwitcher.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/join/page.tsx`](../../apps/web/app/join/page.tsx), [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/HostedAccessGate.tsx`](../../apps/web/components/HostedAccessGate.tsx).

### apps/web/components/GuestAccessGate.tsx

[`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx)

Гостевой вход, имя, пароль/приглашение и проверка комнаты.

Экспортируемые символы: `GuestAccessGate`.

Читает/импортирует: [`apps/web/components/EntryFlow.module.css`](../../apps/web/components/EntryFlow.module.css), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-resume.ts`](../../apps/web/lib/guest-resume.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs), [`apps/web/tests/guest-entry.cjs`](../../apps/web/tests/guest-entry.cjs), [`apps/web/tests/guest-invite-entry.cjs`](../../apps/web/tests/guest-invite-entry.cjs).

### apps/web/components/GuestAudioMeter.tsx

[`apps/web/components/GuestAudioMeter.tsx`](../../apps/web/components/GuestAudioMeter.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestAudioMeter`.

Читает/импортирует: [`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx), [`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/studio-caster-color-controls.browser.cjs`](../../apps/web/tests/studio-caster-color-controls.browser.cjs).

### apps/web/components/GuestAudioProfileSelector.tsx

[`apps/web/components/GuestAudioProfileSelector.tsx`](../../apps/web/components/GuestAudioProfileSelector.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestAudioProfileSelector`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts).

### apps/web/components/GuestAvCheck.tsx

[`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx)

Предварительный просмотр камеры/микрофона и выбор устройств до соединения.

Экспортируемые символы: `GuestAvCheck`.

Читает/импортирует: [`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/GuestPreflight.module.css`](../../apps/web/components/GuestPreflight.module.css), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/lib/audio-device-test.ts`](../../apps/web/lib/audio-device-test.ts), [`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/lib/i18n/entry-preflight.ts`](../../apps/web/lib/i18n/entry-preflight.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestWaitingPanel.tsx`](../../apps/web/components/GuestWaitingPanel.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx), [`apps/web/tests/guest-audio-profile-ui.cjs`](../../apps/web/tests/guest-audio-profile-ui.cjs), [`apps/web/tests/guest-av-layout.browser.cjs`](../../apps/web/tests/guest-av-layout.browser.cjs), [`apps/web/tests/guest-preflight-ui.cjs`](../../apps/web/tests/guest-preflight-ui.cjs).

### apps/web/components/GuestCameraButton.tsx

[`apps/web/components/GuestCameraButton.tsx`](../../apps/web/components/GuestCameraButton.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestCameraButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`.

Используют: [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx).

### apps/web/components/GuestCameraCaptureControls.tsx

[`apps/web/components/GuestCameraCaptureControls.tsx`](../../apps/web/components/GuestCameraCaptureControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestCameraCaptureControls`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx), [`apps/web/tests/guest-media-controls-ui.cjs`](../../apps/web/tests/guest-media-controls-ui.cjs).

### apps/web/components/GuestCameraResolutionControl.tsx

[`apps/web/components/GuestCameraResolutionControl.tsx`](../../apps/web/components/GuestCameraResolutionControl.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestCameraResolutionControl`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/GuestCodecCameraButton.tsx

[`apps/web/components/GuestCodecCameraButton.tsx`](../../apps/web/components/GuestCodecCameraButton.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestCodecCameraButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx).

### apps/web/components/GuestDeviceRequestDialog.tsx

[`apps/web/components/GuestDeviceRequestDialog.tsx`](../../apps/web/components/GuestDeviceRequestDialog.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestDeviceRequestDialog`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestDeviceRequests.tsx`](../../apps/web/components/GuestDeviceRequests.tsx), [`apps/web/tests/guest-device-controls-ui.cjs`](../../apps/web/tests/guest-device-controls-ui.cjs).

### apps/web/components/GuestDeviceRequests.tsx

[`apps/web/components/GuestDeviceRequests.tsx`](../../apps/web/components/GuestDeviceRequests.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestDeviceRequestsProps`, `GuestDeviceRequests`.

Читает/импортирует: [`apps/web/components/GuestDeviceRequestDialog.tsx`](../../apps/web/components/GuestDeviceRequestDialog.tsx), [`apps/web/lib/guest-device-control-client.ts`](../../apps/web/lib/guest-device-control-client.ts), [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts), [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx).

### apps/web/components/GuestEntrySettings.tsx

[`apps/web/components/GuestEntrySettings.tsx`](../../apps/web/components/GuestEntrySettings.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestEntrySettings`, `SavedGuestEntrySettings`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx).

### apps/web/components/GuestInviteLanding.tsx

[`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestInviteLanding`.

Читает/импортирует: [`apps/web/components/EntryFlow.module.css`](../../apps/web/components/EntryFlow.module.css), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/entry-links.ts`](../../apps/web/lib/entry-links.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/join/page.tsx`](../../apps/web/app/join/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx).

### apps/web/components/GuestMicrophoneButton.tsx

[`apps/web/components/GuestMicrophoneButton.tsx`](../../apps/web/components/GuestMicrophoneButton.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestMicrophoneButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/components/GuestParticipantsTable.tsx

[`apps/web/components/GuestParticipantsTable.tsx`](../../apps/web/components/GuestParticipantsTable.tsx)

Таблица гостей и разрешённые действия/индивидуальные vMix-ссылки.

Экспортируемые символы: `GuestParticipantRow`, `GuestParticipantsTable`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Используют: [`apps/web/tests/public-room-entry.cjs`](../../apps/web/tests/public-room-entry.cjs).

### apps/web/components/GuestPreflight.module.css

[`apps/web/components/GuestPreflight.module.css`](../../apps/web/components/GuestPreflight.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx).

### apps/web/components/GuestPrivateTalkback.tsx

[`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestPrivateTalkback`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-audio-gain.ts`](../../apps/web/lib/guest-audio-gain.ts), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/private-talkback-audio.ts`](../../apps/web/lib/private-talkback-audio.ts), [`apps/web/lib/private-talkback-reply.ts`](../../apps/web/lib/private-talkback-reply.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/private-talkback-controls.cjs`](../../apps/web/tests/private-talkback-controls.cjs).

### apps/web/components/GuestRoleOffer.tsx

[`apps/web/components/GuestRoleOffer.tsx`](../../apps/web/components/GuestRoleOffer.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestRoleOffer`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/participant-role-client.ts`](../../apps/web/lib/participant-role-client.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/GuestServerPicker.module.css

[`apps/web/components/GuestServerPicker.module.css`](../../apps/web/components/GuestServerPicker.module.css)

Выбор сервера для подключения гостя; проверка и сохранение адреса.

Используют: [`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx).

### apps/web/components/GuestServerPicker.tsx

[`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx)

Выбор сервера для подключения гостя; проверка и сохранение адреса.

Экспортируемые символы: `GuestServerPicker`.

Читает/импортирует: [`apps/web/components/GuestServerPicker.module.css`](../../apps/web/components/GuestServerPicker.module.css), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/saved-servers.ts`](../../apps/web/lib/saved-servers.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx).

### apps/web/components/GuestSettingsPanel.tsx

[`apps/web/components/GuestSettingsPanel.tsx`](../../apps/web/components/GuestSettingsPanel.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestSettingsPanel`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx).

### apps/web/components/GuestVideoCard.module.css

[`apps/web/components/GuestVideoCard.module.css`](../../apps/web/components/GuestVideoCard.module.css)

Студийная карточка гостя: превью, лимит камеры, личный мониторинг, метр и фактические данные.

Используют: [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx).

### apps/web/components/GuestVideoCard.tsx

[`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx)

Студийная карточка гостя: превью, лимит камеры, личный мониторинг, метр и фактические данные.

Экспортируемые символы: `GuestVideoCardData`, `GuestVideoCard`.

Читает/импортирует: [`apps/web/components/GuestVideoCard.module.css`](../../apps/web/components/GuestVideoCard.module.css), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/ParticipantRenameButton.tsx`](../../apps/web/components/ParticipantRenameButton.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/caster-layout-proof.tsx`](../../apps/web/tests/fixtures/caster-layout-proof.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx), [`apps/web/tests/participants-compact.browser.cjs`](../../apps/web/tests/participants-compact.browser.cjs), [`apps/web/tests/studio-caster-color-controls.browser.cjs`](../../apps/web/tests/studio-caster-color-controls.browser.cjs).

### apps/web/components/GuestWaitingPanel.tsx

[`apps/web/components/GuestWaitingPanel.tsx`](../../apps/web/components/GuestWaitingPanel.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestWaitingPanel`.

Читает/импортирует: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts).

Библиотеки/Node: `react`.

### apps/web/components/GuestWorkspace.tsx

[`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestWorkspace`.

Читает/импортирует: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestCodecCameraButton.tsx`](../../apps/web/components/GuestCodecCameraButton.tsx), [`apps/web/components/GuestDeviceRequests.tsx`](../../apps/web/components/GuestDeviceRequests.tsx), [`apps/web/components/GuestMicrophoneButton.tsx`](../../apps/web/components/GuestMicrophoneButton.tsx), [`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx), [`apps/web/components/GuestRoleOffer.tsx`](../../apps/web/components/GuestRoleOffer.tsx), [`apps/web/components/GuestSettingsPanel.tsx`](../../apps/web/components/GuestSettingsPanel.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/ScreenShareSettings.tsx`](../../apps/web/components/ScreenShareSettings.tsx), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/connection-route.ts`](../../apps/web/lib/connection-route.ts), [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts), [`apps/web/lib/guest-audio-gain.ts`](../../apps/web/lib/guest-audio-gain.ts), [`apps/web/lib/guest-audio-permissions.ts`](../../apps/web/lib/guest-audio-permissions.ts), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-camera-outbound.ts`](../../apps/web/lib/guest-camera-outbound.ts), [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-media-control-client.ts`](../../apps/web/lib/guest-media-control-client.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-resume.ts`](../../apps/web/lib/guest-resume.ts), [`apps/web/lib/guest-staff-transition.ts`](../../apps/web/lib/guest-staff-transition.ts), [`apps/web/lib/guest-video-bitrate.ts`](../../apps/web/lib/guest-video-bitrate.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts), [`apps/web/lib/room-mode.ts`](../../apps/web/lib/room-mode.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/studio-video-recovery.ts`](../../apps/web/lib/studio-video-recovery.ts), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts), [`apps/web/lib/use-room-chat-bearer.ts`](../../apps/web/lib/use-room-chat-bearer.ts), [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `next/navigation`, `react`.

Используют: [`apps/web/app/join/page.tsx`](../../apps/web/app/join/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/HomeEntry.tsx

[`apps/web/components/HomeEntry.tsx`](../../apps/web/components/HomeEntry.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/page.tsx`](../../apps/web/app/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/HomeLobby.tsx

[`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `HomeLobby`.

Читает/импортирует: [`apps/web/components/EntryFlow.module.css`](../../apps/web/components/EntryFlow.module.css), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/GuestEntrySettings.tsx`](../../apps/web/components/GuestEntrySettings.tsx), [`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/HostedAccessGate.tsx`](../../apps/web/components/HostedAccessGate.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/entry-links.ts`](../../apps/web/lib/entry-links.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/HomeEntry.tsx`](../../apps/web/components/HomeEntry.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs), [`apps/web/tests/public-room-entry.cjs`](../../apps/web/tests/public-room-entry.cjs).

### apps/web/components/HostedAccessGate.tsx

[`apps/web/components/HostedAccessGate.tsx`](../../apps/web/components/HostedAccessGate.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `HostedAccessGate`.

Читает/импортирует: [`apps/web/components/EntryFlow.module.css`](../../apps/web/components/EntryFlow.module.css), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/I18nProvider.tsx

[`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `I18nProvider`, `useI18n`.

Читает/импортирует: [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/diagnostics/page.tsx`](../../apps/web/app/diagnostics/page.tsx), [`apps/web/app/error.tsx`](../../apps/web/app/error.tsx), [`apps/web/app/join/page.tsx`](../../apps/web/app/join/page.tsx), [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/not-found.tsx`](../../apps/web/app/not-found.tsx), [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx), [`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx), [`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx), [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx), [`apps/web/app/transfer/page.tsx`](../../apps/web/app/transfer/page.tsx), [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/AdminInviteButton.tsx`](../../apps/web/components/AdminInviteButton.tsx), [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx), [`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx), [`apps/web/components/AudioOutputSelect.tsx`](../../apps/web/components/AudioOutputSelect.tsx), [`apps/web/components/CasterSlotsPanel.tsx`](../../apps/web/components/CasterSlotsPanel.tsx), [`apps/web/components/ChatEmojis.tsx`](../../apps/web/components/ChatEmojis.tsx), [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/ConferenceScene.tsx`](../../apps/web/components/ConferenceScene.tsx), [`apps/web/components/DesignPreview.tsx`](../../apps/web/components/DesignPreview.tsx), [`apps/web/components/EmergencyReservePanel.tsx`](../../apps/web/components/EmergencyReservePanel.tsx), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/GuestAudioProfileSelector.tsx`](../../apps/web/components/GuestAudioProfileSelector.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestCameraButton.tsx`](../../apps/web/components/GuestCameraButton.tsx), [`apps/web/components/GuestCameraCaptureControls.tsx`](../../apps/web/components/GuestCameraCaptureControls.tsx), [`apps/web/components/GuestCameraResolutionControl.tsx`](../../apps/web/components/GuestCameraResolutionControl.tsx), [`apps/web/components/GuestCodecCameraButton.tsx`](../../apps/web/components/GuestCodecCameraButton.tsx), [`apps/web/components/GuestDeviceRequestDialog.tsx`](../../apps/web/components/GuestDeviceRequestDialog.tsx), [`apps/web/components/GuestEntrySettings.tsx`](../../apps/web/components/GuestEntrySettings.tsx), [`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx), [`apps/web/components/GuestMicrophoneButton.tsx`](../../apps/web/components/GuestMicrophoneButton.tsx), [`apps/web/components/GuestParticipantsTable.tsx`](../../apps/web/components/GuestParticipantsTable.tsx), [`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx), [`apps/web/components/GuestRoleOffer.tsx`](../../apps/web/components/GuestRoleOffer.tsx), [`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx), [`apps/web/components/GuestSettingsPanel.tsx`](../../apps/web/components/GuestSettingsPanel.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/GuestWaitingPanel.tsx`](../../apps/web/components/GuestWaitingPanel.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/HomeEntry.tsx`](../../apps/web/components/HomeEntry.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/HostedAccessGate.tsx`](../../apps/web/components/HostedAccessGate.tsx), [`apps/web/components/LanguageSwitcher.tsx`](../../apps/web/components/LanguageSwitcher.tsx), [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/components/ModeratorInviteButton.tsx`](../../apps/web/components/ModeratorInviteButton.tsx), [`apps/web/components/ModeratorRoomTools.tsx`](../../apps/web/components/ModeratorRoomTools.tsx), [`apps/web/components/ModeratorStudioMonitoring.tsx`](../../apps/web/components/ModeratorStudioMonitoring.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/ParticipantRenameButton.tsx`](../../apps/web/components/ParticipantRenameButton.tsx), [`apps/web/components/ParticipantSourceCard.tsx`](../../apps/web/components/ParticipantSourceCard.tsx), [`apps/web/components/PdfPresentationViewer.tsx`](../../apps/web/components/PdfPresentationViewer.tsx), [`apps/web/components/PersonalCasterLink.tsx`](../../apps/web/components/PersonalCasterLink.tsx), [`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx), [`apps/web/components/PlatformParticipantActions.tsx`](../../apps/web/components/PlatformParticipantActions.tsx), [`apps/web/components/PresentationControls.tsx`](../../apps/web/components/PresentationControls.tsx), [`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx), [`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx), [`apps/web/components/RoomChat.tsx`](../../apps/web/components/RoomChat.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/RoomCreationPasswordSettings.tsx`](../../apps/web/components/RoomCreationPasswordSettings.tsx), [`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx), [`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx), [`apps/web/components/RoomReactions.tsx`](../../apps/web/components/RoomReactions.tsx), [`apps/web/components/RotateVideoButton.tsx`](../../apps/web/components/RotateVideoButton.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/components/ScreenShareSettings.tsx`](../../apps/web/components/ScreenShareSettings.tsx), [`apps/web/components/ServerConnections.tsx`](../../apps/web/components/ServerConnections.tsx), [`apps/web/components/ServerTransferPanel.tsx`](../../apps/web/components/ServerTransferPanel.tsx), [`apps/web/components/SourceRoster.tsx`](../../apps/web/components/SourceRoster.tsx), [`apps/web/components/StaffChatPanel.tsx`](../../apps/web/components/StaffChatPanel.tsx), [`apps/web/components/StaffParticipantsPanel.tsx`](../../apps/web/components/StaffParticipantsPanel.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx), [`apps/web/components/StudioGuestDeviceControls.tsx`](../../apps/web/components/StudioGuestDeviceControls.tsx), [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx), [`apps/web/components/StudioGuestMediaPanel.tsx`](../../apps/web/components/StudioGuestMediaPanel.tsx), [`apps/web/components/StudioGuestRoleControls.tsx`](../../apps/web/components/StudioGuestRoleControls.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx), [`apps/web/components/StudioPageClient.tsx`](../../apps/web/components/StudioPageClient.tsx), [`apps/web/components/StudioReturnPublishingControls.tsx`](../../apps/web/components/StudioReturnPublishingControls.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/components/StudioVideoModeControls.tsx`](../../apps/web/components/StudioVideoModeControls.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/components/ThemeToggle.tsx`](../../apps/web/components/ThemeToggle.tsx), [`apps/web/components/multiview/ImageTransformControls.tsx`](../../apps/web/components/multiview/ImageTransformControls.tsx), [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/components/multiview/MultiviewMedia.tsx`](../../apps/web/components/multiview/MultiviewMedia.tsx), [`apps/web/tests/fixtures/room-reactions-ui.tsx`](../../apps/web/tests/fixtures/room-reactions-ui.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx), [`apps/web/tests/guest-entry.cjs`](../../apps/web/tests/guest-entry.cjs), [`apps/web/tests/i18n.browser.cjs`](../../apps/web/tests/i18n.browser.cjs).

### apps/web/components/LanguageSwitcher.tsx

[`apps/web/components/LanguageSwitcher.tsx`](../../apps/web/components/LanguageSwitcher.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `InlineLanguageSwitcher`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx), [`apps/web/components/EntryShell.tsx`](../../apps/web/components/EntryShell.tsx), [`apps/web/tests/i18n.browser.cjs`](../../apps/web/tests/i18n.browser.cjs).

### apps/web/components/MediaDevicePicker.tsx

[`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx)

Панель input/output устройств и обновление их списка.

Экспортируемые символы: `MediaDevicePicker`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/audio-output.ts`](../../apps/web/lib/audio-output.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx), [`apps/web/tests/audio-output-switch.cjs`](../../apps/web/tests/audio-output-switch.cjs), [`apps/web/tests/guest-device-initial-permissions.cjs`](../../apps/web/tests/guest-device-initial-permissions.cjs).

### apps/web/components/ModeratorInviteButton.tsx

[`apps/web/components/ModeratorInviteButton.tsx`](../../apps/web/components/ModeratorInviteButton.tsx)

Выдача и отзыв модераторских приглашений.

Экспортируемые символы: `ModeratorInviteButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx).

### apps/web/components/ModeratorRoomTools.tsx

[`apps/web/components/ModeratorRoomTools.tsx`](../../apps/web/components/ModeratorRoomTools.tsx)

Доступные модератору операции с комнатами.

Экспортируемые символы: `ModeratorRoomTools`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/ModeratorStudioMonitoring.tsx

[`apps/web/components/ModeratorStudioMonitoring.tsx`](../../apps/web/components/ModeratorStudioMonitoring.tsx)

Блок личного мониторинга Studio для модераторского режима.

Экспортируемые символы: `ModeratorStudioMonitoring`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts).

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx).

### apps/web/components/MonitoringControls.tsx

[`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx)

Общие кнопки личного audio/video mute и громкости.

Экспортируемые символы: `MonitoringControls`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts).

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/caster-layout-proof.tsx`](../../apps/web/tests/fixtures/caster-layout-proof.tsx).

### apps/web/components/ParticipantRenameButton.tsx

[`apps/web/components/ParticipantRenameButton.tsx`](../../apps/web/components/ParticipantRenameButton.tsx)

Форма переименования гостя своей комнаты для Studio/admin/moderator.

Экспортируемые символы: `ParticipantRenameButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/ParticipantSourceCard.tsx

[`apps/web/components/ParticipantSourceCard.tsx`](../../apps/web/components/ParticipantSourceCard.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PublishedSourcePreview`, `ParticipantSourceCard`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/caster-layout-proof.tsx`](../../apps/web/tests/fixtures/caster-layout-proof.tsx), [`apps/web/tests/participants-compact.browser.cjs`](../../apps/web/tests/participants-compact.browser.cjs).

### apps/web/components/PdfPresentationViewer.tsx

[`apps/web/components/PdfPresentationViewer.tsx`](../../apps/web/components/PdfPresentationViewer.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PdfPresentationViewer`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/presentation-upload-limits.ts`](../../apps/web/lib/presentation-upload-limits.ts).

Библиотеки/Node: `pdfjs-dist`, `react`.

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/PresentationControls.tsx`](../../apps/web/components/PresentationControls.tsx).

### apps/web/components/PersonalCasterLink.tsx

[`apps/web/components/PersonalCasterLink.tsx`](../../apps/web/components/PersonalCasterLink.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PersonalCasterLink`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Библиотеки/Node: `react`.

### apps/web/components/PlatformAccessGate.tsx

[`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx)

UI gate только по отдельной Super Admin сессии; права дополнительно проверяет API.

Экспортируемые символы: `PlatformAccessGate`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx), [`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/PlatformParticipantActions.tsx

[`apps/web/components/PlatformParticipantActions.tsx`](../../apps/web/components/PlatformParticipantActions.tsx)

Явные операции Super Admin с участником: история, display name и отключение.

Экспортируемые символы: `PlatformParticipantActions`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx).

### apps/web/components/PresentationControls.tsx

[`apps/web/components/PresentationControls.tsx`](../../apps/web/components/PresentationControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PresentationControls`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/PdfPresentationViewer.tsx`](../../apps/web/components/PdfPresentationViewer.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts), [`apps/web/lib/pdf-presentation-client.ts`](../../apps/web/lib/pdf-presentation-client.ts), [`apps/web/lib/presentation-control.ts`](../../apps/web/lib/presentation-control.ts).

Библиотеки/Node: `livekit-client`, `react`.

### apps/web/components/RecipientSlideControls.tsx

[`apps/web/components/RecipientSlideControls.tsx`](../../apps/web/components/RecipientSlideControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `recipientSlideSessions`, `recipientGrantTransition`, `RecipientSlideControls`.

Читает/импортирует: [`apps/web/components/CoPresentationNavigation.tsx`](../../apps/web/components/CoPresentationNavigation.tsx), [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts), [`apps/web/lib/co-presentation-navigation.ts`](../../apps/web/lib/co-presentation-navigation.ts), [`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts), [`apps/web/lib/floating-panel-position.ts`](../../apps/web/lib/floating-panel-position.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx).

### apps/web/components/RemoteStudioDevices.tsx

[`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx)

Команды выбора устройств основной Studio с подтверждёнными доступными device IDs.

Экспортируемые символы: `StudioDevicePatch`, `RemoteStudioDevices`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx), [`apps/web/tests/remote-studio-devices.cjs`](../../apps/web/tests/remote-studio-devices.cjs).

### apps/web/components/RemoteVideoPreview.tsx

[`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx)

Подключение remote camera/screen tracks к video-элементам и применение rotation.

Экспортируемые символы: `RemoteVideoPreview`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/RoomChat.tsx

[`apps/web/components/RoomChat.tsx`](../../apps/web/components/RoomChat.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `RoomChat`.

Читает/импортирует: [`apps/web/components/ChatEmojis.tsx`](../../apps/web/components/ChatEmojis.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/use-persistent-room-chat.ts`](../../apps/web/lib/use-persistent-room-chat.ts).

Библиотеки/Node: `@livekit/components-react`, `react`.

Используют: [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx).

### apps/web/components/RoomConference.tsx

[`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx)

Гостевая видеосетка, режим only-studio и собственный нижний footer управления.

Экспортируемые символы: `ConferenceAudioRenderer`, `RoomConference`.

Читает/импортирует: [`apps/web/components/CoPresentationNavigation.tsx`](../../apps/web/components/CoPresentationNavigation.tsx), [`apps/web/components/ConferenceScene.tsx`](../../apps/web/components/ConferenceScene.tsx), [`apps/web/components/GuestCameraButton.tsx`](../../apps/web/components/GuestCameraButton.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/RoomChat.tsx`](../../apps/web/components/RoomChat.tsx), [`apps/web/components/RoomReactions.tsx`](../../apps/web/components/RoomReactions.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/lib/co-presentation-navigation.ts`](../../apps/web/lib/co-presentation-navigation.ts), [`apps/web/lib/fullscreen-chrome.ts`](../../apps/web/lib/fullscreen-chrome.ts), [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts), [`apps/web/lib/use-persistent-room-chat.ts`](../../apps/web/lib/use-persistent-room-chat.ts), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/caster-feedback.browser.cjs`](../../apps/web/tests/caster-feedback.browser.cjs), [`apps/web/tests/conference-audio-policy.cjs`](../../apps/web/tests/conference-audio-policy.cjs), [`apps/web/tests/fixtures/caster-layout-proof.tsx`](../../apps/web/tests/fixtures/caster-layout-proof.tsx).

### apps/web/components/RoomControlConsole.tsx

[`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx)

Полный admin/moderator UI комнаты: доступ, RTC, настройки, участники, статистика.

Экспортируемые символы: `RoomControlConsole`.

Читает/импортирует: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/CasterSlotsPanel.tsx`](../../apps/web/components/CasterSlotsPanel.tsx), [`apps/web/components/GuestAudioMeter.tsx`](../../apps/web/components/GuestAudioMeter.tsx), [`apps/web/components/GuestCameraResolutionControl.tsx`](../../apps/web/components/GuestCameraResolutionControl.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/ModeratorInviteButton.tsx`](../../apps/web/components/ModeratorInviteButton.tsx), [`apps/web/components/ModeratorRoomTools.tsx`](../../apps/web/components/ModeratorRoomTools.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/ParticipantRenameButton.tsx`](../../apps/web/components/ParticipantRenameButton.tsx), [`apps/web/components/ParticipantSourceCard.tsx`](../../apps/web/components/ParticipantSourceCard.tsx), [`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx), [`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx), [`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx), [`apps/web/components/RotateVideoButton.tsx`](../../apps/web/components/RotateVideoButton.tsx), [`apps/web/components/SourceRoster.tsx`](../../apps/web/components/SourceRoster.tsx), [`apps/web/components/StaffChatPanel.tsx`](../../apps/web/components/StaffChatPanel.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css), [`apps/web/components/StudioGuestRoleControls.tsx`](../../apps/web/components/StudioGuestRoleControls.tsx), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/components/StudioVideoModeControls.tsx`](../../apps/web/components/StudioVideoModeControls.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts), [`apps/web/lib/use-staff-room-chat.ts`](../../apps/web/lib/use-staff-room-chat.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/app/admin/page.tsx`](../../apps/web/app/admin/page.tsx), [`apps/web/app/moderator/page.tsx`](../../apps/web/app/moderator/page.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/RoomCreationPasswordSettings.tsx

[`apps/web/components/RoomCreationPasswordSettings.tsx`](../../apps/web/components/RoomCreationPasswordSettings.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `useRoomCreationPasswordAccess`, `RoomCreationPasswordTab`, `RoomCreationPasswordSettings`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/RoomInviteButton.tsx

[`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx)

Создание и управление гостевым приглашением комнаты.

Экспортируемые символы: `RoomInviteButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/room-entry-url.ts`](../../apps/web/components/room-entry-url.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx).

### apps/web/components/RoomManagementPanel.tsx

[`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx)

Создание/выбор/редактирование комнат в Studio UI.

Экспортируемые символы: `RoomManagementPanel`.

Читает/импортирует: [`apps/web/components/AdminInviteButton.tsx`](../../apps/web/components/AdminInviteButton.tsx), [`apps/web/components/GuestEntrySettings.tsx`](../../apps/web/components/GuestEntrySettings.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/ModeratorInviteButton.tsx`](../../apps/web/components/ModeratorInviteButton.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/public-room-entry.cjs`](../../apps/web/tests/public-room-entry.cjs).

### apps/web/components/RoomReactions.module.css

[`apps/web/components/RoomReactions.module.css`](../../apps/web/components/RoomReactions.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/RoomReactions.tsx`](../../apps/web/components/RoomReactions.tsx).

### apps/web/components/RoomReactions.tsx

[`apps/web/components/RoomReactions.tsx`](../../apps/web/components/RoomReactions.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `RoomReactions`.

Читает/импортирует: [`apps/web/components/ChatEmojis.tsx`](../../apps/web/components/ChatEmojis.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/RoomReactions.module.css`](../../apps/web/components/RoomReactions.module.css), [`apps/web/lib/chat-emojis.ts`](../../apps/web/lib/chat-emojis.ts), [`apps/web/lib/room-reactions.ts`](../../apps/web/lib/room-reactions.ts).

Библиотеки/Node: `livekit-client`, `react`, `react-dom`.

Используют: [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/tests/fixtures/room-reactions-ui.tsx`](../../apps/web/tests/fixtures/room-reactions-ui.tsx).

### apps/web/components/RotateVideoButton.tsx

[`apps/web/components/RotateVideoButton.tsx`](../../apps/web/components/RotateVideoButton.tsx)

Отправка разрешённой команды поворота выбранного участника на 90°.

Экспортируемые символы: `RotateVideoButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx).

### apps/web/components/ScreenShareButton.tsx

[`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx)

Состояния демонстрации экрана, временные ошибки, поддержка браузера и busy guard.

Экспортируемые символы: `ScreenShareButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/co-presentation-client.ts`](../../apps/web/lib/co-presentation-client.ts), [`apps/web/lib/desktop-stop-panel.ts`](../../apps/web/lib/desktop-stop-panel.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/screen-share-stop-panel.ts`](../../apps/web/lib/screen-share-stop-panel.ts), [`apps/web/lib/screen-share.ts`](../../apps/web/lib/screen-share.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx).

### apps/web/components/ScreenShareSettings.tsx

[`apps/web/components/ScreenShareSettings.tsx`](../../apps/web/components/ScreenShareSettings.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ScreenShareSettings`.

Читает/импортирует: [`apps/web/components/CoPresentationNavigation.tsx`](../../apps/web/components/CoPresentationNavigation.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx).

### apps/web/components/ServerConnections.tsx

[`apps/web/components/ServerConnections.tsx`](../../apps/web/components/ServerConnections.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ServerConnections`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/ServerTransferPanel.tsx

[`apps/web/components/ServerTransferPanel.tsx`](../../apps/web/components/ServerTransferPanel.tsx)

Выбор целевого сервера, состояние и запуск переноса Studio.

Экспортируемые символы: `TransferTarget`, `TransferInfo`, `ServerTransferPanel`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Используют: [`apps/web/components/EmergencyReservePanel.tsx`](../../apps/web/components/EmergencyReservePanel.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/SourceRoster.tsx

[`apps/web/components/SourceRoster.tsx`](../../apps/web/components/SourceRoster.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SourceRosterItem`, `SourceRoster`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/StaffChatPanel.tsx

[`apps/web/components/StaffChatPanel.tsx`](../../apps/web/components/StaffChatPanel.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StaffChatTab`, `StaffChatPanel`.

Читает/импортирует: [`apps/web/components/ChatEmojis.tsx`](../../apps/web/components/ChatEmojis.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/use-staff-room-chat.ts`](../../apps/web/lib/use-staff-room-chat.ts).

Библиотеки/Node: `@livekit/components-react`, `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/StaffParticipantsPanel.tsx

[`apps/web/components/StaffParticipantsPanel.tsx`](../../apps/web/components/StaffParticipantsPanel.tsx)

Представление подключённого персонала и role badges.

Экспортируемые символы: `StaffParticipantView`, `StaffParticipantsPanel`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts).

Библиотеки/Node: `react`.

### apps/web/components/StatisticsDashboard.tsx

[`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx)

Фильтры периода/роли/identity/session, графики, таблицы и экспорт.

Экспортируемые символы: `statisticsTokenRefreshUrl`, `StatisticsDashboard`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts), [`apps/web/lib/stats-report.ts`](../../apps/web/lib/stats-report.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/statistics-dashboard-refresh.cjs`](../../apps/web/tests/statistics-dashboard-refresh.cjs).

### apps/web/components/StudioCasterColorControls.module.css

[`apps/web/components/StudioCasterColorControls.module.css`](../../apps/web/components/StudioCasterColorControls.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx).

### apps/web/components/StudioCasterImageControls.tsx

[`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StudioCasterImageControls`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioCasterColorControls.module.css`](../../apps/web/components/StudioCasterColorControls.module.css), [`apps/web/components/multiview/ImageTransformControls.module.css`](../../apps/web/components/multiview/ImageTransformControls.module.css), [`apps/web/components/multiview/ImageTransformControls.tsx`](../../apps/web/components/multiview/ImageTransformControls.tsx), [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts), [`apps/web/lib/studio-image-transform.ts`](../../apps/web/lib/studio-image-transform.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/studio-caster-color-controls.browser.cjs`](../../apps/web/tests/studio-caster-color-controls.browser.cjs).

### apps/web/components/StudioDeviceControlPanel.tsx

[`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx)

Выделенный блок источников и устройств Studio.

Экспортируемые символы: `StudioDeviceControlPanel`.

Читает/импортирует: [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/StudioEntry.module.css

[`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx), [`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx), [`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx), [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx).

### apps/web/components/StudioGuestDeviceControls.tsx

[`apps/web/components/StudioGuestDeviceControls.tsx`](../../apps/web/components/StudioGuestDeviceControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StudioGuestDeviceControls`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx), [`apps/web/tests/guest-device-controls-ui.cjs`](../../apps/web/tests/guest-device-controls-ui.cjs).

### apps/web/components/StudioGuestMediaControls.tsx

[`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestControlActivity`, `StudioGuestMediaControls`.

Читает/импортирует: [`apps/web/components/GuestCameraCaptureControls.tsx`](../../apps/web/components/GuestCameraCaptureControls.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioGuestDeviceControls.tsx`](../../apps/web/components/StudioGuestDeviceControls.tsx), [`apps/web/lib/connection-route.ts`](../../apps/web/lib/connection-route.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioGuestMediaPanel.tsx`](../../apps/web/components/StudioGuestMediaPanel.tsx), [`apps/web/tests/guest-media-controls-ui.cjs`](../../apps/web/tests/guest-media-controls-ui.cjs).

### apps/web/components/StudioGuestMediaPanel.tsx

[`apps/web/components/StudioGuestMediaPanel.tsx`](../../apps/web/components/StudioGuestMediaPanel.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StudioGuestMediaPanel`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/guest-media-controls-ui.cjs`](../../apps/web/tests/guest-media-controls-ui.cjs).

### apps/web/components/StudioGuestRoleControls.tsx

[`apps/web/components/StudioGuestRoleControls.tsx`](../../apps/web/components/StudioGuestRoleControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StudioGuestRoleControls`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/participant-role-client.ts`](../../apps/web/lib/participant-role-client.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/components/StudioOwnerGate.tsx

[`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx)

Приём scoped owner-link и проверка доступа к конкретной Studio.

Экспортируемые символы: `StudioOwnerGate`.

Читает/импортирует: [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `next/navigation`, `react`.

Используют: [`apps/web/components/StudioPageClient.tsx`](../../apps/web/components/StudioPageClient.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/StudioPageClient.tsx

[`apps/web/components/StudioPageClient.tsx`](../../apps/web/components/StudioPageClient.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts).

Библиотеки/Node: `next/navigation`, `react`.

Используют: [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx).

### apps/web/components/StudioReturnPublishingControls.tsx

[`apps/web/components/StudioReturnPublishingControls.tsx`](../../apps/web/components/StudioReturnPublishingControls.tsx)

Кнопки preview/ON AIR и состояния публикации возврата.

Экспортируемые символы: `StudioReturnPublishingControls`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx), [`apps/web/tests/studio-return-publishing-controls.cjs`](../../apps/web/tests/studio-return-publishing-controls.cjs).

### apps/web/components/StudioReturnStatsPanel.tsx

[`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx)

Качество, фактические параметры, график и ошибки Studio Return.

Экспортируемые символы: `StudioReturnStats`, `StudioReturnStatsPanel`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioVideoModeControls.tsx`](../../apps/web/components/StudioVideoModeControls.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx).

### apps/web/components/StudioRoomPicker.tsx

[`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx)

Выбор существующей комнаты для Studio.

Экспортируемые символы: `StudioRoomPicker`.

Читает/импортирует: [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/StudioEntry.module.css`](../../apps/web/components/StudioEntry.module.css), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts), [`apps/web/lib/saved-servers.ts`](../../apps/web/lib/saved-servers.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioPageClient.tsx`](../../apps/web/components/StudioPageClient.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/StudioStreamInviteButton.tsx

[`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx)

Отдельная ссылка просмотра Studio Return для /watch.

Экспортируемые символы: `StudioStreamInviteButton`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx).

### apps/web/components/StudioVideoModeControls.tsx

[`apps/web/components/StudioVideoModeControls.tsx`](../../apps/web/components/StudioVideoModeControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StudioVideoModeControls`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx).

### apps/web/components/StudioWorkspace.tsx

[`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx), [`apps/web/components/BrandIcon.tsx`](../../apps/web/components/BrandIcon.tsx), [`apps/web/components/CasterSlotsPanel.tsx`](../../apps/web/components/CasterSlotsPanel.tsx), [`apps/web/components/EmergencyReservePanel.tsx`](../../apps/web/components/EmergencyReservePanel.tsx), [`apps/web/components/GuestAudioMeter.tsx`](../../apps/web/components/GuestAudioMeter.tsx), [`apps/web/components/GuestCameraResolutionControl.tsx`](../../apps/web/components/GuestCameraResolutionControl.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/ModeratorStudioMonitoring.tsx`](../../apps/web/components/ModeratorStudioMonitoring.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/ParticipantSourceCard.tsx`](../../apps/web/components/ParticipantSourceCard.tsx), [`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/RoomCreationPasswordSettings.tsx`](../../apps/web/components/RoomCreationPasswordSettings.tsx), [`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx), [`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/components/ServerConnections.tsx`](../../apps/web/components/ServerConnections.tsx), [`apps/web/components/ServerTransferPanel.tsx`](../../apps/web/components/ServerTransferPanel.tsx), [`apps/web/components/SourceRoster.tsx`](../../apps/web/components/SourceRoster.tsx), [`apps/web/components/StaffChatPanel.tsx`](../../apps/web/components/StaffChatPanel.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx), [`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx), [`apps/web/components/StudioGuestMediaPanel.tsx`](../../apps/web/components/StudioGuestMediaPanel.tsx), [`apps/web/components/StudioGuestRoleControls.tsx`](../../apps/web/components/StudioGuestRoleControls.tsx), [`apps/web/components/StudioReturnPublishingControls.tsx`](../../apps/web/components/StudioReturnPublishingControls.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts), [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts), [`apps/web/lib/guest-camera-outbound.ts`](../../apps/web/lib/guest-camera-outbound.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/room-mode.ts`](../../apps/web/lib/room-mode.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/screen-share.ts`](../../apps/web/lib/screen-share.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-device-session.ts`](../../apps/web/lib/studio-device-session.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/studio-output-source.ts`](../../apps/web/lib/studio-output-source.ts), [`apps/web/lib/studio-playback-layout.ts`](../../apps/web/lib/studio-playback-layout.ts), [`apps/web/lib/studio-room-lifecycle.ts`](../../apps/web/lib/studio-room-lifecycle.ts), [`apps/web/lib/studio-sender-stats.ts`](../../apps/web/lib/studio-sender-stats.ts), [`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts), [`apps/web/lib/use-room-chat-bearer.ts`](../../apps/web/lib/use-room-chat-bearer.ts), [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts), [`apps/web/lib/use-staff-room-chat.ts`](../../apps/web/lib/use-staff-room-chat.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/StudioPageClient.tsx`](../../apps/web/components/StudioPageClient.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/TalkbackControls.tsx

[`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx)

Служебная речь выбранным адресатам, камера и screen-share персонала.

Экспортируемые символы: `TalkbackTargetButton`, `setPanelCamera`, `TalkbackControls`.

Читает/импортирует: [`apps/web/components/AudioOutputSelect.tsx`](../../apps/web/components/AudioOutputSelect.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts), [`apps/web/lib/private-talkback-audio.ts`](../../apps/web/lib/private-talkback-audio.ts), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/tests/private-talkback-controls.cjs`](../../apps/web/tests/private-talkback-controls.cjs).

### apps/web/components/ThemeToggle.tsx

[`apps/web/components/ThemeToggle.tsx`](../../apps/web/components/ThemeToggle.tsx)

Переключатель светлой/тёмной темы.

Экспортируемые символы: `ThemeToggle`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx).

### apps/web/components/multiview/ImageTransformControls.module.css

[`apps/web/components/multiview/ImageTransformControls.module.css`](../../apps/web/components/multiview/ImageTransformControls.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx), [`apps/web/components/multiview/ImageTransformControls.tsx`](../../apps/web/components/multiview/ImageTransformControls.tsx).

### apps/web/components/multiview/ImageTransformControls.tsx

[`apps/web/components/multiview/ImageTransformControls.tsx`](../../apps/web/components/multiview/ImageTransformControls.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/multiview/ImageTransformControls.module.css`](../../apps/web/components/multiview/ImageTransformControls.module.css), [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx), [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/tests/image-transform-compact.browser.cjs`](../../apps/web/tests/image-transform-compact.browser.cjs).

### apps/web/components/multiview/MultiviewAudio.tsx

[`apps/web/components/multiview/MultiviewAudio.tsx`](../../apps/web/components/multiview/MultiviewAudio.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `MultiviewAudio`.

Читает/импортирует: [`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/multiview/[sceneId]/page.tsx`](../../apps/web/app/multiview/%5BsceneId%5D/page.tsx).

### apps/web/components/multiview/MultiviewEditor.module.css

[`apps/web/components/multiview/MultiviewEditor.module.css`](../../apps/web/components/multiview/MultiviewEditor.module.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx).

### apps/web/components/multiview/MultiviewEditor.tsx

[`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/multiview/ImageTransformControls.tsx`](../../apps/web/components/multiview/ImageTransformControls.tsx), [`apps/web/components/multiview/MultiviewEditor.module.css`](../../apps/web/components/multiview/MultiviewEditor.module.css), [`apps/web/components/multiview/MultiviewMedia.tsx`](../../apps/web/components/multiview/MultiviewMedia.tsx), [`apps/web/lib/multiview-editor-grid.ts`](../../apps/web/lib/multiview-editor-grid.ts), [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts), [`apps/web/lib/multiview-portable.ts`](../../apps/web/lib/multiview-portable.ts), [`apps/web/lib/multiview-snap.ts`](../../apps/web/lib/multiview-snap.ts), [`apps/web/lib/multiview-sources.ts`](../../apps/web/lib/multiview-sources.ts), [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts), [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs).

### apps/web/components/multiview/MultiviewMedia.tsx

[`apps/web/components/multiview/MultiviewMedia.tsx`](../../apps/web/components/multiview/MultiviewMedia.tsx)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts), [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts), [`apps/web/lib/multiview-media.ts`](../../apps/web/lib/multiview-media.ts), [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/multiview/[sceneId]/page.tsx`](../../apps/web/app/multiview/%5BsceneId%5D/page.tsx), [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx).

### apps/web/components/native-pptx.css

[`apps/web/components/native-pptx.css`](../../apps/web/components/native-pptx.css)

Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.

Используют: [`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx).

### apps/web/components/room-entry-url.ts

[`apps/web/components/room-entry-url.ts`](../../apps/web/components/room-entry-url.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `roomEntryInviteUrl`.

Используют: [`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx), [`apps/web/tests/public-room-entry.cjs`](../../apps/web/tests/public-room-entry.cjs).

## apps/web/instrumentation.ts · 1 файлов

### apps/web/instrumentation.ts

[`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts)

Startup-валидация persistent storage и room backend.

Экспортируемые символы: `register`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/reserve-heartbeat-worker.ts`](../../apps/web/lib/reserve-heartbeat-worker.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Переменные окружения (только имена): `NEXT_RUNTIME`.

## apps/web/lib · 196 файлов

### apps/web/lib/access.ts

[`apps/web/lib/access.ts`](../../apps/web/lib/access.ts)

Подписи scoped-сессий, проверка паролей, cookie, шифрование паролей комнат и проверка origin; не новый platform login.

Экспортируемые символы: `roomVersion`, `hashPassword`, `encryptRoomPassword`, `decryptRoomPassword`, `checkPassword`, `signAccess`, `readAccess`, `accessStudioMatches`, `isStudio`, `canJoin`, `canView`, `validGuestInvite`, `clearGuestAccess`, `setAccessCookie`, `guestAccessExpiresAt`, `sameOrigin`, `guestEntryFromAccess`.

Читает/импортирует: [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/co-presentation-helper/route.ts`](../../apps/web/app/api/co-presentation-helper/route.ts), [`apps/web/app/api/co-presentations/route.ts`](../../apps/web/app/api/co-presentations/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/guest-command/route.ts`](../../apps/web/app/api/guest-command/route.ts), [`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts), [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/hosted-access/route.ts`](../../apps/web/app/api/hosted-access/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/servers/route.ts`](../../apps/web/app/api/servers/route.ts), [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts), [`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/guest-invite-key.ts`](../../apps/web/lib/guest-invite-key.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/optional/presentation-control-handler.ts`](../../apps/web/lib/optional/presentation-control-handler.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/access-secrets.cjs`](../../apps/web/tests/access-secrets.cjs), [`apps/web/tests/guest-entry-settings.cjs`](../../apps/web/tests/guest-entry-settings.cjs), [`apps/web/tests/guest-invite-key.cjs`](../../apps/web/tests/guest-invite-key.cjs), [`apps/web/tests/hosted-access.cjs`](../../apps/web/tests/hosted-access.cjs), [`apps/web/tests/media-room-api.cjs`](../../apps/web/tests/media-room-api.cjs), [`apps/web/tests/multiview-api.cjs`](../../apps/web/tests/multiview-api.cjs), [`apps/web/tests/multiview-delete-api.cjs`](../../apps/web/tests/multiview-delete-api.cjs), [`apps/web/tests/room-creation-access.cjs`](../../apps/web/tests/room-creation-access.cjs), [`apps/web/tests/room-creation-password-settings.cjs`](../../apps/web/tests/room-creation-password-settings.cjs), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs), [`apps/web/tests/server-provisioning-api.cjs`](../../apps/web/tests/server-provisioning-api.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs), [`apps/web/tests/stats-multi-client.cjs`](../../apps/web/tests/stats-multi-client.cjs), [`apps/web/tests/studio-access-isolation.cjs`](../../apps/web/tests/studio-access-isolation.cjs), [`apps/web/tests/studio-auth-isolation.cjs`](../../apps/web/tests/studio-auth-isolation.cjs), [`apps/web/tests/studio-viewer-access.cjs`](../../apps/web/tests/studio-viewer-access.cjs), [`apps/web/tests/transfer-node-admission.cjs`](../../apps/web/tests/transfer-node-admission.cjs), [`apps/web/tests/transfer-owner-session.cjs`](../../apps/web/tests/transfer-owner-session.cjs).

Переменные окружения (только имена): `CASTLINK_DATA_ENCRYPTION_KEY`, `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`, `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/lib/app-update.ts

[`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts)

Сравнение версии приложения и безопасное построение URL обновления вкладки.

Экспортируемые символы: `updateUrl`, `availableVersion`, `displayBuildId`.

Используют: [`apps/web/app/diagnostics/page.tsx`](../../apps/web/app/diagnostics/page.tsx), [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx), [`apps/web/components/ServerConnections.tsx`](../../apps/web/components/ServerConnections.tsx), [`apps/web/tests/app-update-notice.cjs`](../../apps/web/tests/app-update-notice.cjs), [`apps/web/tests/app-update.cjs`](../../apps/web/tests/app-update.cjs).

### apps/web/lib/audio-device-test.ts

[`apps/web/lib/audio-device-test.ts`](../../apps/web/lib/audio-device-test.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `startSpeakerTest`.

Используют: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/tests/audio-device-check.cjs`](../../apps/web/tests/audio-device-check.cjs).

### apps/web/lib/audio-diagnostics.ts

[`apps/web/lib/audio-diagnostics.ts`](../../apps/web/lib/audio-diagnostics.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `AudioCounters`, `audioReceiveDiagnostic`, `emptyAudioSummary`, `addAudioSummary`, `sanitizeAudioPlayback`, `sanitizeAudioReceive`.

Читает/импортирует: [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/tests/audio-diagnostics.cjs`](../../apps/web/tests/audio-diagnostics.cjs), [`apps/web/tests/rtc-telemetry-audio.cjs`](../../apps/web/tests/rtc-telemetry-audio.cjs).

### apps/web/lib/audio-meter.ts

[`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts)

Пиковый dBFS и плавность индикатора; чистая математика, не обработка звука.

Экспортируемые символы: `METER_FLOOR_DB`, `peakDbfs`, `meterRelease`, `observePcmTrack`.

Используют: [`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx), [`apps/web/components/GuestAudioMeter.tsx`](../../apps/web/components/GuestAudioMeter.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/audio-device-check.cjs`](../../apps/web/tests/audio-device-check.cjs), [`apps/web/tests/feedback-media.cjs`](../../apps/web/tests/feedback-media.cjs).

### apps/web/lib/audio-output.ts

[`apps/web/lib/audio-output.ts`](../../apps/web/lib/audio-output.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `applyAudioOutput`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/AudioOutputSelect.tsx`](../../apps/web/components/AudioOutputSelect.tsx), [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts), [`apps/web/tests/audio-output-switch.cjs`](../../apps/web/tests/audio-output-switch.cjs).

### apps/web/lib/caster-slot-access.ts

[`apps/web/lib/caster-slot-access.ts`](../../apps/web/lib/caster-slot-access.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `createSlotOutputAccess`, `verifySlotOutputAccess`, `personalCasterInviteKey`, `resolvePersonalCasterInvite`.

Читает/импортирует: [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/caster-slot-output/route.ts`](../../apps/web/app/api/caster-slot-output/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts).

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`.

### apps/web/lib/caster-slot-service.ts

[`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SlotMedia`, `assignCasterToSlot`, `releaseCasterSlot`, `confirmCasterSlot`, `admissionHasSlot`, `adoptConnectedCaster`.

Читает/импортирует: [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`.

Используют: [`apps/web/app/api/caster-slot-output/route.ts`](../../apps/web/app/api/caster-slot-output/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/caster-slot-store.ts

[`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SlotData`, `readCasterSlotData`, `readCasterSlot`, `readCasterSlots`, `readPersonalCasterInvite`, `listPersonalCasterInvites`, `transactCasterSlots`, `createPersonalCasterInvite`, `deletePersonalCasterInvite`, `createCasterSlot`, `mutateCasterSlot`, `updateCasterSlot`, `rotateCasterSlotOutput`, `rotateCasterSlotInvite`, `deleteCasterSlot`.

Читает/импортирует: [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts), [`apps/web/lib/server-feature-store.ts`](../../apps/web/lib/server-feature-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/caster-slot-output/route.ts`](../../apps/web/app/api/caster-slot-output/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/lib/caster-slot-access.ts`](../../apps/web/lib/caster-slot-access.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts).

### apps/web/lib/caster-slot-types.ts

[`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SlotScope`, `CasterSession`, `CasterSlot`, `PersonalCasterInvite`, `CasterSlotConflict`, `sameSlotScope`.

Используют: [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/components/CasterSlotsPanel.tsx`](../../apps/web/components/CasterSlotsPanel.tsx), [`apps/web/lib/caster-slot-access.ts`](../../apps/web/lib/caster-slot-access.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/slot-output-controller.ts`](../../apps/web/lib/slot-output-controller.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts).

### apps/web/lib/chat-emojis.ts

[`apps/web/lib/chat-emojis.ts`](../../apps/web/lib/chat-emojis.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `CHAT_EMOJIS`, `ChatEmoji`, `EmojiId`, `REACTION_IDS`, `ReactionId`, `emojiById`, `splitChatEmojis`, `insertChatEmoji`.

Используют: [`apps/web/components/ChatEmojis.tsx`](../../apps/web/components/ChatEmojis.tsx), [`apps/web/components/RoomReactions.tsx`](../../apps/web/components/RoomReactions.tsx), [`apps/web/lib/room-reactions.ts`](../../apps/web/lib/room-reactions.ts).

### apps/web/lib/client-reserve.ts

[`apps/web/lib/client-reserve.ts`](../../apps/web/lib/client-reserve.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PreparedReserve`, `ReserveView`, `readReserveResponse`, `ReserveClient`.

Читает/импортирует: [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/transfer-origin.ts`](../../apps/web/lib/transfer-origin.ts).

Используют: [`apps/web/components/EmergencyReservePanel.tsx`](../../apps/web/components/EmergencyReservePanel.tsx), [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts), [`apps/web/tests/client-reserve-automatic.cjs`](../../apps/web/tests/client-reserve-automatic.cjs), [`apps/web/tests/client-reserve-races.cjs`](../../apps/web/tests/client-reserve-races.cjs), [`apps/web/tests/client-reserve.cjs`](../../apps/web/tests/client-reserve.cjs).

### apps/web/lib/client-transfer.ts

[`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts)

Браузерный snapshot переноса, выбор целевого origin и сохранение/очистка данных перехода.

Экспортируемые символы: `TransferRole`, `TransferSnapshot`, `transferDestination`, `readTransferSnapshot`, `saveTransferSnapshot`, `clearTransferSnapshot`, `isTransferRole`, `restoreAcceptedTransfer`, `acceptedTransferPath`, `saveAcceptedTransfer`.

Читает/импортирует: [`apps/web/lib/transfer-origin.ts`](../../apps/web/lib/transfer-origin.ts).

Используют: [`apps/web/app/transfer/page.tsx`](../../apps/web/app/transfer/page.tsx), [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioPageClient.tsx`](../../apps/web/components/StudioPageClient.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/client-reserve.ts`](../../apps/web/lib/client-reserve.ts), [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts), [`apps/web/tests/client-transfer.cjs`](../../apps/web/tests/client-transfer.cjs), [`apps/web/tests/transfer-origins.cjs`](../../apps/web/tests/transfer-origins.cjs), [`apps/web/tests/viewer-transfer-page.cjs`](../../apps/web/tests/viewer-transfer-page.cjs).

### apps/web/lib/co-presentation-acceptance.ts

[`apps/web/lib/co-presentation-acceptance.ts`](../../apps/web/lib/co-presentation-acceptance.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PRESENTATION_AUTO_ACCEPT_KEY`, `presentationAutoAcceptPreference`, `presentationRecipientAccepted`, `presentationRecipientAcceptanceKey`.

Читает/импортирует: [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts), [`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts).

Используют: [`apps/web/components/CoPresentationNavigation.tsx`](../../apps/web/components/CoPresentationNavigation.tsx), [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx).

### apps/web/lib/co-presentation-access.ts

[`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PresentationGuest`, `presentationAssociation`, `livePresentationGuest`, `presentationGuest`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Используют: [`apps/web/app/api/co-presentation-helper/route.ts`](../../apps/web/app/api/co-presentation-helper/route.ts), [`apps/web/app/api/co-presentations/route.ts`](../../apps/web/app/api/co-presentations/route.ts), [`apps/web/app/api/presentation-file/route.ts`](../../apps/web/app/api/presentation-file/route.ts), [`apps/web/lib/co-presentation-helper.ts`](../../apps/web/lib/co-presentation-helper.ts).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/co-presentation-client.ts

[`apps/web/lib/co-presentation-client.ts`](../../apps/web/lib/co-presentation-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `coPresentationRequest`, `isCoPresentationTrack`, `createCanvasPresentationCapture`.

Читает/импортирует: [`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx).

### apps/web/lib/co-presentation-controls.ts

[`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SlideControlsState`, `SlideControlsAction`, `SlidesBridge`, `slidesBridge`, `slideControlsId`, `slideControlsText`, `validSlideControlsState`, `validSlideControlsAction`, `createCoPresentationControls`.

Читает/импортирует: [`apps/web/lib/co-presentation-navigation.ts`](../../apps/web/lib/co-presentation-navigation.ts), [`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts), [`apps/web/lib/co-presentation-toolbar.ts`](../../apps/web/lib/co-presentation-toolbar.ts), [`apps/web/lib/document-picture-in-picture.ts`](../../apps/web/lib/document-picture-in-picture.ts).

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/RecipientSlideControls.tsx`](../../apps/web/components/RecipientSlideControls.tsx), [`apps/web/lib/co-presentation-acceptance.ts`](../../apps/web/lib/co-presentation-acceptance.ts), [`apps/web/lib/co-presentation-toolbar.ts`](../../apps/web/lib/co-presentation-toolbar.ts), [`apps/web/tests/co-presentation-size.browser.cjs`](../../apps/web/tests/co-presentation-size.browser.cjs).

### apps/web/lib/co-presentation-helper-client.ts

[`apps/web/lib/co-presentation-helper-client.ts`](../../apps/web/lib/co-presentation-helper-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PRESENTER_INSTALLER_URL`, `presentationHelperLaunchUrl`, `launchPresentationHelper`, `HelperPowerPointBridge`, `createHelperPowerPointBridge`.

Читает/импортирует: [`apps/web/lib/co-presentation-native.ts`](../../apps/web/lib/co-presentation-native.ts).

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx).

### apps/web/lib/co-presentation-helper.ts

[`apps/web/lib/co-presentation-helper.ts`](../../apps/web/lib/co-presentation-helper.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `createHelperBroker`.

Читает/импортирует: [`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/co-presentation-helper/route.ts`](../../apps/web/app/api/co-presentation-helper/route.ts).

### apps/web/lib/co-presentation-native.ts

[`apps/web/lib/co-presentation-native.ts`](../../apps/web/lib/co-presentation-native.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `NativePresentation`, `NativeWindowPresentation`, `NativeControlledPresentation`, `NativePresentationStatus`, `PreparedWindowPresentation`, `PreparedPresentation`, `isNativeWindowPresentation`, `validNativeControlledPresentation`, `PreparedPptx`, `PowerPointBridge`, `powerPointBridge`, `validNativePresentation`, `createNativePresentationControl`.

Читает/импортирует: [`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts).

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/lib/co-presentation-helper-client.ts`](../../apps/web/lib/co-presentation-helper-client.ts).

### apps/web/lib/co-presentation-navigation.ts

[`apps/web/lib/co-presentation-navigation.ts`](../../apps/web/lib/co-presentation-navigation.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `presentationStepMode`, `presentationNavigationPending`, `presentationPageLabel`, `presentationDirectionAllowed`, `presentationScreenGrant`, `presentationImageContains`, `presentationInputDirection`, `presentationInteractiveSelector`, `createPresentationNavigationFocus`.

Читает/импортирует: [`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts).

Используют: [`apps/web/components/CoPresentationNavigation.tsx`](../../apps/web/components/CoPresentationNavigation.tsx), [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/RecipientSlideControls.tsx`](../../apps/web/components/RecipientSlideControls.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts), [`apps/web/lib/co-presentation-toolbar.ts`](../../apps/web/lib/co-presentation-toolbar.ts).

### apps/web/lib/co-presentation-state.ts

[`apps/web/lib/co-presentation-state.ts`](../../apps/web/lib/co-presentation-state.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `CoPresenter`, `CoPresentation`, `PowerPointStepCommand`, `expirePowerPointStep`, `acknowledgePowerPointStep`, `samePresenter`, `coPresentations`, `createCoPresentation`, `createCoWindowPresentation`, `acknowledgeWindowStep`, `dropCoPresentation`, `currentCoPresentation`, `navigateCoPresentation`, `acknowledgeCoPresentation`, `syncCoPresentation`.

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/co-presentations/route.ts`](../../apps/web/app/api/co-presentations/route.ts), [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/RecipientSlideControls.tsx`](../../apps/web/components/RecipientSlideControls.tsx), [`apps/web/lib/co-presentation-acceptance.ts`](../../apps/web/lib/co-presentation-acceptance.ts), [`apps/web/lib/co-presentation-client.ts`](../../apps/web/lib/co-presentation-client.ts), [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts), [`apps/web/lib/co-presentation-native.ts`](../../apps/web/lib/co-presentation-native.ts), [`apps/web/lib/co-presentation-navigation.ts`](../../apps/web/lib/co-presentation-navigation.ts).

### apps/web/lib/co-presentation-toolbar.ts

[`apps/web/lib/co-presentation-toolbar.ts`](../../apps/web/lib/co-presentation-toolbar.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `createSlideToolbar`.

Читает/импортирует: [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts), [`apps/web/lib/co-presentation-navigation.ts`](../../apps/web/lib/co-presentation-navigation.ts).

Используют: [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts).

### apps/web/lib/conference-gallery-layout.ts

[`apps/web/lib/conference-gallery-layout.ts`](../../apps/web/lib/conference-gallery-layout.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `conferenceGalleryLayout`.

Используют: [`apps/web/lib/conference-scene.ts`](../../apps/web/lib/conference-scene.ts).

### apps/web/lib/conference-scene.ts

[`apps/web/lib/conference-scene.ts`](../../apps/web/lib/conference-scene.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SceneSource`, `SpeakerState`, `SPEAKER_HOLD_MS`, `advanceSpeaker`, `primarySceneSource`, `sceneSplit`, `sceneGallery`, `sceneRail`.

Читает/импортирует: [`apps/web/lib/conference-gallery-layout.ts`](../../apps/web/lib/conference-gallery-layout.ts).

Используют: [`apps/web/components/ConferenceScene.tsx`](../../apps/web/components/ConferenceScene.tsx).

### apps/web/lib/connection-route-config.ts

[`apps/web/lib/connection-route-config.ts`](../../apps/web/lib/connection-route-config.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `guestConnectionRoutes`.

Читает/импортирует: [`apps/web/lib/connection-route.ts`](../../apps/web/lib/connection-route.ts).

Используют: [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/tests/connection-route.cjs`](../../apps/web/tests/connection-route.cjs).

### apps/web/lib/connection-route.ts

[`apps/web/lib/connection-route.ts`](../../apps/web/lib/connection-route.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestConnectionRoute`, `GuestRelayConfiguration`, `GuestConnectionRoutes`, `GuestRelayUnavailableError`, `connectGuestRoom`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx), [`apps/web/lib/connection-route-config.ts`](../../apps/web/lib/connection-route-config.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/tests/connection-route.cjs`](../../apps/web/tests/connection-route.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/lib/control-plane-client.ts

[`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts)

Подписанные запросы удалённой ноды к центральному управлению Studio/assignment/access version.

Экспортируемые символы: `currentStudioOwnerAccessVersion`, `currentStudioRoute`, `commitStudioTransfer`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/tests/control-plane-client-remote.cjs`](../../apps/web/tests/control-plane-client-remote.cjs), [`apps/web/tests/transfer-owner-session.cjs`](../../apps/web/tests/transfer-owner-session.cjs).

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_TIMEOUT_MS`, `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `NODE_ENV`.

### apps/web/lib/control-plane-store.ts

[`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts)

PostgreSQL-операции центрального реестра: студии, ноды, scheduler, heartbeat, версии отзыва доступа.

Экспортируемые символы: `controlPlanePool`, `defaultOrganizationId`, `listControlNodes`, `NodeOperationalState`, `setNodeOperationalState`, `listStudios`, `listAllStudios`, `listControlRooms`, `createStudio`, `assignStudioAuto`, `pinStudio`, `closeControlPlanePool`, `resolveStudioRoute`, `transferStudioAssignment`, `applyNodeHeartbeat`, `studioOwnerAccessVersion`, `rotateStudioOwnerAccessVersion`, `superAdminAccessVersion`, `rotateSuperAdminAccessVersion`.

Читает/импортирует: [`apps/web/lib/node-heartbeat.ts`](../../apps/web/lib/node-heartbeat.ts), [`apps/web/lib/node-scheduler.ts`](../../apps/web/lib/node-scheduler.ts).

Библиотеки/Node: `node:crypto`, `pg`.

Используют: [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts), [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/node-admission-store.ts`](../../apps/web/lib/node-admission-store.ts), [`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts), [`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts), [`apps/web/tests/control-plane-store.cjs`](../../apps/web/tests/control-plane-store.cjs), [`apps/web/tests/node-operations-postgres.cjs`](../../apps/web/tests/node-operations-postgres.cjs), [`apps/web/tests/platform-access-postgres.cjs`](../../apps/web/tests/platform-access-postgres.cjs), [`apps/web/tests/studio-owner-access-postgres.cjs`](../../apps/web/tests/studio-owner-access-postgres.cjs).

Переменные окружения (только имена): `CASTLINK_CONTROL_DB_POOL_MAX`, `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_IDLE_TIMEOUT_MS`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `CASTLINK_DEFAULT_ORGANIZATION_ID`, `DATABASE_URL`, `NODE_ENV`.

### apps/web/lib/control-response.ts

[`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts)

Единый разбор HTTP-ответа управления: JSON, пустые и ошибочные ответы.

Экспортируемые символы: `readControlResponse`.

Используют: [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/ModeratorRoomTools.tsx`](../../apps/web/components/ModeratorRoomTools.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/control-response.cjs`](../../apps/web/tests/control-response.cjs).

### apps/web/lib/deployment-model.ts

[`apps/web/lib/deployment-model.ts`](../../apps/web/lib/deployment-model.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `DeploymentModel`, `deploymentModel`.

Используют: [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts), [`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx).

Переменные окружения (только имена): `CASTLINK_DEPLOYMENT_MODEL`.

### apps/web/lib/design-preview.ts

[`apps/web/lib/design-preview.ts`](../../apps/web/lib/design-preview.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `DESIGN_PREVIEW_STORAGE_KEY`, `designPreviewExcluded`, `saveDesignPreview`, `initialDesignPreview`.

Используют: [`apps/web/components/DesignPreview.tsx`](../../apps/web/components/DesignPreview.tsx).

### apps/web/lib/desktop-stop-panel.ts

[`apps/web/lib/desktop-stop-panel.ts`](../../apps/web/lib/desktop-stop-panel.ts)

Optional Electron STOP bridge: version detection, capture generation, single-flight stop, retries and cleanup. Ordinary browsers keep the Document PiP controller.

Экспортируемые символы: `DesktopScreenBridge`, `desktopScreenBridge`, `createDesktopStopPanel`.

Читает/импортирует: [`apps/web/lib/screen-share-stop-panel.ts`](../../apps/web/lib/screen-share-stop-panel.ts).

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx).

### apps/web/lib/diagnostic-room-revision.ts

[`apps/web/lib/diagnostic-room-revision.ts`](../../apps/web/lib/diagnostic-room-revision.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `applyDiagnosticRoomMutation`.

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `node:util`.

Используют: [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

### apps/web/lib/document-picture-in-picture.ts

[`apps/web/lib/document-picture-in-picture.ts`](../../apps/web/lib/document-picture-in-picture.ts)

Общий browser PiP: независимые области слайдов/STOP, gesture и безопасная очистка.

Экспортируемые символы: `DocumentPictureInPictureApi`, `documentPictureInPictureApi`, `createDocumentPictureInPictureSlot`.

Используют: [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts), [`apps/web/lib/screen-share-stop-panel.ts`](../../apps/web/lib/screen-share-stop-panel.ts).

### apps/web/lib/entitlement.ts

[`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts)

Проверка, разрешена ли операция при выбранном режиме enforcement/лицензирования.

Экспортируемые символы: `EntitlementDecision`, `entitlement`, `requireEntitlement`.

Читает/импортирует: [`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts), [`apps/web/lib/license.ts`](../../apps/web/lib/license.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts).

Используют: [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts).

Переменные окружения (только имена): `CASTLINK_SERVER_ID`, `CASTLINK_SERVER_LEASE`.

### apps/web/lib/entry-links.ts

[`apps/web/lib/entry-links.ts`](../../apps/web/lib/entry-links.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestInviteLink`, `parseGuestInviteUrl`, `nativeInviteUrl`, `isCastLinkDesktop`, `openNativeInvite`.

Используют: [`apps/web/app/join/page.tsx`](../../apps/web/app/join/page.tsx), [`apps/web/app/room/page.tsx`](../../apps/web/app/room/page.tsx), [`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/tests/guest-entry.cjs`](../../apps/web/tests/guest-entry.cjs).

### apps/web/lib/floating-panel-position.ts

[`apps/web/lib/floating-panel-position.ts`](../../apps/web/lib/floating-panel-position.ts)

Перемещение за заголовок: pointer/keyboard, bounds и resize cleanup.

Экспортируемые символы: `createFloatingPanelDrag`.

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/RecipientSlideControls.tsx`](../../apps/web/components/RecipientSlideControls.tsx).

### apps/web/lib/fullscreen-chrome.ts

[`apps/web/lib/fullscreen-chrome.ts`](../../apps/web/lib/fullscreen-chrome.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `watchFullscreenChrome`.

Читает/импортирует: [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts).

Используют: [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx).

### apps/web/lib/fullscreen.ts

[`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts)

Нативный fullscreen и CSS fallback, в том числе для ограничений мобильного браузера.

Экспортируемые символы: `isElementFullscreen`, `exitCssFullscreen`, `toggleElementFullscreen`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/ParticipantSourceCard.tsx`](../../apps/web/components/ParticipantSourceCard.tsx), [`apps/web/components/PdfPresentationViewer.tsx`](../../apps/web/components/PdfPresentationViewer.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/fullscreen-chrome.ts`](../../apps/web/lib/fullscreen-chrome.ts), [`apps/web/tests/fullscreen.cjs`](../../apps/web/tests/fullscreen.cjs).

### apps/web/lib/guest-admission-client.ts

[`apps/web/lib/guest-admission-client.ts`](../../apps/web/lib/guest-admission-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `guestAdmissionKey`, `readAdmission`, `waitForGuestAdmission`.

### apps/web/lib/guest-admission-store.ts

[`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `AdmissionSession`, `readGuestAdmission`, `listGuestAdmissions`, `managedGuestIdentity`, `verifyGuestAdmissionCapability`, `startGuestAdmission`, `touchGuestAdmission`, `changeGuestAdmission`, `admissionInviteCurrent`, `closeGuestAdmissionIdentity`, `admissionForPublication`, `adoptGuestAdmission`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts), [`apps/web/lib/server-feature-store.ts`](../../apps/web/lib/server-feature-store.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/caster-slot-output/route.ts`](../../apps/web/app/api/caster-slot-output/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts).

### apps/web/lib/guest-admission.ts

[`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SlotActor`, `resolveSlotActor`, `requireSlotActor`, `verifiedGuestAdmission`.

Читает/импортирует: [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts).

### apps/web/lib/guest-audio-gain.ts

[`apps/web/lib/guest-audio-gain.ts`](../../apps/web/lib/guest-audio-gain.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestMicrophoneGain`, `setGuestMicrophoneGain`, `watchGuestMicrophoneGain`.

Читает/импортирует: [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/guest-audio-gain.cjs`](../../apps/web/tests/guest-audio-gain.cjs).

### apps/web/lib/guest-audio-permissions.ts

[`apps/web/lib/guest-audio-permissions.ts`](../../apps/web/lib/guest-audio-permissions.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `watchGuestAudioPermissions`.

Читает/импортирует: [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/guest-entry-settings.cjs`](../../apps/web/tests/guest-entry-settings.cjs).

### apps/web/lib/guest-audio.ts

[`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestAudioProfile`, `guestAudioProfile`, `guestAudioProcessingOptions`, `GuestNoiseSuppressionState`, `guestNoiseSuppressionState`, `guestAudioCaptureOptions`, `guestAudioPublishOptions`, `enqueueGuestMicrophoneTask`, `switchGuestMicrophoneProfile`, `setGuestMicrophoneEnabled`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestAudioProfileSelector.tsx`](../../apps/web/components/GuestAudioProfileSelector.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestMicrophoneButton.tsx`](../../apps/web/components/GuestMicrophoneButton.tsx), [`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/lib/guest-audio-gain.ts`](../../apps/web/lib/guest-audio-gain.ts), [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/tests/guest-audio-profile-ui.cjs`](../../apps/web/tests/guest-audio-profile-ui.cjs), [`apps/web/tests/guest-audio.cjs`](../../apps/web/tests/guest-audio.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/lib/guest-camera-outbound.ts

[`apps/web/lib/guest-camera-outbound.ts`](../../apps/web/lib/guest-camera-outbound.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestCameraOutbound`, `ReceivedGuestCameraOutbound`, `guestCameraOutboundRecipients`, `parseGuestCameraOutbound`, `freshGuestCameraOutboundBitrate`, `watchGuestCameraOutbound`, `GUEST_CAMERA_OUTBOUND_TOPIC`.

Читает/импортирует: [`apps/web/lib/studio-sender-stats.ts`](../../apps/web/lib/studio-sender-stats.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/guest-camera-outbound.cjs`](../../apps/web/tests/guest-camera-outbound.cjs).

### apps/web/lib/guest-capture-settings.ts

[`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `CAMERA_RESOLUTIONS`, `CAMERA_FRAME_RATES`, `GuestCameraCapture`, `ActualCameraCapture`, `parseGuestCameraCapture`, `parseActualCameraCapture`, `staffGuestCameraCapture`, `guestCameraConstraints`, `applyGuestCaptureConstraints`.

Используют: [`apps/web/components/GuestCameraCaptureControls.tsx`](../../apps/web/components/GuestCameraCaptureControls.tsx), [`apps/web/components/GuestCameraResolutionControl.tsx`](../../apps/web/components/GuestCameraResolutionControl.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/tests/guest-camera-capture.cjs`](../../apps/web/tests/guest-camera-capture.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/lib/guest-device-control-client.ts

[`apps/web/lib/guest-device-control-client.ts`](../../apps/web/lib/guest-device-control-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `watchGuestDeviceRequests`.

Читает/импортирует: [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestDeviceRequests.tsx`](../../apps/web/components/GuestDeviceRequests.tsx), [`apps/web/tests/guest-device-control-client.cjs`](../../apps/web/tests/guest-device-control-client.cjs).

### apps/web/lib/guest-device-control-state.ts

[`apps/web/lib/guest-device-control-state.ts`](../../apps/web/lib/guest-device-control-state.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestDeviceEntry`, `guestDeviceEntry`.

Читает/импортирует: [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts).

Используют: [`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts).

### apps/web/lib/guest-device-control.ts

[`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GUEST_DEVICE_REQUEST_TOPIC`, `GUEST_DEVICE_REQUEST_TTL`, `GUEST_DEVICE_STATE_TTL`, `GuestDeviceKind`, `GuestDevice`, `GuestDeviceState`, `GuestDeviceRequest`, `GuestDeviceOutcome`, `GuestDeviceResult`, `parseGuestDevice`, `parseGuestDeviceState`, `parseGuestDeviceRequest`.

Используют: [`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts), [`apps/web/components/GuestDeviceRequestDialog.tsx`](../../apps/web/components/GuestDeviceRequestDialog.tsx), [`apps/web/components/GuestDeviceRequests.tsx`](../../apps/web/components/GuestDeviceRequests.tsx), [`apps/web/components/StudioGuestDeviceControls.tsx`](../../apps/web/components/StudioGuestDeviceControls.tsx), [`apps/web/lib/guest-device-control-client.ts`](../../apps/web/lib/guest-device-control-client.ts), [`apps/web/lib/guest-device-control-state.ts`](../../apps/web/lib/guest-device-control-state.ts), [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts), [`apps/web/tests/guest-device-control-api.cjs`](../../apps/web/tests/guest-device-control-api.cjs), [`apps/web/tests/guest-device-control-client.cjs`](../../apps/web/tests/guest-device-control-client.cjs).

### apps/web/lib/guest-device-switch.ts

[`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `guestOutputSupported`, `guestDeviceState`, `switchGuestMicrophoneDevice`, `switchGuestOutputDevice`, `switchGuestCameraDevice`.

Читает/импортирует: [`apps/web/lib/audio-output.ts`](../../apps/web/lib/audio-output.ts), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestDeviceRequests.tsx`](../../apps/web/components/GuestDeviceRequests.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/guest-device-switch.cjs`](../../apps/web/tests/guest-device-switch.cjs).

### apps/web/lib/guest-entry-settings.ts

[`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestEntrySettings`, `defaultGuestEntrySettings`, `guestEntrySettings`, `guestAudioSubscriptionPermissions`, `guestEntryDevices`.

Используют: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/app/join/page.tsx`](../../apps/web/app/join/page.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestEntrySettings.tsx`](../../apps/web/components/GuestEntrySettings.tsx), [`apps/web/components/GuestInviteLanding.tsx`](../../apps/web/components/GuestInviteLanding.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-audio-permissions.ts`](../../apps/web/lib/guest-audio-permissions.ts), [`apps/web/lib/guest-entry-store.ts`](../../apps/web/lib/guest-entry-store.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/guest-audio-profile-ui.cjs`](../../apps/web/tests/guest-audio-profile-ui.cjs), [`apps/web/tests/guest-entry-settings.cjs`](../../apps/web/tests/guest-entry-settings.cjs), [`apps/web/tests/guest-preflight-ui.cjs`](../../apps/web/tests/guest-preflight-ui.cjs), [`apps/web/tests/guest-settings-renewal.cjs`](../../apps/web/tests/guest-settings-renewal.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/lib/guest-entry-store.ts

[`apps/web/lib/guest-entry-store.ts`](../../apps/web/lib/guest-entry-store.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `readGuestEntrySettings`, `saveGuestEntrySettings`.

Читает/импортирует: [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Используют: [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/tests/guest-entry-store.cjs`](../../apps/web/tests/guest-entry-store.cjs).

### apps/web/lib/guest-invite-key.ts

[`apps/web/lib/guest-invite-key.ts`](../../apps/web/lib/guest-invite-key.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `createGuestInviteKey`, `resolveGuestInviteKey`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/tests/guest-invite-key.cjs`](../../apps/web/tests/guest-invite-key.cjs).

### apps/web/lib/guest-media-control-client.ts

[`apps/web/lib/guest-media-control-client.ts`](../../apps/web/lib/guest-media-control-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `watchGuestMediaSettings`.

Читает/импортирует: [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/lib/guest-media-control-state.ts

[`apps/web/lib/guest-media-control-state.ts`](../../apps/web/lib/guest-media-control-state.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestMediaControlEntry`, `guestMediaControlEntry`.

Читает/импортирует: [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts).

Используют: [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts).

### apps/web/lib/guest-media-control.ts

[`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GUEST_MEDIA_SETTINGS_TOPIC`, `GuestMediaSettingsPatch`, `GuestMediaSettingsState`, `GuestMediaSettingsCommand`, `parseGuestMediaSettingsPatch`, `parseGuestMediaSettingsState`, `parseGuestMediaSettingsCommand`.

Читает/импортирует: [`apps/web/lib/connection-route.ts`](../../apps/web/lib/connection-route.ts), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Используют: [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/components/GuestCameraCaptureControls.tsx`](../../apps/web/components/GuestCameraCaptureControls.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx), [`apps/web/lib/guest-media-control-client.ts`](../../apps/web/lib/guest-media-control-client.ts), [`apps/web/lib/guest-media-control-state.ts`](../../apps/web/lib/guest-media-control-state.ts), [`apps/web/lib/guest-session-settings.ts`](../../apps/web/lib/guest-session-settings.ts), [`apps/web/tests/guest-camera-capture.cjs`](../../apps/web/tests/guest-camera-capture.cjs), [`apps/web/tests/guest-media-control-api.cjs`](../../apps/web/tests/guest-media-control-api.cjs), [`apps/web/tests/guest-video-codec.cjs`](../../apps/web/tests/guest-video-codec.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs), [`apps/web/tests/video-quality-vp9.cjs`](../../apps/web/tests/video-quality-vp9.cjs).

### apps/web/lib/guest-media.ts

[`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts)

Типы гостевых устройств, constraints захвата и разрешённые получатели клиентских сведений.

Экспортируемые символы: `GuestChoices`, `GuestClientInfo`, `guestClientInfoRecipients`, `parseGuestClientInfo`, `outputQualityRecipients`, `guestCaptureConstraints`.

Читает/импортирует: [`apps/web/lib/connection-route.ts`](../../apps/web/lib/connection-route.ts), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Используют: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestCodecCameraButton.tsx`](../../apps/web/components/GuestCodecCameraButton.tsx), [`apps/web/components/GuestDeviceRequests.tsx`](../../apps/web/components/GuestDeviceRequests.tsx), [`apps/web/components/GuestMicrophoneButton.tsx`](../../apps/web/components/GuestMicrophoneButton.tsx), [`apps/web/components/GuestWaitingPanel.tsx`](../../apps/web/components/GuestWaitingPanel.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/tests/guest-audio-profile-ui.cjs`](../../apps/web/tests/guest-audio-profile-ui.cjs), [`apps/web/tests/guest-audio.cjs`](../../apps/web/tests/guest-audio.cjs), [`apps/web/tests/guest-camera-capture.cjs`](../../apps/web/tests/guest-camera-capture.cjs), [`apps/web/tests/guest-entry-settings.cjs`](../../apps/web/tests/guest-entry-settings.cjs), [`apps/web/tests/guest-media.cjs`](../../apps/web/tests/guest-media.cjs), [`apps/web/tests/guest-preflight-ui.cjs`](../../apps/web/tests/guest-preflight-ui.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/lib/guest-resume.ts

[`apps/web/lib/guest-resume.ts`](../../apps/web/lib/guest-resume.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `guestResumeKey`, `guestResumeStorage`, `acceptGuestInvite`, `requestGuestSession`, `claimGuestResumeIdentity`.

Используют: [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/guest-invite-entry.cjs`](../../apps/web/tests/guest-invite-entry.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/lib/guest-session-settings.ts

[`apps/web/lib/guest-session-settings.ts`](../../apps/web/lib/guest-session-settings.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GUEST_SESSION_SETTINGS_TTL`, `rememberGuestSessionSettings`, `markGuestSessionDisconnected`, `readGuestSessionSettings`.

Читает/импортирует: [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Используют: [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/tests/guest-settings-renewal.cjs`](../../apps/web/tests/guest-settings-renewal.cjs).

### apps/web/lib/guest-staff-transition.ts

[`apps/web/lib/guest-staff-transition.ts`](../../apps/web/lib/guest-staff-transition.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `GuestCaptureScope`, `createGuestCaptureScope`, `transitionGuestToStaff`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/guest-staff-transition.cjs`](../../apps/web/tests/guest-staff-transition.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs).

### apps/web/lib/guest-video-bitrate.ts

[`apps/web/lib/guest-video-bitrate.ts`](../../apps/web/lib/guest-video-bitrate.ts)

Применение encoder budget камеры на стороне гостя и восстановление после SDK/reconnect изменений.

Экспортируемые символы: `watchGuestVideoBitrate`.

Читает/импортирует: [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx).

### apps/web/lib/guest-video-codec.ts

[`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `enqueueGuestCameraTask`, `guestVideoCodec`, `supportedGuestVideoCodecs`, `guestCameraPublishOptions`, `applyGuestCameraHeightInTask`, `applyGuestCameraHeight`, `watchGuestCameraHeight`, `switchGuestCameraCodec`, `setGuestCameraEnabled`, `guestCameraCodecState`, `switchGuestCameraCapture`, `guestCameraCaptureState`.

Читает/импортирует: [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestCodecCameraButton.tsx`](../../apps/web/components/GuestCodecCameraButton.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts), [`apps/web/tests/guest-audio-profile-ui.cjs`](../../apps/web/tests/guest-audio-profile-ui.cjs), [`apps/web/tests/guest-camera-capture.cjs`](../../apps/web/tests/guest-camera-capture.cjs), [`apps/web/tests/guest-video-codec.cjs`](../../apps/web/tests/guest-video-codec.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs), [`apps/web/tests/video-quality-vp9.cjs`](../../apps/web/tests/video-quality-vp9.cjs).

### apps/web/lib/hosted-access.ts

[`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `hostedCookieName`, `HostedToken`, `hostedAccessEnabled`, `verifyHostedToken`, `signHostedSession`, `hostedSession`, `hasHostedAccess`.

Библиотеки/Node: `next/server`, `node:crypto`, `node:fs`.

Используют: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/hosted-access/route.ts`](../../apps/web/app/api/hosted-access/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/page.tsx`](../../apps/web/app/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/tests/hosted-staff-access.cjs`](../../apps/web/tests/hosted-staff-access.cjs).

Переменные окружения (только имена): `CASTLINK_HOSTED_ACCESS`, `CASTLINK_HOSTED_TOKEN_FILE`, `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`.

### apps/web/lib/i18n.ts

[`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `LOCALE_STORAGE_KEY`, `Locale`, `TranslationParams`, `Translator`, `messages`, `normalizeLocale`, `translate`.

Читает/импортирует: [`apps/web/lib/i18n/entry.ts`](../../apps/web/lib/i18n/entry.ts), [`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts), [`apps/web/lib/i18n/pages.ts`](../../apps/web/lib/i18n/pages.ts), [`apps/web/lib/i18n/slots.ts`](../../apps/web/lib/i18n/slots.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Используют: [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/LanguageSwitcher.tsx`](../../apps/web/components/LanguageSwitcher.tsx), [`apps/web/lib/i18n/entry-preflight.ts`](../../apps/web/lib/i18n/entry-preflight.ts), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts), [`apps/web/tests/studio-caster-color-controls.browser.cjs`](../../apps/web/tests/studio-caster-color-controls.browser.cjs).

### apps/web/lib/i18n/entry-preflight.ts

[`apps/web/lib/i18n/entry-preflight.ts`](../../apps/web/lib/i18n/entry-preflight.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `preflightMessage`.

Читает/импортирует: [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

Используют: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/tests/guest-preflight-ui.cjs`](../../apps/web/tests/guest-preflight-ui.cjs).

### apps/web/lib/i18n/entry.ts

[`apps/web/lib/i18n/entry.ts`](../../apps/web/lib/i18n/entry.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `entryMessages`.

Используют: [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

### apps/web/lib/i18n/management.ts

[`apps/web/lib/i18n/management.ts`](../../apps/web/lib/i18n/management.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `managementMessages`, `translateManagementMessage`.

Используют: [`apps/web/components/AccessGate.tsx`](../../apps/web/components/AccessGate.tsx), [`apps/web/components/AdminInviteButton.tsx`](../../apps/web/components/AdminInviteButton.tsx), [`apps/web/components/EmergencyReservePanel.tsx`](../../apps/web/components/EmergencyReservePanel.tsx), [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/ModeratorInviteButton.tsx`](../../apps/web/components/ModeratorInviteButton.tsx), [`apps/web/components/ModeratorRoomTools.tsx`](../../apps/web/components/ModeratorRoomTools.tsx), [`apps/web/components/ParticipantRenameButton.tsx`](../../apps/web/components/ParticipantRenameButton.tsx), [`apps/web/components/PlatformParticipantActions.tsx`](../../apps/web/components/PlatformParticipantActions.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/RoomCreationPasswordSettings.tsx`](../../apps/web/components/RoomCreationPasswordSettings.tsx), [`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx), [`apps/web/components/RotateVideoButton.tsx`](../../apps/web/components/RotateVideoButton.tsx), [`apps/web/components/ServerConnections.tsx`](../../apps/web/components/ServerConnections.tsx), [`apps/web/components/ServerTransferPanel.tsx`](../../apps/web/components/ServerTransferPanel.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

### apps/web/lib/i18n/pages.ts

[`apps/web/lib/i18n/pages.ts`](../../apps/web/lib/i18n/pages.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `pagesMessages`.

Используют: [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

### apps/web/lib/i18n/slots.ts

[`apps/web/lib/i18n/slots.ts`](../../apps/web/lib/i18n/slots.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `slotsMessages`.

Используют: [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

### apps/web/lib/i18n/workspaces.ts

[`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `workspacesMessages`, `translateWorkspaceMessage`.

Читает/импортирует: [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

Используют: [`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx), [`apps/web/components/AudioOutputSelect.tsx`](../../apps/web/components/AudioOutputSelect.tsx), [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestRoleOffer.tsx`](../../apps/web/components/GuestRoleOffer.tsx), [`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/components/PdfPresentationViewer.tsx`](../../apps/web/components/PdfPresentationViewer.tsx), [`apps/web/components/PresentationControls.tsx`](../../apps/web/components/PresentationControls.tsx), [`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx), [`apps/web/components/RoomChat.tsx`](../../apps/web/components/RoomChat.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/components/StudioGuestDeviceControls.tsx`](../../apps/web/components/StudioGuestDeviceControls.tsx), [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx), [`apps/web/components/StudioGuestRoleControls.tsx`](../../apps/web/components/StudioGuestRoleControls.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts), [`apps/web/tests/guest-av-layout.browser.cjs`](../../apps/web/tests/guest-av-layout.browser.cjs).

### apps/web/lib/license-activation.ts

[`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts)

Серверный обмен с внешним сервисом активации установки.

Экспортируемые символы: `activateInstallation`.

Читает/импортирует: [`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts), [`apps/web/lib/license.ts`](../../apps/web/lib/license.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts).

Используют: [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts).

Переменные окружения (только имена): `CASTLINK_LICENSE_SERVICE_URL`, `CASTLINK_LICENSE_TIMEOUT_MS`, `CASTLINK_SERVER_ID`, `NODE_ENV`.

### apps/web/lib/license-public-key.generated.ts

[`apps/web/lib/license-public-key.generated.ts`](../../apps/web/lib/license-public-key.generated.ts)

Публичный ключ проверки лицензии; публичный ключ не равен приватному секрету подписи.

Экспортируемые символы: `embeddedLicensePublicKeyPem`.

Используют: [`apps/web/lib/license.ts`](../../apps/web/lib/license.ts), [`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts).

### apps/web/lib/license-state.ts

[`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts)

Чтение/запись runtime-состояния лицензии в постоянный JSON-файл.

Экспортируемые символы: `readRuntimeLicenseState`, `writeRuntimeLicenseState`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Используют: [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/lib/server-registry-client.ts`](../../apps/web/lib/server-registry-client.ts).

### apps/web/lib/license.ts

[`apps/web/lib/license.ts`](../../apps/web/lib/license.ts)

Проверка подписи/срока license token и режима enforcement.

Экспортируемые символы: `LicensePayload`, `LicenseStatus`, `verifyLicenseToken`, `licenseEnforced`, `licenseToken`.

Читает/импортирует: [`apps/web/lib/license-public-key.generated.ts`](../../apps/web/lib/license-public-key.generated.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/tests/licensing.cjs`](../../apps/web/tests/licensing.cjs).

Переменные окружения (только имена): `CASTLINK_LICENSE_ENFORCE`, `CASTLINK_LICENSE_TOKEN`.

### apps/web/lib/live-telemetry-cache.ts

[`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts)

Ограниченный общий cache последних RTC samples для быстрого обзора нод.

Экспортируемые символы: `rememberLiveSample`, `latestLiveSamples`, `resetLiveTelemetryForTests`.

Читает/импортирует: [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/tests/live-telemetry-cache.cjs`](../../apps/web/tests/live-telemetry-cache.cjs).

### apps/web/lib/livekit-url.ts

[`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts)

Определение адреса LiveKit для браузерного соединения.

Экспортируемые символы: `getLiveKitUrl`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/multiview/[sceneId]/page.tsx`](../../apps/web/app/multiview/%5BsceneId%5D/page.tsx), [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx), [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts).

Переменные окружения (только имена): `NEXT_PUBLIC_LIVEKIT_URL`.

### apps/web/lib/media-room-association.ts

[`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `DiagnosticAssociation`, `DiagnosticRoomConflict`, `validateDiagnosticAssociation`, `diagnosticAssociation`, `deleteDiagnosticRoom`.

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `node:util`.

Используют: [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/tests/media-room-association.cjs`](../../apps/web/tests/media-room-association.cjs), [`apps/web/tests/media-room-revision-contract.cjs`](../../apps/web/tests/media-room-revision-contract.cjs), [`apps/web/tests/media-room-revision-postgres.cjs`](../../apps/web/tests/media-room-revision-postgres.cjs), [`apps/web/tests/media-studio-control.cjs`](../../apps/web/tests/media-studio-control.cjs).

### apps/web/lib/media-stats.ts

[`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts)

Чтение статистики отдельного Local/Remote track из WebRTC.

Экспортируемые символы: `readTrackStats`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/studio-sender-stats.ts`](../../apps/web/lib/studio-sender-stats.ts), [`apps/web/lib/studio-video-recovery.ts`](../../apps/web/lib/studio-video-recovery.ts), [`apps/web/tests/rtc-telemetry-audio.cjs`](../../apps/web/tests/rtc-telemetry-audio.cjs), [`apps/web/tests/studio-outbound-poll.cjs`](../../apps/web/tests/studio-outbound-poll.cjs).

### apps/web/lib/moderator-access.ts

[`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts)

Приглашения, версии и индивидуальные сессии модераторов; отзыв и scope проверки.

Экспортируемые символы: `moderatorLifetimeSeconds`, `newModeratorInvite`, `createModeratorInvite`, `revokeModeratorInvites`, `validModeratorInvite`, `createRoomModeratorInvite`, `validRoomModeratorInvite`, `acceptRoomModeratorInvite`, `isModerator`, `verifiedModeratorVersion`, `verifiedRoomModeratorSession`, `verifiedModeratorExpiresAt`, `revokeRoomModeratorSession`, `revokeRoomModeratorAccess`, `revokeRoomModeratorInvite`, `listRoomModeratorSessions`, `setModeratorCookie`, `setRoomModeratorCookie`, `clearModeratorCookie`, `moderatorTransferVersion`, `globalModeratorAccessVersion`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/hosted-staff-access.cjs`](../../apps/web/tests/hosted-staff-access.cjs), [`apps/web/tests/multiview-delete-api.cjs`](../../apps/web/tests/multiview-delete-api.cjs), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs), [`apps/web/tests/stats-multi-client.cjs`](../../apps/web/tests/stats-multi-client.cjs).

Переменные окружения (только имена): `STUDIOLINK_MODERATOR_ACCESS_FILE`.

### apps/web/lib/monitor-audio.ts

[`apps/web/lib/monitor-audio.ts`](../../apps/web/lib/monitor-audio.ts)

Применение личного mute/volume к принятым аудиотрекам и очистка обработчиков.

Экспортируемые символы: `bindMonitorAudio`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/lib/private-talkback-audio.ts`](../../apps/web/lib/private-talkback-audio.ts), [`apps/web/tests/monitor-audio.cjs`](../../apps/web/tests/monitor-audio.cjs).

### apps/web/lib/multiview-editor-grid.ts

[`apps/web/lib/multiview-editor-grid.ts`](../../apps/web/lib/multiview-editor-grid.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `editorGridSteps`, `EditorGridStep`, `EditorGridPreference`, `editorGridStorageKey`, `parseEditorGridPreference`, `editorGridPath`.

Используют: [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx).

### apps/web/lib/multiview-image.ts

[`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ImageTransform`, `validateImageTransform`, `imageTransformStyle`.

Используют: [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx), [`apps/web/components/multiview/ImageTransformControls.tsx`](../../apps/web/components/multiview/ImageTransformControls.tsx), [`apps/web/components/multiview/MultiviewMedia.tsx`](../../apps/web/components/multiview/MultiviewMedia.tsx), [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts), [`apps/web/lib/studio-image-transform.ts`](../../apps/web/lib/studio-image-transform.ts), [`apps/web/tests/multiview-extensions.cjs`](../../apps/web/tests/multiview-extensions.cjs), [`apps/web/tests/studio-caster-image-api.cjs`](../../apps/web/tests/studio-caster-image-api.cjs), [`apps/web/tests/studio-image-transform.cjs`](../../apps/web/tests/studio-image-transform.cjs).

### apps/web/lib/multiview-layout.ts

[`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `MultiviewDraft`, `MIN_TILE_SIZE`, `MAX_TILE_SIZE`, `MIN_TILE_POSITION`, `MAX_TILE_POSITION`, `MULTIVIEW_SCENE_FORMATS`, `clampTile`, `ResizeEdge`, `resizeTile`, `gridScene`, `swapTilePositions`, `assignTileSource`, `createDraft`, `updateDraft`, `undoDraft`, `redoDraft`, `moveSourceToSlot`, `duplicateScene`, `tileAspectRatio`, `tileAspectFrame`, `fitTileToSource`, `resizeSourceTile`, `tileSceneClip`.

Читает/импортирует: [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts).

Используют: [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/components/multiview/MultiviewMedia.tsx`](../../apps/web/components/multiview/MultiviewMedia.tsx), [`apps/web/lib/multiview-snap.ts`](../../apps/web/lib/multiview-snap.ts), [`apps/web/tests/multiview-extensions.cjs`](../../apps/web/tests/multiview-extensions.cjs), [`apps/web/tests/multiview-formats.cjs`](../../apps/web/tests/multiview-formats.cjs), [`apps/web/tests/multiview-layout.cjs`](../../apps/web/tests/multiview-layout.cjs), [`apps/web/tests/multiview-scene-clip.cjs`](../../apps/web/tests/multiview-scene-clip.cjs), [`apps/web/tests/multiview-source-aspect.cjs`](../../apps/web/tests/multiview-source-aspect.cjs).

### apps/web/lib/multiview-media.ts

[`apps/web/lib/multiview-media.ts`](../../apps/web/lib/multiview-media.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `bindMultiviewVideo`, `uniqueMultiviewAudio`.

Читает/импортирует: [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts).

Используют: [`apps/web/app/multiview/[sceneId]/page.tsx`](../../apps/web/app/multiview/%5BsceneId%5D/page.tsx), [`apps/web/components/multiview/MultiviewMedia.tsx`](../../apps/web/components/multiview/MultiviewMedia.tsx).

### apps/web/lib/multiview-portable.ts

[`apps/web/lib/multiview-portable.ts`](../../apps/web/lib/multiview-portable.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `MAX_PORTABLE_SCENE_BYTES`, `exportMultiviewScene`, `importMultiviewScene`.

Читает/импортирует: [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts).

Используют: [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/tests/multiview-formats.cjs`](../../apps/web/tests/multiview-formats.cjs), [`apps/web/tests/multiview-portable.cjs`](../../apps/web/tests/multiview-portable.cjs).

### apps/web/lib/multiview-snap.ts

[`apps/web/lib/multiview-snap.ts`](../../apps/web/lib/multiview-snap.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SnapGuide`, `SnapOptions`, `snapTile`.

Читает/импортирует: [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts), [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts).

Используют: [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/tests/multiview-snap.cjs`](../../apps/web/tests/multiview-snap.cjs).

### apps/web/lib/multiview-sources.ts

[`apps/web/lib/multiview-sources.ts`](../../apps/web/lib/multiview-sources.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `RememberedSource`, `SOURCE_RETENTION_MS`, `refreshSourceCatalog`.

Используют: [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/tests/multiview-sources.cjs`](../../apps/web/tests/multiview-sources.cjs).

### apps/web/lib/multiview-store.ts

[`apps/web/lib/multiview-store.ts`](../../apps/web/lib/multiview-store.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `readMultiviewScenes`, `applyMultiviewScene`, `deleteMultiviewScene`.

Читает/импортирует: [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:crypto`, `node:util`.

Используют: [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/tests/multiview-api.cjs`](../../apps/web/tests/multiview-api.cjs), [`apps/web/tests/multiview-delete-api.cjs`](../../apps/web/tests/multiview-delete-api.cjs).

### apps/web/lib/multiview.ts

[`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `MultiviewAbsence`, `MultiviewTile`, `MultiviewScene`, `MultiviewError`, `validMultiviewId`, `validateMultiviewScene`.

Читает/импортирует: [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts).

Используют: [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/app/multiview/[sceneId]/page.tsx`](../../apps/web/app/multiview/%5BsceneId%5D/page.tsx), [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/components/multiview/MultiviewMedia.tsx`](../../apps/web/components/multiview/MultiviewMedia.tsx), [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts), [`apps/web/lib/multiview-media.ts`](../../apps/web/lib/multiview-media.ts), [`apps/web/lib/multiview-portable.ts`](../../apps/web/lib/multiview-portable.ts), [`apps/web/lib/multiview-snap.ts`](../../apps/web/lib/multiview-snap.ts), [`apps/web/lib/multiview-store.ts`](../../apps/web/lib/multiview-store.ts), [`apps/web/tests/multiview-extensions.cjs`](../../apps/web/tests/multiview-extensions.cjs), [`apps/web/tests/multiview-formats.cjs`](../../apps/web/tests/multiview-formats.cjs), [`apps/web/tests/multiview-geometry.cjs`](../../apps/web/tests/multiview-geometry.cjs).

### apps/web/lib/node-admission-store.ts

[`apps/web/lib/node-admission-store.ts`](../../apps/web/lib/node-admission-store.ts)

PostgreSQL desired state ноды, подтверждение ревизии и временный запрет повторного входа identity.

Экспортируемые символы: `Admission`, `readNodeAdmission`, `blockNodeParticipant`, `acknowledgeNodeOperation`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts).

Используют: [`apps/web/app/v1/control/node-admission/route.ts`](../../apps/web/app/v1/control/node-admission/route.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts).

### apps/web/lib/node-admission.ts

[`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts)

Node-side обращение к локальной БД или подписанному HTTPS control plane перед новым медиаподключением.

Экспортируемые символы: `admissionConfigured`, `localNodeAdmission`, `rememberLocalKick`, `acknowledgeLocalOperation`.

Читает/импортирует: [`apps/web/lib/node-admission-store.ts`](../../apps/web/lib/node-admission-store.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Используют: [`apps/web/app/api/media-admission/route.ts`](../../apps/web/app/api/media-admission/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts).

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_ENFORCE_NODE_ADMISSION`, `CASTLINK_NODE_SECRET`.

### apps/web/lib/node-control-auth.ts

[`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts)

HMAC подпись межсерверных control-запросов с method/path/body и проверкой свежести.

Экспортируемые символы: `signNodeControlRequest`, `verifyNodeControlRequest`.

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts), [`apps/web/tests/control-plane-client-remote.cjs`](../../apps/web/tests/control-plane-client-remote.cjs), [`apps/web/tests/node-control-plane-api.cjs`](../../apps/web/tests/node-control-plane-api.cjs).

### apps/web/lib/node-heartbeat-auth.ts

[`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts)

Поиск настроенного секрета конкретной ноды для проверки её подписи.

Экспортируемые символы: `heartbeatSecretForNode`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts), [`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts), [`apps/web/tests/node-heartbeat.cjs`](../../apps/web/tests/node-heartbeat.cjs).

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `CASTLINK_NODE_SECRETS_JSON`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/lib/node-heartbeat.ts

[`apps/web/lib/node-heartbeat.ts`](../../apps/web/lib/node-heartbeat.ts)

Канонический heartbeat payload, подпись, проверка формы и времени.

Экспортируемые символы: `NodeHeartbeat`, `canonicalHeartbeatBody`, `signHeartbeat`, `verifyHeartbeatSignature`, `validateHeartbeat`.

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/tests/node-heartbeat.cjs`](../../apps/web/tests/node-heartbeat.cjs).

### apps/web/lib/node-history.ts

[`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts)

Валидация запроса истории комнаты и чтение существующего хранилища телеметрии.

Экспортируемые символы: `localNodeHistory`.

Читает/импортирует: [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/v1/node/history/route.ts`](../../apps/web/app/v1/node/history/route.ts), [`apps/web/tests/audio-diagnostics.cjs`](../../apps/web/tests/audio-diagnostics.cjs).

### apps/web/lib/node-operations.ts

[`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts)

Применение ревизии состояния ноды, удаление LiveKit rooms при Force Offline и SID-bound kick/rename.

Экспортируемые символы: `NodeOperation`, `validNodeOperation`, `executeLocalNodeOperation`.

Читает/импортирует: [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Библиотеки/Node: `livekit-server-sdk`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/node/operations/route.ts`](../../apps/web/app/v1/node/operations/route.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/node-request.ts

[`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts)

Общие body-bound HMAC запросы к зарегистрированным нодам без передачи полномочий браузеру.

Экспортируемые символы: `ownNodeId`, `verifiedNodeRequest`, `signedNodeFetch`.

Читает/импортирует: [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts), [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts).

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/v1/control/node-admission/route.ts`](../../apps/web/app/v1/control/node-admission/route.ts), [`apps/web/app/v1/node/history/route.ts`](../../apps/web/app/v1/node/history/route.ts), [`apps/web/app/v1/node/operations/route.ts`](../../apps/web/app/v1/node/operations/route.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts).

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `NODE_ENV`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/lib/node-scheduler.ts

[`apps/web/lib/node-scheduler.ts`](../../apps/web/lib/node-scheduler.ts)

Детерминированный выбор подходящей ноды по режиму, health и capacity.

Экспортируемые символы: `NodeCapacity`, `StudioPlacementRequest`, `PlacementResult`, `nodeEligible`, `nodeScore`, `selectNode`.

Используют: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/tests/node-scheduler.cjs`](../../apps/web/tests/node-scheduler.cjs).

### apps/web/lib/node-state-transition.ts

[`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts)

Сериализация операций ноды через отдельный PostgreSQL advisory lock и различение desired/applied.

Экспортируемые символы: `changeNodeState`, `reconcileNodeState`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts).

Библиотеки/Node: `pg`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/control/node-admission/route.ts`](../../apps/web/app/v1/control/node-admission/route.ts).

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `DATABASE_URL`.

### apps/web/lib/node-topology.ts

[`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts)

Сбор configured и live комнат ноды, публикаций, свежей RTC-статистики без медийного подключения.

Экспортируемые символы: `collectLocalNodeTopology`.

Читает/импортирует: [`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `livekit-server-sdk`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/optional/presentation-control-handler.ts

[`apps/web/lib/optional/presentation-control-handler.ts`](../../apps/web/lib/optional/presentation-control-handler.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `runtime`, `dynamic`, `POST`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/presentation-control-state.ts`](../../apps/web/lib/presentation-control-state.ts), [`apps/web/lib/presentation-control.ts`](../../apps/web/lib/presentation-control.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:crypto`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/output-track-bindings.ts

[`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `OutputAudioPlaybackState`, `createOutputTrackBindings`.

Читает/импортирует: [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx), [`apps/web/components/multiview/MultiviewAudio.tsx`](../../apps/web/components/multiview/MultiviewAudio.tsx), [`apps/web/lib/slot-output-controller.ts`](../../apps/web/lib/slot-output-controller.ts), [`apps/web/tests/output-track-bindings.cjs`](../../apps/web/tests/output-track-bindings.cjs).

### apps/web/lib/participant-role-client.ts

[`apps/web/lib/participant-role-client.ts`](../../apps/web/lib/participant-role-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ParticipantStaffRole`, `ParticipantRoleOffer`, `parseParticipantRoleOffer`, `acceptParticipantRoleOffer`.

Используют: [`apps/web/components/GuestRoleOffer.tsx`](../../apps/web/components/GuestRoleOffer.tsx), [`apps/web/components/StudioGuestRoleControls.tsx`](../../apps/web/components/StudioGuestRoleControls.tsx), [`apps/web/tests/participant-role-client.cjs`](../../apps/web/tests/participant-role-client.cjs).

### apps/web/lib/participant-role-store.ts

[`apps/web/lib/participant-role-store.ts`](../../apps/web/lib/participant-role-store.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ParticipantRoleOffer`, `createParticipantRoleOffer`, `readParticipantRoleOffer`, `findParticipantRoleOffer`, `consumeParticipantRoleOffer`.

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts).

### apps/web/lib/participant-role.ts

[`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts)

Определение отображаемой роли по identity/metadata; технические участники не становятся персоналом.

Экспортируемые символы: `ParticipantRole`, `resolveParticipantRole`.

Используют: [`apps/web/components/PresentationControls.tsx`](../../apps/web/components/PresentationControls.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StaffParticipantsPanel.tsx`](../../apps/web/components/StaffParticipantsPanel.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx), [`apps/web/tests/participant-role.cjs`](../../apps/web/tests/participant-role.cjs).

### apps/web/lib/pdf-presentation-client.ts

[`apps/web/lib/pdf-presentation-client.ts`](../../apps/web/lib/pdf-presentation-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `presentationRequest`, `createPdfPresentationBridge`, `presentationPage`.

Читает/импортирует: [`apps/web/lib/presentation-control.ts`](../../apps/web/lib/presentation-control.ts).

Используют: [`apps/web/components/PresentationControls.tsx`](../../apps/web/components/PresentationControls.tsx).

### apps/web/lib/persistent-storage.ts

[`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts)

Пути постоянных данных, installation identity, атомарная запись JSON и startup-валидация.

Экспортируемые символы: `storageSchemaVersion`, `PersistentDataError`, `productionDataDir`, `runtimeFile`, `persistentStatsDir`, `readJson`, `atomicWriteJson`, `ensureInstallationIdentity`, `validatePersistentStorage`, `getInstallationIdentity`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts), [`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts), [`apps/web/lib/caster-slot-access.ts`](../../apps/web/lib/caster-slot-access.ts), [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/guest-entry-store.ts`](../../apps/web/lib/guest-entry-store.ts), [`apps/web/lib/guest-invite-key.ts`](../../apps/web/lib/guest-invite-key.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/multiview-store.ts`](../../apps/web/lib/multiview-store.ts), [`apps/web/lib/room-chat-store.ts`](../../apps/web/lib/room-chat-store.ts), [`apps/web/lib/room-creation-access.ts`](../../apps/web/lib/room-creation-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-feature-store.ts`](../../apps/web/lib/server-feature-store.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/talkback-session.ts`](../../apps/web/lib/talkback-session.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/tests/persistent-storage.cjs`](../../apps/web/tests/persistent-storage.cjs), [`apps/web/tests/server-reserve-outbound-lifecycle.cjs`](../../apps/web/tests/server-reserve-outbound-lifecycle.cjs).

Переменные окружения (только имена): `NODE_ENV`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_MODERATOR_ACCESS_FILE`, `STUDIOLINK_ROOMS_FILE`, `STUDIOLINK_STATS_DIR`, `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/lib/personal-monitoring.ts

[`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts)

React-hook личных настроек прослушивания/видео; не общее управление источником.

Экспортируемые символы: `MonitorPreference`, `defaultMonitor`, `usePersonalMonitoring`.

Читает/импортирует: [`apps/web/lib/monitor-audio.ts`](../../apps/web/lib/monitor-audio.ts), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/ModeratorStudioMonitoring.tsx`](../../apps/web/components/ModeratorStudioMonitoring.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/room-mode-monitoring.cjs`](../../apps/web/tests/room-mode-monitoring.cjs).

### apps/web/lib/platform-credentials.ts

[`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts)

Одноразовые opaque приглашения и сессии в PG: только хэши, срок, atomic redemption, отзыв.

Экспортируемые символы: `PLATFORM_INVITE_SECONDS`, `PLATFORM_SESSION_SECONDS`, `platformTokenHash`, `issuePlatformInvite`, `redeemPlatformInvite`, `readPlatformSession`, `revokePlatformSession`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts), [`apps/web/tests/node-operations-postgres.cjs`](../../apps/web/tests/node-operations-postgres.cjs), [`apps/web/tests/platform-access-postgres.cjs`](../../apps/web/tests/platform-access-postgres.cjs).

### apps/web/lib/platform-node-operations.ts

[`apps/web/lib/platform-node-operations.ts`](../../apps/web/lib/platform-node-operations.ts)

Маршрутизация разрешённых Super Admin-команд на соответствующую ноду.

Экспортируемые символы: `executePlatformNodeOperation`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/node-operations.ts`](../../apps/web/lib/node-operations.ts), [`apps/web/lib/node-request.ts`](../../apps/web/lib/node-request.ts).

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/lib/node-state-transition.ts`](../../apps/web/lib/node-state-transition.ts).

### apps/web/lib/platform-topology.ts

[`apps/web/lib/platform-topology.ts`](../../apps/web/lib/platform-topology.ts)

Объединение central registry и observed node rooms, неизвестные значения и отдельный assignment.

Экспортируемые символы: `mergePlatformTopology`.

Используют: [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/tests/topology-merge.cjs`](../../apps/web/tests/topology-merge.cjs).

### apps/web/lib/postgres-room-store.ts

[`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts)

Node-local PostgreSQL backend комнат, транзакции, установка и studio scope.

Экспортируемые символы: `roomRecordFromRow`, `createPostgresPool`, `PostgresRoomStoreBackend`.

Читает/импортирует: [`apps/web/lib/diagnostic-room-revision.ts`](../../apps/web/lib/diagnostic-room-revision.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `pg`.

Используют: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-feature-store.ts`](../../apps/web/lib/server-feature-store.ts), [`apps/web/tests/media-room-revision-postgres.cjs`](../../apps/web/tests/media-room-revision-postgres.cjs), [`apps/web/tests/multitenant-room-isolation.cjs`](../../apps/web/tests/multitenant-room-isolation.cjs), [`apps/web/tests/postgres-room-store.cjs`](../../apps/web/tests/postgres-room-store.cjs).

Переменные окружения (только имена): `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_IDLE_TIMEOUT_MS`, `CASTLINK_DB_POOL_MAX`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `DATABASE_URL`, `STUDIOLINK_INSTALLATION_ID`.

### apps/web/lib/presentation-control-state.ts

[`apps/web/lib/presentation-control-state.ts`](../../apps/web/lib/presentation-control-state.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PresentationPrincipal`, `PresentationBinding`, `PresentationEntry`, `createPresentation`, `presentationById`, `presentationByToken`, `connectPresentation`, `dropPresentation`, `presentationEntries`, `refreshPresentation`, `presentationSnapshot`, `issuePresentationCommand`, `pollPresentation`.

Читает/импортирует: [`apps/web/lib/presentation-control.ts`](../../apps/web/lib/presentation-control.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/lib/optional/presentation-control-handler.ts`](../../apps/web/lib/optional/presentation-control-handler.ts).

### apps/web/lib/presentation-control.ts

[`apps/web/lib/presentation-control.ts`](../../apps/web/lib/presentation-control.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PresentationKind`, `PresentationDirection`, `PresentationStatus`, `PresentationCommand`, `PresentationResult`, `PresentationSession`, `PRESENTATION_COMMAND_TTL`, `PRESENTATION_HEARTBEAT_TTL`, `parsePresentationStatus`, `acceptPresentationCommand`.

Используют: [`apps/web/components/PresentationControls.tsx`](../../apps/web/components/PresentationControls.tsx), [`apps/web/lib/optional/presentation-control-handler.ts`](../../apps/web/lib/optional/presentation-control-handler.ts), [`apps/web/lib/pdf-presentation-client.ts`](../../apps/web/lib/pdf-presentation-client.ts), [`apps/web/lib/presentation-control-state.ts`](../../apps/web/lib/presentation-control-state.ts).

### apps/web/lib/presentation-file-client.ts

[`apps/web/lib/presentation-file-client.ts`](../../apps/web/lib/presentation-file-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PresentationFileProgress`, `validPresentationFile`, `convertPresentationFile`.

Читает/импортирует: [`apps/web/lib/presentation-upload-limits.ts`](../../apps/web/lib/presentation-upload-limits.ts).

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx).

### apps/web/lib/presentation-file.ts

[`apps/web/lib/presentation-file.ts`](../../apps/web/lib/presentation-file.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `convertPresentationFile`.

Читает/импортирует: [`apps/web/lib/presentation-upload-limits.ts`](../../apps/web/lib/presentation-upload-limits.ts), [`apps/web/lib/presentation-upload.ts`](../../apps/web/lib/presentation-upload.ts).

Библиотеки/Node: `node:fs`, `node:fs/promises`, `node:http`, `node:os`, `node:path`.

Используют: [`apps/web/app/api/presentation-file/route.ts`](../../apps/web/app/api/presentation-file/route.ts).

### apps/web/lib/presentation-upload-limits.ts

[`apps/web/lib/presentation-upload-limits.ts`](../../apps/web/lib/presentation-upload-limits.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `MAX_PRESENTATION_UPLOAD`, `PRESENTATION_UPLOAD_TIMEOUT`.

Используют: [`apps/web/components/PdfPresentationViewer.tsx`](../../apps/web/components/PdfPresentationViewer.tsx), [`apps/web/lib/presentation-file-client.ts`](../../apps/web/lib/presentation-file-client.ts), [`apps/web/lib/presentation-file.ts`](../../apps/web/lib/presentation-file.ts), [`apps/web/lib/presentation-upload.ts`](../../apps/web/lib/presentation-upload.ts).

### apps/web/lib/presentation-upload.ts

[`apps/web/lib/presentation-upload.ts`](../../apps/web/lib/presentation-upload.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PresentationFileError`, `uploadError`, `savePresentationUpload`.

Читает/импортирует: [`apps/web/lib/presentation-upload-limits.ts`](../../apps/web/lib/presentation-upload-limits.ts).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/lib/presentation-file.ts`](../../apps/web/lib/presentation-file.ts).

### apps/web/lib/private-talkback-audio.ts

[`apps/web/lib/private-talkback-audio.ts`](../../apps/web/lib/private-talkback-audio.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `bindPrivateTalkbackAudio`.

Читает/импортирует: [`apps/web/lib/monitor-audio.ts`](../../apps/web/lib/monitor-audio.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/tests/private-talkback-audio.cjs`](../../apps/web/tests/private-talkback-audio.cjs).

### apps/web/lib/private-talkback-reply.ts

[`apps/web/lib/private-talkback-reply.ts`](../../apps/web/lib/private-talkback-reply.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PrivateReplyDependencies`, `createPrivateReplyController`, `waitForPrivateReplyPermission`.

Используют: [`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx), [`apps/web/tests/private-talkback-controls.cjs`](../../apps/web/tests/private-talkback-controls.cjs), [`apps/web/tests/private-talkback-reply.cjs`](../../apps/web/tests/private-talkback-reply.cjs).

### apps/web/lib/public-room-name.ts

[`apps/web/lib/public-room-name.ts`](../../apps/web/lib/public-room-name.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `validPublicRoomName`.

Используют: [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts).

### apps/web/lib/rate-limit.ts

[`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts)

Ограничитель частоты control API в памяти процесса, HTTP429 и Retry-After; не сетевая DDoS-защита.

Экспортируемые символы: `RateLimitOptions`, `RateLimitDecision`, `requestSource`, `consumeRateLimit`, `rateLimitHeaders`, `resetRateLimitsForTests`.

Читает/импортирует: [`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/caster-slot-output/route.ts`](../../apps/web/app/api/caster-slot-output/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/co-presentation-helper/route.ts`](../../apps/web/app/api/co-presentation-helper/route.ts), [`apps/web/app/api/co-presentations/route.ts`](../../apps/web/app/api/co-presentations/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts), [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/hosted-access/route.ts`](../../apps/web/app/api/hosted-access/route.ts), [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts), [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/optional/presentation-control-handler.ts`](../../apps/web/lib/optional/presentation-control-handler.ts), [`apps/web/tests/rate-limit.cjs`](../../apps/web/tests/rate-limit.cjs), [`apps/web/tests/room-creation-access.cjs`](../../apps/web/tests/room-creation-access.cjs), [`apps/web/tests/room-creation-password-settings.cjs`](../../apps/web/tests/room-creation-password-settings.cjs), [`apps/web/tests/server-provisioning-api.cjs`](../../apps/web/tests/server-provisioning-api.cjs).

### apps/web/lib/reconnect-status.ts

[`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts)

Состояния и подписи UI при подключении, потере связи и восстановлении.

Экспортируемые символы: `RecoveryPhase`, `RecoveryStatus`, `RecoveryEvent`, `initialRecoveryStatus`, `nextRecoveryStatus`, `recoveryBadge`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs), [`apps/web/tests/reconnect-recovery.cjs`](../../apps/web/tests/reconnect-recovery.cjs).

### apps/web/lib/reserve-health.ts

[`apps/web/lib/reserve-health.ts`](../../apps/web/lib/reserve-health.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ReserveHealthOutcome`, `classifyReserveHealth`, `classifyReserveHealthError`, `ReserveFailureHistory`, `automaticFailureHistory`, `probeReserveSource`.

Читает/импортирует: [`apps/web/lib/server-peer-request.ts`](../../apps/web/lib/server-peer-request.ts), [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts).

### apps/web/lib/reserve-heartbeat-worker.ts

[`apps/web/lib/reserve-heartbeat-worker.ts`](../../apps/web/lib/reserve-heartbeat-worker.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `sendReserveHeartbeats`, `startReserveHeartbeatWorker`.

Читает/импортирует: [`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts).

Используют: [`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts), [`apps/web/tests/reserve-heartbeat-worker.cjs`](../../apps/web/tests/reserve-heartbeat-worker.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs).

### apps/web/lib/reserve-heartbeat.ts

[`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `OUTBOUND_RESERVE_PROTOCOL`, `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_FAILURE_MS`, `ReserveHeartbeatHistory`, `reserveHeartbeatHistory`, `heartbeatBinding`.

Читает/импортирует: [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts).

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/lib/reserve-heartbeat-worker.ts`](../../apps/web/lib/reserve-heartbeat-worker.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/tests/reserve-heartbeat.cjs`](../../apps/web/tests/reserve-heartbeat.cjs), [`apps/web/tests/server-reserve-outbound-lifecycle.cjs`](../../apps/web/tests/server-reserve-outbound-lifecycle.cjs), [`apps/web/tests/server-reserve-outbound.cjs`](../../apps/web/tests/server-reserve-outbound.cjs).

### apps/web/lib/reserve-source.ts

[`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `disarmSourceReserve`, `reconcileSourceReserve`, `sourceSessionMoved`, `revokePreparedSessions`, `schedulePreparedRevocation`, `applySourceAutomatic`.

Читает/импортирует: [`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts).

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/tests/reserve-source-protocol.cjs`](../../apps/web/tests/reserve-source-protocol.cjs), [`apps/web/tests/reserve-source-races.cjs`](../../apps/web/tests/reserve-source-races.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-reserve-roundtrip.cjs`](../../apps/web/tests/server-reserve-roundtrip.cjs).

### apps/web/lib/room-admin.ts

[`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts)

Выдача и проверка scoped room-admin cookie/приглашений и версии их отзыва.

Экспортируемые символы: `newRoomAdminInvite`, `validRoomAdminInvite`, `setRoomAdminCookie`, `clearRoomAdminCookie`, `verifiedRoomAdminSession`, `verifiedRoomAdminVersion`, `isRoomAdmin`, `roomAdminLifetimeSeconds`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts), [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/health/route.ts`](../../apps/web/app/api/health/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/tests/hosted-staff-access.cjs`](../../apps/web/tests/hosted-staff-access.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs).

### apps/web/lib/room-chat-auth.ts

[`apps/web/lib/room-chat-auth.ts`](../../apps/web/lib/room-chat-auth.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `roomChatIssuer`, `verifyRoomChatToken`, `issueRoomChatToken`.

Библиотеки/Node: `livekit-server-sdk`.

Используют: [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts).

### apps/web/lib/room-chat-client.ts

[`apps/web/lib/room-chat-client.ts`](../../apps/web/lib/room-chat-client.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `mergeRoomChat`.

Читает/импортирует: [`apps/web/lib/room-chat-types.ts`](../../apps/web/lib/room-chat-types.ts).

Библиотеки/Node: `@livekit/components-react`.

Используют: [`apps/web/lib/use-persistent-room-chat.ts`](../../apps/web/lib/use-persistent-room-chat.ts).

### apps/web/lib/room-chat-store.ts

[`apps/web/lib/room-chat-store.ts`](../../apps/web/lib/room-chat-store.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ROOM_CHAT_RETENTION_MS`, `RoomChatGenerationConflict`, `readRoomChatSnapshot`, `readRoomChat`, `appendRoomChatSnapshot`, `appendRoomChat`, `clearRoomChat`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/room-chat-types.ts`](../../apps/web/lib/room-chat-types.ts).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts).

### apps/web/lib/room-chat-types.ts

[`apps/web/lib/room-chat-types.ts`](../../apps/web/lib/room-chat-types.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StoredRoomChatMessage`, `RoomChatScope`, `RoomChatSnapshot`, `RoomChatAppendResult`.

Используют: [`apps/web/lib/room-chat-client.ts`](../../apps/web/lib/room-chat-client.ts), [`apps/web/lib/room-chat-store.ts`](../../apps/web/lib/room-chat-store.ts), [`apps/web/lib/use-persistent-room-chat.ts`](../../apps/web/lib/use-persistent-room-chat.ts).

### apps/web/lib/room-creation-access.ts

[`apps/web/lib/room-creation-access.ts`](../../apps/web/lib/room-creation-access.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `effectiveRoomCreationPasswordHash`, `roomCreationEnabled`, `validRoomCreationPassword`, `changeRoomCreationPassword`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Библиотеки/Node: `node:crypto`, `node:fs/promises`.

Используют: [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/page.tsx`](../../apps/web/app/page.tsx), [`apps/web/app/studio/page.tsx`](../../apps/web/app/studio/page.tsx), [`apps/web/lib/server-provisioning.ts`](../../apps/web/lib/server-provisioning.ts), [`apps/web/tests/room-creation-password-settings.cjs`](../../apps/web/tests/room-creation-password-settings.cjs).

Переменные окружения (только имена): `ROOM_CREATION_PASSWORD`, `ROOM_CREATION_PASSWORD_SHA256`.

### apps/web/lib/room-mode.ts

[`apps/web/lib/room-mode.ts`](../../apps/web/lib/room-mode.ts)

Браузерная синхронизация режима комнаты, например просмотра только Studio.

Экспортируемые символы: `useRoomMode`.

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/lib/room-reactions.ts

[`apps/web/lib/room-reactions.ts`](../../apps/web/lib/room-reactions.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `REACTION_TOPIC`, `REACTION_DURATION`, `RoomReaction`, `createRoomReactions`.

Читает/импортирует: [`apps/web/lib/chat-emojis.ts`](../../apps/web/lib/chat-emojis.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/RoomReactions.tsx`](../../apps/web/components/RoomReactions.tsx), [`apps/web/tests/fixtures/room-reactions-ui.tsx`](../../apps/web/tests/fixtures/room-reactions-ui.tsx).

### apps/web/lib/room-store.ts

[`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts)

Общий интерфейс комнат, выбор явно заданного JSON/PG backend, access versions.

Экспортируемые символы: `RoomRecord`, `RoomMutation`, `RoomStoreBackend`, `JsonRoomStoreBackend`, `validateRoomStore`, `readRooms`, `updateRooms`, `ensureRoomAccessVersions`, `readNodeRoomInventory`, `invalidateDiagnosticReceipts`.

Читает/импортирует: [`apps/web/lib/diagnostic-room-revision.ts`](../../apps/web/lib/diagnostic-room-revision.ts), [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/guest-command/route.ts`](../../apps/web/app/api/guest-command/route.ts), [`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts), [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts), [`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts), [`apps/web/lib/diagnostic-room-revision.ts`](../../apps/web/lib/diagnostic-room-revision.ts), [`apps/web/lib/guest-entry-store.ts`](../../apps/web/lib/guest-entry-store.ts), [`apps/web/lib/guest-session-settings.ts`](../../apps/web/lib/guest-session-settings.ts), [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/multiview-store.ts`](../../apps/web/lib/multiview-store.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/optional/presentation-control-handler.ts`](../../apps/web/lib/optional/presentation-control-handler.ts), [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/fixtures/slots-qa-bootstrap.ts`](../../apps/web/tests/fixtures/slots-qa-bootstrap.ts), [`apps/web/tests/media-room-api.cjs`](../../apps/web/tests/media-room-api.cjs), [`apps/web/tests/media-room-association.cjs`](../../apps/web/tests/media-room-association.cjs), [`apps/web/tests/media-room-revision.cjs`](../../apps/web/tests/media-room-revision.cjs), [`apps/web/tests/media-studio-control.cjs`](../../apps/web/tests/media-studio-control.cjs), [`apps/web/tests/multiview-api.cjs`](../../apps/web/tests/multiview-api.cjs), [`apps/web/tests/multiview-delete-api.cjs`](../../apps/web/tests/multiview-delete-api.cjs), [`apps/web/tests/room-access-version.cjs`](../../apps/web/tests/room-access-version.cjs), [`apps/web/tests/room-creation-access.cjs`](../../apps/web/tests/room-creation-access.cjs), [`apps/web/tests/room-creation-password-settings.cjs`](../../apps/web/tests/room-creation-password-settings.cjs), [`apps/web/tests/room-store-backend.cjs`](../../apps/web/tests/room-store-backend.cjs), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs), [`apps/web/tests/stats-multi-client.cjs`](../../apps/web/tests/stats-multi-client.cjs), [`apps/web/tests/transfer-node-admission.cjs`](../../apps/web/tests/transfer-node-admission.cjs).

Переменные окружения (только имена): `CASTLINK_STORAGE_BACKEND`, `STUDIOLINK_ROOMS_FILE`.

### apps/web/lib/room-studio-access.ts

[`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `verifiedRoomStudioSession`, `canHostRoom`, `setRoomStudioCookie`, `clearRoomStudioCookie`, `canHostNamedRoom`, `requireRoomCreatorUnchanged`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts), [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/tests/fixtures/slots-qa-bootstrap.ts`](../../apps/web/tests/fixtures/slots-qa-bootstrap.ts), [`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs).

### apps/web/lib/rtc-telemetry.ts

[`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts)

Сбор клиентских RTC samples, дельты счётчиков и отправка статистики.

Экспортируемые символы: `rateDelta`, `startRoomTelemetry`.

Читает/импортирует: [`apps/web/lib/audio-diagnostics.ts`](../../apps/web/lib/audio-diagnostics.ts), [`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts), [`apps/web/lib/telemetry-context.ts`](../../apps/web/lib/telemetry-context.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/telemetry-scope.cjs`](../../apps/web/tests/telemetry-scope.cjs), [`apps/web/tests/telemetry.cjs`](../../apps/web/tests/telemetry.cjs).

### apps/web/lib/saved-servers.ts

[`apps/web/lib/saved-servers.ts`](../../apps/web/lib/saved-servers.ts)

Проверка и хранение списка выбранных пользователем адресов серверов.

Экспортируемые символы: `SavedServer`, `normalizeServerOrigin`, `normalizeSavedServer`, `readSavedServers`, `writeSavedServers`.

Используют: [`apps/web/components/GuestServerPicker.tsx`](../../apps/web/components/GuestServerPicker.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx), [`apps/web/tests/saved-servers.cjs`](../../apps/web/tests/saved-servers.cjs).

### apps/web/lib/screen-share-stop-panel.ts

[`apps/web/lib/screen-share-stop-panel.ts`](../../apps/web/lib/screen-share-stop-panel.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ScreenShareStopLabels`, `ScreenShareStopPanelState`, `createScreenShareStopPanel`, `ScreenShareStopPanel`.

Читает/импортирует: [`apps/web/lib/document-picture-in-picture.ts`](../../apps/web/lib/document-picture-in-picture.ts).

Используют: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/lib/desktop-stop-panel.ts`](../../apps/web/lib/desktop-stop-panel.ts), [`apps/web/tests/co-presentation-size.browser.cjs`](../../apps/web/tests/co-presentation-size.browser.cjs).

### apps/web/lib/screen-share.ts

[`apps/web/lib/screen-share.ts`](../../apps/web/lib/screen-share.ts)

Публикация экрана с опциональным звуком, отмена и остановка позднего capture после disconnect.

Экспортируемые символы: `ScreenShareRoom`, `enableRoomScreenShare`, `setRoomScreenShareOutputMuted`, `enableStudioScreenShare`, `stopStudioScreenShare`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/screen-share-lifecycle.cjs`](../../apps/web/tests/screen-share-lifecycle.cjs), [`apps/web/tests/studio-screen-share-mute.cjs`](../../apps/web/tests/studio-screen-share-mute.cjs).

### apps/web/lib/server-feature-store.ts

[`apps/web/lib/server-feature-store.ts`](../../apps/web/lib/server-feature-store.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `readServerFeatureState`, `updateServerFeatureState`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts).

Библиотеки/Node: `pg`.

Используют: [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/guest-admission-store.ts`](../../apps/web/lib/guest-admission-store.ts).

Переменные окружения (только имена): `CASTLINK_STORAGE_BACKEND`.

### apps/web/lib/server-lease.ts

[`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts)

Проверка подписанного разрешения установки обращаться к registry/server service.

Экспортируемые символы: `ServerLeasePayload`, `ServerLeaseStatus`, `verifyServerLease`.

Читает/импортирует: [`apps/web/lib/license-public-key.generated.ts`](../../apps/web/lib/license-public-key.generated.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/lib/entitlement.ts`](../../apps/web/lib/entitlement.ts), [`apps/web/lib/license-activation.ts`](../../apps/web/lib/license-activation.ts), [`apps/web/tests/licensing.cjs`](../../apps/web/tests/licensing.cjs).

### apps/web/lib/server-log.ts

[`apps/web/lib/server-log.ts`](../../apps/web/lib/server-log.ts)

Структурированные серверные события и correlation/request IDs без прямой печати секретов.

Экспортируемые символы: `requestId`, `serverLog`, `requestHeaders`.

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts), [`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/app/v1/node/topology/route.ts`](../../apps/web/app/v1/node/topology/route.ts), [`apps/web/app/v1/nodes/heartbeat/route.ts`](../../apps/web/app/v1/nodes/heartbeat/route.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts).

### apps/web/lib/server-peer-request.ts

[`apps/web/lib/server-peer-request.ts`](../../apps/web/lib/server-peer-request.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`scripts/server-peer-request.mjs`](../../scripts/server-peer-request.mjs).

Используют: [`apps/web/lib/reserve-health.ts`](../../apps/web/lib/reserve-health.ts), [`apps/web/lib/server-provisioning.ts`](../../apps/web/lib/server-provisioning.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts).

### apps/web/lib/server-profile-removal.ts

[`apps/web/lib/server-profile-removal.ts`](../../apps/web/lib/server-profile-removal.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `connectionInUse`, `removeUnusedRoomServerPeer`.

Читает/импортирует: [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts).

Используют: [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/tests/server-profile-removal.cjs`](../../apps/web/tests/server-profile-removal.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs).

### apps/web/lib/server-profiles.ts

[`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`scripts/server-profile-store.mjs`](../../scripts/server-profile-store.mjs).

Используют: [`apps/web/app/api/server-provisioning/operator/route.ts`](../../apps/web/app/api/server-provisioning/operator/route.ts), [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/lib/reserve-health.ts`](../../apps/web/lib/reserve-health.ts), [`apps/web/lib/server-profile-removal.ts`](../../apps/web/lib/server-profile-removal.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts), [`apps/web/tests/server-profile-removal.cjs`](../../apps/web/tests/server-profile-removal.cjs), [`apps/web/tests/server-provisioning.cjs`](../../apps/web/tests/server-provisioning.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs).

### apps/web/lib/server-provisioning-ssh.ts

[`apps/web/lib/server-provisioning-ssh.ts`](../../apps/web/lib/server-provisioning-ssh.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`scripts/server-provisioning-ssh.mjs`](../../scripts/server-provisioning-ssh.mjs).

Библиотеки/Node: `ssh2`.

Используют: [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/lib/server-provisioning.ts`](../../apps/web/lib/server-provisioning.ts), [`apps/web/tests/server-provisioning-ssh.cjs`](../../apps/web/tests/server-provisioning-ssh.cjs).

### apps/web/lib/server-provisioning.ts

[`apps/web/lib/server-provisioning.ts`](../../apps/web/lib/server-provisioning.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Читает/импортирует: [`apps/web/lib/room-creation-access.ts`](../../apps/web/lib/room-creation-access.ts), [`apps/web/lib/server-peer-request.ts`](../../apps/web/lib/server-peer-request.ts), [`apps/web/lib/server-provisioning-ssh.ts`](../../apps/web/lib/server-provisioning-ssh.ts), [`scripts/server-provisioning.mjs`](../../scripts/server-provisioning.mjs).

Используют: [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/tests/server-provisioning.cjs`](../../apps/web/tests/server-provisioning.cjs).

### apps/web/lib/server-registry-client.ts

[`apps/web/lib/server-registry-client.ts`](../../apps/web/lib/server-registry-client.ts)

Серверный клиент внешнего реестра: список, временная нода, деактивация.

Экспортируемые символы: `RegisteredServer`, `listRegisteredServers`, `createTemporaryServer`, `deactivateRegisteredServer`.

Читает/импортирует: [`apps/web/lib/license-state.ts`](../../apps/web/lib/license-state.ts).

Используют: [`apps/web/app/api/servers/route.ts`](../../apps/web/app/api/servers/route.ts).

Переменные окружения (только имена): `CASTLINK_LICENSE_SERVICE_URL`, `CASTLINK_LICENSE_TIMEOUT_MS`, `CASTLINK_SERVER_LEASE`, `NODE_ENV`.

### apps/web/lib/server-reserve.ts

[`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `ReserveSession`, `ReserveSnapshot`, `ReserveCohort`, `SourceReserve`, `reserveStatePath`, `reserveTransaction`, `stageReserve`, `observeReserve`, `activateReserve`, `redeemReserve`, `disarmReserve`, `reserveReceipt`, `readReserveStateSnapshot`, `revokeReserveSessions`, `setReserveAutomatic`, `autoActivateReserve`, `recordInstalledGeneration`, `returnedInstallation`, `recoverReturnedSource`, `recordPlannedInstallation`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/reserve-health.ts`](../../apps/web/lib/reserve-health.ts), [`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:crypto`, `node:fs/promises`.

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/lib/reserve-health.ts`](../../apps/web/lib/reserve-health.ts), [`apps/web/lib/reserve-heartbeat-worker.ts`](../../apps/web/lib/reserve-heartbeat-worker.ts), [`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/server-profile-removal.ts`](../../apps/web/lib/server-profile-removal.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/reserve-source-races.cjs`](../../apps/web/tests/reserve-source-races.cjs), [`apps/web/tests/server-profile-removal.cjs`](../../apps/web/tests/server-profile-removal.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-reserve-automatic.cjs`](../../apps/web/tests/server-reserve-automatic.cjs), [`apps/web/tests/server-reserve-outbound-lifecycle.cjs`](../../apps/web/tests/server-reserve-outbound-lifecycle.cjs), [`apps/web/tests/server-reserve-outbound.cjs`](../../apps/web/tests/server-reserve-outbound.cjs), [`apps/web/tests/server-reserve-state.cjs`](../../apps/web/tests/server-reserve-state.cjs).

Переменные окружения (только имена): `STUDIOLINK_RESERVE_STATE_FILE`.

### apps/web/lib/server-transfer.ts

[`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts)

Проверка доверенных origin, server bridge, transfer ticket и состояние переноса.

Экспортируемые символы: `TransferRole`, `TransferAuthorization`, `TransferTicket`, `EligibleGuestSession`, `updateTransferState`, `transferSecret`, `TransferTarget`, `resolveClientTargetUrl`, `transferTargets`, `transferServer`, `peerOriginAllowed`, `transferOriginConfigured`, `signBridge`, `verifyBridge`, `transferRoomKey`, `ticketHash`, `newTicket`.

Читает/импортирует: [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/transfer-origin.ts`](../../apps/web/lib/transfer-origin.ts).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:net`, `node:path`.

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/lib/reserve-health.ts`](../../apps/web/lib/reserve-health.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/server-profile-removal.ts`](../../apps/web/lib/server-profile-removal.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/reserve-health.cjs`](../../apps/web/tests/reserve-health.cjs), [`apps/web/tests/server-profile-removal.cjs`](../../apps/web/tests/server-profile-removal.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-reserve-roundtrip.cjs`](../../apps/web/tests/server-reserve-roundtrip.cjs), [`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs), [`apps/web/tests/server-transfer.cjs`](../../apps/web/tests/server-transfer.cjs), [`apps/web/tests/transfer-health-identity.cjs`](../../apps/web/tests/transfer-health-identity.cjs), [`apps/web/tests/transfer-node-admission.cjs`](../../apps/web/tests/transfer-node-admission.cjs), [`apps/web/tests/transfer-origins.cjs`](../../apps/web/tests/transfer-origins.cjs).

Переменные окружения (только имена): `STUDIOLINK_DEFAULT_STUDIO_ID`, `STUDIOLINK_TRANSFER_ORIGIN`, `STUDIOLINK_TRANSFER_PEER_ORIGIN`, `STUDIOLINK_TRANSFER_SECRET`, `STUDIOLINK_TRANSFER_SERVER_ID`, `STUDIOLINK_TRANSFER_SERVER_LABEL`, `STUDIOLINK_TRANSFER_STATE_FILE`, `STUDIOLINK_TRANSFER_TARGETS_JSON`.

### apps/web/lib/setup-state.ts

[`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts)

Состояние первичной настройки, проверка setup-token, завершение setup.

Экспортируемые символы: `readSetupState`, `validSetupToken`, `setupRequired`, `SetupConflictError`, `completeSetup`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts), [`apps/web/tests/self-hosted-setup.cjs`](../../apps/web/tests/self-hosted-setup.cjs), [`apps/web/tests/setup-wizard.cjs`](../../apps/web/tests/setup-wizard.cjs).

Переменные окружения (только имена): `CASTLINK_SETUP_TOKEN`.

### apps/web/lib/slot-output-controller.ts

[`apps/web/lib/slot-output-controller.ts`](../../apps/web/lib/slot-output-controller.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `SlotOutputSnapshot`, `createSlotOutputController`.

Читает/импортирует: [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts), [`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx), [`apps/web/tests/slot-output-media.cjs`](../../apps/web/tests/slot-output-media.cjs).

### apps/web/lib/slot-room-scope.ts

[`apps/web/lib/slot-room-scope.ts`](../../apps/web/lib/slot-room-scope.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `slotRoomAssociation`, `slotRoomVersion`, `ensureSlotRoomScope`, `roomForSlotScope`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/caster-slot-types.ts`](../../apps/web/lib/caster-slot-types.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/caster-slot-output/route.ts`](../../apps/web/app/api/caster-slot-output/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts).

### apps/web/lib/staff-chat-state.ts

[`apps/web/lib/staff-chat-state.ts`](../../apps/web/lib/staff-chat-state.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `STAFF_CHAT_BADGE_STORAGE_KEY`, `StaffChatState`, `createStaffChatState`, `markStaffChatRead`, `receiveStaffChat`, `parseStaffChatBadgePreference`, `staffChatBadge`.

Библиотеки/Node: `@livekit/components-react`.

Используют: [`apps/web/lib/use-staff-room-chat.ts`](../../apps/web/lib/use-staff-room-chat.ts).

### apps/web/lib/staff-display-name.ts

[`apps/web/lib/staff-display-name.ts`](../../apps/web/lib/staff-display-name.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `reserveStaffDisplayName`.

Используют: [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/tests/staff-display-name.cjs`](../../apps/web/tests/staff-display-name.cjs).

### apps/web/lib/stats-csv.ts

[`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts)

CSV-экспорт, экранирование ячеек, BOM и нейтрализация формул из пользовательских строк.

Экспортируемые символы: `csv`, `historyCsv`, `connectionsCsv`, `audioHistoryCsv`.

Читает/импортирует: [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/tests/audio-diagnostics.cjs`](../../apps/web/tests/audio-diagnostics.cjs), [`apps/web/tests/telemetry.cjs`](../../apps/web/tests/telemetry.cjs).

### apps/web/lib/stats-report.ts

[`apps/web/lib/stats-report.ts`](../../apps/web/lib/stats-report.ts)

Автономный HTML-отчёт с графиками, участниками, последними потоками и временными агрегатами.

Экспортируемые символы: `statisticsReport`.

Читает/импортирует: [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Используют: [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs).

### apps/web/lib/studio-control.ts

[`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts)

Основная студия, lease, epoch, desired/actual и сериализация runtime JSON.

Экспортируемые символы: `StudioDesired`, `StudioRoomState`, `validStudioRoom`, `validStudioClient`, `readStudioState`, `joinStudio`, `claimStudio`, `heartbeatStudio`, `releaseStudio`, `resetStudioForTransfer`, `updateStudioDesired`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Используют: [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioDeviceControlPanel.tsx`](../../apps/web/components/StudioDeviceControlPanel.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/media-studio-control.cjs`](../../apps/web/tests/media-studio-control.cjs), [`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-reserve-outbound-lifecycle.cjs`](../../apps/web/tests/server-reserve-outbound-lifecycle.cjs), [`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs), [`apps/web/tests/studio-control-devices.cjs`](../../apps/web/tests/studio-control-devices.cjs), [`apps/web/tests/studio-output-api.cjs`](../../apps/web/tests/studio-output-api.cjs), [`apps/web/tests/studio-output-source.cjs`](../../apps/web/tests/studio-output-source.cjs), [`apps/web/tests/studio-video-mode.cjs`](../../apps/web/tests/studio-video-mode.cjs), [`apps/web/tests/studio-watch-stats.cjs`](../../apps/web/tests/studio-watch-stats.cjs), [`apps/web/tests/video-quality-vp9.cjs`](../../apps/web/tests/video-quality-vp9.cjs).

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/lib/studio-device-session.ts

[`apps/web/lib/studio-device-session.ts`](../../apps/web/lib/studio-device-session.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `studioDeviceStorage`, `StudioDeviceChoices`, `readStudioDeviceChoices`, `saveStudioDeviceChoices`, `StudioTrackRollbackError`, `replaceStudioPublishedTracks`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/studio-live-devices.cjs`](../../apps/web/tests/studio-live-devices.cjs).

### apps/web/lib/studio-image-transform.ts

[`apps/web/lib/studio-image-transform.ts`](../../apps/web/lib/studio-image-transform.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `participantStudioImageTransform`, `applyStudioImageTransform`, `setStudioImagePreview`, `studioImagePreview`, `subscribeStudioImagePreview`.

Читает/импортирует: [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts).

Используют: [`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx), [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts), [`apps/web/tests/slot-output-media.cjs`](../../apps/web/tests/slot-output-media.cjs), [`apps/web/tests/studio-image-transform.cjs`](../../apps/web/tests/studio-image-transform.cjs).

### apps/web/lib/studio-outbound-stats.ts

[`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts)

Нормализация и выбор свежей статистики исходящего Studio Return.

Экспортируемые символы: `StudioOutboundMetrics`, `StudioOutboundSample`, `StudioOutboundView`, `StudioGraphSource`, `StudioGraphSourceMode`, `selectStudioGraphSource`, `createStudioOutboundSample`, `selectStudioOutboundView`, `receiveStudioActual`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/studio-sender-stats.ts`](../../apps/web/lib/studio-sender-stats.ts), [`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts), [`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs), [`apps/web/tests/studio-outbound-poll.cjs`](../../apps/web/tests/studio-outbound-poll.cjs), [`apps/web/tests/studio-outbound-stats.cjs`](../../apps/web/tests/studio-outbound-stats.cjs), [`apps/web/tests/studio-watch-stats.cjs`](../../apps/web/tests/studio-watch-stats.cjs).

### apps/web/lib/studio-output-source.ts

[`apps/web/lib/studio-output-source.ts`](../../apps/web/lib/studio-output-source.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StudioVideoSource`, `studioCaptureConstraints`, `createBlackStudioVideo`, `connectStudioOutputAudio`.

Читает/импортирует: [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/studio-output-source.cjs`](../../apps/web/tests/studio-output-source.cjs).

### apps/web/lib/studio-owner-access.ts

[`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts)

Scoped доступ владельца Studio; legacy пароль разрешён только для default Studio, не платформы.

Экспортируемые символы: `newStudioOwnerInvite`, `validStudioOwnerInvite`, `isStudioOwner`, `studioOwnerSessionExpiresAt`, `setStudioOwnerCookie`, `clearStudioOwnerCookie`, `revokeStudioOwnerAccess`, `studioOwnerLifetimeSeconds`, `studioOwnerTransferVersion`, `studioOwnerTransferVersionCurrent`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/health/route.ts`](../../apps/web/app/api/health/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/guest-admission.ts`](../../apps/web/lib/guest-admission.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/studio-owner-access-postgres.cjs`](../../apps/web/tests/studio-owner-access-postgres.cjs), [`apps/web/tests/transfer-owner-session.cjs`](../../apps/web/tests/transfer-owner-session.cjs).

Переменные окружения (только имена): `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/lib/studio-playback-layout.ts

[`apps/web/lib/studio-playback-layout.ts`](../../apps/web/lib/studio-playback-layout.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `STUDIO_PLAYBACK_TITLE`, `useStudioPlaybackLayout`.

Библиотеки/Node: `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx).

### apps/web/lib/studio-room-lifecycle.ts

[`apps/web/lib/studio-room-lifecycle.ts`](../../apps/web/lib/studio-room-lifecycle.ts)

Подписки на события жизненного цикла комнаты и их симметричная очистка.

Экспортируемые символы: `StudioRoomLifecycleHandlers`, `bindStudioRoomLifecycle`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/lib/studio-scope.ts

[`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts)

Валидация studioId и namespace реального LiveKit room name.

Экспортируемые символы: `defaultStudioId`, `validateStudioId`, `requestedStudioId`, `mediaRoomName`.

Библиотеки/Node: `next/server`, `node:crypto`.

Используют: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/caster-slot-output/route.ts`](../../apps/web/app/api/caster-slot-output/route.ts), [`apps/web/app/api/caster-slots/route.ts`](../../apps/web/app/api/caster-slots/route.ts), [`apps/web/app/api/co-presentation-helper/route.ts`](../../apps/web/app/api/co-presentation-helper/route.ts), [`apps/web/app/api/co-presentations/route.ts`](../../apps/web/app/api/co-presentations/route.ts), [`apps/web/app/api/guest-admission/route.ts`](../../apps/web/app/api/guest-admission/route.ts), [`apps/web/app/api/guest-command/route.ts`](../../apps/web/app/api/guest-command/route.ts), [`apps/web/app/api/guest-device-control/route.ts`](../../apps/web/app/api/guest-device-control/route.ts), [`apps/web/app/api/guest-media-control/route.ts`](../../apps/web/app/api/guest-media-control/route.ts), [`apps/web/app/api/health/route.ts`](../../apps/web/app/api/health/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/license-status/route.ts`](../../apps/web/app/api/license-status/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/move-guest/route.ts`](../../apps/web/app/api/move-guest/route.ts), [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/app/api/participant-role/route.ts`](../../apps/web/app/api/participant-role/route.ts), [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/presentation-file/route.ts`](../../apps/web/app/api/presentation-file/route.ts), [`apps/web/app/api/room-chat/route.ts`](../../apps/web/app/api/room-chat/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/app/api/studio-route/route.ts`](../../apps/web/app/api/studio-route/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/app/v1/control/studio-transfer/route.ts`](../../apps/web/app/v1/control/studio-transfer/route.ts), [`apps/web/app/v1/control/studio/route.ts`](../../apps/web/app/v1/control/studio/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/caster-slot-service.ts`](../../apps/web/lib/caster-slot-service.ts), [`apps/web/lib/caster-slot-store.ts`](../../apps/web/lib/caster-slot-store.ts), [`apps/web/lib/co-presentation-access.ts`](../../apps/web/lib/co-presentation-access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/multiview-store.ts`](../../apps/web/lib/multiview-store.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/optional/presentation-control-handler.ts`](../../apps/web/lib/optional/presentation-control-handler.ts), [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/multitenant-room-isolation.cjs`](../../apps/web/tests/multitenant-room-isolation.cjs), [`apps/web/tests/studio-access-isolation.cjs`](../../apps/web/tests/studio-access-isolation.cjs).

Переменные окружения (только имена): `STUDIOLINK_DEFAULT_STUDIO_ID`.

### apps/web/lib/studio-sender-stats.ts

[`apps/web/lib/studio-sender-stats.ts`](../../apps/web/lib/studio-sender-stats.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `StudioSenderStatsState`, `createStudioSenderStatsState`, `sampleStudioSenderStats`.

Читает/импортирует: [`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts).

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/guest-camera-outbound.ts`](../../apps/web/lib/guest-camera-outbound.ts), [`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts), [`apps/web/tests/studio-outbound-poll.cjs`](../../apps/web/tests/studio-outbound-poll.cjs), [`apps/web/tests/studio-sender-stats.cjs`](../../apps/web/tests/studio-sender-stats.cjs).

### apps/web/lib/studio-stream-relay.ts

[`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts)

Отдельная публикация Studio Return для /watch; не замена индивидуальным guest outputs.

Экспортируемые символы: `useStudioStreamRelay`.

Читает/импортирует: [`apps/web/lib/livekit-url.ts`](../../apps/web/lib/livekit-url.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/studio-sender-stats.ts`](../../apps/web/lib/studio-sender-stats.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/lib/studio-video-recovery.ts

[`apps/web/lib/studio-video-recovery.ts`](../../apps/web/lib/studio-video-recovery.ts)

Восстановление видео Studio после остановки/замены трека и сетевых событий.

Экспортируемые символы: `watchStudioVideo`.

Читает/импортирует: [`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts).

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/tests/studio-video-recovery.cjs`](../../apps/web/tests/studio-video-recovery.cjs).

### apps/web/lib/studio-viewer-access.ts

[`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `studioViewerVersion`, `studioViewingRoom`, `verifiedStudioViewerInvite`, `issueTransferredViewerInvite`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs), [`apps/web/tests/studio-viewer-access.cjs`](../../apps/web/tests/studio-viewer-access.cjs), [`apps/web/tests/studio-viewer-api.cjs`](../../apps/web/tests/studio-viewer-api.cjs).

### apps/web/lib/super-admin-access.ts

[`apps/web/lib/super-admin-access.ts`](../../apps/web/lib/super-admin-access.ts)

Отдельная opaque platform-сессия и cookie, делегирование, logout/revoke без Studio bootstrap.

Экспортируемые символы: `isSuperAdmin`, `newSuperAdminInvite`, `acceptSuperAdminInvite`, `setSuperAdminCookie`, `clearSuperAdminCookie`, `logoutSuperAdmin`, `revokeSuperAdminAccess`, `superAdminLifetimeSeconds`.

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/servers/route.ts`](../../apps/web/app/api/servers/route.ts), [`apps/web/app/api/studio-access/route.ts`](../../apps/web/app/api/studio-access/route.ts), [`apps/web/app/api/studios/route.ts`](../../apps/web/app/api/studios/route.ts), [`apps/web/app/api/super-admin-access/route.ts`](../../apps/web/app/api/super-admin-access/route.ts), [`apps/web/app/api/super-admin/history/route.ts`](../../apps/web/app/api/super-admin/history/route.ts), [`apps/web/app/api/super-admin/route.ts`](../../apps/web/app/api/super-admin/route.ts).

### apps/web/lib/talkback-policy.ts

[`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts)

Политика адресатов служебного звука, разрешения подписки и проверка управляющих сообщений.

Экспортируемые символы: `TALK_TO_ROOM`, `TalkbackTarget`, `TrackSubscriptionPermission`, `talkbackPermissions`, `isVerifiedTalkback`, `GuestMediaCommand`, `parseGuestMediaCommand`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/tests/conference-audio-policy.cjs`](../../apps/web/tests/conference-audio-policy.cjs), [`apps/web/tests/private-talkback-controls.cjs`](../../apps/web/tests/private-talkback-controls.cjs), [`apps/web/tests/talkback-policy.cjs`](../../apps/web/tests/talkback-policy.cjs).

### apps/web/lib/talkback-session.ts

[`apps/web/lib/talkback-session.ts`](../../apps/web/lib/talkback-session.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `PRIVATE_TALKBACK_LEASE_MS`, `PrivateTalkbackSession`, `privateTalkbackSessions`, `serializeTalkback`, `privateTalkbackForGuest`, `loadPrivateTalkbackSessions`, `savePrivateTalkbackSessions`, `rememberPrivateTalkbackMute`, `beginPrivateTalkbackReply`, `endPrivateTalkbackReply`, `closePrivateTalkbackSession`.

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Библиотеки/Node: `livekit-server-sdk`.

Используют: [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/telemetry-archives.ts

[`apps/web/lib/telemetry-archives.ts`](../../apps/web/lib/telemetry-archives.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `STATS_HOUR`, `TelemetryHour`, `statsRetentionDays`, `statsMaxBytes`, `historyEnd`, `telemetryHours`, `archiveTelemetryHour`, `openTelemetryHour`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`, `node:readline`, `node:util`, `node:zlib`.

Используют: [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts), [`apps/web/tests/telemetry-archives.cjs`](../../apps/web/tests/telemetry-archives.cjs).

Переменные окружения (только имена): `STUDIOLINK_STATS_MAX_BYTES`, `STUDIOLINK_STATS_RETENTION_DAYS`.

### apps/web/lib/telemetry-context.ts

[`apps/web/lib/telemetry-context.ts`](../../apps/web/lib/telemetry-context.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `telemetryContext`.

Используют: [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/tests/rtc-telemetry-audio.cjs`](../../apps/web/tests/rtc-telemetry-audio.cjs), [`apps/web/tests/telemetry-scope.cjs`](../../apps/web/tests/telemetry-scope.cjs).

### apps/web/lib/telemetry-store.ts

[`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts)

JSONL-хранилище измерений, retention/size limits, фильтры и агрегирование истории.

Экспортируемые символы: `cleanupStats`, `saveSample`, `clearDisconnected`, `readHistory`, `readAudioHistory`.

Читает/импортирует: [`apps/web/lib/audio-diagnostics.ts`](../../apps/web/lib/audio-diagnostics.ts), [`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts), [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/telemetry-archives.ts`](../../apps/web/lib/telemetry-archives.ts), [`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`, `node:readline`.

Используют: [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/tests/audio-diagnostics.cjs`](../../apps/web/tests/audio-diagnostics.cjs), [`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs), [`apps/web/tests/stats-multi-client.cjs`](../../apps/web/tests/stats-multi-client.cjs), [`apps/web/tests/telemetry-archives.cjs`](../../apps/web/tests/telemetry-archives.cjs), [`apps/web/tests/telemetry.cjs`](../../apps/web/tests/telemetry.cjs).

### apps/web/lib/telemetry-types.ts

[`apps/web/lib/telemetry-types.ts`](../../apps/web/lib/telemetry-types.ts)

Типы RTC samples/history/streams и правила суммирования/средних.

Экспортируемые символы: `StreamStat`, `AudioReceiveDiagnostic`, `AudioPlaybackDiagnostic`, `AudioHistorySummary`, `AudioHistoryResponse`, `TelemetryRole`, `TelemetrySample`, `MetricPoint`, `ConnectionHistory`, `HistoryResponse`, `sumRates`, `mean`.

Используют: [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx), [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/lib/audio-diagnostics.ts`](../../apps/web/lib/audio-diagnostics.ts), [`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts), [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/node-topology.ts`](../../apps/web/lib/node-topology.ts), [`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts), [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts), [`apps/web/lib/stats-report.ts`](../../apps/web/lib/stats-report.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

### apps/web/lib/tenant-scope.ts

[`apps/web/lib/tenant-scope.ts`](../../apps/web/lib/tenant-scope.ts)

Проверка и сравнение organization/studio/room scope, составные ключи.

Экспортируемые символы: `TenantScope`, `validateTenantScope`, `tenantKey`, `sameStudio`, `sameRoom`.

Используют: [`apps/web/tests/tenant-scope.cjs`](../../apps/web/tests/tenant-scope.cjs).

### apps/web/lib/transfer-authority.ts

[`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `roomTransferId`, `roomTransferCredentialVersion`, `verifiedTransferAuthority`, `targetModeratorCredentialVersion`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts).

Библиотеки/Node: `next/server`.

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts).

### apps/web/lib/transfer-origin.ts

[`apps/web/lib/transfer-origin.ts`](../../apps/web/lib/transfer-origin.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `parseTransferOrigin`.

Используют: [`apps/web/lib/client-reserve.ts`](../../apps/web/lib/client-reserve.ts), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts).

### apps/web/lib/transfer-peer.ts

[`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `RoomTransferTarget`, `roomTransferTargets`, `transferIdentity`, `transferHealthIdentity`, `targetRequest`, `sendPeerBridge`, `verifyPeerBridge`.

Читает/импортирует: [`apps/web/lib/server-peer-request.ts`](../../apps/web/lib/server-peer-request.ts), [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts).

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/lib/reserve-health.ts`](../../apps/web/lib/reserve-health.ts), [`apps/web/lib/reserve-heartbeat-worker.ts`](../../apps/web/lib/reserve-heartbeat-worker.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs), [`apps/web/tests/transfer-health-identity.cjs`](../../apps/web/tests/transfer-health-identity.cjs).

Переменные окружения (только имена): `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_TRANSFER_ORIGIN`, `STUDIOLINK_TRANSFER_SERVER_ID`, `STUDIOLINK_TRANSFER_SERVER_LABEL`.

### apps/web/lib/transfer-room.ts

[`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `transferLiveKitReady`, `transferNodeAdmissionReady`, `installTransferredRoom`, `releaseTransferredReservation`, `transferredRoomStageReady`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/node-admission.ts`](../../apps/web/lib/node-admission.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `livekit-server-sdk`, `node:crypto`.

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/lib/reserve-heartbeat-worker.ts`](../../apps/web/lib/reserve-heartbeat-worker.ts), [`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs), [`apps/web/tests/server-reserve-outbound-lifecycle.cjs`](../../apps/web/tests/server-reserve-outbound-lifecycle.cjs), [`apps/web/tests/server-reserve-roundtrip.cjs`](../../apps/web/tests/server-reserve-roundtrip.cjs), [`apps/web/tests/transfer-node-admission.cjs`](../../apps/web/tests/transfer-node-admission.cjs).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/transfer-sessions.ts

[`apps/web/lib/transfer-sessions.ts`](../../apps/web/lib/transfer-sessions.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `transferSessionKey`, `storedAuthorityCurrent`, `ownTransferSession`, `captureReserveSessions`.

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts), [`apps/web/lib/transfer-authority.ts`](../../apps/web/lib/transfer-authority.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`.

Используют: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts).

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### apps/web/lib/update-maintenance.ts

[`apps/web/lib/update-maintenance.ts`](../../apps/web/lib/update-maintenance.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `maintenanceResponse`.

Библиотеки/Node: `node:fs`.

Используют: [`apps/web/app/api/presentation-file/route.ts`](../../apps/web/app/api/presentation-file/route.ts), [`apps/web/middleware.ts`](../../apps/web/middleware.ts), [`apps/web/tests/update-maintenance.cjs`](../../apps/web/tests/update-maintenance.cjs).

### apps/web/lib/use-persistent-room-chat.ts

[`apps/web/lib/use-persistent-room-chat.ts`](../../apps/web/lib/use-persistent-room-chat.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `RoomChatSession`, `usePersistentRoomChat`.

Читает/импортирует: [`apps/web/lib/room-chat-client.ts`](../../apps/web/lib/room-chat-client.ts), [`apps/web/lib/room-chat-types.ts`](../../apps/web/lib/room-chat-types.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/components/RoomChat.tsx`](../../apps/web/components/RoomChat.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/lib/use-staff-room-chat.ts`](../../apps/web/lib/use-staff-room-chat.ts).

### apps/web/lib/use-room-chat-bearer.ts

[`apps/web/lib/use-room-chat-bearer.ts`](../../apps/web/lib/use-room-chat-bearer.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `useRoomChatBearer`.

Библиотеки/Node: `react`.

Используют: [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/lib/use-session-transfer.ts

[`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `useSessionTransfer`, `reserveStatusText`, `reserveAutomaticStatusText`, `guestReserveStatusText`.

Читает/импортирует: [`apps/web/lib/client-reserve.ts`](../../apps/web/lib/client-reserve.ts), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts).

Библиотеки/Node: `react`.

Используют: [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/EmergencyReservePanel.tsx`](../../apps/web/components/EmergencyReservePanel.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/tests/session-transfer-hook.cjs`](../../apps/web/tests/session-transfer-hook.cjs), [`apps/web/tests/session-transfer-renewal.cjs`](../../apps/web/tests/session-transfer-renewal.cjs).

### apps/web/lib/use-staff-room-chat.ts

[`apps/web/lib/use-staff-room-chat.ts`](../../apps/web/lib/use-staff-room-chat.ts)

Модуль приложения; публичные символы и прямые зависимости перечислены ниже.

Экспортируемые символы: `useStaffRoomChat`, `StaffRoomChat`.

Читает/импортирует: [`apps/web/lib/staff-chat-state.ts`](../../apps/web/lib/staff-chat-state.ts), [`apps/web/lib/use-persistent-room-chat.ts`](../../apps/web/lib/use-persistent-room-chat.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

Используют: [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StaffChatPanel.tsx`](../../apps/web/components/StaffChatPanel.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx).

### apps/web/lib/video-fit.ts

[`apps/web/lib/video-fit.ts`](../../apps/web/lib/video-fit.ts)

Расчёт максимального вписывания native кадра после поворота и применение размеров к video.

Экспортируемые символы: `videoFitGeometry`, `applyContainedVideoFit`.

Используют: [`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts), [`apps/web/tests/feedback-media.cjs`](../../apps/web/tests/feedback-media.cjs), [`apps/web/tests/slot-output-media.cjs`](../../apps/web/tests/slot-output-media.cjs).

### apps/web/lib/video-quality.ts

[`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts)

FPS/bitrate ranges, capture/publish options, суммарный бюджет RTP encodings и default guest cap.

Экспортируемые символы: `STUDIO_FRAME_RATES`, `StudioFrameRate`, `MIN_STUDIO_VIDEO_BITRATE_KBPS`, `MAX_STUDIO_VIDEO_BITRATE_KBPS`, `DEFAULT_STUDIO_VIDEO_BITRATE_KBPS`, `VIDEO_BITRATES_KBPS`, `STUDIO_VIDEO_BITRATES_KBPS`, `STUDIO_VIDEO_CODECS`, `StudioVideoCodec`, `DEFAULT_STUDIO_VIDEO_CODEC`, `MAX_GUEST_VIDEO_BITRATE`, `isValidStudioVideoBitrateKbps`, `isValidGuestVideoBitrateKbps`, `isStudioVideoCodec`, `defaultGuestVideoCodec`, `videoBitrateOptions`, `studioVideoBitrateOptions`, `assertStudioVideoCodecSupported`, `assertPublishedStudioVideoCodec`, `studioVideoConstraints`, `studioVideoPublishOptions`, `capStudioVideoEncodings`, `studioVideoEncodingsMatch`, `applyStudioSenderQuality`, `DEFAULT_GUEST_VIDEO_BITRATE_KBPS`, `guestVideoBitrate`, `guestCameraHeight`.

Библиотеки/Node: `livekit-client`.

Используют: [`apps/web/components/GuestCameraResolutionControl.tsx`](../../apps/web/components/GuestCameraResolutionControl.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx), [`apps/web/components/StudioVideoModeControls.tsx`](../../apps/web/components/StudioVideoModeControls.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-video-bitrate.ts`](../../apps/web/lib/guest-video-bitrate.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-output-source.ts`](../../apps/web/lib/studio-output-source.ts), [`apps/web/lib/studio-stream-relay.ts`](../../apps/web/lib/studio-stream-relay.ts), [`apps/web/tests/feedback-media.cjs`](../../apps/web/tests/feedback-media.cjs), [`apps/web/tests/guest-camera-capture.cjs`](../../apps/web/tests/guest-camera-capture.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs), [`apps/web/tests/video-quality-vp9.cjs`](../../apps/web/tests/video-quality-vp9.cjs), [`apps/web/tests/video-quality.cjs`](../../apps/web/tests/video-quality.cjs).

### apps/web/lib/video-rotation.ts

[`apps/web/lib/video-rotation.ts`](../../apps/web/lib/video-rotation.ts)

React-жизненный цикл поворота: metadata и resize → геометрия native кадра.

Экспортируемые символы: `participantRotation`, `useVideoRotation`.

Читает/импортирует: [`apps/web/lib/studio-image-transform.ts`](../../apps/web/lib/studio-image-transform.ts), [`apps/web/lib/video-fit.ts`](../../apps/web/lib/video-fit.ts).

Библиотеки/Node: `livekit-client`, `react`.

Используют: [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx), [`apps/web/components/RemoteVideoPreview.tsx`](../../apps/web/components/RemoteVideoPreview.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx).

### apps/web/lib/watch-subscriptions.ts

[`apps/web/lib/watch-subscriptions.ts`](../../apps/web/lib/watch-subscriptions.ts)

Фильтрация технических /watch подписок и защита от устаревшего намерения playback.

Экспортируемые символы: `WatchTrackKind`, `shouldSubscribeToWatchTrack`, `PlaybackIntent`, `togglePlaybackIntent`, `isPlaybackIntentCurrent`.

Используют: [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/tests/watch-subscriptions.cjs`](../../apps/web/tests/watch-subscriptions.cjs).

## apps/web/middleware.ts · 1 файлов

### apps/web/middleware.ts

[`apps/web/middleware.ts`](../../apps/web/middleware.ts)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `middleware`, `config`.

Читает/импортирует: [`apps/web/lib/update-maintenance.ts`](../../apps/web/lib/update-maintenance.ts).

Библиотеки/Node: `next/server`.

## apps/web/next.config.ts · 1 файлов

### apps/web/next.config.ts

[`apps/web/next.config.ts`](../../apps/web/next.config.ts)

Версия/build ID, headers безопасности, параметры сборки Next.js.

Библиотеки/Node: `next`, `node:crypto`, `node:fs`, `node:url`.

Переменные окружения (только имена): `CASTLINK_PRODUCT_BUILD_NUMBER`, `CASTLINK_PRODUCT_VERSION`, `NEXT_BUILD_DIR`, `STUDIOLINK_RELEASE`.

## apps/web/package.json · 1 файлов

### apps/web/package.json

[`apps/web/package.json`](../../apps/web/package.json)

Зависимости и команды конкретного подпроекта.

Используют: [`apps/web/tests/version-api.cjs`](../../apps/web/tests/version-api.cjs).

## apps/web/public · 24 файлов

### apps/web/public/emoticons/angel.svg

[`apps/web/public/emoticons/angel.svg`](../../apps/web/public/emoticons/angel.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/angry.svg

[`apps/web/public/emoticons/angry.svg`](../../apps/web/public/emoticons/angry.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/blush.svg

[`apps/web/public/emoticons/blush.svg`](../../apps/web/public/emoticons/blush.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/clap.svg

[`apps/web/public/emoticons/clap.svg`](../../apps/web/public/emoticons/clap.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/confused.svg

[`apps/web/public/emoticons/confused.svg`](../../apps/web/public/emoticons/confused.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/cool.svg

[`apps/web/public/emoticons/cool.svg`](../../apps/web/public/emoticons/cool.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/cry.svg

[`apps/web/public/emoticons/cry.svg`](../../apps/web/public/emoticons/cry.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/devil.svg

[`apps/web/public/emoticons/devil.svg`](../../apps/web/public/emoticons/devil.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/flower.svg

[`apps/web/public/emoticons/flower.svg`](../../apps/web/public/emoticons/flower.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/heart.svg

[`apps/web/public/emoticons/heart.svg`](../../apps/web/public/emoticons/heart.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/hello.svg

[`apps/web/public/emoticons/hello.svg`](../../apps/web/public/emoticons/hello.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/kiss.svg

[`apps/web/public/emoticons/kiss.svg`](../../apps/web/public/emoticons/kiss.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/laugh.svg

[`apps/web/public/emoticons/laugh.svg`](../../apps/web/public/emoticons/laugh.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/like.svg

[`apps/web/public/emoticons/like.svg`](../../apps/web/public/emoticons/like.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/sad.svg

[`apps/web/public/emoticons/sad.svg`](../../apps/web/public/emoticons/sad.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/sick.svg

[`apps/web/public/emoticons/sick.svg`](../../apps/web/public/emoticons/sick.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/skeptic.svg

[`apps/web/public/emoticons/skeptic.svg`](../../apps/web/public/emoticons/skeptic.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/sleep.svg

[`apps/web/public/emoticons/sleep.svg`](../../apps/web/public/emoticons/sleep.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/smile.svg

[`apps/web/public/emoticons/smile.svg`](../../apps/web/public/emoticons/smile.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/surprise.svg

[`apps/web/public/emoticons/surprise.svg`](../../apps/web/public/emoticons/surprise.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/think.svg

[`apps/web/public/emoticons/think.svg`](../../apps/web/public/emoticons/think.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/tongue.svg

[`apps/web/public/emoticons/tongue.svg`](../../apps/web/public/emoticons/tongue.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/wink.svg

[`apps/web/public/emoticons/wink.svg`](../../apps/web/public/emoticons/wink.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### apps/web/public/emoticons/yawn.svg

[`apps/web/public/emoticons/yawn.svg`](../../apps/web/public/emoticons/yawn.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

## apps/web/scripts · 1 файлов

### apps/web/scripts/prepare-pdf-assets.mjs

[`apps/web/scripts/prepare-pdf-assets.mjs`](../../apps/web/scripts/prepare-pdf-assets.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Экспортируемые символы: `removePresentationAssets`, `preparePdfAssets`.

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`, `node:url`.

Используют: [`scripts/prepare-web-runtime.mjs`](../../scripts/prepare-web-runtime.mjs), [`scripts/tests/prepare-web-runtime.test.mjs`](../../scripts/tests/prepare-web-runtime.test.mjs).

## apps/web/tests · 375 файлов

### apps/web/tests/access-secrets.cjs

[`apps/web/tests/access-secrets.cjs`](../../apps/web/tests/access-secrets.cjs)

Проверка/тестовый инструмент. PASS: dedicated session/data secrets with legacy migration fallback

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `CASTLINK_DATA_ENCRYPTION_KEY`, `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`.

### apps/web/tests/admin-access-api.cjs

[`apps/web/tests/admin-access-api.cjs`](../../apps/web/tests/admin-access-api.cjs)

Проверка/тестовый инструмент. PASS: room-admin invitation/revocation, room-scoped APIs, non-publishing token, primary lease and participant safety

Библиотеки/Node: `node:assert/strict`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_STUDIO_PASSWORD`.

### apps/web/tests/admin-ui.cjs

[`apps/web/tests/admin-ui.cjs`](../../apps/web/tests/admin-ui.cjs)

Проверка/тестовый инструмент. Admin UI receive-only and invite safeguards passed

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/app-update-api.cjs

[`apps/web/tests/app-update-api.cjs`](../../apps/web/tests/app-update-api.cjs)

Проверка/тестовый инструмент. PASS: API/build/client version agreement, uncached API and HTML, output/monitor exclusion

Читает/импортирует: [`package.json`](../../package.json).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_BUILD_DIR`.

### apps/web/tests/app-update-notice.cjs

[`apps/web/tests/app-update-notice.cjs`](../../apps/web/tests/app-update-notice.cjs)

Проверка/тестовый инструмент. PASS: background detection without reload, explicit refresh, offline handling, output exclusion, listener cleanup

Читает/импортирует: [`apps/web/components/AppUpdateNotice.tsx`](../../apps/web/components/AppUpdateNotice.tsx), [`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `NEXT_PUBLIC_APP_VERSION`.

### apps/web/tests/app-update.cjs

[`apps/web/tests/app-update.cjs`](../../apps/web/tests/app-update.cjs)

Проверка/тестовый инструмент. PASS: current/new/rollback releases, invalid API responses, cache busting with preserved room URL

Читает/импортирует: [`apps/web/lib/app-update.ts`](../../apps/web/lib/app-update.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/audio-device-check.cjs

[`apps/web/tests/audio-device-check.cjs`](../../apps/web/tests/audio-device-check.cjs)

Проверка/тестовый инструмент. PASS: PCM silence clears in one tick, quiet signals/attack/time release, mute/end behavior, frame/listener/context disposal without remote track stop, chosen speaker sink/tone duration, no default-output leakage, cancel during sink setup, routing/autoplay errors and unsupported output cleanup

Читает/импортирует: [`apps/web/lib/audio-device-test.ts`](../../apps/web/lib/audio-device-test.ts), [`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/audio-diagnostics.cjs

[`apps/web/tests/audio-diagnostics.cjs`](../../apps/web/tests/audio-diagnostics.cjs)

Проверка/тестовый инструмент. PASS: audio interval deltas/resets, concealment denominator, jitter buffer units, unsupported records, scoped byte-cursor pagination, exact UTC CSV, reset preserves history, summaries, node relay, API tenant/room/role/recreated-scope isolation, sanitized ingestion

Читает/импортирует: [`apps/web/lib/audio-diagnostics.ts`](../../apps/web/lib/audio-diagnostics.ts), [`apps/web/lib/node-history.ts`](../../apps/web/lib/node-history.ts), [`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:vm`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STATS_DIR`.

### apps/web/tests/audio-output-switch.cjs

[`apps/web/tests/audio-output-switch.cjs`](../../apps/web/tests/audio-output-switch.cjs)

Проверка/тестовый инструмент. PASS: installed SDK asynchronous reattach RED regression, bounded interrupted-switch recovery with actual sink and SDK state confirmation, multiple-remote verification, latest routing, monitor volume retained, persistent AbortError/permission/mismatched-sink failures visible, detached cleanup and explicit default

Читает/импортирует: [`apps/web/components/AudioOutputSelect.tsx`](../../apps/web/components/AudioOutputSelect.tsx), [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/lib/audio-output.ts`](../../apps/web/lib/audio-output.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `node:vm`, `typescript`.

### apps/web/tests/caster-feedback.browser.cjs

[`apps/web/tests/caster-feedback.browser.cjs`](../../apps/web/tests/caster-feedback.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:path`, `react`, `react-dom/client`.

Переменные окружения (только имена): `NODE_ENV`.

### apps/web/tests/caster-invite-delete-ui.cjs

[`apps/web/tests/caster-invite-delete-ui.cjs`](../../apps/web/tests/caster-invite-delete-ui.cjs)

Проверка/тестовый инструмент. PASS invitation delete UI: standalone only, cancel, scoped request, duplicate guard and busy state

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `react`.

### apps/web/tests/caster-invite-delete.cjs

[`apps/web/tests/caster-invite-delete.cjs`](../../apps/web/tests/caster-invite-delete.cjs)

Проверка/тестовый инструмент. PASS standalone invitation deletion: scope, authorization, CSRF, transactional binding race, permanent outputs and signed-link revocation

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/caster-slot-assignment.cjs

[`apps/web/tests/caster-slot-assignment.cjs`](../../apps/web/tests/caster-slot-assignment.cjs)

Проверка/тестовый инструмент. PASS routing only: assign/move/replace, authenticated reconnect, release/CAS and bounded history

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/caster-slot-reconnect.cjs

[`apps/web/tests/caster-slot-reconnect.cjs`](../../apps/web/tests/caster-slot-reconnect.cjs)

Проверка/тестовый инструмент. PASS ordinary/private invitation reentry restores slot output, stable URLs, stale callback and generation isolation

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/caster-slot-store.cjs

[`apps/web/tests/caster-slot-store.cjs`](../../apps/web/tests/caster-slot-store.cjs)

Проверка/тестовый инструмент. PASS persistent slots: rename/rebind stable output, scope/source isolation, CAS, restart, explicit rotation and delete

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/caster-slots-ui.cjs

[`apps/web/tests/caster-slots-ui.cjs`](../../apps/web/tests/caster-slots-ui.cjs)

Проверка/тестовый инструмент. PASS slot panel: accessible creation and waiting queue

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `react`, `react-dom/server`.

### apps/web/tests/caster-workspace-layout.cjs

[`apps/web/tests/caster-workspace-layout.cjs`](../../apps/web/tests/caster-workspace-layout.cjs)

Проверка/тестовый инструмент. PASS caster optional chat opens/closes, mounted More sharing, and existing footer controls; PASS allowed camera/screen sources, stable mounted self key, hidden layout count and studio waiting

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `react`, `react-dom/server`.

### apps/web/tests/client-reserve-automatic.cjs

[`apps/web/tests/client-reserve-automatic.cjs`](../../apps/web/tests/client-reserve-automatic.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/lib/client-reserve.ts`](../../apps/web/lib/client-reserve.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:test`, `typescript`.

### apps/web/tests/client-reserve-races.cjs

[`apps/web/tests/client-reserve-races.cjs`](../../apps/web/tests/client-reserve-races.cjs)

Проверка/тестовый инструмент. PASS: delayed preparation cannot undo disarm/rearm, revisions stay monotonic, stale status cannot undo activation and disposed clients cannot hand off

Читает/импортирует: [`apps/web/lib/client-reserve.ts`](../../apps/web/lib/client-reserve.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/client-reserve.browser.cjs

[`apps/web/tests/client-reserve.browser.cjs`](../../apps/web/tests/client-reserve.browser.cjs)

Проверка/тестовый инструмент. PASS: Chromium exact CORS/bearer transport omits both servers cookies; offline source stays manual; duplicate click and lost response converge; readiness expires

Читает/импортирует: [`apps/web/tests/client-reserve.cjs`](../../apps/web/tests/client-reserve.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `node:path`, `playwright`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM`.

### apps/web/tests/client-reserve.cjs

[`apps/web/tests/client-reserve.cjs`](../../apps/web/tests/client-reserve.cjs)

Проверка/тестовый инструмент. PASS: manual-only activation, cached grant during source outage, bearer-only polling, lost response recovery and bounded readiness

Читает/импортирует: [`apps/web/lib/client-reserve.ts`](../../apps/web/lib/client-reserve.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Используют: [`apps/web/tests/client-reserve.browser.cjs`](../../apps/web/tests/client-reserve.browser.cjs).

### apps/web/tests/client-transfer.cjs

[`apps/web/tests/client-transfer.cjs`](../../apps/web/tests/client-transfer.cjs)

Проверка/тестовый инструмент. PASS: authenticated origins, verified four-role handoff, root creator route and primary identity storage; PASS: read-only viewer handoff preserves mute/video choices and stores only verified target invite

Читает/импортирует: [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/co-presentation-acceptance-api.cjs

[`apps/web/tests/co-presentation-acceptance-api.cjs`](../../apps/web/tests/co-presentation-acceptance-api.cjs)

Проверка/тестовый инструмент. PASS recipient pending acceptance, exact grant accept/release, owner navigation, stale SID/replay denial and legacy compatibility

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-acceptance-races.cjs

[`apps/web/tests/co-presentation-acceptance-races.cjs`](../../apps/web/tests/co-presentation-acceptance-races.cjs)

Проверка/тестовый инструмент. PASS actual acceptance callback/effect: one exact automatic RPC, preference hydration/OFF, explicit accept result, decline/newSID stale response and no ambiguous replay

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-acceptance.cjs

[`apps/web/tests/co-presentation-acceptance.cjs`](../../apps/web/tests/co-presentation-acceptance.cjs)

Проверка/тестовый инструмент. PASS recipient preference defaultON/OFF, honest legacy accepted state, exact grant/SID/track acceptance key and pending accept/decline UI

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `react`, `react-dom/server`.

### apps/web/tests/co-presentation-browser-gesture.cjs

[`apps/web/tests/co-presentation-browser-gesture.cjs`](../../apps/web/tests/co-presentation-browser-gesture.cjs)

Проверка/тестовый инструмент. PASS actual browser click: synchronous alternate grant, stale result/scope/revoke, explicit fallback and native route

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-capture.browser.cjs

[`apps/web/tests/co-presentation-capture.browser.cjs`](../../apps/web/tests/co-presentation-capture.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `/capture.mjs`, `/pdf.mjs`, `node:assert/strict`, `node:fs`, `node:http`, `node:path`, `playwright`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`.

### apps/web/tests/co-presentation-capture.cjs

[`apps/web/tests/co-presentation-capture.cjs`](../../apps/web/tests/co-presentation-capture.cjs)

Проверка/тестовый инструмент. PASS silent canvas-only publication, occupied-screen refusal, screen-only stop, SDK unpublish/end cleanup and late-publish cancellation after stop/dispose/disconnect/file change

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-controls.cjs

[`apps/web/tests/co-presentation-controls.cjs`](../../apps/web/tests/co-presentation-controls.cjs)

Проверка/тестовый инструмент. PASS floating slides native/browser contract, hidden-window persistence, exact grant id/local epoch, delegate/reclaim/busy gating, safe DOM, popup bounds and lifecycle cleanup

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/co-presentation-floating-panel.cjs

[`apps/web/tests/co-presentation-floating-panel.cjs`](../../apps/web/tests/co-presentation-floating-panel.cjs)

Проверка/тестовый инструмент. PASS actual floating panel action/state routing: owner delegation/reclaim, exact grant id, rendered page, explicit floating-window opt-in, sanitized titles, auth-loss cleanup and existing API navigation

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-helper-api.cjs

[`apps/web/tests/co-presentation-helper-api.cjs`](../../apps/web/tests/co-presentation-helper-api.cjs)

Проверка/тестовый инструмент. PASS helper route real admission/JWT fixture, explicit owner Origin, scoped native bearer, payload bounds, no arbitrary args

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-helper-client.cjs

[`apps/web/tests/co-presentation-helper-client.cjs`](../../apps/web/tests/co-presentation-helper-client.cjs)

Проверка/тестовый инструмент. PASS virtual browser bridge actual connection, fixed RPC, opaque prepare, no legacy page transport and disposed work rejection

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-helper-dialog.cjs

[`apps/web/tests/co-presentation-helper-dialog.cjs`](../../apps/web/tests/co-presentation-helper-dialog.cjs)

Проверка/тестовый инструмент. PASS helper pairing top-layer lifecycle, connection retry focus, Escape isolation, Close focus and cleanup

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-helper-launch.cjs

[`apps/web/tests/co-presentation-helper-launch.cjs`](../../apps/web/tests/co-presentation-helper-launch.cjs)

Проверка/тестовый инструмент. PASS native protocol frame launch, strict URL/ticket privacy, one bounded frame/timer, exact CSP schemes and no conference top navigation

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-helper-resume.cjs

[`apps/web/tests/co-presentation-helper-resume.cjs`](../../apps/web/tests/co-presentation-helper-resume.cjs)

Проверка/тестовый инструмент. PASS actual helper automatic launch + original connect resume with existing share, no prepare/media stop, no lost-pair relaunch and exact SID

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-helper.cjs

[`apps/web/tests/co-presentation-helper.cjs`](../../apps/web/tests/co-presentation-helper.cjs)

Проверка/тестовый инструмент. PASS helper broker one-use pairing, exact live owner scope, await races, consumed delivery, opaque args/results and unchanged-slide ACK

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-inline-menu.cjs

[`apps/web/tests/co-presentation-inline-menu.cjs`](../../apps/web/tests/co-presentation-inline-menu.cjs)

Проверка/тестовый инструмент. PASS inline presentation entry follows ScreenShare; Co entry follows actual share, preload stays mounted and stopped share hides entry

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `react`, `react-dom/server`, `typescript`.

### apps/web/tests/co-presentation-native-actions.cjs

[`apps/web/tests/co-presentation-native-actions.cjs`](../../apps/web/tests/co-presentation-native-actions.cjs)

Проверка/тестовый инструмент. PASS native PPTX actions: prepare/cancel, explicit start and capture, existing share preserved

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-native-floating.cjs

[`apps/web/tests/co-presentation-native-floating.cjs`](../../apps/web/tests/co-presentation-native-floating.cjs)

Проверка/тестовый инструмент. PASS native exact-grant auto-open, manual hide/reopen, replacement, revoke race and browser fallback

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-native.cjs

[`apps/web/tests/co-presentation-native.cjs`](../../apps/web/tests/co-presentation-native.cjs)

Проверка/тестовый инструмент. PASS native PowerPoint bridge detection, exact scoped slides, verified ACK, manual-slide sync, foreign-deck rejection, and stale/stop cancellation without app or screen-share operations

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-navigation.cjs

[`apps/web/tests/co-presentation-navigation.cjs`](../../apps/web/tests/co-presentation-navigation.cjs)

Проверка/тестовый инструмент. PASS exact current SID recipient screen grant, decoded image/letterbox, focused arrows and single primary image click, no interactive/modifier/repeat input, honest unknown PDF counts

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/co-presentation-panel-lifecycle.cjs

[`apps/web/tests/co-presentation-panel-lifecycle.cjs`](../../apps/web/tests/co-presentation-panel-lifecycle.cjs)

Проверка/тестовый инструмент. PASS actual panel start cancellation after file/disconnect/unmount, stale session revocation, unsupported PPT and late conversion isolation

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-pending-share.cjs

[`apps/web/tests/co-presentation-pending-share.cjs`](../../apps/web/tests/co-presentation-pending-share.cjs)

Проверка/тестовый инструмент. PASS actual pre-owner room event: connect/window/helper pending stop/replacement/mute/newSID cancels once, frees busy, preserves prepared file and media

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-preload.cjs

[`apps/web/tests/co-presentation-preload.cjs`](../../apps/web/tests/co-presentation-preload.cjs)

Проверка/тестовый инструмент. PASS actual preload/delete preserves unrelated share/native authority; conversion races; Show publishes before session, canceled publish no effect

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-recipient.cjs

[`apps/web/tests/co-presentation-recipient.cjs`](../../apps/web/tests/co-presentation-recipient.cjs)

Проверка/тестовый инструмент. PASS recipient SID/owner filter, grant hide/reopen/revoke, rendered pending, actual stale/busy action guards and own-session independence

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `react`, `react-dom/server`, `typescript`.

### apps/web/tests/co-presentation-request.cjs

[`apps/web/tests/co-presentation-request.cjs`](../../apps/web/tests/co-presentation-request.cjs)

Проверка/тестовый инструмент. PASS request cancellation without AbortSignal.any or timeout support

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/co-presentation-screen-binding.cjs

[`apps/web/tests/co-presentation-screen-binding.cjs`](../../apps/web/tests/co-presentation-screen-binding.cjs)

Проверка/тестовый инструмент. PASS actual grant-bound screen publish/action availability: first live track, no replacement inheritance, explicit newgrant, ownerSID change and revoke cleanup

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-size.browser.cjs

[`apps/web/tests/co-presentation-size.browser.cjs`](../../apps/web/tests/co-presentation-size.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/lib/co-presentation-controls.ts`](../../apps/web/lib/co-presentation-controls.ts), [`apps/web/lib/screen-share-stop-panel.ts`](../../apps/web/lib/screen-share-stop-panel.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:path`.

Переменные окружения (только имена): `CASTLINK_QA_HEADED`.

### apps/web/tests/co-presentation-start.browser.cjs

[`apps/web/tests/co-presentation-start.browser.cjs`](../../apps/web/tests/co-presentation-start.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `$1.js`, `(\.\/[^`, `/co-presentation-controls.js`, `node:assert/strict`, `node:fs`, `node:http`, `node:path`, `playwright`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`.

### apps/web/tests/co-presentation-step-controls.cjs

[`apps/web/tests/co-presentation-step-controls.cjs`](../../apps/web/tests/co-presentation-step-controls.cjs)

Проверка/тестовый инструмент. PASS controls support final-slide animation steps while preserving legacy page bounds

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-step-native.cjs

[`apps/web/tests/co-presentation-step-native.cjs`](../../apps/web/tests/co-presentation-step-native.cjs)

Проверка/тестовый инструмент. PASS PPTX adapter: same-slide command ACK, owner manual position authoritative, ACK retry without effect replay, expired command and stop

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-steps.cjs

[`apps/web/tests/co-presentation-steps.cjs`](../../apps/web/tests/co-presentation-steps.cjs)

Проверка/тестовый инструмент. PASS native PPTX step state: same-slide ack, manual movement, no page rollback, TTL/replay, last-slide builds, legacy PDF

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-toolbar-contract.cjs

[`apps/web/tests/co-presentation-toolbar-contract.cjs`](../../apps/web/tests/co-presentation-toolbar-contract.cjs)

Проверка/тестовый инструмент. PASS toolbar v2 strict state/actions, nine-key compatibility, one delegate, independent STOP flight and matching explicit failure acknowledgement

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/co-presentation-toolbar-control-failure.cjs

[`apps/web/tests/co-presentation-toolbar-control-failure.cjs`](../../apps/web/tests/co-presentation-toolbar-control-failure.cjs)

Проверка/тестовый инструмент. PASS actual native owner read/navigation failures: independent STOP retained, remote authority disabled, 401 native grant closed, exact screen/audio stopped and camera/mic preserved

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-toolbar-stop.cjs

[`apps/web/tests/co-presentation-toolbar-stop.cjs`](../../apps/web/tests/co-presentation-toolbar-stop.cjs)

Проверка/тестовый инструмент. PASS actual owner STOP: media first, PDF/screen only, independent pending navigation, failure retry, captured generation/SID and replacement isolation

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-window-frontend.cjs

[`apps/web/tests/co-presentation-window-frontend.cjs`](../../apps/web/tests/co-presentation-window-frontend.cjs)

Проверка/тестовый инструмент. PASS actual focused screen handler, button/chat/padding/no-frame/mute/hidden/revoked guards, window recipient unknowncounts and old native toolbar compatibility

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `react`, `react-dom/server`, `typescript`.

### apps/web/tests/co-presentation-window-helper.cjs

[`apps/web/tests/co-presentation-window-helper.cjs`](../../apps/web/tests/co-presentation-window-helper.cjs)

Проверка/тестовый инструмент. PASS helper window typed transport, no paths/keys/fake counts, unknown-page ACK and consumed native tap

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-window-intent.cjs

[`apps/web/tests/co-presentation-window-intent.cjs`](../../apps/web/tests/co-presentation-window-intent.cjs)

Проверка/тестовый инструмент. PASS actual window prepare/start/grant async intent, host/controller newSID cancellation, local cancel before/after consent and late grant, wrong-kind/old desktop guard

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentation-window.cjs

[`apps/web/tests/co-presentation-window.cjs`](../../apps/web/tests/co-presentation-window.cjs)

Проверка/тестовый инструмент. PASS external window honest unknown pages, exact SID delegation, owner-only ACK, replay and revoke

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/co-presentations.cjs

[`apps/web/tests/co-presentations.cjs`](../../apps/web/tests/co-presentations.cjs)

Проверка/тестовый инструмент. PASS co-presentation regular JWT/live transfer/admission/association auth, exact SID grants, owner-only delegation, immediate revoke, render ACK, replay and recreated room

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/conference-audio-policy.cjs

[`apps/web/tests/conference-audio-policy.cjs`](../../apps/web/tests/conference-audio-policy.cjs)

Проверка/тестовый инструмент. PASS: actual conference AudioTrack JSX excludes forbidden initial/late/mode-change audio before element creation; microphone/screenshare/source coverage and subscription ownership

Читает/импортирует: [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/conference-gallery-layout.cjs

[`apps/web/tests/conference-gallery-layout.cjs`](../../apps/web/tests/conference-gallery-layout.cjs)

Проверка/тестовый инструмент. PASS maximum equal 16:9 gallery size across measured landscape/portrait stages

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/conference-layout-browser.py

[`apps/web/tests/conference-layout-browser.py`](../../apps/web/tests/conference-layout-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/conference-portrait-tiles.cjs

[`apps/web/tests/conference-portrait-tiles.cjs`](../../apps/web/tests/conference-portrait-tiles.cjs)

Проверка/тестовый инструмент. PASS portrait Tiles: two equal 16:9 columns, stable readable size, scroll overflow, unchanged desktop policy

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/conference-responsive.browser.cjs

[`apps/web/tests/conference-responsive.browser.cjs`](../../apps/web/tests/conference-responsive.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Экспортируемые символы: `Track`, `RoomEvent`, `LocalVideoTrack`, `PdfPresentationViewer`, `useI18n`, `translateWorkspaceMessage`, `useRoomContext`, `useEnsureTrackRef`, `useTracks`, `useCreateLayoutContext`, `usePinnedTracks`, `LayoutContextProvider`, `AudioTrack`, `ControlBar`, `ChatToggle`, `ParticipantTile`, `GuestCameraButton`, `RoomChat`, `isVerifiedTalkback`, `exitCssFullscreen`, `toggleElementFullscreen`, `watchFullscreenChrome`.

Библиотеки/Node: `${path.join(source, `, `${path.join(web,`, `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `react`, `react-dom/client`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`, `CASTLINK_QA_ESBUILD`, `CASTLINK_QA_PLAYWRIGHT`, `CASTLINK_QA_SOURCE`.

### apps/web/tests/conference-scene.cjs

[`apps/web/tests/conference-scene.cjs`](../../apps/web/tests/conference-scene.cjs)

Проверка/тестовый инструмент. PASS scene: speaker hysteresis, source priority, local split and proportional gallery; PASS scene rail: compact proportional tiles, independent of roster count, scrolling and resize

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/connection-route.cjs

[`apps/web/tests/connection-route.cjs`](../../apps/web/tests/connection-route.cjs)

Проверка/тестовый инструмент. PASS: guest-only normal/relay routes, credential/options preservation, unavailable status, authorization and cancellation boundaries

Читает/импортирует: [`apps/web/lib/connection-route-config.ts`](../../apps/web/lib/connection-route-config.ts), [`apps/web/lib/connection-route.ts`](../../apps/web/lib/connection-route.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/control-plane-client-remote.cjs

[`apps/web/tests/control-plane-client-remote.cjs`](../../apps/web/tests/control-plane-client-remote.cjs)

Проверка/тестовый инструмент. PASS: remote node reads Studio owner/version route over signed HTTP without control-plane DB access

Читает/импортирует: [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `NODE_ENV`.

### apps/web/tests/control-plane-postgres.cjs

[`apps/web/tests/control-plane-postgres.cjs`](../../apps/web/tests/control-plane-postgres.cjs)

Проверка/тестовый инструмент. PASS: control-plane schema isolates same-name rooms by studio and coexists with node-local storage

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `pg`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/control-plane-register-node.cjs

[`apps/web/tests/control-plane-register-node.cjs`](../../apps/web/tests/control-plane-register-node.cjs)

Проверка/тестовый инструмент. PASS: control-plane node registration is idempotent and updates routing/capacity

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:path`, `pg`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/control-plane-seed.cjs

[`apps/web/tests/control-plane-seed.cjs`](../../apps/web/tests/control-plane-seed.cjs)

Проверка/тестовый инструмент. PASS: existing single-studio node migrates idempotently into default multi-tenant control-plane scope

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `pg`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/control-plane-store.cjs

[`apps/web/tests/control-plane-store.cjs`](../../apps/web/tests/control-plane-store.cjs)

Проверка/тестовый инструмент. PASS: owner control-plane store creates studios, auto-assigns capacity and locks live placement

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DEFAULT_ORGANIZATION_ID`, `TEST_DATABASE_URL`.

### apps/web/tests/control-response.cjs

[`apps/web/tests/control-response.cjs`](../../apps/web/tests/control-response.cjs)

Проверка/тестовый инструмент. PASS: Studio Control response parser handles valid, empty, malformed, non-JSON, and API-error responses

Читает/импортирует: [`apps/web/lib/control-response.ts`](../../apps/web/lib/control-response.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/design-migration.browser.cjs

[`apps/web/tests/design-migration.browser.cjs`](../../apps/web/tests/design-migration.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Экспортируемые символы: `Room`, `useSearchParams`, `useParams`, `usePathname`, `useRouter`.

Читает/импортирует: [`apps/web/app/diagnostics/page.tsx`](../../apps/web/app/diagnostics/page.tsx), [`apps/web/app/error.tsx`](../../apps/web/app/error.tsx), [`apps/web/app/monitor/page.tsx`](../../apps/web/app/monitor/page.tsx), [`apps/web/app/multiview/[sceneId]/page.tsx`](../../apps/web/app/multiview/%5BsceneId%5D/page.tsx), [`apps/web/app/not-found.tsx`](../../apps/web/app/not-found.tsx), [`apps/web/app/output/[identity]/page.tsx`](../../apps/web/app/output/%5Bidentity%5D/page.tsx), [`apps/web/app/servers/page.tsx`](../../apps/web/app/servers/page.tsx), [`apps/web/app/setup/page.tsx`](../../apps/web/app/setup/page.tsx), [`apps/web/app/studios/page.tsx`](../../apps/web/app/studios/page.tsx), [`apps/web/app/super-admin/page.tsx`](../../apps/web/app/super-admin/page.tsx), [`apps/web/app/transfer/page.tsx`](../../apps/web/app/transfer/page.tsx), [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx), [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestRoleOffer.tsx`](../../apps/web/components/GuestRoleOffer.tsx), [`apps/web/components/GuestWorkspace.tsx`](../../apps/web/components/GuestWorkspace.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/HostedAccessGate.tsx`](../../apps/web/components/HostedAccessGate.tsx), [`apps/web/components/PlatformAccessGate.tsx`](../../apps/web/components/PlatformAccessGate.tsx), [`apps/web/components/RoomControlConsole.tsx`](../../apps/web/components/RoomControlConsole.tsx), [`apps/web/components/StudioOwnerGate.tsx`](../../apps/web/components/StudioOwnerGate.tsx), [`apps/web/components/StudioRoomPicker.tsx`](../../apps/web/components/StudioRoomPicker.tsx), [`apps/web/components/StudioWorkspace.tsx`](../../apps/web/components/StudioWorkspace.tsx), [`apps/web/components/multiview/MultiviewEditor.tsx`](../../apps/web/components/multiview/MultiviewEditor.tsx).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`, `path`, `react`, `react-dom/client`.

Переменные окружения (только имена): `CASTLINK_DESIGN_QA_OUT`, `CASTLINK_QA_APPEND`, `CASTLINK_QA_AUTOPREVIEW`, `CASTLINK_QA_CHROMIUM_BINARY`, `CASTLINK_QA_COMPOSITION`, `CASTLINK_QA_DISCONNECT_ONLY`, `CASTLINK_QA_ENTRY_SCREEN_ROLE`, `CASTLINK_QA_FULLSCREEN_ONLY`, `CASTLINK_QA_LAYOUT_ONLY`, `CASTLINK_QA_RIGHT_RAIL`, `CASTLINK_QA_SCREEN_STATE_CONFIRMED`, `CASTLINK_QA_SIX_GUEST_ONLY`, `CASTLINK_QA_SIX_POINTS`, `CASTLINK_QA_SIX_ROLES_ONLY`, `CASTLINK_QA_SIX_VIEWS`, `CASTLINK_QA_SPECIAL_SURFACES`, `CASTLINK_QA_SPECIAL_VIEWS`, `CASTLINK_QA_SYNTHETIC_MEDIA`, `CASTLINK_QA_VIEWS`, `CASTLINK_QA_WIDTHS`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_PRODUCT_VERSION`.

### apps/web/tests/design-preview.browser.cjs

[`apps/web/tests/design-preview.browser.cjs`](../../apps/web/tests/design-preview.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Экспортируемые символы: `usePathname`.

Читает/импортирует: [`apps/web/components/AppChrome.tsx`](../../apps/web/components/AppChrome.tsx).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`, `react`, `react-dom/client`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_PRODUCT_VERSION`.

### apps/web/tests/design-preview.cjs

[`apps/web/tests/design-preview.cjs`](../../apps/web/tests/design-preview.cjs)

Проверка/тестовый инструмент. PASS: default new design and explicit comparison controls, per-tab boolean preference, secret-preserving URL cleanup, clean output exclusions and restricted storage

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/desktop-stop-panel.cjs

[`apps/web/tests/desktop-stop-panel.cjs`](../../apps/web/tests/desktop-stop-panel.cjs)

Проверка/тестовый инструмент. desktop stop adapter: PASS

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/diagnostics-page.cjs

[`apps/web/tests/diagnostics-page.cjs`](../../apps/web/tests/diagnostics-page.cjs)

Проверка/тестовый инструмент. PASS: diagnostics page hides data when protected health endpoint denies access

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/document-picture-in-picture.cjs

[`apps/web/tests/document-picture-in-picture.cjs`](../../apps/web/tests/document-picture-in-picture.cjs)

Проверка/тестовый инструмент. PASS shared DocumentPiP gesture/STOP preservation/stale claims/pagehide/retry

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/emergency-reserve-panel.cjs

[`apps/web/tests/emergency-reserve-panel.cjs`](../../apps/web/tests/emergency-reserve-panel.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`, `typescript`.

### apps/web/tests/entry-flow.browser.py

[`apps/web/tests/entry-flow.browser.py`](../../apps/web/tests/entry-flow.browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/entry-invite-hosted.cjs

[`apps/web/tests/entry-invite-hosted.cjs`](../../apps/web/tests/entry-invite-hosted.cjs)

Проверка/тестовый инструмент. PASS hosted invite entry: personal guest can resolve/start without staff token, settings agree, private scope/origin/revocation remain enforced

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/entry-links.cjs

[`apps/web/tests/entry-links.cjs`](../../apps/web/tests/entry-links.cjs)

Проверка/тестовый инструмент. PASS entry links: HTTPS validation, legacy canonicalization, exact opaque invite handoff and native-loop prevention

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/feedback-media.cjs

[`apps/web/tests/feedback-media.cjs`](../../apps/web/tests/feedback-media.cjs)

Проверка/тестовый инструмент. PASS: 48 native aspect/rotation cases, quiet meter signals, ballistic release, aggregate camera caps

Читает/импортирует: [`apps/web/lib/audio-meter.ts`](../../apps/web/lib/audio-meter.ts), [`apps/web/lib/video-fit.ts`](../../apps/web/lib/video-fit.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/fixtures/caster-layout-proof.tsx

[`apps/web/tests/fixtures/caster-layout-proof.tsx`](../../apps/web/tests/fixtures/caster-layout-proof.tsx)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/components/CoPresentationPanel.tsx`](../../apps/web/components/CoPresentationPanel.tsx), [`apps/web/components/ConferenceScene.tsx`](../../apps/web/components/ConferenceScene.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/MonitoringControls.tsx`](../../apps/web/components/MonitoringControls.tsx), [`apps/web/components/ParticipantSourceCard.tsx`](../../apps/web/components/ParticipantSourceCard.tsx), [`apps/web/components/RoomConference.tsx`](../../apps/web/components/RoomConference.tsx).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`.

### apps/web/tests/fixtures/image-correction-pipeline-adapter.ts

[`apps/web/tests/fixtures/image-correction-pipeline-adapter.ts`](../../apps/web/tests/fixtures/image-correction-pipeline-adapter.ts)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Экспортируемые символы: `RoomEvent`, `Track`, `VideoQuality`, `useParams`, `useSearchParams`, `useI18n`, `getLiveKitUrl`, `InlineLanguageSwitcher`, `readTransferSnapshot`, `clearTransferSnapshot`, `useSessionTransfer`, `guestReserveStatusText`, `Room`, `qa`.

Используют: [`apps/web/tests/fixtures/image-correction-pipeline.tsx`](../../apps/web/tests/fixtures/image-correction-pipeline.tsx).

### apps/web/tests/fixtures/image-correction-pipeline.tsx

[`apps/web/tests/fixtures/image-correction-pipeline.tsx`](../../apps/web/tests/fixtures/image-correction-pipeline.tsx)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx), [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/tests/fixtures/image-correction-pipeline-adapter.ts`](../../apps/web/tests/fixtures/image-correction-pipeline-adapter.ts).

Библиотеки/Node: `react`, `react-dom/client`.

### apps/web/tests/fixtures/output-transparency-adapter.ts

[`apps/web/tests/fixtures/output-transparency-adapter.ts`](../../apps/web/tests/fixtures/output-transparency-adapter.ts)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Экспортируемые символы: `RoomEvent`, `Track`, `VideoQuality`, `target`, `Room`, `useParams`, `useSearchParams`, `useI18n`, `getLiveKitUrl`, `qa`.

Используют: [`apps/web/tests/fixtures/output-transparency.tsx`](../../apps/web/tests/fixtures/output-transparency.tsx).

### apps/web/tests/fixtures/output-transparency.tsx

[`apps/web/tests/fixtures/output-transparency.tsx`](../../apps/web/tests/fixtures/output-transparency.tsx)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/app/output/slot/[slotId]/page.tsx`](../../apps/web/app/output/slot/%5BslotId%5D/page.tsx), [`apps/web/tests/fixtures/output-transparency-adapter.ts`](../../apps/web/tests/fixtures/output-transparency-adapter.ts).

Библиотеки/Node: `react`, `react-dom/client`.

### apps/web/tests/fixtures/room-reactions-ui.tsx

[`apps/web/tests/fixtures/room-reactions-ui.tsx`](../../apps/web/tests/fixtures/room-reactions-ui.tsx)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/components/ChatEmojis.tsx`](../../apps/web/components/ChatEmojis.tsx), [`apps/web/components/ConferenceScene.tsx`](../../apps/web/components/ConferenceScene.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/RoomReactions.tsx`](../../apps/web/components/RoomReactions.tsx), [`apps/web/lib/room-reactions.ts`](../../apps/web/lib/room-reactions.ts).

Библиотеки/Node: `@livekit/components-react`, `livekit-client`, `react`, `react-dom/client`.

### apps/web/tests/fixtures/slots-qa-bootstrap.ts

[`apps/web/tests/fixtures/slots-qa-bootstrap.ts`](../../apps/web/tests/fixtures/slots-qa-bootstrap.ts)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Экспортируемые символы: `POST`.

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts).

Библиотеки/Node: `next/server`.

Переменные окружения (только имена): `CASTLINK_SLOTS_QA`.

### apps/web/tests/fixtures/slots-qa-page.tsx

[`apps/web/tests/fixtures/slots-qa-page.tsx`](../../apps/web/tests/fixtures/slots-qa-page.tsx)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `livekit-client`, `react`.

### apps/web/tests/fixtures/ui-layout-corrections.tsx

[`apps/web/tests/fixtures/ui-layout-corrections.tsx`](../../apps/web/tests/fixtures/ui-layout-corrections.tsx)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/components/AudioMeter.tsx`](../../apps/web/components/AudioMeter.tsx), [`apps/web/components/ConferenceScene.tsx`](../../apps/web/components/ConferenceScene.tsx), [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/ModeratorStudioMonitoring.tsx`](../../apps/web/components/ModeratorStudioMonitoring.tsx), [`apps/web/components/RoomInviteButton.tsx`](../../apps/web/components/RoomInviteButton.tsx), [`apps/web/components/ScreenShareButton.tsx`](../../apps/web/components/ScreenShareButton.tsx), [`apps/web/components/StudioReturnPublishingControls.tsx`](../../apps/web/components/StudioReturnPublishingControls.tsx), [`apps/web/components/StudioReturnStatsPanel.tsx`](../../apps/web/components/StudioReturnStatsPanel.tsx), [`apps/web/components/StudioStreamInviteButton.tsx`](../../apps/web/components/StudioStreamInviteButton.tsx), [`apps/web/lib/studio-playback-layout.ts`](../../apps/web/lib/studio-playback-layout.ts).

Библиотеки/Node: `livekit-client`, `react`, `react-dom/client`.

### apps/web/tests/floating-panel-position.cjs

[`apps/web/tests/floating-panel-position.cjs`](../../apps/web/tests/floating-panel-position.cjs)

Проверка/тестовый инструмент. PASS floating header pointer/cancel/keyboard/viewport bounds

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/fullscreen-chrome.cjs

[`apps/web/tests/fullscreen-chrome.cjs`](../../apps/web/tests/fullscreen-chrome.cjs)

Проверка/тестовый инструмент. PASS fullscreen3s idle, mouse/keyboard restoration, focus protection, CSS fallback and cleanup

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/fullscreen.cjs

[`apps/web/tests/fullscreen.cjs`](../../apps/web/tests/fullscreen.cjs)

Проверка/тестовый инструмент. PASS: native fullscreen with CSS fallback for iOS/WebKit limitations

Читает/импортирует: [`apps/web/lib/fullscreen.ts`](../../apps/web/lib/fullscreen.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/guest-access-api.cjs

[`apps/web/tests/guest-access-api.cjs`](../../apps/web/tests/guest-access-api.cjs)

Проверка/тестовый инструмент. PASS: strict guest passwords, studio-cookie isolation, stale-cookie removal, signed invitations, tampering/expiry/room binding, open rooms

Библиотеки/Node: `node:assert/strict`, `node:crypto`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_SIGNING_SECRET`.

### apps/web/tests/guest-admission-api.cjs

[`apps/web/tests/guest-admission-api.cjs`](../../apps/web/tests/guest-admission-api.cjs)

Проверка/тестовый инструмент. PASS old-client compatibility: immediate entry, optional slot, explicit leave, scoped capability

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/guest-admission-client.cjs

[`apps/web/tests/guest-admission-client.cjs`](../../apps/web/tests/guest-admission-client.cjs)

Проверка/тестовый инструмент. PASS admission client: capability retained, personal invite, waiting before admission, abort

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/guest-admission-kick.cjs

[`apps/web/tests/guest-admission-kick.cjs`](../../apps/web/tests/guest-admission-kick.cjs)

Проверка/тестовый инструмент. PASS explicit kick unlinks slot, removes participant, denies old renewal and preserves normal fresh entry

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/guest-admission-token.cjs

[`apps/web/tests/guest-admission-token.cjs`](../../apps/web/tests/guest-admission-token.cjs)

Проверка/тестовый инструмент. PASS direct entry, password/invitation, stable renewal and old assigned session reconnect

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/guest-admission.cjs

[`apps/web/tests/guest-admission.cjs`](../../apps/web/tests/guest-admission.cjs)

Проверка/тестовый инструмент. PASS admission: waiting deny, explicit admission, authenticated resume, duplicate tab/name isolation, room version and release

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/guest-audio-gain.browser.cjs

[`apps/web/tests/guest-audio-gain.browser.cjs`](../../apps/web/tests/guest-audio-gain.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/tests/guest-audio.cjs`](../../apps/web/tests/guest-audio.cjs).

Библиотеки/Node: `/audio.mjs`, `/gain.mjs`, `livekit-client`, `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`.

### apps/web/tests/guest-audio-gain.cjs

[`apps/web/tests/guest-audio-gain.cjs`](../../apps/web/tests/guest-audio-gain.cjs)

Проверка/тестовый инструмент. PASS: guest transmitted PCM gain graph, mute preservation, capture restart, owned resource cleanup, absent mic/no capture, range validation, processor reuse, publication watch and stale guard

Читает/импортирует: [`apps/web/lib/guest-audio-gain.ts`](../../apps/web/lib/guest-audio-gain.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-audio-processing.browser.cjs

[`apps/web/tests/guest-audio-processing.browser.cjs`](../../apps/web/tests/guest-audio-processing.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `/audio.mjs`, `node:assert/strict`, `node:child_process`, `node:fs`, `node:http`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`.

### apps/web/tests/guest-audio-profile-ui.cjs

[`apps/web/tests/guest-audio-profile-ui.cjs`](../../apps/web/tests/guest-audio-profile-ui.cjs)

Проверка/тестовый инструмент. PASS: no guest profile selector, microphone-only capture and actual level, disabled/stale/unmounted capture disposal, chosen-output speaker test and stop on change/join, raw/legacy receive-only and captured transfer restoration

Читает/импортирует: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-audio.cjs

[`apps/web/tests/guest-audio.cjs`](../../apps/web/tests/guest-audio.cjs)

Проверка/тестовый инструмент. PASS: guest speech/raw capture and encoder options, device/mute preservation, rollback, stale cleanup, and serialized microphone mutations

Читает/импортирует: [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Используют: [`apps/web/tests/guest-audio-gain.browser.cjs`](../../apps/web/tests/guest-audio-gain.browser.cjs).

### apps/web/tests/guest-av-layout.browser.cjs

[`apps/web/tests/guest-av-layout.browser.cjs`](../../apps/web/tests/guest-av-layout.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/lib/i18n/workspaces.ts`](../../apps/web/lib/i18n/workspaces.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`.

### apps/web/tests/guest-camera-button.cjs

[`apps/web/tests/guest-camera-button.cjs`](../../apps/web/tests/guest-camera-button.cjs)

Проверка/тестовый инструмент. PASS: camera errors survive observer rerenders, actual SDK labels/toggle retained, transition and pending locks enforced

Читает/импортирует: [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-camera-capture.cjs

[`apps/web/tests/guest-camera-capture.cjs`](../../apps/web/tests/guest-camera-capture.cjs)

Проверка/тестовый инструмент. PASS: camera capture protocol, bounded validation, constraints, honest actual values, highest/defaults, off-state and SID cancellation

Читает/импортирует: [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/guest-camera-outbound.cjs

[`apps/web/tests/guest-camera-outbound.cjs`](../../apps/web/tests/guest-camera-outbound.cjs)

Проверка/тестовый инструмент. PASS: visible camera quality controls, true outbound camera layers, scoped guest-to-staff data, missing/zero/stale measurements and media-session guards

Читает/импортирует: [`apps/web/lib/guest-camera-outbound.ts`](../../apps/web/lib/guest-camera-outbound.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/guest-camera-resolution-ui.cjs

[`apps/web/tests/guest-camera-resolution-ui.cjs`](../../apps/web/tests/guest-camera-resolution-ui.cjs)

Проверка/тестовый инструмент. PASS staff camera resolution: request/SID, metadata, failure, busy state, replacement, offline and staff-only mounting

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:path`.

### apps/web/tests/guest-controls-layout.browser.cjs

[`apps/web/tests/guest-controls-layout.browser.cjs`](../../apps/web/tests/guest-controls-layout.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`.

### apps/web/tests/guest-controls-rendered.html

[`apps/web/tests/guest-controls-rendered.html`](../../apps/web/tests/guest-controls-rendered.html)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/guest-device-control-api.cjs

[`apps/web/tests/guest-device-control-api.cjs`](../../apps/web/tests/guest-device-control-api.cjs)

Проверка/тестовый инструмент. PASS: caster-device inventory privacy, room/token/SID authorization, canonical device labels, capability/freshness guards, verified applied/deferred ACK, decline/replay/expiry and server-only packets

Читает/импортирует: [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:vm`, `typescript`.

### apps/web/tests/guest-device-control-client.cjs

[`apps/web/tests/guest-device-control-client.cjs`](../../apps/web/tests/guest-device-control-client.cjs)

Проверка/тестовый инструмент. PASS: explicit accept/decline only, spoof/replay/SID rejected, expiry/disconnect clear prompt, invalidated mutation retains lock until settled, no stale success ACK, ACK-sampling expiry visible, serialized fresh reports and lifecycle cleanup

Читает/импортирует: [`apps/web/lib/guest-device-control-client.ts`](../../apps/web/lib/guest-device-control-client.ts), [`apps/web/lib/guest-device-control.ts`](../../apps/web/lib/guest-device-control.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-device-controls-ui.cjs

[`apps/web/tests/guest-device-controls-ui.cjs`](../../apps/web/tests/guest-device-controls-ui.cjs)

Проверка/тестовый инструмент. PASS: confirmed SID/device names, old selection retained until ACK, stale GET/previous-caster POST cannot overwrite new state, unsupported/rejoined states disabled, decline status, consent dialog Escape/busy guard/focus restoration and cleanup

Читает/импортирует: [`apps/web/components/GuestDeviceRequestDialog.tsx`](../../apps/web/components/GuestDeviceRequestDialog.tsx), [`apps/web/components/StudioGuestDeviceControls.tsx`](../../apps/web/components/StudioGuestDeviceControls.tsx), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-device-initial-permissions.cjs

[`apps/web/tests/guest-device-initial-permissions.cjs`](../../apps/web/tests/guest-device-initial-permissions.cjs)

Проверка/тестовый инструмент. PASS: first-entry dropdown immediately populated, permission names, disabled inputs respected, stale permission sequence cancelled, allowed input retained after another permission denial, temporary captures stopped, external grant refresh without duplicate capture

Читает/импортирует: [`apps/web/components/MediaDevicePicker.tsx`](../../apps/web/components/MediaDevicePicker.tsx), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-device-switch.cjs

[`apps/web/tests/guest-device-switch.cjs`](../../apps/web/tests/guest-device-switch.cjs)

Проверка/тестовый инструмент. PASS: exact active mic/camera verification, camera AV1 options and native aspect retained, installed SDK muted/absent deferred defaults with no capture, expired defaults restored, expiry/SID checks before acquisition, original audio processing/publications retained, native/output failure rollback and permission-limited inventory

Читает/импортирует: [`apps/web/lib/guest-device-switch.ts`](../../apps/web/lib/guest-device-switch.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-entry-settings.cjs

[`apps/web/tests/guest-entry-settings.cjs`](../../apps/web/tests/guest-entry-settings.cjs)

Проверка/тестовый инструмент. GUEST_ENTRY_SETTINGS_PASS; GUEST_ENTRY_SIGNED_COOKIE_AND_PUBLISHER_ACL_PASS

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-audio-permissions.ts`](../../apps/web/lib/guest-audio-permissions.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`.

### apps/web/tests/guest-entry-store.cjs

[`apps/web/tests/guest-entry-store.cjs`](../../apps/web/tests/guest-entry-store.cjs)

Проверка/тестовый инструмент. GUEST_ENTRY_STORE_ROOM_ISOLATION_PASS

Читает/импортирует: [`apps/web/lib/guest-entry-store.ts`](../../apps/web/lib/guest-entry-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/guest-entry.cjs

[`apps/web/tests/guest-entry.cjs`](../../apps/web/tests/guest-entry.cjs)

Проверка/тестовый инструмент. PASS: two-field guest entry, password/invite authorization, fragment sanitization without aborted auth, room/studio isolation and manual password URL transitions

Читает/импортирует: [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/lib/entry-links.ts`](../../apps/web/lib/entry-links.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `${initialName}`, `next/navigation`, `node:assert/strict`, `node:fs`, `node:module`, `react`, `typescript`.

### apps/web/tests/guest-invite-entry.cjs

[`apps/web/tests/guest-invite-entry.cjs`](../../apps/web/tests/guest-invite-entry.cjs)

Проверка/тестовый инструмент. GUEST_INVITE_ENTRY_SESSION_BOUNDARY_PASS

Читает/импортирует: [`apps/web/components/GuestAccessGate.tsx`](../../apps/web/components/GuestAccessGate.tsx), [`apps/web/lib/guest-resume.ts`](../../apps/web/lib/guest-resume.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-invite-key.cjs

[`apps/web/tests/guest-invite-key.cjs`](../../apps/web/tests/guest-invite-key.cjs)

Проверка/тестовый инструмент. PASS: random 32-character invite keys preserve signed scope, expiry, revocation and legacy compatibility

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/guest-invite-key.ts`](../../apps/web/lib/guest-invite-key.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/guest-invite-revocation.cjs

[`apps/web/tests/guest-invite-revocation.cjs`](../../apps/web/tests/guest-invite-revocation.cjs)

Проверка/тестовый инструмент. PASS: guest invite fragment, independent version and explicit revocation

Читает/импортирует: [`apps/web/app/api/auth/route.ts`](../../apps/web/app/api/auth/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-media-control-api.cjs

[`apps/web/tests/guest-media-control-api.cjs`](../../apps/web/tests/guest-media-control-api.cjs)

Проверка/тестовый инструмент. PASS: authenticated room-scoped guest settings, exact session/nonce/expiry checks, truthful ACK/offline errors, server-only transport, bounded status cache

Читает/импортирует: [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:vm`, `typescript`.

### apps/web/tests/guest-media-controls-ui.cjs

[`apps/web/tests/guest-media-controls-ui.cjs`](../../apps/web/tests/guest-media-controls-ui.cjs)

Проверка/тестовый инструмент. PASS: confirmed guest controls, draft/apply/cancel camera settings, actual capture, pending/offline/old-client states and cleanup

Читает/импортирует: [`apps/web/components/GuestCameraCaptureControls.tsx`](../../apps/web/components/GuestCameraCaptureControls.tsx), [`apps/web/components/StudioGuestMediaControls.tsx`](../../apps/web/components/StudioGuestMediaControls.tsx), [`apps/web/components/StudioGuestMediaPanel.tsx`](../../apps/web/components/StudioGuestMediaPanel.tsx), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-media.cjs

[`apps/web/tests/guest-media.cjs`](../../apps/web/tests/guest-media.cjs)

Проверка/тестовый инструмент. PASS: guest device constraints, admin-only client-info recipients, bounded payload validation, and output-target data privacy

Читает/импортирует: [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-mobile-video-layout.browser.py

[`apps/web/tests/guest-mobile-video-layout.browser.py`](../../apps/web/tests/guest-mobile-video-layout.browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/guest-name-sync.cjs

[`apps/web/tests/guest-name-sync.cjs`](../../apps/web/tests/guest-name-sync.cjs)

Проверка/тестовый инструмент. PASS guest names: intentional rejoin, current-name renewal, signed fallback, local rename/reconnect and listener cleanup

Экспортируемые символы: `GET`.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/guest-participants-table.cjs

[`apps/web/tests/guest-participants-table.cjs`](../../apps/web/tests/guest-participants-table.cjs)

Проверка/тестовый инструмент. PASS actual source-card guest actions: exact move/kick/refresh/SID wiring, current-room and simple-room restrictions, output/quality/monitoring slots retained

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/guest-preflight-ui.cjs

[`apps/web/tests/guest-preflight-ui.cjs`](../../apps/web/tests/guest-preflight-ui.cjs)

Проверка/тестовый инструмент. PASS: merged editable name/devices, explicit connect, trimmed name, disabled inputs, collapsed diagnostics and three locales

Читает/импортирует: [`apps/web/components/GuestAvCheck.tsx`](../../apps/web/components/GuestAvCheck.tsx), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/i18n/entry-preflight.ts`](../../apps/web/lib/i18n/entry-preflight.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/guest-resume.cjs

[`apps/web/tests/guest-resume.cjs`](../../apps/web/tests/guest-resume.cjs)

Проверка/тестовый инструмент. PASS: authenticated scoped resume, invitation binding, durable reopen, duplicate-tab isolation, expiry/revocation and storage fallback

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/guest-session-settings.cjs

[`apps/web/tests/guest-session-settings.cjs`](../../apps/web/tests/guest-session-settings.cjs)

Проверка/тестовый инструмент. PASS: guest metadata/media snapshots scoped by tenant immutable room and identity expire 15min after disconnect without read refresh

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/guest-settings-renewal.cjs

[`apps/web/tests/guest-settings-renewal.cjs`](../../apps/web/tests/guest-settings-renewal.cjs)

Проверка/тестовый инструмент. PASS: guest renewal restores authoritative settings, expires offline data and preserves private microphone gate

Читает/импортирует: [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-session-settings.ts`](../../apps/web/lib/guest-session-settings.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/guest-staff-transition.cjs

[`apps/web/tests/guest-staff-transition.cjs`](../../apps/web/tests/guest-staff-transition.cjs)

Проверка/тестовый инструмент. GUEST_STAFF_TRANSITION_PASS

Читает/импортирует: [`apps/web/lib/guest-staff-transition.ts`](../../apps/web/lib/guest-staff-transition.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/guest-video-card.cjs

[`apps/web/tests/guest-video-card.cjs`](../../apps/web/tests/guest-video-card.cjs)

Проверка/тестовый инструмент. PASS: guest video card extraction preserves preview, monitoring, quality and actions

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/guest-video-codec.cjs

[`apps/web/tests/guest-video-codec.cjs`](../../apps/web/tests/guest-video-codec.cjs)

Проверка/тестовый инструмент. PASS: guest codec, staff-owned capture height, live metadata/reconnect/stale/off-camera guards, camera-only serialized republish and rollback

Читает/импортирует: [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/guest-workspace-media.cjs

[`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs)

Проверка/тестовый инструмент. PASS: production guest workspace applies raw mode to queued enable, confirms toolbar mute, preserves muted devices/profile across same-identity relay reconnect and transfer snapshot

Экспортируемые символы: `RoomConnector`.

Читает/импортирует: [`apps/web/components/GuestMicrophoneButton.tsx`](../../apps/web/components/GuestMicrophoneButton.tsx), [`apps/web/lib/connection-route.ts`](../../apps/web/lib/connection-route.ts), [`apps/web/lib/guest-audio.ts`](../../apps/web/lib/guest-audio.ts), [`apps/web/lib/guest-capture-settings.ts`](../../apps/web/lib/guest-capture-settings.ts), [`apps/web/lib/guest-entry-settings.ts`](../../apps/web/lib/guest-entry-settings.ts), [`apps/web/lib/guest-media-control-client.ts`](../../apps/web/lib/guest-media-control-client.ts), [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-media.ts`](../../apps/web/lib/guest-media.ts), [`apps/web/lib/guest-resume.ts`](../../apps/web/lib/guest-resume.ts), [`apps/web/lib/guest-staff-transition.ts`](../../apps/web/lib/guest-staff-transition.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/health-api.cjs

[`apps/web/tests/health-api.cjs`](../../apps/web/tests/health-api.cjs)

Проверка/тестовый инструмент. PASS: health endpoint is restricted to studio-owner/room-admin access and excludes application secrets

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/heartbeat-host-metrics.cjs

[`apps/web/tests/heartbeat-host-metrics.cjs`](../../apps/web/tests/heartbeat-host-metrics.cjs)

Проверка/тестовый инструмент. PASS: measured host egress, first sample unavailable, counter reset, stale interval and actual zero

Читает/импортирует: [`scripts/heartbeat-host-metrics.mjs`](../../scripts/heartbeat-host-metrics.mjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/helpers/rate-limit.cjs

[`apps/web/tests/helpers/rate-limit.cjs`](../../apps/web/tests/helpers/rate-limit.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:fs`, `node:path`, `node:vm`, `typescript`.

Используют: [`apps/web/tests/panel-session.cjs`](../../apps/web/tests/panel-session.cjs), [`apps/web/tests/rotation-api.cjs`](../../apps/web/tests/rotation-api.cjs), [`apps/web/tests/studio-caster-image-api.cjs`](../../apps/web/tests/studio-caster-image-api.cjs).

### apps/web/tests/host-runtime-startup-postgres.cjs

[`apps/web/tests/host-runtime-startup-postgres.cjs`](../../apps/web/tests/host-runtime-startup-postgres.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/cli/tests/host-startup-runner-fixture.mjs`](../../apps/cli/tests/host-startup-runner-fixture.mjs), [`apps/web/tests/runtime-observer-pg-fixture.cjs`](../../apps/web/tests/runtime-observer-pg-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `node:test`.

Переменные окружения (только имена): `FIXTURE_STATE`.

### apps/web/tests/hosted-access-api.cjs

[`apps/web/tests/hosted-access-api.cjs`](../../apps/web/tests/hosted-access-api.cjs)

Проверка/тестовый инструмент. PASS: hosted API origin, size, reusable secure session, direct room creation and revocation

Читает/импортирует: [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_DEPLOYMENT_MODEL`, `CASTLINK_HOSTED_ACCESS`, `CASTLINK_HOSTED_TOKEN_FILE`, `CASTLINK_SESSION_SECRET`, `CASTLINK_STORAGE_BACKEND`, `ROOM_CREATION_PASSWORD`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/hosted-access.cjs

[`apps/web/tests/hosted-access.cjs`](../../apps/web/tests/hosted-access.cjs)

Проверка/тестовый инструмент. PASS: hosted reusable tokens, signed sessions, live expiry/revoke, restart and fail-closed registry

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_HOSTED_ACCESS`, `CASTLINK_HOSTED_TOKEN_FILE`, `CASTLINK_SESSION_SECRET`, `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/tests/hosted-staff-access.cjs

[`apps/web/tests/hosted-staff-access.cjs`](../../apps/web/tests/hosted-staff-access.cjs)

Проверка/тестовый инструмент. PASS: staff cookies require live hosted access only when hosted mode is enabled

Читает/импортирует: [`apps/web/lib/hosted-access.ts`](../../apps/web/lib/hosted-access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_HOSTED_ACCESS`, `CASTLINK_HOSTED_TOKEN_FILE`, `CASTLINK_SESSION_SECRET`, `CASTLINK_STORAGE_BACKEND`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_MODERATOR_ACCESS_FILE`, `STUDIOLINK_ROOMS_FILE`.

### apps/web/tests/i18n-fixture.cjs

[`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:fs`, `node:module`, `node:path`, `typescript`.

Используют: [`apps/web/tests/app-update-notice.cjs`](../../apps/web/tests/app-update-notice.cjs), [`apps/web/tests/audio-output-switch.cjs`](../../apps/web/tests/audio-output-switch.cjs), [`apps/web/tests/conference-audio-policy.cjs`](../../apps/web/tests/conference-audio-policy.cjs), [`apps/web/tests/emergency-reserve-panel.cjs`](../../apps/web/tests/emergency-reserve-panel.cjs), [`apps/web/tests/guest-audio-profile-ui.cjs`](../../apps/web/tests/guest-audio-profile-ui.cjs), [`apps/web/tests/guest-camera-button.cjs`](../../apps/web/tests/guest-camera-button.cjs), [`apps/web/tests/guest-device-controls-ui.cjs`](../../apps/web/tests/guest-device-controls-ui.cjs), [`apps/web/tests/guest-device-initial-permissions.cjs`](../../apps/web/tests/guest-device-initial-permissions.cjs), [`apps/web/tests/guest-entry.cjs`](../../apps/web/tests/guest-entry.cjs), [`apps/web/tests/guest-invite-entry.cjs`](../../apps/web/tests/guest-invite-entry.cjs), [`apps/web/tests/guest-media-controls-ui.cjs`](../../apps/web/tests/guest-media-controls-ui.cjs), [`apps/web/tests/guest-preflight-ui.cjs`](../../apps/web/tests/guest-preflight-ui.cjs), [`apps/web/tests/guest-workspace-media.cjs`](../../apps/web/tests/guest-workspace-media.cjs), [`apps/web/tests/panel-session.cjs`](../../apps/web/tests/panel-session.cjs), [`apps/web/tests/participants-compact.browser.cjs`](../../apps/web/tests/participants-compact.browser.cjs), [`apps/web/tests/private-talkback-controls.cjs`](../../apps/web/tests/private-talkback-controls.cjs), [`apps/web/tests/public-room-entry.cjs`](../../apps/web/tests/public-room-entry.cjs), [`apps/web/tests/reconnect-recovery.cjs`](../../apps/web/tests/reconnect-recovery.cjs), [`apps/web/tests/remote-studio-devices.cjs`](../../apps/web/tests/remote-studio-devices.cjs), [`apps/web/tests/room-mode-monitoring.cjs`](../../apps/web/tests/room-mode-monitoring.cjs), [`apps/web/tests/self-hosted-setup.cjs`](../../apps/web/tests/self-hosted-setup.cjs), [`apps/web/tests/server-connections.cjs`](../../apps/web/tests/server-connections.cjs), [`apps/web/tests/session-transfer-hook.cjs`](../../apps/web/tests/session-transfer-hook.cjs), [`apps/web/tests/session-transfer-renewal.cjs`](../../apps/web/tests/session-transfer-renewal.cjs), [`apps/web/tests/statistics-dashboard-refresh.cjs`](../../apps/web/tests/statistics-dashboard-refresh.cjs), [`apps/web/tests/studio-outbound-poll.cjs`](../../apps/web/tests/studio-outbound-poll.cjs), [`apps/web/tests/studio-return-publishing-controls.cjs`](../../apps/web/tests/studio-return-publishing-controls.cjs), [`apps/web/tests/studio-transfer-devices.cjs`](../../apps/web/tests/studio-transfer-devices.cjs), [`apps/web/tests/studio-transfer-release.cjs`](../../apps/web/tests/studio-transfer-release.cjs), [`apps/web/tests/studio-transfer-request.cjs`](../../apps/web/tests/studio-transfer-request.cjs), [`apps/web/tests/studio-video-mode-ui.cjs`](../../apps/web/tests/studio-video-mode-ui.cjs), [`apps/web/tests/studio-watch-stats.cjs`](../../apps/web/tests/studio-watch-stats.cjs), [`apps/web/tests/viewer-transfer-page.cjs`](../../apps/web/tests/viewer-transfer-page.cjs), [`apps/web/tests/watch-transfer.cjs`](../../apps/web/tests/watch-transfer.cjs).

### apps/web/tests/i18n.browser.cjs

[`apps/web/tests/i18n.browser.cjs`](../../apps/web/tests/i18n.browser.cjs)

Проверка/тестовый инструмент. I18n browser hydration, switching, reactive statuses, persistence, tabs, restricted storage and media preservation passed

Экспортируемые символы: `MediaProbe`, `Probe`, `App`.

Читает/импортирует: [`apps/web/components/I18nProvider.tsx`](../../apps/web/components/I18nProvider.tsx), [`apps/web/components/LanguageSwitcher.tsx`](../../apps/web/components/LanguageSwitcher.tsx), [`apps/web/tests/i18n.cjs`](../../apps/web/tests/i18n.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`.

Переменные окружения (только имена): `CASTLINK_PLAYWRIGHT_PATH`, `CASTLINK_QA_CHROMIUM`.

### apps/web/tests/i18n.cjs

[`apps/web/tests/i18n.cjs`](../../apps/web/tests/i18n.cjs)

Проверка/тестовый инструмент. I18n catalog coverage, interpolation, raw content, validation and Russian SSR passed (

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`.

Используют: [`apps/web/tests/i18n.browser.cjs`](../../apps/web/tests/i18n.browser.cjs).

### apps/web/tests/image-correction-pipeline.browser.cjs

[`apps/web/tests/image-correction-pipeline.browser.cjs`](../../apps/web/tests/image-correction-pipeline.browser.cjs)

Проверка/тестовый инструмент. PASS pixels: actual slot camera metadata exposure/contrast/reset; screenshot-composed mixer -> actual WatchPage without double filter; screen unchanged; empty output transparent; proof

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`, `pngjs`.

Переменные окружения (только имена): `CASTLINK_IMAGE_QA_OUT`, `CASTLINK_IMAGE_QA_TRANSFORM_MODULE`, `CASTLINK_QA_CHROMIUM_BINARY`, `CASTLINK_QA_PLAYWRIGHT`.

### apps/web/tests/image-transform-compact.browser.cjs

[`apps/web/tests/image-transform-compact.browser.cjs`](../../apps/web/tests/image-transform-compact.browser.cjs)

Проверка/тестовый инструмент. PASS compact transform controls: real CSS cascade, 240/300/440px, dark/light, zoom/rotation/crop;

Читает/импортирует: [`apps/web/components/multiview/ImageTransformControls.tsx`](../../apps/web/components/multiview/ImageTransformControls.tsx).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `react`, `react-dom/client`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`, `NODE_ENV`.

### apps/web/tests/licensing.cjs

[`apps/web/tests/licensing.cjs`](../../apps/web/tests/licensing.cjs)

Проверка/тестовый инструмент. PASS: Ed25519 license/lease signatures, installation binding, server binding and expiry checks

Читает/импортирует: [`apps/web/lib/license.ts`](../../apps/web/lib/license.ts), [`apps/web/lib/server-lease.ts`](../../apps/web/lib/server-lease.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/live-telemetry-cache.cjs

[`apps/web/tests/live-telemetry-cache.cjs`](../../apps/web/tests/live-telemetry-cache.cjs)

Проверка/тестовый инструмент. PASS: shared bounded topology cache, one cold seed, monotonic rename and room isolation

Читает/импортирует: [`apps/web/lib/live-telemetry-cache.ts`](../../apps/web/lib/live-telemetry-cache.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/load-typescript.cjs

[`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:fs`, `node:module`, `node:path`, `node:vm`, `typescript`.

Используют: [`apps/web/tests/caster-invite-delete-ui.cjs`](../../apps/web/tests/caster-invite-delete-ui.cjs), [`apps/web/tests/caster-invite-delete.cjs`](../../apps/web/tests/caster-invite-delete.cjs), [`apps/web/tests/caster-slot-assignment.cjs`](../../apps/web/tests/caster-slot-assignment.cjs), [`apps/web/tests/caster-slot-reconnect.cjs`](../../apps/web/tests/caster-slot-reconnect.cjs), [`apps/web/tests/caster-slot-store.cjs`](../../apps/web/tests/caster-slot-store.cjs), [`apps/web/tests/caster-slots-ui.cjs`](../../apps/web/tests/caster-slots-ui.cjs), [`apps/web/tests/caster-workspace-layout.cjs`](../../apps/web/tests/caster-workspace-layout.cjs), [`apps/web/tests/co-presentation-acceptance-races.cjs`](../../apps/web/tests/co-presentation-acceptance-races.cjs), [`apps/web/tests/co-presentation-acceptance.cjs`](../../apps/web/tests/co-presentation-acceptance.cjs), [`apps/web/tests/co-presentation-browser-gesture.cjs`](../../apps/web/tests/co-presentation-browser-gesture.cjs), [`apps/web/tests/co-presentation-controls.cjs`](../../apps/web/tests/co-presentation-controls.cjs), [`apps/web/tests/co-presentation-floating-panel.cjs`](../../apps/web/tests/co-presentation-floating-panel.cjs), [`apps/web/tests/co-presentation-helper-resume.cjs`](../../apps/web/tests/co-presentation-helper-resume.cjs), [`apps/web/tests/co-presentation-inline-menu.cjs`](../../apps/web/tests/co-presentation-inline-menu.cjs), [`apps/web/tests/co-presentation-native-floating.cjs`](../../apps/web/tests/co-presentation-native-floating.cjs), [`apps/web/tests/co-presentation-navigation.cjs`](../../apps/web/tests/co-presentation-navigation.cjs), [`apps/web/tests/co-presentation-panel-lifecycle.cjs`](../../apps/web/tests/co-presentation-panel-lifecycle.cjs), [`apps/web/tests/co-presentation-recipient.cjs`](../../apps/web/tests/co-presentation-recipient.cjs), [`apps/web/tests/co-presentation-request.cjs`](../../apps/web/tests/co-presentation-request.cjs), [`apps/web/tests/co-presentation-screen-binding.cjs`](../../apps/web/tests/co-presentation-screen-binding.cjs), [`apps/web/tests/co-presentation-step-controls.cjs`](../../apps/web/tests/co-presentation-step-controls.cjs), [`apps/web/tests/co-presentation-toolbar-contract.cjs`](../../apps/web/tests/co-presentation-toolbar-contract.cjs), [`apps/web/tests/co-presentation-toolbar-control-failure.cjs`](../../apps/web/tests/co-presentation-toolbar-control-failure.cjs), [`apps/web/tests/co-presentation-window-frontend.cjs`](../../apps/web/tests/co-presentation-window-frontend.cjs), [`apps/web/tests/co-presentation-window-intent.cjs`](../../apps/web/tests/co-presentation-window-intent.cjs), [`apps/web/tests/conference-gallery-layout.cjs`](../../apps/web/tests/conference-gallery-layout.cjs), [`apps/web/tests/conference-portrait-tiles.cjs`](../../apps/web/tests/conference-portrait-tiles.cjs), [`apps/web/tests/conference-scene.cjs`](../../apps/web/tests/conference-scene.cjs), [`apps/web/tests/desktop-stop-panel.cjs`](../../apps/web/tests/desktop-stop-panel.cjs), [`apps/web/tests/document-picture-in-picture.cjs`](../../apps/web/tests/document-picture-in-picture.cjs), [`apps/web/tests/entry-invite-hosted.cjs`](../../apps/web/tests/entry-invite-hosted.cjs), [`apps/web/tests/entry-links.cjs`](../../apps/web/tests/entry-links.cjs), [`apps/web/tests/floating-panel-position.cjs`](../../apps/web/tests/floating-panel-position.cjs), [`apps/web/tests/fullscreen-chrome.cjs`](../../apps/web/tests/fullscreen-chrome.cjs), [`apps/web/tests/guest-admission-api.cjs`](../../apps/web/tests/guest-admission-api.cjs), [`apps/web/tests/guest-admission-client.cjs`](../../apps/web/tests/guest-admission-client.cjs), [`apps/web/tests/guest-admission-kick.cjs`](../../apps/web/tests/guest-admission-kick.cjs), [`apps/web/tests/guest-admission-token.cjs`](../../apps/web/tests/guest-admission-token.cjs), [`apps/web/tests/guest-admission.cjs`](../../apps/web/tests/guest-admission.cjs), [`apps/web/tests/guest-camera-resolution-ui.cjs`](../../apps/web/tests/guest-camera-resolution-ui.cjs), [`apps/web/tests/multiview-editor-grid.cjs`](../../apps/web/tests/multiview-editor-grid.cjs), [`apps/web/tests/output-source-quality.cjs`](../../apps/web/tests/output-source-quality.cjs), [`apps/web/tests/participant-video-resolution.cjs`](../../apps/web/tests/participant-video-resolution.cjs), [`apps/web/tests/persistent-json-retry.cjs`](../../apps/web/tests/persistent-json-retry.cjs), [`apps/web/tests/presentation-file-client.cjs`](../../apps/web/tests/presentation-file-client.cjs), [`apps/web/tests/presentation-file.cjs`](../../apps/web/tests/presentation-file.cjs), [`apps/web/tests/presentation-upload-memory.cjs`](../../apps/web/tests/presentation-upload-memory.cjs), [`apps/web/tests/presentation-upload-middleware.cjs`](../../apps/web/tests/presentation-upload-middleware.cjs), [`apps/web/tests/presentation-upload-routing.cjs`](../../apps/web/tests/presentation-upload-routing.cjs), [`apps/web/tests/presentation-upload-stream.cjs`](../../apps/web/tests/presentation-upload-stream.cjs), [`apps/web/tests/render-native-pptx.cjs`](../../apps/web/tests/render-native-pptx.cjs), [`apps/web/tests/room-chat-api.cjs`](../../apps/web/tests/room-chat-api.cjs), [`apps/web/tests/room-chat-auth.cjs`](../../apps/web/tests/room-chat-auth.cjs), [`apps/web/tests/room-chat-bearer.cjs`](../../apps/web/tests/room-chat-bearer.cjs), [`apps/web/tests/room-chat-clear-api.cjs`](../../apps/web/tests/room-chat-clear-api.cjs), [`apps/web/tests/room-chat-clear-store.cjs`](../../apps/web/tests/room-chat-clear-store.cjs), [`apps/web/tests/room-chat-client.cjs`](../../apps/web/tests/room-chat-client.cjs), [`apps/web/tests/room-chat-hook.cjs`](../../apps/web/tests/room-chat-hook.cjs), [`apps/web/tests/room-chat-store.cjs`](../../apps/web/tests/room-chat-store.cjs), [`apps/web/tests/room-creation-password-ui.cjs`](../../apps/web/tests/room-creation-password-ui.cjs), [`apps/web/tests/room-reactions.cjs`](../../apps/web/tests/room-reactions.cjs), [`apps/web/tests/screen-share-stop-button.cjs`](../../apps/web/tests/screen-share-stop-button.cjs), [`apps/web/tests/screen-share-stop-panel.cjs`](../../apps/web/tests/screen-share-stop-panel.cjs), [`apps/web/tests/server-slots-authority.cjs`](../../apps/web/tests/server-slots-authority.cjs), [`apps/web/tests/server-slots-postgres.cjs`](../../apps/web/tests/server-slots-postgres.cjs), [`apps/web/tests/slot-output-api.cjs`](../../apps/web/tests/slot-output-api.cjs), [`apps/web/tests/slot-output-controller.cjs`](../../apps/web/tests/slot-output-controller.cjs), [`apps/web/tests/slot-output-hosted-http.cjs`](../../apps/web/tests/slot-output-hosted-http.cjs), [`apps/web/tests/staff-chat-panel.cjs`](../../apps/web/tests/staff-chat-panel.cjs), [`apps/web/tests/staff-room-chat-hook.cjs`](../../apps/web/tests/staff-room-chat-hook.cjs), [`apps/web/tests/staff-room-chat.cjs`](../../apps/web/tests/staff-room-chat.cjs).

### apps/web/tests/manual-docs.cjs

[`apps/web/tests/manual-docs.cjs`](../../apps/web/tests/manual-docs.cjs)

Проверка/тестовый инструмент. PASS: beginner manual links resolve and the full source-file catalog matches Git index

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:path`.

### apps/web/tests/media-room-api.cjs

[`apps/web/tests/media-room-api.cjs`](../../apps/web/tests/media-room-api.cjs)

Проверка/тестовый инструмент. PASS: owner-only diagnostic contract, association drift refusal, ordinary responses and legacy deletion preserved

Читает/импортирует: [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `NODE_ENV`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/media-room-association.cjs

[`apps/web/tests/media-room-association.cjs`](../../apps/web/tests/media-room-association.cjs)

Проверка/тестовый инструмент. PASS: conditional room deletion preserves replacement, matches only current association, and keeps last-room policy

Читает/импортирует: [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `typescript`.

### apps/web/tests/media-room-revision-contract.cjs

[`apps/web/tests/media-room-revision-contract.cjs`](../../apps/web/tests/media-room-revision-contract.cjs)

Проверка/тестовый инструмент. PASS: ${count} diagnostic revision cases; mode/admin/transfer/noop/rename dirty, grant credentials retained, untouched receipt cleans

Читает/импортирует: [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`.

Используют: [`apps/web/tests/media-room-revision-postgres.cjs`](../../apps/web/tests/media-room-revision-postgres.cjs), [`apps/web/tests/media-room-revision.cjs`](../../apps/web/tests/media-room-revision.cjs).

### apps/web/tests/media-room-revision-postgres.cjs

[`apps/web/tests/media-room-revision-postgres.cjs`](../../apps/web/tests/media-room-revision-postgres.cjs)

Проверка/тестовый инструмент. PASS: migration 003 preserves the existing ordinary room grant versions and adds only NULL diagnostic metadata; PASS: PostgreSQL optional metadata NULL mapping and dirty revision roundtrip across backend instances; PASS: real PostgreSQL queued operator-mode transaction wins before conditional cleanup; changed room survives

Читает/импортирует: [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts), [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/tests/media-room-revision-contract.cjs`](../../apps/web/tests/media-room-revision-contract.cjs), [`scripts/setup-database-schema.mjs`](../../scripts/setup-database-schema.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `TEST_DATABASE_URL`.

### apps/web/tests/media-room-revision.cjs

[`apps/web/tests/media-room-revision.cjs`](../../apps/web/tests/media-room-revision.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/tests/media-room-revision-contract.cjs`](../../apps/web/tests/media-room-revision-contract.cjs).

Библиотеки/Node: `node:fs`, `node:os`, `node:path`, `typescript`.

### apps/web/tests/media-studio-control.cjs

[`apps/web/tests/media-studio-control.cjs`](../../apps/web/tests/media-studio-control.cjs)

Проверка/тестовый инструмент. PASS: ${cases} actual studio-state cases; primary writes dirty receipts, readonly/denied access unchanged, deleted/replaced room activation refused

Читает/импортирует: [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/lib/media-room-association.ts`](../../apps/web/lib/media-room-association.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `NODE_ENV`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/mobile-operations-browser.py

[`apps/web/tests/mobile-operations-browser.py`](../../apps/web/tests/mobile-operations-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/moderator-access-api.cjs

[`apps/web/tests/moderator-access-api.cjs`](../../apps/web/tests/moderator-access-api.cjs)

Проверка/тестовый инструмент. PASS: server moderator invitation, room management allowlist, guest-only controls, read-only studio access, and owner/admin boundaries

Библиотеки/Node: `node:assert/strict`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_STUDIO_PASSWORD`.

### apps/web/tests/moderator-invite-scope.cjs

[`apps/web/tests/moderator-invite-scope.cjs`](../../apps/web/tests/moderator-invite-scope.cjs)

Проверка/тестовый инструмент. PASS actual moderator invite handlers: forced room create and room-only revoke

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/moderator-room-rename.cjs

[`apps/web/tests/moderator-room-rename.cjs`](../../apps/web/tests/moderator-room-rename.cjs)

Проверка/тестовый инструмент. PASS: moderators can rename inactive empty rooms but cannot rename rooms with participants or a live primary lease

Читает/импортирует: [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/moderator-studio-ui.cjs

[`apps/web/tests/moderator-studio-ui.cjs`](../../apps/web/tests/moderator-studio-ui.cjs)

Проверка/тестовый инструмент. PASS: moderator UI preserves studioId through refresh, room tools and invite flow

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/monitor-audio.cjs

[`apps/web/tests/monitor-audio.cjs`](../../apps/web/tests/monitor-audio.cjs)

Проверка/тестовый инструмент. PASS: reconnect mute, replacement element/track, WebAudio, live volume, zero slider, listener cleanup

Читает/импортирует: [`apps/web/lib/monitor-audio.ts`](../../apps/web/lib/monitor-audio.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/move-guest-studio-scope.cjs

[`apps/web/tests/move-guest-studio-scope.cjs`](../../apps/web/tests/move-guest-studio-scope.cjs)

Проверка/тестовый инструмент. PASS: guest move commands and moderator authorization remain studio-scoped

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/multitenant-room-isolation.cjs

[`apps/web/tests/multitenant-room-isolation.cjs`](../../apps/web/tests/multitenant-room-isolation.cjs)

Проверка/тестовый инструмент. PASS: identical room names remain isolated by studio in PostgreSQL and LiveKit namespace

Читает/импортирует: [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/multiview-api.cjs

[`apps/web/tests/multiview-api.cjs`](../../apps/web/tests/multiview-api.cjs)

Проверка/тестовый инструмент. PASS multiview authorization, viewer scope, validation, revision conflicts, persistence, rename/recreate isolation

Читает/импортирует: [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/multiview-store.ts`](../../apps/web/lib/multiview-store.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `CASTLINK_STORAGE_BACKEND`, `LIVEKIT_API_SECRET`, `ROOM_CREATION_PASSWORD`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/multiview-delete-api.cjs

[`apps/web/tests/multiview-delete-api.cjs`](../../apps/web/tests/multiview-delete-api.cjs)

Проверка/тестовый инструмент. PASS: revision-checked scene deletion, room authorization, output 404, persistence, atomic save/delete and stale association protection

Читает/импортирует: [`apps/web/app/api/multiview/route.ts`](../../apps/web/app/api/multiview/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/multiview-store.ts`](../../apps/web/lib/multiview-store.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `ROOM_CREATION_PASSWORD`.

### apps/web/tests/multiview-editor-grid.cjs

[`apps/web/tests/multiview-editor-grid.cjs`](../../apps/web/tests/multiview-editor-grid.cjs)

Проверка/тестовый инструмент. PASS editor-only grid preference validation, bounded scene-space lines and square 16:9/4:3 scaling

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/multiview-extensions.cjs

[`apps/web/tests/multiview-extensions.cjs`](../../apps/web/tests/multiview-extensions.cjs)

Проверка/тестовый инструмент. PASS: multiview transform validation, absence policy, independent copy, numbered slot swap/replace; PASS: bounded raster-only placeholder and deeply independent placeholder transform; PASS asymmetric and maximum crop masks preserve source scale, position and transform pivot

Читает/импортирует: [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts), [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts), [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts), [`apps/web/tests/multiview-layout.cjs`](../../apps/web/tests/multiview-layout.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/multiview-formats.cjs

[`apps/web/tests/multiview-formats.cjs`](../../apps/web/tests/multiview-formats.cjs)

Проверка/тестовый инструмент. PASS: 4:3 scene preset, strict persisted slot formats, portable round trips, free ratio lock and bounded grid frames

Читает/импортирует: [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts), [`apps/web/lib/multiview-portable.ts`](../../apps/web/lib/multiview-portable.ts), [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts), [`apps/web/tests/multiview-layout.cjs`](../../apps/web/tests/multiview-layout.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/multiview-geometry.cjs

[`apps/web/tests/multiview-geometry.cjs`](../../apps/web/tests/multiview-geometry.cjs)

Проверка/тестовый инструмент. PASS: offcanvas scene schema, finite radius bounds, strict allowed fields

Читает/импортирует: [`apps/web/lib/multiview.ts`](../../apps/web/lib/multiview.ts), [`apps/web/tests/multiview-layout.cjs`](../../apps/web/tests/multiview-layout.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/multiview-layout.cjs

[`apps/web/tests/multiview-layout.cjs`](../../apps/web/tests/multiview-layout.cjs)

Проверка/тестовый инструмент. PASS: multiview bounds, grids, source assignment, swap, and immutable draft history

Читает/импортирует: [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Используют: [`apps/web/tests/multiview-extensions.cjs`](../../apps/web/tests/multiview-extensions.cjs), [`apps/web/tests/multiview-formats.cjs`](../../apps/web/tests/multiview-formats.cjs), [`apps/web/tests/multiview-geometry.cjs`](../../apps/web/tests/multiview-geometry.cjs), [`apps/web/tests/multiview-portable.cjs`](../../apps/web/tests/multiview-portable.cjs), [`apps/web/tests/multiview-snap.cjs`](../../apps/web/tests/multiview-snap.cjs).

### apps/web/tests/multiview-media.cjs

[`apps/web/tests/multiview-media.cjs`](../../apps/web/tests/multiview-media.cjs)

Проверка/тестовый инструмент. PASS: transparent missing/muted/ended video, replacement recovery, idempotent attachment, distinct audio sources; PASS production multiview stationary source crop, transform/editor-output parity and replacement dimensions after reconnect

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/multiview-portable.cjs

[`apps/web/tests/multiview-portable.cjs`](../../apps/web/tests/multiview-portable.cjs)

Проверка/тестовый инструмент. PASS: versioned portable scene round trip, detached bindings, fresh IDs, strict schema and UTF-8 size bounds

Читает/импортирует: [`apps/web/lib/multiview-portable.ts`](../../apps/web/lib/multiview-portable.ts), [`apps/web/tests/multiview-layout.cjs`](../../apps/web/tests/multiview-layout.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/multiview-scene-clip.cjs

[`apps/web/tests/multiview-scene-clip.cjs`](../../apps/web/tests/multiview-scene-clip.cjs)

Проверка/тестовый инструмент. PASS scene clipping on every edge, outside and oversized slots

Читает/импортирует: [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/multiview-snap.cjs

[`apps/web/tests/multiview-snap.cjs`](../../apps/web/tests/multiview-snap.cjs)

Проверка/тестовый инструмент. PASS: pixel-aware edge/center snapping for move/resize, other slots, offcanvas movement and bounded guides

Читает/импортирует: [`apps/web/lib/multiview-snap.ts`](../../apps/web/lib/multiview-snap.ts), [`apps/web/tests/multiview-layout.cjs`](../../apps/web/tests/multiview-layout.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/multiview-source-aspect.cjs

[`apps/web/tests/multiview-source-aspect.cjs`](../../apps/web/tests/multiview-source-aspect.cjs)

Проверка/тестовый инструмент. PASS decoded source proportions and aspect-preserving slot resize; PASS stationary crop masks, aspect-preserving resize, explicit format precedence and grid bounds

Читает/импортирует: [`apps/web/lib/multiview-layout.ts`](../../apps/web/lib/multiview-layout.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/multiview-sources.cjs

[`apps/web/tests/multiview-sources.cjs`](../../apps/web/tests/multiview-sources.cjs)

Проверка/тестовый инструмент. PASS multiview source retention and reconnect

Читает/импортирует: [`apps/web/lib/multiview-sources.ts`](../../apps/web/lib/multiview-sources.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/node-control-plane-api.cjs

[`apps/web/tests/node-control-plane-api.cjs`](../../apps/web/tests/node-control-plane-api.cjs)

Проверка/тестовый инструмент. PASS: node control-plane reads and transfer mutations are HMAC signed, scoped and body-bound

Читает/импортирует: [`apps/web/lib/node-control-auth.ts`](../../apps/web/lib/node-control-auth.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/node-heartbeat.cjs

[`apps/web/tests/node-heartbeat.cjs`](../../apps/web/tests/node-heartbeat.cjs)

Проверка/тестовый инструмент. PASS: node heartbeat signing/auth rejects tampering and validates freshness/load fields

Читает/импортирует: [`apps/web/lib/node-heartbeat-auth.ts`](../../apps/web/lib/node-heartbeat-auth.ts), [`apps/web/lib/node-heartbeat.ts`](../../apps/web/lib/node-heartbeat.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `CASTLINK_NODE_SECRETS_JSON`.

### apps/web/tests/node-operations-postgres.cjs

[`apps/web/tests/node-operations-postgres.cjs`](../../apps/web/tests/node-operations-postgres.cjs)

Проверка/тестовый инструмент. PASS: actual PostgreSQL + LiveKit + Caddy: connected participant drain, forced eviction, denied old-token reconnect, re-enable, rename and kick revocation

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts).

Библиотеки/Node: `livekit-server-sdk`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_SERVER_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/node-operations.cjs

[`apps/web/tests/node-operations.cjs`](../../apps/web/tests/node-operations.cjs)

Проверка/тестовый инструмент. PASS: node lifecycle/acknowledgement, session-bound mutation, block-before-kick, body HMAC and same-token admission denial

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/node-scheduler.cjs

[`apps/web/tests/node-scheduler.cjs`](../../apps/web/tests/node-scheduler.cjs)

Проверка/тестовый инструмент. PASS: node scheduler enforces health/capacity, pinning, stable broadcast and deterministic placement

Читает/импортирует: [`apps/web/lib/node-scheduler.ts`](../../apps/web/lib/node-scheduler.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/output-image-browser.cjs

[`apps/web/tests/output-image-browser.cjs`](../../apps/web/tests/output-image-browser.cjs)

Проверка/тестовый инструмент. PASS real Firefox CSS: legacy and slot outputs honor saved zoom, pan, rotation, crop, flip and reset (6 cases)

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_PLAYWRIGHT_MODULE`.

### apps/web/tests/output-media-browser.py

[`apps/web/tests/output-media-browser.py`](../../apps/web/tests/output-media-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/output-source-quality.cjs

[`apps/web/tests/output-source-quality.cjs`](../../apps/web/tests/output-source-quality.cjs)

Проверка/тестовый инструмент. PASS legacy output: full source layer at every URL bitrate, reconnect, republish and source isolation

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`.

### apps/web/tests/output-track-bindings.cjs

[`apps/web/tests/output-track-bindings.cjs`](../../apps/web/tests/output-track-bindings.cjs)

Проверка/тестовый инструмент. PASS: 100 redundant events -> 1 attachment, 100 republish cycles leak-free, late events preserve replacement/audio; PASS: paused playback recovery, healthy no-restart, one inflight play, three-attempt bound, retry reset, cleanup race; PASS: hanging play deadline, bounded retry budget, retry after timeout, harmless late completion

Читает/импортирует: [`apps/web/lib/output-track-bindings.ts`](../../apps/web/lib/output-track-bindings.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/output-transparency.browser.cjs

[`apps/web/tests/output-transparency.browser.cjs`](../../apps/web/tests/output-transparency.browser.cjs)

Проверка/тестовый инструмент. PASS actual slot output: RGBA waiting/departed/released, immediate track cleanup, assigned media, reconnect, document cleanup; camera/screen, dark/light; proof

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`, `pngjs`.

Переменные окружения (только имена): `CASTLINK_OUTPUT_QA_OUT`, `CASTLINK_QA_CHROMIUM_BINARY`, `CASTLINK_QA_PLAYWRIGHT`.

### apps/web/tests/panel-session.cjs

[`apps/web/tests/panel-session.cjs`](../../apps/web/tests/panel-session.cjs)

Проверка/тестовый инструмент. PASS: moderator presentation with existing admin session, unchanged authorization, camera grants, confirmed publication and failures

Читает/импортирует: [`apps/web/tests/helpers/rate-limit.cjs`](../../apps/web/tests/helpers/rate-limit.cjs), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/parallel-studios.cjs

[`apps/web/tests/parallel-studios.cjs`](../../apps/web/tests/parallel-studios.cjs)

Проверка/тестовый инструмент. PASS: parallel primary rooms, command/lease isolation, clock skew, stale sample age, 2-second export, HTML escaping

Читает/импортирует: [`apps/web/lib/stats-report.ts`](../../apps/web/lib/stats-report.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STATS_DIR`, `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/participant-mute-api.cjs

[`apps/web/tests/participant-mute-api.cjs`](../../apps/web/tests/participant-mute-api.cjs)

Проверка/тестовый инструмент. PASS: guest media controls, scoped session revocation, linked talkback kick, and admin/main safety

Читает/импортирует: [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts).

Библиотеки/Node: `livekit-server-sdk`, `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/participant-role-api.cjs

[`apps/web/tests/participant-role-api.cjs`](../../apps/web/tests/participant-role-api.cjs)

Проверка/тестовый инструмент. PASS participant role actor matrix, scoped target SID, oneuse90s, revoke/recreate, existing staff credentials and panel navigation without media mutation

Читает/импортирует: [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/participant-role-client.cjs

[`apps/web/tests/participant-role-client.cjs`](../../apps/web/tests/participant-role-client.cjs)

Проверка/тестовый инструмент. PASS role offer expiry/role, exact panel scope, guest bearer and replay errors

Читает/импортирует: [`apps/web/lib/participant-role-client.ts`](../../apps/web/lib/participant-role-client.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/participant-role-lifecycle.cjs

[`apps/web/tests/participant-role-lifecycle.cjs`](../../apps/web/tests/participant-role-lifecycle.cjs)

Проверка/тестовый инструмент. PASS actual GuestRoleOffer hooks: same-session disconnect preserves valid ACK/retry; identity, token, room change and unmount invalidate it

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/participant-role-ui.cjs

[`apps/web/tests/participant-role-ui.cjs`](../../apps/web/tests/participant-role-ui.cjs)

Проверка/тестовый инструмент. PASS actual role UI handlers: accept exact SID before same-tab transition callback, cleanup retry without replay, failure/late response, decline and actor SID

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/participant-role.cjs

[`apps/web/tests/participant-role.cjs`](../../apps/web/tests/participant-role.cjs)

Проверка/тестовый инструмент. PASS: admin/moderator/guest roles and technical participant exclusion

Читает/импортирует: [`apps/web/lib/participant-role.ts`](../../apps/web/lib/participant-role.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/participant-video-resolution.cjs

[`apps/web/tests/participant-video-resolution.cjs`](../../apps/web/tests/participant-video-resolution.cjs)

Проверка/тестовый инструмент. PASS resolution API: owner/admin/moderator same-room controls, strict input, guest/staff/scope/SID rejection and metadata preservation

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`.

### apps/web/tests/participants-compact.browser.cjs

[`apps/web/tests/participants-compact.browser.cjs`](../../apps/web/tests/participants-compact.browser.cjs)

Проверка/тестовый инструмент. PASS compact participants: actual guest/source cards, studio/staff, 320/390/1440/1920/2560, max five columns, settings retained; proof

Читает/импортирует: [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/ParticipantSourceCard.tsx`](../../apps/web/components/ParticipantSourceCard.tsx), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `playwright`, `react`, `react-dom/server`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`.

### apps/web/tests/pdf-presentation-client.cjs

[`apps/web/tests/pdf-presentation-client.cjs`](../../apps/web/tests/pdf-presentation-client.cjs)

Проверка/тестовый инструмент. PASS PDF bridge monotonic commands, expiry, exact connection, close/network stop and page boundaries

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_TEST_ROOT`.

### apps/web/tests/pdf-presentation-range.cjs

[`apps/web/tests/pdf-presentation-range.cjs`](../../apps/web/tests/pdf-presentation-range.cjs)

Проверка/тестовый инструмент. PASS actual PDF.js File range transport: first page opens from bounded slices and retains original page geometry

Библиотеки/Node: `node:assert/strict`, `node:url`.

### apps/web/tests/pdf-presentation-viewer-load.cjs

[`apps/web/tests/pdf-presentation-viewer-load.cjs`](../../apps/web/tests/pdf-presentation-viewer-load.cjs)

Проверка/тестовый инструмент. PASS PDF inclusive limit, File range loading with no upfront arrayBuffer, progress and exact task cleanup

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/pdf-presentation-viewer-render.cjs

[`apps/web/tests/pdf-presentation-viewer-render.cjs`](../../apps/web/tests/pdf-presentation-viewer-render.cjs)

Проверка/тестовый инструмент. PASS actual PDF render effect atomically commits completed slide to visible capture canvas and preserves previous slide on render cancellation

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/persistent-json-retry.cjs

[`apps/web/tests/persistent-json-retry.cjs`](../../apps/web/tests/persistent-json-retry.cjs)

Проверка/тестовый инструмент. PASS atomic JSON: transient sharing retry, bounded denial, original state retained, temp cleanup

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/persistent-storage.cjs

[`apps/web/tests/persistent-storage.cjs`](../../apps/web/tests/persistent-storage.cjs)

Проверка/тестовый инструмент. PASS: production data dir, stable installation identity, mismatch guard and corrupt JSON startup failure

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `NODE_ENV`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_INSTALLATION_ID`.

### apps/web/tests/platform-access-postgres.cjs

[`apps/web/tests/platform-access-postgres.cjs`](../../apps/web/tests/platform-access-postgres.cjs)

Проверка/тестовый инструмент. PASS: migration 004, actual PostgreSQL concurrent one-use redemption, expiry, logout, global revoke, and private owner CLI output

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/platform-credentials.ts`](../../apps/web/lib/platform-credentials.ts).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/platform-access.cjs

[`apps/web/tests/platform-access.cjs`](../../apps/web/tests/platform-access.cjs)

Проверка/тестовый инструмент. PASS: creator-only bootstrap boundary, rejected tenant roles, legacy invalidation, one-use invitations, logout and global revocation

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/postgres-import-rooms.cjs

[`apps/web/tests/postgres-import-rooms.cjs`](../../apps/web/tests/postgres-import-rooms.cjs)

Проверка/тестовый инструмент. PASS: PostgreSQL migration/import is ordered, idempotent and refuses implicit overwrite

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `pg`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/postgres-room-store.cjs

[`apps/web/tests/postgres-room-store.cjs`](../../apps/web/tests/postgres-room-store.cjs)

Проверка/тестовый инструмент. PASS: PostgreSQL room store isolates studios, preserves order and serializes concurrent mutations

Читает/импортирует: [`apps/web/lib/postgres-room-store.ts`](../../apps/web/lib/postgres-room-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/presentation-control-api.cjs

[`apps/web/tests/presentation-control-api.cjs`](../../apps/web/tests/presentation-control-api.cjs)

Проверка/тестовый инструмент. PASS: public presentation API disabled with 410 before input/state access; retained offline pairing/scope/expiry/replay security regressions

Библиотеки/Node: `+name)},Date:{now:()=>now},Map,Symbol,globalThis:{},Buffer,Number,Response,TextEncoder,process:{env:{}}});return m.exports}
// The public route must not load credentials, live media or the retained
// implementation at all. Old tabs/helpers receive Gone before reading input.
const disabled={exports:{}};
vm.runInNewContext(transpile(`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/presentation-controls-lifecycle.cjs

[`apps/web/tests/presentation-controls-lifecycle.cjs`](../../apps/web/tests/presentation-controls-lifecycle.cjs)

Проверка/тестовый инструмент. PASS actual PDF start lifecycle: disconnect invalidates late pair/connect and revokes capability without auto reconnect

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/presentation-file-client.cjs

[`apps/web/tests/presentation-file-client.cjs`](../../apps/web/tests/presentation-file-client.cjs)

Проверка/тестовый инструмент. PASS client inclusive PDF/PPTX limit, conversion upload/download progress, cancellation, precise server error and invalid output

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/presentation-file.cjs

[`apps/web/tests/presentation-file.cjs`](../../apps/web/tests/presentation-file.cjs)

Проверка/тестовый инструмент. PASS actual streamed HTTP worker bytes/output, service errors, PDF validation, timeout, cancel, single job/cleanup, route auth-before-body

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:fs`, `node:fs/promises`, `node:http`, `node:os`, `node:path`.

### apps/web/tests/presentation-helper.cjs

[`apps/web/tests/presentation-helper.cjs`](../../apps/web/tests/presentation-helper.cjs)

Проверка/тестовый инструмент. PASS: macOS helper executes only fixed AppleScript navigation, quotes local deck title, rejects stale/replayed commands and refuses HTTP redirects

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:vm`.

### apps/web/tests/presentation-upload-memory.cjs

[`apps/web/tests/presentation-upload-memory.cjs`](../../apps/web/tests/presentation-upload-memory.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/presentation-upload-middleware.cjs

[`apps/web/tests/presentation-upload-middleware.cjs`](../../apps/web/tests/presentation-upload-middleware.cjs)

Проверка/тестовый инструмент. PASS: configured middleware clone size budget accepts a small multipart body for routes retaining middleware (large uploads bypass it)

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/constants`, `next/dist/server/body-streams`, `next/dist/server/config`, `node:assert/strict`, `node:crypto`, `node:path`, `node:stream`.

### apps/web/tests/presentation-upload-routing.cjs

[`apps/web/tests/presentation-upload-routing.cjs`](../../apps/web/tests/presentation-upload-routing.cjs)

Проверка/тестовый инструмент. PASS: upload bypasses Node middleware cloning, retains route-level maintenance before auth/body, and exposes sanitized error codes

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/dist/build/analysis/get-page-static-info`, `next/dist/shared/lib/router/utils/middleware-route-matcher`, `next/server`, `node:assert/strict`.

### apps/web/tests/presentation-upload-stream.cjs

[`apps/web/tests/presentation-upload-stream.cjs`](../../apps/web/tests/presentation-upload-stream.cjs)

Проверка/тестовый инструмент. PASS streaming multipart inclusive cap, every boundary split, framing, length mismatch, abort, owned cleanup

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

### apps/web/tests/private-program-continuity.browser.cjs

[`apps/web/tests/private-program-continuity.browser.cjs`](../../apps/web/tests/private-program-continuity.browser.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `/output.mjs`, `/reply.mjs`, `/screen.mjs`, `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`, `CASTLINK_QA_WORKSPACE_SOURCE`.

### apps/web/tests/private-talkback-audio.cjs

[`apps/web/tests/private-talkback-audio.cjs`](../../apps/web/tests/private-talkback-audio.cjs)

Проверка/тестовый инструмент. PRIVATE_TALKBACK_AUDIO_PASS

Читает/импортирует: [`apps/web/lib/private-talkback-audio.ts`](../../apps/web/lib/private-talkback-audio.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/private-talkback-controls.cjs

[`apps/web/tests/private-talkback-controls.cjs`](../../apps/web/tests/private-talkback-controls.cjs)

Проверка/тестовый инструмент. PRIVATE_TALKBACK_CONTROLS_PASS

Читает/импортирует: [`apps/web/components/GuestPrivateTalkback.tsx`](../../apps/web/components/GuestPrivateTalkback.tsx), [`apps/web/components/TalkbackControls.tsx`](../../apps/web/components/TalkbackControls.tsx), [`apps/web/lib/private-talkback-reply.ts`](../../apps/web/lib/private-talkback-reply.ts), [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/private-talkback-reply.cjs

[`apps/web/tests/private-talkback-reply.cjs`](../../apps/web/tests/private-talkback-reply.cjs)

Проверка/тестовый инструмент. PRIVATE_TALKBACK_REPLY_PASS

Читает/импортирует: [`apps/web/lib/private-talkback-reply.ts`](../../apps/web/lib/private-talkback-reply.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/production-deployment.cjs

[`apps/web/tests/production-deployment.cjs`](../../apps/web/tests/production-deployment.cjs)

Проверка/тестовый инструмент. PASS: production preflight, update/rollback and cross-platform installer safeguards

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`.

### apps/web/tests/public-room-entry.cjs

[`apps/web/tests/public-room-entry.cjs`](../../apps/web/tests/public-room-entry.cjs)

Проверка/тестовый инструмент. PASS: root studio authorization/create/login/logout, guest fragment boundary, root invitations, scoped simple controls and mutation catalogue refresh

Читает/импортирует: [`apps/web/components/GuestParticipantsTable.tsx`](../../apps/web/components/GuestParticipantsTable.tsx), [`apps/web/components/HomeLobby.tsx`](../../apps/web/components/HomeLobby.tsx), [`apps/web/components/RoomManagementPanel.tsx`](../../apps/web/components/RoomManagementPanel.tsx), [`apps/web/components/room-entry-url.ts`](../../apps/web/components/room-entry-url.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/rate-limit.cjs

[`apps/web/tests/rate-limit.cjs`](../../apps/web/tests/rate-limit.cjs)

Проверка/тестовый инструмент. PASS: bounded control-plane anti-abuse limits source/subject floods without touching media path

Читает/импортирует: [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/reconnect-recovery.cjs

[`apps/web/tests/reconnect-recovery.cjs`](../../apps/web/tests/reconnect-recovery.cjs)

Проверка/тестовый инструмент. PASS: reconnect phases, retry without refresh, output resubscribe, device fallback/restore and recovered UI

Читает/импортирует: [`apps/web/lib/reconnect-status.ts`](../../apps/web/lib/reconnect-status.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/remote-studio-devices.cjs

[`apps/web/tests/remote-studio-devices.cjs`](../../apps/web/tests/remote-studio-devices.cjs)

Проверка/тестовый инструмент. PASS: remote studio device kinds, selected IDs, live hot swap and transition lock, offline/pending states and device errors

Читает/импортирует: [`apps/web/components/RemoteStudioDevices.tsx`](../../apps/web/components/RemoteStudioDevices.tsx), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `react`, `react-dom/server`, `typescript`.

### apps/web/tests/render-native-pptx.cjs

[`apps/web/tests/render-native-pptx.cjs`](../../apps/web/tests/render-native-pptx.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `fs`, `path`, `react`, `react-dom/server`, `typescript`.

### apps/web/tests/reserve-health.cjs

[`apps/web/tests/reserve-health.cjs`](../../apps/web/tests/reserve-health.cjs)

Проверка/тестовый инструмент. reserve failure observation timing, health binding and ambiguity classification: PASS

Читает/импортирует: [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/reserve-heartbeat-worker.cjs

[`apps/web/tests/reserve-heartbeat-worker.cjs`](../../apps/web/tests/reserve-heartbeat-worker.cjs)

Проверка/тестовый инструмент. independent sender, media health, OFF, pending OFF and non-overlapping lifecycle: PASS

Читает/импортирует: [`apps/web/lib/reserve-heartbeat-worker.ts`](../../apps/web/lib/reserve-heartbeat-worker.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/reserve-heartbeat.cjs

[`apps/web/tests/reserve-heartbeat.cjs`](../../apps/web/tests/reserve-heartbeat.cjs)

Проверка/тестовый инструмент. outbound heartbeat absence/unhealthy/recovery/epoch/restart/replay: PASS

Читает/импортирует: [`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/reserve-source-protocol.cjs

[`apps/web/tests/reserve-source-protocol.cjs`](../../apps/web/tests/reserve-source-protocol.cjs)

Проверка/тестовый инструмент. legacy OFF is acknowledged; mixed-version ON remains refused: PASS

Читает/импортирует: [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/reserve-source-races.cjs

[`apps/web/tests/reserve-source-races.cjs`](../../apps/web/tests/reserve-source-races.cjs)

Проверка/тестовый инструмент. source viewer revocation serializes with delayed snapshot staging: PASS

Читает/импортирует: [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/room-access-version.cjs

[`apps/web/tests/room-access-version.cjs`](../../apps/web/tests/room-access-version.cjs)

Проверка/тестовый инструмент. PASS: legacy access versions bootstrap compatibly and persist

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_ROOMS_FILE`.

### apps/web/tests/room-chat-api.cjs

[`apps/web/tests/room-chat-api.cjs`](../../apps/web/tests/room-chat-api.cjs)

Проверка/тестовый инструмент. PASS: room chat token/current participant/scope/author/body/export authorization

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/room-chat-auth.cjs

[`apps/web/tests/room-chat-auth.cjs`](../../apps/web/tests/room-chat-auth.cjs)

Проверка/тестовый инструмент. PASS: real expired JWT recovery, distinct chat issuer/no media grants, current live nonce/kick/offline checks and bounded grace

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/room-chat-bearer.cjs

[`apps/web/tests/room-chat-bearer.cjs`](../../apps/web/tests/room-chat-bearer.cjs)

Проверка/тестовый инструмент. PASS chat bearer: pre-expiry renewal, identity URL/header, independent token, stale scope/input guard, bounded retries, timeout/unmount abort, disabled/opaque behavior

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/room-chat-clear-api.cjs

[`apps/web/tests/room-chat-clear-api.cjs`](../../apps/web/tests/room-chat-clear-api.cjs)

Проверка/тестовый инструмент. PASS room chat clear API: studio/admin/moderator, guest/revoked/cross-studio/cross-origin denial, recreated room guard, snapshot and stale sends

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/room-chat-clear-store.cjs

[`apps/web/tests/room-chat-clear-store.cjs`](../../apps/web/tests/room-chat-clear-store.cjs)

Проверка/тестовый инструмент. PASS room chat clear: durable atomic generation, stale-post rejection, scope isolation, queued authorization, retention, schema1 compatibility

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/room-chat-client.cjs

[`apps/web/tests/room-chat-client.cjs`](../../apps/web/tests/room-chat-client.cjs)

Проверка/тестовый инструмент. PASS: durable/live canonical chat merge, server author, expiry, scope baseline

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/room-chat-hook.cjs

[`apps/web/tests/room-chat-hook.cjs`](../../apps/web/tests/room-chat-hook.cjs)

Проверка/тестовый инструмент. PASS: persistent room chat restore/read baseline/stable SDK/idempotent retry/durable fallback/scope race

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/room-chat-store.cjs

[`apps/web/tests/room-chat-store.cjs`](../../apps/web/tests/room-chat-store.cjs)

Проверка/тестовый инструмент. PASS room chat: durable module reload/concurrent writes, exact 24h purge, idempotence/conflicts, author/scope isolation, server time, validation, fail-closed corruption, bounded owned-file cleanup

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/room-creation-access.cjs

[`apps/web/tests/room-creation-access.cjs`](../../apps/web/tests/room-creation-access.cjs)

Проверка/тестовый инструмент. PASS room creation: separate server secret, fail closed, real store, unchanged login/join, CSRF/rate limit, alternate API guest denial and existing staff authorization

Читает/импортирует: [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `ROOM_CREATION_PASSWORD`, `ROOM_CREATION_PASSWORD_SHA256`, `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/tests/room-creation-password-settings.cjs

[`apps/web/tests/room-creation-password-settings.cjs`](../../apps/web/tests/room-creation-password-settings.cjs)

Проверка/тестовый инструмент. PASS creation password settings: authenticated rotation, immediate revocation, persistent restart, CSRF/roles/validation, concurrency, unchanged rooms and fail-closed corruption

Читает/импортирует: [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`apps/web/lib/room-creation-access.ts`](../../apps/web/lib/room-creation-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `ROOM_CREATION_PASSWORD`, `ROOM_CREATION_PASSWORD_SHA256`, `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/tests/room-creation-password-ui.cjs

[`apps/web/tests/room-creation-password-ui.cjs`](../../apps/web/tests/room-creation-password-ui.cjs)

Проверка/тестовый инструмент. PASS password UI: dedicated tab placement, masked fields, confirmation, single submit, busy/success and secret clearing

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/room-mode-monitoring.cjs

[`apps/web/tests/room-mode-monitoring.cjs`](../../apps/web/tests/room-mode-monitoring.cjs)

Проверка/тестовый инструмент. PASS: studio-only controls and moderator local listen defaults, gain, explicit audio unlock, no publication, and cleanup; PASS: guest entry resets only Studio Return saved OFF preferences; current-entry OFF/reconnect and other-guest preferences remain intact

Читает/импортирует: [`apps/web/lib/personal-monitoring.ts`](../../apps/web/lib/personal-monitoring.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/room-reactions-ui.browser.cjs

[`apps/web/tests/room-reactions-ui.browser.cjs`](../../apps/web/tests/room-reactions-ui.browser.cjs)

Проверка/тестовый инструмент. PASS reactions/emoji real controls: paired peer delivery, centered expiry, no chat write,24/7 menus, compact mobile,both themes,keyboard and disconnect; proof

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`, `CASTLINK_QA_PLAYWRIGHT`, `CASTLINK_REACTIONS_QA_OUT`, `CASTLINK_RUNTIME_QA_PUBLIC`.

### apps/web/tests/room-reactions.cjs

[`apps/web/tests/room-reactions.cjs`](../../apps/web/tests/room-reactions.cjs)

Проверка/тестовый инструмент. PASS: room reactions validation/dedupe/rate bound/transient transport/scope cleanup and chat emoji text integrity

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/room-staff-controls.cjs

[`apps/web/tests/room-staff-controls.cjs`](../../apps/web/tests/room-staff-controls.cjs)

Проверка/тестовый инструмент. PASS room/staff JSX: legacy scope, verified bearer and confirmed ON AIR state with accessible action

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/room-store-backend.cjs

[`apps/web/tests/room-store-backend.cjs`](../../apps/web/tests/room-store-backend.cjs)

Проверка/тестовый инструмент. PASS: room-store backend preserves default room, versioned JSON and serialized mutations

Читает/импортирует: [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `NODE_ENV`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_ROOMS_FILE`.

### apps/web/tests/room-studio-access.cjs

[`apps/web/tests/room-studio-access.cjs`](../../apps/web/tests/room-studio-access.cjs)

Проверка/тестовый инструмент. PASS room creator identity, durable login, rename/recreate isolation, scope and guest separation

Читает/импортирует: [`apps/web/app/api/admin-access/route.ts`](../../apps/web/app/api/admin-access/route.ts), [`apps/web/app/api/invites/route.ts`](../../apps/web/app/api/invites/route.ts), [`apps/web/app/api/moderator-access/route.ts`](../../apps/web/app/api/moderator-access/route.ts), [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/rooms/route.ts`](../../apps/web/app/api/rooms/route.ts), [`apps/web/app/api/studio-control/route.ts`](../../apps/web/app/api/studio-control/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `CASTLINK_STORAGE_BACKEND`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `ROOM_CREATION_PASSWORD`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_ROOMS_FILE`.

### apps/web/tests/rotation-api.cjs

[`apps/web/tests/rotation-api.cjs`](../../apps/web/tests/rotation-api.cjs)

Проверка/тестовый инструмент. PASS: rotation authorization, room scope, primary protection, metadata preservation, four quarter turns

Читает/импортирует: [`apps/web/tests/helpers/rate-limit.cjs`](../../apps/web/tests/helpers/rate-limit.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/rtc-telemetry-audio.cjs

[`apps/web/tests/rtc-telemetry-audio.cjs`](../../apps/web/tests/rtc-telemetry-audio.cjs)

Проверка/тестовый инструмент. PASS: audio-first 1000ms collection budget, hung-track playback diagnostics, pruned track counters, interval sampling, no post-stop writes

Читает/импортирует: [`apps/web/lib/audio-diagnostics.ts`](../../apps/web/lib/audio-diagnostics.ts), [`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts), [`apps/web/lib/telemetry-context.ts`](../../apps/web/lib/telemetry-context.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:crypto`, `node:events`, `node:fs`, `node:module`, `node:vm`, `typescript`.

### apps/web/tests/run-ci.cjs

[`apps/web/tests/run-ci.cjs`](../../apps/web/tests/run-ci.cjs)

Проверка/тестовый инструмент. \nPASS: ${tests.length + 3} stable CI tests\n

Библиотеки/Node: `node:child_process`, `node:path`.

### apps/web/tests/runtime-observer-pg-fixture.cjs

[`apps/web/tests/runtime-observer-pg-fixture.cjs`](../../apps/web/tests/runtime-observer-pg-fixture.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`, `pg`.

Используют: [`apps/web/tests/host-runtime-startup-postgres.cjs`](../../apps/web/tests/host-runtime-startup-postgres.cjs), [`apps/web/tests/runtime-startup-observe-postgres.cjs`](../../apps/web/tests/runtime-startup-observe-postgres.cjs).

Переменные окружения (только имена): `TEST_DATABASE_URL`.

### apps/web/tests/runtime-startup-observe-postgres.cjs

[`apps/web/tests/runtime-startup-observe-postgres.cjs`](../../apps/web/tests/runtime-startup-observe-postgres.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/tests/runtime-observer-pg-fixture.cjs`](../../apps/web/tests/runtime-observer-pg-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `pg`.

Переменные окружения (только имена): `RUNTIME_OBSERVER_RED_BASELINE`, `TEST_DATABASE_URL`.

### apps/web/tests/saved-servers.cjs

[`apps/web/tests/saved-servers.cjs`](../../apps/web/tests/saved-servers.cjs)

Проверка/тестовый инструмент. saved server validation passed

Читает/импортирует: [`apps/web/lib/saved-servers.ts`](../../apps/web/lib/saved-servers.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/screen-share-lifecycle.cjs

[`apps/web/tests/screen-share-lifecycle.cjs`](../../apps/web/tests/screen-share-lifecycle.cjs)

Проверка/тестовый инструмент. PASS: screen share publishes, cancels cleanly, requests optional audio, and stops late capture after disconnect

Читает/импортирует: [`apps/web/lib/screen-share.ts`](../../apps/web/lib/screen-share.ts).

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/screen-share-stop-button.cjs

[`apps/web/tests/screen-share-stop-button.cjs`](../../apps/web/tests/screen-share-stop-button.cjs)

Проверка/тестовый инструмент. screen share stop panel actual button bindings: PASS

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:events`.

### apps/web/tests/screen-share-stop-panel.cjs

[`apps/web/tests/screen-share-stop-panel.cjs`](../../apps/web/tests/screen-share-stop-panel.cjs)

Проверка/тестовый инструмент. screen share stop panel actual DOM/controller: PASS

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/security-url-secrets.cjs

[`apps/web/tests/security-url-secrets.cjs`](../../apps/web/tests/security-url-secrets.cjs)

Проверка/тестовый инструмент. PASS: guest/output secrets are generated in fragments and exchanged outside URL query

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/self-hosted-setup.cjs

[`apps/web/tests/self-hosted-setup.cjs`](../../apps/web/tests/self-hosted-setup.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/app/api/setup/route.ts`](../../apps/web/app/api/setup/route.ts), [`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:test`, `node:vm`, `react-dom/server`, `typescript`.

Переменные окружения (только имена): `CASTLINK_DEPLOYMENT_MODEL`, `CASTLINK_LICENSE_SERVICE_URL`, `CASTLINK_SERVER_ID`, `CASTLINK_SETUP_TOKEN`, `FIXTURE_QUERY_FILE`, `NODE_ENV`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/server-connections.cjs

[`apps/web/tests/server-connections.cjs`](../../apps/web/tests/server-connections.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`, `typescript`.

### apps/web/tests/server-logging.cjs

[`apps/web/tests/server-logging.cjs`](../../apps/web/tests/server-logging.cjs)

Проверка/тестовый инструмент. PASS: structured logging covers auth, rooms, token issuance, control-plane, node heartbeat and failover while redacting sensitive fields

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/server-profile-removal.cjs

[`apps/web/tests/server-profile-removal.cjs`](../../apps/web/tests/server-profile-removal.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/lib/server-profile-removal.ts`](../../apps/web/lib/server-profile-removal.ts), [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`, `STUDIOLINK_INSTALLATION_ID`.

### apps/web/tests/server-provisioning-api.cjs

[`apps/web/tests/server-provisioning-api.cjs`](../../apps/web/tests/server-provisioning-api.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/rate-limit.ts`](../../apps/web/lib/rate-limit.ts), [`scripts/server-profile-store.mjs`](../../scripts/server-profile-store.mjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:test`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`.

### apps/web/tests/server-provisioning-operator.cjs

[`apps/web/tests/server-provisioning-operator.cjs`](../../apps/web/tests/server-provisioning-operator.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/app/api/server-provisioning/operator/route.ts`](../../apps/web/app/api/server-provisioning/operator/route.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SETUP_TOKEN`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_INSTALLATION_ID`.

### apps/web/tests/server-provisioning-ssh.cjs

[`apps/web/tests/server-provisioning-ssh.cjs`](../../apps/web/tests/server-provisioning-ssh.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/lib/server-provisioning-ssh.ts`](../../apps/web/lib/server-provisioning-ssh.ts).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:test`, `ssh2`, `typescript`.

### apps/web/tests/server-provisioning.cjs

[`apps/web/tests/server-provisioning.cjs`](../../apps/web/tests/server-provisioning.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-provisioning.ts`](../../apps/web/lib/server-provisioning.ts), [`scripts/server-provisioning-ssh.mjs`](../../scripts/server-provisioning-ssh.mjs), [`scripts/server-provisioning.mjs`](../../scripts/server-provisioning.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`, `ssh2`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_TRANSFER_ORIGIN`.

### apps/web/tests/server-registry.cjs

[`apps/web/tests/server-registry.cjs`](../../apps/web/tests/server-registry.cjs)

Проверка/тестовый инструмент. PASS: server registry is Super-Admin-only and keeps signed lease server-side

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/server-reserve-api.cjs

[`apps/web/tests/server-reserve-api.cjs`](../../apps/web/tests/server-reserve-api.cjs)

Проверка/тестовый инструмент. server reserve route staging/CORS/cohort roles/expiry/manual activation/receipts: PASS

Читает/импортирует: [`apps/web/app/api/server-reserve/route.ts`](../../apps/web/app/api/server-reserve/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/reserve-heartbeat-worker.ts`](../../apps/web/lib/reserve-heartbeat-worker.ts), [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_RESERVE_TEST_REVOKE_KIND`, `STUDIOLINK_INSTALLATION_ID`.

### apps/web/tests/server-reserve-automatic.cjs

[`apps/web/tests/server-reserve-automatic.cjs`](../../apps/web/tests/server-reserve-automatic.cjs)

Проверка/тестовый инструмент. automatic reserve independent timing, policy CAS, revision rollover, disable and shared manual operation: PASS

Читает/импортирует: [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/server-reserve-live.browser.cjs

[`apps/web/tests/server-reserve-live.browser.cjs`](../../apps/web/tests/server-reserve-live.browser.cjs)

Проверка/тестовый инструмент. PASS target five participant roles; PASS planned A to B to A; PASS no automatic transfer during complete public source outage; PASS all five moved after manual emergency click

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:module`, `node:path`.

Переменные окружения (только имена): `CASTLINK_RESERVE_ALLOW_STOP`, `CASTLINK_RESERVE_QA_FIXTURE`.

### apps/web/tests/server-reserve-outbound-lifecycle.cjs

[`apps/web/tests/server-reserve-outbound-lifecycle.cjs`](../../apps/web/tests/server-reserve-outbound-lifecycle.cjs)

Проверка/тестовый инструмент. actual target lease after veto retry; prepare failure permits OFF and refresh: PASS

Читает/импортирует: [`apps/web/lib/persistent-storage.ts`](../../apps/web/lib/persistent-storage.ts), [`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts).

Библиотеки/Node: `livekit-server-sdk`, `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_STORAGE_BACKEND`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/server-reserve-outbound.cjs

[`apps/web/tests/server-reserve-outbound.cjs`](../../apps/web/tests/server-reserve-outbound.cjs)

Проверка/тестовый инструмент. NAT no-inbound activation, 20s window, healthy-during-install veto and idempotent commit: PASS

Читает/импортирует: [`apps/web/lib/reserve-heartbeat.ts`](../../apps/web/lib/reserve-heartbeat.ts), [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/server-reserve-roundtrip.cjs

[`apps/web/tests/server-reserve-roundtrip.cjs`](../../apps/web/tests/server-reserve-roundtrip.cjs)

Проверка/тестовый инструмент. returned installed generation recovers historical source and permits a fresh reserve/planned disarm: PASS

Читает/импортирует: [`apps/web/lib/reserve-source.ts`](../../apps/web/lib/reserve-source.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts).

Библиотеки/Node: `node:fs`, `node:module`, `node:path`.

### apps/web/tests/server-reserve-state.cjs

[`apps/web/tests/server-reserve-state.cjs`](../../apps/web/tests/server-reserve-state.cjs)

Проверка/тестовый инструмент. server reserve durable grants, manual activation, CAS, disarm and receipts: PASS

Читает/импортирует: [`apps/web/lib/server-reserve.ts`](../../apps/web/lib/server-reserve.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/server-slots-authority.cjs

[`apps/web/tests/server-slots-authority.cjs`](../../apps/web/tests/server-slots-authority.cjs)

Проверка/тестовый инструмент. PASS restored studio issuance: no owner password, real admin/moderator acceptance, scoped slots, unauthorized/cross-room denial and server issuer removed

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

Переменные окружения (только имена): `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/tests/server-slots-postgres.cjs

[`apps/web/tests/server-slots-postgres.cjs`](../../apps/web/tests/server-slots-postgres.cjs)

Проверка/тестовый инструмент. PASS PostgreSQL: migrations twice, stable room association, concurrent CAS, rollback, tenant isolation, deleted room, role revocation

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `pg`.

Переменные окружения (только имена): `TEST_DATABASE_URL`.

### apps/web/tests/server-transfer-api.cjs

[`apps/web/tests/server-transfer-api.cjs`](../../apps/web/tests/server-transfer-api.cjs)

Проверка/тестовый инструмент. PASS: studio authorization, token-scoped guest migration, legacy cutoff, snapshot failure, empty-room studio handoff, signed bridge, collision protection, and one-use ticket exchange

Читает/импортирует: [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `STUDIOLINK_STUDIO_CONTROL_FILE`, `STUDIOLINK_STUDIO_PASSWORD_HASH`, `STUDIOLINK_TRANSFER_ORIGIN`, `STUDIOLINK_TRANSFER_PEER_ORIGIN`, `STUDIOLINK_TRANSFER_SECRET`, `STUDIOLINK_TRANSFER_SERVER_ID`, `STUDIOLINK_TRANSFER_SERVER_LABEL`, `STUDIOLINK_TRANSFER_STATE_FILE`, `STUDIOLINK_TRANSFER_TARGETS_JSON`.

### apps/web/tests/server-transfer-creators.cjs

[`apps/web/tests/server-transfer-creators.cjs`](../../apps/web/tests/server-transfer-creators.cjs)

Проверка/тестовый инструмент. PASS: creator transfer scope, unavailable target preserves source, original expiry and no global elevation

Читает/импортирует: [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-profile-removal.ts`](../../apps/web/lib/server-profile-removal.ts), [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `ROOM_CREATION_PASSWORD`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_ROOMS_FILE`, `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/tests/server-transfer-staff.cjs

[`apps/web/tests/server-transfer-staff.cjs`](../../apps/web/tests/server-transfer-staff.cjs)

Проверка/тестовый инструмент. PASS: captured additional studio/admin/moderator sessions preserve role/expiry and enforce current revocation

Читает/импортирует: [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/app/api/token/route.ts`](../../apps/web/app/api/token/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-admin.ts`](../../apps/web/lib/room-admin.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/room-studio-access.ts`](../../apps/web/lib/room-studio-access.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/server-transfer.cjs

[`apps/web/tests/server-transfer.cjs`](../../apps/web/tests/server-transfer.cjs)

Проверка/тестовый инструмент. PASS: signed peer requests, origin allowlist, role-bound one-use ticket material, and transfer state expiry

Читает/импортирует: [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_TRANSFER_PEER_ORIGIN`, `STUDIOLINK_TRANSFER_SECRET`, `STUDIOLINK_TRANSFER_SERVER_ID`, `STUDIOLINK_TRANSFER_SERVER_LABEL`, `STUDIOLINK_TRANSFER_STATE_FILE`, `STUDIOLINK_TRANSFER_TARGETS_JSON`.

### apps/web/tests/session-transfer-hook.cjs

[`apps/web/tests/session-transfer-hook.cjs`](../../apps/web/tests/session-transfer-hook.cjs)

Проверка/тестовый инструмент. PASS: actual transfer hook effects prepare all roles, survive source outage, observe manual activation, disconnect once and clean up timers

Читает/импортирует: [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/session-transfer-renewal.cjs

[`apps/web/tests/session-transfer-renewal.cjs`](../../apps/web/tests/session-transfer-renewal.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/lib/use-session-transfer.ts`](../../apps/web/lib/use-session-transfer.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:test`, `typescript`.

### apps/web/tests/setup-database-postgres.cjs

[`apps/web/tests/setup-database-postgres.cjs`](../../apps/web/tests/setup-database-postgres.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `pg`.

Переменные окружения (только имена): `TEST_DATABASE_URL`.

### apps/web/tests/setup-observe-postgres.cjs

[`apps/web/tests/setup-observe-postgres.cjs`](../../apps/web/tests/setup-observe-postgres.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`, `pg`.

Переменные окружения (только имена): `CASTLINK_NODE_ID`, `DATABASE_URL`, `TEST_DATABASE_URL`.

### apps/web/tests/setup-owner-postgres.cjs

[`apps/web/tests/setup-owner-postgres.cjs`](../../apps/web/tests/setup-owner-postgres.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:net`, `node:os`, `node:path`, `node:test`, `pg`.

Переменные окружения (только имена): `TEST_DATABASE_URL`.

### apps/web/tests/setup-wizard.cjs

[`apps/web/tests/setup-wizard.cjs`](../../apps/web/tests/setup-wizard.cjs)

Проверка/тестовый инструмент. PASS: first-run setup token is one-time gated and never persisted

Читает/импортирует: [`apps/web/lib/setup-state.ts`](../../apps/web/lib/setup-state.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_DEPLOYMENT_MODEL`, `CASTLINK_SETUP_TOKEN`, `NODE_ENV`, `STUDIOLINK_DATA_DIR`.

### apps/web/tests/slot-output-api.cjs

[`apps/web/tests/slot-output-api.cjs`](../../apps/web/tests/slot-output-api.cjs)

Проверка/тестовый инструмент. PASS output API: source-bound capability, no publication/control, scoped room, rotated link revoked

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`.

Переменные окружения (только имена): `CASTLINK_HOSTED_ACCESS`.

### apps/web/tests/slot-output-controller.cjs

[`apps/web/tests/slot-output-controller.cjs`](../../apps/web/tests/slot-output-controller.cjs)

Проверка/тестовый инструмент. PASS slot output: generation/revision, source isolation, clear-before-replace, late detach, disposal

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/slot-output-hosted-http.cjs

[`apps/web/tests/slot-output-hosted-http.cjs`](../../apps/web/tests/slot-output-hosted-http.cjs)

Проверка/тестовый инструмент. PASS production HTTP: hosted without cookies, camera/screen readonly tokens, missing/forged/cross-source denied, camera rotation preserves screen

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:net`, `node:os`, `node:path`.

### apps/web/tests/slot-output-media.cjs

[`apps/web/tests/slot-output-media.cjs`](../../apps/web/tests/slot-output-media.cjs)

Проверка/тестовый инструмент. PASS slot output: authenticated caster transforms, camera/screen isolation, highest layer on subscribe and reconnect

Читает/импортирует: [`apps/web/lib/slot-output-controller.ts`](../../apps/web/lib/slot-output-controller.ts), [`apps/web/lib/studio-image-transform.ts`](../../apps/web/lib/studio-image-transform.ts), [`apps/web/lib/video-fit.ts`](../../apps/web/lib/video-fit.ts).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/staff-chat-panel.cjs

[`apps/web/tests/staff-chat-panel.cjs`](../../apps/web/tests/staff-chat-panel.cjs)

Проверка/тестовый инструмент. staff chat actual panel: PASS

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/staff-conference-scene.cjs

[`apps/web/tests/staff-conference-scene.cjs`](../../apps/web/tests/staff-conference-scene.cjs)

Проверка/тестовый инструмент. PASS natural-height staff deck retains exact camera/screen cards, roster selection and receive-only room; PASS natural-height studio deck retains controller nodes and distinct camera/screen cards; PASS actual primary studio staff action is visible, session scoped, and absent for self/secondary studio

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/staff-display-name.cjs

[`apps/web/tests/staff-display-name.cjs`](../../apps/web/tests/staff-display-name.cjs)

Проверка/тестовый инструмент. PASS: 20 simultaneous staff logins, stable retry, room/role isolation, manual names and expiry

Читает/импортирует: [`apps/web/lib/staff-display-name.ts`](../../apps/web/lib/staff-display-name.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/staff-participants-panel.cjs

[`apps/web/tests/staff-participants-panel.cjs`](../../apps/web/tests/staff-participants-panel.cjs)

Проверка/тестовый инструмент. PASS actual studio/admin/mod sources: Return camera excluded, real primary screens and guests preserved, roles/self/rotation retained, no visible raw debug

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/staff-room-chat-hook.cjs

[`apps/web/tests/staff-room-chat-hook.cjs`](../../apps/web/tests/staff-room-chat-hook.cjs)

Проверка/тестовый инструмент. staff room chat actual hook bindings: PASS

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/staff-room-chat.cjs

[`apps/web/tests/staff-room-chat.cjs`](../../apps/web/tests/staff-room-chat.cjs)

Проверка/тестовый инструмент. staff room chat state: PASS

Читает/импортирует: [`apps/web/tests/load-typescript.cjs`](../../apps/web/tests/load-typescript.cjs).

Библиотеки/Node: `node:assert/strict`.

### apps/web/tests/statistics-dashboard-refresh.cjs

[`apps/web/tests/statistics-dashboard-refresh.cjs`](../../apps/web/tests/statistics-dashboard-refresh.cjs)

Проверка/тестовый инструмент. PASS: statistics refresh requests use current primary or moderator credentials

Читает/импортирует: [`apps/web/components/StatisticsDashboard.tsx`](../../apps/web/components/StatisticsDashboard.tsx), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/statistics-filters.cjs

[`apps/web/tests/statistics-filters.cjs`](../../apps/web/tests/statistics-filters.cjs)

Проверка/тестовый инструмент. PASS: statistics role/participant/session filters and detailed report wiring

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/stats-api.cjs

[`apps/web/tests/stats-api.cjs`](../../apps/web/tests/stats-api.cjs)

Проверка/тестовый инструмент. PASS: studio login/logout, guest passwords, role bypass protection, viewer links, kick authorization, stats ingestion/periods/reset, preserved graphs, protected commands, pages

Библиотеки/Node: `node:assert/strict`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_STUDIO_PASSWORD`.

### apps/web/tests/stats-multi-client.cjs

[`apps/web/tests/stats-multi-client.cjs`](../../apps/web/tests/stats-multi-client.cjs)

Проверка/тестовый инструмент. PASS: two actual studio logins read the same history without media or primary lease; audio detail, expired media token, anonymous/guest/moderator/room/tenant isolation and password revocation

Читает/импортирует: [`apps/web/app/api/room-studio-access/route.ts`](../../apps/web/app/api/room-studio-access/route.ts), [`apps/web/app/api/stats/route.ts`](../../apps/web/app/api/stats/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/moderator-access.ts`](../../apps/web/lib/moderator-access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

Библиотеки/Node: `next/server`, `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `ROOM_CREATION_PASSWORD`.

### apps/web/tests/storage-backup-restore.cjs

[`apps/web/tests/storage-backup-restore.cjs`](../../apps/web/tests/storage-backup-restore.cjs)

Проверка/тестовый инструмент. PASS: backup manifest/checksums, full restore, installation guard and tamper detection

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`.

### apps/web/tests/studio-access-isolation.cjs

[`apps/web/tests/studio-access-isolation.cjs`](../../apps/web/tests/studio-access-isolation.cjs)

Проверка/тестовый инструмент. PASS: guest cookies, invites, viewer grants and media rooms are isolated by studioId

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/studio-scope.ts`](../../apps/web/lib/studio-scope.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`, `STUDIOLINK_DEFAULT_STUDIO_ID`.

### apps/web/tests/studio-auth-isolation.cjs

[`apps/web/tests/studio-auth-isolation.cjs`](../../apps/web/tests/studio-auth-isolation.cjs)

Проверка/тестовый инструмент. PASS: guest/moderator access is scoped by studio and cross-studio reuse is rejected

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`, `LIVEKIT_API_SECRET`.

### apps/web/tests/studio-auto-preview.cjs

[`apps/web/tests/studio-auto-preview.cjs`](../../apps/web/tests/studio-auto-preview.cjs)

Проверка/тестовый инструмент. PASS: actual automatic preview is once per ready session/device, primary-only, bounded on denial/cancellation; audio unlock is guarded; transfer ON AIR recovery remains gated and once

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/studio-caster-color-controls.browser.cjs

[`apps/web/tests/studio-caster-color-controls.browser.cjs`](../../apps/web/tests/studio-caster-color-controls.browser.cjs)

Проверка/тестовый инструмент. PASS caster correction: actual guest card/save queue, exposure+contrast only, geometry-preserving color reset, complete reset, 240/300/350/440px RU/EN/ZH dark/light;

Экспортируемые символы: `RoomEvent`, `useI18n`.

Читает/импортирует: [`apps/web/components/GuestAudioMeter.tsx`](../../apps/web/components/GuestAudioMeter.tsx), [`apps/web/components/GuestVideoCard.tsx`](../../apps/web/components/GuestVideoCard.tsx), [`apps/web/components/StudioCasterImageControls.tsx`](../../apps/web/components/StudioCasterImageControls.tsx), [`apps/web/lib/i18n.ts`](../../apps/web/lib/i18n.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `react`, `react-dom/client`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM_BINARY`, `CASTLINK_QA_PLAYWRIGHT`.

### apps/web/tests/studio-caster-image-api.cjs

[`apps/web/tests/studio-caster-image-api.cjs`](../../apps/web/tests/studio-caster-image-api.cjs)

Проверка/тестовый инструмент. PASS studio receiver image transform authorization, SID rejection, bounds, metadata preservation and no guest commands

Читает/импортирует: [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts), [`apps/web/tests/helpers/rate-limit.cjs`](../../apps/web/tests/helpers/rate-limit.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:vm`, `typescript`.

### apps/web/tests/studio-control-api.cjs

[`apps/web/tests/studio-control-api.cjs`](../../apps/web/tests/studio-control-api.cjs)

Проверка/тестовый инструмент. PASS: studio primary lease, moderator command authorization, validation, bounded requests, and non-publishing moderator token

Библиотеки/Node: `node:assert/strict`.

Переменные окружения (только имена): `TEST_BASE_URL`, `TEST_STUDIO_PASSWORD`.

### apps/web/tests/studio-control-devices.cjs

[`apps/web/tests/studio-control-devices.cjs`](../../apps/web/tests/studio-control-devices.cjs)

Проверка/тестовый инструмент. PASS: studio device command validation, input-transition lock, offline lease, and epoch reset

Читает/импортирует: [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/studio-control-plane-api.cjs

[`apps/web/tests/studio-control-plane-api.cjs`](../../apps/web/tests/studio-control-plane-api.cjs)

Проверка/тестовый инструмент. PASS: studio control-plane API is Super-Admin-only and mutation requests require same-origin

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-device-control-panel.cjs

[`apps/web/tests/studio-device-control-panel.cjs`](../../apps/web/tests/studio-device-control-panel.cjs)

Проверка/тестовый инструмент. PASS: Studio device control extraction preserves local/remote device wiring

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `typescript`.

### apps/web/tests/studio-image-transform.cjs

[`apps/web/tests/studio-image-transform.cjs`](../../apps/web/tests/studio-image-transform.cjs)

Проверка/тестовый инструмент. PASS receiver-only transform applies and resets CSS without capture or track processing; PASS optimistic transform isolates receiving rooms and participant sessions and cleans up listeners; PASS stale participant cleanup preserves the replacement session preview; PASS actual correction controls preserve geometry, queue edits, reset color only, reconnect with replacement SID and reject stale responses

Читает/импортирует: [`apps/web/lib/multiview-image.ts`](../../apps/web/lib/multiview-image.ts), [`apps/web/lib/studio-image-transform.ts`](../../apps/web/lib/studio-image-transform.ts).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/studio-invite-layout-browser.py

[`apps/web/tests/studio-invite-layout-browser.py`](../../apps/web/tests/studio-invite-layout-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

### apps/web/tests/studio-live-devices.cjs

[`apps/web/tests/studio-live-devices.cjs`](../../apps/web/tests/studio-live-devices.cjs)

Проверка/тестовый инструмент. PASS: direct ON AIR capture, atomic live input replacement/rollback, persistent scoped device choices; PASS: OFF AIR and failed Return publication preserve independent screen video/audio sources; PASS: actual capture lifecycle preserves old program on open failure and commits replacement before disposing old capture; PASS: output mute also gates capture graphs pending sender replacement; PASS: program gain stays independent of private replies and double-failure stops uncertain senders; PASS: muted automatic video preparation completes while native audio resume remains pending; PASS: actual final-disconnect handler invalidates pending native capture, stops late tracks and prevents preview reattachment/publication; PASS: quality and capture changes share one serialized transaction queue

Читает/импортирует: [`apps/web/lib/studio-device-session.ts`](../../apps/web/lib/studio-device-session.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/studio-main-scope.cjs

[`apps/web/tests/studio-main-scope.cjs`](../../apps/web/tests/studio-main-scope.cjs)

Проверка/тестовый инструмент. PASS: main studio UI preserves studioId across room, token and control operations

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-moderator-monitoring.cjs

[`apps/web/tests/studio-moderator-monitoring.cjs`](../../apps/web/tests/studio-moderator-monitoring.cjs)

Проверка/тестовый инструмент. PASS: moderator Studio monitoring extraction preserves personal monitoring callbacks

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-outbound-poll.cjs

[`apps/web/tests/studio-outbound-poll.cjs`](../../apps/web/tests/studio-outbound-poll.cjs)

Проверка/тестовый инструмент. PASS: actual main Studio polling samples once, reports flowing H264 layers/single stream and preserves last measurement on unavailable stats

Читает/импортирует: [`apps/web/lib/media-stats.ts`](../../apps/web/lib/media-stats.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/lib/studio-sender-stats.ts`](../../apps/web/lib/studio-sender-stats.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/studio-outbound-stats.cjs

[`apps/web/tests/studio-outbound-stats.cjs`](../../apps/web/tests/studio-outbound-stats.cjs)

Проверка/тестовый инструмент. PASS: primary outbound snapshot, moderator mirror, bounded history, stale/offline/reset guards

Читает/импортирует: [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/studio-output-api.cjs

[`apps/web/tests/studio-output-api.cjs`](../../apps/web/tests/studio-output-api.cjs)

Проверка/тестовый инструмент. PASS studio output API admin authorization, restricted denial, primary lease retained

Читает/импортирует: [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:vm`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/studio-output-source.cjs

[`apps/web/tests/studio-output-source.cjs`](../../apps/web/tests/studio-output-source.cjs)

Проверка/тестовый инструмент. PASS studio source validation, camera-free black capture, independent output mute; PASS source transition blocks ON AIR until new capture ready

Читает/импортирует: [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-output-source.ts`](../../apps/web/lib/studio-output-source.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:vm`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/studio-owner-access-postgres.cjs

[`apps/web/tests/studio-owner-access-postgres.cjs`](../../apps/web/tests/studio-owner-access-postgres.cjs)

Проверка/тестовый инструмент. PASS: signed owner-links are isolated per Studio and revocation is tenant-local

Читает/импортирует: [`apps/web/lib/control-plane-store.ts`](../../apps/web/lib/control-plane-store.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `pg`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DEFAULT_ORGANIZATION_ID`, `CASTLINK_SESSION_SECRET`, `DATABASE_URL`, `LIVEKIT_API_SECRET`, `TEST_DATABASE_URL`.

### apps/web/tests/studio-owner-access.cjs

[`apps/web/tests/studio-owner-access.cjs`](../../apps/web/tests/studio-owner-access.cjs)

Проверка/тестовый инструмент. PASS: per-studio owner access is scoped, revocable and owner-link targets assigned node

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-participant-actions.cjs

[`apps/web/tests/studio-participant-actions.cjs`](../../apps/web/tests/studio-participant-actions.cjs)

Проверка/тестовый инструмент. PASS studio participant quick actions: exact scoped payload, synchronous duplicate guard, real-state media, 403/network feedback, stale room and handoff safety

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/studio-quality-live.browser.cjs

[`apps/web/tests/studio-quality-live.browser.cjs`](../../apps/web/tests/studio-quality-live.browser.cjs)

Проверка/тестовый инструмент. PASS: real LiveKit codec negotiation, single/simulcast/SVC RTP, live bitrate ceilings and actual product graph measurements

Библиотеки/Node: `livekit-server-sdk`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:http`, `node:path`, `playwright`, `typescript`.

Переменные окружения (только имена): `CASTLINK_QA_CHROMIUM`, `CASTLINK_STUDIO_QUALITY_QA_FIXTURE`.

### apps/web/tests/studio-return-publishing-controls.cjs

[`apps/web/tests/studio-return-publishing-controls.cjs`](../../apps/web/tests/studio-return-publishing-controls.cjs)

Проверка/тестовый инструмент. PASS: Studio Return publishing extraction preserves enable/disable rules and callbacks

Читает/импортирует: [`apps/web/components/StudioReturnPublishingControls.tsx`](../../apps/web/components/StudioReturnPublishingControls.tsx), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `node:vm`, `react`, `react-dom/server`, `typescript`.

### apps/web/tests/studio-return-stats-panel.cjs

[`apps/web/tests/studio-return-stats-panel.cjs`](../../apps/web/tests/studio-return-stats-panel.cjs)

Проверка/тестовый инструмент. PASS: Studio Return stats extraction preserves quality controls, errors and header actions

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-room-lifecycle.cjs

[`apps/web/tests/studio-room-lifecycle.cjs`](../../apps/web/tests/studio-room-lifecycle.cjs)

Проверка/тестовый инструмент. PASS: Studio Room lifecycle extraction preserves event binding and disconnect cleanup

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-room-management-panel.cjs

[`apps/web/tests/studio-room-management-panel.cjs`](../../apps/web/tests/studio-room-management-panel.cjs)

Проверка/тестовый инструмент. PASS: Studio room management UI extraction preserves callbacks and dialog behavior

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-routing.cjs

[`apps/web/tests/studio-routing.cjs`](../../apps/web/tests/studio-routing.cjs)

Проверка/тестовый инструмент. PASS: studio routing exposes only assigned healthy node and guest access is studio-scoped

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-screen-share-mute.cjs

[`apps/web/tests/studio-screen-share-mute.cjs`](../../apps/web/tests/studio-screen-share-mute.cjs)

Проверка/тестовый инструмент. STUDIO_SCREEN_SHARE_MUTE_PASS

Читает/импортирует: [`apps/web/lib/screen-share.ts`](../../apps/web/lib/screen-share.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/studio-screen-share-tabs.cjs

[`apps/web/tests/studio-screen-share-tabs.cjs`](../../apps/web/tests/studio-screen-share-tabs.cjs)

Проверка/тестовый инструмент. STUDIO_SCREEN_SHARE_TABS_PASS

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/studio-screen-sources.cjs

[`apps/web/tests/studio-screen-sources.cjs`](../../apps/web/tests/studio-screen-sources.cjs)

Проверка/тестовый инструмент. PASS actual camera/screen source collector, shared attachment and roster: selection is explicit, muted media/stream retained, no capture/auto-fullscreen, owner tracks never stopped, disconnect/unpublish listeners cleaned

Библиотеки/Node: `livekit-client`, `node:assert/strict`, `node:events`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/studio-sender-stats.cjs

[`apps/web/tests/studio-sender-stats.cjs`](../../apps/web/tests/studio-sender-stats.cjs)

Проверка/тестовый инструмент. PASS: sender single reads, aggregate layer deltas, AV1 SVC single-RTP SDK/raw equivalence without a 6 Mbps clamp, separate clocks, SSRC/publication/reset baselines, cached/invalid guards and raw fallback

Читает/импортирует: [`apps/web/lib/studio-sender-stats.ts`](../../apps/web/lib/studio-sender-stats.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/studio-stream-relay.cjs

[`apps/web/tests/studio-stream-relay.cjs`](../../apps/web/tests/studio-stream-relay.cjs)

Проверка/тестовый инструмент. PASS: measured watch video/audio, cached and late-response guards; H264 watch relay 20000→25000→6000 live cap/FPS, single stream, no reconnect/unpublish on quality change, reconciliation, viewer-zero cleanup preserves main sources

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/studio-transfer-devices.cjs

[`apps/web/tests/studio-transfer-devices.cjs`](../../apps/web/tests/studio-transfer-devices.cjs)

Проверка/тестовый инструмент. PASS: transfer device kind isolation, retry labels, active enumeration and capture cleanup

Читает/импортирует: [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/studio-transfer-panel.cjs

[`apps/web/tests/studio-transfer-panel.cjs`](../../apps/web/tests/studio-transfer-panel.cjs)

Проверка/тестовый инструмент. PASS: Studio server transfer panel extraction preserves state and callbacks

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/studio-transfer-release.cjs

[`apps/web/tests/studio-transfer-release.cjs`](../../apps/web/tests/studio-transfer-release.cjs)

Проверка/тестовый инструмент. PASS: actual Studio handoff releases only own primary ID/epoch before disconnect and proceeds after offline/one-second timeout

Читает/импортирует: [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/studio-transfer-request.cjs

[`apps/web/tests/studio-transfer-request.cjs`](../../apps/web/tests/studio-transfer-request.cjs)

Проверка/тестовый инструмент. PASS: actual Studio planned-transfer callback sends primary JWT/clientId and blocks missing credentials

Читает/импортирует: [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:vm`, `typescript`.

### apps/web/tests/studio-video-mode-ui.cjs

[`apps/web/tests/studio-video-mode-ui.cjs`](../../apps/web/tests/studio-video-mode-ui.cjs)

Проверка/тестовый инструмент. PASS: rendered studio choices/defaults/OFF AIR locks; real main publication awaits mode lock, rejects races and applies remote OFF AIR before mode changes

Читает/импортирует: [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:vm`, `react/jsx-runtime`, `typescript`.

### apps/web/tests/studio-video-mode.cjs

[`apps/web/tests/studio-video-mode.cjs`](../../apps/web/tests/studio-video-mode.cjs)

Проверка/тестовый инструмент. PASS: persisted isolated video mode defaults, 25Mbps limit, strict codec validation and desired/actual/transition OFFAIR guards

Читает/импортирует: [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/studio-video-recovery.cjs

[`apps/web/tests/studio-video-recovery.cjs`](../../apps/web/tests/studio-video-recovery.cjs)

Проверка/тестовый инструмент. PASS: flowing video, prolonged stall recovery, mute, disabled video, cleanup; PASS: hung stats deadline, polling resumes, intent rechecked after await, cleanup during pending stats

Читает/импортирует: [`apps/web/lib/studio-video-recovery.ts`](../../apps/web/lib/studio-video-recovery.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/studio-viewer-access.cjs

[`apps/web/tests/studio-viewer-access.cjs`](../../apps/web/tests/studio-viewer-access.cjs)

Проверка/тестовый инструмент. PASS: real signed viewer handoff retains expiry, identity, studio/version scope and isolated namespace

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SESSION_SECRET`.

### apps/web/tests/studio-viewer-api.cjs

[`apps/web/tests/studio-viewer-api.cjs`](../../apps/web/tests/studio-viewer-api.cjs)

Проверка/тестовый инструмент. PASS: studio viewer scope, isolated subscriptions and explicit link revocation

Читает/импортирует: [`apps/web/app/api/studio-viewer/route.ts`](../../apps/web/app/api/studio-viewer/route.ts), [`apps/web/lib/studio-viewer-access.ts`](../../apps/web/lib/studio-viewer-access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

### apps/web/tests/studio-watch-stats.cjs

[`apps/web/tests/studio-watch-stats.cjs`](../../apps/web/tests/studio-watch-stats.cjs)

Проверка/тестовый инструмент. PASS: Auto/explicit stream choice, independent main/watch histories and freshness, server/browser clock normalization, legacy heartbeat behavior

Читает/импортирует: [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/studio-outbound-stats.ts`](../../apps/web/lib/studio-outbound-stats.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:vm`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/studios-page.cjs

[`apps/web/tests/studios-page.cjs`](../../apps/web/tests/studios-page.cjs)

Проверка/тестовый инструмент. PASS: multi-studio placement UI is platform-gated and consumes sanitized control-plane API only

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/super-admin.cjs

[`apps/web/tests/super-admin.cjs`](../../apps/web/tests/super-admin.cjs)

Проверка/тестовый инструмент. PASS: isolated Super Admin access, four node states, signed topology, no media grants and limited diagnostics boundary

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/talkback-api.cjs

[`apps/web/tests/talkback-api.cjs`](../../apps/web/tests/talkback-api.cjs)

Проверка/тестовый инструмент. PASS staff panel JWT/current SID authorization, no idle programme mutation, PTT-only gate, ordered release, stale reply rejection, explicit mute and expiry fail closed

Читает/импортирует: [`apps/web/app/api/participants/route.ts`](../../apps/web/app/api/participants/route.ts), [`apps/web/app/api/talkback/route.ts`](../../apps/web/app/api/talkback/route.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/talkback-policy.cjs

[`apps/web/tests/talkback-policy.cjs`](../../apps/web/tests/talkback-policy.cjs)

Проверка/тестовый инструмент. talkback policy and server-only guest media command checks passed

Читает/импортирует: [`apps/web/lib/talkback-policy.ts`](../../apps/web/lib/talkback-policy.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/talkback-session-store.cjs

[`apps/web/tests/talkback-session-store.cjs`](../../apps/web/tests/talkback-session-store.cjs)

Проверка/тестовый инструмент. PASS: private talkback gates persist across process restart, close durably and fail closed on corrupt storage

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### apps/web/tests/telemetry-archives.cjs

[`apps/web/tests/telemetry-archives.cjs`](../../apps/web/tests/telemetry-archives.cjs)

Проверка/тестовый инструмент. PASS: compact exact gzip archives, indexed members, stable raw-to-gzip cursor, old descriptor fallback, 2s metrics/gaps, historical reset behavior, room/session boundaries, publication failure keeps raw, 30-day pruning, global raw/archive byte budget

Читает/импортирует: [`apps/web/lib/telemetry-archives.ts`](../../apps/web/lib/telemetry-archives.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:zlib`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STATS_DIR`, `STUDIOLINK_STATS_MAX_BYTES`, `STUDIOLINK_STATS_RETENTION_DAYS`.

### apps/web/tests/telemetry-scope.cjs

[`apps/web/tests/telemetry-scope.cjs`](../../apps/web/tests/telemetry-scope.cjs)

Проверка/тестовый инструмент. PASS: telemetry keeps logical/media room distinct, renews scoped staff JWT and bounds control requests

Читает/импортирует: [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/telemetry-context.ts`](../../apps/web/lib/telemetry-context.ts).

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/telemetry.cjs

[`apps/web/tests/telemetry.cjs`](../../apps/web/tests/telemetry.cjs)

Проверка/тестовый инструмент. PASS: CSV BOM, headings, connection export, formula neutralization, quoted cells; PASS: bitrate/loss deltas, counter resets, history aggregation, gaps, room isolation, session filter, disconnection, 24-hour range

Читает/импортирует: [`apps/web/lib/rtc-telemetry.ts`](../../apps/web/lib/rtc-telemetry.ts), [`apps/web/lib/stats-csv.ts`](../../apps/web/lib/stats-csv.ts), [`apps/web/lib/telemetry-store.ts`](../../apps/web/lib/telemetry-store.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STATS_DIR`.

### apps/web/tests/tenant-playback-scope.cjs

[`apps/web/tests/tenant-playback-scope.cjs`](../../apps/web/tests/tenant-playback-scope.cjs)

Проверка/тестовый инструмент. PASS: tenant scope is wired through camera/screen output, rename, statistics and staff telemetry

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/tenant-scope.cjs

[`apps/web/tests/tenant-scope.cjs`](../../apps/web/tests/tenant-scope.cjs)

Проверка/тестовый инструмент. PASS: tenant scope prevents cross-organization/studio room identity collisions

Читает/импортирует: [`apps/web/lib/tenant-scope.ts`](../../apps/web/lib/tenant-scope.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/topology-merge.cjs

[`apps/web/tests/topology-merge.cjs`](../../apps/web/tests/topology-merge.cjs)

Проверка/тестовый инструмент. PASS: unregistered node rooms appear, stale nodes stay unknown, observations update without mutating registry

Читает/импортирует: [`apps/web/lib/platform-topology.ts`](../../apps/web/lib/platform-topology.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `typescript`.

### apps/web/tests/transfer-health-identity.cjs

[`apps/web/tests/transfer-health-identity.cjs`](../../apps/web/tests/transfer-health-identity.cjs)

Проверка/тестовый инструмент. PASS: actual health handler preserves legacy server ID and immutable profile installation identity

Читает/импортирует: [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/transfer-peer.ts`](../../apps/web/lib/transfer-peer.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:vm`, `typescript`.

Переменные окружения (только имена): `CASTLINK_SERVER_ID`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_TRANSFER_ORIGIN`, `STUDIOLINK_TRANSFER_SERVER_ID`.

### apps/web/tests/transfer-node-admission.cjs

[`apps/web/tests/transfer-node-admission.cjs`](../../apps/web/tests/transfer-node-admission.cjs)

Проверка/тестовый инструмент. PASS: broken/denied enforced admission refuses handoff before room/reservation/tickets, while legacy admission behavior remains

Читает/импортирует: [`apps/web/app/api/server-transfer/route.ts`](../../apps/web/app/api/server-transfer/route.ts), [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/room-store.ts`](../../apps/web/lib/room-store.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts), [`apps/web/lib/transfer-room.ts`](../../apps/web/lib/transfer-room.ts).

Библиотеки/Node: `livekit-server-sdk`, `next/server`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:module`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `CASTLINK_ENFORCE_NODE_ADMISSION`.

### apps/web/tests/transfer-origins.cjs

[`apps/web/tests/transfer-origins.cjs`](../../apps/web/tests/transfer-origins.cjs)

Проверка/тестовый инструмент. PASS: strict configured origins and authenticated self-host browser destination

Читает/импортирует: [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/lib/server-transfer.ts`](../../apps/web/lib/server-transfer.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_TRANSFER_TARGETS_JSON`.

### apps/web/tests/transfer-owner-session.cjs

[`apps/web/tests/transfer-owner-session.cjs`](../../apps/web/tests/transfer-owner-session.cjs)

Проверка/тестовый инструмент. PASS: local node control mode and verified owner lifetime across hot-swap, including revoked/wrong-scope/expired sessions

Читает/импортирует: [`apps/web/lib/access.ts`](../../apps/web/lib/access.ts), [`apps/web/lib/control-plane-client.ts`](../../apps/web/lib/control-plane-client.ts), [`apps/web/lib/studio-owner-access.ts`](../../apps/web/lib/studio-owner-access.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_SECRET`, `CASTLINK_SESSION_SECRET`, `STUDIOLINK_DEFAULT_STUDIO_ID`, `STUDIOLINK_STUDIO_PASSWORD_HASH`.

### apps/web/tests/ui-layout-corrections.browser.cjs

[`apps/web/tests/ui-layout-corrections.browser.cjs`](../../apps/web/tests/ui-layout-corrections.browser.cjs)

Проверка/тестовый инструмент. PASS UI layout corrections: production components, portrait/desktop tiles, video continuity, five-column studio, equal controls, both themes; proof

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `node:module`, `node:os`, `node:path`.

Переменные окружения (только имена): `CASTLINK_LAYOUT_QA_OUT`, `CASTLINK_QA_CHROMIUM_BINARY`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_BUILD_NUMBER`, `NEXT_PUBLIC_PRODUCT_VERSION`.

### apps/web/tests/update-maintenance.cjs

[`apps/web/tests/update-maintenance.cjs`](../../apps/web/tests/update-maintenance.cjs)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

Читает/импортирует: [`apps/web/lib/update-maintenance.ts`](../../apps/web/lib/update-maintenance.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:test`, `typescript`.

### apps/web/tests/version-api.cjs

[`apps/web/tests/version-api.cjs`](../../apps/web/tests/version-api.cjs)

Проверка/тестовый инструмент. PASS: version API exposes semantic product version and compatible build identifier

Читает/импортирует: [`apps/web/app/api/version/route.ts`](../../apps/web/app/api/version/route.ts), [`apps/web/package.json`](../../apps/web/package.json), [`package.json`](../../package.json).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

Переменные окружения (только имена): `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_ID`, `NEXT_PUBLIC_BUILD_NUMBER`, `NEXT_PUBLIC_PRODUCT_VERSION`, `NODE_ENV`.

### apps/web/tests/video-quality-vp9.cjs

[`apps/web/tests/video-quality-vp9.cjs`](../../apps/web/tests/video-quality-vp9.cjs)

Проверка/тестовый инструмент. PASS: H264/10Mbps/60 defaults, VP9 API/capability/SVC paths and persisted ON AIR protection

Читает/импортирует: [`apps/web/lib/guest-media-control.ts`](../../apps/web/lib/guest-media-control.ts), [`apps/web/lib/guest-video-codec.ts`](../../apps/web/lib/guest-video-codec.ts), [`apps/web/lib/studio-control.ts`](../../apps/web/lib/studio-control.ts), [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `typescript`.

Переменные окружения (только имена): `STUDIOLINK_STUDIO_CONTROL_FILE`.

### apps/web/tests/video-quality.cjs

[`apps/web/tests/video-quality.cjs`](../../apps/web/tests/video-quality.cjs)

Проверка/тестовый инструмент. studio video quality caps and sender retries passed

Читает/импортирует: [`apps/web/lib/video-quality.ts`](../../apps/web/lib/video-quality.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/video-rotation-lifecycle.cjs

[`apps/web/tests/video-rotation-lifecycle.cjs`](../../apps/web/tests/video-rotation-lifecycle.cjs)

Проверка/тестовый инструмент. PASS: rotation releases old video/frame listeners in 100 republish cycles and removes room listeners

Библиотеки/Node: `node:assert/strict`, `node:events`, `node:fs`, `node:vm`, `typescript`.

### apps/web/tests/viewer-transfer-page.cjs

[`apps/web/tests/viewer-transfer-page.cjs`](../../apps/web/tests/viewer-transfer-page.cjs)

Проверка/тестовый инструмент. PASS: actual transfer page stores verified viewer invite, returns /watch and preserves only playback preferences

Читает/импортирует: [`apps/web/app/transfer/page.tsx`](../../apps/web/app/transfer/page.tsx), [`apps/web/lib/client-transfer.ts`](../../apps/web/lib/client-transfer.ts), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/watch-subscriptions.cjs

[`apps/web/tests/watch-subscriptions.cjs`](../../apps/web/tests/watch-subscriptions.cjs)

Проверка/тестовый инструмент. PASS: watch audio/video subscription choices are independent, reattach-safe, and cancel stale audio starts

Читает/импортирует: [`apps/web/lib/watch-subscriptions.ts`](../../apps/web/lib/watch-subscriptions.ts).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `typescript`.

### apps/web/tests/watch-transfer.cjs

[`apps/web/tests/watch-transfer.cjs`](../../apps/web/tests/watch-transfer.cjs)

Проверка/тестовый инструмент. PASS: actual watch hook preserves RTC/media attachments through network/502/429/408 and SDK reconnect, recovers polling in place, closes/clears 403, retains handoff/retry cleanup and playback intent

Читает/импортирует: [`apps/web/app/watch/page.tsx`](../../apps/web/app/watch/page.tsx), [`apps/web/tests/i18n-fixture.cjs`](../../apps/web/tests/i18n-fixture.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:path`, `typescript`.

### apps/web/tests/wave1-ui-media.cjs

[`apps/web/tests/wave1-ui-media.cjs`](../../apps/web/tests/wave1-ui-media.cjs)

Проверка/тестовый инструмент. PASS: Wave 1 UI/media regressions stay aligned with CastLink design and monitoring invariants

Библиотеки/Node: `@\/components\/GuestAudioMeter`, `node:assert/strict`, `node:fs`, `node:path`.

### apps/web/tests/workspace-layout-browser.py

[`apps/web/tests/workspace-layout-browser.py`](../../apps/web/tests/workspace-layout-browser.py)

Проверка/тестовый инструмент. Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.

## apps/web/tsconfig.json · 1 файлов

### apps/web/tsconfig.json

[`apps/web/tsconfig.json`](../../apps/web/tsconfig.json)

Параметры проверки TypeScript и разрешения импортов.

## assets · 1 файлов

### assets/brand/castlink-icon.svg

[`assets/brand/castlink-icon.svg`](../../assets/brand/castlink-icon.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

## design-preview · 111 файлов

### design-preview/README.md

[`design-preview/README.md`](../../design-preview/README.md)

Предпросмотр нового дизайна CastLink

### design-preview/client-installer/01-actual-welcome.png

[`design-preview/client-installer/01-actual-welcome.png`](../../design-preview/client-installer/01-actual-welcome.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/01-welcome-controls.json

[`design-preview/client-installer/01-welcome-controls.json`](../../design-preview/client-installer/01-welcome-controls.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/02-actual-install-mode.png

[`design-preview/client-installer/02-actual-install-mode.png`](../../design-preview/client-installer/02-actual-install-mode.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/02-install-mode-controls.json

[`design-preview/client-installer/02-install-mode-controls.json`](../../design-preview/client-installer/02-install-mode-controls.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/03-actual-directory.png

[`design-preview/client-installer/03-actual-directory.png`](../../design-preview/client-installer/03-actual-directory.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/03-directory-controls.json

[`design-preview/client-installer/03-directory-controls.json`](../../design-preview/client-installer/03-directory-controls.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/04-finish-fixture-controls.json

[`design-preview/client-installer/04-finish-fixture-controls.json`](../../design-preview/client-installer/04-finish-fixture-controls.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/04-finish-fixture.png

[`design-preview/client-installer/04-finish-fixture.png`](../../design-preview/client-installer/04-finish-fixture.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/README.md

[`design-preview/client-installer/README.md`](../../design-preview/client-installer/README.md)

CastLink Client — нативный установщик в стиле CastLink

### design-preview/client-installer/build-qa.cjs

[`design-preview/client-installer/build-qa.cjs`](../../design-preview/client-installer/build-qa.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`.

Переменные окружения (только имена): `CASTLINK_DESKTOP_DEPS`, `CASTLINK_ELECTRON_DIST`, `CASTLINK_GIT`.

### design-preview/client-installer/capture-qa.ps1

[`design-preview/client-installer/capture-qa.ps1`](../../design-preview/client-installer/capture-qa.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/finish-fixture.nsi

[`design-preview/client-installer/finish-fixture.nsi`](../../design-preview/client-installer/finish-fixture.nsi)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/client-installer/verification.json

[`design-preview/client-installer/verification.json`](../../design-preview/client-installer/verification.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/downloads-pr66/README.md

[`design-preview/downloads-pr66/README.md`](../../design-preview/downloads-pr66/README.md)

PR66 — дополнение существующего блока загрузок

### design-preview/downloads-pr66/downloads-desktop.png

[`design-preview/downloads-pr66/downloads-desktop.png`](../../design-preview/downloads-pr66/downloads-desktop.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/downloads-pr66/downloads-mobile.png

[`design-preview/downloads-pr66/downloads-mobile.png`](../../design-preview/downloads-pr66/downloads-mobile.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/downloads-pr66/render.cjs

[`design-preview/downloads-pr66/render.cjs`](../../design-preview/downloads-pr66/render.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:http`, `node:path`.

Переменные окружения (только имена): `CASTLINK_CHROMIUM_PATH`, `CASTLINK_PLAYWRIGHT_PATH`.

### design-preview/downloads-pr66/verification.json

[`design-preview/downloads-pr66/verification.json`](../../design-preview/downloads-pr66/verification.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/caster.png

[`design-preview/entry-approved/caster.png`](../../design-preview/entry-approved/caster.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/invalid.png

[`design-preview/entry-approved/invalid.png`](../../design-preview/entry-approved/invalid.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/invite-mobile.png

[`design-preview/entry-approved/invite-mobile.png`](../../design-preview/entry-approved/invite-mobile.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/invite-opening.png

[`design-preview/entry-approved/invite-opening.png`](../../design-preview/entry-approved/invite-opening.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/invite.png

[`design-preview/entry-approved/invite.png`](../../design-preview/entry-approved/invite.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/preflight-mobile.png

[`design-preview/entry-approved/preflight-mobile.png`](../../design-preview/entry-approved/preflight-mobile.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/preflight.png

[`design-preview/entry-approved/preflight.png`](../../design-preview/entry-approved/preflight.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/roles-light.png

[`design-preview/entry-approved/roles-light.png`](../../design-preview/entry-approved/roles-light.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/roles.png

[`design-preview/entry-approved/roles.png`](../../design-preview/entry-approved/roles.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/studio-access.png

[`design-preview/entry-approved/studio-access.png`](../../design-preview/entry-approved/studio-access.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/studio-create.png

[`design-preview/entry-approved/studio-create.png`](../../design-preview/entry-approved/studio-create.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/studio-desktop.png

[`design-preview/entry-approved/studio-desktop.png`](../../design-preview/entry-approved/studio-desktop.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/entry-approved/studio-room.png

[`design-preview/entry-approved/studio-room.png`](../../design-preview/entry-approved/studio-room.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/ASSETS.txt

[`design-preview/new/ASSETS.txt`](../../design-preview/new/ASSETS.txt)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/access.html

[`design-preview/new/access.html`](../../design-preview/new/access.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/Manrope-OFL.txt

[`design-preview/new/assets/Manrope-OFL.txt`](../../design-preview/new/assets/Manrope-OFL.txt)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/alex.jpg

[`design-preview/new/assets/alex.jpg`](../../design-preview/new/assets/alex.jpg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/anna.jpg

[`design-preview/new/assets/anna.jpg`](../../design-preview/new/assets/anna.jpg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/elena.jpg

[`design-preview/new/assets/elena.jpg`](../../design-preview/new/assets/elena.jpg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/font-0.woff2

[`design-preview/new/assets/font-0.woff2`](../../design-preview/new/assets/font-0.woff2)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/font-1.woff2

[`design-preview/new/assets/font-1.woff2`](../../design-preview/new/assets/font-1.woff2)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/font-2.woff2

[`design-preview/new/assets/font-2.woff2`](../../design-preview/new/assets/font-2.woff2)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/font-3.woff2

[`design-preview/new/assets/font-3.woff2`](../../design-preview/new/assets/font-3.woff2)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/font-4.woff2

[`design-preview/new/assets/font-4.woff2`](../../design-preview/new/assets/font-4.woff2)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/font.css

[`design-preview/new/assets/font.css`](../../design-preview/new/assets/font.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/logo.svg

[`design-preview/new/assets/logo.svg`](../../design-preview/new/assets/logo.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/assets/max.jpg

[`design-preview/new/assets/max.jpg`](../../design-preview/new/assets/max.jpg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/base-theme.css

[`design-preview/new/base-theme.css`](../../design-preview/new/base-theme.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/co-presentation-toolbar-desktop.png

[`design-preview/new/co-presentation-toolbar-desktop.png`](../../design-preview/new/co-presentation-toolbar-desktop.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/co-presentation-toolbar-mobile.png

[`design-preview/new/co-presentation-toolbar-mobile.png`](../../design-preview/new/co-presentation-toolbar-mobile.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/co-presentation-toolbar.html

[`design-preview/new/co-presentation-toolbar.html`](../../design-preview/new/co-presentation-toolbar.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/create.html

[`design-preview/new/create.html`](../../design-preview/new/create.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/diagnostics.html

[`design-preview/new/diagnostics.html`](../../design-preview/new/diagnostics.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/features.html

[`design-preview/new/features.html`](../../design-preview/new/features.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/guest-theme.css

[`design-preview/new/guest-theme.css`](../../design-preview/new/guest-theme.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/guest.html

[`design-preview/new/guest.html`](../../design-preview/new/guest.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/help.html

[`design-preview/new/help.html`](../../design-preview/new/help.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/home.html

[`design-preview/new/home.html`](../../design-preview/new/home.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/index.html

[`design-preview/new/index.html`](../../design-preview/new/index.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/live-theme.css

[`design-preview/new/live-theme.css`](../../design-preview/new/live-theme.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/live.html

[`design-preview/new/live.html`](../../design-preview/new/live.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/moderator.html

[`design-preview/new/moderator.html`](../../design-preview/new/moderator.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/monitor.html

[`design-preview/new/monitor.html`](../../design-preview/new/monitor.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/multiview-output.html

[`design-preview/new/multiview-output.html`](../../design-preview/new/multiview-output.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/multiview.html

[`design-preview/new/multiview.html`](../../design-preview/new/multiview.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/operations-theme.css

[`design-preview/new/operations-theme.css`](../../design-preview/new/operations-theme.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/output.html

[`design-preview/new/output.html`](../../design-preview/new/output.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/preflight-mobile.html

[`design-preview/new/preflight-mobile.html`](../../design-preview/new/preflight-mobile.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/preflight.html

[`design-preview/new/preflight.html`](../../design-preview/new/preflight.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/preview.css

[`design-preview/new/preview.css`](../../design-preview/new/preview.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/preview.js

[`design-preview/new/preview.js`](../../design-preview/new/preview.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/reserve.html

[`design-preview/new/reserve.html`](../../design-preview/new/reserve.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/rooms.html

[`design-preview/new/rooms.html`](../../design-preview/new/rooms.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/servers.html

[`design-preview/new/servers.html`](../../design-preview/new/servers.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/setup.html

[`design-preview/new/setup.html`](../../design-preview/new/setup.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/special-theme.css

[`design-preview/new/special-theme.css`](../../design-preview/new/special-theme.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/staff.html

[`design-preview/new/staff.html`](../../design-preview/new/staff.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/states.html

[`design-preview/new/states.html`](../../design-preview/new/states.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/studio-theme.css

[`design-preview/new/studio-theme.css`](../../design-preview/new/studio-theme.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/studio.html

[`design-preview/new/studio.html`](../../design-preview/new/studio.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/style.css

[`design-preview/new/style.css`](../../design-preview/new/style.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/new/watch.html

[`design-preview/new/watch.html`](../../design-preview/new/watch.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/01-location-dark.png

[`design-preview/server-installer/01-location-dark.png`](../../design-preview/server-installer/01-location-dark.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/02-location-light.png

[`design-preview/server-installer/02-location-light.png`](../../design-preview/server-installer/02-location-light.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/03-local-configuration.png

[`design-preview/server-installer/03-local-configuration.png`](../../design-preview/server-installer/03-local-configuration.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/04-vps-ssh.png

[`design-preview/server-installer/04-vps-ssh.png`](../../design-preview/server-installer/04-vps-ssh.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/05-room-password.png

[`design-preview/server-installer/05-room-password.png`](../../design-preview/server-installer/05-room-password.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/06-progress.png

[`design-preview/server-installer/06-progress.png`](../../design-preview/server-installer/06-progress.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/07-success.png

[`design-preview/server-installer/07-success.png`](../../design-preview/server-installer/07-success.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/08-recoverable-error.png

[`design-preview/server-installer/08-recoverable-error.png`](../../design-preview/server-installer/08-recoverable-error.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/09-existing-server.png

[`design-preview/server-installer/09-existing-server.png`](../../design-preview/server-installer/09-existing-server.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/10-compact-window.png

[`design-preview/server-installer/10-compact-window.png`](../../design-preview/server-installer/10-compact-window.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/11-https-trust-warning.png

[`design-preview/server-installer/11-https-trust-warning.png`](../../design-preview/server-installer/11-https-trust-warning.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/README.md

[`design-preview/server-installer/README.md`](../../design-preview/server-installer/README.md)

CastLink Server — утверждённый дизайн и нативная реализация

### design-preview/server-installer/index.html

[`design-preview/server-installer/index.html`](../../design-preview/server-installer/index.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-captures.json

[`design-preview/server-installer/native/native-captures.json`](../../design-preview/server-installer/native/native-captures.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-control-compact.png

[`design-preview/server-installer/native/native-control-compact.png`](../../design-preview/server-installer/native/native-control-compact.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-control-dark.png

[`design-preview/server-installer/native/native-control-dark.png`](../../design-preview/server-installer/native/native-control-dark.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-control-light.png

[`design-preview/server-installer/native/native-control-light.png`](../../design-preview/server-installer/native/native-control-light.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-control-services.png

[`design-preview/server-installer/native/native-control-services.png`](../../design-preview/server-installer/native/native-control-services.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-entry-compact.png

[`design-preview/server-installer/native/native-entry-compact.png`](../../design-preview/server-installer/native/native-entry-compact.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-entry-dark.png

[`design-preview/server-installer/native/native-entry-dark.png`](../../design-preview/server-installer/native/native-entry-dark.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-entry-light.png

[`design-preview/server-installer/native/native-entry-light.png`](../../design-preview/server-installer/native/native-entry-light.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-folder-prompt.png

[`design-preview/server-installer/native/native-folder-prompt.png`](../../design-preview/server-installer/native/native-folder-prompt.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-progress.png

[`design-preview/server-installer/native/native-progress.png`](../../design-preview/server-installer/native/native-progress.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-recoverable-error.png

[`design-preview/server-installer/native/native-recoverable-error.png`](../../design-preview/server-installer/native/native-recoverable-error.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-secure-prompt.png

[`design-preview/server-installer/native/native-secure-prompt.png`](../../design-preview/server-installer/native/native-secure-prompt.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/native-success.png

[`design-preview/server-installer/native/native-success.png`](../../design-preview/server-installer/native/native-success.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/native/test-results.json

[`design-preview/server-installer/native/test-results.json`](../../design-preview/server-installer/native/test-results.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/preview.css

[`design-preview/server-installer/preview.css`](../../design-preview/server-installer/preview.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### design-preview/server-installer/render.cjs

[`design-preview/server-installer/render.cjs`](../../design-preview/server-installer/render.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:fs`, `node:path`, `node:url`.

Переменные окружения (только имена): `CASTLINK_CHROMIUM_PATH`, `CASTLINK_PLAYWRIGHT_PATH`.

### design-preview/server-installer/verification.json

[`design-preview/server-installer/verification.json`](../../design-preview/server-installer/verification.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

## distribution · 14 файлов

### distribution/INSTALL.md

[`distribution/INSTALL.md`](../../distribution/INSTALL.md)

Установка CastLink: быстрый и расширенный режимы

### distribution/LINUX_MANUAL.md

[`distribution/LINUX_MANUAL.md`](../../distribution/LINUX_MANUAL.md)

Ручная установка CastLink на Linux

### distribution/PRODUCTS.md

[`distribution/PRODUCTS.md`](../../distribution/PRODUCTS.md)

Пакеты CastLink

### distribution/README.md

[`distribution/README.md`](../../distribution/README.md)

CastLink — инструкция по установке и работе

### distribution/RELEASE_POLICY.md

[`distribution/RELEASE_POLICY.md`](../../distribution/RELEASE_POLICY.md)

Публичные выпуски CastLink

### distribution/docs/en/INSTALL.md

[`distribution/docs/en/INSTALL.md`](../../distribution/docs/en/INSTALL.md)

CastLink installation: quick and advanced

### distribution/docs/en/LINUX_MANUAL.md

[`distribution/docs/en/LINUX_MANUAL.md`](../../distribution/docs/en/LINUX_MANUAL.md)

Install CastLink manually on Linux

### distribution/docs/en/PRODUCTS.md

[`distribution/docs/en/PRODUCTS.md`](../../distribution/docs/en/PRODUCTS.md)

CastLink packages

### distribution/docs/zh-CN/INSTALL.md

[`distribution/docs/zh-CN/INSTALL.md`](../../distribution/docs/zh-CN/INSTALL.md)

CastLink 安装：快速和高级模式

### distribution/docs/zh-CN/LINUX_MANUAL.md

[`distribution/docs/zh-CN/LINUX_MANUAL.md`](../../distribution/docs/zh-CN/LINUX_MANUAL.md)

在 Linux 上手动安装 CastLink

### distribution/docs/zh-CN/PRODUCTS.md

[`distribution/docs/zh-CN/PRODUCTS.md`](../../distribution/docs/zh-CN/PRODUCTS.md)

CastLink 软件包

### distribution/release-tracks.json

[`distribution/release-tracks.json`](../../distribution/release-tracks.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### distribution/third-party-office-sources.json

[`distribution/third-party-office-sources.json`](../../distribution/third-party-office-sources.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### distribution/third-party-sources.json

[`distribution/third-party-sources.json`](../../distribution/third-party-sources.json)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

## docs · 213 файлов

### docs/AGENT_MODELS_RU.md

[`docs/AGENT_MODELS_RU.md`](../AGENT_MODELS_RU.md)

CastLink: назначения моделей

### docs/AGENT_TEAM_RU.md

[`docs/AGENT_TEAM_RU.md`](../AGENT_TEAM_RU.md)

Передача работы CastLink

### docs/ARCHITECTURE_SELF_HOSTED_RU.md

[`docs/ARCHITECTURE_SELF_HOSTED_RU.md`](../ARCHITECTURE_SELF_HOSTED_RU.md)

CastLink: self-hosted open-source model

### docs/AUDIO_INCIDENT_2026_10_10_RU.md

[`docs/AUDIO_INCIDENT_2026_10_10_RU.md`](../AUDIO_INCIDENT_2026_10_10_RU.md)

Аудио: длительный тест комнаты Poker, 10 октября 2026

### docs/BROWSER_RECOVERY_MATRIX_RU.md

[`docs/BROWSER_RECOVERY_MATRIX_RU.md`](../BROWSER_RECOVERY_MATRIX_RU.md)

CastLink 1.0: браузеры, reconnect и recovery

### docs/CASTLINK_BRAND_ICON_RU.md

[`docs/CASTLINK_BRAND_ICON_RU.md`](../CASTLINK_BRAND_ICON_RU.md)

Единая иконка CastLink

### docs/CLI_ACCEPTANCE_RU.md

[`docs/CLI_ACCEPTANCE_RU.md`](../CLI_ACCEPTANCE_RU.md)

Self-hosted CLI: матрица фактов и оставшихся проверок

### docs/CLI_GUIDED_MEDIA_PREVIEW_RU.md

[`docs/CLI_GUIDED_MEDIA_PREVIEW_RU.md`](../CLI_GUIDED_MEDIA_PREVIEW_RU.md)

Guided media: граница совместимости исходников CLI

### docs/CLI_INTERNET_COMPOSE_RANGE_RU.md

[`docs/CLI_INTERNET_COMPOSE_RANGE_RU.md`](../CLI_INTERNET_COMPOSE_RANGE_RU.md)

Исправление Compose диапазона Internet/TURN

### docs/CLI_INTERNET_CONTRACT_RU.md

[`docs/CLI_INTERNET_CONTRACT_RU.md`](../CLI_INTERNET_CONTRACT_RU.md)

CLI Internet: публичный HTTPS и прямое ICE

### docs/CLI_PACKAGING_RU.md

[`docs/CLI_PACKAGING_RU.md`](../CLI_PACKAGING_RU.md)

Внутренняя упаковка CastLink CLI

### docs/CLI_PRIVATE_CONTROL_CAPABILITY_RU.md

[`docs/CLI_PRIVATE_CONTROL_CAPABILITY_RU.md`](../CLI_PRIVATE_CONTROL_CAPABILITY_RU.md)

Manifest2: private .2 CONFIG/SERVICES research contract

### docs/CLI_PRIVATE_CONTROL_WINDOWS_VOLUME_RU.md

[`docs/CLI_PRIVATE_CONTROL_WINDOWS_VOLUME_RU.md`](../CLI_PRIVATE_CONTROL_WINDOWS_VOLUME_RU.md)

Windows named-volume adapter: source contract

### docs/CLI_SELF_HOSTED_RU.md

[`docs/CLI_SELF_HOSTED_RU.md`](../CLI_SELF_HOSTED_RU.md)

CastLink CLI: developer preview

### docs/CRITICAL_INVARIANTS_RU.md

[`docs/CRITICAL_INVARIANTS_RU.md`](../CRITICAL_INVARIANTS_RU.md)

CastLink: обязательный контекст перед изменениями

### docs/DISTRIBUTION_TRANSITION_RU.md

[`docs/DISTRIBUTION_TRANSITION_RU.md`](../DISTRIBUTION_TRANSITION_RU.md)

Переход: публичные пакеты и приватные исходники

### docs/EASY_SETUP_RUNTIME_SCOPE_RU.md

[`docs/EASY_SETUP_RUNTIME_SCOPE_RU.md`](../EASY_SETUP_RUNTIME_SCOPE_RU.md)

Область видимости runtime в Easy Setup

### docs/EASY_SETUP_WINDOWS_DOCKER_RESUME_RU.md

[`docs/EASY_SETUP_WINDOWS_DOCKER_RESUME_RU.md`](../EASY_SETUP_WINDOWS_DOCKER_RESUME_RU.md)

Easy Setup: продолжение после подготовки Docker — 12.10.2026

### docs/EASY_SETUP_WINDOWS_RU.md

[`docs/EASY_SETUP_WINDOWS_RU.md`](../EASY_SETUP_WINDOWS_RU.md)

CastLink Easy Setup для Windows 10–11

### docs/EASY_SETUP_WINDOWS_TURN_TLS_WIZARD_RU.md

[`docs/EASY_SETUP_WINDOWS_TURN_TLS_WIZARD_RU.md`](../EASY_SETUP_WINDOWS_TURN_TLS_WIZARD_RU.md)

Easy Setup: необязательный TURN/TLS в мастере — 12.10.2026

### docs/EDITING_AND_ACCESS_RU.md

[`docs/EDITING_AND_ACCESS_RU.md`](../EDITING_AND_ACCESS_RU.md)

VS Code локально + GitHub

### docs/ENGINEERING_LESSONS_RU.md

[`docs/ENGINEERING_LESSONS_RU.md`](../ENGINEERING_LESSONS_RU.md)

Выводы из интеграции Windows — 6 октября 2026

### docs/GUEST_CAMERA_CAPTURE_RU.md

[`docs/GUEST_CAMERA_CAPTURE_RU.md`](../GUEST_CAMERA_CAPTURE_RU.md)

Параметры камеры в карточке гостя — интеграция PR60, 20.10.2026

### docs/HOME_SETUP_RU.md

[`docs/HOME_SETUP_RU.md`](../HOME_SETUP_RU.md)

Продолжение работы дома: CastLink

### docs/HOSTED_ACCESS_RU.md

[`docs/HOSTED_ACCESS_RU.md`](../HOSTED_ACCESS_RU.md)

Доступ к размещённому CastLink по токенам

### docs/ISSUE_AUDIT_RC2_OPERATIONS_RU.md

[`docs/ISSUE_AUDIT_RC2_OPERATIONS_RU.md`](../ISSUE_AUDIT_RC2_OPERATIONS_RU.md)

Сверка issues и отложенных отметок — 02.10.2026

### docs/LICENSING_AND_SERVER_REGISTRY_RU.md

[`docs/LICENSING_AND_SERVER_REGISTRY_RU.md`](../LICENSING_AND_SERVER_REGISTRY_RU.md)

CastLink 1.0: лицензирование, подписки и реестр серверов

### docs/MANUAL_RU.md

[`docs/MANUAL_RU.md`](../MANUAL_RU.md)

CastLink: руководство с нуля

### docs/MEDIA_FEEDBACK_20261018_RU.md

[`docs/MEDIA_FEEDBACK_20261018_RU.md`](../MEDIA_FEEDBACK_20261018_RU.md)

Медиа, устройства и презентации: план и проверка

### docs/MULTITENANT_CLOUD_RU.md

[`docs/MULTITENANT_CLOUD_RU.md`](../MULTITENANT_CLOUD_RU.md)

CastLink Cloud: multi-tenant architecture

### docs/OBSERVABILITY_RU.md

[`docs/OBSERVABILITY_RU.md`](../OBSERVABILITY_RU.md)

CastLink 1.0: observability и health checks

### docs/PANEL_VPS_UPDATE_RU.md

[`docs/PANEL_VPS_UPDATE_RU.md`](../PANEL_VPS_UPDATE_RU.md)

Обновление VPS из панели студии

### docs/PERSISTENT_STORAGE_RU.md

[`docs/PERSISTENT_STORAGE_RU.md`](../PERSISTENT_STORAGE_RU.md)

CastLink 1.0: persistent storage, backup и restore

### docs/POSTGRESQL_STORAGE_RU.md

[`docs/POSTGRESQL_STORAGE_RU.md`](../POSTGRESQL_STORAGE_RU.md)

CastLink 1.0: переход persistent storage на PostgreSQL

### docs/PRIVATE_LIVEKIT_IDLE_SEAL_RU.md

[`docs/PRIVATE_LIVEKIT_IDLE_SEAL_RU.md`](../PRIVATE_LIVEKIT_IDLE_SEAL_RU.md)

Приватный прототип атомарной остановки LiveKit при простое

### docs/PRODUCTION_DEPLOYMENT_RU.md

[`docs/PRODUCTION_DEPLOYMENT_RU.md`](../PRODUCTION_DEPLOYMENT_RU.md)

CastLink: production install, update и rollback

### docs/PROJECT_GUIDE_RU.md

[`docs/PROJECT_GUIDE_RU.md`](../PROJECT_GUIDE_RU.md)

CastLink 1.0.0-rc.1 — гайд по проекту

### docs/PUBLIC_TESTING_READINESS_RU.md

[`docs/PUBLIC_TESTING_READINESS_RU.md`](../PUBLIC_TESTING_READINESS_RU.md)

Подготовка публичного тестирования CastLink

### docs/RC2_OPERATIONS_FEEDBACK_RU.md

[`docs/RC2_OPERATIONS_FEEDBACK_RU.md`](../RC2_OPERATIONS_FEEDBACK_RU.md)

RC-2: мобильная сетка, реальные операции нод и статистика платформы

### docs/RC2_RELEASE_AUDIT_RU.md

[`docs/RC2_RELEASE_AUDIT_RU.md`](../RC2_RELEASE_AUDIT_RU.md)

CastLink RC-2: проверка выпуска перед совместным deploy

### docs/RC_ACCEPTANCE_1_0_RU.md

[`docs/RC_ACCEPTANCE_1_0_RU.md`](../RC_ACCEPTANCE_1_0_RU.md)

CastLink 1.0 RC acceptance checklist

### docs/RELEASE_BACKLOG_1_0_RC2_RU.md

[`docs/RELEASE_BACKLOG_1_0_RC2_RU.md`](../RELEASE_BACKLOG_1_0_RC2_RU.md)

CastLink 1.0.0-rc.2 — release backlog

### docs/RELEASE_POLICY_RU.md

[`docs/RELEASE_POLICY_RU.md`](../RELEASE_POLICY_RU.md)

Релизы CastLink

### docs/ROOM_ADMIN_RU.md

[`docs/ROOM_ADMIN_RU.md`](../ROOM_ADMIN_RU.md)

Отдельная админка комнаты

### docs/SECURITY_AUDIT_1_0_RU.md

[`docs/SECURITY_AUDIT_1_0_RU.md`](../SECURITY_AUDIT_1_0_RU.md)

CastLink 1.0 — security audit

### docs/SECURITY_RU.md

[`docs/SECURITY_RU.md`](../SECURITY_RU.md)

Безопасность CastLink и проверка гостевого доступа

### docs/SERVER_FAILOVER_RU.md

[`docs/SERVER_FAILOVER_RU.md`](../SERVER_FAILOVER_RU.md)

Переключение комнаты между VPS и локальным сервером

### docs/SERVER_RESERVE_QA_RU.md

[`docs/SERVER_RESERVE_QA_RU.md`](../SERVER_RESERVE_QA_RU.md)

Проверка переноса и подключения серверов — 08.10.2026

### docs/SERVER_RESERVE_RU.md

[`docs/SERVER_RESERVE_RU.md`](../SERVER_RESERVE_RU.md)

Дополнительные серверы, перенос и автоматический резерв

### docs/SERVER_ROLES_AND_SLOTS_RU.md

[`docs/SERVER_ROLES_AND_SLOTS_RU.md`](../SERVER_ROLES_AND_SLOTS_RU.md)

Серверные роли и постоянные выходы кастеров

### docs/STUDIO_INTERFACE_RU.md

[`docs/STUDIO_INTERFACE_RU.md`](../STUDIO_INTERFACE_RU.md)

Студия CastLink: вход, серверы и исходящий поток

### docs/STUDIO_STREAM_STATS_QA_RU.md

[`docs/STUDIO_STREAM_STATS_QA_RU.md`](../STUDIO_STREAM_STATS_QA_RU.md)

Измерения Studio Return и /watch — 08.10.2026

### docs/STUDIO_VIDEO_QUALITY_RU.md

[`docs/STUDIO_VIDEO_QUALITY_RU.md`](../STUDIO_VIDEO_QUALITY_RU.md)

Качество Studio Return и ссылки /watch

### docs/TIMEWEB_FRESH_INSTALL_20261012_RU.md

[`docs/TIMEWEB_FRESH_INSTALL_20261012_RU.md`](../TIMEWEB_FRESH_INSTALL_20261012_RU.md)

Новая установка Timeweb — 12 октября 2026

### docs/TROUBLESHOOTING_RU.md

[`docs/TROUBLESHOOTING_RU.md`](../TROUBLESHOOTING_RU.md)

Если что-то не работает

### docs/TURN_GUEST_GUIDE_RU.md

[`docs/TURN_GUEST_GUIDE_RU.md`](../TURN_GUEST_GUIDE_RU.md)

Запасной маршрут TURN для гостя

### docs/TURN_TLS_EASY_SETUP_RU.md

[`docs/TURN_TLS_EASY_SETUP_RU.md`](../TURN_TLS_EASY_SETUP_RU.md)

TURN/TLS на TCP/443 в Easy Setup

### docs/TURN_TLS_RU.md

[`docs/TURN_TLS_RU.md`](../TURN_TLS_RU.md)

CastLink 1.0: TURN / TLS fallback

### docs/UI_EDITING_GUIDE_RU.md

[`docs/UI_EDITING_GUIDE_RU.md`](../UI_EDITING_GUIDE_RU.md)

CastLink: где найти и как править элементы интерфейса

### docs/UNIFIED_GRAPHITE_UI_RU.md

[`docs/UNIFIED_GRAPHITE_UI_RU.md`](../UNIFIED_GRAPHITE_UI_RU.md)

Единое оформление CastLink

### docs/UX_GRAPHITE_GUEST_CONTROL_20261012_RU.md

[`docs/UX_GRAPHITE_GUEST_CONTROL_20261012_RU.md`](../UX_GRAPHITE_GUEST_CONTROL_20261012_RU.md)

Упрощение гостевого интерфейса — 12 октября 2026

### docs/VERIFIED_RUNBOOK_RU.md

[`docs/VERIFIED_RUNBOOK_RU.md`](../VERIFIED_RUNBOOK_RU.md)

Проверенный runbook CastLink

### docs/WEB_RUNTIME_DISTRIBUTION_RU.md

[`docs/WEB_RUNTIME_DISTRIBUTION_RU.md`](../WEB_RUNTIME_DISTRIBUTION_RU.md)

Серверный образ для распространения

### docs/WORKING_STATE_RU.md

[`docs/WORKING_STATE_RU.md`](../WORKING_STATE_RU.md)

Следующее уточнение показа: web-only кандидат, MAIN пока e89 — 22.10.2026

### docs/av-fixes-20260926.md

[`docs/av-fixes-20260926.md`](../av-fixes-20260926.md)

Обновление студии и гостей — 26 сентября 2026

### docs/design/CO_PRESENTATION_TOOLBAR_20261019.md

[`docs/design/CO_PRESENTATION_TOOLBAR_20261019.md`](../design/CO_PRESENTATION_TOOLBAR_20261019.md)

Плавающая панель совместной презентации — макет 19.10.2026

### docs/design/DESIGN_TRANSFER_20261018.md

[`docs/design/DESIGN_TRANSFER_20261018.md`](../design/DESIGN_TRANSFER_20261018.md)

Перенос утверждённого оформления на рабочий CastLink

### docs/design/ENTRY_DESIGN_20261020_RU.md

[`docs/design/ENTRY_DESIGN_20261020_RU.md`](../design/ENTRY_DESIGN_20261020_RU.md)

Эталон входа CastLink — 20 октября 2026

### docs/design/EVERY_SURFACE_20261018.md

[`docs/design/EVERY_SURFACE_20261018.md`](../design/EVERY_SURFACE_20261018.md)

CastLink complete surface checklist — 18 Oct 2026

### docs/design/INSTALLER_FAMILY_20261020_RU.md

[`docs/design/INSTALLER_FAMILY_20261020_RU.md`](../design/INSTALLER_FAMILY_20261020_RU.md)

Установщики и панель CastLink — согласованный объём PR66

### docs/design/MEDIA_PARITY_20261018.md

[`docs/design/MEDIA_PARITY_20261018.md`](../design/MEDIA_PARITY_20261018.md)

Паритет медиаинтерфейсов CastLink с /new

### docs/design/NATIVE_PARITY_20261018.md

[`docs/design/NATIVE_PARITY_20261018.md`](../design/NATIVE_PARITY_20261018.md)

CastLink native design coverage — 18 October 2026

### docs/design/OPERATIONS_PARITY_20261018.md

[`docs/design/OPERATIONS_PARITY_20261018.md`](../design/OPERATIONS_PARITY_20261018.md)

Read-only operational UI parity inventory — 18 October 2026

### docs/design/SERVER_INSTALLER_20261020_RU.md

[`docs/design/SERVER_INSTALLER_20261020_RU.md`](../design/SERVER_INSTALLER_20261020_RU.md)

CastLink Server: дизайн установщика для согласования

### docs/design/SERVER_INSTALLER_REVIEW_20261020_RU.md

[`docs/design/SERVER_INSTALLER_REVIEW_20261020_RU.md`](../design/SERVER_INSTALLER_REVIEW_20261020_RU.md)

Независимый просмотр макетов установщика — 20.10.2026

### docs/design/VISUAL_ALIGNMENT_20261018.md

[`docs/design/VISUAL_ALIGNMENT_20261018.md`](../design/VISUAL_ALIGNMENT_20261018.md)

Visual audit ledger — 18 October 2026

### docs/en/SERVER_ROLES_AND_SLOTS.md

[`docs/en/SERVER_ROLES_AND_SLOTS.md`](../en/SERVER_ROLES_AND_SLOTS.md)

Server roles and permanent caster outputs

### docs/features-20260925.md

[`docs/features-20260925.md`](../features-20260925.md)

Мониторинг и статистика — 25 сентября 2026

### docs/guest-access-20260926.md

[`docs/guest-access-20260926.md`](../guest-access-20260926.md)

Гостевой вход и инвайты — 26 сентября 2026

### docs/manual/01_BASICS_RU.md

[`docs/manual/01_BASICS_RU.md`](01_BASICS_RU.md)

01. Основы без программирования

### docs/manual/02_INTERFACES_RU.md

[`docs/manual/02_INTERFACES_RU.md`](02_INTERFACES_RU.md)

02. Интерфейсы и первая рабочая комната

### docs/manual/03_SYSTEMS_RU.md

[`docs/manual/03_SYSTEMS_RU.md`](03_SYSTEMS_RU.md)

03. Системы, модули и связи

### docs/manual/04_DATA_ACCESS_RU.md

[`docs/manual/04_DATA_ACCESS_RU.md`](04_DATA_ACCESS_RU.md)

04. Данные, роли и безопасность

### docs/manual/05_DEVELOPMENT_RU.md

[`docs/manual/05_DEVELOPMENT_RU.md`](05_DEVELOPMENT_RU.md)

05. Первые шаги в коде и безопасная разработка

### docs/manual/06_OPERATIONS_RU.md

[`docs/manual/06_OPERATIONS_RU.md`](06_OPERATIONS_RU.md)

06. Эксплуатация: установка, миграции, обновление и восстановление

### docs/manual/07_ACCEPTANCE_RU.md

[`docs/manual/07_ACCEPTANCE_RU.md`](07_ACCEPTANCE_RU.md)

07. Приёмка исправлений RC-2 и границы проверки

### docs/manual/FILE_MAP_RU.md

[`docs/manual/FILE_MAP_RU.md`](FILE_MAP_RU.md)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/manual/descriptions.json

[`docs/manual/descriptions.json`](descriptions.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/qa/output-media-loopback.json

[`docs/qa/output-media-loopback.json`](../qa/output-media-loopback.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/responsive-layout-v0.9.1.md

[`docs/responsive-layout-v0.9.1.md`](../responsive-layout-v0.9.1.md)

StudioLink 0.9.1 — responsive layout

### docs/superpowers/plans/2026-10-05-self-hosted-cli.md

[`docs/superpowers/plans/2026-10-05-self-hosted-cli.md`](../superpowers/plans/2026-10-05-self-hosted-cli.md)

CastLink Self-hosted CLI Implementation Plan

### docs/superpowers/plans/2026-10-07-easy-setup-gui.md

[`docs/superpowers/plans/2026-10-07-easy-setup-gui.md`](../superpowers/plans/2026-10-07-easy-setup-gui.md)

Easy Setup GUI Implementation Plan

### docs/superpowers/plans/2026-10-07-public-room-studio.md

[`docs/superpowers/plans/2026-10-07-public-room-studio.md`](../superpowers/plans/2026-10-07-public-room-studio.md)

Public room studio Implementation Plan

### docs/superpowers/plans/2026-10-08-manual-emergency-reserve.md

[`docs/superpowers/plans/2026-10-08-manual-emergency-reserve.md`](../superpowers/plans/2026-10-08-manual-emergency-reserve.md)

Manual Emergency Reserve Implementation Plan

### docs/superpowers/plans/2026-10-08-room-transfer-foundation.md

[`docs/superpowers/plans/2026-10-08-room-transfer-foundation.md`](../superpowers/plans/2026-10-08-room-transfer-foundation.md)

Room Transfer Foundation Implementation Plan

### docs/superpowers/plans/2026-10-12-automatic-reserve.md

[`docs/superpowers/plans/2026-10-12-automatic-reserve.md`](../superpowers/plans/2026-10-12-automatic-reserve.md)

Automatic Reserve Implementation Plan

### docs/superpowers/plans/2026-10-13-hosted-access.md

[`docs/superpowers/plans/2026-10-13-hosted-access.md`](../superpowers/plans/2026-10-13-hosted-access.md)

Hosted CastLink access implementation plan

### docs/superpowers/plans/2026-10-13-outbound-reserve.md

[`docs/superpowers/plans/2026-10-13-outbound-reserve.md`](../superpowers/plans/2026-10-13-outbound-reserve.md)

Outbound reserve heartbeat implementation plan

### docs/superpowers/plans/2026-10-16-multiview.md

[`docs/superpowers/plans/2026-10-16-multiview.md`](../superpowers/plans/2026-10-16-multiview.md)

Multiview Implementation Plan

### docs/superpowers/plans/2026-10-16-studio-media-controls.md

[`docs/superpowers/plans/2026-10-16-studio-media-controls.md`](../superpowers/plans/2026-10-16-studio-media-controls.md)

Studio media controls implementation plan

### docs/superpowers/plans/2026-10-18-program-and-staff.md

[`docs/superpowers/plans/2026-10-18-program-and-staff.md`](../superpowers/plans/2026-10-18-program-and-staff.md)

Сохранение программы и доступ персонала — Implementation Plan

### docs/superpowers/plans/2026-10-18-server-roles-slots.md

[`docs/superpowers/plans/2026-10-18-server-roles-slots.md`](../superpowers/plans/2026-10-18-server-roles-slots.md)

Серверные роли и постоянные слоты Implementation Plan

### docs/superpowers/plans/2026-10-18-staff-compact-chat-history.md

[`docs/superpowers/plans/2026-10-18-staff-compact-chat-history.md`](../superpowers/plans/2026-10-18-staff-compact-chat-history.md)

Staff participants and 24-hour chat implementation plan

### docs/superpowers/plans/2026-10-19-caster-presentation-toolbar.md

[`docs/superpowers/plans/2026-10-19-caster-presentation-toolbar.md`](../superpowers/plans/2026-10-19-caster-presentation-toolbar.md)

Утверждённая панель совместной презентации — внедрение

### docs/superpowers/plans/2026-10-19-installation-modes.md

[`docs/superpowers/plans/2026-10-19-installation-modes.md`](../superpowers/plans/2026-10-19-installation-modes.md)

CastLink Installation Modes Implementation Plan

### docs/superpowers/plans/2026-10-19-windows-electron-client.md

[`docs/superpowers/plans/2026-10-19-windows-electron-client.md`](../superpowers/plans/2026-10-19-windows-electron-client.md)

CastLink Windows Electron Client Implementation Plan

### docs/superpowers/plans/2026-10-20-isolated-presentation-converter.md

[`docs/superpowers/plans/2026-10-20-isolated-presentation-converter.md`](../superpowers/plans/2026-10-20-isolated-presentation-converter.md)

Isolated Presentation Conversion Implementation Plan

### docs/superpowers/plans/2026-10-20-pr66-pr67-integration-release.md

[`docs/superpowers/plans/2026-10-20-pr66-pr67-integration-release.md`](../superpowers/plans/2026-10-20-pr66-pr67-integration-release.md)

PR66 + PR67: согласованная интеграция и выпуск

### docs/superpowers/plans/2026-10-20-role-entry-approved-design.md

[`docs/superpowers/plans/2026-10-20-role-entry-approved-design.md`](../superpowers/plans/2026-10-20-role-entry-approved-design.md)

Approved CastLink Entry Implementation Plan

### docs/superpowers/plans/2026-10-20-unified-release.md

[`docs/superpowers/plans/2026-10-20-unified-release.md`](../superpowers/plans/2026-10-20-unified-release.md)

Unified CastLink release — 20 October 2026

### docs/superpowers/plans/2026-10-21-castlink-registration.md

[`docs/superpowers/plans/2026-10-21-castlink-registration.md`](../superpowers/plans/2026-10-21-castlink-registration.md)

CastLink Registration Implementation Plan

### docs/superpowers/plans/2026-10-21-pr73-caster-workspace.md

[`docs/superpowers/plans/2026-10-21-pr73-caster-workspace.md`](../superpowers/plans/2026-10-21-pr73-caster-workspace.md)

PR73 Caster Workspace Implementation Plan

### docs/superpowers/plans/2026-10-21-studio-feedback.md

[`docs/superpowers/plans/2026-10-21-studio-feedback.md`](../superpowers/plans/2026-10-21-studio-feedback.md)

Studio feedback implementation plan

### docs/superpowers/plans/2026-10-22-native-pptx-test.md

[`docs/superpowers/plans/2026-10-22-native-pptx-test.md`](../superpowers/plans/2026-10-22-native-pptx-test.md)

Native PPTX test build implementation plan

### docs/superpowers/plans/2026-10-22-studio2-isolated-deployment.md

[`docs/superpowers/plans/2026-10-22-studio2-isolated-deployment.md`](../superpowers/plans/2026-10-22-studio2-isolated-deployment.md)

Studio2 isolated private deployment plan

### docs/superpowers/specs/2026-10-05-home-room-lobby-design.md

[`docs/superpowers/specs/2026-10-05-home-room-lobby-design.md`](../superpowers/specs/2026-10-05-home-room-lobby-design.md)

Главная CastLink: создание и вход в комнату

### docs/superpowers/specs/2026-10-05-self-hosted-cli-design.md

[`docs/superpowers/specs/2026-10-05-self-hosted-cli-design.md`](../superpowers/specs/2026-10-05-self-hosted-cli-design.md)

CastLink CLI: Windows/macOS и два способа установки

### docs/superpowers/specs/2026-10-07-easy-setup-gui-design.md

[`docs/superpowers/specs/2026-10-07-easy-setup-gui-design.md`](../superpowers/specs/2026-10-07-easy-setup-gui-design.md)

Windows Easy Setup: graphical wrapper

### docs/superpowers/specs/2026-10-07-public-room-studio-design.md

[`docs/superpowers/specs/2026-10-07-public-room-studio-design.md`](../superpowers/specs/2026-10-07-public-room-studio-design.md)

Одна главная: открытое создание своей комнаты

### docs/superpowers/specs/2026-10-08-manual-emergency-reserve.md

[`docs/superpowers/specs/2026-10-08-manual-emergency-reserve.md`](../superpowers/specs/2026-10-08-manual-emergency-reserve.md)

Несколько серверов и ручной аварийный перенос

### docs/superpowers/specs/2026-10-08-room-transfer-foundation.md

[`docs/superpowers/specs/2026-10-08-room-transfer-foundation.md`](../superpowers/specs/2026-10-08-room-transfer-foundation.md)

Ручной перенос комнаты: общая основа

### docs/superpowers/specs/2026-10-12-automatic-reserve.md

[`docs/superpowers/specs/2026-10-12-automatic-reserve.md`](../superpowers/specs/2026-10-12-automatic-reserve.md)

Автоматический резерв и открытые зрители

### docs/superpowers/specs/2026-10-16-multiview-design.md

[`docs/superpowers/specs/2026-10-16-multiview-design.md`](../superpowers/specs/2026-10-16-multiview-design.md)

Multiview test build

### docs/superpowers/specs/2026-10-18-server-roles-slots-design.md

[`docs/superpowers/specs/2026-10-18-server-roles-slots-design.md`](../superpowers/specs/2026-10-18-server-roles-slots-design.md)

Серверные роли и постоянные слоты CastLink

### docs/superpowers/specs/2026-10-19-installation-modes-design.md

[`docs/superpowers/specs/2026-10-19-installation-modes-design.md`](../superpowers/specs/2026-10-19-installation-modes-design.md)

CastLink installation modes

### docs/superpowers/specs/2026-10-19-windows-electron-client-design.md

[`docs/superpowers/specs/2026-10-19-windows-electron-client-design.md`](../superpowers/specs/2026-10-19-windows-electron-client-design.md)

CastLink: первый Windows-клиент на Electron

### docs/superpowers/specs/2026-10-20-isolated-presentation-converter.md

[`docs/superpowers/specs/2026-10-20-isolated-presentation-converter.md`](../superpowers/specs/2026-10-20-isolated-presentation-converter.md)

Изолированное открытие PPTX и PDF

### docs/superpowers/specs/2026-10-21-castlink-registration-design.md

[`docs/superpowers/specs/2026-10-21-castlink-registration-design.md`](../superpowers/specs/2026-10-21-castlink-registration-design.md)

CastLink: сайт, регистрация и пробный токен

### docs/superpowers/specs/2026-10-21-pr73-caster-workspace-design.md

[`docs/superpowers/specs/2026-10-21-pr73-caster-workspace-design.md`](../superpowers/specs/2026-10-21-pr73-caster-workspace-design.md)

PR73 — интерфейс Кастера и совместная презентация

### docs/testing/ACCOUNT_CONTACTS_20261022_RU.md

[`docs/testing/ACCOUNT_CONTACTS_20261022_RU.md`](../testing/ACCOUNT_CONTACTS_20261022_RU.md)

Аккаунт CastLink: логотип, Telegram и контакты — 22.10.2026

### docs/testing/CAMERA_OUTPUT_RU.md

[`docs/testing/CAMERA_OUTPUT_RU.md`](../testing/CAMERA_OUTPUT_RU.md)

Камера и браузерный выход vMix — 20.10.2026

### docs/testing/CASTER_CONTROL_MENU_RU.md

[`docs/testing/CASTER_CONTROL_MENU_RU.md`](../testing/CASTER_CONTROL_MENU_RU.md)

Компактное меню управления презентацией Кастера

### docs/testing/CASTER_FEEDBACK_20261020_RU.md

[`docs/testing/CASTER_FEEDBACK_20261020_RU.md`](../testing/CASTER_FEEDBACK_20261020_RU.md)

Исправления по фото кастера — 20.10.2026

### docs/testing/CASTER_FRAME_FIT_RU.md

[`docs/testing/CASTER_FRAME_FIT_RU.md`](../testing/CASTER_FRAME_FIT_RU.md)

Целый кадр кастера16:9 — 20.10.2026

### docs/testing/CASTER_PRESENTATION_TOOLBAR_RU.md

[`docs/testing/CASTER_PRESENTATION_TOOLBAR_RU.md`](../testing/CASTER_PRESENTATION_TOOLBAR_RU.md)

Плавающая панель совместной презентации Кастера

### docs/testing/CASTER_REACTIONS_20261021_RU.md

[`docs/testing/CASTER_REACTIONS_20261021_RU.md`](../testing/CASTER_REACTIONS_20261021_RU.md)

Восемь исправлений кастера и студии — 21.10.2026

### docs/testing/CASTER_WORKSPACE_LAYOUT_RU.md

[`docs/testing/CASTER_WORKSPACE_LAYOUT_RU.md`](../testing/CASTER_WORKSPACE_LAYOUT_RU.md)

Интерфейс кастера — 19 октября 2026

### docs/testing/CASTLINK_REGISTRATION_RU.md

[`docs/testing/CASTLINK_REGISTRATION_RU.md`](../testing/CASTLINK_REGISTRATION_RU.md)

Главная, регистрация и пробный доступ — 21.10.2026

### docs/testing/CLIENT_CONTROL_UI_PARITY_RU.md

[`docs/testing/CLIENT_CONTROL_UI_PARITY_RU.md`](../testing/CLIENT_CONTROL_UI_PARITY_RU.md)

Оформление панели управления Windows — 20.10.2026

### docs/testing/COMBINED_PR60_PR61_RELEASE_RU.md

[`docs/testing/COMBINED_PR60_PR61_RELEASE_RU.md`](../testing/COMBINED_PR60_PR61_RELEASE_RU.md)

Общий выпуск PR60, PR61 и плавающих панелей — 20.10.2026

### docs/testing/COMBINED_PR63_PR64_PRESENTATION_RU.md

[`docs/testing/COMBINED_PR63_PR64_PRESENTATION_RU.md`](../testing/COMBINED_PR63_PR64_PRESENTATION_RU.md)

Общий выпуск PR63/PR64/PPTX — 20.10.2026

### docs/testing/CONFERENCE_CONTROLS_20261021_RU.md

[`docs/testing/CONFERENCE_CONTROLS_20261021_RU.md`](../testing/CONFERENCE_CONTROLS_20261021_RU.md)

Окна, мобильное управление и совместная презентация — 21.10.2026

### docs/testing/ENTRY_DESIGN_RU.md

[`docs/testing/ENTRY_DESIGN_RU.md`](../testing/ENTRY_DESIGN_RU.md)

Вход студии и кастера — проверка 20.10.2026

### docs/testing/FLOATING_SLIDE_PANELS_RU.md

[`docs/testing/FLOATING_SLIDE_PANELS_RU.md`](../testing/FLOATING_SLIDE_PANELS_RU.md)

Отдельные панели управления презентацией — 20.10.2026

### docs/testing/GUEST_CARD_OUTPUT_ASSETS_20261021_RU.md

[`docs/testing/GUEST_CARD_OUTPUT_ASSETS_20261021_RU.md`](../testing/GUEST_CARD_OUTPUT_ASSETS_20261021_RU.md)

Три точечных исправления по фото — 21.10.2026

### docs/testing/GUEST_COLOR_CORRECTION_20261021_RU.md

[`docs/testing/GUEST_COLOR_CORRECTION_20261021_RU.md`](../testing/GUEST_COLOR_CORRECTION_20261021_RU.md)

Экспозиция и контраст гостя — 21.10.2026

### docs/testing/INSTALLER_FAMILY_PR66_RU.md

[`docs/testing/INSTALLER_FAMILY_PR66_RU.md`](../testing/INSTALLER_FAMILY_PR66_RU.md)

PR66: установщики и панель CastLink — проверенная реализация

### docs/testing/INSTALLER_REINSTALL_REPAIR_20261020_RU.md

[`docs/testing/INSTALLER_REINSTALL_REPAIR_20261020_RU.md`](../testing/INSTALLER_REINSTALL_REPAIR_20261020_RU.md)

Исправление повторной установки Windows — 20.10.2026

### docs/testing/MULTIVIEW_TEST_RU.md

[`docs/testing/MULTIVIEW_TEST_RU.md`](../testing/MULTIVIEW_TEST_RU.md)

Тестовый редактор мультивью

### docs/testing/NATIVE_PPTX_HELPER_RU.md

[`docs/testing/NATIVE_PPTX_HELPER_RU.md`](../testing/NATIVE_PPTX_HELPER_RU.md)

Приватный PPTX helper — 22.10.2026

### docs/testing/NATIVE_PPTX_PRIVATE_PACKAGE_RU.md

[`docs/testing/NATIVE_PPTX_PRIVATE_PACKAGE_RU.md`](../testing/NATIVE_PPTX_PRIVATE_PACKAGE_RU.md)

Изолированный приватный Windows PPTX-кандидат — 22.10.2026

### docs/testing/NATIVE_PPTX_TASK1_RU.md

[`docs/testing/NATIVE_PPTX_TASK1_RU.md`](../testing/NATIVE_PPTX_TASK1_RU.md)

Native PPTX: Task 1 — 22.10.2026

### docs/testing/NATIVE_PPTX_TEST_RU.md

[`docs/testing/NATIVE_PPTX_TEST_RU.md`](../testing/NATIVE_PPTX_TEST_RU.md)

Native PPTX: private test candidate, 22.10.2026

### docs/testing/PC_ONLY_TELEGRAM_RELAY_RU.md

[`docs/testing/PC_ONLY_TELEGRAM_RELAY_RU.md`](../testing/PC_ONLY_TELEGRAM_RELAY_RU.md)

Приватная регистрация: Telegram только через локальный ПК

### docs/testing/PPTX_EMBEDDED_FONTS_RU.md

[`docs/testing/PPTX_EMBEDDED_FONTS_RU.md`](../testing/PPTX_EMBEDDED_FONTS_RU.md)

Встроенные шрифты PPTX и кнопка управления — 20.10.2026

### docs/testing/PPTX_OFFICE_COMPAT_RU.md

[`docs/testing/PPTX_OFFICE_COMPAT_RU.md`](../testing/PPTX_OFFICE_COMPAT_RU.md)

Совместимость импорта PPTX — 19.10.2026

### docs/testing/PPTX_UPLOAD_STREAMING_RU.md

[`docs/testing/PPTX_UPLOAD_STREAMING_RU.md`](../testing/PPTX_UPLOAD_STREAMING_RU.md)

PPTX: потоковая загрузка, 20.10.2026

### docs/testing/PR65_PRODUCTION_DELIVERY_RU.md

[`docs/testing/PR65_PRODUCTION_DELIVERY_RU.md`](../testing/PR65_PRODUCTION_DELIVERY_RU.md)

PR65: проверенный production-выпуск — 20.10.2026

### docs/testing/PR66_DOWNLOADS_LINUX_MANUAL_RU.md

[`docs/testing/PR66_DOWNLOADS_LINUX_MANUAL_RU.md`](../testing/PR66_DOWNLOADS_LINUX_MANUAL_RU.md)

PR66: загрузки и ручная установка Linux — 20.10.2026

### docs/testing/PR66_INSTALLER_SHORTCUT.json

[`docs/testing/PR66_INSTALLER_SHORTCUT.json`](../testing/PR66_INSTALLER_SHORTCUT.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/PR66_PR67_PRODUCTION_DELIVERY_RU.md

[`docs/testing/PR66_PR67_PRODUCTION_DELIVERY_RU.md`](../testing/PR66_PR67_PRODUCTION_DELIVERY_RU.md)

PR66 + PR67: production delivery — 20.10.2026

### docs/testing/PR67_CANDIDATE_RU.md

[`docs/testing/PR67_CANDIDATE_RU.md`](../testing/PR67_CANDIDATE_RU.md)

PR67: кандидат CastLink 1.0.0-rc.8

### docs/testing/PR73_CASTER_WORKSPACE_RU.md

[`docs/testing/PR73_CASTER_WORKSPACE_RU.md`](../testing/PR73_CASTER_WORKSPACE_RU.md)

PR73 — рабочее пространство Кастера

### docs/testing/PR73_LAYOUT_FIX_RU.md

[`docs/testing/PR73_LAYOUT_FIX_RU.md`](../testing/PR73_LAYOUT_FIX_RU.md)

PR73: исправление регрессий компоновки

### docs/testing/PR73_PRESENTATION_UPLOAD_RU.md

[`docs/testing/PR73_PRESENTATION_UPLOAD_RU.md`](../testing/PR73_PRESENTATION_UPLOAD_RU.md)

PR73: потоковая загрузка презентаций — 21.10.2026

### docs/testing/PR73_STAFF_CARD_LAYOUT_FIX_RU.md

[`docs/testing/PR73_STAFF_CARD_LAYOUT_FIX_RU.md`](../testing/PR73_STAFF_CARD_LAYOUT_FIX_RU.md)

PR73: естественная высота карточек персонала — 21.10.2026

### docs/testing/PR74_SLOT_OUTPUT_DELIVERY_RU.md

[`docs/testing/PR74_SLOT_OUTPUT_DELIVERY_RU.md`](../testing/PR74_SLOT_OUTPUT_DELIVERY_RU.md)

PR74: установка постоянных выходов на castlink.ru — 21.10.2026

### docs/testing/PR78_DELIVERY_RU.md

[`docs/testing/PR78_DELIVERY_RU.md`](../testing/PR78_DELIVERY_RU.md)

Поставка PR78 и сверка последних выпусков — 21.10.2026

### docs/testing/PR79_PR81_DELIVERY_RU.md

[`docs/testing/PR79_PR81_DELIVERY_RU.md`](../testing/PR79_PR81_DELIVERY_RU.md)

Поставка PR79/80/81 — 21.10.2026

### docs/testing/PR82_PR83_DELIVERY_RU.md

[`docs/testing/PR82_PR83_DELIVERY_RU.md`](../testing/PR82_PR83_DELIVERY_RU.md)

Поставка PR82 и интеграция PR83 — 21.10.2026

### docs/testing/PR84_DELIVERY_RU.md

[`docs/testing/PR84_DELIVERY_RU.md`](../testing/PR84_DELIVERY_RU.md)

Поставка PR84 — 22.10.2026

### docs/testing/PR90_DELIVERY_RU.md

[`docs/testing/PR90_DELIVERY_RU.md`](../testing/PR90_DELIVERY_RU.md)

Поставка PR90 — 22.10.2026

### docs/testing/PRESENTATION_FLOW_20261022_RU.md

[`docs/testing/PRESENTATION_FLOW_20261022_RU.md`](../testing/PRESENTATION_FLOW_20261022_RU.md)

Подготовка файла и живое совместное листание — 22.10.2026

### docs/testing/PRESENTATION_ISOLATED_CONVERTER_RU.md

[`docs/testing/PRESENTATION_ISOLATED_CONVERTER_RU.md`](../testing/PRESENTATION_ISOLATED_CONVERTER_RU.md)

PPTX: изолированный конвертер — 20.10.2026

### docs/testing/PRESENTATION_PIPELINE_RU.md

[`docs/testing/PRESENTATION_PIPELINE_RU.md`](../testing/PRESENTATION_PIPELINE_RU.md)

PPTX через HTTP и видеопоток PDF — 19.10.2026

### docs/testing/PRODUCTION_UPDATES_20261021_RU.md

[`docs/testing/PRODUCTION_UPDATES_20261021_RU.md`](../testing/PRODUCTION_UPDATES_20261021_RU.md)

Обновления и хранение пользовательских установок — 21.10.2026

### docs/testing/RECIPIENT_SLIDE_POPUP_RU.md

[`docs/testing/RECIPIENT_SLIDE_POPUP_RU.md`](../testing/RECIPIENT_SLIDE_POPUP_RU.md)

Компактный попап управления у получателя

### docs/testing/ROOM_CREATION_PASSWORD_SETTINGS_RU.md

[`docs/testing/ROOM_CREATION_PASSWORD_SETTINGS_RU.md`](../testing/ROOM_CREATION_PASSWORD_SETTINGS_RU.md)

Пароль создания комнат — 19.10.2026

### docs/testing/SERVER_DESKTOP_UPDATE_RU.md

[`docs/testing/SERVER_DESKTOP_UPDATE_RU.md`](../testing/SERVER_DESKTOP_UPDATE_RU.md)

Сервер для Electron-презентаций — установлен 19.10.2026

### docs/testing/SHARED_SLIDES_CLIENT_RU.md

[`docs/testing/SHARED_SLIDES_CLIENT_RU.md`](../testing/SHARED_SLIDES_CLIENT_RU.md)

Совместное листание PDF/PPTX и встроенный компонент клиента — 22.10.2026

### docs/testing/STUDIO2_PRIVATE_DEPLOYMENT_RU.md

[`docs/testing/STUDIO2_PRIVATE_DEPLOYMENT_RU.md`](../testing/STUDIO2_PRIVATE_DEPLOYMENT_RU.md)

Studio2: изолированный приватный тест

### docs/testing/STUDIO_FEEDBACK_20261021_RU.md

[`docs/testing/STUDIO_FEEDBACK_20261021_RU.md`](../testing/STUDIO_FEEDBACK_20261021_RU.md)

Коррекции студии по отзывам владельца — 21.10.2026

### docs/testing/STUDIO_MEDIA_CONTROLS_RU.md

[`docs/testing/STUDIO_MEDIA_CONTROLS_RU.md`](../testing/STUDIO_MEDIA_CONTROLS_RU.md)

Тест настроек подключения и изображения

### docs/testing/STUDIO_SIX_FIXES_20261021_RU.md

[`docs/testing/STUDIO_SIX_FIXES_20261021_RU.md`](../testing/STUDIO_SIX_FIXES_20261021_RU.md)

Шесть коррекций по фотографиям — 21.10.2026

### docs/testing/UNIFIED_FIRST_SCREEN_20261022_RU.md

[`docs/testing/UNIFIED_FIRST_SCREEN_20261022_RU.md`](../testing/UNIFIED_FIRST_SCREEN_20261022_RU.md)

Единый первый экран CastLink — 22.10.2026

### docs/testing/WEB_FLOATING_CONTROLS_RU.md

[`docs/testing/WEB_FLOATING_CONTROLS_RU.md`](../testing/WEB_FLOATING_CONTROLS_RU.md)

Плавающие панели управления слайдами на сайте

### docs/testing/WINDOWS_DESKTOP_CLIENT_RU.md

[`docs/testing/WINDOWS_DESKTOP_CLIENT_RU.md`](../testing/WINDOWS_DESKTOP_CLIENT_RU.md)

Windows Electron Client: проверка прототипа

### docs/testing/WINDOW_RESIZER_20261021_RU.md

[`docs/testing/WINDOW_RESIZER_20261021_RU.md`](../testing/WINDOW_RESIZER_20261021_RU.md)

Разделитель режима «Окно» — уточнение 21.10.2026

### docs/testing/WORKSPACE_LAYOUT_RELEASE_RU.md

[`docs/testing/WORKSPACE_LAYOUT_RELEASE_RU.md`](../testing/WORKSPACE_LAYOUT_RELEASE_RU.md)

Расширение чата и кастера: поставка 20.10.2026

### docs/testing/WORKSPACE_LAYOUT_RU.md

[`docs/testing/WORKSPACE_LAYOUT_RU.md`](../testing/WORKSPACE_LAYOUT_RU.md)

Расширение чата и кастера — 20.10.2026

### docs/testing/receipts/2026-10-19-caster-control-menu.json

[`docs/testing/receipts/2026-10-19-caster-control-menu.json`](../testing/receipts/2026-10-19-caster-control-menu.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-caster-presentation-toolbar.json

[`docs/testing/receipts/2026-10-19-caster-presentation-toolbar.json`](../testing/receipts/2026-10-19-caster-presentation-toolbar.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-caster-workspace-layout.json

[`docs/testing/receipts/2026-10-19-caster-workspace-layout.json`](../testing/receipts/2026-10-19-caster-workspace-layout.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-co-presentation-toolbar-preview.json

[`docs/testing/receipts/2026-10-19-co-presentation-toolbar-preview.json`](../testing/receipts/2026-10-19-co-presentation-toolbar-preview.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-pptx-office-compat.json

[`docs/testing/receipts/2026-10-19-pptx-office-compat.json`](../testing/receipts/2026-10-19-pptx-office-compat.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-presentation-pipeline.json

[`docs/testing/receipts/2026-10-19-presentation-pipeline.json`](../testing/receipts/2026-10-19-presentation-pipeline.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-recipient-slide-popup.json

[`docs/testing/receipts/2026-10-19-recipient-slide-popup.json`](../testing/receipts/2026-10-19-recipient-slide-popup.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-room-creation-password-settings.json

[`docs/testing/receipts/2026-10-19-room-creation-password-settings.json`](../testing/receipts/2026-10-19-room-creation-password-settings.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-server-desktop-update.json

[`docs/testing/receipts/2026-10-19-server-desktop-update.json`](../testing/receipts/2026-10-19-server-desktop-update.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-windows-client.json

[`docs/testing/receipts/2026-10-19-windows-client.json`](../testing/receipts/2026-10-19-windows-client.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-19-windows-presentation-candidate.json

[`docs/testing/receipts/2026-10-19-windows-presentation-candidate.json`](../testing/receipts/2026-10-19-windows-presentation-candidate.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-20-workspace-layout-desktop.json

[`docs/testing/receipts/2026-10-20-workspace-layout-desktop.json`](../testing/receipts/2026-10-20-workspace-layout-desktop.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-20-workspace-layout-public.json

[`docs/testing/receipts/2026-10-20-workspace-layout-public.json`](../testing/receipts/2026-10-20-workspace-layout-public.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-20-workspace-layout-server.json

[`docs/testing/receipts/2026-10-20-workspace-layout-server.json`](../testing/receipts/2026-10-20-workspace-layout-server.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-21-pr73-client-package.json

[`docs/testing/receipts/2026-10-21-pr73-client-package.json`](../testing/receipts/2026-10-21-pr73-client-package.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-21-pr73-layout-fix.json

[`docs/testing/receipts/2026-10-21-pr73-layout-fix.json`](../testing/receipts/2026-10-21-pr73-layout-fix.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-21-pr73-presentation-upload.json

[`docs/testing/receipts/2026-10-21-pr73-presentation-upload.json`](../testing/receipts/2026-10-21-pr73-presentation-upload.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/receipts/2026-10-21-pr73-scene.json

[`docs/testing/receipts/2026-10-21-pr73-scene.json`](../testing/receipts/2026-10-21-pr73-scene.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/reports/2026-10-20-pptx-streaming-image.json

[`docs/testing/reports/2026-10-20-pptx-streaming-image.json`](../testing/reports/2026-10-20-pptx-streaming-image.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/reports/2026-10-20-pptx-streaming-public.json

[`docs/testing/reports/2026-10-20-pptx-streaming-public.json`](../testing/reports/2026-10-20-pptx-streaming-public.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/testing/reports/2026-10-20-pptx-streaming-server.json

[`docs/testing/reports/2026-10-20-pptx-streaming-server.json`](../testing/reports/2026-10-20-pptx-streaming-server.json)

Документация/инструкция; сверяйте дату и статус с текущей сборкой.

### docs/updates-20260926.md

[`docs/updates-20260926.md`](../updates-20260926.md)

Обновление клиентских страниц

### docs/zh-CN/SERVER_ROLES_AND_SLOTS.md

[`docs/zh-CN/SERVER_ROLES_AND_SLOTS.md`](../zh-CN/SERVER_ROLES_AND_SLOTS.md)

服务器角色与播出者固定输出

## infrastructure · 42 файлов

### infrastructure/control-plane/001_multitenant.sql

[`infrastructure/control-plane/001_multitenant.sql`](../../infrastructure/control-plane/001_multitenant.sql)

SQL-структура/миграция: CastLink multi-tenant control-plane foundation.. Может менять БД.

### infrastructure/control-plane/002_super_admin.sql

[`infrastructure/control-plane/002_super_admin.sql`](../../infrastructure/control-plane/002_super_admin.sql)

SQL-структура/миграция: CastLink platform-level access state for Super Admin sessions.. Может менять БД.

### infrastructure/control-plane/003_node_operational_state.sql

[`infrastructure/control-plane/003_node_operational_state.sql`](../../infrastructure/control-plane/003_node_operational_state.sql)

SQL-структура/миграция: Add explicit emergency node state.. Может менять БД.

### infrastructure/control-plane/004_platform_credentials.sql

[`infrastructure/control-plane/004_platform_credentials.sql`](../../infrastructure/control-plane/004_platform_credentials.sql)

SQL-структура/миграция: Creator/delegated access only. Legacy studio-bootstrapped credentials are not accepted.. Может менять БД.

### infrastructure/control-plane/005_node_operations.sql

[`infrastructure/control-plane/005_node_operations.sql`](../../infrastructure/control-plane/005_node_operations.sql)

SQL-структура/миграция: Desired state and acknowledgement are deliberately separate.. Может менять БД.

### infrastructure/control-plane/control-plane.env.example

[`infrastructure/control-plane/control-plane.env.example`](../../infrastructure/control-plane/control-plane.env.example)

Шаблон переменных окружения. Не реальная конфигурация/секреты установки; значения заполняют вне Git.

### infrastructure/diagnostic-browser/.gitignore

[`infrastructure/diagnostic-browser/.gitignore`](../../infrastructure/diagnostic-browser/.gitignore)

Конфигурация инфраструктуры: diagnostic-browser. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/diagnostic-browser/Dockerfile

[`infrastructure/diagnostic-browser/Dockerfile`](../../infrastructure/diagnostic-browser/Dockerfile)

Конфигурация инфраструктуры: diagnostic-browser. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/diagnostic-browser/README.md

[`infrastructure/diagnostic-browser/README.md`](../../infrastructure/diagnostic-browser/README.md)

Opt-in diagnostic browser runtime source

### infrastructure/diagnostic-browser/build-provenance.json

[`infrastructure/diagnostic-browser/build-provenance.json`](../../infrastructure/diagnostic-browser/build-provenance.json)

Конфигурация инфраструктуры: diagnostic-browser. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/diagnostic-browser/runtime-contract.json

[`infrastructure/diagnostic-browser/runtime-contract.json`](../../infrastructure/diagnostic-browser/runtime-contract.json)

Конфигурация инфраструктуры: diagnostic-browser. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/diagnostic-browser/runtime.mjs

[`infrastructure/diagnostic-browser/runtime.mjs`](../../infrastructure/diagnostic-browser/runtime.mjs)

Конфигурация инфраструктуры: diagnostic-browser. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:url`.

### infrastructure/haproxy/haproxy.cfg

[`infrastructure/haproxy/haproxy.cfg`](../../infrastructure/haproxy/haproxy.cfg)

Конфигурация инфраструктуры: haproxy. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/haproxy/haproxy.test.cfg

[`infrastructure/haproxy/haproxy.test.cfg`](../../infrastructure/haproxy/haproxy.test.cfg)

Конфигурация инфраструктуры: haproxy. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/license-service/001_server_registry.sql

[`infrastructure/license-service/001_server_registry.sql`](../../infrastructure/license-service/001_server_registry.sql)

SQL-структура/миграция: CastLink control-plane server registry schema draft.. Может менять БД.

### infrastructure/livekit/docker-compose.yml

[`infrastructure/livekit/docker-compose.yml`](../../infrastructure/livekit/docker-compose.yml)

Описание контейнерных сервисов, сетей, volumes, портов и healthchecks. Не равняется фактически запущенному compose на VPS.

### infrastructure/livekit/private-idle-seal/.gitattributes

[`infrastructure/livekit/private-idle-seal/.gitattributes`](../../infrastructure/livekit/private-idle-seal/.gitattributes)

Конфигурация инфраструктуры: livekit. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/livekit/private-idle-seal/Dockerfile.runtime

[`infrastructure/livekit/private-idle-seal/Dockerfile.runtime`](../../infrastructure/livekit/private-idle-seal/Dockerfile.runtime)

Конфигурация инфраструктуры: livekit. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/livekit/private-idle-seal/livekit-v1.13.7.patch

[`infrastructure/livekit/private-idle-seal/livekit-v1.13.7.patch`](../../infrastructure/livekit/private-idle-seal/livekit-v1.13.7.patch)

Конфигурация инфраструктуры: livekit. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/livekit/private-idle-seal/manifest.json

[`infrastructure/livekit/private-idle-seal/manifest.json`](../../infrastructure/livekit/private-idle-seal/manifest.json)

Конфигурация инфраструктуры: livekit. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/livekit/private-idle-seal/verify.sh

[`infrastructure/livekit/private-idle-seal/verify.sh`](../../infrastructure/livekit/private-idle-seal/verify.sh)

Конфигурация инфраструктуры: livekit. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/livekit/turn.example.yaml

[`infrastructure/livekit/turn.example.yaml`](../../infrastructure/livekit/turn.example.yaml)

Конфигурация инфраструктуры: livekit. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/postgres/001_rooms.sql

[`infrastructure/postgres/001_rooms.sql`](../../infrastructure/postgres/001_rooms.sql)

SQL-структура/миграция: CastLink PostgreSQL storage schema, phase 1.. Может менять БД.

### infrastructure/postgres/002_studio_scope.sql

[`infrastructure/postgres/002_studio_scope.sql`](../../infrastructure/postgres/002_studio_scope.sql)

SQL-структура/миграция: Scope node-local rooms by studio while preserving existing single-studio data.. Может менять БД.

### infrastructure/postgres/003_diagnostic_room_revision.sql

[`infrastructure/postgres/003_diagnostic_room_revision.sql`](../../infrastructure/postgres/003_diagnostic_room_revision.sql)

SQL-структура/миграция: Optional diagnostic receipts; ordinary room credentials and data are unchanged.. Может менять БД.

### infrastructure/postgres/004_room_creator_access.sql

[`infrastructure/postgres/004_room_creator_access.sql`](../../infrastructure/postgres/004_room_creator_access.sql)

SQL-структура/миграция: Add room-scoped creator credentials without changing legacy rooms or grants.. Может менять БД.

### infrastructure/postgres/005_server_staff_access.sql

[`infrastructure/postgres/005_server_staff_access.sql`](../../infrastructure/postgres/005_server_staff_access.sql)

SQL-структура/миграция: проверить таблицы, ключи и ограничения перед запуском. Может менять БД.

### infrastructure/postgres/006_caster_slots.sql

[`infrastructure/postgres/006_caster_slots.sql`](../../infrastructure/postgres/006_caster_slots.sql)

SQL-структура/миграция: проверить таблицы, ключи и ограничения перед запуском. Может менять БД.

### infrastructure/production/docker-compose.media.yml

[`infrastructure/production/docker-compose.media.yml`](../../infrastructure/production/docker-compose.media.yml)

Описание контейнерных сервисов, сетей, volumes, портов и healthchecks. Не равняется фактически запущенному compose на VPS.

### infrastructure/production/docker-compose.yml

[`infrastructure/production/docker-compose.yml`](../../infrastructure/production/docker-compose.yml)

Описание контейнерных сервисов, сетей, volumes, портов и healthchecks. Не равняется фактически запущенному compose на VPS.

### infrastructure/production/livekit.yaml.example

[`infrastructure/production/livekit.yaml.example`](../../infrastructure/production/livekit.yaml.example)

Конфигурация инфраструктуры: production. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/production/postgres.env.example

[`infrastructure/production/postgres.env.example`](../../infrastructure/production/postgres.env.example)

Шаблон переменных окружения. Не реальная конфигурация/секреты установки; значения заполняют вне Git.

### infrastructure/production/rtc-admission.Caddyfile.example

[`infrastructure/production/rtc-admission.Caddyfile.example`](../../infrastructure/production/rtc-admission.Caddyfile.example)

Конфигурация инфраструктуры: production. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/production/systemd/castlink-node-heartbeat.service

[`infrastructure/production/systemd/castlink-node-heartbeat.service`](../../infrastructure/production/systemd/castlink-node-heartbeat.service)

Конфигурация инфраструктуры: production. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/production/systemd/castlink-node-heartbeat.timer

[`infrastructure/production/systemd/castlink-node-heartbeat.timer`](../../infrastructure/production/systemd/castlink-node-heartbeat.timer)

Конфигурация инфраструктуры: production. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/production/web.env.example

[`infrastructure/production/web.env.example`](../../infrastructure/production/web.env.example)

Шаблон переменных окружения. Не реальная конфигурация/секреты установки; значения заполняют вне Git.

### infrastructure/self-hosted/Caddyfile.template

[`infrastructure/self-hosted/Caddyfile.template`](../../infrastructure/self-hosted/Caddyfile.template)

Конфигурация инфраструктуры: self-hosted. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/self-hosted/cli-release.schema.json

[`infrastructure/self-hosted/cli-release.schema.json`](../../infrastructure/self-hosted/cli-release.schema.json)

Конфигурация инфраструктуры: self-hosted. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/self-hosted/offline-server.schema.json

[`infrastructure/self-hosted/offline-server.schema.json`](../../infrastructure/self-hosted/offline-server.schema.json)

Конфигурация инфраструктуры: self-hosted. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/self-hosted/release.schema.json

[`infrastructure/self-hosted/release.schema.json`](../../infrastructure/self-hosted/release.schema.json)

Конфигурация инфраструктуры: self-hosted. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/turn-tls/Dockerfile

[`infrastructure/turn-tls/Dockerfile`](../../infrastructure/turn-tls/Dockerfile)

Конфигурация инфраструктуры: turn-tls. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

### infrastructure/turn-tls/entrypoint.sh

[`infrastructure/turn-tls/entrypoint.sh`](../../infrastructure/turn-tls/entrypoint.sh)

Конфигурация инфраструктуры: turn-tls. Адреса и порты сверяются с конкретной установкой; не применять вслепую.

## native · 41 файлов

### native/primary-launcher/CONTRACT.md

[`native/primary-launcher/CONTRACT.md`](../../native/primary-launcher/CONTRACT.md)

Primary Windows launcher source boundary

### native/primary-launcher/broker.c

[`native/primary-launcher/broker.c`](../../native/primary-launcher/broker.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/broker.h

[`native/primary-launcher/broker.h`](../../native/primary-launcher/broker.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/catalog/docker-candidate-v1.ps1

[`native/primary-launcher/catalog/docker-candidate-v1.ps1`](../../native/primary-launcher/catalog/docker-candidate-v1.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/catalog/private-path-v1.ps1

[`native/primary-launcher/catalog/private-path-v1.ps1`](../../native/primary-launcher/catalog/private-path-v1.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/catalog/registry-status-v1.ps1

[`native/primary-launcher/catalog/registry-status-v1.ps1`](../../native/primary-launcher/catalog/registry-status-v1.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/compose-image.inc

[`native/primary-launcher/compose-image.inc`](../../native/primary-launcher/compose-image.inc)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/control-result.inc

[`native/primary-launcher/control-result.inc`](../../native/primary-launcher/control-result.inc)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/core.c

[`native/primary-launcher/core.c`](../../native/primary-launcher/core.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/core.h

[`native/primary-launcher/core.h`](../../native/primary-launcher/core.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/docker-windows.h

[`native/primary-launcher/docker-windows.h`](../../native/primary-launcher/docker-windows.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/docker.c

[`native/primary-launcher/docker.c`](../../native/primary-launcher/docker.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/docker.h

[`native/primary-launcher/docker.h`](../../native/primary-launcher/docker.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/image-result.inc

[`native/primary-launcher/image-result.inc`](../../native/primary-launcher/image-result.inc)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/managed.c

[`native/primary-launcher/managed.c`](../../native/primary-launcher/managed.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/managed.h

[`native/primary-launcher/managed.h`](../../native/primary-launcher/managed.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/native-bootstrap.mjs

[`native/primary-launcher/native-bootstrap.mjs`](../../native/primary-launcher/native-bootstrap.mjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:fs`.

Переменные окружения (только имена): `CASTLINK_NATIVE_REPLY_FD`, `CASTLINK_NATIVE_REQUEST_FD`.

### native/primary-launcher/private-volume-publisher.h

[`native/primary-launcher/private-volume-publisher.h`](../../native/primary-launcher/private-volume-publisher.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/protocol.c

[`native/primary-launcher/protocol.c`](../../native/primary-launcher/protocol.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/protocol.h

[`native/primary-launcher/protocol.h`](../../native/primary-launcher/protocol.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/root-catalog.c

[`native/primary-launcher/root-catalog.c`](../../native/primary-launcher/root-catalog.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/root-catalog.h

[`native/primary-launcher/root-catalog.h`](../../native/primary-launcher/root-catalog.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/root-formats.h

[`native/primary-launcher/root-formats.h`](../../native/primary-launcher/root-formats.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/security.c

[`native/primary-launcher/security.c`](../../native/primary-launcher/security.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/security.h

[`native/primary-launcher/security.h`](../../native/primary-launcher/security.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/target-catalog.c

[`native/primary-launcher/target-catalog.c`](../../native/primary-launcher/target-catalog.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/target-catalog.h

[`native/primary-launcher/target-catalog.h`](../../native/primary-launcher/target-catalog.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/target-record.c

[`native/primary-launcher/target-record.c`](../../native/primary-launcher/target-record.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/target-record.h

[`native/primary-launcher/target-record.h`](../../native/primary-launcher/target-record.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/target-validation.h

[`native/primary-launcher/target-validation.h`](../../native/primary-launcher/target-validation.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/target-windows.c

[`native/primary-launcher/target-windows.c`](../../native/primary-launcher/target-windows.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/target-windows.h

[`native/primary-launcher/target-windows.h`](../../native/primary-launcher/target-windows.h)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/volume-guest.inc

[`native/primary-launcher/volume-guest.inc`](../../native/primary-launcher/volume-guest.inc)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/volume-root.inc

[`native/primary-launcher/volume-root.inc`](../../native/primary-launcher/volume-root.inc)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/volume-service.inc

[`native/primary-launcher/volume-service.inc`](../../native/primary-launcher/volume-service.inc)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/primary-launcher/windows.c

[`native/primary-launcher/windows.c`](../../native/primary-launcher/windows.c)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/windows-powerpoint/Control.ps1

[`native/windows-powerpoint/Control.ps1`](../../native/windows-powerpoint/Control.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/windows-process-audio/ProcessAudio.cs

[`native/windows-process-audio/ProcessAudio.cs`](../../native/windows-process-audio/ProcessAudio.cs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/windows-process-audio/README.md

[`native/windows-process-audio/README.md`](../../native/windows-process-audio/README.md)

PowerPoint process audio helper

### native/windows-window-slides/WindowSlides.Tests.cs

[`native/windows-window-slides/WindowSlides.Tests.cs`](../../native/windows-window-slides/WindowSlides.Tests.cs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### native/windows-window-slides/WindowSlides.cs

[`native/windows-window-slides/WindowSlides.cs`](../../native/windows-window-slides/WindowSlides.cs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

## scripts · 242 файлов

### scripts/audit-release-artifacts.py

[`scripts/audit-release-artifacts.py`](../../scripts/audit-release-artifacts.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/build-brand-icons.mjs

[`scripts/build-brand-icons.mjs`](../../scripts/build-brand-icons.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`, `node:url`.

### scripts/build-manual-index.mjs

[`scripts/build-manual-index.mjs`](../../scripts/build-manual-index.mjs)

Воспроизводимая карта файлов/импортов/экспортов для этого мануала. Не читает production или Git credentials.

Библиотеки/Node: `node:child_process`, `node:fs`, `node:path`, `node:url`.

### scripts/build-simple-easy-setup-host.ps1

[`scripts/build-simple-easy-setup-host.ps1`](../../scripts/build-simple-easy-setup-host.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/build-simple-easy-setup-images.mjs

[`scripts/build-simple-easy-setup-images.mjs`](../../scripts/build-simple-easy-setup-images.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/package-simple-easy-setup.mjs`](../../scripts/package-simple-easy-setup.mjs), [`scripts/release-track.cjs`](../../scripts/release-track.cjs).

Библиотеки/Node: `node:child_process`, `node:fs`, `node:path`, `node:stream/promises`, `node:zlib`.

Переменные окружения (только имена): `CASTLINK_PYTHON`, `CODEX_PROXY_CERT`.

### scripts/build-windows-primary-managed.ps1

[`scripts/build-windows-primary-managed.ps1`](../../scripts/build-windows-primary-managed.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/build-windows-primary.mjs

[`scripts/build-windows-primary.mjs`](../../scripts/build-windows-primary.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/windows-primary-build-diagnostics.mjs`](../../scripts/windows-primary-build-diagnostics.mjs), [`scripts/windows-primary-docker-config.mjs`](../../scripts/windows-primary-docker-config.mjs), [`scripts/windows-primary-inventory.mjs`](../../scripts/windows-primary-inventory.mjs), [`scripts/windows-primary-managed.mjs`](../../scripts/windows-primary-managed.mjs), [`scripts/windows-primary-pe.mjs`](../../scripts/windows-primary-pe.mjs), [`scripts/windows-primary-target-helper-inventory.mjs`](../../scripts/windows-primary-target-helper-inventory.mjs).

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs/promises`, `node:path`, `node:url`.

### scripts/build-windows-primary.ps1

[`scripts/build-windows-primary.ps1`](../../scripts/build-windows-primary.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/ci-package-cli.mjs

[`scripts/ci-package-cli.mjs`](../../scripts/ci-package-cli.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `assertNative`, `verifyUpstreamChecksum`, `verifyArchiveChecksum`, `invokeLauncher`.

Читает/импортирует: [`scripts/package-cli.mjs`](../../scripts/package-cli.mjs).

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs/promises`, `node:path`, `node:url`.

Переменные окружения (только имена): `GITHUB_SHA`, `GITHUB_STEP_SUMMARY`, `RUNNER_TEMP`.

### scripts/collect-runtime-licenses.mjs

[`scripts/collect-runtime-licenses.mjs`](../../scripts/collect-runtime-licenses.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `collectRuntimeLicenses`.

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`.

Используют: [`scripts/prepare-web-runtime.mjs`](../../scripts/prepare-web-runtime.mjs), [`scripts/tests/collect-runtime-licenses.test.mjs`](../../scripts/tests/collect-runtime-licenses.test.mjs).

### scripts/control-plane-migrate.mjs

[`scripts/control-plane-migrate.mjs`](../../scripts/control-plane-migrate.mjs)

Последовательное применение central control-plane SQL из infrastructure/control-plane.

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`, `node:process`, `pg`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `DATABASE_URL`.

### scripts/control-plane-register-node.mjs

[`scripts/control-plane-register-node.mjs`](../../scripts/control-plane-register-node.mjs)

Регистрация node endpoint, региона и capacity в реестре; не физический запуск сервера.

Библиотеки/Node: `node:module`, `node:process`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_REGISTER_MAX_PARTICIPANTS`, `CASTLINK_REGISTER_MAX_STUDIOS`, `CASTLINK_REGISTER_MAX_VIDEO_TRACKS`, `CASTLINK_REGISTER_NODE_ENDPOINT`, `CASTLINK_REGISTER_NODE_ID`, `CASTLINK_REGISTER_NODE_NAME`, `CASTLINK_REGISTER_NODE_REGION`, `CASTLINK_REGISTER_NODE_TYPE`, `DATABASE_URL`.

### scripts/control-plane-seed-default.mjs

[`scripts/control-plane-seed-default.mjs`](../../scripts/control-plane-seed-default.mjs)

Создание/согласование default organization, Studio, node и room metadata.

Читает/импортирует: [`scripts/control-plane-seed-transaction.mjs`](../../scripts/control-plane-seed-transaction.mjs).

Библиотеки/Node: `node:module`, `node:process`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `CASTLINK_DEFAULT_ACCOUNT_ID`, `CASTLINK_DEFAULT_ORGANIZATION_ID`, `CASTLINK_DEFAULT_STUDIO_ID`, `CASTLINK_DEPLOYMENT_MODEL`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_NAME`, `CASTLINK_NODE_REGION`, `DATABASE_URL`, `STUDIOLINK_DEFAULT_STUDIO_ID`, `STUDIOLINK_INSTALLATION_ID`.

### scripts/control-plane-seed-transaction.mjs

[`scripts/control-plane-seed-transaction.mjs`](../../scripts/control-plane-seed-transaction.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `seedDefaultTransaction`.

Библиотеки/Node: `node:crypto`.

Используют: [`scripts/control-plane-seed-default.mjs`](../../scripts/control-plane-seed-default.mjs), [`scripts/setup-database-v1.mjs`](../../scripts/setup-database-v1.mjs).

### scripts/docker-desktop-macos-pins.json

[`scripts/docker-desktop-macos-pins.json`](../../scripts/docker-desktop-macos-pins.json)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/docker-desktop-macos-provenance.mjs

[`scripts/docker-desktop-macos-provenance.mjs`](../../scripts/docker-desktop-macos-provenance.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `DESKTOP_PINS`, `parseSigningEvidence`, `inspectMacDesktopProvenance`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:url`.

Используют: [`scripts/tests/docker-desktop-macos-provenance.test.mjs`](../../scripts/tests/docker-desktop-macos-provenance.test.mjs).

Переменные окружения (только имена): `GITHUB_SHA`.

### scripts/easy-setup-launcher.cs

[`scripts/easy-setup-launcher.cs`](../../scripts/easy-setup-launcher.cs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/fixtures/ci-server-manifest.json

[`scripts/fixtures/ci-server-manifest.json`](../../scripts/fixtures/ci-server-manifest.json)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/heartbeat-host-metrics.mjs

[`scripts/heartbeat-host-metrics.mjs`](../../scripts/heartbeat-host-metrics.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `networkOutRate`, `sampleHostNetwork`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:os`, `node:path`.

Используют: [`apps/web/tests/heartbeat-host-metrics.cjs`](../../apps/web/tests/heartbeat-host-metrics.cjs), [`scripts/node-heartbeat.mjs`](../../scripts/node-heartbeat.mjs).

Переменные окружения (только имена): `CASTLINK_HEARTBEAT_COUNTER_FILE`, `CASTLINK_NETWORK_INTERFACE`.

### scripts/install-cli.mjs

[`scripts/install-cli.mjs`](../../scripts/install-cli.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `windowsPrivateCreateScript`, `installPackage`, `windowsUserPathScript`, `commitWindowsPathTransaction`, `registerUserPath`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:url`.

Переменные окружения (только имена): `PATH`.

### scripts/install-ubuntu.sh

[`scripts/install-ubuntu.sh`](../../scripts/install-ubuntu.sh)

Начальная установка Linux-окружения и bootstrap-конфигурации; изменяет хост.

### scripts/install-windows.ps1

[`scripts/install-windows.ps1`](../../scripts/install-windows.ps1)

Bootstrap Windows/Docker-установки; не нативный media-клиент.

### scripts/linux-compose-setup.py

[`scripts/linux-compose-setup.py`](../../scripts/linux-compose-setup.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Переменные окружения (только имена): `CASTLINK_SETUP_TOKEN`.

### scripts/node-heartbeat.mjs

[`scripts/node-heartbeat.mjs`](../../scripts/node-heartbeat.mjs)

Однократный сбор LiveKit/loadavg/memory и подписанная отправка heartbeat.

Читает/импортирует: [`scripts/heartbeat-host-metrics.mjs`](../../scripts/heartbeat-host-metrics.mjs).

Библиотеки/Node: `node:crypto`, `node:module`, `node:os`, `node:process`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_TIMEOUT_MS`, `CASTLINK_CONTROL_PLANE_URL`, `CASTLINK_ENFORCE_NODE_ADMISSION`, `CASTLINK_NODE_ID`, `CASTLINK_NODE_REGION`, `CASTLINK_NODE_SECRET`, `CASTLINK_NODE_TYPE`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`, `NODE_ENV`.

### scripts/offline-release.mjs

[`scripts/offline-release.mjs`](../../scripts/offline-release.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `validateOfflineRelease`, `validateOfflinePrivateConfig`.

Библиотеки/Node: `node:util`.

Используют: [`scripts/package-server-offline.mjs`](../../scripts/package-server-offline.mjs), [`scripts/producer-server-offline.mjs`](../../scripts/producer-server-offline.mjs).

### scripts/optional/presentation/CastLink-PowerPoint-Windows.ps1

[`scripts/optional/presentation/CastLink-PowerPoint-Windows.ps1`](../../scripts/optional/presentation/CastLink-PowerPoint-Windows.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/optional/presentation/CastLink-PowerPoint-macOS.js

[`scripts/optional/presentation/CastLink-PowerPoint-macOS.js`](../../scripts/optional/presentation/CastLink-PowerPoint-macOS.js)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `Foundation`.

### scripts/package-cli-archive.py

[`scripts/package-cli-archive.py`](../../scripts/package-cli-archive.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/package-cli.mjs

[`scripts/package-cli.mjs`](../../scripts/package-cli.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `RUNTIMES`, `serverManifest`, `archiveInterpreter`, `buildBootstrap`, `writeLaunchers`, `verifyPackage`, `packageCli`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:url`.

Используют: [`scripts/ci-package-cli.mjs`](../../scripts/ci-package-cli.mjs), [`scripts/package-easy-setup.mjs`](../../scripts/package-easy-setup.mjs), [`scripts/tests/ci-package-cli.test.mjs`](../../scripts/tests/ci-package-cli.test.mjs).

### scripts/package-easy-setup.mjs

[`scripts/package-easy-setup.mjs`](../../scripts/package-easy-setup.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `packageEasySetup`.

Читает/импортирует: [`scripts/package-cli.mjs`](../../scripts/package-cli.mjs), [`scripts/windows-primary-inventory.mjs`](../../scripts/windows-primary-inventory.mjs).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`, `node:url`.

Используют: [`scripts/tests/package-easy-setup.test.mjs`](../../scripts/tests/package-easy-setup.test.mjs).

### scripts/package-pptx-web-test.py

[`scripts/package-pptx-web-test.py`](../../scripts/package-pptx-web-test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/package-server-offline.mjs

[`scripts/package-server-offline.mjs`](../../scripts/package-server-offline.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `LIMITS`, `validateOfflineProvenance`, `validateOfflineInput`, `packageServerOffline`, `verifyOfflineSidecar`.

Читает/импортирует: [`scripts/offline-release.mjs`](../../scripts/offline-release.mjs).

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:stream`, `node:stream/promises`, `node:url`, `node:zlib`.

Используют: [`scripts/producer-server-offline.mjs`](../../scripts/producer-server-offline.mjs), [`scripts/tests/offline-component-provenance.test.mjs`](../../scripts/tests/offline-component-provenance.test.mjs), [`scripts/tests/producer-server-offline.test.mjs`](../../scripts/tests/producer-server-offline.test.mjs).

### scripts/package-simple-easy-setup.mjs

[`scripts/package-simple-easy-setup.mjs`](../../scripts/package-simple-easy-setup.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `stockReferences`, `turnTlsBaseReference`, `imageReferences`, `assemble`.

Читает/импортирует: [`scripts/release-track.cjs`](../../scripts/release-track.cjs).

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`.

Используют: [`scripts/build-simple-easy-setup-images.mjs`](../../scripts/build-simple-easy-setup-images.mjs), [`scripts/tests/package-simple-easy-setup.test.mjs`](../../scripts/tests/package-simple-easy-setup.test.mjs), [`scripts/tests/turn-tls-image.smoke.mjs`](../../scripts/tests/turn-tls-image.smoke.mjs).

Переменные окружения (только имена): `CASTLINK_PYTHON`.

### scripts/package-third-party-sources.py

[`scripts/package-third-party-sources.py`](../../scripts/package-third-party-sources.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/postgres-backup.sh

[`scripts/postgres-backup.sh`](../../scripts/postgres-backup.sh)

Создание custom pg_dump, проверка pg_restore --list и контрольной суммы.

### scripts/postgres-import-rooms.mjs

[`scripts/postgres-import-rooms.mjs`](../../scripts/postgres-import-rooms.mjs)

Перенос legacy JSON-комнат в PostgreSQL с отдельной проверкой результата.

Библиотеки/Node: `,
});

const client = await pool.connect();
try {
  await client.query(`, `node:fs/promises`, `node:module`, `node:path`, `node:process`, `pg`.

Переменные окружения (только имена): `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `DATABASE_URL`, `STUDIOLINK_DATA_DIR`, `STUDIOLINK_DEFAULT_STUDIO_ID`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_ROOMS_FILE`.

### scripts/postgres-migrate.mjs

[`scripts/postgres-migrate.mjs`](../../scripts/postgres-migrate.mjs)

Node-local SQL migrations комнат. Выполнять только в выбранной БД после backup.

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`, `node:process`, `pg`.

Переменные окружения (только имена): `CASTLINK_DB_CONNECT_TIMEOUT_MS`, `CASTLINK_DB_STATEMENT_TIMEOUT_MS`, `DATABASE_URL`.

### scripts/postgres-restore.sh

[`scripts/postgres-restore.sh`](../../scripts/postgres-restore.sh)

Явное восстановление PostgreSQL с подтверждением замены. Потенциально разрушительно.

### scripts/prepare-web-runtime.mjs

[`scripts/prepare-web-runtime.mjs`](../../scripts/prepare-web-runtime.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `assertRuntimeFiles`, `operatorScripts`, `removePresentationRuntimeAssets`, `prepareRuntime`.

Читает/импортирует: [`apps/web/scripts/prepare-pdf-assets.mjs`](../../apps/web/scripts/prepare-pdf-assets.mjs), [`scripts/collect-runtime-licenses.mjs`](../../scripts/collect-runtime-licenses.mjs).

Библиотеки/Node: `node:fs/promises`, `node:path`, `node:url`.

Используют: [`scripts/tests/prepare-web-runtime.test.mjs`](../../scripts/tests/prepare-web-runtime.test.mjs), [`scripts/tests/web-runtime-image.smoke.mjs`](../../scripts/tests/web-runtime-image.smoke.mjs).

### scripts/presentation-converter/server.py

[`scripts/presentation-converter/server.py`](../../scripts/presentation-converter/server.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/presentation-converter/test_server.py

[`scripts/presentation-converter/test_server.py`](../../scripts/presentation-converter/test_server.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/presentation-upload-runtime.cjs

[`scripts/presentation-upload-runtime.cjs`](../../scripts/presentation-upload-runtime.cjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:http`.

Используют: [`scripts/tests/presentation-upload-runtime.test.cjs`](../../scripts/tests/presentation-upload-runtime.test.cjs).

### scripts/producer-server-offline.mjs

[`scripts/producer-server-offline.mjs`](../../scripts/producer-server-offline.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `exportRegistryImage`, `normalizeRegistrySave`, `produceServerOffline`.

Читает/импортирует: [`scripts/offline-release.mjs`](../../scripts/offline-release.mjs), [`scripts/package-server-offline.mjs`](../../scripts/package-server-offline.mjs).

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:stream`, `node:stream/promises`, `node:url`, `node:zlib`.

Используют: [`scripts/tests/offline-component-provenance.test.mjs`](../../scripts/tests/offline-component-provenance.test.mjs).

### scripts/production-image-retention.mjs

[`scripts/production-image-retention.mjs`](../../scripts/production-image-retention.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `expectedSource`, `registerParentImages`, `mayRetireLeafImage`, `cleanupParentImages`.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `node:url`.

Используют: [`scripts/tests/production-image-retention.test.mjs`](../../scripts/tests/production-image-retention.test.mjs).

Переменные окружения (только имена): `CASTLINK_SOURCE_COMMIT`.

### scripts/production-preflight.mjs

[`scripts/production-preflight.mjs`](../../scripts/production-preflight.mjs)

Предварительная валидация compose/env/image перед установкой; не выводит значения секретов.

Библиотеки/Node: `node:fs/promises`, `node:path`, `node:process`.

Переменные окружения (только имена): `CASTLINK_WEB_IMAGE`.

### scripts/production-rollback.sh

[`scripts/production-rollback.sh`](../../scripts/production-rollback.sh)

Откат web image из сохранённого manifest; не возврат БД и не гарантия сохранения новой security policy.

### scripts/production-update.sh

[`scripts/production-update.sh`](../../scripts/production-update.sh)

Backup данных и PostgreSQL, замена web, health gate и попытка image rollback; не мигрирует всю БД автоматически.

### scripts/publish-release-track.cjs

[`scripts/publish-release-track.cjs`](../../scripts/publish-release-track.cjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/release-track.cjs`](../../scripts/release-track.cjs).

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`, `node:path`.

Используют: [`scripts/tests/release-tracks.test.cjs`](../../scripts/tests/release-tracks.test.cjs), [`sites/castlink-general/download-releases.test.cjs`](../../sites/castlink-general/download-releases.test.cjs).

Переменные окружения (только имена): `CASTLINK_RELEASE_NOTES`, `GITHUB_REF`, `GITHUB_SHA`.

### scripts/release-track.cjs

[`scripts/release-track.cjs`](../../scripts/release-track.cjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:fs`, `node:path`.

Используют: [`apps/desktop/scripts/package-files.cjs`](../../apps/desktop/scripts/package-files.cjs), [`apps/desktop/scripts/setup-resources.cjs`](../../apps/desktop/scripts/setup-resources.cjs), [`apps/desktop/tests/setup-resources.test.cjs`](../../apps/desktop/tests/setup-resources.test.cjs), [`scripts/build-simple-easy-setup-images.mjs`](../../scripts/build-simple-easy-setup-images.mjs), [`scripts/package-simple-easy-setup.mjs`](../../scripts/package-simple-easy-setup.mjs), [`scripts/publish-release-track.cjs`](../../scripts/publish-release-track.cjs), [`scripts/tests/package-simple-easy-setup.test.mjs`](../../scripts/tests/package-simple-easy-setup.test.mjs), [`scripts/tests/release-tracks.test.cjs`](../../scripts/tests/release-tracks.test.cjs), [`sites/castlink-general/download-releases.test.cjs`](../../sites/castlink-general/download-releases.test.cjs).

Переменные окружения (только имена): `GITHUB_OUTPUT`, `GITHUB_REF`.

### scripts/runtime-startup-observe-v1.mjs

[`scripts/runtime-startup-observe-v1.mjs`](../../scripts/runtime-startup-observe-v1.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `observeRuntimeAuthority`, `runtimeObserverMain`.

Читает/импортирует: [`scripts/setup-database-v1.mjs`](../../scripts/setup-database-v1.mjs), [`scripts/setup-observer-internal-v1.mjs`](../../scripts/setup-observer-internal-v1.mjs).

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`, `node:url`, `node:util`, `pg`.

### scripts/server-peer-request.d.mts

[`scripts/server-peer-request.d.mts`](../../scripts/server-peer-request.d.mts)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `requestServerPeer`.

### scripts/server-peer-request.mjs

[`scripts/server-peer-request.mjs`](../../scripts/server-peer-request.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `requestServerPeer`.

Читает/импортирует: [`scripts/server-profile-store.mjs`](../../scripts/server-profile-store.mjs).

Библиотеки/Node: `node:dns/promises`, `node:https`, `node:net`, `node:tls`.

Используют: [`apps/web/lib/server-peer-request.ts`](../../apps/web/lib/server-peer-request.ts), [`scripts/server-provisioning-operator.mjs`](../../scripts/server-provisioning-operator.mjs), [`scripts/tests/server-peer-request.test.mjs`](../../scripts/tests/server-peer-request.test.mjs).

### scripts/server-profile-store.d.mts

[`scripts/server-profile-store.d.mts`](../../scripts/server-profile-store.d.mts)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `ServerScope`, `ServerPeer`, `ServerProfileIdentity`, `requireUuid`, `exactHttpsOrigin`, `validateProvisioningHost`, `validatePeer`, `serverProfileIdentity`, `listRoomServerProfiles`, `getServerPeer`, `getIncomingServerPeer`, `putServerPeer`, `removeRoomServerPeer`, `registerPeerViaOperator`.

### scripts/server-profile-store.mjs

[`scripts/server-profile-store.mjs`](../../scripts/server-profile-store.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `requireUuid`, `exactHttpsOrigin`, `validateProvisioningHost`, `validatePeer`, `serverProfileIdentity`, `listRoomServerProfiles`, `getServerPeer`, `getIncomingServerPeer`, `removeRoomServerPeer`, `putServerPeer`, `registerPeerViaOperator`, `operator`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:http`, `node:net`, `node:path`, `node:url`.

Используют: [`apps/web/lib/server-profiles.ts`](../../apps/web/lib/server-profiles.ts), [`apps/web/tests/server-provisioning-api.cjs`](../../apps/web/tests/server-provisioning-api.cjs), [`scripts/server-peer-request.mjs`](../../scripts/server-peer-request.mjs), [`scripts/server-provisioning-operator.mjs`](../../scripts/server-provisioning-operator.mjs), [`scripts/server-provisioning.mjs`](../../scripts/server-provisioning.mjs), [`scripts/tests/server-profile-store.test.mjs`](../../scripts/tests/server-profile-store.test.mjs).

### scripts/server-provision-vps.py

[`scripts/server-provision-vps.py`](../../scripts/server-provision-vps.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Переменные окружения (только имена): `CASTLINK_SETUP_TOKEN`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### scripts/server-provisioning-operator.mjs

[`scripts/server-provisioning-operator.mjs`](../../scripts/server-provisioning-operator.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/server-peer-request.mjs`](../../scripts/server-peer-request.mjs), [`scripts/server-profile-store.mjs`](../../scripts/server-profile-store.mjs), [`scripts/server-provisioning-ssh.mjs`](../../scripts/server-provisioning-ssh.mjs), [`scripts/server-provisioning.mjs`](../../scripts/server-provisioning.mjs).

Библиотеки/Node: `node:module`, `ssh2`.

### scripts/server-provisioning-ssh.d.mts

[`scripts/server-provisioning-ssh.d.mts`](../../scripts/server-provisioning-ssh.d.mts)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `SshEndpoint`, `SshAuthentication`, `SSH_PRIVATE_KEY_MAX_BYTES`, `validateSshAuthentication`, `clearSshCredentials`, `SshTools`, `makeSshTools`.

### scripts/server-provisioning-ssh.mjs

[`scripts/server-provisioning-ssh.mjs`](../../scripts/server-provisioning-ssh.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `SSH_PRIVATE_KEY_MAX_BYTES`, `validateSshAuthentication`, `clearSshCredentials`, `makeSshTools`.

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/app/api/server-provisioning/route.ts`](../../apps/web/app/api/server-provisioning/route.ts), [`apps/web/lib/server-provisioning-ssh.ts`](../../apps/web/lib/server-provisioning-ssh.ts), [`apps/web/tests/server-provisioning.cjs`](../../apps/web/tests/server-provisioning.cjs), [`scripts/server-provisioning-operator.mjs`](../../scripts/server-provisioning-operator.mjs), [`scripts/server-provisioning.mjs`](../../scripts/server-provisioning.mjs).

### scripts/server-provisioning.d.mts

[`scripts/server-provisioning.d.mts`](../../scripts/server-provisioning.d.mts)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `ProvisioningInput`, `UpdateInput`, `ServerUpdateAuthorization`, `ServerUpdateResult`, `ProvisioningJob`, `ProvisioningOptions`, `makeProvisioning`.

### scripts/server-provisioning.mjs

[`scripts/server-provisioning.mjs`](../../scripts/server-provisioning.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `makeProvisioning`.

Читает/импортирует: [`scripts/server-profile-store.mjs`](../../scripts/server-profile-store.mjs), [`scripts/server-provisioning-ssh.mjs`](../../scripts/server-provisioning-ssh.mjs).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Используют: [`apps/web/lib/server-provisioning.ts`](../../apps/web/lib/server-provisioning.ts), [`apps/web/tests/server-provisioning.cjs`](../../apps/web/tests/server-provisioning.cjs), [`scripts/server-provisioning-operator.mjs`](../../scripts/server-provisioning-operator.mjs), [`scripts/tests/server-provisioning-release.test.mjs`](../../scripts/tests/server-provisioning-release.test.mjs), [`scripts/tests/server-provisioning-update.test.mjs`](../../scripts/tests/server-provisioning-update.test.mjs).

Переменные окружения (только имена): `ROOM_CREATION_PASSWORD`, `ROOM_CREATION_PASSWORD_SHA256`.

### scripts/server-ssh-authorize-key.py

[`scripts/server-ssh-authorize-key.py`](../../scripts/server-ssh-authorize-key.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/setup-database-schema.mjs

[`scripts/setup-database-schema.mjs`](../../scripts/setup-database-schema.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `assertNoExecutionHooks`, `schemaHash`.

Библиотеки/Node: `node:crypto`.

Используют: [`apps/web/tests/media-room-revision-postgres.cjs`](../../apps/web/tests/media-room-revision-postgres.cjs), [`scripts/setup-database-v1.mjs`](../../scripts/setup-database-v1.mjs), [`scripts/setup-owner-v1.mjs`](../../scripts/setup-owner-v1.mjs).

### scripts/setup-database-v1.mjs

[`scripts/setup-database-v1.mjs`](../../scripts/setup-database-v1.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `contentHash`, `tables`, `scripts`, `schema`, `seedTopology`.

Читает/импортирует: [`scripts/control-plane-seed-transaction.mjs`](../../scripts/control-plane-seed-transaction.mjs), [`scripts/setup-database-schema.mjs`](../../scripts/setup-database-schema.mjs).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:module`, `node:path`, `node:url`, `pg`.

Используют: [`scripts/runtime-startup-observe-v1.mjs`](../../scripts/runtime-startup-observe-v1.mjs), [`scripts/setup-observe-v1.mjs`](../../scripts/setup-observe-v1.mjs), [`scripts/setup-owner-v1.mjs`](../../scripts/setup-owner-v1.mjs).

### scripts/setup-observe-v1.mjs

[`scripts/setup-observe-v1.mjs`](../../scripts/setup-observe-v1.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `observeServer`, `observerMain`.

Читает/импортирует: [`scripts/setup-database-v1.mjs`](../../scripts/setup-database-v1.mjs), [`scripts/setup-observer-internal-v1.mjs`](../../scripts/setup-observer-internal-v1.mjs).

Библиотеки/Node: `node:fs/promises`, `node:module`, `node:path`, `node:url`, `node:util`, `pg`.

Используют: [`apps/cli/tests/setup-verification.test.mjs`](../../apps/cli/tests/setup-verification.test.mjs).

### scripts/setup-observer-internal-v1.mjs

[`scripts/setup-observer-internal-v1.mjs`](../../scripts/setup-observer-internal-v1.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `fail`, `keys`, `uuid`, `hash`, `validate`, `directory`, `readPrivate`, `observeSetupFile`, `ledger`, `completedTopology`.

Библиотеки/Node: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`, `node:util`.

Используют: [`scripts/runtime-startup-observe-v1.mjs`](../../scripts/runtime-startup-observe-v1.mjs), [`scripts/setup-observe-v1.mjs`](../../scripts/setup-observe-v1.mjs).

### scripts/setup-owner-protected.mjs

[`scripts/setup-owner-protected.mjs`](../../scripts/setup-owner-protected.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `OwnerRefusal`, `refuse`, `exists`, `syncDirectory`, `ownerFile`, `readInvite`, `writeInvite`.

Библиотеки/Node: `node:fs`, `node:fs/promises`, `node:path`.

Используют: [`scripts/setup-owner-v1.mjs`](../../scripts/setup-owner-v1.mjs).

### scripts/setup-owner-v1.mjs

[`scripts/setup-owner-v1.mjs`](../../scripts/setup-owner-v1.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `validateRequest`, `prepareOwner`, `installerMain`.

Читает/импортирует: [`scripts/setup-database-schema.mjs`](../../scripts/setup-database-schema.mjs), [`scripts/setup-database-v1.mjs`](../../scripts/setup-database-v1.mjs), [`scripts/setup-owner-protected.mjs`](../../scripts/setup-owner-protected.mjs).

Библиотеки/Node: `node:crypto`, `node:module`, `node:url`, `node:util`, `pg`.

Используют: [`scripts/super-admin-owner.mjs`](../../scripts/super-admin-owner.mjs).

### scripts/simple-easy-setup-cleanup.ps1

[`scripts/simple-easy-setup-cleanup.ps1`](../../scripts/simple-easy-setup-cleanup.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-control.ico

[`scripts/simple-easy-setup-control.ico`](../../scripts/simple-easy-setup-control.ico)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-control.ps1

[`scripts/simple-easy-setup-control.ps1`](../../scripts/simple-easy-setup-control.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-deploy.ps1

[`scripts/simple-easy-setup-deploy.ps1`](../../scripts/simple-easy-setup-deploy.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Переменные окружения (только имена): `CASTLINK_SETUP_TOKEN`.

### scripts/simple-easy-setup-download.ps1

[`scripts/simple-easy-setup-download.ps1`](../../scripts/simple-easy-setup-download.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-gui.ps1

[`scripts/simple-easy-setup-gui.ps1`](../../scripts/simple-easy-setup-gui.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-language.ps1

[`scripts/simple-easy-setup-language.ps1`](../../scripts/simple-easy-setup-language.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-network.ps1

[`scripts/simple-easy-setup-network.ps1`](../../scripts/simple-easy-setup-network.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-release.json

[`scripts/simple-easy-setup-release.json`](../../scripts/simple-easy-setup-release.json)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-reserves.ps1

[`scripts/simple-easy-setup-reserves.ps1`](../../scripts/simple-easy-setup-reserves.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-runtime.ps1

[`scripts/simple-easy-setup-runtime.ps1`](../../scripts/simple-easy-setup-runtime.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-ssh.ps1

[`scripts/simple-easy-setup-ssh.ps1`](../../scripts/simple-easy-setup-ssh.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-trust.ps1

[`scripts/simple-easy-setup-trust.ps1`](../../scripts/simple-easy-setup-trust.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/simple-easy-setup-window.xaml

[`scripts/simple-easy-setup-window.xaml`](../../scripts/simple-easy-setup-window.xaml)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/storage-backup.mjs

[`scripts/storage-backup.mjs`](../../scripts/storage-backup.mjs)

Backup постоянных файлов и manifest с привязкой к installation identity.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### scripts/storage-restore.mjs

[`scripts/storage-restore.mjs`](../../scripts/storage-restore.mjs)

Контролируемое восстановление файлов постоянных данных; отдельно от image rollback.

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:path`.

Переменные окружения (только имена): `STUDIOLINK_DATA_DIR`.

### scripts/studio2/build_private_image.py

[`scripts/studio2/build_private_image.py`](../../scripts/studio2/build_private_image.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/contract.py

[`scripts/studio2/contract.py`](../../scripts/studio2/contract.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/prepare_private.py

[`scripts/studio2/prepare_private.py`](../../scripts/studio2/prepare_private.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/private_remote.py

[`scripts/studio2/private_remote.py`](../../scripts/studio2/private_remote.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/refresh_client_download.py

[`scripts/studio2/refresh_client_download.py`](../../scripts/studio2/refresh_client_download.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/refresh_entry_redirect.py

[`scripts/studio2/refresh_entry_redirect.py`](../../scripts/studio2/refresh_entry_redirect.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/refresh_helper_origin.py

[`scripts/studio2/refresh_helper_origin.py`](../../scripts/studio2/refresh_helper_origin.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/refresh_model.py

[`scripts/studio2/refresh_model.py`](../../scripts/studio2/refresh_model.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/refresh_proxy_capability.py

[`scripts/studio2/refresh_proxy_capability.py`](../../scripts/studio2/refresh_proxy_capability.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/refresh_runtime_pin.py

[`scripts/studio2/refresh_runtime_pin.py`](../../scripts/studio2/refresh_runtime_pin.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/remote_client_download.py

[`scripts/studio2/remote_client_download.py`](../../scripts/studio2/remote_client_download.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/remote_helper_origin.py

[`scripts/studio2/remote_helper_origin.py`](../../scripts/studio2/remote_helper_origin.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/remote_stack.py

[`scripts/studio2/remote_stack.py`](../../scripts/studio2/remote_stack.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### scripts/studio2/test_contract.py

[`scripts/studio2/test_contract.py`](../../scripts/studio2/test_contract.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/test_entry.py

[`scripts/studio2/test_entry.py`](../../scripts/studio2/test_entry.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/test_resume.py

[`scripts/studio2/test_resume.py`](../../scripts/studio2/test_resume.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/studio2/test_roster.py

[`scripts/studio2/test_roster.py`](../../scripts/studio2/test_roster.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Переменные окружения (только имена): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_SERVER_URL`.

### scripts/super-admin-owner.mjs

[`scripts/super-admin-owner.mjs`](../../scripts/super-admin-owner.mjs)

Первая/восстановительная ссылка владельца сервиса. Меняет PG access; пишет bearer только в приватный новый файл.

Читает/импортирует: [`scripts/setup-owner-v1.mjs`](../../scripts/setup-owner-v1.mjs).

Библиотеки/Node: `node:crypto`, `node:fs/promises`, `node:module`, `node:path`, `node:util`, `pg`.

Переменные окружения (только имена): `CASTLINK_CONTROL_PLANE_DATABASE_URL`, `DATABASE_URL`.

### scripts/support-bundle.mjs

[`scripts/support-bundle.mjs`](../../scripts/support-bundle.mjs)

Ограниченный диагностический JSON и TCP/TLS-пробы без полного env/dump.

Библиотеки/Node: `node:fs/promises`, `node:net`, `node:os`, `node:path`, `node:process`, `node:tls`.

Переменные окружения (только имена): `CASTLINK_STORAGE_BACKEND`, `CASTLINK_SUPPORT_TIMEOUT_MS`, `CASTLINK_TURN_HEALTH_HOST`, `CASTLINK_TURN_TLS_PORT`, `LIVEKIT_SERVER_URL`, `STUDIOLINK_STATS_MAX_BYTES`.

### scripts/test-cli-ci.mjs

[`scripts/test-cli-ci.mjs`](../../scripts/test-cli-ci.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `legacyFiles`, `admissionDiagnostic`, `runningNodeSha256`, `stageRunningNode`, `requireActorIdentity`, `partitionCliTests`, `identityCommand`, `actorEnvironment`, `suiteResult`, `admitExecutable`, `checkCliClosure`, `stageActorClosure`, `validateCiMode`.

Библиотеки/Node: `);
    for(const spec of actorCodeImports(text)){if(spec.startsWith(`, `);
  }
  at++;
 }
 return result;
}
// Fixed public code only: never copy node_modules, configuration, environment or data.
export function stageActorClosure(repository=root,parent=os.tmpdir()){
 checkCliClosure(repository);canonical(parent);const uid=process.getuid(),ps=fs.lstatSync(parent),sticky=ps.uid===0&&(ps.mode&0o1000)!==0;
 if(!ps.isDirectory()||ps.uid!==uid&&!sticky||(ps.mode&0o022)!==0&&!sticky)fail();
 const files=[`, `);at=end+2;continue;}
  if([`, `);const target=path.posix.normalize(path.posix.join(path.posix.dirname(relative),spec));if(!files.includes(target))fail(`, `);}
   }
   const target=path.join(directory,relative);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o755});for(let p=path.dirname(target);p!==directory;p=path.dirname(p))fs.chmodSync(p,0o755);fs.writeFileSync(target,data,{flag:`, `,`, `,at)&&!/[\w$]/.test(text[at-1]??`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:url`.

Используют: [`scripts/tests/test-cli-ci.test.mjs`](../../scripts/tests/test-cli-ci.test.mjs).

Переменные окружения (только имена): `CASTLINK_CI_FIXED_ACTOR`, `CASTLINK_CI_NODE_UID`.

### scripts/tests/brand-icons.test.mjs

[`scripts/tests/brand-icons.test.mjs`](../../scripts/tests/brand-icons.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:test`.

### scripts/tests/caster-layout.browser.py

[`scripts/tests/caster-layout.browser.py`](../../scripts/tests/caster-layout.browser.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/ci-package-cli.test.mjs

[`scripts/tests/ci-package-cli.test.mjs`](../../scripts/tests/ci-package-cli.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/package-cli.mjs`](../../scripts/package-cli.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/collect-runtime-licenses.test.mjs

[`scripts/tests/collect-runtime-licenses.test.mjs`](../../scripts/tests/collect-runtime-licenses.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/collect-runtime-licenses.mjs`](../../scripts/collect-runtime-licenses.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### scripts/tests/docker-desktop-macos-provenance.test.mjs

[`scripts/tests/docker-desktop-macos-provenance.test.mjs`](../../scripts/tests/docker-desktop-macos-provenance.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/docker-desktop-macos-provenance.mjs`](../../scripts/docker-desktop-macos-provenance.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### scripts/tests/fixtures/primary-launcher/composition-launch-proof.c

[`scripts/tests/fixtures/primary-launcher/composition-launch-proof.c`](../../scripts/tests/fixtures/primary-launcher/composition-launch-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/config-write-proof.c

[`scripts/tests/fixtures/primary-launcher/config-write-proof.c`](../../scripts/tests/fixtures/primary-launcher/config-write-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/core-proof.c

[`scripts/tests/fixtures/primary-launcher/core-proof.c`](../../scripts/tests/fixtures/primary-launcher/core-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/docker-guard-proof.c

[`scripts/tests/fixtures/primary-launcher/docker-guard-proof.c`](../../scripts/tests/fixtures/primary-launcher/docker-guard-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/docker-proof.c

[`scripts/tests/fixtures/primary-launcher/docker-proof.c`](../../scripts/tests/fixtures/primary-launcher/docker-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/json-proof.c

[`scripts/tests/fixtures/primary-launcher/json-proof.c`](../../scripts/tests/fixtures/primary-launcher/json-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/preflight-dispatch-proof.c

[`scripts/tests/fixtures/primary-launcher/preflight-dispatch-proof.c`](../../scripts/tests/fixtures/primary-launcher/preflight-dispatch-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/preflight-environment-proof.c

[`scripts/tests/fixtures/primary-launcher/preflight-environment-proof.c`](../../scripts/tests/fixtures/primary-launcher/preflight-environment-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/preflight-protocol-proof.c

[`scripts/tests/fixtures/primary-launcher/preflight-protocol-proof.c`](../../scripts/tests/fixtures/primary-launcher/preflight-protocol-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/preflight-result-proof.c

[`scripts/tests/fixtures/primary-launcher/preflight-result-proof.c`](../../scripts/tests/fixtures/primary-launcher/preflight-result-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/protocol-proof.c

[`scripts/tests/fixtures/primary-launcher/protocol-proof.c`](../../scripts/tests/fixtures/primary-launcher/protocol-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/root-catalog-proof.c

[`scripts/tests/fixtures/primary-launcher/root-catalog-proof.c`](../../scripts/tests/fixtures/primary-launcher/root-catalog-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/fixtures/primary-launcher/sync-result-proof.c

[`scripts/tests/fixtures/primary-launcher/sync-result-proof.c`](../../scripts/tests/fixtures/primary-launcher/sync-result-proof.c)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/image-ownership-build.test.mjs

[`scripts/tests/image-ownership-build.test.mjs`](../../scripts/tests/image-ownership-build.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:url`.

### scripts/tests/install-cli.test.mjs

[`scripts/tests/install-cli.test.mjs`](../../scripts/tests/install-cli.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

### scripts/tests/install-ubuntu.test.mjs

[`scripts/tests/install-ubuntu.test.mjs`](../../scripts/tests/install-ubuntu.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `PATH`.

### scripts/tests/landing-release-display.test.mjs

[`scripts/tests/landing-release-display.test.mjs`](../../scripts/tests/landing-release-display.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`sites/castlink-general/download-releases.js`](../../sites/castlink-general/download-releases.js).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:module`, `node:test`, `node:vm`.

### scripts/tests/linux-compose-setup.test.py

[`scripts/tests/linux-compose-setup.test.py`](../../scripts/tests/linux-compose-setup.test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/linux-manual-docs.test.py

[`scripts/tests/linux-manual-docs.test.py`](../../scripts/tests/linux-manual-docs.test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/linux-parent-images.test.py

[`scripts/tests/linux-parent-images.test.py`](../../scripts/tests/linux-parent-images.test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/linux-updates.test.py

[`scripts/tests/linux-updates.test.py`](../../scripts/tests/linux-updates.test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/offline-component-provenance.test.mjs

[`scripts/tests/offline-component-provenance.test.mjs`](../../scripts/tests/offline-component-provenance.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/package-server-offline.mjs`](../../scripts/package-server-offline.mjs), [`scripts/producer-server-offline.mjs`](../../scripts/producer-server-offline.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### scripts/tests/package-cli.test.mjs

[`scripts/tests/package-cli.test.mjs`](../../scripts/tests/package-cli.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `value`.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `NODE_OPTIONS`, `NODE_PATH`.

### scripts/tests/package-easy-setup.test.mjs

[`scripts/tests/package-easy-setup.test.mjs`](../../scripts/tests/package-easy-setup.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/package-easy-setup.mjs`](../../scripts/package-easy-setup.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### scripts/tests/package-server-offline.test.mjs

[`scripts/tests/package-server-offline.test.mjs`](../../scripts/tests/package-server-offline.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`, `node:zlib`.

### scripts/tests/package-simple-easy-setup.test.mjs

[`scripts/tests/package-simple-easy-setup.test.mjs`](../../scripts/tests/package-simple-easy-setup.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/package-simple-easy-setup.mjs`](../../scripts/package-simple-easy-setup.mjs), [`scripts/release-track.cjs`](../../scripts/release-track.cjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_PYTHON`.

### scripts/tests/prepare-web-runtime.test.mjs

[`scripts/tests/prepare-web-runtime.test.mjs`](../../scripts/tests/prepare-web-runtime.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`apps/web/scripts/prepare-pdf-assets.mjs`](../../apps/web/scripts/prepare-pdf-assets.mjs), [`scripts/prepare-web-runtime.mjs`](../../scripts/prepare-web-runtime.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_RUNTIME_QA_PUBLIC`.

### scripts/tests/presentation-converter-compose.test.py

[`scripts/tests/presentation-converter-compose.test.py`](../../scripts/tests/presentation-converter-compose.test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/presentation-helper.fixtures.ps1

[`scripts/tests/presentation-helper.fixtures.ps1`](../../scripts/tests/presentation-helper.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/presentation-upload-http.smoke.cjs

[`scripts/tests/presentation-upload-http.smoke.cjs`](../../scripts/tests/presentation-upload-http.smoke.cjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `node:stream`.

Переменные окружения (только имена): `BACKEND_PPTX_PROOF_PRELOAD`, `CASTLINK_ISOLATED_UPLOAD_PROOF`, `CASTLINK_PROOF_EXPECTED_PAGES`.

### scripts/tests/presentation-upload-runtime.test.cjs

[`scripts/tests/presentation-upload-runtime.test.cjs`](../../scripts/tests/presentation-upload-runtime.test.cjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/presentation-upload-runtime.cjs`](../../scripts/presentation-upload-runtime.cjs).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:http`, `node:test`.

### scripts/tests/primary-launcher-config-write.test.mjs

[`scripts/tests/primary-launcher-config-write.test.mjs`](../../scripts/tests/primary-launcher-config-write.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/primary-launcher-core.test.mjs

[`scripts/tests/primary-launcher-core.test.mjs`](../../scripts/tests/primary-launcher-core.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/primary-launcher-json.test.mjs

[`scripts/tests/primary-launcher-json.test.mjs`](../../scripts/tests/primary-launcher-json.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/primary-launcher-protocol.test.mjs

[`scripts/tests/primary-launcher-protocol.test.mjs`](../../scripts/tests/primary-launcher-protocol.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/primary-launcher-root-catalog.test.mjs

[`scripts/tests/primary-launcher-root-catalog.test.mjs`](../../scripts/tests/primary-launcher-root-catalog.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `CASTLINK_PROTOCOL_TEST_SOURCE`.

### scripts/tests/producer-server-offline.test.mjs

[`scripts/tests/producer-server-offline.test.mjs`](../../scripts/tests/producer-server-offline.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/package-server-offline.mjs`](../../scripts/package-server-offline.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:fs/promises`, `node:module`, `node:os`, `node:path`, `node:test`.

### scripts/tests/production-image-retention.test.mjs

[`scripts/tests/production-image-retention.test.mjs`](../../scripts/tests/production-image-retention.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/production-image-retention.mjs`](../../scripts/production-image-retention.mjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### scripts/tests/production-update.test.py

[`scripts/tests/production-update.test.py`](../../scripts/tests/production-update.test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/release-artifact-audit.test.mjs

[`scripts/tests/release-artifact-audit.test.mjs`](../../scripts/tests/release-artifact-audit.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_PYTHON`.

### scripts/tests/release-tracks.test.cjs

[`scripts/tests/release-tracks.test.cjs`](../../scripts/tests/release-tracks.test.cjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/publish-release-track.cjs`](../../scripts/publish-release-track.cjs), [`scripts/release-track.cjs`](../../scripts/release-track.cjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `CASTLINK_PRODUCT_BUILD_NUMBER`, `CASTLINK_PRODUCT_VERSION`, `STUDIOLINK_RELEASE`.

### scripts/tests/server-peer-request.test.mjs

[`scripts/tests/server-peer-request.test.mjs`](../../scripts/tests/server-peer-request.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/server-peer-request.mjs`](../../scripts/server-peer-request.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:https`, `node:os`, `node:path`, `node:test`, `node:util`.

### scripts/tests/server-profile-store.test.mjs

[`scripts/tests/server-profile-store.test.mjs`](../../scripts/tests/server-profile-store.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/server-profile-store.mjs`](../../scripts/server-profile-store.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### scripts/tests/server-provision-vps-archive.test.mjs

[`scripts/tests/server-provision-vps-archive.test.mjs`](../../scripts/tests/server-provision-vps-archive.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:path`, `node:test`.

Переменные окружения (только имена): `CASTLINK_PYTHON`.

### scripts/tests/server-provision-vps-database.test.mjs

[`scripts/tests/server-provision-vps-database.test.mjs`](../../scripts/tests/server-provision-vps-database.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_PYTHON`, `FIXTURE_POOL_MARKER`.

### scripts/tests/server-provision-vps-resume.test.mjs

[`scripts/tests/server-provision-vps-resume.test.mjs`](../../scripts/tests/server-provision-vps-resume.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:url`, `node:util`.

Переменные окружения (только имена): `CASTLINK_PYTHON`.

### scripts/tests/server-provision-vps-update.test.mjs

[`scripts/tests/server-provision-vps-update.test.mjs`](../../scripts/tests/server-provision-vps-update.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:path`, `node:test`, `node:util`.

Переменные окружения (только имена): `CASTLINK_PYTHON`.

### scripts/tests/server-provision-vps.test.mjs

[`scripts/tests/server-provision-vps.test.mjs`](../../scripts/tests/server-provision-vps.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:path`, `node:test`, `node:url`, `node:util`.

Переменные окружения (только имена): `CASTLINK_PYTHON`.

### scripts/tests/server-provisioning-release.test.mjs

[`scripts/tests/server-provisioning-release.test.mjs`](../../scripts/tests/server-provisioning-release.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/server-provisioning.mjs`](../../scripts/server-provisioning.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:test`.

Переменные окружения (только имена): `ROOM_CREATION_PASSWORD`, `ROOM_CREATION_PASSWORD_SHA256`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_TRANSFER_ORIGIN`.

### scripts/tests/server-provisioning-update.test.mjs

[`scripts/tests/server-provisioning-update.test.mjs`](../../scripts/tests/server-provisioning-update.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/server-provisioning.mjs`](../../scripts/server-provisioning.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:test`.

Переменные окружения (только имена): `ROOM_CREATION_PASSWORD_SHA256`, `STUDIOLINK_INSTALLATION_ID`, `STUDIOLINK_TRANSFER_ORIGIN`.

### scripts/tests/server-ssh-authorize-key.test.py

[`scripts/tests/server-ssh-authorize-key.test.py`](../../scripts/tests/server-ssh-authorize-key.test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-address.fixtures.ps1

[`scripts/tests/simple-easy-setup-address.fixtures.ps1`](../../scripts/tests/simple-easy-setup-address.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-approved-ui.fixtures.ps1

[`scripts/tests/simple-easy-setup-approved-ui.fixtures.ps1`](../../scripts/tests/simple-easy-setup-approved-ui.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-bootstrap.fixtures.ps1

[`scripts/tests/simple-easy-setup-bootstrap.fixtures.ps1`](../../scripts/tests/simple-easy-setup-bootstrap.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-cleanup.fixtures.ps1

[`scripts/tests/simple-easy-setup-cleanup.fixtures.ps1`](../../scripts/tests/simple-easy-setup-cleanup.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-control.fixtures.ps1

[`scripts/tests/simple-easy-setup-control.fixtures.ps1`](../../scripts/tests/simple-easy-setup-control.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-deploy.fixtures.ps1

[`scripts/tests/simple-easy-setup-deploy.fixtures.ps1`](../../scripts/tests/simple-easy-setup-deploy.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-domain.fixtures.ps1

[`scripts/tests/simple-easy-setup-domain.fixtures.ps1`](../../scripts/tests/simple-easy-setup-domain.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-download.fixtures.ps1

[`scripts/tests/simple-easy-setup-download.fixtures.ps1`](../../scripts/tests/simple-easy-setup-download.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-graphite.fixtures.ps1

[`scripts/tests/simple-easy-setup-graphite.fixtures.ps1`](../../scripts/tests/simple-easy-setup-graphite.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-gui-captures.fixtures.ps1

[`scripts/tests/simple-easy-setup-gui-captures.fixtures.ps1`](../../scripts/tests/simple-easy-setup-gui-captures.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-gui-finish.fixtures.ps1

[`scripts/tests/simple-easy-setup-gui-finish.fixtures.ps1`](../../scripts/tests/simple-easy-setup-gui-finish.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-gui-native.fixtures.ps1

[`scripts/tests/simple-easy-setup-gui-native.fixtures.ps1`](../../scripts/tests/simple-easy-setup-gui-native.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-gui.fixtures.ps1

[`scripts/tests/simple-easy-setup-gui.fixtures.ps1`](../../scripts/tests/simple-easy-setup-gui.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-handoff.fixtures.ps1

[`scripts/tests/simple-easy-setup-handoff.fixtures.ps1`](../../scripts/tests/simple-easy-setup-handoff.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-language.fixtures.ps1

[`scripts/tests/simple-easy-setup-language.fixtures.ps1`](../../scripts/tests/simple-easy-setup-language.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-network.fixtures.ps1

[`scripts/tests/simple-easy-setup-network.fixtures.ps1`](../../scripts/tests/simple-easy-setup-network.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-options.fixtures.ps1

[`scripts/tests/simple-easy-setup-options.fixtures.ps1`](../../scripts/tests/simple-easy-setup-options.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-parent-images.fixtures.ps1

[`scripts/tests/simple-easy-setup-parent-images.fixtures.ps1`](../../scripts/tests/simple-easy-setup-parent-images.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-ports.fixtures.ps1

[`scripts/tests/simple-easy-setup-ports.fixtures.ps1`](../../scripts/tests/simple-easy-setup-ports.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-reinstall.fixtures.ps1

[`scripts/tests/simple-easy-setup-reinstall.fixtures.ps1`](../../scripts/tests/simple-easy-setup-reinstall.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-release.fixtures.ps1

[`scripts/tests/simple-easy-setup-release.fixtures.ps1`](../../scripts/tests/simple-easy-setup-release.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-remote-remove.cloud.ps1

[`scripts/tests/simple-easy-setup-remote-remove.cloud.ps1`](../../scripts/tests/simple-easy-setup-remote-remove.cloud.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-remote-remove.fixtures.ps1

[`scripts/tests/simple-easy-setup-remote-remove.fixtures.ps1`](../../scripts/tests/simple-easy-setup-remote-remove.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-remove.cloud.ps1

[`scripts/tests/simple-easy-setup-remove.cloud.ps1`](../../scripts/tests/simple-easy-setup-remove.cloud.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-remove.fixtures.ps1

[`scripts/tests/simple-easy-setup-remove.fixtures.ps1`](../../scripts/tests/simple-easy-setup-remove.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-reserves.fixtures.ps1

[`scripts/tests/simple-easy-setup-reserves.fixtures.ps1`](../../scripts/tests/simple-easy-setup-reserves.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-resume.fixtures.ps1

[`scripts/tests/simple-easy-setup-resume.fixtures.ps1`](../../scripts/tests/simple-easy-setup-resume.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-retention.fixtures.ps1

[`scripts/tests/simple-easy-setup-retention.fixtures.ps1`](../../scripts/tests/simple-easy-setup-retention.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-runtime-scope.fixtures.ps1

[`scripts/tests/simple-easy-setup-runtime-scope.fixtures.ps1`](../../scripts/tests/simple-easy-setup-runtime-scope.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-ssh-auth.fixtures.ps1

[`scripts/tests/simple-easy-setup-ssh-auth.fixtures.ps1`](../../scripts/tests/simple-easy-setup-ssh-auth.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-ssh.fixtures.ps1

[`scripts/tests/simple-easy-setup-ssh.fixtures.ps1`](../../scripts/tests/simple-easy-setup-ssh.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-ssh.test.mjs

[`scripts/tests/simple-easy-setup-ssh.test.mjs`](../../scripts/tests/simple-easy-setup-ssh.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `S`.

### scripts/tests/simple-easy-setup-target.fixtures.ps1

[`scripts/tests/simple-easy-setup-target.fixtures.ps1`](../../scripts/tests/simple-easy-setup-target.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-trust.fixtures.ps1

[`scripts/tests/simple-easy-setup-trust.fixtures.ps1`](../../scripts/tests/simple-easy-setup-trust.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-turn-domain.fixtures.ps1

[`scripts/tests/simple-easy-setup-turn-domain.fixtures.ps1`](../../scripts/tests/simple-easy-setup-turn-domain.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/simple-easy-setup-turn.fixtures.ps1

[`scripts/tests/simple-easy-setup-turn.fixtures.ps1`](../../scripts/tests/simple-easy-setup-turn.fixtures.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/sql-checkout.test.mjs

[`scripts/tests/sql-checkout.test.mjs`](../../scripts/tests/sql-checkout.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### scripts/tests/test-cli-ci.test.mjs

[`scripts/tests/test-cli-ci.test.mjs`](../../scripts/tests/test-cli-ci.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `fixed`.

Читает/импортирует: [`scripts/test-cli-ci.mjs`](../../scripts/test-cli-ci.mjs).

Библиотеки/Node: `/app/scripts/runtime-startup-observe-v1.mjs`, `foreign-package`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:path`, `node:test`, `node:url`.

### scripts/tests/third-party-sources.test.py

[`scripts/tests/third-party-sources.test.py`](../../scripts/tests/third-party-sources.test.py)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/tests/turn-tls-helper.test.mjs

[`scripts/tests/turn-tls-helper.test.mjs`](../../scripts/tests/turn-tls-helper.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:test`.

### scripts/tests/turn-tls-image.smoke.mjs

[`scripts/tests/turn-tls-image.smoke.mjs`](../../scripts/tests/turn-tls-image.smoke.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/package-simple-easy-setup.mjs`](../../scripts/package-simple-easy-setup.mjs).

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:tls`.

### scripts/tests/ubuntu-easy-setup-bootstrap.test.mjs

[`scripts/tests/ubuntu-easy-setup-bootstrap.test.mjs`](../../scripts/tests/ubuntu-easy-setup-bootstrap.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:test`, `node:url`.

### scripts/tests/web-runtime-image.smoke.mjs

[`scripts/tests/web-runtime-image.smoke.mjs`](../../scripts/tests/web-runtime-image.smoke.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/prepare-web-runtime.mjs`](../../scripts/prepare-web-runtime.mjs).

Библиотеки/Node: `/app/scripts/setup-database-v1.mjs`, `node:assert/strict`, `node:child_process`, `node:crypto`, `node:fs`, `node:http`, `node:module`, `node:path`.

### scripts/tests/windows-doctor-stage.test.mjs

[`scripts/tests/windows-doctor-stage.test.mjs`](../../scripts/tests/windows-doctor-stage.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/windows-primary-acl.test.mjs

[`scripts/tests/windows-primary-acl.test.mjs`](../../scripts/tests/windows-primary-acl.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### scripts/tests/windows-primary-bootstrap-diagnostic.test.mjs

[`scripts/tests/windows-primary-bootstrap-diagnostic.test.mjs`](../../scripts/tests/windows-primary-bootstrap-diagnostic.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:test`, `node:vm`.

### scripts/tests/windows-primary-bootstrap.test.mjs

[`scripts/tests/windows-primary-bootstrap.test.mjs`](../../scripts/tests/windows-primary-bootstrap.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `,async()=>{const r=await run(false,[`, `node:assert/strict`, `node:fs`, `node:process`, `node:test`, `node:vm`.

### scripts/tests/windows-primary-build-diagnostics.test.mjs

[`scripts/tests/windows-primary-build-diagnostics.test.mjs`](../../scripts/tests/windows-primary-build-diagnostics.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/windows-primary-build-diagnostics.mjs`](../../scripts/windows-primary-build-diagnostics.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### scripts/tests/windows-primary-compose-environment.test.mjs

[`scripts/tests/windows-primary-compose-environment.test.mjs`](../../scripts/tests/windows-primary-compose-environment.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### scripts/tests/windows-primary-composition.test.mjs

[`scripts/tests/windows-primary-composition.test.mjs`](../../scripts/tests/windows-primary-composition.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/windows-primary-context-guard.test.mjs

[`scripts/tests/windows-primary-context-guard.test.mjs`](../../scripts/tests/windows-primary-context-guard.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/windows-primary-directory-stability.mjs

[`scripts/tests/windows-primary-directory-stability.mjs`](../../scripts/tests/windows-primary-directory-stability.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`.

### scripts/tests/windows-primary-docker-config.test.mjs

[`scripts/tests/windows-primary-docker-config.test.mjs`](../../scripts/tests/windows-primary-docker-config.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/windows-primary-docker-config.mjs`](../../scripts/windows-primary-docker-config.mjs), [`scripts/windows-primary-inventory.mjs`](../../scripts/windows-primary-inventory.mjs).

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`.

### scripts/tests/windows-primary-docker-guard.test.mjs

[`scripts/tests/windows-primary-docker-guard.test.mjs`](../../scripts/tests/windows-primary-docker-guard.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `CASTLINK_PREFLIGHT_STACK_RECEIPT`.

### scripts/tests/windows-primary-docker.test.mjs

[`scripts/tests/windows-primary-docker.test.mjs`](../../scripts/tests/windows-primary-docker.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/windows-primary-inventory.test.mjs

[`scripts/tests/windows-primary-inventory.test.mjs`](../../scripts/tests/windows-primary-inventory.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/windows-primary-inventory.mjs`](../../scripts/windows-primary-inventory.mjs).

Библиотеки/Node: `node:assert/strict`, `node:test`.

### scripts/tests/windows-primary-node-guards.test.mjs

[`scripts/tests/windows-primary-node-guards.test.mjs`](../../scripts/tests/windows-primary-node-guards.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### scripts/tests/windows-primary-os-drive-acl.mjs

[`scripts/tests/windows-primary-os-drive-acl.mjs`](../../scripts/tests/windows-primary-os-drive-acl.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:url`.

### scripts/tests/windows-primary-os-file-inspect.mjs

[`scripts/tests/windows-primary-os-file-inspect.mjs`](../../scripts/tests/windows-primary-os-file-inspect.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`.

### scripts/tests/windows-primary-pe.test.mjs

[`scripts/tests/windows-primary-pe.test.mjs`](../../scripts/tests/windows-primary-pe.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/windows-primary-pe.mjs`](../../scripts/windows-primary-pe.mjs).

Библиотеки/Node: `,b=>b.writeUInt32LE(4096,152+112+13*8)],[`, `node:assert/strict`, `node:test`.

### scripts/tests/windows-primary-preflight.test.mjs

[`scripts/tests/windows-primary-preflight.test.mjs`](../../scripts/tests/windows-primary-preflight.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

Переменные окружения (только имена): `CASTLINK_PREFLIGHT_DISPATCH_STACK_RECEIPT`.

### scripts/tests/windows-primary-private-result.test.mjs

[`scripts/tests/windows-primary-private-result.test.mjs`](../../scripts/tests/windows-primary-private-result.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### scripts/tests/windows-primary-profile-root.test.mjs

[`scripts/tests/windows-primary-profile-root.test.mjs`](../../scripts/tests/windows-primary-profile-root.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/windows-primary-scratch-count.test.mjs

[`scripts/tests/windows-primary-scratch-count.test.mjs`](../../scripts/tests/windows-primary-scratch-count.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### scripts/tests/windows-primary-sync-result.test.mjs

[`scripts/tests/windows-primary-sync-result.test.mjs`](../../scripts/tests/windows-primary-sync-result.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### scripts/tests/windows-primary-target-helper-newlines.mjs

[`scripts/tests/windows-primary-target-helper-newlines.mjs`](../../scripts/tests/windows-primary-target-helper-newlines.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/tests/windows-primary-target-result.test.mjs

[`scripts/tests/windows-primary-target-result.test.mjs`](../../scripts/tests/windows-primary-target-result.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs`, `node:os`, `node:path`, `node:test`.

### scripts/turn-preflight.mjs

[`scripts/turn-preflight.mjs`](../../scripts/turn-preflight.mjs)

Предварительные проверки TURN-схемы.

Библиотеки/Node: `node:dns/promises`, `node:tls`.

### scripts/turn-stage2-deploy.sh

[`scripts/turn-stage2-deploy.sh`](../../scripts/turn-stage2-deploy.sh)

Установка TURN stage 2; может затронуть сетевой ingress и активные подключения.

### scripts/turn-stage2-preflight.mjs

[`scripts/turn-stage2-preflight.mjs`](../../scripts/turn-stage2-preflight.mjs)

Предварительная проверка TURN/TLS/SNI stage 2.

Библиотеки/Node: `node:dns/promises`, `node:https`, `node:tls`.

### scripts/ubuntu-easy-setup-bootstrap.sh

[`scripts/ubuntu-easy-setup-bootstrap.sh`](../../scripts/ubuntu-easy-setup-bootstrap.sh)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/windows-easy-setup.ps1

[`scripts/windows-easy-setup.ps1`](../../scripts/windows-easy-setup.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/windows-prepare-vps.ps1

[`scripts/windows-prepare-vps.ps1`](../../scripts/windows-prepare-vps.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

### scripts/windows-primary-build-diagnostics.mjs

[`scripts/windows-primary-build-diagnostics.mjs`](../../scripts/windows-primary-build-diagnostics.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `retainPrimaryCompileDiagnostics`.

Библиотеки/Node: `node:fs/promises`, `node:path`.

Используют: [`scripts/build-windows-primary.mjs`](../../scripts/build-windows-primary.mjs), [`scripts/tests/windows-primary-build-diagnostics.test.mjs`](../../scripts/tests/windows-primary-build-diagnostics.test.mjs).

### scripts/windows-primary-database-bootstrap.cjs

[`scripts/windows-primary-database-bootstrap.cjs`](../../scripts/windows-primary-database-bootstrap.cjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:child_process`, `node:crypto`, `node:fs`.

### scripts/windows-primary-docker-config.mjs

[`scripts/windows-primary-docker-config.mjs`](../../scripts/windows-primary-docker-config.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `stageFixedDockerConfig`.

Библиотеки/Node: `node:fs/promises`, `node:path`.

Используют: [`scripts/build-windows-primary.mjs`](../../scripts/build-windows-primary.mjs), [`scripts/tests/windows-primary-docker-config.test.mjs`](../../scripts/tests/windows-primary-docker-config.test.mjs).

### scripts/windows-primary-inventory.mjs

[`scripts/windows-primary-inventory.mjs`](../../scripts/windows-primary-inventory.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `renderPrimaryInventory`.

Используют: [`scripts/build-windows-primary.mjs`](../../scripts/build-windows-primary.mjs), [`scripts/package-easy-setup.mjs`](../../scripts/package-easy-setup.mjs), [`scripts/tests/windows-primary-docker-config.test.mjs`](../../scripts/tests/windows-primary-docker-config.test.mjs), [`scripts/tests/windows-primary-inventory.test.mjs`](../../scripts/tests/windows-primary-inventory.test.mjs).

### scripts/windows-primary-managed-kernel.test.mjs

[`scripts/windows-primary-managed-kernel.test.mjs`](../../scripts/windows-primary-managed-kernel.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Библиотеки/Node: `node:assert/strict`, `node:child_process`, `node:fs/promises`, `node:os`, `node:path`, `node:test`, `node:url`.

### scripts/windows-primary-managed.mjs

[`scripts/windows-primary-managed.mjs`](../../scripts/windows-primary-managed.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `extractManagedCatalog`, `renderOSWorkerPrefix`.

Используют: [`scripts/build-windows-primary.mjs`](../../scripts/build-windows-primary.mjs), [`scripts/windows-primary-managed.test.mjs`](../../scripts/windows-primary-managed.test.mjs).

### scripts/windows-primary-managed.test.mjs

[`scripts/windows-primary-managed.test.mjs`](../../scripts/windows-primary-managed.test.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Читает/импортирует: [`scripts/windows-primary-managed.mjs`](../../scripts/windows-primary-managed.mjs).

Библиотеки/Node: `node:assert/strict`, `node:fs/promises`, `node:test`.

### scripts/windows-primary-pe.mjs

[`scripts/windows-primary-pe.mjs`](../../scripts/windows-primary-pe.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `primaryImports`, `auditPrimaryPE`.

Используют: [`scripts/build-windows-primary.mjs`](../../scripts/build-windows-primary.mjs), [`scripts/tests/windows-primary-pe.test.mjs`](../../scripts/tests/windows-primary-pe.test.mjs).

### scripts/windows-primary-target-helper-inventory.mjs

[`scripts/windows-primary-target-helper-inventory.mjs`](../../scripts/windows-primary-target-helper-inventory.mjs)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

Экспортируемые символы: `renderTargetHelperSourceInventory`.

Библиотеки/Node: `node:crypto`, `node:fs/promises`.

Используют: [`apps/cli/tests/windows-target-native-catalog.test.mjs`](../../apps/cli/tests/windows-target-native-catalog.test.mjs), [`scripts/build-windows-primary.mjs`](../../scripts/build-windows-primary.mjs).

### scripts/windows-simple-easy-setup.ps1

[`scripts/windows-simple-easy-setup.ps1`](../../scripts/windows-simple-easy-setup.ps1)

Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.

## sites · 53 файлов

### sites/castlink-bot/.gitignore

[`sites/castlink-bot/.gitignore`](../../sites/castlink-bot/.gitignore)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/README.md

[`sites/castlink-bot/README.md`](../../sites/castlink-bot/README.md)

Telegram-бот токенов hosted CastLink

### sites/castlink-bot/account.Caddyfile.example

[`sites/castlink-bot/account.Caddyfile.example`](../../sites/castlink-bot/account.Caddyfile.example)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/account.env.example

[`sites/castlink-bot/account.env.example`](../../sites/castlink-bot/account.env.example)

Шаблон переменных окружения. Не реальная конфигурация/секреты установки; значения заполняют вне Git.

### sites/castlink-bot/account_server.py

[`sites/castlink-bot/account_server.py`](../../sites/castlink-bot/account_server.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/account_updates.py

[`sites/castlink-bot/account_updates.py`](../../sites/castlink-bot/account_updates.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/accounts.py

[`sites/castlink-bot/accounts.py`](../../sites/castlink-bot/accounts.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/accounts_schema.sql

[`sites/castlink-bot/accounts_schema.sql`](../../sites/castlink-bot/accounts_schema.sql)

SQL-структура/миграция: проверить таблицы, ключи и ограничения перед запуском. Может менять БД.

### sites/castlink-bot/bot.py

[`sites/castlink-bot/bot.py`](../../sites/castlink-bot/bot.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/castlink-account.service

[`sites/castlink-bot/castlink-account.service`](../../sites/castlink-bot/castlink-account.service)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/configure.py

[`sites/castlink-bot/configure.py`](../../sites/castlink-bot/configure.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/delivery.py

[`sites/castlink-bot/delivery.py`](../../sites/castlink-bot/delivery.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/home_bridge.py

[`sites/castlink-bot/home_bridge.py`](../../sites/castlink-bot/home_bridge.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/requirements.txt

[`sites/castlink-bot/requirements.txt`](../../sites/castlink-bot/requirements.txt)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/run-home-bot.ps1

[`sites/castlink-bot/run-home-bot.ps1`](../../sites/castlink-bot/run-home-bot.ps1)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/telegram_auth.py

[`sites/castlink-bot/telegram_auth.py`](../../sites/castlink-bot/telegram_auth.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/telegram_relay.py

[`sites/castlink-bot/telegram_relay.py`](../../sites/castlink-bot/telegram_relay.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_account_profile.py

[`sites/castlink-bot/test_account_profile.py`](../../sites/castlink-bot/test_account_profile.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_account_relay_integration.py

[`sites/castlink-bot/test_account_relay_integration.py`](../../sites/castlink-bot/test_account_relay_integration.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_account_server.py

[`sites/castlink-bot/test_account_server.py`](../../sites/castlink-bot/test_account_server.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_account_updates.py

[`sites/castlink-bot/test_account_updates.py`](../../sites/castlink-bot/test_account_updates.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_accounts.py

[`sites/castlink-bot/test_accounts.py`](../../sites/castlink-bot/test_accounts.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_bot.py

[`sites/castlink-bot/test_bot.py`](../../sites/castlink-bot/test_bot.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_configure.py

[`sites/castlink-bot/test_configure.py`](../../sites/castlink-bot/test_configure.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_delivery.py

[`sites/castlink-bot/test_delivery.py`](../../sites/castlink-bot/test_delivery.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_home_bridge.py

[`sites/castlink-bot/test_home_bridge.py`](../../sites/castlink-bot/test_home_bridge.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_home_bridge_account.py

[`sites/castlink-bot/test_home_bridge_account.py`](../../sites/castlink-bot/test_home_bridge_account.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_telegram_auth.py

[`sites/castlink-bot/test_telegram_auth.py`](../../sites/castlink-bot/test_telegram_auth.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_telegram_auth_integration.py

[`sites/castlink-bot/test_telegram_auth_integration.py`](../../sites/castlink-bot/test_telegram_auth_integration.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_telegram_relay.py

[`sites/castlink-bot/test_telegram_relay.py`](../../sites/castlink-bot/test_telegram_relay.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_transports.py

[`sites/castlink-bot/test_transports.py`](../../sites/castlink-bot/test_transports.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_trials.py

[`sites/castlink-bot/test_trials.py`](../../sites/castlink-bot/test_trials.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/test_webhook.py

[`sites/castlink-bot/test_webhook.py`](../../sites/castlink-bot/test_webhook.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/trials.py

[`sites/castlink-bot/trials.py`](../../sites/castlink-bot/trials.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-bot/webhook.py

[`sites/castlink-bot/webhook.py`](../../sites/castlink-bot/webhook.py)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/README.md

[`sites/castlink-general/README.md`](../../sites/castlink-general/README.md)

Страница знакомства CastLink `/general`

### sites/castlink-general/account-translations.js

[`sites/castlink-general/account-translations.js`](../../sites/castlink-general/account-translations.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/account.css

[`sites/castlink-general/account.css`](../../sites/castlink-general/account.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/account.html

[`sites/castlink-general/account.html`](../../sites/castlink-general/account.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/account.js

[`sites/castlink-general/account.js`](../../sites/castlink-general/account.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/download-releases.js

[`sites/castlink-general/download-releases.js`](../../sites/castlink-general/download-releases.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Используют: [`scripts/tests/landing-release-display.test.mjs`](../../scripts/tests/landing-release-display.test.mjs), [`sites/castlink-general/download-releases.test.cjs`](../../sites/castlink-general/download-releases.test.cjs).

### sites/castlink-general/download-releases.test.cjs

[`sites/castlink-general/download-releases.test.cjs`](../../sites/castlink-general/download-releases.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Читает/импортирует: [`scripts/publish-release-track.cjs`](../../scripts/publish-release-track.cjs), [`scripts/release-track.cjs`](../../scripts/release-track.cjs), [`sites/castlink-general/download-releases.js`](../../sites/castlink-general/download-releases.js).

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### sites/castlink-general/favicon.svg

[`sites/castlink-general/favicon.svg`](../../sites/castlink-general/favicon.svg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/first-screen.css

[`sites/castlink-general/first-screen.css`](../../sites/castlink-general/first-screen.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/index.html

[`sites/castlink-general/index.html`](../../sites/castlink-general/index.html)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/landing-account.test.cjs

[`sites/castlink-general/landing-account.test.cjs`](../../sites/castlink-general/landing-account.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`.

### sites/castlink-general/main.js

[`sites/castlink-general/main.js`](../../sites/castlink-general/main.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/sbp-qr-ozon.jpg

[`sites/castlink-general/sbp-qr-ozon.jpg`](../../sites/castlink-general/sbp-qr-ozon.jpg)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/sbp-qr-ozon.png

[`sites/castlink-general/sbp-qr-ozon.png`](../../sites/castlink-general/sbp-qr-ozon.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/sbp-qr.png

[`sites/castlink-general/sbp-qr.png`](../../sites/castlink-general/sbp-qr.png)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/styles.css

[`sites/castlink-general/styles.css`](../../sites/castlink-general/styles.css)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

### sites/castlink-general/telegram-auth-ui.test.cjs

[`sites/castlink-general/telegram-auth-ui.test.cjs`](../../sites/castlink-general/telegram-auth-ui.test.cjs)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.

Библиотеки/Node: `node:assert/strict`, `node:fs`, `node:path`, `node:test`, `node:vm`.

### sites/castlink-general/translations.js

[`sites/castlink-general/translations.js`](../../sites/castlink-general/translations.js)

Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.
