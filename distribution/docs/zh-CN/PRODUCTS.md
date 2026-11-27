[Русский](../../PRODUCTS.md) · [English](../en/PRODUCTS.md) · [简体中文](PRODUCTS.md)

# CastLink 软件包

**服务器 1.0.11** 在普通窗口中也会为主播的主画面请求最高画质，缩略图按显示尺寸选择画质。连接诊断现可显示故障区段、参与者和时间。 请选择 Windows/WSL2 或 Linux 软件包，并使用该版本的 `SHA256SUMS` 校验文件。Windows Client 版本为 **1.0.3**。

主要方向：**Windows 11 服务器使用 WSL2（无需 Docker Desktop）**、**Ubuntu/Linux 服务器**和单独的 **Windows 客户端**。[安装渠道及迁移限制](../../SUPPORTED_INSTALLERS.md)。

## 主要产品

| CastLink | 用途 | 下载 |
| --- | --- | --- |
| Windows Server / WSL2 | Windows 11 推荐方案；稳定版 **1.0.11** | [1.0.11](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.11-508042e07f6d) · [安装脚本](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.11-508042e07f6d/install-server-windows.ps1) · [维护 ZIP](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.11-508042e07f6d/CastLink-Server-WSL-Maintenance.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.11-508042e07f6d/SHA256SUMS) |
| Linux Ubuntu | Ubuntu/VPS 独立服务器，使用 Docker Engine/Compose | [1.0.11](https://github.com/resokol/castlink/releases/tag/linux-v1.0.11-508042e07f6d) · [安装脚本](https://github.com/resokol/castlink/releases/download/linux-v1.0.11-508042e07f6d/install-server.sh) · [CastLink-Linux.tar.gz](https://github.com/resokol/castlink/releases/download/linux-v1.0.11-508042e07f6d/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.11-508042e07f6d/SHA256SUMS) |
| Windows Client | 单独的主播/演播室应用，不安装服务器 | [1.0.3](https://github.com/resokol/castlink/releases/tag/client-v1.0.3-35dbb73b5925) · [安装程序](https://github.com/resokol/castlink/releases/download/client-v1.0.3-35dbb73b5925/CastLink-Client-1.0.3-35dbb73b5925-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.3-35dbb73b5925/SHA256SUMS) |

<a id="updater"></a>
## 永久更新工具 1.0.0

适用于受支持 Client、Windows/WSL2 与 Linux 安装的独立工具。在**每台电脑上安装一次**，然后使用固定快捷方式或命令。当前产品版本为 Client **1.0.3** 和 Server **1.0.11**。检查不会应用更新，应用需要确认。

[Windows 安装程序](https://castlink.ru/general/downloads/updater/install-updater-windows.cmd) · [Linux 安装程序](https://castlink.ru/general/downloads/updater/install-updater-linux.sh) · [分步指南](UPDATER.md)。稳定发行版：[`updater-v1.0.0-80b1a2c6f836`](https://github.com/resokol/castlink/releases/tag/updater-v1.0.0-80b1a2c6f836)，源代码 `80b1a2c6f8366a799e5bdbae2e015ac42ec3ac78`。[Manifest](https://github.com/resokol/castlink/releases/download/updater-v1.0.0-80b1a2c6f836/manifest.json) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/updater-v1.0.0-80b1a2c6f836/SHA256SUMS)。更新工具渠道独立于服务器和 Client 渠道。

## Legacy：Windows Server / Docker Desktop

| CastLink | 状态 | 历史版本 |
| --- | --- | --- |
| Windows Server Setup / Docker | 仅供现有安装维护，不再作为新 Windows 服务器方案 | [1.0.4](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.4-079fd0f9d4b1) · [历史 ZIP](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.4-079fd0f9d4b1/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.4-079fd0f9d4b1/SHA256SUMS) |

**不支持 Windows/Docker → WSL2 自动迁移。**请保留旧数据。旧版 Windows/SSH 工具归入 Legacy；远程 Ubuntu/VPS 建议使用 Linux 安装脚本通过 SSH 安装。

**[安装手册](LINUX_MANUAL.md)** — 开箱即用与高级设置.

运行前验证所选发行版本的 SHA256SUMS。EXE 无数字签名。Client 会在安装前验证更新，并单独请求同意；如果旧版 Client 无法找到发行版，请手动安装。服务器更新需要用户操作，可能中断直播。请自行备份所需数据；Windows Client、WSL2 与 Linux 分别发布，Windows/Docker 归为 Legacy。

Server Setup build: `1.0.4-079fd0f9d4b1` · source: `079fd0f9d4b18215274ff401ba584435e263994f`

Windows/WSL build: `1.0.11-508042e07f6d` · source: `508042e07f6dae18fb0fd353f65e0057ade8ffc5`

Linux build: `1.0.11-508042e07f6d` · source: `508042e07f6dae18fb0fd353f65e0057ade8ffc5`

Client build: `1.0.3-35dbb73b5925` · source: `35dbb73b5925797e753d395843a37f39c23f579d`

**1.0.6:** 演播室统计新增视频诊断 → JSON：发送和接收历史以及可用的帧和卡顿计数。 [发行说明](RELEASE_NOTES_1_0_6.md).

源代码 1.0.7: [web / Windows](https://github.com/resokol/castlink/tree/0d16de2e782cd2e847e9824024c5b788a080a59b) · [ZIP](https://github.com/resokol/castlink/archive/0d16de2e782cd2e847e9824024c5b788a080a59b.zip) · [Linux](https://github.com/resokol/castlink/tree/ac9c234c72b02ea594c2363d36611b1d732502d8) · [1.0.7 发行说明](RELEASE_NOTES_1_0_7.md).

**1.0.4：**主播卡片新增网络质量说明；Windows Client 更新为 1.0.1。 [1.0.4](RELEASE_NOTES_1_0_4.md).

**1.0.3：**降噪与回声消除使用同一开关，默认关闭；主控演播室可在主播卡片中切换。 [1.0.3](RELEASE_NOTES_1_0_3.md).

**服务器 1.0.2：**Super Admin 提供 24 小时指标历史与事件日志，重启后数据保留。Linux 还包含用于单命令安装的 [install-server.sh](https://github.com/resokol/castlink/releases/download/linux-v1.0.11-508042e07f6d/install-server.sh)。[安装说明](SERVER_INSTALL.md) · [1.0.2 发行说明](RELEASE_NOTES_1_0_2.md)。

Windows/WSL2 是主要 Windows 服务器渠道；稳定服务器版本为 1.0.11。请使用同一版本的维护 ZIP 包，在停播时更新原有 WSL 安装，然后刷新演播室和主播页面。旧版 Windows/Docker Server Setup 归为 Legacy。

**更新现有服务器：**请在停播时用对应维护工具及原数据目录将 WSL2 或 Linux 更新至 1.0.11；Legacy Windows/Docker 保持 1.0.4。连接恢复要求两台服务器均使用 1.0.1 或更高版本。Windows Client 为 1.0.3；请使用其内置更新检查。如果旧版 Client 无法找到发行版，请通过上方链接手动下载 1.0.3 安装程序一次，并验证 SHA256SUMS。[连接恢复](GUIDE.md#server-pair-recovery) · [更新日志](../../../CHANGELOG.md)。

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.3-35dbb73b5925) · [Windows WSL2 release](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.11-508042e07f6d) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.11-508042e07f6d) · [Docker Legacy release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.4-079fd0f9d4b1)

服务器 1.0.4 源代码：[发行版](https://github.com/resokol/castlink/releases/tag/source-v1.0.4-079fd0f9d4b1) · [准确提交](https://github.com/resokol/castlink/tree/079fd0f9d4b18215274ff401ba584435e263994f) · [ZIP](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/CastLink-Source-1.0.4.zip) · [tar.gz](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/CastLink-Source-1.0.4.tar.gz) · [manifest.json](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/manifest.json) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/source-v1.0.4-079fd0f9d4b1/SHA256SUMS)。源代码采用 MIT 许可；源码归档不是安装程序。当前开发：[main 分支](https://github.com/resokol/castlink/tree/main)。

## 说明与已发布归档

已发布归档内的文字说明反映构建时状态。最新说明位于本仓库，更新文档不会改变已安装文件或发布软件包的 SHA256。新行为需要相应软件包；旧 Linux 安装缺少密码时需明确执行恢复命令。

## 统一仓库

CastLink 唯一的公开仓库是 [resokol/castlink](https://github.com/resokol/castlink)，包含采用 MIT许可的自有源代码、发行版和说明。下载归档及 `SHA256SUMS` 无需单独授予访问权限。旧名称 `resokol/castlink-releases` 会重定向到此仓库，以兼容旧链接和安装程序，并不是独立镜像。统一的 `releases/latest` 不能代表三个产品的当前版本。

此前的归档仅进行了复制，没有重新构建：文件名、内嵌 build/source ID 和校验和保持不变。下表将原始构建提交对应到仓库的当前历史；新的源代码链接不代表新的二进制软件包。

| 原始构建提交 | 当前历史中的源代码 |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
