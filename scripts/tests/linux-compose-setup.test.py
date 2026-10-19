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
        answers = ['advanced','http','http://cast.example:8081','203.0.113.8',
                   '192.0.2.10','bad','0','8081','8443','9001','9002','9003','31000','32023']
        for lang in ['ru', 'en', 'zh-CN']:
            with patch('builtins.input', side_effect=answers), patch('builtins.print'): result = m.interactive(lang)
            self.assertEqual(result['network'], {'mode':'http','publicOrigin':'http://cast.example:8081',
                'bindAddress':'192.0.2.10','httpPort':8081,'httpsPort':8443,'mediaIp':'203.0.113.8',
                'iceTcpPort':9001,'iceUdpPort':9002,'turnUdpPort':9003,'relayPortStart':31000,
                'relayPortEnd':32023,'trustedProxies':[]})

    def test_advanced_http_default_origin_and_proxy_remote_bind(self):
        from unittest.mock import patch
        with patch('builtins.input', side_effect=['advanced','http','',''] + ['']*8):
            self.assertEqual(m.interactive('en')['network']['publicOrigin'], 'http://127.0.0.1')
        c = config('proxy'); c['network']['bindAddress'] = '192.0.2.10'
        self.assertEqual(m.validate_config(c)['network']['bindAddress'], '192.0.2.10')
        c['network']['relayPortEnd'] = 31023
        self.assertEqual(m.validate_config(c)['network']['relayPortEnd'], 31023)

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

    def test_update_backs_up_before_loading_and_preserves_identity_network_and_secrets(self):
        from unittest.mock import patch
        import contextlib
        import io
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config('proxy'), release())
            state['completed'] = True; state['databasePhase'] = 'seed'
            m.write_private(folder / m.STATE, state)
            secrets = (folder / 'secrets.json').read_bytes(); events = []
            def record_backup(*args): events.append('backup'); return folder / 'backups/example'
            def record_load(*args): events.append('load')
            def record_compose(*args, **kwargs): events.append(args[2][0]); return ''
            def record_complete(*args): events.append('complete')
            out = io.StringIO()
            with patch.object(m, 'verify_package', return_value=release('c'*40)), patch.object(m, 'backup', side_effect=record_backup), patch.object(m, 'load_images', side_effect=record_load), patch.object(m, 'compose', side_effect=record_compose), patch.object(m, 'complete', side_effect=record_complete), contextlib.redirect_stdout(out):
                self.assertEqual(m.main(['update', '--state-dir', d, '--package', d, '--lang', 'en']), 0)
            updated = m.load_state(folder)
            self.assertEqual(events, ['backup', 'load', 'up', 'complete'])
            for key in ['installationId','nodeId','project','network']:
                self.assertEqual(updated[key], state[key])
            self.assertEqual(updated['release']['commit'], 'c'*40)
            self.assertEqual((folder/'secrets.json').read_bytes(), secrets)
            for value in json.loads(secrets).values(): self.assertNotIn(value, out.getvalue())

    def test_backup_quiesces_web_and_resumes_it_on_database_failure(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d); state = m.init_state(folder, config(), release()); m.render(folder, state, release())
            calls = []
            def operation(folder, state, args, **kwargs):
                calls.append(args)
                if 'pg_dump' in args: raise ValueError('database failure')
                return ''
            with patch.object(m, 'compose', side_effect=operation):
                with self.assertRaisesRegex(ValueError, 'database failure'): m.backup(folder, state)
            self.assertEqual(calls[0], ['pause', 'web'])
            self.assertEqual(calls[-1], ['unpause', 'web'])

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
