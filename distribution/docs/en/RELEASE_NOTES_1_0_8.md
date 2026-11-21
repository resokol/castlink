[Русский](../../RELEASE_NOTES_1_0_8.md) · [English](RELEASE_NOTES_1_0_8.md) · [简体中文](../zh-CN/RELEASE_NOTES_1_0_8.md)

# Windows/WSL2 Server 1.0.8 and CastLink Updater 1.0.1

This release covers the Windows/WSL2 server folder and managed relocation. **Linux Server remains 1.0.7, Windows Client 1.0.1, and Windows/Docker Legacy 1.0.4.** It is not a shared release of all products. Check the [catalog](PRODUCTS.md) for exact packages, tags, sources and checksums; existing archives and tags remain unchanged.

## Changes

- New installations prompt for a folder; `-InstallRoot` supplies it explicitly. The default remains `%LOCALAPPDATA%\CastLinkServer`.
- **Move server…** moves the active WSL virtual disk, data, panel and installation-owned files. It preserves identity, URL, version, rooms, history, passwords, certificates, settings and autostart preference. Moving does not update the version.
- CastLink Updater 1.0.1 discovers registered installations outside AppData, reports unavailable disks and opens a separate move action for the selected WSL server.
- Large working archives and subsequent update generations use the selected volume. A small protected registry and operation journal remain in AppData. Manually saved backup archives have a separately chosen destination.
- Interrupted moves support recovery. **Cancel move** restores the source state only after verifying that the WSL disk is still in its original folder and cancellation is safe; it does not roll back an already relocated VHD.

## Install or move

1. Choose the official package for your channel in the [catalog](PRODUCTS.md) and verify `SHA256SUMS`. For a new installation, select **Installation folder** or pass `-InstallRoot 'D:\CastLink\Server 2'`. Normal network and installation requirements still apply.
2. For an existing server, keep a separate backup and schedule downtime. **Explicitly update 1.0.7 to 1.0.8 in its current location first**, then move. The exact supported 1.0.7 source is `server-wsl-v1.0.7-0d16de2e782c`. Do not edit the old installer. Using the Updater action requires Updater 1.0.1 or a compatible later release.
3. Select the server by address and folder in Maintenance or Updater, choose **Move server…** and enter a new folder that does not yet exist. Review the address, source/destination and required/free space, then confirm downtime. Declining confirmation does not start a move. Keep the window open and the disk connected during the operation.
4. After an interruption, reopen Maintenance and select **Recover transaction**. If **Cancel move** is available for the pending move, select it and confirm returning to the source; the tool rechecks the actual VHD location and refuses if cancellation is too late. Use recovery in that case. Do not cancel by killing the process.
5. After success, open `CastLinkServer.lnk` in the new folder and check the address, server status and connectivity. A running server resumes; a stopped server remains stopped. After a version update, reload studio and caster pages. After a fresh installation, reopen the panel using `native-panel\CastLinkServer.exe`.

**If the WSL disk is busy:** Docker Desktop or other WSL applications can keep the CastLink disk busy even after its distribution stops. If this blocks a move, finish your work in those applications and close them before moving. The tool stops only the selected server and automatically waits a limited time for the disk to be released. If the disk remains busy, close the applications holding it and choose **Recover transaction**; if you cannot interrupt them now, use **Cancel move** when safe and the VHD is still at its source. If needed, run `wsl --shutdown` only manually, after saving and explicitly finishing **all work in every WSL distribution**: it stops them all, including the Docker Desktop environment. The tool never runs it automatically; shutting down all of WSL is not required for every move.

## Requirements and limits

Use the same computer and Windows user, an available local **NTFS** disk and sufficient free space. Spaces, Cyrillic names and external NTFS disks with a stable drive letter are supported. UNC/network paths, FAT/exFAT, drive roots, system directories and symbolic links or junction/reparse points are unsupported; unrelated files are not adopted. Private permissions apply to the installation folder, not its parents. Installation requires **WSL 2.4.13+**; relocation requires **WSL 3.0.1+** with official `--manage --move` support.

**Updating from every older version is not guaranteed.** The target manifest lists exact supported sources, covering 1.0.7 and supported earlier RC releases; a version number alone does not establish compatibility. Recover an incomplete or modified installation first. Restore older archives with an AppData-pinned installer under `%LOCALAPPDATA%\CastLinkServer`, explicitly update, and only then move.

Dragging a folder in Explorer or manually deleting a VHD or WSL registration is not relocation or recovery. Reconnect an external disk with its original drive letter and refresh the list; an unavailable installation is not treated as deleted. Preserve data and the journal if a conflict is reported. Moving is not a backup. Automatic Docker → WSL2 migration is unsupported.

[Folder and relocation details](WINDOWS_SERVER_LOCATION.md) · [CastLink Updater](UPDATER.md) · [Installation and maintenance](SERVER_INSTALL.md) · [Server/web 1.0.7 history](RELEASE_NOTES_1_0_7.md)
