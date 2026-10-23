"""Isolated legacy production updater tests: no real Docker, network or data."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / 'scripts/production-update.sh'
BASH = str(Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Git/bin/bash.exe') if os.name == 'nt' else shutil.which('bash')

def posix(path):
    value = str(path).replace('\\', '/')
    return '/' + value[0].lower() + value[2:] if len(value) > 1 and value[1] == ':' else value

class ProductionUpdateTests(unittest.TestCase):
    def run_update(self, sequence=None, **settings):
        with tempfile.TemporaryDirectory(prefix='castlink-update-fixture-') as temporary:
            root = Path(temporary)
            (root / 'scripts').mkdir()
            (root / 'scripts/production-update.sh').write_text(SOURCE.read_text(encoding='utf-8'), encoding='utf-8', newline='\n')
            tools = root / 'bin'
            tools.mkdir()
            docker = '''#!/bin/bash
printf '%s\\n' "$*" >> "$FIXTURE_LOG"
case "$*" in
  'inspect studiolink-web --format {{.Config.Image}}') echo "${FIXTURE_OLD:-studiolink_web:1.0.0-old}";;
  'inspect studiolink-web --format {{.Image}}') echo sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;
  'inspect converter-id --format {{.Config.Image}}') echo "${FIXTURE_OLD:-studiolink_web:1.0.0-old}";;
  'inspect converter-id --format {{.Image}}') echo sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;;
  'inspect studiolink-web --format {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}') echo "${FIXTURE_HEALTH:-healthy}";;
  'image inspect '*'--format {{.Id}}') if test "${FIXTURE_CHANGED:-0}" = 1; then echo sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; else echo sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; fi;;
  'image rm '*) test "${FIXTURE_REMOVE_FAIL:-0}" != 1 || exit 1;;
  'ps -aq --filter ancestor='*) if test "${FIXTURE_USED:-0}" = 1; then echo stopped-container; elif test "${FIXTURE_ALIAS:-0}" = 1; then echo current-container; fi;;
  'inspect stopped-container --format {{.Config.Image}}') echo "${FIXTURE_OLD:-studiolink_web:1.0.0-old}";;
  'inspect current-container --format {{.Config.Image}}') echo studiolink_web:1.0.0-new;;
  'compose '*' ps -q presentation-converter') echo converter-id;;
  'compose '*' ps -q postgres') echo postgres-id;;
  'inspect '*'--format {{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}') if test "${FIXTURE_SERVICE_FAIL:-0}" = 1; then echo 'false|none'; else echo 'true|healthy'; fi;;
esac
exit 0
'''
            for name, content in {'docker': docker, 'node': '#!/bin/sh\nexit 0\n', 'curl': '#!/bin/sh\ntest "${FIXTURE_HTTP_FAIL:-0}" != 1\n', 'sleep': '#!/bin/sh\nexit 0\n', 'seq': '#!/bin/sh\necho 1\n'}.items():
                file = tools / name
                file.write_text(content, encoding='utf-8', newline='\n')
                file.chmod(0o700)
            log = root / 'docker.log'
            for invocation in (sequence or [settings]):
                new_image = invocation.get('new', 'studiolink_web:1.0.0-new')
                env = dict(os.environ, CASTLINK_ROOT=posix(root), FIXTURE_LOG=posix(log), **{'FIXTURE_' + key.upper(): str(value) for key, value in invocation.items() if key != 'new'})
                result = subprocess.run([BASH, '-c', 'export PATH="$1:/usr/bin:/bin"; shift; exec bash "$@"', 'fixture', posix(tools), 'scripts/production-update.sh', new_image], cwd=root, env=env, text=True, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stderr) if sequence else None
            calls = log.read_text() if log.exists() else ''
            self.assertFalse((root / 'backups').exists())
            return result, calls

    def test_no_automatic_backups(self):
        source = SOURCE.read_text(encoding='utf-8')
        self.assertNotRegex(source, r'storage-backup|postgres-backup|BACKUP_ROOT|pre-update-')
        self.assertNotRegex(source, r'(image|system) prune|image rm --force')

    def test_success_retires_previous_owned_unused_tag(self):
        result, calls = self.run_update()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('image rm --no-prune studiolink_web:1.0.0-old'), 1)

    def test_old_tag_alias_of_current_image_is_retired(self):
        result, calls = self.run_update(alias=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('image rm --no-prune studiolink_web:1.0.0-old', calls)

    def test_stopped_image_cleanup_retried_after_later_success(self):
        result, calls = self.run_update(sequence=[{'used': 1}, {'old': 'studiolink_web:1.0.0-new', 'new': 'studiolink_web:1.0.0-next'}])
        self.assertIn('image rm --no-prune studiolink_web:1.0.0-old', calls)

    def test_failed_image_removal_retried_after_later_success(self):
        result, calls = self.run_update(sequence=[{'remove_fail': 1}, {'old': 'studiolink_web:1.0.0-new', 'new': 'studiolink_web:1.0.0-next'}])
        self.assertEqual(calls.count('image rm --no-prune studiolink_web:1.0.0-old'), 2)

    def test_failed_health_keeps_rollback_image(self):
        result, calls = self.run_update(health='unhealthy')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('image rm ', calls)
        self.assertIn('up -d presentation-converter web', calls)

    def test_unready_service_keeps_previous_images(self):
        result, calls = self.run_update(service_fail=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('image rm ', calls)

    def test_failed_http_does_not_retire_images(self):
        result, calls = self.run_update(http_fail=1)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('image rm ', calls)

    def test_stopped_container_changed_tag_and_foreign_image_preserved(self):
        for settings in ({'used': 1}, {'changed': 1}, {'old': 'foreign/web:1.0.0-old'}):
            with self.subTest(settings=settings):
                result, calls = self.run_update(**settings)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertNotIn('image rm ', calls)

if __name__ == '__main__':
    unittest.main()
