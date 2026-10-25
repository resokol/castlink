#!/usr/bin/env python3
"""Hourly housekeeping for a server installed by the Windows setup wizard."""
import argparse
from contextlib import contextmanager
import hashlib
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import uuid

OWNER = 'castlink-windows-retention-v1'
RECORD = '.castlink-retention.json'
TAG = re.compile(r'castlink-easy-(web|postgres|livekit|caddy|turntls):[a-f0-9]{40}')
IMAGE = re.compile(r'sha256:[a-f0-9]{64}')
SOURCE = re.compile(r'[a-f0-9]{40}')
STAGES = ('web-builder', 'web-runtime', 'turntls-builder', 'turntls-runtime')


def docker(arguments):
    env = dict(os.environ)
    for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
        env.pop(key, None)
    result = subprocess.run(['/usr/bin/docker', '--host', 'unix:///var/run/docker.sock', *arguments],
                            check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=60, env=env)
    return result.stdout


def plain_path(path):
    return not any(p.is_symlink() for p in (path, *path.parents))


def read_record(folder):
    path = folder / RECORD
    if not plain_path(path):
        raise ValueError('Symlink in retention record path')
    record = json.loads(path.read_text(encoding='utf-8-sig'))
    validate_record(folder, record)
    return record


def validate_record(folder, record):
    iid = str(uuid.UUID(record['installationId']))
    if (record.get('schemaVersion') != 1 or record.get('owner') != OWNER
            or record.get('folder') != str(folder)
            or folder.name != 'castlink-easy-' + iid.replace('-', '') or not plain_path(folder)):
        raise ValueError('Retention installation identity mismatch')
    if not isinstance(record.get('daemonId'), str) or not re.fullmatch(r'[A-Za-z0-9:-]{1,128}', record['daemonId']):
        raise ValueError('Invalid Docker daemon identity')
    history = record.get('successfulImageSets')
    if not isinstance(history, list) or not 1 <= len(history) <= 2:
        raise ValueError('Invalid successful image history')
    for entry in history:
        if not SOURCE.fullmatch(entry.get('commit', '')) or not isinstance(entry.get('images'), list) or not entry['images']:
            raise ValueError('Invalid successful image set')
        if any(not isinstance(t, str) or not TAG.fullmatch(t) for t in entry['images']):
            raise ValueError('Invalid retained image tag')
    for entry in record.get('images', []):
        if not TAG.fullmatch(entry.get('tag', '')) or not IMAGE.fullmatch(entry.get('id', '')) or type(entry.get('preexisting')) is not bool:
            raise ValueError('Invalid image ownership')


@contextmanager
def operation_lock(folder):
    # The Windows SSH channel holds this same kernel lock throughout deployment.
    # Disconnect/termination releases it automatically; no stale lease expires.
    path = folder / '.castlink-operation.lock'
    if not plain_path(path):
        raise ValueError('Symlink in operation lock path')
    with path.open('a+b') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Another CastLink operation is running') from None
        yield


def image_info(reference):
    value = json.loads(docker(['image', 'inspect', reference, '--format', '{{json .}}']))
    if (not IMAGE.fullmatch(value.get('Id', '')) or 'Parent' not in value
            or (value['Parent'] and not IMAGE.fullmatch(value['Parent']))):
        raise ValueError('Incomplete image identity/parent observation')
    layers = value.get('RootFS', {}).get('Layers')
    if not isinstance(layers, list) or not layers or any(not IMAGE.fullmatch(x) for x in layers):
        raise ValueError('Incomplete image layer observation')
    return value


def protection(keep):
    protected, roots, ancestors = set(), [], set()
    pending = list(keep)
    containers = docker(['ps', '-aq', '--no-trunc']).split()
    for container in containers:
        identity = docker(['inspect', container, '--format', '{{.Image}}']).strip()
        if not IMAGE.fullmatch(identity):
            raise ValueError('Incomplete container image observation')
        pending.append(identity)
    seen = set()
    while pending:
        reference = pending.pop()
        if reference in seen:
            continue
        seen.add(reference)
        info = image_info(reference)
        roots.append(info)
        protected.add(info['Id'])
        if info['Parent']:
            ancestors.add(info['Parent'])
            pending.append(info['Parent'])
    return protected, roots, ancestors


def sibling_history(folder):
    """Read known sibling histories solely to add protection, never ownership."""
    keep = set()
    for name in (RECORD, '.castlink-owned.json', '.castlink-image-ownership.json'):
        path = folder / name
        if not path.exists():
            continue
        if not plain_path(path):
            raise ValueError('Cannot verify sibling history')
        value = json.loads(path.read_text(encoding='utf-8-sig'))
        if value.get('schemaVersion') != 1:
            raise ValueError('Invalid sibling history schema')
        if name == RECORD and value.get('owner') == OWNER:
            validate_record(folder, value)
            sets = [entry['images'] for entry in value['successfulImageSets']]
        elif name == RECORD and 'current' in value and 'previous' in value:
            iid = str(uuid.UUID(value['installationId']))
            if folder.name != 'castlink-easy-' + iid.replace('-', ''):
                raise ValueError('Sibling web installer identity mismatch')
            sets = [[entry['tag'] for entry in value[key]] for key in ('current', 'previous')]
        elif name == '.castlink-owned.json':
            iid = str(uuid.UUID(value['installationId']))
            if folder.name != 'castlink-easy-' + iid.replace('-', ''):
                raise ValueError('Sibling Windows installer identity mismatch')
            sets = [entry['images'] for entry in value.get('successfulImageSets', [])]
        elif name == '.castlink-image-ownership.json':
            state_path = folder / '.castlink-install.json'
            if not plain_path(state_path):
                raise ValueError('Cannot verify sibling native installer identity')
            state = json.loads(state_path.read_text(encoding='utf-8-sig'))
            iid = str(uuid.UUID(state['installationId']))
            if state.get('owner') != 'castlink-linux-compose-v1' or state.get('project') != 'castlink-linux-' + iid.replace('-', ''):
                raise ValueError('Sibling native installer identity mismatch')
            sets = [list(entry['images'].values()) for entry in value.get('successfulReleases', [])]
        else:
            raise ValueError('Unknown sibling history schema')
        for tags in sets:
            if not isinstance(tags, list) or any(not isinstance(tag, str) or not TAG.fullmatch(tag) for tag in tags):
                raise ValueError('Invalid sibling retained image tag')
            keep.update(tags)
    return keep


def references(folder, record):
    keep = {t for entry in record['successfulImageSets'] for t in entry['images']}
    registered = {'castlink-easy-' + record['installationId'].replace('-', '')}
    # Retained data may have no containers. Installers use different folder names.
    for sibling in folder.parent.iterdir():
        if sibling == folder or not sibling.is_dir():
            continue
        evidence = (RECORD, '.castlink-owned.json', '.castlink-image-ownership.json', 'compose.json')
        if not any((sibling / name).exists() for name in evidence):
            continue
        if not plain_path(sibling):
            raise ValueError('Cannot verify sibling installation')
        keep.update(sibling_history(sibling))
        compose = sibling / 'compose.json'
        if compose.exists():
            if not plain_path(compose):
                raise ValueError('Cannot verify sibling configuration')
            config = json.loads(compose.read_text(encoding='utf-8-sig'))
            keep.update(service['image'] for service in config['services'].values())
            if re.fullmatch(r'castlink-easy-[a-f0-9]{32}', config.get('name', '')):
                registered.add(config['name'])
        elif re.fullmatch(r'castlink-easy-[a-f0-9]{32}', sibling.name):
            registered.add(sibling.name)
    runtime_path = folder.parent / '.castlink-runtime.json'
    runtime = {}
    if runtime_path.exists():
        if not plain_path(runtime_path):
            raise ValueError('Cannot verify shared ownership')
        runtime = json.loads(runtime_path.read_text(encoding='utf-8-sig'))
        if runtime.get('schemaVersion') != 1:
            raise ValueError('Invalid shared ownership schema')
        for installation in runtime.get('installations', []):
            # This installation's successful history, not its earlier candidate list,
            # determines retention. Other installations always add protection.
            if installation.get('installationId') != record['installationId']:
                keep.update(installation.get('images', []))
            if installation.get('installationId'):
                registered.add('castlink-easy-' + str(uuid.UUID(installation['installationId'])).replace('-', ''))
    volumes = docker(['volume', 'ls', '--format', '{{.Name}}']).split()
    for volume in volumes:
        match = re.fullmatch(r'(castlink-easy-[a-f0-9]{32})_(postgres-data|web-data|caddy-data|caddy-config|converter-socket|converter-work)', volume)
        if match and match[1] not in registered:
            raise ValueError('Unregistered installation retains data')
    return keep, runtime


def layer_ancestor(candidate, roots):
    layers = candidate['RootFS']['Layers']
    return any(root['Id'] != candidate['Id'] and root['RootFS']['Layers'][:len(layers)] == layers for root in roots)


def cleanup(folder, record):
    validate_record(folder, record)
    keep, runtime = references(folder, record)
    protected, roots, ancestors = protection(keep)
    retained = []
    host_owned = {entry['tag']: entry.get('id') for entry in runtime.get('ownedImages', [])}
    for entry in record['images']:
        tag = entry['tag']
        if tag in keep or (entry['preexisting'] and host_owned.get(tag) != entry['id']):
            retained.append(entry)
            continue
        try:
            info = image_info(tag)
        except subprocess.CalledProcessError as error:
            if 'No such image' in error.stderr or 'No such object' in error.stderr:
                continue
            raise
        identity = info['Id']
        aliases = info.get('RepoTags')
        if (identity != entry['id'] or identity in ancestors or layer_ancestor(info, roots)
                or (identity in protected and (not isinstance(aliases, list) or not any(isinstance(t, str) and t and t != tag for t in aliases)))):
            retained.append(entry)
            continue
        containers = docker(['ps', '-aq', '--filter', 'ancestor=' + tag]).split()
        if any(docker(['inspect', c, '--format', '{{.Config.Image}}']).strip() in ('', tag) for c in containers):
            retained.append(entry)
            continue
        docker(['image', 'rm', '--no-prune', tag])
    record['images'] = retained
    parents = []
    for entry in record.get('parents', []):
        if (not IMAGE.fullmatch(entry.get('id', '')) or not SOURCE.fullmatch(entry.get('source', ''))
                or entry.get('stage') not in STAGES):
            parents.append(entry)
            continue
        try:
            info = image_info(entry['id'])
        except subprocess.CalledProcessError as error:
            if 'No such image' in error.stderr or 'No such object' in error.stderr:
                continue
            raise
        labels = info.get('Config', {}).get('Labels') or {}
        if (info['Id'] != entry['id'] or info['Id'] in protected or layer_ancestor(info, roots)
                or 'RepoTags' not in info or 'RepoDigests' not in info
                or info['RepoTags'] or info['RepoDigests']
                or labels.get('ru.castlink.image.owner') != 'castlink'
                or labels.get('ru.castlink.image.ownership') != 'castlink-build-v1'
                or labels.get('ru.castlink.image.source') != entry['source']
                or labels.get('ru.castlink.image.stage') != entry['stage']):
            parents.append(entry)
            continue
        docker(['image', 'rm', '--no-prune', entry['id']])
    record['parents'] = parents
    for archive in record.get('archives', []):
        if archive.get('path') not in ('release.tar.gz', 'payload/images.tar.gz') or not re.fullmatch(r'[a-f0-9]{64}', archive.get('sha256', '')):
            raise ValueError('Invalid archive ownership')
        path = folder / archive['path']
        if path.is_file() and plain_path(path):
            with path.open('rb') as stream:
                digest = hash_stream(stream)
            if digest == archive['sha256']:
                path.unlink()
    return record


def hash_stream(stream):
    digest = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder', type=Path, required=True)
    parser.add_argument('--installation-id', required=True)
    parser.add_argument('--sibling-references', action='store_true', help='Read protection references without changing any resource')
    args = parser.parse_args()
    folder = args.folder.absolute()
    record = read_record(folder)
    if record['installationId'] != args.installation_id:
        raise ValueError('Scheduled installation identity mismatch')
    if args.sibling_references:
        if docker(['info', '--format', '{{.ID}}']).strip() != record['daemonId']:
            raise ValueError('Docker daemon identity changed; references refused')
        sibling_record = dict(record, successfulImageSets=[])
        print(json.dumps(sorted(references(folder, sibling_record)[0])))
        return
    with operation_lock(folder):
        record = read_record(folder)
        # Do not connect to an inactive daemon's socket: docker.socket could
        # otherwise activate docker.service even for a read-only info command.
        active = subprocess.run(['/usr/bin/systemctl', 'is-active', '--quiet', 'docker.service'],
                                check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        if active.returncode != 0:
            return
        # A missing daemon is an ordinary deferred housekeeping run. Never start it.
        try:
            observed_daemon = docker(['info', '--format', '{{.ID}}']).strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            return
        if observed_daemon != record['daemonId']:
            raise ValueError('Docker daemon identity changed; housekeeping refused')
        record = cleanup(folder, record)
        temporary = folder / (RECORD + '.' + uuid.uuid4().hex + '.tmp')
        try:
            with temporary.open('x', encoding='utf-8') as stream:
                os.chmod(temporary, 0o600)
                json.dump(record, stream)
            os.replace(temporary, folder / RECORD)
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
