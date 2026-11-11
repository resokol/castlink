"""Proof for the release bootstrap; Docker/apt/network are isolated boundaries."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import textwrap
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / 'install-server.py'


class Bootstrap(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SOURCE.is_file(), 'single-command release bootstrap is missing')
        spec = importlib.util.spec_from_file_location('server_bootstrap', SOURCE)
        self.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.m)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pin = {'repository': 'resokol/castlink', 'tag': 'linux-v1.0.0-rc.8-' + 'a' * 12,
                    'version': '1.0.0-rc.8', 'sourceCommit': 'a' * 40,
                    'archiveSha256': 'b' * 64, 'archiveBytes': 100}

    def archive(self, members):
        archive = self.root / 'package.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name, body, kind in members:
                member = tarfile.TarInfo(name)
                member.type = kind
                if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE): member.linkname = '../outside'
                data = body.encode()
                member.size = len(data) if kind == tarfile.REGTYPE else 0
                tar.addfile(member, io.BytesIO(data) if kind == tarfile.REGTYPE else None)
        return archive

    def package(self, fail=False, interactive=False):
        helper = '''import sys,json,pathlib
args=sys.argv[1:]; command=args[0]; folder=pathlib.Path(args[args.index('--state-dir')+1])
with open(folder/'calls','a') as out: out.write(command+'\\n')
if command=='init':
 if INTERACTIVE:
  print('FIXTURE configuration: ',end='',flush=True); assert input()=='terminal-answer'
 state={'owner':'castlink-linux-compose-v1','installationId':'12345678-1234-4234-8234-123456789abc','completed':False,'release':{'commit':'COMMIT'},'network':{'publicOrigin':'https://cast.example'}}
 (folder/'.castlink-install.json').write_text(json.dumps(state)); (folder/'secrets.json').write_text('retained-secrets')
else:
 if command=='owner-access':
  pathlib.Path(args[args.index('--owner-access-file')+1]).write_text('private-owner-invitation'); sys.exit(0)
 assert not sys.stdin.isatty(), 'start must not enter the interactive updater'
 if FAIL: sys.exit(7)
 state=json.loads((folder/'.castlink-install.json').read_text()); state['completed']=True
 (folder/'.castlink-install.json').write_text(json.dumps(state))
'''.replace('INTERACTIVE', repr(interactive)).replace('COMMIT', 'a' * 40).replace('FAIL', repr(fail))
        release = {'track': 'linux', 'tag': self.pin['tag'], 'version': self.pin['version'],
                   'commit': self.pin['sourceCommit'], 'distributionRepository': self.pin['repository'],
                   'bundleFiles': {'scripts/linux-compose-setup.py': hashlib.sha256(helper.encode()).hexdigest()}}
        archive = self.archive([('scripts/linux-compose-setup.py', helper, tarfile.REGTYPE),
                                ('payload/release.json', json.dumps(release), tarfile.REGTYPE),
                                ('payload/images.tar.gz', 'image-fixture', tarfile.REGTYPE)])
        self.pin.update(archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest(), archiveBytes=archive.stat().st_size)
        return archive

    def download_fixture(self, archive):
        urls = []
        def download(url, target, limit, expected_bytes=None):
            urls.append(url)
            data = (self.pin['archiveSha256'] + '  CastLink-Linux.tar.gz\n').encode() if url.endswith('SHA256SUMS') else archive.read_bytes()
            Path(target).write_bytes(data)
        return download, urls

    def run_install(self, args, archive):
        download, urls = self.download_fixture(archive)
        with patch.object(self.m, 'PIN', self.pin), patch.object(self.m, 'validate_platform'), patch.object(self.m, 'ensure_runtime') as runtime, patch.object(self.m, 'download', side_effect=download):
            result = self.m.main(args)
        return result, urls, runtime

    def test_fresh_install_runs_verified_helper_init_and_start_then_rerun_is_read_only(self):
        archive = self.package(); state = self.root / 'server with spaces'
        args = ['--state-dir', str(state), '--config', str(self.root / 'configuration.json'), '--room-creation-password-file', str(self.root / 'password')]
        (self.root / 'configuration.json').write_text('{}'); (self.root / 'password').write_text('chosen-password')
        result, urls, runtime = self.run_install(args, archive)
        self.assertEqual(result, 0)
        self.assertEqual((state / 'calls').read_text(), 'init\nstart\n')
        self.assertEqual(len(urls), 2)
        self.assertTrue(all('/' + self.pin['tag'] + '/' in url for url in urls))
        self.assertTrue((state / '.castlink-package/scripts/linux-compose-setup.py').is_file())
        before = {str(p.relative_to(state)): p.read_bytes() for p in state.rglob('*') if p.is_file()}
        result, urls, runtime = self.run_install(['--state-dir', str(state)], archive)
        self.assertEqual(result, 0); self.assertEqual(urls, []); runtime.assert_not_called()
        self.assertEqual(before, {str(p.relative_to(state)): p.read_bytes() for p in state.rglob('*') if p.is_file()})

    def test_helper_failure_propagates_and_retry_reuses_secrets_and_package(self):
        archive = self.package(fail=True); state = self.root / 'server'
        args = ['--state-dir', str(state), '--config', str(self.root / 'config'), '--room-creation-password-file', str(self.root / 'password')]
        (self.root / 'config').write_text('{}'); (self.root / 'password').write_text('password')
        result, _, _ = self.run_install(args, archive)
        self.assertNotEqual(result, 0)
        self.assertEqual((state / 'secrets.json').read_text(), 'retained-secrets')
        result, urls, _ = self.run_install(['--state-dir', str(state)], archive)
        self.assertNotEqual(result, 0); self.assertEqual(urls, [])
        self.assertEqual((state / 'calls').read_text(), 'init\nstart\nstart\n')
        self.assertEqual((state / 'secrets.json').read_text(), 'retained-secrets')

    def test_unrelated_target_is_retained_before_runtime_or_network(self):
        archive = self.package(); state = self.root / 'foreign'; state.mkdir()
        (state / 'important').write_text('keep')
        result, urls, runtime = self.run_install(['--state-dir', str(state)], archive)
        self.assertNotEqual(result, 0); self.assertEqual(urls, []); runtime.assert_not_called()
        self.assertEqual(list(state.iterdir()), [state / 'important'])
        self.assertEqual((state / 'important').read_text(), 'keep')

    def test_unrelated_lock_only_directory_is_not_adopted(self):
        archive = self.package(); state = self.root / 'foreign'; state.mkdir()
        lock = state / '.castlink-bootstrap.lock'; lock.write_text('foreign-content')
        result, urls, runtime = self.run_install(['--state-dir', str(state)], archive)
        self.assertNotEqual(result, 0); self.assertEqual(urls, []); runtime.assert_not_called()
        self.assertEqual(lock.read_text(), 'foreign-content')
        self.assertEqual(list(state.iterdir()), [lock])

    def test_archive_corruption_is_rejected_before_helper_execution(self):
        archive = self.package(); self.pin['archiveSha256'] = 'f' * 64
        state = self.root / 'server'
        result, _, _ = self.run_install(['--state-dir', str(state), '--config', str(self.root / 'config'), '--room-creation-password-file', str(self.root / 'password')], archive)
        self.assertNotEqual(result, 0)
        self.assertFalse((state / 'calls').exists()); self.assertFalse((state / '.castlink-package').exists())

    def test_tar_paths_links_devices_duplicates_and_parent_file_collisions_are_rejected(self):
        cases = [[('../outside', 'bad', tarfile.REGTYPE)], [('/absolute', 'bad', tarfile.REGTYPE)],
                 [('a\\b', 'bad', tarfile.REGTYPE)], [('link', '', tarfile.SYMTYPE)],
                 [('link', '', tarfile.LNKTYPE)], [('device', '', tarfile.CHRTYPE)],
                 [('a', 'one', tarfile.REGTYPE), ('a', 'two', tarfile.REGTYPE)],
                 [('a/b', 'one', tarfile.REGTYPE), ('a', 'two', tarfile.REGTYPE)]]
        for members in cases:
            target = self.root / 'extract'; target.mkdir(exist_ok=True)
            with self.assertRaises((ValueError, self.m.BootstrapError)):
                self.m.safe_extract(self.archive(members), target)
            self.assertEqual(list(target.iterdir()), [], members)

    def test_valid_archive_extracts_private_files_without_preserving_executable_modes(self):
        archive = self.archive([('scripts/file.py', 'print(1)', tarfile.REGTYPE)])
        target = self.root / 'extract'; target.mkdir()
        self.m.safe_extract(archive, target)
        self.assertEqual((target / 'scripts/file.py').read_text(), 'print(1)')
        self.assertEqual((target / 'scripts/file.py').stat().st_mode & 0o777, 0o600)

    def test_download_limits_content_length_and_pin_are_enforced(self):
        class Response(io.BytesIO):
            headers = {'Content-Length': '5'}
        target = self.root / 'download'
        with patch.object(self.m, 'release_response', return_value=Response(b'12345')):
            self.m.download('https://github.com/resokol/castlink/releases/download/' + self.pin['tag'] + '/SHA256SUMS', target, 10, expected_bytes=5)
        self.assertEqual(target.read_bytes(), b'12345'); target.unlink()
        for body, limit, expected in [(b'123456', 5, None), (b'1234', 10, 5), (b'12345', 10, 7)]:
            with patch.object(self.m, 'release_response', return_value=Response(body)):
                with self.assertRaises(self.m.BootstrapError): self.m.download('unused', target, limit, expected)
            target.unlink(missing_ok=True)

    def test_platform_requires_ubuntu_22_or_24_amd64(self):
        release = self.root / 'os-release'; release.write_text('ID=ubuntu\nVERSION_ID="24.04"\n')
        with patch.object(self.m.platform, 'machine', return_value='x86_64'), patch.object(self.m.os, 'geteuid', return_value=0):
            self.m.validate_platform(release)
            for contents in ['ID=debian\nVERSION_ID="24.04"', 'ID=ubuntu\nVERSION_ID="20.04"']:
                release.write_text(contents)
                with self.assertRaises(self.m.BootstrapError): self.m.validate_platform(release)
        release.write_text('ID=ubuntu\nVERSION_ID="22.04"')
        with patch.object(self.m.platform, 'machine', return_value='aarch64'):
            with self.assertRaises(self.m.BootstrapError): self.m.validate_platform(release)

    def test_runtime_missing_requires_explicit_flag_without_mutations(self):
        with patch.object(self.m, 'runtime_ready', return_value=False), patch.object(self.m, 'install_runtime') as install:
            with self.assertRaises(self.m.BootstrapError): self.m.ensure_runtime(False)
            install.assert_not_called()
        with patch.object(self.m, 'runtime_ready', side_effect=[False, True]), patch.object(self.m, 'install_runtime') as install:
            self.m.ensure_runtime(True); install.assert_called_once()

    def test_help_is_side_effect_free_and_unbuilt_source_is_not_installable(self):
        with patch.object(self.m, 'validate_platform', side_effect=AssertionError('no platform access')), patch.object(self.m, 'ensure_runtime', side_effect=AssertionError('no runtime')):
            with self.assertRaises(SystemExit) as exit_code: self.m.main(['--help'])
            self.assertEqual(exit_code.exception.code, 0)
        self.assertNotEqual(self.m.main([]), 0)

    def test_same_installer_rerun_does_not_adopt_newer_release(self):
        archive = self.package(); state = self.root / 'server'
        args = ['--state-dir', str(state), '--config', str(self.root / 'config'), '--room-creation-password-file', str(self.root / 'password')]
        self.assertEqual(self.run_install(args, archive)[0], 0)
        before = (state / '.castlink-bootstrap.json').read_bytes()
        self.pin = {**self.pin, 'sourceCommit': 'c' * 40, 'tag': 'linux-v1.0.0-rc.8-' + 'c' * 12}
        result, urls, runtime = self.run_install(['--state-dir', str(state)], archive)
        self.assertEqual(result, 0); self.assertEqual(urls, []); runtime.assert_not_called()
        self.assertEqual((state / '.castlink-bootstrap.json').read_bytes(), before)

    def test_explicit_owner_invitation_runs_after_start_and_never_overwrites_output(self):
        archive = self.package(); state = self.root / 'server'; output = self.root / 'owner-invitation.txt'
        args = ['--state-dir', str(state), '--config', str(self.root / 'config'), '--room-creation-password-file', str(self.root / 'password'), '--owner-access-file', str(output)]
        result, _, _ = self.run_install(args, archive)
        self.assertEqual(result, 0)
        self.assertEqual((state / 'calls').read_text(), 'init\nstart\nowner-access\n')
        self.assertEqual(output.read_text(), 'private-owner-invitation')
        result, urls, runtime = self.run_install(['--state-dir', str(state), '--owner-access-file', str(output)], archive)
        self.assertNotEqual(result, 0); self.assertEqual(urls, []); runtime.assert_not_called()
        self.assertEqual((state / 'calls').read_text(), 'init\nstart\nowner-access\n')
        self.assertEqual(output.read_text(), 'private-owner-invitation')

    def test_generated_shell_pipeline_reads_controlling_terminal_and_start_cannot_offer_update(self):
        archive = self.package(interactive=True)
        state = self.root / 'server'; state.mkdir()
        package = state / '.castlink-package'; package.mkdir()
        self.m.safe_extract(archive, package)
        (state / '.castlink-bootstrap.json').write_text(json.dumps({'schemaVersion': 1, 'owner': self.m.OWNER, 'release': self.pin}))
        password = self.root / 'password'; password.write_text('chosen-password')
        os_release = self.root / 'os-release'; os_release.write_text('ID=ubuntu\nVERSION_ID="24.04"\n')
        # Only OS/uid preflight is adapted to this non-root Debian test host.
        # The actual embedded script, subprocess stdin and tty are exercised.
        python = SOURCE.read_text().replace('PIN = None  # @@CASTLINK_RELEASE_PIN@@', 'PIN = ' + repr(self.pin))
        python = python.replace("Path('/etc/os-release')", 'Path(' + repr(str(os_release)) + ')').replace('if os.geteuid() != 0:', 'if False:')
        script = self.root / 'install-server.sh'
        script.write_text((SOURCE.with_suffix('.sh')).read_text().replace('@@CASTLINK_PYTHON@@', python))
        bin_dir = self.root / 'bin'; bin_dir.mkdir()
        docker = bin_dir / 'docker'
        docker.write_text('#!/bin/sh\ncase "$1" in info) echo linux;; compose) echo 2.40.0;; *) exit 8;; esac\n'); docker.chmod(0o700)
        harness = textwrap.dedent('''
            import os,pty,select,sys,time,json
            script,folder,password=sys.argv[1:]
            pid,master=pty.fork()
            if pid==0:
                os.execvp('bash',['bash','-c','cat "$1" | bash -s -- --state-dir "$2" --room-creation-password-file "$3"','fixture',script,folder,password])
            output=b''; answered=False; deadline=time.monotonic()+15; status=None
            while time.monotonic()<deadline:
                if select.select([master],[],[],0.1)[0]:
                    try: chunk=os.read(master,65536)
                    except OSError: break
                    if not chunk: break
                    output+=chunk
                    if not answered and b'FIXTURE configuration: ' in output:
                        os.write(master,b'terminal-answer\\n'); answered=True
                done,status=os.waitpid(pid,os.WNOHANG)
                if done: break
            else:
                os.kill(pid,9);os.waitpid(pid,0);raise RuntimeError('pipeline terminal test timed out')
            if not done: _,status=os.waitpid(pid,0)
            print(json.dumps({'status':os.waitstatus_to_exitcode(status),'output':output.decode(errors='replace'),'answered':answered}))
        ''')
        result = subprocess.run(['python3', '-c', harness, str(script), str(state), str(password)],
                                env={**os.environ, 'PATH': str(bin_dir) + ':' + os.environ['PATH']}, capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        terminal = json.loads(result.stdout)
        self.assertEqual(terminal['status'], 0, terminal['output'])
        self.assertTrue(terminal['answered']); self.assertEqual((state / 'calls').read_text(), 'init\nstart\n')

    def test_missing_checksum_refuses_before_archive_download(self):
        archive = self.package(); state = self.root / 'server'
        def wrong_checksum(url, target, *unused): Path(target).write_text('unrelated-checksum\n')
        with patch.object(self.m, 'PIN', self.pin), patch.object(self.m, 'validate_platform'), patch.object(self.m, 'ensure_runtime'), patch.object(self.m, 'download', side_effect=wrong_checksum) as download:
            self.assertNotEqual(self.m.main(['--state-dir', str(state)]), 0)
        self.assertEqual(download.call_count, 1)
        self.assertFalse((state / '.castlink-package').exists())

    def test_archive_limits_are_checked_before_writes(self):
        archive = self.archive([('too-big', '123456', tarfile.REGTYPE)])
        target = self.root / 'extract'; target.mkdir()
        with patch.object(self.m, 'MAX_UNPACKED', 5):
            with self.assertRaises(self.m.BootstrapError): self.m.safe_extract(archive, target)
        self.assertEqual(list(target.iterdir()), [])

    def test_stopped_existing_runtime_is_started_without_apt_install_or_replacement(self):
        calls = []
        def run(arguments, **unused):
            calls.append(arguments)
            if arguments == ['docker', 'compose', 'version', '--short']:
                return subprocess.CompletedProcess(arguments, 0, b'2.40.0\n', b'')
            if arguments == ['systemctl', 'is-active', '--quiet', 'docker']:
                return subprocess.CompletedProcess(arguments, 3, b'', b'')
            if arguments == ['systemctl', 'start', 'docker']:
                return subprocess.CompletedProcess(arguments, 0, b'', b'')
            raise AssertionError('unnecessary runtime mutation: ' + repr(arguments))
        with patch.object(self.m.shutil, 'which', return_value='/usr/bin/docker'), patch.object(self.m, 'command', side_effect=run):
            self.m.install_runtime()
        self.assertEqual(calls[-1], ['systemctl', 'start', 'docker'])


if __name__ == '__main__': unittest.main()
