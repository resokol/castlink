"""Exercise rendered installation models; no containers or production writes."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

linux = load('converter_linux', 'scripts/linux-compose-setup.py')
vps = load('converter_vps', 'scripts/server-provision-vps.py')
fixtures = load('converter_linux_fixtures', 'scripts/tests/linux-compose-setup.test.py')
SOCKET = 'converter-socket:/run/castlink-converter'

class ConverterCompose(unittest.TestCase):
    def check_isolation(self, model):
        worker = model['services'].get('presentation-converter')
        self.assertIsNotNone(worker, 'Every current installer must provision the isolated converter')
        self.assertEqual(worker['image'], model['services']['web']['image'])
        self.assertEqual(worker['command'], ['python3', '/app/scripts/presentation-converter/server.py'])
        self.assertIs(worker.get('init'), True)
        self.assertEqual(worker['user'], '10001:10001')
        self.assertTrue(worker['read_only'])
        self.assertEqual(worker['network_mode'], 'none')
        self.assertEqual(worker['cap_drop'], ['ALL'])
        self.assertEqual(worker['security_opt'], ['no-new-privileges:true'])
        self.assertEqual(worker['volumes'], [SOCKET])
        self.assertEqual(worker['tmpfs'], ['/tmp:size=512m,mode=1777'])
        self.assertEqual(str(worker['mem_limit']).lower(), '512m')
        self.assertEqual(worker['pids_limit'], 128)
        self.assertEqual(float(worker['cpus']), 1)
        self.assertTrue(model['volumes'].get('converter-socket') is not None)
        for key in ['env_file', 'environment', 'ports', 'networks', 'privileged', 'devices']:
            self.assertNotIn(key, worker, key)
        self.assertIn(SOCKET + ':ro', model['services']['web']['volumes'])
        self.assertNotIn('presentation-converter', model['services']['web'].get('depends_on', {}))

    def test_linux_modes_and_upgrade_reuse_web_image_without_extra_release_image(self):
        with tempfile.TemporaryDirectory() as directory:
            for mode in ['http', 'https', 'proxy']:
                folder = Path(directory) / mode
                state = linux.init_state(folder, fixtures.config(mode), fixtures.release())
                linux.render(folder, state, fixtures.release())
                self.check_isolation(json.loads((folder / 'compose.json').read_text()))
                identity = state['installationId']
                linux.render(folder, state, fixtures.release('c' * 40))
                model = json.loads((folder / 'compose.json').read_text())
                self.check_isolation(model)
                self.assertTrue(model['services']['presentation-converter']['image'].endswith('c' * 40))
                self.assertEqual(state['installationId'], identity)
                self.assertEqual(set(fixtures.release()['images']), {'web', 'postgres', 'livekit', 'caddy'})

    def test_vps_configuration_and_legacy_validation(self):
        generated = vps.configuration('8.8.8.8', fixtures.release(), '11111111-1111-4111-8111-111111111111')
        model = generated['compose']
        self.check_isolation(model)
        vps.validate_compose(model, model['name'])
        model['services']['presentation-converter']['init'] = False
        with self.assertRaisesRegex(ValueError, 'init'):
            vps.validate_compose(model, model['name'])
        model['services']['presentation-converter']['init'] = True
        # Existing four-service installations remain discoverable/updateable.
        del model['services']['presentation-converter']
        del model['volumes']['converter-socket']
        model['services']['web']['volumes'] = ['web-data:/data']
        vps.validate_compose(model, model['name'])

    @unittest.skipUnless(os.name == 'nt', 'Windows generator executes on its actual target OS')
    def test_windows_local_remote_and_removal_validation(self):
        helper = str(ROOT / 'scripts/simple-easy-setup-deploy.ps1').replace("'", "''")
        with tempfile.TemporaryDirectory() as directory:
            location = directory.replace("'", "''")
            command = """
$ErrorActionPreference='Stop'
. '%s'
$release=[pscustomobject]@{images=[pscustomobject]@{web='web:test';postgres='postgres:test';livekit='livekit:test';caddy='caddy:test'}}
$results=@()
foreach($target in @('local','remote')){
 $folder=Join-Path '%s' $target
 $null=New-Item -ItemType Directory -Path $folder
 $state=New-SimpleConfiguration $folder '8.8.8.8' $false $release
 Set-SimpleTarget $folder $state $target '8.8.8.8' 'root' 22
 Write-SimpleConfiguration $folder $state $release '8.8.8.8'
 $model=Get-Content (Join-Path $folder 'compose.json') -Raw|ConvertFrom-Json
 $null=Get-SimpleRemovalProject $state $model
 $model.services.'presentation-converter'.init=$false
 $rejected=$false;try{$null=Get-SimpleRemovalProject $state $model}catch{$rejected=$true}
 if(-not $rejected){throw 'Converter without init accepted'}
 $model.services.'presentation-converter'.init=$true
 $results+=,$model
}
$results|ConvertTo-Json -Depth 20 -Compress
""" % (helper, location)
            result = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', command],
                                    capture_output=True, text=True, check=True)
            for model in json.loads(result.stdout):
                self.check_isolation(model)

    def test_static_production_compose_resolves_same_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / 'docker-compose.yml').write_bytes((ROOT / 'infrastructure/production/docker-compose.yml').read_bytes())
            for name in ['web.env', 'postgres.env']:
                (folder / name).write_text('')
            result = subprocess.run(['docker', 'compose', '-f', str(folder / 'docker-compose.yml'),
                                     'config', '--format', 'json'], capture_output=True, text=True, check=True,
                                    env={**os.environ, 'CASTLINK_WEB_IMAGE': 'web:test'})
            model = json.loads(result.stdout)
            worker = model['services'].get('presentation-converter')
            self.assertIsNotNone(worker, 'Static installations must also provision the converter')
            self.assertEqual(worker['image'], model['services']['web']['image'])
            self.assertEqual(worker['network_mode'], 'none')
            self.assertIs(worker.get('init'), True)
            self.assertEqual(worker['user'], '10001:10001')
            self.assertTrue(worker['read_only'])
            self.assertEqual(int(worker['mem_limit']), 512 * 1024 * 1024)
            self.assertEqual(worker['volumes'][0]['source'], 'converter-socket')
            web_socket = next(m for m in model['services']['web']['volumes'] if m['target'] == '/run/castlink-converter')
            self.assertTrue(web_socket['read_only'])

    def test_static_rollback_handles_pre_converter_and_current_images(self):
        import shutil
        bash = shutil.which('bash') if os.name != 'nt' else 'C:/Program Files/Git/bin/bash.exe'
        if not bash or not Path(bash).is_file():
            self.skipTest('Bash is unavailable')
        def shell_path(path):
            value = str(path).replace('\\\\', '/')
            return '/' + value[0].lower() + value[2:] if os.name == 'nt' else value
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            binary = folder / 'bin'; binary.mkdir()
            backup = folder / 'backup'; backup.mkdir()
            (backup / 'previous-web-image.txt').write_text('web:previous\n')
            log = folder / 'docker.log'
            (binary / 'docker').write_text("""#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CASTLINK_TEST_DOCKER_LOG"
if [[ "$1" == run ]]; then [[ "$CASTLINK_TEST_HAS_CONVERTER" == 1 ]]; exit; fi
if [[ "$1" == inspect ]]; then echo healthy; fi
""")
            (binary / 'curl').write_text('#!/usr/bin/env bash\nexit 0\n')
            for item in binary.iterdir():
                item.chmod(0o755)
            for available in ['0', '1']:
                log.write_text('')
                environment = {**os.environ, 'CASTLINK_ROOT': shell_path(folder),
                    'CASTLINK_COMPOSE_FILE': shell_path(folder / 'compose.yml'),
                    'CASTLINK_TEST_BIN': shell_path(binary), 'CASTLINK_TEST_DOCKER_LOG': shell_path(log),
                    'CASTLINK_TEST_SCRIPT': shell_path(ROOT / 'scripts/production-rollback.sh'),
                    'CASTLINK_TEST_BACKUP': shell_path(backup), 'CASTLINK_TEST_HAS_CONVERTER': available}
                result = subprocess.run([bash, '-c', 'export PATH="$CASTLINK_TEST_BIN:$PATH"; exec bash "$CASTLINK_TEST_SCRIPT" "$CASTLINK_TEST_BACKUP"'],
                                        env=environment, capture_output=True, text=True, check=True)
                calls = log.read_text().splitlines()
                starts = [line for line in calls if ' up -d ' in line]
                self.assertEqual(len(starts), 1)
                self.assertEqual('presentation-converter' in starts[0], available == '1')
                if available == '0':
                    self.assertTrue(any(' stop presentation-converter' in line for line in calls))
                self.assertIn('rollback complete', result.stdout)

    def test_runtime_contains_worker_and_seeds_nonroot_socket_volume(self):
        dockerfile = (ROOT / 'Dockerfile.web').read_text()
        self.assertIn('fonts-liberation python3 ', dockerfile)
        self.assertNotIn('python3-minimal', dockerfile)
        self.assertIn('COPY --chmod=0444 scripts/presentation-converter/server.py', dockerfile)
        self.assertRegex(dockerfile, r'install -d[^\n]*-o 10001[^\n]*-g 10001[^\n]*/run/castlink-converter')

if __name__ == '__main__':
    unittest.main()
