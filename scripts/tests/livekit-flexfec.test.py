"""Verify effective publisher repair settings without starting containers."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
OPTION = 'LIVEKIT_RTC_FLEXFEC_UPSTREAM_ENABLED'


def load(path):
    spec = importlib.util.spec_from_file_location(path, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FlexFEC(unittest.TestCase):
    def check_compose(self, folder, file):
        def resolve():
            environment = dict(os.environ)
            environment.pop(OPTION, None)
            result = subprocess.run(['docker', 'compose', '-f', str(file), 'config', '--format', 'json'],
                                    cwd=folder, env=environment, capture_output=True, check=True)
            return json.loads(result.stdout)['services']

        before = resolve()
        self.assertIsNone(before['livekit']['environment'][OPTION])
        setting = folder / '.env'
        setting.write_text(f'{OPTION}=true\n')
        enabled = resolve()
        self.assertEqual(enabled['livekit']['environment'][OPTION], 'true')
        enabled['livekit']['environment'][OPTION] = None
        self.assertEqual(enabled, before)
        setting.unlink()
        self.assertEqual(resolve(), before)

    def test_stock_and_generated_compose(self):
        fixtures = load('scripts/tests/linux-compose-setup.test.py')
        linux = fixtures.m
        vps = load('scripts/server-provision-vps.py')
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            file = folder / 'compose.yml'
            for name in ['infrastructure/livekit/docker-compose.yml', 'infrastructure/production/docker-compose.media.yml']:
                shutil.copyfile(ROOT / name, file)
                self.check_compose(folder, file)
            release = fixtures.release()
            state = linux.init_state(folder, fixtures.config('http'), release)
            linux.render(folder, state, release)
            self.check_compose(folder, folder / 'compose.json')
            file.write_text(json.dumps(vps.configuration('192.0.2.10', release)['compose']))
            self.check_compose(folder, file)


if __name__ == '__main__':
    unittest.main()
