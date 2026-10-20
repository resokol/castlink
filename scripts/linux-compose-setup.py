#!/usr/bin/env python3
"""Standalone CastLink Linux package installer. Python 3 standard library only."""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import time
import uuid
from urllib.parse import urlsplit

STATE = '.castlink-install.json'
OWNER = 'castlink-linux-compose-v1'
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


def backup(folder, state):
    target = folder / 'backups' / (time.strftime('%Y%m%d-%H%M%S', time.gmtime()) + '-' + secrets.token_hex(4))
    target.mkdir(parents=True, mode=0o700)
    os.chmod(target.parent, 0o700)
    for name in (STATE, 'secrets.json', 'compose.json', 'postgres.env', 'web.env', 'livekit.json', 'Caddyfile'):
        shutil.copyfile(folder / name, target / name); os.chmod(target / name, 0o600)
    # Freeze application writers while taking the SQL snapshot and JSON data archive.
    # LiveKit is not paused. Always resume web even when a backup command fails.
    compose(folder, state, ['pause', 'web'])
    try:
        with (target / 'postgres.dump').open('wb') as handle:
            compose(folder, state, ['exec', '-T', 'postgres', 'pg_dump', '-U', 'castlink', '-d', 'castlink', '-Fc'], output=handle)
        with (target / 'web-data.tar').open('wb') as handle:
            docker(['run', '--pull', 'never', '--rm', '--network', 'none', '--user', '0:0', '--entrypoint', 'tar', '-v',
                    state['project'] + '_web-data:/data:ro', state['release']['images']['web'], '-C', '/data', '-cf', '-', '.'], output=handle)
    finally:
        compose(folder, state, ['unpause', 'web'])
    for name in ('postgres.dump', 'web-data.tar'):
        os.chmod(target / name, 0o600)
        if not (target / name).stat().st_size: raise ValueError('Backup is empty')
    # Validate both archives before loading replacement images or changing configuration.
    docker(['run', '--pull', 'never', '--rm', '--network', 'none', '--user', '0:0', '--entrypoint', 'pg_restore', '-v', str(target) + ':/backup:ro', state['release']['images']['postgres'], '--list', '/backup/postgres.dump'])
    docker(['run', '--pull', 'never', '--rm', '--network', 'none', '--user', '0:0', '--entrypoint', 'tar', '-v', str(target) + ':/backup:ro', state['release']['images']['web'], '-tf', '/backup/web-data.tar'])
    write_private(target / 'SHA256SUMS', ''.join(digest(p) + '  ' + p.name + '\n' for p in sorted(target.iterdir()) if p.is_file()))
    return target


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


def interactive(lang):
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
            mode = input(t['mode'] + ' [quick]: ').strip() or 'quick'
            netmode = (input(t['network'] + ' [https]: ').strip() or 'https') if mode == 'advanced' else 'https'
            default_origin = ('http' if netmode == 'http' else 'https') + '://127.0.0.1'
            origin = input(t['origin'] + ' [' + default_origin + ']: ').strip() or default_origin
            media = input(t['media'] + ' [127.0.0.1]: ').strip() or '127.0.0.1'
            default_tls = 'yes' if ipv4(media).is_global else 'no'
            public = (input(t['tls'] + ' [' + default_tls + ']: ').strip().lower() or default_tls) in ('yes', 'y') if netmode == 'https' else False
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
    p.add_argument('command', choices=['init', 'validate', 'render', 'start', 'status', 'backup', 'update'])
    p.add_argument('--state-dir', type=Path, default=Path('castlink-install'))
    p.add_argument('--package', type=Path, default=Path(__file__).resolve().parents[1])
    p.add_argument('--config', type=Path, help='JSON configuration for noninteractive init/validate')
    p.add_argument('--lang', choices=list(LANG), default='ru')
    args = p.parse_args(argv); t = LANG[args.lang]; folder = args.state_dir.resolve(); package = args.package.resolve()
    try:
        if args.command == 'validate':
            validate_config(json.loads(args.config.read_text()) if args.config else load_state(folder)); print(t['ready']); return 0
        if args.command == 'init':
            release = verify_package(package)
            c = json.loads(args.config.read_text()) if args.config else (load_state(folder) if (folder / STATE).exists() else interactive(args.lang))
            state = init_state(folder, c, release); render(folder, state, state['release'])
        else:
            state = load_state(folder)
            if args.command == 'render': render(folder, state, state['release'])
            elif args.command == 'status':
                print(public_status(state)); print(compose(folder, state, ['ps', '--format', 'json'])); return 0
            elif args.command == 'backup': print(t['backup'] + ': ' + str(backup(folder, state))); return 0
            elif args.command in ('start', 'update'):
                release = verify_package(package)
                if args.command == 'start' and release['commit'] != state['release']['commit']: raise ValueError('Use update for a different package version')
                if args.command == 'update':
                    if not state['completed']: raise ValueError('Finish the existing installation with start before updating')
                    print(t['stop'], flush=True)
                    print(t['backup'] + ': ' + str(backup(folder, state)), flush=True)
                load_images(package, release)
                render(folder, state, release)
                # Record the intended version for explicit retry after a failure; no data rollback.
                state['release'] = release; state['completed'] = False; write_private(folder / STATE, state)
                compose(folder, state, ['up', '-d', '--wait', '--wait-timeout', '180'])
                complete(folder, state)
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
