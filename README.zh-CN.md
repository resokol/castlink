[Русский](README.md) · [English](README.en.md) · **简体中文**

# CastLink

让远程嘉宾通过浏览器接入，为 OBS 或 vMix 提供独立的音视频流。

选择服务器的安装系统：

| 系统 | 安装方式 |
| --- | --- |
| Windows 11 | 完整 **1.0.5-rc.3** 安装程序，无需 Docker Desktop。已发布，仍为预发布版本。 |
| Ubuntu Linux / VPS | 一条 `curl` 命令，稳定版 **1.0.5**。 |

如果只是连接别人的服务器，使用浏览器即可。[Windows 客户端](https://github.com/resokol/castlink/releases/download/client-v1.0.1-079fd0f9d4b1/CastLink-Client-1.0.1-079fd0f9d4b1-setup.exe)是独立应用，不会安装服务器。

## 安装前

- 使用 CastLink 时，服务器电脑必须保持开机。
- 公网使用需要域名或公网 IPv4。将域名的 DNS **A** 记录指向服务器；Windows 还需要把 `turn.你的域名` 指向同一 IP。
- 如果经过路由器，请转发 **TCP 80、443、7881；UDP 3478、7882、30000–30031** 到服务器。VPS 防火墙也要放行这些端口。安装程序不会配置 DNS 或路由器。
- 局域网测试可以使用本地 IPv4，但客户端设备需要信任服务器的本地 HTTPS 证书。
- 如果使用 CGNAT，仅端口转发不够。请向网络运营商申请公网 IPv4，或使用 Ubuntu VPS。

## Windows 11 服务器

需要 **Windows 11 x64 22H2/build 22621 或更高版本**、已启用虚拟化和互联网连接。安装程序使用 WSL 2，无需手动安装 Docker Desktop、Node.js 或 PostgreSQL。

### 0. 准备 WSL

**以管理员身份打开 PowerShell**：

```powershell
wsl --version
```

如果尚未安装 WSL，执行 `wsl --install --no-distribution`，然后**重启 Windows**。之后（或已有 WSL 时）执行：

```powershell
wsl --update
wsl --version
```

需要 WSL **2.4.13+**。如要求重启，请先重启；如有错误，先解决再继续。无需单独安装 Ubuntu。

从 Docker 迁移时，请停止旧 CastLink 服务器并退出 Docker Desktop。保留旧数据，安装程序不会自动迁移。

### 1. 下载

**[下载 install-server-windows.ps1](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.5-rc.3-95ec46463c82/install-server-windows.ps1)**

安装程序会自动下载服务器文件，无需单独下载补丁或源码压缩包。

### 2. 运行

打开下载文件所在文件夹，在文件资源管理器地址栏输入 `powershell` 并按回车，然后执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1
```

请使用上面的命令启动，不要双击文件。

**如果脚本要求重启：**提示 `Shared WSL settings saved. Restart Windows...` 表示已保存新的网络设置。即使安装 WSL 后重启过，也请**保存工作并再次重启 Windows**。然后**在同一文件夹中**打开 PowerShell，重复上面的命令以继续安装。无需删除文件。

### 3. 回答提示

对于 `[y/N]`，输入 `y` 并按回车表示同意；直接回车表示拒绝。部分问题只在首次安装时出现。

| 提示或步骤 | 操作 |
| --- | --- |
| 安装 WSL 组件 | 输入 `y`，确认 Windows 权限提示。如要求重启，重启后再次运行同一命令。 |
| Public hostname or IPv4 address | 输入自己的域名或 IPv4，**不要包含** `https://`、端口或路径。`meet.example.com` 只是示例。 |
| 添加 `networkingMode=mirrored` 和 `hostAddressLoopback=true` | 这是 WSL 网络设置。专用服务器电脑可输入 `y` 同意。如要求重启 WSL/Windows，请重启电脑后重新运行。安装程序不会停止其他正在运行的 WSL 系统。 |
| 添加防火墙规则 | 输入 `y`，确认 Windows 管理员权限提示。 |
| 使用域名时的媒体 IPv4 | 填写参与者可访问的服务器 IPv4：互联网使用公网地址，局域网测试使用本地地址。 |
| 创建房间密码及确认 | 设置并保存独立密码，再次输入确认。输入字符不会显示。 |
| 信任服务器证书 | 仅信任自己的服务器证书。其他参与设备也需要信任本地证书。 |
| 登录 Windows 时启动 | `y`：在**当前用户登录**时启动；`n`：手动启动。 |

下载和准备可能需要几分钟，请勿提前关闭窗口。如果要求重启，请重新运行**同一个安装程序**以继续安装。

### 4. 检查结果

安装成功后打开 **CastLink Server** 面板。等待运行状态，然后点击 **Open CastLink**（打开 CastLink），使用刚设置的密码创建房间。

面板提供启动、停止、统计信息和 **24 小时 ZIP 导出**。关闭窗口会隐藏到系统托盘；停止服务器请点击 **Stop services**。请用另一台设备测试；验证公网访问时，可用手机移动网络。

**版本状态：** **1.0.5-rc.3** 现已发布，仍为预发布版本。已有服务器应使用下方维护工具，请勿覆盖安装其数据。[发布页面](https://github.com/resokol/castlink/releases/tag/server-wsl-v1.0.5-rc.3-95ec46463c82) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.5-rc.3-95ec46463c82/SHA256SUMS)。

### 更新、删除或恢复 WSL 服务器

1. 下载[维护 ZIP 包](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.5-rc.3-95ec46463c82/CastLink-Server-WSL-Maintenance.zip)，解压并双击 **CastLink-Maintenance.cmd**。新面板的**维护**按钮打开同一工具；旧版 1.0.5-rc.1 需要单独下载 ZIP。
2. 按地址和文件夹选择服务器，再选择目标版本 **1.0.5-rc.3**。点击**检查**，核对当前版本、目标版本及磁盘空间，再点击**更新**。更新会中断服务，请避开直播时段。确认对话框中显示的服务器，无需手动输入校验值或 WSL 标识。
3. 删除时选择**删除前保留可恢复归档**或**永久删除服务器和数据**，再点击**删除**。保存的归档是包含完整导出和恢复辅助文件的**文件夹**，不是统计 ZIP。它含有凭据，请完整、私密地保存。
4. **恢复**使用此归档文件夹，以及 `%LOCALAPPDATA%\CastLinkServer` 下尚不存在的新安装文件夹。操作中断后，选择同一服务器并点击**恢复事务**。成功后使用**打开服务器面板**。

支持的升级来源为 `server-wsl-v1.0.5-rc.1-085b087a2458` 和 `server-wsl-v1.0.5-rc.2-af3e309d0926`。受支持的更新保留房间、历史、密码、地址和证书；成功后不会保留永久自动备份。不支持从 Docker 迁移数据。[详细说明](distribution/docs/zh-CN/SERVER_INSTALL.md) · [SHA256SUMS](https://github.com/resokol/castlink/releases/download/server-wsl-v1.0.5-rc.3-95ec46463c82/SHA256SUMS)。

## Ubuntu Linux 服务器

支持 **Ubuntu 22.04 / 24.04，x86-64/amd64**。通过 SSH 使用具有 `sudo` 权限的用户登录。

### 1. 执行一条命令

```bash
curl -fsSL https://github.com/resokol/castlink/releases/download/linux-v1.0.5-732ad5fe7006/install-server.sh | sudo bash -s -- --install-runtime --lang zh-CN
```

固定版本 **1.0.5** 安装程序会校验服务器压缩包，安装所需的 Docker Engine/Compose 和 Python，并将安装保存在 **`/opt/castlink-server`**。

如果提示没有 `curl`，先运行以下命令，再重新安装：

```bash
sudo apt-get update && sudo apt-get install -y curl
```

### 2. 回答提示

| 提示 | 输入内容 |
| --- | --- |
| `sudo` 密码（如有） | Ubuntu 用户的系统密码，输入不可见。 |
| 服务器外部地址 | 完整地址，如 `https://meet.example.com` 或 `https://你的IP`。请替换成自己的地址。需要其他设备访问时，**不要保留 `127.0.0.1`**。 |
| 媒体 IPv4（如有） | 可访问的服务器 IPv4。无法明确确定时才会询问。 |
| 创建房间密码及确认 | 新的独立密码，长度 **8–256 个字符**。这不是 SSH/sudo 密码。输入不可见，请保存。 |

快速模式自动选择端口和 HTTPS 模式。本地地址使用本地证书，需要在参与者设备上另行配置信任。

### 3. 等待启动

出现以下两行才表示安装完成：

```text
CastLink setup completed: https://你的地址
Installation: /opt/castlink-server
```

用浏览器打开显示的地址，使用设置的密码创建房间，并从另一台设备测试连接。

### 4. 管理服务器

检查状态：

```bash
sudo python3 /opt/castlink-server/.castlink-package/scripts/linux-compose-setup.py status --state-dir /opt/castlink-server --lang zh-CN
```

将 `status` 改为 `start` 可启动服务器。停止并保留数据：

```bash
sudo docker compose -f /opt/castlink-server/compose.json stop
```

重新执行 `curl` **不会更新**已完成的安装。更新时，将上述命令中的 `status` 改为 `update`，保留原数据目录，并在非直播时执行。完成后刷新导播和嘉宾页面。

## 常见问题

| 问题 | 检查方法 |
| --- | --- |
| Windows 要求重启，或提示 WSL 正在运行 | 保存工作后重启电脑，再运行同一个安装程序。不要删除已安装的系统或数据。 |
| 乱码错误包含 `wsl.exe --install` | 可能是 WSL 输出解码错误。检查 `wsl --version`，并按照上面的 WSL 准备步骤操作。行号 742 是报告错误的位置，不是原因。 |
| 虚拟化不可用 | 在 BIOS/UEFI 中启用 Intel VT-x / AMD-V。 |
| 地址无法打开 | 检查 IP、DNS A 记录、服务状态、防火墙和端口转发。Windows 域名还需检查 `turn.你的域名`。 |
| 网页能打开但没有音视频 | 检查媒体 IPv4 和前文列出的 UDP 端口。仅 TCP 443 可用并不代表媒体连接正常。 |
| 局域网证书警告 | 在每台客户端设备上信任自己服务器的**公共根证书**，不要关闭 TLS 验证。[Linux 证书导出](distribution/docs/zh-CN/LINUX_MANUAL.md)。 |
| 端口被占用或存在其他安装 | 使用相同端口前先停止冲突服务，保留其数据。 |

Linux 诊断：

```bash
sudo docker compose -f /opt/castlink-server/compose.json ps
sudo docker compose -f /opt/castlink-server/compose.json logs --tail 100
```

## 更多

- [网站](https://castlink.ru) · [用户手册](distribution/docs/zh-CN/GUIDE.md) · [发布版本](https://github.com/resokol/castlink/releases) · [更新记录](CHANGELOG.md)。
- 旧版 Docker/SSH 工具 `EasySetup.exe` 是[另一种安装方式](distribution/docs/zh-CN/INSTALL.md)，以上 Windows 安装不需要它。
- 开发资料：[CONTRIBUTING](CONTRIBUTING.md)、[项目指南](docs/PROJECT_GUIDE_RU.md)、[技术约束](docs/CRITICAL_INVARIANTS_RU.md)。安装已打包服务器无需克隆 Git 或编译源码。
- [报告问题](https://github.com/resokol/castlink/issues) · [安全](SECURITY.md) · [联系或支持作者](https://t.me/sklvmax)。

项目代码使用 [MIT](LICENSE)；第三方组件保留各自许可证：[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。旧 Client `f6c47a27a62c` 和 Server Setup/Linux `d703726cd50b` 包仍适用其内附的 Freeware Distribution License 1.1，当前 MIT 许可证不会改变旧包内容。
