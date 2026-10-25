import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

HELPER = Path(__file__).resolve().parents[1] / 'linux-compose-setup.py'
spec = importlib.util.spec_from_file_location('linux_compose', HELPER)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def config(mode='https'):
    return {'setupMode': 'advanced', 'publicHttps': False, 'network': {
        'mode': mode, 'publicOrigin': ('http' if mode == 'http' else 'https') + '://cast.example',
        'bindAddress': '127.0.0.1' if mode == 'proxy' else '0.0.0.0',
        'httpPort': 8080 if mode == 'proxy' else 80, 'httpsPort': 443,
        'mediaIp': '203.0.113.8', 'iceTcpPort': 7881, 'iceUdpPort': 7882,
        'turnUdpPort': 3478, 'relayPortStart': 30000, 'relayPortEnd': 30031,
        'trustedProxies': ['172.18.0.1/32'] if mode == 'proxy' else []}}


def release(commit='a' * 40):
    return {'schemaVersion': 1, 'commit': commit,
            'images': {k: 'castlink-easy-' + k + ':' + commit for k in ['web', 'postgres', 'livekit', 'caddy']},
            'imageIdentities': {k: 'sha256:' + 'b' * 64 for k in ['web', 'postgres', 'livekit', 'caddy']}}


class LinuxCompose(unittest.TestCase):
    def test_hourly_cleanup_persists_self_contained_helper_and_owns_lifecycle(self):
        from unittest.mock import patch
        import shutil
        import subprocess
        import sys
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d) / 'installation with spaces'; state = m.init_state(folder, config(), release()); state['completed'] = True
            units = Path(d) / 'units'; units.mkdir(); commands = []
            def engine(args, **kwargs):
                if args == ['context', 'show']: return 'default'
                if args[:2] == ['context', 'inspect']: return 'unix:///var/run/docker.sock'
                if args[0] == 'info': return 'daemon-one'
                raise AssertionError(args)
            with patch.object(m, 'SYSTEMD_UNITS', units), patch.object(m, 'docker', side_effect=engine), patch.object(m, 'systemctl', side_effect=lambda args: commands.append(args)), patch.object(m.os, 'geteuid', return_value=0):
                m.register_cleanup(folder, state)
                helper = folder / '.castlink-retention' / 'linux-compose-setup.py'
                self.assertEqual(helper.read_bytes(), HELPER.read_bytes())
                isolated = Path(d) / 'isolated.py'; shutil.copyfile(helper, isolated)
                result = subprocess.run([sys.executable, str(isolated), '--help'], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0)
                self.assertIn('cleanup', result.stdout)
                timer = next(units.glob('*.timer')); service = next(units.glob('*.service'))
                self.assertIn('OnUnitActiveSec=1h', timer.read_text())
                self.assertIn(str(helper), service.read_text())
                self.assertIn('--installation-id', service.read_text())
                self.assertNotIn('Requires=docker', service.read_text())
                first = service.read_text(); m.register_cleanup(folder, state)
                self.assertEqual(service.read_text(), first)
                service.write_text('foreign unit')
                with self.assertRaisesRegex(ValueError, 'ownership'): m.unregister_cleanup(folder, state)
                self.assertTrue(service.exists())
                service.write_text(first); m.unregister_cleanup(folder, state)
                self.assertFalse(timer.exists()); self.assertFalse(service.exists())
                self.assertFalse(helper.exists())
                self.assertTrue((folder / m.STATE).exists())

    def test_cleanup_command_uses_lock_and_identity_without_start_or_network(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); state['completed'] = True; m.write_private(folder / m.STATE, state)
            def registered(args, **kwargs):
                if args == ['context', 'show']: return 'default'
                if args[:2] == ['context', 'inspect']: return 'unix:///var/run/docker.sock'
                if args[0] == 'info': return 'daemon-one'
                raise AssertionError(args)
            units = folder / 'units'; units.mkdir()
            with patch.object(m, 'SYSTEMD_UNITS', units), patch.object(m, 'docker', side_effect=registered), patch.object(m, 'systemctl'), patch.object(m.os, 'geteuid', return_value=0): m.register_cleanup(folder, state)
            with patch.object(m, 'require_active_docker'), patch.object(m, 'docker', side_effect=registered), patch.object(m, 'compose', side_effect=AssertionError('no service operations')), patch.object(m, 'check_updates', side_effect=AssertionError('no network')), patch('builtins.input', side_effect=AssertionError('no prompt')), patch.object(m, 'cleanup_installation') as cleanup, patch('builtins.print'):
                self.assertEqual(m.main(['cleanup', '--state-dir', d, '--installation-id', state['installationId']]), 0)
                cleanup.assert_called_once()
                cleanup.reset_mock()
                with m.installation_lock(folder): self.assertEqual(m.main(['cleanup', '--state-dir', d, '--installation-id', state['installationId']]), 1)
                cleanup.assert_not_called()
                self.assertEqual(m.main(['cleanup', '--state-dir', d, '--installation-id', 'wrong']), 1)
                cleanup.assert_not_called()
                with patch.object(m, 'docker', return_value='different-daemon'):
                    self.assertEqual(m.main(['cleanup', '--state-dir', d, '--installation-id', state['installationId']]), 1)
                cleanup.assert_not_called()

    def test_scheduler_failure_warns_after_successful_health_and_keeps_ready_state(self):
        from unittest.mock import patch
        import io
        import contextlib
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); state['completed'] = True
            output = io.StringIO()
            with patch.object(m, 'register_cleanup', side_effect=ValueError('scheduler unavailable')), patch.object(m, 'cleanup_installation') as cleanup, contextlib.redirect_stdout(output):
                m.finish_retention(folder, state, 'en')
            self.assertTrue(state['completed'])
            self.assertEqual(m.image_receipt(folder)['successfulReleases'][0]['commit'], state['release']['commit'])
            self.assertIn(m.UPDATE_TEXT['en']['cleanup'], output.getvalue())
            cleanup.assert_called_once()

    def test_systemctl_timeout_is_a_cleanup_warning(self):
        from unittest.mock import patch
        import subprocess
        with patch.object(m.subprocess, 'run', side_effect=subprocess.TimeoutExpired('systemctl', 30)):
            with self.assertRaisesRegex(ValueError, 'scheduler'): m.systemctl(['daemon-reload'])

    def test_unregister_is_idempotent_and_foreign_units_survive(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release())
            units = folder / 'units'; units.mkdir()
            with patch.object(m, 'SYSTEMD_UNITS', units), patch.object(m, 'systemctl'):
                m.unregister_cleanup(folder, state)
                name, contents = m.retention_units(folder, state)
                foreign = units / (name + '.timer'); foreign.write_text('someone else')
                with self.assertRaisesRegex(ValueError, 'ownership'): m.unregister_cleanup(folder, state)
                self.assertEqual(foreign.read_text(), 'someone else')

    def test_moved_installation_retargets_owned_units_and_isolated_helper_runs_cleanup(self):
        from unittest.mock import patch
        import shutil
        import subprocess
        import sys
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d) / 'original'; state = m.init_state(folder, config(), release()); state['completed'] = True; m.write_private(folder / m.STATE, state)
            units = Path(d) / 'units'; units.mkdir()
            def engine(args, **kwargs):
                if args == ['context', 'show']: return 'default'
                if args[:2] == ['context', 'inspect']: return 'unix:///var/run/docker.sock'
                if args[0] == 'info': return 'daemon-one'
                raise AssertionError(args)
            with patch.object(m, 'SYSTEMD_UNITS', units), patch.object(m, 'docker', side_effect=engine), patch.object(m, 'systemctl'), patch.object(m.os, 'geteuid', return_value=0):
                m.register_cleanup(folder, state)
                moved = Path(d) / 'new installation'; folder.rename(moved)
                m.register_cleanup(moved, state)
                service = next(units.glob('*.service')).read_text()
                self.assertIn(str(moved), service); self.assertNotIn(str(folder), service)
            binary = Path(d) / 'bin'; binary.mkdir(); log = Path(d) / 'docker.log'
            fake = binary / 'docker'
            fake.write_text('#!' + sys.executable + "\nimport sys\nfrom pathlib import Path\nargs=sys.argv[1:]\nPath(" + repr(str(log)) + ").open('a').write(repr(args)+'\\n')\nif args[:1]==['--context']: args=args[2:]\nif args[:2]==['context','show']: print('default')\nelif args[:2]==['context','inspect']: print('unix:///var/run/docker.sock')\nelif args[:1]==['info']: print('daemon-one')\nelif args[:1]==['ps']: print('')\nelse: raise SystemExit(99)\n")
            fake.chmod(0o700)
            fake_systemctl = binary / 'systemctl'; fake_systemctl.write_text('#!' + sys.executable + '\nraise SystemExit(0)\n'); fake_systemctl.chmod(0o700)
            # No image receipt entries: identity checks alone must work from the
            # persisted file after the original package path has disappeared.
            m.write_private(moved / m.IMAGE_RECEIPT, {'schemaVersion': 1, 'images': []})
            env = dict(os.environ); env['PATH'] = str(binary) + os.pathsep + env['PATH']
            result = subprocess.run([sys.executable, str(moved / m.RETENTION_DIR / 'linux-compose-setup.py'), 'cleanup', '--state-dir', str(moved), '--installation-id', state['installationId'], '--lang', 'en'], capture_output=True, text=True, env=env)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertNotIn('compose', log.read_text()); self.assertNotIn('load', log.read_text())

    def test_scheduler_partial_registration_can_retry_after_interpreter_path_changes(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); units = folder / 'units'; units.mkdir()
            def engine(args, **kwargs):
                if args == ['context', 'show']: return 'default'
                if args[:2] == ['context', 'inspect']: return 'unix:///var/run/docker.sock'
                if args[0] == 'info': return 'daemon-one'
                raise AssertionError(args)
            with patch.object(m, 'SYSTEMD_UNITS', units), patch.object(m, 'docker', side_effect=engine), patch.object(m, 'systemctl'), patch.object(m.os, 'geteuid', return_value=0):
                m.register_cleanup(folder, state)
                original = m.write_private
                def fail_timer(path, data):
                    if str(path).endswith('.service'): raise OSError('disk failure')
                    return original(path, data)
                with patch.object(m.sys, 'executable', '/usr/bin/new-python3'), patch.object(m, 'write_private', side_effect=fail_timer):
                    with self.assertRaises(OSError): m.register_cleanup(folder, state)
                # A new invocation may still use the previous interpreter. Both
                # the last receipt and partially written owned units are valid.
                m.register_cleanup(folder, state)
                self.assertNotIn('/usr/bin/new-python3', next(units.glob('*.service')).read_text())
                with patch.object(m.sys, 'executable', '/usr/bin/new-python3'), patch.object(m, 'write_private', side_effect=fail_timer):
                    with self.assertRaises(OSError): m.register_cleanup(folder, state)
                m.unregister_cleanup(folder, state)
                self.assertEqual(list(units.iterdir()), [])

    def test_corrupt_cleanup_receipt_cannot_invalidate_a_healthy_server(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); state['completed'] = True
            for receipt in [[], {'schemaVersion': 1, 'images': [{'tag': 123, 'id': 'invalid'}]}]:
                m.write_private(folder / m.IMAGE_RECEIPT, receipt)
                with patch('builtins.print') as warning:
                    m.finish_retention(folder, state, 'en')
                warning.assert_called()
                self.assertTrue(state['completed'])

    def test_inactive_docker_service_defers_scheduled_cleanup_without_any_docker_calls(self):
        from unittest.mock import patch
        import subprocess
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); state['completed'] = True
            helper = folder / m.RETENTION_DIR / 'linux-compose-setup.py'; helper.parent.mkdir(); helper.write_bytes(HELPER.read_bytes())
            record = {'helperSha256': m.digest(helper), 'docker': {'endpoint': 'unix:///var/run/docker.sock'}}
            with patch.object(m, 'retention_config', return_value=record), patch.object(m.subprocess, 'run', return_value=subprocess.CompletedProcess([], 3)) as probe, patch.object(m, 'docker') as docker, patch.object(m, 'compose') as compose:
                with self.assertRaisesRegex(ValueError, 'inactive'): m.scheduled_cleanup(folder, state, 'en')
            docker.assert_not_called(); compose.assert_not_called()
            self.assertEqual(probe.call_args.args[0], ['systemctl', 'is-active', '--quiet', 'docker.service'])

    @unittest.skipUnless(os.name == 'posix', 'rootless Docker uses the Linux user service manager')
    def test_rootless_docker_checks_owner_user_service_without_connecting_socket(self):
        from unittest.mock import patch
        import subprocess
        import types
        with patch('pwd.getpwuid', return_value=types.SimpleNamespace(pw_name='docker-owner')), patch.object(m.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)) as probe:
            m.require_active_docker('unix:///run/user/1234/docker.sock')
        self.assertEqual(probe.call_args.args[0], ['runuser', '-u', 'docker-owner', '--', 'env', 'XDG_RUNTIME_DIR=/run/user/1234', 'DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1234/bus', 'systemctl', '--user', 'is-active', '--quiet', 'docker.service'])
        with patch.object(m.subprocess, 'run') as probe:
            with self.assertRaisesRegex(ValueError, 'Cannot prove'): m.require_active_docker('unix:///custom/docker.sock')
        probe.assert_not_called()

    def test_validated_modes_and_untrusted_proxy_inputs(self):
        for mode in ['https', 'http', 'proxy']:
            self.assertEqual(m.validate_config(config(mode))['network']['mode'], mode)
        bad = [({'publicOrigin': 'https://cast.example/path'}, 'origin'),
               ({'mediaIp': 'host.example'}, 'IPv4'), ({'mediaIp':'0.0.0.0'},'IPv4'), ({'mediaIp':'255.255.255.255'},'IPv4'), ({'iceTcpPort': 0}, 'port'),
               ({'relayPortEnd': 29999}, 'relay'), ({'relayPortEnd': 31024}, 'relay')]
        for change, message in bad:
            c = config(); c['network'].update(change)
            with self.assertRaisesRegex(ValueError, message): m.validate_config(c)
        for change in [{'trustedProxies': []}, {'trustedProxies': ['0.0.0.0/0']},
                       {'publicOrigin': 'http://cast.example'},
                       {'trustedProxies': ['evil\nrespond 200']}]:
            c = config('proxy'); c['network'].update(change)
            with self.assertRaises(ValueError): m.validate_config(c)

    def test_advanced_interactive_prompts_all_network_fields_and_retries_bad_port(self):
        from unittest.mock import patch
        # A port parse/range error must reprompt that field; all chosen values survive.
        answers = ['http','http://cast.example:8081','203.0.113.8',
                   '192.0.2.10','bad','0','8081','8443','9001','9002','9003','31000','32023']
        for lang in ['ru', 'en', 'zh-CN']:
            with patch('builtins.input', side_effect=answers), patch('builtins.print'): result = m.interactive(lang, 'advanced')
            self.assertEqual(result['network'], {'mode':'http','publicOrigin':'http://cast.example:8081',
                'bindAddress':'192.0.2.10','httpPort':8081,'httpsPort':8443,'mediaIp':'203.0.113.8',
                'iceTcpPort':9001,'iceUdpPort':9002,'turnUdpPort':9003,'relayPortStart':31000,
                'relayPortEnd':32023,'trustedProxies':[]})

    def test_advanced_http_default_origin_and_proxy_remote_bind(self):
        from unittest.mock import patch
        with patch('builtins.input', side_effect=['http','',''] + ['']*8):
            self.assertEqual(m.interactive('en', 'advanced')['network']['publicOrigin'], 'http://127.0.0.1')
        c = config('proxy'); c['network']['bindAddress'] = '192.0.2.10'
        self.assertEqual(m.validate_config(c)['network']['bindAddress'], '192.0.2.10')
        c['network']['relayPortEnd'] = 31023
        self.assertEqual(m.validate_config(c)['network']['relayPortEnd'], 31023)

    def test_quick_ip_setup_only_asks_for_server_address(self):
        from unittest.mock import patch
        for lang in ['ru', 'en', 'zh-CN']:
            for address, public in [('8.8.8.8', True), ('192.168.1.22', False)]:
                with patch('builtins.input', side_effect=[address]) as prompt:
                    result = m.interactive(lang)
                self.assertEqual(prompt.call_count, 1)
                self.assertEqual(result['setupMode'], 'quick')
                self.assertEqual(result['publicHttps'], public)
                self.assertEqual(result['network']['publicOrigin'], 'https://' + address)
                self.assertEqual(result['network']['mediaIp'], address)
                self.assertEqual(result['network']['iceTcpPort'], 7881)

    def test_quick_domain_resolves_media_without_asking_about_tls(self):
        from unittest.mock import patch
        dns = [(m.socket.AF_INET, m.socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443))]
        with patch.object(m.socket, 'getaddrinfo', return_value=dns), patch('builtins.input', side_effect=['cast.example']) as prompt:
            result = m.interactive('en')
        self.assertEqual(prompt.call_count, 1)
        self.assertTrue(result['publicHttps'])
        self.assertEqual(result['network']['mediaIp'], '8.8.8.8')

    def test_quick_domain_needs_server_ip_for_missing_or_ambiguous_dns(self):
        from unittest.mock import patch
        dns = [(m.socket.AF_INET, m.socket.SOCK_STREAM, 6, '', (ip, 443)) for ip in ['8.8.8.8', '1.1.1.1']]
        for response in [dns, m.socket.gaierror('missing DNS')]:
            with patch.object(m.socket, 'getaddrinfo', **({'side_effect': response} if isinstance(response, Exception) else {'return_value': response})), patch('builtins.input', side_effect=['cast.example', '8.8.8.8']) as prompt:
                result = m.interactive('en')
            self.assertEqual(prompt.call_count, 2)
            self.assertEqual(result['network']['mediaIp'], '8.8.8.8')

    def test_origin_effective_default_port_must_match_published_port(self):
        for mode, field, port in [('https','httpsPort',8443), ('http','httpPort',8081)]:
            c = config(mode); c['network'][field] = port
            with self.assertRaisesRegex(ValueError, 'Origin port'): m.validate_config(c)
            c['network']['publicOrigin'] += ':' + str(port)
            self.assertEqual(m.validate_config(c)['network'][field], port)

    def test_ip_tls_has_default_sni_including_public_and_local_modes(self):
        for public in [False, True]:
            c = config(); c['publicHttps'] = public; c['network']['publicOrigin'] = 'https://203.0.113.8'
            self.assertIn('default_sni 203.0.113.8', m.caddy_config(c))

    def test_load_images_uses_verified_archive_tags_across_docker_stores(self):
        from unittest.mock import patch
        r = release(); calls = []
        def engine(args, **kwargs):
            calls.append(args)
            if args[0] == 'load': return ''
            tag = args[-1]
            return json.dumps({'RepoTags':[tag], 'Os':'linux', 'Architecture':'amd64', 'Id':'sha256:'+'c'*64})
        with patch.object(m, 'docker', side_effect=engine): m.load_images(Path('/package'), r)
        self.assertEqual(calls[0], ['load','--input',str(Path('/package') / 'payload' / 'images.tar.gz')])
        with patch.object(m, 'docker', side_effect=['', json.dumps({'RepoTags':['wrong'], 'Os':'linux','Architecture':'amd64'})]):
            with self.assertRaisesRegex(ValueError, 'release tag'): m.load_images(Path('/package'), r)

    def test_render_ports_secrets_and_auth_in_all_modes(self):
        with tempfile.TemporaryDirectory() as d:
            for mode in ['http', 'https', 'proxy']:
                state = m.init_state(Path(d) / mode, config(mode), release())
                m.render(Path(d) / mode, state, release())
                compose = json.loads((Path(d) / mode / 'compose.json').read_text())
                for service in ['web', 'postgres']:
                    self.assertNotIn('ports', compose['services'][service])
                caddy = (Path(d) / mode / 'Caddyfile').read_text()
                self.assertIn('forward_auth web:3000', caddy)
                self.assertIn('uri /api/media-admission', caddy)
                self.assertIn('reverse_proxy livekit:7880', caddy)
                self.assertEqual(compose['services']['web']['image'], release()['images']['web'])
                self.assertIn('0.0.0.0:7882:7882/udp', compose['services']['livekit']['ports'])
                if mode == 'proxy':
                    self.assertEqual(compose['services']['caddy']['ports'], ['127.0.0.1:8080:8080/tcp'])
                    self.assertIn('trusted_proxies static 172.18.0.1/32', caddy)
                    self.assertIn('trusted_proxies_strict', caddy)
                    self.assertEqual(caddy.count('header_up X-Forwarded-For {client_ip}'), 3)
                    self.assertIn('header_up X-Forwarded-Proto {http.vars.proxy_proto}', caddy)
                    self.assertIn('request_header @untrusted -X-Forwarded-Proto', caddy)
                    self.assertIn('vars proxy_proto {scheme}', caddy)
                    self.assertIn('vars @forwardedProto proxy_proto https', caddy)
                    self.assertIn('header_up Host cast.example', caddy)
                if mode == 'http':
                    self.assertIn('http://cast.example:80', caddy)
                    self.assertNotIn('tls internal', caddy)
                for filename in ['.castlink-install.json', 'secrets.json', 'web.env', 'postgres.env', 'livekit.json']:
                    if os.name == 'posix':
                        self.assertEqual((Path(d) / mode / filename).stat().st_mode & 0o777, 0o600)
                self.assertNotIn(state['installationId'], m.public_status(state))

    def test_reinit_preserves_identity_secrets_network_and_rejects_windows(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            first = m.init_state(folder, config(), release())
            secrets = (folder / 'secrets.json').read_bytes()
            second = m.init_state(folder, config('http'), release('c' * 40))
            self.assertEqual(first, second)
            self.assertEqual(secrets, (folder / 'secrets.json').read_bytes())
            (folder / '.castlink-install.json').write_text('{"schemaVersion":1,"target":"vps"}')
            with self.assertRaisesRegex(ValueError, 'Linux'): m.load_state(folder)

    def test_package_integrity_pinned_tags_and_no_traversal(self):
        import hashlib
        with tempfile.TemporaryDirectory() as d:
            p = Path(d); (p / 'payload').mkdir(); (p / 'payload/images.tar.gz').write_bytes(b'image')
            r = release(); r.update(imageArchive='images.tar.gz', imageArchiveSha256=hashlib.sha256(b'image').hexdigest(), bundleFiles={})
            (p / 'payload/release.json').write_text(json.dumps(r))
            self.assertEqual(m.verify_package(p)['commit'], r['commit'])
            for change in [{'images': {**r['images'], 'web': 'latest'}}, {'bundleFiles': {'../escape': 'a' * 64}}, {'imageArchive': '../images.tar.gz'}]:
                (p / 'payload/release.json').write_text(json.dumps({**r, **change}))
                with self.assertRaises(ValueError): m.verify_package(p)
            (p / 'payload/release.json').write_text(json.dumps(r)); (p / 'payload/images.tar.gz').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'integrity'): m.verify_package(p)

    def test_update_has_no_backup_and_preserves_identity_network_and_secrets(self):
        from unittest.mock import patch
        import contextlib
        import io
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config('proxy'), release())
            state['completed'] = True; state['databasePhase'] = 'seed'
            m.write_private(folder / m.STATE, state)
            secrets = (folder / 'secrets.json').read_bytes(); events = []
            def record_load(*args): events.append('load')
            def record_compose(*args, **kwargs): events.append(args[2][0]); return ''
            def record_complete(*args): events.append('complete')
            out = io.StringIO()
            with patch.object(m, 'verify_package', return_value=release('c'*40)), patch.object(m, 'remember_images'), patch.object(m, 'cleanup_installation', side_effect=lambda *args: events.append('cleanup')), patch.object(m, 'load_images', side_effect=record_load), patch.object(m, 'compose', side_effect=record_compose), patch.object(m, 'complete', side_effect=record_complete), contextlib.redirect_stdout(out):
                self.assertEqual(m.main(['update', '--state-dir', d, '--package', d, '--lang', 'en']), 0)
            updated = m.load_state(folder)
            self.assertEqual(events, ['load', 'up', 'complete', 'cleanup'])
            self.assertFalse((folder / 'backups').exists())
            for key in ['installationId','nodeId','project','network']:
                self.assertEqual(updated[key], state[key])
            self.assertEqual(updated['release']['commit'], 'c'*40)
            self.assertEqual((folder/'secrets.json').read_bytes(), secrets)
            for value in json.loads(secrets).values(): self.assertNotIn(value, out.getvalue())

    def test_failed_update_retains_previous_images_and_does_not_run_cleanup(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); state['completed'] = True
            with patch.object(m, 'remember_images'), patch.object(m, 'load_images'), patch.object(m, 'render'), patch.object(m, 'compose', side_effect=ValueError('unhealthy')), patch.object(m, 'cleanup_installation') as cleanup:
                with self.assertRaisesRegex(ValueError, 'unhealthy'): m.apply_update(folder, state, folder, release('c'*40), 'en')
            cleanup.assert_not_called()

    def test_bootstrap_json_stdin_is_canonical_and_ack_failure_keeps_phase(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); bodies = []
            def refused(folder, state, args, **kwargs):
                bodies.append(kwargs.get('stdin')); return '{}'
            with patch.object(m, 'compose', side_effect=refused):
                with self.assertRaisesRegex(ValueError, 'acknowledgement'): m.complete(folder, state)
            self.assertEqual(state['databasePhase'], 'new')
            self.assertEqual(bodies[0], json.dumps(json.loads(bodies[0]), separators=(',', ':')))

    def test_readiness_failure_prevents_completed_and_copies_local_ca(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); state['databasePhase']='seed'
            calls=[]
            def operation(folder, state, args, **kwargs):
                calls.append((args,kwargs))
                if args[-1] == '/data/caddy/pki/authorities/local/root.crt': return '-----BEGIN CERTIFICATE-----PUBLIC CA CERTIFICATE'
                return ''
            with patch.object(m, 'compose', side_effect=operation), patch.object(m, 'probe_origin', side_effect=ValueError('not ready')):
                with self.assertRaisesRegex(ValueError, 'not ready'): m.complete(folder, state)
            self.assertFalse(state['completed'])
            self.assertTrue(any(kwargs.get('stdin') == '-----BEGIN CERTIFICATE-----PUBLIC CA CERTIFICATE' for args,kwargs in calls))

    def test_bootstrap_ack_requires_identity_and_phase(self):
        state = {'installationId': 'iid', 'nodeId': 'node'}
        self.assertFalse(m.bootstrap_ack('{}', state, 'seed'))
        ack = {'schemaVersion': 1, 'contract': 'castlink-database-v1', 'installationId': 'iid', 'nodeId': 'node', 'phase': 'seed', 'migrations': {'roomVersions': [1,2,3,4,5,6], 'controlVersions': [1,2,3,4,5], 'schema': True, 'hashes': True}, 'seed': {'installations':1,'accounts':1,'organizations':1,'memberships':1,'nodes':1,'studios':1,'rooms':0}}
        self.assertTrue(m.bootstrap_ack(json.dumps(ack), state, 'seed'))
        ack['migrations']['schema'] = False
        self.assertFalse(m.bootstrap_ack(json.dumps(ack), state, 'seed'))
        self.assertFalse(m.bootstrap_ack('{"ok":true,"installationId":"other","nodeId":"node","phase":"seed"}', state, 'seed'))


if __name__ == '__main__': unittest.main()
