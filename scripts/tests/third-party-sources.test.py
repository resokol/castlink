import hashlib
import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import unittest
import urllib.error
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
        errors = [TimeoutError('read timed out'), urllib.error.URLError(TimeoutError('connect timed out')), urllib.error.URLError(ConnectionResetError('connection reset'))]
        for error, downloaded in [(error, data) for error in errors for data in [b'good', b'evil']]:
            with tempfile.TemporaryDirectory() as folder:
                root = pathlib.Path(folder); manifest = self.manifest(b'good', 'source.bin')
                def curl(command, **kwargs):
                    pathlib.Path(command[command.index('--output')+1]).write_bytes(downloaded)
                with patch.object(sources.urllib.request, 'urlopen', side_effect=error), patch.object(sources.time, 'sleep'), patch.object(sources.shutil, 'which', return_value='curl'), patch.object(sources.subprocess, 'run', side_effect=curl) as run:
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


    def test_office_sidecar_retains_primary_asset_and_notices(self):
        with tempfile.TemporaryDirectory() as folder:
            root = pathlib.Path(folder)
            for asset, label in [(sources.ASSET, 'primary'), (sources.OFFICE_ASSET, 'office')]:
                data = (label + ' license').encode()
                manifest = self.manifest(data, label + '/LICENSE')
                cache = root/'cache'; (cache/label).mkdir(parents=True)
                (cache/label/'LICENSE').write_bytes(data)
                sources.build(manifest, cache, root/'out', asset_name=asset)
            for asset in [sources.ASSET, sources.OFFICE_ASSET]:
                with tarfile.open(root/'out'/asset) as archive:
                    self.assertIn('source-manifest.json', archive.getnames())
            self.assertTrue((root/'out/third_party/upstream/index.json').is_file())
            self.assertTrue((root/'out/third_party/upstream-office/index.json').is_file())
            for invalid in ['../bad.tar.gz', 'other.tar.gz']:
                with self.assertRaises(ValueError): sources.build(manifest, cache, root/'out', asset_name=invalid)

    def test_runtime_debian_inventory_requires_exact_source_versions_and_archives(self):
        files = [self.manifest(b'dsc', 'debian/office.dsc')['files'][0], self.manifest(b'orig', 'debian/office.orig.tar.xz')['files'][0]]
        for item in files: item['component'] = 'libreoffice 4:7.4.7-1+deb12u14'
        manifest = {'schemaVersion': 1, 'files': files}
        sources.validate_runtime_sources([manifest], 'libreoffice\t4:7.4.7-1+deb12u14\n')
        for inventory in ['libreoffice\t4:7.4.7-1+deb12u15\n', 'unknown\t1\n']:
            with self.assertRaises(ValueError): sources.validate_runtime_sources([manifest], inventory)
        for incomplete in [files[:1], files[1:]]:
            with self.assertRaises(ValueError): sources.validate_runtime_sources([{'files': incomplete}], 'libreoffice\t4:7.4.7-1+deb12u14\n')

    def test_pinned_office_supplement_covers_recorded_runtime_without_changing_primary(self):
        root = pathlib.Path(__file__).parents[2]
        primary = json.loads((root/'distribution/third-party-sources.json').read_text(encoding='utf-8'))
        office = json.loads((root/'distribution/third-party-office-sources.json').read_text(encoding='utf-8'))
        self.assertEqual(len(primary['files']), 1004)
        self.assertEqual(office['supplements'], 'third-party-sources.json')
        sources.validate(office)
        inventory = ''.join(p['source']+'\t'+p['version']+'\n' for p in office['runtimeDebianSources'])
        sources.validate_runtime_sources([primary, office], inventory)
        self.assertTrue(any(p['source'] == 'libreoffice' for p in office['runtimeDebianSources']))

if __name__ == '__main__': unittest.main()
