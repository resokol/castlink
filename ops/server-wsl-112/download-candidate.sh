set -euo pipefail
: "${FACTORY_RUN:?}" "${FACTORY_SHA:?}" "${ARTIFACT_ID:?}" "${ARTIFACT_SHA256:?}" "${ARTIFACT_SIZE:?}"
cd "$RUNNER_TEMP"
gh api "repos/resokol/castlink/actions/artifacts/$ARTIFACT_ID" > candidate-metadata.json
python3 - <<'PY'
import json,os
e=os.environ; m=json.load(open('candidate-metadata.json'))
assert m['id']==int(e['ARTIFACT_ID']) and not m['expired']
assert m['name']=='castlink-server-wsl-candidate-'+e['FACTORY_SHA'] and m['digest']=='sha256:'+e['ARTIFACT_SHA256']
assert m['workflow_run']['id']==int(e['FACTORY_RUN']) and m['workflow_run']['head_sha']==e['FACTORY_SHA']
assert m['size_in_bytes']==int(e['ARTIFACT_SIZE'])
PY
allow_binary=()
if gh api --help | grep -F -- "--allow-escape-sequences" > /dev/null; then allow_binary+=(--allow-escape-sequences); fi
gh api "${allow_binary[@]}" "repos/resokol/castlink/actions/artifacts/$ARTIFACT_ID/zip" > candidate.zip
test "$(stat -c %s candidate.zip)" -eq "$ARTIFACT_SIZE"
printf '%s  candidate.zip\n' "$ARTIFACT_SHA256" | sha256sum -c --strict
PYTHONPATH="$GITHUB_WORKSPACE/ops/server-wsl-112" python3 - <<'PY'
import shutil,zipfile
from pathlib import Path
from publisher import NAMES
d=Path('wsl-final-package');d.mkdir(mode=0o700)
with zipfile.ZipFile('candidate.zip') as archive:
 entries=archive.infolist()
 assert len(entries)==len(NAMES) and {e.filename for e in entries}==NAMES
 assert sum(e.file_size for e in entries)<6_000_000_000
 for e in entries:
  with archive.open(e) as s,(d/e.filename).open('xb') as t: shutil.copyfileobj(s,t,4*1024*1024)
PY
rm candidate.zip
