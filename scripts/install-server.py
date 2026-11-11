"""Release-pinned Linux bootstrap, embedded in install-server.sh by the packager."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

PIN = None  # @@CASTLINK_RELEASE_PIN@@
STATE = '.castlink-install.json'
RECEIPT = '.castlink-bootstrap.json'
PACKAGE = '.castlink-package'
OWNER = 'castlink-server-bootstrap-v1'
ARCHIVE = 'CastLink-Linux.tar.gz'
MAX_ARCHIVE = 4 * 1024 ** 3
MAX_UNPACKED = 8 * 1024 ** 3
MARGIN = 64 * 1024 ** 2


class BootstrapError(ValueError):
    pass


def validate_pin(pin):
    if not isinstance(pin, dict) or pin.get('repository') != 'resokol/castlink':
        raise BootstrapError('Use install-server.sh from a published Linux release; this source is not an installer.')
    version = pin.get('version', '')
    commit = pin.get('sourceCommit', '')
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?', version) or not re.fullmatch(r'[a-f0-9]{40}', commit):
        raise BootstrapError('Invalid pinned Linux release identity.')
    if pin.get('tag') != 'linux-v' + version + '-' + commit[:12] or not re.fullmatch(r'[a-f0-9]{64}', pin.get('archiveSha256', '')):
        raise BootstrapError('Invalid pinned Linux package checksum or channel.')
    if type(pin.get('archiveBytes')) is not int or not 0 < pin['archiveBytes'] <= MAX_ARCHIVE:
        raise BootstrapError('Linux package exceeds its download limit.')
    return pin


def validate_platform(os_release=None):
    fields = {}
    for line in (os_release or Path('/etc/os-release')).read_text(encoding='utf-8').splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            fields[key] = value.strip('"\'')
    if fields.get('ID') != 'ubuntu' or fields.get('VERSION_ID') not in ('22.04', '24.04') or platform.machine() != 'x86_64':
        raise BootstrapError('This release supports Ubuntu 22.04/24.04 amd64.')
    if os.geteuid() != 0:
        raise BootstrapError('Run the installer as root (sudo bash); server data stays in --state-dir.')


def command(arguments, timeout=30, capture=True):
    environment = dict(os.environ)
    environment.pop('DOCKER_CONTEXT', None)
    environment['DOCKER_HOST'] = 'unix:///var/run/docker.sock'
    environment['DEBIAN_FRONTEND'] = 'noninteractive'
    return subprocess.run(arguments, env=environment, stdin=subprocess.DEVNULL,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None, timeout=timeout, check=False)


def compose_ready():
    try: result = command(['docker', 'compose', 'version', '--short'], timeout=15)
    except (OSError, subprocess.TimeoutExpired): return False
    match = re.fullmatch(r'v?(\d+)\.(\d+)\.(\d+)(?:[-+][^\s]+)?', result.stdout.decode().strip())
    return result.returncode == 0 and bool(match) and tuple(map(int, match.group(1, 2, 3))) >= (2, 23, 1)


def runtime_ready():
    try:
        engine = command(['docker', 'info', '--format', '{{.OSType}}'], timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return False
    return engine.returncode == 0 and engine.stdout.strip() == b'linux' and compose_ready()


def install_runtime():
    """Use Ubuntu's existing engine, or Docker's official apt packages if absent."""
    def apt(arguments):
        result = command(['apt-get', '-o', 'DPkg::Lock::Timeout=60', *arguments], timeout=900, capture=False)
        if result.returncode:
            raise BootstrapError('Prerequisite installation failed. Fix apt and rerun the same command.')
    engine_present = shutil.which('docker') is not None
    if engine_present and compose_ready():
        active = command(['systemctl', 'is-active', '--quiet', 'docker'])
        if active.returncode and command(['systemctl', 'start', 'docker'], timeout=120, capture=False).returncode:
            raise BootstrapError('Docker did not start; inspect its service logs and rerun.')
        return
    apt(['update'])
    apt(['install', '-y', 'ca-certificates'])
    available = command(['apt-cache', 'show', 'docker-compose-plugin'])
    if available.returncode:
        fields = dict(line.split('=', 1) for line in Path('/etc/os-release').read_text().splitlines() if '=' in line)
        codename = fields.get('VERSION_CODENAME', '').strip('"\'')
        if codename not in ('jammy', 'noble'):
            raise BootstrapError('Cannot identify the Ubuntu Docker package repository.')
        directory = Path('/etc/apt/keyrings'); directory.mkdir(mode=0o755, exist_ok=True)
        key = directory / 'castlink-docker.asc'
        with build_opener().open('https://download.docker.com/linux/ubuntu/gpg', timeout=15) as response:
            data = response.read(128 * 1024 + 1)
        if len(data) > 128 * 1024 or not data.startswith(b'-----BEGIN PGP PUBLIC KEY BLOCK-----'):
            raise BootstrapError('Invalid Docker apt repository key.')
        source = Path('/etc/apt/sources.list.d/castlink-docker.list')
        source_bytes = ('deb [arch=amd64 signed-by=' + str(key) + '] https://download.docker.com/linux/ubuntu ' + codename + ' stable\n').encode()
        for file, content in ((key, data), (source, source_bytes)):
            if file.is_symlink() or file.exists() and file.read_bytes() != content:
                raise BootstrapError('Existing Docker repository configuration differs; it was not replaced.')
        for file, content in ((key, data), (source, source_bytes)):
            if not file.exists():
                with file.open('xb') as output: output.write(content)
                file.chmod(0o644)
        apt(['update'])
    apt(['install', '-y', *(['docker-compose-plugin'] if engine_present else ['docker-ce', 'docker-ce-cli', 'containerd.io', 'docker-buildx-plugin', 'docker-compose-plugin'])])
    active = command(['systemctl', 'is-active', '--quiet', 'docker'])
    if active.returncode and command(['systemctl', 'start', 'docker'], timeout=120, capture=False).returncode:
        raise BootstrapError('Docker did not start; inspect its service logs and rerun.')


def ensure_runtime(allow_install):
    if runtime_ready(): return
    if not allow_install:
        raise BootstrapError('Docker Engine and Compose >= 2.23.1 must be running. Start the existing engine, or rerun with --install-runtime to install/start prerequisites through apt.')
    print('Preparing Docker Engine and Compose with apt...', flush=True)
    install_runtime()
    if not runtime_ready(): raise BootstrapError('Docker Engine/Compose is still unavailable; inspect the service before retrying.')


class ReleaseRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlsplit(newurl)
        if parsed.scheme != 'https' or parsed.hostname not in ('github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com') or parsed.username or parsed.password:
            raise BootstrapError('Unexpected release download redirect.')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def release_response(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname != 'github.com' or not parsed.path.startswith('/resokol/castlink/releases/download/linux-v') or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise BootstrapError('Invalid pinned Linux release URL.')
    return build_opener(ReleaseRedirect()).open(Request(url, headers={'User-Agent': 'CastLink-Server-Installer'}), timeout=15)


def download(url, target, limit, expected_bytes=None):
    size = 0
    deadline = time.monotonic() + 1800
    with release_response(url) as response:
        length = response.headers.get('Content-Length')
        if length is not None and (not length.isascii() or not length.isdigit() or int(length) > limit or expected_bytes is not None and int(length) != expected_bytes):
            raise BootstrapError('Release download has an unexpected size.')
        with Path(target).open('xb') as output:
            Path(target).chmod(0o600)
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk: break
                size += len(chunk)
                if size > limit or time.monotonic() > deadline:
                    raise BootstrapError('Release download exceeded its size or time limit.')
                output.write(chunk)
    if expected_bytes is not None and size != expected_bytes or length is not None and size != int(length):
        raise BootstrapError('Release download is incomplete.')


def digest(file):
    result = hashlib.sha256()
    with Path(file).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''): result.update(chunk)
    return result.hexdigest()


def safe_extract(archive, target):
    """Validate every member before creating any files, never use extractall."""
    target = Path(target)
    if target.is_symlink() or any(target.iterdir()): raise BootstrapError('Package extraction target must be empty.')
    with tarfile.open(archive, 'r:gz') as tar:
        members = []
        kinds = {}
        total = 0
        for member in tar:
            name = member.name.rstrip('/')
            parts = name.split('/')
            if (not name or len(name) > 4096 or '\\' in name or '\x00' in name or any(p in ('', '.', '..') for p in parts)
                    or PurePosixPath(name).is_absolute() or name in kinds or not (member.isfile() or member.isdir())):
                raise BootstrapError('Unsafe Linux package archive.')
            kinds[name] = member.isdir()
            total += member.size
            members.append(member)
            if len(members) > 50000 or total > MAX_UNPACKED: raise BootstrapError('Linux package archive exceeds its extraction limit.')
        for name in kinds:
            parts = name.split('/')
            if any(kinds.get('/'.join(parts[:i])) is False for i in range(1, len(parts))):
                raise BootstrapError('Unsafe Linux package parent path.')
        if shutil.disk_usage(target).free < total + MARGIN: raise BootstrapError('Not enough free disk space to unpack the package.')
        for member in members:
            destination = target.joinpath(*member.name.rstrip('/').split('/'))
            if member.isdir(): destination.mkdir(parents=True, exist_ok=True, mode=0o700)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with tar.extractfile(member) as source, destination.open('xb') as output: shutil.copyfileobj(source, output)
                destination.chmod(0o600)


def read_json(file, limit=2 * 1024 ** 2):
    if file.is_symlink() or not file.is_file() or file.stat().st_size > limit:
        raise BootstrapError('Invalid installation/package metadata; existing data was retained.')
    value = json.loads(file.read_text(encoding='utf-8'))
    if not isinstance(value, dict): raise BootstrapError('Invalid installation/package metadata.')
    return value


def verify_package(package, pin):
    if package.is_symlink() or not package.is_dir(): raise BootstrapError('Invalid installed package directory.')
    release = read_json(package / 'payload/release.json')
    if any(release.get(key) != expected for key, expected in [('track', 'linux'), ('commit', pin['sourceCommit']), ('version', pin['version']), ('tag', pin['tag']), ('distributionRepository', pin['repository'])]):
        raise BootstrapError('Package does not match the pinned Linux release.')
    helper = package / 'scripts/linux-compose-setup.py'
    expected = release.get('bundleFiles', {}).get('scripts/linux-compose-setup.py')
    if helper.is_symlink() or not helper.is_file() or digest(helper) != expected:
        raise BootstrapError('Linux installer helper checksum mismatch.')
    if not (package / 'payload/images.tar.gz').is_file(): raise BootstrapError('Linux server images are missing.')


def stage_package(folder, pin):
    package = folder / PACKAGE
    if package.exists() or package.is_symlink():
        verify_package(package, pin)
        return package
    if shutil.disk_usage(folder).free < pin['archiveBytes'] * 2 + MARGIN:
        raise BootstrapError('Not enough free disk space to download and unpack the server.')
    base = 'https://github.com/' + pin['repository'] + '/releases/download/' + pin['tag'] + '/'
    with tempfile.TemporaryDirectory(prefix='.castlink-download-', dir=folder) as temporary:
        temporary = Path(temporary)
        sums = temporary / 'SHA256SUMS'
        print('Downloading pinned Linux release ' + pin['tag'] + '...', flush=True)
        download(base + 'SHA256SUMS', sums, 128 * 1024)
        checks = re.findall(r'^([a-f0-9]{64})  CastLink-Linux\.tar\.gz\r?$', sums.read_text(encoding='utf-8'), re.MULTILINE)
        if checks != [pin['archiveSha256']]: raise BootstrapError('Linux release checksum does not match this installer.')
        archive = temporary / ARCHIVE
        download(base + ARCHIVE, archive, MAX_ARCHIVE, pin['archiveBytes'])
        if digest(archive) != pin['archiveSha256']: raise BootstrapError('Linux package checksum mismatch.')
        extracted = temporary / 'package'; extracted.mkdir(mode=0o700)
        safe_extract(archive, extracted)
        verify_package(extracted, pin)
        extracted.rename(package)
    return package


def inspect_target(folder, allow_new_lock=False):
    if folder == Path('/') or folder.is_symlink() or folder.exists() and not folder.is_dir():
        raise BootstrapError('Choose a separate real installation directory; target was not changed.')
    if not folder.exists(): return None
    if (folder / RECEIPT).exists():
        receipt = read_json(folder / RECEIPT, 64 * 1024)
        if receipt.get('schemaVersion') != 1 or receipt.get('owner') != OWNER:
            raise BootstrapError('This directory belongs to a different installer; it was retained.')
        validate_pin(receipt.get('release'))
        return receipt
    if any(not allow_new_lock or p.name != '.castlink-bootstrap.lock' for p in folder.iterdir()):
        raise BootstrapError('Installation directory is not empty and is not owned by this bootstrap; existing files were retained. Choose another --state-dir.')
    return None


def installed_state(folder, pin):
    if not (folder / STATE).exists(): return None
    state = read_json(folder / STATE)
    if state.get('owner') != 'castlink-linux-compose-v1' or state.get('release', {}).get('commit') != pin['sourceCommit'] or not re.fullmatch(r'[a-f0-9-]{36}', state.get('installationId', '')):
        raise BootstrapError('Existing installation identity differs; use its original installer. Data was not changed.')
    return state


def show_existing(folder, state):
    print('CastLink is already configured; services and saved settings were not changed.')
    print('Installation: ' + str(folder))
    print('Saved address (live availability was not checked): ' + str(state.get('network', {}).get('publicOrigin', '')))


def run_helper(package, folder, action, args):
    arguments = [sys.executable, str(package / 'scripts/linux-compose-setup.py'), action, '--state-dir', str(folder), '--lang', args.lang]
    terminal = None
    if action == 'init':
        if args.config: arguments += ['--config', str(Path(args.config).absolute())]
        if args.room_creation_password_file: arguments += ['--room-creation-password-file', str(Path(args.room_creation_password_file).absolute())]
        if args.advanced: arguments.append('--advanced')
        if not args.config or not args.room_creation_password_file:
            try: terminal = open('/dev/tty', 'rb', buffering=0)
            except OSError: raise BootstrapError('Interactive setup needs a terminal. Run in a terminal, or supply --config and --room-creation-password-file.') from None
    elif action == 'owner-access':
        arguments += ['--owner-access-file', str(Path(args.owner_access_file).absolute())]
    environment = dict(os.environ)
    environment.pop('DOCKER_CONTEXT', None)
    environment['DOCKER_HOST'] = 'unix:///var/run/docker.sock'
    try:
        # Start must never enter the helper's interactive update offer. Only init
        # reads the operator's controlling terminal, never the curl script pipe.
        result = subprocess.run(arguments, stdin=terminal if terminal else subprocess.DEVNULL, env=environment, check=False)
    finally:
        if terminal: terminal.close()
    if result.returncode: raise BootstrapError('Linux setup ' + action + ' failed (exit ' + str(result.returncode) + '). Existing state and secrets were retained; rerun the same command after fixing the reported error.')


def install(args, current_pin):
    validate_pin(current_pin)
    validate_platform()
    folder = Path(args.state_dir).expanduser().absolute()
    # Reject symlinks in the selected path without changing existing directories.
    if folder.resolve() != folder: raise BootstrapError('Installation path must not contain symlinks or .. components.')
    if args.owner_access_file:
        owner_file = Path(args.owner_access_file).absolute()
        if owner_file.exists() or owner_file.is_symlink():
            raise BootstrapError('Owner access output already exists and was not replaced. Read the existing private file or explicitly choose a new output path.')
    receipt = inspect_target(folder)
    pin = receipt['release'] if receipt else current_pin
    state = installed_state(folder, pin) if receipt else None
    if state and state.get('completed') is True:
        if args.owner_access_file:
            ensure_runtime(args.install_runtime)
            run_helper(stage_package(folder, pin), folder, 'owner-access', args)
        show_existing(folder, state)
        return
    ensure_runtime(args.install_runtime)
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = folder / '.castlink-bootstrap.lock'
    descriptor = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'r+b') as held:
        try: fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise BootstrapError('Another bootstrap is using this installation; wait for it to finish.') from None
        receipt = inspect_target(folder, allow_new_lock=receipt is None)
        if receipt: pin = receipt['release']
        else:
            with (folder / RECEIPT).open('x', encoding='utf-8') as output:
                os.chmod(output.name, 0o600)
                json.dump({'schemaVersion': 1, 'owner': OWNER, 'release': pin}, output)
                output.flush(); os.fsync(output.fileno())
        state = installed_state(folder, pin)
        if state and state.get('completed') is True:
            if args.owner_access_file: run_helper(stage_package(folder, pin), folder, 'owner-access', args)
            show_existing(folder, state)
            return
        package = stage_package(folder, pin)
        if state is None: run_helper(package, folder, 'init', args)
        run_helper(package, folder, 'start', args)
        state = installed_state(folder, pin)
        if not state or state.get('completed') is not True:
            raise BootstrapError('Linux setup did not confirm completed database and origin checks; installation is not ready.')
        if args.owner_access_file: run_helper(package, folder, 'owner-access', args)
        print('CastLink setup completed: ' + str(state['network']['publicOrigin']))
        print('Installation: ' + str(folder))


def main(argv=None):
    parser = argparse.ArgumentParser(description='Install this exact CastLink Linux release. Repeated runs retain the installed version and do not restart a completed installation.')
    parser.add_argument('--state-dir', default='/opt/castlink-server', help='Persistent server data and package directory (default: /opt/castlink-server)')
    parser.add_argument('--install-runtime', action='store_true', help='Explicitly allow apt prerequisite installation and starting a stopped Docker service')
    parser.add_argument('--config', help='Existing Linux helper JSON configuration for unattended setup')
    parser.add_argument('--room-creation-password-file', help='UTF-8 password file; otherwise hidden confirmed terminal input')
    parser.add_argument('--owner-access-file', help='Explicitly issue a single-use platform owner invitation into a new protected file, without revoking existing sessions')
    parser.add_argument('--advanced', action='store_true', help='Ask for advanced network settings')
    parser.add_argument('--lang', choices=('ru', 'en', 'zh-CN'), default='ru')
    args = parser.parse_args(argv)
    try:
        install(args, PIN)
        return 0
    except (BootstrapError, OSError, ValueError, KeyError, TypeError, tarfile.TarError, subprocess.TimeoutExpired) as error:
        # Never include URLs with credentials, subprocess output or configuration.
        message = str(error) if isinstance(error, BootstrapError) else 'Installation failed during local files, download or prerequisites; existing data was retained. Check connectivity, disk space and the selected directory, then rerun.'
        print('CastLink: ' + message, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('CastLink: setup cancelled; existing state was retained.', file=sys.stderr)
        return 130


if __name__ == '__main__': sys.exit(main())
