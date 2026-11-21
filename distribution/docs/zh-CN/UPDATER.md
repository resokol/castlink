[Русский](../../UPDATER.md) · [English](../en/UPDATER.md) · [简体中文](UPDATER.md)

# CastLink 永久更新工具 1.0.0

在运行 CastLink 的**每台电脑上连接一次**更新工具，之后使用固定 Windows 快捷方式或 Linux 命令，无需为每个发行版重新手动下载维护工具。启动器获取经验证的工具版本，并选择对应产品的独立稳定渠道。

支持 **Windows Client 1.0.1**、**Windows/WSL2 Server 1.0.7**、**Ubuntu/Linux Server 1.0.7** 及后续兼容版本。更新工具 **1.0.0** 的版本独立于产品版本。连接更新工具不会重新安装服务器、更改其版本或重启服务。

## 可以从哪些旧版本更新？

**不保证能从任意旧版本更新。** CastLink Updater 使用各产品原有的更新流程，仅凭版本号无法判断兼容性。

| 产品 | 条件 |
| --- | --- |
| Windows/WSL2 Server → 1.0.7 | 支持目标 manifest 中列出的官方 **1.0.5-rc.1、1.0.5-rc.2、1.0.5-rc.3 和 1.0.6-rc.1**，并核对已安装版本的完整标签。 |
| Windows Client | 需要已安装的官方 Client，且构建元数据可读取。已验证识别 Client 1.0.0 并选择 1.0.1；这不表示支持所有旧版或修改版。 |
| Linux Server | 使用独立 Linux/Compose 安装程序创建的安装，且配置与安装标识完整。未完成的安装须先完成或恢复。不自动接管任意手动部署。 |
| Windows/Docker Legacy | 使用原维护工具。不支持自动迁移至 WSL2 或 Linux。 |

请先对自己的安装点击 **检查** 或运行 `castlink check-updates`。版本与文件检查通过不能代替备份，也不能代替更新后的服务器运行验证。

## Windows：Client 与 WSL2 共用一个快捷方式

1. 将 [install-updater-windows.cmd](https://castlink.ru/general/downloads/updater/install-updater-windows.cmd) 下载到**已安装 Client 或 WSL 服务器的电脑**。
2. 运行文件。它从官方发行版获取并验证 PowerShell 工具，然后为当前用户注册。维护 WSL 无需 Node.js，也无需单独安装 Client。
3. 在**开始菜单**中找到固定快捷方式 **Update CastLink**。更新窗口显示为**更新 CastLink**，可选择俄语、英语或中文。
4. 选择**具体的本机安装**：Client 或某个 WSL 服务器。有多个服务器时请核对地址和文件夹。更新所选产品不会同时更新其他产品。
5. 点击**检查**，查看产品、安装、当前/可用版本及发行说明。需要应用时点击**更新…**并确认。请在停播时更新服务器。

可关闭**启动时检查**，仍可手动点击**检查**。检查和取消不会停止服务器或关闭 Client。应用服务器更新会中断服务；确认后客户端安装程序可能关闭应用。

如果选择官方发行版中的 `castlink-updater.ps1` 文件而非 CMD，请先与 `SHA256SUMS` 核对，然后在下载文件夹中执行一次：

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\castlink-updater.ps1 -Install -Language zh-CN
```

WSL 使用非标准文件夹时，请从该服务器面板打开更新工具，或通过 `-InstallRoot` 指定实际绝对路径。不要仅因为某个安装排在第一位就选择它。

## Linux：连接现有服务器

需要服务器环境已要求的 **bash 和 Python 3**。请在 Linux 服务器本机上使用能访问原安装的权限执行。`/opt/castlink-server` 是标准示例；如安装在其他位置，请替换为**实际存在的数据目录**。

```bash
curl -fsSL https://castlink.ru/general/downloads/updater/install-updater-linux.sh -o install-updater-linux.sh
sudo bash install-updater-linux.sh --state-dir /opt/castlink-server --lang zh-CN
```

这是一次性连接，不是首次安装服务器。以 root 运行时默认创建 `/usr/local/bin/castlink` 及私有更新工具目录 `/var/lib/castlink-updater`，服务器数据保持原位。不会覆盖其他已有 `castlink` 命令；如出现冲突，请先解决 `PATH` 歧义。

检查可用更新而不应用：

```bash
sudo castlink check-updates --state-dir /opt/castlink-server
```

查看当前/目标版本、说明并明确确认后应用：

```bash
sudo castlink update --state-dir /opt/castlink-server
```

查看或更改启动检查设置：

```bash
sudo castlink updates --state-dir /opt/castlink-server
sudo castlink updates --state-dir /opt/castlink-server --auto-check off
sudo castlink updates --state-dir /opt/castlink-server --auto-check on
```

只有一个已注册安装时可以省略 `--state-dir`；有多个时请指定所需绝对路径。连接另一个安装时，为其数据目录再运行一次更新工具安装脚本。文件夹移动或身份改变时，需要明确检查并注册真实安装，更新工具不会创建新服务器代替旧服务器。该设置不会添加 cron、系统定时器或后台服务。

## 验证、错误与数据

- 只选择**对应产品**的兼容稳定版本，统一的 GitHub `releases/latest` 不决定目标。下载文件根据官方发行版 manifest、大小及 SHA256 验证。SHA256 并非发行者数字签名。[目录与校验和](PRODUCTS.md#updater)。
- **没有可用更新**表示没有适合的新版本。网络或验证失败会显示为错误；修复连接后使用同一快捷方式或命令重试。损坏的下载不会执行。
- 应用产品更新始终需要用户操作与确认。不会自动应用更新，也不提供远程 SSH 管理或遍历其他电脑。请在停播时更新服务器，然后刷新演播室及参与者页面。
- 使用所选产品的正常维护机制，保留原数据与身份。请单独备份所需数据。WSL 事务中断时使用**恢复事务…**或正常维护恢复；不承诺能通用回滚所有数据库变更。
- Windows/Docker Server Setup 保持 **Legacy 1.0.4**，继续使用原维护工具。更新工具不会将其自动迁移到 WSL2 或 Linux，已发布的旧归档保持不变。

[服务器安装与维护](SERVER_INSTALL.md) · [软件包](PRODUCTS.md)
