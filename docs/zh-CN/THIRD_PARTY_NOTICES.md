[英文原文](../../THIRD_PARTY_NOTICES) · **简体中文参考译文**

> **仅供参考：本文件是第三方软件声明的简体中文译文，不替代或修改任何许可证、声明或权利。具有权威性的声明为仓库根目录中的 [THIRD_PARTY_NOTICES 英文原文](../../THIRD_PARTY_NOTICES)。**

# CastLink — 第三方软件声明

CastLink 免费软件 [LICENSE](../../LICENSE) 仅适用于 CastLink 自有材料。它不替代、限制或撤销第三方组件的许可证。第三方软件保留其自身的版权及许可条款，包括这些条款授予的任何修改和再分发权利。

`third_party/npm` 目录包含原始许可证、版权声明和 NOTICE 文件，以及根据已安装生产依赖关系图生成的 `packages.json`。其中包括编译进浏览器端和服务器端 JavaScript 的库，即使 Next.js 文件追踪未保留原始依赖目录，也包含在内。被追踪的运行时软件包的原始声明也保留在对应软件包旁。

主要 JavaScript 组件包括 Next.js、React、React DOM、node-postgres（MIT）；SSH2 及其依赖（采用各自原始声明）；以及 LiveKit 客户端、服务器 SDK、React 组件和样式（Apache License 2.0）。生成的清单记录实际分发的确切版本及其各自的许可证文件。

PDF.js（Apache License 2.0）用于渲染本地演示文稿。随附字体、CMap 和图像解码器在公开的 PDF 资源及生成的第三方清单中保留各自的声明。

随附的服务器镜像还包含采用独立许可证的软件：

- Node.js — MIT，以及采用单独许可证的依赖；Debian 基础软件包
- PostgreSQL — PostgreSQL License；Alpine 基础软件包
- LiveKit Server — Apache License 2.0；Alpine 基础软件包
- Caddy — Apache License 2.0；Alpine 基础软件包
- HAProxy — GPL 第 2 版或更新版本及上游链接例外；Alpine 基础软件包和 OpenSSL

操作系统软件包有其各自的条款，包括 GPL/LGPL 组件。与发布版本匹配的随附源代码包及其清单，为 copyleft 组件提供相应的上游/下游源代码压缩包和构建方法。履行源代码合规义务需要这些确切的源代码文件及适用的许可证文本；仅提供一般项目链接不足以满足此要求。

镜像的源代码引用和不可变二进制标识记录在 `payload/release.json` 中。随附的发布版源代码包独立于 CastLink 的私有应用源代码，不会改变 CastLink 免费软件许可证。再分发者必须保留相关声明，并遵守各组件的许可证；CastLink 的许可要求不适用于第三方代码。
