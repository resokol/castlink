#!/usr/bin/env python3
"""Standalone CastLink Linux package installer. Python 3 standard library only."""
import argparse
from contextlib import contextmanager
from datetime import datetime
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

STATE = '.castlink-install.json'
OWNER = 'castlink-linux-compose-v1'
RELEASE_API = 'https://api.github.com/repos/resokol/castlink-releases/releases'
RELEASE_DOWNLOAD = 'https://github.com/resokol/castlink-releases/releases/download/'
UPDATE_PREFS = '.castlink-updates.json'
IMAGE_RECEIPT = '.castlink-image-ownership.json'
IMAGE_TAG = re.compile(r'^castlink-easy-(web|postgres|livekit|caddy|turntls):[a-f0-9]{40}$')
UPDATE_TEXT = {
 'ru': {'available':'Вышла новая версия сервера', 'current':'Текущая версия', 'choice':'Обновить? [y — обновить / Enter — остаться / off — не проверять автоматически]: ', 'offline':'Не удалось проверить обновления. Текущая версия продолжает работать.', 'latest':'Новых версий сервера нет.', 'manual':'Ручная проверка: check-updates. Обновление: update.', 'cleanup':'Сервер обновлён, но часть временных файлов или прежних образов сохранена; очистка повторится при следующем запуске.'},
 'en': {'available':'A new server version is available', 'current':'Current version', 'choice':'Update? [y — update / Enter — stay / off — disable automatic checks]: ', 'offline':'Could not check for updates. The current version continues to work.', 'latest':'No new server version is available.', 'manual':'Manual check: check-updates. Install: update.', 'cleanup':'The server is ready, but some temporary files or old images were retained; cleanup will retry on the next start.'},
 'zh-CN': {'available':'服务器有新版本', 'current':'当前版本', 'choice':'更新？[y — 更新 / Enter — 保持当前版本 / off — 禁用自动检查]：', 'offline':'无法检查更新，当前版本继续运行。', 'latest':'服务器已是最新版本。', 'manual':'手动检查：check-updates。安装：update。', 'cleanup':'服务器已就绪，但部分临时文件或旧镜像被保留；下次启动时将重试清理。'}
}
LANG = {
 'ru': {'ready': 'Готово', 'error': 'Ошибка', 'mode': 'Настройка: quick (быстрая HTTPS) / advanced (расширенная)', 'origin': 'Внешний адрес с https:// или http://', 'media': 'IPv4 сервера для медиа (отдельно от адреса сайта)', 'tls': 'Публичный HTTPS сертификат? yes/no (no = локальный сертификат)', 'network': 'Режим https / http / proxy', 'trust': 'IPv4/CIDR доверенных прокси через запятую (адрес, видимый Caddy)', 'http': 'HTTP: браузер может запретить камеру/микрофон вне localhost. Рекомендуется HTTPS.', 'proxy': 'Прокси: внешний HTTPS обязателен; перенаправь Host и WebSocket на выбранный HTTP listener. Разреши доступ к нему только своему прокси и укажи его адрес доверия.', 'stop': 'Перед обновлением заверши эфиры. Обновление перезапускает службы; автоматического отката данных нет.', 'backup': 'Резервная копия', 'installed': 'Установка уже существует; сохранённые настройки оставлены без изменений.'},
 'en': {'ready': 'Ready', 'error': 'Error', 'mode': 'Setup: quick (HTTPS) / advanced', 'origin': 'Public origin including https:// or http://', 'media': 'Server media IPv4 (separate from the website address)', 'tls': 'Public HTTPS certificate? yes/no (no = local certificate)', 'network': 'Mode https / http / proxy', 'trust': 'Trusted proxy IPv4/CIDRs, comma separated (address seen by Caddy)', 'http': 'HTTP: browsers may block camera/microphone outside localhost. HTTPS is recommended.', 'proxy': 'Proxy: external HTTPS is required; forward Host and WebSocket to the chosen HTTP listener. Restrict listener access to your proxy and trust only its address.', 'stop': 'End live sessions before updating. Updates restart services; there is no automatic data rollback.', 'backup': 'Backup', 'installed': 'Installation exists; saved settings were preserved.'},
 'zh-CN': {'ready': '就绪', 'error': '错误', 'mode': '设置：quick（快速 HTTPS）/ advanced（高级）', 'origin': '外部地址，包含 https:// 或 http://', 'media': '服务器媒体 IPv4（与网站地址分开）', 'tls': '使用公共 HTTPS 证书？yes/no（no = 本地证书）', 'network': '模式 https / http / proxy', 'trust': '受信任代理 IPv4/CIDR，以逗号分隔（Caddy 看到的地址）', 'http': 'HTTP：浏览器可能禁止 localhost 以外的摄像头和麦克风。建议使用 HTTPS。', 'proxy': '代理：外部必须使用 HTTPS；将 Host 和 WebSocket 转发到所选 HTTP 监听端口。仅允许自己的代理访问，并只信任其地址。', 'stop': '更新前请结束直播。更新会重启服务，不会自动回滚数据。', 'backup': '备份', 'installed': '安装已存在，保留已保存的设置。'}
}


def write_private(path, data):
    """Replace atomically without exposing a newly created file to other users."""
    path = Path(path)
    tmp = path.with_name(path.name + '.tmp-' + secrets.token_hex(6))
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(data if isinstance(data, str) else json.dumps(data, indent=2) + '\n')
        os.replace(tmp, path)
        os.chmod(path, 0o600)
    finally:
        if tmp.exists(): tmp.unlink()


def ipv4(value):
    try: return ipaddress.IPv4Address(value)
    except (ValueError, TypeError): raise ValueError('IPv4 address required') from None


def version_key(value):
    match = re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?', value or '')
    if not match: return None
    parts = match[4].split('.') if match[4] else []
    if any(not p or (p.isdigit() and len(p) > 1 and p.startswith('0')) for p in parts): return None
    return (*map(int, match.group(1, 2, 3)), not bool(parts), tuple((0, int(p)) if p.isdigit() else (1, p) for p in parts))


class ReleaseRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.hostname not in ('github.com', 'api.github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com') or parsed.username or parsed.password:
            raise ValueError('Unexpected release download redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def release_response(url):
    if not (url.startswith(RELEASE_API + '?') or url.startswith(RELEASE_DOWNLOAD)):
        raise ValueError('Invalid release URL')
    return build_opener(ReleaseRedirect()).open(Request(url, headers={'User-Agent': 'CastLink-Linux', 'Accept': 'application/vnd.github+json'}), timeout=15)


def release_json(url):
    with release_response(url) as response:
        body = response.read(4 * 1024 * 1024 + 1)
    if len(body) > 4 * 1024 * 1024: raise ValueError('Release list is too large')
    records = json.loads(body)
    if not isinstance(records, list): raise ValueError('Invalid release list')
    return records


def release_timestamp(record):
    try: return datetime.fromisoformat(record['published_at'].replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, KeyError): return 0


def check_updates(current):
    candidates = []
    for page in range(1, 11):
        records = release_json(RELEASE_API + f'?per_page=100&page={page}')
        for record in records:
            if not isinstance(record, dict) or record.get('draft') or not release_timestamp(record): continue
            match = re.fullmatch(r'linux-v(.+)-([a-f0-9]{12})', record.get('tag_name', ''))
            if not match or not version_key(match[1]): continue
            required = ('CastLink-Linux.tar.gz', 'SHA256SUMS', 'manifest.json', 'CastLink-Provisioning.json', 'CastLink-ThirdParty-Sources.tar.gz', 'CastLink-ThirdParty-Office-Sources.tar.gz')
            if not isinstance(record.get('assets'), list): continue
            if any(len([a for a in record['assets'] if isinstance(a, dict) and a.get('name') == name and a.get('state') == 'uploaded' and type(a.get('size')) is int and a['size'] > 0 and a.get('browser_download_url') == RELEASE_DOWNLOAD + record['tag_name'] + '/' + name]) != 1 for name in required): continue
            candidates.append({**record, 'version': match[1], 'commitPrefix': match[2]})
        if len(records) < 100: break
    candidates.sort(key=lambda r: (version_key(r['version']), release_timestamp(r)), reverse=True)
    if not candidates: return None
    candidate = candidates[0]
    if candidate['commitPrefix'] == current.get('commit', '')[:12]: return None
    old_version = version_key(current.get('version'))
    new_version = version_key(candidate['version'])
    if old_version and new_version < old_version: return None
    if old_version == new_version:
        existing = next((r for r in candidates if r['commitPrefix'] == current.get('commit', '')[:12]), None)
        if not existing or release_timestamp(candidate) <= release_timestamp(existing): return None
    return candidate


def update_preferences(folder):
    try:
        value = json.loads((folder / UPDATE_PREFS).read_text(encoding='utf-8'))
        if value.get('schemaVersion') != 1 or type(value.get('autoCheck')) is not bool: raise ValueError('Invalid update preferences')
        return value
    except FileNotFoundError: return {'schemaVersion': 1, 'autoCheck': True}


def set_update_preferences(folder, enabled):
    write_private(folder / UPDATE_PREFS, {'schemaVersion': 1, 'autoCheck': enabled})


def offer_update(folder, state, lang):
    if not sys.stdin.isatty() or not update_preferences(folder)['autoCheck']: return None
    text = UPDATE_TEXT[lang]
    try: candidate = check_updates(state['release'])
    except (ValueError, OSError): print(text['offline']); return None
    if not candidate: return None
    print(f"{text['available']}: {candidate['version']} ({candidate['commitPrefix']}). {text['current']}: {state['release'].get('version', '')} ({state['release'].get('commit', '')[:12]})")
    try: answer = input(text['choice']).strip().lower()
    except (EOFError, KeyboardInterrupt): return None
    if answer == 'off': set_update_preferences(folder, False)
    return candidate if answer in ('y', 'yes', 'да', 'д', '是') else None


def download_asset(candidate, name, destination, limit):
    asset = next(a for a in candidate['assets'] if a['name'] == name)
    if asset['size'] > limit: raise ValueError('Release asset exceeds its size limit')
    if shutil.disk_usage(destination.parent).free < asset['size'] + 64 * 1024 * 1024: raise ValueError('Not enough free disk space for the update')
    size = 0
    with release_response(asset['browser_download_url']) as response, destination.open('xb') as out:
        os.chmod(destination, 0o600)
        deadline = time.monotonic() + 1800
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk: break
            size += len(chunk)
            if size > asset['size'] or size > limit or time.monotonic() > deadline: raise ValueError('Release download exceeded its size or time limit')
            out.write(chunk)
    if size != asset['size']: raise ValueError('Release download is incomplete')


def extract_update(archive, target):
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        if len(members) > 50000: raise ValueError('Too many package files')
        total = 0
        names = set()
        for member in members:
            name = member.name.rstrip('/')
            if not name or name in names or '\\' in name or member.issym() or member.islnk() or not (member.isfile() or member.isdir()): raise ValueError('Unsafe package archive')
            safe_member(target, name)
            names.add(name); total += member.size
        if total > 8 * 1024 ** 3 or shutil.disk_usage(target).free < total + 64 * 1024 * 1024: raise ValueError('Not enough free disk space for the unpacked update')
        for member in members:
            location = safe_member(target, member.name.rstrip('/'))
            if member.isdir(): location.mkdir(parents=True, exist_ok=True, mode=0o700)
            else:
                location.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with tar.extractfile(member) as source, location.open('xb') as output: shutil.copyfileobj(source, output)
                os.chmod(location, 0o600)


@contextmanager
def downloaded_update(folder, candidate):
    with tempfile.TemporaryDirectory(prefix='.castlink-update-', dir=folder) as directory:
        root = Path(directory); archive = root / 'CastLink-Linux.tar.gz'; sums = root / 'SHA256SUMS'
        download_asset(candidate, 'SHA256SUMS', sums, 128 * 1024)
        checks = re.findall(r'^([a-f0-9]{64})  CastLink-Linux\.tar\.gz$', sums.read_text(encoding='utf-8'), re.MULTILINE)
        if len(checks) != 1: raise ValueError('Missing Linux package checksum')
        download_asset(candidate, 'CastLink-Linux.tar.gz', archive, 4 * 1024 ** 3)
        if digest(archive) != checks[0]: raise ValueError('Linux package checksum mismatch')
        package = root / 'package'; package.mkdir(mode=0o700)
        extract_update(archive, package)
        release = verify_package(package)
        if release.get('track') != 'linux' or release.get('version') != candidate['version'] or release['commit'][:12] != candidate['commitPrefix']:
            raise ValueError('Downloaded package does not match the selected Linux release')
        yield package, release


def image_receipt(folder):
    try:
        receipt = json.loads((folder / IMAGE_RECEIPT).read_text(encoding='utf-8'))
        if receipt.get('schemaVersion') != 1 or not isinstance(receipt.get('images'), list): raise ValueError('Invalid image ownership receipt')
        for entry in receipt['images']:
            if not isinstance(entry, dict) or not IMAGE_TAG.fullmatch(entry.get('tag', '')) or not re.fullmatch(r'sha256:[a-f0-9]{64}', entry.get('id', '')): raise ValueError('Invalid image ownership entry')
        return receipt
    except FileNotFoundError: return {'schemaVersion': 1, 'images': []}


def remember_images(folder, release):
    receipt = image_receipt(folder)
    for tag in release['images'].values():
        if not IMAGE_TAG.fullmatch(tag): raise ValueError('Unexpected CastLink image tag')
        identity = docker(['image', 'inspect', tag, '--format', '{{.Id}}']).strip()
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', identity): raise ValueError('Invalid loaded image identity')
        receipt['images'] = [item for item in receipt['images'] if item['tag'] != tag] + [{'tag': tag, 'id': identity}]
    write_private(folder / IMAGE_RECEIPT, receipt)


def cleanup_images(folder, state):
    receipt = image_receipt(folder)
    keep = set(state['release']['images'].values())
    # Also preserve configured images of sibling installations without containers.
    for other in folder.parent.glob('*/compose.json'):
        if other.parent == folder: continue
        try:
            configuration = json.loads(other.read_text(encoding='utf-8'))
            keep.update(s['image'] for s in configuration['services'].values())
        except (ValueError, KeyError, TypeError, OSError): continue
    retained = []
    for entry in receipt['images']:
        tag = entry['tag']
        if tag in keep: retained.append(entry); continue
        # Include stopped containers and never force removal; re-check exact identity.
        identity = docker(['image', 'ls', '--quiet', '--no-trunc', tag]).strip()
        if not identity: continue
        if identity != entry['id']:
            retained.append(entry); continue
        containers = docker(['ps', '-aq', '--filter', 'ancestor=' + tag]).split()
        if any(docker(['inspect', container, '--format', '{{.Config.Image}}']).strip() == tag for container in containers):
            retained.append(entry); continue
        docker(['image', 'rm', tag])
    receipt['images'] = retained
    write_private(folder / IMAGE_RECEIPT, receipt)


def cleanup_installation(folder, state, lang):
    try:
        cleanup_images(folder, state)
        cleanup_legacy_backups(folder, state)
    except (ValueError, OSError): print(UPDATE_TEXT[lang]['cleanup'])


def cleanup_legacy_backups(folder, state):
    root = folder / 'backups'
    if not root.is_dir() or root.is_symlink(): return
    expected = {STATE, 'secrets.json', 'compose.json', 'postgres.env', 'web.env', 'livekit.json', 'Caddyfile', 'postgres.dump', 'web-data.tar'}
    for target in root.iterdir():
        if target.is_symlink() or not target.is_dir() or not re.fullmatch(r'[0-9]{8}-[0-9]{6}-[a-f0-9]{8}', target.name): continue
        try:
            files = list(target.iterdir())
            if {file.name for file in files} != expected | {'SHA256SUMS'} or any(file.is_symlink() or not file.is_file() for file in files): continue
            if (target / STATE).stat().st_size > 1024 * 1024 or (target / 'SHA256SUMS').stat().st_size > 8192: continue
            previous = json.loads((target / STATE).read_text(encoding='utf-8'))
            if previous.get('owner') != OWNER or previous.get('installationId') != state['installationId']: continue
            checks = {}
            for line in (target / 'SHA256SUMS').read_text(encoding='utf-8').splitlines():
                match = re.fullmatch(r'([a-f0-9]{64})  ([A-Za-z0-9._-]+)', line)
                if not match or match[2] in checks: raise ValueError('Invalid retained backup checksums')
                checks[match[2]] = match[1]
            if set(checks) != expected or any(digest(target / name) != value for name, value in checks.items()): continue
            for file in files: file.unlink()
            target.rmdir()
        except (ValueError, OSError, KeyError, TypeError): continue


def apply_update(folder, state, package, release, lang):
    # Retain only image identities needed for retry until the new server is healthy.
    remember_images(folder, state['release'])
    load_images(package, release)
    remember_images(folder, release)
    render(folder, state, release)
    state['release'] = release; state['completed'] = False; write_private(folder / STATE, state)
    compose(folder, state, ['up', '-d', '--wait', '--wait-timeout', '180'])
    complete(folder, state)
    cleanup_installation(folder, state, lang)


@contextmanager
def installation_lock(folder):
    handle = (folder / '.castlink-operation.lock').open('a+b')
    try:
        if os.name == 'posix':
            import fcntl
            try: fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError: raise ValueError('Another CastLink operation is already running') from None
        else:
            import msvcrt
            handle.write(b'0'); handle.flush(); handle.seek(0)
            try: msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError: raise ValueError('Another CastLink operation is already running') from None
        yield
    finally: handle.close()


def validate_config(config):
    c = json.loads(json.dumps(config))
    if c.get('setupMode') not in ('quick', 'advanced'): raise ValueError('setupMode must be quick or advanced')
    n = c.get('network', {})
    if n.get('mode') not in ('https', 'http', 'proxy'): raise ValueError('Invalid network mode')
    origin = n.get('publicOrigin', '')
    u = urlsplit(origin)
    if (u.scheme not in ('http', 'https') or not u.hostname or u.username or u.password or
            u.path not in ('', '/') or u.query or u.fragment or
            not re.fullmatch(r'[A-Za-z0-9.-]+', u.hostname) or '..' in u.hostname or
            any(ch.isspace() for ch in origin)):
        raise ValueError('publicOrigin must be an absolute HTTP(S) origin')
    try: origin_port = u.port
    except ValueError: raise ValueError('Invalid origin port') from None
    if u.scheme != ('http' if n['mode'] == 'http' else 'https'): raise ValueError('Wrong origin scheme for mode')
    n['publicOrigin'] = origin.rstrip('/')
    ipv4(n.get('bindAddress')); ipv4(n.get('mediaIp'))
    if n['mediaIp'] in ('0.0.0.0','255.255.255.255'): raise ValueError('Media IPv4 must identify the server')
    for key in ('httpPort', 'httpsPort', 'iceTcpPort', 'iceUdpPort', 'turnUdpPort', 'relayPortStart', 'relayPortEnd'):
        if type(n.get(key)) is not int or not 1 <= n[key] <= 65535: raise ValueError('Invalid port: ' + key)
    if n['relayPortEnd'] < n['relayPortStart'] or n['relayPortEnd'] - n['relayPortStart'] > 1023:
        raise ValueError('relay range must contain between 1 and 1024 ports')
    if len({n['iceUdpPort'], n['turnUdpPort']}) != 2 or any(n['relayPortStart'] <= n[k] <= n['relayPortEnd'] for k in ('iceUdpPort', 'turnUdpPort')):
        raise ValueError('UDP port collision')
    if n['iceTcpPort'] in ([n['httpPort']] if n['mode'] in ('http', 'proxy') else [n['httpPort'], n['httpsPort']]):
        raise ValueError('TCP port collision')
    if n['mode'] == 'https' and n['httpPort'] == n['httpsPort']: raise ValueError('TCP port collision')
    proxies = n.get('trustedProxies', [])
    if not isinstance(proxies, list): raise ValueError('trustedProxies must be a list')
    for item in proxies:
        try: net = ipaddress.IPv4Network(item, strict=False)
        except (ValueError, TypeError): raise ValueError('Invalid trusted proxy IPv4/CIDR') from None
        if net.prefixlen == 0: raise ValueError('Do not trust every proxy address')
    if n['mode'] == 'proxy' and not proxies:
        raise ValueError('Proxy mode requires explicit trustedProxies')
    if n['mode'] != 'proxy' and proxies: raise ValueError('trustedProxies require proxy mode')
    if n['mode'] != 'proxy' and (origin_port or (80 if u.scheme == 'http' else 443)) != n['httpPort' if n['mode'] == 'http' else 'httpsPort']:
        raise ValueError('Origin port must match the published port')
    c['publicHttps'] = c.get('publicHttps', not ipv4(n['mediaIp']).is_private)
    if type(c['publicHttps']) is not bool: raise ValueError('publicHttps must be boolean')
    return c


def load_state(folder):
    state = json.loads((folder / STATE).read_text(encoding='utf-8'))
    if state.get('owner') != OWNER: raise ValueError('This is not a standalone Linux Compose installation; use its original installer')
    validate_config(state)
    if not re.fullmatch(r'[a-f0-9-]{36}', state.get('installationId', '')): raise ValueError('Invalid installation identity')
    if state.get('project') != 'castlink-linux-' + state['installationId'].replace('-', ''): raise ValueError('Invalid project identity')
    return state


def init_state(folder, config, release):
    folder = Path(folder)
    if (folder / STATE).exists():
        state = load_state(folder)
        if not (folder / 'secrets.json').is_file(): raise ValueError('Existing secrets missing; restore a backup')
        return state
    if (folder / 'secrets.json').exists() or (folder / 'compose.json').exists(): raise ValueError('Directory already contains installation files')
    c = validate_config(config)
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    iid = str(uuid.uuid4())
    state = {**c, 'schemaVersion': 1, 'owner': OWNER, 'installationId': iid,
             'nodeId': 'srv-' + iid.replace('-', ''), 'project': 'castlink-linux-' + iid.replace('-', ''),
             'databasePhase': 'new', 'completed': False, 'release': release}
    credentials = {key: secrets.token_hex(32) for key in ('password', 'livekitSecret', 'session', 'encryption', 'setupToken', 'nodeSecret')}
    credentials['livekitKey'] = 'lk_' + secrets.token_hex(16)
    write_private(folder / 'secrets.json', credentials)
    write_private(folder / STATE, state)
    return state


def public_status(state):
    return json.dumps({'origin': state['network']['publicOrigin'], 'mode': state['network']['mode'],
                       'completed': state['completed'], 'commit': state['release']['commit'], 'readiness': state.get('readiness','pending')}, ensure_ascii=False)


def caddy_config(state):
    n = state['network']; u = urlsplit(n['publicOrigin']); proxy = n['mode'] == 'proxy'
    global_lines = [' admin off']
    if n['mode'] != 'https': global_lines.append(' auto_https off')
    else:
        global_lines.extend([' http_port ' + str(n['httpPort']), ' https_port ' + str(n['httpsPort'])])
        if not state['publicHttps']: global_lines.extend([' auto_https disable_redirects', ' skip_install_trust'])
    if n['mode'] == 'https':
        try: ipv4(u.hostname)
        except ValueError: pass
        else: global_lines.append(' default_sni ' + u.hostname)
    if proxy:
        global_lines.extend([' servers {', '  trusted_proxies static ' + ' '.join(n['trustedProxies']), '  trusted_proxies_strict', '  client_ip_headers X-Forwarded-For', ' }'])
    site = 'http://' + u.hostname + ':' + str(n['httpPort']) if n['mode'] != 'https' else n['publicOrigin']
    lines = ['{', *global_lines, '}', site + ' {']
    if n['mode'] == 'https':
        if not state['publicHttps']: lines.append(' tls internal')
        else:
            try: ipv4(u.hostname)
            except ValueError: pass
            else: lines.extend([' tls {', '  issuer acme {', '   dir https://acme-v02.api.letsencrypt.org/directory', '   profile shortlived', '  }', ' }'])
    headers = ['header_up Host ' + u.netloc, 'header_up X-Forwarded-Host ' + u.netloc,
               'header_up X-Forwarded-Proto ' + u.scheme]
    if proxy:
        headers = ['header_up Host ' + u.netloc, 'header_up X-Forwarded-Host {http.vars.proxy_host}',
                   'header_up X-Forwarded-Proto {http.vars.proxy_proto}', 'header_up X-Forwarded-For {client_ip}']
        sources = ' '.join(n['trustedProxies'])
        lines.extend([' route {', '  @untrusted not remote_ip ' + sources,
            *['  request_header @untrusted -' + h for h in ['X-Forwarded-Proto','X-Forwarded-Host','X-Forwarded-For','X-Real-IP','Forwarded']],
            '  vars proxy_proto {scheme}', '  vars proxy_host {http.request.hostport}',
            '  @forwardedProto header X-Forwarded-Proto https', '  vars @forwardedProto proxy_proto https',
            '  @forwardedHost header X-Forwarded-Host *', '  vars @forwardedHost proxy_host {http.request.header.X-Forwarded-Host}'])
    lines.extend([' @rtc path /rtc /rtc/*', ' route @rtc {', '  forward_auth web:3000 {', '   uri /api/media-admission', '   header_up -Upgrade', '   header_up -Connection'])
    lines.extend('   ' + h for h in headers)
    lines.extend(['  }', '  reverse_proxy livekit:7880 {'])
    lines.extend('   ' + h for h in headers)
    lines.extend(['  }', ' }', ' reverse_proxy web:3000 {'])
    lines.extend('  ' + h for h in headers)
    lines.append(' }')
    if proxy: lines.append(' }')
    lines.extend(['}', ''])
    return '\n'.join(lines)


def render(folder, state, release):
    validate_config(state)
    c = json.loads((folder / 'secrets.json').read_text(encoding='utf-8')); n = state['network']
    pg = {'POSTGRES_USER': 'castlink', 'POSTGRES_DB': 'castlink', 'POSTGRES_PASSWORD': c['password']}
    env = {'NODE_ENV': 'production', 'CASTLINK_DEPLOYMENT_MODEL': 'self-hosted', 'CASTLINK_STORAGE_BACKEND': 'json',
           'DATABASE_URL': 'postgresql://castlink:' + c['password'] + '@postgres:5432/castlink',
           'LIVEKIT_SERVER_URL': 'http://livekit:7880', 'LIVEKIT_API_KEY': c['livekitKey'], 'LIVEKIT_API_SECRET': c['livekitSecret'],
           'CASTLINK_GUEST_RELAY_ENABLED': '1', 'CASTLINK_TURN_TRANSPORT': 'udp', 'CASTLINK_SESSION_SECRET': c['session'],
           'CASTLINK_DATA_ENCRYPTION_KEY': c['encryption'], 'CASTLINK_SETUP_TOKEN': c['setupToken'],
           'STUDIOLINK_DATA_DIR': '/data', 'STUDIOLINK_INSTALLATION_ID': state['installationId'],
           'STUDIOLINK_DEFAULT_STUDIO_ID': 'studio-default', 'CASTLINK_NODE_ID': state['nodeId'], 'CASTLINK_SERVER_ID': state['nodeId'],
           'CASTLINK_NODE_SECRET': c['nodeSecret'], 'CASTLINK_NODE_TYPE': 'self-hosted', 'CASTLINK_ENFORCE_NODE_ADMISSION': '1',
           'CASTLINK_LICENSE_ENFORCE': '0', 'CASTLINK_CONTROL_PLANE_URL': '', 'CASTLINK_LICENSE_SERVICE_URL': '',
           'STUDIOLINK_TRANSFER_ORIGIN': n['publicOrigin'], 'STUDIOLINK_TRANSFER_SERVER_ID': state['nodeId']}
    for filename, values in [('postgres.env', pg), ('web.env', env)]:
        write_private(folder / filename, ''.join(k + '=' + v + '\n' for k, v in values.items()))
    lk = {'port': 7880, 'log_level': 'info', 'rtc': {'tcp_port': n['iceTcpPort'], 'udp_port': n['iceUdpPort'],
          'use_external_ip': False, 'node_ip': n['mediaIp'], 'enable_loopback_candidate': ipv4(n['mediaIp']).is_loopback},
          'keys': {c['livekitKey']: c['livekitSecret']}, 'turn': {'enabled': True, 'udp_port': n['turnUdpPort'],
          'relay_range_start': n['relayPortStart'], 'relay_range_end': n['relayPortEnd'], 'allow_restricted_peer_cidrs': [n['mediaIp'] + '/32']}}
    write_private(folder / 'livekit.json', lk)
    write_private(folder / 'Caddyfile', caddy_config(state))
    media_bind = '127.0.0.1' if ipv4(n['mediaIp']).is_loopback else '0.0.0.0'
    ports = [f"{media_bind}:{n[k]}:{n[k]}/{proto}" for k, proto in [('iceTcpPort', 'tcp'), ('iceUdpPort', 'udp'), ('turnUdpPort', 'udp')]]
    ports.append(f"{media_bind}:{n['relayPortStart']}-{n['relayPortEnd']}:{n['relayPortStart']}-{n['relayPortEnd']}/udp")
    http = f"{n['bindAddress']}:{n['httpPort']}:{n['httpPort']}/tcp"
    https = f"{n['bindAddress']}:{n['httpsPort']}:{n['httpsPort']}/tcp"
    services = {
      'postgres': {'env_file': ['postgres.env'], 'volumes': ['postgres-data:/var/lib/postgresql/data'],
        'healthcheck': {'test': ['CMD-SHELL', 'pg_isready -U castlink -d castlink'], 'interval': '5s', 'timeout': '5s', 'retries': 24}},
      'web': {'env_file': ['web.env'], 'volumes': ['web-data:/data', 'converter-socket:/run/castlink-converter:ro'], 'depends_on': {'postgres': {'condition': 'service_healthy'}}},
      'livekit': {'command': ['--config', '/etc/livekit.yaml'], 'volumes': ['./livekit.json:/etc/livekit.yaml:ro'], 'ports': ports},
      'caddy': {'volumes': ['./Caddyfile:/etc/caddy/Caddyfile:ro', 'caddy-data:/data', 'caddy-config:/config'],
                'ports': [http, https] if n['mode'] == 'https' else [http], 'depends_on': ['web', 'livekit']}}
    services['presentation-converter'] = {'command': ['python3', '/app/scripts/presentation-converter/server.py'],
        'init': True, 'user': '10001:10001', 'read_only': True, 'network_mode': 'none', 'cap_drop': ['ALL'],
        'security_opt': ['no-new-privileges:true'], 'volumes': ['converter-socket:/run/castlink-converter'],
        'tmpfs': ['/tmp:size=512m,mode=1777'], 'mem_limit': '512m', 'pids_limit': 128, 'cpus': 1}
    for name, service in services.items():
        service.update(image=release['images']['web' if name == 'presentation-converter' else name], platform='linux/amd64', restart='unless-stopped', pull_policy='never')
    write_private(folder / 'compose.json', {'name': state['project'], 'services': services,
        'volumes': {name: {'name': state['project'] + '_' + name} for name in ['postgres-data', 'web-data', 'caddy-data', 'caddy-config', 'converter-socket']}})


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()


def safe_member(root, name):
    if not isinstance(name, str) or '\\' in name or Path(name).is_absolute() or '..' in Path(name).parts:
        raise ValueError('Unsafe package path')
    path = root / name
    if root.resolve() not in path.resolve().parents: raise ValueError('Unsafe package path')
    return path


def verify_package(package):
    package = Path(package).resolve()
    r = json.loads((package / 'payload/release.json').read_text(encoding='utf-8'))
    if r.get('schemaVersion') != 1 or not re.fullmatch('[a-f0-9]{40}', r.get('commit', '')): raise ValueError('Invalid release manifest')
    for key in ('web', 'postgres', 'livekit', 'caddy'):
        if r.get('images', {}).get(key) != 'castlink-easy-' + key + ':' + r['commit']: raise ValueError('Only packaged pinned release images are supported')
        if not re.fullmatch('sha256:[a-f0-9]{64}', r.get('imageIdentities', {}).get(key, '')): raise ValueError('Missing image identity')
    if r.get('imageArchive') != 'images.tar.gz': raise ValueError('Unsafe image archive path')
    files = {**r.get('bundleFiles', {}), **r.get('documentationFiles', {}), 'payload/images.tar.gz': r.get('imageArchiveSha256')}
    for name, expected in files.items():
        file = safe_member(package, name)
        if not file.is_file() or digest(file) != expected: raise ValueError('Package integrity check failed: ' + name)
    return r


def docker(args, folder=None, stdin=None, output=None):
    try:
        result = subprocess.run(['docker', *args], cwd=folder, input=stdin.encode() if stdin is not None else None,
                                stdout=output if output else subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    except FileNotFoundError: raise ValueError('Docker with Compose v2 is required') from None
    if result.returncode: raise ValueError('Docker operation failed; inspect this installation with docker compose ps/logs locally')
    return result.stdout.decode('utf-8', errors='replace') if result.stdout else ''


def compose(folder, state, args, **kwargs):
    return docker(['compose', '--project-name', state['project'], '-f', str(folder / 'compose.json'), *args], folder=folder, **kwargs)


def load_images(package, release):
    docker(['load', '--input', str(package / 'payload/images.tar.gz')])
    for name in ('web', 'postgres', 'livekit', 'caddy'):
        actual = json.loads(docker(['image', 'inspect', '--format', '{{json .}}', release['images'][name]]))
        # Verified archive + immutable per-commit RepoTags are the cross-store identity.
        # Producer Image IDs are diagnostic: classic/containerd stores may report different IDs.
        if (release['images'][name] not in actual.get('RepoTags', []) or actual.get('Os') != 'linux' or actual.get('Architecture') != 'amd64'):
            raise ValueError('Loaded release tag or Linux amd64 platform does not match package')


def bootstrap_ack(output, state, phase):
    for line in output.splitlines():
        try: value = json.loads(line)
        except ValueError: continue
        if not isinstance(value, dict): continue
        migrations = value.get('migrations', {})
        if not isinstance(migrations, dict): continue
        if (value.get('schemaVersion') == 1 and value.get('contract') == 'castlink-database-v1' and
                value.get('installationId') == state['installationId'] and value.get('nodeId') == state['nodeId'] and value.get('phase') == phase and
                migrations.get('schema') is True and migrations.get('hashes') is True and
                migrations.get('roomVersions') == [1,2,3,4,5,6] and migrations.get('controlVersions') == [1,2,3,4,5]):
            if phase == 'migrations' and value.get('seed') is None: return True
            if phase == 'seed' and value.get('seed') == {'installations':1,'accounts':1,'organizations':1,'memberships':1,'nodes':1,'studios':1,'rooms':0}: return True
    return False


SETUP_JS = '''const http=require('node:http');function req(method,body){return new Promise((resolve,reject)=>{const q=http.request({hostname:'127.0.0.1',port:3000,path:'/api/setup',method,headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000','content-type':'application/json','x-castlink-setup-token':process.env.CASTLINK_SETUP_TOKEN}},r=>{let b='';r.on('data',x=>b+=x);r.on('end',()=>resolve({status:r.statusCode,body:b}))});q.on('error',reject);q.setTimeout(15000,()=>q.destroy());q.end(body||'')})};(async()=>{const r=await req('POST',JSON.stringify({mode:'public',serverName:'CastLink'}));if(![200,409].includes(r.status))throw Error();const c=await req('GET');if(c.status!==200||JSON.parse(c.body).needsSetup!==false)throw Error()})().catch(()=>{process.exitCode=1});'''


READINESS_JS = r"""const fs=require('node:fs'),tls=require('node:tls');const c=JSON.parse(fs.readFileSync(0,'utf8'));const https=c.scheme==='https';const opts={hostname:'caddy',port:c.port,path:'/api/version',headers:{host:c.authority},timeout:12000};if(https){if(c.ca)opts.ca=fs.readFileSync(c.ca);opts.servername=require('node:net').isIP(c.host)?'':c.host;opts.checkServerIdentity=(_,cert)=>tls.checkServerIdentity(c.host,cert)}const req=require(https?'node:https':'node:http').get(opts,r=>{let b='';r.on('data',x=>{b+=x;if(b.length>65536)req.destroy()});r.on('end',()=>{try{if(r.statusCode!==200||JSON.parse(b).buildId!==c.buildId)throw Error();console.log('CASTLINK_ORIGIN_READY')}catch{process.exitCode=1}})});req.on('error',()=>{process.exitCode=1});req.on('timeout',()=>req.destroy());"""


def probe_origin(folder, state):
    n=state['network']; u=urlsplit(n['publicOrigin']); secure=n['mode']=='https'
    request={'scheme':'https' if secure else 'http', 'port':n['httpsPort'] if secure else n['httpPort'],
             'host':u.hostname, 'authority':u.netloc, 'buildId':state['release']['version']+'-'+state['release']['commit'][:12],
             'ca':'/data/server-origin-ca.pem' if secure and not state['publicHttps'] else None}
    for attempt in range(30):
        try:
            reply=compose(folder,state,['exec','-T','web','node','-e',READINESS_JS],stdin=json.dumps(request,separators=(',',':')))
            if reply.strip()!='CASTLINK_ORIGIN_READY': raise ValueError('Caddy origin readiness acknowledgement missing')
            return
        except ValueError:
            if attempt==29: raise ValueError('Caddy origin did not confirm the expected release with valid transport') from None
            time.sleep(2)


def complete(folder, state):
    for phase, predecessor in [('migrations', 'new'), ('seed', 'migrations')]:
        if state['databasePhase'] != predecessor: continue
        body = {key: state[key] for key in ('installationId', 'nodeId')}
        body.update(schemaVersion=1, phase=phase)
        result = compose(folder, state, ['exec', '-T', 'web', 'node', '/app/scripts/setup-database-v1.mjs'], stdin=json.dumps(body, separators=(',', ':')))
        if not bootstrap_ack(result, state, phase): raise ValueError('Database bootstrap acknowledgement missing or mismatched')
        state['databasePhase'] = phase; write_private(folder / STATE, state)
    compose(folder, state, ['exec', '-T', 'web', 'node', '/app/scripts/postgres-migrate.mjs'])
    for attempt in range(30):
        try:
            compose(folder, state, ['exec', '-T', 'web', 'node', '-e', SETUP_JS]); break
        except ValueError:
            if attempt == 29: raise
            time.sleep(2)
    if state['network']['mode']=='https' and not state['publicHttps']:
        for attempt in range(30):
            try:
                ca=compose(folder,state,['exec','-T','caddy','cat','/data/caddy/pki/authorities/local/root.crt'])
                if '-----BEGIN CERTIFICATE-----' not in ca: raise ValueError('Local Caddy CA is not ready')
                compose(folder,state,['exec','-T','web','node','-e',"const fs=require('node:fs');fs.writeFileSync('/data/server-origin-ca.pem',fs.readFileSync(0),{mode:0o600});fs.chmodSync('/data/server-origin-ca.pem',0o600)"],stdin=ca)
                break
            except ValueError:
                if attempt==29: raise
                time.sleep(2)
    probe_origin(folder,state)
    state['readiness']='local-ingress-only' if state['network']['mode']=='proxy' else 'origin-verified'
    state['completed'] = True; write_private(folder / STATE, state)


NETWORK_PROMPTS = {
 'ru': {'bindAddress':'IPv4 привязки Caddy', 'httpPort':'HTTP порт Caddy', 'httpsPort':'HTTPS порт Caddy',
        'iceTcpPort':'Медиа TCP порт', 'iceUdpPort':'Медиа UDP порт', 'turnUdpPort':'TURN UDP порт',
        'relayPortStart':'Первый UDP порт relay', 'relayPortEnd':'Последний UDP порт relay (1–1024 порта)',
        'invalid':'Недопустимое значение; повтори ввод', 'retry':'Проверь параметры и повтори настройку'},
 'en': {'bindAddress':'Caddy bind IPv4', 'httpPort':'Caddy HTTP port', 'httpsPort':'Caddy HTTPS port',
        'iceTcpPort':'Media TCP port', 'iceUdpPort':'Media UDP port', 'turnUdpPort':'TURN UDP port',
        'relayPortStart':'First relay UDP port', 'relayPortEnd':'Last relay UDP port (1–1024 ports)',
        'invalid':'Invalid value; try again', 'retry':'Check the values and repeat setup'},
 'zh-CN': {'bindAddress':'Caddy 绑定 IPv4', 'httpPort':'Caddy HTTP 端口', 'httpsPort':'Caddy HTTPS 端口',
        'iceTcpPort':'媒体 TCP 端口', 'iceUdpPort':'媒体 UDP 端口', 'turnUdpPort':'TURN UDP 端口',
        'relayPortStart':'Relay UDP 起始端口', 'relayPortEnd':'Relay UDP 结束端口（1–1024 个端口）',
        'invalid':'值无效，请重试', 'retry':'检查参数并重新设置'}
}


def quick_media_ip(origin):
    host = urlsplit(origin).hostname
    try:
        return str(ipv4(host))
    except ValueError:
        # Resolve the website's IPv4 only when it identifies a single server.
        # Multiple addresses or missing DNS need the operator's server address.
        try:
            addresses = {entry[4][0] for entry in socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)}
            if len(addresses) == 1: return str(ipv4(addresses.pop()))
        except (OSError, ValueError): pass
        return None


def interactive(lang, mode='quick'):
    t = LANG[lang]; labels = NETWORK_PROMPTS[lang]
    def ask(key, default, numeric=False):
        while True:
            value = input(labels[key] + ' [' + str(default) + ']: ').strip() or default
            try:
                if numeric:
                    number = int(value)
                    if not 1 <= number <= 65535: raise ValueError()
                    return number
                ipv4(value); return value
            except ValueError: print(labels['invalid'])
    while True:
        try:
            netmode = (input(t['network'] + ' [https]: ').strip() or 'https') if mode == 'advanced' else 'https'
            default_origin = ('http' if netmode == 'http' else 'https') + '://127.0.0.1'
            origin = input(t['origin'] + ' [' + default_origin + ']: ').strip() or default_origin
            if mode == 'quick' and '://' not in origin: origin = 'https://' + origin
            media = quick_media_ip(origin) if mode == 'quick' else None
            if media is None: media = input(t['media'] + ' [127.0.0.1]: ').strip() or '127.0.0.1'
            default_tls = 'yes' if ipv4(media).is_global else 'no'
            public = ((input(t['tls'] + ' [' + default_tls + ']: ').strip().lower() or default_tls) in ('yes', 'y') if mode == 'advanced' else default_tls == 'yes') if netmode == 'https' else False
            n = {'mode': netmode, 'publicOrigin': origin, 'mediaIp': media, 'bindAddress': '127.0.0.1' if netmode == 'proxy' or ipv4(media).is_loopback else '0.0.0.0',
                 'httpPort': 8080 if netmode == 'proxy' else 80, 'httpsPort': 443, 'iceTcpPort': 7881, 'iceUdpPort': 7882, 'turnUdpPort': 3478,
                 'relayPortStart': 30000, 'relayPortEnd': 30031, 'trustedProxies': []}
            if mode == 'advanced':
                n['bindAddress'] = ask('bindAddress', n['bindAddress'])
                for key in ('httpPort','httpsPort','iceTcpPort','iceUdpPort','turnUdpPort','relayPortStart','relayPortEnd'):
                    n[key] = ask(key, n[key], numeric=True)
            if netmode == 'proxy': n['trustedProxies'] = [v.strip() for v in input(t['trust'] + ': ').split(',') if v.strip()]
            return validate_config({'setupMode': mode, 'publicHttps': public, 'network': n})
        except ValueError as error: print(t['error'] + ': ' + str(error) + '. ' + labels['retry'])


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['init', 'validate', 'render', 'start', 'status', 'check-updates', 'update', 'updates'])
    p.add_argument('--state-dir', type=Path, default=Path('castlink-install'))
    p.add_argument('--package', type=Path, help='Use an already downloaded package; update otherwise downloads the current public Linux release')
    p.add_argument('--auto-check', choices=['on', 'off'], help='With updates: enable or disable automatic update checks')
    p.add_argument('--config', type=Path, help='JSON configuration for noninteractive init/validate')
    p.add_argument('--advanced', action='store_true', help='Ask for custom networking, ports and certificates during init')
    p.add_argument('--lang', choices=list(LANG), default='ru')
    args = p.parse_args(argv); t = LANG[args.lang]; folder = args.state_dir.resolve(); package = (args.package or Path(__file__).resolve().parents[1]).resolve()
    try:
        if args.command == 'validate':
            validate_config(json.loads(args.config.read_text()) if args.config else load_state(folder)); print(t['ready']); return 0
        if args.command == 'init':
            release = verify_package(package)
            c = json.loads(args.config.read_text()) if args.config else (load_state(folder) if (folder / STATE).exists() else interactive(args.lang, 'advanced' if args.advanced else 'quick'))
            state = init_state(folder, c, release); render(folder, state, state['release'])
        else:
            state = load_state(folder)
            if args.command == 'updates':
                if args.auto_check: set_update_preferences(folder, args.auto_check == 'on')
                print(json.dumps(update_preferences(folder))); return 0
            if args.command == 'check-updates':
                candidate = check_updates(state['release'])
                print((UPDATE_TEXT[args.lang]['available'] + ': ' + candidate['version'] + ' (' + candidate['commitPrefix'] + ')') if candidate else UPDATE_TEXT[args.lang]['latest'])
                if candidate: print(UPDATE_TEXT[args.lang]['manual'])
                return 0
            if args.command == 'render': render(folder, state, state['release'])
            elif args.command == 'status':
                print(public_status(state)); print(compose(folder, state, ['ps', '--format', 'json']))
                candidate = offer_update(folder, state, args.lang)
                if candidate:
                    print(t['stop'], flush=True)
                    with installation_lock(folder), downloaded_update(folder, candidate) as (downloaded, release):
                        state = load_state(folder)
                        if not state['completed']: raise ValueError('Finish the existing installation with start before updating')
                        apply_update(folder, state, downloaded, release, args.lang)
                return 0
            elif args.command in ('start', 'update'):
                with installation_lock(folder):
                    state = load_state(folder)
                    if args.command == 'update' and not state['completed']: raise ValueError('Finish the existing installation with start before updating')
                    if args.command == 'update' and args.package is None:
                        candidate = check_updates(state['release'])
                        if not candidate: print(UPDATE_TEXT[args.lang]['latest']); return 0
                        print(t['stop'], flush=True)
                        with downloaded_update(folder, candidate) as (downloaded, release):
                            apply_update(folder, state, downloaded, release, args.lang)
                    elif args.command == 'start' and args.package is None and (folder / IMAGE_RECEIPT).exists():
                        # A network update stages its package temporarily. Restarts use
                        # the installed image set, never the caller's old archive.
                        image_receipt(folder)
                        render(folder, state, state['release'])
                        compose(folder, state, ['up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '180'])
                        complete(folder, state)
                        cleanup_installation(folder, state, args.lang)
                    else:
                        release = verify_package(package)
                        if args.command == 'start' and release['commit'] != state['release']['commit']: raise ValueError('Use update for a different package version')
                        if args.command == 'update':
                            print(t['stop'], flush=True)
                            apply_update(folder, state, package, release, args.lang)
                        else:
                            load_images(package, release)
                            remember_images(folder, release)
                            render(folder, state, release)
                            state['completed'] = False; write_private(folder / STATE, state)
                            compose(folder, state, ['up', '-d', '--wait', '--wait-timeout', '180'])
                            complete(folder, state)
                            cleanup_installation(folder, state, args.lang)
                if args.command == 'start':
                    candidate = offer_update(folder, state, args.lang)
                    if candidate:
                        print(t['stop'], flush=True)
                        with installation_lock(folder), downloaded_update(folder, candidate) as (downloaded, release):
                            state = load_state(folder)
                            if not state['completed']: raise ValueError('Finish the existing installation with start before updating')
                            apply_update(folder, state, downloaded, release, args.lang)
        mode = state['network']['mode']
        if mode in ('http', 'proxy'): print(t[mode])
        if mode=='proxy' and state['completed']:
            message={'ru':'Локальный HTTP listener проверен; внешний HTTPS ещё не подтверждён','en':'Local HTTP ingress verified; external HTTPS has not been confirmed','zh-CN':'本地 HTTP 入口已验证；外部 HTTPS 尚未确认'}[args.lang]
            print(message + ': ' + state['network']['publicOrigin'])
        else: print(t['ready'] + ': ' + state['network']['publicOrigin'])
        return 0
    except (ValueError, OSError, KeyError, TypeError) as error:
        # Never echo Docker errors, stdin, environment, or secret-bearing configuration.
        print(t['error'] + ': ' + str(error), file=sys.stderr); return 1


if __name__ == '__main__': sys.exit(main())
