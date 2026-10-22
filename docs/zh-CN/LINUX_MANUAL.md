# 在 Linux 上手动安装 CastLink

[Русский](../../LINUX_MANUAL.md) · [English](../en/LINUX_MANUAL.md) · [简体中文](LINUX_MANUAL.md)

通过 SSH 终端选择[开箱即用](#out-of-box)或[高级模式](#advanced)，无需 Windows 向导。本指南使用声明支持 `network-modes-v1` 和 `linux-compose-v1` 的官方软件包；文档更新不会为旧软件包增加功能。[安装概览](INSTALL.md) · [用户指南](../../README.md) · [发行版本](https://github.com/resokol/castlink-releases/releases)。

下方新的交互步骤适用于 CLI **1.0.0-rc.8**：`init` 默认快速设置，使用 `--advanced` 明确启用高级设置。先通过 `--help` 确认支持该参数。[选择已发布的 Linux 版本](PRODUCTS.md)。下方所选软件包使用新的 rc.8 CLI。[历史 CLI1472 部分](#legacy-1472)仅适用于旧软件包。

## 准备主机并验证软件包

需要 Ubuntu 22.04/24.04 x86_64（amd64）、Python 3.8+、运行 Linux 容器的 Docker Engine、**2.23.1 或更新版本**的 Docker Compose，以及 `curl`、`tar`、`sha256sum`。其他发行版尚未单独验证。通过 SSH 连接自己的服务器，在管理员 shell 中执行示例（必要时先运行 `sudo -i`）。Docker 访问权限等同于管理员权限。后续操作必须使用同一个 Docker Engine 和数据目录；不要在命令之间切换 Docker context。

请按 Ubuntu 说明和 [Docker Engine for Ubuntu](https://docs.docker.com/engine/install/ubuntu/) 安装依赖。Linux CLI 不会安装操作系统、Python 或 Docker。保留 SSH 访问和当前可用连接。以下检查不会更改服务：

```bash
uname -m
python3 --version
docker info --format '{{.OSType}}'
docker compose version
```

预期结果为 `x86_64`、Python 3.8+、`linux` 和符合要求的 Compose 版本。为端口以及镜像、数据库、备份预留空间。首次测试建议有 20 GB 可用磁盘，但这不是经过测量的最低要求。

下方固定的 Linux 版本为 **1.0.0-rc.8**，源提交为 `72b315b2d251`。归档与校验和必须来自同一发行版本。每个版本解压到新目录，与持久数据分开：

```bash
set -euo pipefail
umask 077
RELEASE_TAG='linux-v1.0.0-rc.8-72b315b2d251'
mkdir -p /opt/castlink-releases
cd /opt/castlink-releases
mkdir "$RELEASE_TAG"
cd "$RELEASE_TAG"
RELEASE_URL="https://github.com/resokol/castlink-releases/releases/download/$RELEASE_TAG"
curl --fail --location --proto '=https' "$RELEASE_URL/CastLink-Linux.tar.gz" -o CastLink-Linux.tar.gz
curl --fail --location --proto '=https' "$RELEASE_URL/SHA256SUMS" -o SHA256SUMS
printf '%s  %s\n' '42ec2b981f53eba107369905a78bd6d31bf130e2fed90a2fa217c4cc72c39add' 'CastLink-Linux.tar.gz' | sha256sum --check -
sha256sum --check --ignore-missing SHA256SUMS
tar --extract --gzip --file CastLink-Linux.tar.gz
python3 -c 'import json; r=json.load(open("payload/release.json")); assert {"network-modes-v1","linux-compose-v1"} <= set(r.get("capabilities", [])); print(r["commit"])'
python3 scripts/linux-compose-setup.py --help
CASTLINK_STATE=/opt/castlink-manual
```

只有出现 `CastLink-Linux.tar.gz: OK` 且功能检查成功后才能继续。示例中的 `mkdir` 在版本目录已存在时会故意停止；不要把新版本解压覆盖旧版本。CLI 还会依据 `payload/release.json` 验证软件包文件和镜像归档。软件包包含镜像，无需构建应用或从 Docker Hub 拉取应用镜像。

持久目录 `/opt/castlink-manual` 必须是新的私有目录。`init` 以 0700 权限创建目录，以 0600 权限创建配置和机密文件；`umask 077` 也会保护操作员创建的文件。不要使用 Windows 向导管理的安装目录：CLI 会拒绝其 state，也不会迁移该安装。

<a id="legacy-1472"></a>
## 历史 CLI1472：旧提示顺序

`easy-setup-1472cd052d7e` 软件包不支持 `--advanced`。运行下面的命令，在第一个提示中选择 `quick` 或 `advanced`。quick 随后询问外部地址、媒体 IPv4 和公共证书选择；advanced 继续询问网络参数。这是旧包的交互，不是新的 rc.8 提示。下方通用 JSON 示例和 start/status/update 命令适用于声明相应功能的两类软件包。

```bash
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --lang zh-CN
```

| 提示 | 公网 VPS | 局域网 |
| --- | --- | --- |
| 设置模式 | `quick` | `quick` |
| 外部地址 | `https://meet.example.com`，或使用自己的公网 IPv4 的 HTTPS 地址 | 例如 `https://192.168.1.50` |
| 服务器媒体 IPv4 | 客户端可访问的公网 IPv4 | 服务器局域网 IPv4 |
| 使用公共 HTTPS 证书？ | `yes` | `no`：私有 CA |

<a id="out-of-box"></a>
## 开箱即用：HTTPS 和标准端口

适用于独立公网 VPS 或局域网服务器。VPS 使用域名时，先把 A 记录指向服务器公网 IPv4；也可以直接使用公网 IPv4。CLI 不会配置 DNS 或 NAT。局域网应使用客户端设备可以访问的地址。

```bash
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --lang zh-CN
```

CLI rc.8 默认使用快速设置：输入服务器域名或 IPv4，可省略 `https://`。不再单独询问快速模式或证书选择。域名只有一个 IPv4 A 记录时，直接从 DNS 获取媒体 IPv4；DNS 缺失或不明确时才额外询问服务器 IPv4。全球可路由的媒体 IPv4 自动选择公共证书，私网或 loopback 地址选择私有 CA。需要明确选择网络和证书时使用 `--advanced`。

请替换示例地址。默认值 `127.0.0.1` 只能从服务器本机访问；远程客户端不能使用这些默认值。快速模式使用 HTTPS、HTTP/HTTPS 80/443、媒体 TCP 7881、媒体 UDP 7882、TURN UDP 3478 和 relay UDP 30000–30031。媒体 IPv4 不是 loopback 时，Caddy 绑定到 `0.0.0.0`。

以下是使用**示例局域网地址**的非交互配置。保存为 `quick.json`，替换 IP 后验证：

```json
{
  "setupMode": "quick",
  "publicHttps": false,
  "network": {
    "mode": "https",
    "publicOrigin": "https://192.168.1.50",
    "bindAddress": "0.0.0.0",
    "httpPort": 80,
    "httpsPort": 443,
    "mediaIp": "192.168.1.50",
    "iceTcpPort": 7881,
    "iceUdpPort": 7882,
    "turnUdpPort": 3478,
    "relayPortStart": 30000,
    "relayPortEnd": 30031,
    "trustedProxies": []
  }
}
```

```bash
python3 scripts/linux-compose-setup.py validate --config quick.json --lang zh-CN
# 仅针对新安装，代替交互式 init：
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --config quick.json --lang zh-CN
```

`init` 准备配置并生成服务机密。此步骤显示“就绪”不代表服务器已经运行。CLI 不会询问或显示房间、工作室密码。启动服务：

```bash
python3 scripts/linux-compose-setup.py start --state-dir "$CASTLINK_STATE" --lang zh-CN
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang zh-CN
```

`start` 加载镜像、启动 Compose、执行数据库迁移和初始化，并配置网站。直接 HTTPS 模式下，它会验证证书、Caddy 和预期版本。`status` 显示已保存的 `completed`、`readiness`、commit 和当前容器状态；历史成功状态不能替代当前网站检查。

`publicHttps: true` 时 Caddy 获取公共证书，需有正确的 DNS/公网地址和可访问的 ACME 端口；标准配置使用 TCP 80/443。设为 `false` 时使用私有 CA。CLI **不会在客户端设备上安装信任**，也不会创建 Windows 证书信任工具包。`start` 成功后，可以仅导出公开的根证书：

```bash
docker compose -f "$CASTLINK_STATE/compose.json" exec -T caddy cat /data/caddy/pki/authorities/local/root.crt > "$CASTLINK_STATE/castlink-root-ca.crt"
```

在自己的服务器上确认该证书的来源，然后按各客户端操作系统/浏览器的规则将其安装为受信任根证书。只传递 `castlink-root-ca.crt`，不要传递包含机密的整个目录。服务器上可用 `curl --fail --cacert "$CASTLINK_STATE/castlink-root-ca.crt" https://192.168.1.50/api/version` 检查；请替换地址。点击跳过浏览器警告不会安装 CA 信任。

<a id="advanced"></a>
## 高级模式：自定义端口、HTTP 或外部 HTTPS 代理

CLI rc.8 通过以下命令明确启用高级设置：

```bash
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --advanced --lang zh-CN
```

它询问 `https/http/proxy`、外部地址、媒体 IPv4、HTTPS 证书选择、Caddy 绑定 IPv4、全部端口和 proxy 的可信 IPv4/CIDR。也可通过 `--config` 传入完整 JSON，不会再询问交互问题。`--advanced` 仅影响新的交互式 init，不会替换已保存的设置。旧1472包在提示中选择模式。Windows 的 `-NetworkConfigPath` 参数不适用于此处。

以下 `advanced.json` 示例用于**同一主机**上的 HTTPS 代理，通过 HTTP 转发到 CastLink 内部 Caddy：

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

域名、`203.0.113.8` 和 `172.17.0.1/32` 仅是示例，不是可直接使用的服务器配置。`trustedProxies` 必须填写 **Docker 内 Caddy 实际看到的代理来源地址**，不是浏览器地址。Docker NAT 可能将 localhost 替换为网关地址。请确认自己路由中的实际地址/子网，不要直接复制示例。禁止信任 `0.0.0.0/0`。若代理位于另一台机器或容器内，请选择可达的私有 `bindAddress`，并仅允许该代理访问 HTTP listener。

```bash
python3 scripts/linux-compose-setup.py validate --config advanced.json --lang zh-CN
python3 scripts/linux-compose-setup.py init --state-dir "$CASTLINK_STATE" --config advanced.json --lang zh-CN
python3 scripts/linux-compose-setup.py start --state-dir "$CASTLINK_STATE" --lang zh-CN
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang zh-CN
```

新安装选择此 `init` 或快速模式之一即可。重复执行 `init` 会保留现有设置，不会将运行中的安装切换到新 JSON 配置。

| 字段 | 含义 |
| --- | --- |
| `setupMode` | `quick` 或 `advanced`；JSON 仍需包含全部网络字段 |
| `publicHttps` | JSON boolean：直接 HTTPS 使用公共证书；`false` 使用私有 CA。proxy/http 应设为 `false` |
| `network.mode` | `https`：Caddy 终止 TLS；`http`：不使用 TLS；`proxy`：外部代理终止 TLS |
| `publicOrigin` | 完整外部 origin，不含路径或凭据，例如 `https://meet.example.com:8443` |
| `bindAddress` | Docker 主机上网站监听的 IPv4；不决定媒体绑定地址 |
| `mediaIp` | 客户端可达的具体服务器 IPv4，不能是域名或 `0.0.0.0` |
| `httpPort / httpsPort` | 1–65535 整数。直接模式的 origin 端口需匹配对应发布端口；代理模式允许外部端口不同 |
| `iceTcpPort / iceUdpPort / turnUdpPort` | 媒体 TCP / 媒体 UDP / TURN UDP，默认 7881 / 7882 / 3478 |
| `relayPortStart / relayPortEnd` | 包含起止端口的 UDP relay 范围，共 1–1024 个端口，默认 30000–30031 |
| `trustedProxies` | IPv4/CIDR 数组；仅 `proxy` 模式为非空，其他模式为 `[]` |

避免同协议端口冲突。在防火墙、服务商面板和 NAT 中放行选定端口，并保持端口号。直接公共 HTTPS 使用非标准 HTTP 端口时，ACME HTTP-01 需要把外部 TCP 80 转发到该端口；任意端口本身不能保证签发证书。localhost 以外的 HTTP 通常会使浏览器禁止摄像头、麦克风和屏幕共享。

外部代理必须拥有有效证书，并转发所有路径，包括 `/rtc`、WebSocket Upgrade、Host 和经过验证的 forwarded 标头。Nginx/Caddy 示例见 [INSTALL.md](INSTALL.md)。CastLink Caddy 保留 media-admission 检查。网站代理不能替代媒体端口。此 standalone CLI 配置 TURN/UDP，不会自动增加 TURN/TLS 443。PostgreSQL 和 web:3000 不对公网发布。

`proxy` 模式下，`start` 成功表示 `readiness: local-ingress-only`：内部 HTTP 已检查，外部 HTTPS 尚未确认。请从另一台设备检查 `https://meet.example.com/api/version`、进入房间、实际摄像头/麦克风/屏幕共享，以及目标浏览器或 OBS/vMix 接收音视频。直接 HTTPS 也需另行验证外部路由和媒体。

## 诊断和更新

新的 SSH 会话中，重新设置 `CASTLINK_STATE=/opt/castlink-manual` 并进入所需版本的解压目录。先检查当前安装：

```bash
python3 scripts/linux-compose-setup.py status --state-dir "$CASTLINK_STATE" --lang zh-CN
docker compose -f "$CASTLINK_STATE/compose.json" config --quiet
docker compose -f "$CASTLINK_STATE/compose.json" ps
docker compose -f "$CASTLINK_STATE/compose.json" logs --tail 100
```

网络失败时检查 DNS、防火墙、端口占用、媒体 IP、证书信任和代理路由。不要公开 env/state/secrets、邀请链接或原始日志。`render` 会依据已保存 state 重写生成的配置；手工修改可能被覆盖。

以下命令需要声明 `public-updates-v1` 和 `production-retention-v1` 的新软件包。已发布的 rc.8 不会自动获得这些功能；请先安装新软件包，并通过 `--help` 确认。

交互式 `start` 和 `status` 会检查独立的 Linux GitHub Releases 频道。发现新版本时，可以更新、保留当前版本，或输入 `off` 禁用自动检查。网络检查失败不会停止服务器；非交互命令不会提问。

```bash
python3 scripts/linux-compose-setup.py check-updates --state-dir "$CASTLINK_STATE" --lang zh-CN
python3 scripts/linux-compose-setup.py update --state-dir "$CASTLINK_STATE" --lang zh-CN
python3 scripts/linux-compose-setup.py updates --auto-check off --state-dir "$CASTLINK_STATE"
python3 scripts/linux-compose-setup.py updates --auto-check on --state-dir "$CASTLINK_STATE"
```

`update` 下载当前完整的公开 Linux 发行版，验证大小、SHA256 和软件包 manifest 后安装。使用已下载并验证的软件包时，运行 `update --package /path/to/extracted/package`。更新前结束直播，因为服务会重启。安装 UUID、机密、网络和卷会保留。

不再创建自动备份，用户 CLI 的 `backup` 命令已删除。新版本通过就绪检查后，仅清理本安装登记的旧闲置镜像和临时下载。其他容器（包括已停止容器）使用的镜像以及相邻安装配置的镜像会保留。旧的自动 Linux 备份仅在安装 UUID、全部文件和校验和均匹配时删除；手动或未知副本会保留。

更新失败时保留旧镜像。排除问题后，以同一状态目录运行 `start`，它会使用已安装的镜像集，无需重新下载旧软件包。没有数据库或数据自动恢复。不要运行 `down -v` 或全局 `docker system prune`。
