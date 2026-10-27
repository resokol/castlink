"""Release download aliases remain bounded to the same public repository."""
import hashlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('provision_vps', Path(__file__).resolve().parents[1] / 'server-provision-vps.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class ReleaseRepository(unittest.TestCase):
    def test_download_accepts_exact_canonical_and_historical_release_urls(self):
        content = b'verified fixture archive'
        checksum = hashlib.sha256(content).hexdigest()
        for repository in ('castlink', 'castlink-releases'):
            url = 'https://github.com/resokol/' + repository + '/releases/download/server-setup-v1.0.0-' + 'a' * 12 + '/CastLink-Linux.tar.gz'
            with self.subTest(repository=repository), tempfile.TemporaryDirectory() as folder, patch.object(m.urllib.request, 'build_opener') as opener:
                response = io.BytesIO(content)
                response.headers = {}
                opener.return_value.open.return_value = response
                target = Path(folder) / 'release.tar.gz'
                m.download_release(url, checksum, target)
                self.assertEqual(target.read_bytes(), content)

    def test_download_rejects_foreign_or_nonexact_repository_urls_before_network(self):
        exact = 'https://github.com/resokol/castlink/releases/download/server-setup-v1.0.0-' + 'a' * 12 + '/CastLink-Linux.tar.gz'
        invalid = [exact.replace('/resokol/', '/other/'), exact.replace('/castlink/', '/studiolink/'),
                   exact + '?download=1', exact + '#file', exact.replace('https://github.com/', 'https://user@github.com/')]
        for url in invalid:
            with self.subTest(url=url), tempfile.TemporaryDirectory() as folder, patch.object(m.urllib.request, 'build_opener') as opener:
                with self.assertRaisesRegex(ValueError, 'Invalid public release'):
                    m.download_release(url, 'a' * 64, Path(folder) / 'release.tar.gz')
                opener.assert_not_called()


if __name__ == '__main__':
    unittest.main()
