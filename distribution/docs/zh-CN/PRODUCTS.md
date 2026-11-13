[Русский](../../PRODUCTS.md) · [English](../en/PRODUCTS.md) · [简体中文](PRODUCTS.md)

# CastLink 软件包

| CastLink | 用途 | 下载 |
| --- | --- | --- |
| Windows Client | Windows 应用：演播室与主播 | [1.0.0](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/CastLink-Client-1.0.0-93d9b93e17da-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/client-v1.0.0-93d9b93e17da/SHA256SUMS) |
| Windows Server | Windows 向导：在本地或通过 SSH 在 Linux Ubuntu 上部署自己的服务器 | [1.0.3](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.3-1a26de9f6f59/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-setup-v1.0.3-1a26de9f6f59/SHA256SUMS) |
| Linux Ubuntu | 在 Linux Ubuntu 上独立安装服务器 | [1.0.3](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/SHA256SUMS) |

**[安装手册](LINUX_MANUAL.md)** — 开箱即用与高级设置.

运行前验证所选发行版本的 SHA256SUMS。EXE 无数字签名。Client 会在安装前验证更新，并单独请求同意；如果旧版 Client 无法找到发行版，请手动安装。服务器更新需要用户操作，可能中断直播。请自行备份所需数据；三个产品独立发布。

Server Setup build: `1.0.3-1a26de9f6f59` · source: `1a26de9f6f59cc95e84708e6e259bc0503daae38`

Linux build: `1.0.3-1a26de9f6f59` · source: `1a26de9f6f59cc95e84708e6e259bc0503daae38`

Client build: `1.0.0-93d9b93e17da` · source: `93d9b93e17daced23b3eb4207c8464d6091bea0c`

**1.0.3：**降噪与回声消除使用同一开关，默认关闭；主控演播室可在主播卡片中切换。 [1.0.3](RELEASE_NOTES_1_0_3.md).

**服务器 1.0.2：**Super Admin 提供 24 小时指标历史与事件日志，重启后数据保留。Linux 还包含用于单命令安装的 [install-server.sh](https://github.com/resokol/castlink/releases/download/linux-v1.0.3-1a26de9f6f59/install-server.sh)。[安装说明](SERVER_INSTALL.md) · [1.0.2 发行说明](RELEASE_NOTES_1_0_2.md)。

普通 Windows 本地 Server Setup 需要运行 Linux 容器的 Docker Desktop。无 Docker 的 Windows/WSL2 仍为独立候选版，安装及外部媒体通话尚未验证；本表不提供稳定 WSL 软件包。

**服务器升级至 1.0.3：**请在停播时更新 Server Setup 或 Linux，并选择原有安装。连接恢复要求两台服务器均使用 1.0.1 或更高版本。Windows Client 保持 1.0.0；请使用其内置更新检查。如果旧版 Client 无法找到发行版，请通过上方链接手动下载 1.0.0 安装程序一次，并验证 SHA256SUMS。[连接恢复](GUIDE.md#server-pair-recovery) · [更新日志](../../../CHANGELOG.md)。

[Client release](https://github.com/resokol/castlink/releases/tag/client-v1.0.0-93d9b93e17da) · [Server Setup release](https://github.com/resokol/castlink/releases/tag/server-setup-v1.0.3-1a26de9f6f59) · [Linux release](https://github.com/resokol/castlink/releases/tag/linux-v1.0.3-1a26de9f6f59)

服务器 1.0.3 源代码：[发行版](https://github.com/resokol/castlink/releases/tag/source-v1.0.3-1a26de9f6f59) · [准确提交](https://github.com/resokol/castlink/tree/1a26de9f6f59cc95e84708e6e259bc0503daae38) · [ZIP](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/CastLink-Source-1.0.3.zip) · [tar.gz](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/CastLink-Source-1.0.3.tar.gz) · [manifest.json](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/manifest.json) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/source-v1.0.3-1a26de9f6f59/SHA256SUMS)。源代码采用 MIT 许可；源码归档不是安装程序。当前开发：[main 分支](https://github.com/resokol/castlink/tree/main)。

## 说明与已发布归档

已发布归档内的文字说明反映构建时状态。最新说明位于本仓库，更新文档不会改变已安装文件或发布软件包的 SHA256。新行为需要相应软件包；旧 Linux 安装缺少密码时需明确执行恢复命令。

## 统一仓库

CastLink 唯一的公开仓库是 [resokol/castlink](https://github.com/resokol/castlink)，包含采用 MIT许可的自有源代码、发行版和说明。下载归档及 `SHA256SUMS` 无需单独授予访问权限。旧名称 `resokol/castlink-releases` 会重定向到此仓库，以兼容旧链接和安装程序，并不是独立镜像。统一的 `releases/latest` 不能代表三个产品的当前版本。

此前的归档仅进行了复制，没有重新构建：文件名、内嵌 build/source ID 和校验和保持不变。下表将原始构建提交对应到仓库的当前历史；新的源代码链接不代表新的二进制软件包。

| 原始构建提交 | 当前历史中的源代码 |
| --- | --- |
| `f6c47a27a62c59f72067f4fe95ee215fcb056bfc` | [`2a999576d5560f7ea6af77b38a8b078a148e5a98`](https://github.com/resokol/castlink/commit/2a999576d5560f7ea6af77b38a8b078a148e5a98) |
| `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1` | [`df13dc176ca2868fc256af9d454076e2fa6a0ccd`](https://github.com/resokol/castlink/commit/df13dc176ca2868fc256af9d454076e2fa6a0ccd) |
