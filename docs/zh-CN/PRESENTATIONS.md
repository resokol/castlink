[Русский](../../PRESENTATIONS.md) · [English](../en/PRESENTATIONS.md) · **简体中文**

# 演示文稿：PDF 与 PowerPoint

[CastLink 使用指南](GUIDE.md) · [更新日志](CHANGELOG.md)

**“演示文稿”**位于主播页面。主播可在自己的电脑上打开演示文稿，并让同一房间中选定的另一位主播切换幻灯片。所有者也可自行切换、收回控制权或停止控制。

**幻灯片控制与画面共享需要分别开启。** 要将画面传给导播，请点击“屏幕共享”，在浏览器的系统选择窗口中选择 PDF 标签页或 PowerPoint 放映窗口。这是常规浏览器 `getDisplayMedia` 捕获，需要在您自己的电脑上授权。辅助程序不会开启屏幕捕获、摄像头或麦克风。

## 在浏览器中使用 PDF

1. 更新房间所在服务器，并在非直播状态下重新打开主播页面。
2. 在“演示文稿”中选择**“在此电脑上打开 PDF”**。最大文件大小为 **100 MB**。文件在浏览器本地处理，不会上传服务器。
3. 检查页面。“全屏”可放大查看；共享此标签页需要单独开启。
4. 点击**“允许控制 PDF”**，选择另一位已连接的主播，再点击**“交出控制权”**。对方会看到上一页和下一页按钮。
5. 完成后使用**“收回控制权”**或**“停止演示文稿控制”**。停止控制不会停止屏幕共享，请另行停止共享。

此功能传递页面控制和演示文稿状态，不传递 PDF 文件本身。另一位主播不会通过此功能收到文件。文档名称会显示在演示文稿状态中。

## PowerPoint：实验性辅助程序

演示文稿所有者的电脑须安装**桌面版 Microsoft PowerPoint**。这些辅助程序不针对网页版 PowerPoint 或其他软件。**尚未在 Windows 或 macOS 上使用真正的 PowerPoint 验证；直播前请先在自己的电脑上测试。** PDF 和屏幕共享可独立于辅助程序使用。

1. 启动 PowerPoint 幻灯片放映。
2. 在主播页面点击**“连接 PowerPoint”**。
3. 从**承载房间的同一台已更新 CastLink 服务器**下载适用于您操作系统的辅助程序。不要使用其他安装实例的服务器地址。
4. 在运行 PowerPoint 的电脑上启动辅助程序，输入服务器 HTTPS 地址和主播页面上的一次性代码，并在该电脑上确认允许控制所选放映。
5. 等待状态显示“已连接”，选择已连接的主播并点击**“交出控制权”**。PowerPoint 窗口的屏幕共享须另行开启。

下载地址格式如下。请将 `YOUR-CASTLINK-SERVER` 替换为您的服务器地址；它们不是 GitHub 文档网址：

```text
https://YOUR-CASTLINK-SERVER/helpers/CastLink-PowerPoint-Windows.ps1
https://YOUR-CASTLINK-SERVER/helpers/CastLink-PowerPoint-macOS.js
```

### Windows

请使用 **Windows PowerShell 5.1**，不要使用 PowerShell 7。将文件保存到“下载”文件夹，然后运行：

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "$HOME\Downloads\CastLink-PowerPoint-Windows.ps1"
```

`-ExecutionPolicy Bypass` 仅用于此次启动。按提示选择已开始放映的编号，输入 `YES` 确认，并保持窗口开启。`Ctrl+C` 可停止辅助程序。

### macOS

将文件保存到“下载”文件夹，在终端中运行：

```bash
osascript -l JavaScript "$HOME/Downloads/CastLink-PowerPoint-macOS.js"
```

请保持**恰好一个** PowerPoint 放映开启。如果 macOS 请求自动化控制 PowerPoint 的权限，请允许，以便辅助程序切换所选放映。完成后关闭辅助程序，或在 CastLink 中停止控制。

## 有效期、停止与重新连接

- 连接代码仅可使用一次，有效期为 **120 秒**。代码过期或已使用后，请创建新连接。
- 控制会话自创建起最长持续 **30 分钟**。到期后请重新连接。PDF 控制采用相同时间限制，但打开本地 PDF 后无需手动输入代码。
- 仅可切换**上一张／下一张幻灯片或上一页／下一页**。不提供光标控制、文本输入、任意按键或任意电脑文件访问。
- 连接中断、所有者离开、放映更换或服务器重启后，可能需要重新创建连接。旧命令不应重复执行；请等待切换确认后再发送下一条命令。
- **“停止演示文稿控制”**会撤销控制权。画面共享请使用单独的屏幕共享按钮停止。不要向无关人员提供代码。

首次连接时的回声问题仍未解决。macOS 上的 Yandex Browser 和 Wirecast 尚未单独验证。直播前，请在自己的设备上检查音频、窗口捕获及接收软件。
