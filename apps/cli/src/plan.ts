import path from 'node:path';
import { isIP } from 'node:net';
import { CliError, type HostFacts, type InstallPlan, type InstallRequest } from './types.js';

export function validateProfileName(name: string): void {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) throw new CliError('Invalid profile name (a-z, 0-9, hyphen; 1–32 characters).');
}
export function validateRequest(request: InstallRequest): void {
  validateProfileName(request.profile);
  if (!['loopback','lan','internet'].includes(request.network)) throw new CliError('Invalid network mode.');
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(request.release)) throw new CliError('Invalid release; select an exact release version.');
  if (request.target.kind !== 'local' && request.target.kind !== 'remote') throw new CliError('Invalid target.');
  if (!request.root || /[\x00\r\n]/.test(request.root)) throw new CliError('Invalid root path.');
  const absolute = request.target.kind==='remote' ? path.posix.isAbsolute(request.root) : path.posix.isAbsolute(request.root) || path.win32.isAbsolute(request.root);
  const rootOnly = request.root==='/' || /^[a-z]:[\\/]?$/i.test(request.root);
  if (!absolute || rootOnly || request.root.split(/[\\/]/).includes('..')) throw new CliError('Root must be an absolute installation directory, not filesystem root.');
  if (request.target.kind === 'remote') {
    const {host,user,port} = request.target;
    if (!host || host.length>253 || !/^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/.test(host)) throw new CliError('Invalid SSH host.');
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(user)) throw new CliError('Invalid SSH user.');
    if (!Number.isInteger(port) || port<1 || port>65535) throw new CliError('Invalid SSH port.');
  }
  if (request.domain !== undefined && (typeof request.domain !== 'string' || request.network !== 'internet')) throw new CliError('Domain is allowed only as a string in internet mode.');
  if (request.network === 'internet') {
    const domain = request.domain;
    if (!domain || domain.length>253 || isIP(domain) || !domain.includes('.') || !domain.split('.').every(label=>/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))) {
      throw new CliError('Internet mode requires a plain own domain for TLS.');
    }
  }
}

export function createPlan(request: InstallRequest, facts: HostFacts): InstallPlan {
  validateRequest(request);
  const blockers: string[] = [];
  if (request.target.kind === 'local') {
    if (!((facts.platform==='win32' && facts.arch==='x64') || (facts.platform==='darwin' && ['x64','arm64'].includes(facts.arch)))) blockers.push('Unsupported local platform/architecture (Windows 11 x64, macOS 14+ arm64/x64).');
    if (facts.platform==='darwin' && facts.osVersion && Number(facts.osVersion.split('.')[0])<14) blockers.push('macOS 14 or newer is required.');
  } else if (facts.platform!=='linux' || !['x64','arm64'].includes(facts.arch) || (facts.osVersion && !['22.04','24.04'].includes(facts.osVersion))) {
    blockers.push('Remote target must be Ubuntu Server 22.04/24.04 x64/arm64.');
  }
  if (facts.existingInstallationId) blockers.push('Existing installation found; setup must not overwrite its files.');
  return {schemaVersion:1, request:structuredClone(request), steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'], blockers};
}
