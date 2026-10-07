import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../ubuntu-easy-setup-bootstrap.sh',import.meta.url));
function run(body){return spawnSync('bash',['-c','source "$1" || exit; '+body,'fixture',script],{encoding:'utf8'});}
test('VPS bootstrap check reports missing runtime without installing or changing directories',()=>{
 const r=run('check_platform(){ :; }; runtime_ready(){ return 1; }; install_runtime(){ echo UNEXPECTED; }; prepare_scope(){ echo UNEXPECTED; }; main check');
 assert.equal(r.status,10);assert.doesNotMatch(r.stdout,/UNEXPECTED/);
});
test('ready VPS preserves running Docker and prepares only its own scope',()=>{
 const r=run('check_platform(){ :; }; runtime_ready(){ return 0; }; install_runtime(){ echo UNEXPECTED; }; prepare_scope(){ echo OWN_SCOPE; }; main prepare');
 assert.equal(r.status,0);assert.match(r.stdout,/OWN_SCOPE/);assert.doesNotMatch(r.stdout,/UNEXPECTED/);
});
test('runtime installation requires explicit install mode and verifies the result',()=>{
 const r=run('check_platform(){ :; }; runtime_ready(){ return 1; }; install_runtime(){ echo INSTALL; }; prepare_scope(){ echo UNEXPECTED; }; main install');
 assert.equal(r.status,3);assert.match(r.stdout,/INSTALL/);assert.doesNotMatch(r.stdout,/UNEXPECTED/);
});
test('Compose version comparison accepts future majors and rejects older releases',()=>{
 const r=run('compose_supported 2.23.1 && compose_supported v5.5.1 && ! compose_supported 2.23.0 && ! compose_supported garbage');
 assert.equal(r.status,0);
});
test('install mode leaves an existing ready engine and Compose untouched',()=>{
 const r=run('docker(){ echo 5.5.1; }; systemctl(){ [[ "$*" == "is-active --quiet docker" ]]; }; apt-get(){ echo UNEXPECTED; return 99; }; install_runtime');
 assert.equal(r.status,0);assert.doesNotMatch(r.stdout,/UNEXPECTED/);
});
test('an existing engine with missing Compose installs only the plugin and reuses its apt source',()=>{
 const r=run('docker(){ return 1; }; systemctl(){ [[ "$*" == "is-active --quiet docker" ]]; }; apt-get(){ echo "APT:$*"; }; apt-cache(){ return 0; }; install_runtime');
 assert.equal(r.status,0);assert.match(r.stdout,/APT:install -y docker-compose-plugin/);assert.doesNotMatch(r.stdout,/docker-ce|containerd/);
});
