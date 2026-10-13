"""Developer-only archive I/O. Never extract archive paths to disk."""
import gzip
import io
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import tarfile
import zipfile

MAX_ENTRIES = 30000
MAX_EXPANDED = 512 * 1024 * 1024
MAX_FILE = 128 * 1024 * 1024


def safe(name):
    p = PurePosixPath(name)
    if not name or len(name) > 4096 or '\\' in name or ':' in name or p.is_absolute() or '..' in p.parts or any(ord(c) < 32 for c in name):
        raise ValueError('Unsafe archive path')


def extract(archive, prefix, output, windows):
    selected = {prefix + '/LICENSE': 'LICENSE', prefix + ('/node.exe' if windows else '/bin/node'): 'node.exe' if windows else 'bin/node'}
    found = set()
    total = 0
    seen = set()
    if windows:
        handle = zipfile.ZipFile(archive)
        entries = handle.infolist()
    else:
        handle = tarfile.open(archive, 'r:gz')
        entries = handle.getmembers()
    if len(entries) > MAX_ENTRIES:
        raise ValueError('Archive entry limit exceeded')
    for entry in entries:
        name = entry.filename if windows else entry.name
        safe(name)
        if name in seen:
            raise ValueError('Duplicate archive path')
        seen.add(name)
        size = entry.file_size if windows else entry.size
        total += size
        if total > MAX_EXPANDED or size > MAX_FILE:
            raise ValueError('Archive expansion limit exceeded')
        if name not in selected:
            continue
        regular = (not entry.is_dir() and not stat.S_ISLNK(entry.external_attr >> 16)) if windows else entry.isfile()
        if not regular:
            raise ValueError('Selected runtime member must be regular')
        data = handle.read(entry) if windows else handle.extractfile(entry).read(MAX_FILE + 1)
        if len(data) != size:
            raise ValueError('Invalid runtime member size')
        target = Path(output) / selected[name]
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as stream:
            stream.write(data)
        target.chmod(0o755 if name.endswith(('/node.exe', '/bin/node')) else 0o644)
        found.add(name)
    handle.close()
    if found != set(selected):
        raise ValueError('Runtime archive missing required members')


def create(root, output, windows):
    root = Path(root)
    files = sorted(p for p in root.rglob('*') if p.is_file())
    if windows:
        with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for p in files:
                name = root.name + '/' + p.relative_to(root).as_posix()
                safe(name)
                info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (stat.S_IFREG | (p.stat().st_mode & 0o777)) << 16
                archive.writestr(info, p.read_bytes())
    else:
        with open(output, 'xb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as gz, tarfile.open(fileobj=gz, mode='w') as archive:
            for p in files:
                name = root.name + '/' + p.relative_to(root).as_posix()
                safe(name)
                data = p.read_bytes()
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = p.stat().st_mode & 0o777
                info.mtime = 0
                archive.addfile(info, io.BytesIO(data))


if __name__ == '__main__':
    try:
        operation, *args = sys.argv[1:]
        if operation == 'extract':
            extract(*args[:3], args[3] == 'win32-x64')
        elif operation == 'create':
            create(*args[:2], args[2] == 'win32-x64')
        else:
            raise ValueError('Unknown archive operation')
    except Exception:
        print('Archive preparation failed; partial development output requires diagnosis.', file=sys.stderr)
        sys.exit(1)
