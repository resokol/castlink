// Standalone fixture adapter; never supplies a production restore endpoint.
import path from 'node:path';
export function fixtureDockerSelector(platform){
 if(platform==='win32')return ['--context','desktop-linux'];
 if(platform==='linux')return ['--host=unix:///var/run/docker.sock'];
 throw Error('PG fixture platform unsupported');
}
export function fixtureCapacityPaths(platform,workspace){
 fixtureDockerSelector(platform);
 if(platform==='win32'){
  if(typeof workspace!=='string'||!/^D:\\/i.test(workspace)||!path.win32.isAbsolute(workspace))throw Error('PG fixture requires an absolute D drive workspace');
  return [workspace,workspace];
 }
 if(typeof workspace!=='string'||!path.posix.isAbsolute(workspace))throw Error('PG fixture requires an absolute workspace');
 return [workspace,'/tmp'];
}
export function fixtureDockerEnvironment(parent){const env={...parent};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];return env;}
