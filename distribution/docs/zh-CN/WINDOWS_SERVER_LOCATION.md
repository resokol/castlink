[Русский](../../WINDOWS_SERVER_LOCATION.md) · [English](../en/WINDOWS_SERVER_LOCATION.md) · [简体中文](WINDOWS_SERVER_LOCATION.md)

# Windows/WSL2 服务器目录 — 下一版本草案（next release draft）

**本文是下一版本的文档草案，不适用于已发布的 1.0.7。** 计划版本为 Windows/WSL2 Server **1.0.8** 和 CastLink Updater **1.0.1**；两者尚未发布。选择安装目录和迁移需要明确支持这些功能的版本，请以官方发行说明为准。首次配置更新工具和常规更新请参阅 [CastLink Updater 指南](UPDATER.md)。

## 选择存储位置

请选择可用本地 **NTFS** 磁盘上的专用目录，例如 `D:\CastLink\Server 2`。支持空格、西里尔字母和盘符固定的外接 NTFS 磁盘。同一 Windows 用户必须能够访问该目录。不支持网络/UNC 路径、FAT/exFAT、磁盘根目录、系统目录，以及包含符号链接或 junction/reparse point 的路径。不要选择存有其他文件的目录。

安装需要 **WSL 2.4.13 或更高版本**；迁移需要 **WSL 3.0.1 或更高版本**，并支持 `--manage --move`。运行 `wsl --version` 查看版本，必要时运行 `wsl --update`。工具会检查目标磁盘的可用空间：全新安装至少需要 **8 GiB**；迁移需要容纳当前虚拟磁盘、安装文件及额外余量。请为后续数据增长预留空间。

## 安装新服务器

1. 获取支持目录选择的官方发行包。仓库中的源脚本不是可直接安装的发行版安装程序。
2. 开始安装，在 **Installation folder** 提示中输入完整路径。直接按 Enter 保留默认目录 `%LOCALAPPDATA%\CastLinkServer`。
3. 也可以在官方安装包目录中打开 PowerShell，明确传入路径。请将地址替换为自己的服务器地址：

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-server-windows.ps1 -Address meet.example.com -InstallRoot 'D:\CastLink\Server 2' -Lang zh-CN
   ```

4. 按照[安装指南](SERVER_INSTALL.md)完成网络和服务器设置。打开所选目录中的 `CastLinkServer.lnk` 可启动面板。

使用 `-NonInteractive` 且未指定 `-InstallRoot` 时仍采用默认目录。再次运行时更改 `-InstallRoot` 不会迁移现有服务器；请使用以下独立操作。

## 迁移现有服务器

1. 保留独立备份，并安排停机时间：迁移期间服务器将暂时不可用。此操作仅在同一台计算机、同一 Windows 用户下进行。
2. 对于 **1.0.7 服务器，必须先在原位置明确执行常规更新**，升级到支持迁移的版本。还需将 CastLink Updater 更新到支持此功能的版本。**移动服务器…** 本身不会更新产品版本。不要修改旧版固定安装程序。
3. 从服务器面板打开**维护**，或在 CastLink Updater 中选中目标 WSL 服务器并点击**移动服务器…**。核对服务器地址和当前目录，尤其是安装了多个服务器时。
4. 输入一个**尚不存在的新目录**的完整路径，例如 `D:\CastLink\Server 2`。通过浏览选择父目录时，工具会建议一个新名称，可按需修改。目标目录不能位于源目录内部，也不能包含源目录。
5. 点击**移动服务器…**，在确认窗口核对源目录和目标目录，并确认服务中断。保持窗口打开，不要断开磁盘。工具会在停止服务器之前检查 WSL 支持情况、安装归属和可用空间。
6. 等待操作完成。打开新目录中的 `CastLinkServer.lnk`，检查服务器地址和状态，并刷新 Updater 列表。原先运行的服务器应恢复运行；原先停止的服务器应保持停止。

WSL 虚拟磁盘（VHDX）、服务器数据、面板及属于此安装的文件会一同迁移。版本、服务器标识、URL、房间、历史记录、密码、证书、网络设置及登录时自动启动偏好均保留。迁移不是独立备份。后续更新版本的工作目录和 WSL 服务器工作归档将使用所选卷；手动选择的备份归档位置仍由你决定。

少量安装目录索引和操作日志会保留在 `%LOCALAPPDATA%\CastLinkServerRegistry`。旧目录可能留有部分管理文件，这不代表活动 VHD 仍在原磁盘上。确认迁移完成且服务器正常工作之前，不要手动删除这些文件。**在资源管理器中拖动目录不是受支持的迁移方式**，不会更新 WSL、面板或自动启动的路径绑定。

## 断电或磁盘断开后

以原盘符重新连接磁盘，再次打开维护工具。若迁移尚未完成，请选择**恢复事务**；Updater 中也有**恢复事务…**。恢复完成前，常规启动、更新和再次迁移会被阻止。工具会将日志与 WSL 实际位置进行核对，仅在确认数据归属后继续。不要启动第二份副本，也不要删除源目录、目标目录、VHD 或 WSL 注册信息。

外接磁盘断开时，安装会显示为不可用，而不是服务器已删除。重新连接并刷新列表；不要在同一目录创建替代服务器。如果恢复操作报告冲突，请保留日志和错误信息以便排查。在现有数据上重新安装不属于恢复操作。

## 旧版归档

支持自定义位置的版本归档可以恢复到合适的本地 NTFS 磁盘。**包含旧版固定安装程序的归档必须先恢复到 `%LOCALAPPDATA%\CastLinkServer` 下的目录，明确更新服务器，然后再迁移。** 不要修改归档、manifest 或旧安装程序来绕过限制。

[CastLink Updater](UPDATER.md) · [服务器安装和维护](SERVER_INSTALL.md)
