[Русский](../../LINUX_INSTALL.md) · [English](../en/LINUX_INSTALL.md) · **简体中文**

## 当前 Linux Ubuntu 安装 — rc.8

**[手册：开箱即用与高级设置](LINUX_MANUAL.md)** · **[已验证的软件包和校验和](PRODUCTS.md)**

以下保留1472与8b02的历史流程。其标签、校验和及 CLI 提示仅适用于对应旧软件包。全新安装请使用上方 rc.8 手册。

## 20.10.2026 · 1.0.0-rc.8 · bdfe91a92b6b

- 更新 Windows 服务器向导及支持选择安装文件夹的多步骤 Windows Client 安装程序。远程服务器选项命名为“在 Linux Ubuntu 上”；默认使用快速设置，高级设置需明确选择。
- 网站下载顺序为 Windows Client、Windows Server、Linux Ubuntu。Ubuntu 区域突出显示包含开箱安装和高级设置的手册，并提供最近版本更新记录链接。
- 修复主播重新连接及会话续期时的名称同步。主播视频在可用区域内保持原有宽高比。
- Windows Client、Windows Server Setup 和 Linux 采用独立的发布渠道、版本和文件。

更新自己的服务器前请备份并结束连接。Windows Client 需手动更新：完全退出旧客户端，再安装新的 EXE。EXE 不会自动更新且未签名。请在非直播期间手动刷新页面。尚未单独实测实体 PowerPoint、设备及完整直播。

**[CastLink 软件包](PRODUCTS.md)** · [安装手册](LINUX_MANUAL.md)

## 20.10.2026 · 1472cd052d7e · 主播工作区与控制窗口修复

- Windows 原生面板遵循 CastLink 所选主题，屏幕来源选择器支持浅色和深色主题。
- 主播画廊利用可用宽度，聊天栏缩窄15%，控制按钮居中。仅观看演播室时保留本地摄像头预览；全屏画面在空闲时隐藏控制元素。
- 工作人员可删除尚未绑定到插槽的独立邀请，已关联的永久输出链接保持可用。
- 未设置麦克风配置时默认使用原始音频，不启用降噪或回声消除。明确保存的语音配置保持不变。
- 多画面裁剪仅遮罩边缘，不移动、缩放或改变来源比例。
- 浏览器浮动面板新增“紧凑尺寸”按钮。浏览器恢复较大窗口时可点击恢复；共享窗口尺寸计入独立的停止区域。初始窗口尺寸仍可能由浏览器决定。

请更新服务器和 Windows 客户端。完全退出旧客户端后运行新的 EXE；EXE 不会自动更新。请在非直播期间手动刷新页面。更新自己的服务器前请备份并结束连接。EXE 未签名。尚未单独实测实体 PowerPoint、设备及完整直播。

保留隔离的 PPTX 转换器、原有限制与服务器权限。以及其他细微调整。

# CastLink：不使用 Windows 和图形向导在 Linux 上安装

## 历史 Linux 辅助程序1472 — rc.3

本次合并版本的软件包会随服务器自动启动隔离的 PPTX 转换器，无需为转换另行安装 PowerPoint、LibreOffice 或 Python。本地 PDF 继续使用现有查看器。自定义或旧版服务器配置需要配置隔离转换器；仅刷新网页不会启用转换功能。 [PDF/PPTX 共享与翻页控制](PRESENTATIONS.md) · [更新日志](CHANGELOG.md)

历史 rc.3 软件包使用 [easy-setup-1472cd052d7e](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-1472cd052d7e) 和 [INSTALL.md](INSTALL.md)。需要 Linux amd64、Python 3.8+、Docker Engine 和 Compose v2。这是不依赖 Windows 的控制台辅助程序，不是 Linux 图形安装程序。

将压缩包与校验和**从同一固定版本**下载到单独目录。不要在正在运行的安装目录中执行这些命令：

```bash
set -euo pipefail
RELEASE_TAG=easy-setup-1472cd052d7e
RELEASE_BASE="https://github.com/resokol/castlink-releases/releases/download/$RELEASE_TAG"
mkdir -p "$HOME/castlink-package-$RELEASE_TAG"
cd "$HOME/castlink-package-$RELEASE_TAG"
curl -fL "$RELEASE_BASE/CastLink-Linux.tar.gz" -o CastLink-Linux.tar.gz
curl -fL "$RELEASE_BASE/SHA256SUMS" -o SHA256SUMS
printf '%s\n' '3d25045ffa4ea8478535742f268c9be6f988b209507e7fd90a73cb7ed4ca341e  CastLink-Linux.tar.gz' | sha256sum --check -
sha256sum --check --ignore-missing SHA256SUMS
mkdir bundle
tar -xzf CastLink-Linux.tar.gz -C bundle
cd bundle
python3 scripts/linux-compose-setup.py init --state-dir /opt/castlink-manual --lang zh-CN
python3 scripts/linux-compose-setup.py start --state-dir /opt/castlink-manual --lang zh-CN
python3 scripts/linux-compose-setup.py status --state-dir /opt/castlink-manual --lang zh-CN
```

必须先通过 SHA-256 校验，再解压和执行。`init` 提供快速/高级模式并保存设置；`start` 加载包内镜像、启动服务并准备数据库。若所选目录需要 root 权限，请以管理员身份执行；同一用户必须能够访问 Docker。其他语言可将 `--lang zh-CN` 改为 `--lang ru` 或 `--lang en`。

INSTALL 介绍高级 HTTP/HTTPS/外部代理、JSON 配置、可信代理、证书与媒体端口。LAN/公网 IP 上的 HTTP 无法启用浏览器摄像头/麦克风；参与者需要受信任的 HTTPS。网站设置不能替代 TCP 7881、UDP 7882、TURN UDP 3478、UDP 30000–30031 或高级模式所配置的端口。

`/opt/castlink-manual` 是保存配置与私密状态的长期目录，包含 `compose.json`、`Caddyfile`、`livekit.json`、env 和密钥。解压或更新发行包时应保留该目录，不要公开其内容。辅助程序不接管 Windows 向导或旧版安装，也不修改这些安装的数据。

更新前应在非直播时段备份配置与数据：

```bash
python3 scripts/linux-compose-setup.py backup --state-dir /opt/castlink-manual --lang zh-CN
```

将**经过校验的新版本**解压到另一目录，进入该目录后运行：

```bash
python3 scripts/linux-compose-setup.py update --state-dir /opt/castlink-manual --lang zh-CN
python3 scripts/linux-compose-setup.py status --state-dir /opt/castlink-manual --lang zh-CN
```

`update` 会停止服务，对 PostgreSQL/web-data 和配置制作一致备份，再启动新版本；UUID、网络、密钥和卷名称保持不变。不会自动回滚数据库或数据：旧代码可能与新结构不兼容。失败时应保留日志和备份；再次执行 `start` 前需明确要运行的版本。不要运行 `docker compose down -v`，该命令会删除数据。

检查地址与 `/api/version`，再用另一设备验证视频、音频、演播室返送及外部访问。代理模式下内部 HTTP 成功不代表外部 HTTPS 或 TURN 在您的网络中正常工作。

## Legacy：固定 8b02 流程

1.0.0-rc.3 / 776AF9 的固定槽位、自动设备检查等功能需要已更新的房间服务器。请参阅[更新日志](CHANGELOG.md)；下方命令仍安装固定的旧版本。

以下内容为旧版 `easy-setup-8b02e2d4dc3c` 流程保留。其中的标签、校验和及命令仅适用于该流程，不要替换为 `latest` 或新版本标签。新的 `linux-compose-setup.py` 不接管这种安装；迁移需要单独计划、备份及兼容性检查。以下命令不会安装当前版本。

本指南适用于已发布的测试版本 [`easy-setup-8b02e2d4dc3c`](https://github.com/resokol/castlink-releases/releases/tag/easy-setup-8b02e2d4dc3c)。服务器使用预构建镜像部署；无需 Git、Node.js、应用构建或 Windows。**VPS 上需要 Docker Engine 和 Docker Compose。** caster（远程嘉宾）的设备只需要浏览器。

以下操作使用已构建服务器镜像中包含的辅助程序 `server-provision-vps.py`。它不是交互式安装程序，而是通过标准输入接收一个 JSON 对象。此辅助程序没有独立的 `castlink install` 可执行文件，也没有 `--domain` 参数。Linux 压缩包包含镜像和 Docker 准备脚本；仅运行准备脚本不会安装 CastLink。

### 1. 准备独立 VPS

- Ubuntu **22.04 或 24.04**，**amd64/x86_64** 架构，固定公网 IPv4，可通过 SSH 以 root 登录。
- 首次测试建议使用 **2 vCPU、4 GB RAM 和至少 20 GB 可用磁盘空间**。这些余量用于启动、镜像和备份，并不承诺具体容量。曾测试过使用 2 GB RAM 和 swap 的独立配置；这不保证是直播负载下的最低要求。请使用您自己的负载测试 caster 数量、视频质量和带宽。
- 下表端口必须空闲，并在服务商面板和服务器防火墙中开放。请勿让其他 Web 服务器占用这些端口。
- 允许通过出站 HTTPS 访问 GitHub 及其文件下载服务器、Ubuntu/Docker 软件仓库和 Let's Encrypt ACME 服务。系统时间必须正确。

| 用途 | 入站端口 |
| --- | --- |
| SSH 管理 | TCP 22 或您配置的 SSH 端口 |
| HTTPS 和证书获取 | TCP 443 和 TCP 80 |
| LiveKit 媒体连接 | TCP 7881、UDP 7882 |
| TURN/UDP | UDP 3478 和 UDP 30000–30031 |

这些端口专用于此版本 Python 辅助程序生成的配置。TCP 3000、TCP 5432 和 TCP 7880 不对外发布。此方法不配置 TLS/TCP 443 上的 TURN；在禁止 UDP 的网络中，需要单独测试媒体连接。Docker 规则和服务商防火墙也会影响端口可访问性。

以下所有命令均在 **VPS 上**、同一个 root Bash 会话中执行。`203.0.113.10` 是示例，请替换为您的公网 IPv4。首次 SSH 连接时，请将服务器密钥指纹与服务商提供的信息核对。

```bash
ssh root@203.0.113.10
```

首先执行以下检查；发现旧安装目录时，即使安装已停止，也会拒绝继续。对于现有服务器，请先检查配置，再转到更新章节；不要在现有数据上执行全新安装。

```bash
set -euo pipefail
umask 077
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
test "$(id -u)" = 0
. /etc/os-release
test "$ID" = ubuntu
case "$VERSION_ID" in 22.04|24.04) ;; *) exit 1 ;; esac
test "$(uname -m)" = x86_64
if compgen -G '/opt/castlink-easy-*' >/dev/null; then
  echo 'Обнаружена прежняя установка. Остановитесь и проверьте её данные.' >&2
  exit 1
fi
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3
WORK_DIR=$(mktemp -d /root/castlink-install.XXXXXXXX)
cd "$WORK_DIR"
```

请保存 `pwd` 显示的路径：已校验安装包、辅助程序和安装请求都会留在该文件夹中。

```bash
pwd
```

### 2. 下载固定版本并校验 SHA-256

```bash
RELEASE_TAG=easy-setup-8b02e2d4dc3c
RELEASE_BASE="https://github.com/resokol/castlink-releases/releases/download/$RELEASE_TAG"
for FILE in CastLink-Linux.tar.gz CastLink-Provisioning.json SHA256SUMS; do
  curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --retry 3 "$RELEASE_BASE/$FILE" -o "$FILE"
done
sha256sum --check <<'SUMS'
95e39918de48685ee5c86f434f53e5f5be54d2d9f21923e659189a7b5438d6a3  CastLink-Linux.tar.gz
d544a92d48772a3267539f2161a509fb0cc57ec1136dec7fefd85562ba38088c  CastLink-Provisioning.json
1c8cc067ed5165f691278f3a4be5250017569a5e8dc5a54db7f7f56c172a0d88  SHA256SUMS
SUMS
sha256sum --check --ignore-missing SHA256SUMS
mkdir bundle
tar -xzf CastLink-Linux.tar.gz -C bundle
```

只有所有校验均无错误并显示 `OK` 时才继续。上述校验和只适用于指定版本，不要用于其他标签。SHA-256 校验用于发现与预期校验和不一致的损坏或篡改；校验和文件并非独立的数字签名。

检查版本和内部镜像压缩包：

```bash
python3 - <<'PY'
import hashlib, json
from pathlib import Path
r = json.loads(Path('bundle/payload/release.json').read_text())
p = json.loads(Path('CastLink-Provisioning.json').read_text())
assert r['commit'] == p['commit'] == '8b02e2d4dc3c286f2a5b6ace5859fbb645bae677'
assert r['distributionRepository'] == 'resokol/castlink-releases'
digest = hashlib.sha256()
with Path('bundle/payload/images.tar.gz').open('rb') as f:
    for block in iter(lambda: f.read(1024 * 1024), b''):
        digest.update(block)
assert digest.hexdigest() == r['imageArchiveSha256']
print('Образы проверены:', r['version'], r['commit'][:12])
PY
```

### 3. 准备 Docker 并提取辅助程序

以下命令只会从已校验的安装包中运行 Linux 环境准备流程。它会安装缺少的 Docker Engine/Compose，在 Docker 停止时将其启动，并准备 `/opt/castlink` 目录。需要 Compose **2.23.1 或更高版本**。此步骤不会启动 Windows 向导，也尚未部署应用。

```bash
bash bundle/scripts/ubuntu-easy-setup-bootstrap.sh install
docker --host unix:///var/run/docker.sock info --format '{{.OSType}}'
docker compose version
docker --host unix:///var/run/docker.sock load --input bundle/payload/images.tar.gz
WEB_IMAGE=$(python3 -c 'import json; print(json.load(open("bundle/payload/release.json"))["images"]["web"])')
TEMP_CONTAINER=$(docker --host unix:///var/run/docker.sock create \
  --network none --entrypoint /bin/true "$WEB_IMAGE")
docker --host unix:///var/run/docker.sock cp \
  "$TEMP_CONTAINER:/app/scripts/server-provision-vps.py" ./server-provision-vps.py
docker --host unix:///var/run/docker.sock rm "$TEMP_CONTAINER"
chmod 600 server-provision-vps.py
```

临时容器不会运行：它仅用于从已发布镜像中复制辅助文件。不会从源代码构建应用。这些命令不会删除其他容器和数据卷。

### 4. 通过公网 IPv4 安装 CastLink

请替换下一代码块中的 IP。`host` 字段需要 **IPv4**，不带 `https://`、端口和路径。不要在这里使用 `example.org` 域名：此辅助程序直接根据 IPv4 构建媒体配置，没有单独的域名参数。

```bash
python3 - <<'PY'
import hashlib, ipaddress, json
from pathlib import Path
host = '203.0.113.10'  # Замените своим публичным IPv4.
ipaddress.IPv4Address(host)
r = json.loads(Path('bundle/payload/release.json').read_text())
digest = hashlib.sha256()
with Path('CastLink-Linux.tar.gz').open('rb') as f:
    for block in iter(lambda: f.read(1024 * 1024), b''):
        digest.update(block)
request = {
    'action': 'deploy', 'host': host,
    'releaseUrl': 'https://github.com/resokol/castlink-releases/releases/download/easy-setup-8b02e2d4dc3c/CastLink-Linux.tar.gz',
    'releaseSha256': digest.hexdigest(),
    'releaseCommit': r['commit'], 'releaseCommitPrefix': r['commit'][:12],
}
Path('install-request.json').write_text(json.dumps(request))
PY
python3 server-provision-vps.py < install-request.json | tee install-events.jsonl
```

辅助程序会自行再次下载并校验 Linux 压缩包、加载镜像、创建随机秘密凭据和独立安装、启动服务、准备数据库并完成初始配置。再次下载属于预期行为。JSON 行显示各个阶段；成功结束时包含带 `installationId` 的 `result` 对象。出现错误或非零退出码，意味着需要检查安装。

将安装路径保存在变量和一个小型私有文件中，以便重新通过 SSH 登录后使用：

```bash
INSTALL_DIR=$(python3 - <<'PY'
import json, uuid
from pathlib import Path
results = [v['result'] for line in Path('install-events.jsonl').read_text().splitlines()
           if isinstance((v := json.loads(line)).get('result'), dict)]
assert len(results) == 1
iid = uuid.UUID(results[0]['installationId'])
print('/opt/castlink-easy-' + iid.hex)
PY
)
printf '%s\n' "$INSTALL_DIR" > installation-path.txt
printf 'Каталог установки: %s\n' "$INSTALL_DIR"
```

请勿公开 `web.env`、`postgres.env`、`.castlink-install.json` 和备份的内容：其中包含秘密凭据和安装数据。

### 5. 检查 HTTPS 和媒体连接

此安装内运行四个服务：`web`、`postgres`、`livekit`、`caddy`。安装包可能包含第五个 TURN TLS 镜像，但此方法不会启动它。Docker 使用 `unless-stopped` 策略。

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" ps --all
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" logs --tail 100 caddy
curl --fail --show-error https://203.0.113.10/api/version
```

此处及后续示例中的 IP 均需替换为您的地址。预期 `buildId` 为 `1.0.0-rc.2-8b02e2d4dc3c`。还应在 VPS 网络之外的另一台电脑上执行最后一条命令。不要添加 `-k`：必须验证受信任的证书。

Caddy 配置为使用 ACME 配置档 `shortlived` 为 IP 申请并续期 Let's Encrypt 公共证书。此方式不强制需要域名。证书获取取决于外部能否访问 VPS，以及 ACME 服务是否可用。Python 辅助程序完成只确认应用内部已就绪，**本身并不能确认外部 HTTPS 或媒体传输正常**。如果尚未获得证书，请检查 Caddy 日志、TCP 80/443 可访问性、时间及证书签发限制；不要关闭 TLS 校验。

在最新浏览器中打开 `https://203.0.113.10/`。创建测试房间，检查摄像头/麦克风权限、来自其他网络的 caster 连接，以及演播室直播观看。请戴耳机检查声音。HTTP 响应成功不能代替音视频测试。

### 6. 状态、日志、停止与启动

重新通过 SSH 登录后，返回已保存的工作文件夹并恢复变量：

```bash
INSTALL_DIR=$(cat installation-path.txt)
test -f "$INSTALL_DIR/compose.json"
```

状态和最新消息：

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" ps --all
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" logs --tail 100
docker --host unix:///var/run/docker.sock stats --no-stream
df -h /opt /var/lib/docker
```

仅停止和重新启动此安装：

```bash
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" stop
docker --host unix:///var/run/docker.sock compose \
  --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.json" up -d --pull never --no-build
```

请在需要的时刻分别执行这两条命令。停止会中断直播，但保留数据。手动执行 `stop` 后，`unless-stopped` 策略不一定在系统重启时启动服务：请使用上面的启动命令。

配置位于 `$INSTALL_DIR` 中：`compose.json`、`web.env`、`postgres.env`、`livekit.json`、`Caddyfile`、`.castlink-install.json`。持久化数据位于此安装的 Docker volumes 中：`postgres-data`、`web-data`、`caddy-data`、`caddy-config`；Docker 中的实际名称带有项目前缀。这些数据卷保存数据库、应用数据和证书。请同时保存含秘密凭据的配置，以及数据的一致性备份。直接复制正在运行的 PostgreSQL 数据卷不属于一致性备份。

不要为了重启或更新而运行 `docker compose down -v`、全局 `docker system prune --volumes`，或删除安装目录。不要只迁移 `compose.json`：它引用了其他文件和数据。

### 7. 更新现有安装

以下命令仅更新 web，不会应用新的 Easy Setup 端口配置，也不会重新创建 LiveKit。要从宽 UDP 范围迁移，请使用新安装程序，并先在外部防火墙和路由器上允许 UDP 7882。

再次执行 `deploy` 并不是更新。对于此格式的安装，辅助程序支持单独的 `action: update` JSON 请求。它只更换 `web` 镜像，保留 UUID、配置档、设置、基础设施容器和数据卷。这不是用于更新 Docker、PostgreSQL、LiveKit 或 Caddy 的机制。

请安排维护窗口并结束所有会话：存在参与者，或无法检查是否没有参与者时，辅助程序会拒绝更新服务器。替换前，它会检查可用空间和 SQL 兼容性，将配置、PostgreSQL 和 `web-data` 保存到 `$INSTALL_DIR/backups/`，在操作期间禁止写入，并检查 HTTPS。在重新开放写入前发生错误时，可执行回滚；如果回滚失败，备份会保留以供恢复。若因迁移而被拒绝，需要参阅相应版本的专门指南。

以下示例选择同一版本，在按本指南安装的服务器上应返回 `outcome: current`。要进行实际更新，请将 `UPDATE_TAG` 替换为**具体的已发布标签**，并先阅读该版本的说明和要求。不要混用不同版本的文件。请在已保存的工作文件夹中执行，并确保已设置 `INSTALL_DIR`。

```bash
UPDATE_TAG=easy-setup-8b02e2d4dc3c
UPDATE_BASE="https://github.com/resokol/castlink-releases/releases/download/$UPDATE_TAG"
UPDATE_DIR=$(mktemp -d "$PWD/update.XXXXXXXX")
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  "$UPDATE_BASE/SHA256SUMS" -o "$UPDATE_DIR/SHA256SUMS"
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  "$UPDATE_BASE/CastLink-Provisioning.json" -o "$UPDATE_DIR/CastLink-Provisioning.json"
export UPDATE_TAG UPDATE_DIR INSTALL_DIR
python3 - <<'PY'
import hashlib, ipaddress, json, os, re
from pathlib import Path
tag = os.environ['UPDATE_TAG']
assert re.fullmatch(r'easy-setup-[a-f0-9]{12}', tag)
folder = Path(os.environ['UPDATE_DIR'])
checksums = {}
for line in (folder / 'SHA256SUMS').read_text().splitlines():
    digest, name = line.split()
    assert re.fullmatch(r'[a-f0-9]{64}', digest)
    assert name not in checksums
    checksums[name] = digest
metadata = (folder / 'CastLink-Provisioning.json').read_bytes()
assert hashlib.sha256(metadata).hexdigest() == checksums['CastLink-Provisioning.json']
r = json.loads(metadata)
assert re.fullmatch(r'[a-f0-9]{40}', r['commit'])
assert r['commit'].startswith(tag.removeprefix('easy-setup-'))
assert 'vps-update-maintenance-v1' in r['capabilities']
state = json.loads((Path(os.environ['INSTALL_DIR']) / '.castlink-install.json').read_text())
host = str(ipaddress.IPv4Address(state['address']))
assert state['completed'] is True
request = {
    'action': 'update', 'installationId': state['installationId'],
    'host': host, 'origin': 'https://' + host,
    'releaseUrl': 'https://github.com/resokol/castlink-releases/releases/download/' + tag + '/CastLink-Linux.tar.gz',
    'releaseSha256': checksums['CastLink-Linux.tar.gz'],
    'releaseCommit': r['commit'], 'releaseCommitPrefix': r['commit'][:12],
}
(folder / 'update-request.json').write_text(json.dumps(request))
PY
python3 server-provision-vps.py < "$UPDATE_DIR/update-request.json" \
  | tee "$UPDATE_DIR/update-events.jsonl"
curl --fail --show-error https://203.0.113.10/api/version
```

此示例通过 HTTPS 从新版本公开的 `SHA256SUMS` 获取校验和；如有另行发布的预期校验和，还应额外核对。最终结果应包含 `outcome: updated` 或 `current`，以及预期的 `buildId`。更新后请重复外部 HTTPS 和媒体测试。若服务器地址或配置曾被手动修改，需先检查其是否适用此流程。

### 如果安装中断

请保留工作文件夹、`$INSTALL_DIR`、Docker volumes 和错误消息。对于未完成的安装，辅助程序可以通过再次运行**同一个** `install-request.json` 继续，前提是使用相同 IP、版本和未修改的文件。不要重新运行用于全新安装的初始代码块：其检查会在已有目录时主动停止。已完成的安装应使用启动/停止或 `update` 命令维护。

如果端口被占用，辅助程序会拒绝继续。不要自动停止其他服务。如果出现 UUID、版本、配置或秘密凭据不匹配错误，请停止并检查状态；删除检查文件无法修复数据。

### 本指南的适用范围

此方法适用于独立 Ubuntu VPS、公网 IPv4，以及已发布版本辅助程序生成的标准配置。通过 `example.org` 域名访问、独立 TURN TLS、IPv6、NAT/CGNAT 和现有数据迁移需要单独配置；仅添加 DNS 记录不会更改证书和安装地址。开发中尚未验证的功能不适用于此版本。

上述命令已与此版本的打包内容和辅助程序核对。在编写文档时，并未按照本指南在全新 VPS 上执行完整安装和实际直播；外部证书签发和连接质量需要在您的服务器上验证。


---

[配置 TCP 443 上的 TURN/TLS](TURN_TLS.md)
