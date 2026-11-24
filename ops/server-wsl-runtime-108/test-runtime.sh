set -Eeuo pipefail
umask 077
proofdir="$RUNNER_TEMP/wsl-runtime"
mkdir -p "$proofdir/baseline" "$proofdir/candidate"
oldtag=server-wsl-v1.0.7-0d16de2e782c
oldsha=0d16de2e782cd2e847e9824024c5b788a080a59b
gh release download "$oldtag" -R resokol/castlink -D "$proofdir/baseline" -p manifest.json -p CastLink-Server-WSL-amd64.tar.gz
gh api "repos/resokol/castlink/releases/tags/$oldtag" > "$proofdir/baseline/release.json"
python3 - "$proofdir/baseline" "$oldsha" "$oldtag" <<'PY'
import hashlib,json,sys
from pathlib import Path
d=Path(sys.argv[1]); release=json.loads((d/'release.json').read_bytes())
assert release['tag_name']==sys.argv[3] and not release['draft'] and not release['prerelease']
m=json.loads((d/'manifest.json').read_bytes()); assert m['sourceCommit']==sys.argv[2] and m['releaseTag']==sys.argv[3]
for name in ['manifest.json',m['rootfs']['file']]:
 a,=[a for a in release['assets'] if a['name']==name]
 with (d/name).open('rb') as f: h=hashlib.file_digest(f,'sha256').hexdigest()
 assert 'sha256:'+h==a['digest'] and (d/name).stat().st_size==a['size']
 if name==m['rootfs']['file']: assert h==m['rootfs']['sha256']
PY
if test -n "$FACTORY_RUN"; then
 gh api "repos/resokol/castlink/actions/runs/$FACTORY_RUN" > "$proofdir/candidate/run.json"
 jq -e --arg sha "$FACTORY_SHA" '.head_sha==$sha and .path==".github/workflows/server-wsl-package.yml" and .conclusion=="success"' "$proofdir/candidate/run.json" >/dev/null
 gh run download "$FACTORY_RUN" -R resokol/castlink -n "castlink-server-wsl-install-$FACTORY_SHA" -D "$proofdir/candidate"
 python3 - "$proofdir/candidate" "$FACTORY_SHA" "$oldtag" <<'PY'
import hashlib,json,sys
from pathlib import Path
d=Path(sys.argv[1]); m=json.loads((d/'manifest.json').read_bytes()); assert m['sourceCommit']==sys.argv[2] and m['releaseTag']=='server-wsl-v1.0.8-'+sys.argv[2][:12]
assert sys.argv[3] in m['lifecycle']['supportedSources']
for e in [m['rootfs'],*m['lifecycle']['helpers']]:
 with (d/e['file']).open('rb') as f: assert hashlib.file_digest(f,'sha256').hexdigest()==e['sha256']
PY
fi
sudo apt-get -qq update
sudo apt-get -qq install -y --no-install-recommends systemd-container
sudo modprobe nf_tables
prepare(){
 local label="$1" r="$proofdir/$1"
 sudo mkdir "$r/tree"
 sudo tar --numeric-owner -xzpf "$r/CastLink-Server-WSL-amd64.tar.gz" -C "$r/tree"
 sudo systemd-run --unit="castlinkproof-$label" -p Delegate=yes -p KillMode=mixed -- /usr/bin/systemd-nspawn --keep-unit --boot --private-network --settings=no --resolv-conf=off --capability=all --machine="castlink-$label" --directory="$r/tree"
 for ((i=0;i<90;i++)); do
  leader=$(machinectl show "castlink-$label" -p Leader --value 2>/dev/null || true)
  if [[ "$leader" =~ ^[1-9][0-9]+$ ]] && guest systemctl is-system-running 2>/dev/null | grep -Eq "^(degraded|running)$"; then break; fi
  sleep 1
 done
 [[ "$leader" =~ ^[1-9][0-9]+$ ]] || { sudo journalctl -u "castlinkproof-$label" -n 45 --no-pager; return 1; }
 guest ip -o link | awk -F': ' '{print $2}' | grep -qx lo
 test "$(guest ip -o link | wc -l)" -eq 1
}
guest(){ sudo nsenter --target "$leader" --mount --uts --ipc --net --pid --cgroup --root --wdns=/ -- /usr/bin/env -i HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin LANG=C.UTF-8 "$@"; }
diagnose(){ if test -n "${leader:-}" && test -e "/proc/$leader"; then guest systemctl --failed --no-pager || true; guest sh -c 'cd /opt/castlink/app; id; ip -br addr; runuser -u castlink-caddy -- env XDG_DATA_HOME=/var/lib/castlink-server/caddy XDG_CONFIG_HOME=/var/lib/castlink-server/caddy/config /usr/local/bin/caddy validate --config /etc/castlink-server/Caddyfile --adapter caddyfile 2>&1 | tail -4; systemctl daemon-reload' || true; guest journalctl -b -u castlink-private-ports -u castlink-converter -u castlink-livekit -u castlink-postgres -u castlink-web -u castlink-caddy -u castlink-turn-tls --no-pager -o cat | grep -Ei 'failed|denied|cannot|error' | sed -E 's#(postgresql|https?|wss?)://[^ ]+#[address omitted]#g' | tail -20 || true; fi; }
trap diagnose ERR
prepare baseline
oldid=$(cat /proc/sys/kernel/random/uuid | tr -d -)
newid=$(cat /proc/sys/kernel/random/uuid | tr -d -)
transaction=$(cat /proc/sys/kernel/random/uuid)
marker=/var/lib/castlink-server-wsl-installation-id
printf %s "$oldid" | guest tee "$marker" >/dev/null
guest bash -ec 'umask 077; tr -d "-" </proc/sys/kernel/random/uuid | tr -d "\n" > /run/castlink-proof-password; /usr/local/bin/castlink-server init --lang en --address 127.0.0.1 --media-ip 127.0.0.1 --room-creation-password-file /run/castlink-proof-password; rm /run/castlink-proof-password'
guest /usr/local/bin/castlink-server start
guest /usr/local/bin/castlink-server status | jq -e --arg b "${oldtag#server-wsl-v}" '.ready and .buildId==$b' >/dev/null
db(){ guest runuser -u postgres -- /usr/lib/postgresql/16/bin/psql -d castlink -h /run/castlink-postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
db -c "CREATE TABLE release_108_fixture (payload text NOT NULL); INSERT INTO release_108_fixture VALUES ('from-1.0.7')"
guest /usr/local/bin/castlink-server stop
echo 'Published 1.0.7 started HTTPS/DB/LiveKit successfully in loopback-only guest, recorded test DB row and stopped'
if test -z "$FACTORY_RUN"; then exit 0; fi
oldtree="$proofdir/baseline/tree"; newtree="$proofdir/candidate/tree"
for name in server-wsl-maintenance.py server-wsl-runtime.py; do sudo install -D -m600 "$proofdir/candidate/$name" "$oldtree/run/castlink-proof/$name"; done
oldtool(){ guest python3 /run/castlink-proof/server-wsl-maintenance.py "$1" --installation-id "$oldid"; }
oldtool inspect | jq -e '.stopped and .initialized and .complete and .postgresMajor==16' >/dev/null
oldtool export >"$proofdir/transfer.tar"
prepare candidate
printf %s "$newid" | guest tee "$marker" >/dev/null
tool(){ local action="$1"; shift; guest /usr/local/bin/castlink-server-maintenance "$action" --installation-id "$newid" "$@"; }
tool gate-close --transaction-id "$transaction"
tool import <"$proofdir/transfer.tar"
sudo python3 - "$oldtree" "$newtree" <<'PY'
import json,sys,hashlib
from pathlib import Path
a,b=[Path(d)/'var/lib/castlink-server' for d in sys.argv[1:]]
x,y=[json.loads((d/'state.json').read_bytes()) for d in (a,b)]
for k in ['installationId','nodeId','address','origin','mediaIp','turnHost','publicHttps','roomCreationPasswordHash']:
 assert x[k]==y[k],k
assert x['release']['version']=='1.0.7' and y['release']['version']=='1.0.8'
for name in ['secrets.json','postgres/castlink-installation-id','data/server-origin-ca.pem']:
 assert (a/name).read_bytes()==(b/name).read_bytes(),name
matches=list((a/'caddy').rglob('*.key')); assert matches
for f in matches: assert f.read_bytes()==(b/f.relative_to(a)).read_bytes()
print('Installation and node IDs, origin, media, password, secrets, private TLS keys and public CA survived transfer')
PY
guest /usr/local/bin/castlink-server start
newbuild="1.0.8-${FACTORY_SHA:0:12}"
guest /usr/local/bin/castlink-server status | jq -e --arg b "$newbuild" '.ready and .buildId==$b' >/dev/null
tool gate-open --committed-transaction "$transaction"
guest /usr/local/bin/castlink-server status | jq -e --arg b "$newbuild" '.ready and .buildId==$b' >/dev/null
test "$(db -c 'SELECT payload FROM release_108_fixture')" = 'from-1.0.7'
guest /usr/local/bin/castlink-server stop
jq -n --arg s "$FACTORY_SHA" --arg r "$FACTORY_RUN" --arg from "$oldtag" --arg to "server-wsl-v$newbuild" '{source:$s,factory:$r,from:$from,to:$to,loopbackOnly:true,sourceReady:true,sourceStopped:true,targetReadyBeforeOpening:true,targetReadyAfterOpening:true,dbRowPreserved:true,identitiesTlsAndCredentialsPreserved:true}' > "$RUNNER_TEMP/runtime-proof.json"
echo 'Upgrade runtime proof passed'
