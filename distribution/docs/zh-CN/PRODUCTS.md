[Русский](../../PRODUCTS.md) · [English](../en/PRODUCTS.md) · [简体中文](PRODUCTS.md)

# 选择 CastLink 安装包

| 安装包 | 用途 | 最新已验证安装包 |
| --- | --- | --- |
| CastLink Client | 用于连接现有服务器的 Windows 客户端。参与者无需安装服务器。 | [下载 Windows 客户端](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Client-1.0.0-rc.3-1472cd052d7e-setup.exe) |
| CastLink Server Setup | 为组织者提供的 Windows 向导，在 Windows 电脑或通过 SSH 在 Linux VPS 上安装服务器。 | [下载 Server Setup](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Windows.zip) |
| CastLink Linux | 不使用 Windows 向导的独立 Linux 服务器安装包。 | [下载 Linux](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/CastLink-Linux.tar.gz) |

这些固定链接指向源提交 `1472cd052d7e` 的已发布 **1.0.0-rc.3** 安装包。目前正在准备 **1.0.0-rc.8**；PR 中的修改不代表新安装包已构建或发布。[校验和](https://github.com/resokol/castlink-releases/releases/download/easy-setup-1472cd052d7e/SHA256SUMS)。运行前请校验相应文件。

出镜者可以直接使用浏览器加入，无需安装应用。Client 面向参与者；Server Setup 用于安装组织者的服务器。[安装指南](INSTALL.md)。

后续版本采用独立标签：`client-v…`、`server-setup-v…` 和 `linux-v…`。各产品的版本号可以不同，更新一个安装包不会自动更新其他产品。暂不升级至 1.1，当前候选版本为 1.0.0-rc.8。

Server Setup 发布中也可能包含 `CastLink-Linux.tar.gz`，作为 Windows 向导部署 VPS 时所需的固定依赖。向导使用自身发布中具有相同源 SHA 的文件，不替代独立发布的 Linux 产品。独立 Linux 安装请选择 `linux-v…` 标签。

发布时，仅将各行链接更新为对应产品已完成并验证的安装包。不要使用全局 `releases/latest` 来确定三个产品的版本。
