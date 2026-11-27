# Server 1.0.13 — automatic cleanup

[Русский](../../RELEASE_NOTES_1_0_13.md) · [English](RELEASE_NOTES_1_0_13.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_13.md)

Preparation for the next Windows/WSL2 and Linux/Ubuntu release. This note does not
mean that new packages have been published; see the [catalog](PRODUCTS.md) for
currently available releases.

- Setup installs background maintenance, upgrades refresh it, and removing a
  server unregisters its task. The server panel need not remain open.
- Retention keeps the current and two previous successfully started product
  versions. Rebuilding one version does not consume an extra history slot.
- Only verified installation-owned obsolete material is removed. Data, settings,
  certificates, other installations and unfinished operations are preserved.
  Historical shared caches and unknown history require separate review.
- Cleanup interoperates across Linux, legacy Windows/Docker and managed VPS
  receipts, protecting another installation's staged images before containers run.
- Windows/WSL2 supports upgrading published 1.0.11 and 1.0.12 while preserving identity,
  data and settings. Earlier supported upgrade paths remain available.

Upgrade an existing server through its normal tool while off air. Publishing a
package does not upgrade servers automatically. Cleanup does not install new
versions or create automatic data backups.
