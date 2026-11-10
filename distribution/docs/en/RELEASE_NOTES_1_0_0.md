# CastLink 1.0.0

[Русский](../../RELEASE_NOTES_1_0_0.md) · English · [简体中文](../zh-CN/RELEASE_NOTES_1_0_0.md)

The stable **1.0.0** release of CastLink, without the RC label, includes web/runtime, Windows Client, Windows Server Setup and standalone Linux. Windows Client is built from source commit `93d9b93e17daced23b3eb4207c8464d6091bea0c`; Windows Server Setup and standalone Linux are built from `1ea894bd94adb96f861398cc30addc93d1bf9d21`. Exact links for all three products and their `SHA256SUMS` are in the [package catalog](PRODUCTS.md).

## Added and fixed

- Compact studio console with preview, device controls, casters and statistics.
- Caster microphone and camera selection menus, microphone testing and audio processing settings.
- Mobile layout, video proportions, statistics graph and multiview editor fixes.
- HTTP session renewal and browser, connection and audio diagnostics.

## Updating

Update off air: server services restart, and the client closes for installation. Save any needed data and configuration backups first.

- **Windows Client:** run the built-in update check. The installer is downloaded and verified before separate consent to close the client and install it. If an older Client cannot find the release, download the 1.0.0 installer manually once from the catalog and verify its SHA256 against `SHA256SUMS` from the same release. The EXE is unsigned.
- **Windows Server Setup:** extract the complete new `CastLink-Windows.zip`, run `EasySetup.exe`, choose **Update** and select the existing local folder or the same VPS.
- **Standalone Linux:** use `check-updates` and `update` with the existing `--state-dir`; for a manual update, use the new verified package. [Update steps](LINUX_MANUAL.md#diagnose-and-update). This helper does not adopt Windows/legacy installations.

Updating an existing supported installation preserves data, settings, UUIDs, secrets and networking; creating a new installation instead of selecting the existing one is not an update. This release requires no database migration. Reload studio and caster pages off air after the server update, and check connections, audio, video and OBS/vMix outputs.

The three products have independent release channels. Download each package and `SHA256SUMS` from the same product release. Older RC archives, embedded manifests, licenses and checksums remain unchanged. The source archive is not a ready-to-run installer.

CastLink's own code is [MIT-licensed](../../../LICENSE); third-party components retain their own licenses.
