[Русский](../../UPDATER.md) · [English](UPDATER.md) · [简体中文](../zh-CN/UPDATER.md)

# Persistent CastLink Updater 1.0.0

Connect the updater **once on each computer** running CastLink. Then use the permanent Windows shortcut or Linux command: you do not need to download another maintenance tool manually for every release. The launcher obtains a verified version of its own tool and selects the appropriate product's separate stable channel.

Supports **Windows Client 1.0.1**, **Windows/WSL2 Server 1.0.7**, **Ubuntu/Linux Server 1.0.7** and compatible later releases. Updater version **1.0.0** is independent of product versions. Onboarding does not reinstall the server, change its version or restart services.

## Windows: one shortcut for Client and WSL2

1. Download [install-updater-windows.cmd](https://castlink.ru/general/downloads/updater/install-updater-windows.cmd) to **the computer where Client or the WSL server is installed**.
2. Run it. It obtains and verifies the PowerShell tool from the official release and registers it for the current user. Node.js and a separate Client installation are unnecessary for WSL maintenance.
3. Find the permanent **Update CastLink** shortcut in **Start**. The updater window is also called **Update CastLink**; Russian, English and Chinese are available.
4. Select the **specific local installation**: Client or a WSL server. For multiple servers, check the address and folder. Updating one selected product does not update the others.
5. Click **Check**. Review the product, installation, current/available versions and release notes. Click **Update…** and confirm to apply. Update servers off air.

You can disable **Check at startup**; **Check** remains available manually. Checking and cancelling do not stop the server or close Client. Applying a server update interrupts service; the Client installer may close the app after confirmation.

If you choose the direct `castlink-updater.ps1` PowerShell file from the official release instead of CMD, verify it against `SHA256SUMS`, then run this once from its download folder:

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\castlink-updater.ps1 -Install -Language en
```

For a nonstandard WSL folder, open the updater from that server's panel or pass its actual absolute path with `-InstallRoot`. Do not choose an unrelated installation simply because it appears first.

## Linux: connect an existing server

Requires **bash and Python 3**, already required by the server environment. Run these commands on the Linux server with access to its installation. `/opt/castlink-server` is the standard example: replace it with the **actual existing state directory** if your server uses a different location.

```bash
curl -fsSL https://castlink.ru/general/downloads/updater/install-updater-linux.sh -o install-updater-linux.sh
sudo bash install-updater-linux.sh --state-dir /opt/castlink-server --lang en
```

This is one-time onboarding, not initial server installation. Root defaults to `/usr/local/bin/castlink` and the private updater directory `/var/lib/castlink-updater`; server data stays in place. An unrelated existing `castlink` command is not overwritten: resolve an ambiguous `PATH` first if a conflict is reported.

Check available updates without applying them:

```bash
sudo castlink check-updates --state-dir /opt/castlink-server
```

Apply after reviewing current/target versions, notes and explicitly confirming:

```bash
sudo castlink update --state-dir /opt/castlink-server
```

Show or change the startup-check preference:

```bash
sudo castlink updates --state-dir /opt/castlink-server
sudo castlink updates --state-dir /opt/castlink-server --auto-check off
sudo castlink updates --state-dir /opt/castlink-server --auto-check on
```

With one registered installation, `--state-dir` is optional. For multiple installations, specify the intended absolute path; onboard another installation once by rerunning the updater installer with its `--state-dir`. A moved folder or changed identity requires explicit review and registration of the actual installation: the updater does not create a replacement server. This preference adds no cron job, system timer or background service.

## Checks, failures and data

- Selects compatible stable releases for **its own** product; the shared GitHub `releases/latest` does not choose the target. Downloaded files are checked against official release manifests, sizes and SHA256. SHA256 is not a publisher's digital signature. [Catalog and checksums](PRODUCTS.md#updater).
- **No updates available** means no suitable newer version. Network or verification failures are reported as errors: fix connectivity and retry the same shortcut or command. Corrupt downloads are not executed.
- Applying product updates always requires a user action and confirmation. There is no autonomous apply, remote SSH management or traversal of other computers. Update servers off air, then reload studio and caster pages.
- Uses the selected product's normal maintenance with existing data and identities. Keep a separate backup of needed data. Recover an interrupted WSL transaction through **Recover transaction…** or normal maintenance; a universal rollback of every database change is not promised.
- Windows/Docker Server Setup remains **Legacy 1.0.4**, using its original maintenance tool. The updater does not migrate it automatically to WSL2 or Linux. Existing published archives remain unchanged.

[Server installation and maintenance](SERVER_INSTALL.md) · [Packages](PRODUCTS.md)
