[Русский](../../WINDOWS_SERVER_LOCATION.md) · [English](WINDOWS_SERVER_LOCATION.md) · [简体中文](../zh-CN/WINDOWS_SERVER_LOCATION.md)

# Windows/WSL2 server folder — next release draft

**Draft for the next release, not instructions for published version 1.0.7.** Proposed versions are Windows/WSL2 Server **1.0.8** and CastLink Updater **1.0.1**; neither has been published yet. Folder selection and relocation require a release that explicitly supports them. Check the official release notes for availability. See the [CastLink Updater guide](UPDATER.md) for onboarding and normal updates.

## Choose a location

Use a dedicated folder on an available local **NTFS** disk, such as `D:\CastLink\Server 2`. Spaces, Cyrillic names and external NTFS disks with a stable drive letter are supported. The folder must be accessible to the same Windows user. Network/UNC paths, FAT/exFAT, drive roots, system directories, and paths containing symbolic links or junction/reparse points are unsupported. Do not select a folder containing unrelated files.

Installation requires **WSL 2.4.13 or newer**; relocation requires **WSL 3.0.1 or newer** with `--manage --move`. Check with `wsl --version`; run `wsl --update` if needed. Free space is checked on the destination disk: a new installation needs at least **8 GiB**, while a move needs room for the current virtual disk, installation files and an additional margin. Allow extra space for data growth.

## Install a new server

1. Obtain an official release package supporting folder selection. The repository source script is not a packaged installer.
2. Start installation and enter the full path at **Installation folder**. Press Enter to keep `%LOCALAPPDATA%\CastLinkServer`.
3. Alternatively, supply the path explicitly in PowerShell from the official package folder. Replace the address with your own:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1 -Address meet.example.com -InstallRoot 'D:\CastLink\Server 2' -Lang en
   ```

4. Complete normal network and server setup using the [installation guide](SERVER_INSTALL.md). Open `CastLinkServer.lnk` in the selected folder to launch the panel.

With `-NonInteractive` and no `-InstallRoot`, the default folder is retained. Changing `-InstallRoot` on a later run does not move an existing server; use the separate action below.

## Move an existing server

1. Keep a separate backup and schedule downtime: moving temporarily interrupts server availability. This operation stays on the same computer and under the same Windows user.
2. For Server **1.0.7, first explicitly update in its current location** to a release supporting relocation. Also update CastLink Updater to a release supporting this feature. **Move server…** does not update the product version. Do not edit the old pinned installer.
3. Open **Maintenance** in the server panel, or select the intended WSL server in CastLink Updater and choose **Move server…**. Check the address and current folder, especially when several servers are installed.
4. Enter the full path of a **new folder that does not yet exist**, such as `D:\CastLink\Server 2`. Browsing for a parent folder proposes a new name, which you can change. The destination must neither be inside the source folder nor contain it.
5. Click **Move server…**, review both folders in the confirmation and confirm the interruption. Keep the window open and the disk connected. WSL support, installation ownership and free space are checked before the server is stopped.
6. Wait for completion. Open `CastLinkServer.lnk` in the new folder, verify the server address and status, and refresh the Updater list. A previously running server should resume; a stopped server should remain stopped.

The WSL virtual disk (VHDX), server data, panel and installation-owned files move together. The version, server identity, URL, rooms, history, passwords, certificates, network settings and sign-in autostart preference are preserved. Moving is not an independent backup. Future update generations and WSL server working archives use the selected volume; a backup archive destination you choose manually remains your choice.

A small installation registry and operation journal remain in `%LOCALAPPDATA%\CastLinkServerRegistry`. Some control files may remain in the previous folder; this does not mean the active VHD remains on the old disk. Do not remove these remnants manually before verifying completion and server operation. **Dragging the folder in Explorer is not a supported move** and does not update WSL, panel or autostart bindings.

## After power loss or a disconnected disk

Reconnect the disk with the same drive letter and reopen maintenance. For an unfinished move, select **Recover transaction**; Updater also offers **Recover transaction…**. Normal start, update and another move are blocked until recovery. The tool checks the journal against the actual WSL location and proceeds only when data ownership is verified. Do not start a second copy or delete either folder, the VHD or the WSL registration.

A disconnected external disk appears as an unavailable installation, not a deleted server. Reconnect it and refresh the list; do not create a replacement in the same folder. If recovery reports a conflict, keep the journal and error message for investigation. Installing over existing data is not recovery.

## Older archives

An archive from a release supporting custom locations can be restored onto a suitable local NTFS disk. **For an archive with an older pinned installer, first restore under `%LOCALAPPDATA%\CastLinkServer`, explicitly update the server, and then move it.** Do not modify the archive, manifest or old installer to bypass this restriction.

[CastLink Updater](UPDATER.md) · [Server installation and maintenance](SERVER_INSTALL.md)
