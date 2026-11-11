#!/usr/bin/env python3
"""Manufacturer-only: retain exact corresponding Ubuntu sources for a WSL OS."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def collect(destination):
    destination = Path(destination)
    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    result = subprocess.run(['dpkg-query', '-W', '-f=${source:Package}\t${source:Version}\n'],
                            check=True, text=True, stdout=subprocess.PIPE)
    packages = sorted(set(tuple(row.split('\t')) for row in result.stdout.splitlines()))
    for name, version in packages:
        if not name or not version or name.startswith('-') or any(c in name + version for c in '\r\n\0'):
            raise ValueError('Invalid installed source package identity')
        subprocess.run(['apt-get', '--download-only', 'source', '--', name + '=' + version],
                       cwd=destination, stdin=subprocess.DEVNULL, check=True)
    files = {}
    for entry in sorted(destination.iterdir()):
        if not entry.is_file() or entry.is_symlink():
            raise ValueError('Unexpected source archive entry')
        digest = hashlib.sha256()
        with entry.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(block)
        files[entry.name] = {'sha256': digest.hexdigest(), 'size': entry.stat().st_size}
    (destination / 'sources.json').write_text(json.dumps({
        'schemaVersion': 1, 'distribution': 'Ubuntu 24.04',
        'packages': [{'name': n, 'version': v} for n, v in packages], 'files': files,
    }, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    collect(sys.argv[1])
