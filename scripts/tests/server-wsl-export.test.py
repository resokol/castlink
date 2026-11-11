import importlib.util
import io
from pathlib import Path
import tarfile
import unittest

PATH = Path(__file__).parents[1] / 'filter-server-wsl-rootfs.py'


class Export(unittest.TestCase):
    def test_export_removes_container_identity_preserving_os_and_binary_bytes(self):
        self.assertTrue(PATH.exists(), 'Missing WSL rootfs export filter')
        spec = importlib.util.spec_from_file_location('export_rootfs', PATH)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        incoming, outgoing = io.BytesIO(), io.BytesIO()
        with tarfile.open(fileobj=incoming, mode='w') as archive:
            for name, data in [('.dockerenv', b''), ('etc/hostname', b'producer-host'),
                               ('etc/hosts', b'10.0.0.2 proxy'), ('etc/resolv.conf', b'nameserver 10.0.0.1'),
                               ('usr/local/bin/node', b'\x7fELFbytes')]:
                entry = tarfile.TarInfo(name); entry.size = len(data); archive.addfile(entry, io.BytesIO(data))
        incoming.seek(0); module.filter_rootfs(incoming, outgoing); outgoing.seek(0)
        with tarfile.open(fileobj=outgoing, mode='r:gz') as archive:
            self.assertNotIn('.dockerenv', archive.getnames())
            self.assertEqual(archive.extractfile('usr/local/bin/node').read(), b'\x7fELFbytes')
            self.assertEqual(archive.extractfile('etc/hostname').read(), b'castlink-server\n')
            self.assertNotIn(b'proxy', archive.extractfile('etc/hosts').read())
            self.assertEqual(archive.extractfile('etc/resolv.conf').read(), b'')


if __name__ == '__main__': unittest.main()
