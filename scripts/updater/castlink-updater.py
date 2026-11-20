#!/usr/bin/env python3
"""Permanent CastLink Linux updater. Python 3 standard library; no background service."""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import types
import json
import os
from pathlib import Path
import platform
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

API = 'https://api.github.com/repos/resokol/castlink/releases'
DOWNLOAD = 'https://github.com/resokol/castlink/releases/download/'
TAG = re.compile(r'updater-v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))-([a-f0-9]{12})')
SEMVER = re.compile(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)')
TOOLS = ('castlink-updater.py', 'linux-compose-setup.py')
PRODUCT_FILES = ('CastLink-Linux.tar.gz', 'SHA256SUMS', 'manifest.json', 'CastLink-Provisioning.json',
                 'CastLink-ThirdParty-Sources.tar.gz', 'CastLink-ThirdParty-Office-Sources.tar.gz')
OWNER = 'castlink-persistent-updater-v1'
TEXT = {
 'en': {'error':'Updater error', 'latest':'No new server version is available.', 'available':'Server update available',
        'confirm':'Updates restart services. End live sessions first. Apply this update? [y/N]: ',
        'cancel':'Update cancelled.', 'installed':'Persistent updater installed', 'select':'Select an installation with --state-dir',
        'current':'Current', 'target':'Target', 'preferences':'Automatic checks', 'on':'on', 'off':'off'},
 'ru': {'error':'Ошибка обновлятора', 'latest':'Новых версий сервера нет.', 'available':'Доступно обновление сервера',
        'confirm':'Обновление перезапустит службы. Завершите активные сеансы. Применить обновление? [y/Н]: ',
        'cancel':'Обновление отменено.', 'installed':'Постоянный обновлятор установлен', 'select':'Выберите установку через --state-dir',
        'current':'Текущая версия', 'target':'Новая версия', 'preferences':'Автоматическая проверка', 'on':'включена', 'off':'выключена'},
 'zh-CN': {'error':'更新工具错误', 'latest':'服务器已是最新版本。', 'available':'服务器有新版本',
        'confirm':'更新将重启服务。请先结束正在进行的会话。应用此更新？[y/N]：',
        'cancel':'已取消更新。', 'installed':'已安装永久更新工具', 'select':'请使用 --state-dir 选择安装',
        'current':'当前版本', 'target':'目标版本', 'preferences':'自动检查', 'on':'开启', 'off':'关闭'}
}


def version(value):
    match = SEMVER.fullmatch(value or '')
    if not match: raise ValueError('Invalid stable version')
    return tuple(map(int, match.groups()))


def json_bytes(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result: raise ValueError('Duplicate JSON key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs)


def regular(path, limit=None):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o022:
        raise ValueError('Unsafe updater file: ' + str(path))
    if limit is not None and info.st_size > limit: raise ValueError('Updater file exceeds size limit')


def private_directory(path):
    path = Path(path)
    # Refuse links in all existing components; do not silently adopt another owner's cache.
    for parent in [path, *path.parents]:
        if parent.is_symlink(): raise ValueError('Updater directory contains a symbolic link')
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    info = path.stat()
    if info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError('Updater directory must be private and owned by the current user: ' + str(path))
    return path


def read_json(path):
    regular(path, 1024 * 1024)
    value = json_bytes(path.read_bytes())
    if not isinstance(value, dict): raise ValueError('Expected updater JSON object')
    return value


def atomic_write(path, data, mode=0o600):
    if path.is_symlink(): raise ValueError('Refusing a symbolic link destination')
    fd, temporary = tempfile.mkstemp(prefix='.write-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as out:
            os.fchmod(out.fileno(), mode)
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def save_json(path, data):
    atomic_write(path, (json.dumps(data, ensure_ascii=False, indent=2)+'\n').encode())


@contextmanager
def updater_lock(root):
    private_directory(root)
    fd = os.open(root / '.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        regular(root / '.lock')
        try: fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise ValueError('Another updater operation is already running') from None
        yield
    finally: os.close(fd)


class Redirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlsplit(newurl)
        if (parsed.scheme != 'https' or parsed.hostname not in ('github.com', 'api.github.com',
                'release-assets.githubusercontent.com', 'objects.githubusercontent.com') or parsed.username or parsed.password or parsed.port not in (None, 443)):
            raise ValueError('Unexpected release redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url, limit):
    if not (re.fullmatch(re.escape(API)+r'(?:\?per_page=100&page=[0-9]+|/[0-9]+)', url)
            or re.fullmatch(re.escape(DOWNLOAD)+r'(?:updater|linux)-v[0-9A-Za-z.-]+-[a-f0-9]{12}/[A-Za-z0-9_.-]+', url)):
        raise ValueError('Unexpected release URL')
    deadline = time.monotonic() + 120
    with build_opener(Redirects()).open(Request(url, headers={'User-Agent':'CastLink-Updater', 'Accept':'application/vnd.github+json'}), timeout=20) as response:
        data = bytearray()
        while True:
            block = response.read(min(65536, limit + 1 - len(data)))
            if not block: break
            data.extend(block)
            if len(data) > limit or time.monotonic() > deadline: raise ValueError('Release response exceeds size or time limit')
    return bytes(data)


def catalog():
    records = []
    for page in range(1, 11):
        batch = json_bytes(fetch(API + f'?per_page=100&page={page}', 4 * 1024 * 1024))
        if not isinstance(batch, list): raise ValueError('Invalid release catalog')
        records.extend(batch)
        if len(batch) < 100: return records
    raise ValueError('Release catalog exceeds discovery limit; refusing incomplete results')


def stable_record(record):
    return (isinstance(record, dict) and record.get('draft') is False and record.get('prerelease') is False
            and isinstance(record.get('published_at'), str) and bool(record['published_at'])
            and type(record.get('id')) is int and record['id'] > 0)


def select_updater(records):
    candidates = [r for r in records if isinstance(r, dict) and r.get('draft') is False and r.get('prerelease') is False and TAG.fullmatch(r.get('tag_name', ''))]
    if any(not stable_record(r) for r in candidates): raise ValueError('Invalid stable updater release metadata')
    if not candidates: raise ValueError('No stable updater release is available')
    candidates.sort(key=lambda r: version(TAG.fullmatch(r['tag_name'])[1]), reverse=True)
    highest = version(TAG.fullmatch(candidates[0]['tag_name'])[1])
    if len({r['tag_name'] for r in candidates if version(TAG.fullmatch(r['tag_name'])[1]) == highest}) > 1:
        raise ValueError('Ambiguous updater version identity')
    return candidates[0]


def release_identity(record):
    if not isinstance(record, dict) or not isinstance(record.get('assets'), list):
        raise ValueError('Invalid release metadata')
    fields = ('id', 'name', 'state', 'size', 'digest', 'browser_download_url')
    assets = []
    for item in record['assets']:
        if not isinstance(item, dict) or not isinstance(item.get('name'), str): raise ValueError('Invalid release asset')
        assets.append({key:item.get(key) for key in fields})
    return {**{key:record.get(key) for key in ('id', 'tag_name', 'target_commitish', 'draft', 'prerelease', 'published_at')},
            'assets': sorted(assets, key=lambda item:item['name'])}


def pinned(record):
    if not stable_record(record): raise ValueError('Invalid stable release identity')
    exact = json_bytes(fetch(API + '/' + str(record['id']), 4 * 1024 * 1024))
    if not stable_record(exact) or release_identity(exact) != release_identity(record):
        raise ValueError('Release identity changed during discovery')
    return exact


def asset(record, name, limit):
    items = record.get('assets')
    if not isinstance(items, list): raise ValueError('Missing release assets')
    matches = [a for a in items if isinstance(a, dict) and a.get('name') == name]
    if len(matches) != 1: raise ValueError('Missing or duplicate release asset: ' + name)
    item = matches[0]
    if (item.get('state') != 'uploaded' or type(item.get('id')) is not int or item['id'] <= 0
            or type(item.get('size')) is not int or not 0 < item['size'] <= limit
            or not re.fullmatch(r'sha256:[a-f0-9]{64}', item.get('digest', ''))
            or item.get('browser_download_url') != DOWNLOAD + record['tag_name'] + '/' + name):
        raise ValueError('Invalid release asset metadata: ' + name)
    return item


def verified_bytes(record, name, limit):
    item = asset(record, name, limit)
    raw = fetch(item['browser_download_url'], limit)
    if len(raw) != item['size'] or 'sha256:'+hashlib.sha256(raw).hexdigest() != item['digest']:
        raise ValueError('Release integrity check failed: ' + name)
    return raw


def validate_manifest(manifest, record):
    if not isinstance(manifest, dict): raise ValueError('Invalid updater manifest')
    tag = TAG.fullmatch(record.get('tag_name', ''))
    if (not tag or type(manifest.get('schemaVersion')) is not int or manifest.get('schemaVersion') != 1 or manifest.get('channel') != 'updater'
            or manifest.get('repository') != 'resokol/castlink' or manifest.get('releaseTag') != record['tag_name']
            or manifest.get('version') != tag[1] or not re.fullmatch(r'[a-f0-9]{40}', manifest.get('sourceCommit', ''))
            or manifest['sourceCommit'][:12] != tag[2] or record.get('target_commitish') != manifest['sourceCommit']):
        raise ValueError('Updater manifest source/tag identity mismatch')
    if type(manifest.get('protocolVersion')) is not int or manifest.get('protocolVersion') != 1: raise ValueError('Unsupported updater protocol; obtain a newer official installer')
    platforms = manifest.get('platforms')
    linux = platforms.get('linux', {}) if isinstance(platforms, dict) else {}
    files = linux.get('files')
    if linux.get('entry') != TOOLS[0] or not isinstance(files, list) or len(files) != len(TOOLS):
        raise ValueError('Invalid Linux tool inventory')
    seen = set()
    for entry in files:
        if not isinstance(entry, dict): raise ValueError('Invalid tool entry')
        name = entry.get('file')
        if name not in TOOLS or name in seen: raise ValueError('Unsafe or duplicate tool path')
        seen.add(name)
        if type(entry.get('size')) is not int or not 0 < entry['size'] <= 4*1024*1024 or not re.fullmatch(r'[a-f0-9]{64}', entry.get('sha256', '')):
            raise ValueError('Invalid tool digest or size')
        metadata = asset(record, name, 4*1024*1024)
        if metadata['size'] != entry['size'] or metadata['digest'] != 'sha256:'+entry['sha256']:
            raise ValueError('Manifest and asset metadata disagree')
    return files


def verify_bundle(bundle, record=None):
    private_directory(bundle)
    if {item.name for item in bundle.iterdir()} != {*TOOLS, 'receipt.json', 'manifest.json'}:
        raise ValueError('Unexpected files in updater cache')
    receipt = read_json(bundle / 'receipt.json')
    if record is not None and release_identity(receipt) != release_identity(record): raise ValueError('Cached release metadata changed')
    record = receipt
    raw = (bundle / 'manifest.json')
    regular(raw, 1024*1024)
    metadata = asset(record, 'manifest.json', 1024*1024)
    data = raw.read_bytes()
    if len(data) != metadata['size'] or 'sha256:'+hashlib.sha256(data).hexdigest() != metadata['digest']:
        raise ValueError('Cached manifest integrity failure')
    manifest = json_bytes(data)
    for item in validate_manifest(manifest, record):
        path = bundle / item['file']
        regular(path, 4*1024*1024)
        data = path.read_bytes()
        if len(data) != item['size'] or hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError('Cached tool integrity failure: '+item['file'])
    return manifest


def active_record(root):
    if not (root / 'active.json').exists(): return {'current': None, 'previous': None}
    active = read_json(root / 'active.json')
    for key in ('current', 'previous'):
        if active.get(key) is not None and not TAG.fullmatch(active[key]): raise ValueError('Invalid active updater identity')
    return active


def prepare(root, record):
    record = pinned(record)
    if not TAG.fullmatch(record.get('tag_name', '')): raise ValueError('Invalid updater tag')
    versions = private_directory(root / 'versions')
    active = active_record(root)
    current = active['current']
    if current:
        previous = verify_bundle(versions / current)
        if version(TAG.fullmatch(record['tag_name'])[1]) < version(previous['version']): raise ValueError('Refusing updater downgrade')
        if version(TAG.fullmatch(record['tag_name'])[1]) == version(previous['version']) and current != record['tag_name']:
            raise ValueError('Updater version has conflicting source identity')
    for old in versions.iterdir():
        if TAG.fullmatch(old.name) and old.name not in {current, active['previous'], record['tag_name']}:
            verify_bundle(old)
            shutil.rmtree(old)
    bundle = versions / record['tag_name']
    if bundle.exists() or bundle.is_symlink():
        verify_bundle(bundle, record)
        return bundle
    data = verified_bytes(record, 'manifest.json', 1024*1024)
    manifest = json_bytes(data)
    inventory = validate_manifest(manifest, record)
    # Remove only abandoned staging directories owned by this private updater root.
    for abandoned in versions.glob('.stage-*'):
        if abandoned.is_symlink(): raise ValueError('Unsafe abandoned cache entry')
        private_directory(abandoned)
        shutil.rmtree(abandoned)
    staging = Path(tempfile.mkdtemp(prefix='.stage-', dir=versions))
    try:
        atomic_write(staging / 'manifest.json', data)
        save_json(staging / 'receipt.json', record)
        for item in inventory: atomic_write(staging / item['file'], verified_bytes(record, item['file'], 4*1024*1024))
        verify_bundle(staging, record)
        os.replace(staging, bundle)
    finally:
        if staging.exists(): shutil.rmtree(staging)
    return bundle


def activate(root, bundle):
    verify_bundle(bundle)
    active = active_record(root)
    if active['current'] == bundle.name: return
    try:
        probe = subprocess.run([sys.executable, '-I', '-B', str(bundle / TOOLS[0]), '--probe'], stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
    except (OSError, subprocess.TimeoutExpired) as error:
        shutil.rmtree(bundle)
        raise ValueError('Updater activation probe failed; previous version retained') from error
    if probe.returncode:
        shutil.rmtree(bundle)
        raise ValueError('Updater activation probe failed; previous version retained')
    save_json(root / 'active.json', {'current': bundle.name, 'previous': active['current']})
    keep = {bundle.name, active['current']}
    for child in (root / 'versions').iterdir():
        if child.name not in keep and TAG.fullmatch(child.name):
            private_directory(child)
            shutil.rmtree(child)


def load_adapter(bundle):
    # Never import a cached .pyc or a sibling module from the download directory.
    source = bundle / TOOLS[1]
    regular(source, 4*1024*1024)
    module = types.ModuleType('castlink_linux_adapter')
    module.__file__ = str(source)
    exec(compile(source.read_bytes(), str(source), 'exec'), module.__dict__)
    return module


def registry(root):
    path = root / 'registry.json'
    if not path.exists(): return {'schemaVersion':1, 'owner':OWNER, 'language':'ru', 'installations':[]}
    result = read_json(path)
    if result.get('owner') != OWNER or result.get('schemaVersion') != 1 or not isinstance(result.get('installations'), list):
        raise ValueError('Invalid updater registration')
    return result


def choose_installation(adapter, registrations, requested):
    items = registrations['installations']
    if requested is None:
        if len(items) != 1: raise ValueError(TEXT[registrations.get('language', 'ru')]['select'] + ': ' + ', '.join(i['path'] for i in items))
        item = items[0]
    else:
        folder = Path(requested).absolute()
        matches = [i for i in items if i['path'] == str(folder)]
        if len(matches) != 1: raise ValueError('Installation is not registered; use install --state-dir PATH')
        item = matches[0]
    folder = Path(item['path'])
    if not folder.is_absolute() or folder.resolve() != folder: raise ValueError('Installation moved or uses a symbolic link; register its actual path explicitly')
    state = adapter.load_state(folder)
    if state['installationId'] != item['installationId']: raise ValueError('Registered installation identity changed')
    return folder, state


def register(adapter, registrations, folder):
    folder = Path(folder).absolute()
    if folder.resolve() != folder: raise ValueError('Use the actual absolute installation path, without symbolic links')
    state = adapter.load_state(folder)
    # No user state, credentials or server settings are copied into this registry.
    entries = registrations['installations']
    for item in entries:
        if item['path'] == str(folder) and item['installationId'] != state['installationId']:
            raise ValueError('Registered path now belongs to another installation')
        if item['installationId'] == state['installationId'] and item['path'] != str(folder):
            if Path(item['path']).exists() or Path(item['path']).is_symlink():
                raise ValueError('Installation identity also exists at its registered path; resolve the duplicate explicitly')
            # install --state-dir is explicit authorization to attach this verified moved state.
            item['path'] = str(folder)
    if not any(i['path'] == str(folder) for i in entries):
        entries.append({'path': str(folder), 'installationId': state['installationId']})


def select_product(current):
    candidates = []
    for record in catalog():
        if not isinstance(record, dict) or record.get('draft') is not False or record.get('prerelease') is not False: continue
        match = re.fullmatch(r'linux-v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))-([a-f0-9]{12})', record.get('tag_name', ''))
        if not match: continue
        if not stable_record(record): raise ValueError('Invalid stable Linux release metadata')
        candidates.append({**record, 'version':match[1], 'commitPrefix':match[2]})
    if not candidates: return None
    candidates.sort(key=lambda r: (version(r['version']), r['published_at']), reverse=True)
    target = candidates[0]
    # Stable releases may update an RC, but never move back from a newer numeric version.
    old = current.get('version', '').split('-', 1)[0]
    if version(target['version']) < version(old) or target['commitPrefix'] == current.get('commit', '')[:12]: return None
    if version(target['version']) == version(old) and '-' not in current.get('version', ''):
        raise ValueError('Same product version has a different source; explicit release resolution required')
    for name in PRODUCT_FILES: asset(target, name, 8*1024**3)
    return target


def verify_product_release(candidate):
    record = pinned(candidate)
    manifest = json_bytes(verified_bytes(record, 'manifest.json', 1024*1024))
    if not isinstance(manifest, dict): raise ValueError('Invalid Linux release manifest')
    if (type(manifest.get('schemaVersion')) is not int or manifest.get('schemaVersion') != 1 or manifest.get('track') != 'linux' or manifest.get('version') != candidate['version']
            or manifest.get('architecture', 'amd64') != 'amd64' or manifest.get('repository') != 'resokol/castlink' or not re.fullmatch(r'[a-f0-9]{40}', manifest.get('sourceCommit', ''))
            or manifest['sourceCommit'][:12] != candidate['commitPrefix'] or manifest.get('tag') != candidate['tag_name']):
        raise ValueError('Linux release manifest identity or architecture mismatch')
    if record.get('target_commitish') != manifest['sourceCommit']:
        raise ValueError('Linux release source identity mismatch')
    return manifest


@contextmanager
def verified_product_download(adapter, folder, candidate):
    manifest = verify_product_release(candidate)
    original = adapter.download_asset
    def checked(record, name, destination, limit):
        metadata = asset(record, name, limit)
        original(record, name, destination, limit)
        if destination.stat().st_size != metadata['size'] or 'sha256:'+adapter.digest(destination) != metadata['digest']:
            raise ValueError('Linux asset metadata digest mismatch: '+name)
    adapter.download_asset = checked
    try:
        with adapter.downloaded_update(folder, candidate) as (package, release):
            if release.get('commit') != manifest['sourceCommit'] or release.get('track') != 'linux' or release.get('version') != candidate['version']:
                raise ValueError('Verified package source identity mismatch')
            yield package, release
    finally: adapter.download_asset = original


def product_command(adapter, registrations, command, requested, lang, auto_check):
    text = TEXT[lang]
    folder, state = choose_installation(adapter, registrations, requested)
    if command == 'updates':
        if auto_check: adapter.set_update_preferences(folder, auto_check == 'on')
        print(text['preferences']+': '+text['on' if adapter.update_preferences(folder)['autoCheck'] else 'off'])
        return 0
    if platform.machine().lower() not in ('x86_64', 'amd64'): raise ValueError('Linux server updates require amd64 architecture')
    candidate = select_product(state['release'])
    if not candidate:
        print(text['latest']); return 0
    verify_product_release(candidate)
    print(text['available']+': '+candidate['version'])
    print(str(folder)+' · '+state['network']['publicOrigin'])
    print(text['current']+': '+state['release']['version']+' → '+text['target']+': '+candidate['version'])
    print(candidate.get('body') or '')
    if command == 'check-updates': return 0
    try: answer = input(text['confirm']).strip().lower()
    except EOFError: answer = ''
    if answer not in ('y', 'yes', 'да', '是'):
        print(text['cancel']); return 0
    with adapter.installation_lock(folder):
        fresh = adapter.load_state(folder)
        if fresh['installationId'] != state['installationId'] or fresh['release'] != state['release']:
            raise ValueError('Installation identity or version changed after confirmation; check again')
        if not fresh.get('completed'): raise ValueError('Finish or recover the existing installation before updating')
        with verified_product_download(adapter, folder, candidate) as (package, release):
            latest = adapter.load_state(folder)
            if latest['installationId'] != state['installationId'] or latest['release'] != state['release']:
                raise ValueError('Installation changed during download')
            adapter.apply_update(folder, latest, package, release, lang)
    return 0


def default_root():
    return Path('/var/lib/castlink-updater') if os.geteuid() == 0 else Path.home() / '.local/share/castlink-updater'


def launcher_bytes(root):
    return ('#!/bin/sh\n# '+OWNER+'\nexec python3 -I -B '+shlex.quote(str(root / 'bootstrap.py'))+' --install-root '+shlex.quote(str(root))+' "$@"\n').encode()


def install_launcher(root, bindir):
    bindir = Path(bindir).absolute()
    for component in [bindir, *bindir.parents]:
        if component.is_symlink(): raise ValueError('Command directory contains a symbolic link')
    bindir.mkdir(parents=True, exist_ok=True)
    destination = bindir / 'castlink'
    expected = launcher_bytes(root)
    if destination.exists() or destination.is_symlink():
        regular(destination, 16384)
        if destination.read_bytes() != expected: raise ValueError('Existing castlink command is not owned by this updater (possibly @castlink/cli)')
    existing = shutil.which('castlink')
    if existing and Path(existing).absolute() != destination:
        raise ValueError('Another castlink command is present on PATH; choose an unambiguous command environment')
    atomic_write(destination, expected, 0o755)
    return destination


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', nargs='?', choices=('install', 'check-updates', 'update', 'updates'))
    p.add_argument('--state-dir', type=Path)
    p.add_argument('--lang', choices=tuple(TEXT))
    p.add_argument('--auto-check', choices=('on', 'off'))
    p.add_argument('--install-root', type=Path, default=default_root())
    p.add_argument('--bin-dir', type=Path)
    p.add_argument('--engine', action='store_true', help=argparse.SUPPRESS)
    p.add_argument('--probe', action='store_true', help=argparse.SUPPRESS)
    return p


def main(argv=None):
    p = parser()
    args = p.parse_args(argv)
    lang = args.lang or 'ru'
    try:
        if args.probe:
            load_adapter(Path(__file__).resolve().parent)
            return 0
        if not args.command: p.error('command required')
        if args.auto_check and args.command != 'updates': p.error('--auto-check requires updates')
        if args.bin_dir and args.command != 'install': p.error('--bin-dir requires install')
        root = args.install_root.absolute()
        if args.engine:
            bundle = Path(__file__).resolve().parent
            active = active_record(root)
            if bundle != root / 'versions' / str(active['current']): raise ValueError('Engine is not the active installed updater')
            verify_bundle(bundle)
            adapter = load_adapter(bundle)
            registrations = registry(root)
            lang = args.lang or registrations['language']
            registrations['language'] = lang
            save_json(root / 'registry.json', registrations)
            return product_command(adapter, registrations, args.command, args.state_dir, lang, args.auto_check)
        with updater_lock(root):
            registrations = registry(root)
            lang = args.lang or registrations['language']
            # Preferences remain available offline; every tool is still checked against its stored metadata.
            active = active_record(root)
            if args.command == 'updates' and active['current']:
                bundle = root / 'versions' / active['current']
                verify_bundle(bundle)
            else:
                bundle = prepare(root, select_updater(catalog()))
                activate(root, bundle)
            if args.command == 'install':
                if args.state_dir is None: raise ValueError('--state-dir must identify an existing installation')
                adapter = load_adapter(bundle)
                register(adapter, registrations, args.state_dir)
                registrations['language'] = lang
                bindir = args.bin_dir or (Path('/usr/local/bin') if os.geteuid() == 0 else Path.home() / '.local/bin')
                # Check collisions before writing the permanent bootstrap and registration.
                bootstrap = root / 'bootstrap.py'
                if bootstrap.exists() or bootstrap.is_symlink():
                    regular(bootstrap, 4*1024*1024)
                    if hashlib.sha256(bootstrap.read_bytes()).hexdigest() != registrations.get('bootstrapSha256'):
                        raise ValueError('Existing bootstrap is not owned by this updater registration')
                command = install_launcher(root, bindir)
                # The permanent bootstrap stays fixed; subsequent launches run the latest engine.
                # Persist ownership before the first atomic bootstrap write so an interruption
                # immediately after that write remains safely retryable.
                if not bootstrap.exists():
                    bootstrap_data = (bundle / TOOLS[0]).read_bytes()
                    registrations['bootstrapSha256'] = hashlib.sha256(bootstrap_data).hexdigest()
                    save_json(root / 'registry.json', registrations)
                    atomic_write(bootstrap, bootstrap_data)
                else:
                    save_json(root / 'registry.json', registrations)
                print(TEXT[lang]['installed']+': '+str(command))
                return 0
            forwarded = [args.command, '--install-root', str(root), '--lang', lang, '--engine']
            if args.state_dir: forwarded += ['--state-dir', str(args.state_dir)]
            if args.auto_check: forwarded += ['--auto-check', args.auto_check]
            return subprocess.run([sys.executable, '-I', '-B', str(bundle / TOOLS[0]), *forwarded]).returncode
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(TEXT[lang]['error']+': '+str(error), file=sys.stderr)
        return 1

if __name__ == '__main__': sys.exit(main())
