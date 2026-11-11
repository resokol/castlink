#!/usr/bin/env python3
"""Strip container-generated identity from a Docker export before WSL import."""
import io
import sys
import tarfile

REPLACE = {
    'etc/hostname': b'castlink-server\n',
    'etc/hosts': b'127.0.0.1 localhost\n::1 localhost ip6-localhost\n',
    'etc/resolv.conf': b'',  # WSL generates the guest resolver on first boot.
}


def filter_rootfs(incoming, outgoing):
    with tarfile.open(fileobj=incoming, mode='r|') as source, tarfile.open(fileobj=outgoing, mode='w|gz') as target:
        for member in source:
            name = member.name.removeprefix('./').rstrip('/')
            if name in ('.dockerenv', '.containerenv'):
                continue
            if name in REPLACE:
                replacement = tarfile.TarInfo(name)
                replacement.mode = 0o644
                replacement.size = len(REPLACE[name])
                target.addfile(replacement, io.BytesIO(REPLACE[name]))
            else:
                target.addfile(member, source.extractfile(member) if member.isfile() else None)


if __name__ == '__main__':
    filter_rootfs(sys.stdin.buffer, sys.stdout.buffer)
