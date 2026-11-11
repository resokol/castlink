#!/usr/bin/python3
"""CastLink's Docker-free, dedicated WSL2 distro runtime (standard library only)."""
import argparse
import getpass
import fcntl
import errno
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import uuid
import warnings

STATE = Path('/var/lib/castlink-server')
CONFIG = Path('/etc/castlink-server')
APP = Path('/opt/castlink/app')
ASSETS = Path('/usr/lib/castlink-server')
RELEASE = Path('/opt/castlink/release.json')
OWNER = 'castlink-server-wsl-v1'
SERVICES = ['castlink-private-ports', 'castlink-postgres', 'castlink-bootstrap', 'castlink-converter', 'castlink-livekit', 'castlink-web', 'castlink-caddy', 'castlink-turn-tls']
TEXT = {
 'ru': {'password': 'Пароль создания комнат (8–256 символов): ', 'confirm': 'Повторите пароль: ', 'address': 'Адрес сервера (имя или IPv4): ', 'media': 'IPv4 сервера для медиа: ', 'ready': 'Сервер готов', 'preserved': 'Существующие настройки и данные сохранены', 'stopped': 'Сервер остановлен; данные сохранены', 'error': 'Ошибка'},
 'en': {'password': 'Room creation password (8–256 characters): ', 'confirm': 'Confirm password: ', 'address': 'Server address (hostname or IPv4): ', 'media': 'Server media IPv4: ', 'ready': 'Server ready', 'preserved': 'Existing settings and data preserved', 'stopped': 'Server stopped; data preserved', 'error': 'Error'},
 'zh-CN': {'password': '创建房间密码（8–256 个字符）：', 'confirm': '再次输入密码：', 'address': '服务器地址（域名或 IPv4）：', 'media': '服务器媒体 IPv4：', 'ready': '服务器已就绪', 'preserved': '已保留现有设置和数据', 'stopped': '服务器已停止，数据已保留', 'error': '错误'},
}


def write_private(path, value):
    path = Path(path)
    data = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n'
    temporary = path.with_name(path.name + '.tmp-' + secrets.token_hex(6))
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def address(value):
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError('A hostname or IPv4 address is required')
    value = value.lower()
    try:
        ip = ipaddress.IPv4Address(value)
        if ip.is_unspecified or ip.is_multicast or str(ip) == '255.255.255.255': raise ValueError()
        return str(ip)
    except ValueError:
        if re.fullmatch(r'[0-9.]+', value): raise ValueError('Invalid server IPv4 address') from None
    if len(value) > 253 or not all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label) for label in value.split('.')):
        raise ValueError('Invalid hostname')
    return value


def media_address(value):
    try:
        ip = ipaddress.IPv4Address(value)
        if ip.is_unspecified or ip.is_multicast or str(ip) == '255.255.255.255': raise ValueError()
        return str(ip)
    except (ValueError, TypeError): raise ValueError('A concrete server media IPv4 address is required') from None


def is_local(host):
    try: return not ipaddress.ip_address(host).is_global
    except ValueError: return host == 'localhost' or '.' not in host or host.endswith(('.local', '.localhost', '.lan'))


def password_hash(source, lang):
    try:
        if source:
            raw = Path(source).read_bytes()
            if len(raw) > 1024: raise ValueError('Room creation password is too long')
            value = raw.decode('utf-8')
        else:
            with warnings.catch_warnings():
                warnings.simplefilter('error', getpass.GetPassWarning)
                value = getpass.getpass(TEXT[lang]['password'])
                if value != getpass.getpass(TEXT[lang]['confirm']): raise ValueError('Room creation passwords do not match')
        if not 8 <= len(value.encode('utf-16-le')) // 2 <= 256 or not value.strip() or any(c in value for c in '\r\n\0'):
            raise ValueError('Room creation password must have 8–256 characters, without CR/LF/NUL or a blank value')
        return hashlib.sha256(value.encode('utf-8')).hexdigest()
    except (OSError, UnicodeError, EOFError, getpass.GetPassWarning):
        raise ValueError('Cannot securely read password; use a terminal or --room-creation-password-file (UTF-8, no trailing newline)') from None


def validate_release(release):
    if release.get('schemaVersion') != 1 or not re.fullmatch(r'[a-f0-9]{40}', release.get('commit', '')) or not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?', release.get('version', '')):
        raise ValueError('Invalid runtime release manifest')
    if release.get('buildId') != release['version'] + '-' + release['commit'][:12]: raise ValueError('Invalid runtime build identity')


def load_state(folder=None):
    folder = Path(STATE if folder is None else folder)
    try:
        state = json.loads((folder / 'state.json').read_text())
        credentials = json.loads((folder / 'secrets.json').read_text())
        if state.get('owner') != OWNER or state.get('schemaVersion') != 1: raise ValueError()
        if str(uuid.UUID(state['installationId'])) != state['installationId'] or state['nodeId'] != 'srv-' + state['installationId'].replace('-', ''): raise ValueError()
        if address(state['address']) != state['address'] or media_address(state['mediaIp']) != state['mediaIp']: raise ValueError()
        if address(state['turnHost']) != state['turnHost'] or state['origin'] != 'https://' + state['address']: raise ValueError()
        if type(state['publicHttps']) is not bool or state['databasePhase'] not in ('new', 'migrations', 'seed'): raise ValueError()
        if not re.fullmatch(r'[a-f0-9]{64}', state['roomCreationPasswordHash']): raise ValueError()
        if set(credentials) != {'password', 'livekitSecret', 'session', 'encryption', 'setupToken', 'nodeSecret', 'livekitKey'}: raise ValueError()
        for key, value in credentials.items():
            if not re.fullmatch(r'lk_[a-f0-9]{32}' if key == 'livekitKey' else r'[a-f0-9]{64}', value): raise ValueError()
        validate_release(state['release'])
        return state
    except (OSError, KeyError, TypeError, ValueError):
        raise ValueError('Existing installation is invalid or incomplete; restore its configuration and secrets from backup') from None


def init_state(folder, host, media_ip, release, creation_hash, turn_host=None, public_https=None):
    folder = Path(folder)
    validate_release(release)
    if (folder / 'state.json').exists():
        state = load_state(folder)
        if any(proposed is not None and proposed != state[key] for key, proposed in [('address', host), ('mediaIp', media_ip), ('turnHost', turn_host), ('publicHttps', public_https)]):
            raise ValueError('Saved network settings differ; existing installation was not changed')
        if state['release'] != release: raise ValueError('Runtime release differs from the existing installation; an explicit supported upgrade is required')
        return state
    if folder.exists() and any(folder.iterdir()): raise ValueError('Refusing to adopt a directory containing unrelated or incomplete installation files')
    host, media_ip = address(host), media_address(media_ip)
    if not isinstance(creation_hash, str) or not re.fullmatch(r'[a-f0-9]{64}', creation_hash): raise ValueError('A room creation password hash is required')
    turn_host = address(turn_host or (host if re.fullmatch(r'[0-9.]+', host) else 'turn.' + host))
    if turn_host == host and not re.fullmatch(r'[0-9.]+', host):
        raise ValueError('A hostname installation needs a separate TURN hostname (--turn-host); it must resolve to this server')
    iid = str(uuid.uuid4())
    state = {'schemaVersion': 1, 'owner': OWNER, 'installationId': iid, 'nodeId': 'srv-' + iid.replace('-', ''),
             'address': host, 'origin': 'https://' + host, 'mediaIp': media_ip, 'turnHost': turn_host,
             'publicHttps': not is_local(host) if public_https is None else public_https, 'roomCreationPasswordHash': creation_hash,
             'databasePhase': 'new', 'completed': False, 'release': release}
    credentials = {key: secrets.token_hex(32) for key in ('password', 'livekitSecret', 'session', 'encryption', 'setupToken', 'nodeSecret')}
    credentials['livekitKey'] = 'lk_' + secrets.token_hex(16)
    folder.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix='.castlink-init-', dir=folder.parent))
    try:
        write_private(staging / 'secrets.json', credentials)
        write_private(staging / 'state.json', state)
        if folder.exists(): folder.rmdir()
        os.replace(staging, folder)
        os.chmod(folder, 0o711)
    finally:
        if staging.exists(): shutil.rmtree(staging)
    return state


def configs(state, credentials):
    c, s = credentials, state
    env = {'NODE_ENV': 'production', 'NEXT_TELEMETRY_DISABLED': '1', 'NEXT_BUILD_DIR': '.next', 'HOSTNAME': '127.0.0.1', 'PORT': '3000',
      'CASTLINK_DEPLOYMENT_MODEL': 'self-hosted', 'CASTLINK_STORAGE_BACKEND': 'json',
      'DATABASE_URL': 'postgresql://castlink:' + c['password'] + '@127.0.0.1:5432/castlink',
      'LIVEKIT_SERVER_URL': 'http://127.0.0.1:7880', 'LIVEKIT_API_KEY': c['livekitKey'], 'LIVEKIT_API_SECRET': c['livekitSecret'],
      'CASTLINK_GUEST_RELAY_ENABLED': '1', 'CASTLINK_TURN_TRANSPORT': 'tls443', 'CASTLINK_SESSION_SECRET': c['session'],
      'CASTLINK_DATA_ENCRYPTION_KEY': c['encryption'], 'CASTLINK_SETUP_TOKEN': c['setupToken'],
      'STUDIOLINK_DATA_DIR': str(STATE / 'data'), 'STUDIOLINK_INSTALLATION_ID': s['installationId'],
      'STUDIOLINK_DEFAULT_STUDIO_ID': 'studio-default', 'CASTLINK_NODE_ID': s['nodeId'], 'CASTLINK_SERVER_ID': s['nodeId'],
      'CASTLINK_NODE_SECRET': c['nodeSecret'], 'CASTLINK_NODE_TYPE': 'self-hosted', 'CASTLINK_ENFORCE_NODE_ADMISSION': '1',
      'CASTLINK_LICENSE_ENFORCE': '0', 'CASTLINK_CONTROL_PLANE_URL': '', 'CASTLINK_LICENSE_SERVICE_URL': '',
      'STUDIOLINK_TRANSFER_ORIGIN': s['origin'], 'STUDIOLINK_TRANSFER_SERVER_ID': s['nodeId'],
      'ROOM_CREATION_PASSWORD_SHA256': s['roomCreationPasswordHash']}
    livekit = {'port': 7880, 'log_level': 'info', 'rtc': {'tcp_port': 7881, 'udp_port': 7882, 'use_external_ip': False,
       'node_ip': s['mediaIp'], 'enable_loopback_candidate': ipaddress.ip_address(s['mediaIp']).is_loopback},
       'keys': {c['livekitKey']: c['livekitSecret']}, 'turn': {'enabled': True, 'domain': s['turnHost'], 'udp_port': 3478,
       'tls_port': 5349, 'external_tls': True, 'proxy_protocol': True, 'proxy_protocol_trusted_cidrs': ['127.0.0.1/32'],
       'relay_range_start': 30000, 'relay_range_end': 30031, 'allow_restricted_peer_cidrs': [s['mediaIp'] + '/32']}}
    global_lines = ['{', ' admin off', ' auto_https disable_redirects', ' skip_install_trust', ' https_port 8443', ' default_sni ' + s['address'],
        ' servers :8443 {', '  protocols h1 h2', '  listener_wrappers {', '   proxy_protocol {', '    timeout 2s', '    allow 127.0.0.1/32',
        '    fallback_policy require', '   }', '   tls', '  }', ' }', '}']
    lines = global_lines
    for host in dict.fromkeys([s['address'], s['turnHost']]):
        lines += ['http://' + host + ' {', ' redir https://' + s['address'] + '{uri} permanent', '}', 'https://' + host + ' {']
        if not s['publicHttps']: lines += [' tls internal']
        else:
            lines += [' tls {', '  issuer acme {', '   disable_tlsalpn_challenge']
            if re.fullmatch(r'[0-9.]+', host): lines += ['   dir https://acme-v02.api.letsencrypt.org/directory', '   profile shortlived']
            lines += ['  }', ' }']
        if host == s['address']:
            lines += [' @rtc path /rtc /rtc/*', ' route @rtc {', '  forward_auth 127.0.0.1:3000 {', '   uri /api/media-admission',
                '   header_up -Upgrade', '   header_up -Connection', '   header_up Host ' + host, '   header_up X-Forwarded-Host ' + host,
                '   header_up X-Forwarded-Proto https', '  }', '  reverse_proxy 127.0.0.1:7880 {', '   header_up Host ' + host,
                '   header_up X-Forwarded-Proto https', '  }', ' }', ' reverse_proxy 127.0.0.1:3000 {', '  header_up Host ' + host,
                '  header_up X-Forwarded-Host ' + host, '  header_up X-Forwarded-Proto https', ' }']
        else: lines += [' respond 404']
        lines += ['}']
    return {'web.env': ''.join(k + '=' + v + '\n' for k, v in env.items()), 'livekit.json': json.dumps(livekit, indent=2) + '\n', 'Caddyfile': '\n'.join(lines) + '\n'}


def run(command, *, data=None, env=None, timeout=120, user=None):
    if user: command = ['/usr/sbin/runuser', '-u', user, '--', *command]
    try:
        result = subprocess.run(command, input=data, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=timeout, cwd=APP if APP.exists() else None)
    except (OSError, subprocess.TimeoutExpired): raise ValueError('Runtime operation failed: ' + Path(command[0]).name) from None
    if result.returncode: raise ValueError('Runtime operation failed; inspect journalctl for the corresponding castlink service')
    return result.stdout


def owned_dir(path, user, mode=0o700):
    path.mkdir(parents=True, exist_ok=True, mode=mode)
    account = pwd.getpwnam(user)
    os.chown(path, account.pw_uid, account.pw_gid)
    os.chmod(path, mode)


def materialize(state):
    CONFIG.mkdir(mode=0o755, parents=True, exist_ok=True)
    values = configs(state, json.loads((STATE / 'secrets.json').read_text()))
    owners = {'web.env': 'root', 'livekit.json': 'castlink-livekit', 'Caddyfile': 'castlink-caddy'}
    for name, value in values.items():
        target = CONFIG / name
        if target.exists():
            if target.read_text() != value: raise ValueError('Existing runtime configuration differs; it was not overwritten: ' + name)
        else:
            write_private(target, value)
            account = pwd.getpwnam(owners[name]); os.chown(target, account.pw_uid, account.pw_gid)
    for name, user in [('data', 'castlink'), ('postgres', 'postgres'), ('caddy', 'castlink-caddy')]: owned_dir(STATE / name, user)
    caddy_environment = dict(os.environ, XDG_DATA_HOME=str(STATE / 'caddy'), XDG_CONFIG_HOME=str(STATE / 'caddy/config'))
    run(['/usr/local/bin/caddy', 'validate', '--config', str(CONFIG / 'Caddyfile'), '--adapter', 'caddyfile'], env=caddy_environment, user='castlink-caddy')
    run(['/usr/bin/systemctl', 'daemon-reload'])


def web_env():
    # All generated values are restricted single-line tokens/addresses; no shell evaluation.
    environment = {key: os.environ[key] for key in ('PATH', 'LANG', 'LC_ALL', 'TZ') if key in os.environ}
    for line in (CONFIG / 'web.env').read_text().splitlines():
        key, value = line.split('=', 1); environment[key] = value
    environment['CASTLINK_CONTROL_PLANE_DATABASE_URL'] = environment['DATABASE_URL']
    return environment


def node(script, data=None, timeout=120):
    return run(['/usr/local/bin/node', str(script)], data=data, env=web_env(), timeout=timeout, user='castlink')


def postgres_init():
    state = load_state()
    directory = STATE / 'postgres'
    if (directory / 'PG_VERSION').exists():
        if not (directory / 'castlink-installation-id').is_file() or (directory / 'castlink-installation-id').read_text().strip() != state['installationId']:
            raise ValueError('Existing PostgreSQL cluster does not belong to this installation')
        if (directory / 'PG_VERSION').read_text().strip() != '16': raise ValueError('Existing PostgreSQL data is not version 16')
        return
    if any(directory.iterdir()): raise ValueError('Refusing to initialize nonempty PostgreSQL data')
    run(['/usr/lib/postgresql/16/bin/initdb', '-D', str(directory), '--auth-local=peer', '--auth-host=scram-sha-256', '--encoding=UTF8', '--locale=C.UTF-8'], user='postgres')
    with (directory / 'postgresql.conf').open('a') as handle:
        handle.write("\nlisten_addresses = '127.0.0.1'\nport = 5432\nunix_socket_directories = '/run/castlink-postgres'\npassword_encryption = 'scram-sha-256'\n")
    write_private(directory / 'castlink-installation-id', state['installationId'] + '\n')
    account = pwd.getpwnam('postgres'); os.chown(directory / 'castlink-installation-id', account.pw_uid, account.pw_gid)


def database_bootstrap():
    state = load_state(); credentials = json.loads((STATE / 'secrets.json').read_text())
    if not state.get('postgresRoleCreated'):
        # No credential argument or log output. Refuse an existing foreign role/database.
        query = "SELECT count(*) FROM pg_roles WHERE rolname='castlink'; SELECT count(*) FROM pg_database WHERE datname='castlink';"
        observed = run(['/usr/lib/postgresql/16/bin/psql', '-h', '/run/castlink-postgres', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], data=query, user='postgres')
        if observed.strip() != '0\n0': raise ValueError('Existing CastLink database/role was not created by this installation; refusing adoption')
        sql = "SET log_statement = 'none'; SET log_min_error_statement = 'panic'; CREATE ROLE castlink LOGIN PASSWORD '" + credentials['password'] + "'; CREATE DATABASE castlink OWNER castlink;"
        run(['/usr/lib/postgresql/16/bin/psql', '-h', '/run/castlink-postgres', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], data=sql, user='postgres')
        state['postgresRoleCreated'] = True; write_private(STATE / 'state.json', state)
    for phase, predecessor in [('migrations', 'new'), ('seed', 'migrations')]:
        if state['databasePhase'] != predecessor: continue
        body = {'installationId': state['installationId'], 'nodeId': state['nodeId'], 'schemaVersion': 1, 'phase': phase}
        raw = node(APP / 'scripts/setup-database-v1.mjs', json.dumps(body, separators=(',', ':')))
        try: ack = json.loads(raw.strip())
        except ValueError: raise ValueError('Database bootstrap returned an invalid acknowledgement') from None
        migration = ack.get('migrations', {})
        expected_seed = {'installations': 1, 'accounts': 1, 'organizations': 1, 'memberships': 1, 'nodes': 1, 'studios': 1, 'rooms': 0}
        if any(ack.get(k) != body[k] for k in body) or ack.get('contract') != 'castlink-database-v1' or migration != {'roomVersions': [1,2,3,4,5,6], 'controlVersions': [1,2,3,4,5], 'schema': True, 'hashes': True} or ack.get('seed') != (expected_seed if phase == 'seed' else None):
            raise ValueError('Database bootstrap acknowledgement did not match this installation')
        state['databasePhase'] = phase; write_private(STATE / 'state.json', state)
    node(APP / 'scripts/postgres-migrate.mjs')


def setup_web():
    node(ASSETS / 'setup-web.mjs')


def health(state):
    request = {'installationId': state['installationId'], 'nodeId': state['nodeId'], 'host': state['address'],
       'buildId': state['release']['buildId'], 'publicHttps': state['publicHttps'], 'turnHost': state['turnHost'],
       'ca': str(STATE / 'caddy/caddy/pki/authorities/local/root.crt')}
    # Read CA as root and pass only public certificate to the unprivileged observer.
    if not state['publicHttps']:
        try: request['caPem'] = Path(request['ca']).read_text()
        except OSError: raise ValueError('Local TLS authority is not ready') from None
        target = STATE / 'data/server-origin-ca.pem'
        if not target.exists() or target.read_text() != request['caPem']:
            write_private(target, request['caPem'])
            account = pwd.getpwnam('castlink'); os.chown(target, account.pw_uid, account.pw_gid)
    raw = node(ASSETS / 'health.mjs', json.dumps(request, separators=(',', ':')), timeout=35)
    if raw.strip() != 'CASTLINK_SERVER_READY': raise ValueError('Server readiness acknowledgement missing')
    if not Path('/run/castlink-turn-tls/ready').is_file(): raise ValueError('TURN TLS certificate is not ready')


def certificate(state, runtime):
    host = state['turnHost']; ca = Path('/etc/ssl/certs/ca-certificates.crt') if state['publicHttps'] else STATE / 'caddy/caddy/pki/authorities/local/root.crt'
    storage = STATE / 'caddy/caddy/certificates'
    for source in storage.glob('*/' + host + '/' + host + '.crt'):
        key = source.with_suffix('.key')
        try:
            cert_data, key_data = source.read_bytes(), key.read_bytes()
            (runtime / 'candidate.crt').write_bytes(cert_data); (runtime / 'candidate.key').write_bytes(key_data)
            match_option = '-checkip' if re.fullmatch(r'[0-9.]+', host) else '-checkhost'
            run(['/usr/bin/openssl', 'x509', '-in', str(runtime / 'candidate.crt'), '-noout', match_option, host])
            run(['/usr/bin/openssl', 'x509', '-in', str(runtime / 'candidate.crt'), '-noout', '-checkend', '60'])
            run(['/usr/bin/openssl', 'verify', '-CAfile', str(ca), '-untrusted', str(runtime / 'candidate.crt'), str(runtime / 'candidate.crt')])
            public = run(['/usr/bin/openssl', 'x509', '-in', str(runtime / 'candidate.crt'), '-pubkey', '-noout'])
            if public != run(['/usr/bin/openssl', 'pkey', '-in', str(runtime / 'candidate.key'), '-pubout']): continue
            pem = cert_data + key_data; fingerprint = hashlib.sha256(pem).hexdigest()
            destination = runtime / (fingerprint + '.pem')
            if not destination.exists(): write_private(destination, pem.decode('ascii'))
            return destination
        except (ValueError, OSError, UnicodeError): continue
    return None


def haproxy_config(state, pem):
    host = state['turnHost']
    config = '''global
  log stdout format raw local0
  master-worker
  user castlink-turn
  group castlink-turn
  stats socket /run/castlink-turn-tls/admin.sock mode 600 level admin expose-fd listeners
defaults
  mode tcp
  log global
  timeout connect 5s
  timeout client 1h
  timeout server 1h
frontend public_tls
  bind :443
  tcp-request inspect-delay 5s
  tcp-request content accept if { req.ssl_hello_type 1 }
'''
    if host != state['address']: config += '  use_backend turn_entry if { req.ssl_sni -i ' + host + ' }\n'
    config += '''  use_backend turn_entry if { req.ssl_hello_type 1 } !{ req.ssl_sni -m found } !{ req.ssl_alpn -m found }
  default_backend web_tls
backend web_tls
  server caddy 127.0.0.1:8443 send-proxy-v2 check
backend turn_entry
  server terminate 127.0.0.1:5348 send-proxy-v2
'''
    if pem:
        config += '''frontend turn_tls
  bind 127.0.0.1:5348 ssl crt ''' + str(pem) + ''' accept-proxy ssl-min-ver TLSv1.2
  default_backend livekit_turn
backend livekit_turn
  server livekit 127.0.0.1:5349 send-proxy-v2 check
'''
    return config


def turn_daemon():
    state = load_state(); runtime = Path('/run/castlink-turn-tls'); runtime.mkdir(mode=0o700, exist_ok=True)
    ready = runtime / 'ready'; ready.unlink(missing_ok=True)
    previous = certificate(state, runtime)
    config = runtime / 'haproxy.cfg'; write_private(config, haproxy_config(state, previous))
    run(['/usr/sbin/haproxy', '-c', '-f', str(config)])
    process = subprocess.Popen(['/usr/sbin/haproxy', '-W', '-db', '-f', str(config)])
    stopping = False
    def stop(_signum, _frame):
        nonlocal stopping
        stopping = True
        process.terminate()
    signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
    if previous: write_private(ready, 'ready\n')
    try:
        while process.poll() is None and not stopping:
            for _ in range(15):
                if stopping or process.poll() is not None: break
                time.sleep(1)
            selected = certificate(state, runtime)
            if selected:
                if selected != previous:
                    candidate = runtime / 'haproxy.new'; write_private(candidate, haproxy_config(state, selected))
                    run(['/usr/sbin/haproxy', '-c', '-f', str(candidate)])
                    os.replace(candidate, config); process.send_signal(signal.SIGUSR2); previous = selected
                write_private(ready, 'ready\n')
            else: ready.unlink(missing_ok=True)
    finally:
        ready.unlink(missing_ok=True)
        if process.poll() is None: process.terminate()
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: process.kill(); process.wait()
    if not stopping: raise ValueError('TURN TLS listener stopped unexpectedly')


def start(state):
    run(['/usr/bin/systemctl', 'enable', 'castlink-server.target'])
    run(['/usr/bin/systemctl', 'start', 'castlink-server.target'], timeout=240)
    # Service jobs do not establish TLS, schema or application readiness themselves.
    deadline = time.monotonic() + 180
    while True:
        try:
            setup_web(); health(state); break
        except ValueError:
            if time.monotonic() >= deadline: raise ValueError('Server readiness failed; inspect journalctl -u castlink-web -u castlink-bootstrap -u castlink-caddy -u castlink-turn-tls') from None
            time.sleep(2)
    state['completed'] = True
    state['readiness'] = 'https-db-livekit-verified'
    write_private(STATE / 'state.json', state)


def stop_services():
    # A target stop job may finish before its PartOf service jobs. Wait for
    # every owned listener before reporting success or allowing a restart.
    run(['/usr/bin/systemctl', 'disable', 'castlink-server.target'])
    run(['/usr/bin/systemctl', 'stop', 'castlink-server.target', *SERVICES], timeout=180)


def owner_access(state):
    if state.get('completed') is not True or state.get('databasePhase') != 'seed':
        raise ValueError('Start and complete this server before requesting owner access')
    destination = STATE / ('owner-access-' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-' + secrets.token_hex(8) + '.txt')
    # The console operator program writes a root-owned 0600 file with O_EXCL.
    # Its normal console message is deliberately captured, never printed.
    run(['/usr/local/bin/node', str(APP / 'scripts/super-admin-owner.mjs'), '--origin', state['origin'], '--output', str(destination)], env=web_env())
    info = destination.stat()
    if info.st_uid != os.geteuid() or info.st_mode & 0o777 != 0o600 or not destination.is_file():
        raise ValueError('Owner invitation file permissions were not private')
    return {'ownerAccessFile': str(destination), 'expiresInSeconds': 900}


def preflight_ports():
    try:
        nftables = json.loads(run(['/usr/sbin/nft', '-j', 'list', 'tables']))['nftables']
        if not isinstance(nftables, list): raise ValueError()
    except (KeyError, TypeError, ValueError):
        raise ValueError('Cannot inspect nftables ownership; firewall was not changed') from None
    if any(item.get('table', {}).get('family') == 'inet' and item.get('table', {}).get('name') == 'castlink_private' for item in nftables):
        raise ValueError('Firewall table inet castlink_private already exists; refusing to adopt or delete it. Inspect its ownership before retrying')
    # WSL distros can share networking. Refuse occupied ports before adding our
    # table, so a foreign listener is never silently blocked or displaced.
    held = []
    try:
        for kind, ports in [(socket.SOCK_STREAM, [80,443,3000,5432,5348,5349,7880,7881,8443]),
                            (socket.SOCK_DGRAM, [3478,7882,*range(30000,30032)])]:
            for port in ports:
                for family, host in [(socket.AF_INET, '0.0.0.0'), (socket.AF_INET6, '::')]:
                    try: listener = socket.socket(family, kind)
                    except OSError as error:
                        if family == socket.AF_INET6 and error.errno == errno.EAFNOSUPPORT: continue
                        raise ValueError('Cannot inspect required CastLink listener ports') from None
                    held.append(listener)
                    if kind == socket.SOCK_STREAM: listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    if family == socket.AF_INET6: listener.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
                    try: listener.bind((host, port))
                    except OSError as error:
                        if family == socket.AF_INET6 and error.errno == errno.EADDRNOTAVAIL: continue
                        raise ValueError('Required CastLink port is already in use or unavailable: ' + str(port) + ('/tcp' if kind == socket.SOCK_STREAM else '/udp')) from None
    finally:
        for listener in held: listener.close()


def runtime_status(state):
    active = {}
    for name in SERVICES:
        result = subprocess.run(['/usr/bin/systemctl', 'is-active', name], text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
        active[name] = result.stdout.strip()
    target = subprocess.run(['/usr/bin/systemctl', 'is-enabled', 'castlink-server.target'], text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
    stopped = target.stdout.strip() == 'disabled' and all(value == 'inactive' for value in active.values())
    verified = False
    if all(active[name] == 'active' for name in SERVICES):
        try: health(state); verified = True
        except ValueError: pass
    payload = {'origin': state['origin'], 'mediaIp': state['mediaIp'], 'turnHost': state['turnHost'],
       'buildId': state['release']['buildId'], 'ready': verified, 'stopped': stopped, 'readiness': 'https-db-livekit-verified' if verified else ('stopped' if stopped else 'not-ready'),
       'mediaTested': False, 'caPath': None if state['publicHttps'] else str(STATE / 'caddy/caddy/pki/authorities/local/root.crt'), 'services': active}
    return payload, 0 if verified or stopped else 3


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'start', 'status', 'stop', 'owner-access', 'preflight', 'postgres-init', 'bootstrap', 'turn-daemon'])
    parser.add_argument('--address'); parser.add_argument('--media-ip'); parser.add_argument('--turn-host')
    parser.add_argument('--room-creation-password-file', type=Path)
    parser.add_argument('--lang', choices=list(TEXT), default='ru')
    tls = parser.add_mutually_exclusive_group(); tls.add_argument('--public-https', action='store_true', default=None); tls.add_argument('--local-https', dest='public_https', action='store_false')
    args = parser.parse_args(argv)
    if os.geteuid() != 0: raise ValueError('Run castlink-server as root inside its dedicated WSL distro')
    if args.command != 'init' and any([args.address, args.media_ip, args.turn_host, args.room_creation_password_file, args.public_https is not None]):
        raise ValueError('Setup options require init; saved settings were not changed')
    operation_lock = None
    if args.command in ('init', 'start', 'stop', 'status', 'owner-access'):
        operation_lock = os.open('/run/castlink-server.lock', os.O_CREAT | os.O_RDWR, 0o600)
        fcntl.flock(operation_lock, fcntl.LOCK_EX)
    if args.command == 'preflight': preflight_ports(); return
    if args.command == 'postgres-init': postgres_init(); return
    if args.command == 'bootstrap': database_bootstrap(); return
    if args.command == 'turn-daemon': turn_daemon(); return
    text = TEXT[args.lang]
    if args.command == 'init':
        existing = (STATE / 'state.json').exists()
        if not existing and STATE.exists() and any(STATE.iterdir()): raise ValueError('Installation directory already contains data; refusing adoption')
        host = address(args.address or input(text['address']).strip()) if not existing else (address(args.address) if args.address else None)
        media = media_address(args.media_ip or (host if re.fullmatch(r'[0-9.]+', host) else input(text['media']).strip())) if not existing else (media_address(args.media_ip) if args.media_ip else None)
        # A rerun never reads or replaces a room-creation password.
        hashed = None if existing else password_hash(args.room_creation_password_file, args.lang)
        state = init_state(STATE, host, media, json.loads(RELEASE.read_text()), hashed, address(args.turn_host) if args.turn_host else None, args.public_https)
        materialize(state)
        print(text['preserved'] if existing else state['origin'])
        return
    state = load_state()
    if args.command == 'owner-access':
        print(json.dumps(owner_access(state))); return
    if args.command == 'stop':
        stop_services(); print(text['stopped']); return
    if args.command == 'start': start(state); print(text['ready'] + ': ' + state['origin']); return
    payload, code = runtime_status(state)
    print(json.dumps(payload, ensure_ascii=False))
    return code


if __name__ == '__main__':
    try: sys.exit(main() or 0)
    except (ValueError, OSError, EOFError) as error:
        # Fail closed without serializing subprocess stderr, credentials or SQL.
        print('CastLink: ' + (str(error) if isinstance(error, ValueError) else 'Runtime operation failed'), file=sys.stderr)
        sys.exit(2)
