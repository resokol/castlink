# 服务器安装与监控

[Русский](../../SERVER_INSTALL.md) · [English](../en/SERVER_INSTALL.md) · [简体中文](SERVER_INSTALL.md)

本指南适用于 Linux **1.0.10** 和 Windows/WSL **1.0.10**；旧 Docker Server Setup 保留为独立通道。Windows Client 版本为 **1.0.3**。可用软件包、准确的源代码与构建编号及校验值见[产品目录](PRODUCTS.md)。[Windows/WSL2 1.0.10](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.10-890a903d51f9) · [Linux 1.0.10](https://github.com/resokol/castlink/releases/tag/linux-v1.0.10-890a903d51f9)。

**Windows 服务器主要方向：** WSL2，无需 Docker Desktop。Windows/WSL2 稳定服务器版本为 **1.0.10**。旧版 Windows/Docker/SSH EasySetup 归为 **Legacy**，仅用于现有部署；Linux/VPS 继续使用独立的稳定 Docker Engine/Compose 安装程序。[渠道和迁移限制](../../SUPPORTED_INSTALLERS.md)。

服务器 **1.0.2** 首次引入[Linux 单命令安装、24 小时指标历史及事件日志](RELEASE_NOTES_1_0_2.md)。保留旧版 Windows/Docker 包，不支持 Docker → WSL2 自动迁移。

请在停播时通过明确的更新操作选择原有安装，保留数据与配置；Linux 继续使用原有 `--state-dir`。发布软件包不会自动更新运行中的服务器。就绪检查通过后，手动刷新**演播室和参与者双方的页面**，包括 Windows Client 中的页面：客户端显示所选服务器的界面。

**更新时无需反复下载工具：**在每台电脑上连接一次[永久更新工具](UPDATER.md)。Windows 的 Client 与 WSL2 使用 **Update CastLink** 快捷方式，Linux 使用 `castlink check-updates` 与 `castlink update`。应用更新需要确认。

## Ubuntu Linux

以下命令安装稳定版 **1.0.10**。Windows 和 Linux 的分步安装请见[主页指南](../../../README.zh-CN.md)。

支持 Ubuntu22.04/24.04 amd64。Linux 版本提供独立 `install-server.sh`，固定版本及
压缩包 SHA256。使用以下 1.0.10 的准确下载地址，不使用全局 `releases/latest`：

```bash
curl -fsSL https://github.com/resokol/castlink/releases/download/linux-v1.0.10-890a903d51f9/install-server.sh | sudo bash -s -- --install-runtime --lang zh-CN
```

**linux-v1.0.10-890a903d51f9** 安装器询问服务器地址及创建房间密码，
将软件包和配置保存在 `/opt/castlink-server`，载入附带镜像并运行现有 Linux 安装流程。
`--install-runtime` 允许安装依赖及启动 Docker；不加此参数则需要可用的 Docker/Compose。
DNS、路由器端口转发及外部防火墙由管理员配置。[端口与模式](LINUX_MANUAL.md)。

再次运行保留数据、UUID、密钥及当前版本，不自动更新或重启已完成的安装。
显示的保存地址不代表最新健康检查，请使用已保存工具的 `status` 命令。
自定义目录须每次使用相同的绝对 `--state-dir`。无人值守安装支持 `--config` 和
`--room-creation-password-file`（UTF-8，末尾不换行）。

## 无 Docker 的 Windows/WSL2 — 主要 Windows 服务器方案

[稳定版 1.0.10 安装程序](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.10-890a903d51f9)使用独立的 server-wsl 发行渠道。请查看[安装步骤与限制](../../../README.zh-CN.md#windows-11-服务器)。

需要 Windows11 x64 build22621+、WSL2 版本2.4.13+ 及虚拟化。
独立 `server-wsl-v…` 通道提供 `install-server-windows.ps1` 和预构建 Ubuntu 服务器系统。
用户不需要 Docker Desktop/Engine、源码编译或手动安装 Node/PostgreSQL。
这是 WSL 服务器，并非原生 Windows 服务。下载所选版本的脚本，核对 `SHA256SUMS`，
然后在 PowerShell 中运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1 -Action Install
```

安装器询问地址和密码，验证 rootfs SHA256，仅创建其专属发行版。
首次启用 WSL 可能需要管理员同意及重启；重启后再次运行相同命令，不自动重启。
现有发行版、冲突端口和设置保持不变。需要共享 WSL 设置 `networkingMode=mirrored`
及 `[experimental] hostAddressLoopback=true`，后者允许本机通过分配给 Windows 的 IPv4
地址访问服务器。安装器仅在明确同意后添加缺失设置，不覆盖已有的 `false`。
随后重启 Windows，或等待 WSL 虚拟机完全停止，再次运行相同命令。
不执行全局 `wsl --shutdown`。若导入后在写入身份标记前中断，会保留发行版供人工检查，
不会自动接管或删除。

服务器发行版禁用 Windows 磁盘自动挂载及 Windows 程序互操作。PPTX 转换使用独立低权限
用户、无网络及资源限制。所需端口：TCP80/443/7881；UDP3478/7882/30000–30031。
域名部署还需将 `turn.<domain>` 指向相同 IP。外部访问依赖 NAT 和防火墙。
本地 CA 的信任由当前 Windows 用户明确选择，其他客户端设备也需信任。
HTTPS/数据库就绪不代表已验证外部媒体通话。
同一安装器支持 `-Action Start`、`Stop`、`Status`、`OwnerAccess`，停止保留数据。
此安装器不迁移或升级已有 Docker 部署。

后台进程在安装窗口关闭后保持专属 WSL 发行版运行。经明确同意可启用当前 Windows 用户
登录时自动启动。明确执行 `Stop` 后保留停止状态。

### 维护：更新、删除及恢复

从**同一发行版**下载 [CastLink-Server-WSL-Maintenance.zip](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.10-890a903d51f9/CastLink-Server-WSL-Maintenance.zip)，完整解压并双击 **CastLink-Maintenance.cmd**。[SHA256](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.10-890a903d51f9/SHA256SUMS)。新面板的**维护**按钮打开同一工具。旧版 1.0.5-rc.1 需要此独立工具，其原安装程序不会自行更新。

**选择与更新。** 按地址和文件夹选择确切的服务器，不要默认选择多个安装中的第一个。不完整安装的地址可能未知，请核对文件夹。选择目标版本，点击**检查**，核对当前/目标版本及所需/可用空间。工具在停止服务前下载并验证所需文件。检查不会自动开始更新，预发布版本必须明确选择。正常窗口无需输入 SHA256 或不透明的 WSL 标识。

请仅在非直播时点击**更新**：迁移和就绪检查期间服务器会停止。确认对话框显示所选地址、版本和文件夹，也可取消。支持的来源版本为 `server-wsl-v1.0.5-rc.1-085b087a2458`, `server-wsl-v1.0.5-rc.2-af3e309d0926`、`server-wsl-v1.0.5-rc.3-95ec46463c82`、`server-wsl-v1.0.6-rc.1-dad063393b53`、`server-wsl-v1.0.7-0d16de2e782c` 及 `server-wsl-v1.0.8-1afa39b54dd7`。不支持其他来源版本、迁移 Docker 或跨 PostgreSQL 主版本更新。不完整来源需用原版本修复，或通过此工具删除；更新不会将其假定为就绪。

要将稳定版 1.0.8 更新至 1.0.10，请使用 1.0.10 发行版的维护 ZIP 包。在停播时选择现有安装并核对当前版本和目标版本。

受支持的升级保留服务器 UUID、房间及历史、密码、域名、TLS 材料和网络设置。成功后删除临时迁移副本和旧的专属发行版，**不会保留永久自动备份**；失败时保留所需恢复依据。成功后点击**打开服务器面板**，并刷新导播及嘉宾页面。

**删除。** 默认选择**删除前保留可恢复归档**。选择安装文件夹之外的位置并点击**删除**，工具会先创建并验证新的归档文件夹，再删除服务器。也可明确选择**永久删除服务器和数据**。确认对话框标明所选服务器及是否保留归档，取消不会开始操作。

恢复归档是包含 `bundle.json`、完整 `distribution.tar` 导出和已保存版本辅助文件的**文件夹**，既不是维护 ZIP，也不是 24 小时统计导出。归档含有密码、密钥及其他凭据，请完整、私密地保存，不要作为普通诊断文件上传；所有文件应保持在一起。

**恢复。** 在同一窗口选择归档文件夹并点击**恢复**。在 `%LOCALAPPDATA%\CastLinkServer` 内选择父文件夹，文件夹对话框会建议新的目标名称。目标文件夹必须尚不存在，不会与其他安装合并。恢复的是已保存版本及其身份、设置；如现有服务器或端口冲突，将拒绝操作。原本不完整的安装恢复后仍为不完整状态，不会声称应用已就绪。

**中断后。** 重新打开同一工具，选择同一服务器并点击**恢复事务**。保留数据，不要手动运行旧快捷方式，也不要用 Install 代替恢复。切换到新版本后，恢复操作修复新版本，不会静默以旧数据替换可能已改变的新数据。无法确认归属的发行版会保留供人工检查。

维护仅作用于所选服务器。其他安装、嵌套文件夹、未知文件和手动保存的导出保持不变，共享 WSL/防火墙设置予以保留。不要将手动删除 AppData、全局 `wsl --shutdown` 或 unregister 命令作为常规维护步骤。

## 图表及服务器所有者权限

**Super Admin** 显示活动/保存房间、连接、caster、CPU、内存、磁盘、网络速率、web 进程
内存/运行时间及可检测服务状态。指标不含参与者身份和密钥，房间管理员没有服务器监控权限。
Windows 将一次性所有者链接保存到私有本地文件；需要时运行 `-Action OwnerAccess`。
Linux 使用：

```bash
sudo python3 /opt/castlink-server/.castlink-package/scripts/linux-compose-setup.py owner-access \
  --state-dir /opt/castlink-server --owner-access-file /root/castlink-owner-access.txt
```

链接仅可使用一次，15分钟后过期，文件权限0600，不将链接打印到日志。
在本地读取并打开，请勿分享。

后台约每 15 秒采样，与浏览器是否打开无关。指标和 CastLink 结构化事件日志保留最近
24 小时，重启后仍然保留，过期记录自动删除。面板支持 1/6/24 小时图表、事件级别筛选及
每页 50 个事件。较长时间范围明确显示区间峰值，标签显示最新原始采样；图表点数有限制。

私有文件 `runtime/server-observability.sqlite` 位于原服务器数据目录，无需额外数据库服务。
数据库/WAL 大小和事件数有上限；事件量大时，旧记录可能在 24 小时之前删除。
不记录密码、cookies、令牌和请求正文。日志包含应用事件及服务可用性变化，并非完整的
操作系统日志。记录失败会明确提示，控制台输出继续工作。

缺失、过期和零值分别显示；CPU/网络速率首次需要等待下一次采样。
WSL 指标表示 Linux 虚拟环境；Docker CPU/内存表示内核主机，磁盘表示数据文件系统，
网络表示 web 容器网络空间，不是所有容器总流量或容器配额。界面明确标注采样范围。
