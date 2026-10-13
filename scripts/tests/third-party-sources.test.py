import hashlib
import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sources', pathlib.Path(__file__).parents[1] / 'package-third-party-sources.py')
sources = importlib.util.module_from_spec(spec); spec.loader.exec_module(sources)

class SourceArchiveTest(unittest.TestCase):
    def manifest(self, data, path='upstream/example.tar.gz'):
        return {'schemaVersion': 1, 'files': [{'url': 'https://example.com/source.tar.gz', 'path': path, 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data), 'component': 'fixture 1.0'}]}

    def test_verified_cache_separate_archive_and_unchanged_notice(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); stream = io.BytesIO(); notice = b'Fixture copyright and license\n'
            with tarfile.open(fileobj=stream, mode='w:gz') as tar:
                entry = tarfile.TarInfo('example/LICENSE'); entry.size = len(notice); tar.addfile(entry, io.BytesIO(notice))
                link = tarfile.TarInfo('../../outside'); link.type = tarfile.SYMTYPE; link.linkname = '/etc/passwd'; tar.addfile(link)
            data = stream.getvalue(); manifest = self.manifest(data); cache = root/'cache'; (cache/'upstream').mkdir(parents=True); (cache/'upstream/example.tar.gz').write_bytes(data)
            with patch.object(sources.urllib.request, 'urlopen', side_effect=AssertionError('Verified cache must be reused')):
                asset = sources.build(manifest, cache, root/'out')
            with tarfile.open(asset) as tar:
                self.assertEqual(set(tar.getnames()), {'README.txt','source-manifest.json','upstream/example.tar.gz'})
                self.assertEqual(tar.extractfile('upstream/example.tar.gz').read(), data)
            index = json.loads((root/'out/third_party/upstream/index.json').read_text()); self.assertEqual(len(index), 1)
            self.assertEqual((root/'out/third_party/upstream'/index[0]['notice']).read_bytes(), notice)
            self.assertFalse((root/'outside').exists())

    def test_timeout_falls_back_to_curl_but_still_verifies_hash(self):
        for downloaded in [b'good', b'evil']:
            with tempfile.TemporaryDirectory() as folder:
                root = pathlib.Path(folder); manifest = self.manifest(b'good', 'source.bin')
                def curl(command, **kwargs):
                    pathlib.Path(command[command.index('--output')+1]).write_bytes(downloaded)
                with patch.object(sources.urllib.request, 'urlopen', side_effect=TimeoutError('read timed out')), patch.object(sources.time, 'sleep'), patch.object(sources.shutil, 'which', return_value='curl'), patch.object(sources.subprocess, 'run', side_effect=curl) as run:
                    if downloaded == b'good':
                        self.assertEqual(sources.fetch(manifest['files'][0], root).read_bytes(), b'good')
                    else:
                        with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                            sources.fetch(manifest['files'][0], root)
                        self.assertFalse((root/'source.bin').exists())
                    self.assertIn('--ipv4', run.call_args.args[0])
                    self.assertIn('=https', run.call_args.args[0])

    def test_invalid_paths_and_credentials_rejected(self):
        for path in ['../outside', '/absolute', 'C:/secret', 'folder\\file', 'foo/../bar']:
            with self.assertRaises(ValueError): sources.validate(self.manifest(b'x', path))
        manifest = self.manifest(b'x'); manifest['files'][0]['url'] = 'https://secret:password@example.com/file'
        with self.assertRaises(ValueError): sources.validate(manifest)
        manifest = self.manifest(b'x'); manifest['files'] *= 2
        with self.assertRaises(ValueError): sources.validate(manifest)

    def test_mismatch_never_publishes_and_does_not_trust_stale_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder); manifest = self.manifest(b'good', 'source.bin'); (root/'source.bin').write_bytes(b'evil')
            with patch.object(sources.urllib.request, 'urlopen', side_effect=lambda *a, **k: io.BytesIO(b'evil')), patch.object(sources.time, 'sleep'):
                with self.assertRaisesRegex(ValueError, 'checksum mismatch'): sources.build(manifest, root, root/'out')
            self.assertFalse((root/'out'/sources.ASSET).exists())
            self.assertFalse((root/'source.bin.partial').exists())

if __name__ == '__main__': unittest.main()
