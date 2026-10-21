import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import hashlib
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('linux_compose', Path(__file__).resolve().parents[1] / 'linux-compose-setup.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def published(version='1.0.0-rc.9', sha='b' * 12, track='linux', **fields):
    tag = f'{track}-v{version}-{sha}'
    names = ['CastLink-Linux.tar.gz', 'SHA256SUMS', 'manifest.json', 'CastLink-Provisioning.json',
             'CastLink-ThirdParty-Sources.tar.gz', 'CastLink-ThirdParty-Office-Sources.tar.gz']
    return {'tag_name': tag, 'version': version, 'commitPrefix': sha, 'draft': False, 'published_at': '2026-10-21T00:00:00Z',
            'assets': [{'name': name, 'size': 100, 'state': 'uploaded',
                        'browser_download_url': m.RELEASE_DOWNLOAD + tag + '/' + name} for name in names], **fields}


class Updates(unittest.TestCase):
    def test_removes_only_intact_generated_backups_of_this_installation(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = {'installationId': 'installation-one'}
            for name, identity in [('20261020-120000-aaaaaaaa', 'installation-one'), ('20261020-120000-bbbbbbbb', 'other-installation')]:
                backup = folder / 'backups' / name; backup.mkdir(parents=True)
                for filename in (m.STATE, 'secrets.json', 'compose.json', 'postgres.env', 'web.env', 'livekit.json', 'Caddyfile', 'postgres.dump', 'web-data.tar'):
                    (backup / filename).write_text(json.dumps({'owner': m.OWNER, 'installationId': identity}) if filename == m.STATE else 'saved data')
                (backup / 'SHA256SUMS').write_text(''.join(m.digest(p) + '  ' + p.name + '\n' for p in backup.iterdir()))
            (folder / 'backups' / 'manual').mkdir()
            m.cleanup_legacy_backups(folder, state)
            self.assertFalse((folder / 'backups' / '20261020-120000-aaaaaaaa').exists())
            self.assertTrue((folder / 'backups' / '20261020-120000-bbbbbbbb').exists())
            self.assertTrue((folder / 'backups' / 'manual').exists())

    def test_verified_download_yields_exact_release_then_removes_all_staging(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); candidate = published()
            content = b'package'
            def download(candidate, name, destination, limit):
                destination.write_bytes((hashlib.sha256(content).hexdigest() + '  CastLink-Linux.tar.gz\n').encode() if name == 'SHA256SUMS' else content)
            manifest = {'track': 'linux', 'version': candidate['version'], 'commit': 'b' * 40}
            with patch.object(m, 'download_asset', side_effect=download), patch.object(m, 'extract_update'), patch.object(m, 'verify_package', return_value=manifest):
                with m.downloaded_update(folder, candidate) as (package, release):
                    self.assertEqual(release, manifest)
                    self.assertTrue(package.is_dir())
                    temporary = package.parent
                self.assertFalse(temporary.exists())

    def test_checksum_failure_never_extracts_and_removes_download(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            def download(candidate, name, destination, limit):
                destination.write_text(('a' * 64 + '  CastLink-Linux.tar.gz\n') if name == 'SHA256SUMS' else 'bad')
            with patch.object(m, 'download_asset', side_effect=download), patch.object(m, 'extract_update') as extract:
                with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                    with m.downloaded_update(folder, published()): self.fail('Bad package was accepted')
            extract.assert_not_called()
            self.assertEqual(list(folder.iterdir()), [])

    def test_restart_after_downloaded_update_does_not_require_old_package_archive(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            state = {'release': {'version': '1.0.0-rc.9', 'commit': 'b' * 40, 'images': {}}, 'completed': True, 'network': {'mode': 'https', 'publicOrigin': 'https://cast.example'}}
            m.write_private(folder / m.IMAGE_RECEIPT, {'schemaVersion': 1, 'images': []})
            events = []
            with patch.object(m, 'load_state', return_value=state), patch.object(m, 'verify_package', side_effect=AssertionError('Old package must not be read')), patch.object(m, 'render', side_effect=lambda *args: events.append('render')), patch.object(m, 'compose', side_effect=lambda *args: events.append('up')), patch.object(m, 'complete'), patch.object(m, 'cleanup_installation'), patch.object(m, 'offer_update', return_value=None), patch('builtins.print'):
                self.assertEqual(m.main(['start', '--state-dir', d]), 0)
            self.assertEqual(events, ['render', 'up'])

    def test_semver_release_order_and_stable_after_prerelease(self):
        self.assertGreater(m.version_key('1.0.0'), m.version_key('1.0.0-rc.10'))
        self.assertGreater(m.version_key('1.0.0-rc.10'), m.version_key('1.0.0-rc.9'))
        self.assertIsNone(m.version_key('1.0'))

    def test_discovery_uses_only_complete_linux_publication_and_never_downgrades(self):
        current = {'version': '1.0.0-rc.8', 'commit': 'a' * 40}
        records = [published('1.0.0-rc.7'), published(track='client'), published(draft=True),
                   published('1.0.0-rc.11', assets=[]), published()]
        with patch.object(m, 'release_json', return_value=records):
            found = m.check_updates(current)
        self.assertEqual(found['tag_name'], published()['tag_name'])
        with patch.object(m, 'release_json', return_value=[published('1.0.0-rc.7')]):
            self.assertIsNone(m.check_updates(current))

    def test_same_version_different_build_uses_current_publication_time(self):
        current = {'version': '1.0.0-rc.8', 'commit': 'a' * 40}
        old = published('1.0.0-rc.8', sha='a' * 12, published_at='2026-10-22T00:00:00Z')
        with patch.object(m, 'release_json', return_value=[published('1.0.0-rc.8'), old]):
            self.assertIsNone(m.check_updates(current))
        old['published_at'] = '2026-10-20T00:00:00Z'
        with patch.object(m, 'release_json', return_value=[old, published('1.0.0-rc.8')]):
            self.assertIsNotNone(m.check_updates(current))

    def test_asset_url_cannot_escape_fixed_release_repository(self):
        record = published()
        record['assets'][0]['browser_download_url'] = 'https://evil.example/image.tar.gz'
        with patch.object(m, 'release_json', return_value=[record]):
            self.assertIsNone(m.check_updates({'version': '1.0.0-rc.8', 'commit': 'a' * 40}))

    def test_preferences_persist_and_disable_network_checks(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            self.assertTrue(m.update_preferences(folder)['autoCheck'])
            m.set_update_preferences(folder, False)
            self.assertFalse(m.update_preferences(folder)['autoCheck'])
            with patch.object(m, 'check_updates') as network, patch.object(m.sys.stdin, 'isatty', return_value=True):
                self.assertIsNone(m.offer_update(folder, {'release': {}}, 'en'))
            network.assert_not_called()

    def test_declining_or_disabling_offer_never_downloads_or_updates(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            with patch.object(m, 'check_updates', return_value=published()), patch.object(m.sys.stdin, 'isatty', return_value=True), patch('builtins.input', return_value='n'), patch('builtins.print'):
                self.assertIsNone(m.offer_update(folder, {'release': {'version': '1.0.0-rc.8'}}, 'en'))
            with patch.object(m, 'check_updates', return_value=published()), patch.object(m.sys.stdin, 'isatty', return_value=True), patch('builtins.input', return_value='off'), patch('builtins.print'):
                self.assertIsNone(m.offer_update(folder, {'release': {'version': '1.0.0-rc.8'}}, 'en'))
            self.assertFalse(m.update_preferences(folder)['autoCheck'])

    def test_background_network_failure_does_not_break_status_or_prompt(self):
        with tempfile.TemporaryDirectory() as d:
            with patch.object(m, 'check_updates', side_effect=OSError('offline')), patch.object(m.sys.stdin, 'isatty', return_value=True), patch('builtins.input') as prompt, patch('builtins.print'):
                self.assertIsNone(m.offer_update(Path(d), {'release': {}}, 'en'))
            prompt.assert_not_called()

    def test_archive_rejects_traversal_and_links_before_extracting_any_file(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            for bad, link in [('../outside', False), ('payload/link', True), ('/absolute', False)]:
                archive = root / 'package.tar.gz'
                with tarfile.open(archive, 'w:gz') as tar:
                    info = tarfile.TarInfo(bad)
                    if link: info.type = tarfile.SYMTYPE; info.linkname = '../../outside'
                    tar.addfile(info)
                target = root / 'unpacked'; target.mkdir(exist_ok=True)
                with self.assertRaises(ValueError): m.extract_update(archive, target)
                self.assertEqual(list(target.iterdir()), [])

    def test_cleanup_removes_only_recorded_unused_tags_without_force(self):
        old = 'castlink-easy-web:' + 'a' * 40
        current = 'castlink-easy-web:' + 'b' * 40
        used = 'castlink-easy-postgres:' + 'a' * 40
        calls = []
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            m.write_private(folder / m.IMAGE_RECEIPT, {'schemaVersion': 1, 'images': [
                {'tag': tag, 'id': 'sha256:' + 'c' * 64} for tag in [old, current, used]]})
            def docker(args, **kwargs):
                calls.append(args)
                if args[:2] == ['image', 'ls']: return 'sha256:' + 'c' * 64
                if args[0] == 'ps': return 'container-id' if args[-1] == 'ancestor=' + used else ''
                if args[0] == 'inspect': return used
                return ''
            with patch.object(m, 'docker', side_effect=docker):
                m.cleanup_images(folder, {'release': {'images': {'web': current}}})
            self.assertIn(['image', 'rm', old], calls)
            self.assertFalse(any('--force' in c or 'prune' in c for c in calls))
            self.assertFalse(any(c[:2] == ['image', 'rm'] and c[-1] in [used, current] for c in calls))

    def test_obsolete_tag_on_shared_current_image_id_can_be_removed(self):
        old = 'castlink-easy-postgres:' + 'a' * 40
        current = 'castlink-easy-postgres:' + 'b' * 40
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            m.write_private(folder / m.IMAGE_RECEIPT, {'schemaVersion': 1, 'images': [{'tag': old, 'id': 'sha256:' + 'c' * 64}]})
            calls = []
            def engine(args, **kwargs):
                calls.append(args)
                if args[:2] == ['image', 'ls']: return 'sha256:' + 'c' * 64
                if args[0] == 'ps': return 'current-container'
                if args[0] == 'inspect': return current
                return ''
            with patch.object(m, 'docker', side_effect=engine):
                m.cleanup_images(folder, {'release': {'images': {'postgres': current}}})
            self.assertIn(['image', 'rm', old], calls)

    def test_cleanup_retry_handles_already_removed_tags_after_partial_failure(self):
        tags = ['castlink-easy-web:' + 'a' * 40, 'castlink-easy-postgres:' + 'a' * 40]
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); present = set(tags); failed = False
            m.write_private(folder / m.IMAGE_RECEIPT, {'schemaVersion': 1, 'images': [{'tag': tag, 'id': 'sha256:' + 'c' * 64} for tag in tags]})
            def engine(args, **kwargs):
                nonlocal failed
                if args[:2] == ['image', 'ls']: return 'sha256:' + 'c' * 64 if args[-1] in present else ''
                if args[0] == 'ps': return ''
                if args[:2] == ['image', 'rm']:
                    if args[-1] == tags[1] and not failed:
                        failed = True; raise ValueError('transient failure')
                    present.remove(args[-1])
                return ''
            with patch.object(m, 'docker', side_effect=engine):
                with self.assertRaises(ValueError): m.cleanup_images(folder, {'release': {'images': {}}})
                m.cleanup_images(folder, {'release': {'images': {}}})
            self.assertEqual(present, set())
            self.assertEqual(m.image_receipt(folder)['images'], [])

    def test_changed_image_identity_is_never_deleted(self):
        tag = 'castlink-easy-web:' + 'a' * 40
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            m.write_private(folder / m.IMAGE_RECEIPT, {'schemaVersion': 1, 'images': [{'tag': tag, 'id': 'sha256:' + 'c' * 64}]})
            with patch.object(m, 'docker', return_value='sha256:' + 'd' * 64) as engine:
                m.cleanup_images(folder, {'release': {'images': {}}})
            self.assertFalse(any(c.args[0][:2] == ['image', 'rm'] for c in engine.call_args_list))


if __name__ == '__main__': unittest.main()
