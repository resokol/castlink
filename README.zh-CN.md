[English](README.md) · [Русский](README.ru.md) · **简体中文**

<p align="center">
  <a href="https://castlink.ru"><img src="assets/brand/castlink-logo.svg" width="112" height="112" alt="CastLink 标志"></a>
</p>

<h1 align="center">CastLink</h1>
<p align="center"><strong>CastLink 1.0.0-rc.8</strong></p>
<p align="center"><strong>远程嘉宾，独立音视频源，打造你的直播。</strong></p>
<p align="center">浏览器接入 · OBS 和 vMix · 自托管</p>
<p align="center">
  <a href="https://github.com/resokol/castlink/releases/download/client-v1.0.0-rc.8-f6c47a27a62c/CastLink-Client-1.0.0-rc.8-f6c47a27a62c-setup.exe"><strong>Windows Client</strong></a> · <a href="https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-rc.8-d703726cd50b/CastLink-Windows.zip"><strong>Windows Server</strong></a> · <a href="https://github.com/resokol/castlink/releases/download/linux-v1.0.0-rc.8-d703726cd50b/CastLink-Linux.tar.gz"><strong>Linux Ubuntu</strong></a>
</p>
<p align="center">
  <a href="https://castlink.ru">官网</a> &nbsp; / &nbsp;
  <a href="distribution/INSTALL.md">安装指南</a> &nbsp; / &nbsp;
  <a href="CHANGELOG.md">更新日志</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax">联系作者</a> &nbsp; / &nbsp;
  <a href="https://t.me/sklvmax"><strong>♡ 支持 CastLink</strong></a>
</p>

<p align="center">开源许可证： <a href="LICENSE">MIT</a> · <a href="distribution/PRODUCTS.md">下载与校验和</a></p>


---

CastLink 是一个自托管演播室，可将远程嘉宾、演示文稿及独立音视频流接入 OBS 或 vMix。主持人和嘉宾可以使用浏览器，也可以使用专用 Windows 客户端。本仓库提供应用源代码、构建工具、发行版和开发文档。

## 下载与安装

请从[产品目录](distribution/PRODUCTS.md)或[发行版页面](https://github.com/resokol/castlink/releases)选择安装包。Windows Client、Windows Server Setup 和独立 Linux 安装程序分别发布。安装包和 `SHA256SUMS` 必须来自同一产品的同一发行版。

| 产品 | 用途 |
| --- | --- |
| Windows Client | 以嘉宾或主持人身份加入演播室。运行 `setup.exe` 安装，无需 Docker。 |
| Windows Server Setup | 在 Windows 上，或通过 SSH 在 Linux Ubuntu 上安装服务器。完整解压 `CastLink-Windows.zip` 后运行 `EasySetup.exe`。 |
| Linux Ubuntu | 直接在 Linux 上安装服务器。[Linux 手册](distribution/LINUX_MANUAL.md)提供快速和高级安装说明。 |

[安装指南：Русский / English / 简体中文](distribution/INSTALL.md) · [用户文档](distribution/README.md) · [远程电脑控制（俄语）](docs/REMOTE_PC_CONTROL_RU.md)。

[resokol/castlink](https://github.com/resokol/castlink) 是本项目唯一的公开主仓库，提供 MIT 许可的源代码、发行版及说明。安装包和校验和可公开下载。旧地址 `resokol/castlink-releases` 重定向到此仓库，以兼容旧下载链接和安装程序。GitHub 的单个 `releases/latest` 入口不代表三个产品各自的最新版本，请使用产品目录选择。

现有安装包及 SHA256 保持不变，未重新构建。包内清单或更新检查仍可能使用旧仓库名称，GitHub 会将其重定向到当前仓库。手动安装时请使用目录中列出的具体发行版。

Windows 服务器需要运行 Linux 容器的 Docker Desktop。VPS 安装支持 Ubuntu 22.04/24.04 amd64。服务器部署在你自己的基础设施上；网络、HTTPS、端口及更新要求见安装文档。

## 开发

需要 Git、Node.js 22 和 pnpm 9.15.0。依赖版本固定在 `pnpm-lock.yaml` 中。

```sh
git clone https://github.com/resokol/castlink.git
cd castlink
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:ci
pnpm build
```

运行 `pnpm dev` 启动 Web 开发服务器。完整的本地环境还需要 LiveKit、访问配置及存储后端。请使用独立的开发环境和数据库；配置模板位于 `infrastructure/`。不要使用生产数据进行测试。

| 目录 | 内容 |
| --- | --- |
| [apps/web](apps/web) | Next.js/React、服务器 API 和浏览器界面 |
| [apps/desktop](apps/desktop) | Windows 客户端及原生集成 |
| [apps/cli](apps/cli) | 旧版 CLI，与独立 Linux 安装程序不同 |
| [native](native) | Windows 原生组件和协议 |
| [scripts](scripts) | 构建、安装、迁移和检查脚本 |
| [infrastructure](infrastructure) | Compose、SQL、服务模板及运行时组件 |
| [docs](docs/README.md) | 架构、开发和运维文档 |
| [distribution](distribution) | 用户指南和产品发行说明 |

开发入门可阅读[学习手册](docs/MANUAL_RU.md)、[项目指南](docs/PROJECT_GUIDE_RU.md)和[技术约束](docs/CRITICAL_INVARIANTS_RU.md)（俄语）。界面开发请参考[设计系统](DESIGN.md)和[UI 指南](docs/UI_EDITING_GUIDE_RU.md)。更新源代码不会自动更新已安装的应用或服务器。部分详细文档目前仅有俄语；安装指南包含英语和简体中文。

## 参与贡献

修改和验证流程见 [CONTRIBUTING](CONTRIBUTING.md)。安全漏洞请按 [SECURITY](SECURITY.md) 中的方式私下报告。

## 许可证

CastLink 自有源代码采用 [MIT 许可证](LICENSE)，允许使用、修改及再分发，但须保留版权及许可声明。第三方组件保留各自的许可证和声明，见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)。

此前发布的 Client `f6c47a27a62c` 和 Server Setup/Linux `d703726cd50b` 安装包仍保留包内的 CastLink Freeware Distribution License 1.1。安装包及 SHA256 未改变，当前源代码的 MIT 许可证不会替换旧包内的许可证。

作者：[Telegram @sklvmax](https://t.me/sklvmax) · [GitHub resokol](https://github.com/resokol)。
