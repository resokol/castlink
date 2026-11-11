# 服务器安装与监控

[Русский](../../SERVER_INSTALL.md) · [English](../en/SERVER_INSTALL.md) · [简体中文](SERVER_INSTALL.md)

Linux 加载脚本、24 小时服务器图表历史与事件日志包含在 **1.0.2** 中。[软件包及校验和](PRODUCTS.md) · [发行说明](RELEASE_NOTES_1_0_2.md)。普通 Windows 本地 Server Setup 1.0.2 使用 Docker Desktop；下方无 Docker 的 Windows/WSL2 仍为独立候选版，尚未完成安装及外部媒体通话验证。

## Ubuntu Linux

支持 Ubuntu22.04/24.04 amd64。Linux 版本提供独立 `install-server.sh`，固定版本及
压缩包 SHA256。使用以下 1.0.2 的准确下载地址，不使用全局 `releases/latest`：

```bash
curl -fsSL https://github.com/resokol/castlink/releases/download/linux-v1.0.2-78327495ead0/install-server.sh | sudo bash -s -- --install-runtime --lang zh-CN
```

**linux-v1.0.2-78327495ead0** 安装器询问服务器地址及创建房间密码，
将软件包和配置保存在 `/opt/castlink-server`，载入附带镜像并运行现有 Linux 安装流程。
`--install-runtime` 允许安装依赖及启动 Docker；不加此参数则需要可用的 Docker/Compose。
DNS、路由器端口转发及外部防火墙由管理员配置。[端口与模式](LINUX_MANUAL.md)。

再次运行保留数据、UUID、密钥及当前版本，不自动更新或重启已完成的安装。
显示的保存地址不代表最新健康检查，请使用已保存工具的 `status` 命令。
自定义目录须每次使用相同的绝对 `--state-dir`。无人值守安装支持 `--config` 和
`--room-creation-password-file`（UTF-8，末尾不换行）。

## 无 Docker 的 Windows/WSL2 候选版 — 尚未验证

需要 Windows11 x64 build22621+、WSL2 版本2.4.13+ 及虚拟化。
独立 `server-wsl-v…` 通道提供 `install-server-windows.ps1` 和预构建 Ubuntu 服务器系统。
用户不需要 Docker Desktop/Engine、源码编译或手动安装 Node/PostgreSQL。
这是 WSL 服务器，并非原生 Windows 服务。发布后下载所选版本的脚本，核对 `SHA256SUMS`，
然后在 PowerShell 中运行：

```powershell
& .\install-server-windows.ps1 -Action Install
```

安装器询问地址和密码，验证 rootfs SHA256，仅创建其专属发行版。
首次启用 WSL 可能需要管理员同意及重启；重启后再次运行相同命令，不自动重启。
现有发行版、冲突端口和设置保持不变。Mirrored networking 是 WSL 共享设置，修改需要同意。
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
