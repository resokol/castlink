# CastLink 发布规则

[Русский](../../RELEASE_POLICY.md) · [English](../en/RELEASE_POLICY.md) · 简体中文

- `resokol/castlink` 是唯一公开仓库，保存采用 [MIT](../../../LICENSE) 许可证的源码、安装包、校验和及说明。旧地址 `resokol/castlink-releases` 重定向至此；已有 manifest 保留旧地址以兼容现有安装程序。
- `main` 是唯一长期分支，也是 `client`、`server-setup`、`linux` 三个独立产品的构建来源。版本由 `release-tracks.json` 指定。开发使用临时分支和 PR；合并后确认没有独有提交，再删除临时分支。构建前固定已验证的源码 SHA。
- 各产品保留独立版本和标签：`<track>-v<version>-<12-char-sha>`。发布一个产品不要求同时发布其他产品。通用的 `releases/latest` 不代表全部产品的版本；请使用[产品目录](PRODUCTS.md)。
- GitHub Latest 指向最新验证并发布的 Linux 版本。Client 和 Server Setup 不更改此标记。它仅用作通用展示入口；每个产品的更新和下载仍按各自渠道、确切标签及 SHA256SUMS 选择。
- Client 使用 `windows-desktop-client.yml`；Server Setup 和 Linux 在 `easy-setup-packages.yml` 中选择发布方向。默认 `publish=false`，验证完成后手动发布。唯一发布目标为 `resokol/castlink`。
- 先准备草稿，包含完整安装包、manifest、SHA256SUMS 和必要的第三方材料。核对内容和校验和后再公开发布，并提供所需的 copyleft 源码及声明。
- 保留已发布标签、文件名、文件字节、校验和及内嵌 build/source ID。迁移发布或修正文档不等于重新构建或更新服务器。不得移动已发布标签，也不得仅为修改说明而替换归档文件。
- Server Setup 自带固定的 `CastLink-Linux.tar.gz` 用于 VPS 安装；未经对应 Server Setup 安装包验证，不得替换为独立 Linux 产品的归档。
- 发布说明应列出新增、变更、修复及更新操作。不得宣称未经验证的功能已就绪，也不得把私有开发日志复制到公开说明。
- 同步维护俄语、英语和简体中文文档及语言切换链接。命令、校验和和标识符不翻译；原始许可证和声明不能由译文替代。
