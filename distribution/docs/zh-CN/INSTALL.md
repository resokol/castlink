# CastLink 安装：快速和高级模式

[Русский](../../INSTALL.md) · [English](../en/INSTALL.md) · [简体中文](INSTALL.md)

本指南适用于声明 `network-modes-v1` 和 `linux-compose-v1` 功能的安装包。更新文档不会使旧安装包获得这些功能。

## 选择安装包与普通安装

[三个安装包及独立下载链接](PRODUCTS.md)：**Client** 用于加入服务器；**Server Setup** 从 Windows 向电脑/VPS 安装服务器；**Linux** 无需 Windows 向导即可安装服务器。当前候选版本为 **1.0.0-rc.8**；新包验证完成前，下载链接保持最近已发布版本。各产品独立更新，暂不升级至 1.1。

普通安装使用标准设置。只有明确选择高级模式才需要配置技术参数。Windows 客户端为当前用户一键安装。Server Setup 的高级设置可选，SSH 使用已保存的端口或 22。Linux `init` 默认为快速模式，技术选项需添加 `--advanced`。网站地址决定 HTTPS 和媒体 IPv4；仅当 DNS 无结果或结果不唯一时才询问额外 IPv4。更新时保留现有配置。

## 重新安装与卸载

如果向导询问是否继续未完成的安装，选择“否”可重新指定目录和地址。新的本地安装需要局域网或公网 IPv4；使用 127.0.0.1 的旧测试草稿不再自动选中。成功卸载后会清除该安装的继续状态。若保留了数据，可重新安装到原目录以恢复。

卸载远程服务器时，选择“卸载服务器”→“远程服务器”。向导通过 SSH 连接并列出 VPS 上的安装，无需指定本机向导目录。请下载新版 Windows Server Setup 并完整解压到单独目录；旧 EXE 不会自动更新。

## Windows

完整解压 `CastLink-Windows.zip`，打开 `EasySetup.exe`，选择安装；默认为快速模式，高级设置可选：

- **快速安装（推荐）**：使用 HTTPS、标准端口，自动生成密钥并准备数据库。只需选择安装位置和地址。本地安装使用私有证书及可移植信任工具；VPS 使用公共证书。备用服务器可稍后添加。
- **高级安装**：选择直接 HTTPS、HTTP 或外部 HTTPS 代理；配置外部网站地址、监听 IPv4、网站端口、受信任代理、独立的媒体 IPv4、媒体 TCP/UDP 端口和 TURN 中继范围。也可通过 `-NetworkConfigPath` 指定 JSON 配置。

语言按钮支持俄语、英语和简体中文，切换时保留已输入的内容。更新时请选择原安装：网络设置、UUID、密钥和数据卷均予以保留。更新不会自动更改网络部署方式。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows-simple-easy-setup.ps1 -SetupMode advanced -NetworkConfigPath network.json
```

## 不使用 Windows 向导的 Linux 安装

独立 SSH 终端指南：[开箱即用](LINUX_MANUAL.md#out-of-box) · [高级模式](LINUX_MANUAL.md#advanced)，包括软件包校验、JSON、证书和更新。

需要 Linux amd64、Python 3.8+、Docker 和 Docker Compose v2。请对照 `SHA256SUMS` 验证官方 `CastLink-Linux.tar.gz`，并将每个版本解压到单独目录。程序会根据清单校验安装包内容，使用内附镜像；镜像加载不需要 Docker Hub 或私有 GitHub 仓库访问权限。

在解压后的安装包中运行：

```bash
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --lang zh-CN
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang zh-CN
python3 scripts/linux-compose-setup.py status --state-dir /opt/castlink-manual --lang zh-CN
```

其他语言使用 `ru` 或 `en`。`init` 默认使用快速模式并写入配置（高级模式需添加 `--advanced`）；`start` 加载镜像、启动服务并准备数据库。本地 HTTPS 需要在客户端设备上信任生成的 CA。公共 HTTPS 需要正确的 DNS/公网 IP 和可访问的 ACME 端口。真实音视频仍需单独连接验证。

持久目录 `/opt/castlink-manual` 包含 `compose.json`、`Caddyfile`、`livekit.json`、环境文件及私密状态/密钥。请勿公开目录内容。请将其与版本解压目录分开保存，并定期备份。Linux 程序和 Windows 向导各自管理自己的安装；Linux 程序不会接管 Windows 向导安装的实例。

## 使用外部反向代理

```text
浏览器 → HTTPS → Nginx/Caddy → HTTP → CastLink Caddy → 应用
媒体连接 → 独立的 LiveKit/TURN 端口
```

同一主机上代理的 `network.json` 示例：

```json
{
  "setupMode": "advanced",
  "publicHttps": false,
  "network": {
    "mode": "proxy",
    "publicOrigin": "https://meet.example.com",
    "bindAddress": "127.0.0.1",
    "httpPort": 8080,
    "httpsPort": 443,
    "mediaIp": "203.0.113.8",
    "iceTcpPort": 7881,
    "iceUdpPort": 7882,
    "turnUdpPort": 3478,
    "relayPortStart": 30000,
    "relayPortEnd": 30031,
    "trustedProxies": ["172.17.0.1/32"]
  }
}
```

请替换域名、mediaIp 和 trustedProxies。`203.0.113.8` 是文档示例地址。受信任代理必须填写 **Docker 内 Caddy 实际看到的代理源地址**，而非浏览器地址。Docker 可能将 localhost 替换为网关地址，请核实实际地址/子网。程序拒绝 `0.0.0.0/0`。如果代理位于其他机器或容器，请选择其可访问的私有 `bindAddress`，并仅允许该代理访问。

```bash
python3 scripts/linux-compose-setup.py validate --config network.json --lang zh-CN
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --config network.json --lang zh-CN
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang zh-CN
```

同一主机上的外部 Caddy：

```caddyfile
meet.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

外部 Nginx 示例，请替换证书路径：

```nginx
server {
    listen 443 ssl;
    server_name meet.example.com;
    ssl_certificate /etc/ssl/meet/fullchain.pem;
    ssl_certificate_key /etc/ssl/meet/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

必须转发所有路径，包括 `/rtc` 和 WebSocket。内部 Caddy 保留 `/api/media-admission` 访问检查，清除不受信任来源伪造的转发头，并向应用传递经验证的客户端 IP。内部 HTTP 检查成功不代表外部 HTTPS 已就绪：请从其他设备检查 `https://meet.example.com/api/version` 并加入房间。

## HTTP、HTTPS 和端口

在 localhost 以外使用普通 HTTP 会限制浏览器摄像头、麦克风和屏幕共享。局域网及互联网用户应使用 HTTPS 或外部 HTTPS 代理。局域网可使用私有 CA 的 HTTPS，但接受浏览器警告本身不等于安装 CA 信任。

直接公共 HTTPS 默认使用 TCP 80/443。若修改发布的 HTTP 端口，必须将外部 TCP 80 转发到该端口，以支持 ACME HTTP-01；任意端口本身不能保证证书签发。直接 HTTP/HTTPS 模式下，`publicOrigin` 端口必须与配置一致。代理模式则将外部端口和内部 HTTP 端口分开。

默认媒体端口：TCP 7881、UDP 7882、TURN UDP 3478 和 UDP 30000–30031。请在防火墙/服务商面板开放所选端口，并在 NAT 中保持端口号不变。网站代理不能替代媒体通道。数据库和 web:3000 不单独对公网开放。向导的 TURN/TLS 443 仅适用于直接公共 HTTPS、标准 80/443 端口及独立 TURN 域名；HTTP 代理不会自动成为 TURN 代理。

## Linux 更新和备份

更新前请结束直播：服务会重启。在**新的**、已验证的解压安装包中，使用同一个持久目录：

```bash
python3 scripts/linux-compose-setup.py backup --state-dir /opt/castlink-manual --lang zh-CN
python3 scripts/linux-compose-setup.py update --state-dir /opt/castlink-manual --lang zh-CN
```

`update` 在加载新镜像前会额外创建并验证 PostgreSQL、web-data 和配置备份。为了获得一致的文件快照，会短暂停止 web 执行，并在备份失败时恢复执行。UUID、密钥、网络设置和卷名称保持不变。失败时请保留目录、卷及备份；可重试 `start` 完成所选版本。数据库/数据不会自动回滚：旧代码可能不兼容新数据。

在持久目录中可直接使用 Compose 诊断：

```bash
docker compose -f compose.json config --quiet
docker compose -f compose.json ps
docker compose -f compose.json logs --tail 100
```

分享日志前请检查是否包含密钥。不要使用 `down -v`，因为该参数会删除持久数据卷。

