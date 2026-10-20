[Русский](../../README.md) · [English](../en/README.md) · **简体中文**

## 20.10.2026 · 1472cd052d7e · 主播工作区与控制窗口修复

- Windows 原生面板遵循 CastLink 所选主题，屏幕来源选择器支持浅色和深色主题。
- 主播画廊利用可用宽度，聊天栏缩窄15%，控制按钮居中。仅观看演播室时保留本地摄像头预览；全屏画面在空闲时隐藏控制元素。
- 工作人员可删除尚未绑定到插槽的独立邀请，已关联的永久输出链接保持可用。
- 未设置麦克风配置时默认使用原始音频，不启用降噪或回声消除。明确保存的语音配置保持不变。
- 多画面裁剪仅遮罩边缘，不移动、缩放或改变来源比例。
- 浏览器浮动面板新增“紧凑尺寸”按钮。浏览器恢复较大窗口时可点击恢复；共享窗口尺寸计入独立的停止区域。初始窗口尺寸仍可能由浏览器决定。

请更新服务器和 Windows 客户端。完全退出旧客户端后运行新的 EXE；EXE 不会自动更新。请在非直播期间手动刷新页面。更新自己的服务器前请备份并结束连接。EXE 未签名。尚未单独实测实体 PowerPoint、设备及完整直播。

保留隔离的 PPTX 转换器、原有限制与服务器权限。以及其他细微调整。

## 20.10.2026 — 合并版本：PPTX、紧凑槽位与 Windows 控制 · 1472cd052d7e

常规 PPTX 通过隔离转换器转换为 PDF，支持常见 SVG、图表和链接。主播槽位采用紧凑行布局，显示状态并支持快速复制链接。Windows 控制菜单不会遮挡 STOP，停止失败时会完整显示错误并允许重试。

请一起更新服务器与 Windows 客户端。完全退出旧客户端后再运行新的 EXE；EXE 不会自动更新。更新自有服务器前请备份并结束连接。请在直播之外手动刷新页面。EXE 未进行数字签名。

PDF/PPTX 以静态页面显示，版式取决于可用字体。本模式不支持动画、视频与密码保护文档。

[easy-setup-1472cd052d7e](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-1472cd052d7e) · [PDF/PPTX 共享与翻页控制](PRESENTATIONS.md) · [更新日志](CHANGELOG.md)

## 20.10.2026 — 新入口、网站浮动面板与 PR60/PR61 摄像头设置 · 1de5b686d719

已包含 PR61：简洁的演播室/主播入口，以及明确连接前的姓名与设备检查。邀请提供 Windows 应用或浏览器选项；新客户端注册 castlink:，替换已连接房间前要求确认。来宾无需演播室访问令牌；服务器仍验证邀请和来宾权限。

可拖动标题在页面内移动幻灯片控制面板。支持的 Chrome/Edge 可通过“置于其他窗口上方”打开 Document Picture-in-Picture；API 不可用或被拒绝时仍可在页面内控制。停止共享与幻灯片占用同一窗口中的独立区域；关闭面板不会停止共享。

已包含 PR60：演播室、房间管理员和版主可在来宾卡片中设置摄像头尺寸与 FPS。服务器设置优先，保留快速720/1080和默认1080。实际尺寸取决于设备和浏览器；该设置不会开启已关闭的摄像头，也不会更改麦克风或屏幕共享。

保留统一界面、演示文稿、Windows 原生面板、高质量 OBS/vMix 输出及新版 Windows/Linux 安装程序。请完全退出旧客户端后手动下载并运行新版本；未包含 EXE 自动更新。请在非直播期间刷新网站页面。尚未实测 PowerPoint 的全屏与焦点行为；浏览器浮窗通过窗口边框移动。

更新服务器前请备份并结束连接。EXE 未进行数字签名。可选第三方源码归档用于满足许可证要求，正常运行无需下载。

以及其他细微调整。

## 20.10.2026 — 摄像头与浏览器输出 · 1de5b686d719

演播室、房间管理员或版主可将演播者摄像头目标分辨率设为 720/1080。默认请求 1080；实际尺寸取决于摄像头和浏览器，并单独显示。设置仅作用于当前摄像头，重新连接后仍保留。

OBS/vMix 浏览器输出请求源的最高可用视频层，并保留摄像头缩放、平移、旋转、裁剪和镜像。屏幕共享仍是独立来源。本版本保留统一界面、演示文稿、Windows 客户端和新版 Windows/Linux 安装程序。

请在非直播期间重新加载演播室、演播者及 vMix 浏览器输入页面。此 Web 修复无需更换 EXE；本次仍提供重新构建的客户端安装包。更新服务器前请备份并结束所有连接。

以及其他细微调整。

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

- 保留最近 24 小时的房间聊天历史，返回时恢复，并可在统计页面下载文本文件。嘉宾聊天的长对话在窗口内滚动，输入框和发送按钮保持可见。
- 演播室、管理员和版主拥有独立聊天标签页，可自行设置新消息计数的显示，并在确认后清空整个房间的聊天历史。
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

## Windows 客户端与统一版本

此版本整合当前服务器、新的 Linux 安装工具和独立 Windows 客户端。

[安装客户端](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Client-1.0.0-rc.3-1472cd052d7e-setup.exe) · [便携客户端](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-1.0.0-rc.3-1472cd052d7e-Windows.exe) · [客户端 ZIP](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Client-1.0.0-rc.3-1472cd052d7e-win-x64.zip)

客户端连接已有服务器，支持演示文稿及所有者/接收者独立浮动控制面板。运行新版前请完全退出旧版。客户端尚不支持 EXE 自更新；服务器更新操作会打开服务器安装向导。

更新演播者和聊天布局，完整画面适配、PPTX 内嵌字体、流式上传及远程翻页。保留快速/高级安装、代理模式和独立 Linux 工具，并提供单独的创建房间密码设置。

服务器请选择 CastLink-Windows.zip 或 CastLink-Linux.tar.gz。已连接 VPS 的更新仅替换 Web 应用，不能更新协调服务器自身。Linux 工具仅更新其创建的安装。服务器维护前请结束直播并备份。

CastLink-ThirdParty-Sources.tar.gz 和 CastLink-ThirdParty-Office-Sources.tar.gz 为可选源码归档，安装无需下载。Windows 客户端尚未签名；SHA256SUMS 包含全部下载的校验值。

## 新安装程序：快速安装或自定义网络

[easy-setup-31a402442fe1](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-31a402442fe1) 增加了**快速 / 高级**安装选项。快速模式保留常规 HTTPS；高级模式可选择 HTTP、直接 HTTPS 或外部 HTTPS 反向代理，并分别设置网站与媒体的地址和端口。向导和独立 Linux 辅助程序支持 RU / EN / 简体中文。

Linux 现在无需 Windows 即可安装：`scripts/linux-compose-setup.py` 提供 `init`、`start`、`status`、`backup` 和 `update`，保留独立配置目录、UUID、密钥及卷名称。它只管理自身创建的安装，不接管 Windows 向导或旧版部署。

[模式、反向代理与备份](INSTALL.md) · [新 Linux 辅助程序与单独保留的旧版指南](LINUX_INSTALL.md)。通过 LAN/公网 IP 使用普通 HTTP 无法提供摄像头、麦克风和屏幕共享所需的浏览器安全上下文；远程参与者应使用受信任的 HTTPS。网站代理不能替代媒体端口。

## 下载

| 平台 | 安装包 | 指南 |
| --- | --- | --- |
| Windows 10/11 x64 | [CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Windows.zip) | [安装与使用](GUIDE.md#在-windows-上安装) |
| Ubuntu 22.04/24.04 amd64 | [CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/latest/download/CastLink-Linux.tar.gz) | [直接在 Linux 上安装](LINUX_INSTALL.md) |

[最新版本](https://github.com/resokol/castlink-releases/releases/latest) · [更新内容](CHANGELOG.md) · [校验和](https://github.com/resokol/castlink-releases/releases/latest/download/SHA256SUMS)

**更新常规安装前：**请在服务商、防火墙和路由器上允许 UDP 7882，保留 TCP 80/443/7881、UDP 3478 和 UDP 30000–30031。新安装程序会重新创建 LiveKit，保留数据但中断媒体连接。工作室中的备用服务器更新按钮仅更换 web，不会迁移端口。[更新步骤](GUIDE.md)。

请从同一版本下载安装包和 `SHA256SUMS`。新独立 Linux 辅助程序请使用[当前说明](LINUX_INSTALL.md)；旧版固定 8b02 流程单独标为 legacy。目前尚未发布 macOS 安装包。

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
