import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('runtime', ROOT / 'scripts/server-wsl-runtime.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
RELEASE = {'schemaVersion': 1, 'version': '1.2.3', 'commit': 'a' * 40, 'buildId': '1.2.3-' + 'a' * 12}
HASH = hashlib.sha256(b'creation-password').hexdigest()

class RuntimeTest(unittest.TestCase):
    def fresh(self, folder, address='192.168.1.23', media='192.168.1.23', **kw):
        return runtime.init_state(folder, address, media, RELEASE, HASH, **kw)

    def test_state_rerun_preserves_every_byte_and_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'state'
            state = self.fresh(folder)
            before = {f.name: f.read_bytes() for f in folder.iterdir() if f.is_file()}
            again = runtime.init_state(folder, None, None, RELEASE, None)
            self.assertEqual(state, again)
            self.assertEqual(before, {f.name: f.read_bytes() for f in folder.iterdir() if f.is_file()})
            self.assertEqual((folder / 'secrets.json').stat().st_mode & 0o777, 0o600)
            self.assertNotIn(b'creation-password', (folder / 'state.json').read_bytes())

    def test_foreign_or_partial_directory_never_adopted(self):
        for name, value in [('other', 'operator data'), ('secrets.json', '{}'), ('state.json', '{}')]:
            with tempfile.TemporaryDirectory() as temp:
                folder = Path(temp)
                (folder / name).write_text(value)
                with self.assertRaises(ValueError): self.fresh(folder)
                self.assertEqual((folder / name).read_text(), value)

    def test_network_and_admission_are_not_weakened(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'state'
            state = self.fresh(folder, 'studio.example.org', '203.0.113.2', turn_host='relay.example.org')
            config = runtime.configs(state, json.loads((folder / 'secrets.json').read_text()))
            env, livekit, caddy = config['web.env'], json.loads(config['livekit.json']), config['Caddyfile']
            self.assertIn('HOSTNAME=127.0.0.1', env)
            self.assertIn('@127.0.0.1:5432/castlink', env)
            self.assertIn('CASTLINK_ENFORCE_NODE_ADMISSION=1', env)
            self.assertIn('ROOM_CREATION_PASSWORD_SHA256=' + HASH, env)
            self.assertIn('forward_auth 127.0.0.1:3000', caddy)
            self.assertIn('uri /api/media-admission', caddy)
            self.assertIn('header_up -Upgrade', caddy)
            self.assertIn('allow 127.0.0.1/32', caddy)
            self.assertEqual(livekit['turn']['allow_restricted_peer_cidrs'], ['203.0.113.2/32'])
            self.assertEqual(livekit['turn']['proxy_protocol_trusted_cidrs'], ['127.0.0.1/32'])
            self.assertTrue(livekit['turn']['external_tls'])
            self.assertEqual(livekit['rtc']['node_ip'], '203.0.113.2')
            self.assertEqual(livekit['turn']['domain'], 'relay.example.org')
            self.assertIn('disable_tlsalpn_challenge', caddy)

    def test_local_tls_and_address_input(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'state'
            state = self.fresh(folder)
            self.assertFalse(state['publicHttps'])
            config = runtime.configs(state, json.loads((folder / 'secrets.json').read_text()))
            self.assertIn('tls internal', config['Caddyfile'])
            self.assertEqual(state['origin'], 'https://192.168.1.23')
            for bad in ['http://evil', 'host\nfoo', '0.0.0.0', 'evil:443', '127.0.0.1/path', '-bad.example']:
                with self.assertRaises(ValueError): runtime.address(bad)
            with self.assertRaises(ValueError): runtime.media_address('example.org')
            with self.assertRaises(ValueError): runtime.media_address('0.0.0.0')

    def test_changed_network_and_missing_secrets_refused_without_write(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'state'; self.fresh(folder)
            before = (folder / 'state.json').read_bytes()
            with self.assertRaises(ValueError): self.fresh(folder, '192.168.1.99')
            self.assertEqual((folder / 'state.json').read_bytes(), before)
            (folder / 'secrets.json').unlink()
            with self.assertRaises(ValueError): runtime.init_state(folder, None, None, RELEASE, None)

    def test_password_exact_unicode_and_hidden_confirmation(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / 'password'; file.write_text('valid-🔑-password')
            self.assertEqual(runtime.password_hash(file, 'en'), hashlib.sha256('valid-🔑-password'.encode()).hexdigest())
            file.write_text('password\n')
            with self.assertRaises(ValueError): runtime.password_hash(file, 'en')
        with patch.object(runtime.getpass, 'getpass', side_effect=['12345678', '87654321']):
            with self.assertRaises(ValueError): runtime.password_hash(None, 'en')

    def test_stop_waits_for_every_owned_service_job(self):
        from unittest.mock import patch
        with patch.object(runtime, 'run') as invoke:
            runtime.stop_services()
        self.assertEqual(invoke.call_args_list[0].args[0], ['/usr/bin/systemctl', 'disable', 'castlink-server.target'])
        command = invoke.call_args.args[0]
        self.assertEqual(command[:3], ['/usr/bin/systemctl', 'stop', 'castlink-server.target'])
        self.assertEqual(set(command[3:]), set(runtime.SERVICES))
        self.assertNotIn('--no-block', command)

    def test_start_enables_boot_target_only_after_explicit_start(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'state'; state = self.fresh(folder)
            with patch.object(runtime, 'STATE', folder), patch.object(runtime, 'run') as invoke, patch.object(runtime, 'setup_web'), patch.object(runtime, 'health'):
                runtime.start(state)
            self.assertEqual(invoke.call_args_list[0].args[0], ['/usr/bin/systemctl', 'enable', 'castlink-server.target'])
            self.assertEqual(invoke.call_args_list[1].args[0], ['/usr/bin/systemctl', 'start', 'castlink-server.target'])

    def test_status_distinguishes_intentional_stop_from_degraded_running(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as temp:
            state = self.fresh(Path(temp) / 'state')
            def stopped(command, **kw):
                return SimpleNamespace(stdout='disabled\n' if command[1]=='is-enabled' else 'inactive\n', returncode=1)
            with patch.object(runtime.subprocess, 'run', side_effect=stopped), patch.object(runtime, 'health') as health:
                payload, code = runtime.runtime_status(state)
                self.assertEqual(code, 0)
                self.assertTrue(payload['stopped'])
                self.assertFalse(payload['ready'])
                self.assertEqual(payload['readiness'], 'stopped')
                health.assert_not_called()
            def degraded(command, **kw):
                if command[1]=='is-enabled': return SimpleNamespace(stdout='enabled\n', returncode=0)
                return SimpleNamespace(stdout='failed\n' if command[-1]=='castlink-livekit' else 'active\n', returncode=0)
            with patch.object(runtime.subprocess, 'run', side_effect=degraded):
                payload, code = runtime.runtime_status(state)
                self.assertEqual(code, 3)
                self.assertFalse(payload['stopped'])
                self.assertFalse(payload['ready'])

    def test_bootstrap_canonical_request_and_refused_ack_does_not_advance(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'state'; state = self.fresh(folder)
            state['postgresRoleCreated'] = True
            runtime.write_private(folder / 'state.json', state)
            calls = []
            def invoke(script, data=None):
                calls.append((script, data))
                return '{}'
            with patch.object(runtime, 'STATE', folder), patch.object(runtime, 'node', side_effect=invoke):
                with self.assertRaises(ValueError): runtime.database_bootstrap()
            self.assertEqual(json.loads((folder / 'state.json').read_text())['databasePhase'], 'new')
            request = calls[0][1]
            self.assertEqual(request, json.dumps(json.loads(request), separators=(',', ':')))
            self.assertEqual(json.loads(request)['installationId'], state['installationId'])
            self.assertNotIn('password', request)

    def test_owner_access_guard_private_file_and_no_token_output(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'state'; state = self.fresh(folder)
            with patch.object(runtime, 'STATE', folder):
                with self.assertRaises(ValueError): runtime.owner_access(state)
            state.update(completed=True, databasePhase='seed')
            calls = []
            def invoke(command, **options):
                calls.append((command, options))
                runtime.write_private(Path(command[-1]), 'https://private.example/#access=SECRET')
                return 'Owner invitation saved; no token output'
            with patch.object(runtime, 'STATE', folder), patch.object(runtime, 'run', side_effect=invoke), patch.object(runtime, 'web_env', return_value={'DATABASE_URL': 'private'}):
                reply = runtime.owner_access(state)
            self.assertEqual(reply['expiresInSeconds'], 900)
            self.assertEqual(Path(reply['ownerAccessFile']).stat().st_mode & 0o777, 0o600)
            self.assertNotIn('SECRET', json.dumps(reply))
            command, options = calls[0]
            self.assertNotIn('--revoke-all', command)
            self.assertIn('--origin', command)
            self.assertNotIn('private', command)
            self.assertEqual(options['env']['DATABASE_URL'], 'private')

    def test_port_preflight_refuses_conflicts_before_firewall_mutation(self):
        from unittest.mock import patch
        with patch.object(runtime, 'run', return_value='{"nftables":[]}'), patch.object(runtime.socket, 'socket') as create:
            sock = create.return_value
            sock.bind.side_effect = OSError('Address already in use')
            with self.assertRaisesRegex(ValueError, 'already in use'):
                runtime.preflight_ports()
            sock.close.assert_called_once()
        unit = (ROOT / 'infrastructure/server-wsl/castlink-private-ports.service').read_text()
        self.assertLess(unit.index('ExecStartPre='), unit.index('ExecStart='))
        self.assertIn('ExecStop=/usr/sbin/nft delete table inet castlink_private', unit)

    def test_mirrored_loopback_exception_keeps_interface_address_and_port_guards(self):
        import re
        rules = (ROOT / 'infrastructure/server-wsl/castlink-private-ports.nft').read_text()
        accepts = [line.strip() for line in rules.splitlines() if line.strip().endswith('accept')]
        self.assertEqual(len(accepts), 1)
        self.assertRegex(accepts[0], r'^iifname "loopback0" ip saddr 127\.0\.0\.1 ip daddr 127\.0\.0\.1 tcp dport \{ [0-9, ]+ \} accept$')
        drop = next(line.strip() for line in rules.splitlines() if line.strip().endswith('drop'))
        self.assertTrue(drop.startswith('iifname != "lo" tcp dport '))
        portset = lambda line: {int(port) for port in re.search(r'\{([^}]+)\}', line).group(1).split(',')}
        self.assertEqual(portset(accepts[0]), {3000, 5432, 5348, 5349, 7880, 8443})
        self.assertEqual(portset(accepts[0]), portset(drop))
        self.assertLess(rules.index(accepts[0]), rules.index(drop))

    def test_foreign_firewall_table_is_refused_without_network_or_firewall_changes(self):
        from unittest.mock import patch
        foreign = json.dumps({'nftables': [{'table': {'family': 'inet', 'name': 'castlink_private'}}]})
        with patch.object(runtime, 'run', return_value=foreign) as invoke, patch.object(runtime.socket, 'socket') as create:
            with self.assertRaisesRegex(ValueError, 'already exists'):
                runtime.preflight_ports()
            create.assert_not_called()
            invoke.assert_called_once_with(['/usr/sbin/nft', '-j', 'list', 'tables'])
        rules = (ROOT / 'infrastructure/server-wsl/castlink-private-ports.nft').read_text()
        self.assertIn('create table inet castlink_private', rules)
        self.assertNotIn('flush table', rules)
        self.assertNotIn('add table', rules)

    @unittest.skipUnless(shutil.which('openssl'), 'OpenSSL required for certificate proof')
    def test_turn_certificate_validates_chain_host_and_matching_key(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp); folder = base / 'state'; state = self.fresh(folder)
            authority = folder / 'caddy/caddy/pki/authorities/local'; authority.mkdir(parents=True)
            certdir = folder / 'caddy/caddy/certificates/local' / state['turnHost']; certdir.mkdir(parents=True)
            key = certdir / (state['turnHost'] + '.key'); cert = certdir / (state['turnHost'] + '.crt')
            def openssl(*arguments):
                subprocess.run(['openssl', *map(str, arguments)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            openssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', authority / 'root.key')
            openssl('req', '-new', '-x509', '-key', authority / 'root.key', '-subj', '/CN=CastLink test CA', '-days', '1', '-out', authority / 'root.crt')
            openssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', key)
            openssl('req', '-new', '-key', key, '-subj', '/CN=' + state['turnHost'], '-out', base / 'request.csr')
            extension = base / 'san.conf'; extension.write_text('subjectAltName=IP:' + state['turnHost'] + '\n')
            openssl('x509', '-req', '-in', base / 'request.csr', '-CA', authority / 'root.crt', '-CAkey', authority / 'root.key', '-CAcreateserial', '-days', '1', '-extfile', extension, '-out', cert)
            runtime_dir = base / 'run'; runtime_dir.mkdir()
            with patch.object(runtime, 'STATE', folder):
                selected = runtime.certificate(state, runtime_dir)
                self.assertIsNotNone(selected)
                self.assertEqual(selected.stat().st_mode & 0o777, 0o600)
                key.write_text((authority / 'root.key').read_text())
                self.assertIsNone(runtime.certificate(state, runtime_dir))

    @unittest.skipUnless(shutil.which('node'), 'Node required for stdin protocol proof')
    def test_health_reads_bounded_stream_without_promises_numeric_fd_api(self):
        program = r"""
import {Readable} from 'node:stream';
const {readRequest}=await import(process.argv[1]);
const request={host:'127.0.0.1',buildId:'test'};
const actual=await readRequest(Readable.from([Buffer.from(JSON.stringify(request))]));
if(JSON.stringify(actual)!==JSON.stringify(request))throw Error('Wrong stdin request');
let refused=false;try{await readRequest(Readable.from([Buffer.alloc(65537,32)]));}catch{refused=true;}
if(!refused)throw Error('Unbounded input accepted');
"""
        result = subprocess.run(['node', '--input-type=module', '-e', program, (ROOT / 'infrastructure/server-wsl/health.mjs').as_uri()], text=True, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)

    @unittest.skipUnless(shutil.which('openssl') and shutil.which('node'), 'Node and OpenSSL required for real TLS proof')
    def test_ip_https_probe_negotiates_http_alpn_instead_of_turn_fallback(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp); key = base / 'server.key'; cert = base / 'server.crt'
            subprocess.run(['openssl', 'req', '-new', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', str(key), '-out', str(cert), '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-days', '1'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            program = r"""
import https from 'node:https';import fs from 'node:fs';
const {probeOrigin}=await import(process.argv[1]);
let negotiated;
const certificate=fs.readFileSync(process.argv[3]);
const server=https.createServer({key:fs.readFileSync(process.argv[2]),cert:certificate,ALPNProtocols:['http/1.1']},(req,res)=>{
 negotiated=req.socket.alpnProtocol;
 res.writeHead(negotiated==='http/1.1'?200:502,{'content-type':'application/json'});
 res.end(JSON.stringify({buildId:'test-build'}));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{await probeOrigin({host:'127.0.0.1',publicHttps:false,caPem:certificate,buildId:'test-build'},server.address().port);if(negotiated!=='http/1.1')throw Error('Wrong ALPN');}
finally{server.closeAllConnections();server.close();}
"""
            result = subprocess.run(['node', '--input-type=module', '-e', program, (ROOT / 'infrastructure/server-wsl/health.mjs').as_uri(), str(key), str(cert)], text=True, capture_output=True, timeout=15)
            if result.returncode and "listen EPERM" in result.stderr: self.skipTest("Sandbox denies loopback; this TLS proof requires elevated execution")
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_haproxy_split_retains_no_sni_turn_fallback_and_proxy_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'state'; state = self.fresh(folder)
            config = runtime.haproxy_config(state, Path('/run/castlink-turn-tls/cert.pem'))
            self.assertIn('!{ req.ssl_sni -m found } !{ req.ssl_alpn -m found }', config)
            self.assertIn('server livekit 127.0.0.1:5349 send-proxy-v2', config)
            self.assertIn('server caddy 127.0.0.1:8443 send-proxy-v2', config)
            self.assertNotIn('req.ssl_sni -i 192.', config)
            self.assertNotIn('frontend turn_tls', runtime.haproxy_config(state, None))

    def test_livekit_can_enumerate_kernel_routes_without_enabling_worker_network(self):
        directory = ROOT / 'infrastructure/server-wsl'
        livekit = (directory / 'castlink-livekit.service').read_text()
        self.assertIn('RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK', livekit)
        converter = (directory / 'castlink-converter.service').read_text()
        self.assertIn('RestrictAddressFamilies=AF_UNIX\n', converter)
        self.assertIn('PrivateNetwork=yes', converter)

    def test_nonroot_services_cannot_read_manually_attached_windows_mounts(self):
        directory = ROOT / 'infrastructure/server-wsl'
        for name in ['web', 'livekit', 'caddy', 'postgres', 'bootstrap', 'turn-tls']:
            with self.subTest(service=name):
                unit = (directory / ('castlink-' + name + '.service')).read_text()
                self.assertIn('InaccessiblePaths=-/media -/run/WSL', unit)
                self.assertIn('TemporaryFileSystem=/mnt:ro', unit)
                self.assertIn('BindReadOnlyPaths=-/mnt/wsl/resolv.conf', unit)
        converter = (directory / 'castlink-converter.service').read_text()
        self.assertIn('InaccessiblePaths=-/mnt -/media -/run/WSL', converter)
        self.assertIn('ReadWritePaths=/run/castlink-converter', converter)
        self.assertIn('PrivateTmp=yes', converter)
        self.assertIn('PrivateNetwork=yes', converter)

    def test_systemd_worker_isolation_and_no_docker_runtime(self):
        directory = ROOT / 'infrastructure/server-wsl'
        unit = (directory / 'castlink-converter.service').read_text()
        for setting in ['User=castlink-converter', 'PrivateNetwork=yes', 'ProtectSystem=strict', 'PrivateTmp=yes', 'MemoryMax=2G', 'TasksMax=128', 'CPUQuota=100%', 'NoNewPrivileges=yes']:
            self.assertIn(setting, unit)
        web = (directory / 'castlink-web.service').read_text()
        self.assertIn('User=castlink', web)
        self.assertIn('Requires=castlink-bootstrap.service', web)
        firewall = (directory / 'castlink-private-ports.nft').read_text()
        self.assertIn('5349', firewall)
        self.assertIn('iifname != "lo"', firewall)
        self.assertNotIn("['docker'", (ROOT / 'scripts/server-wsl-runtime.py').read_text())

if __name__ == '__main__': unittest.main()
