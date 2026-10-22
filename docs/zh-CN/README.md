[Русский](../../README.md) · [English](../en/README.md) · **简体中文**

<p align="center">
  <a href="https://castlink.ru"><img src="../../assets/castlink-logo.svg" width="112" height="112" alt="CastLink 标志"></a>
</p>

<h1 align="center">CastLink</h1>
<p align="center"><strong>CastLink 1.0.0-rc.8</strong></p>
<p align="center"><strong>远程 caster。独立信号源。您的直播。</strong></p>
<p align="center">通过浏览器连接 · OBS 和 vMix · 自有服务器</p>
<p align="center">
  <a href="https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-72b315b2d251/CastLink-Windows.zip"><strong>下载 Windows 版</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-72b315b2d251/CastLink-Linux.tar.gz"><strong>下载 Linux 版</strong></a>
</p>
<p align="center">
  <a href="https://castlink.ru">网站</a> &nbsp; / &nbsp;
  <a href="GUIDE.md">使用指南</a> &nbsp; / &nbsp;
  <a href="CHANGELOG.md">更新内容</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax">联系作者</a> &nbsp; / &nbsp;
  <a href="SUPPORT.md"><strong>♡ 支持 CastLink</strong></a>
</p>

---

Windows Client 为 **1.0.0-rc.8**，构建 `90135013f5b6`；Windows Server 和 Linux Ubuntu 为 **1.0.0-rc.8**，构建 `72b315b2d251`：[软件包与校验和](PRODUCTS.md)。安装包和 `SHA256SUMS` 必须来自同一产品和版本。

移动端竖屏“平铺”采用两列 16:9 布局。聊天提供 24 个表情，历史与导出仍保存普通 Unicode。“反应”提供七种持续两秒的动画并支持减少动态效果；反应不写入聊天或纯净输出。

重新打开同一邀请时，若仍保存有效的签名会话，可恢复原槽位。第二个标签页相互隔离；其入场被拒绝不会清除第一个标签页的会话。过期或撤销的权限不会恢复。

演播室布局更加紧凑：播放与邀请位于左侧，输出流与传输控制位于右侧。宽窗口可容纳五张嘉宾卡片，图表下方四个等大设置以 2×2 排列。窄窗口保留顺序布局。

Windows EXE 没有数字签名。更新需要用户同意，可能重启应用或服务；请安排暂停直播，并自行保存所需数据。用户服务器不会自动创建备份。正式直播前请验证实际设备、PowerPoint 和文档。

免费的直播远程连接系统。caster（远程嘉宾）在浏览器中打开链接，演播室即可在 OBS、vMix 或其他导播软件中，将其音视频作为独立信号源接收。服务器可运行在您的 Windows 电脑或 Linux VPS 上。

- 保留最近 24 小时的房间聊天历史，返回时恢复，并可在统计页面下载文本文件。嘉宾聊天的长对话在窗口内滚动，输入框和发送按钮保持可见。
- 演播室、管理员和版主拥有独立聊天标签页，可自行设置新消息计数的显示，并在确认后清空整个房间的聊天历史。
- 为 OBS/vMix 提供固定槽位输出，嘉宾正常入场，并在加入房间前自动检查摄像头与麦克风。
- 实验性多画面，提供用于 OBS/vMix 的独立透明输出。
- 新邀请的默认设置，以及自动保存的嘉宾取景调整。
- 工作室侧栏中独立的备用服务器项目。
- 紧凑的 caster 卡片，显示麦克风电平和主要连接统计信息。
- 浏览器支持时，主播视频可使用 VP8、VP9、H.264 和 AV1。
- 演播室可请求更换设备，并由 caster 确认。
- 每位 caster 的视频流和音频流均独立提供。
- 通过 `/watch` 链接观看演播室直播。
- 手动迁移房间，以及可配置的自动备用切换。
- 提供连接统计信息，帮助诊断网络问题。
- 界面支持俄语、英语和简体中文。

**目前处于公开测试阶段。** 正式直播前，请使用自己的设备检查音视频设备、网络和备用切换。


主播界面提供“窗口”和“平铺”视图。桌面端“窗口”模式的垂直分隔条可调整主摄像头或屏幕与右侧列表的尺寸；有多个信号源时支持指针和键盘操作。嘉宾列表独立滚动，视频比例保持不变。移动端没有分隔条，保留紧凑控件和“更多”菜单。屏幕共享按钮为薄荷绿，共同演示按钮为蓝色。

新建演播室请求 H.264、10,000 kbit/s 和 60 FPS；未保存编码选择的主播使用 H.264。明确保存的设置不变，也不会提高主播的码率或 FPS。浏览器支持时可使用 VP8、VP9、H.264 和 AV1；界面显示所选及实际协商的编码。请求参数不保证实际测得的质量。
## Windows 客户端与独立服务器安装包

如果原生 Windows 面板仍显示旧控制文字，请更新 Client：F10 →“检查更新”，或手动下载新安装程序。没有更新检查功能的旧版本请手动替换。更新服务器不会替换 EXE；请先结束直播。EXE 没有数字签名。

Windows Client 用于让演播室或出镜者连接已有服务器。Server Setup 和 Linux 用于安装自己的服务器，并分别发布。

[安装客户端](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-Client-1.0.0-rc.8-90135013f5b6-setup.exe) · [便携客户端](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-1.0.0-rc.8-90135013f5b6-Windows.exe) · [客户端 ZIP](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-Client-1.0.0-rc.8-90135013f5b6-win-x64.zip)

客户端连接已有服务器，并分别检查客户端渠道与已保存的受管理服务器。可手动检查或关闭自动检查。下载会验证 SHA256；关闭客户端并安装新版还需要单独同意。没有内置更新检查功能的旧客户端需要手动替换；更新服务器不会替换客户端 EXE。

更新演播者和聊天布局，完整画面适配、PPTX 内嵌字体、流式上传及远程翻页。保留快速/高级安装、代理模式和独立 Linux 工具，并提供单独的创建房间密码设置。

服务器使用 CastLink-Windows.zip 或 CastLink-Linux.tar.gz。已保存的受管理 VPS 通过 Windows 向导更新，必要时提供 SSH 访问；普通连接地址不授予更新权限。新演示功能需要使用对应的完整服务器软件包同时更新 web 和转换器。Linux 工具只管理自身创建的安装。更新前请结束直播。

CastLink-ThirdParty-Sources.tar.gz 和 CastLink-ThirdParty-Office-Sources.tar.gz 为可选源码归档，安装无需下载。Windows 客户端尚未签名；每个版本的 SHA256SUMS 仅包含该版本文件的校验值。

## 新安装程序：快速安装或自定义网络

rc.8 默认使用快速模式。需要技术选项时，在 Windows 向导中明确启用**高级设置**；独立 Linux CLI 使用 `--advanced`。快速模式使用标准 HTTPS 和默认端口。高级模式支持 HTTP、直接 HTTPS 或外部 HTTPS 代理，以及网站和媒体的地址与端口设置。向导和 Linux CLI 支持 RU / EN / 简体中文。请参阅[安装模式与配置示例](INSTALL.md)。

Linux 工具 `scripts/linux-compose-setup.py` 支持 `init`、`start`、`status`、`check-updates` 和 `update`，使用原有 `--state-dir`。UUID、密钥、网络与卷名保留；不接管 Windows/旧版安装。`backup` 命令已移除；请自行保存所需数据与配置副本。

[模式、反向代理与备份](INSTALL.md) · [新 Linux 辅助程序与单独保留的旧版指南](LINUX_MANUAL.md)。通过 LAN/公网 IP 使用普通 HTTP 无法提供摄像头、麦克风和屏幕共享所需的浏览器安全上下文；远程参与者应使用受信任的 HTTPS。网站代理不能替代媒体端口。

## 下载

| 平台 | 安装包 | 指南 |
| --- | --- | --- |
| Windows 10/11 x64 | [Windows Client](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/CastLink-Client-1.0.0-rc.8-90135013f5b6-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-90135013f5b6/SHA256SUMS) | Windows 应用：演播室与主播 |
| Windows 10/11 x64 | [CastLink-Windows.zip](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-72b315b2d251/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-72b315b2d251/SHA256SUMS) | [安装与使用](GUIDE.md#在-windows-上安装) |
| Ubuntu 22.04/24.04 amd64 | [CastLink-Linux.tar.gz](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-72b315b2d251/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-72b315b2d251/SHA256SUMS) | [直接在 Linux 上安装](LINUX_MANUAL.md) |

[版本历史](https://github.com/resokol/castlink-releases/releases) · [更新内容](CHANGELOG.md) · [按产品查看校验和](PRODUCTS.md)

**更新常规安装前：**请在服务商、防火墙和路由器上允许 UDP 7882，保留 TCP 80/443/7881、UDP 3478 和 UDP 30000–30031。新安装程序会重新创建 LiveKit，保留数据但中断媒体连接。工作室中的备用服务器更新按钮仅更换 web，不会迁移端口。[更新步骤](GUIDE.md)。

请从同一版本下载安装包和 `SHA256SUMS`。新独立 Linux 辅助程序请使用[当前说明](LINUX_MANUAL.md)；旧版固定 8b02 流程单独标为 legacy。目前尚未发布 macOS 安装包。

## 开始使用

1. 安装服务器。在 Windows 上完整解压压缩包，然后运行 `EasySetup.exe`。Linux 请参阅[专用指南](LINUX_MANUAL.md)，或[通过 Windows 向导使用 SSH 安装](GUIDE.md#通过-windows-在-linux-vps-上安装)。
2. 打开 CastLink，创建演播室，然后通过链接邀请 caster。
3. 将各 caster 的独立输出添加到 OBS/vMix，并在您熟悉的软件中制作直播。

只有服务器需要 Docker。caster 只需要浏览器、HTTPS，以及摄像头和麦克风权限。

## 文档与帮助

- [完整指南：设备、网络、备用切换与更新](GUIDE.md)
- [不使用 Windows 和图形向导安装 Linux 版](LINUX_MANUAL.md)
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
