"""Offline fixtures for the permanent Linux updater; never starts Docker."""
import contextlib
import base64
import tarfile
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'updater/castlink-updater.py'
spec = importlib.util.spec_from_file_location('persistent_updater', SCRIPT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def fixture(version='1.0.0', sha='a', protocol=1):
    tag = f'updater-v{version}-{sha * 12}'
    files = {'castlink-updater.py': ('import sys\nprint("engine fixture '+version+'")\nsys.exit(0)\n').encode(),
             'linux-compose-setup.py': b'# adapter fixture\n'}
    manifest = dict(schemaVersion=1, protocolVersion=protocol, channel='updater', repository='resokol/castlink',
                    version=version, sourceCommit=sha * 40, releaseTag=tag,
                    platforms={'linux': {'entry': 'castlink-updater.py', 'files': [
                        dict(file=n, size=len(b), sha256=hashlib.sha256(b).hexdigest()) for n, b in files.items()]}})
    files['manifest.json'] = json.dumps(manifest).encode()
    record = dict(id=100 + int(version.split('.')[-1]), tag_name=tag, target_commitish=sha * 40,
                  draft=False, prerelease=False, published_at='2026-11-21T00:00:00Z',
                  assets=[dict(id=i+1, name=n, size=len(b), state='uploaded', digest='sha256:'+hashlib.sha256(b).hexdigest(),
                     browser_download_url=m.DOWNLOAD + tag + '/' + n) for i, (n,b) in enumerate(files.items())])
    return record, files


def network(record, files):
    def fetch(url, limit):
        if url == m.API + '/' + str(record['id']): return json.dumps(record).encode()
        if url.startswith(m.API + '?'): return json.dumps([record]).encode()
        return files[url.rsplit('/', 1)[-1]]
    return fetch


class Bootstrap(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'updater'
        m.private_directory(self.root)

    def prepare(self, record, files):
        with patch.object(m, 'fetch', side_effect=network(record, files)):
            return m.prepare(self.root, record)

    def test_same_installed_launcher_runs_two_successive_new_engines(self):
        bindir = Path(self.temp.name) / 'bin'
        command = m.install_launcher(self.root, bindir)
        (self.root / 'bootstrap.py').write_bytes(SCRIPT.read_bytes())
        (self.root / 'bootstrap.py').chmod(0o600)
        hooks = Path(self.temp.name) / 'hooks'
        hooks.mkdir()
        mapping = hooks / 'network.json'
        (hooks / 'fixture_transport.py').write_text("""import base64, io, json, os, urllib.request
class Offline:
    def open(self, request, timeout=None):
        values=json.load(open(os.environ['CASTLINK_TEST_NETWORK']))
        url=request.full_url
        if url not in values: raise OSError('Unexpected fixture URL: '+url)
        return io.BytesIO(base64.b64decode(values[url]))
urllib.request.build_opener=lambda *args: Offline()
""")
        # Inject fixture HTTPS transport at the interpreter boundary. Production uses -I
        # and has no environment variable or test endpoint that can disable verification.
        harness=hooks/'harness.py'
        harness.write_text('import runpy, sys\nexec(open('+repr(str(hooks/'fixture_transport.py'))+').read())\nsys.argv=sys.argv[1:]\nrunpy.run_path(sys.argv[0],run_name="__main__")\n')
        interpreter=bindir/'python3'
        interpreter.write_text('#!/bin/sh\nshift 2\nexec '+m.shlex.quote(sys.executable)+' -I -B '+m.shlex.quote(str(harness))+' "$@"\n')
        interpreter.chmod(0o755)
        for number, sha in [(1, 'a'), (2, 'b')]:
            record, files = fixture('1.0.'+str(number), sha)
            responses={m.API+'?per_page=100&page=1':json.dumps([record]).encode(),
                       m.API+'/'+str(record['id']):json.dumps(record).encode()}
            responses.update({m.DOWNLOAD+record['tag_name']+'/'+name:data for name,data in files.items()})
            mapping.write_text(json.dumps({url:base64.b64encode(data).decode() for url,data in responses.items()}))
            result=subprocess.run([str(command),'check-updates'],env={**os.environ,'PATH':str(bindir)+os.pathsep+os.environ['PATH'],
                 'CASTLINK_TEST_NETWORK':str(mapping)},text=True,capture_output=True,timeout=15)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn('engine fixture 1.0.'+str(number),result.stdout)
        self.assertEqual(m.active_record(self.root)['previous'],'updater-v1.0.1-'+'a'*12)

    def test_failed_activation_does_not_accumulate_unbounded_cache(self):
        record, files = fixture()
        m.activate(self.root, self.prepare(record, files))
        for n in range(1,5):
            record, files=fixture('1.0.'+str(n),'b')
            bundle=self.prepare(record,files)
            with patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],1)):
                with self.assertRaises(ValueError): m.activate(self.root,bundle)
        self.assertLessEqual(len(list((self.root/'versions').iterdir())),3)

    def test_truncated_http_and_rate_limit_are_errors(self):
        record,files=fixture()
        with patch.object(m,'fetch',side_effect=OSError('HTTP 429')):
            with self.assertRaises(OSError): m.prepare(self.root,record)
        files['manifest.json']=files['manifest.json'][:8]
        with self.assertRaises(ValueError): self.prepare(record,files)

    def test_unrelated_bootstrap_not_overwritten_by_install(self):
        record,files=fixture()
        bundle=self.prepare(record,files)
        (self.root/'bootstrap.py').write_text('unrelated original file')
        bindir=Path(self.temp.name)/'bin'
        fake=type('Adapter',(),{'load_state':lambda _,folder:{'installationId':'one'}})()
        with patch.object(m,'catalog',return_value=[record]), patch.object(m,'prepare',return_value=bundle), patch.object(m,'load_adapter',return_value=fake):
            self.assertEqual(m.main(['install','--state-dir',str(self.root),'--install-root',str(self.root),'--bin-dir',str(bindir)]),1)
        self.assertEqual((self.root/'bootstrap.py').read_text(),'unrelated original file')

    def test_stable_channel_selection(self):
        good, _ = fixture()
        prerelease = dict(good, prerelease=True, tag_name='updater-v9.0.0-'+'a'*12)
        other = dict(good, tag_name='linux-v99.0.0-'+'a'*12)
        self.assertEqual(m.select_updater([other, prerelease, good])['id'], good['id'])
        with self.assertRaises(ValueError): m.select_updater([])

    def test_two_upgrades_keep_current_previous_and_prune(self):
        for n, sha in [(0, 'a'), (1, 'b'), (2, 'c')]:
            record, files = fixture('1.0.' + str(n), sha)
            bundle = self.prepare(record, files)
            m.activate(self.root, bundle)
        active = m.read_json(self.root / 'active.json')
        self.assertEqual(active['current'], record['tag_name'])
        self.assertIn('1.0.1', active['previous'])
        self.assertEqual(len(list((self.root / 'versions').iterdir())), 2)

    def test_no_updater_downgrade(self):
        newer, data = fixture('1.0.2', 'b')
        m.activate(self.root, self.prepare(newer, data))
        old, data = fixture()
        with self.assertRaisesRegex(ValueError, 'downgrade'): self.prepare(old, data)

    def test_download_counters_do_not_invalidate_immutable_cached_identity(self):
        record,files=fixture();bundle=self.prepare(record,files)
        updated=copy.deepcopy(record)
        updated['body']='Edited release notes'
        for a in updated['assets']: a['download_count']=42
        self.assertEqual(self.prepare(updated,files),bundle)
        with patch.object(m,'fetch',return_value=json.dumps(updated).encode()):
            self.assertEqual(m.pinned(record)['id'],record['id'])

    def test_manifest_and_file_digests_and_sizes(self):
        for name in ['manifest.json', 'castlink-updater.py', 'linux-compose-setup.py']:
            record, files = fixture()
            files[name] += b'corrupt'
            with self.subTest(name=name), self.assertRaises(ValueError): self.prepare(record, files)

    def test_cached_files_reverified_not_executed(self):
        record, files = fixture()
        bundle = self.prepare(record, files)
        (bundle / 'castlink-updater.py').write_text('corrupt')
        with self.assertRaises(ValueError): self.prepare(record, files)

    def test_unexpected_cached_module_is_rejected(self):
        record,files=fixture();bundle=self.prepare(record,files)
        (bundle/'hashlib.py').write_text('raise RuntimeError("must not import")')
        with self.assertRaisesRegex(ValueError,'Unexpected files'): self.prepare(record,files)

    def test_real_bundle_probe_and_install_attach_without_product_calls(self):
        record,files=fixture()
        files['castlink-updater.py']=SCRIPT.read_bytes()
        files['linux-compose-setup.py']=b"import json\ndef load_state(folder): return json.loads((folder/'.castlink-install.json').read_text())\n"
        manifest=json.loads(files['manifest.json'])
        manifest['platforms']['linux']['files']=[dict(file=n,size=len(files[n]),sha256=hashlib.sha256(files[n]).hexdigest()) for n in m.TOOLS]
        files['manifest.json']=json.dumps(manifest).encode()
        for a in record['assets']:
            a['size']=len(files[a['name']]);a['digest']='sha256:'+hashlib.sha256(files[a['name']]).hexdigest()
        folder=Path(self.temp.name)/'existing';folder.mkdir()
        marker=folder/'.castlink-install.json';marker.write_text(json.dumps({'installationId':'registered-fixture'}))
        before=marker.read_bytes();bindir=Path(self.temp.name)/'bin'
        with patch.object(m,'fetch',side_effect=network(record,files)),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(m.main(['install','--install-root',str(self.root),'--bin-dir',str(bindir),'--state-dir',str(folder),'--lang','en']),0)
        self.assertEqual(marker.read_bytes(),before)
        self.assertEqual(m.registry(self.root)['installations'],[{'path':str(folder),'installationId':'registered-fixture'}])
        self.assertIn(b'python3 -I -B',(bindir/'castlink').read_bytes())

    def test_cache_symlink_rejected(self):
        record, files = fixture()
        bundle = self.prepare(record, files)
        script = bundle / 'castlink-updater.py'
        script.unlink()
        script.symlink_to(SCRIPT)
        with self.assertRaises(ValueError): self.prepare(record, files)

    def test_failed_probe_retains_active_version(self):
        record, files = fixture()
        m.activate(self.root, self.prepare(record, files))
        before = (self.root / 'active.json').read_bytes()
        record, files = fixture('1.0.1', 'b')
        bundle = self.prepare(record, files)
        with patch.object(m.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)):
            with self.assertRaises(ValueError): m.activate(self.root, bundle)
        self.assertEqual((self.root / 'active.json').read_bytes(), before)

    def test_protocol_mismatch_fails_before_tools_download(self):
        record, files = fixture(protocol=2)
        with self.assertRaisesRegex(ValueError, 'protocol'): self.prepare(record, files)

    def test_release_id_and_source_pinning(self):
        record, files = fixture()
        for field, value in [('id', True), ('target_commitish', 'b'*40), ('tag_name', 'updater-v1.0.0-'+'b'*12)]:
            bad = dict(record, **{field: value})
            with self.subTest(field=field), self.assertRaises(ValueError): self.prepare(bad, files)
        altered = dict(record, id=999)
        with patch.object(m, 'fetch', return_value=json.dumps(altered).encode()):
            with self.assertRaises(ValueError): m.prepare(self.root, record)

    def test_duplicate_and_unsafe_manifest_paths(self):
        record, files = fixture()
        manifest = json.loads(files['manifest.json'])
        for name in ['../escape.py', '/tmp/escape.py', 'a/b.py', 'linux-compose-setup.py']:
            bad = copy.deepcopy(manifest)
            bad['platforms']['linux']['files'][0]['file'] = name
            with self.subTest(name=name), self.assertRaises(ValueError): m.validate_manifest(bad, record)

    def test_offline_does_not_return_no_updates(self):
        with patch.object(m, 'fetch', side_effect=OSError('offline')):
            with self.assertRaises(OSError): m.catalog()

    def test_concurrent_updater_lock(self):
        with m.updater_lock(self.root):
            with self.assertRaises(ValueError):
                with m.updater_lock(self.root): pass

    def test_interrupted_first_bootstrap_write_can_be_retried(self):
        record,files=fixture();bundle=self.prepare(record,files)
        adapter=type('Adapter',(),{'load_state':lambda _,folder:{'installationId':'existing-id'}})()
        bindir=Path(self.temp.name)/'bin'
        args=['install','--install-root',str(self.root),'--bin-dir',str(bindir),'--state-dir',str(self.root)]
        original=m.atomic_write
        def interrupted(path,data,mode=0o600):
            original(path,data,mode)
            if path.name=='bootstrap.py': raise OSError('simulated interruption after atomic bootstrap write')
        with patch.object(m,'catalog',return_value=[record]),patch.object(m,'prepare',return_value=bundle),patch.object(m,'load_adapter',return_value=adapter),contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
            with patch.object(m,'atomic_write',side_effect=interrupted): self.assertEqual(m.main(args),1)
            self.assertEqual(m.main(args),0)
        self.assertEqual(m.registry(self.root)['installations'],[{'path':str(self.root),'installationId':'existing-id'}])

    def test_unowned_command_collision_preserved(self):
        bindir = Path(self.temp.name) / 'bin'
        bindir.mkdir()
        command = bindir / 'castlink'
        command.write_text('existing @castlink/cli')
        with self.assertRaises(ValueError): m.install_launcher(self.root, bindir)
        self.assertEqual(command.read_text(), 'existing @castlink/cli')


class Product(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.folder = self.root / 'server'
        self.folder.mkdir()
        self.state = {'installationId': 'id-one', 'completed': True, 'release': {'version': '1.0.0', 'commit': 'a'*40},
                      'network': {'publicOrigin': 'https://example.test'}}
        self.registry = {'schemaVersion': 1, 'language': 'en', 'installations': [{'path': str(self.folder), 'installationId': 'id-one'}]}
        self.events = []
        class Adapter:
            def load_state(adapter, folder): return copy.deepcopy(self.state)
            def update_preferences(adapter, folder): return {'autoCheck': True}
            def set_update_preferences(adapter, folder, value): self.events.append(('prefs', folder, value))
            @contextlib.contextmanager
            def installation_lock(adapter, folder):
                self.events.append(('lock', folder)); yield
            @contextlib.contextmanager
            def downloaded_update(adapter, folder, candidate):
                self.events.append(('download', folder, candidate))
                yield folder / 'verified-package', {'version': candidate['version'], 'commit': 'b'*40, 'track': 'linux'}
            def apply_update(adapter, *args): self.events.append(('apply', args))
        self.adapter = Adapter()
        self.candidate = {'version': '1.0.1', 'commitPrefix': 'b'*12, 'body': 'Release notes', 'id': 50}

    def run_product(self, command, confirm='n'):
        with patch.object(m, 'select_product', return_value=self.candidate), patch.object(m, 'verify_product_release', return_value={'sourceCommit':'b'*40}), patch.object(m, 'verified_product_download', side_effect=lambda adapter, folder, candidate: adapter.downloaded_update(folder, candidate)), patch('builtins.input', return_value=confirm), contextlib.redirect_stdout(io.StringIO()):
            return m.product_command(self.adapter, self.registry, command, None, 'en', None)

    def test_incompatible_manifest_is_rejected_before_announcement_or_confirmation(self):
        for command in ('check-updates', 'update'):
            output = io.StringIO()
            with patch.object(m, 'select_product', return_value=self.candidate), patch.object(m, 'verify_product_release', side_effect=ValueError('incompatible manifest')) as verify, patch('builtins.input', side_effect=AssertionError('must not confirm')) as confirm, contextlib.redirect_stdout(output):
                with self.assertRaisesRegex(ValueError, 'incompatible manifest'):
                    m.product_command(self.adapter, self.registry, command, None, 'en', None)
            verify.assert_called_once_with(self.candidate)
            confirm.assert_not_called()
            self.assertEqual(output.getvalue(), '')
            self.assertEqual(self.events, [])

    def test_check_and_cancel_do_not_apply_or_download(self):
        self.run_product('check-updates')
        self.run_product('update')
        self.assertEqual(self.events, [])

    def test_confirmed_exact_package_same_state_and_lock(self):
        self.run_product('update', 'y')
        self.assertEqual(self.events[0], ('lock', self.folder))
        self.assertEqual(self.events[1], ('download', self.folder, self.candidate))
        self.assertEqual(self.events[2][0], 'apply')
        args = self.events[2][1]
        self.assertEqual(args[0], self.folder)
        self.assertEqual(args[1]['installationId'], 'id-one')
        self.assertEqual(args[2], self.folder / 'verified-package')

    def test_multiple_states_require_explicit_selection(self):
        self.registry['installations'].append({'path': str(self.root / 'other'), 'installationId': 'id-two'})
        with self.assertRaises(ValueError): m.choose_installation(self.adapter, self.registry, None)
        self.assertEqual(m.choose_installation(self.adapter, self.registry, self.folder)[0], self.folder)

    def test_explicit_registration_can_rebind_moved_state_only_when_old_path_is_gone(self):
        moved=self.root/'moved';self.folder.rename(moved)
        m.register(self.adapter,self.registry,moved)
        self.assertEqual(self.registry['installations'],[{'path':str(moved),'installationId':'id-one'}])
        duplicate=self.root/'duplicate';duplicate.mkdir()
        with self.assertRaises(ValueError): m.register(self.adapter,self.registry,duplicate)

    def test_changed_identity_or_release_after_confirmation_is_rejected(self):
        for change in [{'installationId': 'replaced'}, {'release': {'version': '1.0.2', 'commit': 'c'*40}}]:
            original = self.adapter.load_state
            calls = 0
            def changed(folder):
                nonlocal calls
                calls += 1
                return original(folder) if calls == 1 else dict(original(folder), **change)
            with patch.object(self.adapter, 'load_state', side_effect=changed), self.assertRaises(ValueError): self.run_product('update', 'y')
            self.assertFalse(any(e[0] == 'apply' for e in self.events))

    def test_preferences_local_no_network(self):
        with patch.object(m, 'select_product', side_effect=AssertionError('network')), contextlib.redirect_stdout(io.StringIO()):
            m.product_command(self.adapter, self.registry, 'updates', self.folder, 'zh-CN', 'off')
        self.assertEqual(self.events, [('prefs', self.folder, False)])

    def test_stable_product_selection_filters_rc_and_other_channels(self):
        def product(version, char='b', prerelease=False):
            tag = 'linux-v'+version+'-'+char*12
            return dict(id=50, tag_name=tag, draft=False, prerelease=prerelease, published_at='2026-11-21T00:00:00Z',
                assets=[dict(id=1, name=n, size=100, state='uploaded', digest='sha256:'+'a'*64, browser_download_url=m.DOWNLOAD+tag+'/'+n) for n in m.PRODUCT_FILES])
        stable = product('1.0.1')
        records = [product('9.0.0', prerelease=True), product('8.0.0-rc.1'), stable]
        with patch.object(m, 'catalog', return_value=records):
            self.assertEqual(m.select_product(self.state['release'])['version'], '1.0.1')
        with patch.object(m, 'catalog', return_value=[product('0.9.0')]):
            self.assertIsNone(m.select_product(self.state['release']))

class RealAdapter(unittest.TestCase):
    def test_verified_product_archive_uses_existing_adapter_and_rejects_metadata_tamper(self):
        adapter_spec=importlib.util.spec_from_file_location('existing_linux_adapter',SCRIPT.parent.parent/'linux-compose-setup.py')
        adapter=importlib.util.module_from_spec(adapter_spec)
        adapter_spec.loader.exec_module(adapter)
        sha='b'*40
        tag='linux-v1.0.1-'+sha[:12]
        manifest={'schemaVersion':1,'track':'linux','version':'1.0.1','sourceCommit':sha,'tag':tag,'repository':'resokol/castlink'}
        images=b'fixture image bytes; never passed to Docker'
        release={**manifest,'commit':sha,'imageArchive':'images.tar.gz','imageArchiveSha256':hashlib.sha256(images).hexdigest(),
                 'images':{n:'castlink-easy-'+n+':'+sha for n in ('web','postgres','livekit','caddy')},
                 'imageIdentities':{n:'sha256:'+'a'*64 for n in ('web','postgres','livekit','caddy')}}
        archive=io.BytesIO()
        with tarfile.open(fileobj=archive,mode='w:gz') as tar:
            for name,data in [('payload/release.json',json.dumps(release).encode()),('payload/images.tar.gz',images)]:
                item=tarfile.TarInfo(name);item.size=len(data);tar.addfile(item,io.BytesIO(data))
        files={'manifest.json':json.dumps(manifest).encode(),'CastLink-Linux.tar.gz':archive.getvalue()}
        files['SHA256SUMS']=(hashlib.sha256(files['CastLink-Linux.tar.gz']).hexdigest()+'  CastLink-Linux.tar.gz\n').encode()
        record={'id':900,'tag_name':tag,'target_commitish':sha,'draft':False,'prerelease':False,'published_at':'2026-11-21T00:00:00Z',
                'version':'1.0.1','commitPrefix':sha[:12],
                'assets':[dict(id=i+1,name=n,size=len(data),state='uploaded',digest='sha256:'+hashlib.sha256(data).hexdigest(),
                  browser_download_url=m.DOWNLOAD+tag+'/'+n) for i,(n,data) in enumerate(files.items())]}
        original=adapter.download_asset
        def response(url): return io.BytesIO(files[url.rsplit('/',1)[-1]])
        with tempfile.TemporaryDirectory() as directory, patch.object(m,'fetch',side_effect=network(record,files)), patch.object(adapter,'release_response',side_effect=response):
            folder=Path(directory)
            with m.verified_product_download(adapter,folder,record) as (package,verified):
                self.assertEqual(verified['commit'],sha)
                self.assertEqual((package/'payload/images.tar.gz').read_bytes(),images)
            self.assertIs(adapter.download_asset,original)
            record['assets'][2]['digest']='sha256:'+'0'*64
            with self.assertRaisesRegex(ValueError,'metadata digest'):
                with m.verified_product_download(adapter,folder,record): pass
            self.assertIs(adapter.download_asset,original)

if __name__ == '__main__': unittest.main()
