import contextlib
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

spec = importlib.util.spec_from_file_location('linux_creation', Path(__file__).resolve().parents[1] / 'linux-compose-setup.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def config():
    return {'setupMode': 'quick', 'publicHttps': False, 'network': {
        'mode': 'https', 'publicOrigin': 'https://127.0.0.1', 'bindAddress': '127.0.0.1',
        'mediaIp': '127.0.0.1', 'httpPort': 80, 'httpsPort': 443, 'iceTcpPort': 7881,
        'iceUdpPort': 7882, 'turnUdpPort': 3478, 'relayPortStart': 30000,
        'relayPortEnd': 30031, 'trustedProxies': []}}


def release():
    return {'schemaVersion': 1, 'version': '1.0.0-rc.8', 'commit': 'a' * 40,
            'images': {key: 'castlink-easy-' + key + ':' + 'a' * 40 for key in ['web', 'postgres', 'livekit', 'caddy']}}


def digest(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


class LinuxRoomCreation(unittest.TestCase):
    def run_cli(self, args):
        output = io.StringIO()
        package = patch.object(m, 'verify_package', return_value=release()) if args[0] == 'init' else contextlib.nullcontext()
        with package, contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            try: status = m.main(args)
            except SystemExit as error: status = error.code
        return status, output.getvalue()

    def test_fresh_init_renders_only_chosen_password_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); folder = root / 'installation'; password = ' Пароль $ # " \\ 🔒 '
            network = root / 'network.json'; network.write_text(json.dumps(config()))
            source = root / 'password'; source.write_text(password, encoding='utf-8')
            status, output = self.run_cli(['init', '--state-dir', str(folder), '--config', str(network), '--room-creation-password-file', str(source)])
            self.assertEqual(status, 0, output)
            self.assertEqual(m.load_state(folder)['roomCreationPasswordHash'], digest(password))
            self.assertIn('ROOM_CREATION_PASSWORD_SHA256=' + digest(password) + '\n', (folder / 'web.env').read_text())
            for filename in [m.STATE, 'secrets.json', 'web.env']:
                self.assertNotIn(password, (folder / filename).read_text())
                self.assertEqual((folder / filename).stat().st_mode & 0o777, 0o600)
            self.assertNotIn(password, output)
            original = {name: (folder / name).read_bytes() for name in [m.STATE, 'secrets.json', 'web.env']}
            source.write_text('must-not-rotate-existing-password')
            with patch('getpass.getpass', side_effect=AssertionError('Reinit must not prompt')):
                status, output = self.run_cli(['init', '--state-dir', str(folder), '--config', str(network), '--room-creation-password-file', str(source)])
            self.assertEqual(status, 0, output)
            for name, content in original.items(): self.assertEqual((folder / name).read_bytes(), content)

    def test_render_imports_existing_hash_and_keeps_it_after_env_regeneration(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory); state = m.init_state(folder, config(), release())
            saved = 'b' * 64; (folder / 'web.env').write_text('ROOM_CREATION_PASSWORD_SHA256=' + saved + '\n')
            original_secrets = (folder / 'secrets.json').read_bytes()
            m.render(folder, state, release())
            self.assertEqual(m.load_state(folder).get('roomCreationPasswordHash'), saved)
            (folder / 'web.env').unlink(); m.render(folder, state, release())
            self.assertIn('ROOM_CREATION_PASSWORD_SHA256=' + saved, (folder / 'web.env').read_text())
            self.assertEqual((folder / 'secrets.json').read_bytes(), original_secrets)

    def test_uppercase_manual_hash_remains_valid_and_is_normalized_on_import(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory); state = m.init_state(folder, config(), release())
            (folder / 'web.env').write_text('ROOM_CREATION_PASSWORD_SHA256=' + 'ABCDEF12' * 8 + '\n')
            m.render(folder, state, release())
            expected = 'abcdef12' * 8
            self.assertEqual(m.load_state(folder)['roomCreationPasswordHash'], expected)
            self.assertIn('ROOM_CREATION_PASSWORD_SHA256=' + expected, (folder / 'web.env').read_text())
            (folder / 'web.env').write_text('ROOM_CREATION_PASSWORD_SHA256=' + expected.upper() + '\n')
            m.render(folder, state, release())
            self.assertEqual(m.load_state(folder)['roomCreationPasswordHash'], expected)

    def test_render_refuses_ambiguous_corrupt_mismatched_and_plaintext_configuration(self):
        for content in ['ROOM_CREATION_PASSWORD_SHA256=broken\n',
                        'ROOM_CREATION_PASSWORD_SHA256=' + 'b' * 64 + '\nROOM_CREATION_PASSWORD_SHA256=' + 'b' * 64 + '\n',
                        'ROOM_CREATION_PASSWORD=manual-secret\n',
                        'ROOM_CREATION_PASSWORD_SHA256=' + 'c' * 64 + '\n']:
            with self.subTest(content=content[:35]), tempfile.TemporaryDirectory() as directory:
                folder = Path(directory); state = m.init_state(folder, config(), release())
                if 'c' * 64 in content:
                    state['roomCreationPasswordHash'] = 'b' * 64; m.write_private(folder / m.STATE, state)
                original = (folder / m.STATE).read_bytes(); (folder / 'web.env').write_text(content)
                with self.assertRaises(ValueError): m.render(folder, state, release())
                self.assertEqual((folder / m.STATE).read_bytes(), original)
                self.assertEqual((folder / 'web.env').read_text(), content)

    def test_invalid_or_unconfirmed_fresh_password_writes_no_installation(self):
        for password in ['short', ' ' * 8, 'valid\npassword', 'valid\rpassword', 'valid\0password', '🔒' * 129, b'\xff']:
            with self.subTest(password=repr(password[:6])), tempfile.TemporaryDirectory() as directory:
                root = Path(directory); folder = root / 'installation'; network = root / 'network.json'
                network.write_text(json.dumps(config())); source = root / 'password'
                source.write_bytes(password if isinstance(password, bytes) else password.encode('utf-8'))
                status, output = self.run_cli(['init', '--state-dir', str(folder), '--config', str(network), '--room-creation-password-file', str(source)])
                self.assertEqual(status, 1); self.assertFalse(folder.exists())
                if isinstance(password, str): self.assertNotIn(password, output)
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory) / 'installation'
            with patch.object(m, 'interactive', return_value=config()), patch('getpass.getpass', side_effect=['chosen-secret', 'different-secret']):
                status, output = self.run_cli(['init', '--state-dir', str(folder)])
            self.assertEqual(status, 1); self.assertFalse(folder.exists()); self.assertNotIn('chosen-secret', output)

    def package(self, root):
        package = root / 'package'; payload = package / 'payload'; payload.mkdir(parents=True)
        archive = payload / 'images.tar.gz'; archive.write_bytes(b'fixture image archive - never deployed')
        manifest = {**release(), 'imageArchive': archive.name, 'imageArchiveSha256': m.digest(archive),
                    'imageIdentities': {key: 'sha256:' + 'b' * 64 for key in release()['images']}}
        (payload / 'release.json').write_text(json.dumps(manifest))
        network = root / 'network.json'; network.write_text(json.dumps(config()))
        folder = root / 'installation'
        return folder, [sys.executable, str(Path(m.__file__).resolve()), 'init', '--state-dir', str(folder), '--package', str(package), '--config', str(network), '--lang', 'en']

    @unittest.skipUnless(os.name == 'posix', 'requires a real POSIX terminal')
    def test_actual_terminal_hides_confirmation_and_no_terminal_never_echoes_stdin(self):
        import pty
        import select
        import time
        for mismatch in [False, True]:
            with self.subTest(mismatch=mismatch), tempfile.TemporaryDirectory() as directory:
                folder, argv = self.package(Path(directory)); password = 'Chosen пароль 🔒'
                pid, terminal = pty.fork()
                if pid == 0: os.execv(sys.executable, argv)
                output = b''; stage = 0; deadline = time.monotonic() + 10
                prompts = [b'Room creation password (8-256 characters): ', b'Confirm room creation password: ']
                try:
                    while time.monotonic() < deadline:
                        if not select.select([terminal], [], [], 0.1)[0]: continue
                        try: chunk = os.read(terminal, 65536)
                        except OSError: break
                        if not chunk: break
                        output += chunk
                        if stage < 2 and prompts[stage] in output:
                            answer = 'different-password' if mismatch and stage == 1 else password
                            os.write(terminal, answer.encode('utf-8') + b'\n'); stage += 1
                    else:
                        os.kill(pid, 9); self.fail('Password terminal timed out')
                finally:
                    os.close(terminal); _, status = os.waitpid(pid, 0)
                self.assertEqual(stage, 2); self.assertNotIn(password.encode('utf-8'), output)
                if mismatch:
                    self.assertNotEqual(os.waitstatus_to_exitcode(status), 0); self.assertFalse(folder.exists())
                else:
                    self.assertEqual(os.waitstatus_to_exitcode(status), 0, output.decode('utf-8', 'replace'))
                    self.assertEqual(m.load_state(folder)['roomCreationPasswordHash'], digest(password))
        with tempfile.TemporaryDirectory() as directory:
            folder, argv = self.package(Path(directory)); password = 'piped-password-must-not-be-read'
            result = subprocess.run(argv, input=password + '\n', text=True, capture_output=True, start_new_session=True)
            self.assertNotEqual(result.returncode, 0); self.assertFalse(folder.exists())
            self.assertNotIn(password, result.stdout + result.stderr)

    def container(self, data, env=None):
        calls = []
        def run(folder, state, args, stdin=None, **kwargs):
            self.assertEqual(args[:5], ['exec', '-T', 'web', 'node', '-e'])
            calls.append(args)
            runtime_env = {key: value for key, value in os.environ.items() if key not in ['ROOM_CREATION_PASSWORD', 'ROOM_CREATION_PASSWORD_SHA256']}
            runtime_env.update(STUDIOLINK_DATA_DIR=str(data), **(env or {}))
            result = subprocess.run(['node', '-e', args[5]], input=stdin, text=True, capture_output=True, env=runtime_env)
            if result.returncode: raise ValueError('Docker operation failed')
            return result.stdout
        return calls, run

    def test_recovery_initializes_missing_runtime_without_restart_and_update_preserves_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); folder = root / 'installation'; state = m.init_state(folder, config(), release())
            m.render(folder, state, release()); original_secrets = (folder / 'secrets.json').read_bytes()
            preserved_files = {name: (folder / name).read_bytes() for name in ['compose.json', 'Caddyfile', 'postgres.env', 'livekit.json']}
            # Recovery runs from a new archive against an already installed old release.
            # It must never inspect/adopt the new package or alter deployment metadata.
            original_release = json.loads(json.dumps(state['release']))
            data = root / 'web-data'; data.mkdir(); (data / 'rooms.json').write_text('[{"name":"existing-room"}]')
            password = 'Recovery пароль 🔒'; source = root / 'password'; source.write_text(password, encoding='utf-8')
            calls, run = self.container(data)
            with patch.object(m, 'compose', side_effect=run), patch.object(m, 'verify_package', side_effect=AssertionError('Recovery must not inspect the new package')), patch.object(m, 'render', side_effect=AssertionError('Recovery must not rewrite deployment files')):
                status, output = self.run_cli(['creation-password', '--state-dir', str(folder), '--room-creation-password-file', str(source)])
            self.assertEqual(status, 0, output)
            runtime = data / 'runtime/room-creation-password.json'
            self.assertEqual(json.loads(runtime.read_text()), {'schemaVersion': 1, 'hash': digest(password)})
            self.assertEqual(runtime.stat().st_mode & 0o777, 0o600)
            recovered = m.load_state(folder); self.assertEqual(recovered['roomCreationPasswordHash'], digest(password))
            self.assertEqual(recovered['release'], original_release)
            for name, content in preserved_files.items(): self.assertEqual((folder / name).read_bytes(), content, name)
            self.assertEqual((folder / 'secrets.json').read_bytes(), original_secrets)
            self.assertEqual((data / 'rooms.json').read_text(), '[{"name":"existing-room"}]')
            with patch.object(m, 'load_images'), patch.object(m, 'remember_images'), patch.object(m, 'compose'), patch.object(m, 'complete'), patch.object(m, 'cleanup_installation'):
                m.apply_update(folder, recovered, root, {**release(), 'commit': 'c' * 40}, 'en')
            self.assertEqual(recovered['roomCreationPasswordHash'], digest(password))
            self.assertIn('ROOM_CREATION_PASSWORD_SHA256=' + digest(password), (folder / 'web.env').read_text())
            self.assertEqual(json.loads(runtime.read_text())['hash'], digest(password))
            self.assertNotIn(password, output); self.assertEqual(len(calls), 2)

    def test_recovery_preserves_configured_runtime_and_bootstrap_without_prompt(self):
        for override in [False, True]:
            with self.subTest(override=override), tempfile.TemporaryDirectory() as directory:
                root = Path(directory); folder = root / 'installation'; state = m.init_state(folder, config(), release())
                state['roomCreationPasswordHash'] = 'b' * 64; m.write_private(folder / m.STATE, state); m.render(folder, state, release())
                data = root / 'web-data'; runtime = data / 'runtime/room-creation-password.json'; runtime.parent.mkdir(parents=True)
                if override: runtime.write_text(json.dumps({'schemaVersion': 1, 'hash': 'c' * 64}))
                before = runtime.read_bytes() if override else None
                calls, run = self.container(data, {'ROOM_CREATION_PASSWORD_SHA256': 'b' * 64})
                with patch.object(m, 'compose', side_effect=run), patch('getpass.getpass', side_effect=AssertionError('must not prompt')):
                    status, output = self.run_cli(['creation-password', '--state-dir', str(folder)])
                self.assertEqual(status, 0, output); self.assertEqual(len(calls), 1)
                self.assertEqual(m.load_state(folder)['roomCreationPasswordHash'], 'b' * 64)
                self.assertEqual(runtime.read_bytes() if override else None, before)
                with patch.object(m, 'load_images'), patch.object(m, 'remember_images'), patch.object(m, 'compose'), patch.object(m, 'complete'), patch.object(m, 'cleanup_installation'):
                    m.apply_update(folder, state, root, {**release(), 'commit': 'c' * 40}, 'en')
                self.assertEqual(runtime.read_bytes() if override else None, before)

    def test_recovery_does_not_replace_a_credential_created_between_probe_and_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); folder = root / 'installation'; state = m.init_state(folder, config(), release())
            m.render(folder, state, release()); original = (folder / m.STATE).read_bytes()
            source = root / 'password'; source.write_text('chosen-but-never-applied')
            data = root / 'web-data'; runtime = data / 'runtime/room-creation-password.json'; calls, run = self.container(data)
            def competing(*args, **kwargs):
                result = run(*args, **kwargs)
                if len(calls) == 1:
                    runtime.parent.mkdir(parents=True); runtime.write_text(json.dumps({'schemaVersion': 1, 'hash': 'd' * 64}))
                return result
            with patch.object(m, 'compose', side_effect=competing):
                status, output = self.run_cli(['creation-password', '--state-dir', str(folder), '--room-creation-password-file', str(source)])
            self.assertEqual(status, 0, output); self.assertEqual(json.loads(runtime.read_text())['hash'], 'd' * 64)
            self.assertEqual((folder / m.STATE).read_bytes(), original)

    def test_runtime_success_then_bootstrap_write_failure_is_reported_truthfully(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); folder = root / 'installation'; state = m.init_state(folder, config(), release())
            m.render(folder, state, release()); source = root / 'password'; source.write_text('chosen-recovery-secret')
            data = root / 'web-data'; _, run = self.container(data)
            with patch.object(m, 'compose', side_effect=run), patch.object(m, 'write_private', side_effect=OSError('disk full')):
                status, output = self.run_cli(['creation-password', '--state-dir', str(folder), '--room-creation-password-file', str(source), '--lang', 'en'])
            self.assertEqual(status, 1); self.assertIn('password is active', output)
            self.assertEqual(json.loads((data / 'runtime/room-creation-password.json').read_text())['hash'], digest('chosen-recovery-secret'))
            self.assertNotIn('chosen-recovery-secret', output)

    def test_corrupt_runtime_is_never_replaced_and_docker_unavailable_changes_nothing(self):
        for corrupt in [None, '{broken', json.dumps({'schemaVersion': 1, 'hash': 'bad'})]:
            with self.subTest(corrupt=corrupt), tempfile.TemporaryDirectory() as directory:
                root = Path(directory); folder = root / 'installation'; state = m.init_state(folder, config(), release())
                m.render(folder, state, release()); before = (folder / m.STATE).read_bytes()
                data = root / 'web-data'; runtime = data / 'runtime/room-creation-password.json'
                if corrupt is not None: runtime.parent.mkdir(parents=True); runtime.write_text(corrupt)
                _, run = self.container(data)
                with patch.object(m, 'compose', side_effect=run if corrupt is not None else ValueError('Docker unavailable')), patch('getpass.getpass', side_effect=AssertionError('must not prompt')):
                    status, _ = self.run_cli(['creation-password', '--state-dir', str(folder)])
                self.assertEqual(status, 1); self.assertEqual((folder / m.STATE).read_bytes(), before)
                if corrupt is not None: self.assertEqual(runtime.read_text(), corrupt)


if __name__ == '__main__': unittest.main()
