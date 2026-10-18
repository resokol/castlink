[Русский](../../README.md) · [English](../en/README.md) · **简体中文**

<p align="center">
  <a href="https://castlink.ru"><img src="../../assets/castlink-logo.svg" width="112" height="112" alt="CastLink 标志"></a>
</p>

<h1 align="center">CastLink</h1>
<p align="center"><strong>CastLink 1.0.0-rc.3 · 构建 776AF9</strong></p>
<p align="center"><strong>远程 caster。独立信号源。您的直播。</strong></p>
<p align="center">通过浏览器连接 · OBS 和 vMix · 自有服务器</p>
<p align="center">
  <a href="https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip"><strong>下载 Windows 版</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz"><strong>下载 Linux 版</strong></a>
</p>
<p align="center">
  <a href="https://castlink.ru">网站</a> &nbsp; / &nbsp;
  <a href="GUIDE.md">使用指南</a> &nbsp; / &nbsp;
  <a href="CHANGELOG.md">更新内容</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax">联系作者</a> &nbsp; / &nbsp;
  <a href="SUPPORT.md"><strong>♡ 支持 CastLink</strong></a>
</p>

---

免费的直播远程连接系统。caster（远程嘉宾）在浏览器中打开链接，演播室即可在 OBS、vMix 或其他导播软件中，将其音视频作为独立信号源接收。服务器可运行在您的 Windows 电脑或 Linux VPS 上。

- 演播室、管理员和版主拥有独立聊天标签页，并可自行设置新消息计数的显示。
- 为 OBS/vMix 提供固定槽位输出，嘉宾正常入场，并在加入房间前自动检查摄像头与麦克风。
- 实验性多画面，提供用于 OBS/vMix 的独立透明输出。
- 新邀请的默认设置，以及自动保存的嘉宾取景调整。
- 工作室侧栏中独立的备用服务器项目。
- 紧凑的 caster 卡片，显示麦克风电平和主要连接统计信息。
- 浏览器支持时，可选择 VP8、H.264 或 AV1 作为 caster 视频编码。
- 演播室可请求更换设备，并由 caster 确认。
- 每位 caster 的视频流和音频流均独立提供。
- 通过 `/watch` 链接观看演播室直播。
- 手动迁移房间，以及可配置的自动备用切换。
- 提供连接统计信息，帮助诊断网络问题。
- 界面支持俄语、英语和简体中文。

**目前处于公开测试阶段。** 正式直播前，请使用自己的设备检查音视频设备、网络和备用切换。

## 下载

| 平台 | 安装包 | 指南 |
| --- | --- | --- |
| Windows 10/11 x64 | [CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip) | [安装与使用](GUIDE.md#在-windows-上安装) |
| Ubuntu 22.04/24.04 amd64 | [CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz) | [直接在 Linux 上安装](LINUX_INSTALL.md) |

[最新版本](https://github.com/resokol/castlink-releases/releases/latest) · [更新内容](CHANGELOG.md) · [校验和](https://github.com/resokol/castlink-releases/releases/latest/download/SHA256SUMS)

**更新前：**请在服务商、防火墙和路由器上允许 UDP 7882，保留 TCP 80/443/7881、UDP 3478 和 UDP 30000–30031。新安装程序会重新创建 LiveKit，保留数据但中断媒体连接。工作室中的备用服务器更新按钮仅更换 web，不会迁移端口。[更新步骤](GUIDE.md)。

请从同一版本下载安装包和 `SHA256SUMS`。Linux 安装指南对应一个已检查包内容的特定版本，请使用指南中的链接。目前尚未发布 macOS 安装包。

## 开始使用

1. 安装服务器。在 Windows 上完整解压压缩包，然后运行 `EasySetup.exe`。Linux 请参阅[专用指南](LINUX_INSTALL.md)，或[通过 Windows 向导使用 SSH 安装](GUIDE.md#通过-windows-在-linux-vps-上安装)。
2. 打开 CastLink，创建演播室，然后通过链接邀请 caster。
3. 将各 caster 的独立输出添加到 OBS/vMix，并在您熟悉的软件中制作直播。

只有服务器需要 Docker。caster 只需要浏览器、HTTPS，以及摄像头和麦克风权限。

## 文档与帮助

- [完整指南：设备、网络、备用切换与更新](GUIDE.md)
- [不使用 Windows 和图形向导安装 Linux 版](LINUX_INSTALL.md)
- [更新日志](CHANGELOG.md)
- [向作者报告问题](https://t.me/sklvmax)
- [项目网站](https://castlink.ru)

报告错误时，请注明构建版本、操作系统、浏览器、发生时间和复现步骤。请勿公开发送密码、令牌和个人访问链接。

## 支持项目

如果 CastLink 为您的直播提供了帮助，欢迎通过 SBP 或加密货币[支持项目开发](SUPPORT.md)。感谢您的帮助！

## 作者与使用条款

作者： [Telegram 上的 @sklvmax](https://t.me/sklvmax) · [GitHub 上的 resokol](https://github.com/resokol)。

可免费使用。注明作者后，可分发未经修改的构建版本；修改须经作者许可。完整条款以 [LICENSE 英文原文](../../LICENSE) 为准；另提供[简体中文参考译文](LICENSE.md)。第三方组件有各自的许可证，详见 [THIRD_PARTY_NOTICES 英文原文](../../THIRD_PARTY_NOTICES)及其[简体中文参考译文](THIRD_PARTY_NOTICES.md)。

此仓库包含已构建的发布版本和文档。发布页 Assets 中的 `CastLink-ThirdParty-Sources.tar.gz` 用于履行第三方组件许可证要求，安装时无需下载。请下载上表中对应平台的安装包。


---

[配置 TCP 443 上的 TURN/TLS](TURN_TLS.md)

## 服务器责任

部署和管理服务器的个人或组织负责服务器的运行、配置、安全、访问控制、备份，以及依法处理数据和内容。用户仍须对自己的行为和内容负责。提供 CastLink 软件本身并不意味着作者是这些服务器的托管方或运营方。本条款不排除法律规定不得排除的责任。

[完整许可条款](../../LICENSE)
