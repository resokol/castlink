#!/usr/bin/env python3
"""Build an independently downloadable, checksum-pinned third-party source asset.

Uses Python standard libraries; system curl is an optional timeout fallback.
Never copies the CastLink source tree.
The input manifest is reviewed with image/dependency updates, not discovered from
mutable upstream branches during release publication.
Schema 2 also accepts upstream archive digests from APKBUILD or the image
recipe. The emitted manifest records SHA-256 and size for every verified file.
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
import pathlib
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ASSET = 'CastLink-ThirdParty-Sources.tar.gz'
OFFICE_ASSET = 'CastLink-ThirdParty-Office-Sources.tar.gz'
ASSETS = (ASSET, OFFICE_ASSET)
LEGAL = re.compile(r'^(?:licen[sc]e|copying|notice|copyright|third[-_]party[-_]notices?)(?:[._-].*)?$', re.I)
MAX_UNSIZED_SOURCE = 512 * 1024 * 1024


def validate(manifest):
    if manifest.get('schemaVersion') not in (1, 2) or not manifest.get('files'):
        raise ValueError('Expected a nonempty versioned source manifest')
    seen = set()
    for item in manifest['files']:
        name = item['path']
        parts = pathlib.PurePosixPath(name).parts
        url = urllib.parse.urlsplit(item['url'])
        if (not parts or name.startswith('/') or '\\' in name or ':' in name
                or any(p in ('.', '..') for p in name.split('/')) or name in seen):
            raise ValueError('Unsafe or duplicate source path: ' + name)
        if url.scheme != 'https' or not url.netloc or url.username or url.password or url.fragment:
            raise ValueError('Expected public HTTPS source URL')
        algorithms = [key for key in ('sha256', 'sha512') if key in item]
        if manifest['schemaVersion'] == 1 and (algorithms != ['sha256'] or 'size' not in item):
            raise ValueError('Invalid source checksum/size')
        if not algorithms or ('size' in item and (type(item['size']) is not int or item['size'] < 0)):
            raise ValueError('Invalid source checksum/size')
        formats = {'sha256': '[a-f0-9]{64}', 'sha512': '[a-f0-9]{128}'}
        if any(not re.fullmatch(formats[key], item[key]) for key in algorithms):
            raise ValueError('Invalid source checksum')
        if not isinstance(item['component'], str) or not item['component']:
            raise ValueError('Missing component attribution')
        seen.add(name)
    return manifest['files']


def validate_runtime_sources(manifests, inventory):
    """Bind every installed Debian source/version to pinned corresponding inputs."""
    components = {}
    for manifest in manifests:
        for item in manifest['files']:
            components.setdefault(item['component'], []).append(item['path'])
    missing = []
    for line in inventory.splitlines():
        if not line: continue
        parts = line.split('\t')
        if len(parts) != 2 or not all(parts): raise ValueError('Invalid Debian source inventory')
        component = ' '.join(parts)
        files = components.get(component, [])
        if not any(p.endswith('.dsc') for p in files) or not any('.tar.' in p for p in files):
            missing.append(component)
    if not inventory.strip(): raise ValueError('Empty Debian source inventory')
    if missing: raise ValueError('Missing exact Debian source inputs: ' + ', '.join(sorted(set(missing))))


def allowed_size(item, size):
    return size == item['size'] if 'size' in item else 0 < size <= MAX_UNSIZED_SOURCE


def stream_hash(stream, algorithm='sha256'):
    digest = hashlib.new(algorithm)
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        digest.update(block)
    return digest.hexdigest()


def valid_file(file, item):
    if not file.is_file() or not allowed_size(item, file.stat().st_size):
        return False
    for algorithm in ('sha256', 'sha512'):
        if algorithm in item:
            with file.open('rb') as stream:
                if stream_hash(stream, algorithm) != item[algorithm]:
                    return False
    return 'sha256' in item or 'sha512' in item


def resolved_item(item, file):
    result = dict(item)
    if 'sha256' not in result:
        with file.open('rb') as stream:
            result['sha256'] = stream_hash(stream)
    result.setdefault('size', file.stat().st_size)
    return result


def verify_source_archive(manifest, archive_path):
    """Check WSL's supplied source sidecar against the current checked-in pins and its own byte receipts."""
    expected = {item['path']: item for item in validate(manifest)}
    resolved = {}
    captured = None
    seen = set()
    with tarfile.open(archive_path, 'r|gz') as archive:
        for member in archive:
            name = member.name.removeprefix('./').rstrip('/')
            if member.isdir():
                continue
            if not member.isfile() or name in seen or name.startswith('/') or '..' in name.split('/'):
                raise ValueError('Unsafe upstream source archive')
            seen.add(name)
            if name == 'README.txt':
                continue
            with archive.extractfile(member) as stream:
                if name == 'source-manifest.json':
                    if member.size > 16 * 1024 * 1024:
                        raise ValueError('Upstream source manifest too large')
                    captured = json.load(stream)
                    continue
                item = expected.get(name)
                if not item or not allowed_size(item, member.size):
                    raise ValueError('Upstream source inventory or size mismatch')
                sums = {key: hashlib.new(key) for key in ('sha256', 'sha512') if key == 'sha256' or key in item}
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    for digest in sums.values():
                        digest.update(block)
                if any(key in item and item[key] != digest.hexdigest() for key, digest in sums.items()):
                    raise ValueError('Upstream source checksum mismatch')
                resolved[name] = {**item, 'sha256': sums['sha256'].hexdigest(), 'size': member.size}
    if expected.keys() != resolved.keys() or captured != {**manifest, 'files': [resolved[name] for name in expected]}:
        raise ValueError('Upstream source manifest or payload mismatch')


def seed_cache_from_archive(manifest, cache, source_archive, *, require_all=True):
    """Stream only current pinned inputs into the trusted cache; never extract paths."""
    selected = {item['path']: item for item in validate(manifest)}
    cache = pathlib.Path(cache)
    seen = set()
    with tarfile.open(source_archive, 'r|gz') as archive:
        for member in archive:
            if member.name not in selected:
                continue
            if member.name in seen:
                raise ValueError('Selected source archive member is duplicate: ' + member.name)
            seen.add(member.name)
            item = selected[member.name]
            if not member.isfile():
                raise ValueError('Selected source archive member must be regular: ' + member.name)
            if not allowed_size(item, member.size):
                raise ValueError('Source archive size mismatch: ' + member.name)
            target = cache / item['path']
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = None
            try:
                size = 0
                with archive.extractfile(member) as stream, tempfile.NamedTemporaryFile(
                        mode='wb', dir=target.parent, prefix='.castlink-source-', suffix='.partial', delete=False) as out:
                    temporary = pathlib.Path(out.name)
                    for block in iter(lambda: stream.read(1024 * 1024), b''):
                        size += len(block)
                        if size > item.get('size', MAX_UNSIZED_SOURCE):
                            raise ValueError('Source archive size exceeds manifest: ' + member.name)
                        out.write(block)
                if not valid_file(temporary, item):
                    raise ValueError('Source archive checksum/size mismatch: ' + member.name)
                temporary.replace(target)
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
    missing = sorted(selected.keys() - seen)
    if missing and require_all:
        raise ValueError('Missing current manifest sources from reuse archive: ' + ', '.join(missing))


def fetch(item, cache):
    target = cache / item['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    if valid_file(target, item):
        return target
    for attempt in range(3):
        temporary = target.with_name(target.name + '.partial')
        try:
            request = urllib.request.Request(item['url'], headers={'User-Agent': 'CastLink-release-source-packager/1'})
            with urllib.request.urlopen(request, timeout=60) as response, temporary.open('wb') as out:
                size = 0
                for block in iter(lambda: response.read(1024 * 1024), b''):
                    size += len(block)
                    if size > item.get('size', MAX_UNSIZED_SOURCE):
                        raise ValueError('Source size exceeds manifest: ' + item['path'])
                    out.write(block)
            if not valid_file(temporary, item):
                raise ValueError('Source checksum mismatch: ' + item['path'])
            temporary.replace(target)
            return target
        except Exception as error:
            temporary.unlink(missing_ok=True)
            # Some Windows/upstream TLS routes stall urllib after response headers.
            # Keep the same HTTPS URL and pinned bytes; never disable TLS checks.
            network_error = error.reason if isinstance(error, urllib.error.URLError) else error
            if isinstance(network_error, (TimeoutError, ConnectionResetError)) and (curl := shutil.which('curl')):
                print('Retrying interrupted source with system curl: ' + item['component'], flush=True)
                try:
                    subprocess.run([curl, '--ipv4', '--fail', '--location', '--silent', '--show-error',
                                    '--proto', '=https', '--proto-redir', '=https',
                                    '--connect-timeout', '20', '--max-time', '120',
                                    '--max-filesize', str(item.get('size', MAX_UNSIZED_SOURCE)),
                                    '--output', str(temporary), item['url']], check=True, timeout=130)
                    if not valid_file(temporary, item):
                        raise ValueError('Source checksum mismatch: ' + item['path'])
                    temporary.replace(target)
                    return target
                except Exception:
                    temporary.unlink(missing_ok=True)
                    raise
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def legal_files(file):
    """Read bounded legal text, without extracting archive paths or links."""
    if zipfile.is_zipfile(file):
        with zipfile.ZipFile(file) as archive:
            for item in archive.infolist():
                if not item.is_dir() and item.file_size <= 4 * 1024 * 1024 and LEGAL.match(pathlib.PurePosixPath(item.filename).name):
                    yield item.filename, archive.read(item)
    elif tarfile.is_tarfile(file):
        with tarfile.open(file, 'r:*') as archive:
            for item in archive:
                if item.isfile() and item.size <= 4 * 1024 * 1024 and LEGAL.match(pathlib.PurePosixPath(item.name).name):
                    yield item.name, archive.extractfile(item).read()
    elif LEGAL.match(file.name) and file.stat().st_size <= 4 * 1024 * 1024:
        yield file.name, file.read_bytes()


def build(manifest, cache, output, asset_name=ASSET):
    if asset_name not in ASSETS: raise ValueError('Unrecognized source asset name')
    items = validate(manifest)
    cache = pathlib.Path(cache)
    output = pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        files = list(pool.map(lambda item: fetch(item, cache), items))
    manifest = {**manifest, 'files': [resolved_item(item, file) for item, file in zip(items, files)]}
    notices = output / 'third_party' / ('upstream-office' if asset_name == OFFICE_ASSET else 'upstream')
    notices.mkdir(parents=True, exist_ok=True)
    index = []
    # Same notice bytes are stored once, preserving original text and provenance.
    for item, file in zip(items, files):
        for original, data in legal_files(file):
            digest = hashlib.sha256(data).hexdigest()
            name = digest + '.txt'
            (notices / name).write_bytes(data)
            index.append({'component': item['component'], 'source': item['path'], 'originalPath': original, 'notice': name})
    (notices / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    asset = output / asset_name
    partial = output / (asset_name + '.partial')
    readme = ('CastLink third-party corresponding sources\n\n'
              'This optional archive contains independently licensed upstream software,\n'
              'downstream patches and build recipes for the accompanying release.\n'
              'CastLink application source is separately available under MIT at\n'
              'https://github.com/resokol/castlink. Each third-party component\n'
              'retains its original license, notices and modification rights.\n'
              'source-manifest.json records exact versions, provenance and SHA256.\n'
              'Debian .dsc/.orig/.debian files belong together (dpkg-source -x).\n'
              'Alpine directories contain APKBUILD, sources and downstream scripts\n'
              '(Alpine abuild). recipes/ records container and libvips build inputs.\n'
              'Go module ZIPs retain their module paths and dependency licenses.\n'
              'Installers do not require this additional archive.\n').encode()
    with tarfile.open(partial, 'w:gz', compresslevel=1) as archive:
        for name, data in [('README.txt', readme), ('source-manifest.json', (json.dumps(manifest, ensure_ascii=False, indent=2)+'\n').encode())]:
            member = tarfile.TarInfo(name); member.size = len(data); member.mode = 0o644
            archive.addfile(member, io.BytesIO(data))
        for item, file in zip(items, files):
            archive.add(file, arcname=item['path'], recursive=False)
    partial.replace(asset)
    print(json.dumps({'asset': asset_name, 'sources': len(items), 'notices': len(index), 'bytes': asset.stat().st_size}))
    return asset


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', default='distribution/third-party-sources.json')
    parser.add_argument('--asset-name', choices=ASSETS, default=ASSET)
    parser.add_argument('--runtime-inventory')
    parser.add_argument('--baseline-manifest')
    seed = parser.add_mutually_exclusive_group()
    seed.add_argument('--seed-archive', help='Reuse only matching, checksum-verified members of a historical sidecar; fetch newly pinned inputs')
    seed.add_argument('--reuse-archive', help='Require a complete matching sidecar and verify every source against the current manifest')
    parser.add_argument('--cache', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    with open(args.manifest, encoding='utf-8') as stream:
        manifest = json.load(stream)
    if args.runtime_inventory:
        manifests = [manifest]
        if args.baseline_manifest:
            with open(args.baseline_manifest, encoding='utf-8') as stream: manifests.append(json.load(stream))
        validate_runtime_sources(manifests, pathlib.Path(args.runtime_inventory).read_text(encoding='utf-8'))
    if args.reuse_archive or args.seed_archive:
        seed_cache_from_archive(manifest, args.cache, args.reuse_archive or args.seed_archive, require_all=bool(args.reuse_archive))
    build(manifest, args.cache, args.output, asset_name=args.asset_name)
