#!/usr/bin/env python3
"""Build an independently downloadable, checksum-pinned third-party source asset.

Uses Python standard libraries; system curl is an optional timeout fallback.
Never copies the CastLink source tree.
The input manifest is reviewed with image/dependency updates, not discovered from
mutable upstream branches during release publication.
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
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ASSET = 'CastLink-ThirdParty-Sources.tar.gz'
OFFICE_ASSET = 'CastLink-ThirdParty-Office-Sources.tar.gz'
ASSETS = (ASSET, OFFICE_ASSET)
LEGAL = re.compile(r'^(?:licen[sc]e|copying|notice|copyright|third[-_]party[-_]notices?)(?:[._-].*)?$', re.I)
FIELDS = ('url', 'path', 'sha256', 'size', 'component')


def validate(manifest):
    if manifest.get('schemaVersion') != 1 or not manifest.get('files'):
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
        if not re.fullmatch('[a-f0-9]{64}', item['sha256']) or type(item['size']) is not int or item['size'] < 0:
            raise ValueError('Invalid source checksum/size')
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


def valid_file(file, item):
    if not file.is_file() or file.stat().st_size != item['size']:
        return False
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest() == item['sha256']


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
                    if size > item['size']:
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
              'It does not contain private CastLink application source. Each component\n'
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
    build(manifest, args.cache, args.output, asset_name=args.asset_name)
