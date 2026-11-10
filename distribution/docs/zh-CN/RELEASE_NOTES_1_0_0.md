# CastLink 1.0.0

[Русский](../../RELEASE_NOTES_1_0_0.md) · [English](../en/RELEASE_NOTES_1_0_0.md) · 简体中文

CastLink **1.0.0** 稳定版不再使用 RC 标识，包含网页运行时、Windows Client、Windows Server Setup 及独立 Linux。Windows Client 基于源提交 `93d9b93e17daced23b3eb4207c8464d6091bea0c` 构建；Windows Server Setup 和独立 Linux 基于 `1ea894bd94adb96f861398cc30addc93d1bf9d21` 构建。三个产品的准确下载链接及各自的 `SHA256SUMS` 见[软件包目录](PRODUCTS.md)。

## 新增与修复

- 紧凑演播室控制台，包含预览、设备控制、参与者及统计信息。
- 参与者麦克风和摄像头选择菜单、麦克风测试及音频处理设置。
- 修复移动端布局、视频比例、统计图表及多画面编辑器。
- HTTP 会话续期，以及浏览器、连接和音频诊断。

## 更新

请在停播时更新：服务器服务会重启，客户端会关闭以进行安装。请先保存所需的数据及配置备份。

- **Windows Client：**运行内置更新检查。安装程序会先下载并验证，再单独请求同意关闭客户端并安装。如果旧版 Client 无法找到发行版，请从目录中手动下载 1.0.0 安装程序一次，并使用同一发行版的 `SHA256SUMS` 验证其 SHA256。EXE 无数字签名。
- **Windows Server Setup：**完整解压新的 `CastLink-Windows.zip`，运行 `EasySetup.exe`，选择**更新**及原有本地文件夹或同一 VPS。
- **独立 Linux：**使用原有 `--state-dir` 运行 `check-updates` 和 `update`；手动更新时使用新下载并验证的软件包。[更新步骤](LINUX_MANUAL.md#诊断和更新)。此 helper 不接管 Windows 或旧版安装。

更新受支持的现有安装时，数据、设置、UUID、机密和网络配置会保留；创建新安装不等于更新现有安装。此版本无需数据库迁移。服务器更新后，请在停播时刷新演播室及参与者页面，并检查连接、音频、视频及 OBS/vMix 输出。

三个产品具有独立的发布渠道。安装包和 `SHA256SUMS` 必须来自同一产品的同一发行版。旧 RC 归档、内嵌清单、许可证及校验和保持不变。源代码归档并非可直接运行的安装包。

CastLink 自有代码采用 [MIT 许可证](../../../LICENSE)；第三方组件保留各自许可证。
