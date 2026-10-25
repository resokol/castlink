[Русский](https://github.com/resokol/castlink-releases/blob/main/PRODUCTS.md) · [English](https://github.com/resokol/castlink-releases/blob/main/docs/en/PRODUCTS.md) · [简体中文](https://github.com/resokol/castlink-releases/blob/main/docs/zh-CN/PRODUCTS.md)

# CastLink 软件包

| CastLink | 用途 | 下载 |
| --- | --- | --- |
| Windows Client | Windows 应用：演播室与主播 | [1.0.0-rc.8](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-f6c47a27a62c/CastLink-Client-1.0.0-rc.8-f6c47a27a62c-setup.exe) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/client-v1.0.0-rc.8-f6c47a27a62c/SHA256SUMS) |
| Windows Server | Windows 向导：在本地或通过 SSH 在 Linux Ubuntu 上部署自己的服务器 | [1.0.0-rc.8](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/CastLink-Windows.zip) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/SHA256SUMS) |
| Linux Ubuntu | 在 Linux Ubuntu 上独立安装服务器 | [1.0.0-rc.8](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-d703726cd50b/CastLink-Linux.tar.gz) · [SHA256SUMS](https://github.com/resokol/castlink-releases/releases/download/linux-v1.0.0-rc.8-d703726cd50b/SHA256SUMS) |

**[安装手册](LINUX_MANUAL.md)** — 开箱即用与高级设置.

运行前验证所选发行版本的 SHA256SUMS。EXE 无数字签名。新版 Client 可提供经过验证的更新，但安装需要单独同意；旧版 Client 须手动替换。服务器更新需要用户操作，可能中断直播。请自行备份所需数据；三个产品独立发布。

Server Setup build: `1.0.0-rc.8-d703726cd50b` · source: `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1`

Linux build: `1.0.0-rc.8-d703726cd50b` · source: `d703726cd50bb3d1d65c171f6e8c3ddd6eb86ff1`

Client build: `1.0.0-rc.8-f6c47a27a62c` · source: `f6c47a27a62c59f72067f4fe95ee215fcb056bfc`

如果原生 Windows 面板仍显示旧控制文字，请更新 Client：F10 →“检查更新”，或手动下载新安装程序。没有更新检查功能的旧版本请手动替换。更新服务器不会替换 EXE；请先结束直播。EXE 没有数字签名。

[Client release](https://github.com/resokol/castlink-releases/releases/tag/client-v1.0.0-rc.8-f6c47a27a62c) · [Server Setup release](https://github.com/resokol/castlink-releases/releases/tag/server-setup-v1.0.0-rc.8-d703726cd50b) · [Linux release](https://github.com/resokol/castlink-releases/releases/tag/linux-v1.0.0-rc.8-d703726cd50b)

## 说明与已发布归档

已发布归档内的文字说明反映构建时状态。最新说明位于本仓库，更新文档不会改变已安装文件或发布软件包的 SHA256。新行为需要相应软件包；旧 Linux 安装缺少密码时需明确执行恢复命令。
